# Hearth Levy original modular art

Four independently authored views preserve the citizen defender's stitched brown leather cap, bearded open face, tawny fur collar, rough brown vest, cream sleeves, and red sash. The right-hand axe and left-hand wooden shield are separate runtime props. The head has a short bare neck; its fur collar appears only on the torso.

Each body sheet contains 16 isolated components in the shared contract. Upper arms, forearms, thighs, shins, and boots are separate. The profile torso has continuous cream cloth at the shoulder, no exposed skin or hollow black socket. Part 3 is an unused utility pouch (`appendage: none`). Source alpha measures each limb's actual joint axis instead of assuming rectangle centers.

A dedicated `profile-hands-v1.png` adds four independent hand surfaces: right-facing far-left palm and near-right knuckles, then left-facing near-left knuckles and far-right palm. Thumb edges face forward in each profile. These replace the draft profile hands without changing the body sheets. Wrist roots are alpha-measured and grip centers are calibrated from genuine openings or visible palm cups. Front body hand rectangles are assigned in anatomical order without reflecting pixels.

Built-in image_gen generated and edited all artwork. Selected PNGs are copied unchanged into this folder. Exact body and hand prompts, original output paths, and SHA-256 provenance are recorded in the JSON files. No PNG pixels were altered by external scripts. Targeted refinements corrected the right-view trouser thighs and the far left-view boot direction.

Validation: four RGBA body sheets with 16 parts each; supplementary RGBA hand sheet with four parts; all 68 source rectangles in bounds. Rendering, animation, and gameplay QA are handled by the shared rig integration.
