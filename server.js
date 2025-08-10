// server.js — Johnny Chat API
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const OpenAI = require("openai");

// Lazy require so the app still boots even if install is missing
let pdfParse = null;
try { pdfParse = require("pdf-parse"); }
catch { console.warn("[boot] pdf-parse not installed yet. PDF uploads will error until it is."); }

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CHAT_MODEL = process.env.CHAT_MODEL || "gpt-4o-mini";
const IMAGE_MODEL = process.env.IMAGE_MODEL || "gpt-image-1";

if (!OPENAI_API_KEY) { console.error("Missing OPENAI_API_KEY"); process.exit(1); }
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// In-memory docs: docId -> { text, summary, uploadedAt, names[] }
const docs = new Map();

async function summarize(text, maxTokens = 300) {
  const resp = await openai.responses.create({
    model: CHAT_MODEL,
    input: [
      { role: "system", content: "You are a concise technical summarizer. 2–4 sentences. No links/citations." },
      { role: "user", content: text.slice(0, 6000) }
    ],
    // no temperature (avoid 'Unsupported parameter' with some models)
  });
  return resp.output_text?.trim() || "";
}

async function extractFromFile(file) {
  const { buffer, mimetype } = file;
  if (mimetype === "application/pdf") {
    if (!pdfParse) throw new Error("pdf-parse not installed on server");
    const parsed = await pdfParse(buffer);           // reads all pages; returns text
    return (parsed.text || "").trim();
  }
  if (mimetype.startsWith("image/")) {
    const base64 = buffer.toString("base64");
    const resp = await openai.responses.create({
      model: CHAT_MODEL,
      input: [
        { role: "system", content: "Extract readable text (OCR) and add a short description. Plain text only." },
        {
          role: "user",
          content: [
            { type: "input_text", text: "Describe this image and OCR any visible text." },
            { type: "input_image", image_url: `data:${mimetype};base64,${base64}` }
          ]
        }
      ],
      // no temperature
    });
    return resp.output_text?.trim() || "";
  }
  throw new Error(`Unsupported media type: ${mimetype}`);
}

/* ----------------------------- Routes ----------------------------- */

// Chat
app.post("/api/chat", async (req, res) => {
  try {
    const input = String(req.body?.input || "");
    const history = Array.isArray(req.body?.history) ? req.body.history : [];

    const sys =
      "You are Johnny Chat. Be helpful, direct, and concise. " +
      "Do NOT include URLs, markdown links, or bracketed citations in the answer body. " +
      "The UI will show sources separately.";

    const messages = [{ role: "system", content: sys }, ...history, { role: "user", content: input }];

    const resp = await openai.responses.create({
      model: CHAT_MODEL,
      input: messages
    });

    const reply = resp.output_text?.trim() || "(no reply)";
    res.json({ reply, sources: [] });
  } catch (e) {
    console.error("CHAT_ERROR:", e);
    res.status(503).json({ error: "CHAT_FAILED", detail: e?.message || String(e) });
  }
});

// Beautify
app.post("/api/beautify", async (req, res) => {
  try {
    const text = String(req.body?.text || "");
    if (!text) return res.status(400).json({ error: "TEXT_REQUIRED" });
    const prompt =
      "Rewrite the answer so it is clean, readable, and well-structured.\n" +
      "Rules: 1–2 short paragraphs OR 3–8 bullets. No URLs or bracketed citations. Be concise.";
    const resp = await openai.responses.create({
      model: CHAT_MODEL,
      input: [
        { role: "system", content: prompt },
        { role: "user", content: text }
      ]
    });
    res.json({ pretty: resp.output_text?.trim() || text });
  } catch (e) {
    console.error("BEAUTIFY_ERROR:", e);
    res.status(500).json({ error: "BEAUTIFY_FAILED", detail: e?.message || String(e) });
  }
});

// Upload multiple files -> aggregate into one doc
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
app.post("/upload", upload.any(), async (req, res) => {
  try {
    const files = (req.files && req.files.length) ? req.files : (req.file ? [req.file] : []);
    if (!files.length) return res.status(400).json({ error: "FILE_REQUIRED" });

    const parts = [];
    for (const f of files) {
      const text = await extractFromFile(f);
      parts.push(`--- ${f.originalname} ---\n${text}`);
    }
    const full = parts.join("\n\n");
    const summary = full ? await summarize(full) : "";

    const docId = uuidv4();
    docs.set(docId, { text: full, summary, uploadedAt: Date.now(), names: files.map(f => f.originalname) });

    res.json({ docId, text: full, summary });
  } catch (e) {
    console.error("UPLOAD_ERROR:", e);
    res.status(500).json({ error: "UPLOAD_FAILED", detail: e?.message || String(e) });
  }
});

// Query the aggregated doc
app.post("/query", async (req, res) => {
  try {
    const docId = String(req.body?.docId || "");
    const question = String(req.body?.question || "");
    if (!docId || !docs.has(docId)) return res.status(400).json({ error: "DOC_NOT_FOUND" });
    if (!question) return res.status(400).json({ error: "QUESTION_REQUIRED" });

    const { text, summary } = docs.get(docId);
    const sys =
      "Answer ONLY from the document below. If the answer isn't present, say you couldn't find it. No links or citations.";
    const resp = await openai.responses.create({
      model: CHAT_MODEL,
      input: [
        { role: "system", content: sys },
        { role: "user", content: `Document summary:\n${summary}\n\nDocument text:\n${text.slice(0, 20000)}` },
        { role: "user", content: `Question: ${question}` }
      ]
    });
    res.json({ answer: resp.output_text?.trim() || "" });
  } catch (e) {
    console.error("QUERY_ERROR:", e);
    res.status(500).json({ error: "QUERY_FAILED", detail: e?.message || String(e) });
  }
});

// Image generation
app.post("/generate-image", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "");
    const size = String(req.body?.size || "1024x1024");
    if (!prompt) return res.status(400).json({ error: "PROMPT_REQUIRED" });

    const img = await openai.images.generate({ model: IMAGE_MODEL, prompt, size });
    const image_b64 = img.data?.[0]?.b64_json || "";
    res.json({ image_b64 });
  } catch (e) {
    console.error("IMAGE_ERROR:", e);
    res.status(500).json({ error: "IMAGE_FAILED", detail: e?.message || String(e) });
  }
});

app.get("/", (_req, res) => res.send("Johnny Chat API ok"));
app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
