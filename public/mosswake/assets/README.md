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

The optional `player`, `boss`, `enemy-*`, `tree-back`, `tree-mid`, `tree-front`, `projectile-*`, and `fx-slash` keys already have renderer hooks. No gameplay code needs to change when an approved replacement is swapped in; add a manifest entry and keep the same anchor and cell dimensions.

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

The first-section renderer is visually coherent and performance-safe, but its important silhouettes are still procedural by design. The only graphics that block a genuinely final custom-art pass are the ten ranked replacements in **GRAPHICS TO GENERATE NEXT** below, led by the player, Hollow Guardian, combat FX, water, trees, dungeon architecture, and NPCs. The older broad wishlist has been removed so this document does not imply that dozens of small assets are release blockers.

Until those files exist, the procedural renderer remains the intentional fallback for player/enemy bodies, NPC portraits, props, terrain, water, dungeon structure, item icons, and effects. It is readable and polished enough for playtesting, but those specific categories should not be described as final custom artwork.

## GRAPHICS TO GENERATE NEXT

Ranked by visible impact on the playable vertical slice. Export transparent PNG/WebP unless marked opaque, keep cast shadows and lighting out of the files, and preserve the shared ground anchor so the runtime can continue to own collision and lighting.

1. **Hollow Guardian event sheet** — `160×160 px` transparent cells; phase-I and phase-II 3/4 top-down silhouettes with 6 idle/orbit, 5 attack anticipation, 4 hit, 4 phase-break, and 8 defeat frames. One aligned sprite sheet, with phase II exposing a rose heart, cracked mantle plates, and floating shards. Used in the Heartseed Sanctum boss arena. This is the strongest single replacement because the boss is the climax and currently carries the most procedural visual weight. Prompt: “Hand-painted storybook top-down action-adventure boss sprite sheet, Hollow Guardian, broad ancient mantle and crown-like antlers, readable glowing heart core, phase one moss-slate armor and phase two broken rose-magenta armor, orthographic 3/4 view, clean deep-moss ink outline, upper-left parchment light, no cast shadow, transparent background, centered 160x160 cells, six idle/orbit poses, five readable attack anticipation poses, four hit recoil poses, four phase-break transformation poses, eight defeat-collapse poses, consistent feet anchor, game-ready sprite sheet, no text, no UI.”
2. **Warden player sheet** — `96×96 px` transparent cells; four directions with 6 idle, 8 walk, 6 sword, 5 dodge, and 4 hurt/recovery frames. One aligned sheet, feet on a shared 72 px ground line. Used everywhere the player appears. This replaces the small placeholder figure that anchors every minute of play. Prompt: “Hand-painted storybook top-down hero sprite sheet, young lantern warden adventurer with teal coat, warm parchment face, dark moss hair, compact readable proportions, small lantern-blade, orthographic 3/4 top-down, four facing directions, clean 2 px deep-moss ink outline, upper-left light and soft muted colors, transparent background, 96x96 cells, six idle, eight walk, six sword swing, five dodge roll, four hurt and recovery frames, feet aligned to one ground line, no cast shadow, no text.”
3. **Lantern-blade combat FX** — `192×128 px` transparent cells; 8 sword-sweep frames, 4 contact sparks, 6 Rootlight pulse frames, 2 glow-mask frames. Separate sprite sheet from the player body. Used for every sword strike and the signature lantern ability. It would make the first ten seconds feel authored instead of procedural. Prompt: “Minimal hand-painted fantasy combat effects sprite sheet, lantern-blade slash arcs in warm gold, cream contact glints, mint Rootlight pulse rings, transparent background, no characters, no cast shadow, crisp readable silhouettes at small scale, 192x128 cells, eight sequential sword sweep frames, four directional contact spark frames, six expanding Rootlight pulse frames, two soft glow masks, restrained particles, same moss-green storybook palette, no text.”
4. **Guardian arena and pylon kit** — `256×256 px` transparent modular cells; altar, four pylon bodies/crystals, ring segments, phase-II rose spokes, and spent debris in quiet/charged/rose/spent states. Separate images or a modular sheet; no baked floor shadows. Used in the Heartseed Sanctum. This turns the boss room from runtime geometry into a memorable landmark. Prompt: “Modular hand-painted ancient shrine arena prop sheet, broken Heartseed Sanctum altar, guardian pylons with faceted crystals, circular rune ring segments, phase-two rose energy spokes, spent cracked debris, orthographic 3/4 top-down, transparent background, upper-left parchment light, deep charcoal stone with moss, muted brass, selective mint and rose accents, no cast shadows, 256x256 modular cells, quiet charged rose spent variants, separable layers, no text.”
5. **Boss telegraph and defeat FX** — `192×192 px` transparent cells; 6 volley fan arcs, 6 slam rings, 5 dash-lane markers, 6 Rootlight exposure cracks, 8 phase-break shards, 10 defeat motes. One effect sheet with a consistent center anchor. Used for boss attacks and the victory payoff. This improves readability and spectacle without changing timings. Prompt: “Hand-painted top-down boss telegraph and payoff effects sheet, clear rose and gold attack fan arcs, expanding slam rings, parallel dash lanes, mint Rootlight cracks, angular phase-break shards, elegant defeat motes, transparent background, no cast shadow, 192x192 cells, six volley frames, six slam frames, five dash marker frames, six exposure frames, eight phase-break frames, ten defeat frames, crisp readable silhouettes, restrained glow, no text.”
6. **Water and shoreline kit** — opaque `128×128 px` seamless water tiles plus transparent `128×64 px` shoreline overlays; 6 ripples, 4 foam/edge frames, 3 reflected-light frames. Separate tile and edge sheets. Used by the outdoor pond and flooded vault. Water is one of the largest continuous surfaces, so a painted tile would remove the strongest repeated-procedural read. Prompt: “Hand-painted storybook pond water tile set, orthographic top-down, deep moonlit teal water with subtle layered ripples, broken shoreline foam, small reflected sky streaks, muted moss and parchment palette, opaque seamless 128x128 water tile plus transparent 128x64 shoreline overlay cells, six ripple frames, four foam frames, three reflection frames, no cast shadow, no grass crossing the water, no text.”
7. **Layered tree family** — `192×240 px` transparent cells; oak, birch, and ancient-root back/mid/front canopy layers with 4 sway frames each and a 2-frame dapple mask. Separate trunk, canopy, and shadow layers. Used throughout Lanternwood. Trees occupy the frame edges and establish depth; better silhouettes will make the whole outdoor region feel authored. Prompt: “Hand-painted storybook top-down 3/4 tree family, oak, birch, and ancient-root variants, chunky readable trunks, layered canopies for background midground foreground overlap, moss-green foliage with parchment highlights, deep-moss ink edge, upper-left light, transparent background, 192x240 cells, four subtle sway frames per layer, separate two-frame dapple-light mask, trunk and canopy separable, no baked cast shadow, no text.”
8. **Outdoor foliage interaction pack** — `96×96 px` transparent cells; meadow tuft, fern, reed, flower cluster, mushroom, fallen log, and breakable ivy, each with 2 idle and 3 player-rustle frames. One aligned modular sheet. Used in paths, clearings, pond edges, hidden grove, and secrets. It adds handcrafted variation while preserving existing collision footprints. Prompt: “Hand-painted modular Lanternwood foliage prop sheet, meadow grass tuft, fern, reed, small flower cluster, mushroom, fallen log, tangled breakable ivy, orthographic 3/4 top-down, transparent background, muted moss greens with occasional dusty pink and gold flowers, deep-moss ink outline, upper-left light, 96x96 cells, two idle frames and three player-rustle frames per prop, shared ground anchor, no cast shadows, no text.”
9. **Dungeon architecture and landmark kit** — `192×192 px` transparent modules; wall caps, arches, pillars, stairs, cracked lintels, statues, root ribs, carvings, and rubble in 4 stone variants and 3 damage states. Modular sheet with separate highlight/occlusion layers. Used across all six shrine rooms. This is the highest-impact non-character pass because it gives the dungeon a real constructed identity. Prompt: “Hand-painted ancient shrine dungeon modular architecture sheet, charcoal stone wall caps, four-way arches, damaged pillars, short stairs, cracked lintels, guardian statue fragments, roots breaking through masonry, brass carvings and rubble, orthographic 3/4 top-down, transparent background, cool charcoal and blue-green moss with muted brass, mint glyph accents, upper-left light, 192x192 modular cells, four stone variants, three damage states, separate highlight and occlusion layers, no baked cast shadow, no text.”
10. **NPC presentation set** — `80×96 px` transparent top-down cells for Rowan, Tansy, Brindle, and Lumen; 4 directions, 4 idle/walk, 3 work, 2 reaction, 3 talk frames each, plus `128×128 px` transparent bust portraits with neutral/talking/event expressions. Separate character sheets and portraits. Used in the outpost, shrine, and dialogue UI. This replaces the generic letter/shape portraits and makes the world’s named characters memorable. Prompt: “Hand-painted storybook NPC character set for a top-down adventure, Rowan, Tansy, Brindle, and Lumen, each with a distinct silhouette, clothing palette, tool or prop, warm parchment faces, moss-green ink outline, orthographic 3/4 top-down, transparent background, four directions, four idle/walk frames, three work frames, two reaction frames, three talk frames at 80x96 cells, plus 128x128 bust portraits with neutral talking and event expressions, shared upper-left light, no text, no cast shadows.”

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
