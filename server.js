/*──────────────────────────────────────────────────────────────
  server.js – /chat route with 2-stage LLM pipeline
    1) gpt-4o-mini-search-preview  → raw answer
    2) gpt-4.1-nano               → polished answer
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

  /* -------- Stage 1 : get raw answer with live search model -------- */
  let rawAnswer;
  try {
    const first = await openai.chat.completions.create({
      model   : "gpt-4o-mini-search-preview",
      messages: history,
      max_tokens: 900
    });
    rawAnswer = first.choices[0].message.content;
  } catch (err) {
    console.error("Stage-1 error:", err);
    return res.status(err.status || 500).json({ error: err.message });
  }

  /* -------- Stage 2 : polish it with gpt-4.1-nano ------------------ */
  try {
    const second = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        {
          role: "system",
          content:
            "You are an editor. Rewrite the assistant text so it is clear, "
          + "concise, friendly, and well-formatted. Preserve all facts; "
          + "use Markdown for headings / lists if helpful. Do NOT add extra "
          + "content."
        },
        { role: "user", content: rawAnswer }
      ],
      max_tokens: 900
    });

    const polished = second.choices[0].message.content;
    res.json({ content: polished });
  } catch (err) {
    console.error("Stage-2 error:", err);
    /* If polishing fails, at least return the raw answer */
    res.status(207).json({ content: rawAnswer, warning: err.message });
  }
});

/*── start server ─────────────────────────────────────────────*/
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));

