# Combat effects and lore-card reference

Revision: 20260913-clearing1. Local revision; verify the live marker for deployment status. This is the gameplay reference for the next lore-card pass. Existing art and bloodline stories remain in `src/bear-variants.js` and `src/unit-status.js`.

| Effect | Owner and trigger | Actual rule |
| --- | --- | --- |
| **Greatwood Colossus** | Bear first reaches 50% **true** health | Double rendered size, body radius (3 → 6 world units), and outgoing damage. Latched for the rest of its life and saved. |
| **Wrath of the First Oath** | Bear at 10% true health | Existing 6× damage layer. Stacks with Colossus for 12× base damage. Landed blows remain lethal to non-tank fighters. |
| **The First Condemnation** | Permanent Greatwood elder magic | Immunity to lesser curses and stuns; true physical wounds still kill. Preserve the established ancient sentence/bloodline lore. |
| **Elderhide** | Permanent bear protection | Reduces incoming arrow damage by 95% before Thick Hide. |
| **Thick Hide** | Permanent bear armor | Halves incoming damage; combined with Elderhide, reduces arrow damage by 97.5% before other protection. |
| **Crushing Claws** | Permanent bear tank pressure | Six times prior strike damage against tanks, before armor. Stacks with both bear rage layers. |
| **Bloodclaw Reckoning** | Enraged bear, 8-second cooldown | 360-degree AoE: 50% maximum-health damage before defenses to every hostile unit within 14 units and line of sight. Includes tanks and healers; wards respected. |
| **Oathbound Stride** | Permanent Crown Shieldbearer blessing | Base movement speed is 1.5 times the fastest other unit: currently 6.225 versus Scout 4.15. Roads and terrain still modify movement. Faster acceleration and braking keep it responsive. Lore seed: “The sworn shield reaches danger first.” |
| **The Crown’s Last Bastion** | Shieldbearer crosses below 20% true HP | 90% reduction after armor for 20 seconds, or until health exceeds 60%. Protection persists while healing between 20% and 60%. Crossing damage beneath 20% is protected. Must heal above 60% to rearm; no continuous reactivation after timeout. |
| **Heart of the Unbroken Wild** | Every grizzly bloodline crosses below 20% true HP | Same rules and 90% reduction after existing hide defenses, lasting 60 seconds. Remaining duration and spent state persist in saves. |
| **Heart of the Deathless Greatwood** | Any bear crosses below 5% true HP | 99% damage reduction after hide/armor for 60 seconds, replacing ordinary Heart reduction. Protects the below-5% portion of the crossing hit. Persists through healing; no added regeneration. Rearms after expiry and healing above 60%. Timer/spent state persist in saves. |
| Shieldbearer armor and evasion | Permanent tank defenses | 3,480 HP, 80% damage reduction, one deterministic dodge per twenty incoming melee swings (5%). No new armor increase in this revision. |
| Shieldbearer threat lock | Tank lands a hit | Enemy attacks the tank for 8 seconds, refreshed on each hit, within 24 units. Existing valid tank retains ownership over another tank. Other fighters cannot steal aggro. |
| Team healing | Assigned Hearthkin, every 2 seconds | Heal every nearby injured eligible friendly unit within 24 units and line of sight: tanks 40 HP first, others 4 HP. Excludes self, dead units and enemies; no overheal. Healer remains dedicated until removed from team. |
| **Last Light Ward** | Any attempted damaging hit on Hearthkin | No health is lost. Activates 60-second untargetability and reveals their protection. Immediately grants Chorus of the Last Light to living allies; outward blessing animation lasts 0.9 seconds. |
| **Chorus of the Last Light** | Hearthkin shield activates | Living allies receive 200% of normal healing (2×) for 60 seconds: tanks 80 HP and others 8 HP per team heal. Another activation refreshes the duration without stacking. No curse or false health is applied to enemies. |
| **Stunned** / **Steadfast** | Hearthkin strike against susceptible humanoid | Existing 5-second stun and 20-second stun immunity. Greatwood bears remain immune. |

