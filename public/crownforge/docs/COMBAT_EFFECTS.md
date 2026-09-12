# Combat effects and lore-card reference

Revision: 20260911-lastbastion1. Approved release; verify the live marker for deployment status. This is the gameplay reference for the next lore-card pass. Existing art and bloodline stories remain in `src/bear-variants.js` and `src/unit-status.js`.

| Effect | Owner and trigger | Actual rule |
| --- | --- | --- |
| **Greatwood Colossus** | Bear first reaches 50% **true** health | Double rendered size, body radius (3 → 6 world units), and outgoing damage. Latched for the rest of its life and saved. False Last Light health does not trigger it. |
| **Wrath of the First Oath** | Bear at 10% true health or affected by the false Last Light reading | Existing 6× damage layer. Stacks with Colossus for 12× base damage. Landed blows remain lethal to non-tank fighters. |
| **The First Condemnation** | Permanent Greatwood elder magic | Immunity to lesser curses and stuns; true physical wounds still kill. Preserve the established ancient sentence/bloodline lore. |
| **Elderhide** | Permanent bear protection | Arrow damage normalizes to 1/30 of full health before Thick Hide. |
| **Thick Hide** | Permanent bear armor | Halves incoming damage; combined with Elderhide, 60 landed arrows from full true health. |
| **Crushing Claws** | Permanent bear tank pressure | Six times prior strike damage against tanks, before armor. Stacks with both bear rage layers. |
| **Bloodclaw Reckoning** | Enraged bear, 8-second cooldown | 360-degree crimson claw sweep; frontal empowered hit plus rear DPS reduced to 10% maximum HP within 10 units. No upward healing, no rear tank/healer pulse, wards respected. |
| **Oathbound Stride** | Permanent Crown Shieldbearer blessing | Base movement speed is 1.5 times the fastest other unit: currently 6.225 versus Scout 4.15. Roads and terrain still modify movement. Faster acceleration and braking keep it responsive. Lore seed: “The sworn shield reaches danger first.” |
| **The Crown’s Last Bastion** | Shieldbearer below 20% maximum HP | Reduces post-armor incoming damage by another 90% (98% total reduction with armor). Protects only the below-threshold portion of a crossing hit. Healing to 20% or above ends it; no cooldown, no immunity, no healing from the buff. |
| Shieldbearer armor and evasion | Permanent tank defenses | 3,480 HP, 80% damage reduction, one deterministic dodge per twenty incoming melee swings (5%). No new armor increase in this revision. |
| Shieldbearer threat lock | Tank lands a hit | Enemy attacks the tank for 8 seconds, refreshed on each hit, within 24 units. Existing valid tank retains ownership over another tank. Other fighters cannot steal aggro. |
| Team healing | Assigned Hearthkin, every 2 seconds | Heal every nearby injured eligible friendly unit within 20 units and line of sight: tanks 40 HP first, others 20 HP. Excludes self, dead units and enemies; no overheal. Healer remains dedicated until removed from team. |
| **Last Light Ward** | Hearthkin would die | Existing 60-second protection/restoration and untargetability. Outward curse follows after 1.5 seconds; blast animation lasts 0.9 seconds. |
| **Last Light Curse** | Last Light marks a susceptible enemy | Health becomes 1; next positive damage kills. Existing targeting/spread logic is preserved. |
| **The Borrowed Last Breath** | Last Light meets an immune bear | Displays 1 HP without changing true wounds. Activates Wrath, but not Colossus unless true health reaches half. Preserve existing bloodline trickery stories. |
| **Stunned** / **Steadfast** | Hearthkin strike against susceptible humanoid | Existing 5-second stun and 20-second stun immunity. Greatwood bears remain immune. |

## Swipe and formation rules

Either bear rage enables a 160-degree frontal swipe reaching 10 world units. It hits all living hostile units in the fan with clear line of sight, except ward-protected units. The direction is committed at the start of the swing and matches its facing; moving behind avoids ordinary contact. Bloodclaw Reckoning, on an 8-second cooldown, also hits rear damage fighters within 10 units and leaves them at 10% maximum health. It never increases health already below that floor, respects wards and line of sight, and excludes tanks and healers from the rear pulse. Tank aggro no longer disables cleave globally. The existing requirement for valid primary contact remains.

Team damage fighters wait for tank aggro outside the swipe radius, circle via an outer flank, and close into distinct rear slots. Tanks hold the front. Automatic healers follow behind the actual rear DPS line, at least 12 units from the bear and 3 units beyond that line. Their route updates every half-second as the encounter moves, using the outer perimeter when crossing sides. Healing range is 20 so they can reach the front tank. Explicit healer movement remains authoritative. Already standing inside an active frontal attack is still dangerous; formations are movement, not immunity. Very large rosters form additional rear rows rather than sharing a point.

## Damage reference

Crushing Claws multiplies bear damage against tanks by six before armor. Against a tank: base 348; Colossus 696; Wrath 2,088; both 4,176. After 80% armor, these become 69.6, 139.2, 417.6 and 835.2. The Crown’s Last Bastion now protects the portion below 20% health, so both rages require twelve landed hits to kill an unhealed full-health tank. Dodge remains 5%. One healer now restores 40 tank HP or 20 other-ally HP every two seconds (50% less output). This intentionally lets the bear overwhelm a single healer, especially in its final rage. Ordinary non-tank damage and rear Bloodclaw's 10% health floor are unchanged.

No new lore-card art was generated in this revision. Oathbound Stride and Greatwood Colossus now appear in unit inspection; the other existing named effects keep their original art and stories.


## Encounter music

Ancient Dungeon Siege is a dedicated battle recording (`assets/ancient-dungeon-siege.mp3`), excluded from the ordinary five-song album and dropdown. Supplied MP3 retained intact. First engagement with a wildlife unit or explicitly marked boss starts a 1.8-second crossfade. Track remains active until all engaged enemies die/disappear (or the player party is wiped out), so momentary target switching does not restart it. Future enemy types opt in with wildlife/boss flags. Mute and volume govern both layers.

Web Audio decodes once, removes boundary silence using a 10ms RMS threshold, and overlaps the final/initial 200ms with an equal-power crossfade. The resulting buffer loops on the audio clock without a media-ended delay. Crossfade peaks are normalized when necessary. The regular album fades back after combat; it keeps its playlist selection. Browser playback requires a user gesture. Local training includes Start, Enrage, Preview Bloodclaw, and Defeat training bear controls for testing.

Bloodclaw visuals: a full ground shockwave plus two opposing rotating fans of three tapered crimson claws, bright edges, and trailing red sparks. Duration 1.25 seconds; visual circle matches the 10-unit special attack area.
