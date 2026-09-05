# Thorn Spear modular artwork

Four independently authored views preserve the Thorn Spear's black topknot and tied hair, brown leather and hide armor, bone shoulder guards, tooth necklace, red ties, fitted trousers, fur-edged wraps and dark boots. The spear and round back shield are separate runtime equipment. The tooth necklace belongs only to the torso; the head ends at a short bare neck. Closed leather torso panels prevent an empty shoulder cavity or painted stationary arm from appearing during motion.

Created with the built-in image-generation tool. `prompts.json` records exact view prompts, targeted corrections and transparent extraction. `provenance.json` records selected original outputs, byte hashes, dimensions, alpha ranges, part order and grip measurements. All production PNGs are unchanged copies of generated originals. Scripts only measured alpha and wrote metadata.

- `rig-front.png`: 1536 by 1024, RGBA.
- `rig-right.png`: 1295 by 1214, RGBA.
- `rig-back.png`: 1536 by 1024, RGBA.
- `rig-left.png`: 1236 by 1273, RGBA.

The sixteen parts are head, torso, hide hip skirt, tied ponytail, anatomical left/right upper arms, forearms, empty gripping hands, thighs, shins and boots. Source front hand rectangles are reordered into anatomical left/right without reflection. Both profile heads and boots face the named direction. Rear thighs show fastening straps instead of front kneecap discs. The separate ponytail uses `appendage: 'braid'`; it is independently detached from the head and torso. A targeted correction shortened its rear source cutout to maintain clear separation from the forearm below it.

`src/roster-art/thorn-spear.js` exports `THORN_SPEAR_ART`, `THORN_SPEAR_ARM_PARTS` and `THORN_SPEAR_HAND_PARTS`, plus the shared default roster configuration. Source rectangles use connected alpha at threshold 24, padded by two pixels. Head/neck, torso/waist, hip/hem, hair attachment, limb joints and ankle anchors are included. Limb roots and tips use alpha-weighted rows at eight and ninety-two percent of source height. Wrist anchors sit below painted cuffs. The two front grip centers use actual enclosed transparent holes; closed profile and rear hands use the visible curled grip center at seventy percent of source height. The renderer must map both source wrist and source grip onto their physical projected attachment points.

Visual corrections removed gray grip stubs, duplicate neck ornaments, hollow torso sockets, a baked rear shoulder, front-facing rear knee guards and a touching hair/forearm pair. All four sheets contain true alpha and sixteen distinct parts, with sixty-four valid source rectangles. Final player-size motion and equipment visibility are checked by the shared-renderer integration owner.

## Forward-thumb profile hand audit

The final source audit found backward thumb edges despite the earlier palm/knuckle correction. The module explicitly imports the ashen-raider male hand atlas for both profiles. Existing hand width/height are retained, with source wrist and grip coordinates from the corrected atlas. All unique body sheets, armor, limb axes, front/back hands, and appendage are unchanged. `profile-hand-provenance.json` records accepted and corrected views and the original generation prompt record.
