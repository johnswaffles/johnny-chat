# False Mercy — the bear accepts Last Light

Release marker: `20260906-falsemercy1`

The Greatwood Grizzly now accepts Last Light Curse when a worker's ward resolves. It wears the same steady purple lesser rune and apparent one-hit curse badge as an ordinary cursed attacker. The First Condemnation remains active underneath. The world health bars, selected-unit panel, accessible health meter, and illustrated character card all show 1 / 180 HP while the marked bear lives.

Combat health stays separate from its appearance. Applying or repeating Last Light neither reduces nor restores true health; ordinary attacks wear it down normally. Its existing 180 HP, attack strength, attack timing and combat targeting remain unchanged. Death displays zero health. Ordinary attackers still receive the real one-HP curse and die from their next positive damage. Two worker hits still trigger the ward, immediately clear bear pursuit, and make protected workers untargetable.

The expanded First Condemnation story tells how the ancient beast learned to welcome lesser runes and feign a final breath to lure soldiers close. The Last Light entry explains the deception beneath that familiar mark. Clicking the overhead lesser rune opens this entry directly; the permanent curse and its original illustrated portrait remain available in the same card. The read-only creature journal shares the expanded lore.

New saves retain both the disguise and every real wound, including genuine one-HP health. Old pre-immunity saves with a living cursed bear stored at one actual HP receive a one-time health migration while retaining the rune. Other old battle damage and dead bears are preserved. A persisted decoy flag prevents repeated restoration on subsequent loads.

## Validation

- 35 checks pass across inspection/status, wildlife/economy, grizzly motion, roster and Hearthkin gameplay, camera rendering, and building services.
- Actual fixed-step combat with the cursed bear: one Crown Guard dies with the bear still at 110 true HP; two defeat it with one casualty; three defeat it with one casualty. These are seeded encounters, not guaranteed outcomes for every approach.
- Focused checks cover delayed curse resolution, both statuses and rune priority, repeat applications without healing, normal damage through apparent one-HP health, real death, two rounds of save/load at 180/93/1/0 true HP, and one-time legacy migration.
- Browser review checks the purple overhead rune, 1 / 180 HP in the panel and character card, accessible health value 1, and world bar ratio 1/180. A 17-point wound leaves 163 true HP before and after save/load while every visible health reading stays at one. Rune clicks open the trickery story, and both lore entries are readable on desktop and in a 390-pixel game viewport. The live Canvas two-guard encounter also ended with a defeated bear and one surviving guard, with no browser errors.

This release supersedes the lesser-curse rejection and save migration described in FIRST_CONDEMNATION_RELEASE.md. Existing original artwork is reused without modification.
