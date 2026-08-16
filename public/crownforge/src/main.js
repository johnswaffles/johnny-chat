import { BUILDING_TYPES, FACTION, RESOURCE_TYPES } from './config.js';
import { CrownforgeAudio } from './audio.js';
import { CrownforgeInput } from './input.js';
import { CrownforgeRenderer } from './renderer.js';
import { CrownforgeSimulation } from './simulation.js';

const canvas = document.querySelector('#game-canvas');
const toast = document.querySelector('#toast');
const buildMenuToggle = document.querySelector('#build-menu-toggle');
const buildMenu = document.querySelector('#build-menu');
const buildButton = document.querySelector('#build-house');
const cancelBuildButton = document.querySelector('#cancel-build');
const restartButton = document.querySelector('#restart-game');
const victoryPanel = document.querySelector('#victory-panel');
const outcomeKicker = document.querySelector('#outcome-kicker');
const outcomeTitle = document.querySelector('#outcome-title');
const outcomeCopy = document.querySelector('#outcome-copy');
const outcomeIcon = document.querySelector('#outcome-icon');
const controlsToggle = document.querySelector('#controls-toggle');
const controlsPanel = document.querySelector('#controls-panel');
const masterVolume = document.querySelector('#master-volume');
const effectsVolume = document.querySelector('#effects-volume');
const reducedMotion = document.querySelector('#reduced-motion');
const uiTooltip = document.querySelector('#ui-tooltip');
const placementReadout = document.querySelector('#placement-readout');
const placementIcon = document.querySelector('#placement-icon');
const placementTitle = document.querySelector('#placement-title');
const placementDetail = document.querySelector('#placement-detail');
const selectionIcon = document.querySelector('#selection-icon');
const selectionKind = document.querySelector('#selection-kind');

let toastTimer = null;
function announce(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3200);
}

let tooltipAnchor = null;
function setTooltip(element, message) {
  if (!element) return;
  element.dataset.tooltip = message;
  element.removeAttribute('title');
}

function showTooltip(element) {
  const message = element?.dataset.tooltip;
  if (!message) return;
  tooltipAnchor = element;
  uiTooltip.textContent = message;
  uiTooltip.hidden = false;
  const anchor = element.getBoundingClientRect();
  const tip = uiTooltip.getBoundingClientRect();
  const left = Math.max(10, Math.min(window.innerWidth - tip.width - 10, anchor.left + (anchor.width - tip.width) / 2));
  const above = anchor.top - tip.height - 8;
  uiTooltip.style.left = `${left}px`;
  uiTooltip.style.top = `${Math.max(10, above >= 10 ? above : anchor.bottom + 8)}px`;
}

function hideTooltip() {
  tooltipAnchor = null;
  uiTooltip.hidden = true;
}

function bindTooltips() {
  document.querySelectorAll('[title]').forEach((element) => {
    setTooltip(element, element.getAttribute('title'));
    element.addEventListener('pointerenter', () => showTooltip(element));
    element.addEventListener('pointerleave', hideTooltip);
    element.addEventListener('focus', () => showTooltip(element));
    element.addEventListener('blur', hideTooltip);
  });
  window.addEventListener('resize', hideTooltip);
}

const renderer = new CrownforgeRenderer(canvas);
const simulation = new CrownforgeSimulation({ onEvent: announce });
const audio = new CrownforgeAudio();
const input = new CrownforgeInput({
  canvas,
  renderer,
  simulation,
  onBuildMode: (mode) => {
    buildMenuToggle.classList.toggle('is-active', Boolean(mode));
    buildMenu.hidden = true;
    cancelBuildButton.hidden = !mode;
  },
  onToast: announce,
  onGesture: () => audio.unlock(),
  onSelection: (entities) => {
    if (entities.length) audio.select(entities.length);
  },
  onCommand: (result) => audio.command(result.success === false ? 'none' : result.kind),
  onPlacement: (result) => audio.placement(result.valid),
  onBuildShortcut: () => {
    if (input.buildMode) {
      input.cancelBuildMode();
      return;
    }
    audio.unlock();
    audio.ui();
    controlsPanel.hidden = true;
    buildMenu.hidden = !buildMenu.hidden;
  },
  onEscape: () => {
    audio.ui();
    buildMenu.hidden = true;
    controlsPanel.hidden = true;
  },
});

