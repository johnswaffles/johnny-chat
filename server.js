import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI, { toFile } from "openai";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

const {
  OPENAI_API_KEY,
  OPENAI_REALTIME_MODEL = "gpt-4o-realtime-preview", // Reverting to stable preview for debug
  OPENAI_CHAT_MODEL = "gpt-4o",
  OPENAI_LIVE_MODEL = "gpt-4o",
  OPENAI_IMAGE_MODEL = "dall-e-3",
  OPENAI_VISION_MODEL = "gpt-4o-mini",
  MAX_UPLOAD_MB = "40",
  CORS_ORIGIN = ""
} = process.env;

if (!OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY missing - Realtime and AI features will be disabled.");
}

function getJohnnyPersona() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

  return `You are Johnny, the sharp, confident AI persona of JustAskJohnny.com.
Current Context: Today is ${dateStr}. Local Time: ${timeStr}.

Core Identity:
- Name: Johnny.
- Tone: Sarcastic, intelligent, authoritative, and helpful in a dry way.
- Environment: You live on JustAskJohnny.com.

Critical Directives (Authoritative Substance):
1. **Be Substantial**: When asked for facts, news, or weather, provide THEM. Do not ask "What headlines do you want?" or "What source?". Use your smart brain and live tools to GIVE the answer immediately.
2. **No Evasion**: Never say "I can't pull that live" or "Tell me what you mean by...". If a query is broad, pick the top 3 interesting items and present them confidently.
3. **Be Useful first**: Your primary job is to be an expert companion. Sarcasm is your flavor, but providing value is your core.
4. **No Generic Assistant Language**: No "How can I help you?", "As an AI...", or "Would you like me to...". Just lead the conversation.

Deflection Rules:
- Only deflect personal/invasive questions about the real Johnny.
- For all other world/news/fact questions: BE THE AUTHORITY. Provide the info.

Style: No emojis. No filler. Short, punchy, fact-rich responses. If you use a tool, wait for the result and summarize it sharply.`;
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
/**
 * REALTIME SESSION TOKEN ENDPOINT
 * Creates an ephemeral session token with the Johnny persona pre-configured.
 * This is the most robust way to ensure the persona sticks.
 * Renamed to /api/realtime-token to bypass browser caching of old /session.
 */
app.post("/api/realtime-token", async (req, res) => {
  try {
    console.log("📥 [Realtime] Creating Ephemeral Session Token...");

    if (!OPENAI_API_KEY) {
      console.error("❌ [Realtime] OPENAI_API_KEY is missing!");
      return res.status(500).json({ error: "Server API Key not configured" });
    }

    // Use a specific model version if the preview string is failing
    const modelToUse = OPENAI_REALTIME_MODEL || "gpt-4o-realtime-preview-2024-12-17";
    console.log(`📡 [Realtime] Requesting session for model: ${modelToUse}`);

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelToUse,
        voice: "echo",
        instructions: getJohnnyPersona(),
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: {
          type: "server_vad",
          threshold: 0.8,
          prefix_padding_ms: 300,
          silence_duration_ms: 1000
        },
        tools: [
          {
            type: "function",
            name: "web_search",
            description: "Search the internet for real-time information such as weather, news, scores, or facts. Use this whenever the user asks for current event information.",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string", description: "The search query to look up on the web" }
              },
              required: ["query"]
            }
          }
        ],
        tool_choice: "auto"
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("❌ [Realtime] OpenAI Session Error:", response.status, errText);
      try {
        const errJson = JSON.parse(errText);
        return res.status(response.status).json({ error: "OpenAI refused session", details: errJson });
      } catch {
        return res.status(response.status).send(errText);
      }
    }

    const data = await response.json();
    console.log("✅ [Realtime] Ephemeral token generated for Johnny.");
    res.json(data);
  } catch (err) {
    console.error("🔥 [Realtime] Session Crash:", err);
    res.status(500).json({ detail: String(err.message || err) });
  }
});

const openai = new OpenAI({ apiKey: OPENAI_API_KEY || "sk-dummy" });
console.log("🛠️ [SDK] OpenAI instance keys:", Object.keys(openai));
if (openai.responses) console.log("🛠️ [SDK] Found 'responses' namespace on openai instance.");

// Serve the Taqueria Familia clone
app.use("/tacos", express.static("public/tacos"));
app.use(express.static("public"));

app.get("/health", (_req, res) => res.json({ ok: true, realtimeModel: OPENAI_REALTIME_MODEL, imageModel: OPENAI_IMAGE_MODEL }));

function isLiveQuery(s) {
  return /\b(today|now|latest|breaking|news|headline|earnings|release|score|stocks?|market|price|forecast|weather|traffic|open now)\b/i.test(s);
}

