# Local verification — September 23, 2026

Verified at `http://127.0.0.1:4197/` in the Codex in-app browser at 1280 × 720.

- Visually inspected the title, initial forest, aqueduct traversal/spells, Observatory, final guardian, ending, and pause menu.
- Started the normal player route and used the actual Shift key to trigger Eventide; observed both portal effects, movement and cooldown/stack updates.
- Ran the QA route's ordinary-input replay in the actual browser. It completed at 56 simulation seconds, with 3 seals and all 13 enemies defeated, and displayed the full ending. The QA driver uses normal movement, jumping, spells and interaction; it does not modify player or enemy state.
- Browser developer log returned no warnings or errors at completion.
- Reloaded the browser, resumed the saved third checkpoint through the QA continuation control, and observed restored full health, all three seals, correct position and a reset guardian encounter.
- Used Shift to enter the arena and R to summon Vaelthryx. The HUD reflected the cost/cooldown; lightning reduced guardian health. The dragon's complete flight was covered by the input replay; only portions were inspected manually.
- Allowed the guardian to defeat an idle player, observed Astral Mantle and the defeat screen, then clicked Return to the last seal. Full health and checkpoint position returned, and the boss was reset.
- Opened pause with Escape; the simulation status stayed unchanged while adjusting gentle effects and light atmosphere. Inspected the complete controls/settings menu.
- `npm test`: 15 passing tests, including every mandatory chasm, double-jump limit, safe teleport refusal, departure/arrival attacks, the Mantle crossing hit, bounded Reckoning, seal ordering/rest, checkpoint reload, constellation impact, dragon damage, fall recovery, gate/completion rules, terminal-state freeze and a full input-driven playthrough.
- Syntax checks passed for all four runtime modules.

This is local verification. No public deployment, mobile/touch QA, gamepad support or broad cross-browser/device performance claim is implied. Rich visual mode was inspected at the browser's standard 1280 × 720 viewport. Final minor UI refinements separate the boss announcement from its health bar and hide narrative subtitles during the boss fight.

All existing Crownforge/Oathbound files were left untouched. New project assets occupy approximately 9 MB. Exact image prompts and asset paths are in ART_PROVENANCE.json; all four images were generated with the built-in image tool.

### Opaque eight-frame walk correction
- Replaced translucent pose crossfades with one full-opacity pose per render.
- Added actual generated `assets/arcanist-walk-v2.png` (eight movement drawings), retaining original idle/cast/jump art.
- Built-in image-generation prompt recorded in `WIZARD_WALK_V2_PROMPT.md`.
- Inspected frames from both rows against striped background in `tests/wizard-review.html`: character body blocks background; staff glow stays attached.
- All 28 automated tests pass, including eight-frame coverage and no fractional body pose weights.

### Jog and airborne motion rework
- Added new eight-pose `assets/arcanist-jog-v3.png` and eight-pose `assets/arcanist-air-v1.png`, generated with the built-in image tool. Exact prompts: `WIZARD_MOTION_V3_PROMPTS.json`.
- Replaced prior walk sheet in the renderer. Individually registered foot baselines and body anchors; reduced stride distance from 180 to 132 world pixels per cycle; removed redundant vertical gait bob.
- Airborne hair/cloth cycles at 10 poses per second, with forward/backward frame order to avoid snapping across the loop seam. Vertical velocity selects ascent/descent artwork. Airborne casting retains animated cloth. Brief landing compression settles at the feet.
- Browser motion review confirmed opaque jog frames and visibly distinct rising/falling cloth and hair silhouettes, with no console errors. Review includes jog, rising, falling and jump preview controls.
- All 29 automated tests pass, including existing full input-driven completion and airborne/casting/pause/landing regression.

### Slower steps and fixed jump legs
- Step cadence reduced by 22% (170 world pixels per cycle instead of 132); movement speed unchanged.
- Airborne body now holds tucked pose 4 throughout ascent/descent, including casting. Only trailing hair/cloak region ripples through bounded strip drawing; torso, staff, and legs stay fixed. No fading or new assets.
- Browser review of rising and falling confirms identical legs with changing cloth. No console errors. All 30 tests pass; added check that animated drawing coordinates leave the body/legs unchanged.

### Silverwood misplaced waterfall
Removed active sprite ID 2, which crossed the solid tree arch. Kept original atlas IDs stable for all remaining waterfalls. The shared renderer fixes title and gameplay backgrounds. Browser panorama review confirms the vertical strip is gone; decoded sprite memory fell from 8.2 to 7.4 MiB. Added module cache version to load the correction reliably after refresh. All 31 tests pass.

### Grounded lantern correction
Removed the unsupported lamp at x1120/y640 in the first pit. All ten remaining lanterns use platform-relative placement with footprint checks and derived base heights. Audited starseals and memory markers for support as well. Added future-level placement guidance and regression coverage for missing platforms, pit/edge placements, and platform height changes. All 33 tests pass.

### Missing-health damage and 2% lifesteal
All 36 tests pass. Coverage checks every whole missing-health percentage from 0 to 99, actual-damage healing, overkill, repeat hits on dead enemies, full-health caps, inactive boss protection and Reckoning stacking. Existing input-driven complete playthrough passes. All four damaging ability routes call the shared damage method.

### Compact Starshard polish
Added a faceted blue-white core, concentrated two-layer cached glow, narrow cached comet tail and up to three small time-driven sparks. Core remains compact (18×14 logical pixels including star points), halo footprint reduced from 110 to 64; projectile collision and damage unchanged. Gentle effects reduce shimmer; Light quality uses one spark. Inspected horizontal and angled shots in the actual scene via `tests/starshard-review.html`; no console errors. All 36 tests pass.

