import assert from 'node:assert/strict';
import { CrownforgeSimulation, resourceFootprint } from '../src/simulation.js';
import { CONFIG } from '../src/config.js';
import { treeAppearance, woodlandRidgeZ } from '../src/landscape-layout.js';
import { TREE_SPRITES } from '../src/landscape.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const wood = game => game.resourcesNodes.filter(node => node.resourceType === 'wood');
const seeds = [1, 42, 12345, 0xc0ffee31, 0xffffffff];
for (const seed of seeds) {
  const game = new CrownforgeSimulation({ seed });
  const trees = wood(game);
  assert.ok(trees.length > 1400 && trees.length < 3600, 'forest stays within population/performance budget');
  assert.equal(new Set(trees.map(node => `${node.x},${node.z}`)).size, trees.length, 'no duplicate trunks');
  for (const node of trees) {
    assert.ok(node.x >= 0 && node.z >= 0 && node.x <= CONFIG.mapWidth && node.z <= CONFIG.mapHeight);
    assert.equal(game._insideWildwoodClearing(node.x, node.z, 1.99), false, 'opening and regional clearings stay open');
    assert.equal(node.amount, 240, 'individual harvesting contract retained');
    const visual = treeAppearance(node);
    assert.ok(TREE_SPRITES[visual.species] && visual.width > 100 && visual.width < 350);
  }
  assert.equal(new Set(trees.map(node => treeAppearance(node).species)).size, 8, 'eight authored species appear in each tested world');
  const ridge = trees.filter(node => node.forestClusterId === 'livingwood-ridge');
  assert.ok(ridge[0].x <= resourceFootprint(ridge[0]), 'ridge closes west boundary');
  assert.ok(ridge.at(-1).z <= resourceFootprint(ridge.at(-1)), 'ridge closes north boundary');
  for (let i = 1; i < ridge.length; i++) {
    assert.ok(distance(ridge[i], ridge[i - 1]) < resourceFootprint(ridge[i]) + resourceFootprint(ridge[i - 1]), 'harvestable ridge has no accidental gaps');
  }
  const twin = new CrownforgeSimulation({ seed });
  assert.deepEqual(game.serialize(), twin.serialize(), 'seed reproduces the complete starting match');
  console.log(`Seed ${seed}: ${trees.length} trees, eight species, continuous ridge, protected clearings.`);
}

const game = new CrownforgeSimulation({ seed: 42 });
const worker = game.units.find(unit => unit.type === 'villager' && unit.faction === 'player');
assert.equal(game._buildPath(worker, { x: 498, z: 430 }), null, 'opposite faction remains separated by woodland');
const center = { x: 100, z: woodlandRidgeZ(100) };
for (const node of wood(game)) if (distance(node, center) < 29) { node.amount = 0; node.depleted = true; }
game.navigationVersion++; game.staticBlockerGridVersion = -1;
worker.x = center.x - 12; worker.z = center.z - 12;
assert.ok(game._buildPath(worker, { x: center.x + 12, z: center.z + 12 })?.length, 'clearing trees opens a traversable route');

for (const resourceType of ['food', 'wood']) {
  const match = new CrownforgeSimulation({ seed: 42 });
  const workers = match.units.filter(unit => unit.type === 'villager' && unit.faction === 'player');
  match.selectedIds = workers.map(unit => unit.id);
  const target = match.resourcesNodes.filter(node => node.resourceType === resourceType)
    .sort((a, b) => distance(a, workers[0]) - distance(b, workers[0]))[0];
  const before = target.amount;
  assert.equal(match.issueContextCommand(target, target).success, true);
  for (let i = 0; i < 7200; i++) match.update(1 / 20);
  assert.ok(target.amount < before, `${resourceType}: workers reach and harvest the resource`);
  assert.ok(match.lifetimeGathered[resourceType] > 0, `${resourceType}: workers deliver resources to storage`);
  const saved = match.serialize();
  const restored = new CrownforgeSimulation({ seed: 91 });
  assert.equal(restored.loadSnapshot(saved), true);
  assert.deepEqual(restored.serialize().resourcesNodes, saved.resourcesNodes, 'save/load preserves positions, depletion and reservations');
  assert.deepEqual(restored.resources, match.resources);
  console.log(`${resourceType}: harvested and delivered; save/load retained the landscape.`);
}
console.log('PASS: Livingwood generation, species, ridge navigation, harvesting and save/load.');
