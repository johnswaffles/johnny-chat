# First Ember Integration

## Paths

- Godot source: `/Users/johnshopinski/Documents/New project/first-ember-godot`
- Local Web export: `/Users/johnshopinski/Documents/New project/first-ember-godot/build/web`
- Website artifacts: `/Users/johnshopinski/Documents/New project/johnny-chat/public/first-ember`
- Public route: `https://justaskjohnny.com/first-ember/`
- Render package: `https://johnny-chat.onrender.com/first-ember/index.pck?v=<build-id>`

## Build behavior

`npm run build` copies the local export into `public/first-ember`, patches the WASM loader for gzip-safe loading, cache-busts `index.js`, and compresses `index.wasm` to `index.wasm.gz`. A normal build retains `index.pck` so the Render checkout can serve it.

When `CF_PAGES=1`, the build hashes `index.pck`, writes the Render URL into Godot's `mainPack` and `fileSizes` configuration, then removes the local PCK from the Pages output. The 12-character SHA-256 prefix is a deterministic build identifier and query-string cache key.

## CORS and compression

Render's existing middleware reflects the request origin and permits GET, so Cloudflare Pages can fetch the package cross-origin. The PCK is served uncompressed as `application/octet-stream`. WASM is gzip-compressed and the Pages middleware maps `/first-ember/index.wasm` to `/first-ember/index.wasm.gz` with the required response headers.

## Rollback

Restore the prior `public/first-ember` artifacts plus the prior integration-file revisions from Git, run the normal build, verify the prior PCK hash/build ID, then deploy only with separate authorization. Never roll back Cozy Builder or Sim files as part of a First Ember rollback.

## Validation commands

```sh
cd "/Users/johnshopinski/Documents/New project/first-ember-godot"
"/Users/johnshopinski/Downloads/Godot.app/Contents/MacOS/Godot" --headless --path . --export-release Web build/web/index.html

cd "/Users/johnshopinski/Documents/New project/johnny-chat"
npm run build
test -f public/first-ember/index.html
test -f public/first-ember/index.pck
test -f public/first-ember/index.wasm.gz
node --check scripts/build-pages.mjs
node --check server.js
```

For a Pages-mode validation, copy the repository to a disposable directory, run `CF_PAGES=1 npm run build`, then assert that the generated HTML contains the Render `mainPack` URL and that the Pages output no longer contains `index.pck`.
