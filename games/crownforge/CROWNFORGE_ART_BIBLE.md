# CROWNFORGE: DAWN OF KINGDOMS — ART BIBLE

**Status:** Locked for the current vertical slice  
**Pass:** Art direction formalization and asset harmonization  
**Date:** 2026-08-16  
**Scope:** Existing map, Crownwardens, Ashen presence, current buildings, resources, UI, and their existing animation states only.

This is the visual contract for Crownforge. Every new asset must fit this contract before it is added. The current slice is intentionally small: quality and consistency outrank asset count.

## 1. Identity

Crownforge is a warm, grounded historical strategy game seen from an elevated three-quarter camera. Its identity comes from the meeting of:

- sunlit meadow greens and worn honey-colored paths;
- hand-painted timber, thatch, stone, leather, iron, and woven cloth;
- readable silhouettes with a few strong props rather than noisy micro-detail;
- Crownwarden teal, parchment cream, and muted gold against Ashen red-brown and charcoal;
- soft contact shadows that make every object sit on the same terrain;
- a calm settlement mood interrupted by clear, restrained combat accents.

The art must feel historical without pretending to reconstruct one exact real-world culture. It must remain original and must not reproduce protected characters, buildings, maps, icons, UI, or visual signatures from other games.

## 2. Non-negotiable rules

1. No programmer art, colored rectangles, generic geometric placeholders, emoji used as world art, temporary character silhouettes, or unlabeled stock icons in the playable slice.
2. No asset may arrive with a visible square background, neutral studio matte, halo, hard crop, or pasted-on ground patch.
3. New characters, props, buildings, resources, and UI icons must be authored for Crownforge or deliberately processed into the Crownforge family before use.
4. Keep the current camera direction contract: four authored camera quadrants, no mechanical mirroring, no runtime sprite rotation.
5. Preserve the ground-contact point. Feet, foundation edges, resource bases, and painted shadows must agree with the simulation position.
6. A small family of excellent variations is preferred to a large catalog of mediocre variations.
7. A new asset must pass the normal gameplay zoom test before it is judged at close zoom. Close zoom is for finding defects, not for demanding detail the camera never exposes.
8. Visual feedback must be subordinate to the authored art. Code-drawn rings, bars, dust, sparks, and markers may clarify state but must not become decorative noise.

## 3. Camera and projection

### Runtime contract

| Rule | Locked value / description |
|---|---|
| Projection | Orthographic, affine, isometric-like three-quarter projection. No perspective scaling by world depth. |
| Camera yaw | 45-degree relationship between world X and world Z axes. |
| Tile basis | tileWidth 52, tileHeight 26; apparent ground diamond ratio is 2:1. |
| Map | 30 x 22 world units. |
| Reference view | 1280 x 720 browser window. |
| Default zoom | 0.84. |
| Zoom range | 0.62 to 1.12. |
| Pan | WASD/arrows and middle-drag, clamped to the map region. |
| Depth order | Ground depth follows x + z, with deterministic kind and ID tie-breakers. |
| Terrain | The meadow texture is clipped to the projected map diamond; it is never drawn as a rectangular world card. |

The projection is intentionally closer to a classic RTS board than to a perspective camera. “Camera angle” in asset briefs means the authored three-quarter view that agrees with the above basis, not a request for a perspective render.

### Direction contract

Every directional unit family uses four authored columns:

| Direction index | World vector | Screen reading | Mirrored? |
|---:|---|---|---|
| 0 | +Z | screen-left / front | No |
| 1 | +X | screen-right / front | No |
| 2 | -X | screen-left / back | No |
| 3 | -Z | screen-right / back | No |

The renderer samples the direction selected by movement or target vector. It does not rotate a sprite, mirror an action, or force attacks to one default direction. Eight directions are deferred until the camera or close-zoom read proves that four authored quadrants are insufficient.

## 4. Scale, anchors, and ground contact

