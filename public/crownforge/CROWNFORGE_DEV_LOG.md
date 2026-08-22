# Crownforge: Dawn of Kingdoms — Development Log

Date: 2026-08-16
Milestone: Tiny playable settlement prototype — technical hardening and release certification
Working principle: SMALL -> COMPLETE -> POLISHED -> EXPAND

## WHAT EXISTS

- A standalone browser-first Crownforge project under `crownforge/`.
- One warm, hand-painted isometric meadow map with a Crownwardens starting settlement.
- The Crownwardens faction, one Town Center (`Crown Hall`), one starting House (`Hearth House`), one starting storage building (`Waystore`), three villagers, one Crown Guard, an Ashen Camp, a small capped Ashen Raider presence, trees, berry bushes, and stone deposits.
- A clean RTS presentation layer: isometric world projection, camera controls, selection highlights, health bars, resource labels, command deck, settlement intel, and victory panel.
- A compact Crownforge interface language: warm glass panels, parchment/gold/teal accents, and one original generated icon family shared by resources, units, construction, commands, controls, and match outcomes.

## WHAT WAS COMPLETED

- Mouse unit/building selection.
- Drag selection box with Shift-add behavior.
- Right-click movement with formation spacing.
- Grid-based A* pathfinding around completed building footprints.
- Unit collision separation.
- Villager gathering from wood, food, and stone resource nodes.
- Carrying and depositing into the nearest completed storage building.
- Resource counters for Food, Wood, and Stone.
- Hearth House placement with affordability and footprint checks.
- Construction progress assigned to a selected villager.
- Basic melee combat with attack ranges, cooldowns, health, and death.
- Ashen Raider target acquisition when Crownwardens enter its threat radius.
- A compact enemy settlement loop: the Ashen Camp is the enemy central structure, starts with one Raider, replaces Raiders on a slow timer up to a cap of three, pauses replacement while its camp is under direct attack, and sends occasional small attacks toward the Crown Hall.
- Enemy defense behavior: damaging the Ashen Camp marks the attacking player unit as a defense target, allowing an available Raider to respond without creating a larger strategy layer.
- Structure combat: Crown Guards can attack the Ashen Camp, enemy Raiders can attack the Crown Hall, building health and hit feedback are live, and destroyed structures leave a short readable destruction state before cleanup.
- Match outcomes: victory is destroying the Ashen Camp; defeat is losing the Crown Hall; the outcome panel now explains both states and offers a clean replay.
- Camera pan, zoom, middle-drag pan, and readable responsive UI.
- Local browser launch and end-to-end interaction verification.
- Villager quality pass: four-direction empty-handed idle/walk atlas with three looping walk poses.
- Villager action pass: dedicated directional wood-gather, berry-gather, stone-mine, and construction artwork.
- Villager carry pass: dedicated directional wood-bundle, food-basket, stone-sack, and supply-crate artwork.
- Villager combat pass: directional attack, hit-recoil, non-graphic death, and ready poses.
- Villager animation state selection is behavior-driven: walking, gathering, carrying, constructing, attacking, taking damage, death, and idle each choose the appropriate sheet and direction.
- Villager motion now accelerates and brakes instead of snapping to a constant velocity; facing follows the projected travel direction.
- Resource, storage, building, and melee interaction distances now stop villagers outside object footprints; completed Waystore buildings are preferred for deposits.
- Mild local avoidance and hard overlap separation reduce stacking when several villagers share a destination.
- Villager sprite sheets are real-alpha PNGs with aligned feet and grounded painted shadows; the technical neutral matte is removed during asset preparation.
- Map visual pass: replaced the clipped prototype meadow with a warm full-square meadow board that includes authored ochre dirt paths, soft terrain variation, flowers, and pebble accents without a grid overlay.
- Map environment pass: added one cohesive 4x4 original environment atlas with four tree silhouettes, four berry/food bushes, four stone deposits, and four small detail assets (fallen log, stump, flowers, pebble scatter).
- Building pass: added a matching 4x4 construction atlas for Crown Hall, Hearth House, and Waystore, each with foundation, scaffold/partial, near-complete, and completed artwork.
- Construction rendering now selects those four visual stages from live build progress, so a new Hearth House visibly develops from a foundation into a finished building.
- Resource and decoration placement now uses authored variants and grounded painted shadows; trees, bushes, stone deposits, logs, stumps, flowers, and pebbles share the same scale and light treatment.
- Added repeatable world-atlas matte preparation and cache-busted the processed sheets so generated neutral studio backgrounds do not appear as square in-game backplates.
- Re-ran the visual playtest after integration: reset, selection, group movement, food gathering/carrying, building preview/foundation/completion, camera pan, and close map inspection all completed without browser warnings or errors.
- Resource loop pass: Food, Wood, and Stone now have explicit gather amounts, gather timing, interaction ranges, storage capacities, and believable node depletion behavior.
- Resource approach pass: villagers use multiple authored interaction slots around each node, resource cells are treated as path obstacles, and completed storage buildings use edge approach points instead of targeting their centers.
- Drop-off routing now prefers the Waystore but can fall back to another completed storage building when a new structure blocks the preferred route; active paths replan when a completed building changes the walkable grid.
- Carrying is preserved during mid-route retasks. A villager carrying cargo returns it before switching to a new resource or ground order, and full storage stops further harvesting instead of silently discarding resources.
- Depletion feedback: trees resolve to stumps, stone resolves to a small pebble remnant, berry bushes fade and shrink, and depleted nodes are labeled clearly and removed from future selection targets.
- Feedback pass: selected-unit status now reports current work and cargo, multi-selection reports active/carrier counts, and carried villagers show a restrained in-world resource badge with amount.
- Construction menu pass: the command deck now opens a compact blueprint menu containing the current Hearth House without expanding the building catalog.
- Placement validation pass: the preview now distinguishes valid and invalid sites and explains collisions with buildings, resources, ground detail, units, map edges, lack of access space, lack of a selected villager, blocked routes, or insufficient wood.
- Builder assignment pass: a selected Crownwarden villager is assigned to the foundation, builders use cardinal approach points outside the footprint, and cargo-bearing villagers are held back until they can deposit before building.
- Construction health pass: foundation health begins low and rises with live build progress through the existing authored foundation, partial, near-complete, and completed art stages.
- Building information pass: selecting a building now reports its name, current health, construction percentage when unfinished, and current function.
- Construction-stage art remains the canonical building family; this autonomous pass added four targeted Villager task-loop rasters to close the most visible action-depth gap.
- Combat art pass: replaced the old static Crown Guard and Ashen Raider combat visuals with two original four-direction atlases covering idle, walk, attack, and non-graphic death states.
- Combat direction pass: soldier and raider attack poses now use the live direction to the target, so melee attacks no longer default to a single south-facing image.
- Combat approach pass: attackers choose ring positions around a target, preserve a readable melee distance, and re-route around completed buildings and resource obstacles.
- Combat feedback pass: attack timing, live health bars, hit-recoil flash, attack rings, target-loss cleanup, retargeting, and staged death removal are now explicit.
- Combat scope pass: the slice remains one Crown Guard type versus one Ashen Raider type; no additional military roster or advanced combat system was added.
- Music-only audio pass: added the provided `Lantern Under Stone.mp3` as the looped Crownforge musical bed, with browser-safe first-gesture startup and a compact mute toggle. Procedural oscillator cues are disabled for now; gameplay remains silent until a future recorded effects pass.
- UI icon pass: added a single original 4x4 transparent icon atlas and replaced the resource letters, construction glyph, outcome glyph, and control symbols with matching Crownforge artwork.
- Resource clarity pass: Food, Wood, and Stone cards now show semantic icons, live stored/capacity values, colored capacity bars, and native hover titles with the exact stored amount.
- Selection clarity pass: the intel panel now distinguishes group, worker, combat unit, building, resource node, and no-selection states with matching icons; selected resource nodes report remaining capacity and the intended gather command.
- Command feedback pass: construction now exposes its current cost/readiness state, placement mode has a dedicated foundation readout with valid/invalid color treatment and the simulation’s reason, and the canvas cursor changes between normal, command-target, valid-site, and blocked-site states.
- Controls pass: added a compact Field Manual popover covering click, drag, Shift, right-click, WASD, wheel, middle-drag, and Escape; construction and reset actions now include keyboard hints/tooltips, and Escape closes menus or placement cleanly.
- Outcome and world-feedback pass: victory/defeat panels now switch between original crown/pennant icons, selected units show a clearer bracketed ground marker, selected paths end in a destination reticle, health bars have rounded readable fills, and the canvas placement label is concise while the UI carries the detailed reason.
- Responsive UI pass: kept the interface usable at 1280x720, 1024x640, and the supported 980x620 minimum by collapsing secondary faction/resource content and keeping the command deck and controls panel within the viewport.
- Complete quality audit: reviewed the playable map, every active asset family, animation/state selection, movement, pathing, collision, gathering, construction, combat, enemy pacing, UI, camera, controls, victory, defeat, restart, and browser runtime behavior. No placeholder art or unrelated art style was found in the playable portion; targeted Villager task-loop artwork was generated only for the identified action-depth gap.
- Directional rendering fix: villager motion, task, carry, combat, hit, and death atlases now sample the live `unit.facing` column instead of always rendering column 0. The authored directional artwork now materially changes in play.
- Movement finish fix: ordinary move commands now transition to `idle` after the path and braking settle, preventing units from visually walking in place and keeping selection status truthful after arrival.
- Compact resource fix: Stone remains visible beside Food and Wood at the 980x620 minimum layout with compact icon/card sizing; players can now see all three totals at every supported target size.
- Debug cleanup: removed the undocumented `G` keyboard coordinate/grid readout and its renderer path so no developer-only overlay is exposed in the playable slice.
- Full-match quality check: completed a fresh player assault from Crown Guard versus opening Raider through Ashen Camp destruction, then replayed from the victory panel; also ran an idle defense match through Crown Hall defeat and verified the defeat panel.

## KNOWN ISSUES

- Villager walking is frame-animated and directional. Wood, food, stone, and construction now use compact four-frame directional loops; carrying, optional worker combat/hit/death, and Crown Guard/Ashen Raider military action rows remain restrained single-pose refinements.
- Resource routing now prefers screen-front interaction slots, which keeps villagers readable beside tall resources; a small number of tall-object/building occlusion cases remain for a future art/approach-point pass.
- Construction supports up to four selected builders with distinct perimeter work slots; multi-builder speed bonuses are intentionally not part of this slice yet.
- The building stages are still four threshold-based visual states; they do not yet have a construction-specific multi-frame worker loop, dust, sound, or a richer phase transition treatment.
- Combat uses one authored pose per direction and action row rather than a large animation library; the timing and silhouette are readable at current RTS distance, but short multi-frame attack/walk loops should be hand-tuned later.
- Resource totals have storage caps but no broader food/stone consumption systems yet; this pass intentionally stops at the complete gather/deposit loop.
- Procedural gathering, deposit, construction, combat, damage, death, placement, outcome, and UI sound cues are intentionally disabled. Only the looped music bed is active in this pass.
- The generated villager sheets use a shared four-direction camera treatment; diagonal facing transitions are readable, but the direction-to-cell mapping should be rechecked after any future camera-angle change.
- The generated villager sheets now use all four authored direction columns in live rendering; the direction-to-cell mapping should still be rechecked after any future camera-angle change.
- The generated meadow is used as a clipped board texture rather than a fully tile-authored terrain system.
- Buildings use a single footprint and do not yet support rotation or placement ghost snapping; the current art does not require rotation.
- The enemy has no workers or economy; its AI is intentionally limited to a capped Raider garrison, slow replacement, local defense, and occasional Crown Hall raids. There is no player AI, fog of war, or ranged combat.
- No save/load, recorded sound effects, tech tree, population training, multiple maps, or campaign layer exists by design.
- There is no separate main menu yet; the current slice intentionally opens directly into the playable meadow and offers Reset Slice / Play Again.
- Tooltips now use the Crownforge-styled `#ui-tooltip` surface for existing control/resource explanations; a larger contextual help system remains deferred until there are more commands to explain.
- Edge scrolling and controller/touch bindings are not implemented; camera movement is currently WASD/arrow, wheel zoom, and middle-drag pan, matching the small desktop slice.
- The compact layout now keeps Food, Wood, and Stone visible; further narrow-window work should preserve that all-resource guarantee.
- The prototype is intentionally browser-first because no Godot runtime was available in the current workspace; the simulation boundaries are kept engine-agnostic for a future engine migration if needed.

## ASSETS CREATED

- `assets/crownforge-asset-atlas.png` — original transparent atlas containing Crown Hall, Hearth House, Waystore, Villager, Crown Guard, Ashen Raider, tree, berry bush, and stone deposit.
- `assets/crownforge-meadow.png` — original warm meadow board artwork used as the clipped playable terrain surface.
- `assets/villager-motion-atlas.png` — four-direction empty-handed idle and three-pose walk atlas.
- `assets/villager-task-atlas.png` — four-direction wood, food, stone, and construction pose atlas.
- `assets/villager-gather-wood-loop-v1.png` — original four-direction, four-frame wood-gather loop with a shared villager silhouette and tool-contact rhythm.
- `assets/villager-gather-food-loop-v1.png` — original four-direction, four-frame berry/food-gather loop with the same Crownforge camera, scale, and lighting treatment.
- `assets/villager-gather-stone-loop-v1.png` — original four-direction, four-frame stone-mining loop with grounded contact and readable tool motion.
- `assets/villager-construct-loop-v1.png` — original four-direction, four-frame construction loop for foundation and building work.
- `assets/villager-carry-atlas.png` — four-direction wood, food, stone, and supply-carry pose atlas.
- `assets/villager-combat-atlas.png` — four-direction attack, hit, death, and ready pose atlas.
- `assets/crownforge-meadow-v2.png` — original warm meadow board with integrated dirt paths and small environmental detail treatment.
- `assets/crownforge-environment-atlas-v2.png` — original transparent 4x4 family for tree, berry, stone, and small environmental detail variants.
- `assets/crownforge-building-stages-v2.png` — original transparent 4x4 family covering three buildings across foundation, partial, near-complete, and completed stages.
- `assets/crownforge-soldier-combat-atlas-v1.png` — original transparent four-direction Crown Guard atlas with idle, walk, attack, and death rows.
- `assets/crownforge-raider-combat-atlas-v1.png` — original transparent four-direction Ashen Raider atlas with idle, walk, attack, and death rows.
- `assets/crownforge-ashen-camp-v1.png` — original transparent Ashen Camp structure with charcoal timber, stone, red-brown shelters, firelight, and a readable enemy pennant.
- `assets/crownforge-ui-icons-v1.png` — original transparent 4x4 interface icon family for the Crownforge seal, resources, units, construction, commands, health, population, deposit, outcomes, cancel, and controls.
- `assets/lantern-under-stone.mp3` — provided looped musical bed for the current Crownforge slice.
- `tools/prepare-villager-atlases.mjs` — repeatable technical matte removal and alpha preparation for the generated sheets.
- `tools/prepare-world-atlases.mjs` — repeatable neutral-matte removal and alpha preparation for the environment and building-stage sheets.
- All generated art is original to Crownforge and uses a shared warm historical RTS treatment. No Age of Empires artwork or assets were used.

## SYSTEMS CREATED

- `src/config.js` — faction, resource, unit, building, camera, villager-atlas, and directional combat-atlas registries.
- `src/pathfinding.js` — bounded eight-direction grid A* with diagonal corner checks.
- `src/simulation.js` — entities, commands, gathering, storage, construction, staged health, building-edge approach routing, placement validation, local access checks, collision resolution, combat target acquisition, melee ring slots, line-of-sight checks, attack timing, damage, retargeting, death cleanup, capped enemy replacement, enemy defense targeting, timed Crown Hall raids, structure combat, victory/defeat checks, selection, victory, resource economy, unit facing, visual states, smooth movement, settled move completion, interaction ranges, local avoidance, authored environment variants/static map details, resource approach slots, storage-edge routing, capacity-safe deposit, cargo-preserving retasks, dynamic path replanning, resource-cell blocking, and depletion state.
- `src/renderer.js` — world projection, terrain surface, depth sorting, generated art rendering, environment/building atlas variants, construction-stage selection, enemy camp rendering, destroyed-structure fade, four-direction villager atlas/state selection with frame-column action loops, directional combat-atlas selection, walk/attack timing accents, hit flash, attack ring, selection/path overlays, placement preview, destination reticles, selection brackets, depleted resource silhouettes, resource capacity labels, compact carried-resource badges, and removal of the developer coordinate overlay.
- `src/input.js` — RTS pointer commands, selection box, camera controls, construction preview updates, build mode, keyboard shortcuts, cursor-state feedback, Escape/menu cancellation, and removal of the developer-only `G` debug toggle.
- `src/main.js` — runtime loop, resource and selection presentation, compact construction-menu binding, building selection information, placement readout, controls popover, build readiness messaging, reset/victory handling, and status messaging.
- `src/audio.js` — gesture-unlocked looped music playback, mute state, volume control, and quiet compatibility methods for the future recorded-effects layer.
- Simulation timing hardening — `src/simulation.js` advances gameplay through a bounded fixed 60 Hz step so economy, movement, construction, combat, AI, and animation do not diverge with render cadence; renderer ripple age now advances from measured render time.
- `index.html` / `styles.css` — Crownforge resource cards, semantic selection identity, Field Manual controls panel, placement readout, original command/outcome icon integration, responsive breakpoints, keyboard hints, and cursor/availability states.

## VALIDATION RECORD

- Syntax: `node --check` passed for all source modules; `git diff --check` passed for the Crownforge changes.
- Simulation smoke test: corrected end-to-end script passed wood gathering/deposit, Hearth House placement/construction completion, Crown Guard combat, raider death, and victory.
- Browser visual playtest: repeated Food, Wood, and Stone orders; path travel; correct task/carry artwork; storage return; capacity-full behavior; multi-villager spacing; and current-task/cargo UI were exercised.
- Awkward-case simulation checks: mid-carry retask preserved the original cargo before switching resources; completed buildings forced route recalculation; placing a building over a villager was rejected; Food/Wood/Stone nodes depleted to zero; and a nearby raider could interrupt and defeat a gathering villager without corrupting the simulation.
- Runtime logs: the final browser regression reported no warning or error entries.
- Asset verification: all four villager atlases plus the new environment and building-stage atlases are 1254x1254 RGBA PNGs with transparent neutral-matte backgrounds; the generated sheets were also visually composited over meadow green to check for square backplates and obvious halos.
- Construction validation: direct simulation checks covered clear placement, resource/tree obstruction, structure obstruction, unit obstruction, map-edge rejection, local access space, selected-builder route availability, foundation placement, health/progress growth, completed footprint blocking, and a post-construction resource route that stayed outside the new building.
- Construction browser playtest: opened the construction menu, selected the Hearth House blueprint, inspected a green valid preview, inspected red previews for a resource, an occupied structure, and a no-villager selection, placed a foundation, watched the 4% and partial stages, confirmed the completed stage and `260 / 260 HP · Population housing` building panel, then sent villagers across the map with no current-page browser warnings or errors.
- Combat simulation checks: 1v1 Crown Guard versus Ashen Raider completed with the soldier alive and idle after victory; a four-soldier group surrounded and defeated one raider with a minimum observed pair spacing of `0.86`; target loss retargeted the Ashen Raider to a second soldier; and a building-obstacle battle confirmed no line-of-sight attack through the building and no soldier entry into its footprint.
- Combat browser playtest: selected the Crown Guard, ordered a 1v1 engagement, visually inspected directional approach and melee contact beside trees/stone, confirmed attack rings, health bars, victory cleanup, and the new combat silhouettes; the current-page browser log reported no warning or error entries.
- Enemy simulation checks: no-order play reached a readable capped garrison of three Raiders and eventually destroyed the Crown Hall; the resulting phase was `defeat`. A player assault that first defeated the opening Raider and then committed the Crown Guard to the Ashen Camp reached `victory`; while the camp was under direct attack it did not spam replacements or raids.
- Complete browser match: reset the slice, selected the Crown Guard, right-clicked the opening Ashen Raider, watched the 1v1 resolve, then watched the surviving Guard automatically close on and destroy the Ashen Camp. The browser reached the `ASHEN CAMP BROKEN` panel at approximately `0:50` with the Guard idle at `49 / 85 HP`; the final screenshot showed the clean outcome panel and no console warning/error entries.
- UI browser pass at 1280x720: visually checked the generated icon family, semantic resource cards, group selection panel, compact command deck, controls popover, construction menu, valid foundation preview, invalid placement reason, placement cursor states, Escape cancellation, and the updated selection/path/health feedback. No browser warning or error entries were reported.
- UI browser pass at 1024x640 and 980x620: verified responsive topbar/resource reduction, readable selection panel, in-viewport command deck, controls popover bounds, hidden cancel state outside placement, and no browser warning or error entries.
- RTS control regression: click-selected the Crown Guard, Shift-added a villager, drag-selected a group, right-clicked a meadow and a berry node, observed movement/gathering/carrying status changes, opened construction with the menu and B hint, inspected valid and invalid previews, and confirmed Escape closed controls/placement state.
- Interface information regression: selected a Food node and confirmed `RESOURCE NODE` plus remaining capacity text; selected a Waystore and confirmed `BUILDING` plus health/function text; the build option changed between `READY`, `SELECT VILLAGER`, `DEPOSIT CARGO`, and `NEED WOOD` states during the playtest.
- Complete quality browser pass: freshly launched the slice, inspected the 1280x720 map and asset composition, completed the Crown Guard/Raider/Camp victory sequence, visually checked combat health/direction/ground contact, verified victory replay reset, ran the idle Raider defense to the Crown Hall defeat panel, and found no console warning or error entries.
- Directional/animation validation: audited every villager atlas visually, corrected live direction-column sampling, inspected a live wood-gather/carry scene after the fix, and confirmed ordinary movement settles to `Idle` rather than leaving a unit in a walk loop.
- Source-level quality checks: resource scenarios reached cap/depletion behavior without placing villagers inside resource footprints; group movement ended with all units idle and no unit inside a building footprint; combat defeated the opening Raider with the Crown Guard alive; full victory completed at about 50 seconds; idle defeat completed at about 95 seconds.
- Compact/runtime cleanup validation: at 980x620 all three resource cards were visible, the removed `G` overlay produced no `GRID` readout, and the final browser logs remained empty. The browser evaluation surface did not expose its performance clock or heap profile; direct fixed-step probes and Canvas diagnostics were used instead, and the canvas workload remains bounded to the small slice.

## WHAT SHOULD BE POLISHED NEXT

1. Hand-tune short multi-frame construction and combat loops while preserving the feet anchor and camera scale.
2. Resolve the remaining resource/building occlusion cases and test more deliberate approach points without letting villagers enter object footprints.
3. Introduce richer contextual tooltips only when the command set grows enough to justify them; keep the current Field Manual compact.
4. Consider a focused authored construction/combat/gather/deposit sound pass only after the current visual loops have been hand-tuned.
5. Revisit enemy camp readability, wave pacing, and defensive staging only after more playtest evidence; keep the current capped behavior intact for now.
6. Replace the integrated board texture with a proper authored tile/terrain material only after the current map’s visual language is locked.

## VERTICAL SLICE READINESS

Scores are for this deliberately tiny playable slice, not for a future full RTS. The core should remain in polish mode until the below-8 areas reach at least 8 through another focused pass.

- Visual quality: 8/10 — Original assets are cohesive, readable, grounded, and free of visible placeholders. Remaining risk is occasional large-object occlusion and the meadow still being one authored board texture rather than a tile-authored terrain system.
- Animation: 8/10 — Directional villager rendering is correct, walking remains readable, and wood, food, stone, and construction now use compact four-frame action loops. Carrying, optional worker combat/hit/death, and the two military units still need matched multi-frame refinement.
- Movement: 8/10 — Acceleration, braking, direction changes, local avoidance, collision separation, believable interaction distances, and settled move completion all behave cleanly in the slice. Avoidance is intentionally mild rather than formation-grade.
- Pathfinding: 8/10 — A* routes around completed structures and resource cells, re-plans when routes change, and handles approach slots. The system still reports a blocked route instead of offering a deeper recovery policy in intentionally sealed situations.
- Economy: 8/10 — Food, Wood, and Stone all gather, carry, deposit, cap, deplete, and communicate state. There is intentionally no consumption or production economy yet, so the loop is complete but narrow.
- Construction: 8/10 — Placement validation, foundation, live health/progress, four authored stages, multi-builder routing, and completion work. It remains one blueprint with no construction sound/dust loop.
- Combat: 8/10 — One melee type against one enemy type has directional approach/attack art, range, timing, health, death, retargeting, obstacle-aware routing, and readable outcomes. Action animation variety is intentionally limited.
- AI: 7/10 — The capped Raiders defend, replace slowly, raid occasionally, and support a complete victory/defeat match. It is below 8 because behavior is intentionally simple and the enemy has no worker economy, broader defense staging, or richer recovery when a raid is disrupted.
- UI: 8/10 — Resources, selection identity, task/cargo, construction readiness, placement reasons, cursor feedback, controls, victory, defeat, replay state, and Crownforge-styled tooltips are clear at supported sizes. The command set is intentionally small.
- Stability: 9/10 — Source syntax, diff checks, simulation scenarios, full victory, full defeat, replay reset, compact layout, and browser console checks all passed. The only test limitation was the browser performance API being unavailable to the evaluation surface.
- Overall game feel: 8/10 — The slice now feels like a coherent small RTS rather than a systems demo, with strong visual identity and a complete match loop. Animation depth and enemy behavior are the remaining quality ceiling.

No major expansion is recommended yet. The next work should raise Animation and AI to 8+ while preserving the current asset language, control clarity, and small complete match.

