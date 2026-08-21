# Crownforge Animation Coverage

Date: 2026-08-16  
Pass: Animation architecture, asset completeness, state coverage, and technical hardening audit  
Scope: Existing units only. No new units, buildings, resources, factions, maps, or gameplay systems were added.

## Audit conclusion

The playable slice has three animated unit families: Villager, Crown Guard, and Ashen Raider. All gameplay-critical states currently used by the simulation have authored artwork in the correct Crownforge asset family. The primary deficiency was architectural: animation state, render frame, and gameplay timers were implicit in renderer conditionals and simulation fields. This pass makes them explicit and adds named event hooks without changing the content scope.

The current art is intentionally restrained at RTS distance. Villager gathering, construction, carrying, hit, and death now use compact four-frame action loops. Crown Guard and Ashen Raider walk, attack, hit, and death phases use matched four-frame directional loops; the remaining question is player-visible motion quality, not missing runtime coverage. No procedural bobbing or incorrect mirroring is used to conceal a missing direction.

## Engine and coordinate conventions

- Engine/runtime: browser-first HTML Canvas with ES modules; the simulation is engine-agnostic and lives in `src/simulation.js`.
- World projection: fixed three-quarter isometric projection in `src/renderer.js`; world `+X` projects screen-right/down and world `+Z` projects screen-left/down.
- Facing: `directionFromVector(dx, dz)` projects the travel/target vector into four authored camera quadrants. The renderer samples `unit.facing`; it never defaults every action to one south-facing cell and never mirrors a frame.
- Render pivot: the simulation position is the ground contact point. Unit frames are drawn with `screen.y - size * 0.98`; the generated sheets contain aligned feet and a painted contact shadow inside each cell.
- Simulation geometry is separate from the art frame: collision radius, resource/building interaction distance, combat range, and attack ring slots remain gameplay values and are not inferred from transparent pixels.

## Direction decision

The current slice uses four authored directions, not eight:

| Index | World vector | Camera-facing label | Mirrored? |
|---|---|---|---|
| 0 | `+Z` | screen-left / front | No |
| 1 | `+X` | screen-right / front | No |
| 2 | `-X` | screen-left / back | No |
| 3 | `-Z` | screen-right / back | No |

Four directions are the correct current tradeoff for this fixed camera and RTS-distance silhouettes. Each quadrant has an authored cell, and the current gameplay does not expose a free-rotate camera that would make eight directions materially necessary. An eight-direction expansion is explicitly deferred until a camera change or close zoom demonstrates a real readability need; it must be generated as authored artwork, never obtained by mechanical mirroring.

## Coverage matrix

### Villager — worker / economy and construction unit

| Field | Coverage |
|---|---|
| Existing and required states | Idle; walking; gather wood; gather food; mine stone; carry wood; carry food; carry stone; carry supplies; construct; attack; take damage; death. All are required or applicable in the current slice. |
| Existing artwork | `assets/villager-motion-atlas.png`, `villager-task-atlas.png`, `villager-carry-atlas.png`, `villager-combat-atlas.png`, the four integrated task/build loop atlases, and the four integrated carry loop atlases; all are original, transparent Crownforge sheets. |
| Directions / missing directions | 4/4 authored camera quadrants for every sheet. No missing gameplay direction. Eight-direction cells are intentionally deferred, not mechanically mirrored. |
| Frames | Idle 1 pose/direction; walking 3 poses/direction; Wood, Food, Stone, Construct, and each carry state 4 poses/direction; attack 1 pose/direction; hit 4 poses/direction; death 4 poses/direction. Remaining refinement: optional worker-combat command depth and live visual confirmation. |
| Dimensions | Source `1254 x 1254` RGBA per atlas; 4 x 4 cells, nominally `313.5 x 313.5` source pixels per cell. Render size is `108` pixels before camera zoom. |
| Ground anchor / pivot | World position is the feet contact point. Renderer destination begins at `screen.y - size * 0.98`; feet and painted shadow were visually checked against meadow terrain. |
| Collision footprint | `0.36` simulation radius. Resource interaction distance is type-specific (`1.55` food, `1.70` stone, `1.75` wood); building/storage interaction is `0.78`. |
| Shadow anchor | Painted contact shadow inside every generated frame; selection ellipse is a separate gameplay/readability marker at `point.y + 6 * zoom`. There is no separate dynamic shadow sprite. |
| Inconsistencies / deficiencies | Task, construction, carry, hit, and death loops have authored frames and shared feet baselines. Optional worker-combat command depth and an explicit turn clip remain deferred; generated sheets must be rechecked if the camera angle changes. |
| Implementation status | Complete state registry in `src/animation.js`; simulation stores `animationState`, `animationTime`, `animationPhase`, `animationFrame`, and recent named events; renderer consumes the registry and live facing. Developer harness covers every state/direction/frame. |
| Quality score | **8/10** — gameplay coverage, direction correctness, contact timing, and the worker task/carry/response loops are solid; optional worker attack depth and live confirmation remain below the final unit standard. |

