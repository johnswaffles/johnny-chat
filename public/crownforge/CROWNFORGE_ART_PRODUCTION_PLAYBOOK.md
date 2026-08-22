# Crownforge Art Production Playbook

This file is the reusable visual and animation standard for Crownforge: Dawn of Kingdoms. Read it before adding a unit, building, resource, or atlas. It exists so future work follows the proven slice workflow instead of rediscovering alignment, direction, and transparency problems.

## Source of truth

- Gameplay source lives in `games/crownforge`.
- The deploy mirror lives in `public/crownforge` and must match every changed source file and asset byte-for-byte.
- `CROWNFORGE_DEV_LOG.md` records the chronological history; this playbook records the repeatable method.
- The visual contract is warm, hand-crafted historical RTS art from an elevated isometric / three-quarter camera with upper-left light, readable silhouettes, fixed ground contact, and no text baked into world assets.

## Production loop

1. Read the current development log and inspect the existing atlas/config/renderer path before generating anything.
2. Generate one original asset family at a time. State the exact camera, faction palette, light direction, canvas layout, row order, frame count, transparency, and padding in the prompt.
3. Inspect the generated file visually before registering it. Confirm true alpha, no checkerboard baked into the pixels, no square background, no halo, no clipped top/base, and no neighboring-cell bleed.
4. Copy the asset into `games/crownforge/assets` under a versioned sibling name. Never silently overwrite a prior approved asset.
5. Register dimensions, rows, columns, query-marker version, and art-to-gameplay scale in `src/config.js`. Keep gameplay footprint and visual render size separate.
6. Wire state and direction mapping in `src/animation.js`; do not assume a generated sheet uses the previous sheet's row order.
7. Make the renderer use the same ground anchor and one-pixel atlas-cell inset used by existing Crownforge assets.
8. Run source checks, direct simulation checks, and browser QA at normal zoom, zoomed in, and after panning. Check the actual canvas, not just a file preview.
9. Mirror the approved file and code into `public/crownforge`, bump the cache marker, deploy, and verify the live script/assets and browser console.
10. Append the result, evidence, and remaining limitations to `CROWNFORGE_DEV_LOG.md`.

## Unit animation contract

Every four-direction frame-column sheet uses this row order unless its config explicitly documents another contract:

| Row | Camera-facing direction | Required reading |
| --- | --- | --- |
| 0 | screen-down / front | face and chest readable |
| 1 | screen-right / profile | body travels toward screen-right |
| 2 | screen-up / back | back and shoulder silhouette readable |
| 3 | screen-left / profile | body travels toward screen-left |

Walk sheets use four subtle phases per row: contact-left, passing, contact-right, and settled passing. The passing frame is mandatory; side-facing rows must visibly alternate the legs so motion does not jump between two extreme poses. The feet, painted shadow, lower garment, and sprite baseline stay fixed across all frames. The full head, hands, tool, weapon, and boots remain inside the cell with transparent breathing room.

Do not mirror a profile row as a shortcut when the weapon, hand, basket, shield, or clothing makes direction materially different. Prefer authored left and right rows. Keep a unit's gameplay `renderSize` stable across idle, walk, task, carry, hit, attack, and death states. Use animation playback rate for pace changes rather than resizing the character.

Carry and task sheets are separate action families. A carry state must show a complete head and body in every frame, the cargo attached to the hands, and a stable foot contact. Gathering states may move the tool, torso, and arms, but must not change the unit's scale or anchor. Attack sheets must keep the weapon inside the cell and use the same direction index as the approach/facing logic.

## Building contract

Buildings are isolated transparent cutouts with a painted contact shadow or carefully authored base, never a square terrain tile. The art render size can be larger than the gameplay footprint, but `collisionClearance`, selection silhouette, approach points, and pathfinding must be tuned so units do not occupy the visual body. Entrances must face a usable approach side.

Field plots are ground props rather than opaque unit containers. A field asset
must be a clean transparent cutout with no baked farmer; the farmer is a live
villager using the `field_work` action loop. The field loop follows the same
front/right/back/left row contract and uses four readable phases: upright
contact, reach, deep bend, and recovery. The plot and farmer share the same
meadow contact language, but the farmer remains the canonical selectable,
animated entity.

