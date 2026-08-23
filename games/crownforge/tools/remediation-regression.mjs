import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  BUILDING_TYPES,
  COMBAT_ATLASES,
  CONFIG,
  FIRST_AGE_BUILD_BLUEPRINTS,
  FIRST_AGE_ASSETS,
  GOLD_DEPOSIT_ASSETS,
  INITIAL_RESOURCES,
  PRODUCTION_TYPES,
  RESOURCE_TYPES,
  VILLAGER_ATLASES,
} from '../src/config.js';
import { animationFrame } from '../src/animation.js';
import { CrownforgeRenderer, resolveFirstAgeConstructionStage, resolveWallVisual } from '../src/renderer.js';
import { CrownforgeSimulation } from '../src/simulation.js';
import { summarizeUnitTasks } from '../src/task-summary.js';

const STEP_60HZ = 1 / 60;
const STEP_20HZ = 1 / 20;
const INDEX_HTML = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

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

function movementSandbox() {
  const simulation = freshSimulation();
  simulation.units = [];
  simulation.buildings = [];
  simulation.resourcesNodes = [];
  simulation.decorations = [];
  simulation._checkVictory = () => {};
  simulation._updateEnemyAI = () => {};
  simulation._updateEnemyIntent = () => {};
  return simulation;
}

function checkAnimationAtlases() {
  for (const [state, atlasKey] of [
    ['carry_wood', 'carryWoodLoop'],
    ['carry_food', 'carryFoodLoop'],
    ['carry_stone', 'carryStoneLoop'],
    ['carry_gold', 'carryGoldLoop'],
    ['carry_supplies', 'carrySuppliesLoop'],
  ]) {
    for (let direction = 0; direction < 4; direction += 1) {
      const frame = animationFrame('villager', state, 0.37, direction);
      assert.equal(frame.atlasKey, atlasKey, `${state} direction ${direction} atlas`);
      assert.ok(frame.column >= 0 && frame.column < 4, `${state} direction ${direction} frame`);
    }
  }
  for (const type of ['soldier', 'raider']) {
    for (let direction = 0; direction < 4; direction += 1) {
      const walkFrame = animationFrame(type, 'walk', 0.37, direction);
      assert.equal(walkFrame.atlasKey, `${type}Walk`, `${type} walk atlas`);
      assert.equal(walkFrame.frameCount, 4, `${type} walk uses four authored frames`);
      assert.ok(walkFrame.column >= 0 && walkFrame.column < 4, `${type} walk direction ${direction} frame`);
      assert.equal(walkFrame.fallback, null, `${type} walk does not fall back to idle`);
    }
    for (const state of ['attack_anticipation', 'attack_contact', 'attack_recovery']) {
      for (let direction = 0; direction < 4; direction += 1) {
        const frame = animationFrame(type, state, 0.22, direction);
        assert.equal(frame.atlasKey, `${type}Attack`, `${type} ${state} atlas`);
        assert.ok(frame.row >= 0 && frame.row < 4, `${type} ${state} direction ${direction}`);
      }
    }
    for (let direction = 0; direction < 4; direction += 1) {
      const frame = animationFrame(type, 'hit', 0.11, direction);
      assert.equal(frame.atlasKey, `${type}Hit`, `${type} hit atlas`);
      assert.equal(frame.frameCount, 4, `${type} hit uses four authored recoil frames`);
      assert.ok(frame.column >= 0 && frame.column < 4, `${type} hit direction ${direction} frame`);
      assert.equal(frame.fallback, null, `${type} hit does not fall back to idle`);
      const deathFrame = animationFrame(type, 'death', 0.71, direction);
      assert.equal(deathFrame.atlasKey, `${type}Death`, `${type} death atlas`);
      assert.equal(deathFrame.frameCount, 4, `${type} death uses four authored frames`);
      assert.ok(deathFrame.column >= 0 && deathFrame.column < 4, `${type} death direction ${direction} frame`);
      assert.equal(deathFrame.fallback, null, `${type} death does not fall back to idle`);
    }
  }
  for (let direction = 0; direction < 4; direction += 1) {
    const hitFrame = animationFrame('villager', 'hit', 0.11, direction);
    assert.equal(hitFrame.atlasKey, 'hitLoop', `villager hit atlas direction ${direction}`);
    assert.equal(hitFrame.frameCount, 4, 'villager hit uses four authored recoil frames');
    assert.equal(hitFrame.fallback, null, 'villager hit does not fall back to idle');
    const deathFrame = animationFrame('villager', 'death', 0.71, direction);
    assert.equal(deathFrame.atlasKey, 'deathLoop', `villager death atlas direction ${direction}`);
    assert.equal(deathFrame.frameCount, 4, 'villager death uses four authored frames');
    assert.equal(deathFrame.fallback, null, 'villager death does not fall back to idle');
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
  assert.deepEqual(
    simulation.buildings.filter((building) => building.faction === 'player').map((building) => building.type),
    ['townCenter'],
    'reset begins with the Crown Hall as the only player building',
  );
  assert.deepEqual(FIRST_AGE_BUILD_BLUEPRINTS, ['barracks', 'oreWash', 'field', 'wall'], 'first-age blueprint catalog stays intentionally small');
  assert.deepEqual(
    [...INDEX_HTML.matchAll(/data-build-type="([^"]+)"/g)].map((match) => match[1]),
    FIRST_AGE_BUILD_BLUEPRINTS,
    'visible build menu matches the approved first-age blueprint catalog',
  );
  const storages = simulation.buildings.filter((building) => building.faction === 'player' && BUILDING_TYPES[building.type].storage);
  assert.equal(storages.length, 1, 'Crown Hall is the only opening resource drop-off');
  assert.equal(storages[0].type, 'townCenter', 'opening resource drop-off is the Crown Hall');
  assert.equal(simulation.placeBuilding('house', { x: 40, z: 40 }), false, 'retired Hearth House cannot be placed through the simulation API');
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
    maxAmount: tree.maxAmount,
    carry: villager.carryAmount,
    command: villager.command,
  };
}

