// server.js  — ESM build (package.json must have:  "type": "module")
// Node >= 20.12 recommended

import express from "express";
import cors from "cors";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
// Use pdfjs-dist for reliable multi-page extraction
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// ---------- Basic middleware ----------
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// in-memory file uploads
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// ---------- OpenAI client ----------
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Models (override in Render Environment)
const CHAT_MODEL = process.env.OPENAI_MODEL || "gpt-5";
const IMAGE_MODEL = process.env.IMAGE_MODEL || "gpt-image-1";

// ---------- Utilities ----------
function isPdf(file) {
  return file.mimetype === "application/pdf" || /\.pdf$/i.test(file.originalname || "");
}
function isImage(file) {
  return /^image\//.test(file.mimetype || "");
}
function needsWeb(userText = "") {
  // naive trigger for live info — front end can also pass {web:true}
  const t = userText.toLowerCase();
  return /\b(today|now|current|latest|news|weather|forecast|stock|price)\b/.test(t);
}

// Multi-page text extraction with pdfjs-dist
async function extractPdfText(buffer) {
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  let out = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    out += tc.items.map((it) => (it.str || "")).join(" ") + "\n\n";
  }
  return out.trim();
}

// ---------- Routes ----------

// Health
app.get("/health", (_req, res) => res.json({ ok: true, model: CHAT_MODEL }));

// Chat (general) — supports optional web search tool and long-form mode for Write Paper
app.post("/api/chat", async (req, res) => {
  try {
    const {
      input = "",
      history = [], // [{role:'user'|'assistant', content:'...'}]
      mode,         // "writepaper" to enable long output
      web,          // boolean to force web tool
    } = req.body || {};

    const systemPrompt =
      "You are JustAskJohnny: fast, clear, helpful. Keep scaffolding hidden. US units by default.";

    // Build Responses API input blocks
    const blocks = [];
    blocks.push({ role: "system", content: [{ type: "text", text: systemPrompt }] });

    if (Array.isArray(history)) {
      for (const m of history) {
        if (!m || !m.role || !m.content) continue;
        blocks.push({
          role: m.role,
          content: [{ type: "text", text: String(m.content) }],
        });
      }
    }

    blocks.push({ role: "user", content: [{ type: "text", text: String(input || "") }] });

    // Long-form tuning if Write Paper is requested
    let maxTokens = 2000;
    let temperature = 0.7;
    let verbosity = "medium";
    let extraSystem = "";

    if (mode === "writepaper") {
      maxTokens = 48000;         // adjust to your account limits
      temperature = 0.5;
      verbosity = "long";        // GPT-5 specific; ignored by older models
      extraSystem =
        "Write a deeply structured, well-argued paper with sections, headings, and citations where appropriate. Default to US English.";
      blocks.unshift({ role: "system", content: [{ type: "text", text: extraSystem }] });
    }

    // Use OpenAI's web search tool when needed (no 3rd-party keys)
    const useWeb = Boolean(web) || needsWeb(input);

    const resp = await client.responses.create({
      model: CHAT_MODEL,
      input: blocks,
      max_output_tokens: maxTokens,
      temperature,
      verbosity,
      tools: useWeb ? [{ type: "web_search" }] : undefined,
    });

    // Prefer output_text if provided, else concatenate text blocks
    const reply =
      resp.output_text ||
      (Array.isArray(resp.output)
        ? resp.output
            .filter((o) => o.type === "output_text" || o.type === "message")
            .map((o) => ("content" in o && typeof o.content === "string" ? o.content : ""))
            .join("\n")
        : "");

    // Pass through any link previews if present (best-effort)
    let sources = [];
    try {
      if (resp?.annotations?.length) {
        sources = resp.annotations
          .filter((a) => a.url)
          .map((a) => ({ url: a.url, title: a.title || a.url }));
      }
      // some tool outputs may be in resp.output
      if (Array.isArray(resp.output)) {
        for (const o of resp.output) {
          if (o.type === "tool_result" && o.tool_name === "web_search" && Array.isArray(o.content)) {
            for (const c of o.content) {
              if (c.type === "tool_text" && c.text) {
                // try to parse URLs from text
                const found = [...c.text.matchAll(/\bhttps?:\/\/\S+/g)].map((m) => m[0]);
                sources.push(...found.map((u) => ({ url: u, title: u })));
              }
            }
          }
        }
      }
      // de-dup
      const seen = new Set();
      sources = sources.filter((s) => {
        if (!s?.url || seen.has(s.url)) return false;
        seen.add(s.url);
        return true;
      });
    } catch (_) {}

    res.json({ reply: reply?.trim() ?? "", sources });
  } catch (err) {
    console.error("CHAT_ERROR:", err);
    res.status(500).json({ error: "Chat failed." });
  }
});

