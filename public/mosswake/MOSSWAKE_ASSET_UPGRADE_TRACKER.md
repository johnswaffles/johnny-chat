# Mosswake Asset Upgrade Tracker

This is the persistent production record for Mosswake's replaceable visual library. The runtime keeps collision, AI, timing, camera, and room composition in `mosswake.js`; artwork is loaded through `assets/manifest.json` so a later generated replacement does not require gameplay rewrites.

## Status key

- **Integrated / tested** — the asset is loaded by the live renderer and has passed a gameplay smoke test.
- **Prepared** — production-formatted artwork exists, but it still needs runtime integration or a focused visual test.
- **Procedural fallback** — the renderer is intentionally using the current canvas treatment until the listed replacement is ready.

## Living characters

| Asset family | Current files | States / directions | Status | Next quality step |
| --- | --- | --- | --- | --- |
| Lantern Warden | `assets/player/warden-sheet-generated-v1.png`, `assets/player/warden-run-sheet-generated-v1.png`, `assets/player/warden-attack-directions-generated-v1.png` | Idle, 4-direction walk, 4-direction sword attack, dash, hurt | Integrated / tested | Keep the repaired per-frame feet anchors; replace only with a higher-resolution sheet that preserves the same ground line |
| Rowan | `assets/npcs/rowan-sheet-generated-v1.png` | Idle, walk, map work, talk/reaction | Integrated / tested | Add the remaining named NPC sheets using Rowan as the reference |
| Mossling | `assets/enemies/mossling-sheet-generated-v1.png` | Idle, skitter, pounce, hit recoil | Integrated / tested | Keep as the small-creature reference; refine only for a focused readability defect |
| Distinct enemy family | `assets/enemies/enemy-family-generated-v1.png` | Thornback, Moon Wisp, Ambush Moth, Rootling/Root Warden; idle, telegraph, attack, hit | Integrated / tested | Keep the family atlas as the roster reference; add specialized death/telegraph FX only if a later encounter review needs them |
| Enemy combat effects | `assets/enemies/enemy-effects-generated-v1.png` | Charge, ranged, ambush, impact, and four drop feedback states | Integrated / tested | Keep the atlas as the small-enemy feedback reference; refine only if a focused encounter review finds overlap or low contrast |
| HUD and pickup icons | `assets/ui-icons-generated-v1.png` | Hearts, key, Heartseed, Rootlight, discovery, map, drop, sword, dash, lock, and star states | Integrated / tested | Keep the icon atlas as the UI reference; refine only if a later readability pass finds a specific small-size issue |
| Dialogue and screen surface family | `assets/ui/ui-panels-generated-v1.png` | Dialogue, title, pause, victory, portrait frame, button, objective, map, ability, toast, and divider surface states | Integrated / pending live visual check | Keep typography and contrast in CSS; replace individual atlas cells later without touching game flow |
| Collectibles and exploration items | `assets/items/exploration-items-generated-v1.png` | Key, Heartseed, lantern seed, Dewglass lens, moth token, moonroot cache, hidden chest, and Rootlight lantern states | Integrated / pending live visual check | Keep the atlas as the item reference; replace individual cells only when a specific silhouette or matte issue is found |
| Outpost, cabin, shrine, and entrance structures | `assets/buildings/mosswake-structure-family-generated-v1.png` | Lit/intact/damaged/open outpost, shrine, cabin, roof/wall modules, lantern doorway, root arch | Integrated / pending live visual check | Keep the structure atlas as the building-scale reference; retain procedural facades as fallback |
| Hollow Guardian | `assets/bosses/hollow-guardian-sheet-generated-v1.png` | Phase I idle/attack, phase II transformed attack, phase-break, stagger, defeat | Integrated / tested | Keep the generated sheet as the boss reference; only refine if a focused arena review finds a real readability issue |

## High-value environment and effects queue

| Priority | Family | Current status | Recommended next action |
| --- | --- | --- | --- |
| 1 | Boss telegraph and defeat FX | Integrated / tested | Keep the atlas as the Guardian effect reference; only refine for a readability defect |
| 2 | Outdoor foliage | Integrated / tested | Keep the foliage atlas as the outdoor prop reference; add a second seasonal sheet only if a later visual review shows repetition |
| 3 | Dungeon architecture | Integrated / tested | Landmark/interactable atlas now covers chests, runes, switches, sockets, and reward pedestals |
| 4 | Outdoor props (fences, paths, signs, rocks) | Integrated / tested | Keep the generated prop atlas as the reference; add bridge/boardwalk cells only if a later composition pass needs them |

