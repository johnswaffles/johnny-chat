# Your team — current balance

There is one persistent team, with no extra membership limit beyond the game's available units. Add replacements to the same roster after a wipe. Older numbered teams merge into this team on load. Use Add selected, Remove selected, Add all, or Clear roster in the left panel.

Bears now awaken Greatwood Colossus at 50% true health: double size and damage. This stacks with Wrath of the First Oath at 10% true health. Shieldbearers retain 3,480 HP, 80% armor, and 5% dodge (one per twenty melee swings). Against both rages, they survive eight landed hits with Last Bastion without healing. Oathbound Stride grants 1.5 times the fastest other base movement speed. Tank damage remains 1.4. See COMBAT_EFFECTS.md for the complete balance and lore reference.

Team Hearthkin prioritize healing, but explicit construction and repair orders take priority until finished. They retain team membership and resume healing afterward. Every two seconds it heals all injured friendly units within 24 world units and clear line of sight, excluding itself: tanks receive 40 HP and other allies receive 0.4 HP. Tanks are processed first and lead the healer's following behavior. No overhealing, resurrection, or healing enemies.

When attacking a unit, team damage fighters stage behind the tank line until a tank lands a hit and claims aggro. Multiple tanks lead together; fighters proceed if no tanks survive. Against a tank-held bear they circle outside the frontal swipe and take distinct rear positions. Automatic healers follow behind the current rear DPS line, at least 16 units from the bear and 3 units behind the fighters, updating their path as the encounter moves. Rear positioning avoids ordinary frontal damage. Bloodclaw Reckoning deals 50% maximum-health AoE damage before defenses within 14 units every 8 seconds; Aegis of the Unbroken Crown reduces tank AoE damage by 90%. Cancelling a unit's order clears the staged approach. Ground movement destinations place tanks in the front row, damage fighters behind them, and healers at the rear.

Enemy settlement pause and player-side-only bear release remain enabled. Artwork quality is unchanged. Release revision: 20260913-clearing1.

Crushing Claws increases bear damage against tanks sixfold; half-health Colossus hits now deal 139.2 damage after armor. Healing output is halved. Bloodclaw has a full circular rotating claw effect.

The Crown’s Last Bastion reduces incoming damage after armor by 90% after activating below 20% health. Only the below-threshold part of a crossing hit is protected. It lasts 20 seconds or until health exceeds 60%. It must heal above 60% before rearming. All bears gain Heart of the Unbroken Wild with the same trigger and removal rules, lasting 60 seconds.

Blocked rear approaches now fall back to reachable melee attack positions; healers and ranged fighters support from behind the tank. Failed routes or two seconds without movement trigger fallback, with bounded retries after eight seconds or after the target moves three units. Heart of the Unbroken Wild heals 2% maximum health every five active seconds (including a final pulse at 60 seconds). Partial pulse time persists in saves; no pulses occur after expiry or above-60% removal. Bloodclaw radius is now 14; healing reach is 24 to support the wider formation.

### Tank combat spacing (2026-09-11)
Shield Wardens hold five additional world units of combat clearance against units and buildings. Reciprocal enemy reach preserves incoming damage and aggro; walls still block attacks. A tank already too close backs away when a clear route exists. Hearthkin can heal tanks within 29 units to support the wider formation; other allies retain the 24-unit range. This is positioning, not a new buff or damage reduction.

### Defiance of the Greatwood and woodland cadence (2026-09-11)
Automatic bear encounters occur every 240 seconds, subject to existing per-side living-bear caps and legal woodland routes. The enemy side remains paused. Old saved schedules migrate to the next four-minute boundary without catch-up waves.
All bear bloodlines gain Defiance of the Greatwood: each living worker or fighter of either faction within 30 world units grants +5% damage and armor. Bonuses add (10 people = +50%); outgoing strikes multiply by 1 + bonus, and incoming damage after Thick Hide divides by 1 + bonus. Stacks refresh every quarter-second and disappear as people leave or die. Wildlife and corpses do not count. This stacks with Colossus, Wrath, and Heart, without granting immunity.

### Deathless Heart and open-ground combat
Below 5% true health, Heart of the Deathless Greatwood replaces the ordinary Heart damage reduction with 99% for sixty seconds. It persists through healing, adds no healing pulse, and requires expiry plus healing above 60% to rearm.

Team tanks with aggro pull mobile enemies out of obstructed terrain into a reachable clearing. DPS wait clear of the chase, then spread into persistent flank/rear reservations instead of competing for one approach. Extra rings accommodate larger rosters. Healers follow the tank during the pull and orbit safely back behind DPS afterward. Failed or stalled pulls time out and normal attacks resume; manual movement cancels the pull. See COMBAT_EFFECTS.md for bounds and current rules.

