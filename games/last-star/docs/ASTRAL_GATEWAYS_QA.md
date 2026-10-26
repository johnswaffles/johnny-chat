# Astral gateways — local verification, October 26, 2026

Local release marker: `20261026-astral-gateways`. Public baseline at the start of this pass was commit `40513a47d8901a23b6632a9b2112e53a5670f994`, release `20261026-luminous-world`. This document records local implementation and verification, not publication.

## Gameplay and build

- 114 Node tests pass, including new coverage of the real rift damage trigger and its ±90 boundary, all three boss attack tags, bounded/paused aftermath, optional artwork fallback and hostile/friendly event-light colors.
- The entire simulation was serialized and compared against the previous production `game.js` after every frame of an input-only playthrough. Excluding presentation events and new projectile artwork tags, all3,040 frames match. Both finish with3 seals,13 kills,210 HP in50.667 simulation seconds. Damage, motion and all other gameplay state match the baseline.
- Chrome's existing `#qa-replay` input driver independently completes the actual rendered game:3 seals,13 kills,54 crystals,7,500 score,210 HP, boss0 HP, won in51 rounded simulation seconds. Wall time18.115 seconds with accelerated RAF timestamps. No player/enemy state edits in this run. No browser errors or failed requests.
- Source and published runtime mirror have311 byte-identical files. `node scripts/verify-pages-build.mjs` and `git diff --check` pass. This is route/payload verification in a sparse checkout, not a claim of a new hosted build.

## Visual browser review

- All3 optional paintings decode, genuine alpha range0–255 with transparent corners; layered GPU scenery loads. The10-scene interactive preview shows starseal, awakening, Observatory gate, wraith cast, melee strike, boss fan/rift/sweep, Mantle and Overdrive.
- Captured30 windup/attack/idle examples across both directions for wraith, melee and all3 boss patterns. Inspected full enemy pose sheets on dark/light backgrounds and gameplay-scale representative casts. This revealed neighboring fragments in the existing boss atlas crops. Adjusted code-only crop/clip boundaries, preserving source artwork, pivots and complete weapons/capes/feet; rechecked both directions.
- The boss astronomical halo stays behind its painted body; the compact charging nucleus and fragments draw in front so cast preparation remains visible.
- Paused stage screenshots are pixel-identical across650ms in Rich and Gentle+Light+reduced-flash settings, including active rift eruption and background. Simulation and renderer clocks stop.
- Preview layouts checked at360×800,800×600 and1600×900 with no horizontal overflow. At360px, controls remain reachable by vertical scrolling. Narrow preview fixtures bring the opponent into view; the actual game's layout and enemy placement are unchanged. Both boss directions reviewed again on the narrow preview.
- Blocking all3 arcana artwork requests intentionally produces drawn fallback effects and3 expected warnings, with no page errors. Gateways, projectiles, rifts and wards remain renderable.
- A fresh actual game starts and casts Starshard with ordinary button/key input. Final crop/charge changes were inspected again in Chrome. A short motion reel records freshly rendered gameplay layers and is independently decoded/seeked in the browser.

No hardware-wide60 FPS claim is made from these checks. The new art adds278,776 bytes and bounded effects; all work remains on the current single level.

## Evidence

Repository-root folder: `output/last-star-arcana-20261026/qa/`.

- `tests.txt`: final114-test run.
- `mechanics-parity.json`: complete baseline/current simulation comparison.
- `playthrough.json` / `input-only-playthrough.png`: rendered campaign completion.
- `browser-qa.json`: decoded assets, layout, pause and fallback results.
- `final-*.png`, `pose-*.png`, `rift-*.png`, `layout-*.png`: runtime visual evidence.
- `enemy-poses-light-final.png`: corrected complete boss crops in both directions.
- `mobile-boss-*.png`: narrow preview checks.
- `astral-gateways-reel.webm` / `reel-decoded.png`: rendered motion and playback verification.

The controlled art preview seeds scene locations, enemy phases and buff timers. It is visual inspection; only the separate input-driven campaign run demonstrates end-to-end progression.
