# Crownwarden Hearthkin — Living Motion

Release: `20260904-hearthkin3` · September 4, 2026

The Crownwarden worker now uses an original modular character and continuous joint animation. Four independently authored views preserve the teal-and-cream identity, auburn braid and practical artisan silhouette. The game no longer plays the old Crown worker walk, task, carry, attack or death sheets.

## Player-visible changes

- New face, kerchief, tailored split tunic, textured linen, leather, boots and equipment. The worker portrait uses the same face as the world character.
- Continuous walking and carrying with alternating planted feet, bent knees, counter-swinging arms, and restrained braid and coat movement. Short joint transitions connect changes of job.
- Chopping, berry picking, farming, stone and gold mining, construction, repairs, legacy queued dismantling, five visible cargo types, defensive attacks, hit reactions, ward blocks, stun and death. Every state has all four views.
- Gathering follows the harvest clock, construction follows site strikes, and attack motion follows the actual anticipation/contact/recovery timings. Damage, resource quantities and work rates are unchanged.
- Last Light Ward surrounds the moving character in two light layers and reacts to blocked blows. Reduced-motion settings suppress its orbiting particles. Stun and immunity retain distinct overhead cues.
- A modest render-size increase from 88 to 100 improves readability. The health bar now clears the new head. Collision, interaction distances and navigation are unchanged.

This is a 2D skeletal character rendered on the existing canvas, with high-detail raster surfaces. It is not a new 3D engine or a frame-count claim. Other characters keep their existing artwork and animations.

## Review

Open `dev/hearthkin-studio.html`. Choose an action, pause or slow it, scrub the cycle, toggle the ward, or trigger a block. The studio shows front/right/back/left together, plus previews that compensate for page scaling to show actual 28% and 70% game sizes. Non-looping responses stop at their final pose and can be replayed.

The existing `dev/animation-inspection.html` also renders the real rig for Hearthkin and retains the sprite inspection workflow for the other units.

## Artwork and prompts

All artwork was created with the built-in image-generation tool. Final PNGs preserve the tool-produced alpha; source rectangles and runtime mipmaps do not overwrite the originals.

- `assets/hearthkin-v2/design-master.png` — four-view identity reference.
- `assets/hearthkin-v2/rig-front.png`, `rig-right.png`, `rig-back.png`, `rig-left.png` — 16 cutout components per view.
- `assets/hearthkin-v2/equipment.png` — 12 original tool/cargo props; the buckler and wheat remain available artwork rather than new gameplay mechanics.
- `assets/hearthkin-v2/prompts.json` — final prompt set and reference roles.
- `src/hearthkin-rig-art.js` — inspected source rectangles for the cutout components.

## Validation

- `node tools/hearthkin-rig-regression.mjs`: 23 action states across four views; finite poses, fixed arm lengths, gait continuity, tool contact, cargo selection, response priority, still final death poses, RGBA assets and source bounds.
- `node tools/hearthkin-gameplay-regression.mjs`: harvesting and delivery of all four resources, construction, repairs, farming, defensive combat, ward and saved-game compatibility. Also run with the pre-change `2d9b568` simulation as an optional second argument; gameplay snapshots matched after excluding cosmetic animation fields.
- `node tools/roster-animation-regression.mjs`: the other 11 units and their 35 roster atlases still pass.
- `node tools/livingwood-regression.mjs`: forest generation, navigation, harvesting and saved landscapes still pass.
- `node tools/dawn-visual-regression.mjs`: camera, cached lighting, reduced motion and effect cleanup still pass.
- Browser review: four-view motion studio; normal and close gameplay zoom; selection, movement, field placement/construction and farming; error-log and build-marker checks.

Production source is mirrored under `games/crownforge/` and `public/crownforge/`.
