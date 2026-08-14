# Mosswake asset map

Mosswake currently renders its first playable slice with layered canvas primitives so the adventure stays fast, readable, and playable without a download step. These folders are the replaceable art slots for the next art pass; keep transparent PNG/WebP files in the listed slots and the renderer can be pointed at them without changing game rules.

## Current loading audit

The live game is intentionally procedural today: `mosswake.js` draws the player, enemies, terrain, dungeon, props, and effects with canvas primitives. It now also reads the optional `assets/manifest.json` registry at startup. Add a generated file and one manifest entry; the renderer will use it when available and silently keep the procedural fallback if it is missing or still loading. Collision rectangles, AI, animation state, camera anchors, and room layout remain in `mosswake.js`.

Example manifest entry:

```json
{
  "sprites": {
    "player": {
      "src": "player/warden-sheet.png",
      "frameWidth": 96,
      "frameHeight": 96,
      "columns": 8,
      "frames": 40,
      "fps": 10,
      "anchorX": 0.5,
      "anchorY": 0.82
    }
  }
}
```

The optional `player`, `boss`, `enemy-*`, `tree-back`, `tree-mid`, `tree-front`, `projectile-*`, `fx-slash`, `fx-impact`, `boss-fx`, and `outdoor-foliage` keys already have renderer hooks. No gameplay code needs to change when an approved replacement is swapped in; add a manifest entry and keep the same anchor and cell dimensions.

## Generated character library — current pass

This pass turns three high-impact living silhouettes into real, replaceable artwork. The files are generated PNG sprite sheets with chroma-key backgrounds removed to alpha, and are loaded only through `manifest.json`:

