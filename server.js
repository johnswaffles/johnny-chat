// server.js
// Express server for Johnny Chat with file upload, question answering, and
// image generation functionality.
//
// This file combines the original chat and health endpoints from the
// justaskjohnny.com project with new routes allowing users to upload
// PDF documents or images (PNG, JPEG, etc.), extract their content,
// and ask questions about that content.  It also provides an endpoint
// to generate new images using the GPT‑Image model specified in the
// `IMAGE_MODEL` environment variable.  PDF text is extracted using
// the `pdf-parse` package, while images are described via OpenAI's
// vision models.  Questions and image prompts are answered via the
// configured chat or image model.

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import os from 'os';
import multer from 'multer';
import pdfParse from 'pdf-parse';

// Load environment variables from a .env file when running locally.
dotenv.config();

// Determine the port and chat model.  The chat model can be set
// explicitly via the CHAT_MODEL or TEXT_MODEL environment variables.
const PORT = process.env.PORT || 3000;
const CONFIGURED_MODEL = process.env.CHAT_MODEL || process.env.TEXT_MODEL || 'gpt-5-mini';

/*
 * System prompt that guides the assistant's responses.
 *
 * The following multi‑line string encodes guidelines for restaurant
 * queries, weather, and general formatting.  It is prepended to
 * every chat completion request so that the assistant adheres to
 * these rules.
 */
const SYSTEM_PROMPT = `
You are a concise, helpful assistant for justaskjohnny.com.

GENERAL
- Be accurate and direct. If you’re not certain about a specific fact, say so and suggest how to verify it.
- Use clean, scannable formatting (short paragraphs or bullet lists).
- Make links clickable using Markdown: [Title](https://example.com).

RESTAURANTS (VERY IMPORTANT)
- When the user asks about restaurants (any request for places to eat, “best restaurants”, “where to eat”, etc.),
  ALWAYS provide, for each place, if available:
  • Name
  • Phone number (format: (###) ###-####)
  • Full street address (with city & state)
  • Website (official when possible) — show as a clickable Markdown link
  • Optional: Google Maps link as a secondary link
- If any field cannot be verified, write “not found” rather than guessing.
- Prefer official sources (restaurant site, Google Business, the venue’s social page) over aggregators.

WEATHER (VERY IMPORTANT)
- Default to U.S. units ONLY (°F, mph, inches). Do NOT show Celsius unless the user explicitly asks for it.
- Present the report in a friendly local‑TV meteorologist style:
  • Lead with the headline and the current/near‑term conditions.
  • Give today’s high/low, feels‑like, wind, humidity, and precip chances.
  • Brief daypart breakdown (morning/afternoon/evening/overnight) when useful.
  • Mention any watches/warnings if the user hints at severe weather.
- If you don’t have live data, say that you may not have real‑time access and offer to look it up if tools/search are available.
`;

// Initialise the Express application and middleware.
const app = express();
app.use(express.json());

// Restrict CORS to trusted origins to prevent misuse of the API from
// arbitrary websites.  The environment variables should include your
// deployment domains.  In development you can add other origins as
// necessary.
app.use(cors({
  origin: [
    'https://justaskjohnny.com',
    'https://www.justaskjohnny.com',
    'http://localhost:3000'
  ]
}));

// Initialise the OpenAI client.  The API key must be supplied via
// the OPENAI_API_KEY environment variable.  The image model and
// vision model can also be configured via environment variables.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/*
 * In‑memory cache of the most recent LLM call.  This allows the /status
 * endpoint to report which model was used, system fingerprints, token
 * usage, and latency.  You can expand this object or persist it if
 * deeper analytics are required.
 */
const lastLLM = {
  model: null,
  system_fingerprint: null,
  usage: null,
  ts: null,
  latency_ms: null
};

function logLLM(type, info) {
  // Basic logging helper.  Replace with your preferred logging library
  // in production.
  console.log(`[LLM ${type}]`, info);
}

/*
 * POST /chat and /api/chat
 *
 * This endpoint accepts a message history and optional new user input
 * and forwards the conversation to the configured chat model.  It
 * prepends the SYSTEM_PROMPT on every request to ensure consistent
 * behaviour.  The reply, model and usage metrics are returned to the
 * client.  To maintain privacy the message history is expected to be
 * constructed on the client side and sent with each call.
 */
app.post(['/chat', '/api/chat'], async (req, res) => {
  const t0 = Date.now();
  let messages = [];
  if (Array.isArray(req.body.history)) messages = req.body.history;
  else if (Array.isArray(req.body.messages)) messages = req.body.messages;

  // If an `input` field is provided, append it as the last user message
  if (req.body.input && (!messages.length || messages[messages.length - 1]?.content !== req.body.input)) {
    messages.push({ role: 'user', content: req.body.input });
  }

  if (!messages.length) {
    return res.status(400).json({ error: 'No input or message history provided' });
  }

  // Always prepend the system prompt
  const withSystem = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];

  try {
    const completion = await openai.chat.completions.create({
      model: CONFIGURED_MODEL,
      messages: withSystem
    });
    const reply = completion.choices?.[0]?.message?.content || '';
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
    res.json({ reply, model: usedModel, usage });
  } catch (err) {
    console.error('chat error:', err?.response?.data ?? err);
    res.status(500).json({ error: 'Chat request failed' });
  }
});