## 2026-08-13 — Repeating visual director pass: Guardian grounding repair

- Inspected the live overworld, current renderer, tracker handoff, and strongest approved character/environment references before selecting a target. No new art was generated because the remaining high-impact defect was technical rather than an inadequate asset.
- Measured the alpha bottoms of all 16 `hollow-guardian-sheet-generated-v1.png` cells and added per-frame `bossBottoms` anchors for idle, attack, phase-two, stagger, and collapse states. Boss death frames now use the same measured grounding while retaining their authored dissolve offset.
- Kept the existing boss sheet, telegraphs, phase logic, collision, and arena composition unchanged. This prevents the Guardian from appearing to hop or float when transparent margins change between attacks and phase transitions.
- `node --check`, `git diff --check`, local live smoke, public live smoke, and console checks passed. Commit `2d5a2a2` is pushed to `main`.

## 2026-08-13 — Repeating visual director pass: enemy family grounding repair

- Re-audited the running overworld, the prior Guardian handoff, the enemy manifest, and the strongest approved enemy sheets. The next highest-impact weakness was a shared shadow/anchor mismatch across painted enemies rather than missing artwork.
- Added measured per-frame `mosslingBottoms` for the 16-cell Mossling sheet and moved all painted enemy contact shadows to a shared world-space ground line. Thornback, Moon Wisp, Ambush Moth, Root Warden, Mossling, and Guardian death states now use their actual alpha bottoms.
- Mossling deaths now use the authored recoil/dissolve cells from `enemy-mossling` instead of falling through to the generic procedural death burst. Existing combat timing, hitboxes, AI, drops, telegraphs, and fallback rendering remain unchanged.
- Local syntax, diff, and browser smoke checks passed with no console errors or warnings. Public deployment verification is the final gate for this iteration.

## 2026-08-13 — Repeating visual director pass: enemy motion-shadow alignment

- Performed the requested second visual sweep around the enemy grounding changes. The remaining visible mismatch was that hopping, recoil, and knockback moved the painted enemy body while its shadow stayed at the old position.
- Updated `drawEnemy()` so painted enemy shadows share the same bob/recoil presentation offset as their sprites. Death shadows intentionally remain on the authored ground plane for a stable dissolve.
- Preserved all enemy art, animation timing, AI, collision, combat feedback, and fallback branches. No new artwork was necessary.
- Local syntax, diff, and browser smoke checks pass with no console errors or warnings. Public deployment verification is the final gate for this iteration.

## 2026-08-13 — Repeating visual director pass: telegraph presentation alignment

- During the second enemy readability sweep, painted warning sprites and procedural telegraph lines/rings were still anchored to the simulation position while generated enemy bodies and contact shadows used their bob/recoil presentation offset. This could make a charge, ranged aim, or boss windup feel fractionally detached from the moving silhouette.
- Added one shared presentation coordinate pair in `drawEnemy()` and routed the painted `enemy-effects`/`boss-fx` telegraphs, charge/ranged/boss warning lines, exposure ring, hit ring, body, and painted contact shadow through it. Player-targeted rain markers remain intentionally player-anchored.
- No new artwork was needed: the existing Mosswake telegraph sheets are visually strong and remain modular/replaceable through the manifest. Combat geometry, telegraph durations, hitboxes, AI, cooldowns, and fallback drawing are unchanged.
- `node --check public/mosswake/mosswake.js`, `git diff --check`, local startup, asset-load, movement/attack smoke, and console warning/error checks pass. Live public smoke at `/mosswake/` after deployment also passes with no console warnings or errors.

## 2026-08-13 — Repeating visual director pass: shared actor depth ordering

