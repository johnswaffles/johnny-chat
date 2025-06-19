/* ─────────── new-open-ai-chatbot/server.js  ───────────
 * Minimal but robust Express backend for all your bots.
 * • Accepts POST /chat with either
 *     { messages:[ ... ] }
 *   or
 *     { user_input:"...", last_id:"..." }
 * • Provides simple /speech (TTS) & /image helpers too.
 * • Uses environment variable OPENAI_API_KEY   */

import "dotenv/config";
import express from "express";
import cors    from "cors";
import OpenAI  from "openai";

const app   = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json({ limit: "2mb" }));

/* ---------- /chat ---------- */
app.post("/chat", async (req, res) => {
  let messages = req.body.messages;

  /* Back-compat: convert old shape -> messages[] */
  if (!messages && req.body.user_input) {
    messages = [
      { role: "system", content: "You are AdaptiveTutor GPT." },
      { role: "user",   content: req.body.user_input }
    ];
  }

  /* sanity check */
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array required" });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",          // or gpt-4.1-nano
      messages
    });

    res.json({
      id:       completion.id,
      content:  completion.choices[0].message.content
    });
  } catch (err) {
    console.error("OpenAI /chat error:", err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/* ---------- /speech (TTS) ---------- */
app.post("/speech", async (req, res) => {
  const { text, voice = "alloy" } = req.body;
  if (!text) return res.status(400).json({ error: "text required" });

  try {
    const speech = await openai.audio.speech.create({
      model:  "tts-1",
      voice,
      input:  text,
      format: "mp3"
    });

    res.json({ audio: speech.audio });
  } catch (err) {
    console.error("OpenAI /speech error:", err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/* ---------- /image (GPT-Image-1) ---------- */
app.post("/image", async (req, res) => {
  const { prompt, style = "illustration", size = "1024x1024" } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt required" });

  try {
    const img = await openai.images.generate({
      model:   "gpt-image-1",
      prompt:  prompt + `\n\nStyle: ${style}`,
      size,
      response_format: "b64_json"
    });

    res.json({ b64: img.data[0].b64_json });
  } catch (err) {
    console.error("OpenAI /image error:", err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/* ---------- start server ---------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅  API ready on :${PORT}`));
