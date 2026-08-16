# CROWNFORGE: DAWN OF KINGDOMS — ASSET MANIFEST

**Audit date:** 2026-08-16  
**Scope:** Every raster or code-rendered visual currently visible or reachable in the playable slice.  
**Runtime source of truth:** src/config.js, src/animation.js, src/renderer.js, styles.css.

Status vocabulary:

- **A — active / compliant:** player-facing and consistent with the current art bible.
- **B — active / readable, polish queued:** correct family and technically complete for the slice, but action or lifecycle depth is below the future production bar.
- **C — legacy / fallback / unused:** retained only for safe loading fallback or historical comparison; not the intended player-facing source.

## Raster asset inventory

| Filename | Purpose / visible role | Dimensions / layout | States, directions, frames | Projection / scale | Lighting / palette | Transparency / shadow | Status / replacement priority | Source / workflow | Notes |
|---|---|---|---|---|---|---|---|---|---|
| assets/crownforge-meadow-v2.png | Active meadow terrain texture, clipped to the projected 30 x 22 map diamond | 1254 x 1254 RGB, full texture | Static; no directional frames | Painted ground texture; renderer stretches it only inside the clipped map polygon | Warm upper-left meadow light; olive grass, straw paths, pale flowers and stones | Opaque by design; no sprite shadow | **A**, none | Original generated terrain raster; active renderer.meadow source | Code clipping prevents a rectangular image card or square edge from showing in gameplay. |
| assets/crownforge-environment-atlas-v2.png | Trees, berry bushes, stone deposits, depleted nodes, and small detail props | 1254 x 1254 RGBA, 4 x 4 atlas; nominal cell 313.5 x 313.5 | Row 0: 4 tree variants. Row 1: 4 berry variants. Row 2: 4 stone variants. Row 3: log, stump, flowers, pebbles. Static cells; no direction | Isometric three-quarter ground-contact art; runtime base sizes tree 142, berry 115, stone 126, details 48–72 | Same warm key as terrain; varied greens, bark browns, berry reds/blues, grey-beige stone | Alpha-processed; painted contact shadows and grass/rubble bases retained | **A**, none | Original generated environment family; neutral matte removed with tools/prepare-world-atlases.mjs | Four-variant family is intentionally small. Depletion maps to stump, reduced bush, or rubble cells. |
| assets/crownforge-building-stages-v2.png | Crown Hall, Hearth House, and Waystore construction/completion art | 1254 x 1254 RGBA, 4 x 4 atlas; nominal cell 313.5 x 313.5 | Columns 0–2: Crown Hall, Hearth House, Waystore. Rows 0–3: foundation, partial, near-complete, complete. Column 3 is not active gameplay art. No directions | Square atlas cells; runtime sizes 294 / 232 / 250 px; footprints 3 x 3 / 2 x 2 / 2 x 2 | Warm timber, straw, cool stone, Crownwarden teal pennants; upper-left key and soft ground contact | Alpha-processed; painted grass/dirt bases and shadows retained | **B**, medium only if dedicated six-row lifecycle art is later justified | Original generated building family; matte removal with tools/prepare-world-atlases.mjs | Early and mid semantic states share the partial raster row and use restrained renderer treatment. |
| assets/crownforge-ashen-camp-v1.png | Ashen Camp enemy settlement core | 1536 x 1024 RGBA; single full-image asset | Static complete state; no direction or frame. Damage/collapse are renderer treatments | Original 3:2 source image is drawn at 330 px wide with preserved natural aspect, 3 x 3 footprint | Charcoal timber, soot brown, worn red cloth, pale stone, orange firelight; enemy accent distinct but grounded | Alpha present; painted ground/lighting retained; live zoom showed no square matte or halo | **A-**, low; medium only if dedicated damage/ruin art becomes visibly necessary | Original generated enemy-structure raster; direct runtime source | Kept as a separate enemy family instead of recoloring Crownwarden buildings. |
| assets/villager-motion-atlas.png | Villager idle and walking | 1254 x 1254 RGBA, 4 x 4 atlas | Row 0 idle: 1 authored pose x 4 directions. Rows 1–3 walk: 3 authored poses x 4 directions | Render size 88; bottom/feet anchor at 0.98 cell height; no mirroring | Teal dress, cream head covering/sleeves, umber leather and boots; same warm key | Alpha-processed; painted foot shadow in every cell | **B**, medium; improve walking transition/idle variation only before scope expansion | Original generated villager motion sheet; matte removal with tools/prepare-villager-atlases.mjs | Worker scale is intentionally subordinate to the building mass and the combat silhouette. |
| assets/villager-task-atlas.png | Retained legacy Villager task source / safe fallback | 1254 x 1254 RGBA, 4 x 4 atlas | Rows 0–3: wood, food, stone, build; 4 authored directions per row; one pose per state/direction | Render size 88; fixed ground anchor | Warm wood/green/red/grey task props against consistent teal/cream worker | Alpha-processed; painted shadows and resource contact bases retained | **C**, not the intended live task-loop source | Original generated task sheet; matte removal with tools/prepare-villager-atlases.mjs | New action-loop atlases are the live task source; this file remains for safe fallback and historical comparison. |
| assets/villager-gather-wood-loop-v1.png | Villager woodcutting action loop | 1254 x 1254 RGBA, 4 frame columns x 4 authored direction rows | Raise, descend, contact, recovery; 4 directions | Rendered through the same 88 px worker contract; feet baseline normalized | Teal/cream worker, umber axe and stump, same upper-left/front key | Clean alpha; painted compact contact shadow; no matte or fringe | **A**, active | Original generated loop; targeted cleanup pass and RGBA preparation | Used by `gather_wood`; contact event lands on the authored contact frame. |
| assets/villager-gather-food-loop-v1.png | Villager berry-gathering action loop | 1254 x 1254 RGBA, 4 frame columns x 4 authored direction rows | Reach, pick, basket, recovery; 4 directions | Same 88 px worker contract and ground anchor | Teal/cream worker, compact berry bush and basket, same key | Clean alpha; compact resource contact treatment | **A**, active | Original generated loop derived from the approved Crownforge villager identity | Used by `gather_food`; runtime resource bush remains mechanically separate. |
| assets/villager-gather-stone-loop-v1.png | Villager stone-mining action loop | 1254 x 1254 RGBA, 4 frame columns x 4 authored direction rows | Raise, descend, contact, recovery; 4 directions | Same 88 px worker contract and ground anchor | Teal/cream worker, grey stone and pickaxe, same key | Clean alpha; compact rubble/contact treatment | **A**, active | Original generated loop derived from the approved Crownforge villager identity | Used by `gather_stone`; runtime stone deposit remains mechanically separate. |
| assets/villager-construct-loop-v1.png | Villager construction action loop | 1254 x 1254 RGBA, 4 frame columns x 4 authored direction rows | Hammer raise, descend, contact, recovery; 4 directions | Same 88 px worker contract and ground anchor | Teal/cream worker, timber trestle and hammer, same key | Clean alpha; no large ground patch | **A**, active | Original generated loop derived from the approved Crownforge villager identity | Used by `construct`; construction strike timing lands on the contact frame. |
| assets/villager-carry-atlas.png | Villager carrying fallback source | 1254 x 1254 RGBA, 4 x 4 atlas | Rows 0–3: wood, food, stone, supplies; 4 authored directions per row; one pose per state/direction | Render size 88; fixed feet anchor | Cargo-specific wood brown, food red/green, stone grey, mixed supply crate; same key | Alpha-processed; painted shadows retained | **C**, safe fallback; replaced as the intended source by four carry loops | Original generated carry sheet; matte removal with tools/prepare-villager-atlases.mjs | New carry loops provide the active motion depth; the quantity badge remains feedback, not a body replacement. |
| assets/villager-combat-atlas.png | Optional villager attack, hit, death, and idle fallback | 1254 x 1254 RGBA, 4 x 4 atlas | Rows 0 attack, 1 hit, 2 death, 3 idle; 4 authored directions; one pose per state/direction | Render size 108; fixed ground anchor | Same worker palette, tool silhouette, warm key | Alpha-processed; painted shadows retained | **B**, high only if optional villager combat remains a focus; otherwise defer | Original generated villager combat sheet; matte removal with tools/prepare-villager-atlases.mjs | Current economic scope does not require more villager combat depth. |
| assets/crownforge-soldier-combat-atlas-v1.png | Crown Guard player melee base states | 1243 x 1265 RGBA, 4 x 4 atlas; nominal cell 310.75 x 316.25 | Rows 0 idle, 1 walk, 2 attack fallback, 3 death; 4 authored directions; one pose per state/direction | Render size 120; shield/spear silhouette and painted ground shadow; no mirroring | Crownwarden teal scarf, ochre tunic, dark iron, blue/gold shield; same warm key | Alpha present; painted foot shadow and soft ground contact | **B**, active base family; attack phases use dedicated loop below | Original generated combat family; direct processed RGBA runtime asset | Combat silhouette is intentionally larger than the worker at RTS distance. |
| assets/crownforge-raider-combat-atlas-v1.png | Ashen Raider enemy melee base states | 1243 x 1266 RGBA, 4 x 4 atlas; nominal cell 310.75 x 316.5 | Rows 0 idle, 1 walk, 2 attack fallback, 3 death; 4 authored directions; one pose per state/direction | Render size 120; broad fur/axe silhouette and painted ground shadow; no mirroring | Charcoal fur, umber leather, worn red sash, steel axe; same warm key with hostile accents | Alpha present; painted foot shadow and soft ground contact | **B**, active base family; attack phases use dedicated loop below | Original generated combat family; direct processed RGBA runtime asset | Enemy identity remains readable beside buildings and resources; no player-family recolor is used. |
| assets/crownforge-ui-icons-v1.png | Resource, role, building, command, health, population, victory/defeat, cancel, and controls icons | 1254 x 1254 RGBA, 4 x 4 atlas; nominal cell 313.5 x 313.5 | 16 static icons; no direction or animation | Rendered at 31 px in controls/resource cards, 42 px in selection panel, scaled variants for outcome/placement UI | Painted gold, teal, cream, wood, stone, red, and green; consistent warm key and dark separation | Alpha present; small CSS drop shadow only | **A**, none | Original generated icon family; CSS positions document the cell map | No emoji or generic UI symbols are used in the visible interface. |
| assets/crownforge-asset-atlas.png | Legacy 3 x 3 combined fallback for buildings, static characters, and full resources | 1254 x 1254 RGBA, 3 x 3 atlas; 418 x 418 cells | Row 0: Crown Hall, House, Waystore. Row 1: static Villager, Guard, Raider. Row 2: tree, berry, stone. No directional or action states | Legacy square cells; fallback render sizes only | Older but related warm family; not the source of truth for active states | Alpha present; old painted ground patches retained | **C**, low removal priority after an explicit no-fallback loading policy | Earlier original generated combined atlas; loaded only as runtime fallback when specialized sheets are not ready | Not visible in the normal loaded game. Keep temporarily for graceful first-frame fallback; do not build new content against it. |
| assets/crownforge-meadow.png | Legacy terrain image retained for historical comparison only | 1254 x 1254 RGB, full texture | Static | Not referenced by current renderer | Older meadow family; superseded by meadow-v2 | Opaque by design | **C**, low; safe deletion only after repository cleanup approval | Earlier original generated terrain raster | Current code uses crownforge-meadow-v2.png?v=1. |

