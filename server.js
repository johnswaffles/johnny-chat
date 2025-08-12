// server.js — Johnny Chat backend (ESM, Node 20+)
import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs"; // workerless use

const app = express();
const upload = multer({ limits: { fileSize: 40 * 1024 * 1024 } }); // 40MB/file
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// ---------- OpenAI ----------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CHAT_MODEL   = process.env.CHAT_MODEL   || "gpt-5";
const IMAGE_MODEL  = process.env.IMAGE_MODEL  || "gpt-image-1";
const VISION_MODEL = process.env.VISION_MODEL || "gpt-4o-mini";

// ---------- utils ----------
const ok  = (res, data) => res.status(200).json(data);
const bad = (res, code, err) => res.status(code).json({ error: String(err?.message || err) });
const newId = () =>
  (globalThis.crypto?.randomUUID?.() || `id-${Math.random().toString(36).slice(2)}`);

// health
app.get("/health", (_req, res) => ok(res, { ok: true, ts: Date.now() }));

// ---------- tiny in‑memory doc store ----------
const DOCS = new Map();

// ---------- Responses API helper (with web_search tool) ----------
function wantsLiveInfo(q = "") {
  return /\b(now|today|latest|news|price|forecast|weather|score|traffic|open|closed|warning|advisory)\b/i.test(
    q || ""
  );
}

async function llm({ system, user, max_output_tokens = 1800, enableWeb = false }) {
  const input = [
    ...(system ? [{ role: "system", content: system }] : []),
    { role: "user", content: user },
  ];

  const useWeb = !!enableWeb || wantsLiveInfo(user);

  const resp = await openai.responses.create({
    model: CHAT_MODEL,
    input,
    max_output_tokens,
    ...(useWeb ? { tools: [{ type: "web_search" }] } : {}), // model will invoke web search as needed
  });

  const text = resp.output_text ?? "";
  const sources = Array.from(text.match?.(/\bhttps?:\/\/[^\s)]+/g) || []);
  return { text, sources };
}

// ---------- /api/chat ----------
app.post("/api/chat", async (req, res) => {
  try {
    const { input, history = [], mode } = req.body || {};
    if (!input || typeof input !== "string") return bad(res, 400, "missing input");

    const hist = history
      .slice(-30)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const system =
      mode === "writepaper"
        ? "You are a rigorous, elegant academic writer. Produce tightly argued, source‑aware prose with clear structure and strong transitions. No headings unless asked."
        : "You are a precise assistant. Prefer fresh, verifiable information. If live data is implied, use the web_search tool.";

    const user = hist
      ? `Conversation summary:\n${hist}\n\nCurrent user message:\n${input}`
      : input;

    const { text, sources } = await llm({
      system,
      user,
      max_output_tokens: mode === "writepaper" ? 4000 : 1800,
      enableWeb: true, // always allowed; model decides when to call it
    });

    return ok(res, { reply: text, sources });
  } catch (err) {
    return bad(res, 500, err);
  }
});

// ---------- /api/beautify ----------
app.post("/api/beautify", async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text) return bad(res, 400, "missing text");
    const { text: pretty } = await llm({
      system:
        "Rewrite the text for clarity, flow, and concision. Preserve meaning. Remove raw URLs and citation clutter. Return improved text only.",
      user: text,
      max_output_tokens: 800,
    });
    return ok(res, { pretty });
  } catch (err) {
    return bad(res, 500, err);
  }
});

// ---------- PDF text (no worker on Node) ----------
async function pdfToText(buffer) {
  const loadingTask = pdfjs.getDocument({
    data: buffer,
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  });
  const doc = await loadingTask.promise;
  const parts = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const text = content.items.map((it) => (typeof it.str === "string" ? it.str : "")).join(" ");
    parts.push(text);
  }
  return parts.join("\n\n").replace(/[ \t]+/g, " ").trim();
}

// ---------- /upload (PDFs + images) ----------
app.post("/upload", upload.array("files", 8), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) return bad(res, 400, "no files");

    const manifest = [];
    const textParts = [];
    const imageParts = [];

    for (const f of files) {
      manifest.push({ name: f.originalname, type: f.mimetype, size: f.size });

      if (f.mimetype === "application/pdf") {
        const txt = await pdfToText(f.buffer);
        if (txt) textParts.push(`--- ${f.originalname} ---\n${txt}`);
      } else if (f.mimetype.startsWith("image/")) {
        // Responses API requires `input_image` parts; build as data URLs
        const dataUrl = `data:${f.mimetype};base64,${f.buffer.toString("base64")}`;
        imageParts.push({ type: "input_image", image_url: { url: dataUrl } });
      }
    }

    // If images were provided, run OCR/summary with the VISION model using valid content parts
    if (imageParts.length) {
      const resp = await openai.responses.create({
        model: VISION_MODEL,
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: "Extract visible text (OCR) and give a short 2–3 sentence summary." }, ...imageParts],
          },
        ],
        max_output_tokens: 1200,
      });
      const visionText = resp.output_text ?? "";
      if (visionText) textParts.push(`--- Images (OCR + summary) ---\n${visionText}`);
    }

    const text = textParts.join("\n\n").trim();

    // concise summary for UI
    let summary = "";
    if (text) {
      const { text: sum } = await llm({
        system: "You summarize documents crisply.",
        user:
          "Summarize in 5–8 bullet points. Keep concrete facts (numbers, dates, names). Avoid fluff.",
        max_output_tokens: 500,
      });
      summary = sum;
    }

    const id = newId();
    DOCS.set(id, { text, summary, files: manifest });
    return ok(res, { id, docId: id, text, summary, files: manifest });
  } catch (err) {
    return bad(res, 500, err);
  }
});

// ---------- /query (QA over uploaded text) ----------
app.post("/query", async (req, res) => {
  try {
    const { docId, question } = req.body || {};
    if (!docId || !DOCS.has(docId)) return bad(res, 400, "missing or unknown docId");
    if (!question) return bad(res, 400, "missing question");

    const { text, files } = DOCS.get(docId);
    const { text: answer } = await llm({
      system:
        "Answer strictly from the provided document text. If the answer is not present, say that you can’t find it in the document.",
      user: `DOCUMENT TEXT:\n${text}\n\nQUESTION: ${question}\n\nAnswer:`,
      max_output_tokens: 1200,
    });
    return ok(res, { answer, files });
  } catch (err) {
    return bad(res, 500, err);
  }
});

// ---------- /generate-image ----------
app.post("/generate-image", async (req, res) => {
  try {
    const { prompt, size = "1024x1024", images = [] } = req.body || {};
    if (!prompt && !images?.length) return bad(res, 400, "missing prompt");

    const imgResp = await openai.images.generate({
      model: IMAGE_MODEL,
      prompt: images?.length
        ? `${prompt}\n\nReference images attached; align to obvious composition/subject while improving quality.`
        : prompt,
      size,
    });

    const image_b64 = imgResp.data?.[0]?.b64_json;
    if (!image_b64) return bad(res, 502, "image generation failed");
    return ok(res, { image_b64 });
  } catch (err) {
    return bad(res, 500, err);
  }
});

// ---------- start ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Johnny Chat backend listening on :${PORT}`));
