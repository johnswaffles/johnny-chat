// Shared, deterministic landscape fields. Rendering never consumes the match RNG.
export const clamp01 = value => Math.max(0, Math.min(1, value));
export function landscapeHash(x, z, seed = 0) {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ (seed | 0);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function landscapeNoise(x, z, seed = 0) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const dx = x - ix, dz = z - iz;
  const u = dx * dx * (3 - 2 * dx), v = dz * dz * (3 - 2 * dz);
  const a = landscapeHash(ix, iz, seed), b = landscapeHash(ix + 1, iz, seed);
  const c = landscapeHash(ix, iz + 1, seed), d = landscapeHash(ix + 1, iz + 1, seed);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

// The strategic woodland divide follows a winding ridge. Its central trees
// still form a harvestable barrier, but the surrounding forest has no rows.
export function woodlandRidgeZ(x) {
  return 430 - x + 18 * Math.sin(x * 0.024) + 8 * Math.sin(x * 0.071)
    + 56 * Math.exp(-(((x - 190) / 43) ** 2));
}
export function woodlandDensity(x, z, seed = 0) {
  const broad = landscapeNoise(x / 72, z / 72, seed);
  const edge = landscapeNoise(x / 23 + 11, z / 23 - 7, seed + 17);
  const detail = landscapeNoise(x / 9, z / 9, seed + 81);
  const stands = clamp01((broad * 0.65 + edge * 0.27 + detail * 0.08 - 0.40) * 2.4);
  const width = 26 + landscapeNoise(x / 36, 19, seed) * 36;
  const ridge = x < 440 ? Math.exp(-(((z - woodlandRidgeZ(x)) / width) ** 2)) * (0.56 + edge * 0.64) : 0;
  return Math.max(stands, ridge);
}

export function treeAppearance(node) {
  const x = Math.round(node.x * 31), z = Math.round(node.z * 31);
  // Species form loose ecological neighborhoods, with companions and young
  // trees intermixed. Position-derived appearance also upgrades old saves.
  const habitat = landscapeNoise(node.x / 62, node.z / 62, 507);
  const families = habitat < 0.37 ? [2, 3, 3, 7, 1] : habitat > 0.64 ? [0, 4, 6, 0, 5] : [0, 1, 4, 6, 5];
  const species = families[Math.floor(landscapeHash(x, z, 71) * families.length)];
  const variation = landscapeHash(x, z, 119);
  const widths = [288, 206, 262, 216, 282, 148, 264, 196];
  return { species, width: widths[species] * (0.82 + variation * 0.36) };
}
