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

## Temporary feel pass

The current movement, outdoor, and enemy passes intentionally use the same art-first, replaceable approach as First Ember: the player, blade arc, dodge trail, dust, hit stars, impact rings, shadows, trees, plants, water edge, wildlife, enemy silhouettes, telegraphs, and drops are generated as crisp canvas primitives. This keeps the first encounters readable while final sprite sheets are being painted. The named slots above are the exact custom graphics to generate later; no gameplay collision, pathing, AI behavior, or timing depends on a temporary shape.

The latest art-direction pass adds restrained inked silhouettes, more varied grass and stone texture, authored roof/facade trim, shoreline foam, chest construction details, and a shared shadow/outline language. These are intentionally small runtime treatments: they improve value hierarchy and object scale now while leaving the final custom PNG/WebP slots replaceable.

The game code owns collision, state, camera, and layout. Art replacements should preserve the named anchor points in `mosswake.js` so content remains editable and performance stays predictable.
