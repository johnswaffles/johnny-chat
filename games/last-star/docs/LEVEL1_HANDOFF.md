# Level 1 arcade preview — handoff

## Launch and scope

Open http://127.0.0.1:4198/ while the preview server is running. Restart with `npm start` in this directory. QA tools: `/?qa`; repeatable performance harness: `/tests/performance-review.html`.

This is an isolated standalone copy on local branch `codex/level1-arcade-preview`, with no remote. Nothing was pushed, merged or deployed. All293 original source files matched the before-edit hashes; copied approved artwork also matched. No other level was created or modified. The original source and live website remain unchanged. Preview saves/settings use a separate namespace.

## Implemented

Unlimited held staff fire, three visible power levels, safe blink path validation, readable hit reactions, active-window enemy damage, three collectible spells and healing flask, compact four-item curved selector with25% world speed, deterministic bounded chain targeting, burn/freeze/shatter/slow, score treasure, grounded guaranteed pickups, four breakable chests, approach/ranged/brute roles, three-pattern guardian, explicit Level1 completion/replay.

Original wizard, background and movement plane retained. New Blender-rendered scrolls, flask, chest, crystal, gold and gem live separately. Elemental aftermath, pickup sparkle, short trails, existing dust/fog/water motion, sparing kill hit-stop, bounded synthesized sound voices and separate volume/shake/reduced-flash controls.

## Controls

| Action | Keyboard / mouse | Xbox standard mapping |
|---|---|---|
| Move / aim | A,D or arrows / mouse aim while firing | Left stick / right stick |
| Jump / double jump | Space, W or up | A |
| Unlimited staff | Hold J or left mouse | Hold X |
| Blink | Shift | B |
| Use equipped item | K or right mouse | Y |
| Ring | Hold Tab | Hold LB |
| Next / previous while held | E / Q | RB / LT |
| Equip without casting | Release Tab | Release LB |
| Seal / memory / finish | E | RB |
| Pause | Escape | Menu |

Customize keyboard/controller in pause settings. Empty items stay selected. Full-health healing does not consume a flask. Special stacks cap6, flask3, excess becomes75 score. Staff upgrades at6 and15 crystals. Continue/retry preserve seals/memories/elapsed but reset run inventory and power; full replay also resets seals and every encounter.

## Validation

- Baseline51 tests; final67 passing (`npm test`, output/test-results.txt). Tests cover combat, all spell/charge rules, actual-loss lifesteal/Reprisal, staff tiers, blink paths/gates, supporting platforms, three boss patterns, timer scaling, status expiry, pickup uniqueness, reset state and object caps. Three complete fresh input-only simulation runs are part of the suite.
- Three input-only browser runs completed the same existing Level1 with all3 seals and13 enemies, about50 simulation seconds each. No health/position cheats in that route driver; it uses movement, jump, staff, equipped item and interaction. Driver is an expert deterministic player, not a representative human completion time. Browser scores included6775 and6725 due pickup timing.
- Browser practice fixtures in Silverwood exercised Ember, Frost, Chain and stored Flask. Frost charged3→2; Chain3→2; Ember3→2 with enemy defeat; Flask healed140→205 and3→2. Release-to-equip did not cast. Virtual Xbox selection, pause cancellation, disconnect→pause and keyboard prompt fallback verified. Natural enemy damage reached the defeat screen; Return to last seal restored210 HP with empty inventory/Reprisal. Replay returned score0, staff1 and all charges0. Rebinding Use K→H and Restore defaults verified in the browser. HUD/ring checked at1280×720 and800×600; ring bounds fit the viewport.
- Gameplay screenshots: output/selection-combat.png and completion.png. 9.81-second real canvas capture (10-second recording window, playback checked): output/level1-gameplay.webm (no HUD or audio in canvas-only recording). Recording available through opt-in QA button; local endpoint writes only this fixed output file.
- Preservation proof: output/preservation-check.json; baseline hashes in docs/BASELINE_HASHES.json.

## Performance

Codex in-app Chromium on this Mac,1280×720 viewport,DPR2, Rich effective DPR1.5, existing12-shade Level1 arena with sustained staff,30 warmup+299 sampled frames. Timings are browser samples, not an external GPU benchmark; focus/other previews influence rAF.

| Sample | Mean JS update/draw | p95 JS | Mean frame interval | p95 frame |
|---|---:|---:|---:|---:|
| Before changes, Rich |0.86ms|1.40ms|24.91ms (~40fps)|50.00ms|
| After, Rich, another preview active |0.92ms|1.70ms|42.14ms (~24fps)|67.90ms|
| After, Rich, other preview paused |0.72ms|1.30ms|28.99ms (~34fps)|51.50ms|

| After, Light, other preview stopped |0.49ms|0.70ms|16.67ms (~60fps)|17.90ms|

Light mode reached average60fps in this sample and is the fresh-preview default. It caps DPR1, halves fog layers and lowers motes/particles; Rich remains selectable. Rich did not achieve stable60fps. Hardware/browser presentation performance still needs user validation; this short sample is not a universal guarantee.

## Reusable systems and asset workflow

- `src/level1-config.js`: concentrated spell/staff/clock/population tuning, swept blink utility; no future-level instances.
- `src/inventory.js`: transactional charges, stable slots, selection state machine.
- `src/loot.js`: supported placement, collection and chest drops; `src/level1-fx.js`: bounded elemental presentation.
- `src/game.js`: actual simulation, damage/status/encounter timings; `src/main.js`: scaled fixed-step clock, UI interruption/reset handling. `src/controls.js` keeps all gameplay bindings remappable.
- `src/audio.js`: procedural effects,32-voice ceiling, onended disconnection, independent gains. Existing Crownforge song retained.
- Blender5.2.1: run `/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/build_level1_items.py`. Orthographic camera, transparent256px PNG,Cycles24 samples, cool key/warm brass highlights. Source snapshot art/level1/treasure-source.blend; script rebuilds all8 item assets. No extracted D&D content or new dependencies.
- `tests/route-driver.mjs` inputs only, `tests/level1-regression.test.mjs` repeats whole runs; `tests/recording.js` and virtual gamepad load only with `?qa`.

## Remaining review

Physical Xbox on Mac and actual app-switch/focus-loss behavior still need hands-on validation. Please judge sound balance with headphones/speakers and try the boss as a human player; automated completion does not establish subjective difficulty. Rich-mode60fps remains unproven. Canvas-only video excludes HTML HUD/audio. Small scroll sprites favor recognizable colors and names over fine ornament at gameplay size. These limitations are not permission to expand beyond Level1.

Stop here: no Level2, campaign, shop, crafting, extra class or permanent skill tree.
