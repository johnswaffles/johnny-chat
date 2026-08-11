# Mosswake asset map

Mosswake currently renders its first playable slice with layered canvas primitives so the adventure stays fast, readable, and playable without a download step. These folders are the replaceable art slots for the next art pass; keep transparent PNG/WebP files in the listed slots and the renderer can be pointed at them without changing game rules.

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

## Art TODO

1. Replace player and enemy silhouettes with a consistent hand-painted sprite pass.
2. Add dedicated four-direction idle/walk/attack/hurt/death frames for mossling, thornback, moon-wisp, and ambush-moth.
3. Paint a 6–8 frame `weapons/lantern-blade` swing sheet with a clean leading edge and contact spark.
4. Paint `enemy-effects/charge-ring`, `ranged-line`, `ambush-reveal`, and `drop-mote` sheets so telegraphs and rewards feel authored.
5. Add `effects/dust`, `effects/hit-star`, `effects/impact-ring`, and `effects/dash-trail` sheets at 2x resolution.
6. Paint modular terrain edges so paths, pond banks, and dungeon doors tile without seams.
7. Add back/mid/foreground tree silhouettes, meadow tufts, shoreline reeds, fallen logs, and landmark props as separate layers.
8. Add three unique building facades for the outpost, shrine, and cabin while preserving their collision footprints.
9. Add small looping effects: water shimmer, moth glow, fireflies, butterfly wings, songbird flaps, torch smoke, sword arc, and chest sparkle.
10. Export with transparent backgrounds and avoid baked-in shadows; lighting, hit flashes, camera response, and enemy telegraphs are runtime-driven.
11. Paint exploration-specific props as modular layers: a low-contrast three-stone clue trail, a tangled ivy gate with a readable broken state, a chest silhouette that can be glimpsed before it is reachable, and small chart/lens/seed pickup icons.
12. Keep secret props visually discoverable through composition rather than UI markers: use value contrast, a gap in the reeds, a warm glint, and a distinctive landmark silhouette instead of arrows or floating labels.
13. Paint NPCs as modular sprite families: each character needs a silhouette that reads at gameplay scale, a four-direction idle/walk set, a small work loop, and a talk portrait that preserves the same palette and face shape.
14. Keep portrait backgrounds transparent and expression-driven. The temporary letter portraits in the dialogue box are placeholders for these four named files, so art can be swapped without touching dialogue timing, state checks, or interaction ranges.
15. Dungeon art pass: paint six room kits with a shared ancient-stone trim but distinct silhouettes — root ribs and brass chest for `root-gallery`, moon shafts and silver disk for `moon-hall`, circular root arena for `warden-garden`, shallow water and heartseed chest for `flooded-vault`, ember trenches and a sootglass cache for `ashen-antechamber`, and a three-ring altar for `heartseed-sanctum`.
16. Add modular dungeon atmosphere sheets: `torch-flame`, `torch-smoke`, `water-ripple`, `ember-vent`, `moss-vine`, `stone-crack`, `door-lock`, `door-open`, and `room-transition`. Keep all lighting and particles unbaked so the runtime can animate them.
17. Signature item art: paint a `moonwake-lantern` held/orbiting sprite with a warm inner ember and mint ring, plus a 6–8 frame `rootlight-pulse` effect. The temporary canvas version is intentionally shape-readable so the item can be swapped without changing the L-key ability, node anchors, or boss timing.
18. Paint `rootlight-seal` states (dormant, awakened, broken) and a `moonroot-cache` open/closed pair. These props should look like environmental discoveries, not quest markers: low contrast before the lantern and a warm response after the pulse.
19. Boss presentation pass: paint `hollow-guardian` phase-I and phase-II sprite sheets (128×128, 6 idle/turn frames, 4 hit frames, 8 collapse frames) with a readable rose “heart unbound” silhouette for phase II.
20. Paint the Heartseed Sanctum set pieces as separate layers: four `guardian-pylon` states (quiet, charged, phase-II, spent), `boss-arena-rings`, and a `heartseed-echo` reward sprite. Keep the four pylons modular so the arena can be reused in later shrine rooms.
21. Paint authored boss telegraphs and payoff effects: `guardian-volley`, `guardian-slam`, `guardian-dash`, `rootlight-exposure`, `guardian-phase-break`, and `guardian-defeat` sheets. The current canvas primitives are temporary readability assets and can be swapped without changing attack timing or hitboxes.
22. Paint a lighting-only modular set: `torch-flame`, `torch-smoke`, `lantern-glow`, `campfire-flame`, `sun-shaft`, `canopy-dapple`, `dungeon-fog`, and `room-transition` masks. Keep the masks transparent and shadow-free so the browser can tint, pulse, and composite them per room.
23. Character presentation pass: paint facing-aware sheets for the warden, mossling, thornback, moon-wisp, ambush-moth, Root Warden, Hollow Guardian, Rowan, Tansy, Brindle, and Lumen. Keep feet aligned to one ground line and export anticipation, hurt, and defeat frames separately from the base idle/walk loops.
24. Combat feedback pass: paint a compact `combat-sparks` sheet (64×64 transparent, 6 directional shards), a `combat-ring` sheet (96×96 transparent, 4 expanding frames), and an `impact-glint` sheet (48×48 transparent, 3 crisp frames). Keep these small and fast so ordinary sword hits read as contact rather than an explosion.
25. Projectile pass: paint separate `moonbolt`, `rosebolt`, `shockwave`, and `root-lance` sheets at 64×32 transparent cells. Provide 4 travel frames and 3 impact frames for each, with a clear leading point and a short tapered trail that matches its gameplay direction.
26. Enemy recoil/death pass: paint 4 hit-recoil frames and 6 defeat frames per outdoor enemy at 80×80 transparent cells, plus a 128×128 transparent `guardian-slam-ring` and `guardian-phase-break` sheet. Keep impact bursts centered on the enemy ground anchor so runtime knockback and shadows stay aligned.
27. Environment motion pass: paint a 128×128 seamless water surface with 6 ripple frames, 4 shoreline foam frames, and 3 reflected-light frames; keep the shoreline overlay separate from the opaque tile so pond shapes remain editable.
28. Tree silhouette pass: paint back/mid/front canopy families at 192×240 transparent cells for oak, birch, and ancient-root variants. Provide 4 sway frames per layer plus a 2-frame dapple mask; keep trunks and ground shadows separate.
29. Grass interaction pass: paint 96×96 transparent meadow, fern, reed, flower, and weed clusters with 2 idle frames and 3 player-rustle frames. Preserve a shared ground anchor so the runtime can trigger contact motion without changing collision footprints.