| Asset | File | Sheet | Runtime use |
| --- | --- | --- | --- |
| Lantern Warden | `player/warden-sheet-generated-v1.png` | 8 columns × 4 rows, 192×256 source cells, 32 frames | Idle direction cues, walk, sword, dodge, hurt; drawn at 52×70 with a shared 0.88 feet anchor |
| Lantern Warden movement | `player/warden-run-sheet-generated-v1.png` | 4 columns × 4 rows, 312×312 source cells, 16 frames | Dedicated south/east/north/west walk cycles; row order is S/E/N/W with four contact-passing-recovery poses each |
| Rowan | `npcs/rowan-sheet-generated-v1.png` | 4 columns × 4 rows, 312×312 source cells, 16 frames | Outpost keeper idle/turn, walking, map-reading work, talking/reaction; drawn at 52×70 with a shared 0.88 feet anchor |
| Mossling | `enemies/mossling-sheet-generated-v1.png` | 4 columns × 4 rows, 312×312 source cells, 16 frames | Idle/turn, skitter, pounce, hit recoil; drawn at 34×34 with a shared 0.84 feet anchor |
| Enemy family | `enemies/enemy-family-generated-v1.png` | 4 columns × 4 rows, 312×312 source cells, 16 frames | Thornback, Moon Wisp, Ambush Moth, and Rootling/Root Warden: idle, telegraph, attack, hit; selected by enemy type and drawn with shared ground anchors |
| Enemy combat effects | `enemies/enemy-effects-generated-v1.png` | 4 columns × 4 rows, 312×312 source cells, 16 frames | Thornback charge, Wisp ranged, Moth ambush, impact, and drop feedback; rotated by attack direction and selected by enemy/drop state |
| HUD and pickup icons | `ui-icons-generated-v1.png` | 4 columns × 4 rows, 312×312 source cells, 16 frames | Painted hearts, key, Heartseed, Rootlight, discovery, map, drops, sword, dash, and lock icons; CSS/DOM HUD presentation with procedural fallback |
| Dialogue and screen surfaces | `ui/ui-panels-generated-v1.png` | 4 columns × 4 rows, 312×312 source cells, 16 modular cells | Painted dialogue, portrait frame, title/pause/victory plaques, objective/map/ability surfaces, toast/button plates, lock treatment, and decorative dividers; layered CSS presentation with fallback |
| Collectibles and exploration items | `items/exploration-items-generated-v1.png` | 4 columns × 4 rows, 312×312 source cells, 16 modular cells | Painted key, Heartseed, lantern seed, Dewglass lens, moth token, moonroot cache, hidden chest, and Rootlight lantern idle/open/glow states; selected by authored interaction location with procedural fallback |
| Outpost, cabin, shrine, and entrance structures | `buildings/mosswake-structure-family-generated-v1.png` | 4 columns × 4 rows, 312×312 source cells, 16 modular cells | Painted outpost, shrine, cabin, roof/wall, lantern doorway, and root-arch states; selected by authored building hook with procedural facade fallback |
| Hollow Guardian | `bosses/hollow-guardian-sheet-generated-v1.png` | 4 columns × 4 rows, 312×312 source cells, 16 frames | Phase-I idle/attack, phase-II transformed attacks, phase-break, stagger, and defeat collapse; drawn at 100–112×100–112 with a 0.9 feet anchor |
| Lantern-blade FX | `effects/lantern-blade-fx-generated-v1.png` | 4 columns × 4 rows, 312×312 source cells, 16 frames | Painted sword sweep/contact/Rootlight states; slash row is drawn at 96×64, pulse frames scale from 88–170 px around the player |
| Water surface | `terrain/water-surface-generated-v1.png` | 4 columns × 4 rows, 312×312 source cells, 16 frames | Painted teal ripple phases composited inside ponds and the flooded vault; drawn to the current water rectangle with procedural fallback |
| Shoreline overlays | `terrain/shoreline-overlays-generated-v1.png` | 4 columns × 2 rows, 312×312 source cells, 8 frames | Transparent straight/corner/rocky/reed/foam bank accents; current runtime uses the calm straight and foam variants along pond banks |
| Outdoor cliff and ledge family | `terrain/outdoor-cliff-family-generated-v1.png` | 4 columns × 4 rows, 312×312 source cells, 16 modular cells | Painted straight, broken, root-wrapped, damp, and boulder ledges; selected by the three authored outdoor cliff hooks with procedural wedge fallback |
| Secondary moonwell ruin | `props/outdoor-moonwell-generated-v1.png` | Single 1536×1024 transparent landmark | Low broken moonwell shrine with crescent basin, roots, rubble, flowers, and mint pool; selected by the secondary ruin hook with procedural fallback |
| Lanternwood tree family | `trees/lanternwood-tree-family-generated-v1.png` | 4 columns × 4 rows, 312×312 source cells, 16 frames | Painted back, mid, foreground, and ancient-root tree silhouettes with four sway poses per row; selected by existing tree layer hooks |
| Guardian telegraph and defeat FX | `effects/guardian-telegraph-fx-generated-v1.png` | 6 columns × 4 rows, 208×312 source cells, 24 frames | Painted volley fans, slam rings, dash lanes, exposure cracks, phase-break shards, and defeat motes; selected by Guardian telegraph and boss particle hooks |
| Outdoor foliage interaction family | `plants/outdoor-foliage-interaction-generated-v1.png` | 4 columns × 4 rows, 312×312 source cells, 16 frames | Painted meadow, fern/reed, flower/mushroom, log/ivy silhouettes; selected by outdoor grass, flower, log, and breakable prop hooks with deterministic rustle frames |
| Dungeon architecture kit | `dungeon/dungeon-architecture-kit-generated-v1.png` | 4 columns × 4 rows, 312×312 source cells, 16 frames | Painted mossy walls, arches, pillars, rubble, fallen lintel, torch sconce, and root-wrapped statue detail; selected by dungeon room architecture hooks with procedural fallback |
| Named NPC family | `npcs/named-npc-family-generated-v1.png` plus `npcs/portraits/*.png` | 4 columns × 4 rows, 312×312 source cells, 16 frames; 96×96 portraits | Tansy, Brindle, Lumen, and trader front, walk, work, and talk states; named NPC renderer and dialogue portrait presentation |
| Dungeon landmarks and interactive props | `dungeon/dungeon-landmarks-interactive-generated-v1.png` | 4 columns × 4 rows, 312×312 source cells, 16 frames | Painted chest, rune, switch, Rootlight socket, Heartseed pedestal, Lantern relic, key, and tablet states; dungeon interaction hooks with procedural fallback |

