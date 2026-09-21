# Starveil Arcanist

When the old gods sealed the night, one star escaped. The first arcanist carried its ember to a ruined watchtower and rebuilt it as the Observatory of the Last Star. Each side may entrust that living ember to only one keeper.

A silver-haired battle scholar in midnight-blue robes, brass starwork, and a long cloak carries a staff with a fractured white star. The observatory has ivory masonry, a blue roof, and a brass astrolabe suspended around its luminous heart.

## Recruitment

- Observatory: 160 wood, 120 stone, 100 gold; 24 seconds of construction; 700 health.
- Wizard: 80 food, 40 wood, 150 gold; 20 seconds of training; 210 health.
- One living wizard **per faction side**, irrespective of team membership. Player and enemy may each have one simultaneously. Training queues reserve the side's slot, even across multiple observatories. Death releases the living slot; a replacement can be trained. Direct spawning and restored duplicate units also respect the living cap.
- The enemy faction remains in its existing paused state. Its future production path supports the same limit; this feature does not reactivate that faction.

## Spells

| Spell | Gameplay |
| --- | --- |
| Starshard | A traveling arcane bolt: 36 damage, 36-unit range, 2.2-second attack cycle. |
| Falling Constellation | The first ready bolt calls down seven painted starlight streaks, adding 64 arcane area damage within 7 units. 12-second cooldown. |
| Astral Mantle | A hit that would reduce health below 35% triggers 70% damage reduction for 6 seconds, including that hit. 30-second cooldown. No healing or resurrection. |

Magic never damages allies. Hearthkin magic immunity and tank area defenses apply normally. The wizard stays at casting range and follows the existing team staging rules during tank pulls. Spell status icons expose descriptions and cooldowns on hover.

## Original art and animation

`assets/starveil/arcanist-atlas-v1.png` contains 64 paintings: four directions, four actions per direction, four frames per action. Idle, walking, casting, and death use the same PaintedRosterRig/painted-roster renderer and gameplay attack clocks as the warrior classes. `src/painted-roster/wizard.js` defines the crops and foot anchors. The portrait and observatory are separate original images. Existing approved roster art is unchanged.

The portrait is a single painting. The world sprite uses actual painted frame sequences; it is not a static image moved with CSS.

## Local review

Open `dev/starveil.html` to see the observatory and wizard, cycle every action and direction, demonstrate real spell damage against durable training targets, trigger the mantle, or open ordinary game controls. The training targets deliberately do not attack; their large health pool is confined to this review page.

Run `node --test tools/wizard-regression.mjs` from the Crownforge directory for recruitment, save/load, combat, immunity, mantle, and frame metadata checks.

## Starfire visual treatment

The spell renderer in `src/starveil-effects.js` adds gathering motes and a casting seal; a braided comet with a white-hot core and shedding sparks; a violet celestial rift, seven falling stars, aurora curtains, ground sigils, shock rings and ballistic crystal fragments; and a transparent mantle with orbiting arcs and rising lights. Constellation aftermath lasts 3.2 seconds. Damage, range, cooldowns, and defenses are unchanged.

All particles follow deterministic paths. Five reusable glow textures bound texture allocation. Reduced-motion mode removes falling meteor showers, flying fragments, and orbiting movement. `dev/starveil.html` includes a freeze/resume button for inspecting the actual spell effect. Automated checks cover finite drawing geometry, context restoration, unchanged simulation state, texture reuse, and reduced-motion simplification.

Starshard now travels as a large, volumetric blue-white starfire sphere with a violet rim, wrapping plasma bands, curling corona, a broad tapered wake, and shedding sparks. Its visual diameter is 84 world-scaled pixels before the outer glow. Damage, speed, hit detection and cooldown remain unchanged. The local review has an Inspect starfire orb button that holds a real projectile mid-flight.

The starfire orb now breaks into an expanding blue-white shell on contact, with broad curling plasma fragments, three ground shock rings, and falling sparks. The ordinary impact lasts 1.85 seconds and is also present beneath empowered constellation strikes. Damage remains 36 for the ordinary projectile. Inspect orb impact in the local review freezes a real, damaging hit at 0.30 seconds.

Impact revision: 90ms compression, irregular white-hot rupture, volumetric blue plasma billows, torn flame tongues, a heavy rippling ground pressure wave, and tumbling crystal shards. This supersedes the earlier symmetrical plasma-petal design. Gameplay timing and damage are unchanged.

## Eventide Passage and Distant Star

Distant Star seeks a clear position about 30 units from enemies, at least 6 units beyond nearby healers, with 36-unit casting reach. Wizard formation orders use a row behind healers. Healers do not chase the wizard to define their own rear line. Paths are checked against nearby enemies so repositioning cannot cut through the fight.

Eventide Passage automatically reacts to any hostile pursuing the wizard or a hostile within 20 units. A successful blink moves at least 24 units, to an open landing at least 38 units from all hostile units. Landing candidates are checked at their center and eight surrounding points, against map boundaries, obstacles and occupied cells. If no safe destination exists, no teleport or cooldown is spent.

The wizard breaks hostile pursuit and clears his in-flight bolts, cannot attack or be targeted/damaged for 6 seconds, and has an 8-second escape cooldown. He resumes his interrupted target after a teammate holds that enemy. Veil, cooldown and pending target persist through saves. This is spacing plus a temporary immunity, not permanent AoE immunity.

The effect pairs an imploding star iris with a distant nebula doorway: engraved ground seals, counter-rotating light ribbons, crystal motes, a star bridge and a reforming column of light. Reduced motion simplifies particles. Local test route: `dev/eventide.html` (Replay bear chase, Inspect the rift, Test the formation).

### Starfire gathering

Every Starshard now gathers energy through two counter-rotating ground seals and broken outer rune arcs. Four light streams and rising motes feed a growing blue-white sphere at the staff. Orbiting bands and a bright final crest build into the launch. The charge stays visible during anticipation and the short pre-release contact phase; the projectile emerges from the same visual point before joining its flight path. No spell damage, timing or cooldown changes. Reduced motion retains the rings and sphere while omitting streams, motes and branching arcs. `dev/starveil.html` provides Inspect starfire buildup and Watch starfire buildup.

## Native-detail sprite revision

The original 64-pose atlas remains preserved. Runtime now uses four independently generated directional sheets (`arcanist-{se,sw,ne,nw}-detail-v2.png`) with 16 paintings each. Standing poses contain 302–312 pixels of native source detail, up from about 143 pixels. The preparation script removes the supplied neutral matte and packs each isolated painting into a 400px cell without enlarging its pixels. Existing world size and combat clocks remain unchanged. The wizard alone prepares full-resolution action frames to avoid a low-resolution pose during zoom.

Review `dev/wizard-detail.html` for synchronized original/new animation comparisons. Source generation prompts and preparation details are in `assets/starveil/detail-v2-generation.json`; hashes and pose dimensions are recorded alongside the assets. Created with the built-in image generation tool.

Wizard facing uses the camera-projected target or movement vector (`screenX = dx - dz`, `screenY = dx + dz`) to choose SE/SW/NE/NW paintings. Forced casting aim updates immediately; travel keeps the existing small boundary hysteresis. `dev/wizard-facing.html` exercises all four directions with real attack clocks.
