# Current-roster character rebuild ledger

Opened 2026-09-04. This is the scope and evidence ledger for the requested Crownwarden Hearthkin work/tool corrections followed by the rebuild of every character currently in the game, on both sides.

**Status: complete. All 12 characters are rebuilt, reviewed in four directions, and verified in the published game.** Current evidence is recorded in [the roster release](CROWNFORGE_ROSTER_RELEASE.md). Dated progress below retains intermediate findings; its earlier partial counts do not describe the current implementation.

## Authoritative scope

The current roster contains exactly 12 types in `src/config.js` (`UNIT_TYPES` and `PRODUCTION_TYPES`), six per faction. `src/simulation.js` produces units through their buildings and uses the same type keys for saves. The current `CROWNFORGE_ANIMATION_COVERAGE.md` documents this complete roster; older three-family inventories remain in Git history.

| Exact type key | Faction / character | Equipment and identity to preserve | Production building | Rig family |
|---|---|---|---|---|
| `villager` | Crown / Hearthkin | Female worker; teal clothing and braid; hand axe, hammer, pick, hoe, resource loads, ward response | `townCenter` | Worker |
| `soldier` | Crown / Crown Guard | Bronze armor and crested helmet; blue cloak; spear in right hand; round sun shield in left | `barracks` | Foot soldier |
| `scout` | Crown / Crown Scout | Chestnut horse; teal rider cloak and saddlecloth; right spear; left small round shield | `stable` | Horse and rider |
| `spearwarden` | Crown / Crown Spearwarden | Iron cap, pale tunic, blue sash; long right-hand spear; left round crown shield | `barracks` | Foot soldier |
| `militia` | Crown / Crown Militia | Iron cap, pale tunic, blue sash; right spiked mace; left round shield | `barracks` | Foot soldier |
| `shieldbearer` | Crown / Crown Shieldbearer | Broad, unhelmeted bearded man; dark teal quilted coat; right axe; left large round shield | `barracks` | Foot soldier |
| `ashenForager` | Ashen / Hearthkin | Female worker; brown clothing, reddish sash, braid; hand axe and the full worker equipment family | `ashenCamp` | Worker |
| `raider` | Ashen / Ashen Raider | Broad male; dark fur shoulders and red sash; right axe; no shield | `reaverLodge` | Foot soldier |
| `ashenOutrider` | Ashen / Ashen Outrider | Dark shaggy horse; fur-cloaked rider; right spear; left small wooden shield | `beastCorral` | Horse and rider |
| `thornSpear` | Ashen / Thorn Spear | Fur/bone armor and red ties; long right-hand spear; round shield carried on back in current walk art | `reaverLodge` | Foot soldier |
| `hearthLevy` | Ashen / Hearth Levy | Brown cap and fur tunic; red sash; right hand axe; left small wooden round shield | `reaverLodge` | Foot soldier |
| `hidewall` | Ashen / Ashen Hidewall | Massive fur-clad male and red sash; right mace; left tall oval wooden shield | `reaverLodge` | Foot soldier |

The two mounts are horses. The name `beastCorral` does not authorize replacing the Ashen Outrider's horse with another animal. Equipment is assigned to anatomical hands, not to a permanent screen side. Distinct identities, silhouettes, human/mount scales, gameplay abilities, movement speeds, collision radii, economy, damage rules, and saved type keys remain intact.

## State contract and count

Directions are **0 front, 1 screen-right, 2 back, 3 screen-left**. A correct row number alone does not prove that the artwork actually faces that direction.

Worker contract, 23 states for each of `villager` and `ashenForager`:

`idle`, `walk`, `gather_wood`, `gather_food`, `field_work`, `gather_stone`, `gather_gold`, `construct`, `repair`, `demolish`, `carry_wood`, `carry_food`, `carry_stone`, `carry_gold`, `carry_supplies`, `attack`, `attack_anticipation`, `attack_contact`, `attack_recovery`, `hit`, `ward_block`, `stunned`, `death`.

Military contract, eight states for each of the five Crown military characters:

`idle`, `walk`, `attack`, `attack_anticipation`, `attack_contact`, `attack_recovery`, `hit`, `death`.

Ashen military contract, nine states for each of the five Ashen military characters:

The eight military states above plus `stunned`.

