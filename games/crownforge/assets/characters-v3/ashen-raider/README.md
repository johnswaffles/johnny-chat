# Ashen Raider modular artwork

Four independently authored views preserve the current Raider's broad masculine build, dark beard and tied hair, charcoal fur mantle, crossed leather harness, rust-red sash and fur-trimmed boots. Body sheets contain no axe, shield or cargo; the right-hand weapon is attached by the shared renderer.

Created using the built-in image-generation tool. The exact front, direction-variant and transparent-extraction prompts and original output paths are recorded in `prompts.json`. All final PNGs were copied unchanged from tool outputs.

- `rig-front.png`: 1351 by 1164, RGBA.
- `rig-right.png`: 1312 by 1199, RGBA.
- `rig-back.png`: 1200 by 1310, RGBA.
- `rig-left.png`: 1536 by 1024, RGBA.

`src/roster-art/ashen-raider.js` exports four-view bounds, arm source joint attachments, hand wrist/grip anchors, and a default character descriptor. Every view has sixteen separately measured components. Front hand bounds are reordered into anatomical left/right order without reflecting the artwork. The axes of sleeves and bracers are measured from source-alpha centers near their proximal and distal joints. All eight hands have enclosed transparent thumb/finger openings; their measured centroids define the grip socket rather than a generic hand center.

Visual inspection covered all four sheets, direction-specific face/torso/boot surfaces, individual thighs, closed hands, and absence of baked weapons. Final PNGs preserve genuine alpha, including the left sheet whose transparent pixels contain brown RGB data. Original alpha must be retained; do not interpret that hidden RGB as an opaque background.

Runtime motion, depth ordering, blade direction and player-size review remain part of renderer integration.

## Profile hand anatomy correction

The supplementary `profile-hands-v1.png` provides separately authored right-facing far-left palm, right-facing near-right dorsal hand, left-facing near-left dorsal hand, and left-facing far-right palm. Both hands have forward-facing thumb edges for their view. The original body sheets, torso bounds, and limb source anchors are unchanged. This is a built-in image_gen asset with exact prompts and alpha-measured bounds saved beside it. Real closed thumb-index alpha holes calibrate dorsal sockets where present; open palm cup centers are visually calibrated. Tiny fingertip gaps are not grip evidence.
