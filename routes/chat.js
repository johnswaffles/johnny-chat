/* routes/chat.js – call the “Responses” endpoint with built-in web_search */

import { Router } from "express";
import fetch       from "node-fetch";                  // Node ≥18 has global fetch – this works too.

const router  = Router();
const OPENAI  = process.env.OPENAI_API_KEY;
const URL     = "https://api.openai.com/v1/responses";

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

    const r = await fetch(URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const err = await r.json();
      console.error(err);
      return res.status(500).json({ error: err.error?.message || "OpenAI error" });
    }

    const data = await r.json();
    const reply = data.choices[0].message.content[0].text;
    res.json({ reply, conversation_id: data.conversation_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
