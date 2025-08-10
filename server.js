import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import OpenAI from "openai";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

/*
 * server.js
 *
 * This file exposes a small API used by the companion client.  The core
 * capabilities include:
 *
 *  - /api/chat        Chat with OpenAI's Responses API, including the ability
 *                     to perform web searches.  Clients may send along a
 *                     conversation history array in the request body.  The
 *                     server will prepend a system prompt and append the
 *                     latest user message before forwarding the entire
 *                     conversation to the OpenAI API.  This endpoint is
 *                     idempotent and does not persist state on the server;
 *                     it relies on the client to provide any history.
 *
 *  - /upload          Accept a single PDF or image file (up to 25 MB).  For
 *                     PDFs the text is extracted via pdfjs and summarised
 *                     using a chat completion.  For images the file is
 *                     converted to a data URL and then passed through
 *                     OpenAI's Vision model, which returns both a brief
 *                     summary and any OCR‑extracted text.  The extracted
 *                     content is stored in an in‑memory map keyed by a
 *                     randomly generated identifier.  The upload response
 *                     returns the id along with the raw text and summary.
 *
 *  - /query           Given a previously uploaded document id and a natural
 *                     language question, answer the question strictly from
 *                     the document’s content.  If the document cannot be
 *                     found or no question is supplied, the endpoint
 *                     responds with an error.
 *
 *  - /generate-image  Create an image using OpenAI’s image generation API.
 *                     Supports a small set of fixed sizes.  Returns a base64
 *                     encoded PNG.  If no image could be generated the
 *                     endpoint returns a 502.
 *
 *  - /api/diag        Sanity‑check endpoint used by the client to detect
 *                     whether the hosted web_search tool is available.
 *
 * Note: This file uses ES modules and therefore requires "type":"module"
 *       in your package.json.  You should also define the appropriate
 *       OPENAI_API_KEY, CHAT_MODEL, VISION_MODEL and IMAGE_MODEL variables in
 *       a .env file or your deployment environment.
 */

dotenv.config();

const PORT         = process.env.PORT || 3000;
// The chat model powering general conversation.  Defaults to gpt‑5 chat.
const CHAT_MODEL   = process.env.CHAT_MODEL   || "gpt-5-chat-latest";
// The vision model used for describing and OCR’ing images.  Defaults to gpt‑4o‑mini.
const VISION_MODEL = process.env.VISION_MODEL || "gpt-4o-mini";
// The image model used for generative art.  Defaults to gpt‑image‑1.
const IMAGE_MODEL  = process.env.IMAGE_MODEL  || "gpt-image-1";

const app = express();
app.use(express.json({ limit: "25mb" }));
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://justaskjohnny.com",
    "https://www.justaskjohnny.com",
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-User-Id"],
}));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* --------------------------------------------------------------------------
 * Utility functions
 */

/**
 * Shallowly serialises any thrown OpenAI or HTTP error into a JSON friendly
 * object.  Useful for logging.
 *
 * @param {unknown} e The error to serialise
 * @returns {string} A stringified representation of the error
 */
const dumpErr = (e) => {
  try {
    return JSON.stringify({
      name: e?.name,
      message: e?.message,
      code: e?.code,
      status: e?.status,
      data: e?.response?.data,
    }, null, 2);
  } catch {
    return String(e);
  }
};

/**
 * Given a response from the Responses API, extract the plain text reply and
 * collect any HTTP/HTTPS links found anywhere in the nested object.  This is
 * useful for displaying sources to the user.
 *
 * @param {object} resp The responses.create result
 * @returns {{ reply: string, sources: string[] }}
 */
function collectReplyAndSources(resp) {
  let reply = resp?.output_text ?? (resp?.output?.[0]?.content?.[0]?.text || "");
  const urls = new Set();
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (typeof v === "string" && /^https?:\/\//i.test(v)) urls.add(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") walk(v);
    }
  };
  walk(resp);
  return { reply: (reply || "").trim(), sources: Array.from(urls) };
}

/**
 * Ask a question using OpenAI's hosted search.  This helper wraps the
 * responses.create API and retries with a preview mode if the primary web
 * search tool is unavailable.
 *
 * @param {object[]} messages Array of chat history messages (system,
 * user, assistant)
 * @returns {Promise<any>} The raw OpenAI responses.create result
 */
