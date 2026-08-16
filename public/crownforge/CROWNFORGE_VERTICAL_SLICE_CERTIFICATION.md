# Crownforge: Dawn of Kingdoms — Vertical Slice Certification

Date: 2026-08-16  
Scope: Technical hardening and release certification of the existing tiny browser-first vertical slice.  
Decision: CONDITIONAL PASS — the existing slice is complete and stable for focused refinement; non-blocking military/carry animation depth remains and broad expansion is still deferred.

This certification covers the current map, Crownwardens, Crown Hall, Hearth House, Waystore, three villagers, Crown Guard, Ashen Camp, Ashen Raiders, Food, Wood, Stone, construction, combat, limited enemy AI, UI, audio feedback, restart, and developer harnesses. No new gameplay content was added.

## Certification environment

- Local static server: `python3 -m http.server 4178`
- Browser surface: Codex in-app browser, default 1280 × 720 viewport, device pixel ratio 1.
- Source/runtime: native browser ES modules and Canvas 2D.
- Certification evidence: direct simulation probes, browser playtests, animation inspection harness, movement stress harness, visual screenshots, console logs, source syntax checks, and diff checks.
- The browser evaluation surface did not expose a usable page performance clock or runtime heap profile. Render diagnostics and Node-side wall-clock probes were used instead; unavailable memory measurements are recorded rather than inferred.

## Defect severity and disposition

| Severity | Finding | Disposition |
|---|---|---|
| HIGH, fixed | Simulation movement/economy diverged with update cadence. At 30 seconds, 20 Hz versus 60 Hz differed by up to 1.71 world units and one 6-resource deposit in the same scenario. | `src/simulation.js` now advances through a bounded fixed 60 Hz step with a catch-up cap. The same 30-second probe now produces identical clock, positions, cargo, totals, and node amount. |
| HIGH, fixed | A destroyed Waystore could remain eligible as a return target during its short destruction fade. | Return, nearest-storage, and route lookup now exclude destroyed buildings immediately; a cargo probe falls back to the Crown Hall. |
| MEDIUM, fixed | Ripple feedback advanced by a fixed `0.016` per render, making its lifetime frame-rate dependent. | `src/renderer.js` now advances ripples from measured render delta, capped for stalls. |
| MEDIUM, fixed | A rejected Web Audio resume could become an unhandled promise. | `src/audio.js` now handles resume rejection without console noise and leaves later gestures able to retry. |
| MEDIUM, remaining | Action, carry, construction, and melee clips are mostly one authored pose per direction. | Readable and mechanically synchronized at RTS distance, but a compact hand-tuned multi-frame pass remains the next animation refinement. This does not block controlled expansion of the foundation, but it blocks declaring the art final. |
| MEDIUM, remaining | Large world objects can still occlude a worker at some interaction points. | Ground markers and selected/active overlays preserve tracking. A deliberate occlusion pass remains preferable to adding a global canopy system. This does not block the current foundation. |
| MEDIUM, remaining | Enemy behavior is intentionally capped and simple; the enemy has no worker economy or deeper defensive staging. | Keep scope fixed. This is a content ceiling, not a stability defect, and does not justify expansion during this pass. |
| LOW, remaining | Effects are procedural and there is no music; tooltips are concise. | Defer authored sound design and broader help until the current visual/action standard is stable. |

No BLOCKER or CRITICAL defects remain. HIGH defects found during this pass were fixed and re-tested.

## Frame-rate independence audit

The simulation boundary was the largest verified correctness issue. `CrownforgeSimulation.update(delta)` now accumulates elapsed time and processes at most eight fixed `1 / 60` second steps per call. Normal browser frames never exceed the existing 50 ms input clamp, while long pauses cannot create an unbounded catch-up burst.

Verified consequences:

- Movement, acceleration/braking, gathering, construction, attack timing, damage, AI clocks, animation clocks, resource depletion, victory, and defeat now advance on the same fixed simulation clock.
- Camera keyboard movement remains delta-based and diagonal movement is normalized.
- Audio cues remain event-driven and deduplicated; reset stops active sources and clears event history.
- Renderer ripples now use measured render delta rather than a per-frame constant.
- A 30-second gathering probe run with 600 × 50 ms calls and 1,800 × 16.667 ms calls produced identical results: `clock 30.0`, same worker position, same `return` state, `6` carried Wood, `174` stored Wood, and `80` Wood remaining on the node.

