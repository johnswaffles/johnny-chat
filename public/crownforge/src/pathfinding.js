const DIRECTIONS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, 1.42],
  [-1, 1, 1.42],
  [1, -1, 1.42],
  [-1, -1, 1.42],
];

const keyFor = (x, z) => `${x},${z}`;
const heuristic = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function nearestWalkable(target, isBlocked, width, height) {
  if (!isBlocked(target.x, target.z)) return target;
  for (let radius = 1; radius < 8; radius += 1) {
    for (let x = target.x - radius; x <= target.x + radius; x += 1) {
      for (let z = target.z - radius; z <= target.z + radius; z += 1) {
        if (x < 0 || z < 0 || x >= width || z >= height) continue;
        if (!isBlocked(x, z)) return { x, z };
      }
    }
  }
  return target;
}

function segmentIsClear(start, end, isBlocked) {
  const span = Math.max(Math.abs(end.x - start.x), Math.abs(end.z - start.z));
  const steps = Math.max(1, Math.ceil(span * 8));
  for (let index = 1; index <= steps; index += 1) {
    const ratio = index / steps;
    const x = start.x + (end.x - start.x) * ratio;
    const z = start.z + (end.z - start.z) * ratio;
    const cellX = Math.floor(x);
    const cellZ = Math.floor(z);
    if (isBlocked(cellX, cellZ)) return false;
    if (index > 1) {
      const previousRatio = (index - 1) / steps;
      const previousX = Math.floor(start.x + (end.x - start.x) * previousRatio);
      const previousZ = Math.floor(start.z + (end.z - start.z) * previousRatio);
      if (previousX !== cellX && previousZ !== cellZ && (isBlocked(previousX, cellZ) || isBlocked(cellX, previousZ))) return false;
    }
  }
  return true;
}

function smoothPath(path, isBlocked, segmentClear = segmentIsClear) {
  if (path.length < 3) return path;
  const smoothed = [];
  let anchor = 0;
  while (anchor < path.length) {
    let furthest = anchor + 1;
    for (let candidate = anchor + 2; candidate < path.length; candidate += 1) {
      if (segmentClear(path[anchor], path[candidate], isBlocked)) furthest = candidate;
      else break;
    }
    smoothed.push(path[anchor]);
    anchor = furthest;
  }
  if (smoothed[smoothed.length - 1] !== path[path.length - 1]) smoothed.push(path[path.length - 1]);
  return smoothed;
}

export function findPath(start, target, isBlocked, width, height, options = {}) {
  const startCell = {
    x: Math.max(0, Math.min(width - 1, Math.round(start.x))),
    z: Math.max(0, Math.min(height - 1, Math.round(start.z))),
  };
  const endCell = nearestWalkable({
    x: Math.max(0, Math.min(width - 1, Math.round(target.x))),
    z: Math.max(0, Math.min(height - 1, Math.round(target.z))),
  }, isBlocked, width, height);

  const open = [{ x: startCell.x, z: startCell.z, g: 0, f: 0 }];
  const cameFrom = new Map();
  const gScore = new Map([[keyFor(startCell.x, startCell.z), 0]]);
  const closed = new Set();

  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift();
    const currentKey = keyFor(current.x, current.z);
    if (current.x === endCell.x && current.z === endCell.z) {
      const path = [];
      let cursor = currentKey;
      while (cursor !== keyFor(startCell.x, startCell.z)) {
        const [x, z] = cursor.split(',').map(Number);
        path.unshift({ x: x + 0.5, z: z + 0.5 });
        cursor = cameFrom.get(cursor);
        if (!cursor) break;
      }
      return smoothPath(path, isBlocked, options.segmentClear ?? segmentIsClear);
    }
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);

    for (const [dx, dz, moveCost] of DIRECTIONS) {
      const nx = current.x + dx;
      const nz = current.z + dz;
      if (nx < 0 || nz < 0 || nx >= width || nz >= height) continue;
      if (isBlocked(nx, nz)) continue;
      if (dx !== 0 && dz !== 0 && (isBlocked(current.x + dx, current.z) || isBlocked(current.x, current.z + dz))) continue;
      const neighborKey = keyFor(nx, nz);
      const tentativeG = current.g + moveCost;
      if (tentativeG >= (gScore.get(neighborKey) ?? Infinity)) continue;
      cameFrom.set(neighborKey, currentKey);
      gScore.set(neighborKey, tentativeG);
      open.push({ x: nx, z: nz, g: tentativeG, f: tentativeG + heuristic({ x: nx, z: nz }, endCell) });
    }
  }

  return [];
}
