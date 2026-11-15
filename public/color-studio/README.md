# Color Studio

A standalone, touch-friendly color-by-number game at `/color-studio/`, linked from the home page’s arcade. Built with browser modules, Canvas 2D, a processing Worker, IndexedDB, and a scoped service worker. No frontend build or new dependency is required.

## Painting

The current single-picture preview enables **An alpine retreat** only. Other pictures remain visible in grayscale with Coming soon labels, including saved older editions; their saved progress is retained. Photo/AI creation is temporarily disabled. Set `singlePicturePreview` to `false` in `experience.js` to reopen the collection and creator.

- Eighteen original detailed illustrations across landscapes, botanical, animals, and patterns. The collection includes the featured alpine chalet and seventeen individually generated replacement paintings. No procedural clipart remains in Discover. Full-size artwork uses lossless WebP; small gallery thumbnails keep browsing light.
- Every built-in picture ships its precompiled, audited numbered canvas, giving every device identical regions without an initial conversion wait. Connected numbered regions use a single shared border network (no independently simplified duplicate edges), small viewport-aware numbers, checker-pattern shading clipped to the selected color’s unfilled regions, progress, favorites, undo/redo, hints, reference preview, auto-advance, optional sound, and contrast settings.
- The alpine edition now has 728 connected regions and 32 colors. Three denoising passes, minimum interior clearance and adjacent same-color merging remove tiny fragments while preserving intentional window panes and door details. Shared quadratic curves smooth organic contours while retaining long structural corners. The same curves drive fills, outlines, touch hit-testing and printable SVG; other paintings retain their existing geometry.
- Existing alpine paintings upgrade by overlap with the new regions (at least half a new region already painted). The complete previous record is saved atomically before the upgrade and can be downloaded from Painting settings. Offline or failed upgrades keep the original painting usable.
- Hold on the canvas for 350 ms to open a 2.5× vector magnifier, slide to aim and lift to paint. Panning before the hold, adding a second finger, or canceling the gesture dismisses it without filling. It can be disabled in Settings.
- The canvas uses the full viewport width above a horizontally scrolling bottom palette in both iPad orientations. There is no side palette or oversized number hit target. Completing a color selects the next unfinished color without moving the canvas; only an explicit hint moves to a region. Undo and redo keep the selection and checkered areas in sync.
- Pinch zoom up to 40×, two-finger pan, mouse wheel, double tap, zoom/fit buttons, and hand tool. A pinch or pan cannot fill a region.
- Keyboard painting through Find an area and Fill found area; H, +/−, 0, and standard undo/redo shortcuts.
- Local photographs: aspect-preserving conversion, 8–48 requested colors, four detail presets, denoising, connected-component segmentation, merging of tiny regions, shared-edge simplification, and number anchors verified against the actual rendered polygon. Palette count may be lower for photographs with fewer distinct colors.
- IndexedDB saves and per-picture thumbnails. Older paintings receive the outline/label repair. The alpine edition uses the backed-up upgrade described above. Replacement art uses new IDs; older saved editions remain in My studio and favorites also point to the new edition. Favorites/preferences use localStorage. Saving errors are shown, and unsaved work prompts before leaving.
- 2,400-pixel PNG exports, printable numbered SVG with palette key, and JSON painting/studio backups. Restore validates all paintings before writing, combines compatible progress, and keeps conflicting puzzles as separate copies.
- The studio shell, gallery thumbnails, previously opened paintings, and local photo conversion work offline. New built-in canvases need one online visit. AI requires a connection. No cloud account/synchronization is provided; backups transfer work between devices.

## OpenAI integration

`lib/color-studio.mjs` installs `/api/color-studio/config` and asynchronous `/jobs` endpoints on the existing Express server. The frontend uses the same API origin selection as TextSmith. It reuses the server’s existing `OPENAI_API_KEY`; no key is sent to the browser.

- Art direction: `gpt-6-astra`, high reasoning, structured JSON, `store:false`.
- Artwork: `gpt-image-2.6-sunburst`, high quality and high complexity, PNG; image edits preserve the supplied reference when restyling a photo.
- Optional overrides: `OPENAI_COLOR_PLANNER_MODEL`, `OPENAI_COLOR_IMAGE_MODEL`.
- Four styles: classic, stained glass, botanical storybook, and travel poster.
- Model requests are made only after the player selects Create my artwork. Local photo conversion never uploads a photo. The creator explains the AI upload before submission.
- Polling keeps image generation outside the lifetime of a single browser HTTP request. Opaque job IDs act as retrieval capabilities, results use no-store, cancellation aborts the provider request, and failures/refusals do not become pretend successes.
- Concurrency cap: 3; per-client cap: 4/hour; server cap: 40/day (`COLOR_STUDIO_DAILY_AI_LIMIT`). These are process-local limits. Jobs/results expire after 30 minutes and do not survive server restarts. A multi-instance deployment should move jobs and quotas to shared durable storage.

## Verification

Use the Node version pinned by the repository:

```sh
node --test scripts/color-studio/*.test.mjs
npm run build:pages
```

Tests exercise image topology, coverage, label placement, noise merging, deterministic conversion, backup validation, pinch/pan/tap semantics, API request models/quality, asynchronous generation, image edits, refusal, bad uploads, cancellation, and rate limiting. Provider calls in automated tests are mocked. Live paid generation is a separate release check.

## Product reference

Happy Color is the main product benchmark, with 100M+ Google Play downloads and publisher positioning as the most popular color-by-number game. Pixel Art also lists 100M+ downloads and photo creation. These public buckets cannot independently establish an exact worldwide ranking. All shipped artwork and UI are original; no licensed Happy Color assets are included.

- https://play.google.com/store/apps/details?id=com.pixel.art.coloring.color.number
- https://play.google.com/store/apps/details?id=com.europosit.pixelcoloring
- https://developers.openai.com/api/docs/models/gpt-6-astra
- https://developers.openai.com/api/docs/models/gpt-image-2.6-sunburst

## Gallery production

`gallery-prompts.json` records the prompt set for the seventeen replacement assets, generated with the built-in OpenAI image tool. Full artwork and previews are in `public/color-studio/art/`; exact checked canvases and counts are in `public/color-studio/puzzles/`. The website's player-facing Astra/Sunburst API configuration is unchanged.

To recompile after editing art, run `python scripts/color-studio/prepare-gallery.py --raw-dir <temporary-directory>` with Pillow installed, then `node scripts/color-studio/build-gallery.mjs <temporary-directory>`. Run `node --test scripts/color-studio/gallery.test.mjs` before publishing. The gallery tests cover every region's connectivity, actual polygon containment of all number anchors, matching shared edges, actual spaces for every palette color, and small readable numbers for each last remaining region at zoom. Additional tests verify checker pattern clipping and zoom scaling, precise region taps, single-picture availability, and automatic color advancement.

For the alpine-only compiler, run `node scripts/color-studio/build-alpine.mjs <600x600 RGBA file>`. Its shared settings are in `alpine-options.mjs`. Alpine tests also check for same-color dividers, minimum clearance, watertight curved coverage, and progress migration.
