# CROWNFORGE POST-AUDIT REMEDIATION BACKLOG

Date: 2026-08-16
Scope: Reconciliation of the previous conditional pass with the live build, focused animation completion, regression repair, and release evidence.
Boundary: Existing units and systems only. No new civilization, building, resource, campaign, technology, or combat class is authorized by this backlog.

## Status key

- **FIXED AND VERIFIED** — repaired in the current build and covered by direct or live evidence.
- **PARTIALLY FIXED** — the named part is repaired, but a bounded remainder is still real.
- **INTENTIONAL BOUNDARY** — current behavior is deliberate scope, not a defect to solve by expansion.
- **OPEN** — unresolved and should remain in the queue.

## Reconciled issue registry

| ID | Original source | Entity / system | Symptom or claim | Current verified status | Reproduction / evidence | Root cause | Related assets / code | Dependencies | Severity | Visibility | Frequency | Complexity | Regression risk | Required correction / test | Acceptance criteria | Final status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CF-AUD-001 | `CROWNFORGE_MASTER_AUDIT.md` | Villager task animation | Wood, food, stone, and construction were single-pose actions. | Four-frame directional loops are live. | Animation viewer reports four frames for all four directions; browser Wood/Food/Stone/Build states render. | Legacy task atlas had state coverage but no action depth. | `villager-gather-*-loop-v1.png`, `villager-construct-loop-v1.png`; `src/animation.js`, `src/renderer.js` | Existing Villager feet/scale contract | P1 | High | Every task order | Medium | Medium | Keep event contact on authored contact frame; repeat live task test. | Four authored frames, 4/4 directions, grounded contact, one collection/build event per cycle. | FIXED AND VERIFIED |
| CF-AUD-002 | `CROWNFORGE_MASTER_AUDIT.md` | Villager event timing | Tool/contact feedback could drift from the visible action. | Contact timings are aligned to frame 2 / 0.6 phase. | Direct frame/event probe and live gather/build screenshots. | Gameplay ratios and clip phase were separate. | `src/animation.js`, `src/simulation.js`, `src/audio.js` | New task loops | P1 | Medium | Every gather/build cycle | Low | Medium | Preserve fixed-step timing and event dedupe. | Contact event lands once on the authored contact phase at 20/60 Hz. | FIXED AND VERIFIED |
| CF-AUD-003 | `CROWNFORGE_MASTER_AUDIT.md` | Resource interaction / occlusion | A worker could validly work behind a tall canopy. | Screen-front resource slots and readable start composition are live. | Live wood order showed workers outside the tree and remained visible; deterministic slot checks pass. | Shortest valid slot was preferred without a screen-front tie-break. | `src/simulation.js`, resource approach scoring | Resource footprint and pathfinding contracts | P1 | High | Resource orders near tall objects | Low | Medium | Recheck all three resource types at zoom. | Interaction positions remain outside nodes and visible in the normal camera. | FIXED AND VERIFIED |
| CF-AUD-004 | `CROWNFORGE_VERTICAL_SLICE_CERTIFICATION.md` | Simulation timing | Render cadence could diverge movement/economy. | Fixed-step accumulator remains live. | Automated 20 Hz vs 60 Hz gathering convergence; prior 30-second exact-state probe. | Variable-step gameplay update. | `src/simulation.js` | None | High | High | Any throttled tab / cadence | Medium | High | Keep fixed 60 Hz and bounded catch-up. | Same clock, positions, cargo, totals, node amount, combat phase, and outcome. | FIXED AND VERIFIED |
| CF-AUD-005 | `CROWNFORGE_VERTICAL_SLICE_CERTIFICATION.md` | Drop-off destruction | Cargo could retain a destroyed Waystore route. | Destroyed storage is excluded immediately; Crown Hall fallback works. | Direct destroyed-dropoff probe and construction/combat cleanup tests. | Storage lookup ignored destruction fade. | `src/simulation.js` | Building destruction cleanup | High | Medium | Destruction while carrying | Low | Medium | Keep fallback coverage after any building changes. | Worker deposits or safely holds cargo after storage destruction. | FIXED AND VERIFIED |
| CF-AUD-006 | `CROWNFORGE_VERTICAL_SLICE_CERTIFICATION.md` | Render feedback | Ripple lifetime was frame-rate dependent. | Measured render delta is used. | Render benchmark and normal command feedback. | Fixed per-frame age increment. | `src/renderer.js` | Browser frame timing | Medium | Low | Command feedback | Low | Low | Retain bounded delta. | Ripple lifetime remains stable across ordinary cadence changes. | FIXED AND VERIFIED |
| CF-AUD-007 | `CROWNFORGE_VERTICAL_SLICE_CERTIFICATION.md` | Audio context | Resume rejection could produce an unhandled promise. | Gesture resume is safely handled. | Fresh load, UI gesture, reset, victory, defeat; no reported browser errors. | Unhandled `AudioContext.resume()` promise. | `src/audio.js` | Browser gesture policy | Medium | Low | First audio gesture | Low | Low | Keep rejection handling and reset cleanup. | No unhandled audio rejection and later gestures can retry. | FIXED AND VERIFIED |
| CF-AUD-008 | `CROWNFORGE_MASTER_AUDIT.md` | Crown Guard / Ashen Raider animation | Walk, hit, and death depth were previously reported as one-pose; attack was previously reported as a single authored pose. | Attack, walk, hit, and death now resolve to matched four-frame directional clips locally; final visual quality still needs an allowed player-visible confirmation. | QA viewer and deterministic regression confirm 4/4 walk, attack, hit, and death rows with no fallback; Browser confirmation remains blocked for the isolated preview. | Earlier notes predated the active walk/response atlas integration. | `crownforge-soldier-walk-loop-v3.png`, `crownforge-raider-walk-loop-v2.png`, `crownforge-soldier-attack-loop-v1.png`, `crownforge-raider-attack-loop-v1.png`, `crownforge-soldier-hit-loop-v1.png`, `crownforge-raider-hit-loop-v1.png`, `crownforge-soldier-death-loop-v1.png`, `crownforge-raider-death-loop-v1.png`; `src/animation.js`, `src/renderer.js`, `tools/remediation-regression.mjs` | Existing combat timing and silhouette | P1 | High | Every melee engagement | Medium | Medium | Confirm matched walk depth in an allowed preview without changing the current asset family speculatively. | Four directions preserve weapon identity, ground contact, facing, and readable locomotion/response timing. | FIXED AND VERIFIED LOCALLY |
| CF-AUD-009 | `CROWNFORGE_MASTER_AUDIT.md` | Villager carry animation | Cargo was distinct but static per direction. | Four-frame wood, food, stone, and supplies carry loops are live. | QA viewer reports 4 authored frames × 4 directions; live wood screenshot showed two carrying workers and cargo badges. | Carry atlas prioritized silhouette/readability over motion. | `villager-carry-wood-loop-v1.png`, `villager-carry-food-loop-v1.png`, `villager-carry-stone-loop-v1.png`, `villager-carry-supplies-loop-v1.png`; config/animation/renderer | Existing cargo badge and deposit loop | P1 | High | Every return trip | Medium | Medium | Keep carry loops subtle; test each resource and deposit. | Cargo remains attached/aligned, feet grounded, and state returns cleanly to work after deposit. | FIXED AND VERIFIED |
| CF-AUD-010 | `CROWNFORGE_MASTER_AUDIT.md` | Ashen AI | No enemy worker economy or deep strategy. | Capped raids, replacement, defense, and outcome logic remain deliberate scope. | Complete match, capped unit probe, defense/raid behavior. | Milestone intentionally requires readable enemy presence only. | `src/simulation.js` AI section | No expansion authorized | P2 | Medium | Match pacing | Low | High if expanded | Only tune current pacing when a concrete regression appears. | No spam, readable attacks, working victory/defeat, and no new strategy systems. | INTENTIONAL BOUNDARY |
| CF-CONV-001 | Newly discovered during current convergence QA | Villager renderer metadata | New action atlas integration initially made Villagers invisible because legacy atlas metadata used an object for `rows`, producing `NaN` cell height. | Numeric metadata fallback is in `drawVillagerAsset`; fresh browser map shows all three Villagers. | Fresh reset before fix showed selection rings without bodies; post-fix screenshot shows three grounded Villagers; syntax and live load pass. | Renderer assumed every `rows` value was numeric. | `src/renderer.js` metadata fallback; `src/config.js` atlases | Legacy Villager motion/task atlas format | High | High | Every fresh launch after the integration | Low | High | Retain numeric fallback and add regression assertion for reset visibility/atlas loading. | All three starting Villagers render on a fresh reset with no NaN geometry or console error. | FIXED AND VERIFIED |
| CF-CONV-002 | Newly discovered during current convergence QA | Reset composition / Villager placement | Initial workers were technically present but could read as hidden against tall Crown Hall/tree silhouettes. | Starting positions now use a clear south approach; all three are visible and outside player building footprints. | Fresh 1280 × 720 screenshot and automated reset clearance check. | Opening coordinates were valid mechanically but visually buried by projected depth. | `src/simulation.js` `_seedWorld()` | Existing map composition and collision | Medium | High | Every reset | Low | Medium | Preserve clear start composition when map art changes. | Three selected Villagers are visible, grounded, and not inside buildings at Daybreak 0:00. | FIXED AND VERIFIED |
| CF-CONV-003 | Newly discovered during current convergence QA | Asset/runtime integration | New generated drafts could have been accidentally referenced instead of clean prepared outputs. | Six clean RGBA outputs are the only runtime sources; fringe/checkerboard drafts are rejected. | Asset preparation tool, PNG metadata, browser asset load list, QA viewer. | Image generation can return matte/fringe variants requiring cleanup. | `tools/prepare-remediation-atlases.mjs`, six integrated PNGs | Sharp preparation and visual inspection | High | High | Asset update | Medium | Medium | Keep manifest source map and rejected-draft note current. | No raw draft URL, neutral matte, fringe, or missing request appears in the playable asset set. | FIXED AND VERIFIED |
| CF-CONV-004 | Previous audit limitation | Direct runtime telemetry | Browser heap/GPU counters were unavailable; prior render samples were not directly comparable. | Canvas benchmark telemetry is directly re-read (`0.222 ms` avg, `0.300 ms` p95, `0.400 ms` max); heap remains unavailable. | `?lighting-benchmark` canvas dataset, source simulation probes. | Browser evaluation surface does not expose reliable memory counters. | `src/renderer.js` benchmark dataset; docs | Browser surface capability | P2 | Low | Benchmark only | Medium | High for expansion | Keep dev-only render/heap probe boundary; do not claim heap stability without a counter. | Equivalent render metrics remain stable and any future memory measurement is explicit. | PARTIALLY FIXED |
| CF-CONV-005 | Newly discovered during generated-asset review | Food carry source governance | First food draft had colored edge fringe; it was not suitable for runtime. | Clean food loop is integrated; bad draft is rejected and unreferenced. | Visual inspection of raw and prepared sheets; browser loads clean output. | Generated matte/background treatment. | `assets/villager-carry-food-loop-v1.png`; preparation tool | Alpha cleanup | Medium | High | One-time asset review | Low | Low | Continue inspect → prepare → view → integrate workflow. | Runtime only references clean RGBA art with no fringe/halo. | FIXED AND VERIFIED |

