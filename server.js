/*────────────────────────────────────────────────────────────────
  server.js  (v-04-image-search-vision)
  • Chat ............. o4-mini  (text only)
  • Speech ........... gpt-4o-mini-tts  voice "verse"
  • Image ............ gpt-image-1     (base-64)
  • Vision (img/PDF).. gpt-4o-mini     ⇄ sharp ⧸ pdf-parse
  • Web search ....... gpt-4-1-mini + tool: web_search_preview
────────────────────────────────────────────────────────────────*/
require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const multer  = require("multer");
const sharp   = require("sharp");
const pdf     = require("pdf-parse");
const OpenAI  = require("openai");

const openai  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app     = express();
const upload  = multer({ dest: "tmp/" });

app.use(cors());
app.use(express.json());

/*──────────── Chat (text) */
app.post("/chat", async (req, res) => {
  try{
    const out = await openai.chat.completions.create({
      model: req.body.model || "gpt-4o-mini",
      messages: req.body.messages
    });
    res.json(out.choices[0].message);
  }catch(e){res.status(500).json({error:e.message});}
});

/*──────────── Text-to-speech */
app.post("/speech", async (req, res) => {
  try{
    const audio = await openai.audio.speech.create({
      model :"gpt-4o-mini-tts",
      voice :"verse",
      input : req.body.text,
      format: "mp3"
    });
    res.type("audio/mpeg").send(Buffer.from(await audio.arrayBuffer()));
  }catch(e){res.status(500).json({error:e.message});}
});

/*──────────── Image (gpt-image-1) */
app.post("/image", async (req,res)=>{
  try{
    const img = await openai.images.generate({
      model : "gpt-image-1",
      prompt: req.body.prompt,
      n     : 1,
      size  : "1024x1024"
    });
    res.json({data: img.data[0].b64_json});          // base-64 → front-end
  }catch(e){res.status(500).json({error:e.message});}
});

/*──────────── Web search (preview tool) */
app.post("/search", async (req,res)=>{
  try{
    const out = await openai.chat.completions.create({
      model : "gpt-4-1-mini",
      tools : [{type:"web_search_preview"}],
      messages:[{role:"user",content:req.body.query}]
    });
    res.json({answer: out.choices[0].message.content});
  }catch(e){res.status(500).json({error:e.message});}
});

/*──────────── Vision (image / PDF) */
app.post("/vision", upload.single("file"), async (req,res)=>{
  try{
    const {path,tmp,mimetype,size} = req.file;
    /* image */
    if(mimetype.startsWith("image/")){
      let buf = require("fs").readFileSync(path);
      if(size>900_000) buf = await sharp(buf).resize({width:640}).toBuffer();
      const dataURL = `data:${mimetype};base64,${buf.toString("base64")}`;
      const gpt = await openai.chat.completions.create({
        model:"gpt-4o-mini",
        messages:[{
          role:"user",
          content:[
            {type:"text",text:"Describe this image."},
            {type:"image_url",image_url:{url:dataURL}}
          ]
        }]
      });
      return res.json({description:gpt.choices[0].message.content});
    }
    /* PDF */
    if(mimetype==="application/pdf"){
      const text = (await pdf(require("fs").readFileSync(path))).text.slice(0,8000);
      const gpt  = await openai.chat.completions.create({
        model:"gpt-4o-mini",
        messages:[{role:"user",content:`Summarise this PDF:\n\n${text}`}]
      });
      return res.json({description:gpt.choices[0].message.content});
    }
    res.status(415).json({error:"Unsupported file type"});
  }catch(e){res.status(500).json({error:e.message});}
});

const PORT= process.env.PORT||10000;
app.listen(PORT, ()=>console.log("API ready  →  http://localhost:"+PORT));

