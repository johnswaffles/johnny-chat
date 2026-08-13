# Hearthwild art pack

Hearthwild now ships a small custom illustrated pass layered over the procedural fallback. The simulation stays data-driven: art is selected by activity, building stage, resource state, and animal behavior, while missing or future assets automatically fall back to the original canvas shapes.

## Visual spec

- Camera: readable top-down 2D settlement view with a gentle storybook/isometric feel; 56px world cells and soft zoom.
- Proportions: expressive, slightly oversized villagers and compact 1–2 tile structures; important silhouettes stay readable at map scale.
- Treatment: warm hand-painted forms, crisp painted edges, restrained cel shading, woven cloth, bark, reed, clay, and pale stone detail.
- Palette: moss, fern, sage, bark brown, clay terracotta, wheat, river teal, ember gold, and moonlit blue-green, with a deliberately muted saturation range.
- Lighting: warm upper-right daylight, long soft grounding shadows, amber firelight, and blue night ambience; every custom sprite is designed to sit inside the same light family as the map.
- Layering: terrain and worn paths first, physical resources and props next, buildings by depth, animals, then villagers, badges, and weather/light overlays.
- Motion: identity atlases are 4×3 families and action atlases are 4×4 frame families; state selection is data-driven and canvas animation supplies bob, walk phase, wind, firelight, and weather response.

## Generated atlases

- `villagers/villager-atlas-v2.png` — 4×3 identity/activity/age atlas.
- `villagers/villager-motion-atlas-v2.png` — normalized 4×4 walk and carrying frames with four recurring villager identities; every frame shares the same foot line and has an isolated transparent cell.
- `villagers/villager-action-atlas-v2.png` — normalized 4×4 pickup, lift, place, and hammering frames with the same isolated-cell treatment.
- `buildings/building-atlas-v3.png` — 4×3 structures and construction stages.
- `animals/animal-atlas-v2.png` — 4×3 wildlife states and ambient life.
- `terrain/world-detail-atlas-v3.png` — resources, paths, puddles, fire/smoke, lantern, and birds.
- `props/growth-atlas-v1.png` — 4×3 stockpiles, tools, fences, planted beds, hearth dressing, and household details.
- `effects/micro-effects-atlas-v1.png` — 4×3 dust, chips, embers, leaves, splashes, pickup sparks, construction bursts, footprints, and smoke.

The replacement seams are kept explicit for future expansion:

- `construction/` — building-stage exports and demolition effects.
- `vegetation/` — tree, grass, reed, and regrowth variants.
- `resources/` — physical node families and depleted states.
- `props/` — lanterns, baskets, tools, piles, and settlement dressing.
- `effects/` — fire, smoke, dust, rain, ripples, and completion bursts.
- `ui/` — icons, portraits, badges, and discovery art.

The v2 villager identity, motion, and action atlases, v2 animal atlas, v3 building/world-detail/growth-prop atlases, and v1 effects atlas are the current production pass for the character, building, wildlife, settlement-growth, and simulation-motion seams. The procedural renderer still supplies terrain shading, seasonal variation, weather, firelight, trails, and any future states that are not yet represented by a sprite.

The previous v1 atlases remain in the asset folders as comparison/provenance references; they are not loaded by the runtime.

The source renders are kept in `atlas/` as regeneration references; runtime files are alpha PNGs with consistent 4×3 crops and compressed dimensions. The world-detail source retains its flat chroma-key background for repeatable regeneration, while the installed runtime file has the key removed.

Keep custom graphics grouped by role:

- `villagers/` — identity, walk, carry, pickup, drop, eat, rest, and build sheets.
- `trees/`, `vegetation/`, `resources/` — node families and depleted states.
- `buildings/` — foundation, frame, and completed structure stages.
- `terrain/` — meadow, clearing, water, shore, and path textures.
- `effects/` — flame, smoke, dust, gathering, and water motion.
- `ui/` — icons, portraits, badges, and milestone art.

The runtime loader lives in `render.js`; it loads the atlases opportunistically and keeps the game playable if a file is absent or still loading. The simulation remains independent of all art files.