## Code-rendered visual surfaces

These are visible in gameplay but are intentionally not raster asset files. They must follow the same palette and restraint rules.

| Source | Surface | State / dimensions | Art-direction status | Notes |
|---|---|---|---|---|
| src/renderer.js | Isometric map clip, terrain wash, map edge | Map polygon, runtime viewport-sized | **A** | Keeps the opaque meadow texture from showing a rectangular seam; warm wash is low opacity. |
| src/renderer.js | Selection markers and footprint outlines | Unit ellipse; building projected footprint; placement outline | **A** | Crownwarden teal for player, muted red for enemy, green/red for valid/invalid placement. |
| src/renderer.js | Health bars and construction labels | 5 px bar at normal zoom; label only when needed | **A** | Appears for damaged/selected/active combat units and buildings; no permanent clutter on healthy idle units. |
| src/renderer.js | Resource labels and depletion treatment | Text below node; stump, reduced bush, rubble cells | **A** | Resource totals remain visually tied to the authored node family. |
| src/renderer.js | Work feedback | Tool chips, construction dust, deposit ring, restrained ripple | **A-** | Communicates events without replacing future hand-tuned action frames. |
| src/renderer.js | Combat feedback | Direction-aware phase cue, attack ring, hit flash, impact ring | **A-** | Explicit timing is strong; dedicated recoil art remains queued. |
| src/renderer.js | Damage / destruction treatment | Condition marks, embers, collapse fade, smoke/ruin | **B** | Readable and consistent, but dedicated damaged/ruined raster cells could raise the ceiling later. |
| styles.css | UI panels, resource bars, cursors, typography | Viewport-responsive glass panels; 31/42 px icon slots | **A** | Uses Marcellus, DM Sans, and system fallbacks; no external font raster is required. |
| styles.css | CSS icon atlas placement | 4 x 4 positions at 31, 42, 48, and compact sizes | **A** | Every visible icon resolves to crownforge-ui-icons-v1.png. |

