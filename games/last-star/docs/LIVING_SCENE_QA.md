# September 28 visual release

Problem: Light quality capped the entire gameplay canvas at1x, visibly softening characters and foreground on Retina displays. Restoring one large high-resolution canvas initially averaged31.72ms/frame in the combat profile, so that implementation was replaced before release.

Final renderer: two browser-composited canvases. Foreground transparent layer retains up to2x device resolution (8.3M-pixel limit) in both quality modes; the opaque background layer keeps separate1x/1.5x atmosphere resolution. Background and gameplay use the same camera/time, with independent parallax depths. No live pixel manipulation, blur filters or rewritten raster art. Reduced foreground fog exposes platform edges. Canvas recording composites both layers explicitly.

Living scene: rooted tree sway,16/30 silver leaves across three wind/parallax depths, five distant bird arcs, gently varying light shafts and distant drifting mist. Baked waterfall animation interpolates instead of stepping; narrow continuous highlights cover existing streams and five newly registered painted streams in the upper aqueduct/distant ridge/east cliff. Excluded Silverwood tree-arch stream remains excluded. No new levels or memory content.

Profile: Codex in-app browser,1280×720,DPR2,Light atmosphere,12-shade sustained-fire harness,30 warmup+299 samples. Browser-composited build: mean work0.69ms,p950.9ms; mean frame16.67ms,p9518.4ms (~60fps average). This is a short local measurement, not a guarantee for every device/window. Original low-resolution Light baseline was16.67ms,p9517.9ms. Foreground now2560×1440 for the same1280×720 viewport.

69 automated checks pass, including Retina resolution independent of atmosphere and continuous/pause-safe motion. Website build and Pages file-size/route checks pass. Existing wizard/background/character assets remain unchanged; memories remain absent.

Input-only full-route run completed: three starseals, 13 kills, boss defeated, won state. Eastern-waterfall visual fixture checked separately. No console errors observed.
