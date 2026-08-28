import { resourceDepletionStage } from '../src/config.js?v=20260828-forestpass1';
import { CrownforgeRenderer } from '../src/renderer.js?v=20260828-forestpass1';
import { CrownforgeSimulation } from '../src/simulation.js?v=20260828-forestpass1';

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

renderer.camera.zoom = 0.22;
renderer.camera.x = 0;
renderer.camera.y = 0;
renderer.cameraInitialized = true;

const stageAmounts = [100, 83, 66, 49, 32, 0];
const screenPoints = [
  { x: renderer.width * 0.2, y: renderer.height * 0.34 },
  { x: renderer.width * 0.5, y: renderer.height * 0.34 },
  { x: renderer.width * 0.8, y: renderer.height * 0.34 },
  { x: renderer.width * 0.2, y: renderer.height * 0.76 },
  { x: renderer.width * 0.5, y: renderer.height * 0.76 },
  { x: renderer.width * 0.8, y: renderer.height * 0.76 },
];

screenPoints.forEach((screen, index) => {
  const world = renderer.screenToWorld(screen);
  simulation.addResource('grove', 'wood', world.x, world.z, 100, 0, { sizeTier: 'wildwood' });
  const resource = simulation.resourcesNodes.at(-1);
  resource.amount = stageAmounts[index];
  resource.depleted = resource.amount <= 0;
  resource.depletionStage = resourceDepletionStage(resource);

  const label = document.createElement('div');
  label.className = 'stage-label';
  label.style.left = `${screen.x}px`;
  label.style.top = `${screen.y + 10}px`;
  label.textContent = `STAGE ${index + 1} · ${stageAmounts[index]}%`;
  document.querySelector('#labels').append(label);
});

function frame(now) {
  renderer.render(simulation, null, now);
  document.documentElement.dataset.forestQa = renderer.wildwoodForestReady ? 'ready' : 'loading';
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
