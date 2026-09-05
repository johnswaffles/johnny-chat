# Crown Spearwarden modular artwork

Four independently authored views preserve the Spearwarden's iron cap, brown hair and beard, pale quilted tunic, brown leather vest, blue shoulder sash, fitted brown trousers and dark leather boots. The spear and shield remain separate runtime equipment. Both profile heads, chests and boots face their named direction. The chest panels contain continuous leather and cloth beneath the moving upper arms, with no bare shoulder patch or hollow socket.

Created with the built-in image-generation tool. `prompts.json` records exact view prompts, targeted corrections and transparent extraction. `provenance.json` records original output paths, byte hashes, image dimensions, transparency and anatomical source ordering. The four PNGs are unchanged copies of the selected generated originals; scripts only measured alpha and wrote metadata.

- `rig-front.png`: 1278 by 1230, RGBA.
- `rig-right.png`: 1536 by 1024, RGBA.
- `rig-back.png`: 1536 by 1024, RGBA.
- `rig-left.png`: 1512 by 1040, RGBA.

The sixteen parts are head, torso, hip tunic, spare blue sash end, anatomical left/right upper arms, forearms, gripping hands, thighs, shins and boots. The sash knot is already present on the tunic, so the default configuration uses `appendage: 'none'`; the spare cloth piece is retained as source artwork without inventing a cape. Front source hand rectangles are reordered into anatomical left/right without reflecting the artwork.

`src/roster-art/crown-spearwarden.js` exports `CROWN_SPEARWARDEN_ART`, `CROWN_SPEARWARDEN_ARM_PARTS` and `CROWN_SPEARWARDEN_HAND_PARTS`, plus the shared default roster configuration. Source rectangles are connected alpha bounds at threshold 24 with two pixels of padding. The metadata supplies head/neck, chest/waist, hip/hem, limb and ankle anchors. Limb joint centers use alpha-weighted rows at eight and ninety-two percent of their source height. Hand wrist roots sit below their painted cuffs; five enclosed transparent grip holes provide measured handle centers, and the three closed hands use the visible curled grip center at seventy percent of source height. Runtime assembly must map both the source wrist and grip to their physical projected attachment points.

Visual correction passes addressed the rear thigh pieces, the left-facing right boot, profile hand surfaces and closed torso panels. All four PNGs have true transparency, sixteen separate alpha components and sixty-four valid source bounds. Shared-renderer integration and action review remain the integration owner's responsibility.

## Forward-thumb profile hand audit

The final source audit found backward thumb edges despite the earlier palm/knuckle correction. The module explicitly imports the crown-militia male hand atlas for both profiles. Existing hand width/height are retained, with source wrist and grip coordinates from the corrected atlas. All unique body sheets, armor, limb axes, front/back hands, and appendage are unchanged. `profile-hand-provenance.json` records accepted and corrected views and the original generation prompt record.
