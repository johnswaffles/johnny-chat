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

/* -----------------------------
   Output & behavior guidelines
------------------------------*/
const SYSTEM_PROMPT = `
You are a concise, helpful assistant for justaskjohnny.com.

GENERAL
- Be accurate and direct. If you’re not certain about a specific fact, say so and suggest how to verify it.
- Use clean, scannable formatting (short paragraphs or bullet lists).
- Make links clickable using Markdown: [Title](https://example.com).

RESTAURANTS (VERY IMPORTANT)
- When the user asks about restaurants (any request for places to eat, “best restaurants”, “where to eat”, etc.), ALWAYS provide, for each place, if available:
  • Name
  • Phone number (format: (###) ###-####)
  • Full street address (with city & state)
  • Website (official when possible) — show as a clickable Markdown link
  • Optional: Google Maps link as a secondary link
- If any field cannot be verified, write “not found” rather than guessing.
- Prefer official sources (restaurant site, Google Business, the venue’s social page) over aggregators.

WEATHER (VERY IMPORTANT)
- Default to U.S. units ONLY (°F, mph, inches). Do NOT show Celsius unless the user explicitly asks for it.
- Present the report in a friendly local-TV meteorologist style:
  • Lead with the headline and the current/near-term conditions.
  • Give today’s high/low, feels-like, wind, humidity, and precip chances.
  • Brief daypart breakdown (morning/afternoon/evening/overnight) when useful.
  • Mention any watches/warnings if the user hints at severe weather.
- If you don’t have live data, say that you may not have real-time access and offer to look it up if tools/search are available.
`;

/* -------------------- app & client -------------------- */
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

/* ------------- last-seen model/status cache ------------ */
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
      (latency != null ? ` latency=${latency}ms`
        : '')
  );
}

/* =======================================================
   1) Classic Chat Completions (no tools)
   - Prepends SYSTEM_PROMPT so the bot follows your rules
======================================================= */
app.post(['/chat', '/api/chat'], async (req, res) => {
  const t0 = Date.now();

  let messages = [];
  if (Array.isArray(req.body.history)) messages = req.body.history;
  else if (Array.isArray(req.body.messages)) messages = req.body.messages;

  if (req.body.input && (!messages.length || messages[messages.length - 1]?.content !== req.body.input)) {
    messages.push({ role: 'user', content: req.body.input });
  }

  if (!messages.length) return res.status(400).json({ error: 'No input or message history provided' });

  // Always inject our behavior guide at the front
  const withSystem = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];

  try {
    const completion = await openai.chat.completions.create({
      model: CONFIGURED_MODEL,
      messages: withSystem
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

/* =====================================================================
   2) SAFE “real-time” route (optional tools, never required) – /api/chat2
   - Enables web_search (if available to your account), but NEVER forces it.
   - If Responses API/tooling fails, falls back to classic chat.
   - Also injects SYSTEM_PROMPT for restaurant & weather behavior.
===================================================================== */
app.post(['/api/chat2'], async (req, res) => {
  const t0 = Date.now();
  try {
    const userInput = req.body?.input ?? '';
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    if (!userInput && history.length === 0) return res.status(400).json({ error: 'No input' });

    const input = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: userInput }
    ];

    let r;
    try {
      r = await openai.responses.create({
        model: CONFIGURED_MODEL,
        input,
        tools: [{ type: 'web_search' }], // allowed, not required
        tool_choice: 'auto'
      });
    } catch (toolErr) {
      // Graceful fallback to Completions if Responses/tooling isn't available
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

/* -------------------- Health / Status / Debug -------------------- */
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
