const CHATBOT_PASSWORD = "ilovepizza";

function unauthorized() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Johnny Chat", charset="UTF-8"',
      "Cache-Control": "no-store"
    }
  });
}

function parseBasicAuth(header) {
  if (!header || !header.toLowerCase().startsWith("basic ")) return null;

  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");
    if (separator === -1) return null;
    return {
      user: decoded.slice(0, separator),
      pass: decoded.slice(separator + 1)
    };
  } catch {
    return null;
  }
}

export async function onRequest(context) {
  const auth = parseBasicAuth(context.request.headers.get("Authorization"));
  if (!auth || auth.pass !== CHATBOT_PASSWORD) {
    return unauthorized();
  }

  return context.next();
}
