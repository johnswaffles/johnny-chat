import {
  ANIMAL_SPECIES,
  BUILDINGS,
  DISCOVERIES,
  PRIORITY_LEVELS,
  PRIORITY_META,
  RESOURCE_META,
  SPEEDS,
  WORLD
} from "./data.js";
import {
  activityText as selectedActivityText,
  cancelBuilding,
  demolishBuilding,
  discoveryStats,
  getSaveStatus,
  loadSave,
  majorEventStatus,
  newGame,
  objectiveState,
  populationStats,
  placementCheck,
  placeBuilding,
  resourceCount,
  saveGame,
  selectedEntity,
  selectAt,
  relationshipSummary,
  storageRoom,
  storageCapacity,
  supplyLevel,
  timePeriod,
  tick
} from "./simulation.js";
import { createRenderer } from "./render.js?v=motion-2";

const canvas = document.querySelector("#settlement-canvas");
const renderer = createRenderer(canvas);
let state = loadSave() || newGame();
const initialSaveStatus = getSaveStatus();
let lastFrame = performance.now();
let saveTimer = 0;
let uiTimer = 0;
let drag = null;
let keyPan = { x: 0, y: 0 };
let toastTimer = 0;
let audioPrimed = false;
let stormAudio = null;
const criticalStateSignature = (currentState) => {
  const discovery = currentState.discoveries?.notice?.id || "";
  const majorPhase = currentState.majorEvent?.phase && currentState.majorEvent.phase !== "dormant" ? currentState.majorEvent.phase : "";
  return [discovery, currentState.milestoneShown ? "village" : "", currentState.majorEvent?.milestoneShown ? "storm-milestone" : "", majorPhase].join("|");
};
let lastCriticalSaveSignature = criticalStateSignature(state);

const primeStormAudio = () => {
  audioPrimed = true;
  if (stormAudio?.context?.state === "suspended") stormAudio.context.resume();
};

const updateStormAudio = () => {
  const storming = state.majorEvent?.phase === "storm";
  if (storming && audioPrimed && !stormAudio) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      const context = new AudioContext();
      const master = context.createGain();
      master.gain.value = 0;
      master.connect(context.destination);
      const wind = context.createOscillator();
      const windGain = context.createGain();
      wind.type = "sawtooth";
      wind.frequency.value = 47;
      windGain.gain.value = 0.012;
      wind.connect(windGain).connect(master);
      wind.start();
      const rumble = context.createOscillator();
      const rumbleGain = context.createGain();
      rumble.type = "sine";
      rumble.frequency.value = 71;
      rumbleGain.gain.value = 0.02;
      rumble.connect(rumbleGain).connect(master);
      rumble.start();
      stormAudio = { context, master, wind, rumble };
    }
  }
  if (stormAudio) {
    if (stormAudio.context.state === "suspended") stormAudio.context.resume();
    stormAudio.master.gain.setTargetAtTime(storming ? 0.34 : 0, stormAudio.context.currentTime, 0.7);
  }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  time: $("#settlement-time"),
  day: $("#settlement-day"),
  period: $("#settlement-period"),
  weather: $("#settlement-weather"),
  speed: $("#settlement-speed"),
  pause: $("#settlement-pause"),
  save: $("#settlement-save"),
  saveStatus: $("#settlement-save-status"),
  reset: $("#settlement-reset"),
  toast: $("#settlement-toast"),
  objectives: $("#settlement-objectives"),
  population: $("#settlement-population"),
  guideTitle: $("#settlement-guide-title"),
  guideCopy: $("#settlement-guide-copy"),
  discoveryCount: $("#settlement-discovery-count"),
  discoveries: $("#settlement-discoveries"),
  inventory: $("#settlement-inventory"),
  storageCapacity: $("#settlement-storage-capacity"),
  priorities: $("#settlement-priorities"),
  villagers: $("#settlement-villagers"),
  selected: $("#settlement-selected"),
  build: $("#settlement-build-menu"),
  eventLog: $("#settlement-event-log"),
  milestone: $("#settlement-milestone"),
  milestoneClose: $("#settlement-milestone-close"),
  discoveryModal: $("#settlement-discovery-modal"),
  discoveryIcon: $("#settlement-discovery-icon"),
  discoveryTitle: $("#discovery-title"),
  discoveryDescription: $("#settlement-discovery-description"),
  discoveryReward: $("#settlement-discovery-reward"),
  discoveryClose: $("#settlement-discovery-close"),
  majorEventSection: $("#settlement-major-event-section"),
  majorEventBanner: $("#settlement-major-event-banner"),
  majorEventLabel: $("#settlement-major-event-label"),
  majorEventCountdown: $("#settlement-major-event-countdown"),
  majorEventTitle: $("#settlement-major-event-title"),
  majorEventDetail: $("#settlement-major-event-detail"),
  majorEventPreparation: $("#settlement-major-event-preparation"),
  majorEventPrepBar: $("#settlement-major-event-prep-bar"),
  stormMilestone: $("#settlement-storm-milestone"),
  stormMilestoneCopy: $("#settlement-storm-milestone-copy"),
  stormMilestoneClose: $("#settlement-storm-milestone-close"),
  mapHint: $("#settlement-map-hint"),
  placementFeedback: $("#settlement-placement-feedback")
};

