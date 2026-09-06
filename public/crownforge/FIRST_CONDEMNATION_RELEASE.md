# The First Condemnation and character inspection

Release marker: `20260906-firstcondemnation1`

Historical release: lesser-curse rejection and its save migration are superseded by [False Mercy](FALSE_MERCY_RELEASE.md).

Last Light Curse now has a steady, thorned overhead rune. The previous pulsing circle and filled diamond are removed. The Greatwood Grizzly carries its own ember-colored rune from birth: **The First Condemnation**, a permanent divine curse which rejects lesser curses. Its short original story and original illustrated forest portrait appear in a character card. The bear can still take ordinary damage and be killed.

Bear strikes against a gathering class inflict 60% of that worker's maximum health, rounded up. This triggers a full-health worker's ward on the second landed strike without changing damage against soldiers. Activating the ward immediately clears every bear's pursuit, path, combat reservation and target for that worker. All attack commands reject shielded units, damage protection takes precedence over curse damage, and the bear's hunt and spawning searches exclude shielded people. Hunters pursue other available prey; if all people are warded, they prowl until someone becomes targetable. Ward expiration restores attack eligibility.

The Last Light Curse still reduces ordinary attackers to 1 HP and makes their next wound fatal. Living bears in older saves that already carry that superseded curse have it removed and their health restored; ordinary battle damage, dead bears and unrelated save data are retained.

Left-clicking any hostile unit inspects it, including when friendly units were selected. Right-click still orders selected friendly troops to attack. Inspected hostiles never join controllable groups. Guard/patrol clearing, recovery, movement and attack commands enforce player ownership. The panel displays live health, activity, carried resources and active buffs/curses. Portrait and status buttons open the character card; the overhead curse rune is also clickable. The card supports keyboard dismissal and narrow-screen scrolling. Selecting a hostile expands the compact inspection panel.

Original lore: Before the first crown was forged, this bear broke the silence of a sacred grove. God marked it and condemned it to wander beneath the trees until their last root withers. No lesser curse may claim what Heaven has already condemned.

## Verification

- Seven focused inspection/status regressions cover two actual landed hits for both worker classes, immediate multi-bear disengagement, alternate prey, all-protected prey, ward expiry, damage protection precedence, curse immunity and ordinary damage, old-save migration, ordinary curse lethality, hostile ownership boundaries across every class, normal click/rune input behavior and circle-free sigil drawing.
- Nine bear motion/response regressions and eleven wildlife/economy regressions pass, including encounter cadence, two-soldier balance, shields, route budgets, and the three-encounter 920-second economy run.
- Roster gameplay, Hearthkin gameplay, camera rendering and building services pass.
- Actual Canvas game review verified the bear's live health/status card, overhead-rune click, illustrated lore, Escape dismissal, an ordinary cursed Raider with 1/72 HP, and two protected workers while the uncursed 180-HP bear prowled with no target. No browser errors were observed. The card was also inspected in a 390-pixel-wide game viewport.
- Source/public mirroring, scoped syntax, import resolution, whitespace and the site build passed. The combined test run passed all 31 tests. Temporary arena harnesses are excluded.

Artwork: `assets/crownforge-first-condemnation-v1.png`; original built-in ImageGen output, copied without pixel edits. Exact prompt and reference provenance: `FIRST_CONDEMNATION_ART_PROMPT.json`. The shared Canvas/SVG runes are authored in `src/unit-status.js`. Read-only illustrated preview: `dev/creature-journal.html`.