## Swipe and formation rules

Either bear rage enables Bloodclaw Reckoning every eight seconds. The special deals 50% maximum-health AoE damage before defenses to every living hostile unit within 14 units and clear line of sight, including tanks and healers. It never heals or enforces a remaining-health floor. Wards protect. The primary melee strike remains directional, requires contact, and is separate from the AoE. The attack commits its direction at swing start; moving behind avoids ordinary primary contact.

Team damage fighters wait for tank aggro outside the swipe radius, circle via an outer flank, and close into distinct rear slots. Tanks hold the front. Automatic healers follow behind the actual rear DPS line, at least 16 units from the bear and 3 units beyond that line. Their route updates every half-second as the encounter moves, using the outer perimeter when crossing sides. Healing range is 24 so they can reach the front tank. Explicit healer movement remains authoritative. Already standing inside an active frontal attack is still dangerous; formations are movement, not immunity. Very large rosters form additional rear rows rather than sharing a point.

## Damage reference

Crushing Claws multiplies bear damage against tanks by six before armor. Against a tank: base 348; Colossus 696; Wrath 2,088; both 4,176. After 80% armor, these become 69.6, 139.2, 417.6 and 835.2. The Crown’s Last Bastion now protects the portion below 20% health, so both rages require eight landed hits to kill an unhealed full-health tank. Dodge remains 5%. One healer now restores 40 tank HP or 20 other-ally HP every two seconds (50% less output). This intentionally lets the bear overwhelm a single healer, especially in its final rage. Ordinary non-tank damage and Bloodclaw now uses percentage AoE damage as detailed below.

No new lore-card art was generated in this revision. Oathbound Stride and Greatwood Colossus now appear in unit inspection; the other existing named effects keep their original art and stories.


## Encounter music

Ancient Dungeon Siege is a dedicated battle recording (`assets/ancient-dungeon-siege.mp3`), excluded from the ordinary five-song album and dropdown. Supplied MP3 retained intact. First engagement with a wildlife unit or explicitly marked boss starts a 1.8-second crossfade. Track remains active until all engaged enemies die/disappear (or the player party is wiped out), so momentary target switching does not restart it. Future enemy types opt in with wildlife/boss flags. Mute and volume govern both layers.

Web Audio decodes once, removes boundary silence using a 10ms RMS threshold, and overlaps the final/initial 200ms with an equal-power crossfade. The resulting buffer loops on the audio clock without a media-ended delay. Crossfade peaks are normalized when necessary. The regular album fades back after combat; it keeps its playlist selection. Browser playback requires a user gesture. Local training includes Start, Enrage, Preview Bloodclaw, and Defeat training bear controls for testing.

Bloodclaw visuals: a full ground shockwave plus two opposing rotating fans of three tapered crimson claws, bright edges, and trailing red sparks. Duration 1.25 seconds; visual circle matches the 14-unit special attack area.

Timed last-stand rules supersede earlier health-only behavior. The damage reduction remains active until the timer runs out or HP is strictly greater than 60%; exactly 60% does not clear it. Reaching above 60% rearms a future below-20% activation. Buff timers advance in simulation time, including while stunned, but not while the game is paused.


Combat loop repair: the MP3's low-toned ending is excluded using an explicit 130-second source endpoint. Boundary trimming/crossfade yields a 129.71-second playable loop from the supplied recording. Buffer sources set explicit loopStart=0 and loopEnd=buffer.duration. Steady volume no longer schedules redundant AudioParam automation every frame; transitions cancel future automation before updating. Browser OfflineAudioContext rendered two full loops of the actual MP3 with zero sample error between repeats and nonzero identical post-boundary RMS. Original MP3 is preserved unchanged. `dev/audio-loop.html` provides a real-time boundary test and the full-loop render report.

