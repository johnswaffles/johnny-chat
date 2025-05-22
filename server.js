/*──────────────────────────────────────────────────────────────
  server.js   –  chat · speech · vision · web_search · image
──────────────────────────────────────────────────────────────*/
require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const multer  = require("multer");
const fs      = require("fs");
const sharp   = require("sharp");
const pdf     = require("pdf-parse");
const OpenAI  = require("openai");

const openai  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app     = express();
const upload  = multer({ dest: "tmp/" });

app.use(cors());
app.use(express.json());

/*── CHAT  (o4-mini) ───────────────────────────────────────────*/
app.post("/chat", async (req, res) => {
  try {
    const out = await openai.chat.completions.create({
      model:    "o4-mini",
      messages: req.body.messages
    });
    res.json(out.choices[0].message);
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: err.message });
  }
});

/*── TEXT-TO-SPEECH  (o4-mini-audio-preview, voice “verse”) ───*/
app.post("/speech", async (req, res) => {
  try {
    const audio = await openai.audio.speech.create({
      model:  "gpt-4o-mini-audio-preview",
      voice:  "verse",
      input:  req.body.text,
      format: "mp3"
    });
    res.set("Content-Type", "audio/mpeg");
    res.send(Buffer.from(await audio.arrayBuffer()));
  } catch (err) {
    console.error("TTS error:", err);
    res.status(500).json({ error: err.message });
  }
});

/*── IMAGE  (GPT-Image 1 only) ────────────────────────────────*/
app.post("/image", async (req, res) => {
  try {
    const prompt = req.body.prompt?.trim() || "A happy kitten";

    const rsp = await openai.images.generate({
      model:  "gpt-image-1",
      prompt,                         // single-turn prompt
      n:      1,
      size:   "1024x1024"             // or 512×512, 2048×2048
      // response is base-64 by default
    });

    const b64 = rsp.data[0].b64_json;
    const dataURL = `data:image/png;base64,${b64}`;
    res.json({ url: dataURL });       // front-end treats like normal URL
  } catch (err) {
    console.dir(err, { depth: null });
    res.status(500).json({ error: err.error?.message || err.message });
  }
});

/*── VISION (image or PDF) – unchanged ────────────────────────*/
app.post("/vision", upload.single("file"), async (req, res) => {
  try {
    const { path: tmp, mimetype, size } = req.file;

    /* images */
    if (mimetype.startsWith("image/")) {
      let buf = fs.readFileSync(tmp);
      if (size > 900_000) buf = await sharp(buf).resize({ width: 640 }).toBuffer();
      fs.unlink(tmp, () => {});

      const dataURL = `data:${mimetype};base64,${buf.toString("base64")}`;
      const out = await openai.chat.completions.create({
        model: "o4-mini",
        messages: [{
          role: "user",
          content: [
            { type: "text",      text: "Describe this image." },
            { type: "image_url", image_url: { url: dataURL } }
          ]
        }]
      });
      return res.json({ description: out.choices[0].message.content });
    }

    /* PDFs */
    if (mimetype === "application/pdf") {
      const text = (await pdf(fs.readFileSync(tmp))).text.slice(0, 8000);
      fs.unlink(tmp, () => {});
      const out = await openai.chat.completions.create({
        model: "o4-mini",
        messages: [{
          role: "user",
          content: `Please summarise this PDF:\n\n${text}`
        }]
      });
      return res.json({ description: out.choices[0].message.content });
    }

    fs.unlink(tmp, () => {});
    res.status(415).json({ error: "Only images or PDFs are supported" });
  } catch (err) {
    console.error("Vision error:", err);
    res.status(500).json({ error: err.message });
  }
});

/*── WEB SEARCH  (o4-mini + tool) – unchanged ────────────────*/
app.post("/search", async (req, res) => {
  try {
    const out = await openai.chat.completions.create({
      model: "o4-mini",
      tools: [{ type: "web_search_preview" }],
      messages: [
        { role: "user", content: req.body.query }
      ]
    });
    res.json(out.choices[0].message);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`API ready  →  http://localhost:${PORT}`));

