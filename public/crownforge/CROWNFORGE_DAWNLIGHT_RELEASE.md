# Crownforge — Dawnlight visual release

2026-09-04 · `20260904-dawnlight1`

## Three major upgrades

1. **A richer landscape.** Original meadow material and four transparent wildflower/grass variations; cached organic color patches; slow world-anchored cloud shadows; a softer map outline; restrained warm light and windborne seeds. Terrain decorations remain walkable and do not alter collision or resources.
2. **A living settlement.** A closer opening camera (28% instead of 16%); warm light and embers aligned with the Crown Hall braziers; chimney smoke and lantern light aligned with the Homestead; clearer grounded selection and order effects. Dawn, Daylight and Emberlight are visual moods, independent of the simulation clock. Reduced motion follows the system preference and can be changed in Atmosphere.
3. **A crafted command interface.** Parchment settlement intelligence, brass/teal framing, real building illustrations, an original painted loading scene, an interactive overview map, a Crown Hall camera shortcut, zoom buttons, a collapsible field journal and Full View mode. Small screens start with compact settlement intelligence and a scrollable two-column construction catalog. Existing travel/gathering controls remain available through Atmosphere.

## Player controls

- Atmosphere: lighting mood, ambient effects, reduced motion, travel and gathering controls.
- Full View / F: hide the interface. Escape or Return to Command restores it.
- Overview map: click to move the camera. Crown Hall / Home returns to the settlement.
- Settlement Intel and Field Journal: click their headings to expand or collapse.
- Existing selection, build, gather, combat, save/load and camera controls continue to work.

## Verification

- Build passed (`npm run build`); syntax checks and whitespace checks passed.
- `tools/dawn-visual-regression.mjs` passed: projection/placement coordinates, cursor-centered zoom, gradient caching, reduced motion, hearth lifecycle, effects toggle and expiry of offscreen order effects.
- `tools/roster-animation-regression.mjs` passed for 12 units, 38 roster atlases and all four directional mappings.
- Separate baseline comparison used the previous release (`eb75540`) with identical seed and commands: exact save-state equality at match start and after 120 seconds of gathering, movement, construction and enemy updates. Old-save load, resources and population compatibility passed.
- Browser verified: Homestead placement, worker travel, completed construction and housing increasing from 24 to 30; Gold gather orders; save and restore; overview travel and return; Full View and Escape; Emberlight and reduced motion; desktop and 390 × 844 layouts; no browser warnings/errors during local testing.
- Local desktop renderer sample before the final flora pass: average 0.55 ms, 95th percentile 0.80 ms. This is a local sample, not a guarantee across devices.
- Two old suites contain pre-existing assertions incompatible with the current release: the large remediation suite expects every military walk to contain three frames, while the approved Hidewall uses four playback frames; the old gather suite expects a `wildwood` size tier that is absent from both baseline and updated starts. These were not represented as passing. Dedicated current roster checks, gameplay parity and browser construction/gather checks were used instead.

## Artwork provenance and saved assets

All three new assets were created with the built-in image-generation tool, with no external stock art. Existing unit and building artwork was preserved. Files are saved in `games/crownforge/assets/` and mirrored in `public/crownforge/assets/`:

- `crownforge-meadow-dawn-v1.png` — 1254 × 1254 meadow material.
- `crownforge-meadow-flora-v1.png` — 1254 × 1254, RGBA, 2 × 2 ground-cover atlas.
- `crownforge-dawn-valley-v1.png` — 1536 × 1024 original landscape illustration.

## Generation prompts

### Meadow

Use case: stylized-concept. Asset type: seamless square ground material for Crownforge, an original hand-painted historical strategy game. Generate a beautiful, naturally varied, perfectly tileable meadow GRASS TEXTURE, edge-to-edge 1536x1536. True orthographic overhead flat material, no horizon, no perspective. Soft painterly dark sage and fern-green short grass, muted olive and moss transitions, very sparse tiny warm dried blades and a few tiny clover flecks. Large softly interlocking organic patches of varied green create depth without a repeating recognizable motif. Luxurious detailed brushwork like finely painted environment art, clean and readable when zoomed out. Neutral soft ambient lighting without baked directional shadows. Restrained low contrast: units and buildings will be drawn above it. Every part walkable meadow. NO trees, bushes, rocks, paths, buildings, water, sky, text, UI, border, vignette, dramatic highlights, checkerboard, or isolated objects. Seamless edges. This must work as an actual repeating game terrain texture, not a concept scene.

### Dawn valley

Use case: stylized-concept. Asset type: original Crownforge historical strategy game landscape painting for a loading screen and small command-panel banner. Create an exquisite wide 3:2 painterly panorama: a humble first-age timber Crown Hall with steep golden thatch roofs, teal pennants and honey-colored timber framing nestled in a vast lush emerald-and-sage valley. Small timber homesteads below, a winding worn earth footpath toward a distant pine forest, layers of hazy blue-green hills. An intimate hopeful settlement at dawn, not a giant stone castle. Warm morning light from upper left, luminous mist in distant valley, soft clouds, tiny birds. Visual hierarchy: dramatic soft light in sky upper half, the detailed wooden hall in the lower right third, quiet muted dark foliage and negative space lower left for overlaid interface text. Hand-painted premium game illustration, beautiful original art, earthy material texture, measured restrained golden highlights, rich forest greens and charcoal teal shadows. Elevated three-quarter camera, finely authored silhouettes. No text, no letters, no UI, no border, no logos or watermark. No photorealism, no cartoon outlines, no fantasy magic.

### Meadow flora

Use case: stylized-concept. Production asset: transparent 2 by 2 sprite atlas of FOUR different LOW MEADOW GROUND-COVER CLUMPS for Crownforge, an original hand-painted historical strategy game. 1024 x 1024 square image with actual transparent alpha background. Four equally sized square cells, exact 2x2 grid with generous transparent padding around each clump, absolutely no labels or grid lines. In each cell one wide low clump occupies central 75% width and middle-lower 45% height, ground baseline at 82% of cell height. Top left: soft fine sage-green meadow grass and tiny white clover flowers. Top right: a low tuft of fern-green blades with small butter-yellow wildflowers. Bottom left: several low silvery-green meadow leaves with tiny dusty lavender blossoms. Bottom right: a sparse low clump of fine straw-gold wild grass and olive clover. Elevated orthographic three-quarter isometric camera, 2:1 ground projection, warm upper-left illumination, painterly natural materials matching a richly detailed timber-and-thatch strategy settlement. Delicate, graceful, naturally irregular silhouettes. These are decorative walkable flora only: no trees, large shrubs, boulders, crops, tools, buildings or characters. No dirt islands or circular ground discs, no hard shadow, no colored background, no checkered background, no matte halo. Transparent everywhere between individual leaves and stems. All four grounded clumps evenly spaced in their cells, no overlap.