Blocked rear approaches now fall back to reachable melee attack positions; healers and ranged fighters support from behind the tank. Failed routes or two seconds without movement trigger fallback, with bounded retries after eight seconds or after the target moves three units. Heart of the Unbroken Wild heals 2% maximum health every five active seconds (including a final pulse at 60 seconds). Partial pulse time persists in saves; no pulses occur after expiry or above-60% removal. Bloodclaw radius is now 14; healing reach is 24 to support the wider formation.

### Tank combat spacing (2026-09-11)
Shield Wardens hold five additional world units of combat clearance against units and buildings. Reciprocal enemy reach preserves incoming damage and aggro; walls still block attacks. A tank already too close backs away when a clear route exists. Hearthkin can heal tanks within 29 units to support the wider formation; other allies retain the 24-unit range. This is positioning, not a new buff or damage reduction.

### Defiance of the Greatwood and woodland cadence (2026-09-11)
Automatic bear encounters occur every 240 seconds, subject to existing per-side living-bear caps and legal woodland routes. The enemy side remains paused. Old saved schedules migrate to the next four-minute boundary without catch-up waves.
All bear bloodlines gain Defiance of the Greatwood: each living worker or fighter of either faction within 30 world units grants +5% damage and armor. Bonuses add (10 people = +50%); outgoing strikes multiply by 1 + bonus, and incoming damage after Thick Hide divides by 1 + bonus. Stacks refresh every quarter-second and disappear as people leave or die. Wildlife and corpses do not count. This stacks with Colossus, Wrath, and Heart, without granting immunity.

### Bloodclaw and Crown Aegis (2026-09-12, supersedes earlier values)
Heart of the Unbroken Wild restores 2% maximum health every five active seconds; its trigger, duration, expiry and rearm rules are unchanged. Bloodclaw Reckoning is a full-circle AoE every eight seconds within 14 units and line of sight. Each hostile unit, including tanks and healers, takes 50% of its maximum health before defenses; there is no ten-percent health floor. It is separate from the primary melee strike and does not scale with bear rage or crowd bonuses. Wards still protect. Aegis of the Unbroken Crown permanently reduces Shieldbearer AoE damage by 90%, multiplicatively with armor and Last Bastion. AoE cannot be melee-dodged.

### Open-ground pulling and stable surrounds (2026-09-12)
A team tank with established aggro checks nearby terrain for room around the target. If walls, trees or buildings obstruct the party, it chooses a clear reachable arena, walks away to draw the enemy there, and waits when its lead grows too large. A visible, nearby chase preserves the tank’s threat lock for this bounded pull. Pulls stop on arrival, loss of aggro, blocked movement, four seconds without enemy progress, or twenty seconds total. Manual orders cancel them. Inaccessible clearings are skipped and normal combat remains available.

Damage fighters give the pulling tank room, then take persistent individually reserved flank/rear slots around bears or other tank-held units. New arrivals fill unused slots without shuffling existing fighters. Large parties use additional spaced rings. Healers follow the pull, then return behind the damage line; even fallback movement orbits around the enemy instead of crossing its body. Buildings themselves are stationary attack targets and are never pulled.

### Kingsbane Hunger and Scent of the Faltering Crown
Bloodclaw Reckoning now deals 50% maximum-health AoE damage before defenses within 14 units every eight seconds while enraged. It can kill; it never merely halves current health. Tanks retain armor, Aegis and Last Bastion. Kingsbane Hunger doubles all bear damage to tanks already below 50% true health when each hit resolves, including AoE. Scent of the Faltering Crown makes bears prioritize the lowest-health-percentage living hostile tank within 24 units and line of sight, excluding warded tanks. Health ties preserve the current target; otherwise the lowest ID wins. Bear priority supersedes the previous first-tank threat lock; other enemies retain their existing taunt rules.

