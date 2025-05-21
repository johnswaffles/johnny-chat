/*──────────────────────────────────────────────────────────────
  server.js  –  3 routes + realtime preview
  • Chat  :  o4-mini   (or any model passed from the client)
  • TTS   :  GPT-4o-mini-tts  “shimmer”
  • Image :  DALL·E 3  (URL)
  • Vision:  ⤷  images  → GPT vision
             ⤷  PDFs    → text-extract (pdf-parse) → GPT text answer
──────────────────────────────────────────────────────────────*/

require('dotenv').config();
const OpenAI  = require('openai');
const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const fs      = require('fs');
const sharp   = require('sharp');
const pdf     = require('pdf-parse');               //  npm i pdf-parse

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app    = express();
const upload = multer({ dest: 'tmp/' });

app.use(cors());
app.use(express.json());

/*── CHAT ─────────────────────────────────────────────────────*/
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
    res.status(500).json({ error: err.message });
  }
});

/*── TTS ──────────────────────────────────────────────────────*/
app.post('/speech', async (req, res) => {
  try {
    const audio = await openai.audio.speech.create({
      model:  'gpt-4o-mini-tts',
      voice:  'shimmer',
      input:  req.body.text,
      format: 'mp3'
    });
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(await audio.arrayBuffer()));
  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ error: err.message });
  }
});

/*── IMAGE (DALL·E 3) ─────────────────────────────────────────*/
app.post('/image', async (req, res) => {
  try {
    const img = await openai.images.generate({
      model:  'dall-e-3',
      prompt: req.body.prompt,
      size:   '1024x1024',
      style:  'natural',
      n:      1,
      response_format: 'url'
    });
    res.json({ url: img.data[0].url });
  } catch (err) {
    console.error('Image error:', err);
    res.status(500).json({ error: err.message });
  }
});

/*── VISION  (images  OR  PDFs) ───────────────────────────────*/
app.post('/vision', upload.single('file'), async (req, res) => {
  try {
    const { path: tmp, mimetype, size } = req.file;

    /* ---------- IMAGES ----------*/
    if (mimetype.startsWith('image/')) {
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
      return res.json({ description: out.choices[0].message.content });
    }

    /* ---------- PDFs ----------*/
    if (mimetype === 'application/pdf') {
      const data = fs.readFileSync(tmp); fs.unlink(tmp, () => {});
      const text = (await pdf(data)).text.slice(0, 8000);     //   trim to ~2-3K tokens
      const out  = await openai.chat.completions.create({
        model: 'o4-mini',
        messages: [{
          role:'user',
          content:`Here is the extracted text from a PDF:\n\n${text}\n\nPlease summarize the document.`
        }]
      });
      return res.json({ description: out.choices[0].message.content });
    }

    /* all other types */
    fs.unlink(tmp, () => {});
    res.status(415).json({ error: 'Unsupported file type (image or PDF only)' });

  } catch (err) {
    console.error('Vision error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`API running  http://localhost:${PORT}`));

