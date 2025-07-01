// server.js – Express back-end for JustAskJohnny
import express from "express";
import cors    from "cors";
import fetch   from "node-fetch";
import multiparty from "multiparty";
import fs from "node:fs/promises";
import path from "node:path";

const app  = express();
const PORT = process.env.PORT || 10_000;

/* ─────────────────────────────────────────────
   ENVIRONMENT VARIABLES (from Render)
   ───────────────────────────────────────────── */
const OPENAI_KEY      = process.env.OPENAI_API_KEY;
const TEXT_MODEL      = process.env.TEXT_MODEL   || "o4-mini";
const IMAGE_MODEL     = process.env.IMAGE_MODEL  || "gpt-image-1";
const VISION_MODEL    = process.env.VISION       || "gpt-4-1-mini";
const OPENAI_BETA     = process.env.OPENAI_BETA  || "assistants=v2";

/* ───────────────────────────────────────────── */
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json({ limit: "10mb" }));           // JSON body-parsing

/* ==  TEXT (standard chat)  == */
app.post("/api/chat", async (req, res) => {
  try {
    const { input, model = TEXT_MODEL } = req.body;
    if (!input) { return res.status(400).json({ error: "input required" }); }

    const body = {
      model,
      input,
      tools: [{ type: "web_search" }],               // live search
    };

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization : `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta" : OPENAI_BETA
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const msg = await r.text();
      return res.status(500).json({ error: msg });
    }

    const data   = await r.json();
    const reply  = data.output?.[0]?.text ?? data.choices?.[0]?.message?.content?.[0]?.text;
    return res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* ==  IMAGE GENERATION  == */
app.post("/api/generate-image", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) { return res.status(400).json({ error: "prompt required" }); }

    const body = {
      model : IMAGE_MODEL,
      input : prompt,
      tools : [{ type: "image_generation" }]
    };

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization : `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta" : OPENAI_BETA
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const msg = await r.text();
      return res.status(500).json({ error: msg });
    }

    const data       = await r.json();
    const imgBase64  = data.output?.find(o => o.type === "image_generation_call")?.result;
    if (!imgBase64)  { return res.status(500).json({ error: "no image generated" }); }

    res.json({ image: `data:image/png;base64,${imgBase64}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* ==  IMAGE UPLOAD + VISION  == */
app.post("/api/vision", (req, res) => {
  new multiparty.Form().parse(req, async (err, fields, files) => {
    try {
      if (err) throw err;
      const question = fields.question?.[0] || "What’s in this image?";
      const file     = files.image?.[0];
      if (!file) return res.status(400).json({ error: "image file required" });

      const b64 = await fs.readFile(file.path, { encoding: "base64" });

      const body = {
        model : VISION_MODEL,
        input : [
          {
            role   : "user",
            content: [
              { type: "input_text",  text: question },
              { type: "input_image", image_url: `data:image/${path.extname(file.originalFilename).slice(1)};base64,${b64}` }
            ]
          }
        ]
      };

      const r = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization : `Bearer ${OPENAI_KEY}`,
          "Content-Type": "application/json",
          "OpenAI-Beta" : OPENAI_BETA
        },
        body: JSON.stringify(body)
      });

      if (!r.ok) { return res.status(500).json({ error: await r.text() }); }
      const data  = await r.json();
      const reply = data.output_text || data.output?.[0]?.text;
      res.json({ reply });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });
});

/* ───── Start server ───── */
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
