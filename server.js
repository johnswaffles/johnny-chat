import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI, { toFile } from "openai";
import { createRequire } from "module";
import http from "http";
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const {
  OPENAI_API_KEY,
  OPENAI_REALTIME_MODEL = "gpt-4o-realtime-preview",
  OPENAI_CHAT_MODEL = "gpt-4o",
  OPENAI_LIVE_MODEL = "gpt-4o",
  OPENAI_IMAGE_MODEL = "dall-e-3",
  OPENAI_VISION_MODEL = "gpt-4.1-mini",
  MAX_UPLOAD_MB = "40",
  CORS_ORIGIN = ""
} = process.env;

if (!OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY missing - Realtime and AI features will be disabled.");
}

function getScoutPersona() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

  return `You are Scout, an expert RV travel companion helping the owner of a 24ft Wolf Pup travel trailer.
Current Context: Today is ${dateStr}. Local Time: ${timeStr}.

USER'S RIG:
- 24ft Wolf Pup travel trailer (need sites that fit 30ft+ to be safe)
- Tow vehicle requires diesel fuel
- Standard 30-amp hookup compatible
- Travels with flexibility—open to all camping styles

YOUR ROLE:
1. **Be Proactively Helpful**: Anticipate what they need. If they ask about camping, ask smart follow-up questions first.
2. **Ask Clarifying Questions**: Before searching, understand the trip type, amenities needed, and budget.
3. **Know RV Realities**: Site length requirements, hookup needs, dump stations, propane, RV-friendly routes.
4. **Find Quality Fuel**: Recommend truck stops with easy RV access (Pilot, Love's, TA, Flying J). Avoid tight gas stations.
5. **Location Aware**: If they're unsure where they are, help them figure out the nearest town first.

CLARIFYING QUESTIONS TO ASK:
- "What kind of trip? Quick overnight stop, weekend getaway, or extended stay?"
- "Need full hookups (water/electric/sewer), or is dry camping okay?"
- "Looking for an RV park, state/national park, or free boondocking?"
- "Any must-haves—laundry, pool, pet areas, good WiFi, scenic views?"
- "What's your budget—premium resort or budget-friendly?"

WHEN GIVING OPTIONS:
- Provide 2-3 solid options, not overwhelming lists
- Mention tradeoffs briefly (e.g., "cheaper but no hookups", "beautiful but 30 min off highway")
- Include practical details: price range, site size, reservation requirements
- Use web search for real-time info, availability, fuel prices

FOR DIESEL FUEL:
- Prioritize major truck stops: Pilot, Love's, TA/Petro, Flying J
- Mention if entry/exit is RV-friendly
- Note current diesel prices if available

STYLE:
- Warm, friendly, and conversational—like an experienced RV friend on the road with you
- Enthusiastic about helping find great spots
- Practical and honest about tradeoffs
- Use simple language, no jargon`;
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
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.text({ type: "application/sdp" }));
app.use(express.json({ limit: `${Math.max(1, Number(MAX_UPLOAD_MB))}mb` }));
app.use(express.urlencoded({ extended: true }));

/**
 * REALTIME SESSION TOKEN ENDPOINT
 * Creates an ephemeral session token with the Johnny persona pre-configured.
 */