World position is the ground contact point, not the visual center of a sprite. Runtime art is drawn from a shared bottom anchor equivalent to screen.y minus size times 0.98. The last few pixels of the authored cell may contain a painted contact shadow, but simulation collision geometry remains independent of transparent pixels.

### Current visual scale

These are render sizes before camera zoom. They are visual standards, not new gameplay mechanics.

| Family | Current size | Gameplay reference |
|---|---:|---|
| Villager | 88 px | collision radius 0.36; building interaction 0.78 |
| Crown Guard | 120 px | collision radius 0.43; combat range 1.45 |
| Ashen Raider | 120 px | collision radius 0.44; combat range 1.25 |
| Crown Hall | 1000 px wide, natural 3:2 aspect | 9 x 8 footprint plus south stair access |
| Crown Barracks | 1000 px wide, natural 3:2 aspect | 6 x 5 footprint |
| Ashen Camp | 500 px wide, natural 3:2 aspect | 6 x 5 footprint |
| Tree resource | 142 px base | resource approach distance 1.75 |
| Berry resource | 115 px base | resource approach distance 1.55 |
| Stone resource | 126 px base | resource approach distance 1.70 |

The environment renderer scales depleted and full resource art from these bases so a stump, reduced bush, and rubble pile read as the same node becoming exhausted rather than as unrelated props. Small decorations are quieter: logs 72 px, stumps 64 px, flowers 54 px, pebbles 48 px before local scale.

### Required anchors

- Character feet must share one baseline within their atlas family. A raised weapon, basket, tool, or corpse may extend upward or sideways but may not move the feet pivot.
- Painted shadows belong below the body and must be soft, low-contrast, and aligned with the terrain key light.
- Resource bases must touch the meadow. Roots, grass, rubble, or a small dirt contact patch may support the object; a hard rectangular patch may not.
- Building art must sit inside the gameplay footprint. The footprint marker and placement preview are the authority for occupied space; transparent art must not imply a larger collision volume.
- Doors and work faces are visual cues. The simulation uses named south entrances and perimeter approach points; an artist must preserve the readable entrance side.
- Tool size is subordinate to the worker silhouette. The tool must read at normal zoom but never make the villager appear to be carrying a different class of unit.

## 5. Lighting and shadows

Use one consistent warm key from the upper-left/front of the image. Highlights are honey, cream, or warm brass; shadows fall toward screen-right/back and remain softened by green ambient bounce from the meadow. The world uses painted asset lighting rather than per-pixel dynamic lighting.

- Contact shadows are painted into transparent world frames where the source art supports them.
- UI icons may use a small dark drop shadow for separation, but must retain the same warm highlight family.
- Code overlays use restrained opacity: selection teal, enemy red, construction gold, and resource-colored contact cues.
- Fires and embers are small warm accents. They must not recolor the whole Ashen Camp or introduce a second global key light.
- Do not add a second hard shadow direction to a new asset to make it pop.

## 6. Palette

The palette is warm and natural, with faction color used as a readable accent rather than a full-surface wash.

| Role | Color |
|---|---|
| Crownwarden teal | #86c4cf |
| Crownwarden dark teal | #173844 |
| Crownwarden gold | #d7aa54 |
| Food feedback | #d76649 |
| Wood feedback | #b98147 |
| Stone feedback | #9fa8ab |
| Construction green | #81b98d |
| UI ink | #edf1d7 |
| UI muted text | #aab4a6 |
| UI panel base | deep blue-green, translucent |

Palette behavior:

- Greens are varied but not neon. The meadow carries the largest color area and therefore stays lower contrast than units and buildings.
- Crownwarden blue-teal is visible in scarves, pennants, painted trim, and selection feedback. It is not a full blue outline around every object.
- Ashen red is concentrated in cloth, banners, and combat feedback. It is not used for the meadow or neutral resources.
- Food red, wood brown, and stone grey are distinct at normal zoom and still natural in the world.
- Pure white is reserved for small highlights and text. Pure black is reserved for transparent edges or the deepest material creases, never large painted fills in the world.

