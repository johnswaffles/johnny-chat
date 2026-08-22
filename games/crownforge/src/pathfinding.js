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
// The board is intentionally much larger than the original vertical slice.
// Keep the route search bounded so a bad or sealed-off query can never lock
// the browser's main thread indefinitely.
const MAX_SEARCH_NODES = 60000;
const MAX_SMOOTH_LOOKAHEAD = 48;

// This is the admissible octile distance for the 8-way movement costs above.
// It gives A* a much stronger directional signal than Euclidean distance on
// long diagonal routes across the expanded meadow.
const heuristic = (a, b) => {
  const dx = Math.abs(a.x - b.x);
  const dz = Math.abs(a.z - b.z);
  return Math.max(dx, dz) + (1.42 - 1) * Math.min(dx, dz);
};

class MinHeap {
  constructor(compare) {
    this.items = [];
    this.compare = compare;
  }

  get length() {
    return this.items.length;
  }

  push(item) {
    const items = this.items;
    items.push(item);
    let index = items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(items[parent], items[index]) <= 0) break;
      [items[parent], items[index]] = [items[index], items[parent]];
      index = parent;
    }
  }

  pop() {
    const items = this.items;
    if (!items.length) return null;
    const first = items[0];
    const last = items.pop();
    if (items.length && last) {
      items[0] = last;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < items.length && this.compare(items[left], items[smallest]) < 0) smallest = left;
        if (right < items.length && this.compare(items[right], items[smallest]) < 0) smallest = right;
        if (smallest === index) break;
        [items[index], items[smallest]] = [items[smallest], items[index]];
        index = smallest;
      }
    }
    return first;
  }
}

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
    // Long routes across the expanded map can contain hundreds of grid
    // points. A full quadratic visibility pass makes each route more
    // expensive than the A* search itself, especially when the caller uses
    // a precise continuous collision test. A bounded greedy lookahead keeps
    // the route readable while guaranteeing predictable work.
    const lookaheadEnd = Math.min(path.length, anchor + MAX_SMOOTH_LOOKAHEAD);
    for (let candidate = anchor + 2; candidate < lookaheadEnd; candidate += 1) {
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
  const blockedCache = new Map();
  const isCellBlocked = (x, z) => {
    const key = keyFor(x, z);
    if (blockedCache.has(key)) return blockedCache.get(key);
    const blocked = isBlocked(x, z);
    blockedCache.set(key, blocked);
    return blocked;
  };
  const endCell = nearestWalkable({
    x: Math.max(0, Math.min(width - 1, Math.round(target.x))),
    z: Math.max(0, Math.min(height - 1, Math.round(target.z))),
  }, isCellBlocked, width, height);

  const compareNodes = (a, b) => a.f - b.f || a.h - b.h || b.g - a.g;
  const open = new MinHeap(compareNodes);
  const startHeuristic = heuristic(startCell, endCell);
  open.push({ x: startCell.x, z: startCell.z, g: 0, h: startHeuristic, f: startHeuristic });
  const cameFrom = new Map();
  const gScore = new Map([[keyFor(startCell.x, startCell.z), 0]]);
  const closed = new Set();
  let expandedNodes = 0;

  while (open.length) {
    const current = open.pop();
    if (!current) break;
    const currentKey = keyFor(current.x, current.z);
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);
    expandedNodes += 1;
    if (expandedNodes > MAX_SEARCH_NODES) return [];
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
    for (const [dx, dz, moveCost] of DIRECTIONS) {
      const nx = current.x + dx;
      const nz = current.z + dz;
      if (nx < 0 || nz < 0 || nx >= width || nz >= height) continue;
      if (isCellBlocked(nx, nz)) continue;
      if (dx !== 0 && dz !== 0 && (isCellBlocked(current.x + dx, current.z) || isCellBlocked(current.x, current.z + dz))) continue;
      const neighborKey = keyFor(nx, nz);
      const tentativeG = current.g + moveCost;
      if (tentativeG >= (gScore.get(neighborKey) ?? Infinity)) continue;
      cameFrom.set(neighborKey, currentKey);
      gScore.set(neighborKey, tentativeG);
      const h = heuristic({ x: nx, z: nz }, endCell);
      open.push({ x: nx, z: nz, g: tentativeG, h, f: tentativeG + h });
    }
  }

  return [];
}