## CUSTOM GRAPHICS TO GENERATE NEXT

Prioritized by visual impact on the playable demo. All files should be exported with premultiplied-alpha-safe transparent backgrounds and no baked-in cast shadows; runtime lighting and camera response remain in `mosswake.js`.

1. **Hollow Guardian hero sheet** — `160×160 px` cells, transparent PNG/WebP, orthographic 3/4 top-down with four facing directions. Phase I and II palettes on one aligned sheet; 6 idle/orbit frames, 4 hit/recoil frames, 8 defeat-collapse frames, and 4 phase-break frames.
2. **Warden player sheet** — `96×96 px` cells, transparent, four directions (N/E/S/W). 6 idle frames, 8 walk frames, 6 sword frames, 5 dodge frames, 3 hurt frames; keep feet on a shared 72 px ground line for clean shadow placement.
3. **Lantern-blade combat effects** — `192×128 px` transparent cells, direction-agnostic radial slash with a separate 4-direction contact variant. 8 swing frames, 4 hit-spark frames, 6 Rootlight pulse frames, plus a 2-frame soft glow mask.
4. **Guardian arena kit** — `256×256 px` transparent modular layers: pylon body, pylon crystal, arena ring, phase-II spokes, and spent-state debris. Provide quiet/charged/rose/spent variants; no baked floor shadow.
5. **Boss telegraph and defeat effects** — `192×192 px` transparent sheets, top-down centered. 6 volley arcs, 6 slam rings, 5 dash lane markers, 6 mint Rootlight-exposure cracks, 8 phase-break shards, and 10 defeat motes.
6. **Water and shoreline tiles** — `128×128 px` seamless opaque water tiles plus `128×64 px` transparent shoreline overlays. Three water-depth palettes, 6 ripple frames, 4 foam/shore frames, and 2 reflected-light frames; tile in all directions.
7. **Layered tree and canopy set** — `192×240 px` transparent, orthographic 3/4. Back/mid/front silhouettes for oak, birch, and ancient-root trees; 4 sway frames per layer and separate 2-frame leaf shimmer masks.
8. **Foliage and environmental motion pack** — `96×96 px` transparent cells, top-down. Meadow tuft, fern, reed, flower cluster, mushroom, fallen log, and breakable ivy; 2 idle frames plus 3 player-contact/rustle frames for each.
9. **NPC portrait and sprite families** — `128×128 px` transparent bust portraits (neutral/talking/reacting, 3 frames each) and `80×96 px` transparent top-down sprites for Rowan, Tansy, Brindle, and Lumen (4 directions, 4 idle/walk frames, 2 work frames).
10. **Interface and reward icon set** — `64×64 px` transparent icons for heart/full-heart/empty-heart, key, Heartseed Echo, Moonwake Lantern, discovery, and map marker (2 glow frames each); plus a `960×160 px` transparent 9-slice dialogue/menu frame with 2 state accents (mint and rose).
11. **Unified terrain material kit** — `128×128 px` opaque seamless grass, compacted path, and dungeon floor tiles plus `128×64 px` transparent edge overlays. Keep one ink value, one upper-left highlight, and one lower-right occlusion pass across all materials; include 4 grass/path variants, 4 stone variants, 6 water ripples, and 4 shoreline frames.
12. **Lighting and atmosphere mask pack** — `256×256 px` transparent masks for torch/campfire/lantern pools, `384×256 px` transparent canopy sun-shafts, and `512×256 px` transparent dungeon fog wisps. Supply 4 flame frames, 4 smoke frames, 3 dapple frames, 4 fog frames, and 3 entrance/exit veil frames; keep shadows unbaked so runtime direction and falloff remain editable.
13. **Warden player character sheet** — `96×96 px` transparent cells, orthographic 3/4 top-down, four directions. Provide 6 idle frames, 8 walk frames, 6 sword frames (including a wind-up and contact frame), 5 dodge frames, 4 hurt frames, and 4 recovery frames. Keep the feet on a shared 72 px ground line and leave the sword hand unobstructed for runtime lighting.
14. **Outdoor enemy family sheet** — `80×80 px` transparent cells for mossling, thornback, moon-wisp, and ambush-moth. Each type needs 4 idle frames, 6 movement frames, 4 attack-telegraph frames, 3 hit-recoil frames, and 6 defeat frames. Preserve distinct silhouettes: round hopping body, low spiked shell, floating diamond wisp, and wide-wing moth; export one aligned sheet per type.
15. **Dungeon elite and boss sheets** — `128×128 px` transparent cells for Root Warden and `160×160 px` cells for Hollow Guardian. Root Warden: 4 idle, 6 guarded walk, 4 melee wind-up, 3 hurt, 6 defeat. Hollow Guardian: phase-I and phase-II palettes on aligned sheets with 6 orbit/idle, 5 volley/slam telegraph, 4 dash telegraph, 4 hurt, 8 phase-break/defeat frames. Keep the arena-facing silhouette readable at 1× scale.
16. **NPC presentation sheet** — `80×96 px` transparent top-down cells for Rowan, Tansy, Brindle, and Lumen: 4 directions, 4 idle/walk frames, 3 work frames, 2 reaction frames, and 3 talk frames. Add matching `128×128 px` transparent portrait busts with neutral, talking, and event expressions; use the same palette and light direction as the gameplay sprites.
17. **Combat contact FX sheet** — `64×64 px` transparent cells for `combat-sparks` (6 directional shards), `combat-ring` (4 expanding rings), and `impact-glint` (3 frames). Place at the enemy contact point above foreground layers; use short-lived mint/gold/rose accents with no baked shadow.
18. **Projectile family sheet** — `64×32 px` transparent cells for `moonbolt`, `rosebolt`, `shockwave`, and `root-lance`: 4 travel frames and 3 impact frames per type. Orient each sheet along its flight vector and keep a 2–4 px tapered trail so magic reads clearly at gameplay scale.
19. **Enemy reaction/death sheet** — `80×80 px` transparent cells per outdoor enemy: 4 recoil frames, 3 flash frames, and 6 defeat/dissolve frames. Keep feet on the same ground line as the base sheet; provide separate color accents for moss, thorn, wisp, and moth silhouettes.
20. **Boss impact and phase sheet** — `128×128 px` transparent cells for guardian slam rings, rose volley bursts, Rootlight exposure cracks, phase-break shards, and defeat motes. Supply 5–8 frames per effect, centered on the arena anchor, with a strong but controlled rose/gold hierarchy.
21. **Water surface and shoreline kit** — `128×128 px` opaque seamless water tile plus `128×64 px` transparent shoreline overlays. Provide 6 ripple frames, 4 foam/edge frames, and 3 reflected-light frames; use upper-left highlights and no baked cast shadow. Used by the outdoor ponds and flooded vault.
22. **Layered tree family** — `192×240 px` transparent back/mid/front cells for oak, birch, and ancient-root silhouettes. Supply 4 sway frames per layer and a 2-frame dapple mask; preserve a shared trunk/ground anchor for foreground overlap and runtime shadows.
23. **Grass and reed interaction pack** — `96×96 px` transparent cells for meadow tuft, fern, reed, flower cluster, weed, and shoreline grass. Provide 2 idle frames and 3 player-rustle frames per prop; used in outdoor clearings, pond edges, and the hidden grove.

