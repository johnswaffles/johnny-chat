/*  /api/chat
    ───────────────────────────────────────────────────────────────
    • plain Q&A  : TEXT_MODEL  (o4-mini)
    • vision /   : MULTIMODAL_MODEL (gpt-4o-mini)       ┐
      image-gen    ── requires the new “v2” schema      ┘
*/

import { Router } from "express";
const router = Router();

const OPENAI_KEY  = process.env.OPENAI_API_KEY;
const TEXT_MODEL  = process.env.TEXT_MODEL       || "o4-mini";
const MULTI_MODEL = process.env.MULTIMODAL_MODEL || "gpt-4o-mini";
const BETA_HDR    = process.env.OPENAI_BETA      || "assistants=v2";
const RESP_URL    = "https://api.openai.com/v1/responses";

/* ──────────────────────────────────────────────────────────── */
router.post("/chat", async (req, res) => {
  try {
    const { input, wantImage = false, imageBase64 = null } = req.body;
    if (!input && !imageBase64)
      return res.status(400).json({ error: "input or image required" });

    /* pick model & tools */
    const multiNeeded = wantImage || !!imageBase64;
    const model       = multiNeeded ? MULTI_MODEL : TEXT_MODEL;

    const tools = [{ type: "web_search" }];
    if (wantImage) tools.push({ type: "image_generation" });

    /* build v2 message format */
    let messages = [{ role: "user", content: [ { type: "input_text", text: input } ] }];

    if (imageBase64) {
      messages = [{
        role: "user",
        content: [
          { type: "input_image",
            image_url: { url: `data:image/png;base64,${imageBase64}` } },
          { type: "input_text",
            text: input || "Please describe this image." }
        ]
      }];
    }

    const body = { model, input: messages, tools };

    const r = await fetch(RESP_URL, {
      method : "POST",
      headers : {
        Authorization : `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta" : BETA_HDR
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const err = await r.json();
      console.error("OpenAI error:", err);
      return res.status(500).json({ error: err.error?.message || "OpenAI error" });
    }

    const data = await r.json();

    /* pull out assistant reply + any generated image */
    let reply = "", imageBase = null;
    for (const out of data.output ?? []) {
      if (out.type === "message") {
        const part = out.content?.find(c => c.type === "output_text");
        if (part?.text) reply = part.text;
      }
      if (out.type === "image_generation_call") imageBase = out.result;
    }
    if (!reply && !imageBase) reply = "🤖 Sorry, no answer returned.";

    res.json({ reply, imageBase });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});
/* ──────────────────────────────────────────────────────────── */
export default router;
