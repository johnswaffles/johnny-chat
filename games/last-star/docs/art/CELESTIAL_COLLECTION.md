# Celestial collection — October 26, 2026

The user approved the celestial magic concept and requested the same visual upgrade for items lying in the world. This pass implements that art direction in the existing Level 1 game. It does not alter rewards, charges, collision, pickup attraction, combat damage, level layout, save keys or controller bindings.

## Artwork

Eleven original, individually generated transparent paintings live in `assets/celestial-v2/`: Starshard, Eventide Passage, Ember Orb, Frost Fan, Chain Spark, Healing Flask, a closed chest, an empty open chest, a power crystal, a violet score gem and a gold star coin. The open chest was generated as an edit of the closed chest to preserve its identity. All creative image work used the built-in image generator. No Castlevania artwork is included.

The approved concept establishes the common midnight blue, aged gold/silver, star-core and painterly material language. Large silhouettes distinguish each spell family. The Starshard UI portrait is a crystallized emblem; the existing compact energy-wave projectile remains unchanged.

Full prompts are in `CELESTIAL_V2_MAGIC_PROMPTS.json` and `CELESTIAL_V2_PROPS_PROMPTS.json`. The 11 original PNG masters are archived in the checkout's `output/last-star-celestial-20261026/source-art/`. Runtime WebP delivery files retain alpha and aspect ratio, with a maximum edge of 512 pixels and quality 90. Their combined payload is 935,732 bytes. `assets/celestial-v2/manifest.json` records dimensions, SHA-256 hashes, source hashes and source-pixel bounds. `src/celestial-art.js` carries the same bounds into the renderer; each includes four pixels of safety padding beyond alpha >12. There is no per-frame pixel readback.

Prior approved files, including `assets/level1-items/` and the earlier spell atlas, remain intact. New UI and world art references are independently mapped even where they share a painting.

## Presentation

- Desktop hotbar: 72×80 buttons with 56px art; equipped item 88px wide. Compact screens use 66×74 buttons with 50px art and an 80px equipped button. The bar stays bottom-left.
- Directional wheel: 54px art on desktop, 48px on compact screens, with separate names and charge badges. Clockwise Ember/Frost/Chain/Flask, release-to-equip, and slow-world behavior are unchanged. Selection has a border and readable name as well as element color. The option group has a listbox label and each item announces its name and charge count. On the left, the wheel clears the hotbar by at least 21 pixels at the verified viewport sizes; brief subtitles are hidden while selecting.
- World pickups: explicit per-kind display bounds, preserved proportions, restrained local lighting, grounded contact marks and slow bob/glints. Bounds use the actual supporting surface and keep the silhouette above it. The selection wheel's size never dictates world size.
- Chests: physically grounded, closed and open paintings. The empty open chest remains opaque and loses sparkle/glow.
- Enemy reward crystals: smaller painted power crystals with the existing collection motion. No extra trail state or particle accumulation.
- Gentle disables new bob/pulse/glints; Light and reduced-flash suppress glints. Animation follows the renderer clock and freezes on pause. Existing collision and placement data are unchanged.

## Review and release

Local release marker: `20261026-celestial-treasures`. Development starts from repository commit `86644e67857cb7987799ad201f0bf992dd74176b`, whose published Last Star marker was `20261001-stick-wheel`.

Local review page: `tests/celestial-review.html`. Play the normal game through the local server on port 4198; `?qa` enables existing deliberate fixtures and the input-only route driver. QA fixtures are presentation/behavior checks, not evidence that a human completed the game.

The runtime source and published mirror must be synchronized and verified before release. Local completion does not establish public deployment. See `CELESTIAL_QA_20261026.md` for final verification results.
