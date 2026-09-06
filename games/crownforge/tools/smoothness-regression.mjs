import assert from 'node:assert/strict';
import { CrownforgeSimulation } from '../src/simulation.js';
import { BUILDING_DEPTH } from '../src/building-depth-data.js';
import { findPath } from '../src/pathfinding.js';
import { buildingPolygon, cellIntersectsOutline, distanceToOutline, outlineBounds, polygonsOverlap, withinOutlineDistance } from '../src/building-geometry.js';

// The fast box/hull test must agree with general SAT, including near corners.
let geometryChecks = 0;
for (const [type, data] of Object.entries(BUILDING_DEPTH)) {
  if (data.kind !== 'solid') continue;
  for (const profile of ['material', 'foot', 'mounted']) {
    const building = { type, x: 123.123, z: 124.456 };
    const bounds = outlineBounds(building, 3, profile);
    for (let x = bounds.minX; x < bounds.maxX; x += 2.37) {
      for (let z = bounds.minZ; z < bounds.maxZ; z += 2.71) {
        for (const radius of [0, 0.38, 0.82]) {
          const point = { x, z }, cx = Math.floor(x), cz = Math.floor(z);
          assert.equal(withinOutlineDistance(point, building, radius, profile), distanceToOutline(point, building, profile) < radius);
          const rx = cx - building.x, rz = cz - building.z;
          const box = [[rx-radius,rz-radius],[rx+1+radius,rz-radius],[rx+1+radius,rz+1+radius],[rx-radius,rz+1+radius]];
          assert.equal(cellIntersectsOutline(cx, cz, building, radius, profile), polygonsOverlap(buildingPolygon(building, profile), box), `${type}/${profile}: corner collision`);
          geometryChecks++;
        }
      }
    }
  }
}

// Prefer clear/cached stations, retaining score and reservation tie-breaking.
// When every direct approach is blocked, try detours in entrance/proximity order.
for (let scenario = 0; scenario < 100; scenario++) {
  const unit = { x: 0, z: 0 };
  const points = Array.from({ length: 8 }, (_, index) => ({ x: (index * 7 + scenario) % 23, z: index % 3, slot: 7-index, priority: (index+scenario) % 4 }));
  const paths = points.map((point, i) => (i+scenario) % 5 === 0 ? null : Array.from({length:(i+scenario)%6}, () => point));
  const mock = { _buildPath: (_unit, point, _placement, options) => {
    const i = points.indexOf(point);
    return options?.directOnly && (i+scenario)%2 ? null : paths[i];
  } };
  let expected = null;
  points.forEach((point, i) => {
    if (!paths[i] || (i+scenario)%2) return;
    const score = paths[i].length * 1.1 + Math.hypot(point.x,point.z)*0.2 + point.priority*0.7;
    if (!expected || score < expected.score) expected = { slot:point.slot, score };
  });
  if (!expected) {
    const reachable = points.map((point,i) => ({point,i,minimum:Math.hypot(point.x,point.z)*.2+point.priority*.7})).filter(({i}) => paths[i]).sort((a,b)=>a.minimum-b.minimum||a.i-b.i);
    if (reachable.length) expected = {slot:reachable[0].point.slot};
  }
  const actual = CrownforgeSimulation.prototype._bestPathToPoints.call(mock, unit, points);
  assert.equal(actual?.slot, expected?.slot, `route score scenario ${scenario}`);
}
let expensiveSearches = 0;
const directMock = { _buildPath: (_unit, point, _placement, options) => {
  if (point.x === 1) return [point];
  if (!options?.directOnly) expensiveSearches++;
  return null;
} };
assert.equal(CrownforgeSimulation.prototype._bestPathToPoints.call(directMock, {x:0,z:0}, [{x:1,z:0},{x:100,z:0}]).slot, 0);
assert.equal(expensiveSearches, 0, 'a clear near station must not search an irrelevant blocked far side');

let pocketProbes = 0;
const sealed = findPath({x:2,z:2}, {x:72,z:72}, (x,z) => {
  pocketProbes++;
  return x >= 71 && x <= 73 && z >= 71 && z <= 73 && (x !== 72 || z !== 72);
}, 150, 150);
assert.deepEqual(sealed, [], 'enclosed station remains unreachable');
assert(pocketProbes < 100, 'an isolated destination must not search the whole map');
const detour = findPath({x:20,z:20}, {x:40,z:20}, (x,z) => x === 30 && z < 80, 100, 100);
assert(detour.length && detour.some(p => p.z >= 80), 'large connected regions retain long valid detours');

// Full production woodland: three workers must still build, chop and deliver.
const simulation = new CrownforgeSimulation({ seed: 42 });
const workers = simulation.units.filter(u => u.type === 'villager' && u.faction === 'player');
simulation.selectedIds = workers.map(u => u.id); simulation._syncSelectionFlags();
const site = { x:125, z:105 };
const before = simulation._staticBlockerCandidates(site);
const start = performance.now();
assert(simulation.placeBuilding('timberYard', site), 'valid foundation is placed');
const placementMs = performance.now() - start;
const yard = simulation.buildings.find(b => b.type === 'timberYard' && b.faction === 'player');
assert(!before.includes(yard));
assert(simulation._staticBlockerCandidates(site).includes(yard), 'new foundation invalidates cached blockers');
const durations = [];
for (let i = 0; i < 7000; i++) {
  const t = performance.now(); simulation.update(.05); durations.push(performance.now()-t);
}
assert.equal(yard.progress, 1, 'workers completed the construction');
assert(simulation.lifetimeGathered.wood >= 36, 'builders continue gathering and depositing wood');
assert(workers.every(u => !u.dead));
for (let x = 0; x < 1000; x++) simulation._staticBlockerCandidates({ x:x*8, z:x*8 });
assert(simulation.staticBlockerQueryCache.size <= 512, 'spatial query cache stays bounded');
durations.sort((a,b)=>a-b);
console.log(JSON.stringify({test:'smoothness-regression',geometryChecks,routeScenarios:101,entities:simulation.getEntityCount(),placementMs,simulationP99:durations[Math.floor(durations.length*.99)],simulationMax:durations.at(-1),gatheredWood:simulation.lifetimeGathered.wood}));
