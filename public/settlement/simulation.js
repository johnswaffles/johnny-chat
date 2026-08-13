import {
  BASE_STORAGE_CAPACITY,
  ANIMAL_SPECIES,
  BUILDINGS,
  DISCOVERIES,
  OBJECTIVES,
  PRIORITY_META,
  PRIORITY_LEVELS,
  RESOURCE_META,
  STORAGE_KEY,
  SPEEDS,
  VILLAGER_CHILD_NAMES,
  VILLAGER_ARCHETYPES,
  WORLD,
  clamp,
  cloneCost,
  footprintFor,
  formatActivity
} from "./data.js";

const DIRECTIONS = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: -1 }
];

const hash = (x, y, seed = 1) => {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return value - Math.floor(value);
};

const seededRandom = (seed) => {
  let value = Math.abs(Number(seed) || 1) % 2147483647;
  if (value === 0) value = 1;
  return () => {
    value = value * 16807 % 2147483647;
    return (value - 1) / 2147483646;
  };
};

const chance = (value) => {
  const normalized = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
  return normalized - Math.floor(normalized);
};

const DISCOVERY_MAP = Object.fromEntries(DISCOVERIES.map((discovery) => [discovery.id, discovery]));

export const SAVE_VERSION = 2;
const SAVE_MAGIC = "hearthwild-save";
const SAVE_BACKUP_KEY = `${STORAGE_KEY}-backup`;
const SAVE_RECOVERY_KEY = `${STORAGE_KEY}-recovery`;
const MAX_SAVE_VILLAGERS = 256;
const MAX_SAVE_ANIMALS = 512;
const MAX_SAVE_BUILDINGS = 256;
const MAX_SAVE_RESOURCES = 512;
const SAVE_RESOURCE_TYPES = new Set(Object.keys(RESOURCE_META));
const SAVE_TERRAIN_TYPES = new Set(["water", "clearing", "meadow"]);
const SAVE_WEATHER_TYPES = new Set(["clear", "cloudy", "rain"]);
let lastSaveStatus = { kind: "none", message: "No saved settlement found." };
const buildingOccupancyCache = new WeakMap();
const resourceIndexCache = new WeakMap();
const pathCacheByState = new WeakMap();
const resourcePathRevisionByState = new WeakMap();
const tickCadenceByState = new WeakMap();
const resourceTypeCache = new WeakMap();

const isObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const safeNumber = (value, fallback = 0, min = -Infinity, max = Infinity) => {
  const number = Number(value);
  return Number.isFinite(number) ? clamp(number, min, max) : fallback;
};
const safeInteger = (value, fallback = 0, min = -Infinity, max = Infinity) => Math.round(safeNumber(value, fallback, min, max));
const safeText = (value, fallback = "", maxLength = 240) => typeof value === "string" && value.length <= maxLength ? value : fallback;
const uniqueId = (value, prefix, used) => {
  const candidate = safeText(value, "", 80);
  if (candidate && !used.has(candidate)) { used.add(candidate); return candidate; }
  let replacement = makeId(prefix);
  while (used.has(replacement)) replacement = makeId(prefix);
  used.add(replacement);
  return replacement;
};
const saveChecksum = (text) => {
  let hashValue = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hashValue ^= text.charCodeAt(index);
    hashValue = Math.imul(hashValue, 16777619);
  }
  return (hashValue >>> 0).toString(16).padStart(8, "0");
};
const saveJson = (value) => JSON.stringify(value);

const normalizeCarrying = (carrying) => {
  if (!isObject(carrying) || !SAVE_RESOURCE_TYPES.has(carrying.type)) return null;
  const purpose = ["construction", "ground-pile", "resource"].includes(carrying.purpose) ? carrying.purpose : "resource";
  return {
    type: carrying.type,
    amount: safeInteger(carrying.amount, 1, 1, 100),
    purpose,
    targetId: safeText(carrying.targetId, "", 80)
  };
};

const invalidatePathCache = (state) => pathCacheByState.delete(state);
const invalidateResourcePathCache = (state) => resourcePathRevisionByState.set(state, (resourcePathRevisionByState.get(state) || 0) + 1);
const cachePath = (cache, key, path, revision) => {
  if (!cache) return;
  if (cache.size >= 6000) {
    const oldest = cache.keys();
    for (let index = 0; index < 1000; index += 1) cache.delete(oldest.next().value);
  }
  cache.set(key, { path, revision });
};
const invalidateBuildingCaches = (state) => {
  buildingOccupancyCache.delete(state);
  invalidatePathCache(state);
};

const buildingOccupancy = (state) => {
  let occupancy = buildingOccupancyCache.get(state);
  if (occupancy) return occupancy;
  occupancy = new Map();
  state.buildings.forEach((building) => {
    const footprint = building.footprint || footprintFor(building.kind, building.rotation || 0);
    for (let y = 0; y < footprint.h; y += 1) {
      for (let x = 0; x < footprint.w; x += 1) {
        const key = cellKey(building.x + x, building.y + y);
        if (!occupancy.has(key)) occupancy.set(key, building);
      }
    }
  });
  buildingOccupancyCache.set(state, occupancy);
  return occupancy;
};

const resourceIndex = (state) => {
  const resources = state.map.resources;
  let index = resourceIndexCache.get(state);
  if (!index || index.count !== resources.length) {
    const byId = new Map(resources.map((resource) => [resource.id, resource]));
    index = { count: resources.length, byId };
    resourceIndexCache.set(state, index);
  }
  return index.byId;
};

const buildSpatialIndex = (entities) => {
  const index = new Map();
  entities.forEach((entity) => {
    const key = cellKey(Math.floor(entity.x / WORLD.cell), Math.floor(entity.y / WORLD.cell));
    const bucket = index.get(key);
    if (bucket) bucket.push(entity);
    else index.set(key, [entity]);
  });
  return index;
};

const nearbySpatialEntities = (index, entity, radius) => {
  const centerX = Math.floor(entity.x / WORLD.cell);
  const centerY = Math.floor(entity.y / WORLD.cell);
  const reach = Math.ceil(radius / WORLD.cell) + 1;
  const nearby = [];
  for (let y = centerY - reach; y <= centerY + reach; y += 1) {
    for (let x = centerX - reach; x <= centerX + reach; x += 1) {
      const bucket = index.get(cellKey(x, y));
      if (bucket) nearby.push(...bucket);
    }
  }
  return nearby;
};

const tickCadence = (state) => {
  let cadence = tickCadenceByState.get(state);
  if (!cadence) {
    cadence = { relationships: 0, growth: 0 };
    tickCadenceByState.set(state, cadence);
  }
  return cadence;
};

const hasDiscovery = (state, id) => Boolean(state.discoveries?.unlocked?.includes(id));

const makeMajorEvent = () => ({
  id: "first-storm",
  phase: "dormant",
  forecastAt: 0,
  warningAt: 0,
  eventAt: 0,
  endsAt: 0,
  recoveryEndsAt: 0,
  preparationScore: 0,
  threatenedBuildingIds: [],
  securedBuildingIds: [],
  damagedBuildingIds: [],
  foodLost: 0,
  outcome: "",
  milestoneShown: false,
  milestoneDismissed: false
});

const makeSettlementGrowth = () => ({
  traffic: 0,
  cleared: 0,
  hearth: 0,
  tools: 0,
  stockpiles: { wood: 0, stone: 0, food: 0 },
  work: { wood: 0, stone: 0, food: 0, construction: 0 }
});

const lerp = (a, b, amount) => a + (b - a) * amount;

export const timePeriod = (timeOfDay) => {
  const cycle = ((Number(timeOfDay) || 0) % 1 + 1) % 1;
  if (cycle < 0.10) return "dawn";
  if (cycle < 0.18) return "sunrise";
  if (cycle < 0.48) return "daylight";
  if (cycle < 0.68) return "afternoon";
  if (cycle < 0.80) return "sunset";
  return "night";
};

const smoothstep = (value) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

const phaseProgress = (timeOfDay, start, end) => smoothstep((timeOfDay - start) / (end - start));

export const lightingForState = (timeOfDay) => {
  const cycle = ((Number(timeOfDay) || 0) % 1 + 1) % 1;
  const phase = timePeriod(cycle);
  let daylight = 0;
  let darkness = 0.72;
  let warmth = 0.2;
  if (phase === "dawn") {
    const t = phaseProgress(cycle, 0, 0.10);
    daylight = lerp(0.12, 0.46, t);
    darkness = lerp(0.72, 0.34, t);
    warmth = lerp(0.22, 0.66, t);
  } else if (phase === "sunrise") {
    const t = phaseProgress(cycle, 0.10, 0.18);
    daylight = lerp(0.46, 0.9, t);
    darkness = lerp(0.34, 0.07, t);
    warmth = lerp(0.66, 0.92, t);
  } else if (phase === "daylight") {
    const t = phaseProgress(cycle, 0.18, 0.48);
    daylight = lerp(0.9, 1, t);
    darkness = lerp(0.07, 0.02, t);
    warmth = lerp(0.92, 1, t);
  } else if (phase === "afternoon") {
    const t = phaseProgress(cycle, 0.48, 0.68);
    daylight = lerp(1, 0.86, t);
    darkness = lerp(0.02, 0.06, t);
    warmth = lerp(1, 0.86, t);
  } else if (phase === "sunset") {
    const t = phaseProgress(cycle, 0.68, 0.80);
    daylight = lerp(0.86, 0.38, t);
    darkness = lerp(0.06, 0.38, t);
    warmth = lerp(0.86, 0.5, t);
  } else {
    const t = phaseProgress(cycle, 0.80, 1);
    daylight = lerp(0.38, 0.12, t);
    darkness = lerp(0.38, 0.72, t);
    warmth = lerp(0.5, 0.2, t);
  }
  const sunriseGlow = cycle >= 0.035 && cycle <= 0.205 ? 1 - Math.min(1, Math.abs(cycle - 0.12) / 0.085) : 0;
  const sunsetGlow = cycle >= 0.625 && cycle <= 0.855 ? 1 - Math.min(1, Math.abs(cycle - 0.74) / 0.115) : 0;
  return {
    phase,
    daylight,
    darkness,
    warmth,
    sunHeight: Math.max(0, Math.sin(((cycle - 0.08) / 0.78) * Math.PI)),
    sunriseGlow: clamp(sunriseGlow, 0, 1),
    sunsetGlow: clamp(sunsetGlow, 0, 1),
    goldenStrength: clamp(Math.max(sunriseGlow, sunsetGlow), 0, 1),
    moonStrength: clamp(darkness * 0.92, 0, 1),
    shadowLength: 5 + (1 - Math.min(1, Math.max(0, daylight))) * 11
  };
};

export const weatherForState = (state) => {
  const signal = chance(Number(state.seed || 1) * 0.01 + state.day * 1.71);
  if (signal > 0.87) return { type: "rain", label: "Rain passing", intensity: 0.82 };
  if (signal > 0.66) return { type: "cloudy", label: "Cloud cover", intensity: 0.34 };
  return { type: "clear", label: "Clear skies", intensity: 0 };
};

const weatherThought = (state, villager) => {
  if (state.majorEvent?.phase === "storm") return villager.lifeStage === "child" ? "I want to stay close to home." : "Keep the roof tied down.";
  if (["foreshadow", "warning"].includes(state.majorEvent?.phase)) return "The air feels heavy over the ridge.";
  if (state.weather?.type === "rain") return villager.restBias > 1 ? "The rain makes the fire look good." : "A little rain won't stop me.";
  if (timePeriod(state.timeOfDay) === "dawn") return "The mist is lifting.";
  if (timePeriod(state.timeOfDay) === "sunrise") return "The clearing is waking up.";
  if (timePeriod(state.timeOfDay) === "sunset") return "The light is going soft.";
  if (timePeriod(state.timeOfDay) === "night") return "The stars are out.";
  return "";
};

export const makeId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

export const cellKey = (x, y) => `${x},${y}`;

export const cellCenter = (x, y) => ({
  x: (x + 0.5) * WORLD.cell,
  y: (y + 0.5) * WORLD.cell
});

export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const inBounds = (x, y) => x >= 0 && y >= 0 && x < WORLD.cols && y < WORLD.rows;

const worldToCell = (x, y) => ({
  x: clamp(Math.floor(x / WORLD.cell), 0, WORLD.cols - 1),
  y: clamp(Math.floor(y / WORLD.cell), 0, WORLD.rows - 1)
});

const makeMap = (seed) => {
  const random = seededRandom(seed);
  const grid = Array.from({ length: WORLD.rows }, (_, y) => Array.from({ length: WORLD.cols }, (_, x) => {
    const centralDistance = Math.hypot(x - 16, (y - 12) * 1.05);
    const pond = ((x - 4.8) ** 2) / 17 + ((y - 8.4) ** 2) / 31 < 1;
    const creek = x > 22 && y > 3 && y < 19 && Math.abs(y - (11 + Math.sin(x * 0.85) * 2.2)) < 0.7;
    const isWater = (pond || creek) && centralDistance > 5.3;
    return {
      terrain: isWater ? "water" : centralDistance < 4.5 ? "clearing" : "meadow",
      variation: random()
    };
  }));

  const resources = [];
  const occupied = new Set();
  const addResource = (type, x, y, amount) => {
    if (!inBounds(x, y) || grid[y][x].terrain === "water" || Math.hypot(x - 16, y - 12) < 4.2) return false;
    const key = cellKey(x, y);
    if (occupied.has(key)) return false;
    occupied.add(key);
    const id = makeId(type);
    resources.push({
      id,
      type,
      x,
      y,
      amount,
      max: amount,
      phase: hash(x, y, seed) * Math.PI * 2,
      regrowth: type === "food" ? 0.16 : 0,
      depletedTime: 0
    });
    grid[y][x].resourceId = id;
    return true;
  };

  const treeSpots = [
    [11, 4], [15, 4], [20, 4], [26, 5], [30, 7], [10, 8], [7, 13], [12, 19],
    [17, 21], [23, 21], [29, 20], [31, 15], [25, 12], [5, 18], [21, 8], [28, 11]
  ];
  const rockSpots = [[13, 6], [19, 6], [24, 8], [9, 11], [22, 15], [27, 17], [15, 18], [4, 15], [30, 18]];
  const berrySpots = [[9, 5], [12, 8], [20, 10], [26, 10], [8, 16], [14, 16], [19, 18], [25, 19], [29, 13], [6, 11]];
  treeSpots.forEach(([x, y]) => addResource("wood", x, y, 12 + Math.floor(hash(x, y, seed + 1) * 7)));
  rockSpots.forEach(([x, y]) => addResource("stone", x, y, 8 + Math.floor(hash(x, y, seed + 2) * 6)));
  berrySpots.forEach(([x, y]) => addResource("food", x, y, 12 + Math.floor(hash(x, y, seed + 3) * 8)));

  for (let i = 0; i < 14; i += 1) {
    const x = 3 + Math.floor(random() * (WORLD.cols - 6));
    const y = 2 + Math.floor(random() * (WORLD.rows - 4));
    if (random() > 0.5) addResource("wood", x, y, 11 + Math.floor(random() * 8));
    else addResource("food", x, y, 12 + Math.floor(random() * 8));
  }

  return { seed, grid, resources };
};

const adjacentWater = (map, x, y, radius = 1) => {
  for (let yy = y - radius; yy <= y + radius; yy += 1) {
    for (let xx = x - radius; xx <= x + radius; xx += 1) {
      if (map.grid[yy]?.[xx]?.terrain === "water") return true;
    }
  }
  return false;
};

const resourcesByType = (map, type) => {
  let cache = resourceTypeCache.get(map);
  if (!cache || cache.count !== map.resources.length) {
    cache = { count: map.resources.length, types: {} };
    Object.keys(RESOURCE_META).forEach((resourceType) => {
      cache.types[resourceType] = map.resources.filter((resource) => resource.type === resourceType);
    });
    resourceTypeCache.set(map, cache);
  }
  return cache.types[type] || [];
};

const nearbyResource = (map, x, y, type, radius = 3) => resourcesByType(map, type)
  .some((resource) => resource.amount > 0 && Math.hypot(resource.x - x, resource.y - y) <= radius);

const animalHabitatCell = (map, species, x, y) => {
  const cell = map.grid[y]?.[x];
  if (!cell || cell.terrain === "water" || cell.resourceId) return false;
  if (!species.habitat.includes(cell.terrain)) return false;
  if (species.waterLoving && !adjacentWater(map, x, y, 2)) return false;
  if (species.pollinator && !nearbyResource(map, x, y, "food", 4)) return false;
  return true;
};

const makeAnimal = (speciesId, cell, random, index) => {
  const species = ANIMAL_SPECIES[speciesId];
  const point = cellCenter(cell.x, cell.y);
  return {
    id: makeId("animal"),
    species: speciesId,
    x: point.x + (random() - 0.5) * 18,
    y: point.y + (random() - 0.5) * 18,
    homeCell: { x: cell.x, y: cell.y },
    phase: random() * Math.PI * 2,
    routineOffset: random() * 9 + index * 0.8,
    task: null,
    path: [],
    pathIndex: 0,
    activity: "wandering",
    activityDetail: "Wandering the wild edge",
    lastActivity: "Wandering the wild edge",
    energy: 58 + random() * 32,
    thirst: 18 + random() * 35,
    health: 100,
    decisionCooldown: 0.6 + random() * 3,
    actionTimer: 0,
    stuckTime: 0,
    pathReplanCooldown: 0,
    threatCooldown: 0,
    threatCheckCooldown: 0.2,
    lastThreatAt: -99,
    facing: random() > 0.5 ? 1 : -1
  };
};

const createAnimals = (map, seed) => {
  const random = seededRandom(Number(seed || 1) + 901);
  const plan = [
    ["reedbuck", 3],
    ["mosshare", 3],
    ["creekotter", 2],
    ["honeybee", 3],
    ["brushboar", 1]
  ];
  const occupied = new Set();
  const animals = [];
  plan.forEach(([speciesId, count]) => {
    const species = ANIMAL_SPECIES[speciesId];
    for (let index = 0; index < count; index += 1) {
      const candidates = [];
      for (let y = 1; y < WORLD.rows - 1; y += 1) {
        for (let x = 1; x < WORLD.cols - 1; x += 1) {
          const edgeDistance = Math.hypot(x - 16, (y - 12) * 1.05);
          if (edgeDistance < 5 || occupied.has(cellKey(x, y)) || !animalHabitatCell(map, species, x, y)) continue;
          const waterBias = species.waterLoving && adjacentWater(map, x, y, 1) ? 8 : 0;
          const pollinatorBias = species.pollinator && nearbyResource(map, x, y, "food", 3) ? 7 : 0;
          candidates.push({ x, y, score: edgeDistance + waterBias + pollinatorBias + random() * 6 });
        }
      }
      candidates.sort((a, b) => b.score - a.score);
      const cell = candidates[Math.floor(random() * Math.min(8, candidates.length))] || { x: 4 + Math.floor(random() * 26), y: 3 + Math.floor(random() * 18) };
      occupied.add(cellKey(cell.x, cell.y));
      animals.push(makeAnimal(speciesId, cell, random, animals.length));
    }
  });
  return animals;
};

