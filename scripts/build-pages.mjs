import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const publicDir = path.join(root, "public");

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
  const chatbotsHref = profile === "mowing" ? "https://justaskjohnny.com" : "/chatbots/";
  const mowingHref = profile === "mowing" ? "/help-mowing/" : "https://618help.com";
  const cozyHref = "/cozy-builder/";
  const contactHref = "/contact/";
  return `
  <header class="johnny-site-nav">
    <a class="johnny-site-brand" href="${homeHref}">${brand}</a>
    <nav class="johnny-site-links" aria-label="Site">
      <a class="johnny-site-link ${active === "home" ? "active" : ""}" href="${homeHref}">Home</a>
      <a class="johnny-site-link ${active === "chatbots" ? "active" : ""}" href="${chatbotsHref}">Chatbots</a>
      <a class="johnny-site-link ${active === "mowing" ? "active" : ""}" href="${mowingHref}">Mowing</a>
      <a class="johnny-site-link ${active === "cozy" ? "active" : ""}" href="${cozyHref}">Cozy Builder</a>
      <a class="johnny-site-link ${active === "contact" ? "active" : ""}" href="${contactHref}">Contact</a>
    </nav>
  </header>`;
}

function createCozyBuilderPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cozy Builder</title>
  <meta name="description" content="Launch the shared Cozy Builder city-building game from either Johnny site.">
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

    .page {
      width: min(1200px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 20px 0 40px;
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 0.95fr) minmax(320px, 1.05fr);
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
      font-size: clamp(42px, 6vw, 80px);
      line-height: 0.92;
      letter-spacing: -0.05em;
      max-width: 10ch;
    }

    .hero-copy p,
    .info-card p {
      color: var(--copy);
      line-height: 1.75;
      font-size: 16px;
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 24px;
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
      text-decoration: none;
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

    .feature-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 18px;
    }

    .game-shell {
      padding: 18px;
    }

    .game-shell h2 {
      margin: 0;
      font-family: "Outfit", Arial, sans-serif;
      font-size: 30px;
      line-height: 1;
      letter-spacing: -0.04em;
    }

    .game-shell p {
      margin: 10px 0 0;
      color: var(--copy);
      line-height: 1.7;
    }

    .game-frame {
      margin-top: 16px;
      width: 100%;
      aspect-ratio: 16 / 10;
      min-height: 560px;
      border: 1px solid rgba(16, 32, 21, 0.08);
      border-radius: 24px;
      overflow: hidden;
      background: #000;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06);
    }

    .game-frame iframe {
      display: block;
      width: 100%;
      height: 100%;
      border: 0;
      background: #000;
    }

    .link-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 14px;
    }

    @media (max-width: 980px) {
      .hero { grid-template-columns: 1fr; }
      .feature-grid { grid-template-columns: 1fr; }
    }

    @media (max-width: 760px) {
      .page { width: min(100vw - 20px, 1200px); padding: 14px 0 24px; }
      .hero-copy, .game-shell { padding: 22px; }
      .game-frame { min-height: 480px; }
    }
  </style>
</head>
<body>
${siteNav("ai", "cozy", "Cozy Builder")}
  <main class="page">
    <div class="hero">
      <section class="panel hero-copy">
        <span class="eyebrow">Shared game</span>
        <h1>Cozy Builder</h1>
        <p>
          One city-builder, two domains. Johnny can use the same Cozy Builder experience from both the AI site and the mowing site,
          so the game stays in one place and the links stay clean.
        </p>

        <div class="hero-actions">
          <a class="button button-primary" href="/godot-playtest/" target="_blank" rel="noopener">Open full game</a>
          <a class="button button-secondary" href="/">Back home</a>
        </div>

        <div class="info-card">
          <h2>How we wired it</h2>
          <p>
            This page is shared across both websites and simply launches the same Godot web export. That means one game build,
            one update path, and matching access from both domains.
          </p>
        </div>

        <div class="feature-grid">
          <div class="info-card">
            <h2>For justaskjohnny.com</h2>
            <p>The Cozy Builder link lives beside chatbots, contact, and the AI service pages.</p>
          </div>
          <div class="info-card">
            <h2>For 618help.com</h2>
            <p>The same link works from the mowing side so both sites can send people to the same game.</p>
          </div>
        </div>
      </section>

      <section class="panel game-shell">
        <h2>Play it here</h2>
        <p>Use the embedded version below, or open the full game in a new tab if you want the native game experience.</p>
        <div class="game-frame">
          <iframe src="/godot-playtest/" title="Cozy Builder game" loading="lazy"></iframe>
        </div>
        <div class="link-row">
          <a class="button button-secondary" href="/chatbots/">AI site</a>
          <a class="button button-secondary" href="/help-mowing/">Mowing site</a>
          <a class="button button-secondary" href="/contact/">Contact</a>
        </div>
      </section>
    </div>
  </main>
</body>
</html>`;
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

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 24px;
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
${siteNav("ai", "contact", "Johnny")}
  <main class="page">
    <div class="profile-badge" data-profile-badge>Contact Johnny</div>
    <div class="hero">
      <section class="panel hero-copy">
        <span class="eyebrow" data-eyebrow>Contact Form</span>
        <h1 data-title>Tell Johnny what you need.</h1>
        <p data-lead>
          Use this form for mowing quotes, service questions, or a custom AI / website project.
          Pictures and screenshots are welcome if they help explain the job.
        </p>

        <div class="hero-actions">
          <a class="button button-primary" href="/chatbots/">See the AI side</a>
          <a class="button button-secondary" href="/help-mowing/">See mowing</a>
        </div>

        <div class="info-card">
          <h2>What to include</h2>
          <ul class="checklist" data-checklist>
            <li>Your name and best contact info.</li>
            <li>What you need help with and when you want to start.</li>
            <li>Photos, screenshots, or yard pictures if they help.</li>
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
      const apiBase = String(window.JOHNNY_CONTACT_API_BASE_URL || "https://johnny-chat.onrender.com").replace(/\/+$/, "");

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

      profileField.value = profile;
      pageUrlField.value = window.location.href;

      if (isMowing) {
        badge.textContent = "Mowing contact form";
        eyebrow.textContent = "Mowing contact";
        title.textContent = "Tell us about the yard.";
        lead.textContent = "Use this form for mowing quotes, service questions, or photos of the property if they help explain the job.";
        goodToKnow.textContent = "If you’re not sure about the area, accessibility, or property details, just tell us what you know and we’ll sort it out.";
        checklist.innerHTML = [
          "<li>How big the property is, and whether it is flat or hilly.</li>",
          "<li>Any trees, fences, gates, or other obstacles.</li>",
          "<li>What days or timing work best for you.</li>"
        ].join("");
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
      }

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
  aiPage = insertAfterBodyOpen(aiPage, siteNav("ai", "chatbots"));
  aiPage = insertBeforeBodyEnd(aiPage, widgetSnippet("ai"));

  await mkdir(path.join(publicDir, "chatbots"), { recursive: true });
  await mkdir(path.join(publicDir, "help-mowing"), { recursive: true });
  await mkdir(path.join(publicDir, "contact"), { recursive: true });
  await mkdir(path.join(publicDir, "cozy-builder"), { recursive: true });

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
  await writeFile(path.join(publicDir, "contact", "index.html"), createContactPage(), "utf8");
  await writeFile(path.join(publicDir, "cozy-builder", "index.html"), createCozyBuilderPage(), "utf8");
  await writeFile(path.join(publicDir, "index.html"), createRootRedirectPage(), "utf8");

  console.log("Pages build files generated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
