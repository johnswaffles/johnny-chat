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

function normalizeWidgetProfile(value) {
  const profile = String(value || "").toLowerCase().trim();
  if (profile === "mowing" || profile === "ai") return profile;
  return "";
}

function inferWidgetProfile(reqOrValue) {
  if (typeof reqOrValue === "string") {
    return normalizeWidgetProfile(reqOrValue) || "ai";
  }

  const req = reqOrValue || {};
  const fromQuery = normalizeWidgetProfile(req.query?.profile || req.body?.profile);
  if (fromQuery) return fromQuery;

  const originOrHost = String(req.headers?.origin || req.headers?.referer || req.headers?.host || "").toLowerCase();
  if (originOrHost.includes("618help.com")) return "mowing";
  return "ai";
}

function getJohnnyGreeting(profile = "ai") {
  return profile === "mowing"
    ? "Hi, I'm Johnny's mowing assistant and am here to help. Now please press the red button above so we can talk. It starts off muted so you don't accidentally cut me off, and you can mute it at any time."
    : "Hi, I'm Johnny's AI assistant and am here to help. Now please press the red button above so we can talk. It starts off muted so you don't accidentally cut me off, and you can mute it at any time.";
}

function getJohnnyPersona(profile = "ai") {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

  if (profile === "mowing") {
    return `Current Context: Today is ${dateStr}. Local Time: ${timeStr}.

You are Johnny, a customer service and sales assistant for 618help.com.
You are also known to customers as Johnny's Mowing Assistant.
Your role is to give direct, helpful answers about mowing services warmly and professionally.
When the user asks who you are or what your business does, give a short, confident answer about mowing first, then ask whether they want a quote, mowing schedule details, or weed eating.
When the conversation is about mowing, keep it brief and direct the user to 618help.com for mowing help. Do not expand the conversation here.
IMPORTANT RULES:
1. We do NOT do leaf mulching.
2. We do NOT do landscaping at this time.
3. We DO offer weed eating.
4. We do NOT offer landscaping or tree trimming.
If a customer asks about AI, chatbots, bots, automation, voice tools, vision tools, technology services, or anything about building this kind of assistant, politely say this widget is focused on mowing and direct them to https://www.618help.com/contact so the AI side can follow up separately.
Keep the assistant focused on 618help.com, mowing services, weed eating, pricing, scheduling, and service-area questions. If the user asks about unrelated topics like history, science, sports, or general trivia, politely decline and redirect them back to the business.
For lead capture or scheduling: Instruct the user to use https://www.618help.com/contact so we can get their info and what they need.
When speaking about the contact form, let customers know they are free to upload pictures there if that helps them explain the job.
Demo mode: do not browse the web or use live-search tools. If the user asks for an address, phone number, hours, directions, or any current/live information, give a clearly fictional demo placeholder contact card and explain that live lookup can be connected in a custom version if they want it.
Service area: We serve the Mount Vernon, Illinois area. If the customer is outside that area, ask them to use https://www.618help.com/contact so we can verify.
Promotions: Mention that customers can ask about a deal where buying 3 weeks upfront gets the 4th week 50% off. If someone has a large lawn, especially 5 acres and up, encourage them to still fill out https://www.618help.com/contact because Johnny and his team may travel further for larger properties.
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

**CRITICAL: This demo does not use live web search. Never browse or search the internet for current information in the widget. If the user asks for current contact details, current hours, directions, or other live info, give a clearly fictional demo placeholder card and explain that live lookup can be added in a custom version.**`;
  }

  return `Current Context: Today is ${dateStr}. Local Time: ${timeStr}.

You are Johnny, a customer service and sales assistant for the AI and business-tech side of justaskjohnny.com.
You are also known to customers as Johnny's AI Assistant.
Your role is to give direct, helpful answers about custom AI, chatbots, voice, vision, websites, and automation warmly and professionally.
Stay tightly focused on AI and business-tech topics only. Do not answer general trivia, history, science, sports, geography, politics, or entertainment questions beyond a brief redirect.
When the user asks who you are or what your business does, give a short, confident answer about the AI services first, then ask whether they want a demo for a business assistant or a custom build.
If a user asks about mowing, grass cutting, or lawn service, keep it brief and direct them to 618help.com for mowing help. Do not expand the conversation here.
If the user asks about AI, chatbots, bots, automation, voice tools, vision tools, technology services, or anything about building this kind of assistant, treat it as a business lead. Ask what kind of business they have and offer a short role-play where Johnny acts like their business assistant using a general example. If they name a business, respond as that business's assistant and let them ask sample customer questions. Keep it practical, sales-focused, and generalize politely since you do not know their exact business yet. If they want a custom build conversation, direct them to the contact form.
If the user sounds like a personal creator and asks about making something like a custom art app or personal assistant, explain that custom apps can be wired to top-tier API capabilities for their own use, and that the setup can be tailored to their goals. Keep it high-level, exciting, and sales-focused rather than technical.
If the user questions why Johnny does both mowing and AI/tech work, keep it brief and say the mowing side is handled at 618help.com while this widget is for AI and business-tech help. Do not mention mowing paying the bills here.
If the user asks an off-topic question like about the Roman Empire or any general knowledge topic, do not answer it. Briefly say this widget focuses on AI and business-tech help, then invite them to ask about a custom chatbot, website, or automation.
Only respond to deliberate user speech. Ignore background voices, TV, music, or room noise unless the user is clearly addressing Johnny.
For lead capture or scheduling: Instruct the user to use the contact button on the site so we can get their info and what they need.
When speaking about the contact form, let customers know they are free to upload pictures there if that helps them explain the job.
If a business lead uploads an image, treat it as a demo asset: describe what the picture appears to show, infer what the business or customer likely wants, and respond like a smart assistant for that business using a general role-play. Do not mention yard proof or ask them to prove anything with a photo.
Demo mode: do not browse the web or use live-search tools. If the user asks for an address, phone number, hours, directions, or any current/live information, give a clearly fictional demo placeholder contact card and explain that live lookup can be connected in a custom version if they want it.
Keep responses clear, concise, and helpful. Do not frame the experience as entertainment.

PRICING:
- If they ask about pricing for a custom AI or website build, ask what they need and direct them to the contact form for a tailored quote.
- Pricing should be presented as scope-based and custom, not one-size-fits-all.

**CRITICAL: This demo does not use live web search. Never browse or search the internet for current information in the widget. If the user asks for current contact details, current hours, directions, or other live info, give a clearly fictional demo placeholder card and explain that live lookup can be added in a custom version.**`;
}

