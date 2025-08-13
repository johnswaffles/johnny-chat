import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { getDocumentProxy, extractText } from "unpdf";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

const allowOrigins = (process.env.CORS_ORIGIN || "*").split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: allowOrigins.includes("*") ? true : allowOrigins, methods: ["GET", "POST", "OPTIONS"] }));

app.use("/johnny-chat", express.static(path.join(__dirname, "johnny-chat")));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: (parseInt(process.env.MAX_UPLOAD_MB || "40", 10)) * 1024 * 1024, files: 12 } });

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-5";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const VISION_MODEL = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";

const DOCS = new Map();

function urlsFrom(text) {
  const re = /\bhttps?:\/\/[^\s)]+/g;
  return Array.from(new Set((text || "").match(re) || [])).slice(0, 8);
}

async function responsesCreateSafe(opts) {
  try {
    return await openai.responses.create(opts);
  } catch (e) {
    const msg = String(e?.message || "");
    const { model, input } = opts;
    if (/Unsupported parameter/i.test(msg) || /tools/i.test(msg) || /max_output_tokens/i.test(msg)) {
      const minimal = { model, input };
      return await openai.responses.create(minimal);
    }
    throw e;
  }
}

async function llm({ system, user, max_output_tokens = 2000, allowWeb = true }) {
  const input = [{ role: "system", content: system }, { role: "user", content: user }];
  const base = { model: CHAT_MODEL, input };
  if (typeof max_output_tokens === "number") base.max_output_tokens = max_output_tokens;
  if (allowWeb) base.tools = [{ type: "web_search" }];
  const resp = await responsesCreateSafe(base);
  const text = resp.output_text ?? "";
  return { text, sources: urlsFrom(text) };
}

async function extractPdfText(buffer) {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text.trim();
}

async function ocrImageWithVision(buffer, mime) {
  const dataUrl = `data:${mime || "image/png"};base64,${buffer.toString("base64")}`;
  const input = [
    {
      role: "user",
      content: [
        { type: "input_text", text: "Extract all readable text (OCR). Then produce a concise 3–6 bullet summary of the content." },
        { type: "input_image", image_url: dataUrl }
      ]
    }
  ];
  const resp = await responsesCreateSafe({ model: VISION_MODEL, input, max_output_tokens: 1600 });
  return resp.output_text ?? "";
}

async function geocodePlace(q) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const j = await r.json();
  const hit = j?.results?.[0];
  if (!hit) return null;
  return { name: hit.name, country: hit.country, admin1: hit.admin1, lat: hit.latitude, lon: hit.longitude, timezone: hit.timezone };
}

function guessDaysFromText(t) {
  const s = String(t || "");
  if (/today\s+and\s+tomorrow/i.test(s)) return 2;
  const m = s.match(/next\s+(\d+)\s+days?/i);
  if (m) return Math.max(1, Math.min(10, parseInt(m[1], 10)));
  if (/tomorrow/i.test(s)) return 2;
  return 3;
}

function pickPlaceText(t) {
  const s = String(t || "");
  const m = s.match(/\b(?:in|for)\s+([^?.,;]+)$/i);
  if (m && m[1]) return m[1].trim();
  return s.trim();
}

async function fetchWeatherText(query) {
  const days = guessDaysFromText(query);
  const placeQ = pickPlaceText(query);
  const geo = await geocodePlace(placeQ);
  if (!geo) return null;
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(geo.lat));
  url.searchParams.set("longitude", String(geo.lon));
  url.searchParams.set("current", "temperature_2m,apparent_temperature,wind_speed_10m,relative_humidity_2m,precipitation");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max");
  url.searchParams.set("forecast_days", String(days));
  url.searchParams.set("timezone", geo.timezone || "auto");
  const r = await fetch(url.toString());
  if (!r.ok) return null;
  const j = await r.json();
  const daily = j?.daily;
  const now = j?.current;
  if (!daily || !now) return null;
  const fmt = (d) => new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: geo.timezone || "UTC" });
  const lines = [];
  lines.push(`Live weather for ${geo.name}${geo.admin1 ? ", " + geo.admin1 : ""}${geo.country ? ", " + geo.country : ""}. Now: ${Math.round(now.temperature_2m)}° (feels ${Math.round(now.apparent_temperature)}°), wind ${Math.round(now.wind_speed_10m)} mph, humidity ${Math.round(now.relative_humidity_2m)}%.`);
  for (let i = 0; i < daily.time.length; i++) {
    const hi = Math.round(daily.temperature_2m_max[i]);
    const lo = Math.round(daily.temperature_2m_min[i]);
    const p = daily.precipitation_probability_max?.[i];
    const pr = daily.precipitation_sum?.[i];
    const w = daily.wind_speed_10m_max?.[i];
    const day = fmt(daily.time[i]);
    lines.push(`- ${day}: ${hi}°/${lo}°; precip ${p ?? 0}%${typeof pr === "number" ? ` (~${pr} mm)` : ""}; wind up to ${Math.round(w || 0)} mph.`);
  }
  const text = lines.join("\n");
  const sources = [
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(placeQ)}`,
    url.toString()
  ];
  return { text, sources };
}

app.get("/health", (_req, res) => res.json({ ok: true, model: CHAT_MODEL }));

app.get("/api/config.js", (req, res) => {
  const base = `${req.protocol}://${req.get("host")}`;
  res.type("application/javascript").send(`window.API_BASE=${JSON.stringify(base)};`);
});

