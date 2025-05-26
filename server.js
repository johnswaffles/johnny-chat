/*──────────────────────────────────────────────────────────────
  server.js – 2-stage pipeline
    Stage 1 : gpt-4o-mini-search-preview  → gathers facts
    Stage 2 : gpt-4.1-nano               → rewrites into narrative prose
──────────────────────────────────────────────────────────────*/
require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const { OpenAI } = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app    = express();

app.use(cors());
app.use(express.json());

/*──────────────── POST /chat ────────────────────────────────*/
app.post("/chat", async (req, res) => {
  const history = req.body.messages;
  if (!Array.isArray(history) || history.length === 0)
    return res.status(400).json({ error: "messages array missing" });

  /* -------- Stage 1 : raw answer from search-preview model -------- */
  let draft;
  try {
    const first = await openai.chat.completions.create({
      model   : "gpt-4o-mini-search-preview",
      messages: history,
      max_tokens: 900
    });
    draft = first.choices[0].message.content;
  } catch (err) {
    console.error("Stage-1 error:", err);
    return res.status(err.status || 500).json({ error: err.message });
  }

  /* -------- Stage 2 : rewrite into narrative paragraphs -------- */
  try {
    const second = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        {
          role: "system",
          content: `
You are a professional writer. Transform the assistant draft into cohesive
narrative prose:

• Use normal paragraphs (no bullet lists, no headings).  
• Keep all factual content intact; do not invent new facts.  
• Combine short points into flowing sentences with transitions.  
• Convert bare URLs into parenthetical references like “(See: Wikipedia)”.  
• Remove extra blank lines and any markdown symbols.`
        },
        { role: "user", content: draft }
      ],
      max_tokens: 900
    });

    const polished = second.choices[0].message.content;
    console.log("✅ Stage 2 (nano) OK");          // verify in Render logs
    res.json({ content: polished });

  } catch (err) {
    console.error("Stage-2 error:", err);
    /* Fallback – return the unpolished draft if nano fails          */
    res.status(207).json({ content: draft, warning: err.message });
  }
});

/*──────────────── start server ───────────────────────────────*/
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`API running on http://localhost:${PORT}`)
);

