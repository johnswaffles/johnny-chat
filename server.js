import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI, { toFile } from "openai";
import { createRequire } from "module";
import http from "http";
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const {
  OPENAI_API_KEY,
  OPENAI_REALTIME_MODEL = "gpt-realtime-1.5",
  OPENAI_REALTIME_VOICE = "echo",
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

function getJohnnyPersona() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

  return `Current Context: Today is ${dateStr}. Local Time: ${timeStr}.

You are Johnny, a customer service and sales assistant for justaskjohnny.com - mowing.
You are also known to customers as Johnny's AI Assistant.
Your role is to give direct, helpful answers about mowing services warmly and professionally.
IMPORTANT RULES: 
1. We do NOT do leaf mulching. 
2. We do NOT do landscaping at this time. 
3. We DO offer weed eating.
4. We do NOT offer landscaping or tree trimming.
If a customer asks about any service we do not offer, politely explain that we don't offer it right now and steer the conversation back to mowing or weed eating.
Keep the assistant focused on justaskjohnny.com - mowing, the website, mowing services, weed eating, pricing, scheduling, and service-area questions. If the user asks about unrelated topics like history, science, sports, or general trivia, politely decline and redirect them back to the business.
If the user asks about AI, chatbots, bots, automation, voice tools, vision tools, technology services, or anything about building this kind of assistant, do not answer the technical question. Instead, warmly explain that we can absolutely talk about it, and ask them to use the contact form so we can understand what they need and follow up the right way.
For lead capture or scheduling: Instruct the user to use the contact button on the site so we can get their info and what they need.
When speaking about the contact form, let customers know they are free to upload pictures of their yard there if that helps them explain the job.
Service area: We serve the Mount Vernon, Illinois area. If the customer is outside that area, ask them to use the contact button so we can verify.
Promotions: Mention that customers can ask about a deal where buying 3 weeks upfront gets the 4th week 50% off. If someone has a large lawn, especially 5 acres and up, encourage them to still fill out the contact button because Johnny and his team may travel further for larger properties.
Future services: You may tease that brush hog service and light tractor work are coming soon, but do not promise a date or availability yet.
Keep responses clear, concise, and helpful. Do not frame the experience as entertainment.

PRICING:
- Mowing is $75 per hour.
- As a rough example, it takes about 1 hour to mow 1 acre, so approximately $75 per acre.
- If a customer says a specific yard will take less or more time, acknowledge that some properties are faster and some slower. The one-hour-per-acre figure is a general average, not a hard rule.
- If the property is large, open, smooth, and has few or no obstacles, and the customer thinks it can be done faster, be flexible and say Johnny can discuss discounts in that situation.
- When someone asks about pricing, ask probing questions about their yard: How big is it? How many acres or square feet? Is it flat or hilly? Any obstacles like fences, trees, or flower beds?
- If they say something vague like "a lot" or "big yard", help them estimate by asking follow-up questions. Use the 1 hour per acre guideline to estimate time and cost.
- If someone asks why it's expensive or pushes back on pricing, explain warmly but firmly that the price reflects the truck, trailer, commercial equipment, fuel, insurance, travel time between jobs, setup, breakdown, and the expertise to do it right.
- Add a value-first angle: the customer is not buying a mower, they are buying back their time, avoiding breakdown headaches, and skipping the cost of owning and maintaining a $10,000 to $15,000 machine that can fail on them.
- Reinforce that hiring us means more free time for family, work, rest, and actually enjoying life instead of worrying about mowing, repairs, fuel, and maintenance.
- Keep the tone confident, respectful, and helpful. Do not get defensive; explain the value like a trusted pro who knows the service is worth it.

**CRITICAL: ALWAYS use the web_search tool for ANY request involving locations, directions, weather, prices, hours, or current information. NEVER say you can't access real-time data - you CAN through web_search!**`;
}