## Temporary feel pass

The current movement, outdoor, and enemy passes intentionally use the same art-first, replaceable approach as First Ember: the player, blade arc, dodge trail, dust, hit stars, impact rings, shadows, trees, plants, water edge, wildlife, enemy silhouettes, telegraphs, and drops are generated as crisp canvas primitives. This keeps the first encounters readable while final sprite sheets are being painted. The named slots above are the exact custom graphics to generate later; no gameplay collision, pathing, AI behavior, or timing depends on a temporary shape.

The latest art-direction pass adds restrained inked silhouettes, more varied grass and stone texture, authored roof/facade trim, shoreline foam, chest construction details, and a shared shadow/outline language. These are intentionally small runtime treatments: they improve value hierarchy and object scale now while leaving the final custom PNG/WebP slots replaceable.

The major visual pass adds authored meadow color fields, compacted path wear and stepping stones, shoreline reflection marks, facade gradients and window bounce light, localized lantern/campfire/rootlight pools, atmospheric horizon haze, foreground leaf clusters, and a distinct focal medallion/light language for each dungeon room. These runtime layers are deliberately low-contrast and remain separate from gameplay state, so they can be removed or replaced by painted terrain, prop, and lighting assets one slot at a time.

The handcrafted outdoor pass replaces the evenly spaced read with authored composition anchors: clustered tree lines, small clearings, irregular shore stones, layered bushes, broken fences, two readable signposts, quiet ruins, cliff silhouettes, dappled canopy shadows, and local meadow clusters. The fixed anchors are intentional and editable; ambient motion (wind, leaf drift, water, insects, and soft shadow drift) is kept sparse so landmarks remain legible.

