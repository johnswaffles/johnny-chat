import { CONFIG, UNIT_TYPES } from '../src/config.js?v=20260827-unitfacing1';
import { CrownforgeRenderer } from '../src/renderer.js?v=20260827-unitfacing1';
import { CrownforgeSimulation } from '../src/simulation.js?v=20260827-unitfacing1';

const canvas = document.querySelector('#game-canvas');
const renderer = new CrownforgeRenderer(canvas);
const simulation = new CrownforgeSimulation();
simulation.buildings = [];
simulation.units = [];
simulation.resourcesNodes = [];
simulation.decorations = [];
simulation._checkVictory = () => {};
simulation._updateEnemyAI = () => {};
simulation._updateEnemyIntent = () => {};

renderer.camera.zoom = 0.82;
const focus = { x: CONFIG.mapWidth / 2, z: CONFIG.mapHeight / 2 };
const baseX = (focus.x - focus.z - (CONFIG.mapWidth - CONFIG.mapHeight) / 2) * CONFIG.tileWidth / 2;
const baseY = (focus.x + focus.z - (CONFIG.mapWidth + CONFIG.mapHeight) / 2) * CONFIG.tileHeight / 2;
renderer.camera.x = -baseX * renderer.camera.zoom;
renderer.camera.y = -baseY * renderer.camera.zoom;
renderer.cameraInitialized = true;

const types = Object.keys(UNIT_TYPES);
const labels = document.querySelector('#labels');
const enemyTypes = new Set(['raider', 'ashenForager', 'ashenOutrider', 'thornSpear', 'hearthLevy', 'hidewall']);
const fixtures = types.map((type, index) => {
  const column = index % 4;
  const row = Math.floor(index / 4);
  const screen = {
    x: renderer.width * (0.14 + column * 0.24),
    y: renderer.height * (0.22 + row * 0.27),
  };
  const origin = renderer.screenToWorld(screen);
  const unit = simulation.addUnit(type, origin.x, origin.z, enemyTypes.has(type) ? 'enemy' : 'player');
  const label = document.createElement('div');
  label.className = 'unit-label';
  label.style.left = `${screen.x}px`;
  label.style.top = `${screen.y - 74}px`;
  label.textContent = UNIT_TYPES[type].label;
  labels.append(label);
  return { unit, origin };
});

const routeOffsets = [
  { x: 3.6, z: 3.6, label: 'SCREEN-DOWN / FRONT' },
  { x: 7.2, z: 0, label: 'SCREEN-RIGHT / PROFILE' },
  { x: 3.6, z: -3.6, label: 'SCREEN-UP / BACK' },
  { x: 0, z: 0, label: 'SCREEN-LEFT / PROFILE' },
];
const requestedDirection = Number.parseInt(new URLSearchParams(window.location.search).get('direction') ?? '', 10);
const lockedDirection = Number.isInteger(requestedDirection) && requestedDirection >= 0 && requestedDirection < routeOffsets.length
  ? requestedDirection
  : null;
let routeIndex = -1;
let nextRouteAt = 0;
function issueNextRoute(now) {
  const initializingLockedRoute = lockedDirection !== null && routeIndex === -1;
  routeIndex = lockedDirection ?? ((routeIndex + 1) % routeOffsets.length);
  const offset = routeOffsets[routeIndex];
  document.querySelector('#expected-facing').textContent = offset.label;
  for (const { unit, origin } of fixtures) {
    if (initializingLockedRoute) {
      const previousOffset = routeOffsets[(routeIndex + routeOffsets.length - 1) % routeOffsets.length];
      unit.x = origin.x + previousOffset.x;
      unit.z = origin.z + previousOffset.z;
    }
    const destination = { x: origin.x + offset.x, z: origin.z + offset.z };
    unit.command = 'move';
    unit.visualState = 'walk';
    unit.path = [destination];
    unit.routeTarget = destination;
    unit.pathBlocked = false;
    // Force one live-hit interval while travelling. The movement pose must
    // remain upright rather than sliding in a recoil/fall frame.
    if (routeIndex === 1) unit.hitFlash = 0.35;
  }
  nextRouteAt = lockedDirection === null ? now + 2400 : Number.POSITIVE_INFINITY;
}

let previous = performance.now();
let accumulator = 0;
function frame(now) {
  if (now >= nextRouteAt) issueNextRoute(now);
  const elapsed = Math.min(0.1, Math.max(0, (now - previous) / 1000));
  previous = now;
  accumulator += elapsed;
  while (accumulator >= 1 / 60) {
    simulation.update(1 / 60);
    accumulator -= 1 / 60;
  }
  renderer.render(simulation, null, now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