async function askWithHostedSearch(messages) {
  // When using hosted search the web_search tool should be declared on the
  // first call.  If it fails we can fallback to web_search_preview.  In the
  // worst case we rethrow and the caller can handle the error.
  const toolType = { type: "web_search" };
  try {
    return await openai.responses.create({
      model: CHAT_MODEL,
      input: messages,
      tools: [toolType],
    });
  } catch (e1) {
    const msg = `${e1?.message || ""}`;
    const retriable = /not enabled|hosted tool|unsupported|unknown tool|not found|404/i.test(msg);
    console.error("web_search failed:", dumpErr(e1));
    if (retriable) {
      // Attempt to fallback to the preview tool
      try {
        return await openai.responses.create({
          model: CHAT_MODEL,
          input: messages,
          tools: [ { type: "web_search_preview" } ],
        });
      } catch (e2) {
        console.error("web_search_preview failed:", dumpErr(e2));
      }
    }
    const err = new Error("WEB_SEARCH_TOOL_UNAVAILABLE");
    err.status = 503;
    err.detail = e1?.message || "Hosted tool unavailable for this org";
    throw err;
  }
}

/**
 * Beautify the raw answer returned from askWithHostedSearch().  A short
 * post‑processing call cleans up markdown formatting, removes raw markdown
 * links and asks the model to rewrite the answer as 3–6 concise bullet
 * points.  The original sources are supplied separately for later display.
 *
 * @param {string} raw The raw answer
 * @param {string[]} sources Array of URLs extracted by collectReplyAndSources()
 * @returns {Promise<string>} The cleaned up answer or the original raw answer
 */
async function beautifyAnswer(raw, sources = []) {
  if (!raw) return raw;
  try {
    const prompt =
      "Rewrite the answer so it’s clear and easy to read.\n" +
      "Rules:\n" +
      "- Use 1–2 short paragraphs OR 3–6 crisp bullet points.\n" +
      "- No markdown link syntax. Do NOT include [text](url) or bare URLs inside the text.\n" +
      "- Do not invent sources or facts.\n";
    const r = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: prompt },
        { role: "assistant", content: raw },
      ],
      temperature: 0.2,
    });
    return r.choices?.[0]?.message?.content?.trim() || raw;
  } catch (e) {
    console.error("BEAUTIFY_FAILED:", dumpErr(e));
    return raw;
  }
}

/* --------------------------------------------------------------------------
 * Chat API
 */

app.post("/api/chat", async (req, res) => {
  try {
    // Pull the latest user message from either `message` or `input` for backwards compatibility.
    const input = String(req.body?.message ?? req.body?.input ?? "").trim();
    // Sanitize conversation history: keep only { role, content } to avoid unknown fields like sources.
    let history = [];
    if (Array.isArray(req.body?.history)) {
      history = req.body.history
        .filter(item => item && typeof item.role === "string" && typeof item.content === "string")
        .map(item => ({ role: item.role, content: item.content }));
    }
    if (!input && history.length === 0) {
      return res.status(400).json({ error: "NO_INPUT" });
    }
    // Compose messages: a system prompt, sanitized history, then the latest user input.
    const messages = [
      {
        role: "system",
        content:
          "You are a concise assistant. For any time-sensitive topic (weather, news, sports, prices, schedules, elections, policies), use the web_search tool and cite 2–4 links at the end.",
      },
      ...history,
      { role: "user", content: input },
    ];
    const resp = await askWithHostedSearch(messages);
    let { reply, sources } = collectReplyAndSources(resp);
    const pretty = await beautifyAnswer(reply, sources);
    res.json({ reply: pretty || reply, sources });
  } catch (e) {
    console.error("CHAT_FAILED:", dumpErr(e));
    const status = e?.status || 500;
    res.status(status).json({
      error: "CHAT_FAILED",
      detail: e?.detail || e?.message || "Unknown error",
      hint: status === 503
        ? "Enable hosted web_search for your OpenAI org (or preview) and redeploy."
        : undefined,
    });
  }
});

/* --------------------------------------------------------------------------
 * Document upload and Q&A endpoints
 */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});
// In‑memory store of uploaded docs keyed by a short id.  Contents are not
// persisted across restarts.
const docs = Object.create(null);
const makeId = () => Math.random().toString(36).slice(2, 10);

/**
 * Extract plain text from a PDF buffer using pdfjs.  Concatenates all pages.
 *
 * @param {Buffer} buffer The raw PDF
 * @returns {Promise<string>} The extracted text
 */
async function extractPdfText(buffer) {
  // Always pass a Uint8Array to pdfjs to avoid "Please provide binary data as 'Uint8Array'" errors.
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({ data }).promise;
  let text = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    text += content.items.map((i) => i.str).join(" ") + "\n";
  }
  return text.trim();
}

/**
 * Summarise a large block of text.  Only the first nChars characters will be
 * sent to the model to avoid exceeding the token limit.  The summary will
 * consist of a handful of bullet points and is meant for quick reference.
 *
 * @param {string} text The text to summarise
 * @param {number} nChars Optional maximum characters to consider
 * @returns {Promise<string>} A bullet point summary
 */
async function summarizeText(text, nChars = 120_000) {
  const r = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      { role: "system", content: "Summarise clearly in 4–6 bullets. Keep it faithful to the source." },
      { role: "user", content: text.slice(0, nChars) },
    ],
  });
  return r.choices?.[0]?.message?.content ?? "";
}

