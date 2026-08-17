# Crownforge Build and Asset Verification

## Audit identity

- Audit date: 2026-08-16
- Source baseline: `bf54155` from `origin/main`
- Runtime marker: `20260816-integrity1`
- Active game route: `/crownforge/`
- Scope: visual integrity, atlas boundaries, directional animation loading, spatial coherence, and deployment verification. No new gameplay system was introduced.

## Source-of-truth resolution

The clean audit worktree was created from `origin/main` at `bf54155`. The untracked `/Users/johnshopinski/Documents/New project/crownforge` directory was treated as a stale working copy and was not used as a deployment source. The tracked source and deployable mirror are `games/crownforge` and `public/crownforge` in the Johnny Chat repository.

## Asset verification

The active marauder attack source is now:

`assets/crownforge-raider-attack-loop-v3.png`

It is a 1254 × 1254 RGBA 4 × 4 atlas. The v2 source remains in the repository for provenance but is no longer referenced by runtime configuration. The v3 atlas was rebuilt from four generated directional strips, then the back-left contact frame was replaced with a standalone connected-axe pose. Its source cells have no top, left, or right boundary violations in the current audit.

The following source families were checked for existence and expected dimensions by `tools/visual-integrity-audit.mjs`:

- environment and building-stage atlases
- all current Villager task/carry/action atlases
- Crown Guard combat atlases
- Ashen Raider combat and walk atlases
- meadow and camp art used by the playable map

The audit reports no missing active files, no placeholder references, and no dimension mismatches. Raw environment silhouettes intentionally touch some atlas cell edges; the live renderer samples each source cell with a one-pixel inset, and the deployed visual check is the acceptance test for those authored contact edges.

## Relevant hashes

Run from the repository root after the final commit:

```text
shasum -a 256 games/crownforge/assets/crownforge-raider-attack-loop-v3.png
shasum -a 256 games/crownforge/assets/crownforge-raider-walk-loop-v1.png
shasum -a 256 games/crownforge/assets/crownforge-environment-atlas-v2.png
shasum -a 256 games/crownforge/assets/crownforge-building-stages-v2.png
```

Recorded final hashes:

- v3 attack: `e64046d45b06cf2a41fbe5e7f7a0bbaea026b28a18e5ebc3c42c6a6e850c78ca`
- raider walk: `735877403ea3c35e9d1499799731ebfdae18d80eeb665873cee281fdadb34e70`
- environment: `4a7dd2a5defc8cbc5b67b91c590f75cbc8b1ad0a0dfa48b97687dc2b33151f8c`
- building stages: `e4e31b4883b9a5d7b78a6d276580b50ff0aa6c8ba705aa37e0ddd7251332d3a3`

The live v3 response produced the same SHA-256 as the local file.

## Cache and propagation controls

- Module and stylesheet cache markers were advanced from `20260816-expansion2` to `20260816-integrity1`.
- The repaired attack atlas uses a new filename (`v3`) so an old browser cannot silently reuse the defective v2 response.
- The `games/crownforge` source and `public/crownforge` deploy mirror must be synchronized before commit.
- Live verification must confirm the integrity marker and `v3` asset URL in the loaded source, not only that the page responds.

## Final release record

- Local branch: `codex/crownforge-visual-integrity`
- Local commit: `d8742b151685fe4c1d5688f39101d9fc3bcab30f`
- Pushed commit: `d8742b151685fe4c1d5688f39101d9fc3bcab30f` on `main`
- Production build identifier: `d8742b1` / runtime marker `20260816-integrity1`
- Deployed asset-manifest version: `20260816-integrity1`
- Live cache state: confirmed; HTML loads `styles.css?v=20260816-integrity1` and `src/main.js?v=20260816-integrity1`.
- Live result: confirmed at `https://justaskjohnny.com/crownforge/?deploy=integrity1&t=2`; title correct, v3 config/asset loaded, no browser console logs, fresh 1280 × 720 screenshot coherent.
