const LOCAL_GZ_URL = "/sim/index.wasm.gz";

async function proxySimWasm(baseUrl) {
  const response = await fetch(new URL(LOCAL_GZ_URL, baseUrl));
  if (!response.ok) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("Content-Type", "application/wasm");
  headers.set("Content-Encoding", "gzip");
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  headers.delete("Content-Length");

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

export async function onRequest(context) {
  return proxySimWasm(context.request.url);
}
