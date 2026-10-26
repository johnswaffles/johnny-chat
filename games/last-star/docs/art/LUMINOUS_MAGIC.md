# Luminous magic sprites — October 26, 2026

Three original transparent paintings extend the approved celestial collection into in-world magical effects. These are effect layers for the renderer to animate, not inventory icons or changes to combat behavior. Earlier assets remain available.

## Runtime contract

All files are 512 × 512 RGBA WebP. Paths are relative to `assets/`. Bounds use `[x, y, width, height]`, measured on decoded alpha ≥16 and expanded by four pixels to protect soft edges.

| Renderer key | Asset | Bounds | Bytes |
| --- | --- | --- | ---: |
| `magicEmber` | `magic-v3/ember-impact-v3.webp` | `[23,19,473,477]` | 128,102 |
| `magicFrost` | `magic-v3/frost-impact-v3.webp` | `[3,15,506,483]` | 133,186 |
| `magicAstral` | `magic-v3/astral-corona-v3.webp` | `[28,13,467,479]` | 116,568 |

Exact dimensions, bounds, source/runtime SHA-256 hashes and alpha inspection results are in `assets/magic-v3/manifest.json`. Combined runtime payload: 377,856 bytes.

- **Ember:** centered molten core with broad hooked orange flames and contrasting dark ember crust; no directional tail. Suitable for a compact rotating projectile accent and a larger impact. Procedural trails should communicate travel direction.
- **Frost:** explosive radial crown of angular ice fractures with a transparent opening. The center stays open so the struck enemy can remain visible. Use as impact/freeze/shatter accent, not as the moving fan projectile.
- **Astral:** irregular violet-blue energy corona with gold-white threads and a clear transparent aperture. Suitable for an expanding portal or bounded astral impact accent; there is no opaque galaxy or fog disc in the opening.

Do not treat apparent painted size as a new damage radius, range or collision rule. Effects must follow actual simulation events and the renderer clock, respect pause/Gentle/reduced-flash/Light settings, and retain bounded workload and complete procedural fallbacks.

## Generation and preservation

Built-in `image_gen` produced one original image per asset with `transparent_background: true`. Prompts explicitly requested unframed effect layers, broad contrast, visible transparent gaps, no scenery/text/people and no rectangular haze. Existing Ember, Frost and Eventide art was inspected to preserve Last Star's identity. The official Konami gameplay screenshot was inspected only for general light contrast and readable arcs; it was not supplied as a generation input or incorporated into an asset.

Repository-root masters and exact prompts/provenance:

`output/last-star-luminous-20261026/source-art/`

The PNG masters are unchanged copies of generator output. Runtime delivery uses proportional LANCZOS downsampling to 512px, WebP quality90/method6, and preserved alpha; no creative programmatic painting or redesign was applied. The generator's model identifier was not exposed.

## Asset inspection

All three runtime files have genuine alpha, range0–255 and fully transparent corners. In the central24×24 pixels, mean alpha is0.29 for Frost and0.0 for Astral, confirming the openings are transparent. Ember intentionally has a compact solid luminous core. Faint sub-16-alpha edge pixels may extend beyond registered content; the four-pixel safety padding protects visible falloff.

Full-size originals and the optimized sprites were visually inspected. A static128px contact sheet places the sprites with source-over compositing on actual dark Silverwood architecture and bright waterfall crops:

`output/last-star-luminous-20261026/qa/magic-sprites-scene-128.png`

The Ember core, Frost's dark-blue facets and Astral's open corona remain distinguishable on both crops, without a rectangular background. The accompanying JSON identifies the source screenshot and crop coordinates. This is static asset inspection, not proof of runtime animation, combat, performance or deployment; those remain the integrating renderer's review responsibility.
