async function serveCompressedWasm(context, compressedPath) {
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
  return serveCompressedWasm(context, "/cozy-builder-game/index.wasm.gz");
}
