# Crownforge architecture release · 20260905-buildings1

All 32 existing Crown and Ashen building types have new artwork. The approved Hall, Barracks, Stable and Granary retain their selected masters. Twenty-five solid structures have matching construction stages; fields stay walkable, roads retain their ground role, and four wall/gate orientations preserve existing connections. The art was generated with the built-in image tool. Original PNG masters and generation attempts remain in the isolated building art lab; production uses native-resolution WebP assets.

Navigation uses measured material outlines and separate foot/mounted body clearances. Workers build, repair and deliver outside the painted structures; recruits emerge at clear exterior positions. Placement uses actual outlines. Movement follows safe corners without diagonal acceleration drift. Wall collision follows wall direction; completed gates provide foot and cavalry passages. The opening camera frames the enlarged Hall; zoom extends to 240%.

Character rigs, equipment, animation assets, economy costs, production roles, combat rules and living-meadow artwork are retained from production commit `4e0e0f9aefaa14fa3e3324bcd84f48003d38f4e5`. Relative module imports share the release marker to avoid mixing cached configuration and collision code.

## Saved settlements

Existing saved building, resource and character coordinates load unchanged. No automatic layout migration is included. Before an older save is loaded or replaced by an explicit Save, its exact bytes are backed up and verified. Download and restore controls appear under Atmosphere when a backup exists. A closely packed older town may need later layout adjustment for the larger artwork; automatic relocation remains a separate pending user decision.

## Verification

- All 32 catalogue entries and runtime images have recorded dimensions, alpha information and SHA-256 hashes; all 51 protected approved-preview files remain unchanged.
- Twenty-five solid outlines: 50 complete foot/mounted perimeter routes at maximum travel speed.
- Twenty-two construction completions, 25 repairs, 12 recruitment exits, and passable fields/roads.
- Eight foot/mounted gate crossings across all four orientations, unfinished gate blocking, and precise placement.
- Exact backup, save-before-load protection, unchanged loaded coordinates/resources, repeated load and restoration.
- Full roster motion, loading and gameplay regressions, gathering, and meadow regressions.
- Browser review of gameplay, Hall construction, character scale, wall corners, tower sockets and gate orientations.

Review all buildings at `dev/building-studio.html`; connected defenses at `tools/wall-orientation-qa.html`. Exact prompts: `BUILDING_ART_PROMPTS.md`; asset receipt: `assets/buildings-depth/manifest.json`.

Deployment: feature commit `5d5c38a4e4ff4ccd2a9ce409586a2cc1d913527c` pushed to `codex/crownforge-live-sync-20260821`. Render served release marker `20260905-buildings1`; 173 live files, including all 120 artwork assets and 48 game modules, matched the tested local SHA-256 hashes at 2026-09-05 23:41 UTC. A fresh live browser load reached gameplay and displayed the new Hall, current character rigs, meadow and HUD. The preceding production commit provides a code/assets rollback; stored backups remain compatible with that game.
