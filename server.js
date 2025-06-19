/* ─────────── new-open-ai-chatbot/server.js ───────────
   Minimal backend with resilient TTS (auto-fallback voice)   */

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

  /* back-compat for { user_input, last_id } bodies */
  if (!messages && req.body.user_input) {
    messages = [
      { role: "system", content: "You are AdaptiveTutor GPT." },
      { role: "user",   content: req.body.user_input }
    ];
  }
  if (!messages || !messages.length) {
    return res.status(400).json({ error: "messages array required" });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages
    });
    res.json({
      id:      completion.id,
      content: completion.choices[0].message.content
    });
  } catch (err) {
    console.error("/chat error:", err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/* ---------- /speech ---------- */
const ALLOWED_VOICES = ["alloy","echo","fable","onyx","nova","shimmer"];

app.post("/speech", async (req, res) => {
  let { text, voice = "alloy" } = req.body;
  if (!text) return res.status(400).json({ error: "text required" });
  if (!ALLOWED_VOICES.includes(voice)) voice = "alloy";      // fallback

  try {
    const speech = await openai.audio.speech.create({
      model:  "tts-1",
      voice,
      input:  text,
      format: "mp3"                     // returns Base-64 MP3
    });
    res.json({ audio: speech.audio });
  } catch (err) {
    console.error("/speech error:", err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/* ---------- /image ---------- */
app.post("/image", async (req, res) => {
  const { prompt, style = "illustration", size = "1024x1024" } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt required" });

  try {
    const img = await openai.images.generate({
      model:  "gpt-image-1",
      prompt: prompt + `\n\nStyle: ${style}`,
      size,
      response_format: "b64_json"
    });
    res.json({ b64: img.data[0].b64_json });
  } catch (err) {
    console.error("/image error:", err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/* ---------- start ---------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅  API ready on :${PORT}`));