## Current work queue

| Priority | Work item | Why it remains | Blocks current slice? | Exit evidence |
|---|---|---|---|---|
| P1 | Matched Crown Guard / Ashen Raider walk depth | Both active runtime sheets already provide four authored frames per direction and now have explicit no-fallback regression coverage. Final motion quality still needs an allowed player-visible confirmation. | No; it blocks a final visual-standard claim and broad expansion. | Allowed preview shows the four-frame locomotion with correct facing, feet contact, and stable scale while attack, hit, and death timing remains intact. |
| P2 | Rare tall-object occlusion tuning | Front-biased resource slots fix the concrete rear-resource failure, but a few large-object edge cases remain possible. | No. | Zoomed live map and interaction stress show visible workers at all current resources/buildings. |
| P2 | Direct heap/GPU probe | The browser surface still cannot expose reliable memory counters. | Yes for significant content/entity expansion; not for focused polish. | Dev-only probe reports equivalent heap/texture metrics across three resets. |
| P3 | Allowed live visual confirmation | The isolated local browser route is blocked, so response playback and tall-object readability still need player-visible confirmation. | No for focused polish; yes before a final release-standard claim. | Allowed preview shows current units, resources, landmarks, and response clips at normal and close zoom with no console errors. |

No backlog item authorizes new content. Blocked-destination fallback and dynamic building-blocker recovery are now covered; only allowed player-visible confirmation and the existing rare occlusion/telemetry items remain.

