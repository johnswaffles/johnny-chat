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
    :root { color-scheme: dark; --ink: #fbf8ff; --copy: #aaa3b8; --line: rgba(255,255,255,.11); --plum: #bca2ef; --coral: #efad9c; }
    * { box-sizing: border-box; }
    html, body { min-height: 100%; }
    body { margin: 0; min-height: 100vh; color: var(--ink); background: #181725; font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif; overflow-x: hidden; }
    body::before { content: ""; position: fixed; inset: 0; opacity: .04; pointer-events: none; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitchTiles'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
    .access-shell { position: relative; min-height: 100vh; display: grid; grid-template-columns: minmax(0,1.12fr) minmax(420px,.88fr); overflow: hidden; }
    .access-shell::before { content: ""; position: absolute; width: 680px; height: 680px; left: -270px; top: -370px; border: 1px solid rgba(188,162,239,.13); border-radius: 50%; box-shadow: 0 0 0 90px rgba(188,162,239,.025), 0 0 0 180px rgba(188,162,239,.015); }
    .story-side { position: relative; min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between; padding: clamp(28px,5vw,76px); background: radial-gradient(circle at 16% 10%, rgba(139,102,202,.26), transparent 30%), radial-gradient(circle at 80% 90%, rgba(221,118,95,.13), transparent 32%), linear-gradient(145deg,#211e32,#15141f); }
    .brand { position: relative; z-index: 2; display: flex; align-items: center; gap: 12px; color: inherit; text-decoration: none; }
    .brand-mark { width: 46px; height: 46px; display: grid; place-items: center; border: 1px solid var(--line); border-radius: 15px; background: rgba(255,255,255,.06); box-shadow: inset 0 1px rgba(255,255,255,.1); }
    .brand-mark svg { width: 27px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .brand span { display: grid; gap: 2px; }
    .brand small { color: rgba(255,255,255,.46); font-size: 9px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
    .brand strong { font: 600 22px/1 Georgia,serif; }
    .story-copy { position: relative; z-index: 2; max-width: 700px; margin: 80px 0; }
    .eyebrow { color: var(--coral); font-size: 10px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
    .story-copy h1 { max-width: 670px; margin: 18px 0 20px; font: 600 clamp(52px,6.4vw,92px)/.93 Georgia,serif; letter-spacing: -.055em; }
    .story-copy h1 em { color: var(--plum); font-weight: 500; }
    .story-copy > p { max-width: 580px; margin: 0; color: var(--copy); font-size: clamp(15px,1.5vw,18px); line-height: 1.7; }
    .promise-row { display: flex; flex-wrap: wrap; gap: 20px; margin-top: 30px; }
    .promise { display: flex; align-items: center; gap: 8px; color: rgba(255,255,255,.58); font-size: 11px; font-weight: 700; }
    .promise i { width: 25px; height: 25px; display: grid; place-items: center; color: var(--plum); border: 1px solid rgba(188,162,239,.22); border-radius: 8px; background: rgba(188,162,239,.07); font-style: normal; }
    .story-footer { position: relative; z-index: 2; color: rgba(255,255,255,.32); font-size: 10px; }
    .login-side { position: relative; min-height: 100vh; display: grid; place-items: center; padding: 32px; background: #f4f0e9; }
    .login-side::before { content: ""; position: absolute; inset: 0; opacity: .28; background-image: linear-gradient(rgba(78,61,111,.045) 1px, transparent 1px), linear-gradient(90deg,rgba(78,61,111,.045) 1px,transparent 1px); background-size: 38px 38px; mask-image: linear-gradient(135deg,#000,transparent 76%); }
    .card { position: relative; z-index: 2; width: min(430px,100%); padding: clamp(28px,4vw,44px); color: #282332; border: 1px solid #e0d8ce; border-radius: 24px; background: rgba(255,253,249,.94); box-shadow: 0 34px 100px rgba(38,28,48,.16); }
    .lock-mark { width: 52px; height: 52px; display: grid; place-items: center; color: #6550a4; border: 1px solid #d8ccec; border-radius: 17px; background: #f0eaf9; }
    .lock-mark svg { width: 24px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    .card .eyebrow { display: block; margin-top: 24px; color: #725baf; }
    .card h2 { margin: 10px 0 10px; font: 600 38px/1 Georgia,serif; letter-spacing: -.035em; }
    .card > p { margin: 0; color: #746d7c; font-size: 13px; line-height: 1.6; }
    form { margin-top: 25px; display: grid; gap: 14px; }
    label { display: grid; gap: 8px; color: #5f5868; font-size: 10px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
    input { width: 100%; min-height: 52px; padding: 0 15px; color: #282332; border: 1px solid #d9d0c5; border-radius: 13px; outline: none; background: #fff; font: 500 16px Inter,system-ui,sans-serif; }
    input:focus { border-color: #a994d7; box-shadow: 0 0 0 4px rgba(101,80,164,.09); }
    button { min-height: 52px; margin-top: 2px; color: #fff; border: 1px solid #4c397f; border-radius: 13px; background: linear-gradient(135deg,#735db3,#503d88); box-shadow: 0 12px 28px rgba(80,61,136,.22), inset 0 1px rgba(255,255,255,.22); font: 800 13px Inter,system-ui,sans-serif; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease; }
    button:hover { transform: translateY(-2px); box-shadow: 0 16px 32px rgba(80,61,136,.28), inset 0 1px rgba(255,255,255,.22); }
    .private-note { display: flex; align-items: center; gap: 8px; margin-top: 18px; color: #9a929e; font-size: 10px; }
    .private-note svg { width: 14px; fill: none; stroke: #6f5aa9; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .error { margin: 0; padding: 11px 12px; color: #8f3d45; border: 1px solid #eac9ca; border-radius: 10px; background: #fae8e8; font-size: 11px; font-weight: 700; line-height: 1.45; }
    @media (max-width: 860px) { .access-shell { grid-template-columns: 1fr; } .story-side { min-height: auto; padding: 28px 24px 45px; } .story-copy { margin: 70px 0 40px; } .story-copy h1 { font-size: clamp(48px,14vw,72px); } .story-footer { display: none; } .login-side { min-height: auto; padding: 55px 20px 75px; } }
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
        <p>A private fiction workspace where you can direct a complete manuscript edit while the model carries voice, continuity, and story momentum across the whole draft.</p>
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
        <p>Use the same password as your private GPT 5.6 workspace.</p>
        <form method="post">
          <label>Password <input type="password" name="password" autocomplete="current-password" autofocus required></label>
          <button type="submit">Enter the writing studio</button>
          ${errorHtml}
        </form>
        <div class="private-note"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>Secure, password-protected workspace</div>
      </div>
    </section>
  </main>
</body>
</html>`;
}

export async function onRequest(context) {
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
