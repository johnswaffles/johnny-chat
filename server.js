// server.js
// Express backend for Johnny Chat: chat, beautify, PDF/image upload+QA, image generation

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const OpenAI = require("openai");
const pdfParse = require("pdf-parse"); // <-- Node-friendly PDF extraction

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // required
const CHAT_MODEL = process.env.CHAT_MODEL || "gpt-4o-mini";
const IMAGE_MODEL = process.env.IMAGE_MODEL || "gpt-image-1";

if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

/* ----------------------------- In-memory store ----------------------------- */
const docs = new Map(); // docId -> { text, summary, uploadedAt, name }

/* ------------------------------- Utilities -------------------------------- */
async function summarize(text, maxTokens = 300) {
  const resp = await openai.responses.create({
    model: CHAT_MODEL,
    input: [
      { role: "system", content:
        "You are a concise technical summarizer. 2–4 sentences. No links or citations. " +
        "Focus on the main points and outcomes." },
      { role: "user", content: text.slice(0, 6000) }
    ],
    max_output_tokens: maxTokens
  });
  return resp.output_text?.trim() || "";
}

/* --------------------------------- Routes --------------------------------- */

// Chat with conversation memory (history [{role, content}])
app.post("/api/chat", async (req, res) => {
  try {
    const input = String(req.body?.input || "");
    const history = Array.isArray(req.body?.history) ? req.body.history : [];

    // System: no URLs in the body; UI shows sources separately.
    const sys =
      "You are Johnny Chat. Be helpful, direct, and concise. " +
      "Do NOT include URLs, markdown links, or bracketed citations in your answer body. " +
      "If you reference facts, write them plainly. The UI will show sources separately.";

    const messages = [{ role: "system", content: sys }, ...history, { role: "user", content: input }];

    const resp = await openai.responses.create({
      model: CHAT_MODEL,
      input: messages,
      temperature: 0.4
    });

    const reply = resp.output_text?.trim() || "(no reply)";
    // Provide sources array if your tool-using agent collects them; stubbed empty here.
    res.json({ reply, sources: [] });
  } catch (e) {
    console.error("CHAT_ERROR:", e);
    res.status(503).json({ error: "CHAT_FAILED", detail: (e && e.message) || String(e) });
  }
});

// Beautify: structure and clean formatting, forbid links/citations
app.post("/api/beautify", async (req, res) => {
  try {
    const text = String(req.body?.text || "");
    if (!text) return res.status(400).json({ error: "TEXT_REQUIRED" });

    const prompt =
      "Rewrite the answer so it is clean, readable, and well-structured.\n" +
      "Rules:\n" +
      "• Use 1–2 short paragraphs OR 3–8 crisp bullets.\n" +
      "• Do NOT include any URLs, markdown links, or bracketed citations.\n" +
      "• Keep it factual and concise.";

    const resp = await openai.responses.create({
      model: CHAT_MODEL,
      input: [
        { role: "system", content: prompt },
        { role: "user", content: text }
      ],
      temperature: 0.3
    });

    const pretty = resp.output_text?.trim() || text;
    res.json({ pretty });
  } catch (e) {
    console.error("BEAUTIFY_ERROR:", e);
    res.status(500).json({ error: "BEAUTIFY_FAILED", detail: (e && e.message) || String(e) });
  }
});

// Upload (PDF or Image). Returns { docId, text, summary }
const upload = multer({ storage: multer.memoryStorage() });
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "FILE_REQUIRED" });
    const { buffer, mimetype, originalname } = req.file;

    let text = "";
    if (mimetype === "application/pdf") {
      const parsed = await pdfParse(buffer);          // ← works on Node 22, no legacy build needed
      text = (parsed.text || "").trim();
    } else if (mimetype.startsWith("image/")) {
      // Vision OCR + description
      const base64 = buffer.toString("base64");
      const visionInput = [
        { role: "system", content:
          "Extract readable text (OCR) and give a short description. " +
          "Return plain text; no links or citations." },
        {
          role: "user",
          content: [
            { type: "input_text", text: "Describe this image and extract visible text (OCR)." },
            { type: "input_image", image_url: `data:${mimetype};base64,${base64}` }
          ]
        }
      ];
      const vresp = await openai.responses.create({ model: CHAT_MODEL, input: visionInput });
      text = vresp.output_text?.trim() || "";
    } else {
      return res.status(415).json({ error: "UNSUPPORTED_MEDIA_TYPE" });
    }

    const summary = text ? await summarize(text) : "";
    const docId = uuidv4();
    docs.set(docId, { text, summary, uploadedAt: Date.now(), name: originalname });
    res.json({ docId, text, summary });
  } catch (e) {
    console.error("UPLOAD_ERROR:", e);
    res.status(500).json({ error: "UPLOAD_FAILED", detail: (e && e.message) || String(e) });
  }
});

// Query a previously uploaded doc: { docId, question }
app.post("/query", async (req, res) => {
  try {
    const docId = String(req.body?.docId || "");
    const question = String(req.body?.question || "");
    if (!docId || !docs.has(docId)) return res.status(400).json({ error: "DOC_NOT_FOUND" });
    if (!question) return res.status(400).json({ error: "QUESTION_REQUIRED" });

    const { text, summary } = docs.get(docId);

    const sys =
      "Answer the user's question using ONLY the provided document content. " +
      "If the answer is not in the document, say you couldn't find it. " +
      "No links or citations.";

    const resp = await openai.responses.create({
      model: CHAT_MODEL,
      input: [
        { role: "system", content: sys },
        { role: "user", content: `Document summary:\n${summary}\n\nDocument text:\n${text.slice(0, 20000)}` },
        { role: "user", content: `Question: ${question}` }
      ],
      temperature: 0.2
    });

    const answer = resp.output_text?.trim() || "";
    res.json({ answer });
  } catch (e) {
    console.error("QUERY_ERROR:", e);
    res.status(500).json({ error: "QUERY_FAILED", detail: (e && e.message) || String(e) });
  }
});

// Image generation -> base64
app.post("/generate-image", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "");
    const size = String(req.body?.size || "1024x1024");
    if (!prompt) return res.status(400).json({ error: "PROMPT_REQUIRED" });

    const img = await openai.images.generate({
      model: IMAGE_MODEL,
      prompt,
      size
    });

    const image_b64 = img.data?.[0]?.b64_json || "";
    res.json({ image_b64 });
  } catch (e) {
    console.error("IMAGE_ERROR:", e);
    res.status(500).json({ error: "IMAGE_FAILED", detail: (e && e.message) || String(e) });
  }
});

app.get("/", (_req, res) => res.send("Johnny Chat API ok"));
app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
