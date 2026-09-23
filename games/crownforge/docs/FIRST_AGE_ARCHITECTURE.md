# First Hearth architecture — 20260923-firstage1

The approved compact Crown Hall establishes oak framing, brown wooden shingles,
rough fieldstone footings, cream plaster, warm windows and restrained teal cloth.
All 16 Crownwarden building/plot plates follow that direction, plus new wooden
palisade and gate plates and an earth-and-fieldstone road texture. The Observatory
of the Last Star retains its original artwork, scale, collision and gameplay data.
Enemy architecture and character art are unchanged.

Native building originals are 1536×1024 RGBA with transparent backgrounds. The road
is a 1254×1254 opaque texture. Assets are versioned under architecture-first-age;
previous artwork is retained. manifest.json records original byte hashes and the
Observatory preservation baseline. generation.json records the new building briefs.

The Crown Hall is 1050 render units wide (previously 3000); Barracks 1000 (3000),
Stable 1000 (1980), Granary 800 (1260). Character sizes remain unchanged. Each
building's ground points are authored against its base and transformed through the
52×26 projection into convex navigation/placement hulls. Rendering, collision,
selection and worker approach stations share this data. Wall span and gate passage
widths retain their existing gameplay dimensions; their artwork is shorter timber.
Lantern and chimney effects are aligned to the new Hall and Homestead.

Building functions, prices, build times, health, training, storage and defenses are
unchanged. Saved buildings take the new art and outlines automatically. The same
unit relocation and routing logic remains in use.

Review: dev/architecture-roster.html provides every building beside actual units.
The approved Crown Hall study link forwards to that production-backed gallery.

Validation: crown-architecture-regression verifies all 19 original assets, runtime
bindings, hull winding, smaller scales and exact Observatory preservation.
building-depth-regression exercises 50 foot/mounted routes; building-services checks
22 construction completions, 25 repairs and 13 recruitment exits. Defense checks
exercise eight gate crossings and exact polygon placement. Placement queue and
meadow regressions verify continued construction and ground-cover behavior.
The legacy buildings-depth asset audit requires its archived asset manifest, which
is absent from this sparse checkout; new release artwork is covered by the current
architecture audit. Browser review checks art, scale, placement and touch controls.