## LANDMARK SCALE AND PALISADE ORIENTATION CLARITY — 2026-08-19

- Enlarged the Crown Hall from a 6x5 gameplay footprint / 900px render size to an 8x7 court-sized footprint / 1120px render size. The villager scale is unchanged; the larger collision clearance keeps units outside the visible patio and rear wings while leaving the landmark visually dominant without clipping its highest tower at the opening camera.
- Confirmed that Palisade Wall orientation is already complete in the current placement system: choose `PALISADE WALL`, then click-drag from the desired start toward the desired end. The line snaps to the nearest of eight compass directions and builds the full snapped segment run on release.
- Clarified the wall workflow in the blueprint detail, tooltip, and placement feedback so the direction control is discoverable without adding a separate wall system or changing the existing drag interaction.
- No new artwork was required; the existing original Crown Hall and Palisade assets remain the canonical Crownforge building family.

### STILL NEEDS WORK

- The Crown Hall is intentionally larger without adding a new camera mode; close zoom and extreme map-edge panning should be rechecked after future landmark art changes.
- Palisade placement uses drag direction for the eight-way snap and does not yet expose a separate keyboard rotation key; add one only if playtests show drag direction is insufficient.

## MUSIC-ONLY AUDIO PASS — 2026-08-19

### WHAT CHANGED

- Added the provided `Lantern Under Stone.mp3` to the Crownforge asset family as the single looped musical bed.
- Replaced the procedural oscillator implementation in `src/audio.js` with HTML audio playback. The track loops, starts on the first permitted user gesture, and does not interrupt when the match resets.
- Added a compact lower-right `MUSIC ON / MUSIC OFF` control with accessible pressed state and synchronized tooltip text.
- Disabled all temporary UI, movement, gathering, construction, combat, damage, death, placement, victory, defeat, and building-destruction sound cues. Existing call sites remain quiet compatibility methods for a future authored effects pass.

### VALIDATION

- Source and public audio modules pass `node --check`.
- Both source and public MP3 copies are valid MPEG Layer III audio files.
- Browser UI check confirmed the music button toggles between `MUSIC ON` and `MUSIC OFF`, updates `aria-pressed`, and updates its tooltip.
- The existing Crownforge simulation regression remains green.

### STILL NEEDS WORK

- Browser autoplay policy means the music begins after the first user gesture when autoplay is restricted; the control remains available immediately.

## CROWN HALL MONUMENTAL SCALE PASS — 2026-08-19

### WHAT CHANGED

- Enlarged the Crown Hall's rendered landmark size from `1120px` to `11200px` while keeping villager and Crown Guard artwork at the established human scale.
- Expanded the Crown Hall gameplay footprint from `8×7` to `18×16` world units and increased its clearance so the enormous patio, wings, and tower remain collision-safe rather than becoming a visual layer units can walk through.
- Moved the three opening villagers to the enlarged Hall's clear south approach so the reset state does not spawn workers inside the new structure footprint.

### STILL NEEDS WORK

- The requested monumental scale is intentionally extreme and should be visually re-evaluated at normal zoom, close zoom, and map-edge panning before the next deployment.
- If the landmark occupies too much of the opening view during playtesting, adjust the opening camera framing or reduce only the artwork scale after reviewing the live screenshot; do not shrink the villagers to compensate.

## CROWN HALL HIGH-RESOLUTION AND MAP SCALE PASS — 2026-08-19

### WHAT CHANGED

- Generated a new Crown Hall raster, preserving the approved monumental architecture, blue-and-gold Crownwarden palette, three-quarter isometric perspective, flags, towers, courtyard, and grounded lighting.
- Removed the generated studio checkerboard through a repeatable edge-connected matte cleanup and stored the final asset with real RGBA transparency.
- Upscaled the cleaned replacement to `4608×3072` so the existing `11200px` world-space landmark draw has substantially more source resolution and no longer relies on the older `1536×1024` texture.
- Increased the world board from `90×73` to `180×146` while keeping the existing sparse settlement content in place rather than filling the new space with clutter.
- Lowered the camera minimum zoom from `0.36` to `0.08` and set the opening view to `0.16`, allowing players to frame the enormous Hall and pan across the expanded meadow.
- Updated the asset dimensions, cache identity, and public mirror so the browser loads the new Hall instead of a cached older raster.

### VALIDATION

- Final Crown Hall asset is a `4608×3072` RGBA PNG with transparent background.
- Source modules pass syntax checks and the Crownforge regression suite remains green.

### STILL NEEDS WORK

- The new world area is intentionally open and sparse; future terrain content should be added only after the monumental Hall and new camera range are visually reviewed in play.
- A dedicated music volume slider and recorded gameplay effects are intentionally deferred until the music-only experience is reviewed in play.

## WHAT SHOULD NOT BE BUILT YET

- Additional civilizations, ages, technologies, campaigns, procedural maps, naval systems, ranged units, advanced AI, multiplayer, diplomacy, trading, or large content catalogs.
- A generic entity/component framework, save system, or content editor before this slice has been playtested and its visual language has been locked.
- More buildings or units merely to make the prototype look larger.
- Enemy workers, an enemy resource economy, multiple camps, diplomacy, technology research, or sophisticated military planning.

## ANIMATION ARCHITECTURE PASS — 2026-08-15

### UNITS AUDITED

- Villager — worker, gatherer, carrier, builder, and optional melee participant.
- Crown Guard — player basic melee unit.
- Ashen Raider — enemy basic melee unit.

### STATES AND DIRECTIONS AUDITED

- Villager: idle, walking, gather wood, gather food, mine stone, carry wood, carry food, carry stone, carry supplies, construct, attack, taking damage, and death.
- Crown Guard: idle, walking, attacking, taking damage, and death.
- Ashen Raider: idle, walking, attacking, taking damage, and death.
- All three unit families were audited across four authored camera-facing directions. The direction mapping is world `+Z`, `+X`, `-X`, `-Z` projected into screen-left/front, screen-right/front, screen-left/back, screen-right/back. No mechanical mirroring is used, and no gameplay-critical direction is missing for the current fixed camera.
- Eight directions remain an explicitly documented future refinement only if a camera or close-zoom test demonstrates a real readability need.

### ASSETS GENERATED, REJECTED, OR REPLACED

- No new raster artwork was generated in this pass because every gameplay-critical state and direction already had an original, alpha-prepared Crownforge asset.
- No existing asset was rejected or replaced. The villager motion/task/carry/combat atlases and the Crown Guard/Ashen Raider combat atlases remain the canonical visual references.
- Missing multi-frame action refinements were explicitly identified in `CROWNFORGE_ANIMATION_COVERAGE.md`: villager gathering/carrying/construction/attack/hit/death loops; Crown Guard and Ashen Raider walk/attack/death loops; and dedicated melee hit/recoil rows.

### ANIMATION-SYSTEM CHANGES

- Added `src/animation.js` as the data-driven animation source of truth for all existing units.
- Separated gameplay intent, semantic animation state, animation time/phase, render frame, facing, collision radius, interaction radius, and shadow/ground-anchor metadata.
- Added shared frame resolution so the live renderer and inspection harness use the same atlas/row/column logic.
- Added `CrownforgeAnimationSystem` state transitions with clean phase resets and subtle walk-cycle frame timing.
- Added named event records for `footstep`, `tool_contact`, `resource_collected`, `attack_hit`, `construction_strike`, `deposit_complete`, and `death_complete`.
- Synchronized gameplay effects to events: resources are collected at tool contact, melee damage at attack hit, construction health/progress at construction strike, deposits at deposit complete, and dead-unit cleanup records death complete.
- Updated `src/simulation.js` to store animation state/time/phase/frame and recent events per unit without changing the gameplay roster or command scope.
- Updated `src/renderer.js` to consume the shared animation registry and live `unit.facing` for villager, Crown Guard, and Ashen Raider rendering.
- Added developer-only `dev/animation-inspection.html` and `dev/animation-inspection.js`; it is not linked from the playable interface and exercises every registered unit/state/direction/frame with pivot, shadow, collision, and interaction guides.

### ANIMATION VALIDATION

- Source checks: `node --check` passed for `src/animation.js`, `src/simulation.js`, `src/renderer.js`, `src/main.js`, `src/input.js`, and `dev/animation-inspection.js`; `git diff --check` passed.
- Harness check: exercised 92 Villager/Crown Guard/Ashen Raider state/direction combinations. Every authored asset loaded, every frame mapping resolved, and the harness reported no browser warning or error entries.
- Live game check: launched the playable slice, visually inspected initial idle units, wood gathering/carrying, food gathering under enemy interruption, stone mining/carrying, construction at 74% and completion, directional Crown Guard versus Ashen Raider combat, Ashen Raider death, Ashen Camp assault, victory, and replay reset.
- Full match result: the Crown Guard defeated the opening Ashen Raider and destroyed the Ashen Camp; the victory panel appeared at approximately `DAYBREAK 0:51`, replay reset returned to `DAYBREAK 0:00` with three villagers selected, and browser warning/error logs remained empty.
- Event smoke checks: source-level scenarios observed `footstep`, `tool_contact`, `resource_collected`, `deposit_complete`, `construction_strike`, and `attack_hit` records while resource, construction, and combat outcomes remained correct.

### REMAINING DEFICIENCIES

- Current task, carry, construction, attack, hit, and death art is mostly one authored pose per direction. The slice is readable, but these action loops are not yet the final quality standard.
- Crown Guard and Ashen Raider damage states currently use an explicit idle fallback plus hit-flash feedback; a dedicated hit/recoil row is still future polish.
- No separate dynamic shadow sprites exist; current shadows are painted into the generated frames and must be rechecked if render scale or camera angle changes.
- Animation events now include `attack_start`, `attack_whiff`, and `damage_taken`; the procedural effects layer consumes the relevant events without introducing a new content system.

### NEXT ANIMATION PRIORITY

1. Hand-tune a subtle multi-frame villager construction loop with a readable construction-strike pose.
2. Hand-tune villager gather/carry loops for wood, food, and stone while preserving feet, shadow, scale, and four-direction identity.
3. Hand-tune one shared multi-frame melee attack and a dedicated hit/recoil row for Crown Guard and Ashen Raider.
4. Re-run the inspection harness and a complete live match after each atlas change.

The animation audit is complete for the current content. No new units, buildings, resources, civilizations, maps, technologies, ages, or gameplay systems were added.

## MOVEMENT QUALITY PASS — 2026-08-15

### BASELINE MOVEMENT FAILURES FOUND

- The path planner operated on raw walkable cells without enough unit-radius clearance, so a route could be technically valid while bringing a unit too close to a building or resource footprint.
- A blocked destination could be found through `nearestWalkable`, then accidentally overwritten with the original blocked point. Source checks reproduced a route whose final waypoint was inside the Hearth House.
- A path smoothed before a new building was placed could continue along a long direct segment through the new footprint because only the next waypoint cell was checked.
- Pairwise unit separation could push a moving unit into a static object, and mild avoidance could jitter when units were already at rest.
- Walking animation playback was intent-based rather than tied to actual velocity. Direction could also change too readily while a unit was slowing or being redirected.
- The renderer added procedural vertical bob to unit assets even though the authored frames already contained the ground-contact treatment.

### MOVEMENT AND PATHFINDING CHANGES

- Added unit-aware path-cell clearance in `src/simulation.js`. Completed buildings, foundations, construction footprints, trees, berry bushes, and stone deposits now participate in route validation without allowing a unit to enter their footprint.
- Added continuous segment checks for live routes. This catches a newly placed building across a previously smoothed segment and triggers a bounded re-plan instead of letting a unit walk through it.
- Blocked destinations now remain blocked. A* may finish on a safe nearby cell, but the simulation no longer replaces that endpoint with the original blocked target.
- Added exact continuous object clearance at the unit position, including a small static margin. This keeps group collision separation from pushing units into buildings or resource objects and keeps map-edge positions safe.
- Resource approach cells now use exact point clearance at the interaction slot rather than treating every adjacent grid cell as unusable. This preserves believable gathering positions while still stopping a unit from entering a tree, berry bush, or stone deposit.
- Added stuck detection, a short re-path cooldown, and command-aware re-planning for move, gather, return, build, and attack routes. A blocked unit pauses, then re-plans from its current position without teleporting or snapping.
- Kept local avoidance deliberately mild. Moving units soft-separate before hard collision separation, resting units do not continually push one another, and the existing resource/combat approach slots continue to distribute arrivals.
- Construction footprints are solid from foundation placement onward, so later routes cannot cut through a partially built structure.
- Path smoothing remains conservative and is now checked against the same unit-aware continuous movement constraints at runtime.

### LOCOMOTION AND FACING CHANGES

- Added stabilized facing updates with angular hysteresis. Facing follows meaningful desired/actual movement and only changes when the new direction is materially better, preventing flicker at diagonals, around corners, and during braking.
- Added per-unit `motionSpeed` and `animationPlaybackRate`. Walking clips now slow with acceleration/braking and stop advancing when a unit is stationary; idle, task, carry, build, attack, and death states retain their authored timing.
- Removed renderer-side vertical bob from villager, Crown Guard, and Ashen Raider drawing. The world-space ground anchor and authored painted shadow remain fixed, so units stand on the terrain instead of hovering or pulsing through it.
- Kept the current four authored camera directions as the art standard. Diagonal travel resolves to the closest readable authored direction with hysteresis; no mechanically mirrored or south-only attack fallback was introduced.

### DEVELOPER STRESS SCENARIO

- Added `dev/movement-stress.html` and `dev/movement-stress.js`. The page is developer-only and is not linked from the playable slice.
- The scenario contains dense alternating building footprints, narrow lanes, open ground, resources in travel lanes, two five-villager groups, crossing routes, intersecting routes, a blocked building-center destination, a dynamically placed blocker, blocker removal, and a repeated retask storm.
- The harness reports footprint violations, map-boundary violations, stuck units, minimum pair spacing, active paths, and the last simulation event. `PASS` requires no static-footprint intrusion, boundary escape, or stuck timeout.
- Browser stress validation passed for cross lanes, intersect paths, blocked destination, dynamic blocker placement/removal, and retask storm. The 10-unit scenario reported zero footprint violations, zero boundary violations, zero stuck units, and no browser console logs. Minimum observed pair spacing stayed above the configured hard collision radii.

### MOVEMENT VALIDATION

- Source direction matrix: Villager, Crown Guard, and Ashen Raider were each driven through N, NE, E, SE, S, SW, W, and NW travel. All 24 cases settled to `Idle` with no remaining path, no stuck timer, and a zero or near-zero final motion speed.
- Source obstacle checks: blocked building destinations ended on safe nearby points; a new building placed across an active route caused the unit to re-plan around it; no final position entered the padded building footprint.
- Source economy check: a villager reached an exact wood interaction slot, gathered through depletion, returned to the Crown Hall, deposited, and never crossed the resource clearance radius. The observed states included `walk`, `wood`, and `carry:wood`.
- Source construction check: a placed Hearth House reached 100% progress and 260/260 HP, with the builder arriving outside the construction footprint and returning to `Idle` on completion.
- Live browser check: reset the slice, moved the three-villager group through open ground, selected and moved the Crown Guard, assigned wood, visually inspected walking/carrying paths, retasked a carrying group to food, placed a Hearth House, watched the foundation progress, and confirmed completed construction. Browser warning/error logs remained empty.
- Visual inspection confirmed the live path lines terminate around objects rather than through them, group spacing remains readable, and units retain stable ground contact during idle, walking, carrying, and construction.

### REMAINING MOVEMENT WEAKNESSES

- The fixed camera still uses four authored directions. Eight distinct art directions are not justified yet, so diagonal travel intentionally uses the nearest authored view.
- The local avoidance model is intentionally lightweight. It prevents piles and hard overlap in the current slice, but it is not a formation system and may report a blocked route in a deliberately sealed corridor rather than inventing a new route.
- Terrain is still a single authored meadow board; there is no slope-aware navigation or heightfield movement to solve yet.
- Villager task, carry, construction, and combat clips remain mostly single-pose authored action rows. Locomotion synchronization is now strong, but action-loop depth remains the next animation-quality ceiling.

The movement pass is complete for the current roster and map scope. No new units, buildings, resources, civilizations, maps, technologies, ages, or gameplay systems were added.

## ECONOMIC TASK LOOP PASS — 2026-08-15

### SCOPE

This pass focused on the complete existing FOOD / WOOD / STONE gathering loop and its visual synchronization. No new content category was added. The current original Crownforge villager task and carry atlases were retained after an asset audit found that every required task and direction already had a coherent authored visual.

### WHAT WAS COMPLETED

- Audited the villager state graph from idle and command through walking, resource interaction, task-specific work, carrying, storage return, deposit, construction, interruption, depletion, damage interruption, and death cleanup.
- Added six deterministic perimeter reservation slots to each resource node. Wood, food, and stone assignments now distribute selected villagers around the same node instead of sending every worker to one coordinate.
- Added four deterministic perimeter construction slots to foundations. A selected group can now assign multiple villagers to one Hearth House while preserving separate approach positions and local collision clearance.
- Kept the existing construction duration rule stable while allowing multiple builders to work simultaneously. Each builder emits a construction event, but the building advances once per work interval so a larger selected group does not silently multiply build speed in this slice.
- Added reservation release hygiene for retasks, resource depletion, target loss, building destruction, construction completion, and unit death. No stale resource or construction claim remains attached to a removed worker.
- Added exact resource-slot re-selection on re-path. When a node or route changes, a worker releases its old claim, selects an available perimeter slot, and routes to that exact point.
- Kept cargo visible through the existing `villager-carry-atlas.png` attachments and compact quantity badge. Wood remains a bundle, food remains the basket, stone remains the sack, and supplies remain the construction crate.
- Kept resource work visually distinct: axe/log for wood, basket/berries for food, pick/sack for stone, and hammer/workbench for construction. All four authored camera directions remain in use; no mechanical mirroring or south-only fallback was introduced.
- Added restrained event-driven feedback in `src/renderer.js`: material-colored wood chips, berry glints, stone chips, construction dust, and deposit rings. These effects use real `tool_contact`, `construction_strike`, and `deposit_complete` world positions and remain subordinate to the authored sprites.
- Added resource/deposit event world coordinates to `src/simulation.js` so visual feedback remains aligned with the actual node or storage building.
- Corrected path smoothing so continuous building/resource clearance is used during smoothing as well as at runtime. An unreachable open cell is no longer treated as a safe direct route; storage selection can fall through to another valid drop-off instead.
- Cleared stale gather/build/attack targets and return-storage references during retasking so a villager cannot visually work on an abandoned task after being redirected.

### COMPLETED ACTION / DIRECTION COVERAGE

The exact atlas/action matrix is recorded in `CROWNFORGE_ANIMATION_COVERAGE.md`. The current slice has these completed four-direction combinations:

- Idle: motion row 0 × `+Z`, `+X`, `-X`, `-Z`.
- Walking: motion rows 1–3 × all four directions.
- Gathering wood: task row 0 × all four directions, with axe/log language and tool-contact timing.
- Gathering food: task row 1 × all four directions, with basket/berry language and tool-contact timing.
- Mining stone: task row 2 × all four directions, with pick/sack language and tool-contact timing.
- Carrying wood: carry row 0 × all four directions.
- Carrying food: carry row 1 × all four directions.
- Carrying stone: carry row 2 × all four directions.
- Carrying supplies: carry row 3 × all four directions.
- Constructing: task row 3 × all four directions, with hammer/workbench language and construction-strike timing.
- Optional villager attack: combat attack row × all four directions.
- Taking damage: combat hit row × all four directions, with live hit flash.
- Death: combat death row × all four directions.

### SYSTEMS CHANGED

- `src/simulation.js` — resource reservation maps, construction reservation maps, multi-builder assignment, task interruption cleanup, event positions, depletion release, cargo-return release, safer resource routing, and construction/destruction cleanup.
- `src/pathfinding.js` — optional conservative segment-smoothing callback so the simulation can apply continuous static-clearance rules while smoothing.
- `src/renderer.js` — event-driven material feedback for tool contact, construction strikes, and deposits.
- `CROWNFORGE_ANIMATION_COVERAGE.md` — exact villager action/direction matrix, synchronization notes, remaining action-loop deficiencies, and validation record.

### ASSETS CREATED OR REPLACED

- No new raster assets were generated or replaced in this pass. The asset audit found no missing gameplay-critical villager task, carry, construction, damage, attack, or death direction in the existing original Crownforge atlases.
- Existing canonical artwork remains: `assets/villager-motion-atlas.png`, `assets/villager-task-atlas.png`, `assets/villager-carry-atlas.png`, and `assets/villager-combat-atlas.png`.
- The new visual feedback is event-driven renderer work, not a placeholder icon, generic colored box, or temporary character.

### VALIDATION

- `node --check` passed for `src/simulation.js`, `src/pathfinding.js`, `src/renderer.js`, and `src/animation.js`.
- Source resource loop checks passed for Wood, Food, and Stone: workers reached task-specific interaction positions, emitted tool-contact and deposit events, deposited into capacity-limited storage, retained visible cargo while returning, and reduced node amounts without entering footprints.
- Source reservation checks passed: three villagers assigned to one wood node received three distinct slots; retasking released all three; three builders assigned to one Hearth House received three distinct construction slots; completion cleared all assignments and returned all builders to `Idle`.
- Source route regression passed after the smoothing fix: loaded villagers routed around the Town Center to a valid storage approach rather than stalling on a smoothed segment through the structure.
- Browser at 1280×720 visibly exercised Wood gathering/carry/deposit, Food retasking and resource feedback, Stone mining/carrying, three-villager foundation placement, 74% partial construction, completed Hearth House, and valid/invalid placement messaging.
- Browser dev logs reported no warning or error entries during these live checks.
- Movement stress harness still passed Cross lanes, Intersect paths, Blocked destination, and Retask storm with zero footprint, boundary, or stuck violations.

### KNOWN ISSUES

- Task, carry, construction, attack, hit, and death artwork is still mostly a single authored pose per direction. The state graph and event timing are complete, but the future quality bar is subtle multi-frame action depth.
- There is no dedicated audio feedback foundation yet; the new visual contact cues are intentionally restrained until audio can be designed coherently.
- The enemy can interrupt a gathering group during a live match, and an exposed villager can die. This is a valid current combat interaction, but safe worker retreat/escort behavior is deliberately out of scope for this pass.
- Four authored directions remain the current fixed-camera standard; eight-direction raster coverage is deferred.

### WHAT SHOULD BE POLISHED NEXT

1. Generate and hand-tune only the missing multi-frame villager action refinements: short wood, food, stone, carry, and construction loops while preserving the existing feet/shadow anchors.
2. After the villager reaches the quality bar, bring the same action-loop discipline to the Crown Guard and Ashen Raider.
3. Add audio only after a small Crownforge sound language is designed for tool contact, construction strike, deposit, and combat hit.
4. Re-run the exact action/direction matrix and live economy loop after any atlas change.

### WHAT SHOULD NOT BE BUILT YET

- No new civilizations, resources, buildings, units, technologies, campaigns, ages, maps, production chains, worker economy, formations, or advanced AI.
- No generic animation framework rewrite, formation system, or large audio system before the current villager task/carry/construction rows are polished.

The economic task loop is complete for the current slice. The next work should deepen the existing visual rows and preserve the small, finished, readable gameplay loop.

## COMBAT QUALITY PASS — 2026-08-15

### SCOPE

This pass polished the existing Crown Guard versus Ashen Raider melee encounter without adding a new unit, building, map, faction, weapon class, formation system, technology, or other gameplay category. The goal was to make one readable melee interaction the quality standard for future combat.

### BASELINE PROBLEMS FOUND

- Damage was driven by a cooldown fraction in simulation time rather than by an explicit attack phase. A target could leave range during the swing without a clear hit/whiff rule.
- Attackers did not reserve a target-facing engagement position. Several units could select the same approach point and rely on collision separation after arriving.
- Attack intent, attack animation state, and contact timing were related but not represented as one explicit state machine.
- Health bars were not consistently revealed on recently damaged combat targets.
- Target death and building destruction could leave attackers with stale attack targets or stale combat presentation.
- Feedback was limited to a generic attack ring and hit flash, without a restrained distinction between wind-up, contact, and whiff.

### COMBAT STATE AND TIMING CHANGES

- Added explicit `approach`, `anticipation`, `contact`, and `recovery` attack phases to every unit. Unit-specific anticipation/contact/recovery ratios are defined beside the existing attack values in `src/config.js`.
- Attack damage is now applied exactly once during the contact phase. The contact check requires both attack range and combat line of sight at the event moment.
- If a target escapes before contact, the attack emits an `attack_whiff` event, cancels cleanly, and returns to approach/re-pathing. A target that moves after a valid contact keeps the already-applied hit and does not receive a second damage event.
- Added `attack_start`, `attack_hit`, and `attack_whiff` animation events. The simulation is the source of truth for contact timing; animation state follows the same phase values.
- Attack facing is refreshed against the current target during approach and every active attack phase. The four authored Crown Guard and Ashen Raider directions remain real atlas columns; no sprite rotation, mirroring, or south-facing fallback was added.

### ENGAGEMENT, PATHING, AND CLEANUP

- Added deterministic eight-slot combat reservations to units and buildings. Free ring slots are preferred, with the existing collision separation providing a safe fallback only if a future stress case exceeds the ring capacity.
- Combat approach routing now preserves slot metadata, scores reachable line-of-sight points, and avoids reserving a point already claimed by another attacker whenever another valid point exists.
- Existing continuous building/resource clearance and live route re-planning remain active during combat, so attackers do not walk through Town Centers, houses, trees, berry bushes, or stone deposits.
- Target death, structure destruction, retasking, route failure, and unit death release combat reservations and clear attack-cycle timers. Attackers remain in a readable `Reassessing` state long enough for the normal target search to retarget when an enemy remains.
- Damaged combat units reveal a health bar for a short interval. Dead units keep their authored death presentation through the existing cleanup window and do not receive postmortem damage.