The `*-keyed.png` companions are the source exports retained for future matte refinement; the alpha PNGs are the only files referenced by the game. Both characters follow the Mosswake art bible below: hand-painted storybook rendering, gentle orthographic 3/4 read, deep-moss edge restraint, parchment highlights, moonlit teal, and upper-left light. Collision, AI, dialogue, and camera code remain unchanged.

The renderer intentionally keeps the procedural body as a safe fallback. This means a slow asset request, an offline preview, or a future rejected frame cannot make Mosswake unplayable. New character sheets should preserve the same ground anchor and can be added with one manifest entry. Runtime character sprites receive a small ground-plane offset while their contact shadows remain in world space, preventing the painted feet from reading as if they are hovering.

## Art direction

- Orthographic top-down view with a gentle 3/4 silhouette. Use warm parchment highlights, moss greens, moonlit teal, and a single rose accent for danger.
- Use clean silhouettes and strong value contrast first. Small details should support navigation, combat readability, and a cozy storybook mood.
- Target 2x desktop assets so they stay crisp on high-density displays.

## Folders and requested slots

| Folder | Suggested slots | Starting spec |
| --- | --- | --- |
| `player/` | `warden-idle`, `warden-walk`, `warden-attack`, `warden-dash`, `warden-hurt` | 64×64, 4 directions, 4 walk frames / 5 attack frames |
| `enemies/` | `mossling`, `thornback`, `moon-wisp`, `ambush-moth`, `rootling` | 48×48, 4 idle frames, telegraph + hit silhouette |
| `bosses/` | `root-warden`, `hollow-guardian` | 128×128, telegraph + hurt + defeat frames |
| `npcs/` | `rowan`, `tansy`, `brindle`, `lumen`, `outpost-trader` | 64×80, idle + walk/work/talk frames |
| `terrain/` | `grass`, `path`, `water`, `stone-floor`, `stone-wall` | 96×96 seamless tiles |
| `trees/` | `oak`, `birch`, `ancient-root`, `grove-canopy` | 128×160, 2 seasonal variants, back/mid/foreground silhouettes |
| `plants/` | `mothflower`, `fern`, `reed`, `mushroom`, `meadow-tuft` | 48×48, 2 sway frames, touched/rustled variation |
| `rocks/` | `moss-rock`, `rune-stone`, `shore-stone`, `breakable-bramble` | 64×64, intact + broken |
| `landmarks/` | `fallen-log`, `lantern-post`, `trail-sign`, `pond-edge` | 96×96 modular pieces, transparent shadows |
| `wildlife/` | `butterfly`, `songbird`, `firefly` | 32×32, 4-frame loops, warm/cool color variants |
| `enemy-effects/` | `charge-ring`, `ranged-line`, `ambush-reveal`, `drop-mote` | 96×96 transparent sheets, readable at gameplay scale |
| `buildings/` | `outpost`, `shrine`, `cabin` | 256×192, roof/wall/door layers |
| `dungeon/` | `room-border`, `gate`, `switch`, `chest`, `heartseed`, `root-gallery`, `moon-hall`, `warden-garden`, `flooded-vault`, `ashen-antechamber`, `heartseed-sanctum`, `moonwake-lantern`, `rootlight-seal`, `rootlight-pulse`, `moonroot-cache` | 96×96 modular pieces; preserve readable gate openings |
| `weapons/` | `lantern-blade`, `impact-arc` | 96×48, 5 attack frames |
| `items/` | `brass-key`, `heartseed-shard`, `moth-token` | 32×32, 2 glow frames |
| `exploration/` | `pale-stone-clue`, `ivy-gate`, `hidden-chest`, `lantern-chart`, `lantern-seed`, `dewglass-lens` | 64×64–128×96, intact/broken/open/glow variants |
| `effects/` | `slash`, `dash-trail`, `hit-spark`, `telegraph`, `portal` | 96×96, transparent sprite sheets |
| `ui/` | `heart`, `key`, `map-marker`, `dialogue-frame` | 48×48 / 9-slice frame |
| `portraits/` | `rowan`, `tansy`, `brindle`, `lumen` | 96×96 transparent busts, neutral/talk/event expressions |

