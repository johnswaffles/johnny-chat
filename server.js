// server.js — Johnny Chat API (Responses API with robust built-in web capability)
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const OpenAI = require("openai");

// Lazy PDF loader
let pdfParse = null;
try { pdfParse = require("pdf-parse"); }
catch { console.warn("[boot] pdf-parse not installed yet. PDF uploads will error until installed."); }

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CHAT_MODEL = process.env.CHAT_MODEL || "gpt-4.1";     // keep a current model here
const IMAGE_MODEL = process.env.IMAGE_MODEL || "gpt-image-1";

if (!OPENAI_API_KEY) { console.error("Missing OPENAI_API_KEY"); process.exit(1); }
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const app = express();
app.use(cors());
app.use(express.json({ limit: "12mb" }));

// In-memory docs
const docs = new Map();
const isoNow = () => new Date().toISOString();
const sanitizeText = s => String(s||"").replace(/https?:\/\/\S+/gi,"").replace(/\[[0-9]+\]/g,"").trim();

/* -------- attempt Responses API with multiple possible built-in web tool identifiers -------- */
async function askOpenAI(messages, { tryWeb = true } = {}) {
  const variants = tryWeb
    ? [
        { tools: [{ type: "web_search" }], tool_choice: "auto" },
        { tools: [{ type: "web-browsing" }], tool_choice: "auto" },
        { tools: [{ type: "browser" }], tool_choice: "auto" },
        {} // plain
      ]
    : [ {} ];

  let lastErr = null;
  for (const v of variants) {
    try {
      const resp = await openai.responses.create({ model: CHAT_MODEL, input: messages, ...v });
      return resp;
    } catch (e) {
      lastErr = e;
      // If this variant is invalid (e.g., 400 bad tool type), try next one
      if ((e.status && e.status >= 500) || e.code === "ETIMEDOUT") continue;
    }
  }
  throw lastErr;
}

/* ----------------------------- extract sources ---------------------------- */
function extractSources(resp, answerText) {
  const urls = new Set();

  const refs = resp?.output?.[0]?.references || resp?.references;
  if (Array.isArray(refs)) refs.forEach(r => { if (r?.url) urls.add(r.url); });

  const parts = resp?.output?.[0]?.content || [];
  for (const p of parts) {
    if (Array.isArray(p?.citations)) for (const c of p.citations) if (c?.url) urls.add(c.url);
  }

  const m = String(answerText || "").match(/SOURCES_JSON:\s*(```json)?\s*([\s\S]*?)\s*(```)?\s*$/i);
  if (m && m[2]) {
    try { const arr = JSON.parse(m[2].trim()); if (Array.isArray(arr)) arr.forEach(u => { if (typeof u === "string") urls.add(u); }); } catch {}
  }

  return Array.from(urls).slice(0, 8);
}

/* --------------------------------- routes --------------------------------- */

// Chat
app.post("/api/chat", async (req, res) => {
  try {
    const input = String(req.body?.input || "");
    const history = Array.isArray(req.body?.history) ? req.body.history : [];

    const sys =
      `You are Johnny Chat. Date/Time (UTC): ${isoNow()}.\n` +
      "Use your latest built-in capability to gather up-to-date facts when the user asks for time-sensitive info (news, weather, sports, prices, etc.). " +
      "Keep answers concise. Do NOT include URLs, markdown links, or bracketed citations in the body. " +
      "If you consulted the web, append a final line: SOURCES_JSON: [\"<url>\", ...] with up to 8 unique URLs.";

    const messages = [{ role: "system", content: sys }, ...history, { role: "user", content: input }];

    const resp = await askOpenAI(messages, { tryWeb: true });
    let reply = resp.output_text?.trim() || "(no reply)";
    const sources = extractSources(resp, reply);

    reply = reply.replace(/SOURCES_JSON:[\s\S]*$/i, "").trim();
    res.json({ reply: sanitizeText(reply), sources });
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
    const prompt = "Rewrite the answer so it is clean, readable, and well-structured. 1–2 short paragraphs OR 3–8 bullets. No URLs or bracketed citations.";
    const r = await openai.responses.create({ model: CHAT_MODEL, input: [{ role:"system", content:prompt }, { role:"user", content:text }] });
    res.json({ pretty: r.output_text?.trim() || text });
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
    const sum = await openai.responses.create({
      model: CHAT_MODEL,
      input: [{ role:"system", content:"Summarize in 2–4 sentences, plain text." }, { role:"user", content: full.slice(0, 6000) }]
    });
    const summary = sum.output_text?.trim() || "";

    const docId = uuidv4();
    docs.set(docId, { text: full, summary, uploadedAt: Date.now(), names: files.map(f=>f.originalname) });

    res.json({ docId, text: full, summary });
  } catch (e) {
    console.error("UPLOAD_ERROR:", e);
    res.status(500).json({ error: "UPLOAD_FAILED", detail: e?.message || String(e) });
  }
});

// Doc Q&A
app.post("/query", async (req, res) => {
  try {
    const docId = String(req.body?.docId || "");
    const question = String(req.body?.question || "");
    if (!docId || !docs.has(docId)) return res.status(400).json({ error: "DOC_NOT_FOUND" });
    if (!question) return res.status(400).json({ error: "QUESTION_REQUIRED" });

    const { text, summary } = docs.get(docId);
    const sys = "Answer ONLY from the document below. If the answer isn't present, say you couldn't find it. No links or citations.";
    const r = await openai.responses.create({
      model: CHAT_MODEL,
      input: [
        { role:"system", content: sys },
        { role:"user", content: `Document summary:\n${summary}\n\nDocument text:\n${text.slice(0, 20000)}` },
        { role:"user", content: `Question: ${question}` }
      ]
    });
    res.json({ answer: r.output_text?.trim() || "" });
  } catch (e) {
    console.error("QUERY_ERROR:", e);
    res.status(500).json({ error: "QUERY_FAILED", detail: e?.message || String(e) });
  }
});

// Images
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

async function extractFromFile(file){
  const { buffer, mimetype } = file;
  if (mimetype === "application/pdf") {
    if (!pdfParse) throw new Error("pdf-parse not installed on server");
    const parsed = await pdfParse(buffer);
    return (parsed.text || "").trim();
  }
  if (mimetype.startsWith("image/")) {
    const base64 = buffer.toString("base64");
    const r = await openai.responses.create({
      model: CHAT_MODEL,
      input: [
        { role:"system", content:"Extract readable text (OCR) and add a short description. Plain text only." },
        { role:"user", content:[ { type:"input_text", text:"Describe this image and OCR any visible text." }, { type:"input_image", image_url:`data:${mimetype};base64,${base64}` } ] }
      ]
    });
    return r.output_text?.trim() || "";
  }
  throw new Error(`Unsupported media type: ${mimetype}`);
}

app.get("/", (_req, res) => res.send("Johnny Chat API ok"));
app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