## Active source map

| Gameplay role | Source of truth |
|---|---|
| Meadow | crownforge-meadow-v2.png |
| Trees, berries, stone, depletion, small details | crownforge-environment-atlas-v2.png + ENVIRONMENT_ATLAS in src/config.js |
| Crown Hall / Hearth House / Waystore lifecycle | crownforge-building-stages-v2.png + BUILDING_STAGE_ATLAS |
| Ashen Camp | crownforge-ashen-camp-v1.png + ENEMY_CAMP_ASSET |
| Villager motion | villager-motion-atlas.png + ANIMATION_DEFINITIONS.villager |
| Villager tasks | villager-gather-wood-loop-v1.png, villager-gather-food-loop-v1.png, villager-gather-stone-loop-v1.png, villager-construct-loop-v1.png + ANIMATION_DEFINITIONS.villager |
| Villager cargo | villager-carry-atlas.png + ANIMATION_DEFINITIONS.villager |
| Villager optional combat | villager-combat-atlas.png + ANIMATION_DEFINITIONS.villager |
| Crown Guard | crownforge-soldier-combat-atlas-v1.png + COMBAT_ATLASES.soldier |
| Ashen Raider | crownforge-raider-combat-atlas-v1.png + COMBAT_ATLASES.raider |
| UI icons | crownforge-ui-icons-v1.png + styles.css atlas positions |

