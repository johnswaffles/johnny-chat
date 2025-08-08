import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import os from 'os';
import multer from 'multer';
import cheerio from 'cheerio';
import RSSParser from 'rss-parser';

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
const rss = new RSSParser();

/* =========== telemetry helpers =========== */
const lastLLM = { model:null, system_fingerprint:null, usage:null, ts:null, latency_ms:null };
function trackAndReply(res, completion, t0, extraHeaders = {}) {
  const usedModel = completion.model || CONFIGURED_MODEL;
  const fingerprint = completion.system_fingerprint ?? null;
  const usage = completion.usage ?? null;
  const latency = Date.now() - t0;
  Object.assign(lastLLM, { model:usedModel, system_fingerprint:fingerprint, usage, ts:Date.now(), latency_ms:latency });
  res.set('X-LLM-Model', usedModel);
  if (fingerprint) res.set('X-LLM-Fingerprint', fingerprint);
  for (const [k,v] of Object.entries(extraHeaders)) res.set(k, v);
  const reply = completion.choices?.[0]?.message?.content ?? '';
  res.json({ reply, model: usedModel, usage });
}
function minimalMessages(body) {
  let messages = [];
  if (Array.isArray(body.history)) messages = body.history;
  else if (Array.isArray(body.messages)) messages = body.messages;
  if (body.input && (!messages.length || messages[messages.length-1]?.content !== body.input)) {
    messages.push({ role:'user', content: body.input });
  }
  return messages;
}

