# Crown Shieldbearer modular artwork

Four independently authored views preserve the unhelmeted, broad, chestnut-haired and bearded Shieldbearer in dark petrol-teal quilted cloth, cream sleeves, leather bracers and boots. The right-hand axe and large left-hand round shield are separate runtime props.

Each body atlas has sixteen individual components. The unused part3 is a small utility pouch; the default descriptor specifies `appendage: 'none'`. Torso shoulder surfaces have continuous underlying quilted cloth so a swinging arm does not reveal a baked bare-skin circle, hollow socket or fixed sleeve.

The built-in image-generation tool created all artwork. `prompts.json` contains exact prompts and targeted corrections. `provenance.json` records original paths, dimensions, alpha ranges and SHA256 hashes. Final PNGs are unchanged copies of the selected generated outputs:

- `rig-front.png`: 1374 by 1145.
- `rig-right.png`: 1295 by 1215.
- `rig-back.png`: 1278 by 1230.
- `rig-left.png`: 1536 by 1024.

All files are RGBA with true transparency. Brown RGB behind the left sheet's transparent pixels is invisible and must remain under its original alpha.

`src/roster-art/crown-shieldbearer.js` exports four-view source bounds, source-joint axes, wrist/grip anchors, and a default descriptor. Front hand source bounds are put in anatomical order without image reflection. Right profile uses the far left hand's palm/curl surface and near right hand's knuckles; left profile reverses that arrangement. Closed hands use the measured empty thumb/index grip center. The far profile palms have open cups without an enclosed alpha hole, so their grip anchors use the visible cup center; a four-pixel gap between fingertips was rejected as an unsuitable socket.

Review corrected whole forearms mistakenly included in upper-arm cells, feet mistakenly included in shin cells, baked torso sleeves/holes, and an incorrectly facing far boot in the left view. All source sheets now have isolated upper arms, isolated shins and the requested views. All64 source rectangles fit their image bounds, syntax checks pass, and alpha/copy checks pass. Runtime motion, shield depth and axe contact require integration review.

## Shared profile hand anatomy

Close source inspection found incorrect backward thumb edges in the original profile hands. The module now explicitly imports the crown-militia male profile hand atlas. It preserves the original hand width/height while using the corrected palm/knuckle views, forward thumb edges, and source wrist/grip coordinates. Unique body sheets, clothing, arm axes, and appendage stay unchanged. See `profile-hand-provenance.json` for the source and original prompt record.
