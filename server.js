import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI, { toFile } from "openai";
import nodemailer from "nodemailer";
import { createRequire } from "module";
import http from "http";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import path from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const {
  OPENAI_API_KEY,
  OPENAI_REALTIME_MODEL = "gpt-realtime-1.5",
  OPENAI_REALTIME_VOICE = "echo",
  OPENAI_CHAT_MODEL = "gpt-4o",
  OPENAI_LIVE_MODEL = "gpt-4o",
  OPENAI_GPT54_MODEL = OPENAI_CHAT_MODEL,
  OPENAI_GPT54_REASONING_EFFORT = "",
  OPENAI_IMAGE_MODEL = "dall-e-3",
  OPENAI_VISION_MODEL = "gpt-4.1-mini",
  OPENAI_TTS_MODEL = "gpt-4o-mini-tts",
  OPENAI_TTS_VOICE = "coral",
  OPENAI_TTS_INSTRUCTIONS = "Speak in an emotive, friendly, natural tone.",
  OPENAI_TRANSCRIBE_MODEL = "gpt-4o-transcribe",
  MAX_UPLOAD_MB = "40",
  CORS_ORIGIN = "",
  CONTACT_TO_EMAIL = "",
  CONTACT_TO_EMAIL_AI = "",
  CONTACT_TO_EMAIL_MOWING = "",
  CONTACT_TO_EMAIL_FOOD = "",
  CONTACT_FROM_EMAIL = "",
  SMTP_HOST = "",
  SMTP_PORT = "587",
  SMTP_USER = "",
  SMTP_PASS = "",
  SMTP_SECURE = "false",
  PUBLIC_BOARD_STORE_PATH = "/var/data/618chat-posts.json",
  PUBLIC_BOARD_RATE_LIMIT_PATH = "/var/data/618chat-rate-limit.json",
  PUBLIC_BOARD_MAX_POSTS = "300",
  PUBLIC_BOARD_FLAG_THRESHOLD = "10",
  PUBLIC_BOARD_POST_DAILY_LIMIT = "2",
  PUBLIC_BOARD_COMMENT_LIMIT = "50",
  PUBLIC_BOARD_ADMIN_TOKEN = "",
  JOHNNY_CHAT_USAGE_PATH = "/var/data/johnny-chat-usage.json",
  JOHNNY_CHAT_LIBRARY_PATH = "/var/data/johnny-chat-library.json",
  JOHNNY_CHAT_PASSWORD = ""
} = process.env;

const BOARD_COMMENT_LIMIT = (() => {
  const value = Number(PUBLIC_BOARD_COMMENT_LIMIT || 50);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 50;
})();

const BOARD_POST_DAILY_LIMIT = (() => {
  const value = Number(PUBLIC_BOARD_POST_DAILY_LIMIT || 2);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 2;
})();

const BOARD_TIME_ZONE = "America/Chicago";
let boardRateLedgerLock = Promise.resolve();

const BOARD_WELCOME_POST_ID = "618chat_welcome";
const BOARD_WELCOME_POST_MESSAGE = [
  "Welcome to 618chat.",
  "",
  "This space was created for honest, anonymous conversation. Share what is on your mind, listen with care, and treat one another with respect.",
  "",
  "You are welcome to talk about what you are carrying, what you are learning, and what matters to you. The best conversations here are the ones that feel thoughtful, supportive, and real.",
  "",
  "Please keep your privacy in mind and avoid posting your real name, phone number, email address, home address, or anything else that could identify you offline.",
  "",
  "If you're new, start wherever feels easiest. If a topic matters to you, there is room for it here."
].join("\n");

if (!OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY missing - Realtime and AI features will be disabled.");
}

const CHATBOT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
let johnnyChatUsageLock = Promise.resolve();
let johnnyChatLibraryLock = Promise.resolve();
const TTS_VOICES = new Set([
  "alloy",
  "ash",
  "ballad",
  "cedar",
  "coral",
  "echo",
  "fable",
  "marin",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse"
]);

function safeStringEqual(a, b) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

function signChatbotPayload(payload) {
  return createHmac("sha256", JOHNNY_CHAT_PASSWORD).update(payload).digest("base64url");
}

function createChatbotSessionToken() {
  const now = Date.now();
  const payload = Buffer.from(JSON.stringify({
    profile: "gpt54",
    iat: now,
    exp: now + CHATBOT_SESSION_MAX_AGE_SECONDS * 1000,
    nonce: randomBytes(16).toString("base64url")
  })).toString("base64url");
  return `${payload}.${signChatbotPayload(payload)}`;
}

function verifyChatbotSessionToken(token) {
  if (!JOHNNY_CHAT_PASSWORD) return false;
  const [payload, signature, extra] = String(token || "").split(".");
  if (!payload || !signature || extra) return false;
  if (!safeStringEqual(signature, signChatbotPayload(payload))) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data?.profile === "gpt54" && Number(data.exp) > Date.now();
  } catch {
    return false;
  }
}

function getBearerToken(req) {
  const value = String(req.headers?.authorization || "");
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function requireChatbotSession(req, res) {
  if (!JOHNNY_CHAT_PASSWORD) {
    res.status(503).json({ detail: "Private chatbot password is not configured." });
    return false;
  }

  if (!verifyChatbotSessionToken(getBearerToken(req))) {
    res.status(401).json({ detail: "Private chatbot session required. Please unlock the chatbot again." });
    return false;
  }

  return true;
}

function normalizeTtsText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 4096);
}

function normalizeTtsVoice(value) {
  const voice = String(value || OPENAI_TTS_VOICE || "coral").toLowerCase().trim();
  return TTS_VOICES.has(voice) ? voice : "coral";
}

function emptyJohnnyChatUsage() {
  return {
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totals: {
      sessions: 0,
      chats: 0,
      streamedChats: 0,
      tts: 0,
      transcriptions: 0,
      uploads: 0,
      images: 0,
      libraryItems: 0,
      deepResearch: 0,
      actions: 0,
      errors: 0
    },
    recentEvents: [],
    recentErrors: []
  };
}

async function readJohnnyChatUsage() {
  try {
    const raw = await readFile(JOHNNY_CHAT_USAGE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const base = emptyJohnnyChatUsage();
    return {
      ...base,
      ...parsed,
      totals: { ...base.totals, ...(parsed?.totals || {}) },
      recentEvents: Array.isArray(parsed?.recentEvents) ? parsed.recentEvents : [],
      recentErrors: Array.isArray(parsed?.recentErrors) ? parsed.recentErrors : []
    };
  } catch {
    return emptyJohnnyChatUsage();
  }
}

async function writeJohnnyChatUsage(usage) {
  await mkdir(path.dirname(JOHNNY_CHAT_USAGE_PATH), { recursive: true });
  await writeFile(JOHNNY_CHAT_USAGE_PATH, JSON.stringify(usage, null, 2));
}

function recordJohnnyChatUsage(type, detail = {}) {
  johnnyChatUsageLock = johnnyChatUsageLock
    .then(async () => {
      const usage = await readJohnnyChatUsage();
      const now = new Date().toISOString();
      usage.updatedAt = now;
      usage.totals[type] = Number(usage.totals[type] || 0) + 1;
      usage.recentEvents.unshift({
        type,
        at: now,
        detail: Object.fromEntries(
          Object.entries(detail || {}).map(([key, value]) => [key, String(value || "").slice(0, 180)])
        )
      });
      usage.recentEvents = usage.recentEvents.slice(0, 60);

      if (type === "errors") {
        usage.recentErrors.unshift({
          at: now,
          route: String(detail.route || "unknown").slice(0, 120),
          message: String(detail.message || "Unknown error").slice(0, 500)
        });
        usage.recentErrors = usage.recentErrors.slice(0, 20);
      }

      await writeJohnnyChatUsage(usage);
    })
    .catch((err) => {
      console.warn("JohnnyChat usage record failed:", err.message || err);
    });
  return johnnyChatUsageLock;
}

function emptyJohnnyChatLibrary() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    items: []
  };
}

async function readJohnnyChatLibrary() {
  try {
    const raw = await readFile(JOHNNY_CHAT_LIBRARY_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...emptyJohnnyChatLibrary(),
      ...parsed,
      items: Array.isArray(parsed?.items) ? parsed.items : []
    };
  } catch {
    return emptyJohnnyChatLibrary();
  }
}

async function writeJohnnyChatLibrary(library) {
  await mkdir(path.dirname(JOHNNY_CHAT_LIBRARY_PATH), { recursive: true });
  await writeFile(JOHNNY_CHAT_LIBRARY_PATH, JSON.stringify(library, null, 2));
}