**Beyond the First Oath** — permanent Hearthkin protection. All damage, hostile magic, curses, and stuns are blocked. Attempted damage awakens Last Light Ward and the team healing blessing without taking health; an active ward is not continually refreshed. Friendly heals and blessings remain effective.

Mercy of the Last Crown: a living tank strictly below 10% maximum HP receives 5× Hearthkin healing. Each healer checks the threshold before its pulse: 200 HP normally, 400 HP with Chorus. At 10% or above, normal tank healing remains 40 HP (80 with Chorus). Non-tanks receive 4 HP per pulse (8 with Chorus), an 80% reduction from their former base healing.

## Starveil Arcanist — Keeper of the Last Star

One living or training wizard per side, shared across all team groups and observatories. One player wizard and one enemy wizard can coexist. See [STARVEIL_ARCANIST.md](STARVEIL_ARCANIST.md) for original lore, art, recruitment, and animation details.

- **Starshard:** traveling arcane bolt, 36 damage, 36 range, 2.2-second attack cycle.
- **Falling Constellation:** a ready bolt adds 64 arcane AoE damage within 7 units; 12-second cooldown. Allies are excluded; Hearthkin immunity and tank AoE defenses apply.
- **Astral Mantle:** a hit that would cross below 35% health triggers 70% damage reduction for 6 seconds, protecting the triggering hit. 30-second cooldown. No healing.

## Vaelthryx — Heavenrend

**Heavenrend:** manual Starveil Arcanist summon; 300-second cooldown; target/current or nearest enemy within 45 units. Ten-second flight, six-second lightning sweep across a 48-unit line. 150 lightning AoE damage every 0.5 seconds within 12 units of the moving breath center. Friendly units are excluded; Hearthkin magic immunity and tank AoE defenses apply. Flies over terrain; no building damage.

**Stormward Covenant:** 30% incoming damage reduction for 12 seconds on allies within 28 units at summon time. **Skybreaker's Favor:** +50% Starshard damage for 12 seconds on the wizard. **Unbound Sovereign:** untargetable dragon continues its flight if the wizard dies. Full original lore and art: [VAELTHRYX_SKYBREAKER.md](VAELTHRYX_SKYBREAKER.md).

## Elderblood Spellward

All Greatwood bear bloodlines resist 95% of incoming magic. Only 5% passes to existing Thick Hide, Defiance, and Heart defenses. This includes Starshard, Falling Constellation, and Heavenrend, even after the wizard dies. With Thick Hide alone, a 100-damage spell deals 2.5 HP. Physical weapons and Elderhide arrow protection are unchanged. Wizard and dragon presentation remains spectacular while their damage against bears is intentionally limited.

## Eventide Passage and Distant Star

Distant Star seeks a clear position about 30 units from enemies, at least 6 units beyond nearby healers, with 36-unit casting reach. Wizard formation orders use a row behind healers. Healers do not chase the wizard to define their own rear line. Paths are checked against nearby enemies so repositioning cannot cut through the fight.

Eventide Passage automatically reacts to any hostile pursuing the wizard or a hostile within 20 units. A successful blink moves at least 24 units, to an open landing at least 38 units from all hostile units. Landing candidates are checked at their center and eight surrounding points, against map boundaries, obstacles and occupied cells. If no safe destination exists, no teleport or cooldown is spent.

The wizard breaks hostile pursuit and clears his in-flight bolts, cannot attack or be targeted/damaged for 6 seconds, and has an 8-second escape cooldown. He resumes his interrupted target after a teammate holds that enemy. Veil, cooldown and pending target persist through saves. This is spacing plus a temporary immunity, not permanent AoE immunity.

The effect pairs an imploding star iris with a distant nebula doorway: engraved ground seals, counter-rotating light ribbons, crystal motes, a star bridge and a reforming column of light. Reduced motion simplifies particles. Local test route: `dev/eventide.html` (Replay bear chase, Inspect the rift, Test the formation).
