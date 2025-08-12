// server.js — ESM (package.json must include { "type": "module" })
import express from "express";
import cors from "cors";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function normalizeModel(m) { const s = String(m || "").trim().toLowerCase(); if (!s) return "gpt-5"; return s.replace(/^gtp/, "gpt"); }
const CHAT_MODEL  = normalizeModel(process.env.OPENAI_MODEL || process.env.MODEL || "gpt-5");
const IMAGE_MODEL = normalizeModel(process.env.IMAGE_MODEL || "gpt-image-1");

const isPdf   = (f) => f?.mimetype === "application/pdf" || /\.pdf$/i.test(f?.originalname || "");
const isImage = (f) => /^image\//.test(f?.mimetype || "");
function needsWeb(text = "") { const t = text.toLowerCase(); return /\b(today|now|current|latest|news|headlines|weather|forecast|temp|temperature|stock|price)\b/.test(t); }

async function extractPdfText(buffer) {
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  let out = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    out += tc.items.map((it) => it.str || "").join(" ") + "\n\n";
  }
  return out.trim();
}

app.get("/health", (_req, res) => res.json({ ok: true, model: CHAT_MODEL }));

app.post("/api/chat", async (req, res) => {
  try {
    const { input = "", history = [], mode, web } = req.body || {};
    const blocks = [
      { role: "system", content: [{ type: "text", text: "You are JustAskJohnny. Be clear, useful, and concise. Keep internal scaffolding hidden. Use US units unless asked otherwise." }] },
    ];
    if (Array.isArray(history)) {
      for (const m of history) if (m?.role && m?.content) blocks.push({ role: m.role, content: [{ type: "text", text: String(m.content) }] });
    }
    blocks.push({ role: "user", content: [{ type: "text", text: String(input || "") }] });

    let maxTokens = 2000;
    let verbosity = "medium";
    if (mode === "writepaper") {
      maxTokens = 48000;
      verbosity = "long";
      blocks.unshift({ role: "system", content: [{ type: "text", text: "When asked to write a paper, produce a deeply structured, well-argued work with sections, helpful headings, and smooth transitions. Default to US English." }] });
    }

    const useWeb = Boolean(web) || needsWeb(input);
    const r = await client.responses.create({
      model: CHAT_MODEL,
      input: blocks,
      max_output_tokens: maxTokens,
      verbosity,
      tools: useWeb ? [{ type: "web_search" }] : undefined,
    });

    const reply = r.output_text || (Array.isArray(r.output) ? r.output.filter(o => o.type === "output_text" || o.type === "message").map(o => (typeof o.content === "string" ? o.content : "")).join("\n") : "");

    let sources = [];
    try {
      if (Array.isArray(r.output)) {
        for (const o of r.output) {
          if (o.type === "tool_result" && o.tool_name === "web_search" && Array.isArray(o.content)) {
            for (const c of o.content) if (c.type === "tool_text" && typeof c.text === "string") {
              const found = [...c.text.matchAll(/\bhttps?:\/\/\S+/g)].map(m => m[0]);
              sources.push(...found.map(u => ({ url: u, title: u })));
            }
          }
        }
      }
      const seen = new Set();
      sources = sources.filter(s => s.url && !seen.has(s.url) && seen.add(s.url));
    } catch {}

    res.json({ reply: reply?.trim() ?? "", sources });
  } catch (err) {
    console.error("CHAT_ERROR:", err);
    res.status(500).json({ error: "Chat failed." });
  }
});

app.post("/generate-image", async (req, res) => {
  try {
    const { prompt = "", size = "1024x1024" } = req.body || {};
    const out = await client.images.generate({ model: IMAGE_MODEL, prompt, size });
    const b64 = out?.data?.[0]?.b64_json;
    if (!b64) return res.status(502).json({ error: "No image returned." });
    res.json({ image_b64: b64 });
  } catch (err) {
    console.error("IMAGE_ERROR:", err);
    res.status(500).json({ error: "Image generation failed." });
  }
});

app.post("/upload", upload.array("files"), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.json({ files: [], combinedText: "" });

    const results = [];
    for (const f of files) {
      const id = uuidv4();
      let text = "", pages = 0;

      if (isPdf(f)) {
        try {
          text = await extractPdfText(f.buffer);
          const pdf = await pdfjsLib.getDocument({ data: f.buffer }).promise;
          pages = pdf.numPages || 0;
        } catch (e) {
          console.error("PDF_PARSE_ERROR:", f.originalname, e);
        }
      } else if (isImage(f)) {
        text = "";
        pages = 1;
      }

      results.push({ id, name: f.originalname, mimetype: f.mimetype, size: f.size, pages, text });
    }

    const combinedText = results.map((r, i) => `=== File ${i + 1}: ${r.name} ===\n${r.text}`).join("\n\n");
    res.json({ files: results, combinedText });
  } catch (err) {
    console.error("UPLOAD_ERROR:", err);
    res.status(500).json({ error: "Upload/analyze failed." });
  }
});

app.post("/qa", async (req, res) => {
  try {
    const { question = "", context = "" } = req.body || {};
    const input = [
      { role: "system", content: [{ type: "text", text: "Answer strictly from the provided context. If the answer is not present, say you can't find it." }] },
      { role: "user", content: [{ type: "text", text: `CONTEXT:\n${context}\n\nQUESTION: ${question}` }] },
    ];
    const r = await client.responses.create({ model: CHAT_MODEL, input, max_output_tokens: 1200 });
    res.json({ reply: r.output_text?.trim() || "" });
  } catch (err) {
    console.error("QA_ERROR:", err);
    res.status(500).json({ error: "Q&A failed." });
  }
});

app.post("/beautify", async (req, res) => {
  try {
    const { raw = "" } = req.body || {};
    const prompt = "Reformat the following raw web snippets into clean short paragraphs and tidy bullet points. Drop boilerplate and tracking. Keep only what’s useful. Do not invent details.\n\n" + raw;
    const r = await client.responses.create({ model: CHAT_MODEL, input: [{ role: "user", content: [{ type: "text", text: prompt }] }], max_output_tokens: 1200 });
    res.json({ pretty: r.output_text?.trim() || "" });
  } catch (err) {
    console.error("BEAUTIFY_ERROR:", err);
    res.status(500).json({ error: "Beautify failed." });
  }
});

app.use("/public", express.static(path.join(__dirname, "public")));

app.listen(port, () => {
  console.log(`JustAskJohnny server listening on :${port}  (model=${CHAT_MODEL}, images=${IMAGE_MODEL})`);
});
