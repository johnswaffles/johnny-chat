/*──────────────────────────────────────────────────────────────
  server.js (only /speech changed – everything else identical)
──────────────────────────────────────────────────────────────*/
require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const { OpenAI } = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app    = express();

app.use(cors());
app.use(express.json());

/*──────── CHAT – unchanged ───────*/
app.post("/chat", async (req,res)=>{
  try{
    const out = await openai.chat.completions.create({
      model:"gpt-4.1-nano",
      messages:req.body.messages,
      temperature:0.85
    });
    res.json({content:out.choices[0].message.content});
  }catch(e){ res.status(500).json({error:e.message}) }
});

/*──────── TEXT-TO-SPEECH – **fixed** ───────*/
app.post("/speech", async (req,res)=>{
  try{
    /* 1.  synchronous generation (no streaming helper) */
    const mp3 = await openai.audio.speech.create({
      model:"gpt-4o-mini-tts",
      voice:req.body.voice || "onyx",
      input:req.body.text,
      instructions:"Narrate clearly and engagingly",
      format:"mp3"               // explicit
    });

    /* 2.  turn ArrayBuffer → Buffer and send */
    const buf = Buffer.from(await mp3.arrayBuffer());
    res.set("Content-Type","audio/mpeg");
    res.send(buf);

  }catch(e){
    console.error("TTS error:",e);
    res.status(500).json({error:e.message});
  }
});

/*──────── start ───────*/
const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=>console.log(`API → http://localhost:${PORT}`));

