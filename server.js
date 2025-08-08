// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import os from 'os';

dotenv.config();

const PORT = process.env.PORT || 3000;
const CONFIGURED_MODEL =
  process.env.CHAT_MODEL || process.env.TEXT_MODEL || 'gpt-5-mini';

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

function logLLM(prefix, { model, fingerprint, usage, latency }) {
  console.log(
    `[${prefix}] model=${model}` +
      (fingerprint ? ` fp=${fingerprint}` : '') +
      (usage?.total_tokens != null
        ? ` tokens total=${usage.total_tokens} (prompt=${usage.prompt_tokens ?? 0}, completion=${usage.completion_tokens ?? 0})`
        : '') +
      (latency != null ? ` latency=${latency}ms` : '')
  );
}

/* ===========================================
   1) Classic Chat (no tools)
=========================================== */
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

    Object.assign(lastLLM, {
      model: usedModel,
      system_fingerprint: fingerprint,
      usage,
      ts: Date.now(),
      latency_ms: latency
    });

    res.set('X-LLM-Model', usedModel);
    if (fingerprint) res.set('X-LLM-Fingerprint', fingerprint);

    logLLM('chat', { model: usedModel, fingerprint, usage, latency });

    const reply = completion.choices?.[0]?.message?.content ?? '';
    res.json({ reply, model: usedModel, usage });
  } catch (err) {
    console.error('Chat error:', err?.response?.data ?? err);
    res.status(500).json({ error: 'Chat request failed' });
  }
});

/* ==========================================================
   2) SAFE real-time route (no hard-required tools)
      - Enables web_search but NEVER "requires" it.
      - If Responses API or tools error, FALL BACK to classic chat.
========================================================== */
app.post(['/api/chat2'], async (req, res) => {
  const t0 = Date.now();
  try {
    const userInput = req.body?.input ?? '';
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    if (!userInput && history.length === 0) return res.status(400).json({ error: 'No input' });

    const input = [
      { role: 'system', content: 'You are a concise, helpful assistant. Use web search only when clearly necessary.' },
      ...history,
      { role: 'user', content: userInput }
    ];

    let r;
    try {
      r = await openai.responses.create({
        model: CONFIGURED_MODEL,
        input,
        tools: [{ type: 'web_search' }], // allowed
        tool_choice: 'auto'              // never "required"
      });
    } catch (toolErr) {
      console.warn('responses.create failed; falling back to chat:', toolErr?.response?.data || toolErr);

      const completion = await openai.chat.completions.create({
        model: CONFIGURED_MODEL,
        messages: input.map(m => ({ role: m.role, content: m.content }))
      });

      const usedModel = completion.model || CONFIGURED_MODEL;
      const fingerprint = completion.system_fingerprint ?? null;
      const usage = completion.usage ?? null;
      const latency = Date.now() - t0;

      Object.assign(lastLLM, {
        model: usedModel,
        system_fingerprint: fingerprint,
        usage,
        ts: Date.now(),
        latency_ms: latency
      });

      res.set('X-LLM-Model', usedModel);
      if (fingerprint) res.set('X-LLM-Fingerprint', fingerprint);
      res.set('X-LLM-Tools-Used', 'fallback');

      logLLM('chat2-fallback', { model: usedModel, fingerprint, usage, latency });

      const reply = completion.choices?.[0]?.message?.content ?? 'No output.';
      return res.json({ reply, model: usedModel, usage });
    }

    const output = r.output ?? [];
    const text =
      r.output_text ??
      output.flatMap(o => o?.content ?? []).find(c => c?.type === 'output_text')?.text ??
      output.flatMap(o => o?.content ?? []).filter(c => typeof c?.text === 'string').map(c => c.text).join('\n') ??
      'No text output.';

    const usedModel = r.model || CONFIGURED_MODEL;
    const fingerprint = r.system_fingerprint ?? null;
    const usage = r.usage ?? null;
    const latency = Date.now() - t0;

    Object.assign(lastLLM, {
      model: usedModel,
      system_fingerprint: fingerprint,
      usage,
      ts: Date.now(),
      latency_ms: latency
    });

    res.set('X-LLM-Model', usedModel);
    if (fingerprint) res.set('X-LLM-Fingerprint', fingerprint);
    res.set('X-LLM-Tools-Used', 'auto-or-none');

    logLLM('chat2', { model: usedModel, fingerprint, usage, latency });

    res.json({ reply: text, model: usedModel, usage });
  } catch (err) {
    console.error('chat2 error:', err?.response?.data ?? err);
    res.status(500).json({ error: 'Chat2 request failed' });
  }
});

/* ----------- Health / Status / Debug ----------- */
app.get(['/health', '/api/health'], (_req, res) => {
  res.json({ status: 'ok', model: CONFIGURED_MODEL });
});

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