// Generate image (returns base64 PNG)
app.post("/generate-image", async (req, res) => {
  try {
    const { prompt = "", size = "1024x1024", images = [] } = req.body || {};

    // If you later want edit/variations, pass images[] as base64 or file_ids via the Responses API tool.
    // For reliability today, use Images API directly:
    const out = await client.images.generate({
      model: IMAGE_MODEL,
      prompt,
      size,
    });

    const b64 = out.data?.[0]?.b64_json;
    if (!b64) return res.status(502).json({ error: "No image returned." });

    res.json({ image_b64: b64 });
  } catch (err) {
    console.error("IMAGE_ERROR:", err);
    res.status(500).json({ error: "Image generation failed." });
  }
});

// Upload & analyze multiple files (PDFs + images). Returns extracted text per file and combined.
app.post("/upload", upload.array("files"), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.json({ files: [], combinedText: "" });

    const results = [];
    for (const f of files) {
      const id = uuidv4();
      let text = "";
      let pages = 0;

      if (isPdf(f)) {
        try {
          text = await extractPdfText(f.buffer);
          // pages available via parsing pass — run again cheaply to count
          const loadingTask = pdfjsLib.getDocument({ data: f.buffer });
          const pdf = await loadingTask.promise;
          pages = pdf.numPages || 0;
        } catch (e) {
          console.error("PDF_PARSE_ERROR:", f.originalname, e);
          text = "";
        }
      } else if (isImage(f)) {
        // Optionally: OCR or vision captioning. Keep simple here.
        text = "";
        pages = 1;
      }

      results.push({
        id,
        name: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
        pages,
        text,
      });
    }

    const combinedText = results.map((r, i) => `=== File ${i + 1}: ${r.name} ===\n${r.text}`).join("\n\n");

    res.json({ files: results, combinedText });
  } catch (err) {
    console.error("UPLOAD_ERROR:", err);
    res.status(500).json({ error: "Upload/analyze failed." });
  }
});

// Ask a question about uploaded text (client sends the text it wants grounded on)
app.post("/qa", async (req, res) => {
  try {
    const { question = "", context = "" } = req.body || {};
    const input = [
      {
        role: "system",
        content: [
          {
            type: "text",
            text:
              "You answer strictly using the provided context. " +
              "If the answer isn't in context, say you can't find it.",
          },
        ],
      },
      { role: "user", content: [{ type: "text", text: `CONTEXT:\n${context}\n\nQUESTION: ${question}` }] },
    ];

    const r = await client.responses.create({
      model: CHAT_MODEL,
      input,
      temperature: 0.2,
      max_output_tokens: 1200,
    });

    res.json({ reply: r.output_text?.trim() || "" });
  } catch (err) {
    console.error("QA_ERROR:", err);
    res.status(500).json({ error: "Q&A failed." });
  }
});

// Simple beautifier for messy web results (optional frontend hook)
app.post("/beautify", async (req, res) => {
  try {
    const { raw = "" } = req.body || {};
    const prompt =
      "Reformat the following raw web result text into clean short paragraphs and tidy bullet lists. " +
      "Remove tracking junk. Keep only useful facts. Do NOT invent details.\n\n" + raw;

    const r = await client.responses.create({
      model: CHAT_MODEL,
      input: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      temperature: 0.3,
      max_output_tokens: 1200,
    });

    res.json({ pretty: r.output_text?.trim() || "" });
  } catch (err) {
    console.error("BEAUTIFY_ERROR:", err);
    res.status(500).json({ error: "Beautify failed." });
  }
});

// ---------- Static (optional) ----------
app.use("/public", express.static(path.join(__dirname, "public")));

// ---------- Start ----------
app.listen(port, () => {
  console.log(`JustAskJohnny server listening on :${port} (model=${CHAT_MODEL})`);
});