## Harmonization audit result

The live map was inspected at the reference 1280 x 720 view, representative zoom-out, and maximum practical close zoom. The audit covered the meadow, path texture, four tree variants, berry and stone families, small details, all four building families, construction preview/lifecycle, villager and combat silhouettes, selection/health/cargo feedback, UI icons, and enemy camp lighting.

No player-visible placeholder, generic colored box, opaque square matte, obvious halo, incorrect directional fallback, floating building, or unrelated art family was found. Four new Villager task-loop rasters were generated, cleaned, integrated, and re-audited in the live map. A first wood-loop draft with colored fringe and a checkerboard cleanup draft were rejected and are not referenced by the game.

## Replacement queue

| Priority | Asset family | Reason | Gate before work |
|---|---|---|---|
| 1 | Villager carry/optional combat loops | Current task/build loops are complete at four frames, but carry and optional worker combat remain one-pose states | Keep four directions, cargo readability, feet anchor, and current 108 px scale |
| 2 | Crown Guard / Ashen Raider combat loops | One-pose attack, walk, and death rows; no dedicated recoil art | Share one attack/recoil timing standard between the two existing units |
| 3 | Building lifecycle/damage | Early and mid share the partial row; damage/ruin are overlays | Create only if a compact six-row/damage family can preserve current footprints and lighting |
| 4 | Legacy fallback cleanup | Combined atlas and old meadow are not source of truth | Confirm specialized images always load before removing fallback references |