app.get("/api/config", (req, res) => {
  const base = `${req.protocol}://${req.get("host")}`;
  res.json({ api_base: base });
});

async function chatHandler(req, res) {
  try {
    const { input, history = [] } = req.body || {};
    const q = String(input || "");
    if (/\b(weather|forecast|temperature|temps|wind|humidity)\b/i.test(q)) {
      const wx = await fetchWeatherText(q);
      if (wx) return res.json({ reply: wx.text, sources: wx.sources });
    }
    const stitched = (Array.isArray(history) ? history : []).slice(-40).map(m => `${(m.role || "").toUpperCase()}: ${m.content || ""}`).join("\n\n");
    const systemPrompt = "You are Johnny, a pragmatic assistant. Answer clearly. When you reference specific online facts, include plain URLs.";
    const { text, sources } = await llm({ system: systemPrompt, user: `${stitched ? stitched + "\n\n" : ""}USER: ${q}`, max_output_tokens: 2000, allowWeb: true });
    res.json({ reply: text, sources });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

app.post("/api/chat", chatHandler);
app.post("/api/chat4", chatHandler);
app.post("/chat", chatHandler);

app.post("/api/beautify", async (req, res) => {
  try {
    const { text } = req.body || {};
    const prompt = `Clean and format the following text into clear paragraphs and short lists. Remove duplicated fragments and tracking parameters.\n\n${text || ""}`;
    const { text: pretty } = await llm({ system: "You improve formatting only. Do not invent facts.", user: prompt, max_output_tokens: 1200, allowWeb: false });
    res.json({ pretty });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

async function uploadHandler(req, res) {
  try {
    if (!req.files?.length) return res.status(400).json({ error: "No files" });

    let allText = "";
    const meta = [];

    for (const f of req.files) {
      meta.push({ name: f.originalname, type: f.mimetype, size: f.size });

      if (f.mimetype === "application/pdf") {
        const pdfText = await extractPdfText(f.buffer);
        allText += `\n\n[PDF: ${f.originalname}]\n${pdfText}`;
      } else if (/^image\//.test(f.mimetype)) {
        const ocr = await ocrImageWithVision(f.buffer, f.mimetype);
        allText += `\n\n[IMAGE: ${f.originalname}]\n${ocr}`;
      } else {
        allText += `\n\n[FILE: ${f.originalname}]\n${f.buffer.toString("utf8")}`;
      }
    }

    const summaryPrompt = `Summarize the key points from the following combined files, then provide a 5–8 bullet executive summary.\n\n${allText.slice(0, 300000)}`;
    const { text: summary } = await llm({ system: "You summarize documents faithfully. Do not add claims not present in the text.", user: summaryPrompt, max_output_tokens: 2000, allowWeb: false });

    const id = randomUUID();
    DOCS.set(id, { text: allText, summary, files: meta });

    res.json({ docId: id, text: allText.slice(0, 500000), summary, files: meta });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

app.post("/upload", upload.array("files", 12), uploadHandler);
app.post("/api/upload", upload.array("files", 12), uploadHandler);

async function queryHandler(req, res) {
  try {
    const { docId, question } = req.body || {};
    const doc = DOCS.get(docId);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    const prompt = `Answer the question using only the content below. Quote key phrases when helpful and cite section cues like [PDF: filename] if relevant. If not found, say so.\n\nDOCUMENT:\n${doc.text.slice(0, 400000)}\n\nQUESTION: ${question || ""}`;
    const { text: answer } = await llm({ system: "You are a careful reading assistant. When the answer is uncertain, you say so.", user: prompt, max_output_tokens: 1800, allowWeb: false });
    res.json({ answer });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

app.post("/query", queryHandler);
app.post("/api/query", queryHandler);

async function imageHandler(req, res) {
  try {
    const { prompt, size = "1024x1024" } = req.body || {};
    const result = await openai.images.generate({ model: IMAGE_MODEL, prompt: prompt || "", size });
    const b64 = result?.data?.[0]?.b64_json || null;
    if (!b64) return res.status(500).json({ error: "No image returned" });
    res.json({ image_b64: b64 });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

app.post("/generate-image", imageHandler);
app.post("/api/generate-image", imageHandler);

app.get("/", (_req, res) => res.redirect("/johnny-chat/"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {});