## 7. Material language

| Material | Crownforge treatment |
|---|---|
| Grass / meadow | layered brush texture, small flowers, sparse pale stones, warm path wear; low contrast at gameplay zoom |
| Dirt / path | honey ochre center, broken edges, embedded stones, irregular width; never a perfect ribbon |
| Timber | warm brown beams with visible grain, dark joinery, pale edge light |
| Thatch | straw gold, layered clumps, darker wet seams, no flat yellow fill |
| Roof wood / shingles | darker brown plane with directional shingle rhythm and warm ridge highlights |
| Stone | cool grey-beige blocks with irregular faces, warm edge light, darker mortar and ground contact |
| Iron | charcoal steel with restrained pale edge highlights; no chrome shine |
| Leather | deep umber, soft edge wear, small brass or bone hardware |
| Cloth | Crownwarden teal / Ashen red-brown, visible fold direction, frayed edge only where silhouette benefits |
| Berries / food | red or muted blue clusters against leaf green; clusters are sparse enough to read as a resource, not a red blob |
| Construction timber | fresh warm wood, braces, scaffold, packed dirt and stone stockpiles; visually less finished than completed buildings |
| Ruin / damage | darkened material, broken edges, ember or dust accents; readable but restrained, never a red tint over the whole asset |

## 8. Detail hierarchy and silhouette language

At normal gameplay zoom, read assets in this order:

1. silhouette and ground contact;
2. faction or role cue;
3. one or two defining props;
4. material blocks;
5. small texture and wear.

### Current silhouettes

- Villager: teal working dress, cream head covering and sleeves, leather belt pouch, tool or cargo visibly separated from the torso.
- Crown Guard: compact armored body, blue-teal scarf, round painted shield, upright spear; spear and shield must not disappear into the body at screen-left/right directions.
- Ashen Raider: broader dark fur silhouette, red sash, exposed axe head, asymmetrical shoulder mass; hostile identity must read even when health bars are hidden.
- Crown Hall: broad first-age timber landmark with woven wattle, layered thatch, carved beam ends, blue-and-gold cloth, watch platforms, a strong south stair, and warm entry flame.
- Crown Barracks: long timber-and-thatch drill hall with an open packed-earth yard, human-scale straw dummies, weapon racks, round shields, and restrained Crownwarden cloth. It belongs to the same material age as the Hall and must not use stone towers or slate roofing.
- Palisade Wall: vertical sharpened timber stakes, restrained rails and rope, a narrow packed-earth contact strip, and small blue-and-gold bindings. Each projected direction uses an authored upright view; never rotate a completed wall picture in screen space because that turns its posts sideways or upside down.
- Hearth House and Waystore: retired from the current playable catalog. Their legacy atlas cells remain historical fallback material only and are not visual references for future Crownwarden buildings.
- Ashen Camp: dark palisade enclosure, red tents, tall horned banner, firelight, bone/trophy accents; it is enemy architecture, not a recolored Crownwarden building.
- Tree: trunk plus distinct canopy silhouette; four tree variants must not collapse into one cloned circle.
- Berry: low broad bush with visible clusters and leaf mass; depleted art must visibly reduce cluster volume.
- Stone: pale faceted mass with grounded rubble; depleted art becomes low rubble, not a disappearing label.

## 9. Terrain and environmental composition

The meadow is the broad color field. Paths provide navigation readability and settlement character, but they do not become a grid or decorative UI line. Environmental detail is used to break repetition and support scale:

- four tree variations, four berry variations, four stone variations;
- logs, stumps, flowers, and pebbles as small supporting details;
- neutral detail should be lower contrast than resource nodes;
- variants may be rotated in composition by placement, but the authored art itself must keep the same camera and light;
- never place enough detail to hide interaction circles, building footprints, or unit feet.

