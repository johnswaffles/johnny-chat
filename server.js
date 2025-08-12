// server.js — single-path chat (incl. weather) + stable Analyze (PDF & PNG/JPEG/WEBP)
// Defensive fallbacks for Responses API variations (input_text vs text; tools on/off)
// ESM, Node >=20

import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { Buffer } from "node:buffer";

const app = express();

// ── Express / uploads ─────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Frontend must send multipart/form-data with field name "files"
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024, files: 8 },
});

// ── OpenAI client (Responses API + tools) ─────────────────────────────────────
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // Your Render env shows OPENAI_BETA=assistants=v2 — keep this header
  defaultHeaders: { "OpenAI-Beta": process.env.OPENAI_BETA || "assistants=v2" },
});

// Models from env (Render screenshot shows CHAT_MODEL=gpt-5, VISION_MODEL=gpt-4o-mini)
const CHAT_MODEL   = process.env.CHAT_MODEL   || "gpt-5";
const IMAGE_MODEL  = process.env.IMAGE_MODEL  || "gpt-image-1";
const VISION_MODEL = process.env.VISION_MODEL || "gpt-4o-mini";

// ── Utils ─────────────────────────────────────────────────────────────────────
const ok  = (res, data) => res.status(200).json(data);
const logE = (label, err) => {
  const msg = typeof err === "string" ? err : (err?.message || "error");
  console.error(`[${label}]`, msg);
  if (err?.response?.status) console.error("→ OpenAI", err.response.status, err.response.data);
};

const LIVE_REGEX  = /\b(now|today|tonight|tomorrow|latest|breaking|update|news|price|rate|score|forecast|weather|warning|advisory|open|closed|traffic)\b/i;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const urlsFrom    = (s = "") => Array.from((s || "").match(/\bhttps?:\/\/[^\s)]+/g) || []);
const newId       = () => `id-${Math.random().toString(36).slice(2)}`;

app.get("/health", (_req, res) =>
  ok(res, { ok: true, ts: Date.now(), models: { CHAT_MODEL, VISION_MODEL } })
);

// ── Responses helper with compatibility fallbacks ─────────────────────────────
// Some accounts expect {type:"input_text"}; others expect {type:"text"}.
// Some accounts can use {tools:[{type:"web_search"}]}; others cannot.
// We try (in order): input_text+tools → text+tools → input_text(no tools) → text(no tools).
function withTextType(parts, useInputText) {
  // clone & normalize text parts
  return parts.map(msg => ({
    role: msg.role,
    content: (msg.content || []).map(c => {
      if (c?.type === "input_text" || c?.type === "text") {
        return { type: useInputText ? "input_text" : "text", text: c.text };
      }
      return c; // input_image etc.
    }),
  }));
}

async function responsesCompat({ model, baseParts, allowTools = true, max_output_tokens = 1500, temperature }) {
  const attempts = [
    { useInputText: true,  useTools: allowTools },
    { useInputText: false, useTools: allowTools },
    { useInputText: true,  useTools: false },
    { useInputText: false, useTools: false },
  ];

  let lastErr;
  for (const a of attempts) {
    try {
      const parts = withTextType(baseParts, a.useInputText);
      const resp = await openai.responses.create({
        model,
        input: parts,
        ...(a.useTools ? { tools: [{ type: "web_search" }] } : {}),
        ...(typeof temperature === "number" ? { temperature } : {}),
        max_output_tokens,
      });
      return { resp, variant: a };
    } catch (err) {
      lastErr = err;
      // If tools not allowed, retry will drop tools; if type wrong, next retry flips it.
      continue;
    }
  }
  throw lastErr;
}

// ── CHAT (one path for everything; weather uses mode:"weather") ───────────────
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

    // Pass 1 (+compat): try with tools; auto-fallbacks inside responsesCompat
    let { resp } = await responsesCompat({
      model: CHAT_MODEL,
      baseParts: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user",   content: [{ type: "input_text", text: userMsg }] },
      ],
      allowTools: true,
      max_output_tokens: mode === "writepaper" ? 4000 : 1800,
    });

    let text = resp.output_text ?? "";
    let sources = urlsFrom(text);

    // Pass 2 — if clearly "live" and no citations, force web_search again (compat)
    if (LIVE_REGEX.test(input) && sources.length === 0) {
      ({ resp } = await responsesCompat({
        model: CHAT_MODEL,
        baseParts: [
          { role: "system", content: [{ type: "input_text", text: "Use web_search NOW and answer concisely with 2–4 citations." }] },
          { role: "user",   content: [{ type: "input_text", text: input }] },
        ],
        allowTools: true,
        max_output_tokens: 1200,
        temperature: 0.2,
      }));
      text = resp.output_text || text;
      sources = urlsFrom(text);
    }

    // Pass 3 — absolute fallback so you never see a blank
    if (!text || !text.trim()) {
      ({ resp } = await responsesCompat({
        model: CHAT_MODEL,
        baseParts: [{ role: "user", content: [{ type: "input_text", text: userMsg }] }],
        allowTools: false,
        max_output_tokens: 800,
      }));
      text = resp.output_text || "Unable to fetch live sources right now.";
      sources = urlsFrom(text);
    }

    ok(res, { reply: text, sources });
  } catch (err) {
    logE("/api/chat", err);
    // Graceful surface to UI instead of 500
    ok(res, { reply: "I hit an error fetching that just now. Try again in a moment.", sources: [] });
  }
});