app.post("/api/realtime-token", async (req, res) => {
  try {
    console.log("📥 [Realtime] Creating Ephemeral Session Token...");

    if (!OPENAI_API_KEY) {
      console.error("❌ [Realtime] OPENAI_API_KEY is missing!");
      return res.status(500).json({ error: "Server API Key not configured" });
    }

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
        voice: "ballad",
        instructions: `You are Scout, an expert RV travel companion helping the owner of a 24ft Wolf Pup travel trailer.

USER'S RIG:
- 24ft Wolf Pup travel trailer (need sites 30ft+ to be safe)
- Tow vehicle requires diesel fuel
- 30-amp hookup compatible

YOUR ROLE:
1. **Be Proactively Helpful**: Anticipate needs. Ask smart follow-up questions before searching.
2. **Ask Clarifying Questions**: Understand trip type (overnight/weekend/extended), campground preference (RV park/state park/boondocking), amenities needed, and budget.
3. **Know RV Realities**: Site length, hookups, dump stations, RV-friendly routes.
4. **Find Quality Fuel**: Recommend Pilot, Love's, TA, Flying J with RV-friendly access.
5. **Location Aware**: Help figure out nearest town if unsure of location.

WHEN USER ASKS FOR CAMPING:
Ask: "What kind of trip—quick overnight, weekend, or extended stay? And do you need full hookups or is dry camping okay?"

WHEN GIVING OPTIONS:
- Provide 2-3 solid options with tradeoffs
- Include price range, site size, reservation info
- Use web search for real-time availability

FOR DIESEL:
- Find major truck stops with RV-friendly access
- Mention prices if available

GREETING STYLE:
Start with something friendly like "Hey! Where are we headed today?" or "Scout here—ready to find you a great spot!"

STYLE: Warm, friendly, conversational—like an experienced RV friend. Enthusiastic about great camping spots. Practical about tradeoffs.`,
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: {
          type: "server_vad",
          threshold: 0.8,
          prefix_padding_ms: 300,
          silence_duration_ms: 800
        },
        tools: [
          {
            type: "function",
            name: "web_search",
            description: "Search the internet for real-time information.",
            parameters: {
              type: "object",
              properties: { query: { type: "string" } },
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
    console.log("✅ [Realtime] Ephemeral token generated for Scout.");
    res.json(data);
  } catch (err) {
    console.error("🔥 [Realtime] Session Crash:", err);
    res.status(500).json({ detail: String(err.message || err) });
  }
});

const openai = new OpenAI({ apiKey: OPENAI_API_KEY || "sk-dummy" });

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
        { role: "system", content: getScoutPersona() },
        { role: "user", content: prompt }
      ]
    });
    return { text: fallback.choices[0]?.message?.content || "", cites: [] };
  }

  try {
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
        { role: "system", content: getScoutPersona() },
        { role: "user", content: synthesisPrompt }
      ]
    });

    const text = synthesis.choices[0]?.message?.content || "";
    const cites = searchData.results?.map(r => ({ url: r.url, title: r.title })) || [];

    return { text, cites };
  } catch (err) {
    console.error("🔥 [Tavily] Search synthesis failed:", err);
    const fallback = await openai.chat.completions.create({
      model: OPENAI_LIVE_MODEL,
      messages: [
        { role: "system", content: getScoutPersona() },
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
          role: "system", content: getScoutPersona()
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
        console.log(`📄 [Upload] Parsing PDF: ${f.originalname} using pdfjs-dist`);
        try {
          const uint8Array = new Uint8Array(f.buffer);
          const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
          const pdfDocument = await loadingTask.promise;

          let extractedText = "";
          console.log(`📄 [Upload] PDF has ${pdfDocument.numPages} pages.`);

          for (let i = 1; i <= pdfDocument.numPages; i++) {
            const page = await pdfDocument.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            extractedText += pageText + "\n";
          }

          fullText += (fullText ? "\n" : "") + extractedText;
          descriptions.push(`Uploaded PDF: ${f.originalname} (${pdfDocument.numPages} pages)`);
        } catch (pdfErr) {
          console.error("🔥 [Upload] PDF Extraction Error:", pdfErr);
          fullText += (fullText ? "\n" : "") + `[Error processing PDF ${f.originalname}: ${pdfErr.message}]`;
        }
      }
    }

    console.log(`🏁 [Upload] Extraction completed. Text length: ${fullText.length}, Descs: ${descriptions.length}`);

    let autoSummary = "";
    if (fullText && descriptions.some(d => d.includes("PDF"))) {
      console.log("🧠 [Upload] Generating automatic detailed summary for PDF...");
      try {
        const sumComp = await openai.chat.completions.create({
          model: OPENAI_CHAT_MODEL,
          messages: [
            { role: "system", content: "You are Johnny's analytical brain. Provide a detailed, structured summary of the provided document. Use bullet points for key facts, followed by a punchy executive summary. Keep Johnny's tone: sharp and authoritative." },
            { role: "user", content: fullText.slice(0, 50000) }
          ]
        });
        autoSummary = sumComp.choices[0]?.message?.content || "";
      } catch (sumErr) {
        console.error("🔥 [Upload] PDF Summary failed:", sumErr);
      }
    }

    res.json({
      text: fullText.trim(),
      description: descriptions.join("\n\n").trim(),
      summary: autoSummary.trim()
    });
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

// --- SERVER STARTUP ---
const port = Number(process.env.PORT || 3000);
const server = http.createServer(app);

server.listen(port, () => {
  console.log(`🚀 Johnny Server running on port ${port}`);
  console.log(`   OpenAI Realtime Model: ${OPENAI_REALTIME_MODEL}`);
  console.log(`   OpenAI Chat Model: ${OPENAI_CHAT_MODEL}`);
  console.log(`   OpenAI Image Model: ${OPENAI_IMAGE_MODEL}`);
});