const makeBuilding = (kind, x, y, complete = false, rotation = 0) => {
  const def = BUILDINGS[kind];
  const normalizedRotation = def.rotatable && Number(rotation) % 180 !== 0 ? 90 : 0;
  return {
    id: makeId(kind),
    kind,
    name: def.name,
    x,
    y,
    rotation: normalizedRotation,
    footprint: footprintFor(kind, normalizedRotation),
    materials: complete ? cloneCost(def.cost) : { wood: 0, stone: 0 },
    consumed: complete ? cloneCost(def.cost) : { wood: 0, stone: 0 },
    staged: complete ? { wood: 0, stone: 0 } : cloneCost(def.cost),
    progress: complete ? 1 : 0,
    stage: complete ? "complete" : "foundation",
    complete,
    buildTime: def.buildTime,
    glow: Math.random() * Math.PI * 2,
    completionPulse: 0,
    stormDamage: 0,
    stormPrepared: false,
    settledAt: complete ? 0 : -1,
    occupation: complete ? 0.18 : 0,
    useCount: 0,
    visualTier: complete ? 1 : 0
  };
};

const makeVillager = (archetype, index) => {
  const start = [{ x: 15.2, y: 12.8 }, { x: 16.5, y: 12.7 }, { x: 14.7, y: 13.8 }, { x: 16.8, y: 13.8 }, { x: 15.8, y: 14.5 }][index];
  return {
    id: archetype.id,
    name: archetype.name,
    age: archetype.age,
    lifeStage: "adult",
    ageProgress: 0,
    parentIds: [],
    partnerId: "",
    householdId: "",
    role: archetype.role,
    preferred: archetype.preferred,
    color: archetype.color,
    hair: archetype.hair,
    note: archetype.note,
    workBias: archetype.workBias || 1,
    socialNeed: archetype.socialNeed || 0.5,
    restBias: archetype.restBias || 1,
    routine: archetype.routine || "midday",
    routineOffset: index * 1.37,
    x: start.x * WORLD.cell,
    y: start.y * WORLD.cell,
    facing: 0,
    walkPhase: index * 1.7,
    task: null,
    path: [],
    pathIndex: 0,
    carrying: null,
    workTimer: 0,
    hunger: 82 - index * 3,
    energy: 76 + index * 3,
    health: 100,
    activity: "idle",
    lastActivity: "Arriving at the clearing",
    activityDetail: "Taking in the clearing",
    thought: "The fire is warm.",
    thoughtTimer: 2.6 + index * 0.6,
    mood: 78 - index * 3,
    social: 24 + index * 8,
    weatherMood: 72,
    decisionCooldown: 0.3 + index * 0.55,
    stuckTime: 0,
    pathReplanCooldown: 0,
    failedPath: null,
    lastMoveX: start.x * WORLD.cell,
    lastMoveY: start.y * WORLD.cell,
    actionTimer: 0,
    selectedPulse: 0,
    knownResources: [],
    resourceDiscoveryCooldown: 0,
    lastDiscoveryAt: -99
  };
};

const makeChildVillager = (state, parents) => {
  const first = parents[0];
  const second = parents[1];
  const name = VILLAGER_CHILD_NAMES[(state.villagers.length + state.day + parents.length) % VILLAGER_CHILD_NAMES.length];
  const x = clamp((first.x + second.x) / 2, WORLD.cell * 5, WORLD.width - WORLD.cell * 5);
  const y = clamp((first.y + second.y) / 2, WORLD.cell * 4, WORLD.height - WORLD.cell * 4);
  return {
    id: makeId("v"),
    name,
    age: 0,
    lifeStage: "child",
    ageProgress: 0,
    role: "Child",
    preferred: "food",
    color: first.color,
    hair: second.hair,
    note: `The first little life born to ${first.name} and ${second.name}.`,
    workBias: 0,
    socialNeed: 0.9,
    restBias: 0.78,
    routine: "midday",
    routineOffset: state.villagers.length * 1.17,
    parentIds: parents.map((parent) => parent.id),
    partnerId: "",
    householdId: first.householdId || "",
    x,
    y,
    facing: 0,
    walkPhase: state.villagers.length * 1.7,
    task: null,
    path: [],
    pathIndex: 0,
    carrying: null,
    workTimer: 0,
    hunger: 88,
    energy: 86,
    health: 100,
    activity: "idle",
    lastActivity: "Staying close to home",
    activityDetail: "Staying close to home",
    thought: "There is so much to see.",
    thoughtTimer: 4.2,
    mood: 86,
    social: 18,
    weatherMood: 78,
    decisionCooldown: 1.2,
    stuckTime: 0,
    lastMoveX: x,
    lastMoveY: y,
    actionTimer: 0,
    selectedPulse: 0,
    knownResources: initialKnownResources(state.map, { x, y }),
    resourceDiscoveryCooldown: 0.8,
    lastDiscoveryAt: -99
  };
};

const initialKnownResources = (map, villager) => map.resources
  .filter((resource) => distance(villager, cellCenter(resource.x, resource.y)) <= WORLD.cell * 7)
  .map((resource) => resource.id);

export const newGame = (seed = Math.floor(Date.now() % 1000000)) => {
  const map = makeMap(seed);
  const campfire = makeBuilding("campfire", 15, 12, true);
  const villagers = VILLAGER_ARCHETYPES.map(makeVillager);
  villagers.forEach((villager) => { villager.knownResources = initialKnownResources(map, villager); });
  return {
    version: SAVE_VERSION,
    seed,
    map,
    buildings: [campfire],
    villagers,
    animals: createAnimals(map, seed),
    relationships: {},
    households: [],
    inventory: { wood: 9, stone: 5, food: 14 },
    totalGathered: { wood: 0, stone: 0, food: 0 },
    elapsed: 0.28 * 82,
    day: 1,
    timeOfDay: 0.28,
    weather: { type: "clear", label: "Clear skies", intensity: 0 },
    weatherFrom: { type: "clear", label: "Clear skies", intensity: 0 },
    weatherBlend: 1,
    speed: 1,
    paused: false,
    camera: { x: 860, y: 800, zoom: 0.96 },
    selected: { type: "villager", id: "v1" },
    priorities: { food: 1, wood: 1, stone: 1, construction: 1, hauling: 1 },
    supplyLevels: { wood: "adequate", stone: "low", food: "adequate" },
    discoveries: { progress: {}, unlocked: [], queue: [], notice: null },
    majorEvent: makeMajorEvent(),
    settlementGrowth: makeSettlementGrowth(),
    discoveryLog: [],
    groundPiles: [],
    buildMode: null,
    buildRotation: 0,
    effects: [],
    milestoneShown: false,
    milestoneDismissed: false,
    eventLog: [
      { text: "Five travelers have found a warm clearing.", age: 0 },
      { text: "Gather enough supplies to make the camp permanent.", age: 0 }
    ]
  };
};

const normalizeStateUnsafe = (raw) => {
  if (!isObject(raw) || !isObject(raw.map) || !Array.isArray(raw.map.grid) || raw.map.grid.length !== WORLD.rows || raw.map.grid.some((row) => !Array.isArray(row) || row.length !== WORLD.cols)) return null;
  if (!Array.isArray(raw.map.resources) || raw.map.resources.length > MAX_SAVE_RESOURCES || !Array.isArray(raw.villagers) || raw.villagers.length === 0 || raw.villagers.length > MAX_SAVE_VILLAGERS) return null;
  const rawVersion = raw.version === undefined ? 1 : safeInteger(raw.version, -1, -1, Number.MAX_SAFE_INTEGER);
  if (rawVersion < 1 || rawVersion > SAVE_VERSION) return null;
  const state = JSON.parse(JSON.stringify(raw));
  state.version = SAVE_VERSION;
  state.seed = safeInteger(state.seed, 1, 1, Number.MAX_SAFE_INTEGER);
  state.elapsed = safeNumber(state.elapsed, 0, 0, 1000000000);
  state.day = safeInteger(state.day, 1, 1, 1000000);
  state.timeOfDay = ((safeNumber(state.timeOfDay, 0.28, -1000000, 1000000) % 1) + 1) % 1;
  state.map.grid = state.map.grid.map((row) => row.map((cell) => ({
    terrain: SAVE_TERRAIN_TYPES.has(cell?.terrain) ? cell.terrain : "meadow",
    variation: safeNumber(cell?.variation, 0.5, 0, 1),
    resourceId: safeText(cell?.resourceId, "", 80),
    trail: safeNumber(cell?.trail, 0, 0, 1)
  })));
  const resourceIds = new Set();
  state.map.resources = state.map.resources.filter((resource) => isObject(resource) && SAVE_RESOURCE_TYPES.has(resource.type) && Number.isFinite(Number(resource.x)) && Number.isFinite(Number(resource.y)) && inBounds(Math.round(Number(resource.x)), Math.round(Number(resource.y)))).map((resource) => {
    const normalized = {
      ...resource,
      id: uniqueId(resource.id, resource.type, resourceIds),
      type: resource.type,
      x: safeInteger(resource.x, 0, 0, WORLD.cols - 1),
      y: safeInteger(resource.y, 0, 0, WORLD.rows - 1),
      amount: safeNumber(resource.amount, 0, 0, 100000),
      max: safeNumber(resource.max, Number(resource.amount) || 0, 0, 100000),
      phase: safeNumber(resource.phase, 0, -100000, 100000),
      regrowth: safeNumber(resource.regrowth, resource.type === "food" ? 0.16 : 0, 0, 10),
      depletedTime: safeNumber(resource.depletedTime, 0, 0, 1000000000),
      pollination: safeNumber(resource.pollination, 0, 0, 100)
    };
    normalized.max = Math.max(normalized.max, normalized.amount);
    return normalized;
  });
  const validResourceIds = new Set(state.map.resources.map((resource) => resource.id));
  state.map.grid.forEach((row) => row.forEach((cell) => { if (!validResourceIds.has(cell.resourceId)) cell.resourceId = ""; }));
  state.inventory = { wood: 0, stone: 0, food: 0, ...(state.inventory || {}) };
  state.totalGathered = { wood: 0, stone: 0, food: 0, ...(state.totalGathered || {}) };
  Object.keys(RESOURCE_META).forEach((type) => {
    state.inventory[type] = safeNumber(state.inventory[type], 0, 0, 100000);
    state.totalGathered[type] = safeNumber(state.totalGathered[type], 0, 0, 1000000000);
  });
  const rawBuildings = Array.isArray(state.buildings) ? state.buildings.slice(0, MAX_SAVE_BUILDINGS) : [];
  const buildingIds = new Set();
  state.buildings = rawBuildings.filter((building) => {
    const def = BUILDINGS[building?.kind];
    if (!def || !Number.isFinite(Number(building.x)) || !Number.isFinite(Number(building.y))) return false;
    const rotation = def.rotatable && Number(building.rotation) % 180 !== 0 ? 90 : 0;
    const footprint = footprintFor(building.kind, rotation);
    return Number.isInteger(Number(building.x)) && Number.isInteger(Number(building.y)) && building.x >= 0 && building.y >= 0 && building.x + footprint.w <= WORLD.cols && building.y + footprint.h <= WORLD.rows;
  }).map((building) => ({ ...building, id: uniqueId(building.id, building.kind, buildingIds) }));
  state.eventLog = Array.isArray(state.eventLog) ? state.eventLog.filter((event) => isObject(event) && typeof event.text === "string").slice(0, 8).map((event) => ({ text: event.text.slice(0, 240), age: safeNumber(event.age, 0, 0, 1000000000) })) : [];
  const savedSpeed = Number(state.speed);
  state.speed = SPEEDS.includes(savedSpeed) ? savedSpeed : SPEEDS[0];
  state.paused = Boolean(state.paused);
  state.selected = state.selected || { type: "villager", id: state.villagers[0]?.id };
  state.camera = { x: 640, y: 420, zoom: 0.96, ...(state.camera || {}) };
  // Placement previews, particles, paths, tasks, and action timers are runtime
  // state. Never resurrect them from an older save format.
  state.buildMode = null;
  state.priorities = { food: 1, wood: 1, stone: 1, construction: 1, hauling: 1, ...(state.priorities || {}) };
  Object.keys(PRIORITY_META).forEach((key) => { state.priorities[key] = clamp(Number(state.priorities[key]) || 0, 0, PRIORITY_LEVELS.length - 1); });
  state.supplyLevels = { wood: "low", stone: "low", food: "adequate", ...(state.supplyLevels || {}) };
  state.discoveries = {
    progress: { ...(state.discoveries?.progress || {}) },
    unlocked: Array.isArray(state.discoveries?.unlocked) ? state.discoveries.unlocked.filter((id) => DISCOVERY_MAP[id]) : [],
    queue: Array.isArray(state.discoveries?.queue) ? state.discoveries.queue.filter((id) => DISCOVERY_MAP[id]) : [],
    notice: state.discoveries?.notice && DISCOVERY_MAP[state.discoveries.notice.id]
      ? { id: state.discoveries.notice.id }
      : null
  };
  if (state.discoveries.notice) state.paused = true;
  DISCOVERIES.forEach((discovery) => {
    state.discoveries.progress[discovery.id] = clamp(Number(state.discoveries.progress[discovery.id]) || 0, 0, discovery.threshold);
  });
  state.discoveryLog = Array.isArray(state.discoveryLog) ? state.discoveryLog.slice(0, 5) : [];
  state.majorEvent = { ...makeMajorEvent(), ...(state.majorEvent || {}) };
  state.majorEvent.phase = ["dormant", "foreshadow", "warning", "storm", "recovery", "resolved"].includes(state.majorEvent.phase) ? state.majorEvent.phase : "dormant";
  ["forecastAt", "warningAt", "eventAt", "endsAt", "recoveryEndsAt", "preparationScore", "foodLost"].forEach((key) => { state.majorEvent[key] = safeNumber(state.majorEvent[key], 0, 0, 1000000000); });
  state.majorEvent.threatenedBuildingIds = Array.isArray(state.majorEvent.threatenedBuildingIds) ? state.majorEvent.threatenedBuildingIds : [];
  state.majorEvent.securedBuildingIds = Array.isArray(state.majorEvent.securedBuildingIds) ? state.majorEvent.securedBuildingIds : [];
  state.majorEvent.damagedBuildingIds = Array.isArray(state.majorEvent.damagedBuildingIds) ? state.majorEvent.damagedBuildingIds : [];
  state.majorEvent.milestoneShown = Boolean(state.majorEvent.milestoneShown);
  state.majorEvent.milestoneDismissed = Boolean(state.majorEvent.milestoneDismissed);
  state.groundPiles = (Array.isArray(state.groundPiles) ? state.groundPiles : []).slice(0, MAX_SAVE_RESOURCES).filter((pile) => isObject(pile) && SAVE_RESOURCE_TYPES.has(pile.type) && Number.isFinite(Number(pile.x)) && Number.isFinite(Number(pile.y))).map((pile) => ({
    ...pile,
    id: safeText(pile.id, makeId("pile"), 80),
    type: pile.type,
    x: safeNumber(pile.x, WORLD.width / 2, 0, WORLD.width),
    y: safeNumber(pile.y, WORLD.height / 2, 0, WORLD.height),
    amount: safeNumber(pile.amount, 0, 0, 100000)
  })).filter((pile) => pile.amount > 0);
  const savedGrowth = state.settlementGrowth || {};
  const defaultGrowth = makeSettlementGrowth();
  state.settlementGrowth = {
    ...defaultGrowth,
    ...savedGrowth,
    stockpiles: { ...defaultGrowth.stockpiles, ...(savedGrowth.stockpiles || {}) },
    work: { ...defaultGrowth.work, ...(savedGrowth.work || {}) }
  };
  state.relationships = state.relationships && typeof state.relationships === "object" ? state.relationships : {};
  state.households = Array.isArray(state.households) ? state.households : [];
  state.buildRotation = 0;
  state.effects = [];
  state.milestoneDismissed = Boolean(state.milestoneDismissed);
  state.weather = state.weather || weatherForState(state);
  state.weatherFrom = state.weatherFrom || state.weather;
  const normalizeWeather = (weather, fallback) => {
    const source = isObject(weather) && SAVE_WEATHER_TYPES.has(weather.type) ? weather : fallback;
    const labels = { clear: "Clear skies", cloudy: "Cloud cover", rain: "Rain passing" };
    return { type: source.type, label: labels[source.type], intensity: safeNumber(source.intensity, 0, 0, 1) };
  };
  state.weather = normalizeWeather(state.weather, weatherForState(state));
  state.weatherFrom = normalizeWeather(state.weatherFrom, state.weather);
  state.weatherBlend = Number.isFinite(Number(state.weatherBlend)) ? clamp(Number(state.weatherBlend), 0, 1) : 1;
  const sourceAnimals = Array.isArray(state.animals) && state.animals.length ? state.animals.slice(0, MAX_SAVE_ANIMALS) : createAnimals(state.map, state.seed);
  const animalIds = new Set();
  state.animals = sourceAnimals.filter((animal) => isObject(animal)).map((animal) => ({
    ...animal,
    id: uniqueId(animal.id, "animal", animalIds),
    species: ANIMAL_SPECIES[animal.species] ? animal.species : "mosshare",
    x: safeNumber(animal.x, WORLD.width / 2, 0, WORLD.width),
    y: safeNumber(animal.y, WORLD.height / 2, 0, WORLD.height)
  }));
  state.map.grid.forEach((row) => row.forEach((cell) => { cell.trail = Number(cell.trail) || 0; }));
  state.map.resources.forEach((resource) => {
    resource.regrowth = Number(resource.regrowth) || (resource.type === "food" ? 0.16 : 0);
    resource.depletedTime = Number(resource.depletedTime) || 0;
    resource.pollination = Number(resource.pollination) || 0;
  });
  state.buildings.forEach((building) => {
    building.x = safeInteger(building.x, 0, 0, WORLD.cols - 1);
    building.y = safeInteger(building.y, 0, 0, WORLD.rows - 1);
    building.rotation = BUILDINGS[building.kind]?.rotatable && Number(building.rotation) % 180 !== 0 ? 90 : 0;
    building.footprint = footprintFor(building.kind, building.rotation);
    building.materials = { wood: 0, stone: 0, ...(building.materials || {}) };
    building.consumed = { wood: 0, stone: 0, ...(building.consumed || {}) };
    building.staged = { wood: 0, stone: 0, ...(building.staged || {}) };
    ["wood", "stone"].forEach((type) => {
      const cost = BUILDINGS[building.kind].cost[type];
      building.materials[type] = safeNumber(building.materials[type], 0, 0, Math.max(cost, 100000));
      building.consumed[type] = safeNumber(building.consumed[type], 0, 0, Math.max(cost, 100000));
      building.staged[type] = safeNumber(building.staged[type], 0, 0, Math.max(cost, 100000));
    });
    building.complete = Boolean(building.complete);
    building.progress = building.complete ? 1 : Number(building.progress) || 0;
    building.stage = building.complete ? "complete" : building.stage || "foundation";
    building.completionPulse = Number(building.completionPulse) || 0;
    building.stormDamage = clamp(Number(building.stormDamage) || 0, 0, 1);
    building.stormPrepared = Boolean(building.stormPrepared);
    building.settledAt = Number.isFinite(Number(building.settledAt)) ? Number(building.settledAt) : building.complete ? 0 : -1;
    building.occupation = clamp(Number(building.occupation) || (building.complete ? 0.18 : 0), 0, 1);
    building.useCount = Math.max(0, Number(building.useCount) || 0);
    building.visualTier = clamp(Number(building.visualTier) || (building.complete ? 1 : 0), 0, 2);
  });
  const overflow = Math.max(0, inventoryTotal(state) - storageCapacity(state));
  if (overflow > 0) {
    let remaining = overflow;
    ["wood", "stone", "food"].forEach((type) => {
      if (remaining <= 0) return;
      const spilled = Math.min(Number(state.inventory[type]) || 0, remaining);
      state.inventory[type] -= spilled;
      remaining -= spilled;
      addGroundPile(state, type, spilled, cellCenter(15, 12));
    });
  }
  const villagerIds = new Set();
  state.villagers = state.villagers.filter((villager) => isObject(villager)).slice(0, MAX_SAVE_VILLAGERS).map((villager) => ({
    ...villager,
    id: uniqueId(villager.id, "v", villagerIds),
    name: safeText(villager.name, "Unnamed villager", 60),
    x: safeNumber(villager.x, WORLD.cell * 16, 0, WORLD.width),
    y: safeNumber(villager.y, WORLD.cell * 12, 0, WORLD.height),
    carrying: normalizeCarrying(villager.carrying)
  }));
  if (!state.villagers.length) return null;
  state.villagers.forEach((villager) => {
    villager.age = Math.max(0, Number(villager.age) || 0);
    // Age is authoritative when loading older saves. Earlier builds could
    // persist an adult with a stale child flag, which made the population
    // panel and adult work logic disagree with the villager's visible age.
    villager.lifeStage = villager.age < 13 ? "child" : "adult";
    villager.ageProgress = Number(villager.ageProgress) || 0;
    villager.parentIds = Array.isArray(villager.parentIds) ? villager.parentIds : [];
    villager.partnerId = villager.partnerId || "";
    villager.householdId = villager.householdId || "";
    villager.path = [];
    villager.pathIndex = 0;
    villager.task = null;
    villager.carrying = normalizeCarrying(villager.carrying);
    villager.hunger = safeNumber(villager.hunger, 70, 0, 100);
    villager.energy = safeNumber(villager.energy, 70, 0, 100);
    villager.health = safeNumber(villager.health, 100, 0, 100);
    villager.mood = safeNumber(villager.mood, 70, 0, 100);
    villager.social = safeNumber(villager.social, 40, 0, 100);
    villager.weatherMood = safeNumber(villager.weatherMood, 70, 0, 100);
    villager.activity = villager.activity || "idle";
    villager.lastActivity = villager.lastActivity || "Watching the camp";
    villager.activityDetail = villager.activityDetail || villager.lastActivity;
    villager.thought = villager.thought || "Watching the camp.";
    villager.workBias = Number(villager.workBias) || 1;
    villager.socialNeed = Number(villager.socialNeed) || 0.5;
    villager.restBias = Number(villager.restBias) || 1;
    villager.routineOffset = Number(villager.routineOffset) || 0;
    villager.thoughtTimer = Number(villager.thoughtTimer) || 2;
    villager.mood = Number(villager.mood) || 70;
    villager.social = Number(villager.social) || 40;
    villager.weatherMood = Number(villager.weatherMood) || 70;
    villager.decisionCooldown = Number(villager.decisionCooldown) || 0;
    villager.stuckTime = 0;
    villager.pathReplanCooldown = 0;
    villager.failedPath = null;
    villager.actionTimer = 0;
    villager.lastDiscoveryAt = Number(villager.lastDiscoveryAt) || -99;
    villager.knownResources = Array.isArray(villager.knownResources) && villager.knownResources.length
      ? villager.knownResources
      : initialKnownResources(state.map, villager);
    villager.resourceDiscoveryCooldown = safeNumber(villager.resourceDiscoveryCooldown, 0, 0, 10);
  });
  state.animals.forEach((animal) => {
    animal.path = [];
    animal.pathIndex = 0;
    animal.task = null;
    animal.activity = animal.activity || "wandering";
    animal.activityDetail = animal.activityDetail || "Wandering the wild edge";
    animal.lastActivity = animal.lastActivity || animal.activityDetail;
    animal.energy = safeNumber(animal.energy, 70, 0, 100);
    animal.thirst = safeNumber(animal.thirst, 25, 0, 100);
    animal.health = safeNumber(animal.health, 100, 0, 100);
    animal.decisionCooldown = Number(animal.decisionCooldown) || 0.6;
    animal.actionTimer = 0;
    animal.stuckTime = 0;
    animal.threatCooldown = Number(animal.threatCooldown) || 0;
    animal.threatCheckCooldown = safeNumber(animal.threatCheckCooldown, 0.2, 0, 10);
    animal.lastThreatAt = Number(animal.lastThreatAt) || -99;
    animal.facing = Number(animal.facing) || 1;
    animal.phase = Number(animal.phase) || 0;
    animal.routineOffset = Number(animal.routineOffset) || 0;
  });
  state.camera.x = safeNumber(state.camera.x, WORLD.width / 2, 0, WORLD.width);
  state.camera.y = safeNumber(state.camera.y, WORLD.height / 2, 0, WORLD.height);
  state.camera.zoom = safeNumber(state.camera.zoom, 0.96, 0.62, 1.46);
  const selectedType = state.selected?.type;
  const selectedId = safeText(state.selected?.id, "", 80);
  const selectedExists = selectedType === "villager"
    ? state.villagers.some((villager) => villager.id === selectedId)
    : selectedType === "animal"
      ? state.animals.some((animal) => animal.id === selectedId)
      : selectedType === "building" && state.buildings.some((building) => building.id === selectedId);
  state.selected = selectedExists ? { type: selectedType, id: selectedId } : { type: "villager", id: state.villagers[0].id };
  const buildingIdSet = new Set(state.buildings.map((building) => building.id));
  ["threatenedBuildingIds", "securedBuildingIds", "damagedBuildingIds"].forEach((key) => {
    state.majorEvent[key] = state.majorEvent[key].filter((id) => buildingIdSet.has(id));
  });
  return state;
};

