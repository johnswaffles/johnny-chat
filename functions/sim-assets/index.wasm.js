const RENDER_WASM_URL = "https://johnny-chat.onrender.com/sim/index.wasm";

async function proxySimWasm() {
  const response = await fetch(RENDER_WASM_URL);
  if (!response.ok) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("Content-Type", "application/wasm");
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  headers.delete("Content-Length");

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

export async function onRequest() {
  return proxySimWasm();
}
