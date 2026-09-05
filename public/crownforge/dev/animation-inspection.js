import { HearthkinRig } from '../src/hearthkin-rig.js?v=20260904-hearthkin3';
const hearthkinRig = new HearthkinRig();
import {
  ANIMATION_DIRECTIONS,
  ANIMATION_DEFINITIONS,
  animationClip,
  animationDefinition,
  animationFrame,
} from '../src/animation.js?v=20260904-hearthkin3';

const canvas = document.querySelector('#preview');
const ctx = canvas.getContext('2d');
const unitSelect = document.querySelector('#unit');
const stateSelect = document.querySelector('#state');
const directionSelect = document.querySelector('#direction');
const frameInput = document.querySelector('#frame');
const speedInput = document.querySelector('#speed');
const animateInput = document.querySelector('#animate');
const guidesInput = document.querySelector('#guides');
const summary = document.querySelector('#summary');
const asset = document.querySelector('#asset');
const geometry = document.querySelector('#geometry');

const images = {};
let currentTime = 0;
let lastTime = performance.now();

for (const [type, definition] of Object.entries(ANIMATION_DEFINITIONS)) {
  const option = document.createElement('option');
  option.value = type;
  option.textContent = definition.label;
  unitSelect.append(option);
  images[type] = {};
  for (const [atlasKey, atlas] of Object.entries(definition.atlases)) {
    const image = new Image();
    image.src = new URL(atlas.src.replace('./', '../'), import.meta.url).href;
    images[type][atlasKey] = image;
  }
}

for (const direction of ANIMATION_DIRECTIONS) {
  const option = document.createElement('option');
  option.value = direction.index;
  option.textContent = `${direction.index} · ${direction.label}`;
  directionSelect.append(option);
}

function selectedType() { return unitSelect.value || 'villager'; }
function selectedState() { return stateSelect.value || 'idle'; }
function selectedDirection() { return Number(directionSelect.value || 0); }

function refreshStates() {
  const definition = animationDefinition(selectedType());
  const previous = stateSelect.value;
  stateSelect.replaceChildren();
  for (const state of Object.keys(definition.clips)) {
    const option = document.createElement('option');
    option.value = state;
    option.textContent = state.replaceAll('_', ' ').toUpperCase();
    stateSelect.append(option);
  }
  stateSelect.value = definition.clips[previous] ? previous : Object.keys(definition.clips)[0];
  refreshFrameRange();
}

function refreshFrameRange() {
  const clip = animationClip(selectedType(), selectedState());
  document.querySelector('#frame-label').textContent = animationDefinition(selectedType()).renderer === 'skeletal' ? 'Pose phase' : 'Frame';
  frameInput.max = String(animationDefinition(selectedType()).renderer === 'skeletal' ? 99 : Math.max(0, clip.frames.length - 1));
  frameInput.value = String(Math.min(Number(frameInput.value), Number(frameInput.max)));
}

