// at top of server.js, after your imports & app initialization…

/*── WEB SEARCH ───────────────────────────────────────────────*/
app.post('/search', async (req, res) => {
  try {
    const { query } = req.body;
    const out = await openai.responses.create({
      model:    'o4-mini',
      tools:    [{ type: 'web_search_preview' }],
      input:    query
    });
    res.json({ text: out.output_text });
  } catch(err) {
    console.error('Search error:', err);
    res.status(500).json({ error: err.message });
  }
});

// …then your existing /chat, /speech, /image, /vision routes follow unchanged.

