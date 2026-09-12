# Your team — current balance

There is one persistent team, with no extra membership limit beyond the game's available units. Add replacements to the same roster after a wipe. Older numbered teams merge into this team on load. Use Add selected, Remove selected, Select team, or Clear roster in the left panel.

Bears now awaken Greatwood Colossus at 50% true health: double size and damage. This stacks with Wrath of the First Oath at 10% true health or the false Last Light reading. Shieldbearers retain 3,480 HP, 80% armor, and 5% dodge (one per twenty melee swings). Against both rages, they survive twelve landed hits with Last Bastion without healing. Oathbound Stride grants 1.5 times the fastest other base movement speed. Tank damage remains 1.4. See COMBAT_EFFECTS.md for the complete balance and lore reference.

Every team Hearthkin prioritizes healing over gathering, building, or attacking until removed from the team. Every two seconds it heals all injured friendly units within 24 world units and clear line of sight, excluding itself: tanks receive 40 HP and other allies receive 20 HP. Tanks are processed first and lead the healer's following behavior. No overhealing, resurrection, or healing enemies.

When attacking a unit, team damage fighters stage behind the tank line until a tank lands a hit and claims aggro. Multiple tanks lead together; fighters proceed if no tanks survive. Against a tank-held bear they circle outside the frontal swipe and take distinct rear positions. Automatic healers follow behind the current rear DPS line, at least 16 units from the bear and 3 units behind the fighters, updating their path as the encounter moves. Rear positioning avoids ordinary frontal damage. Bloodclaw Reckoning now reduces rear DPS to 10% maximum health every 8 seconds, giving healers a recovery window. Cancelling a unit's order clears the staged approach. Ground movement destinations place tanks in the front row, damage fighters behind them, and healers at the rear.

Enemy settlement pause and player-side-only bear release remain enabled. Artwork quality is unchanged. Release revision: 20260911-defiance1.

Crushing Claws increases bear damage against tanks sixfold; half-health Colossus hits now deal 139.2 damage after armor. Healing output is halved. Bloodclaw has a full circular rotating claw effect.

The Crown’s Last Bastion reduces incoming damage after armor by 90% after activating below 20% health. Only the below-threshold part of a crossing hit is protected. It lasts 20 seconds or until health exceeds 60%. It must heal above 60% before rearming. All bears gain Heart of the Unbroken Wild with the same trigger and removal rules, lasting 60 seconds.

Blocked rear approaches now fall back to reachable melee attack positions; healers and ranged fighters support from behind the tank. Failed routes or two seconds without movement trigger fallback, with bounded retries after eight seconds or after the target moves three units. Heart of the Unbroken Wild heals 10% maximum health every five active seconds (including a final pulse at 60 seconds). Partial pulse time persists in saves; no pulses occur after expiry or above-60% removal. Bloodclaw radius is now 14; healing reach is 24 to support the wider formation.

### Tank combat spacing (2026-09-11)
Shield Wardens hold five additional world units of combat clearance against units and buildings. Reciprocal enemy reach preserves incoming damage and aggro; walls still block attacks. A tank already too close backs away when a clear route exists. Hearthkin can heal tanks within 29 units to support the wider formation; other allies retain the 24-unit range. This is positioning, not a new buff or damage reduction.

### Defiance of the Greatwood and woodland cadence (2026-09-11)
Automatic bear encounters occur every 240 seconds, subject to existing per-side living-bear caps and legal woodland routes. The enemy side remains paused. Old saved schedules migrate to the next four-minute boundary without catch-up waves.
All bear bloodlines gain Defiance of the Greatwood: each living worker or fighter of either faction within 30 world units grants +5% damage and armor. Bonuses add (10 people = +50%); outgoing strikes multiply by 1 + bonus, and incoming damage after Thick Hide divides by 1 + bonus. Stacks refresh every quarter-second and disappear as people leave or die. Wildlife and corpses do not count. This stacks with Colossus, Wrath, and Heart, without granting immunity.
