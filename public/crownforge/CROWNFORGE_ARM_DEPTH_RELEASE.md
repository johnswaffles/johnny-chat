# Hearthkin arm orientation and axe depth

Release: `20260904-armdepth1` · September 4, 2026

This revision addresses the inside-out appearance of the front/back arms and the left-facing axe crossing the near leg. It preserves the natural-walk timing, anatomical joint motion and the existing right-profile character surfaces.

## Changes

- Replaced the front/back upper arms and forearms with original, separate surfaces. Measured shoulder, elbow and wrist anchors inside the artwork replace the assumption that each painted limb is vertically centered in its rectangle.
- Added four neutral, curled hand surfaces with measured wrist and palm attachments. The left bracer stays on the anatomical left arm. Right/left profile hands retain their previous dimensions and grip offsets.
- Draw the far profile arm and its equipment between the far and near legs. For a left-facing worker, the right-hand axe is therefore covered by the near leg where they overlap.
- Reverse only the axe's transverse axis around its calibrated grip for back/left views. The blade changes side while the handle's angle and palm attachment remain stable. Character artwork is never mirrored to manufacture a direction.
- Added an **Arm detail** studio control for enlarged front/back joint and hand review. The normal view still includes actual player-size previews.

## Original assets and prompts

Created with the built-in `image_gen` tool, then extracted to alpha with the same tool. The selected RGBA files are copied unchanged; source rectangles and cached mipmaps control their display. No third-party artwork was imported.

- `assets/hearthkin-v2/arm-surfaces.png`: 1536 × 1024 RGBA; first eight components supply four sleeves and four forearms. Its third row of hands is unused.
- `assets/hearthkin-v2/neutral-hands.png`: 1774 × 887 RGBA; four neutral wrist/hand surfaces.
- `assets/hearthkin-v2/arm-correction-prompts.json`: exact generation/extraction prompts and selected output names.

The original profile, body, face, clothing and prop atlases remain intact. Source files are mirrored from `games/crownforge/` to `public/crownforge/` for delivery.

## Validation

The focused rig regression covers 23 states and four views, limb lengths, ground contact, opposing arm motion, cycle continuity, source-to-joint attachment, palm-to-handle attachment, finger layering, axe blade/shaft orientation and near-leg depth. It verifies that arms/hands remain unmirrored, the pick/hoe/hammer do not receive the axe correction, and profile hand attachments remain unchanged. The dropped axe has separate orientation/pivot coverage.

Gameplay parity checks pass for all resource harvesting/delivery, construction, repair, farming, combat, ward, death and existing saves. Browser review includes front/back arms at opposite contact poses, profile axe placement at passing poses, normal-speed walking and work/carry/defense poses. This is still a 2D articulated character, with the capabilities and limits of its existing rig.

Review: `dev/hearthkin-studio.html?action=walk&release=20260904-armdepth1`. Use **Arm detail**, pause, slow motion and the cycle slider to inspect any pose.
