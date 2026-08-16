import assert from 'node:assert/strict';

import {
  BUILDING_TYPES,
  COMBAT_ATLASES,
  INITIAL_RESOURCES,
  VILLAGER_ATLASES,
} from '../src/config.js';
import { animationFrame } from '../src/animation.js';
import { CrownforgeSimulation } from '../src/simulation.js';

const STEP_60HZ = 1 / 60;
const STEP_20HZ = 1 / 20;

function advance(simulation, seconds, step = STEP_60HZ) {
  const count = Math.ceil(seconds / step);
  for (let index = 0; index < count; index += 1) simulation.update(step);
}

function insideBuilding(point, building, padding = 0) {
  const width = BUILDING_TYPES[building.type].footprint.width / 2 + padding;
  const height = BUILDING_TYPES[building.type].footprint.height / 2 + padding;
  return Math.abs(point.x - building.x) < width && Math.abs(point.z - building.z) < height;
}

function freshSimulation() {
  return new CrownforgeSimulation();
}

function checkAnimationAtlases() {
  for (const [state, atlasKey] of [
    ['carry_wood', 'carryWoodLoop'],
    ['carry_food', 'carryFoodLoop'],
    ['carry_stone', 'carryStoneLoop'],
    ['carry_supplies', 'carrySuppliesLoop'],
  ]) {
    for (let direction = 0; direction < 4; direction += 1) {
      const frame = animationFrame('villager', state, 0.37, direction);
      assert.equal(frame.atlasKey, atlasKey, `${state} direction ${direction} atlas`);
      assert.ok(frame.column >= 0 && frame.column < 4, `${state} direction ${direction} frame`);
    }
  }
  for (const type of ['soldier', 'raider']) {
    for (const state of ['attack_anticipation', 'attack_contact', 'attack_recovery']) {
      for (let direction = 0; direction < 4; direction += 1) {
        const frame = animationFrame(type, state, 0.22, direction);
        assert.equal(frame.atlasKey, `${type}Attack`, `${type} ${state} atlas`);
        assert.ok(frame.row >= 0 && frame.row < 4, `${type} ${state} direction ${direction}`);
      }
    }
  }
  for (const atlas of Object.values(VILLAGER_ATLASES)) {
    if (atlas?.src) assert.match(atlas.src, /\.png/);
  }
  for (const atlas of Object.values(COMBAT_ATLASES)) {
    assert.match(atlas.src, /\.png/);
  }
}

function checkResetPresentation() {
  const simulation = freshSimulation();
  const villagers = simulation.units.filter((unit) => unit.type === 'villager' && unit.faction === 'player');
  assert.equal(villagers.length, 3, 'reset has three player villagers');
  for (const villager of villagers) {
    for (const building of simulation.buildings.filter((candidate) => candidate.faction === 'player')) {
      assert.equal(insideBuilding(villager, building), false, `villager ${villager.id} is clear of ${building.type}`);
    }
  }
}

function runGathering(step) {
  const simulation = freshSimulation();
  const villager = simulation.units.find((unit) => unit.type === 'villager');
  const tree = simulation.resourcesNodes.find((node) => node.resourceType === 'wood');
  simulation.selectAt({ x: villager.x, z: villager.z });
  const command = simulation.issueContextCommand({ x: tree.x, z: tree.z });
  assert.equal(command.kind, 'gather', `wood command accepted at ${step}Hz`);
  advance(simulation, 20, step);
  return {
    wood: simulation.resources.wood,
    remaining: tree.amount,
    carry: villager.carryAmount,
    command: villager.command,
  };
}

function checkGathering() {
  const at60 = runGathering(STEP_60HZ);
  const at20 = runGathering(STEP_20HZ);
  assert.ok(at60.wood > INITIAL_RESOURCES.wood, '60 Hz gathering deposits wood');
  assert.ok(at60.remaining < 110, '60 Hz gathering consumes the node');
  assert.deepEqual(at20, at60, '20 Hz and 60 Hz gathering converge');

  const simulation = freshSimulation();
  const villager = simulation.units.find((unit) => unit.type === 'villager');
  const tree = simulation.resourcesNodes.find((node) => node.resourceType === 'wood');
  simulation.selectAt({ x: villager.x, z: villager.z });
  simulation.issueContextCommand({ x: tree.x, z: tree.z });
  advance(simulation, 5.2);
  assert.ok(villager.carryAmount > 0, 'retask scenario reaches carried cargo');
  const cargoBeforeRetask = villager.carryAmount;
  simulation.issueContextCommand({ x: 20, z: 18 });
  assert.equal(villager.carryAmount, cargoBeforeRetask, 'retasking preserves cargo');
  assert.equal(villager.command, 'return', 'retasking cargo sends worker to storage first');
}

