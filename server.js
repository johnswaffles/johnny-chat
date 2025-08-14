import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";

const {
  OPENAI_API_KEY,
  OPENAI_CHAT_MODEL = "gpt-5",
  OPENAI_LIVE_MODEL = "o4-mini",
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

app.get("/health", (_req, res) => res.json({ ok: true, chatModel: OPENAI_CHAT_MODEL, liveModel: OPENAI_LIVE_MODEL }));

function isLiveQuery(s) {
  return /\b(today|now|latest|breaking|news|headline|earnings|release|score|stocks?|market|price|forecast|weather|traffic|open now)\b/i.test(s);
}

async function askWithWebSearch({ prompt, forceSearch = true, location = { country: "US", city: "Chicago", region: "Illinois" }, contextSize = "medium" }) {
  const tools = [
    {
      type: "web_search_preview",
      search_context_size: contextSize,
      user_location: { type: "approximate", ...location }
    }
  ];
  const body = {
    model: OPENAI_LIVE_MODEL,
    input: [
      { role: "system", content: "Be concise. Use web_search_preview when needed. Include inline citations for web-derived claims." },
      { role: "user", content: prompt }
    ],
    tools
  };
  if (forceSearch) body.tool_choice = { type: "web_search_preview" };
  const p = openai.responses.create(body);
  const resp = await Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error("web_search_timeout")), 12000))
  ]);
  const text = resp.output_text || "";
  const msg = resp.output?.find(it => it.type === "message");
  const anns = msg?.content?.[0]?.annotations || [];
  const cites = anns.filter(a => a.type === "url_citation").map(a => ({ url: a.url, title: a.title }));
  return { text, cites };
}

app.post("/api/chat", async (req, res) => {
  try {
    const { input = "", history = [] } = req.body || {};
    const s = String(input || "");
    if (isLiveQuery(s)) {
      const { text } = await askWithWebSearch({ prompt: s, forceSearch: true, contextSize: "medium" });
      return res.json({ reply: text, sources: ["web"] });
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

    let fullText = "";
    let descriptions = [];

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
              { type: "input_text", text: "First transcribe all legible text from the image as plain text. Then, if little or no text is present, write a precise visual description capturing subjects, scene, style, and notable details. Return JSON with keys text and description." },
              { type: "input_image", image_url: dataUrl }
            ]
          }
        ]
      });

      let textBlock = "";
      let descBlock = "";
      try {
        const raw = vision.output_text || "";
        const m = raw.match(/\{[\s\S]*\}$/);
        if (m) {
          const j = JSON.parse(m[0]);
          textBlock = String(j.text || "").trim();
          descBlock = String(j.description || "").trim();
        } else {
          textBlock = raw.trim();
        }
      } catch {
        textBlock = (vision.output_text || "").trim();
      }

      if (textBlock) fullText += (fullText ? "\n" : "") + textBlock;
      if (descBlock) descriptions.push(descBlock);
      if (!textBlock && !descBlock) descriptions.push("No legible text found; include general visual understanding only.");
    }

    res.json({ text: fullText.trim(), description: descriptions.join("\n\n").trim() });
  } catch (e) {
    res.status(500).json({ detail: String(e.message || e) });
  }
});

app.post("/summarize-text", async (req, res) => {
  try {
    const { text = "", description = "" } = req.body || {};
    const combined = [text, description ? "Visual notes:\n" + description : ""].filter(Boolean).join("\n\n");
    const resp = await openai.responses.create({
      model: OPENAI_CHAT_MODEL,
      input: [
        { role: "system", content: "Summarize the provided content: first 3–6 bullet key points, then a short executive summary." },
        { role: "user", content: String(combined).slice(0, 15000) }
      ]
    });
    res.json({ summary: resp.output_text || "" });
  } catch (e) {
    res.status(500).json({ detail: String(e.message || e) });
  }
});

app.post("/query", async (req, res) => {
  try {
    const { question = "", text = "", description = "" } = req.body || {};
    const corpus = [text, description].filter(Boolean).join("\n\n");
    const prompt = `Answer the user's question using only this content:\n\n${corpus}\n\nQuestion: ${question}`;
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
