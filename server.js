/*  server.js  – Just Ask Johnny (Express + OpenAI “Responses” API)  */

import express from "express";
import cors    from "cors";
import dotenv  from "dotenv";
import fetch   from "node-fetch";
import multiparty from "multiparty";
import path    from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 10000;

/* ------------------------------------------------------------------ */
/*  Config                                                             */
const OPENAI_KEY   = process.env.OPENAI_API_KEY;
const TEXT_MODEL   = process.env.TEXT_MODEL   || "o4-mini";
const IMAGE_MODEL  = process.env.IMAGE_MODEL  || "gpt-image-1";
const VISION_MODEL = process.env.VISION       || "gpt-4-1-mini";
const BETA_HDR     = process.env.OPENAI_BETA  || "assistants=v2";
const OPENAI_URL   = "https://api.openai.com/v1/responses";
/* ------------------------------------------------------------------ */

app.use(cors({ origin: true }));
app.use(express.json({ limit: "10mb" }));      // JSON bodies

/* -------------------------------------------------- */
/* helper that actually calls the Responses endpoint  */
async function callOpenAI(body) {
  const rsp = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization : `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
      "OpenAI-Beta" : BETA_HDR
    },
    body: JSON.stringify(body)
  });

  if (!rsp.ok) {
    // try to surface the upstream error message
    const fail = await rsp.json().catch(() => ({}));
    throw new Error(fail?.error?.message || `OpenAI HTTP ${rsp.status}`);
  }
  return rsp.json();
}

/* -----------------------  /chat  -------------------- */
/* text Q&A  +  optional image_generation              */
app.post("/chat", async (req, res) => {
  try {
    const { input, wantsImage = false } = req.body;
    if (!input) return res.status(400).json({ error: "input required" });

    const body = {
      model : wantsImage ? IMAGE_MODEL : TEXT_MODEL,
      input,
      tools : wantsImage
        ? [{ type: "image_generation" }]
        : [{ type: "web_search" }]
    };

    const data = await callOpenAI(body);

    if (wantsImage) {
      /* look for the image_generation_call in the output array */
      const imgCall = data.output?.find(o => o.type === "image_generation_call");
      if (!imgCall) throw new Error("image_generation_call not found in response");
      res.json({ image_base64: imgCall.result });                    // <-- front-end displays it
    } else {
      /* normal text reply */
      const msg      = data.output?.find(o => o.type === "message");
      const replyTxt = msg?.content?.[0]?.text ?? "(no reply text)";
      res.json({ reply: replyTxt });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------  /vision  ------------------ */
/*  give the model an image URL + prompt to analyse     */
app.post("/vision", async (req, res) => {
  try {
    const { prompt, image_url } = req.body;
    if (!prompt || !image_url) {
      return res.status(400).json({ error: "prompt and image_url required" });
    }

    const body = {
      model: VISION_MODEL,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text",  text: prompt },
            { type: "input_image", image_url }
          ]
        }
      ]
    };

    const data    = await callOpenAI(body);
    const summary = data.output_text ??
                    data.output?.find(o => o.type === "message")?.content?.[0]?.text ??
                    "(no response)";
    res.json({ reply: summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------  /upload  ------------------ */
/*  Squarespace “file” block sends multipart/form-data  */
app.post("/upload", (req, res) => {
  const form = new multiparty.Form();
  form.parse(req, (err /*, fields, files */) => {
    if (err) return res.status(400).json({ error: err.message });
    // For now we don’t actually store the file – the Squarespace block
    // returns a public URL anyway, which the front-end passes to /vision.
    res.json({ ok: true });
  });
});

/* serve static files when running locally (optional) */
if (process.env.NODE_ENV !== "production") {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname  = path.dirname(__filename);
  app.use(express.static(path.join(__dirname, "public")));
}

/* -----------------------  start  -------------------- */
app.listen(PORT, () => {
  console.log(`✅  Johnny backend running on port ${PORT}`);
});
