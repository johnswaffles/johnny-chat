import 'dotenv/config';                 // loads .env
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app = express();
app.use(cors());
app.use(express.json());

/* ------------ /chat ------------- */
app.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;               // [{role:"user",content:"..."}...]
    if (!Array.isArray(messages)) throw Error('messages must be an array');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',                     // cheapest 4-series model
      messages,
    });

    res.json({ content: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

/* ------------ /image ------------- */
app.post('/image', async (req, res) => {
  try {
    const { prompt, size = '1024x1024', quality = 'high' } = req.body;

    const img = await openai.images.generate({
      model: 'gpt-image-1',
      prompt,
      size,
      quality,
    });

    res.json({ b64: img.data[0].b64_json });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

/* ------------ /speech (TTS) ------ */
app.post('/speech', async (req, res) => {
  try {
    const { text, voice = 'alloy' } = req.body;

    const audio = await openai.audio.speech.create({
      model: 'tts-1',                // cheapest TTS
      voice,
      input: text,
      format: 'mp3',
    });

    res.json({ audio: audio.audio });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

/* ------------ start server ------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅  API ready on :${PORT}`));
