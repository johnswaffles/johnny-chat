/*  server.js  –  GPT-4o mini chat, “shimmer” TTS, DALL·E-3 HD images, Vision  */
require('dotenv').config();
const OpenAI  = require('openai');
const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const fs      = require('fs');
const sharp   = require('sharp');          // › npm i sharp

const app    = express();
const upload = multer({ dest: 'tmp/' });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

/* ── Chat ───────────────────────────────────────────────────── */
app.post('/chat', async (req, res) => {
  try {
    const out = await openai.chat.completions.create({
      model: 'gpt-4o-mini-search-preview',
      messages: req.body.messages
    });
    res.json(out.choices[0].message);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Text-to-Speech  (GPT-4o-mini-tts, shimmer) ────────────── */
app.post('/speech', async (req, res) => {
  try {
    const audio = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: 'shimmer',
      input: req.body.text,
      format: 'mp3'
    });
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(await audio.arrayBuffer()));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Image  (DALL·E 3, HD quality → returns URL) ───────────── */
app.post('/image', async (req, res) => {
  try {
    const img = await openai.images.generate({
      model:   'dall-e-3',                 // newest image model
      prompt:  req.body.prompt,
      style:   'natural',                  // ‘vivid’ is punchier
      quality: 'hd',                       // crisper text & detail  :contentReference[oaicite:1]{index=1}
      n: 1,
      response_format: 'url'               // avoids base-64 corruption
    });
    res.json({ url: img.data[0].url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Vision  (describe uploaded picture) ───────────────────── */
app.post('/vision', upload.single('file'), async (req, res) => {
  try {
    const { path: tmp, mimetype, size } = req.file;
    let buf = fs.readFileSync(tmp);
    if (size > 900_000) buf = await sharp(buf).resize({ width: 640 }).toBuffer();
    fs.unlink(tmp, () => {});
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
    res.json({ description: out.choices[0].message.content });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Start ─────────────────────────────────────────────────── */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API ready at http://localhost:${PORT}`));

