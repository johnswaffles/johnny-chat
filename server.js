/*── CHAT  (try search-preview, fall back) ────────────────────*/
app.post("/chat", async (req, res) => {
  const history = req.body.messages || [];
  const prompt  = history[history.length - 1]?.content;
  if (!prompt) return res.status(400).json({ error: "messages array missing" });

  try {
    /* ➊  attempt real-time answer */
    const draft = await openai.responses.create({
      model : "gpt-4o-mini-search-preview",
      tools : [{ type: "web_search_preview" }],
      input : prompt
    });
    return res.json({ content: draft.output_text });
  } catch (err) {
    console.warn("preview search failed, falling back:", err.message);
    /* ➋  normal model, no web search */
    try {
      const out = await openai.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: history,
        max_tokens: 600
      });
      return res.json({ content: out.choices[0].message.content });
    } catch (e) {
      console.error("Chat fallback error:", e);
      return res.status(e.status || 500).json({ error: e.message });
    }
  }
});

/*── SEARCH  (preview → fallback GPT answer) ──────────────────*/
app.post("/search", async (req, res) => {
  const q = req.body.query;
  if (!q) return res.status(400).json({ error: "No query provided." });

  try {
    const out = await openai.responses.create({
      model : "gpt-4o-mini-search-preview",
      tools : [{ type: "web_search_preview" }],
      input : q
    });
    res.json({ result: out.output_text });
  } catch (err) {
    console.warn("search-preview failed, fallback:", err.message);
    /* let a normal model answer without live data so user still gets a reply */
    try {
      const out = await openai.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: [
          { role: "system", content: "Answer as best you can without real-time web access." },
          { role: "user",   content: q }
        ],
        max_tokens: 400
      });
      res.json({ result: out.choices[0].message.content });
    } catch (e) {
      console.error("Search fallback error:", e);
      res.status(e.status || 500).json({ error: e.message });
    }
  }
});

/*── IMAGE  (gpt-image-1 → DALL·E-3) ─────────────────────────*/
app.post("/image", async (req, res) => {
  try {
    const first = await openai.images.generate({
      model: "gpt-image-1",
      prompt: req.body.prompt,
      size: "1024x1024",
      n: 1,
      response_format: "b64_json"
    });
    return res.json({ image: first.data[0].b64_json });
  } catch (err) {
    console.warn("gpt-image-1 failed, fallback:", err.message);
    try {
      const second = await openai.images.generate({
        model: "dall-e-3",
        prompt: req.body.prompt,
        size: "1024x1024",
        style: "natural",
        n: 1,
        response_format: "b64_json"
      });
      return res.json({ image: second.data[0].b64_json });
    } catch (e) {
      console.error("Image fallback error:", e);
      res.status(e.status || 500).json({ error: e.message });
    }
  }
});

