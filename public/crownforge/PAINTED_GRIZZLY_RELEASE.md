# Painted grizzly release — 20260906-paintedbear1

Integrates the approved local studio walk, breathing, regular swipe and standing attack. Four independently painted directions use twelve byte-identical approved atlases and the studio's measured clipping/pivots. Rendering uses whole paintings, with clipped frames prepared at load time and a smaller cached level for distant views.

The 1.65-second swipe deals damage at 56% and the 2.4-second standing attack at 59%, matching the striking painting. Every third attack still rears. Distance advances the walking cycle; blocked movement does not advance it. Dead bears hold the resting painting and fade over the existing five-second cleanup interval. The new art does not include a painted death sequence.

Startup waits for all twelve atlases. Health bars, curse runes and selection height account for the tall standing attack. All gameplay curse, false-one-HP, ward immunity, hunting, patrol and soldier-response logic is retained. The existing runtime grizzly studio now previews the production painted renderer.

Approved artwork and exact generation provenance: `art-notes/painted-grizzly/`. The notes retain historical local-study descriptions; this release is their explicit integration.

Validation: 34 tests passed across painted-grizzly, grizzly-motion, wildlife-routines and unit-inspection regressions. Local full-game encounter verifies loading, walking, combat, and no browser errors. Source and public release files are mirrored byte-for-byte.
