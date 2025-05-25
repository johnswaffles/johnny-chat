/*──────────────────────────────────────────────────────────────
  server.js – single /chat route, Chat-Completions API
──────────────────────────────────────────────────────────────*/
require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const { OpenAI } = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app    = express();

app.use(cors());
app.use(express.json());

/*── POST /chat ───────────────────────────────────────────────*/
app.post("/chat", async (req, res) => {
  const history = req.body.messages || [];
  if (!Array.isArray(history) || history.length === 0)
    return res.status(400).json({ error: "messages array missing" });

  try {
    const out = await openai.chat.completions.create({
      model   : "gpt-4o-mini-search-preview",
      messages: history,
      max_tokens: 800
    });
    res.json({ content: out.choices[0].message.content });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));

