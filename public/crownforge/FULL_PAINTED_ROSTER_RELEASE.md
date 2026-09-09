# Full painted roster and Greatwood bear release

Release: `20260909-fullroster1`, 9 September 2026. The user authorized integration, push and deployment of all completed character and bear work.

The ten completed fighter rebuilds now replace their old body-part rigs in the actual game: Crown Guard, Spearwarden, Militia, Shieldbearer, Scout, Ashen Raider, Thorn Spear, Hearth Levy, Hidewall and Outrider. All have independently authored SW/SE/NE/NW artwork and idle, walk, attack, hit, dazed and death sequences: 240 action views and 800 frames. The two approved painted Hearthkin remain in use.

Versioned metadata loads per character. Only required paintings download; the renderer retains bounded shared caches and a correctly faced idle pose during new action loading. Existing movement and combat clocks drive the new artwork. Hit and dazed reactions retain priority. Startup warming supports whole paintings as well as earlier multipart rigs.

Includes the completed bear fury/arrow armor/retaliation/moving-combat/lore work and the latest v3 rear-leg collapse redraw. See `art-notes/bear-fury-review.md` for behavior and `art-notes/painted-roster/release-inventory.json` for exact roster source hashes. Earlier local review notes are preserved as history; their local-only status is superseded by this release authorization.

Validation before push: 52 bear/combat/inspection/gameplay checks, 4 painted roster integration checks and 7 cache checks pass. The full site build passes. Browser field review shows all twelve characters, ten new painted fighters, walking, attacks with damage and successful save restoration. A fresh full-game load reaches the playable settlement. Source/public parity and live verification are checked separately during publication.

Play: https://crownforge-dawn-kingdoms.onrender.com/?release=20260909-fullroster1
Roster field: https://crownforge-dawn-kingdoms.onrender.com/dev/roster-world.html?release=20260909-fullroster1
