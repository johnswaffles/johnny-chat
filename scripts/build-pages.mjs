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
  const boardHref = "/618chat/";
  const contactHref = "/contact/";
  return `
  <header class="johnny-site-nav">
    <a class="johnny-site-brand" href="${homeHref}">${brand}</a>
    <nav class="johnny-site-links" aria-label="Site">
      <a class="johnny-site-link ${active === "home" ? "active" : ""}" href="${homeHref}">Home</a>
      <a class="johnny-site-link ${active === "gpt" ? "active" : ""}" href="${gptHref}">GPT 5.4</a>
      <a class="johnny-site-link ${active === "cozy" ? "active" : ""}" href="${cozyHref}" target="_blank" rel="noopener noreferrer">Cozy Builder</a>
      ${profile === "mowing" ? `<a class="johnny-site-link ${active === "618chat" ? "active" : ""}" href="${boardHref}">618chat</a>` : ""}
      <a class="johnny-site-link ${active === "contact" ? "active" : ""}" href="${contactHref}">Contact</a>
    </nav>
  </header>`;
}

function create618ChatPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>618chat</title>
  <meta name="description" content="A cozy sandbox message board for the 618help.com mowing site. Leave a note, auto-generate a title, and click posts to read them.">
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
      width: min(1280px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 18px 0 36px;
    }
    .intro {
      margin-top: 14px;
      display: grid;
      grid-template-columns: minmax(0, 1.12fr) minmax(320px, 0.88fr);
      gap: 18px;
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
    .hint { font-size: 14px; color: var(--copy); line-height: 1.6; }
    .posts {
      display: grid;
      gap: 10px;
      margin-top: 12px;
    }
    .post-button {
      width: 100%;
      border: 1px solid rgba(16, 32, 21, 0.08);
      border-radius: 18px;
      background: rgba(255,255,255,0.9);
      padding: 14px 16px;
      text-align: left;
      cursor: pointer;
      transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
    }
    .post-button:hover {
      transform: translateY(-1px);
      border-color: rgba(45, 111, 64, 0.34);
      box-shadow: 0 10px 24px rgba(17, 38, 22, 0.08);
    }
    .post-button.active {
      border-color: rgba(45, 111, 64, 0.44);
      background: linear-gradient(180deg, rgba(245, 250, 244, 0.96), rgba(235, 244, 231, 0.92));
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
      .page { width: min(100vw - 20px, 1280px); padding: 14px 0 24px; }
      .hero, .board { padding: 20px; }
      .detail-title { font-size: 28px; }
      .hero h1 { max-width: none; }
    }
  </style>
</head>
<body>
${siteNav("mowing", "618chat")}
  <main class="page">
    <section class="intro">
      <div class="panel hero">
        <span class="eyebrow">618chat sandbox</span>
        <h1>Leave a note. Read the board. Keep it cozy.</h1>
        <p>
          This is a simple message board for the mowing site. Posts live in your browser, get an auto-generated title, and can be opened from the list whenever you want to read them.
        </p>
        <div class="pill-row">
          <div class="pill"><strong>Local</strong> browser storage</div>
          <div class="pill"><strong>Auto</strong> title generation</div>
          <div class="pill"><strong>Click</strong> to read posts</div>
        </div>
        <div class="meta-card">
          <h2>What this board is for</h2>
          <ul>
            <li>Quick notes, ideas, or test posts for the mowing site.</li>
            <li>Message titles are created automatically from the post text.</li>
            <li>Posts are stored in this browser only, so it stays sandboxed.</li>
          </ul>
        </div>
      </div>

      <div class="panel board">
        <div class="board-top">
          <div>
            <h2>Post a message</h2>
            <p>Write something short or long. We’ll give it a title and add it to the board.</p>
          </div>
        </div>
        <div class="layout">
          <section class="composer" aria-label="New post">
            <h3>New post</h3>
            <p>Keep it friendly. Titles are generated automatically from the first useful words.</p>
            <form id="board-form">
              <div class="field">
                <label for="author">Name</label>
                <input id="author" name="author" autocomplete="name" placeholder="Anonymous">
              </div>
              <div class="field">
                <label for="message">Message</label>
                <textarea id="message" name="message" required placeholder="Write a note for the board..."></textarea>
              </div>
              <div class="form-actions">
                <button class="button button-primary" type="submit">Add message</button>
                <button class="button button-secondary" type="button" id="clear-board">Clear board</button>
              </div>
              <div class="status" id="board-status" aria-live="polite"></div>
              <div class="hint">Posts stay on this device. Refreshing the page will keep them here unless you clear the board.</div>
            </form>
          </section>

          <section class="reader" aria-label="Selected post">
            <h3>Read a post</h3>
            <p>Click any card on the left to open the full message here.</p>
            <div id="post-reader" class="empty-state">No posts yet. Add the first message on the left and it will appear here.</div>
          </section>
        </div>

        <div class="list" style="margin-top: 14px;">
          <div class="board-top" style="align-items: center;">
            <div>
              <h3>Recent posts</h3>
              <p>The newest message appears first. Select a post to read it in full.</p>
            </div>
          </div>
          <div id="posts" class="posts"></div>
        </div>
      </div>
    </section>
  </main>

  <script>
    (function () {
      const STORAGE_KEY = "johnny_618chat_posts_v1";
      const authorInput = document.getElementById("author");
      const messageInput = document.getElementById("message");
      const form = document.getElementById("board-form");
      const postsEl = document.getElementById("posts");
      const readerEl = document.getElementById("post-reader");
      const statusEl = document.getElementById("board-status");
      const clearBtn = document.getElementById("clear-board");

      let selectedId = "";
      let posts = loadPosts();

      function loadPosts() {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          const parsed = raw ? JSON.parse(raw) : [];
          return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
          return [];
        }
      }

      function savePosts() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
      }

      function escapeHTML(value) {
        return String(value || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      function makeTitle(message) {
        const clean = String(message || "").replace(/\s+/g, " ").trim().replace(/[.!?\s]+$/g, "");
        if (!clean) return "Untitled note";
        const firstSentence = clean.split(/(?<=[.!?])\s+/)[0] || clean;
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
        return String(value || "").replace(/\s+/g, " ").trim().slice(0, 120);
      }

      function selectPost(id) {
        selectedId = id;
        render();
      }

      function renderReader(post) {
        if (!post) {
          readerEl.className = "empty-state";
          readerEl.innerHTML = "No posts yet. Add the first message on the left and it will appear here.";
          return;
        }

        readerEl.className = "";
        readerEl.innerHTML =
          '<h3 class="detail-title">' + escapeHTML(post.title) + '</h3>' +
          '<div class="detail-meta">Posted by ' + escapeHTML(post.author || "Anonymous") + ' on ' + escapeHTML(formatDate(post.createdAt)) + '</div>' +
          '<div class="detail-body">' + escapeHTML(post.message).replace(/\n/g, "<br>") + '</div>';
      }

      function renderPosts() {
        postsEl.innerHTML = "";

        if (!posts.length) {
          postsEl.innerHTML = '<div class="empty-state">No posts yet. Use the form above to add the first message. Titles are created automatically when you post.</div>';
          renderReader(null);
          return;
        }

        const current = posts.find((post) => post.id === selectedId) || posts[0];
        if (!selectedId || !posts.some((post) => post.id === selectedId)) {
          selectedId = current.id;
        }
        renderReader(current);

        posts.forEach((post) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "post-button" + (post.id === selectedId ? " active" : "");
          button.innerHTML =
            '<div class="post-title">' + escapeHTML(post.title) + '</div>' +
            '<div class="post-meta">' + escapeHTML(post.author || "Anonymous") + ' • ' + escapeHTML(formatDate(post.createdAt)) + '</div>' +
            '<div class="post-excerpt">' + escapeHTML(excerpt(post.message)) + (post.message.length > 120 ? "…" : "") + '</div>';
          button.addEventListener("click", () => selectPost(post.id));
          postsEl.appendChild(button);
        });
      }

      function render() {
        renderPosts();
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

        const post = {
          id: "post_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
          title: makeTitle(message),
          author: author || "Anonymous",
          message,
          createdAt: new Date().toISOString()
        };

        posts = [post, ...posts];
        selectedId = post.id;
        savePosts();

        form.reset();
        statusEl.textContent = "Message added to the board.";
        statusEl.classList.remove("error");
        render();
        messageInput.focus();
      });

      clearBtn.addEventListener("click", () => {
        const ok = window.confirm("Clear all 618chat messages from this browser?");
        if (!ok) return;
        posts = [];
        selectedId = "";
        savePosts();
        render();
        statusEl.textContent = "Board cleared.";
        statusEl.classList.remove("error");
      });

      if (posts.length) {
        selectedId = posts[0].id;
      }

      render();
      setTimeout(() => messageInput.focus(), 100);
    })();
  </script>
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

function createRootRedirectPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Johnny</title>
  <meta name="description" content="Johnny's websites and assistant demo.">
  <script>
    (function () {
      const host = String(window.location.hostname || "").toLowerCase();
      const target = host.includes("618help.com") ? "/help-mowing/" : "/chatbots/";
      if (window.location.pathname !== target) {
        window.location.replace(target);
      }
    })();
  </script>
  <noscript>
    <meta http-equiv="refresh" content="0; url=/chatbots/">
  </noscript>
</head>
<body>
  <p>Redirecting...</p>
</body>
</html>`;
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

      if (isMowing && navLinks.length >= 5) {
        navLinks[0].href = homeHref;
        navLinks[1].href = gptHref;
        navLinks[2].href = cozyHref;
        navLinks[3].href = "/618chat/";
        navLinks[4].href = contactHref;
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
  await writeFile(path.join(publicDir, "contact", "index.html"), createContactPage(), "utf8");
  await writeFile(path.join(publicDir, "index.html"), createRootRedirectPage(), "utf8");
  await compressPublicWasmAssets();

  console.log("Pages build files generated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
