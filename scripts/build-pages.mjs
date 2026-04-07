import { access, readFile, writeFile, mkdir, rm, cp, readdir } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

const root = process.cwd();
const publicDir = path.join(root, "public");
const cozyExportSourceDir = path.resolve(root, "..", "public", "godot-playtest");
const cozyExportTargetDirs = [
  path.join(publicDir, "cozy-builder"),
  path.join(publicDir, "cozy-builder-game"),
];

const widgetSnippet = (profile) => `
  <script>
    window.JOHNNY_WIDGET_PROFILE = "${profile}";
  </script>
  <link rel="stylesheet" href="https://johnny-chat.onrender.com/voice-widget.css">
  <script src="https://johnny-chat.onrender.com/voice-widget.js"></script>`;

const sharedNavStyles = `
  <style>
    .johnny-site-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin: 0 0 18px;
      padding: 14px 18px;
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.82);
      border: 1px solid rgba(16, 32, 21, 0.08);
      box-shadow: 0 18px 40px rgba(24, 61, 34, 0.08);
      backdrop-filter: blur(12px);
      position: sticky;
      top: 14px;
      z-index: 20;
    }

    .johnny-site-brand {
      color: #102015;
      font-family: "Outfit", Arial, sans-serif;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.03em;
      text-decoration: none;
      white-space: nowrap;
    }

    .johnny-site-links {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
    }

    .johnny-site-link {
      display: inline-flex;
      align-items: center;
      min-height: 36px;
      padding: 0 14px;
      border-radius: 999px;
      color: #102015;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      border: 1px solid transparent;
      transition: background 180ms ease, border-color 180ms ease, transform 180ms ease;
    }

    .johnny-site-link:hover {
      transform: translateY(-1px);
      border-color: rgba(16, 32, 21, 0.08);
      background: rgba(255, 255, 255, 0.88);
    }

    .johnny-site-link.active {
      background: linear-gradient(135deg, rgba(45, 111, 64, 0.14), rgba(75, 141, 92, 0.14));
      border-color: rgba(45, 111, 64, 0.18);
      color: #184526;
    }

    @media (max-width: 760px) {
      .johnny-site-nav {
        flex-direction: column;
        align-items: flex-start;
      }

      .johnny-site-links {
        justify-content: flex-start;
      }
    }
  </style>`;

function insertBeforeHeadEnd(html, snippet) {
  if (html.includes(snippet.trim())) return html;
  const lower = html.toLowerCase();
  const idx = lower.lastIndexOf("</head>");
  if (idx === -1) return `${html}\n${snippet}\n`;
  return `${html.slice(0, idx)}${snippet}\n${html.slice(idx)}`;
}

function insertAfterBodyOpen(html, snippet) {
  if (html.includes(snippet.trim())) return html;
  const match = html.match(/<body[^>]*>/i);
  if (!match || typeof match.index !== "number") return `${snippet}\n${html}`;
  const idx = match.index + match[0].length;
  return `${html.slice(0, idx)}${snippet}\n${html.slice(idx)}`;
}

function insertBeforeBodyEnd(html, snippet) {
  if (html.includes("voice-widget.js")) return html;
  const lower = html.toLowerCase();
  const idx = lower.lastIndexOf("</body>");
  if (idx === -1) return `${html}\n${snippet}\n`;
  return `${html.slice(0, idx)}${snippet}\n${html.slice(idx)}`;
}

function siteNav(profile, active, brandOverride = "") {
  const brand = brandOverride || (profile === "mowing" ? "618help.com" : "justaskjohnny.com");
  const homeHref = profile === "mowing" ? "https://618help.com" : "https://justaskjohnny.com";
  const gptHref = "/chatbot/";
  const cozyHref = "/cozy-builder-game/";
  const contactHref = "/contact/";
  return `
  <header class="johnny-site-nav">
    <a class="johnny-site-brand" href="${homeHref}">${brand}</a>
    <nav class="johnny-site-links" aria-label="Site">
      <a class="johnny-site-link ${active === "home" ? "active" : ""}" href="${homeHref}">Home</a>
      <a class="johnny-site-link ${active === "gpt" ? "active" : ""}" href="${gptHref}">GPT 5.4</a>
      <a class="johnny-site-link ${active === "cozy" ? "active" : ""}" href="${cozyHref}" target="_blank" rel="noopener noreferrer">Cozy Builder</a>
      <a class="johnny-site-link ${active === "contact" ? "active" : ""}" href="${contactHref}">Contact</a>
    </nav>
  </header>`;
}

function chatSiteNav(active) {
  return `
  <header class="johnny-site-nav">
    <a class="johnny-site-brand" href="/" aria-label="618chat.com home">618chat.com</a>
    <nav class="johnny-site-links" aria-label="Site">
      <a class="johnny-site-link ${active === "home" ? "active" : ""}" href="/">Home</a>
      <a class="johnny-site-link" href="#compose">Write a post</a>
      <a class="johnny-site-link" href="#recent-posts">Recent conversations</a>
      <a class="johnny-site-link" href="#about">About</a>
    </nav>
  </header>`;
}

