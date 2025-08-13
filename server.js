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

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/api/chat", async (req, res) => {
  try {
    const { input = "", history = [] } = req.body || {};
    const s = String(input || "");
    const wantWeather = /(^|\s)weather\s/i.test(s) || /forecast/i.test(s) || /temperature/i.test(s);
    if (wantWeather) {
      const mCity = s.match(/in\s+([a-z][a-z0-9\s,.-]{2,80})/i);
      const city = mCity ? mCity[1].trim() : "";
      const when = /tomorrow/i.test(s) ? "tomorrow" : /today/i.test(s) ? "today" : "today";
      const query = `Give a concise local weather brief for ${city || "the user’s location"} for ${when}. If city is missing, ask them to specify.`;
      const resp = await openai.responses.create({
        model: OPENAI_CHAT_MODEL,
        input: [
          { role: "system", content: "You are a helpful assistant. Keep weather summaries short and clear." },
          { role: "user", content: query }
        ]
      });
      const reply = resp.output_text || "(no reply)";
      return res.json({ reply, sources: [] });
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

app.post("/upload", upload.array("files", 6), async (req, res) => {
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
              { type: "input_text", text: "Transcribe all legible text from this image. Return only the text in reading order." },
              { type: "input_image", image_url: dataUrl }
            ]
          }
        ]
      });
      const txt = vision.output_text || "";
      textFromImages += "\n" + txt;
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
        {
          role: "system",
          content: "Summarize the provided document text: first 3–6 bullet key points, then a short executive summary."
        },
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
