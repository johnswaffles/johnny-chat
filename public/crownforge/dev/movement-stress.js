import { BUILDING_TYPES, CONFIG, UNIT_TYPES } from '../src/config.js';
import { CrownforgeSimulation } from '../src/simulation.js';

const canvas = document.querySelector('#preview');
const ctx = canvas.getContext('2d');
const summary = document.querySelector('#summary');
const diagnostics = document.querySelector('#diagnostics');
const events = document.querySelector('#events');
const scale = Math.min((canvas.width - 70) / CONFIG.mapWidth, (canvas.height - 70) / CONFIG.mapHeight);
const origin = { x: 35, z: 30 };
const toCanvas = (point) => ({ x: origin.x + point.x * scale, y: origin.z + point.z * scale });

let simulation;
let groups = [];
let dynamicBlocker = null;
let mode = 'reset';
let retaskUntil = 0;
let retaskClock = 0;
let eventText = 'Ready.';

function createScenario() {
  simulation = new CrownforgeSimulation({ onEvent: (message) => { eventText = message; } });
  simulation.units = [];
  simulation.buildings = [];
  simulation.resourcesNodes = [];
  simulation.decorations = [];
  simulation.resources = { food: 0, wood: 0, stone: 0 };
  simulation.phase = 'playing';
  simulation.addBuilding('townCenter', 2, 2, 'player', 1);
  simulation.addBuilding('ashenCamp', 28, 20, 'enemy', 1);

  // Alternating footprints create two narrow lanes, a central choke, and open
  // ground on both sides for long crossings and intersecting routes.
  [[11, 4], [11, 8], [11, 16], [15, 4], [15, 16], [19, 6], [19, 12], [23, 4], [23, 16]]
    .forEach(([x, z]) => simulation.addBuilding('house', x, z, 'player', 1));
  simulation.addResource('tree', 'wood', 7.4, 6.4, 999, 0);
  simulation.addResource('tree', 'wood', 17.2, 10.8, 999, 1);
  simulation.addResource('stone', 'stone', 21.8, 10.8, 999, 0);

  const west = [];
  const east = [];
  for (let index = 0; index < 5; index += 1) {
    west.push(simulation.addUnit('villager', 4 + (index % 2) * 0.65, 5.4 + index * 2.25, 'player'));
    east.push(simulation.addUnit('villager', 26 - (index % 2) * 0.65, 5.4 + index * 2.25, 'player'));
  }
  groups = [west, east];
  simulation.selectedIds = west.map((unit) => unit.id);
  simulation._syncSelectionFlags();
  dynamicBlocker = null;
  mode = 'reset';
  retaskUntil = 0;
  retaskClock = 0;
  eventText = 'Ready.';
}

function commandGroup(group, target) {
  group.forEach((unit, index) => {
    const spread = 0.42 + group.length * 0.04;
    const angle = (index / Math.max(1, group.length)) * Math.PI * 2;
    simulation._sendUnitTo(unit, { x: target.x + Math.cos(angle) * spread, z: target.z + Math.sin(angle) * spread }, 'move');
  });
}

function commandCross(intersect = false) {
  mode = intersect ? 'intersections' : 'cross lanes';
  commandGroup(groups[0], intersect ? { x: 26, z: 18 } : { x: 26, z: 5 });
  commandGroup(groups[1], intersect ? { x: 4, z: 5 } : { x: 4, z: 18 });
}

function commandBlockedDestination() {
  mode = 'blocked destination';
  const target = { x: 11, z: 4 };
  [...groups[0], ...groups[1]].forEach((unit) => simulation._sendUnitTo(unit, target, 'move'));
}

function startRetask() {
  mode = 'retask storm';
  retaskUntil = simulation.clock + 12;
  retaskClock = 0;
}

function placeBlocker() {
  if (dynamicBlocker && !dynamicBlocker.destroyed) return;
  dynamicBlocker = simulation.addBuilding('house', 15, 11, 'player', 1);
  commandCross(false);
  mode = 'dynamic blocker';
}

function removeBlocker() {
  if (!dynamicBlocker) return;
  dynamicBlocker.destroyed = true;
  dynamicBlocker.hp = 0;
  dynamicBlocker.destroyAge = 3;
  eventText = 'Dynamic blocker removed.';
  dynamicBlocker = null;
}

function drawGrid() {
  ctx.fillStyle = '#152a2d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#486a57';
  ctx.fillRect(origin.x, origin.z, CONFIG.mapWidth * scale, CONFIG.mapHeight * scale);
  ctx.strokeStyle = 'rgba(213, 190, 125, .12)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= CONFIG.mapWidth; x += 1) {
    ctx.beginPath(); ctx.moveTo(origin.x + x * scale, origin.z); ctx.lineTo(origin.x + x * scale, origin.z + CONFIG.mapHeight * scale); ctx.stroke();
  }
  for (let z = 0; z <= CONFIG.mapHeight; z += 1) {
    ctx.beginPath(); ctx.moveTo(origin.x, origin.z + z * scale); ctx.lineTo(origin.x + CONFIG.mapWidth * scale, origin.z + z * scale); ctx.stroke();
  }
}