### Crown Guard — player basic melee unit

| Field | Coverage |
|---|---|
| Existing and required states | Idle; walking; attacking; taking damage; death. All are required by current melee combat. Gathering, carrying, and construction are not applicable. |
| Existing artwork | `assets/crownforge-soldier-combat-atlas-v1.png` plus the dedicated original transparent attack, hit, and death atlases registered in `src/config.js`. |
| Directions / missing directions | 4/4 authored camera quadrants. No mechanical mirroring. No gameplay direction is missing for the current camera. |
| Frames | Idle 1 pose/direction; walk 4 poses/direction; attack 4 poses/direction across anticipation/contact/recovery; hit 4 poses/direction; death 4 poses/direction. Walk uses the active `crownforge-soldier-walk-loop-v3.png` sheet. |
| Dimensions | Source `1243 x 1265` RGBA; 4 x 4 cells, nominally `310.75 x 316.25` source pixels per cell. Render size is `98` pixels before camera zoom. |
| Ground anchor / pivot | Same `screen.y - size * 0.98` ground-pivot contract as the villager; the authored shadow stays attached to the feet. |
| Collision footprint | `0.43` simulation radius; combat range `1.45`; ring-slot placement keeps multiple attackers around a target rather than on one point. |
| Shadow anchor | Painted in the authored frame; selection ellipse and attack ring are separate renderer overlays. |
| Inconsistencies / deficiencies | Combat response, attack phases, and locomotion have authored directional depth. Final feet-contact and leg-motion judgment still requires an allowed player-visible preview; attack damage remains emitted at the named `attack_hit` timing within the cooldown. |
| Implementation status | Complete state registry and live direction/frame consumption; walk, hit, and death have explicit no-fallback regression coverage; developer harness covers all rows and directions. |
| Quality score | **7/10 locally** — the technical frame contract is complete and the silhouette/facing are readable; the score remains below 8 until allowed player-visible walk review confirms motion quality. |

### Ashen Raider — enemy basic melee unit

