// server.js  — Johnny Chat backend (ESM)
// Node 20+, Express, OpenAI Responses API, pdfjs-dist for PDF text, multer for uploads

import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";

// ---- optional, safe dynamic import for pdfjs-dist in Node ESM ----
const PDFJS = await (async () => {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  // wire worker so Render doesn’t try to fetch a file
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  return pdfjs;
})();

const app = express();
const upload = multer({ limits: { fileSize: 40 * 1024 * 1024 } }); // 40MB/file
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// ---------- OpenAI ----------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CHAT_MODEL   = process.env.CHAT_MODEL   || "gpt-5";
const IMAGE_MODEL  = process.env.IMAGE_MODEL  || "gpt-image-1";
const VISION_MODEL = process.env.VISION_MODEL || "gpt-4o-mini";

// ---------- Utilities ----------
const ok = (res, data) => res.status(200).json(data);
const bad = (res, code, err) => res.status(code).json({ error: String(err?.message || err) });
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`);

// Basic health
app.get("/health", (_req, res) => ok(res, { ok: true, uptime: process.uptime() }));

// ---------- In-memory doc store ----------
/** id -> { text, summary, files:[{name,type,size}] } */
const DOCS = new Map();

// ---------- OpenAI helper (Responses API) ----------
async function llm({ system, user, max_output_tokens = 1800, tools, verbosity }) {
  const input = [
    ...(system ? [{ role: "system", content: system }] : []),
    { role: "user", content: user },
  ];

  const resp = await openai.responses.create({
    model: CHAT_MODEL,
    input,
    max_output_tokens,
    ...(verbosity ? { verbosity } : {}),
    ...(tools ? { tools } : {}),
  });

  const text = resp.output_text ?? "";
  // best-effort URL scrape to let the UI show “Sources”
  const urlRegex = /\bhttps?:\/\/[^\s)]+/g;
  const sources = Array.from(text.match?.(urlRegex) || []);
  return { text, sources };
}

// ---------- /api/chat ----------
app.post("/api/chat", async (req, res) => {
  try {
    const { input, history = [], mode } = req.body || {};
    if (!input || typeof input !== "string") return bad(res, 400, "missing input");

    // fold short recent history for better continuity without blowing token budget
    const histLines = history
      .slice(-40)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const system =
      mode === "writepaper"
        ? "You are a rigorous, elegant academic writer. Deliver tightly argued, evidence-aware prose with vivid examples, clean structure, and strong transitions. No headings or meta-commentary unless asked."
        : "You are a friendly, precise assistant. Answer clearly and concisely, show URLs only when useful.";

    const user =
      histLines
        ? `Conversation so far (compressed):\n${histLines}\n\nCurrent user message:\n${input}`
        : input;

    const { text, sources } = await llm({ system, user, max_output_tokens: mode === "writepaper" ? 4000 : 1800 });
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
    const { text: pretty } = await llm({
      system:
        "Rewrite the text for clarity and polish. Keep meaning. Remove redundant citations and raw URLs. Output the improved text only.",
      user: text,
      max_output_tokens: 800,
    });
    return ok(res, { pretty });
  } catch (err) {
    return bad(res, 500, err);
  }
});

// ---------- Helpers: read PDF text with pdfjs-dist ----------
async function pdfToText(buffer) {
  const loadingTask = PDFJS.getDocument({ data: buffer });
  const doc = await loadingTask.promise;
  let out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const text = content.items.map((it) => (typeof it.str === "string" ? it.str : "")).join(" ");
    out.push(text);
  }
  return out.join("\n\n").replace(/[ \t]+/g, " ").trim();
}

// ---------- /upload (PDFs + images) ----------
app.post("/upload", upload.array("files", 8), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return bad(res, 400, "no files");

    let textParts = [];
    const manifest = [];

    // gather text from PDFs locally; images go through vision model for OCR/summary later
    const imageInputs = [];

    for (const f of files) {
      manifest.push({ name: f.originalname, type: f.mimetype, size: f.size });
      if (f.mimetype === "application/pdf") {
        const txt = await pdfToText(f.buffer);
        if (txt) textParts.push(`--- ${f.originalname} ---\n${txt}`);
      } else if (f.mimetype.startsWith("image/")) {
        const b64 = f.buffer.toString("base64");
        imageInputs.push({
          type: "input_image",
          image_url: `data:${f.mimetype};base64,${b64}`,
        });
      }
    }

    // If there are images, ask the model to OCR + summarize them briefly
    if (imageInputs.length) {
      const resp = await openai.responses.create({
        model: VISION_MODEL,
        input: [
          {
            role: "user",
            content: [
              { type: "text", text: "Extract any visible text (OCR) and summarize what is shown. Return OCR text first, then a 2–3 sentence summary." },
              ...imageInputs,
            ],
          },
        ],
        max_output_tokens: 1200,
      });
      const visionText = resp.output_text ?? "";
      if (visionText) textParts.push(`--- Images (OCR + summary) ---\n${visionText}`);
    }

    const text = textParts.join("\n\n").trim();

    // Ask the chat model for a clean short summary of the combined text
    let summary = "";
    if (text) {
      const { text: sum } = await llm({
        system: "You summarize documents crisply.",
        user:
          "Summarize in 5–8 bullet points. Be concrete, keep numbers, dates, names. Avoid filler.",
        max_output_tokens: 500,
      });
      summary = sum;
    }

    const id = newId();
    DOCS.set(id, { text, summary, files: manifest });
    return ok(res, { id, docId: id, text, summary, files: manifest });
  } catch (err) {
    return bad(res, 500, err);
  }
});

// ---------- /query (ask about uploaded docs) ----------
app.post("/query", async (req, res) => {
  try {
    const { docId, question } = req.body || {};
    if (!docId || !DOCS.has(docId)) return bad(res, 400, "missing or unknown docId");
    if (!question) return bad(res, 400, "missing question");

    const { text, files } = DOCS.get(docId);
    const { text: answer } = await llm({
      system:
        "Answer strictly from the provided document text. If the answer is not in the text, say you cannot find it.",
      user: `DOCUMENT TEXT:\n${text}\n\nQUESTION: ${question}\n\nAnswer:`,
      max_output_tokens: 1200,
    });
    return ok(res, { answer, files });
  } catch (err) {
    return bad(res, 500, err);
  }
});

// ---------- /generate-image ----------
app.post("/generate-image", async (req, res) => {
  try {
    const { prompt, size = "1024x1024", images = [] } = req.body || {};
    if (!prompt && !images?.length) return bad(res, 400, "missing prompt");

    // if user passed reference images (data URLs), treat as editing guidance via prompt
    const imgResp = await openai.images.generate({
      model: IMAGE_MODEL,
      prompt: images?.length
        ? `${prompt}\n\nReference guidance included via attached images; match composition/subject where obvious but improve quality.`
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

// ---------- start ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Johnny Chat backend listening on :${PORT}`);
});
