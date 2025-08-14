import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";

const {
  OPENAI_API_KEY,
  OPENAI_CHAT_MODEL = "gpt-5",
  OPENAI_IMAGE_MODEL = "gpt-image-1",
  OPENAI_VISION_MODEL = "gpt-4o-mini",
  MAX_UPLOAD_MB = "40",
  CORS_ORIGIN = ""
} = process.env;

if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY missing");
  process.exit(1);
}

const app = express();
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const origins = CORS_ORIGIN.split(",").map(s => s.trim()).filter(Boolean);
app.use(
  cors({
    origin: function (origin, cb) {
      if (!origin) return cb(null, true);
      if (!origins.length) return cb(null, true);
      if (origins.includes(origin)) return cb(null, true);
      return cb(null, false);
    }
  })
);

app.use(express.json({ limit: `${Math.max(1, Number(MAX_UPLOAD_MB))}mb` }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => res.json({ ok: true, model: OPENAI_CHAT_MODEL }));

function isLiveQuery(s) {
  return /\b(today|now|latest|breaking|news|weather|forecast|temperature|near me|open now|score|stocks?)\b/i.test(s);
}

function cleanCity(s) {
  return String(s || "")
    .replace(/\b(now|today|tonight|tomorrow|current(?:ly)?|weather|forecast|temperature)\b/gi, "")
    .replace(/[?.,;:!]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseWeatherQuery(q) {
  const s = String(q || "");
  let city = "";
  let when = "today";
  if (/\bnow\b/i.test(s)) when = "now";
  else if (/\btomorrow\b/i.test(s)) when = "tomorrow";
  else when = "today";
  const m1 = s.match(/\b(?:in|for)\s+([a-z][a-z0-9\s,.'-]{2,80})/i);
  if (m1) city = cleanCity(m1[1]);
  if (!city) {
    const m2 = s.match(/weather\s+(?:in|for)?\s*([a-z0-9,.\s-]{3,80})\s+(?:now|today|tomorrow)/i);
    if (m2) city = cleanCity(m2[1]);
  }
  return { city, when };
}

function wcodeToText(c) {
  const map = {0:"clear",1:"mostly clear",2:"partly cloudy",3:"overcast",45:"fog",48:"freezing fog",51:"light drizzle",53:"drizzle",55:"heavy drizzle",56:"freezing drizzle",57:"heavy freezing drizzle",61:"light rain",63:"rain",65:"heavy rain",66:"freezing rain",67:"heavy freezing rain",71:"light snow",73:"snow",75:"heavy snow",77:"snow grains",80:"light showers",81:"showers",82:"heavy showers",85:"snow showers",86:"heavy snow showers",95:"thunderstorms",96:"thunderstorms with hail",99:"severe thunderstorms with hail"};
  return map[c] || "conditions";
}

async function liveWeatherFallback(q) {
  const { city, when } = parseWeatherQuery(q);
  if (!city) return "";
  const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
  const gj = await geo.json();
  if (!gj.results || !gj.results.length) return "";
  const g = gj.results[0];
  const lat = g.latitude;
  const lon = g.longitude;
  const loc = `${g.name}${g.admin1 ? ", " + g.admin1 : ""}${g.country ? ", " + g.country : ""}`;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation,weather_code&hourly=temperature_2m,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=2`;
  const fx = await fetch(url);
  const j = await fx.json();
  const nowTemp = j.current ? Math.round(j.current.temperature_2m) : null;
  const nowCode = j.current ? j.current.weather_code : null;
  const tMax = j.daily && j.daily.temperature_2m_max ? Math.round(j.daily.temperature_2m_max[0]) : null;
  const tMin = j.daily && j.daily.temperature_2m_min ? Math.round(j.daily.temperature_2m_min[0]) : null;
  const tCode = j.daily && j.daily.weather_code ? j.daily.weather_code[0] : null;
  const tPop = j.daily && j.daily.precipitation_probability_max ? j.daily.precipitation_probability_max[0] : null;
  const tmMax = j.daily && j.daily.temperature_2m_max && j.daily.temperature_2m_max[1] != null ? Math.round(j.daily.temperature_2m_max[1]) : null;
  const tmMin = j.daily && j.daily.temperature_2m_min && j.daily.temperature_2m_min[1] != null ? Math.round(j.daily.temperature_2m_min[1]) : null;
  const tmCode = j.daily && j.daily.weather_code && j.daily.weather_code[1] != null ? j.daily.weather_code[1] : null;
  const tmPop = j.daily && j.daily.precipitation_probability_max && j.daily.precipitation_probability_max[1] != null ? j.daily.precipitation_probability_max[1] : null;
  const parts = [];
  parts.push(`${loc}`);
  if (when === "now" && nowTemp != null) parts.push(`Now: ${wcodeToText(nowCode)} around ${nowTemp}°F.`);
  if (when === "today" || when === "now") {
    if (tMax != null && tMin != null) parts.push(`Today: ${wcodeToText(tCode)}, ${tMin}–${tMax}°F${tPop != null ? `, precip ${tPop}%` : ""}.`);
  }
  if (when === "tomorrow") {
    if (tmMax != null && tmMin != null) parts.push(`Tomorrow: ${wcodeToText(tmCode)}, ${tmMin}–${tmMax}°F${tmPop != null ? `, precip ${tmPop}%` : ""}.`);
  }
  return parts.join(" ");
}

async function tryWebSearch(s, history) {
  try {
    const p = openai.responses.create({
      model: OPENAI_CHAT_MODEL,
      tools: [
        {
          type: "web_search_preview",
          user_location: { type: "approximate", country: "US", city: "Chicago", region: "Illinois" },
          search_context_size: "low"
        }
      ],
      max_output_tokens: 320,
      temperature: 0.2,
      input: [
        { role: "system", content: "Answer concisely with concrete dates and short bullet points when useful." },
        ...history.slice(-8),
        { role: "user", content: s }
      ]
    });
    const resp = await Promise.race([
      p,
      new Promise((_, rej) => setTimeout(() => rej(new Error("web_search_timeout")), 9000))
    ]);
    return resp.output_text || "";
  } catch {
    return "";
  }
}

app.post("/api/chat", async (req, res) => {
  try {
    const { input = "", history = [] } = req.body || {};
    const s = String(input || "");
    if (isLiveQuery(s)) {
      const reply = await tryWebSearch(s, history);
      if (reply) return res.json({ reply, sources: ["web"] });
      const fallback = await liveWeatherFallback(s);
      if (fallback) return res.json({ reply: fallback, sources: ["open-meteo.com"] });
    }
    const resp = await openai.responses.create({
      model: OPENAI_CHAT_MODEL,
      input: [
        { role: "system", content: "You are a concise, friendly assistant." },
        ...history.slice(-20),
        { role: "user", content: s }
      ]
    });
    const reply = resp.output_text || "(no reply)";
    res.json({ reply, sources: [] });
  } catch (err) {
    res.status(500).json({ detail: String(err.message || err) });
  }
});

app.post("/api/beautify", async (req, res) => {
  try {
    const { text = "" } = req.body || {};
    const resp = await openai.responses.create({
      model: OPENAI_CHAT_MODEL,
      input: [
        { role: "system", content: "Rewrite the text for clarity and structure. Return only the improved text." },
        { role: "user", content: String(text || "") }
      ]
    });
    res.json({ pretty: resp.output_text || "" });
  } catch (e) {
    res.status(500).json({ detail: String(e.message || e) });
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(1, Number(MAX_UPLOAD_MB)) * 1024 * 1024 }
});

app.post("/upload", upload.array("files", 8), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ detail: "No files" });
    let textFromImages = "";
    for (const f of files) {
      if (!f.mimetype.startsWith("image/")) continue;
      const b64 = f.buffer.toString("base64");
      const dataUrl = `data:${f.mimetype};base64,${b64}`;
      const vision = await openai.responses.create({
        model: OPENAI_VISION_MODEL,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: "Transcribe all legible text in reading order and return plain text only." },
              { type: "input_image", image_url: dataUrl }
            ]
          }
        ]
      });
      const txt = (vision.output_text || "").trim();
      textFromImages += txt ? "\n" + txt : "";
    }
    res.json({ text: textFromImages.trim() });
  } catch (e) {
    res.status(500).json({ detail: String(e.message || e) });
  }
});

app.post("/summarize-text", async (req, res) => {
  try {
    const { text = "" } = req.body || {};
    const resp = await openai.responses.create({
      model: OPENAI_CHAT_MODEL,
      input: [
        { role: "system", content: "Summarize the provided document text: first 3–6 bullet key points, then a short executive summary." },
        { role: "user", content: String(text).slice(0, 15000) }
      ]
    });
    res.json({ summary: resp.output_text || "" });
  } catch (e) {
    res.status(500).json({ detail: String(e.message || e) });
  }
});

app.post("/query", async (req, res) => {
  try {
    const { question = "", text = "" } = req.body || {};
    const prompt = `Answer the user's question using only this document content:\n\n${text}\n\nQuestion: ${question}`;
    const resp = await openai.responses.create({
      model: OPENAI_CHAT_MODEL,
      input: [{ role: "user", content: prompt }]
    });
    res.json({ answer: resp.output_text || "(no answer)" });
  } catch (e) {
    res.status(500).json({ detail: String(e.message || e) });
  }
});

app.post("/generate-image", async (req, res) => {
  try {
    const { prompt = "", size = "1024x1024" } = req.body || {};
    const gen = await openai.images.generate({
      model: OPENAI_IMAGE_MODEL,
      prompt: String(prompt),
      size: size === "auto" ? "1024x1024" : size,
      quality: "high"
    });
    const b64 = gen.data?.[0]?.b64_json || "";
    res.json({ image_b64: b64 });
  } catch (e) {
    res.status(500).json({ detail: String(e.message || e) });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`server on :${port}`);
});

