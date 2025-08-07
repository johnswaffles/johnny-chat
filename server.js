/* ───────────────────────────────────────────────────────────────
   server.js  ·  English-only voice + chat + image backend
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
const PORT        = process.env.PORT        || 3000;
const CHAT_MODEL  = process.env.CHAT_MODEL  || "gpt-5-mini";          // text/code   :contentReference[oaicite:0]{index=0}
const S2T_MODEL   = process.env.S2T_MODEL   || "gpt-4o-transcribe";   // speech➜text
const TTS_MODEL   = process.env.TTS_MODEL   || "gpt-4o-audio-preview";// text➜speech
const IMAGE_MODEL = process.env.IMAGE_MODEL || "image-1";             // image gen

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* –– express plumbing –– */
const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits : { fileSize: 25_000_000 }
});

/* ───────────────────────────────────────────────────────────────
   helper: expose the same handler on /api/* and /* endpoints
────────────────────────────────────────────────────────────────── */
const mount = (path, handler) => {
  app.post(path, handler);
  app.post(`/api${path}`, handler);          // legacy front-ends still work
};

/* ─────────────────────────  speech ➜ text  ───────────────────── */
mount("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file?.buffer) throw new Error("Empty audio buffer");

    const tmp = `/tmp/${randomUUID()}.webm`;
    await writeFile(tmp, req.file.buffer);

    const transcription = await openai.audio.transcriptions.create({
      model          : S2T_MODEL,
      file           : createReadStream(tmp),
      language       : "en",
      response_format: "text"
    });

    await unlink(tmp).catch(()=>{});
    res.json({ text: transcription.text });
  } catch (err) {
    console.error("transcribe error:", err.response?.data || err.message || err);
    res.status(500).json({ error: "transcription failed" });
  }
});

/* ─────────────────────────   chat LLM   ──────────────────────── */
mount("/chat", async (req, res) => {
  try {
    const history  = Array.isArray(req.body.history) ? req.body.history : [];
    const messages = history.filter(m => m?.content?.trim());

    const chat = await openai.chat.completions.create({
      model  : CHAT_MODEL,
      stream : false,
      messages
    });

    res.json({ reply: chat.choices[0].message.content });
  } catch (err) {
    console.error("chat error:", err.response?.data || err.message || err);
    res.status(500).json({ error: "chat failed" });
  }
});

/* ─────────────────────────  text ➜ speech  ───────────────────── */
mount("/speech", async (req, res) => {
  try {
    const { text, voice = "shimmer" } = req.body;

    const audio = await openai.audio.speech.create({
      model : TTS_MODEL,
      input : text,
      voice,
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
    const { prompt = "", style = "illustration" } = req.body;
    if (!prompt.trim()) throw new Error("Missing prompt text");

    const img = await openai.images.generate({
      model          : IMAGE_MODEL,
      prompt         : `${prompt}\n\nRender in ${style} style.`,
      n              : 1,
      size           : "1024x1024",
      response_format: "b64_json"
    });

    res.json({ b64: img.data[0].b64_json });
  } catch (err) {
    console.error("image error:", err.response?.data || err.message || err);
    res.status(500).json({ error: "image generation failed" });
  }
});

/* ─────────────────────────  health  ──────────────────────────── */
app.get("/health", (_, res) => res.json({ status: "ok" }));

app.listen(PORT, () =>
  console.log(`✅  Server ready → http://localhost:${PORT}`)
);

