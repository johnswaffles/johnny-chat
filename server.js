// server.js — realtime, web-grounded chat via Responses API + web search.
// Keeps your upload/query/image endpoints. Only /api/chat changed/hardened.

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import OpenAI from "openai";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.js";

dotenv.config();

const PORT         = process.env.PORT || 3000;
// Use a GPT-5 chat model that supports tools; avoid “mini” for web search.
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

/* --------------------------- helpers (PDF & vision) --------------------------- */
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

/* ---------------------------- realtime web-grounded chat ---------------------------- */
// Docs: enable web search by adding it in tools when using the Responses API.  [oai_citation:2‡OpenAI Platform](https://platform.openai.com/docs/guides/tools-web-search?utm_source=chatgpt.com)
async function askWithWeb(messages) {
  // Try stable tool name first, then preview if the org isn’t enabled yet.  [oai_citation:3‡OpenAI Community](https://community.openai.com/t/web-search-works-in-playground-but-not-via-api/1152213?utm_source=chatgpt.com) [oai_citation:4‡Microsoft Learn](https://learn.microsoft.com/en-us/answers/questions/2237879/web-search-tool-is-not-enabled-for-this-organizati?utm_source=chatgpt.com)
  const tryOnce = async (toolType) => {
    return openai.responses.create({
      model: CHAT_MODEL,
      input: messages,
      tools: [{ type: toolType }],
      // Encourage the model to actually use the tool for changing facts.  [oai_citation:5‡OpenAI Platform](https://platform.openai.com/docs/guides/tools-web-search?utm_source=chatgpt.com)
      temperature: 0.2,
      metadata: { app: "johnny-chat", tool: toolType }
    });
  };

  try {
    return await tryOnce("web_search");
  } catch (e) {
    const msg = String(e?.message || "");
    const shouldRetry =
      /not enabled|Hosted tool|unsupported|unknown tool/i.test(msg);
    if (!shouldRetry) throw e;
    return await tryOnce("web_search_preview");
  }
}

// Extract reply text + any URLs that appear in output/annotations/tool results.
function collectReplyAndSources(resp) {
  let reply =
    resp.output_text ??
    (resp.output?.[0]?.content?.[0]?.text || "");

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
  return { reply, sources: Array.from(urls) };
}

app.post("/api/chat", async (req, res) => {
  try {
    const input = String(req.body?.input ?? "").trim();
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    if (!input && history.length === 0) return res.status(400).json({ error: "NO_INPUT" });

    const messages = [
      { role: "system", content:
        "You are a concise assistant. For anything that can change over time (news, stocks, prices, rosters, schedules, ongoing events), use the web_search tool and include 2–4 source links at the end."
      },
      ...history,
      { role: "user", content: input }
    ];

    const resp = await askWithWeb(messages);
    const { reply, sources } = collectReplyAndSources(resp);
    res.json({ reply: reply || "(no reply)", sources });
  } catch (e) {
    console.error("CHAT_FAILED:", e);
    res.status(500).json({ error: "CHAT_FAILED", detail: e?.message });
  }
});

/* --------------------------------- uploads --------------------------------- */
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

    const img = await openai.images.generate({ model: IMAGE_MODEL, prompt, size });
    const b64 = img.data?.[0]?.b64_json;
    if (!b64) return res.status(502).json({ error:"NO_IMAGE" });
    res.json({ image_b64: b64 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error:"IMAGE_FAILED", detail: err?.message });
  }
});

/* ------------------------------- diagnostics ------------------------------- */
app.get("/api/diag", (req,res)=>{
  res.json({ ok:true, chat_model: CHAT_MODEL, web_search: true });
});

app.listen(PORT, () => {
  console.log(`✅ Server :${PORT}  chat=${CHAT_MODEL} vision=${VISION_MODEL} image=${IMAGE_MODEL}`);
  console.log("   Web search enabled for /api/chat via Responses API (auto-fallback to preview).");
});