The first-age construction contract is foundation, partial, near-complete, and complete. If a dedicated stage sheet is not yet available, use the existing stage atlas and a restrained progress treatment; log that limitation rather than adding an unreviewed placeholder. Crown Hall and Crown Barracks are the scale anchors for future settlement buildings: villagers stay the same size while the structures read as substantial architecture.

## Resource contract

Resources use data-driven `small`, `medium`, and `large` tiers. A tier controls capacity, visual scale, collision footprint, interaction ring, and depletion time. Bushes keep the compact small scale. Trees and groves can use larger authored silhouettes without changing bush scale. Stone and future metal deposits use the same tier interface; large deposits need a dedicated large silhouette rather than a visibly blurry enlargement.

For every node, verify:

- the resource can be selected/targeted from a believable ring;
- the worker stops outside the visual object;
- multiple workers receive different slots;
- the node depletes through readable stages and clears cleanly;
- the node's footprint blocks placement/pathfinding but not the worker's interaction point;
- depth sorting never produces stacked fragments, half trees, or units hidden inside the object.

## QA gate

Before accepting an asset family, test:

- all four directions and all four walk frames;
- movement toward and away from the camera, then left and right;
- retasking while walking and while carrying;
- gathering at small, medium, and large nodes;
- two or more units approaching the same object;
- selection from the visible silhouette, not only the ground anchor;
- a building beside a resource, a field, a wall, and another unit;
- normal zoom, maximum practical zoom, and a pan to each map edge;
- browser console warnings/errors and missing network assets;
- source/public mirror equality and cache-marker uniqueness.

## Known failure patterns

- **Walking backward:** the generated row order and `directionRows` disagree. Fix the mapping in `src/animation.js` and add a four-direction assertion.
- **Missing middle leg phase:** the sheet contains only extreme contact poses. Regenerate with an explicit passing frame in both profile rows.
- **Headless or shrinking carry state:** the action sheet has a cropped cell, baked background, inconsistent baseline, or stale cache marker. Inspect the actual loaded cell and keep the same renderer size/anchor as walk.
- **Half trees/bushes/rocks:** atlas boundaries sample adjacent cells. Keep transparent padding and use the one-pixel source inset in `drawAtlasCell`.
- **Worker inside a grove:** collision uses a larger footprint than gathering range. Derive the interaction ring from the same tiered footprint plus unit radius.
- **Floating art:** the file has a different bottom anchor or a hidden ground patch. Reframe the asset or add a documented renderer y-offset; do not compensate by moving the gameplay entity.
- **Buildings too small:** increase visual render size and clearance while keeping human scale and gameplay footprint intentional.
- **Baked field worker:** remove the static person from the field cutout before adding a live farmer, or the plot will appear to contain duplicate workers.
- **Tree backdrop / row leak:** isolate the tree row into a dedicated atlas when a mixed environment sheet produces white fragments or partial silhouettes; never ship a generated tree export with a colored halo just to fill a missing variant.

## Current approved examples

- Crown Guard walk: `assets/crownforge-soldier-walk-loop-v3.png`.
- Villager walk: `assets/crownforge-villager-walk-loop-v3.png`.
- Villager carry food: `assets/villager-carry-food-loop-v1.png` pending a true-alpha v2 replacement; the existing state is retained until the replacement passes the transparency gate.
- Crown Hall: `assets/crownforge-crown-hall-wood-v1.png`.
- Crown Barracks: `assets/crownforge-barracks-first-age-v3.png`.
- Large stone: `assets/crownforge-stone-deposit-large-v1.png`.
- Grove depletion family: `assets/crownforge-tree-grove-depletion-v1.png`, scaled by the resource tier contract and staged by remaining capacity.
- Field plot: `assets/crownforge-field-v2.png`, a no-worker transparent plot reserved for the live farmer.
- Field worker loop: `assets/crownforge-villager-field-work-loop-v1.png`, 4x4 directional upright/reach/bend/recover sheet.
- Individual tree family: `assets/crownforge-tree-atlas-v1.png`, the isolated clean tree row used to prevent mixed-atlas sampling.

Future units and buildings should follow this file and then add only the smallest new rule needed for their unique silhouette or gameplay interaction.