## Visual integrity convergence additions — 2026-08-16

| ID | Area | Finding | Repair | Evidence | Status |
|---|---|---|---|---|---|
| CF-VIS-001 | Environment atlas boundary risk | Raw tree/bush silhouettes touch some source-cell edges. | Kept authored scale; verified live one-pixel inset and added boundary audit. | `tools/visual-integrity-audit.mjs`, local and deployed 1280 × 720 map review. | VERIFIED |
| CF-VIS-002 | Raider attack weapon corruption | v2 crossed source-cell edges and included a detached back-left recovery fragment. | Generated four directional strips, composed padded v3, replaced contact/recovery cells. | v3 has zero unsafe top/left/right cells; viewer screenshot shows connected axe. | FIXED AND VERIFIED LOCALLY |
| CF-VIS-003 | Viewer/live sampling drift | QA viewer sampled full cells while live renderer inset each cell. | Viewer now shares live one-pixel inset. | All available state/direction combinations load with no missing/pending result. | FIXED |
| CF-VIS-004 | Combat hit response depth | Raider and soldier hit clips fell back to idle. | Added four-frame directional hit/recoil atlases and removed the fallback for both units. | Viewer and deterministic regression resolve `soldierHit` / `raiderHit` in all four directions with `fallback: null`. | FIXED AND VERIFIED LOCALLY |

