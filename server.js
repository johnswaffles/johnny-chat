// server.js — Johnny Chat backend (ESM, Node 20+)
import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";

// Use pdfjs-dist in Node without a worker (avoid workerSrc issues on Render)
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const app = express();
const upload = multer({ limits: { fileSize: 40 * 1024 * 1024 } }); // 40MB/file
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// ---------- OpenAI ----------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CHAT_MODEL   = process.env.CHAT_MODEL   || "gpt-5";
const IMAGE_MODEL  = process.env.IMAGE_MODEL  || "gpt-image-1";
const VISION_MODEL = process.env.VISION_MODEL || "gpt-4o-mini";

// ---------- Utils ----------
const ok = (res, data) => res.status(200).json(data);
const bad = (res, code, err) => res.status(code).json({ error: String(err?.message || err) });
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`);

// Health
app.get("/health", (_req, res) => ok(res, { ok: true, uptime: process.uptime() }));

// In‑memory doc store
const DOCS = new Map();

// OpenAI helper
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
  const sources = Array.from(text.match?.(/\bhttps?:\/\/[^\s)]+/g) || []);
  return { text, sources };
}

// ---------- /api/chat ----------
app.post("/api/chat", async (req, res) => {
  try {
    const { input, history = [], mode } = req.body || {};
    if (!input || typeof input !== "string") return bad(res, 400, "missing input");

    const histLines = history
      .slice(-40)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const system =
      mode === "writepaper"
        ? "You are a rigorous, elegant academic writer. Deliver tightly argued, evidence‑aware prose with vivid examples, clean structure, and strong transitions. No headings unless asked."
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
      system: "Rewrite for clarity and polish. Keep meaning. Remove redundant citations and raw URLs. Output improved text only.",
      user: text,
      max_output_tokens: 800,
    });
    return ok(res, { pretty });
  } catch (err) {
    return bad(res, 500, err);
  }
});

// ---------- PDF text extraction (no worker) ----------
async function pdfToText(buffer) {
  const loadingTask = pdfjs.getDocument({
    data: buffer,
    disableWorker: true,          // <— key fix for Render/Node
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  });
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
    const imageInputs = [];

    for (const f of files) {
      manifest.push({ name: f.originalname, type: f.mimetype, size: f.size });
      if (f.mimetype === "application/pdf") {
        const txt = await pdfToText(f.buffer);
        if (txt) textParts.push(`--- ${f.originalname} ---\n${txt}`);
      } else if (f.mimetype.startsWith("image/")) {
        const b64 = f.buffer.toString("base64");
        imageInputs.push({ type: "input_image", image_url: `data:${f.mimetype};base64,${b64}` });
      }
    }

    if (imageInputs.length) {
      const resp = await openai.responses.create({
        model: VISION_MODEL,
        input: [{ role: "user", content: [{ type: "text", text: "Extract any visible text (OCR) and summarize briefly." }, ...imageInputs] }],
        max_output_tokens: 1200,
      });
      const visionText = resp.output_text ?? "";
      if (visionText) textParts.push(`--- Images (OCR + summary) ---\n${visionText}`);
    }

    const text = textParts.join("\n\n").trim();
    let summary = "";
    if (text) {
      const { text: sum } = await llm({
        system: "You summarize documents crisply.",
        user: "Summarize in 5–8 bullet points. Keep numbers, dates, and names.",
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

// ---------- /query ----------
app.post("/query", async (req, res) => {
  try {
    const { docId, question } = req.body || {};
    if (!docId || !DOCS.has(docId)) return bad(res, 400, "missing or unknown docId");
    if (!question) return bad(res, 400, "missing question");

    const { text, files } = DOCS.get(docId);
    const { text: answer } = await llm({
      system: "Answer strictly from the provided document text. If the answer isn’t in the text, say so.",
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

    const imgResp = await openai.images.generate({
      model: IMAGE_MODEL,
      prompt: images?.length
        ? `${prompt}\n\nReference guidance attached; match composition/subject where obvious.`
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
app.listen(PORT, () => console.log(`Johnny Chat backend listening on :${PORT}`));
