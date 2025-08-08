// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import os from 'os';

dotenv.config();

const PORT  = process.env.PORT || 3000;
// Accept either CHAT_MODEL (preferred) or TEXT_MODEL, then fallback
const CONFIGURED_MODEL = process.env.CHAT_MODEL || process.env.TEXT_MODEL || 'gpt-4.1-mini';

const app = express();
app.use(express.json());

// Allow your site + localhost
app.use(cors({
  origin: [
    'https://justaskjohnny.com',
    'https://www.justaskjohnny.com',
    'http://localhost:3000'
  ]
}));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Track last-seen info for /status
const lastLLM = {
  model: null,
  system_fingerprint: null,
  usage: null,        // chat.completions: {prompt_tokens, completion_tokens, total_tokens}
  ts: null,
  latency_ms: null
};

// --- Chat endpoint (compatible with your current frontend) ---
app.post(['/chat', '/api/chat'], async (req, res) => {
  const t0 = Date.now();

  // Accept history/messages or a single input string
  let messages = [];
  if (Array.isArray(req.body.history)) messages = req.body.history;
  else if (Array.isArray(req.body.messages)) messages = req.body.messages;

  if (req.body.input && (!messages.length || messages[messages.length - 1]?.content !== req.body.input)) {
    messages.push({ role: 'user', content: req.body.input });
  }

  if (!messages.length) {
    return res.status(400).json({ error: 'No input or message history provided' });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: CONFIGURED_MODEL,
      messages,
      temperature: 0.7
    });

    const usedModel   = completion.model || CONFIGURED_MODEL;
    const fingerprint = completion.system_fingerprint ?? null;
    const usage       = completion.usage ?? null;
    const latency     = Date.now() - t0;

    // Save for /status
    lastLLM.model = usedModel;
    lastLLM.system_fingerprint = fingerprint;
    lastLLM.usage = usage;
    lastLLM.ts = Date.now();
    lastLLM.latency_ms = latency;

    // Surface in headers
    res.set('X-LLM-Model', usedModel);
    if (fingerprint) res.set('X-LLM-Fingerprint', fingerprint);

    // Console log every call (shows in Render logs)
    console.log(
      `[chat] model=${usedModel}` +
      (fingerprint ? ` fp=${fingerprint}` : '') +
      (usage ? ` tokens total=${usage.total_tokens} (prompt=${usage.prompt_tokens}, completion=${usage.completion_tokens})` : '') +
      ` latency=${latency}ms`
    );

    const reply = completion.choices?.[0]?.message?.content ?? '';
    res.json({ reply, model: usedModel, usage });
  } catch (err) {
    console.error('Chat error:', err?.response?.data ?? err);
    res.status(500).json({ error: 'Chat request failed' });
  }
});

// --- Health check (both /health and /api/health) ---
app.get(['/health', '/api/health'], (_req, res) => {
  res.json({ status: 'ok', model: CONFIGURED_MODEL });
});

// --- Status (both /status and /api/status) ---
app.get(['/status', '/api/status'], (_req, res) => {
  res.json({
    configuredModel: CONFIGURED_MODEL,
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

// --- Debug route to verify what build is live on Render ---
app.get('/__whoami', (_req, res) => {
  res.json({
    ok: true,
    commit: process.env.RENDER_GIT_COMMIT || 'unknown',
    configuredModel: CONFIGURED_MODEL,
    file: import.meta.url,
    cwd: process.cwd()
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on :${PORT} (configured model: ${CONFIGURED_MODEL})`);
});
