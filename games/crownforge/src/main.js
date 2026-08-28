import { BUILDING_TYPES, FACTION, FIRST_AGE_BUILD_BLUEPRINTS, PRODUCTION_TYPES, RESOURCE_TYPES, UNIT_TYPES } from './config.js?v=20260828-forestpass1';
import { CrownforgeAudio } from './audio.js?v=20260821-hallwoodpass2';
import { CrownforgeInput } from './input.js?v=20260828-latencypass1';
import { CrownforgeRenderer } from './renderer.js?v=20260828-forestpass1';
import { CrownforgeSimulation } from './simulation.js?v=20260828-forestpass1';
import { CrownforgePerformanceMonitor } from './performance.js?v=20260824-perfpass1';
import { summarizeUnitTasks } from './task-summary.js?v=20260823-constructionretask1';

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
const musicToggle = document.querySelector('#music-toggle');
const musicToggleLabel = document.querySelector('#music-toggle-label');
const reducedMotion = document.querySelector('#reduced-motion');
const unitSpeed = document.querySelector('#unit-speed');
const unitSpeedValue = document.querySelector('#unit-speed-value');
const harvestSpeed = document.querySelector('#harvest-speed');
const harvestSpeedValue = document.querySelector('#harvest-speed-value');
const uiTooltip = document.querySelector('#ui-tooltip');
const placementReadout = document.querySelector('#placement-readout');
const placementIcon = document.querySelector('#placement-icon');
const placementTitle = document.querySelector('#placement-title');
const placementDetail = document.querySelector('#placement-detail');
const selectionIcon = document.querySelector('#selection-icon');
const selectionKind = document.querySelector('#selection-kind');
const selectionRecovery = document.querySelector('#selection-recovery');
const recoverUnitsButton = document.querySelector('#recover-units');
const selectionVillagerActions = document.querySelector('#selection-villager-actions');
const selectAllVillagersButton = document.querySelector('#select-all-villagers');
const demolitionModeButton = document.querySelector('#demolition-mode');
const loadingVeil = document.querySelector('#loading-veil');
const loadingDetail = document.querySelector('#loading-detail');
const loadingProgress = document.querySelector('#loading-progress');
const performancePanel = document.querySelector('#performance-panel');
const ui = {
  resources: Object.fromEntries(Object.keys(RESOURCE_TYPES).map((key) => [key, {
    value: document.querySelector(`[data-resource="${key}"]`),
    cap: document.querySelector(`[data-resource-cap="${key}"]`),
    bar: document.querySelector(`[data-resource-bar="${key}"]`),
    card: document.querySelector(`[data-resource-card="${key}"]`),
  }])),
  population: document.querySelector('#population'),
  selectionCount: document.querySelector('#selection-count'),
  selectionTitle: document.querySelector('#selection-title'),
  selectionDetail: document.querySelector('#selection-detail'),
  commandLine: document.querySelector('#command-line'),
  clock: document.querySelector('#clock'),
  buildDetails: Object.fromEntries(buildButtons.map((button) => [button.dataset.buildType, button.querySelector(`[data-build-detail="${button.dataset.buildType}"]`)])),
  trainDetails: Object.fromEntries(trainButtons.map((button) => [button.dataset.trainUnit, button.querySelector(`[data-train-detail="${button.dataset.trainUnit}"]`)])),
};

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
const query = new URLSearchParams(window.location.search);
const performanceMonitor = new CrownforgePerformanceMonitor(performancePanel, {
  enabled: query.has('perf'),
  stressMode: simulation.stressMode,
  lowResolutionMode: renderer.lowResolutionMode,
});
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
  onDemolitionMode: (active) => {
    demolitionModeButton?.classList.toggle('is-active', active);
    buildMenu.hidden = true;
    trainMenu.hidden = true;
    cancelBuildButton.hidden = !active && !input.buildMode;
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
  onDemolitionShortcut: () => activateDemolitionControl(),
  onRecoverShortcut: () => {
    if (!simulation.canRecoverSelectedUnits()) return;
    audio.unlock();
    audio.ui();
    simulation.unstickSelectedUnits();
    updateUi();
  },
  onSelectAllVillagersShortcut: () => {
    if (!simulation.selectedEntities.some((entity) => entity.kind === 'unit' && entity.type === 'villager' && entity.faction === 'player' && !entity.dead)) return;
    audio.unlock();
    audio.ui();
    const result = simulation.selectAllVillagers();
    if (result.success) audio.select(result.count);
    updateUi();
  },
  onEscape: () => {
    audio.ui();
    buildMenu.hidden = true;
    trainMenu.hidden = true;
  },
});

