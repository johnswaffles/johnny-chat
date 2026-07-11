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

function loginPage(errorMessage = "") {
  const errorHtml = errorMessage
    ? `<p class="error" role="alert">${escapeHtml(errorMessage)}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Story Editor Access</title>
  <style>
    :root { color-scheme: dark; --bg: #05060a; --panel: rgba(255,255,255,.08); --line: rgba(69,215,255,.18); --ink: #f4f7ff; --copy: #98a4bb; --accent: #45d7ff; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Inter, system-ui, sans-serif; color: var(--ink); background: radial-gradient(circle at 20% 12%, rgba(69,215,255,.18), transparent 24%), radial-gradient(circle at 84% 20%, rgba(169,140,255,.16), transparent 24%), linear-gradient(180deg, #10131d, var(--bg)); padding: 24px; }
    .card { width: min(460px, 100%); padding: 30px; border: 1px solid var(--line); border-radius: 24px; background: linear-gradient(180deg, rgba(20,22,27,.92), rgba(10,12,15,.96)); box-shadow: 0 24px 80px rgba(0,0,0,.45); }
    .eyebrow { color: var(--accent); font-size: 12px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
    h1 { margin: 14px 0 8px; font-size: 36px; line-height: 1; }
    p { margin: 0; color: var(--copy); line-height: 1.6; }
    form { margin-top: 20px; display: grid; gap: 14px; }
    label { display: grid; gap: 8px; font-weight: 800; }
    input { min-height: 48px; padding: 0 15px; border: 1px solid var(--line); border-radius: 14px; background: rgba(255,255,255,.06); color: var(--ink); font: inherit; }
    button { min-height: 48px; border: 0; border-radius: 999px; background: linear-gradient(135deg, #a9efff, #45d7ff); color: #031116; font: inherit; font-weight: 900; cursor: pointer; }
    .error { margin-top: 14px; color: #ffb9b9; font-weight: 800; }
  </style>
</head>
<body>
  <main class="card">
    <div class="eyebrow">Story Editor</div>
    <h1>Enter the access password</h1>
    <p>This fiction editing workspace uses the same private access as GPT 5.6.</p>
    <form method="post">
      <label>Password <input type="password" name="password" autocomplete="current-password" autofocus></label>
      <button type="submit">Unlock Story Editor</button>
    </form>
    ${errorHtml}
  </main>
</body>
</html>`;
}

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const cookies = parseCookies(request.headers.get("cookie"));

  if (await verifySession(context, cookies[SESSION_COOKIE_NAME])) {
    return next();
  }

  if (request.method === "POST") {
    const form = await request.formData().catch(() => null);
    const password = String(form?.get("password") || "");
    const access = await requestBackend(context, "/api/chatbot-access", { password }).catch(() => null);
    if (access?.ok && access.data?.token) {
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
