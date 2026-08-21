import assert from 'node:assert/strict';

import {
  BUILDING_TYPES,
  COMBAT_ATLASES,
  CONFIG,
  FIRST_AGE_ASSETS,
  INITIAL_RESOURCES,
  VILLAGER_ATLASES,
} from '../src/config.js';
import { animationFrame } from '../src/animation.js';
import { CrownforgeRenderer } from '../src/renderer.js';
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
  assert.equal(simulation.getPlacementCheck('house', { x: townCenter.x, z: townCenter.z }).valid, false, 'building overlap rejected');
  const tree = simulation.resourcesNodes.find((node) => node.resourceType === 'wood');
  assert.equal(simulation.getPlacementCheck('house', { x: tree.x, z: tree.z }).valid, false, 'resource overlap rejected');

  const placement = { x: townCenter.x, z: townCenter.z + 13 };
  assert.equal(simulation.getPlacementCheck('house', placement).valid, true, 'a valid house placement exists outside the Hall stairs');
  assert.equal(simulation.placeHouse(placement), true, 'house foundation placed');
  const house = simulation.buildings.find((building) => building.type === 'house' && building.progress < 1);
  assert.ok(house, 'house starts as a construction site');
  // The workers must first walk to the south approach before construction
  // time starts; leave room for that route in the deterministic check.
  advance(simulation, BUILDING_TYPES.house.buildTime + 22);
  assert.equal(house.progress, 1, 'house completes through construction simulation');
  assert.equal(house.hp, house.maxHp, 'completed house reaches full health');
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
  simulation.addBuilding('house', blockerPoint.x, blockerPoint.z, 'player', 1);

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
  assert.equal(simulation.getPlacementCheck('house', { x: hall.x, z: stairs.outerZ + 2 }).valid, true, 'backside site remains placeable outside Hall footprint');
}

function checkBarracksLandmarkScale() {
  const barracks = BUILDING_TYPES.barracks;
  const hall = BUILDING_TYPES.townCenter;
  assert.ok(barracks.renderSize >= 900 && barracks.renderSize <= 1200, 'Barracks practice dummies use the live Marauder reference scale');
  assert.ok(hall.renderSize < barracks.renderSize, 'Crown Hall now uses the compact first-age landmark scale');
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
  assert.equal(hall.renderSize, 400, 'Crown Hall is reduced to one tenth of its previous visual width');
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
    const check = simulation.getPlacementCheck('house', point);
    assert.equal(check.valid, true, `Hall has a buildable meadow opening on the ${side} side`);
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
  assert.ok(simulation.resourcesNodes.filter((node) => node.resourceType === 'wood').length >= 20, 'expanded map has a readable wood family');
  assert.ok(simulation.resourcesNodes.filter((node) => node.resourceType === 'food').length >= 16, 'expanded map has a readable food family');
  assert.ok(simulation.resourcesNodes.filter((node) => node.resourceType === 'stone').length >= 12, 'expanded map has a readable stone family');
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
checkReadableResourceApproaches();
checkConstructionAndPlacement();
checkBlockedDestinationFallback();
checkDynamicBlockerRecovery();
checkCrownHallStairs();
checkBarracksLandmarkScale();
checkCrownHallProportionsAndBuildableRing();
checkExpandedWorldAndEnemyDistance();
checkCursorCenteredZoom();
checkAspectCorrectBuildingFeedback();
checkCombatAndEndStates();

console.log(JSON.stringify({
  status: 'passed',
  checks: [
    'directional villager carry/response and military walk/attack/recoil/death atlas resolution',
    'reset villager ground/building clearance',
    '20 Hz versus 60 Hz gathering convergence',
    'cargo-preserving retask and storage return',
    'placement rejection and house completion',
    'blocked destination fallback outside building clearance',
    'dynamic building blocker route recovery',
    'Crown Hall stair routing, landing stop, and interior collision',
    'person-scaled Barracks landmark and collision clearance',
    'compact Crown Hall proportion, inward placement, and four-sided buildable ring',
    'expanded map resource clearings and opposite-side enemy camp',
    'cursor-centered zoom anchor in both directions',
    'aspect-correct landmark health and placement feedback',
    'melee damage, death timing, victory, defeat',
  ],
}));
