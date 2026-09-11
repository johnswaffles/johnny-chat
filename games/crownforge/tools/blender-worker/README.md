# Hearthkin Blender v007 integration

The original `hearthkin-painted` assets and renderer are retained without modification. Use **Atmosphere → Hearthkin appearance → Original character** to revert locally without resetting the settlement. `?hearthkin=legacy` also selects the original on page load. The default is `blender-v007`; the browser preference is stored separately from game saves.

The new asset folder holds four independently rendered camera views for all 31 approved Blender clips. Body, garments, hands, tools and cargo are rendered together, keeping the approved grips. Shader effects and review scenery are excluded; the live shield and curse overlays continue to use the existing gameplay timers.

Every sprite has its projected world-ground pivot retained through cropping. Source motion is sampled at 16 poses for active motion, 8 for idle/held breathing. Atlases are tightly packed WebP with transparent padding and loaded once per character renderer, not once per unit.

`render.py --source <v007-directory>` uses the approved Blender source and its animation helpers. The stationary supplies action is baked from the corrected shared cargo grip, matching the approved walking grip. The fall uses a wider camera frame to retain its whole silhouette. `pack.py` packs the resulting `/private/tmp/hearthkin-game-frames` images and records source frames, pivots and asset hashes in `assets/hearthkin-blender-v007/provenance.json`.
