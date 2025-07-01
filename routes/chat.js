/*  /api/chat
    • plain Q&A + web_search  → TEXT_MODEL  (o4-mini)
    • Vision + image generation → MULTIMODAL_MODEL (gpt-4o-mini)
----------------------------------------------------------------- */

import { Router } from "express";
const router = Router();

const OPENAI_KEY      = process.env.OPENAI_API_KEY;
const TEXT_MODEL      = process.env.TEXT_MODEL        || "o4-mini";
const MULTI_MODEL     = process.env.MULTIMODAL_MODEL  || "gpt-4o-mini";
const OPENAI_BETA     = process.env.OPENAI_BETA       || "assistants=v2";
const RESP_URL        = "https://api.openai.com/v1/responses";

/* ------------------------------------------------------------- */
router.post("/chat", async (req, res) => {
  try {
    const { input, wantImage = false, imageBase64 = null } = req.body;
    if (!input && !imageBase64)
      return res.status(400).json({ error: "input or image required" });

    /* choose model & tools */
    const usingMulti = wantImage || !!imageBase64;
    const model      = usingMulti ? MULTI_MODEL : TEXT_MODEL;
    const tools      = [{ type: "web_search" }];
    if (wantImage) tools.push({ type: "image_generation" });

    /* compose assistant input ---------------------------------- */
    let finalInput = input;                                 // simple text
    if (imageBase64) {                                      // Vision
      finalInput = [{
        role: "user",
        content: [
          { type: "image_url",
            image_url: { url: `data:image/png;base64,${imageBase64}` } },
          { type: "text",
            text: input || "Please describe this image." }
        ]
      }];
    }

    /* call OpenAI ---------------------------------------------- */
    const r = await fetch(RESP_URL, {
      method: "POST",
      headers: {
        Authorization : `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta" : OPENAI_BETA
      },
      body: JSON.stringify({ model, input: finalInput, tools })
    });

    if (!r.ok) {
      const err = await r.json();
      console.error("OpenAI error:", err);
      return res.status(500).json({ error: err.error?.message || "OpenAI error" });
    }

    const data = await r.json();

    /* extract text reply and/or generated image ---------------- */
    let reply = "", imageBase = null;
    for (const out of data.output ?? []) {
      if (out.type === "message" && out.content?.[0]?.text)
        reply = out.content[0].text;

      if (out.type === "image_generation_call")
        imageBase = out.result;                 // base-64 PNG
    }
    if (!reply && !imageBase) reply = "🤖 Sorry, no answer returned.";

    res.json({ reply, imageBase });             // front-end handles both
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});
/* ------------------------------------------------------------- */
export default router;