## 10. Buildings and construction

Buildings use a grounded four-stage raster family: foundation, partial, near-complete, complete. The current runtime exposes six readable player-facing moments: placement preview, foundation, early, mid, late, and complete. Early and mid currently share the authored partial row with different restrained renderer treatment; this is a known ceiling, not a hidden claim of six unique rasters.

Construction art must show physical cause and effect:

- foundation has stone lines, posts, flags, dirt, and a clear unbuilt center;
- partial has framing, scaffolding, unfinished walls, and material stockpiles;
- near-complete has most volume present but unfinished trim or scaffold;
- complete has final roof, doors, banners, props, and clean terrain contact;
- damaged buildings use existing artwork plus subtle condition treatment until dedicated damage cells become worthwhile;
- destroyed buildings keep a brief readable collapse/ruin treatment, then leave the map cleanly.

Entrances are currently south-facing for every building. New buildings must define a readable entrance before they are added; do not rotate an asset at runtime to invent a door direction.

## 11. Animation and frame design

The current animation standard is restrained and readable at RTS distance:

- four authored directions for every state that materially changes appearance;
- real multi-frame walking for villagers; combat walking currently uses a restrained single authored walk pose;
- one clear authored pose is acceptable for a short-term task bridge, but must be declared in the animation coverage log;
- no procedural squash, stretch, bob, or fake directional swap that causes feet to slide;
- state changes reset animation phase and keep the ground anchor fixed;
- tool contact, resource collection, attack contact, construction strike, deposit, and death cleanup are named timing events;
- action art is allowed to be subtle; readability is more important than exaggerated motion.

Current below-ceiling work is recorded in CROWNFORGE_ANIMATION_COVERAGE.md: Villager task/build/carry loops are now four-frame authored families, while Crown Guard/Ashen Raider walk/hit/death and optional Villager hit/death remain below the final standard. The current unit-animation score is 8/10; do not add new unit categories until the remaining existing response family is stronger.

## 12. Transparency and asset preparation

All world and UI sprites except the meadow textures are RGBA PNGs with neutral matte removed. The preparation scripts use Sharp to remove light neutral studio backgrounds while preserving colored edges and darker painted contact shadows.

Acceptance rules:

- inspect alpha on a dark background and on the live meadow;
- inspect the four corners and the full cell boundaries;
- preserve soft antialiasing and contact shadows;
- no bright fringe around hair, foliage, banners, or stone;
- no cropped spear, roof, tree crown, flag, or tool unless the crop is a deliberate atlas boundary;
- use even atlas cells and document row/column semantics;
- keep source files and processed runtime files distinguishable by name and version.

## 13. UI and feedback art

The interface is an original Crownforge strategy panel language: translucent deep blue-green glass, parchment ink, muted gold dividers, and hand-painted resource/role icons. Current icons are 4 x 4 atlas cells rendered at approximately 31 px in the main controls and 42 px in the selection panel.

UI icons should be:

- one readable object or symbol;
- warm-lit and outlined with the same material treatment as the world;
- distinct at 31 px without relying on text;
- free of emoji, generic line glyphs, and temporary placeholder circles;
- used sparingly so the resource and selection panels remain calm.

The canvas may draw selection markers, health bars, path lines, attack rings, placement footprints, construction dust, impact rings, and ripples. These are state communication, not asset families; their colors and opacity must remain restrained.

## 14. Asset acceptance checklist

Before an asset is promoted to active runtime use, verify:

- [ ] It belongs to the Crownforge material, palette, lighting, and silhouette family.
- [ ] Its camera direction matches the projection and its direction is authored where needed.
- [ ] Its feet, base, or foundation share the common ground anchor.
- [ ] Its shadow agrees with the upper-left/front key light.
- [ ] Its alpha has no matte, halo, square background, or hard seam.
- [ ] It is legible at 0.84 normal zoom and does not become a visual blob at 0.62 zoom.
- [ ] It remains clean at 1.12 close zoom.
- [ ] Its collision/interaction footprint is documented separately from transparent pixels.
- [ ] Its atlas rows, columns, frame count, and source workflow are recorded in CROWNFORGE_ASSET_MANIFEST.md.
- [ ] It has been inspected in the live game and produces no console warnings or errors.

