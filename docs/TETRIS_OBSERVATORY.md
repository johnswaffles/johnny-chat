# Falling Blocks: The Observatory

Released design: original space scenery, warm metal frame, glass control panels,
more readable scores, a listening-room record graphic, personal-best display,
and sharper glass blocks. The existing star drift and Prism Bloom effects remain.

## Ring and star revision (2026-09-04)

Current artwork: `public/tetris/observatory-space-v2.jpg`. The original remains
available for rollback. Edited with the built-in image tool and converted to JPEG.
The ring now passes in front of the globe with its far arc occluded behind it.
Twelve tiny lights follow existing stars in the artwork, with staggered 7–12 second
opacity cycles. Their crop follows the background on desktop and mobile; they are
decorative, cannot intercept controls, and become static with reduced motion.
No gameplay or soundtrack code was changed.

Final edit prompt:

> Use case: precise-object-edit. Input image 1 is the edit target, a cozy game background. Correct only the turquoise planet and its malformed rings at the right. Replace the ring system with physically coherent Saturn-like rings: a single flat concentric annular disk centered exactly on the sphere, viewed as a tilted ellipse, with a clear empty gap between the planet and the inner ring. The near half of the ring passes visibly in front of the lower planet, while the far half is properly occluded behind the globe. All ring bands share one plane and one center, no curls, no tangent ribbon, no bending upward, no intersecting the sphere. You may slightly shrink and reposition the planet within the rightmost third to make the correct ring geometry readable. Preserve the original midnight navy palette, pale turquoise atmosphere and warm rim light, quiet lilac nebula on left, sparse stars, and very dark empty central space for the game board. Preserve the peaceful painterly realism. Landscape 1536x1024. No text, UI, logos, spacecraft, or additional planets. This is a targeted correction, not a new scene.

## Original artwork

Artwork: `public/tetris/observatory-space.jpg` (1536 × 1024, approximately 220 KB).
Created with the built-in image generation tool, then converted to JPEG for delivery.

Final generation prompt:

> Use case: stylized-concept. Create original premium game environment artwork,
> landscape 1536x1024, for the background of a cozy space-themed falling-block
> puzzle. A quiet cinematic view from deep space: midnight navy velvet space,
> a luminous pale turquoise ringed planet occupying the far right third, subtle
> warm champagne sunlight on the thin atmospheric rim, delicate dusty lilac
> nebula wisps on the left edge, sparse pinprick stars. The central vertical 35
> percent must remain very dark and uncluttered because a tall game board will
> overlay it. Elegant, serene, painterly realism with fine atmospheric detail,
> emotionally warm and wondrous, beautiful lighting, sophisticated restrained
> saturation. Ringed planet should be visible near upper right with arcs extending
> toward far right edge, no objects in center. No text, no UI, no borders, no logos,
> no characters, no spacecraft, no bright explosion, no dense star noise.

Verification: syntax, whitespace, Pages build and route checks; browser tests for
single/double/triple/four-line clears, surviving and nonadjacent rows, reset, hidden
Really fast soundtrack re-selection and visible song override. Desktop and phone
visual inspection. Local QA fixtures are outside the website and are not shipped.