**Total: (23 × 2) + (8 × 5) + (9 × 5) = 131 state contracts, across four views = 524 directional state cases.** This count does not multiply overlay combinations, sample phases, or transitions; those require additional review.

Reachability must be reported honestly:

- Both workers have shared build/repair/defense/Last Light Ward abilities. Their opposite factions do not make them attack one another; Hearthkin neutrality is an existing rule.
- Both worker rigs support the existing `carry_supplies` review/compatibility state. Normal current simulation assignments carry wood, food, stone, and gold; no normal supplies assignment was found in the scope audit.
- `demolish` is also a worker compatibility animation. Current config gives no unit `canDemolish`; the player demolition tool removes structures instantly. The animation rebuild preserves this behavior and tests instant demolition against the baseline instead of inventing an active dismantling ability.
- Worker `stunned` remains a supported review/compatibility state. Only worker attacks currently apply humanoid stun, and normal Hearthkin-versus-Hearthkin attacks are prevented. Do not invent a new live stun interaction to make this review state reachable.
- All five Ashen military types have the humanoid trait and can be stunned by the Crown worker. Crown military lacks that trait; do not add it as an animation change.
- All characters can receive damage and die. Missing hit clips do not mean the corresponding gameplay event is absent.
- Shields are equipment. A shield-bearing soldier does not acquire the workers' Last Light Ward ability merely because its animation includes defensive motion.

## Directional acceptance ledger

Each directional cell means **all of that unit's listed state contract**, with applicable overlays and transitions, needs visible inspection. Mark a cell complete only with linked evidence for the entire cell; an individual corrected state belongs in a dated progress note until the cell is fully covered.

| Type | States | Front | Right | Back | Left | Production/gameplay evidence |
|---|---:|---|---|---|---|---|
| `villager` | 23 | Reviewed | Reviewed | Reviewed | Reviewed | [Verified live](CROWNFORGE_ROSTER_RELEASE.md) |
| `soldier` | 8 | Reviewed | Reviewed | Reviewed | Reviewed | [Verified live](CROWNFORGE_ROSTER_RELEASE.md) |
| `scout` | 8 | Reviewed | Reviewed | Reviewed | Reviewed | [Verified live](CROWNFORGE_ROSTER_RELEASE.md) |
| `spearwarden` | 8 | Reviewed | Reviewed | Reviewed | Reviewed | [Verified live](CROWNFORGE_ROSTER_RELEASE.md) |
| `militia` | 8 | Reviewed | Reviewed | Reviewed | Reviewed | [Verified live](CROWNFORGE_ROSTER_RELEASE.md) |
| `shieldbearer` | 8 | Reviewed | Reviewed | Reviewed | Reviewed | [Verified live](CROWNFORGE_ROSTER_RELEASE.md) |
| `ashenForager` | 23 | Reviewed | Reviewed | Reviewed | Reviewed | [Verified live](CROWNFORGE_ROSTER_RELEASE.md) |
| `raider` | 9 | Reviewed | Reviewed | Reviewed | Reviewed | [Verified live](CROWNFORGE_ROSTER_RELEASE.md) |
| `ashenOutrider` | 9 | Reviewed | Reviewed | Reviewed | Reviewed | [Verified live](CROWNFORGE_ROSTER_RELEASE.md) |
| `thornSpear` | 9 | Reviewed | Reviewed | Reviewed | Reviewed | [Verified live](CROWNFORGE_ROSTER_RELEASE.md) |
| `hearthLevy` | 9 | Reviewed | Reviewed | Reviewed | Reviewed | [Verified live](CROWNFORGE_ROSTER_RELEASE.md) |
| `hidewall` | 9 | Reviewed | Reviewed | Reviewed | Reviewed | [Verified live](CROWNFORGE_ROSTER_RELEASE.md) |

## Opening defects and omissions

These are audit findings and user-reported defects to resolve, not completed changes.

