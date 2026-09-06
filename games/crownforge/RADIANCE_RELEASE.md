# Woodland radiance and camera smoothness

Release marker: `20260905-radiance4`.

## Three graphics upgrades

1. **Canopy depth and light.** The original painted tree art now receives a subtle warm upper-canopy and cool recessed-branch glaze at each prepared detail level. Actual tree silhouettes cast soft ground shadows, and close trees sway gently around their planted roots. Species, trunks, collision footprints and harvest state remain unchanged.
2. **Richer ground materials.** World-anchored materials blend two orientations at different scales to reduce obvious repetition. Retina-aware material layers and sprite selection retain more fine detail when looking closely at the grass and woodland floor.
3. **Woodland atmosphere.** Seeded light pools, restrained sunbeams and low cool mist give the forest more depth. Effects stay anchored to the land, respect the atmosphere and reduced-motion settings, and are bounded to twelve visible anchors. The Greatwood preview includes Dawn, Day and Dusk controls.

These are Canvas presentation changes using the approved original artwork. No new image generation, PNG replacement, character-rig change, music change or saved-game migration is included.

## Camera and rendering

Previously, every camera movement repainted the full terrain layer. World-anchored terrain tiles now survive panning; progressive detail and an overview fill new areas during zoom. A one-pixel gutter keeps sampling continuous. Terrain work is limited to two tile bakes per frame with a soft three-millisecond budget. The cache is capped at 192 tiles and 64 MiB, plus a 1536-by-768 overview.

At strategic distances, reusable forest strips reduce repeated painting of thousands of trees. Bands containing workers, buildings, other resources, selected trees or grass retain individual drawing so the existing painter order remains intact. Close views use individual trees. The strip cache is capped at 96 layers and 48 MiB, rebuilds after woodland revisions, and gradually warms while the camera is close to the settlement.

The loading veil now covers image decoding and preparation of commonly needed drawing surfaces, including opening characters' work/carry poses and resource/tree detail levels. This moves first-use browser rendering work out of the initial camera tour. Wheel zoom eases toward a cursor-anchored target, handles pixel/line/page wheel units and stops easing when the player pans. Reduced-motion mode changes zoom immediately.

## Validation

Measured in this machine's browser with the full seed-42 world and current artwork. A repeatable 35-second renderer run includes five seconds stationary, twelve seconds panning and eighteen seconds zooming between 0.065 and 1.5.

| Camera measure | Previous release | Radiance |
| --- | ---: | ---: |
| Pan render p95 | 3.7 ms | 4.9 ms |
| Zoom render p95 | 12.0 ms | 11.4 ms |
| Maximum zoom render | 301.9 ms | 25.6 ms |
| Camera frame gaps over 50 ms | 3 | 0 |

The additional lighting adds some normal pan work, but the final run remains comfortably within the frame budget at p95. These are measured results on one machine, not promises for every device. The final cache totals were 51,121,152 terrain bytes and 36,029,516 forest bytes, within their limits.

An ordinary-versus-cached forest image comparison found no missing trees, gaps or visible painter-order defects. Mean RGBA channel difference was 2.09/255; 6.19% of painted pixels differed by more than 16 in at least one channel, principally from resampling at different detail levels.

Actual-game testing uses the canvas placement handler, a Timber Yard and three Crown workers. The yard completed, workers chopped and delivered wood, and their rendered carry badge read `Wood`. Selection took 3.5 ms and the placement click took 8.6 ms. At 71.5 seconds there were 72 wood delivered, simulation p99 0.9 ms and render p99 5.1 ms, with no browser errors or frame intervals over 100 ms. The subsequent actual wheel-event and pan tour passed. At 149.5 seconds, workers had delivered 204 wood across 8,968 measured updates; simulation p99 was 0.8 ms, render p99 5.2 ms and the maximum frame interval 50 ms, with no browser errors.

The new camera-render regression covers terrain alignment, bounded work/memory, panning reuse, invalidation, zoom convergence and cursor anchoring, reduced motion, forest depth exclusions and felling, and bounded woodland light/mist. Relevant graphics, character loading, Greatwood, meadow, building navigation/services/defense, gathering, Hearthkin gameplay and music checks pass. The legacy remediation script still fails its retired `motionLoop` atlas expectation; the unchanged previous release fails the same assertion. Current rig/loading/gameplay tests pass.

Source/public parity, changed-script syntax, whitespace checks, the site build and deployed-byte verification accompany the release. Unrelated website build outputs are excluded.