buildMenuToggle.addEventListener('click', () => {
  audio.unlock();
  audio.ui();
  if (input.buildMode) {
    input.cancelBuildMode();
    return;
  }
  controlsPanel.hidden = true;
  buildMenu.hidden = !buildMenu.hidden;
});
buildButton.addEventListener('click', () => {
  audio.unlock();
  if (input.buildMode) {
    input.cancelBuildMode();
    return;
  }
  const builder = simulation.units.find((unit) => unit.selected && unit.type === 'villager' && unit.faction === 'player' && !unit.dead);
  if (!builder) {
    announce('Select a villager before placing a Hearth House.');
    audio.play('invalid');
    return;
  }
  if (builder.carryAmount > 0) {
    announce('Let the selected villager deposit cargo before building.');
    audio.play('invalid');
    return;
  }
  if (simulation.resources.wood < BUILDING_TYPES.house.cost.wood) {
    announce('A Hearth House needs 55 wood.');
    audio.play('invalid');
    return;
  }
  controlsPanel.hidden = true;
  input.setBuildMode('house');
});
cancelBuildButton.addEventListener('click', () => input.cancelBuildMode());
controlsToggle.addEventListener('click', () => {
  audio.unlock();
  audio.ui();
  if (input.buildMode) input.cancelBuildMode();
  buildMenu.hidden = true;
  controlsPanel.hidden = !controlsPanel.hidden;
});
restartButton.addEventListener('click', () => {
  audio.unlock();
  audio.ui();
  simulation.reset();
  audio.reset(simulation);
  input.cancelBuildMode();
  buildMenu.hidden = true;
  controlsPanel.hidden = true;
  victoryPanel.hidden = true;
  victoryPanel.classList.remove('is-defeat');
  announce('A fresh Crownforge meadow awaits.');
});

masterVolume.addEventListener('input', (event) => audio.setMasterVolume(event.target.value));
effectsVolume.addEventListener('input', (event) => audio.setEffectsVolume(event.target.value));
reducedMotion.addEventListener('change', (event) => {
  input.setReducedMotion(event.target.checked);
  audio.ui();
});

function updateUi() {
  for (const [key, info] of Object.entries(RESOURCE_TYPES)) {
    const amount = Math.floor(simulation.resources[key]);
    document.querySelector(`[data-resource="${key}"]`).textContent = amount;
    document.querySelector(`[data-resource-cap="${key}"]`).textContent = `/ ${info.capacity}`;
    document.querySelector(`[data-resource-bar="${key}"]`).style.width = `${Math.min(100, (amount / info.capacity) * 100)}%`;
    setTooltip(document.querySelector(`[data-resource-card="${key}"]`), `${info.label}: ${amount} of ${info.capacity} stored`);
  }
  const population = simulation.population;
  document.querySelector('#population').textContent = `${population.used} / ${population.capacity}`;
  document.querySelector('#selection-title').textContent = selectionTitle();
  document.querySelector('#selection-detail').textContent = selectionStatus();
  const preview = renderer.buildPreview;
  document.querySelector('#command-line').textContent = input.buildMode
    ? `PLACEMENT MODE  •  ${preview?.valid ? 'site ready' : (preview?.reason ?? 'move the foundation')}`
    : commandLineText();
  document.querySelector('#clock').textContent = formatClock(simulation.clock);
  const builder = simulation.units.find((unit) => unit.selected && unit.type === 'villager' && unit.faction === 'player' && !unit.dead);
  const hasWood = simulation.resources.wood >= BUILDING_TYPES.house.cost.wood;
  const buildCost = document.querySelector('#build-cost');
  buildCost.textContent = `55 WOOD  •  ${!builder ? 'SELECT VILLAGER' : !hasWood ? 'NEED WOOD' : builder.carryAmount > 0 ? 'DEPOSIT CARGO' : 'READY'}`;
  buildButton.classList.toggle('is-unavailable', !builder || !hasWood || builder.carryAmount > 0);
  setTooltip(buildButton, !builder
    ? 'Select a villager before placing a Hearth House'
    : !hasWood
      ? 'Gather 55 wood before placing a Hearth House'
      : builder.carryAmount > 0
        ? 'Let the selected villager deposit cargo first'
        : 'Place a Hearth House');
  const selected = simulation.selectedEntities;
  document.querySelector('#selection-count').textContent = selected.length ? `${selected.length} SELECTED` : 'NO SELECTION';
  const presentation = selectionPresentation();
  selectionKind.textContent = presentation.kind;
  selectionIcon.className = `ui-icon selection-icon ${presentation.icon}`;
  placementReadout.hidden = !input.buildMode;
  if (input.buildMode) {
    const valid = Boolean(preview?.valid);
    placementReadout.classList.toggle('is-valid', valid);
    placementReadout.classList.toggle('is-invalid', !valid);
    placementIcon.className = `ui-icon ${valid ? 'icon-house' : 'icon-cancel'}`;
    placementTitle.textContent = valid ? 'FOUNDATION READY' : 'CANNOT PLACE HERE';
    placementDetail.textContent = valid ? 'Click to place  ·  Esc to cancel' : (preview?.reason ?? 'Move the foundation to a clear site.');
  }
  const outcome = simulation.phase !== 'playing';
  victoryPanel.hidden = !outcome;
  if (outcome) {
    const defeat = simulation.phase === 'defeat';
    victoryPanel.classList.toggle('is-defeat', defeat);
    outcomeIcon.className = `ui-icon ${defeat ? 'icon-defeat' : 'icon-victory'}`;
    outcomeKicker.textContent = defeat ? 'CROWN HALL LOST' : 'ASHEN CAMP BROKEN';
    outcomeTitle.textContent = defeat ? 'The Crownwardens fall.' : 'The meadow is secured.';
    outcomeCopy.textContent = defeat
      ? 'The Crown Hall has fallen to the raiders. Reset the slice and try a faster defense.'
      : 'The Ashen Camp is destroyed. This tiny slice is complete enough to polish, not expand.';
  }
}

