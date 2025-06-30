/* o4-mini + live web_search + image_generation (stateless) */

import { Router } from "express";

const router   = Router();
const OPENAI   = process.env.OPENAI_API_KEY;
const RESP_URL = "https://api.openai.com/v1/responses";
const BETA_HDR = "assistants=v2";              // required preview header

router.post("/chat", async (req, res) => {
  try {
    const { input, model = "o4-mini" } = req.body;
    if (!input) return res.status(400).json({ error: "input required" });

    const body = {
      model,
      input,
      tools: [
        { type: "web_search" },
        { type: "image_generation" }
      ]
    };

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
      return res.status(500).json({ error: err.error?.message || "OpenAI error" });
    }

    const data = await r.json();

    /* — extract text or base-64 image — */
    let reply="", imageBase=null;
    for (const out of data.output ?? []) {
      if (out.type === "message" && out.content?.[0]?.text)
        reply = out.content[0].text;
      if (out.type === "image_generation_call")
        imageBase = out.result;
    }

    res.json({ reply, imageBase });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
