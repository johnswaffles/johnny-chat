# Complete roster motion release

Published release: `20260904-rosterkin1`. Reviewed and verified live September 5, 2026. Runtime/art release commit: `1e0f40c`.

## Result

All 12 current characters use their own four-view articulated artwork. Workers, foot soldiers, and mounted units have separate movement families. The Crown worker's front/back elbows and axe thickness, left-view equipment depth, hammer striking plane, two-hand hoe orientation, and rear torso occlusion have been corrected. These principles now apply throughout both factions.

New costume artwork, measured wrist/palm anchors, appropriate palm/knuckle views and closed shoulder underlays eliminate the floating grips and hollow joints found during enlarged review. Original solid equipment has a shaft, striking face, edge and thickness rather than a single rotated profile image. Foot gait follows support and weight transfer; horses have four-beat support, measured hoof soles, and independent seated riders.

## Visible review

The four-direction moving state grids in `dev/roster-review.html` cover both workers' 23 states over pages 0–2, plus every foot/mounted action on page 0. Enlarged `dev/hearthkin-studio.html` inspections supplement the grids for palm surfaces, shoulder joins, work contact and weapon depth. Player-size samples show both 28% and 70% game scales.

- Crown and Ashen workers: all state grids; enlarged walking/building/farming contacts and rear layering; both ward-block overlays. Corrected profile hand supplements preserve measured wrist-to-grip distances.
- Guard, Spearwarden, Militia, Shieldbearer, Raider, Thorn Spear, Hearth Levy and Hidewall: all four-view state grids including anticipation/contact/recovery, hit, applicable stun and settled death. Shared bare-hand supplements preserve each character's own body and arm artwork; provenance records identify the reused anatomy.
- Ashen Outrider: all four-view mounted state grids; enlarged attack grip and player-size movement. Separate four rider/four horse views and measured hoof contacts preserve its dark horse/fur-cloaked identity.
- Crown Scout: all four-view mounted state grids, enlarged attack at 50%, corrected fingerless glove surfaces and closed cream-cloth shoulder underlays. Measured hoof contact, player-size mounted proportions and rear layering reviewed.

The isolated `dev/roster-world.html` scene uses the production simulation and renderer. All 12 identities loaded and moved left and right under actual commands. Both workers entered chopping, construction, repair and field-work states. All ten military types entered their actual attack phases and dealt damage (2,352 aggregate damage observed). Ward impact produced exactly two worker wards and two `ward_block` states. Saving/restoring retained all 12 identities, and no browser warnings/errors were reported.

The ordinary starting game was also inspected at 55% zoom for worker/Guard visibility, movement and stopping. The field scene is an isolated character review; its timings are not a representative full-map benchmark.

## Automated evidence

- Full roster motion: **12/12 rigs, 544 supported directional cases, 44,064 sampled poses and 88,128 painted grip checks passed**. The required game contract is 131 states/524 directional cases; five optional Crown stunned review poses explain the larger supported count.
- Ten military/mounted motion families pass fine elbow continuity and per-unit attack-clock tests. The physical gait suite includes 7,111 grounded hoof samples.
- Both mounted renderers: 15,552 sampled hoof transforms across six states/four views, measured fetlock/sole attachment, heel/toe floor contact and rear painter order passed.
- Worker contact regression: all ten tests pass for hammer/axe/pick/hoe direction, finite two-hand attachment, recovery continuity and rear occlusion.
- Original Crown gait/painted grip/depth regression passes with the corrected profile-hand/torso supplements.
- Crown gameplay and expanded roster gameplay pass against `/private/tmp/hearthkin-baseline/src/simulation.js`, the pre-rebuild baseline. The comparison covers resources/delivery/build/repair/fields, all ten military types' movement/attack timing/damage/death/saves, all five Ashen stuns, both worker wards and instant player demolition. Cosmetic fields are excluded; game rules and identity keys are preserved.

Observed local character-only drawing performance with all 12 identities: **96 characters, 240 samples, 5.1 ms median / 6.5 ms 95th percentile**. This excludes world rendering and simulation and is machine-specific. Equipment/shield caches have bounded memory and preserve exact live palm translation; enlarged review still uses vector detail.

## Loading

Production creates character artwork on demand. The opening match requests its four current types first; queued training warms the exact later type. Unused legacy combat sheets are no longer requested. The original all-roster character/material/shield set was 110.79 MiB; the opening set is 40.78 MiB, excluding world/building art. Four loading regressions verify active-type readiness, exact own-character rendering, queued preloading and restored roster requirements. Studio defaults remain eager so every character can be inspected.

## Publication

`npm run build`, changed JavaScript syntax checks and staged diff checks passed. All 174 changed source files matched their production mirrors by SHA-256. The authorized release was pushed normally to `codex/crownforge-live-sync-20260821`, advancing `3188be9` to `1e0f40c`.

The public page served `20260904-rosterkin1`; the live `src/character-rigs.js` SHA-256 exactly matched the tested source (`65717b922d5aaaf1ad53124f4e880ded4d07e5e48ef5e9e09b27991da0f178ec`). The live studio listed all 12 characters, loaded their art, and displayed corrected Crown walking/building and Ashen mounted attack in all four views. The live field scene reported all 12 ready, all 12 walking left, actual military attack phases and 2,976 aggregate damage, exactly two ward blocks, both workers farming, and successful restoration of all 12 saved identities. No warnings/errors were reported. The ordinary live game reached its playable opening with the new worker and Guard artwork.

A final studio-only polish reserves enough vertical space for mounted player-size comparisons and suppresses incomplete pieces while artwork loads; it was visually checked locally before publication. The character and gameplay implementation is unchanged by that polish.

## Reusable lessons

The user's requested memory note records actor-space anatomy, measured painted anchors, correct hand surfaces, closed garment underlays, solid tools, intact physical transitions, horse/rider proportions, measured hoof-floor contact and alpha verification. It distinguishes verified local techniques from production completion. Original image-generation prompts, failed extraction attempts, accepted source hashes, measurements and provenance remain beside the assets.
