/*──────────────────────────────────────────────────────────────
  server.js  –  Express API for state‑managed chat (Responses API),
                TTS, GPT‑Image‑1 generation, vision on images/PDFs,
                and ad‑hoc web search
                *Cost‑optimised: GPT‑4.1‑nano where feasible*
──────────────────────────────────────────────────────────────*/
require("dotenv").config();
const OpenAI  = require("openai");
const express = require("express");
const cors    = require("cors");
const multer  = require("multer");
const sharp   = require("sharp");
const pdf     = require("pdf-parse");

const openai  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app     = express();
const upload  = multer({ storage: multer.memoryStorage() });
const sessions = new Map();

app.use(cors());
app.use(express.json({ limit: "6mb" }));

/*──────────────────────── CHAT (Responses API) ────────────────────────*/
//  POST /chat  { user_input:string, last_id?:string }
//  ↳ returns   { id, answer }
app.post("/chat", async (req, res) => {
  try {
    const user_input = (req.body.user_input || "").trim();
    if (!user_input) return res.status(400).json({ error: "user_input is required" });

    const previous_response_id = req.body.last_id || undefined;

    const response = await openai.responses.create({
      model : "gpt-4.1-nano",               // ★ ultra‑cheap model
      input : user_input,
      ...(previous_response_id && { previous_response_id }),
      tools : []
    });

    const text = response.output[0].content[0].text.trim();
    res.json({ id: response.id, answer: text });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: err.message });
  }
});

/*─────────────────────────── TTS (gpt-4o-mini-tts) ───────────────────*/
app.post("/speech", async (req, res) => {
  try {
    const text = (req.body.text || "").trim();
    if (!text) return res.status(400).json({ error: "text is required" });
    const voice = req.body.voice || "shimmer";

    const audio = await openai.audio.speech.create({
      model : "gpt-4o-mini-tts",            // cheapest voice tier
      voice,
      input : text,
      format: "mp3"
    });

    const mp3 = Buffer.from(await audio.arrayBuffer()).toString("base64");
    res.json({ audio: mp3 });
  } catch (err) {
    console.error("TTS error:", err.response?.data || err);
    res.status(500).json({ error: err.message });
  }
});

/*──────────────── IMAGE GENERATION (GPT-image-1 · MEDIUM) ─────────────*/
app.post("/image", async (req, res) => {
  try {
    const { sessionId = "anon", prompt = "", style = "" } = req.body;
    const prev = sessions.get(sessionId);          // keeps character pose/style

    const img = await openai.images.generate({
      model  : "gpt-image-1",
      prompt : `${style ? `(${style}) ` : ""}${prompt}`.trim(),
      size   : "1024x1024",
      quality: "medium",                           // ★ requested tier
      n      : 1,
      ...(prev && { previous_response_id: prev }), // stylistic continuity
      response_format: "b64_json"                  // ensure Base-64 comes back
    });

    const frame = img.data[0];
    sessions.set(sessionId, frame.id);             // remember for next call
    res.json({ b64: frame.b64_json });
  } catch (err) {
    console.error("Image error:", err.response?.data || err);
    res.status(500).json({ error: err.message });
  }
});

/*─────────────────────── VISION (image / PDF) ────────────────────────*/
app.post("/vision", upload.single("file"), async (req, res) => {
  try {
    const mime = req.file?.mimetype || "";
    if (!mime) return res.status(400).json({ error: "file is required" });

    // ── Image ──
    if (mime.startsWith("image/")) {
      let buf = req.file.buffer;
      if (buf.length > 900_000) buf = await sharp(buf).resize({ width: 640 }).toBuffer();
      const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;

      const vis = await openai.responses.create({
        model : "gpt-4.1-nano",            // ★ cost‑optimised
        input : [{
          role   : "user",
          content: [
            { type: "input_text",  text: req.body.question || "Describe this image." },
            { type: "input_image", image_url: dataUrl }
          ]
        }]
      });
      return res.json({ content: vis.output[0].content[0].text.trim() });
    }

    // ── PDF ──
    if (mime === "application/pdf") {
      const textContent = (await pdf(req.file.buffer)).text.slice(0, 8000);
      const vis = await openai.responses.create({
        model : "gpt-4.1-nano",            // ★ cost‑optimised
        input : `Here is the extracted text from a PDF:\n\n${textContent}\n\nPlease summarise the document.`
      });
      return res.json({ content: vis.output[0].content[0].text.trim() });
    }

    res.status(415).json({ error: "Unsupported file type" });
  } catch (err) {
    console.error("Vision error:", err);
    res.status(500).json({ error: err.message });
  }
});

/*──────────────────────────── SEARCH ────────────────────────────────*/
app.post("/search", async (req, res) => {
  try {
    const query = (req.body.query || "").trim();
    if (!query) return res.status(400).json({ error: "query is required" });

    const resp = await openai.responses.create({
      model : "gpt-4.1-nano",              // ★ cheap model + tool
      input : `What's the result for: ${query}`,
      tools : [{ type: "web_search" }]
    });

    res.json({ answer: resp.output[0].content[0].text.trim() });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: err.message });
  }
});

/*────────────────────────── START SERVER ───────────────────────────*/
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅  API running → http://localhost:${PORT}`));

