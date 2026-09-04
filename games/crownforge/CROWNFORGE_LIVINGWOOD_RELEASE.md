# Crownforge — Livingwood

Build: `20260904-livingwood1` · 2026-09-04

The flat meadow and repeated twelve-tree planting stamps have been replaced with a layered landscape and eight individually painted tree species. New worlds grow through a seeded density field with irregular stands, open glades, and a winding, individually harvestable woodland divide. Existing saves keep every resource and unit position and receive the new rendering.

## What changed

- Ground blends four original materials: short green meadow/clover, dry meadow, leaf litter and moss. Broad color variation and small grass blades follow world coordinates. Forest-floor masks follow the actual living trees and recede when trees are cleared. Cached material mip levels prevent sparkling grain at distant zoom.
- Oak, birch, Scots pine, spruce, beech, oak sapling, leaning ash and juniper replace the former four-tree family. Species grow in loose neighborhoods with intermixed companions and varied mature sizes. Authored light direction is retained without mirroring. Tree size stays constant while harvesting; the final haul removes the tree normally.
- Redcurrant and blackberry thickets have new full and picked artwork, real alpha transparency, visible woody stems and irregular silhouettes. Their click targets match the new paintings.
- The two faction clearings, regional resources, individual 240-wood harvest contract, units, structures and save format remain intact. New forest placement changes routes and total available woodland. Five tested seeds contain 2,392–2,651 independent trees.

## Validation

- `tools/livingwood-regression.mjs`: five seeded worlds; determinism; eight species; bounded forest population; no duplicate trunks; protected clearings; continuous blocker overlap to both map edges; faction separation; a traversable route after clearing; six minutes each of food/wood harvesting and delivery; exact resource-state save/load.
- `tools/dawn-visual-regression.mjs`: camera projection/zoom, cached lighting, reduced motion, hearth lifecycle and effect cleanup.
- `tools/roster-animation-regression.mjs`: twelve units, 38 atlases and directional mappings.
- Prior-release save tested against the archived predecessor: resource and unit arrays preserved exactly on load.
- PNG alpha and source bounds inspected. The two adjacent lower trees in sheet B use a source-gutter clip to exclude neighboring leaves without cutting either silhouette. No placeholder assets are shipped.
- Browser inspection covers ordinary settlement zoom, close berry inspection and actual gathering clicks, detailed woodland, and whole-map view. Diagnostics and live release confirmation are recorded in the task result.
- The older remediation/gather omnibus scripts retain the pre-existing retired-forest/animation assumptions documented in `CROWNFORGE_DAWNLIGHT_RELEASE.md`; they are not reported as passing.

## Saved artwork and provenance

Generated with the built-in image-generation tool; original project artwork, no external stock imagery. Selected outputs are saved in `games/crownforge/assets/` and mirrored in `public/crownforge/assets/`:

| Asset | Size | Use |
|---|---|---|
| `crownforge-livingwood-ground-v1.png` | 1254 × 1254 RGB | Four terrain materials |
| `crownforge-livingwood-trees-a-v1.png` | 1230 × 1278 RGBA | Oak, birch, pine, spruce |
| `crownforge-livingwood-trees-b-v1.png` | 1224 × 1285 RGBA | Beech, sapling, ash, juniper |
| `crownforge-livingwood-berries-v1.png` | 1536 × 1024 RGBA | Two berry families, full and picked |

## Exact selected generation prompts

### Trees A

Create a transparent-background PNG sprite sheet. REAL ALPHA TRANSPARENCY, no checkerboard pattern and no solid background. Four fully isolated natural woodland tree sprites in a strict 2 by 2 layout with very generous empty space. Each sprite occupies only the middle 65% of its 2x2 cell, with at least 17% blank transparent padding around all sides. All four sprites complete, none cropped. Consistent elevated orthographic three-quarter view, warm upper-left light, dark blue-green shadows. Painterly realism for a beautiful medieval strategy game, fine natural foliage, believable asymmetrical branching, no plastic smoothness, no yellow-gold leaf coloration. TOP LEFT ancient sprawling green oak, broad deeply lobed irregular crown and crooked trunk. TOP RIGHT tall airy silver birch, white trunk and fine hanging pale sage green leaves. BOTTOM LEFT Scots pine, irregular exposed red-brown trunk and flat branching dark green canopy. BOTTOM RIGHT tall blue-green spruce, irregular natural boughs. Every tree different in silhouette and height. No ground, no dirt patches, no shadows, no labels, no grid lines. The source will be sliced into FOUR EQUAL RECTANGLES so all pixels of each tree must stay within its own quarter, leaving generous empty margins. Generate with transparent background enabled.

