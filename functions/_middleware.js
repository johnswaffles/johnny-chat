const WASM_ASSET_MAP = new Map([
  ["/cozy-builder/index.wasm", "/cozy-builder/index.wasm.gz"],
  ["/cozy-builder-game/index.wasm", "/cozy-builder-game/index.wasm.gz"],
  ["/godot-playtest/index.wasm", "/godot-playtest/index.wasm.gz"],
  ["/tiny-hero-quest/index.wasm", "/tiny-hero-quest/index.wasm.gz"],
]);

async function serveCompressedWasm(context, requestPath, compressedPath) {
  const assetUrl = new URL(context.request.url);
  assetUrl.pathname = compressedPath;
  assetUrl.search = "";

  const assetResponse = await context.env.ASSETS.fetch(assetUrl);
  if (!assetResponse.ok) {
    return assetResponse;
  }

  const headers = new Headers(assetResponse.headers);
  headers.set("Content-Type", "application/wasm");
  headers.set("Content-Encoding", "gzip");
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  headers.delete("Content-Length");

  return new Response(assetResponse.body, {
    status: assetResponse.status,
    headers,
  });
}

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  if (request.method === "GET" && WASM_ASSET_MAP.has(url.pathname)) {
    return serveCompressedWasm(context, url.pathname, WASM_ASSET_MAP.get(url.pathname));
  }

  return next();
}
