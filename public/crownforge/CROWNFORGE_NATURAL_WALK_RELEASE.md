# Hearthkin natural-gait correction

Release: `20260904-naturalwalk1` · September 4, 2026

This revision addresses the outward elbows, marching steps, broken back silhouette and floating axe reported in the first Living Motion release.

## What changed

- Idle, walking and carrying now solve joints in anatomical three-dimensional coordinates before projecting them into each authored view. Front/back arms can shorten in projection without bending sideways.
- Elbows swing forward and back close to the torso. The opposite arm leads at foot contact, with a quieter arc for the hand holding the axe. Shoulder width matches the existing torso cutout.
- Shorter strides and a low asymmetric swing arc replace the high symmetrical foot lift. Stance and swing join with continuous position/velocity; heel/toe rotation also joins without a snap. The nominal walk cycle is 1.05 seconds, with restrained hip, shoulder, braid and cloth motion.
- Stopped or blocked Crown workers stop stepping; their cadence eases with actual movement. Movement speed and all gameplay rules are unchanged.
- Tools attach to an explicit palm socket beyond the wrist. Calibrated shaft pivots and direction-specific arm/tool/hand drawing keep fingers over the handle. Back arms sit behind the torso and both front arms draw in front.

The character still uses the existing original four-view raster surfaces. This is a corrected projected skeleton, not motion capture or a replacement 3D engine. The educational sources informed the implementation; no third-party animation or artwork was copied.

## Research used

- [Animation Mentor: animating a basic human walk](https://www.animationmentor.com/blog/tutorial-animating-human-walk-cycle/): contact, weight transfer, passing, counter-rotation, arm overlap and foot translation.
- [Adobe: walk-cycle construction](https://www.adobe.com/uk/creativecloud/animation/discover/animation-walk-cycle.html): pose progression, weight, coordinated torso and limb movement.
- [Blender: inverse kinematics](https://docs.blender.org/manual/id/5.1/animation/constraints/tracking/ik_solver.html): explicit joint plane and stretch control.
- [Epic: skeletal sockets](https://dev.epicgames.com/documentation/en-us/unreal-engine/skeletal-mesh-sockets-in-unreal-engine): calibrated attachment transforms relative to a bone.
- [BioMotion Lab walker](https://www.biomotionlab.ca/Demos/bmlwalker/): reference for examining biological motion from multiple views; the published motion data were not imported.

## Validation

`tools/hearthkin-rig-regression.mjs` checks all 23 states and four directions, anatomical limb lengths, projection limits, elbow alignment, ground contact, low foot clearance, opposing arm timing, loop position/velocity/rotation seams, stationary cadence, and the actual rendered palm/shaft/finger order. It retains work-contact and status-priority checks.

`tools/hearthkin-gameplay-regression.mjs` verifies harvesting, delivery, construction, repair, farming, combat, ward and old saves, with gameplay parity to the saved baseline. The other 11-unit roster regression also passes. Browser review covers the real studio, carrying and work poses, normal gameplay movement and stopping, and browser errors.

Review in `dev/hearthkin-studio.html?action=walk&release=20260904-naturalwalk1`. Source and production are mirrored in `games/crownforge/` and `public/crownforge/`.
