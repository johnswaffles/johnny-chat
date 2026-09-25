# Last Star — first playable chapter

## Approved direction

One playable wizard, one authored level, beautiful and enchanted with an ominous undertone. A side-scrolling journey through a moonlit forest, broken aqueduct, and Observatory. New artwork, existing Crownforge lore.

Visual research references, checked September 23, 2026:

- Ori and the Will of the Wisps: https://www.orithegame.com/media/ — luminous painterly environments, depth, readable silhouettes.
- Trine 5: https://trine5.thqnordic.com/ — layered ruins, fantasy architecture, warm/cool light contrast.
- Ender Lilies: https://en.enderlilies.com/ — quiet ruined spaces and a restrained melancholy atmosphere.

These are visual principles, not reused assets or copied characters. The actual scenery and character artwork are original to this project.

## Canon and proposed additions

Verified local source: `/private/tmp/crownforge-release-shallow-20260920/games/crownforge/docs/COMBAT_EFFECTS.md`, especially its September 21 Eventide update, and `STARVEIL_ARCANIST.md`. The older Eventide section in the latter is superseded by the newer combat catalog.

Canon: Starveil Arcanist, Keeper of the Last Star; the escaped ember after the old gods sealed the night; the Observatory; silver hair, midnight robes, brass starwork and a staff with a fractured star; Starshard, Falling Constellation, Astral Mantle, Eventide Passage/Ascendancy, Lone Star Reckoning, Vaelthryx/Heavenrend. Crownwarden lore and Brackenwatch context are drawn from Oathbound's `docs/DESIGN.md`.

New chapter material: the Silverwood route, three starseals, the Hollow Astronomer, spectral sentinels, the return of the ember, and the particular memory prose. These are proposed additions to the setting, not retroactive edits to either existing game's canon.

## Action adaptation

| Ability | This chapter |
| --- | --- |
| Starshard | 36 base damage, 0.98s interval, free; keyboard target assist or mouse aim |
| Falling Constellation | 85 area damage after a readable 0.6s windup, 30 starlight, 7s cooldown |
| Eventide Passage | Manual 100–235px safe-ground blink, 3.8s cooldown, 0.85s protection, departure/arrival attacks |
| Eventide Ascendancy | Extends projectile lifetime over five passage stacks; short portal/casting-echo presentation |
| Lone Star Reckoning | Following a passage, consecutive hits on the same target build 1.25×, 1.5×, 1.75×, 2×; target switch resets the chain |
| Astral Mantle | A hit crossing below 35% HP triggers 70% reduction for six seconds, including the crossing hit; 30s cooldown; no healing |
| Heavenrend | Vaelthryx's moving lightning sweep; unlock at seal two; 60 starlight, 32s cooldown; damage follows the moving sweep |

RTS indefinite doubling/range growth, automatic retreat and six-second invulnerability were deliberately adapted for direct platforming control and a readable solo boss fight. The last-star theme and spell identities remain. Distant Star formation logic and ally-only bonuses have no direct solo equivalent and are not exposed as false player abilities.

## Level and progression

7,900 world units, nine major ground sections, safe double-jump chasms, optional elevated memory routes, twelve shades and one guardian. The main route has three ordered seals. Resting clears health/starlight; nearby enemies prevent safe rest. Later encounters reset on reload. Fall recovery costs health and returns to the last seal. The final gate checks all three seals; victory requires the guardian's defeat and explicitly returning the ember.

The first chapter is deliberately compact. A deterministic optimal input replay clears it in about a minute; a new player will take longer to learn controls, read memories and explore. The earlier 10–15-minute suggestion is not a verified playtime target for this initial slice.

## Presentation

One panoramic painting is combined with independently scrolling trees, architecture, foreground plants, moving fog banks, drifting motes, moonbeams, warm lanterns, spell glows and actual animated character poses. Fog stays lighter over the combat plane. Aqueduct supports form visible arches; the final arena has a turning astrolabe and celestial banners.

Lighting is a layered Canvas 2D effect, not a physically simulated 3D renderer. The dragon uses an original painted flying pose with motion and a damage-bearing lightning sweep. The wizard uses a hand-framed generated pose sheet. Light mode reduces atmospheric cost; gentle effects reduce shake, flashes and particles. Pause and focus loss stop combat. This is desktop-first. Standard-mapped controllers now support movement, aiming, remappable action buttons and menu navigation; touch controls are not implemented.


