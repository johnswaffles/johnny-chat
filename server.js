/*──────────────────────────────────────────────────────────────
  server.js
  • Chat  :  o4-mini (OpenAI)
  • TTS   :  gpt-4o-mini-tts (OpenAI)
  • Image :  GPT-Image-1 (OpenAI - base64)
  • Vision:  GPT-4o-mini (OpenAI - images/PDFs)
  • Search:  gpt-4.1-mini with web_search_preview (OpenAI)
──────────────────────────────────────────────────────────────*/

require('dotenv').config();
const OpenAI  = require('openai');
const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const fs      = require('fs');
const sharp   = require('sharp');
const pdf     = require('pdf-parse');

// GoogleGenerativeAI is no longer needed
// const { GoogleGenerativeAI } = require("@google/generative-ai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app    = express();
const upload = multer({ dest: 'tmp/' });

app.use(cors());
app.use(express.json());

/*── CHAT (OpenAI) ────────────────────────────────────────────*/
app.post('/chat', async (req, res) => {
  try {
    const model = req.body.model || 'o4-mini';
    const out = await openai.chat.completions.create({
      model,
      messages: req.body.messages
    });
    res.json(out.choices[0].message);
  } catch (err) {
    console.error('Chat error:', err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/*── TTS (OpenAI) ─────────────────────────────────────────────*/
app.post('/speech', async (req, res) => {
  const textToSpeak = req.body.text;
  const selectedVoice = req.body.voice || 'shimmer'; // Get voice from request, default to 'shimmer'

  if (!textToSpeak) {
    return res.status(400).json({ error: 'No text provided for speech synthesis.' });
  }

  try {
    const audio = await openai.audio.speech.create({
      model:  'gpt-4o-mini-tts',
      voice:  selectedVoice, // Use the selected voice here
      input:  textToSpeak,
      // format: 'mp3' // 'format' is deprecated, use 'response_format'. Default is mp3.
      response_format: 'mp3' // Explicitly set response_format
    });
    res.set('Content-Type', 'audio/mpeg');
    // The response from audio.speech.create is a Response object.
    // To get the audio data as a Buffer, you need to access its body (a ReadableStream)
    // and then convert that stream to a Buffer.
    const audioBuffer = Buffer.from(await audio.arrayBuffer());
    res.send(audioBuffer);
  } catch (err) {
    console.error('TTS error:', err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/*── IMAGE (OpenAI GPT-Image-1) ────────────────────────────────*/
app.post("/image", async (req, res) => {
  try {
    const img = await openai.images.generate({
      model:  "gpt-image-1",
      prompt: req.body.prompt,
      size:   "1024x1024",
      n:      1
    });
    res.json({ image: img.data[0].b64_json });
  } catch (err) {
    console.error("Image error:", err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/*── VISION (OpenAI - images OR PDFs) ─────────────────────────*/
app.post('/vision', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded." });
    }
    const { path: tmp, mimetype, size } = req.file;

    if (mimetype.startsWith('image/')) {
      let buf = fs.readFileSync(tmp);
      if (size > 900_000) buf = await sharp(buf).resize({ width: 640 }).toBuffer();
      fs.unlink(tmp, (unlinkErr) => { if (unlinkErr) console.error("Error deleting temp image file:", unlinkErr);});
      const dataURL = `data:${mimetype};base64,${buf.toString('base64')}`;

      const out = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            { type: 'text',      text: 'Describe this image.' },
            { type: 'image_url', image_url: { url: dataURL } }
          ]
        }]
      });
      return res.json({ description: out.choices[0].message.content });
    }

    if (mimetype === 'application/pdf') {
      const data = fs.readFileSync(tmp);
      fs.unlink(tmp, (unlinkErr) => { if (unlinkErr) console.error("Error deleting temp PDF file:", unlinkErr);});
      const text = (await pdf(data)).text.slice(0, 8000);
      const out  = await openai.chat.completions.create({
        model: 'o4-mini',
        messages: [{
          role:'user',
          content:`Here is the extracted text from a PDF:\n\n${text}\n\nPlease summarize the document.`
        }]
      });
      return res.json({ description: out.choices[0].message.content });
    }

    fs.unlink(tmp, (unlinkErr) => { if (unlinkErr) console.error("Error deleting temp unsupported file:", unlinkErr);});
    res.status(415).json({ error: "Unsupported file type (image or PDF only)" });

  } catch (err) {
    console.error("Vision error:", err);
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlink(req.file.path, (unlinkErr) => { if (unlinkErr) console.error("Error deleting temp file on vision error:", unlinkErr);});
    }
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/*── WEB SEARCH (OpenAI - preview tool) ───────────────────────*/
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`API ready  →  http://localhost:${PORT}`));
