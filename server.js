// server.js — Johnny Chat (Responses API + native web_search, no third‑party fetches)
// ESM, Node 20+
import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs"; // workerless for Node

const app = express();

// uploads in memory so we always have file.buffer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024, files: 8 },
});

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// ── Models from Render env ─────────────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CHAT_MODEL    = process.env.CHAT_MODEL    || "gpt-5";
const IMAGE_MODEL   = process.env.IMAGE_MODEL   || "gpt-image-1";
const VISION_MODEL  = process.env.VISION_MODEL  || "gpt-4o-mini";
const WEATHER_MODEL = process.env.WEATHER_MODEL || "gpt-4o-mini"; // fast lane model

// ── Helpers ───────────────────────────────────────────────────────────────────
const ok  = (res, data) => res.status(200).json(data);
const bad = (res, code, err) => {
  const msg = typeof err === "string" ? err : (err?.message || "error");
  console.error("[ERROR]", msg);
  if (err?.response?.status) console.error("→ OpenAI status", err.response.status, err.response.data);
  return res.status(code).json({ error: msg });
};
const newId =
  () => (globalThis.crypto?.randomUUID?.() || `id-${Math.random().toString(36).slice(2)}`);

const LIVE_REGEX = /\b(now|today|tonight|tomorrow|latest|breaking|update|news|price|rate|score|forecast|weather|warning|advisory|open|closed|traffic)\b/i;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

const DOCS = new Map(); // id -> { text, summary, files }

// Health
app.get("/health", (_req, res) =>
  ok(res, { ok: true, ts: Date.now(), models: { CHAT_MODEL, WEATHER_MODEL, VISION_MODEL } })
);

// ── Responses API wrappers (native web_search) ────────────────────────────────
function extractUrls(text = "") {
  try { return Array.from(text.match(/\bhttps?:\/\/[^\s)]+/g) || []); } catch { return []; }
}

async function responsesCall({ model, messages, tools = [], max_output_tokens = 1500, temperature }) {
  // messages: array of {role, content} where content is string for text‑only
  return openai.responses.create({
    model,
    input: messages,
    ...(tools.length ? { tools } : {}),
    max_output_tokens,
    ...(typeof temperature === "number" ? { temperature } : {}),
  });
}

// ── Weather Fast Lane (still uses web_search; no external APIs) ───────────────
const weatherCache = new Map();
const WEATHER_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cacheKeyWeather({ location, days, units }) {
  return `${(location||"").trim().toLowerCase()}|${days||2}|${units||"F"}`;
}

const WEATHER_SCHEMA = `Return ONLY valid JSON in this schema:
{
  "location": "<normalized place name>",
  "generated_at": "<ISO timestamp>",
  "days": [
    {
      "date": "YYYY-MM-DD",
      "periods": [
        {"name":"day","high":<number|null>,"low":<number|null>,"precip_pct":<number|null>,"wind":"<text>","summary":"<one sentence>"},
        {"name":"night","high":null,"low":<number|null>,"precip_pct":<number|null>,"wind":"<text>","summary":"<one sentence>"}
      ]
    }
  ],
  "alerts": [{"title":"<string>","severity":"<string>","url":"<url>"}],
  "sources": ["<url1>","<url2>"]
}
Rules: You MUST use the web_search tool to obtain live data; prefer authoritative sources (e.g., NWS/NOAA for the U.S.). No prose outside JSON. If you cannot get live data, return {"error":"no_live_data","sources":[]}.`;

function weatherPrompt({ location, days = 2, units = "F" }) {
  return `Task: Provide a concise ${days}-day forecast for ${location}. Units: ${units === "C" ? "Celsius" : "Fahrenheit"}.
Include highs/lows, precip %, wind, and any watches/warnings/advisories if present.`;
}

