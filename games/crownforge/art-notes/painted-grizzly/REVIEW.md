# Painted grizzly studio — local study 05

## Standing attack

A separate standing attack raises the bear onto its hind feet, delivers a high paw strike, follows through, and settles onto all fours. Four directional atlases provide eight timed beats over 2.4 seconds. The studio draws intact paintings with a fixed scale through the cycle; taller poses fit inside the clearing. Single attacks retain that framing when they return to the approved breathing animation.

Select **Standing attack**, or press **Standing attack once** to perform one attack and return to breathing. **Repeat attack cycle**, playback speed, scrubbing and frame stepping support inspection. The current review is playing southwest at 0.75× speed.

The southwest generated high wind-up switched the striking paw. Playback excludes that source painting and holds the preceding rise pose through the wind-up beat, preserving the near-paw strike. The other three views use all eight source paintings. These are local motion studies for review, with the approved walk, breathing and regular swipe preserved byte-for-byte.

Saved assets: `assets/painted-rear-sw-v1.png`, `assets/painted-rear-se-v1.png`, `assets/painted-rear-nw-v1.png`, and `assets/painted-rear-ne-v1.png`. All are 1536×1024 RGBA, copied unchanged from ImageGen. [STANDING_ATTACK_PROMPTS.json](STANDING_ATTACK_PROMPTS.json) records exact prompts, references, outputs and curation. [REAR_ART_ANALYSIS.json](REAR_ART_ANALYSIS.json) records transparency, dimensions and hashes.

Validation: `node tools/rear-check.mjs`, `node tools/action-check.mjs`, `node tools/studio-check.mjs`, and `node --check studio.js` passed. Browser review covered all four directions, raised-paw/strike clearance, paused scrubbing, repeat playback, and single-attack return to breathing. Session check reported 9,240 rendered frames and zero errors. No game integration, commit, push or deployment was performed.

---

# Painted grizzly studio — local study 04

## Standing and paw swipe

The current painted bear now has standing and swipe sequences in all four views. Standing uses four quiet whole-painting breath poses over 3.6 seconds. Swipe uses eight timed beats over 1.65 seconds: ready, brace, draw back, wind-up, strike, follow-through, recover and settle. The fast strike has a shorter exposure than preparation and recovery. The poses include shoulder rise and torso turn; some views rise higher than others. These remain local artwork studies for judging motion and direction consistency before game integration.

Choose **Stand · breathing** or **Paw swipe** in Action. **Swipe once** performs a single attack and returns to breathing; **Repeat swipe cycle** controls repetition when Swipe is selected. Pause, frame stepping, the timeline, previous-painting ghost and earlier-art comparison work for the new actions. Walk cadence is disabled while reviewing stand/swipe because those actions have their own timing. Display clearance and thumbnail scale account for the raised paw.

The southeast generator output changed the striking paw in its high wind-up. That painting is excluded from playback: the correct-paw draw-back is held through the wind-up beat. The rear-left standing feet were corrected to rest flat. Source image pixels are unchanged after ImageGen; the studio still draws complete paintings without independently moving body parts.

The approved walking atlas files and `painted-art.js` are unchanged, verified against `APPROVED_WALK_SHA256.txt`. All previous artwork choices remain available.

New saved assets:

- [Southwest stand and swipe](assets/painted-actions-sw-v1.png)
- [Southeast stand and swipe](assets/painted-actions-se-v1.png)
- [Northeast stand and swipe](assets/painted-actions-ne-v1.png)
- [Northwest stand and swipe](assets/painted-actions-nw-v1.png)

Each sheet contains twelve paintings: four standing poses, then eight swipe poses. [STAND_SWIPE_PROMPTS.json](STAND_SWIPE_PROMPTS.json) records the exact built-in ImageGen prompts, references and output paths, including transparency extraction and the rear-left foot correction. [ACTION_ART_ANALYSIS.json](ACTION_ART_ANALYSIS.json) records actual RGBA dimensions, transparent-pixel counts and file hashes. All images were copied byte-for-byte into the workspace.

