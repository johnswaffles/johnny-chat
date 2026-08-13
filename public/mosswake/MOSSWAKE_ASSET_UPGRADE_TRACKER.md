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
| Hollow Guardian | `assets/bosses/hollow-guardian-sheet-generated-v1.png` | Phase I idle/attack, phase II transformed attack, phase-break, stagger, defeat | Integrated / prepared for live test | Review boss scale and phase readability in the sanctum, then add arena prop kit |

## High-value environment and effects queue

| Priority | Family | Current status | Recommended next action |
| --- | --- | --- | --- |
| 1 | Hollow Guardian arena kit | Procedural backdrop, pylons, and rings | Generate modular altar/pylon/ring pieces after boss sheet review |
| 2 | Lantern-blade combat FX | Procedural slash, sparks, Rootlight pulse | Generate a small transparent effects sheet and replace only the slash layer first |
| 3 | Water / shoreline | Procedural animated water and edge marks | Generate seamless water plus shoreline overlays |
| 4 | Layered tree family | Procedural authored silhouettes | Generate trunk/canopy/shadow layers with 4 sway frames |
| 5 | Outdoor foliage | Procedural authored clusters | Generate modular grass, fern, reed, flower, mushroom, log, and ivy rustle states |
| 6 | Dungeon architecture | Procedural room construction | Generate modular stone, roots, arches, statues, and rubble |
| 7 | Remaining NPCs and portraits | Procedural fallback except Rowan | Generate Tansy, Brindle, Lumen, and compact dialogue busts |

## Current iteration log

### 2026-08-13 — Hollow Guardian sprite family

- Generated a consistent 4×4 boss sheet with a charcoal/moss phase, rose-heart phase, attack poses, phase-break reveal, stagger, and collapse.
- Prepared `hollow-guardian-sheet-generated-v1.png` as a 1248×1248 RGBA sheet with 312×312 cells; retained the chroma-key source beside it for future matte refinement.
- Added the `boss` manifest slot and phase-aware frame selection in `mosswake.js`. The old procedural boss remains the safe fallback if the sheet fails to load.
- Kept the procedural telegraphs, health bar, arena lighting, hit reactions, and particles independent from the sheet so combat behavior is unchanged.
- Local syntax and manifest validation passed. A live visual smoke test is still the next required check after deployment.

## Production contract

- Use orthographic top-down with a gentle 3/4 read, warm parchment highlights, moonlit teal shadows, deep-moss edge restraint, and upper-left lighting.
- Keep transparent assets free of baked cast shadows; shadows and light pools remain runtime-owned.
- Preserve ground anchors: living bodies should meet the same world-space shadow plane, and replacements should keep the manifest cell dimensions or update only their manifest entry.
- Do not mark a family complete until generated artwork, required states, production formatting, manifest wiring, in-game testing, and a quality review all exist.