### VISUAL FEEDBACK

- Added phase-aware attack ring treatment: restrained red/orange during approach or anticipation and warmer contact emphasis at the hit phase.
- Added a subtle directional wind-up cue and recovery trail using the unit's authored facing, plus small deterministic impact/whiff effects at the actual target position.
- Kept the existing original combat atlases unchanged after audit. `assets/crownforge-soldier-combat-atlas-v1.png` and `assets/crownforge-raider-combat-atlas-v1.png` already provide authored idle, walk, attack, and death cells for `+Z`, `+X`, `-X`, and `-Z`. No new raster asset was necessary for this phase pass; code-driven cues fill only the timing/feedback gap and do not replace required artwork.

### VALIDATION MATRIX

- Source 1v1: Crown Guard reached the Raider, exposed approach/anticipation/contact/recovery in order, applied one damage event per cycle, and completed the death cleanup path.
- Source escaped target: moving the Raider out during anticipation caused no damage and produced a whiff/re-path result.
- Source 3v1: three Crown Guards received distinct combat slots and defeated one Raider without target-footprint overlap.
- Source 3v3: multiple attackers and targets ran through the same phase/retargeting logic while static footprint and resource clearance checks remained clean.
- Source obstacle case: a Hearth House placed across the combat line correctly blocked line of sight; the attacker did not treat the obstacle as a valid attack-through point.
- Source economy regression: Food, Wood, and Stone workers still reached their interaction slots, gathered, carried, and deposited after the combat changes.
- Source match flow: enemy structure destruction reached victory; Crown Hall destruction reached defeat; reset returned the slice to a fresh playing state with the original unit count.
- Live browser at 1280×720: selected the Crown Guard, right-clicked the Ashen Raider, watched the closing state and close melee beside food/stone resources, observed health/attack feedback, and confirmed retargeting to the Ashen Camp after Raider death.
- Developer harnesses: animation inspection exposed idle, walk, attack anticipation, attack contact, attack recovery, hit, and death for all four directions; movement stress still passed cross lanes, intersecting paths, blocked destinations, dynamic blockers, and retask storm with zero footprint, boundary, or stuck violations.
- Browser console diagnostics: no warning or error entries in the playable slice, animation inspection harness, or movement stress harness.

### KNOWN LIMITS

- Crown Guard and Ashen Raider attack art still uses one authored idle pose for anticipation/recovery and one authored attack pose for contact per direction. The state timing and directional feedback are now correct, but the action artwork remains a 7/10 refinement ceiling until a compact multi-frame attack/recoil atlas is hand-tuned.
- Damage currently uses the existing authored hit fallback plus a restrained flash/health reveal; there is not yet a dedicated recoil cell for either combat unit.
- There is no combat audio layer yet. Visual contact and whiff cues are intentionally limited until a small Crownforge sound language can be designed coherently.
- The engagement ring is a lightweight reservation model, not a formation system. It is sufficient for the current 1v1, 3v1, 3v3, building-edge, resource-edge, and narrow-route slice tests.

### WHAT SHOULD BE POLISHED NEXT

1. Hand-tune a compact multi-frame Crown Guard attack/contact/recovery sequence with the same four authored directions and preserved feet/shadow anchors.
2. Apply the same attack/recoil timing standard to the Ashen Raider without introducing another unit type.
3. Re-run the current combat matrix after any atlas change and keep the phase/event contract unchanged.

### WHAT SHOULD NOT BE BUILT YET

- No archers, cavalry, siege, formations, advanced combat abilities, new enemy types, technology, civilizations, campaigns, maps, or large AI systems.
- No expanded combat UI, equipment system, damage-type system, or audio framework before this one melee matchup reaches the next visual quality threshold.

The current melee system is mechanically complete and visually readable for the tiny slice. Its remaining quality gap is action-art depth, not missing combat rules or missing directional coverage.

## BUILDING QUALITY PASS — 2026-08-15

### SCOPE

This pass audited every existing building type and construction site without adding any new building type. The original Crownforge stage family was retained because its perspective, alpha preparation, material language, scale, lighting, and terrain treatment remain coherent at playable RTS distance.

### BUILDING-BY-BUILDING REPORT

#### Crown Hall — Town Center

- Uses the completed Crownforge stage-atlas column with the same warm timber, stone, blue pennant, roof, and contact-shadow language as the other Crownwarden buildings.
- Gameplay footprint is `3 × 3` world units and the visible footprint/selection outline now follows that footprint instead of using an oversized generic ellipse.
- The south edge is the named entrance-first approach side for storage interaction and defender routing. The structure remains a solid pathfinding obstacle from foundation through destruction collapse.
- Selected information reports Crown Hall, health, settlement-core function, and the active drop-off function. Damage health bars, hit flash, condition marks, and destruction cleanup are consistent with the rest of the roster.

#### Hearth House — Constructible House

- Uses the authored stage-atlas column across placement preview, foundation, early construction, mid construction, late construction, and completion.
- The current raster family contains foundation, scaffold/partial, near-complete, and completed art. The six player-facing lifecycle states are completed with thresholded stage selection plus restrained construction dust/frame treatment for the early/mid distinction; the completed structure is never shown at foundation placement.
- Gameplay footprint is `2 × 2` world units. Builder approach points are entrance-first and remain outside the footprint; one-builder and multi-builder assignments reserve distinct cardinal work positions.
- Selected information reports Hearth House, health, exact construction percentage, construction stage label, population function, and whether the structure is active housing.

#### Waystore — Storage Building

- Uses the authored completed Waystore stage with matching stone, timber, roof, barrels, supply stacks, painted ground contact, and shadow treatment.
- Gameplay footprint is `2 × 2` world units with a south entrance-first drop-off approach. Carriers route to the building edge rather than its center and fall back to another valid storage point if the preferred route is blocked.
- Selected information reports Waystore, health, resource drop-off function, and active drop-off state. The same footprint, collision, selection, damage, and destruction rules apply as for the Crown Hall.

#### Ashen Camp — Enemy Structure

- Retains its separate original transparent enemy asset because its charcoal timber, red-brown shelters, stone palisade, firelight, bone/trophy language, and enemy pennant establish a readable enemy identity without breaking the camera or lighting family.
- Gameplay footprint is `3 × 3` world units. The south edge is the entrance/spawn side; capped Raider replacement uses the named approach family rather than spawning in the building center.
- Enemy structure health, damaged health-bar state, hit flash, condition cracks/embers, line-of-sight blocking, defender routing, victory detection, collapse treatment, collision release, and removal are now aligned with the Crownwarden structures.

### CONSTRUCTION LIFECYCLE

- Placement preview now uses the requested building type and its matching foundation cell, carries no square background, and uses the actual gameplay footprint outline.
- Live construction now exposes six readable states: placement preview, foundation, early construction, mid construction, late construction, and completed structure.
- Early, mid, and late thresholds are synchronized with simulation progress and UI text. Existing authored partial/near-complete artwork is supported by restrained dust, framing, and work-light treatment; no abrupt fade or final-building pop-in is used.
- Foundation health remains low, rises with progress, and reaches max health only at completion. Construction interaction points remain outside the structure throughout.

### FOOTPRINTS, ENTRANCES, AND OCCLUSION

- Added explicit entrance metadata to every building type and made the entrance the first preferred approach side for workers, storage carriers, and enemy spawn routing.
- Building selection markers now trace the projected rectangular footprint with corners and a restrained fill. Placement previews use the same footprint geometry, so the player sees the real occupied area rather than a generic oversized circle.
- Building hit-testing now prioritizes a nearby unit, then the actual building edge, then resource nodes. Clicking a roof/base area selects the intended building without making the structure’s center a command destination.
- Depth sorting now has deterministic kind and ID tie-breakers. Buildings, resources, details, and units retain stable order at equal ground depth, reducing edge flicker.
- Selected units that are legitimately behind a large building retain a small selection/health overlay after world rendering. The building remains opaque and visually primary while important selected units remain findable.
- Static collision, placement validation, path segments, construction footprints, resource drop-off routes, and unit-position correction all use the building footprint rather than the transparent artwork bounds.

### DAMAGE AND DESTRUCTION

- Healthy buildings retain clean authored art and normal health presentation.
- Damaged buildings now receive restrained condition marks; critically damaged buildings add small ember cues while their health bar communicates the exact remaining state.
- Destruction clears selection state, build assignments, attack targets, AI/victory references, and interaction reservations.
- A destroyed structure remains a temporary collision obstacle through the visible collapse window, preventing units from walking through a still-present intact silhouette. Collision releases after the collapse has read as a ruin, and the ruin is removed after the existing short lifetime.
- Destroyed buildings no longer retain an active health bar or selection marker; the renderer shows only a brief ruin/smoke treatment before cleanup.

### ASSET DECISION

- No new raster asset was generated or replaced in this pass. `assets/crownforge-building-stages-v2.png` already provides a coherent original four-column family for Crown Hall, Hearth House, and Waystore, and `assets/crownforge-ashen-camp-v1.png` is a coherent transparent enemy structure asset.
- The lifecycle and damage gaps were structural/readability gaps, so they were solved with explicit stage mapping, footprint/entrance metadata, grounded renderer treatments, and cleanup rules rather than introducing a mismatched generated family.
- No square background, opaque matte, temporary building, colored rectangle, or unrelated art style was introduced.

### VALIDATION

- Source building matrix passed for all four existing building types: authored entrance-first approach points, correct edge distance, stable footprint blocking, and restart-safe entity registration.
- Source placement matrix passed normal placement, structure overlap rejection, map-boundary rejection, and resource/ground clearance rules.
- Source construction passed one-builder construction through foundation/early/mid/late/completed progress, max-health completion, builder return to idle, multi-builder distinct slots, and assignment cleanup.
- Source interaction passed storage edge routing and no-center-targeting behavior.
- Source destruction passed selection clearing, collision retention during collapse, collision release after collapse, ruin removal, and restart after destruction.
- Live browser at 1280×720 showed the new foundation preview, valid-site footprint treatment, multi-builder Hearth House construction, completed-house selection information, stable building contact, and no square image backplates.
- Live structure combat targeting was exercised; the Crown Guard could issue an Ashen Camp attack order. The live Raider defense also exposed the intended current risk of a lone Guard dying before reaching the enemy core; no browser warnings or errors appeared.
- Movement stress harness was re-run after footprint/collision changes: Cross lanes, Intersect paths, Blocked destination, Dynamic blocker, and Retask storm passed with zero footprint violations, zero boundary violations, zero stuck units, and no browser logs.
- Source syntax checks passed for `src/config.js`, `src/simulation.js`, `src/renderer.js`, `src/input.js`, and `src/main.js`.

### KNOWN LIMITS

- The generated construction atlas still contains four authored raster rows. The six lifecycle states are now player-readable and mechanically synchronized, but early and mid use the same authored partial row with different restrained renderer treatment; a future dedicated six-row building atlas could raise the visual ceiling further.
- Damage and ruin treatments are renderer-authored overlays rather than dedicated damaged/ruined raster cells. They are intentionally subtle and keep the current art family intact.
- Building rotation is still not implemented because the current art and interaction geometry do not require it.
- No unit production or rally system exists in the slice, so entrance metadata currently serves construction, storage, worker interaction, defender routing, and enemy Raider spawn behavior.

### WHAT SHOULD BE POLISHED NEXT

1. If a future raster pass is undertaken, create only a hand-tuned six-row building-stage family or dedicated damaged/ruined variants that preserve the current footprints, anchors, transparency, and lighting.
2. Re-audit occlusion at additional zoom levels after any camera or asset-size change.
3. Keep the current entrance/footprint contract unchanged while adding future buildings.

### WHAT SHOULD NOT BE BUILT YET

- No new building types, rotation system, production queues, garrison system, technology structures, additional maps, or expanded base-management layer.
- No large building-asset library until the current four structures and their lifecycle/damage behavior remain consistently strong under future camera and UI changes.

All existing Crownforge buildings now share a coherent visual and gameplay contract for the current vertical slice: lifecycle, footprint, entrance, ground contact, occlusion, selection, damage, destruction, and restart behavior are complete within the intentionally small scope.
## ART DIRECTION + ASSET HARMONIZATION PASS — 2026-08-16

### SCOPE

This pass formalized the visual language of the existing vertical slice and audited every visible gameplay asset. No new gameplay content, unit, building, resource, faction, map, system, or UI category was added.

### DOCUMENTS CREATED

- CROWNFORGE_ART_BIBLE.md — camera/projection, scale, anchors, lighting, palette, materials, silhouette language, detail hierarchy, animation constraints, transparency rules, UI art rules, and acceptance checklist.
- CROWNFORGE_ASSET_MANIFEST.md — complete raster and code-rendered inventory with filenames, dimensions, atlas layouts, states, directions, frame counts, perspective, scale, lighting, palette, transparency, shadow treatment, status, replacement priority, source workflow, and notes.

### AUDIT FINDINGS

- Active player-facing art is one coherent original Crownforge family: meadow, paths, environmental resources, buildings, villager atlases, Crown Guard, Ashen Raider, Ashen Camp, and UI icons.
- The normal loaded game uses specialized atlases for the visible unit/resource/building states. crownforge-asset-atlas.png remains only as a safe first-frame fallback; crownforge-meadow.png is legacy and unused.
- All active sprite families inspected are RGBA except the intentionally opaque meadow textures. Neutral matte removal and alpha preparation were verified for the atlases; the live game showed no square matte, halo, or background seam.
- The meadow is clipped to the projected map diamond, so the RGB terrain texture does not present as a rectangular world card.
- The environment family has four tree, four berry, and four stone variants plus log, stump, flowers, and pebbles. No large repetitive asset library was added.
- Building art shares one stage family for Crown Hall, Hearth House, and Waystore; Ashen Camp remains a deliberately separate enemy family with matching camera, ground contact, and warm key treatment.
- The 4-direction contract is complete for every current directional unit state. No incorrect mirrored direction or default-south attack was observed.
- Villager feet, resource bases, building foundations, selected overlays, and health bars were checked at gameplay zoom. No floating character, floating building, or object clipping defect was found in the inspected views.

### ASSET DECISION

No new raster artwork was generated, replaced, or reprocessed in this pass. The audit did not find a player-visible asset that failed the shared style gate badly enough to justify a new generated family. Retaining the existing assets avoids introducing another inconsistent near-duplicate set.

### LIVE VISUAL QA

- Reference view: 1280 × 720.
- Normal zoom: settlement, resources, paths, buildings, units, UI, selection rings, health bars, and enemy lighting read as one visual language.
- Zoom-out: map composition remains readable; resource silhouettes and building scale remain distinct.
- Close zoom: villager feet/shadows, building bases, tree/berry/stone edges, construction preview, UI icons, and Ashen Camp silhouette remained clean enough for the current slice.
- Browser warning/error log was empty during the inspection.
- A defeat state was reached during passive inspection after the raiders attacked the Crown Hall; the defeat panel used the authored UI icon family and reset affordance correctly.

### KNOWN LIMITS

- Villager task, carry, construction, optional combat, and death rows remain mostly one-pose authored clips. They are directionally correct and readable, but are below the future production animation bar.
- Crown Guard and Ashen Raider walk, attack, hit fallback, and death depth remain mostly single-pose or fallback-based; the next action-art pass should create compact multi-frame attack/recoil standards for these existing units.
- Early and mid construction use the same authored partial raster row with different restrained renderer treatment. Damage and ruin are code-rendered overlays rather than dedicated raster cells.
- Ashen Camp is a single 1536 × 1024 RGBA source with no dedicated damage/ruin frames; its separate enemy identity is intentional. Its natural source aspect is recorded in the manifest for future close-zoom review.
- Legacy combined and meadow files should not receive new content. Remove them only after the specialized atlas loading fallback has been made unnecessary.

### WHAT SHOULD BE POLISHED NEXT

1. Hand-tune the existing villager task/carry/build loops while preserving the four directions, 108 px render size, feet anchor, and named contact events.
2. Hand-tune one shared Crown Guard/Ashen Raider multi-frame attack and dedicated recoil standard.
3. Re-audit the existing building stage and Ashen Camp source aspects only if close-zoom evidence shows a visible distortion or lifecycle gap.
4. Keep the current art bible and manifest updated whenever an existing asset is changed.

### WHAT SHOULD NOT BE BUILT YET

- No new civilizations, units, buildings, resources, maps, technologies, campaigns, or UI categories.
- No larger asset library, camera rotation, eight-direction expansion, or custom audio pass.
- No new content until the current B-rated action/lifecycle families are consistently at least 8/10 under the existing camera and gameplay zoom.

The slice now has a written visual source of truth and a complete asset inventory. The current art family is coherent enough to support polish-focused iteration without expanding the game.

## DAYLIGHT LIGHTING PASS — 2026-08-16

### SCOPE

This pass established one warm, historically grounded daylight condition for the existing vertical slice. No day/night cycle, weather system, biome, map, unit, building, resource, faction, gameplay rule, or new content category was added.

### IMPLEMENTED

- Added a shared LIGHTING contract in src/config.js.
- Locked the primary key direction to upper-left/front of screen with runtime vector (-0.48, -0.88); painted shadows read toward screen-right/back (+0.48, +0.88).
- Added a low-opacity diagonal daylight grade inside the projected map polygon: warm upper-left/distant meadow, neutral center, green-ambient lower-right.
- Replaced the darker generic map-edge shadow with a softer green-neutral edge separation.
- Kept existing baked transparent-sprite shadows authoritative for villagers, soldiers, raiders, resources, buildings, construction stages, and Ashen Camp.
- Did not add a second runtime cast-shadow or ambient-occlusion system, avoiding double shadows and per-entity performance cost.
- Added a developer-only lighting benchmark flag. It is not visible in normal play and does not run in the normal renderer path.

### ASSET LIGHTING AUDIT

- Meadow and paths agree with the warm upper-left/front key.
- Tree, berry, stone, log, stump, flower, and pebble variants use consistent screen-right/back contact shadows.
- Crown Hall, Hearth House, Waystore, construction rows, and Ashen Camp remain grounded with compatible baked shadows.
- Villager motion/task/carry/combat rows keep their feet and painted shadow anchors across all four directions.
- Crown Guard and Ashen Raider use the same shadow direction; faction identity remains supported by silhouette, value, clothing, shield/axe, banners, and markers rather than red-versus-green alone.
- Ashen Camp firelight remains a local material accent and does not compete with the master daylight.
- No new raster artwork was generated, replaced, or reprocessed because the existing original asset family already agreed with the selected lighting direction.

### REJECTED ARTIFACT

A first sprite-grade prototype used full-canvas source-atop compositing. Live zoomed-out inspection exposed rectangular tonal blocks around transparent atlas cells because the canvas behind the sprites was opaque. The prototype was removed immediately. No sprite grade remains in the player renderer. Any future per-sprite correction must use an alpha-isolated offscreen buffer and pass the zoomed-out seam test.

### LIVE VALIDATION

- Fresh 1280 x 720 game load: no browser warnings or errors.
- Normal zoom: terrain, resources, buildings, units, selection markers, UI, and enemy camp remained readable.
- Zoomed-out view: no sprite rectangles, halo, black contact stains, shadow flicker, or depth-sort shadow artifacts after the rejected prototype was removed.
- Close practical zoom: villager feet, resource bases, building foundation, and Ashen Camp lighting remained grounded.
- Villager resource approach and wood gathering were exercised under the revised daylight.
- Valid/invalid Hearth House placement and foundation preview were exercised.
- Crown Guard movement into melee beside the Crown Hall was exercised; the Guard was defeated by the Ashen Raider, and the combat view remained readable.
- Defeat presentation and fresh reset remained functional.
- A complete live match was played under the revised lighting: a four-unit rush reached the Ashen Camp, the raiders defended and counter-raided, the Crown Hall eventually fell at Daybreak 1:32, the defeat panel appeared, and PLAY AGAIN returned to a fresh Daybreak 0:01 state.
- Animation inspection harness was re-run after the renderer change: all current states/directions loaded with no warnings or errors.
- Movement stress harness was re-run after the renderer change: Retask storm passed with zero footprint violations, zero boundary violations, zero stuck units, and minimum pair spacing 0.80.
- The complete live match, harnesses, and fresh reset all produced an empty browser warning/error log.
- Developer benchmark:
  - grade disabled: 0.373 ms average render, 0.900 ms p95, 1.200 ms max;
  - grade enabled: 0.395 ms average render, 0.900 ms p95, 1.200 ms max.
  - added average cost: approximately 0.022 ms per render, well below the 16.67 ms 60 fps frame budget.

### DOCUMENTATION UPDATED

- CROWNFORGE_ART_BIBLE.md now records the exact master light, ambient values, baked-shadow policy, material hierarchy, runtime safety rule, accessibility guidance, and performance target.
- CROWNFORGE_ASSET_MANIFEST.md now records the family-by-family lighting audit, runtime lighting surfaces, rejected artifact, and benchmark result.

### KNOWN LIMITS

- Display brightness, physical monitor contrast, and true browser-window resizing were not controllable from the in-app validation surface; the reference 1280 x 720 viewport and both camera zoom extremes were checked.
- The current lighting pass does not create dedicated damaged/ruined raster shadows; existing restrained renderer treatments remain the correct small-scope solution.
- Action animation depth, early/mid construction raster depth, and legacy fallback cleanup remain queued from prior passes.

### WHAT SHOULD BE POLISHED NEXT

1. Keep this single daylight condition stable while hand-tuning the existing villager and melee action frames.
2. Re-audit baked shadow anchors after any future atlas regeneration or render-size change.
3. Use the lighting benchmark flag only when a future visual pass changes the renderer.

### WHAT SHOULD NOT BE BUILT YET

- No day/night cycle, weather, biome, alternate lighting mode, fog-of-war, or dynamic shadow-map system.
- No new content categories or larger map.
- No expensive per-sprite or per-pixel lighting effect without a measured readability and frame-time justification.

The existing Crownforge map now has one explicit, coherent daylight presentation with grounded baked shadows, controlled material contrast, strong interaction readability, and a measured low rendering cost.

## TERRAIN AND LANDSCAPE COHERENCE PASS — 2026-08-16

### SCOPE

This pass audited the current meadow as a complete inhabited battlefield. No new map, biome, resource, environmental system, gameplay mechanic, or raster asset family was added.

### FINDINGS

- `crownforge-meadow-v2.png` already provides the correct single-board terrain foundation: warm grass, authored dirt paths, bare-soil variation, small stones, and sparse flowers. Its clipped runtime presentation has no visible tile seam or rectangular terrain card.
- The two opening wood nodes were technically present but projected behind the Crown Hall's tall silhouette, making the starting resource area visually absent and hard to target.
- The opening Ashen Raider overlapped the eastern stone clearing in projected space, making the stone deposit look like an enemy-held object instead of a clear resource node.
- Existing trees, berries, stone, foundations, buildings, and small details already carry compatible painted contact shadows and local ground treatment. No new generated variant was justified.
- The current map has a readable west-to-settlement-to-east route, a separated enemy camp, open building space, and no new natural barrier is required.

### IMPLEMENTED

- Moved the opening wood pair to the Crown Hall's west flank at `(4.8, 8.5)` and `(5.4, 13.0)`. Both trees now read as a deliberate nearby clearing and remain reachable through the existing path/collision rules.
- Moved the initial Ashen Raider to `(23.5, 8.0)`, between the Ashen Camp and stone clearing, removing the resource/defender overlap while preserving a believable camp guard position.
- Extended the post-world occlusion tracking pass to tall tree resources. Selected, attacking, or damaged units hidden behind a tree now retain a restrained selection marker and health bar above the foliage.
- Kept the existing stable world-space depth sort: building, resource, decoration, and unit layers are ordered by projected ground depth with deterministic kind and ID tie-breakers. No per-object hand-authored exception was introduced.
- Kept ambient vegetation static. There was no existing wind system to repair, and no synchronized environmental animation was added to compete with units.

### ASSET DECISION

No new raster artwork was generated, replaced, or reprocessed. The approved meadow, environment atlas, building-stage atlas, and existing transparent unit families already meet the Crownforge art direction. This pass corrected map composition and renderer occlusion/readability rather than creating another near-duplicate asset set.

### VALIDATION

- Fresh 1280 x 720 view: both opening wood trees are visible west of the settlement; the east stone clearing is selectable without selecting the Raider; browser logs are empty.
- Live resource checks: wood selection/gathering, food retasking, and stone selection/gathering were exercised. The UI reported the correct resource type, carried state, and command feedback.
- Placement check: clicking the wood clearing in construction mode returned `Clear the resource before building here`; a nearby clear site accepted the foundation.
- Construction check: foundation, assigned workers, completed Hearth House, building contact, and routeable surrounding units remained grounded and readable.
- Occlusion check: selected workers approaching the west trees retained trackable ground markers and cargo/health feedback when foliage overlapped their bodies.
- Zoom audit: normal and zoomed-out composition were inspected; terrain remained subordinate to units, paths remained readable, resource silhouettes stayed distinct, and no square backplates or layering seams appeared.
- Animation inspection harness: all current states/directions loaded with no warnings or errors.
- Movement stress harness: Retask storm passed with zero footprint, boundary, or stuck-unit violations; minimum pair spacing was 0.80.
- Complete live match: passive play reached Crown Hall defeat at Daybreak 1:31; the defeat panel appeared and PLAY AGAIN returned to a fresh Daybreak 0:01 state.
- Developer render benchmark after the terrain/occlusion change: lighting grade disabled 0.267 ms average / 0.600 ms p95 / 0.600 ms max; lighting grade enabled 0.321 ms average / 0.700 ms p95 / 1.200 ms max. Browser warnings and errors remained empty.

### KNOWN LIMITS

