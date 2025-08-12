// server.js — Johnny Chat backend with Weather Fast Lane (ESM, Node 20+)
import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs"; // workerless for Node

const app = express();

// uploads kept in memory so we always have file.buffer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024, files: 8 },
});

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// ---- Models (Render Env) ----
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CHAT_MODEL     = process.env.CHAT_MODEL     || "gpt-5";
const IMAGE_MODEL    = process.env.IMAGE_MODEL    || "gpt-image-1";
const VISION_MODEL   = process.env.VISION_MODEL   || "gpt-4o-mini";
const WEATHER_MODEL  = process.env.WEATHER_MODEL  || "gpt-4o-mini"; // fast lane default

// ---- Small helpers ----
const ok  = (res, data) => res.status(200).json(data);
const bad = (res, code, err) => res.status(code).json({ error: String(err?.message || err) });
const newId = () => (globalThis.crypto?.randomUUID?.() || `id-${Math.random().toString(36).slice(2)}`);
const LIVE_REGEX = /\b(now|today|tonight|tomorrow|latest|breaking|update|news|price|rate|score|forecast|weather|warning|advisory|open|closed|traffic)\b/i;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const DOCS = new Map();

app.get("/health", (_req, res) => ok(res, { ok: true, ts: Date.now(), models: { CHAT_MODEL, WEATHER_MODEL } }));

// ---- Responses API wrappers ----
async function responsesCall({ model, input, tools, max_output_tokens = 1500, temperature }) {
  return openai.responses.create({
    model,
    input,
    max_output_tokens,
    ...(tools ? { tools } : {}),
    ...(typeof temperature === "number" ? { temperature } : {}),
  });
}

function extractUrls(text = "") {
  return Array.from(text.match(/\bhttps?:\/\/[^\s)]+/g) || []);
}

// ───────────────────────────────────────────────────────────────────────────────
//  WEATHER FAST LANE
// ───────────────────────────────────────────────────────────────────────────────

// In‑memory cache: key => { expires, payload }
const weatherCache = new Map();
const WEATHER_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cacheKeyWeather({ location, days, units }) {
  return `${(location||"").trim().toLowerCase()}|${days||2}|${units||"F"}`;
}

function buildWeatherUserPrompt({ location, days = 2, units = "F" }) {
  return `Give a concise ${days}-day forecast for ${location}.
Return ONLY the JSON object in the required schema.
Use reputable sources via web_search (NWS/NOAA for US if available).
Units: ${units === "C" ? "Celsius" : "Fahrenheit"}.
Include watches/warnings/advisories if present.`;
}

const WEATHER_SCHEMA_HINT = `Required JSON schema:
{
  "location": "<normalized place name>",
  "generated_at": "<ISO timestamp>",
  "days": [
    {
      "date": "YYYY-MM-DD",
      "periods": [
        {"name": "day",    "high": <number>, "low": <number|null>, "precip_pct": <number|null>, "wind": "<dir speed>", "summary": "<one sentence>"},
        {"name": "night",  "high": null,     "low": <number|null>, "precip_pct": <number|null>, "wind": "<dir speed>", "summary": "<one sentence>"}
      ]
    }
  ],
  "alerts": [ {"title": "<string>", "severity": "<string>", "url": "<source url>"} ],
  "sources": ["<url1>", "<url2>"]
}
Rules: Use web_search; do not hallucinate; prefer NWS/NOAA for US. If you cannot find live data, return an object with "error":"no live data".`;

async function getWeatherFast({ location, days = 2, units = "F" }) {
  if (!location) throw new Error("missing location");

  // cache
  const key = cacheKeyWeather({ location, days, units });
  const cached = weatherCache.get(key);
  if (cached && cached.expires > Date.now()) return { ...cached.payload, cached: true };

  // primary call: small model with web_search, low temperature for consistency
  const input = [
    { role: "system", content: "You are a weather summarizer. You MUST use web_search for live data and output only the JSON schema described." },
    { role: "user", content: WEATHER_SCHEMA_HINT },
    { role: "user", content: buildWeatherUserPrompt({ location, days, units }) },
  ];

  let model = WEATHER_MODEL;
  let r = await responsesCall({
    model,
    input,
    tools: [{ type: "web_search" }],
    max_output_tokens: 900,
    temperature: 0.1,
  });

  // try to parse JSON
  let text = r.output_text ?? "";
  let data;
  try { data = JSON.parse(text); } catch { /* will fallback below */ }

  // fallback to main model if JSON parse failed or sources empty
  const sources = extractUrls(text);
  const invalid = !data || !Array.isArray(data?.days) || (sources.length === 0 && !(data?.sources?.length));

  if (invalid) {
    r = await responsesCall({
      model: CHAT_MODEL,
      input: [
        { role: "system", content: "Use web_search and return ONLY valid JSON per the given schema. No prose." },
        { role: "user", content: WEATHER_SCHEMA_HINT },
        { role: "user", content: buildWeatherUserPrompt({ location, days, units }) },
      ],
      tools: [{ type: "web_search" }],
      max_output_tokens: 900,
      temperature: 0.1,
    });
    text = r.output_text ?? "";
    try { data = JSON.parse(text); } catch { /* best effort */ }
  }

  const payload = data && typeof data === "object"
    ? data
    : { error: "unable_to_parse_weather", raw: text };

  weatherCache.set(key, { expires: Date.now() + WEATHER_TTL_MS, payload });
  return payload;
}