function activateDemolitionControl() {
  const selectedStructures = simulation.selectedEntities.filter((entity) => simulation.canDemolishBuilding(entity));
  if (selectedStructures.length) {
    const result = simulation.demolishStructures(selectedStructures);
    for (const target of result.targets ?? []) renderer.addRipple(target, '#d86b55');
    input.cancelDemolitionMode();
    audio.command(result.success === false ? 'none' : result.kind);
    updateUi();
    return result;
  }
  input.setDemolitionMode(!input.demolitionMode);
  updateUi();
  return { kind: 'demolish-mode', success: true, active: input.demolitionMode };
}

buildMenuToggle.addEventListener('click', () => {
  audio.unlock();
  audio.ui();
  if (input.buildMode) {
    input.cancelBuildMode();
    return;
  }
  if (input.demolitionMode) input.cancelDemolitionMode();
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
  if (!blueprint || !FIRST_AGE_BUILD_BLUEPRINTS.includes(type)) return;
  const builder = simulation.units.find((unit) => unit.selected && simulation.isBuilderUnit(unit));
  if (!builder) {
    announce(`Select a builder before placing a ${blueprint.label}.`);
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
cancelBuildButton.addEventListener('click', () => {
  input.cancelBuildMode();
  input.cancelDemolitionMode();
});
trainMenuToggle.addEventListener('click', () => {
  audio.unlock();
  audio.ui();
  if (input.buildMode) input.cancelBuildMode();
  if (input.demolitionMode) input.cancelDemolitionMode();
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
restartButton.addEventListener('click', () => {
  audio.unlock();
  audio.ui();
  simulation.reset();
  audio.reset(simulation);
  input.cancelBuildMode();
  input.cancelDemolitionMode();
  buildMenu.hidden = true;
  trainMenu.hidden = true;
  victoryPanel.hidden = true;
  victoryPanel.classList.remove('is-defeat');
  announce('A fresh Crownforge meadow awaits.');
});

function updateMusicControl() {
  if (!musicToggle) return;
  const muted = audio.isMusicMuted();
  musicToggle.classList.toggle('is-muted', muted);
  musicToggle.setAttribute('aria-pressed', String(muted));
  musicToggleLabel.textContent = muted ? 'MUSIC OFF' : 'MUSIC ON';
  setTooltip(musicToggle, muted ? 'Unmute Lantern Under Stone' : 'Mute Crownforge music');
}

musicToggle?.addEventListener('click', () => {
  audio.unlock();
  const muted = audio.toggleMusic();
  updateMusicControl();
  announce(muted ? 'Crownforge music muted.' : 'Lantern Under Stone is playing.');
});

reducedMotion.addEventListener('change', (event) => {
  input.setReducedMotion(event.target.checked);
  audio.ui();
});
unitSpeed?.addEventListener('input', (event) => {
  const value = simulation.setUnitSpeedScale(event.target.value);
  if (unitSpeedValue) unitSpeedValue.textContent = `${value}×`;
});
harvestSpeed?.addEventListener('input', (event) => {
  const value = simulation.setHarvestSpeedScale(event.target.value);
  if (harvestSpeedValue) harvestSpeedValue.textContent = `${value}×`;
});

recoverUnitsButton?.addEventListener('click', () => {
  audio.unlock();
  audio.ui();
  const result = simulation.unstickSelectedUnits();
  if (result.success) audio.command('move');
  updateUi();
});

selectAllVillagersButton?.addEventListener('click', () => {
  audio.unlock();
  audio.ui();
  const result = simulation.selectAllVillagers();
  if (result.success) audio.select(result.count);
  announce(simulation.lastCommand);
  updateUi();
});

demolitionModeButton?.addEventListener('click', () => {
  audio.unlock();
  activateDemolitionControl();
});

function updateUi() {
  for (const [key, info] of Object.entries(RESOURCE_TYPES)) {
    const amount = Math.floor(simulation.resources[key]);
    const resourceUi = ui.resources[key];
    resourceUi.value.textContent = amount;
    resourceUi.cap.textContent = `/ ${info.capacity}`;
    resourceUi.bar.style.width = `${Math.min(100, (amount / info.capacity) * 100)}%`;
    setTooltip(resourceUi.card, `${info.label}: ${amount} of ${info.capacity} stored`);
  }
  const population = simulation.population;
  ui.population.textContent = `${population.used} / ${population.capacity}`;
  if (unitSpeed) unitSpeed.value = String(simulation.getUnitSpeedScale());
  if (unitSpeedValue) unitSpeedValue.textContent = `${simulation.getUnitSpeedScale()}×`;
  if (harvestSpeed) harvestSpeed.value = String(simulation.getHarvestSpeedScale());
  if (harvestSpeedValue) harvestSpeedValue.textContent = `${simulation.getHarvestSpeedScale()}×`;
  ui.selectionTitle.textContent = selectionTitle();
  ui.selectionDetail.textContent = selectionStatus();
  if (selectionRecovery) selectionRecovery.hidden = !simulation.canRecoverSelectedUnits();
  const hasSelectedVillager = simulation.selectedEntities.some((entity) => entity.kind === 'unit'
    && entity.type === 'villager'
    && entity.faction === 'player'
    && !entity.dead);
  if (selectionVillagerActions) selectionVillagerActions.hidden = !hasSelectedVillager;
  const preview = renderer.buildPreview;
  ui.commandLine.textContent = input.demolitionMode
    ? 'INSTANT DEMOLITION  •  click or drag across structures  •  debris clears immediately  •  Crown Hall protected'
    : input.buildMode
    ? `PLACEMENT MODE  •  ${preview?.valid ? 'site ready' : (preview?.reason ?? 'move the foundation')}`
    : commandLineText();
  ui.clock.textContent = formatClock(simulation.clock);
  const builder = simulation.units.find((unit) => unit.selected && simulation.isBuilderUnit(unit));
  buildButtons.forEach((button) => {
    const type = button.dataset.buildType;
    const blueprint = BUILDING_TYPES[type];
    if (!blueprint) return;
    const cost = blueprint.cost ?? {};
    const affordable = Object.entries(cost).every(([key, value]) => simulation.resources[key] >= value);
    const ready = Boolean(builder && affordable && builder.carryAmount <= 0);
    const detail = ui.buildDetails[type];
    const status = !builder ? 'SELECT BUILDER' : builder.carryAmount > 0 ? 'DEPOSIT CARGO' : !affordable ? 'NEED RESOURCES' : 'READY';
    const placementHint = blueprint.wall
      ? 'DRAG TO AIM  •  8-WAY SNAP  •  WIDE MAGNET  •  EDGE LOCK  •  '
      : blueprint.gate
        ? 'SNAPS TO WALL  •  REPLACES 1 PANEL  •  PASSABLE  •  '
        : blueprint.wallAttachment
          ? 'SNAPS TO WALL  •  REPLACES 1 PANEL  •  HARDPOINT  •  '
        : '';
    if (detail) detail.textContent = `${formatCost(cost) || 'NO COST'}  •  ${placementHint}${status}`;
    button.classList.toggle('is-unavailable', !ready);
    setTooltip(button, !builder
      ? `Select a builder before placing a ${blueprint.label}`
      : builder.carryAmount > 0
        ? 'Let the selected villager deposit cargo first'
        : !affordable
          ? `Gather the resources needed for a ${blueprint.label}`
          : blueprint.wall
          ? `Click-drag from or toward a wall end; the ${blueprint.label} locks on within a generous radius, then snaps to 8 orientations`
          : blueprint.gate
            ? `Move the ${blueprint.label} over a Palisade; it magnetically replaces one panel with a passable opening`
            : blueprint.wallAttachment
              ? `Move the ${blueprint.label} over a Palisade; it magnetically replaces one panel and reconnects the wall around the hardpoint`
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
      const detail = ui.trainDetails[type];
      if (detail) detail.textContent = `${formatCost(blueprint.cost)}  •  ${blueprint.trainTime} SEC${queued ? `  •  ${queued} QUEUED` : ''}`;
      button.hidden = !allowed;
      button.classList.toggle('is-unavailable', !available);
      setTooltip(button, !capacityReady
        ? 'The settlement has reached its current population limit'
        : !affordable
          ? `Gather the resources needed for a ${blueprint.label}`
          : queue.length >= 100
            ? `The ${BUILDING_TYPES[productionBuilding.type].label} training queue is full`
            : `Train a ${blueprint.label}`);
    });
  }
  ui.selectionCount.textContent = selected.length ? `${selected.length} SELECTED` : 'NO SELECTION';
  const presentation = selectionPresentation();
  selectionKind.textContent = presentation.kind;
  selectionIcon.className = `ui-icon selection-icon ${presentation.icon}`;
  placementReadout.hidden = !input.buildMode && !input.demolitionMode;
  if (input.demolitionMode) {
    const targetCount = renderer.demolitionPreview.length;
    placementReadout.classList.toggle('is-valid', targetCount > 0);
    placementReadout.classList.toggle('is-invalid', targetCount === 0);
    placementIcon.className = 'ui-icon icon-cancel';
    placementTitle.textContent = 'INSTANT DEMOLITION';
    placementDetail.textContent = targetCount
      ? `${targetCount} structure${targetCount === 1 ? '' : 's'} selected · release to demolish and clear debris`
      : 'Click one structure or drag across several · X / Esc cancels';
  } else if (input.buildMode) {
    const valid = Boolean(preview?.valid);
    placementReadout.classList.toggle('is-valid', valid);
    placementReadout.classList.toggle('is-invalid', !valid);
    placementIcon.className = `ui-icon ${valid ? 'icon-house' : 'icon-cancel'}`;
    placementTitle.textContent = valid ? 'FOUNDATION READY' : 'CANNOT PLACE HERE';
    placementDetail.textContent = valid
      ? preview?.type === 'wall'
        ? `${preview.wallSnapLabel ?? 'SNAPPED'} · ${preview.wallSegments ?? 1} segment${preview.wallSegments === 1 ? '' : 's'}${preview.wallEdgeSnap ? ' · MAP EDGE LOCK' : ''}${preview.wallConnectCount ? ` · connects ${preview.wallConnectCount} wall end${preview.wallConnectCount === 1 ? '' : 's'}` : ''}${preview.resourceClearCount ? ` · clears ${preview.resourceClearCount} resource node${preview.resourceClearCount === 1 ? '' : 's'}` : ''} · release to place`
        : preview?.type === 'gate'
          ? `Palisade opening · ${preview.gateWallId ? 'wall panel snapped' : 'move over a wall'} · click to place`
          : preview?.type === 'palisadeTower'
            ? `Palisade hardpoint · ${preview.attachmentWallId ? 'wall panel snapped' : 'move over a wall'} · click to replace panel`
        : 'Click to place  ·  Hall vision active  ·  Esc to cancel'
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
    .filter((entity) => entity.kind === 'unit' && entity.faction === 'player' && !entity.dead && entity.command !== 'idle' && entity.actionLabel);
  if (activeUnits.length === 1) return activeUnits[0].actionLabel;
  if (activeUnits.length > 1) return summarizeUnitTasks(activeUnits, { includeReady: false, maxEntries: 3 });
  return simulation.lastCommand;
}

function selectionTitle() {
  const entities = simulation.selectedEntities;
  if (!entities.length) return 'No selection';
  if (entities.length > 1) return `${entities.length} Crownwardens`;
  const entity = entities[0];
  if (entity.kind === 'unit') return UNIT_TYPES[entity.type]?.label ?? 'Unit';
  if (entity.kind === 'building') return BUILDING_TYPES[entity.type]?.label ?? 'Structure';
  if (entity.type === 'grove' && entity.sizeTier === 'ancient') return 'Ancient Forest';
  if (entity.type === 'grove' && entity.sizeTier === 'large') return 'Great Woodland';
  if (entity.type === 'grove') return 'Timber Grove';
  return entity.resourceType[0].toUpperCase() + entity.resourceType.slice(1);
}

function selectionPresentation() {
  const entities = simulation.selectedEntities;
  if (!entities.length) return { kind: 'NO SELECTION', icon: 'icon-controls' };
  if (entities.length > 1) return { kind: 'GROUP', icon: 'icon-population' };
  const entity = entities[0];
  if (entity.kind === 'unit') return entity.type === 'villager'
    ? { kind: 'WORKER', icon: 'icon-villager' }
    : { kind: 'COMBAT UNIT', icon: 'icon-soldier' };
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
    if (building.demolitionQueued) {
      const remaining = Math.round((building.demolitionWork / Math.max(1, building.demolitionMaxWork)) * 100);
      return `${Math.ceil(building.hp)} / ${building.maxHp} HP · dismantling · ${remaining}% labor remaining · selected Villagers work from safe edge positions`;
    }
    const damage = building.progress >= 1 && building.hp < building.maxHp
      ? ` · ${Math.round((building.hp / building.maxHp) * 100)}% integrity`
      : '';
    const currentFunction = building.progress < 1
      ? 'construction active'
      : building.hp < building.maxHp
        ? 'repair available · select a builder and click with the hammer cursor'
      : buildingAbilityLabel(building, blueprint);
    return `${Math.ceil(building.hp)} / ${building.maxHp} HP${progress}${damage} · ${blueprint.function} · ${currentFunction}`;
  }
  const units = entities.filter((entity) => entity.kind === 'unit' && entity.faction === 'player' && !entity.dead);
  if (units.length === 1) {
    const unit = units[0];
    const cargo = unit.carryAmount > 0 ? ` · carrying ${unit.carryAmount} ${unit.carryType}` : '';
    const health = ` · ${Math.ceil(unit.hp)}/${unit.maxHp} HP`;
    const status = unit.stunTimer > 0
      ? ` · stunned ${Math.max(1, Math.ceil(unit.stunTimer))}s`
      : unit.stunImmunityTimer > 0
        ? ` · stun immune ${Math.ceil(unit.stunImmunityTimer)}s`
        : '';
    const defense = unit.type === 'villager'
      ? unit.lastLightWardTimer > 0
        ? ` · Last Light Ward ${Math.ceil(unit.lastLightWardTimer)}s · invulnerable`
        : ' · defensive strike stuns humanoids · Last Light Ward ready'
      : '';
    return `${unit.actionLabel}${health}${cargo}${status}${defense}`;
  }
  if (units.length > 1) {
    return summarizeUnitTasks(units, { includeReady: true, maxEntries: 3 });
  }
  if (entities.length === 1 && entities[0].kind === 'resource') {
    const node = entities[0];
    const info = RESOURCE_TYPES[node.resourceType];
    const workPositions = node.type === 'grove'
      ? node.sizeTier === 'ancient' ? 16 : node.sizeTier === 'large' ? 10 : 8
      : 6;
    return node.amount > 0
      ? `${Math.round(node.amount)} ${info.label.toLowerCase()} remaining · ${workPositions} work position${workPositions === 1 ? '' : 's'} · click to gather`
      : `${info.label} depleted · choose another resource`;
  }
  return simulation.lastCommand;
}

function buildingAbilityLabel(building, blueprint) {
  if (blueprint.enemyStructure) return 'enemy settlement core · destroy to win';
  const acceptedResources = blueprint.acceptsResources ?? Object.keys(RESOURCE_TYPES);
  const acceptedLabel = acceptedResources.length === Object.keys(RESOURCE_TYPES).length
    ? 'food, wood, stone, and gold'
    : acceptedResources.map((type) => RESOURCE_TYPES[type]?.label?.toLowerCase() ?? type).join(' and ');
  if (blueprint.production) {
    const products = (blueprint.productionTypes ?? []).map((type) => PRODUCTION_TYPES[type]?.label ?? type).join(' + ');
    const dropoff = blueprint.storage ? `drop-off for ${acceptedLabel} · ` : '';
    return `${dropoff}trains ${products} · select a unit below`;
  }
  if (blueprint.storage) {
    const support = blueprint.gatherBonus
      ? ` · +${Math.round((blueprint.gatherBonus.multiplier - 1) * 100)}% ${RESOURCE_TYPES[blueprint.gatherBonus.resourceType]?.label ?? blueprint.gatherBonus.resourceType} yield within ${blueprint.gatherBonus.radius} tiles`
      : '';
    return `drop-off for ${acceptedLabel} · shortens return routes${support}`;
  }
  if (blueprint.field) return building.farmerId ? 'one farmer tending · generates food' : 'one farmer · awaiting worker';
  if (blueprint.population) return `housing · adds ${blueprint.population} population space`;
  if (blueprint.wall) return 'defensive boundary · blocks movement';
  if (blueprint.gate) return 'passable defensive entryway · replaces one Palisade panel';
  if (blueprint.wallAttachment) return 'reinforced Palisade hardpoint · replaces one wall panel';
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
let sceneReady = false;
let sceneReadyAnnounced = false;
let uiAccumulator = 1;
const UI_UPDATE_INTERVAL = 1 / 12;
function frame(now) {
  const frameStart = performance.now();
  const delta = Math.min(0.05, (now - previous) / 1000);
  previous = now;

  if (!sceneReady) {
    const readiness = renderer.startupReadiness();
    const percent = Math.round(readiness.ratio * 100);
    loadingProgress.style.width = `${percent}%`;
    loadingDetail.textContent = readiness.ready
      ? 'The meadow is ready.'
      : `Loading first-age artwork… ${percent}%`;
    if (!readiness.ready) {
      requestAnimationFrame(frame);
      return;
    }

    sceneReady = true;
    renderer.render(simulation, input, now);
    updateUi();
    loadingVeil.classList.add('is-ready');
    loadingVeil.setAttribute('aria-hidden', 'true');
    window.setTimeout(() => { loadingVeil.hidden = true; }, 450);
  }

  input.update(delta);
  const simulationStart = performance.now();
  simulation.update(delta);
  const simulationMs = performance.now() - simulationStart;
  audio.sync(simulation);
  const renderStart = performance.now();
  renderer.render(simulation, input, now);
  const renderMs = performance.now() - renderStart;
  uiAccumulator += delta;
  let uiMs = 0;
  if (uiAccumulator >= UI_UPDATE_INTERVAL) {
    const uiStart = performance.now();
    updateUi();
    uiMs = performance.now() - uiStart;
    uiAccumulator = 0;
  }
  performanceMonitor.recordFrame({
    now,
    frameMs: performance.now() - frameStart,
    simulationMs,
    renderMs,
    uiMs,
    entityCount: simulation.getEntityCount(),
  });
  if (!sceneReadyAnnounced) {
    sceneReadyAnnounced = true;
    announce(`${FACTION.name} are ready. Select a villager, then click a resource.`);
  }
  requestAnimationFrame(frame);
}

window.crownforge = { simulation, renderer, input, audio };
bindTooltips();
updateMusicControl();
requestAnimationFrame(frame);