## September 23 follow-up: moving water and controller controls

A v2 panorama increases painted detail while preserving the scene composition. The generator returned the same 2172×724 dimensions; this is a detail repaint, not a higher-resolution asset. Far-layer opacity is higher, broad mist is lighter, and canvas resolution now allows 2× device pixels. Thirteen animated waterfalls share the exact background transform. Each has clipped moving streaks, foam and pool spray, with reduced particle density in light mode.

The controller defaults follow standard Xbox positions: A jump, RT Starshard, B Eventide, X Constellation, Y Heavenrend, RB interact, Menu pause. Left stick/D-pad move and right stick aims. Menu and Escape stay reserved so users can always reach settings. Keyboard and button remapping use swap-on-conflict, bounded dead zones and local persistence. The frame-polled adapter buffers edges until a simulation step, avoiding lost presses on fast displays and repeated jumps while a button is held. A disconnect pauses active controller play. Keyboard/mouse remain usable.

### Ground-mounted decoration placement
For every future level, lamps, posts and other ground-mounted foreground props must reference a supporting platform and an offset inside it. Use `groundedPlacement` in `src/level-decor.js`; derive the base height from the platform, and validate the entire base footprint. Do not author independent x/y coordinates for grounded props. Unsupported or overhanging bases are rejected. Review every pit and ledge visually before delivery. Floating magical platforms/effects are intentional exceptions, not a reason to allow unsupported ordinary fixtures.

### Missing-health power and lifesteal
All wizard damage gains a multiplier of `1 + (1 - hp/maxHp)`, evaluated when the hit lands before healing. This multiplies the existing Reckoning bonus; final damage retains integer rounding. Every valid hit restores 2% of actual enemy HP removed, capped at maximum player HP. Overkill, dead enemies and the inactive boss grant no lifesteal. This replaces the previous flat 9 HP per kill. Starseal restoration and the boss-completion restoration remain. HUD displays the current missing-health damage bonus and 2% lifesteal.

## Six memories — The keeper’s return
The paused illustrated story reader expands this chapter’s proposed fiction, without rewriting RTS canon. The player is a later keeper, not the first arcanist who founded the Observatory. Six chronological waypoints tell the oath, Bracken Ford, the overreaching experiment, flight from the breach, the meeting with Vaelthryx, and the decision to return. The sixth memory is a resolve before the encounter, not a claim that the boss is already defeated. The existing ending completes that promise.

Original discovery IDs 0/1/2 and positions remain unchanged. New IDs 3/4/5 fill intervening story beats. Chapter numbers determine narrative order; save IDs do not. Re-reading is supported. Reader pages pause simulation and clear held controls on entry/exit. Page controls support keyboard focus and controller menu navigation; Escape/B/Menu return to the journey. Assets and generation prompts are tracked in docs/story/ART_PROMPTS.md.

## Arcade combat loop — September 25
Defeated shades drop three Star Crystals; the guardian drops twelve. Drops settle above the supporting platform, then home in within 170 world units. Each crystal grants 25 points and 4 starlight. They do not expire. Power ranks at 6, 15 and 27 collected crystals add 10% spell damage per rank. Every nine crystals activates eight seconds of Overdrive for another 35% damage. The combined arcade bonus multiplies the existing missing-health and Reckoning multipliers; 2% lifesteal still uses actual health removed. No change to Starshard's 0.98-second interval.

Kills within eight seconds build a score multiplier up to ×5. Ordinary kills grant 100 base points; the guardian grants 1,500. Taking damage breaks the chain. Crystals, score, rank and charge belong to the current attempt and restart on retry/continue; starseals and memories retain their existing save behavior. The ending reports run score and best chain.

New presentation: illustrated four-spell icon atlas, readiness strips, clear score/charge/rank HUD, faceted collectible crystals, expanding death shockwaves and fragments, stronger staff-release and bolt-impact sparks, golden Overdrive aura and projectile light. All effects are bounded and use cached glow sprites; no screen blur/filter passes were added. Gentle effects reduces fragments/rotation/shake. Synthesized filtered-noise transients, pitch sweeps, collection chimes and rank/Overdrive cues accompany the existing looping theme; a compressor controls peaks.