| Field | Coverage |
|---|---|
| Existing and required states | Idle; walking; attacking; taking damage; death. All are required by the current enemy presence. Gathering, carrying, and construction are not applicable. |
| Existing artwork | `assets/crownforge-raider-combat-atlas-v1.png` plus the dedicated original transparent attack, hit, and death atlases registered in `src/config.js`. |
| Directions / missing directions | 4/4 authored camera quadrants. No mechanical mirroring. No gameplay direction is missing for the current camera. |
| Frames | Idle 1 pose/direction; walk 4 poses/direction; attack 4 poses/direction across anticipation/contact/recovery; hit 4 poses/direction; death 4 poses/direction. Walk uses the active `crownforge-raider-walk-loop-v2.png` sheet. |
| Dimensions | Source `1243 x 1266` RGBA; 4 x 4 cells, nominally `310.75 x 316.5` source pixels per cell. Render size is `98` pixels before camera zoom. |
| Ground anchor / pivot | Same fixed ground-pivot contract as the player melee unit; live combat direction follows the target vector. |
| Collision footprint | `0.44` simulation radius; combat range `1.25`; ring-slot placement and collision separation prevent excessive melee stacking. |
| Shadow anchor | Painted in the authored frame; selection/hostile marker and attack ring are renderer overlays. |
| Inconsistencies / deficiencies | The same authored locomotion, attack, hit, and death response standard now applies to the Raider. Final feet-contact and leg-motion judgment still requires an allowed player-visible preview; no mechanically mirrored direction is used. |
| Implementation status | Complete state registry and live direction/frame consumption; walk, hit, and death have explicit no-fallback regression coverage; developer harness covers all rows and directions. |
| Quality score | **7/10 locally** — complete technical coverage for the tiny enemy role; the score remains below 8 until allowed player-visible walk review confirms motion quality. |

## Animation architecture implemented

`src/animation.js` is now the single animation source of truth for the existing units.

- `ANIMATION_DEFINITIONS` declares unit category, authored atlas, row/clip mapping, direction count, collision/interaction reference geometry, ground anchor, and shadow treatment.
- `resolveAnimationState()` translates gameplay intent into semantic animation state without mixing collision or interaction geometry into the renderer.
- `CrownforgeAnimationSystem` owns state transitions, phase/time, render frame, and recent named event records. State changes reset phase cleanly, so a new task or attack does not inherit a stale frame.
- `animationFrame()` is shared by the live renderer and the developer harness, preventing the inspection tool from testing a different frame mapping than the game.
- Named events now exist for `footstep`, `attack_start`, `attack_whiff`, `tool_contact`, `resource_collected`, `attack_hit`, `damage_taken`, `construction_strike`, `deposit_complete`, and `death_complete`.
- Resource amounts are applied at the gathering tool-contact event; melee damage is applied at `attack_hit`; construction health/progress advances at `construction_strike`; resource totals change at `deposit_complete`; dead-unit cleanup records `death_complete`.
- Direction remains a simulation-facing value (`unit.facing`) and is not derived from the current sprite frame. The renderer only consumes the result.

## Developer-only inspection harness

`dev/animation-inspection.html` and `dev/animation-inspection.js` are intentionally not linked from `index.html` or the public interface. Open the direct local URL only during development:

`http://127.0.0.1:4178/dev/animation-inspection.html`

The harness exposes every existing unit, every registered state, all four authored directions, every authored frame, adjustable playback speed, manual frame stepping, and guides for the ground pivot, painted shadow anchor, collision radius, and interaction radius. It uses the same `ANIMATION_DEFINITIONS` and `animationFrame()` functions as the game renderer.

## Assets generated or rejected in this pass

- Integrated `assets/villager-gather-wood-loop-v1.png`, `villager-gather-food-loop-v1.png`, `villager-gather-stone-loop-v1.png`, and `villager-construct-loop-v1.png` after transparent-alpha, scale, baseline, and live-map review.
- Rejected the first wood-loop draft for a colored fringe and rejected a cleanup draft until the neutral checkerboard matte was removed. Neither rejected file is referenced by the game.
- The following artwork remains future polish, not hidden completion: optional Villager attack depth, optional idle variations, and eight-direction variants only if the camera later requires them. Crown Guard and Ashen Raider walk sheets are integrated and regression-covered; only their allowed player-visible quality confirmation remains open.

## Remaining deficiencies and next animation priority

1. Confirm the integrated Crown Guard and Ashen Raider walk clips in an allowed player-visible preview at normal and close zoom before changing timing or scale.
2. Re-audit all task, carry, response, and combat anchors against tree, berry, stone, and building interaction positions at normal and close zoom.
3. Generate a new walk family only if that allowed preview identifies a concrete feet, leg-motion, or framing defect.
4. Add richer death timing only if the single authored death pose becomes insufficient after the attack loop is improved.
5. Re-audit all anchors after any camera-angle, render-size, or atlas-generation change.

