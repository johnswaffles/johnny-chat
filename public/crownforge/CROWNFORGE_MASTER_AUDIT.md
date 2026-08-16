# Crownforge: Dawn of Kingdoms — Master Audit

Date: 2026-08-16  
Scope: Autonomous audit, repair, asset completion, live playtest, and certification of the existing browser vertical slice.  
Expansion boundary: No new civilizations, ages, campaigns, maps, technologies, unit classes, resource types, or major gameplay systems.

## Baseline findings

The slice already had a coherent original art family, a complete small match loop, four authored unit directions, staged buildings, economy, construction, combat, capped enemy behavior, responsive controls, and a developer-only animation viewer. The audit did not find a player-facing placeholder, emoji, generic colored box, missing asset request, or debug overlay in normal play.

The material quality gaps at the start of this pass were narrower:

- Villager wood, food, stone, and construction rows were single-pose task sheets, so the worker met the state/direction contract but did not yet meet the intended action-loop standard.
- Resource interaction selection could choose a valid rear-side slot. At the fixed camera, a worker could then disappear behind a tree or berry canopy while the task continued.
- The task event ratios and the new action-loop contact frames were not yet explicitly aligned. A technically correct gather/deposit loop could show a tool pose that was already recovering when the resource event fired.
- Existing certification evidence retained four previously repaired technical findings: variable-step simulation divergence, destroyed-drop-off routing, fixed-rate ripple aging, and an unhandled audio-context resume promise.
- Crown Guard/Ashen Raider walk, attack, hit, and death depth remains intentionally restrained; their current single-pose rows are readable but below a final military-animation bar.

## Issue registry

| ID | Category | Entity/system | Symptom | Root cause / issue family | Priority | Repair performed | Assets created | Code changed | Tests | Final status |
|---|---|---|---|---|---|---|---|---|---|---|
| CF-AUD-001 | Incomplete animation family | Villager task states | Gathering and construction visually held one pose per direction. | Legacy task atlas was state-complete but action-depth incomplete. | P1 | Added separate frame-column loop atlases and shared frame mapping. | Four Villager task-loop atlases. | `src/config.js`, `src/animation.js`, `src/renderer.js`, `dev/animation-inspection.js`. | QA viewer, all four directions, live Food/Wood/Stone/Construction play. | Fixed for current worker task states. |
| CF-AUD-002 | Animation timing | Villager economy/construction | Contact feedback could occur on a non-contact pose after loop integration. | Gameplay timers and visual clip phase were independent ratios. | P1 | Set the authored contact frame and resource/construction event ratios to the same 0.6 phase; verified 1.25 s task loop. | None beyond CF-AUD-001. | `src/animation.js`; existing simulation event hooks retained. | Direct timing probe: gather and build contact resolve to frame 2; live gather/build states. | Fixed. |
| CF-AUD-003 | Occlusion / interaction | Villager resource slots | Worker could gather from behind a canopy and read as missing. | Route scoring selected shortest slot without a screen-front readability preference. | P1 | Added a deterministic screen-front bias to resource interaction-slot scoring; preserved collision and path validation. | None. | `src/simulation.js`. | Live Wood/Food gathering; resource-slot and movement stress evidence; no console logs. | Fixed. |
| CF-AUD-004 | Frame-rate correctness | Simulation | Different render cadences could diverge economy and movement. | Variable-step simulation advanced gameplay directly from render delta. | HIGH | Bounded fixed 60 Hz accumulator with capped catch-up. | None. | `src/simulation.js`. | 30 s 20 Hz vs 60 Hz exact-state probe. | Fixed and re-certified. |
| CF-AUD-005 | Destruction / economy | Drop-off routing | Cargo could retain a destroyed Waystore route. | Return lookup did not exclude destroyed buildings. | HIGH | Storage-route, return-storage, and nearest-storage queries ignore destroyed structures. | None. | `src/simulation.js`. | Destroyed Waystore fallback to Crown Hall. | Fixed and re-certified. |
| CF-AUD-006 | Render timing | Command ripples | Ripple age used a fixed per-frame increment. | Renderer effect lifetime was coupled to an assumed 60 FPS render cadence. | MEDIUM | Ripple age now advances from measured bounded render delta. | None. | `src/renderer.js`. | Lighting/render diagnostics and reset tests. | Fixed and re-certified. |
| CF-AUD-007 | Audio cleanup | Audio context | Resume rejection could become an unhandled promise. | `AudioContext.resume()` was not safely handled. | MEDIUM | Explicitly catches the resume promise while preserving gesture-unlock behavior. | None. | `src/audio.js`. | Gesture/UI/outcome logs and restart cleanup. | Fixed and re-certified. |
| CF-AUD-008 | Military animation depth | Crown Guard / Ashen Raider | Attack, walk, hit, and death depth was incomplete. | Existing combat atlas was direction-complete but deliberately minimal. | P1 | Added matched directional ready/contact/recovery attack loops; walk, hit, and death remain single-pose. | `crownforge-soldier-attack-loop-v1.png`, `crownforge-raider-attack-loop-v1.png`. | `src/config.js`, `src/animation.js`, `src/renderer.js`. | QA viewer, live Crown Guard attack, deterministic melee/death/outcome suite. | Partially fixed; walk/hit/death remain. |
| CF-AUD-009 | Carry animation depth | Villager carry states | Carry states were visually distinct but single-pose per direction. | Existing carry atlas prioritized clear cargo readability over extra motion. | P1 | Added four separate four-frame carry loops; no fake bobbing or mechanical mirroring. | Four Villager carry loop atlases. | `src/config.js`, `src/animation.js`, `src/renderer.js`. | QA viewer, live Wood carry/deposit, deterministic retask/deposit suite. | Fixed and verified. |
| CF-AUD-010 | AI scope | Ashen presence | Enemy intelligence is intentionally capped and not a full economy. | Current milestone requires readable raids/defense only. | P2 | No scope expansion; pacing remains capped and readable. | None. | No AI expansion. | Complete victory and defeat matches. | Intentional boundary, not a defect. |