const showToast = (message) => {
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), 2400);
};

const displayTime = () => {
  const progress = state.timeOfDay;
  const hour = Math.floor(5 + progress * 16);
  const minute = Math.floor((progress * 16 % 1) * 60 / 10) * 10;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const displayPeriod = () => ({
  dawn: "Dawn",
  sunrise: "Sunrise",
  daylight: "Daylight",
  afternoon: "Afternoon",
  sunset: "Sunset",
  night: "Night"
}[timePeriod(state.timeOfDay)] || "Daylight");

const atlasPosition = (column, row) => `--sprite-x:${column / 3 * 100}%;--sprite-y:${row / 2 * 100}%;`;

const villagerSpritePosition = (villager) => {
  const column = Math.max(0, Math.min(3, Number(villager.atlasIndex ?? String(villager.id || "").replace(/\D/g, "")) - 1 || 0));
  if (villager.lifeStage === "child" || Number(villager.age) < 13) return [2, 2];
  if (Number(villager.age) > 58) return [3, 2];
  const stateSprites = {
    gathering: [0, 1], hauling: [1, 1], returning: [1, 1], eating: [2, 1], resting: [3, 1], warming: [3, 1],
    building: [0, 2], securing: [1, 2], repairing: [1, 2]
  };
  return stateSprites[villager.activity] || [column, 0];
};

const villagerPortraitStyle = (villager) => `--portrait:${villager.color};${atlasPosition(...villagerSpritePosition(villager))}`;

const buildingSpritePositions = {
  campfire: [0, 0], shelter: [1, 0], storage: [2, 0], dryingRack: [3, 0],
  woodcutterArea: [0, 1], stoneSite: [1, 1], well: [2, 1], berryStand: [3, 1]
};

const buildingIconStyle = (kind, accent) => {
  const [column, row] = buildingSpritePositions[kind] || [0, 0];
  return `--structure:${accent};${atlasPosition(column, row)}`;
};

const animalSpritePositions = {
  reedbuck: [1, 0], mosshare: [0, 1], creekotter: [0, 2], brushboar: [2, 2], honeybee: [3, 2]
};

const animalMarkStyle = (animal, species) => {
  const [column, row] = animalSpritePositions[animal.species] || [0, 1];
  return `--wildlife:${species.color};${atlasPosition(column, row)}`;
};

const missingCost = (def) => Object.entries(def.cost)
  .map(([type, amount]) => ({ type, missing: Math.max(0, amount - Math.floor(state.inventory[type] || 0)) }))
  .filter((entry) => entry.missing > 0)
  .map((entry) => `${entry.missing} ${entry.type}`);

const costText = (def) => `${def.cost.wood} wood · ${def.cost.stone} stone`;

const renderInventory = () => {
  const used = Math.floor(Object.values(state.inventory).reduce((sum, value) => sum + Number(value || 0), 0));
  const room = Math.floor(storageRoom(state));
  els.storageCapacity.textContent = `${used} / ${storageCapacity(state)} capacity`;
  els.storageCapacity.title = `${room} storage space remaining`;
  els.inventory.innerHTML = Object.entries(RESOURCE_META).map(([type, meta]) => {
    const amount = Math.floor(resourceCount(state, type));
    const stored = Math.floor(state.inventory[type] || 0);
    const nearbyFoodNote = type === "food" && amount > stored ? ` ${amount - stored} in nearby food piles.` : "";
    return `
    <div class="resource-readout supply-${supplyLevel(state, type)}" style="--resource-color:${meta.color}" title="${meta.label}: ${amount} available.${type === "food" ? ` ${stored} stored.${nearbyFoodNote}` : ""} Supply is ${supplyLevel(state, type)}. ${room} storage space remains.">
      <span class="resource-symbol">${meta.icon}</span>
      <span class="resource-label">${meta.label}</span>
      <strong>${amount}</strong>
      <small class="resource-status">${supplyLevel(state, type)}</small>
    </div>`;
  }).join("");
};

const renderPopulation = () => {
  const stats = populationStats(state);
  els.population.innerHTML = `
    <div class="population-stat"><strong>${stats.total}</strong><small>Total</small></div>
    <div class="population-stat"><strong>${stats.adults}</strong><small>Adults</small></div>
    <div class="population-stat"><strong>${stats.children}</strong><small>Children</small></div>
    <div class="population-stat"><strong>${stats.availableWorkers}</strong><small>Workers</small></div>`;
};

const renderGuidance = () => {
  if (state.buildMode) {
    els.guideTitle.textContent = `Place the ${BUILDINGS[state.buildMode].name.toLowerCase()}`;
    els.guideCopy.textContent = "Move over the map for a live foundation preview. Click a clear patch, or press Esc to cancel.";
    return;
  }
  const nextObjective = objectiveState(state).find((objective) => !objective.complete);
  if (nextObjective?.kind === "resource") {
    const resourceLabel = RESOURCE_META[nextObjective.resource]?.label?.toLowerCase() || nextObjective.resource;
    els.guideTitle.textContent = `Gather ${nextObjective.amount} ${resourceLabel}`;
    if (storageRoom(state) < 4) {
      els.guideCopy.textContent = resourceLabel === "food"
        ? "Stores are nearly full. Villagers will eat and make room, or you can build another storage area."
        : "Stores are nearly full. Let the camp use supplies or build another storage area before gathering more.";
    } else {
      els.guideCopy.textContent = resourceLabel === "food"
      ? "Food keeps every villager moving. The camp will gather on its own while you watch."
      : "Wood turns the clearing into a home. Raise its priority when you want more hands on it.";
    }
    return;
  }
  if (nextObjective?.kind === "building") {
    const def = BUILDINGS[nextObjective.building];
    const canAfford = state.inventory.wood >= def.cost.wood && state.inventory.stone >= def.cost.stone;
    els.guideTitle.textContent = `Build ${def.name.toLowerCase()}`;
    els.guideCopy.textContent = canAfford
      ? "Choose it from Build something below, then place the ghost in a clear patch."
      : `The camp needs ${def.cost.wood} wood and ${def.cost.stone} stone to begin it.`;
    return;
  }
  const discovery = discoveryStats(state);
  els.guideTitle.textContent = discovery.unlocked >= discovery.villageThreshold ? "The first village is established" : "Keep watching the camp";
  els.guideCopy.textContent = discovery.unlocked >= discovery.villageThreshold
    ? "Shared work has made this clearing a home. Prepare for what the weather brings."
    : "Every meal, delivery, and workday teaches the settlement something new.";
};

const renderDiscoveries = () => {
  const stats = discoveryStats(state);
  els.discoveryCount.textContent = `${stats.unlocked} / ${stats.total} known`;
  const known = new Set(state.discoveries.unlocked);
  const ordered = [...DISCOVERIES].sort((a, b) => Number(known.has(b.id)) - Number(known.has(a.id)) || (state.discoveries.progress[b.id] / b.threshold) - (state.discoveries.progress[a.id] / a.threshold));
  els.discoveries.innerHTML = ordered.map((discovery) => {
    const discovered = known.has(discovery.id);
    const progress = discovered ? 100 : Math.round((Number(state.discoveries.progress[discovery.id]) || 0) / discovery.threshold * 100);
    return `<div class="discovery-card ${discovered ? "is-known" : ""}">
      <div class="discovery-card-top"><span class="discovery-icon">${discovery.icon}</span><span class="discovery-copy"><strong>${discovery.name}</strong><small>${discovered ? "Knowledge shared" : `Grows through ${discovery.source}`}</small></span><b class="discovery-status">${discovered ? "Known" : `${progress}%`}</b></div>
      <div class="discovery-meter"><span style="width:${progress}%"></span></div>
      <p>${discovered ? discovery.reward : discovery.description}</p>
    </div>`;
  }).join("");
};

const renderDiscoveryNotice = () => {
  const notice = state.discoveries.notice;
  const discovery = notice ? DISCOVERIES.find((candidate) => candidate.id === notice.id) : null;
  if (!discovery) {
    els.discoveryModal.classList.remove("is-visible");
    return;
  }
  els.discoveryIcon.textContent = discovery.icon;
  els.discoveryTitle.textContent = discovery.name;
  els.discoveryDescription.textContent = discovery.description;
  els.discoveryReward.textContent = discovery.reward;
  els.discoveryModal.classList.add("is-visible");
};

const eventCountdown = (status) => {
  if (status.phase === "foreshadow") return status.remaining > 60 ? `Storm in ${Math.max(1, Math.ceil(status.remaining / 82))} day` : "Storm soon";
  if (status.phase === "warning") return `Reaches camp in ${Math.ceil(status.remaining)}s`;
  if (status.phase === "storm") return `${Math.ceil(status.remaining)}s of weather`;
  if (status.phase === "recovery") return `${Math.ceil(status.remaining)}s of recovery`;
  return "Remembered by the village";
};

const renderMajorEvent = () => {
  const status = majorEventStatus(state);
  if (!status.visible) {
    els.majorEventSection.classList.add("is-hidden");
    els.majorEventBanner.classList.remove("is-visible");
    els.stormMilestone.classList.remove("is-visible");
    return;
  }
  els.majorEventSection.classList.remove("is-hidden");
  els.majorEventLabel.textContent = status.label;
  els.majorEventCountdown.textContent = eventCountdown(status);
  els.majorEventTitle.textContent = status.title;
  els.majorEventDetail.textContent = status.detail;
  els.majorEventPreparation.textContent = `${status.preparation}%`;
  els.majorEventPrepBar.style.width = `${status.preparation}%`;
  els.majorEventBanner.textContent = status.phase === "storm" ? "✦ THE GREAT STORM · HOLD FAST" : status.phase === "recovery" ? "✦ AFTER THE STORM · THE VILLAGE ENDURES" : `✦ ${status.title}`;
  els.majorEventBanner.classList.add("is-visible");
  if (state.majorEvent.milestoneShown) {
    const loss = status.foodLost ? ` ${status.foodLost} food was spoiled, but the stores held.` : " The stores held through the rain.";
    els.stormMilestoneCopy.textContent = `${status.detail}${loss}`;
    els.stormMilestone.classList.add("is-visible");
  } else {
    els.stormMilestone.classList.remove("is-visible");
  }
};

const renderPriorities = () => {
  els.priorities.innerHTML = Object.entries(PRIORITY_META).map(([key, meta]) => {
    const level = Math.max(0, Math.min(PRIORITY_LEVELS.length - 1, Number(state.priorities[key]) || 0));
    const nextLevel = PRIORITY_LEVELS[(level + 1) % PRIORITY_LEVELS.length];
    return `<button class="priority-button priority-${PRIORITY_LEVELS[level].toLowerCase()}" data-priority="${key}" type="button" title="${meta.label} priority is ${PRIORITY_LEVELS[level]}. Click to set ${nextLevel}." aria-label="${meta.label} priority: ${PRIORITY_LEVELS[level]}. Click to set ${nextLevel}."><span aria-hidden="true">${meta.icon}</span><strong>${meta.label}</strong><small>${PRIORITY_LEVELS[level]}</small></button>`;
  }).join("");
  $$('[data-priority]').forEach((button) => button.addEventListener("click", () => {
    const key = button.dataset.priority;
    state.priorities[key] = (Number(state.priorities[key]) + 1) % PRIORITY_LEVELS.length;
    saveGame(state);
    showToast(`${PRIORITY_META[key].label} priority: ${PRIORITY_LEVELS[state.priorities[key]]}.`);
    renderUi();
  }));
};

const renderObjectives = () => {
  const discovery = discoveryStats(state);
  const villageReady = discovery.unlocked >= discovery.villageThreshold;
  els.objectives.innerHTML = `${objectiveState(state).map((objective) => `
    <div class="objective-row ${objective.complete ? "is-complete" : ""}">
      <span class="objective-check">${objective.complete ? "✓" : "·"}</span>
      <span>${objective.label}</span>
      <strong>${Math.min(objective.current, objective.amount)}/${objective.amount}</strong>
    </div>`).join("")}
    <div class="objective-row ${villageReady ? "is-complete" : ""}">
      <span class="objective-check">${villageReady ? "✓" : "✦"}</span>
      <span>Share five discoveries</span>
      <strong>${Math.min(discovery.unlocked, discovery.villageThreshold)}/${discovery.villageThreshold}</strong>
    </div>`;
};

const renderSelected = () => {
  const entity = selectedEntity(state);
  if (!entity) {
    els.selected.innerHTML = `<div class="empty-selection"><span class="eyebrow">Overseer view</span><strong>Choose a villager, animal, or structure</strong><p>Watch the camp closely. Little needs and small decisions shape the village.</p></div>`;
    return;
  }
  const clearSelectionMarkup = `<button class="selected-clear" data-clear-selection type="button">Clear selection <kbd>Esc</kbd></button>`;
  const bindClearSelection = () => els.selected.querySelector("[data-clear-selection]")?.addEventListener("click", () => {
    state.selected = null;
    renderUi();
  });
  if (state.selected.type === "animal") {
    const species = ANIMAL_SPECIES[entity.species] || ANIMAL_SPECIES.mosshare;
    const kindLabel = species.kind === "danger" ? "Keep some distance" : species.kind === "useful" ? "Helpful wildlife" : "Harmless wildlife";
    els.selected.innerHTML = `
      <div class="selected-head"><div class="wildlife-mark" style="${animalMarkStyle(entity, species)}" aria-hidden="true"></div><div><span class="eyebrow">Wildlife</span><h3>${species.name}</h3><p>${kindLabel}</p></div></div>
      <p class="selected-note">${species.description}</p>
      <div class="selected-activity"><span class="activity-dot ${species.dangerous ? "activity-dot-danger" : ""}"></span><div><span class="eyebrow">Now</span><strong>${entity.activityDetail || "Wandering the wild edge"}</strong><small>Habitat: ${species.waterLoving ? "creek edge" : species.pollinator ? "wildflowers" : "outer meadow"}</small></div></div>
      <div class="need-stack">${needBar("Energy", entity.energy, "#89a96b", "◒")}${needBar("Hydration", 100 - entity.thirst, "#6caaa4", "≈")}</div>${clearSelectionMarkup}`;
    bindClearSelection();
    return;
  }
  if (state.selected.type === "villager") {
    const connections = relationshipSummary(state, entity);
    const familyLine = connections.parents.length
      ? `Child of ${connections.parents.map((parent) => parent.name).join(" and ")}`
      : connections.partner
      ? `${connections.partner.name}${connections.children.length ? ` · ${connections.children.length} child` : ""}`
      : connections.children.length ? `${connections.children.length} child` : "No household yet";
    const friendLine = connections.friends.length ? connections.friends.join(" · ") : "Still getting to know the camp";
    const carriedLine = entity.carrying
      ? `${entity.carrying.amount} ${(RESOURCE_META[entity.carrying.type]?.label || entity.carrying.type).toLowerCase()}`
      : "Hands free";
    els.selected.innerHTML = `
      <div class="selected-head"><div class="portrait" style="${villagerPortraitStyle(entity)}" aria-hidden="true"></div><div><span class="eyebrow">Villager</span><h3>${entity.name}</h3><p>${entity.age} years · ${entity.role}</p></div></div>
      <p class="selected-note">“${entity.note}”</p>
      <div class="relationship-lines"><div><span class="eyebrow">Household</span><strong>${familyLine}</strong></div><div><span class="eyebrow">Friends</span><strong>${friendLine}</strong></div><div><span class="eyebrow">Carrying</span><strong>${carriedLine}</strong></div></div>
      <div class="selected-activity"><span class="activity-dot"></span><div><span class="eyebrow">Now</span><strong>${selectedActivityText(entity)}</strong><small>${entity.lastActivity}</small></div></div>
      <div class="thought-line"><span>“</span><p>${entity.thought || "Watching the camp."}</p></div>
      <div class="need-stack">${needBar("Hunger", entity.hunger, "#d59556", "🍂")}${needBar("Energy", entity.energy, "#89a96b", "◒")}${needBar("Health", entity.health, "#c77165", "✚")}</div>${clearSelectionMarkup}`;
    bindClearSelection();
  } else {
    const def = BUILDINGS[entity.kind];
    const action = entity.kind === "campfire"
      ? ""
      : entity.complete
        ? `<button class="structure-action structure-action-danger" data-demolish-building="${entity.id}" type="button">Demolish · salvage half</button>`
        : `<button class="structure-action" data-cancel-building="${entity.id}" type="button">Cancel foundation · refund supplies</button>`;
    const missingMaterials = Object.entries(def.cost)
      .filter(([type, amount]) => Number(entity.materials?.[type] || 0) < amount)
      .map(([type, amount]) => `${amount - Math.floor(entity.materials?.[type] || 0)} ${type}`);
    const constructionStatus = entity.complete
      ? ""
      : `<p class="construction-status">${missingMaterials.length ? `Waiting for ${missingMaterials.join(" and ")} · villagers will fetch it when available.` : entity.progress > 0 ? "Workers are building this stage." : "Materials are ready · a builder is on the way."}</p>`;
    const assignedWorkers = state.villagers.filter((villager) => villager.task?.targetId === entity.id).length;
    const constructionPriority = PRIORITY_LEVELS[Math.max(0, Math.min(PRIORITY_LEVELS.length - 1, Number(state.priorities.construction) || 0))];
    els.selected.innerHTML = `
      <div class="selected-head"><div class="structure-mark" style="${buildingIconStyle(entity.kind, def.accent)}" aria-hidden="true"></div><div><span class="eyebrow">Structure</span><h3>${def.name}</h3><p>${entity.complete ? "Completed" : `${entity.stage} · ${Math.round(entity.progress * 100)}%`}</p></div></div>
      <p class="selected-note">${def.description}</p>
      <div class="structure-purpose"><span class="eyebrow">Purpose</span><p>${def.purpose || def.description}</p></div>
      <div class="structure-meter"><div class="meter-track"><span style="width:${Math.round(entity.progress * 100)}%"></span></div><div><small>Build progress</small><strong>${Math.round(entity.progress * 100)}%</strong></div></div>
      <div class="material-lines"><span>Wood <b>${entity.materials.wood}/${def.cost.wood}</b></span><span>Stone <b>${entity.materials.stone}/${def.cost.stone}</b></span></div>
      <div class="structure-facts"><span><small>Assigned hands</small><b>${assignedWorkers}</b></span><span><small>Priority</small><b>${constructionPriority}</b></span></div>
      ${constructionStatus}
      ${action}${clearSelectionMarkup}`;
    $$("[data-cancel-building]").forEach((button) => button.addEventListener("click", () => {
      if (!window.confirm("Cancel this foundation and return its supplies to camp?")) return;
      const result = cancelBuilding(state, button.dataset.cancelBuilding);
      showToast(result.reason);
      renderUi();
    }));
    $$("[data-demolish-building]").forEach((button) => button.addEventListener("click", () => {
      if (!window.confirm("Demolish this structure and salvage half its materials?")) return;
      const result = demolishBuilding(state, button.dataset.demolishBuilding);
      showToast(result.reason);
      renderUi();
    }));
    bindClearSelection();
  }
};

const needBar = (label, value, color, icon) => `<div class="need-row"><span>${icon} ${label}</span><div class="need-track"><i style="width:${Math.round(value)}%;background:${color}"></i></div><b>${Math.round(value)}%</b></div>`;

const renderVillagers = () => {
  els.villagers.innerHTML = state.villagers.map((villager) => `
    <button class="villager-row ${state.selected?.id === villager.id ? "is-selected" : ""}" data-villager-id="${villager.id}" type="button">
      <span class="mini-portrait" style="${villagerPortraitStyle(villager)}" aria-hidden="true"></span><span class="villager-row-copy"><strong>${villager.name}</strong><small>${selectedActivityText(villager)}</small></span><i class="villager-state ${villager.hunger < 30 ? "is-warning" : ""}"></i>
    </button>`).join("");
  $$("[data-villager-id]").forEach((button) => button.addEventListener("click", () => {
    state.selected = { type: "villager", id: button.dataset.villagerId };
    const villager = selectedEntity(state);
    if (villager) { state.camera = { ...state.camera, x: villager.x, y: villager.y }; clampCamera(); }
    renderUi();
  }));
};

const renderEvents = () => {
  els.eventLog.innerHTML = state.eventLog.slice(0, 5).map((event) => `<div class="event-item"><span></span><p>${event.text}</p></div>`).join("");
};

const renderBuildMenu = () => {
  const available = Object.keys(BUILDINGS);
  els.build.innerHTML = available.map((kind) => {
    const def = BUILDINGS[kind];
    const active = state.buildMode === kind;
    const alreadyBuilt = kind === "campfire" && state.buildings.some((building) => building.kind === kind);
    const canAfford = state.inventory.wood >= def.cost.wood && state.inventory.stone >= def.cost.stone;
    const missing = missingCost(def);
    const unavailable = alreadyBuilt ? "Already standing" : missing.length && !active ? `Need ${missing.join(" and ")}` : `Build ${def.name.toLowerCase()}`;
    const ariaState = alreadyBuilt ? "Already standing" : missing.length && !active ? `Unavailable. ${unavailable}.` : unavailable;
    return `<button class="build-card ${active ? "is-active" : ""} ${canAfford || alreadyBuilt ? "" : "is-muted"}" data-build-kind="${kind}" type="button" aria-disabled="false" title="${def.description} Cost: ${costText(def)}. ${ariaState}"><span class="build-card-icon" style="${buildingIconStyle(kind, def.accent)}" aria-hidden="true"></span><span class="build-card-copy"><strong>${def.name}</strong><small>${costText(def)}</small><small class="build-card-status">${unavailable}</small></span><span class="build-card-arrow">${alreadyBuilt ? "✓" : active ? "Place" : "↗"}</span></button>`;
  }).join("");
  $$("[data-build-kind]").forEach((button) => button.addEventListener("click", () => {
    const kind = button.dataset.buildKind;
    if (kind === "campfire" && state.buildings.some((building) => building.kind === kind)) { showToast("The campfire is already standing."); return; }
    if (state.buildMode === kind) {
      state.buildMode = null;
      state.buildRotation = 0;
      showToast("Placement cancelled.");
    } else if (missingCost(BUILDINGS[kind]).length) {
      showToast(`Need ${missingCost(BUILDINGS[kind]).join(" and ")} to build it.`);
    } else {
      state.buildMode = kind;
      state.buildRotation = 0;
      showToast(`Choose a clearing for the ${BUILDINGS[kind].name.toLowerCase()}.`);
    }
    renderUi();
  }));
};

const updatePlacement = (cell = renderer.hoverCell) => {
  if (!state.buildMode || !cell || cell.x < 0 || cell.y < 0 || cell.x >= WORLD.cols || cell.y >= WORLD.rows) {
    renderer.setPlacement(null);
    els.placementFeedback.textContent = "";
    els.placementFeedback.className = "";
    return;
  }
  const check = placementCheck(state, state.buildMode, cell.x, cell.y, state.buildRotation);
  renderer.setPlacement({ kind: state.buildMode, cell, footprint: check.footprint, ok: check.ok, reason: check.reason, rotation: state.buildRotation });
  els.placementFeedback.textContent = check.ok ? "✓ " + check.reason + " · R rotate" : "× " + check.reason;
  els.placementFeedback.className = check.ok ? "is-valid" : "is-invalid";
};

const renderUi = () => {
  els.time.textContent = displayTime();
  els.day.textContent = `Day ${state.day}`;
  els.period.textContent = displayPeriod();
  els.weather.textContent = state.weather?.label || "Clear skies";
  els.speed.textContent = `${state.speed}×`;
  els.pause.textContent = state.paused ? "Resume" : "Pause";
  els.pause.classList.toggle("is-paused", state.paused);
  els.pause.title = state.paused ? "Resume the simulation" : "Pause the simulation";
  els.pause.setAttribute("aria-label", els.pause.title);
  els.speed.classList.toggle("is-paused", state.paused);
  els.speed.title = `${state.paused ? "Simulation is paused at" : "Simulation speed is"} ${state.speed}×. Click to cycle, or press 1, 2, or 3.`;
  els.speed.setAttribute("aria-label", els.speed.title);
  const placementDef = state.buildMode ? BUILDINGS[state.buildMode] : null;
  els.mapHint.textContent = placementDef
    ? `Placing ${placementDef.name} · click to place · ${placementDef.rotatable ? "R rotate · " : ""}Esc cancel`
    : "Click to inspect · drag to look around · wheel to zoom";
  renderInventory();
  renderPopulation();
  renderGuidance();
  renderDiscoveries();
  renderPriorities();
  renderObjectives();
  renderSelected();
  renderVillagers();
  renderEvents();
  renderBuildMenu();
  renderDiscoveryNotice();
  renderMajorEvent();
  updatePlacement();
};

const save = () => {
  if (saveGame(state)) {
    els.save.textContent = "Saved";
    els.save.title = "Settlement saved";
    els.saveStatus.textContent = "Saved just now";
    els.saveStatus.title = "Your settlement has a safe recovery copy.";
    showToast("Settlement saved.");
    setTimeout(() => { els.save.textContent = "Save"; }, 1300);
  } else {
    els.saveStatus.textContent = "Save failed — previous save kept";
    els.saveStatus.title = "The latest save failed; your previous valid save was preserved.";
    showToast("Could not save. Your previous save is safe.");
  }
};

const autosave = () => {
  if (!saveGame(state)) {
    els.saveStatus.textContent = "Autosave failed — previous save kept";
    els.saveStatus.title = "Autosave failed; your previous valid save was preserved.";
    return;
  }
  const stamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  els.saveStatus.textContent = `Autosaved ${stamp}`;
  els.saveStatus.title = "Autosave completed with a recovery copy.";
};

const persistCriticalState = () => {
  const signature = criticalStateSignature(state);
  if (!signature || signature === lastCriticalSaveSignature) return;
  lastCriticalSaveSignature = signature;
  if (saveGame(state)) {
    els.saveStatus.textContent = "Checkpoint saved";
    els.saveStatus.title = "A critical discovery or event checkpoint was saved safely.";
  }
};

const setSpeed = (speed) => {
  state.speed = speed;
  renderUi();
};

const clampCamera = () => {
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  const halfWidth = width / (2 * state.camera.zoom);
  const halfHeight = height / (2 * state.camera.zoom);
  const clampAxis = (value, half, extent) => extent <= half * 2 ? extent / 2 : Math.max(half, Math.min(extent - half, value));
  state.camera.x = clampAxis(state.camera.x, halfWidth, WORLD.width);
  state.camera.y = clampAxis(state.camera.y, halfHeight, WORLD.height);
};

window.addEventListener("pointerdown", primeStormAudio);

const canvasPoint = (event) => {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
};

canvas.addEventListener("pointerdown", (event) => {
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture(event.pointerId);
  const point = canvasPoint(event);
  drag = { pointerId: event.pointerId, x: point.x, y: point.y, moved: false, cameraX: state.camera.x, cameraY: state.camera.y };
});

canvas.addEventListener("pointermove", (event) => {
  const point = canvasPoint(event);
  const world = renderer.worldPoint(state, point.x, point.y);
  const cell = { x: Math.floor(world.x / WORLD.cell), y: Math.floor(world.y / WORLD.cell) };
  if (cell.x >= 0 && cell.y >= 0 && cell.x < WORLD.cols && cell.y < WORLD.rows) {
    renderer.setHover(cell);
    updatePlacement(cell);
  } else {
    renderer.clearHover();
    updatePlacement(null);
  }
  if (drag?.pointerId === event.pointerId) {
    const dx = point.x - drag.x;
    const dy = point.y - drag.y;
    if (Math.hypot(dx, dy) > 4) drag.moved = true;
    state.camera.x = drag.cameraX - dx / state.camera.zoom;
    state.camera.y = drag.cameraY - dy / state.camera.zoom;
    clampCamera();
  }
});

canvas.addEventListener("pointerup", (event) => {
  if (!drag || drag.pointerId !== event.pointerId) return;
  const point = canvasPoint(event);
  if (!drag.moved) {
    const world = renderer.worldPoint(state, point.x, point.y);
    if (state.buildMode) {
      const cell = { x: Math.floor(world.x / WORLD.cell), y: Math.floor(world.y / WORLD.cell) };
      const result = placeBuilding(state, state.buildMode, cell.x, cell.y, state.buildRotation);
      showToast(result.reason);
      renderUi();
    } else {
      selectAt(state, world.x, world.y);
      renderUi();
    }
  }
  drag = null;
});

canvas.addEventListener("pointercancel", () => { drag = null; });
canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  const point = canvasPoint(event);
  const before = renderer.worldPoint(state, point.x, point.y);
  const nextZoom = Math.max(0.62, Math.min(1.46, state.camera.zoom * (event.deltaY < 0 ? 1.08 : 0.93)));
  state.camera.zoom = nextZoom;
  const after = renderer.worldPoint(state, point.x, point.y);
  state.camera.x += before.x - after.x;
  state.camera.y += before.y - after.y;
  clampCamera();
}, { passive: false });

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const editingField = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
  if (!editingField && key === "escape") {
    if (els.stormMilestone.classList.contains("is-visible")) { els.stormMilestoneClose.click(); return; }
    if (els.milestone.classList.contains("is-visible")) { els.milestoneClose.click(); return; }
    if (els.discoveryModal.classList.contains("is-visible")) { els.discoveryClose.click(); return; }
    if (state.buildMode) { state.buildMode = null; state.buildRotation = 0; showToast("Placement cancelled."); renderUi(); return; }
    if (document.activeElement?.tagName !== "SUMMARY" && state.selected) { state.selected = null; renderUi(); return; }
  }
  if (!editingField && key === "r" && state.buildMode) { state.buildRotation = state.buildRotation === 90 ? 0 : 90; updatePlacement(); renderUi(); return; }
  if (["INPUT", "TEXTAREA", "BUTTON"].includes(document.activeElement?.tagName)) return;
  if (key === " ") { event.preventDefault(); state.paused = !state.paused; renderUi(); return; }
  if (key === "1" || key === "2" || key === "3") { setSpeed(SPEEDS[Number(key) - 1]); return; }
  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
    event.preventDefault();
    keyPan = { x: key === "a" || key === "arrowleft" ? -1 : key === "d" || key === "arrowright" ? 1 : 0, y: key === "w" || key === "arrowup" ? -1 : key === "s" || key === "arrowdown" ? 1 : 0 };
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) keyPan = { x: 0, y: 0 };
});

