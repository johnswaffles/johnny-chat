/*************************************************************************
 *  new-open-ai-chatbot  –  Node / Express backend
 *  • /chat   → o4-mini   (text-only chat)
 *  • /image  → DALL·E-3  (1024×1024, URL)
 *  • /speech → gpt-4o-mini-tts   voice: “coral”  (cheerful tone, MP3)
 *  • /vision  (stub) – keep / extend if you need image/PDF analysis
 *************************************************************************/

require("dotenv").config();
const OpenAI  = require("openai");
const express = require("express");
const cors    = require("cors");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app    = express();
app.use(cors());
app.use(express.json());

/*────────────────────────  CHAT  ────────────────────────*/
app.post("/chat", async (req, res) => {
  try {
    if (!Array.isArray(req.body.messages)) throw new Error("messages[] missing");
    const rsp = await openai.chat.completions.create({
      model: "o4-mini",
      messages: req.body.messages,
      max_completion_tokens: 800
    });
    return res.json({ content: rsp.choices[0].message.content });
  } catch (err) {
    console.error("chat:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/*────────────────────────  IMAGE  ───────────────────────*/
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

/*────────────────────────  SPEECH  ─────────────────────*/
app.post("/speech", async (req, res) => {
  try {
    const text = req.body.text;
    if (!text) throw new Error("text missing");

    /* stream the TTS audio, then concat → Buffer → mp3 */
    const stream = await openai.audio.speech.with_streaming_response.create({
      model: "gpt-4o-mini-tts",
      voice: "coral",
      input: text,
      instructions: "Speak in a cheerful and positive tone.",
      format: "mp3"
    });

    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const audioBuf = Buffer.concat(chunks);

    res.set("Content-Type", "audio/mpeg");
    res.send(audioBuf);
  } catch (err) {
    console.error("speech:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/*────────────────────────  VISION  (optional) ───────────*/
/*  If you previously had /vision (image/PDF analysis),   *
 *  paste that route here. Otherwise leave it out.        */

/*────────────────────────  START SERVER  ────────────────*/
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running  http://localhost:${PORT}`));

