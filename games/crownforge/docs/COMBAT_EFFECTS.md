# Combat effects and lore-card reference

Revision: 20260911-defiance1. Approved release; verify the live marker for deployment status. This is the gameplay reference for the next lore-card pass. Existing art and bloodline stories remain in `src/bear-variants.js` and `src/unit-status.js`.

| Effect | Owner and trigger | Actual rule |
| --- | --- | --- |
| **Greatwood Colossus** | Bear first reaches 50% **true** health | Double rendered size, body radius (3 → 6 world units), and outgoing damage. Latched for the rest of its life and saved. False Last Light health does not trigger it. |
| **Wrath of the First Oath** | Bear at 10% true health or affected by the false Last Light reading | Existing 6× damage layer. Stacks with Colossus for 12× base damage. Landed blows remain lethal to non-tank fighters. |
| **The First Condemnation** | Permanent Greatwood elder magic | Immunity to lesser curses and stuns; true physical wounds still kill. Preserve the established ancient sentence/bloodline lore. |
| **Elderhide** | Permanent bear protection | Arrow damage normalizes to 1/30 of full health before Thick Hide. |
| **Thick Hide** | Permanent bear armor | Halves incoming damage; combined with Elderhide, 60 landed arrows from full true health before temporary Heart protection. |
| **Crushing Claws** | Permanent bear tank pressure | Six times prior strike damage against tanks, before armor. Stacks with both bear rage layers. |
| **Bloodclaw Reckoning** | Enraged bear, 8-second cooldown | 360-degree crimson claw sweep; frontal empowered hit plus rear DPS reduced to 10% maximum HP within 14 units. No upward healing, no rear tank/healer pulse, wards respected. |
| **Oathbound Stride** | Permanent Crown Shieldbearer blessing | Base movement speed is 1.5 times the fastest other unit: currently 6.225 versus Scout 4.15. Roads and terrain still modify movement. Faster acceleration and braking keep it responsive. Lore seed: “The sworn shield reaches danger first.” |
| **The Crown’s Last Bastion** | Shieldbearer crosses below 20% true HP | 90% reduction after armor for 20 seconds, or until health exceeds 60%. Protection persists while healing between 20% and 60%. Crossing damage beneath 20% is protected. Must heal above 60% to rearm; no continuous reactivation after timeout. |
| **Heart of the Unbroken Wild** | Every grizzly bloodline crosses below 20% true HP | Same rules and 90% reduction after existing hide defenses, lasting 60 seconds. False Last Light health cannot trigger it. Remaining duration and spent state persist in saves. |
| Shieldbearer armor and evasion | Permanent tank defenses | 3,480 HP, 80% damage reduction, one deterministic dodge per twenty incoming melee swings (5%). No new armor increase in this revision. |
| Shieldbearer threat lock | Tank lands a hit | Enemy attacks the tank for 8 seconds, refreshed on each hit, within 24 units. Existing valid tank retains ownership over another tank. Other fighters cannot steal aggro. |
| Team healing | Assigned Hearthkin, every 2 seconds | Heal every nearby injured eligible friendly unit within 24 units and line of sight: tanks 40 HP first, others 20 HP. Excludes self, dead units and enemies; no overheal. Healer remains dedicated until removed from team. |
| **Last Light Ward** | Hearthkin would die | Existing 60-second protection/restoration and untargetability. Outward curse follows after 1.5 seconds; blast animation lasts 0.9 seconds. |
| **Last Light Curse** | Last Light marks a susceptible enemy | Health becomes 1; next positive damage kills. Existing targeting/spread logic is preserved. |
| **The Borrowed Last Breath** | Last Light meets an immune bear | Displays 1 HP without changing true wounds. Activates Wrath, but not Colossus unless true health reaches half. Preserve existing bloodline trickery stories. |
| **Stunned** / **Steadfast** | Hearthkin strike against susceptible humanoid | Existing 5-second stun and 20-second stun immunity. Greatwood bears remain immune. |

## Swipe and formation rules

Either bear rage enables a 160-degree frontal swipe reaching 14 world units. It hits all living hostile units in the fan with clear line of sight, except ward-protected units. The direction is committed at the start of the swing and matches its facing; moving behind avoids ordinary contact. Bloodclaw Reckoning, on an 8-second cooldown, also hits rear damage fighters within 14 units and leaves them at 10% maximum health. It never increases health already below that floor, respects wards and line of sight, and excludes tanks and healers from the rear pulse. Tank aggro no longer disables cleave globally. The existing requirement for valid primary contact remains.

