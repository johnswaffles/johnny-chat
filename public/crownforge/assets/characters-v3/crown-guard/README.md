# Crown Guard modular artwork

Four independently authored views preserve the Crown Guard's bronze crested helmet, cobalt plume, bronze armor, dark blue under-tunic and royal-blue cloak. The spear and sun shield are deliberately separate runtime equipment. The torso contains neither baked arms nor a cloak. Profile version two replaces the original hollow shoulder openings with continuous bronze scales, so moving an arm does not expose an empty socket.

Created using the built-in image-generation tool. `prompts.json` records the exact front, directional, correction and transparent-extraction prompts. `provenance.json` records the selected generated originals, hashes, dimensions, alpha ranges and source ordering. Each production PNG is copied unchanged from its selected tool output. No pixels were cropped, mirrored, recolored or removed by a script.

- `rig-front.png`: 1536 by 1024, RGBA.
- `rig-right-v2.png`: 1312 by 1199, RGBA; selected profile source.
- `rig-back.png`: 1333 by 1180, RGBA.
- `rig-left-v2.png`: 1536 by 1024, RGBA; selected profile source.

The original `rig-right.png` and `rig-left.png` are retained unchanged. The version-two profiles also show the far hand's palm-side curled fingers and the near hand's knuckle surface, with tightly closed empty grips. Their new source bounds and attachment points were measured after transparent extraction. Front and back metadata are preserved from the first approved version.

The sixteen source slots are head, torso, hip skirt, cloak, left/right upper arms, left/right forearms, left/right gripping hands, left/right thighs, left/right shins and left/right boots. A targeted generation corrected the left-facing right boot; another replaced the rear skirt's erroneous front buckle and decorative plate with back fastenings. Source bounds for the front hands are reordered into anatomical left/right without reflecting skin artwork.

`src/roster-art/crown-guard.js` exports `CROWN_GUARD_ART`, `CROWN_GUARD_ARM_PARTS` and `CROWN_GUARD_HAND_PARTS`, plus the shared default roster configuration. It includes measured neck/waist, skirt, cloak and ankle anchors in addition to limb roots/tips. Every source rectangle is measured from connected alpha at a threshold of 24, padded by two pixels. Limb joint centers use alpha-weighted rows near eight and ninety-two percent of source height.

Six selected curled hands have enclosed transparent grip openings whose centroids supply the grip anchors. The two newly closed profile palm grips use their visible grip center at seventy percent of source height. The runtime must map both the source wrist and source grip onto their projected physical attachment points. The cloak uses `appendage: 'cloak'`; it needs a full cloth surface rather than braid-sized rendering.

Visual inspection covered direction, individual thigh pieces, neutral grips, rear fastening surfaces and absence of baked weapons. All four PNG alpha channels, sixty-four source bounds and byte-preserving copies were checked. Player-size assembly and every animation state still require the shared renderer's integration review.

## Forward-thumb profile hand audit

The final source audit found backward thumb edges despite the earlier palm/knuckle correction. The module explicitly imports the crown-militia male hand atlas for both profiles. Existing hand width/height are retained, with source wrist and grip coordinates from the corrected atlas. All unique body sheets, armor, limb axes, front/back hands, and appendage are unchanged. `profile-hand-provenance.json` records accepted and corrected views and the original generation prompt record.
