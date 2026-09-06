import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ResourceConnectivity } from '../src/resource-connectivity.js';
import { findPath } from '../src/pathfinding.js';
import { CrownforgeSimulation } from '../src/simulation.js';
import { CrownforgeLandscape, TREE_SPRITES } from '../src/landscape.js';
import { CrownforgeRenderer } from '../src/renderer.js';
import { treeAppearance, woodlandHabitat, landscapeHash } from '../src/landscape-layout.js';

// Real art has alpha, sufficient source resolution, and in-bounds cutouts.
const png = readFileSync(new URL('../assets/crownforge-greatwood-conifers-v1.png', import.meta.url));
assert.equal(png[25], 6, 'new conifers are RGBA, with no painted backdrop');
for (const { rect: [x,y,w,h] } of TREE_SPRITES.filter(sprite => sprite.sheet === 2)) {
  assert(w > 300 && h > 500 && x >= 0 && y >= 0);
  assert(x + w <= png.readUInt32BE(16) && y + h <= png.readUInt32BE(20));
}

// Nearby trees belong to coherent stands, with dominant species in interiors.
const families = [[2,8,9], [3,10,11], [0,4], [1,6]];
let neighbors = 0, sameStand = 0, interiors = 0, dominant = 0;
for (let x = 10; x < 550; x += 7) for (let z = 10; z < 450; z += 7) {
  const habitat = woodlandHabitat(x, z, 42);
  neighbors++;
  if (habitat.group === woodlandHabitat(x + 5, z + 2, 42).group) sameStand++;
  if (habitat.interior > .85) {
    interiors++;
    if (families[habitat.group].includes(treeAppearance({x,z,forestSeed:42}).species)) dominant++;
  }
}
assert(sameStand / neighbors > .9, 'nearby trees share a woodland habitat');
assert(dominant / interiors > .93, 'deep stands are dominated by related trees');

// Compare the shortcut to independent flood-fill reachability on varied maps.
let comparisons = 0;
for (let seed = 1; seed <= 12; seed++) {
  const nodes = [];
  for (let x = 2; x < 39; x += 3) for (let z = 2; z < 39; z += 3) {
    if (landscapeHash(x,z,seed) > .38) nodes.push({x:x+.3,z:z+.6,amount:1});
  }
  const topology = new ResourceConnectivity(42,42,nodes,()=>1.6);
  const blocked = (x,z) => nodes.some(n => Math.hypot(Math.max(x-n.x,0,n.x-x-1), Math.max(z-n.z,0,n.z-z-1)) < 1.6);
  for (let i = 0; i < 80; i++) {
    const start = {x:(i*7+seed)%42,z:(i*13+3)%42};
    const end = {x:(i*17+9)%42,z:(i*5+seed)%42};
    if (blocked(start.x,start.z) || blocked(end.x,end.z)) continue;
    const seen = new Set([start.z*42+start.x]), queue = [start];
    for (let head = 0; head < queue.length; head++) {
      const p = queue[head];
      for (const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const x=p.x+dx,z=p.z+dz,id=z*42+x;
        if (x<0 || z<0 || x>=42 || z>=42 || seen.has(id) || blocked(x,z)) continue;
        seen.add(id); queue.push({x,z});
      }
    }
    assert.equal(topology.connected(start,end),seen.has(end.z*42+end.x));
    comparisons++;
  }
}

const barrier = Array.from({length:100},(_,z)=>({x:100,z,amount:1}));
const topology = new ResourceConnectivity(200,100,barrier,()=>2);
let probes = 0;
const blocked = (x,z) => { probes++; return x >= 98 && x < 102; };
assert.deepEqual(findPath({x:10,z:50},{x:190,z:50},blocked,200,100,{connected:(a,b)=>topology.connected(a,b)}),[]);
assert(probes < 10, 'a whole disconnected kingdom is rejected before A* expands');
assert(topology.connected({x:97,z:50},{x:98,z:50}), 'perimeter endpoint exception is retained');
assert(topology.connected({x:101,z:50},{x:110,z:50}), 'blocked start can leave toward an adjacent clearing');

// Depletion changes only nearby floor contributions; compare to a full bake.
globalThis.document = { createElement: () => ({ getContext: () => ({
  createImageData: (w,h) => ({data:new Uint8ClampedArray(w*h*4)}), putImageData() {},
}) }) };
const trees = Array.from({length:40},(_,i)=>({id:i,type:'tree',x:80+i%8*4.3,z:90+Math.floor(i/8)*4.6,forestSeed:42}));
const incremental = {}, fresh = {};
CrownforgeLandscape.prototype.prepareWoodland.call(incremental,trees);
CrownforgeLandscape.prototype.prepareWoodland.call(incremental,trees.slice(13));
CrownforgeLandscape.prototype.prepareWoodland.call(fresh,trees.slice(13));
for (const key of ['woodlandFloor','coniferFloor','forestCoverage']) {
  assert(incremental[key].every((n,i)=>Math.abs(n-fresh[key][i])<2e-6), `${key} equals a fresh bake after felling`);
}
CrownforgeLandscape.prototype.prepareWoodland.call(incremental,[]);
assert(incremental.forestCoverage.every(n=>n<2e-6), 'cleared ground has no remaining canopy floor');

const renderer = {camera:{x:0,y:0,zoom:1},width:800,height:600,isWorldVisible:n=>n.x<100,entityCullRadius:()=>29};
const scene = {navigationVersion:0,resourcesNodes:[{id:1,type:'tree',resourceType:'wood',amount:240,x:20,z:20}]};
const entries = () => CrownforgeRenderer.prototype.visibleResourceEntries.call(renderer,scene);
const first = entries(); assert.equal(entries(),first);
scene.resourcesNodes[0].amount=120;
assert.equal(entries()[0].resource.amount,120,'cached wrappers retain live resource amounts');
scene.resourcesNodes[0].amount=0; scene.navigationVersion++;
assert.equal(entries().length,0,'felled trees leave the render list');
scene.resourcesNodes=[{id:2,type:'tree',resourceType:'wood',amount:240,x:25,z:20}];
assert.equal(entries()[0].id,2,'loading a different resource array invalidates the cache');
const prior=entries(); renderer.camera.x++; assert.notEqual(entries(),prior);

// A real pre-release save can be supplied without storing a bulky fixture.
if (process.argv[2]) {
  const old = JSON.parse(readFileSync(process.argv[2],'utf8'));
  const restored = new CrownforgeSimulation({seed:99});
  assert(restored.loadSnapshot(old));
  assert.deepEqual(restored.serialize().resourcesNodes,old.resourcesNodes,'old tree positions and harvested resources stay untouched');
  assert.deepEqual(restored.serialize().buildings,old.buildings,'old buildings stay untouched');
}
console.log(JSON.stringify({test:'greatwood-regression',connectivityComparisons:comparisons,neighborAgreement:sameStand/neighbors,interiorDominance:dominant/interiors,disconnectedProbes:probes,oldSaveChecked:Boolean(process.argv[2])}));
