/*──────────────────────────────────────────────────────────────
  server.js   –   new-open-ai-chatbot
  ✔ Chat (default gpt-4o-mini-audio-preview  - or pass any model)
  ✔ Speech TTS  (gpt-4o-mini-tts , voice "verse")
  ✔ Image (DALL·E 3 1024×1024  quality:standard)
  ✔ Vision (image OR PDF → GPT description / summary)
  ✔ Web Search  (gpt-4.1-mini + web_search_preview tool)
──────────────────────────────────────────────────────────────*/

require("dotenv").config();
const OpenAI  = require("openai");
const express = require("express");
const cors    = require("cors");
const multer  = require("multer");
const fs      = require("fs");
const sharp   = require("sharp");
const pdf     = require("pdf-parse");        //  npm i pdf-parse

const openai  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app     = express();
const upload  = multer({ dest: "tmp/" });

app.use(cors());
app.use(express.json());

/*── CHAT ─────────────────────────────────────────────────────*/
app.post("/chat", async (req, res) => {
  try {
    const model    = req.body.model || "gpt-4o-mini-audio-preview";
    const messages = req.body.messages;
    const out = await openai.chat.completions.create({ model, messages });
    res.json(out.choices[0].message);
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: err.message });
  }
});

/*── TTS  (play / pause button) ───────────────────────────────*/
app.post("/speech", async (req, res) => {
  try {
    const audio = await openai.audio.speech.create({
      model:  "gpt-4o-mini-tts",
      voice:  "verse",
      input:  req.body.text,
      format: "mp3"
    });
    res.set("Content-Type", "audio/mpeg");
    res.send(Buffer.from(await audio.arrayBuffer()));
  } catch (err) {
    console.error("Speech error:", err);
    res.status(500).json({ error: err.message });
  }
});

/*── IMAGE  (DALL·E 3) ────────────────────────────────────────*/
app.post("/image", async (req, res) => {
  try {
    const rsp = await openai.images.generate({
      model:           "dall-e-3",
      prompt:          req.body.prompt?.trim() || "A happy kitten",
      n:               1,
      size:            "1024x1024",
      quality:         "standard",      // required
      style:           "natural",       // required (natural | vivid)
      response_format: "url"
    });
    res.json({ url: rsp.data[0].url });
  } catch (err) {
    /* ⬇️  NEW: dump the full error object for debugging */
    console.dir(err, { depth: null, colors: true });

    res
      .status(500)
      .json({ error: err.error?.message || err.message || "image error" });
  }
});

/*── WEB SEARCH  (gpt-4.1-mini + tool) ───────────────────────*/
app.post("/search", async (req, res) => {
  try {
    const rsp = await openai.responses.create({
      model: "gpt-4.1-mini",
      tools: [{ type: "web_search_preview" }],
      input: req.body.query
    });
    res.json({ text: rsp.output_text });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: err.message });
  }
});

/*── VISION  (image OR PDF) ───────────────────────────────────*/
app.post("/vision", upload.single("file"), async (req, res) => {
  try {
    const { path: tmp, mimetype, size } = req.file;

    /* IMAGES -------------------------------------------------*/
    if (mimetype.startsWith("image/")) {
      let buf = fs.readFileSync(tmp);
      if (size > 900_000) buf = await sharp(buf).resize({ width: 640 }).toBuffer();
      fs.unlink(tmp, () => {});
      const dataURL = `data:${mimetype};base64,${buf.toString("base64")}`;

      const out = await openai.chat.completions.create({
        model: "gpt-4o-mini-audio-preview",
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

    /* PDFs ---------------------------------------------------*/
    if (mimetype === "application/pdf") {
      const data = fs.readFileSync(tmp); fs.unlink(tmp, () => {});
      const text = (await pdf(data)).text.slice(0, 8000);   // ~2-3 K tokens
      const out  = await openai.chat.completions.create({
        model: "gpt-4o-mini-audio-preview",
        messages: [{
          role: "user",
          content: `Here is the extracted text from a PDF:\n\n${text}\n\nPlease summarize the document.`
        }]
      });
      return res.json({ description: out.choices[0].message.content });
    }

    /* unsupported -------------------------------------------*/
    fs.unlink(tmp, () => {});
    res.status(415).json({ error: "Unsupported file type (image or PDF only)" });

  } catch (err) {
    console.error("Vision error:", err);
    res.status(500).json({ error: err.message });
  }
});

/*── BOOT ─────────────────────────────────────────────────────*/
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API ready  →  http://localhost:${PORT}`));

