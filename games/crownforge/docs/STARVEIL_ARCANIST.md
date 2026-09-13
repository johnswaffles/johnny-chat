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
| Starshard | A traveling arcane bolt: 36 damage, 18-unit range, 2.2-second attack cycle. |
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
