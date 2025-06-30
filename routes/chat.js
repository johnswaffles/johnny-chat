/* routes/chat.js — o4‑mini + live web_search (stateless) */

import { Router } from "express";

const router   = Router();
const OPENAI   = process.env.OPENAI_API_KEY;
const RESP_URL = "https://api.openai.com/v1/responses";

/* The header is still required for tool usage */
const BETA_HDR = "assistants=v2";

router.post("/chat", async (req, res) => {
  try {
    const { input, model = "o4-mini" } = req.body;
    if (!input) return res.status(400).json({ error: "input required" });

    const body = {
      model,
      input,
      tools: [{ type: "web_search" }]          // enable live search
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

    const data  = await r.json();
    console.log("🔎 OpenAI response:", JSON.stringify(data, null, 2));
    const reply = data.choices[0].message.content[0].text;
    res.json({ reply });                       // no conversation_id for now
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
