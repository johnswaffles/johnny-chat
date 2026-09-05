# Complete roster motion release

Release candidate: `20260904-rosterkin1`. Reviewed September 5, 2026. Publication and live verification pending.

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

Pending final artwork readiness, syntax/build/mirror checks, normal push to the existing Render release branch, and live browser verification. A successful push alone does not establish deployment.

## Reusable lessons

The user's requested memory note records actor-space anatomy, measured painted anchors, correct hand surfaces, closed garment underlays, solid tools, intact physical transitions, horse/rider proportions, measured hoof-floor contact and alpha verification. It distinguishes verified local techniques from production completion. Original image-generation prompts, failed extraction attempts, accepted source hashes, measurements and provenance remain beside the assets.
