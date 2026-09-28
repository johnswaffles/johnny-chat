# Silverwood polish comparison — September 28, 2026

Local build only. Source: games/last-star, preview http://127.0.0.1:4199/. Branch codex/last-star-silverwood-polish. The published mirror and current live site remain unchanged.

## Delivered

- Eight new painted action poses: cast release/follow-through/recovery, hit brace/recovery and landing/rise. Source and foot/crystal registrations reviewed on dark background enlarged, right and left. The generated walk replacement was rejected; approved walking/idle/air art remains.
- Separate Silverwood spillway, tree and arch on independent parallax planes. Their masked pieces are cached once at loading. New pieces replace redundant early scenery rather than accumulating more copies. The cascade follows its painted source/pool/basin. Existing panorama is untouched.
- Projectile-colored light on the wizard uses small cached sprite tints; platform edges and surrounding mist receive bounded local light. Full-world source-atop was discarded during optimization. No live pixel processing, full-screen blur or extra graphics dependency.
- Existing brute/ranged pair forms a staged Silverwood encounter. Clear yields a gem and two Ember charges once per attempt. New warning, footfall, landing and clear sounds retain volume/voice controls and the RTS music.

## Validation

73 Node tests pass, including new single-reward/retry, staging, staff-muzzle registration and bounded-light checks. Existing full-route simulation tests pass. Browser input-only playthrough completed with three seals,13 kills,bossHP0 and won state; Silverwood cleared with one reward. No browser console errors observed. Reviewed the final scene in play and left a fresh paused encounter for the user. Both new selected PNGs are below4MiB. No pre-existing raster asset was modified. Memories remain absent.

## Performance evidence and limitation

Codex in-app browser,1280x720,DPR2,Light atmosphere,30 warmup+299 sampled frames. Frame timings varied substantially in this desktop session and are not a locked60fps certification. Early concurrent-preview samples were51–58ms/frame. Isolated effects-disabled12-enemy sample24.25ms; effects-enabled cached scenery sample24.64ms. Later two-enemy baseline27.26ms; final two-enemy authored composition26.59ms (p9534.8ms), mean JS/render submission work0.57ms (p951ms). A scenery-only sample reached16.72ms, but this did not hold consistently. Preserve these observations rather than claiming every machine runs at60fps. Compare hands-on in the target browser before publishing; retain Light/Gentle settings and the current live fallback.

Screenshot: /private/tmp/last-star-silverwood-polish-preview.png. Art prompts and selected/rejected versions: docs/art/SILVERWOOD_POLISH.md. To inspect action bounds: tests/polish-art-review.html. To compare rendering costs: tests/performance-review.html exposes scene/light toggles and2/12 enemy profiles. The optional ?qa panel includes Review Silverwood encounter and the input-only full-run driver; fixture positioning is separate from the full-run evidence.