1. Crown Hearthkin building and repairing: front/back hammer swing plane, arm movement, hand orientation, and hammer striking direction are wrong.
2. Crown Hearthkin field work: tool faces backwards in front/left/back views; the back-facing tool crosses through the torso.
3. Crown Hearthkin front/back walk: the axe still displays its broad side when the projected head-on/back-on tool form should be seen.
4. Crown Hearthkin front/back wood chopping: axe orientation and swing direction are wrong.
5. Current Crown Spearwarden v3 walk art has both profile rows facing screen-left. It requires an authored right-facing view; reassigning row numbers cannot supply the missing view.
6. Current Crown Shieldbearer v1 walk rows visibly read front, left, back, right while runtime maps them as front, right, back, left. Its special idle mapping does not fix the walk sheet.
7. The other 11 characters still rely on mostly three-drawing walks/attacks. Several task, carry, idle, and hit states are static. Repeating frames or warping the whole sprite is insufficient for the requested movement rework.
8. Ashen Hearthkin has only 18 clips. Repair/demolition fall back to construct, ward blocking has no dedicated pose, and supported stun/supplies review states are absent.
9. Ashen Outrider, Thorn Spear, Hearth Levy, and Hidewall can be stunned in gameplay but lack a stunned clip; state resolution falls back to idle.
10. Crown Scout, Spearwarden, Militia, and Shieldbearer have damage feedback but no hit animation.
11. Movement-driven cadence, stopped-foot handling, cosmetic work clocks, improved ward rendering, and articulated-rig routing are currently special-cased to Crown Hearthkin in several places.
12. Structural row/atlas checks previously accepted visually incorrect directions. They are useful integration evidence but cannot certify anatomy or appearance.

## Required evidence for each character

### Visible movement and art

- Inspect all four real views at normal game size and enlarged review size, both moving playback and paused contact/passing/recovery poses. Document which state and phase each captured artifact covers.
- Verify independent identity artwork, matching clothing/material/weapon proportions, no missing direction, no checkerboard/opaque extraction matte, no cropped limb/weapon, and no abrupt identity change between actions.
- Verify planted-foot support, modest foot clearance, natural opposing arm swing, stable head/torso, coherent back silhouette, and no stepping while blocked. Check idle-to-walk, walk-to-stop, walk-to-work, work-to-carry, attack interruption, and death transitions.
- Verify anatomical elbows/wrists, neutral forearm rotation, palm grip, and fingers over the handle. A hand target that equals a bitmap rectangle center is not proof of a grip.
- Verify a weapon's shaft, blade/head, and grip as one coherent object in all views. Front/back tools need proper foreshortening and visible end/edge surfaces, not the profile painting rotated sideways.
- Verify work contact plane and target-facing direction: hammer striking face, axe cutting edge, pick point, and hoe blade must move toward the work in the correct direction. A two-handed tool keeps both hands on the same shaft throughout the stroke.
- Verify near/far limbs, shields, tools, body, coat, and carried loads occlude naturally through their actual 3D relationships. A rear tool must not cut through the torso or jump in front of the near leg.
- Verify attack anticipation, contact, recovery, non-looping hit, applicable stun, ward block, held fallen pose, and overlay effects. Impact timing must match the live simulation event.
- For both mounted units, inspect all four hooves and support sequencing, horse back/head/tail, rider seat and stirrups, reins, weapon/shield attachment, and horse/rider hit and death. A horse cannot use the human two-legged gait.

### Runtime and gameplay

- Assert each exact unit key resolves to its own production rig and all state contracts. No undeclared fallback to another character or idle may conceal missing work.
- Assert finite anatomical/projected joints; bounded limb lengths; stable palm/handle attachment; useful head/blade orientation; continuous looping joints; planted feet/hooves; non-looping responses and held death; and known depth boundaries across sampled phases.
- Exercise both worker economies, resource delivery, build, repair, field work, applicable demolition, defense, ward/curse/blast, interruptions, and saved-game restoration.
- Exercise every military type's movement, target-facing attack phases, damage, hit, death, and saves; exercise stun and release for each Ashen military type. Preserve existing attack range, cooldown, timing ratios, damage, and navigation behavior.
- Preserve event timing: simulation damage fires at 20% of the contact phase. Per-unit cooldown and attack-timing ratios are authoritative; a Crown worker's fixed durations cannot be reused blindly for military rigs.
- Verify all required images load before the production character can appear; both main depth pass and foreground redraw use the new renderer. Check console errors, rendering performance, and review controls.
- Verify source/production mirrors and the actual deployed marker/modules/assets when publication is performed. Local tests do not establish live deployment.

## Shared lessons to carry into subsequent characters