function create618ChatPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>618chat.com</title>
  <meta name="description" content="An anonymous conversation space for 618chat.com. Share what is on your mind, keep your privacy, and read respectful public posts.">
  ${sharedNavStyles}
  <style>
    :root {
      --bg: #f4f6ed;
      --bg-2: #e8efde;
      --ink: #102015;
      --copy: #5b6b60;
      --line: rgba(16, 32, 21, 0.1);
      --green: #2d6f40;
      --green-2: #4f8f5f;
      --green-deep: #174425;
      --card: rgba(255, 255, 255, 0.86);
      --shadow: 0 28px 74px rgba(22, 54, 31, 0.12);
    }

    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      color: var(--ink);
      font-family: "Plus Jakarta Sans", Arial, sans-serif;
      background:
        radial-gradient(circle at 10% 0%, rgba(122, 176, 106, 0.2), transparent 26%),
        radial-gradient(circle at 100% 10%, rgba(199, 166, 95, 0.12), transparent 24%),
        linear-gradient(180deg, #f8f8f0 0%, var(--bg-2) 42%, var(--bg) 100%);
      min-height: 100vh;
      overflow-x: hidden;
    }
    a { color: inherit; text-decoration: none; }
    button, input, textarea { font: inherit; }
    .page {
      width: min(1600px, calc(100vw - 12px));
      margin: 0 auto;
      padding: 12px 0 32px;
    }
    body.gate-locked {
      overflow: hidden;
    }
    .age-gate {
      position: fixed;
      inset: 0;
      z-index: 60;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(245, 248, 238, 0.82);
      backdrop-filter: blur(18px);
    }
    .age-gate[hidden] { display: none; }
    .age-gate-panel {
      width: min(660px, 100%);
      padding: 28px;
      border-radius: 30px;
      background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(247,250,241,0.94));
      border: 1px solid rgba(16, 32, 21, 0.08);
      box-shadow: 0 30px 80px rgba(22, 54, 31, 0.18);
    }
    .age-gate-panel h2 {
      margin: 14px 0 0;
      font-family: "Outfit", Arial, sans-serif;
      font-size: clamp(28px, 4vw, 42px);
      line-height: 1;
      letter-spacing: -0.05em;
    }
    .age-gate-panel p {
      margin: 14px 0 0;
      color: var(--copy);
      line-height: 1.8;
      font-size: 16px;
    }
    .age-gate-note {
      margin-top: 14px;
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(45, 111, 64, 0.08);
      border: 1px solid rgba(45, 111, 64, 0.14);
      color: var(--green-deep);
      line-height: 1.7;
      font-size: 15px;
    }
    .age-gate-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 18px;
    }
    .button-danger {
      background: linear-gradient(135deg, #8f2d2d 0%, #c04a4a 100%);
      color: #fffdf7;
      box-shadow: 0 14px 28px rgba(143, 45, 45, 0.22);
    }
    .intro {
      margin-top: 14px;
      display: grid;
      grid-template-columns: minmax(0, 0.95fr) minmax(420px, 1.25fr);
      gap: 12px;
      align-items: stretch;
    }
    .panel {
      background: linear-gradient(180deg, rgba(255,255,255,0.86), rgba(249,250,244,0.8));
      border: 1px solid var(--line);
      box-shadow: var(--shadow);
      backdrop-filter: blur(18px);
      border-radius: 28px;
    }
    .hero { padding: 30px; }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(45, 111, 64, 0.08);
      border: 1px solid rgba(45, 111, 64, 0.12);
      color: var(--green-deep);
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-size: 12px;
      font-weight: 800;
    }
    .eyebrow::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--green);
      box-shadow: 0 0 0 6px rgba(45, 111, 64, 0.12);
    }
    .hero h1 {
      margin: 16px 0 0;
      font-family: "Outfit", Arial, sans-serif;
      font-size: clamp(44px, 6.4vw, 84px);
      line-height: 0.9;
      letter-spacing: -0.06em;
      max-width: 10ch;
    }
    .hero p {
      margin: 16px 0 0;
      color: var(--copy);
      line-height: 1.8;
      font-size: 16px;
      max-width: 58ch;
    }
    .pill-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 18px;
    }
    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 18px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 38px;
      padding: 0 14px;
      border-radius: 999px;
      border: 1px solid rgba(16, 32, 21, 0.08);
      background: rgba(255, 255, 255, 0.88);
      color: var(--copy);
      font-size: 14px;
      font-weight: 700;
    }
    .pill strong { color: var(--green-deep); }
    .meta-card {
      padding: 20px;
      margin-top: 14px;
      border-radius: 22px;
      background: rgba(255,255,255,0.82);
      border: 1px solid rgba(16,32,21,0.08);
      box-shadow: 0 16px 34px rgba(17, 38, 22, 0.08);
    }
    .meta-card h2 {
      margin: 0 0 8px;
      font-family: "Outfit", Arial, sans-serif;
      font-size: 22px;
      letter-spacing: -0.03em;
    }
    .meta-card p,
    .meta-card li {
      color: var(--copy);
      line-height: 1.75;
      font-size: 15px;
    }
    .meta-card ul { margin: 10px 0 0; padding-left: 18px; }
    .board { padding: 24px; }
    .board-top {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 12px;
    }
    .board-top h2, .board-top h3 {
      margin: 0;
      font-family: "Outfit", Arial, sans-serif;
      letter-spacing: -0.04em;
      line-height: 1;
    }
    .board-top h2 { font-size: 30px; }
    .board-top h3 { font-size: 24px; }
    .board-top p {
      margin: 10px 0 0;
      color: var(--copy);
      line-height: 1.7;
    }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 48px;
      padding: 0 16px;
      border: 1px solid transparent;
      border-radius: 999px;
      background: rgba(255,255,255,0.9);
      color: var(--ink);
      font-weight: 800;
      cursor: pointer;
      transition: transform 180ms ease, filter 180ms ease, box-shadow 180ms ease;
    }
    .button:hover { transform: translateY(-1px); }
    .button-primary {
      background: linear-gradient(135deg, var(--green) 0%, var(--green-2) 100%);
      color: #fffdf7;
      box-shadow: 0 14px 28px rgba(47, 122, 68, 0.24);
    }
    .button-secondary {
      background: rgba(255,255,255,0.84);
      border-color: rgba(16,32,21,0.08);
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
      gap: 14px;
      margin-top: 14px;
    }
    .composer, .reader, .list {
      border-radius: 22px;
      background: rgba(255,255,255,0.82);
      border: 1px solid rgba(16,32,21,0.08);
      box-shadow: 0 16px 34px rgba(17, 38, 22, 0.08);
    }
    .composer, .reader, .list { padding: 18px; }
    .composer h3, .reader h3, .list h3 {
      margin: 0;
      font-family: "Outfit", Arial, sans-serif;
      font-size: 22px;
      letter-spacing: -0.03em;
    }
    .composer p, .reader p, .list p {
      color: var(--copy);
      line-height: 1.7;
    }
    .field { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
    label {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #365041;
    }
    input, textarea {
      width: 100%;
      border: 1px solid rgba(16, 32, 21, 0.12);
      border-radius: 18px;
      background: rgba(255,255,255,0.92);
      color: var(--ink);
      padding: 14px 16px;
      outline: none;
      transition: border-color 160ms ease, box-shadow 160ms ease;
    }
    textarea {
      min-height: 160px;
      resize: vertical;
    }
    input:focus, textarea:focus {
      border-color: rgba(45, 111, 64, 0.55);
      box-shadow: 0 0 0 4px rgba(45, 111, 64, 0.12);
    }
    .form-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      margin-top: 14px;
    }
    .reply-banner {
      display: none;
      margin: 0 0 12px;
      padding: 12px 14px;
      border-radius: 16px;
      background: rgba(45, 111, 64, 0.08);
      border: 1px solid rgba(45, 111, 64, 0.16);
      color: var(--green-deep);
      font-size: 14px;
      line-height: 1.6;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .reply-banner strong { font-weight: 800; }
    .reply-banner .reply-clear {
      border: 0;
      background: rgba(255,255,255,0.85);
      color: var(--green-deep);
      border-radius: 999px;
      padding: 6px 10px;
      font-weight: 800;
      cursor: pointer;
    }
    .reply-banner.show { display: flex; }
    .hint { font-size: 14px; color: var(--copy); line-height: 1.6; }
    .posts {
      display: grid;
      gap: 10px;
      margin-top: 12px;
    }
    .post-card {
      position: relative;
      overflow: hidden;
      border: 1px solid rgba(16, 32, 21, 0.08);
      border-radius: 18px;
      background: rgba(255,255,255,0.9);
      box-shadow: 0 0 0 rgba(0,0,0,0);
      transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
    }
    .post-card:hover {
      transform: translateY(-1px);
      border-color: rgba(45, 111, 64, 0.34);
      box-shadow: 0 10px 24px rgba(17, 38, 22, 0.08);
    }
    .post-card.active {
      border-color: rgba(45, 111, 64, 0.44);
      background: linear-gradient(180deg, rgba(245, 250, 244, 0.96), rgba(235, 244, 231, 0.92));
    }
    .post-open {
      width: 100%;
      border: 0;
      background: transparent;
      padding: 14px 16px;
      text-align: left;
      cursor: pointer;
      color: inherit;
    }
    .post-title {
      font-family: "Outfit", Arial, sans-serif;
      font-size: 18px;
      line-height: 1.1;
      letter-spacing: -0.03em;
      margin: 0 0 6px;
    }
    .post-meta {
      font-size: 13px;
      color: var(--copy);
    }
    .post-excerpt {
      margin-top: 8px;
      color: var(--copy);
      line-height: 1.6;
      font-size: 14px;
    }
    .board-toolbar {
      display: grid;
      grid-template-columns: minmax(0, 1.3fr) minmax(300px, 0.7fr);
      gap: 12px;
      margin-top: 14px;
      padding: 14px;
      border-radius: 18px;
      border: 1px solid rgba(16, 32, 21, 0.08);
      background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,251,245,0.94));
    }
    .toolbar-field {
      display: grid;
      gap: 8px;
    }
    .toolbar-field label {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(34, 58, 42, 0.68);
    }
    .toolbar-field input,
    .toolbar-field select {
      width: 100%;
      border: 1px solid rgba(16, 32, 21, 0.12);
      border-radius: 14px;
      background: rgba(255,255,255,0.96);
      padding: 12px 14px;
      color: var(--ink);
      font: inherit;
      outline: none;
    }
    .toolbar-field input:focus,
    .toolbar-field select:focus {
      border-color: rgba(45, 111, 64, 0.38);
      box-shadow: 0 0 0 4px rgba(45, 111, 64, 0.08);
    }
    .toolbar-row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .board-summary {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-top: 12px;
      color: var(--copy);
      font-size: 13px;
    }
    .moderation-panel {
      margin-top: 14px;
      padding: 16px;
      border-radius: 18px;
      border: 1px solid rgba(176, 56, 45, 0.14);
      background: linear-gradient(180deg, rgba(255, 248, 246, 0.96), rgba(250, 242, 239, 0.94));
      display: grid;
      gap: 12px;
    }
    .moderation-panel[hidden] {
      display: none;
    }
    .moderation-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }
    .moderation-head h4 {
      margin: 0;
      font-family: "Outfit", Arial, sans-serif;
      letter-spacing: -0.03em;
      font-size: 20px;
    }
    .moderation-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .moderation-queue {
      display: grid;
      gap: 10px;
    }
    .moderation-item {
      display: grid;
      gap: 8px;
      padding: 14px;
      border-radius: 16px;
      border: 1px solid rgba(176, 56, 45, 0.12);
      background: rgba(255,255,255,0.9);
      box-shadow: 0 8px 20px rgba(17, 38, 22, 0.04);
    }
    .moderation-item-top {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      flex-wrap: wrap;
    }
    .moderation-item h5 {
      margin: 0;
      font-family: "Outfit", Arial, sans-serif;
      letter-spacing: -0.03em;
      font-size: 16px;
    }
    .moderation-item p {
      margin: 0;
      color: var(--copy);
      line-height: 1.55;
      font-size: 14px;
    }
    .moderation-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .comment-list {
      margin-top: 22px;
      display: grid;
      gap: 10px;
      padding-left: 16px;
      border-left: 2px solid rgba(45, 111, 64, 0.18);
    }
    .comment-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;
    }
    .comment-heading h4 {
      margin: 0;
      font-family: "Outfit", Arial, sans-serif;
      font-size: 22px;
      letter-spacing: -0.03em;
    }
    .comment-card {
      position: relative;
      border: 1px solid rgba(16, 32, 21, 0.08);
      border-left: 4px solid rgba(45, 111, 64, 0.36);
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(245,250,243,0.94));
      overflow: hidden;
      box-shadow: 0 8px 18px rgba(17, 38, 22, 0.04);
      transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
    }
    .comment-card:hover {
      transform: translateY(-1px);
      border-color: rgba(45, 111, 64, 0.22);
      box-shadow: 0 12px 24px rgba(17, 38, 22, 0.08);
    }
    .comment-card[open] {
      border-color: rgba(45, 111, 64, 0.24);
      box-shadow: 0 12px 24px rgba(17, 38, 22, 0.08);
    }
    .comment-card summary {
      list-style: none;
      cursor: pointer;
      padding: 14px 16px;
      display: grid;
      gap: 4px;
    }
    .comment-card summary::-webkit-details-marker { display: none; }
    .comment-card-title {
      font-family: "Outfit", Arial, sans-serif;
      font-size: 17px;
      line-height: 1.2;
      letter-spacing: -0.03em;
    }
    .comment-card-meta {
      color: var(--copy);
      font-size: 13px;
    }
    .comment-card-meta-author,
    .comment-card-meta-date {
      display: inline;
    }
    .comment-card .detail-body {
      margin: 0 14px 14px 18px;
      min-height: 0;
      font-size: 14px;
      border-radius: 14px;
      background: rgba(255,255,255,0.9);
    }
    .comment-card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 0 14px 14px 18px;
      color: var(--copy);
      font-size: 13px;
    }
    .comment-card-footer .actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .comment-card summary::before {
      content: "";
      position: absolute;
      left: -10px;
      top: 18px;
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: #2d6f40;
      box-shadow: 0 0 0 6px rgba(45, 111, 64, 0.12);
    }
    .comment-card-mobile-note {
      display: none;
      margin-top: 6px;
      color: var(--copy);
      font-size: 12px;
    }
    .post-card-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-top: 8px;
      color: var(--copy);
      font-size: 13px;
    }
    .post-actions {
      position: absolute;
      top: 10px;
      right: 10px;
      display: flex;
      gap: 6px;
      z-index: 2;
    }
    .mini-action {
      min-height: 36px;
      min-width: 36px;
      padding: 0 10px;
      border-radius: 14px;
      border: 1px solid rgba(16, 32, 21, 0.08);
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(245, 248, 242, 0.9));
      color: var(--ink);
      font-size: 15px;
      font-weight: 900;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(10px);
      box-shadow: 0 10px 18px rgba(17, 38, 22, 0.06);
      transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease;
    }
    .mini-action:hover {
      transform: translateY(-1px);
      box-shadow: 0 14px 24px rgba(17, 38, 22, 0.1);
    }
    .mini-action:active {
      transform: translateY(0);
    }
    .mini-action.supported,
    .mini-action[data-action="support"],
    .mini-action[data-reader-action="support"],
    .mini-action[data-comment-action="support"] {
      background: linear-gradient(180deg, rgba(255, 239, 244, 0.98), rgba(255, 229, 236, 0.92));
      border-color: rgba(157, 24, 53, 0.16);
      color: #9d1835;
    }
    .mini-action[data-action="reply"] {
      background: linear-gradient(180deg, rgba(233, 246, 239, 0.98), rgba(225, 241, 231, 0.92));
      border-color: rgba(45, 111, 64, 0.14);
      color: var(--green-deep);
    }
    .mini-action[data-action="restore"],
    .mini-action[data-reader-action="restore"],
    .mini-action[data-comment-action="restore"] {
      background: linear-gradient(180deg, rgba(233, 246, 239, 0.98), rgba(225, 241, 231, 0.92));
      border-color: rgba(45, 111, 64, 0.14);
      color: var(--green-deep);
    }
    .mini-action[data-action="flag"],
    .mini-action[data-comment-action="flag"] {
      background: linear-gradient(180deg, rgba(255, 247, 225, 0.98), rgba(248, 237, 204, 0.92));
      border-color: rgba(158, 114, 19, 0.16);
      color: #8b650d;
    }
    .mini-action.flagged {
      background: rgba(45, 111, 64, 0.09);
      border-color: rgba(45, 111, 64, 0.18);
      color: var(--green-deep);
    }
    .mini-action.danger {
      background: linear-gradient(180deg, rgba(255, 237, 237, 0.98), rgba(247, 224, 224, 0.92));
      border-color: rgba(155, 28, 28, 0.18);
      color: #9b1c1c;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 26px;
      padding: 0 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      background: rgba(45, 111, 64, 0.08);
      color: var(--green-deep);
    }
    .status-badge.review {
      background: rgba(155, 28, 28, 0.08);
      color: #9b1c1c;
      border: 1px solid rgba(155, 28, 28, 0.16);
    }
    .detail-title {
      margin: 0;
      font-family: "Outfit", Arial, sans-serif;
      font-size: 34px;
      line-height: 1;
      letter-spacing: -0.04em;
    }
    .detail-meta { margin-top: 10px; color: var(--copy); font-size: 14px; }
    .detail-body {
      margin-top: 16px;
      padding: 18px;
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(255,255,255,0.94), rgba(247,249,243,0.94));
      border: 1px solid rgba(16, 32, 21, 0.08);
      white-space: pre-wrap;
      line-height: 1.75;
      color: var(--ink);
      min-height: 220px;
    }
    .empty-state {
      padding: 20px;
      border-radius: 18px;
      background: rgba(255,255,255,0.86);
      border: 1px dashed rgba(45, 111, 64, 0.22);
      color: var(--copy);
      line-height: 1.75;
    }
    .status {
      min-height: 1.4em;
      font-size: 14px;
      color: var(--green-deep);
    }
    .status.error { color: #9b1c1c; }
    @media (max-width: 1020px) {
      .intro, .layout { grid-template-columns: 1fr; }
    }
    @media (max-width: 760px) {
      .page { width: min(100vw - 10px, 1600px); padding: 12px 0 24px; }
      .hero, .board { padding: 20px; }
      .detail-title { font-size: 28px; }
      .hero h1 { max-width: none; }
      .comment-list {
        padding-left: 10px;
        gap: 7px;
      }
      .comment-heading h4 {
        font-size: 20px;
      }
      .comment-card summary {
        padding: 9px 12px;
        gap: 2px;
      }
      .comment-card-title {
        font-size: 16px;
        line-height: 1.15;
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .comment-card-meta {
        font-size: 11px;
        line-height: 1.35;
        opacity: 0.9;
      }
      .comment-card-meta-date {
        display: none;
      }
      .comment-card .detail-body {
        margin: 0 9px 10px 11px;
        padding: 11px 13px;
        font-size: 12px;
        line-height: 1.6;
        border-radius: 12px;
      }
      .comment-card-mobile-note {
        display: none;
      }
      .board-toolbar {
        grid-template-columns: 1fr;
        gap: 10px;
      }
      .toolbar-row {
        grid-template-columns: 1fr 1fr;
      }
      .board-summary {
        flex-direction: column;
        align-items: flex-start;
      }
      .moderation-actions {
        gap: 6px;
      }
      .comment-card summary::before {
        top: 15px;
        left: -7px;
        width: 7px;
        height: 7px;
        box-shadow: 0 0 0 4px rgba(45, 111, 64, 0.1);
      }
      .post-actions {
        top: 8px;
        right: 8px;
        gap: 6px;
      }
      .mini-action {
        min-height: 28px;
        min-width: 28px;
        padding: 0 8px;
        font-size: 12px;
      }
    }
  </style>
</head>
<body>
  <div class="age-gate" id="age-gate" hidden>
    <div class="age-gate-panel" role="dialog" aria-modal="true" aria-labelledby="age-gate-title">
      <span class="eyebrow">18+ only</span>
      <h2 id="age-gate-title">Before you enter 618chat</h2>
      <p>
        This space is for adults who want honest, anonymous conversation. Please be thoughtful, respectful, and keep your privacy in mind.
      </p>
      <div class="age-gate-note">
        Please do not share your real name, phone number, email address, home address, or anything else that could identify you offline.
      </div>
      <div class="age-gate-actions">
        <button class="button button-primary" id="age-gate-enter" type="button">Yes, enter site</button>
        <button class="button button-danger" id="age-gate-leave" type="button">No, leave</button>
      </div>
    </div>
  </div>
${chatSiteNav("home")}
  <main class="page">
    <section class="intro">
      <div class="panel hero">
        <span class="eyebrow">Anonymous conversation</span>
        <h1>Speak honestly. Read with care. Keep it respectful.</h1>
        <p>
          This space was created for honest, anonymous conversation. Sometimes the easiest way to open up is without the usual barriers, expectations, or pressure of everyday life.
          Here, people can talk about what they are feeling, share what is weighing on them, and connect with others in a real and meaningful way.
        </p>
        <div class="pill-row">
          <div class="pill"><strong>Anonymous</strong> by design</div>
          <div class="pill"><strong>Respect</strong> and understanding</div>
          <div class="pill"><strong>Public</strong> to browse</div>
          <div class="pill"><strong>Thoughtful</strong> titles</div>
        </div>
        <div class="hero-actions">
          <a class="button button-primary" href="#compose">Write a post</a>
          <a class="button button-secondary" href="#recent-posts">Read conversations</a>
          <button class="button button-secondary" id="moderation-toggle" type="button" title="Enter the moderator secret to unlock admin controls">Moderate</button>
        </div>
        <div class="meta-card" id="about">
          <h2>What this space is for</h2>
          <ul>
            <li>Honest, anonymous conversation without the usual pressure.</li>
            <li>Positivity, respect, and understanding in every post.</li>
            <li>Please avoid posting personal information like your real name, phone number, email address, home address, or anything else that could identify you offline.</li>
          </ul>
        </div>
      </div>

      <div class="panel board">
        <div class="board-top">
          <div>
            <h2>Post a message</h2>
            <p>Write something short or long. We’ll give it a title and add it to the conversation board.</p>
          </div>
          <div class="board-summary">
            <span class="status-badge">Live updates</span>
            <span id="board-summary-text">Watching for new posts.</span>
          </div>
        </div>
        <div class="board-toolbar" aria-label="Search and filter conversations">
          <div class="toolbar-field">
            <label for="post-search">Search conversations</label>
            <input id="post-search" type="search" placeholder="Search title, author, message, replies, or date">
          </div>
          <div class="toolbar-row">
            <div class="toolbar-field">
              <label for="time-filter">Date range</label>
              <select id="time-filter">
                <option value="all">All time</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="365">Last year</option>
              </select>
            </div>
            <div class="toolbar-field">
              <label for="sort-filter">Sort by</label>
              <select id="sort-filter">
                <option value="newest">Newest first</option>
                <option value="supported">Most supported</option>
                <option value="flagged">Most flagged</option>
              </select>
            </div>
          </div>
        </div>
        <div class="layout">
          <section class="composer" aria-label="New post" id="compose">
            <h3>New post</h3>
            <p>Keep it honest and respectful. Your post will get a thoughtful title when you share it.</p>
            <form id="board-form">
              <div id="reply-banner" class="reply-banner" hidden>
                <div>Replying to <strong id="reply-target-label">this post</strong>.</div>
                <button class="reply-clear" id="reply-clear" type="button">Cancel reply</button>
              </div>
              <div class="field">
                <label for="author">Name</label>
                <input id="author" name="author" autocomplete="name" placeholder="Anonymous">
              </div>
              <div class="field">
                <label for="message">Message</label>
                <textarea id="message" name="message" required placeholder="Share what is on your mind..."></textarea>
              </div>
              <div class="form-actions">
                <button class="button button-primary" type="submit">Share post</button>
              </div>
              <div class="status" id="board-status" aria-live="polite"></div>
              <div class="hint">Please avoid sharing personal information such as your real name, phone number, email address, home address, or anything that could identify you offline.</div>
            </form>
          </section>

          <section class="reader" aria-label="Selected post">
            <h3>Read a post</h3>
            <p>Click any card on the left to open the full message here.</p>
            <div id="post-reader" class="empty-state">No posts yet. Add the first message on the left and it will appear here.</div>
            <div id="comment-list" class="comment-list" hidden></div>
          </section>
        </div>
        <div id="moderation-panel" class="moderation-panel" hidden></div>

        <div class="list" style="margin-top: 14px;" id="recent-posts">
          <div class="board-top" style="align-items: center;">
            <div>
              <h3>Recent conversations</h3>
              <p>The newest message appears first. Select a post to read it in full.</p>
            </div>
            <div class="board-summary">
              <span id="results-count" class="status-badge">0 shown</span>
            </div>
          </div>
          <div id="posts" class="posts"></div>
        </div>
      </div>
    </section>
  </main>

  <script>
    (function () {
      const apiBase = String(window.JOHNNY_PUBLIC_BOARD_API_BASE_URL || "https://johnny-chat.onrender.com").replace(/\\/+$/, "");
      const postsUrl = apiBase + "/api/618chat/posts";
      const itemsUrl = apiBase + "/api/618chat/items";
      const ageGateKey = "618chat_age_gate_accepted";
      const adminTokenKey = "618chat_admin_token";
      const flaggedKey = "618chat_flagged_posts";
      const ageGate = document.getElementById("age-gate");
      const ageGateEnter = document.getElementById("age-gate-enter");
      const ageGateLeave = document.getElementById("age-gate-leave");
      const authorInput = document.getElementById("author");
      const messageInput = document.getElementById("message");
      const form = document.getElementById("board-form");
      const postsEl = document.getElementById("posts");
      const readerEl = document.getElementById("post-reader");
      const commentListEl = document.getElementById("comment-list");
      const statusEl = document.getElementById("board-status");
      const summaryTextEl = document.getElementById("board-summary-text");
      const moderationPanelEl = document.getElementById("moderation-panel");
      const postSearchInput = document.getElementById("post-search");
      const timeFilterEl = document.getElementById("time-filter");
      const sortFilterEl = document.getElementById("sort-filter");
      const resultsCountEl = document.getElementById("results-count");
      const moderationToggle = document.getElementById("moderation-toggle");
      const replyBanner = document.getElementById("reply-banner");
      const replyTargetLabel = document.getElementById("reply-target-label");
      const replyClear = document.getElementById("reply-clear");
      const submitButton = form.querySelector('button[type="submit"]');

      let selectedId = "";
      let replyTargetId = "";
      let posts = [];
      let loading = true;
      let searchQuery = "";
      let timeFilter = "all";
      let sortFilter = "newest";
      let lastSubmission = null;
      let boardStats = {
        totalPosts: 0,
        hiddenCount: 0,
        flaggedCount: 0,
        totalComments: 0,
        hiddenComments: 0,
        flaggedComments: 0,
        supportCount: 0,
        queueCount: 0
      };
      let adminToken = String(window.localStorage.getItem(adminTokenKey) || "").trim();
      let adminMode = Boolean(adminToken);
      let flagThreshold = 10;
      let ageGateAccepted = String(window.localStorage.getItem(ageGateKey) || "") === "yes";
      const supportedKey = "618chat_supported_items";

      function escapeHTML(value) {
        return String(value || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      function makeTitle(message) {
        const clean = String(message || "").replace(/\\s+/g, " ").trim().replace(/[.!?\\s]+$/g, "");
        if (!clean) return "Untitled note";
        const firstSentence = clean.split(/(?<=[.!?])\\s+/)[0] || clean;
        const words = firstSentence.split(" ").slice(0, 7).join(" ");
        let title = words || clean.split(" ").slice(0, 7).join(" ");
        title = title.replace(/[,;:]+/g, "").trim();
        if (!title) return "Untitled note";
        title = title.charAt(0).toUpperCase() + title.slice(1);
        if (title.length > 48) title = title.slice(0, 45).trim() + "…";
        return title;
      }

      function formatDate(value) {
        try {
          return new Date(value).toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
          });
        } catch (_) {
          return "";
        }
      }

      function excerpt(value) {
        return String(value || "").replace(/\\s+/g, " ").trim().slice(0, 120);
      }

      function formatDisplayedMessage(value) {
        const raw = String(value || "").replace(/\\r\\n/g, "\\n");
        const lines = raw
          .split("\\n")
          .map((line) => line.trim())
          .filter(Boolean);
        const cleaned = lines.filter((line) => {
          if (/^Posted by\\s+.+\\s+on\\s+.+$/i.test(line)) return false;
          if (/^Posted on\\s+.+$/i.test(line)) return false;
          if (/^By\\s+.+\\s+•\\s+.+$/i.test(line)) return false;
          return true;
        });

        if (cleaned.length > 1) {
          const first = cleaned[0];
          const rest = cleaned.slice(1).join(" ").toLowerCase();
          const firstLower = first.toLowerCase();
          const firstWordCount = first.split(/\\s+/).filter(Boolean).length;
          const looksLikeLeadIn = firstWordCount <= 8 && first.length <= 80 && !/[.!?]$/.test(first);
          if (looksLikeLeadIn && rest.includes(firstLower)) {
            cleaned.shift();
          }
        }

        return cleaned.join("\\n");
      }

      function readFlaggedIds() {
        try {
          const parsed = JSON.parse(window.localStorage.getItem(flaggedKey) || "[]");
          return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
        } catch (_) {
          return [];
        }
      }

      function writeFlaggedIds(ids) {
        window.localStorage.setItem(flaggedKey, JSON.stringify(Array.from(new Set(ids))));
      }

      function readSupportedIds() {
        try {
          const parsed = JSON.parse(window.localStorage.getItem(supportedKey) || "[]");
          return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
        } catch (_) {
          return [];
        }
      }

      function writeSupportedIds(ids) {
        window.localStorage.setItem(supportedKey, JSON.stringify(Array.from(new Set(ids))));
      }

      function isSupported(id) {
        return readSupportedIds().includes(String(id));
      }

      function rememberSubmission(item, kind) {
        if (!item) return;
        lastSubmission = {
          id: item.id,
          kind: kind || "post",
          title: item.title || "Untitled note",
          author: item.author || "Anonymous",
          message: item.message || "",
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
          flags: Number(item.flags || 0) || 0,
          supports: Number(item.supports || 0) || 0,
          hidden: Boolean(item.hidden),
          hiddenReason: item.hiddenReason || ""
        };
      }

      function clearSubmissionReminderIfVisible() {
        if (!lastSubmission) return;
        const current = posts.find((post) => post.id === lastSubmission.id) || null;
        if (current && !current.hidden) {
          lastSubmission = null;
        }
      }

      function setAdminToken(token) {
        adminToken = String(token || "").trim();
        adminMode = Boolean(adminToken);
        if (adminToken) {
          window.localStorage.setItem(adminTokenKey, adminToken);
        } else {
          window.localStorage.removeItem(adminTokenKey);
        }
        render();
        loadPosts();
      }

      function showAgeGate() {
        document.body.classList.add("gate-locked");
        if (ageGate) ageGate.hidden = false;
      }

      function hideAgeGate() {
        document.body.classList.remove("gate-locked");
        if (ageGate) ageGate.hidden = true;
      }

      function enterSite() {
        ageGateAccepted = true;
        window.localStorage.setItem(ageGateKey, "yes");
        hideAgeGate();
        setTimeout(() => messageInput.focus(), 50);
      }

      function authHeaders(baseHeaders = {}) {
        const headers = { ...baseHeaders };
        if (adminMode && adminToken) {
          headers["x-admin-token"] = adminToken;
        }
        return headers;
      }

      function isFlagged(id) {
        return readFlaggedIds().includes(String(id));
      }

      function selectPost(id) {
        selectedId = id;
        render();
      }

      function getPostById(id) {
        return posts.find((post) => post.id === id) || null;
      }

      function getSearchBlob(post) {
        const parts = [
          post.title,
          post.author,
          post.message,
          formatDate(post.createdAt),
          formatDate(post.updatedAt)
        ];
        (Array.isArray(post.comments) ? post.comments : []).forEach((comment) => {
          parts.push(comment.title, comment.author, comment.message, formatDate(comment.createdAt), formatDate(comment.updatedAt));
        });
        return parts.filter(Boolean).join(" ").toLowerCase();
      }

      function isWithinTimeFilter(post) {
        if (timeFilter === "all") return true;
        const days = Number(timeFilter || 0) || 0;
        if (!days) return true;
        const postedAt = new Date(post.createdAt || Date.now()).getTime();
        if (!Number.isFinite(postedAt)) return true;
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        return postedAt >= cutoff;
      }

      function comparePosts(left, right) {
        const leftSupports = Number(left.supports || 0) || 0;
        const rightSupports = Number(right.supports || 0) || 0;
        const leftFlags = Number(left.flags || 0) || 0;
        const rightFlags = Number(right.flags || 0) || 0;
        const leftTime = new Date(left.createdAt || 0).getTime() || 0;
        const rightTime = new Date(right.createdAt || 0).getTime() || 0;

        if (sortFilter === "supported") {
          if (rightSupports !== leftSupports) return rightSupports - leftSupports;
          return rightTime - leftTime;
        }
        if (sortFilter === "flagged") {
          if (rightFlags !== leftFlags) return rightFlags - leftFlags;
          return rightTime - leftTime;
        }
        return rightTime - leftTime;
      }

      function applyBoardFilters(sourcePosts) {
        const query = String(searchQuery || "").trim().toLowerCase();
        const filtered = (Array.isArray(sourcePosts) ? sourcePosts : []).filter((post) => {
          if (!isWithinTimeFilter(post)) return false;
          if (!query) return true;
          return getSearchBlob(post).includes(query);
        });
        return filtered.sort(comparePosts);
      }

      function collectModerationItems(sourcePosts) {
        const items = [];
        (Array.isArray(sourcePosts) ? sourcePosts : []).forEach((post) => {
          const postFlags = Number(post.flags || 0) || 0;
          if (post.hidden || postFlags >= flagThreshold) {
            items.push({
              kind: "post",
              id: post.id,
              title: post.title,
              author: post.author || "Anonymous",
              flags: postFlags,
              supports: Number(post.supports || 0) || 0,
              hidden: Boolean(post.hidden),
              createdAt: post.createdAt,
              updatedAt: post.updatedAt,
              message: post.message,
              parentTitle: ""
            });
          }
          (Array.isArray(post.comments) ? post.comments : []).forEach((comment) => {
            const commentFlags = Number(comment.flags || 0) || 0;
            if (comment.hidden || commentFlags >= flagThreshold) {
              items.push({
                kind: "comment",
                id: comment.id,
                title: comment.title,
                author: comment.author || "Anonymous",
                flags: commentFlags,
                supports: Number(comment.supports || 0) || 0,
                hidden: Boolean(comment.hidden),
                createdAt: comment.createdAt,
                updatedAt: comment.updatedAt,
                message: comment.message,
                parentTitle: post.title || "",
                parentId: post.id
              });
            }
          });
        });
        return items.sort((left, right) => {
          const hiddenLeft = left.hidden ? 1 : 0;
          const hiddenRight = right.hidden ? 1 : 0;
          if (hiddenLeft !== hiddenRight) return hiddenRight - hiddenLeft;
          if ((right.flags || 0) !== (left.flags || 0)) return (right.flags || 0) - (left.flags || 0);
          return new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime();
        });
      }

      function deriveBoardStats(sourcePosts) {
        const stats = {
          totalPosts: 0,
          hiddenCount: 0,
          flaggedCount: 0,
          totalComments: 0,
          hiddenComments: 0,
          flaggedComments: 0,
          supportCount: 0,
          queueCount: 0
        };
        (Array.isArray(sourcePosts) ? sourcePosts : []).forEach((post) => {
          stats.totalPosts += 1;
          stats.supportCount += Number(post.supports || 0) || 0;
          const postFlags = Number(post.flags || 0) || 0;
          if (post.hidden) stats.hiddenCount += 1;
          if (postFlags >= flagThreshold) stats.flaggedCount += 1;
          (Array.isArray(post.comments) ? post.comments : []).forEach((comment) => {
            stats.totalComments += 1;
            stats.supportCount += Number(comment.supports || 0) || 0;
            const commentFlags = Number(comment.flags || 0) || 0;
            if (comment.hidden) stats.hiddenComments += 1;
            if (commentFlags >= flagThreshold) stats.flaggedComments += 1;
          });
        });
        stats.queueCount = collectModerationItems(sourcePosts).length;
        return stats;
      }

      function clearReplyTarget() {
        replyTargetId = "";
        updateReplyTargetUI();
        render();
      }

      function beginReply(post) {
        if (!post) return;
        replyTargetId = post.id;
        selectedId = post.id;
        updateReplyTargetUI();
        render();
        messageInput.focus();
      }

      function updateReplyTargetUI() {
        if (!replyBanner || !replyTargetLabel) return;
        const target = replyTargetId ? getPostById(replyTargetId) : null;
        if (target) {
          replyBanner.hidden = false;
          replyBanner.classList.add("show");
          replyTargetLabel.textContent = target.title || "this post";
          if (submitButton) submitButton.textContent = "Share comment";
          messageInput.placeholder = "Write a comment for this post...";
        } else {
          replyBanner.hidden = true;
          replyBanner.classList.remove("show");
          if (submitButton) submitButton.textContent = "Share post";
          messageInput.placeholder = "Share what is on your mind...";
        }
      }

      async function loadPosts() {
        loading = true;
        statusEl.textContent = adminMode ? "Loading conversations in moderation mode..." : "Loading conversations...";
        try {
          const response = await fetch(postsUrl, { headers: authHeaders({ Accept: "application/json" }) });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload.ok) {
            if (response.status === 403 && adminMode) {
              setAdminToken("");
              throw new Error("Moderator access was not accepted. Please unlock moderation again.");
            }
            throw new Error(payload.error || payload.detail || "Could not load posts.");
          }
          posts = Array.isArray(payload.posts) ? payload.posts : [];
          flagThreshold = Number(payload.flagThreshold || 10) || 10;
          boardStats = payload.stats || deriveBoardStats(posts);
          if (!selectedId || !posts.some((post) => post.id === selectedId)) {
            selectedId = posts[0] ? posts[0].id : "";
          }
          if (replyTargetId && !posts.some((post) => post.id === replyTargetId)) {
            clearReplyTarget();
          }
          loading = false;
          statusEl.textContent = adminMode
            ? (posts.length ? "Moderator view loaded." : "No posts yet. You can still moderate once posts arrive.")
            : (posts.length ? "Conversation board loaded." : "No posts yet. Be the first to start a conversation.");
          statusEl.classList.remove("error");
          render();
        } catch (err) {
          loading = false;
          statusEl.textContent = err.message || "Could not load posts.";
          statusEl.classList.add("error");
          render();
        }
      }

      function renderReader(post) {
        if (!post) {
          readerEl.className = "empty-state";
          if (commentListEl) {
            commentListEl.hidden = true;
            commentListEl.innerHTML = "";
          }
          readerEl.innerHTML = loading
            ? "Loading the conversation board..."
            : "No posts yet. Add the first message on the left and it will appear here.";
          return;
        }

        readerEl.className = "";
        const supportCount = Number(post.supports || 0) || 0;
        const postHidden = Boolean(post.hidden);
        readerEl.innerHTML =
          '<h3 class="detail-title">' + escapeHTML(post.title) + '</h3>' +
          '<div class="detail-meta">Posted by ' + escapeHTML(post.author || "Anonymous") + ' on ' + escapeHTML(formatDate(post.createdAt)) + '</div>' +
          '<div class="detail-body">' + escapeHTML(formatDisplayedMessage(post.message)).replace(/\\n/g, "<br>") + '</div>' +
          '<div class="comment-card-footer" style="padding: 12px 0 0; margin: 0;">' +
            '<span>' + supportCount + ' support' + (supportCount === 1 ? "" : "s") + '</span>' +
            '<div class="actions">' +
              '<button type="button" class="mini-action ' + (isSupported(post.id) ? "supported" : "") + '" data-reader-action="support" aria-label="Support post">♥</button>' +
              (adminMode && postHidden ? '<button type="button" class="mini-action" data-reader-action="restore" aria-label="Restore post">↺</button>' : "") +
              (adminMode ? '<button type="button" class="mini-action danger" data-reader-action="delete" aria-label="Delete post">✕</button>' : "") +
            '</div>' +
          '</div>';

        const readerSupportBtn = readerEl.querySelector('[data-reader-action="support"]');
        if (readerSupportBtn) {
          readerSupportBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            supportItem(post.id);
          });
        }
        const readerDeleteBtn = readerEl.querySelector('[data-reader-action="delete"]');
        if (readerDeleteBtn) {
          readerDeleteBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            deleteItem(post.id);
          });
        }
        const readerRestoreBtn = readerEl.querySelector('[data-reader-action="restore"]');
        if (readerRestoreBtn) {
          readerRestoreBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            restoreItem(post.id);
          });
        }

        if (commentListEl) {
          const comments = Array.isArray(post.comments)
            ? post.comments.filter((comment) => adminMode ? true : !comment.hidden)
            : [];
          if (!comments.length) {
            commentListEl.hidden = true;
            commentListEl.innerHTML = "";
          } else {
            commentListEl.hidden = false;
            commentListEl.innerHTML =
              '<div class="comment-heading"><h4>Replies</h4><span class="status-badge">' + comments.length + '</span></div>' +
              comments.map((comment) => {
                const mobileOpen = window.matchMedia && window.matchMedia("(max-width: 760px)").matches;
                const supportCount = Number(comment.supports || 0) || 0;
                const commentHidden = Boolean(comment.hidden);
                return (
                  '<details class="comment-card"' + (mobileOpen ? "" : " open") + '>' +
                    '<summary>' +
                      '<div class="comment-card-title">' + escapeHTML(comment.title) + '</div>' +
                      '<div class="comment-card-meta">Posted by <span class="comment-card-meta-author">' + escapeHTML(comment.author || "Anonymous") + '</span> <span class="comment-card-meta-date">on ' + escapeHTML(formatDate(comment.createdAt)) + '</span></div>' +
                    '</summary>' +
                    '<div class="detail-body">' + escapeHTML(formatDisplayedMessage(comment.message)).replace(/\\n/g, "<br>") + '</div>' +
                    '<div class="comment-card-footer">' +
                      '<span>' + supportCount + ' support' + (supportCount === 1 ? "" : "s") + (commentHidden ? ' · Under review' : '') + '</span>' +
                      '<div class="actions">' +
                        '<button type="button" class="mini-action ' + (isSupported(comment.id) ? "supported" : "") + '" data-comment-action="support" aria-label="Support reply">♥</button>' +
                        '<button type="button" class="mini-action" data-comment-action="flag" aria-label="Flag reply">⚑</button>' +
                        (adminMode && commentHidden ? '<button type="button" class="mini-action" data-comment-action="restore" aria-label="Restore reply">↺</button>' : "") +
                        (adminMode ? '<button type="button" class="mini-action danger" data-comment-action="delete" aria-label="Delete reply">✕</button>' : "") +
                      '</div>' +
                    '</div>' +
                    '<div class="comment-card-mobile-note">Tap to open this reply.</div>' +
                  '</details>'
                );
              }).join("");
            commentListEl.querySelectorAll(".comment-card").forEach((card, index) => {
              const comment = comments[index];
              const supportBtn = card.querySelector('[data-comment-action="support"]');
              if (supportBtn) {
                supportBtn.addEventListener("click", (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  supportItem(comment.id);
                });
              }
              const flagBtn = card.querySelector('[data-comment-action="flag"]');
              if (flagBtn) {
                flagBtn.addEventListener("click", (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  flagItem(comment.id);
                });
              }
              const restoreBtn = card.querySelector('[data-comment-action="restore"]');
              if (restoreBtn) {
                restoreBtn.addEventListener("click", (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  restoreItem(comment.id);
                });
              }
              const deleteBtn = card.querySelector('[data-comment-action="delete"]');
              if (deleteBtn) {
                deleteBtn.addEventListener("click", (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  deleteItem(comment.id);
                });
              }
            });
          }
        }
      }

      function createPostCard(post) {
        const card = document.createElement("article");
        card.className = "post-card" + (post.id === selectedId ? " active" : "");
        const hiddenLabel = post.hidden ? '<span class="status-badge review">Under review</span>' : "";
        const flagLabel = typeof post.flags === "number" && post.flags > 0
          ? '<span class="status-badge">' + post.flags + ' flag' + (post.flags === 1 ? "" : "s") + '</span>'
          : "";
        const supportLabel = typeof post.supports === "number" && post.supports > 0
          ? '<span class="status-badge support">' + post.supports + ' support' + (post.supports === 1 ? "" : "s") + '</span>'
          : "";
        const adminDelete = adminMode ? '<button type="button" class="mini-action danger" data-action="delete" aria-label="Delete post">✕</button>' : "";
        const adminRestore = adminMode && post.hidden ? '<button type="button" class="mini-action" data-action="restore" aria-label="Restore post">↺</button>' : "";
        const replyBtn = '<button type="button" class="mini-action" data-action="reply" aria-label="Reply to post">↩</button>';
        const supportBtn = '<button type="button" class="mini-action ' + (isSupported(post.id) ? "supported" : "") + '" data-action="support" aria-label="Support post">♥</button>';
        const flagClass = isFlagged(post.id) ? "flagged" : "";
        card.innerHTML =
          '<div class="post-actions">' +
            adminDelete +
            adminRestore +
            replyBtn +
            supportBtn +
            '<button type="button" class="mini-action ' + flagClass + '" data-action="flag" aria-label="Flag post">⚑</button>' +
          '</div>' +
          '<button type="button" class="post-open">' +
            '<div class="post-title">' + escapeHTML(post.title) + '</div>' +
            '<div class="post-card-meta">' +
              '<span>' + escapeHTML(post.author || "Anonymous") + ' • ' + escapeHTML(formatDate(post.createdAt)) + '</span>' +
              '<span>' + (hiddenLabel || supportLabel || flagLabel || "") + '</span>' +
            '</div>' +
          '</button>';

        card.querySelector(".post-open").addEventListener("click", () => selectPost(post.id));
        const flagBtn = card.querySelector('[data-action="flag"]');
        if (flagBtn) {
          flagBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            flagItem(post.id);
          });
        }
        const deleteBtn = card.querySelector('[data-action="delete"]');
        if (deleteBtn) {
          deleteBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            deleteItem(post.id);
          });
        }
        const replyBtnEl = card.querySelector('[data-action="reply"]');
        if (replyBtnEl) {
          replyBtnEl.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            beginReply(post);
          });
        }
        const supportBtnEl = card.querySelector('[data-action="support"]');
        if (supportBtnEl) {
          supportBtnEl.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            supportItem(post.id);
          });
        }
        return card;
      }

      function renderPosts() {
        postsEl.innerHTML = "";

        if (loading) {
          postsEl.innerHTML = '<div class="empty-state">Loading the conversation board...</div>';
          renderReader(null);
          updateListSummary(0);
          return;
        }

        if (!posts.length) {
          postsEl.innerHTML = '<div class="empty-state">No posts yet. Use the form above to start the first conversation.</div>';
          renderReader(null);
          updateListSummary(0);
          return;
        }

        const basePosts = adminMode ? posts : posts.filter((post) => !post.hidden);
        const visiblePosts = applyBoardFilters(basePosts);
        if (!visiblePosts.length) {
          const emptyMessage = searchQuery.trim()
            ? "No conversations matched your search and filters."
            : (adminMode
                ? "No posts are available yet."
                : "No visible posts yet. Be the first to start a conversation.");
          postsEl.innerHTML = '<div class="empty-state">' + emptyMessage + '</div>';
          if (selectedId && !visiblePosts.some((post) => post.id === selectedId)) {
            selectedId = "";
          }
          renderReader(null);
          updateListSummary(visiblePosts.length);
          return;
        }

        const current = visiblePosts.find((post) => post.id === selectedId) || visiblePosts[0];
        if (!selectedId || !posts.some((post) => post.id === selectedId)) {
          selectedId = current.id;
        }
        if (!visiblePosts.some((post) => post.id === selectedId)) {
          selectedId = current.id;
        }
        renderReader(current);

        visiblePosts.forEach((post) => {
          postsEl.appendChild(createPostCard(post));
        });
        updateListSummary(visiblePosts.length);
      }

      function updateListSummary(count) {
        if (!resultsCountEl || !summaryTextEl) return;
        const total = adminMode ? posts.length : posts.filter((post) => !post.hidden).length;
        const queryNote = searchQuery.trim() ? ' for "' + searchQuery.trim() + '"' : "";
        resultsCountEl.textContent = String(count) + " shown";
        summaryTextEl.textContent = total
          ? String(count) + " of " + String(total) + " conversations shown" + queryNote + "."
          : "Watching for new posts.";
      }

      function renderModerationPanel() {
        if (!moderationPanelEl) return;
        if (!adminMode) {
          moderationPanelEl.hidden = true;
          moderationPanelEl.innerHTML = "";
          return;
        }

        const queue = collectModerationItems(posts);
        const stats = boardStats || deriveBoardStats(posts);
        moderationPanelEl.hidden = false;
        moderationPanelEl.innerHTML =
          '<div class="moderation-head">' +
            '<div>' +
              '<h4>Moderator dashboard</h4>' +
              '<p style="margin:6px 0 0;color:var(--copy);">Quick review for hidden, flagged, or fresh items.</p>' +
            '</div>' +
            '<div class="moderation-stats">' +
              '<span class="status-badge">Posts ' + stats.totalPosts + '</span>' +
              '<span class="status-badge">Comments ' + stats.totalComments + '</span>' +
              '<span class="status-badge review">Queue ' + stats.queueCount + '</span>' +
              '<span class="status-badge">Supports ' + stats.supportCount + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="moderation-queue">' +
            (queue.length
              ? queue.map((item) => {
                  const reviewLabel = item.hidden ? "Under review" : (item.flags > 0 ? item.flags + " flag" + (item.flags === 1 ? "" : "s") : "Needs attention");
                  return (
                    '<article class="moderation-item">' +
                      '<div class="moderation-item-top">' +
                        '<div>' +
                          '<span class="status-badge review">' + escapeHTML(reviewLabel) + '</span>' +
                          '<h5>' + escapeHTML(item.title || "Untitled note") + '</h5>' +
                        '</div>' +
                        '<div class="moderation-stats">' +
                          '<span class="status-badge">' + escapeHTML(item.kind === "comment" ? "Reply" : "Post") + '</span>' +
                          '<span class="status-badge">' + item.supports + ' support' + (item.supports === 1 ? "" : "s") + '</span>' +
                        '</div>' +
                      '</div>' +
                      '<p>By ' + escapeHTML(item.author || "Anonymous") + ' • ' + escapeHTML(formatDate(item.updatedAt || item.createdAt)) + '</p>' +
                      '<p>' + escapeHTML(String(item.message || "").slice(0, 180)) + (String(item.message || "").length > 180 ? "…" : "") + '</p>' +
                      (item.parentTitle ? '<p style="font-size: 13px;">Reply on <strong>' + escapeHTML(item.parentTitle) + '</strong></p>' : '') +
                      '<div class="moderation-actions">' +
                        '<button class="button button-secondary" type="button" data-moderation-action="open" data-item-id="' + escapeHTML(item.id) + '">Open</button>' +
                        '<button class="button button-secondary" type="button" data-moderation-action="restore" data-item-id="' + escapeHTML(item.id) + '">Restore</button>' +
                        '<button class="button button-danger" type="button" data-moderation-action="delete" data-item-id="' + escapeHTML(item.id) + '">Delete</button>' +
                      '</div>' +
                    '</article>'
                  );
                }).join("")
              : '<div class="empty-state">Nothing is waiting for review right now.</div>')
          + '</div>';

        moderationPanelEl.querySelectorAll("[data-moderation-action]").forEach((button) => {
          button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const action = button.getAttribute("data-moderation-action");
            const itemId = button.getAttribute("data-item-id");
            if (!itemId) return;
            if (action === "open") {
              const target = findPostByItemId(itemId);
              if (target) selectPost(target.id);
            } else if (action === "restore") {
              restoreItem(itemId);
            } else if (action === "delete") {
              deleteItem(itemId);
            }
          });
        });
      }

      function findPostByItemId(id) {
        const targetId = String(id || "").trim();
        if (!targetId) return null;
        for (const post of posts) {
          if (post.id === targetId) return post;
          const comments = Array.isArray(post.comments) ? post.comments : [];
          if (comments.some((comment) => comment.id === targetId)) return post;
        }
        return null;
      }

      async function mutateItem(id, action, confirmMessage) {
        const key = String(id || "").trim();
        if (!key) return;
        if (confirmMessage && !window.confirm(confirmMessage)) return;
        statusEl.textContent = action === "support"
          ? "Sharing support..."
          : action === "flag"
            ? "Sending flag..."
            : action === "restore"
              ? "Restoring item..."
              : "Deleting item...";
        statusEl.classList.remove("error");
        try {
          const response = await fetch(itemsUrl + "/" + encodeURIComponent(key) + "/" + action, {
            method: "POST",
            headers: authHeaders({ Accept: "application/json" })
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload.ok) {
            throw new Error(payload.error || payload.detail || ("Could not " + action + " this item."));
          }
          if (action === "flag") {
            writeFlaggedIds([...readFlaggedIds(), key]);
            statusEl.textContent = payload.hidden ? "Thanks. That item reached the review threshold." : "Thanks. The item was flagged.";
          } else if (action === "support") {
            writeSupportedIds([...readSupportedIds(), key]);
            statusEl.textContent = "Thanks for the support.";
          } else if (action === "restore") {
            statusEl.textContent = "Item restored.";
          } else {
            statusEl.textContent = "Item removed.";
          }
          await loadPosts();
        } catch (err) {
          statusEl.textContent = err.message || ("Could not " + action + " this item.");
          statusEl.classList.add("error");
        }
      }

      function supportItem(id) {
        if (!id) return;
        const key = String(id);
        if (isSupported(key)) {
          statusEl.textContent = "You already supported this item from this browser.";
          statusEl.classList.remove("error");
          return;
        }
        void mutateItem(key, "support");
      }

      function flagItem(id) {
        if (!id) return;
        const key = String(id);
        if (isFlagged(key)) {
          statusEl.textContent = "You already flagged this item from this browser.";
          statusEl.classList.remove("error");
          return;
        }
        void mutateItem(key, "flag");
      }

      function restoreItem(id) {
        if (!adminMode || !adminToken) return;
        void mutateItem(id, "restore", "Restore this item?");
      }

      function deleteItem(id) {
        if (!adminMode || !adminToken) return;
        void mutateItem(id, "delete", "Delete this item permanently?");
      }

      function render() {
        renderModerationPanel();
        renderPosts();
        if (moderationToggle) {
          moderationToggle.textContent = adminMode ? "Exit moderation" : "Moderate";
        }
        updateReplyTargetUI();
      }

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const message = String(messageInput.value || "").trim();
        const author = String(authorInput.value || "").trim();
        if (!message) {
          statusEl.textContent = "Please add a message first.";
          statusEl.classList.add("error");
          return;
        }

        statusEl.textContent = replyTargetId ? "Posting your reply..." : "Posting to the conversation board...";
        statusEl.classList.remove("error");
        submitButton.disabled = true;

        const targetId = replyTargetId;
        const endpoint = targetId ? postsUrl + "/" + encodeURIComponent(targetId) + "/comments" : postsUrl;
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ author, message })
        })
          .then((response) => response.json().then((payload) => ({ response, payload })))
          .then(({ response, payload }) => {
            if (!response.ok || !payload.ok || !(payload.post || payload.comment)) {
              throw new Error(payload.error || payload.detail || "Could not add the post.");
            }
            if (targetId) {
              const nextPost = payload.post || null;
              posts = posts.map((post) => post.id === targetId && nextPost ? nextPost : post);
              selectedId = targetId;
            } else {
              const nextPost = payload.post;
              posts = [nextPost, ...posts.filter((post) => post.id !== nextPost.id)];
              selectedId = nextPost.id;
            }
            form.reset();
            clearReplyTarget();
            statusEl.textContent = "Message added to the conversation board.";
            statusEl.classList.remove("error");
            render();
            messageInput.focus();
            window.setTimeout(() => {
              if (!document.hidden) loadPosts();
            }, 2500);
          })
          .catch((err) => {
            statusEl.textContent = err.message || "Could not add the post.";
            statusEl.classList.add("error");
          })
          .finally(() => {
            submitButton.disabled = false;
          });
      });

      if (replyClear) {
        replyClear.addEventListener("click", clearReplyTarget);
      }

      if (postSearchInput) {
        postSearchInput.addEventListener("input", () => {
          searchQuery = postSearchInput.value || "";
          render();
        });
      }
      if (timeFilterEl) {
        timeFilterEl.addEventListener("change", () => {
          timeFilter = timeFilterEl.value || "all";
          render();
        });
      }
      if (sortFilterEl) {
        sortFilterEl.addEventListener("change", () => {
          sortFilter = sortFilterEl.value || "newest";
          render();
        });
      }

      render();
      loadPosts();
      if (!ageGateAccepted) {
        showAgeGate();
      } else {
        hideAgeGate();
      }
      if (moderationToggle) {
        moderationToggle.addEventListener("click", () => {
          if (adminMode) {
            setAdminToken("");
            return;
          }
          const token = window.prompt("Enter the 618chat moderator token:");
          if (token && String(token).trim()) {
            setAdminToken(token);
          }
        });
      }
      if (ageGateEnter) {
        ageGateEnter.addEventListener("click", enterSite);
      }
      if (ageGateLeave) {
        ageGateLeave.addEventListener("click", () => {
          window.location.replace("/no-entry/");
        });
      }
      setInterval(() => {
        if (!document.hidden) loadPosts();
      }, 5000);
      window.addEventListener("focus", () => {
        if (!document.hidden) loadPosts();
      });
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) loadPosts();
      });
      if (ageGateAccepted) {
        setTimeout(() => messageInput.focus(), 100);
      }
    })();
  </script>