## Performance baseline

| Surface | Measured result | Interpretation |
|---|---:|---|
| Local navigation to `complete` | 63 ms wall time on a fresh 1280 × 720 page | Fast startup for this static slice; includes local page load rather than a full production network profile. |
| Canvas render diagnostics, stable run | 1.560 ms average, 0.700 ms p95, 62.100 ms max over the rolling sample window | Ordinary render work is well below a 16.67 ms frame budget; max spikes are consistent with browser scheduling/GC and are retained as a watch item. |
| Alternate render sample | 2.498 ms average, 4.400 ms p95, 63.000 ms max | Confirms the slice remains responsive while image caches and browser scheduling vary. |
| Simulation idle, 60 seconds at fixed 60 Hz | 0.2021 ms mean, 0.0688 ms p95, 8.0752 ms p99, 20.1031 ms max/update | Small simulation cost; occasional long-tail samples are measurable but not sustained. |
| Simulation economy, 60 seconds | 0.2165 ms mean, 0.0735 ms p95, 8.4222 ms p99, 11.8111 ms max/update | Resource routing and deposits remain inexpensive at current entity counts. |
| Simulation combat, 60 seconds | 0.5347 ms mean, 3.3291 ms p95, 7.3510 ms p99, 9.6541 ms max/update | Combat/path queries are the largest measured simulation case and remain under the frame budget. |
| Downloaded PNG directory | 29 MiB on disk, including the retained legacy meadow | Appropriate for the tiny prototype, but asset budget should be watched before adding content. |
| Approximate decoded active texture footprint | 70.5 MiB at source-channel byte counts, excluding unused legacy `crownforge-meadow.png` | This is a pixel-footprint estimate, not a browser heap measurement; the browser evaluation surface did not expose runtime memory. |

No optimization was applied speculatively. The largest correctness issue was fixed first; no artwork was downsampled or degraded to chase an unproven metric.

## Error, cleanup, and transition audit

### Automated/source checks

- `node --check` passed for all `src/*.js`, `dev/*.js`, and `tools/*.mjs` files.
- `git diff --check` passed for the hardening changes and documentation edits.
- Final browser logs were empty at fresh load, after commands, after audio/UI gestures, after victory, after defeat, and after replay.
- Animation coverage source probe resolved 16 Villager states, 8 Crown Guard states, and 8 Ashen Raider states across all four authored direction columns with no missing direction mapping.
- Movement stress harness passed cross lanes, intersections, blocked destination, retask storm, and dynamic blocker recovery with zero footprint, boundary, and stuck violations after the recovery window. Minimum observed pair spacing ranged from `0.69` to `1.43` in the exercised cases.
- Direct simulation probes passed resource cap/depletion, destroyed-drop-off fallback, target death cleanup, construction completion, combat death cleanup, victory, defeat, and reset.

### Player-state stress

- Rapid selection and command updates: no duplicate commands or stale selection state.
- Retask while gathering/carrying: cargo is preserved, storage return completes, and the new order can resume.
- Retask and target loss during combat phases: attackers leave dead targets and reassess.
- Resource depletion during multi-villager gathering: depleted nodes switch to stump/rubble/reduced-bush presentation and workers stop or return safely.
- Path blocking after an order: A* re-planning and the stress harness recover without footprint violations.
- Destroyed drop-off: immediate storage lookup fallback now routes to the Crown Hall.
- Construction cancellation and invalid placement: Escape clears preview/menu state; occupied structures produce a readable invalid reason.
- Eight rapid restarts plus immediate menu/placement transitions: clock returned to `DAYBREAK 0:00`, outcome remained hidden, and no browser log entries accumulated.
- Victory restart: integrated match reset to three selected villagers and initial Food/Wood/Stone totals.
- Defeat restart: passive defense defeat reset to the same clean initial state.
- Window-focus cleanup: the input layer clears held keys, drag, pan, and selection-box state on blur; this was source-audited and exercised with transient input state.

## Complete match scenarios

### Match A — economic and construction integration