- The meadow remains one clipped authored board texture rather than a procedural terrain-transition system; this is intentional for the small slice.
- Paths are baked into the meadow artwork. There is no path-wear simulation, dynamic vegetation, or terrain deformation.
- Tree occlusion uses a restrained selected/active-unit overlay. Full canopy fading or a dynamic occlusion mask is not needed at the current density.
- Resource labels can still become visually busy when a unit stands directly over a node; selection information remains the authoritative detail channel.

### WHAT SHOULD BE POLISHED NEXT

1. Re-audit resource label placement only if the map gains more clustered nodes or the camera scale changes.
2. Preserve the current opening west clearing and east stone clearing when any future asset regeneration occurs.
3. Keep the existing depth and ground-anchor contracts unchanged during future action-art work.

### WHAT SHOULD NOT BE BUILT YET

- No terrain editor, tile blending system, biome layer, day/night/weather system, wind simulation, fog-of-war, dynamic shadows, or larger environmental prop library.
- No new map or resource cluster until this current battlefield remains geographically coherent through future unit/building polish.

The current meadow now reads as a small, navigable settlement landscape: resources are visible and targetable, the enemy defender no longer masks stone, the path network remains subordinate but legible, and selected units remain trackable through the few large foreground objects.

## PLAYER EXPERIENCE PASS — 2026-08-16

### SCOPE

This pass completed the player-facing input, command feedback, camera, interface, cursor, tooltip, audio, settings, restart, and responsiveness layer around the existing slice. No civilization, unit, building, resource, map, technology, campaign, or other major gameplay content was added.

### FINDINGS

- The `B` shortcut entered placement directly, bypassing the visible construction menu and its eligibility messaging.
- The canvas exposed generic browser cursors rather than communicating selection, movement, gathering, attack, interaction, construction, and invalid placement contexts.
- Diagonal keyboard camera movement was faster than cardinal movement because X and Y speeds were accumulated independently.
- Held camera keys, drag selection, and middle-pan state were not cleared when the browser window lost focus.
- Clicking an enemy cleared selection but reported that the hostile unit was selected, which contradicted the actual selection grammar.
- Right-clicking a completed player building other than storage fell through to a center-point move target instead of a safe building approach point.
- There was no audio feedback foundation, and several control hints relied only on inconsistent native title popovers.

### IMPLEMENTED

- Added `src/audio.js`, a small original procedural Web Audio layer. It is gesture-unlocked and provides restrained cues for UI, selection, movement, gathering, deposits, construction strikes, attacks, impacts, damage, deaths, placement, victory, defeat, and building destruction. It deduplicates animation events, caps simultaneous voices, and stops active voices on reset.
- Connected audio to selection, command, placement, simulation animation events, phase changes, and restart without adding external audio files or music.
- Added master-volume, effects-volume, and reduced-camera-motion controls to the Field Manual. The reduced-motion option lowers keyboard pan speed while preserving direct drag control.
- Reworked input callbacks so selection, command acceptance/rejection, placement success/failure, gesture unlock, Escape, and the B shortcut all communicate with the interface/audio layer.
- B now opens or closes the construction menu. It no longer bypasses the visible prerequisite and placement flow.
- The canvas is keyboard-focusable and receives focus on map interaction. Escape clears transient input, cancels placement, and closes menus. Window blur clears held keys, drag selection, middle-pan, and selection-box state.
- Camera keyboard vectors are normalized, so diagonal pan speed matches cardinal pan speed.
- Added original inline Crownforge cursor marks for default, selection, movement, gathering, attack, building interaction, valid construction, invalid construction, and UI controls. The existing original icon atlas remains the source for UI artwork.
- Added a restrained Crownforge-styled tooltip layer for existing control/resource explanations. Tooltips remain pointer- and keyboard-focus accessible and do not introduce new control categories.
- Selection now distinguishes a hostile click as `HOSTILE · RIGHT-CLICK TO ATTACK` feedback instead of claiming the enemy was selected. Drag selection remains additive with Shift and works in either drag direction.
- Right-click resource, storage, completed building, enemy unit, and enemy structure commands now return explicit success/failure states. Villager-only tasks reject soldier/resource mismatches, unreachable targets report why, and completed player buildings route units to safe perimeter approach points.
- A selected unit's live order now has priority in the command line over a background construction-complete or AI toast, keeping current-task information authoritative while event notices remain visible briefly.
- Added a `damage_taken` animation event so combat feedback can drive a restrained damage cue without changing damage rules.

### VALIDATION

- Fresh 1280 × 720 browser load: original world art, UI, tooltips, cursor layer, and settlement framing appeared with an empty warning/error log.
- Single selection, reverse-direction drag selection, empty-click clearing, Shift selection, selection over buildings, resource targeting, hostile targeting, and completed-building interaction were exercised with normal controls.
- Wood command reported `Gather wood.` and showed the gather cursor; hostile targeting reported `Engage Ashen Raider.` and showed the attack cursor; player-building interaction reported `Move to Hearth House.` and used a safe perimeter route.
- Construction menu entry through both the button and `B` was tested. Invalid and valid placement states produced distinct placement readouts and `is-build-invalid` / `is-build-valid` cursor classes. Escape cancelled placement and hid the cancel affordance.
- The normal-controls match test reset the slice, placed a Hearth House at a valid site, assigned three villagers, selected the Crown Guard, attacked the Ashen Camp, and reached victory at `DAYBREAK 0:54`. The victory state was visually inspected and PLAY AGAIN returned to a fresh Daybreak state.
- A no-intervention match reached `CROWN HALL LOST` at `DAYBREAK 1:31`. The defeat panel, defeat styling, and replay affordance were visually inspected.
- Responsive viewport checks at 1024 × 640 and 980 × 620 kept the canvas, command deck, and controls panel in bounds. The default viewport was restored after the check.
- Master/effects sliders, reduced camera motion, tooltip hover, fresh load, victory restart, and defeat restart paths were exercised. The current browser log was empty after the final fresh load.
- `node --check` passed for `src/audio.js`, `src/animation.js`, `src/input.js`, `src/main.js`, and `src/simulation.js`; `git diff --check` passed.

### ASSETS CREATED OR RETAINED

- No new raster artwork was generated in this pass. The approved Crownforge meadow, environment, buildings, unit atlases, enemy camp, and original UI icon atlas remain the coherent production family.
- New visual feedback is code-authored: inline SVG cursor marks in `styles.css`, the styled tooltip surface, and restrained procedural audio in `src/audio.js`.

### KNOWN ISSUES

- The slice intentionally has effects only; there is no music system or music asset yet.
- Tooltips now have a Crownforge surface but remain concise and contextual rather than a large encyclopedic help system.
- Edge scrolling is still not enabled; WASD/arrow pan, wheel zoom, and middle-drag pan are the current camera contract.
- Audio cues are procedural and intentionally lightweight; they still need a later authored sound-design pass if the slice remains at this scale long enough to justify recorded assets.

### WHAT SHOULD BE POLISHED NEXT

1. Keep the current command grammar stable while hand-tuning the remaining villager and melee animation timing.
2. Re-audit cursor hotspot alignment and tooltip placement after any future HUD geometry change.
3. Decide whether the next polish pass should author a tiny set of recorded UI/world sounds, only after the current visual and interaction standards remain stable.

### WHAT SHOULD NOT BE BUILT YET

- No new civilization, roster, building category, technology tree, campaign, map, resource, formation, diplomacy, naval layer, edge-scrolling system, music system, or settings framework.
- No large tooltip encyclopedia, keybinding editor, remappable control system, fog-of-war UI, minimap, or multiplayer layer.

The player-facing layer now communicates selection, intent, validity, task state, and outcomes coherently across the existing tiny match. The next work should continue polishing this slice rather than widening it.

## WORLD SCALE, LABELS + EDGE-FRAMING PASS — 2026-08-16

### SCOPE

This pass addressed the visible presentation defects reported from the live map screenshot. No new gameplay system, unit, building, resource, map, faction, or artwork family was added.

### WHAT CHANGED

- Rebalanced the current render contract: Villagers now draw at 88 px, while Crown Guards and Ashen Raiders draw at 120 px. Workers read as subordinate to building mass, and combat silhouettes no longer look undersized beside the villagers.
- Preserved the Ashen Camp's original 3:2 source aspect instead of stretching it into a square destination. Its 272 px runtime width now keeps the generated structure's proportions intact.
- Moved the Ashen Camp and the eastern stone/wood clearing inward from the map edge so their tall silhouettes and ground details remain inside the playable frame.
- Reduced the default camera zoom from 0.84 to 0.78 and tightened camera pan limits with viewport-aware breathing room. Zoom and pan still work, but normal camera movement no longer pushes edge assets against the canvas boundary.
- Removed resource text from the sprite draw pass. Resource labels now render after world entities as compact, color-keyed dark pills connected to the node base, below the artwork rather than across the canopy, bush, or deposit.
- Resource nodes show their type by default and reveal the live remaining amount while selected or actively gathered. This keeps the map readable without removing useful economy feedback.
- Updated the art bible and asset manifest with the current worker/combat scales and the preserved Ashen Camp aspect contract.

### ASSET DECISION

No new raster artwork was necessary. The existing original Crownforge assets were coherent; the defects came from draw sizing, aspect handling, label layering, and camera framing.

### VALIDATION

- `node --check` passed for `src/config.js`, `src/simulation.js`, and `src/renderer.js`.
- `tools/remediation-regression.mjs` passed animation mapping, reset clearance, economy cadence, cargo retask, placement/construction, combat, death, victory, and defeat checks.
- Fresh local 1280 x 720 browser load was visually inspected after the change. Villagers, Crown Guard, Ashen Camp, trees, berries, stone, labels, UI, and selection markers remained grounded and readable.
- Zoomed and panned edge checks kept the Ashen Camp, eastern stone deposits, and lower wood resource visually inside the viewport; no resource, building, or unit image was visibly cropped in the tested framing.
- Browser console warning/error log was empty after fresh reload, zoom, and pan checks.

### KNOWN ISSUES

- At extreme zoom the authored meadow itself can leave the viewport, which is normal RTS camera behavior; the current safety limits keep active edge assets readable in the normal slice framing.
- Resource labels remain intentionally visible for node recognition. The detailed remaining amount appears only for selected/active nodes to avoid returning to a text-heavy map.

### WHAT SHOULD BE POLISHED NEXT

1. Recheck the new render contract after any future atlas regeneration or camera-angle change.
2. Keep resource label pills and their below-node anchor stable when adding future resource variants.
3. Continue the existing non-scope animation-depth backlog only after this visual framing holds up across another live match.

### WHAT SHOULD NOT BE BUILT YET

- No new civilizations, units, buildings, resources, maps, technologies, campaigns, fog-of-war, minimap, or expanded AI.
- No new raster family or broad art-library expansion; this defect was solved by using the current Crownforge artwork correctly.

## TECHNICAL HARDENING + RELEASE CERTIFICATION PASS — 2026-08-16

### SCOPE

This pass audited the existing repository, timing, performance, browser diagnostics, cleanup, rapid state transitions, complete matches, visual consistency, and documentation. No new unit, building, resource, map, civilization, technology, campaign, or major gameplay system was added.

### VERIFIED FIXES

- Fixed frame-rate divergence at the simulation boundary. `src/simulation.js` now advances the complete game state on a bounded fixed 60 Hz step. A 30-second 20 Hz versus 60 Hz probe now produces identical clock, worker position, cargo, resource totals, and node amount.
- Fixed frame-rate-dependent ripple lifetime in `src/renderer.js`; ripple age now follows measured render delta.
- Fixed destroyed Waystore eligibility in `_findStorageRoute`, `_getReturnStorage`, and `_nearestStorage`. Cargo immediately falls back to a live Crown Hall rather than routing to a fading destroyed building.
- Handled rejected Web Audio context resumes in `src/audio.js` so autoplay/device policy does not create an unhandled promise.

### WHAT WAS TESTED

- Read and audited `CROWNFORGE_DEV_LOG.md`, `CROWNFORGE_ANIMATION_COVERAGE.md`, `CROWNFORGE_ART_BIBLE.md`, and `CROWNFORGE_ASSET_MANIFEST.md` before source inspection.
- Audited all `src/`, `dev/`, `tools/`, `index.html`, `styles.css`, asset references, timers, animation events, event listeners, global exports, cleanup paths, and debug/query surfaces.
- Re-ran syntax checks for all source, developer, and tool modules plus `git diff --check`.
- Re-ran the animation inspection harness; all current unit states/directions loaded with an empty warning/error log.
- Re-ran movement stress: cross lanes, intersections, blocked destination, retask storm, and dynamic blocker recovery all ended with zero footprint, boundary, and stuck violations after the recovery window.
- Ran direct probes for frame cadence, resource cap/depletion, destroyed drop-off fallback, construction completion, combat death, target cleanup, victory, defeat, and reset.
- Played three complete browser scenarios: integrated economy/construction to victory at approximately `0:53`, movement/combat victory at approximately `0:52`, and adversarial passive defense to defeat at approximately `1:31`.
- Exercised invalid/valid placement, Escape cancellation, rapid restart, hostile exposure, resource retasking, zoomed visual inspection, and outcome replay.
- Final browser error/warning logs were empty.

### MEASURED PERFORMANCE

- Fresh local page navigation reached `complete` in approximately 63 ms at 1280x720.
- Canvas diagnostics observed a stable run of 1.560 ms average / 0.700 ms p95 / 62.100 ms max, with an alternate run of 2.498 ms average / 4.400 ms p95 / 63.000 ms max.
- Node-side 60-second fixed-step probes measured simulation mean/p95/max of 0.2021/0.0688/20.1031 ms idle, 0.2165/0.0735/11.8111 ms economy, and 0.5347/3.3291/9.6541 ms combat.
- PNG assets occupy approximately 29 MiB on disk including the unused legacy meadow; approximate active decoded pixel footprint is 70.5 MiB. Runtime heap growth and GPU texture counters were not exposed by the browser evaluation surface and are not claimed.

### KNOWN ISSUES

- Animation remains the clearest visible quality ceiling: Villager task, construction, and carry loops now have authored motion depth, while military walk/hit/death and optional Villager hit/death remain single-pose rows per direction.
- A few tall world objects can still occlude a worker at an interaction point; ground markers and active overlays preserve selection readability.
- Enemy intelligence is intentionally capped and simple; there is no enemy worker economy or broader defense system.
- Audio is procedural effects only, with no music or recorded sound-design layer.
- Long-tail browser/GC render spikes were measured; they are not sustained at current entity counts, but a dev-only heap/performance probe should precede a larger asset/entity budget.

### CERTIFICATION DECISION

See `CROWNFORGE_VERTICAL_SLICE_CERTIFICATION.md` for the full matrix and gate evidence. The tiny vertical slice passes the current foundation gates with no remaining blocker or critical defect. Only the foundation is ready for a separately authorized controlled-expansion phase; no expansion should begin from this pass alone.

### WHAT SHOULD BE POLISHED NEXT

1. Complete matched multi-frame Crown Guard/Ashen Raider walk, hit, and death response depth while preserving anchors and events.
2. Hand-tune optional Villager hit/death depth only if worker combat remains a visible focus.
3. Resolve the remaining worker/object occlusion cases through approach-point and art treatment adjustments.
4. Add a developer-only long-tail performance/heap probe before increasing the content budget.
5. Hand-tune current Raider raid/defense pacing and consider a tiny authored effects pass without expanding content.

### WHAT SHOULD NOT BE BUILT YET

- No new civilizations, ages, technologies, campaigns, maps, units, buildings, resources, formations, diplomacy, naval systems, ranged units, enemy economy, multiplayer, minimap, fog-of-war, or large content catalog.
- No rewrite of the current data-driven simulation/registry architecture.
- No broad performance optimization or asset compression without a measured bottleneck.

## AUTONOMOUS AUDIT, REPAIR + ASSET COMPLETION PASS — 2026-08-16

### SCOPE

- Audited the complete playable vertical slice without adding civilizations, technologies, campaigns, new buildings, new resources, or a larger combat roster.
- Inspected the live map, animation inspection harness, simulation boundaries, renderer, input, UI, restart flow, victory, defeat, and browser runtime logs.
- Used original generated artwork only where the audit found a visible action-quality gap. No protected Age of Empires artwork or other external game assets were used.

### INITIAL PROBLEMS FOUND

- Villager wood, food, stone, and construction actions relied on restrained single-pose task rows, which made the worker feel less finished than the surrounding world and combat assets.
- Food/resource approach selection could choose a rear-side interaction slot, allowing a worker to become visually hidden behind a large berry canopy even while correctly outside the collision footprint.
- Existing animation inspection frame selection assumed direction-column atlases, so it did not accurately exercise a frame-column task-loop layout.

### ASSETS CREATED AND INTEGRATED

- `assets/villager-gather-wood-loop-v1.png` — four authored directions, four subtle action frames.
- `assets/villager-gather-food-loop-v1.png` — four authored directions, four subtle action frames.
- `assets/villager-gather-stone-loop-v1.png` — four authored directions, four subtle action frames.
- `assets/villager-construct-loop-v1.png` — four authored directions, four subtle construction frames.
- All four sheets were alpha-prepared, checked at 1254x1254 RGBA, composited over meadow green, and integrated as the same Crownforge villager family. Two wood drafts were rejected for visible fringe/matte artifacts and are not referenced by the game.

### REPAIRS COMPLETED

- Added data-driven frame-column action-loop metadata and shared frame resolution for gather wood, gather food, gather stone, and construction.
- Synchronized tool-contact and construction-strike timings to the new loop phase while preserving existing gameplay event timing.
- Updated live renderer atlas sizing so the new sheets use their authored direction rows and action-frame columns correctly.
- Updated the animation inspection harness to use the same shared frame resolver as the playable renderer.
- Added a screen-front preference to resource interaction-slot scoring so villagers choose readable approach positions around tall resource objects.
- Retained the current collision, pathfinding, interaction-distance, shadow, selection, cargo, and building systems; this pass changed no broad gameplay scope.

### VALIDATION

- `node --check` passed for all source, developer, and tool modules; repository whitespace checks passed.
- Direct animation probe resolved all four new states across all four directions with four authored frames and the correct atlas rows/columns.
- Animation inspection browser pass showed each new atlas loaded, with no warning or error entries.
- Live map pass tested wood, food, and stone orders; path travel; gathering; carrying/depositing; construction; selected-unit feedback; and the corrected front-biased resource approach.
- Live browser construction pass placed and completed a Hearth House, showing its authored staged artwork and no runtime warnings/errors.
- Fixed-step economy probes confirmed stable cadence and correct gathering/deposit behavior at different render rates; destroyed-dropoff fallback and combat death/cleanup probes also passed.
- Canvas diagnostics measured approximately 0.186 ms average, 0.300 ms p95, and 0.400 ms maximum over the sampled run at current slice entity counts.
- Final browser warning/error logs were empty.

### REMAINING ISSUES, IN PRIORITY ORDER

1. Add matched multi-frame Crown Guard and Ashen Raider attack/recoil/death depth while preserving the current combat silhouette and direction mapping.
2. Add Villager carry, optional worker hit, and death loops; keep these restrained and readable at RTS distance.
3. Resolve the small number of remaining tall-object/building occlusion cases through deliberate art/approach-point tuning.
4. Add a developer-only long-tail heap/performance probe before increasing the asset or entity budget.

### CERTIFICATION

`CONDITIONAL PASS — The vertical slice is playable, coherent, and stable, with specified non-blocking military/carry animation-depth refinements remaining.`

The next repair priority is the matched Crown Guard/Ashen Raider attack/recoil family. Do not begin broad expansion until the remaining animation-depth and occlusion items are rechecked in a focused polish pass.

## POST-AUDIT REMEDIATION AND QUALITY CONVERGENCE — 2026-08-16 (CURRENT)

### WHAT CHANGED

- Added four original four-frame, four-direction Villager carry loops: Wood, Food, Stone, and Supplies.
- Added matched four-frame, four-direction Crown Guard and Ashen Raider attack atlases with ready, anticipation, contact, and recovery phases.
- Updated the data-driven animation definitions and renderer so frame-column action atlases use the correct direction row and authored frame.
- Added numeric atlas-metadata fallback in the Villager renderer. This fixed a live regression where the legacy motion sheet's object-form row metadata produced `NaN` cell height and invisible Villager bodies after the new atlas integration.
- Moved the three opening Villagers to the clear south approach so a fresh reset shows grounded workers instead of silhouettes buried against the Crown Hall/tree composition.
- Added `tools/remediation-regression.mjs`, a deterministic regression suite for animation mapping, reset clearance, gathering cadence, cargo retask, placement/construction, combat, death, victory, and defeat.

### ASSETS CREATED AND INTEGRATED

- `assets/villager-carry-wood-loop-v1.png`
- `assets/villager-carry-food-loop-v1.png`
- `assets/villager-carry-stone-loop-v1.png`
- `assets/villager-carry-supplies-loop-v1.png`
- `assets/crownforge-soldier-attack-loop-v1.png`
- `assets/crownforge-raider-attack-loop-v1.png`

All six runtime files are clean `1254 x 1254` RGBA atlases. A fringe/matte food draft was rejected and is not referenced.

### SYSTEMS VERIFIED

- Fresh reset: three Villagers visible, selected, grounded, and outside player building footprints.
- Wood gathering: right-click target, route, task, carry state, storage return, and Wood total increase all worked live; the browser panel showed `2 carrying`, then Wood reached `180 / 180`.
- Food gathering: berry order produced the Food-specific carry state and basket readout while an Ashen Raider was active nearby.
- Stone gathering: stone order produced the Stone-specific carry state and stone payload readout at the eastern deposit.
- Combat: selected Crown Guard closed on Ashen Camp; camp health fell and the guard health bar reflected incoming damage.
- Automated deterministic checks passed exact 20 Hz/60 Hz gathering convergence, cargo-preserving retask, placement rejection, Hearth House completion, melee damage/death, victory, and defeat.
- Post-change lighting benchmark: `0.222 ms` average, `0.300 ms` p95, `0.400 ms` max. Runtime heap/GPU telemetry remains unavailable and is recorded as a limitation.

### KNOWN ISSUES (CURRENT)

- Crown Guard/Ashen Raider walk, hit, and death still use single-pose authored rows. Attack action depth is improved but not a complete military animation family.
- A few rare tall-object interaction views may still benefit from approach-point tuning.
- Enemy AI remains intentionally capped: replacement, defense, and occasional raid only.
- Effects remain procedural and there is no music layer.
- Direct runtime heap/GPU counters are not exposed by the current browser surface.

### WHAT SHOULD BE POLISHED NEXT

1. Complete the matched existing military walk/hit/death response family without adding a new unit type.
2. Recheck the remaining tall-object interaction views at normal and close zoom.
3. Add a dev-only heap/GPU probe before any significant entity or asset-budget increase.

### WHAT SHOULD NOT BE BUILT YET

- No new civilizations, ages, technologies, campaigns, maps, units, buildings, resources, formations, diplomacy, ranged units, enemy economy, multiplayer, fog-of-war, minimap, or other expansion systems.
- No broad AI rewrite, no new combat roster, and no new asset catalog.

### CURRENT CERTIFICATION

`CONDITIONAL PASS — The vertical slice is stable and playable, but the specified non-blocking quality deficiencies remain.`

## WORLD ASSET FRAMING + BUILDING SCALE PASS — 2026-08-16

### SCOPE

- Removed the world-space resource-node labels completely. Resource identity and carried amounts remain available through selection and settlement UI; no gameplay information was removed.
- Kept Villager, Crown Guard, and Ashen Raider render sizes unchanged.
- Enlarged the existing building family only: Crown Hall 294 px, Hearth House 232 px, Waystore 250 px, and Ashen Camp 330 px wide with its natural 3:2 aspect preserved.

### REPAIRS COMPLETED

- Rounded the source rectangles used for the 4 x 4 environment and construction atlases. The source sheets are 1254 px wide, so fractional 313.5 px sampling could bleed a neighboring cell into a tree, berry, or stone edge. Integer source bounds now keep each cell self-contained during canvas interpolation.
- Repositioned the first west tree to `(3.8, 14.2)` so its full canopy is not buried by the player settlement composition while keeping the deterministic wood route reachable.
- Separated the two berry nodes to `(15.2, 5.8)` and `(18.5, 10.5)` so their foliage is not visually divided by the Ashen Camp, raider, or the neighboring berry sprite.
- Added a versioned module/style URL in the Crownforge entry page so the browser and Pages deployment pick up renderer/config changes together rather than retaining an older cached module graph.

### VALIDATION

- Fresh 1280 x 720 local browser load showed no resource labels, unchanged readable human scale, larger buildings, complete tree/bush silhouettes, and no square sprite seams.
- Normal map framing kept the enlarged Crown Hall and Ashen Camp inside the playable view without topbar clipping.
- Atlas source-bound change passed syntax and whitespace checks; the deterministic gameplay regression suite remains the required follow-up gate.

### KNOWN ISSUES

- The buildings are intentionally larger than their unchanged gameplay footprints; future building-art work should preserve this visual contract and recheck placement/occlusion before changing collision geometry.
- Tall-object occlusion is still limited to the existing authored depth treatment; this pass addressed the visible opening composition without adding a new render or gameplay system.

### WHAT SHOULD BE POLISHED NEXT

1. Recheck construction preview and a completed Hearth House at close zoom with the larger building family.
2. Recheck worker approach readability around the newly separated food clearings.
3. Keep the current asset catalog and human scale fixed while polishing remaining military response animation depth.

### WHAT SHOULD NOT BE BUILT YET

- No new resources, buildings, units, civilizations, technologies, campaigns, maps, or AI systems.
- No new raster family was generated for this pass; the existing Crownforge originals were reframed and rendered without atlas-cell bleeding.

