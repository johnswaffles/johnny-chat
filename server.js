/*──────────────────────────────────────────────────────────────
  Unified API – v4.1-nano  (chat · TTS · image · vision · search)
  • Chat    : o4-mini  (text + vision)
  • TTS     : gpt-4o-mini-tts  “alloy”            → base-64 mp3
  • Image   : gpt-image-1  (data-URL return, style aware)
  • Vision  : images → vision;  PDFs → pdf-parse → summary
  • Search  : o4-mini with web_search_preview = true
──────────────────────────────────────────────────────────────*/

require('dotenv').config();
const OpenAI  = require('openai');
const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const sharp   = require('sharp');
const pdf     = require('pdf-parse');          //  npm i pdf-parse

const openai = new OpenAI({apiKey:process.env.OPENAI_API_KEY});
const app    = express();

/*───────── middleware ───────────────────────────────────────*/
app.use(cors());
app.use(express.json());

/*── upload (memory) – 12 MB cap, png/jpg/gif/webp/pdf ───────*/
const upload = multer({
  storage: multer.memoryStorage(),
  limits : {fileSize:12*1024*1024},
  fileFilter:(req,file,cb)=>{
    if(file.mimetype.startsWith('image/')||file.mimetype==='application/pdf') cb(null,true);
    else cb(new Error('INVALID_MIME_TYPE: only images & PDFs'));
  }
});

/*── CHAT ─────────────────────────────────────────────────────*/
app.post('/chat', async (req,res)=>{
  try{
    const out = await openai.chat.completions.create({
      model:'o4-mini',
      messages:req.body.messages,
      max_tokens:768
    });
    res.json(out.choices[0].message);
  }catch(err){
    console.error('Chat error:',err);
    res.status(500).json({error:err.message});
  }
});

/*── TTS (base-64 mp3) ────────────────────────────────────────*/
app.post('/speech', async (req,res)=>{
  try{
    const audio = await openai.audio.speech.create({
      model :'gpt-4o-mini-tts',
      voice :'alloy',
      input :req.body.text,
      format:'mp3'
    });
    res.json({audio:Buffer.from(await audio.arrayBuffer()).toString('base64')});
  }catch(err){
    console.error('TTS error:',err);
    res.status(500).json({error:err.message});
  }
});

/*── IMAGE  (gpt-image-1  → base-64 PNG) ─────────────────────*/
const sessions=new Map();                      // keep id for stylistic consistency
app.post('/image', async (req,res)=>{
  try{
    const {sessionId,prompt,style=''} = req.body;
    const previous = sessions.get(sessionId)||null;

    const result = await openai.images.generate({
      model :'gpt-image-1',
      prompt:`Illustration (${style}) ${prompt}`,
      ...(previous && {previous_response_id:previous}),
      size :'1024x1024',
      n    :1
    });
    const img = result.data[0];
    sessions.set(sessionId,img.id);
    res.json({b64:img.b64_json});
  }catch(err){
    console.error('Image error:',err);
    res.status(500).json({error:err.message});
  }
});

/*── VISION – images OR PDFs ─────────────────────────────────*/
app.post('/vision', upload.single('file'), async (req,res)=>{
  try{
    if(!req.file) return res.status(400).json({error:'No file uploaded'});
    const mime = req.file.mimetype;

    /*— images —*/
    if(mime.startsWith('image/')){
      let buf=req.file.buffer;
      if(buf.length>900_000) buf = await sharp(buf).resize({width:640}).toBuffer();
      const dataUrl=`data:${mime};base64,${buf.toString('base64')}`;

      const out = await openai.chat.completions.create({
        model:'gpt-4o-mini',
        messages:[{
          role:'user',
          content:[
            {type:'text',text:req.body.question||'Describe this image.'},
            {type:'image_url',image_url:{url:dataUrl}}
          ]
        }],
        max_tokens:512
      });
      return res.json({content:out.choices[0].message.content.trim()});
    }

    /*— PDFs —*/
    if(mime==='application/pdf'){
      const pdfText = (await pdf(req.file.buffer)).text.slice(0,8000);
      const out = await openai.chat.completions.create({
        model:'o4-mini',
        messages:[{
          role:'user',
          content:`Here is the extracted text from a PDF:\n\n${pdfText}\n\nPlease summarize the document in plain English.`
        }],
        max_tokens:512
      });
      return res.json({content:out.choices[0].message.content.trim()});
    }

    res.status(415).json({error:'Unsupported file type'});
  }catch(err){
    console.error('Vision error:',err);
    if(err.message.startsWith('INVALID_MIME_TYPE')||err.code==='LIMIT_FILE_SIZE')
      return res.status(400).json({error:err.message});
    res.status(500).json({error:err.message});
  }
});

/*── SEARCH (OpenAI preview tool) ────────────────────────────*/
app.post('/search', async (req,res)=>{
  try{
    const {query}=req.body;
    const out = await openai.chat.completions.create({
      model:'o4-mini',
      tools:[{type:'web_search'}],
      messages:[
        {role:'user',content:`Search the web for: ${query}`},
        {role:'tool',name:'web_search',content:`query="${query}"`}
      ],
      max_tokens:512
    });
    res.json(out.choices[0].message);
  }catch(err){
    console.error('Search error:',err);
    res.status(500).json({error:err.message});
  }
});

/*── start server ────────────────────────────────────────────*/
const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log(`API running  http://localhost:${PORT}`));

