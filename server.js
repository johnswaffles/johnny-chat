/*──────────────────────────────────────────────────────────────
  server.js – 5 routes with safe fall-backs
──────────────────────────────────────────────────────────────*/
require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const multer  = require("multer");
const fs      = require("fs");
const sharp   = require("sharp");
const pdf     = require("pdf-parse");
const { OpenAI } = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app    = express();
const upload = multer({ dest: "tmp/" });

app.use(cors());
app.use(express.json());

/*── CHAT  (preview → nano fallback) ──────────────────────────*/
app.post("/chat", async (req, res) => {
  const history = req.body.messages || [];
  const prompt  = history.at(-1)?.content;
  if (!prompt) return res.status(400).json({ error: "messages array missing" });

  try {
    const draft = await openai.responses.create({
      model : "gpt-4o-mini-search-preview",
      tools : [{ type: "web_search_preview" }],
      input : prompt
    });
    return res.json({ content: draft.output_text });
  } catch (err) {
    console.warn("preview search failed:", err.message);
    try {
      const out = await openai.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: history,
        max_tokens: 600
      });
      res.json({ content: out.choices[0].message.content });
    } catch (e) {
      console.error("Chat fallback error:", e);
      res.status(e.status || 500).json({ error: e.message });
    }
  }
});

/*── SEARCH  (preview → nano fallback) ───────────────────────*/
app.post("/search", async (req, res) => {
  const q = req.body.query;
  if (!q) return res.status(400).json({ error: "No query provided." });

  try {
    const out = await openai.responses.create({
      model : "gpt-4o-mini-search-preview",
      tools : [{ type: "web_search_preview" }],
      input : q
    });
    res.json({ result: out.output_text });
  } catch (err) {
    console.warn("search-preview failed:", err.message);
    try {
      const out = await openai.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: [
          { role: "system", content: "Answer as best you can without live web access." },
          { role: "user",   content: q }
        ],
        max_tokens: 400
      });
      res.json({ result: out.choices[0].message.content });
    } catch (e) {
      console.error("Search fallback error:", e);
      res.status(e.status || 500).json({ error: e.message });
    }
  }
});

/*── TEXT-TO-SPEECH ───────────────────────────────────────────*/
app.post("/speech", async (req, res) => {
  try {
    const stream = await openai.audio.speech.with_streaming_response.create({
      model:  "gpt-4o-mini-tts",
      voice:  "verse",
      input:  req.body.text,
      instructions: "Respond in a clear, neutral tone."
    });
    res.setHeader("Content-Type","audio/mpeg");
    await stream.stream_to_http(res);
  } catch (err) {
    console.error("TTS error:", err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/*── IMAGE  (gpt-image-1 → DALL·E-3 fallback) ─────────────────*/
app.post("/image", async (req, res) => {
  try {
    const first = await openai.images.generate({
      model: "gpt-image-1",
      prompt: req.body.prompt,
      size: "1024x1024",
      n: 1,
      response_format: "b64_json"
    });
    return res.json({ image: first.data[0].b64_json });
  } catch (err) {
    console.warn("gpt-image-1 failed:", err.message);
    try {
      const second = await openai.images.generate({
        model: "dall-e-3",
        prompt: req.body.prompt,
        size: "1024x1024",
        style: "natural",
        n: 1,
        response_format: "b64_json"
      });
      res.json({ image: second.data[0].b64_json });
    } catch (e) {
      console.error("Image fallback error:", e);
      res.status(e.status || 500).json({ error: e.message });
    }
  }
});

/*── VISION  (image / PDF) ────────────────────────────────────*/
app.post("/vision", upload.single("file"), async (req, res) => {
  try {
    const { path: tmp, mimetype, size } = req.file;
    const data = fs.readFileSync(tmp);
    fs.unlinkSync(tmp);

    if (mimetype.startsWith("image/")) {
      let buf = data;
      if (size > 900_000) buf = await sharp(buf).resize({ width: 640 }).toBuffer();
      const dataURL = `data:${mimetype};base64,${buf.toString("base64")}`;

      const out = await openai.chat.completions.create({
        model: "gpt-4o-mini",
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

    if (mimetype === "application/pdf") {
      const text = (await pdf(data)).text.slice(0, 8000);
      const out  = await openai.chat.completions.create({
        model: "o4-mini",
        messages: [{
          role: "user",
          content: `Here is the extracted text from a PDF:\n\n${text}\n\nPlease summarize the document.`
        }]
      });
      return res.json({ description: out.choices[0].message.content });
    }

    res.status(415).json({ error: "Unsupported file type (image or PDF only)" });
  } catch (err) {
    console.error("Vision error:", err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running at http://localhost:${PORT}`));

