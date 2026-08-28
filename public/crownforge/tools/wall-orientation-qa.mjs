import { BUILDING_TYPES, CONFIG } from '../src/config.js?v=20260827-walljoin1';
import { CrownforgeRenderer } from '../src/renderer.js?v=20260827-walljoin1';
import { CrownforgeSimulation } from '../src/simulation.js?v=20260827-walljoin1';

const canvas = document.querySelector('#game-canvas');
const renderer = new CrownforgeRenderer(canvas);
const simulation = new CrownforgeSimulation();

simulation.buildings = [];
simulation.units = [];
simulation.resourcesNodes = [];
simulation.decorations = [];
simulation.resources.food = 99999;
simulation.resources.wood = 99999;
simulation.resources.stone = 99999;

const focus = { x: CONFIG.mapWidth / 2, z: CONFIG.mapHeight / 2 };
renderer.camera.zoom = 0.72;
const baseX = (focus.x - focus.z - (CONFIG.mapWidth - CONFIG.mapHeight) / 2) * CONFIG.tileWidth / 2;
const baseY = (focus.x + focus.z - (CONFIG.mapWidth + CONFIG.mapHeight) / 2) * CONFIG.tileHeight / 2;
renderer.camera.x = -baseX * renderer.camera.zoom;
renderer.camera.y = -baseY * renderer.camera.zoom;
renderer.cameraInitialized = true;

const span = BUILDING_TYPES.wall.wallSegmentSpan;
const builder = simulation.addUnit('villager', focus.x, focus.z + 80, 'player');
simulation.selectedIds = [builder.id];
simulation._syncSelectionFlags();

function worldAt(screen) {
  return renderer.screenToWorld(screen);
}

function addWall(start, direction, count = 4, progress = 1) {
  const end = {
    x: start.x + direction.x * (count - 1) * span,
    z: start.z + direction.z * (count - 1) * span,
  };
  return simulation.addBuilding('wall', (start.x + end.x) / 2, (start.z + end.z) / 2, 'player', progress, {
    wallSegments: count,
    wallDirection: direction,
    wallStart: start,
  });
}

function addGroundedCorner(screen, towerProgress = null) {
  const socket = worldAt(screen);
  const leftTerminal = { x: socket.x - span / 2, z: socket.z };
  const rightTerminal = { x: socket.x, z: socket.z + span / 2 };
  addWall({ x: leftTerminal.x - span * 3, z: leftTerminal.z }, { x: 1, z: 0 });
  addWall(rightTerminal, { x: 0, z: 1 });
  if (towerProgress == null) return;
  const preview = simulation.getBuildingPlacementPreview('palisadeTower', socket);
  if (!preview.valid || !simulation.placeBuilding('palisadeTower', socket, preview)) {
    throw new Error(`Tower QA placement failed: ${preview.reason}`);
  }
  const tower = simulation.buildings.find((building) => building.type === 'palisadeTower'
    && !building.destroyed
    && Math.hypot(building.x - preview.world.x, building.z - preview.world.z) < 0.2);
  tower.progress = towerProgress;
  tower.hp = tower.maxHp * Math.max(0.04, towerProgress);
}

function addGate(screen, direction) {
  const center = worldAt(screen);
  addWall({ x: center.x - direction.x * span * 2, z: center.z - direction.z * span * 2 }, direction, 5);
  const preview = simulation.getBuildingPlacementPreview('gate', center);
  if (!preview.valid || !simulation.placeBuilding('gate', center, preview)) {
    throw new Error(`Gate QA placement failed: ${preview.reason}`);
  }
  const gate = simulation.buildings.find((building) => building.type === 'gate'
    && !building.destroyed
    && Math.hypot(building.x - preview.world.x, building.z - preview.world.z) < 0.2);
  gate.progress = 1;
  gate.hp = gate.maxHp;
}

// Exact combinations that previously escaped metadata-only regression tests.
addGroundedCorner({ x: 300, y: 285 });
addGroundedCorner({ x: 760, y: 285 }, 0.04);
addGroundedCorner({ x: 1215, y: 285 }, 1);
addGate({ x: 245, y: 665 }, { x: 1, z: 0 });
addGate({ x: 600, y: 665 }, { x: 0, z: 1 });
addGate({ x: 960, y: 665 }, { x: Math.SQRT1_2, z: -Math.SQRT1_2 });
// Keep the final diagonal on its own lower row so its replacement footprint
// cannot intersect the neighboring diagonal fixture during placement QA.
addGate({ x: 1240, y: 700 }, { x: Math.SQRT1_2, z: Math.SQRT1_2 });

simulation.units = [];
simulation.selectedIds = [];
simulation.buildings = simulation.buildings.filter((building) => !building.destroyed);

function frame(time) {
  renderer.render(simulation, null, time);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
