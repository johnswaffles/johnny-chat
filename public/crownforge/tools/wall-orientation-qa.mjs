import { BUILDING_TYPES, CONFIG } from '../src/config.js?v=20260822-uprightwalls2';
import { CrownforgeRenderer } from '../src/renderer.js?v=20260822-uprightwalls2';
import { CrownforgeSimulation } from '../src/simulation.js?v=20260822-uprightwalls2';

const canvas = document.querySelector('#game-canvas');
const renderer = new CrownforgeRenderer(canvas);
const simulation = new CrownforgeSimulation();

simulation.buildings = [];
simulation.units = [];
simulation.resourcesNodes = [];
simulation.decorations = [];

const focus = { x: CONFIG.mapWidth / 2, z: CONFIG.mapHeight / 2 };
renderer.camera.zoom = 0.82;
const baseX = (focus.x - focus.z - (CONFIG.mapWidth - CONFIG.mapHeight) / 2) * CONFIG.tileWidth / 2;
const baseY = (focus.x + focus.z - (CONFIG.mapWidth + CONFIG.mapHeight) / 2) * CONFIG.tileHeight / 2;
renderer.camera.x = -baseX * renderer.camera.zoom;
renderer.camera.y = -baseY * renderer.camera.zoom;
renderer.cameraInitialized = true;

const segmentCount = 4;
const span = BUILDING_TYPES.wall.wallSegmentSpan;
const specs = [
  { screen: { x: 320, y: 245 }, direction: { x: 1, z: 0 }, orientation: 'horizontal' },
  { screen: { x: 955, y: 245 }, direction: { x: 0, z: 1 }, orientation: 'vertical' },
  { screen: { x: 335, y: 520 }, direction: { x: Math.SQRT1_2, z: -Math.SQRT1_2 }, orientation: 'diagonal' },
  { screen: { x: 945, y: 505 }, direction: { x: Math.SQRT1_2, z: Math.SQRT1_2 }, orientation: 'diagonal' },
];

for (const spec of specs) {
  const center = renderer.screenToWorld(spec.screen);
  const start = {
    x: center.x - spec.direction.x * (segmentCount - 1) * span / 2,
    z: center.z - spec.direction.z * (segmentCount - 1) * span / 2,
  };
  simulation.addBuilding('wall', center.x, center.z, 'player', 1, {
    wallSegments: segmentCount,
    wallOrientation: spec.orientation,
    wallDirection: spec.direction,
    wallStart: start,
  });
}

function frame(time) {
  renderer.render(simulation, null, time);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
