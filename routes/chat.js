/* routes/chat.js  ── o4-mini text + live web search  |  gpt-4.1-mini vision  */
/* eslint-disable no-console */

import { Router }  from "express";
import fetch       from "node-fetch";
import multer      from "multer";
import FormData    from "form-data";

const router       = Router();
const upload       = multer({ storage: multer.memoryStorage() });

/* ── ENV ──────────────────────────────────────────────────────────────── */
const {
  OPENAI_API_KEY  : OPENAI,              // your secret key
  OPENAI_BETA     : BETA_HDR = "assistants=v2",
  TEXT_MODEL      = "o4-mini",           // chat + web search
  VISION_MODEL    = "gpt-4.1-mini"       // image understanding
} = process.env;

const RESP_URL = "https://api.openai.com/v1/responses";

/* ── HELPERS ──────────────────────────────────────────────────────────── */
async function openaiCall(body) {
  const r = await fetch(RESP_URL, {
    method  : "POST",
    headers : {
      Authorization : `Bearer ${OPENAI}`,
      "Content-Type": "application/json",
      "OpenAI-Beta" : BETA_HDR
    },
    body: JSON.stringify(body)
  });

  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `OpenAI ${r.status} ${r.statusText}`);
  }
  return r.json();
}

/* ── TEXT CHAT (w/ web_search) ────────────────────────────────────────── */
router.post("/chat", async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) return res.status(400).json({ error: "input required" });

    const data = await openaiCall({
      model : TEXT_MODEL,
      input,
      tools : [{ type: "web_search" }]
    });

    const reply = data.output_text ??                       // gpt-4.1-style
                  data.choices?.[0]?.message?.content?.[0]?.text ?? // o4-mini
                  "(no response)";
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* ── VISION ANALYSIS  (single image)───────────────────────────────────── */
/*  Use multipart/form-data:  field “file” for image,  field “prompt” opt */
router.post("/vision", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file required" });

    // encode image as base64 data URL (OpenAI Vision quick-path)
    const b64 = req.file.buffer.toString("base64");
    const data = await openaiCall({
      model : VISION_MODEL,
      input : [
        {
          role: "user",
          content: [
            { type: "input_text",  text: req.body.prompt ?? "What’s in this image?" },
            { type: "input_image", image_url: `data:${req.file.mimetype};base64,${b64}` }
          ]
        }
      ]
    });

    res.json({ answer: data.output_text ?? "(no answer)" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
