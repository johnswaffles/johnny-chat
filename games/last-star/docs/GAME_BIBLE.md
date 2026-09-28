# Crownforge: Last Star — game bible

Last updated: September 28, 2026. This is the working specification for this game and future chapters. Read this before changing gameplay, creating art, or building another level. Update it in the same change as any approved design change. Historical prompts and DESIGN.md provide context; current source and the rules below describe shipped behavior. Do not copy obsolete numbers from earlier notes.

## Identity and scope

One playable character: the Starveil Arcanist, Keeper of the Last Star. A luminous, painterly side-scrolling arcade adventure grounded in Crownforge lore. Preserve the silver hair, midnight-blue robes, brass celestial ornamentation and blue star staff. New art is welcome; unrelated character redesigns are not. Inspiration: Ori's light and silhouette readability, Trine's layered architecture, Ender Lilies' melancholy. Never copy their assets.

The first chapter is one 7,900-unit level: Silverwood, Broken Aqueduct, Last Observatory. Three ordered starseals, six illustrated memories, twelve shades, one Hollow Astronomer. Do not add classes or expand the level scope as a side effect of polish work.

## Lore and story

Canon inherited from Crownforge: the old gods sealed the night; one ember escaped; the Arcanist carries it toward the Observatory. Preserve Starshard, Eventide Passage/Ascendancy, Falling Constellation, Astral Mantle, Lone Star Reckoning, Vaelthryx and Heavenrend as named identities. RTS mechanics are adapted for direct control; this game's values are authoritative here, not changes to the RTS.

This chapter's additions: the later keeper's return, Silverwood, three seals, Hollow Astronomer and memory events. The protagonist is a later keeper, not the Observatory's founder. Six memories proceed through oath, Bracken Ford, the experiment, flight, meeting Vaelthryx, and the decision to return. Memory six precedes the boss; never imply victory has already happened. Chapter ordering differs from persistent discovery IDs. Preserve IDs 0–5 and existing saved discoveries.

Memories say **Read a memory**, glow clearly, and open an illustrated reader that pauses combat. Art must depict the actual narrated scene with a consistent wizard. Staffs must be held or physically supported, never inexplicably upright in air. Escape / B / Menu returns to play. Story artwork and prompts live in docs/story/.

## Combat contract

- Maximum health: 210. Starlight: 100, regenerating 8/second.
- Missing health grants exactly the same percentage of bonus damage: 60% missing means +60%, 99% missing means +99%. Evaluate on hit, before healing.
- Lifesteal restores **2% of actual enemy health removed**, capped at maximum health. No healing from overkill, dead targets or inactive bosses.
- Starshard: 36 base, 0.98-second cooldown, no cost. Compact blue magical energy wave, not a tadpole, blade or ninja weapon. It launches from the forward-pointed staff tip, in either facing and in air.
- Falling Constellation: 85 base area hit after 0.6 seconds; 30 starlight; 7-second cooldown. Damage and visible impact must coincide.
- Eventide Passage: safe-ground blink of 100–235 units; 3.8 seconds; 0.85 seconds of protection; 36-base departure and arrival attacks when targets exist. Never blink into a pit or past progression gates.
- Eventide Ascendancy: up to five range/lifetime stacks. Lone Star Reckoning: after a passage, same-target hits build ×1.25, ×1.5, ×1.75, ×2; switching targets resets the chain. This is separate from Star Reprisal below.
- Astral Mantle: crossing below 35% health triggers 70% damage reduction, including that hit, for 6 seconds; 30-second cooldown. No free healing.
- Heavenrend: Vaelthryx's moving sweep; unlocks at seal two; costs 60; cooldown 32 seconds; 65-base pulses at 0.45-second spacing after the arrival delay, along the moving sweep.

### Star Reprisal — damage bank added September 28

Enemy attacks charge a bank of actual health lost **after mitigation**. Multiple hits accumulate with no timed expiry. The next successfully cast damaging spell snapshots that bank and adds **300%** of it to normal damage. Example: enemy hits remove 10, 20 and 30 HP; next spell carries +180 damage, in addition to its normal damage.

Normal damage retains missing-health, Reckoning and arcade multipliers. Add the bank afterward so the bonus remains exactly 3× damage taken, not 3× multiplied again. Final result uses existing integer rounding. Lifesteal includes actual health removed by the bonus.

One bonus budget belongs to one cast: first valid target hit receives it once. Constellation's other targets, Heavenrend's later ticks and Eventide's second strike do not duplicate it. A projectile already in flight cannot consume damage taken after it was cast. New damage starts the next bank immediately. Missing a cast loses the released bonus. Failed/locked/cooldown/insufficient-mana casts preserve the bank. A blink without an attack target preserves it. Falls and blocked hits never charge it. Resting/healing does not erase it; death/retry/new attempt does. It is not saved.

