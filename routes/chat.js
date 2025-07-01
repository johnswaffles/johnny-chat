/* /api/chat  —  text = o4-mini,  images & vision = gpt-4o-mini  */

import { Router } from "express";
const router = Router();

const OPENAI      = process.env.OPENAI_API_KEY;
const TEXT_MODEL  = process.env.TEXT_MODEL        || "o4-mini";
const MULTI_MODEL = process.env.MULTIMODAL_MODEL  || "gpt-4o-mini";
const RESP_URL    = "https://api.openai.com/v1/responses";
const BETA_HDR    = process.env.OPENAI_BETA || "assistants=v2";

router.post("/chat", async (req, res) => {
  try {
    const { input, wantImage = false, imageBase64 = null } = req.body;
    if (!input && !imageBase64)
      return res.status(400).json({ error: "input or image required" });

    const usingMulti = wantImage || !!imageBase64;
    const model      = usingMulti ? MULTI_MODEL : TEXT_MODEL;

    /* tools */
    const tools = [{ type: "web_search" }];
    if (wantImage) tools.push({ type: "image_generation" });

    /* compose assistant input */
    let finalInput = input;
    if (imageBase64) {
      finalInput = [
        { type: "image_file", image_file:{ bytes: imageBase64 } },
        { type: "text",
          text: input || "Please describe this image." }
      ];
    }

    const body = { model, input: finalInput, tools };

    const r = await fetch(RESP_URL, {
      method: "POST",
      headers: {
        Authorization : `Bearer ${OPENAI}`,
        "Content-Type": "application/json",
        "OpenAI-Beta" : BETA_HDR
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const err = await r.json();
      console.error("OpenAI error", err);
      return res.status(500).json({ error: err.error?.message || "OpenAI error" });
    }

    const data = await r.json();
    /* parse output */
    let reply = "", imageBase = null;
    for (const out of data.output ?? []) {
      if (out.type === "message" && out.content?.[0]?.text)
        reply = out.content[0].text;
      if (out.type === "image_generation_call")
        imageBase = out.result;
    }
    if (!reply && !imageBase) reply = "🤖 Sorry, no answer returned.";

    res.json({ reply, imageBase });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
