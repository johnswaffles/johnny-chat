// server.js
import express from "express";
import cors from "cors";
import multer from "multer";
import pdfParse from "pdf-parse";
import { readFile } from "fs/promises";
import OpenAI from "openai";

const app = express();
const upload = multer({ limits: { fileSize: 40 * 1024 * 1024 } }); // 40 MB/file
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// ---------- OpenAI ----------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------- In-memory doc store ----------
/** id -> { text, summary, files:[{name,type,size}] } */
const DOCS = new Map();
const newId = () => crypto.randomUUID();

// small helper to call Responses API safely
async function llm(opts) {
  const {
    system = "You are a helpful assistant.",
    user,
    max_output_tokens = 1800,
    verbosity, // may be ignored by model, that's fine
    tools,
  } = opts;

  const input = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  const resp = await openai.responses.create({
    model: "gpt-5",
    input,
    max_output_tokens,
    // do not always pass temperature; some preview models reject it
    ...(verbosity ? { verbosity } : {}),
    ...(tools ? { tools } : {}),
  });

  // Normalize output text and crude URL scraping for sources, if any
  const text = resp.output_text ?? "";
  const urlRegex = /\bhttps?:\/\/[^\s)]+/g;
  const sources = Array.from(new Set(text.match(urlRegex) || [])).slice(0, 8);
  return { text, sources };
}

// ---------- CHAT ----------
app.post("/api/chat", async (req, res) => {
  try {
    const { input, history = [], mode } = req.body;

    // Build message text from history + current input (history already user/assistant turns)
    const stitched = history
      .slice(-40)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    // defaults
    let maxTokens = 2000;
    let verbosity = "medium";
    let systemPrompt =
      "You are Johnny, a pragmatic assistant. When users ask about current facts (weather, news, stocks, etc.), search the web and incorporate live info. Keep the main answer clean; any links can be listed plainly at the end.";

    // Long-form mode for Write Paper
    if (mode === "writepaper") {
      maxTokens = 48000; // adjust per your quota
      verbosity = "long";
      systemPrompt +=
        " You write long-form papers with rich structure (introduction, well-organized sections, conclusion). Honor explicit word-count requests from the user. Aim for depth, nuance, and clarity without fluff. Use smooth transitions; no bullets or headings unless the user asked.";
    }

    const { text, sources } = await llm({
      system: systemPrompt,
      user: `${stitched ? stitched + "\n\n" : ""}USER: ${input}`,
      max_output_tokens: maxTokens,
      verbosity,
      tools: [{ type: "web_search" }], // lets the model fetch live info when needed
    });

    res.json({ reply: text, sources });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// ---------- BEAUTIFY ----------
app.post("/api/beautify", async (req, res) => {
  try {
    const { text } = req.body;
    const prompt = `Clean and format the following text into clear, readable paragraphs and short lists where appropriate. Remove duplicated fragments and tracking parameters. Keep the meaning intact.

TEXT:
${text}`;
    const { text: pretty } = await llm({
      system:
        "You are a concise text beautifier. Improve formatting only; do not invent facts.",
      user: prompt,
      max_output_tokens: 1200,
    });
    res.json({ pretty });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// ---------- UPLOAD (multi-file: PDFs + images) ----------
app.post("/upload", upload.array("files", 12), async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ error: "No files" });

    let allText = "";
    const meta = [];

    for (const f of req.files) {
      meta.push({ name: f.originalname, type: f.mimetype, size: f.size });
      if (f.mimetype === "application/pdf") {
        const data = await pdfParse(f.buffer);
        allText += `\n\n[PDF: ${f.originalname}]\n${data.text || ""}`;
      } else if (/^image\//.test(f.mimetype)) {
        // For images, we store a placeholder note; OCR could be added later
        allText += `\n\n[IMAGE: ${f.originalname}]`;
      } else {
        // try treat as text
        allText += `\n\n[FILE: ${f.originalname}]\n${f.buffer.toString("utf8")}`;
      }
    }

    const summaryPrompt = `Summarize the key points from the following combined files. Then provide a 5–8 bullet executive summary.

${allText.slice(0, 300000)}`;
    const { text: summary } = await llm({
      system:
        "You summarize documents faithfully. Do not add claims not present in the text.",
      user: summaryPrompt,
      max_output_tokens: 2000,
    });

    const id = newId();
    DOCS.set(id, { text: allText, summary, files: meta });

    res.json({
      docId: id,
      text: allText.slice(0, 500000),
      summary,
      files: meta,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// ---------- QUERY uploaded doc ----------
app.post("/query", async (req, res) => {
  try {
    const { docId, question } = req.body;
    const doc = DOCS.get(docId);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    const prompt = `Answer the question using only the content below. Quote key phrases when helpful and cite section cues like [PDF: filename] if relevant. If not found, say so.

DOCUMENT:
${doc.text.slice(0, 400000)}

QUESTION: ${question}`;
    const { text: answer } = await llm({
      system:
        "You are a careful reading assistant. When the answer is uncertain, you say so.",
      user: prompt,
      max_output_tokens: 1800,
    });
    res.json({ answer });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// ---------- IMAGE generation/edit ----------
app.post("/generate-image", async (req, res) => {
  try {
    const { prompt, size = "1024x1024", images = [] } = req.body;

    const input = [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          ...images.map((u) =>
            u.startsWith("data:")
              ? { type: "input_image", image_url: u }
              : { type: "input_image", image_url: u }
          ),
        ],
      },
    ];

    const resp = await openai.responses.create({
      model: "gpt-5",
      input,
      tools: [{ type: "image_generation" }],
      max_output_tokens: 1, // not text output
      // image tool respects requested size via prompt; add explicit hint:
      metadata: { target_size: size },
    });

    // Collect first generated image (base64)
    const calls = (resp.output || []).filter(
      (o) => o.type === "image_generation_call"
    );
    const image_b64 = calls?.[0]?.result || null;

    if (!image_b64) return res.status(500).json({ error: "No image returned" });

    res.json({ image_b64 });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// ---------- HEALTH ----------
app.get("/", (_req, res) => res.send("OK"));

// ---------- START (Render provides PORT) ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on :${PORT}`));