</body>
</html>`;
}

function createNoEntryPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>18+ Notice</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f5f7ef;
      --ink: #102015;
      --copy: #5b6b60;
      --card: rgba(255,255,255,0.92);
      --line: rgba(16,32,21,0.1);
      --green: #2d6f40;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: radial-gradient(circle at top, rgba(122,176,106,0.18), transparent 28%), linear-gradient(180deg, #fafbf4 0%, var(--bg) 100%);
      color: var(--ink);
      font-family: "Plus Jakarta Sans", Arial, sans-serif;
      padding: 20px;
    }
    .card {
      width: min(560px, 100%);
      padding: 28px;
      border-radius: 28px;
      background: var(--card);
      border: 1px solid var(--line);
      box-shadow: 0 24px 70px rgba(22,54,31,0.12);
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(45,111,64,0.08);
      color: #174425;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-size: 12px;
      font-weight: 800;
    }
    .eyebrow::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--green);
      box-shadow: 0 0 0 6px rgba(45,111,64,0.12);
    }
    h1 {
      margin: 16px 0 0;
      font-family: "Outfit", Arial, sans-serif;
      font-size: clamp(30px, 4vw, 44px);
      line-height: 1;
      letter-spacing: -0.05em;
    }
    p {
      margin: 14px 0 0;
      color: var(--copy);
      line-height: 1.8;
      font-size: 16px;
    }
  </style>
</head>
<body>
  <main class="card" aria-label="Age notice">
    <span class="eyebrow">Not for this visit</span>
    <h1>Thanks for checking out 618chat.</h1>
    <p>
      This space is for adults only. If this was not the right fit, you can close this tab or head back when you are ready.
    </p>
  </main>
</body>
</html>`;
}

