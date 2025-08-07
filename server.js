/* ───────────────────────────────────────────────────────────────
   server.js · English-only voice + chat + image backend (GPT-5 mini)
────────────────────────────────────────────────────────────────── */

import express               from "express";
import multer                from "multer";
import cors                  from "cors";
import dotenv                from "dotenv";
import OpenAI                from "openai";
import { writeFile, unlink } from "fs/promises";
import { createReadStream }  from "fs";
import { randomUUID }        from "crypto";

dotenv.config();

/* –– runtime defaults (env vars override) –– */
const PORT        = process.env.PORT || 3000;

// Read your existing TEXT_MODEL; fall back to gpt-5-mini
const CHAT_MODEL  = process.env.TEXT_MODEL || process.env.CHAT_MODEL || "gpt-5-mini";
const IMAGE_MODEL = process.env.IMAGE_MODEL || "gpt-image-1";
const S2T_MODEL   = process.env.S2T_MODEL  || "gpt-4o-transcribe";   // speech → text
const TTS_MODEL   = process.env.TTS_MODEL  || "gpt-4o-mini-tts";      // text → speech

// Default CORS whitelist always includes your site + Render domain
const defaultOrigins = [
  "https://justaskjohnny.com",
  "https://www.justaskjohnny.com",
  "https://johnny-chat.onrender.com"
];
const CORS_ALLOWED = (
  process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(",")
    : defaultOrigins
).map(s => s.trim()).filter(Boolean);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* –– express plumbing –– */
const app = express();
app.use(express.json({ limit: "1mb" }));

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // allow curl/postman
    return cb(null, CORS_ALLOWED.includes(origin));
  }
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25_000_000 } // 25 MB
});

/* helper: expose same handler on /api/* and /* */
const mount = (path, handler) => {
  app.post(path, handler);
  app.post(`/api${path}`, handler); // legacy front-ends still work
};

/* ─────────────────────────  speech ➜ text  ───────────────────── */
mount("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file?.buffer) throw new Error("Empty audio buffer");
    const tmp = `/tmp/${randomUUID()}.webm`;
    await writeFile(tmp, req.file.buffer);

    const transcription = await openai.audio.transcriptions.create({
      model: S2T_MODEL,
      file: createReadStream(tmp),
      language: "en",
      response_format: "text"
    });

    await unlink(tmp).catch(() => {});
    res.json({ text: transcription.text });
  } catch (err) {
    console.error("transcribe error:", err.response?.data || err.message || err);
    res.status(500).json({ error: "transcription failed" });
  }
});

/* ─────────────────────────   chat LLM   ──────────────────────── */
mount("/chat", async (req, res) => {
  try {
    const history = Array.isArray(req.body.history) ? req.body.history : [];
    const messages = history
      .filter(m => typeof m?.content === "string" && m.content.trim())
      .map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content.trim() }))
      .slice(-20);

    const chat = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages,
      temperature: 0.7,
      stream: false
    });

    res.json({ reply: chat.choices[0]?.message?.content ?? "" });
  } catch (err) {
    console.error("chat error:", err.response?.data || err.message || err);
    res.status(500).json({ error: "chat failed" });
  }
});

/* ─────────────────────────  text ➜ speech  ───────────────────── */
mount("/speech", async (req, res) => {
  try {
    const { text, voice = "shimmer" } = req.body || {};
    if (!text || !String(text).trim()) return res.status(400).json({ error: "text required" });

    const audio = await openai.audio.speech.create({
      model: TTS_MODEL,
      voice,
      input: String(text),
      format: "mp3"
    });

    const b64 = Buffer.from(await audio.arrayBuffer()).toString("base64");
    res.json({ audio: b64 });
  } catch (err) {
    console.error("tts error:", err.response?.data || err.message || err);
    res.status(500).json({ error: "tts failed" });
  }
});

/* ─────────────────────────  image create  ────────────────────── */
mount("/image", async (req, res) => {
  try {
    const { prompt = "", style = "illustration" } = req.body || {};
    if (!prompt.trim()) return res.status(400).json({ error: "prompt required" });

    const img = await openai.images.generate({
      model: IMAGE_MODEL,
      prompt: `${prompt}\n\nRender in ${style} style.`,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json"
    });

    res.json({ b64: img.data[0].b64_json });
  } catch (err) {
    console.error("image error:", err.response?.data || err.message || err);
    res.status(500).json({ error: "image generation failed" });
  }
});

/* ─────────────────────────  health  ──────────────────────────── */
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`✅  Server ready → http://localhost:${PORT}`);
});