export const normalizeState = (raw) => {
  try {
    return normalizeStateUnsafe(raw);
  } catch {
    return null;
  }
};

const prepareSaveSnapshot = (state) => {
  const snapshot = JSON.parse(JSON.stringify(state));
  snapshot.version = SAVE_VERSION;
  snapshot.buildMode = null;
  snapshot.buildRotation = 0;
  snapshot.effects = [];
  if (Array.isArray(snapshot.villagers)) snapshot.villagers.forEach((villager) => {
    const carrying = normalizeCarrying(villager.carrying);
    if (carrying && !carrying.targetId) carrying.targetId = safeText(villager.task?.targetId, "", 80);
    villager.carrying = carrying;
    villager.task = null;
    villager.path = [];
    villager.pathIndex = 0;
    villager.failedPath = null;
    villager.stuckTime = 0;
    villager.pathReplanCooldown = 0;
    villager.actionTimer = 0;
    villager.selectedPulse = 0;
  });
  if (Array.isArray(snapshot.animals)) snapshot.animals.forEach((animal) => {
    animal.task = null;
    animal.path = [];
    animal.pathIndex = 0;
    animal.stuckTime = 0;
    animal.pathReplanCooldown = 0;
    animal.actionTimer = 0;
  });
  return snapshot;
};

const parseStoredSave = (rawText) => {
  if (typeof rawText !== "string" || rawText.length === 0 || rawText.length > 8 * 1024 * 1024) return null;
  let parsed;
  try { parsed = JSON.parse(rawText); } catch { return null; }
  if (!isObject(parsed)) return null;
  if (parsed.magic === SAVE_MAGIC) {
    const envelopeVersion = Number(parsed.version);
    if (!isObject(parsed.payload) || !Number.isInteger(envelopeVersion) || envelopeVersion < 1 || envelopeVersion > SAVE_VERSION) return null;
    const payloadText = saveJson(parsed.payload);
    if (typeof parsed.checksum !== "string" || parsed.checksum !== saveChecksum(payloadText)) return null;
    return { raw: parsed.payload, wrapped: true, version: envelopeVersion };
  }
  // Version 1 stored the state object directly. Keep accepting it so a future
  // format change never strands an existing settlement.
  return { raw: parsed, wrapped: false, version: safeInteger(parsed.version, 1) };
};

const makeSaveEnvelope = (state) => {
  const payload = prepareSaveSnapshot(state);
  const normalized = normalizeState(payload);
  if (!normalized) return null;
  const payloadText = saveJson(normalized);
  return {
    magic: SAVE_MAGIC,
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    checksum: saveChecksum(payloadText),
    payload: normalized
  };
};

const writeSaveEnvelope = (envelope) => {
  const serialized = saveJson(envelope);
  const previous = localStorage.getItem(STORAGE_KEY);
  const previousParsed = parseStoredSave(previous);
  const previousValid = previousParsed && normalizeState(previousParsed.raw);
  localStorage.setItem(STORAGE_KEY, serialized);
  try { localStorage.setItem(SAVE_RECOVERY_KEY, serialized); } catch { /* primary save is still valid */ }
  try {
    localStorage.setItem(SAVE_BACKUP_KEY, previousValid ? previous : serialized);
  } catch { /* recovery copy remains available */ }
};

export const getSaveStatus = () => ({ ...lastSaveStatus });

export const loadSave = () => {
  try {
    const primary = localStorage.getItem(STORAGE_KEY);
    const candidates = [
      { key: STORAGE_KEY, text: primary },
      { key: SAVE_RECOVERY_KEY, text: localStorage.getItem(SAVE_RECOVERY_KEY) },
      { key: SAVE_BACKUP_KEY, text: localStorage.getItem(SAVE_BACKUP_KEY) }
    ];
    const hadStoredData = candidates.some((candidate) => Boolean(candidate.text));
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      const parsed = parseStoredSave(candidate.text);
      if (!parsed) continue;
      const state = normalizeState(parsed.raw);
      if (!state) continue;
      const needsRepair = index > 0 || !parsed.wrapped || parsed.version < SAVE_VERSION;
      if (needsRepair) {
        const envelope = makeSaveEnvelope(state);
        if (envelope) writeSaveEnvelope(envelope);
        lastSaveStatus = {
          kind: index > 0 ? "recovered" : "migrated",
          message: index > 0 ? "Recovered the last safe settlement save." : "Updated an older settlement save."
        };
      } else {
        lastSaveStatus = { kind: "loaded", message: "Settlement save loaded." };
      }
      return state;
    }
    lastSaveStatus = hadStoredData
      ? { kind: "invalid", message: "The saved settlement could not be read; a new clearing was started." }
      : { kind: "none", message: "No saved settlement found." };
    return null;
  } catch {
    lastSaveStatus = { kind: "invalid", message: "The saved settlement could not be read; a new clearing was started." };
    return null;
  }
};

export const saveGame = (state) => {
  try {
    const envelope = makeSaveEnvelope(state);
    if (!envelope) {
      lastSaveStatus = { kind: "failed", message: "Settlement could not be validated before saving." };
      return false;
    }
    writeSaveEnvelope(envelope);
    lastSaveStatus = { kind: "saved", message: "Settlement saved safely." };
    return true;
  } catch {
    lastSaveStatus = { kind: "failed", message: "Settlement could not be saved. Your previous save is unchanged." };
    return false;
  }
};

const getBuilding = (state, id) => state.buildings.find((building) => building.id === id);
const getResource = (state, id) => resourceIndex(state).get(id);

export const buildingCells = (building) => {
  const cells = [];
  for (let y = 0; y < building.footprint.h; y += 1) {
    for (let x = 0; x < building.footprint.w; x += 1) cells.push({ x: building.x + x, y: building.y + y });
  }
  return cells;
};

const buildingAt = (state, x, y, ignoreId = "") => {
  const building = buildingOccupancy(state).get(cellKey(x, y));
  return building?.id === ignoreId ? null : building || null;
};

export const isWalkable = (state, x, y, ignoreBuildingId = "") => {
  if (!inBounds(x, y) || state.map.grid[y][x].terrain === "water") return false;
  const resource = state.map.grid[y][x].resourceId ? getResource(state, state.map.grid[y][x].resourceId) : null;
  if (resource?.amount > 0) return false;
  return !buildingAt(state, x, y, ignoreBuildingId);
};

const nearestWalkable = (state, x, y, ignoreBuildingId = "") => {
  const origin = { x: clamp(Math.round(x), 0, WORLD.cols - 1), y: clamp(Math.round(y), 0, WORLD.rows - 1) };
  if (isWalkable(state, origin.x, origin.y, ignoreBuildingId)) return origin;
  for (let radius = 1; radius < 7; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const candidate = { x: origin.x + dx, y: origin.y + dy };
        if (isWalkable(state, candidate.x, candidate.y, ignoreBuildingId)) return candidate;
      }
    }
  }
  return { x: 16, y: 12 };
};

export const findPath = (state, from, to, ignoreBuildingId = "") => {
  if (state.aiMetrics) state.aiMetrics.pathCalls = (state.aiMetrics.pathCalls || 0) + 1;
  const startCell = nearestWalkable(state, Math.floor(from.x / WORLD.cell), Math.floor(from.y / WORLD.cell), ignoreBuildingId);
  const goalCell = nearestWalkable(state, Math.floor(to.x / WORLD.cell), Math.floor(to.y / WORLD.cell), ignoreBuildingId);
  const start = cellKey(startCell.x, startCell.y);
  const goal = cellKey(goalCell.x, goalCell.y);
  const pathCache = pathCacheByState.get(state);
  const cacheKey = `${start}|${goal}|${ignoreBuildingId}`;
  const cached = pathCache?.get(cacheKey);
  if (cached) {
    const currentRevision = resourcePathRevisionByState.get(state) || 0;
    const cachedPath = cached.path || cached;
    const cacheStillValid = cached.revision === currentRevision || (cachedPath.length > 0 && cachedPath.every((cell) => isWalkable(state, cell.x, cell.y, ignoreBuildingId)));
    if (cacheStillValid) {
      cached.revision = currentRevision;
      if (state.aiMetrics) state.aiMetrics.pathCacheHits = (state.aiMetrics.pathCacheHits || 0) + 1;
      return cachedPath.slice();
    }
    pathCache.delete(cacheKey);
  }
  if (start === goal) {
    if (state.aiMetrics) state.aiMetrics.pathTrivial = (state.aiMetrics.pathTrivial || 0) + 1;
    const trivial = [startCell];
    cachePath(pathCache, cacheKey, trivial, resourcePathRevisionByState.get(state) || 0);
    return trivial.slice();
  }

  const open = [{ cell: start, score: 0 }];
  const cameFrom = new Map();
  const gScore = new Map([[start, 0]]);
  const fScore = new Map([[start, Math.hypot(startCell.x - goalCell.x, startCell.y - goalCell.y)]]);

  while (open.length) {
    open.sort((a, b) => a.score - b.score);
    const current = open.shift().cell;
    if (current === goal) {
      const path = [];
      let cursor = current;
      while (cursor) {
        const [x, y] = cursor.split(",").map(Number);
        path.unshift({ x, y });
        cursor = cameFrom.get(cursor);
      }
      path.shift();
      const result = path.length ? path : [startCell];
      cachePath(pathCache, cacheKey, result, resourcePathRevisionByState.get(state) || 0);
      return result.slice();
    }
    const [cx, cy] = current.split(",").map(Number);
    DIRECTIONS.forEach(({ x: dx, y: dy }) => {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!isWalkable(state, nx, ny, ignoreBuildingId)) return;
      if (dx && dy && (!isWalkable(state, cx + dx, cy, ignoreBuildingId) || !isWalkable(state, cx, cy + dy, ignoreBuildingId))) return;
      const neighbor = cellKey(nx, ny);
      const stepCost = dx && dy ? 1.42 : 1;
      const tentative = (gScore.get(current) ?? Infinity) + stepCost;
      if (tentative < (gScore.get(neighbor) ?? Infinity)) {
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentative);
        const heuristic = Math.hypot(nx - goalCell.x, ny - goalCell.y);
        fScore.set(neighbor, tentative + heuristic);
        open.push({ cell: neighbor, score: fScore.get(neighbor) });
      }
    });
  }
  // An empty path is meaningful: the destination is sealed off. Returning the
  // start cell made an unreachable job look complete to the task runner.
  if (state.aiMetrics) state.aiMetrics.pathFailures = (state.aiMetrics.pathFailures || 0) + 1;
  cachePath(pathCache, cacheKey, [], resourcePathRevisionByState.get(state) || 0);
  return [];
};

const logEvent = (state, text) => {
  state.eventLog.unshift({ text, age: 0 });
  state.eventLog = state.eventLog.slice(0, 8);
};

const unlockDiscovery = (state, discovery) => {
  if (hasDiscovery(state, discovery.id)) return;
  state.discoveries.unlocked.push(discovery.id);
  state.discoveries.progress[discovery.id] = discovery.threshold;
  state.discoveries.queue.push(discovery.id);
  if (!state.discoveries.notice) state.discoveries.notice = { id: discovery.id };
  state.paused = true;
  const hearth = state.buildings.find((building) => building.complete && building.kind === "campfire") || state.buildings[0];
  const center = hearth ? cellCenter(hearth.x, hearth.y) : cellCenter(15, 12);
  state.effects.push({ type: "discovery", x: center.x, y: center.y, life: 0, kind: discovery.id });
  state.discoveryLog.unshift({ id: discovery.id, text: discovery.name, age: 0 });
  state.discoveryLog = state.discoveryLog.slice(0, 5);
  logEvent(state, `New discovery: ${discovery.name}. ${discovery.reward}`);
};

const recordDiscoveryWork = (state, signal, amount = 1) => {
  const contribution = Number(amount) || 0;
  if (contribution <= 0) return;
  DISCOVERIES.forEach((discovery) => {
    if (hasDiscovery(state, discovery.id) || discovery.signal !== signal) return;
    const previous = Number(state.discoveries.progress[discovery.id]) || 0;
    const next = clamp(previous + contribution, 0, discovery.threshold);
    state.discoveries.progress[discovery.id] = next;
    if (next >= discovery.threshold) unlockDiscovery(state, discovery);
  });
};

