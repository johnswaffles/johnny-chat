// server.js  (ESM; package.json must include: { "type": "module" })
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

// heuristics
const wantsWeb = (txt = "") =>
  /\b(today|now|current|latest|breaking|news|headline|weather|forecast|temp|temperature|score|stock|price|rate|exchange|who won)\b/i.test(
    txt
  );

const isPdf = (f) =>
  f?.mimetype === "application/pdf" || /\.pdf$/i.test(f?.originalname || "");
const isImage = (f) => /^image\//.test(f?.mimetype || "");

// multi‑page pdf text
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

/* ----------------------------- routes ----------------------------- */

app.get("/health", (_req, res) =>
  res.json({ ok: true, model: CHAT_MODEL, imageModel: IMAGE_MODEL })
);

// Chat with optional live web. Falls back if tools aren’t allowed.
app.post("/api/chat", async (req, res) => {
  const { input = "", history = [], web } = req.body || {};
  try {
    const blocks = [
      {
        role: "system",
        content: [
          {
            type: "text",
            text:
              "You are JustAskJohnny. Be concise, accurate, and use US units unless asked otherwise. Hide internal scaffolding.",
          },
        ],
      },
      ...[]
        .concat(Array.isArray(history) ? history : [])
        .filter((m) => m?.role && m?.content)
        .map((m) => ({ role: m.role, content: [{ type: "text", text: String(m.content) }] })),
      { role: "user", content: [{ type: "text", text: String(input) }] },
    ];

    const tryCall = async (withWeb) =>
      client.responses.create({
        model: CHAT_MODEL,
        input: blocks,
        max_output_tokens: 4000,
        tools: withWeb ? [{ type: "web_search" }] : undefined,
      });

    let r;
    const needWeb = Boolean(web) || wantsWeb(input);
    try {
      r = await tryCall(needWeb);
    } catch (e) {
      // fall back without tools if model rejects tools
      r = await tryCall(false);
    }

    const reply =
      r.output_text ||
      (Array.isArray(r.output)
        ? r.output
            .filter((o) => o.type === "output_text" || o.type === "message")
            .map((o) => (typeof o.content === "string" ? o.content : ""))
            .join("\n")
        : "") ||
      "";

    // harvest web links if present
    let sources = [];
    try {
      if (Array.isArray(r.output)) {
        for (const o of r.output) {
          if (o.type === "tool_result" && o.tool_name === "web_search" && Array.isArray(o.content)) {
            for (const c of o.content) {
              if (c.type === "tool_text" && typeof c.text === "string") {
                sources.push(...[...c.text.matchAll(/\bhttps?:\/\/\S+/g)].map((m) => m[0]));
              }
            }
          }
        }
      }
      const seen = new Set();
      sources = sources.filter((u) => u && !seen.has(u) && seen.add(u));
    } catch {}

    res.json({ reply: reply.trim(), sources });
  } catch (err) {
    console.error("CHAT_ERROR:", err);
    res.status(500).json({ error: "Chat failed." });
  }
});

// Image generation
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

// Upload + analyze (multi‑file). Backward‑compatible response fields.
app.post("/upload", upload.array("files"), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.json({ files: [], combinedText: "", text: "", summary: "", id: null, docId: null });

    const analyzed = [];
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
        text = ""; // (OCR not included)
        pages = 1;
      }

      analyzed.push({
        id,
        name: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
        pages,
        text,
      });
    }

    const combinedText = analyzed
      .map((r, i) => `=== File ${i + 1}: ${r.name} ===\n${r.text}`)
      .join("\n\n");

    const bundleId = uuidv4();
    res.json({
      id: bundleId,
      docId: bundleId,     // for older frontends
      files: analyzed,
      summary: "",         // left empty (compat field)
      text: combinedText,  // compat: some UIs read 'text'
      combinedText,        // preferred
    });
  } catch (err) {
    console.error("UPLOAD_ERROR:", err);
    res.status(500).json({ error: "Upload/analyze failed." });
  }
});

// Grounded Q&A (alias: /query for older frontends)
async function qaHandler(req, res) {
  try {
    const { question = "", context = "" } = req.body || {};
    const input = [
      {
        role: "system",
        content: [
          {
            type: "text",
            text:
              "Answer strictly from the provided context. If the answer isn't present, say you can't find it.",
          },
        ],
      },
      { role: "user", content: [{ type: "text", text: `CONTEXT:\n${context}\n\nQUESTION: ${question}` }] },
    ];
    const r = await client.responses.create({ model: CHAT_MODEL, input, max_output_tokens: 1200 });
    res.json({ reply: (r.output_text || "").trim() });
  } catch (err) {
    console.error("QA_ERROR:", err);
    res.status(500).json({ error: "Q&A failed." });
  }
}
app.post("/qa", qaHandler);
app.post("/query", qaHandler);

// Beautifier
app.post("/beautify", async (req, res) => {
  try {
    const { raw = "" } = req.body || {};
    const prompt =
      "Reformat these raw web snippets into clean short paragraphs and tidy bullet points. " +
      "Remove boilerplate and tracking. Keep only useful facts. Do not invent details.\n\n" +
      raw;

    const r = await client.responses.create({
      model: CHAT_MODEL,
      input: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      max_output_tokens: 1000,
    });

    res.json({ pretty: (r.output_text || "").trim() });
  } catch (err) {
    console.error("BEAUTIFY_ERROR:", err);
    res.status(500).json({ error: "Beautify failed." });
  }
});

app.use("/public", express.static(path.join(__dirname, "public")));

app.listen(port, () => {
  console.log(`JustAskJohnny listening on :${port} (model=${CHAT_MODEL})`);
});
