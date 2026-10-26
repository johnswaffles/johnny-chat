const SESSION_COOKIE_NAME = "gpt54_session";
const COOKIE_MAX_AGE = 60 * 60 * 12;
const DEFAULT_BACKEND_URL = "https://johnny-chat.onrender.com";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseCookies(cookieHeader) {
  return String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const index = part.indexOf("=");
      if (index === -1) return acc;
      const name = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      try {
        acc[name] = decodeURIComponent(value);
      } catch {
        acc[name] = value;
      }
      return acc;
    }, {});
}

function backendUrl(context) {
  return String(context.env?.JOHNNY_CHAT_BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/+$/, "");
}

async function requestBackend(context, path, body) {
  const response = await fetch(`${backendUrl(context)}${path}`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body || {})
  });
  const data = await response.json().catch(() => ({}));
  return {
    ok: response.ok && data?.ok === true,
    status: response.status,
    data
  };
}

async function verifySession(context, token) {
  if (!token) return false;
  const result = await requestBackend(context, "/api/chatbot-session", { token }).catch(() => null);
  return result?.ok === true;
}

function sessionCookie(token, maxAge = COOKIE_MAX_AGE) {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${Number(maxAge) || COOKIE_MAX_AGE}; SameSite=Lax; Secure`;
}

function expiredSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;
}

function loginPage(errorMessage = "") {
  const errorHtml = errorMessage
    ? `<p class="error" role="alert">${escapeHtml(errorMessage)}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#181725">
  <title>Story Editor Access</title>
  <style>
    :root { color-scheme: dark; --ink: #f7f3ed; --copy: #ccc4d0; --line: rgba(255,255,255,.14); --plum: #d3bfdf; --coral: #d8c3af; }
    * { box-sizing: border-box; }
    html, body { min-height: 100%; }
    body { margin: 0; min-height: 100vh; color: var(--ink); background: #181725; font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif; overflow-x: hidden; }
    body::before { content: ""; position: fixed; inset: 0; opacity: .018; pointer-events: none; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitchTiles'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
    .access-shell { position: relative; min-height: 100vh; display: grid; grid-template-columns: minmax(0,1.12fr) minmax(420px,.88fr); overflow: hidden; }
    .access-shell::before { content: ""; position: absolute; width: 680px; height: 680px; left: -270px; top: -370px; border: 1px solid rgba(188,162,239,.13); border-radius: 50%; box-shadow: 0 0 0 90px rgba(188,162,239,.025), 0 0 0 180px rgba(188,162,239,.015); }
    .story-side { position: relative; min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between; padding: clamp(28px,5vw,76px); background: radial-gradient(circle at 16% 10%, rgba(139,102,202,.12), transparent 30%), radial-gradient(circle at 80% 90%, rgba(221,118,95,.06), transparent 32%), linear-gradient(145deg,#211e32,#15141f); }
    .brand { position: relative; z-index: 2; display: flex; align-items: center; gap: 12px; color: inherit; text-decoration: none; }
    .brand-mark { width: 46px; height: 46px; display: grid; place-items: center; border: 1px solid var(--line); border-radius: 15px; background: rgba(255,255,255,.06); box-shadow: inset 0 1px rgba(255,255,255,.1); }
    .brand-mark svg { width: 27px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .brand span { display: grid; gap: 2px; }
    .brand small { color: #c5bdca; font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
    .brand strong { font: 600 22px/1 Georgia,serif; }
    .story-copy { position: relative; z-index: 2; max-width: 700px; margin: 80px 0; }
    .eyebrow { color: var(--coral); font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
    .story-copy h1 { max-width: 670px; margin: 18px 0 20px; font: 500 clamp(48px,5.7vw,80px)/1.04 Georgia,serif; letter-spacing: -.045em; }
    .story-copy h1 em { color: var(--plum); font-weight: 500; }
    .story-copy > p { max-width: 580px; margin: 0; color: var(--copy); font-size: clamp(15px,1.5vw,18px); line-height: 1.7; }
    .promise-row { display: flex; flex-wrap: wrap; gap: 20px; margin-top: 30px; }
    .promise { display: flex; align-items: center; gap: 8px; color: #d4ccd8; font-size: 12px; font-weight: 700; }
    .promise i { width: 25px; height: 25px; display: grid; place-items: center; color: var(--plum); border: 1px solid rgba(188,162,239,.22); border-radius: 8px; background: rgba(188,162,239,.07); font-style: normal; }
    .story-footer { position: relative; z-index: 2; color: #b9afc0; font-size: 12px; }
    .login-side { position: relative; min-height: 100vh; display: grid; place-items: center; padding: 32px; background: #f3f0e9; color-scheme: light; }
    .login-side::before { content: ""; position: absolute; inset: 0; opacity: .12; background-image: linear-gradient(rgba(78,61,111,.045) 1px, transparent 1px), linear-gradient(90deg,rgba(78,61,111,.045) 1px,transparent 1px); background-size: 38px 38px; mask-image: linear-gradient(135deg,#000,transparent 76%); }
    .card { position: relative; z-index: 2; width: min(430px,100%); padding: clamp(28px,4vw,44px); color: #282332; border: 1px solid #e0d8ce; border-radius: 20px; background: #fffdf8; box-shadow: 0 18px 54px rgba(38,28,48,.08); }
    .lock-mark { width: 52px; height: 52px; display: grid; place-items: center; color: #65516e; border: 1px solid #ddd4df; border-radius: 15px; background: #f1edf2; }
    .lock-mark svg { width: 24px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    .card .eyebrow { display: block; margin-top: 24px; color: #69516f; }
    .card h2 { margin: 10px 0 10px; font: 600 38px/1 Georgia,serif; letter-spacing: -.035em; }
    .card > p { margin: 0; color: #665e68; font-size: 15px; line-height: 1.6; }
    form { margin-top: 25px; display: grid; gap: 14px; }
    label { display: grid; gap: 8px; color: #514951; font-size: 14px; font-weight: 600; }
    input { width: 100%; min-height: 52px; padding: 0 15px; color: #282332; border: 1px solid #d9d0c5; border-radius: 13px; outline: none; background: #fff; font: 500 16px Inter,system-ui,sans-serif; }
    input:focus { border-color: #776180; box-shadow: 0 0 0 4px rgba(101,80,164,.09); }
    button[type="submit"] { min-height: 52px; margin-top: 2px; color: #fff; border: 1px solid #69516f; border-radius: 13px; background: #69516f; box-shadow: 0 5px 14px rgba(80,61,136,.1); font: 600 15px Inter,system-ui,sans-serif; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease; }
    button[type="submit"]:hover { background: #594360; }
    button:focus-visible, a:focus-visible { outline: 3px solid #967a9c; outline-offset: 4px; }
    .password-field { position: relative; }
    .password-field input { padding-right: 78px; }
    .password-toggle { position: absolute; top: 5px; bottom: 5px; right: 6px; min-width: 62px; padding: 0 10px; color: #5f4668; border: 0; border-radius: 8px; background: transparent; font: 600 14px Inter,system-ui,sans-serif; cursor: pointer; }
    .password-toggle:hover { background: #f1edf2; }
    .password-toggle[hidden] { display: none; }
    .private-note { display: flex; align-items: center; gap: 8px; margin-top: 18px; color: #6d636e; font-size: 12px; line-height: 1.5; }
    .private-note svg { width: 14px; fill: none; stroke: #6f5aa9; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .error { margin: 0; padding: 11px 12px; color: #8f3d45; border: 1px solid #eac9ca; border-radius: 10px; background: #fae8e8; font-size: 14px; font-weight: 500; line-height: 1.5; }
    @media (max-width: 860px) { .access-shell { grid-template-columns: 1fr; align-content: start; background: #f3f0e9; } .story-side { min-height: auto; padding: 24px 24px 26px; } .brand-mark { width: 38px; height: 38px; border-radius: 12px; } .brand strong { font-size: 22px; } .story-copy { margin: 25px 0 0; } .story-copy > .eyebrow, .story-copy > p, .promise-row, .story-footer { display: none; } .story-copy h1 { margin: 0; font-size: clamp(31px,8.3vw,45px); line-height: 1.08; letter-spacing: -.035em; } .login-side { min-height: auto; padding: 24px 20px 36px; } .card { padding: 25px; border-radius: 16px; } .lock-mark { display: none; } .card .eyebrow { margin-top: 0; } .card h2 { font-size: 32px; } }
    @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
  </style>
</head>
<body>
  <main class="access-shell">
    <section class="story-side">
      <a class="brand" href="https://justaskjohnny.com" aria-label="Go to justaskjohnny.com">
        <span class="brand-mark"><svg viewBox="0 0 36 36" aria-hidden="true"><path d="M9 27c8-1 14-7 18-18-11 4-17 10-18 18Z"/><path d="M11 25c4-4 8-8 14-12"/></svg></span>
        <span><small>Johnny's writing studio</small><strong>Story Editor</strong></span>
      </a>
      <div class="story-copy">
        <span class="eyebrow">A quiet room for better stories</span>
        <h1>Keep your voice.<br><em>Strengthen every line.</em></h1>
        <p>Bring in your manuscript, choose what to improve, and shape the next draft together. Work on a passage, a chapter, or the whole story. Your original stays preserved.</p>
        <div class="promise-row">
          <span class="promise"><i>✓</i>Your draft stays private</span>
          <span class="promise"><i>✓</i>Original draft stays preserved</span>
        </div>
      </div>
      <div class="story-footer">justaskjohnny.com · Private creative tools</div>
    </section>
    <section class="login-side">
      <div class="card">
        <div class="lock-mark"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></div>
        <span class="eyebrow">Private access</span>
        <h2>Welcome back.</h2>
        <p id="access-help">Enter your private workspace password.</p>
        <form method="post">
          <label for="workspace-password">Password</label>
          <div class="password-field"><input id="workspace-password" type="password" name="password" autocomplete="current-password" aria-describedby="access-help" required><button id="password-toggle" class="password-toggle" type="button" aria-controls="workspace-password" aria-label="Show password" aria-pressed="false" hidden>Show</button></div>
          <button type="submit">Open Story Editor</button>
          ${errorHtml}
        </form>
        <div class="private-note"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>Secure, password-protected workspace</div>
      </div>
    </section>
  </main>
  <script>
    (() => {
      const input = document.getElementById('workspace-password');
      const toggle = document.getElementById('password-toggle');
      toggle.hidden = false;
      toggle.addEventListener('click', () => {
        const visible = input.type === 'password';
        input.type = visible ? 'text' : 'password';
        toggle.textContent = visible ? 'Hide' : 'Show';
        toggle.setAttribute('aria-pressed', String(visible));
        toggle.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
      });
    })();
  </script>
</body>
</html>`;
}

async function serveStoryEditor(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const cookies = parseCookies(request.headers.get("cookie"));

  if (request.method === "GET" && url.searchParams.get("reauth") === "1") {
    return new Response(loginPage(), {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Set-Cookie": expiredSessionCookie()
      }
    });
  }

  if (await verifySession(context, cookies[SESSION_COOKIE_NAME])) {
    return next();
  }

  if (request.method === "POST") {
    const form = await request.formData().catch(() => null);
    const password = String(form?.get("password") || "");
    const access = await requestBackend(context, "/api/chatbot-access", { password }).catch(() => null);
    if (access?.ok && access.data?.token) {
      url.searchParams.delete("reauth");
      return new Response(null, {
        status: 303,
        headers: {
          Location: url.toString(),
          "Cache-Control": "no-store",
          "Set-Cookie": sessionCookie(access.data.token, access.data.maxAge)
        }
      });
    }
    return new Response(loginPage("That password was not correct. Please try again."), {
      status: 401,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
    });
  }

  return new Response(loginPage(), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
  });
}

// Public release metadata verifies deployment without unlocking any manuscript.
export async function onRequest(context) {
  const response = await serveStoryEditor(context);
  const marked = new Response(response.body, response);
  marked.headers.set("X-Story-Editor-Chapters", "reviewed-passage-splits-v2");
  marked.headers.set("X-Story-Editor-Reader", "chapter-reader-marin-async-v2");
  marked.headers.set("X-Story-Editor-Studio", "layered-literary-studio-v1");
  marked.headers.set("X-Story-Editor-Notebook", "compact-setup-v1");
  marked.headers.set("X-Story-Editor-Prompts", "lossless-prompts-v1");
  marked.headers.set("X-Story-Editor-Workspace", "start-over-preserve-library-v1");
  marked.headers.set("X-Story-Editor-Progress", "saved-sections-provider-tracker-v1");
  marked.headers.set("X-Story-Editor-Session-Recovery", "explicit-unlock-preserve-work-v1");
  marked.headers.set("X-Story-Editor-Read-Lock", "single-flight-loading-v1");
  marked.headers.set("X-Story-Editor-Navigation", "chapter-file-tree-v1");
  marked.headers.set("X-Story-Editor-Narration", "realtime-paragraph-voice-v1");
  marked.headers.set("X-Story-Editor-Comfort", "review-and-reading-comfort-v1");
  marked.headers.set("X-Story-Editor-Assistant", "Mara");
  marked.headers.set("X-Story-Editor-Book-Drafts", "versioned-chapter-canon-v1");
  marked.headers.set("X-Story-Editor-Quality", "gpt-6.1-sol-pro-xhigh");
  marked.headers.set("X-Story-Editor-Provider", "durable-background-responses-v1");
  return marked;
}