export const discoveryStats = (state) => {
  const unlocked = DISCOVERIES.filter((discovery) => hasDiscovery(state, discovery.id));
  const next = DISCOVERIES
    .filter((discovery) => !hasDiscovery(state, discovery.id))
    .sort((a, b) => (state.discoveries.progress[b.id] / b.threshold) - (state.discoveries.progress[a.id] / a.threshold))[0] || null;
  return {
    total: DISCOVERIES.length,
    unlocked: unlocked.length,
    next,
    villageThreshold: 5
  };
};

const villageGateMet = (state) => objectiveState(state).every((objective) => objective.complete) && discoveryStats(state).unlocked >= discoveryStats(state).villageThreshold;

const stormPreparationScore = (state) => {
  const event = state.majorEvent;
  const shelters = state.buildings.filter((building) => building.complete && building.kind === "shelter").length;
  const secured = new Set(event?.securedBuildingIds || []).size;
  const foodReserve = clamp((Number(state.inventory.food) || 0) / 42, 0, 1);
  const woodReserve = clamp((Number(state.inventory.wood) || 0) / 28, 0, 1);
  const structureReadiness = state.buildings.filter((building) => building.complete && building.kind !== "campfire").length ? secured / Math.max(1, state.buildings.filter((building) => building.complete && building.kind !== "campfire").length) : 0;
  return clamp(
    shelters * 0.13
      + (hasCompleteBuilding(state, "storage") ? 0.14 : 0)
      + (hasCompleteBuilding(state, "well") ? 0.12 : 0)
      + foodReserve * 0.12
      + woodReserve * 0.06
      + (hasDiscovery(state, "camp-watch") ? 0.12 : 0)
      + (hasDiscovery(state, "organized-storage") ? 0.06 : 0)
      + structureReadiness * 0.25,
    0,
    1
  );
};

const armMajorEvent = (state) => {
  const event = state.majorEvent;
  if (!event || event.phase !== "dormant" || !villageGateMet(state)) return false;
  event.phase = "foreshadow";
  event.forecastAt = state.elapsed;
  event.warningAt = state.elapsed + 72;
  event.eventAt = state.elapsed + 142;
  event.endsAt = event.eventAt + 44;
  event.recoveryEndsAt = event.endsAt + 66;
  event.preparationScore = stormPreparationScore(state);
  logEvent(state, "The western ridge has gone black. A great storm is building beyond the valley.");
  return true;
};

const beginStorm = (state) => {
  const event = state.majorEvent;
  event.phase = "storm";
  event.preparationScore = stormPreparationScore(state);
  event.threatenedBuildingIds = state.buildings
    .filter((building) => building.complete && building.kind !== "campfire")
    .map((building) => building.id);
  logEvent(state, "The Great Storm reaches the village. The people run for ropes, roofs, and the fire.");
  state.effects.push({ type: "storm", x: cellCenter(16, 12).x, y: cellCenter(16, 12).y, life: 0, kind: "storm" });
};

const resolveStorm = (state) => {
  const event = state.majorEvent;
  const score = stormPreparationScore(state);
  const secured = new Set(event.securedBuildingIds || []);
  const baseDamage = clamp(0.3 - score * 0.2, 0.06, 0.3);
  event.preparationScore = score;
  event.damagedBuildingIds = [];
  event.threatenedBuildingIds.forEach((id) => {
    const building = getBuilding(state, id);
    if (!building) return;
    const protection = secured.has(id) ? 0.7 : 0;
    const damage = clamp(baseDamage * (1 - protection) + (building.kind === "storage" ? 0.025 : 0), 0.025, 0.28);
    building.stormDamage = clamp((Number(building.stormDamage) || 0) + damage, 0, 0.4);
    building.stormPrepared = false;
    if (building.stormDamage > 0.06) event.damagedBuildingIds.push(id);
  });
  event.foodLost = Math.min(Math.floor(state.inventory.food * (0.025 + (1 - score) * 0.09)), state.inventory.food);
  state.inventory.food = Math.max(0, state.inventory.food - event.foodLost);
  state.villagers.forEach((villager) => {
    villager.weatherMood = clamp(villager.weatherMood - (1 - score) * 18, 0, 100);
    villager.energy = clamp(villager.energy - (1 - score) * 10, 0, 100);
  });
  const damageCount = event.damagedBuildingIds.length;
  event.outcome = score > 0.72
    ? "The roofs held. The village met the storm with prepared hands."
    : damageCount
      ? "The village held together, though the storm left work for the morning."
      : "The village held together through a long, hard night.";
  event.phase = "recovery";
  event.recoveryEndsAt = state.elapsed + 66;
  logEvent(state, event.outcome);
  if (event.foodLost > 0) logEvent(state, `Rain spoiled ${event.foodLost} food before the stores could be covered.`);
};

const finishMajorEvent = (state) => {
  const event = state.majorEvent;
  event.phase = "resolved";
  event.milestoneShown = true;
  event.milestoneDismissed = false;
  state.paused = true;
  logEvent(state, "At first light, the village is still standing. The first storm has passed into memory.");
};

const advanceMajorEvent = (state) => {
  const event = state.majorEvent;
  if (!event || event.phase === "resolved") return;
  if (event.phase === "dormant") {
    armMajorEvent(state);
    return;
  }
  if (event.phase === "foreshadow" && state.elapsed >= event.warningAt) {
    event.phase = "warning";
    logEvent(state, "The storm will reach the clearing soon. Secure roofs, cover food, and bring children close.");
  }
  if (event.phase === "warning" && state.elapsed >= event.eventAt) beginStorm(state);
  if (event.phase === "storm" && state.elapsed >= event.endsAt) resolveStorm(state);
  if (event.phase === "recovery" && state.elapsed >= event.recoveryEndsAt) finishMajorEvent(state);
  if (["foreshadow", "warning"].includes(event.phase)) event.preparationScore = stormPreparationScore(state);
};

const eventWeatherForState = (state, normalWeather) => {
  const phase = state.majorEvent?.phase;
  if (phase === "foreshadow") return { type: "cloudy", label: "Storm front", intensity: 0.62 };
  if (phase === "warning") return { type: "cloudy", label: "Storm coming", intensity: 0.82 };
  if (phase === "storm") return { type: "storm", label: "The Great Storm", intensity: 1 };
  if (phase === "recovery") return { type: "rain", label: "After the storm", intensity: 0.54 };
  return normalWeather;
};

export const majorEventStatus = (state) => {
  const event = state.majorEvent;
  if (!event || event.phase === "dormant") return { visible: false, phase: "dormant" };
  const remainingAt = event.phase === "foreshadow" ? event.warningAt : event.phase === "warning" ? event.eventAt : event.phase === "storm" ? event.endsAt : event.phase === "recovery" ? event.recoveryEndsAt : 0;
  const remaining = Math.max(0, Math.ceil((remainingAt - state.elapsed) * 10) / 10);
  const copy = {
    foreshadow: { label: "Storm watch", title: "A great storm is building", detail: "The ridge is darkening. Use this quiet window to prepare." },
    warning: { label: "Storm warning", title: "The storm is almost here", detail: "Villagers are bracing the village. Food, shelter, and strong roofs matter." },
    storm: { label: "The Great Storm", title: "Hold fast", detail: "The people are sheltering, securing buildings, and keeping the hearth alive." },
    recovery: { label: "After the storm", title: "The village is taking stock", detail: "Villagers are repairing what the wind and rain shook loose." },
    resolved: { label: "Storm survived", title: "The village endures", detail: event.outcome || "The first storm has passed into memory." }
  }[event.phase];
  return { visible: true, phase: event.phase, ...copy, remaining, preparation: Math.round((event.preparationScore || stormPreparationScore(state)) * 100), damaged: event.damagedBuildingIds.length, foodLost: event.foodLost || 0 };
};

const updateBuildingStage = (building) => {
  const def = BUILDINGS[building.kind];
  const woodReady = def.cost.wood === 0 || building.materials.wood >= def.cost.wood;
  const stoneReady = def.cost.stone === 0 || building.materials.stone >= def.cost.stone;
  const materialsReady = woodReady && stoneReady;
  if (building.complete) return;
  if (building.progress < 0.28) building.stage = "foundation";
  else if (building.progress < 0.7) building.stage = "frame";
  else building.stage = materialsReady ? "finishing" : "frame";
};

const materialsReady = (building) => {
  const cost = BUILDINGS[building.kind].cost;
  return building.materials.wood >= cost.wood && building.materials.stone >= cost.stone;
};

const availableStagedMaterial = (building) => Object.keys(building.staged).find((type) => building.staged[type] > 0 && building.materials[type] < BUILDINGS[building.kind].cost[type]);

const findStorage = (state, origin = null) => {
  const candidates = state.buildings.filter((building) => building.complete && ["storage", "campfire"].includes(building.kind));
  if (!candidates.length) return null;
  if (origin) {
    const ranked = candidates.slice().sort((a, b) => {
      const aPoint = cellCenter(a.x + a.footprint.w / 2 - 0.5, a.y + a.footprint.h / 2 - 0.5);
      const bPoint = cellCenter(b.x + b.footprint.w / 2 - 0.5, b.y + b.footprint.h / 2 - 0.5);
      return distance(origin, aPoint) - distance(origin, bPoint);
    });
    const reachable = ranked.slice(0, 2).map((building) => {
      const point = cellCenter(building.x + building.footprint.w / 2 - 0.5, building.y + building.footprint.h / 2 - 0.5);
      const path = findPath(state, origin, point);
      return { building, path };
    }).filter(({ building, path }) => path.length || distance(origin, cellCenter(building.x, building.y)) <= WORLD.cell * 1.2);
    if (reachable.length) return reachable.sort((a, b) => a.path.length - b.path.length)[0].building;
  }
  return candidates.sort((a, b) => {
    if (!origin) return a.kind === "storage" ? -1 : b.kind === "storage" ? 1 : 0;
    const aPoint = cellCenter(a.x + a.footprint.w / 2 - 0.5, a.y + a.footprint.h / 2 - 0.5);
    const bPoint = cellCenter(b.x + b.footprint.w / 2 - 0.5, b.y + b.footprint.h / 2 - 0.5);
    return distance(origin, aPoint) - distance(origin, bPoint);
  })[0];
};

const inventoryTotal = (state) => Object.keys(RESOURCE_META).reduce((sum, type) => sum + Math.max(0, Number(state.inventory[type]) || 0), 0);

export const storageCapacity = (state) => BASE_STORAGE_CAPACITY + (hasDiscovery(state, "organized-storage") ? 12 : 0) + state.buildings
  .filter((building) => building.complete && building.kind === "storage")
  .reduce((sum, building) => sum + Number(BUILDINGS[building.kind].capacity || 0), 0);

export const storageRoom = (state) => Math.max(0, storageCapacity(state) - inventoryTotal(state));

const addActionEffect = (state, type, point, kind = "") => {
  if (!point || !state.effects) return;
  state.effects.push({ type, x: point.x, y: point.y, life: 0, kind });
};

const addGroundPile = (state, type, amount, point) => {
  if (amount <= 0) return;
  const existing = state.groundPiles.find((pile) => pile.type === type && distance(pile, point) < WORLD.cell * 0.7);
  if (existing) existing.amount += amount;
  else state.groundPiles.push({ id: makeId("pile"), type, amount, x: point.x, y: point.y });
};

const getGroundPile = (state, id) => state.groundPiles.find((pile) => pile.id === id);

const nearbyFoodPile = (state, site, origin = null) => {
  const point = site
    ? cellCenter(site.x + (site.footprint?.w || 1) / 2 - 0.5, site.y + (site.footprint?.h || 1) / 2 - 0.5)
    : origin;
  return state.groundPiles
    .filter((pile) => pile.type === "food" && pile.amount > 0 && (!point || distance(pile, point) < WORLD.cell * 2.2))
    .sort((a, b) => (point ? distance(a, point) - distance(b, point) : 0))[0] || null;
};

const foodAccessPoints = (state) => state.buildings
  .filter((building) => building.complete && ["storage", "campfire"].includes(building.kind))
  .map((building) => cellCenter(building.x + building.footprint.w / 2 - 0.5, building.y + building.footprint.h / 2 - 0.5));

const availableFood = (state) => {
  const accessPoints = foodAccessPoints(state);
  const accessiblePiles = state.groundPiles.filter((pile) => pile.type === "food" && pile.amount > 0 && accessPoints.some((point) => distance(pile, point) <= WORLD.cell * 2.35));
  return state.inventory.food + accessiblePiles.reduce((sum, pile) => sum + pile.amount, 0);
};

const consumeFood = (state, site, origin = null) => {
  if (state.inventory.food > 0) {
    state.inventory.food -= 1;
    return true;
  }
  const pile = nearbyFoodPile(state, site, origin);
  if (!pile) return false;
  pile.amount = Math.max(0, pile.amount - 1);
  return true;
};

const chooseGroundPile = (state, villager) => state.groundPiles
  .filter((pile) => pile.amount > 0 && storageRoom(state) >= Math.min(4, pile.amount))
  .sort((a, b) => distance(villager, a) - distance(villager, b))[0];

export const supplyLevel = (state, type) => {
  // Food can be safely eaten from the visible ground piles that villagers
  // create when the store is full. Reading only the inventory made a healthy
  // camp look food-starved in the resource bar even while the settlement had
  // an accessible meal sitting beside the hearth.
  const amount = type === "food"
    ? availableFood(state)
    : Number(state.inventory[type]) || 0;
  const thresholds = RESOURCE_META[type]?.thresholds || { critical: 2, low: 6, adequate: 15, abundant: 30 };
  if (amount <= thresholds.critical) return "critical";
  if (amount <= thresholds.low) return "low";
  if (amount <= thresholds.adequate) return "adequate";
  return "abundant";
};

const updateSupplyLevels = (state) => {
  Object.keys(RESOURCE_META).forEach((type) => {
    const next = supplyLevel(state, type);
    const previous = state.supplyLevels[type] || next;
    if (next !== previous && (next === "critical" || next === "low" || previous === "critical" || previous === "low")) {
      const label = RESOURCE_META[type].label;
      logEvent(state, next === "critical" ? `${label} stores are critical.` : next === "low" ? `${label} stores are running low.` : `${label} stores are healthy again.`);
    }
    state.supplyLevels[type] = next;
  });
};

const updateSettlementGrowth = (state, dt) => {
  const growth = state.settlementGrowth;
  if (!growth) return;
  const completeBuildings = state.buildings.filter((building) => building.complete);
  const occupiedBuildings = completeBuildings.filter((building) => building.kind !== "campfire").length;
  const activeVillagers = state.villagers.filter((villager) => villager.task || ["gathering", "hauling", "building", "eating", "resting", "warming"].includes(villager.activity));
  const nearHearth = state.buildings.find((building) => building.complete && building.kind === "campfire");
  const hearthPoint = nearHearth ? cellCenter(nearHearth.x, nearHearth.y) : null;
  const hearthVisitors = hearthPoint ? state.villagers.filter((villager) => distance(villager, hearthPoint) < 118).length : 0;

  growth.cleared = clamp(growth.cleared + dt * (occupiedBuildings * 0.00055 + activeVillagers.length * 0.00014), 0, 1);
  growth.hearth = clamp(growth.hearth + dt * (hearthVisitors * 0.0018 + (state.totalGathered.food || 0) * 0.000002), 0, 1);
  growth.tools = clamp(
    growth.tools
      + dt * (activeVillagers.filter((villager) => ["gathering", "building"].includes(villager.activity)).length * 0.00065)
      + (hasDiscovery(state, "stone-tools") ? dt * 0.0007 : 0)
      + (hasDiscovery(state, "woodworking") ? dt * 0.0007 : 0),
    0,
    1
  );

  const workCounts = { wood: 0, stone: 0, food: 0, construction: 0 };
  state.villagers.forEach((villager) => {
    if (villager.task?.type === "gather") {
      const resource = getResource(state, villager.task.targetId);
      if (resource) workCounts[resource.type] += 1;
    }
    if (["deliver", "build", "secure", "repair"].includes(villager.task?.type)) workCounts.construction += 1;
  });
  Object.keys(workCounts).forEach((type) => {
    growth.work[type] = clamp(growth.work[type] + dt * workCounts[type] * 0.0022, 0, 1);
  });

  completeBuildings.forEach((building) => {
    const point = cellCenter(building.x + building.footprint.w / 2 - 0.5, building.y + building.footprint.h / 2 - 0.5);
    const nearby = state.villagers.filter((villager) => distance(villager, point) < Math.max(74, building.footprint.w * WORLD.cell * 0.9)).length;
    const assigned = state.villagers.some((villager) => villager.task?.targetId === building.id);
    building.occupation = clamp((Number(building.occupation) || 0) + dt * (0.00022 + nearby * 0.00042 + (assigned ? 0.0013 : 0)), 0, 1);
    building.useCount = (Number(building.useCount) || 0) + nearby * dt * 0.002;
    building.visualTier = building.occupation > 0.68 ? 2 : building.occupation > 0.22 ? 1 : 0;
  });
};

const discoverNearbyResources = (state, villager) => {
  const known = new Set(villager.knownResources || []);
  const found = state.map.resources.filter((resource) => !known.has(resource.id) && distance(villager, cellCenter(resource.x, resource.y)) < WORLD.cell * 4.6);
  if (!found.length) return;
  villager.knownResources = [...known, ...found.map((resource) => resource.id)];
  if (state.elapsed - (villager.lastDiscoveryAt || -99) > 5) {
    const first = found[0];
    state.discoveryLog.unshift({ text: `${villager.name} noticed a ${RESOURCE_META[first.type].label.toLowerCase()} source nearby.`, age: 0 });
    state.discoveryLog = state.discoveryLog.slice(0, 5);
    logEvent(state, `${villager.name} found a ${RESOURCE_META[first.type].label.toLowerCase()} source.`);
    villager.lastDiscoveryAt = state.elapsed;
  }
};

const findRestSite = (state, villager) => {
  const shelters = state.buildings.filter((building) => building.complete && building.kind === "shelter");
  const well = state.buildings.filter((building) => building.complete && building.kind === "well");
  const restSites = [...shelters, ...well];
  if (!restSites.length) return state.buildings.find((building) => building.complete && building.kind === "campfire");
  const ranked = restSites.slice().sort((a, b) => distance(villager, a) - distance(villager, b));
  const reachable = ranked.slice(0, 2).map((building) => {
    const point = cellCenter(building.x + building.footprint.w / 2 - 0.5, building.y + building.footprint.h / 2 - 0.5);
    return { building, path: findPath(state, villager, point) };
  }).filter(({ building, path }) => path.length || distance(villager, cellCenter(building.x, building.y)) <= WORLD.cell * 1.2);
  return (reachable.length ? reachable.sort((a, b) => a.path.length - b.path.length)[0].building : state.buildings.find((building) => building.complete && building.kind === "campfire"));
};

const hasCompleteBuilding = (state, kind) => state.buildings.some((building) => building.complete && building.kind === kind);