- Started from a fresh slice with three villagers selected.
- Placed a Hearth House at a valid clear site, watched villagers route to the foundation, and selected the completed structure at `260 / 260 HP` with `housing active` information.
- Separate fresh resource runs exercised Wood, Food, and Stone orders, carry badges, storage return, capacity behavior, resource retasking, and a reduced Stone node to zero.
- Invalid construction over a structure returned `Another structure is in the way`; Escape cancelled placement cleanly.
- The integrated match then defeated the opening Raider and destroyed the Ashen Camp. Victory appeared at approximately `DAYBREAK 0:53`; browser logs remained empty.

### Match B — movement and combat

- Movement stress exercised group crossings, narrow obstacle lanes, intersections, blocked destinations, retask storms, and dynamic blocker removal.
- Browser 1v1 play selected the Crown Guard, engaged the opening Ashen Raider, observed direction-aware approach/contact, health feedback, Raider death, automatic retargeting, and Ashen Camp destruction.
- Victory appeared at approximately `DAYBREAK 0:52`; the outcome panel was visually inspected and replayed.

### Match C — adversarial behavior

- Passive play allowed the capped Ashen presence to replace Raiders and raid the Crown Hall. Defeat appeared at approximately `DAYBREAK 1:31`.
- Awkward placement, rapid restart, invalid/valid preview, blocked path, resource interruption, and hostile-worker exposure were exercised. The exposed villager death was intentional adversarial evidence; it did not corrupt resources, selection, or cleanup.
- Defeat replay returned to a clean Daybreak 0:00 state with three villagers selected and no console warnings/errors.

## Visual release audit

- No placeholder, programmer-art, emoji, generic colored-box, or mismatched raster asset remains in the playable portion.
- Active world art uses the approved meadow, environment, building-stage, enemy-camp, villager, soldier, raider, and UI families. The older `assets/crownforge-meadow.png` is retained only as a legacy source artifact and is not loaded by the renderer; the active terrain is `crownforge-meadow-v2.png`.
- Four authored directions are sampled from every current unit atlas; no directional mirroring or forced south-facing attack path was found.
- Villagers and combat units use shared ground anchors, painted shadows, collision radii, and interaction distances. Browser screenshots at normal and zoomed views showed no floating buildings, square matte, obvious halo, or broken transparency.
- Building foundation, partial, near-complete, and complete stages remain distinct. Construction overlays are state feedback, not a completed-building fade.
- Terrain, resource silhouettes, buildings, and enemy camp maintain the Crownforge warm historical RTS treatment and upper-left/front lighting agreement.
- Current visual ceiling is action-loop depth and occasional large-object occlusion, both documented as non-blocking refinement work.

## Quality certification matrix

Scores are for this deliberately small vertical slice. A score below 9 is not inflated; each such area has a concrete follow-up below.

