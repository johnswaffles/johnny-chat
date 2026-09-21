# Crownwarden architecture — 20260921-architecture1

Nineteen original full-resolution paintings replace the Crownwarden building, field, road, wall and gate artwork. The Observatory remains the approved reference. Crown Hall and Barracks render at 3000, Stable at 1980, and Granary at 1260, preserving the approved doubled scale. Other solid buildings use the same larger architectural treatment.

`src/architecture-data.js` keeps native image dimensions, ground anchors and convex compound footprints together. Shared placement, walking, mounted navigation and approach points use those footprints. Construction previews use the new painting throughout instead of switching from unrelated old construction art. The existing save-backup mechanism preserves pre-upgrade saves when the architecture version changes.

Walls use a central repeat from the original frontal painting, projected into four orientations; gates share those orientations and have an eight-unit span. Stone junctions replace the wooden posts. Costs, production and combat stats are unchanged. Fields and roads remain walkable.

Original PNGs and generation prompts are in `assets/architecture-v2`. Source and public assets remain identical. `dev/architecture-roster.html` reviews the actual production renderer and scale, with characters for comparison. Prior approved review links forward to this collection.

Validation: building-depth (25 solids / 50 complete routes), building-services (22 construction completions, 25 repairs, 13 recruitment exits), building-defense (8 gate crossings), building-save-backup, six builder queue tests, four starting-clearing tests, eight meadow tests, and the new artwork/hash/scale regression passed. Chrome rendered all 19 paintings and connected fortifications without script errors; the normal game movement smoke check passed.
