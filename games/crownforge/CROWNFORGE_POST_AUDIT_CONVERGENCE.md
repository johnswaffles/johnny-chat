# CROWNFORGE POST-AUDIT CONVERGENCE

Date: 2026-08-16
Scope: Independent reconciliation and remediation of the previous conditional pass.
Expansion boundary: Existing Crownforge units, buildings, resources, map, AI, UI, and match loop only.

## PREVIOUS CERTIFICATION

Previous result: **CONDITIONAL PASS — The vertical slice is playable, coherent, and stable, with specified non-blocking military/carry animation-depth refinements remaining.**

Previous highest-priority recommendation: matched Crown Guard/Ashen Raider multi-frame attack/recoil depth. The previous pass also recorded Villager carry depth, rare large-object occlusion, capped AI, and unavailable runtime heap telemetry as remaining limitations.

## CLAIMS VERIFIED

- The existing fixed-step simulation, pathfinding, economy, construction, combat, AI, UI, victory, defeat, restart, audio cleanup, and render-timing hardening remain active.
- Wood, Food, and Stone remain registered as the only current resource types and the live Wood loop still routes, gathers, carries, deposits, and updates the player total.
- Existing construction stages and building collision remain intact.
- The existing enemy Camp loop remains capped, readable, and outcome-complete rather than expanding into a civilization AI.
- No player-facing placeholder, generic box, emoji, debug overlay, or unrelated asset family is loaded by the playable slice.

## CLAIMS REJECTED

- “Villager carry is still a single-pose state” is no longer true. Four-frame directional carry loops now render for Wood, Food, Stone, and Supplies.
- “Military attack is still entirely a single-pose bridge” is no longer true. Crown Guard and Ashen Raider now have matched directional ready/anticipation/contact/recovery attack phases.
- “Fresh reset visibly presents the intended workers” was not true after the new atlas integration. The renderer's numeric-row fallback and starting composition both required repair.
- A previous broad “all visual issues are fixed” interpretation is rejected. Military walk/hit/death depth, rare occlusion, and direct heap/GPU telemetry remain unresolved.

## NEW DEFECTS

1. `CF-CONV-001`: the renderer treated legacy object-form Villager row metadata as a number, producing `NaN` cell height and invisible Villager bodies after the new atlas integration.
2. `CF-CONV-002`: starting worker coordinates were mechanically valid but visually buried against the Crown Hall/tree composition.
3. `CF-CONV-003`: generated carry/attack source paths required explicit preparation and rejection of matte/fringe drafts before runtime integration.
4. `CF-CONV-004`: direct browser heap/GPU telemetry remains unavailable; only canvas timing and deterministic source probes can be claimed.

All four were recorded in `CROWNFORGE_REMEDIATION_BACKLOG.md`; the first three are fixed and verified, and the fourth remains a documented measurement limitation.

## REMEDIATION COMPLETED

- Added four Villager carry atlases and two matched military attack atlases.
- Added data-driven frame-column metadata and shared frame resolution for the new states.
- Updated combat rendering to resolve phase-specific atlases while preserving the existing base idle/walk/hit/death family.
- Added numeric metadata fallback so legacy and frame-column Villager atlases can coexist safely.
- Moved starting Villagers to the clear south approach and verified they are outside player building footprints.
- Added the deterministic `tools/remediation-regression.mjs` suite.
- Kept screen-front resource interaction preference and all existing collision/pathfinding contracts.
- Rejected generated drafts with colored fringe or checkerboard/matte residue.

## ASSET FAMILIES COMPLETED

| Family | Files | Result |
|---|---|---|
| Villager Wood carry | `villager-carry-wood-loop-v1.png` | 4 frames × 4 directions; live loaded and used. |
| Villager Food carry | `villager-carry-food-loop-v1.png` | 4 frames × 4 directions; clean prepared output used. |
| Villager Stone carry | `villager-carry-stone-loop-v1.png` | 4 frames × 4 directions; live source mapped. |
| Villager Supplies carry | `villager-carry-supplies-loop-v1.png` | 4 frames × 4 directions; construction cargo source mapped. |
| Crown Guard attack | `crownforge-soldier-attack-loop-v1.png` | 4 directions; ready/contact/recovery phase source used by live renderer. |
| Ashen Raider attack | `crownforge-raider-attack-loop-v1.png` | 4 directions; matched phase source used by shared resolver. |

