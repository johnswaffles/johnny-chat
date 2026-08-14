# Mosswake Asset Upgrade Tracker

This is the persistent production record for Mosswake's replaceable visual library. The runtime keeps collision, AI, timing, camera, and room composition in `mosswake.js`; artwork is loaded through `assets/manifest.json` so a later generated replacement does not require gameplay rewrites.

## 2026-08-14 — Dungeon story-props family and room-detail integration

- Re-audited the current player benchmark, five named NPCs, fresh Lanternwood opening, and all six dungeon room compositions. The main NPC families are now covered; the next visible gap was the repeated procedural story-prop layer behind the authored dungeon architecture: sigil plaques, guardian statues, switch machines, and floor medallions.
- Generated `assets/dungeon/dungeon-story-props-generated-v1-source.png` (1254×1254 RGB chroma-key source) and prepared `assets/dungeon/dungeon-story-props-generated-v1.png` (1248×1248 RGBA 4×4 atlas). Rows are four room sigil plaques, four matching guardian-statue states, four themed switch-machine states, and four thin floor medallions for leaf, moon, tide, and Heartseed motifs.
- Added the `dungeon-story-props` manifest slot at v46. `drawDungeonCarving`, `drawDungeonStatue`, `drawDungeonMachine`, and `drawDungeonFloorInlay` now prefer the generated atlas with room-aware frame mapping, grounding shadows, and restrained alpha for floor marks. The Ashen Antechamber machine selects its ember state; the existing procedural art remains the safe fallback.
- No collision, puzzle, room geometry, actor, boss, or progression logic changed. The source remains beside the production atlas so future matte/paint refinements can be compared without changing the runtime contract.
- Fresh browser startup loaded `mosswake.js?v=83`, `manifest.json?v=46`, and the new atlas with HTTP 200. The browser reported no warning/error logs. A fresh start later reached the existing run-ended screen during passive smoke, with no new console error; dungeon rendering still needs a focused room-entry screenshot in the next pass.
- Approved player, NPC reaction, architecture, Sanctum, landmark, bridge, and outdoor families remain the visual references.

## 2026-08-14 — NPC conversational reaction family and discovery-state parity

- Rechecked the player benchmark, all five named NPCs, the fresh Lanternwood opening, Rowan's approach smoke, and the six-room dungeon source/layouts. No approved NPC or dungeon family was regenerated.
- Promoted the next NPC gap: non-Rowan dialogue previously held one `npc-named` talk frame, so Tansy, Brindle, Lumen, and Marlow appeared frozen while speaking.
- Generated `assets/npcs/named-npc-reaction-generated-v1-source.png` (1254×1254 RGB chroma-key source) and prepared `assets/npcs/named-npc-reaction-generated-v1.png` (1248×1248 RGBA 4×4 atlas). Rows are Tansy, Brindle, Lumen, and Marlow; each row contains four sequential listening, gesture, emphasis, and reset frames. The source remains beside the production atlas.
- Added the `npc-reaction` manifest slot at v45 and routed non-Rowan dialogue through it with a four-frame cadence at 7 fps and a `.92` grounding anchor. Rowan's dedicated talk sheet, dialogue text/portraits, interaction radius, save behavior, and NPC routes are unchanged.
- Promoted the already-generated outdoor-breakables remnant cells into the broken-state renderer: root-ivy frame 12, pond-ivy frame 11, and reed-cache frame 15. Broken secrets now leave a subtle grounded remnant instead of silently disappearing; flags, collision, passage opening, and rewards remain unchanged.
- Fresh browser startup loaded the reaction atlas with HTTP 200 and clean warning/error logs. The targeted movement smoke reached the existing run-ended screen without introducing a console error; no gameplay tuning was changed. Bumped the route script cache to `mosswake.js?v=82`.
- Approved player, NPC, breakable-plant, waystone, shoreline, rock, bridge, Guardian, and Sanctum families remain the visual references.

## 2026-08-14 — Waystone exploration-clue family and full parity recheck

- Rechecked the current player benchmark, all five named NPCs, the fresh Lanternwood opening, and the six-room dungeon source/layouts. NPC inventory and dungeon actor coverage remain complete; no approved character family was regenerated.
- Promoted the next documented outside-world gap: the three pale stones that quietly point toward the hidden grove were still procedural ellipses, weakening one of the game's most important environmental clues.
- Generated `assets/rocks/mosswake-waystone-clue-family-generated-v1.png` as a normalized 1248×1248 RGBA 4×4 atlas. The sixteen cells cover single moonstones, flat trail stones, pairs, flowered/lichen stones, cracked slate, crescent-marked stones, arrow-like arrangements, stacked markers, and weathered variants. Built-in generation returned alpha directly; no keyed matte is required.
- Added the `waystone-clues` manifest slot at v44 and routed the three clue positions through dedicated frames [1,3,7] before the original ellipse fallback. Runtime clue coordinates, path hint line, discovery logic, collision, and secret progression are unchanged.
- Fresh outdoor startup loaded the waystone atlas with HTTP 200, displayed the authored opening, and reported no browser warning/error logs. All six dungeon families remain loaded from their existing generated atlases; no dungeon behavior changed.
- Bumped the route script cache to `mosswake.js?v=81`. The approved player, NPC, breakable-plant, rock, shoreline, bridge, Guardian, and Sanctum families remain the visual references.

## 2026-08-14 — Breakable discovery-plant family and NPC/dungeon parity audit

- Re-verified the current player benchmark, all five named overworld NPCs (Rowan, Tansy, Brindle, Lumen, Marlow), the opening outdoor composition, and all six dungeon rooms. The existing NPC inventory remains complete: no dungeon NPC actor is present, and every named overworld NPC has an integrated generated sheet or role/activity family.
- Promoted the next high-value outside gap: the three breakable discovery objects (`root-ivy`, `pond-ivy`, `reed-cache`) still borrowed generic `outdoor-foliage` cells even though they gate a secret, a traversal passage, and the Dewglass Lens reward.
- Generated `assets/plants/outdoor-breakables-generated-v1.png` as a normalized 1248×1248 RGBA 4×4 atlas. Cells cover root ivy curtains, pond reeds, dewglass reeds, thorn/flower hedges, vine gates, wet pond weeds, moongrass, root hollows, and snapped/remnant variants. The built-in generation returned alpha directly; no keyed matte is required.
- Added the `outdoor-breakables` manifest slot at v43 and routed the intact breakable objects through dedicated frames (root ivy 0, pond ivy 8, reed cache 2) before the existing foliage/procedural fallbacks. Their interaction radius, sword detection, broken state, secret flags, passage opening, reward, and collision behavior are unchanged.
- Fresh outdoor startup loaded the new asset with HTTP 200, rendered the plants at grounded scale, and reported no browser warning/error logs. The exploratory movement smoke reached the existing run-ended screen without a console error; no gameplay tuning was changed.
- Bumped the route script cache to `mosswake.js?v=80`. Approved NPC sheets, player sheets, shoreline stones, dungeon bridge, and Sanctum assets remain the visual references.

