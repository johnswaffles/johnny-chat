# Crownforge Visual Integrity Handoff

Audit date: 2026-08-16
Runtime marker: `20260816-integrity1`
Baseline: `bf54155` from `origin/main`
Scope: visual integrity and spatial-coherence repair of the existing vertical slice.

## 1. STARTING CONDITION

The playable slice was already feature-complete for its deliberately small scope and was serving a larger 90 × 73 map. The current build contained the prior building-clearance, resource-slot, fixed-camera, four-direction, and one-pixel atlas-sampling work. The reported visual failures were concentrated around authored generated art: cropped environmental silhouettes, marauder attack weapon bleed, apparent marauder movement-state repetition, and occasional close-object composition concerns. The live route was serving the `20260816-expansion2` marker before this pass.

## 2. KNOWN ISSUES REPRODUCED

- Cropped trees: atlas-boundary risk reproduced by the asset audit; no fresh visible crop remained in the current live-sized renderer after its inset was applied.
- Cropped bushes: same boundary-risk result; the seeded local/live map did not show a new visible crop after the inset.
- Marauder weapon corruption: reproduced in the animation viewer with the v2 attack atlas. The axe crossed a cell edge and one generated recovery cell contained a detached blade fragment.
- Marauder directional-animation failure: not reproduced in the current source. Four walk directions were mapped and loaded.
- Floating people: not reproduced in the fresh reset or viewer guides.
- Incorrect environmental layering: not reproduced at the tested normal and close views.
- Unnatural environmental stacking: not reproduced in the current seeded map or movement stress harness.
- Overlapping or overly close starting buildings: not reproduced; the enlarged footprints and authored starting coordinates remained separated.

## 3. ROOT CAUSES

The marauder defect had two layers. First, the v2 generated 4 × 4 sheet let weapon pixels extend into neighboring source cells. Second, the back-left strip itself contained an isolated-looking blade fragment in a recovery cell, so renderer sampling alone could not solve it. The developer viewer also used full-cell sampling, so it could make boundary bleed easier to see than the live renderer. The current renderer’s one-pixel inset and the older deployed cache marker explain why some earlier screenshots and current source behavior did not agree. No evidence showed a simulation/pathfinding cause for the reported scale or stacking concerns in the current source.

## 4. FILES AND SYSTEMS CHANGED

- `src/config.js`: points the active raider attack clip to the new v3 atlas.
- `src/animation.js`: returns requested state, resolved state, and fallback metadata.
- `dev/animation-inspection.js`: uses the live renderer’s one-pixel source-cell inset and displays fallback state metadata.
- `index.html`, `src/main.js`, `src/renderer.js`, `src/simulation.js`: cache marker advanced to `20260816-integrity1` so the corrected source is independently fetched.
- `tools/visual-integrity-audit.mjs`: checks active assets, dimensions, placeholders, animation combinations, and atlas boundary risks.
- `tools/compose-raider-attack-atlas.mjs`: creates a transparent, padded 4 × 4 attack atlas from four generated directional strips.
- `tools/patch-raider-attack-frame.mjs`: rebuilds the final atlas on a transparent canvas so replacement cells cannot retain old fragments.
- `CROWNFORGE_BUILD_ASSET_VERIFICATION.md`, `CROWNFORGE_VISUAL_SPATIAL_AUDIT.md`, and this handoff: record source-of-truth, issue, deployment, and next-pass state.

No simulation, AI, economy, construction, map-size, faction, or roster expansion was introduced.

## 5. ASSETS CREATED

- `assets/crownforge-raider-attack-loop-v3.png`: final 1254 × 1254 RGBA 4 × 4 marauder attack atlas. It is built from four newly generated original directional strips and includes a standalone replacement back-left contact frame.

The intermediate generated strips and standalone frame were preparation inputs, not runtime files. No new tree, bush, rock, terrain, building, villager, or UI family was generated in this pass.

## 6. ASSETS REPAIRED OR REPLACED

- `crownforge-raider-attack-loop-v2.png` was removed from the active runtime source map and replaced by v3.
- The v3 atlas was reconstructed with transparent padding and a stable ground baseline.
- The back-left contact and recovery cells were rebuilt so no detached axe blade remains.
- Existing environment and building atlases were not blindly rescaled; they were checked with the boundary tool and the live renderer’s inset. This preserves their authored scale and avoids introducing a new family-wide crop.

## 7. DIRECTIONAL ANIMATION COVERAGE