## 15. Current audit decision

The current player-facing families pass the visual consistency gate for the deliberately small slice. No new raster was generated during this formalization pass because the live zoom audit found no placeholder, generic box, mismatched perspective, visible matte, or unrelated art style that justified a new asset. Existing work is retained, documented, and versioned.

The next visual work is refinement of existing action depth and, only if the close-zoom audit proves it necessary, dedicated building damage/ruin or six-row construction cells. Do not expand the world or roster to create more art before the current families are stronger.
## 16. Daylight lighting lock — 2026-08-16

The current vertical slice uses one daylight condition only. The primary light is a warm sun from the **upper-left/front of the screen**, represented in runtime metadata by the vector **(-0.48, -0.88)**. The corresponding painted shadow direction is **(+0.48, +0.88)**: screen-right/back.

### Lighting contract

| Layer | Rule |
|---|---|
| Primary key | Warm honey/cream light from upper-left/front; enough direction to model roofs, foliage, cloth, armor, and tools without blackening undersides. |
| Ambient | Low green-blue ambient fill, represented by rgba(62, 91, 70, 0.042), preserving shaded material detail. |
| Terrain grade | One clipped diagonal daylight gradient across the map: warm at the distant upper-left, neutral through the center, green-ambient toward the lower-right. |
| Asset shadows | Baked shadows in the existing transparent atlases remain authoritative for units, resources, buildings, and the Ashen Camp. No second runtime cast-shadow system is applied. |
| Map edge | A soft green-neutral edge shadow, rgba(16, 31, 27, 0.34), separates the meadow from the dark backdrop without creating a black rim. |
| Firelight | Ashen Camp firelight is a local material accent only; it does not become a second world sun. |
| Feedback | Selection teal, enemy red, construction gold, and resource accents remain brighter than passive terrain but are not luminous washes. |

### Baked-shadow audit

- Meadow paths and terrain texture use the same warm upper-left/front read as the world objects.
- Environment atlas trees, berry bushes, stone deposits, logs, stumps, flowers, and pebbles carry grounded contact shadows that fall consistently toward screen-right/back.
- Crown Hall, Hearth House, Waystore, and all construction rows keep the same light direction. Foundation and scaffold rows use softer, smaller contact treatment because their volume is unfinished.
- Ashen Camp has a stronger local fire accent, but its outer material shading and ground contact remain compatible with the master daylight.
- Villager motion, task, carry, and combat sheets keep the feet and painted shadows aligned across all four directions. The shadow is part of the authored cell and does not rotate independently.
- Crown Guard and Ashen Raider sheets use the same contact-shadow direction. Their faction distinction comes from silhouette, clothing, shield/axe, banner, and value structure rather than red-versus-green alone.
- UI icons have their own small separation shadow for panel readability. UI drop shadows are not world shadows and must not be copied into world sprites.

### Color and material hierarchy

Terrain is the calmest and broadest visual field. Resources are distinct through silhouette, label, texture, and restrained resource color rather than glow. Units have the clearest small-scale contrast and faction shapes. Buildings carry the greatest visual mass. Selection, command, warning, health, and combat feedback are reserved for state communication.

Wood remains warm and fibrous; stone remains cooler and faceted; metal remains dark with small edge highlights; cloth remains colored by faction and fold direction; leather remains umber and low-gloss; leaves remain varied but lower contrast than a unit; food clusters remain visible without becoming luminous red blobs. Value and texture carry the distinction even if hue is removed.

### Runtime safety rule

