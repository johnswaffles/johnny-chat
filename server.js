// server.js — single-model path (chat + weather), stable Analyze (PDF + PNG/JPEG/WEBP)
// ESM, Node 20+

import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { Buffer } from "node:buffer";

const app = express();

// ── Express & uploads ─────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Frontend must POST form-data with field name "files"
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024, files: 8 },
});

// ── OpenAI client (Responses API; enable tools via beta header) ───────────────
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  defaultHeaders: { "OpenAI-Beta": process.env.OPENAI_BETA || "assistants=v2" },
});

const CHAT_MODEL   = process.env.CHAT_MODEL   || "gpt-5";
const IMAGE_MODEL  = process.env.IMAGE_MODEL  || "gpt-image-1";
const VISION_MODEL = process.env.VISION_MODEL || "gpt-4o-mini"; // for OCR/descriptions only

// ── Utils ─────────────────────────────────────────────────────────────────────
const ok  = (res, data) => res.status(200).json(data);
const bad = (res, code, err) => {
  const msg = typeof err === "string" ? err : (err?.message || "error");
  console.error("[ERROR]", msg);
  if (err?.response?.status) console.error("→ OpenAI", err.response.status, err.response.data);
  return res.status(code).json({ error: msg });
};
const LIVE_REGEX  = /\b(now|today|tonight|tomorrow|latest|breaking|update|news|price|rate|score|forecast|weather|warning|advisory|open|closed|traffic)\b/i;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const urlsFrom    = (s = "") => Array.from((s || "").match(/\bhttps?:\/\/[^\s)]+/g) || []);
const newId       = () => `id-${Math.random().toString(36).slice(2)}`;

// Health
app.get("/health", (_req, res) =>
  ok(res, { ok: true, ts: Date.now(), models: { CHAT_MODEL, VISION_MODEL } })
);

// ── Responses helper (ALWAYS use explicit parts) ──────────────────────────────
const webTool = [{ type: "web_search" }];

async function respond({ model, parts, tools = webTool, max_output_tokens = 1500, temperature }) {
  // parts: [{ role, content: [{ type:'input_text'|'input_image', ... }] }]
  return openai.responses.create({
    model,
    input: parts,
    ...(tools?.length ? { tools } : {}),
    ...(typeof temperature === "number" ? { temperature } : {}),
    max_output_tokens,
  });
}

// ── SINGLE chat endpoint (also handles Weather via mode:"weather") ────────────
app.post("/api/chat", async (req, res) => {
  try {
    const { input, history = [], mode } = req.body || {};
    if (!input || typeof input !== "string") return ok(res, { reply: "Please enter a message.", sources: [] });

    const hist = history.slice(-30).map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
    const system =
      mode === "writepaper"
        ? "You are a rigorous, elegant academic writer. Produce tightly argued, source-aware prose. No headings unless asked."
        : mode === "weather"
        ? "You are a concise weather assistant. Prefer authoritative sources (e.g., NWS/NOAA for U.S.). Use web_search for live data and cite 2–4 sources."
        : "You are a precise assistant. Prefer fresh, verifiable information. Use web_search for time-sensitive queries.";

    const userMsg = hist ? `Conversation summary:\n${hist}\n\nCurrent message:\n${input}` : input;

    // Pass 1 — normal (model decides whether to call web_search)
    let r = await respond({
      model: CHAT_MODEL,
      parts: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user",   content: [{ type: "input_text", text: userMsg }] },
      ],
      max_output_tokens: mode === "writepaper" ? 4000 : 1800,
    });
    let text = r.output_text ?? "";
    let sources = urlsFrom(text);

    // Pass 2 — if live-y and no citations, force web_search
    if (LIVE_REGEX.test(input) && sources.length === 0) {
      r = await respond({
        model: CHAT_MODEL,
        parts: [
          { role: "system", content: [{ type: "input_text", text: "Use web_search NOW and answer concisely with 2–4 citations." }] },
          { role: "user",   content: [{ type: "input_text", text: input }] },
        ],
        temperature: 0.2,
        max_output_tokens: 1200,
      });
      text = r.output_text || text;
      sources = urlsFrom(text);
    }

    // Pass 3 — if anything still went sideways, reply without tools (no blanks)
    if (!text || !text.trim()) {
      const r2 = await respond({
        model: CHAT_MODEL,
        parts: [{ role: "user", content: [{ type: "input_text", text: userMsg }] }],
        tools: [], // disable tools to guarantee a reply
        max_output_tokens: 800,
      });
      text = r2.output_text || "Unable to fetch live sources right now.";
      sources = urlsFrom(text);
    }

    ok(res, { reply: text, sources });
  } catch (err) {
    // Never surface a 500 to the UI for chat—return a graceful message
    console.error("[/api/chat] fatal", err);
    ok(res, { reply: "I hit an error fetching that just now. Try again in a moment.", sources: [] });
  }
});