The current viewer matrix was run for every state exposed by each unit and all four directions. Result: 0 missing/pending combinations.

| Unit | Idle | Walk | Gathering | Construction | Attack | Hit | Death | Missing | Verified |
|---|---|---|---|---|---|---|---|---|---|
| Villager | 4 | 4 | 4 per current task family | 4 | N/A | fallback to idle | fallback/available current clip | 0 | yes |
| Crown Guard | 4 | 4 | N/A | N/A | 4 | fallback to idle | current clip | 0 | yes |
| Ashen Raider | 4 | 4 | N/A | N/A | 4, v3 | fallback to idle | current clip | 0 | yes |

The matrix verified asset loading, not a claim that every row has deep multi-frame authored motion. The only explicit fallback reports are soldier hit → idle and raider hit → idle; the current viewer reports those instead of silently presenting them as authored hit art.

## 8. GROUND-ANCHOR CORRECTIONS

No simulation anchor was changed in this pass. The v3 attack family was composed to the existing unit baseline and inspected with the viewer’s ground-pivot, shadow, collision, and interaction guides. Existing Villager, Crown Guard, Raider, resource, and building anchors remain the current source contract.

## 9. DEPTH-SORTING AND OCCLUSION CHANGES

- Sorting rule: world entities are sorted by their simulation ground point/depth key; stable IDs provide deterministic tie-breaking.
- Ground-point definition: the bottom interaction/foot anchor, not the top of a sprite or its selection ring.
- Multipart units: unit art and painted shadow remain one authored draw item; health bars and rings are controlled overlays.
- Bush/rock behavior: resources retain their world ground point and collision/interaction footprint; workers approach from valid slots outside that footprint.
- Tree/unit behavior: trees use their authored ground point and collision footprint; units cannot path through their reserved space.
- Building/unit behavior: building footprints and clearances are respected by placement and pathing; units are not spawned inside them.
- UI overlay behavior: interface panels and status feedback render above the world pass and do not participate in world sorting.

This pass verified the existing architecture; it did not replace the depth-sort system.

## 10. PLACEMENT RULES

- Building footprint rules: every building reserves its configured footprint plus `collisionClearance`.
- Minimum clearances: the current larger footprints and starting-layout clearances remain authoritative.
- Entrance rules: builders use building approach slots outside the footprint.
- Interaction-space rules: resource workers use resource interaction radii and separated slots.
- Environmental spacing rules: resources and authored environmental objects retain explicit seeded coordinates; units cannot occupy their reserved collision area.
- Starting-layout validation: `remediation-regression.mjs` checks reset units against all player building footprints; the fresh 1280 × 720 view was also inspected.
- Invalid-placement handling: the placement preview reports a concrete reason and rejects the click.
- Nearest-valid-position behavior: existing path/approach resolution chooses a nearby valid slot instead of placing a unit inside the target.

## 11. AUTOMATED VALIDATION ADDED

- `tools/visual-integrity-audit.mjs` checks active file existence, placeholder references, expected PNG dimensions, direction/state resolution, fallbacks, and 4 × 4 atlas boundary risks.
- The animation viewer now shares the live one-pixel source-cell inset and explicitly reports fallback states.
- Existing `tools/remediation-regression.mjs` was rerun for directional atlas resolution, reset clearance, fixed-step economy convergence, cargo-preserving retask, placement/construction, combat death timing, victory, and defeat.
- Existing movement stress harness was rerun for lanes, intersections, blocked destinations, retasking, and dynamic blocker recovery.

## 12. TESTS COMPLETED

- Local syntax: every source, dev, and tool JS/MJS file passed `node --check`.
- Local diff hygiene: `git diff --check` passed.
- Asset audit: passed; no missing active files, placeholders, or dimension mismatches; raider v3 has no unsafe boundary cells.
- Direction test: all exposed unit states × four directions loaded; no missing/pending results.
- Visual test: local fresh map at 1280 × 720 showed the enlarged, separated starting buildings, grounded Villagers, Crown Guard, and no world resource labels.
- Construction test: building menu opened, blueprint entered placement mode, valid foundation placed, and reset returned to a clean slice.
- Selection/movement test: direct browser click selected one Villager; right-click movement feedback reached `Moving` with no console logs.
- Movement stress: cross lanes, intersections, blocked destination, retask storm, and blocker removal all returned PASS.
- Simulation soak: 3,600 fixed 60 Hz updates completed without a runtime exception; live entities remained bounded and no phase corruption occurred.
- Existing gameplay regression: all six checks in `remediation-regression.mjs` passed.
- Deployment tests: passed after push; live HTML, config, atlas SHA-256, playable route, and deployed QA viewer were rechecked.

