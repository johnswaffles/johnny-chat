// server.js — Express backend with /upload, /query, /generate-image
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import OpenAI from "openai";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.js";
import os from "os";

dotenv.config();

const PORT = process.env.PORT || 3000;
const CHAT_MODEL   = process.env.CHAT_MODEL   || "gpt-5-mini";
const VISION_MODEL = process.env.VISION_MODEL || "gpt-4o-mini";
const IMAGE_MODEL  = process.env.IMAGE_MODEL  || "gpt-image-1";

const app = express();
app.use(express.json({ limit: "20mb" }));
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://justaskjohnny.com",
    "https://www.justaskjohnny.com"
  ]
}));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ----- helpers
const docs = Object.create(null);
const makeId = () => Math.random().toString(36).slice(2, 10);

async function extractPdfText(buffer) {
  // pdfjs-dist legacy build works server-side with Node 18+
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  let text = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    text += content.items.map(it => it.str).join(" ") + "\n";
  }
  return text.trim();
}

// ----- chat (keep your old route alive)
app.post(["/api/chat", "/chat"], async (req, res) => {
  try {
    const input = String(req.body?.input ?? "").trim();
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    if (!input && history.length === 0) return res.status(400).json({ error: "No input" });

    const messages = [
      { role: "system", content: "You are a concise, accurate assistant." },
      ...history,
      { role: "user", content: input }
    ];
    const r = await openai.chat.completions.create({ model: CHAT_MODEL, messages });
    const reply = r.choices?.[0]?.message?.content ?? "(no reply)";
    res.json({ reply, model: r.model || CHAT_MODEL });
  } catch (err) {
    res.status(500).json({ error: "chat failed", detail: err?.message });
  }
});

// ----- upload (PDF or image)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });
    const mime = req.file.mimetype || "";
    const buf  = req.file.buffer;

    let text = "";
    let summary = "";
    let kind = "unknown";

    if (mime === "application/pdf") {
      kind = "pdf";
      text = await extractPdfText(buf);
      const r = await openai.chat.completions.create({
        model: CHAT_MODEL,
        messages: [
          { role: "system", content: "Summarize clearly in 4–6 bullets." },
          { role: "user", content: text.slice(0, 120000) }
        ]
      });
      summary = r.choices?.[0]?.message?.content ?? "";
    } else if (mime.startsWith("image/")) {
      kind = "image";
      const b64 = buf.toString("base64");
      const dataUrl = `data:${mime};base64,${b64}`;
      const visionPrompt =
        "Describe this image briefly and extract any visible text (OCR). " +
        "Return two sections: Summary: and Text:. Keep concise.";

      const r = await openai.chat.completions.create({
        model: VISION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: visionPrompt },
              { type: "image_url", image_url: dataUrl }
            ]
          }
        ]
      });
      const reply = r.choices?.[0]?.message?.content ?? "";
      const parts = reply.split(/Text:\s*/i);
      summary = parts[0].replace(/^Summary:\s*/i, "").trim();
      text    = (parts[1] || "").trim();
    } else {
      return res.status(415).json({ error: `Unsupported MIME type: ${mime}` });
    }

    const docId = makeId();
    docs[docId] = { kind, text };
    res.json({ docId, kind, text, summary });
  } catch (err) {
    res.status(500).json({ error: "upload failed", detail: err?.message });
  }
});

// ----- query an uploaded doc
app.post("/query", async (req, res) => {
  try {
    const docId = String(req.body?.docId || "");
    const question = String(req.body?.question || "");
    if (!docId || !docs[docId]) return res.status(404).json({ error: "doc not found" });
    if (!question) return res.status(400).json({ error: "question required" });

    const context = docs[docId].text?.slice(0, 150_000) || "";
    const messages = [
      { role: "system",
        content:
          "Answer strictly from the provided document. If info is missing, say so briefly." },
      { role: "user",
        content: `Document:\n---\n${context}\n---\n\nQuestion: ${question}\nAnswer:` }
    ];
    const r = await openai.chat.completions.create({ model: CHAT_MODEL, messages });
    const ans = r.choices?.[0]?.message?.content ?? "(no answer)";
    res.json({ answer: ans });
  } catch (err) {
    res.status(500).json({ error: "query failed", detail: err?.message });
  }
});

// ----- image generation
app.post("/generate-image", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "");
    const size   = String(req.body?.size || "1024x1024");
    if (!prompt) return res.status(400).json({ error: "prompt required" });

    const img = await openai.images.generate({ model: IMAGE_MODEL, prompt, size });
    const b64 = img.data?.[0]?.b64_json;
    if (!b64) return res.status(500).json({ error: "no image returned" });
    res.json({ image_b64: b64 });
  } catch (err) {
    res.status(500).json({ error: "image generation failed", detail: err?.message });
  }
});

// ----- status
app.get(["/health", "/api/health"], (_req, res) => {
  res.json({ status: "ok", chatModel: CHAT_MODEL, visionModel: VISION_MODEL, imageModel: IMAGE_MODEL });
});
app.get(["/status", "/api/status"], (_req, res) => {
  res.json({ node: process.version, host: os.hostname(), uptimeSeconds: Math.floor(process.uptime()) });
});

app.listen(PORT, () => console.log(`✅ Server listening on :${PORT}`));