| Category | Score | Evidence |
|---|---:|---|
| Art direction | 8 | Strong, original historical RTS identity; one authored board texture and occasional object occlusion remain. |
| Asset consistency | 9 | Active PNG families share camera, lighting, scale, palette, transparency, and ground-contact rules. |
| Unit animation coverage | 8 | Villager Wood/Food/Stone/Construction now use 4-frame authored loops across four directions; carry and military combat/hit/death clips remain deliberately restrained single-pose rows. |
| Directional accuracy | 9 | Four authored columns are sampled live; source probe found no missing or mirrored direction. |
| Locomotion | 8 | Fixed-step acceleration, braking, three-pose Villager walk, and settled idle are clean; combat walk remains single-pose. |
| Pathfinding | 8 | A* routes around static footprints and resources and re-plans; sealed routes report blocked rather than offering a deeper recovery policy. |
| Local avoidance | 8 | Soft separation and deterministic approach slots pass stress cases; there is no formation-grade crowd solver. |
| Gathering | 8 | Food, Wood, and Stone gather, cap, deplete, and retask correctly; no consumption/production economy exists by design. |
| Carrying and depositing | 8 | Directional carry rows, quantity badges, cargo-preserving retasks, and drop-off fallback work; route choice remains intentionally simple. |
| Construction | 8 | Placement rules, staged artwork, multi-builder slots, health, progress, and completion work; only the existing Hearth House is buildable. |
| Building integration | 8 | Buildings block paths and provide safe approach points; rotation and broader building-function variation are out of scope. |
| Combat | 8 | One melee matchup has range, timing, LOS, health, death, retargeting, and combat slots; attack/recoil art depth is still limited. |
| Enemy behavior | 7 | Capped replacement, defense, occasional raids, victory, and defeat are readable; there is no worker economy or deeper staging. |
| Lighting | 9 | Shared upper-left/front grade, baked shadows, map clip, and render checks remain coherent at normal/zoomed view. |
| Color hierarchy | 9 | Units, enemy, resources, placement, health, and outcomes separate cleanly without neon UI or terrain competition. |
| Terrain | 8 | Meadow, dirt, paths, and environmental details form a coherent small board; no dynamic terrain or tile-transition system exists. |
| Depth sorting | 8 | Projected depth sorting and selected-unit overlays are reliable; tall assets can still occlude interaction poses in rare views. |
| UI clarity | 8 | Current selection, task, cargo, resources, placement reasons, outcomes, and tooltips are clear; help remains concise and command scope is small. |
| Camera controls | 8 | WASD/arrows, normalized diagonal pan, wheel zoom, middle-drag, and stable bounds work; edge scroll is intentionally absent. |
| Audio feedback | 8 | Gesture-unlocked procedural cues cover current events and reset cleanly; no authored recording or music layer exists. |
| Performance | 8 | Ordinary render/simulation work fits the frame budget; occasional 60–85 ms browser/GC spikes and unavailable heap telemetry remain watch items. |
| Stability | 9 | Syntax, direct probes, harnesses, match outcomes, logs, replay, and transition stress passed with no remaining blocker/critical issue. |
| Restart behavior | 9 | Victory, defeat, and eight rapid fresh resets restore clock, resources, selection, overlays, and audio bookkeeping. |
| Overall game feel | 8 | The slice feels like a coherent small RTS with a complete match loop; animation depth and intentionally simple AI set the current ceiling. |

### Required follow-up for every below-9 category

| Category group | Deficiency / evidence / probable cause | Required correction | Priority | Blocks expansion? |
|---|---|---|---|---|
| Art direction, terrain, depth sorting | The board is one authored texture and large assets can occasionally cover a worker. Evidence: normal/zoom visual audit; cause is intentionally sparse terrain/occlusion treatment. | Hand-tune a few interaction approach/occlusion cases and only then consider terrain material work. | P1 | No, but blocks a final-art claim. |
| Unit animation, locomotion, combat | Action rows are mostly single-pose; source matrix confirms coverage but not multi-frame depth. | Generate and hand-tune compact Villager task/carry/build loops, then one melee attack/recoil loop, preserving anchors and events. | P1 | No for foundation; yes for calling the art standard final. |
| Pathfinding, avoidance, carrying, building integration | Current A* and soft avoidance pass, but sealed routes and larger crowds have no deeper recovery/formation policy. | Keep the fixed contracts; add targeted recovery only when a real slice scenario demonstrates a defect. | P2 | No. |
| Gathering | The current loop is complete but has no spending/production sink by explicit scope. | Do not add a sink in this certification; preserve the data-driven resource registry. | P3 | No. |
| Construction | Only the existing Hearth House is available and construction feedback is lightly coded. | Hand-tune current worker/stage feedback before any new blueprint. | P2 | No. |
| Enemy behavior | AI is intentionally simple and capped, with no worker economy. | Improve readability/pacing only inside current Raider/Camp scope; do not expand the AI model yet. | P2 | No. |
| UI, camera | Tooltip/help language is concise and edge scroll is absent. | Re-audit after any HUD change; keep current desktop controls stable. | P3 | No. |
| Audio | Procedural effects only, no music/recorded assets. | Consider a tiny authored effects pass only after visual loops stabilize. | P3 | No. |
| Performance | Long-tail browser/GC spikes were measured; runtime heap growth was unavailable. | Add a dev-only performance/memory probe before a larger content budget, not as player-facing scope. | P2 | Yes for significant content expansion if spikes grow. |
| Overall game feel | Animation depth and AI simplicity are the visible ceiling. | Raise the two focused quality ceilings without adding content. | P1 | No for controlled foundation work. |

## Final acceptance gates

