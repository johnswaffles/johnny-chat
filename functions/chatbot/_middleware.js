const SESSION_COOKIE_NAME = "gpt54_session";
const LEGACY_COOKIE_NAME = "gpt54_access";
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

async function requestAccess(context, password) {
  return requestBackend(context, "/api/chatbot-access", { password });
}

function sessionCookie(token, maxAge = COOKIE_MAX_AGE) {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/chatbot/; Max-Age=${Number(maxAge) || COOKIE_MAX_AGE}; SameSite=Lax; Secure`;
}

function clearLegacyCookie() {
  return `${LEGACY_COOKIE_NAME}=; Path=/chatbot/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`;
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
  <title>GPT 5.5 Access</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #070b11;
      --panel: rgba(255, 255, 255, 0.08);
      --line: rgba(255, 255, 255, 0.12);
      --ink: #eff3f7;
      --copy: rgba(233, 240, 247, 0.72);
      --accent: #66e6b1;
      --shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 12% 12%, rgba(102, 230, 177, 0.18), transparent 22%),
        radial-gradient(circle at 86% 10%, rgba(118, 184, 255, 0.16), transparent 20%),
        radial-gradient(circle at 50% 100%, rgba(157, 124, 255, 0.1), transparent 24%),
        linear-gradient(180deg, var(--bg) 0%, #0d1320 48%, #06090f 100%);
      padding: 24px;
    }

    .card {
      width: min(460px, 100%);
      padding: 28px;
      border: 1px solid var(--line);
      border-radius: 28px;
      background: linear-gradient(180deg, rgba(14, 19, 30, 0.92), rgba(7, 10, 16, 0.96));
      backdrop-filter: blur(24px) saturate(160%);
      box-shadow: var(--shadow);
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(102, 230, 177, 0.08);
      color: var(--accent);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    h1 {
      margin: 18px 0 8px;
      font-size: clamp(28px, 4vw, 38px);
      line-height: 1.04;
      letter-spacing: -0.05em;
    }

    p {
      margin: 0;
      color: var(--copy);
      line-height: 1.6;
    }

    form {
      margin-top: 20px;
      display: grid;
      gap: 14px;
    }

    label {
      display: grid;
      gap: 8px;
      font-size: 14px;
      font-weight: 700;
      color: var(--ink);
    }

    input {
      width: 100%;
      min-height: 48px;
      padding: 0 16px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.05);
      color: var(--ink);
      font: inherit;
      outline: none;
    }

    input:focus {
      border-color: rgba(102, 230, 177, 0.42);
      box-shadow: 0 0 0 4px rgba(102, 230, 177, 0.12);
    }

    button {
      min-height: 48px;
      border: none;
      border-radius: 999px;
      background: linear-gradient(135deg, #66e6b1, #76b8ff);
      color: #081018;
      font: inherit;
      font-weight: 800;
      cursor: pointer;
    }

    .error {
      margin-top: 14px;
      color: #ffb9b9;
      font-weight: 700;
    }

    .fine-print {
      margin-top: 14px;
      font-size: 13px;
      color: rgba(233, 240, 247, 0.56);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="eyebrow">GPT 5.5</div>
    <h1>Enter the access password</h1>
    <p>This page is private.</p>
    <form method="post">
      <label>
        Password
        <input type="password" name="password" autocomplete="current-password" autofocus>
      </label>
      <button type="submit">Unlock GPT 5.5</button>
    </form>
    ${errorHtml}
    <div class="fine-print">If you need access, use the password you were given.</div>
  </div>
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
    const access = await requestAccess(context, password).catch(() => null);

    if (access?.ok && access.data?.token) {
      const headers = new Headers({
        Location: url.toString(),
        "Cache-Control": "no-store"
      });
      headers.append("Set-Cookie", sessionCookie(access.data.token, access.data.maxAge));
      headers.append("Set-Cookie", clearLegacyCookie());
      return new Response(null, {
        status: 303,
        headers
      });
    }

    const message = access?.status === 503
      ? "Private chatbot access is not configured yet."
      : "That password was not correct. Please try again.";

    return new Response(loginPage(message), {
      status: 401,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }

  return new Response(loginPage(), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