els.pause.addEventListener("click", () => { state.paused = !state.paused; renderUi(); });
els.speed.addEventListener("click", () => {
  const index = SPEEDS.indexOf(state.speed);
  setSpeed(SPEEDS[(index + 1) % SPEEDS.length] || SPEEDS[0]);
});
els.save.addEventListener("click", save);
els.reset.addEventListener("click", () => {
  if (!window.confirm("Start a new clearing? This will replace the saved settlement.")) return;
  state = newGame();
  els.milestone.classList.remove("is-visible");
  els.stormMilestone.classList.remove("is-visible");
  save();
  renderUi();
  showToast("A new clearing waits beyond the ridge.");
});
els.milestoneClose.addEventListener("click", () => {
  state.milestoneShown = false;
  state.milestoneDismissed = true;
  state.paused = false;
  els.milestone.classList.remove("is-visible");
  saveGame(state);
});
els.discoveryClose.addEventListener("click", () => {
  const queue = state.discoveries.queue || [];
  if (queue[0] === state.discoveries.notice?.id) queue.shift();
  state.discoveries.notice = queue.length ? { id: queue[0] } : null;
  if (!state.discoveries.notice) state.paused = false;
  saveGame(state);
  renderUi();
});
els.stormMilestoneClose.addEventListener("click", () => {
  state.majorEvent.milestoneShown = false;
  state.majorEvent.milestoneDismissed = true;
  state.paused = false;
  els.stormMilestone.classList.remove("is-visible");
  saveGame(state);
  renderUi();
});

