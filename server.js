// server.js — Johnny Chat backend (ESM, Node 20+)
import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs"; // workerless for Node

const app = express();

// keep uploads in memory so we always have file.buffer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024, files: 8 },
});

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// ---- OpenAI + models from env (your Render env looks good) ----
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CHAT_MODEL   = process.env.CHAT_MODEL   || "gpt-5";
const IMAGE_MODEL  = process.env.IMAGE_MODEL  || "gpt-image-1";
const VISION_MODEL = process.env.VISION_MODEL || "gpt-4o-mini";

const ok = (res, data) => res.status(200).json(data);
const bad = (res, code, err) => res.status(code).json({ error: String(err?.message || err) });
const newId = () => (globalThis.crypto?.randomUUID?.() || `id-${Math.random().toString(36).slice(2)}`);

app.get("/health", (_req, res) => ok(res, { ok: true, ts: Date.now() }));

// ---------- tiny in‑memory doc store ----------
const DOCS = new Map();

// ---------- helpers ----------
const LIVE_REGEX = /\b(now|today|tonight|tomorrow|latest|breaking|update|news|price|rate|score|forecast|weather|warning|advisory|open|closed|traffic)\b/i;

async function callResponses({ input, tools, max_output_tokens = 1800 }) {
  return openai.responses.create({
    model: CHAT_MODEL,
    input,
    max_output_tokens,
    ...(tools ? { tools } : {}),
  });
}

function extractUrls(text = "") {
  return Array.from(text.match(/\bhttps?:\/\/[^\s)]+/g) || []);
}

// ---------- /api/chat (forces web_search when needed) ----------
app.post("/api/chat", async (req, res) => {
  try {
    const { input, history = [], mode } = req.body || {};
    if (!input || typeof input !== "string") return bad(res, 400, "missing input");

    const hist = history.slice(-30).map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");

    const system =
      mode === "writepaper"
        ? "You are a rigorous, elegant academic writer. Produce tightly argued, source‑aware prose with clear structure. No headings unless asked."
        : "You are a precise assistant. When a request is time‑sensitive or asks for current facts, you MUST use the web_search tool and cite reputable sources.";

    const user = hist
      ? `Conversation summary:\n${hist}\n\nCurrent message:\n${input}`
      : input;

    const allowWeb = true;
    const tools = allowWeb ? [{ type: "web_search" }] : undefined;

    // 1st attempt (model chooses if it needs web)
    let r = await callResponses({
      input: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: user },
      ],
      tools,
      max_output_tokens: mode === "writepaper" ? 4000 : 1800,
    });

    let text = r.output_text ?? "";
    let sources = extractUrls(text);

    // If it clearly needed live data but didn't use web_search, ask again and insist.
    if (LIVE_REGEX.test(input) && sources.length === 0) {
      r = await callResponses({
        input: [
          { role: "system", content: "Use the web_search tool NOW. Return a concise answer with 2–4 citations." },
          { role: "user", content: input },
        ],
        tools: [{ type: "web_search" }],
        max_output_tokens: 1000,
      });
      text = r.output_text ?? text;
      sources = extractUrls(text);
    }

    return ok(res, { reply: text, sources });
  } catch (err) {
    return bad(res, 500, err);
  }
});

// ---------- /api/beautify ----------
app.post("/api/beautify", async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text) return bad(res, 400, "missing text");
    const r = await callResponses({
      input: [
        { role: "system", content: "Rewrite for clarity, flow, and concision. Preserve meaning. Output improved text only." },
        { role: "user", content: text },
      ],
      max_output_tokens: 800,
    });
    return ok(res, { pretty: r.output_text ?? "" });
  } catch (err) {
    return bad(res, 500, err);
  }
});

// ---------- PDF text (Buffer → Uint8Array; workerless) ----------
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

// ---------- /upload (PDF + images: png/jpg/jpeg/webp) ----------
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

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
        // Responses API expects `input_image` with image_url {url: ...}
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
              {
                type: "input_text",
                text:
                  "Do OCR if any text exists. If no text is visible, say so, then give a concise 2–3 sentence description of the image (objects, layout, notable details).",
              },
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
      const r = await callResponses({
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
    return ok(res, { id, docId: id, text, summary, files: manifest });
  } catch (err) {
    return bad(res, 500, err);
  }
});

// ---------- /query ----------
app.post("/query", async (req, res) => {
  try {
    const { docId, question } = req.body || {};
    if (!docId || !DOCS.has(docId)) return bad(res, 400, "missing or unknown docId");
    if (!question) return bad(res, 400, "missing question");
    const { text, files } = DOCS.get(docId);
    const r = await callResponses({
      input: [
        { role: "system", content: "Answer strictly from the provided document text; if absent, say so." },
        { role: "user", content: `DOCUMENT:\n${text}\n\nQUESTION: ${question}\n\nAnswer:` },
      ],
      max_output_tokens: 1200,
    });
    return ok(res, { answer: r.output_text ?? "", files });
  } catch (err) {
    return bad(res, 500, err);
  }
});

// ---------- /generate-image ----------
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
    return ok(res, { image_b64 });
  } catch (err) {
    return bad(res, 500, err);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Johnny Chat backend listening on :${PORT}`));
