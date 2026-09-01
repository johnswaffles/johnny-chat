import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  ASHEN_BUILDING_ASSETS,
  BUILDING_TYPES,
  COMBAT_ATLASES,
  CONFIG,
  ENEMY_AI,
  ENVIRONMENT_ATLAS,
  FIRST_AGE_BUILD_BLUEPRINTS,
  FIRST_AGE_ASSETS,
  FIRST_AGE_MILESTONES,
  FIRST_AGE_TECHNOLOGIES,
  FIRST_AGE_WORK_PRIORITIES,
  GOLD_DEPOSIT_ASSETS,
  INITIAL_RESOURCES,
  LARGE_STONE_ASSET,
  PRODUCTION_TYPES,
  RESOURCE_TYPES,
  SPACING_ROLES,
  TREE_ATLAS,
  TREE_GROVE_ATLAS,
  UNIT_TYPES,
  VILLAGER_ATLASES,
  WILDWOOD_FOREST_ATLAS,
  resourceDepletionStage,
} from '../src/config.js';
import { animationFrame, resolveAnimationState } from '../src/animation.js';
import { CrownforgeInput } from '../src/input.js';
import { CrownforgeRenderer, resolveFirstAgeConstructionStage, resolveWallVisual } from '../src/renderer.js';
import { CrownforgeSimulation, resourceFootprint } from '../src/simulation.js';
import { summarizeUnitTasks } from '../src/task-summary.js';

const STEP_60HZ = 1 / 60;
const STEP_20HZ = 1 / 20;
const INDEX_HTML = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const INPUT_SOURCE = fs.readFileSync(new URL('../src/input.js', import.meta.url), 'utf8');
const RENDERER_SOURCE = fs.readFileSync(new URL('../src/renderer.js', import.meta.url), 'utf8');
const SIMULATION_SOURCE = fs.readFileSync(new URL('../src/simulation.js', import.meta.url), 'utf8');
const STYLES_CSS = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

function advance(simulation, seconds, step = STEP_60HZ) {
  const count = Math.ceil(seconds / step);
  for (let index = 0; index < count; index += 1) simulation.update(step);
}

function insideBuilding(point, building, padding = 0) {
  const blueprint = BUILDING_TYPES[building.type];
  const footprint = blueprint.collisionFootprint ?? blueprint.footprint;
  const offset = blueprint.collisionOffset ?? { x: 0, z: 0 };
  const clearance = (blueprint.collisionClearance ?? 0) + (blueprint.unitExclusionPadding ?? 0);
  const width = footprint.width / 2 + clearance + padding;
  const height = footprint.height / 2 + clearance + padding;
  const centerX = building.x + (offset.x ?? 0);
  const centerZ = building.z + (offset.z ?? 0);
  return Math.abs(point.x - centerX) < width && Math.abs(point.z - centerZ) < height;
}

function freshSimulation() {
  return new CrownforgeSimulation();
}

function clearNaturalResources(simulation) {
  simulation.resourcesNodes = [];
  simulation.navigationVersion += 1;
  simulation.staticBlockerGridVersion = -1;
}

