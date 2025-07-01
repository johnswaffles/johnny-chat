import { Router } from 'express';
import fetch from 'node-fetch';

const router = Router();

const OPENAI_KEY   = process.env.OPENAI_API_KEY;
const RESP_URL     = 'https://api.openai.com/v1/responses';
const BETA_HEADER  = 'assistants=v2';
const TEXT_MODEL   = process.env.TEXT_MODEL  || 'o4-mini';
const TOOL_SPEC    = [{ type: 'web_search' }];

router.post('/chat', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input?.trim()) return res.status(400).json({ error: 'input required' });

    const body = {
      model: TEXT_MODEL,
      input,
      tools: TOOL_SPEC
    };

    const r = await fetch(RESP_URL, {
      method: 'POST',
      headers: {
        Authorization : `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta' : BETA_HEADER
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: err.error?.message || r.statusText });
    }

    const data  = await r.json();
    const reply = data?.output?.[0]?.text
               ?? data?.choices?.[0]?.message?.content?.[0]?.text
               ?? '(no content)';
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
