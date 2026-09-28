# First-level implementation plan and baseline

Local branch: codex/level1-arcade-preview in crownforge-last-star-level1-preview. No remote configured, no publish. Baseline snapshot committed before editing; docs/BASELINE_HASHES.json covers approved source. Live game and original project remain read-only.

Engine: native JavaScript, Canvas2D; assets loaded by Image.decode. One Level 1 (7900 world units), one wizard, three seals, six memories, final guardian and explicit ending/replay. Saves contain seals/memories/elapsed only. Preview uses a distinct save key. Baseline tests: 51 pass.

No .blend/source Blender export workflow exists in this project. Current art is painted PNG atlases with authored frame bounds, same side-on camera; supplemental loot will use a separate orthographic transparent sprite export script. No wizard/background replacement.

A: preserve 0.98-second held staff, add bounded hit reaction, remove passive contact damage, swept blink obstacle rejection.
B: Ember Orb + inventory charges + hold-to-select ring and unified 25% world clock.
C: Frost Fan, Chain Spark, Flask, three visible staff levels and grounded treasure.
D: roles/patterns and first-level encounter/guaranteed-pickup placement.
E: bounded VFX/audio, independent volumes, Blender supplemental sprites, HUD and performance.
F: multiple complete input replays, edge/regression tests, browser controls and interruption QA, handoff.

Baseline browser profile: Codex in-app Chromium, 1280×720, devicePixelRatio2, Rich, existing resolution cap1.5, 12 shades in Level1 arena, held basic attack, 30 warmup+299 samples: work mean0.86ms p95 1.40ms; frame interval mean24.91ms p95 50.00ms. This baseline did NOT demonstrate stable60fps. Same harness retained for after comparison.

Milestones A–F implemented in the isolated preview. Final67 tests pass; three browser full runs, three repeated simulation runs, elemental/selection/controller/replay checks and recording completed. See LEVEL1_HANDOFF.md for exact evidence and remaining manual checks. Light-mode busy scene mean16.67ms,p9517.9ms; Light now default. No scope expansion.