/*
 * POST /api/chat2
 *
 * An alternate chat endpoint demonstrating the use of OpenAI’s
 * `responses.create` method, which supports tool execution (such as
 * web search).  If the call fails, the handler gracefully falls back
 * to a normal chat completion.  This endpoint mirrors the behaviour
 * seen in the original justaskjohnny server.
 */
app.post('/api/chat2', async (req, res) => {
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
        tools: [{ type: 'web_search' }],
        tool_choice: 'auto'
      });
    } catch (toolErr) {
      // Fallback to chat completions if responses.create fails
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
      logLLM('chat2-fallback', { model: usedModel, fingerprint, usage, latency });
      return res.json({ reply: completion.choices?.[0]?.message?.content ?? '', model: usedModel, usage });
    }
    // On success, parse the structured response
    const output = r?.output ?? [];
    const text =
      output.flatMap(o => o?.content ?? []).find(c => c?.type === 'output_text')?.text ??
      output.flatMap(o => o?.content ?? [])
        .filter(c => typeof c?.text === 'string')
        .map(c => c.text)
        .join('\n') ??
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

/*
 * Health and status endpoints
 *
 * /health simply reports that the API is running along with the current
 * configured model.  /status provides more detailed information
 * including the last used model, system fingerprint, usage, and
 * server uptime.
 */
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

/*
 * File upload and analysis
 *
 * POST /upload
 * Accepts a single uploaded file (multipart/form-data) under the key
 * `file`.  If the file is a PDF its text is extracted using pdf‑parse.
 * If the file is an image (PNG, JPEG, etc.), it is sent to the
 * vision‑capable model specified by VISION_MODEL.  The extracted text
 * or description is returned to the client.  Unsupported file types
 * return a 400 error.  Files are stored in memory only and are not
 * persisted on disk.
 */
const upload = multer({ storage: multer.memoryStorage() });

app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const fileBuffer = req.file.buffer;
  const mimetype = req.file.mimetype || '';
  try {
    // Handle PDF files
    if (mimetype === 'application/pdf') {
      const data = await pdfParse(fileBuffer);
      const text = data.text || '';
      return res.json({ text });
    }
    // Handle images via vision model
    if (mimetype.startsWith('image/')) {
      const base64 = fileBuffer.toString('base64');
      const imageDataUrl = `data:${mimetype};base64,${base64}`;
      // Use the vision model specified in env or fall back to GPT‑4V
      const visionModel = process.env.VISION_MODEL || 'gpt-4.1-mini';
      const completion = await openai.chat.completions.create({
        model: visionModel,
        messages: [
          { role: 'system', content: 'You are a helpful assistant that describes images and extracts any text they contain.' },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Please describe the image in detail and extract any text in it.' },
              { type: 'image_url', image_url: { url: imageDataUrl } }
            ]
          }
        ]
      });
      const description = completion.choices?.[0]?.message?.content || '';
      return res.json({ text: description });
    }
    return res.status(400).json({ error: 'Unsupported file type' });
  } catch (err) {
    console.error('upload error:', err?.response?.data ?? err);
    return res.status(500).json({ error: 'Failed to process file' });
  }
});

/*
 * Question answering about an uploaded document
 *
 * POST /query
 * Accepts a JSON payload with `text` (the extracted document content)
 * and `question` (the user’s query).  The endpoint sends these to
 * the chat model to generate an answer grounded in the provided
 * context.  The answer is returned as the `answer` field.
 */
app.post('/query', async (req, res) => {
  const { text, question } = req.body || {};
  if (!text || !question) {
    return res.status(400).json({ error: 'Both text and question are required' });
  }
  const t0 = Date.now();
  try {
    const prompt = `You are given a document and a question about that document.\n\nDocument:\n${text}\n\nQuestion: ${question}\n\nAnswer the question accurately using only the information in the document. If the answer is not present, say so.`;
    const completion = await openai.chat.completions.create({
      model: CONFIGURED_MODEL,
      messages: [
        { role: 'system', content: 'You are a helpful assistant that answers questions about provided documents.' },
        { role: 'user', content: prompt }
      ]
    });
    const answer = completion.choices?.[0]?.message?.content || '';
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
    res.json({ answer: answer.trim(), model: usedModel, usage });
  } catch (err) {
    console.error('query error:', err?.response?.data ?? err);
    res.status(500).json({ error: 'Failed to answer question' });
  }
});

/*
 * Image generation
 *
 * POST /generate-image
 * Accepts a JSON payload with `prompt` describing the desired image and
 * an optional `size` (e.g. "1024x1024").  It uses the image model
 * specified by IMAGE_MODEL to generate a new picture and returns the
 * base64 representation of the generated image.  Clients can convert
 * the base64 string into a data URL for display or download.
 */
app.post('/generate-image', async (req, res) => {
  const { prompt, size } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required for image generation' });
  }
  try {
    const model = process.env.IMAGE_MODEL || 'gpt-image-1';
    const response = await openai.images.generate({
      model,
      prompt,
      n: 1,
      size: size || '1024x1024',
      response_format: 'b64_json'
    });
    const imageBase64 = response.data?.[0]?.b64_json;
    if (!imageBase64) {
      return res.status(500).json({ error: 'No image data returned' });
    }
    res.json({ image: imageBase64 });
  } catch (err) {
    console.error('generate-image error:', err?.response?.data ?? err);
    res.status(500).json({ error: 'Image generation failed' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`✅ Server running on :${PORT} (configured chat model: ${CONFIGURED_MODEL})`);
});
