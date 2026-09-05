import { BUILDING_DEPTH } from './building-depth-data.js?v=20260905-buildings1';

export const hasBuildingOutline = building => BUILDING_DEPTH[typeof building === 'string' ? building : building?.type]?.kind === 'solid';
export const buildingActorProfile = unit => ['scout', 'ashenOutrider'].includes(typeof unit === 'string' ? unit : unit?.type) ? 'mounted' : 'foot';

export function buildingPolygon(building, profile = 'material') {
  const data = BUILDING_DEPTH[typeof building === 'string' ? building : building?.type];
  if (data?.kind !== 'solid') return null;
  return data.polygons[profile] ?? data.polygons.material;
}

export function polygonBounds(polygon, x = 0, z = 0, padding = 0) {
  return {
    minX: x + Math.min(...polygon.map(p => p[0])) - padding,
    maxX: x + Math.max(...polygon.map(p => p[0])) + padding,
    minZ: z + Math.min(...polygon.map(p => p[1])) - padding,
    maxZ: z + Math.max(...polygon.map(p => p[1])) + padding,
  };
}

export function outlineBounds(building, padding = 0, profile = 'material') {
  const polygon = buildingPolygon(building, profile);
  return polygon ? polygonBounds(polygon, building.x ?? 0, building.z ?? 0, padding) : null;
}

function nearestBoundary(polygon, x, z) {
  let inside = true, best = null;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    if (dx * (z - a[1]) - dz * (x - a[0]) < -1e-8) inside = false;
    const length = Math.hypot(dx, dz);
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (length * length)));
    const px = a[0] + t * dx, pz = a[1] + t * dz;
    const distance = Math.hypot(x - px, z - pz);
    if (!best || distance < best.distance) best = { x: px, z: pz, nx: dz / length, nz: -dx / length, distance };
  }
  return { ...best, inside };
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
  const x = cellX - building.x, z = cellZ - building.z;
  return polygonsOverlap(polygon, [[x-padding,z-padding],[x+1+padding,z-padding],[x+1+padding,z+1+padding],[x-padding,z+1+padding]]);
}

export function translatedOutline(building, profile = 'material') {
  return buildingPolygon(building, profile)?.map(p => [p[0] + building.x, p[1] + building.z]);
}
