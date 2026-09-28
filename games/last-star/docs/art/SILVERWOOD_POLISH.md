# Silverwood polish artwork

Built-in imagegen, September 28, 2026. Original approved artwork is preserved. New assets are transparent PNG atlases; inspect actual runtime crops in both facings, rather than trusting the generator's grid.

## Prompt set

Actions: exact existing silver-haired male Starveil wizard, midnight-blue robe, gold celestial embroidery, held gold staff with blue star. Eight poses: raise, aim, horizontal release, horizontal follow-through; brace, recover, crouched landing, rise. 1536x1024, four columns by two rows, genuine alpha. Consistent body scale and floor. Revised prompt requires55px transparent padding and a maximum274x390 figure in each384x512 tile after the first atlas showed spillover. No text, borders, background haze or shadows.

Scenery: match the existing Silverwood panorama's painterly moonlit palette. Separate tall crag/spillway with a visible pool feeding its waterfall; silver-leaf tree with complete roots; clearly stone gothic arch with supported columns and capitals. Genuine alpha and generous gaps, no merged wood/architecture. Original panorama used only as a style reference. Runtime uses explicit source masks to separate irregular silhouettes.

Walk: exact existing wizard, eight sequential walk frames in4x2 grid, same size and foot baseline, alternate near/far heel contact through passing and swing poses. Staff upright and held, trailing silver hair and coherent robe follow-through. Measured walk, no running bounce or pose crossfade.

Final selected filenames and visual QA are recorded in POLISH_PREVIEW_QA.md. Rejected candidates remain unreferenced and must not silently become active.

Selected: assets/arcanist-actions-v2.png and assets/silverwood-layers-v1.png. The first action sheet is retained under art/iterations/arcanist-actions-rejected-v1.png and is not loaded. Walk candidate exec-4e1f0de1-ccfe-4b59-b983-333b65a6e97d.png was rejected: it did not provide a clear enough improvement over the approved gait. Existing walk, idle and air atlases stay active. Action v2 uses irregular registered source rectangles and one explicit aim-frame exclusion to keep adjacent cloak fragments out of the runtime crop. Both facings reviewed in tests/polish-art-review.html.