async function getWeather({ location, days = 2, units = "F" }) {
  if (!location) throw new Error("missing location");

  const key = cacheKeyWeather({ location, days, units });
  const cached = weatherCache.get(key);
  if (cached && cached.expires > Date.now()) return { ...cached.payload, cached: true };

  // 1st attempt with fast model
  const baseMessages = [
    { role: "system", content: "You are a weather summarizer. Use tools when needed and output only the requested JSON." },
    { role: "user", content: WEATHER_SCHEMA },
    { role: "user", content: weatherPrompt({ location, days, units }) },
  ];
  const tools = [{ type: "web_search" }];

  let r = await responsesCall({
    model: WEATHER_MODEL,
    messages: baseMessages,
    tools,
    temperature: 0.1,
    max_output_tokens: 900,
  });

  let text = r.output_text ?? "";
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = null; }

  // Fallback to main model if no valid JSON or no sources
  const sources = extractUrls(text);
  const invalid = !parsed || (!parsed.sources && sources.length === 0);

  if (invalid) {
    r = await responsesCall({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: "Use web_search NOW and return ONLY valid JSON per the schema. No prose." },
        { role: "user", content: WEATHER_SCHEMA },
        { role: "user", content: weatherPrompt({ location, days, units }) },
      ],
      tools,
      temperature: 0.1,
      max_output_tokens: 900,
    });
    text = r.output_text ?? "";
    try { parsed = JSON.parse(text); } catch { parsed = null; }
  }

  const payload = parsed || { error: "unable_to_parse_weather", raw: text };
  weatherCache.set(key, { expires: Date.now() + WEATHER_TTL_MS, payload });
  return payload;
}

// API: POST /weather  { location, days?, units? }
app.post("/weather", async (req, res) => {
  try {
    const { location, days = 2, units = "F" } = req.body || {};
    const payload = await getWeather({ location, days, units });
    ok(res, payload);
  } catch (err) { bad(res, 500, err); }
});

// Intercept /api/chat when mode === "weather" (keeps your existing frontend working)
async function maybeInterceptWeather(req, res) {
  const { input, mode, units = "F", days = 2 } = req.body || {};
  if (mode !== "weather") return false;
  const location = (input || "").replace(/^\s*weather\s*(for|in)?\s*/i, "").trim() || input;
  const payload = await getWeather({ location, days, units });
  ok(res, { reply: JSON.stringify(payload), sources: payload.sources || [] });
  return true;
}

// ── General Chat (Responses API + web_search with robust retry) ───────────────
app.post("/api/chat", async (req, res) => {
  try {
    if (await maybeInterceptWeather(req, res)) return;

    const { input, history = [], mode } = req.body || {};
    if (!input || typeof input !== "string") return bad(res, 400, "missing input");

    const hist = history
      .slice(-30)
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const system =
      mode === "writepaper"
        ? "You are a rigorous, elegant academic writer. Produce tightly argued, source‑aware prose. No headings unless asked."
        : "You are a precise assistant. Prefer fresh, verifiable information. Use the web_search tool when the query is time‑sensitive or requires current facts.";

    const userMsg = hist ? `Conversation summary:\n${hist}\n\nCurrent message:\n${input}` : input;

    // First attempt: allow web_search, let model decide
    let r = await responsesCall({
      model: CHAT_MODEL,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: userMsg },
      ],
      tools: [{ type: "web_search" }],
      max_output_tokens: mode === "writepaper" ? 4000 : 1800,
    });

    let text = r.output_text ?? "";
    let sources = extractUrls(text);

    // If obviously live info and no citations, retry with strict instruction
    if (LIVE_REGEX.test(input) && sources.length === 0) {
      r = await responsesCall({
        model: CHAT_MODEL,
        messages: [
          { role: "system", content: "Use web_search NOW and answer concisely with 2–4 citations." },
          { role: "user", content: input },
        ],
        tools: [{ type: "web_search" }],
        temperature: 0.2,
        max_output_tokens: 1200,
      });
      text = r.output_text ?? text;
      sources = extractUrls(text);
    }

    ok(res, { reply: text, sources });
  } catch (err) { bad(res, 500, err); }
});

// ── Beautify ──────────────────────────────────────────────────────────────────
app.post("/api/beautify", async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text) return bad(res, 400, "missing text");
    const r = await responsesCall({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: "Rewrite for clarity, flow, and concision. Preserve meaning. Output improved text only." },
        { role: "user", content: text },
      ],
      max_output_tokens: 800,
    });
    ok(res, { pretty: r.output_text ?? "" });
  } catch (err) { bad(res, 500, err); }
});

