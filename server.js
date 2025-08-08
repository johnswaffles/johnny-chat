// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import os from 'os';
import fetch from 'node-fetch'; // For web requests

dotenv.config();

const PORT = process.env.PORT || 3000;
const CONFIGURED_MODEL = process.env.CHAT_MODEL || process.env.TEXT_MODEL || 'gpt-5-mini';

const app = express();
app.use(express.json());

app.use(cors({
  origin: [
    'https://justaskjohnny.com',
    'https://www.justaskjohnny.com',
    'http://localhost:3000'
  ]
}));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const lastLLM = {
  model: null,
  system_fingerprint: null,
  usage: null,
  ts: null,
  latency_ms: null
};

// Main Chat Endpoint
app.post(['/chat', '/api/chat'], async (req, res) => {
  const t0 = Date.now();

  let messages = [];
  if (Array.isArray(req.body.history)) messages = req.body.history;
  else if (Array.isArray(req.body.messages)) messages = req.body.messages;

  if (req.body.input && (!messages.length || messages[messages.length - 1]?.content !== req.body.input)) {
    messages.push({ role: 'user', content: req.body.input });
  }

  if (!messages.length) return res.status(400).json({ error: 'No input or message history provided' });

  try {
    const completion = await openai.chat.completions.create({
      model: CONFIGURED_MODEL,
      messages
    });

    const usedModel = completion.model || CONFIGURED_MODEL;
    const fingerprint = completion.system_fingerprint ?? null;
    const usage = completion.usage ?? null;
    const latency = Date.now() - t0;

    lastLLM.model = usedModel;
    lastLLM.system_fingerprint = fingerprint;
    lastLLM.usage = usage;
    lastLLM.ts = Date.now();
    lastLLM.latency_ms = latency;

    res.set('X-LLM-Model', usedModel);
    if (fingerprint) res.set('X-LLM-Fingerprint', fingerprint);

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

// Real-Time Info (Web Search Simulation) Endpoint
app.post(['/realtime', '/api/realtime'], async (req, res) => {
  const query = req.body.query;
  if (!query) return res.status(400).json({ error: 'No query provided' });

  try {
    // Example: Fetch Bing search results (replace with your search API if desired)
    const searchApiKey = process.env.BING_API_KEY; // Set in .env
    const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}`;

    const searchRes = await fetch(url, {
      headers: { 'Ocp-Apim-Subscription-Key': searchApiKey }
    });

    if (!searchRes.ok) throw new Error(`Search API error: ${searchRes.statusText}`);
    const data = await searchRes.json();

    res.json({ query, results: data });
  } catch (error) {
    console.error('Realtime search error:', error);
    res.status(500).json({ error: 'Realtime search failed' });
  }
});

// Health Check
app.get(['/health', '/api/health'], (_req, res) => {
  res.json({ status: 'ok', model: CONFIGURED_MODEL });
});

// Status Check
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

// Whoami
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