// ── Beautify (unchanged) ──────────────────────────────────────────────────────
app.post("/api/beautify", async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text) return ok(res, { pretty: "" });
    const r = await respond({
      model: CHAT_MODEL,
      parts: [
        { role: "system", content: [{ type: "input_text", text: "Rewrite for clarity, flow, and concision. Preserve meaning. Output improved text only." }] },
        { role: "user",   content: [{ type: "input_text", text }] },
      ],
      max_output_tokens: 800,
    });
    ok(res, { pretty: r.output_text ?? "" });
  } catch (err) { bad(res, 500, err); }
});

// ── PDF extract (ALWAYS convert Buffer → plain Uint8Array) ────────────────────
function toU8(buf) {
  if (buf instanceof Uint8Array && buf.constructor?.name === "Uint8Array") return buf;
  if (Buffer.isBuffer(buf)) return Uint8Array.from(buf);
  return new Uint8Array(buf);
}

async function pdfToText(buf) {
  const data = toU8(buf);
  const task = pdfjs.getDocument({
    data,
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  });
  const doc = await task.promise;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    out.push(content.items.map(it => (typeof it.str === "string" ? it.str : "")).join(" "));
  }
  return out.join("\n\n").replace(/[ \t]+/g, " ").trim();
}

// ── Upload / Analyze (PDF + images) ───────────────────────────────────────────
const DOCS = new Map();

app.post("/upload", upload.array("files", 8), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return ok(res, { id: null, text: "", summary: "", files: [] });

    const manifest = [];
    const textParts = [];
    const visionParts = [];

    for (const f of files) {
      manifest.push({ name: f.originalname, type: f.mimetype, size: f.size });

      if (f.mimetype === "application/pdf") {
        const txt = await pdfToText(f.buffer);
        textParts.push(`--- ${f.originalname} ---\n${txt || "(No extractable text found.)"}`);
      } else if (IMAGE_TYPES.has(f.mimetype)) {
        // IMPORTANT: Responses API expects image_url to be a STRING (data URL)
        const dataUrl = `data:${f.mimetype};base64,${f.buffer.toString("base64")}`;
        visionParts.push({ type: "input_image", image_url: dataUrl });
      }
    }

    // OCR/describe any images
    if (visionParts.length) {
      const vr = await openai.responses.create({
        model: VISION_MODEL,
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: "If there is text, perform OCR. If not, say 'No text is present.' Then give a concise 2–3 sentence description." },
            ...visionParts,
          ],
        }],
        max_output_tokens: 1000,
      });
      const visionText = vr.output_text ?? "";
      if (visionText) textParts.push(`--- Images (OCR + description) ---\n${visionText}`);
    }

    const text = textParts.join("\n\n").trim();

    // Summarize (only if we actually have content)
    let summary = "";
    if (text) {
      const sr = await respond({
        model: CHAT_MODEL,
        parts: [
          { role: "system", content: [{ type: "input_text", text: "You summarize documents crisply." }] },
          { role: "user",   content: [{ type: "input_text", text: "Summarize in 5–8 bullet points. Keep concrete facts (numbers, dates, names)." }] },
        ],
        max_output_tokens: 600,
      });
      summary = sr.output_text ?? "";
    }

    const id = newId();
    DOCS.set(id, { text, summary, files: manifest });
    ok(res, { id, docId: id, text, summary, files: manifest });
  } catch (err) {
    console.error("[/upload] fatal", err);
    // Return 200 with empty payload so the UI never blocks on a 500
    ok(res, { id: null, text: "", summary: "", files: [], error: "analyze_failed" });
  }
});

// ── Doc Q&A (unchanged) ───────────────────────────────────────────────────────
app.post("/query", async (req, res) => {
  try {
    const { docId, question } = req.body || {};
    if (!docId || !DOCS.has(docId)) return ok(res, { answer: "" });
    if (!question) return ok(res, { answer: "" });
    const { text, files } = DOCS.get(docId);
    const r = await respond({
      model: CHAT_MODEL,
      parts: [
        { role: "system", content: [{ type: "input_text", text: "Answer strictly from the provided document text; if absent, say so." }] },
        { role: "user",   content: [{ type: "input_text", text: `DOCUMENT:\n${text}\n\nQUESTION: ${question}\n\nAnswer:` }] },
      ],
      max_output_tokens: 1200,
    });
    ok(res, { answer: r.output_text ?? "", files });
  } catch (err) { bad(res, 500, err); }
});

// ── Image generation (unchanged) ──────────────────────────────────────────────
app.post("/generate-image", async (req, res) => {
  try {
    const { prompt, size = "1024x1024", images = [] } = req.body || {};
    if (!prompt && !images?.length) return ok(res, { image_b64: null });
    const imgResp = await openai.images.generate({
      model: IMAGE_MODEL,
      prompt: images?.length
        ? `${prompt}\n\nReference images attached; align to obvious composition/subject while improving quality.`
        : prompt,
      size,
    });
    const image_b64 = imgResp.data?.[0]?.b64_json || null;
    ok(res, { image_b64 });
  } catch (err) { bad(res, 500, err); }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Johnny Chat backend listening on :${PORT}`));
