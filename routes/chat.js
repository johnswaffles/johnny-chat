import { Router }  from "express";
import fetch       from "node-fetch";

const router   = Router();
const OPENAI   = process.env.OPENAI_API_KEY;
const RESP_URL = "https://api.openai.com/v1/responses";
const HEADERS  = {
  Authorization : `Bearer ${OPENAI}`,
  "Content-Type": "application/json",
  "OpenAI-Beta" : "assistants=v2"
};

// ─── stateless chat (o4-mini + web_search) ─────────────────────────────────────
router.post("/chat", async (req, res) => {
  try {
    const { input, model = "o4-mini" } = req.body;
    if (!input || !input.trim()) {
      return res.status(400).json({ error: "input required" });
    }

    const body = {
      model,
      input,
      tools: [{ type: "web_search" }]
    };

    const r = await fetch(RESP_URL, { method: "POST", headers: HEADERS, body: JSON.stringify(body) });
    if (!r.ok) {
      const { error } = await r.json();
      return res.status(r.status).json({ error: error?.message || "OpenAI error" });
    }

    const data  = await r.json();
    const reply = data.output[1]?.content?.[0]?.text ?? "[no content]";
    res.json({ reply });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