The initial Crown work documented in [the Hearthkin release](CROWNFORGE_HEARTHKIN_RELEASE.md), [natural-walk release](CROWNFORGE_NATURAL_WALK_RELEASE.md), and [arm/depth release](CROWNFORGE_ARM_DEPTH_RELEASE.md) provides useful starting evidence. These lessons must be applied and verified again for each identity; they do not certify an unreviewed new rig.

- Use anatomical coordinates first: character-right, up, and forward. Solve joint motion and tools in that space, then project into front/right/back/left views. Screen-space limb-length preservation produces false outward elbows when a limb should foreshorten.
- Give equipment a complete local frame: grip origin, shaft axis, blade/striking direction, and thickness axis. Carrying, chopping, hammering, and hoeing require different local rotations; one global 2D tool angle cannot express all of them.
- Preserve authored shoulder-to-cuff and wrist-to-grip anchors. The painted centerline can be slanted inside its crop. Fit those measured anchors to the rig, rather than assuming every cutout is vertically centered.
- Body chirality and tool surfaces are separate concerns. Author correct left/right body surfaces. A tool-only transverse reflection around its grip can solve a particular surface orientation, but does not supply missing head-on thickness or a correct work swing plane.
- Compute or explicitly validate occlusion against anatomical depth. For profile locomotion, far leg → far arm/tool/hand → near leg is a useful starting order. Work tools may change depth as they extend forward; a fixed walking order is not universally correct.
- Design gait around stance and transfer of weight. A low return arc, actual movement-driven cadence, and quiet loaded arm read more naturally than large symmetric sine-wave marching. Let costume motion follow rather than drive the body.
- Use the simulation's task/attack contact clock. Smooth permissible joint transitions without delaying or inventing a gameplay hit. Keep cosmetic state out of economy/combat/save parity comparisons.
- Inspect actual RGBA transparency and all authored facing directions. Neither a filename saying “right” nor a passing row-index test proves the visible content.
- Share rig mathematics, loaders, and verification contracts; retain each character's own anatomy proportions, gait parameters, material artwork, loadout, and mount behavior. Shared code must not flatten the roster into recolored Hearthkin.

## What “complete” means

The request is complete only when every current character above has its applicable actions/states and all four views rebuilt and verified, the Crown-specific reported defects are visibly resolved, gameplay and saves remain correct, all relevant runtime paths use the new work, and the intended release is verified in production. Every completion claim needs dated evidence linked from this ledger or an associated release record.

A generated image, a registered clip, a green structural test, a local screenshot of one pose, an implementation plan, or a release marker alone does not satisfy this definition. Uninspected views, fallback states, static replacements for required motion, and mounted units left on old sheets remain unfinished scope. Do not mark the overall goal complete while any such work remains.

## Dated progress

- 2026-09-04: Read-only inventory completed against current config, production, simulation, animation definitions, renderer, tests, and all 12 active walk-art families. The ledger and opening defects were recorded. All implementation and acceptance cells remain pending.
- 2026-09-04, local rebuild session: connected Crown/Ashen Hearthkin, Crown Guard, Ashen Raider, and Ashen Hidewall to individual art definitions. Added original solid tool materials and nine shield faces. Guard profile socket/hand corrections are still in progress. Crown Scout, Crown Spearwarden and Crown Shieldbearer art is in progress; other roster art remains pending.
- Worker work review: `dev/roster-review.html?unit=villager&page=0&phase=.6`, then moving playback, showed all four directions for idle/walk/chop/berries/hoe/stone/gold/build/repair. Phase32–46% moving captures confirmed windup and forward return. `page=1` moving showed demolition/all five cargo forms/full attack/anticipation/contact; `page=2` moving showed recovery/hit/ward/stun/death. Enlarged Guard attack33% revealed a hollow shoulder socket; correction was requested. Guard death83% revealed upright cloak/head surfaces; these now use the projected body frame. Hidewall attack33% showed separate correctly attached mace and oval shield. These are local progress observations, not production acceptance.
- Automated motion audit at5/12 connected identities:292 supported directional state cases,23,652 sampled poses,47,304 painted grip checks passed. Ten military/mounted physical motion families passed fine elbow-continuity and exact attack-clock checks;7,111 planted-hoof samples passed. The full test intentionally requires all12 identities by default. Both worker work regressions and the prior Crown gait regression pass.
- Expanded gameplay audit passes Ashen worker resource collection/delivery/build/repair/field work and movement/attack-phase/damage/death/save scenarios for all ten military types against the pre-art simulation. It currently stops at the expected missing Ashen Outrider stunned clip because that character is not integrated yet. Do not describe this suite as fully passing until remaining rigs are connected and it is rerun.