## ASHEN RAIDER MOTION + COMBAT FRAMING PASS — 2026-08-16

### WHAT CHANGED

- Added `assets/crownforge-raider-walk-loop-v1.png`, an original 4 x 4 RGBA atlas with four facing rows and four subtle walk phases. The Ashen Raider now uses this loop while moving instead of holding one static walk-row pose.
- Added `assets/crownforge-raider-attack-loop-v2.png`, an original 4 x 4 RGBA attack atlas with ready, raise, contact, and recovery frames for all four directions. The axe and the full silhouette have deliberate per-cell clearance; no weapon fragment is allowed to bleed into a neighboring frame.
- Updated the data-driven combat animation definitions so Raider walking runs at a restrained 6.8 fps with footstep timing, while the existing attack timing continues to drive the damage contact event.
- Moved the opening Raider to a clear patrol pocket at `(22.35, 8.55)` so it does not disappear behind the enlarged Ashen Camp or nearby resource art.
- Reworked capped Raider reinforcement positions into three deterministic west/south clearing slots. Reinforcements now avoid active units and do not spawn beneath the camp silhouette or beside the berry clearing.
- Extended the final readability overlay to account for tall berry, stone, and tree sprites. An active enemy that is legitimately behind a resource can redraw its silhouette and health/selection feedback without changing collision or pathfinding.
- Bumped the Crownforge module graph cache marker to `20260816-raiderpass1` so the new animation definitions and assets load together.

### VALIDATION

- JavaScript syntax check passed across `src`, `dev`, and `tools`.
- `tools/remediation-regression.mjs` passed all existing animation, gathering, construction, combat, victory, and defeat checks.
- Direct simulation spawn check produced three separated Raider positions in the west/south clearing; the closest tested pair was 1.45 world units apart, above the combined collision radii.
- Local 1280 x 720 browser inspection showed the opening Raider visible beside the camp, spawned Raiders readable in the clearing, and the live browser console free of errors or warnings.

### KNOWN ISSUES

- Raider walking is now a real directional loop, but the military hit and death states remain intentionally restrained single-pose responses for this small slice.
- The new generated Raider loops share the existing Crownforge camera and grounded contact treatment; any future camera-angle change should recheck the four direction rows.
- The final occlusion repaint prioritizes enemy readability when a tall resource wins depth sorting; it is intentionally limited to active/selected units and does not change world collision.

### WHAT SHOULD BE POLISHED NEXT

1. Hand-tune military hit and death response depth after the Raider walk/attack loop has been playtested against the Crown Guard.
2. Recheck the enlarged camp and resource clearing at close zoom after any future building-art change.
3. Keep the unit roster and enemy AI cap unchanged while validating the existing match loop.

### WHAT SHOULD NOT BE BUILT YET

- No new civilizations, buildings, resources, technologies, campaigns, maps, unit types, formations, ranged combat, or broader enemy economy.
- No new combat system beyond the two existing melee types.

## ATLAS CELL + BUILDING OCCLUSION PASS — 2026-08-16

### WHAT CHANGED

- Repaired the shared 4 x 4 atlas sampler. The previous outward-rounded source rectangles still included a neighboring half-pixel from the 1254px sheets; cells now use a one-pixel interior inset so tree tops, berry bushes, stone deposits, construction art, combat frames, and Villager sheets cannot pull fragments from adjacent cells.
- Routed legacy Villager atlas states through the same protected sampler so future idle/task/carry sheets receive the same edge treatment.
- Added art-aware `collisionClearance` to Crown Hall, Hearth House, Waystore, and Ashen Camp. Units now stop outside the visible building silhouette, not merely outside the smaller original gameplay footprint.
- Expanded building approach points, path blocking, unit constraints, combat approach rings, placement checks, and selection/placement footprints to use the same visual clearance contract.
- Increased the safe path endpoint tolerance slightly so a route ending at the final open approach cell still resolves to the intended interaction point around an enlarged building instead of leaving a builder one cell short.
- Bumped the module graph marker to `20260816-occlusion2`.

### VALIDATION

- Full JavaScript syntax check passed.
- `tools/remediation-regression.mjs` passed all deterministic animation, gathering, construction, combat, victory, and defeat checks.
- Construction regression now completes with the enlarged collision contract; the builder reaches the approach point and finishes the Hearth House.
- A 70-second deterministic enemy-AI simulation produced three active Raiders with zero units inside any live building collision bounds.
- Raider walk animation continues to resolve directional frame columns `[0, 1, 2, 0]` across a short playback sample.
- Local 1280 x 720 browser inspection at normal and closer zoom showed intact tree tops, clean berry/stone silhouettes, no stray atlas strip beside the Crown Hall, and Raiders outside the enlarged buildings.
- Local browser runtime logs were empty.

### KNOWN ISSUES

- Close zoom can still place tall authored silhouettes near the browser HUD by design; the world remains clean at the supported default framing.
- Collision clearance is intentionally conservative around the enlarged building art, so some narrow building arrangements now reject placement or route around a wider perimeter.
- No new gameplay systems or asset families were added in this pass.

### WHAT SHOULD BE POLISHED NEXT

1. Recheck the collision-clearance values if a future building art revision changes the visible base shape.
2. Hand-tune the remaining military hit/death animation depth after this render/pathing repair is stable.
3. Keep the small unit/building roster fixed while completing the existing match loop.

### WHAT SHOULD NOT BE BUILT YET

- No new civilizations, buildings, resources, technologies, campaigns, maps, unit types, formations, ranged combat, or broader enemy economy.
- No replacement terrain system or new environmental catalog; this pass corrected the existing atlas family and its world interaction contract.

## LARGE MAP + SETTLEMENT SCALE + QUICK PRODUCTION PASS — 2026-08-16

### SCOPE DECISION

- Interpreted “10x bigger map” as approximately ten times the playable area: the board is now `90 x 73` world cells instead of `30 x 22` (`6570` versus `660` cells). The map remains intentionally sparse rather than being filled with decorative clutter.
- Kept Villager, Crown Guard, and Ashen Raider render scale unchanged. Buildings were made dramatically larger and given larger gameplay footprints/clearances so the visual scale is more believable without making a literal 10x sprite multiplier that would swallow the playable camera.
- No water was added yet. Water would need a walkability/terrain contract to avoid becoming a decorative obstacle that units can path through.

### WHAT CHANGED

- Expanded the map configuration to `90 x 73`, widened camera travel limits for a map larger than the viewport, lowered the default zoom to keep the enlarged structures readable, and biased the opening camera south so tall building art stays under the HUD boundary.
- Repositioned the opening Crown Hall, Hearth House, Waystore, Ashen Camp, resources, decorations, villagers, and starting Crown Guard into a sparse larger-world composition.
- Kept the opening Crown Guard in a clear north-east pocket of the starting settlement so the unit is not hidden beneath the bottom command deck at the default camera framing.
- Reworked the meadow renderer to repeat the existing original meadow texture inside the projected map diamond instead of stretching one small board across the entire expanded world. No new raster asset was necessary and no visible square terrain card is drawn.
- Increased building gameplay footprints and art sizes: Crown Hall `6x5 / 440px`, Hearth House `4x3 / 350px`, Waystore `4x3 / 370px`, and Ashen Camp `6x5 / 500px`; the existing collision-clearance contract remains active for pathing, placement, and interaction.
- Separated the starting Hearth House farther northwest from the Crown Hall so the two large silhouettes do not read as one stacked structure.
- Added role-based unit spacing data for Villagers, Crown Guards, and Ashen Raiders. Group move spacing, local collision comfort distance, exact-overlap recovery, and production spawn checks now use the role’s personal-space/group-gap values.
- Added bounded Crown Hall production for the existing two player unit types only: Villager (`50 Food`, `7 sec`) and Crown Guard (`75 Food + 25 Wood`, `11 sec`). The queue is capped at three, respects population housing, spends resources on order, pauses safely when spawn space is blocked, and places new units outside the building using spacing checks.
- Added bottom command-deck quick menus: `BUILDINGS` opens the existing Hearth House blueprint menu; selecting the Crown Hall reveals `TRAIN UNITS` with Villager and Crown Guard options, queue status, cost feedback, tooltips, and disabled states.
- Updated the module graph cache marker to `20260816-expansion2` so the expanded config, simulation, renderer, and UI load together.

### VALIDATION

- JavaScript syntax check passed across `src`, `dev`, and `tools`.
- `git diff --check` passed for the changed source, UI, and regression tool files.
- `tools/remediation-regression.mjs` passed all animation, gathering, construction, combat, victory, and defeat checks after updating the placement assertion and allowing for longer travel to a valid remote build site.
- Deterministic 60-second large-map soak: victory completed after the Crown Guard destroyed the Ashen Camp; two queued player units spawned; population ended at `6 / 8`; zero units entered any live building collision bounds; minimum measured live-unit separation was `1.32` world units.
- Local browser inspection at `1280 x 720` confirmed: larger separated buildings, unchanged human scale, sparse repeated meadow terrain, bottom Buildings menu, Crown Hall Train Units menu, accepted Villager/Crown Guard training orders, completed unit spawn, valid/invalid placement feedback, Escape cancellation, and an empty browser console log.

### KNOWN ISSUES

- The map is now intentionally larger than the opening viewport, so the full resource/camp layout requires camera pan/zoom exploration. Edge scrolling is still not enabled; WASD/arrow and middle-drag remain the camera contract.
- Buildings are substantially larger and more readable, but the art-to-footprint ratio is still deliberately generous. Future building revisions should preserve the current larger clearances and recheck close zoom before increasing sizes again.
- Production is intentionally limited to the Crown Hall and the two existing player unit types. There is no generalized production-building framework, queue rally point UI, or multi-building training yet.
- Water was deferred because it would require real terrain walkability and pathfinding rules, not just a decorative patch.
- The existing small military roster, capped enemy AI, single biome, and fixed four-direction art standard remain unchanged.

### WHAT SHOULD BE POLISHED NEXT

1. Recheck the larger map at the minimum and maximum camera zooms, especially the expanded resource clearings and Ashen Camp edge framing.
2. Polish the selected-building production panel with a dedicated queue progress treatment only if it remains useful after more playtesting; keep the current menu compact.
3. Recheck building placement and construction approach slots around the larger footprints before adding any new structure type.

### WHAT SHOULD NOT BE BUILT YET

- No new civilizations, ages, technologies, campaigns, maps, biomes, water mechanics, resources, buildings, unit types, formations, ranged combat, diplomacy, multiplayer, fog-of-war, minimap, or broad AI economy.
- No literal 10x raster enlargement of buildings, no new art catalog, and no new production roster until the current larger settlement remains readable at normal and close zoom.

## VISUAL INTEGRITY AND DEPLOYMENT VERIFICATION — 2026-08-16

### WHAT EXISTS

- The existing small Crownforge slice now runs under the `20260816-integrity1` cache marker.
- The active Ashen Raider attack family is the new padded RGBA `assets/crownforge-raider-attack-loop-v3.png`.
- The source-of-truth audit worktree was based on `origin/main` commit `bf54155`; the stale untracked `/New project/crownforge` copy was not used for deployment.

### WHAT WAS COMPLETED

- Reproduced the marauder v2 attack-sheet weapon bleed in the developer viewer.
- Rebuilt the four-direction, four-frame marauder attack atlas from original generated directional strips.
- Replaced the defective back-left contact/recovery cells so the axe is connected and no detached blade remains.
- Made the developer animation viewer use the same one-pixel source-cell inset as the live renderer.
- Exposed resolved animation state and fallback metadata in the viewer; no fallback is now silent.
- Added `tools/visual-integrity-audit.mjs` for active-file, placeholder, dimension, direction, fallback, and atlas-boundary checks.
- Added reproducible atlas composition/patch tools and three audit handoff documents.
- Re-ran syntax, diff hygiene, remediation regression, movement stress, animation coverage, construction placement, selection, and right-click movement checks.

### KNOWN ISSUES

- Soldier and Ashen Raider hit states still intentionally fall back to idle; this is an explicit visual polish gap, not a missing-file failure.
- A few raw environment atlas silhouettes touch source-cell edges; the live renderer’s inset and local/live visual review currently prevent visible crops, but this should be rechecked when environment art changes.
- Browser heap/GPU counters remain unavailable, so no direct memory-stability claim is made.

### ASSETS CREATED

- `assets/crownforge-raider-attack-loop-v3.png` — original generated, padded, connected-weapon marauder attack atlas.
- Intermediate generated strips and a standalone contact frame were used as preparation inputs and are not runtime assets.

### SYSTEMS CREATED OR UPDATED

- Visual integrity asset audit tool.
- Atlas composition and transparent-cell replacement tools.
- Viewer/live source-cell sampling parity.
- Animation fallback observability.
- Cache/build identity marker for the repair pass.

### WHAT SHOULD BE POLISHED NEXT

1. Generate and integrate matched four-direction hit/death depth for Crown Guard and Ashen Raider.
2. Recheck rare tall-object interaction occlusion at minimum and maximum zoom if a concrete case is reproduced.
3. Repeat the deployed visual matrix after the final push — completed for the `20260816-integrity1` route; keep this as the required check for the next asset pass.

### WHAT SHOULD NOT BE BUILT YET

- No new civilizations, ages, technologies, campaigns, maps, biomes, water systems, resources, buildings, unit classes, formations, ranged combat, or broad AI economy.
- Do not repeat the completed v3 marauder attack repair or expand the art catalog until the existing combat response family is visually complete.

## ENVIRONMENT ATLAS FRAMING REPAIR — 2026-08-18

### WHAT EXISTS

- The active environment family now uses `assets/crownforge-environment-atlas-v3.png` through the `20260818-env3` cache marker.
- The runtime still uses one 4x4 atlas: four trees, four berry bushes, four stone deposits, and four small environmental details.

### WHAT WAS COMPLETED

- Reproduced the earlier tree/bush/stone “cut in half” issue by auditing the exact source rectangles used by `drawAtlasCell`; the previous v2 sheet had silhouettes touching or crossing the lower edge of their source rows.
- Generated a fresh original Crownforge environment family, removed the generator background, separated the 16 complete objects, and repacked them into equal padded atlas cells.
- Kept each object fully inside its own cell with clear transparent breathing room on every side, including roots, ground shadows, berries, rock bases, and small-detail silhouettes.
- Updated both `games/crownforge` and `public/crownforge` asset/config mirrors to the new atlas and cache marker.
- Re-ran the active-file visual integrity audit: 1254x1254 RGBA, no missing files, no placeholder references, no dimension mismatch, and zero top/side/bottom boundary-contact cells for the active environment atlas.
- Reloaded the local browser build at 1280x720; the title loaded correctly, the browser console remained empty, and the existing settlement/resources remained visually coherent after the atlas swap.

### ASSETS CREATED

- `assets/crownforge-environment-atlas-v3.png` — original generated and repacked padded 4x4 family for trees, berry bushes, stone deposits, fallen log, stump, flowering plant, and loose stones.
- The previous `crownforge-environment-atlas-v2.png` remains in the repository for historical comparison but is no longer referenced by the active renderer.

### SYSTEMS CREATED OR UPDATED

- Environment atlas source-cell safety verification.
- Active environment asset versioning and cache identity.
- Mirrored source/public asset propagation.

### KNOWN ISSUES

- The 4x4 environment family is now source-cell safe, but the fixed camera can still place very tall world art beneath the HUD at extreme pan/zoom positions; that is viewport layering rather than atlas cropping and should only be changed with a concrete camera-framing pass.
- The generated family intentionally remains small; no additional tree, bush, stone, or biome catalog was added.

### WHAT SHOULD BE POLISHED NEXT

1. Recheck the deployed environment family at minimum and maximum zoom after the push, especially the western trees and the eastern berry/stone clearing.
2. If a tall asset is still visually hidden by UI in a normal player camera position, adjust camera safe framing separately from atlas art.

### WHAT SHOULD NOT BE BUILT YET

- No new biomes, water, terrain system, environmental clutter catalog, resource types, civilizations, buildings, units, technologies, or AI systems.

## TERRAIN / CAMERA WORLD-SPACE PASS — 2026-08-18

### CAUSE FOUND

- The ground was rendered from a repeating canvas pattern in screen coordinates while buildings, units, resources, and props used `worldToScreen()`. Camera movement therefore moved the entities over a meadow that was visually glued to the viewport.
- A world-space road renderer already existed but was not called by the map pass. The previous meadow artwork also contained paths, so repeating it exposed hard texture seams during camera movement.

### WHAT CHANGED

- Added `assets/crownforge-grass-tile-v1.png`, an original Crownforge grass-only tile with restrained wildflowers and stones, generated to repeat cleanly without embedded roads.
- Cached the grass pattern and anchored it at the projected world origin with the camera zoom and translation. Older canvas implementations fall back to a camera-following map draw rather than a viewport-fixed pattern.
- Enabled the authored world-space road pass inside the terrain clip, with rounded shadow, surface, and highlight strokes for the settlement-to-camp route and its junction.
- Bumped the active cache marker to `20260818-ground1` and mirrored the source/runtime changes into `public/crownforge`.

### VERIFIED

- Local 1280x720 browser sweep: initial view, zoom in, zoom out, rapid east/south/west/north camera movement, map-edge views, and tall-object contact all keep terrain, roads, units, resources, and buildings in the same world relationship.
- Browser console remained empty during reload, zoom, and camera sweeps.
- Static module syntax, `git diff --check`, and the visual-integrity audit passed; no placeholder references or active environment-atlas boundary contacts were introduced.

### REMAINING WEAKNESSES

- The grass family is intentionally small, so close inspection can still reveal repeated natural detail; no larger biome catalog was added in this focused pass.
- Tall world art can still sit beneath the HUD at extreme camera framing positions; that is a viewport-safe-framing issue, not terrain drift or atlas cropping.
- The current slice still has no water surface or terrain-height variation.

### HIGHEST PRIORITY NEXT

- If the next visual pass continues terrain work, add only a restrained second grass variation and a small number of authored dirt transitions after a concrete repetition case is reproduced. Keep camera safe framing separate from terrain art.

### WHAT SHOULD NOT BE BUILT YET

- Do not expand into new biomes, water simulation, terrain elevation, a large road catalog, new resources, civilizations, ages, technologies, campaigns, or additional unit classes until this small map remains visually coherent under another full-match QA pass.

## ROAD MATERIAL / EASY AI PACING PASS — 2026-08-18

### WHAT WAS COMPLETED

- Replaced the road's flat debug-like stroke treatment with an original Crownforge packed-earth road tile: warm ochre/umber soil, embedded pale stones, and restrained dry-grass variation.
- Kept the route in world space so its material remains anchored while the camera pans and zooms. The road now layers a soft earth shadow, textured body, worn edge, and small irregular surface marks instead of reading as a placeholder line.
- Added the generated road tile to both `games/crownforge/assets` and `public/crownforge/assets`, with the `20260818-easyroads1` cache identity.
- Set the only shipped enemy profile to `easy`: the camp now waits 90 simulation seconds before its first Crown Hall raid, waits 75 seconds between follow-up raids, caps the active Raider force at two, and replaces units on a 32-second cadence when safe.
- Preserved readable enemy behavior: Raiders retain a 5.2-world-unit local awareness radius, defend when the camp is attacked, and hold a defensive response for 10 seconds. The easier profile gives the player more time without making the enemy blind or inert.

### ASSETS CREATED

- `assets/crownforge-dirt-road-tile-v1.png` — original generated packed-earth material tile for the settlement road.

### SYSTEMS UPDATED

- `src/renderer.js` — world-anchored road material pattern and layered road ribbon.
- `src/config.js` — single default `easy` enemy pacing profile.
- `src/simulation.js` — delayed first raid, slower follow-up, capped reinforcements, and preserved local defense/awareness.

### VERIFIED

- Local browser reload at 1280x720 shows the road reading as textured packed earth and remaining aligned with the settlement while zooming.
- Fresh-match pacing check reached `DAYBREAK 1:22` without the Crown Hall raid announcement; the first raid appeared only after the configured delay threshold. Browser console logs remained empty.
- `node --check`, `git diff --check`, `tools/visual-integrity-audit.mjs`, and `tools/remediation-regression.mjs` passed.

### KNOWN ISSUES

- The road is intentionally one authored material family for this small map; no second road biome or water crossing was added.
- There is intentionally no difficulty selector yet. `easy` is the only shipped profile until the opening and full-match pacing have been played through on the deployed build.

### WHAT SHOULD BE POLISHED NEXT

1. Play one complete deployed match from the new opening window and tune only if the first raid still feels too abrupt in real player use.
2. If a second road texture is ever needed, add it only for a concrete terrain transition rather than broadening the asset catalog.

### WHAT SHOULD NOT BE BUILT YET

- No new enemy factions, workers, economy optimization, difficulty modes, terrain biomes, water simulation, road network system, buildings, units, technologies, or campaigns.

## ROAD HIERARCHY / SETTLEMENT ROUTES PASS — 2026-08-18

### WHAT WAS INSPECTED

- Audited the existing road generation in `src/renderer.js` before editing. The old renderer used two straight two-segment strokes with one shared material and did not express entrances, lanes, footpaths, plazas, or lived-in roadside context.
- Confirmed that roads are renderer-only: simulation pathfinding, walkability, building collision, resource collision, and unit spacing do not read the road art. The visual pass therefore preserves gameplay navigation and collision behavior.
- Checked the active map layout so the new routes connect the Hearth House, Crown Hall, Waystore, northern food area, stone clearing, and east-side berry route without running beneath building footprints.

### WHAT WAS COMPLETED

- Replaced the old two-path renderer with one shared world-space `ROAD_NETWORK` containing:
  - a wide main settlement road from the western approach through the settlement toward the Ashen Camp;
  - narrower curved village lanes for the Hearth House, Crown Hall entrance, and Waystore;
  - subtle footpaths toward the northern field, stone clearing, and east berry area.
- Used quadratic curve interpolation and hand-authored control points so routes have gentle bends and irregular settlement flow rather than perfectly straight strips.
- Added wider dusty plaza treatments at the Crown Hall junction and the Waystore gathering edge. Road layers now separate a green feather, low shadow, light dusty shoulder, dark compacted center, and restrained world-anchored dirt texture.
- Added intentional wear marks in the existing road system: paired wagon ruts, small puddles, footprint pairs, broken shoulder highlights, and scattered roadside stones. These remain sparse and readable at RTS distance.
- Generated and integrated one original Crownforge roadside prop family: a 2x2 transparent plate containing a timber fence section, weathered signpost, cargo nook with barrel/crates, and warm settlement lantern. Props are sampled with preserved source proportions and drawn in world depth order, avoiding square stretching or cell cropping.
- Added a few existing flower/shrub details beside important routes for grass-to-road blending without creating a large environmental catalog or altering gameplay collision.
- Mirrored the renderer, config, cache marker, generated prop asset, and index changes into `public/crownforge`.
- Updated `CROWNFORGE_ASSET_MANIFEST.md` with the roadside asset and renderer-owned road surface entry.

### ASSETS CREATED

- `assets/crownforge-roadside-props-v1.png` — original 1536 x 1024 RGBA roadside source plate; clean alpha, 2x2 authored cells, no colored fringe or matte.
- The existing `assets/crownforge-dirt-road-tile-v1.png` remains the shared packed-earth surface material; this pass uses it across the hierarchy with different widths, alpha, shoulder treatment, and density rather than creating redundant road textures.

### SYSTEMS UPDATED

- `src/renderer.js` — shared road network, curved route tracing, hierarchy-specific widths, plaza widening, material layers, wear marks, roadside prop depth sorting, and transparent prop sampling.
- `src/config.js` — `ROAD_DETAILS_ATLAS` source definition and cache identity.
- `src/index.html`, `src/main.js`, `src/animation.js`, `src/simulation.js` — `20260818-roads2` cache marker propagation for the mirrored runtime.
- `CROWNFORGE_ASSET_MANIFEST.md` — roadside family and road rendering source map.

### VERIFIED

- Reloaded the local browser build at 1280 x 720. The main road is immediately visible at normal zoom, reads as packed earth rather than a thin tan line, and remains visually connected to the settlement entrances.
- Zoomed in to inspect shoulders, dark centers, plazas, ruts, puddles, footprints, roadside stones, and the generated prop family. No square prop backgrounds, obvious source-cell crops, or console errors appeared.
- Panned across the settlement and toward the eastern route. The road material, route curves, and roadside details stayed world-anchored while the meadow and buildings moved with the camera.
- Confirmed source/public mirrors are byte-identical for the changed renderer, config, index, and roadside PNG.
- Passed `node --check` for every Crownforge source file, `git diff --check`, `tools/visual-integrity-audit.mjs`, and `tools/remediation-regression.mjs`.

### KNOWN ISSUES

- Roads are intentionally visual-only in this pass. They do not yet provide a separate gameplay movement-cost or wagon-navigation layer; adding one would be a larger system change and is not needed for the current slice.
- The small map reuses one packed-earth material family across the hierarchy. The authored differences currently come from width, alpha, shoulder profile, curves, wear density, and placement rather than a second biome or water-crossing material.
- The existing UI can still cover very tall world art at extreme camera framing positions. This remains a viewport-safe-framing concern, not road or roadside asset cropping.

### WHAT SHOULD BE POLISHED NEXT

1. Play one complete deployed match with the new route layout and confirm the visual hierarchy still reads during gathering, construction, and the first raid.
2. If a concrete repetition case appears during normal play, add only a restrained alternate road wear treatment or one more authored junction detail.
3. Keep building entrance alignment and camera-safe framing as separate focused passes.

### WHAT SHOULD NOT BE BUILT YET

- No water crossings, road traffic simulation, wagon system, movement-speed modifiers, new biomes, large prop catalog, new resources, civilizations, units, technologies, campaigns, or expanded AI.

## FIRST-AGE SANDBOX / PRODUCTION & CONTROL PASS — 2026-08-18

