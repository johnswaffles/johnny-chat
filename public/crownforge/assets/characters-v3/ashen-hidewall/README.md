# Ashen Hidewall modular artwork

Four independently authored views preserve the massive Hidewall's square weathered face, dark beard and high topknot, bone necklace, two-tone fur yoke, leather cuirass, rust-red sash, hide panels and fur-cuffed boots. The tan fur remains on the anatomical right shoulder and dark fur on the left; their visible placement changes correctly with facing.

The mace belongs to the right hand and the tall oval shield to the left. Neither is baked into these body sheets. Part3 is a separate broad fur back cape; the default descriptor selects `appendage: 'cloak'`.

Created using the built-in image-generation tool. Exact generation and extraction prompts, reference roles and selected original output paths are in `prompts.json`. Final PNGs preserve the tool output unchanged:

- `rig-front.png`: 1269 by 1240, RGBA.
- `rig-right.png`: 1275 by 1233, RGBA.
- `rig-back.png`: 1234 by 1275, RGBA.
- `rig-left.png`: 1295 by 1214, RGBA.

`src/roster-art/ashen-hidewall.js` exports four-view cutout bounds, all arm source-joint anchors, wrist/grip anchors and a default character descriptor. Each view contains sixteen individually measured components. Front hands are reordered into anatomical left/right order through source rectangles without reflecting artwork. Every hand's source grip is the centroid of the enclosed transparent thumb/index opening, so the handle passes through the grip rather than beside the fist.

Visual review covered all four source sheets, face/torso/foot direction, asymmetric fur continuity, neutral joints, individual thighs, prop-free body parts, and no baked bare-skin shoulder circles in the detached torsos. Alpha, source bounds, and unchanged original copies were verified. Runtime motion, shield depth, mace contact and player-size review remain part of renderer integration.

## Shared profile hand anatomy

Close source inspection found incorrect backward thumb edges in the original profile hands. The module now explicitly imports the ashen-raider male profile hand atlas. It preserves the original hand width/height while using the corrected palm/knuckle views, forward thumb edges, and source wrist/grip coordinates. Unique body sheets, clothing, arm axes, and appendage stay unchanged. See `profile-hand-provenance.json` for the source and original prompt record.
