# Living ground and mountain detail

Built-in image-generation tool, September 29, 2026. Final project-bound assets:

- `assets/silverwood-horizon-v2.png` (2172 × 724): selected refinement of v1; original preserved.
- `assets/silverwood-flora-v1.png` (1536 × 1024): selected six-species plant atlas. Third generated variant selected for its delicate grass and small flower clusters. Earlier variants remain only in generation output, not referenced by runtime.

Alpha was verified from actual PNG data, not the tool's RGB preview: selected flora has 881,493 fully transparent pixels; sampled empty-cell/background points are alpha zero. Colored RGB values beneath alpha zero are not visible backgrounds. Sprite interiors remain opaque or near-opaque. Explicit padded crop metadata and baseline registration live in src/gorge-flora.js; runtime crops are cached at 128 pixels high, then rendered at 17–38 logical pixels.

## Final mountain edit prompt

Refine this exact transparent distant landscape layer for the Crownforge Silverwood game. Preserve 3:1 composition and overall skyline, indigo moonlight palette, observatory on the right, transparent empty sky. Add much richer sharply painted geological detail: stratified crags, overlapping escarpments, fine pale silver snow caught in crevices and ridgeline ledges, distinct pine forest contours, narrow stone stairs carved into observatory mountain, a few tiny warm windows and terrace structures physically supported by rock. Add depth within the valley using atmospheric COLOR, not transparent rock. Keep peaks recognizable, center valley open, buildings coherent and clearly separate from rock. No clouds, moon, fog overlays, waterfalls, floating objects or text. All mountains and buildings opaque; sky transparent. Sophisticated painterly game production artwork, exquisite detail but restrained contrast so foreground characters remain clear. Highest practical resolution.

Input: assets/silverwood-horizon-v1.png, visually inspected before editing. Transparent output requested.

## Selected flora prompt

SIX ISOLATED SMALL GAME SPRITES, arranged 3 columns by 2 rows. Transparent canvas, absolutely NO BACKGROUND OR COLORED HAZE. If background visible it must be perfectly uniform pure black #000000, nothing else. Each sprite fully isolated with 50 pixels empty space surrounding it. Top row: mossy grass tuft, silver dew grass tuft, white wildflower clump. Bottom row: violet bellflower clump, green fern, gold buttercup clump. Small delicate painterly botanical sprites for a moonlit fantasy game. Each clump has a flat rooted baseline and full leaves visible. All plants fit within individual cells. Landscape image. No light rays, halos, ambient gradients, smoke, landscape, rock, labels, frame or text. Pixel outside plant silhouettes fully transparent. Opaque plant interiors.

Transparent output requested. Review in the game confirmed clean compositing without the RGB preview's colored haze.
