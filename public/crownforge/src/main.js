import { BUILDING_TYPES, FACTION, PRODUCTION_TYPES, RESOURCE_TYPES } from './config.js?v=20260819-fieldpass1';
import { CrownforgeAudio } from './audio.js?v=20260819-fieldpass1';
import { CrownforgeInput } from './input.js?v=20260819-fieldpass1';
import { CrownforgeRenderer } from './renderer.js?v=20260819-fieldpass1';
import { CrownforgeSimulation } from './simulation.js?v=20260819-fieldpass1';

const canvas = document.querySelector('#game-canvas');
const toast = document.querySelector('#toast');
const buildMenuToggle = document.querySelector('#build-menu-toggle');
const buildMenu = document.querySelector('#build-menu');
const buildButtons = [...document.querySelectorAll('[data-build-type]')];
const trainMenuWrap = document.querySelector('#train-menu-wrap');
const trainMenuToggle = document.querySelector('#train-menu-toggle');
const trainMenu = document.querySelector('#train-menu');
const trainButtons = [...document.querySelectorAll('[data-train-unit]')];
const trainQueueStatus = document.querySelector('#train-queue-status');
const cancelBuildButton = document.querySelector('#cancel-build');
const restartButton = document.querySelector('#restart-game');
const victoryPanel = document.querySelector('#victory-panel');
const outcomeKicker = document.querySelector('#outcome-kicker');
const outcomeTitle = document.querySelector('#outcome-title');
const outcomeCopy = document.querySelector('#outcome-copy');
const outcomeIcon = document.querySelector('#outcome-icon');
const controlsToggle = document.querySelector('#controls-toggle');
const controlsPanel = document.querySelector('#controls-panel');
const controlsMinimize = document.querySelector('#controls-minimize');
const masterVolume = document.querySelector('#master-volume');
const effectsVolume = document.querySelector('#effects-volume');
const reducedMotion = document.querySelector('#reduced-motion');
const unitSpeed = document.querySelector('#unit-speed');
const unitSpeedValue = document.querySelector('#unit-speed-value');
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
    trainMenu.hidden = true;
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
    buildMenu.hidden = !buildMenu.hidden;
    trainMenu.hidden = true;
  },
  onEscape: () => {
    audio.ui();
    buildMenu.hidden = true;
    trainMenu.hidden = true;
  },
});