## Post-audit remediation asset amendment — 2026-08-16 (current)

The following six files are now active runtime sources. They were generated as original Crownforge artwork, cleaned through `tools/prepare-remediation-atlases.mjs`, verified as `1254 x 1254` 8-bit RGBA PNGs, inspected on a dark matte and in the live browser, and then wired into `src/config.js`.

| Filename | Purpose | Layout | Runtime source | Status |
|---|---|---|---|---|
| `assets/villager-carry-wood-loop-v1.png` | Wood-carry locomotion | 4 columns × 4 direction rows | `VILLAGER_ATLASES.carryWoodLoop` | **A — active / verified** |
| `assets/villager-carry-food-loop-v1.png` | Food-carry locomotion | 4 columns × 4 direction rows | `VILLAGER_ATLASES.carryFoodLoop` | **A — active / verified** |
| `assets/villager-carry-stone-loop-v1.png` | Stone-carry locomotion | 4 columns × 4 direction rows | `VILLAGER_ATLASES.carryStoneLoop` | **A — active / verified** |
| `assets/villager-carry-supplies-loop-v1.png` | Construction-supplies locomotion | 4 columns × 4 direction rows | `VILLAGER_ATLASES.carrySuppliesLoop` | **A — active / verified** |
| `assets/crownforge-soldier-attack-loop-v1.png` | Crown Guard ready/contact/recovery attack | 4 columns × 4 direction rows | `COMBAT_ATLASES.soldierAttack` | **A- — active / attack depth verified** |
| `assets/crownforge-raider-attack-loop-v1.png` | Ashen Raider ready/contact/recovery attack | 4 columns × 4 direction rows | `COMBAT_ATLASES.raiderAttack` | **A- — active / attack depth verified** |

### Preparation and rejection record

`tools/prepare-remediation-atlases.mjs` is the reproducible preparation map for the six generated source paths. The first food carry draft showed colored fringe and was rejected; a checkerboard/matte treatment was also rejected. No rejected path is referenced by `src/config.js`.

### Current source map correction

The active source map is now:

- Villager motion: `villager-motion-atlas.png`.
- Villager task/build: four existing task-loop files plus `villager-construct-loop-v1.png`.
- Villager carry: the four new carry-loop files above.
- Villager optional combat: `villager-combat-atlas.png`.
- Crown Guard base: `crownforge-soldier-combat-atlas-v1.png`; attack phases: `crownforge-soldier-attack-loop-v1.png`.
- Ashen Raider base: `crownforge-raider-combat-atlas-v1.png`; attack phases: `crownforge-raider-attack-loop-v1.png`.

The original one-pose carry and combat sheets remain safe fallbacks only where the state resolver does not use a new phase atlas. They are not the intended source for the new carry or attack states.

Do not create new civilizations, units, buildings, maps, resources, technologies, campaigns, or UI categories as part of this queue.
## Daylight lighting audit — 2026-08-16

### Master light

- Primary direction: upper-left/front of the screen.
- Runtime direction metadata: vector (-0.48, -0.88); shadow vector (+0.48, +0.88).
- Warm key: rgba(255, 226, 168, 0.055) with a smaller highlight component rgba(255, 239, 198, 0.03).
- Ambient fill: rgba(62, 91, 70, 0.042).
- Asset strategy: keep baked transparent-sprite shadows; do not layer a second entity shadow system.
- Terrain strategy: one clipped diagonal daylight grade in src/renderer.js.
- Map edge strategy: green-neutral soft edge shadow, not a black vignette.