// ── PDF text (Buffer → Uint8Array; workerless) ────────────────────────────────
async function pdfToText(buf) {
  const data = buf instanceof Uint8Array ? buf : new Uint8Array(buf.buffer ?? buf);
  const loadingTask = pdfjs.getDocument({
    data,
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  });
  const doc = await loadingTask.promise;
  const parts = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    parts.push(content.items.map(it => (typeof it.str === "string" ? it.str : "")).join(" "));
  }
  return parts.join("\n\n").replace(/[ \t]+/g, " ").trim();
}

// ── Upload (PDF + images with OCR/description via Responses API) ──────────────
app.post("/upload", upload.array("files", 8), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return bad(res, 400, "no files");

    const manifest = [];
    const textParts = [];
    const visionParts = [];

    for (const f of files) {
      manifest.push({ name: f.originalname, type: f.mimetype, size: f.size });

      if (f.mimetype === "application/pdf") {
        if (!f.buffer) throw new Error("PDF missing buffer (memoryStorage required)");
        const txt = await pdfToText(f.buffer);
        if (txt) textParts.push(`--- ${f.originalname} ---\n${txt}`);
      } else if (IMAGE_TYPES.has(f.mimetype)) {
        const dataUrl = `data:${f.mimetype};base64,${f.buffer.toString("base64")}`;
        visionParts.push({ type: "input_image", image_url: { url: dataUrl } });
      }
    }

    if (visionParts.length) {
      const resp = await openai.responses.create({
        model: VISION_MODEL,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: "Do OCR if any text exists. If none, say so, then give a concise 2–3 sentence description (objects, layout, notable details)." },
              ...visionParts,
            ],
          },
        ],
        max_output_tokens: 1200,
      });
      const visionText = resp.output_text ?? "";
      if (visionText) textParts.push(`--- Images (OCR + description) ---\n${visionText}`);
    }

    const text = textParts.join("\n\n").trim();

    let summary = "";
    if (text) {
      const r = await responsesCall({
        model: CHAT_MODEL,
        messages: [
          { role: "system", content: "You summarize documents crisply." },
          { role: "user", content: "Summarize in 5–8 bullet points. Keep concrete facts (numbers, dates, names)." },
        ],
        max_output_tokens: 500,
      });
      summary = r.output_text ?? "";
    }

    const id = newId();
    DOCS.set(id, { text, summary, files: manifest });
    ok(res, { id, docId: id, text, summary, files: manifest });
  } catch (err) { bad(res, 500, err); }
});

// ── Doc Q&A ───────────────────────────────────────────────────────────────────
app.post("/query", async (req, res) => {
  try {
    const { docId, question } = req.body || {};
    if (!docId || !DOCS.has(docId)) return bad(res, 400, "missing or unknown docId");
    if (!question) return bad(res, 400, "missing question");
    const { text, files } = DOCS.get(docId);
    const r = await responsesCall({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: "Answer strictly from the provided document text; if absent, say so." },
        { role: "user", content: `DOCUMENT:\n${text}\n\nQUESTION: ${question}\n\nAnswer:` },
      ],
      max_output_tokens: 1200,
    });
    ok(res, { answer: r.output_text ?? "", files });
  } catch (err) { bad(res, 500, err); }
});

// ── Image generation ──────────────────────────────────────────────────────────
app.post("/generate-image", async (req, res) => {
  try {
    const { prompt, size = "1024x1024", images = [] } = req.body || {};
    if (!prompt && !images?.length) return bad(res, 400, "missing prompt");
    const imgResp = await openai.images.generate({
      model: IMAGE_MODEL,
      prompt: images?.length
        ? `${prompt}\n\nReference images attached; align to obvious composition/subject while improving quality.`
        : prompt,
      size,
    });
    const image_b64 = imgResp.data?.[0]?.b64_json;
    if (!image_b64) return bad(res, 502, "image generation failed");
    ok(res, { image_b64 });
  } catch (err) { bad(res, 500, err); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Johnny Chat backend listening on :${PORT}`));
