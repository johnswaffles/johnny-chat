# Mosswake Asset Upgrade Tracker

This is the persistent production record for Mosswake's replaceable visual library. The runtime keeps collision, AI, timing, camera, and room composition in `mosswake.js`; artwork is loaded through `assets/manifest.json` so a later generated replacement does not require gameplay rewrites.

## Status key

- **Integrated / tested** — the asset is loaded by the live renderer and has passed a gameplay smoke test.
- **Prepared** — production-formatted artwork exists, but it still needs runtime integration or a focused visual test.
- **Procedural fallback** — the renderer is intentionally using the current canvas treatment until the listed replacement is ready.

## Living characters

| Asset family | Current files | States / directions | Status | Next quality step |
| --- | --- | --- | --- | --- |
| Lantern Warden | `assets/player/warden-sheet-generated-v1.png`, `assets/player/warden-run-sheet-generated-v1.png` | Idle, 4-direction walk, sword, dash, hurt | Integrated / tested | Replace only if a higher-resolution sheet preserves the same feet anchor |
| Rowan | `assets/npcs/rowan-sheet-generated-v1.png` | Idle, walk, map work, talk/reaction | Integrated / tested | Add the remaining named NPC sheets using Rowan as the reference |
| Mossling | `assets/enemies/mossling-sheet-generated-v1.png` | Idle, skitter, pounce, hit recoil | Integrated / tested | Add the distinct thornback, wisp, and moth families |
| Hollow Guardian | `assets/bosses/hollow-guardian-sheet-generated-v1.png` | Phase I idle/attack, phase II transformed attack, phase-break, stagger, defeat | Integrated / tested | Keep the generated sheet as the boss reference; only refine if a focused arena review finds a real readability issue |

## High-value environment and effects queue

| Priority | Family | Current status | Recommended next action |
| --- | --- | --- | --- |
| 1 | Boss telegraph and defeat FX | Integrated / tested | Keep the atlas as the Guardian effect reference; only refine for a readability defect |
| 2 | Outdoor foliage | Integrated / tested | Keep the foliage atlas as the outdoor prop reference; add a second seasonal sheet only if a later visual review shows repetition |
| 3 | Dungeon architecture | Procedural room construction | Generate modular stone, roots, arches, statues, and rubble |
| 4 | Remaining NPCs and portraits | Procedural fallback except Rowan | Generate Tansy, Brindle, Lumen, and compact dialogue busts |

## Current iteration log

### 2026-08-13 — Outdoor foliage interaction family

- Generated `assets/plants/outdoor-foliage-interaction-generated-v1.png` as a 1248×1248 RGBA 4×4 atlas with meadow tufts, fern/reed clumps, flower and mushroom clusters, fallen logs, and tangled ivy bundles. The keyed RGB source remains beside it for future matte refinement.
- Added the `outdoor-foliage` manifest slot. Outdoor grass patches, individual tufts, flowers, logs, and breakable ivy now use the painted modular silhouettes with deterministic frame selection and small rustle animation; the existing procedural primitives remain the safe fallback.
- Preserved collision footprints, secret interactions, foreground layering, and ambient timing. Bumped the manifest and page cache keys to `manifest.json?v=11` and `mosswake.js?v=36`.
- Local syntax, manifest, RGBA/alpha, startup, asset-load, and outdoor gameplay smoke checks passed with no console warnings or errors. The public edge was still serving v35/v10 at handoff; verify v36/v11 after the hosting cache rolls forward.

### 2026-08-13 — Hollow Guardian telegraph and defeat FX

- Generated `assets/effects/guardian-telegraph-fx-generated-v1.png` as a 1248×1248 RGBA 6×4 atlas (208×312 cells) with rose/gold volley fans, expanding vine slam rings, dash-lane markers, Rootlight exposure cracks, phase-break shards, and green defeat motes. The keyed RGB source remains beside it for future matte refinement.
- Added the `boss-fx` manifest slot and progressive renderer hooks. Guardian volley, slam, dash, and rain windups now receive painted silhouettes; phase-break and boss defeat particles use the painted payoff frames. Procedural telegraph lines and particle shapes remain the safe fallback when the atlas is unavailable.
- Kept attack geometry, telegraph durations, hitboxes, cooldowns, camera shake, and sound unchanged. Corrected the 6×4 atlas frame mapping and bumped the manifest and page cache keys to `manifest.json?v=10` and `mosswake.js?v=35`.
- Corrected local syntax, manifest, RGBA/alpha, startup, asset-load, and console smoke checks passed. The public edge was still serving v34/v9 at handoff; verify v35/v10 after the hosting cache rolls forward.

### 2026-08-13 — Heartseed Sanctum arena kit

