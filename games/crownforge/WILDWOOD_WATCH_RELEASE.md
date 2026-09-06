# Wildwood Watch

Release marker: `20260906-wildwoodwatch2`.

Enemy workers choose reachable gathering jobs, deliver cargo, resume unfinished construction and retain productive field work. A small collision oscillation no longer counts as useful progress. Jobs that stop progressing are retried or temporarily avoided, and a path snapped outside actual harvesting reach is rejected. Player-issued worker orders retain their existing behavior.

Idle Ashen military form recurring routes around their settlement perimeter. They respond to threats, yield to the existing raid orders, and resume patrols after combat. Patrol and hunting route searches have bounded candidate budgets.

A Greatwood Grizzly emerges from a legal woodland edge every 300 seconds of active game time. It hunts people from either faction, pursues targets through normal collision/pathfinding, and seeks another person when its target dies, becomes warded or cannot be reached. The timer and living bears are saved. Older saves begin at the next future five-minute boundary. A blocked spawn is retried rather than moving trees or placing the bear inside structures.

The grizzly has 180 health, 29 damage, a 1.45-second attack cycle and a 2.85 movement speed. One Crown Guard loses the measured encounter. Two flanking Crown Guards can win with one casualty and a badly wounded survivor; a less favorable approach can cost both guards. Weaker pairs can lose. Damage goes through the unchanged Last Light Ward, including its existing heal, shield and attacker curse. Both factions' workers survive repeated lethal hits.

## Artwork

Original bear art was generated with the built-in image generation tool. The final original RGBA sheet is `assets/crownforge-grizzly-v1.png` (1254 × 1254). The exact final prompt and generation provenance are in `GRIZZLY_ART_PROMPT.json`.

Sixteen measured sprite regions cover four directions, planted stance, two walking strides and a paw swipe. The renderer prepares three detail levels, adds restrained breathing, and animates a falling/fading death. The bear uses its own artwork and startup readiness checks, without a humanoid fallback.

## Validation

- Eleven wildlife/routine scenarios cover the 300/600/900-second cadence, real forest collision and routes, both factions, save/load and old saves, target reacquisition, attack orders, casualty balance, worker immortality, unreachable resources, collision oscillations, recurring patrols, resumed construction, productive farming and raid priority.
- A 920-second full seed-42 simulation reached three encounters; enemy workers were active 99.9% of samples, with a maximum idle interval of two seconds. All three opening workers and the newly trained worker completed real deposits. Simulation p99 was 1.62 ms, maximum 19.38 ms in the final regression run on this machine.
- Existing gathering, building services/defense, Hearthkin gameplay, smoothness, character loading, complete character movement/combat/save, roster motion, camera rendering and soundtrack checks pass.
- Browser inspection covers real settlement work and deposits, perimeter movement, woodland hunting, directional bear walking and attack phases, and two-guard combat. No runtime errors or frame intervals over 100 ms were observed. These are local measurements, not guarantees for every device.
- Grass rendering, forests, buildings, the existing character artwork/rigs and the Lantern-first soundtrack are retained. Their versioned import references are refreshed where required by the new configuration.
- Temporary QA pages are excluded from the release. Source and public distribution copies are verified together after the site build.