function checkGathering() {
  const at60 = runGathering(STEP_60HZ);
  const at20 = runGathering(STEP_20HZ);
  assert.ok(at60.wood > INITIAL_RESOURCES.wood, '60 Hz gathering deposits wood');
  assert.ok(at60.remaining < at60.maxAmount, '60 Hz gathering consumes the node');
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
  const hall = simulation.buildings.find((building) => building.type === 'townCenter');
  assert.equal(villager.returnStorageId, hall.id, 'retasked cargo returns to the Crown Hall');

  for (const resourceType of ['food', 'wood', 'stone', 'gold']) {
    const dropoffSimulation = freshSimulation();
    const worker = dropoffSimulation.units.find((unit) => unit.type === 'villager');
    const crownHall = dropoffSimulation.buildings.find((building) => building.type === 'townCenter');
    const before = dropoffSimulation.resources[resourceType];
    worker.carryType = resourceType;
    worker.carryAmount = 5;
    assert.equal(dropoffSimulation._beginReturn(worker), true, `${resourceType} cargo finds a drop-off route`);
    assert.equal(worker.returnStorageId, crownHall.id, `${resourceType} cargo targets the Crown Hall`);
    advance(dropoffSimulation, 20);
    assert.equal(dropoffSimulation.resources[resourceType], before + 5, `${resourceType} cargo deposits at the Crown Hall`);
  }
}

function checkGoldEconomyLoop() {
  assert.equal(RESOURCE_TYPES.gold.label, 'Gold', 'Gold is registered as a first-class resource');
  assert.equal(INITIAL_RESOURCES.gold, 5000, 'sandbox reset starts with a useful Gold reserve');
  for (const [tier, asset] of Object.entries(GOLD_DEPOSIT_ASSETS)) {
    assert.match(asset.src, /crownforge-gold-deposit-/, `${tier} Gold deposit uses authored Crownforge artwork`);
  }

  const simulation = freshSimulation();
  simulation.setUnitSpeedScale(10);
  const villager = simulation.units.find((unit) => unit.type === 'villager' && unit.faction === 'player');
  const vein = simulation.resourcesNodes.find((node) => node.resourceType === 'gold');
  const hall = simulation.buildings.find((building) => building.type === 'townCenter');
  const before = simulation.resources.gold;
  simulation.selectedIds = [villager.id];
  simulation._syncSelectionFlags();
  const command = simulation.issueContextCommand({ x: vein.x, z: vein.z });
  assert.equal(command.kind, 'gather', 'Gold vein accepts the standard gather command');
  advance(simulation, 20);
  assert.ok(simulation.resources.gold > before, 'Villager deposits gathered Gold');
  assert.ok(vein.amount < vein.maxAmount, 'Gold vein capacity decreases at tool contact');
  assert.equal(villager.gatherTarget, vein.id, 'Villager returns to the Gold vein after depositing');
  assert.equal(villager.returnStorageId === null || villager.returnStorageId === hall.id, true, 'Gold routing uses the Crown Hall');

  const depletion = movementSandbox();
  const depletionHall = depletion.addBuilding('townCenter', 20, 20, 'player');
  const worker = depletion.addUnit('villager', 27, 20, 'player');
  depletion.addResource('gold', 'gold', 33, 20, RESOURCE_TYPES.gold.gatherAmount, 0, { sizeTier: 'small' });
  const smallVein = depletion.resourcesNodes.find((node) => node.resourceType === 'gold');
  depletion.resources.gold = 0;
  depletion.selectedIds = [worker.id];
  depletion._syncSelectionFlags();
  depletion.setUnitSpeedScale(10);
  assert.equal(depletion.issueContextCommand({ x: smallVein.x, z: smallVein.z }).success, true, 'small Gold vein is reachable');
  advance(depletion, 14);
  assert.equal(smallVein.depleted, true, 'exhausted Gold vein enters its depleted visual state');
  assert.equal(smallVein.amount, 0, 'Gold depletion clamps capacity to zero');
  assert.equal(depletion.resources.gold, RESOURCE_TYPES.gold.gatherAmount, 'last Gold load deposits instead of disappearing');
  assert.equal(worker.returnStorageId, null, 'worker releases Crown Hall reservation after final Gold deposit');
  assert.equal(depletionHall.type, 'townCenter', 'depletion scenario uses the Crown Hall drop-off');

  const group = movementSandbox();
  group.addBuilding('townCenter', 20, 20, 'player');
  group.addResource('gold', 'gold', 38, 20, 420, 0, { sizeTier: 'medium' });
  const sharedVein = group.resourcesNodes[0];
  const workers = [[26, 18], [26, 20], [26, 22]].map(([x, z]) => group.addUnit('villager', x, z, 'player'));
  group.selectedIds = workers.map((unit) => unit.id);
  group._syncSelectionFlags();
  assert.equal(group.issueContextCommand({ x: sharedVein.x, z: sharedVein.z }).success, true, 'several villagers can target one Gold vein');
  const slots = new Set(workers.map((unit) => unit.gatherSlot));
  assert.equal(slots.size, workers.length, 'Gold workers reserve distinct interaction slots');
}

