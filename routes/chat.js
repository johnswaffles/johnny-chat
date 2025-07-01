/* routes/chat.js ― o4-mini + web_search (stateless) */
import { Router } from "express";
import fetch from "node-fetch";

const router = Router();

const OPENAI = process.env.OPENAI_API_KEY;
const MODEL  = process.env.TEXT_MODEL || "o4-mini";
const OPENAI_BETA = "assistants=v2";            // tool-use header
const ENDPOINT    = "https://api.openai.com/v1/responses";

router.post("/chat", async (req, res) => {
  try {
    const input = (req.body.input || "").trim();
    if (!input) return res.status(400).json({ error: "input required" });

    const body = {
      model: MODEL,
      input,
      tools: [{ type: "web_search" }]
    };

    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization : `Bearer ${OPENAI}`,
        "Content-Type": "application/json",
        "OpenAI-Beta" : OPENAI_BETA
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: err?.error?.message || `OpenAI ${r.status}` });
    }

    const data  = await r.json();
    const reply = data.output_text || data.choices?.[0]?.message?.content || "";
    res.json({ reply: reply.trim() });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