No new content category should be added until these current unit-animation scores reach at least 8/10 and the live game plus this harness continue to agree on state, direction, frame, and event timing.

## ECONOMIC TASK COVERAGE PASS — 2026-08-15

This pass audited the complete villager work loop without adding a new unit, resource, building, or gameplay category. The existing four-direction artwork was retained because the visual audit found no missing gameplay-critical asset. The implementation work synchronized those authored rows with resource slots, builder slots, cargo, interruptions, depletion, and small event-driven contact feedback.

### Completed villager action × direction matrix

All entries below are authored atlas cells, not mirrored or procedurally rotated artwork. `+Z`, `+X`, `-X`, and `-Z` are the four camera-facing directions defined above; each row has a distinct cell in all four columns.

| Villager action | +Z | +X | -X | -Z | Visual language / synchronization |
|---|---|---|---|---|---|
| Idle | motion row 0, col 0 | motion row 0, col 1 | motion row 0, col 2 | motion row 0, col 3 | Grounded neutral stance; fixed feet and painted shadow. |
| Walking | motion rows 1–3, col 0 | motion rows 1–3, col 1 | motion rows 1–3, col 2 | motion rows 1–3, col 3 | Three-pose loop; playback follows actual acceleration/braking. |
| Gathering wood | task row 0, col 0 | task row 0, col 1 | task row 0, col 2 | task row 0, col 3 | Axe/log silhouette; `tool_contact` fires at the resource collection moment. |
| Gathering food | task row 1, col 0 | task row 1, col 1 | task row 1, col 2 | task row 1, col 3 | Basket/berry silhouette; same contact timing with food-specific color feedback. |
| Mining stone | task row 2, col 0 | task row 2, col 1 | task row 2, col 2 | task row 2, col 3 | Pick/sack silhouette; stone-chip contact feedback and stone-specific carry state. |
| Carrying wood | carry row 0, col 0 | carry row 0, col 1 | carry row 0, col 2 | carry row 0, col 3 | Wood bundle attachment remains visible while returning; compact quantity badge remains separate. |
| Carrying food | carry row 1, col 0 | carry row 1, col 1 | carry row 1, col 2 | carry row 1, col 3 | Food basket attachment remains visible until `deposit_complete`. |
| Carrying stone | carry row 2, col 0 | carry row 2, col 1 | carry row 2, col 2 | carry row 2, col 3 | Stone sack attachment remains visible until deposit. |
| Carrying supplies | carry row 3, col 0 | carry row 3, col 1 | carry row 3, col 2 | carry row 3, col 3 | Construction supply attachment is available for the building-work language. |
| Constructing | task row 3, col 0 | task row 3, col 1 | task row 3, col 2 | task row 3, col 3 | Hammer/workbench silhouette; `construction_strike` advances building progress and emits restrained work feedback. |
| Attacking, if ordered | combat attack row, col 0 | combat attack row, col 1 | combat attack row, col 2 | combat attack row, col 3 | Villager melee remains optional; target-facing direction is preserved. |
| Taking damage | combat hit row, col 0 | combat hit row, col 1 | combat hit row, col 2 | combat hit row, col 3 | Hit row exists; live hit flash provides readable impact without changing the silhouette. |
| Death | combat death row, col 0 | combat death row, col 1 | combat death row, col 2 | combat death row, col 3 | Death state persists for the authored cleanup window, then the unit is removed. |

### Economic synchronization completed

