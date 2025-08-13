import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

const allowOrigins = (process.env.CORS_ORIGIN || "*").split(",").map(s => s.trim()).filter(Boolean);
app.use(
  cors({
    origin: allowOrigins.includes("*") ? true : allowOrigins,
    methods: ["GET", "POST", "OPTIONS"]
  })
);

app.use("/johnny-chat", express.static(path.join(__dirname, "johnny-chat")));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (parseInt(process.env.MAX_UPLOAD_MB || "40", 10)) * 1024 * 1024, files: 12 }
});

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-5";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const ENABLE_WEB_SEARCH = String(process.env.ENABLE_WEB_SEARCH || "true").toLowerCase() === "true";

const DOCS = new Map();

function urlsFrom(text) {
  const re = /\bhttps?:\/\/[^\s)]+/g;
  return Array.from(new Set((text || "").match(re) || [])).slice(0, 8);
}

async function llm({ system, user, max_output_tokens = 2000, verbosity, tools }) {
  const input = [
    { role: "system", content: system },
    { role: "user", content: user }
  ];
  const resp = await openai.responses.create({
    model: CHAT_MODEL,
    input,
    max_output_tokens,
    ...(verbosity ? { verbosity } : {}),
    ...(tools ? { tools } : {})
  });
  const text = resp.output_text ?? "";
  return { text, sources: urlsFrom(text) };
}

async function extractPdfText(buffer) {
  const loading = pdfjs.getDocument({ data: buffer, disableWorker: true });
  const pdf = await loading.promise;
  let text = "";
  const pages = Math.min(pdf.numPages, 200);
  for (let p = 1; p <= pages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const pageText = tc.items.map(it => it.str).join(" ");
    text += `\n\n${pageText}`;
  }
  return text.trim();
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, model: CHAT_MODEL });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { input, history = [], mode } = req.body || {};
    const stitched = (Array.isArray(history) ? history : [])
      .slice(-40)
      .map(m => `${(m.role || "").toUpperCase()}: ${m.content || ""}`)
      .join("\n\n");

    let maxTokens = 2000;
    let verbosity = "medium";
    let systemPrompt = "You are Johnny, a pragmatic assistant. When users ask about current facts, use web search to ground answers and list plain source URLs at the end.";

    if (mode === "writepaper") {
      maxTokens = 48000;
      verbosity = "long";
      systemPrompt += " For papers, honor requested length, lead with a crisp thesis, use clear transitions, concrete examples, precise diction, and a resonant closing. No headings unless asked.";
    }

    const { text, sources } = await llm({
      system: systemPrompt,
      user: `${stitched ? stitched + "\n\n" : ""}USER: ${input || ""}`,
      max_output_tokens: maxTokens,
      verbosity,
      tools: ENABLE_WEB_SEARCH ? [{ type: "web_search" }] : undefined
    });

    res.json({ reply: text, sources });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/beautify", async (req, res) => {
  try {
    const { text } = req.body || {};
    const prompt = `Clean and format the following text into clear paragraphs and short lists. Remove duplicated fragments and tracking parameters.\n\n${text || ""}`;
    const { text: pretty } = await llm({
      system: "You improve formatting only. Do not invent facts.",
      user: prompt,
      max_output_tokens: 1200
    });
    res.json({ pretty });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/upload", upload.array("files", 12), async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ error: "No files" });

    let allText = "";
    const meta = [];

    for (const f of req.files) {
      meta.push({ name: f.originalname, type: f.mimetype, size: f.size });
      if (f.mimetype === "application/pdf") {
        const pdfText = await extractPdfText(f.buffer);
        allText += `\n\n[PDF: ${f.originalname}]\n${pdfText}`;
      } else if (/^image\//.test(f.mimetype)) {
        allText += `\n\n[IMAGE: ${f.originalname}]`;
      } else {
        allText += `\n\n[FILE: ${f.originalname}]\n${f.buffer.toString("utf8")}`;
      }
    }

    const summaryPrompt = `Summarize the key points from the following combined files, then provide a 5–8 bullet executive summary.\n\n${allText.slice(0, 300000)}`;
    const { text: summary } = await llm({
      system: "You summarize documents faithfully. Do not add claims not present in the text.",
      user: summaryPrompt,
      max_output_tokens: 2000
    });

    const id = randomUUID();
    DOCS.set(id, { text: allText, summary, files: meta });

    res.json({
      docId: id,
      text: allText.slice(0, 500000),
      summary,
      files: meta
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/query", async (req, res) => {
  try {
    const { docId, question } = req.body || {};
    const doc = DOCS.get(docId);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    const prompt = `Answer the question using only the content below. Quote key phrases when helpful and cite section cues like [PDF: filename] if relevant. If not found, say so.\n\nDOCUMENT:\n${doc.text.slice(0, 400000)}\n\nQUESTION: ${question || ""}`;

    const { text: answer } = await llm({
      system: "You are a careful reading assistant. When the answer is uncertain, you say so.",
      user: prompt,
      max_output_tokens: 1800
    });

    res.json({ answer });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/generate-image", async (req, res) => {
  try {
    const { prompt, size = "1024x1024" } = req.body || {};
    const result = await openai.images.generate({
      model: IMAGE_MODEL,
      prompt: prompt || "",
      size
    });
    const b64 = result?.data?.[0]?.b64_json || null;
    if (!b64) return res.status(500).json({ error: "No image returned" });
    res.json({ image_b64: b64 });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/", (_req, res) => res.redirect("/johnny-chat/"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {});
