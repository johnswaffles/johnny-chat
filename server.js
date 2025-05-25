/*──────────────────────────────────────────────────────────────
  server.js
  • Chat  :  gpt-4.1-nano (OpenAI) - Default
  • TTS   :  gpt-4o-mini-tts (OpenAI) - Selectable voice
  • Image :  DALL·E 3 (OpenAI - b64_json)
  • Vision:  gpt-4.1-nano (OpenAI - images/PDFs with user_query)
  • Search:  gpt-4.1-nano (OpenAI - simulated tool call for web search)
──────────────────────────────────────────────────────────────*/

require('dotenv').config();
const OpenAI  = require('openai');
const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const fs      = require('fs');
const sharp   = require('sharp');
const pdf     = require('pdf-parse');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app = express();
const upload = multer({ dest: 'tmp/' });

const UNIVERSAL_CHATBOT_PERSONA_BACKEND = "You are a helpful and approachable AI assistant. You have a friendly and slightly humorous personality. Please keep your responses conversational. Do not refer to yourself by any specific name.";

app.use(cors());
app.use(express.json());

/*── CHAT (OpenAI) ────────────────────────────────────────────*/
app.post('/chat', async (req, res) => {
  try {
    const model = req.body.model || 'gpt-4.1-nano'; 
    const messages = req.body.messages;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        console.error("Chat Error: Bad request - messages missing or not an array.");
        return res.status(400).json({ error: "Messages are required and must be an array." });
    }
    
    let finalMessages = [...messages];
    if (finalMessages.length > 0 && finalMessages[0].role !== 'system') {
        finalMessages.unshift({ role: 'system', content: UNIVERSAL_CHATBOT_PERSONA_BACKEND });
    } else if (finalMessages.length === 0) {
         finalMessages.push({ role: 'system', content: UNIVERSAL_CHATBOT_PERSONA_BACKEND });
         // Add a dummy user message if only system message, though frontend should prevent this
         finalMessages.push({ role: 'user', content: "Hello" });
    }


    console.log(`Chat request to model: ${model} with messages count: ${finalMessages.length}`);
    // console.log(`Chat request messages:`, JSON.stringify(finalMessages, null, 2));


    const out = await openai.chat.completions.create({
      model,
      messages: finalMessages
    });

    if (!out.choices || out.choices.length === 0 || !out.choices[0].message) {
        console.error("Chat Error: OpenAI response missing choices or message.", JSON.stringify(out, null, 2));
        return res.status(500).json({ error: "Invalid response structure from OpenAI for chat." });
    }
    
    console.log("Chat success. OpenAI response choice:", JSON.stringify(out.choices[0], null, 2));
    res.json(out.choices[0].message);

  } catch (err) {
    console.error('Chat API Error Full:', err);
    let errorMsg = "An unexpected error occurred in chat.";
    let statusCode = 500;
    if (err.response) { 
        errorMsg = err.response.data?.error?.message || err.message || "OpenAI API error";
        statusCode = err.response.status || 500;
        console.error('OpenAI Error Response (Chat):', { status: statusCode, data: err.response.data });
    } else if (err.status) { 
        errorMsg = err.error?.message || err.message || "OpenAI API processing error";
        statusCode = err.status;
         console.error('OpenAI SDK Error (Chat):', { status: statusCode, error: err.error });
    } else {
        errorMsg = err.message || errorMsg;
    }
    res.status(statusCode).json({ error: errorMsg });
  }
});

