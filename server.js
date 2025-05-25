/*──────────────────────────────────────────────────────────────
  server.js – minimal chat backend
  Model : gpt-4o-mini-search-preview   (Responses API + web search tool)
──────────────────────────────────────────────────────────────*/
require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const { OpenAI } = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app    = express();

app.use(cors());            // allow calls from your front-end domain
app.use(express.json());

/*── POST /chat ───────────────────────────────────────────────*/
app.post("/chat", async (req, res) => {
  const history = req.body.messages || [];
  const latest  = history.at(-1)?.content;
  if (!latest) return res.status(400).json({ error: "messages array missing" });

  try {
    const out = await openai.responses.create({
      model : "gpt-4o-mini-search-preview",
      tools : [{ type: "web_search_preview" }],
      input : latest
    });
    res.json({ content: out.output_text });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running at http://localhost:${PORT}`));