// ── Beautify (unchanged; compat wrapper) ──────────────────────────────────────
app.post("/api/beautify", async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text) return ok(res, { pretty: "" });
    const { resp } = await responsesCompat({
      model: CHAT_MODEL,
      baseParts: [
        { role: "system", content: [{ type: "input_text", text: "Rewrite for clarity, flow, and concision. Preserve meaning. Output improved text only." }] },
        { role: "user",   content: [{ type: "input_text", text }] },
      ],
      allowTools: false,
      max_output_tokens: 800,
    });
    ok(res, { pretty: resp.output_text ?? "" });
  } catch (err) { logE("/api/beautify", err); ok(res, { pretty: "" }); }
});

// ── PDF text (ALWAYS plain Uint8Array for pdfjs) ──────────────────────────────
function toU8(buf) {
  if (buf instanceof Uint8Array && buf.constructor?.name === "Uint8Array") return buf;
  if (Buffer.isBuffer(buf)) return Uint8Array.from(buf); // copy from Node Buffer
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
        // Responses expects image_url as a STRING data URL
        const dataUrl = `data:${f.mimetype};base64,${f.buffer.toString("base64")}`;
        visionParts.push({ type: "input_image", image_url: dataUrl });
      }
    }

    if (visionParts.length) {
      // Vision OCR/description — no tools; compat for text vs input_text handled by wrapper below
      const baseParts = [{
        role: "user",
        content: [
          { type: "input_text", text: "If text exists, perform OCR. If not, say 'No text is present.' Then add a concise 2–3 sentence description (objects, layout, notable details)." },
          ...visionParts,
        ],
      }];

      // Try with VISION_MODEL (strict) then CHAT_MODEL (as fallback multimodal)
      let visionText = "";
      try {
        const vr = await responsesCompat({
          model: VISION_MODEL,
          baseParts,
          allowTools: false,
          max_output_tokens: 1000,
        });
        visionText = vr.resp.output_text ?? "";
      } catch (err) {
        logE("vision(primary)", err);
        try {
          const vr2 = await responsesCompat({
            model: CHAT_MODEL,
            baseParts,
            allowTools: false,
            max_output_tokens: 800,
          });
          visionText = vr2.resp.output_text ?? "";
        } catch (e2) {
          logE("vision(fallback)", e2);
          visionText = "(Image analysis failed.)";
        }
      }
      if (visionText) textParts.push(`--- Images (OCR + description) ---\n${visionText}`);
    }

    const text = textParts.join("\n\n").trim();

    let summary = "";
    if (text) {
      const { resp } = await responsesCompat({
        model: CHAT_MODEL,
        baseParts: [
          { role: "system", content: [{ type: "input_text", text: "You summarize documents crisply." }] },
          { role: "user",   content: [{ type: "input_text", text: "Summarize in 5–8 bullet points. Keep concrete facts (numbers, dates, names)." }] },
        ],
        allowTools: false,
        max_output_tokens: 600,
      });
      summary = resp.output_text ?? "";
    }

    const id = newId();
    DOCS.set(id, { text, summary, files: manifest });
    ok(res, { id, docId: id, text, summary, files: manifest });
  } catch (err) {
    logE("/upload", err);
    // Return a non-blocking response so UI doesn't show 500
    ok(res, { id: null, text: "", summary: "", files: [], error: "analyze_failed" });
  }
});

// ── Doc Q&A (from stored text only) ───────────────────────────────────────────
app.post("/query", async (req, res) => {
  try {
    const { docId, question } = req.body || {};
    if (!docId || !DOCS.has(docId) || !question) return ok(res, { answer: "" });
    const { text, files } = DOCS.get(docId);
    const { resp } = await responsesCompat({
      model: CHAT_MODEL,
      baseParts: [
        { role: "system", content: [{ type: "input_text", text: "Answer strictly from the provided document text; if absent, say so." }] },
        { role: "user",   content: [{ type: "input_text", text: `DOCUMENT:\n${text}\n\nQUESTION: ${question}\n\nAnswer:` }] },
      ],
      allowTools: false,
      max_output_tokens: 1200,
    });
    ok(res, { answer: resp.output_text ?? "", files });
  } catch (err) { logE("/query", err); ok(res, { answer: "" }); }
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
    ok(res, { image_b64: imgResp.data?.[0]?.b64_json || null });
  } catch (err) { logE("/generate-image", err); ok(res, { image_b64: null }); }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Johnny Chat backend listening on :${PORT}`));
