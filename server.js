import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI, { toFile } from "openai";

const {
  OPENAI_API_KEY,
  OPENAI_REALTIME_MODEL = "gpt-4o-realtime-preview", // Reverting to stable preview for debug
  OPENAI_CHAT_MODEL = "gpt-4o",
  OPENAI_LIVE_MODEL = "gpt-4o",
  OPENAI_IMAGE_MODEL = "dall-e-3",
  OPENAI_VISION_MODEL = "gpt-4o-mini",
  ELEVENLABS_API_KEY,
  ELEVENLABS_AGENT_ID, // The Conversational AI Agent ID
  MAX_UPLOAD_MB = "40",
  CORS_ORIGIN = ""
} = process.env;

if (!OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY missing - Realtime and AI features will be disabled.");
}

const app = express();

/**
 * HYPER-VERBOSE LOGGING
 */
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log("Headers:", JSON.stringify(req.headers, null, 2));
  next();
});

/**
 * GLOBAL MIDDLEWARE
 */
app.use(cors({
  origin: true, // Reflect any origin
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.text({ type: "application/sdp" }));
app.use(express.json({ limit: `${Math.max(1, Number(MAX_UPLOAD_MB))}mb` }));
app.use(express.urlencoded({ extended: true }));

/**
 * VOICE SESSION BOOTSTRAP ENDPOINT
 * Directly proxies the WebRTC SDP offer to OpenAI Realtime API.
 * This keeps the API Key secure on the server.
 */
app.post("/session", async (req, res) => {
  try {
    console.log("📥 Received /session request");

    if (!OPENAI_API_KEY) {
      console.error("❌ OPENAI_API_KEY is missing!");
      return res.status(500).json({ error: "Server API Key not configured" });
    }

    const sdp = typeof req.body === 'string' ? req.body : req.body.sdp;
    if (!sdp) {
      console.error("❌ Missing SDP offer in body");
      return res.status(400).json({ error: "Missing SDP offer" });
    }

    console.log(`📡 Connecting to OpenAI Realtime with model: ${OPENAI_REALTIME_MODEL}`);

    // Call OpenAI Realtime Create Call
    // Fallback to gpt-4o-realtime-preview if the suggested 2025 string fails
    const response = await fetch(`https://api.openai.com/v1/realtime/calls?model=${OPENAI_REALTIME_MODEL}`, {
      method: "POST",
      body: sdp,
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/sdp"
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("❌ OpenAI Realtime Error:", response.status, errText);
      return res.status(response.status).send(errText);
    }

    const answerSdp = await response.text();
    console.log("✅ Successfully received SDP answer from OpenAI");
    res.set("Content-Type", "application/sdp");
    res.send(answerSdp);
  } catch (err) {
    console.error("🔥 Session Crash:", err);
    res.status(500).json({ detail: String(err.message || err) });
  }
});

/**
 * ELEVENLABS CONVERSATIONAL AI TOKEN ENDPOINT
 */
  } catch (err) {
  console.error("🔥 Session Crash:", err);
  res.status(500).json({ detail: String(err.message || err) });
}
});
const openai = new OpenAI({ apiKey: OPENAI_API_KEY || "sk-dummy" });

// Serve the Taqueria Familia clone
app.use("/tacos", express.static("public/tacos"));
app.use(express.static("public"));

app.get("/health", (_req, res) => res.json({ ok: true, realtimeModel: OPENAI_REALTIME_MODEL, imageModel: OPENAI_IMAGE_MODEL }));

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

    if (s.trim() === "[system_greet]") {
      return res.json({ reply: "Hello! How can I help you today?", sources: [] });
    }

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
    const { prompt = "", size = "1024x1024", quality = "high", background, format } = req.body || {};
    const gen = await openai.images.generate({
      model: OPENAI_IMAGE_MODEL,
      prompt: String(prompt),
      size: size === "auto" ? "1024x1024" : size,
      quality: quality || "high",
      ...(background ? { background } : {}),
      ...(format ? { response_format: format } : {})
    });
    const b64 = gen.data?.[0]?.b64_json || "";
    res.json({ image_b64: b64 });
  } catch (e) {
    res.status(500).json({ detail: String(e.message || e) });
  }
});

const uploadRefs = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(1, Number(MAX_UPLOAD_MB)) * 1024 * 1024 }
});

app.post("/generate-image-edit", uploadRefs.array("refs", 5), async (req, res) => {
  try {
    const { prompt = "", size = "1024x1024", quality = "high", background, input_fidelity } = req.body || {};
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ detail: "No reference images provided" });

    const imgs = [];
    for (const f of files.slice(0, 5)) {
      const tf = await toFile(f.buffer, f.originalname || "ref.png", { type: f.mimetype || "image/png" });
      imgs.push(tf);
    }

    const result = await openai.images.edit({
      model: OPENAI_IMAGE_MODEL,
      image: imgs,
      prompt: String(prompt),
      size: size === "auto" ? "1024x1024" : size,
      quality: quality || "high",
      ...(background ? { background } : {}),
      ...(input_fidelity ? { input_fidelity } : {})
    });

    const b64 = result.data?.[0]?.b64_json || "";
    res.json({ image_b64: b64 });
  } catch (e) {
    res.status(500).json({ detail: String(e.message || e) });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`server on :${port}`);
});