- The running visual sweep exposed a high-impact top-down layering weakness: the player was always painted after every enemy, and NPCs were painted in a separate fixed stage. Crossing actors could therefore read as pasted on top of one another even though their world-space Y positions were different.
- Replaced the fixed actor order with one sorted depth pass for enemies, overworld NPCs, and the player. The existing foreground foliage pass still runs afterward so tall grass and front trees retain intentional occlusion.
- Preserved all actor artwork, anchors, shadows, collision, AI, interaction ranges, combat timing, and fallback renderers. No new artwork was needed.
- `node --check`, `git diff --check`, local title/start/movement/attack smoke, second visual sweep, and console warning/error checks pass. Live public title/start/movement/attack smoke after deployment also passes with no console warnings or errors.

## 2026-08-13 — Repeating visual director pass: player attack FX grounding

- The dungeon combat sweep found a subtle but high-impact presentation mismatch: the painted Warden attack sprite is rendered on its grounded `+8px` presentation coordinate, while the sword-trail atlas was still centered on the raw player coordinate. During a swing the blade and trail could separate vertically.
- Routed the painted `fx-slash` atlas and procedural sword fallback through the same presented player coordinate (including idle/movement bob) used by the attack sprite. Hitboxes, attack direction, cooldown, movement, and timing are unchanged.
- No new artwork was needed; the existing Lantern-blade FX atlas remains the approved reference and stays replaceable through `assets/manifest.json`.
- `node --check`, `git diff --check`, local start/attack visual smoke, and console warning/error checks pass. Public deployment verification is pending.

## 2026-08-13 — Visual integration, grounding, and animation repair (continued)

- Generated `assets/props/mosswake-props-family-generated-v1.png` as a 1248×1248 RGBA 4×4 atlas: four fence variants, four worn trail segments, bridge/rope-bridge pieces, sign and lantern signposts, and four mossy rock clusters. The keyed RGB source remains beside it for future matte refinement.
- Added the `outdoor-props` manifest slot. Existing fence, sign, and rock renderers now prefer the painted family, while the long procedural path keeps its collision-safe ribbon and receives sparse painted trail repairs. Labels remain runtime text over the sign art; procedural drawing remains the safe fallback.
- Corrected the directional player attack renderer so the generated left-facing row is not mirrored, and preserved the repaired feet/contact anchors.
- Local syntax, manifest, alpha, and diff checks pass. Public visual smoke testing confirmed the atlas loads in the live overworld with no console errors or warnings.

## 2026-08-13 — Visual integration, grounding, and animation repair

- Added `assets/player/warden-attack-directions-generated-v1.png`, a focused 4×4 RGBA attack atlas. It preserves the Lantern Warden reference design and supplies ready/anticipation/impact/recovery sequences for down, up, right, and left attacks. The chroma-key source is retained beside it for future matte refinement.
- Added the `player-attack` manifest slot and connected attack-frame selection to the existing four-direction attack vector. The attack hitbox, cooldown, movement, sword FX, and fallback renderer remain unchanged; the painted Warden now carries the directional sword action instead of reusing the south-biased row.
- Repaired grounding by measuring the actual alpha bottom of the generated player, NPC, enemy, tree, and structure cells. Renderer overrides now keep feet, roots, building bases, and contact shadows on the same authored ground line, including action frames with transparent padding.
- Calmed ambient motion: tree frame cadence is now a slow irregular `[0,1,2,1]` wind cycle, procedural crowns/trunks move less, foliage/bushes/grass/flowers use low-amplitude phase-varied sway, and NPC idle/work bob is restrained. Gameplay actions remain readable and unchanged.
- Remaining generic-looking fence/path/sign work is documented as a code-native presentation queue rather than duplicated asset generation; these are still replaceable through the existing manifest workflow when a coherent environment-props atlas is produced.
- Local syntax, manifest parsing, RGBA/alpha validation, and live console smoke checks were run. The public edge should be rechecked after the next deployment for manifest v22 and the new attack atlas.

## Current iteration log

### 2026-08-13 — Dungeon landmarks and interactive props

- Generated `assets/dungeon/dungeon-landmarks-interactive-generated-v1.png` as a 1248×1248 RGBA 4×4 atlas with chest states, rune/sigil states, moon switch and Rootlight socket states, and reward landmarks. The keyed RGB source remains beside it for future matte refinement.
- Added the `dungeon-landmarks` manifest slot. Dungeon chests, runes, switches, the overworld Rootlight gate, and the Heartseed reward now use painted modular states with deterministic frame selection; procedural rendering remains the safe fallback.
- Preserved interaction ranges, save flags, reward logic, telegraph timing, and room geometry. Bumped the manifest and page cache keys to `manifest.json?v=15` and `mosswake.js?v=40`.
- Local syntax, manifest, RGBA/alpha, startup, asset-load, and console smoke checks passed. Public edge should be verified after cache rollover.

