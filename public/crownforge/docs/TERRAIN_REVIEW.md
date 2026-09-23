# Living Earth visual study

Local review at `dev/terrain-review.html`. Living Earth is enabled in the main game; Original/New toggles the same camera between the approved grass and the new layered ground. Settlement, Highlands and Grass detail change camera presets.

The deterministic world-space field combines a warped ridge spine, rolling hills, a shallow dry wash, earth/gravel material masks, warmer exposed ground and cooler moist hollows. Light-facing slopes receive warm highlights; opposite slopes receive green shadows. Existing painted grass materials, animated grass sprites, tree artwork and gameplay state remain intact. The height field supplies visual shading, not actual geometric elevation; no lake, water collision or map-size change is included.

Three RGBA layers are baked once per world at map dimensions and retained as canvases; camera movement reuses them. Current 626×514 layers occupy about 3.7 MiB plus browser canvas overhead. No match RNG consumption or per-frame noise generation. For substantially larger worlds, move the same world-coordinate sampler into visible cached chunks before increasing dimensions.

Validation: terrain-relief-regression (3), meadow-field-regression (8), meadow-render-regression (7). Original/new and near/far appearance inspected in the in-app browser. Source/release files mirror each other. Approved for release 20260923-livingearth1.