- Resource nodes now reserve six perimeter approach slots. Three villagers assigned to one node receive three distinct slots; a retask, depletion, death, or lost target releases the reservation.
- Construction sites now reserve four perimeter work slots. Multiple selected villagers can be assigned to one foundation without occupying one coordinate; completion or interruption releases every slot.
- Wood, food, and stone use the same state graph: `walk → task-specific work → carry:<resource> → return → deposit_complete → task or idle`.
- A worker leaving a node with cargo immediately frees the node slot. A worker returning to the same node after deposit reserves a slot again rather than retaining a stale claim.
- Resource depletion visibly changes the node renderer to its depleted family (stump, reduced berry, or stone rubble), and the worker safely transitions to cargo return or idle.
- Retasking while carrying preserves the bundle, routes it to the proper player drop-off, then continues to the new command. Stale gather/build/attack targets are cleared during that transition.
- Resource and construction events now carry world positions. The renderer uses them for restrained wood chips, berry glints, stone chips, construction dust, and deposit rings; no generic placeholder icon or colored-box feedback was introduced.
- Storage routes now use the same continuous static-clearance test as live movement. A smoothed route may not cut through a Town Center, resource footprint, or construction footprint.

### Remaining deficiencies

- Every action/direction combination exists and is mechanically synchronized, but gather, carry, construction, attack, hit, and death rows remain mostly single-pose authored clips. They are readable at RTS distance; they are not yet the final multi-frame quality standard.
- The villager combat row is complete for the optional melee case but is not a focus of this economic pass.
- Contact feedback is code-rendered and deliberately restrained; it is not a replacement for future hand-tuned action frames or audio.
- Four authored directions remain the current camera standard. Eight-direction art is still deferred until a camera or zoom change proves it necessary.

### Validation result

- Source checks covered three-villager wood reservation uniqueness, retask release, three-builder construction-slot uniqueness, completion cleanup, all three resource types, deposit events, node depletion progress, and zero syntax/runtime exceptions.
- Live browser checks visibly exercised wood gathering/carry/deposit, food retasking, stone mining/carrying, three-villager construction at foundation/partial/near-complete/complete stages, invalid/valid placement feedback, and empty warning/error logs.
- The developer movement harness still passed cross lanes, intersecting paths, blocked destination, and retask storm after the conservative route-smoothing fix.

The economic animation coverage is complete for the current content scope. The next asset pass should add depth to these existing rows before any new content category is introduced.

## COMBAT QUALITY COVERAGE PASS — 2026-08-15

This pass audited the existing Crown Guard and Ashen Raider melee animation contract and tightened the synchronization between authored directional artwork, attack phases, contact events, target loss, and cleanup. No new combat unit or content category was added.

### Combat action × direction matrix

All cells below use the existing original atlas columns. `+Z`, `+X`, `-X`, and `-Z` are authored Crownforge camera directions; no cell is mirrored or rotated by code.

| Combat action | +Z | +X | -X | -Z | Live state / event contract |
|---|---|---|---|---|---|
| Idle | combat row 0, col 0 | combat row 0, col 1 | combat row 0, col 2 | combat row 0, col 3 | Stable stance and target-independent facing. |
| Walking | combat row 1, col 0 | combat row 1, col 1 | combat row 1, col 2 | combat row 1, col 3 | Approach movement; actual velocity controls playback. |
| Attack anticipation | authored idle row, matching column | authored idle row, matching column | authored idle row, matching column | authored idle row, matching column | `attack_start`; may cancel before commitment if range/LOS is lost. |
| Attack contact | authored attack row, matching column | authored attack row, matching column | authored attack row, matching column | authored attack row, matching column | Emits exactly one `attack_hit` or `attack_whiff` at contact timing. |
| Attack recovery | authored idle row, matching column | authored idle row, matching column | authored idle row, matching column | authored idle row, matching column | No damage; returns to approach or starts the next cycle. |
| Taking damage | authored idle/hit fallback, matching column | authored idle/hit fallback, matching column | authored idle/hit fallback, matching column | authored idle/hit fallback, matching column | Existing hit fallback plus hit flash and temporary health-bar reveal. |
| Death | combat row 3, col 0 | combat row 3, col 1 | combat row 3, col 2 | combat row 3, col 3 | Persists through the authored cleanup window, then emits `death_complete`. |