### Family-by-family result

| Family | Baked light agreement | Ground/contact result | Material/readability result | Decision |
|---|---|---|---|---|
| crownforge-meadow-v2.png | Warm upper-left meadow and path highlights agree with the master key | Opaque texture is clipped to the map; no sprite shadow required | Terrain remains the lowest-contrast visual field after the daylight grade | Retain |
| crownforge-environment-atlas-v2.png | Tree, berry, stone, log, stump, flower, and pebble shading falls screen-right/back | Roots, grass, rubble, and painted shadows sit on the meadow; depletion remains grounded | Leaves stay below unit contrast; berries and stone remain distinct without glow | Retain |
| crownforge-building-stages-v2.png | Crownwarden buildings and all construction rows share warm left/front highlights and compatible shadow direction | Foundation, scaffold, near-complete, and complete bases remain attached to terrain | Wood, thatch, stone, and scaffold are separated by value and texture | Retain; early/mid depth remains queued |
| crownforge-ashen-camp-v1.png | Outer structure shading agrees with the daylight key; internal firelight is local | Palisade, stone, tents, and ground contact read as one object without a visible matte | Charcoal, red cloth, fire orange, and pale stone separate the enemy without relying on hue alone | Retain |
| villager-motion-atlas.png | Four idle/walk directions share the same upper-left/front key | Painted foot shadows remain attached to the feet anchor | Teal dress, cream cloth, leather, and hair remain readable in shade | Retain |
| villager-task-atlas.png | Wood, food, stone, and build poses keep the same key and shadow direction | Tool/resource contact bases are grounded; no detached work shadows | Tool silhouettes and task props separate from the body by value and edge | Retain; action-loop polish queued |
| villager-carry-atlas.png | Cargo rows use the same worker light | Cargo shadows and feet stay coherent across four directions | Wood, food, stone, and supplies read as distinct payloads | Retain; carry-loop polish queued |
| villager-combat-atlas.png | Optional attack/hit/death rows match worker lighting | Corpse and tool shadows remain ground-connected | Hit/death rows remain readable without a red wash | Retain; optional depth queued |
| crownforge-soldier-combat-atlas-v1.png | Shield, spear, armor, and painted ground shadow agree with the key | Feet and shadow remain anchored in all directions | Teal scarf, ochre tunic, blue/gold shield, and dark metal separate materials | Retain; attack/recoil depth queued |
| crownforge-raider-combat-atlas-v1.png | Fur, leather, axe, and ground shadow agree with the key | Broad hostile silhouette remains grounded in all directions | Charcoal, umber, red sash, and steel distinguish the enemy by value and shape | Retain; attack/recoil depth queued |
| crownforge-ui-icons-v1.png | Icon highlights share warm material treatment; CSS shadow is panel-only | Not a world contact-shadow asset | Resource, role, command, and outcome shapes remain readable under reduced saturation | Retain |

### Runtime lighting surfaces

- src/renderer.js applies the daylight grade only inside the projected map polygon.
- Baked asset shadows remain the only persistent world-object shadows.
- Selection, health, placement, work, and combat overlays remain code-rendered state feedback and are not treated as light sources.
- No sprite grade is used. A source-atop prototype was rejected because the opaque canvas destination produced rectangular blocks around transparent cells; this was removed before final validation.
- The renderer adds no blur, offscreen sprite pass, per-pixel light map, or dynamic shadow map.

### Validation record

