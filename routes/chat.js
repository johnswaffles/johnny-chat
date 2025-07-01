/* routes/chat.js — full working version
   Supports:
     • text Q&A  (o4-mini + web_search)
     • image generation (gpt-image-1)
     • vision / describe image (gpt-4-1-mini)
   ENV needed on Render
     OPENAI_API_KEY   – your secret
     TEXT_MODEL       – o4-mini
     IMAGE_MODEL      – gpt-image-1
     VISION_MODEL     – gpt-4-1-mini
     OPENAI_BETA      – assistants=v2               (already present)
*/

import { Router } from "express";
import fetch       from "node-fetch";
import multiparty  from "multiparty";
import fs          from "fs/promises";
import path        from "path";
import mime        from "mime-types";

const router       = Router();
const OPENAI_KEY   = process.env.OPENAI_API_KEY;
const TEXT_MODEL   = process.env.TEXT_MODEL   || "o4-mini";
const IMAGE_MODEL  = process.env.IMAGE_MODEL  || "gpt-image-1";
const VISION_MODEL = process.env.VISION_MODEL || "gpt-4-1-mini";
const RESP_URL     = "https://api.openai.com/v1/responses";
const BETA_HEADER  = process.env.OPENAI_BETA  || "assistants=v2";

// shared headers -------------------------------------------------------------
const baseHeaders = {
  Authorization : `Bearer ${OPENAI_KEY}`,
  "Content-Type": "application/json",
  "OpenAI-Beta" : BETA_HEADER
};

// helper – convert uploaded image -> base64 dataURL --------------------------
async function fileToDataURL(filePath) {
  const b64 = (await fs.readFile(filePath)).toString("base64");
  const mt  = mime.lookup(filePath) || "application/octet-stream";
  return `data:${mt};base64,${b64}`;
}

// ---------------------------------------------------------------------------
//  TEXT-ONLY endpoint  (JSON body: {input: "..."} )
// ---------------------------------------------------------------------------
router.post("/chat", async (req, res) => {
  try {
    // simple JSON (text) requests come straight in --------------------------
    if (req.is("application/json")) {
      const { input } = req.body;
      if (!input?.trim()) return res.status(400).json({ error: "input required" });

      const body = {
        model: TEXT_MODEL,
        input,
        tools: [{ type: "web_search" }]
      };

      const r = await fetch(RESP_URL, { method: "POST", headers: baseHeaders, body: JSON.stringify(body) });
      if (!r.ok) throw await r.json();

      const data  = await r.json();
      const reply = data.output_text ?? data.choices?.[0]?.message?.content?.[0]?.text;
      return res.json({ reply });
    }

    // -----------------------------------------------------------------------
    // multipart/form-data → might be image-gen or vision
    //    fields:
    //      input      (prompt / question)
    //      mode       ("generate" | "vision")
    //      file       (optional file upload for vision)
    //      imageUrl   (optional URL for vision)
    // -----------------------------------------------------------------------
    const form = new multiparty.Form();
    form.parse(req, async (err, fields, files) => {
      if (err) return res.status(400).json({ error: err.message });

      const input = fields.input?.[0] ?? "";
      const mode  = fields.mode?.[0]  ?? "generate";   // default → generate
      const hasFile   = files.file?.length;
      const hasImgURL = fields.imageUrl?.[0];

      // ---------------- image generation -----------------------------------
      if (mode === "generate") {
        if (!input.trim())
          return res.status(400).json({ error: "prompt required for image generation" });

        const body = {
          model: IMAGE_MODEL,
          input,
          tools: [{ type: "image_generation" }]
        };

        const r = await fetch(RESP_URL, { method: "POST", headers: baseHeaders, body: JSON.stringify(body) });
        if (!r.ok) throw await r.json();

        const data       = await r.json();
        const imgBase64  = data.output?.find(o => o.type === "image_generation_call")?.result;
        if (!imgBase64)  throw new Error("No image returned");

        // send data-URL so front-end can <img src="...">
        return res.json({ img: `data:image/png;base64,${imgBase64}` });
      }

      // ---------------- vision / describe image ----------------------------
      if (mode === "vision") {
        let imageRef = null;

        if (hasFile) {
          const tmpPath = files.file[0].path;
          imageRef = await fileToDataURL(tmpPath);      // inline as base64
          await fs.unlink(tmpPath);                     // clean up tmp file
        } else if (hasImgURL) {
          imageRef = fields.imageUrl[0];                // fully-qualified URL
        } else {
          return res.status(400).json({ error: "Need file or imageUrl for vision" });
        }

        const body = {
          model: VISION_MODEL,
          input: [{
            role: "user",
            content: [
              { type: "input_text",  text: input || "Describe this image" },
              { type: "input_image", image_url: imageRef }
            ]
          }]
        };

        const r = await fetch(RESP_URL, { method: "POST", headers: baseHeaders, body: JSON.stringify(body) });
        if (!r.ok) throw await r.json();

        const data  = await r.json();
        const reply = data.output_text;
        return res.json({ reply });
      }

      return res.status(400).json({ error: "unknown mode" });
    });
  } catch (e) {
    console.error("OpenAI error:", e);
    const msg = e?.error?.message || e.message || "OpenAI request failed";
    res.status(500).json({ error: msg });
  }
});

export default router;