## Completion audit status

The first-section renderer is visually coherent and performance-safe. The player, Rowan, Mossling, distinct enemy family, enemy combat effects, HUD/pickup icons, Hollow Guardian, Guardian combat FX, Lantern-blade combat FX, water/shoreline family, outdoor cliff family, layered tree family, outdoor foliage family, pond dock, northeast moon arch, and secondary moonwell now use generated, alpha-prepared assets; the procedural fallback remains available for every other living entity and effect. The remaining high-impact replacements are ranked in **GRAPHICS TO GENERATE NEXT (remaining)** below. The persistent production log lives in `MOSSWAKE_ASSET_UPGRADE_TRACKER.md`.

Until those files exist, the procedural renderer remains the intentional fallback for player/enemy bodies, NPC portraits, props, terrain, water, dungeon structure, item icons, and effects. It is readable and polished enough for playtesting, but those specific categories should not be described as final custom artwork.

## GRAPHICS TO GENERATE NEXT (remaining)

Ranked by visible impact on the playable vertical slice. Export transparent PNG/WebP unless marked opaque, keep cast shadows and lighting out of the files, and preserve the shared ground anchor so the runtime can continue to own collision and lighting.

1. **Hollow Guardian event sheet — COMPLETE** — `bosses/hollow-guardian-sheet-generated-v1.png` is integrated through the manifest with 16 aligned phase, attack, hit, phase-break, and defeat frames. Keep the generated sheet and its chroma-key source; do not regenerate it without a specific visual defect.
2. **Warden player sheet — COMPLETE** — `warden-sheet-generated-v1.png` is integrated through the manifest with 32 aligned frames for idle, movement, sword, dodge, and hurt states. Keep the existing prompt and cell requirements as the replacement-art contract if a higher-resolution version is generated later.
3. **Lantern-blade combat FX — COMPLETE** — `effects/lantern-blade-fx-generated-v1.png` is integrated through `fx-slash` and `fx-impact` with four timed sword frames and four Rootlight frames. Keep the atlas and keyed source; do not regenerate it without a specific matte or readability defect.
4. **Guardian arena and pylon kit — COMPLETE** — `dungeon/heartseed-sanctum-kit-generated-v1.png` is integrated through the `sanctum-kit` manifest slot for altar, pylons, rings, and phase states. Keep its charcoal/moss/rose treatment as the dungeon landmark reference.
5. **Guardian telegraph and defeat FX — COMPLETE** — `effects/guardian-telegraph-fx-generated-v1.png` is integrated through `boss-fx` for volley, slam, dash, rain, phase-break, and defeat presentation. Keep the atlas and keyed source; do not regenerate it without a specific readability defect.
6. **Outdoor foliage interaction pack — COMPLETE** — `plants/outdoor-foliage-interaction-generated-v1.png` is integrated through `outdoor-foliage` for grass, ferns/reeds, flower/mushroom clusters, logs, and breakable ivy. Keep the atlas and keyed source; do not regenerate it without a specific readability or repetition defect.
7. **Dungeon architecture and landmark kit** — `192×192 px` transparent modules; wall caps, arches, pillars, stairs, cracked lintels, statues, root ribs, carvings, and rubble in 4 stone variants and 3 damage states. Modular sheet with separate highlight/occlusion layers. Used across all six shrine rooms. This is the highest-impact non-character pass because it gives the dungeon a real constructed identity. Prompt: “Hand-painted ancient shrine dungeon modular architecture sheet, charcoal stone wall caps, four-way arches, damaged pillars, short stairs, cracked lintels, guardian statue fragments, roots breaking through masonry, brass carvings and rubble, orthographic 3/4 top-down, transparent background, cool charcoal and blue-green moss with muted brass, mint glyph accents, upper-left light, 192x192 modular cells, four stone variants, three damage states, separate highlight and occlusion layers, no baked cast shadow, no text.”
8. **NPC presentation set — ROWAN BODY COMPLETE** — `npcs/rowan-sheet-generated-v1.png` is integrated for Rowan’s idle, walk, map-work, talk, and reaction states. Generate the remaining Tansy, Brindle, and Lumen sheets plus the bust portraits using the same shared prompt and anchor contract. The existing Rowan sheet is the visual reference to use for consistency.