| Gate | Result |
|---|---|
| Complete match from start to victory | PASS — integrated economy/construction/combat match at ~0:53. |
| Defeat functions | PASS — passive defense reached Crown Hall loss at ~1:31. |
| Restart is clean | PASS — victory, defeat, and rapid reset probes returned to Daybreak 0:00 with initial resources and selection. |
| No playable placeholders | PASS — visual audit and manifest agree; legacy meadow is not loaded. |
| Gameplay-required animations exist | PASS — all current states have authored/fallback directional coverage; four Villager task loops now include authored contact/recovery depth, while carry and military action depth remain below 9. |
| Correct directions and grounded units/buildings | PASS — four authored columns, anchors, shadows, collision, and normal/zoom inspection. |
| Impassable objects respected | PASS — movement harness and direct footprint checks report zero violations. |
| All current resources gather/deposit | PASS — Food, Wood, Stone browser orders plus source depletion/cap probes. |
| Construction from placement to completion | PASS — valid/invalid preview, foundation, staged progress, completed Hearth House, health/function panel. |
| Combat contact matches damage | PASS — event-gated contact, LOS, range, health, death, and retargeting probes. |
| Dead entity/building cleanup | PASS — death window and destruction cleanup; destroyed drop-off routing fixed. |
| Interface communicates state | PASS — selection/task/cargo/resources/building/placement/outcome feedback exercised. |
| Camera responsive and stable | PASS — default normal/zoom/pan inspection and source timing audit; supported layout checks are retained from the previous UX pass. |
| Significant console/runtime errors absent | PASS — final browser logs empty across fresh load, commands, matches, outcomes, and restart. |
| Ordinary-match performance stable | PASS — measured render and simulation costs remain within ordinary frame budget; long-tail spikes are documented. |
| Documentation reflects implementation | PASS — this certification plus Dev Log, Animation Coverage, Art Bible, and Asset Manifest updated. |

## Five highest-priority remaining refinements

1. Add the dedicated Crown Guard/Ashen Raider multi-frame attack/recoil depth needed to move combat animation from readable to professional-release quality.
2. Hand-tune Villager carry weight shifts and optional worker hit/death depth while preserving the four-direction ground/feet contract.
3. Resolve the few remaining large-object worker occlusion cases through approach-point and art treatment adjustments.
4. Add a developer-only long-tail performance/heap probe before increasing the asset or entity budget.
5. Hand-tune current enemy raid/defense pacing and a small authored effects pass without adding new content categories.

No major expansion is recommended in this document. The current slice is conditionally certified for focused polish only; controlled content expansion should wait until the remaining military/carry animation refinements and a direct heap/performance probe are addressed.

## Autonomous audit and Villager action-loop completion — 2026-08-16

This amendment supersedes the earlier animation-depth portion of the certification while preserving its complete-match, stability, economy, construction, combat, AI, and restart evidence.

- Added and integrated four original RGBA Villager task-loop atlases: Wood, Food, Stone, and Construction.
- Each new atlas is 1254 x 1254, four frame columns by four authored direction rows, with a fixed feet/shadow baseline.
- Updated the shared animation resolver and developer viewer to support frame-column atlases without changing the existing directional contract.
- Aligned resource collection and construction strike ratios to the authored contact frame.
- Added a screen-front preference to resource interaction-slot routing to prevent a valid worker position from disappearing behind a canopy.
- Post-change browser render diagnostics remained clean: 0.186 ms average, 0.300 ms p95, 0.400 ms max in the measured window; browser logs were empty.
- Live play rechecked Wood, Food, Stone, Construction, invalid/valid placement, selection/task text, and reset. Existing full victory, defeat, combat, pathfinding, and restart evidence remains valid after the targeted changes.

The remaining conditional items are genuine: Crown Guard/Ashen Raider action depth, Villager carry/optional worker combat depth, occasional large-object occlusion cases, and unavailable runtime heap telemetry. None is a blocker for the current tiny match; all are blockers to claiming the final visual standard or starting broad expansion.

## FINAL RECERTIFICATION — POST-AUDIT CONVERGENCE — 2026-08-16

This matrix is the current scorecard after live verification, six new asset integrations, renderer regression repair, and the focused deterministic regression suite. Scores were raised only where the live result demonstrated the improvement.

