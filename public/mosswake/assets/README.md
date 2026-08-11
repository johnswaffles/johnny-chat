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
| `enemies/` | `mossling`, `moon-wisp`, `rootling` | 48×48, 4 idle frames, hit silhouette |
| `bosses/` | `root-warden`, `hollow-guardian` | 128×128, telegraph + hurt + defeat frames |
| `npcs/` | `rowan`, `outpost-trader` | 64×80, idle + talk frames |
| `terrain/` | `grass`, `path`, `water`, `stone-floor`, `stone-wall` | 96×96 seamless tiles |
| `trees/` | `oak`, `birch`, `ancient-root` | 128×160, 2 seasonal variants |
| `plants/` | `mothflower`, `fern`, `reed`, `mushroom` | 48×48, 2 sway frames |
| `rocks/` | `moss-rock`, `rune-stone`, `breakable-bramble` | 64×64, intact + broken |
| `buildings/` | `outpost`, `shrine`, `cabin` | 256×192, roof/wall/door layers |
| `dungeon/` | `room-border`, `gate`, `switch`, `chest`, `heartseed` | 96×96 modular pieces |
| `weapons/` | `lantern-blade`, `impact-arc` | 96×48, 5 attack frames |
| `items/` | `brass-key`, `heartseed-shard`, `moth-token` | 32×32, 2 glow frames |
| `effects/` | `slash`, `dash-trail`, `hit-spark`, `telegraph`, `portal` | 96×96, transparent sprite sheets |
| `ui/` | `heart`, `key`, `map-marker`, `dialogue-frame` | 48×48 / 9-slice frame |

## Art TODO

1. Replace player and enemy silhouettes with a consistent hand-painted sprite pass.
2. Add four-direction walk/attack frames and a readable rose telegraph for boss attacks.
3. Paint modular terrain edges so paths, pond banks, and dungeon doors tile without seams.
4. Add three unique building facades for the outpost, shrine, and cabin while preserving their collision footprints.
5. Add small looping effects: water shimmer, moth glow, torch smoke, sword arc, and chest sparkle.
6. Export at 2x resolution with transparent backgrounds and avoid baked-in shadows; lighting is runtime-driven.

The game code owns collision, state, camera, and layout. Art replacements should preserve the named anchor points in `mosswake.js` so content remains editable and performance stays predictable.