function checkOreWashEconomySupport() {
  const blueprint = BUILDING_TYPES.oreWash;
  const asset = FIRST_AGE_ASSETS.oreWash;
  assert.deepEqual(blueprint.acceptsResources, ['gold'], 'Ore Wash accepts only Gold cargo');
  assert.deepEqual(blueprint.gatherBonus, { resourceType: 'gold', radius: 16, multiplier: 1.25 }, 'Ore Wash exposes one non-stacking local Gold bonus');
  assert.match(asset.src, /crownforge-ore-wash-v1\.png/, 'Ore Wash uses its authored first-age asset');
  assert.deepEqual(Object.keys(asset.constructionStages), ['foundation', 'partial', 'nearComplete'], 'Ore Wash exposes the complete three-stage construction family');
  for (const [stage, definition] of Object.entries(asset.constructionStages)) {
    assert.match(definition.src, new RegExp(`crownforge-ore-wash-${stage === 'nearComplete' ? 'near-complete' : stage}-v1\\.png`), `${stage} uses its authored Ore Wash stage`);
    assert.equal(definition.width, asset.width, `${stage} stage preserves completed-asset width`);
    assert.equal(definition.height, asset.height, `${stage} stage preserves completed-asset height`);
  }
  assert.equal(resolveFirstAgeConstructionStage(0.04), 'foundation', 'new Ore Wash foundations resolve to foundation artwork');
  assert.equal(resolveFirstAgeConstructionStage(0.3), 'partial', 'active Ore Wash builds resolve to partial artwork');
  assert.equal(resolveFirstAgeConstructionStage(0.84), 'nearComplete', 'late Ore Wash builds resolve to nearly-complete artwork');
  assert.equal(resolveFirstAgeConstructionStage(1), 'complete', 'finished Ore Wash resolves to completed artwork');
  assert.equal(PRODUCTION_TYPES.soldier.cost.gold, 10, 'Crown Guard equipment gives Gold an immediate first-age use');

  const routing = movementSandbox();
  const hall = routing.addBuilding('townCenter', 20, 20, 'player');
  const wash = routing.addBuilding('oreWash', 34, 20, 'player');
  const goldWorker = routing.addUnit('villager', 29, 20, 'player');
  goldWorker.carryType = 'gold';
  goldWorker.carryAmount = 5;
  assert.equal(routing._beginReturn(goldWorker), true, 'Gold cargo finds a compatible work-site route');
  assert.equal(goldWorker.returnStorageId, wash.id, 'nearby Gold cargo prefers the Ore Wash');

  const woodWorker = routing.addUnit('villager', 29, 22, 'player');
  woodWorker.carryType = 'wood';
  woodWorker.carryAmount = 5;
  assert.equal(routing._beginReturn(woodWorker), true, 'Wood cargo still finds a compatible route');
  assert.equal(woodWorker.returnStorageId, hall.id, 'Ore Wash rejects Wood and leaves the Crown Hall as fallback');

  const bonus = movementSandbox();
  bonus.addBuilding('oreWash', 20, 20, 'player');
  bonus.addResource('gold', 'gold', 28, 20, 100, 0, { sizeTier: 'small' });
  const bonusNode = bonus.resourcesNodes[0];
  const bonusWorker = bonus.addUnit('villager', 29.7, 20, 'player');
  bonusWorker.gatherTarget = bonusNode.id;
  bonusWorker.command = 'gather';
  bonus.resources.gold = 0;
  bonus._updateGathering(bonusWorker, RESOURCE_TYPES.gold.gatherTime);
  assert.equal(bonusWorker.carryAmount, 10, 'nearby Ore Wash raises a completed Gold load from 8 to 10');
  assert.equal(bonusNode.amount, 90, 'boosted Gold load is removed from the vein exactly once');

  const multiWash = movementSandbox();
  const multiWashBuilding = multiWash.addBuilding('oreWash', 20, 20, 'player');
  multiWash.addResource('gold', 'gold', 28, 20, 420, 0, { sizeTier: 'medium' });
  const multiWashNode = multiWash.resourcesNodes[0];
  const multiWashWorkers = [[24, 17], [25, 20], [24, 23]]
    .map(([x, z]) => multiWash.addUnit('villager', x, z, 'player'));
  multiWash.resources.gold = 0;
  multiWash.selectedIds = multiWashWorkers.map((unit) => unit.id);
  multiWash._syncSelectionFlags();
  assert.equal(
    multiWash.issueContextCommand({ x: multiWashNode.x, z: multiWashNode.z }).success,
    true,
    'three Villagers can begin the boosted Gold loop together',
  );
  assert.equal(
    new Set(multiWashWorkers.map((unit) => unit.gatherSlot)).size,
    multiWashWorkers.length,
    'Ore Wash Gold workers reserve distinct mining positions',
  );
  advance(multiWash, 35);
  assert.ok(multiWash.resources.gold >= 30, 'three Villagers complete Gold deposits through the Ore Wash');
  assert.equal(multiWash.resources.gold % 10, 0, 'multi-worker Ore Wash deposits retain exact boosted ten-Gold loads');
  assert.ok(multiWashNode.amount <= 390, 'multi-worker Ore Wash loop removes at least one load per Villager');
  for (const worker of multiWashWorkers) {
    assert.equal(worker.pathBlocked, false, `Ore Wash worker ${worker.id} is not stuck`);
    assert.equal(worker.gatherTarget, multiWashNode.id, `Ore Wash worker ${worker.id} returns to the shared vein`);
    assert.equal(
      worker.returnStorageId === null || worker.returnStorageId === multiWashBuilding.id,
      true,
      `Ore Wash worker ${worker.id} keeps Gold routed to the Ore Wash`,
    );
    assert.equal(insideBuilding(worker, multiWashBuilding), false, `Ore Wash worker ${worker.id} stays outside the work-site footprint`);
  }
  for (let first = 0; first < multiWashWorkers.length; first += 1) {
    for (let second = first + 1; second < multiWashWorkers.length; second += 1) {
      assert.ok(
        Math.hypot(
          multiWashWorkers[first].x - multiWashWorkers[second].x,
          multiWashWorkers[first].z - multiWashWorkers[second].z,
        ) > 0.28,
        'Ore Wash workers retain readable local spacing',
      );
    }
  }

  const production = movementSandbox();
  const barracks = production.addBuilding('barracks', 20, 20, 'player');
  production.selectedIds = [barracks.id];
  production._syncSelectionFlags();
  const goldBefore = production.resources.gold;
  assert.equal(production.queueUnit('soldier').success, true, 'Crown Guard remains trainable through the existing Barracks loop');
  assert.equal(production.resources.gold, goldBefore - PRODUCTION_TYPES.soldier.cost.gold, 'queuing a Crown Guard spends the Gold equipment cost');

  const construction = freshSimulation();
  const openingVein = construction.resourcesNodes.find((node) => node.resourceType === 'gold' && node.x === 111 && node.z === 72);
  let site = null;
  for (let radius = 7; radius <= 14 && !site; radius += 1) {
    for (let step = 0; step < 16; step += 1) {
      const angle = step / 16 * Math.PI * 2;
      const point = { x: openingVein.x + Math.cos(angle) * radius, z: openingVein.z + Math.sin(angle) * radius };
      if (construction.getPlacementCheck('oreWash', point).valid) {
        site = point;
        break;
      }
    }
  }
  assert.ok(site, 'Ore Wash has a valid work-site placement near the opening Gold vein');
  assert.equal(construction.placeBuilding('oreWash', site), true, 'Ore Wash foundation places through the standard construction system');
  const placedWash = construction.buildings.find((building) => building.type === 'oreWash');
  construction.setUnitSpeedScale(10);
  advance(construction, BUILDING_TYPES.oreWash.buildTime + 12);
  assert.equal(placedWash.progress, 1, 'Ore Wash completes through Villager construction');
  assert.ok(Math.hypot(placedWash.x - openingVein.x, placedWash.z - openingVein.z) <= blueprint.gatherBonus.radius, 'completed Ore Wash supports the intended opening vein');
}

