/*──────────────────────────────────────────────────────────────
  server.js  – chat, speech (TTS), image, “re-imagine”
  API root:  https://four-1-backend-api.onrender.com
──────────────────────────────────────────────────────────────*/
require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const multer  = require("multer");
const pdf     = require("pdf-parse");
const fs      = require("fs");
const sharp   = require("sharp");
const { OpenAI } = require("openai");

const openai  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app     = express();
const upload  = multer({ dest: "tmp/" });

app.use(cors());
app.use(express.json());

/*────────────────────────  CHAT  ─────────────────────────────*/
app.post("/chat", async (req,res)=>{
  try{
    const out = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: req.body.messages,
      temperature: 0.85
    });
    res.json({content: out.choices[0].message.content});
  }catch(err){
    console.error("Chat error:",err);
    res.status(500).json({error:err.message});
  }
});

/*───────────────  TEXT-TO-SPEECH  (gpt-4o-mini-tts) ──────────*/
app.post("/speech", async (req,res)=>{
  try{
    const stream = await openai.audio.speech.with_streaming_response.create({
      model: "gpt-4o-mini-tts",
      voice: req.body.voice || "onyx",
      input: req.body.text,
      instructions: "Narrate clearly and engagingly"
    });
    res.set("Content-Type","audio/mpeg");
    await stream.stream_to_http(res);
  }catch(err){
    console.error("TTS error:",err);
    res.status(500).json({error:err.message});
  }
});

/*────────  OPTIONAL IMAGE & VISION ENDPOINTS  (UNCHANGED) ────*/
/* … remove if you don’t need … */

/*──────────────────────────────────────────────────────────────*/
const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=>console.log(`API  →  http://localhost:${PORT}`));

