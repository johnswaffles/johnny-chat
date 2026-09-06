# Paired bear release — 20260906-bearpair1

The bottom command bar includes RELEASE BEARS / BOTH SIDES. Each request releases one grizzly targeting the player faction and one targeting the enemy faction on the same simulation tick. Both use real woodland edges, clear spawn positions, and legal combat routes. Existing bears are excluded from nearby spawn positions.

The button displays FINDING TRAILS while route searches are pending. Searches use the existing per-side budget and retry every half second for up to eight seconds. If either side has no safe route, neither bear is released. Duplicate clicks during a pending request are ignored. Pending requests survive saves. Matches must be active and both factions must have living people; protected workers remain ineligible targets.

The existing five-minute encounter timer remains unchanged. Every completed additional click creates another pair.

Validation: 26 spawning, wildlife and inspection tests passed, including paired spawns on three world seeds, repeated requests, simultaneous spawn timestamps, correct target factions, pending-save restoration, protected targets, bounded blocked-side searches, and unchanged automatic encounter timing.
