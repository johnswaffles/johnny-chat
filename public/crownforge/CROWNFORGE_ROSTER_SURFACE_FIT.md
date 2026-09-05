# Full-roster arm and hand fitting — September 5, 2026

Release: `20260905-rosterfit1`. Published and verified as commit `6d82867` on the Crownforge release branch.

The player approved Crownwarden Hearthkin's wristfit3 result and requested the necessary fixes on every other current character. This pass preserves that approved Crown art/fit path and calibrates the other eleven identities individually. No original PNG, horse artwork, gameplay rule, contact timing, or saved unit key is replaced.

## Character review

| Character | Applied fitting and visible review |
|---|---|
| Crownwarden Hearthkin | Approved wrist, sleeve, braid and profile fit retained; dedicated Crown regressions remain. |
| Ashen Hearthkin | Own wrist creases and larger hands/forearms, rolled cuff joins, profile armhole/cap centers, and the approved gentle worker walking elbow bend. Four-view walking and farming close-ups reviewed. |
| Crown Guard | Individual hands/bracer widths and seated profile shoulders; curved blue-cuff source masks remove duplicated skin wedges while preserving embroidered hems. Four-view close-up reviewed after the extra cuff correction. |
| Crown Militia | Individual wrist creases, hand reach, bracer breadth and sewn profile sockets; rolled linen covers the elbow insertion. Four-view walking close-up reviewed. |
| Crown Spearwarden | Removed duplicate wristband placement, larger hands and measured sockets; the lower quilted sleeve covers the hollow upper-sleeve opening. Four-view close-up reviewed after the stacking correction. |
| Crown Shieldbearer | Wider hands fitted to its own leather bracers, measured side sockets and cap centers. Four-view walking close-up reviewed. |
| Ashen Raider | Own front/back creases and bracer widths, distinct profile fit and palm reach; fur/bracer elbow overlap retained. Four-view walking close-up reviewed. |
| Ashen Thorn Spear | Existing distinct hand atlas roots respected; creases, bracer widths and profile sockets corrected without borrowing Raider proportions. Four-view walking close-up reviewed. |
| Ashen Hearth Levy | Own profile-hand atlas, larger hands and individually fitted wrists; linen/bracer elbow overlap retained. Four-view walking close-up reviewed. |
| Ashen Hidewall | Broader identity-specific wrist and hand fit, larger palm reach and measured sockets; fur/bracer layering retained. Four-view walking close-up reviewed. |
| Crown Scout | Own gauntlet exits, linen cap centers and active supplemental torso sockets fitted. Mounted full view and enlarged arms reviewed. |
| Ashen Outrider | Own bare hand creases meet the leather bracers, with independently measured cap/socket fit. Mounted full view and enlarged arms reviewed. |

## Rendering changes

- Calibration clones every identity's metadata before applying its measurements, including shared profile hand atlases. Original absolute painted grip coordinates are retained.
- Forearm and hand surfaces meet at opposite anatomical wrist planes with a small overlap. Preserved source pixels cover diagonal wrists; a horizontal crop no longer cuts a triangular gap or leaves a duplicated skin/bracer stump.
- An affine hand surface preserves transverse wrist breadth while foreshortening the longitudinal axis. The former angle/scale solver could shrink a hand's painted wrist by more than 90% when an arm pointed toward the camera. Both original source anchors now map exactly to the wrist and palm without that width collapse.
- Profile shoulders follow each actual torso socket after transition sampling. Arms retain 17-unit upper arms and 16-unit forearms, and ordinary work/combat/rein targets stay fixed. The original elbow plane is retained rather than imposing a common stance.
- During a mounted death only, an unreachable hand target moves the minimum distance inward so the shoulder remains seated. Held equipment and reins follow that palm; released reins and the dropped spear keep their existing trajectories. This fixes the briefly separated profile shoulder during collapse.
- The source and production studio joint guides use the same final fitting as the game renderer. The retired wrist preview shortcut points to the current HTTPS studio.

## Validation

The new independent roster surface suite passes 6/6 across 4,068 poses and 8,136 arm samples. The combined Crown/roster fitting suites pass 22/22. It inspects original PNG alpha, clone isolation, source-grip preservation, every action/four-view family, bone lengths, affine hand anchors and actual painted wrist breadth. Recorded renderer checks cover 352 joins plus profile shoulder attachment through transitions. The original Crown tests remain, with the earlier scope-isolation assertions updated to the user's newly authorized roster rollout.

Existing motion, work, loading, mounted and gameplay suites passed. The motion suite covers 12 rigs, 544 directional states, 44,064 poses and 88,128 grips. Gameplay/save behavior matched the prior simulation baseline. An independent mounted audit covered 11,592 fitted poses and 23,184 painted grips, with zero held-contact drift; all profile shoulders now meet their painted sockets to floating-point precision.

Browser review separates enlarged four-view anatomy checks from action-grid and production-field checks. This is a refinement of the existing character art, not a replacement animation or model pipeline.


## Published verification

The live build marker is `20260905-rosterfit1`. All 24 changed public pages and runtime modules matched the tested source byte for byte, including every per-character calibration module. The live production field reported all 12 characters ready and all 12 in walking state. The live Ashen Hearthkin studio was opened with all four views loaded and the corrected walking close-up playing.

Local production-field interactions verified both walking directions, combat damage, both workers in `field_work`, both `ward_block` reactions, and saving/restoring all 12 identities. The complete action grids were visually reviewed for the eleven updated characters; original Crown rendering remains covered by its dedicated tests and the production-field comparison. The build, 20 changed-script syntax checks, 31 source/production file pairs, and whitespace checks passed.
