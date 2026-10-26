# Luminous world — local review, October 26, 2026

Release marker: `20261026-luminous-world`. This is a local implementation and preview, not a public deployment.

## What changed

- Original painted Ember, Frost and astral effect layers, combined with moving fire ribbons, faceted ice projectiles, stronger violet lightning and distinct impact shapes.
- Twin Eventide portals at the actual teleport endpoints, a brief connecting ribbon and emerald restoration leaves. The compact blue Starshard wave is preserved with small muzzle and trail accents.
- Colored spell illumination fades across the wizard and real platform edges. No false floors are lit across pits. Missing optional magic paintings fall back to drawn effects.
- Layered Silverwood scenery is the normal rendering path. The original ridge is retained, with cooler grading, a new distant observatory/mountain skyline, quieter clouds and thinner waterfall strands. `?legacy-scene=1` retains the previous panorama for comparison.
- Scene-specific asset loading avoids the old panorama, atlas and 192 old water-frame requests in the new scene. Three magic sprites total 377,856 bytes; the active v4 horizon is 284,172 bytes. PNG masters and the earlier v3 iteration are preserved.
- `tests/luminous-review.html` provides all six active spell/item demonstrations, replay, facing controls, pause/scrubbing and Gentle/Reduced Flashes/Light settings. Renderer sizing follows the actual canvas, including embedded review stages.

## Verification

- 108 Node tests pass, including combat, charges, existing campaign mechanics, lightning endpoints, bounded effects/lights, paused lifetime, expiry without a final-frame flash, opaque scenery grading and waterfall registration.
- An input-only route from a fresh game completed all three seals and defeated the final encounter: 13 kills, 54 crystals, 7,500 score and 210 HP. This uses the existing QA route driver with 50 ms RAF timestamps for accelerated simulation; no player/enemy state edits. Final skyline framing is checked separately at camera 0, 2500 and 6500.
- Real browser screenshots cover both spell facings, flight and impact, all six identities, 1600px desktop and 800×600. A separate 320px review check found no horizontal overflow. The 800×600 preview controls fit within the viewport.
- Actual game and review pause preserve game time, renderer time, positions and pixels; resume advances normally. Gentle, Reduced Flashes and Light are verified through their visible controls.
- Optional Ember image failure still initializes the game, allows a real Ember cast and renders its fallback. Mandatory preview image failure displays an error and disables the preview controls without an unhandled page error.
- GPU scenery and Canvas fallback both animate independently and redraw identically when paused. Simulated WebGL context loss switches to the fallback, and restoration resumes GPU rendering with zero GL errors.
- Final normal captures report zero page errors and zero failed requests, confirm the v4 skyline is loaded and confirm no legacy panorama/water frames are requested.
- A short 1280×720 WebM captures the real renderer in the controlled six-spell demonstration. It includes both the GPU background and foreground. Video decode and a sampled frame were inspected.

Machine-readable results, screenshots, capture scripts and motion reel are preserved in repository-root `output/last-star-luminous-20261026/qa/`. These are local Chrome checks, not proof of every browser or device. The preview fixtures deliberately provide targets and charges; the campaign route is separately identified as input-only.

## Art and reference provenance

See `LUMINOUS_MAGIC.md`, `LUMINOUS_MAGIC_PROMPTS.json`, `LUMINOUS_HORIZON_PROVENANCE.json` and `LUMINOUS_HORIZON_V4_PROVENANCE.json`. Unchanged PNG masters live under repository-root `output/last-star-luminous-20261026/source-art/` and `output/last-star-luminous-20261026/art/`.

The official [Konami Belmont's Curse gallery](https://www.konami.com/games/castlevania/belmonts_curse/eu/en/) informed the general direction: clear attack silhouettes, strong focal light and quieter background values. New Last Star artwork is original; no Konami game assets are bundled.

Source and public mirror verification matched all 298 runtime files. `node scripts/verify-pages-build.mjs` and `git diff --check` passed. A full monorepo build was not run in this sparse checkout.
