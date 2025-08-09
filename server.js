// server.js — add per-user/day limits: 10 uploads, 10 image gens, 50 chats (America/Chicago)
// Requires: express, cors, dotenv, multer, openai, pdfjs-dist@3.11.174
// package.json should already have "type": "module"

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import OpenAI from "openai";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.js";

dotenv.config();

const PORT         = process.env.PORT || 3000;
const CHAT_MODEL   = process.env.CHAT_MODEL   || "gpt-5-mini";
const VISION_MODEL = process.env.VISION_MODEL || "gpt-4o-mini";
const IMAGE_MODEL  = process.env.IMAGE_MODEL  || "gpt-image-1";

// Daily limits (midnight→midnight America/Chicago)
const UPLOAD_LIMIT = 10;
const IMAGE_LIMIT  = 10;
const CHAT_LIMIT   = 50;

// In-memory per-user counters keyed by `${userId}|${YYYY-MM-DD}`
const quota = new Map();

// --- helpers
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function chicagoDateKey(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find(p => p.type === "year").value;
  const m = parts.find(p => p.type === "month").value;
  const da = parts.find(p => p.type === "day").value;
  return `${y}-${m}-${da}`;
}
function getUserId(req) {
  // client must send a stable ID in header
  return String(req.headers["x-user-id"] || req.ip || "anon");
}
function countKey(userId) {
  return `${userId}|${chicagoDateKey()}`;
}
function getCounts(userId) {
  const key = countKey(userId);
  if (!quota.has(key)) quota.set(key, { uploads: 0, images: 0, chats: 0 });
  return quota.get(key);
}
function enforceAndInc(userId, kind) {
  const counts = getCounts(userId);
  const lim = kind === "uploads" ? UPLOAD_LIMIT : kind === "images" ? IMAGE_LIMIT : CHAT_LIMIT;
  if (counts[kind] >= lim) {
    return { ok: false, limit: lim, remaining: 0, counts };
  }
  counts[kind] += 1;
  return { ok: true, limit: lim, remaining: lim - counts[kind], counts };
}

// --- app
const app = express();
app.use(express.json({ limit: "25mb" }));
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://justaskjohnny.com",
    "https://www.justaskjohnny.com"
  ],
  methods: ["GET","POST","OPTIONS"],
  allowedHeaders: ["Content-Type","X-User-Id"],
}));

// status
app.get("/health", (req, res) => {
  res.json({ ok:true, date: chicagoDateKey(), limits:{ uploads: UPLOAD_LIMIT, images: IMAGE_LIMIT, chats: CHAT_LIMIT }});
});

// quota introspection (optional for UI)
app.get("/quota", (req, res) => {
  const userId = getUserId(req);
  const c = getCounts(userId);
  res.json({
    date: chicagoDateKey(),
    counts: c,
    remaining: {
      uploads: Math.max(0, UPLOAD_LIMIT - c.uploads),
      images:  Math.max(0, IMAGE_LIMIT  - c.images),
      chats:   Math.max(0, CHAT_LIMIT   - c.chats),
    }
  });
});

// ---------- PDF text
async function extractPdfText(buffer) {
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  let text = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    text += content.items.map(i => i.str).join(" ") + "\n";
  }
  return text.trim();
}
async function summarizeText(text, nChars = 120000) {
  const r = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      { role: "system", content: "Summarize clearly in 4–6 bullets. Keep it faithful to the source." },
      { role: "user", content: text.slice(0, nChars) }
    ]
  });
  return r.choices?.[0]?.message?.content ?? "";
}
async function describeImage(dataUrl) {
  const r = await openai.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      { role: "user",
        content: [
          { type: "text", text: "Describe the image briefly and OCR any visible text. Two sections: Summary: and Text:." },
          { type: "image_url", image_url: { url: dataUrl } }
        ]
      }
    ]
  });
  const reply = r.choices?.[0]?.message?.content ?? "";
  const parts = reply.split(/Text:\s*/i);
  return {
    summary: parts[0].replace(/^Summary:\s*/i, "").trim(),
    text: (parts[1] || "").trim()
  };
}