## Temporary feel pass

The current movement, outdoor, and enemy passes intentionally use the same art-first, replaceable approach as First Ember: the player, blade arc, dodge trail, dust, hit stars, impact rings, shadows, trees, plants, water edge, wildlife, enemy silhouettes, telegraphs, and drops are generated as crisp canvas primitives. This keeps the first encounters readable while final sprite sheets are being painted. The named slots above are the exact custom graphics to generate later; no gameplay collision, pathing, AI behavior, or timing depends on a temporary shape.

The latest art-direction pass adds restrained inked silhouettes, more varied grass and stone texture, authored roof/facade trim, shoreline foam, chest construction details, and a shared shadow/outline language. These are intentionally small runtime treatments: they improve value hierarchy and object scale now while leaving the final custom PNG/WebP slots replaceable.

The major visual pass adds authored meadow color fields, compacted path wear and stepping stones, shoreline reflection marks, facade gradients and window bounce light, localized lantern/campfire/rootlight pools, atmospheric horizon haze, foreground leaf clusters, and a distinct focal medallion/light language for each dungeon room. These runtime layers are deliberately low-contrast and remain separate from gameplay state, so they can be removed or replaced by painted terrain, prop, and lighting assets one slot at a time.

The handcrafted outdoor pass replaces the evenly spaced read with authored composition anchors: clustered tree lines, small clearings, irregular shore stones, layered bushes, broken fences, two readable signposts, quiet ruins, cliff silhouettes, dappled canopy shadows, and local meadow clusters. The fixed anchors are intentional and editable; ambient motion (wind, leaf drift, water, insects, and soft shadow drift) is kept sparse so landmarks remain legible.

The lighting pass treats atmosphere as a composition system rather than a dark overlay: the overworld gets an upper-left sun direction, moving canopy gaps, warm landmark pools, and sparse dust motes; the shrine gets torch falloff, room-tinted pools, floor-hugging fog, localized edge falloff, and a vignetted entrance/exit veil. Contact shadows stay soft and offset down-right, and all effect counts are bounded for browser performance.

The character presentation pass keeps the same runtime-driven workflow: facing blends continuously, movement drives bob/stride, attack anticipation drives the sword pose and arc, enemy telegraphs compress or stretch silhouettes, and defeated enemies linger for a short dissolve/shard payoff. These are intentionally separate from hitboxes and AI state so generated sheets can replace each silhouette without retuning combat.

The professional-feel pass keeps that restraint in motion: buffered sword input, faster release deceleration, a short hit-stop on meaningful impacts, eased deterministic camera shake, action-specific sound hooks, animated chest lids, fresh-press interaction handling, and a small health-change pulse. These are timing and feedback layers around the same named art slots, so final sprite sheets can replace the procedural silhouettes without changing gameplay tuning.

