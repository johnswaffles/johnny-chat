/*──────────────────────────────────────────────────────────────
  server.js – chat  +  text-to-speech
  • Chat model :  o4-mini
  • TTS model  :  gpt-4o-mini-tts  (11 built-in voices)
──────────────────────────────────────────────────────────────*/
import 'dotenv/config';
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
      model:    'o4-mini',
      messages: req.body.messages            // [{role,content}, …]
    });
    res.json(out.choices[0].message);
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

/*── TEXT-TO-SPEECH ───────────────────────────────────────────*/
app.post('/speech', async (req, res) => {
  try {
    const { text, voice='onyx' } = req.body;          // voice sent from front-end
    const mp3  = await openai.audio.speech.create({
      model:  'gpt-4o-mini-tts',
      voice,
      input:  text,
      format: 'mp3'
    });
    res.set('Content-Type','audio/mpeg');
    res.send(Buffer.from(await mp3.arrayBuffer()));
  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ error: err.message });
  }
});

/*── listen ───────────────────────────────────────────────────*/
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('API running on', PORT));