const frame = (now) => {
  const realDt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  if (!state.paused) {
    state.camera.x += keyPan.x * 260 * realDt;
    state.camera.y += keyPan.y * 260 * realDt;
    clampCamera();
    tick(state, realDt);
    uiTimer += realDt;
    if (uiTimer > 0.35) { uiTimer = 0; renderUi(); }
    saveTimer += realDt;
    if (saveTimer > 8) { saveTimer = 0; autosave(); }
  }
  updateStormAudio();
  persistCriticalState();
  renderer.paint(state);
  if (state.milestoneShown && !els.milestone.classList.contains("is-visible")) els.milestone.classList.add("is-visible");
  if (state.majorEvent?.milestoneShown && !els.stormMilestone.classList.contains("is-visible")) renderUi();
  requestAnimationFrame(frame);
};

renderUi();
if (["loaded", "migrated", "recovered"].includes(initialSaveStatus.kind)) {
  els.saveStatus.textContent = initialSaveStatus.kind === "recovered" ? "Recovered safe save" : "Save loaded";
  els.saveStatus.title = initialSaveStatus.message;
}
if (initialSaveStatus.kind === "recovered" || initialSaveStatus.kind === "migrated" || initialSaveStatus.kind === "invalid") showToast(initialSaveStatus.message);
requestAnimationFrame(frame);
