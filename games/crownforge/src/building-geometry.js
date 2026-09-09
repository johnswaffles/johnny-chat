import { BUILDING_DEPTH } from './building-depth-data.js?v=20260909-cursedbears1';

export const hasBuildingOutline = building => BUILDING_DEPTH[typeof building === 'string' ? building : building?.type]?.kind === 'solid';
export const buildingActorProfile = unit => ['scout', 'ashenOutrider'].includes(typeof unit === 'string' ? unit : unit?.type) ? 'mounted' : 'foot';

export function buildingPolygon(building, profile = 'material') {
  const data = BUILDING_DEPTH[typeof building === 'string' ? building : building?.type];
  if (data?.kind !== 'solid') return null;
  return data.polygons[profile] ?? data.polygons.material;
}

// Authored hulls are immutable. Share their bounds, edges and SAT projections
// across all buildings instead of rebuilding them for every navigation probe.
const geometryCache = new WeakMap();
function polygonGeometry(polygon) {
  let data = geometryCache.get(polygon);
  if (data) return data;
  const edges = [];
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const [x, z] = polygon[i], [bx, bz] = polygon[(i + 1) % polygon.length];
    const dx = bx - x, dz = bz - z, lengthSquared = dx * dx + dz * dz;
    const inverseLength = 1 / Math.sqrt(lengthSquared);
    const nx = dz * inverseLength, nz = -dx * inverseLength;
    let min = Infinity, max = -Infinity;
    for (const p of polygon) {
      const projection = p[0] * dz - p[1] * dx;
      min = Math.min(min, projection); max = Math.max(max, projection);
    }
    edges.push({ x, z, dx, dz, inverseSquared: 1 / lengthSquared, nx, nz, min, max });
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  data = { edges, minX, maxX, minZ, maxZ };
  geometryCache.set(polygon, data);
  return data;
}

export function polygonBounds(polygon, x = 0, z = 0, padding = 0) {
  const bounds = polygonGeometry(polygon);
  return {
    minX: x + bounds.minX - padding,
    maxX: x + bounds.maxX + padding,
    minZ: z + bounds.minZ - padding,
    maxZ: z + bounds.maxZ + padding,
  };
}

export function outlineBounds(building, padding = 0, profile = 'material') {
  const polygon = buildingPolygon(building, profile);
  return polygon ? polygonBounds(polygon, building.x ?? 0, building.z ?? 0, padding) : null;
}

function nearestBoundary(polygon, x, z) {
  let inside = true, bestSquared = Infinity, bestX = 0, bestZ = 0, bestEdge;
  for (const edge of polygonGeometry(polygon).edges) {
    const rx = x - edge.x, rz = z - edge.z;
    if (edge.dx * rz - edge.dz * rx < -1e-8) inside = false;
    const t = Math.max(0, Math.min(1, (rx * edge.dx + rz * edge.dz) * edge.inverseSquared));
    const px = edge.x + t * edge.dx, pz = edge.z + t * edge.dz;
    const distanceSquared = (x - px) ** 2 + (z - pz) ** 2;
    if (distanceSquared < bestSquared) {
      bestSquared = distanceSquared; bestX = px; bestZ = pz; bestEdge = edge;
    }
  }
  return { x: bestX, z: bestZ, nx: bestEdge.nx, nz: bestEdge.nz, distance: Math.sqrt(bestSquared), inside };
}

export function withinOutlineDistance(point, building, radius, profile = 'material') {
  const polygon = buildingPolygon(building, profile);
  if (!polygon || radius <= 0) return false;
  const { minX, maxX, minZ, maxZ } = polygonGeometry(polygon);
  const x = point.x - building.x, z = point.z - building.z;
  if (x < minX - radius || x > maxX + radius || z < minZ - radius || z > maxZ + radius) return false;
  const hit = nearestBoundary(polygon, x, z);
  return hit.inside || hit.distance < radius;
}

export function distanceToOutline(point, building, profile = 'material') {
  const polygon = buildingPolygon(building, profile);
  if (!polygon) return Infinity;
  const hit = nearestBoundary(polygon, point.x - building.x, point.z - building.z);
  return hit.inside ? 0 : hit.distance;
}

