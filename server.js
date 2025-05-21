require('dotenv').config();
const OpenAI  = require('openai');
const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const fs      = require('fs');
const sharp   = require('sharp');
const pdf     = require('pdf-parse');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app = express();
const upload = multer({ dest: 'tmp/' });

app.use(cors());
app.use(express.json());

/*── CHAT ──────────────────────────────────────────*/
app.post('/chat', async (req, res) => {
  try {
    if (!Array.isArray(req.body.messages)) throw new Error('messages[] missing');
    const rsp = await openai.chat.completions.create({
      model: 'o4-mini',
      messages: req.body.messages,
      max_tokens: 800
    });
    res.json({ content: rsp.choices[0].message.content });
  } catch (e) {
    console.error('chat:', e.message);
    res.status(500).json({ error: e.message });
  }
});

/*── IMAGE (DALL·E 3) ──────────────────────────────*/
app.post('/image', async (req, res) => {
  try {
    if (!req.body.prompt) throw new Error('prompt missing');
    const rsp = await openai.images.generate({
      model:  'dall-e-3',
      prompt: req.body.prompt,
      size:   '1024x1024',
      n:      1,
      response_format: 'url'
    });
    res.json({ url: rsp.data[0].url });
  } catch (e) {
    console.error('image:', e.message);
    res.status(500).json({ error: e.message });
  }
});

/*── SPEECH (gpt-4o-mini-audio-preview, voice “verse”) ──*/
app.post('/speech', async (req, res) => {
  try {
    const text = req.body.text;
    if (!text) throw new Error('text missing');
    const audio = await openai.audio.speech.create({
      model: 'gpt-4o-mini-audio-preview',
      voice: 'verse',
      input: text,
      format: 'mp3'
    });
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(await audio.arrayBuffer()));
  } catch (e) {
    console.error('speech:', e.message);
    res.status(500).json({ error: e.message });
  }
});

/*── VISION (image & PDF) – unchanged, optional ─────*/
app.post('/vision', upload.single('file'), async (req, res) => { /* keep yours */ });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('API on', PORT));

