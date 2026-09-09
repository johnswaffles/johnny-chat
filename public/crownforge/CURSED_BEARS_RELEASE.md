# Three condemned bloodlines

Release: `20260909-cursedbears1`

Black Oath, Cindermaw, and Ashen Grudge now cycle through natural woodland spawns and the simultaneous bear-release button. Each has an independently authored four-direction set of idle, walk, grounded swipe, rearing strike, and collapse paintings (240 paintings total), its own illustrated lore card, and bloodline-specific Last Light trickery. Identity and existing wounds survive save/load.

Thick Hide displays +100% armor and halves incoming damage after existing mitigation. Full-health arrow survival rises from 30 to 60 landed arrows. True health stays at 180; the false 1 HP curse never heals the bear. Fury still activates at 10% true health or the curse's apparent 1 HP, deals +500% damage with a lethal minimum against fighters, and cleaves two extra fighters within 10 world units. Worker wards, retaliation, moving attacks, encounter timing, and corpse hold remain intact.

Artwork is in `assets/cursed-bears/`; complete prompts and exact file hashes are in `art-notes/cursed-bears/`. Generated with built-in ImageGen. Local checkerboard cleanup was explicitly authorized by the user. Original cleanup inputs remain in the isolated concept workspace. Runtime measurements preserve intact paintings and clip neighboring atlas poses once at load time. New rear views are normalized against their own idle body height.

Review: `dev/grizzly-studio.html` selects all three bears and five actions in four views. `dev/bear-fury-arena.html` uses the production game and inspector for lore, curse, cleave, arrows, chase, and death checks.

Validation: all 41 targeted regression checks pass. Production renderer shows all four views without checkerboard backgrounds. Full-game review verifies the three distinct illustrated cards, false 1 HP with true 180 HP, Thick Hide, and a fury swipe killing three of four nearby fighters. No browser warnings/errors in that review. Repository build completed successfully.