const resourceWorkTime = (state, type, baseTime) => {
  const station = { food: "dryingRack", wood: "woodcutterArea", stone: "stoneSite" }[type];
  const stationFactor = hasCompleteBuilding(state, station) ? 0.76 : 1;
  const toolFactor = type === "stone" && hasDiscovery(state, "stone-tools") ? 0.78 : 1;
  const woodworkingFactor = type === "wood" && hasDiscovery(state, "woodworking") ? 0.84 : 1;
  const preservationFactor = type === "food" && hasDiscovery(state, "food-preservation") ? 0.9 : 1;
  return baseTime * stationFactor * toolFactor * woodworkingFactor * preservationFactor;
};

const markTrail = (state, x, y, amount) => {
  const { x: cellX, y: cellY } = worldToCell(x, y);
  const cell = state.map.grid[cellY]?.[cellX];
  if (!cell || cell.terrain === "water") return;
  cell.trail = clamp((cell.trail || 0) + amount, 0, 1);
  const neighbors = [[1, 0, 0.22], [-1, 0, 0.22], [0, 1, 0.22], [0, -1, 0.22], [1, 1, 0.08], [-1, 1, 0.08], [1, -1, 0.08], [-1, -1, 0.08]];
  neighbors.forEach(([dx, dy, spread]) => {
    const neighbor = state.map.grid[cellY + dy]?.[cellX + dx];
    if (neighbor && neighbor.terrain !== "water") neighbor.trail = clamp((neighbor.trail || 0) + amount * spread, 0, 1);
  });
  state.settlementGrowth.traffic = clamp(state.settlementGrowth.traffic + amount * 0.035, 0, 1);
};

const assignmentCounts = (state) => {
  const counts = new Map();
  state.villagers.forEach((villager) => {
    const targetId = villager.task?.targetId;
    if (targetId) counts.set(targetId, (counts.get(targetId) || 0) + 1);
  });
  return counts;
};

const countAssignments = (state, targetId, counts = null) => counts ? (counts.get(targetId) || 0) : state.villagers.filter((villager) => villager.task?.targetId === targetId).length;

const countTaskType = (state, type) => state.villagers.filter((villager) => villager.task?.type === type).length;

const taskTargetPoint = (state, villager) => {
  const task = villager.task;
  if (!task) return null;
  if (task.type === "social") {
    const partner = state.villagers.find((candidate) => candidate.id === task.socialWith);
    return partner ? { x: partner.x, y: partner.y } : task.goal;
  }
  return task.goal || null;
};

const setPresentation = (villager, type, target) => {
  const resourceName = target?.type ? RESOURCE_META[target.type]?.label.toLowerCase() : "";
  const buildingName = target?.kind ? BUILDINGS[target.kind]?.name.toLowerCase() : "";
  const descriptions = {
    gather: `Heading to ${resourceName || "supplies"}`,
    deliver: `Carrying ${resourceName || "materials"} to the ${buildingName || "foundation"}`,
    return: `Carrying ${villager.carrying?.amount || 1} ${(RESOURCE_META[villager.carrying?.type]?.label || resourceName || "supplies").toLowerCase()} back to camp`,
    haulPile: `Picking up ${RESOURCE_META[target?.type]?.label?.toLowerCase() || "supplies"}`,
    build: `Building ${buildingName || "a structure"}`,
    secure: `Bracing the ${buildingName || "roof"}`,
    repair: `Repairing the ${buildingName || "structure"}`,
    eat: "Walking over for a meal",
    rest: "Finding a quiet place to rest",
    warm: "Resting by the fire",
    social: "Looking for someone to talk to",
    play: "Playing near home",
    wander: "Wandering through the clearing"
  };
  villager.activityDetail = descriptions[type] || "Watching the camp";
  villager.lastActivity = villager.activityDetail;
};

const startTask = (state, villager, type, target, preserveCarrying = false) => {
  if (!target) return false;
  const targetPoint = target?.worldPoint
    ? { x: target.x, y: target.y }
    : type === "social" || type === "haulPile"
    ? { x: target.x, y: target.y }
    : target.x !== undefined && target.y !== undefined ? cellCenter(target.x, target.y) : target;
  if (target.id && villager.failedPath?.targetId === target.id && state.elapsed < villager.failedPath.until) return false;
  const path = findPath(state, villager, targetPoint, type === "build" ? target.id : "");
  const closeEnough = distance(villager, targetPoint) <= WORLD.cell * 1.2;
  if (!path.length && !closeEnough) {
    if (target.id) villager.failedPath = { targetId: target.id, until: state.elapsed + 12 };
    return false;
  }
  let resourceType = "";
  if (type === "deliver") {
    const material = preserveCarrying ? villager.carrying?.type : availableStagedMaterial(target);
    if (!material) return false;
    if (!preserveCarrying) {
      target.staged[material] -= 1;
      villager.carrying = { type: material, amount: 1, purpose: "construction", targetId: target.id };
    } else if (!villager.carrying) {
      return false;
    } else {
      villager.carrying.targetId = target.id;
    }
    resourceType = material;
  } else if (type === "return" && villager.carrying) {
    villager.carrying.targetId = target.id;
  }
  villager.task = {
    type,
    targetId: ["wander", "play"].includes(type) || (type === "eat" && !target.kind) ? "" : target.id,
    resourceType,
    goal: targetPoint,
    socialWith: type === "social" ? target.id : ""
  };
  villager.failedPath = null;
  villager.path = path;
  villager.pathIndex = 0;
  villager.workTimer = 0;
  villager.actionTimer = 0;
  villager.activity = type === "return" ? "returning" : type === "deliver" || type === "haulPile" ? "hauling" : type === "social" ? "socializing" : type === "warm" ? "warming" : type === "wander" ? "wandering" : type === "play" ? "playing" : type === "secure" ? "securing" : type === "repair" ? "repairing" : type;
  setPresentation(villager, type, target);
  return true;
};

const finishTask = (villager, state = null) => {
  if (state && villager.carrying) {
    const carried = villager.carrying;
    addGroundPile(state, carried.type, carried.amount, { x: villager.x, y: villager.y });
    villager.carrying = null;
  }
  villager.task = null;
  villager.path = [];
  villager.pathIndex = 0;
  villager.workTimer = 0;
  villager.actionTimer = 0;
  villager.decisionCooldown = Math.max(Number(villager.decisionCooldown) || 0, 0.42 + (Number(villager.routineOffset) || 0) * 0.06);
};

const findIncompleteBuilding = (state, kind = "", counts = null) => state.buildings
  .filter((building) => !building.complete && (!kind || building.kind === kind))
  .sort((a, b) => countAssignments(state, a.id, counts) - countAssignments(state, b.id, counts))[0];

const chooseResource = (state, villager, type, counts = null) => {
  const known = new Set(villager.knownResources || []);
  const candidates = state.map.resources.filter((resource) => resource.type === type && resource.amount > 0 && known.has(resource.id));
  const hasOpenSlot = candidates.some((resource) => countAssignments(state, resource.id, counts) < 3);
  const options = candidates
    .filter((resource) => countAssignments(state, resource.id, counts) < 3 || hasOpenSlot)
    .sort((a, b) => {
      const assignmentPenalty = (countAssignments(state, a.id, counts) - countAssignments(state, b.id, counts)) * 360;
      return distance(villager, cellCenter(a.x, a.y)) - distance(villager, cellCenter(b.x, b.y)) + assignmentPenalty;
    });
  return options[0];
};

const chooseWorkResource = (state, villager, counts = null) => {
  const types = Object.keys(RESOURCE_META).sort((a, b) => {
    const priorityDelta = (state.priorities[b] || 1) - (state.priorities[a] || 1);
    const preferenceDelta = (b === villager.preferred ? 0.22 : 0) - (a === villager.preferred ? 0.22 : 0);
    return priorityDelta + preferenceDelta;
  });
  return types.map((type) => chooseResource(state, villager, type, counts)).find(Boolean) || null;
};

const chooseSocialPartner = (state, villager, counts = null) => {
  let best = null;
  let bestScore = Infinity;
  state.villagers.forEach((candidate) => {
    if (candidate.id === villager.id || candidate.health <= 20 || candidate.lifeStage !== villager.lifeStage) return;
    const affinity = state.relationships?.[relationshipKey(villager.id, candidate.id)]?.affinity || 0;
    const score = distance(villager, candidate) + countAssignments(state, candidate.id, counts) * 100 - affinity * 0.7;
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  });
  return best;
};

const chooseWanderTarget = (state, villager) => {
  const origin = worldToCell(villager.x, villager.y);
  const offsets = [
    { x: 2, y: 1 }, { x: -2, y: 1 }, { x: 1, y: -2 }, { x: -1, y: 2 },
    { x: 3, y: -1 }, { x: -3, y: -1 }, { x: 2, y: 2 }, { x: -2, y: -2 }
  ];
  const offset = offsets[Math.floor(chance(state.elapsed + villager.routineOffset) * offsets.length) % offsets.length];
  const candidate = nearestWalkable(state, origin.x + offset.x, origin.y + offset.y);
  return { id: `wander-${villager.id}-${Math.floor(state.elapsed)}`, x: candidate.x, y: candidate.y };
};

const relationshipKey = (firstId, secondId) => [firstId, secondId].sort().join("|");

const getRelationship = (state, first, second) => {
  const key = relationshipKey(first.id, second.id);
  if (!state.relationships[key]) state.relationships[key] = { affinity: 0, sharedTime: 0, friendship: false, friendshipAt: -1 };
  return state.relationships[key];
};

const sharedActivity = (villager) => ["socializing", "warming", "eating", "resting", "playing"].includes(villager.activity);

const createHousehold = (state, first, second, relationship) => {
  const household = {
    id: makeId("household"),
    members: [first.id, second.id],
    partnerIds: [first.id, second.id],
    children: [],
    foundedAt: state.elapsed,
    nextBirthAt: state.elapsed + 150 + chance(state.elapsed + first.routineOffset) * 65,
    homeBuildingId: state.buildings.find((building) => building.complete && building.kind === "shelter" && !state.households.some((candidate) => candidate.homeBuildingId === building.id))?.id || ""
  };
  state.households.push(household);
  first.partnerId = second.id;
  second.partnerId = first.id;
  first.householdId = household.id;
  second.householdId = household.id;
  relationship.partnership = true;
  relationship.friendship = true;
  relationship.affinity = Math.max(relationship.affinity, 72);
  logEvent(state, `${first.name} and ${second.name} have begun keeping a household together.`);
};

const updateRelationships = (state, dt) => {
  const adults = state.villagers.filter((villager) => villager.lifeStage === "adult" && villager.health > 0);
  const candidates = [];
  const adultSpatialIndex = buildSpatialIndex(adults);
  adults.forEach((first) => {
    nearbySpatialEntities(adultSpatialIndex, first, 112).forEach((second) => {
      if (first.id >= second.id) return;
      const relationship = getRelationship(state, first, second);
      const close = distance(first, second) < 112;
      const sharing = close && (sharedActivity(first) || sharedActivity(second) || first.task?.type === "social" || second.task?.type === "social");
      if (close) relationship.affinity = clamp(relationship.affinity + dt * (sharing ? 0.19 : 0.045), 0, 100);
      if (sharing) relationship.sharedTime += dt;
      if (!relationship.friendship && relationship.affinity >= 24 && relationship.sharedTime >= 18) {
        relationship.friendship = true;
        relationship.friendshipAt = state.elapsed;
        logEvent(state, `${first.name} and ${second.name} have become friends.`);
      }
      if (!first.partnerId && !second.partnerId && !first.householdId && !second.householdId && relationship.friendship && relationship.affinity >= 38 && relationship.sharedTime >= 90) {
        candidates.push({ first, second, relationship });
      }
    });
  });
  candidates.sort((a, b) => b.relationship.affinity - a.relationship.affinity);
  const paired = new Set();
  candidates.forEach(({ first, second, relationship }) => {
    if (paired.has(first.id) || paired.has(second.id)) return;
    createHousehold(state, first, second, relationship);
    paired.add(first.id); paired.add(second.id);
  });
};

const ageVillagers = (state, dt) => {
  state.villagers.forEach((villager) => {
    villager.ageProgress = (Number(villager.ageProgress) || 0) + dt / (82 * 30);
    if (villager.ageProgress < 1) return;
    villager.ageProgress -= 1;
    villager.age += 1;
    if (villager.lifeStage === "child" && villager.age >= 13) {
      villager.lifeStage = "adult";
      villager.role = "Young adult";
      villager.workBias = 0.82;
      villager.preferred = "food";
      logEvent(state, `${villager.name} is growing into a young adult.`);
    }
  });
};

const householdFor = (state, villager) => state.households.find((household) => household.id === villager.householdId);

const maybeBirth = (state) => {
  if (state.villagers.length >= 8) return;
  for (const household of state.households) {
    if (state.villagers.length >= 8 || household.children.length > 0 || state.elapsed < household.nextBirthAt) continue;
    const parents = household.partnerIds.map((id) => state.villagers.find((villager) => villager.id === id)).filter(Boolean);
    if (parents.length !== 2 || parents.some((parent) => parent.health < 70 || parent.hunger < 42)) {
      household.nextBirthAt = state.elapsed + 45;
      continue;
    }
    const child = makeChildVillager(state, parents);
    state.villagers.push(child);
    household.children.push(child.id);
    household.members.push(child.id);
    parents.forEach((parent) => {
      state.relationships[relationshipKey(parent.id, child.id)] = { affinity: 100, sharedTime: 0, friendship: false, family: true, friendshipAt: -1 };
    });
    const center = cellCenter(Math.round(child.x / WORLD.cell - 0.5), Math.round(child.y / WORLD.cell - 0.5));
    state.effects.push({ type: "birth", x: center.x, y: center.y, life: 0, kind: "birth" });
    logEvent(state, `${child.name} was born to ${parents[0].name} and ${parents[1].name}. The camp has a new generation.`);
  }
};

export const populationStats = (state) => {
  const adults = state.villagers.filter((villager) => villager.lifeStage !== "child");
  const children = state.villagers.filter((villager) => villager.lifeStage === "child");
  return {
    total: state.villagers.length,
    adults: adults.length,
    children: children.length,
    availableWorkers: adults.filter((villager) => villager.health > 30).length,
    households: state.households.length
  };
};

export const relationshipSummary = (state, villager) => {
  const household = householdFor(state, villager);
  const partner = villager.partnerId ? state.villagers.find((candidate) => candidate.id === villager.partnerId) : null;
  const parents = (villager.parentIds || []).map((id) => state.villagers.find((candidate) => candidate.id === id)).filter(Boolean);
  const children = state.villagers.filter((candidate) => candidate.parentIds?.includes(villager.id));
  const friends = state.villagers
    .filter((candidate) => candidate.id !== villager.id && candidate.lifeStage === "adult")
    .map((candidate) => ({ candidate, relationship: getRelationship(state, villager, candidate) }))
    .filter(({ relationship }) => relationship.friendship && !relationship.family && !relationship.partnership)
    .sort((a, b) => b.relationship.affinity - a.relationship.affinity)
    .slice(0, 2)
    .map(({ candidate }) => candidate.name);
  return { household, partner, parents, children, friends };
};

const stormTarget = (state, mode) => {
  const candidates = state.buildings
    .filter((building) => building.complete && building.kind !== "campfire")
    .filter((building) => mode === "secure" ? !building.stormPrepared : building.stormDamage > 0.02)
    .filter((building) => !state.villagers.some((villager) => ["secure", "repair"].includes(villager.task?.type) && villager.task.targetId === building.id))
    .sort((a, b) => (mode === "repair" ? b.stormDamage - a.stormDamage : Number(a.stormPrepared) - Number(b.stormPrepared)));
  return candidates[0] || null;
};

const assignChildTask = (state, villager) => {
  const household = householdFor(state, villager);
  const parent = household?.members
    .map((id) => state.villagers.find((candidate) => candidate.id === id))
    .find((candidate) => candidate?.lifeStage === "adult");
  if (["warning", "storm", "recovery"].includes(state.majorEvent?.phase)) {
    const safePlace = findRestSite(state, villager);
    if (safePlace && startTask(state, villager, safePlace.kind === "campfire" ? "warm" : "rest", safePlace)) return;
  }
  if (villager.energy < 46 || timePeriod(state.timeOfDay) === "night") {
    const restSite = findRestSite(state, villager);
    if (restSite && startTask(state, villager, timePeriod(state.timeOfDay) === "night" ? "warm" : "rest", restSite)) return;
  }
  if (parent && (villager.social > 58 || chance(state.elapsed + villager.routineOffset) > 0.55) && startTask(state, villager, "social", parent)) return;
  const origin = worldToCell(parent?.x || villager.x, parent?.y || villager.y);
  const offset = [{ x: 1, y: 1 }, { x: -1, y: 1 }, { x: 2, y: -1 }, { x: -2, y: 0 }][Math.floor(chance(state.elapsed + villager.routineOffset) * 4)];
  const playCell = nearestWalkable(state, origin.x + offset.x, origin.y + offset.y);
  startTask(state, villager, "play", { id: `play-${villager.id}-${Math.floor(state.elapsed)}`, x: playCell.x, y: playCell.y });
};

