/* routes/chat.js  – o4-mini text + web_search       */
/* gpt-4.1-mini vision                               */
import { Router } from "express";
import fetch       from "node-fetch";

const router   = Router();
const OPENAI   = process.env.OPENAI_API_KEY;
const RESP_URL = "https://api.openai.com/v1/responses";
const BETA_HDR = "assistants=v2";                   // still required

// ──────────────────────────────────────────────────────────────────────────
// POST /api/chat   { input: "...", [model] }
// ──────────────────────────────────────────────────────────────────────────
router.post("/chat", async (req, res) => {
  try {
    const { input, model = "o4-mini" } = req.body;
    if (!input) return res.status(400).json({ error: "input required" });

    const body = {
      model,
      input,
      tools: [{ type: "web_search" }]               // live web search
    };

    // NOTE: vision (image uploads) is handled by routes/upload.js

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
      const err = await r.json().catch(() => ({}));
      console.error(err);
      return res.status(500).json({ error: err.error?.message || "OpenAI error" });
    }

    const data  = await r.json();
    const reply = data.output?.text
               ?? data.choices?.[0]?.message?.content?.[0]?.text
               ?? "(no reply)";
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