function checkIntentAwareVisualTargeting() {
  const renderer = Object.create(CrownforgeRenderer.prototype);
  renderer.width = 1280;
  renderer.height = 720;
  renderer.camera = { x: 0, y: 0, zoom: 0.45 };
  const oreWash = {
    id: 1,
    kind: 'building',
    type: 'oreWash',
    faction: 'player',
    x: 100,
    z: 100,
    hp: BUILDING_TYPES.oreWash.maxHp,
    destroyed: false,
  };
  const gold = {
    id: 2,
    kind: 'resource',
    type: 'gold',
    resourceType: 'gold',
    sizeTier: 'medium',
    x: 103,
    z: 97,
    amount: 420,
  };
  const simulation = {
    units: [],
    buildings: [oreWash],
    resourcesNodes: [gold],
    getEntityAt: () => null,
  };
  const goldScreenPoint = renderer.worldToScreen(gold);
  assert.equal(
    renderer.getEntityAtScreen(simulation, goldScreenPoint, 'select'),
    oreWash,
    'selection keeps the forgiving Ore Wash silhouette hit region',
  );
  assert.equal(
    renderer.getEntityAtScreen(simulation, goldScreenPoint, 'command'),
    gold,
    'gather command prefers a visible Gold vein within the overlapping Ore Wash silhouette',
  );

  const routing = movementSandbox();
  const wash = routing.addBuilding('oreWash', 34, 20, 'player');
  routing.addResource('gold', 'gold', 38, 20, 120, 0, { sizeTier: 'medium' });
  const vein = routing.resourcesNodes[0];
  const worker = routing.addUnit('villager', 27, 20, 'player');
  routing.resources.gold = 0;
  routing.selectedIds = [worker.id];
  routing._syncSelectionFlags();
  const command = routing.issueContextCommand({ x: vein.x, z: vein.z }, vein);
  assert.equal(command.kind, 'gather', 'intent-resolved Gold target starts the gather loop');
  assert.equal(worker.actionLabel, 'Walking to Gold', 'worker task names the resource while approaching');
  routing.setUnitSpeedScale(10);
  advance(routing, 7);
  assert.ok(
    worker.actionLabel === 'Gathering Gold'
      || worker.actionLabel === 'Returning Gold to Ore Wash'
      || worker.actionLabel.startsWith('Stored ')
      || worker.actionLabel === 'Walking to Gold',
    `Gold loop retains a specific task label, received ${worker.actionLabel}`,
  );
  assert.equal(worker.returnStorageId === null || worker.returnStorageId === wash.id, true, 'Gold task remains tied to the Ore Wash drop-off');
}

function checkReadableResourceApproaches() {
  const simulation = freshSimulation();
  const villager = simulation.units.find((unit) => unit.type === 'villager');
  const tallNodes = ['tree', 'grove', 'stone']
    .map((type) => simulation.resourcesNodes.find((node) => node.type === type && node.sizeTier !== 'small'))
    .filter(Boolean);
  assert.ok(tallNodes.length > 0, 'reset contains tall resource nodes for readable approach coverage');
  for (const node of tallNodes) {
    villager.path = [];
    villager.gatherTarget = node.id;
    const routed = simulation._sendUnitToResource(villager, node);
    assert.equal(routed, true, `${node.type} ${node.sizeTier} has a route`);
    const frontBias = (villager.routeTarget.x + villager.routeTarget.z) - (node.x + node.z);
    assert.ok(frontBias >= -0.05, `${node.type} ${node.sizeTier} chooses a readable front approach`);
    simulation._releaseResourceSlot(villager);
  }
}

function checkConstructionAndPlacement() {
  const simulation = freshSimulation();
  const townCenter = simulation.buildings.find((building) => building.type === 'townCenter');
  assert.ok(townCenter, 'reset has a Crown Hall');
  assert.equal(simulation.getPlacementCheck('barracks', { x: townCenter.x, z: townCenter.z }).valid, false, 'building overlap rejected');
  const tree = simulation.resourcesNodes.find((node) => node.resourceType === 'wood');
  assert.equal(simulation.getPlacementCheck('barracks', { x: tree.x, z: tree.z }).valid, false, 'resource overlap rejected');

  const placement = [
    { x: townCenter.x - 18, z: townCenter.z },
    { x: townCenter.x + 18, z: townCenter.z },
    { x: townCenter.x, z: townCenter.z + 17 },
    { x: townCenter.x, z: townCenter.z - 17 },
  ].find((point) => simulation.getPlacementCheck('barracks', point).valid);
  assert.ok(placement, 'a valid Barracks placement exists outside the Hall');
  assert.equal(simulation.placeBuilding('barracks', placement), true, 'Barracks foundation placed');
  const barracks = simulation.buildings.find((building) => building.type === 'barracks' && building.progress < 1);
  assert.ok(barracks, 'Barracks starts as a construction site');
  // The workers must first walk to the south approach before construction
  // time starts; leave room for that route in the deterministic check.
  advance(simulation, BUILDING_TYPES.barracks.buildTime + 35);
  assert.equal(barracks.progress, 1, 'Barracks completes through construction simulation');
  assert.equal(barracks.hp, barracks.maxHp, 'completed Barracks reaches full health');
}