## 13. BUILD AND DEPLOYMENT STATUS

- Local branch: `codex/crownforge-visual-integrity`
- Local commit: `d8742b151685fe4c1d5688f39101d9fc3bcab30f`
- Production build identifier: `d8742b1` / runtime marker `20260816-integrity1`
- Pushed commit: `d8742b151685fe4c1d5688f39101d9fc3bcab30f` on `main`
- Deployed build identifier: `20260816-integrity1` confirmed in live HTML and loaded module URL
- Asset-manifest version: `20260816-integrity1`
- Cache state: source markers advanced; v3 uses a new filename; live response served the integrity1 marker and v3 asset.
- Live verification result: PASS — playable route opened at 1280 × 720 with no browser logs; deployed QA viewer loaded raider attack contact direction 2 from `raiderAttack` with no fallback or missing asset.

## 14. ISSUES FIXED AND VERIFIED

- Marauder v2 attack weapon boundary bleed: fixed in v3 and verified in the atlas audit plus viewer.
- Detached back-left marauder axe fragment: removed by transparent-canvas atlas rebuild and verified by direct atlas inspection.
- Viewer/live sampler mismatch: fixed by applying the same one-pixel source-cell inset in the viewer.
- Silent animation fallback visibility: fixed by exposing resolved/fallback metadata in the viewer.
- Starting layout, grounding, environment labels, building spacing, and current movement stress: verified in the current clean source and local browser pass.

## 15. ISSUES FOUND BUT NOT YET CHANGED

### Authored hit/death depth for combat units

- Why unchanged: the current prompt prioritized integrity repair and no scope expansion; the current runtime fallback is mechanically safe and now explicitly visible in QA.
- Severity: medium visual polish.
- Player impact: hit reactions can read as a brief idle pose rather than a distinct response.
- Dependencies: matched directional combat response art and careful timing review.
- Recommended repair: generate a small, padded four-direction hit/death response family for Crown Guard and Ashen Raider, then integrate only after viewer and live battle review.
- Before expansion: yes; complete this existing response family before adding a larger military roster.

### Rare large-object occlusion edge cases

- Why unchanged: no defect reproduced in the current seeded layout or movement stress harness.
- Severity: low and situational.
- Player impact: a worker may be visually close to a tall resource/building edge at unusual camera positions.
- Dependencies: hand-tuned approach points and map-specific authored coordinates.
- Recommended repair: audit each resource/building interaction slot at min/max zoom if a concrete screenshot remains.
- Before expansion: yes, if reproduced; otherwise keep the current contract.

## 16. REGRESSIONS OR RISKS

- Keep `games/crownforge` and `public/crownforge` synchronized; changing only one creates a false local success.
- Do not point runtime back to v2 or remove the `integrity1` marker without a fresh asset audit.
- The boundary tool reports raw authored environment contact at some edges; do not “fix” that by globally shrinking environment art unless the live renderer demonstrates a crop.
- The combat hit fallbacks are known quality debt and must not be mistaken for authored response coverage.
- Browser heap/GPU counters remain unavailable in the current evaluation surface; no memory-stability claim should be made from this pass.

## 17. NEXT HIGHEST-PRIORITY WORK

Complete the existing Crown Guard/Ashen Raider hit and death response family with padded, directionally coherent authored frames. Keep the unit roster, AI, economy, buildings, map, and UI scope unchanged.

## 18. NEXT-PROMPT STARTING INSTRUCTIONS

Read `CROWNFORGE_DEV_LOG.md`, `CROWNFORGE_VISUAL_INTEGRITY_HANDOFF.md`, `CROWNFORGE_BUILD_ASSET_VERIFICATION.md`, `CROWNFORGE_VISUAL_SPATIAL_AUDIT.md`, `src/animation.js`, `src/config.js`, and `dev/animation-inspection.js`. Verify the deployed `integrity1` build and that the live config references `crownforge-raider-attack-loop-v3.png`. Do not repeat the marauder v3 atlas repair, source-cell inset repair, starting-layout repair, or movement stress work. Begin with the documented hit/death depth gap, then rerun the complete direction matrix, remediation regression, movement stress, fresh reset, and live deployment verification before changing scope.