## 2026-08-14 — Shoreline stone family and water-edge parity QA

- Promoted the next documented gap: `environment.shoreStones` was still a fully procedural ellipse loop while pond/shoreline water and dock already used authored families.
- Generated `assets/rocks/mosswake-shoreline-stone-family-generated-v1.png` as a normalized 1248×1248 RGBA 4×4 atlas. The sixteen cells cover wet pebbles, stepping stones, moss crescent, shell cluster, foam-edge stone, cracked slate, water-ring stone, driftwood cluster, lichen pebble, two-stone pair, and flat/amber variants. Built-in generation returned alpha directly; no keyed matte is required.
- Added the `shoreline-stones` manifest slot at v42 and routed the overworld shoreline pass through it before the old ellipse fallback. Only low-profile frames [0,1,2,3,6,7,8,9,10,11,12,13] are selected so reeds/mineral/leaf-wrapped cells do not clutter the pond edge.
- Replayed a fresh outdoor opening and restored Heartseed Sanctum. Shoreline props stay grounded on runtime shadows, dock and water remain readable, Guardian + boss HUD remain visible, and browser console logs are clean.
- Bumped the route script cache to `mosswake.js?v=79`. Collision, water geometry, dock placement, and dungeon logic unchanged.

## 2026-08-14 — Dedicated Lanternwood rock family and full-room QA

- Promoted the most visible remaining outdoor prop gap: rocks were borrowing four unrelated `outdoor-props` cells, which made small landmarks read like generic clutter beside the authored trees, bridge, foliage, and characters.
- Generated `assets/rocks/mosswake-rock-family-generated-v1.png` as a normalized 1248×1248 RGBA 4×4 atlas. The sixteen cells cover pebble clusters, stepping stones, cracked and moss-capped boulders, slate shards, lichen stones, a moonstone, a standing-stone fragment, and depleted/resource variants. The built-in generation returned alpha directly, so no keyed matte is required.
- Added the `rock-family` manifest slot at v41 and routed `drawRock` through it before the existing outdoor-prop/procedural fallbacks. Rock placement, shadows, scale inputs, obstacles, and collision geometry are unchanged; the atlas is replaceable cell-by-cell without touching gameplay code.
- Replayed the fresh outdoor opening and a restored Heartseed Sanctum. The new rocks remain grounded on their runtime shadows, silhouettes stay readable over the road/meadow, the Guardian and boss HUD remain fully visible, and the browser reported no warning/error logs.
- Bumped the route script cache to `mosswake.js?v=78`. This pass generated new raster art; the current approved references remain the Lanternwood tree family, outdoor foliage family, and the Heartseed Sanctum kit.

## 2026-08-14 — Six-room dungeon presentation audit and Guardian grounding fix

- Completed a fresh visual review of all six dungeon rooms against the strongest Moon Switch Hall / bridge benchmark: Root Gallery, Flooded Vault, Moon Switch Hall, Ashen Antechamber, Warden's Garden, and Heartseed Sanctum. The room identities, authored prop families, Rootlight bridge states, hazards, and arena dressing remain cohesive and production-ready; no redundant raster regeneration was warranted.
- Found and fixed one concrete presentation defect in Heartseed Sanctum: the Guardian spawned at y=285, which placed its sprite beneath the bottom-clamped camera and behind the HTML boss HUD when the player entered from the south. The spawn and fresh-run defeat-remnant defaults now use the sanctum's central ring at y=390, keeping the full boss silhouette and health bar readable before telegraphs begin.
- Verified the custom Guardian atlas after the placement change. The idle body, health bar, arena ring, and the first gold telegraph now appear together in the intended focal area instead of reading as a floating attack effect with no boss.
- No new raster artwork was generated. Existing `hollow-guardian-sheet-generated-v1.png`, `guardian-telegraph-fx-generated-v1.png`, and the Heartseed Sanctum kit remain the approved references. Runtime collision, damage, phase logic, victory altar position, and room geometry are unchanged.
- Bumped the route script cache to `mosswake.js?v=77` for the placement fix. Next pass should continue with the next specific visual gap only after a normal boss approach confirms the new spawn remains readable during phase one and phase two.

## 2026-08-14 — Tansy dialogue and Moon Switch Hall crossing QA

- Completed the remaining focused NPC smoke for Tansy. Her fire-side directional sheet, interaction prompt, portrait, speaker name, and first dialogue line all render correctly with the existing `.94` ground anchor.
- Replayed Moon Switch Hall from an open-bridge save. A straight-line crossing still produces the intended readable combat failure; an evasive route using periodic Rootlight pulses stays alive through the bridge approach while Wisp pressure and the dedicated bridge family remain visible.
- No new raster artwork was generated because Tansy's directional fire sheet, the NPC activity family, Wisp family, effects atlas, and bridge threshold atlas all meet the current visual benchmark. This pass closed the last pending NPC smoke item and verified the encounter presentation rather than regenerating approved art.
- No source behavior required changing. The next high-value work should move to a specific visual gap found during a fresh room-by-room review instead of repeating completed NPC sheets.

## 2026-08-14 — Marlow outpost trader runtime integration

- Promoted the prepared trader row from the named NPC activity atlas into a live outpost NPC named Marlow at the east edge of the opening lawn. His cart-tending loop now animates in context instead of remaining an unused future asset.
- Added a concise state-aware dialogue branch and wired the existing `trader-portrait-generated-v1.png` portrait to the dialogue card. The portrait letter fallback is `M`, while the same asset path remains replaceable through the existing NPC portrait convention.
- Added the cart behavior's four-frame cadence to the role-activity renderer and bumped the route script cache to `mosswake.js?v=76`. No collision, route, save, combat, or room geometry changed.
- No new raster artwork was generated in this iteration: the approved `named-npc-activity-generated-v1.png` fourth row and trader portrait were already production-ready. The value was integrating and validating the previously prepared family.
- Focused interaction smoke passed with Marlow's prompt, portrait, and first dialogue line; the next pass should repeat the final-coordinate approach if needed and continue the Moon Switch Hall bridge crossing with evasive movement.

## 2026-08-14 — Moon Switch Hall crossing and wisp handoff QA

- Replayed the restored open-bridge route with the current `dungeon-bridge` family. The authored crossing is reachable, the player remains grounded on the planks, the bridge threshold is visually legible, and the existing Rootlight pulse remains available as encounter counterplay.
- A straight crossing exposed a pacing edge: the two Moon Wisps could wake as the player reached the bridge, before the upper half of the hall had been read. Extended dungeon-arrival `spawnGrace` from 2.2s to 3s. This changes no enemy damage, detection range, projectile speed, or collision; it only gives the player one readable approach beat after a room restore/transition.
- No new raster artwork was generated in this iteration because the dedicated bridge threshold atlas and enemy-family/effects atlases are already the correct visual references. The work was a traversal/encounter integration repair, not a replacement of an approved family.
- Bumped the page script cache key to `mosswake.js?v=75` so the timing fix is explicit at the route edge. The next pass should re-run the same controlled crossing with an evasive movement pattern and confirm the first ranged telegraph remains visible before contact.