- Normal 1280 × 720 view: terrain, resources, units, buildings, enemy camp, UI, and daylight hierarchy remained readable.
- Zoomed-out view: no sprite rectangles, halo, black contact stains, shadow flicker, or depth-sort shadow artifacts remained after the rejected prototype was removed.
- Close practical zoom: villager feet, resource bases, building foundations, camp lighting, and UI feedback remained grounded.
- Villager under-tree / resource approach: readable silhouette, baked foot shadow, and tree contact remained coherent.
- Combat near the Crown Hall and Ashen Camp: local firelight remained an accent; friendly/enemy silhouettes remained distinct.
- Construction preview and foundation: valid/invalid placement feedback remained legible without changing terrain brightness.
- Developer-only animation harness was re-run after the lighting renderer change; all current states/directions still loaded cleanly.
- Movement stress harness was re-run after the lighting renderer change; Retask storm passed with zero footprint, boundary, or stuck-unit violations.
- A complete live defeat match was played under the revised daylight and reset successfully to a fresh slice; the browser warning/error log remained empty.
- Lighting benchmark: grade disabled 0.373 ms average render / 0.900 ms p95 / 1.200 ms max; grade enabled 0.395 ms average / 0.900 ms p95 / 1.200 ms max.
- Browser warning/error log was empty during the final fresh-load checks.

No new raster asset was generated, replaced, or reprocessed during the earlier daylight-only pass. The current original artwork already agreed with the locked daylight direction; the later autonomous audit below added only the four targeted Villager task loops.

## Battlefield landscape audit — 2026-08-16

### Active composition corrections

| Gameplay surface | Final placement / rule | Result |
|---|---|---|
| Opening wood clearing | Trees at `(3.8, 14.2)` and `(5.4, 13.0)` | Visible west of the Crown Hall, reachable, separated from building footprints, and still using the approved tree variants. |
| Eastern stone clearing | Deposits at `(25.2, 10.3)` and `(26.7, 11.6)` | Readable as a resource cluster; the initial Raider no longer overlaps the clearing. |
| Opening Ashen Raider | `(23.5, 8.0)` | Guards the camp route without masking stone or resembling a resource decoration. |
| Meadow/path foundation | Existing `crownforge-meadow-v2.png`, clipped map board | Retained; authored grass, dirt, bare soil, flowers, and pebbles remain one coherent family with no tile seams. |

### Renderer contract

- Existing projected depth sorting remains the source of truth for buildings, resources, details, and units.
- Selected, attacking, or damaged units hidden behind tall trees now receive a post-world ground marker and health bar. This is a controlled visibility cue, not a global canopy fade.
- No new vegetation animation, terrain simulation, path-wear system, or dynamic shadow layer was introduced.
- No raster family was generated or replaced; all active world art remains from the approved manifest entries above.

### Validation

- Normal and zoomed-out browser views showed visible opening wood, a clear stone clearing, stable building/resource contact, and no square backplates or depth seams.
- Live selection verified the wood and stone nodes as distinct resource entities; live gathering verified the wood/food/stone command paths.
- Construction preview rejected the wood clearing and accepted a nearby clear site; the completed Hearth House remained grounded beside the west clearing.
- Animation and movement harnesses passed after the composition/occlusion changes with empty browser warning/error logs.
- Full live match reached defeat and reset cleanly; current benchmark values were 0.267 ms average render with lighting grade disabled and 0.321 ms with it enabled.

## Player-experience audit — 2026-08-16

### Player-facing asset sources

| Surface | Source | Status / contract |
|---|---|---|
| World, unit, building, enemy, and resource artwork | Existing approved Crownforge PNG atlases listed above | Retain; no new raster family was justified in this pass. |
| Panel and outcome icons | `assets/crownforge-ui-icons-v1.png` | Retain; original 4 × 4 icon family remains the shared UI art source. |
| Context cursors | Inline SVG data URIs in `styles.css` | New code-authored feedback marks for default, selection, movement, gathering, attack, interaction, construction, invalid, and UI contexts; palette and stroke weight follow the art bible. |
| Tooltips | `#ui-tooltip` in `index.html`, positioning/skin in `styles.css`, binding in `src/main.js` | New restrained contextual surface for existing `title` explanations; no new information category. |
| Effects audio | `src/audio.js` | New procedural, gesture-unlocked tonal cues; no external audio file or music asset. |

### Runtime contracts audited