function getJohnnyRealtimeInstructions() {
  return `${getJohnnyPersona()}

GREETING: Say exactly: "Hi, I'm Johnny's AI assistant and am here to help. Now please press the red button above so we can talk. It starts off muted so you don't accidentally cut me off, and you can mute it at any time." Do not add any other greeting text.
STYLE: Genuinely professional, warm, persuasive, trustworthy. Action-oriented and concise.`;
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

    const modelToUse = OPENAI_REALTIME_MODEL || "gpt-realtime-1.5";
    console.log(`📡 [Realtime] Requesting session for model: ${modelToUse}`);

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelToUse,
        voice: OPENAI_REALTIME_VOICE,
        instructions: getJohnnyRealtimeInstructions(),
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: {
          type: "server_vad",
          threshold: 0.55,
          prefix_padding_ms: 200,
          silence_duration_ms: 1200
        },
        tools: [
          {
            type: "function",
            name: "web_search",
            description: "ALWAYS use this tool to search the internet for ANY real-time information. You MUST use this for: finding locations (gas stations, campgrounds, restaurants), current weather, prices, hours of operation, directions, news, or anything that might change over time. Never guess at specific addresses, phone numbers, or prices - always search first.",
            parameters: {
              type: "object",
              properties: { query: { type: "string", description: "Search query - be specific including location if relevant" } },
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

// Allow iframe embedding from any origin
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "ALLOWALL");
  res.setHeader("Content-Security-Policy", "frame-ancestors *");
  next();
});

app.use(express.static("public"));

app.get("/health", (_req, res) => res.json({ ok: true, realtimeModel: OPENAI_REALTIME_MODEL, imageModel: OPENAI_IMAGE_MODEL }));

function isLiveQuery(s) {
  return /\b(today|now|latest|breaking|news|headline|earnings|release|score|stocks?|market|price|forecast|weather|traffic|open now)\b/i.test(s);
}

async function askWithWebSearch({ prompt, contextSize = "medium" }) {
  console.log(`📡 [Responses API] Web search for: "${prompt}"`);

  try {
    // Use OpenAI Responses API with built-in web_search_preview tool
    console.log(`📡 [Responses API] Calling openai.responses.create...`);
    const response = await openai.responses.create({
      model: "gpt-4o",
      tools: [{ type: "web_search_preview" }],
      input: prompt,
      instructions: getJohnnyPersona()
    });

    console.log(`📡 [Responses API] Raw response keys:`, Object.keys(response));
    console.log(`📡 [Responses API] output_text exists:`, !!response.output_text);
    console.log(`📡 [Responses API] output array length:`, response.output?.length || 0);

    // Debug: log output structure
    if (response.output) {
      response.output.forEach((item, i) => {
        console.log(`📡 [Responses API] output[${i}].type:`, item.type);
        // Log the full structure of web_search_call to find citation property
        if (item.type === "web_search_call") {
          console.log(`📡 [Responses API] web_search_call keys:`, Object.keys(item));
          console.log(`📡 [Responses API] web_search_call full:`, JSON.stringify(item, null, 2));
        }
      });
    }

    // Extract text from the response
    let text = "";
    const cites = [];

    // Process output items
    if (response.output) {
      for (const item of response.output) {
        if (item.type === "message" && item.content) {
          for (const content of item.content) {
            if (content.type === "output_text") {
              text += content.text;
            }
          }
        }
        // Collect citations from web search results
        if (item.type === "web_search_call" && item.search_results) {
          for (const result of item.search_results) {
            cites.push({ url: result.url, title: result.title });
          }
        }
      }
    }

    // Fallback to output_text if available
    if (!text && response.output_text) {
      text = response.output_text;
    }

    console.log(`✅ [Responses API] Got response with ${cites.length} citations, text length: ${text.length}`);
    return { text, cites };

  } catch (err) {
    console.error("🔥 [Responses API] Search failed:", err.message);
    console.error("🔥 [Responses API] Full error:", JSON.stringify(err, null, 2));
    // Fallback to regular completion
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
 * Uses OpenAI Responses API with web_search_preview for real-time data.
 */
app.post("/api/voice-search", async (req, res) => {
  try {
    const { query = "" } = req.body || {};
    if (!query) return res.status(400).json({ error: "Missing query" });

    console.log(`🌐 [Voice Search] Searching for: "${query}"`);

    const { text, cites } = await askWithWebSearch({
      prompt: query
    });

    console.log(`✅ [Voice Search] Returning answer with ${cites.length} sources`);
    res.json({ result: text, sources: cites });
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
      const { text, cites } = await askWithWebSearch({ prompt: s });
      return res.json({ reply: text, sources: cites });
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
    let imageAnalyses = [];

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
                { type: "text", text: "Analyze this image as a yard and mowing photo for justaskjohnny.com - mowing. If it is a real yard/property image, describe how open it looks, what obstacles are present, whether there are trees, debris, toys, fences, landscaping, or tight areas, and whether it looks wide open or crowded. If it is not a yard or property photo, say so and ask for an actual yard picture. Return JSON with keys: is_yard_photo (boolean), short_reply (string), scene_summary (string), openness (wide_open|moderate|tight|unknown), obstacles (array of strings), debris (array of strings), and follow_up (string)." },
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
          if (res.scene_summary) descriptions.push(`Yard analysis: ${res.scene_summary}`);
          if (res.short_reply) descriptions.push(`Johnny says: ${res.short_reply}`);
          imageAnalyses.push(res);
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
      summary: autoSummary.trim(),
      imageAnalysis: imageAnalyses
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
