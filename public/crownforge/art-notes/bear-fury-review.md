# Greatwood bear review — 9 September 2026

Local playable copy based on Crownforge release commit `64490db`. No commit, push or deployment was performed. Production source and its public mirror remain at their original versions. The separate painted roster study was not changed or imported.

- Review arena: http://127.0.0.1:58669/dev/bear-fury-arena.html
- Four-view motion studio: http://127.0.0.1:58669/dev/grizzly-studio.html
- Full local game: http://127.0.0.1:58669/?release=20260909-bearfury1

## Behavior

- Northeastern paintings are enlarged 25%; northwestern paintings 15%, correcting their smaller body mass while retaining the approved walk and attack images.
- Wrath of the First Oath activates at 10% true health or less, or whenever Last Light disguises a living bear as 1 HP. It adds 500% damage (6×), with a lethal minimum against fighters. A successful contact hits its primary victim and up to two additional fighters within 10 world units of the bear, respecting line of sight and wards. An escaped primary contact does not create a secondary hit.
- Each landed defense arrow removes 1/30 of maximum true health, so 29 arrows leave 6 of 180 HP and the 30th kills. The curse does not heal wounds or change that armor.
- Every fighter can attack while closing within normal reach plus 0.45 world units. Direct pursuit checks obstacles and avoids per-frame A*. Foot and mounted animation use a separate distance-driven gait while arms follow the strike clock.
- The last fighter to land positive weapon damage draws the bear's attention. Retargeting preserves an existing swing clock. Hunting cannot bypass recovery after a kill.
- Worker wards retain damage and target immunity. Normal bear attacks still trigger a full-health worker's ward on the second blow. Fury may trigger it in one blow; the worker survives and becomes untargetable.
- Four complete collapse poses play across 1.8 seconds. The fallen body stays until 5 seconds, then disappears over the final second. Save/load preserves death progress. Front and rear painted collapse sequences use bilateral facing for the opposite side; approved living artwork remains four independent views.
- First Condemnation lore concerns all Greatwood grizzlies, their inherited sentence for devouring the star-grove's keepers, and the permanent supremacy of elder magic. Last Light trickery is revealed only after the lesser curse. Fury and Elderhide have inspectable buff cards. The fury illustration is shown in full, without cropping its sweeping paw or fallen soldiers.

## Artwork

Created and edited with built-in `image_gen`. Selected generated PNG bytes were copied into `assets/`; originals were retained. No raster pixels were edited by scripts. `tools/measure-bear-death.py` measures alpha silhouettes and writes clipping and pivot metadata. Generated candidates without usable alpha were not integrated.

- `assets/greatwood-fury-card-v1.png`: upright bear, two soldiers thrown through the air, three fallen soldiers.
- `assets/painted-death-se-v1.png` and `assets/painted-death-ne-v3.png`: complete painted collapse frames, real RGBA alpha.
- [Generation prompts and provenance](bear-fury-prompts.json).
- [Scoped changed-file manifest](bear-fury-file-manifest.json). Merge these scoped changes when integration is requested; do not replace a newer game checkout wholesale.

## Validation

52 targeted checks passed across `bear-fury-regression`, `bear-death-regression`, `painted-grizzly-regression`, `grizzly-pursuit-regression`, `grizzly-pair-regression`, `unit-inspection-regression`, `wildlife-routines-regression`, `mounted-render-regression`, and `roster-gameplay-regression`.

Coverage includes all ten fighter classes, arrow projectile impacts, shield safety, melee retaliation, cleave limits and missed attacks, grounded collapse frames in four views, late corpse cleanup, save/load, all original approved bear atlas hashes, and the fifteen-minute forest economy. Browser checks verified the false 1 HP card, full fury illustration, 29-arrow survival / 30-arrow death, a single swipe leaving one of four fighters alive, rear body scale, and paired bear release in the full local game. The review scene reports zero current JavaScript errors.

The older `roster-motion-regression.mjs` has an unrelated existing assertion that workers must use the retired skeletal renderer. It fails identically on the unchanged release baseline, which already uses the approved painted workers. It was not counted among the 52 passing checks or changed to conceal the failure.

The review arena includes optional demonstration controls and auto-pauses after the first three-target hit or the completed collapse. These controls are not loaded by the normal game entry point.

## Rear paw correction — 9 September 2026

Removed the stray central paw from the third and fourth rear collapse paintings with a targeted built-in image edit. Both Northeast and mirrored Northwest use the corrected v2 sheet; the v1 source remains available. The generated PNG has real transparent alpha. Re-measured clipping bounds and pivots preserve the established body scale. [Edit prompt and provenance](bear-paw-correction.json).

Correction validation: all seven checks in `bear-death-regression.mjs` and `painted-grizzly-regression.mjs` pass. Browser inspection confirmed corrected intermediate and final collapse poses in both rear views, transparent edges on grass, and zero page errors. Local review only.

## Rear-leg redraw — 9 September 2026

Following feedback that the remaining rear leg still looked disconnected, redrew the hindquarters through all four rear collapse frames. The near thigh now bends into a folded lower leg and forward-pointing paw; the far hind leg is occluded by the body. Both rear views consume `assets/painted-death-ne-v3.png`. The original and prior correction remain available. Built-in image generation supplied the artwork and final RGBA cutouts; no raster pixels were changed by scripts. Regenerated measured alpha bounds and cache versions. [Final prompts, asset path and generation provenance](bear-hindleg-redraw.json).

Redraw validation: visually inspected all four collapse poses in both rear views on grass; clean transparency and zero page errors. Seven existing bear collapse/painted-animation regression checks passed, including original living-art hashes and scale. Local preview only.