### Phase and event timing

| Phase | Movement | Damage | Feedback | Exit rule |
|---|---|---|---|---|
| `approach` | Path toward a reserved target ring slot. | None. | Red/orange attack ring; closing label. | Enter anticipation only when in range and line of sight is clear. |
| `anticipation` | Stops and faces the live target. | None. | Subtle direction-aware wind-up cue. | Cancel and re-path if range/LOS is lost; otherwise enter contact. |
| `contact` | Stops and faces the live target. | One event-gated hit check. | Warm contact ring and deterministic impact or whiff cue. | Enter recovery after the contact window. |
| `recovery` | Stops and faces the live target. | None. | Fading recovery trail. | Return to approach, then begin a new anticipation phase when valid. |
| `death` | No movement. | Dead units cannot receive new damage. | Existing death cell and cleanup fade. | Remove after the existing lifetime and emit `death_complete`. |

### Engagement and target coverage

- Buildings and units expose eight deterministic combat reservation slots. The Crown Guard and Ashen Raider prefer different reachable slots when several attackers share one target.
- Slot reservations release on retask, route failure, target death, building destruction, and attacker death. No stale reservation is part of the current live state.
- Attack approach points preserve slot metadata through path selection. Continuous line-of-sight and static-footprint checks remain active for buildings, trees, berry bushes, and stone deposits.
- Target loss during anticipation produces no damage. Target loss after a valid contact does not duplicate damage. Target death clears attackers into readable reassessment/retargeting rather than leaving them striking a corpse.
- Damaged combat units temporarily reveal health bars; selected and currently attacking units retain persistent combat health readability.

### Coverage and validation

- Crown Guard: 4/4 authored directions for idle, walk, attack, death; explicit attack anticipation/contact/recovery states for all four directions.
- Ashen Raider: 4/4 authored directions for idle, walk, attack, death; explicit attack anticipation/contact/recovery states for all four directions.
- Source tests passed 1v1 phase order, escaped-target whiff, 3v1 unique engagement slots, 3v3 combat stability, obstacle line-of-sight, building/resource clearance, resource gathering regression, victory, defeat, and reset.
- Live browser test at 1280×720 passed selection, right-click attack, closing, close-range combat beside food/stone resources, health/impact feedback, Raider death, and retargeting to the Ashen Camp.
- Animation inspection harness showed all combat states and all four directions with no console warnings or errors.

### Remaining visual deficiencies

- The explicit phase states currently reuse the authored idle frame for anticipation/recovery and the existing authored attack frame for contact. This is a deliberate, readable bridge; it is not final multi-frame combat artwork.
- There is no dedicated recoil/hit atlas row yet. The current hit fallback and flash are mechanically clear but remain below the final production bar.
- Crown Guard and Ashen Raider combat animation quality is **7/10** until a compact multi-frame attack/recoil pass is generated, anchored, inspected, and validated. Directional coverage itself is complete.
- No authored combat sound asset is present; current procedural cues are restrained. Do not broaden sound scope before the visual attack loop is hand-tuned.

The combat animation contract is now explicit and stable for future polish. Do not add new military categories until this two-unit action artwork reaches at least 8/10.

## POST-AUDIT REMEDIATION COVERAGE — 2026-08-16 (CURRENT)

The previous coverage table correctly described the old single-pose carry and attack bridge, but it is superseded for the states below.

### Villager carry coverage

| State | Atlas | Directions | Authored frames | Event / gameplay contract |
|---|---|---:|---:|---|
| Carry Wood | `villager-carry-wood-loop-v1.png` / `carryWoodLoop` | 4/4 | 4 | Cargo remains attached while returning; deposit clears state and resumes work. |
| Carry Food | `villager-carry-food-loop-v1.png` / `carryFoodLoop` | 4/4 | 4 | Food load remains readable; no state-specific mirroring. |
| Carry Stone | `villager-carry-stone-loop-v1.png` / `carryStoneLoop` | 4/4 | 4 | Stone load remains grounded and aligned during return. |
| Carry Supplies | `villager-carry-supplies-loop-v1.png` / `carrySuppliesLoop` | 4/4 | 4 | Construction cargo has its own restrained loop. |