function checkConstructionRetaskingAndTaskSummary() {
  const simulation = freshSimulation();
  const townCenter = simulation.buildings.find((building) => building.type === 'townCenter');
  const placement = [
    { x: townCenter.x - 18, z: townCenter.z },
    { x: townCenter.x + 18, z: townCenter.z },
    { x: townCenter.x, z: townCenter.z + 17 },
    { x: townCenter.x, z: townCenter.z - 17 },
  ].find((point) => simulation.getPlacementCheck('barracks', point).valid);
  assert.ok(placement, 'construction-retask scenario has a valid Barracks site');
  assert.equal(simulation.placeBuilding('barracks', placement), true, 'construction-retask scenario places a foundation');
  const barracks = simulation.buildings.find((building) => building.type === 'barracks' && building.progress < 1);
  const villagers = simulation.units.filter((unit) => unit.type === 'villager' && unit.faction === 'player');
  assert.equal(barracks.buildAssigned.length, 3, 'all opening villagers begin assigned to the foundation');

  const clearPoint = { x: townCenter.x + 40, z: townCenter.z + 32 };
  simulation.selectedIds = villagers.map((unit) => unit.id);
  simulation._syncSelectionFlags();
  simulation.issueContextCommand(clearPoint, { kind: 'ground' });
  assert.equal(barracks.buildAssigned.length, 0, 'retasking every builder releases the construction assignment');
  assert.equal(barracks.buildSlotReservations.size, 0, 'retasking every builder releases every construction slot');
  const pausedProgress = barracks.progress;
  advance(simulation, 2);
  assert.equal(barracks.progress, pausedProgress, 'an unstaffed foundation pauses without phantom construction');

  const returningBuilder = villagers[0];
  simulation.selectedIds = [returningBuilder.id];
  simulation._syncSelectionFlags();
  const resume = simulation.issueContextCommand({ x: barracks.x, z: barracks.z }, barracks);
  assert.equal(resume.kind, 'build', 'right-clicking a foundation issues a construction command');
  assert.equal(returningBuilder.buildTarget, barracks.id, 'resumed builder targets the unfinished building');
  assert.ok(barracks.buildAssigned.includes(returningBuilder.id), 'resumed builder owns a construction assignment');
  assert.ok([...barracks.buildSlotReservations.values()].includes(returningBuilder.id), 'resumed builder owns an approach slot');

  const loadedBuilder = villagers[1];
  loadedBuilder.carryType = 'wood';
  loadedBuilder.carryAmount = 10;
  simulation.selectedIds = [loadedBuilder.id];
  simulation._syncSelectionFlags();
  const loadedResume = simulation.issueContextCommand({ x: barracks.x, z: barracks.z }, barracks);
  assert.equal(loadedResume.kind, 'build', 'a loaded villager can be queued to construct after depositing');
  assert.equal(loadedBuilder.command, 'return', 'loaded construction retask preserves the deposit trip');
  assert.equal(loadedBuilder.postDepositBuildTarget, barracks.id, 'loaded construction retask remembers the foundation');

  simulation.setUnitSpeedScale(10);
  advance(simulation, BUILDING_TYPES.barracks.buildTime + 35);
  assert.equal(barracks.progress, 1, 'resumed builders complete the paused foundation');
  assert.equal(loadedBuilder.postDepositBuildTarget, null, 'completed construction clears the queued post-deposit target');

  const mixedSummary = summarizeUnitTasks([
    { command: 'gather', actionLabel: 'Gathering Gold' },
    { command: 'return', actionLabel: 'Returning Gold to Crown Hall' },
    { command: 'idle', actionLabel: 'Idle' },
  ]);
  assert.equal(
    mixedSummary,
    '3 units · 1 Gathering Gold · 1 Returning Gold to Crown Hall · 1 ready',
    'mixed worker selection names each visible task instead of collapsing to a generic active count',
  );
  assert.equal(
    summarizeUnitTasks([
      { command: 'gather', actionLabel: 'Gathering Wood' },
      { command: 'gather', actionLabel: 'Gathering Wood' },
    ], { includeReady: false }),
    '2 active · Gathering Wood',
    'homogeneous command feedback stays concise',
  );
}

function checkWallResourcePrecedence() {
  const simulation = freshSimulation();
  const villager = simulation.units.find((unit) => unit.type === 'villager' && unit.faction === 'player');
  assert.ok(villager, 'reset has a builder for wall resource precedence');
  simulation.selectedIds = [villager.id];
  simulation._syncSelectionFlags();

  simulation.addResource('tree', 'wood', 180, 80, 260, 0, { sizeTier: 'medium' });
  simulation.addResource('stone', 'stone', 184, 80, 360, 0, { sizeTier: 'medium' });
  const tree = simulation.resourcesNodes.find((node) => node.x === 180 && node.z === 80);
  const stone = simulation.resourcesNodes.find((node) => node.x === 184 && node.z === 80);
  assert.ok(tree && stone, 'wall test has tree and stone obstructions');

  simulation.issueContextCommand({ x: tree.x, z: tree.z });
  const preview = simulation.getWallLinePreview({ x: 178, z: 80 }, { x: 184, z: 80 });
  assert.equal(preview.valid, true, 'wall preview accepts trees and stone in its snapped path');
  assert.equal(preview.resourceClearCount, 2, 'wall preview reports clearable tree and stone nodes');
  assert.equal(simulation.getWallLinePreview({ x: 76, z: 82 }, { x: 84, z: 82 }).valid, false, 'wall still respects building collision');
  assert.equal(simulation.placeWallLine({ x: 178, z: 80 }, { x: 184, z: 80 }), true, 'wall line places through tree and stone');
  assert.equal(simulation.resourcesNodes.some((node) => node.id === tree.id || node.id === stone.id), false, 'wall removes tree and stone nodes it replaces');
  assert.equal(villager.gatherTarget, null, 'cleared resource retasks a worker safely');
  assert.ok(simulation.buildings.some((building) => building.type === 'wall' && building.wallSegments === 3), 'wall keeps its snapped segment run');
}