A full-canvas composite operation must never be used to grade a transparent sprite after it has been drawn on the opaque game canvas. A prototype sprite grade was rejected during this pass because it created rectangular tonal blocks around otherwise transparent atlas cells. If per-sprite correction is ever required, it must render through an alpha-isolated offscreen buffer and be re-audited at zoomed-out scale. The current game intentionally uses the safer baked-shadow approach.

### Display and performance target

The reference target remains 1280 × 720 with camera zoom from 0.62 to 1.12. The daylight grade is a single map-sized gradient and the map-edge stroke remains lightweight; no per-entity offscreen surfaces, blur passes, or dynamic shadow maps are used. In the developer-only lighting benchmark, the current browser measured:

- grade disabled: 0.373 ms average render, 0.900 ms p95, 1.200 ms max;
- grade enabled: 0.395 ms average render, 0.900 ms p95, 1.200 ms max.

The measured average difference was approximately 0.022 ms per render in that pass. This is comfortably below the 16.67 ms budget for 60 fps in the target browser. The benchmark is enabled only by the lighting-benchmark URL flag and never appears in the player UI.

### Accessibility and readability

Friendly and hostile identification does not depend on red-versus-green alone. Crownwardens use teal/gold, clear human silhouettes, blue pennants, and selection markers; Ashen units use darker broad silhouettes, red cloth, axes, enemy markers, and hostile structure language. Health bars and selection outlines remain high-value neutral signals when color saturation is reduced.

No day/night, weather, biome, fog-of-war, or alternate lighting mode is part of this contract.

### Final validation record

- Normal, close, and zoomed-out 1280 × 720 gameplay views remained free of sprite rectangles, halos, floating bases, and shadow seams.
- Animation inspection was re-run after the renderer change; all current states and directions loaded without warnings or errors.
- Movement stress was re-run after the renderer change; Retask storm passed with zero footprint, boundary, or stuck-unit violations.
- A complete live defeat match was played under the revised lighting; the Crown Hall fell at Daybreak 1:32, the defeat panel appeared, and PLAY AGAIN restored the fresh slice without warnings.

## 17. Battlefield landscape and depth lock — 2026-08-16

The current battlefield is a single authored meadow board, not a tile editor. Its grass, dirt paths, bare-soil variation, flowers, and small stones are one ground family and are clipped to the projected map diamond at runtime. The board must remain the calmest visual field; units, resources, buildings, and interaction feedback carry the higher contrast.

### Composition contract

- Opening wood is west of the Crown Hall in a visible two-tree clearing at world positions `(3.8, 14.2)` and `(5.4, 13.0)`.
- The stone clearing remains on the east route at `(25.2, 10.3)` and `(26.7, 11.6)`.
- The initial Ashen Raider stands between the camp and stone clearing at `(23.5, 8.0)`, never on top of the resource.
- Berries use separated approach clearings at `(15.2, 5.8)` and `(18.5, 10.5)` so neither bush is visually buried by a building, unit, or another resource.
- The current meadow path is baked artwork and is allowed to suggest settlement wear without implying a separate walkability layer.

### Ground, depth, and occlusion

- Every active world asset uses its authored feet, base, foundation, or painted contact shadow as its ground anchor. Transparent pixels are not collision geometry.
- World drawing is sorted by projected ground depth, then stable kind and ID tie-breakers. The renderer must not accumulate per-object layer exceptions.
- Tall trees may occlude a unit briefly. Selected, attacking, or damaged units behind a tree receive a restrained post-world ground marker and health bar so they remain trackable without fading every canopy.
- Building occlusion uses the same post-world tracking treatment. Low environmental details remain visually subordinate and do not receive interactive-looking highlights.
- No ambient wind animation exists in the current slice. Do not add synchronized foliage motion merely to make the board move; any future wind must be slow, phase-varied, and keep trunks, shadows, collision, and interaction points stable.

### Readability gate

