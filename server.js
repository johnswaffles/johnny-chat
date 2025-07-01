// server.js  – Express API (stateless, no vision)
import express from "express";
import cors    from "cors";
import fetch   from "node-fetch";          // v3.x ESM import style

const app       = express();
const PORT      = process.env.PORT || 3000;
const OPENAI    = process.env.OPENAI_API_KEY;
const OPENAI_BETA = "assistants=v2";
const RESP_URL  = "https://api.openai.com/v1/responses";

app.use(cors());
app.use(express.json());

// ----  CHAT endpoint -------------------------------------------------
app.post("/api/chat", async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) return res.status(400).json({ error: "input required" });

    const body = {
      model : "o4-mini",
      input,
      tools : [{ type: "web_search" }]
    };

    const r = await fetch(RESP_URL, {
      method : "POST",
      headers: {
        Authorization : `Bearer ${OPENAI}`,
        "Content-Type": "application/json",
        "OpenAI-Beta" : OPENAI_BETA
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: err.error?.message || r.statusText });
    }

    const data  = await r.json();
    const reply = data.output.trim();      // single-turn stateless
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Johnny-Chat API on :${PORT}`));