function drawGuides(definition, groundX, groundY, size) {
  const collision = definition.collisionRadius * 62;
  const interaction = definition.interactionRadius * 62;
  ctx.save();
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = 'rgba(134, 196, 207, .8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(groundX, groundY, interaction, interaction * .42, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = '#d7aa54';
  ctx.beginPath();
  ctx.ellipse(groundX, groundY, collision, collision * .42, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#f0d18a';
  ctx.beginPath(); ctx.arc(groundX, groundY, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d7dfd4';
  ctx.font = '12px Inter, sans-serif';
  ctx.fillText(`ground pivot · shadow ${definition.shadowAnchor.source}`, groundX + 18, groundY + 5);
  ctx.fillText(`collision ${definition.collisionRadius.toFixed(2)} · interaction ${definition.interactionRadius.toFixed(2)}`, groundX + 18, groundY + 22);
  ctx.restore();
}

function draw() {
  const type = selectedType();
  const state = selectedState();
  const direction = selectedDirection();
  const definition = animationDefinition(type);
  const clip = animationClip(type, state);
  const manualFrame = Number(frameInput.value || 0);
  const skeletal = definition.renderer === 'skeletal';
  const rigTime = animateInput.checked ? currentTime : manualFrame / 99 / clip.fps;
  const frame = animateInput.checked
    ? animationFrame(type, state, currentTime, direction)
    : { ...animationFrame(type, state, manualFrame / Math.max(clip.fps, 0.001), direction), frameIndex: manualFrame };
  const atlas = definition.atlases[frame.atlasKey];
  const image = images[type][frame.atlasKey];
  const groundX = canvas.width / 2;
  const groundY = 410;
  const size = 300;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#254347');
  gradient.addColorStop(1, '#142326');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(220, 187, 113, .08)';
  ctx.beginPath(); ctx.ellipse(groundX, groundY, 250, 80, 0, 0, Math.PI * 2); ctx.fill();
  if (guidesInput.checked) drawGuides(definition, groundX, groundY, size);
  if (skeletal) {
    hearthkinRig.draw(ctx, { id: 1, facing: direction, animationState: state }, { x: groundX, y: groundY }, size, 1, rigTime);
  } else if (image.complete && image.naturalWidth) {
    const atlasWidth = atlas.width ?? definition.atlasSize.width;
    const atlasHeight = atlas.height ?? definition.atlasSize.height;
    const atlasColumns = atlas.columns ?? definition.atlasSize.columns;
    const atlasRows = atlas.rows ?? definition.atlasSize.rows;
    const sourceLeft = Math.ceil(frame.column * atlasWidth / atlasColumns) + 1;
    const sourceTop = Math.ceil(frame.row * atlasHeight / atlasRows) + 1;
    const sourceRight = Math.floor((frame.column + 1) * atlasWidth / atlasColumns) - 1;
    const sourceBottom = Math.floor((frame.row + 1) * atlasHeight / atlasRows) - 1;
    const cellWidth = sourceRight - sourceLeft;
    const cellHeight = sourceBottom - sourceTop;
    ctx.imageSmoothingEnabled = true;
    const spriteSize = size * (atlas.renderScale ?? 1);
    ctx.drawImage(image, sourceLeft, sourceTop, cellWidth, cellHeight, groundX - spriteSize / 2, groundY - spriteSize * .98, spriteSize, spriteSize);
  }
  ctx.fillStyle = '#f4e7c2';
  ctx.font = '700 16px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${definition.label} · ${state.replaceAll('_', ' ')}`, groundX, 54);
  ctx.font = '12px Inter, sans-serif';
  ctx.fillStyle = '#b9c8c0';
  ctx.fillText(`direction ${direction} · ${skeletal ? 'continuous pose' : `frame ${frame.frameIndex + 1}/${clip.frames.length}`} · ${animateInput.checked ? `${Number(speedInput.value).toFixed(2)}×` : 'manual'}`, groundX, 78);
  ctx.textAlign = 'start';

  summary.innerHTML = `<strong>${definition.label}</strong> · ${state.replaceAll('_', ' ')} · ${ANIMATION_DIRECTIONS[direction].label}`;
  const ready = Boolean(image?.complete && image.naturalWidth);
  const fallback = frame.fallback ? ` · FALLBACK → ${frame.fallback}` : '';
  const authoredCount = new Set(clip.frames).size;
  const repeatedPassing = authoredCount === frame.frameCount ? '' : ` / ${frame.frameCount} playback steps`;
  asset.innerHTML = `<code>${frame.atlasKey}</code> row ${frame.row} / column ${frame.column} · ${authoredCount} authored frame${authoredCount === 1 ? '' : 's'}${repeatedPassing} · ${ready ? 'asset loaded' : 'asset pending'}${fallback}`;
  if (skeletal) asset.textContent = 'Continuous joint animation · four independently authored views · ' + (hearthkinRig.readiness().every(image => image.complete && image.naturalWidth) ? 'all surfaces loaded' : 'loading surfaces');
  geometry.textContent = `pivot ${definition.groundAnchor.x.toFixed(2)},${definition.groundAnchor.y.toFixed(2)} · collision ${definition.collisionRadius.toFixed(2)} · interaction ${definition.interactionRadius.toFixed(2)}`;
}

unitSelect.addEventListener('change', refreshStates);
stateSelect.addEventListener('change', refreshFrameRange);
for (const input of [directionSelect, frameInput, speedInput, animateInput, guidesInput]) input.addEventListener('input', draw);
// Shareable review links select only known units, states and directions.
const reviewParams = new URLSearchParams(location.search);
const reviewUnit = reviewParams.get('unit');
if (Object.hasOwn(ANIMATION_DEFINITIONS, reviewUnit)) unitSelect.value = reviewUnit;
refreshStates();
const reviewState = reviewParams.get('state');
if (Object.hasOwn(animationDefinition(selectedType()).clips, reviewState)) stateSelect.value = reviewState;
refreshFrameRange();
const reviewDirection = reviewParams.get('direction');
if (['0', '1', '2', '3'].includes(reviewDirection)) directionSelect.value = reviewDirection;

window.__crownforgeAnimationQA = {
  unitTypes: Object.keys(ANIMATION_DEFINITIONS),
  directions: ANIMATION_DIRECTIONS.map(({ index, key }) => ({ index, key })),
  assetStatus: () => Object.fromEntries(Object.entries(images).map(([type, atlases]) => [
    type,
    Object.fromEntries(Object.entries(atlases).map(([key, image]) => [key, {
      complete: image.complete,
      width: image.naturalWidth,
      height: image.naturalHeight,
    }])),
  ])),
  select: ({ type, state, direction = 0, animate = true }) => {
    unitSelect.value = type;
    refreshStates();
    stateSelect.value = state;
    refreshFrameRange();
    directionSelect.value = String(direction);
    animateInput.checked = animate;
    currentTime = 0;
    draw();
    return { type: selectedType(), state: selectedState(), direction: selectedDirection() };
  },
  frame: () => animationFrame(selectedType(), selectedState(), currentTime, selectedDirection()),
};

function loop(now) {
  const delta = Math.min(.05, (now - lastTime) / 1000);
  lastTime = now;
  if (animateInput.checked) currentTime += delta * Number(speedInput.value);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
