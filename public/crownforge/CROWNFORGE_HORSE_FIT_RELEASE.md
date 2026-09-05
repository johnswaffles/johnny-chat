# Horse fit correction — 20260905-horsefit1

## Player-visible changes

- The Ashen Outrider has complete, rounded hindquarters in both profiles. Each side is independently painted and retains its own lighting.
- Both tails attach at the upper croup and hang toward the hocks, with restrained sideways movement.
- Both horses have a natural downward muzzle pitch. The neck grows from inside the shoulder and meets a measured painted skull socket; the mane follows the source crest. Front/rear skulls retain their volume instead of shrinking to the projected muzzle axis.
- `dev/horse-review.html` shows both mounts together, with four views, all mounted actions, play/pause and cycle scrubbing. Existing studio and field review use the same updated production renderer.

## Implementation and scope

`src/horse-assembly.js` fits the separate painted neck and mane endpoints to a rigid head transform. Landmarks are specific to each source painting; an opaque source coordinate alone is not sufficient to make a good join, so the Ashen neck roots use the middle of their diagonal bases. Profiles paint neck/mane behind the barrel and the head in front; rear layering keeps the neck behind the rump. `mounted-motion.js` adjusts only presentation neck/head/tail coordinates. Horse limb lengths, four-beat gait, rider motion, attack timing, gameplay rules, collision and save format remain unchanged.

## Artwork and exact prompts

Built-in image generation, original RGBA output copied unchanged:

- `assets/characters-v3/ashen-outrider/horse-body-profiles-v2.png`
- `assets/characters-v3/ashen-outrider/horse-body-profiles-v2-provenance.json` — exact generation and extraction prompts, accepted source and measured bounds.

The first opaque checkerboard result was rejected. The shipped 1024 × 1536 PNG has real alpha, including 52.06% alpha-zero pixels. Original horse sheets remain intact.

## Validation

- Horse assembly: 5/5 checks; source landmarks lie on painted anatomy, head/neck and mane joins match in every mounted action and direction, continuous motion/loop seams, rigid skull dimensions, and downward tail rest geometry.
- Mounted renderer: 3/3 checks for painted hoof support, sole placement and directional layer ordering.
- Full roster motion: 12 rigs, 544 directional states, 44,064 sampled poses and 88,128 painted grips passed.
- Character loading: 4/4 checks passed.
- Enlarged browser inspection: both horses, all four views; complete Ashen croups, tail docks, head/neck alignment, walking, attack and fall checks.
- `npm run build` passed; all 27 changed/new source files match the production mirror byte for byte; all 14 changed/new JavaScript modules parse; `git diff --check` passed. Unrelated generated pages were restored.

## Delivery

Released as `e238163` to `codex/crownforge-live-sync-20260821`. Render serves build `20260905-horsefit1`. Eight deployed files (assembly, mounted motion, renderer rig, registry, Ashen metadata, new PNG and both horse-review entry files) match the tested source byte for byte. Live browser review loaded both horses and inspected a walking cycle in all four directions. Local production field review loaded all twelve characters and confirmed actual mounted walking through the game renderer. The live comparison is left open with walking playing.

Live review: https://crownforge-dawn-kingdoms.onrender.com/dev/horse-review.html?direction=1&action=walk&release=20260905-horsefit1
