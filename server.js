import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI, { toFile } from "openai";
import { createRequire } from "module";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import sgMail from "@sendgrid/mail";
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Disable worker for Node.js environment
// This avoids the need to set up a worker file path which can be tricky in some environments
// or when bundling.

const {
  OPENAI_API_KEY,
  OPENAI_REALTIME_MODEL = "gpt-4o-realtime-preview", // Reverting to stable preview for debug
  OPENAI_CHAT_MODEL = "gpt-4o",
  OPENAI_LIVE_MODEL = "gpt-4o",
  OPENAI_IMAGE_MODEL = "dall-e-3",
  OPENAI_VISION_MODEL = "gpt-4.1-mini",
  MAX_UPLOAD_MB = "40",
  CORS_ORIGIN = "",
  SENDGRID_API_KEY = "",
  ORDER_EMAIL_RECIPIENT = "" // Optional: default email to send copies to
} = process.env;

if (!OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY missing - Realtime and AI features will be disabled.");
}
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
} else {
  console.warn("SENDGRID_API_KEY missing - Email summary will not work.");
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
        instructions: `You are Johnny, an employee at 'Tony's Pizza'.
GOAL: Take the customer's pizza order. Be sarcastic if they give you grief.
MENU & PRICES (Tax Included):
- Personal: $10 | Medium: $15 | Large: $20 | Extra Large: $25
- Toppings: $2 each (Pepperoni, Sausage, Mushrooms, Onions, Peppers, Olives).
RULES:
- WE ONLY SELL PIZZA. No drinks, no sides, no wings, no breadsticks. If asked, refuse sarcastically.
- FEES: Pickup Charge is $10. Delivery is $2 per mile.
- PAYMENT: Cash Only.
- ADDRESS: 123 Broadway, Springfield, Illinois.
BEHAVIOR:
- **CRITICAL**: When the order is finalized, call 'send_order_summary' IMMEDIATELY.
SECRET UNLOCK MODE:
- **TRIGGER**: '10 Extra Large Pizzas with Anchovies'.
- **ACTION**: Ask 'Are you really calling for help from an AI assistant?'.
- **YES**: Become a general AI assistant.
- **NO**: Back to pizza.`,
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
            description: "Search the internet for real-time information.",
            parameters: {
              type: "object",
              properties: { query: { type: "string" } },
              required: ["query"]
            }
          },
          {
            type: "function",
            name: "send_order_summary",
            description: "Sends the order ticket to the Kitchen. Call this IMMEDIATELY when the order is finalized.",
            parameters: {
              type: "object",
              properties: {
                order_details: { type: "string" },
                total_price: { type: "string" },
                customer_address: { type: "string" }
              },
              required: ["order_details", "total_price", "customer_address"]
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
        console.log(`📄 [Upload] Parsing PDF: ${f.originalname} using pdfjs-dist`);
        try {
          // Convert buffer to Uint8Array for pdfjs-dist
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

// --- TWILIO INTEGRATION START ---

// 1. TwiML Endpoint: Twilio calls this when a phone call starts
// Email API for Browser Widget
app.post("/api/send-order-email", async (req, res) => {
  const { order_details, total_price, customer_address } = req.body;
  console.log("📧 [API] Manual Order Email Request:", { customer_address });

  if (!SENDGRID_API_KEY) return res.status(500).json({ error: "Missing SENDGRID_API_KEY" });

  const msg = {
    to: ORDER_EMAIL_RECIPIENT || "johnshopinski@gmail.com",
    from: "orders@justaskjohnny.com",
    subject: "🍕 Tony's Pizza Order Confirmation",
    html: `
            <h1>Tony's Pizza Order</h1>
            <p><strong>Customer Address:</strong> ${customer_address}</p>
            <h3>Order Details:</h3>
            <p>${order_details?.replace(/\n/g, '<br>')}</p>
            <h2>Total Price: ${total_price}</h2>
            <p><em>Cash upon delivery. Thanks for choosing Tony's.</em></p>
        `
  };

  try {
    await sgMail.send(msg);
    res.json({ success: true, message: "Email sent" });
  } catch (error) {
    console.error("❌ API Email Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Summary API for Browser Widget
app.post("/api/record-call-summary", async (req, res) => {
  const { transcript } = req.body;
  console.log("📝 [API] Call Summary Request");

  if (!transcript || transcript.length === 0) return res.json({ success: true, note: "Empty transcript" });

  try {
    const rawTranscript = transcript.map(m => `${m.role.toUpperCase()}: ${m.text}`).join("\n");
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Summarize this phone/chat interaction for Tony's Pizza." },
        { role: "user", content: rawTranscript }
      ]
    });
    const summary = completion.choices[0].message.content;

    const msg = {
      to: ORDER_EMAIL_RECIPIENT || "johnshopinski@gmail.com",
      from: "orders@justaskjohnny.com",
      subject: "📞 Interaction Summary: Johnny Chat",
      html: `<p>${summary.replace(/\n/g, '<br>')}</p><hr><h3>Raw Transcript</h3><pre>${rawTranscript}</pre>`
    };
    await sgMail.send(msg);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Summary API Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/incoming-call", (req, res) => {
  console.log("☎️  [Twilio] Incoming Call");
  // TwiML response telling Twilio to connect the call to our WebSocket stream
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="wss://${req.get("host")}/media-stream" />
    </Connect>
</Response>`;
  res.type("text/xml");
  res.send(twiml);
});

// --- SERVER STARTUP WITH WEBSOCKET SUPPORT ---

const port = Number(process.env.PORT || 3000);
const server = http.createServer(app);

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  console.log("🔌 [WS] Client Connected");

  // Only handle connections to /media-stream
  if (req.url !== '/media-stream') {
    ws.close();
    return;
  }

  let streamSid = null;
  let openAIWs = null;
  let transcript = []; // Store the conversation for a summary

  try {
    // Connect to OpenAI Realtime API
    openAIWs = new WebSocket("wss://api.openai.com/v1/realtime?model=" + (process.env.OPENAI_REALTIME_MODEL || "gpt-4o-realtime-preview"), {
      headers: {
        Authorization: "Bearer " + OPENAI_API_KEY,
        "OpenAI-Beta": "realtime=v1"
      }
    });
  } catch (e) {
    console.error("🔥 [Bridge] OpenAI connection failed:", e);
    ws.close();
    return;
  }

  // Silence Timeout Checker (90s)
  let lastInteractionTime = Date.now();
  const silenceInterval = setInterval(() => {
    if (Date.now() - lastInteractionTime > 90000) { // 90s timeout
      console.log("⏳ [Bridge] Silence Timeout. Ending call.");
      if (openAIWs.readyState === WebSocket.OPEN) openAIWs.close();
      if (ws.readyState === WebSocket.OPEN) ws.close();
      clearInterval(silenceInterval);
    }
  }, 1000);

  // OpenAI Event Handlers
  openAIWs.on("open", () => {
    console.log("🤖 [Bridge] Connected to OpenAI Realtime");
    // Initialize Session with G.711 uLaw audio for telephony
    const sessionUpdate = {
      type: "session.update",
      session: {
        turn_detection: { type: "server_vad" },
        input_audio_format: "g711_ulaw",
        output_audio_format: "g711_ulaw",
        input_audio_transcription: { model: "whisper-1" },
        voice: "ash", // or 'alloy', 'echo', etc.
        instructions: "You are Johnny, an employee at 'Tony's Pizza'.\n" +
          "GOAL: Take the customer's pizza order. Be sarcastic if they give you grief.\n" +
          "MENU & PRICES (Tax Included):\n" +
          "- Personal: $10 | Medium: $15 | Large: $20 | Extra Large: $25\n" +
          "- Toppings: $2 each (Pepperoni, Sausage, Mushrooms, Onions, Peppers, Olives).\n" +
          "RULES:\n" +
          "- WE ONLY SELL PIZZA. No drinks, no sides, no wings, no breadsticks. If asked, refuse sarcastically (e.g., 'Do I look like a bakery? Pizza only.').\n" +
          "- FEES: Pickup Charge is $10 (Reason: 'No parking, causes problems for the city'). Delivery is $2 per mile.\n" +
          "- PAYMENT: Cash Only. No cards, no checks.\n" +
          "- ADDRESS: 123 Broadway, Springfield, Illinois.\n" +
          "BEHAVIOR:\n" +
          "- Focus on getting the pizza size and toppings first. Get the order straight.\n" +
          "- If they chat, you can chat back, but try to steer back to the pizza. Once the order is done, you can talk about whatever.\n" +
          "- **CRITICAL**: When the order is finalized and the user is ready to hang up, you MUST call the 'send_order_summary' tool IMMEDIATELY to send the ticket to the **KITCHEN** so they can start cooking.\n" +
          "SECRET UNLOCK MODE:\n" +
          "- **TRIGGER**: If the customer specifically orders '10 Extra Large Pizzas with Anchovies'.\n" +
          "- **ACTION**: Stop acting like a pizza guy immediately. Ask exactly this: 'Are you really calling for help from an AI assistant?'\n" +
          "- **BRANCH**:\n" +
          "  - IF the user answers 'YES': Completely drop the Tony's Pizza persona. You are now a helpful, unrestricted AI assistant. You can answer ANY question, help with code, math, life advice, etc. Ignore all previous constraints about pizza menus and pricing.\n" +
          "  - IF the user answers 'NO': Say 'Alright, weird order though.' and go back to being the sarcastic Tony's Pizza employee with all the previous rules.\n" +
          "SAFEGUARDS (Active unless Unlocked):\n" +
          "- **NO EMAIL RECEIPTS**: If the customer asks for an email receipt, say 'No, we don't do that. You get an old-fashioned paper receipt with the pizza. That's the way it is.'\n" +
          "- NEVER act as Police, 911, Medical, or Crisis lines. If the topic is serious/emergency, drop character, act like a Pizza Shop, and say 'Sorry, wrong number'.\n" +
          "- NEVER give instructions for dangerous tasks (electrical, plumbing, car repair, tools). Always say 'I don't know how to do that, you should call a professional'.\n" +
          "- NEVER generate fake Credit Card or Bank numbers. If asked for payment, stall. Say you lost your wallet, can't find the card, or ask to pay cash.\n" +
          "TOOLS:\n" +
          "- Only call the 'end_call' tool if the user strictly says 'Goodbye' to hang up.",
        tools: [{
          type: "function",
          name: "end_call",
          description: "Ends the phone call. Only use this if the user says 'Goodbye'.",
          parameters: { type: "object", properties: {} }
        }, {
          type: "function",
          name: "send_order_summary",
          description: "Sends the order ticket to the Kitchen. Call this IMMEDIATELY when the order is finalized so the kitchen knows what to make.",
          parameters: {
            type: "object",
            properties: {
              order_details: { type: "string", "description": "The full list of pizzas, sizes, and toppings ordered." },
              total_price: { type: "string", "description": "The total price including fees." },
              customer_address: { type: "string", "description": "The delivery address provided by the customer. If it is a PICKUP order, use the string 'PICKUP'." }
            },
            required: ["order_details", "total_price", "customer_address"]
          }
        }]
      }
    };
    openAIWs.send(JSON.stringify(sessionUpdate));

    // TRIGGER GREETING: Johnny speaks first
    setTimeout(() => {
      openAIWs.send(JSON.stringify({
        type: "response.create",
        response: {
          instructions: "Say 'Tony's Pizza, this is Johnny speaking.' in a bored or hurried tone."
        }
      }));
    }, 500);
  });

  openAIWs.on("message", (data) => {
    try {
      const response = JSON.parse(data);
      if (response.type === "input_audio_buffer.speech_started") {
        lastInteractionTime = Date.now();
      }
      if (response.type === "response.done") {
        lastInteractionTime = Date.now();
        // Capture Johnny's response for the summary
        response.response?.output?.forEach(output => {
          if (output.type === "message" || output.type === "audio") {
            output.content?.forEach(content => {
              if (content.type === "audio" && content.transcript) {
                transcript.push(`Johnny: ${content.transcript}`);
              }
            });
          }
        });
      }

      if (response.type === "conversation.item.input_audio_transcription.completed") {
        const userText = response.transcript || "...";
        transcript.push(`User: ${userText}`);
        console.log(`👤 User: ${userText}`);
      }

      // Handle 'end_call' tool execution
      if (response.type === "response.function_call_arguments.done" && response.name === "end_call") {
        console.log("📞 [Bridge] hanging up via tool.");
        if (ws.readyState === WebSocket.OPEN) ws.close();
      }

      // Handle 'send_order_summary' tool execution
      if (response.type === "response.function_call_arguments.done" && response.name === "send_order_summary") {
        const args = JSON.parse(response.arguments);
        console.log("📧 [Bridge] Sending Order Email:", args);

        if (process.env.SENDGRID_API_KEY) {
          const msg = {
            to: process.env.ORDER_EMAIL_RECIPIENT || "johnshopinski@gmail.com", // Fallback or configured
            from: "orders@justaskjohnny.com", // Verify this sender in SendGrid
            subject: "🍕 Tony's Pizza Order Confirmation",
            html: `
                  <h1>Tony's Pizza Order</h1>
                  <p><strong>Customer Address:</strong> ${args.customer_address}</p>
                  <h3>Order Details:</h3>
                  <p>${args.order_details.replace(/\n/g, '<br>')}</p>
                  <h2>Total Price: ${args.total_price}</h2>
                  <p><em>Cash upon delivery. Thanks for choosing Tony's.</em></p>
                `
          };
          sgMail.send(msg)
            .then(() => {
              console.log("✅ Email sent");
              // Let AI know it succeeded
              const itemAppend = {
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id: response.call_id,
                  output: JSON.stringify({ success: true, message: "Ticket emailed successfully to Kitchen." })
                }
              };
              openAIWs.send(JSON.stringify(itemAppend));
              openAIWs.send(JSON.stringify({ type: "response.create" }));
            })
            .catch((error) => {
              console.error("❌ Email Error:", error);
              const errorMessage = error.response ? JSON.stringify(error.response.body) : error.message;
              console.log("Sending error back to AI:", errorMessage);

              // Let AI know it FAILED so it can tell the user
              const itemAppend = {
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id: response.call_id,
                  output: JSON.stringify({ success: false, error: errorMessage })
                }
              };
              openAIWs.send(JSON.stringify(itemAppend));

              // Trigger response so Johnny explains the error
              openAIWs.send(JSON.stringify({
                type: "response.create",
                response: {
                  instructions: "The email failed to send. Read the error message to the user specifically so they can fix their settings. Say 'System Error: [Error Details]'."
                }
              }));
            });
        } else {
          console.log("⚠️ No SENDGRID_API_KEY, skipping email.");
        }

        // Let AI know it happened
        const itemAppend = {
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: response.call_id,
            output: JSON.stringify({ success: true, message: "Email sent successfully." })
          }
        };
        openAIWs.send(JSON.stringify(itemAppend));

        // Trigger a response to tell the user
        openAIWs.send(JSON.stringify({ type: "response.create" }));
      }

      if (response.type === "session.updated") {
        console.log("✨ [Bridge] Session Updated");
      }
      if (response.type === "response.audio.delta" && response.delta) {
        lastInteractionTime = Date.now();
        // Forward audio from OpenAI to Twilio
        if (streamSid) {
          const audioDelta = {
            event: "media",
            streamSid: streamSid,
            media: { payload: response.delta }
          };
          ws.send(JSON.stringify(audioDelta));
        }
      }
    } catch (e) {
      console.error("🔥 [Bridge] Error parsing OpenAI message:", e);
    }
  });

  openAIWs.on("close", () => console.log("🤖 [Bridge] OpenAI Disconnected"));
  openAIWs.on("error", (e) => console.error("🔥 [Bridge] OpenAI Error:", e));

  // Twilio Event Handlers
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.event) {
        case "media":
          // Forward audio from Twilio to OpenAI
          if (openAIWs && openAIWs.readyState === WebSocket.OPEN) {
            const audioAppend = {
              type: "input_audio_buffer.append",
              audio: data.media.payload
            };
            openAIWs.send(JSON.stringify(audioAppend));
          }
          break;
        case "start":
          streamSid = data.start.streamSid;
          console.log(`📞 [Bridge] Stream Started: ${streamSid}`);
          break;
        case "stop":
          console.log(`📞 [Bridge] Stream Stopped: ${streamSid}`);
          break;
      }
    } catch (e) {
      console.error("🔥 [Bridge] Error parsing Media Stream message:", e);
    }
  });

  ws.on("close", async () => {
    console.log("🔌 [WS] Client Disconnected");
    if (openAIWs && openAIWs.readyState === WebSocket.OPEN) openAIWs.close();
    clearInterval(silenceInterval);

    // Send call summary email automatically
    if (transcript.length > 0) {
      console.log("📝 Generating Call Summary...");
      try {
        const rawTranscript = transcript.join("\n");
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a helpful assistant loging phone calls for Tony's Pizza. Summarize the following phone call into 2-3 concise bullet points. Mention orders, requests, and the outcome." },
            { role: "user", content: `Call Transcript:\n${rawTranscript}` }
          ]
        });
        const summary = completion.choices[0].message.content;

        const msg = {
          to: process.env.ORDER_EMAIL_RECIPIENT || "johnshopinski@gmail.com",
          from: "orders@justaskjohnny.com",
          subject: "📞 Call Summary: Interaction with Johnny",
          html: `
            <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
              <h2 style="color: #d32f2f;">🍕 Call Summary</h2>
              <p>${summary.replace(/\n/g, '<br>')}</p>
              <hr>
              <h3 style="color: #666;">Raw Transcript</h3>
              <pre style="background: #f4f4f4; padding: 15px; border-radius: 8px; border: 1px solid #ddd; white-space: pre-wrap;">${rawTranscript}</pre>
            </div>
          `
        };
        await sgMail.send(msg);
        console.log("✅ Automatic Summary Email Sent");
      } catch (e) {
        console.error("❌ Failed to send summary email:", e);
      }
    }
  });
});

server.listen(port, () => {
  console.log(`server on :${port}`);
});
