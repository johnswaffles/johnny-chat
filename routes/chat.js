/* routes/chat.js — Johnny Chat backend (o4-mini + live web_search) */
/* Works on Node ≥ 18 because fetch is global */

import { Router } from "express";

const router   = Router();
const OPENAI   = process.env.OPENAI_API_KEY;
const RESP_URL = "https://api.openai.com/v1/responses";

/*  OpenAI requires this header while the endpoint is in gated preview.   */
const BETA_HEADER = "assisted-generation-preview";   // latest as of 2025-06

router.post("/chat", async (req, res) => {
  try {
    const { input, conversation_id, model = "o4-mini" } = req.body;
    if (!input) return res.status(400).json({ error: "input required" });

    const body = {
      model,
      input,
      conversation_id: conversation_id ?? "new",
      tools: [{ type: "web_search" }]
    };

    const r = await fetch(RESP_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": BETA_HEADER          // ←-- add this line
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const err = await r.json();
      console.error(err);
      return res.status(500).json({ error: err.error?.message || "OpenAI error" });
    }

    const data   = await r.json();
    const reply  = data.choices[0].message.content[0].text;
    res.json({ reply, conversation_id: data.conversation_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