### Original RTS level theme
Copied The Door Beneath the World unchanged; SHA-256 matches RTS MUSIC.md. Replaced generative accompaniment with one looping music element while retaining spell effects. Browser confirmed MP3 decodes (184.4935 seconds), starts playback, and pauses with mute. Existing 36 tests pass.
Full-track accelerated browser playback crossed the actual end boundary and resumed at the beginning (`wraps:1`, no media error). Mute/unmute retained playback position; repeated start kept exactly one audio element.

### Starshard and Falling Constellation visual overhaul
Starshard adds intertwined cyan/violet ribbons, a small orbital accent, and bounded crystalline impact flares while retaining its compact core. Constellation builds a cached seven-point celestial chart, drops seven luminous stars, then dissolves into projected rings, gold/blue fragments and contact glints. All visual arrivals align with the existing 0.6-second damage time; damage/cooldowns remain unchanged.

Browser review: checked chart, descending stars, impact and Gentle mode against the actual level via `tests/spell-fx-review.html`; no console errors. All 37 tests pass, including impact synchronization and full input-driven completion. Sigil and glow textures are cached; impact list capped at 20, and Light mode reduces ribbons/fragments. No full-game performance benchmark performed for this change.

### Standing idle motion
Added gentle foot-anchored sway and breathing to the existing standing artwork, plus independent subtle hair/cloak ripple. No body crossfade or extra bob; staff and glow share the body transform. Idle ramps in, disables during walking/casting/jumping, freezes on pause and halves intensity under Gentle effects. Browser standing-pose review confirmed planted feet and opaque body; no console errors. All 38 tests pass.

### Painted standing animation replaces deformation
Added eight new standing drawings in `assets/arcanist-idle-v2.png`, generated with the built-in image tool (prompt: `docs/IDLE_V2_PROMPT.md`). Removed procedural idle shear, breathing stretch and cloth strips. Uses one full-opacity picture at a time, registered foot baselines and staff tips, at four frames per second (2.5 under Gentle effects). Idle sequence resets when moving/casting and freezes on pause. Browser frame review confirmed distinct solid poses and blue crystal alignment; no console errors. All 38 tests pass, including eight unique idle crops and pause/transition coverage.

### Painted Starshard energy wave
Replaced geometric star blade with eight new painted plasma frames in `assets/starshard-energy-v1.png`. Built-in generation prompt saved in `docs/STARSHARD_ENERGY_PROMPT.md`. Compact cyan/white leading crescent, turbulent cobalt/violet flame body; 16 fps loop, 8 fps in Gentle mode. One sprite draw per shot, aimed by velocity and anchored near the bright leading edge. Constellation and damage remain unchanged. Browser review confirmed horizontal/angled energy waves at gameplay scale, proper transparent edges, and no console errors. All 38 tests pass.

## Forward staff casting — 2026-09-23
- Starshard cooldown increased from 0.48 to 0.98 seconds.
- Built-in image generation produced `assets/arcanist-forward-cast-v1.png`; final prompt in `docs/FORWARD_CAST_PROMPT.md`. Separate grounded and airborne forward-staff poses appear immediately on release.
- Shared crystal coordinates drive both rendering and projectile origin. Target direction is now calculated from the crystal, including mouse/controller world aim. Casting suppresses walking bob and landing compression to preserve alignment.
- Browser visual review verified both facing directions, on ground and airborne, with clean sprite crops and no console errors.
- All 40 automated tests pass, including cooldown, muzzle alignment/target trajectories and a complete input-driven level victory. QA route driver now stays in range while airborne and walks off upper ledges to reach lower seals; no simulation cheats or weakened victory assertions.

## Six illustrated memories — September 23
- Six platform-supported waypoints in chapter order; existing three numeric discovery IDs preserved. Unread markers use a bright gold halo, white-gold core and nearby “Read a memory” label. Read markers remain blue and can be reopened.
- Reader has three prose pages per memory, scene-specific art descriptions, a found count, and keyboard/controller controls. The main simulation only advances in playing mode; memory mode clears inputs on entry/exit and leaves the scene frozen.
- Browser: first and sixth actual waypoints opened via interact; page turn left player position, health and elapsed time unchanged. Virtual Xbox A advanced a page, B closed the reader and simulation resumed.
- Automated suite: 42 passing tests, including all six interactions, supported placement, narrative ordering, old-save compatibility and six-memory persistence, plus the complete level playthrough.
- Final art installed: six original 1536×1024 illustrations, inspected for consistent character/costume and story alignment. Browser first/final compositions verified with fully loaded images and legible page controls; intermediate scene mappings checked. Story assets load on demand, outside the gameplay render loop.

## Arcade rewards — September 25
- 46 automated tests passed, including a complete input-only victory, duplicate-kill protection, collectible homing, exact score/starlight rewards, thresholds, timed Overdrive damage, pause/death timing and retry reset behavior.
- Browser reward demo used real damage and collection paths: three kills spawned nine drops, then collection raised score from 600 to 825, reached rank I, and triggered Overdrive. Screenshot verified the golden aura, charge meter, combo countdown and all four painted spell icons. Console reported no errors after the reward/audio events.
- Audio implemented with Web Audio synthesis and bounded one-shot durations; perceptual mix is left for user listening. Art atlas generated with built-in image generation; saved prompt in ARCADE_ICON_PROMPT.md.