All four families use direction rows `0–3`, frame columns `0–3`, the existing 108 px runtime size, and the shared feet/shadow anchor. Live Wood QA showed `2 carrying` and then a full storage deposit; the deterministic retask test preserved cargo before return.

### Crown Guard / Ashen Raider attack coverage

| Unit | Atlas | Anticipation | Contact | Recovery | Directions |
|---|---|---:|---:|---:|---:|
| Crown Guard | `crownforge-soldier-attack-loop-v1.png` / `soldierAttack` | columns 0–1 | column 2 | columns 3–0 | 4/4 |
| Ashen Raider | `crownforge-raider-attack-loop-v1.png` / `raiderAttack` | columns 0–1 | column 2 | columns 3–0 | 4/4 |

The renderer now resolves these atlases through `animationFrame()` and the simulation keeps the existing event-gated contact timing. Attack direction follows the live target; it does not default to south. Live Crown Guard combat reduced Ashen Camp health and showed incoming damage; the direct suite covered melee damage, lethal cleanup, victory, and defeat.

### Current coverage limits

- Crown Guard and Ashen Raider walk, hit, and death remain single-pose rows and are the next repair family.
- Villager optional hit/death remain single-pose because worker combat is not a central command in the current slice.
- No new direction count, unit category, or camera behavior is authorized by this amendment.

### Current score

Unit animation coverage is **8/10**: all gameplay-required current states have directional artwork, the Villager task/carry/build families have authored loops, and military attack depth is now authored. It is not 9 because military locomotion/response and optional worker response still lack final multi-frame depth.

## TECHNICAL HARDENING + RELEASE CERTIFICATION — 2026-08-16

### Timing and event audit

- `CrownforgeSimulation` now advances through a bounded fixed 60 Hz step. A 30-second economy probe at 20 Hz and 60 Hz produced identical worker position, cargo, resource totals, node amount, and simulation clock.
- Animation clocks, footstep timing, tool contact, construction strikes, attack contact, damage, death cleanup, and AI timers therefore share one deterministic gameplay cadence rather than render cadence.
- Renderer ripple feedback now advances from measured render delta instead of a fixed per-frame increment.
- Audio consumes the existing named events through a deduplicated procedural layer; no animation state is duplicated in the audio or UI modules.

### Coverage verification

- Source coverage probe resolved 16 Villager states, 8 Crown Guard states, and 8 Ashen Raider states across all four authored directions with no missing direction mapping.
- `dev/animation-inspection.html` loaded every current asset family with no warning/error entries in the certification run.
- `dev/movement-stress.html` passed cross lanes, intersections, blocked destinations, retask storms, and dynamic blocker recovery after the fixed-step change.
- Live browser matches visually confirmed idle, walking, gathering, carrying, construction, attack, hit feedback, death cleanup, and replay state without floating ground contact or forced south-facing attacks.

### Remaining quality boundary

The current contract is mechanically release-safe for the tiny slice, but animation quality remains **7/10**: most action, carry, construction, attack, hit, and death rows are single-pose authored clips. The next animation-only pass should improve those existing rows before any new unit, faction, building, or map category is introduced. This is a non-blocking foundation condition and a blocking condition for claiming the final art standard is complete.

## Visual integrity pass — 2026-08-16