// ---------- chat (limit = 50/day)
app.post("/api/chat", async (req, res) => {
  try {
    const userId = getUserId(req);
    const gate = enforceAndInc(userId, "chats");
    if (!gate.ok) return res.status(429).json({ error:"LIMIT_REACHED", kind:"chats", limit: gate.limit, message: "Pro plan coming soon for just $10" });

    const input = String(req.body?.input ?? "").trim();
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    if (!input && history.length === 0) return res.status(400).json({ error: "NO_INPUT" });

    const r = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [{ role:"system", content:"You are a concise, accurate assistant." }, ...history, { role:"user", content: input }]
    });
    res.json({ reply: r.choices?.[0]?.message?.content ?? "(no reply)" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:"CHAT_FAILED", detail: err?.message });
  }
});

// ---------- uploads (limit = 10/day)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const docs = Object.create(null);   // docId -> { kind, text }
const thumbs = Object.create(null); // docId -> dataURL
const makeId = () => Math.random().toString(36).slice(2,10);

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const userId = getUserId(req);
    const gate = enforceAndInc(userId, "uploads");
    if (!gate.ok) return res.status(429).json({ error:"LIMIT_REACHED", kind:"uploads", limit: gate.limit, message: "Pro plan coming soon for just $10" });

    if (!req.file) return res.status(400).json({ error:"NO_FILE" });
    const mime = req.file.mimetype || "";
    const buf = req.file.buffer;

    let text="", summary="", kind="unknown";
    if (mime === "application/pdf") {
      kind = "pdf";
      text = await extractPdfText(buf);
      summary = text ? await summarizeText(text) : "";
    } else if (mime.startsWith("image/")) {
      kind = "image";
      const b64 = buf.toString("base64");
      const dataUrl = `data:${mime};base64,${b64}`;
      const d = await describeImage(dataUrl);
      text = d.text; summary = d.summary;
    } else {
      return res.status(415).json({ error:"UNSUPPORTED_TYPE", mime });
    }

    const docId = makeId();
    docs[docId] = { kind, text };
    res.json({ ok:true, docId, kind, text, summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:"UPLOAD_FAILED", detail: err?.message });
  }
});

// thumbnails (optional)
app.post("/thumbnail", (req, res) => {
  const { docId, dataUrl } = req.body || {};
  if (!docId || !dataUrl) return res.status(400).json({ error:"MISSING_FIELDS" });
  thumbs[docId] = dataUrl;
  res.json({ ok:true });
});
app.get("/thumbnail/:id", (req, res) => {
  const dataUrl = thumbs[req.params.id];
  if (!dataUrl) return res.status(404).json({ error:"NO_THUMBNAIL" });
  res.json({ dataUrl });
});

// ---------- image generation (limit = 10/day)
app.post("/generate-image", async (req, res) => {
  try {
    const userId = getUserId(req);
    const gate = enforceAndInc(userId, "images");
    if (!gate.ok) return res.status(429).json({ error:"LIMIT_REACHED", kind:"images", limit: gate.limit, message: "Pro plan coming soon for just $10" });

    const prompt = String(req.body?.prompt || "");
    const size   = String(req.body?.size || "1024x1024");
    if (!prompt) return res.status(400).json({ error:"PROMPT_REQUIRED" });

    const img = await openai.images.generate({ model: IMAGE_MODEL, prompt, size });
    const b64 = img.data?.[0]?.b64_json;
    if (!b64) return res.status(502).json({ error:"NO_IMAGE" });
    res.json({ image_b64: b64 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:"IMAGE_FAILED", detail: err?.message });
  }
});

app.post("/query", async (req,res)=>{
  try{
    const docId = String(req.body?.docId || "");
    const question = String(req.body?.question || "");
    if (!docId || !docs[docId]) return res.status(404).json({ error:"DOC_NOT_FOUND" });
    if (!question) return res.status(400).json({ error:"QUESTION_REQUIRED" });

    const ctx = docs[docId].text.slice(0,150_000);
    const r = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role:"system", content:"Answer strictly from the provided document; if missing, say so briefly." },
        { role:"user", content:`Document:\n---\n${ctx}\n---\n\nQuestion: ${question}\nAnswer:` }
      ]
    });
    res.json({ answer: r.choices?.[0]?.message?.content ?? "(no answer)" });
  }catch(err){
    console.error(err);
    res.status(500).json({ error:"QUERY_FAILED", detail: err?.message });
  }
});

app.listen(PORT, () => console.log(`✅ Server :${PORT}  limits u:${UPLOAD_LIMIT} i:${IMAGE_LIMIT} c:${CHAT_LIMIT}`));
