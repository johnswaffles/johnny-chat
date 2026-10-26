# Celestial collection verification — October 26, 2026

Status: implemented and verified locally. No push or public deployment was performed.

## Automated checks

- `node --test games/last-star/tests/*.test.mjs`: **94 passed, 0 failed**. The seven focused pickup tests cover ground contact at bob extrema, aspect-preserving registered bounds, open chest opacity/grounding, reward drawing in front of the chest, legacy fallbacks, Gentle/Light/reduced-flash behavior, and homing/offscreen/taken drops.
- `node scripts/verify-pages-build.mjs`: passed navigation, active-route, retired-route and 25 MiB file checks on the available sparse checkout. The unchanged sibling route HTML files were hydrated from the exact base commit for this check; unrelated game assets were not re-downloaded. A full monorepo Pages build was not run.
- Source/public mirror: **290 runtime files checked; zero differences** across index, stylesheet, src and assets.
- `git diff --check`: passed. Prior approved raster files are unchanged; the new artwork uses its own versioned directory.

## Browser verification

Isolated Chrome context, local server at `http://127.0.0.1:4198/`. Sixteen gameplay/UI checks passed with **zero JavaScript errors and zero failed requests**.

- Normal keyboard movement; wheel layout at 1600×900 and 800×600; complete icon/name/count bounds.
- Keyboard and virtual-controller right-stick selection; release equips without casting.
- Ember, Frost, Chain and Flask activation through ordinary input after explicit QA setup. Ember consumes one charge; Frost emits five shards; Flask heals exactly 65 HP. These are deliberate fixtures, not input-only playthroughs.
- Ground Ember collection adds three charges. Pointer-cast Starshard opens the real first chest. Its visible gem is collected once for 150 points.
- Pause freezes renderer time and pickup positions. Gentle effects and Light quality render correctly.
- Existing input-only route driver completed a fresh game with three seals, thirteen kills, defeated guardian, 54 crystals and 7,500 score. The test advances requestAnimationFrame timestamps by 50ms/frame; it made no player/enemy state edits. The reported 51 simulation seconds is an automated route, not a human completion time or frame-rate measurement.

A visual issue found during QA was fixed: the new opaque open chest initially covered its spawned gem. Chests now paint before their rewards. The corrected appearance and collection were verified, and a regression test protects the draw order.

An independent layout review also found that the wheel could overlap the hotbar after switching to the left. Left placement now sits above the hotbar, and transient dialogue is hidden while selecting. This was rechecked at 800×600 and 1600×900.

The separate art-review page loaded all eleven assets and its controls worked at 1280, 800 and 320 pixels wide, including Detail + Compare + Bright surface, without horizontal overflow, missing images or browser errors. The normal playable screenshot uses actual opening placements, with the wheel held open; it is not a generated gameplay mockup.

## Evidence

Detailed JSON results, playthrough summary, screenshots and test output are archived in `output/last-star-celestial-20261026/qa/` in the checkout. Original PNGs and the approved concept are in the adjacent `source-art/` folder. Final gameplay/art-review screenshots are also saved in this chat's visualization folder.

## Practical limits

Physical-controller testing and subjective feel remain for hands-on review. This art pass does not establish a universal frame-rate claim. Live availability requires a separate public release and live browser verification.