async function syncCozyBuilderBuild() {
  try {
    await access(cozyExportSourceDir);
  } catch {
    // Cloudflare Pages only needs the committed build artifact already in public/cozy-builder.
    // When the local Godot export source is unavailable, keep the checked-in files intact.
    return;
  }
  for (const targetDir of cozyExportTargetDirs) {
    await rm(targetDir, { recursive: true, force: true });
    await cp(cozyExportSourceDir, targetDir, { recursive: true });
  }
}

function isGzipBuffer(buffer) {
  return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
}

async function collectWasmFiles(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectWasmFiles(fullPath, out);
    } else if (entry.isFile() && fullPath.endsWith(".wasm")) {
      out.push(fullPath);
    }
  }
  return out;
}

async function compressPublicWasmAssets() {
  const wasmFiles = await collectWasmFiles(publicDir);

  for (const filePath of wasmFiles) {
    const raw = await readFile(filePath);
    const gzPath = `${filePath}.gz`;
    await writeFile(gzPath, gzipSync(raw, { level: 9 }));
    await rm(filePath);
  }
}

function createRootLandingPage(chatPageHtml) {
  const hostGuard = `
  <style>
    html:not(.root-ready) body {
      visibility: hidden;
    }
  </style>
  <script>
    (function () {
      const host = String(window.location.hostname || "").toLowerCase();
      const isChatSite = host.includes("618chat.com");
      if (!isChatSite) {
        const target = host.includes("618help.com") ? "/help-mowing/" : "/chatbots/";
        if (window.location.pathname !== target) {
          window.location.replace(target);
        }
        return;
      }
      document.documentElement.classList.add("root-ready");
    })();
  </script>
  <noscript>
    <meta http-equiv="refresh" content="0; url=/chatbots/">
  </noscript>`;

  return insertBeforeHeadEnd(chatPageHtml, hostGuard);
}

function createContactPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Contact Johnny</title>
  <meta name="description" content="Contact Johnny about mowing or AI services. Upload pictures or screenshots if they help explain the job.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  ${sharedNavStyles}
  <style>
    :root {
      --bg: #f6f4ed;
      --bg-2: #edf3e7;
      --ink: #102015;
      --copy: #5b6b60;
      --line: rgba(16, 32, 21, 0.1);
      --green: #2d6f40;
      --green-2: #4b8d5c;
      --green-deep: #164426;
      --card: rgba(255, 255, 255, 0.84);
      --shadow: 0 30px 80px rgba(22, 54, 31, 0.12);
    }

    * { box-sizing: border-box; }

    html { scroll-behavior: smooth; }

    body {
      margin: 0;
      font-family: "Plus Jakarta Sans", Arial, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 0% 0%, rgba(122, 176, 106, 0.22), transparent 30%),
        radial-gradient(circle at 100% 8%, rgba(199, 166, 95, 0.14), transparent 26%),
        linear-gradient(180deg, #f8f7f1 0%, var(--bg-2) 42%, #f6f4ec 100%);
      min-height: 100vh;
      overflow-x: hidden;
    }

    a { color: inherit; text-decoration: none; }

    .page {
      width: min(1200px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 20px 0 40px;
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.08fr) minmax(320px, 0.92fr);
      gap: 20px;
      align-items: start;
      margin-top: 10px;
    }

    .panel {
      background: linear-gradient(180deg, rgba(255,255,255,0.88), rgba(251,249,241,0.78));
      border: 1px solid var(--line);
      box-shadow: var(--shadow);
      backdrop-filter: blur(18px);
      border-radius: 30px;
    }

    .hero-copy {
      padding: 32px;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(45, 111, 64, 0.08);
      color: var(--green-deep);
      border: 1px solid rgba(45, 111, 64, 0.12);
      font-weight: 800;
      font-size: 12px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }

    .eyebrow::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--green);
      box-shadow: 0 0 0 6px rgba(45, 111, 64, 0.12);
    }

    .hero-copy h1 {
      margin: 16px 0 0;
      font-family: "Outfit", Arial, sans-serif;
      font-size: clamp(42px, 6vw, 78px);
      line-height: 0.92;
      letter-spacing: -0.05em;
      max-width: 10ch;
    }

    .hero-copy p,
    .form-note,
    .info-card p {
      color: var(--copy);
      line-height: 1.75;
      font-size: 16px;
    }

    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 52px;
      padding: 0 20px;
      border-radius: 999px;
      border: 1px solid transparent;
      font: inherit;
      font-weight: 800;
      font-size: 15px;
      cursor: pointer;
      transition: transform 180ms ease, box-shadow 180ms ease, filter 180ms ease;
    }

    .button:hover {
      transform: translateY(-1px);
      filter: brightness(1.02);
    }

    .button-primary {
      background: linear-gradient(135deg, var(--green) 0%, var(--green-2) 100%);
      color: #fffdf7;
      box-shadow: 0 14px 28px rgba(47, 122, 68, 0.24);
    }

    .button-secondary {
      background: rgba(255,255,255,0.88);
      color: var(--ink);
      border-color: rgba(16, 32, 21, 0.08);
    }

    .info-card {
      padding: 18px;
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.82);
      border: 1px solid rgba(16, 32, 21, 0.08);
      box-shadow: 0 16px 32px rgba(17, 38, 22, 0.08);
      margin-top: 12px;
    }

    .info-card h2 {
      margin: 0 0 8px;
      font-family: "Outfit", Arial, sans-serif;
      font-size: 24px;
      line-height: 1.05;
      letter-spacing: -0.03em;
    }

    .checklist {
      margin: 12px 0 0;
      padding-left: 18px;
      color: var(--copy);
      line-height: 1.7;
    }

    .contact-panel {
      padding: 24px;
    }

    .contact-panel h2 {
      margin: 0;
      font-family: "Outfit", Arial, sans-serif;
      font-size: 30px;
      letter-spacing: -0.04em;
      line-height: 1;
    }

    .contact-panel p {
      margin: 10px 0 0;
      color: var(--copy);
      line-height: 1.7;
    }

    form {
      margin-top: 18px;
    }

    .field-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;
    }

    .field.full {
      grid-column: 1 / -1;
    }

    label {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #365041;
    }

    input, select, textarea {
      width: 100%;
      border: 1px solid rgba(16, 32, 21, 0.12);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.9);
      color: var(--ink);
      font: inherit;
      font-size: 16px;
      padding: 14px 16px;
      outline: none;
      transition: border-color 160ms ease, box-shadow 160ms ease;
    }

    textarea {
      min-height: 150px;
      resize: vertical;
    }

    input:focus, select:focus, textarea:focus {
      border-color: rgba(45, 111, 64, 0.55);
      box-shadow: 0 0 0 4px rgba(45, 111, 64, 0.12);
    }

    .upload-hint {
      margin-top: 8px;
      font-size: 14px;
      color: var(--copy);
    }

    .form-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      margin-top: 16px;
    }

    .status {
      margin-top: 14px;
      font-size: 15px;
      color: var(--green-deep);
      min-height: 1.4em;
    }

    .status.error {
      color: #9b1c1c;
    }

    .side-stack {
      display: grid;
      gap: 14px;
    }

    .profile-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 38px;
      padding: 0 14px;
      border-radius: 999px;
      background: rgba(45, 111, 64, 0.08);
      border: 1px solid rgba(45, 111, 64, 0.12);
      color: var(--green-deep);
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    @media (max-width: 980px) {
      .hero { grid-template-columns: 1fr; }
    }

    @media (max-width: 760px) {
      .page { width: min(100vw - 20px, 1200px); padding: 14px 0 24px; }
      .hero-copy, .contact-panel { padding: 22px; }
      .field-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
${siteNav("ai", "contact")}
  <main class="page">
    <div class="profile-badge" data-profile-badge>Contact Johnny</div>
    <div class="hero">
      <section class="panel hero-copy">
        <span class="eyebrow" data-eyebrow>Contact Form</span>
        <h1 data-title>Tell Johnny what you need.</h1>
        <p data-lead>
          Use this form for chatbot projects, websites, and custom AI ideas.
          Screenshots and examples are welcome if they help explain the concept.
        </p>

        <div class="info-card">
          <h2>What to include</h2>
          <ul class="checklist" data-checklist>
            <li>Your name and best contact info.</li>
            <li>What you need help with and when you want to start.</li>
            <li>Screenshots, examples, or reference material if they help.</li>
          </ul>
        </div>

        <div class="info-card">
          <h2>Good to know</h2>
          <p data-good-to-know>
            We’ll use your details to follow up and figure out the right next step.
          </p>
        </div>
      </section>

      <section class="panel contact-panel">
        <h2>Send the details</h2>
        <p>
          Fill this out and we’ll get your message where it needs to go.
        </p>

        <form id="contact-form">
          <input type="hidden" name="profile" id="contact-profile" value="">
          <input type="hidden" name="page_url" id="contact-page-url" value="">

          <div class="field-grid">
            <div class="field">
              <label for="name">Name</label>
              <input id="name" name="name" autocomplete="name" required>
            </div>
            <div class="field">
              <label for="email">Email</label>
              <input id="email" name="email" type="email" autocomplete="email" required>
            </div>
            <div class="field">
              <label for="phone">Phone</label>
              <input id="phone" name="phone" autocomplete="tel">
            </div>
            <div class="field">
              <label for="topic">Topic</label>
              <select id="topic" name="topic">
                <option value="General question">General question</option>
                <option value="Mowing quote">Mowing quote</option>
                <option value="AI / chatbot build">AI / chatbot build</option>
                <option value="Website design">Website design</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="field full">
              <label for="company">Business or property name</label>
              <input id="company" name="company" autocomplete="organization">
            </div>
            <div class="field full">
              <label for="message">Message</label>
              <textarea id="message" name="message" required placeholder="Tell us about the property, the business, or the custom build you're after."></textarea>
            </div>
            <div class="field full">
              <label for="attachments">Photos or screenshots</label>
              <input id="attachments" name="attachments" type="file" multiple accept="image/*,.pdf">
              <div class="upload-hint">You can upload yard photos, screenshots, menus, plans, or other helpful files.</div>
            </div>
          </div>

          <div class="form-actions">
            <button class="button button-primary" type="submit">Send message</button>
            <span class="upload-hint">We’ll send this to the right inbox after you submit it.</span>
          </div>

          <div class="status" id="contact-status" aria-live="polite"></div>
        </form>
      </section>
    </div>
  </main>

  <script>
    (function () {
      const host = String(window.location.hostname || "").toLowerCase();
      const isMowing = host.includes("618help.com");
      const profile = isMowing ? "mowing" : "ai";
      const apiBase = String(window.JOHNNY_CONTACT_API_BASE_URL || "https://johnny-chat.onrender.com").replace(new RegExp("/+$"), "");

      window.JOHNNY_WIDGET_PROFILE = profile;

      const badge = document.querySelector("[data-profile-badge]");
      const eyebrow = document.querySelector("[data-eyebrow]");
      const title = document.querySelector("[data-title]");
      const lead = document.querySelector("[data-lead]");
      const goodToKnow = document.querySelector("[data-good-to-know]");
      const checklist = document.querySelector("[data-checklist]");
      const profileField = document.getElementById("contact-profile");
      const pageUrlField = document.getElementById("contact-page-url");
      const form = document.getElementById("contact-form");
      const status = document.getElementById("contact-status");
      const submit = form.querySelector('button[type="submit"]');
      const topicSelect = document.getElementById("topic");
      const navBrand = document.querySelector(".johnny-site-brand");
      const navLinks = document.querySelectorAll(".johnny-site-link");
      const homeHref = isMowing ? "https://618help.com" : "https://justaskjohnny.com";
      const gptHref = "/chatbot/";
      const cozyHref = "/cozy-builder-game/";
      const contactHref = "/contact/";

      profileField.value = profile;
      pageUrlField.value = window.location.href;

      if (navBrand) {
        navBrand.textContent = isMowing ? "618help.com" : "justaskjohnny.com";
        navBrand.href = homeHref;
      }

      if (isMowing && navLinks.length >= 4) {
        navLinks[0].href = homeHref;
        navLinks[1].href = gptHref;
        navLinks[2].href = cozyHref;
        navLinks[3].href = contactHref;
      } else if (navLinks.length >= 4) {
        navLinks[0].href = homeHref;
        navLinks[1].href = gptHref;
        navLinks[2].href = cozyHref;
        navLinks[3].href = contactHref;
      }

      if (isMowing) {
        badge.textContent = "Mowing contact form";
        eyebrow.textContent = "Mowing contact";
        title.textContent = "Tell us about the yard.";
        lead.textContent = "Use this form for mowing quotes, service questions, scheduling, or photos of the property if they help explain the job.";
        goodToKnow.textContent = "If you’re not sure about the area, accessibility, or property details, just tell us what you know and we’ll sort it out.";
        checklist.innerHTML = [
          "<li>How big the property is, and whether it is flat or hilly.</li>",
          "<li>Any trees, fences, gates, or other obstacles.</li>",
          "<li>What days or timing work best for you.</li>"
        ].join("");
        [...topicSelect.options].forEach((option) => {
          if (option.value === "AI / chatbot build" || option.value === "Website design") {
            option.remove();
          }
        });
      } else {
        badge.textContent = "AI and website contact form";
        eyebrow.textContent = "AI / website contact";
        title.textContent = "Tell us what you want to build.";
        lead.textContent = "Use this form for chatbot projects, websites, and custom AI ideas. Screenshots and examples are welcome if they help explain the concept.";
        goodToKnow.textContent = "If you are comparing options, describe the business, the goal, and the kind of assistant or website experience you want.";
        checklist.innerHTML = [
          "<li>What your business does and who it serves.</li>",
          "<li>What you want the chatbot or website to do.</li>",
          "<li>Any screenshots, examples, or reference material.</li>"
        ].join("");
        [...topicSelect.options].forEach((option) => {
          if (option.value === "Mowing quote") {
            option.remove();
          }
        });
      }

      document.body.dataset.navReady = "1";

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        status.textContent = "Sending your message...";
        status.classList.remove("error");
        submit.disabled = true;

        try {
          const response = await fetch(apiBase + "/api/contact", {
            method: "POST",
            body: new FormData(form)
          });

          let payload = {};
          try {
            payload = await response.json();
          } catch (_) {
            payload = {};
          }

          if (!response.ok || payload.ok !== true) {
            throw new Error(payload.error || payload.detail || "The message could not be sent yet.");
          }

          form.reset();
          profileField.value = profile;
          pageUrlField.value = window.location.href;
          status.textContent = "Thanks. Your message was sent.";
        } catch (err) {
          status.textContent = err.message || "Something went wrong.";
          status.classList.add("error");
        } finally {
          submit.disabled = false;
        }
      });
    })();
  </script>
  <script>
    (function () {
      window.JOHNNY_WIDGET_PROFILE = String(window.location.hostname || "").toLowerCase().includes("618help.com") ? "mowing" : "ai";
    })();
  </script>
  <link rel="stylesheet" href="https://johnny-chat.onrender.com/voice-widget.css">
  <script src="https://johnny-chat.onrender.com/voice-widget.js"></script>