### Kingsbane Hunger and Scent of the Faltering Crown
Bloodclaw Reckoning now deals 50% maximum-health AoE damage before defenses within 14 units every eight seconds while enraged. It can kill; it never merely halves current health. Tanks retain armor, Aegis and Last Bastion. Kingsbane Hunger doubles all bear damage to tanks already below 50% true health when each hit resolves, including AoE. Scent of the Faltering Crown makes bears prioritize the lowest-health-percentage living hostile tank within 24 units and line of sight, excluding warded tanks. Health ties preserve the current target; otherwise the lowest ID wins. Bear priority supersedes the previous first-tank threat lock; other enemies retain their existing taunt rules.

### Divide the Hunt (local side-pull revision)
Your team can send a spare tank and healer to a second engaged enemy, preserving one tank and healer for the primary fight. The primary enemy is the one with the most damage fighters assigned. The healthiest spare tank draws the second enemy over 32 units away through an open, checked corridor; its healer follows that tank. Damage fighters assigned to the second enemy return to the primary fight. During this explicit order, each enemy prioritizes its assigned tank within normal range and line of sight, superseding automatic weakest-tank priority. Cancel restores normal targeting. Missing members, death, manual tank/healer orders, a blocked or stalled chase, or a 45-second unsuccessful pull cancel the assignment. A successful pair holds the separated enemy until cancelled or the encounter ends.

Combat portraits display only the tank most recently damaged within eight seconds (otherwise an enemy's current tank target), plus up to three engaged enemies.

### Woodland extraction
Automatic tank pulls include tree-canopy clearance and a wider fighting ring, search clearings up to 48 units away, and allow up to 35 seconds for a visible chase. The bear must move at least five units and have a clear fighting ring before the pull finishes. Tanks need no team membership or accompanying damage fighter to pull. Tree trunks, buildings, map boundaries, line of sight, and stalled-chase cancellation remain enforced.

### Target portraits after tank loss
The friendly combat frame now includes any player unit being attacked, including fighters and Hearthkin. Dead units are removed immediately, so a bear switching away from a fallen tank reveals its next target before the next hit. Recent damage still determines focus when several allies are under pressure; the display remains one friendly and up to three enemies. The remaining five Crown and six Ashen classes have three-frame painted breathing portraits, with reduced-motion support.

Chorus of the Last Light: a Hearthkin shield activation grants living allies 200% of normal healing for 60 seconds. Team heals become 80 HP for tanks and 8 HP for other allies, still capped at maximum health. Additional activations refresh the duration without stacking. The buff persists if its caster dies.

Add all recruits every living eligible friendly unit, including Hearthkin, into Your team without changing the current selection. New Hearthkin members leave work orders and begin team healing. The button is disabled when everyone is already enrolled.

Explicit tank movement overrides automatic attack recruitment until arrival, then normal nearby-enemy aggression resumes. A new direct command supersedes the move. Queued moves use the same priority when they begin.

Mercy of the Last Crown: a living tank strictly below 10% maximum HP receives 5× Hearthkin healing. Each healer checks the threshold before its pulse: 200 HP normally, 400 HP with Chorus. At 10% or above, normal tank healing remains 40 HP (80 with Chorus). Non-tanks receive 0.4 HP per pulse (0.8 with Chorus), a 98% reduction from their former base healing.

Woodland encounters: new bears require a clear encounter footprint near a woodland edge rather than merely a noncolliding trunk position. Tank pulls use legal routed paths for both bodies and preserve corner waypoints. Damage fighters wait while a wooded target lacks a safe pull; healer follow stays behind the tank. A brief trunk occlusion retains an already validated tank chase. Wildlife rally cannot override explicit tank movement.

## Starveil Arcanist

The wizard is ranged damage support. He holds spell range rather than joining the melee surround ring, and honors tank pull staging. His one-per-side cap is independent of combat team IDs; splitting units into multiple teams never creates another wizard slot. Queued training at any observatory reserves the side's slot. The enemy side has its own independent slot without reactivating the paused enemy faction.

## Elderblood Spellward

All Greatwood bear bloodlines resist 95% of incoming magic. Only 5% passes to existing Thick Hide, Defiance, and Heart defenses. This includes Starshard, Falling Constellation, and Heavenrend, even after the wizard dies. With Thick Hide alone, a 100-damage spell deals 2.5 HP. Physical weapons and Elderhide arrow protection are unchanged. Wizard and dragon presentation remains spectacular while their damage against bears is intentionally limited.
