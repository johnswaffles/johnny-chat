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
| `npcs/` | `rowan`, `outpost-trader` | 64×80, idle + talk frames |
| `terrain/` | `grass`, `path`, `water`, `stone-floor`, `stone-wall` | 96×96 seamless tiles |
| `trees/` | `oak`, `birch`, `ancient-root`, `grove-canopy` | 128×160, 2 seasonal variants, back/mid/foreground silhouettes |
| `plants/` | `mothflower`, `fern`, `reed`, `mushroom`, `meadow-tuft` | 48×48, 2 sway frames, touched/rustled variation |
| `rocks/` | `moss-rock`, `rune-stone`, `shore-stone`, `breakable-bramble` | 64×64, intact + broken |
| `landmarks/` | `fallen-log`, `lantern-post`, `trail-sign`, `pond-edge` | 96×96 modular pieces, transparent shadows |
| `wildlife/` | `butterfly`, `songbird`, `firefly` | 32×32, 4-frame loops, warm/cool color variants |
| `enemy-effects/` | `charge-ring`, `ranged-line`, `ambush-reveal`, `drop-mote` | 96×96 transparent sheets, readable at gameplay scale |
| `buildings/` | `outpost`, `shrine`, `cabin` | 256×192, roof/wall/door layers |
| `dungeon/` | `room-border`, `gate`, `switch`, `chest`, `heartseed` | 96×96 modular pieces |
| `weapons/` | `lantern-blade`, `impact-arc` | 96×48, 5 attack frames |
| `items/` | `brass-key`, `heartseed-shard`, `moth-token` | 32×32, 2 glow frames |
| `effects/` | `slash`, `dash-trail`, `hit-spark`, `telegraph`, `portal` | 96×96, transparent sprite sheets |
| `ui/` | `heart`, `key`, `map-marker`, `dialogue-frame` | 48×48 / 9-slice frame |

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

## Temporary feel pass

The current movement, outdoor, and enemy passes intentionally use the same art-first, replaceable approach as First Ember: the player, blade arc, dodge trail, dust, hit stars, impact rings, shadows, trees, plants, water edge, wildlife, enemy silhouettes, telegraphs, and drops are generated as crisp canvas primitives. This keeps the first encounters readable while final sprite sheets are being painted. The named slots above are the exact custom graphics to generate later; no gameplay collision, pathing, AI behavior, or timing depends on a temporary shape.

The game code owns collision, state, camera, and layout. Art replacements should preserve the named anchor points in `mosswake.js` so content remains editable and performance stays predictable.
