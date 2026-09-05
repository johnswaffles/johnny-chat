# Ashen Hearthkin modular artwork

Four independently authored views preserve the existing Ashen worker's dark braid, charcoal linen, rust sash, patched apron and practical leather boots. The front apron is absent on the rear garment. Body sheets contain no tools or cargo.

Created with the built-in image-generation tool. Exact generation, correction and alpha-extraction prompts are in `prompts.json`. Each final PNG is copied unchanged from the selected tool output; no background removal, recoloring, mirroring or cropping was performed in image-processing scripts.

- `rig-front.png`: 1440 by 1092, RGBA.
- `rig-right-v2.png`: 1324 by 1188, RGBA.
- `rig-back.png`: 1316 by 1195, RGBA.
- `rig-left-v2.png`: 1312 by 1199, RGBA.

The corresponding `src/roster-art/ashen-hearthkin.js` exports the four-view bounds, arm source roots/tips, and hand wrist/grip anchors. All sixteen bounds in each view were measured from the alpha channel. Front hand bounds are reordered into anatomical left/right order rather than reflecting skin artwork. The leather bracer remains on the anatomical left forearm in all views. Joint x coordinates use alpha-weighted source centers near the attachment ends, so the renderer must use these anchors rather than assuming vertical rectangle centers. Front grip positions use the measured enclosed thumb/finger-hole centroids. Other hands have no enclosed hole and use a center estimate at 64 percent of source height; check the actual handle during integration.

The version2 profile sheets replace incorrectly baked bare-shoulder circles in the detached torsos with continuous matching charcoal cloth. The first profile sheets remain as originals; active filenames are recorded in `prompts.json`. Exact repair and extraction prompts are in `profile-correction-prompts.json`. All profile bounds and joint anchors were remeasured after the edits.

Visual inspection covered all four full sheets, view direction, distinct single-thigh components, garment surfaces, neutral hands, and absence of baked props. Alpha and byte-preserving copies were verified. Runtime motion, tool orientation and player-size inspection belong to the shared character renderer integration.

## Profile hand anatomy correction

The supplementary `profile-hands-v1.png` provides separately authored right-facing far-left palm, right-facing near-right dorsal hand, left-facing near-left dorsal hand, and left-facing far-right palm. Both hands have forward-facing thumb edges for their view. The original body sheets, torso bounds, and limb source anchors are unchanged. This is a built-in image_gen asset with exact prompts and alpha-measured bounds saved beside it. Real closed thumb-index alpha holes calibrate dorsal sockets where present; open palm cup centers are visually calibrated. Tiny fingertip gaps are not grip evidence.