### Trees B

Create a transparent-background PNG sprite sheet. REAL ALPHA TRANSPARENCY, no checkerboard pattern and no solid background. Four fully isolated natural woodland tree sprites in a strict 2 by 2 layout with generous empty space. Every complete sprite MUST stay inside its own quarter with 10% transparent margin, never crossing the horizontal or vertical midline. Consistent elevated orthographic three-quarter view, warm upper-left light, cool blue-green shadows. Detailed painterly realism for a beautiful premium medieval strategy game, natural layered fine foliage, rough bark and believable asymmetrical branching, no plastic smoothness, no yellow-gold leaves. TOP LEFT broad mature beech with rounded but uneven lobed green crown, smooth grey trunk, two sweeping branches. TOP RIGHT small slender young oak with sparse green crown, light through gaps, narrow crooked trunk, distinctly a sapling. BOTTOM LEFT old leaning ash with a wide airy divided sage-green crown, exposed arching branches and dramatic crooked trunk. BOTTOM RIGHT a low wide windswept juniper, twisted reclining trunk, irregular blue-green needled branch clusters, wider than tall. Each tree has a different silhouette and believable size. NO ground islands, NO dirt patches, NO shadows, NO labels, NO grid lines, NO black backdrop or white backdrop. Production alpha PNG for sprites, actual transparent pixels. Leave all four trees complete and safely separated.

### Ground

Production environment material texture atlas for a premium painterly medieval strategy game. A square image precisely divided into FOUR EQUAL SQUARE QUADRANTS, each completely filled edge to edge with its own seamless top-down terrain material. Orthographic straight overhead, absolutely no perspective, no horizon, no objects, no trees, no bushes, no border or labels, no shadows from offscreen objects. Consistent neutral daylight, realistic organic fine ground detail, restrained contrast, natural earthy palette. TOP LEFT: lush meadow turf with very short sage and deep green grass blades, tiny clover leaves, minute moss and subtle dark soil visible between plants, lush living green not olive yellow. TOP RIGHT: weathered dry meadow grass with muted sage, straw, exposed dusty ochre earth and scattered tiny pebbles, softly interwoven, no sharp isolated patches. BOTTOM LEFT: shaded forest floor of rich cool brown leaf litter, tiny fallen twigs, dark earth, moss carpets and occasional oak leaves, no large rocks. BOTTOM RIGHT: moist soft woodland moss and fern groundcover with tiny delicate fronds and darker soil. All details small and naturally distributed, NO obvious swirls, NO geometric patterns, NO large black patches, NO rectangular seams within any quadrant, no giant leaves. Each quadrant is a TILEABLE TEXTURE sampled independently and blended into landscape materials by the game. High quality tactile original game art, fine enough to read close up but subtle enough for a wide landscape.

### Berries

Production transparent PNG game sprite sheet, actual alpha transparency enabled. FOUR isolated wild berry thickets in a 2 by 2 grid, each plant completely within its own quarter with empty space between them. No grid or text. Two natural variations and their picked states. TOP LEFT: low spreading wild redcurrant thicket, irregular arching woody stems, small textured deep green serrated leaves, little clusters of ripe ruby berries, leafy branch tips at varied heights, wider than tall, beautifully observed wild plant not a sculpted ball. TOP RIGHT: wild blackberry bramble, loose tangled arching canes and blue-green leaves, small clusters of ripe purple-black berries and a few burgundy ripening fruits, uneven sprawling silhouette. BOTTOM LEFT: exactly the same redcurrant plant after all ripe berries have been gathered, still healthy leafy foliage with visible empty thin fruit stems, fewer leaves at the base, no red berries. BOTTOM RIGHT: exactly the same blackberry bramble after ripe berries have been gathered, green leafy canes, NO ripe berries. All four original plants seen from consistent elevated orthographic three-quarter camera for an isometric medieval strategy game, natural painterly realism, finely detailed warm sunlight from upper left and cool green leaf shadows. No giant fruit, no geometric bush shapes, no gold coloring. Small natural roots at ground contact. NO dirt discs, NO oval ground patches, NO grass islands, NO rocks, NO painted shadow. REAL transparent background, no checkerboard image, no opaque background. Keep every full bush isolated and unclipped, clearly separated in a 2x2 sprite atlas.