At normal, close, and zoomed-out views, verify that a player can distinguish walkable grass/path from occupied resource/building footprints, find the opening wood and stone clearings, follow the route toward the Ashen Camp, and keep a selected worker readable through a nearby tree. Terrain detail must never look like a blocker unless it is a real collision object.

## 18. Player-experience contract — 2026-08-16

The player-facing layer is part of Crownforge's visual identity. It must read as a quiet field command surface: warm, compact, original, and decisive at RTS distance.

### Input grammar

- Left click selects a friendly unit, building, or resource node; clicking empty ground clears selection. Drag selection works in either direction, and Shift adds/removes units.
- Right click on open ground moves selected units with spacing; on wood, food, or stone it assigns compatible villagers; on a friendly storage/building it routes to a safe approach point; on hostile units or structures it attacks when a compatible attacker is selected.
- Construction opens from the visible menu or `B`, shows a cursor/readout that distinguishes valid from invalid terrain, and cancels with Escape. `B` must never bypass the visible menu contract.
- Escape closes menus and clears placement/transient input. Browser blur must not leave a camera key, selection drag, or pan gesture stuck.

### Cursor family

Cursor marks are small inline Crownforge SVGs rather than generic browser symbols. They share the game palette and use the following semantic contexts: default cream arrow, teal/gold selection reticle, teal movement reticle, green gathering leaf, red hostile cross, gold building interaction, green valid foundation, red invalid slash, and a compact gold UI pointer. Hotspots remain centered or arrow-tip aligned so the mark never obscures the actual target.

### Feedback hierarchy

The selection panel is authoritative for identity, health, cargo, and live task. The command line is authoritative for the current selected unit order. Toasts are short-lived event notices for placement, construction completion, resource depletion, AI notices, victory, and defeat. Placement readouts explain the specific reason a site is invalid. World ripples and target markers are restrained accents, not persistent decoration.

### Audio and settings

The slice uses a gesture-unlocked procedural effects layer with short tonal cues tied to commands and animation events. Selection, movement, gathering, deposits, construction, attack, impact, damage, death, destruction, placement, victory, defeat, and UI interactions must remain distinct but quiet enough for repeated use. Master volume, effects volume, and reduced camera motion are exposed in the Field Manual. Music is deliberately absent from this slice and must not be implied by empty controls.

### Camera and accessibility

WASD/arrow pan, wheel zoom anchored at the cursor, and middle-drag pan form the current camera contract. Keyboard pan vectors are normalized diagonally. The canvas is focusable after map interaction, and UI controls expose visible focus rings, concise labels, and pointer/keyboard tooltips. The reference responsive sizes are 1280 × 720, 1024 × 640, and the supported 980 × 620 minimum.

### Art boundary

No new raster family was needed for this pass. The existing generated icon atlas remains the source for panel glyphs; code-authored SVG cursors and the procedural audio layer are approved feedback assets because they inherit the same palette, restraint, and semantic clarity without creating a second art direction. Do not add emoji, generic glyphs, glowing neon pointer effects, or large HUD ornament.

## POST-AUDIT ACTION-FAMILY AMENDMENT — 2026-08-16 (CURRENT)

The current approved visual contract now includes six additional original raster families, all derived from the established Crownforge silhouette, lighting, palette, transparent matte preparation, and 108 px unit scale.

### Approved action families

- Villager carry: Wood, Food, Stone, and Supplies; four authored frame columns by four authored camera-direction rows.
- Crown Guard attack: ready/anticipation/contact/recovery; four authored direction rows.
- Ashen Raider attack: matched ready/anticipation/contact/recovery; four authored direction rows.

The frames are intentionally restrained. They must read as weight shift, tool/weapon phase, and contact without introducing exaggerated cartoon motion. The feet baseline and painted contact shadow remain fixed. The combat contact frame is the visual partner to the existing event-gated damage timing.

### Rejected source treatment

