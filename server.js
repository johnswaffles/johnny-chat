/*──────────────────────────────────────────────────────────────
  server.js – 2-stage pipeline
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
  const history = req.body.messages;
  if (!Array.isArray(history) || history.length === 0)
    return res.status(400).json({ error: "messages array missing" });

  /* -------- Stage 1 -------- */
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

  /* -------- Stage 2 -------- */
  try {
    const second = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        { role: "system", content:
`Rewrite the assistant text for CLEAR presentation:
* Keep facts unchanged.
* Output GitHub-flavored Markdown.
  - Use level-3 headings ### (not bigger) for sections.
  - Convert bare URLs into “More about X” style links.
  - Bullet lists should list the items themselves (no empty • bullets).
  - Remove extra blank lines.
Return ONLY the polished markdown.`},
        { role: "user", content: draft }
      ],
      max_tokens: 900
    });
    const polished = second.choices[0].message.content;

    console.log("✅ Stage 2 (nano) OK");           // <— verify in Render logs
    res.json({ content: polished });
  } catch (err) {
    console.error("Stage-2 error:", err);
    /* send _something_ back rather than fail completely */
    res.status(207).json({ content: draft, warning: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`API on http://localhost:${PORT}`));

