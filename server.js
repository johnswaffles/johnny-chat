// server.js — ESM (package.json must include { "type": "module" })
// Node 20+ recommended

import express from "express";
import cors from "cors";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function normalizeModel(m) {
  const s = String(m || "").trim().toLowerCase();
  if (!s) return "gpt-5";
  return s.replace(/^gtp/, "gpt");
}
const CHAT_MODEL = normalizeModel(process.env.OPENAI_MODEL || "gpt-5");
const IMAGE_MODEL = normalizeModel(process.env.IMAGE_MODEL || "gpt-image-1");

const isPdf = (f) =>
  f?.mimetype === "application/pdf" || /\.pdf$/i.test(f?.originalname || "");
const isImage = (f) => /^image\//.test(f?.mimetype || "");

function needsWeb(text = "") {
  const t = text.toLowerCase();
  return /\b(today|now|current|latest|breaking|news|weather|forecast|temp|temperature|score|stock|price|who won|earnings|rate|exchange)\b/.test(
    t
  );
}

// Multi‑page PDF text extractor
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

/* ----------------------------- Routes ----------------------------- */

app.get("/health", (_req, res) =>
  res.json({ ok: true, model: CHAT_MODEL, images: IMAGE_MODEL })
);

// Core chat with optional live web via Responses API tool
app.post("/api/chat", async (req, res) => {
  try {
    const { input = "", history = [], web } = req.body || {};

    const blocks = [
      {
        role: "system",
        content: [
          {
            type: "text",
            text:
              "You are JustAskJohnny. Be clear and helpful. Use US units unless asked otherwise. Keep internal scaffolding hidden.",
          },
        ],
      },
    ];

    if (Array.isArray(history)) {
      for (const m of history) {
        if (!m?.role || !m?.content) continue;
        blocks.push({
          role: m.role,
          content: [{ type: "text", text: String(m.content) }],
        });
      }
    }

    blocks.push({
      role: "user",
      content: [{ type: "text", text: String(input || "") }],
    });

    const useWeb = Boolean(web) || needsWeb(input);

    const r = await client.responses.create({
      model: CHAT_MODEL,
      input: blocks,
      // IMPORTANT: no temperature here (some GPT‑5 variants reject it)
      max_output_tokens: 4000,
      tools: useWeb ? [{ type: "web_search" }] : undefined,
    });

    const reply =
      r.output_text ||
      (Array.isArray(r.output)
        ? r.output
            .filter((o) => o.type === "output_text" || o.type === "message")
            .map((o) =>
              typeof o.content === "string" ? o.content : ""
            )
            .join("\n")
        : "");

    // Collect URLs from web_search tool results (for clickable links below the answer)
    let sources = [];
    try {
      if (Array.isArray(r.output)) {
        for (const o of r.output) {
          if (
            o.type === "tool_result" &&
            o.tool_name === "web_search" &&
            Array.isArray(o.content)
          ) {
            for (const c of o.content) {
              if (c.type === "tool_text" && typeof c.text === "string") {
                const found = [...c.text.matchAll(/\bhttps?:\/\/\S+/g)].map(
                  (m) => m[0]
                );
                sources.push(...found);
              }
            }
          }
        }
      }
      const seen = new Set();
      sources = sources.filter((u) => u && !seen.has(u) && seen.add(u));
    } catch {}

    res.json({ reply: reply?.trim() ?? "", sources });
  } catch (err) {
    console.error("CHAT_ERROR:", err);
    res.status(500).json({ error: "Chat failed." });
  }
});

// Image generation (working)
app.post("/generate-image", async (req, res) => {
  try {
    const { prompt = "", size = "1024x1024" } = req.body || {};
    const out = await client.images.generate({
      model: IMAGE_MODEL,
      prompt,
      size,
    });
    const b64 = out?.data?.[0]?.b64_json;
    if (!b64) return res.status(502).json({ error: "No image returned." });
    res.json({ image_b64: b64 });
  } catch (err) {
    console.error("IMAGE_ERROR:", err);
    res.status(500).json({ error: "Image generation failed." });
  }
});

// Upload/analyze PDFs & images (returns combinedText for /qa)
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
          const pdf = await pdfjsLib.getDocument({ data: f.buffer }).promise;
          pages = pdf.numPages || 0;
        } catch (e) {
          console.error("PDF_PARSE_ERROR:", f.originalname, e);
        }
      } else if (isImage(f)) {
        text = ""; // (optional) add OCR later
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

    const combinedText = results
      .map((r, i) => `=== File ${i + 1}: ${r.name} ===\n${r.text}`)
      .join("\n\n");

    res.json({ files: results, combinedText });
  } catch (err) {
    console.error("UPLOAD_ERROR:", err);
    res.status(500).json({ error: "Upload/analyze failed." });
  }
});

// Grounded Q&A over uploaded text
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
              "Answer strictly from the provided context. If the answer is not present, say you can't find it.",
          },
        ],
      },
      {
        role: "user",
        content: [{ type: "text", text: `CONTEXT:\n${context}\n\nQUESTION: ${question}` }],
      },
    ];

    const r = await client.responses.create({
      model: CHAT_MODEL,
      input,
      max_output_tokens: 1200,
    });

    res.json({ reply: r.output_text?.trim() || "" });
  } catch (err) {
    console.error("QA_ERROR:", err);
    res.status(500).json({ error: "Q&A failed." });
  }
});

// Beautifier for messy web search snippets
app.post("/beautify", async (req, res) => {
  try {
    const { raw = "" } = req.body || {};
    const prompt =
      "Reformat the following raw web snippets into clean short paragraphs and tidy bullet points. " +
      "Remove boilerplate and tracking. Keep only useful facts. Do not invent details.\n\n" +
      raw;

    const r = await client.responses.create({
      model: CHAT_MODEL,
      input: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      max_output_tokens: 1000,
    });

    res.json({ pretty: r.output_text?.trim() || "" });
  } catch (err) {
    console.error("BEAUTIFY_ERROR:", err);
    res.status(500).json({ error: "Beautify failed." });
  }
});

app.use("/public", express.static(path.join(__dirname, "public")));

app.listen(port, () => {
  console.log(`JustAskJohnny server listening on :${port} (model=${CHAT_MODEL})`);
});