function checkConstructionAndPlacement() {
  const simulation = freshSimulation();
  const townCenter = simulation.buildings.find((building) => building.type === 'townCenter');
  assert.ok(townCenter, 'reset has a Crown Hall');
  assert.equal(simulation.getPlacementCheck('house', { x: townCenter.x, z: townCenter.z }).valid, false, 'building overlap rejected');
  const tree = simulation.resourcesNodes.find((node) => node.resourceType === 'wood');
  assert.equal(simulation.getPlacementCheck('house', { x: tree.x, z: tree.z }).valid, false, 'resource overlap rejected');

  let placement = null;
  for (let x = 3; x <= 25 && !placement; x += 1) {
    for (let z = 3; z <= 19 && !placement; z += 1) {
      const check = simulation.getPlacementCheck('house', { x, z });
      if (check.valid) placement = { x, z };
    }
  }
  assert.ok(placement, 'a valid house placement exists');
  assert.equal(simulation.placeHouse(placement), true, 'house foundation placed');
  const house = simulation.buildings.find((building) => building.type === 'house' && building.progress < 1);
  assert.ok(house, 'house starts as a construction site');
  // The workers must first walk to the south approach before construction
  // time starts; leave room for that route in the deterministic check.
  advance(simulation, BUILDING_TYPES.house.buildTime + 22);
  assert.equal(house.progress, 1, 'house completes through construction simulation');
  assert.equal(house.hp, house.maxHp, 'completed house reaches full health');
}

function checkCombatAndEndStates() {
  const simulation = freshSimulation();
  const soldier = simulation.units.find((unit) => unit.type === 'soldier');
  const raider = simulation.addUnit('raider', soldier.x + 2.2, soldier.z, 'enemy');
  simulation.selectAt({ x: soldier.x, z: soldier.z });
  const command = simulation.issueContextCommand({ x: raider.x, z: raider.z });
  assert.equal(command.kind, 'attack', 'Crown Guard accepts melee attack order');
  advance(simulation, 8);
  assert.ok(raider.hp < raider.maxHp || raider.dead, 'melee combat applies damage');

  const deathSimulation = freshSimulation();
  const attacker = deathSimulation.units.find((unit) => unit.type === 'soldier');
  const target = deathSimulation.addUnit('raider', attacker.x + 1.1, attacker.z, 'enemy');
  target.hp = 1;
  deathSimulation.selectAt({ x: attacker.x, z: attacker.z });
  deathSimulation.issueContextCommand({ x: target.x, z: target.z });
  advance(deathSimulation, 5);
  assert.equal(target.dead, true, 'lethal melee hit enters death state');
  advance(deathSimulation, 2.6);
  assert.ok(target.deathAge >= 2.4, 'dead unit remains long enough for death read');

  const victorySimulation = freshSimulation();
  const enemyCore = victorySimulation.buildings.find((building) => building.type === 'ashenCamp');
  victorySimulation._destroyBuilding(enemyCore, victorySimulation.units.find((unit) => unit.type === 'soldier'));
  victorySimulation.update(STEP_60HZ);
  assert.equal(victorySimulation.phase, 'victory', 'enemy core destruction wins');

  const defeatSimulation = freshSimulation();
  const playerCore = defeatSimulation.buildings.find((building) => building.type === 'townCenter');
  defeatSimulation._destroyBuilding(playerCore, defeatSimulation.units.find((unit) => unit.type === 'raider'));
  defeatSimulation.update(STEP_60HZ);
  assert.equal(defeatSimulation.phase, 'defeat', 'player core destruction loses');
}

checkAnimationAtlases();
checkResetPresentation();
checkGathering();
checkConstructionAndPlacement();
checkCombatAndEndStates();

console.log(JSON.stringify({
  status: 'passed',
  checks: [
    'directional carry and attack atlas resolution',
    'reset villager ground/building clearance',
    '20 Hz versus 60 Hz gathering convergence',
    'cargo-preserving retask and storage return',
    'placement rejection and house completion',
    'melee damage, death timing, victory, defeat',
  ],
}));
