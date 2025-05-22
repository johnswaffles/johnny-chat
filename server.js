/*************************************************************************
 *  new-open-ai-chatbot  •  Node / Express backend
 *  ────────────────────────────────────────────────────────────────────
 *  /chat   → o4-mini                     (text chat)
 *  /image  → DALL·E-3  (URL 1024×1024)
 *  /speech → gpt-4o-mini-tts  voice:“verse”   (returns MP3)
 *************************************************************************/

require("dotenv").config();
const OpenAI  = require("openai");
const express = require("express");
const cors    = require("cors");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app    = express();
app.use(cors());
app.use(express.json());

/*──────── CHAT ─────────────────────────────────────────────*/
app.post("/chat", async (req, res) => {
  try {
    if (!Array.isArray(req.body.messages)) throw new Error("messages[] missing");
    const rsp = await openai.chat.completions.create({
      model: "o4-mini",
      messages: req.body.messages,
      max_completion_tokens: 800
    });
    res.json({ content: rsp.choices[0].message.content });
  } catch (err) {
    console.error("chat:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/*──────── IMAGE (DALL·E-3) ─────────────────────────────────*/
app.post("/image", async (req, res) => {
  try {
    if (!req.body.prompt) throw new Error("prompt missing");
    const img = await openai.images.generate({
      model: "dall-e-3",
      prompt: req.body.prompt,
      size: "1024x1024",
      n: 1,
      response_format: "url"
    });
    res.json({ url: img.data[0].url });
  } catch (err) {
    console.error("image:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/*──────── SPEECH  (gpt-4o-mini-tts • voice: verse) ─────────*/
app.post("/speech", async (req, res) => {
  try {
    const text = req.body.text;
    if (!text) throw new Error("text missing");

    const audio = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "verse",
      input: text,
      instructions: "Speak in a cheerful and positive tone.",
      format: "mp3"
    });

    const buf = Buffer.from(await audio.arrayBuffer());
    res.set("Content-Type", "audio/mpeg");
    res.send(buf);
  } catch (err) {
    console.error("speech:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API running on", PORT));