- Generated `assets/dungeon/heartseed-sanctum-kit-generated-v1.png` as a 4×4 transparent atlas with quiet, charged, rose-phase, and spent altar/pylon/ring states plus four modular sanctum details.
- Added the `sanctum-kit` manifest slot and progressive renderer hooks for the boss altar, four pylons, and four ring segments. Procedural drawing remains the fallback when the asset is unavailable.
- Kept combat geometry, telegraphs, arena coordinates, lighting, and boss timing unchanged; only the visual presentation layer now uses the painted kit.
- Bumped the page cache key to `mosswake.js?v=30` so the new renderer is fetched after deployment.
- Local syntax, manifest, alpha, startup, and console smoke checks passed. A live deployment check remains pending until the push completes.

### 2026-08-13 — Hollow Guardian sprite family

- Generated a consistent 4×4 boss sheet with a charcoal/moss phase, rose-heart phase, attack poses, phase-break reveal, stagger, and collapse.
- Prepared `hollow-guardian-sheet-generated-v1.png` as a 1248×1248 RGBA sheet with 312×312 cells; retained the chroma-key source beside it for future matte refinement.
- Added the `boss` manifest slot and phase-aware frame selection in `mosswake.js`. The old procedural boss remains the safe fallback if the sheet fails to load.
- Kept the procedural telegraphs, health bar, arena lighting, hit reactions, and particles independent from the sheet so combat behavior is unchanged.
- Local syntax and manifest validation passed. A live visual smoke test is still the next required check after deployment.

### 2026-08-13 — Lantern-blade combat FX

- Generated `assets/effects/lantern-blade-fx-generated-v1.png` as a 1248×1248 RGBA atlas (4×4 cells at 312×312) with four sequential gold sword-sweep frames, four directional contact variants, four mint/gold impact frames, and four rose/mint phase or Rootlight frames. The keyed RGB source remains beside it for future matte refinement.
- Added `fx-slash` and `fx-impact` manifest slots pointing to the same replaceable atlas. The renderer now uses the first four painted frames for each sword strike and the last four frames for the Moonwake Lantern pulse; procedural arcs remain the safe fallback if the sheet is unavailable.
- Kept combat timing, hitboxes, cooldowns, audio, and collision unchanged. Direction is still driven by the player attack vector, so the painted slash works for all eight aim directions without duplicating gameplay logic.
- Bumped the manifest and page cache keys to versions 6 and 31. Local syntax, RGBA/alpha, startup, and browser smoke checks should be rerun after deployment.

### 2026-08-13 — Water and shoreline family

- Generated `assets/terrain/water-surface-generated-v1.png` as a 1248×1248 RGB 4×4 atlas with sixteen cool teal water phases, layered ripples, and restrained parchment reflection streaks.
- Generated `assets/terrain/shoreline-overlays-generated-v1.png` as a 1248×624 RGBA 4×2 atlas with straight, corner, rocky, reed, and quiet foam shoreline variants. The keyed RGB source remains beside it for future matte refinement.
- Added `water-surface` and `shoreline` manifest slots. Pond, small pond, and flooded-vault surfaces now draw the painted atlas first while retaining the procedural ripples, clipping, outlines, and fallback when an image has not loaded.
- Kept collision rectangles, deep-water damage, room geometry, and water timing unchanged. Bumped the manifest and page cache keys to `manifest.json?v=7` and `mosswake.js?v=32`.
- Local syntax, manifest, image dimensions, alpha, startup, and visual browser smoke checks remain to be run after this integration.

### 2026-08-13 — Layered tree family

- Generated `assets/trees/lanternwood-tree-family-generated-v1.png` as a 1248×1248 RGBA 4×4 atlas with four sway poses each for a restrained back canopy, mature midground tree, larger foreground tree, and ancient-root variant. The keyed RGB source remains beside it for future matte refinement.
- Added `tree-back`, `tree-mid`, and `tree-front` manifest slots pointing to the same replaceable family sheet. Existing `drawTree` calls now choose the appropriate four-frame row by layer while preserving authored tree variants, ground anchors, runtime shadows, and procedural fallback.
- Kept tree placement, collision, camera layering, and ambient motion unchanged. Bumped the manifest and page cache keys to `manifest.json?v=8` and `mosswake.js?v=33`.
- Local syntax, manifest, alpha, startup, visual browser smoke, and console checks passed after this integration.

## Production contract

- Use orthographic top-down with a gentle 3/4 read, warm parchment highlights, moonlit teal shadows, deep-moss edge restraint, and upper-left lighting.
- Keep transparent assets free of baked cast shadows; shadows and light pools remain runtime-owned.
- Preserve ground anchors: living bodies should meet the same world-space shadow plane, and replacements should keep the manifest cell dimensions or update only their manifest entry.
- Do not mark a family complete until generated artwork, required states, production formatting, manifest wiring, in-game testing, and a quality review all exist.