## 2026-08-14 — Rowan four-direction route-walk family

- Continued the NPC parity audit from the restored bridge and opening density passes. Rowan is the first NPC players meet, but his route previously reused one side-facing walk row even when a route segment or player-facing pause was vertical.
- Generated `assets/npcs/rowan-directional-walk-generated-v1-source.png` and prepared `assets/npcs/rowan-directional-walk-generated-v1.png` as a normalized 1248×1248 RGBA 4×4 atlas. Rows are Rowan facing down/front, up/back, left, and right; each row has four sequential contact, weight-transfer, passing, and recovery frames.
- Added manifest v40 and routed Rowan's non-dialogue pacing through `npc-rowan-walk`. Axis-aware selection now uses true up/down/left/right rows with no runtime mirroring, a `.94` feet anchor, and 58×76 presentation scale. His existing named `npc-rowan` talk/map frames remain unchanged.
- Bumped the page script cache to `mosswake.js?v=74` and added an explicit Mosswake favicon so the browser no longer falls back to a missing `/favicon.ico`. Route points, collision, dialogue, interaction radius, save behavior, and NPC pause/facing logic remain unchanged.
- Validation passed: `node --check`, atlas alpha/dimension checks, fresh outpost startup, Rowan route screenshots, manifest and sprite requests (including the new atlas), and browser smoke. No dungeon art was regenerated; the dedicated bridge family remains the current dungeon reference.

## 2026-08-14 — Outside density and dungeon arrival readability pass

- Replayed the opening outpost and the restored Moon Switch Hall after the dedicated bridge-art pass. The largest remaining visual issue was density at the road edge: several authored grass cards and foreground leaf clusters competed with the walkable ribbon and landmarks.
- Reduced meadow-cluster count from two cards per landmark to one, lowered authored grass-patch opacity, and scaled down the three foreground leaf clusters. The generated foliage, road, and ground families remain unchanged; this is a composition correction, not a replacement of approved art.
- Added a 2.2-second dungeon arrival grace window alongside the existing outdoor grace period. This gives restored/transitioned players time to read the room, bridge, and enemy telegraphs before projectiles can land; combat geometry and damage values remain unchanged.
- Bumped the page script cache to `mosswake.js?v=73`. No new raster artwork was generated because the remaining gaps were density and encounter-readability issues, not missing visual families.
- Validation passed: `node --check`, manifest/diff checks, fresh outpost startup, restored open-bridge screenshot, and browser console checks. A controlled bridge crossing still needs a follow-up with the guard encounter handled.

## 2026-08-14 — Moon Switch Hall bridge threshold family

- Continued from the Lumen NPC pass and the focused bridge-restore QA. The opened Moon Switch Hall shortcut was readable, but it still depended on a small ambient-props bridge cell, so the bridge had no dedicated dormant/open/awakening/threshold state family.
- Generated `assets/dungeon/dungeon-bridge-threshold-generated-v1-source.png` (1254×1254 RGB chroma-key source) and prepared `assets/dungeon/dungeon-bridge-threshold-generated-v1.png` (1248×1248 RGBA production atlas). Rows cover dormant broken planks, four settled Rootlight-open bridges, four sequential awakening frames, and wet/root-wrapped threshold variants.
- Added manifest v39 and routed the opened bridge through `dungeon-bridge`, cycling the four settled open frames at a restrained cadence. The ambient-props bridge remains the safe fallback; collision, room geometry, shortcut progression, save state, and transition logic are unchanged.
- The atlas preserves the established dungeon language: cool charcoal stone, weathered umber planks, deep moss, muted brass, and selective mint Rootlight seams. The source remains beside the alpha production atlas for future matte refinement.
- Validation passed: `node --check`, manifest/alpha/dimension checks, fresh outpost startup, Moon Switch Hall bridge restore, bridge asset request smoke, and browser warning/error checks. A full controlled crossing remains the next traversal-focused QA task.

## 2026-08-14 — Lumen directional map-work sheet

- Continued the opening NPC parity audit after Tansy's fire-side sheet. Lumen's shared role atlas still used a single map-work presentation, so her map table looked static when approached from different axes.
- Generated `assets/npcs/lumen-map-generated-v1-source.png` (1254×1254 RGB chroma-key source) and prepared `assets/npcs/lumen-map-generated-v1.png` (1248×1248 RGBA production atlas). Rows are Lumen facing down/front, up/back, left, and right; each row contains four sequential open-map, glance, route-trace, and reset frames.
- Added manifest v38 and routed only Lumen's non-dialogue cartographer behavior through `npc-lumen-map`. Proximity facing now chooses the dominant world axis; the renderer uses the true directional rows with no horizontal mirror, a `.94` feet anchor, and the same 56×76 presentation scale as the approved NPC sheets. Talk/reaction frames remain on the named family.
- Collision, map-table placement, dialogue, save behavior, and route logic are unchanged. The generated source stays beside the alpha production atlas for future matte refinement.
- Validation passed: `node --check`, manifest/alpha/dimension checks, fresh outside startup, Lumen sheet request/integration smoke, and browser warning/error checks. The focused dungeon bridge restore remains a separate follow-up QA item.

## 2026-08-14 — Tansy directional fire-side work sheet

- Continued the NPC parity audit after Brindle's route sheet. Tansy was still using a shared role atlas with a mirrored/static presentation, even though she is one of the first NPCs players see at the outpost fire.
- Generated `assets/npcs/tansy-fire-generated-v1-source.png` (1254×1254 RGB chroma-key source) and prepared `assets/npcs/tansy-fire-generated-v1.png` (1248×1248 RGBA production atlas). Rows are Tansy facing down/front, up/back, left, and right; each row contains four sequential settled-idle, weight-shift, kettle-stir, and reset frames.
- Added manifest v37 and routed only Tansy's non-dialogue fire behavior through `npc-tansy-fire`. Proximity facing now chooses the dominant world axis, so Tansy turns toward the player without mirroring the sprite; her dialogue/reaction frames remain on the named family.
- Uses a `.94` feet anchor, no runtime flip, and the same 56×76 presentation scale as the approved Brindle sheet. Collision, campfire placement, dialogue, and save behavior are unchanged.
- Validation passed: `node --check`, manifest/alpha/dimension checks, fresh outside startup, Tansy sheet request/integration smoke, and browser warning/error checks were clean.

## 2026-08-14 — Brindle directional movement sheet

