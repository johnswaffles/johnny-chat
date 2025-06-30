/* routes/chat.js — o4‑mini + live web_search (Responses API) */
/* Works on Node ≥ 18 because fetch is global */

import { Router } from "express";

const router   = Router();
const OPENAI   = process.env.OPENAI_API_KEY;
const RESP_URL = "https://api.openai.com/v1/responses";

/* -------- OpenAI beta header required for conversation_id -------- */
const BETA_HDR = "assistants=v2";          // ← the exact string OpenAI expects

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
        Authorization : `Bearer ${OPENAI}`,
        "Content-Type": "application/json",
        "OpenAI-Beta" : BETA_HDR          // ← NOW the parameter is accepted
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const err = await r.json();
      console.error(err);
      return res.status(500).json({ error: err.error?.message || "OpenAI error" });
    }

    const data  = await r.json();
    const reply = data.choices[0].message.content[0].text;
    res.json({ reply, conversation_id: data.conversation_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
