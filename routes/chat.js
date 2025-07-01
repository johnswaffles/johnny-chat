/* routes/chat.js — o4-mini text + gpt-4.1-mini vision */

import { Router }   from "express";
import fetch        from "node-fetch";       // v3 ( ESM )
import multer       from "multer";
import fs           from "fs/promises";
import path         from "path";

const router   = Router();
const OPENAI   = process.env.OPENAI_API_KEY;
const BETA_HDR = process.env.OPENAI_BETA   || "assistants=v2";

const TEXT_MODEL   = process.env.TEXT_MODEL   || "o4-mini";
const VISION_MODEL = process.env.VISION_MODEL || "gpt-4.1-mini";
const RESP_URL     = "https://api.openai.com/v1/responses";

const upload = multer({ dest: "/tmp" });

/* ----------------------------------------------
   POST /api/chat           → text only
   POST /api/chat (file)    → vision
------------------------------------------------*/
router.post("/chat", upload.single("image"), async (req, res) => {
  try {
    /* 1️⃣ build input array */
    const inputArr = [
      { type: "input_text", text: req.body.prompt || "Hello" }
    ];

    /* optional vision */
    if (req.file) {
      const b64 = (await fs.readFile(req.file.path)).toString("base64");
      const ext = path.extname(req.file.originalname).replace(".","") || "png";
      inputArr.push({
        type : "input_image",
        image_url : `data:image/${ext};base64,${b64}`
      });
    }

    /* 2️⃣ choose correct model */
    const model = req.file ? VISION_MODEL : TEXT_MODEL;

    /* 3️⃣ hit Responses API */
    const r = await fetch(RESP_URL,{
      method:"POST",
      headers:{
        Authorization:`Bearer ${OPENAI}`,
        "Content-Type":"application/json",
        "OpenAI-Beta":BETA_HDR
      },
      body:JSON.stringify({
        model,
        input:inputArr,
        tools:req.file ? []:[{type:"web_search"}]   // text calls get search
      })
    });

    if(!r.ok){
      const err = await r.json();
      return res.status(500).json({ error: err.error?.message || "OpenAI error" });
    }

    const data = await r.json();
    const reply = data.output_text ||                // vision answer
                  data.choices?.[0]?.message?.content?.[0]?.text || // text answer
                  "(no reply)";
    res.json({ reply });

  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (req.file) fs.rm(req.file.path, { force:true });
  }
});

export default router;
