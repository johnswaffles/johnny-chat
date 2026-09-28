# September 28 art repair record

Tool: built-in imagegen; original assets retained.

## Background
Output: assets/last-star-valley-architecture-v3.png (2172×724).
Edit target: assets/last-star-valley-detail-v2.png.
Prompt: Correct only the pale stone/gold colonnade beneath the giant silver tree in the left third. Coherent freestanding arcade behind the tree, straight columns, distinct capitals and bases on a narrow continuous stone terrace. Tree bark stays organic and in front with clean occlusion. Preserve panorama aspect ratio/composition, tree silhouette, mountains, moon, observatory, all waterfall positions, rocks, lighting and right two thirds; no new waterfalls or text.
Review: independent masonry now has supported bases and the limb passes in front. Water animation remains registered to the same 2172×724 composition. Existing excluded waterfall ID 2 remains excluded.

## Enemies
Output: assets/enemies-atlas-v2.png (1536×1024 RGBA).
Reference: assets/enemies-atlas-v1.png.
Final prompt: Create a new transparent six-pose production atlas using the reference only for identities: violet hooded wraith top row, ivory armored crescent-polearm guardian bottom row; idle, windup, left attack. Keep figures smaller and weapons complete with generous padding, consistent body scale and baseline. No backgrounds, text, borders or pose overlap; preserve painterly quality.
The generator did not honor a regular grid completely. Runtime therefore uses explicit source bounds and body pivots in src/enemy-frames.js, plus two empty-corner exclusion polygons to reject adjacent-pose fragments. Do not revert to equal-cell cropping. The first generated variant was rejected and is not referenced by the game.
Review tool: tests/enemy-art-review.html renders all six frames mirrored, using the production renderer on dark/light backdrops. Verify weapon tips, cloth, glow trails, pose anchors and absence of adjacent fragments. Future art should have generous transparent gutters from the start; review actual rendered crops, not only the full sheet.
