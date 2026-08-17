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

The exact final hashes and pushed commit are recorded in the release section below once the deployment commit exists.

## Cache and propagation controls

- Module and stylesheet cache markers were advanced from `20260816-expansion2` to `20260816-integrity1`.
- The repaired attack atlas uses a new filename (`v3`) so an old browser cannot silently reuse the defective v2 response.
- The `games/crownforge` source and `public/crownforge` deploy mirror must be synchronized before commit.
- Live verification must confirm the integrity marker and `v3` asset URL in the loaded source, not only that the page responds.

## Final release record

- Local branch: to be filled after commit
- Local commit: to be filled after commit
- Pushed commit: to be filled after push
- Production build identifier: to be filled after deployment
- Deployed asset-manifest version: `20260816-integrity1`
- Live cache state: to be filled after live fetch
- Live result: to be filled after deployed browser verification
