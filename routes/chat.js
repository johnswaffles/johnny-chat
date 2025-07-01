/* routes/chat.js ― stateless o4-mini + live web-search  */
import { Router } from "express";
import fetch from "node-fetch";

const router = Router();

// ----------- env vars -----------
const OPENAI_KEY  = process.env.OPENAI_API_KEY;          // your secret key
const OPENAI_BETA = "assistants=v2";                     // required for tool-use
const TEXT_MODEL  = process.env.TEXT_MODEL  || "o4-mini";
// --------------------------------

router.post("/chat", async (req, res) => {
  try {
    const { input } = req.body;
    if (!input || !input.trim()) {
      return res.status(400).json({ error: "input required" });
    }

    const body = {
      model: TEXT_MODEL,
      input,
      tools: [{ type: "web_search" }]            // enable live search
    };

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization : `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta" : OPENAI_BETA
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: err?.error?.message || "OpenAI error" });
    }

    const data  = await r.json();
    const reply = data.output_text ||                  // new field
                  data.choices?.[0]?.message?.content; // fallback (older field)

    res.json({ reply: reply?.trim() || "(no content)" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
