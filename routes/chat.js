/* routes/chat.js — o4-mini + live web_search (stateless, stable) */

import { Router } from "express";

const router   = Router();
const OPENAI   = process.env.OPENAI_API_KEY;
const RESP_URL = "https://api.openai.com/v1/responses";

/* Beta header required for /responses preview */
const BETA_HDR = "assistants=v2";

router.post("/chat", async (req, res) => {
  try {
    const { input, model = "o4-mini" } = req.body;
    if (!input) return res.status(400).json({ error: "input required" });

    /* stateless request — no conversation_id until OpenAI enables it */
    const body = {
      model,
      input,
      tools: [{ type: "web_search" }]
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
      console.error(err);
      return res.status(500).json({ error: err.error?.message || "OpenAI error" });
    }

    const data = await r.json();

    /* -------- extract assistant text safely -------- */
    let reply = "🤖 OpenAI returned no usable text.";
    const msg  = data.output?.find(o => o.type === "message");
    if (msg?.content?.[0]?.text) reply = msg.content[0].text;

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