### WHAT EXISTS

- The playable first-age slice now starts as a generous experimentation sandbox: Crown Hall, Hearth House, Waystore, three villagers, one Crown Guard, the Ashen Camp, easy enemy pacing, and a larger but still lightly populated map.
- The Crown Hall is the first production structure. Crown Barracks is the first military production structure. Lumber Mill, Stone Quarry, Grain Mill, Grain Field, and Palisade Wall are available from the first-age blueprint menu.
- All current first-age blueprints are unlocked from the start. The match begins with 5,000 Food, 5,000 Wood, and 5,000 Stone, a 999 population sandbox capacity, and a 100-order production queue limit.

### WHAT WAS COMPLETED

- Replaced the Crown Guard's single-frame movement fallback with a dedicated four-direction, four-frame walk loop. Direction is chosen from the intended path vector before collision nudges so the guard no longer walks backward or shows a static combat pose while moving.
- Verified direct right-click movement for both a selected Crown Guard and selected villagers. Group destinations retain spacing rather than collapsing to one point, while a single unit can move directly to the clicked area.
- Added a compact, lower-left Field Manual panel below First Light Orders. It explains left click, drag, Shift-click, right click, scroll, WASD, middle-drag, and Escape. Its minimize button was tested, and the expanded panel fits above the command deck at 1280x720.
- Expanded the build menu into a first-age blueprint family: Hearth House, Crown Barracks, Lumber Mill, Stone Quarry, Grain Mill, Grain Field, and Palisade Wall. The menu was moved upward at shorter viewport heights so all seven options remain clear of the command deck.
- Connected production to the correct building: Crown Hall trains Villagers, Crown Barracks trains Crown Guards, and each queue is limited to the sandbox cap instead of an artificial early prototype cap. Production buttons now hide units that the selected building cannot create.
- Added a one-farmer Grain Field loop. A completed field claims an idle villager, routes that farmer to a believable field edge, shows tending as a food task, and periodically adds food. Retasking the farmer releases the field cleanly.
- Spread the default Hearth House and Waystore farther from the Crown Hall and added more wood groves, individual trees, stone clearings, and grain plots without filling the map with clutter.
- Added a four-stage generated tree-grove depletion sheet: full grove, one tree removed, reduced grove, and cleared stumps/logs. Grove footprints are blocked for pathfinding so villagers interact at the perimeter rather than standing inside the art.
- Added original transparent first-age art for Crown Barracks, Lumber Mill, Stone Quarry, Grain Mill, Grain Field, and Palisade Wall. They share Crownforge's warm timber, blue-and-gold, grounded isometric treatment and are mirrored into the public game build.

### ASSETS CREATED

- `assets/crownforge-soldier-walk-loop-v1.png` — four-direction Crown Guard movement sheet.
- `assets/crownforge-tree-grove-depletion-v1.png` — four-stage wood-grove depletion sheet.
- `assets/crownforge-barracks-v1.png` — Crown Barracks.
- `assets/crownforge-lumber-mill-v1.png` — Lumber Mill.
- `assets/crownforge-quarry-v1.png` — Stone Quarry.
- `assets/crownforge-grain-mill-v1.png` — Grain Mill.
- `assets/crownforge-field-v1.png` — Grain Field.
- `assets/crownforge-wall-v1.png` — Palisade Wall.

### SYSTEMS CREATED / UPDATED

- `src/animation.js` and `src/simulation.js` — directional Crown Guard locomotion, intended-vector facing, direct movement, spacing-aware group orders, field assignment, and field production.
- `src/config.js` — sandbox resources/capacity, first-age building definitions, production definitions, grove atlas, and new generated asset definitions.
- `src/renderer.js` — grove depletion stages, first-age building rendering, custom build previews, resource footprints, and larger authored utility buildings.
- `src/main.js`, `src/input.js`, `index.html`, and `styles.css` — first-age blueprint menu, production menu routing, controls panel, minimize behavior, and viewport-safe menu layout.

### VERIFIED

- Local browser playtest at 1280x720: Crown Guard selected and moved by right click in multiple directions; villagers selected by box and moved by right click; no browser console warnings or errors.
- Local browser playtest: Crown Hall queued a Villager, a Crown Barracks was placed in an open area, construction completed, and the Barracks queue correctly offered a Crown Guard while hiding Villager production.
- Local browser playtest: a Grain Field was placed and completed. The underlying simulation test confirmed automatic farmer assignment and food production while the farmer was tending the field.
- Local browser playtest: building menu, production menu, controls minimization, zoom, and keyboard camera pan were exercised at the target viewport. Build and train menus remained clear of the command deck.
- `node --check` passed for every source file, `git diff --check` passed, `tools/visual-integrity-audit.mjs` passed with no missing files or placeholder references, and `tools/remediation-regression.mjs` passed all existing economy, construction, combat, victory, and defeat checks.

### KNOWN ISSUES

- The visual-integrity audit still reports pre-existing atlas edge-contact cells in older villager/combat sheets and the intentional `hit` to `idle` fallback for soldier and raider damage states. The new Crown Guard walk sheet itself is dimensionally correct and is used only for movement.
- The new utility buildings use clean authored completed art plus the existing construction treatment/alpha progression. They do not yet have bespoke four-image foundation, partial, near-complete, and completed art for every new blueprint.
- Grain resource nodes currently share the single generated field rendering. This is sufficient for the sandbox loop; a second grain variant should wait until a real repetition problem appears in play.
- This remains a first-age sandbox. There are no additional ages, technologies, civilizations, campaigns, advanced military classes, or economy optimization systems.

### WHAT SHOULD BE POLISHED NEXT

1. Play one complete deployed sandbox match after this pass and tune only issues that remain visible in normal resource, construction, production, and first-raid play.
2. Give the new utility buildings bespoke construction-stage art only after the current production and placement workflows remain stable.
3. Revisit atlas edge-contact cells and the intentional damage-state fallback as a focused animation cleanup pass.

### WHAT SHOULD NOT BE BUILT YET

- Do not add new ages, technology trees, civilizations, campaigns, diplomacy, naval systems, advanced formations, siege weapons, multiple enemy economies, or a large building catalog before this first-age sandbox remains reliable and visually coherent in a deployed complete-match test.

## ROAD-FREE OPENING MAP PASS — 2026-08-18

### WHAT WAS COMPLETED

- Removed the authored road network from the opening first-age map. The main settlement road, village lanes, footpaths, plazas, road wear marks, and roadside props no longer render when a new match starts.
- Added `CONFIG.startingRoads`, a clear first-age switch that keeps the road renderer and its authored data available for a later-age buildable-road feature without changing current pathfinding, collision, or unit movement.
- Bumped the first-age module URLs to the `roadsfree1` cache version so deployed browsers load the road-free renderer immediately instead of retaining the prior road-enabled JavaScript bundle.
- Kept the natural meadow, terrain details, buildings, resources, and existing simulation routes unchanged. This pass changes only the initial visual presentation.

### VERIFIED

- Confirmed the source and public game builds use the same road-free configuration.
- Confirmed the existing source-level Crownforge audits remain the next required check before deployment.

### KNOWN ISSUES

- Roads are intentionally not available as a player build action yet. The retained road assets and route data are future-age foundation only.

### WHAT SHOULD BE POLISHED NEXT

1. Play the road-free opening at normal zoom and after panning to confirm the meadow remains authored and does not feel visually empty.
2. When roads return in a later-age pass, make them an explicit buildable object with placement, pathfinding, and construction rules rather than re-enabling a fixed starting network.

### WHAT SHOULD NOT BE BUILT YET

- Do not restore starting roads, add road traffic, or introduce movement-speed modifiers until road construction is an intentional later-age gameplay feature.

## PALISADE / FIELD / COMBAT PRESENTATION PASS — 2026-08-18

### WHAT EXISTS

- The first-age sandbox now includes one buildable defensive wall family: the Palisade Wall. It remains intentionally small, but the placement interaction supports a useful wall run rather than only isolated segments.
- Existing Crown Hall, Hearth House, Waystore, utility blueprints, Grain Field, Crown Guard, villagers, and Ashen Raiders remain the only playable content.

### WHAT WAS COMPLETED

- Reworked Palisade Wall placement into a click-drag line tool. The drag chooses the dominant horizontal or vertical axis, snaps the first point and each segment to a three-world-unit span, previews every segment, and places the whole run as one construction job when released.
- Wall lines respect the existing placement rules: map bounds, resources, decorations, units, buildings, open builder access, pathfinding, and affordability. A run costs per segment and is capped at 24 segments to keep the first-age tool readable.
- Added runtime wall geometry to collision, pathfinding, interaction distance, combat approach bounds, construction footprints, health/selection outlines, and rendering. Vertical runs rotate the authored segment asset so the line remains visually coherent.
- Replaced the old lumber-mill-like Barracks image with a generated Crownforge Crown Barracks training hall. Replaced the repeated wall plate with a clean generated palisade segment intended for snap repetition.
- Made completed Grain Fields ground-walkable. Fields now render in a terrain layer beneath units and no longer occlude villagers or make them appear to walk behind a flat crop patch. Fields still block placement and remain reserved during construction.
- Expanded building selection information. Selected structures now state health, function, and capability: production type, resource drop-off, housing, field food production, wall defense, or the enemy-core victory role. Tall building artwork is selectable across its visible silhouette, not only at the ground anchor.
- Added and integrated original directional walk artwork for the villager, Crown Guard, and Ashen Raider. The villager loop is explicitly empty-handed; the soldier and Raider use four directional frames with subtle stride changes. Replaced the Raider attack loop with a more consistent four-direction sheet so attack poses retain the same visual scale and keep the axe inside the frame.
- Corrected combat approach presentation. Attack orders now force a walk state while the target is out of range or line of sight; attack rings, phase cues, and attack animation only begin after a valid combat approach. Facing continues to update toward the target, so the Guard does not swing at empty air across the map.
- Mirrored the changed source files and generated assets into `public/crownforge`.

### ASSETS CREATED

- `assets/crownforge-barracks-v2.png` — generated transparent 1536 x 1024 Crown Barracks training hall.
- `assets/crownforge-palisade-segment-v2.png` — generated transparent 1536 x 1024 repeatable palisade segment.
- `assets/crownforge-villager-walk-loop-v2.png` — generated transparent 1224 x 1285 empty-handed 4 x 4 directional villager walk loop.
- `assets/crownforge-soldier-walk-loop-v2.png` — generated transparent 1254 x 1254 four-direction Crown Guard walk loop.
- `assets/crownforge-raider-walk-loop-v2.png` — generated transparent 1254 x 1254 four-direction Ashen Raider walk loop.
- `assets/crownforge-raider-attack-loop-v4.png` — generated transparent 1254 x 1254 directional Raider axe attack loop.

### SYSTEMS CREATED / UPDATED

- `src/simulation.js` — dynamic wall-line footprints and placement, wall cost/assignment, wall collision/pathfinding bounds, walkable field collision state, attack approach reset, and entity selection helper.
- `src/input.js` — wall drag lifecycle, snapped preview updates, release-to-place behavior, and full-silhouette building selection handoff.
- `src/renderer.js` — field depth layer, wall segment rendering/rotation/preview, aspect-correct first-age asset drawing, combat approach cue suppression, and visual building hit testing.
- `src/animation.js` — empty-handed villager walk loop and approach-aware attack state resolution.
- `src/config.js` — wall span, walkable field flag, new Barracks/wall/character asset definitions, and cache identity.
- `src/main.js` — explicit building capabilities and wall drag guidance in the blueprint menu.

### VERIFIED

- Reloaded the local game at 1280 x 720. The updated Crown Hall selection works from the upper artwork as well as the ground anchor and reports `900 / 900 HP`, resource drop-off, and Villager training capability.
- Placed a Palisade Wall through the local UI. The generated segment rendered grounded and complete, resources decreased by the segment cost, and the selected villager was assigned to the foundation.
- Direct simulation checks produced valid five-segment horizontal and vertical previews, confirmed completed fields are walkable, and confirmed an out-of-range soldier attack remains `walk` / `approach` with no damage. A longer combat simulation applied damage only after the soldier reached combat range.
- Local browser console logs remained empty after reload and interaction. `node --check` passed for all source files and `git diff --check` passed.
- `tools/visual-integrity-audit.mjs` passed with no missing files or placeholder references. `tools/remediation-regression.mjs` passed all existing economy, construction, combat, victory, and defeat checks.
- Source/public changed-file and generated-asset mirrors were compared byte-for-byte.

### KNOWN ISSUES

- A wall run is intentionally one building record for this small slice, so all segments share construction progress, health, and selection. Segment-by-segment damage and gates should wait for a real defensive gameplay need.
- The new walk and attack sheets are dimensionally correct and visually inspected, but the repository audit still reports conservative edge-contact measurements in several generated and legacy atlases. The renderer keeps the existing one-pixel source-cell inset; a future dedicated atlas cleanup can add more transparent padding without changing gameplay.
- Utility buildings still use the shared construction treatment rather than four bespoke generated foundation images each. The current progress/health feedback is functional and coherent, but construction staging remains the next art-quality opportunity.

### WHAT SHOULD BE POLISHED NEXT

1. Play a complete first-age sandbox match with a multi-segment wall, field farmer, resource gathering, Barracks production, and the first raid in one session.
2. Tune wall interaction spacing and line cost only if normal play exposes a concrete placement or pathfinding problem.
3. If animation review still finds visible frame-edge contact, make a focused transparent-padding pass on the specific atlas rather than broadening the animation catalog.

### WHAT SHOULD NOT BE BUILT YET

- No additional wall types, gates, towers, fortification upgrades, formations, technologies, ages, civilizations, campaigns, advanced military classes, or expanded AI were added in this pass.

## INTERACTION / FIELD / WALL POLISH PASS — 2026-08-19

### WHAT EXISTS

- The first-age sandbox keeps its deliberately small content set, but wall placement, field scale/layering, unit movement presentation, and selection feedback now meet a clearer RTS interaction standard.

### WHAT WAS COMPLETED

- Expanded the Palisade Wall drag tool from horizontal/vertical placement to eight-way directional snapping. East, west, north, south, and all four diagonal directions use the same authored segment family, with direction-aware preview, collision envelope, pathfinding clearance, construction footprint, and rendering rotation. The snap labels now match the player's screen-up/screen-down drag semantics.
- Kept wall lines capped at 24 segments and retained one construction record per line so the first-age prototype stays readable and inexpensive to simulate. A screen-space upper-right drag was placed successfully as a clean diagonal run in the browser.
- Enlarged Grain Fields to an 8 x 6 world footprint with a 500px authored render size. Opening grain plots were repositioned with breathing room so the larger silhouettes do not stack. Completed fields remain ground-walkable and their crop art is depth-sorted below units, allowing Crown Guards and villagers to walk across them rather than behind them.
- Corrected directional movement presentation. The shared facing calculation now maps movement through the isometric screen axes, and the villager walk sheet's authored row order is explicitly remapped. This keeps Crown Guards and villagers facing the direction of travel, including diagonal screen movement, instead of showing an apparent backward walk.
- Added a visible Unit Pace control to the Field Manual. The player can set global unit movement from 1x normal speed through 10x sandbox speed; the same scale affects route following and walk-loop playback so faster movement does not leave a frozen or visibly lagging gait.
- Centered and enlarged visual hit regions for units and buildings. Clicks now use the visible body/silhouette instead of only the ground anchor, and hover cursor feedback uses the same hit region so selection and cursor behavior agree.
- Bumped the source asset/module cache identity to `interaction1` for the updated field, wall, villager, Crown Guard, and Raider presentation paths.

### SYSTEMS CREATED / UPDATED

- `src/simulation.js` — eight-way wall snap and arbitrary-direction wall bounds, larger field blueprint, opening plot spacing, unit-speed scaling, screen-aware facing calculation, and corrected diagonal sector mapping.
- `src/renderer.js` — ground-layer field depth, larger grain rendering, arbitrary-direction wall drawing/footprints, visual-body hit testing, and screen-consistent combat/movement direction cues.
- `src/animation.js` — explicit directional row mapping for the generated villager walk atlas and faster walk-loop playback support.
- `src/input.js` — cursor hit testing now shares the renderer's visible-body selection regions.
- `src/main.js`, `index.html`, and `src/config.js` — Unit Pace control, updated wall guidance, field size, and cache identity.

### VERIFIED

- Local browser QA at 1280 x 720 showed the enlarged fields, grounded layering, clean diagonal wall placement, visible-body villager selection, visible-body Crown Hall selection, and the 1x–10x Unit Pace slider.
- Local browser console logs were empty after reload and interaction.
- `tools/remediation-regression.mjs` passed all existing economy, construction, combat, victory, and defeat checks.
- Direct simulation checks passed all eight wall snap sectors, confirmed completed fields do not block movement, and confirmed the enlarged field footprint is active.
- `node --check` passed for every source file and `git diff --check` passed.

### KNOWN ISSUES

- A wall line is still one building record with shared health and construction progress. Segment-level damage, gates, and wall connectors remain intentionally deferred.
- Grain Fields currently use one generated field family. More crop variants should wait until normal play demonstrates visible repetition rather than adding another asset family prematurely.
- Movement speed is intentionally a sandbox-wide control, not a per-unit upgrade or technology system.

### WHAT SHOULD BE POLISHED NEXT

1. Verify the pushed deployment at normal zoom and after panning across the larger fields and diagonal wall runs.
2. If a specific atlas still shows edge contact or a directional frame mismatch, repair that atlas in isolation rather than expanding the animation catalog.
3. Review field farmer feedback and wall construction staging in one complete first-age sandbox match.

### WHAT SHOULD NOT BE BUILT YET

- Do not add new civilizations, ages, technologies, campaigns, advanced military classes, water systems, wall types, gates, towers, or large new resource/building families before this interaction pass remains stable in the deployed slice.

## UNIT / BUILDING / RESOURCE ART QUALITY PASS — 2026-08-19

### WHAT EXISTS

- The first-age sandbox remains content-constrained, but the unit-art and resource presentation now use a reusable production playbook. Crown Hall and Crown Barracks are visually substantial settlement anchors while human unit scale remains unchanged.
- Wood and stone nodes now carry explicit small, medium, or large tiers. Tier data controls visual scale and collision/interaction footprint; the existing four-stage grove atlas still supplies readable depletion stages.

### WHAT WAS COMPLETED

- Added `CROWNFORGE_ART_PRODUCTION_PLAYBOOK.md` as the repeatable standard for generating, registering, aligning, testing, mirroring, and deploying future Crownforge units, buildings, resources, and animation sheets. It documents the four-row direction contract, passing-frame requirement, fixed feet/shadow baseline, transparency gate, resource-tier contract, and common failure repairs.
- Replaced the Crown Guard walk loop with an authored four-direction, four-phase sheet whose left/right rows include a readable passing-leg phase. Registered the new dimensions and cache marker.
- Replaced the villager walk loop with a sheet authored directly in Crownforge's shared front/right/back/left row order. Removed the old back/right/front/left remap that made villagers appear to walk backward.
- Enlarged the Crown Hall and Crown Barracks presentation with new original transparent cutouts. Buildings are now visually much more impressive without enlarging villagers; their collision clearances were raised to preserve believable approaches around the larger silhouettes.
- Added a generated large stone deposit cutout and wired it to the large stone tier. Small and medium deposits retain the environment family while large deposits have a distinct, readable silhouette.
- Made individual trees and groves meaningfully larger than bushes. Seeded small, medium, and large wood/stone examples with capacities that make the larger nodes take longer to deplete. Berry bushes remain at their compact authored scale.
- Fixed the grove gathering deadlock. Resource collision and worker interaction now derive from the same tier-aware footprint, so villagers stop outside a grove and can actually harvest it.
- Updated the cache identity to `20260819-unitpass1` for this pass.

### ASSETS CREATED

- `assets/crownforge-crown-hall-v2.png`
- `assets/crownforge-barracks-v3.png`
- `assets/crownforge-soldier-walk-loop-v3.png`
- `assets/crownforge-villager-walk-loop-v3.png`
- `assets/crownforge-stone-deposit-large-v1.png`

The existing true-alpha `assets/villager-carry-food-loop-v1.png` remains registered. A generated carry-food replacement was rejected because its edited output baked a checkerboard into an RGB image; the playbook records this as an explicit pending asset rather than shipping it.

### SYSTEMS CREATED / UPDATED

- `src/config.js` — tier definitions, dedicated Crown Hall/Barracks/large-stone asset definitions, enlarged building presentation, and new unit atlas metadata.
- `src/animation.js` — direct villager direction-row contract and stable four-way animation mapping.
- `src/simulation.js` — tier-aware resource footprints, interaction distances, seeded node tiers/capacities, and grove-safe gathering routes.
- `src/renderer.js` — tier-scaled resource art, dedicated large-stone rendering, dynamic occlusion clearance, and cache identity.
- `CROWNFORGE_ART_PRODUCTION_PLAYBOOK.md` — reusable future-art workflow and QA gate.

### VERIFIED

- Generated art was visually inspected before registration. The Crown Hall, Barracks, Crown Guard, villager, and large-stone files are RGBA assets; the rejected carry-food output was not used.
- Direct source checks and browser visual QA remain required before the pass is considered deployed. The next verification must specifically exercise horizontal Crown Guard walking, all villager directions, food carrying, large-grove gathering, large-stone selection, and enlarged-building path clearance.

### KNOWN ISSUES

- The food-carry state still uses the prior approved true-alpha sheet until a replacement passes the transparency gate. Its headless/shrinking symptom must be rechecked in the browser after the new walk/config cache marker is loaded.
- Construction still uses the existing shared stage treatment for the newly enlarged Barracks rather than a new bespoke four-stage Barracks sheet. This is a polish follow-up, not a new gameplay system.
- Large trees/groves and large stone deposits intentionally occupy more pathfinding space. If a specific seeded route becomes awkward, adjust the node location or interaction ring rather than weakening the tier footprint.

### WHAT SHOULD BE POLISHED NEXT

1. Browser-test the new directional sheets and carry-food state at normal and zoomed-in camera scales, including mid-route retasking and deposit.
2. Review the enlarged Crown Hall/Barracks silhouette against nearby trees and buildings for final depth/clearance tuning.
3. If carry-food remains visibly cropped, create a true-alpha replacement and validate each of its 16 cells before registration.

### WHAT SHOULD NOT BE BUILT YET

- Do not add new civilizations, ages, technologies, campaigns, formations, advanced combat classes, metal economy, or a large new asset catalog. Future content should first follow `CROWNFORGE_ART_PRODUCTION_PLAYBOOK.md` and meet the existing vertical-slice quality bar.

## UNIT / BUILDING / RESOURCE DEPLOYMENT POLISH — 2026-08-19

### WHAT WAS COMPLETED

- Added the final opening-camera adjustment so the enlarged Hearth House roofline and Crown Hall read fully below the top HUD at reset instead of presenting a partial silhouette.
- Bumped the browser/module and generated-asset cache identity to `20260819-unitpass2` so the deployed site loads the corrected camera and current art together.
- Rechecked the reusable unit-art workflow: directional rows use the shared front/right/back/left contract, side walks include a passing phase, carry art keeps the full body and feet baseline, and large resource nodes share one tier-aware collision/interaction footprint.

### VERIFIED

- `node --check` passed for every source module.
- `git diff --check` passed.
- `tools/remediation-regression.mjs` passed economy, construction, combat, victory, and defeat coverage.
- `tools/visual-integrity-audit.mjs` passed with no missing files or placeholder references; conservative atlas edge reports remain informational for the existing generated sheets.
- Source/public Crownforge mirrors were compared byte-for-byte after the cache bump.

### KNOWN ISSUES

- The approved true-alpha food-carry sheet remains in use; the attempted replacement was rejected because its edited output baked a checkerboard into the RGB image.
- Construction still shares the existing stage treatment for enlarged buildings. Bespoke Barracks foundation stages remain a later visual pass.
- The small first-age slice intentionally has no new unit roster, ages, metal economy, or advanced AI in this deployment.

### NEXT POLISH

- Continue using `CROWNFORGE_ART_PRODUCTION_PLAYBOOK.md` for every future unit/building/resource asset.
- In the next focused art pass, replace only the specific atlas cells that fail visual inspection; do not broaden the catalog until the current slice remains stable.

## RESET FRAMING FOLLOW-UP — 2026-08-19

- The first deployed camera correction still left the north Hearth House roofline too close to the HUD. The final opening focus is now `{ x: 21, z: 25 }`, which shifts the settlement down without pushing the Crown Hall into the left information rail.
- Rechecked the reset at 1280 x 720: the Hearth House roofline is fully visible, the enlarged Crown Hall remains fully readable, and the live console stays empty.
- Bumped the cache identity to `20260819-unitpass3` for the final deployment artifact.

## LANDMARK SCALE / FIELD WORK / TREE INTEGRITY PASS — 2026-08-19

### WHAT WAS COMPLETED

- Increased the Crown Hall render size from 640 to 900 and Crown Barracks from 540 to 760 while keeping their gameplay footprints separate from their visual silhouettes. Their collision clearances were raised modestly so villagers still route around the larger architecture without changing human-unit scale.
- Replaced the field plot art with a no-worker transparent cutout. Field workers are now live villagers rather than a person baked into the field image.
- Added a dedicated `field_work` four-direction, four-frame villager action loop. The rows use front/right/back/left artwork and the phases read as upright contact, reaching, deep bending, and recovery. Field production now uses this state and its live animation events while retaining the existing one-farmer-per-field rule.
- Cropped the individual tree row into a dedicated tree atlas and routed live tree resources through it. This prevents the mixed environment atlas from sampling berry, stone, or neighboring-row pixels and addresses the half-tree/white-fragment failure mode without changing the approved Crownforge tree family.
- Added `tools/prepare-generated-assets.mjs` for repeatable true-alpha cleanup of generated field and unit rasters. The field-worker sheet was processed before registration; generated variants with visible colored halos or baked checkerboards were rejected and not shipped.
- Extended `CROWNFORGE_ART_PRODUCTION_PLAYBOOK.md` with the field-worker contract, baked-worker failure mode, and dedicated-tree-atlas safeguard so future units/buildings/resources follow the same process.