const assignTask = (state, villager) => {
  const counts = assignmentCounts(state);
  if (villager.carrying) {
    if (villager.carrying.purpose === "construction") {
      const foundation = getBuilding(state, villager.carrying.targetId);
      if (foundation?.complete === false && startTask(state, villager, "deliver", foundation, true)) return;
    }
    const storage = findStorage(state, villager);
    if (storage) startTask(state, villager, "return", storage);
    else finishTask(villager, state);
    return;
  }

  const period = timePeriod(state.timeOfDay);
  const raining = state.weather?.type === "rain";
  const night = period === "night";
  const late = period === "sunset" || night;

  // Priority 1: survival. Hunger and exhaustion always interrupt the workday.
  if (villager.hunger < 40 && availableFood(state) > 0) {
    // Inventory food is already shared settlement stock, so a hungry villager
    // should not cross a blocked or crowded settlement just to reach a store.
    // Ground piles still use the normal nearby-storage route below.
    if (state.inventory.food > 0 && startTask(state, villager, "eat", { id: "", worldPoint: { x: villager.x, y: villager.y }, x: villager.x, y: villager.y })) return;
    const storage = findStorage(state, villager);
    if (storage && startTask(state, villager, "eat", storage)) return;
    if (!storage && startTask(state, villager, "eat", { id: "", worldPoint: { x: villager.x, y: villager.y }, x: villager.x, y: villager.y })) return;
  }
  if (villager.energy < 18 || villager.health < 42) {
    const restSite = findRestSite(state, villager);
    if (restSite && startTask(state, villager, "rest", restSite)) return;
  }

  if (villager.lifeStage === "child") {
    assignChildTask(state, villager);
    return;
  }
  if (state.majorEvent?.phase === "warning") {
    const building = stormTarget(state, "secure");
    if (building && startTask(state, villager, "secure", building)) return;
  }
  if (state.majorEvent?.phase === "storm") {
    const safePlace = findRestSite(state, villager);
    if (safePlace && startTask(state, villager, safePlace.kind === "shelter" ? "rest" : "warm", safePlace)) return;
  }
  if (state.majorEvent?.phase === "recovery") {
    const building = stormTarget(state, "repair");
    if (building && startTask(state, villager, "repair", building)) return;
  }
  if (night && villager.energy < 68) {
    const restSite = findRestSite(state, villager);
    if (restSite && startTask(state, villager, "warm", restSite)) return;
  }

  // Priority 2: urgent settlement work. Limit the crowd at each foundation.
  const incomplete = findIncompleteBuilding(state, "", counts);
  if (incomplete) {
    const staged = availableStagedMaterial(incomplete);
    const haulingLimit = state.priorities.hauling >= 2 ? 3 : state.priorities.hauling <= 0 ? 1 : 2;
    const constructionLimit = state.priorities.construction >= 2 ? 3 : state.priorities.construction <= 0 ? 1 : 2;
    const constructionPush = state.priorities.construction >= 2 || villager.role === "Builder" || incomplete.progress > 0.4;
    // A foundation must keep moving at normal priority. Previously, once an
    // initial batch arrived, normal-priority villagers would all return to
    // gathering because `constructionPush` was false until the build was
    // already fairly advanced. That left an otherwise valid foundation
    // silently stalled at the first material gap. Keep one delivery lane open
    // even at low priority, while the existing assignment limit prevents a
    // construction crowd from forming.
    const deliveryLaneOpen = staged && countAssignments(state, incomplete.id, counts) === 0;
    if (staged && (constructionPush || deliveryLaneOpen) && countAssignments(state, incomplete.id, counts) < haulingLimit && startTask(state, villager, "deliver", incomplete)) return;
    if (materialsReady(incomplete) && (constructionPush || state.priorities.construction > 0) && countTaskType(state, "build") < constructionLimit && startTask(state, villager, "build", incomplete)) return;
  }

  const groundPile = chooseGroundPile(state, villager);
  if (groundPile && state.priorities.hauling >= 1 && startTask(state, villager, "haulPile", groundPile)) return;

  // Priority 3: individual work rhythms. Night and heavy rain pull some people home.
  const workWindow = !night && !(raining && villager.restBias > 1.08);
  const workSignal = chance(state.elapsed * 0.47 + villager.routineOffset + state.day * 2.4);
  const routinePush = villager.routine === "early" && (period === "dawn" || period === "sunrise")
    ? 0.12
    : villager.routine === "late" && (period === "sunset" || period === "night")
      ? 0.08
      : villager.routine === "midday" && period === "afternoon" ? 0.08 : 0;
  const workThreshold = clamp(0.31 - (villager.workBias - 1) * 0.22 - routinePush, 0.08, 0.48);
  const shouldWork = workWindow && (workSignal > workThreshold || villager.hunger < 55);
  // The opening stock is intentionally enough to cover a short working
  // window. A 3-per-villager trigger caused all five starters to choose food
  // immediately, filling the small starting store and delaying the first wood
  // and stone decisions. Keep a smaller safety floor so one or two foragers
  // protect the camp while the other villagers establish the material base.
  const foodSafety = availableFood(state) <= Math.max(10, state.villagers.length * 2) || supplyLevel(state, "food") === "critical";
  const resource = foodSafety
    ? chooseResource(state, villager, "food", counts) || chooseWorkResource(state, villager, counts)
    : chooseWorkResource(state, villager, counts);
  const priorityPush = ((state.priorities[resource?.type] || 1) - 1) * 0.14;
  const foodCanUseOverflow = foodSafety && resource?.type === "food";
  if (resource && (storageRoom(state) > 0 || foodCanUseOverflow) && (shouldWork || priorityPush > 0.05 || foodCanUseOverflow)) {
    if (startTask(state, villager, "gather", resource)) return;
  }

  // Priority 4: personal needs before the villager chooses company.
  if (villager.hunger < 48 && availableFood(state) > 0) {
    if (state.inventory.food > 0 && startTask(state, villager, "eat", { id: "", worldPoint: { x: villager.x, y: villager.y }, x: villager.x, y: villager.y })) return;
    const storage = findStorage(state, villager);
    if (storage && startTask(state, villager, "eat", storage)) return;
    if (!storage && startTask(state, villager, "eat", { id: "", worldPoint: true, x: villager.x, y: villager.y })) return;
  }
  if (villager.energy < 48 || late || (raining && villager.restBias > 0.98)) {
    const restSite = findRestSite(state, villager);
    if (restSite && startTask(state, villager, night || raining ? "warm" : "rest", restSite)) return;
  }

  // Priority 5: tiny social lives and low-stakes wandering.
  const socialSignal = chance(state.elapsed * 0.31 + villager.routineOffset * 3.1 + villager.social);
  const partner = chooseSocialPartner(state, villager, counts);
  if (partner && (villager.social > 70 || socialSignal > 0.62)) {
    villager.social = Math.max(0, villager.social - 18);
    if (startTask(state, villager, "social", partner)) return;
  }
  if (late) {
    const restSite = findRestSite(state, villager);
    if (restSite && startTask(state, villager, "warm", restSite)) return;
  }
  startTask(state, villager, "wander", chooseWanderTarget(state, villager));
};

const taskStillValid = (state, villager) => {
  const task = villager.task;
  if (!task) return false;
  if (task.type === "gather") return Boolean(getResource(state, task.targetId)?.amount > 0);
  if (task.type === "deliver") return Boolean(getBuilding(state, task.targetId)?.complete === false && villager.carrying?.purpose === "construction");
  if (task.type === "build") {
    const building = getBuilding(state, task.targetId);
    return Boolean(building?.complete === false && materialsReady(building));
  }
  if (task.type === "secure") return Boolean(getBuilding(state, task.targetId)?.complete && ["warning", "storm"].includes(state.majorEvent?.phase));
  if (task.type === "repair") return Boolean(getBuilding(state, task.targetId)?.complete && (getBuilding(state, task.targetId)?.stormDamage || 0) > 0.02);
  if (task.type === "return" || task.type === "rest") return Boolean(getBuilding(state, task.targetId)?.complete);
  if (task.type === "haulPile") return Boolean(getGroundPile(state, task.targetId)?.amount > 0);
  if (task.type === "eat") return Boolean((!task.targetId || getBuilding(state, task.targetId)?.complete) && availableFood(state) > 0);
  if (task.type === "warm") return Boolean(getBuilding(state, task.targetId)?.complete);
  if (task.type === "social") return Boolean(state.villagers.find((candidate) => candidate.id === task.socialWith && candidate.health > 0));
  if (task.type === "wander" || task.type === "play") return Boolean(task.goal);
  return false;
};

const performTask = (state, villager, dt) => {
  const task = villager.task;
  if (!task) return;
  if (task.type === "gather") {
    const resource = getResource(state, task.targetId);
    if (!resource || resource.amount <= 0) return finishTask(villager, state);
    villager.activity = "gathering";
    villager.activityDetail = `Gathering ${RESOURCE_META[resource.type].label.toLowerCase()}`;
    villager.lastActivity = villager.activityDetail;
    const previousGatherBeat = Math.floor(villager.actionTimer * 1.8);
    villager.actionTimer += dt;
    villager.workTimer += dt;
    if (Math.floor(villager.actionTimer * 1.8) !== previousGatherBeat) {
      addActionEffect(state, "chips", { x: villager.x + Math.cos(villager.facing || 0) * 8, y: villager.y - 7 }, resource.type);
    }
    const meta = RESOURCE_META[resource.type];
    if (villager.workTimer >= resourceWorkTime(state, resource.type, meta.gatherTime)) {
      const room = Math.floor(storageRoom(state));
      // Keep food moving even when wood and stone have filled the stores. The
      // excess becomes a visible ground pile at the hearth, so the economy
      // never silently deadlocks behind a single empty storage slot.
      const foodReserve = resource.type === "food" && state.inventory.food < state.villagers.length * 5;
      const carryRoom = foodReserve ? Math.max(room, meta.bundle) : room;
      const amount = Math.min(meta.bundle, Math.floor(resource.amount), carryRoom);
      if (amount <= 0) {
        villager.activityDetail = "Waiting for storage space";
        villager.lastActivity = villager.activityDetail;
        return finishTask(villager, state);
      }
      const wasAvailable = resource.amount > 0;
      resource.amount -= amount;
      if (resource.amount <= 0) resource.depletedTime = 0;
      if (wasAvailable !== (resource.amount > 0)) invalidateResourcePathCache(state);
      villager.carrying = { type: resource.type, amount };
      addActionEffect(state, "pickup", cellCenter(resource.x, resource.y), resource.type);
      state.totalGathered[resource.type] += amount;
      if (resource.type === "stone") recordDiscoveryWork(state, "stonework", amount * 0.85);
      if (resource.type === "wood") recordDiscoveryWork(state, "woodwork", amount * 0.8);
      if (resource.type === "food") {
        recordDiscoveryWork(state, "seedkeeping", amount * 0.45);
        if (hasCompleteBuilding(state, "dryingRack")) recordDiscoveryWork(state, "preservation", amount * 0.8);
      }
      logEvent(state, `${villager.name} gathered ${amount} ${meta.label.toLowerCase()}.`);
      villager.lastActivity = `Carrying ${amount} ${meta.label.toLowerCase()}`;
      const storage = findStorage(state, villager);
      if (storage) startTask(state, villager, "return", storage);
      else {
        addGroundPile(state, resource.type, amount, { x: villager.x, y: villager.y });
        villager.carrying = null;
        finishTask(villager, state);
      }
    }
    return;
  }
  if (task.type === "return") {
    const storage = getBuilding(state, task.targetId) || findStorage(state, villager);
    if (!storage || !villager.carrying) return finishTask(villager, state);
    villager.activity = "returning";
    villager.activityDetail = `Carrying ${villager.carrying.amount} ${RESOURCE_META[villager.carrying.type].label.toLowerCase()} back to camp`;
    villager.lastActivity = villager.activityDetail;
    const carried = villager.carrying;
    const room = Math.floor(storageRoom(state));
    const deposited = Math.min(room, carried.amount);
    state.inventory[carried.type] += deposited;
    state.settlementGrowth.stockpiles[carried.type] = clamp((state.settlementGrowth.stockpiles[carried.type] || 0) + deposited * 0.56, 0, 32);
    addActionEffect(state, "deposit", cellCenter(storage.x + storage.footprint.w / 2 - 0.5, storage.y + storage.footprint.h / 2 - 0.5), carried.type);
    const leftover = carried.amount - deposited;
    villager.carrying = null;
    if (leftover > 0) {
      addGroundPile(state, carried.type, leftover, cellCenter(storage.x, storage.y));
      logEvent(state, `${villager.name} left ${leftover} ${RESOURCE_META[carried.type].label.toLowerCase()} beside full stores.`);
    } else {
      logEvent(state, `${villager.name} returned ${deposited} ${RESOURCE_META[carried.type].label.toLowerCase()} to camp.`);
    }
    recordDiscoveryWork(state, "hauling", Math.max(0.7, deposited * 0.28));
    finishTask(villager, state);
    return;
  }
  if (task.type === "haulPile") {
    const pile = getGroundPile(state, task.targetId);
    if (!pile || pile.amount <= 0) return finishTask(villager, state);
    const amount = Math.min(pile.amount, 4, Math.floor(storageRoom(state)));
    if (amount <= 0) return finishTask(villager, state);
    pile.amount -= amount;
    villager.carrying = { type: pile.type, amount, purpose: "ground-pile" };
    addActionEffect(state, "pickup", { x: pile.x, y: pile.y }, pile.type);
    villager.activity = "hauling";
    villager.activityDetail = `Carrying ${amount} ${RESOURCE_META[pile.type].label.toLowerCase()} from a ground pile`;
    villager.lastActivity = villager.activityDetail;
    const storage = findStorage(state, villager);
    if (storage) startTask(state, villager, "return", storage);
    else finishTask(villager, state);
    return;
  }
  if (task.type === "deliver") {
    const building = getBuilding(state, task.targetId);
    if (!building || !villager.carrying) return finishTask(villager, state);
    const material = villager.carrying.type;
    villager.activity = "hauling";
    villager.activityDetail = `Carrying ${villager.carrying.amount} ${RESOURCE_META[material].label.toLowerCase()} to the ${BUILDINGS[building.kind].name.toLowerCase()}`;
    villager.lastActivity = villager.activityDetail;
    building.materials[material] += villager.carrying.amount;
    addActionEffect(state, "deposit", cellCenter(building.x + building.footprint.w / 2 - 0.5, building.y + building.footprint.h / 2 - 0.5), material);
    villager.carrying = null;
    state.settlementGrowth.work.construction = clamp(state.settlementGrowth.work.construction + 0.018, 0, 1);
    updateBuildingStage(building);
    recordDiscoveryWork(state, "hauling", 1.1);
    logEvent(state, `${villager.name} carried ${RESOURCE_META[material].label.toLowerCase()} to the ${building.name.toLowerCase()}.`);
    finishTask(villager, state);
    return;
  }
  if (task.type === "secure") {
    const building = getBuilding(state, task.targetId);
    if (!building || !state.majorEvent || !["warning", "storm"].includes(state.majorEvent.phase)) return finishTask(villager, state);
    villager.activity = "securing";
    villager.activityDetail = `Bracing the ${building.name.toLowerCase()}`;
    villager.lastActivity = villager.activityDetail;
    const previousSecureBeat = Math.floor(villager.actionTimer * 2.1);
    villager.actionTimer += dt;
    if (Math.floor(villager.actionTimer * 2.1) !== previousSecureBeat) {
      addActionEffect(state, "construction", cellCenter(building.x + building.footprint.w / 2 - 0.5, building.y + building.footprint.h / 2 - 0.5), "wood");
    }
    if (villager.actionTimer > 2.8) {
      building.stormPrepared = true;
      if (!state.majorEvent.securedBuildingIds.includes(building.id)) state.majorEvent.securedBuildingIds.push(building.id);
      logEvent(state, `${villager.name} braced the ${building.name.toLowerCase()} against the storm.`);
      finishTask(villager, state);
    }
    return;
  }
  if (task.type === "repair") {
    const building = getBuilding(state, task.targetId);
    if (!building || building.stormDamage <= 0.02) return finishTask(villager, state);
    villager.activity = "repairing";
    villager.activityDetail = `Repairing the ${building.name.toLowerCase()}`;
    villager.lastActivity = villager.activityDetail;
    const previousRepairBeat = Math.floor(villager.actionTimer * 2.1);
    villager.actionTimer += dt;
    if (Math.floor(villager.actionTimer * 2.1) !== previousRepairBeat) {
      addActionEffect(state, "construction", cellCenter(building.x + building.footprint.w / 2 - 0.5, building.y + building.footprint.h / 2 - 0.5), "wood");
    }
    building.stormDamage = Math.max(0, building.stormDamage - dt * 0.055);
    recordDiscoveryWork(state, "woodwork", dt * 0.35);
    if (building.stormDamage <= 0.02 || villager.actionTimer > 7) {
      building.stormDamage = 0;
      logEvent(state, `${villager.name} finished repairing the ${building.name.toLowerCase()}.`);
      finishTask(villager, state);
    }
    return;
  }
  if (task.type === "build") {
    const building = getBuilding(state, task.targetId);
    if (!building || !materialsReady(building)) return finishTask(villager, state);
    villager.activity = "building";
    villager.activityDetail = `Building ${BUILDINGS[building.kind].name.toLowerCase()}`;
    villager.lastActivity = villager.activityDetail;
    const previousBuildBeat = Math.floor(villager.actionTimer * 2.4);
    villager.actionTimer += dt;
    villager.workTimer += dt;
    if (Math.floor(villager.actionTimer * 2.4) !== previousBuildBeat) {
      const cost = BUILDINGS[building.kind].cost;
      building.consumed.wood = clamp((building.consumed.wood || 0) + (cost.wood ? Math.max(0.08, cost.wood / 18) : 0), 0, cost.wood);
      building.consumed.stone = clamp((building.consumed.stone || 0) + (cost.stone ? Math.max(0.08, cost.stone / 18) : 0), 0, cost.stone);
      addActionEffect(state, "construction", cellCenter(building.x + building.footprint.w / 2 - 0.5, building.y + building.footprint.h / 2 - 0.5), building.kind);
    }
    building.progress = clamp(building.progress + dt / Math.max(1, building.buildTime), 0, 1);
    updateBuildingStage(building);
    if (building.progress >= 1) {
      building.complete = true;
      building.stage = "complete";
      building.settledAt = state.elapsed;
      building.occupation = Math.max(Number(building.occupation) || 0, 0.2);
      building.visualTier = 1;
      building.materials = cloneCost(BUILDINGS[building.kind].cost);
      building.consumed = cloneCost(BUILDINGS[building.kind].cost);
      building.completionPulse = 1;
      const center = cellCenter(building.x + building.footprint.w / 2 - 0.5, building.y + building.footprint.h / 2 - 0.5);
      state.effects.push({ type: "completion", x: center.x, y: center.y, life: 0, kind: building.kind });
      recordDiscoveryWork(state, "woodwork", 2.5);
      if (building.kind === "storage") recordDiscoveryWork(state, "hauling", 7);
      if (building.kind === "dryingRack") recordDiscoveryWork(state, "preservation", 8);
      if (building.kind === "shelter") recordDiscoveryWork(state, "shelter", 8);
      if (building.kind === "woodcutterArea") recordDiscoveryWork(state, "woodwork", 6);
      if (building.kind === "stoneSite") recordDiscoveryWork(state, "stonework", 6);
      if (building.kind === "berryStand") recordDiscoveryWork(state, "seedkeeping", 6);
      logEvent(state, `The ${building.name.toLowerCase()} is ready for the camp.`);
      finishTask(villager, state);
    }
    return;
  }
  if (task.type === "eat") {
    villager.activity = "eating";
    villager.activityDetail = "Eating";
    villager.lastActivity = "Eating";
    villager.actionTimer += dt;
    villager.workTimer += dt;
    if (villager.workTimer >= 1.25) {
      if (villager.workTimer - dt < 1.25) addActionEffect(state, "eat", { x: villager.x, y: villager.y - 10 }, "food");
      if (!consumeFood(state, getBuilding(state, task.targetId), villager)) return finishTask(villager, state);
      state.settlementGrowth.stockpiles.food = Math.max(0, (state.settlementGrowth.stockpiles.food || 0) - 0.42);
      villager.hunger = clamp(villager.hunger + 48, 0, 100);
      villager.energy = clamp(villager.energy + 6, 0, 100);
      recordDiscoveryWork(state, "hearth", 1.2);
      logEvent(state, `${villager.name} stopped for a meal by the fire.`);
      finishTask(villager, state);
    }
    return;
  }
  if (task.type === "rest") {
    villager.activity = "resting";
    villager.activityDetail = "Resting";
    villager.lastActivity = "Resting";
    villager.actionTimer += dt;
    const site = getBuilding(state, task.targetId);
    const recovery = site?.kind === "shelter"
      ? (hasDiscovery(state, "improved-shelter") ? 24 : 19)
      : site?.kind === "well" ? 17 : 14;
    villager.energy = clamp(villager.energy + dt * recovery, 0, 100);
    if (site?.kind === "shelter") recordDiscoveryWork(state, "shelter", dt * 0.8);
    if (state.weather?.type === "rain" || timePeriod(state.timeOfDay) === "night") recordDiscoveryWork(state, "weatherwise", dt * 0.32);
    if (site?.kind === "well") villager.health = clamp(villager.health + dt * 0.22, 0, 100);
    if (villager.energy >= 78) finishTask(villager, state);
    return;
  }
  if (task.type === "warm") {
    villager.activity = "warming";
    villager.activityDetail = "Resting by the fire";
    villager.lastActivity = "Resting by the fire";
    const previousWarmBeat = Math.floor(villager.actionTimer * 0.75);
    villager.actionTimer += dt;
    if (Math.floor(villager.actionTimer * 0.75) !== previousWarmBeat) addActionEffect(state, "ember", { x: villager.x + Math.cos(villager.facing || 0) * 8, y: villager.y - 11 }, "fire");
    const warmth = hasDiscovery(state, "ember-keeping") ? 12.5 : 10;
    villager.energy = clamp(villager.energy + dt * warmth, 0, 100);
    villager.weatherMood = clamp(villager.weatherMood + dt * (hasDiscovery(state, "woven-coverings") ? 12 : 10), 0, 100);
    villager.social = clamp(villager.social + dt * 0.4, 0, 100);
    recordDiscoveryWork(state, "hearth", dt * 0.9);
    if (state.weather?.type === "rain" || timePeriod(state.timeOfDay) === "night") recordDiscoveryWork(state, "weatherwise", dt * 0.42);
    if (villager.energy >= 74 && villager.actionTimer > 2.8) finishTask(villager, state);
    return;
  }
  if (task.type === "social") {
    const partner = state.villagers.find((candidate) => candidate.id === task.socialWith);
    villager.activity = "socializing";
    villager.activityDetail = partner ? `Talking with ${partner.name}` : "Sharing a quiet moment";
    villager.lastActivity = villager.activityDetail;
    villager.actionTimer += dt;
    villager.mood = clamp(villager.mood + dt * 2.2, 0, 100);
    if (partner) {
      partner.mood = clamp(partner.mood + dt * 0.8, 0, 100);
      partner.social = clamp(partner.social - dt * 0.6, 0, 100);
    }
    if (villager.actionTimer > 4.2) {
      logEvent(state, `${villager.name} shared a quiet word with ${partner?.name || "the camp"}.`);
      finishTask(villager, state);
    }
    return;
  }
  if (task.type === "play") {
    villager.activity = "playing";
    villager.activityDetail = "Playing near home";
    villager.lastActivity = villager.activityDetail;
    villager.actionTimer += dt;
    villager.mood = clamp(villager.mood + dt * 1.8, 0, 100);
    villager.social = clamp(villager.social - dt * 0.7, 0, 100);
    if (villager.actionTimer > 3.2) finishTask(villager, state);
    return;
  }
  if (task.type === "wander") {
    villager.activity = "wandering";
    villager.activityDetail = "Wandering through the clearing";
    villager.lastActivity = villager.activityDetail;
    villager.actionTimer += dt;
    if (villager.actionTimer > 2.4) finishTask(villager, state);
  }
};