Team damage fighters wait for tank aggro outside the swipe radius, circle via an outer flank, and close into distinct rear slots. Tanks hold the front. Automatic healers follow behind the actual rear DPS line, at least 16 units from the bear and 3 units beyond that line. Their route updates every half-second as the encounter moves, using the outer perimeter when crossing sides. Healing range is 24 so they can reach the front tank. Explicit healer movement remains authoritative. Already standing inside an active frontal attack is still dangerous; formations are movement, not immunity. Very large rosters form additional rear rows rather than sharing a point.

## Damage reference

Crushing Claws multiplies bear damage against tanks by six before armor. Against a tank: base 348; Colossus 696; Wrath 2,088; both 4,176. After 80% armor, these become 69.6, 139.2, 417.6 and 835.2. The Crown’s Last Bastion now protects the portion below 20% health, so both rages require twelve landed hits to kill an unhealed full-health tank. Dodge remains 5%. One healer now restores 40 tank HP or 20 other-ally HP every two seconds (50% less output). This intentionally lets the bear overwhelm a single healer, especially in its final rage. Ordinary non-tank damage and rear Bloodclaw's 10% health floor are unchanged.

No new lore-card art was generated in this revision. Oathbound Stride and Greatwood Colossus now appear in unit inspection; the other existing named effects keep their original art and stories.


## Encounter music

Ancient Dungeon Siege is a dedicated battle recording (`assets/ancient-dungeon-siege.mp3`), excluded from the ordinary five-song album and dropdown. Supplied MP3 retained intact. First engagement with a wildlife unit or explicitly marked boss starts a 1.8-second crossfade. Track remains active until all engaged enemies die/disappear (or the player party is wiped out), so momentary target switching does not restart it. Future enemy types opt in with wildlife/boss flags. Mute and volume govern both layers.

Web Audio decodes once, removes boundary silence using a 10ms RMS threshold, and overlaps the final/initial 200ms with an equal-power crossfade. The resulting buffer loops on the audio clock without a media-ended delay. Crossfade peaks are normalized when necessary. The regular album fades back after combat; it keeps its playlist selection. Browser playback requires a user gesture. Local training includes Start, Enrage, Preview Bloodclaw, and Defeat training bear controls for testing.

Bloodclaw visuals: a full ground shockwave plus two opposing rotating fans of three tapered crimson claws, bright edges, and trailing red sparks. Duration 1.25 seconds; visual circle matches the 14-unit special attack area.

Timed last-stand rules supersede earlier health-only behavior. The damage reduction remains active until the timer runs out or HP is strictly greater than 60%; exactly 60% does not clear it. Reaching above 60% rearms a future below-20% activation. Buff timers advance in simulation time, including while stunned, but not while the game is paused.


Combat loop repair: the MP3's low-toned ending is excluded using an explicit 130-second source endpoint. Boundary trimming/crossfade yields a 129.71-second playable loop from the supplied recording. Buffer sources set explicit loopStart=0 and loopEnd=buffer.duration. Steady volume no longer schedules redundant AudioParam automation every frame; transitions cancel future automation before updating. Browser OfflineAudioContext rendered two full loops of the actual MP3 with zero sample error between repeats and nonzero identical post-boundary RMS. Original MP3 is preserved unchanged. `dev/audio-loop.html` provides a real-time boundary test and the full-loop render report.

Blocked rear approaches now fall back to reachable melee attack positions; healers and ranged fighters support from behind the tank. Failed routes or two seconds without movement trigger fallback, with bounded retries after eight seconds or after the target moves three units. Heart of the Unbroken Wild heals 10% maximum health every five active seconds (including a final pulse at 60 seconds). Partial pulse time persists in saves; no pulses occur after expiry or above-60% removal. Bloodclaw radius is now 14; healing reach is 24 to support the wider formation.

### Tank combat spacing (2026-09-11)
Shield Wardens hold five additional world units of combat clearance against units and buildings. Reciprocal enemy reach preserves incoming damage and aggro; walls still block attacks. A tank already too close backs away when a clear route exists. Hearthkin can heal tanks within 29 units to support the wider formation; other allies retain the 24-unit range. This is positioning, not a new buff or damage reduction.

### Defiance of the Greatwood and woodland cadence (2026-09-11)
Automatic bear encounters occur every 240 seconds, subject to existing per-side living-bear caps and legal woodland routes. The enemy side remains paused. Old saved schedules migrate to the next four-minute boundary without catch-up waves.
All bear bloodlines gain Defiance of the Greatwood: each living worker or fighter of either faction within 30 world units grants +5% damage and armor. Bonuses add (10 people = +50%); outgoing strikes multiply by 1 + bonus, and incoming damage after Thick Hide divides by 1 + bonus. Stacks refresh every quarter-second and disappear as people leave or die. Wildlife and corpses do not count. This stacks with Colossus, Wrath, and Heart, without granting immunity.