// API: POST /weather  { location: "Mt Vernon, IL", days?: 1|2|3, units?: "F"|"C" }
app.post("/weather", async (req, res) => {
  try {
    const { location, days = 2, units = "F" } = req.body || {};
    const payload = await getWeatherFast({ location, days, units });
    ok(res, payload);
  } catch (err) {
    // ultimate fallback: route to chat with web_search to avoid a dead end
    bad(res, 500, err);
  }
});

// Compatibility: if your frontend still hits /api/chat with mode:"weather", route to fast lane
// Body: { input: "Weather for Mt Vernon, IL", mode:"weather", units?:"F"|"C", days?:number }
async function maybeInterceptWeather(req, res) {
  const { input, mode, units, days } = req.body || {};
  if (mode !== "weather") return null;
  const location = (input || "").replace(/^\s*weather\s*(for|in)?\s*/i, "").trim() || input;
  const payload = await getWeatherFast({ location, days, units });
  ok(res, { reply: JSON.stringify(payload), sources: payload.sources || [] });
  return true;
}

// ───────────────────────────────────────────────────────────────────────────────
//  GENERAL CHAT, BEAUTIFY, UPLOAD/QUERY, IMAGE GEN (unchanged core behavior)
// ───────────────────────────────────────────────────────────────────────────────

app.post("/api/chat", async (req, res) => {
  try {
    // fast-lane intercept
    const intercepted = await maybeInterceptWeather(req, res);
    if (intercepted) return;

    const { input, history = [], mode } = req.body || {};
    if (!input || typeof input !== "string") return bad(res, 400, "missing input");

    const hist = history.slice(-30).map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");

    const system =
      mode === "writepaper"
        ? "You are a rigorous, elegant academic writer. Produce tightly argued, source‑aware prose with clear structure. No headings unless asked."
        : "You are a precise assistant. When a request is time‑sensitive or asks for current facts, you MUST use the web_search tool and cite reputable sources.";

    const user = hist ? `Conversation summary:\n${hist}\n\nCurrent message:\n${input}` : input;

    let r = await responsesCall({
      model: CHAT_MODEL,
      input: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: user },
      ],
      tools: [{ type: "web_search" }],
      max_output_tokens: mode === "writepaper" ? 4000 : 1800,
    });

    let text = r.output_text ?? "";
    let sources = extractUrls(text);

    if (LIVE_REGEX.test(input) && sources.length === 0) {
      r = await responsesCall({
        model: CHAT_MODEL,
        input: [
          { role: "system", content: "Use web_search NOW. Return a concise answer with 2–4 citations." },
          { role: "user", content: input },
        ],
        tools: [{ type: "web_search" }],
        max_output_tokens: 1000,
        temperature: 0.2,
      });
      text = r.output_text ?? text;
      sources = extractUrls(text);
    }

    ok(res, { reply: text, sources });
  } catch (err) { bad(res, 500, err); }
});

app.post("/api/beautify", async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text) return bad(res, 400, "missing text");
    const r = await responsesCall({
      model: CHAT_MODEL,
      input: [
        { role: "system", content: "Rewrite for clarity, flow, and concision. Preserve meaning. Output improved text only." },
        { role: "user", content: text },
      ],
      max_output_tokens: 800,
    });
    ok(res, { pretty: r.output_text ?? "" });
  } catch (err) { bad(res, 500, err); }
});

// PDF text (Buffer → Uint8Array; workerless)
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

// Upload (PDF + images)
app.post("/upload", upload.array("files", 8), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return bad(res, 400, "no files");

    const manifest = [];
    const textParts = [];
    const imageParts = [];

    for (const f of files) {
      manifest.push({ name: f.originalname, type: f.mimetype, size: f.size });

      if (f.mimetype === "application/pdf") {
        if (!f.buffer) throw new Error("PDF missing buffer (memoryStorage required)");
        const txt = await pdfToText(f.buffer);
        if (txt) textParts.push(`--- ${f.originalname} ---\n${txt}`);
      } else if (IMAGE_TYPES.has(f.mimetype)) {
        if (!f.buffer) throw new Error("Image missing buffer (memoryStorage required)");
        const dataUrl = `data:${f.mimetype};base64,${f.buffer.toString("base64")}`;
        imageParts.push({ type: "input_image", image_url: { url: dataUrl } });
      }
    }

    if (imageParts.length) {
      const resp = await openai.responses.create({
        model: VISION_MODEL,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: "Do OCR if any text exists. If none, say so, then give a 2–3 sentence description (objects, layout, notable details)." },
              ...imageParts,
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
        input: [
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

app.post("/query", async (req, res) => {
  try {
    const { docId, question } = req.body || {};
    if (!docId || !DOCS.has(docId)) return bad(res, 400, "missing or unknown docId");
    if (!question) return bad(res, 400, "missing question");
    const { text, files } = DOCS.get(docId);
    const r = await responsesCall({
      model: CHAT_MODEL,
      input: [
        { role: "system", content: "Answer strictly from the provided document text; if absent, say so." },
        { role: "user", content: `DOCUMENT:\n${text}\n\nQUESTION: ${question}\n\nAnswer:` },
      ],
      max_output_tokens: 1200,
    });
    ok(res, { answer: r.output_text ?? "", files });
  } catch (err) { bad(res, 500, err); }
});

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
