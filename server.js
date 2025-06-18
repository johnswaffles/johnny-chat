// server.js  (ES-module style)
import express from 'express';
import cors     from 'cors';
import 'dotenv/config';
import OpenAI   from 'openai';

const app  = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

// ---------- /chat -----------------------------------------------------------
app.post('/chat', async (req, res) => {
  try {
    const { messages = [] } = req.body;             // expecting [{role, content}, ...]
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages
    });
    res.json({ content: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- /image ----------------------------------------------------------
app.post('/image', async (req, res) => {
  try {
    const { prompt = '', size = '1024x1024' } = req.body;
    const img = await openai.images.generate({
      model : 'gpt-image-1',
      prompt,
      size
    });
    // frontend expects { b64: ... }
    res.json({ b64: img.data[0].b64_json });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- /speech ---------------------------------------------------------
app.post('/speech', async (req, res) => {
  try {
    const { text = '', voice = 'shimmer' } = req.body;
    const speech = await openai.audio.speech.create({
      model  : 'tts-1',          // high-quality model
      voice,
      format : 'mp3',
      input  : text
    });
    const buffer = Buffer.from(await speech.arrayBuffer());
    res.json({ audio: buffer.toString('base64') });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ API ready on :${PORT}`));
