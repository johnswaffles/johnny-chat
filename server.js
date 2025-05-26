/*──────────────────────────────────────────────────────────────
  Story-bot API
  ─ /chat     : generate the next story paragraph (GPT-4o-mini)
  ─ /speech   : MP3 narration of any text (gpt-4o-mini-tts)
  ─ /image    : GPT-Image-1 illustration, with character-lock
──────────────────────────────────────────────────────────────*/
require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const { OpenAI } = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app    = express();
app.use(cors());
app.use(express.json());

/*── CHAT ─────────────────────────────────────────────────────*/
app.post("/chat", async (req, res) => {
  try {
    const out = await openai.chat.completions.create({
      model:        "gpt-4.1-nano",
      temperature:  0.85,
      messages:     req.body.messages
    });
    res.json({ content: out.choices[0].message.content });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: err.message });
  }
});

/*── IMAGE (GPT-Image-1) ──────────────────────────────────────*/
const sessions = new Map();                // {sessionId → lastImageId}

/*
  body = {
    sessionId : "<uuid from browser>",
    prompt    : "<paragraph text>",
    style     : "<art-style string>"
  }
*/
app.post("/image", async (req, res) => {
  try {
    const { sessionId, prompt, style = "" } = req.body;

    const previous = sessions.get(sessionId) || null; // image-id for consistency

    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt: `Illustration (${style}). ${prompt}`,
      ...(previous && { previous_response_id: previous }),
      size:  "1024x1024",
      n:     1
    });

    const img = result.data[0];
    sessions.set(sessionId, img.id);        // remember for next turn
    res.json({ b64: img.b64_json });

  } catch (err) {
    console.error("Image error:", err);
    res.status(500).json({ error: err.message });
  }
});

/*── TTS ──────────────────────────────────────────────────────*/
app.post("/speech", async (req, res) => {
  try {
    const mp3 = await openai.audio.speech.create({
      model:   "gpt-4o-mini-tts",
      voice:   req.body.voice || "onyx",
      input:   req.body.text,
      format:  "mp3",
      instructions:"Narrate clearly and engagingly"
    });
    const buf = Buffer.from(await mp3.arrayBuffer());
    res.set("Content-Type","audio/mpeg");
    res.send(buf);
  } catch (err) {
    console.error("TTS error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ────────────────────────────────────────────────
   VISION  – analyse / describe an uploaded image
   POST  /vision
   Body (JSON)  {
     question : "what’s in this image?",   // optional – default is “Describe this image”
     imageUrl : "https://…",               //  OR
     imageB64 : "data:image/png;base64,AA…" // data-URL string
   }
   Returns  { content : "<assistant reply from GPT-4o-mini>" }
─────────────────────────────────────────────────*/

app.post("/vision", async (req, res) => {
  try {
    const { imageUrl, imageB64, question = "Describe this image" } = req.body || {};

    /* ––– basic validation ––– */
    if (!imageUrl && !imageB64)
      return res.status(400).json({ error: "Provide imageUrl OR imageB64" });
    const img = imageUrl
      ? { type: "image_url", image_url: { url: imageUrl } }
      : { type: "image_url", image_url: { url: imageB64 } };   // data-URL counts as url

    /* ––– call GPT-4o-mini with “vision” content ––– */
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: question },
          img,
        ],
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",          // vision-capable model
      messages,
      max_tokens: 512,
    });

    res.json({ content: completion.choices[0].message.content.trim() });
  } catch (err) {
    console.error("Vision error:", err);
    res.status(500).json({ error: err.message || "Vision failure" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=>console.log(`API → http://localhost:${PORT}`));