Generated drafts with colored fringe, checkerboard/matte residue, or large square ground patches are not approved. The rejected food carry draft and earlier fringe/matte drafts remain outside the runtime source map; only the prepared RGBA outputs listed in the Asset Manifest are approved.

### Current visual standard and remaining gap

Villager task, construction, and carry loops now establish the quality standard for existing worker actions. Crown Guard and Ashen Raider attack depth is improved and direction-correct, but their walk, hit, and death rows remain single-pose. The next art pass must complete that existing response family before any new unit or building family is considered.

## Integrity-pass addition — 2026-08-16

The approved marauder attack family is now `crownforge-raider-attack-loop-v3.png`. It is a transparent 4 × 4 sheet composed from four generated directional strips, with each frame padded inside its source cell and aligned to the existing unit ground baseline. The back-left contact frame was generated as a standalone connected-axe pose because the earlier strip contained a detached fragment. The old v2 family is retained only as historical source material and must not be referenced by runtime.

The live renderer and QA viewer now share the same one-pixel atlas-cell inset. Any future generated sheet must be inspected at full atlas size, at runtime size, and in all four directions before integration. Current hit/death depth remains the next visual standard gap; no new art catalog should be generated until it is addressed.

## FIRST-AGE GOLD MATERIAL AMENDMENT — 2026-08-22 (CURRENT)

Gold is the fourth approved first-age resource. It must read as scarce quartz-bearing host rock, not a pile of coins, ingots, treasure, or a later-age mine. The active family uses ochre-grey stone, pale quartz, very restrained natural gold traces, moss, grass, loose rubble, and the fixed warm upper-left light. Small, medium, and large veins use independently authored silhouettes; the exhausted state is a low worked rubble hollow with timber wedges and no floating label.

The approved visual hierarchy is:

- small vein: a compact prospecting outcrop and short work life;
- medium vein: a broad, clearly discoverable settlement resource;
- large vein: a regional landmark with a long work life, still subordinate to the Crown Hall and Barracks;
- depleted vein: low rubble and worked earth that preserves ground contact without blocking the view;
- carried Gold: pale quartz ore in a rawhide sack, held at the established Villager scale and foot anchor;
- HUD Gold: quartz-bearing rock and a primitive wooden washing pan, with only tiny muted gold traces.

Gold mining reuses the approved directional stone-pick motion because the physical action and tool are the same. The material must become distinct through the authored node family, muted-gold contact feedback, `carryGoldLoop`, carry badge, selected-resource icon, and Gold total—not by changing the Villager's body scale or adding exaggerated sparkling effects.

Do not introduce a Gold-processing building, mint, market, coins, cavalry cost, technology, or age progression merely because Gold now exists. Those remain separate design approvals.

## 28. First-age utilitarian work sites — Ore Wash approval

The Ore Wash is the approved visual and scale precedent for small resource-support structures. It must remain subordinate to the Crown Hall and Barracks: low silhouette, no tower, no monumental porch, no stone blockwork, and no grand faction heraldry. Its readable identity comes from the work itself—timber sluice, shallow wash troughs, ore baskets, damp boards, simple hand tools, and a small thatched shelter.

Approved work-site rules:

- use the same fixed elevated three-quarter camera and upper-left/front key light as the Hall and Barracks;
- use rough timber, rope, woven baskets, thatch, hide or cloth, and packed earth appropriate to the first age;
- keep render width below half of a major production landmark unless a human-scale reference proves otherwise;
- use only restrained Crownwarden blue-and-gold accents;
- keep a complete transparent silhouette with an irregular terrain contact, never a square plate or halo;
- make the entrance and working side readable from normal RTS zoom;
- do not turn a support structure into a mine shaft, furnace complex, stone refinery, merchant market, or later-age factory.

This approval lifts the preceding Gold-pass prohibition only for the compact Ore Wash. Stables, cavalry, other specialty mills, technologies, coins, markets, and age progression remain separate approvals.
