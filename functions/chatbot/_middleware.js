const CHATBOT_PASSWORD = "ilovepizza";
const COOKIE_NAME = "johnny_chatbot_gate";

function escapeHTML(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseCookies(header) {
  const cookies = {};
  String(header || "")
    .split(";")
    .forEach((pair) => {
      const idx = pair.indexOf("=");
      if (idx === -1) return;
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (name) cookies[name] = value;
    });
  return cookies;
}

function hasValidCookie(request) {
  const cookies = parseCookies(request.headers.get("Cookie"));
  return cookies[COOKIE_NAME] === "open";
}

function gateHTML(returnTo, error) {
  const safeReturnTo = escapeHTML(returnTo || "/chatbot/");
  const errorBlock = error
    ? `<div class="error" role="alert">${escapeHTML(error)}</div>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Johnny Chat Access</title>
  <style>
    :root{
      color-scheme: dark;
      --bg1:#070b11;
      --bg2:#0f1723;
      --panel:rgba(255,255,255,.08);
      --line:rgba(255,255,255,.14);
      --copy:rgba(255,255,255,.72);
      --ink:#fff;
      --accent:#74f0c6;
      --accent2:#77b8ff;
      --shadow:0 28px 90px rgba(0,0,0,.45);
    }
    *{box-sizing:border-box}
    html,body{min-height:100%;margin:0}
    body{
      font-family: "Plus Jakarta Sans", Arial, sans-serif;
      color:var(--ink);
      background:
        radial-gradient(circle at 15% 20%, rgba(116,240,198,.18), transparent 22%),
        radial-gradient(circle at 85% 10%, rgba(119,184,255,.18), transparent 18%),
        linear-gradient(180deg,var(--bg1),var(--bg2));
      display:grid;
      place-items:center;
      padding:20px;
    }
    .wrap{
      width:min(520px, 100%);
      border:1px solid var(--line);
      border-radius:28px;
      background:linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.05));
      backdrop-filter: blur(22px) saturate(180%);
      box-shadow:var(--shadow);
      padding:28px;
    }
    .eyebrow{
      display:inline-flex;
      align-items:center;
      gap:10px;
      min-height:32px;
      padding:0 14px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.12);
      background:rgba(255,255,255,.06);
      color:var(--accent);
      font-size:12px;
      font-weight:800;
      letter-spacing:.16em;
      text-transform:uppercase;
    }
    h1{
      margin:16px 0 10px;
      font-family: "Outfit", Arial, sans-serif;
      font-size:clamp(38px, 7vw, 58px);
      line-height:.94;
      letter-spacing:-.05em;
    }
    p{margin:0;color:var(--copy);line-height:1.7;font-size:16px}
    form{margin-top:20px;display:grid;gap:14px}
    label{
      font-size:13px;
      font-weight:800;
      letter-spacing:.06em;
      text-transform:uppercase;
      color:rgba(255,255,255,.8);
    }
    input{
      width:100%;
      min-height:52px;
      border-radius:16px;
      border:1px solid rgba(255,255,255,.14);
      background:rgba(255,255,255,.08);
      color:#fff;
      font:inherit;
      font-size:16px;
      padding:14px 16px;
      outline:none;
    }
    input:focus{
      border-color:rgba(116,240,198,.6);
      box-shadow:0 0 0 4px rgba(116,240,198,.12);
    }
    .actions{
      display:flex;
      align-items:center;
      gap:12px;
      flex-wrap:wrap;
      margin-top:4px;
    }
    button{
      min-height:48px;
      padding:0 18px;
      border-radius:999px;
      border:0;
      background:linear-gradient(135deg,var(--accent) 0%, var(--accent2) 100%);
      color:#041119;
      font:inherit;
      font-weight:900;
      cursor:pointer;
      box-shadow:0 14px 28px rgba(116,240,198,.18);
    }
    .hint{color:rgba(255,255,255,.54);font-size:13px;line-height:1.6}
    .error{
      margin-top:14px;
      padding:12px 14px;
      border-radius:14px;
      border:1px solid rgba(239,68,68,.35);
      background:rgba(239,68,68,.12);
      color:#ffd1d1;
      font-size:14px;
    }
    .footer{
      margin-top:18px;
      color:rgba(255,255,255,.45);
      font-size:12px;
      line-height:1.6;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="eyebrow">Johnny Chat Access</div>
    <h1>Enter the password to open the chatbot.</h1>
    <p>This page is locked so only invited visitors can reach the chatbot experience.</p>
    <form method="post">
      <input type="hidden" name="returnTo" value="${safeReturnTo}">
      <div>
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" autofocus required>
      </div>
      <div class="actions">
        <button type="submit">Open chat</button>
        <div class="hint">Hint: one password field only. No username.</div>
      </div>
      ${errorBlock}
    </form>
    <div class="footer">If you were sent here by mistake, go back and ask for access.</div>
  </div>
</body>
</html>`;
}

async function handlePost(request) {
  const form = await request.formData().catch(() => null);
  const password = String(form?.get("password") || "");
  const returnTo = String(form?.get("returnTo") || "/chatbot/");

  if (password !== CHATBOT_PASSWORD) {
    return new Response(gateHTML(returnTo, "That password did not work. Try again."), {
      status: 401,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }

  const headers = new Headers({
    "Cache-Control": "no-store",
    "Set-Cookie": `${COOKIE_NAME}=open; Path=/chatbot; Max-Age=604800; SameSite=Lax; Secure; HttpOnly`,
    "Location": returnTo || "/chatbot/"
  });

  return new Response(null, { status: 302, headers });
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  if (!url.pathname.startsWith("/chatbot")) {
    return context.next();
  }

  if (request.method === "POST") {
    return handlePost(request);
  }

  if (hasValidCookie(request)) {
    return context.next();
  }

  return new Response(gateHTML(url.pathname + url.search), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