## Assets created

All four assets below were generated as original Crownforge artwork, visually reviewed, cleaned to RGBA, resized to the established `1254 x 1254` atlas contract, and integrated into live rendering:

- `assets/villager-gather-wood-loop-v1.png` — 4 animation frames × 4 authored directions; axe raise, strike, contact, recovery.
- `assets/villager-gather-food-loop-v1.png` — 4 animation frames × 4 authored directions; reach, pick, basket placement, recovery.
- `assets/villager-gather-stone-loop-v1.png` — 4 animation frames × 4 authored directions; pickaxe raise, strike, contact, recovery.
- `assets/villager-construct-loop-v1.png` — 4 animation frames × 4 authored directions; hammer raise, strike, contact, recovery.

The first generated wood draft was rejected because it had a red/yellow edge fringe. A targeted cleanup iteration was also rejected until the matte/checkerboard treatment was removed. Only the clean RGBA outputs listed above were integrated.

## Assets replaced

No player-facing placeholder asset was found or removed. The four new loop families augment the existing approved `villager-task-atlas.png`; they do not overwrite the legacy sheet, which remains available as a safe fallback and historical source. No temporary icons, generic geometric sprites, emoji, debug grids, or unrelated-style rasters are loaded by the playable slice.

## Animation coverage

### Villager

- Idle: existing authored 1-frame, 4-direction motion atlas.
- Walking: existing authored 3-frame, 4-direction motion atlas.
- Gathering Wood: new 4-frame, 4-direction `woodLoop` atlas.
- Gathering Food: new 4-frame, 4-direction `foodLoop` atlas.
- Mining Stone: new 4-frame, 4-direction `stoneLoop` atlas.
- Constructing: new 4-frame, 4-direction `buildLoop` atlas.
- Carrying Wood/Food/Stone/Supplies: existing distinct 1-frame, 4-direction carry atlas; cargo badges remain quantity feedback, not replacement art.
- Attack, hit, death: existing distinct 1-frame, 4-direction combat atlas; applicable to the current optional worker combat role.

### Crown Guard and Ashen Raider

Both remain at the existing 4-direction authored idle/walk/attack/death coverage with explicit hit fallback and live attack timing. This is sufficient for the current tiny slice but remains below the future multi-frame military standard.

## Systems repaired

- Data-driven frame-column atlas loading for Villager action loops.
- Shared animation-frame resolution for live renderer and developer viewer.
- Ground-anchor-preserving rendering for the new loop atlases.
- Tool-contact timing alignment for resource collection and construction strikes.
- Screen-front resource-slot routing to keep workers readable without violating world depth sorting.
- Existing fixed-step simulation, destroyed-drop-off fallback, measured ripple timing, and safe audio resume hardening reverified.

## Test results

### Source and asset checks

- `node --check` passed for every source, developer harness, and tool module.
- `git diff --check` passed for the code/doc changes.
- All four new loop files report `1254 x 1254`, `8-bit/color RGBA` PNG.
- QA viewer loaded every new loop asset for all four directions; each reported `4 authored frames · asset loaded`.
- Browser diagnostics after new asset load: `0.186 ms` average, `0.300 ms` p95, `0.400 ms` max in the measured render window; logs were empty.

### Live gameplay

- Fresh launch: map, top bar, selection panel, environment, buildings, resources, and enemy camp visually inspected at 1280 × 720.
- Wood: selected villager, right-clicked tree, watched route/task/carry/deposit state, and confirmed the worker remained visible after front-slot routing.
- Food: selected villager, right-clicked berry bush, confirmed `Gathering Food` and Food total change.
- Stone: selected villager, right-clicked stone, confirmed `Gathering Stone` and Stone route/task state.
- Construction: opened the menu, inspected invalid and valid placement readouts, placed a Hearth House foundation, watched staged progress, and saw the new construction loop integrate with the completed building lifecycle.
- Combat, enemy behavior, victory, defeat, and replay were re-certified in the preceding complete-match certification and remained source-compatible after this render-only/worker-animation pass.

### Direct simulation and adversarial evidence

