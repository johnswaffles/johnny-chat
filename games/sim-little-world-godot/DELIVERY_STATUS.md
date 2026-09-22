# Genesis upgrade delivery status

User authorization: proceed through staged improvements and final push. At the end of each stage, report the remaining priorities through pushing. After a successful final push, any further plain `proceed` messages are no-ops for this work. Do not start another round or push again from those messages.

**Final push completed: NO.** Production candidate prepared in `/private/tmp/genesis-presentation-release`; commit/push and live verification are the final remaining release steps.

## Completed stages

1. Ocean presentation and first-use guidance: responsive ocean extent, blended terrain, colony variation, creature readability, water lighting, intervention ripples, visible inspection, next-step prompt.
2. Exploration and continuity: cursor-anchored 1–4x zoom, pan via middle drag or Pan mode, Fit reset, focus mode with collapsible side panels, creature following and end-of-life handling, Save and 30-second autosave, explicit paused resume, confirmed New World replacement, checksum validation and previous-checkpoint recovery.

3. Species journal and population history: five illustrated ecological profiles, persistent first-recorded observations, diets and care notes, evolutionary discoveries, expanded charts with shared/relative scales, species filters, exact sampled counts, timestamped event markers, and visible real feeding/reproduction/low-energy cues. Early-game guidance respects locked hunters, including after older-save restoration.

## Remaining sequence

4. Presentation pass complete for this release scope: ocean art/lighting, event previews and recovery, era announcements, sound controls, readable phone entry/Life lab/journal/settings/events, and touch gestures. Desktop charts retain the rich visual view; phone history uses sampled counts and a recent chronicle. No physical-device certification or whole-interface scaling claimed.
5. Full campaign/endless-mode playtesting, save migration/recovery, mature-world performance, regression and release review. Fix defects before publication.
6. Export the production `/sim/` artifact, inspect release routing/build requirements, isolate the change from unrelated work, commit and push the authorized release, then verify the live route. Record the pushed commit and set **Final push completed: YES**. Subsequent plain `proceed` messages must not trigger more work.

## Current files and review

- Working source: `games/sim-little-world-godot/` inside the `johnny-chat` checkout, currently `main`.
- Remote discovered: `https://github.com/johnswaffles/johnny-chat`.
- Local review export: outer workspace `output/sim-genesis-preview/`, served at `http://127.0.0.1:4196/`.
- Production files in `public/sim/` have not been regenerated yet.
- This checkout contains pre-existing Story Editor/server changes and duplicate files; never stage those as part of the Genesis release. Inspect git status and current remote state again before release.

## Evidence from stage 2

- Godot 4.6.1 headless parsing and Web release export succeeded.
- `tests/presentation_regression.gd`: resize/pointer round trips, inspection, resource protection, pause/resume, tool switching, reduced motion, 1200 simulation steps.
- `tests/camera_save_regression.gd`: cursor-anchored zoom at three frames, pan bounds, focus panels, follow lifetime, save disk round trip, exact RNG/simulation continuation, invalid-save no-mutation, corrupted-primary backup recovery, unwritable destination, paused resume.
- Local browser: zoom, pan, focus mode, creature inspector/follow, Save, full reload, resume. Saved/restored seed `genesis-703081`, score 452, day 2, 270 mats / 23 drifters / 7 grazers, 156% camera, matching locations. This is local evidence only.
- Save data is browser/origin-local; it is not cloud synced. Browser clearing/private storage may remove it. UI reports unavailable storage/save failures.
- Final browser checks also passed New World cancellation and Pan-to-Inspect switching; browser error/warning log was empty.
- Stage 3 fixed the observed locked-predator guidance, including the headline, pulse, coach fallback, and stale restored crisis text.

## Evidence from stage 3

