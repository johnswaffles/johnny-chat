# Landscape mobile verification — October 28, 2026

Release marker: `20261028-mobile-landscape`.
Base: `d8485898dea2c59b4f80edf9b3eb55ab7e513a63` (patched Node and TLS guards preserved).

## Verified before publication

- Inspected the user's supplied 1536×706 Safari screenshot. It showed the desktop HUD and no movement/jump touch controls.
- 127/127 Node tests pass, including 13 touch-input tests and the existing complete input-driven Level 1 campaign, damage, inventory, scenery, controller and save regressions.
- 92/92 browser integration assertions pass in the Codex in-app Chromium browser. Fixture: `tests/mobile-browser.html`; this is local QA and is not included in the public build.
- Viewports: 568×320, 667×375, 844×390, 932×430, 800×360, 844×250. Canvas aspect ratio, title Begin, pause and all touch/selection targets fit, with no document overflow or overlapping touch controls.
- 44px side insets and 21px bottom inset were simulated at 568×320 and 844×390. This validates the layout response, not a physical device's safe-area values.
- Three independent pointer IDs move, cast and jump simultaneously; double jump, outside release, cancel/lost capture, same-action fingers, quick taps, and Cast surviving a zero-step rendering frame pass.
- Magic selection equips without spending; separate use casts five Frost shards and spends one charge; Flask at full HP spends nothing; healing spends one charge. Keyboard takeover closes a touch-open tray without casting.
- Pause freezes the scene. Resume clears old holds while preserving existing movement inertia. Blur pauses. Portrait pauses and blocks Escape/original Resume; returning to landscape waits for explicit resume. Starseal interaction, death/retry and run-reset rules pass.
- Gentle/reduced-flash settings remain functional and long settings panels scroll. Desktop keyboard combinations and virtual standard-controller jumping, casting, stick selection and disconnect pause pass.
- Runtime browser fixture reports zero errors. Visually inspected title, active touch HUD, spell tray, 568×320 narrow landscape, and both `?gorge=1` and `?legacy-scene=1` scenery.
- Full Pages build ran under Node 26.12.1 with the security guard enabled. Route/navigation/25 MiB file-size verification passed. Final release is rebuilt from only committed files in an isolated temporary staging directory.

## Scope and limits

The browser checks use responsive viewports, real layout/game loops, synthetic PointerEvents and a virtual gamepad. They are not physical iPhone/Safari, Android hardware, OS pointer-capture, or hardware controller tests. No iOS performance/FPS or notch-device certification is claimed. `?touch=1` forces the phone UI for desktop QA; actual phones select it automatically through pointer/hover capability.

A preliminary browser pass found a lost quick-Cast tap and a portrait-resume escape path; both were fixed and covered by regression assertions. A subsequent environment reconnect interrupted one fixture reload; the final complete 92-assertion run passed. Earlier assertion timing assumptions were corrected to observe double-jump frames and allow the existing friction to settle after pause.

All changes remain Level 1-only. Gameplay tuning, original artwork, saves, Gentle options, legacy scenery and shelved Memories are preserved. No credentials, permissions, Node pin, TLS guard or deployment configuration were changed.

Publication requires remote commit, CI and live-asset verification; a passing local build alone is not a live-release record.


## October 29 startup regression fix

User reported a blank portrait landing page and an oversized title after rotation. Confirmed: portrait guidance and touch layout previously depended on the full game module graph. The earlier iframe suite only checked orientation after startup. Extreme text enlargement was not reproduced in the available desktop browser; the fix also bounds the title grid and fixes mobile text inflation at 100%. No physical iPhone resolution is claimed.

- 127/127 game tests passed under Node 26.12.1.
- 119/119 browser assertions passed in the Codex in-app Chromium browser (15.4 seconds, zero runtime errors).
- New checks render the real HTML/CSS with game modules removed: portrait guidance appears before initialization; rotating both ways works; the full landscape title and disabled loading button remain inside the viewport.
- Fresh portrait navigation, portrait reload, portrait-to-small-landscape rotation and direct landscape reload pass. Begin is visible, enabled after loading, unobscured by hit testing, and starts touch play.
- All previous input, pause/resume, safe-area simulation, six phone viewport sizes, desktop keyboard and virtual controller checks pass.
- Top-level 390×844 portrait and 844×390 landscape screenshots were visually inspected. The landscape title font measured 46.8px; Begin occupied 398×44px fully inside the viewport.
- Tests simulate layout, orientation and touch input. They do not emulate Safari's text-inflation engine, real phone browser chrome, hardware safe areas or physical multi-touch.
