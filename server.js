import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import compression from "compression";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(compression());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(morgan("tiny"));

const allowOrigins =
  (process.env.CORS_ORIGIN || "*")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

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

const DOCS = new Map();

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-5";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const ENABLE_WEB_SEARCH = String(process.env.ENABLE_WEB_SEARCH || "true").toLowerCase() === "true";

function urlCitationsFrom(text) {
  const urlRegex = /\bhttps?:\/\/[^\s)]+/g;
  return Array.from(new Set((text || "").match(urlRegex) || [])).slice(0, 8);
}

async function extractPdfTextWithPdfJs(buffer, maxChars = 400000) {
  try {
    const task = pdfjsLib.getDocument({ data: buffer });
    const pdf = await task.promise;
    let out = "";
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const text = content.items.map(it => (it.str || "")).join(" ");
      out += text + "\n\n";
      if (out.length >= maxChars) break;
    }
    if (out.length > maxChars) out = out.slice(0, maxChars);
    return out.trim();
  } catch {
    return "";
  }
}

async function llmJSON({ system, user, max_output_tokens = 1800, verbosity, tools }) {
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
  const sources = urlCitationsFrom(text);
  return { text, sources };
}

app.get("/", (_req, res) => {
  res.redirect("/johnny-chat/");
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, model: CHAT_MODEL });
});

app.post("/api/chat/stream", async (req, res) => {
  try {
    const { input, history = [], mode } = req.body || {};
    if (!input || typeof input !== "string") {
      res.status(400).json({ error: "Missing input" });
      return;
    }

    let maxTokens = 2000;
    let verbosity = "medium";
    let systemPrompt = "You are Johnny, a pragmatic assistant. When users ask for current facts (weather, news, stocks, etc.), use web search to ground your answer and include plain source URLs at the end. Be concise and clear.";

    if (mode === "writepaper") {
      maxTokens = 48000;
      verbosity = "long";
      systemPrompt += " For papers, deliver a crisp thesis within the opening, strong structure with transitions, concrete examples, precise diction, and a resonant closing. Avoid fluff. No headings unless asked.";
    }

    const stitched = (Array.isArray(history) ? history : [])
      .slice(-40)
      .map(m => `${(m.role || "").toUpperCase()}: ${m.content || ""}`)
      .join("\n\n");

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const write = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    let full = "";

    const tools = ENABLE_WEB_SEARCH ? [{ type: "web_search" }] : undefined;

    const stream = await openai.responses.stream({
      model: CHAT_MODEL,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${stitched ? stitched + "\n\n" : ""}USER: ${input}` }
      ],
      max_output_tokens: maxTokens,
      ...(verbosity ? { verbosity } : {}),
      ...(tools ? { tools } : {})
    });

    stream.on("text", (delta) => {
      if (delta) {
        full += delta;
        write("delta", { text: delta });
      }
    });

    stream.on("finalResponse", () => {
      const sources = urlCitationsFrom(full);
      if (sources.length) write("sources", { sources });
    });

    stream.on("end", () => {
      write("done", {});
      res.end();
    });

    stream.on("error", (err) => {
      write("error", { message: String(err?.message || err) });
      res.end();
    });

    req.on("close", () => {
      try { stream.abort(); } catch {}
    });
  } catch (e) {
    if (!res.headersSent) res.status(500);
    res.end();
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const { input, history = [], mode } = req.body || {};

    let maxTokens = 2000;
    let verbosity = "medium";
    let systemPrompt = "You are Johnny, a pragmatic assistant. When users ask for current facts (weather, news, stocks, etc.), use web search to ground your answer and include plain source URLs at the end.";

    if (mode === "writepaper") {
      maxTokens = 48000;
      verbosity = "long";
      systemPrompt += " For papers, deliver a crisp thesis within the opening, strong structure with transitions, concrete examples, precise diction, and a resonant closing. Avoid fluff.";
    }

    const stitched = (Array.isArray(history) ? history : [])
      .slice(-40)
      .map(m => `${(m.role || "").toUpperCase()}: ${m.content || ""}`)
      .join("\n\n");

    const { text, sources } = await llmJSON({
      system: systemPrompt,
      user: `${stitched ? stitched + "\n\n" : ""}USER: ${input}`,
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
    const prompt = `Clean and format the following text into clear, readable paragraphs and short lists where appropriate. Remove duplicated fragments and tracking parameters. Keep the meaning intact.\n\nTEXT:\n${text || ""}`;
    const { text: pretty } = await llmJSON({
      system: "You are a concise text beautifier. Improve formatting only; do not invent facts.",
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
        const txt = await extractPdfTextWithPdfJs(f.buffer);
        allText += `\n\n[PDF: ${f.originalname}]\n${txt}`;
      } else if (/^image\//.test(f.mimetype)) {
        allText += `\n\n[IMAGE: ${f.originalname}]`;
      } else {
        allText += `\n\n[FILE: ${f.originalname}]\n${f.buffer.toString("utf8")}`;
      }
    }

    const summaryPrompt = `Summarize the key points from the following combined files. Then provide a 5–8 bullet executive summary.\n\n${allText.slice(0, 300000)}`;
    const { text: summary } = await llmJSON({
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

    const prompt = `Answer the question using only the content below. Quote key phrases when helpful and cite section cues like [PDF: filename] if relevant. If not found, say so.\n\nDOCUMENT:\n${doc.text.slice(0, 400000)}\n\nQUESTION: ${question}`;

    const { text: answer } = await llmJSON({
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
    const { prompt, size = "1024x1024", images = [] } = req.body || {};

    const input = [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt || "" },
          ...images.map(u => ({ type: "input_image", image_url: u }))
        ]
      }
    ];

    const resp = await openai.responses.create({
      model: IMAGE_MODEL,
      input,
      tools: [{ type: "image_generation" }]
    });

    const calls = (resp.output || []).filter(o => o.type === "image_generation_call");
    const image_b64 = calls?.[0]?.result || null;

    if (!image_b64) return res.status(500).json({ error: "No image returned" });

    res.json({ image_b64 });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {});