async function askWithWebSearch({ prompt, forceSearch = true, location = { country: "US", city: "Chicago", region: "Illinois" }, contextSize = "medium" }) {
  console.log(`📡 [Tavily] Initiating search for: "${prompt}"`);
  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

  if (!TAVILY_API_KEY) {
    console.warn("⚠️ [Tavily] Key missing, falling back to standard completion.");
    const fallback = await openai.chat.completions.create({
      model: OPENAI_LIVE_MODEL,
      messages: [
        { role: "system", content: getJohnnyPersona() },
        { role: "user", content: prompt }
      ]
    });
    return { text: fallback.choices[0]?.message?.content || "", cites: [] };
  }

  try {
    // 1. Fetch from Tavily
    const tavilyResp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: prompt,
        search_depth: "advanced",
        include_answer: true,
        max_results: 5
      })
    });

    if (!tavilyResp.ok) throw new Error(`Tavily Error: ${tavilyResp.status}`);
    const searchData = await tavilyResp.json();
    console.log(`✅ [Tavily] Found ${searchData.results?.length} results.`);

    // 2. Synthesize with GPT-4o
    const synthesisPrompt = `
      You are Johnny. Use the following real-time search data to answer the user's request with authority and substance.
      Do not mention "searching" or "the data". Just lead with the facts in your sarcastic, sharp tone.
      
      User Prompt: "${prompt}"
      
      Search Results:
      ${JSON.stringify(searchData.results, null, 2)}
    `;

    const synthesis = await openai.chat.completions.create({
      model: OPENAI_LIVE_MODEL,
      messages: [
        { role: "system", content: getJohnnyPersona() },
        { role: "user", content: synthesisPrompt }
      ]
    });

    const text = synthesis.choices[0]?.message?.content || "";
    const cites = searchData.results?.map(r => ({ url: r.url, title: r.title })) || [];

    return { text, cites };
  } catch (err) {
    console.error("🔥 [Tavily] Search synthesis failed:", err);
    // Final fallback
    const fallback = await openai.chat.completions.create({
      model: OPENAI_LIVE_MODEL,
      messages: [
        { role: "system", content: getJohnnyPersona() },
        { role: "user", content: prompt }
      ]
    });
    return { text: fallback.choices[0]?.message?.content || "", cites: [] };
  }
}

/**
 * VOICE SEARCH ENDPOINT
 * Specialized for the Realtime API to get quick, spoken-style facts.
 */
app.post("/api/voice-search", async (req, res) => {
  try {
    const { query = "" } = req.body || {};
    if (!query) return res.status(400).json({ error: "Missing query" });

    console.log(`🌐 Realtime Tool: Searching the web for "${query}"...`);

    // We use contextSize="small" for voice to keep responses from becoming too long
    const { text } = await askWithWebSearch({
      prompt: `Provide a sharp, substantial answer with actual facts. Current query: ${query}`,
      forceSearch: true,
      contextSize: "small"
    });

    res.json({ result: text });
  } catch (err) {
    console.error("❌ Voice Search Error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const { input = "", history = [] } = req.body || {};
    const s = String(input || "");

    if (s.trim() === "[system_greet]") {
      return res.json({ reply: "You're here. I'm here. Let's make this conversation worth both our time.", sources: [] });
    }

    if (isLiveQuery(s)) {
      const { text } = await askWithWebSearch({ prompt: s, forceSearch: true, contextSize: "medium" });
      return res.json({ reply: text, sources: ["web"] });
    }
    const completion = await openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      messages: [
        {
          role: "system", content: getJohnnyPersona()
        },
        ...history.slice(-20),
        { role: "user", content: s }
      ]
    });
    const reply = completion.choices[0]?.message?.content || "(no reply)";
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
      console.log(`📂 [Upload] Processing file: ${f.originalname} (${f.mimetype})`);
      if (f.mimetype.startsWith("image/")) {
        const b64 = f.buffer.toString("base64");
        const dataUrl = `data:${f.mimetype};base64,${b64}`;

        console.log(`📡 [Upload] Sending to Vision (Chat API): ${OPENAI_VISION_MODEL}`);
        const vision = await openai.chat.completions.create({
          model: OPENAI_VISION_MODEL,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "First transcribe all legible text from the image as plain text. Then, if little or no text is present, write a precise visual description capturing subjects, scene, style, and notable details. Return JSON with keys text and description." },
                { type: "image_url", image_url: { url: dataUrl } }
              ]
            }
          ],
          response_format: { type: "json_object" }
        });

        const content = vision.choices[0]?.message?.content || "";
        console.log(`✅ [Upload] Vision response received. Length: ${content?.length}`);

        try {
          const res = JSON.parse(content);
          if (res.text) fullText += (fullText ? "\n" : "") + res.text;
          if (res.description) descriptions.push(res.description);
        } catch (e) {
          console.warn("⚠️ [Upload] JSON parse failed, using raw content.");
          fullText += (fullText ? "\n" : "") + content;
        }
      } else if (f.mimetype === "application/pdf") {
        console.log(`📄 [Upload] Parsing PDF: ${f.originalname}`);
        try {
          const data = await pdf(f.buffer);
          fullText += (fullText ? "\n" : "") + (data.text || "");
          descriptions.push(`Uploaded PDF: ${f.originalname}`);
          console.log(`✅ [Upload] PDF parsed successfully. Text length: ${data.text?.length}`);
        } catch (pdfErr) {
          console.error("🔥 [Upload] PDF Parse Error:", pdfErr);
          throw new Error("Failed to parse PDF document.");
        }
      }
    }

    console.log(`🏁 [Upload] Completed. Text length: ${fullText.length}, Descs: ${descriptions.length}`);
    res.json({ text: fullText.trim(), description: descriptions.join("\n\n").trim() });
  } catch (e) {
    console.error("🚨 [Upload] Fatal Error:", e);
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
    const completion = await openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      messages: [{ role: "user", content: prompt }]
    });
    res.json({ answer: completion.choices[0]?.message?.content || "(no answer)" });
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
