# Combat teams

## Working prompt
Add a left-panel action for every warrior class that selects all living player units of that class. Turn the Crown Shieldbearer into a tank that survives nineteen unhealed enraged bear contacts and dies on the twentieth, deals one tenth of a Crown Guard's per-hit damage, and holds enemy attention after landing a hit. Other fighters can attack while the tank holds the enemy.

Add left-panel team creation, adding and removing members, selecting a team, and disbanding. Teams may contain multiple tanks, damage fighters, and Hearthkin healers. Any player Hearthkin assigned to a team automatically heals injured nearby teammates and follows the frontline. Keep normal workers and explicit movement/work orders working. Save team membership and migrate older Shieldbearer health. Leave room for future animal and support classes.

## First balance pass
- Shieldbearer: 3,480 HP; 1.4 damage per hit (Crown Guard: 14).
- Enraged bear: 174 damage against a tank; existing lethal rule remains for other fighters.
- Tank threat: eight seconds from its most recent hit, maximum 24-unit leash. Ordinary hits cannot steal it. Another tank cannot steal a valid tank's target. Death, ward protection, leaving the leash, or expiry releases it.
- Threat applies to attackable enemy units, not only grizzlies. While a bear is tank-focused, it does not cleave the other fighters.
- Hearthkin healer: 40 HP every two seconds to one injured teammate within eight world units and clear combat line of sight. No self-healing, overhealing, resurrection, healing enemies, or healing other teams. Multiple healers can cooperate.
- Healers follow behind the team's tank or nearest damage fighter. Explicit movement and work take priority; team attack commands put healers in support rather than melee. Removing them restores normal automatic worker jobs.
- Roles are data-driven through combatRole; support is reserved for future units, with no new support abilities in this change.

## Review
Open /dev/combat-teams.html. Start with class-wide selection, select the squad, and create a team using the real left-panel controls. Start training fight to observe tank targeting and healing. The training bear has extended health solely to allow a longer demonstration; production bear health is unchanged.

Regression tests cover class selection, exact contact count, damage ratio, threat retention and expiry, cleave protection, healing eligibility/cooldown/range/line of sight, following versus manual movement, team membership changes, and save migration. Release marker: 20260911-teams2.