| Category | Score | Evidence | Remaining deficiency | Required correction | Severity | Blocks expansion? |
|---|---:|---|---|---|---|---|
| Art direction | 8 | Live 1280 × 720 map, zoom, generated families, and UI remain one warm historical RTS language. | Rare tall-object occlusion and incomplete response animation keep the art from final release polish. | Finish existing military response depth and hand-tune the few occlusion cases. | P1 | Yes for broad expansion; no for focused polish. |
| Asset consistency | 9 | Six prepared atlases share Crownforge palette, lighting, scale, alpha, and anchors; rejected drafts are unreferenced. | None material in the current slice. | Maintain manifest and source-preparation gate. | — | No. |
| Unit identity consistency | 9 | Villager, Crown Guard, and Raider silhouettes remain stable across base and new action atlases. | None material at RTS distance. | Preserve silhouettes in the remaining response pass. | — | No. |
| Unit animation coverage | 8 | Four-direction Villager task/carry/build loops; four-direction military attack phase loops; viewer reports authored frames. | Military walk/hit/death and optional Villager hit/death remain single-pose. | Complete the existing response families without new units. | P1 | Yes for final art-standard claim. |
| Directional accuracy | 9 | All new carry and attack atlases resolve rows 0–3; live Guard faces Ashen Camp rather than defaulting south. | Four-direction contract remains intentionally not eight-direction. | Keep authored 4/4 direction mapping; expand only if camera scope changes. | — | No. |
| Locomotion | 8 | Fixed-step acceleration/braking and existing Villager walk remain grounded; live carry movement is readable. | Crown Guard/Raider locomotion remains single-pose and lacks final stride depth. | Add matched military walk depth and recheck acceleration at RTS distance. | P1 | Yes for final unit standard. |
| Pathfinding | 8 | Deterministic route, resource approach, building avoidance, and repath regression checks pass. | Sealed routes report failure rather than offering deeper recovery. | Keep current A* contract; fix only demonstrated unreachable scenarios. | P2 | No. |
| Local avoidance | 8 | Resource slots and crowd separation prevent exact stacking in current stress checks. | No formation-grade crowd solver for larger armies by design. | Retain mild separation; do not add formations. | P2 | No. |
| Collision | 8 | Units remain outside resource/building footprints; reset and placement probes pass. | Crowds can still become visually dense in unusual arrangements. | Tune current separation thresholds only if a live defect reproduces. | P2 | No. |
| Gathering | 9 | Live Wood order reached node, gathered, depleted capacity, returned, and raised storage to `180 / 180`; deterministic 20/60 Hz exact match. | No production/consumption sink by explicit slice scope. | Preserve current economy; do not add a sink in this convergence pass. | — | No. |
| Carrying and depositing | 8 | Four new carry loops, cargo badges, live `2 carrying`, deposit, and cargo-preserving retask all pass. | Approach routing remains simple; Food/Stone/Supplies loops need longer repeated live observation than Wood. | Repeat all three resource return cycles during the next visual QA pass. | P2 | No. |
| Construction | 8 | Placement rejection, foundation, staged health/progress, builder route, and automated completion pass. | One buildable structure and restrained construction feedback remain the current ceiling. | Hand-tune existing stage/worker feedback before another blueprint. | P2 | No. |
| Building integration | 8 | Buildings are selectable, grounded, collidable, staged, and route-blocking. | Rare large-building occlusion cases remain possible. | Tune approach points and depth treatment around current buildings. | P2 | No. |
| Combat | 8 | Attack timing, LOS, health, target loss, damage, death, combat slots, and live Guard-on-Camp damage pass. | Military walk/hit/death depth remains incomplete; Raider live action is viewer-verified more than screenshot-captured. | Complete matched existing response family and repeat multi-battle browser QA. | P1 | Yes for broad expansion. |
| Enemy behavior | 7 | Capped replacement, defense, occasional raid, victory, defeat, and complete-match evidence pass. | AI is intentionally simple and has no worker economy or deeper staging. | Tune only current pacing/readability; no AI civilization system. | P2 | Yes for AI/content expansion. |
| Lighting | 9 | Post-change benchmark stable; generated assets match upper-left/front key and grounded shadows. | No material current deficiency. | Preserve shared grade during future asset work. | — | No. |
| Color hierarchy | 9 | Resources, factions, health, placement, and outcomes remain visually separated without neon clutter. | None material in current viewport. | Preserve restrained palette. | — | No. |
| Terrain | 8 | Meadow, dirt, path, flowers, stones, and resource bases remain coherent at normal/zoomed views. | Small board remains a single authored terrain treatment; no dynamic transitions by scope. | Improve only visible seams/scale issues if found; do not add terrain systems. | P3 | No. |
| Depth sorting | 8 | Screen-front resource preference fixed the concrete rear-node disappearance; selected markers stay readable. | A few rare tall-object edge views may still cover an interaction pose. | Hand-tune remaining approach points or authored object treatment. | P1 | No. |
| UI clarity | 8 | Resource totals, task, cargo, selection, health, placement, outcomes, and controls are readable in live play. | Minimal command deck and help text remain intentionally compact; no deeper command queue. | Preserve hierarchy; only correct a reproduced ambiguity. | P3 | No. |
| Camera controls | 8 | WASD/arrows, wheel zoom, and middle drag remain stable in supported 1280 × 720 browser view. | No edge scroll and no camera rotation by design. | Do not add camera features during convergence. | P3 | No. |
| Audio feedback | 8 | Gesture-unlocked procedural cues remain event-driven and clean through reset/outcomes. | No authored recording or music layer. | Keep procedural layer quiet; defer audio expansion. | P3 | No. |
| Performance | 8 | Equivalent benchmark reports `0.222 ms` avg, `0.300 ms` p95, `0.400 ms` max; regression script is fast and stable. | Browser heap/GPU counters remain unavailable; broader asset budget is unmeasured. | Add direct dev-only heap/texture probe before significant expansion. | P2 | Yes for significant content/entity expansion. |
| Stability | 9 | Syntax, asset load, deterministic regression suite, live commands, combat, reset, and outcomes pass without reported console errors. | No material current stability defect. | Keep focused regression suite in the project. | — | No. |
| Restart behavior | 9 | Fresh reset restores Daybreak 0:00, initial resources, three selected Villagers, visible workers, and clean outcome state. | Three-consecutive live browser matches were not re-run after the new visual assets; deterministic reset checks pass. | Repeat three full browser matches before a final release claim. | P2 | Yes for final release claim; no for focused polish. |
| Overall game feel | 8 | The slice reads as a coherent, small RTS with visible economy, construction, combat, AI, and outcomes. | Animation depth and intentionally simple AI are still visible ceilings. | Finish existing military response family and re-audit, with no content expansion. | P1 | Yes for broad expansion. |