- Continued the NPC parity audit after the moonwell landmark pass. Brindle is the most visible unfinished moving NPC: he previously used one right-facing activity row mirrored for left movement, so his pole, boots, and body never showed a true up/down/left/right walk.
- Generated `assets/npcs/brindle-directional-walk-generated-v1-source.png` (1254×1254 chroma-key source) and prepared `assets/npcs/brindle-directional-walk-generated-v1.png` (1248×1248 RGBA production atlas). Rows are Brindle facing down/front, up/back, left, and right; each row has four sequential contact/weight-transfer/passing/recovery frames with a shared foot line.
- Added manifest v36 and routed only Brindle's non-dialogue pacing state through `npc-brindle-walk`. His existing named-family talk/reaction frames and pond-ferrier context remain unchanged. Route, interaction, collision, dialogue, and save behavior are untouched.
- Added axis-aware facing selection to Brindle's route and proximity pause so vertical segments use back/front rows and horizontal segments use true left/right artwork; the renderer disables the old horizontal mirror for this sheet and uses a `.94` feet anchor.
- Validation passed: `node --check`, alpha/dimension checks, fresh outside startup/restart, Brindle sheet request/integration smoke, and browser warning/error checks were clean. The normal QA run still ends when the opening combat grace period expires if the player remains idle, which is existing gameplay behavior rather than an NPC regression.

## 2026-08-14 — Secondary moonwell ruin landmark

- Continued the outside-world replacement audit after the cliff family pass. The smaller ruin at `(875,285)` was the last obvious procedural landmark and read as a generic stone blob beside the authored northeast moon arch.
- Generated `assets/props/outdoor-moonwell-generated-v1-source.png` (1536×1024 source) and prepared `assets/props/outdoor-moonwell-generated-v1.png` (1536×1024 RGBA) as a low, broken moonwell shrine with a crescent basin, roots, rubble, flowers, and a restrained mint pool.
- Added manifest v35 and routed the secondary ruin through the optional `outdoor-moonwell` sprite key. The taller northeast moon arch remains on `outdoor-ruin`, so the two landmarks are related without becoming duplicates.
- Bumped the page script cache key to `mosswake.js?v=67`; collision, world bounds, NPC routes, dungeon progression, and save behavior remain unchanged.
- Validation passed: `node --check`, alpha/dimension checks, all 42 manifest asset requests (39 unique files) returned HTTP 200, fresh outside startup, secondary-ruin integration smoke, six dungeon-room restores/screenshots, and browser warning/error checks were clean. No collision, NPC, or dungeon regression was observed.

## 2026-08-14 — Outdoor cliff and ledge family

- Audited the outside composition after the authored ruin pass. The three large cliff silhouettes were still simple procedural wedges, so the upper and southeast edges lacked the same material depth as the generated trees, rocks, dock, and ruin.
- Generated `assets/terrain/outdoor-cliff-family-generated-v1-source.png` and prepared `assets/terrain/outdoor-cliff-family-generated-v1.png` as a 1254×1254 4×4 atlas. The sixteen cells cover straight ledges, broken corners, root-wrapped shelves, damp waterfall edges, and boulder/lichen variants in the established Mosswake 3/4 top-down language.
- Added manifest v34 and routed the three existing cliff silhouettes through the optional `outdoor-cliffs` sprite key with distinct authored frames. Collision, world bounds, camera behavior, and placement remain unchanged; the procedural wedge remains a safe fallback while assets load.
- Bumped the page script cache key to `mosswake.js?v=66`. No NPC, combat, dungeon progression, or save behavior changed.
- Validation passed: `node --check`, manifest/alpha/dimension checks, all 41 manifest asset requests (38 unique files) returned HTTP 200, fresh outside startup, all six dungeon room restores/screenshots, and browser warning/error checks were clean. No collision, NPC, or dungeon regression was observed.

## 2026-08-14 — Outdoor ruin landmark family

- Audited the opening composition after the pond dock pass. The authored structures and foliage were strong, but the north-east ruin still rendered as a small procedural stone blob and did not read as a memorable landmark.
- Generated `assets/props/outdoor-ruin-generated-v1-source.png` (1254×1254 RGB chroma-key source) and prepared `assets/props/outdoor-ruin-generated-v1.png` (1254×1254 RGBA) as a moss-covered moon-arch ruin with rubble and flowers, matching the structure-family reference.
- Added manifest v33 and routed the north-east ruin through the optional `outdoor-ruin` sprite key. The second, smaller ruin intentionally keeps its procedural fallback so the new landmark remains singular rather than duplicated.
- Bumped the page script cache key to `mosswake.js?v=65`; no collision, navigation, NPC, combat, or save behavior changed.
- Validation passed: `node --check`, manifest/dimension/alpha checks, all 40 manifest asset requests (37 unique files) returned HTTP 200, fresh outside startup, authored-ruin integration smoke, all six dungeon room restores/screenshots, and browser warning/error checks were clean. No collision, NPC, or dungeon regression was observed.

## 2026-08-14 — Outdoor pond dock family

- Audited the live opening after the Rootlight bridge integration. The lower pond had good authored water and shoreline stones, but no strong, readable landmark at the water edge; the remaining gap read as a procedural composition issue rather than a missing gameplay route.
- Generated `assets/props/outdoor-dock-generated-v1-source.png` (1254×1254 RGB chroma-key source) and prepared `assets/props/outdoor-dock-generated-v1.png` (1254×1254 RGBA) as a replaceable single-cell dock/boardwalk prop in the established Mosswake hand-painted 3/4 top-down language. The source is retained for future matte refinement.
- Added manifest v32 and layered the dock at the lower pond shoreline as a visual-only landmark. It uses its own `outdoor-dock` key, anchored at the bank, while the existing pond collision remains authoritative so the prop does not create a misleading traversal path.
- Bumped the page script cache key to `mosswake.js?v=64`; no NPC, combat, save, collision, or room-transition logic changed.
- `node --check`, manifest/dimension/alpha checks, all 39 asset HTTP requests, fresh outside startup, passive NPC activity review, dock-scale screenshot review, and browser warning/error checks passed. No gameplay, NPC, or dungeon regression was observed.

## 2026-08-14 — Rootlight bridge presentation integration

- Audited the Moon Switch Hall shortcut after the masonry pass. The generated bridge cell already existed in `assets/dungeon/dungeon-ambient-props-generated-v1.png`, but runtime only displayed it as a small broken fragment even after Rootlight opened the crossing.
- Promoted ambient-props frame 10 to a readable 350×166 active bridge state at the opened crossing, with a restrained Rootlight pool and five drifting motes. The locked state keeps the small broken-plank clue plus a dark gap so the change is legible before and after activation.
- Collision, room geometry, progression, save data, and transition logic remain unchanged. Bumped the page script cache key to `mosswake.js?v=63`; manifest v31 remains authoritative.
- `node --check`, scoped diff checks, outside startup, Moon Switch Hall locked/open snapshots, all six dungeon-room smoke views, and browser warning/error checks passed after final verification.

## 2026-08-14 — Dungeon masonry family