- `tests/journal_history_regression.gd` passed: observations and unknown-species state; journal pause restoration; saved records; compatibility with pre-journal saves; invalid record rejection; refreshed legacy crisis text; unlocked-tool guidance; shared/relative axis calculations; timestamp migration; filters; feeding-state feedback.
- `tests/camera_save_regression.gd` passed again with behavior metadata and journal persistence, including exact deterministic simulation continuation and corrupt-save recovery.
- Browser review on the local export: restored the existing day-5 checkpoint, opened each journal page, filtered Mats out to reveal animal trends, and read exact counts from a selected sample. Browser testing found and corrected stale crisis advice from an older checkpoint.
- Older worlds begin their journal records when first observed by the upgraded build. Earlier event markers retain day-level timing where precise ticks were not stored.
- Biology rules and random-number usage are unchanged; feeding and birth indicators reflect the existing actual simulation actions.

- Rapid-reload testing exposed asynchronous browser persistence: the previous UI could announce Saved before IndexedDB completion. Stage 3 now shows Saving until an explicitly serialized Godot 4.6.1 file-system flush completes; errors/timeouts remain unconfirmed and can be retried. New World is blocked only while a save is actively pending.
- `node tests/browser_save_sync.mjs` passed pending-state, concurrent-flush serialization, error-reporting and retry-isolation tests. This bridge is tied to the shipped Godot 4.6.1 export runtime; retest it if upgrading Godot.
- Final browser confirmation showed Saved at 20:24:48 after the flush; reload verification uses that checkpoint. Earlier development log had an Already syncing warning; serialization fixes the overlapping scheduled/explicit writes.

## Event and milestone pass

- All six world events now show cost, concrete effects, and recovery advice in a paused briefing. Cancel restores the prior running state without cost or RNG changes; apply executes exactly once. Unaffordable events remain blocked.
- Recovery advice is recorded in the persistent journal chronicle. Era crossings produce a visible announcement and timestamped journal entry; reset and saved-world resume initialize the observed era without a spurious transition.
- `tests/event_milestone_regression.gd` passed: preview no-mutation, cancellation, paused application, exact cost, duplicate confirmation, affordability, era crossing/deduplication/reset. Journal/history regression also passed.
- Local browser verified Monsoon preview, cancel, and apply: Catalyst 100 to 88, heat 41% to 33%, storm rain, world still paused. Production remains untouched.
- Event duration descriptions are simulation time at 1x; playback speed changes wall-clock duration.

## Sound and readability pass

- Settings adds independent music, ocean ambience and event-volume controls; ambience and chimes default off. All toggles explicitly show On/Off. Preferences are session-only (stated in UI); reduced motion retains its existing world-save behavior.
- Procedural eight-second ocean wash and short event/era chime use a separate seeded RNG, bounded 16-bit PCM and tapered endpoints. No biological RNG is consumed. Audio waveform tests passed; subjective listening quality has not been independently verified.
- Journal body/observations/chronicle/readout can scale to 100%, 120% or 140%, with scrolling. Browser verified 140% body text and visible scrollbar without changing ocean zoom. This is reading-size control, not whole-interface scaling.
- Clear-water setting hides the decorative lighting overlay. Otherwise, pending events show a soft edge wash and confirmed events fade gently; ocean warmth subtly shifts caustic color. No flash or camera shake.
- `tests/settings_regression.gd` passed pause restoration, reading size/scroll behavior, default audio-off state, biology RNG independence, PCM peak and loop endpoint checks.
- Production remains untouched; full small-screen/touch review remains next.

## Touch gesture and toolbar pass

- Touch now places/inspects on a completed tap, pans on a one-finger drag, and zooms/pans around a two-finger pinch. Gestures consume no Catalyst. Emulated mouse events are ignored by world input to prevent duplicate placement; normal GUI mouse emulation remains available.
- Only touches beginning inside the ocean are tracked. Releases consumed by GUI still clear touch state through deferred cleanup.
- Toolbar uses a flow layout with approximately 42-pixel button height at compact screen scales. Browser checked 800x900 and 390x844 layouts; toolbar wraps at phone width.
- `tests/touch_regression.gd` passed tap cost, duplicate mouse suppression, drag/pinch resource protection, zoom/pan, release cleanup, and UI-origin rejection. Presentation regression passed without script errors.
- Remaining before release: phone-sized mission panels, intro, and journal still use desktop geometry and are too small. Do not describe this as full mobile readiness. Implement a phone-specific panel/navigation layout or a clear supported-size experience before production. No physical touchscreen hardware test performed.

