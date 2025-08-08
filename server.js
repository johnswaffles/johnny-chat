// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import os from 'os';

dotenv.config();

const PORT  = process.env.PORT || 3000;
const MODEL = process.env.CHAT_MODEL || 'gpt-5-mini';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app = express();

// Allow your site + localhost
app.use(cors({
  origin: [
    'https://justaskjohnny.com',
    'https://www.justaskjohnny.com',
    'http://localhost:3000'
  ]
}));
app.use(express.json());

// keep last-seen model/usage for status + debugging
const lastLLM = {
  model: null,
  system_fingerprint: null,
  usage: null,           // { prompt_tokens, completion_tokens, total_tokens } for chat.completions
  ts: null,
  latency_ms: null
};

// Chat endpoint
app.post(['/chat', '/api/chat'], async (req, res) => {
  const t0 = Date.now();
  let messages = [];

  // If full history provided
  if (Array.isArray(req.body.history)) {
    messages = req.body.history;
  } else if (Array.isArray(req.body.messages)) {
    messages = req.body.messages;
  }

  // If only "input" string provided, wrap it
  if (req.body.input && (!messages.length || messages[messages.length - 1]?.content !== req.body.input)) {
    messages.push({ role: 'user', content: req.body.input });
  }

  if (!messages.length) {
    return res.status(400).json({ error: 'No input or message history provided' });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.7
    });

    const usedModel = completion.model || MODEL;
    const fingerprint = completion.system_fingerprint ?? null;
    const usage = completion.usage ?? null;
    const latency = Date.now() - t0;

    // save for /api/status
    lastLLM.model = usedModel;
    lastLLM.system_fingerprint = fingerprint;
    lastLLM.usage = usage;
    lastLLM.ts = Date.now();
    lastLLM.latency_ms = latency;

    // expose via headers
    res.set('X-LLM-Model', usedModel);
    if (fingerprint) res.set('X-LLM-Fingerprint', fingerprint);

    // console log every call (easy to see in Render logs)
    console.log(
      `[chat] model=${usedModel}` +
      (fingerprint ? ` fp=${fingerprint}` : '') +
      (usage ? ` tokens total=${usage.total_tokens} (prompt=${usage.prompt_tokens}, completion=${usage.completion_tokens})` : '') +
      ` latency=${latency}ms`
    );

    const reply =
      completion.choices?.[0]?.message?.content ??
      '';

    res.json({ reply, model: usedModel, usage });
  } catch (err) {
    console.error('Chat error:', err?.response?.data ?? err);
    res.status(500).json({ error: 'Chat request failed' });
  }
});

// Health check
app.get(['/health', '/api/health'], (_req, res) => {
  res.json({ status: 'ok', model: MODEL });
});

// Status endpoint: shows configured vs last-seen model + usage/fingerprint
app.get(['/status', '/api/status'], (_req, res) => {
  res.json({
    configuredModel: MODEL,
    lastSeenModel: lastLLM.model,
    systemFingerprint: lastLLM.system_fingerprint,
    lastUsage: lastLLM.usage,
    lastSeenAt: lastLLM.ts,
    lastLatencyMs: lastLLM.latency_ms,
    node: process.version,
    host: os.hostname(),
    uptimeSeconds: Math.floor(process.uptime())
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on :${PORT} (configured model: ${MODEL})`);
});