function gatheringSimulation() {
  const simulation = freshSimulation();
  const villager = simulation.units.find((unit) => unit.type === 'villager' && unit.faction === 'player');
  simulation.units = [villager];
  clearNaturalResources(simulation);
  simulation._checkVictory = () => {};
  simulation._updateEnemyAI = () => {};
  simulation._updateEnemyIntent = () => {};
  simulation.addResource('tree', 'wood', villager.x + 8, villager.z + 2, 180, 0, { sizeTier: 'small' });
  return simulation;
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
  for (const type of ['soldier', 'raider', 'scout', 'spearwarden', 'militia', 'shieldbearer']) {
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
      if (!['scout', 'spearwarden', 'militia', 'shieldbearer'].includes(type)) {
        const frame = animationFrame(type, 'hit', 0.11, direction);
        assert.equal(frame.atlasKey, `${type}Hit`, `${type} hit atlas`);
        assert.equal(frame.frameCount, 4, `${type} hit uses four authored recoil frames`);
        assert.ok(frame.column >= 0 && frame.column < 4, `${type} hit direction ${direction} frame`);
        assert.equal(frame.fallback, null, `${type} hit does not fall back to idle`);
      }
      const deathFrame = animationFrame(type, 'death', 0.71, direction);
      assert.equal(deathFrame.atlasKey, ['scout', 'spearwarden', 'militia', 'shieldbearer'].includes(type) ? 'combat' : `${type}Death`, `${type} death atlas`);
      assert.equal(deathFrame.frameCount, ['scout', 'spearwarden', 'militia', 'shieldbearer'].includes(type) ? 1 : 4, `${type} death uses authored frames`);
      assert.ok(deathFrame.column >= 0 && deathFrame.column < 4, `${type} death direction ${direction} frame`);
      assert.equal(deathFrame.fallback, null, `${type} death does not fall back to idle`);
    }
  }
  for (let direction = 0; direction < 4; direction += 1) {
    for (const state of ['attack_anticipation', 'attack_contact', 'attack_recovery']) {
      const attackFrame = animationFrame('villager', state, 0.22, direction);
      assert.equal(attackFrame.atlasKey, 'defenseAttackLoop', `villager ${state} uses authored defense atlas direction ${direction}`);
      assert.equal(attackFrame.row, direction, `villager ${state} preserves direction ${direction}`);
      assert.equal(attackFrame.fallback, null, `villager ${state} does not fall back to a static pose`);
    }
    const hitFrame = animationFrame('villager', 'hit', 0.11, direction);
    assert.equal(hitFrame.atlasKey, 'hitLoop', `villager hit atlas direction ${direction}`);
    assert.equal(hitFrame.frameCount, 4, 'villager hit uses four authored recoil frames');
    assert.equal(hitFrame.fallback, null, 'villager hit does not fall back to idle');
    const deathFrame = animationFrame('villager', 'death', 0.71, direction);
    assert.equal(deathFrame.atlasKey, 'deathLoop', `villager death atlas direction ${direction}`);
    assert.equal(deathFrame.frameCount, 4, 'villager death uses four authored frames');
    assert.equal(deathFrame.fallback, null, 'villager death does not fall back to idle');

    const stunnedFrame = animationFrame('raider', 'stunned', 0.37, direction);
    assert.equal(stunnedFrame.atlasKey, 'raiderStunned', `Raider stun uses authored atlas direction ${direction}`);
    assert.equal(stunnedFrame.row, direction, `Raider stun preserves direction ${direction}`);
    assert.equal(stunnedFrame.frameCount, 4, 'Raider stun has a restrained four-pose loop');
    assert.equal(stunnedFrame.fallback, null, 'Raider stun does not fall back to idle');
  }
  for (const atlas of Object.values(VILLAGER_ATLASES)) {
    if (atlas?.src) assert.match(atlas.src, /\.png/);
  }
  for (const atlas of Object.values(COMBAT_ATLASES)) {
    assert.match(atlas.src, /\.png/);
  }

  const foragerStates = {
    idle: 'ashenForagerMotion',
    walk: 'ashenForagerMotion',
    gather_wood: 'ashenForagerWork',
    gather_food: 'ashenForagerWork',
    gather_stone: 'ashenForagerWork',
    gather_gold: 'ashenForagerWork',
    construct: 'ashenForagerWork',
    carry_wood: 'ashenForagerCarry',
    carry_food: 'ashenForagerCarry',
    carry_stone: 'ashenForagerCarry',
    carry_gold: 'ashenForagerCarry',
  };
  for (const [state, atlasKey] of Object.entries(foragerStates)) {
    for (let direction = 0; direction < 4; direction += 1) {
      const frame = animationFrame('ashenForager', state, 0.37, direction);
      assert.equal(frame.atlasKey, atlasKey, `Ashen Forager ${state} direction ${direction} atlas`);
      assert.equal(frame.row, direction, `Ashen Forager ${state} preserves direction ${direction}`);
      assert.equal(frame.fallback, null, `Ashen Forager ${state} has authored artwork`);
    }
  }
  const authoredWalkTimes = [0.05, 0.22, 0.39, 0.56];
  for (let direction = 0; direction < 4; direction += 1) {
    const columns = authoredWalkTimes.map((time) => animationFrame('ashenForager', 'walk', time, direction).column);
    assert.ok(new Set(columns).size >= 3, `Ashen Forager direction ${direction} advances through authored walk frames`);
  }

  const ashenFighters = {
    ashenOutrider: ['ashenOutriderMotion', 'ashenOutriderAttack'],
    thornSpear: ['thornSpearMotion', 'thornSpearAttack'],
    hearthLevy: ['hearthLevyMotion', 'hearthLevyAttack'],
    hidewall: ['hidewallMotion', 'hidewallAttack'],
  };
  for (const [type, [motionAtlas, attackAtlas]] of Object.entries(ashenFighters)) {
    for (let direction = 0; direction < 4; direction += 1) {
      const walkFrame = animationFrame(type, 'walk', 0.37, direction);
      assert.equal(walkFrame.atlasKey, motionAtlas, `${type} walk direction ${direction} atlas`);
      assert.equal(walkFrame.row, direction, `${type} walk preserves direction ${direction}`);
      assert.equal(walkFrame.frameCount, 4, `${type} walk has four authored poses`);
      assert.equal(walkFrame.fallback, null, `${type} walk has no static fallback`);
      for (const state of ['attack_anticipation', 'attack_contact', 'attack_recovery']) {
        const attackFrame = animationFrame(type, state, 0.22, direction);
        assert.equal(attackFrame.atlasKey, attackAtlas, `${type} ${state} direction ${direction} atlas`);
        assert.equal(attackFrame.row, direction, `${type} ${state} preserves direction ${direction}`);
        assert.equal(attackFrame.fallback, null, `${type} ${state} has authored artwork`);
      }
    }
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
  assert.deepEqual(FIRST_AGE_BUILD_BLUEPRINTS, ['barracks', 'stable', 'granary', 'homestead', 'watchHut', 'timberYard', 'stonewrightYard', 'oreWash', 'field', 'road', 'wall', 'gate', 'palisadeTower'], 'first-age blueprint catalog stays intentionally small');
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
  const simulation = gatheringSimulation();
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

  const simulation = gatheringSimulation();
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

function checkPersistentForestGathering() {
  assert.equal(WILDWOOD_FOREST_ATLAS.columns, 3, 'Wildwood depletion atlas has three columns');
  assert.equal(WILDWOOD_FOREST_ATLAS.rows, 2, 'Wildwood depletion atlas has two rows');
  assert.match(WILDWOOD_FOREST_ATLAS.src, /crownforge-wildwood-depletion-v2\.png/, 'Wildwood uses its dedicated six-stage artwork');
  assert.ok(fs.existsSync(new URL(`../${WILDWOOD_FOREST_ATLAS.src.split('?')[0].replace(/^\.\//, '')}`, import.meta.url)), 'Wildwood depletion artwork is packaged with the playable game');
  const stageProbe = { type: 'grove', sizeTier: 'wildwood', maxAmount: 100, amount: 100 };
  assert.deepEqual(
    [100, 83, 66, 49, 32, 15, 0].map((amount) => resourceDepletionStage({ ...stageProbe, amount })),
    [0, 1, 2, 3, 4, 5, 5],
    'Wildwood visibly advances through six depletion states from dense canopy to clearing',
  );
  assert.match(RENDERER_SOURCE, /resource\.resourceType === 'wood' && resource\.amount <= 0/, 'depleted wood artwork is removed before it can cover the cleared ground');
  assert.doesNotMatch(RENDERER_SOURCE, /depleted && resource\.type === 'tree'/, 'individual forest trees do not leave a replacement stump patch');
  assert.ok(RESOURCE_TYPES.wood.capacity > 400 * 2400, 'wood storage supports clearing the full generated Wildwood instead of silently stopping a crew');
  assert.match(SIMULATION_SOURCE, /resolveWorldSeed\(requestedSeed\)/, 'forest generation has an explicit client-side seed');
  assert.match(SIMULATION_SOURCE, /WILDWOOD_CLUSTER_JITTER/, 'forest generation keeps jitter separate from the sampling lattice');
  const forestSignature = (simulation) => simulation.resourcesNodes
    .filter((node) => node.type === 'tree' && node.forestClusterId)
    .map((node) => `${node.x.toFixed(3)},${node.z.toFixed(3)}`)
    .join('|');
  const seededA = new CrownforgeSimulation({ seed: 0x12345678 });
  const seededB = new CrownforgeSimulation({ seed: 0x12345678 });
  const seededSignature = forestSignature(seededA);
  assert.ok(seededA.resourcesNodes.filter((node) => node.type === 'tree').length > 1000, 'seeded Wildwood remains a substantial harvestable forest');
  assert.equal(seededSignature, forestSignature(seededB), 'the same seed reproduces the same forest for QA and shareable maps');
  seededA.reset();
  assert.notEqual(seededSignature, forestSignature(seededA), 'reset rolls a fresh forest layout from the local generation seed');

  const treeLifecycle = movementSandbox();
  const treeWorker = treeLifecycle.addUnit('villager', 100, 100, 'player');
  const tree = treeLifecycle.addResource('tree', 'wood', 106, 100, 12, 0, {
    sizeTier: 'small',
    forestClusterId: 'qa-forest',
    forestTreeIndex: 0,
  });
  treeLifecycle.setUnitSpeedScale(10);
  treeLifecycle.setHarvestQuantityScale(100);
  assert.ok(treeLifecycle._assignResourceWork(treeWorker, {
    resourceType: 'wood',
    origin: tree,
    preferredNode: tree,
    radius: Infinity,
    maxCandidates: Infinity,
    persistent: true,
  }), 'an independent forest tree accepts a persistent gathering order');
  advance(treeLifecycle, 4);
  assert.equal(tree.amount, 0, 'an independent forest tree can be fully depleted on its own');
  assert.equal(tree.depleted, true, 'an independent forest tree records its own depletion state');

  const chain = movementSandbox();
  chain.addBuilding('townCenter', 20, 20, 'player');
  const workers = [
    chain.addUnit('villager', 30, 18, 'player'),
    chain.addUnit('villager', 30, 20, 'player'),
    chain.addUnit('villager', 30, 22, 'player'),
  ];
  chain.addResource('tree', 'wood', 34, 20, 36, 0, { sizeTier: 'small' });
  chain.addResource('tree', 'wood', 38, 20, 1200, 1, { sizeTier: 'small' });
  const [firstStand, nextStand] = chain.resourcesNodes;
  chain.resources.wood = 0;
  chain.setUnitSpeedScale(10);
  chain.setHarvestQuantityScale(1);
  chain.selectedIds = workers.map((unit) => unit.id);
  chain._syncSelectionFlags();
  assert.equal(chain.issueContextCommand(firstStand, firstStand).kind, 'gather', 'group forest order is accepted');
  advance(chain, 10);
  assert.equal(firstStand.amount, 0, 'the first stand is actually depleted');
  assert.ok(nextStand.amount < nextStand.maxAmount, 'the same group begins cutting the next nearby stand');
  assert.ok(
    workers.every((unit) => unit.gatherTarget === nextStand.id && ['gather', 'return'].includes(unit.command)),
    'all workers retain their gather intent instead of becoming unresponsive',
  );
}

function checkDevelopmentSpeedControls() {
  assert.equal(INDEX_HTML.includes('FIRST LIGHT ORDERS'), false, 'retired First Light Orders panel is removed from the player HUD');
  assert.equal(INDEX_HTML.includes('FIELD MANUAL'), false, 'retired Field Manual commands panel is removed from the player HUD');
  assert.equal(INDEX_HTML.includes('COMMANDS & CAMERA'), false, 'retired commands and camera panel is removed from the player HUD');
  assert.equal(INDEX_HTML.includes('id="controls-toggle"'), false, 'retired controls toggle is removed from the command deck');
  assert.match(INDEX_HTML, /id="performance-panel"[^>]*hidden/, 'development telemetry remains hidden in normal play');
  assert.match(INDEX_HTML, /id="dev-speed-panel"[^>]*class="dev-speed-panel/, 'development speed controls have a visible live panel');
  assert.match(INDEX_HTML, /id="dev-speed-panel"[\s\S]*DEV SPEED CONTROLS/, 'development speed controls live outside optional telemetry');
  assert.match(INDEX_HTML, /id="unit-speed"/, 'development travel speed slider remains available');
  assert.match(INDEX_HTML, /id="harvest-quantity"/, 'development harvesting quantity slider is available');

  const normal = movementSandbox();
  const normalWorker = normal.addUnit('villager', 20, 20, 'player');
  normal.addResource('tree', 'wood', 21.2, 20, 100, 0, { sizeTier: 'small' });
  const normalTree = normal.resourcesNodes[0];
  normalWorker.gatherTarget = normalTree.id;
  normalWorker.command = 'gather';
  normal._updateGathering(normalWorker, 0.2);
  assert.equal(normalWorker.carryAmount, 0, 'normal harvesting quantity does not complete a wood cycle early');

  const base = movementSandbox();
  const baseWorker = base.addUnit('villager', 20, 20, 'player');
  base.addResource('tree', 'wood', 21.2, 20, 200, 0, { sizeTier: 'small' });
  const baseTree = base.resourcesNodes[0];
  baseWorker.gatherTarget = baseTree.id;
  baseWorker.command = 'gather';
  base._updateGathering(baseWorker, 1.1);
  assert.equal(baseWorker.carryAmount, RESOURCE_TYPES.wood.gatherAmount, '1x removes the authored wood quantity');

  const boosted = movementSandbox();
  const boostedWorker = boosted.addUnit('villager', 20, 20, 'player');
  boosted.addResource('tree', 'wood', 21.2, 20, 200, 0, { sizeTier: 'small' });
  const boostedTree = boosted.resourcesNodes[0];
  boostedWorker.gatherTarget = boostedTree.id;
  boostedWorker.command = 'gather';
  assert.equal(boosted.setHarvestQuantityScale(100), 100, 'harvesting quantity slider caps at 100x');
  boosted._updateGathering(boostedWorker, 1.1);
  assert.equal(boostedWorker.carryAmount, 200, '100x removes the larger available bundle at normal cycle timing');
  assert.equal(boosted.getUnitSpeedScale(), 1, 'harvesting quantity does not alter travel speed');

  const isolated = freshSimulation();
  isolated.setUnitSpeedScale(7);
  isolated.setHarvestQuantityScale(100);
  assert.equal(isolated.getUnitSpeedScale(), 7, 'travel speed remains independently adjustable');
  assert.equal(isolated.getHarvestQuantityScale(), 100, 'harvesting quantity remains independently adjustable');
}

function checkFirstAgeSystemsPass() {
  assert.ok(FIRST_AGE_BUILD_BLUEPRINTS.includes('road'), 'packed roads are available in the First Age catalog');
  assert.equal(BUILDING_TYPES.road.walkable, true, 'packed roads do not become navigation blockers');
  assert.equal(BUILDING_TYPES.road.road, true, 'packed roads carry their movement-network identity');
  assert.equal(Object.keys(FIRST_AGE_TECHNOLOGIES).length, 3, 'First Age has three focused doctrine upgrades');

  const simulation = movementSandbox();
  simulation.addBuilding('townCenter', 20, 20, 'player', 1);
  const guard = simulation.addUnit('soldier', 20, 20, 'player');
  simulation.selectedIds = [guard.id];
  simulation._syncSelectionFlags();
  const guardOrder = simulation.setGuardZone({ x: 20, z: 20 }, 18);
  assert.equal(guardOrder.success, true, 'an armed unit accepts a guard-area order');
  assert.equal(guard.command, 'guard', 'a guard-area order holds the unit in guard state');
  assert.deepEqual(guard.guardPoint, { x: 20, z: 20 }, 'guard area stores its station point');
  assert.equal(guard.guardRadius, 18, 'guard area stores its local defense radius');
  assert.match(simulation.getRecentEvents(1)[0].message, /Guard area set/, 'guard order is written to the field log');

  simulation.resources = { food: 1000, wood: 1000, stone: 1000, gold: 1000 };
  assert.equal(simulation.researchTechnology('forestStewardship').success, true, 'Forest Stewardship can be researched');
  assert.equal(simulation._technologyGatherMultiplier('wood'), 1.25, 'Forest Stewardship increases wood yield');
  assert.equal(simulation.researchTechnology('stonecuttersGuild').success, true, 'Stonecutters Guild can be researched');
  assert.equal(simulation._technologyGatherMultiplier('stone'), 1.15, 'Stonecutters Guild increases stone yield');
  assert.equal(simulation.researchTechnology('watchkeeping').success, true, 'Watchkeeping can be researched');
  assert.equal(simulation._defenseRangeMultiplier(), 1.2, 'Watchkeeping increases defensive building range');

  const road = simulation.addBuilding('road', 26, 20, 'player', 1);
  guard.x = 26;
  guard.z = 20;
  assert.equal(simulation._isOnPackedRoad(guard), true, 'armed units receive the packed-road movement context');
  const snapshot = simulation.serialize();
  const restored = movementSandbox();
  assert.equal(restored.restore(snapshot), true, 'a serialized Crownforge slice restores successfully');
  assert.equal(restored.getWorldSeed(), simulation.getWorldSeed(), 'save/load preserves the world seed');
  assert.equal(restored.technologies.watchkeeping.researchedAt >= 0, true, 'save/load preserves researched doctrine');
  assert.ok(restored.buildings.some((building) => building.id === road.id && building.road), 'save/load preserves packed-road buildings');
  assert.ok(restored.units.some((unit) => unit.id === guard.id && unit.guardPoint), 'save/load preserves guard orders');
  assert.match(restored.getRecentEvents(1)[0].message, /save restored/i, 'save recovery writes a restore event');

  const queuedOrders = movementSandbox();
  const queuedWorker = queuedOrders.addUnit('villager', 10, 10, 'player');
  queuedOrders.selectedIds = [queuedWorker.id];
  queuedOrders._syncSelectionFlags();
  assert.equal(queuedOrders.issueContextCommand({ x: 20, z: 20 }).kind, 'move', 'a worker accepts the first direct move order');
  const queuedMove = queuedOrders.issueContextCommand({ x: 30, z: 30 }, null, { queue: true });
  assert.equal(queuedMove.success, true, 'Shift-right-click accepts a follow-up move order');
  assert.equal(queuedWorker.orderQueue.length, 1, 'the follow-up move is retained instead of replacing the active order');
  assert.equal(queuedWorker.orderQueue[0].kind, 'move', 'the retained order keeps its move intent');
}

function checkFirstAgeCommandDeckPass() {
  assert.equal(Object.keys(FIRST_AGE_WORK_PRIORITIES).length, 5, 'First Age worker focus offers five intentional priority presets');
  assert.equal(FIRST_AGE_MILESTONES.length, 5, 'First Age milestone track stays compact and readable');

  const workerFocus = movementSandbox();
  const worker = workerFocus.addUnit('villager', 10, 10, 'player');
  workerFocus.addResource('tree', 'wood', 14, 12, 180, 0);
  workerFocus.addResource('berry', 'food', 42, 42, 105, 0);
  workerFocus.setWorkerFocus('wood');
  workerFocus._updateWorkerAssignments();
  assert.equal(workerFocus.getWorkerFocus(), 'wood', 'worker focus persists as a simulation setting');
  assert.equal(worker.gatherTarget !== null, true, 'idle workers receive an automatic resource assignment');
  assert.equal(worker.gatherIntent.resourceType, 'wood', 'worker focus chooses the requested nearby resource first');

  const repairToggle = movementSandbox();
  const repairWorker = repairToggle.addUnit('villager', 20, 20, 'player');
  const damaged = repairToggle.addBuilding('house', 20, 20, 'player', 1);
  damaged.hp = damaged.maxHp - 20;
  repairToggle.setAutoRepairEnabled(false);
  assert.equal(repairToggle._nearestAutomaticBuildingWork(repairWorker), null, 'paused automatic repair leaves damaged structures for explicit orders');
  repairToggle.setAutoRepairEnabled(true);
  assert.equal(repairToggle._nearestAutomaticBuildingWork(repairWorker).id, damaged.id, 'automatic repair can be resumed without changing building data');

  const rally = movementSandbox();
  const barracks = rally.addBuilding('barracks', 20, 20, 'player', 1);
  rally.selectedIds = [barracks.id];
  rally._syncSelectionFlags();
  const rallyResult = rally.setRallyPoint({ x: 30, z: 30 });
  assert.equal(rallyResult.success, true, 'production buildings accept a rally point');
  assert.deepEqual(barracks.rallyPoint, { x: 30, z: 30 }, 'rally point stores its world destination');
  rally.clearRallyPoint();
  assert.equal(barracks.rallyPoint, null, 'production rally points can be cleared');

  const patrol = movementSandbox();
  const guard = patrol.addUnit('soldier', 20, 20, 'player');
  patrol.selectedIds = [guard.id];
  patrol._syncSelectionFlags();
  const patrolResult = patrol.setPatrolRoute({ x: 20, z: 20 }, { x: 34, z: 20 });
  assert.equal(patrolResult.success, true, 'armed units accept a two-point patrol route');
  assert.equal(guard.patrolActive, true, 'patrol state stays active after the initial route is planned');
  assert.equal(guard.patrolPoints.length, 2, 'patrol keeps both waypoints');
  patrol.clearPatrolRoute();
  assert.equal(guard.patrolActive, false, 'patrol route can be cleared');

  const map = movementSandbox();
  const scout = map.addUnit('scout', 20, 20, 'player');
  map.setExplorationEnabled(true);
  assert.ok(map.getExplorationSnapshot().cells.length > 0, 'optional exploration reveals a bounded local cell set');
  map.setExplorationEnabled(false);
  assert.equal(map.getExplorationSnapshot().enabled, false, 'exploration can be disabled for the normal full-map slice');

  const settlement = movementSandbox();
  settlement.addBuilding('townCenter', 20, 20, 'player', 1);
  const timber = settlement.addBuilding('timberYard', 32, 20, 'player', 1);
  const wall = settlement.addBuilding('wall', 45, 20, 'player', 1, { wallSegments: 3, wallDirection: { x: 1, z: 0 }, wallStart: { x: 42, z: 20 } });
  const milestones = settlement.getFirstAgeMilestones();
  assert.equal(milestones.find((item) => item.id === 'established').complete, true, 'Crown Hall milestone reflects a standing settlement core');
  assert.equal(milestones.find((item) => item.id === 'frontier').value, 2, 'milestone progress counts completed First Age structures');
  assert.equal(settlement.getLogisticsSummary().find((item) => item.resourceType === 'wood').station, 'Timber Yard', 'logistics summary selects the matching drop-off');
  assert.ok(settlement.getWallExtensionStart(wall).x > wall.x, 'wall continuation exposes a magnetic last-end start point');

  settlement.setWorkerFocus('gold');
  settlement.setAutoRepairEnabled(false);
  const save = settlement.serialize();
  const restored = movementSandbox();
  assert.equal(restored.restore(save), true, 'new First Age command settings survive save/load');
  assert.equal(restored.getWorkerFocus(), 'gold', 'save/load preserves worker focus');
  assert.equal(restored.isAutoRepairEnabled(), false, 'save/load preserves automatic repair state');
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
  const goldWorker = routing.addUnit('villager', 26, 20, 'player');
  goldWorker.carryType = 'gold';
  goldWorker.carryAmount = 5;
  assert.equal(routing._beginReturn(goldWorker), true, 'Gold cargo finds a compatible work-site route');
  assert.equal(goldWorker.returnStorageId, wash.id, 'nearby Gold cargo prefers the Ore Wash');

  const woodWorker = routing.addUnit('villager', 26, 24, 'player');
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

function checkStableGranaryAndScout() {
  assert.equal(BUILDING_TYPES.stable.productionTypes[0], 'scout', 'Crown Stable exposes the Crown Scout production loop');
  assert.equal(BUILDING_TYPES.granary.storage, true, 'First-age Granary is a real food storage building');
  assert.deepEqual(BUILDING_TYPES.granary.acceptsResources, ['food'], 'Granary accepts food cargo only');
  assert.deepEqual(BUILDING_TYPES.granary.gatherBonus, { resourceType: 'food', radius: 14, multiplier: 1.15 }, 'Granary has one restrained local food-support bonus');
  assert.equal(FIRST_AGE_ASSETS.stable.constructionAtlas.cellByStage.nearComplete.column, 0, 'Stable has authored construction-stage atlas mapping');
  assert.equal(FIRST_AGE_ASSETS.granary.constructionAtlas.cellByStage.partial.column, 1, 'Granary has authored construction-stage atlas mapping');
  assert.match(COMBAT_ATLASES.scout.src, /crownforge-scout-combat-atlas-v3\.png/, 'Scout combat atlas uses the transparent cell-safe mounted-unit correction');
  assert.match(COMBAT_ATLASES.scoutWalk.src, /crownforge-scout-walk-loop-v3\.png/, 'Scout walk loop uses the transparent cell-safe mounted-unit correction');
  assert.match(COMBAT_ATLASES.scoutAttack.src, /crownforge-scout-attack-loop-v3\.png/, 'Scout attack loop uses the transparent cell-safe mounted-unit correction');
  assert.ok(UNIT_TYPES.scout.renderSize >= UNIT_TYPES.soldier.renderSize * 1.5, 'mounted Scout keeps rider scale comparable to a foot soldier');
  assert.ok(UNIT_TYPES.scout.radius >= 0.7, 'mounted Scout collision follows the enlarged horse body');
  assert.ok(SPACING_ROLES.scout.personalSpace > SPACING_ROLES.soldier.personalSpace, 'mounted Scout reserves more local space than a foot soldier');
  for (const state of ['idle', 'walk', 'attack_anticipation', 'attack_contact', 'attack_recovery', 'death']) {
    for (let direction = 0; direction < 4; direction += 1) {
      const frame = animationFrame('scout', state, 0.41, direction);
      assert.equal(frame.fallback, null, `Scout ${state} direction ${direction} stays on authored artwork`);
    }
  }

  const simulation = freshSimulation();
  const findSite = (type) => {
    for (let radius = 10; radius <= 34; radius += 2) {
      for (let step = 0; step < 24; step += 1) {
        const angle = step / 24 * Math.PI * 2;
        const point = { x: 86 + Math.cos(angle) * radius, z: 72 + Math.sin(angle) * radius };
        if (simulation.getPlacementCheck(type, point).valid) return point;
      }
    }
    return null;
  };
  let site = null;
  site = findSite('stable');
  assert.ok(site, 'Crown Stable has a valid first-age placement site');
  assert.equal(simulation.placeBuilding('stable', site), true, 'Crown Stable places through the standard construction system');
  const stable = simulation.buildings.find((building) => building.type === 'stable');
  simulation.setUnitSpeedScale(10);
  advance(simulation, BUILDING_TYPES.stable.buildTime + 14);
  assert.equal(stable.progress, 1, 'Crown Stable completes through Villager construction');
  simulation.selectedIds = [stable.id];
  simulation._syncSelectionFlags();
  const scoutBefore = simulation.units.filter((unit) => unit.type === 'scout').length;
  assert.equal(simulation.queueUnit('scout').success, true, 'completed Crown Stable queues a Crown Scout');
  advance(simulation, PRODUCTION_TYPES.scout.trainTime + 2);
  const scout = simulation.units.find((unit) => unit.type === 'scout');
  assert.equal(simulation.units.filter((unit) => unit.type === 'scout').length, scoutBefore + 1, 'Crown Stable produces a Crown Scout');
  assert.ok(scout && Math.abs(scout.x - stable.x) + Math.abs(scout.z - stable.z) > 0, 'Crown Scout spawns outside the Stable footprint');
  assert.equal(scout.command, 'idle', 'new Crown Scout starts in a controllable idle state');

  const builder = simulation.units.find((unit) => unit.type === 'villager' && unit.faction === 'player' && !unit.dead);
  simulation.selectedIds = [builder.id];
  simulation._syncSelectionFlags();
  site = findSite('granary');
  assert.ok(site, 'First-age Granary has a valid placement site');
  assert.equal(simulation.placeBuilding('granary', site), true, 'First-age Granary places through the standard construction system');
  const granary = simulation.buildings.find((building) => building.type === 'granary');
  advance(simulation, BUILDING_TYPES.granary.buildTime + 14);
  assert.equal(granary.progress, 1, 'First-age Granary completes through Villager construction');
  const foodWorker = simulation.units.find((unit) => unit.type === 'villager');
  foodWorker.x = granary.x + 3;
  foodWorker.z = granary.z + 3;
  foodWorker.carryType = 'food';
  foodWorker.carryAmount = 5;
  assert.equal(simulation._beginReturn(foodWorker), true, 'Food cargo finds the new Granary as a compatible drop-off');
  assert.equal(foodWorker.returnStorageId, granary.id, 'Food cargo prefers the nearby Granary');
}

function checkTimberStonewrightAndSpearwarden() {
  assert.equal(BUILDING_TYPES.timberYard.storage, true, 'Timber Yard is a real wood storage building');
  assert.deepEqual(BUILDING_TYPES.timberYard.acceptsResources, ['wood'], 'Timber Yard accepts wood cargo only');
  assert.deepEqual(BUILDING_TYPES.timberYard.gatherBonus, { resourceType: 'wood', radius: 14, multiplier: 1.15 }, 'Timber Yard has one restrained local wood-support bonus');
  assert.equal(BUILDING_TYPES.stonewrightYard.storage, true, 'Stonewright Yard is a real stone storage building');
  assert.deepEqual(BUILDING_TYPES.stonewrightYard.acceptsResources, ['stone'], 'Stonewright Yard accepts stone cargo only');
  assert.deepEqual(BUILDING_TYPES.stonewrightYard.gatherBonus, { resourceType: 'stone', radius: 15, multiplier: 1.15 }, 'Stonewright Yard has one restrained local stone-support bonus');
  assert.equal(FIRST_AGE_ASSETS.timberYard.constructionAtlas.cellByStage.partial.column, 1, 'Timber Yard has authored construction-stage atlas mapping');
  assert.equal(FIRST_AGE_ASSETS.stonewrightYard.constructionAtlas.cellByStage.nearComplete.row, 1, 'Stonewright Yard has authored construction-stage atlas mapping');
  assert.match(FIRST_AGE_ASSETS.timberYard.src, /crownforge-timber-yard-first-age-v1\.png/, 'Timber Yard uses a Crownforge first-age asset');
  assert.match(FIRST_AGE_ASSETS.stonewrightYard.src, /crownforge-stonewright-yard-first-age-v1\.png/, 'Stonewright Yard uses a Crownforge first-age asset');
  assert.match(COMBAT_ATLASES.spearwarden.src, /crownforge-spearwarden-combat-atlas-v1\.png/, 'Spearwarden combat atlas is a Crownforge asset');
  assert.match(COMBAT_ATLASES.spearwardenWalk.src, /crownforge-spearwarden-walk-loop-v1\.png/, 'Spearwarden walk loop is a separate authored asset');
  assert.match(COMBAT_ATLASES.spearwardenAttack.src, /crownforge-spearwarden-attack-loop-v1\.png/, 'Spearwarden attack loop is a separate authored asset');
  for (const state of ['idle', 'walk', 'attack_anticipation', 'attack_contact', 'attack_recovery', 'death']) {
    for (let direction = 0; direction < 4; direction += 1) {
      const frame = animationFrame('spearwarden', state, 0.41, direction);
      assert.equal(frame.fallback, null, `Spearwarden ${state} direction ${direction} stays on authored artwork`);
    }
  }

  const production = movementSandbox();
  const barracks = production.addBuilding('barracks', 20, 20, 'player');
  production.selectedIds = [barracks.id];
  production._syncSelectionFlags();
  assert.equal(production.queueUnit('spearwarden').success, true, 'Barracks queues a Crown Spearwarden');
  advance(production, PRODUCTION_TYPES.spearwarden.trainTime + 2);
  const spearwarden = production.units.find((unit) => unit.type === 'spearwarden');
  assert.ok(spearwarden, 'Barracks produces a Crown Spearwarden');
  assert.equal(spearwarden.command, 'idle', 'new Crown Spearwarden starts in a controllable idle state');

  const routing = movementSandbox();
  const hall = routing.addBuilding('townCenter', 20, 20, 'player');
  const timberYard = routing.addBuilding('timberYard', 34, 20, 'player');
  const stonewrightYard = routing.addBuilding('stonewrightYard', 34, 28, 'player');
  const woodWorker = routing.addUnit('villager', 38, 20, 'player');
  woodWorker.carryType = 'wood';
  woodWorker.carryAmount = 5;
  assert.equal(routing._beginReturn(woodWorker), true, 'Wood cargo finds the Timber Yard');
  assert.equal(woodWorker.returnStorageId, timberYard.id, 'nearby Wood cargo prefers the Timber Yard');
  const stoneWorker = routing.addUnit('villager', 38, 28, 'player');
  stoneWorker.carryType = 'stone';
  stoneWorker.carryAmount = 5;
  assert.equal(routing._beginReturn(stoneWorker), true, 'Stone cargo finds the Stonewright Yard');
  assert.equal(stoneWorker.returnStorageId, stonewrightYard.id, 'nearby Stone cargo prefers the Stonewright Yard');
  const goldWorker = routing.addUnit('villager', 26, 26, 'player');
  goldWorker.carryType = 'gold';
  goldWorker.carryAmount = 5;
  assert.equal(routing._beginReturn(goldWorker), true, 'Gold cargo still finds the Crown Hall fallback');
  assert.equal(goldWorker.returnStorageId, hall.id, 'Timber and Stonewright Yards reject Gold');
}

function checkHomesteadAndMilitia() {
  assert.equal(BUILDING_TYPES.homestead.population, 6, 'First-age Homestead adds restrained population housing');
  assert.equal(BUILDING_TYPES.homestead.storage, undefined, 'First-age Homestead does not create a new storage system');
  assert.equal(FIRST_AGE_ASSETS.homestead.constructionAtlas.cellByStage.partial.column, 1, 'First-age Homestead has authored construction-stage atlas mapping');
  assert.match(FIRST_AGE_ASSETS.homestead.src, /crownforge-homestead-first-age-v1\.png/, 'First-age Homestead uses a Crownforge asset');
  assert.match(FIRST_AGE_ASSETS.homestead.constructionAtlas.src, /crownforge-homestead-construction-atlas-v1\.png/, 'First-age Homestead construction uses a Crownforge atlas');
  assert.match(COMBAT_ATLASES.militia.src, /crownforge-militia-combat-atlas-v1\.png/, 'Crown Militia combat atlas is a Crownforge asset');
  assert.match(COMBAT_ATLASES.militiaWalk.src, /crownforge-militia-walk-loop-v1\.png/, 'Crown Militia walk loop is a separate authored asset');
  assert.match(COMBAT_ATLASES.militiaAttack.src, /crownforge-militia-attack-loop-v1\.png/, 'Crown Militia attack loop is a separate authored asset');
  assert.ok(BUILDING_TYPES.barracks.productionTypes.includes('militia'), 'Barracks exposes the Crown Militia production loop');
  for (const state of ['idle', 'walk', 'attack_anticipation', 'attack_contact', 'attack_recovery', 'death']) {
    for (let direction = 0; direction < 4; direction += 1) {
      const frame = animationFrame('militia', state, 0.41, direction);
      assert.equal(frame.fallback, null, `Crown Militia ${state} direction ${direction} stays on authored artwork`);
    }
  }

  const production = movementSandbox();
  const barracks = production.addBuilding('barracks', 20, 20, 'player');
  production.selectedIds = [barracks.id];
  production._syncSelectionFlags();
  assert.equal(production.queueUnit('militia').success, true, 'Barracks queues a Crown Militia');
  advance(production, PRODUCTION_TYPES.militia.trainTime + 2);
  const militia = production.units.find((unit) => unit.type === 'militia');
  assert.ok(militia, 'Barracks produces a Crown Militia');
  assert.equal(militia.command, 'idle', 'new Crown Militia starts in a controllable idle state');

  const construction = freshSimulation();
  const builder = construction.units.find((unit) => unit.type === 'villager' && unit.faction === 'player' && !unit.dead);
  const baseCapacity = construction.population.capacity;
  construction.selectedIds = [builder.id];
  construction._syncSelectionFlags();
  let site = null;
  for (let radius = 10; radius <= 34 && !site; radius += 2) {
    for (let step = 0; step < 24 && !site; step += 1) {
      const angle = step / 24 * Math.PI * 2;
      const point = { x: 86 + Math.cos(angle) * radius, z: 72 + Math.sin(angle) * radius };
      if (construction.getPlacementCheck('homestead', point).valid) site = point;
    }
  }
  assert.ok(site, 'First-age Homestead has a valid placement site');
  assert.equal(construction.placeBuilding('homestead', site), true, 'First-age Homestead places through the standard construction system');
  const homestead = construction.buildings.find((building) => building.type === 'homestead');
  advance(construction, BUILDING_TYPES.homestead.buildTime + 14);
  assert.equal(homestead.progress, 1, 'First-age Homestead completes through Villager construction');
  assert.equal(construction.population.capacity, baseCapacity + 6, 'completed Homestead increases population capacity');
}

function checkWatchHutAndShieldbearer() {
  assert.equal(BUILDING_TYPES.watchHut.function, 'Settlement lookout and defensive landmark', 'Watch Hut has a clear first-age function');
  assert.equal(BUILDING_TYPES.watchHut.storage, undefined, 'Watch Hut does not create a second storage system');
  assert.equal(FIRST_AGE_ASSETS.watchHut.constructionAtlas.cellByStage.partial.column, 1, 'Watch Hut has authored construction-stage atlas mapping');
  assert.match(FIRST_AGE_ASSETS.watchHut.src, /crownforge-watch-hut-first-age-v1\.png/, 'Watch Hut uses a Crownforge first-age asset');
  assert.match(FIRST_AGE_ASSETS.watchHut.constructionAtlas.src, /crownforge-watch-hut-construction-atlas-v1\.png/, 'Watch Hut construction uses a Crownforge atlas');
  assert.match(COMBAT_ATLASES.shieldbearer.src, /crownforge-shieldbearer-combat-atlas-v1\.png/, 'Shieldbearer combat atlas is a Crownforge asset');
  assert.match(COMBAT_ATLASES.shieldbearerWalk.src, /crownforge-shieldbearer-walk-loop-v1\.png/, 'Shieldbearer walk loop is a separate authored asset');
  assert.match(COMBAT_ATLASES.shieldbearerAttack.src, /crownforge-shieldbearer-attack-loop-v1\.png/, 'Shieldbearer attack loop is a separate authored asset');
  assert.ok(BUILDING_TYPES.barracks.productionTypes.includes('shieldbearer'), 'Barracks exposes the Crown Shieldbearer production loop');
  for (const state of ['idle', 'walk', 'attack_anticipation', 'attack_contact', 'attack_recovery', 'death']) {
    for (let direction = 0; direction < 4; direction += 1) {
      const frame = animationFrame('shieldbearer', state, 0.41, direction);
      assert.equal(frame.fallback, null, `Crown Shieldbearer ${state} direction ${direction} stays on authored artwork`);
    }
  }

  const production = movementSandbox();
  const barracks = production.addBuilding('barracks', 20, 20, 'player');
  production.selectedIds = [barracks.id];
  production._syncSelectionFlags();
  assert.equal(production.queueUnit('shieldbearer').success, true, 'Barracks queues a Crown Shieldbearer');
  advance(production, PRODUCTION_TYPES.shieldbearer.trainTime + 2);
  const shieldbearer = production.units.find((unit) => unit.type === 'shieldbearer');
  assert.ok(shieldbearer, 'Barracks produces a Crown Shieldbearer');
  assert.equal(shieldbearer.command, 'idle', 'new Crown Shieldbearer starts in a controllable idle state');

  const construction = freshSimulation();
  const townCenter = construction.buildings.find((building) => building.type === 'townCenter');
  const builder = construction.units.find((unit) => unit.type === 'villager' && unit.faction === 'player' && !unit.dead);
  construction.selectedIds = [builder.id];
  construction._syncSelectionFlags();
  let site = null;
  for (let radius = 12; radius <= 40 && !site; radius += 2) {
    for (let step = 0; step < 24 && !site; step += 1) {
      const angle = step / 24 * Math.PI * 2;
      const point = { x: townCenter.x + Math.cos(angle) * radius, z: townCenter.z + Math.sin(angle) * radius };
      if (construction.getPlacementCheck('watchHut', point).valid) site = point;
    }
  }
  assert.ok(site, 'First-age Watch Hut has a valid placement site');
  assert.equal(construction.placeBuilding('watchHut', site), true, 'First-age Watch Hut places through the standard construction system');
  const watchHut = construction.buildings.find((building) => building.type === 'watchHut');
  advance(construction, BUILDING_TYPES.watchHut.buildTime + 14);
  assert.equal(watchHut.progress, 1, 'First-age Watch Hut completes through Villager construction');
  assert.equal(watchHut.hp, BUILDING_TYPES.watchHut.maxHp, 'completed Watch Hut reaches full health');
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

function checkBuilderWorkflowAndVillagerControls() {
  assert.equal(UNIT_TYPES.villager.canBuild, true, 'Villager exposes the reusable builder capability');
  assert.ok(UNIT_TYPES.villager.autoBuildRadius >= 10, 'nearby builder assistance has a useful local radius');
  assert.ok(UNIT_TYPES.villager.repairRate > 0, 'builder capability includes a positive repair rate');

  const automatic = movementSandbox();
  automatic.addBuilding('townCenter', 20, 20, 'player');
  const autoBuilder = automatic.addUnit('villager', 26, 23, 'player');
  autoBuilder.needsSafetyRegroup = false;
  autoBuilder.pathBlocked = true;
  autoBuilder.recoveryAvailable = true;
  const unfinished = automatic.addBuilding('house', 34, 20, 'player', 0.25);
  automatic.update(STEP_60HZ);
  assert.equal(autoBuilder.buildTarget, unfinished.id, 'idle nearby builder automatically claims an unfinished structure');
  assert.equal(autoBuilder.command, 'build', 'automatic builder assistance uses the normal construction command');
  assert.equal(autoBuilder.pathBlocked, false, 'automatic assistance clears a stale blocked-route marker');

  automatic.setUnitSpeedScale(10);
  advance(automatic, BUILDING_TYPES.house.buildTime + 6);
  assert.equal(unfinished.progress, 1, 'automatically assisted structure completes normally');
  unfinished.hp -= 24;
  automatic.selectedIds = [autoBuilder.id];
  automatic._syncSelectionFlags();
  const repair = automatic.issueContextCommand({ x: unfinished.x, z: unfinished.z }, unfinished);
  assert.equal(repair.kind, 'repair', 'damaged friendly structure resolves to a repair command');
  assert.equal(repair.success, true, 'builder accepts repair command');
  advance(automatic, 6);
  assert.equal(unfinished.hp, unfinished.maxHp, 'repair restores building health to its cap');
  assert.equal(unfinished.buildAssigned.length, 0, 'repair releases its builder reservations when complete');

  const regroup = movementSandbox();
  const hall = regroup.addBuilding('townCenter', 20, 20, 'player');
  const returningWorker = regroup.addUnit('villager', 62, 62, 'player');
  returningWorker.needsSafetyRegroup = true;
  advance(regroup, 29.5);
  assert.equal(returningWorker.safetyRegroupActive, false, 'idle worker waits before returning to settlement safety');
  advance(regroup, 1.1);
  assert.equal(returningWorker.safetyRegroupActive, true, 'finished Villager starts a safety regroup route');
  assert.match(returningWorker.actionLabel, /Regrouping at Crown Hall/, 'safety regroup is visible in the selected-unit task');
  regroup.setUnitSpeedScale(10);
  advance(regroup, 8);
  assert.equal(returningWorker.command, 'idle', 'regrouped Villager settles instead of repeatedly rerouting');
  assert.equal(returningWorker.needsSafetyRegroup, false, 'completed huddle clears the regroup request');
  assert.equal(returningWorker.actionLabel, 'Standing by at Crown Hall', 'regrouped Villager reports the safe standby state');
  assert.ok(regroup._distanceToBuildingEdge(returningWorker, hall) < 9, 'Villager huddle remains close to the Crown Hall');

  const selection = movementSandbox();
  const first = selection.addUnit('villager', 10, 10, 'player');
  const second = selection.addUnit('villager', 12, 10, 'player');
  const fallen = selection.addUnit('villager', 14, 10, 'player');
  selection.addUnit('soldier', 16, 10, 'player');
  selection.addUnit('villager', 18, 10, 'enemy');
  fallen.dead = true;
  selection.selectedIds = [first.id];
  selection._syncSelectionFlags();
  const selected = selection.selectAllVillagers();
  assert.equal(selected.count, 2, 'select-all includes every living player Villager only');
  assert.deepEqual(selection.selectedIds, [first.id, second.id], 'select-all excludes soldiers, enemies, and fallen Villagers');

  const neutral = movementSandbox();
  const crownHearthkin = neutral.addUnit('villager', 10, 10, 'player');
  const ashenHearthkin = neutral.addUnit('ashenForager', 12, 10, 'enemy');
  crownHearthkin.attackTarget = ashenHearthkin.id;
  crownHearthkin.attackTargetKind = 'unit';
  assert.equal(neutral._sendUnitToAttack(crownHearthkin, ashenHearthkin), false, 'opposing Hearthkin cannot attack one another');
  neutral.selectedIds = [crownHearthkin.id];
  neutral._syncSelectionFlags();
  const neutralCommand = neutral.issueContextCommand(ashenHearthkin, ashenHearthkin);
  assert.equal(neutralCommand.success, false, 'manual attack command respects Hearthkin neutrality');
  assert.match(neutral.lastCommand, /one race and remain neutral/, 'neutrality gives the player a clear command explanation');

  assert.match(INDEX_HTML, /id="select-all-villagers"/, 'selection panel exposes a Select All Hearthkin button');
  assert.match(INDEX_HTML, /SELECT ALL HEARTHKIN/, 'selection panel uses the shared Hearthkin name');
  assert.doesNotMatch(INDEX_HTML, /FIRST-AGE DOCTRINE|WORK CREW|FIRST-AGE MILESTONES/, 'legacy First Age panels are removed from the left rail');
  assert.match(INDEX_HTML, /SETTLEMENT-WIDE <kbd>V<\/kbd>/, 'Select All Villagers button advertises its keyboard shortcut');
  assert.match(INPUT_SOURCE, /buildingNeedsWork\(entity\)/, 'hover targeting asks the shared building-work capability');
  assert.match(INPUT_SOURCE, /one normal click is one order/, 'selected units expose the primary-click command contract');
  assert.match(INPUT_SOURCE, /issueContextCommand\(world, commandTarget\)/, 'primary clicks use the same context router as right-click orders');
  assert.match(STYLES_CSS, /is-build-target[^\n]+cursor:/, 'unfinished structures have a dedicated hammer cursor');
  assert.match(STYLES_CSS, /is-repair-target[^\n]+cursor:/, 'damaged structures have a dedicated repair cursor');
}

function checkInstantAreaDemolition() {
  const simulation = movementSandbox();
  const hall = simulation.addBuilding('townCenter', 20, 20, 'player');
  const house = simulation.addBuilding('house', 34, 20, 'player');
  const wall = simulation.addBuilding('wall', 44, 20, 'player', 1, {
    wallSegments: 4,
    wallStart: { x: 40, z: 20 },
    wallDirection: { x: 1, z: 0 },
  });
  const enemyBuilding = simulation.addBuilding('ashenCamp', 58, 20, 'enemy');
  simulation.selectedIds = [];
  simulation._syncSelectionFlags();

  const result = simulation.demolishStructures([house, wall, hall, enemyBuilding]);
  assert.equal(result.success, true, 'direct demolition works without selecting a Villager');
  assert.equal(result.targetCount, 2, 'area demolition removes every eligible player structure in one action');
  assert.equal(result.protectedCount, 2, 'Crown Hall and enemy structures remain protected');
  assert.equal(house.destroyed, true, 'selected player building is demolished immediately');
  assert.equal(wall.destroyed, true, 'selected Palisade run is demolished immediately');
  assert.ok(house.destroyAge > 2.4 && wall.destroyAge > 2.4, 'instant demolition skips debris and collapse frames');
  assert.equal(simulation._buildingHasCollision(house), false, 'demolished structure releases collision immediately');
  assert.equal(simulation._buildingHasCollision(wall), false, 'demolished wall releases collision immediately');
  assert.equal(hall.destroyed, false, 'Crown Hall cannot be demolished');
  assert.equal(enemyBuilding.destroyed, false, 'enemy structure cannot be demolished by the player command');
  assert.equal(simulation.units.length, 0, 'demolition has no worker or unit dependency');
  assert.match(simulation.lastCommand, /debris cleared/, 'demolition feedback confirms cleanup');

  assert.match(INDEX_HTML, /DEMOLISH STRUCTURES/, 'selection panel exposes direct demolition');
  assert.match(INDEX_HTML, /INSTANT AREA CLEAR/, 'direct demolition button communicates area clearing');
  assert.doesNotMatch(INDEX_HTML, /Villager demolition mode/, 'controls no longer describe demolition as a Villager ability');
  assert.match(INPUT_SOURCE, /demolishStructures\(targets\)/, 'area release calls the direct demolition command');
}

function checkAutonomousWorkCombatAndDefenses() {
  const wallWork = movementSandbox();
  const wall = wallWork.addBuilding('wall', 100, 100, 'player', 0.04, {
    wallSegments: 20,
    wallStart: { x: 70, z: 100 },
    wallDirection: { x: 1, z: 0 },
  });
  const geometry = wallWork._wallLineGeometry(wall);
  const wallBuilder = wallWork.addUnit('villager', geometry.center.x, geometry.center.z + 4, 'player');
  const wallStations = wallWork._buildingApproachPoints(wall);
  assert.ok(wallStations.some((point) => Math.abs(point.x - geometry.center.x) < 1), 'long Palisade exposes a construction station near its middle');
  wallWork.update(STEP_60HZ);
  assert.equal(wallBuilder.buildTarget, wall.id, 'nearby Villager automatically claims a long Palisade from its middle');
  assert.equal(wallBuilder.command, 'build', 'Palisade construction keeps a persistent builder command');
  const initialWallProgress = wall.progress;
  wallWork.setUnitSpeedScale(10);
  advance(wallWork, 3);
  assert.ok(wall.progress > initialWallProgress, 'Villager reaches and advances long Palisade construction');

  const persistentAttack = movementSandbox();
  const patientGuard = persistentAttack.addUnit('soldier', 10, 10, 'player');
  const distantRaider = persistentAttack.addUnit('raider', 30, 30, 'enemy');
  persistentAttack._bestCombatRoute = () => null;
  const accepted = persistentAttack._sendUnitToAttack(patientGuard, distantRaider, 0);
  assert.equal(accepted, true, 'attack order is accepted even while a route is temporarily unavailable');
  assert.equal(patientGuard.command, 'attack', 'temporarily blocked attack remains a persistent combat order');
  assert.equal(patientGuard.attackTarget, distantRaider.id, 'persistent attack retains its target for route retry');
  assert.match(patientGuard.actionLabel, /Finding an approach/, 'temporary attack obstruction reports recovery instead of refusal');

  const military = movementSandbox();
  const guard = military.addUnit('soldier', 100, 100, 'player');
  const raider = military.addUnit('raider', 108, 100, 'enemy');
  military._updateBuilderServices();
  assert.equal(guard.attackTarget, raider.id, 'idle Crown Guard automatically acquires a nearby hostile fighter');
  assert.equal(guard.command, 'attack', 'automatic settlement defense uses the normal attack command');

  const localDefense = movementSandbox();
  const localGuard = localDefense.addUnit('soldier', 100, 100, 'player');
  const localRaider = localDefense.addUnit('raider', 106, 100, 'enemy');
  localDefense.addBuilding('ashenCamp', 420, 420, 'enemy');
  localDefense._updateBuilderServices();
  assert.equal(localGuard.attackTarget, localRaider.id, 'local defense locks onto the nearby attacker');
  const guardPosition = { x: localGuard.x, z: localGuard.z };
  localDefense._killUnit(localRaider, localGuard);
  localDefense._updateUnit(localGuard, STEP_60HZ);
  assert.equal(localGuard.command, 'idle', 'guard returns to a holding state after its local threat is defeated');
  assert.equal(localGuard.attackTarget, null, 'finished local defense does not retain a stale attack target');
  assert.deepEqual({ x: localGuard.x, z: localGuard.z }, guardPosition, 'finished local defense holds the position where the fight ended');
  assert.equal(localDefense._getAttackTarget(localGuard), null, 'combat cleanup never promotes the distant enemy camp into a new target');

  const protectedWorker = movementSandbox();
  const restrainedGuard = protectedWorker.addUnit('soldier', 100, 100, 'player');
  protectedWorker.addUnit('ashenForager', 106, 100, 'enemy');
  protectedWorker._updateBuilderServices();
  assert.equal(restrainedGuard.attackTarget, null, 'automatic military defense ignores protected enemy workers');

  for (const defenseType of ['watchHut', 'palisadeTower']) {
    const defense = movementSandbox();
    const building = defense.addBuilding(defenseType, 100, 100, 'player');
    const target = defense.addUnit('raider', 108, 100, 'enemy');
    defense._updateDefensiveBuilding(building);
    assert.equal(defense.projectiles.length, 1, `${BUILDING_TYPES[defenseType].label} launches an arrow at a nearby fighter`);
    assert.ok(Number.isInteger(defense.projectiles[0].portIndex), `${BUILDING_TYPES[defenseType].label} chooses a directional firing port`);
    const initialHp = target.hp;
    advance(defense, 1);
    assert.ok(target.hp < initialHp, `${BUILDING_TYPES[defenseType].label} arrow reaches and damages its target`);
  }

  const workTransition = movementSandbox();
  const timberYard = workTransition.addBuilding('timberYard', 100, 100, 'player');
  const lumberjack = workTransition.addUnit('villager', 100, 106, 'player');
  workTransition.addResource('grove', 'wood', 109, 100, 1200, 0, { sizeTier: 'large' });
  const nearbyTrees = workTransition.resourcesNodes.at(-1);
  const assigned = workTransition._assignCompletedBuildingWork(lumberjack, timberYard);
  assert.equal(assigned, true, 'completed specialist yard assigns its builder to matching nearby resources');
  assert.equal(lumberjack.gatherTarget, nearbyTrees.id, 'Timber Yard builder transitions directly into nearby wood gathering');

  for (const [type, resourceType] of [
    ['granary', 'food'],
    ['timberYard', 'wood'],
    ['stonewrightYard', 'stone'],
    ['oreWash', 'gold'],
    ['lumberMill', 'wood'],
    ['quarry', 'stone'],
    ['grainMill', 'food'],
  ]) {
    assert.equal(BUILDING_TYPES[type].autoWork.resourceType, resourceType, `${BUILDING_TYPES[type].label} declares its automatic follow-up work`);
    assert.ok(BUILDING_TYPES[type].autoWork.radius >= 40, `${BUILDING_TYPES[type].label} reaches matching nodes beyond monumental wildwood canopies`);
  }

  const legacyMillTransition = movementSandbox();
  const lumberMill = legacyMillTransition.addBuilding('lumberMill', 100, 100, 'player');
  const millBuilder = legacyMillTransition.addUnit('villager', 100, 106, 'player');
  legacyMillTransition.addResource('tree', 'wood', 113, 100, 180, 0, { sizeTier: 'small' });
  assert.equal(legacyMillTransition._assignCompletedBuildingWork(millBuilder, lumberMill), true, 'completed Lumber Mill also dispatches its builder to nearby trees');
  assert.equal(millBuilder.command, 'gather', 'Lumber Mill handoff begins a real gather order instead of leaving the builder idle');

  const canopyTransition = movementSandbox();
  const canopyYard = canopyTransition.addBuilding('timberYard', 100, 100, 'player');
  const canopyBuilder = canopyTransition.addUnit('villager', 100, 106, 'player');
  canopyTransition.addResource('grove', 'wood', 180, 100, 120000, 0, { sizeTier: 'wildwood' });
  assert.equal(canopyTransition._assignCompletedBuildingWork(canopyBuilder, canopyYard), true, 'a yard beside a monumental visible canopy reaches the Wildwood node beyond its hidden center');
  assert.match(canopyBuilder.actionLabel, /Starting nearby Wood work/, 'Wildwood canopy handoff remains visible as immediate Wood work');

  const forgivingIntent = movementSandbox();
  const intentWorker = forgivingIntent.addUnit('villager', 100, 100, 'player');
  forgivingIntent.selectedIds = [intentWorker.id];
  forgivingIntent._syncSelectionFlags();
  forgivingIntent.addResource('grove', 'wood', 108, 100, 1200, 0, { sizeTier: 'large' });
  const blockedTree = forgivingIntent.resourcesNodes.at(-1);
  forgivingIntent.addResource('tree', 'wood', 112, 103, 180, 0, { sizeTier: 'small' });
  const reachableTree = forgivingIntent.resourcesNodes.at(-1);
  const attempts = [];
  forgivingIntent._sendUnitToResource = (unit, node) => {
    attempts.push(node.id);
    if (node.id === blockedTree.id) return false;
    unit.command = 'gather';
    return true;
  };
  const gatherResult = forgivingIntent.issueContextCommand(blockedTree, blockedTree);
  assert.equal(gatherResult.kind, 'gather', 'a blocked clicked tree still produces a successful gather command');
  assert.deepEqual(attempts.slice(0, 2), [blockedTree.id, reachableTree.id], 'manual gather preserves the clicked tree first, then redirects to a nearby matching node');
  assert.equal(intentWorker.gatherTarget, reachableTree.id, 'the worker retains the reachable fallback as its active work target');

  const responsiveWildwood = movementSandbox();
  const wildwoodWorkers = [
    responsiveWildwood.addUnit('villager', 90, 98, 'player'),
    responsiveWildwood.addUnit('villager', 90, 100, 'player'),
    responsiveWildwood.addUnit('villager', 90, 102, 'player'),
  ];
  responsiveWildwood.addResource('grove', 'wood', 120, 100, 120000, 0, { sizeTier: 'wildwood' });
  const responsiveGrove = responsiveWildwood.resourcesNodes.at(-1);
  responsiveWildwood.selectedIds = wildwoodWorkers.map((unit) => unit.id);
  responsiveWildwood._syncSelectionFlags();
  const responsiveGather = responsiveWildwood.issueContextCommand(responsiveGrove, responsiveGrove);
  assert.equal(responsiveGather.kind, 'gather', 'a group Wildwood click accepts the gather order immediately');
  assert.ok(wildwoodWorkers.every((unit) => unit.command === 'gather'), 'all selected workers begin the Wildwood order together');
  assert.ok(responsiveWildwood.pathRequestsLastStep <= wildwoodWorkers.length, 'clear Wildwood approaches avoid an exhaustive A* search across every work slot');

  const boundedResourceSearch = movementSandbox();
  const boundedWorker = boundedResourceSearch.addUnit('villager', 90, 100, 'player');
  boundedResourceSearch.addResource('grove', 'wood', 120, 100, 120000, 0, { sizeTier: 'wildwood' });
  const boundedGrove = boundedResourceSearch.resourcesNodes.at(-1);
  let boundedAttempts = 0;
  boundedResourceSearch._buildPath = () => {
    boundedAttempts += 1;
    return null;
  };
  assert.equal(boundedResourceSearch._sendUnitToResource(boundedWorker, boundedGrove), false, 'a sealed Wildwood approach reports failure');
  assert.ok(boundedAttempts <= 4, 'a sealed Wildwood node never launches pathfinding for all twenty-four work slots');

  const sharedGroupRoute = freshSimulation();
  const groupLeader = sharedGroupRoute.units.find((unit) => unit.type === 'villager' && unit.faction === 'player');
  const routeGroup = [groupLeader];
  for (let index = 1; index < CONFIG.normalPopulationCapacity; index += 1) {
    routeGroup.push(sharedGroupRoute.addUnit(
      'villager',
      groupLeader.x + (index % 6) * 0.65,
      groupLeader.z + Math.floor(index / 6) * 0.65,
      'player',
    ));
  }
  sharedGroupRoute.selectedIds = routeGroup.map((unit) => unit.id);
  sharedGroupRoute._syncSelectionFlags();
  const sealedGroupMove = sharedGroupRoute.issueContextCommand({ x: CONFIG.mapWidth - 60, z: CONFIG.mapHeight - 60 });
  assert.equal(sealedGroupMove.success, false, 'an uncut Wildwood divide still rejects an impossible group move');
  assert.ok(sharedGroupRoute.pathRequestsLastStep <= 1, 'a nearby selected group shares one obstacle search instead of repeating it for every unit');
  assert.equal(routeGroup.filter((unit) => unit.pathBlocked).length, routeGroup.length, 'the shared failed route leaves every group member recoverable');

  assert.match(RENDERER_SOURCE, /wallJunctionClip:\s*\{ x: connector\.socketX, z: connector\.socketZ \}/, 'Palisade Tower connectors clip at the authored tower socket');
  assert.match(RENDERER_SOURCE, /drawDefenseProjectiles\(ctx, simulation\)/, 'renderer draws defensive arrows in the world pass');
}

function checkConstructionAndPlacement() {
  const simulation = freshSimulation();
  const townCenter = simulation.buildings.find((building) => building.type === 'townCenter');
  assert.ok(townCenter, 'reset has a Crown Hall');
  assert.equal(simulation.getPlacementCheck('barracks', { x: townCenter.x, z: townCenter.z }).valid, false, 'building overlap rejected');
  const tree = simulation.resourcesNodes.find((node) => node.resourceType === 'wood');
  assert.equal(simulation.getPlacementCheck('barracks', { x: tree.x, z: tree.z }).valid, false, 'resource overlap rejected');

  const placement = [
    { x: townCenter.x - 22, z: townCenter.z },
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
    { x: townCenter.x - 22, z: townCenter.z },
    { x: townCenter.x + 18, z: townCenter.z },
    { x: townCenter.x, z: townCenter.z + 17 },
    { x: townCenter.x, z: townCenter.z - 17 },
  ].find((point) => simulation.getPlacementCheck('barracks', point).valid);
  assert.ok(placement, 'construction-retask scenario has a valid Barracks site');
  assert.equal(simulation.placeBuilding('barracks', placement), true, 'construction-retask scenario places a foundation');
  const barracks = simulation.buildings.find((building) => building.type === 'barracks' && building.progress < 1);
  const villagers = simulation.units.filter((unit) => unit.type === 'villager' && unit.faction === 'player');
  assert.equal(barracks.buildAssigned.length, 3, 'all opening villagers begin assigned to the foundation');

  // Primary-clicking a visible unfinished foundation is an explicit resume
  // order when a Villager is already selected. Keep this as an input-level
  // regression so future selection changes cannot silently turn the action
  // back into a building-only selection.
  const clickWorker = villagers[0];
  simulation.selectedIds = [clickWorker.id];
  simulation._syncSelectionFlags();
  let clickResult = null;
  const clickInput = Object.create(CrownforgeInput.prototype);
  clickInput.canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    focus: () => {},
    setPointerCapture: () => {},
  };
  clickInput.renderer = {
    screenToWorld: () => ({ x: barracks.x, z: barracks.z }),
    getEntityAtScreen: () => barracks,
    addRipple: () => {},
    setSelectionBox: () => {},
  };
  clickInput.simulation = simulation;
  clickInput.buildMode = null;
  clickInput.drag = null;
  clickInput.pan = null;
  clickInput.pointer = { x: 0, y: 0 };
  clickInput.wallDrag = null;
  clickInput.onGesture = () => {};
  clickInput.onCommand = (result) => { clickResult = result; };
  clickInput.onSelection = () => {};
  clickInput._updateCursor = () => {};
  clickInput._down({ button: 0, clientX: 0, clientY: 0, pointerId: 1, shiftKey: false });
  clickInput._up({ button: 0, clientX: 0, clientY: 0, pointerId: 1, shiftKey: false });
  assert.equal(clickResult?.kind, 'build', 'primary-clicking an unfinished foundation resumes construction');
  assert.equal(clickWorker.buildTarget, barracks.id, 'primary-click resume assigns the selected Villager');

  const clearPoint = { x: townCenter.x + 40, z: townCenter.z + 32 };
  simulation.selectedIds = villagers.map((unit) => unit.id);
  simulation._syncSelectionFlags();
  simulation.issueContextCommand(clearPoint, { kind: 'ground' });
  // Ordinary ground orders now queue behind active construction. Keep the
  // explicit interruption path covered for tools or future cancel controls.
  villagers.forEach((unit) => simulation._interruptWork(unit));
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

function checkConstructionOrderQueue() {
  const simulation = freshSimulation();
  const townCenter = simulation.buildings.find((building) => building.type === 'townCenter');
  const placement = [
    { x: townCenter.x - 22, z: townCenter.z },
    { x: townCenter.x + 18, z: townCenter.z },
    { x: townCenter.x, z: townCenter.z + 17 },
    { x: townCenter.x, z: townCenter.z - 17 },
  ].find((point) => simulation.getPlacementCheck('barracks', point).valid);
  assert.ok(placement, 'construction queue scenario has a valid Barracks site');
  assert.equal(simulation.placeBuilding('barracks', placement), true, 'construction queue scenario places a foundation');
  const barracks = simulation.buildings.find((building) => building.type === 'barracks' && building.progress < 1);
  const worker = simulation.units.find((unit) => unit.type === 'villager' && unit.faction === 'player');
  assert.ok(barracks && worker, 'construction queue scenario has a foundation and worker');

  simulation.selectedIds = [worker.id];
  simulation._syncSelectionFlags();
  const queuedPoint = { x: townCenter.x + 40, z: townCenter.z + 32 };
  const command = simulation.issueContextCommand(queuedPoint, { kind: 'ground' });
  assert.equal(command.kind, 'move', 'a new ground order remains a move command while construction is active');
  assert.equal(command.success, true, 'a new ground order is accepted while construction is active');
  assert.equal(command.queued, 1, 'the active builder reports one queued order');
  assert.equal(worker.command, 'build', 'the builder keeps the current construction command');
  assert.equal(worker.buildTarget, barracks.id, 'the builder keeps the current foundation target');
  assert.equal(worker.orderQueue.length, 1, 'the new order is stored on the builder');
  assert.match(worker.actionLabel, /queued/, 'the builder task label exposes the queued order');

  simulation.setUnitSpeedScale(10);
  let nearestQueuedDistance = Infinity;
  const queueScenarioSteps = Math.ceil((BUILDING_TYPES.barracks.buildTime + 35) / STEP_60HZ);
  for (let step = 0; step < queueScenarioSteps; step += 1) {
    simulation.update(STEP_60HZ);
    if (barracks.progress >= 1) {
      nearestQueuedDistance = Math.min(nearestQueuedDistance, Math.hypot(worker.x - queuedPoint.x, worker.z - queuedPoint.z));
    }
  }
  assert.equal(barracks.progress, 1, 'the foundation completes before the queued order executes');
  assert.equal(worker.orderQueue.length, 0, 'the queued order is removed after execution begins');
  assert.ok(['move', 'idle'].includes(worker.command), 'the builder transitions into the queued move, settles there, or later begins its safety return');
  assert.ok(nearestQueuedDistance < 3.0, 'the builder reaches the queued destination before the delayed safety return');
}

function checkWallResourcePrecedence() {
  const simulation = freshSimulation();
  clearNaturalResources(simulation);
  const villager = simulation.units.find((unit) => unit.type === 'villager' && unit.faction === 'player');
  assert.ok(villager, 'reset has a builder for wall resource precedence');
  simulation.selectedIds = [villager.id];
  simulation._syncSelectionFlags();

  simulation.addResource('tree', 'wood', 180, 80, 260, 0, { sizeTier: 'medium' });
  simulation.addResource('stone', 'stone', 184, 80, 360, 0, { sizeTier: 'medium' });
  simulation.addResource('berry', 'food', 181, 80.6, 105, 0, { sizeTier: 'small' });
  simulation.addDecoration('pebbles', 182, 80.4, 0, 0.7);
  const unitInWallPath = simulation.addUnit('villager', 183, 80, 'player');
  const tree = simulation.resourcesNodes.find((node) => node.x === 180 && node.z === 80);
  const stone = simulation.resourcesNodes.find((node) => node.x === 184 && node.z === 80);
  const berry = simulation.resourcesNodes.find((node) => node.x === 181 && node.z === 80.6);
  assert.ok(tree && stone, 'wall test has tree and stone obstructions');
  assert.ok(berry && unitInWallPath, 'wall test has a food node and unit in its path');

  simulation.issueContextCommand({ x: tree.x, z: tree.z });
  const preview = simulation.getWallLinePreview({ x: 178, z: 80 }, { x: 184, z: 80 });
  assert.equal(preview.valid, true, 'wall preview accepts trees and stone in its snapped path');
  assert.equal(preview.resourceClearCount, 3, 'wall preview reports all natural resource nodes it will clear');
  assert.equal(simulation.getWallLinePreview({ x: 76, z: 82 }, { x: 84, z: 82 }).valid, false, 'wall still respects building collision');
  assert.equal(simulation.placeWallLine({ x: 178, z: 80 }, { x: 184, z: 80 }), true, 'wall line places through tree and stone');
  assert.equal(simulation.resourcesNodes.some((node) => node.id === tree.id || node.id === stone.id || node.id === berry.id), false, 'wall removes every resource node it replaces');
  assert.equal(simulation.decorations.some((decoration) => decoration.x === 182 && decoration.z === 80.4), false, 'wall clears small ground details it replaces');
  assert.ok(simulation.units.includes(unitInWallPath), 'units yield to wall placement instead of blocking the preview');
  assert.equal(villager.gatherTarget, null, 'cleared resource retasks a worker safely');
  assert.ok(simulation.buildings.some((building) => building.type === 'wall' && building.wallSegments === 3), 'wall keeps its snapped segment run');
}

function checkWallEndpointMagnetism() {
  const simulation = freshSimulation();
  clearNaturalResources(simulation);
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

  const forgivingStart = simulation.getWallLinePreview({ x: 186.4, z: 182.2 }, { x: 195.2, z: 182.2 });
  assert.equal(forgivingStart.wallConnectCount, 1, 'the larger magnetic field catches a nearby off-axis start');
  assert.deepEqual(forgivingStart.wallStart, { x: 189, z: 180 }, 'off-axis start still lands on the exact next segment center');

  const forgivingEnd = simulation.getWallLinePreview({ x: 168, z: 180 }, { x: 187.2, z: 182.2 });
  assert.equal(forgivingEnd.wallConnectCount, 1, 'the larger magnetic field catches a nearby off-axis end');
  assert.deepEqual(forgivingEnd.segments.at(-1), { x: 189, z: 180 }, 'off-axis end lands on the exact connecting segment center');

  const cornerTurn = simulation.getWallLinePreview({ x: 186, z: 180 }, { x: 186, z: 189 });
  assert.equal(cornerTurn.valid, true, 'a turned wall remains placeable at a terminal corner');
  assert.equal(cornerTurn.wallConnectCount, 1, 'a perpendicular turn keeps its magnetic wall connection');
  assert.deepEqual(cornerTurn.wallStart, { x: 187.5, z: 181.5 }, 'a perpendicular turn aligns its first panel edge to the terminal socket');
  assert.ok(cornerTurn.segments.every((segment, index, segments) => index === 0 || Math.abs(Math.hypot(segment.x - segments[index - 1].x, segment.z - segments[index - 1].z) - 3) < 0.001), 'a perpendicular turn preserves exact segment spacing');

  const diagonalTurn = simulation.getWallLinePreview({ x: 186, z: 180 }, { x: 177, z: 171 });
  assert.equal(diagonalTurn.valid, true, 'a diagonal wall turn remains placeable at a terminal corner');
  assert.equal(diagonalTurn.wallConnectCount, 1, 'a diagonal turn keeps its magnetic wall connection');
  assert.deepEqual(diagonalTurn.wallStart, { x: 186.43933982822017, z: 178.93933982822017 }, 'a diagonal turn aligns its first panel edge to the terminal socket');

  const interiorBranch = simulation.getWallLinePreview({ x: 183.2, z: 183.1 }, { x: 183.2, z: 192.2 });
  assert.equal(interiorBranch.valid, true, 'a divider can magnetize to an interior Palisade panel');
  assert.equal(interiorBranch.wallConnectCount, 1, 'interior Palisade sockets report a magnetic connection');
  assert.deepEqual(interiorBranch.wallStart, { x: 183, z: 181.5 }, 'interior branch aligns its first panel edge to the claimed through-wall center');

  const reverseOverlap = simulation.getWallLinePreview({ x: 186, z: 180 }, { x: 177, z: 180 });
  assert.equal(reverseOverlap.valid, true, 'reverse drag may overlap an existing wall run without becoming an error');

  assert.equal(simulation.placeWallLine({ x: 186.4, z: 180.1 }, { x: 195.2, z: 180.1 }), true, 'connected wall line places successfully');
  assert.equal(simulation.buildings.filter((building) => building.type === 'wall').length, 2, 'connected wall remains a separate construction record');

  const edgeSimulation = freshSimulation();
  clearNaturalResources(edgeSimulation);
  const edgeVillager = edgeSimulation.units.find((unit) => unit.type === 'villager' && unit.faction === 'player');
  edgeSimulation.selectedIds = [edgeVillager.id];
  edgeSimulation._syncSelectionFlags();
  edgeSimulation.resources.wood = 99999;
  edgeSimulation.resources.stone = 99999;
  const acrossMap = edgeSimulation.getWallLinePreview(
    { x: 3, z: 230 },
    { x: CONFIG.mapWidth - 3, z: 230 },
  );
  assert.equal(acrossMap.valid, true, 'an edge-to-edge Palisade preview remains placeable');
  assert.equal(acrossMap.wallEdgeSnap, true, 'a long Palisade locks to the map boundary');
  assert.ok(acrossMap.wallSegments > 24, 'Palisade length is no longer capped at 24 segments');
  assert.ok(acrossMap.segments.at(-1).x > CONFIG.mapWidth - 4, 'edge lock reaches the far map boundary');
  const acrossMapBounds = edgeSimulation._buildingEntityBounds({
    type: 'wall',
    x: acrossMap.world.x,
    z: acrossMap.world.z,
    wallSegments: acrossMap.wallSegments,
    wallDirection: acrossMap.wallDirection,
  }, 0);
  assert.ok(acrossMapBounds.minX <= 0 && acrossMapBounds.maxX >= CONFIG.mapWidth, 'edge-to-edge wall collision overlaps both map boundaries and closes the raider-sized gap');

  const verticalEdge = edgeSimulation.getWallLinePreview(
    { x: 300, z: 3 },
    { x: 300, z: CONFIG.mapHeight - 3 },
  );
  assert.equal(verticalEdge.valid, true, 'vertical edge lock remains placeable');
  assert.equal(verticalEdge.wallEdgeSnap, true, 'vertical Palisade locks to the map edge');
  assert.ok(verticalEdge.wallSegments > 24, 'vertical Palisade can span the expanded map');
  const verticalEdgeBounds = edgeSimulation._buildingEntityBounds({
    type: 'wall',
    x: verticalEdge.world.x,
    z: verticalEdge.world.z,
    wallSegments: verticalEdge.wallSegments,
    wallDirection: verticalEdge.wallDirection,
  }, 0);
  assert.ok(verticalEdgeBounds.minZ <= 0 && verticalEdgeBounds.maxZ >= CONFIG.mapHeight, 'vertical edge lock physically seals both map boundaries');
}

function checkWallOverlapAndGate() {
  const simulation = freshSimulation();
  clearNaturalResources(simulation);
  const villager = simulation.units.find((unit) => unit.type === 'villager' && unit.faction === 'player');
  assert.ok(villager, 'reset has a builder for Palisade overlap and gate coverage');
  simulation.selectedIds = [villager.id];
  simulation._syncSelectionFlags();

  simulation.addBuilding('wall', 177, 160, 'player', 1, {
    wallSegments: 5,
    wallOrientation: 'horizontal',
    wallDirection: { x: 1, z: 0 },
    wallStart: { x: 171, z: 160 },
  });
  simulation.addBuilding('wall', 177, 178, 'player', 1, {
    wallSegments: 5,
    wallOrientation: 'horizontal',
    wallDirection: { x: 1, z: 0 },
    wallStart: { x: 171, z: 178 },
  });
  const divider = simulation.getWallLinePreview({ x: 183, z: 160 }, { x: 183, z: 178 });
  assert.equal(divider.valid, true, 'a divider can cross two parallel Palisade rows');
  assert.equal(divider.wallConnectCount, 2, 'a divider magnetically connects to both parallel row ends');
  assert.equal(simulation.placeWallLine({ x: 183, z: 160 }, { x: 183, z: 178 }), true, 'a parallel-row divider places successfully');

  const overlap = simulation.getWallLinePreview({ x: 171, z: 160 }, { x: 183, z: 160 });
  assert.equal(overlap.valid, true, 'a returning Palisade line may overlap an existing run');

  const gateSimulation = freshSimulation();
  clearNaturalResources(gateSimulation);
  const gateBuilder = gateSimulation.units.find((unit) => unit.type === 'villager' && unit.faction === 'player');
  gateSimulation.selectedIds = [gateBuilder.id];
  gateSimulation._syncSelectionFlags();
  const wall = gateSimulation.addBuilding('wall', 177, 160, 'player', 1, {
    wallSegments: 5,
    wallOrientation: 'horizontal',
    wallDirection: { x: 1, z: 0 },
    wallStart: { x: 171, z: 160 },
  });
  const gatePreview = gateSimulation.getBuildingPlacementPreview('gate', { x: 177.2, z: 160.2 });
  assert.equal(gatePreview.valid, true, 'gate preview snaps onto an existing Palisade segment');
  assert.equal(gatePreview.gateWallId, wall.id, 'gate preview identifies the wall it will replace');
  assert.equal(gatePreview.gateOrientation, gateSimulation._gateOrientationFromDirection(gatePreview.gateDirection), 'gate preview resolves the authored atlas cell for the claimed wall direction');
  assert.equal(new Set([
    { x: 1, z: 0 },
    { x: 0, z: 1 },
    { x: 1, z: 1 },
    { x: 1, z: -1 },
  ].map((direction) => gateSimulation._gateOrientationFromDirection(direction))).size, 4, 'the four physical Palisade axes resolve to four distinct gate views');
  assert.equal(gateSimulation.placeBuilding('gate', { x: 177.2, z: 160.2 }, gatePreview), true, 'gate replaces a Palisade panel and places the exact visible foundation preview');
  const gate = gateSimulation.buildings.find((building) => building.type === 'gate' && !building.destroyed);
  assert.ok(gate, 'gate foundation remains as a distinct building');
  assert.equal(gate.gateOrientation, gatePreview.gateOrientation, 'built gate preserves the preview orientation instead of changing direction on click');
  assert.deepEqual(gate.gateDirection, gatePreview.gateDirection, 'built gate remains aligned to the claimed Palisade run');
  assert.equal(gate.walkable ?? BUILDING_TYPES.gate.walkable, true, 'gate blueprint is passable after completion');
  assert.equal(gateSimulation.buildings.filter((building) => building.type === 'wall' && !building.destroyed).length, 2, 'replaced wall keeps connected runs on both sides of the opening');
  assert.equal(wall.destroyed, true, 'the original wall record is retired when the gate claims its panel');

  const overlappedGateSimulation = freshSimulation();
  clearNaturalResources(overlappedGateSimulation);
  const overlappedGateBuilder = overlappedGateSimulation.units.find((unit) => unit.type === 'villager' && unit.faction === 'player');
  overlappedGateSimulation.selectedIds = [overlappedGateBuilder.id];
  overlappedGateSimulation._syncSelectionFlags();
  overlappedGateSimulation.addBuilding('wall', 177, 196, 'player', 1, {
    wallSegments: 5,
    wallOrientation: 'horizontal',
    wallDirection: { x: 1, z: 0 },
    wallStart: { x: 171, z: 196 },
  });
  overlappedGateSimulation.addBuilding('wall', 177, 196, 'player', 1, {
    wallSegments: 5,
    wallOrientation: 'horizontal',
    wallDirection: { x: 1, z: 0 },
    wallStart: { x: 171, z: 196 },
  });
  const overlappedGatePreview = overlappedGateSimulation.getBuildingPlacementPreview('gate', { x: 177, z: 196 });
  assert.equal(overlappedGatePreview.valid, true, 'gate remains placeable over overlapping Palisade runs');
  assert.equal(overlappedGatePreview.gateWallIds.length, 2, 'gate claims every overlapping wall record at the opening');
  assert.equal(overlappedGateSimulation.placeBuilding('gate', { x: 177, z: 196 }), true, 'gate clears overlapping panels without treating them as a blocker');
  assert.equal(overlappedGateSimulation.buildings.filter((building) => building.type === 'wall' && !building.destroyed).length, 4, 'overlapping wall runs retain both sides of the shared opening');

  const towerSimulation = freshSimulation();
  clearNaturalResources(towerSimulation);
  const towerBuilder = towerSimulation.units.find((unit) => unit.type === 'villager' && unit.faction === 'player');
  towerSimulation.selectedIds = [towerBuilder.id];
  towerSimulation._syncSelectionFlags();
  towerSimulation.resourcesNodes = towerSimulation.resourcesNodes.filter((node) => Math.hypot(node.x - 220, node.z - 220) > 8);
  towerSimulation.decorations = towerSimulation.decorations.filter((detail) => Math.hypot(detail.x - 220, detail.z - 220) > 8);
  const towerWall = towerSimulation.addBuilding('wall', 220, 220, 'player', 1, {
    wallSegments: 5,
    wallOrientation: 'horizontal',
    wallDirection: { x: 1, z: 0 },
    wallStart: { x: 214, z: 220 },
  });
  const towerPreview = towerSimulation.getBuildingPlacementPreview('palisadeTower', { x: 220.8, z: 220.6 });
  assert.equal(towerPreview.valid, true, 'Palisade Tower preview magnetizes to an existing wall panel');
  assert.equal(towerPreview.attachmentWallId, towerWall.id, 'Palisade Tower preview records the wall panel it will replace');
  assert.equal(towerSimulation.placeBuilding('palisadeTower', { x: 220.8, z: 220.6 }), true, 'Palisade Tower replaces its claimed panel and places a construction site');
  assert.ok(towerSimulation.buildings.some((building) => building.type === 'palisadeTower' && !building.destroyed), 'Palisade Tower remains as a selectable building');
  assert.equal(towerSimulation.buildings.filter((building) => building.type === 'wall' && !building.destroyed).length, 2, 'tower replacement preserves connected wall runs on both sides');
  assert.equal(towerWall.destroyed, true, 'original wall record retires when the tower claims its panel');

  const cornerSimulation = freshSimulation();
  clearNaturalResources(cornerSimulation);
  const cornerBuilder = cornerSimulation.units.find((unit) => unit.type === 'villager' && unit.faction === 'player');
  cornerSimulation.selectedIds = [cornerBuilder.id];
  cornerSimulation._syncSelectionFlags();
  cornerSimulation.resourcesNodes = cornerSimulation.resourcesNodes.filter((node) => Math.hypot(node.x - 242, node.z - 242) > 10);
  cornerSimulation.decorations = cornerSimulation.decorations.filter((detail) => Math.hypot(detail.x - 242, detail.z - 242) > 10);
  const cornerHorizontal = cornerSimulation.addBuilding('wall', 236, 240, 'player', 1, {
    wallSegments: 5,
    wallOrientation: 'horizontal',
    wallDirection: { x: 1, z: 0 },
    wallStart: { x: 230, z: 240 },
  });
  const cornerVertical = cornerSimulation.addBuilding('wall', 243.5, 244.5, 'player', 1, {
    wallSegments: 3,
    wallOrientation: 'vertical',
    wallDirection: { x: 0, z: 1 },
    wallStart: { x: 243.5, z: 241.5 },
  });
  const cornerSocket = cornerSimulation.getPalisadeJunctions()
    .find((junction) => Math.hypot(junction.x - 243.5, junction.z - 240) < 0.2);
  assert.ok(cornerSocket, 'two turned Palisade runs resolve to one shared corner socket');
  assert.equal(cornerSocket.branchCount, 2, 'ordinary corner socket records exactly two wall branches');
  const junctionRenderer = Object.create(CrownforgeRenderer.prototype);
  junctionRenderer.palisadeJunctionCacheKey = '';
  junctionRenderer.palisadeJunctionCache = [];
  junctionRenderer.isWorldVisible = () => true;
  const cornerJunctionEntities = junctionRenderer.palisadeJunctionEntities(cornerSimulation);
  assert.equal(cornerJunctionEntities.length, 1, 'ordinary two-way corners receive one wall-height grounded binding');
  assert.equal(cornerJunctionEntities[0].branchCount, 2, 'ordinary corner binding retains its two-branch classification');
  const cornerJunctions = cornerSimulation.getPalisadeJunctions();
  const cornerPanelEntities = [cornerHorizontal, cornerVertical]
    .flatMap((wall) => junctionRenderer.wallSegmentEntities(wall, cornerJunctions));
  assert.equal(cornerPanelEntities.length, 8, 'each wall panel is expanded into its own depth-sorted render entity at a corner');
  assert.ok(cornerPanelEntities.every((panel) => panel.kind === 'wall-segment' && panel.wallSegments === 1), 'corner panel render entities preserve one grounded panel apiece');
  assert.equal(cornerPanelEntities.filter((panel) => panel.wallJunctionClip).length, 2, 'both terminal paintings stop at the same physical corner socket');
  const cornerOccupant = cornerSimulation.addUnit('villager', 243.5, 240, 'player');
  const cornerTowerPreview = cornerSimulation.getBuildingPlacementPreview('palisadeTower', { x: 243.7, z: 240.1 });
  assert.equal(cornerTowerPreview.valid, true, 'corner tower preview snaps to the shared wall socket');
  assert.equal(cornerTowerPreview.attachmentJunction, true, 'corner tower preview is identified as a junction hardpoint');
  assert.equal(cornerTowerPreview.attachmentWallIds.length, 2, 'corner tower claims both participating wall runs');
  assert.equal(cornerTowerPreview.attachmentClaims.length, 2, 'corner tower claims one terminal panel from each branch');
  assert.equal(cornerTowerPreview.attachmentConnectorSegments.length, 2, 'corner tower preserves one visual connector panel for each claimed wall branch');
  assert.equal(cornerSimulation.placeBuilding('palisadeTower', { x: 243.7, z: 240.1 }, cornerTowerPreview), true, 'corner tower replaces both wall terminals with one aligned hardpoint');
  const cornerTower = cornerSimulation.buildings.find((building) => building.type === 'palisadeTower' && !building.destroyed);
  assert.ok(cornerTower, 'corner tower remains as the shared hardpoint building');
  assert.equal(cornerTower.attachmentConnectorSegments.length, 2, 'built corner tower retains both behind-tower wall connectors');
  cornerTower.progress = 1;
  const towerConnectorRenderer = Object.create(CrownforgeRenderer.prototype);
  assert.equal(towerConnectorRenderer.palisadeTowerConnectorEntities(cornerSimulation).length, 2, 'renderer supplies both correctly oriented connector panels behind a corner tower');
  assert.equal(cornerHorizontal.destroyed, true, 'corner tower retires the horizontal source run');
  assert.equal(cornerVertical.destroyed, true, 'corner tower retires the vertical source run');
  assert.deepEqual(BUILDING_TYPES.palisadeTower.collisionOffset, { x: 0, z: 0 }, 'tower collision body is centered beneath the visible tower art');
  assert.equal(insideBuilding(cornerOccupant, cornerTower, 0.15), false, 'unit standing on a new corner tower socket is moved outside the tower footprint');

  assert.deepEqual(FIRST_AGE_ASSETS.gate.cellByOrientation['diagonal-right'], { column: 1, row: 0 }, 'diagonal-right gate uses the falling-to-screen-right authored cell');
  assert.deepEqual(FIRST_AGE_ASSETS.gate.cellByOrientation['diagonal-left'], { column: 0, row: 0 }, 'diagonal-left gate uses the rising-to-screen-right authored cell');
  assert.ok(FIRST_AGE_ASSETS.wall.groundAnchorY < 0.9 && FIRST_AGE_ASSETS.wallDiagonalLeft.groundAnchorY < 0.9, 'diagonal Palisade views anchor on their ground-footprint centers');
  assert.ok(FIRST_AGE_ASSETS.wallDepth.groundAnchorY < 0.6, 'depth Palisade view anchors at the midpoint of its receding footprint');
  const towerAnchors = [
    FIRST_AGE_ASSETS.palisadeTower.groundAnchorY,
    ...Object.values(FIRST_AGE_ASSETS.palisadeTower.constructionAtlas.groundAnchorByCell),
  ];
  assert.ok(Math.max(...towerAnchors) - Math.min(...towerAnchors) <= 0.14, 'tower construction and completion stages stay centered on one visible ground socket');
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
  assert.equal(hall.collisionClearance, 1.8, 'Crown Hall keeps its authored economy and placement clearance');
  assert.equal(hall.unitExclusionPadding, 1.8, 'Crown Hall adds an expanded no-entry ring for moving units and attackers');
  assert.equal(hall.stairAccess.topOffset, 5, 'Crown Hall stair landing scales with the landmark');
  assert.equal(hall.stairAccess.outerOffset, 9, 'Crown Hall stair approach scales with the landmark');

  const simulation = freshSimulation();
  const center = simulation.buildings.find((building) => building.type === 'townCenter');
  const sites = {
    north: { x: center.x, z: center.z - 19 },
    east: { x: center.x + 14, z: center.z },
    south: { x: center.x, z: center.z + 11 },
    west: { x: center.x - 20, z: center.z },
  };
  for (const [side, point] of Object.entries(sites)) {
    const check = simulation.getPlacementCheck('wall', point);
    assert.equal(check.valid, true, `Hall has a buildable meadow opening on the ${side} side`);
  }
}

function checkBuildingPhysicalInteractionBoundaries() {
  const physicalTypes = Object.entries(BUILDING_TYPES)
    .filter(([, blueprint]) => !blueprint.wall && !blueprint.gate && !blueprint.walkable)
    .map(([type]) => type);
  for (const type of physicalTypes) {
    const blueprint = BUILDING_TYPES[type];
    assert.ok(blueprint.collisionFootprint, `${blueprint.label} defines an artwork-matched physical footprint`);
    assert.ok(blueprint.collisionFootprint.width >= blueprint.footprint.width, `${blueprint.label} physical width covers its gameplay footprint`);
    assert.ok(blueprint.collisionFootprint.height >= blueprint.footprint.height, `${blueprint.label} physical depth covers its gameplay footprint`);
    assert.ok(blueprint.interactionSlots >= 4, `${blueprint.label} exposes several perimeter interaction stations`);

    const simulation = movementSandbox();
    const building = simulation.addBuilding(type, 200, 200, type === 'ashenCamp' ? 'enemy' : 'player');
    const center = simulation._buildingCollisionCenter(building);
    const unit = simulation.addUnit('villager', center.x, center.z, 'player');
    simulation._constrainUnitPosition(unit, center.x, center.z);
    assert.equal(insideBuilding(unit, building), false, `${blueprint.label} collision ejects a unit from its illustrated base`);
    for (const point of simulation._buildingApproachPoints(building)) {
      assert.equal(insideBuilding(point, building), false, `${blueprint.label} interaction station remains outside the illustrated base`);
    }
  }

  const storageSimulation = movementSandbox();
  const hall = storageSimulation.addBuilding('townCenter', 100, 100, 'player');
  const workers = [[110, 112], [113, 109], [116, 112]]
    .map(([x, z]) => storageSimulation.addUnit('villager', x, z, 'player'));
  for (const worker of workers) {
    worker.carryType = 'wood';
    worker.carryAmount = 5;
    assert.equal(storageSimulation._beginReturn(worker), true, `Villager ${worker.id} receives a safe Crown Hall drop-off route`);
    assert.equal(insideBuilding(worker.routeTarget, hall), false, `Villager ${worker.id} drop-off target stays outside Crown Hall artwork`);
  }
  assert.equal(new Set(workers.map((worker) => worker.returnSlot)).size, workers.length, 'simultaneous drop-offs reserve distinct Crown Hall stations');
  advance(storageSimulation, 20);
  assert.equal(workers.every((worker) => worker.carryAmount === 0), true, 'simultaneous Crown Hall drop-offs complete');
  assert.equal(hall.storageSlotReservations.size, 0, 'drop-off reservations release after cargo is stored');
  assert.equal(workers.every((worker) => !insideBuilding(worker, hall, 0.12)), true, 'workers remain outside the Crown Hall after depositing');

  const constructionSimulation = movementSandbox();
  const barracks = constructionSimulation.addBuilding('barracks', 100, 100, 'player', 0.04);
  const builders = [[119, 116], [122, 112], [116, 120], [124, 118]]
    .map(([x, z]) => constructionSimulation.addUnit('villager', x, z, 'player'));
  for (const [index, builder] of builders.entries()) {
    builder.buildTarget = barracks.id;
    assert.equal(constructionSimulation._sendUnitToBuilding(builder, barracks, index), true, `builder ${builder.id} receives a Barracks perimeter route`);
    assert.equal(insideBuilding(builder.routeTarget, barracks), false, `builder ${builder.id} works outside the Barracks artwork`);
  }
  assert.equal(new Set(builders.map((builder) => builder.buildSlot)).size, builders.length, 'builders reserve distinct Barracks work stations');
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

function checkVillagerRecovery() {
  const simulation = movementSandbox();
  const hall = simulation.addBuilding('townCenter', 20, 20, 'player');
  const blocked = simulation.addUnit('villager', 8, 8, 'player');
  const secondBlocked = simulation.addUnit('villager', 10, 8, 'player');
  blocked.pathBlocked = true;
  blocked.recoveryAvailable = true;
  blocked.carryType = 'wood';
  blocked.carryAmount = 9;
  secondBlocked.pathBlocked = true;
  secondBlocked.recoveryAvailable = true;
  simulation.selectedIds = [blocked.id, secondBlocked.id];
  simulation._syncSelectionFlags();
  const beforeWood = simulation.resources.wood;
  assert.equal(simulation.canRecoverSelectedUnits(), true, 'blocked Villagers expose the recovery action');
  const result = simulation.unstickSelectedUnits();
  assert.equal(result.success, true, 'selected blocked Villagers recover successfully');
  assert.equal(result.count, 2, 'recovery handles a selected group');
  assert.equal(simulation.resources.wood, beforeWood + 9, 'recovery deposits carried cargo at the Crown Hall');
  assert.equal(blocked.command, 'idle', 'recovered Villager is ready for a new command');
  assert.equal(blocked.path.length, 0, 'recovery clears the old blocked path');
  assert.equal(blocked.pathBlocked, false, 'recovery clears the blocked state');
  assert.equal(simulation._pointBlockedForUnit(blocked, blocked), false, 'recovered Villager stands on a valid approach point');
  assert.equal(simulation._pointBlockedForUnit(secondBlocked, secondBlocked), false, 'second recovered Villager stands on a valid approach point');
  assert.ok(Math.hypot(blocked.x - secondBlocked.x, blocked.z - secondBlocked.z) >= blocked.spacingRole.personalSpace, 'recovered Villagers keep personal spacing');
  assert.equal(insideBuilding(blocked, hall), false, 'recovered Villager is outside the Crown Hall footprint');
  assert.equal(simulation.canRecoverSelectedUnits(), true, 'recovery remains available after a successful recovery for deliberate repositioning');

  const idle = simulation.addUnit('villager', 32, 32, 'player');
  simulation.selectedIds = [idle.id];
  simulation._syncSelectionFlags();
  assert.equal(simulation.canRecoverSelectedUnits(), true, 'ordinary idle Villagers can always be returned to the Crown Hall');
  const soldier = simulation.addUnit('soldier', 36, 36, 'player');
  simulation.selectedIds = [soldier.id];
  simulation._syncSelectionFlags();
  assert.equal(simulation.canRecoverSelectedUnits(), true, 'recovery is available for every selected living player unit, not only Villagers');
  assert.equal(simulation.unstickSelectedUnits().success, true, 'a selected military unit can be recovered from a bad fortification pocket');
}

function checkAshenForagerMotionAndFieldWorker() {
  const simulation = movementSandbox();
  const field = simulation.addBuilding('ashenField', 80, 80, 'enemy');
  const forager = simulation.addUnit('ashenForager', 72, 80, 'enemy');
  forager.command = 'gather';
  forager.visualState = 'wood';
  forager.gatherTarget = { id: 'test-wood-node' };
  simulation.navigationVersion += 1;
  simulation.staticBlockerGridVersion = -1;
  simulation.update(STEP_60HZ);
  assert.equal(field.farmerId, forager.id, 'completed fields assign a real Ashen Forager instead of a placeholder');
  assert.equal(forager.fieldTarget, field.id, 'assigned Ashen Forager receives the field work target');
  assert.equal(forager.command, 'field', 'assigned Ashen Forager receives a field work order');
  assert.equal(forager.visualState, 'walk', 'assigned Ashen Forager uses the walk state while approaching the field');

  const mover = simulation.addUnit('ashenForager', 40, 40, 'enemy');
  mover.command = 'move';
  mover.visualState = 'walk';
  mover.path = [{ x: 46, z: 46 }];
  mover.routeTarget = { x: 46, z: 46 };
  simulation._updateUnit(mover, STEP_60HZ);
  assert.ok(mover.animationPlaybackRate >= 0.78, 'a moving Ashen Forager keeps its walk cycle alive at low route speed');
  assert.equal(resolveAnimationState(mover), 'walk', 'a moving Ashen Forager never resolves to a static task pose');
}

function checkAshenSettlementEconomyAndAI() {
  const buildingRolePairs = [
    ['townCenter', 'ashenCamp'],
    ['barracks', 'reaverLodge'],
    ['stable', 'beastCorral'],
    ['granary', 'smokeGranary'],
    ['homestead', 'hideHomestead'],
    ['watchHut', 'signalRoost'],
    ['timberYard', 'ashenTimberRack'],
    ['stonewrightYard', 'stonebreakYard'],
    ['oreWash', 'oreHearth'],
    ['field', 'ashenField'],
    ['wall', 'ashenWall'],
    ['gate', 'ashenGate'],
    ['palisadeTower', 'ashenTower'],
  ];
  for (const [playerType, enemyType] of buildingRolePairs) {
    assert.ok(BUILDING_TYPES[playerType], `${playerType} player role remains registered`);
    assert.ok(BUILDING_TYPES[enemyType], `${enemyType} Ashen role is registered`);
    const enemyAsset = ASHEN_BUILDING_ASSETS[enemyType];
    assert.ok(enemyAsset, `${enemyType} has a production Ashen asset`);
    const enemySource = enemyAsset.src ?? enemyAsset.atlas?.src;
    const playerAssetKey = BUILDING_TYPES[playerType].asset;
    const playerAsset = FIRST_AGE_ASSETS[playerAssetKey];
    assert.match(enemySource, /crownforge-(?:ashen|reaver|beast)/, `${enemyType} uses the distinct Ashen visual family`);
    if (playerAsset?.src) assert.notEqual(enemySource, playerAsset.src, `${enemyType} does not recolor ${playerType}`);
  }

  const unitRolePairs = [
    ['villager', 'ashenForager'],
    ['soldier', 'raider'],
    ['scout', 'ashenOutrider'],
    ['spearwarden', 'thornSpear'],
    ['militia', 'hearthLevy'],
    ['shieldbearer', 'hidewall'],
  ];
  for (const [playerType, enemyType] of unitRolePairs) {
    assert.ok(UNIT_TYPES[playerType], `${playerType} player unit role remains registered`);
    assert.ok(UNIT_TYPES[enemyType], `${enemyType} Ashen counterpart is registered`);
    assert.notEqual(UNIT_TYPES[enemyType].combatAtlas, UNIT_TYPES[playerType].combatAtlas, `${enemyType} has distinct character artwork from ${playerType}`);
  }
  assert.equal(UNIT_TYPES.ashenForager.worker, true, 'Ashen Forager participates in the shared worker economy');
  assert.equal(UNIT_TYPES.ashenForager.canBuild, true, 'Ashen Forager uses the shared construction foundation');
  assert.equal(UNIT_TYPES.villager.race, 'hearthkin', 'Crownwarden worker belongs to the Hearthkin race');
  assert.equal(UNIT_TYPES.ashenForager.race, 'hearthkin', 'Ashen worker belongs to the Hearthkin race');
  assert.equal(UNIT_TYPES.villager.label, 'Hearthkin', 'Crownwarden worker uses the shared Hearthkin name');
  assert.equal(UNIT_TYPES.ashenForager.label, 'Hearthkin', 'Ashen worker uses the shared Hearthkin name');
  for (const ability of ['worker', 'canBuild', 'canAttackUnits', 'canAttackBuildings', 'repairRate', 'autoBuildRadius', 'regroupAtTownCenter']) {
    assert.deepEqual(UNIT_TYPES.ashenForager[ability], UNIT_TYPES.villager[ability], `Hearthkin workers share the ${ability} ability`);
  }
  assert.deepEqual(UNIT_TYPES.ashenForager.stunOnHit, UNIT_TYPES.villager.stunOnHit, 'Hearthkin workers share defensive stun behavior');
  assert.deepEqual(UNIT_TYPES.ashenForager.lastLightWard, UNIT_TYPES.villager.lastLightWard, 'Hearthkin workers share Last Light Ward');
  for (const type of ['ashenForager', 'raider', 'ashenOutrider', 'thornSpear', 'hearthLevy', 'hidewall']) {
    assert.ok(PRODUCTION_TYPES[type], `${type} has a restrained production contract`);
  }

  const simulation = freshSimulation();
  const camp = simulation.buildings.find((building) => building.type === 'ashenCamp' && building.faction === 'enemy');
  assert.ok(camp, 'reset includes one Ashen Hearth on the far side of the map');
  assert.equal(simulation._enemyWorkers().length, 3, 'Ashen settlement opens with three original Foragers');
  assert.equal(simulation._enemyMilitary().length, 1, 'Ashen settlement opens with one readable defender');
  assert.deepEqual(simulation.enemyResources, ENEMY_AI.startingResources, 'Ashen economy starts from its own restrained resource bank');

  advance(simulation, 180, STEP_20HZ);
  assert.equal(simulation.enemyAIState.raidCount, 0, 'easy AI does not raid during the three-minute build window');
  assert.ok(simulation._enemyTownBuildings().length >= 3, 'Ashen workers establish a small town before the first raid');
  assert.ok(simulation._enemyWorkers().length <= ENEMY_AI.maxWorkers, 'Ashen worker population respects its cap');
  assert.ok(simulation._enemyMilitary().length <= ENEMY_AI.maxArmy, 'Ashen army respects its cap during buildup');
  assert.notDeepEqual(simulation.enemyResources, ENEMY_AI.startingResources, 'Ashen workers gather and spend from their own economy');

  advance(simulation, 75, STEP_20HZ);
  const enemyBuildings = simulation._enemyTownBuildings();
  const enemyBuildingTypes = new Set(enemyBuildings.map((building) => building.type));
  for (const type of ['hideHomestead', 'smokeGranary', 'reaverLodge']) {
    assert.ok(enemyBuildingTypes.has(type), `slow Ashen build plan reaches ${type}`);
  }
  assert.ok(enemyBuildings.filter((building) => building.progress >= 1).length >= 4, 'Ashen town contains several completed structures after four minutes');
  assert.ok(enemyBuildings.length <= ENEMY_AI.maxTownStructures, 'Ashen town respects its structure cap');
  const queuedWorkers = enemyBuildings.reduce((sum, building) => sum
    + (building.productionQueue ?? []).filter((order) => UNIT_TYPES[order.type]?.worker).length, 0);
  const queuedArmy = enemyBuildings.reduce((sum, building) => sum
    + (building.productionQueue ?? []).filter((order) => !UNIT_TYPES[order.type]?.worker).length, 0);
  assert.ok(simulation._enemyWorkers().length + queuedWorkers <= ENEMY_AI.maxWorkers, 'trained and queued Foragers stay within the worker cap');
  assert.ok(simulation._enemyMilitary().length + queuedArmy <= ENEMY_AI.maxArmy, 'trained and queued fighters stay within the army cap');
  assert.equal(simulation.enemyAIState.raidCount, 0, 'Ashen raids remain forest-gated while no route crosses the old-growth divide');
  assert.equal(simulation.enemyAIState.raidWaveIds.length, 0, 'the AI does not strand a raid wave against an unopened forest wall');
  assert.ok(Object.values(simulation.enemyResources).every((value) => Number.isFinite(value) && value >= 0), 'Ashen resource bank remains finite and non-negative');
}

function checkExpandedWorldAndEnemyDistance() {
  const simulation = freshSimulation();
  assert.equal(CONFIG.mapWidth, 560, 'expanded map width is ten-area scale');
  assert.equal(CONFIG.mapHeight, 460, 'expanded map height is ten-area scale');
  const hall = simulation.buildings.find((building) => building.type === 'townCenter');
  const camp = simulation.buildings.find((building) => building.type === 'ashenCamp');
  assert.ok(Math.hypot(camp.x - hall.x, camp.z - hall.z) > 500, 'enemy camp starts across the expanded map');
  assert.ok(hall.x > CONFIG.mapWidth * 0.1 && hall.z > CONFIG.mapHeight * 0.1, 'Crown Hall starts inside the map rather than on the north-west tip');
  const wildwood = simulation.resourcesNodes.filter((node) => node.type === 'grove' && node.sizeTier === 'wildwood');
  const forestTrees = simulation.resourcesNodes.filter((node) => node.type === 'tree' && node.forestClusterId);
  assert.equal(wildwood.length, 0, 'expanded map no longer seeds macro Wildwood grove entities');
  assert.ok(forestTrees.length >= 3000, 'expanded map is dominated by individually harvestable old-growth trees');
  assert.ok(new Set(forestTrees.map((node) => node.forestClusterId)).size >= 900, 'forest trees retain deterministic cluster provenance without sharing a depletion image');
  assert.ok(forestTrees.every((node) => node.sizeTier === 'small' && node.maxAmount > 0 && node.amount === node.maxAmount), 'generated forest entries start as independent full tree resources');
  assert.ok(resourceFootprint(forestTrees[0]) > resourceFootprint({ type: 'tree', sizeTier: 'small' }), 'forest trees reserve their own readable physical space for movement and gathering');
  let woodedSamples = 0;
  let totalSamples = 0;
  for (let z = 8; z < CONFIG.mapHeight; z += 8) {
    for (let x = 8; x < CONFIG.mapWidth; x += 8) {
      totalSamples += 1;
      if (forestTrees.some((node) => Math.hypot(node.x - x, node.z - z) <= 14)) woodedSamples += 1;
    }
  }
  const woodedCoverage = woodedSamples / totalSamples;
  assert.ok(woodedCoverage >= 0.72 && woodedCoverage <= 0.84, 'wildwood physically covers roughly eighty percent while preserving authored clearings');
  assert.ok(simulation.resourcesNodes.some((node) => node.resourceType === 'food'), 'wildwood clearings include forage pockets');
  assert.ok(simulation.resourcesNodes.some((node) => node.resourceType === 'stone'), 'wildwood clearings include stone pockets');
  const goldNodes = simulation.resourcesNodes.filter((node) => node.resourceType === 'gold');
  assert.ok(goldNodes.length >= 4 && goldNodes.length <= 6, 'wildwood map keeps Gold regional and scarce inside authored glades');
  assert.deepEqual(new Set(goldNodes.map((node) => node.sizeTier)), new Set(['medium', 'large']), 'wildwood Gold glades use durable medium and large deposits');
  assert.ok(goldNodes.some((node) => node.x < CONFIG.mapWidth / 2 && node.z < CONFIG.mapHeight / 2), 'Gold exists in the player-side half');
  assert.ok(goldNodes.some((node) => node.x > CONFIG.mapWidth / 2 && node.z > CONFIG.mapHeight / 2), 'Gold exists in the enemy-side half');
  assert.equal(simulation.resourcesNodes.some((node) => node.type === 'grain'), false, 'reset does not seed cultivated Grain Fields');
  assert.equal(simulation.buildings.some((building) => building.type === 'field'), false, 'fields remain exclusively player-built');
  const playerVillager = simulation.units.find((unit) => unit.type === 'villager' && unit.faction === 'player');
  const routeAcrossWildwood = simulation._buildPath(playerVillager, { x: camp.x, z: camp.z - 24 });
  assert.equal(routeAcrossWildwood, null, 'opposing settlements cannot meet before cutting through the harvestable wildwood divide');
  forestTrees.forEach((node) => {
    node.amount = 0;
    node.depleted = true;
  });
  simulation.navigationVersion += 1;
  simulation.staticBlockerGridVersion = -1;
  simulation.pathCache.clear();
  assert.ok(simulation._buildPath(playerVillager, { x: camp.x, z: camp.z - 24 }), 'clearing the individual forest blockers opens the cross-map route');
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

function checkGroundedWorldAssets() {
  const renderer = Object.create(CrownforgeRenderer.prototype);
  assert.equal(renderer.assetGroundAnchorY(FIRST_AGE_ASSETS.granary), 0.8799, 'Granary uses its visible foundation baseline instead of the transparent plate bottom');
  assert.equal(renderer.assetGroundAnchorY(FIRST_AGE_ASSETS.field), 0.9697, 'Grain Field uses an authored ground baseline');
  assert.equal(renderer.assetGroundAnchorY(ENVIRONMENT_ATLAS, 0, 1), 0.944, 'Berry and stone atlas cells share their audited meadow baseline');
  assert.equal(renderer.assetGroundAnchorY(TREE_ATLAS, 2, 0), 0.9453, 'Tree variants meet the meadow at their visible root band');
  assert.equal(renderer.assetGroundAnchorY(TREE_GROVE_ATLAS, 0, 1), 0.9011, 'depleted grove stages use cell-specific baselines');
  assert.equal(renderer.assetGroundAnchorY(GOLD_DEPOSIT_ASSETS.small), 0.8018, 'small Gold node no longer inherits its large transparent lower margin');
  assert.equal(renderer.assetGroundAnchorY(LARGE_STONE_ASSET), 0.9561, 'large Stone uses its audited contact edge');
  assert.equal(renderer.assetGroundAnchorY({ groundAnchorY: -4 }), 0.5, 'invalid low ground metadata is clamped safely');
  assert.equal(renderer.assetGroundAnchorY({ groundAnchorY: 4 }), 1.05, 'invalid high ground metadata is clamped safely');

  const completed = {
    id: 1,
    type: 'granary',
    faction: 'player',
    x: 10,
    z: 10,
    progress: 1,
    hp: 350,
    maxHp: 350,
    selected: false,
    destroyed: false,
    destroyAge: 0,
    hitFlash: 0,
    demolitionQueued: false,
  };
  renderer.camera = { zoom: 1 };
  renderer.worldToScreen = () => ({ x: 200, y: 200 });
  renderer.buildingRenderSize = () => 420;
  renderer.buildingVisualHeight = () => 280;
  renderer.drawBuildingStage = () => {};
  renderer.drawBuildingDamageTreatment = () => {};
  renderer.drawHealthBar = () => {};
  const noopContext = {
    save() {},
    restore() {},
    beginPath() {},
    ellipse() {},
    stroke() {},
    setLineDash() {},
  };
  let footprintDraws = 0;
  renderer.drawBuildingFootprint = () => { footprintDraws += 1; };
  renderer.drawBuilding(noopContext, completed, 0);
  assert.equal(footprintDraws, 0, 'completed unselected buildings do not paint permanent collision diamonds');
  renderer.drawBuilding(noopContext, { ...completed, selected: true }, 0);
  assert.equal(footprintDraws, 1, 'selected buildings retain clear footprint feedback');
  renderer.drawConstructionTreatment = () => {};
  renderer.drawBuilding(noopContext, { ...completed, id: 2, progress: 0.5, hp: 175 }, 0);
  assert.equal(footprintDraws, 2, 'active construction retains placement and collision feedback');
}

function checkCrownHallHostileExclusionAndCombatRecovery() {
  const exclusion = movementSandbox();
  const hall = exclusion.addBuilding('townCenter', 100, 100, 'player');
  const center = exclusion._buildingCollisionCenter(hall);
  const radius = UNIT_TYPES.raider.radius + 0.11;
  const bounds = exclusion._buildingEntityBounds(hall, radius + BUILDING_TYPES.townCenter.unitExclusionPadding);
  const raiders = [
    { x: bounds.minX + 0.16, z: center.z },
    { x: bounds.maxX - 0.16, z: center.z },
    { x: center.x, z: bounds.minZ + 0.16 },
    { x: center.x, z: bounds.maxZ - 0.16 },
  ].map((point) => exclusion.addUnit('raider', point.x, point.z, 'enemy'));
  advance(exclusion, 0.2);
  for (const raider of raiders) {
    assert.equal(exclusion._pointBlockedForUnit(raider, raider), false, `Raider ${raider.id} is expelled from the Crown Hall boundary`);
    assert.equal(insideBuilding(raider, hall), false, `Raider ${raider.id} remains outside the Crown Hall artwork`);
  }

  const combat = movementSandbox();
  const combatHall = combat.addBuilding('townCenter', 100, 100, 'player');
  const combatCenter = combat._buildingCollisionCenter(combatHall);
  const embeddedRaider = combat.addUnit('raider', combatCenter.x, combatCenter.z, 'enemy');
  const guard = combat.addUnit('soldier', combatCenter.x - 16, combatCenter.z, 'player');
  combat.selectedIds = [guard.id];
  const command = combat.issueContextCommand(embeddedRaider, embeddedRaider);
  assert.equal(command.success, true, 'direct attack order accepts an enemy embedded in a building boundary');
  assert.equal(insideBuilding(embeddedRaider, combatHall), false, 'embedded enemy is recovered to the Hall perimeter before routing');
  assert.equal(guard.command, 'attack', 'Crown Guard receives an attack command after target recovery');
  assert.ok(guard.path.length > 0, 'Crown Guard receives a reachable melee approach');
  assert.notEqual(guard.actionLabel, 'No opening to attack', 'embedded target no longer triggers the former attack blocker');
  advance(combat, 12);
  assert.ok(embeddedRaider.dead || embeddedRaider.hp < embeddedRaider.maxHp, 'Crown Guard lands damage on the recovered Raider');
}

function checkVillagerLastStandDefense() {
  const villagerRules = UNIT_TYPES.villager;
  const raiderRules = UNIT_TYPES.raider;
  assert.ok(Math.abs(villagerRules.attack * 20 - raiderRules.maxHp) < 1e-9, 'twenty clean Villager hits equal one Raider health pool');
  assert.equal(villagerRules.canAttackUnits, true, 'Villagers may defend against hostile units');
  assert.equal(villagerRules.canAttackBuildings, false, 'Villagers do not replace military units against structures');
  assert.equal(villagerRules.stunOnHit.duration, 5, 'defensive strike stun lasts five seconds');
  assert.equal(villagerRules.stunOnHit.immunityDuration, 20, 'stun recovery grants twenty seconds of immunity');
  assert.equal(villagerRules.lastLightWard.duration, 60, 'Last Light Ward lasts one minute');
  assert.ok(raiderRules.attackVsVillager >= villagerRules.maxHp, 'an unwarded Raider strike is lethal to a Villager');

  const damageSimulation = movementSandbox();
  const damageVillager = damageSimulation.addUnit('villager', 10, 10, 'player');
  const damageRaider = damageSimulation.addUnit('raider', 12, 10, 'enemy');
  for (let hit = 0; hit < 19; hit += 1) damageSimulation._applyUnitDamage(damageRaider, villagerRules.attack, damageVillager);
  assert.equal(damageRaider.dead, false, 'Raider survives nineteen Villager hits');
  assert.ok(damageRaider.hp > 0 && damageRaider.hp <= villagerRules.attack + 1e-8, 'nineteen hits leave exactly one Villager strike of Raider health');
  damageSimulation._applyUnitDamage(damageRaider, villagerRules.attack, damageVillager);
  assert.equal(damageRaider.dead, true, 'twentieth Villager hit defeats a Raider');

  const stunSimulation = movementSandbox();
  const stunVillager = stunSimulation.addUnit('villager', 10, 10, 'player');
  const stunRaider = stunSimulation.addUnit('raider', 12, 10, 'enemy');
  assert.equal(stunSimulation._tryApplyVillagerStun(stunVillager, stunRaider), true, 'first Villager contact stuns a humanoid Raider');
  assert.equal(stunRaider.stunTimer, 5, 'stun starts at five seconds');
  stunRaider.stunTimer = 3;
  assert.equal(stunSimulation._tryApplyVillagerStun(stunVillager, stunRaider), false, 'additional hits do not refresh an active stun');
  assert.equal(stunRaider.stunTimer, 3, 'active stun duration is not extended by a swarm');
  stunSimulation._updateUnitStatusEffects(stunRaider, 3.01);
  assert.equal(stunRaider.stunTimer, 0, 'stun releases after its duration');
  assert.equal(stunRaider.stunImmunityTimer, 20, 'released Raider gains the full immunity window');
  assert.equal(stunRaider.attackTarget, stunVillager.id, 'released Raider becomes aggressive toward the Villager that stunned it');
  assert.equal(stunSimulation._tryApplyVillagerStun(stunVillager, stunRaider), false, 'immunity prevents immediate stun locking');
  const immuneHp = stunRaider.hp;
  stunSimulation._applyUnitDamage(stunRaider, villagerRules.attack, stunVillager);
  assert.ok(stunRaider.hp < immuneHp, 'stun immunity does not grant damage immunity');

  const immediateAggro = movementSandbox();
  const aggroVillager = immediateAggro.addUnit('villager', 20, 20, 'player');
  const aggroRaider = immediateAggro.addUnit('raider', 22, 20, 'enemy');
  aggroRaider.stunImmunityTimer = 20;
  assert.equal(immediateAggro._aggroTargetOnVillager(aggroVillager, aggroRaider), true, 'a hostile struck by a Villager immediately accepts the Villager as its aggro target');
  assert.equal(aggroRaider.attackTarget, aggroVillager.id, 'Villager retaliation points at the Villager who started the fight');
  assert.equal(aggroRaider.command, 'attack', 'Villager retaliation starts without waiting for the enemy intent service');

  const commandSimulation = movementSandbox();
  const carryingVillager = commandSimulation.addUnit('villager', 10, 10, 'player');
  const secondVillager = commandSimulation.addUnit('villager', 10, 12, 'player');
  const commandRaider = commandSimulation.addUnit('raider', 13, 11, 'enemy');
  carryingVillager.carryAmount = 8;
  carryingVillager.carryType = 'wood';
  commandSimulation.selectedIds = [carryingVillager.id, secondVillager.id];
  commandSimulation._syncSelectionFlags();
  const command = commandSimulation.issueContextCommand({ x: commandRaider.x, z: commandRaider.z });
  assert.equal(command.kind, 'attack', 'selected Villagers accept a hostile-unit defense order');
  assert.equal(carryingVillager.command, 'attack', 'a carrying Villager defends immediately instead of losing the target during deposit');
  assert.equal(secondVillager.command, 'attack', 'multi-selected Villagers defend together');

  const wardSimulation = movementSandbox();
  const protectedVillager = wardSimulation.addUnit('villager', 20, 20, 'player');
  const nearbyVillager = wardSimulation.addUnit('villager', 22, 20, 'player');
  const distantVillager = wardSimulation.addUnit('villager', 50, 50, 'player');
  const lethalRaider = wardSimulation.addUnit('raider', 21, 22, 'enemy');
  const wardResult = wardSimulation._applyUnitDamage(protectedVillager, raiderRules.attackVsVillager, lethalRaider);
  assert.equal(wardResult.warded, true, 'lethal Raider strike triggers Last Light Ward');
  assert.equal(protectedVillager.dead, false, 'Last Light Ward prevents Villager death');
  assert.equal(protectedVillager.hp, 1, 'Ward catches the lethal strike at one health');
  assert.equal(protectedVillager.lastLightWardTimer, 60, 'Ward starts at one minute');
  assert.equal(nearbyVillager.attackTarget, lethalRaider.id, 'nearby Villager swarms the lethal attacker');
  assert.notEqual(distantVillager.attackTarget, lethalRaider.id, 'distant Villager is not pulled away by the local safety response');
  const protectedHp = protectedVillager.hp;
  const blockedResult = wardSimulation._applyUnitDamage(protectedVillager, 999, lethalRaider);
  assert.equal(blockedResult.blocked, true, 'active Ward blocks further damage');
  assert.equal(protectedVillager.hp, protectedHp, 'active Ward preserves current health');
  for (let second = 0; second < 601; second += 1) wardSimulation._updateUnitStatusEffects(protectedVillager, 0.1);
  assert.equal(protectedVillager.lastLightWardTimer, 0, 'Ward expires cleanly after one minute');
  assert.equal(protectedVillager.hp, protectedVillager.maxHp, 'Villager reaches full health by Ward expiry');
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

function checkRendererCanvasSafety() {
  const renderer = Object.create(CrownforgeRenderer.prototype);
  renderer.camera = { zoom: CONFIG.minZoom };
  const radii = [];
  const context = {
    save() {},
    restore() {},
    beginPath() {},
    arc(_x, _y, radius) { radii.push(radius); },
    stroke() {},
  };
  renderer.drawAttackRing(context, { x: 0, y: 0 }, (Math.PI * 1.5) / 0.01);
  assert.equal(radii.length, 1, 'attack feedback still draws its pulse at minimum zoom');
  assert.ok(Number.isFinite(radii[0]) && radii[0] >= 0, 'attack feedback never passes a negative Canvas arc radius');
}

function checkReleaseSurfaceAndOcclusionBudget() {
  assert.match(INDEX_HTML, /<link rel="icon" type="image\/png" href="\.\/assets\/crownforge-icon-gold-v1\.png/, 'the playable page declares a packaged favicon instead of requesting the missing root favicon');
  assert.match(RENDERER_SOURCE, /simulation\._staticBlockerCandidates\(unit, OCCLUSION_QUERY_RADIUS\)/, 'unit occlusion uses the spatial blocker grid');
  assert.doesNotMatch(RENDERER_SOURCE, /const hiddenByBuilding = simulation\.buildings\.find/, 'unit occlusion does not scan every building for every unit');
  assert.doesNotMatch(RENDERER_SOURCE, /const hiddenByResource = simulation\.resourcesNodes\.find/, 'unit occlusion does not scan every resource for every unit');
}

function checkUnitMovementFacingAndPoseSafety() {
  const directionCases = [
    { label: 'screen-down', dx: 1, dz: 1, expected: 0 },
    { label: 'screen-right', dx: 1, dz: -1, expected: 1 },
    { label: 'screen-up', dx: -1, dz: -1, expected: 2 },
    { label: 'screen-left', dx: -1, dz: 1, expected: 3 },
  ];

  for (const type of Object.keys(UNIT_TYPES)) {
    for (const direction of directionCases) {
      const simulation = movementSandbox();
      const unit = simulation.addUnit(type, 100, 100, type.startsWith('ashen') || type === 'raider' || type === 'thornSpear' || type === 'hearthLevy' || type === 'hidewall' ? 'enemy' : 'player');
      unit.command = 'move';
      unit.visualState = 'walk';
      unit.path = [{ x: unit.x + direction.dx * 20, z: unit.z + direction.dz * 20 }];
      unit.routeTarget = { ...unit.path[0] };
      unit.facing = Number.NaN;
      const observed = new Set();
      for (let frame = 0; frame < 24; frame += 1) {
        if (frame === 4) unit.hitFlash = 0.3;
        simulation._updateUnit(unit, STEP_60HZ);
        observed.add(unit.facing);
        assert.equal(resolveAnimationState(unit), 'walk', `${type} keeps its walk pose while travelling ${direction.label}`);
      }
      assert.deepEqual([...observed], [direction.expected], `${type} holds the correct ${direction.label} facing without row spinning`);
    }
  }

  // Lock the two non-standard production atlases to their authored layouts.
  // These checks catch visually catastrophic row/column mistakes that valid
  // simulation-facing integers alone cannot detect.
  const militiaDirectionColumns = [0, 1, 2, 3];
  for (const direction of militiaDirectionColumns) {
    for (const time of [0, 0.16, 0.31, 0.47]) {
      const frame = animationFrame('militia', 'walk', time, direction);
      assert.equal(frame.column, direction, `militia walk keeps direction ${direction} in its authored column`);
      assert.ok(frame.row <= 1, `militia walk direction ${direction} never enters attack or death rows`);
    }
    assert.deepEqual(
      { row: animationFrame('militia', 'idle', 0, direction).row, column: animationFrame('militia', 'idle', 0, direction).column },
      { row: 0, column: direction },
      `militia idle preserves authored direction ${direction}`,
    );
    assert.deepEqual(
      { row: animationFrame('militia', 'death', 0, direction).row, column: animationFrame('militia', 'death', 0, direction).column },
      { row: 3, column: direction },
      `militia death preserves authored direction ${direction}`,
    );
  }

  const shieldbearerRows = [2, 1, 0, 3];
  for (let direction = 0; direction < 4; direction += 1) {
    for (const state of ['idle', 'walk', 'attack', 'attack_anticipation', 'attack_contact', 'attack_recovery', 'death']) {
      assert.equal(
        animationFrame('shieldbearer', state, 0.22, direction).row,
        shieldbearerRows[direction],
        `shieldbearer ${state} maps direction ${direction} to its authored row`,
      );
    }
  }

  const approach = movementSandbox();
  const raider = approach.addUnit('raider', 100, 100, 'enemy');
  const guard = approach.addUnit('soldier', 112, 100, 'player');
  raider.command = 'attack';
  raider.visualState = 'walk';
  raider.attackPhase = 'approach';
  raider.attackTarget = guard.id;
  raider.attackTargetKind = 'unit';
  raider.path = [{ x: 100, z: 104 }];
  raider.routeTarget = { x: 111, z: 100 };
  const approachFacings = new Set();
  for (let frame = 0; frame < 12; frame += 1) {
    approach._updateUnit(raider, STEP_60HZ);
    approachFacings.add(raider.facing);
  }
  assert.deepEqual([...approachFacings], [3], 'attack approach faces the detour path instead of looking at the distant target');
  assert.equal(resolveAnimationState(raider), 'walk', 'attack approach cannot slide in a recoil or attack pose');

  const death = movementSandbox();
  const fallen = death.addUnit('soldier', 100, 100, 'player');
  fallen.dead = true;
  fallen.command = 'dead';
  fallen.path = [{ x: 120, z: 120 }];
  fallen.velocityX = 8;
  fallen.velocityZ = -8;
  fallen.facing = 2;
  death._updateUnit(fallen, 0.5);
  assert.deepEqual({ x: fallen.x, z: fallen.z, facing: fallen.facing }, { x: 100, z: 100, facing: 2 }, 'death animation never travels or rotates from stale movement state');
}

checkAnimationAtlases();
checkResetPresentation();
checkGathering();
checkPersistentForestGathering();
checkDevelopmentSpeedControls();
checkFirstAgeSystemsPass();
checkFirstAgeCommandDeckPass();
checkGoldEconomyLoop();
checkOreWashEconomySupport();
checkStableGranaryAndScout();
checkTimberStonewrightAndSpearwarden();
checkHomesteadAndMilitia();
checkWatchHutAndShieldbearer();
checkIntentAwareVisualTargeting();
checkReadableResourceApproaches();
checkBuilderWorkflowAndVillagerControls();
checkInstantAreaDemolition();
checkAutonomousWorkCombatAndDefenses();
checkConstructionAndPlacement();
checkConstructionRetaskingAndTaskSummary();
checkConstructionOrderQueue();
checkWallResourcePrecedence();
checkWallEndpointMagnetism();
checkWallOverlapAndGate();
checkBlockedDestinationFallback();
checkDynamicBlockerRecovery();
checkCrownHallStairs();
checkBarracksLandmarkScale();
checkCrownHallProportionsAndBuildableRing();
checkBuildingPhysicalInteractionBoundaries();
checkTravelSpeedIsolation();
checkAshenForagerMotionAndFieldWorker();
checkVillagerRecovery();
checkAshenSettlementEconomyAndAI();
checkExpandedWorldAndEnemyDistance();
checkCursorCenteredZoom();
checkUprightWallVisuals();
checkAspectCorrectBuildingFeedback();
checkGroundedWorldAssets();
checkCrownHallHostileExclusionAndCombatRecovery();
checkVillagerLastStandDefense();
checkUnitMovementFacingAndPoseSafety();
checkCombatAndEndStates();
checkReleaseSurfaceAndOcclusionBudget();
checkRendererCanvasSafety();

console.log(JSON.stringify({
  status: 'passed',
  checks: [
    'directional Villager carry/response/defense and military walk/attack/stun/recoil/death atlas resolution',
    'reset villager ground/building clearance',
    '20 Hz versus 60 Hz gathering convergence',
    'cargo-preserving retask and storage return',
    'complete Gold gather, carry, Crown Hall deposit, return-to-work, depletion, and multi-worker slot loop',
    'Ore Wash construction, Gold-only drop-off routing, local yield bonus, and Crown Guard Gold spending',
    'Crown Stable and First-age Granary construction, food routing, Scout production, and four-direction Scout animation',
    'Timber Yard and Stonewright Yard construction data, wood/stone routing, Spearwarden production, and four-direction animation',
    'First-age Homestead construction/housing, Crown Militia production, and four-direction Militia animation',
    'First-age Watch Hut construction, Crown Shieldbearer production, and four-direction Shieldbearer animation',
    'intent-aware visual targeting and resource-specific gather/drop-off feedback',
    'data-driven builder capability, hammer cursor, manual repair, nearby auto-assist, Crown Hall safety regroup, and Select All Villagers control',
    'instant click, selected-structure, and drag-area demolition without Villagers, labor queues, collision, or debris',
    'long-wall construction stations, persistent attack recovery, protected workers, autonomous military defense, directional building arrows, all resource-yard work transitions, forgiving manual resource redirection, and tower socket integration',
    'focused first-age building catalog with the Crown Hall as universal fallback',
    'placement rejection and Barracks completion',
    'construction pause, foundation right-click reassignment, cargo-first resume, and mixed-task feedback',
    'active builders queue new move orders and continue them after construction completes',
    'wall precedence over trees and stone with safe resource cleanup',
    'magnetic wall endpoint snap, unlimited edge-sealing runs, and connected segment spacing',
    'interior and endpoint wall magnets, clean two-way corners, orientation-locked gate openings, and multi-branch Palisade Tower hardpoints',
    'blocked destination fallback outside building clearance',
    'dynamic building blocker route recovery',
    'Crown Hall stair routing, landing stop, and interior collision',
    'person-scaled Barracks landmark and collision clearance',
    'equal Crown Hall/Barracks proportion, inward placement, and four-sided buildable ring',
    'artwork-matched building collision, offset physical bases, perimeter work stations, and non-stacking Crown Hall drop-offs',
    'travel-only speed scaling, high-speed collision routing, and fast group spacing',
    'First-age packed roads, three researchable doctrines, visible guard areas, field history, and local save/load recovery',
    'First-age worker focus, automatic repair toggle, production rally points, patrol routes, optional exploration, milestones, logistics summary, wall continuation, and command-setting save/load',
    'always-available selected-unit recovery at a clear Crown Hall approach with cargo deposit and group spacing',
    'distinct Ashen role-equivalent artwork, directional units, independent economy, capped town growth, local defense, and forest-gated raids',
    'roughly eighty-percent individually harvestable Wildwood trees with authored berry, stone, and scarce Gold glades and no prebuilt fields',
    'expanded map, opposite-side settlements, and a harvestable forest divide that gates contact',
    'cursor-centered zoom anchor in both directions',
    'four authored upright Palisade views across all eight snap directions',
    'aspect-correct landmark health and placement feedback',
    'alpha-audited building, construction, field, tree, grove, stone, and Gold grounding without permanent collision diamonds',
    'expanded Crown Hall hostile exclusion and attackable recovery for enemies embedded in solid structures',
    'twenty-hit Villager defense, five-second humanoid stun, twenty-second immunity, attacker aggro, local swarm, and one-minute Last Light Ward',
    'all movable unit types hold correct four-way travel facing, attack approaches follow their path heading, and recoil/death poses never slide or spin',
    'melee damage, death timing, victory, defeat',
    'packaged favicon and spatially bounded unit-occlusion rendering',
    'minimum-zoom attack feedback never throws a negative Canvas arc radius',
  ],
}));