/* =========== fetch helpers (no keys) =========== */
const UA = 'JohnnyBot/1.0 (+https://justaskjohnny.com)';
async function fetchJSON(u) {
  const r = await fetch(u, { headers:{ 'user-agent': UA }});
  if (!r.ok) throw new Error(`Fetch ${u} failed: ${r.status}`);
  return await r.json();
}
async function fetchText(u) {
  const r = await fetch(u, { headers:{ 'user-agent': UA }});
  if (!r.ok) throw new Error(`Fetch ${u} failed: ${r.status}`);
  return await r.text();
}
function extractReadable(html, baseUrl) {
  const $ = cheerio.load(html);
  $('script,style,noscript,header,footer,svg,iframe').remove();
  const title = $('title').first().text().trim() || baseUrl;
  let main = $('article').text() || $('main').text() ||
             $('[role=main]').text() || $('.article,.post,.story').text();
  if (!main || main.trim().length < 400) main = $('body').text();
  const text = (main || '').replace(/\s+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  return { title, text: text.slice(0, 12000) }; // cap to keep tokens sane
}

/* =========== intent detectors =========== */
const WEATHER_RE = /\b(weather|forecast|temperature|temp|rain|snow|wind|humidity|uv|heat index)\b/i;
const NEWS_RE    = /\bnews|headlines?|latest on|breaking|what (happened|is happening)\b/i;
const FIN_RE     = /\b(stock|share|ticker|quote|price|market|nasdaq|nyse|dow|s&p|sp500|crypto|bitcoin|btc|eth|ethereum)\b/i;
const RECENT_RE  = /\b(today|now|this (week|month|year)|latest|recent|who won|score|earnings|release|launched|updated|announced)\b/i;

/* =========== tools: weather =========== */
async function toolWeather(userText) {
  // naive place extraction: try trailing "in X", else let model handle place name text
  const place = (userText.match(/\bin\s+([A-Za-z.\s'-]+)$/i)?.[1] || userText).trim();
  const q = encodeURIComponent(place);
  const geo = await fetchJSON(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=${q}`);
  if (!geo?.results?.length) throw new Error('No location found');
  const g = geo.results[0];
  const lat = g.latitude, lon = g.longitude, placeName = [g.name, g.admin1, g.country].filter(Boolean).join(', ');
  const meteo = await fetchJSON(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,is_day,precipitation,wind_speed_10m,wind_direction_10m,relative_humidity_2m&hourly=temperature_2m,precipitation_probability,wind_speed_10m,weathercode&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto`);
  return { placeName, meteo };
}

/* =========== tools: generic web search (DDG → fetch top pages) =========== */
async function searchDDG(q) {
  try {
    const html = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}&kl=us-en`);
    const $ = cheerio.load(html);
    const items = [];
    $('.result').slice(0, 8).each((i,el)=>{
      const a = $(el).find('a.result__a').first();
      const url = a.attr('href'); const title = a.text().trim();
      const snippet = $(el).find('.result__snippet').text().trim();
      if (url && title) items.push({ url, title, snippet });
    });
    return items;
  } catch (e) {
    // fallback: Bing (basic)
    const html = await fetchText(`https://www.bing.com/search?q=${encodeURIComponent(q)}`);
    const $ = cheerio.load(html);
    const items = [];
    $('li.b_algo').slice(0, 8).each((i,el)=>{
      const a = $(el).find('h2 a').first();
      const url = a.attr('href'); const title = a.text().trim();
      const snippet = $(el).find('.b_caption p').text().trim();
      if (url && title) items.push({ url, title, snippet });
    });
    return items;
  }
}
async function fetchArticles(items, limit=3) {
  const picked = items.slice(0, limit);
  const out = [];
  for (const it of picked) {
    try {
      const html = await fetchText(it.url);
      const { title, text } = extractReadable(html, it.url);
      out.push({ url: it.url, title: title || it.title, snippet: it.snippet || '', text });
    } catch {}
  }
  return out;
}

/* =========== tools: news (Google News RSS) =========== */
async function toolNews(q) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
  const feed = await rss.parseURL(url);
  const items = (feed.items || []).slice(0, 8).map(it => ({ title: it.title, url: it.link, snippet: it.contentSnippet || '' }));
  const articles = await fetchArticles(items, 3);
  return { items, articles };
}

/* =========== tools: finance (stocks via Stooq, crypto via CoinGecko) =========== */
function inferTicker(q) {
  // crude: prefer $AAPL or uppercase 1–5 chars
  const m1 = q.match(/\$([A-Za-z]{1,5})\b/); if (m1) return m1[1].toLowerCase();
  const m2 = q.match(/\b([A-Z]{1,5})\b/); if (m2) return m2[1].toLowerCase();
  return null;
}
async function toolFinance(q) {
  const ticker = inferTicker(q);
  let stock=null, crypto=null, used='';

  if (ticker) {
    try {
      const csv = await fetchText(`https://stooq.com/q/l/?s=${ticker}&f=sd2t2ohlcv&h&e=csv`);
      // Symbol,Date,Time,Open,High,Low,Close,Volume
      const lines = csv.trim().split('\n'); if (lines.length>1) {
        const row = lines[1].split(',');
        stock = { symbol: row[0], date: row[1], time: row[2], open: row[3], high: row[4], low: row[5], close: row[6], volume: row[7] };
        used='stock';
      }
    } catch {}
  }

  if (!stock) {
    // try crypto by guess
    const ids = ['bitcoin','ethereum','solana','dogecoin','cardano','ripple','litecoin'];
    const pick = ids.find(id => q.toLowerCase().includes(id) || q.toLowerCase().includes(id.slice(0,3)));
    if (pick) {
      const js = await fetchJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${pick}&vs_currencies=usd`);
      crypto = { id: pick, usd: js[pick]?.usd };
      used='crypto';
    }
  }
  return { stock, crypto, used };
}

/* =========== endpoints =========== */

/* Plain chat (no tools) */
app.post(['/api/chat2','/chat2'], async (req, res) => {
  const t0 = Date.now();
  const messages = minimalMessages(req.body);
  if (!messages.length) return res.status(400).json({ error:'No input or message history provided' });
  try {
    const completion = await openai.chat.completions.create({ model: CONFIGURED_MODEL, messages });
    trackAndReply(res, completion, t0, { 'X-LLM-Tools-Used': 'none' });
  } catch (err) {
    console.error('Chat2 error:', err?.response?.data ?? err);
    res.status(500).json({ error:'Chat2 request failed' });
  }
});

/* Vision chat: multipart/form-data with "images" files */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8*1024*1024, files: 4 } });
app.post(['/api/chat-image','/chat-image'], upload.array('images', 4), async (req, res) => {
  const t0 = Date.now();
  try {
    let messages = [];
    if (req.body.history) { try { messages = JSON.parse(req.body.history); } catch(_) {} }
    const userText = (req.body.input||'').toString().trim();

    const parts = [];
    if (userText) parts.push({ type:'text', text:userText });
    for (const f of (req.files||[])) {
      const b64 = f.buffer.toString('base64');
      const url = `data:${f.mimetype};base64,${b64}`;
      parts.push({ type:'image_url', image_url:{ url }});
    }
    if (!parts.length) return res.status(400).json({ error:'No text or images provided' });

    if (messages.length && messages[messages.length-1].role === 'user') {
      const last = messages[messages.length-1];
      last.content = Array.isArray(last.content) ? last.content.concat(parts)
        : [{ type:'text', text:String(last.content||'') }, ...parts];
    } else {
      messages.push({ role:'user', content: parts });
    }

    const completion = await openai.chat.completions.create({ model: CONFIGURED_MODEL, messages });
    trackAndReply(res, completion, t0, { 'X-LLM-Tools-Used': 'vision' });
  } catch (err) {
    console.error('Chat-Image error:', err?.response?.data ?? err);
    res.status(500).json({ error:'Chat-Image request failed' });
  }
});

/* Smart tools: weather, news, finance, generic web */
app.post(['/api/chat-tools','/chat-tools'], async (req, res) => {
  const t0 = Date.now();
  const userText = String(req.body.input||'').trim();
  const messages = minimalMessages(req.body);
  let toolsUsed = 'none';

  try {
    // WEATHER
    if (WEATHER_RE.test(userText)) {
      toolsUsed = 'weather';
      const { placeName, meteo } = await toolWeather(userText);
      const sys = [
        "You are Johnny, a TV-style meteorologist. Use **Fahrenheit** unless user asks for Celsius.",
        "Return: current conditions, today's high/low, precip chances, wind, short outlook.",
        "Be crisp and conversational, like a local on-air weather hit."
      ].join(' ');
      const content = [
        { role:'system', content: sys },
        { role:'user', content: `Location: ${placeName}\nRaw weather JSON (Open-Meteo):\n${JSON.stringify(meteo).slice(0,15000)}\n\nUser request: ${userText}` }
      ];
      const completion = await openai.chat.completions.create({ model: CONFIGURED_MODEL, messages: content });
      return trackAndReply(res, completion, t0, { 'X-LLM-Tools-Used': toolsUsed });
    }

    // NEWS
    if (NEWS_RE.test(userText)) {
      toolsUsed = 'news';
      const { items, articles } = await toolNews(userText);
      const sys = "Summarize the latest news for the user's query in a tight, balanced brief. End with a 'Sources' list of markdown links.";
      const content = [
        { role:'system', content: sys },
        { role:'user', content: `Query: ${userText}\nTop feeds: ${JSON.stringify(items.slice(0,6))}\nFetched articles (trimmed): ${JSON.stringify(articles).slice(0,12000)}` }
      ];
      const completion = await openai.chat.completions.create({ model: CONFIGURED_MODEL, messages: content });
      return trackAndReply(res, completion, t0, { 'X-LLM-Tools-Used': toolsUsed });
    }

    // FINANCE
    if (FIN_RE.test(userText)) {
      toolsUsed = 'finance';
      const fin = await toolFinance(userText);
      const sys = "Give the latest quote (stocks or crypto) with a one-sentence context and today's move if available.";
      const content = [
        { role:'system', content: sys },
        { role:'user', content: `User query: ${userText}\nData: ${JSON.stringify(fin)}` }
      ];
      const completion = await openai.chat.completions.create({ model: CONFIGURED_MODEL, messages: content });
      return trackAndReply(res, completion, t0, { 'X-LLM-Tools-Used': toolsUsed });
    }

    // GENERIC RECENT or "latest" info → web search + summarize with citations
    if (RECENT_RE.test(userText)) {
      toolsUsed = 'web';
      const serp = await searchDDG(userText);
      const articles = await fetchArticles(serp, 3);
      const sys = "Answer the user's question using the provided web extracts. Keep it concise, and include a 'Sources' list with markdown links.";
      const content = [
        { role:'system', content: sys },
        { role:'user', content: `Query: ${userText}\nSERP: ${JSON.stringify(serp.slice(0,6))}\nArticles (trimmed): ${JSON.stringify(articles).slice(0,12000)}` }
      ];
      const completion = await openai.chat.completions.create({ model: CONFIGURED_MODEL, messages: content });
      return trackAndReply(res, completion, t0, { 'X-LLM-Tools-Used': toolsUsed });
    }

    // fallback → plain chat
    const completion = await openai.chat.completions.create({ model: CONFIGURED_MODEL, messages });
    trackAndReply(res, completion, t0, { 'X-LLM-Tools-Used': toolsUsed });
  } catch (err) {
    console.error('Chat-Tools error:', err?.response?.data ?? err);
    res.status(500).json({ error:'Chat-Tools request failed' });
  }
});

/* health/status/whoami */
app.get(['/api/health','/health'], (_req, res) => res.json({ status:'ok', model: CONFIGURED_MODEL }));
app.get(['/api/status','/status'], (_req, res) => res.json({
  configuredModel: CONFIGURED_MODEL,
  lastSeenModel: lastLLM.model,
  systemFingerprint: lastLLM.system_fingerprint,
  lastUsage: lastLLM.usage, lastSeenAt: lastLLM.ts, lastLatencyMs: lastLLM.latency_ms,
  node: process.version, host: os.hostname(), uptimeSeconds: Math.floor(process.uptime())
}));
app.get('/__whoami', (_req, res) => res.json({
  ok:true, commit: process.env.RENDER_GIT_COMMIT || 'unknown',
  configuredModel: CONFIGURED_MODEL, file: import.meta.url, cwd: process.cwd()
}));

app.listen(PORT, () => console.log(`✅ Server running on :${PORT} (configured model: ${CONFIGURED_MODEL})`));