### 2026-08-13 — Distinct enemy family atlas

- Generated `assets/enemies/enemy-family-generated-v1.png` as a 1248×1248 RGBA 4×4 atlas with four coherent rows: Thornback (idle, charge wind-up, charge, hit), Moon Wisp (hover, ranged wind-up, cast, hit), Ambush Moth (hidden/reveal, dive, hit), and Rootling/Root Warden (guard, telegraph, strike, stagger). The keyed RGB source remains beside it for future matte refinement.
- Added the `enemy-family` manifest slot and type-aware frame mapping. Thornback, wisp, moth, and warden now use the painted family when loaded; the hidden moth keeps its existing concealment read, and all procedural silhouettes remain the safe fallback.
- Preserved enemy AI, detection, telegraphs, hitboxes, collision, drops, and death timing. Added a shared feet anchor and type-specific display scale so the art reads grounded at gameplay size. Bumped manifest/page cache keys to `manifest.json?v=16` and `mosswake.js?v=41`.
- Local syntax, manifest, RGBA/alpha, startup, asset-load, and console smoke checks are required after integration; public edge should be verified after cache rollover.

### 2026-08-13 — Enemy combat effects atlas

- Generated `assets/enemies/enemy-effects-generated-v1.png` as a 1248×1248 RGBA 4×4 atlas. Rows cover Thornback charge telegraph, Moon Wisp ranged telegraph/projectile cue, Ambush Moth reveal/pounce, and compact impact/drop feedback (bark, moon spark, moth dust, root sigil). The keyed RGB source remains beside it for future matte refinement.
- Added the `enemy-effects` manifest slot. Non-boss charge, ranged, and ambush telegraphs now use the painted states; moonbolt projectiles and enemy drops use the matching effect frames. Procedural lines, particles, and projectile art remain the safe fallback, while Guardian boss FX remain on their dedicated atlas.
- Preserved enemy AI, attack geometry, telegraph durations, hitboxes, collision, drops, and pickup logic. Bumped manifest/page cache keys to `manifest.json?v=17` and `mosswake.js?v=42`.
- Local syntax, manifest, RGBA/alpha, startup, asset-load, and console smoke checks are required after integration; public edge should be verified after cache rollover.

### 2026-08-13 — HUD and pickup icon atlas

- Generated `assets/ui-icons-generated-v1.png` as a 1248×1248 RGBA 4×4 atlas with painted full/empty hearts, key, Heartseed shard, Moonwake Lantern, Rootlight pulse, discovery lens/map marker, enemy drops, sword, dash, lock, and discovery star icons. The generated RGBA source is retained as `ui-icons-generated-v1-keyed.png` for future matte refinement.
- Added the `ui-icons` manifest slot. HUD hearts now use the painted full/empty states when the atlas is loaded; Heartseed, key, wild-drop, and discovery labels now carry matching painted icon treatments in the DOM. Procedural CSS hearts remain the safe fallback.
- Preserved health values, save state, resource counts, responsive layout, and accessibility labels. Bumped manifest/page/style cache keys to `manifest.json?v=18`, `mosswake.js?v=43`, and `mosswake.css?v=12`.
- Local syntax, manifest, RGBA/alpha, startup, asset-load, and console smoke checks are required after integration; public edge should be verified after cache rollover.

### 2026-08-13 — Dialogue and screen surface family

- Generated `assets/ui/ui-panels-generated-v1.png` as a 1254×1254 RGBA source normalized to a 1248×1248 4×4 atlas. Cells cover dialogue framing, NPC portrait frame, title/pause/victory plaques, objective/map/ability surfaces, toast/button plates, lock treatment, and Mosswake dividers/crest details.
- Added the `ui-panels` manifest slot and layered the generated surfaces into the dialogue box, portrait frame, title screen, pause screen, and victory screen. HTML text, CSS sizing, contrast, focus states, and all gameplay state remain runtime-owned; the existing CSS surfaces remain the safe fallback. Portraits now use a CSS custom property so generated NPC portrait images are not overwritten by the frame layer.
- Bumped manifest/page cache keys to `manifest.json?v=19`, `mosswake.js?v=44`, and `mosswake.css?v=13`. Source and normalized RGBA atlas remain together under `assets/ui/` for future cell-level replacement.
- Local syntax, manifest, RGBA/alpha, and diff checks passed. Live visual smoke testing is the next required step after deployment.

