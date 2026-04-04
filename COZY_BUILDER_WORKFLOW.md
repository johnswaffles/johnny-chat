# Cozy Builder Workflow

Cozy Builder is hosted from the Cloudflare website repo at `/cozy-builder/`, but the Godot source stays separate.

## Source Of Truth

- Godot source project: `/Users/johnshopinski/Documents/New project/cozy-builder-godot`
- Exported web build artifact: `/Users/johnshopinski/Documents/New project/public/godot-playtest`
- Live website repo: `/Users/johnshopinski/Documents/New project/johnny-chat`

## How The Website Build Works

`scripts/build-pages.mjs` copies the exported web build from:

- `/Users/johnshopinski/Documents/New project/public/godot-playtest`

into:

- `/Users/johnshopinski/Documents/New project/johnny-chat/public/cozy-builder`

That means `/cozy-builder/` serves the actual Godot export directly from Cloudflare Pages.

If the local export source folder is not available during a build, the generator leaves the committed `public/cozy-builder` files alone so Cloudflare can deploy from the repo alone.

## Future Update Workflow

1. Update the game in `/Users/johnshopinski/Documents/New project/cozy-builder-godot`.
2. Export the web build to `/Users/johnshopinski/Documents/New project/public/godot-playtest`.
3. From the website repo, run the Pages build generator so it syncs the latest export into `public/cozy-builder`.
4. Verify `/public/cozy-builder/index.html`, `index.js`, `index.wasm`, and `index.pck` were refreshed.
5. Commit and push `johnny-chat`.
6. Let Cloudflare Pages deploy the new build.

## Important Notes

- Do not copy the Godot source project into `johnny-chat`.
- Do not replace `/cozy-builder/` with a promo wrapper or iframe page.
- Treat the exported web build as the only website integration artifact.