Feedback: restrained violet orbiting stars on the wizard while charged, violet hit sparks, release flash, and HUD text **Star Reprisal +N next spell**. Respect Gentle effects and avoid full-screen blur.

## Arcade rewards

Shades drop three Star Crystals, guardian twelve. Crystals settle above supported ground, magnetize within 170 units and never expire. Each grants 25 score and 4 starlight. Ranks at 6 / 15 / 27 total crystals each grant +10% damage. Every nine crystals triggers 8 seconds of Overdrive with another +35%. Arcade bonus multiplies normal damage. Kills within 8 seconds build score multiplier up to ×5; damage breaks it. Ordinary kill base score 100, guardian 1,500. Run score, crystals, ranks, Overdrive and Reprisal reset on retry/continue; memories and starseals persist. Ending reports score and best chain.

## Animation and art acceptance rules

1. **No merged architecture.** Stone columns have recognizable capitals, shafts and supported bases. Tree branches remain wood. Use clean foreground occlusion: a tree can cover a column but cannot morph into it. Inspect the full panorama and close crops at in-game scale.
2. **No unsupported props.** Lamps/posts reference supporting platform and footprint through src/level-decor.js. No arbitrary coordinates leaving ordinary fixtures floating in pits. Intentional magical platforms are exceptions.
3. **Water starts at a real source.** Background water animation shares the exact panorama transform. Do not place waterfalls across a solid tree arch. Review all active fall IDs after replacing a panorama. Use prebaked small sprite frames, not expensive full-background distortion or per-frame pixel processing.
4. **Enemy art never clips.** Every idle, windup and attack frame includes the entire blade, polearm, hair, cloak, glow and particles. Use explicit frame metadata and common body scale/foot anchor. Do not assume hand-painted poses obey an equal grid. Leave padding; allow weapons to extend beyond collision boxes. Review all poses left AND right at gameplay scale and enlarged. An intact atlas is not proof that its runtime crop is intact.
5. **Wizard motion uses artwork.** Preserve opaque body frames; do not crossfade him into translucency. Walking cadence follows travel distance and stays measured. Airborne legs hold a jump pose; hair/cloak flow. Idle uses consistent painted pictures with a slow ping-pong sequence. Casting points the staff at the emitted spell; no chest-origin projectiles.
6. **Cohesive versions.** Keep previous approved assets; save new art under versioned names and switch explicit references after review. Store generation prompts and provenance. Never leave a runtime asset only in the generator's output directory.
7. **Readability before spectacle.** Fog gives depth but does not hide combat or platforms. Keep projectiles compact, outlines readable and VFX bounded. No costly fullscreen filters in the gameplay loop. Respect Light quality and Gentle effects.

## HUD and controls

Spell bar is compact at bottom-left: 64×66 desktop buttons, 40px artwork; responsive variants are smaller. Do not recentre or enlarge it over jump paths. Dialogue is a compact bottom-right subtitle, 3–4.5 seconds based on text length; on narrow screens it moves above the spell bar. Never restore the large center-bottom story banner. Persistent story belongs in the paused memory reader.

Keyboard: A/D move, Space double jump, J Starshard, Shift Eventide, Q Constellation, R Heavenrend, E interact, Escape pause. Xbox: left stick/D-pad move, right stick aim, A jump, RT Starshard, B Eventide, X Constellation, Y Heavenrend, RB interact, Menu pause. Keep remapping UI, swap-on-conflict and saved dead-zone preferences. Reserved menu controls must remain reachable. Disconnect pauses controller play; focus loss and reader/settings screens pause combat. Desktop-first, no claimed touch support.

Music: **The Door Beneath the World** from Crownforge RTS, looping after user interaction. Synthesized spell, impact and collection effects share the sound setting; avoid peaks and repeated audio on resume.

## New-level definition of done

- Read this bible; preserve shared rules, canon, controls and save compatibility.
- Author reachable double-jump routes; validate grounded props and memory placements.
- Inspect scenery for merged materials, unsupported geometry and false waterfall sources.
- Review every enemy pose, both facings, on dark and light backgrounds; all weapons/glows intact.
- Test real damage, lifesteal, Reprisal, resource/cooldown failures, rewards, death, checkpoint recovery and victory. Run `npm test` and add focused tests for new rules.
- Play the level in the browser with keyboard and controller where available. Check small/large viewport HUD, jumping, memory pause/resume, Gentle and Light modes.
- Keep narrative overlays out of the jumping view. Validate artwork against each memory's prose.
- Update this bible, asset prompts and verification notes with the change. Do not call work shipped on tests alone.

## Release source of truth