### ASSETS CREATED

- `assets/crownforge-field-v2.png` — transparent field plot with no static worker.
- `assets/crownforge-villager-field-work-loop-v1.png` — 4x4 directional field-work animation atlas.
- `assets/crownforge-tree-atlas-v1.png` — isolated four-variant tree row derived from the approved environment family.
- `tools/prepare-generated-assets.mjs` — repeatable generated-asset alpha cleanup utility.

### SYSTEMS UPDATED

- `src/config.js` — landmark render sizes, tree atlas registration, field-v2 registration, field-loop dimensions, and cache identity `20260819-fieldpass1`.
- `src/animation.js` — registered `fieldLoop`, added `field_work`, and preserved the shared four-direction mapping.
- `src/simulation.js` — field farmers now advertise `visualState = 'field'` so the live farmer uses the dedicated loop rather than berry gathering art.
- `src/renderer.js` — dedicated tree atlas loading/rendering, unchanged tiered resource logic, and larger landmark presentation.

### VERIFIED

- `node --check` passed for every Crownforge source module and the new asset-preparation utility.
- `git diff --check -- games/crownforge` passed.
- Browser QA at 1280x720 showed the enlarged Crown Hall, clean no-worker field plot, live field farmer, `Tending Grain Field` status, and increasing Food total from field production.
- The field worker stayed grounded with a visible selection ring and was not duplicated by the field art. The isolated tree family loaded without clipped atlas neighbors in the wide-camera inspection.
- The browser console returned no warning or error entries during this pass.

### KNOWN ISSUES

- The generated field-worker sheet is technically clean in the browser after alpha preparation, but its raw preview still contains RGB values in transparent pixels; future raster review should judge the alpha-composited result, not hidden RGB channels.
- The Crown Hall is intentionally a dominant landmark and can approach the top HUD at high zoom; the gameplay footprint remains smaller and routing-safe.
- The field system remains intentionally small: one farmer per completed field, no crop-growth stages, and no broader agriculture economy.
- The individual tree atlas isolates the approved four-tree family; new tree variants should be generated only when they pass the same transparent-background review.

### WHAT SHOULD BE POLISHED NEXT

1. Hand-tune the field-worker frame timing after more close camera inspection, especially the reach-to-bend transition.
2. Review enlarged Barracks placement and construction-stage readability in a live build, then tune its landmark silhouette only if it still reads too small beside villagers.
3. Continue checking every generated raster on the actual meadow background at normal zoom and after panning, with transparent halos treated as a release blocker.

### WHAT SHOULD NOT BE BUILT YET

- Do not add more agriculture buildings, crop types, tree catalogs, civilizations, ages, technologies, campaigns, or advanced military systems until this field/tree/landmark pass remains visually stable in the deployed slice.

## CROWN HALL BACKSIDE PLACEMENT / STAIR ACCESS PASS — 2026-08-19

### WHAT WAS COMPLETED

- Added a focused placement-vision state to the existing renderer. While any building or wall placement preview is active, the completed Crown Hall is redrawn after normal depth sorting as a quiet translucent silhouette with a restrained mint outline. This keeps the far side of the monumental building readable for planning without changing normal gameplay occlusion.
- Kept placement rules unchanged: the Hall's logical footprint, map boundaries, resources, units, and other structures still decide whether a foundation is valid. The vision layer is feedback only, not a collision bypass.
- Added a dedicated south stair corridor to the Crown Hall's building data. A selected player unit can right-click the Hall to route to one of three spaced lanes and stop at the top landing. Loaded workers still use the existing return/deposit behavior before climbing.
- Extended the existing pathfinding and collision contract so only units explicitly using the Hall stair command may enter the stair corridor. The rest of the Hall remains solid, units cannot walk into its interior, and new orders clear stair access immediately.
- Added subtle stair elevation to the unit presentation while a unit traverses the corridor. The unit's selection ring, hit region, health bar, and carried-resource badge follow the raised screen anchor so the character remains readable against the Hall.
- Documented the new placement-vision and stair-access conventions here so future landmarks can reuse the pattern without inventing ad-hoc collision exceptions.

### SYSTEMS UPDATED

- `src/config.js` — Crown Hall stair-access data and presentation rise.
- `src/simulation.js` — stair target lanes, path-cell permission, unit collision allowance, progress tracking, and Hall context command.
- `src/renderer.js` — final placement vision overlay, stair screen anchor, and stair-aware unit hit testing.
- `src/main.js` / `index.html` — placement feedback copy and cache identity `20260819-hallpass2`.

### VERIFIED

- `node --check` passed for the changed Crownforge modules.
- A deterministic simulation check routed one villager and then three villagers to the Hall. All reached the top landing around z=48, retained `stairAccess`, reached approximately 99–100% stair progress, stayed separated by the existing spacing system, and were not blocked by the Hall while on the stair corridor.
- A placement check behind the Hall remained valid when the site was outside the logical footprint, confirming that the new vision layer does not alter construction validation.
- The local browser preview server was started, but the in-app browser connection rejected the local preview URL in this environment. Live visual inspection of the new overlay remains part of the deployment verification pass.

### KNOWN ISSUES / STILL NEEDS WORK

- The current stair presentation is a controlled first-age approximation: units rise subtly along the corridor but do not yet have bespoke step-by-step leg or climbing artwork. The existing directional walk loops remain the visual standard.
- The stair corridor is intentionally south-facing and ends at the top landing. No Hall interior, rear-door access, or multi-level building navigation has been introduced.
- The translucent vision frame uses a clean screen-space silhouette rectangle because the Crown Hall is an unusually large transparent raster; a future landmark-specific outline can replace it if it proves visually too geometric at close zoom.
- A live browser pass at normal zoom, close zoom, and panned backside placement should be completed after the next clean Pages build.

### WHAT SHOULD BE POLISHED NEXT

1. Verify the translucent Hall vision over several building and wall placement positions in the deployed browser, including sites near the Hall's rear wings.
2. Tune stair lane spacing and visual rise only if close-camera inspection shows units clipping the step edge or reading as floating.
3. If the interaction remains valuable, create a landmark-specific stair animation later; do not broaden it into general multi-level pathfinding yet.

### WHAT SHOULD NOT BE BUILT YET

- Do not add Hall interiors, rear entrances, ramps, elevators, multi-floor navigation, new landmark classes, or a generalized 3-D traversal system until this small stair interaction is visually stable.

## CROWN BARRACKS MONUMENTAL SCALE PASS — 2026-08-19

### WHAT WAS COMPLETED

- Enlarged the Crown Barracks from a 760px render size to 5600px while keeping villagers and Crown Guards at their existing scale. The Barracks now reads as a substantial military landmark rather than a small tile.
- Expanded the Barracks gameplay footprint from 5x4 to 11x8 and raised its collision clearance from 1.65 to 2.8. Placement, selection, building-edge interaction, production spawning, and pathfinding therefore respect the larger visible structure instead of allowing units to clip through it.
- Preserved the existing Crown Barracks production behavior, costs, entrance, construction timing, and first-age scope. This is a scale/coherence pass, not a new military system.
- Kept the existing original Crownforge Barracks RGBA artwork as the canonical asset; no lower-quality replacement or placeholder art was introduced.
- Bumped the browser/module cache identity to `20260819-barrackspass1` and synchronized the Crownforge source with its `public/crownforge` route mirror.

### SYSTEMS UPDATED

- `src/config.js` — Barracks landmark render size, logical footprint, and collision clearance.
- `src/renderer.js` — uses the enlarged existing building contract for the visible silhouette, placement preview, and selection hit region.
- `src/simulation.js` — existing footprint-aware placement, approach, spawn, collision, and pathfinding behavior now uses the enlarged Barracks bounds.
- `src/main.js`, `src/animation.js`, `index.html` — cache identity for the new scale contract.
- `tools/remediation-regression.mjs` — added a Barracks landmark-scale and collision-clearance regression.

### VERIFIED

- `node --check` passed for all changed Crownforge modules.
- The focused Crownforge regression passed gathering, construction, Crown Hall stairs, enlarged Barracks bounds, combat, victory, and defeat checks.
- `tools/visual-integrity-audit.mjs` passed with no missing files or placeholder references; its existing conservative atlas-edge reports remain informational.
- Source/public Crownforge files were synchronized for the changed route artifacts.

### KNOWN ISSUES / STILL NEEDS WORK

- The existing four-stage construction family is shared across the current buildings. The enlarged Barracks would benefit from bespoke foundation, partial, and near-complete construction art in a later dedicated asset pass.
- The Barracks has not gained rotation, a new production roster, or a new military mechanic in this pass.
- The live in-app browser connection was unavailable for this isolated local preview, so a close visual check of the enlarged Barracks after the next deployed build remains outstanding.

### WHAT SHOULD BE POLISHED NEXT

1. Inspect a placed and completed Barracks at normal zoom, close zoom, and after panning to confirm its roofline, selection bounds, and entrance remain readable beside the Crown Hall.
2. Hand-tune Barracks construction-stage artwork only if the shared stages look too generic at its new landmark scale.
3. Recheck Crown Guard spawn spacing around the enlarged south entrance during a live production test.

### WHAT SHOULD NOT BE BUILT YET

- Do not add more military buildings, unit classes, ages, technologies, civilizations, or production queues until the enlarged Barracks remains visually and mechanically stable in the complete first-age slice.

## PROPORTION AND CROWN HALL BUILDABLE RING PASS — 2026-08-20

### WHAT WAS COMPLETED

- Audited the live unit render sizes against the current original Barracks and Crown Hall rasters. Villagers remain at their established scale, and the Crown Guard/Ashen Raider reference scale remains unchanged.
- Reduced the Crown Hall render size from `11200` to `5600`, exactly 50%, while reducing its logical footprint from `18x16` to `9x8` and its collision clearance from `3.6` to `1.8`. The landmark remains dominant without letting its invisible gameplay bounds consume the surrounding meadow.
- Scaled the Crown Hall's south stair corridor with the smaller landmark: width `4.6`, top landing offset `5`, outer approach offset `9`, and visual rise `8`. Existing stair access still ends at the top landing and does not open the Hall interior.
- Recalibrated the Crown Barracks from `5600` to `1000` render size. The target dummies baked into the approved Barracks artwork now resolve near the live Ashen Raider/Crown Guard scale instead of appearing several times larger than a person.
- Reduced the Barracks gameplay footprint from `11x8` to `6x5` and collision clearance from `2.8` to `1.5` so selection, construction, spawn spacing, and pathfinding follow the new visible proportion.
- Moved one berry node out of the Hall's first east-side building ring while keeping it close to the settlement as a usable food source. The starting meadow now has tested buildable openings north, east, south, and west of the Hall.
- No new artwork was generated because the issue was proportion and gameplay bounds; the existing original transparent unit and building assets remain the canonical Crownforge family.
- Bumped the cache identity to `20260819-proportionspass1` and synchronized the Crownforge source with the `public/crownforge` route mirror.

### SYSTEMS UPDATED

- `src/config.js` — Crown Hall/Barracks visual sizes, gameplay footprints, clearances, and scaled stair data.
- `src/simulation.js` — east-side starter resource spacing and the existing building-bound/pathfinding contract now use the corrected landmark proportions.
- `src/renderer.js` — existing render, hit-test, placement-preview, and footprint visuals consume the corrected data without a second scale path.
- `src/main.js`, `src/animation.js`, `index.html` — cache identity for the proportion pass.
- `tools/remediation-regression.mjs` — added live Marauder-reference Barracks checks, exact 50% Crown Hall checks, scaled stair checks, and four-sided buildability checks.

### VERIFIED

- `node --check` passed for all changed Crownforge modules.
- The deterministic Crownforge regression passed gathering, construction, combat, victory, defeat, scaled Hall stairs, person-scaled Barracks bounds, and four-sided Hall building placement.
- `tools/visual-integrity-audit.mjs` passed with no missing files or placeholder references. Existing conservative atlas-edge reports remain informational and predate this proportion pass.
- `git diff --check -- games/crownforge` passed.
- The in-app Browser could not navigate the isolated `file:///private/tmp/crownforge-audit/...` page because of its URL security policy, so a live screenshot pass of the final proportion values remains outstanding for the next allowed preview/deployment surface.

### KNOWN ISSUES / STILL NEEDS WORK

- The Barracks construction stages still use the shared first-age construction family; bespoke Barracks stages can be generated later if the smaller military landmark needs more visual identity.
- The current proportional calibration is based on the approved transparent raster dimensions and unit render contract. It should receive one normal-zoom and close-zoom visual confirmation once the local preview is available through an allowed browser URL.
- The Hall's buildable ring is guaranteed by tested open meadow sites; resources and units can still make any individual placement invalid, as intended.

### WHAT SHOULD BE POLISHED NEXT

1. Inspect the corrected Hall/Barracks relationship in a live normal-zoom and close-zoom match.
2. Place a Barracks, complete it, and queue a Crown Guard to confirm the smaller footprint leaves a clean south entrance and spawn ring.
3. Place houses and utility buildings on all four Hall sides, then recheck camera framing and unit occlusion.

### WHAT SHOULD NOT BE BUILT YET

- Do not add more landmark classes, building tiers, civilizations, ages, technologies, or new military units until these proportions and the four-sided buildable Hall ring remain stable in the playable slice.

## CURSOR ZOOM / EXPANDED WORLD / STARTER CROWN HALL PASS — 2026-08-20

### WHAT WAS COMPLETED

- Reworked zoom to solve the camera offset directly from the world point under the cursor. Zoom-in and zoom-out now preserve that point instead of applying a second correction that could drift toward the lower-right on a large board. Wheel input is also delta-aware so a trackpad or mouse wheel feels consistent without adding a second camera path.
- Expanded the playable meadow from `180x146` to `560x460`, which is approximately ten times the previous map area. The new board is deliberately open rather than densely stamped.
- Lowered the minimum zoom to `0.035` so the complete expanded diamond can be framed when desired, while keeping the normal opening camera focused on the Crown Hall and starting settlement.
- Added sparse regional resource clearings across the expanded board: larger tree and grove groups, small/medium/large stone deposits, berry bushes, and grain plots. The original starting cluster remains readable and the new regions provide destinations after panning.
- Relocated the Ashen Camp and its opening Raider to the far opposite side of the expanded map. The easy AI profile is unchanged; the player now has meaningful time to gather and build before the enemy becomes relevant.
- Recalibrated the Crown Hall visual width to exactly four times the unchanged Crown Barracks reference (`4000` vs `1000`) without changing villager, Crown Guard, or Barracks scale.
- Generated and registered `assets/crownforge-crown-hall-starter-v1.png`: an original transparent timber-and-plaster first-age hall with blue-and-gold Crownwarden details, a modest stone foundation, broad porch, and readable stairs. It replaces the previous stone palace silhouette while preserving the existing Hall identity, footprint, storage, production, placement, and stair systems.
- Bumped the Crownforge cache identity to `20260820-worldpass1` and synchronized the source route with `public/crownforge`.

### ASSETS CREATED

- `assets/crownforge-crown-hall-starter-v1.png` — 1536x1024 RGBA starter Crown Hall cutout with no opaque edge pixels.

### SYSTEMS UPDATED

- `src/config.js` — expanded map dimensions, minimum zoom, four-to-one Hall/Barracks visual relationship, starter Hall asset registration.
- `src/renderer.js` — direct cursor-anchor zoom solver and shared camera clamp helper.
- `src/input.js` — delta-aware wheel zoom factors using the active cursor point.
- `src/simulation.js` — sparse expanded-map resource regions and opposite-side enemy placement.
- `tools/remediation-regression.mjs` — expanded-world counts, opposite-side distance, minimum-zoom, and cursor-anchor zoom assertions.
- `CROWNFORGE_ART_PRODUCTION_PLAYBOOK.md` remains the asset contract for the generated Hall cutout and its transparent-background QA.

### VERIFIED

- `node --check` passed for all Crownforge source and tool modules.
- Source and public deterministic Crownforge regressions passed gathering, construction, stairs, combat, victory/defeat, expanded-world resources, opposite-side enemy placement, and cursor-centered zoom in both directions.
- Source/public visual-integrity audits passed with no missing files or placeholder references. Existing conservative atlas boundary reports remain informational and predate this pass.
- The new Hall asset was inspected as RGBA, has a transparent background, and has zero opaque pixels touching the image edge.
- `git diff --check -- games/crownforge public/crownforge` passed.

### KNOWN ISSUES / STILL NEEDS WORK

- The in-app browser rejected the isolated local preview URL under its URL security policy, so a live screenshot pass of the new Hall, expanded diamond, and wheel behavior remains outstanding until an allowed preview or deployed surface is available.
- The expanded board intentionally contains broad quiet meadow between resource clearings; it is a larger strategic canvas, not a filled forest.
- The starter Hall uses one approved completed cutout with the existing construction treatment. Bespoke wooden construction-stage artwork can wait for a focused building-art pass.

### WHAT SHOULD BE POLISHED NEXT

1. Inspect the new wood Hall at normal zoom, close zoom, and after panning to the far camp once the page is available through an allowed browser URL.
2. Tune the sparse regional resource clearings only if a real pan-and-gather playtest shows a region is too empty or visually repetitive.
3. Compare the Hall's porch, stair landing, selection silhouette, and buildable ring against the unchanged Barracks in a live match.

### WHAT SHOULD NOT BE BUILT YET

- Do not add more ages, civilizations, technologies, campaigns, advanced AI, or additional landmark classes during this pass. Keep the larger first-age board and the new starter Hall visually stable before expanding the catalog.

## AUTONOMOUS QUALITY AUDIT / RENDERER READABILITY PASS — 2026-08-20

### CURRENT GAME STATE

- Crownforge remains a browser-first Canvas RTS vertical slice with deterministic simulation, grid pathfinding, original first-age raster assets, and a mirrored source/public route.
- The playable slice currently includes the Crown Hall, Barracks, Hearth House, storage and resource systems, Villagers, Crown Guards, Marauders, construction, combat, AI camp, expanded meadow, Crown Hall stair access, cursor-centered zoom, building placement, and the existing minimal command UI.
- This pass intentionally stayed inside the existing content boundary. No civilizations, ages, technology tree, campaigns, advanced AI, new unit roster, or new asset family was added.

### WHAT WAS COMPLETED

- Replaced the renderer's width-as-height landmark feedback assumption with one aspect-aware `buildingVisualHeight()` contract. Crown Hall, Barracks, Ashen Camp, and all registered first-age building assets now place health bars, selection feedback, and placement vision relative to their actual transparent raster proportions.
- Repaired active-unit readability under occlusion. Selected, moving, gathering, constructing, hostile, and damaged units now receive a controlled readability redraw when a building or resource would otherwise hide their body, while idle friendly units retain natural depth ordering.
- Aligned path overlays to the raised unit screen anchor so a unit standing on the Crown Hall stair landing does not show its command line starting below its feet.
- Bumped the Crownforge module cache identity from `20260820-worldpass1` to `20260820-auditpass1` so the renderer, simulation, animation, input, and HTML entry point resolve as one audited build.
- Added deterministic regression coverage for aspect-correct Crown Hall and Barracks feedback geometry and removed one redundant zoom assertion.

### ASSETS CREATED / INSPECTED

- No new artwork was required for this cycle. The existing Crown Hall starter, Barracks, tree/grove depletion, villager field-work, resource, unit, and UI asset families were inspected at the bitmap level and remain the approved visual source for this slice.
- The Crown Hall starter and Barracks are transparent RGBA cutouts; the raw asset previews showed no opaque square background. The grove depletion and field-work sheets retain coherent silhouettes and transparent edges.

### VALIDATION COMPLETED

- Source `node --check` passed for every Crownforge source and tool module.
- Source `tools/remediation-regression.mjs` passed all deterministic checks, including gathering at different frame rates, cargo-preserving retask, construction, Crown Hall stair routing and collision, Barracks scale and clearance, four-sided Hall placement, expanded-world resources, opposite-side camp, cursor-centered zoom, aspect-correct landmark feedback, combat, victory, and defeat.
- Existing source/public visual-integrity audits passed with `missingFiles: []` and `placeholderReferences: []`. Conservative atlas-edge reports remain informational and are not missing-asset failures.
- `git diff --check` passed for Crownforge changes.
- The source/public mirror was synchronized after this pass; the public route receives the same audited source, tools, log, and assets.

### KNOWN ISSUES / RISK-RANKED FOLLOW-UP

1. A player-visible live browser pass is still required for final confirmation of Hall/Barracks health-bar placement, backside placement vision, occluded active units, and stair path overlays. The in-app Browser rejected the isolated local URL under its security policy, so no live screenshot or console claim is made for this cycle.
2. The visual-integrity audit still reports conservative atlas boundary and bottom-contact warnings for some generated sheets. These are pre-existing informational reports; no missing or placeholder references were found. They should be reviewed during the next allowed live visual pass before changing approved art.
3. Barracks construction still uses the shared first-age construction family. Bespoke military landmark construction stages remain a polish task, not a blocker for the current slice.

### WHAT SHOULD BE POLISHED NEXT

- Open an allowed preview or deployed route and inspect the corrected landmark feedback at normal zoom, close zoom, and after panning across the expanded map.
- Repeat a short player match: select a moving villager behind a building, select a damaged Marauder behind a resource, place a Hall-side building, and route a Crown Guard onto and away from the stair landing.
- If live inspection confirms a remaining issue, make a target-specific asset or renderer correction and add the corresponding deterministic check before changing unrelated systems.

### WHAT SHOULD NOT BE BUILT YET

- Do not expand the first-age content catalog, add additional civilizations, ages, technology trees, campaigns, advanced AI, naval systems, formations, or new combat classes until live visual QA confirms the current landmarks, units, occlusion, and camera behavior are consistently strong.

## MILITARY RESPONSE ANIMATION PASS — 2026-08-20

### CURRENT GAME STATE

Crownforge remains the same small first-age browser RTS slice. This pass stayed inside the existing Crown Guard / Ashen Raider combat family. No new unit, faction, building, resource, AI strategy, or gameplay system was added.

### CHANGES COMPLETED

- Added directional four-frame Crown Guard hit/recoil artwork and connected it to the existing `hit` action state.
- Added directional four-frame Ashen Raider hit/recoil artwork and connected it to the existing `hit` action state.
- Added directional four-frame Crown Guard death artwork: stagger, kneel, fall, and grounded final pose.
- Added directional four-frame Ashen Raider death artwork with the same readable defeat progression.
- Preserved the existing attack timing, damage rules, death cleanup window, target acquisition, and victory/defeat behavior.
- Kept the existing directional walk loops and attack anticipation/contact/recovery loops; this was a response-depth pass, not a combat redesign.
- Added `tools/prepare-hit-atlases.mjs` so generated checkerboard/matte source art is cleaned into transparent RGBA before it can enter runtime.
- Fixed the cleanup tool’s partial-cell boundary math for 1254-pixel sheets. The accepted outputs now report zero opaque edge pixels.
- Updated the animation contract, deterministic regression, asset manifest, animation coverage, and remediation backlog.

### ASSETS CREATED / INSPECTED

- `assets/crownforge-soldier-hit-loop-v1.png`
- `assets/crownforge-soldier-death-loop-v1.png`
- `assets/crownforge-raider-hit-loop-v1.png`
- `assets/crownforge-raider-death-loop-v1.png`

The first Guard hit generation was rejected because it repeated a walk-like pose and retained a checkerboard matte. The final four sheets were regenerated or selected for clearer pose separation, prepared through the cleanup script, composited on a meadow-colored QA matte, and visually inspected for transparency, feet contact, directional readability, and weapon continuity. The raw generated matte is not referenced by the game.

### SYSTEMS CREATED / UPDATED

- `src/config.js` — registered `soldierHit`, `soldierDeath`, `raiderHit`, and `raiderDeath` atlases.
- `src/animation.js` — military hit/death states now use directional non-looping action phases without idle fallback.
- `tools/remediation-regression.mjs` — asserts four-frame, no-fallback hit/death resolution across all directions for both units.
- `tools/prepare-hit-atlases.mjs` — per-cell matte cleanup and RGBA edge QA for generated response atlases.
- `CROWNFORGE_ANIMATION_COVERAGE.md`, `CROWNFORGE_ASSET_MANIFEST.md`, and `CROWNFORGE_REMEDIATION_BACKLOG.md` — current response-family contract and remaining boundary.

### TESTS PERFORMED

- Source syntax checks passed for all changed source and tool modules.
- Direct animation response probe passed for Soldier/Raider hit and death states in all four directions.
- Source visual-integrity audit passed with `missingFiles: []` and `placeholderReferences: []`.
- Source deterministic regression passed gathering convergence, cargo-preserving retask, construction, stair routing/collision, placement, expanded map, cursor-centered zoom, aspect-correct feedback, combat, death timing, victory, and defeat.
- The source/public mirror was synchronized after this log and documentation update. The public route then passed the same syntax, regression, integrity, parity, and diff checks.

### KNOWN ISSUES / REMAINING WORK

1. The in-app Browser still blocks the isolated `/private/tmp/crownforge-audit` local URL under its security policy. Therefore this pass has no new live screenshot or browser-console claim; the next allowed preview/deployed route must confirm hit/death playback at normal and close zoom.
2. Conservative atlas-edge reports remain informational for older approved sheets. No missing or placeholder runtime references were found.
3. Optional Villager hit/death depth remains intentionally single-pose because worker combat is not a central command in this slice.
4. Rare tall-object occlusion tuning and direct heap/GPU telemetry remain documented backlog items.