- Food, Wood, and Stone gather/deposit probes passed with AI disabled for deterministic economy assertions.
- 20 Hz versus 60 Hz fixed-step gathering returned exact matching state for 30 seconds.
- Destroyed Waystore cargo correctly fell back to Crown Hall.
- Combat death cleanup, construction completion, resource depletion, capped AI behavior, victory, defeat, and reset probes remained passing.
- Browser warnings/errors remained empty after fresh load, task commands, construction, animation viewer, and render diagnostics.

## Remaining defects

Only genuine non-blocking limitations remain:

1. Crown Guard and Ashen Raider walk/attack/hit/death rows are still largely single-pose and should receive a dedicated multi-frame combat pass.
2. Villager carry states now use four-frame directional loops; optional worker hit and death states remain single-pose and should receive motion depth only when it can be authored without losing identity or ground contact.
3. A few tall-object occlusion cases can still be improved through authored approach points and art treatment; the concrete rear-resource disappearance found here is fixed.
4. Enemy behavior is intentionally capped, and runtime heap telemetry was unavailable to the browser evaluation surface; both remain reasons to avoid a larger content budget until a future technical pass measures them directly.

No crash, blocker, missing player-facing asset, route failure, footprint violation, outcome failure, restart corruption, or important console error remains in the current slice.

## Certification status

**CONDITIONAL PASS — The vertical slice is playable, coherent, and stable, with specified non-blocking military/carry animation-depth refinements remaining.**

The current match loop is ready for further refinement, not for broad content expansion. The remaining work is polish within existing units and systems.

## Next repair priority

Create one matched multi-frame melee attack/recoil family for Crown Guard and Ashen Raider, then re-run the complete match and combat-obstacle tests. Do not add a new combat class or broader AI system before that pass is verified.

## POST-AUDIT REMEDIATION AND QUALITY CONVERGENCE — 2026-08-16 (CURRENT)

This amendment is the current reconciliation of the previous conditional pass. It supersedes the earlier statements that Villager carry and all military attack states were single-pose while preserving the remaining limitations.

### Claims verified

- Fixed-step simulation, destroyed-drop-off fallback, measured ripple aging, and safe audio resume remain active.
- Resource front-slot routing remains active; live Wood gathering now showed visible workers reaching the node, carrying cargo, and returning it to storage.
- The previous construction, combat, AI, victory, defeat, and restart evidence remains source-compatible. Focused deterministic regression checks passed again.
- No player-facing placeholder or raw generated draft is loaded.

### Claims overturned or corrected

- The previous claim that Villager carry was still single-pose is no longer current: four-frame Wood, Food, Stone, and Supplies carry loops are integrated for all four directions.
- The previous claim that military attack remained entirely single-pose is no longer current: Crown Guard and Ashen Raider now use directional ready/contact/recovery attack phases. Their walk, hit, and death rows remain single-pose.
- A newly found renderer regression briefly produced `NaN` atlas cell heights for the legacy Villager motion metadata. Numeric metadata fallback fixed it; a fresh map now visibly renders all three starting Villagers.
- Starting worker composition was mechanically valid but visually buried in the prior opening arrangement. The reset positions now use the clear south approach.

### Current repairs and evidence

- Generated and integrated six original, prepared RGBA atlases: four Villager carry loops and matched Crown Guard/Ashen Raider attack loops.
- Added `tools/remediation-regression.mjs`; it passed directional atlas resolution, fresh reset clearance, 20 Hz/60 Hz gathering convergence, cargo-preserving retask, placement rejection, construction completion, melee damage/death, victory, and defeat.
- Browser QA viewer reported all new carry states as `4 authored frames · asset loaded`; military attack anticipation/contact/recovery reported the correct atlas, rows, and authored frame counts in all four directions.
- Live browser QA at 1280 × 720 confirmed fresh Villager rendering, Wood carry/deposit (`2 carrying`, then Wood `180 / 180`), and a Crown Guard attack order that reduced Ashen Camp health while the guard took damage.
- Follow-up live resource checks confirmed Food basket carry and Stone carry states at their respective nodes, including a Food interaction beside an active Raider.
- Equivalent post-change lighting benchmark reported `0.222 ms` average, `0.300 ms` p95, and `0.400 ms` max. The browser surface still does not expose reliable heap/GPU counters; no unsupported memory claim is made.

### Remaining defects

1. Crown Guard and Ashen Raider walk, hit, and death still need authored multi-frame depth; attack depth is now improved but not complete.
2. A small number of rare tall-object interaction occlusion cases may still benefit from hand-tuned approach points.
3. Runtime heap/GPU telemetry remains unavailable in the browser evaluation surface.
4. The enemy AI is intentionally capped and simple; this is a scope boundary, not a request for expansion.

See `CROWNFORGE_REMEDIATION_BACKLOG.md` and `CROWNFORGE_POST_AUDIT_CONVERGENCE.md` for the reconciled registry and current certification matrix.

### Current certification

**CONDITIONAL PASS — The vertical slice is stable and playable, but the specified non-blocking quality deficiencies remain.**

The current slice is ready for focused polish only. Do not expand content until the existing military response family and direct performance/heap evidence are stronger.
