/*──────────────────────────────────────────────────────────────
  Story-bot API
  ─ /chat     : generate the next story paragraph (GPT-4o-mini)
  ─ /speech   : MP3 narration of any text (gpt-4o-mini-tts)
  ─ /image    : GPT-Image-1 illustration, with character-lock
──────────────────────────────────────────────────────────────*/
require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const { OpenAI } = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app    = express();
app.use(cors());
app.use(express.json());

/*── CHAT ─────────────────────────────────────────────────────*/
app.post("/chat", async (req, res) => {
  try {
    const out = await openai.chat.completions.create({
      model:        "gpt-4.1-nano",
      temperature:  0.85,
      messages:     req.body.messages
    });
    res.json({ content: out.choices[0].message.content });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ─── IMAGE  (GPT-Image-1, low quality) ─────── */
app.post('/image', async (req,res)=>{
  try{
    const img=await openai.images.generate({
      model:'gpt-image-1',
      prompt:req.body.prompt,
      size:'1024x1024',
      quality:'low',               // ◀ ◀  lower-quality / faster
      n:1,
      response_format:'b64_json'
    });
    res.json({b64:img.data[0].b64_json});
  }catch(err){res.status(500).json({error:err.message})}
});

/*── TTS ──────────────────────────────────────────────────────*/
app.post("/speech", async (req, res) => {
  try {
    const mp3 = await openai.audio.speech.create({
      model:   "gpt-4o-mini-tts",
      voice:   req.body.voice || "onyx",
      input:   req.body.text,
      format:  "mp3",
      instructions:"Narrate clearly and engagingly"
    });
    const buf = Buffer.from(await mp3.arrayBuffer());
    res.set("Content-Type","audio/mpeg");
    res.send(buf);
  } catch (err) {
    console.error("TTS error:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=>console.log(`API → http://localhost:${PORT}`));