### WHAT SHOULD BE POLISHED NEXT

Use an allowed browser preview to inspect a short 1v1 and multi-unit battle at normal and close zoom. Verify hit recoil preserves direction, death holds the grounded final pose before cleanup, and no weapon or shadow fragment clips outside its cell. Only make a target-specific follow-up if that live check finds a real defect.

### WHAT SHOULD NOT BE BUILT YET

Do not add more civilizations, ages, technologies, campaigns, naval systems, formations, new combat categories, or a larger asset catalog. Keep the current two-unit combat family and first-age slice stable until the remaining live visual confirmation is complete.

### FILES CHANGED IN THIS PASS

- `src/config.js`
- `src/animation.js`
- `tools/remediation-regression.mjs`
- `tools/prepare-hit-atlases.mjs`
- `assets/crownforge-soldier-hit-loop-v1.png`
- `assets/crownforge-soldier-death-loop-v1.png`
- `assets/crownforge-raider-hit-loop-v1.png`
- `assets/crownforge-raider-death-loop-v1.png`
- this development log and the three supporting audit/manifests above
- the mirrored copies under `public/crownforge/`

## VILLAGER RESPONSE ANIMATION PASS — 2026-08-20

### CURRENT GAME STATE

Crownforge remains the existing first-age browser RTS slice. This cycle continued the focused animation-quality work and did not add a unit, building, resource, faction, AI strategy, or gameplay system.

### CHANGES COMPLETED

- Added a four-direction, four-frame Villager hit/recoil atlas and connected it to the existing optional worker-combat `hit` state.
- Added a four-direction, four-frame Villager death atlas with a restrained stagger → kneel → fall → grounded sequence and connected it to the existing `death` state.
- Preserved the current worker combat damage, target, range, timing, death cleanup, and outcome logic.
- Added cache identity `20260820-workerpass1` to the active module imports and worker response asset URLs.
- Extended deterministic animation checks to assert Villager hit/death atlas resolution and no fallback in every authored direction.

### ASSETS CREATED / INSPECTED

- `assets/villager-hit-loop-v1.png`
- `assets/villager-death-loop-v1.png`

Both generated sheets were visually inspected at atlas scale and composited over a meadow-colored QA matte. The source checkerboard/studio matte was removed with `tools/prepare-hit-atlases.mjs`; final files are clean 1254 × 1254 RGBA outputs with zero opaque edge pixels. The response preserves the existing Crownforge villager identity, tool, clothing colors, feet baseline, shadow treatment, and four-direction order.

### TESTS PERFORMED

- Source syntax checks passed for all changed modules.
- Direct Villager response probe passed all 4 directions for both hit and death.
- Source visual-integrity audit passed with `missingFiles: []` and `placeholderReferences: []`.
- Full source deterministic regression passed gathering convergence, retask/deposit, construction, pathing, stairs, placement, expanded-world setup, camera zoom, combat timing, death cleanup, victory, and defeat.
- The public mirror was synchronized after this documentation update and passed the same syntax, integrity, parity, diff, and deterministic regression checks.

### PROBLEMS REMAINING

1. The in-app Browser blocks the isolated local URL, so live visual and browser-console confirmation of Villager hit/death playback remains unavailable. No live QA claim is made for this cycle.
2. Rare tall-object occlusion cases and direct heap/GPU telemetry remain in the existing backlog.
3. Older audit prose still describes the pre-response single-pose state; the current appended coverage/manifest/backlog sections supersede those notes without rewriting history.

### WHAT SHOULD BE POLISHED NEXT

Use an allowed browser preview to trigger a Villager-versus-Raider encounter at normal and close zoom. Check that recoil preserves direction, the axe remains inside its frame, the death body remains grounded until cleanup, and selection/health feedback stay aligned. Then revisit only any confirmed occlusion or asset-framing defect.

### WHAT SHOULD NOT BE BUILT YET

Do not add new unit classes, factions, ages, technology, campaigns, advanced AI, ranged combat, or large asset families. Keep the current Villager, Crown Guard, and Ashen Raider animation standard stable before expansion.

### FILES CHANGED IN THIS CYCLE

- `src/config.js` — registered Villager hit/death atlases.
- `src/animation.js` — resolved Villager hit/death through four-frame action phases.
- `src/main.js`, `src/renderer.js`, `src/simulation.js`, `index.html` — bumped the cycle cache identity.
- `tools/remediation-regression.mjs` — added Villager response assertions.
- `assets/villager-hit-loop-v1.png`, `assets/villager-death-loop-v1.png` — new cleaned original response artwork.
- this log plus the animation coverage, asset manifest, and remediation backlog amendments.

## INTERACTION READABILITY FOLLOW-UP — 2026-08-20

### SCOPE

This audit cycle stayed within the existing first-age slice. No new content, assets, unit classes, buildings, resources, factions, AI behavior, or gameplay systems were added.

### CHANGE COMPLETED

- Tightened resource interaction routing in `src/simulation.js`. When a free approach exists on the screen-front half of a resource ring, that approach now wins before path length is compared. A shorter rear approach is used only when the readable half is unreachable or unavailable.
- The rule applies to existing tree, grove, berry, grain, and stone interaction slots without changing resource footprints, gathering rates, capacities, collision, or pathfinding boundaries.
- Added deterministic coverage for representative medium/large tree, grove, and stone approaches so future interaction-slot changes cannot quietly reintroduce tall-canopy occlusion.
- Bumped the runtime marker to `20260820-occlusionpass1` so the changed simulation and mirrored entry modules are loaded as one audited build.

### ASSETS CREATED

- None. Existing original artwork remains the canonical Crownforge asset family. The correction is a shared interaction-selection rule, not an excuse to add another resource variant.

### VALIDATION

- Source syntax checks passed for `src/simulation.js` and `tools/remediation-regression.mjs`.
- Full deterministic source regression passed, including the new representative tall-resource readability check, gathering convergence, retask/deposit, placement, construction, stair routing, collision, expanded-map setup, camera zoom, aspect-aware landmark feedback, combat, victory, and defeat.
- The in-app Browser rejected the isolated `127.0.0.1:4178` preview under its security policy. No live screenshot, frame-by-frame visual claim, or browser-console claim is made for this cycle.

### KNOWN ISSUES

1. A live allowed preview is still required to confirm the new resource-slot preference at normal and close zoom across the expanded map.
2. Conservative atlas boundary reports for older approved sheets remain informational; the integrity audit still reports no missing files, placeholder references, or dimension mismatches.
3. Direct heap/GPU telemetry remains unavailable in the current browser test surface.

### WHAT SHOULD BE POLISHED NEXT

- Re-run the existing wood, grove, food, and stone interaction scenarios in an allowed preview, checking feet contact, tool visibility, selection markers, and building/resource occlusion.
- Only change the resource clearances or approved artwork if that live pass reproduces a specific visual defect.

### WHAT SHOULD NOT BE BUILT YET

- Do not add more resource families, civilizations, ages, technology, campaigns, advanced AI, combat classes, or decorative catalogs. Keep the interaction ring and existing first-age asset family stable until live confirmation is available.

## PROGRESS-NOTE RECONCILIATION — 2026-08-20

### SCOPE

The newly supplied continuing-audit brief is byte-for-byte identical to the previous cycle brief. No new gameplay or art scope was authorized. This cycle corrected stale current-status notes so future development passes do not repeat already completed animation work.

### DOCUMENTATION CORRECTIONS

- Updated `CROWNFORGE_REMEDIATION_BACKLOG.md` so Crown Guard and Ashen Raider attack, hit, and death depth are recorded as locally fixed; only military walk depth remains in that animation queue.
- Updated the backlog’s current work queue and visual-integrity row to remove the obsolete “hit falls back to idle” status.
- Updated `CROWNFORGE_ANIMATION_COVERAGE.md` so its current coverage tables report the integrated four-frame Villager response and military hit/death clips accurately. Historical audit sections remain preserved as history.
- Kept the remaining live-preview limitation explicit: the isolated local browser URL is still blocked, so no unsupported player-visible claim was added.

### VALIDATION

- No source behavior changed in this documentation-only cycle.
- The prior source/public deterministic regression, asset-integrity, syntax, parity, and Crownforge-scoped whitespace checks remain the validation baseline for the current code state.

### WHAT REMAINS

1. Obtain an allowed preview/deployed route for live visual confirmation of the current response clips, resource interaction positions, landmark occlusion, and close-zoom framing.
2. If live review finds a concrete movement defect, generate only the next matched Crown Guard/Raider walk family and add its regression coverage.
3. Do not add new civilizations, ages, technologies, campaigns, combat classes, or broad asset catalogs before the current first-age slice receives that live confirmation.

## MILITARY WALK COVERAGE LOCK — 2026-08-20

### SCOPE

This focused pass stayed inside the existing Crown Guard and Ashen Raider animation family. No new units, buildings, resources, factions, AI behavior, or gameplay systems were added.

### WHAT CHANGED

- Confirmed the active runtime uses the original four-direction `crownforge-soldier-walk-loop-v3.png` and `crownforge-raider-walk-loop-v2.png` atlases, each with four authored frames per direction.
- Added deterministic regression coverage for both military walk states across all four authored directions. The check asserts the correct walk atlas, four-frame count, valid frame columns, and no fallback to idle.
- Updated the current animation coverage and remediation backlog so the technical walk coverage is not incorrectly reported as single-pose. Historical audit prose remains preserved as history.
- Kept the existing raster assets unchanged. No new artwork was generated because the active walk sheets already satisfy the current technical directional/frame contract and a speculative replacement would risk breaking the established Crownforge family.

### VALIDATION

- The focused animation contract now covers Villager carry/response, Crown Guard/Raider walk, attack, hit, and death atlas resolution.
- Source and public syntax checks passed for all source, developer, and tool modules.
- Source and public `tools/visual-integrity-audit.mjs` passed with `missingFiles: []` and `placeholderReferences: []`; existing conservative atlas boundary reports remain informational.
- Source and public `tools/remediation-regression.mjs` passed the new military-walk assertions plus gathering, retask/deposit, construction, stairs, collision, expanded-world setup, camera zoom, combat, victory, and defeat checks.
- Source/public parity and the Crownforge-scoped `git diff --check` passed after the update.
- The in-app Browser still blocks the isolated local preview under its security policy, so player-visible feet contact, leg motion, scale, and console behavior remain unclaimed until an allowed preview is available.

### KNOWN ISSUES

1. Military walk animation is technically four-frame and directional, but its final visual quality score remains below 8/10 until it is observed in an allowed player-visible preview at normal and close zoom.
2. Rare tall-object occlusion cases and direct heap/GPU telemetry remain in the existing backlog.
3. No new asset should be generated unless the allowed preview identifies a specific feet, leg-motion, frame-boundary, or scale defect.

### WHAT SHOULD BE POLISHED NEXT

- In an allowed preview, move both military units north, south, east, and west at normal and close zoom. Check that all four walk frames contribute readable leg motion, feet stay grounded, facing follows movement, and the unit scale remains stable during transitions into attack, hit, and death.
- Only after that observation, adjust timing or generate a matched walk revision if a concrete defect is reproduced.

### WHAT SHOULD NOT BE BUILT YET

- Do not add more military classes, civilizations, ages, technologies, campaigns, advanced AI, ranged combat, or large asset families. Keep the current first-age unit standard stable until the existing walk and occlusion evidence is complete.

### FILES CHANGED IN THIS CYCLE

- `tools/remediation-regression.mjs` — added four-direction, four-frame, no-fallback walk assertions for Crown Guard and Ashen Raider.
- `CROWNFORGE_REMEDIATION_BACKLOG.md` — reconciled current walk status and queue language.
- `CROWNFORGE_ANIMATION_COVERAGE.md` — reconciled current military walk frame counts, scores, and next action.
- this log — recorded the walk coverage lock and remaining live-preview boundary.

## COMPREHENSIVE AUDIT BASELINE — 2026-08-20

### SCOPE

The supplied continuing-audit brief was applied to the existing Crownforge first-age browser slice. Repository inventory, architecture, current notes, active assets, source/public parity, deterministic gameplay, and the local static route were reviewed. No new content category was added.

### CURRENT INVENTORY

- Engine/rendering: browser-first HTML/CSS with a 2D Canvas renderer and a data-driven JavaScript simulation.
- Core modules: `src/simulation.js`, `src/pathfinding.js`, `src/animation.js`, `src/renderer.js`, `src/input.js`, `src/main.js`, and `src/audio.js`.
- Existing gameplay: Crown Hall, Barracks, Hearth House, Waystore, Palisades, fields, Villagers, Crown Guard, Ashen Raider, Ashen Camp, resource gathering, construction, combat, capped enemy behavior, victory/defeat, and reset.
- Existing QA tools: deterministic simulation regression, visual-integrity audit, movement stress page, animation inspection page, asset preparation scripts, and the source/public mirror.
- Active visual families inspected: military walk atlases, environment atlas, Crown Hall, Barracks, and the existing original asset registry.

### CHANGES COMPLETED

- Added deterministic coverage for a previously unasserted requirement: a right-click destination inside a solid building must resolve to a nearby reachable endpoint rather than preserve the blocked building center.
- The new check verifies that the fallback path exists, ends outside unit/building clearance, and is meaningfully displaced from the blocked destination.
- Corrected the backlog’s current-next-action wording so future cycles do not repeat the already integrated military walk coverage.
- No runtime behavior or raster art was changed because the baseline did not reproduce a new movement, collision, animation, asset, or gameplay defect.

### TESTS PERFORMED

- Source and public syntax checks passed for all source, developer, and tool modules.
- Source and public deterministic regressions passed, including the new blocked-destination fallback check, military walk/attack/hit/death atlas resolution, resource cadence, cargo retask, construction, Crown Hall stairs, collision, expanded map setup, cursor-centered zoom, combat, victory, and defeat.
- Source and public visual-integrity audits passed with `missingFiles: []`, `placeholderReferences: []`, and no animation fallbacks.
- Source/public parity passed; Crownforge-scoped `git diff --check` passed.
- Local static route responded `200 OK` for the entry HTML, military walk atlas, and looped MP3 asset.
- Static asset inspection found no new crop, detached weapon, stacked environment, or inconsistent active-family defect in the reviewed assets.

### PROBLEMS REMAINING

1. The in-app Browser rejects the isolated local preview under its security policy, so player-visible frame-by-frame motion, camera/terrain behavior, and browser-console confirmation remain unclaimed.
2. Rare tall-object occlusion tuning, direct heap/GPU telemetry, and allowed live visual confirmation remain in the backlog.
3. Conservative atlas boundary reports remain informational; integrity has no missing files or placeholder references.

### ASSETS REMAINING

- No gameplay-critical asset is currently missing from the active first-age slice. Do not replace the inspected walk, environment, Crown Hall, or Barracks assets without a concrete player-visible defect.

### RECOMMENDED NEXT ACTION

Use an allowed browser or deployed preview to perform the required four-direction movement, camera/terrain, occlusion, and console review. If that review reproduces a specific defect, make one target-specific correction. If it does not, move the first-age slice toward release evidence rather than adding new systems.

### FILES CHANGED IN THIS CYCLE

- `tools/remediation-regression.mjs` — added blocked-destination fallback coverage.
- `CROWNFORGE_REMEDIATION_BACKLOG.md` — corrected the current queue wording.
- this log — recorded the comprehensive audit baseline and blockers.

## DYNAMIC OBSTACLE RECOVERY FOLLOW-UP — 2026-08-20

### SCOPE

This supplied audit brief is byte-for-byte identical to the preceding comprehensive brief. The pass stayed inside the existing first-age movement/pathfinding boundary and added no units, buildings, resources, factions, AI strategy, or new artwork.

### CHANGE COMPLETED

- Added deterministic coverage for a building placed after a unit already has a movement route. The test inserts a completed Hearth House across the issued route, triggers the existing replan path, and verifies that the unit keeps a route, ends outside static collision, and is not left flagged as blocked.
- Kept the existing runtime recovery implementation unchanged because the focused scenario already behaves correctly. This locks the behavior against future pathfinding or placement regressions without adding another movement system.
- Updated the backlog so the blocked-destination and dynamic-blocker safeguards are recorded as covered rather than repeatedly rediscovered.

### TESTS PERFORMED

- Source deterministic regression passed blocked-destination fallback, dynamic building-blocker recovery, military animation coverage, gathering, construction, stairs, collision, camera zoom, combat, victory, and defeat.
- The public mirror was synchronized and passed the same deterministic regression, syntax, integrity, parity, and scoped whitespace checks.
- The player-visible Browser limitation remains unchanged: the isolated local route is rejected by the available in-app Browser, so no unsupported live screenshot or console claim is made.

### PROBLEMS REMAINING

1. Live confirmation of four-direction movement, camera/terrain alignment, resource occlusion, combat response, and browser-console cleanliness still requires an allowed browser or deployed preview.
2. Rare tall-object occlusion tuning and direct heap/GPU telemetry remain bounded backlog items.
3. No new raster asset is justified without a concrete visual defect from that allowed preview.

### RECOMMENDED NEXT ACTION

Obtain an allowed player-visible preview and run the existing map-wide movement, interaction, combat, zoom, and restart review. If it reproduces a specific defect, fix only that defect; otherwise preserve the small complete first-age slice for release evidence.

### FILES CHANGED IN THIS CYCLE

- `tools/remediation-regression.mjs` — added dynamic building-blocker recovery coverage.
- `CROWNFORGE_REMEDIATION_BACKLOG.md` — marked both route safeguards as covered.
- this log — recorded the follow-up cycle and remaining live-preview blocker.

## IDENTICAL-BRIEF REVALIDATION — 2026-08-20

### SCOPE

The newly supplied audit brief matches the preceding brief byte-for-byte (`SHA-256 1b9e50c80464934a6649395d2817e5d0a3c0c6cd840a169002ab57b485abcc7b`). No new requirement or concrete visual defect was introduced.

### RESULT

- No runtime, gameplay, or raster changes were justified. Existing route-recovery, animation, economy, construction, combat, camera, and UI work remains the current first-age boundary.
- Source and public visual-integrity audits passed with `missingFiles: []`, `placeholderReferences: []`, and no animation fallbacks.
- Source/public parity and Crownforge-scoped `git diff --check` passed.
- The isolated local Browser limitation remains unchanged, so player-visible preview and browser-console claims remain open rather than inferred from static checks.

### NEXT ACTION

Use an allowed player-visible preview for the remaining four-direction military walk, tall-object occlusion, camera, restart, and console review. Do not add new content or generate replacement artwork until that review identifies a specific defect.

## LIVE ROUTE RECONNECTION — 2026-08-21

### WHAT WAS FOUND

- The public custom route `https://justaskjohnny.com/crownforge/` was serving the older `20260818-roadsfree1` build.
- The newer audited Crownforge source and synchronized public mirror were present in the audit worktree with runtime marker `20260820-occlusionpass1`.
- The local `wrangler.toml` project name `johnny-chat` is not the project that owns the custom domain. Cloudflare project `johnny-chat-5` owns `justaskjohnny.com`.

### WHAT WAS COMPLETED

- Revalidated the newer source and public mirror before promotion: deterministic regression, syntax, visual-integrity audit, parity, and scoped whitespace checks passed.
- Deployed the verified `public/` build to Cloudflare Pages project `johnny-chat-5`.
- Reloaded the custom domain and confirmed it now serves `src/main.js?v=20260820-occlusionpass1` and the matching updated stylesheet.

### LIVE VERIFICATION

- Live title is `Crownforge: Dawn of Kingdoms`.
- The updated world art, large-map composition, Crown Hall, settlement buildings, resources, units, Field Manual, Unit Pace panel, music control, and command deck are visible after asset load.
- Browser console verification reported no error, warning, or warn entries.

### SOURCE / DEPLOYMENT RULE

For future Crownforge deployments, deploy the synchronized `public/crownforge` route to Cloudflare project `johnny-chat-5`, which owns the custom domain. Do not infer the owning project from the local `wrangler.toml` name alone.

## CROWN HALL FIRST-AGE MATERIAL PASS — 2026-08-21

### SCOPE

- Reworked only the completed Crown Hall landmark art to better match the current first-age technology boundary: timber, woven walling, rope, thatch, packed earth, and restrained Crownwarden cloth accents.
- Kept the existing gameplay footprint, south stair corridor, construction lifecycle, storage role, Villager production, selection, placement, and collision contracts unchanged.

### CHANGE COMPLETED

- Generated and registered `assets/crownforge-crown-hall-wood-v1.png`, a new original transparent three-quarter Crownforge landmark with a broad timber hall, thatched roof, wooden platforms, watch towers, banners, porch stairs, and grounded terrain contact.
- The new asset is a versioned sibling; the previous `crownforge-crown-hall-starter-v1.png` remains available for historical comparison and rollback rather than being overwritten.
- Preserved the intentional scale relationship: Crown Hall `renderSize: 4000` and Crown Barracks `renderSize: 1000`, so the completed Crown Hall reads exactly four times the Barracks reference while Villagers and military units keep their established scale.
- Updated the runtime cache marker and asset manifest/playbook so source, public mirror, and future asset work all point to the same completed Crown Hall source of truth.

### ASSET CHECK

- Final project asset: `games/crownforge/assets/crownforge-crown-hall-wood-v1.png`.
- Bitmap metadata: `1536 x 1024`, RGBA, transparent corners, no opaque rectangular background, and preserved grounded contact treatment.
- The asset was visually inspected before registration; its material language is predominantly wood and thatch rather than large stone-block masonry.

### VALIDATION

- Source and public syntax checks, deterministic regression, visual-integrity audit, source/public parity, and scoped whitespace checks must pass before promotion.
- Live verification must confirm the new runtime marker, Crown Hall asset request, normal/close zoom readability, four-sided buildability, stair routing, and empty browser console on `https://justaskjohnny.com/crownforge/`.

### WHAT SHOULD BE POLISHED NEXT

- Recheck the new hall’s transparent silhouette against the top HUD at close zoom and confirm the broad timber footprint still leaves readable resource and construction approaches.
- If a later construction-art pass is justified, generate dedicated first-age timber lifecycle stages that match this completed landmark instead of reverting to stone-heavy imagery.

### WHAT SHOULD NOT BE BUILT YET

- Do not add new ages, civilizations, materials, or additional Crown Hall functions in this pass. The approved boundary remains a small first-age sandbox with one coherent landmark family.

### PUSH / DEPLOY STATUS

- The verified Crownforge source and public mirror were committed as `d0b6d8c` on `codex/crownforge-live-sync-20260821` and pushed to GitHub.
- Production promotion was attempted against the correct Cloudflare Pages project, `johnny-chat-5`, but Cloudflare rejected the repository-wide upload before changing production because unrelated `first-ember/index.pck` and `sim/sim-engine-20260525c.wasm` files exceed the 25 MiB Pages file limit.
- The live custom route remains on the preceding deployed build until a route-preserving deployment path is authorized or the shared site payload is independently repaired. Do not claim this visual pass is live from the Git push alone.

## CROWN HALL COMPACT FRAMING PASS — 2026-08-21

### CHANGE COMPLETED

- Reduced the completed Crown Hall `renderSize` from `4000` to `400`, approximately one tenth of its previous visual width. The Villager, Crown Guard, Marauder, Barracks, resource, and UI scales remain unchanged.
- Moved the opening Crown Hall from `(25, 38)` to `(78, 82)` inside the expanded meadow and moved the starting Hearth House, Waystore, Villagers, Crown Guard, and opening wood pair with it so the settlement remains coherent and reachable.
- Recentered the opening camera on the moved settlement at `{ x: 78, z: 82 }`. The Hall is no longer placed on the north-west map tip, and the existing four-sided placement, south stairs, collision, storage, production, and selection systems remain active.
- Updated the deterministic regression, asset manifest, and development log to record the new compact proportion and inward starting placement. No new gameplay system or artwork was added in this pass.

### VALIDATION

- The existing Crownforge regression must confirm the compact Crown Hall ratio, inward map placement, four-sided buildable ring, stair routing, resource loop, construction, combat, victory, defeat, and reset behavior.
- Source/public mirrors must remain byte-parity, syntax-clean, and free of missing active assets or placeholder references before promotion.

### WHAT SHOULD BE POLISHED NEXT

- Inspect the compact Hall at normal zoom and close zoom to confirm its entrance, health bar, selection target, and south stair landing still read clearly beside human units.

### WHAT SHOULD NOT BE BUILT YET

- Do not add another Crown Hall model, new civic functions, additional ages, or new factions to compensate for this scale correction. First confirm the compact landmark reads correctly in the actual live deployment.

## CROWN HALL / BARRACKS SCALE ALIGNMENT — 2026-08-21

### CHANGE COMPLETED

- Set the completed Crown Hall `renderSize` from `400` to `1000`, exactly matching the Crown Barracks visual reference.
- Kept the Crown Hall's corrected inward position `(78,82)`, opening camera framing, settlement spacing, south stair access, gameplay footprint, collision clearance, storage role, Villager production, selection, and placement behavior unchanged.
- Added no new artwork and no new gameplay system; this pass only restores a shared building-scale contract.

### VALIDATION

- Source and public deterministic regressions, visual-integrity audits, syntax checks, source/public parity, and whitespace checks must pass before promotion.
- Production deployment must be verified separately because the shared Cloudflare Pages payload has previously been blocked by unrelated oversized files.

### WHAT SHOULD BE POLISHED NEXT

- Inspect the equal-scale Crown Hall and Barracks together at normal zoom, close zoom, and after panning to confirm their silhouettes, entrances, health bars, selection bounds, and unit approaches remain readable.

### WHAT SHOULD NOT BE BUILT YET

- Do not add another landmark variant, new age, new faction, or new building function to compensate for this scale alignment. Confirm the existing first-age sandbox reads correctly first.