function checkWallEndpointMagnetism() {
  const simulation = freshSimulation();
  const villager = simulation.units.find((unit) => unit.type === 'villager' && unit.faction === 'player');
  assert.ok(villager, 'reset has a builder for wall endpoint magnetism');
  simulation.selectedIds = [villager.id];
  simulation._syncSelectionFlags();
  const existing = simulation.addBuilding('wall', 183, 180, 'player', 1, {
    wallSegments: 3,
    wallOrientation: 'horizontal',
    wallDirection: { x: 1, z: 0 },
    wallStart: { x: 180, z: 180 },
  });

  const preview = simulation.getWallLinePreview({ x: 186.4, z: 180.1 }, { x: 195.2, z: 180.1 });
  assert.equal(preview.valid, true, 'nearby wall endpoint produces a valid connected preview');
  assert.equal(preview.wallConnectCount, 1, 'preview reports one magnetic wall connection');
  assert.deepEqual(preview.wallStart, { x: 189, z: 180 }, 'wall start magnetically moves to the next segment center');
  assert.deepEqual(preview.segments.at(-1), { x: 195, z: 180 }, 'connected wall preserves exact segment spacing');
  assert.ok(preview.wallConnectionIds.includes(existing.id), 'preview records the connected wall id');
  assert.equal(simulation.placeWallLine({ x: 186.4, z: 180.1 }, { x: 195.2, z: 180.1 }), true, 'connected wall line places successfully');
  assert.equal(simulation.buildings.filter((building) => building.type === 'wall').length, 2, 'connected wall remains a separate construction record');
}

function checkBlockedDestinationFallback() {
  const simulation = freshSimulation();
  const villager = simulation.units.find((unit) => unit.type === 'villager' && unit.faction === 'player');
  const hall = simulation.buildings.find((building) => building.type === 'townCenter' && building.faction === 'player');
  assert.ok(villager && hall, 'reset has a villager and Crown Hall for blocked-destination coverage');

  const path = simulation._buildPath(villager, { x: hall.x, z: hall.z });
  assert.ok(path.length > 0, 'blocked building destination resolves to a nearby route');
  const endpoint = path[path.length - 1];
  assert.equal(simulation._pointBlockedForUnit(villager, endpoint), false, 'blocked destination route ends outside the building clearance');
  assert.ok(Math.hypot(endpoint.x - hall.x, endpoint.z - hall.z) > 1, 'blocked destination does not preserve the building center as the endpoint');
}

function checkDynamicBlockerRecovery() {
  const simulation = freshSimulation();
  const villager = simulation.units.find((unit) => unit.type === 'villager' && unit.faction === 'player');
  const target = { x: 40, z: 20 };
  const initialPath = simulation._buildPath(villager, target);
  assert.ok(initialPath.length >= 3, 'dynamic blocker scenario starts with a multi-segment route');
  const blockerPoint = initialPath[Math.floor(initialPath.length / 2)];
  assert.equal(simulation._sendUnitTo(villager, target, 'move'), true, 'unit accepts the initial movement order');
  simulation.addBuilding('barracks', blockerPoint.x, blockerPoint.z, 'player', 1);

  assert.equal(simulation._replanUnit(villager), true, 'unit replans after a new building blocks its route');
  assert.ok(villager.path.length > 0, 'replanned route remains available');
  assert.equal(simulation._pointBlockedForUnit(villager, villager.path.at(-1)), false, 'replanned route ends outside static collision');
  assert.equal(villager.pathBlocked, false, 'dynamic route recovery does not leave the unit flagged as blocked');
}

function checkCrownHallStairs() {
  const simulation = freshSimulation();
  const hall = simulation.buildings.find((building) => building.type === 'townCenter');
  const villagers = simulation.units.filter((unit) => unit.type === 'villager' && unit.faction === 'player');
  simulation.selectedIds = villagers.map((unit) => unit.id);
  const command = simulation.issueContextCommand({ x: hall.x, z: hall.z }, hall);
  assert.equal(command.success, true, 'group accepts Crown Hall stair order');
  advance(simulation, 20);
  const stairs = simulation._crownHallStairInfo(hall);
  assert.ok(stairs, 'Crown Hall exposes a stair corridor');
  for (const villager of villagers) {
    assert.equal(villager.command, 'idle', `villager ${villager.id} stops at the top landing`);
    assert.equal(villager.stairAccess, true, `villager ${villager.id} retains stair access at the landing`);
    assert.ok(villager.stairProgress > 0.94, `villager ${villager.id} reaches the upper stair progress`);
    assert.equal(simulation._pointBlockedForUnit(villager, villager), false, `villager ${villager.id} is not blocked on the stairs`);
  }
  assert.equal(simulation._pointBlockedForUnit(villagers[0], { x: hall.x, z: hall.z }), true, 'Hall interior remains blocked');
  assert.equal(simulation.getPlacementCheck('wall', { x: hall.x, z: stairs.outerZ + 2 }).valid, true, 'backside site remains placeable outside Hall footprint');
}

function checkBarracksLandmarkScale() {
  const barracks = BUILDING_TYPES.barracks;
  const hall = BUILDING_TYPES.townCenter;
  assert.ok(barracks.renderSize >= 900 && barracks.renderSize <= 1200, 'Barracks practice dummies use the live Marauder reference scale');
  assert.equal(hall.renderSize, barracks.renderSize, 'Crown Hall matches the Barracks visual width');
  assert.ok(barracks.footprint.width >= 6 && barracks.footprint.height >= 5, 'Barracks gameplay footprint matches its person-scaled silhouette');
  assert.ok(barracks.collisionClearance >= 1.4, 'Barracks keeps a readable perimeter for units and pathfinding');

  const simulation = freshSimulation();
  const bounds = simulation._buildingEntityBounds({ type: 'barracks', x: 44, z: 42 }, 0);
  const epsilon = 0.01;
  assert.ok(bounds.maxX - bounds.minX >= barracks.footprint.width + barracks.collisionClearance * 2 - epsilon, 'Barracks collision bounds include landmark clearance');
  assert.ok(bounds.maxZ - bounds.minZ >= barracks.footprint.height + barracks.collisionClearance * 2 - epsilon, 'Barracks depth bounds include landmark clearance');
}

function checkCrownHallProportionsAndBuildableRing() {
  const hall = BUILDING_TYPES.townCenter;
  assert.equal(hall.renderSize, BUILDING_TYPES.barracks.renderSize, 'Crown Hall matches the Barracks visual width');
  assert.deepEqual(hall.footprint, { width: 9, height: 8 }, 'Crown Hall gameplay footprint is reduced with its visual scale');
  assert.equal(hall.collisionClearance, 1.8, 'Crown Hall collision clearance matches the reduced landmark');
  assert.equal(hall.stairAccess.topOffset, 5, 'Crown Hall stair landing scales with the landmark');
  assert.equal(hall.stairAccess.outerOffset, 9, 'Crown Hall stair approach scales with the landmark');

  const simulation = freshSimulation();
  const center = simulation.buildings.find((building) => building.type === 'townCenter');
  const sites = {
    north: { x: center.x, z: center.z - 13 },
    east: { x: center.x + 14, z: center.z },
    south: { x: center.x, z: center.z + 11 },
    west: { x: center.x - 20, z: center.z },
  };
  for (const [side, point] of Object.entries(sites)) {
    const check = simulation.getPlacementCheck('wall', point);
    assert.equal(check.valid, true, `Hall has a buildable meadow opening on the ${side} side`);
  }
}