### Score interpretation

Scores below 9 are not failures of the playable slice. They identify genuine, bounded polish gaps or deliberate scope ceilings. The conditional result is retained because the acceptance bar for a full PASS requires every gameplay-required action to reach professional-quality depth, not merely to function.

## Current acceptance gates

| Gate | Current result |
|---|---|
| Complete match can run | PASS — previous complete victory/defeat matches remain valid; post-change live attack/economy smoke passes. |
| Victory, defeat, and reset | PASS — direct and prior live outcome checks; new reset visibility regression fixed. |
| Three consecutive matches | CONDITIONAL — deterministic resets pass; repeat browser matches are still a final-release gate. |
| No placeholders / generated assets used | PASS — six new prepared assets are active; rejected drafts are not referenced. |
| Gameplay-required state/direction coverage | PASS for the current playable contract; art-standard depth remains below final in military walk/hit/death. |
| Grounding, collision, interaction positions | PASS — reset, placement, resource, and footprint probes; rare occlusion remains a polish item. |
| Economy, construction, combat, AI | PASS for current scope. |
| No significant runtime errors / missing requests | PASS — live browser and QA viewer showed no reported errors or missing asset requests. |
| Memory / restart degradation | CONDITIONAL — no heap/GPU counter is exposed; no degradation was observed in available reset/runtime checks. |
| Documentation | PASS — this matrix plus the remediation backlog, convergence report, Dev Log, Animation Coverage, Art Bible, and Asset Manifest are updated. |

## Current certification result

**CONDITIONAL PASS — The vertical slice is stable and playable, but the specified non-blocking quality deficiencies remain.**

No major expansion is recommended. The next repair target is the existing Crown Guard/Ashen Raider walk, hit, and death response family.
