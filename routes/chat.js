/*  /api/chat  —  o4-mini for text  |  gpt-4.1-mini for images & vision  */

import { Router } from "express";

const router      = Router();
const OPENAI_KEY  = process.env.OPENAI_API_KEY;
const TEXT_MODEL  = process.env.TEXT_MODEL  || "o4-mini";
const IMAGE_MODEL = process.env.IMAGE_MODEL || "gpt-4.1-mini";
const RESP_URL    = "https://api.openai.com/v1/responses";
const BETA_HEADER = process.env.OPENAI_BETA || "assistants=v2";

router.post("/chat", async (req, res) => {
  try {
    const { input, wantImage = false, imageBase64 = null } = req.body;
    if (!input && !imageBase64)
      return res.status(400).json({ error: "input or image required" });

    /* decide which model & tools */
    const usingImage = wantImage || !!imageBase64;
    const model      = usingImage ? IMAGE_MODEL : TEXT_MODEL;
    const tools      = [{ type: "web_search" }];
    if (wantImage) tools.push({ type: "image_generation" });

    /* build input payload */
    const finalInput = imageBase64
      ? [
          { type: "image_url",
            image_url:{ url:`data:image/png;base64,${imageBase64}` } },
          { type: "text", text: input || "Describe the image" }
        ]
      : input;

    const body = { model, input: finalInput, tools };

    const r = await fetch(RESP_URL, {
      method : "POST",
      headers : {
        Authorization : `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta" : BETA_HEADER
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const err = await r.json();
      console.error("OpenAI error:", err);
      return res.status(500).json({ error: err.error?.message || "OpenAI error" });
    }

    const data = await r.json();
    /* pick out text or base-64 png */
    let reply = "", genImage = null;
    for (const out of data.output ?? []) {
      if (out.type === "message" && out.content?.[0]?.text)
        reply = out.content[0].text;
      if (out.type === "image_generation_call")
        genImage = out.result;
    }
    res.json({ reply, imageBase: genImage });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
