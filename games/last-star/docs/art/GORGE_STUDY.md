# Silverwood living gorge — asset record

September 29, 2026. Built-in image generation skill/tool, not API/CLI. All imagery is original production artwork. Outputs copied from the generator into versioned project files; previous approved artwork preserved. The first ridge attempt had a clipped tree crown; v2 repairs it and is the runtime selection.

Runtime files (each 2172 × 724 with alpha):
- `assets/silverwood-horizon-v1.png`: opaque remote mountains and observatory, empty sky transparent.
- `assets/silverwood-gorge-v2.png`: opaque nearer cliff, wooden tree, river source and supported stone arches; sky/arch holes transparent.
- `assets/silverwood-clouds-v1.png`: independently drifting cloud bank.

`assets/silverwood-gorge-v1.png` is the superseded crown-clipped source, never referenced by the runtime. Cloud interiors may be translucent vapor; wood and stone must not be globally faded.

## Generation prompts

### Horizon

Use case: stylized-concept. Production game asset, a separate FAR DISTANCE LANDSCAPE LAYER for a premium painterly side-scrolling moonlit fantasy game, Crownforge Silverwood. Wide landscape 3:1 aspect ratio. Transparent empty sky above a continuous serrated mountain skyline; fill bottom edge with opaque blue mountain terrain. Several overlapping sculpted indigo mountains, remote pine ridges, distant ornate observatory perched toward right third with just a few tiny warm golden windows, luminous pale blue rim light on rock summits. No foreground objects, NO CLOUDS, no moon, no fog overlays, no water, no falling water, no trees covering architecture, no text. Atmospheric color perspective painted into opaque terrain, distant colors muted blue teal. Beautiful sophisticated shapes and intricate but restrained painterly rock detail. The skyline rises from about 30 percent image height left, dips toward center, peaks again at right observatory. Bottom fills canvas solidly. True transparent background only above landscape silhouette, solid opaque mountain and building interiors. This is an asset to composite behind separate nearer cliffs, not a completed scene.

### Ridge v1

Use case: stylized-concept. Create an original production game scenery layer for Crownforge Silverwood, painterly high-end fantasy, 3:1 wide landscape. Entire sky TRANSPARENT, no mountains in distance. One continuous MIDGROUND CLIFF RIDGE filling bottom edge with solid opaque dark blue slate rock; irregular top silhouette at about 40 percent of image height. Sharp luxuriant moss, silver foliage, tiny ochre flowers on top, pale moonlit teal highlights. Left third: one elegant silver-leaf tree with branches and roots physically attached to ridge, clearly wooden. Center at exactly 50 percent width: a narrow open turquoise river channel coming toward viewer over a level cliff lip; water stops AT THE LIP near 45 percent image height; the VERTICAL CLIFF BELOW THAT LIP IS BARE DARK ROCK because animated waterfall will be added in engine. Right third: small ruined gold-trimmed stone aqueduct with three complete supported arches, on separate solid ridge, no trees fused into stone. Large varied rock terraces and ledges below; bottom edge opaque solid terrain throughout. NO FALLING WATER painted onto cliff, no mist, no haze, no clouds, no moon, no sky, no characters, no text, no cut-off tree tops. Tree crown fits comfortably fully inside image. Detailed crisp painterly production illustration with believable architecture, beautiful strong contours. This is a single opaque terrain cutout isolated on transparency; only empty sky and open arch holes transparent. Distinct design across width, no repeated sprites.

### Ridge v2 edit

Edit this production transparent game scenery layer. Preserve its exact 3:1 layout, the entire rock ridge, river channel and source lip, right-side aqueduct and painterly detail. Only repair the silver tree canopy at upper left: reduce its height slightly and reshape its upper crown so the ENTIRE crown fits with 40 pixels of empty transparent padding above it. No leaf tips cut by top image boundary. Keep its roots and trunk in exactly the same position. Keep all rock and stone opaque. Maintain transparent sky and arch holes. No new background, no fog, no waterfall, no text.

Input: v1 ridge; inspected before editing. Output used: v2, not the clipped v1.

### Clouds

Use case stylized-concept. Production cloud layer for a high-end painterly moonlit fantasy side-scrolling game. Wide 3:1 image. Transparent background. Three loosely connected elongated banks of beautifully sculpted nighttime clouds stretching horizontally with generous transparent gaps; detailed rolling billows and thin wispy trailing edges. Navy blue shaded undersides, soft dusty silver-blue moonlit rims, restrained pale teal highlights. Clouds luminous but not white daylight clouds. Center cloud bank larger, left one thin and wispy, right one tiered and sculptural. No scenery, no horizon, no moon, no stars, no text, no frame, no black background. All cloud forms completely inside image with transparent padding at every edge. Painterly detailed realistic volume, crisp silhouette with delicate translucent vapor edges. This will be independently animated over a dark blue game sky.

## Composition and implementation

The midground silhouette and distant skyline have different camera factors (.42 and .12), with clouds at .06 plus independent clock motion. River lip manually registered near u .423–.554 / v .587 in the selected artwork. Water is a bounded material pass, not a displaced full-screen painting. Canopy-only UV deformation keeps roots and masonry fixed. GPU shaders tint opaque terrain toward atmospheric blue without reducing its opacity; moving surface shading is restrained.

This prototype uses layered planes rather than 3D modeled geometry. It does not claim volumetric clouds, physically simulated water, ray-traced light, or a complete AAA environment pipeline. Further expansion should add additional authored terrain sections and physically coherent transitions, not duplicate this single ridge.