- Audited the six dungeon rooms after the floor-family pass. The remaining broad mismatch was the repeated procedural wall field behind the authored architecture, hazards, and actors.
- Generated `assets/dungeon/dungeon-wall-family-generated-v1-source.png` and normalized `assets/dungeon/dungeon-wall-family-generated-v1.png` as 1254×1254 source / 1248×1248 RGB production 4×4 atlases. Cells cover damp blockwork, rubble courses, root-broken masonry, moonlit blue stone, flooded teal, ash-darkened stone, and rose sanctum stone.
- Added manifest v31 and layered four restrained wall panels per room through the optional loader. Panels render before masonry details, floor patches, doors, props, hazards, and actors, leaving the existing procedural wall field as a safe fallback and changing no collision or navigation.
- Bumped the page script cache key to `mosswake.js?v=62` and the manifest request to `manifest.json?v=31`.
- `node --check`, manifest/dimension validation, scoped diff checks, fresh outside startup, and all six dungeon room screenshots passed final visual verification with no browser warnings or errors.

## 2026-08-13 — Modular dungeon-floor family

- Audited all six dungeon rooms against the generated player/NPC/architecture/hazard benchmark. The weakest visible gap was the broad procedural floor wash and repeated canvas inlays.
- Generated `assets/dungeon/dungeon-floor-family-generated-v1.png` as a normalized 1248×1248 RGB 4×4 atlas (16 cells) covering cracked moss stone, rings/steps, ash, flooded teal, moonlit, and rose sanctum variants.
- Added manifest v30 and routed restrained room-specific floor patches through the modular loader. Patches are low-alpha/multiply and render before obstacles, props, hazards, and actors; they do not alter collision or navigation and remain optional with procedural floor fallback.
- Bumped the page script cache key to `mosswake.js?v=61` and the manifest request to `manifest.json?v=30` so the new atlas cannot be masked by a stale manifest response.
- `node --check`, manifest/dimension validation, scoped diff checks, local dungeon-room screenshots, and outside startup smoke passed after final verification.

## 2026-08-13 — Dungeon hazard edge and threshold integration

- Completed the remaining prepared cells in `assets/dungeon/dungeon-hazards-generated-v1.png`. Flooded Vault now has a restrained west-wall inlet, lower-left outflow, and Drowned Sigil accent; Ashen Antechamber now has a north-wall ash threshold and Rootlight seal.
- These accents are intentionally low-alpha, visual-only, and placed outside collision rectangles so the rooms gain architectural continuity without becoming cluttered or changing navigation. The existing hazard surfaces, damage feedback, doors, and procedural fallbacks remain authoritative.
- Bumped the page script cache key to `mosswake.js?v=60`. No new raster artwork was generated this pass because these cells were already production-formatted and tracked as prepared; this iteration finished their in-game integration instead.
- `node --check`, atlas manifest validation, scoped diff checks, and local visual smoke for both rooms passed without console warnings/errors.

## 2026-08-13 — Rootlight-parted water and hazard feedback integration

- Finished the prepared dungeon-hazard family instead of starting a new unrelated asset. Flooded Vault (`0-1`) now swaps to authored atlas frame 3 when Rootlight parts the water, preserving the same footprint while making the safe traversal state visually explicit. The procedural water remains a safe fallback when the atlas is unavailable.
- Wired atlas feedback cells 8–9 to deep-water damage and cells 10–11 to ember-trench damage. The short hazard cooldown now produces a localized splash or ash-flare response at the player's feet, so taking damage reads as a consequence rather than a silent health change.
- Kept collision, damage, progression, room layout, and save behavior unchanged. Bumped the page script cache key to `mosswake.js?v=59`; manifest v29 and the existing `assets/dungeon/dungeon-hazards-generated-v1.png` remain the source of truth.
- `node --check`, manifest validation, scoped diff checks, and local browser smoke passed. The calm Rootlight-parted surface and authored ember trench render correctly; the active water-hazard run reached the damage state without console warnings/errors.

## 2026-08-13 — Flooded-vault and ember-trench hazard atlas

- Audited the flooded vault (`0-1`) and Ash Mirror / ember trench room (`1-1`). Their collision and damage logic were already deliberate, but the visible hazards were still large procedural rectangles and repeated line particles.
- Generated `assets/dungeon/dungeon-hazards-generated-v1-source.png` and normalized `assets/dungeon/dungeon-hazards-generated-v1.png` as a 1248×1248 RGBA 4×4 atlas. Rows cover four deep-water surfaces, four ember-trench surfaces, four splash/flare feedback states, and four water-edge/rune/threshold variants.
- Added the `dungeon-hazards` manifest slot (manifest v29). Deep water now cycles two authored surface frames; ember trenches cycle four restrained authored states. Collision rectangles, damage, hazard cooldown, Rootlight waterway progression, and procedural fallback behavior remain unchanged.
- Bumped the page script cache key to `mosswake.js?v=58`. The source and normalized atlas stay together under `assets/dungeon/` for later cell replacement.

## 2026-08-13 — Dungeon doorway and lock-state atlas

- Audited the Root Gallery door, the Moon Gate, the Warden Gate, the Ash Lift shortcut, and the room transition path. The dungeon architecture kit already covered arches and pillars, but the actual traversable doors were still flat procedural rectangles with text labels.
- Generated `assets/dungeon/dungeon-doors-generated-v1-source.png` and the normalized `assets/dungeon/dungeon-doors-generated-v1.png` as a 1248×1248 RGBA 4×4 atlas. Cells cover four open thresholds, brass/crossbar/barred/ash-locked barriers, a four-frame opening sequence, and brass/moon/Warden/ash special seals.
- Added the `dungeon-doors` manifest slot (manifest v28) and routed every dungeon door through the atlas when available. The existing collision and progression booleans remain authoritative; the renderer selects open, locked, or transition frames and rotates the same family for side doors. The procedural door remains a safe fallback.
- Bumped the page script cache key to `mosswake.js?v=57`. No room geometry, collision, key, switch, shortcut, or save behavior changed.
- The source and production atlas stay together under `assets/dungeon/` so individual door cells can be replaced later without gameplay rewrites.

## 2026-08-13 — Named NPC role-activity atlas

- Audited the opening outpost and confirmed Rowan already has a complete directional/route sheet, while Tansy, Brindle, and Lumen were still sharing the family atlas with only static role swaps. The next highest-value gap was believable activity at the exact NPCs players meet in the first minute.
- Generated `assets/npcs/named-npc-activity-generated-v1-source.png` and normalized `assets/npcs/named-npc-activity-generated-v1.png` as a 1248×1248 RGBA 4×4 atlas. Rows are Tansy's four-frame cook loop, Brindle's four-frame walking loop, Lumen's four-frame map-work loop, and a future outpost-trader cart-tending loop.
- Added the `npc-activity` manifest slot (manifest v27) and routed non-talking named NPCs to their role row. Existing `npc-named` frames remain the talk/reaction fallback, and Rowan's dedicated sheet remains unchanged. Brindle's walk row mirrors for left/right via the existing facing flip.
- Runtime cache is now `mosswake.js?v=56`; display scale and `.92` activity foot anchor preserve the existing NPC ground line and shadow contract. No collision, route, dialogue, or save logic changed.
- Source and normalized atlases remain together under `assets/npcs/` for later cell-by-cell replacement without gameplay rewrites.