const chooseThought = (state, villager) => {
  const weatherLine = weatherThought(state, villager);
  if (weatherLine && chance(state.elapsed * 0.2 + villager.routineOffset) > 0.55) return weatherLine;
  const thoughts = {
    gathering: ["These should be enough for tonight.", "The wilds are generous today."],
    hauling: ["Careful now.", "The camp is counting on this."],
    building: ["A roof will change everything.", "This will stand before dusk."],
    eating: ["That is much better.", "I had not noticed how hungry I was."],
    resting: ["A little quiet is good.", "My legs will carry me farther soon."],
    warming: ["The fire knows how to make a day feel smaller.", "I could stay here a while."],
    socializing: ["It is good not to be alone out here.", "We should remember this evening."],
    wandering: ["There is always something new in the grass.", "I wonder what lives beyond the ridge."],
    idle: ["The camp is beginning to feel like ours.", "I wonder what we will make next."]
  };
  const list = thoughts[villager.activity] || thoughts.idle;
  return list[Math.floor(chance(state.elapsed + villager.routineOffset * 4) * list.length)];
};

const updateVillager = (state, villager, dt, villagerSpatialIndex) => {
  villager.resourceDiscoveryCooldown = Math.max(0, (Number(villager.resourceDiscoveryCooldown) || 0) - dt);
  if (villager.resourceDiscoveryCooldown <= 0) {
    discoverNearbyResources(state, villager);
    villager.resourceDiscoveryCooldown = 0.85 + chance(state.elapsed + villager.routineOffset * 2.7) * 1.35;
  }
  villager.hunger = clamp(villager.hunger - dt * 0.55, 0, 100);
  villager.energy = clamp(villager.energy - dt * 0.24, 0, 100);
  villager.social = clamp(villager.social + dt * (0.28 + villager.socialNeed * 0.36), 0, 100);
  const stormMood = state.majorEvent?.phase === "storm" ? -dt * 0.2 : state.weather?.type === "rain" ? -dt * 0.08 : dt * 0.12;
  villager.weatherMood = clamp(villager.weatherMood + stormMood, 0, 100);
  if (villager.hunger < 8) villager.health = clamp(villager.health - dt * 1.4, 0, 100);
  if (villager.energy < 6) villager.health = clamp(villager.health - dt * 0.8, 0, 100);
  if (villager.hunger > 42 && villager.energy > 42) villager.health = clamp(villager.health + dt * 0.05, 0, 100);
  villager.mood = clamp((villager.hunger * 0.26) + (villager.energy * 0.26) + (villager.health * 0.28) + (100 - villager.social) * 0.1 + villager.weatherMood * 0.1, 0, 100);
  villager.selectedPulse += dt;
  villager.walkPhase += dt * 4;
  villager.thoughtTimer -= dt;
  villager.decisionCooldown = Math.max(0, villager.decisionCooldown - dt);
  villager.pathReplanCooldown = Math.max(0, (Number(villager.pathReplanCooldown) || 0) - dt);
  if (villager.thoughtTimer <= 0) {
    villager.thought = chooseThought(state, villager);
    villager.thoughtTimer = 4.2 + chance(state.elapsed + villager.routineOffset) * 4.5;
  }

  if (villager.task && !taskStillValid(state, villager)) {
    finishTask(villager, state);
    villager.decisionCooldown = 0.25 + chance(state.elapsed + villager.routineOffset) * 0.9;
  }

  // Needs are interruptible while a villager is working. Previously a stone
  // or wood job could keep running until its timer completed, even with food
  // in the stores and hunger already damaging health.
  const activeTask = villager.task?.type;
  const activeResource = villager.task?.type === "gather" ? getResource(state, villager.task.targetId) : null;
  const urgentFood = villager.hunger < 40 && availableFood(state) > 0;
  const foodDetour = villager.hunger < 30 && activeResource?.type !== "food" && chooseResource(state, villager, "food");
  const urgentRest = villager.energy < 18 || villager.health < 42;
  const interruptible = ["gather", "build", "secure", "repair", "wander", "social", "play", "haulPile", "rest", "warm"].includes(activeTask);
  if (!villager.carrying && villager.task && interruptible && ((urgentFood || foodDetour) || urgentRest)) {
    finishTask(villager, state);
    villager.decisionCooldown = 0;
  }

  const phase = timePeriod(state.timeOfDay);
  const nightNeedsRest = phase === "night" && villager.energy < 72 && !villager.carrying;
  if (villager.task && nightNeedsRest && ["gather", "build", "wander", "social"].includes(villager.task.type)) {
    finishTask(villager, state);
    villager.decisionCooldown = 0;
  }

  if (!villager.task && villager.decisionCooldown <= 0) {
    assignTask(state, villager);
  } else if (!villager.task) {
    villager.activity = "idle";
    villager.activityDetail = "Watching the camp";
    villager.lastActivity = villager.activityDetail;
  }

  if (villager.pathIndex < villager.path.length) {
    const nextCell = villager.path[villager.pathIndex];
    const target = cellCenter(nextCell.x, nextCell.y);
    const dx = target.x - villager.x;
    const dy = target.y - villager.y;
    const length = Math.hypot(dx, dy) || 1;
    const speed = villager.activity === "returning" || villager.activity === "hauling" ? 43 : 37;
    const step = Math.min(length, speed * dt);
    const beforeX = villager.x;
    const beforeY = villager.y;
    villager.x += dx / length * step;
    villager.y += dy / length * step;
    const movementX = villager.x;
    const movementY = villager.y;
    nearbySpatialEntities(villagerSpatialIndex, villager, 22).forEach((other) => {
      if (other.id === villager.id) return;
      const separationX = villager.x - other.x;
      const separationY = villager.y - other.y;
      const separation = Math.hypot(separationX, separationY);
      if (separation > 0 && separation < 22) {
        const nudge = (22 - separation) / 22 * 7 * dt;
        villager.x += separationX / separation * nudge;
        villager.y += separationY / separation * nudge;
      }
    });
    const movementCell = worldToCell(villager.x, villager.y);
    const beforeCell = worldToCell(beforeX, beforeY);
    const movementIgnoreBuilding = villager.task?.type === "build" ? villager.task.targetId : "";
    if (!isWalkable(state, movementCell.x, movementCell.y, movementIgnoreBuilding)) {
      // Separation is cosmetic; it must never push a villager through a
      // structure or into water. Let the normal stuck/replan recovery handle
      // the crowded frame instead.
      const taskCell = worldToCell(movementX, movementY);
      if (!isWalkable(state, beforeCell.x, beforeCell.y, movementIgnoreBuilding)) {
        // A newly spawned villager may already be standing on the hearth cell;
        // allow the primary task movement to carry them out of it.
        villager.x = movementX;
        villager.y = movementY;
      } else if (isWalkable(state, taskCell.x, taskCell.y, movementIgnoreBuilding)) {
        villager.x = movementX;
        villager.y = movementY;
      } else {
        villager.x = beforeX;
        villager.y = beforeY;
      }
    }
    villager.facing = Math.atan2(dy, dx);
    villager.activity = villager.task?.type === "return" ? "returning" : ["deliver", "haulPile"].includes(villager.task?.type) ? "hauling" : "walking";
    if (villager.task?.type === "social") villager.activity = "socializing";
    if (villager.task?.type === "warm") villager.activity = "warming";
    if (villager.task?.type === "wander") villager.activity = "wandering";
    if (villager.task?.type === "play") villager.activity = "playing";
    villager.lastActivity = villager.activityDetail || formatActivity(villager.activity);
    if (Math.hypot(villager.x - beforeX, villager.y - beforeY) < 0.3) villager.stuckTime += dt;
    else villager.stuckTime = Math.max(0, villager.stuckTime - dt * 2);
    if (Math.hypot(villager.x - beforeX, villager.y - beforeY) > 0.2) markTrail(state, villager.x, villager.y, dt * 0.018);
    if (villager.stuckTime > 1.35 && villager.pathReplanCooldown <= 0) {
      const target = taskTargetPoint(state, villager);
      const nextPath = target ? findPath(state, villager, target, villager.task?.type === "build" ? villager.task.targetId : "") : [];
      if (target && !nextPath.length && distance(villager, target) > WORLD.cell * 1.2) {
        // Release a job that has become unreachable instead of performing it
        // in place or recalculating the same impossible route forever.
        finishTask(villager, state);
        villager.decisionCooldown = 1.2;
      } else {
        if (state.aiMetrics) state.aiMetrics.pathReplans = (state.aiMetrics.pathReplans || 0) + 1;
        villager.path = nextPath;
        villager.pathIndex = 0;
        villager.stuckTime = 0;
        villager.decisionCooldown = 0.45;
        villager.pathReplanCooldown = 1.2;
      }
    }
    if (length < 4) villager.pathIndex += 1;
    return;
  }
  performTask(state, villager, dt);
};

const animalSpec = (animal) => ANIMAL_SPECIES[animal.species] || ANIMAL_SPECIES.mosshare;

const animalHabitatTarget = (state, animal, mode = "wander", cache = null) => {
  const species = animalSpec(animal);
  const origin = worldToCell(animal.x, animal.y);
  const cacheKey = `${animal.species}|${mode}|${origin.x}|${origin.y}|${state.day}|${Math.floor((animal.routineOffset || 0) * 0.3)}`;
  if (cache?.has(cacheKey)) return { ...cache.get(cacheKey) };
  let best = null;
  for (let y = 1; y < WORLD.rows - 1; y += 1) {
    for (let x = 1; x < WORLD.cols - 1; x += 1) {
      if (!animalHabitatCell(state.map, species, x, y) || !isWalkable(state, x, y)) continue;
      const awayFromCamp = Math.hypot(x - 16, (y - 12) * 1.05);
      const distanceFromAnimal = Math.hypot(x - origin.x, y - origin.y);
      const water = adjacentWater(state.map, x, y, 1);
      const food = nearbyResource(state.map, x, y, "food", 4);
      if (mode === "drink" && !water) continue;
      if (mode === "pollinate" && !food) continue;
      let score = awayFromCamp * 2.4 - distanceFromAnimal * 0.12 + chance(x * 13.7 + y * 31.1 + animal.routineOffset + state.day * 2.1) * 7;
      if (species.waterLoving) score += water ? 18 : -22;
      if (species.pollinator) score += food ? 22 : -18;
      if (mode === "rest") score += awayFromCamp * 0.8;
      if (!best || score > best.score) best = { x, y, score };
    }
  }
  const result = best || nearestWalkable(state, origin.x, origin.y);
  cache?.set(cacheKey, result);
  return { ...result };
};

const animalFleeTarget = (state, animal, villager) => {
  const from = worldToCell(animal.x, animal.y);
  const dx = animal.x - villager.x;
  const dy = animal.y - villager.y;
  const length = Math.hypot(dx, dy) || 1;
  const distanceInCells = animalSpec(animal).dangerous ? 4.5 : 3.4;
  return nearestWalkable(state, from.x + dx / length * distanceInCells, from.y + dy / length * distanceInCells);
};

const nearestAnimalThreat = (state, animal, villagerSpatialIndex) => {
  let nearest = null;
  nearbySpatialEntities(villagerSpatialIndex, animal, 220).forEach((villager) => {
    if (villager.health <= 0) return;
    const candidateDistance = distance(animal, villager);
    if (!nearest || candidateDistance < nearest.distance) nearest = { villager, distance: candidateDistance };
  });
  return nearest;
};

const setAnimalPresentation = (animal, type, target) => {
  const species = animalSpec(animal);
  const descriptions = {
    wander: species.pollinator ? "Drifting between wildflowers" : species.waterLoving ? "Following the creek edge" : "Wandering the wild edge",
    graze: "Browsing in the grass",
    drink: "Drinking at the water's edge",
    rest: "Resting in the grass",
    flee: "Startled and fleeing",
    pollinate: "Pollinating berry patches",
    charge: `Defending its space${target?.name ? ` from ${target.name}` : ""}`
  };
  animal.activityDetail = descriptions[type] || "Wandering the wild edge";
  animal.lastActivity = animal.activityDetail;
  animal.activity = type === "wander" || type === "graze" ? "wandering" : type === "rest" ? "resting" : type === "drink" ? "drinking" : type === "flee" ? "fleeing" : type === "pollinate" ? "pollinating" : "charging";
};

const startAnimalTask = (state, animal, type, target, targetEntity = null) => {
  if (!target) return false;
  const targetPoint = target.x !== undefined && target.y !== undefined && target.x < WORLD.cols && target.y < WORLD.rows
    ? cellCenter(target.x, target.y)
    : target;
  animal.task = { type, goal: targetPoint, targetId: targetEntity?.id || target?.id || "", targetEntityId: targetEntity?.id || "" };
  animal.path = findPath(state, animal, targetPoint);
  animal.pathIndex = 0;
  animal.actionTimer = 0;
  animal.stuckTime = 0;
  setAnimalPresentation(animal, type, targetEntity);
  return true;
};

const finishAnimalTask = (animal) => {
  animal.task = null;
  animal.path = [];
  animal.pathIndex = 0;
  animal.actionTimer = 0;
  animal.decisionCooldown = 0.8 + (Number(animal.routineOffset) || 0) * 0.08;
};

const animalTaskValid = (state, animal) => {
  const task = animal.task;
  if (!task) return true;
  if (task.type === "pollinate") return Boolean(getResource(state, task.targetId)?.amount > 0);
  if (task.type === "charge") return Boolean(state.villagers.find((villager) => villager.id === task.targetEntityId && villager.health > 0));
  return true;
};

const performAnimalTask = (state, animal, dt) => {
  const task = animal.task;
  if (!task) return;
  const species = animalSpec(animal);
  animal.actionTimer += dt;
  if (task.type === "drink") {
    animal.activity = "drinking";
    animal.activityDetail = "Drinking at the water's edge";
    animal.lastActivity = animal.activityDetail;
    animal.thirst = clamp(animal.thirst - dt * 16, 0, 100);
    animal.energy = clamp(animal.energy + dt * 2, 0, 100);
    if (animal.thirst <= 12 || animal.actionTimer > 4) finishAnimalTask(animal);
    return;
  }
  if (task.type === "rest") {
    animal.activity = "resting";
    animal.activityDetail = "Resting in the grass";
    animal.lastActivity = animal.activityDetail;
    animal.energy = clamp(animal.energy + dt * (species.waterLoving ? 7 : 9), 0, 100);
    if (animal.energy >= 82 || animal.actionTimer > 7) finishAnimalTask(animal);
    return;
  }
  if (task.type === "pollinate") {
    const resource = getResource(state, task.targetId);
    animal.activity = "pollinating";
    animal.activityDetail = "Pollinating berry patches";
    animal.lastActivity = animal.activityDetail;
    if (resource) resource.pollination = Math.max(Number(resource.pollination) || 0, 1.4);
    if (animal.actionTimer > 3.2) finishAnimalTask(animal);
    return;
  }
  if (task.type === "charge") {
    const villager = state.villagers.find((candidate) => candidate.id === task.targetEntityId);
    animal.activity = "charging";
    animal.activityDetail = `Defending its space${villager ? ` from ${villager.name}` : ""}`;
    animal.lastActivity = animal.activityDetail;
    recordDiscoveryWork(state, "watch", dt * 1.4);
    if (!villager || villager.health <= 0) return finishAnimalTask(animal);
    if (distance(animal, villager) < 29) {
      villager.health = clamp(villager.health - (hasDiscovery(state, "camp-watch") ? 4 : 8), 0, 100);
      villager.stuckTime = 0;
      if (villager.task) villager.decisionCooldown = 0;
      if (state.elapsed - animal.lastThreatAt > 10) logEvent(state, `A brush boar charged ${villager.name}; the camp gives it a wide berth.`);
      animal.lastThreatAt = state.elapsed;
      animal.threatCooldown = 7;
      finishAnimalTask(animal);
    } else if (animal.actionTimer > 3.5) finishAnimalTask(animal);
    return;
  }
  if (task.type === "flee") {
    animal.activity = "fleeing";
    animal.activityDetail = "Startled and fleeing";
    animal.lastActivity = animal.activityDetail;
    if (animal.actionTimer > 3.4) finishAnimalTask(animal);
    return;
  }
  animal.activity = "wandering";
  animal.activityDetail = species.pollinator ? "Drifting between wildflowers" : species.waterLoving ? "Following the creek edge" : task.type === "graze" ? "Browsing in the grass" : "Wandering the wild edge";
  animal.lastActivity = animal.activityDetail;
  if (animal.actionTimer > (task.type === "graze" ? 3.1 : 4.8)) finishAnimalTask(animal);
};

