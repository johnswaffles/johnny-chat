// server.js  — ESM
import express from "express";
import cors from "cors";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import OpenAI from "openai";

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

/* ---------- config ---------- */
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || undefined; // keep default unless you’ve set a proxy
const MODEL = process.env.MODEL || "gpt-5"; // you can flip in Render envs

if (!OPENAI_API_KEY) {
  console.warn("[WARN] OPENAI_API_KEY is not set — /api/chat and /generate-image will fail.");
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY, baseURL: OPENAI_BASE_URL });

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

/* ---------- helpers ---------- */
const todayChicago = () =>
  new Date().toLocaleString("en-US", { timeZone: "America/Chicago" });

function normalError(res, err, status = 500) {
  const msg =
    err?.response?.data?.error?.message ||
    err?.error?.message ||
    err?.message ||
    String(err);
  return res.status(status).json({ detail: msg });
}

/* ---------- health ---------- */
app.get("/health", (_req, res) => {
  res.json({ ok: true, model: MODEL, time: todayChicago() });
});

/* ---------- CHAT (Responses API) ---------- */
/**
 * body: { input: string, history?: [{role, content}], web?: boolean }
 * - `web` is passed as an instruction; if the model supports browsing, it may use it.
 */
app.post("/api/chat", async (req, res) => {
  try {
    const { input, history = [], web = false } = req.body || {};
    if (!OPENAI_API_KEY) return res.status(400).json({ detail: "Missing OPENAI_API_KEY" });
    if (!input || typeof input !== "string") return res.status(400).json({ detail: "Missing input" });

    // Build responses.create input
    const system = [
      `You are Johnny, a concise, friendly assistant.`,
      `Current time (America/Chicago): ${todayChicago()}.`,
      web
        ? `User requested live/real-time info. If your model/runtime supports tools or browsing, use them to fetch up-to-date facts and include source URLs the UI can render.`
        : `Prefer your internal knowledge. If the user explicitly asks for current data, say that you may not be live unless you can browse.`,
    ].join(" ");

    const convo = [];
    convo.push({ role: "system", content: system });
    for (const m of history) {
      if (!m?.role || !m?.content) continue;
      const r = m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user";
      convo.push({ role: r, content: String(m.content) });
    }
    convo.push({ role: "user", content: input });

    const resp = await openai.responses.create({
      model: MODEL,
      input: convo,
      // keep params minimal; some models error on unsupported fields
      max_output_tokens: 1200,
    });

    const reply = resp?.output_text || "(no reply)";
    // If the model produced citations/links, you can attempt to extract them here later.
    res.json({ reply, sources: [] });
  } catch (err) {
    return normalError(res, err);
  }
});

/* ---------- BEAUTIFY (optional; non-fatal) ---------- */
/**
 * body: { raw: string }
 * If the LLM call fails, we just echo the text back so the UI never breaks.
 */
app.post("/beautify", async (req, res) => {
  const { raw = "" } = req.body || {};
  if (!raw) return res.json({ pretty: "" });

  try {
    if (!OPENAI_API_KEY) return res.json({ pretty: raw });
    const resp = await openai.responses.create({
      model: MODEL,
      input: [
        { role: "system", content: "Rewrite the user's text into clean, readable paragraphs and short bullet lists. Keep URLs intact. No extra commentary." },
        { role: "user", content: raw },
      ],
      max_output_tokens: 800,
    });
    const pretty = resp?.output_text?.trim() || raw;
    res.json({ pretty });
  } catch {
    res.json({ pretty: raw });
  }
});

/* ---------- UPLOAD (multi-file). We don’t parse PDFs here to keep deploy stable.
   We simply acknowledge files and prepare a combined text scaffold that the UI can use.
   If you later want full server-side PDF extraction again, we can add it behind a flag. ---------- */
app.post("/upload", upload.array("files", 12), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ detail: "No files received" });

    // Build a lightweight combinedText so the user sees something immediately.
    const lines = [];
    files.forEach((f, i) => {
      lines.push(`== File ${i + 1}: ${f.originalname} ==`);
      if (f.mimetype.startsWith("image/")) {
        lines.push("(image uploaded)");
      } else if (f.mimetype === "application/pdf") {
        lines.push("(PDF uploaded — preview generated client-side)");
      } else {
        lines.push(`(type: ${f.mimetype})`);
      }
      lines.push("");
    });

    const combinedText = lines.join("\n");
    res.json({
      id: uuidv4(),
      combinedText,
      text: combinedText, // FE reads either `combinedText` or `text`
    });
  } catch (err) {
    return normalError(res, err);
  }
});

/* ---------- QA over provided context ---------- */
/**
 * body: { question: string, context: string }
 */
app.post("/qa", async (req, res) => {
  try {
    const { question = "", context = "" } = req.body || {};
    if (!OPENAI_API_KEY) return res.status(400).json({ detail: "Missing OPENAI_API_KEY" });
    if (!question) return res.status(400).json({ detail: "Missing question" });
    if (!context) return res.status(400).json({ detail: "Missing context (upload & analyze first)" });

    const resp = await openai.responses.create({
      model: MODEL,
      input: [
        { role: "system", content: "Answer strictly from the provided context. If the answer is not in context, say you can’t find it." },
        { role: "user", content: `Context:\n${context}\n\nQuestion: ${question}` },
      ],
      max_output_tokens: 700,
    });

    res.json({ reply: resp?.output_text || "(no answer)" });
  } catch (err) {
    return normalError(res, err);
  }
});

/* ---------- IMAGE GEN ---------- */
/**
 * body: { prompt: string, size?: "1024x1024" | "1024x1536" | "1536x1024" }
 */
app.post("/generate-image", async (req, res) => {
  try {
    const { prompt = "", size = "1024x1024" } = req.body || {};
    if (!OPENAI_API_KEY) return res.status(400).json({ detail: "Missing OPENAI_API_KEY" });
    if (!prompt) return res.status(400).json({ detail: "Missing prompt" });

    const img = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size,
      response_format: "b64_json",
    });

    const image_b64 = img?.data?.[0]?.b64_json || "";
    if (!image_b64) return res.status(500).json({ detail: "Image generation returned no data" });
    res.json({ image_b64 });
  } catch (err) {
    return normalError(res, err);
  }
});

/* ---------- not found ---------- */
app.use((_req, res) => res.status(404).json({ detail: "Not found" }));

app.listen(PORT, () => {
  console.log(`Johnny server listening on :${PORT}`);
});
