/* ───────────────────────────────────────────────────────────────
   server.js  ·  English‑only voice + chat backend
   • Speech → text  (gpt‑4o‑transcribe or whisper‑1)
   • Chat completion (gpt‑4o‑audio‑preview)
   • Text → speech  (gpt‑4o‑audio‑preview – "shimmer" voice)
   • Temp‑file upload avoids multipart parse errors
────────────────────────────────────────────────────────────────── */

import express             from "express";
import multer              from "multer";
import cors                from "cors";
import dotenv              from "dotenv";
import OpenAI              from "openai";
import { writeFile, unlink } from "fs/promises";
import { createReadStream }  from "fs";
import { randomUUID }        from "crypto";

dotenv.config();

/* ── model defaults (env vars override) ───────────────────────── */
const PORT        = process.env.PORT || 3000;
const CHAT_MODEL  = process.env.MODEL      || "gpt-4o-audio-preview";
const S2T_MODEL   = process.env.S2T_MODEL  || "gpt-4o-transcribe";   // or whisper-1
const TTS_MODEL   = process.env.TTS_MODEL  || "gpt-4o-audio-preview";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ── express setup ────────────────────────────────────────────── */
const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits : { fileSize: 25_000_000 }     // 25 MB
});

/* ───────────────────────────────────────────────────────────────
   POST /api/transcribe  – speech → text (English)
────────────────────────────────────────────────────────────────── */
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file?.buffer) throw new Error("Empty audio buffer");

    // write buffer to a temp file and stream to OpenAI
    const tmp = `/tmp/${randomUUID()}.webm`;
    await writeFile(tmp, req.file.buffer);

    const transcription = await openai.audio.transcriptions.create({
      model : S2T_MODEL,
      file  : createReadStream(tmp),   // <<< critical line
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

/* ───────────────────────────────────────────────────────────────
   POST /api/chat  – LLM completion (English)
────────────────────────────────────────────────────────────────── */
app.post("/api/chat", async (req, res) => {
  try {
    const { history = [] } = req.body;

    const messages = Array.isArray(history) ? history.filter(
      m => m && typeof m.content === "string" && m.content.trim().length
    ) : [];

    const chat = await openai.chat.completions.create({
      model   : CHAT_MODEL,
      messages,
      stream  : false
    });

    res.json({ reply: chat.choices[0].message.content });
  } catch (err) {
    console.error("chat error:", err.response?.data || err.message || err);
    res.status(500).json({ error: "chat failed" });
  }
});

/* ───────────────────────────────────────────────────────────────
   POST /api/speech  – text → speech (wav, shimmer)
────────────────────────────────────────────────────────────────── */
app.post("/api/speech", async (req, res) => {
  try {
    const { text } = req.body;
    const audio = await openai.audio.speech.create({
      model : TTS_MODEL,
      voice : "shimmer",
      input : text,
      format: "wav"
    });
    res.set({
      "Content-Type": "audio/wav; codecs=1",
      "Content-Disposition": 'inline; filename="reply.wav"'
    });
    res.send(Buffer.from(await audio.arrayBuffer()));
  } catch (err) {
    console.error("tts error:", err.response?.data || err.message || err);
    res.status(500).json({ error: "tts failed" });
  }
});

/* health */
app.get("/health", (_, res) => res.json({ status: "ok" }));

app.listen(PORT, () =>
  console.log(`✅  Server ready  →  http://localhost:${PORT}`)
);