### Research consulted during this rebuild

- [Animation Mentor: animating a basic human walk cycle](https://www.animationmentor.com/blog/tutorial-animating-human-walk-cycle/): body mechanics, opposing torso/hip motion, arm overlap and drag, and grounded translation. Used as animation guidance, not as a source of copied character artwork.
- [Blender manual: inverse kinematics constraint](https://docs.blender.org/manual/en/4.1/animation/constraints/tracking/ik_solver.html): end-effector and pole-target concepts. The runtime uses its own small analytical solver; no Blender dependency was added.
- Local browser performance: first96-character/five-identity run measured19.6ms median/22.6ms p95 for character drawing alone. Equipment-only caching, with exact live grips, enlarged vector detail, finite LRU budgets, and loading guards, reduced a subsequent96-character/six-identity run to4.5ms median/5.4ms p95 over240 samples. Full12-character and real-world checks remain outstanding; these timings do not include world rendering/simulation or establish a universal frame rate.
- Ashen worker visible review completed for all23 states in the moving `dev/roster-review.html?unit=ashenForager&page=0`, `page=1`, and `page=2` grids: four independently authored views retain clothing/identity, corrected closed profile shoulders, hands grip work/cargo objects, rear work equipment stays covered by torso, and death settles with the body. Crown worker reviewed similarly. Ward overlay and actual production scene review still remain separate acceptance items.
- Crown Shieldbearer and Crown Spearwarden source art is now connected (7/12 identities). Guard's corrected v2 profiles remove hollow shoulder sockets and use the appropriate palm/knuckle surfaces. Full final source/pose tests have not yet been rerun after the seventh identity.
- Later close-source review found duplicated/backward profile hand surfaces in earlier Crown/Ashen worker and Raider art. These have dedicated four-surface hand replacements, with far palms, near knuckles, and forward thumbs; actual wrist/grip transforms are being re-reviewed. Crown worker additionally replaces the old hollow right shoulder with two independently authored closed garment underlays. Small all-state grids alone had not exposed these defects, so earlier grid observations do not certify the original profile hands.
- Crown Scout, Crown Militia, and Ashen Thorn Spear are connected (10/12). Scout uses an independently articulated horse and rider. Its initial standing assembly was visibly crouched despite fixed bone lengths; shoulder/hip placement and fore/hind lengths were corrected, and the mount-only scale retains human rider proportions. Rear horse layering and painted hoof-ground alignment are still being refined. Scout passed the 8-identity intermediate motion audit:400 supported directional cases,32,400 poses,64,800 painted grips and7,111 hoof samples.
- Local real-game browser review at55% zoom confirmed fresh source-art loading, visible Crown worker/Guard rendering, worker group movement and stopping, and no reported console warnings/errors. Final full-roster world review remains outstanding. Expanded gameplay checks now also pass instant player demolition parity, and still stop at the pending Ashen Outrider stunned clip.

- 2026-09-05, completion: all 12 identities and all applicable four-view states reviewed; final motion, painted grip, hoof, work, loading and exact baseline gameplay checks passed. Source/production mirror verified. Release `20260904-rosterkin1` / `1e0f40c` served live, with full-roster movement/attack/ward/save, both workers farming, studio controls and ordinary opening game verified. See [the complete release evidence](CROWNFORGE_ROSTER_RELEASE.md). Earlier partial-count progress entries are historical.

- 2026-09-05, player-reported follow-up: the completed roster release still had a wrong-way/truncated Ashen profile barrel and misassembled horse heads. These were visible defects not caught by the earlier bone-length/hoof checks. The scoped `20260905-horsefit1` correction adds complete Ashen croups, hanging tails and actual painted skull/neck/crest attachments. Evidence: `CROWNFORGE_HORSE_FIT_RELEASE.md`; the previous completion entry is historical, not proof those defects were absent.
