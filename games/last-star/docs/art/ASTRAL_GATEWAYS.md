# Astral gateways and hostile magic — October 26, 2026

Three original paintings extend Last Star's existing celestial style. The checkpoint relic is a physical brass astrolabe around a faceted blue star. The void-star is an obsidian and amethyst projectile nucleus. The rift crown is a low, wide eruption of violet plasma and black glass. The paintings contain no reference-game material.

| Renderer key | Runtime file, relative to assets/ | Dimensions | Registered bounds | Bytes |
| --- | --- | --- | --- | ---: |
| sealRelic | arcana-v1/seal-relic-v1.webp | 512 × 512 | 41, 0, 433, 512 | 95,554 |
| voidStar | arcana-v1/void-star-v1.webp | 512 × 512 | 44, 30, 430, 450 | 100,594 |
| riftCrown | arcana-v1/rift-crown-v1.webp | 640 × 356 | 25, 4, 606, 328 | 82,628 |

Combined runtime payload is 278,776 bytes. `assets/arcana-v1/manifest.json` records alpha inspection, source/runtime SHA-256 hashes and exact dimensions. `src/arcana-art.js` registers the same files and bounds. Scale preserves aspect ratio. Shape bounds use decoded alpha ≥16 with three pixels of safety padding, constrained to image edges.

Built-in `image_gen` produced one original transparent PNG per asset. The generator model identifier was not exposed. Exact submitted prompts are preserved in `ARCANA_PROMPTS.json`. Unchanged PNG masters and another copy of those prompts remain in repository-root `output/last-star-arcana-20261026/source-art/`. Conversion is proportional LANCZOS downsampling and WebP quality90/effort6 with real alpha. Earlier approved assets remain intact.

## Rendering contract

- The checkpoint relic is 94 ×111 logical pixels maximum. Ready is blue, awakened adds gold illumination, and later checkpoints are dimmer. The stone arch remains opaque. The Observatory barrier retains its original footprint and shows three progress locks; the open gateway relocates its relic above the player's path. The final return marker shares the new relic.
- Wraith shots are compact 36px dark stars. Boss fan cores are 47px; a sweep uses a 34px nucleus and a low crescent. A tapered plasma trail indicates direction. These are art sizes, not new collision radii.
- Boss windups gather fragments at the real firing origin, previewing the fan, rift or sweep. Melee crescents follow the original active attack window. Idle boss orbit lines sit behind the full character painting.
- The rift warning keeps a steady ±90 footprint. Painted eruption appears only when the simulation marks the danger effect fired after0.95 seconds. Maximum painted size is178 ×98px, anchored to the original platform; it fades through the existing effect lifetime. Never show an early explosion or a new damaging pillar.
- Mantle and Overdrive use separated glass plates and emerald/gold edge glints, leaving the arcanist visible. Casts, impacts, enemy deaths and seal activation have distinct bounded aftermath. `arcanaFX` is capped at24; world lights remain capped at8 and transient pulses at12.
- Lanterns use opaque metal frames, shaded glass and small flame tongues on their existing supports. No new platforms, props over gaps, level content or gameplay behavior.
- Use renderer time for animation and simulation state for attack timing. Pause freezes both. Gentle simplifies orbit detail, reduced flashes lowers peak light, and Light reduces trailing fragments. Asset failures fall back to drawn cores/markers; they do not prevent the game from loading.

Review page: `tests/arcana-review.html`. It offers ten looping demonstrations, facing, pause, scrub and visual settings. Enemy demonstrations run the actual simulation. The gateway lock showcase switches progress for illustration, and ward showcases seed their existing buff timers; they are not campaign progression evidence. Actual end-to-end evidence is separate in `docs/ASTRAL_GATEWAYS_QA.md`.