The next work item is limited to authored Crown Guard / Ashen Raider walk depth and allowed live confirmation. No new unit, faction, or gameplay system is authorized by these entries.

## MILITARY RESPONSE CONVERGENCE — 2026-08-20

The previously open military response item is now bounded and integrated:

| Item | Status | Evidence |
|---|---|---|
| Crown Guard / Ashen Raider hit depth | FIXED AND VERIFIED LOCALLY | Four-frame directional `soldierHit` and `raiderHit` clips; regression asserts no fallback. |
| Crown Guard / Ashen Raider death depth | FIXED AND VERIFIED LOCALLY | Four-frame directional `soldierDeath` and `raiderDeath` clips; regression asserts no fallback and existing death cleanup still passes. |
| Walk and attack depth | FIXED AND VERIFIED LOCALLY | Existing four-direction walk/attack atlases remain active and are covered by the same animation contract. |
| Villager hit/death depth | FIXED AND VERIFIED LOCALLY | Four-frame directional `hitLoop` and `deathLoop` response; worker combat remains optional, but the existing response assets are integrated and regression-covered. |
| Live visual/console confirmation | OPEN | In-app Browser blocks the isolated local URL under its security policy; no unsupported live claim is made. |

The remaining queue is limited to allowed live confirmation of military walk depth, rare tall-object occlusion edge cases, unavailable heap/GPU telemetry, and release evidence. No new civilization, building, resource, campaign, age, or combat class is authorized by this amendment.

## VILLAGER RESPONSE CONVERGENCE — 2026-08-20

The optional Villager hit/death item is now integrated and no longer open:

| Item | Status | Evidence |
|---|---|---|
| Villager hit depth | FIXED AND VERIFIED LOCALLY | Four-frame directional `hitLoop` response; regression asserts no fallback. |
| Villager death depth | FIXED AND VERIFIED LOCALLY | Four-frame directional `deathLoop` response; existing death timing and cleanup regression still pass. |
| Worker response live confirmation | OPEN | Requires an allowed browser/deployed preview; isolated local URL remains blocked by the in-app Browser policy. |

The remaining queue is limited to rare tall-object occlusion tuning, unavailable heap/GPU telemetry, and live-browser confirmation. No new content category is authorized by this amendment.

## RESOURCE APPROACH READABILITY FOLLOW-UP — 2026-08-20

The existing tall-object interaction fix now has a stricter deterministic contract:

| Item | Status | Evidence |
|---|---|---|
| Screen-front resource approach preference | FIXED AND VERIFIED LOCALLY | `_sendUnitToResource` prefers a reachable free front-half slot before comparing path cost; representative medium/large tree, grove, and stone checks pass. |
| Resource capacities, collision, and gathering rates | PRESERVED | No footprint, interaction distance, depletion, or economy constants changed in this follow-up. |
| Live normal/close-zoom confirmation | OPEN | The in-app Browser rejects the isolated local preview under its security policy. |

This remains an interaction-readability correction only. No new resource type, art family, or gameplay system is authorized by this amendment.