Validation: `node tools/action-check.mjs` passes action bounds/scale, exact timing boundaries, frame stepping, looping, one-shot recovery and approved-walk preservation. `node tools/studio-check.mjs` passes the walking checks. The local Canvas review exercised one-shot return to breathing, slow playback, held strike/wind-up frames, both front views and both rear views. No game integration, commit, push or deployment was performed.

---

## Study 03 notes

## Front-paw rhythm

This revision focuses on the repeated forepaw poses and abrupt changes visible from the front. New whole-bear paintings show more distinct support, passing and reaching poses. The front-right and front-left frames are curated into a single reach-and-return cycle rather than playing the generator's raw sheet order. No body parts are independently animated and no generated pixels are edited.

The default opens the southeast front view. “Compare with approved hind stride” shows study 02 on the left and the front-paw study on the right. The Artwork menu keeps study 02, study 01 and the original atlas available. Study 02's assets and measured bounds are unchanged. The new paintings are a review candidate, not a claim of pixel-identical hind-leg preservation: whole-image edits can alter nearby contours. The northwest candidate changed the approved hind-paw silhouette enough that it was rejected; that view continues to use the exact study 02 artwork and sequence.

Accepted new assets: `assets/painted-walk-se-v3.png`, `assets/painted-walk-sw-v3.png`, and `assets/painted-walk-ne-v3.png`. The northwest output is retained as an unused candidate. [FRONT_STEP_PROMPTS.json](FRONT_STEP_PROMPTS.json) records the exact built-in ImageGen edit and extraction prompts, source paths, output paths and acceptance decisions. [ART_ANALYSIS.json](ART_ANALYSIS.json) records actual alpha transparency, hashes, bounds and the curated source-frame order. All accepted images are 1536×1024 RGBA PNGs, copied byte-for-byte.

Verification: focused frame-bound, cycle-wrap, fixed-anchor, destination/stop and original-art checks pass. Both front views were reviewed in the local Canvas comparison, including held poses from opposite halves of the stride. Rear-right was visually compared with study 02. Production remains untouched; no push or deployment.

---

## Study 02 notes

## Longer hind-leg stride

The default now uses `assets/painted-walk-{nw,ne,se,sw}-v2.png`. This revision asks both hind legs to reach farther forward and back, with more visible hock flex and paw push-off. The extra excursion is most readable in the rear views. It remains a painted animation study; no separate limb rig or torso deformation has been added.

“Compare with previous walk” shows study 01 on the left and the new stride on the right. The Artwork menu retains both studies and the original atlas. Upper-body measurements keep the comparison at a similar body size instead of shrinking the bear to fit its newly extended paws. A per-painting display clip prevents neighboring atlas sprites from appearing where an extended paw crosses a nominal column. Source image bytes remain unchanged.

Exact edit/extraction prompts, references, original output paths and accepted assets are recorded in [HIND_STRIDE_PROMPTS.json](HIND_STRIDE_PROMPTS.json). The earlier bounds and alpha report are preserved in `painted-art-v1.js` and `ART_ANALYSIS_V1.json`. The current report records all four actual RGBA images, dimensions and hashes.

Local review: both rear views and both front views checked in Canvas; rear frames 3 and 6 compared with the previous walk; pause, stepping, slow playback and the comparison control exercised. Session check reported 6,600 rendered frames and zero errors. The focused asset/motion check passes for all 32 frame bounds, fixed anchors, cycle wrap, travel/stop and byte-identical original artwork. This revision has not been integrated or deployed.

---

## Study 01 notes

The original bear artwork is restored here for comparison. The live Crownforge renderer, combat, curses and deployment remain untouched.

## What the original contains

