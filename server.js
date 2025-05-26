/*──────────────────────────────────────────────────────────────
  server.js   –   two routes
    • POST /chat   → GPT-4o-mini-search-preview  (web-enabled)
    • POST /speech → GPT-4o-mini-tts            (MP3 stream)
──────────────────────────────────────────────────────────────*/
import 'dotenv/config.js';
import express  from 'express';
import cors     from 'cors';
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app    = express();

app.use(cors());
app.use(express.json());

/*── CHAT ─────────────────────────────────────────────────────*/
app.post('/chat', async (req, res) => {
  try {
    const out = await openai.chat.completions.create({
      model   : 'gpt-4o-mini-search-preview',
      messages: req.body.messages,
      tools   : [ { type: 'web_search_preview' } ]   // keep web access
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
    // voice sent from the client (defaults to "coral")
    const voice = (req.body.voice || 'coral').toLowerCase();
    const mp3   = await openai.audio.speech.create({
      model : 'gpt-4o-mini-tts',
      voice,
      input : req.body.text,
      // optional: tweak tone
      instructions: 'Speak in a clear, friendly podcast style.'
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(await mp3.arrayBuffer()));
  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ error: err.message });
  }
});

/*── START ───────────────────────────────────────────────────*/
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API ready  →  http://localhost:${PORT}`));