## 2026-08-13 — Dungeon ambient storytelling prop family

- Audited the live opening, the named NPC family, the dungeon architecture/landmark atlases, and the first three dungeon-room compositions. The NPC family and major dungeon silhouettes are already cohesive and integrated; the remaining visible gap was the “in-between” room detail, where floor props still relied on simple canvas primitives.
- Generated `assets/dungeon/dungeon-ambient-props-generated-v1-source.png` and the normalized `assets/dungeon/dungeon-ambient-props-generated-v1.png` as a 1248×1248 RGBA 4×4 atlas. Cells cover cracked root medallions, a broken cyan urn, engraved tablets, hanging roots, a leaking basin, a collapsed bench, a shrine fragment, a chain winch, a root-wrapped relief, an explorer satchel, broken bridge planks, an ember bowl, worn stairs, a fallen lintel, a sealed hatch, and luminous mushrooms.
- Added the `dungeon-ambient-props` manifest slot (manifest v26) and placed small, low-alpha authored details in every dungeon room without changing collision, room geometry, progression, or combat. The existing architecture, landmark, sanctum, and procedural branches remain independent fallbacks.
- Bumped the page script cache key to `mosswake.js?v=55`. The source and keyed/generated atlas remain together under `assets/dungeon/` so individual cells can be replaced later without changing gameplay code.
- Local `node --check`, manifest/alpha/dimension validation, `git diff --check`, fresh local title/start smoke, portable-save restoration into Root Gallery/Ashen Antechamber/Heartseed Sanctum, screenshot review, and console warning/error checks passed. The new props read as authored environmental storytelling and do not obscure the boss arena or interactable landmarks.
- NPC family remains the approved reference: Rowan's sheet and the named family are already loaded and animated in the overworld; no NPC asset was regenerated in this iteration.

## 2026-08-13 — Player-facing controls, portable saves, and gamepad support

- Replaced the confusing destructive `Erase save` control with a collapsed-by-default `Controls & save` drawer. It contains explicit `Restart game` and `Save / restore` actions, plus an Xbox mapping reference.
- Added portable `mw1_...` save codes. `Update code` serializes the current progress, `Copy` uses the clipboard when available, and `Restore` validates and rehydrates the save through the existing migration path before autosaving locally.
- Added Xbox/gamepad polling for left-stick/D-pad movement, A interact/dialogue, X sword, B dash, Y Rootlight, and Menu pause. Keyboard controls remain unchanged.
- Added a restart action to the pause screen and bumped the page cache keys to CSS v14 / JS v54. The existing modular art pipeline is untouched.
- Local and public v54 UI smoke confirmed the drawer is collapsed by default, the erase control is gone, generated codes use the `mw1_` prefix, invalid codes are rejected, and a valid code restores successfully. The live page served CSS v14 / JS v54 with no console warnings or errors. Hardware-controller verification remains a live-device check.

## 2026-08-13 — Reusable visual QA pass: road hierarchy cleanup

- Replayed the public opening at gameplay scale after the painted road-family rollout. The continuous path was readable, but four leftover `outdoor-ground` cards still crossed the road and read as misplaced meadow beds.
- Removed only those road overlays. The generated `road-family` atlas remains the modular surface treatment, while the outdoor-ground family continues to serve clearings, bushes, and non-road terrain.
- No collision, movement, combat, NPC, or save behavior changed. Cache key is now `mosswake.js?v=53` so the live edge can be checked without stale code.
- Local and public v53 smoke passed: the road remains continuous and readable, every manifest asset returned successfully, the opening rendered at gameplay scale, and the browser reported no warning/error logs. The live page now serves `/mosswake/mosswake.js?v=53`.

## 2026-08-13 — Reusable visual QA pass: hierarchy and movement scale follow-up

## 2026-08-13 — Reusable visual QA pass: NPC interaction cue alignment

## 2026-08-13 — Reusable visual QA pass: painted road surface family

- Inspected the live opening, movement/combat scale, player run and attack sheets, and the outdoor composition. The strongest remaining visible placeholder was the broad procedural road ribbon: it had a good collision silhouette but still read as a flat painted band compared with the authored trees, fences, rocks, water, and grass.
- Generated `assets/terrain/mosswake-road-family-generated-v1-keyed.png` and the normalized `assets/terrain/mosswake-road-family-generated-v1.png` as a 1248×1248 RGBA 4×4 atlas. The family supplies worn earth straights, curves, junctions, bridge approach, damp variants, and broken-edge tiles in the established Mosswake palette.
- Added the `road-family` manifest slot (manifest v25) and layered fourteen sparse tiles over the existing collision-safe road ribbon. The procedural ribbon, path details, and fallback behavior remain underneath, so offline/slow asset loading does not change gameplay or navigation.
- Bumped the runtime page cache key to `mosswake.js?v=50`. No combat rules changed; the generated Warden directional attack sheet remains the approved combat reference and still owns the sword silhouette.
- The first live visual check exposed oversized atlas cards competing with the road and player. Reduced the integration to eight small, low-contrast worn patches (66–78px) over the continuous ribbon; the atlas remains modular and the collision-safe base remains dominant.
- A second live screenshot still showed faint card edges on a few patches. Reduced the final integration to six 44–48px center-of-road wear marks using low-alpha multiply compositing. The continuous path is now the only strong silhouette; generated art contributes texture without rectangular overlays.
- Bumped the runtime page cache key to `mosswake.js?v=52`. Local syntax, manifest/alpha checks, and local gameplay smoke confirm the road remains readable and uncluttered. The public edge is currently still serving cached `mosswake.js?v=51`; recheck after host propagation before treating the public visual rollout as complete.

- Replayed the opening and inspected the Rowan approach path. The pacing, facing, and idle behavior were working, but the floating `E`/name cue used the broader 92px acknowledgement radius while `interact()` correctly required the nearest NPC to be within 68px. That made the cue appear before the interaction was actually available.
- Updated `drawNpc()` so only the nearest NPC inside the real 68px interaction radius receives the prompt. Nearby NPCs still pause/face the player and use their calmer idle timing, preserving the readable acknowledgement without suggesting an unavailable action.
- No new raster artwork was needed: the existing Rowan/NPC sheets remain the approved visual reference. This is a presentation-contract repair that keeps the modular asset workflow untouched.
- Local syntax, scoped diff, and public startup smoke should be rerun after deployment; the next focused live check is to approach Rowan from outside and then inside the prompt radius, confirming the cue appears exactly when `E` can open his dialogue.