`assets/crownforge-grizzly-v1.png` is the exact original, unmodified atlas. Each of four views has a neutral painting, two walking poses, and a swipe painting. The former renderer played `[neutral, stride A, neutral, stride B]`. This contains two different walking poses, not a complete sequence of paw lift, passing, reach, and weight transfer. It also re-centered each frame around its changing silhouette and lowest visible paw; changing the paw reach can therefore shift the entire painting.

The original comparison intentionally preserves that rendering so the difference can be judged. No cutout rig is used in this studio.

## First painted walking studies

There are eight whole-bear paintings for each of four views (32 total). The original atlas guided the animal's silhouette and fur. The front-view sequences include lifted, reaching and planted forepaws; the rear views reveal the hind-paw changes. These are first-pass painted studies, not a claim that every contact is ready for production. The new paintings have a warmer finish than the original, so compare the artwork as well as the movement before choosing them for integration.

The studio renders each complete painting. It does not rotate separate limbs, stretch the torso, interpolate silhouettes, or silently blend between frames. The optional ghost overlay is a diagnostic view only.

Upper-body anchors stabilize horizontal placement. A fixed upper-body height per direction prevents changes in a reaching paw's bounding box from bouncing the torso. All eight frames in each view use the same uniform drawing scale. Measured alpha bounds include complete paintings even where a paw crosses a nominal grid boundary. The original PNG pixels remain unchanged.

The walk can be watched in place, compared beside the original, or sent around the clearing. Clicking the clearing sets a destination. Playback, size, cadence, frame stepping, scrubbing, contact guides and a previous-painting overlay support further review. Stand and original swipe are retained as pose references; the new work focuses on walking.

## Review next

Watch the 8-to-1 seam slowly in all four directions. Compare the lower paws while keeping the upper-body guide enabled. Check whether the new warmer fur still matches the original animal you prefer. The studio makes it possible to pick an individual painting for a targeted revision without replacing the entire bear again. Actual combat and travel-speed matching in the full game are separate integration checks.

## Files and provenance

- Original master: [crownforge-grizzly-v1.png](assets/crownforge-grizzly-v1.png)
- Northwest: [painted-walk-nw-v1.png](assets/painted-walk-nw-v1.png)
- Northeast: [painted-walk-ne-v1.png](assets/painted-walk-ne-v1.png)
- Southeast: [painted-walk-se-v1.png](assets/painted-walk-se-v1.png)
- Southwest: [painted-walk-sw-v1.png](assets/painted-walk-sw-v1.png)
- Exact built-in ImageGen prompts and references: [PAINTED_WALK_PROMPTS.json](PAINTED_WALK_PROMPTS.json), [TRANSPARENCY_PROMPTS.json](TRANSPARENCY_PROMPTS.json), and [ORIGINAL_ART_PROMPT.json](ORIGINAL_ART_PROMPT.json).
- Alpha counts, dimensions, and file hashes: [ART_ANALYSIS.json](ART_ANALYSIS.json).
- Whole-frame crop and anchor data: `painted-art.js`. Read-only measurement utility: `tools/analyze-art.py`.

The first generation returned painted checkerboard backgrounds. Those were rejected for runtime use. Built-in ImageGen produced the final actual RGBA cutouts. All four accepted sheets are 1536×1024 with more than 860,000 fully transparent pixels each. They were copied into this project byte-for-byte; no Python image editing was used.

## Run locally

From this folder: `python3 -m http.server 58663 --bind 127.0.0.1`. Then open `http://127.0.0.1:58663/`.

The currently running studio is served on that port. No package install or build is required. Fonts can fall back to local system fonts when offline.

## Verification completed

The four views were checked in the actual local Canvas studio. Rear and front views render as complete paintings over the grass. The original/new comparison, pause, frame stepping, slow playback, direction changes, and clicked travel followed by a stop were exercised. The focused check validates all 32 frame bounds, eight-frame wraparound, fixed upper-body anchors, destination movement without overshoot, and unchanged original artwork. Production checkout remains clean.
