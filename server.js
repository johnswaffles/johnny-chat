// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import OpenAI from "openai";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.js";

dotenv.config();

const PORT         = process.env.PORT || 3000;
const CHAT_MODEL   = process.env.CHAT_MODEL   || "gpt-5-chat-latest"; // GPT-5 chat
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
  ],
  methods: ["GET","POST","OPTIONS"],
  allowedHeaders: ["Content-Type","X-User-Id"],
}));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* --------------------------------- helpers -------------------------------- */
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
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "Describe the image briefly and OCR any visible text. Two sections: Summary: and Text:." },
        { type: "image_url", image_url: { url: dataUrl } }
      ]
    }]
  });
  const reply = r.choices?.[0]?.message?.content ?? "";
  const parts = reply.split(/Text:\s*/i);
  return {
    summary: parts[0].replace(/^Summary:\s*/i, "").trim(),
    text: (parts[1] || "").trim()
  };
}

/* ---------------------------------- chat ---------------------------------- */
// New: real-time, web-grounded chat using Responses API + web_search tool.
app.post("/api/chat", async (req, res) => {
  try {
    const input = String(req.body?.input ?? "").trim();
    const history = Array.isArray(req.body?.history) ? req.body.history : [];

    if (!input && history.length === 0) {
      return res.status(400).json({ error: "NO_INPUT" });
    }

    // Build conversation for Responses API
    const messages = [
      { role: "system", content: "You are a concise, accurate assistant. If you use the web, cite sources briefly at the end." },
      ...history,
      { role: "user", content: input }
    ];

    // Enable built-in web search tool (official method for up-to-date info).
    // If your account is on an older preview, swap 'web_search' -> 'web_search_preview'.
    const response = await openai.responses.create({
      model: CHAT_MODEL,
      input: messages,
      tools: [{ type: "web_search" }],
      // Ask the model to include citations if available
      // (Responses API may attach them either in annotations or a citations field).
      metadata: { app: "johnny-chat", feature: "realtime-web" }
    });

    // Extract text
    const reply =
      response.output_text ??
      (response.output?.[0]?.content?.[0]?.text || "(no reply)");

    // Try to collect URLs from tool outputs / annotations if present
    const urls = new Set();

    const dig = (obj) => {
      if (!obj || typeof obj !== "object") return;
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (typeof v === "string" && /^https?:\/\//i.test(v)) urls.add(v);
        if (Array.isArray(v)) v.forEach(dig);
        else if (v && typeof v === "object") dig(v);
      }
    };
    dig(response);

    res.json({ reply, sources: Array.from(urls) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "CHAT_FAILED", detail: e?.message });
  }
});

/* ---------------------------- upload + analyze ---------------------------- */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const docs = Object.create(null);
const makeId = () => Math.random().toString(36).slice(2,10);

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "NO_FILE" });
    const mime = req.file.mimetype || "";
    const buf = req.file.buffer;

    let text="", summary="", kind="unknown";
    if (mime === "application/pdf") {
      kind="pdf"; text = await extractPdfText(buf); summary = text ? await summarizeText(text) : "";
    } else if (mime.startsWith("image/")) {
      kind="image";
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
  } catch (e) {
    console.error(e);
    res.status(500).json({ error:"UPLOAD_FAILED", detail:e?.message });
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
  }catch(e){
    console.error(e);
    res.status(500).json({ error:"QUERY_FAILED", detail:e?.message });
  }
});

/* ---------------------------- image generation ---------------------------- */
app.post("/generate-image", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "");
    let size   = String(req.body?.size || "1024x1024");
    if (!prompt) return res.status(400).json({ error:"PROMPT_REQUIRED" });

    const allowed = new Set(["1024x1024","1024x1536","1536x1024","auto"]);
    if (!allowed.has(size)) size = "1024x1024";

    const payload = { model: IMAGE_MODEL, prompt };
    payload.size = size;

    const img = await openai.images.generate(payload);
    const b64 = img.data?.[0]?.b64_json;
    if (!b64) return res.status(502).json({ error:"NO_IMAGE" });
    res.json({ image_b64: b64 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:"IMAGE_FAILED", detail: err?.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server :${PORT}  chat=${CHAT_MODEL} vision=${VISION_MODEL} image=${IMAGE_MODEL}`);
  console.log("   Web search enabled for /api/chat via Responses API.");
});