/*── IMAGE  (GPT-Image-1) ────────────────────────────────────────────*/
app.post("/image", async (req, res) => {
  try {
    const img = await openai.images.generate({
      model : "gpt-image-1",
      prompt: req.body.prompt,
      size  : "1024x1024",   // supported: 1024x1024 | 1024x1536 | 1536x1024 | "auto"
      n     : 1
    });
    res.json({ image: img.data[0].b64_json });
  } catch (err) {
    console.error("Image error:", err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/*── TTS (OpenAI) ─────────────────────────────────────────────*/
app.post('/speech', async (req, res) => {
  const textToSpeak = req.body.text;
  const selectedVoice = req.body.voice || 'shimmer';
  if (!textToSpeak) return res.status(400).json({ error: 'No text provided.' });
  try {
    const audio = await openai.audio.speech.create({ model: 'gpt-4o-mini-tts', voice: selectedVoice, input: textToSpeak, response_format: 'mp3' });
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(await audio.arrayBuffer()));
  } catch (err) {
    console.error('TTS API Error Full:', err);
    let errorMsg = "An unexpected error occurred in TTS.";
    let statusCode = 500;
    if (err.response) { errorMsg = err.response.data?.error?.message || err.message; statusCode = err.response.status || 500; } 
    else if (err.status) { errorMsg = err.error?.message || err.message; statusCode = err.status; }
    else { errorMsg = err.message || errorMsg; }
    res.status(statusCode).json({ error: errorMsg });
  }
});


/*── VISION (OpenAI) ───────────────────────────────────────────────*/
app.post("/vision", upload.single("file"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "No file uploaded." });

    const { path: tmp, mimetype, size } = req.file;
    const userQuery     = req.body.user_query?.trim();
    const systemMessage = { role: "system", content: UNIVERSAL_CHATBOT_PERSONA_BACKEND };
    const messages      = [ systemMessage ];
    const model         = "gpt-4o-mini";              // fast + vision

    /*-------  IMAGES  --------*/
    if (mimetype.startsWith("image/")) {
      let buf = fs.readFileSync(tmp);
      if (size > 2_000_000)                        // > 2 MB → shrink
        buf = await sharp(buf)
               .resize({ width: 768, withoutEnlargement: true })
               .toBuffer();

      fs.unlink(tmp, () => {});
      const dataURL = `data:${mimetype};base64,${buf.toString("base64")}`;

      messages.push({
        role: "user",
        content: [
          { type: "text",
            text: userQuery || "Describe this image." },
          { type: "image_url",
            image_url: { url: dataURL, detail: "low" } }   // << LOW detail
        ]
      });
    }

    /*-------  PDFs  --------*/
    else if (mimetype === "application/pdf") {
      const data = fs.readFileSync(tmp); fs.unlink(tmp, () => {});
      const raw  = (await pdf(data)).text.slice(0, 16_000);  // ≈ 2 k tokens
      const prompt = userQuery
        ? `Based **only** on this PDF text, answer: «${userQuery}»\n\n${raw}`
        : `Please summarise this PDF:\n\n${raw}`;

      messages.push({ role: "user", content: prompt });
    }

    /*-------  Unsupported  --------*/
    else {
      fs.unlink(tmp, () => {});
      return res.status(415).json({ error: "Unsupported file type." });
    }

    /*---  Call the model  ---*/
    const out = await openai.chat.completions.create({
      model,
      messages,
      max_tokens: 300,        // smaller completion budget
      temperature: 0.5
    });

    if (!out.choices?.length)
      throw new Error("No content returned from vision model.");

    res.json({ description: out.choices[0].message.content });

  } catch (err) {
    console.error("Vision error:", err);
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/* ───── basic setup ───── */
import express from "express";
import cors    from "cors";
import OpenAI  from "openai";

const app     = express();
const openai  = new OpenAI({ apiKey : process.env.OPENAI_API_KEY });
const PORT    = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({limit:"10mb"}));

/* ───── UNIVERSAL CHATBOT persona (reuse yours) ─── */
const UNIVERSAL_CHATBOT_PERSONA_BACKEND =
  "You are a helpful assistant that formats answers clearly and conversationally.";

/* ───────── search ───────── */
app.post("/search", async (req,res)=>{
  const q=req.body.query;
  if(!q) return res.status(400).json({error:"Missing query"});
  try{
    const raw=await openai.chat.completions.create({
      model      :"gpt-4o-mini-search-preview",
      tools      :[{type:"web_search_preview"}],
      tool_choice:{type:"web_search_preview"},
      messages   :[{role:"user",content:q}]
    });
    const snippets=raw.choices[0].message.content;
    const formatted=await openai.chat.completions.create({
      model:"gpt-4o-mini-audio-preview",
      messages:[
        {role:"system",content:`${SYS} Summarize upbeat in ≤170 words.`},
        {role:"user",content:snippets}
      ],
      max_tokens:250
    });
    res.json({result:formatted.choices[0].message.content});
  }catch(e){console.error(e);res.status(e.status||500).json({error:e.message});}
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`API running on http://localhost:${PORT}`));
