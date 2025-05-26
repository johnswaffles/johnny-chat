/*──────────────────────────────────────────────────────────────
  server.js  –  chat, speech, weather
──────────────────────────────────────────────────────────────*/
import 'dotenv/config.js';
import express from 'express';
import cors    from 'cors';
import fetch   from 'node-fetch';           // weather API
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app    = express();

app.use(cors());
app.use(express.json());

/* helper: format Open-Meteo data → brief string */
function makePodcastForecast(json, place) {
  const t = json.current.temperature_2m;            // °F (we ask for imperial)
  const desc = json.current.weather_code_text;      // e.g. "Overcast"
  const hi = Math.round(json.daily.temperature_2m_max[0]);
  const lo = Math.round(json.daily.temperature_2m_min[0]);

  return `Good morning from ${place}! Right now it's ${t}°F with ${desc.toLowerCase()}. 
Expect a high near ${hi} and a bedtime low around ${lo}. 
Whether you're conquering inboxes or the couch, keep sunglasses handy – the clouds are as indecisive as my last Tinder date.`;
}

/*── CHAT (with graceful fallback) ────────────────────────────*/
app.post('/chat', async (req, res) => {
  const messages = req.body.messages;
  try {
    const primary = await openai.chat.completions.create({
      model   : 'gpt-4o-mini-search-preview',
      messages,
      tools   : [ { type: 'web_search_preview' } ],
    });
    return res.json({ content: primary.choices[0].message.content });
  } catch (err) {
    console.warn('4o-mini-search failed → falling back:', err.message);
    try {
      const fallback = await openai.chat.completions.create({
        model   : 'o4-mini',
        messages,
      });
      return res.json({ content: fallback.choices[0].message.content });
    } catch (err2) {
      console.error('Chat error:', err2);
      return res.status(500).json({ error: err2.message });
    }
  }
});

/*── WEATHER (Open-Meteo, US only, °F) ────────────────────────*/
app.post('/weather', async (req, res) => {
  try {
    const { place, lat, lon } = req.body;      // front-end gives these
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&hourly=temperature_2m&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=auto`;
    const wx  = await fetch(url).then(r => r.json());
    const podcast = makePodcastForecast(wx, place);
    res.json({ podcast });
  } catch (e) {
    console.error('Weather error:', e);
    res.status(500).json({ error: 'Weather lookup failed' });
  }
});

/*── TEXT-TO-SPEECH ───────────────────────────────────────────*/
app.post('/speech', async (req, res) => {
  try {
    const voice = (req.body.voice || 'coral').toLowerCase();
    const mp3   = await openai.audio.speech.create({
      model : 'gpt-4o-mini-tts',
      voice,
      input : req.body.text,
      instructions: 'Clear, friendly podcast style.',
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
app.listen(PORT, () => console.log(`API running → http://localhost:${PORT}`));