## Readable phone entry and Life lab

- Phones below 600px wide now open a readable start/resume panel. Life lab is available from the wrapping ocean toolbar on all sizes and contains scrolling mission/health text, pause/resume, mission-locked tools, inspect, events and Save. Text renders at screen-sized font sizes rather than scaling a low-resolution panel.
- Browser verified at 390x844: crisp introduction, saved-world resume, Life lab mission and health, and scrolling down through tools/events/Save. Temporary viewport override reset after review.
- `tests/life_lab_regression.gd` passed pause restoration, locked tools and stale-overlay cleanup on New World. Camera/save, journal, event, settings, presentation and browser-save-sync regressions passed in this pass.
- Remaining mobile limitations: original sidebars are still compact; Life lab provides their readable alternative. Journal, settings and event dialogs still need narrow-screen review. Physical touchscreen testing remains unverified.
- Still no production export, commit or push. Continue with remaining dialog sizing, mature-world/campaign review, then release.

## Compact dialogs and mature-world stability

- Below 600px, journal opens readable species profiles or the latest 12 sampled population rows and 30 chronicle events; desktop retains interactive charts. Settings uses large toggles and volume-cycle buttons. Event previews use the same screen-sized, scrolling panel.
- Browser verified 390x844 species guide, settings, a functioning clear-water toggle and Monsoon cost/recovery preview. Desktop settings refresh volume values after mobile adjustments.
- Expanded Life lab regression covers mobile journal page changes, settings and event-cancel pause restoration; journal, settings and event regressions passed.
- `tests/campaign_soak_regression.gd` passed all five mission transitions and endless continuation using a deliberately constructed mature-world fixture. 6000 additional simulation steps reached peak population 128, stayed finite and bounded, and produced a valid save. Headless elapsed time 63.86s (not a browser FPS measurement). This is transition/stability evidence, not proof of organic campaign balance.
- Remaining: normal-play campaign/release review, browser performance spot-check, production export, isolated commit/push and live verification. Final push is still NO.

## Release candidate 20260922-presentation1

- Isolated release checkout `/private/tmp/genesis-presentation-release`, branch `codex/genesis-presentation-release`, based on remote main `4a04dac`. No source or public Sim changes existed between the original checkout base and current remote main. Unrelated original checkout edits remain untouched.
- Normal browser play from the existing day-5 checkpoint completed missions 1, 2 and 3 through placement controls. A fresh world in the production-built artifact completed mission 1, paused for mission 2 and confirmed browser Save. Neither session used fixture state injection. Full organic campaign balance remains unverified; controlled tests cover all five transitions and endless mode.
- Review found negative oxygen balance in a crowded world. Coach now explains the deficit and offers a Viral Bloom preview instead of promising that faster simulation will solve it. This exposes the existing oxygen formula without changing biology or random draws. Positive/negative guidance tests and exact save continuation passed.
- Godot production export, `CF_PAGES=1 node scripts/build-pages.mjs`, and `node scripts/verify-pages-build.mjs` passed in the isolated checkout. Pack is 8.1 MiB, compressed engine 8.9 MiB; no public file exceeds the Pages 25 MiB limit.
- Production-style local preview: `http://127.0.0.1:4197/sim/` maps the engine request to compressed WASM with gzip headers, matching the deployed route. Browser log clean after launch, placements, mission transition and confirmed save. This is not a measured FPS benchmark or physical-phone certification.
- `public/sim/release.json` records the release marker and pack/engine hashes for live verification. Only game source and `/sim/` files are authorized for the release commit.
