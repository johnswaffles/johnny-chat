# Genesis presentation upgrade — local review

## Implemented

- Ocean expands vertically into taller windows; wide windows expand the world horizontally. Graph and lower guidance remain attached to the world, with modal dialogs centered.
- Pointer coordinates map back into the original simulation space. Creature and colony artwork retains its proportions while the habitat expands.
- Filtered, cached terrain color field replaces individual tile rectangles. Organic colony offsets, mineral details, water caustics, distinct creature silhouettes, and circular intervention ripples improve visual readability.
- Visible Inspect life control supports primary-click inspection without spending Catalyst. Inspection pauses and restores the previous simulation state. Creature inspection includes an enlarged specimen illustration.
- Persistent contextual next-step prompt and revised opening instructions use the existing mission/help systems.
- Reduced motion also freezes shader movement. Decorative terrain caching limits refresh work.

Simulation rules and existing audio are preserved. This is the first presentation pass; it does not implement the entire design roadmap.

## Validation

Godot 4.6.1 web export and local browser review at 1280x720 and 1016x909. Browser play reached mission 2, inspected a creature, and verified habitat placement after resizing.

Run the focused regression with Godot:

```
godot --headless --log-file /tmp/genesis-tests.log --path . --script tests/presentation_regression.gd
```

Checks cover input coordinate round trips at three viewport sizes, graph placement, inspection/resource protection, pause/resume, tool switching, reduced motion, and 1200 simulation steps.

The local macOS sandbox reports an OS certificate lookup warning and prevents saving global editor settings. Web export succeeds; these messages are not game script failures.

## Next stages

Camera zoom/pan/follow, collapsible panels, and save/resume have now been implemented. See `DELIVERY_STATUS.md` for the remaining ordered stages through final push.

## Local artifact

Preview export: workspace `output/sim-genesis-preview/`.
Preserved pre-edit source snapshots: workspace `output/sim-genesis-before/`.
No production export, commit, push, or deployment was performed.

## Exploration and saves

Use +/− or the mouse wheel to zoom, Pan or middle-drag to move, Fit/Home to reset, and Focus ocean to hide panels. The inspector can follow a living creature. Save creates a browser-local checkpoint; running worlds autosave every 30 seconds. Returning players choose Resume saved world, which restores the simulation paused. A previous validated checkpoint is retained for recovery.

Additional focused test: `godot --headless --log-file /tmp/genesis-save-tests.log --path . --script tests/camera_save_regression.gd`.

## Journal and history

Open Journal (J) for five illustrated ecological profiles, observed-species records, diets, care notes, and evolutionary discoveries. The journal pauses the world and returns it to its previous running state. Click the mini history strip or select Population history to inspect shared/relative scales, species filters, sampled counts, and intervention/milestone markers. Mats and fungi count occupied cells, not individual organisms.

Existing saves remain compatible. Feeding, reproduction and low-energy cues describe actual organism states; no new random draws or biological balance changes were introduced.

Focused checks: `godot --headless --log-file /tmp/genesis-journal-tests.log --path . --script tests/journal_history_regression.gd`.

Browser saves now remain in Saving until the persistent file-system flush completes. Keep the tab open until Saved appears; unconfirmed writes report a retryable failure. `tests/browser_save_sync.mjs` covers concurrent engine/manual flushes and failure handling.