- UI controls must retain original icon atlas glyphs and the compact warm blue-green/gold panel treatment.
- Cursors must be semantic, centered or tip-hotspot aligned, readable over the meadow, and visibly distinct for friendly selection, movement, gathering, hostile attack, interaction, valid placement, invalid placement, and UI use.
- Tooltips are concise enough for normal viewport use and must never obscure a unit or placement readout for long periods.
- Audio is event-driven and deduplicated; it must not become a constant loop or continue with stale voices after restart.
- No placeholder, emoji, generic colored box, unrelated sprite, or new mismatched raster is approved in the playable slice.

### Validation record

- Fresh 1280 × 720 load showed the approved world/icon families, semantic cursors, tooltip surface, selection/status hierarchy, and no current browser errors or warnings.
- 1024 × 640 and 980 × 620 viewport checks kept the command deck and controls surface within bounds; the explicit viewport override was reset afterward.
- Selection, reverse drag, empty clear, resource/gather, hostile attack, building approach, placement valid/invalid, B menu entry, Escape cancel, audio settings, tooltip hover, victory, defeat, and replay were exercised through normal controls.
- No raster asset was generated, replaced, or reprocessed. The only new visual sources are code-authored cursor/tooltip feedback; the only new sound source is the procedural effects module.

## Technical hardening and release asset audit — 2026-08-16

### Runtime asset decisions

- The playable renderer loads `assets/crownforge-meadow-v2.png`; `assets/crownforge-meadow.png` is retained as a legacy source artifact for provenance and is not loaded by the game.
- All active world and UI PNG families remain approved Crownforge originals. No placeholder, programmer-art, generic-box, emoji, or mismatched raster was added; the four targeted Villager loops are approved additions recorded below.
- The active families preserve the locked 4-direction unit contract, transparent neutral-matte preparation, shared upper-left/front lighting, painted ground contact, and common isometric scale.

### Footprint measurement

- All PNGs together occupy approximately 29 MiB on disk, including the unused legacy meadow.
- Source-channel pixel accounting estimates approximately 70.5 MiB of decoded active texture data after excluding the legacy meadow (`crownforge-ashen-camp-v1.png`, environment/building/unit/UI atlases, active meadow, and the loaded fallback atlas). This is an estimate of pixel storage rather than a browser heap measurement.
- The browser evaluation surface did not expose reliable runtime memory-growth or GPU texture counters. No unsupported memory claim is made here.

### Release validation

- Browser visual audit at normal and zoomed views showed no square backgrounds, transparency halos, detached shadows, floating buildings, broken construction-stage transitions, or family-level style mismatch.
- Animation inspection loaded all current state/direction combinations; movement stress passed static-footprint and dynamic-blocker cases; complete victory and defeat matches used the same approved art families.
- The only remaining visual quality items are documented action-loop depth and occasional large-object worker occlusion. Neither justifies generating a larger asset library in this pass.

## Autonomous audit and Villager action-loop completion — 2026-08-16

The live audit generated and integrated four small worker action families rather than expanding the content catalog. Each family uses a 4 x 4 frame-column/direction-row layout, preserves the Crownforge villager identity, and was checked at the 108 px runtime size:

- Wood: `villager-gather-wood-loop-v1.png` — axe raise, descend, contact, recovery.
- Food: `villager-gather-food-loop-v1.png` — reach, pick, basket placement, recovery.
- Stone: `villager-gather-stone-loop-v1.png` — pickaxe raise, descend, contact, recovery.
- Construction: `villager-construct-loop-v1.png` — hammer raise, descend, contact, recovery.

The live renderer selects these through `ANIMATION_DEFINITIONS.villager` and the shared `animationFrame()` resolver. A screen-front preference was also added to resource interaction-slot scoring so a valid worker position is more likely to remain visible around tall canopies without changing collision or depth sorting.

The generated family was inspected in the developer viewer for all 16 state/direction combinations and in the playable map for Wood, Food, Stone, and Construction. The first wood draft with colored fringe and a checkerboard/matte cleanup draft were rejected; neither is referenced by the runtime.