- Re-ran the live opening at gameplay scale after the previous outdoor pass. The ground-family atlas is strong for bushes and worn trail repairs, but its tall meadow cards were visually too assertive when reused for ordinary grass patches; this made portions of the walkable road read as planted beds instead of a clear path.
- Routed ordinary grass tufts and patches through the existing dedicated `outdoor-foliage` atlas at smaller dimensions and lower alpha. The generated `outdoor-ground` atlas remains reserved for authored bushes and sparse road repairs, preserving its high-detail value without repeating large cards across the field.
- Normalized the Warden's run presentation to 54×74 (from 52×70) while keeping the existing run-sheet anchors and directional rows. This keeps the character's silhouette and ground contact consistent between idle and movement states without changing collision or movement speed.
- Bumped cache keys to manifest v24 and page script v48. No new art was generated because the existing foliage family already provides the correct Mosswake material language; the improvement is in assigning each approved family to the right visual role.
- Local syntax, manifest, alpha, and scoped diff checks passed. The current change is ready for a public smoke after deployment; verify road readability, run-size continuity, and four-direction attacks on the live edge.

## 2026-08-13 — Reusable visual QA pass: NPC acknowledgement polish

- Re-ran the opening and inspected the first Rowan interaction path. Rowan's walk cycle and route were working, but a pacing NPC continued moving while the player stood inside the interaction radius, making the prompt feel detached from the character.
- Updated `updateNpcs()` so pacing NPCs hold their current route position and face the player while nearby. Their walk timer slows to an idle-friendly cadence during the pause, then the authored route resumes once the player leaves the interaction radius.
- Preserved route points, collision, dialogue state, interaction radius, and save behavior. No new art was generated because Rowan's existing idle/walk/talk atlas already covers the needed states; this was a presentation-behavior repair.
- Local syntax and scoped diff checks passed. Public verification should specifically confirm Rowan stops, faces the player, shows the E/name cue, and opens the dialogue without fighting the route.

## Status key

- **Integrated / tested** — the asset is loaded by the live renderer and has passed a gameplay smoke test.
- **Prepared** — production-formatted artwork exists, but it still needs runtime integration or a focused visual test.
- **Procedural fallback** — the renderer is intentionally using the current canvas treatment until the listed replacement is ready.

## Living characters

| Asset family | Current files | States / directions | Status | Next quality step |
| --- | --- | --- | --- | --- |
| Lantern Warden | `assets/player/warden-sheet-generated-v1.png`, `assets/player/warden-run-sheet-generated-v1.png`, `assets/player/warden-attack-directions-generated-v1.png` | Idle, 4-direction walk, 4-direction sword attack, dash, hurt | Integrated / tested | Keep the repaired per-frame feet anchors; replace only with a higher-resolution sheet that preserves the same ground line |
| Rowan | `assets/npcs/rowan-sheet-generated-v1.png`, `assets/npcs/rowan-directional-walk-generated-v1.png` | Idle, four-direction walk, map work, talk/reaction | Integrated / tested | Keep both the named talk sheet and the new `.94` feet-anchored walk family as the NPC benchmark |
| Tansy, Brindle, Lumen | `assets/npcs/tansy-fire-generated-v1.png`, `assets/npcs/brindle-directional-walk-generated-v1.png`, `assets/npcs/lumen-map-generated-v1.png`, `assets/npcs/named-npc-activity-generated-v1.png`, `assets/npcs/named-npc-family-generated-v1.png` | Tansy four-direction fire-side idle/stir, Brindle four-direction route walk, Lumen four-direction map-work loop; named-family talk/reaction | Tansy, Brindle, and Lumen dedicated movement integrated | Keep the three directional sheets aligned to the same `.94` feet anchor and 56×76 scale |
| Marlow (outpost trader) | `assets/npcs/named-npc-activity-generated-v1.png` row 4, `assets/npcs/portraits/trader-portrait-generated-v1.png` | Stationary cart-tending role loop; no directional walk required | Four-frame sort/reach/reset/wave cart loop | State-aware dialogue and trader portrait; shared `.92` role anchor | Integrated / focused smoke passed |
| Mossling | `assets/enemies/mossling-sheet-generated-v1.png` | Idle, skitter, pounce, hit recoil | Integrated / tested | Keep as the small-creature reference; refine only for a focused readability defect |
| Distinct enemy family | `assets/enemies/enemy-family-generated-v1.png` | Thornback, Moon Wisp, Ambush Moth, Rootling/Root Warden; idle, telegraph, attack, hit | Integrated / tested | Keep the family atlas as the roster reference; add specialized death/telegraph FX only if a later encounter review needs them |
| Enemy combat effects | `assets/enemies/enemy-effects-generated-v1.png` | Charge, ranged, ambush, impact, and four drop feedback states | Integrated / tested | Keep the atlas as the small-enemy feedback reference; refine only if a focused encounter review finds overlap or low contrast |
| HUD and pickup icons | `assets/ui-icons-generated-v1.png` | Hearts, key, Heartseed, Rootlight, discovery, map, drop, sword, dash, lock, and star states | Integrated / tested | Keep the icon atlas as the UI reference; refine only if a later readability pass finds a specific small-size issue |
| Dialogue and screen surface family | `assets/ui/ui-panels-generated-v1.png` | Dialogue, title, pause, victory, portrait frame, button, objective, map, ability, toast, and divider surface states | Integrated / pending live visual check | Keep typography and contrast in CSS; replace individual atlas cells later without touching game flow |
| Collectibles and exploration items | `assets/items/exploration-items-generated-v1.png` | Key, Heartseed, lantern seed, Dewglass lens, moth token, moonroot cache, hidden chest, and Rootlight lantern states | Integrated / pending live visual check | Keep the atlas as the item reference; replace individual cells only when a specific silhouette or matte issue is found |
| Outpost, cabin, shrine, and entrance structures | `assets/buildings/mosswake-structure-family-generated-v1.png` | Lit/intact/damaged/open outpost, shrine, cabin, roof/wall modules, lantern doorway, root arch | Integrated / pending live visual check | Keep the structure atlas as the building-scale reference; retain procedural facades as fallback |
| Hollow Guardian | `assets/bosses/hollow-guardian-sheet-generated-v1.png` | Phase I idle/attack, phase II transformed attack, phase-break, stagger, defeat | Integrated / tested | Keep the generated sheet as the boss reference; only refine if a focused arena review finds a real readability issue |

### NPC coverage audit (2026-08-13)

| NPC | Location / role | Directions | Idle / walk | Work or special | Talk / grounding | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Rowan | Outpost keeper, overworld start | Down/up/left/right via `npc-rowan-walk`; talk/map via `npc-rowan` | Four-direction authored route walk and proximity pause | Map-work row and proximity pause | Talk/reaction frames; `.94` directional feet anchor | Integrated / tested |
| Tansy | Lantern cook, campfire | Down/up/left/right via `npc-tansy-fire` | Four-frame directional idle/stir loop | Kettle-stir frames and campfire context | Talk portrait and named-family reaction; grounded `.94` directional anchor | Integrated / tested |
| Brindle | Pond ferrier, lower path | Down/up/left/right via `npc-brindle-walk` | Four-frame directional route walk | Ferrier prop context | Talk portrait and reaction remain on named-family frames; grounded `.94` directional anchor | Integrated / tested |
| Lumen | Shrine cartographer, upper field | Down/up/left/right via `npc-lumen-map` | Four-frame directional map-work loop | Open-map, glance, route-trace, reset frames | Talk portrait and named-family reaction; grounded `.94` directional anchor | Integrated / tested |
| Marlow | East outpost lawn, cart trader | Stationary role presentation; no directional walk required | Four-frame cart-tending loop via `npc-activity` row 4 | State-aware dialogue, trader portrait, `.92` role anchor | Integrated / focused smoke passed |

