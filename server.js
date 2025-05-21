require('dotenv').config();
const OpenAI  = require('openai');
const express = require('express');
const cors    = require('cors');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app    = express();

app.use(cors());
app.use(express.json());

/*── CHAT ───────────────────────────────*/
app.post('/chat', async (req, res) => {
  try {
    const out = await openai.chat.completions.create({
      model: "o4-mini",
      messages: req.body.messages
    });
    res.json(out.choices[0].message);
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

/*── TTS: Use the new audio-preview model ──*/
app.post('/speech', async (req, res) => {
  try {
    const audio = await openai.audio.speech.create({
      model:  'gpt-4o-mini-audio-preview-2024-12-17', // NEW TTS MODEL
      voice:  req.body.voice || 'verse',               // 'verse' or other available voices
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`API running  http://localhost:${PORT}`));

