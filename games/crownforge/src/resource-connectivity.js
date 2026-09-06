// Resource footprints alone form a conservative map of connected clearings.
// Buildings are absent: matching regions still need a precise route search,
// but different regions cannot be joined by that search.
export class ResourceConnectivity {
  constructor(width, height, nodes, footprint) {
    this.width = width;
    this.height = height;
    const regions = this.regions = new Int32Array(width * height);
    for (const node of nodes) {
      if (node.amount <= 0) continue;
      const radius = footprint(node), radiusSquared = radius * radius;
      const minX = Math.max(0, Math.floor(node.x - radius));
      const maxX = Math.min(width - 1, Math.floor(node.x + radius));
      const minZ = Math.max(0, Math.floor(node.z - radius));
      const maxZ = Math.min(height - 1, Math.floor(node.z + radius));
      for (let z = minZ; z <= maxZ; z++) {
        const dz = Math.max(z - node.z, 0, node.z - z - 1);
        for (let x = minX; x <= maxX; x++) {
          const dx = Math.max(x - node.x, 0, node.x - x - 1);
          if (dx * dx + dz * dz < radiusSquared) regions[z * width + x] = -1;
        }
      }
    }
    const queue = new Int32Array(regions.length);
    let region = 0;
    for (let seed = 0; seed < regions.length; seed++) {
      if (regions[seed]) continue;
      region++;
      let head = 0, tail = 1;
      queue[0] = seed; regions[seed] = region;
      while (head < tail) {
        const cell = queue[head++], x = cell % width;
        // Four-way regions also describe eight-way movement when diagonal
        // corner cutting is forbidden.
        for (let direction = 0; direction < 4; direction++) {
          if ((direction === 0 && x === 0) || (direction === 1 && x === width - 1)) continue;
          const next = cell + (direction === 0 ? -1 : direction === 1 ? 1 : direction === 2 ? -width : width);
          if (next < 0 || next >= regions.length || regions[next]) continue;
          regions[next] = region; queue[tail++] = next;
        }
      }
    }
  }

  endpointRegions(point) {
    const { width, height, regions } = this;
    const id = point.z * width + point.x;
    if (regions[id] > 0) return [regions[id]];
    // Exact gathering endpoints can be allowed in a blocked perimeter cell;
    // a unit may also leave an occupied start. Include adjacent clearings so
    // neither exception can be falsely rejected by this shortcut.
    const result = [];
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const x = point.x + dx, z = point.z + dz;
      if (x < 0 || z < 0 || x >= width || z >= height) continue;
      const label = regions[z * width + x];
      if (label > 0) result.push(label);
    }
    return result;
  }

  connected(start, end) {
    if (Math.abs(start.x - end.x) + Math.abs(start.z - end.z) <= 1) return true;
    const destinations = this.endpointRegions(end);
    return this.endpointRegions(start).some(region => destinations.includes(region));
  }
}