The combat visual pass keeps ordinary contact deliberately small: directional 2–6 pixel sparks, a sub-quarter-second ring, a brief white glint, light dust at the enemy's feet, and a short directional recoil. Wisp bolts, guardian volleys, shockwaves, and root lances use distinct silhouettes and leave a compact impact mark when they meet the world or player. Boss slams, phase breaks, and defeat moments are allowed a larger ring, stronger shake, and longer-lived motes so the hierarchy is clear without making every hit loud.

The boss event pass gives the Hollow Guardian a dedicated visual hierarchy: a larger grounded shadow, mantle-and-crown silhouette, readable heart core, authored altar backdrop, phase-specific arena lighting, fan/impact/lane telegraphs, rose phase-break shards, and a longer defeat payoff. These are runtime layers around the same hitboxes and cooldowns, so generated boss sheets can replace the temporary drawing without retuning the encounter.

The environment animation pass is bounded and layered: water uses a few clipped wave bands and short bank highlights, tree crowns drift independently over grounded shadows, grass patches use deterministic seeded blades, and only the nearest touched patch receives a rustle pulse and dust. Leaves, pollen, birds, butterflies, and fireflies stay sparse; outdoor-only updates are skipped in dungeon rooms to keep the canvas budget stable.

The dungeon graphics pass keeps the shrine on the same hand-painted foundation while shifting its identity to cool charcoal stone, blue-green moss, muted brass, and selective rose danger light. Each room now has a recognizable composition: root ribs and brass memory in the gallery, a moon-aligned machine and channel in the switch hall, paired statues in the warden garden, a leaking flood vault, ember trenches and sootglass machinery in the antechamber, and a three-ring statue altar in the sanctum. Structural obstacles retain their gameplay rectangles but render as layered stone, caps, cracks, and rubble; hazards add readable lips, edges, and localized motion without changing damage rules.

The game code owns collision, state, camera, and layout. Art replacements should preserve the named anchor points in `mosswake.js` so content remains editable and performance stays predictable.

## ART DIRECTION GUIDE

Mosswake is a hand-painted storybook adventure viewed from an orthographic top-down camera with a gentle 3/4 silhouette. Every future graphic should follow these rules:

- **Perspective and scale:** show the top plane and one readable front face; feet, props, and building bases share the same ground plane. A player is roughly 28 px tall in the 960×600 canvas; common props stay between 24–96 px.
- **Light and shadows:** the key light comes from the upper-left/front. Highlights sit on upper-left planes; soft shadows fall down-right with a small offset and fade at the edges. Do not bake hard black shadows into assets.
- **Silhouettes and outlines:** favor simple, distinctive shapes with a restrained deep-moss ink edge (about 2 px at gameplay scale). Use rounded joins and avoid noisy interior linework.
- **Palette:** outdoor materials live in moss greens, parchment paths, muted wood, and moonlit teal water. Dungeon materials shift darker and cooler, with mint glyph light. Gold is reserved for rewards and lantern light; rose is reserved for boss danger and phase changes.
- **Saturation and contrast:** keep terrain mid-value and slightly desaturated so characters, interactables, and telegraphs read first. Reserve the highest saturation and brightest value for player feedback, secrets, and rewards.
- **Texture:** use a few deliberate material marks (grain, masonry cracks, ripples, leaf veins) rather than uniform procedural noise or repeated high-contrast tiles.
- **Effects:** particles, telegraphs, and sword arcs inherit the same mint/gold/rose accent colors. Effects should be additive and brief, never a competing texture layer.
- **UI:** use the same dark-green glass surfaces, parchment text, mint navigation accents, and gold reward accents as the world. Typography remains Outfit for display and DM Mono for labels/control hints.

If a new asset cannot follow these rules cleanly, keep the current procedural placeholder and add the replacement to the prioritized list above instead of introducing a second visual language.
