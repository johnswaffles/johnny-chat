# Vaelthryx, the Skybreaker

Before the old gods named the winds, Vaelthryx carried the first thunder beneath his wings. They chained him above the world and used his heart to light their heavens. When the last star fell, its keeper broke one link. Vaelthryx shattered the rest. He answers no throne and suffers no bridle. When the Arcanist raises that stolen star, the Skybreaker comes to repay a freedom that even the gods could not reclaim.

## Heavenrend

Select a living Starveil Arcanist and press **Call the Skybreaker**. The spell aims at his current enemy, or the nearest hostile unit within 45 world units. A failed cast does not spend the cooldown.

- **Cooldown:** 300 seconds, beginning on a successful summon. Stored on the wizard and restored with saves.
- **Flyover:** ten seconds, with four original painted wingbeat frames; 2520-pixel artwork width before camera scaling (three times the original).
- **Lightning breath:** seconds two through eight. Its center sweeps 48 units across the enemy front. Every half-second it deals 150 magical area damage to hostiles within 12 units of that moving center.
- The breath comes from above and crosses terrain. It does not damage allies or buildings. Hearthkin hostile-magic immunity and tank area defenses apply.
- The active flight and its next damage pulse survive save/load. Reset removes the flight. The spell finishes even if the summoner falls.

## Blessings

| Name | Effect |
| --- | --- |
| Stormward Covenant | Allies within 28 units of the wizard when summoned receive 30% less incoming damage for 12 seconds. |
| Skybreaker's Favor | The wizard's Starshard deals 54 instead of 36 damage for 12 seconds. Does not amplify Heavenrend or Falling Constellation. |
| Unbound Sovereign | Vaelthryx is an untargetable aerial summon whose flight continues independently of the wizard. |

Buff icons and cooldown information appear in the unit status UI. The wizard's selected-unit controls include a dragon lore button. The dedicated illustrated card is also accessible from **Dragon lore** in `dev/starveil.html`.

## Original artwork

Created with the built-in image-generation tool. Approved wizard, tower, and prior character art were preserved.

- [Four wingbeat paintings](../assets/skybreaker/flight-v1.png), original RGBA atlas, 1254 × 1254.
- [Lore-card illustration](../assets/skybreaker/lore-v1.png), 1024 × 1536.
- Measured crop rectangles and mouth anchors live in `src/storm-dragon-renderer.js`. The lightning originates at that anchor through all four paintings.

### Generation prompts

Flight: Original ultra-detailed painted fantasy RTS creature sprite atlas on a true transparent background. A 2×2 grid of four complete poses of the same huge right-facing storm dragon, with consecutive raised, spread, downstroke, and rising wingbeats. Indigo obsidian armor, cyan fissures, midnight-blue translucent wing membranes with silver lightning veins, ivory swept horns, golden-white throat, four tucked legs and long tail. Isometric three-quarter view, painterly realistic classical fantasy game artwork, correct anatomy, clear muzzle, no breath painted into the asset, no words or scenery.

Lore: Original epic fantasy painted card illustration of Vaelthryx descending from torn thunderclouds above tiny forests and castle towers, breathing branching cyan-white lightning through a valley. Indigo-black scales, enormous lightning-veined wings, ivory horn crown, luminous throat. A tiny silver-haired wizard with a star staff below establishes scale. Dramatic chiaroscuro, rich violet storm atmosphere, majestic allied creature, no text or border.

## Verification

Targeted tests cover the exact five-minute cooldown, invalid casts, swept damage, friendly safety, magic immunity, tank defenses, blessing expiration, save/load pulse continuity, summoner death, reset, and the existing wizard mechanics. The local preview uses durable stationary training targets and offers a mid-flight hold control. Reload that development page to start a fresh preview; the in-game ability retains its full cooldown.

The enlarged flight uses a higher mouth position, a proportionally larger shadow, and a dense plasma breath with five twisting streams, a heavy lightning core, fast luminous particles and branching ground arcs. Damage, radius, buffs and the five-minute cooldown are unchanged. The development preview widens its camera for the enormous wingspan.

Greatwood bears now have Elderblood Spellward: 95% resistance to the dragon’s lightning before their existing hide and Heart defenses.
