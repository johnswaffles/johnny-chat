/*──────────────────────────────────────────────────────────────
  server.js – /chat route with 2-stage pipeline
──────────────────────────────────────────────────────────────*/
require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const { OpenAI } = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app    = express();

app.use(cors());
app.use(express.json());

/*── /chat ────────────────────────────────────────────────────*/
app.post("/chat", async (req, res) => {
  const history = req.body.messages || [];
  if (!Array.isArray(history) || history.length === 0)
    return res.status(400).json({ error: "messages array missing" });

  /* Stage 1 – raw answer from search-preview model */
  let raw;
  try {
    const first = await openai.chat.completions.create({
      model   : "gpt-4o-mini-search-preview",
      messages: history,
      max_tokens: 900
    });
    raw = first.choices[0].message.content;
  } catch (err) {
    console.error("Stage-1 error:", err);
    return res.status(err.status || 500).json({ error: err.message });
  }

  /* Stage 2 – “polish” with 4.1-nano => clean Markdown */
  try {
    const second = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        {
          role: "system",
          content:
`You are an editor.  Rewrite the assistant text so it is clear, concise, and
well-formatted **in GitHub-flavoured Markdown**:
 • Use level-2 headings (##) or bold labels – but no stray # symbols.
 • Convert bare URLs to proper [text](url) links.
 • Use bullet lists (- item) where appropriate.
Do NOT add additional content, only rewrite and format.`
        },
        { role: "user", content: raw }
      ],
      max_tokens: 900
    });

    const polished = second.choices[0].message.content;
    res.json({ content: polished });
  } catch (err) {
    console.error("Stage-2 error:", err);
    /* fallback: send raw answer if polishing fails */
    res.status(207).json({ content: raw, warning: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`API running on http://localhost:${PORT}`)
);

