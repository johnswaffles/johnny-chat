# September 29 — Silverwood living-gorge preview

Local preview only. Source opt-in `/?gorge=1`; art review `tests/gorge-review.html?gorge=1`. No public mirror synchronization or deployment in this change.

## Scope

New original cloud, distant-landscape and near-ridge assets. Separate WebGL background plus existing crisp gameplay canvas. Clouds move at rest; bounded downward water material follows the river lip; basin mist and canopy-local deformation share the paused renderer clock. Static camera factors .06 / .12 / .42 create depth. Legacy panorama and translucent repeating scenery are not drawn while the new study is active.

Only the first section (camera 0–1800) is rebuilt. A temporary hard handoff returns to existing scenery afterward. A future whole-level integration must author a coherent transition rather than publish that handoff. No 3D mesh-world migration or full volumetric simulation is claimed.

## Verification

- Existing Node suite: **73 / 73 passed**. No gameplay mechanics or level geometry changed.
- Browser shader compile/link validated after repairing an initial vertex/fragment precision mismatch. Runtime WebGL error: **0**.
- Visual review: forest/tree crown, river source and waterfall, supported aqueduct columns; independent clouds and horizon visible. Rejected the first ridge asset because its canopy clipped; v2 has clearance above the crown.
- Runtime framebuffer comparison: time 0 differs from time 20 at a fixed camera (**PASS**); re-render at unchanged time yields identical pixels (**PASS**).
- Simulated WebGL context loss: previous-background fallback visible (**PASS**); restoration recreates textures/programs and resumes the new scene (**PASS**).
- Preserved independent foreground resolution, keyboard/controller paths, existing combat effects, memories removal and save namespace.

## Performance (Codex in-app browser, 1364 × 899, DPR 1)

Same existing sustained-staff-fire test, 30 warm-up frames followed by 299 measured intervals. Reactive spell lighting enabled.

| Scene | Enemies | Quality | Mean frame | p95 frame | Mean JS work | p95 JS work |
|---|---:|---|---:|---:|---:|---:|
| New gorge | 2 | Rich | 16.67 ms | 18.10 ms | 0.96 ms | 1.80 ms |
| Previous scene, new scenery disabled | 2 | Rich | 16.67 ms | 18.00 ms | 1.19 ms | 2.10 ms |
| New gorge stress | 12 | Rich | 16.67 ms | 18.20 ms | 0.95 ms | 1.90 ms |

These samples average approximately 60 FPS, not a universal locked-60 guarantee. JS work is CPU submission time, not a GPU timestamp measurement. Retina/other browsers/devices are not covered by these numbers. Context recovery and pixel-readback checks live only in the explicit QA page; no gameplay readback is added.

## Asset provenance

Built-in image generation, prompts and selected versions in `docs/art/GORGE_STUDY.md`. Existing approved assets preserved. New assets load only for the opt-in gorge preview; they do not add loading cost to the baseline route.