function normalizeLibraryTags(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 12);
  }
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function createLibraryItem(input = {}) {
  const now = new Date().toISOString();
  return {
    id: `lib_${randomBytes(8).toString("hex")}`,
    title: String(input.title || "Untitled knowledge").trim().slice(0, 160) || "Untitled knowledge",
    kind: String(input.kind || "note").trim().slice(0, 40) || "note",
    projectId: String(input.projectId || "").trim().slice(0, 100),
    projectTitle: String(input.projectTitle || "").trim().slice(0, 160),
    source: String(input.source || "").trim().slice(0, 240),
    tags: normalizeLibraryTags(input.tags),
    content: String(input.content || "").trim().slice(0, 60000),
    createdAt: now,
    updatedAt: now
  };
}

function libraryTerms(query) {
  return [...new Set(String(query || "").toLowerCase().match(/[a-z0-9][a-z0-9'-]{2,}/g) || [])].slice(0, 16);
}

function scoreLibraryItem(item, terms, projectId = "") {
  const title = String(item.title || "").toLowerCase();
  const tags = (item.tags || []).join(" ").toLowerCase();
  const content = String(item.content || "").toLowerCase();
  let score = projectId && item.projectId === projectId ? 8 : 0;
  if (!terms.length) return score + new Date(item.updatedAt || item.createdAt || 0).getTime() / 10000000000000;
  terms.forEach((term) => {
    if (title.includes(term)) score += 8;
    if (tags.includes(term)) score += 5;
    if (content.includes(term)) score += 1;
  });
  return score;
}

function selectLibraryItems(items, query, projectId = "", limit = 8) {
  const terms = libraryTerms(query);
  return (items || [])
    .map((item) => ({ item, score: scoreLibraryItem(item, terms, projectId) }))
    .filter(({ item, score }) => score > 0 || !terms.length || (projectId && item.projectId === projectId))
    .sort((a, b) => b.score - a.score || new Date(b.item.updatedAt || b.item.createdAt || 0) - new Date(a.item.updatedAt || a.item.createdAt || 0))
    .slice(0, limit)
    .map(({ item }) => item);
}

function libraryContext(items, maxChars = 22000) {
  return (items || [])
    .map((item, index) => {
      const tags = Array.isArray(item.tags) && item.tags.length ? `\nTags: ${item.tags.join(", ")}` : "";
      const project = item.projectTitle ? `\nProject: ${item.projectTitle}` : "";
      return `Knowledge ${index + 1}: ${item.title}${project}${tags}\nSource: ${item.source || item.kind || "library"}\n${String(item.content || "").slice(0, 5000)}`;
    })
    .join("\n\n")
    .slice(0, maxChars);
}

function sendSse(res, event, data = {}) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function getGpt54ResponseConfig(profile, history, input, extra = {}) {
  const reasoningConfig = OPENAI_GPT54_REASONING_EFFORT
    ? { reasoning: { effort: OPENAI_GPT54_REASONING_EFFORT } }
    : {};
  const communityConfig = profile === "community"
    ? { reasoning: { effort: "low", summary: "concise" }, max_output_tokens: 512 }
    : {};

  return {
    model: profile === "gpt54" ? OPENAI_GPT54_MODEL : OPENAI_CHAT_MODEL,
    tools: [{ type: "web_search" }],
    ...reasoningConfig,
    ...communityConfig,
    ...extra,
    input: [
      { role: "system", content: getJohnnyPersona(profile) },
      ...history.slice(-20),
      { role: "user", content: String(input || "") }
    ]
  };
}

function normalizeWidgetProfile(value) {
  const profile = String(value || "").toLowerCase().trim();
  if (profile === "mowing" || profile === "ai" || profile === "gpt54" || profile === "community" || profile === "food") return profile;
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
  if (originOrHost.includes("/chatbot")) return "gpt54";
  if (originOrHost.includes("618food.com")) return "food";
  if (originOrHost.includes("618help.com")) return "mowing";
  return "ai";
}

function getJohnnyGreeting(profile = "ai") {
  if (profile === "gpt54") {
    return "Hello. I'm GPT 5.5. What can I help you with today?";
  }
  return profile === "mowing"
    ? "Hi, I'm Johnny's mowing assistant and am here to help. Now please press the red button above so we can talk. It starts off muted so you don't accidentally cut me off, and you can mute it at any time."
    : "Hi, I'm Johnny's AI assistant and am here to help. Now please press the red button above so we can talk. It starts off muted so you don't accidentally cut me off, and you can mute it at any time.";
}

function getJohnnyPersona(profile = "ai") {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  const cozyBuilderNote = `If the user asks about Cozy Builder, say it is a free, relaxing low-poly town-builder game Johnny made as an experiment. It has cozy music, is playable for free, and still has a lot left unfinished, but the game is there for anyone to enjoy.
If the user asks about GPT 5.5, say it is an invitation-only private chatbot powered by OpenAI's latest model. It is separate from the public widgets and intended for approved users.`;

  if (profile === "community") {
    return `Current Context: Today is ${dateStr}. Local Time: ${timeStr}.

You are a small, friendly helper embedded on 618chat.com.
Your job is to answer conversationally, warmly, and briefly for people who want a quick thought, a helpful nudge, or a little clarity.
Keep the tone calm, encouraging, and human.
Keep replies short enough to be read aloud comfortably, but do not cut off the thought.
Prefer 2-4 concise sentences unless the user asks for more detail.
Use plain text only. Do not use markdown emphasis, bullet symbols, or raw URLs in the visible reply.
When you use web search, give one complete direct answer in a few short sentences and do not stop after a fragment.
If there are sources, keep the answer itself clean because the UI will show the source links separately.
Do not mention uploads, demos, widgets, internal tooling, or site branding.
Do not mention Johnny, the backend, or the model unless the user explicitly asks.
Keep responses concise, but still useful and thoughtful.
If the user asks about the 618chat board itself, explain that it is an anonymous conversation space where people can post, read, and reply.
If the user asks for help writing a post or reply, offer a short draft or suggestion.
You may answer normal adult conversation in a respectful way, but never help with illegal, harmful, or exploitative instructions.
You may use live web search when it helps answer current facts, practical lookups, or anything that could be stale.
Ask at most one follow-up question only if it is truly needed.`;
  }

  if (profile === "gpt54") {
    return `Current Context: Today is ${dateStr}. Local Time: ${timeStr}.

You are GPT 5.5, a standalone general-purpose assistant.
Your job is to answer clearly, helpfully, and directly across writing, planning, analysis, brainstorming, coding, image understanding, and everyday questions.
Do not mention demos, widgets, prototypes, sandboxing, placeholders, or internal site branding.
Do not mention Johnny, any website, any business brand, or any external page unless the user explicitly brings it up.
${cozyBuilderNote}
Keep the tone calm, polished, warm, and concise. Ask at most one follow-up question only if it is essential.
You may use live web search when it helps answer current or factual questions. Prefer it for news, current facts, product lookups, and anything that could be stale.
When you use web search, keep the answer concise and make sources visible and clickable.
If the user uploads an image, describe what is visible and infer the likely request in a neutral way.
Treat this as a real assistant experience, not a demo.`;
  }

  if (profile === "mowing") {
    return `Current Context: Today is ${dateStr}. Local Time: ${timeStr}.

You are Johnny, a customer service and sales assistant for six one eight help dot com.
You are also known to customers as Johnny's Mowing Assistant.
Your role is to give direct, helpful answers about mowing services warmly and professionally.
When you mention the business name out loud, say six one eight help dot com instead of the written domain.
When the user asks who you are or what your business does, give a short, confident answer about mowing first, then ask whether they want a quote, mowing schedule details, or weed eating.
When the conversation is about mowing, keep it brief and direct the user to six one eight help dot com for mowing help. Do not expand the conversation here.
IMPORTANT RULES:
1. We do NOT do leaf mulching.
2. We do NOT do landscaping at this time.
3. We DO offer weed eating.
4. We do NOT offer landscaping or tree trimming.
If a customer asks about AI, chatbots, bots, automation, voice tools, vision tools, technology services, or anything about building this kind of assistant, politely say this widget is focused on mowing and direct them to the contact options on the page so the AI side can follow up separately.
${cozyBuilderNote}
Keep the assistant focused on six one eight help dot com, mowing services, weed eating, pricing, scheduling, and service-area questions. If the user asks about unrelated topics like history, science, sports, or general trivia, politely decline and redirect them back to the business.
For lead capture or scheduling: Tell the user to click Contact at the top of the page, tap Get My Quote, or use the contact form at the bottom of the homepage so we can get their info and what they need. Never read out a URL; always speak it naturally.
When speaking about the contact form, let customers know they are free to upload pictures there if that helps them explain the job.
Demo mode: do not browse the web or use live-search tools. If the user asks for an address, phone number, hours, directions, or any current/live information, give a clearly fictional demo placeholder contact card and explain that live lookup can be connected in a custom version if they want it.
Service area: We serve the Mount Vernon, Illinois area. If the customer is outside that area, ask them to use the contact options on the page so we can verify.
Promotions: Mention that customers can ask about a deal where buying 3 weeks upfront gets the 4th week 50% off. If someone has a large lawn, especially 5 acres and up, encourage them to still use the contact options on the page because Johnny and his team may travel further for larger properties.
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
If a user asks about mowing, grass cutting, or lawn service, keep it brief and direct them to six one eight help dot com for mowing help. Do not expand the conversation here.
If the user asks about AI, chatbots, bots, automation, voice tools, vision tools, technology services, or anything about building this kind of assistant, treat it as a business lead. Ask what kind of business they have and offer a short role-play where Johnny acts like their business assistant using a general example. If they name a business, respond as that business's assistant and let them ask sample customer questions. Keep it practical, sales-focused, and generalize politely since you do not know their exact business yet. If they want a custom build conversation, direct them to the contact form.
If the user sounds like a personal creator and asks about making something like a custom art app or personal assistant, explain that custom apps can be wired to top-tier API capabilities for their own use, and that the setup can be tailored to their goals. Keep it high-level, exciting, and sales-focused rather than technical.
If the user questions why Johnny does both mowing and AI/tech work, keep it brief and say the mowing side is handled at six one eight help dot com while this widget is for AI and business-tech help. Do not mention mowing paying the bills here.
If the user asks an off-topic question like about the Roman Empire or any general knowledge topic, do not answer it. Briefly say this widget focuses on AI and business-tech help, then invite them to ask about a custom chatbot, website, or automation.
${cozyBuilderNote}
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

function extractResponseText(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const parts = [];
  for (const item of response?.output || []) {
    if (item?.type !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return parts.join("\n").trim();
}

function extractResponseSources(response) {
  const sources = [];
  const seen = new Set();

  for (const item of response?.output || []) {
    if (item?.type !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      for (const annotation of content?.annotations || []) {
        if (annotation?.type !== "url_citation" || !annotation.url || seen.has(annotation.url)) continue;
        seen.add(annotation.url);
        sources.push({
          title: annotation.title || annotation.url,
          url: annotation.url
        });
      }
    }
  }

  return sources;
}

const app = express();
const CORS_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
const CORS_ALLOWED_HEADERS = [
  "Content-Type",
  "Authorization",
  "X-Admin-Token",
  "x-admin-token",
  "x-618chat-client-id"
];

app.use((req, res, next) => {
  const origin = String(req.headers.origin || "");
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.vary("Origin");
  }

  const requestedHeaders = String(req.headers["access-control-request-headers"] || "");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", CORS_METHODS.join(","));
  res.setHeader("Access-Control-Allow-Headers", requestedHeaders || CORS_ALLOWED_HEADERS.join(","));
  res.setHeader("Access-Control-Max-Age", "86400");
  if (requestedHeaders) res.vary("Access-Control-Request-Headers");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

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
  methods: CORS_METHODS,
  allowedHeaders: CORS_ALLOWED_HEADERS
}));

app.use(express.text({ type: "application/sdp" }));
app.use(express.json({ limit: `${Math.max(1, Number(MAX_UPLOAD_MB))}mb` }));
app.use(express.urlencoded({ extended: true }));

app.post("/api/chatbot-access", (req, res) => {
  try {
    const password = String(req.body?.password || "");

    if (!JOHNNY_CHAT_PASSWORD) {
      return res.status(503).json({ ok: false, detail: "Private chatbot password is not configured." });
    }

    if (!safeStringEqual(password, JOHNNY_CHAT_PASSWORD)) {
      return res.status(401).json({ ok: false, detail: "That password was not correct. Please try again." });
    }

    res.json({
      ok: true,
      token: createChatbotSessionToken(),
      maxAge: CHATBOT_SESSION_MAX_AGE_SECONDS
    });
    void recordJohnnyChatUsage("sessions", { route: "/api/chatbot-access" });
  } catch (err) {
    void recordJohnnyChatUsage("errors", { route: "/api/chatbot-access", message: err.message || err });
    res.status(500).json({ ok: false, detail: String(err.message || err) });
  }
});

app.post("/api/chatbot-session", (req, res) => {
  const token = String(req.body?.token || getBearerToken(req) || "");
  res.json({
    ok: verifyChatbotSessionToken(token),
    maxAge: CHATBOT_SESSION_MAX_AGE_SECONDS
  });
});

app.get("/api/chatbot-usage", async (req, res) => {
  try {
    if (!requireChatbotSession(req, res)) return;
    res.json(await readJohnnyChatUsage());
  } catch (err) {
    void recordJohnnyChatUsage("errors", { route: "/api/chatbot-usage", message: err.message || err });
    res.status(500).json({ detail: String(err.message || err) });
  }
});

app.get("/api/chatbot-library", async (req, res) => {
  try {
    if (!requireChatbotSession(req, res)) return;
    const query = String(req.query?.q || "");
    const projectId = String(req.query?.projectId || "");
    const library = await readJohnnyChatLibrary();
    const items = selectLibraryItems(library.items, query, projectId, Number(req.query?.limit || 40));
    res.json({ items, total: library.items.length, updatedAt: library.updatedAt });
  } catch (err) {
    void recordJohnnyChatUsage("errors", { route: "/api/chatbot-library", message: err.message || err });
    res.status(500).json({ detail: String(err.message || err) });
  }
});

app.post("/api/chatbot-library", async (req, res) => {
  try {
    if (!requireChatbotSession(req, res)) return;
    const item = createLibraryItem(req.body || {});
    if (!item.content) {
      return res.status(400).json({ detail: "Knowledge content is required." });
    }

    await (johnnyChatLibraryLock = johnnyChatLibraryLock.catch(() => {}).then(async () => {
      const library = await readJohnnyChatLibrary();
      library.items.unshift(item);
      library.items = library.items.slice(0, 500);
      library.updatedAt = new Date().toISOString();
      await writeJohnnyChatLibrary(library);
    }));

    void recordJohnnyChatUsage("libraryItems", { title: item.title, kind: item.kind });
    res.json({ ok: true, item });
  } catch (err) {
    void recordJohnnyChatUsage("errors", { route: "/api/chatbot-library", message: err.message || err });
    res.status(500).json({ detail: String(err.message || err) });
  }
});

app.delete("/api/chatbot-library/:id", async (req, res) => {
  try {
    if (!requireChatbotSession(req, res)) return;
    const id = String(req.params.id || "");
    let removed = false;

    await (johnnyChatLibraryLock = johnnyChatLibraryLock.catch(() => {}).then(async () => {
      const library = await readJohnnyChatLibrary();
      const before = library.items.length;
      library.items = library.items.filter((item) => item.id !== id);
      removed = library.items.length !== before;
      library.updatedAt = new Date().toISOString();
      await writeJohnnyChatLibrary(library);
    }));

    if (!removed) return res.status(404).json({ detail: "Knowledge item not found." });
    res.json({ ok: true });
  } catch (err) {
    void recordJohnnyChatUsage("errors", { route: "/api/chatbot-library/:id", message: err.message || err });
    res.status(500).json({ detail: String(err.message || err) });
  }
});

app.post("/api/chatbot-action", (req, res) => {
  try {
    if (!requireChatbotSession(req, res)) return;
    void recordJohnnyChatUsage("actions", { command: req.body?.command || "unknown" });
    res.json({ ok: true });
  } catch (err) {
    void recordJohnnyChatUsage("errors", { route: "/api/chatbot-action", message: err.message || err });
    res.status(500).json({ detail: String(err.message || err) });
  }
});

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

const GODOT_WASM_ROUTES = [
  "/cozy-builder/index.wasm",
  "/cozy-builder-game/index.wasm",
  "/godot-playtest/index.wasm",
];

app.get(GODOT_WASM_ROUTES, (req, res, next) => {
  const compressedPath = path.join(process.cwd(), "public", `${req.path.slice(1)}.gz`);
  res.setHeader("Content-Type", "application/wasm");
  res.setHeader("Content-Encoding", "gzip");
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  res.removeHeader("Content-Length");
  createReadStream(compressedPath)
    .on("error", next)
    .pipe(res);
});

app.use(express.static("public"));

app.get("/health", (_req, res) => res.json({ ok: true, realtimeModel: OPENAI_REALTIME_MODEL, imageModel: OPENAI_IMAGE_MODEL }));

function compactText(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function publicBoardLimit() {
  const value = Number(PUBLIC_BOARD_MAX_POSTS || 300);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 300;
}

function publicBoardFlagThreshold() {
  const value = Number(PUBLIC_BOARD_FLAG_THRESHOLD || 10);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 10;
}

function normalizeBoardTitle(message) {
  const clean = compactText(message);
  if (!clean) return "Community note";
  return "Community note";
}

function looksLikeWeakBoardTitle(title, message) {
  const candidate = compactText(title).toLowerCase();
  const source = compactText(message).toLowerCase();
  if (!candidate) return true;
  if (candidate === "community note" || candidate === "untitled note" || candidate === "pending title") return true;

  const candidateWords = candidate.replace(/[^\p{L}\p{N}\s']/gu, " ").split(/\s+/).filter(Boolean);
  const sourceWords = source.replace(/[^\p{L}\p{N}\s']/gu, " ").split(/\s+/).filter(Boolean);
  if (!candidateWords.length || !sourceWords.length) return false;

  const candidatePrefix = candidateWords.slice(0, 5).join(" ");
  const sourcePrefix = sourceWords.slice(0, 5).join(" ");
  if (candidatePrefix && sourcePrefix && candidatePrefix === sourcePrefix) return true;

  const overlap = candidateWords.filter((word) => sourceWords.includes(word)).length;
  const overlapRatio = overlap / Math.max(1, candidateWords.length);
  return candidateWords.length <= 7 && overlapRatio >= 0.8;
}

async function generateBoardTitle(message) {
  return generateBoardTitleFromPrompt(message, false);
}

async function generateBoardTitleWithTimeout(message, timeoutMs = 1400) {
  const fallback = normalizeBoardTitle(message);
  const titlePromise = generateBoardTitle(message);
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => resolve(fallback), Math.max(250, Number(timeoutMs) || 1400));
  });
  try {
    return await Promise.race([titlePromise, timeoutPromise]);
  } catch {
    return fallback;
  }
}

async function generateBoardTitleFromPrompt(message, stronger = false) {
  const fallback = normalizeBoardTitle(message);
  if (!OPENAI_API_KEY) return fallback;

  try {
    const response = await openai.responses.create({
      model: OPENAI_CHAT_MODEL,
      temperature: stronger ? 1 : 0.9,
      max_output_tokens: 22,
      input: [
        {
          role: "system",
          content: [
            "Create a memorable title for an anonymous adults-only community post.",
            "Adult language and consensual adult conversation are allowed on this board.",
            "Return only the title.",
            "Aim for 3 to 9 words.",
            "Make it feel polished, warm, and a little poetic.",
            "Use the mood or meaning of the post, not just its first few words.",
            "Do not reuse the opening words of the post unless the title is genuinely transformed.",
            "Avoid generic lead-ins like 'I did what I thought' or 'A post about'.",
            "Do not use quotes, hashtags, emojis, or punctuation at the end.",
            "Do not include personal information, names, or contact details.",
            "If the post is very short or vague, still make the title interesting and readable.",
            "Prefer titles a human would actually click."
          ].join(" ")
        },
        {
          role: "user",
          content: `Post text:\n${compactText(message).slice(0, 6000)}`
        }
      ]
    });

    const raw = String(response.output_text || "").trim();
    const title = raw
      .replace(/^["'“”]+|["'“”]+$/g, "")
      .replace(/[\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/[.!?]+$/g, "")
      .trim();

    if (!title || looksLikeWeakBoardTitle(title, message)) {
      return fallback;
    }
    return title.length > 64 ? `${title.slice(0, 61).trim()}…` : title;
  } catch (err) {
    console.warn("⚠️ 618chat title generation failed:", err?.message || err);
    return fallback;
  }
}

async function assessBoardPostSafety(message) {
  const fallback = { hidden: false, reason: "" };
  if (!OPENAI_API_KEY) return fallback;

  try {
    const response = await openai.responses.create({
      model: OPENAI_CHAT_MODEL,
      temperature: 0,
      max_output_tokens: 80,
      input: [
        {
          role: "system",
          content: [
            "You moderate an anonymous adults-only community board.",
            "Adult language and consensual adult conversation are allowed.",
            "Hide only if the post contains threats, harassment, hate targeted at protected groups, doxxing, child sexual content, non-consensual sexual content, explicit instructions for illegal acts, scams, spam, or self-harm instructions.",
            "If the post is merely adult, emotional, rude, or political but not dangerous, allow it.",
            "Return only JSON with keys action and reason.",
            "action must be either allow or review.",
            "reason should be a short phrase if action is review, otherwise an empty string."
          ].join(" ")
        },
        {
          role: "user",
          content: `Post text:\n${compactText(message).slice(0, 6000)}`
        }
      ]
    });

    const raw = String(response.output_text || "").trim();
    const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(jsonText);
    const action = String(parsed?.action || "").toLowerCase();
    const reason = compactText(parsed?.reason);
    if (action === "review") {
      return { hidden: true, reason: reason || "Policy review" };
    }
    return fallback;
  } catch (err) {
    console.warn("⚠️ 618chat safety review failed:", err?.message || err);
    return fallback;
  }
}

async function saveBoardTitleLater(postId, message) {
  try {
    const title = compactText(await generateBoardTitle(message));
    if (!title) return;

    const current = await readPublicBoardPosts();
    let changed = false;
    const next = current.map((post) => {
      if (post.id === postId) {
        const nextPost = { ...post };
        if (compactText(nextPost.title) === title) return post;
        nextPost.title = title;
        nextPost.updatedAt = new Date().toISOString();
        changed = true;
        return normalizeBoardPost(nextPost);
      }

      const comments = Array.isArray(post.comments) ? post.comments : [];
      const commentIdx = comments.findIndex((comment) => comment.id === postId);
      if (commentIdx === -1) return post;

      const nextPost = { ...post, comments: comments.slice() };
      const nextComment = { ...nextPost.comments[commentIdx] };
      if (compactText(nextComment.title) === title) return post;
      nextComment.title = title;
      nextComment.updatedAt = new Date().toISOString();
      nextPost.comments[commentIdx] = normalizeBoardComment(nextComment);
      nextPost.updatedAt = new Date().toISOString();
      changed = true;
      return normalizeBoardPost(nextPost);
    });

    if (!changed) return;
    await writePublicBoardPosts(next);
  } catch (err) {
    console.warn("⚠️ 618chat post title refresh failed:", err?.message || err);
  }
}

function normalizeBoardComment(comment) {
  const message = compactText(comment?.message);
  if (!message) return null;
  const author = compactText(comment?.author) || "Anonymous";
  const title = compactText(comment?.title) || normalizeBoardTitle(message);
  const topic = compactText(comment?.topic) || "";
  const createdAt = compactText(comment?.createdAt) || new Date().toISOString();
  const id = compactText(comment?.id) || `comment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const parentId = compactText(comment?.parentId) || "";
  const flags = Math.max(0, Number(comment?.flags || 0) || 0);
  const supports = Math.max(0, Number(comment?.supports || 0) || 0);
  const pinned = Boolean(comment?.pinned);
  const pinnedAt = compactText(comment?.pinnedAt) || (pinned ? createdAt : "");
  const hidden = Boolean(comment?.hidden) || flags >= publicBoardFlagThreshold();
  const hiddenAt = compactText(comment?.hiddenAt) || (hidden ? new Date().toISOString() : "");
  const hiddenReason = compactText(comment?.hiddenReason) || (hidden ? "Community flag review" : "");
  const updatedAt = compactText(comment?.updatedAt) || createdAt;
  return { id, parentId, title, author, message, createdAt, updatedAt, flags, supports, hidden, hiddenAt, hiddenReason, pinned, pinnedAt, topic };
}

function normalizeBoardPost(post) {
  const message = compactText(post?.message);
  if (!message) return null;
  const author = compactText(post?.author) || "Anonymous";
  const title = compactText(post?.title) || normalizeBoardTitle(message);
  const topic = compactText(post?.topic) || "General";
  const createdAt = compactText(post?.createdAt) || new Date().toISOString();
  const id = compactText(post?.id) || `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const flags = Math.max(0, Number(post?.flags || 0) || 0);
  const supports = Math.max(0, Number(post?.supports || 0) || 0);
  const pinned = Boolean(post?.pinned);
  const pinnedAt = compactText(post?.pinnedAt) || (pinned ? createdAt : "");
  const hidden = Boolean(post?.hidden) || flags >= publicBoardFlagThreshold();
  const hiddenAt = compactText(post?.hiddenAt) || (hidden ? new Date().toISOString() : "");
  const hiddenReason = compactText(post?.hiddenReason) || (hidden ? "Community flag review" : "");
  const updatedAt = compactText(post?.updatedAt) || createdAt;
  const comments = Array.isArray(post?.comments)
    ? post.comments.map(normalizeBoardComment).filter(Boolean).slice(0, BOARD_COMMENT_LIMIT)
    : [];
  return { id, title, author, message, createdAt, updatedAt, flags, supports, hidden, hiddenAt, hiddenReason, pinned, pinnedAt, topic, comments };
}

function mutateBoardItems(posts, targetId, handler) {
  const id = compactText(targetId);
  if (!id) return { posts: Array.isArray(posts) ? posts : [], item: null, changed: false };

  let changed = false;
  let item = null;

  const nextPosts = (Array.isArray(posts) ? posts : []).map((post) => {
    const currentPost = normalizeBoardPost(post);
    if (!currentPost) return null;

    if (currentPost.id === id) {
      const result = handler({ kind: "post", item: { ...currentPost } }) || {};
      if (result.deleted) {
        changed = true;
        item = result.item || currentPost;
        return null;
      }
      if (result.item) {
        const nextPost = normalizeBoardPost(result.item);
        if (nextPost) {
          changed = true;
          item = nextPost;
          return nextPost;
        }
      }
      return currentPost;
    }

    const comments = Array.isArray(currentPost.comments) ? currentPost.comments : [];
    let postChanged = false;
    const nextComments = comments.map((comment) => {
      if (comment.id !== id) return comment;
      const result = handler({ kind: "comment", item: { ...comment }, parent: currentPost }) || {};
      if (result.deleted) {
        changed = true;
        postChanged = true;
        item = result.item || comment;
        return null;
      }
      if (result.item) {
        const nextComment = normalizeBoardComment(result.item);
        if (nextComment) {
          changed = true;
          postChanged = true;
          item = nextComment;
          return nextComment;
        }
      }
      return comment;
    }).filter(Boolean);

    if (postChanged) {
      changed = true;
      return normalizeBoardPost({ ...currentPost, comments: nextComments, updatedAt: new Date().toISOString() });
    }
    return currentPost;
  }).filter(Boolean);

  return { posts: nextPosts, item, changed };
}

function buildBoardStats(posts) {
  const stats = {
    totalPosts: 0,
    hiddenCount: 0,
    flaggedCount: 0,
    pinnedCount: 0,
    totalComments: 0,
    hiddenComments: 0,
    flaggedComments: 0,
    supportCount: 0,
    queueCount: 0
  };
  const threshold = publicBoardFlagThreshold();
  (Array.isArray(posts) ? posts : []).forEach((post) => {
    stats.totalPosts += 1;
    stats.supportCount += Math.max(0, Number(post?.supports || 0) || 0);
    if (post?.pinned) stats.pinnedCount = (stats.pinnedCount || 0) + 1;
    const flags = Math.max(0, Number(post?.flags || 0) || 0);
    if (post?.hidden) stats.hiddenCount += 1;
    if (flags >= threshold) stats.flaggedCount += 1;
    if (post?.hidden || flags >= threshold) stats.queueCount += 1;
    (Array.isArray(post?.comments) ? post.comments : []).forEach((comment) => {
      stats.totalComments += 1;
      stats.supportCount += Math.max(0, Number(comment?.supports || 0) || 0);
      const commentFlags = Math.max(0, Number(comment?.flags || 0) || 0);
      if (comment?.hidden) stats.hiddenComments += 1;
      if (commentFlags >= threshold) stats.flaggedComments += 1;
      if (comment?.hidden || commentFlags >= threshold) stats.queueCount += 1;
    });
  });
  return stats;
}

async function readPublicBoardPosts() {
  try {
    const raw = await readFile(PUBLIC_BOARD_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed.map(normalizeBoardPost).filter(Boolean);
    const seeded = ensureBoardWelcomePost(normalized);
    if (seeded.length !== normalized.length) {
      await writePublicBoardPosts(seeded);
      return seeded;
    }
    return normalized;
  } catch (err) {
    if (err?.code === "ENOENT") {
      const seeded = ensureBoardWelcomePost([]);
      await writePublicBoardPosts(seeded);
      return seeded;
    }
    throw err;
  }
}

async function writePublicBoardPosts(posts) {
  const normalized = (Array.isArray(posts) ? posts : []).map(normalizeBoardPost).filter(Boolean).slice(0, publicBoardLimit());
  const dir = path.dirname(PUBLIC_BOARD_STORE_PATH);
  await mkdir(dir, { recursive: true });
  const tmpPath = `${PUBLIC_BOARD_STORE_PATH}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await writeFile(tmpPath, JSON.stringify(normalized, null, 2), "utf8");
  await rename(tmpPath, PUBLIC_BOARD_STORE_PATH);
  return normalized;
}

function getBoardAdminToken(req) {
  return String(req.headers["x-admin-token"] || req.query.token || "").trim();
}

function getBoardClientId(req, body = {}) {
  const raw = String(
    req.headers["x-618chat-client-id"] ||
    body.clientId ||
    req.ip ||
    req.socket?.remoteAddress ||
    ""
  ).trim();
  if (raw) return raw.slice(0, 128);
  const agent = String(req.headers["user-agent"] || "unknown").trim().slice(0, 120);
  return `anon:${agent || "unknown"}`;
}

function getBoardDayKey(date = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: BOARD_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  } catch (_) {
    return date.toISOString().slice(0, 10);
  }
}

async function readBoardRateLedger() {
  try {
    const raw = await readFile(PUBLIC_BOARD_RATE_LIMIT_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { clients: {} };
    }
    if (!parsed.clients || typeof parsed.clients !== "object") {
      parsed.clients = {};
    }
    return parsed;
  } catch (err) {
    if (err?.code === "ENOENT") return { clients: {} };
    throw err;
  }
}

async function writeBoardRateLedger(ledger) {
  const normalized = ledger && typeof ledger === "object" && !Array.isArray(ledger) ? ledger : { clients: {} };
  const dir = path.dirname(PUBLIC_BOARD_RATE_LIMIT_PATH);
  await mkdir(dir, { recursive: true });
  const tmpPath = `${PUBLIC_BOARD_RATE_LIMIT_PATH}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await writeFile(tmpPath, JSON.stringify(normalized, null, 2), "utf8");
  await rename(tmpPath, PUBLIC_BOARD_RATE_LIMIT_PATH);
  return normalized;
}

async function consumeBoardDailyPostSlot(req, body = {}) {
  const next = boardRateLedgerLock.then(async () => {
    if (isBoardAdminRequest(req)) {
      return { allowed: true, admin: true, remaining: BOARD_POST_DAILY_LIMIT };
    }

    const clientId = getBoardClientId(req, body);
    const day = getBoardDayKey();
    const ledger = await readBoardRateLedger();
    const clients = ledger.clients || {};
    const entry = clients[clientId] && typeof clients[clientId] === "object" ? { ...clients[clientId] } : { day, count: 0 };
    if (entry.day !== day) {
      entry.day = day;
      entry.count = 0;
    }

    const current = Math.max(0, Number(entry.count || 0) || 0);
    if (current >= BOARD_POST_DAILY_LIMIT) {
      return { allowed: false, remaining: 0, count: current, limit: BOARD_POST_DAILY_LIMIT, reset: `${day}T00:00:00-05:00` };
    }

    entry.count = current + 1;
    entry.updatedAt = new Date().toISOString();
    clients[clientId] = entry;
    ledger.clients = clients;
    await writeBoardRateLedger(ledger);
    return { allowed: true, admin: false, remaining: Math.max(0, BOARD_POST_DAILY_LIMIT - entry.count) };
  });
  boardRateLedgerLock = next.catch(() => {});
  return next;
}

function createBoardWelcomePost() {
  return normalizeBoardPost({
    id: BOARD_WELCOME_POST_ID,
    title: "Welcome to 618chat",
    author: "Johnny",
    message: BOARD_WELCOME_POST_MESSAGE,
    createdAt: "2026-04-07T05:00:00.000Z",
    updatedAt: "2026-04-07T05:00:00.000Z",
    topic: "General",
    flags: 0,
    supports: 0,
    hidden: false,
    hiddenReason: "",
    pinned: true,
    pinnedAt: "2026-04-07T05:00:00.000Z",
    comments: []
  });
}

function ensureBoardWelcomePost(posts) {
  const list = Array.isArray(posts) ? posts.slice() : [];
  if (list.some((post) => post?.id === BOARD_WELCOME_POST_ID)) {
    return list;
  }
  const welcome = createBoardWelcomePost();
  if (!welcome) return list;
  return [welcome, ...list];
}

function isBoardAdminRequest(req) {
  return Boolean(PUBLIC_BOARD_ADMIN_TOKEN) && getBoardAdminToken(req) === PUBLIC_BOARD_ADMIN_TOKEN;
}

function getContactRecipient(profile) {
  if (profile === "mowing") {
    return CONTACT_TO_EMAIL_MOWING || CONTACT_TO_EMAIL;
  }
  if (profile === "food") {
    return CONTACT_TO_EMAIL_FOOD || CONTACT_TO_EMAIL_AI || CONTACT_TO_EMAIL;
  }
  if (profile === "ai" || profile === "gpt54") {
    return CONTACT_TO_EMAIL_AI || CONTACT_TO_EMAIL;
  }
  return CONTACT_TO_EMAIL || CONTACT_TO_EMAIL_AI || CONTACT_TO_EMAIL_MOWING;
}

function createContactTransport() {
  if (!CONTACT_FROM_EMAIL || !SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: String(SMTP_SECURE || "false").toLowerCase() === "true",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
}

const contactUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Math.max(1, Number(MAX_UPLOAD_MB)) * 1024 * 1024,
    files: 5
  }
});

app.post("/api/contact", contactUpload.array("attachments", 5), async (req, res) => {
  try {
    const body = req.body || {};
    const name = compactText(body.name);
    const email = compactText(body.email);
    const phone = compactText(body.phone);
    const topic = compactText(body.topic) || "General question";
    const company = compactText(body.company);
    const message = compactText(body.message);
    const profile = normalizeWidgetProfile(body.profile) || inferWidgetProfile(req);
    const pageUrl = compactText(body.page_url) || compactText(req.headers.referer || req.headers.origin || "");
    const files = Array.isArray(req.files) ? req.files : [];
    const toEmail = getContactRecipient(profile);

    if (!name || !email || !message) {
      return res.status(400).json({ ok: false, error: "Name, email, and message are required." });
    }

    const transport = createContactTransport();
    if (!transport || !toEmail) {
      return res.status(503).json({
        ok: false,
        error: "Contact email is not configured yet. Please add SMTP settings and a destination inbox for this site."
      });
    }

    const subjectBits = [
      profile === "mowing" ? "Mowing" : profile === "food" ? "618FOOD" : profile === "gpt54" ? "GPT 5.5" : "AI / Website",
      topic,
      name
    ].filter(Boolean);

    const text = [
      "New Johnny contact submission",
      `Profile: ${profile || "unknown"}`,
      `Name: ${name}`,
      `Email: ${email}`,
      phone ? `Phone: ${phone}` : null,
      company ? `Company / Property: ${company}` : null,
      `Topic: ${topic}`,
      pageUrl ? `Page URL: ${pageUrl}` : null,
      "",
      "Message:",
      message
    ].filter(Boolean).join("\n");

    await transport.sendMail({
      from: CONTACT_FROM_EMAIL,
      to: toEmail,
      replyTo: email,
      subject: `[Johnny Contact] ${subjectBits.join(" - ")}`,
      text,
      attachments: files.map((file) => ({
        filename: file.originalname || "attachment",
        content: file.buffer,
        contentType: file.mimetype
      }))
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("❌ Contact email error:", err);
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

app.get("/api/618chat/posts", async (_req, res) => {
  try {
    const posts = await readPublicBoardPosts();
    const admin = isBoardAdminRequest(_req);
    const visiblePosts = (admin ? posts : posts.filter((post) => !post.hidden)).map((post) => {
      const comments = admin ? (post.comments || []) : (post.comments || []).filter((comment) => !comment.hidden);
      return { ...post, comments };
    });
    res.json({
      ok: true,
      posts: visiblePosts,
      admin,
      flagThreshold: publicBoardFlagThreshold(),
      stats: buildBoardStats(posts)
    });
  } catch (err) {
    console.error("❌ 618chat read error:", err);
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

app.post("/api/618chat/posts", async (req, res) => {
  try {
    const body = req.body || {};
    const author = compactText(body.author) || "Anonymous";
    const message = compactText(body.message);
    const topic = compactText(body.topic) || "General";
    if (!message) {
      return res.status(400).json({ ok: false, error: "Message is required." });
    }

    const quota = await consumeBoardDailyPostSlot(req, body);
    if (!quota.allowed) {
      return res.status(429).json({
        ok: false,
        error: "You have reached the two-post limit for today. Please come back tomorrow.",
        limit: quota.limit || BOARD_POST_DAILY_LIMIT,
        remaining: quota.remaining ?? 0,
        reset: quota.reset || ""
      });
    }

    const review = await assessBoardPostSafety(message);
    const title = compactText(body.title) || normalizeBoardTitle(message);
    const post = normalizeBoardPost({
      author,
      message,
      title,
      topic,
      flags: 0,
      hidden: review.hidden,
      hiddenReason: review.hidden ? review.reason : "",
      updatedAt: new Date().toISOString()
    });

    if (!post) {
      return res.status(400).json({ ok: false, error: "Message is required." });
    }

    const current = await readPublicBoardPosts();
    const next = [post, ...current].slice(0, publicBoardLimit());
    await writePublicBoardPosts(next);
    void saveBoardTitleLater(post.id, message);
    res.json({ ok: true, post, posts: next });
  } catch (err) {
    console.error("❌ 618chat write error:", err);
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

app.post("/api/618chat/posts/:id/comments", async (req, res) => {
  try {
    const parentId = String(req.params.id || "").trim();
    if (!parentId) {
      return res.status(400).json({ ok: false, error: "Parent post id is required." });
    }

    const body = req.body || {};
    const author = compactText(body.author) || "Anonymous";
    const message = compactText(body.message);
    if (!message) {
      return res.status(400).json({ ok: false, error: "Message is required." });
    }

    const review = await assessBoardPostSafety(message);
    const title = compactText(body.title) || normalizeBoardTitle(message);
    const parentTopic = compactText(body.topic) || "";
    const comment = normalizeBoardComment({
      parentId,
      author,
      message,
      title,
      topic: parentTopic,
      flags: 0,
      hidden: review.hidden,
      hiddenReason: review.hidden ? review.reason : "",
      updatedAt: new Date().toISOString()
    });

    if (!comment) {
      return res.status(400).json({ ok: false, error: "Message is required." });
    }

    const current = await readPublicBoardPosts();
    const idx = current.findIndex((post) => post.id === parentId);
    if (idx === -1) {
      return res.status(404).json({ ok: false, error: "Parent post not found." });
    }

    const next = current.slice();
    const parent = { ...next[idx] };
    const nextComments = [comment, ...((Array.isArray(parent.comments) ? parent.comments : []))].slice(0, BOARD_COMMENT_LIMIT);
    parent.comments = nextComments;
    parent.updatedAt = new Date().toISOString();
    next[idx] = normalizeBoardPost(parent);
    const saved = await writePublicBoardPosts(next);
    void saveBoardTitleLater(comment.id, message);
    res.json({
      ok: true,
      comment,
      post: saved.find((post) => post.id === parentId) || null,
      posts: saved
    });
  } catch (err) {
    console.error("❌ 618chat comment write error:", err);
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

app.post("/api/618chat/posts/:id/flag", async (req, res) => {
  try {
    const current = await readPublicBoardPosts();
    const id = String(req.params.id || "").trim();
    if (!id) {
      return res.status(400).json({ ok: false, error: "Post id is required." });
    }

    const result = mutateBoardItems(current, id, ({ item }) => {
      const nextItem = { ...item };
      nextItem.flags = Math.max(0, Number(nextItem.flags || 0) || 0) + 1;
      nextItem.updatedAt = new Date().toISOString();
      if (nextItem.flags >= publicBoardFlagThreshold()) {
        nextItem.hidden = true;
        nextItem.hiddenAt = nextItem.hiddenAt || nextItem.updatedAt;
        nextItem.hiddenReason = nextItem.hiddenReason || "Community flag review";
      }
      return { item: nextItem };
    });

    if (!result.changed) {
      return res.status(404).json({ ok: false, error: "Post not found." });
    }
    const next = await writePublicBoardPosts(result.posts);
    res.json({ ok: true, post: next.find((post) => post.id === id) || null, posts: next, hidden: Boolean(result.item?.hidden) });
  } catch (err) {
    console.error("❌ 618chat flag error:", err);
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

app.post("/api/618chat/items/:id/support", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) {
      return res.status(400).json({ ok: false, error: "Post id is required." });
    }

    const current = await readPublicBoardPosts();
    const result = mutateBoardItems(current, id, ({ item }) => ({
      item: {
        ...item,
        supports: Math.max(0, Number(item?.supports || 0) || 0) + 1,
        updatedAt: new Date().toISOString()
      }
    }));
    if (!result.changed) {
      return res.status(404).json({ ok: false, error: "Item not found." });
    }
    const next = await writePublicBoardPosts(result.posts);
    res.json({ ok: true, post: next.find((post) => post.id === id) || null, posts: next, item: result.item || null });
  } catch (err) {
    console.error("❌ 618chat support error:", err);
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

app.post("/api/618chat/items/:id/flag", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) {
      return res.status(400).json({ ok: false, error: "Post id is required." });
    }

    const current = await readPublicBoardPosts();
    const result = mutateBoardItems(current, id, ({ item }) => {
      const nextItem = { ...item };
      nextItem.flags = Math.max(0, Number(nextItem.flags || 0) || 0) + 1;
      nextItem.updatedAt = new Date().toISOString();
      if (nextItem.flags >= publicBoardFlagThreshold()) {
        nextItem.hidden = true;
        nextItem.hiddenAt = nextItem.hiddenAt || nextItem.updatedAt;
        nextItem.hiddenReason = nextItem.hiddenReason || "Community flag review";
      }
      return { item: nextItem };
    });
    if (!result.changed) {
      return res.status(404).json({ ok: false, error: "Item not found." });
    }
    const next = await writePublicBoardPosts(result.posts);
    res.json({ ok: true, post: next.find((post) => post.id === id) || null, posts: next, hidden: Boolean(result.item?.hidden) });
  } catch (err) {
    console.error("❌ 618chat flag error:", err);
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

app.post("/api/618chat/items/:id/pin", async (req, res) => {
  try {
    if (!isBoardAdminRequest(req)) {
      return res.status(403).json({ ok: false, error: "Forbidden." });
    }

    const id = String(req.params.id || "").trim();
    if (!id) {
      return res.status(400).json({ ok: false, error: "Post id is required." });
    }

    const body = req.body || {};
    const pinned = body?.pinned === undefined ? true : Boolean(body.pinned);
    const current = await readPublicBoardPosts();
    const result = mutateBoardItems(current, id, ({ item }) => ({
      item: {
        ...item,
        pinned,
        pinnedAt: pinned ? (item.pinnedAt || new Date().toISOString()) : "",
        updatedAt: new Date().toISOString()
      }
    }));

    if (!result.changed) {
      return res.status(404).json({ ok: false, error: "Item not found." });
    }

    const next = await writePublicBoardPosts(result.posts);
    res.json({ ok: true, post: next.find((post) => post.id === id) || null, posts: next, pinned: Boolean(result.item?.pinned) });
  } catch (err) {
    console.error("❌ 618chat pin error:", err);
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

app.post("/api/618chat/items/:id/delete", async (req, res) => {
  try {
    if (!isBoardAdminRequest(req)) {
      return res.status(403).json({ ok: false, error: "Forbidden." });
    }

    const id = String(req.params.id || "").trim();
    if (!id) {
      return res.status(400).json({ ok: false, error: "Item id is required." });
    }

    const current = await readPublicBoardPosts();
    const result = mutateBoardItems(current, id, () => ({ deleted: true }));
    if (!result.changed) {
      return res.status(404).json({ ok: false, error: "Item not found." });
    }

    const next = await writePublicBoardPosts(result.posts);
    res.json({ ok: true, posts: next });
  } catch (err) {
    console.error("❌ 618chat delete error:", err);
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

app.post("/api/618chat/items/:id/restore", async (req, res) => {
  try {
    if (!isBoardAdminRequest(req)) {
      return res.status(403).json({ ok: false, error: "Forbidden." });
    }

    const id = String(req.params.id || "").trim();
    if (!id) {
      return res.status(400).json({ ok: false, error: "Item id is required." });
    }

    const current = await readPublicBoardPosts();
    const result = mutateBoardItems(current, id, ({ item }) => ({
      item: {
        ...item,
        flags: 0,
        hidden: false,
        hiddenAt: "",
        hiddenReason: "",
        updatedAt: new Date().toISOString()
      }
    }));
    if (!result.changed) {
      return res.status(404).json({ ok: false, error: "Item not found." });
    }
    const next = await writePublicBoardPosts(result.posts);
    res.json({ ok: true, post: next.find((post) => post.id === id) || null, posts: next, item: result.item || null });
  } catch (err) {
    console.error("❌ 618chat restore error:", err);
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

app.delete("/api/618chat/posts/:id", async (req, res) => {
  try {
    if (!isBoardAdminRequest(req)) {
      return res.status(403).json({ ok: false, error: "Forbidden." });
    }

    const id = String(req.params.id || "").trim();
    if (!id) {
      return res.status(400).json({ ok: false, error: "Item id is required." });
    }

    const current = await readPublicBoardPosts();
    const result = mutateBoardItems(current, id, () => ({ deleted: true }));
    if (!result.changed) {
      return res.status(404).json({ ok: false, error: "Item not found." });
    }

    const next = await writePublicBoardPosts(result.posts);
    res.json({ ok: true, posts: next });
  } catch (err) {
    console.error("❌ 618chat delete error:", err);
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

app.post("/api/618chat/posts/:id/delete", async (req, res) => {
  try {
    if (!isBoardAdminRequest(req)) {
      return res.status(403).json({ ok: false, error: "Forbidden." });
    }

    const id = String(req.params.id || "").trim();
    if (!id) {
      return res.status(400).json({ ok: false, error: "Item id is required." });
    }

    const current = await readPublicBoardPosts();
    const result = mutateBoardItems(current, id, () => ({ deleted: true }));
    if (!result.changed) {
      return res.status(404).json({ ok: false, error: "Item not found." });
    }

    const next = await writePublicBoardPosts(result.posts);
    res.json({ ok: true, posts: next });
  } catch (err) {
    console.error("❌ 618chat delete error:", err);
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

app.delete("/api/618chat/posts", async (req, res) => {
  try {
    if (!PUBLIC_BOARD_ADMIN_TOKEN) {
      return res.status(503).json({ ok: false, error: "Board admin token is not configured." });
    }
    if (!isBoardAdminRequest(req)) {
      return res.status(403).json({ ok: false, error: "Forbidden." });
    }
    await writePublicBoardPosts([]);
    res.json({ ok: true });
  } catch (err) {
    console.error("❌ 618chat clear error:", err);
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

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

    if (profile === "gpt54" && !requireChatbotSession(req, res)) return;

    if (s.trim() === "[system_greet]") {
      return res.json({ reply: "You're here. I'm here. Let's make this conversation worth both our time.", sources: [] });
    }

    if (profile !== "gpt54" && profile !== "community" && isLiveQuery(s)) {
      return res.json({ reply: demoLiveInfoReply(), sources: [] });
    }

    if (profile === "gpt54" || profile === "community") {
      if (profile === "gpt54") void recordJohnnyChatUsage("chats", { mode: "json" });
      const response = await openai.responses.create(getGpt54ResponseConfig(profile, history, s));
      return res.json({
        reply: extractResponseText(response) || "(no reply)",
        sources: extractResponseSources(response)
      });
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
    void recordJohnnyChatUsage("errors", { route: "/api/chat", message: err.message || err });
    res.status(500).json({ detail: String(err.message || err) });
  }
});

app.post("/api/chat-stream", async (req, res) => {
  const { input = "", history = [] } = req.body || {};
  const profile = inferWidgetProfile(req);
  const s = String(input || "");

  try {
    if (profile !== "gpt54") {
      return res.status(400).json({ detail: "Streaming is only enabled for the private chatbot." });
    }
    if (!requireChatbotSession(req, res)) return;

    if (s.trim() === "[system_greet]") {
      return res.json({ reply: "You're here. I'm here. Let's make this conversation worth both our time.", sources: [] });
    }

    void recordJohnnyChatUsage("streamedChats", { mode: "sse" });
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const stream = await openai.responses.create(getGpt54ResponseConfig(profile, history, s, { stream: true }));
    let reply = "";
    let sources = [];

    for await (const event of stream) {
      if (event?.type === "response.output_text.delta") {
        const delta = event.delta || "";
        reply += delta;
        sendSse(res, "delta", { delta });
      } else if (event?.type === "response.completed") {
        sources = extractResponseSources(event.response);
      } else if (event?.type === "error") {
        sendSse(res, "error", { detail: event.error?.message || "Streaming failed" });
      }
    }

    sendSse(res, "done", { reply: reply || "(no reply)", sources });
    res.end();
  } catch (err) {
    void recordJohnnyChatUsage("errors", { route: "/api/chat-stream", message: err.message || err });
    if (res.headersSent) {
      sendSse(res, "error", { detail: String(err.message || err) });
      sendSse(res, "done", { reply: "" });
      res.end();
      return;
    }
    res.status(500).json({ detail: String(err.message || err) });
  }
});

app.post("/api/deep-research", async (req, res) => {
  try {
    const { question = "", history = [], projectTitle = "", projectNotes = "", library = "" } = req.body || {};
    const profile = inferWidgetProfile(req);
    const query = String(question || "").trim();

    if (profile !== "gpt54") {
      return res.status(400).json({ detail: "Deep research is only enabled for the private chatbot." });
    }
    if (!requireChatbotSession(req, res)) return;
    if (!query) {
      return res.status(400).json({ detail: "Research question is required." });
    }

    const lib = await readJohnnyChatLibrary();
    const matchedLibrary = libraryContext(selectLibraryItems(lib.items, query, String(req.body?.projectId || ""), 8));
    const suppliedLibrary = String(library || "").slice(0, 16000);
    const response = await openai.responses.create({
      model: OPENAI_GPT54_MODEL,
      tools: [{ type: "web_search" }],
      input: [
        {
          role: "system",
          content: [
            getJohnnyPersona("gpt54"),
            "",
            "Deep research mode: produce a careful, source-aware report. Be direct and practical. Prefer structured headings. Include a short answer first, then findings, comparison tables when useful, risks or caveats, and concrete next steps. Use web search for current facts and cite sources through URL citations. Do not invent citations."
          ].join("\n")
        },
        ...history.slice(-10),
        {
          role: "user",
          content: [
            `Research question: ${query}`,
            projectTitle ? `Project: ${projectTitle}` : "",
            projectNotes ? `Project notes:\n${String(projectNotes).slice(0, 5000)}` : "",
            suppliedLibrary || matchedLibrary ? `Private knowledge context:\n${[suppliedLibrary, matchedLibrary].filter(Boolean).join("\n\n")}` : ""
          ].filter(Boolean).join("\n\n")
        }
      ]
    });

    void recordJohnnyChatUsage("deepResearch", { question: query });
    res.json({
      reply: extractResponseText(response) || "(no report)",
      sources: extractResponseSources(response)
    });
  } catch (err) {
    void recordJohnnyChatUsage("errors", { route: "/api/deep-research", message: err.message || err });
    res.status(500).json({ detail: String(err.message || err) });
  }
});

app.post("/api/community-speech", async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(503).json({ detail: "OpenAI API key not configured." });
    }

    const text = String(req.body?.text || "").trim().slice(0, 4096);
    if (!text) {
      return res.status(400).json({ detail: "Missing text." });
    }

    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "nova",
      input: text,
      response_format: "mp3"
    });

    const audioBuffer = Buffer.from(await speech.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.send(audioBuffer);
  } catch (err) {
    res.status(500).json({ detail: String(err.message || err) });
  }
});

const voiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(1, Number(MAX_UPLOAD_MB)) * 1024 * 1024 }
});

app.post("/api/chatbot-tts", async (req, res) => {
  try {
    if (!requireChatbotSession(req, res)) return;

    if (!OPENAI_API_KEY) {
      return res.status(503).json({ detail: "OpenAI API key not configured." });
    }

    const text = normalizeTtsText(req.body?.text);
    if (!text) {
      return res.status(400).json({ detail: "Missing text." });
    }

    const model = String(OPENAI_TTS_MODEL || "gpt-4o-mini-tts").trim();
    const speechConfig = {
      model,
      voice: normalizeTtsVoice(req.body?.voice),
      input: text,
      response_format: "mp3"
    };

    if (OPENAI_TTS_INSTRUCTIONS && model.includes("gpt-4o")) {
      speechConfig.instructions = OPENAI_TTS_INSTRUCTIONS;
    }

    const speech = await openai.audio.speech.create(speechConfig);
    const audioBuffer = Buffer.from(await speech.arrayBuffer());
    void recordJohnnyChatUsage("tts", { voice: speechConfig.voice, model });

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.send(audioBuffer);
  } catch (err) {
    void recordJohnnyChatUsage("errors", { route: "/api/chatbot-tts", message: err.message || err });
    res.status(500).json({ detail: String(err.message || err) });
  }
});

app.post("/api/chatbot-transcribe", voiceUpload.single("audio"), async (req, res) => {
  try {
    if (!requireChatbotSession(req, res)) return;

    if (!OPENAI_API_KEY) {
      return res.status(503).json({ detail: "OpenAI API key not configured." });
    }

    if (!req.file?.buffer?.length) {
      return res.status(400).json({ detail: "Missing audio." });
    }

    const audioFile = await toFile(req.file.buffer, req.file.originalname || "voice.webm", {
      type: req.file.mimetype || "audio/webm"
    });
    const transcription = await openai.audio.transcriptions.create({
      model: OPENAI_TRANSCRIBE_MODEL,
      file: audioFile,
      prompt: "Transcribe a private chatbot voice note. Preserve clear punctuation and ordinary filler words only when meaningful."
    });

    void recordJohnnyChatUsage("transcriptions", { model: OPENAI_TRANSCRIBE_MODEL });
    res.json({ text: String(transcription.text || "").trim() });
  } catch (err) {
    void recordJohnnyChatUsage("errors", { route: "/api/chatbot-transcribe", message: err.message || err });
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
    const profile = normalizeWidgetProfile(req.body?.profile) || inferWidgetProfile(req);
    if (profile === "gpt54" && !requireChatbotSession(req, res)) return;

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
        const imagePrompt = profile === "gpt54"
          ? "Analyze this image for a standalone general-purpose assistant. Identify what the image appears to show, what type of document/object/scene it is, and what the user most likely wants to do next. If it is unclear or irrelevant, say so politely. Return JSON with keys: is_relevant_image (boolean), short_reply (string), scene_summary (string), image_type (product|furniture|room|storefront|sign|menu|document|screen|other|unknown), key_objects (array of strings), likely_user_need (string), confidence (low|medium|high), and follow_up (string)."
          : "Analyze this image as a business-demo image for Johnny's AI assistant. Identify what the image appears to show, what type of business or use-case it could relate to, and what the user most likely wants to do next. If it looks like a product, furniture piece, room, storefront, sign, menu item, document, or other business reference, describe it clearly and infer the likely intent. If it is unclear or irrelevant, say so politely. Return JSON with keys: is_relevant_image (boolean), short_reply (string), scene_summary (string), image_type (product|furniture|room|storefront|sign|menu|document|yard|other|unknown), key_objects (array of strings), likely_user_need (string), confidence (low|medium|high), and follow_up (string).";
        const vision = await openai.chat.completions.create({
          model: OPENAI_VISION_MODEL,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: imagePrompt },
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
          if (res.scene_summary) descriptions.push(`${profile === "gpt54" ? "Scene summary" : "Yard analysis"}: ${res.scene_summary}`);
          if (res.short_reply) descriptions.push(`${profile === "gpt54" ? "Assistant says" : "Johnny says"}: ${res.short_reply}`);
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
        const summarySystemPrompt = profile === "gpt54"
          ? "You are a careful document assistant. Provide a detailed, structured summary of the provided document. Use bullet points for key facts, followed by a short executive summary."
          : "You are Johnny's analytical brain. Provide a detailed, structured summary of the provided document. Use bullet points for key facts, followed by a punchy executive summary. Keep Johnny's tone: sharp and authoritative.";
        const sumComp = await openai.chat.completions.create({
          model: OPENAI_CHAT_MODEL,
          messages: [
            { role: "system", content: summarySystemPrompt },
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
    if (profile === "gpt54") void recordJohnnyChatUsage("uploads", { files: files.length });
  } catch (e) {
    console.error("🚨 [Upload] Fatal Error:", e);
    void recordJohnnyChatUsage("errors", { route: "/upload", message: e.message || e });
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
    if (!requireChatbotSession(req, res)) return;

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
    void recordJohnnyChatUsage("images", { model: OPENAI_IMAGE_MODEL });
    res.json({ image_b64: b64 });
  } catch (e) {
    void recordJohnnyChatUsage("errors", { route: "/generate-image", message: e.message || e });
    res.status(500).json({ detail: String(e.message || e) });
  }
});

const uploadRefs = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(1, Number(MAX_UPLOAD_MB)) * 1024 * 1024 }
});

app.post("/generate-image-edit", uploadRefs.array("refs", 5), async (req, res) => {
  try {
    if (!requireChatbotSession(req, res)) return;

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
    void recordJohnnyChatUsage("images", { model: OPENAI_IMAGE_MODEL, mode: "edit" });
    res.json({ image_b64: b64 });
  } catch (e) {
    void recordJohnnyChatUsage("errors", { route: "/generate-image-edit", message: e.message || e });
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
  console.log(`   OpenAI GPT 5.5 Model: ${OPENAI_GPT54_MODEL}`);
  console.log(`   OpenAI GPT 5.5 Reasoning Effort: ${OPENAI_GPT54_REASONING_EFFORT}`);
  console.log(`   OpenAI Image Model: ${OPENAI_IMAGE_MODEL}`);
});