All six are `1254 × 1254` RGBA and visually belong to the existing Crownforge family. The rejected food fringe/matte drafts are not runtime assets.

## ANIMATION COVERAGE CHANGES

- Villager Wood, Food, Stone, and Supplies carry states: 4 authored frames × 4 directions.
- Crown Guard attack anticipation: columns 0–1, contact: column 2, recovery: columns 3–0, rows 0–3 for directions.
- Ashen Raider attack uses the same phase contract and direction coverage.
- Existing event timing remains fixed-step and contact-gated; damage does not occur before the visible contact phase.
- Remaining single-pose states are explicitly limited to Crown Guard/Ashen Raider walk, hit, death and optional Villager hit/death.

## REGRESSION TEST RESULTS

### Automated

`node tools/remediation-regression.mjs` passed:

- directional carry/attack atlas resolution;
- fresh reset worker visibility and building clearance;
- 20 Hz versus 60 Hz gathering convergence;
- cargo-preserving retask and storage return;
- placement rejection and Hearth House completion;
- melee damage, lethal death state, victory, and defeat.

### Manual/live

- Fresh 1280 × 720 load: three Villagers visible, selected, grounded, and free of square backplates/halos.
- Wood: precise right-click target, route, carry state (`2 carrying`), storage return, and Wood total reaching `180 / 180`.
- Food: right-click berry target, visible basket carry state (`1 carrying`), resource-specific worker feedback, and live interaction beside an Ashen Raider.
- Stone: right-click stone target, visible stone carry state (`1 carrying`), grounded approach, and resource-specific carry feedback.
- Crown Guard: selected unit closed on Ashen Camp; camp health fell to `31 / 85 HP` during the smoke battle and the guard showed incoming health feedback.
- Animation viewer: all four Villager carry states reported `4 authored frames · asset loaded`; each military attack phase reported the correct atlas and authored directional rows.
- Browser asset inspection: new PNG URLs loaded; no missing requests or reported console errors.
- Existing complete victory, defeat, restart, construction, pathfinding, and multi-resource evidence remains valid; the deterministic suite re-covered the cross-system essentials after the renderer changes.

## PERFORMANCE COMPARISON

Equivalent `?lighting-benchmark` canvas timing samples:

| Sample | Average | P95 | Max | Interpretation |
|---|---:|---:|---:|---|
| Previous stable audit sample | 0.186 ms | 0.300 ms | 0.400 ms | Baseline already below the ordinary frame budget. |
| Current post-remediation sample | 0.222 ms | 0.300 ms | 0.400 ms | Average increased by 0.036 ms (~19%); tail metrics unchanged. |

The new asset families therefore show no material render regression at current entity counts. The browser surface still exposes no reliable runtime heap/GPU counters, so memory stability is not overstated. Existing source-side simulation measurements remain below the ordinary frame budget from the prior certification.

## REMAINING DEFECTS

Ranked by severity:

1. **P1 — Military response depth:** Crown Guard/Ashen Raider walk, hit, and death rows remain single-pose. The new attack depth is real but does not complete the full military quality standard.
2. **P1 — Rare occlusion:** A few tall-object edge cases may still hide an interaction pose even though the concrete rear-resource failure is fixed by screen-front slot scoring.
3. **P2 — Direct telemetry:** Runtime heap/GPU counters are unavailable in the current browser evaluation surface. This limits a full release-memory claim and should precede significant content expansion.
4. **P2 — Browser three-match recertification:** Deterministic reset/outcome checks pass, but three consecutive full browser matches were not repeated after this narrow visual integration.
5. **P2 — AI scope ceiling:** Enemy intelligence is intentionally limited to capped replacement, defense, and occasional raids. This is a deliberate boundary, not permission to expand the system during this pass.

## FINAL CONVERGENCE RESULT

The game has converged to a stable, coherent, playable small vertical slice and the targeted Villager carry / military attack gaps have materially improved. It has not converged to the final professional visual standard because the remaining military walk/hit/death depth, rare occlusion, and direct telemetry limitations are genuine.

**CONDITIONAL PASS — The vertical slice is stable and playable, but the specified non-blocking quality deficiencies remain.**

No major expansion should begin. The next repair target is the existing Crown Guard/Ashen Raider walk, hit, and death response family.