buildMenuToggle.addEventListener('click', () => {
  audio.unlock();
  audio.ui();
  if (input.buildMode) {
    input.cancelBuildMode();
    return;
  }
  buildMenu.hidden = !buildMenu.hidden;
  trainMenu.hidden = true;
});
function beginBuildingPlacement(type) {
  audio.unlock();
  if (input.buildMode) {
    input.cancelBuildMode();
    return;
  }
  const blueprint = BUILDING_TYPES[type];
  if (!blueprint) return;
  const builder = simulation.units.find((unit) => unit.selected && unit.type === 'villager' && unit.faction === 'player' && !unit.dead);
  if (!builder) {
    announce(`Select a villager before placing a ${blueprint.label}.`);
    audio.play('invalid');
    return;
  }
  if (builder.carryAmount > 0) {
    announce('Let the selected villager deposit cargo before building.');
    audio.play('invalid');
    return;
  }
  if (!Object.entries(blueprint.cost ?? {}).every(([key, value]) => simulation.resources[key] >= value)) {
    const missing = Object.entries(blueprint.cost ?? {}).find(([key, value]) => simulation.resources[key] < value)?.[0] ?? 'resources';
    announce(`Not enough ${missing} for a ${blueprint.label}.`);
    audio.play('invalid');
    return;
  }
  input.setBuildMode(type);
}
buildButtons.forEach((button) => {
  button.addEventListener('click', () => beginBuildingPlacement(button.dataset.buildType));
});
cancelBuildButton.addEventListener('click', () => input.cancelBuildMode());
trainMenuToggle.addEventListener('click', () => {
  audio.unlock();
  audio.ui();
  if (input.buildMode) input.cancelBuildMode();
  buildMenu.hidden = true;
  trainMenu.hidden = !trainMenu.hidden;
});
trainButtons.forEach((button) => {
  button.addEventListener('click', () => {
    audio.unlock();
    const result = simulation.queueUnit(button.dataset.trainUnit);
    if (result.success) audio.ui(); else audio.play('invalid');
    updateUi();
  });
});
controlsToggle.addEventListener('click', () => {
  audio.unlock();
  audio.ui();
  if (input.buildMode) input.cancelBuildMode();
  buildMenu.hidden = true;
  trainMenu.hidden = true;
  controlsPanel.hidden = !controlsPanel.hidden;
});
controlsMinimize?.addEventListener('click', () => {
  controlsPanel.classList.toggle('is-collapsed');
  controlsMinimize.setAttribute('aria-expanded', String(!controlsPanel.classList.contains('is-collapsed')));
});
restartButton.addEventListener('click', () => {
  audio.unlock();
  audio.ui();
  simulation.reset();
  audio.reset(simulation);
  input.cancelBuildMode();
  buildMenu.hidden = true;
  trainMenu.hidden = true;
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
unitSpeed?.addEventListener('input', (event) => {
  const value = simulation.setUnitSpeedScale(event.target.value);
  if (unitSpeedValue) unitSpeedValue.textContent = `${value}×`;
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
  if (unitSpeed) unitSpeed.value = String(simulation.getUnitSpeedScale());
  if (unitSpeedValue) unitSpeedValue.textContent = `${simulation.getUnitSpeedScale()}×`;
  document.querySelector('#selection-title').textContent = selectionTitle();
  document.querySelector('#selection-detail').textContent = selectionStatus();
  const preview = renderer.buildPreview;
  document.querySelector('#command-line').textContent = input.buildMode
    ? `PLACEMENT MODE  •  ${preview?.valid ? 'site ready' : (preview?.reason ?? 'move the foundation')}`
    : commandLineText();
  document.querySelector('#clock').textContent = formatClock(simulation.clock);
  const builder = simulation.units.find((unit) => unit.selected && unit.type === 'villager' && unit.faction === 'player' && !unit.dead);
  buildButtons.forEach((button) => {
    const type = button.dataset.buildType;
    const blueprint = BUILDING_TYPES[type];
    if (!blueprint) return;
    const cost = blueprint.cost ?? {};
    const affordable = Object.entries(cost).every(([key, value]) => simulation.resources[key] >= value);
    const ready = Boolean(builder && affordable && builder.carryAmount <= 0);
    const detail = button.querySelector(`[data-build-detail="${type}"]`);
    const status = !builder ? 'SELECT VILLAGER' : builder.carryAmount > 0 ? 'DEPOSIT CARGO' : !affordable ? 'NEED RESOURCES' : 'READY';
    if (detail) detail.textContent = `${formatCost(cost) || 'NO COST'}  •  ${blueprint.wall ? 'DRAG TO AIM  •  8-WAY SNAP  •  ' : ''}${status}`;
    button.classList.toggle('is-unavailable', !ready);
    setTooltip(button, !builder
      ? `Select a villager before placing a ${blueprint.label}`
      : builder.carryAmount > 0
        ? 'Let the selected villager deposit cargo first'
        : !affordable
          ? `Gather the resources needed for a ${blueprint.label}`
          : blueprint.wall
            ? `Click-drag in any direction; the ${blueprint.label} snaps to the nearest of 8 orientations`
            : `Place a ${blueprint.label}`);
  });
  const selected = simulation.selectedEntities;
  const productionBuilding = selected.length === 1 && selected[0].kind === 'building'
    && selected[0].faction === 'player'
    && selected[0].progress >= 1
    && !selected[0].destroyed
    && BUILDING_TYPES[selected[0].type]?.production
    ? selected[0]
    : null;
  trainMenuWrap.hidden = !productionBuilding;
  if (!productionBuilding) trainMenu.hidden = true;
  if (productionBuilding) {
    const queue = productionBuilding.productionQueue ?? [];
    trainQueueStatus.textContent = queue.length
      ? `${queue.length} queued · ${Math.round((productionBuilding.productionProgress ?? 0) * 100)}% on current unit`
      : 'Select a unit to add it to the queue.';
    trainButtons.forEach((button) => {
      const type = button.dataset.trainUnit;
      const blueprint = PRODUCTION_TYPES[type];
      const queued = queue.filter((order) => order.type === type).length;
      const affordable = Object.entries(blueprint.cost).every(([key, value]) => simulation.resources[key] >= value);
      const capacityReady = simulation.population.used < simulation.population.capacity;
      const allowed = BUILDING_TYPES[productionBuilding.type].productionTypes?.includes(type) ?? false;
      const available = allowed && affordable && capacityReady && queue.length < 100;
      const detail = button.querySelector(`[data-train-detail="${type}"]`);
      if (detail) detail.textContent = `${formatCost(blueprint.cost)}  •  ${blueprint.trainTime} SEC${queued ? `  •  ${queued} QUEUED` : ''}`;
      button.hidden = !allowed;
      button.classList.toggle('is-unavailable', !available);
      setTooltip(button, !capacityReady
        ? 'Build another Hearth House for more population space'
        : !affordable
          ? `Gather the resources needed for a ${blueprint.label}`
          : queue.length >= 100
            ? `The ${BUILDING_TYPES[productionBuilding.type].label} training queue is full`
            : `Train a ${blueprint.label}`);
    });
  }
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
    placementDetail.textContent = valid
      ? preview?.type === 'wall'
        ? `${preview.wallSnapLabel ?? 'SNAPPED'} · ${preview.wallSegments ?? 1} segment${preview.wallSegments === 1 ? '' : 's'} · release to place`
        : 'Click to place  ·  Esc to cancel'
      : (preview?.reason ?? 'Move the foundation to a clear site.');
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
      : buildingAbilityLabel(building, blueprint);
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

function buildingAbilityLabel(building, blueprint) {
  if (blueprint.enemyStructure) return 'enemy settlement core · destroy to win';
  if (blueprint.production) {
    const products = (blueprint.productionTypes ?? []).map((type) => PRODUCTION_TYPES[type]?.label ?? type).join(' + ');
    return `trains ${products} · select a unit below`;
  }
  if (blueprint.storage) {
    const resource = building.type === 'lumberMill' ? 'wood' : building.type === 'quarry' ? 'stone' : building.type === 'grainMill' ? 'food' : 'all resources';
    return `drop-off for ${resource} · shortens return routes`;
  }
  if (blueprint.field) return building.farmerId ? 'one farmer tending · generates food' : 'one farmer · awaiting worker';
  if (blueprint.population) return `housing · adds ${blueprint.population} population space`;
  if (blueprint.wall) return 'defensive boundary · blocks movement';
  return 'structure ready · no active command';
}

function formatClock(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `DAYBREAK  ${minutes}:${secs}`;
}

function formatCost(cost) {
  return Object.entries(cost)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${value} ${key.toUpperCase()}`)
    .join(' · ');
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
