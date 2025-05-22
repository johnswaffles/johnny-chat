/*──────────────────────────────────────────────────────────────
  server.js  –  unified back-end for your Squarespace chatbot
──────────────────────────────────────────────────────────────*/

require("dotenv").config();
const OpenAI  = require("openai");
const express = require("express");
const cors    = require("cors");
const multer  = require("multer");
const fs      = require("fs");
const sharp   = require("sharp");
const pdf     = require("pdf-parse");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app    = express();
const upload = multer({ dest: "tmp/" });

app.use(cors());
app.use(express.json());

/*── CHAT ─────────────────────────────────────────────────────*/
app.post("/chat", async (req, res) => {
  try {
    const out = await openai.chat.completions.create({
      model: req.body.model || "o4-mini",
      messages: req.body.messages
    });
    res.json(out.choices[0].message);
  } catch (err) {
    console.error("Chat error:", err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/*── SPEECH (TTS) ─────────────────────────────────────────────*/
app.post("/speech", async (req, res) => {
  try {
    const audio = await openai.audio.speech.create({
      model:  "gpt-4o-mini-tts",
      voice:  req.body.voice || "verse",
      input:  req.body.text,
      format: "mp3"
    });
    res.set("Content-Type", "audio/mpeg");
    res.send(Buffer.from(await audio.arrayBuffer()));
  } catch (err) {
    console.error("TTS error:", err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/*── IMAGE  (GPT-Image-1) ─────────────────────────────────────*/
app.post("/image", async (req, res) => {
  try {
    const img = await openai.images.generate({
      model:  "gpt-image-1",
      prompt: req.body.prompt,
      size:   "1024x1024",
      n:      1                    // <-- NO response_format here
    });
    // gpt-image-1 always returns base-64 PNG in data[0].b64_json
    res.json({ image: img.data[0].b64_json });
  } catch (err) {
    console.error("Image error:", err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/*── VISION  (images OR PDFs) ─────────────────────────────────*/
app.post("/vision", upload.single("file"), async (req, res) => {
  try {
    const { path: tmp, mimetype, size } = req.file;

    /* Image files */
    if (mimetype.startsWith("image/")) {
      let buf = fs.readFileSync(tmp);
      if (size > 900_000) buf = await sharp(buf).resize({ width: 640 }).toBuffer();
      fs.unlink(tmp, () => {});
      const dataURL = `data:${mimetype};base64,${buf.toString("base64")}`;

      const out = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: [
            { type: "text",      text: req.body.question || "What’s in this image?" },
            { type: "image_url", image_url: { url: dataURL } }
          ]
        }]
      });
      return res.json({ description: out.choices[0].message.content });
    }

    /* PDFs */
    if (mimetype === "application/pdf") {
      const data = fs.readFileSync(tmp); fs.unlink(tmp, () => {});
      const text = (await pdf(data)).text.slice(0, 8000);
      const out  = await openai.chat.completions.create({
        model: "o4-mini",
        messages: [{
          role: "user",
          content: `Here is extracted text from a PDF:\n\n${text}\n\nSummarize it.`
        }]
      });
      return res.json({ description: out.choices[0].message.content });
    }

    fs.unlink(tmp, () => {});
    res.status(415).json({ error: "Unsupported file type (image or PDF only)" });

  } catch (err) {
    console.error("Vision error:", err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/*── WEB SEARCH (preview tool) ────────────────────────────────*/
app.post("/search", async (req, res) => {
  try {
    const out = await openai.responses.create({
      model: "gpt-4.1-mini",
      tools: [{ type: "web_search_preview" }],
      input: req.body.query
    });
    res.json({ answer: out.output_text });
  } catch (err) {
    console.error("Search error:", err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 10000;           // Render maps to 0.0.0.0:10000
app.listen(PORT, () => console.log(`API ready  →  http://localhost:${PORT}`));