/**
 * Call the Vision model to describe an image and perform OCR.  Returns an
 * object with a summary and the extracted text.  The prompt instructs the
 * model to output two labelled sections: Summary: and Text:.
 *
 * @param {string} dataUrl A data: URI for the image
 * @returns {Promise<{ summary: string, text: string }>} The description and OCR
 */
async function describeImage(dataUrl) {
  const r = await openai.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Describe the image briefly and OCR any visible text. Two sections: Summary: and Text:." },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });
  const reply = r.choices?.[0]?.message?.content ?? "";
  const parts = reply.split(/\bSummary:\s*/i).join("").split(/\bText:\s*/i);
  return { summary: (parts[0] || "").trim(), text: (parts[1] || "").trim() };
}

// Upload endpoint.  Accepts a file uploaded under the field name "file" and
// returns an id along with any extracted text and summary.  Recognises PDF
// documents and common image formats.  Unsupported types result in a 415.
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "NO_FILE" });
    const mime = req.file.mimetype || "";
    const buf = req.file.buffer;
    let text = "";
    let summary = "";
    let kind = "unknown";
    if (mime === "application/pdf") {
      kind = "pdf";
      text = await extractPdfText(buf);
      summary = text ? await summarizeText(text) : "";
    } else if (mime.startsWith("image/")) {
      kind = "image";
      const b64 = buf.toString("base64");
      const dataUrl = `data:${mime};base64,${b64}`;
      const d = await describeImage(dataUrl);
      text = d.text;
      summary = d.summary;
    } else {
      return res.status(415).json({ error: "UNSUPPORTED_TYPE", mime });
    }
    const docId = makeId();
    docs[docId] = { text, summary, kind };
    res.json({ ok: true, docId, kind, text, summary });
  } catch (e) {
    console.error("UPLOAD_FAILED:", dumpErr(e));
    res.status(500).json({ error: "UPLOAD_FAILED", detail: e?.message || String(e) });
  }
});

// Query endpoint.  Answer a question about a previously uploaded document.
app.post("/query", async (req, res) => {
  try {
    const docId = String(req.body?.docId || "");
    const question = String(req.body?.question || "").trim();
    if (!docId || !docs[docId]) return res.status(404).json({ error: "DOC_NOT_FOUND" });
    if (!question) return res.status(400).json({ error: "QUESTION_REQUIRED" });
    const ctx = docs[docId].text.slice(0, 150_000);
    const r = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: "Answer strictly from the provided document; if missing, say so briefly." },
        { role: "user", content: `Document:\n---\n${ctx}\n---\n\nQuestion: ${question}\nAnswer:` },
      ],
    });
    res.json({ answer: r.choices?.[0]?.message?.content ?? "no answer" });
  } catch (e) {
    console.error("QUERY_FAILED:", dumpErr(e));
    res.status(500).json({ error: "QUERY_FAILED", detail: e?.message });
  }
});

/* --------------------------------------------------------------------------
 * Image generation
 */

app.post("/generate-image", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();
    let size = String(req.body?.size || "1024x1024");
    if (!prompt) return res.status(400).json({ error: "PROMPT_REQUIRED" });
    const allowed = new Set(["1024x1024", "1024x1536", "1536x1024", "auto"]);
    if (!allowed.has(size)) size = "1024x1024";
    const img = await openai.images.generate({ model: IMAGE_MODEL, prompt, size });
    const b64 = img.data?.[0]?.b64_json;
    if (!b64) return res.status(502).json({ error: "NO_IMAGE" });
    res.json({ image_b64: b64 });
  } catch (err) {
    console.error("IMAGE_FAILED:", dumpErr(err));
    res.status(500).json({ error: "IMAGE_FAILED", detail: err?.message });
  }
});

/* --------------------------------------------------------------------------
 * Diagnostics
 */

app.get("/api/diag", async (_req, res) => {
  let hosted = "unknown";
  try {
    await openai.responses.create({
      model: CHAT_MODEL,
      input: [ { role: "user", content: "ping" } ],
      tools: [ { type: "web_search" } ],
    });
    hosted = "web_search";
  } catch (e1) {
    try {
      await openai.responses.create({
        model: CHAT_MODEL,
        input: [ { role: "user", content: "ping" } ],
        tools: [ { type: "web_search_preview" } ],
      });
      hosted = "web_search_preview";
    } catch {
      hosted = "unavailable";
    }
  }
  res.json({ ok: true, chat_model: CHAT_MODEL, hosted_search: hosted, pdfjs: "legacy/build/pdf.mjs" });
});

/* --------------------------------------------------------------------------
 * Start the server
 */
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT} (chat=${CHAT_MODEL}, vision=${VISION_MODEL}, image=${IMAGE_MODEL})`);
  console.log("   Responses API + hosted web_search; answer beautifier enabled.");
});