function checkTravelSpeedIsolation() {
  const simulation = movementSandbox();
  const villager = simulation.addUnit('villager', 40, 40, 'player');
  simulation.setUnitSpeedScale(10);
  assert.equal(simulation._sendUnitTo(villager, { x: 160, z: 40 }, 'move'), true, '10x travel accepts a long movement order');
  advance(simulation, 0.25);
  assert.ok(villager.motionSpeed > 25, '10x travel reaches speed without a long moon-like acceleration glide');
  assert.ok(villager.animationPlaybackRate >= 3, 'fast travel advances the walk cycle instead of sliding a static pose');
  advance(simulation, 5.75);
  assert.ok(Math.hypot(villager.x - 160, villager.z - 40) < 0.2, '10x traveler reaches the ordered destination');
  assert.equal(villager.command, 'idle', '10x traveler settles cleanly after arrival');
  assert.ok(Math.abs(simulation.clock - 6) < 0.02, 'travel speed does not accelerate the fixed simulation clock');

  const obstacleSimulation = movementSandbox();
  const barracks = obstacleSimulation.addBuilding('barracks', 100, 100, 'player');
  const routedVillager = obstacleSimulation.addUnit('villager', 80, 100, 'player');
  obstacleSimulation.setUnitSpeedScale(10);
  assert.equal(obstacleSimulation._sendUnitTo(routedVillager, { x: 120, z: 100 }, 'move'), true, '10x traveler finds a route around a building');
  advance(obstacleSimulation, 6);
  assert.ok(Math.hypot(routedVillager.x - 120, routedVillager.z - 100) < 0.25, '10x traveler completes the obstacle route');
  assert.equal(insideBuilding(routedVillager, barracks, 0.36), false, 'high-speed collision cannot tunnel through a building');
  assert.equal(routedVillager.stuckTimer, 0, 'completed high-speed route clears stuck tracking');

  const groupSimulation = movementSandbox();
  const group = [[60, 60], [62, 60], [60, 62], [62, 62]]
    .map(([x, z]) => groupSimulation.addUnit('villager', x, z, 'player'));
  groupSimulation.selectedIds = group.map((unit) => unit.id);
  groupSimulation._syncSelectionFlags();
  groupSimulation.setUnitSpeedScale(10);
  assert.equal(groupSimulation.issueContextCommand({ x: 180, z: 140 }).success, true, '10x group movement order succeeds');
  advance(groupSimulation, 10);
  for (const unit of group) {
    assert.ok(Math.hypot(unit.x - 180, unit.z - 140) < 2, `fast group member ${unit.id} reaches formation`);
    assert.equal(unit.command, 'idle', `fast group member ${unit.id} settles without a stuck loop`);
  }
  for (let index = 0; index < group.length; index += 1) {
    for (let other = index + 1; other < group.length; other += 1) {
      assert.ok(Math.hypot(group[index].x - group[other].x, group[index].z - group[other].z) >= 1.07, 'fast group preserves personal space');
    }
  }
}

function checkExpandedWorldAndEnemyDistance() {
  const simulation = freshSimulation();
  assert.equal(CONFIG.mapWidth, 560, 'expanded map width is ten-area scale');
  assert.equal(CONFIG.mapHeight, 460, 'expanded map height is ten-area scale');
  const hall = simulation.buildings.find((building) => building.type === 'townCenter');
  const camp = simulation.buildings.find((building) => building.type === 'ashenCamp');
  assert.ok(Math.hypot(camp.x - hall.x, camp.z - hall.z) > 500, 'enemy camp starts across the expanded map');
  assert.ok(hall.x > CONFIG.mapWidth * 0.1 && hall.z > CONFIG.mapHeight * 0.1, 'Crown Hall starts inside the map rather than on the north-west tip');
  assert.ok(simulation.resourcesNodes.filter((node) => node.resourceType === 'wood').length >= 40, 'expanded map has a readable wood family');
  assert.ok(simulation.resourcesNodes.filter((node) => node.resourceType === 'food').length >= 30, 'expanded map has a readable berry family');
  assert.ok(simulation.resourcesNodes.filter((node) => node.resourceType === 'stone').length >= 20, 'expanded map has a readable stone family');
  const goldNodes = simulation.resourcesNodes.filter((node) => node.resourceType === 'gold');
  assert.ok(goldNodes.length >= 10 && goldNodes.length <= 14, 'expanded map keeps Gold regional and scarce');
  assert.deepEqual(new Set(goldNodes.map((node) => node.sizeTier)), new Set(['small', 'medium', 'large']), 'Gold distribution includes all three readable capacity tiers');
  assert.ok(goldNodes.some((node) => node.x < CONFIG.mapWidth / 2 && node.z < CONFIG.mapHeight / 2), 'Gold exists in the player-side half');
  assert.ok(goldNodes.some((node) => node.x > CONFIG.mapWidth / 2 && node.z > CONFIG.mapHeight / 2), 'Gold exists in the enemy-side half');
  assert.equal(simulation.resourcesNodes.some((node) => node.type === 'grain'), false, 'reset does not seed cultivated Grain Fields');
  assert.equal(simulation.buildings.some((building) => building.type === 'field'), false, 'fields remain exclusively player-built');
  const columns = 5;
  const rows = 4;
  const sectorWidth = CONFIG.mapWidth / columns;
  const sectorHeight = CONFIG.mapHeight / rows;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const nodes = simulation.resourcesNodes.filter((node) => (
        node.x >= column * sectorWidth
        && node.x < (column + 1) * sectorWidth
        && node.z >= row * sectorHeight
        && node.z < (row + 1) * sectorHeight
      ));
      for (const type of ['wood', 'food', 'stone']) {
        assert.ok(nodes.some((node) => node.resourceType === type), `sector ${column},${row} contains natural ${type}`);
      }
    }
  }
  assert.ok(CONFIG.minZoom < 0.05, 'minimum zoom can frame the expanded map');
}

