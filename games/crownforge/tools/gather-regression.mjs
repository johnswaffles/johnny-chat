import assert from 'node:assert/strict';

// Run against the paired public module because the dirty source checkout has
// intentionally removed its legacy pathfinding helper; public is the shipped
// Render artifact and remains self-contained for this regression.
import { CrownforgeSimulation } from '../../../public/crownforge/src/simulation.js';

const STEP = 1 / 20;

function advance(simulation, seconds) {
  for (let index = 0; index < Math.ceil(seconds / STEP); index += 1) simulation.update(STEP);
}

function quietSimulation() {
  const simulation = new CrownforgeSimulation();
  simulation._checkVictory = () => {};
  simulation._updateEnemyAI = () => {};
  simulation._updateEnemyIntent = () => {};
  return simulation;
}

function checkWildwoodPerimeter() {
  const simulation = quietSimulation();
  const workers = simulation.units.filter((unit) => unit.type === 'villager' && unit.faction === 'player');
  simulation.units = workers;
  const hall = simulation.buildings.find((building) => building.type === 'townCenter' && building.faction === 'player');
  const wildwood = simulation.resourcesNodes
    .filter((node) => node.resourceType === 'wood' && node.sizeTier === 'wildwood')
    .sort((a, b) => Math.hypot(a.x - hall.x, a.z - hall.z) - Math.hypot(b.x - hall.x, b.z - hall.z))[0];
  assert.ok(wildwood, 'sandbox includes a Wildwood stand');

  simulation.setUnitSpeedScale(10);
  simulation.setHarvestSpeedScale(10);
  simulation.selectedIds = workers.map((unit) => unit.id);
  const order = simulation.issueContextCommand(wildwood, wildwood);
  assert.equal(order.success, true, 'workers accept a Wildwood order');
  advance(simulation, 600);

  assert.equal(wildwood.amount, 0, 'workers can finish the large Wildwood stand');
  assert.ok(simulation.resources.wood > 2000, 'completed gathering deposits wood at the Crown Hall');
  assert.ok(workers.every((unit) => !unit.pathBlocked && unit.stuckTimer < 1), 'workers do not remain stuck at the grove perimeter');
}

function checkUnboundedForestChain() {
  const simulation = quietSimulation();
  simulation.units = [];
  simulation.buildings = [];
  simulation.resourcesNodes = [];
  simulation.decorations = [];
  simulation.addBuilding('townCenter', 20, 82, 'player');
  const workers = [
    simulation.addUnit('villager', 25, 74, 'player'),
    simulation.addUnit('villager', 28, 74, 'player'),
    simulation.addUnit('villager', 31, 74, 'player'),
  ];
  [36, 80, 124, 168, 212].forEach((x, index) => {
    simulation.addResource('tree', 'wood', x, 82, 36, index % 4, { sizeTier: 'small' });
  });
  simulation.resources.wood = 0;
  simulation.setUnitSpeedScale(10);
  simulation.setHarvestSpeedScale(10);
  simulation.selectedIds = workers.map((unit) => unit.id);
  const order = simulation.issueContextCommand(simulation.resourcesNodes[0], simulation.resourcesNodes[0]);
  assert.equal(order.success, true, 'workers accept a forest-chain order');
  advance(simulation, 180);

  assert.ok(simulation.resourcesNodes.every((node) => node.amount === 0), 'workers continue beyond the old local fallback radius');
  assert.equal(simulation.resources.wood, 180, 'every forest stand is deposited');
}

checkWildwoodPerimeter();
checkUnboundedForestChain();
console.log('gather-regression: passed');