</body>
</html>`;
}

async function main() {
  const aiSourcePath = path.join(publicDir, "ai-services.html");
  const mowingSourcePath = path.join(root, "squarespace_landing_section.html");

  const [aiSource, mowingSource] = await Promise.all([
    readFile(aiSourcePath, "utf8"),
    readFile(mowingSourcePath, "utf8")
  ]);

  const aiClean = aiSource.replace(/<\/html>\s*[\s\S]*$/i, "</html>");
  let aiPage = insertBeforeHeadEnd(aiClean, sharedNavStyles);
  aiPage = insertAfterBodyOpen(aiPage, siteNav("ai", "home"));
  aiPage = insertBeforeBodyEnd(aiPage, widgetSnippet("ai"));

  await mkdir(path.join(publicDir, "chatbots"), { recursive: true });
  await mkdir(path.join(publicDir, "help-mowing"), { recursive: true });
  await mkdir(path.join(publicDir, "618chat"), { recursive: true });
  await mkdir(path.join(publicDir, "contact"), { recursive: true });
  await syncCozyBuilderBuild();

  await writeFile(path.join(publicDir, "chatbots", "index.html"), aiPage, "utf8");

  const mowingHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>618help.com - Mowing</title>
  <meta name="description" content="Johnny's mowing service for the Mount Vernon area.">
  ${sharedNavStyles}
</head>
<body>
${siteNav("mowing", "mowing")}
${mowingSource}
${widgetSnippet("mowing")}
</body>
</html>`;

  await writeFile(path.join(publicDir, "help-mowing", "index.html"), mowingHtml, "utf8");
  await writeFile(path.join(publicDir, "618chat", "index.html"), create618ChatPage(), "utf8");
  await mkdir(path.join(publicDir, "no-entry"), { recursive: true });
  await writeFile(path.join(publicDir, "no-entry", "index.html"), createNoEntryPage(), "utf8");
  await writeFile(path.join(publicDir, "contact", "index.html"), createContactPage(), "utf8");
  await writeFile(path.join(publicDir, "index.html"), createRootLandingPage(create618ChatPage()), "utf8");
  await compressPublicWasmAssets();

  console.log("Pages build files generated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