function checkCursorCenteredZoom() {
  const renderer = Object.create(CrownforgeRenderer.prototype);
  renderer.width = 1280;
  renderer.height = 720;
  renderer.camera = { x: 0, y: 0, zoom: CONFIG.initialZoom };
  const cursor = { x: 380, y: 260 };
  const anchoredWorld = renderer.screenToWorld(cursor);
  renderer.zoomAt(1.6, cursor);
  const zoomedPoint = renderer.worldToScreen(anchoredWorld);
  assert.ok(Math.abs(zoomedPoint.x - cursor.x) < 0.01, 'zoom keeps the cursor world point horizontally anchored');
  assert.ok(Math.abs(zoomedPoint.y - cursor.y) < 0.01, 'zoom keeps the cursor world point vertically anchored');
  renderer.zoomAt(0.625, cursor);
  const restoredPoint = renderer.worldToScreen(anchoredWorld);
  assert.ok(Math.abs(restoredPoint.x - cursor.x) < 0.01, 'zoom out keeps the cursor world point horizontally anchored');
  assert.ok(Math.abs(restoredPoint.y - cursor.y) < 0.01, 'zoom out keeps the cursor world point vertically anchored');
}

function checkUprightWallVisuals() {
  const expectations = [
    ['EAST', { x: 1, z: 0 }, 'wall'],
    ['NORTH-EAST', { x: 1, z: -1 }, 'wallFace'],
    ['NORTH', { x: 0, z: -1 }, 'wallDiagonalLeft'],
    ['NORTH-WEST', { x: -1, z: -1 }, 'wallDepth'],
    ['WEST', { x: -1, z: 0 }, 'wall'],
    ['SOUTH-WEST', { x: -1, z: 1 }, 'wallFace'],
    ['SOUTH', { x: 0, z: 1 }, 'wallDiagonalLeft'],
    ['SOUTH-EAST', { x: 1, z: 1 }, 'wallDepth'],
  ];
  const usedAssets = new Set();
  for (const [label, direction, expectedAsset] of expectations) {
    const visual = resolveWallVisual(direction);
    assert.equal(visual.asset, expectedAsset, `${label} wall uses its authored upright screen-space view`);
    assert.ok(FIRST_AGE_ASSETS[visual.asset], `${label} upright wall asset is registered`);
    usedAssets.add(visual.asset);
  }
  assert.deepEqual(
    [...usedAssets].sort(),
    ['wall', 'wallDepth', 'wallDiagonalLeft', 'wallFace'].sort(),
    'eight wall snap directions resolve to four upright undirected views',
  );
}

function checkAspectCorrectBuildingFeedback() {
  const renderer = Object.create(CrownforgeRenderer.prototype);
  const hallWidth = BUILDING_TYPES.townCenter.renderSize;
  const barracksWidth = BUILDING_TYPES.barracks.renderSize;
  assert.ok(
    Math.abs(renderer.buildingVisualHeight({ type: 'townCenter' }, hallWidth) - hallWidth * FIRST_AGE_ASSETS.townCenter.height / FIRST_AGE_ASSETS.townCenter.width) < 1e-9,
    'Crown Hall feedback uses its transparent asset aspect ratio',
  );
  assert.ok(
    Math.abs(renderer.buildingVisualHeight({ type: 'barracks' }, barracksWidth) - barracksWidth * FIRST_AGE_ASSETS.barracks.height / FIRST_AGE_ASSETS.barracks.width) < 1e-9,
    'Barracks feedback uses its transparent asset aspect ratio',
  );
  assert.notEqual(
    renderer.buildingVisualHeight({ type: 'townCenter' }, hallWidth),
    hallWidth,
    'wide landmark feedback does not fall back to a square height',
  );
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
checkGoldEconomyLoop();
checkOreWashEconomySupport();
checkIntentAwareVisualTargeting();
checkReadableResourceApproaches();
checkConstructionAndPlacement();
checkConstructionRetaskingAndTaskSummary();
checkWallResourcePrecedence();
checkWallEndpointMagnetism();
checkBlockedDestinationFallback();
checkDynamicBlockerRecovery();
checkCrownHallStairs();
checkBarracksLandmarkScale();
checkCrownHallProportionsAndBuildableRing();
checkTravelSpeedIsolation();
checkExpandedWorldAndEnemyDistance();
checkCursorCenteredZoom();
checkUprightWallVisuals();
checkAspectCorrectBuildingFeedback();
checkCombatAndEndStates();

console.log(JSON.stringify({
  status: 'passed',
  checks: [
    'directional villager carry/response and military walk/attack/recoil/death atlas resolution',
    'reset villager ground/building clearance',
    '20 Hz versus 60 Hz gathering convergence',
    'cargo-preserving retask and storage return',
    'complete Gold gather, carry, Crown Hall deposit, return-to-work, depletion, and multi-worker slot loop',
    'Ore Wash construction, Gold-only drop-off routing, local yield bonus, and Crown Guard Gold spending',
    'intent-aware visual targeting and resource-specific gather/drop-off feedback',
    'focused first-age building catalog with the Crown Hall as universal fallback',
    'placement rejection and Barracks completion',
    'construction pause, foundation right-click reassignment, cargo-first resume, and mixed-task feedback',
    'wall precedence over trees and stone with safe resource cleanup',
    'magnetic wall endpoint snap and connected segment spacing',
    'blocked destination fallback outside building clearance',
    'dynamic building blocker route recovery',
    'Crown Hall stair routing, landing stop, and interior collision',
    'person-scaled Barracks landmark and collision clearance',
    'equal Crown Hall/Barracks proportion, inward placement, and four-sided buildable ring',
    'travel-only speed scaling, high-speed collision routing, and fast group spacing',
    'regional wood, berry, stone, and scarce three-tier Gold coverage without prebuilt fields',
    'expanded map and opposite-side enemy camp',
    'cursor-centered zoom anchor in both directions',
    'four authored upright Palisade views across all eight snap directions',
    'aspect-correct landmark health and placement feedback',
    'melee damage, death timing, victory, defeat',
  ],
}));
