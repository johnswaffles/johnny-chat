// server.js (CommonJS)

const express = require("express");
const cors    = require("cors");
require("dotenv").config();
const { OpenAI } = require("openai");
const multer = require('multer'); // Added multer require

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app    = express();

app.use(cors());
// Increased limit slightly for vision route, ensure it's enough for your expected base64 payloads
app.use(express.json({ limit: "15mb" })); 
// urlencoded limit is less critical unless you send very large form data via urlencoding
app.use(express.urlencoded({ limit: '15mb', extended: true }));


// — Chat endpoint —
app.post("/chat", async (req, res) => {
  try {
    const { history } = req.body; // Assuming history is your messages array
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: history, // Pass history (messages array) directly
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch (e) {
    console.error("Chat error:", e.message, e.response?.data); // Added more error logging
    res.status(500).json({ error: e.message });
  }
});

// — Text‑to‑Speech endpoint —
app.get("/speech", async (req, res) => {
  try {
    const q = req.query.q?.toString() || "";
    if (!q) {
        return res.status(400).send("TTS error: Input query 'q' is missing or empty.");
    }
    const mp3 = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts", // This seems like a custom or incorrect model name for TTS. Standard is "tts-1" or "tts-1-hd"
      voice: "coral", // Ensure "coral" is a valid voice for the model
      input: q.slice(0, 4000),
      // format: "mp3", // format is often inferred or not needed for this API client version
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.set({ "Content-Type": "audio/mpeg" }).send(buffer);
  } catch (e) {
    console.error("TTS error:", e.message, e.response?.data); // Added more error logging
    res.status(500).send("TTS error: " + e.message);
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

/* ────────────────────────────────────────────────
   VISION  – analyse / describe an image or PDF
   POST  /vision
   ─────────────────────────────────────────────── */
// Multer configuration specific for the /vision route
const visionUpload = multer({
  limits: { fileSize: 12 * 1024 * 1024 }, // 12 MB cap
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('INVALID_MIME_TYPE: Only images (PNG, JPG, GIF, WEBP) and PDF files are supported.'), false);
    }
  }
});
    
app.post('/vision', visionUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
        return res.status(400).json({ error: 'No file was uploaded.' });
    }
    let { question = 'Describe this item in detail. If it is a document, please summarize its content.' } = req.body || {};
    const mime = req.file.mimetype;
    const base64 = req.file.buffer.toString('base64');
    const dataUrl = `data:${mime};base64,${base64}`;
      
    const itemContent = { type: 'image_url', image_url: { url: dataUrl } };
    const messages = [ { role: 'user', content: [ { type: 'text', text: question }, itemContent ] } ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // This model supports vision/PDFs via data URI
      messages,
      max_tokens: 768 
    });
    
    const answer = completion.choices?.[0]?.message?.content?.trim() || '(The AI did not provide a description or summary.)';
    res.json({ content: answer }); // Ensure frontend expects { content: ... }
      
  } catch (err) {
    console.error('Error in /vision endpoint:', err.message, err.stack, err.response?.data);
    if (err.message && err.message.startsWith('INVALID_MIME_TYPE')) {
        return res.status(400).json({ error: err.message });
    }
    if (err.code === 'LIMIT_FILE_SIZE') { // Multer error code
      return res.status(413).json({ error: 'File larger than 12 MB – please upload a smaller file.' });
    }
    if (err.response && err.response.data && err.response.data.error) { // OpenAI API error
        console.error('OpenAI API Error details:', err.response.data.error);
        return res.status(err.response.status || 500).json({ error: `AI Error: ${err.response.data.error.message}` });
    }
    res.status(500).json({ error: err.message || 'An internal error occurred in the vision service.' });
  }
});


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`API listening on ${PORT}`));
