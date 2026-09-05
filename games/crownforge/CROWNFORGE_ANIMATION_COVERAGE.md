# Crownforge current animation coverage

Updated during the September 2026 current-roster rebuild. **Release verification is pending.** The acceptance record is [CROWNFORGE_ROSTER_REBUILD.md](CROWNFORGE_ROSTER_REBUILD.md). Older three-character and four-frame inventories have been superseded; their history remains in Git.

## Scope

The current game contains 12 identities, six per faction. `src/config.js` defines their gameplay; `src/character-rigs.js` registers the rebuilt presentation. A character is complete only when it owns four usable authored body views, every applicable animation, correct equipment, and visible/runtime evidence.

| Faction | Type | Character | Required states | Views |
|---|---|---|---:|---:|
| Crown | villager | Hearthkin | 23 | 4 |
| Crown | soldier | Crown Guard | 8 | 4 |
| Crown | scout | Crown Scout and horse | 8 | 4 |
| Crown | spearwarden | Spearwarden | 8 | 4 |
| Crown | militia | Militia | 8 | 4 |
| Crown | shieldbearer | Shieldbearer | 8 | 4 |
| Ashen | ashenForager | Hearthkin | 23 | 4 |
| Ashen | raider | Raider | 9 | 4 |
| Ashen | ashenOutrider | Outrider and horse | 9 | 4 |
| Ashen | thornSpear | Thorn Spear | 9 | 4 |
| Ashen | hearthLevy | Hearth Levy | 9 | 4 |
| Ashen | hidewall | Hidewall | 9 | 4 |

Required total: **131 state contracts, 524 directional cases**. Shared military solvers also support five optional Crown stunned review poses, yielding136 supported states/544 directional cases. Those review poses do not grant new gameplay abilities.

Worker states: idle, walk, gather_wood, gather_food, field_work, gather_stone, gather_gold, construct, repair, demolish, carry_wood, carry_food, carry_stone, carry_gold, carry_supplies, attack, attack_anticipation, attack_contact, attack_recovery, hit, ward_block, stunned, death.

Military states: idle, walk, attack, attack_anticipation, attack_contact, attack_recovery, hit, death; all Ashen military additionally have a live stunned state.

`carry_supplies`, worker `stunned`, and worker `demolish` are compatibility/review poses. Current worker neutrality prevents normal worker-versus-worker stun; current config grants no `canDemolish` trait and the player demolition command clears structures instantly. These rules remain unchanged.

## Presentation contract

- Four independent camera views: front, right, back, left. Direction is never supplied by mirroring a whole character.
- Continuous anatomical motion, measured upper/lower limb anchors, and actual painted wrist-to-grip attachment. Correct palm/knuckle surfaces and forward profile thumbs are checked separately from grip coordinates.
- Original material cutouts retain each identity's face, costume, proportions and silhouette. A few bare-hand anatomy supplements are explicitly shared within a faction; provenance records identify those references.
- Solid tools/shields project shaft, edge, thickness and grip in the same actor space as the body. Hammer, axe, pick, hoe, spear and mace use appropriate contact planes and near/far layering.
- Workers retain their five cargo presentations and Last Light Ward. Soldiers retain per-type equipment, attack timing, reaction and settled death. Horses use a four-beat support sequence, independent rider seat/stirrups/reins, and source-measured hoof soles.
- Physical action poses stay together during transitions. A screen-only joint blend must not move hands away from the destination tool/body frame. Compatible free locomotion keeps a short blend.
- Work cycles and attack contact use simulation clocks. Gameplay speed, range, damage, cooldown, economy, navigation, faction rules and saved identity keys are unchanged.

## Review and verification

- `dev/hearthkin-studio.html`: select any registered character/action, four enlarged views, scrub, playback speed, hand detail, joint guides and player-size samples.
- `dev/roster-review.html`: moving contact sheets for every state and direction; worker states span three pages.
- `dev/roster-world.html`: isolated field using the production simulation/renderer, with whole-roster movement, worker commands, military attacks, wards and save restoration. It waits for every required character's artwork before advancing.
- `dev/roster-performance.html`: population drawing measurement; results are character-rendering cost, not total game frame time.
- `tools/roster-animation-regression.mjs` runs the current full-roster contract. It intentionally fails if any current type is absent. `--partial` is a development-only option on the underlying motion check.
- `tools/roster-motion-regression.mjs`: artwork metadata, required states, anatomical lengths, painted grip transforms, transition integrity, cycle seams, attack clocks, held deaths, and hoof support across dense samples.
- `tools/character-work-regression.mjs`: worker striking directions, front/back axe thickness, finite two-hand shafts, hoe contact/recovery and rear occlusion.
- `tools/mounted-render-regression.mjs`: measured painted hoof-floor alignment, heel/toe rolling contact and front/rear horse painter order.
- `tools/hearthkin-rig-regression.mjs`: original Crown walk contract plus actual draw-call grip/depth checks.
- `tools/hearthkin-gameplay-regression.mjs` and `tools/roster-gameplay-regression.mjs`: both worker economies, construction/repair/fields, actual military attack phases/damage/death, applicable stun/ward, instant demolition and save compatibility. An optional baseline simulation path enables exact gameplay comparison with cosmetic fields omitted.

Local structural checks do not certify art quality or deployment. The rebuild ledger records visible reviews and the eventual source/production/live verification separately. Exact original generation prompts, extraction attempts, source measurements and provenance live under `assets/characters-v3/`.