function drawObstacles() {
  for (const building of simulation.buildings) {
    if (building.destroyed) continue;
    const footprint = BUILDING_TYPES[building.type].footprint;
    const point = toCanvas({ x: building.x - footprint.width / 2, z: building.z - footprint.height / 2 });
    ctx.fillStyle = building.type === 'ashenCamp' ? 'rgba(173, 78, 65, .62)' : 'rgba(30, 42, 45, .88)';
    ctx.strokeStyle = building.progress < 1 ? '#d7aa54' : '#c0d7c0';
    ctx.lineWidth = 2;
    ctx.fillRect(point.x, point.y, footprint.width * scale, footprint.height * scale);
    ctx.strokeRect(point.x, point.y, footprint.width * scale, footprint.height * scale);
  }
  for (const node of simulation.resourcesNodes) {
    const point = toCanvas(node);
    ctx.fillStyle = node.type === 'stone' ? '#c7ced0' : '#5b392a';
    ctx.beginPath(); ctx.arc(point.x, point.y, (node.type === 'stone' ? 0.92 : 1.05) * scale, 0, Math.PI * 2); ctx.fill();
  }
}

function drawUnit(unit) {
  const point = toCanvas(unit);
  const color = unit.faction === 'enemy' ? '#d86b55' : unit.type === 'soldier' ? '#d7aa54' : '#86c4cf';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  if (unit.path.length) {
    ctx.beginPath(); ctx.moveTo(point.x, point.y);
    for (const waypoint of unit.path) { const target = toCanvas(waypoint); ctx.lineTo(target.x, target.y); }
    ctx.stroke();
  }
  ctx.fillStyle = unit.dead ? '#777' : color;
  ctx.beginPath(); ctx.arc(point.x, point.y, Math.max(4, UNIT_TYPES[unit.type].radius * scale), 0, Math.PI * 2); ctx.fill();
  if (unit.path.length) {
    ctx.fillStyle = '#f4e7c2'; ctx.font = '10px Inter, sans-serif'; ctx.fillText(String(unit.id), point.x + 7, point.y - 6);
  }
}

function collectDiagnostics() {
  const live = simulation.units.filter((unit) => !unit.dead);
  let footprintViolations = 0;
  let boundaryViolations = 0;
  let stuck = 0;
  let minPair = Infinity;
  for (const unit of live) {
    const radius = UNIT_TYPES[unit.type].radius + 0.04;
    if (unit.x < radius || unit.z < radius || unit.x > CONFIG.mapWidth - radius || unit.z > CONFIG.mapHeight - radius) boundaryViolations += 1;
    for (const building of simulation.buildings) {
      if (!building.destroyed && simulation._distanceToBuildingEdge(unit, building) < radius) footprintViolations += 1;
    }
    for (const node of simulation.resourcesNodes) {
      if (node.amount > 0 && Math.hypot(unit.x - node.x, unit.z - node.z) < (node.type === 'stone' ? 0.92 : 1.05) + radius) footprintViolations += 1;
    }
    if (unit.path.length && unit.stuckTimer >= 0.72) stuck += 1;
  }
  for (let index = 0; index < live.length; index += 1) {
    for (let other = index + 1; other < live.length; other += 1) minPair = Math.min(minPair, Math.hypot(live[index].x - live[other].x, live[index].z - live[other].z));
  }
  const status = footprintViolations || boundaryViolations || stuck ? 'CHECK' : 'PASS';
  return { status, footprintViolations, boundaryViolations, stuck, minPair: Number.isFinite(minPair) ? minPair.toFixed(2) : '—' };
}

function draw() {
  drawGrid(); drawObstacles();
  for (const unit of simulation.units) drawUnit(unit);
  const result = collectDiagnostics();
  ctx.fillStyle = result.status === 'PASS' ? '#9bd6a5' : '#ef9c83';
  ctx.font = '700 16px Inter, sans-serif';
  ctx.fillText(`${result.status} · ${mode}`, 52, canvas.height - 22);
  summary.innerHTML = `<strong>${result.status}</strong> · ${mode} · ${simulation.units.length} units · ${simulation.clock.toFixed(1)}s`;
  diagnostics.textContent = `footprints ${result.footprintViolations} · boundary ${result.boundaryViolations} · stuck ${result.stuck} · min pair ${result.minPair}`;
  events.textContent = `last event: ${eventText}`;
}

function update(delta) {
  if (retaskUntil > simulation.clock) {
    retaskClock -= delta;
    if (retaskClock <= 0) {
      retaskClock = 0.48;
      commandCross(simulation.clock % 1 > 0.5);
      mode = 'retask storm';
    }
  }
  simulation.update(delta);
  draw();
  requestAnimationFrame(loop);
}

function loop(now) {
  const delta = Math.min(0.05, Math.max(0, (now - (loop.last ?? now)) / 1000));
  loop.last = now;
  update(delta);
}

document.querySelector('#reset').addEventListener('click', createScenario);
document.querySelector('#cross').addEventListener('click', () => commandCross(false));
document.querySelector('#intersect').addEventListener('click', () => commandCross(true));
document.querySelector('#blocked').addEventListener('click', commandBlockedDestination);
document.querySelector('#retask').addEventListener('click', startRetask);
document.querySelector('#block').addEventListener('click', placeBlocker);
document.querySelector('#remove').addEventListener('click', removeBlocker);

createScenario();
requestAnimationFrame(loop);
