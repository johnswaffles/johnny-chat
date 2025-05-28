/*──────────────────────────────────────────────────────────────
  server.js – chat, TTS, low-cost GPT-Image-1, vision, search
──────────────────────────────────────────────────────────────*/
require("dotenv").config();
const OpenAI  = require("openai");
const express = require("express");
const cors    = require("cors");
const multer  = require("multer");
const sharp   = require("sharp");
const pdf     = require("pdf-parse");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app    = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

/*────────────── CHAT (gpt-4.1-nano) ──────────────*/
app.post("/chat", async (req, res) => {
  try {
    const messages = req.body.messages;
    if (!Array.isArray(messages) || messages.length === 0)
      return res.status(400).json({ error: "messages[] is required" });

    const model = req.body.model || "gpt-4.1-nano";

    const out = await openai.chat.completions.create({
      model,
      messages,
      max_tokens: 512        // plenty for short back-and-forth
    });

    return res.json(out.choices[0].message);   // {role,content}
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: err.message });
  }
});

/*────────────────────── TTS ─────────────────────────────────*/
app.post("/speech", async (req, res) => {
  try {
    const audio = await openai.audio.speech.create({
      model : "gpt-4o-mini-tts",
      voice : "shimmer",
      input : req.body.text,
      format: "mp3"
    });
    res.set("Content-Type", "audio/mpeg");
    res.send(Buffer.from(await audio.arrayBuffer()));
  } catch (err) {
    console.error("TTS error:", err);
    res.status(500).json({ error: err.message });
  }
});

/*──────────────── IMAGE (GPT-Image-1 MEDIUM) ───────────────*/
const sessions = new Map();

app.post("/image", async (req, res) => {
  try {
    const { sessionId = "anon", prompt, style = "" } = req.body;
    const prev = sessions.get(sessionId) || null;

    const img = await openai.images.generate({
      model  : "gpt-image-1",
      prompt : `Illustration (${style}) ${prompt}`,
      size   : "1024x1024",
      quality: "medium",                     // ★ switched from "low" → "medium"
      n      : 1,
      ...(prev && { previous_response_id: prev })
    });

    const frame = img.data[0];
    sessions.set(sessionId, frame.id);
    res.json({ b64: frame.b64_json });       // keep existing front-end format
  } catch (err) {
    console.error("Image error:", err);
    res.status(500).json({ error: err.message });
  }
});

/*────────────────────── VISION (img / PDF) ──────────────────*/
app.post("/vision", upload.single("file"), async (req, res) => {
  try {
    const mime = req.file.mimetype;

    /* images */
    if (mime.startsWith("image/")) {
      let buf = req.file.buffer;
      if (buf.length > 900_000) buf = await sharp(buf).resize({ width: 640 }).toBuffer();
      const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;

      const out = await openai.chat.completions.create({
        model   : "gpt-4.1-nano",
        max_tokens: 512,
        messages: [{
          role   : "user",
          content: [
            { type: "text", text: req.body.question || "Describe this image." },
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }]
      });
      return res.json({ content: out.choices[0].message.content.trim() });
    }

    /* PDFs */
    if (mime === "application/pdf") {
      const text = (await pdf(req.file.buffer)).text.slice(0, 8000);
      const out  = await openai.chat.completions.create({
        model   : "gpt-4.1-nano",
        max_tokens: 512,
        messages: [{
          role   : "user",
          content: `Here is the extracted text from a PDF:\n\n${text}\n\nPlease summarise the document.`
        }]
      });
      return res.json({ content: out.choices[0].message.content.trim() });
    }

    res.status(415).json({ error: "Unsupported file type" });
  } catch (err) {
    console.error("Vision error:", err);
    res.status(500).json({ error: err.message });
  }
});

/*────────────────────── SEARCH ──────────────────────────────*/
app.post("/search", async (req, res) => {
  try {
    const { query } = req.body;
    const out = await openai.chat.completions.create({
      model : "gpt-4.1-nano",
      tools : [{ type: "web_search" }],
      max_tokens: 512,
      messages: [
        { role: "user", content: `Search the web for: ${query}` },
        { role: "tool", name: "web_search", content: `query="${query}"` }
      ]
    });
    res.json(out.choices[0].message);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: err.message });
  }
});

/*────────────────────── START SERVER ───────────────────────*/
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅  API running  http://localhost:${PORT}`));