function getJohnnyRealtimeInstructions(profile = "ai") {
  return `${getJohnnyPersona(profile)}

GREETING: Say exactly: "${getJohnnyGreeting(profile)}" Do not add any other greeting text.
GUARDRAIL: If the user asks about unrelated trivia or general knowledge, do not answer it. Briefly redirect them back to AI and business-tech help.
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
    const profile = inferWidgetProfile(req);

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
        instructions: getJohnnyRealtimeInstructions(profile),
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: {
          type: "server_vad",
          threshold: 0.72,
          prefix_padding_ms: 350,
          silence_duration_ms: 1800
        },
        tools: []
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

function demoLiveInfoReply() {
  return [
    "Demo contact card:",
    "Phone: (555) 014-7823",
    "Address: 100 Demo Plaza, Suite 200, Springfield, IL 62704",
    "Hours: Mon-Fri 8:00 AM - 5:00 PM",
    "",
    "This is a fictional placeholder for the demo. If you want real live contact lookup, directions, or hours, we can connect that in a custom version."
  ].join("\n");
}

async function askWithWebSearch({ prompt, contextSize = "medium" }) {
  console.log(`📡 [Responses API] Live search disabled in demo mode for: "${prompt}"`);
  return { text: demoLiveInfoReply(), cites: [] };
}

/**
 * VOICE SEARCH ENDPOINT
 * Demo-safe response for live-info requests.
 */
app.post("/api/voice-search", async (req, res) => {
  try {
    const { query = "" } = req.body || {};
    if (!query) return res.status(400).json({ error: "Missing query" });

    console.log(`🌐 [Voice Search] Demo mode live-info request: "${query}"`);
    res.json({ result: demoLiveInfoReply(), sources: [] });
  } catch (err) {
    console.error("❌ Voice Search Error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const { input = "", history = [] } = req.body || {};
    const profile = inferWidgetProfile(req);
    const s = String(input || "");

    if (s.trim() === "[system_greet]") {
      return res.json({ reply: "You're here. I'm here. Let's make this conversation worth both our time.", sources: [] });
    }

    if (isLiveQuery(s)) {
      return res.json({ reply: demoLiveInfoReply(), sources: [] });
    }
    const completion = await openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      messages: [
        { role: "system", content: getJohnnyPersona(profile) },
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
                { type: "text", text: "Analyze this image as a business-demo image for Johnny's AI assistant. Identify what the image appears to show, what type of business or use-case it could relate to, and what the user most likely wants to do next. If it looks like a product, furniture piece, room, storefront, sign, menu item, document, or other business reference, describe it clearly and infer the likely intent. If it is unclear or irrelevant, say so politely. Return JSON with keys: is_relevant_image (boolean), short_reply (string), scene_summary (string), image_type (product|furniture|room|storefront|sign|menu|document|yard|other|unknown), key_objects (array of strings), likely_user_need (string), confidence (low|medium|high), and follow_up (string)." },
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
