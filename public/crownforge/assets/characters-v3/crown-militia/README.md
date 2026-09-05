# Crown Militia original modular art

Four independently authored views of the light Crown infantryman: iron bowl helmet, open bearded face, cream linen, brown leather jerkin, blue sash and heraldic skirt. The right-hand mace and left-hand shield remain separate runtime props.

Each sheet follows the shared 16-part contract. Alpha-measured bounds and limb axes live in `src/roster-art/crown-militia.js`. Front hand source rectangles are placed in anatomical order without mirroring; profile far palms and near knuckles are separately painted. Part 3 is an unused utility pouch (`appendage: none`).

Generated and corrected with built-in image_gen. Selected PNGs are copied unchanged from the original generation output. Exact prompts and original paths are in `prompts.json`; `provenance.json` records file hashes and image dimensions. Metadata inspection uses alpha measurements only and does not edit PNG pixels. The back extraction was redone to create fully separate thigh and boot cutouts.

Body/source validation: four RGBA sheets, 16 parts per view, all source rectangles in bounds, arm axes and wrist roots measured from alpha. Open far-palm grips use manually inspected cup centers; closed hands use enclosed alpha holes where available. Runtime animation and gameplay QA are handled by the shared rig integration.

## Profile hand refinement

`profile-hands-v1.png` replaces both profile hand pairs with dedicated far-palm/near-dorsal surfaces and forward-facing thumb edges. Exact prompts, alpha bounds, and source hashes are recorded beside it. The thumb-index cups are open; grip locations use visually calibrated cup centers, not an inferred enclosed hole. Body sheet hands remain as source history, while the module uses the supplementary profile atlas.