Local development: crownforge-last-star/. Website source: games/last-star/. Published mirror: public/last-star/. Follow docs/DEPLOYMENT.md; synchronize only reviewed files, protect unrelated work, run build/route/file-size checks, push authorized changes, and verify https://justaskjohnny.com/last-star/ in the browser. Confirm the intended johnny-chat-5 deployment, not unrelated legacy provider checks. Local preview, passing tests and public release are separate evidence.

## September 28 isolated Level 1 arcade preview override

This section governs **crownforge-last-star-level1-preview only**, not the shipped build described above. No Level 2, campaign extension, remote, publishing or replacement of approved assets. Keep the 7,900-unit layout, wizard, painting, movement plane, three seals, six memories and explicit completion/replay screen. Original file hashes are in BASELINE_HASHES.json.

The focused active loadout is unlimited Starshard, Eventide, and **Ember Orb / Frost Fan / Chain Spark / Healing Flask** in a stable four-slot selection ring. Legacy Constellation/Heavenrend simulation remains for compatibility regression checks but has no player binding or HUD action in this preview. Starlight is not a new player-facing resource; specials consume charges only. Do not reintroduce Q/R legacy bindings into this preview.

- Defaults: A/D move, Space double jump, J hold staff, Shift blink, K use, hold Tab ring, E/Q next/previous, release Tab equips only, E interact, Esc pause. Xbox: left stick move, right stick aim, A jump, X staff, B blink, Y use, hold LB ring, RB/LT next/previous, release LB equips only, RB interact, Menu pause. Every gameplay action is remappable.
- Ring slows the entire simulation to 25%; UI navigation stays real time. Charge/use requires a separate new press. Empty items stay equipped. Mode changes cancel the ring; held input cannot reopen it until released. One-shot inputs survive render frames with no simulation step.
- Tuning source: src/level1-config.js. Ember: 66 base, radius120, burn6 every0.6s for2.4s. Frost: five 16-base shards, 1.1s ordinary freeze, 3.5s freeze resistance, follow-up shatter24 once; boss/brute slow50% for1.6s. Chain: 45 base, first range470 from muzzle then230, up to four unique targets, nearest-first and ID tie-break. Chain stagger0.3s ordinary /0.15s brute /0.08s boss with1.2s resistance. Flask: heal65, no consumption at full health. Special stacks6, flask3, overflow75 score per excess item. Failed activations must not spend charges or Reprisal.
- Staff tiers: crystals0/6/15 produce one36-base bolt /one46-base stronger bolt /three38-base bolts. All bolts of a cast share one Reprisal budget. Existing missing-health damage, 2% actual-loss lifesteal, Reprisal, score chains and Overdrive continue.
- Guaranteed scrolls/power/flasks and four breakable chests are grounded by supporting-platform validation. Ordinary loot magnet95, collected once; gold50/gem150. Do not place ordinary loot over a pit. Introductory enemy580, first scroll960, clustered enemies1510/1660, first guaranteed power1790. Later loot and enemies reuse the current route.
- Roles: approaching melee, ranged, resistant brute. No passive touch damage. Windup precedes active melee/projectiles and recovery. Guardian cycles fan, delayed marked ground, jumpable low sweep with recovery. Preserve attack atlas bounds and inspect both facings at gameplay scale.
- Save key crownforge-last-star-level1-preview-v1; QA adds -qa. Only seals/memories/elapsed/completion persist. Continue/retry reset run inventory, staff tier, score, enemies after checkpoint, statuses, Reprisal and effects. Whole route loot/chests reset for each attempt, so backtracking can recollect it; no permanent economy. Full replay resets every encounter and seal.
- FX limits: 420 particles,96 projectiles,48 simulation effects,48 rings/arcs,12 echoes,16 arcade waves,20 shard impacts,32 elemental aftermaths,40 numbers,32 audio voices. Audio nodes disconnect on end; reset stops voices. Kill hit-stop35ms at most once per300ms, disabled with Gentle effects. Independent music/SFX volume, shake slider, reduced-flash option. Light is the fresh-preview default; it caps render pixel ratio1 and reduces fog/motes/particles.
- Original orthographic Blender additions only: tools/build_level1_items.py, art/level1/treasure-source.blend, assets/level1-items/*.png. Approved wizard/background/atlases are byte-identical. Follow docs/LEVEL1_HANDOFF.md and LEVEL1_ISSUES.md before further changes. A successful preview run never authorizes another level.

## Live test release authorization

September 28: user authorized pushing the isolated Level1 upgrade for live testing. It now replaces the Last Star route as an arcade preview, retaining the separate preview save namespace and all Level1-only limits. No subsequent level is authorized. Release marker: 20260928-level1-arcade. Local-only statements above describe the pre-approval development stage.
