/*──────────────────────────────────────────────────────────────
  server.js  –  4 routes: chat, speech, image (GPT Image 1), vision(upload/PDF), search
──────────────────────────────────────────────────────────────*/

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const fs      = require('fs');
const sharp   = require('sharp');
const pdf     = require('pdf-parse');
const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app    = express();
const upload = multer({ dest: 'tmp/' });

app.use(cors());
app.use(express.json());

/*── CHAT ─────────────────────────────────────────────────────*/
app.post('/chat', async (req, res) => {
  try {
    const out = await openai.chat.completions.create({
      model:    'o4-mini',
      messages: req.body.messages
    });
    res.json({ content: out.choices[0].message.content });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

/*── TEXT-TO-SPEECH ───────────────────────────────────────────*/
app.post('/speech', async (req, res) => {
  try {
    const stream = await openai.audio.speech.with_streaming_response.create({
      model:        'gpt-4o-mini-tts',
      voice:        'verse',
      input:        req.body.text,
      instructions: 'Respond in a clear, neutral tone.'
    });

    res.setHeader('Content-Type','audio/mpeg');
    await stream.stream_to_http(res);
  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ error: err.message });
  }
});

/*── IMAGE (GPT Image 1) ───────────────────────────────────────*/
app.post('/image', async (req, res) => {
  try {
    const result = await openai.images.generate({
      model:           'gpt-image-1',
      prompt:          req.body.prompt,
      size:            '1024x1024',
      n:               1,
      response_format: 'b64_json'
    });
    const b64 = result.data[0].b64_json;
    res.json({ image: b64 });
  } catch (err) {
    console.error('Image error:', err);
    res.status(500).json({ error: err.message });
  }
});

/*── VISION (image OR PDF upload) ────────────────────────────*/
app.post('/vision', upload.single('file'), async (req, res) => {
  try {
    const { path: tmp, mimetype, size } = req.file;
    const data = fs.readFileSync(tmp);
    fs.unlinkSync(tmp);

    if (mimetype.startsWith('image/')) {
      let buf = data;
      if (size > 900_000) buf = await sharp(buf).resize({ width:640 }).toBuffer();
      const dataURL = `data:${mimetype};base64,${buf.toString('base64')}`;
      const out = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role:    'user',
          content: [
            { type:'text',      text:'Describe this image.' },
            { type:'image_url', image_url:{ url:dataURL } }
          ]
        }]
      });
      return res.json({ description: out.choices[0].message.content });
    }

    if (mimetype === 'application/pdf') {
      const text = (await pdf(data)).text.slice(0,8000);
      const out  = await openai.chat.completions.create({
        model:'o4-mini',
        messages:[{
          role:'user',
          content:`Extracted PDF text:\n\n${text}\n\nPlease summarize.`
        }]
      });
      return res.json({ description: out.choices[0].message.content });
    }

    res.status(415).json({ error:'Only images or PDFs supported' });
  } catch (err) {
    console.error('Vision error:', err);
    res.status(500).json({ error: err.message });
  }
});

/*── WEB SEARCH ──────────────────────────────────────────────*/
app.post('/search', async (req, res) => {
  try {
    const out = await openai.responses.create({
      model:     'gpt-4.1-mini',
      tools:     [{ type:'web_search_preview' }],
      input:     req.body.query,
      tool_choice: { type:'web_search_preview' }
    });
    res.json({ result: out.output_text });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`API ready → http://localhost:${PORT}`));

