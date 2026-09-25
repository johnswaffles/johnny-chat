
## Waterfall performance replacement — September 23

Replaced live gradients, clipping paths, particles and screen blending with 16-frame transparent PNG loops at 12 fps. Assets are generated offline by `node scripts/bake-water.mjs`; the game only draws visible falls. Original panorama remains untouched. Backing canvas is bounded to 2.4 million pixels and DPR 1.5.

Browser comparison (`tests/waterfall-benchmark.html`): 30 frames at 1280×720, with full-canvas readback each frame: previous effect 11.33 ms/frame, decoded PNG sprites 1.72 ms/frame (6.6× faster in this isolated sample). Image loading 156.8 ms; decoded water frames approximately 8.2 MiB. This is an isolated rendering comparison, not a measurement of complete game FPS. Canvas and ImageBitmap intermediate approaches were slower and were discarded; production uses prebuilt PNG images.

Verified updated gameplay at the saved first starseal with successive screenshots and no console errors. All 26 automated tests pass, including complete input-driven playthrough and animation wrapping/offscreen culling. Physical Xbox controller verification remains outstanding from the prior change.
