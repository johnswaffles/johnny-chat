# Crownforge Visual and Spatial Audit

Audit date: 2026-08-16
Runtime marker: `20260816-integrity1`
Scope: existing playable slice only.

## Issue registry

| ID | Area | Reproduced | Root cause | Repair/status |
|---|---|---:|---|---|
| CF-VIS-001 | Cropped trees and bushes | Partially | Several authored environment silhouettes touch raw atlas cell boundaries, which is a bleed risk; the current renderer already used a source-cell inset. | Viewer now uses the same inset as the live renderer; the active atlas audit and local/live visual review show no visible crop. Verify again after deployment. |
| CF-VIS-002 | Marauder axe clipping and detached attack pixels | Yes | The v2 generated 4 × 4 attack sheet contained weapon pixels crossing frame boundaries, and one back-left strip included a detached blade fragment inside its recovery frame. | Rebuilt as `crownforge-raider-attack-loop-v3.png`, replaced the faulty back-left contact/recovery cells, and validated every cell. |
| CF-VIS-003 | Marauder directional movement | Not reproduced in current source | The current configuration already maps a four-direction walk loop and uses the unit’s resolved movement direction. The reported appearance was consistent with the older deployed/cached visual state. | Viewer matrix confirms all four walk directions load. No new gameplay logic was added. |
| CF-VIS-004 | Floating people or objects | Not reproduced | Current ground anchors, painted shadow anchors, and source sampling were already aligned in the tracked source. | Fresh local reset screenshot and viewer guides show grounded feet/shadows. |
| CF-VIS-005 | Incorrect environment layering | Not reproduced at normal/close audit views | Entities are depth-sorted by ground point; world-space health bars and selection rings are rendered in controlled passes. | Local map review showed buildings, units, resources, and UI in expected layers. Keep current sort contract. |
| CF-VIS-006 | Unnatural bush/rock/tree stacking | Not reproduced in current seeded layout | Current seeded coordinates and resource interaction slots are separated; no duplicate stack was present in the clean source. | Movement stress and reset clearance checks pass. Continue to watch authored coordinates when map art changes. |
| CF-VIS-007 | Starting buildings too close or visually merged | Not reproduced | The current 90 × 73 map uses enlarged building footprints and explicit starting clearances. | Fresh 1280 × 720 view shows separated Hearth House, Crown Hall, Waystore, and Ashen Camp. |
| CF-VIS-008 | Combat hit-state depth | Yes as a coverage gap | Soldier and raider `hit` clips intentionally fall back to `idle`; this is visible in the QA viewer metadata. | Not changed in this pass. It is a documented polish item, not a missing runtime asset. |

## Spatial acceptance rules

- World entities keep their simulation ground point independent from sprite height.
- Buildings reserve their full footprint plus collision clearance.
- Units use their collision radius and interaction radius separately.
- Resource workers stop at interaction slots outside the resource footprint.
- Static objects are never silently placed on top of an existing building or unit.
- Starting placement is validated on reset; a failed placement is a development-visible error rather than a silent overlap.

## Visual acceptance rules

- No active asset may be missing, placeholder-named, dimension-mismatched, or visibly clipped at a source-cell edge.
- A generated atlas is inspected both as a complete sheet and at runtime size.
- Four-direction mobile-unit coverage is checked in the developer viewer.
- The live route is checked after cache-marker changes so source and deployed art cannot drift.

## Current conclusion

The only directly reproduced player-facing defect requiring a new runtime asset was the marauder attack weapon corruption. The environment family is now under explicit boundary and runtime sampling verification. The remaining documented quality gap is authored hit/death depth, which should be addressed before claiming the combat art family is final, but it does not justify expanding the game’s content scope.