function commandLineText() {
  const activeUnits = simulation.selectedEntities
    .filter((entity) => entity.kind === 'unit' && entity.faction === 'player' && !entity.dead && entity.command !== 'idle' && entity.actionLabel)
    .map((entity) => entity.actionLabel);
  if (activeUnits.length === 1) return activeUnits[0];
  if (activeUnits.length > 1) {
    const unique = [...new Set(activeUnits)];
    return unique.length === 1 ? `${activeUnits.length} units · ${unique[0]}` : `${activeUnits.length} units active.`;
  }
  return simulation.lastCommand;
}

function selectionTitle() {
  const entities = simulation.selectedEntities;
  if (!entities.length) return 'No selection';
  if (entities.length > 1) return `${entities.length} Crownwardens`;
  const entity = entities[0];
  if (entity.kind === 'unit') return entity.type === 'soldier' ? 'Crown Guard' : 'Villager';
  if (entity.kind === 'building') return BUILDING_TYPES[entity.type]?.label ?? 'Structure';
  return entity.resourceType[0].toUpperCase() + entity.resourceType.slice(1);
}

function selectionPresentation() {
  const entities = simulation.selectedEntities;
  if (!entities.length) return { kind: 'NO SELECTION', icon: 'icon-controls' };
  if (entities.length > 1) return { kind: 'GROUP', icon: 'icon-population' };
  const entity = entities[0];
  if (entity.kind === 'unit') return entity.type === 'soldier'
    ? { kind: 'COMBAT UNIT', icon: 'icon-soldier' }
    : { kind: 'WORKER', icon: 'icon-villager' };
  if (entity.kind === 'building') return { kind: entity.progress < 1 ? 'UNDER CONSTRUCTION' : 'BUILDING', icon: 'icon-house' };
  return { kind: 'RESOURCE NODE', icon: `icon-${entity.resourceType}` };
}

function selectionStatus() {
  const entities = simulation.selectedEntities;
  if (entities.length === 1 && entities[0].kind === 'building') {
    const building = entities[0];
    const blueprint = BUILDING_TYPES[building.type];
    const stage = building.progress >= 1
      ? ''
      : building.progress < 0.1
        ? ' · foundation'
        : building.progress < 0.38
          ? ' · early construction'
          : building.progress < 0.68
            ? ' · mid construction'
            : ' · late construction';
    const progress = building.progress < 1 ? ` · build ${Math.round(building.progress * 100)}%${stage}` : '';
    const currentFunction = building.progress < 1
      ? 'construction active'
      : blueprint.storage
        ? 'drop-off active'
        : blueprint.population
          ? 'housing active'
          : blueprint.enemyStructure
            ? 'enemy core'
            : 'structure ready';
    return `${Math.ceil(building.hp)} / ${building.maxHp} HP${progress} · ${blueprint.function} · ${currentFunction}`;
  }
  const units = entities.filter((entity) => entity.kind === 'unit' && entity.faction === 'player' && !entity.dead);
  if (units.length === 1) {
    const unit = units[0];
    const cargo = unit.carryAmount > 0 ? ` · carrying ${unit.carryAmount} ${unit.carryType}` : '';
    const health = unit.type !== 'villager' && unit.hp < unit.maxHp ? ` · ${Math.ceil(unit.hp)}/${unit.maxHp} HP` : '';
    return `${unit.actionLabel}${health}${cargo}`;
  }
  if (units.length > 1) {
    const active = units.filter((unit) => unit.command !== 'idle').length;
    const carrying = units.filter((unit) => unit.carryAmount > 0).length;
    if (carrying) return `${units.length} units · ${carrying} carrying${active ? ` · ${active} active` : ''}`;
    if (active) return `${units.length} units · ${active} active`;
    return `${units.length} units ready.`;
  }
  if (entities.length === 1 && entities[0].kind === 'resource') {
    const node = entities[0];
    const info = RESOURCE_TYPES[node.resourceType];
    return node.amount > 0
      ? `${Math.round(node.amount)} ${info.label.toLowerCase()} remaining · right-click to gather`
      : `${info.label} depleted · choose another resource`;
  }
  return simulation.lastCommand;
}

function formatClock(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `DAYBREAK  ${minutes}:${secs}`;
}

let previous = performance.now();
function frame(now) {
  const delta = Math.min(0.05, (now - previous) / 1000);
  previous = now;
  input.update(delta);
  simulation.update(delta);
  audio.sync(simulation);
  renderer.render(simulation, input, now);
  updateUi();
  requestAnimationFrame(frame);
}

window.crownforge = { simulation, renderer, input, audio };
bindTooltips();
announce(`${FACTION.name} are ready. Select a villager, then right-click a resource.`);
requestAnimationFrame(frame);
