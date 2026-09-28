# Level 1 preview issue log

Scope: isolated local preview only. Live/source artwork read-only. No later levels.

| ID | Severity | Reproduction / finding | Status / verification |
|---|---|---|---|
| A1 | Significant | Enemies damage the wizard simply by proximity, without an attack window. | Open: replace with telegraphed melee. |
| A2 | Significant | Blink checks destination only; solid obstacles would be crossed. | Open: swept blink path validation. |
| B1 | Significant | No charged inventory or selector; existing mana spells occupy Q/R and Xbox X/Y. | Open: preview-specific controls and inventory. |
| F1 | Significant | Restart leaves some renderer effects/timers from the old run. | Open: explicit renderer reset. |

Milestone evidence is appended here. Known limitations belong in LEVEL1_HANDOFF.md.

A verification: 53 tests passed, including blink rejection and guarded stagger. Browser Level1 encounter: blink moved safely, departure attack defeated shade, held staff readiness/cooldown and loot remained functional.
B integration blocker: stale ES modules after hot-edit caused missing binding names. Fixed with versioned module imports and a no-store local server; browser reload confirms new ring controls. Added queued edges across simulation frames and bounded QA panel scrolling. 56 tests passed before adding remaining items.

## Final verification record (September 28)

| ID | Severity | Reproduction / cause | Resolution and evidence |
|---|---|---|---|
| A1 | Significant | Stand beside an enemy outside its attack animation; old proximity check hurts wizard. | Fixed: damage only in telegraphed active melee window. Automated regression and browser encounter. |
| A2 | Significant | Put a solid rectangle between blink endpoints; old destination-only check crosses it. | Fixed: swept body-width path check plus existing landing/gate checks. Synthetic obstacle test; current level uses one-way platforms and no solid walls. |
| B1 | Significant | No charged inventory; conflicting legacy bindings. | Fixed: four stable entries, transactional charges, remappable input. Virtual Xbox ring release preserved charges; separate Y used item. |
| B2 | Significant | Reload during module development reused stale control exports and crashed key prompts. | Fixed: versioned imports plus no-store local server. Three subsequent browser runs completed. Historical console errors retained by tool; no new instance observed. |
| B3 | Significant | One-shot input could vanish on a render frame before the next fixed simulation tick. | Fixed: queued actions, no double activation on catch-up. Controller/input tests pass. |
| C1 | Significant | Chain initial validation measured from player while actual selection measured from muzzle. | Fixed: same muzzle/range criterion before spending last charge. Regression passes. |
| C2 | Significant | Chain applied ordinary hit first, setting resistance and suppressing chain stagger. | Fixed: chain status first; explicit 0.3s regression, brute/boss shorter resistance. |
| D1 | Significant | Melee damage had no preparation; guardian mostly repetitive projectiles. | Fixed: approach/ranged/brute windup and recovery; guardian three-pattern cycle. Tests and three browser full runs finish. |
| F1 | Significant | Restart retained renderer aftermath and scheduled audio. | Fixed: renderer reset clears all transient arrays, wizard animation and clocks; audio reset stops voices; delayed tones use tracked audio scheduling. Replay UI confirmed empty inventory, zero score/tier1. |
| E1 | Moderate | Paused screen continuously redraws full environment. | Fixed: one final frame on mode switch/resize, then static until resume. |
| E2 | Minor / performance | In-app Rich profile not stable60fps (baseline also below target). | Rich limitation remains; Light now default, measured16.67ms mean and17.9ms p95. See handoff for honest timings. |
| QA1 | Tool limitation | Browser blob-download API timed out for captured video. | Fixed local-only export endpoint with exact path, origin check and30MB ceiling; 10s actual canvas clip saved in output. |

No known progression blocker or crash remains in the tested preview. Physical controller, real OS focus switching and subjective audio mix require user review; synthetic/virtual checks do not replace those.

C3 (significant, fixed): reversing explicit aim on a special cast could compute the muzzle on the old facing. Aim now resolves before muzzle sampling; regression checks left-facing origin and velocity. Final67 tests pass.