const assignAnimalTask = (state, animal, habitatCache) => {
  const species = animalSpec(animal);
  if (animal.thirst > 70 && species.waterSeeking) {
    const water = animalHabitatTarget(state, animal, "drink", habitatCache);
    if (startAnimalTask(state, animal, "drink", water)) return;
  }
  if (animal.energy < species.restThreshold) {
    const rest = animalHabitatTarget(state, animal, "rest", habitatCache);
    if (startAnimalTask(state, animal, "rest", rest)) return;
  }
  if (species.pollinator) {
    const food = state.map.resources
      .filter((resource) => resource.type === "food" && resource.amount > 0)
      .sort((a, b) => {
        const aScore = distance(animal, cellCenter(a.x, a.y)) * 0.22 + (a.pollination || 0) * 42 + chance(a.x * 3.7 + a.y * 9.1 + animal.routineOffset) * 38;
        const bScore = distance(animal, cellCenter(b.x, b.y)) * 0.22 + (b.pollination || 0) * 42 + chance(b.x * 3.7 + b.y * 9.1 + animal.routineOffset) * 38;
        return aScore - bScore;
      })[0];
    if (food && startAnimalTask(state, animal, "pollinate", nearestWalkable(state, food.x, food.y), food)) return;
  }
  const target = animalHabitatTarget(state, animal, "wander", habitatCache);
  startAnimalTask(state, animal, species.habitat.includes("meadow") && !species.waterLoving ? "graze" : "wander", target);
};

const updateAnimal = (state, animal, dt, animalSpatialIndex, villagerSpatialIndex, habitatCache) => {
  const species = animalSpec(animal);
  animal.thirst = clamp(animal.thirst + dt * (species.pollinator ? 0.14 : 0.2), 0, 100);
  animal.energy = clamp(animal.energy - dt * (animal.activity === "resting" ? 0.03 : 0.12), 0, 100);
  animal.decisionCooldown = Math.max(0, animal.decisionCooldown - dt);
  animal.threatCooldown = Math.max(0, animal.threatCooldown - dt);
  animal.threatCheckCooldown = Math.max(0, (Number(animal.threatCheckCooldown) || 0) - dt);
  const threat = animal.threatCheckCooldown <= 0 ? nearestAnimalThreat(state, animal, villagerSpatialIndex) : null;
  if (animal.threatCheckCooldown <= 0) animal.threatCheckCooldown = 0.45 + (Number(animal.routineOffset) || 0) % 0.7;
  const alertRadius = species.fleeRadius * (hasDiscovery(state, "camp-watch") ? 1.12 : 1);
  const dangerRadius = species.threatRadius * (hasDiscovery(state, "camp-watch") ? 1.18 : 1);
  if (threat && threat.distance < alertRadius && !["flee", "charge"].includes(animal.task?.type)) {
    if (species.dangerous && threat.distance < dangerRadius && animal.threatCooldown <= 0 && state.elapsed - animal.lastThreatAt > 8) {
      startAnimalTask(state, animal, "charge", { x: threat.villager.x, y: threat.villager.y }, threat.villager);
      if (state.elapsed - animal.lastThreatAt > 20) logEvent(state, "Something heavy is rooting beyond the clearing.");
    } else {
      startAnimalTask(state, animal, "flee", animalFleeTarget(state, animal, threat.villager));
    }
  }
  if (animal.task && !animalTaskValid(state, animal)) finishAnimalTask(animal);
  if (!animal.task && animal.decisionCooldown <= 0) assignAnimalTask(state, animal, habitatCache);

  if (animal.task?.type === "charge") {
    const villager = state.villagers.find((candidate) => candidate.id === animal.task.targetEntityId);
    if (villager && animal.pathIndex >= animal.path.length && distance(animal, villager) > 29 && animal.actionTimer < 2.8) {
      animal.path = findPath(state, animal, villager);
      animal.pathIndex = 0;
    }
  }
  if (animal.pathIndex < animal.path.length) {
    const nextCell = animal.path[animal.pathIndex];
    const chargeTarget = animal.task?.type === "charge"
      ? state.villagers.find((villager) => villager.id === animal.task.targetEntityId)
      : null;
    const target = chargeTarget || cellCenter(nextCell.x, nextCell.y);
    const dx = target.x - animal.x;
    const dy = target.y - animal.y;
    const length = Math.hypot(dx, dy) || 1;
    const fleeing = ["flee", "charge"].includes(animal.task?.type);
    const step = Math.min(length, species.speed * (fleeing ? 1.32 : 1) * dt);
    const beforeX = animal.x;
    const beforeY = animal.y;
    animal.x += dx / length * step;
    animal.y += dy / length * step;
    nearbySpatialEntities(animalSpatialIndex, animal, 24).forEach((other) => {
      if (other.id === animal.id) return;
      const separationX = animal.x - other.x;
      const separationY = animal.y - other.y;
      const separation = Math.hypot(separationX, separationY);
      const minimum = (species.size + animalSpec(other).size) * 7;
      if (separation > 0 && separation < minimum) {
        const nudge = (minimum - separation) / minimum * 4.5 * dt;
        animal.x += separationX / separation * nudge;
        animal.y += separationY / separation * nudge;
      }
    });
    animal.facing = dx >= 0 ? 1 : -1;
    if (animal.task?.type === "drink") animal.activityDetail = "Heading to the water's edge";
    if (animal.task?.type === "pollinate") animal.activityDetail = "Flying toward berry patches";
    if (animal.task?.type === "rest") animal.activityDetail = "Finding a quiet patch of grass";
    animal.lastActivity = animal.activityDetail;
    if (Math.hypot(animal.x - beforeX, animal.y - beforeY) < 0.3) animal.stuckTime += dt;
    else animal.stuckTime = Math.max(0, animal.stuckTime - dt * 2);
    if (animal.stuckTime > 1.8) {
      const targetPoint = animal.task?.type === "charge" ? state.villagers.find((villager) => villager.id === animal.task.targetEntityId) : animal.task?.goal;
      if (targetPoint) animal.path = findPath(state, animal, targetPoint);
      animal.pathIndex = 0;
      animal.stuckTime = 0;
    }
    if (length < 4) animal.pathIndex += 1;
    return;
  }
  performAnimalTask(state, animal, dt);
};

const updateAnimals = (state, dt) => {
  const animalSpatialIndex = buildSpatialIndex(state.animals);
  const villagerSpatialIndex = buildSpatialIndex(state.villagers);
  const habitatCache = new Map();
  state.animals.forEach((animal) => updateAnimal(state, animal, dt, animalSpatialIndex, villagerSpatialIndex, habitatCache));
};

const regenerateResources = (state, dt) => {
  state.map.resources.forEach((resource) => {
    resource.pollination = Math.max(0, (Number(resource.pollination) || 0) - dt * 0.08);
    if (!resource.regrowth || resource.amount >= resource.max) return;
    if (resource.amount <= 0) resource.depletedTime = (resource.depletedTime || 0) + dt;
    if (resource.amount > 0 || resource.depletedTime > 8) {
      const weatherBonus = state.weather?.type === "rain" ? 1.35 : 1;
      const seedkeepingBonus = resource.type === "food" && hasDiscovery(state, "seedkeeping") ? 1.18 : 1;
      const pollinationBonus = resource.type === "food" ? 1 + Math.min(0.28, resource.pollination * 0.12) : 1;
      const wasAvailable = resource.amount > 0;
      resource.amount = clamp(resource.amount + resource.regrowth * dt * weatherBonus * pollinationBonus * seedkeepingBonus, 0, resource.max);
      if (wasAvailable !== (resource.amount > 0)) invalidateResourcePathCache(state);
    }
  });
  state.groundPiles = state.groundPiles.filter((pile) => pile.amount > 0);
};

const waterNearby = (state, x, y, footprint, radius) => {
  for (let yy = y - radius; yy < y + footprint.h + radius; yy += 1) {
    for (let xx = x - radius; xx < x + footprint.w + radius; xx += 1) {
      if (state.map.grid[yy]?.[xx]?.terrain === "water") return true;
    }
  }
  return false;
};

export const placementCheck = (state, kind, x, y, rotation = state.buildRotation || 0) => {
  const def = BUILDINGS[kind];
  if (!def) return { ok: false, reason: "Unknown structure" };
  const footprint = footprintFor(kind, rotation);
  const missing = [];
  if (def.cost.wood > state.inventory.wood) missing.push(`${def.cost.wood - state.inventory.wood} wood`);
  if (def.cost.stone > state.inventory.stone) missing.push(`${def.cost.stone - state.inventory.stone} stone`);
  if (missing.length) return { ok: false, reason: `Need ${missing.join(" and ")}`, footprint, rotation };
  if (x < 1 || y < 1 || x + footprint.w >= WORLD.cols - 1 || y + footprint.h >= WORLD.rows - 1) return { ok: false, reason: "Keep the foundation away from the map edge", footprint, rotation };
  for (let yy = 0; yy < footprint.h; yy += 1) {
    for (let xx = 0; xx < footprint.w; xx += 1) {
      const cell = state.map.grid[y + yy]?.[x + xx];
      if (!cell || cell.terrain === "water") return { ok: false, reason: "That ground is too wet", footprint, rotation };
      const resource = cell.resourceId ? getResource(state, cell.resourceId) : null;
      if (resource?.amount > 0) return { ok: false, reason: "Clear the natural resources first", footprint, rotation };
      if (buildingAt(state, x + xx, y + yy)) return { ok: false, reason: "That clearing is already occupied", footprint, rotation };
    }
  }
  if (def.waterRadius && !waterNearby(state, x, y, footprint, def.waterRadius)) return { ok: false, reason: `Place it within ${def.waterRadius} cells of water`, footprint, rotation };
  return { ok: true, reason: "Ready to place", footprint, rotation };
};

export const placeBuilding = (state, kind, x, y, rotation = state.buildRotation || 0) => {
  const check = placementCheck(state, kind, x, y, rotation);
  if (!check.ok) return check;
  const def = BUILDINGS[kind];
  state.inventory.wood -= def.cost.wood;
  state.inventory.stone -= def.cost.stone;
  const building = makeBuilding(kind, x, y, false, rotation);
  state.buildings.push(building);
  invalidateBuildingCaches(state);
  state.buildMode = null;
  state.buildRotation = 0;
  state.selected = { type: "building", id: building.id };
  logEvent(state, `The camp marked out a foundation for a ${def.name.toLowerCase()}.`);
  return { ok: true, reason: "Foundation placed", building };
};

const releaseBuildingTasks = (state, buildingId) => {
  state.villagers.forEach((villager) => {
    if (villager.task?.targetId !== buildingId) return;
    if (villager.carrying?.purpose === "construction") state.inventory[villager.carrying.type] += villager.carrying.amount;
    villager.carrying = null;
    finishTask(villager, state);
  });
};

export const cancelBuilding = (state, buildingId) => {
  const building = getBuilding(state, buildingId);
  if (!building || building.complete) return { ok: false, reason: "Only unfinished foundations can be cancelled" };
  releaseBuildingTasks(state, buildingId);
  const def = BUILDINGS[building.kind];
  state.inventory.wood += (building.materials.wood || 0) + (building.staged.wood || 0);
  state.inventory.stone += (building.materials.stone || 0) + (building.staged.stone || 0);
  state.buildings = state.buildings.filter((candidate) => candidate.id !== buildingId);
  invalidateBuildingCaches(state);
  if (state.selected?.id === buildingId) state.selected = null;
  logEvent(state, `The ${def.name.toLowerCase()} foundation was cancelled; its supplies returned to camp.`);
  return { ok: true, reason: "Foundation cancelled" };
};

export const demolishBuilding = (state, buildingId) => {
  const building = getBuilding(state, buildingId);
  if (!building || !building.complete || building.kind === "campfire") return { ok: false, reason: "The campfire cannot be demolished" };
  releaseBuildingTasks(state, buildingId);
  const def = BUILDINGS[building.kind];
  state.inventory.wood += Math.floor(def.cost.wood * 0.5);
  state.inventory.stone += Math.floor(def.cost.stone * 0.5);
  state.buildings = state.buildings.filter((candidate) => candidate.id !== buildingId);
  invalidateBuildingCaches(state);
  if (state.selected?.id === buildingId) state.selected = null;
  logEvent(state, `The ${def.name.toLowerCase()} came down; useful materials were salvaged.`);
  return { ok: true, reason: "Structure demolished" };
};

const completedCount = (state, kind) => state.buildings.filter((building) => building.complete && building.kind === kind).length;

export const objectiveState = (state) => OBJECTIVES.map((objective) => {
  let current = 0;
  if (objective.kind === "resource") current = state.totalGathered[objective.resource] || 0;
  if (objective.kind === "building") {
    const buildingKinds = [objective.building, ...(objective.alternates || [])];
    current = Math.max(...buildingKinds.map((kind) => completedCount(state, kind)));
  }
  return { ...objective, current, complete: current >= objective.amount };
});

const checkMilestone = (state) => {
  if (state.milestoneShown || state.milestoneDismissed) return;
  if (objectiveState(state).every((objective) => objective.complete) && discoveryStats(state).unlocked >= discoveryStats(state).villageThreshold) {
    state.milestoneShown = true;
    state.paused = true;
    logEvent(state, "The clearing has crossed from temporary camp into an established village.");
  }
};

export const tick = (state, realDt) => {
  if (state.paused) return;
  // Paths remain reusable while building/resource walkability is unchanged.
  // Those mutations explicitly invalidate the cache.
  if (!pathCacheByState.has(state)) pathCacheByState.set(state, new Map());
  const dt = clamp(realDt * state.speed, 0, 0.24);
  state.elapsed += dt;
  state.timeOfDay = (state.elapsed % 82) / 82;
  state.day = 1 + Math.floor(state.elapsed / 82);
  advanceMajorEvent(state);
  const nextWeather = eventWeatherForState(state, weatherForState(state));
  if (state.weather?.type !== nextWeather.type) {
    state.weatherFrom = state.weather || nextWeather;
    state.weatherBlend = 0;
    logEvent(state, nextWeather.type === "storm" ? "Thunder rolls over the clearing." : nextWeather.type === "rain" ? "Rain is moving across the clearing." : nextWeather.type === "cloudy" ? "Clouds gather over the ridge." : "The clouds break and the clearing brightens.");
  }
  state.weather = nextWeather;
  state.weatherBlend = clamp((Number(state.weatherBlend) || 0) + dt / 8, 0, 1);
  if (state.weatherBlend >= 1) state.weatherFrom = state.weather;
  state.eventLog.forEach((event) => { event.age += dt; });
  state.effects = state.effects.filter((effect) => {
    effect.life += dt;
    return effect.life < 1.35;
  });
  regenerateResources(state, dt);
  state.buildings.forEach((building) => {
    building.completionPulse = Math.max(0, (Number(building.completionPulse) || 0) - dt * 0.8);
  });
  ageVillagers(state, dt);
  const villagerSpatialIndex = buildSpatialIndex(state.villagers);
  state.villagers.forEach((villager) => updateVillager(state, villager, dt, villagerSpatialIndex));
  const cadence = tickCadence(state);
  cadence.growth += dt;
  if (cadence.growth >= 0.5) {
    updateSettlementGrowth(state, cadence.growth);
    cadence.growth = 0;
  }
  updateAnimals(state, dt);
  cadence.relationships += dt;
  if (cadence.relationships >= 0.5) {
    updateRelationships(state, cadence.relationships);
    cadence.relationships = 0;
  }
  maybeBirth(state);
  updateSupplyLevels(state);
  checkMilestone(state);
};

export const selectAt = (state, worldX, worldY) => {
  const villager = state.villagers
    .map((candidate) => ({ candidate, distance: distance(candidate, { x: worldX, y: worldY }) }))
    .filter((entry) => entry.distance < 24)
    .sort((a, b) => a.distance - b.distance)[0];
  if (villager) {
    state.selected = { type: "villager", id: villager.candidate.id };
    return state.selected;
  }
  const animal = (state.animals || [])
    .map((candidate) => ({ candidate, distance: distance(candidate, { x: worldX, y: worldY }) }))
    .filter((entry) => entry.distance < Math.max(12, (ANIMAL_SPECIES[entry.candidate.species]?.size || 0.7) * 18))
    .sort((a, b) => a.distance - b.distance)[0];
  if (animal) {
    state.selected = { type: "animal", id: animal.candidate.id };
    return state.selected;
  }
  const building = state.buildings
    .map((candidate) => ({ candidate, distance: distance({ x: worldX, y: worldY }, { x: (candidate.x + candidate.footprint.w / 2) * WORLD.cell, y: (candidate.y + candidate.footprint.h / 2) * WORLD.cell }) }))
    .filter((entry) => entry.distance < Math.max(candidateRadius(entry.candidate), 40))
    .sort((a, b) => a.distance - b.distance)[0];
  if (building) state.selected = { type: "building", id: building.candidate.id };
  else state.selected = null;
  return state.selected;
};

const candidateRadius = (building) => Math.max(building.footprint.w, building.footprint.h) * WORLD.cell * 0.58;

export const selectedEntity = (state) => {
  if (!state.selected) return null;
  if (state.selected.type === "villager") return state.villagers.find((villager) => villager.id === state.selected.id);
  if (state.selected.type === "animal") return state.animals?.find((animal) => animal.id === state.selected.id);
  return state.buildings.find((building) => building.id === state.selected.id);
};

export const resourceCount = (state, type) => type === "food" ? availableFood(state) : state.inventory[type] || 0;

export const availableBuilds = (state) => Object.values(BUILDINGS).filter((building) => building.kind !== "campfire" || !state.buildings.some((candidate) => candidate.kind === "campfire"));

export const activityText = (villager) => {
  if (!villager) return "Watching the camp";
  if (villager.activityDetail) return villager.activityDetail;
  if (villager.carrying) return `Carrying ${villager.carrying.amount} ${RESOURCE_META[villager.carrying.type].label.toLowerCase()}`;
  return formatActivity(villager.activity);
};
