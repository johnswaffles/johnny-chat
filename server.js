// server.js — uploads (PDF/PNG/JPG) + doc Q&A + GPT-Image + (optional) web chat
// Requires: express, cors, dotenv, multer, openai, pdfjs-dist@3.11.174

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import OpenAI from "openai";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.js";
import os from "os";

dotenv.config();

const PORT         = process.env.PORT || 3000;
const CHAT_MODEL   = process.env.CHAT_MODEL   || "gpt-5-mini";
const VISION_MODEL = process.env.VISION_MODEL || "gpt-4o-mini";
const IMAGE_MODEL  = process.env.IMAGE_MODEL  || "gpt-image-1";

const app = express();
app.use(express.json({ limit: "25mb" }));

app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://justaskjohnny.com",
    "https://www.justaskjohnny.com"
  ]
}));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// In-memory stores (reset on server restart)
const docs = Object.create(null);   // docId -> { kind, text }
const thumbs = Object.create(null); // docId -> dataURL
const makeId = () => Math.random().toString(36).slice(2, 10);

// ---------- helpers
async function extractPdfText(buffer) {
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  let text = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    text += content.items.map((it) => it.str).join(" ") + "\n";
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
async function describeImageDataUrl(dataUrl) {
  const r = await openai.chat.completions.create({
    model: VISION_MODEL,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "Describe the image briefly and extract visible text (OCR). Return two sections: Summary: and Text:." },
        { type: "image_url", image_url: { url: dataUrl } }
      ]
    }]
  });
  const reply = r.choices?.[0]?.message?.content ?? "";
  const parts = reply.split(/Text:\s*/i);
  const summary = parts[0].replace(/^Summary:\s*/i, "").trim();
  const text = (parts[1] || "").trim();
  return { summary, text };
}

// ---------- ping
app.get(["/health","/api/health"], (_req,res) =>
  res.json({ ok:true, node:process.version, chatModel:CHAT_MODEL, visionModel:VISION_MODEL, imageModel:IMAGE_MODEL })
);

// ---------- basic chat
app.post(["/chat","/api/chat"], async (req,res) => {
  try {
    const input = String(req.body?.input ?? "").trim();
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    if (!input && history.length === 0) return res.status(400).json({ error: "NO_INPUT" });
    const r = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [{ role:"system", content:"You are a concise, accurate assistant." }, ...history, { role:"user", content: input }]
    });
    res.json({ reply: r.choices?.[0]?.message?.content ?? "(no reply)" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error:"CHAT_FAILED", detail:e?.message });
  }
});

// ---------- uploads
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

app.post("/upload", upload.single("file"), async (req,res) => {
  const t0 = Date.now();
  try {
    if (!req.file) return res.status(400).json({ error:"NO_FILE" });
    const mime = req.file.mimetype || "";
    const buf = req.file.buffer;

    let text="", summary="", kind="unknown";
    if (mime === "application/pdf") {
      kind="pdf"; text = await extractPdfText(buf); summary = text ? await summarizeText(text) : "";
    } else if (mime.startsWith("image/")) {
      kind="image";
      const b64 = buf.toString("base64");
      const dataUrl = `data:${mime};base64,${b64}`;
      const d = await describeImageDataUrl(dataUrl);
      summary = d.summary; text = d.text;
    } else {
      return res.status(415).json({ error:"UNSUPPORTED_TYPE", mime });
    }

    const docId = makeId();
    docs[docId] = { kind, text };
    res.json({ ok:true, ms: Date.now()-t0, docId, kind, text, summary });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error:"UPLOAD_FAILED", detail:e?.message });
  }
});

// ---------- thumbnails
app.post("/thumbnail", async (req,res)=>{
  try{
    const { docId, dataUrl } = req.body || {};
    if(!docId || !dataUrl) return res.status(400).json({ error:"MISSING_FIELDS" });
    thumbs[docId] = dataUrl;
    res.json({ ok:true });
  }catch(e){ res.status(500).json({ error:"THUMBNAIL_STORE_FAILED", detail:e?.message }); }
});
app.get("/thumbnail/:docId", (req,res)=>{
  const img = thumbs[req.params.docId];
  if(!img) return res.status(404).json({ error:"NO_THUMBNAIL" });
  res.json({ dataUrl: img });
});

// ---------- query doc
app.post("/query", async (req,res)=>{
  try{
    const docId = String(req.body?.docId || "");
    const question = String(req.body?.question || "");
    if(!docId || !docs[docId]) return res.status(404).json({ error:"DOC_NOT_FOUND" });
    if(!question) return res.status(400).json({ error:"QUESTION_REQUIRED" });
    const ctx = docs[docId].text.slice(0,150_000);
    const r = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role:"system", content:"Answer strictly from the provided document; if missing, say so briefly." },
        { role:"user", content:`Document:\n---\n${ctx}\n---\n\nQuestion: ${question}\nAnswer:` }
      ]
    });
    res.json({ answer: r.choices?.[0]?.message?.content ?? "(no answer)" });
  }catch(e){
    console.error(e);
    res.status(500).json({ error:"QUERY_FAILED", detail:e?.message });
  }
});

// ---------- GPT-Image
app.post("/generate-image", async (req,res)=>{
  try{
    const prompt = String(req.body?.prompt || "");
    const size   = String(req.body?.size || "1024x1024");
    if(!prompt) return res.status(400).json({ error:"PROMPT_REQUIRED" });
    const img = await openai.images.generate({ model: IMAGE_MODEL, prompt, size });
    const b64 = img.data?.[0]?.b64_json;
    if(!b64) return res.status(502).json({ error:"NO_IMAGE" });
    res.json({ image_b64: b64 });
  }catch(e){
    console.error(e);
    res.status(500).json({ error:"IMAGE_FAILED", detail:e?.message });
  }
});

app.listen(PORT, () => console.log(`✅ Server :${PORT}  chat=${CHAT_MODEL} vision=${VISION_MODEL} image=${IMAGE_MODEL}`));