### 2026-08-13 — Collectibles and exploration item atlas

- Generated `assets/items/exploration-items-generated-v1.png` as a 1254×1254 chroma-key source normalized to a 1248×1248 RGBA 4×4 atlas. Cells cover brass key, Heartseed shard, lantern seed, Dewglass lens, moth token, moonroot cache, hidden chest, and dormant/awakened Rootlight lantern states with idle and pickup/glow variants.
- Added the `exploration-items` manifest slot. Chest and cache presentation now selects the painted item family by authored world location and progression state; opening animation, shadows, reward flags, interaction ranges, and procedural/dungeon-landmark fallbacks remain unchanged.
- Bumped manifest/runtime cache keys to `manifest.json?v=20` and `mosswake.js?v=45`. The source and alpha atlas remain together under `assets/items/` for future cell-level replacement.
- Local syntax, manifest, alpha validation, and diff checks passed. Live visual smoke testing is the next required step after deployment.

### 2026-08-13 — Outpost, cabin, shrine, and entrance structure atlas

- Generated `assets/buildings/mosswake-structure-family-generated-v1.png` as a 1254×1254 chroma-key source normalized to a 1248×1248 RGBA 4×4 atlas. Cells cover lit/intact/damaged/open outpost facades, moonlit/damaged/open shrine facades, cabin variants, roof/wall modules, a lantern doorway, and a root-wrapped entrance arch.
- Added the `structures` manifest slot. The two outdoor house facades now use authored outpost/cabin frames, and the shrine entrance uses the painted open facade with a runtime light pool; collision geometry, navigation, labels, and the procedural fallback remain unchanged.
- Bumped manifest/runtime cache keys to `manifest.json?v=21` and `mosswake.js?v=46`. Source and alpha atlas remain together under `assets/buildings/` for future cell-level replacement.
- Local syntax, manifest, alpha validation, and diff checks passed. Live visual smoke testing is the next required step after deployment.

### 2026-08-13 — Named NPC family and portraits

- Generated `assets/npcs/named-npc-family-generated-v1.png` as a 1248×1248 RGBA 4×4 atlas for Tansy, Brindle, Lumen, and the outpost trader: front idle, walking/back, work, and talk/reaction rows. The keyed RGB source remains beside it for future matte refinement.
- Added `npc-named` plus four 96×96 portrait files to the manifest. Tansy, Brindle, and Lumen now render through the generated family in the overworld; their dialogue portraits use generated bust crops, the trader portrait is production-ready for future outpost use, and Rowan keeps the existing Rowan reference sheet.
- Preserved NPC schedules, proximity interaction, dialogue text, save behavior, and procedural fallback. Added the trader portrait slot for future outpost use and bumped the manifest and page cache keys to `manifest.json?v=14` and `mosswake.js?v=39`.
- Local syntax, manifest, RGBA/alpha, startup, NPC asset-load, dialogue portrait, and console smoke checks passed. Public edge should be verified after cache rollover.

### 2026-08-13 — Dungeon architecture kit

- Generated `assets/dungeon/dungeon-architecture-kit-generated-v1.png` as a 1248×1248 RGBA 4×4 atlas with four moss-covered wall segments, four arched doorways, four pillar states, and four room-detail props (rubble, fallen lintel, torch sconce, root-wrapped statue fragment). The keyed RGB source remains beside it for future matte refinement.
- Added the `dungeon-architecture` manifest slot. Dungeon arches, interior pillars, rubble/debris clusters, and the repeating torch sconces now use painted modular silhouettes with room-specific frame selection; procedural geometry remains the safe fallback.
- Preserved collision rectangles, door logic, room composition, lighting falloff, and torch timing. Bumped the manifest and page cache keys to `manifest.json?v=12` and `mosswake.js?v=37`.
- Local syntax, manifest, RGBA/alpha, startup, asset-load, and console smoke checks passed. A public edge check should confirm v37/v12 after the host cache rolls forward.

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
