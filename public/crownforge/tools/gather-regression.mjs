import assert from 'node:assert/strict';

import { CrownforgeSimulation } from '../src/simulation.js';

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
  // The current opening meadow does not seed Wildwood. Build the resource
  // fixture explicitly so this checks gathering independently of map art.
  simulation.resourcesNodes=[];simulation.decorations=[];simulation.navigationVersion++;
  const wildwood=simulation.addResource('grove','wood',130,118,2400,0,{sizeTier:'wildwood'});
  simulation.resources.wood=0;

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
  simulation.addBuilding('townCenter', 78, 82, 'player');
  const workers = [
    simulation.addUnit('villager', 105, 94, 'player'),
    simulation.addUnit('villager', 108, 94, 'player'),
    simulation.addUnit('villager', 111, 94, 'player'),
  ];
  [120, 164, 208, 252, 296].forEach((x, index) => {
    simulation.addResource('tree', 'wood', x, 102, 36, index % 4, { sizeTier: 'small' });
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
