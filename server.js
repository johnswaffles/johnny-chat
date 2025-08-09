// server.js — Responses API only (hosted web_search + preview fallback), no temperature.
// File Q&A (PDF/image) + image generation retained. pdfjs v4 import path fixed.

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import OpenAI from "openai";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

dotenv.config();

const PORT         = process.env.PORT || 3000;
const CHAT_MODEL   = process.env.CHAT_MODEL   || "gpt-5-chat-latest";
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

/* ------------------------------- utilities -------------------------------- */
const dumpErr = (e) => {
  try {
    return JSON.stringify({
      name: e?.name, message: e?.message, code: e?.code, status: e?.status,
      data: e?.response?.data
    }, null, 2);
  } catch { return String(e); }
};

function collectReplyAndSources(resp) {
  let reply =
    resp?.output_text ??
    (resp?.output?.[0]?.content?.[0]?.text || "");

  const urls = new Set();
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (typeof v === "string" && /^https?:\/\//i.test(v)) urls.add(v);
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") walk(v);
    }
  };
  walk(resp);
  return { reply: (reply || "").trim(), sources: Array.from(urls) };
}

/* ----------------------- Responses API with hosted search ------------------ */
// Strictly use Responses API. Try "web_search"; if org not enabled, try preview.
// No temperature param (fixes your 400).
async function askWithHostedSearch(messages) {
  const createWith = (toolType) =>
    openai.responses.create({
      model: CHAT_MODEL,
      input: messages,
      tools: [{ type: toolType }],
      metadata: { app: "johnny-chat", tool: toolType }
    });

  try {
    return await createWith("web_search");
  } catch (e1) {
    const msg = `${e1?.message || ""} ${e1?.code || ""}`;
    const retriable = /not enabled|Hosted tool|unsupported|unknown tool|not found|404/i.test(msg);
    console.error("web_search failed:", dumpErr(e1));
    if (retriable) {
      try { return await createWith("web_search_preview"); }
      catch (e2) { console.error("web_search_preview failed:", dumpErr(e2)); }
    }
    const err = new Error("WEB_SEARCH_TOOL_UNAVAILABLE");
    err.status = 503;
    err.detail = e1?.message || "Hosted tool unavailable for this org";
    throw err;
  }
}

/* --------------------------------- CHAT API -------------------------------- */
app.post("/api/chat", async (req, res) => {
  try {
    const input = String(req.body?.input ?? "").trim();
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    if (!input && history.length === 0) return res.status(400).json({ error: "NO_INPUT" });

    const messages = [
      {
        role: "system",
        content:
          "You are a concise assistant. For any time-sensitive topic (weather, news, sports, prices, schedules, elections, policies), use the web_search tool and cite 2–4 links at the end."
      },
      ...history,
      { role: "user", content: input }
    ];

    const resp = await askWithHostedSearch(messages);
    const { reply, sources } = collectReplyAndSources(resp);
    res.json({ reply: reply || "(no reply)", sources });
  } catch (e) {
    console.error("CHAT_FAILED:", dumpErr(e));
    const status = e?.status || 500;
    res.status(status).json({
      error: "CHAT_FAILED",
      detail: e?.detail || e?.message || "Unknown error",
      hint: status === 503 ? "Enable hosted web_search for your OpenAI org (or preview) and redeploy." : undefined
    });
  }
});

/* ------------------------------- PDF ANALYZE ------------------------------- */
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

/* ------------------------------- IMAGE VISION ------------------------------ */
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
  return { summary: parts[0].replace(/^Summary:\s*/i, "").trim(), text: (parts[1] || "").trim() };
}

/* --------------------------- upload / analyze API -------------------------- */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const docs = Object.create(null);
const makeId = () => Math.random().toString(36).slice(2,10);

app.post("/upload", upload.single("file"), async (req, res) => {
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
      const d = await describeImage(dataUrl);
      text = d.text; summary = d.summary;
    } else {
      return res.status(415).json({ error:"UNSUPPORTED_TYPE", mime });
    }

    const docId = makeId();
    docs[docId] = { kind, text };
    res.json({ ok:true, docId, kind, text, summary });
  } catch (e) {
    console.error("UPLOAD_FAILED:", dumpErr(e));
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
    console.error("QUERY_FAILED:", dumpErr(e));
    res.status(500).json({ error:"QUERY_FAILED", detail:e?.message });
  }
});

/* ------------------------------ IMAGE GENERATE ----------------------------- */
app.post("/generate-image", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "");
    let size   = String(req.body?.size || "1024x1024");
    if (!prompt) return res.status(400).json({ error:"PROMPT_REQUIRED" });

    const allowed = new Set(["1024x1024","1024x1536","1536x1024","auto"]);
    if (!allowed.has(size)) size = "1024x1024";

    const img = await openai.images.generate({ model: IMAGE_MODEL, prompt, size });
    const b64 = img.data?.[0]?.b64_json;
    if (!b64) return res.status(502).json({ error:"NO_IMAGE" });
    res.json({ image_b64: b64 });
  } catch (err) {
    console.error("IMAGE_FAILED:", dumpErr(err));
    res.status(500).json({ error: "IMAGE_FAILED", detail: err?.message });
  }
});

/* -------------------------------- diagnostics ------------------------------ */
app.get("/api/diag", async (req,res)=>{
  let hosted = "unknown";
  try {
    await openai.responses.create({
      model: CHAT_MODEL,
      input: [{ role:"user", content:"ping" }],
      tools: [{ type: "web_search" }]
    });
    hosted = "web_search";
  } catch (e1) {
    try {
      await openai.responses.create({
        model: CHAT_MODEL,
        input: [{ role:"user", content:"ping" }],
        tools: [{ type: "web_search_preview" }]
      });
      hosted = "web_search_preview";
    } catch {
      hosted = "unavailable";
    }
  }
  res.json({ ok:true, chat_model: CHAT_MODEL, hosted_search: hosted, pdfjs: "legacy/build/pdf.mjs" });
});

app.listen(PORT, () => {
  console.log(`✅ Server :${PORT}  chat=${CHAT_MODEL}  vision=${VISION_MODEL}  image=${IMAGE_MODEL}`);
  console.log("   Responses API only; hosted web_search (preview fallback); NO temperature param.");
});