The current game has no dungeon NPC actor; dungeon inhabitants are enemy families and the Guardian. Marlow's body set is intentionally limited to the authored cart-tending role row until gameplay gives him a reason to walk or fight.

## High-value environment and effects queue

| Priority | Family | Current status | Recommended next action |
| --- | --- | --- | --- |
| 1 | Boss telegraph and defeat FX | Integrated / tested | Keep the atlas as the Guardian effect reference; only refine for a readability defect |
| 2 | Outdoor foliage | Integrated / tested | Keep the foliage atlas as the outdoor prop reference; add a second seasonal sheet only if a later visual review shows repetition |
| 3 | Dungeon architecture | Integrated / tested | Landmark/interactable atlas now covers chests, runes, switches, sockets, and reward pedestals |
| 4 | Dungeon ambient props | Integrated / tested | Keep the 4×4 storytelling atlas as the dungeon detail reference; replace individual cells only when a room-specific prop needs refinement |
| 5 | Outdoor props (fences, paths, signs, rocks, pond dock) | Integrated / tested | Keep the generated prop atlas and dedicated pond dock as the reference; only add a second dock variant if a future shoreline composition needs it |
| 6 | Dungeon doors and thresholds | Integrated / tested | Keep the lock/open atlas as the doorway reference; refine individual cells only if a room-specific silhouette needs it |
| 7 | Dungeon hazards | Integrated / tested | Keep the hazard atlas as the water/ember reference; refine only if visual scale or readability needs adjustment |
| 8 | Dungeon floor family | Integrated / tested | Keep the 4×4 floor atlas as the room-surface reference; refine only if a transition edge or material mismatch appears |
| 9 | Dungeon masonry family | Integrated / tested | Keep the wall atlas behind authored room pieces; adjust opacity or panel placement only if a specific room edge competes with a landmark |
| 10 | Rootlight bridge | Dedicated threshold family integrated / tested | Keep `dungeon-bridge` for dormant/open/awakening states; complete a controlled crossing smoke before considering traversal QA closed |
| 11 | Outdoor cliff and ledge family | Integrated / tested | Keep the 4×4 cliff atlas as the outdoor elevation reference; add a new cell only for a specific landmark or material need |

## 2026-08-13 — Repeating visual director pass: room transition reveal

- The next dungeon readability pass identified a transition-layer weakness rather than a missing asset: the new room and its respawned actors were visible through the center of the location veil at the first frame, making the chamber change feel like a title card over a sudden scene pop.
- Tightened the existing 0.72-second room transition so it starts with a clean opaque beat, then reveals the new chamber through a controlled radial opening. The location label and progress rule now track that reveal, preserving a readable handoff without exposing actors before the room is ready.
- No new artwork or gameplay systems were needed. Dungeon geometry, room spawn positions, transition timing, controls, collision, enemy AI, and fallback rendering remain unchanged.
- `node --check` and local browser movement/attack smoke passed. Public `/mosswake/?qa=a658f3c` startup smoke also passed with no console warnings or errors; the full dungeon transition remains the next targeted traversal check.

## 2026-08-13 — Reusable visual QA pass: outdoor density, grounding, and animation

- Inspected the live opening and running overworld at gameplay scale. The main remaining weaknesses were visual competition on the road, placeholder-like procedural grass/bush treatment, trees moving too actively, and Rowan reading as a static floater while holding his map.
- Generated `assets/terrain/outdoor-ground-family-generated-v1.png` as a 1248×1248 RGBA 4×4 atlas. Rows provide meadow grass, worn trail cards, mossy bush variants, and transitional ground details. The keyed/generated source is retained beside it for future matte refinement.
- Added the `outdoor-ground` manifest slot (manifest v23) and routed grass tufts, grass patches, bushes, and sparse road repairs through the atlas while preserving procedural fallbacks, collision, authored routes, and runtime shadows. Grass and patches now suppress themselves inside the road ribbon so the path reads as a deliberate walkable surface rather than a grassy overlay.
- Reduced ambient foliage clutter and tree motion: fewer background blades/leaves, lower sway amplitude, slower tree frame cadence, and calmer procedural crowns. Rowan now follows a short outpost route with a slower, readable walk cycle; named NPC walk frames also alternate rather than remaining on a single pose. Player custom sprites no longer apply an extra horizontal flip to directional sheets, and all attack-direction mapping remains driven by the captured attack vector.
- `node --check`, manifest/alpha validation, local startup/movement/attack smoke, public `/mosswake/?qa=b5fa2a2` overworld smoke, and a four-direction WASD-plus-sword input smoke passed with no console warnings or errors. A final trail-card blend reduced the new road details to low-contrast material variation so they do not read as bright rectangular patches.

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
- `node --check`, `git diff --check`, local start/attack visual smoke, and console warning/error checks pass. Live public start/attack smoke after deployment also passes with no console warnings or errors.

## 2026-08-13 — Repeating visual director pass: contact-plane actor depth

- The dungeon encounter sweep showed that the shared actor sort still compared raw entity centers even though the player, NPCs, and painted enemies use different visual ground offsets. Near-crossings could therefore be ordered a few pixels away from the feet/shadow plane.
- Added a small render-only `actorDepthY()` helper: player depth uses its `+8px` painted presentation, NPC depth uses its `+11px` feet line, and enemies use their authored world contact plane. The existing foreground foliage pass remains last for deliberate occlusion.
- No artwork or gameplay systems changed. Collision, AI, attack timing, telegraphs, hitboxes, anchors, and shadows remain untouched.
- `node --check`, `git diff --check`, local start/movement/attack smoke, and console warning/error checks pass. Live public start/movement/attack smoke after deployment also passes with no console warnings or errors.

## 2026-08-13 — Repeating visual director pass: combat FX occlusion

- The encounter sweep found that the sword trail was drawn inside the player actor pass. When the player crossed an enemy contact plane, that enemy could cover part of the authored slash and make the hit read weakly.
- Added a shared player presentation-bob helper and moved the painted/procedural sword trail to the post-actor combat-FX layer. The trail keeps the exact grounded `+8px` position while now remaining readable above actor silhouettes.
- No artwork or gameplay systems changed. Attack hitboxes, direction, cooldown, timing, movement, actor depth, and foreground foliage layering remain unchanged.
- `node --check`, `git diff --check`, local start/attack visual smoke, and console warning/error checks pass. Live public start/attack smoke after deployment also passes with no console warnings or errors.

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
