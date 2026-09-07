# Painted Ashen Hearthkin — 20260907-paintedashen1

Ashen Hearthkin now uses 384 whole-character paintings across four authored directions and 23 base actions (26 studio choices including strike phases). The charcoal clothing, dark braid, front apron and rust sash preserve her Ashen identity. Corrected chopping keeps the axe head above the hands, and timber uses the forward carrying sequence in every direction.

The shared painted renderer accepts faction-specific artwork and attack timing. Ashen assets load when that character is first encountered; Crownwarden startup and other character rigs retain their existing behavior. Gathering contacts, movement pauses, shield protection and Last Light rules are unchanged.

## Validation

- 43 automated checks passed: artwork hashes and bounds, action coverage, real simulation facing, carrying, Ashen attack timing, Last Light, existing Crownwarden/bear behavior, loading, camera, smoothness, buildings and roster gameplay.
- Local studio: 26/26 actions opened, four views, over 11,000 rendered frames, zero errors. Visually reviewed chopping, walking, carrying and the generated action atlases.
- Local production renderer: all 92 clips ready, 109.7 MiB prepared frame cache, zero errors. Actual gathering executed; Last Light kept the worker at full health with an active ward while the bear left.
- Browser screenshot capture of the game canvas was unavailable (blank captured canvas); studio visuals and runtime readiness were verified separately.

## Artwork records

Generated and extracted using built-in ImageGen. Final PNG alpha and image bytes are preserved. Exact prompts, references and selected outputs are recorded under art-notes/painted-ashen-hearthkin/provenance; ART_ANALYSIS.json records final image hashes, frame bounds and cell mappings. Final atlases live in assets/ashen-hearthkin-painted. Metadata measuring tools read pixels only and never edit the paintings.

Studio: /dev/painted-ashen-hearthkin/
Release branch: codex/crownforge-live-sync-20260821