The lighting pass treats atmosphere as a composition system rather than a dark overlay: the overworld gets an upper-left sun direction, moving canopy gaps, warm landmark pools, and sparse dust motes; the shrine gets torch falloff, room-tinted pools, floor-hugging fog, localized edge falloff, and a vignetted entrance/exit veil. Contact shadows stay soft and offset down-right, and all effect counts are bounded for browser performance.

The character presentation pass keeps the same runtime-driven workflow: facing blends continuously, movement drives bob/stride, attack anticipation drives the sword pose and arc, enemy telegraphs compress or stretch silhouettes, and defeated enemies linger for a short dissolve/shard payoff. These are intentionally separate from hitboxes and AI state so generated sheets can replace each silhouette without retuning combat.

The professional-feel pass keeps that restraint in motion: buffered sword input, faster release deceleration, a short hit-stop on meaningful impacts, eased deterministic camera shake, action-specific sound hooks, animated chest lids, fresh-press interaction handling, and a small health-change pulse. These are timing and feedback layers around the same named art slots, so final sprite sheets can replace the procedural silhouettes without changing gameplay tuning.

The combat visual pass keeps ordinary contact deliberately small: directional 2–6 pixel sparks, a sub-quarter-second ring, a brief white glint, light dust at the enemy's feet, and a short directional recoil. Wisp bolts, guardian volleys, shockwaves, and root lances use distinct silhouettes and leave a compact impact mark when they meet the world or player. Boss slams, phase breaks, and defeat moments are allowed a larger ring, stronger shake, and longer-lived motes so the hierarchy is clear without making every hit loud.

The environment animation pass is bounded and layered: water uses a few clipped wave bands and short bank highlights, tree crowns drift independently over grounded shadows, grass patches use deterministic seeded blades, and only the nearest touched patch receives a rustle pulse and dust. Leaves, pollen, birds, butterflies, and fireflies stay sparse; outdoor-only updates are skipped in dungeon rooms to keep the canvas budget stable.

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
