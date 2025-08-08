import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import os from 'os';
import multer from 'multer';

dotenv.config();

const PORT = process.env.PORT || 3000;
const CONFIGURED_MODEL = process.env.CHAT_MODEL || process.env.TEXT_MODEL || 'gpt-4.1-mini';
const app = express();

app.use(express.json({ limit: '2mb' }));
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

function trackAndReply(res, completion, t0, extraHeaders = {}) {
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
  Object.entries(extraHeaders).forEach(([k, v]) => res.set(k, v));

  const reply = completion.choices?.[0]?.message?.content ?? '';
  res.json({ reply, model: usedModel, usage });
}

function minimalMessages(body) {
  let messages = [];
  if (Array.isArray(body.history)) messages = body.history;
  else if (Array.isArray(body.messages)) messages = body.messages;

  if (body.input && (!messages.length || messages[messages.length - 1]?.content !== body.input)) {
    messages.push({ role: 'user', content: body.input });
  }
  return messages;
}

/* Safe chat (JSON only) — no tools required, graceful fallback */
app.post(['/api/chat2','/chat2'], async (req, res) => {
  const t0 = Date.now();
  const messages = minimalMessages(req.body);
  if (!messages.length) return res.status(400).json({ error: 'No input or message history provided' });

  try {
    const completion = await openai.chat.completions.create({
      model: CONFIGURED_MODEL,
      messages
    });
    trackAndReply(res, completion, t0, { 'X-LLM-Tools-Used': 'none' });
  } catch (err) {
    console.error('Chat2 error:', err?.response?.data ?? err);
    res.status(500).json({ error: 'Chat2 request failed' });
  }
});

/* Image/vision chat — accepts multipart/form-data with files named "images" */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 4 }
});

app.post(['/api/chat-image','/chat-image'], upload.array('images', 4), async (req, res) => {
  const t0 = Date.now();
  try {
    let messages = [];
    if (req.body.history) {
      try { messages = JSON.parse(req.body.history); } catch (_) {}
    }
    const userText = (req.body.input || '').toString().trim();

    const parts = [];
    if (userText) parts.push({ type: 'text', text: userText });

    for (const f of (req.files || [])) {
      const b64 = f.buffer.toString('base64');
      const url = `data:${f.mimetype};base64,${b64}`;
      parts.push({ type: 'image_url', image_url: { url } });
    }

    if (!parts.length) return res.status(400).json({ error: 'No text or images provided' });

    // If the last user message already exists, add a new turn; else create one
    if (messages.length && messages[messages.length - 1].role === 'user') {
      // append to last user content if it is an array already, else wrap
      const last = messages[messages.length - 1];
      if (Array.isArray(last.content)) last.content.push(...parts);
      else last.content = [{ type:'text', text: String(last.content || '') }, ...parts];
    } else {
      messages.push({ role: 'user', content: parts });
    }

    const completion = await openai.chat.completions.create({
      model: CONFIGURED_MODEL,
      messages
    });

    trackAndReply(res, completion, t0, { 'X-LLM-Tools-Used': 'vision' });
  } catch (err) {
    console.error('Chat-Image error:', err?.response?.data ?? err);
    res.status(500).json({ error: 'Chat-Image request failed' });
  }
});

/* Health + status + whoami */
app.get(['/api/health','/health'], (_req, res) => {
  res.json({ status: 'ok', model: CONFIGURED_MODEL });
});

app.get(['/api/status','/status'], (_req, res) => {
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