- The active Ashen Raider attack clip is now `crownforge-raider-attack-loop-v3.png`, a transparent 4 × 4 atlas with four directional rows and four readable attack phases.
- The v2 weapon bleed was reproduced, repaired, and inspected at atlas size and runtime size. The v3 boundary audit reports no unsafe top, left, or right cells and no unintended bottom contact.
- The developer viewer now samples with the live renderer’s one-pixel source inset and reports state fallbacks directly.
- The complete current state matrix returned zero missing/pending combinations. The only fallback entries are the expected soldier hit → idle and raider hit → idle paths.
- Marauder walking remains four-directional and loaded through `crownforge-raider-walk-loop-v1.png`; no forced-south or missing-direction behavior was found in the current source.

The next pass should create matched hit/death depth for the existing combat units. Do not add a new unit or animation category before that repair is evaluated.

## MILITARY RESPONSE DEPTH PASS — 2026-08-20 (CURRENT)

The bounded Crown Guard / Ashen Raider response pass is now integrated. Existing four-direction walk and attack loops remain unchanged; this pass adds authored response depth without adding a unit category or changing combat rules.

| Unit | State | Active atlas | Directions | Frames | Runtime timing |
|---|---|---|---:|---:|---|
| Crown Guard | Hit / recoil | `crownforge-soldier-hit-loop-v1.png` / `soldierHit` | 4/4 | 4 | 14 fps, non-looping |
| Crown Guard | Death | `crownforge-soldier-death-loop-v1.png` / `soldierDeath` | 4/4 | 4 | 3 fps, non-looping |
| Ashen Raider | Hit / recoil | `crownforge-raider-hit-loop-v1.png` / `raiderHit` | 4/4 | 4 | 14 fps, non-looping |
| Ashen Raider | Death | `crownforge-raider-death-loop-v1.png` / `raiderDeath` | 4/4 | 4 | 3 fps, non-looping |

All four sheets use direction rows `0–3` and frame columns `0–3`, the shared feet/shadow anchor, and the existing renderer inset. Hit and death states resolve without the previous idle fallback. Death cleanup timing remains simulation-owned; the final grounded frame is held until the existing removal window expires.

### Preparation and acceptance

- Generated sheets were inspected for pose separation, weapon/body continuity, feet contact, and directional readability.
- The first Guard hit draft was rejected because it repeated a walking pose and retained a checkerboard matte. Runtime uses only the cleaned outputs.
- `tools/prepare-hit-atlases.mjs` performs per-cell border matte flood-fill cleanup and RGBA edge verification before integration.
- Deterministic regression now asserts four-frame, no-fallback hit and death resolution for all four directions of both military units.

### Remaining boundary

Villager hit/death remain single-pose because worker combat is optional and not central to this slice. Do not expand the military roster or create additional action families until this existing two-unit standard receives allowed live-browser confirmation.

## VILLAGER RESPONSE DEPTH PASS — 2026-08-20 (CURRENT)

The optional Villager combat response is now authored at the same restrained depth as the current military response family. This closes the remaining worker hit/death gap without adding a new unit or combat class.

| Unit | State | Active atlas | Directions | Frames | Runtime timing |
|---|---|---|---:|---:|---|
| Villager | Hit / recoil | `villager-hit-loop-v1.png` / `hitLoop` | 4/4 | 4 | 14 fps, non-looping |
| Villager | Death | `villager-death-loop-v1.png` / `deathLoop` | 4/4 | 4 | 3 fps, non-looping |

The rows use the shared direction order `screen-down`, `screen-right`, `screen-up`, `screen-left`, with frame columns `0–3`. Hit frames keep the woman’s hand axe, teal dress, headscarf, feet, and painted ground shadow coherent. Death frames use a non-graphic stagger, kneel, fall, and grounded final pose. The final death frame holds while the existing simulation cleanup window runs.

### Acceptance

- Direct animation probes resolve all 8 Villager response combinations without fallback.
- Both sheets are 1254 × 1254 RGBA atlases with zero opaque edge pixels after `tools/prepare-hit-atlases.mjs` cleanup.
- Source visual-integrity and deterministic regression checks pass.
- Live browser confirmation remains pending because the in-app Browser blocks the isolated local URL; no unsupported live claim is made.
