const SESSION_COOKIE_NAME = "gpt54_session";
const DEFAULT_BACKEND_URL = "https://johnny-chat.onrender.com";

function parseCookies(cookieHeader) {
  return String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separator = part.indexOf("=");
      if (separator === -1) return cookies;
      const name = part.slice(0, separator).trim();
      const rawValue = part.slice(separator + 1).trim();
      try {
        cookies[name] = decodeURIComponent(rawValue);
      } catch {
        cookies[name] = rawValue;
      }
      return cookies;
    }, {});
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function backendUrl(context) {
  return String(context.env?.JOHNNY_CHAT_BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/+$/, "");
}

function upstreamHeaders(request, token) {
  const headers = new Headers(request.headers);
  headers.delete("cookie");
  headers.delete("host");
  headers.delete("content-length");
  headers.set("Accept", request.headers.get("Accept") || "application/json");
  headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

function responseHeaders(upstream) {
  const headers = new Headers();
  for (const name of ["content-type", "content-disposition", "content-length", "cache-control"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has("cache-control")) headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
}

export async function onRequest(context) {
  const { request } = context;
  const token = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE_NAME];
  if (!token) {
    return jsonResponse(401, { ok: false, error: "Private Story Editor access is required." });
  }

  const incomingUrl = new URL(request.url);
  const upstreamUrl = `${backendUrl(context)}${incomingUrl.pathname}${incomingUrl.search}`;
  const method = request.method.toUpperCase();
  const init = {
    method,
    headers: upstreamHeaders(request, token),
    redirect: "manual"
  };
  if (method !== "GET" && method !== "HEAD") init.body = request.body;

  try {
    const upstream = await fetch(upstreamUrl, init);
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders(upstream)
    });
  } catch {
    return jsonResponse(502, { ok: false, error: "The manuscript service is temporarily unavailable." });
  }
}
