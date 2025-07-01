# Johnny‑Chat 2025‑07‑01 refresh

Below are **two complete, copy‑pasteable files** that work together:

---

## ✨ `server.js` (Node 22 / Express 5)

```js
import express from "express";
import cors from "cors";
import multiparty from "multiparty";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Load .env vars (OPENAI_API_KEY, TEXT_MODEL, IMAGE_MODEL, VISION_MODEL, OPENAI_BETA)
dotenv.config();

const {
  OPENAI_API_KEY,
  TEXT_MODEL   = "o4-mini",
  IMAGE_MODEL  = "gpt-image-1",
  VISION_MODEL = "gpt-4-1-mini",
  OPENAI_BETA  = "assistants=v2"
} = process.env;

const app   = express();
const port  = process.env.PORT || 10_000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ----------  MIDDLEWARE  ---------- //
app.use(cors({
  origin: [
    "http://localhost:3000",                // dev
    "https://www.justaskjohnny.com",        // Squarespace site
  ],
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));

// ----------  HELPERS  ---------- //
async function openaiRequest(body) {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization   : `Bearer ${OPENAI_API_KEY}`,
      "OpenAI-Beta"   : OPENAI_BETA,
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

// ----------  ROUTES  ---------- //
// 1) Chat (text‑only)
app.post("/api/chat", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt is required" });

    const data = await openaiRequest({
      model : TEXT_MODEL,
      input : prompt,
      tools : [{ type: "web_search" }],
    });
    const text = data.output?.[0]?.text || data.choices?.[0]?.message?.content?.[0]?.text;
    res.json({ text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 2) Image generation
app.post("/api/image", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt is required" });

    const data = await openaiRequest({
      model : IMAGE_MODEL,
      input : prompt,
      tools : [{ type: "image_generation" }],
    });

    const img64 = data.output?.[0];            // base64 PNG
    res.json({ image_base64: img64 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 3) Vision – analyse uploaded image file
app.post("/api/vision", (req, res) => {
  const form = new multiparty.Form();
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: "upload failed" });
    const file = files?.file?.[0];
    if (!file) return res.status(400).json({ error: "file missing" });

    const b64 = fs.readFileSync(file.path).toString("base64");
    try {
      const data = await openaiRequest({
        model: VISION_MODEL,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text",  text: "Describe this image" },
              { type: "input_image", image_url: `data:image/jpeg;base64,${b64}` },
            ],
          },
        ],
      });
      res.json({ text: data.output_text || data.output?.[0] });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });
});

// Health‑check
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ----------  START ---------- //
app.listen(port, () => console.log(`Johnny‑Chat server running on ${port}`));
```

> **npm install dependencies**
>
> ```bash
> npm i express cors multiparty dotenv
> ```

---

## 💎 Squarespace embed (glass‑look UI + image upload)

Paste **everything** between the `<embed>` tags (Squarespace Code Block) or host as a separate HTML file.

```html
<!-- Johnny Chat UI -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap">
<style>
 :root {
  --purple:#b792ff;
  --bg:#faf9fb;
  --glass:rgba(255,255,255,.65);
 }
 body{font-family:Poppins,sans-serif;background:var(--bg);margin:0;}
 #app{max-width:480px;margin:60px auto;padding:0 1rem;}
 .card{background:var(--glass);backdrop-filter:blur(14px);border-radius:18px;padding:1.25rem;box-shadow:0 8px 20px rgba(0,0,0,.07);}
 .msg{border-radius:8px;padding:.75rem 1rem;margin:.25rem 0;word-wrap:anywhere;}
 .me{background:var(--purple);color:#fff;text-align:left;}
 .bot{background:#fffdee;color:#000;border:1px solid #ffeeba;display:flex;gap:.5rem;align-items:center}
 .bot svg{width:18px;height:18px;fill:#d39e00}
 .inputWrap{display:flex;gap:.5rem;margin-top:1rem}
 input[type="text"]{flex:1;border:2px solid var(--purple);border-radius:12px;padding:.65rem;font:inherit;outline:none;background:transparent}
 button{border:none;background:var(--purple);color:#fff;padding:.65rem 1rem;border-radius:12px;cursor:pointer;font-size:1rem;display:grid;place-items:center;transition:opacity .2s}
 button:hover{opacity:.85}
 button.upload{background:transparent;border:2px dashed var(--purple);color:var(--purple)}
 img.reply{max-width:100%;border-radius:12px;margin-top:.5rem}
</style>

<div id="app">
  <div id="chat" class="card"></div>
  <div class="inputWrap">
    <input id="ask" placeholder="Ask me anything …" />
    <button id="send">➜</button>
    <button id="picker" class="upload">📎</button>
    <input type="file" id="file" accept="image/*" hidden />
  </div>
</div>

<script>
const EL_chat  = document.getElementById('chat');
const EL_ask   = document.getElementById('ask');
const EL_send  = document.getElementById('send');
const EL_file  = document.getElementById('file');
const EL_pick  = document.getElementById('picker');

const API = 'https://johnny-chat.onrender.com/api'; // adjust for your Render URL

function addMsg(text, cls='bot', html=false){
  const div = document.createElement('div');
  div.className = `msg ${cls}`;
  div.innerHTML = html?text:escapeHtml(text);
  EL_chat.append(div);
  EL_chat.scrollTop = EL_chat.scrollHeight;
}
function escapeHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;')}

async function ask(){
  const prompt = EL_ask.value.trim();
  if(!prompt) return;
  addMsg(prompt,'me');
  EL_ask.value='';
  try{
    const r=await fetch(API+'/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt})});
    const {text,error}=await r.json();
    if(error) throw Error(error);
    addMsg(text||'No reply');
  }catch(e){addMsg('Server error','bot');console.error(e)}
}
EL_send.onclick=ask;
EL_ask.onkeydown=e=>e.key==='Enter'&&ask();

EL_pick.onclick=()=>EL_file.click();
EL_file.onchange=async()=>{
  const file=EL_file.files[0];if(!file)return;
  addMsg('Uploaded file ✅','me');
  const fd=new FormData();fd.append('file',file);
  try{
    const r=await fetch(API+'/vision',{method:'POST',body:fd});
    const {text,error}=await r.json();
    if(error) throw Error(error);
    addMsg(text||'No description');
  }catch(e){addMsg('Server error','bot');console.error(e)}
};
</script>
```