export function projectOutsideOutline(point, building, radius = 0, profile = 'foot') {
  const polygon = buildingPolygon(building, profile);
  if (!polygon) return null;
  const x = point.x - building.x, z = point.z - building.z;
  const bounds = polygonGeometry(polygon);
  if (x < bounds.minX - radius || x > bounds.maxX + radius || z < bounds.minZ - radius || z > bounds.maxZ + radius) return null;
  const hit = nearestBoundary(polygon, x, z);
  if (!hit.inside && hit.distance >= radius) return null;
  let nx = hit.nx, nz = hit.nz;
  if (!hit.inside && hit.distance > 1e-7) { nx = (x - hit.x) / hit.distance; nz = (z - hit.z) / hit.distance; }
  return { x: building.x + hit.x + nx * (radius + 0.015), z: building.z + hit.z + nz * (radius + 0.015), nx, nz };
}

// Eight exterior stations share the exact body-aware hull used by navigation.
// The first station faces the foreground, where doors and receiving bays sit.
const approachCache = new Map();
export function outlineApproaches(building, margin = 0.78, unit = null) {
  const profile = buildingActorProfile(unit);
  const polygon = buildingPolygon(building, profile);
  if (!polygon) return null;
  const key = `${building.type}|${profile}|${margin}`;
  const cached = approachCache.get(key);
  if (cached) return cached.map(p => ({x: p.x + building.x, z: p.z + building.z, priority: p.priority}));
  const center = polygon.reduce((a, p) => [a[0] + p[0] / polygon.length, a[1] + p[1] / polygon.length], [0, 0]);
  const directions = [[1,1],[1,0],[0,1],[1,-1],[-1,1],[0,-1],[-1,0],[-1,-1]];
  const points = directions.map(([dx,dz], priority) => {
    const length = Math.hypot(dx,dz); dx /= length; dz /= length;
    let lo = 0, hi = 256;
    for (let step = 0; step < 32; step++) {
      const mid = (lo + hi) / 2;
      const hit = nearestBoundary(polygon, center[0] + dx * mid, center[1] + dz * mid);
      if (hit.inside || hit.distance < margin) lo = mid; else hi = mid;
    }
    return { x: center[0] + dx * hi, z: center[1] + dz * hi, priority };
  });
  approachCache.set(key, points);
  return points.map(p => ({x: p.x + building.x, z: p.z + building.z, priority: p.priority}));
}

export function polygonsOverlap(a, b, padding = 0) {
  for (const polygon of [a, b]) {
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i], q = polygon[(i + 1) % polygon.length];
      const nx = q[1] - p[1], nz = p[0] - q[0];
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (const v of a) { const n = v[0] * nx + v[1] * nz; minA = Math.min(minA,n); maxA = Math.max(maxA,n); }
      for (const v of b) { const n = v[0] * nx + v[1] * nz; minB = Math.min(minB,n); maxB = Math.max(maxB,n); }
      const gap = padding * Math.hypot(nx, nz);
      if (maxA + gap <= minB + 1e-8 || maxB + gap <= minA + 1e-8) return false;
    }
  }
  return true;
}

export function cellIntersectsOutline(cellX, cellZ, building, padding = 0, profile = 'material') {
  const polygon = buildingPolygon(building, profile);
  if (!polygon) return false;
  const data = polygonGeometry(polygon);
  const x = cellX - building.x, z = cellZ - building.z;
  const lowX = x - padding, highX = x + 1 + padding, lowZ = z - padding, highZ = z + 1 + padding;
  // Rectangle axes first, then the cached hull axes. This is the same SAT as
  // polygonsOverlap, without allocating a polygon or re-projecting the hull.
  const boxEpsilon = 1e-8 / (1 + 2 * padding);
  if (data.maxX <= lowX + boxEpsilon || highX <= data.minX + boxEpsilon
    || data.maxZ <= lowZ + boxEpsilon || highZ <= data.minZ + boxEpsilon) return false;
  for (const edge of data.edges) {
    const nx = edge.dz, nz = -edge.dx;
    const min = (nx >= 0 ? lowX : highX) * nx + (nz >= 0 ? lowZ : highZ) * nz;
    const max = (nx >= 0 ? highX : lowX) * nx + (nz >= 0 ? highZ : lowZ) * nz;
    if (edge.max <= min + 1e-8 || max <= edge.min + 1e-8) return false;
  }
  return true;
}

export function translatedOutline(building, profile = 'material') {
  return buildingPolygon(building, profile)?.map(p => [p[0] + building.x, p[1] + building.z]);
}
