import { BUILDING_TYPES, CONFIG, ENEMY_AI, FACTION, FIRST_AGE_BUILD_BLUEPRINTS, INITIAL_RESOURCES, PRODUCTION_TYPES, RESOURCE_SIZE_TIERS, RESOURCE_TYPES, SPACING_ROLES, UNIT_TYPES } from './config.js?v=20260828-latencypass1';
import { findPath } from './pathfinding.js?v=20260822-pathfix1';
import { ANIMATION_EVENT_TIMINGS, ANIMATION_EVENTS, CrownforgeAnimationSystem } from './animation.js?v=20260828-latencypass1';

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const moveToward = (value, target, amount) => value < target ? Math.min(value + amount, target) : Math.max(value - amount, target);
const TAU = Math.PI * 2;
const RESOURCE_SLOT_COUNT = 6;
const RESOURCE_READABLE_FRONT_BIAS = -0.05;
const RESOURCE_INTENT_MAX_CANDIDATES = 12;
const RESOURCE_MANUAL_FALLBACK_RADIUS = 36;
// A Wildwood ring exposes as many as twenty-four valid work positions. Running
// a full A* search for every position made one gather click monopolize the
// browser for several seconds. Try the nearest readable approaches first and
// let the existing same-resource fallback choose another node when those few
// entrances are sealed.
const RESOURCE_ROUTE_ATTEMPT_LIMIT = 4;
const CONSTRUCTION_SLOT_COUNT = 8;
const DEMOLITION_SLOT_COUNT = 8;
const MAX_CONSTRUCTION_ORDER_QUEUE = 12;
const STORAGE_INTERACTION_DISTANCE = 0.78;
const BUILDING_INTERACTION_DISTANCE = 0.78;
const DEMOLITION_INTERACTION_DISTANCE = 0.82;
const DEMOLITION_STRIKE_INTERVAL = 0.72;
const PATH_REACH_TOLERANCE = 0.38;
const BUILDING_CLEARANCE = 0.4;
const WALL_ATTACHMENT_SNAP_DISTANCE = 7.2;
const WALL_ATTACHMENT_SEGMENT_MATCH_DISTANCE = 1.18;
const RESOURCE_FOOTPRINTS = { tree: 1.05, grove: 2.45, berry: 0.82, grain: 1.1, stone: 0.92, gold: 1.02 };
// A Palisade is a deliberate ground-claiming structure. Current and future
// resource types may be cleared from its footprint; only actual structures
// remain placement blockers.
const WALL_CLEARABLE_RESOURCE_TYPES = new Set(Object.keys(RESOURCE_TYPES));
// A wall segment is three world units wide. The connection field is larger
// than one segment so players can release near a terminal post instead of
// having to land on a single pixel-perfect center, while still remaining
// local enough that a nearby unrelated wall end does not steal the drag.
const WALL_CONNECT_SNAP_DISTANCE = 7.2;
// A wall endpoint that is released within this distance of the playable
// boundary magnetizes to the boundary. The center-line margin is deliberately
// smaller than the wall's real collision envelope so the finished barrier
// visibly and physically overlaps the map edge. The final segment is allowed
// a small overhang because a fixed three-unit wall lattice cannot divide every
// map dimension exactly.
const WALL_EDGE_SNAP_DISTANCE = 8.4;
const WALL_EDGE_CENTER_MARGIN = 1.25;
const WALL_EDGE_BOUNDARY_MARGIN = -5.2;
const WALL_JUNCTION_MATCH_DISTANCE = 0.42;
const WALL_JUNCTION_LEGACY_MIN = 0.72;
const WALL_JUNCTION_LEGACY_MAX = 1.28;
const WALL_MAX_SEGMENTS = Math.ceil(Math.hypot(CONFIG.mapWidth, CONFIG.mapHeight) / (BUILDING_TYPES.wall.wallSegmentSpan ?? 3)) + 8;
const DECORATION_FOOTPRINTS = { log: 0.78, stump: 0.62, flowers: 0.42, pebbles: 0.44 };
const COMBAT_SLOT_COUNT = 8;
const COMBAT_SLOT_MARGIN = 0.12;
const DEAD_UNIT_LIFETIME = 2.4;
const BUILDING_COLLISION_RELEASE_TIME = 0.75;
const DESTROYED_BUILDING_LIFETIME = 2.4;
const FACING_HYSTERESIS = 0.12;
const UNIT_STUCK_TIMEOUT = 0.72;
const UNIT_RECOVERY_STUCK_THRESHOLD = 0.42;
const UNIT_REPATH_COOLDOWN = 0.42;
const UNIT_STATIC_CLEARANCE = 0.06;
const UNIT_COLLISION_EPSILON = 0.001;
const MAX_UNIT_TRAVEL_SUBSTEP = 0.16;
const UNIT_COLLISION_GRID_SIZE = 4;
const STATIC_BLOCKER_GRID_SIZE = 8;
const STATIC_BLOCKER_QUERY_RADIUS = 6;
const SIMULATION_STEP = 1 / 60;
const MAX_SIMULATION_STEPS = 8;
const BUILDER_SERVICE_INTERVAL = 0.4;
const BUILDING_REPAIR_EPSILON = 0.5;
const REPAIR_STRIKE_INTERVAL = 0.82;
const SAFETY_HUDDLE_SPACING = 1.65;
const IDLE_REGROUP_DELAY = 30;
const AUTO_COMBAT_ROUTE_BUDGET = 5;
const DEFENSE_PROJECTILE_LIFETIME = 2.4;
const NATURAL_RESOURCE_GAP = 1.7;
const WILDWOOD_LATTICE = { margin: 28, spacingX: 32, spacingZ: 28, overlapAllowance: -15.5 };
const WILDWOOD_CLEARINGS = [
  { id: 'crown-clearing', x: 78, z: 82, radiusX: 78, radiusZ: 84 },
  { id: 'ashen-clearing', x: 516, z: 414, radiusX: 72, radiusZ: 68 },
  { id: 'west-berry-glade', x: 164, z: 104, radiusX: 15, radiusZ: 13 },
  { id: 'west-stone-glade', x: 190, z: 245, radiusX: 16, radiusZ: 13 },
  { id: 'heart-gold-glade', x: 278, z: 206, radiusX: 15, radiusZ: 13 },
  { id: 'north-berry-glade', x: 360, z: 120, radiusX: 15, radiusZ: 13 },
  { id: 'east-stone-glade', x: 418, z: 250, radiusX: 16, radiusZ: 13 },
  { id: 'south-berry-glade', x: 300, z: 350, radiusX: 15, radiusZ: 13 },
  { id: 'south-gold-glade', x: 130, z: 350, radiusX: 15, radiusZ: 13 },
  { id: 'ashen-stone-glade', x: 430, z: 355, radiusX: 16, radiusZ: 13 },
];
const REGIONAL_RESOURCE_POCKETS = [
  { type: 'berry', resourceType: 'food', x: 164, z: 104, sizeTier: 'small' },
  { type: 'stone', resourceType: 'stone', x: 190, z: 245, sizeTier: 'large' },
  { type: 'gold', resourceType: 'gold', x: 278, z: 206, sizeTier: 'large' },
  { type: 'berry', resourceType: 'food', x: 360, z: 120, sizeTier: 'small' },
  { type: 'stone', resourceType: 'stone', x: 418, z: 250, sizeTier: 'large' },
  { type: 'berry', resourceType: 'food', x: 300, z: 350, sizeTier: 'small' },
  { type: 'gold', resourceType: 'gold', x: 130, z: 350, sizeTier: 'large' },
  { type: 'stone', resourceType: 'stone', x: 430, z: 355, sizeTier: 'large' },
];
const ENEMY_BUILD_PLAN = [
  { type: 'hideHomestead', offset: { x: -20, z: 14 } },
  { type: 'smokeGranary', offset: { x: -28, z: -5 } },
  { type: 'reaverLodge', offset: { x: -32, z: 16 } },
  { type: 'ashenTimberRack', offset: { x: -16, z: -22 } },
  { type: 'stonebreakYard', offset: { x: -33, z: -18 } },
  { type: 'ashenField', offset: { x: -12, z: -34 } },
  { type: 'beastCorral', offset: { x: -44, z: 8 } },
  { type: 'oreHearth', offset: { x: -28, z: -31 } },
  { type: 'signalRoost', offset: { x: -48, z: -16 } },
];
const ENEMY_INFANTRY_ROTATION = ['hearthLevy', 'raider', 'hidewall', 'thornSpear'];
const ENEMY_SITE_OFFSETS = [
  { x: 0, z: 0 }, { x: -8, z: 0 }, { x: 0, z: -8 }, { x: 8, z: 0 }, { x: 0, z: 8 },
  { x: -8, z: -8 }, { x: 8, z: -8 }, { x: -12, z: 6 }, { x: 6, z: -12 },
];

export function resourceFootprint(nodeOrType) {
  const type = typeof nodeOrType === 'string' ? nodeOrType : nodeOrType?.type;
  const tier = typeof nodeOrType === 'object' ? nodeOrType?.sizeTier ?? 'small' : 'small';
  const depletionScale = type === 'grove' && typeof nodeOrType === 'object' && nodeOrType.maxAmount > 0
    ? 0.52 + Math.sqrt(clamp(nodeOrType.amount / nodeOrType.maxAmount, 0, 1)) * 0.48
    : 1;
  return (RESOURCE_FOOTPRINTS[type] ?? 0.8) * (RESOURCE_SIZE_TIERS[tier]?.footprintScale ?? 1) * depletionScale;
}

function resourceSlotCount(node) {
  if (node?.type !== 'grove') return RESOURCE_SLOT_COUNT;
  if (node.sizeTier === 'wildwood') return 24;
  if (node.sizeTier === 'ancient') return 16;
  if (node.sizeTier === 'large') return 10;
  return 8;
}

function resourceInteractionDistance(node, unitType = 'villager') {
  const base = RESOURCE_TYPES[node.resourceType]?.interactionDistance ?? 1.7;
  const unitRadius = UNIT_TYPES[unitType]?.radius ?? 0.36;
  // The worker must be allowed to reach the ring without being pushed back
  // by the same footprint used by collision. This matters most for groves and
  // large deposits, whose authored silhouettes are intentionally broad.
  return Math.max(base, resourceFootprint(node) + unitRadius + UNIT_STATIC_CLEARANCE + 0.12);
}

const FACING_VECTORS = [
  { x: 1, z: 1 },
  { x: 1, z: -1 },
  { x: -1, z: -1 },
  { x: -1, z: 1 },
];

function stableResourceNoise(index, salt = 0) {
  let value = (Math.imul(index + 1, 374761393) + Math.imul(salt + 1, 668265263) + 0x9e3779b9) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177) >>> 0;
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}

function directionFromVector(dx, dz, fallback = 0) {
  if (Math.hypot(dx, dz) < 0.001) return fallback;
  const screenX = dx - dz;
  const screenY = dx + dz;
  // The generated directional sheets are authored as front, right, back,
  // left. Prefer side-facing art for diagonal isometric travel so a unit
  // moving toward screen-right never reads as walking backward.
  if (Math.abs(screenX) >= Math.abs(screenY) * 0.58) return screenX >= 0 ? 1 : 3;
  return screenY >= 0 ? 0 : 2;
}

const WALL_SNAP_DIRECTIONS = [
  { label: 'EAST', x: 1, z: 0 },
  { label: 'NORTH-EAST', x: 1, z: -1 },
  { label: 'NORTH', x: 0, z: -1 },
  { label: 'NORTH-WEST', x: -1, z: -1 },
  { label: 'WEST', x: -1, z: 0 },
  { label: 'SOUTH-WEST', x: -1, z: 1 },
  { label: 'SOUTH', x: 0, z: 1 },
  { label: 'SOUTH-EAST', x: 1, z: 1 },
];

function normalizeWallDirection(direction, fallback = { x: 1, z: 0 }) {
  const x = Number(direction?.x);
  const z = Number(direction?.z);
  const length = Math.hypot(x, z);
  if (!Number.isFinite(length) || length < 0.001) return { ...fallback };
  return { x: x / length, z: z / length };
}

function wallDirectionFromOptions(source = {}) {
  if (source.wallDirection) return normalizeWallDirection(source.wallDirection);
  if (source.wallOrientation === 'vertical') return { x: 0, z: 1 };
  return { x: 1, z: 0 };
}

function setUnitFacing(unit, dx, dz, force = false) {
  if (!Number.isInteger(unit.facing) || unit.facing < 0 || unit.facing > 3) {
    unit.facing = 0;
    unit.facingLocked = false;
  }
  const magnitude = Math.hypot(dx, dz);
  if (magnitude < 0.12) return unit.facing;
  const candidate = directionFromVector(dx, dz, unit.facing);
  if (force || !unit.facingLocked || candidate === unit.facing) {
    unit.facing = candidate;
    unit.facingLocked = true;
    return candidate;
  }
  const normalizedX = dx / magnitude;
  const normalizedZ = dz / magnitude;
  const currentVector = FACING_VECTORS[unit.facing] ?? FACING_VECTORS[0];
  const candidateVector = FACING_VECTORS[candidate] ?? FACING_VECTORS[0];
  const currentScore = normalizedX * currentVector.x + normalizedZ * currentVector.z;
  const candidateScore = normalizedX * candidateVector.x + normalizedZ * candidateVector.z;
  if (currentScore < 0.5 || candidateScore >= currentScore + FACING_HYSTERESIS) {
    unit.facing = candidate;
  }
  unit.facingLocked = true;
  return unit.facing;
}

export class CrownforgeSimulation {
  constructor({ onEvent = () => {} } = {}) {
    this.onEvent = onEvent;
    this.animation = new CrownforgeAnimationSystem();
    this.unitSpeedScale = 1;
    // Development-only time compression for worker resource cycles. Keep it
    // separate from locomotion so a faster harvest never changes movement,
    // collision, combat, construction, or the fixed simulation clock.
    this.harvestSpeedScale = 1;
    const query = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    this.stressMode = query.has('stress');
    this.pathCache = new Map();
    this.reset();
  }

  reset() {
    this.clock = 0;
    this.timeAccumulator = 0;
    this.nextId = 1;
    this.nextSafetyHuddleSlot = 0;
    this.builderServiceClock = 0;
    this.navigationVersion = 0;
    this.staticBlockerGrid = new Map();
    this.staticBlockerGridVersion = -1;
    this.repathBudgetRemaining = CONFIG.repathBudgetPerStep;
    this.repathRequestsLastStep = 0;
    this.pathRequestsLastStep = 0;
    this.pathCacheHitsLastStep = 0;
    this.collisionPairsLastStep = 0;
    this.phase = 'playing';
    this.resources = { ...INITIAL_RESOURCES };
    this.enemyResources = { ...ENEMY_AI.startingResources };
    this.enemyAIState = {
      buildClock: 0,
      workerClock: 0,
      armyClock: 0,
      economyClock: 0,
      planIndex: 0,
      raidClock: 0,
      raidCount: 0,
      raidWaveIds: [],
    };
    this.units = [];
    this.buildings = [];
    this.projectiles = [];
    this.resourcesNodes = [];
    this.decorations = [];
    this.selectedIds = [];
    this.pathCache.clear();
    this.staticBlockerGrid.clear();
    this.staticBlockerGridVersion = -1;
    this.lastCommand = 'Select a Crownwarden and issue an order.';
    this._seedWorld();
    this.selectedIds = this.units.filter((unit) => unit.type === 'villager').map((unit) => unit.id);
    this._syncSelectionFlags();
  }

  setUnitSpeedScale(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return this.unitSpeedScale;
    this.unitSpeedScale = clamp(numeric, 1, 10);
    return this.unitSpeedScale;
  }

  getUnitSpeedScale() {
    return this.unitSpeedScale;
  }

  setHarvestSpeedScale(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return this.harvestSpeedScale;
    this.harvestSpeedScale = clamp(numeric, 1, 10);
    return this.harvestSpeedScale;
  }

  getHarvestSpeedScale() {
    return this.harvestSpeedScale;
  }

  _resourceBank(faction = 'player') {
    return faction === 'enemy' ? this.enemyResources : this.resources;
  }

  _canAffordForFaction(faction, cost = {}) {
    const bank = this._resourceBank(faction);
    return Object.entries(cost).every(([key, value]) => (bank[key] ?? 0) >= value);
  }

  _spendForFaction(faction, cost = {}) {
    const bank = this._resourceBank(faction);
    for (const [key, value] of Object.entries(cost)) bank[key] = Math.max(0, (bank[key] ?? 0) - value);
  }

  _seedWorld() {
    this.addBuilding('townCenter', 78, 82, 'player');
    // The first-age settlement begins with one coherent civic landmark. The
    // retired Hearth House and Waystore are intentionally absent; until new
    // support buildings are invented, every resource returns to the Hall.
    // Start the enemy on the far opposite side of the expanded diamond. The
    // long open approach creates time to gather and build without making the
    // Raiders blind or removing their ability to defend their camp.
    this.addBuilding('ashenCamp', 516, 414, 'enemy');
    // Keep the two faction clearings readable and useful. Dense Wildwood begins
    // just beyond these local reserves, giving both economies reachable first
    // resources without creating an open route across the map.
    this.addResource('berry', 'food', 49, 40.5, 105, 1, { sizeTier: 'small' });
    this.addResource('berry', 'food', 82, 41, 105, 0, { sizeTier: 'small' });
    this.addResource('stone', 'stone', 72, 64, 360, 1, { sizeTier: 'medium' });
    this.addResource('stone', 'stone', 84, 61, 900, 0, { sizeTier: 'large' });
    // A modest opening vein teaches the fourth economy loop without crowding
    // the Crown Hall build ring. Richer deposits remain regional discoveries.
    this.addResource('gold', 'gold', 111, 72, 420, 0, { sizeTier: 'medium' });
    this.addResource('berry', 'food', 488, 430, 105, 2, { sizeTier: 'small' });
    this.addResource('stone', 'stone', 487, 400, 360, 2, { sizeTier: 'medium' });
    this.addResource('gold', 'gold', 504, 382, 420, 1, { sizeTier: 'medium' });
    // Build a deterministic, contiguous woodland around the faction clearings
    // and isolated resource glades. Cultivated fields are never seeded; they
    // remain a settlement choice made by the player or AI.
    this._seedNaturalResourceRegions();
    this.addDecoration('log', 18, 24, 0, 0.9);
    this.addDecoration('stump', 8.4, 52, 1, 0.85);
    this.addDecoration('flowers', 43, 20, 2, 0.72);
    this.addDecoration('pebbles', 39, 51, 3, 0.7);
    this.addDecoration('flowers', 64, 38, 0, 0.65);
    this.addDecoration('pebbles', 83, 29, 1, 0.72);
    // Keep the opening workers on the clear south approach so their authored
    // silhouettes and selection markers are visible at reset rather than
    // mechanically present behind the Crown Hall's tall body.
    this.addUnit('villager', 78, 102, 'player');
    this.addUnit('villager', 84, 103, 'player');
    this.addUnit('villager', 72, 103, 'player');
    this.addUnit('soldier', 98, 82, 'player');
    // Keep the opening defender between the camp and the stone clearing. The
    // old point overlapped the eastern stone node in projection and made a
    // resource look like an enemy target until the player moved the Raider.
    // Give the opening Raider a clear patrol pocket west/south of the camp.
    // The camp sprite is intentionally larger than its gameplay footprint, so
    // the old point could disappear behind the tall silhouette at reset.
    this.addUnit('ashenForager', 500, 425, 'enemy');
    this.addUnit('ashenForager', 507, 428, 'enemy');
    this.addUnit('ashenForager', 495, 417, 'enemy');
    this.addUnit('raider', 505, 405, 'enemy');
  }

  _naturalResourceAmount(type, sizeTier) {
    if (type === 'berry') return 105;
    if (type === 'stone') return sizeTier === 'large' ? 900 : sizeTier === 'medium' ? 360 : 120;
    if (type === 'gold') return sizeTier === 'large' ? 1150 : sizeTier === 'medium' ? 420 : 140;
    if (type === 'grove') return sizeTier === 'wildwood' ? 18000 : sizeTier === 'ancient' ? 7200 : sizeTier === 'large' ? 1100 : sizeTier === 'medium' ? 700 : 480;
    return sizeTier === 'large' ? 700 : sizeTier === 'medium' ? 260 : 180;
  }

  _naturalResourceSpotClear(type, sizeTier, x, z) {
    const probe = { type, sizeTier, x, z };
    const footprint = resourceFootprint(probe);
    if (x - footprint < 4 || z - footprint < 4 || x + footprint > CONFIG.mapWidth - 4 || z + footprint > CONFIG.mapHeight - 4) return false;
    if (this.buildings.some((building) => {
      const bounds = this._buildingEntityBounds(building, footprint + 4);
      return x > bounds.minX && x < bounds.maxX && z > bounds.minZ && z < bounds.maxZ;
    })) return false;
    return this.resourcesNodes.every((node) => {
      const contiguousWildwood = sizeTier === 'wildwood' && node.type === 'grove' && node.sizeTier === 'wildwood';
      const gap = contiguousWildwood ? WILDWOOD_LATTICE.overlapAllowance : NATURAL_RESOURCE_GAP;
      return distance(probe, node) >= footprint + resourceFootprint(node) + gap;
    });
  }

  _insideWildwoodClearing(x, z, padding = 0) {
    return WILDWOOD_CLEARINGS.some((clearing) => {
      const dx = (x - clearing.x) / (clearing.radiusX + padding);
      const dz = (z - clearing.z) / (clearing.radiusZ + padding);
      return dx * dx + dz * dz < 1;
    });
  }

  _seedNaturalResourceRegions() {
    for (const [index, pocket] of REGIONAL_RESOURCE_POCKETS.entries()) {
      this.addResource(
        pocket.type,
        pocket.resourceType,
        pocket.x,
        pocket.z,
        this._naturalResourceAmount(pocket.type, pocket.sizeTier),
        Math.floor(stableResourceNoise(index, 43) * 4) % 4,
        { sizeTier: pocket.sizeTier },
      );
    }

    const tier = 'wildwood';
    const footprint = resourceFootprint({ type: 'grove', sizeTier: tier });
    let latticeIndex = 0;
    for (let row = 0, z = WILDWOOD_LATTICE.margin; z <= CONFIG.mapHeight - WILDWOOD_LATTICE.margin; row += 1, z += WILDWOOD_LATTICE.spacingZ) {
      const rowOffset = row % 2 ? WILDWOOD_LATTICE.spacingX * 0.5 : 0;
      for (let column = 0, x = WILDWOOD_LATTICE.margin + rowOffset; x <= CONFIG.mapWidth - WILDWOOD_LATTICE.margin; column += 1, x += WILDWOOD_LATTICE.spacingX) {
        const jitterX = (stableResourceNoise(latticeIndex, 61) - 0.5) * 0.7;
        const jitterZ = (stableResourceNoise(latticeIndex, 67) - 0.5) * 0.7;
        const candidateX = x + jitterX;
        const candidateZ = z + jitterZ;
        latticeIndex += 1;
        if (this._insideWildwoodClearing(candidateX, candidateZ, footprint * 0.48)) continue;
        if (!this._naturalResourceSpotClear('grove', tier, candidateX, candidateZ)) continue;
        const variant = Math.floor(stableResourceNoise(latticeIndex, 71) * 4) % 4;
        this.addResource('grove', 'wood', candidateX, candidateZ, this._naturalResourceAmount('grove', tier), variant, { sizeTier: tier });
      }
    }

    // A continuous old-growth divide guarantees that the opposite faction
    // cannot be reached through a lucky lattice seam or by slipping around a
    // map edge. Every stand remains a normal harvestable resource, so the
    // barrier becomes a player-authored road as crews cut through it.
    const divideStart = { x: 0, z: 430 };
    const divideEnd = { x: 430, z: 0 };
    const divideLength = distance(divideStart, divideEnd);
    const divideSegments = Math.ceil(divideLength / 25);
    for (let index = 0; index <= divideSegments; index += 1) {
      const ratio = index / divideSegments;
      const x = divideStart.x + (divideEnd.x - divideStart.x) * ratio;
      const z = divideStart.z + (divideEnd.z - divideStart.z) * ratio;
      this.addResource('grove', 'wood', x, z, this._naturalResourceAmount('grove', tier), index % 4, { sizeTier: tier });
    }
  }

  addBuilding(type, x, z, faction = 'player', progress = 1, options = {}) {
    const blueprint = BUILDING_TYPES[type];
    const building = {
      id: this.nextId++,
      kind: 'building',
      type,
      faction,
      x,
      z,
      progress,
      hp: blueprint.maxHp * Math.max(progress, 0.18),
      maxHp: blueprint.maxHp,
      selected: false,
      buildAssigned: [],
      buildSlotReservations: new Map(),
      storageSlotReservations: new Map(),
      demolitionQueued: false,
      demolitionAssigned: [],
      demolitionSlotReservations: new Map(),
      demolitionWork: 0,
      demolitionMaxWork: 0,
      demolitionStartHp: 0,
      demolitionTimer: 0,
      combatSlotReservations: new Map(),
      constructionTimer: 0,
      destroyed: false,
      destroyAge: 0,
      hitFlash: 0,
      aiClock: 0,
      raidClock: 0,
      raidCount: 0,
      defendTimer: 0,
      defenseTargetId: null,
      defenseFireCooldown: 0,
      defenseTargetUnitId: null,
      productionQueue: [],
      productionProgress: 0,
      field: Boolean(blueprint.field),
      wallSegments: blueprint.wall ? Math.max(1, Math.round(options.wallSegments ?? 1)) : 1,
      wallOrientation: blueprint.wall ? (options.wallOrientation ?? 'horizontal') : null,
      wallDirection: blueprint.wall || blueprint.wallAttachment ? wallDirectionFromOptions(options) : null,
      wallStart: blueprint.wall ? (options.wallStart ? { ...options.wallStart } : { x, z }) : null,
      gateDirection: blueprint.gate ? wallDirectionFromOptions(options) : null,
      gateOrientation: blueprint.gate ? (options.gateOrientation ?? 'diagonal-right') : null,
      gateWallId: blueprint.gate ? (options.gateWallId ?? null) : null,
      attachmentDirection: blueprint.wallAttachment ? wallDirectionFromOptions(options) : null,
      attachmentWallId: blueprint.wallAttachment ? (options.attachmentWallId ?? options.gateWallId ?? null) : null,
      attachmentWallIds: blueprint.wallAttachment
        ? [...new Set((options.attachmentWallIds ?? options.gateWallIds ?? [options.attachmentWallId ?? options.gateWallId]).filter(Boolean))]
        : [],
      attachmentDirections: blueprint.wallAttachment
        ? (options.attachmentDirections ?? [options.attachmentDirection ?? options.gateDirection ?? options.wallDirection]
          .filter(Boolean)
          .map((direction) => normalizeWallDirection(direction)))
        : [],
      attachmentConnectorSegments: blueprint.wallAttachment
        ? (options.attachmentConnectorSegments ?? []).map((segment) => ({
          x: segment.x,
          z: segment.z,
          direction: normalizeWallDirection(segment.direction),
          socketX: Number.isFinite(segment.socketX) ? segment.socketX : x,
          socketZ: Number.isFinite(segment.socketZ) ? segment.socketZ : z,
        }))
        : [],
      attachmentJunction: blueprint.wallAttachment ? Boolean(options.attachmentJunction) : false,
      farmerId: null,
      fieldTimer: 0,
    };
    this.buildings.push(building);
    this.navigationVersion += 1;
    this.staticBlockerGridVersion = -1;
    return building;
  }

  addUnit(type, x, z, faction) {
    const blueprint = UNIT_TYPES[type];
    const unit = {
      id: this.nextId++,
      kind: 'unit',
      type,
      faction,
      x,
      z,
      hp: blueprint.maxHp,
      maxHp: blueprint.maxHp,
      path: [],
      command: 'idle',
      actionLabel: 'Idle',
      selected: false,
      carryType: null,
      carryAmount: 0,
      gatherTarget: null,
      gatherSlot: 0,
      resourceSlotNodeId: null,
      returnStorageId: null,
      returnSlot: -1,
      postDepositTarget: null,
      postDepositBuildTarget: null,
      routeTarget: null,
      attackTarget: null,
      attackTargetKind: null,
      attackSlot: 0,
      combatSlotTargetId: null,
      combatSlotTargetKind: null,
      attackPhase: 'approach',
      attackPhaseElapsed: 0,
      attackEventFired: false,
      attackTargetSnapshot: null,
      attackRepathCooldown: 0,
      idleDuration: 0,
      buildTarget: null,
      demolishTarget: null,
      demolishSlot: -1,
      orderQueue: [],
      fieldTarget: null,
      attackTimer: 0,
      attackHitApplied: false,
      buildSlot: -1,
      gatherTimer: 0,
      gatherEventFired: false,
      animationState: 'idle',
      animationTime: 0,
      animationPhase: 0,
      animationFrame: 0,
      animationEvents: [],
      lastAnimationEvent: null,
      deathAge: 0,
      velocityX: 0,
      velocityZ: 0,
      facing: 0,
      facingLocked: false,
      motionSpeed: 0,
      animationPlaybackRate: 0,
      animClock: 0,
      visualState: 'idle',
      stairAccess: false,
      stairProgress: 0,
      hitFlash: 0,
      healthRevealTimer: 0,
      stunTimer: 0,
      stunDuration: 0,
      stunImmunityTimer: 0,
      stunImmunityDuration: 0,
      stunSourceId: null,
      lastLightWardTimer: 0,
      lastLightWardDuration: 0,
      lastLightWardHealRate: 0,
      wardBlockedPulse: 0,
      dead: false,
      pathBlocked: false,
      recoveryAvailable: false,
      stuckTimer: 0,
      repathCooldown: 0,
      pathfindingDeferred: false,
      lastProgressX: x,
      lastProgressZ: z,
      needsSafetyRegroup: false,
      safetyRegroupActive: false,
      safetyHuddleSlot: blueprint.regroupAtTownCenter ? this.nextSafetyHuddleSlot++ : -1,
      spacingRole: SPACING_ROLES[type] ?? SPACING_ROLES.villager,
    };
    this.units.push(unit);
    return unit;
  }

  addResource(type, resourceType, x, z, amount, variant = 0, options = {}) {
    this.resourcesNodes.push({
      id: this.nextId++,
      kind: 'resource',
      type,
      resourceType,
      x,
      z,
      amount,
      maxAmount: amount,
      variant,
      sizeTier: options.sizeTier ?? 'small',
      depleted: false,
      depletionStage: 0,
      reservedSlots: new Map(),
    });
    this.navigationVersion += 1;
    this.staticBlockerGridVersion = -1;
  }

  addDecoration(type, x, z, variant = 0, scale = 1) {
    this.decorations.push({
      id: this.nextId++,
      kind: 'decoration',
      type,
      x,
      z,
      variant,
      scale,
    });
  }

  update(delta) {
    const elapsed = Number.isFinite(delta) ? Math.max(0, Math.min(delta, 0.25)) : 0;
    this.timeAccumulator += elapsed;
    let steps = 0;
    while (this.timeAccumulator + 1e-9 >= SIMULATION_STEP && steps < MAX_SIMULATION_STEPS) {
      this._updateFixed(SIMULATION_STEP);
      this.timeAccumulator -= SIMULATION_STEP;
      steps += 1;
    }
    // A paused tab or a breakpoint should not create an unbounded catch-up
    // burst. The bounded drop keeps the next visible frame responsive while
    // preserving deterministic 60 Hz simulation during normal play.
    if (steps === MAX_SIMULATION_STEPS && this.timeAccumulator >= SIMULATION_STEP) this.timeAccumulator = 0;
  }

  _updateFixed(dt) {
    this.repathBudgetRemaining = this.stressMode ? CONFIG.repathBudgetPerStep * 2 : CONFIG.repathBudgetPerStep;
    this.repathRequestsLastStep = 0;
    this.pathRequestsLastStep = 0;
    this.pathCacheHitsLastStep = 0;
    this.collisionPairsLastStep = 0;
    for (const building of this.buildings) {
      building.hitFlash = Math.max(0, building.hitFlash - dt);
      building.defendTimer = Math.max(0, (building.defendTimer ?? 0) - dt);
      building.defenseFireCooldown = Math.max(0, (building.defenseFireCooldown ?? 0) - dt);
      if (building.destroyed) building.destroyAge += dt;
    }
    if (this.phase !== 'playing') {
      for (const unit of this.units) {
        if (unit.dead) {
          unit.deathAge += dt;
          unit.animClock += dt;
        } else if (unit.attackTarget && !this._getAttackTarget(unit)) {
          unit.attackTarget = null;
          unit.attackTargetKind = null;
          unit.command = 'idle';
          unit.path = [];
          unit.visualState = 'idle';
          unit.actionLabel = 'Idle';
        }
        this.animation.update(unit, dt);
        if (unit.dead && unit.deathAge >= DEAD_UNIT_LIFETIME && unit.lastAnimationEvent?.name !== ANIMATION_EVENTS.deathComplete) {
          this.animation.emit(unit, ANIMATION_EVENTS.deathComplete);
        }
      }
      this.units = this.units.filter((unit) => !unit.dead || unit.deathAge < DEAD_UNIT_LIFETIME);
      return;
    }
    this.clock += dt;
    this.builderServiceClock -= dt;
    if (this.builderServiceClock <= 0) {
      this.builderServiceClock = BUILDER_SERVICE_INTERVAL;
      this._updateBuilderServices();
    }
    for (const building of this.buildings) {
      this._updateDemolition(building, dt);
      this._updateConstruction(building, dt);
      this._updateTraining(building, dt);
      this._updateField(building, dt);
      this._updateDefensiveBuilding(building);
    }
    this._updateDefenseProjectiles(dt);
    for (const unit of this.units) this._updateUnit(unit, dt);
    this._resolveUnitCollisions();
    this._updateEnemyAI(dt);
    this._updateEnemyIntent();
    this._checkVictory();
    for (const unit of this.units) {
      if (unit.dead && unit.deathAge >= DEAD_UNIT_LIFETIME && unit.lastAnimationEvent?.name !== ANIMATION_EVENTS.deathComplete) {
        this.animation.emit(unit, ANIMATION_EVENTS.deathComplete);
      }
    }
    this.units = this.units.filter((unit) => !unit.dead || unit.deathAge < DEAD_UNIT_LIFETIME);
    this.buildings = this.buildings.filter((building) => !building.destroyed || building.destroyAge < DESTROYED_BUILDING_LIFETIME);
  }

  _releaseResourceSlot(unit) {
    const node = this.resourcesNodes.find((candidate) => candidate.id === unit.resourceSlotNodeId || candidate.id === unit.gatherTarget);
    if (node?.reservedSlots) {
      for (const [slot, unitId] of node.reservedSlots.entries()) {
        if (unitId === unit.id) node.reservedSlots.delete(slot);
      }
    }
    unit.resourceSlotNodeId = null;
  }

  _reserveResourceSlot(unit, node, preferredSlot = 0) {
    if (!node.reservedSlots) node.reservedSlots = new Map();
    this._releaseResourceSlot(unit);
    const slotCount = resourceSlotCount(node);
    for (let offset = 0; offset < slotCount; offset += 1) {
      const slot = (preferredSlot + offset) % slotCount;
      if (!node.reservedSlots.has(slot)) {
        node.reservedSlots.set(slot, unit.id);
        unit.resourceSlotNodeId = node.id;
        unit.gatherSlot = slot;
        return slot;
      }
    }
    // Retain a deterministic fallback when every authored work position is
    // occupied; local avoidance still prevents an extra worker from sharing
    // an exact coordinate.
    unit.resourceSlotNodeId = null;
    unit.gatherSlot = preferredSlot % slotCount;
    return unit.gatherSlot;
  }

  _releaseBuildingSlot(unit) {
    const building = this.buildings.find((candidate) => candidate.id === unit.buildTarget);
    if (building?.buildSlotReservations) {
      for (const [slot, unitId] of building.buildSlotReservations.entries()) {
        if (unitId === unit.id) building.buildSlotReservations.delete(slot);
      }
      building.buildAssigned = Array.isArray(building.buildAssigned)
        ? building.buildAssigned.filter((unitId) => unitId !== unit.id)
        : [];
    }
    unit.buildSlot = -1;
  }

  _releaseStorageSlot(unit) {
    const storage = this.buildings.find((candidate) => candidate.id === unit.returnStorageId);
    if (storage?.storageSlotReservations) {
      for (const [slot, unitId] of storage.storageSlotReservations.entries()) {
        if (unitId === unit.id) storage.storageSlotReservations.delete(slot);
      }
    }
    unit.returnStorageId = null;
    unit.returnSlot = -1;
  }

  _reserveStorageSlot(unit, storage, preferredSlot = 0) {
    if (!storage.storageSlotReservations) storage.storageSlotReservations = new Map();
    const sameStorage = unit.returnStorageId === storage.id;
    if (!sameStorage) this._releaseStorageSlot(unit);
    const slotCount = this._buildingInteractionSlotCount(storage);
    const start = Number.isInteger(preferredSlot) && preferredSlot >= 0 ? preferredSlot % slotCount : 0;
    for (let offset = 0; offset < slotCount; offset += 1) {
      const slot = (start + offset) % slotCount;
      const occupant = storage.storageSlotReservations.get(slot);
      if (occupant && occupant !== unit.id) continue;
      storage.storageSlotReservations.set(slot, unit.id);
      unit.returnStorageId = storage.id;
      unit.returnSlot = slot;
      return slot;
    }
    unit.returnStorageId = storage.id;
    unit.returnSlot = start;
    return start;
  }

  _releaseDemolitionSlot(unit, { preserveTargetState = false } = {}) {
    const building = this.buildings.find((candidate) => candidate.id === unit.demolishTarget);
    if (building?.demolitionSlotReservations) {
      for (const [slot, unitId] of building.demolitionSlotReservations.entries()) {
        if (unitId === unit.id) building.demolitionSlotReservations.delete(slot);
      }
      building.demolitionAssigned = Array.isArray(building.demolitionAssigned)
        ? building.demolitionAssigned.filter((unitId) => unitId !== unit.id)
        : [];
    }
    unit.demolishTarget = null;
    unit.demolishSlot = -1;
    if (!building || preserveTargetState || building.destroyed || !building.demolitionQueued) return;
    const stillClaimed = this.units.some((candidate) => candidate.id !== unit.id && (
      candidate.demolishTarget === building.id
      || candidate.orderQueue?.some((order) => order.kind === 'demolish' && order.buildingId === building.id)
    ));
    if (!stillClaimed) {
      building.demolitionQueued = false;
      building.demolitionWork = 0;
      building.demolitionMaxWork = 0;
      building.demolitionStartHp = 0;
      building.demolitionTimer = 0;
    }
  }

  _getExplicitAttackTarget(unit) {
    if (!unit.attackTarget || !unit.attackTargetKind) return null;
    const target = unit.attackTargetKind === 'building'
      ? this.buildings.find((candidate) => candidate.id === unit.attackTarget && !candidate.destroyed && candidate.hp > 0 && candidate.progress >= 1)
      : this.units.find((candidate) => candidate.id === unit.attackTarget && !candidate.dead);
    return target && target.faction !== unit.faction && target.faction !== 'neutral' ? target : null;
  }

  _releaseCombatSlot(unit) {
    const target = unit.combatSlotTargetKind === 'building'
      ? this.buildings.find((candidate) => candidate.id === unit.combatSlotTargetId)
      : this.units.find((candidate) => candidate.id === unit.combatSlotTargetId);
    if (target?.combatSlotReservations) {
      for (const [slot, unitId] of target.combatSlotReservations.entries()) {
        if (unitId === unit.id) target.combatSlotReservations.delete(slot);
      }
    }
    unit.combatSlotTargetId = null;
    unit.combatSlotTargetKind = null;
  }

  _reserveCombatSlot(unit, target, preferredSlot = 0) {
    if (!target.combatSlotReservations) target.combatSlotReservations = new Map();
    const sameTarget = unit.combatSlotTargetId === target.id && unit.combatSlotTargetKind === target.kind;
    if (!sameTarget) this._releaseCombatSlot(unit);
    const start = Number.isInteger(preferredSlot) ? ((preferredSlot % COMBAT_SLOT_COUNT) + COMBAT_SLOT_COUNT) % COMBAT_SLOT_COUNT : 0;
    for (let offset = 0; offset < COMBAT_SLOT_COUNT; offset += 1) {
      const slot = (start + offset) % COMBAT_SLOT_COUNT;
      const occupant = target.combatSlotReservations.get(slot);
      if (occupant && occupant !== unit.id) continue;
      target.combatSlotReservations.set(slot, unit.id);
      unit.attackSlot = slot;
      unit.combatSlotTargetId = target.id;
      unit.combatSlotTargetKind = target.kind;
      return slot;
    }
    // The current slice has fewer attackers than slots. Keep a deterministic
    // preferred point if a future stress case exceeds the ring capacity.
    unit.attackSlot = start;
    unit.combatSlotTargetId = target.id;
    unit.combatSlotTargetKind = target.kind;
    return start;
  }

  _cancelAttackCycle(unit) {
    unit.attackPhase = 'approach';
    unit.attackPhaseElapsed = 0;
    unit.attackTimer = 0;
    unit.attackHitApplied = false;
    unit.attackEventFired = false;
    unit.attackTargetSnapshot = null;
  }

  _clearAttackState(unit, keepCommand = false) {
    this._releaseCombatSlot(unit);
    this._cancelAttackCycle(unit);
    unit.attackTarget = null;
    unit.attackTargetKind = null;
    if (!keepCommand) {
      unit.command = 'idle';
      unit.path = [];
      unit.velocityX = 0;
      unit.velocityZ = 0;
      unit.visualState = 'idle';
      unit.actionLabel = 'Idle';
    }
  }

  _startAttackCycle(unit, target) {
    unit.attackPhase = 'anticipation';
    unit.attackPhaseElapsed = 0;
    unit.attackTimer = 0;
    unit.attackHitApplied = false;
    unit.attackEventFired = false;
    const targetPoint = target.kind === 'building' ? this._buildingCollisionCenter(target) : target;
    unit.attackTargetSnapshot = { id: target.id, kind: target.kind, x: targetPoint.x, z: targetPoint.z };
    this.animation.emit(unit, ANIMATION_EVENTS.attackStart, {
      targetId: target.id,
      targetKind: target.kind,
      x: target.x,
      z: target.z,
    });
  }

  isBuilderUnit(unit) {
    return Boolean(unit
      && unit.kind === 'unit'
      && !unit.dead
      && UNIT_TYPES[unit.type]?.canBuild);
  }

  isWorkerUnit(unit) {
    return Boolean(unit
      && unit.kind === 'unit'
      && !unit.dead
      && UNIT_TYPES[unit.type]?.worker);
  }

  canDemolishBuilding(building) {
    return Boolean(building
      && building.kind === 'building'
      && building.faction === 'player'
      && building.type !== 'townCenter'
      && !building.destroyed
      && building.hp > 0);
  }

  _isDemolitionUnit(unit) {
    return Boolean(this.isBuilderUnit(unit) && UNIT_TYPES[unit.type]?.canDemolish);
  }

  buildingNeedsWork(building) {
    return Boolean(building
      && building.kind === 'building'
      && !building.destroyed
      && !building.demolitionQueued
      && (building.progress < 1 || building.hp < building.maxHp - BUILDING_REPAIR_EPSILON));
  }

  _activeConstruction(unit) {
    if (unit.command !== 'build' || !unit.buildTarget) return null;
    return this.buildings.find((building) => building.id === unit.buildTarget
      && this.buildingNeedsWork(building)) ?? null;
  }

  _constructionQueueLabel(unit, building) {
    const count = Array.isArray(unit.orderQueue) ? unit.orderQueue.length : 0;
    const base = building.progress < 1
      ? `Building ${BUILDING_TYPES[building.type].label}`
      : `Repairing ${BUILDING_TYPES[building.type].label}`;
    return count ? `${base} · ${count} queued` : base;
  }

  _queueConstructionOrder(unit, order) {
    const building = this._activeConstruction(unit);
    if (!building) return false;
    if (order.kind === 'build' && order.buildingId === building.id) return true;
    if (!Array.isArray(unit.orderQueue)) unit.orderQueue = [];
    if (unit.orderQueue.length >= MAX_CONSTRUCTION_ORDER_QUEUE) {
      unit.actionLabel = `${this._constructionQueueLabel(unit, building)} · queue full`;
      return true;
    }
    unit.orderQueue.push({ ...order });
    unit.actionLabel = this._constructionQueueLabel(unit, building);
    return true;
  }

  _queueUnitOrder(unit, order, label = 'Order queued') {
    if (!Array.isArray(unit.orderQueue)) unit.orderQueue = [];
    const duplicate = unit.orderQueue.some((candidate) => candidate.kind === order.kind
      && candidate.buildingId === order.buildingId
      && candidate.resourceId === order.resourceId);
    if (duplicate) return true;
    if (unit.orderQueue.length >= MAX_CONSTRUCTION_ORDER_QUEUE) return false;
    unit.orderQueue.push({ ...order });
    unit.actionLabel = `${label} · ${unit.orderQueue.length} queued`;
    return true;
  }

  _executeNextConstructionOrder(unit) {
    if (!Array.isArray(unit.orderQueue)) unit.orderQueue = [];
    while (unit.orderQueue.length) {
      const order = unit.orderQueue.shift();
      this._interruptWork(unit, { preserveQueue: true });
      let started = false;
      if (order.kind === 'move' && order.target) {
        started = this._sendUnitTo(unit, order.target, 'move', order.stopDistance ?? 0);
      } else if (order.kind === 'gather') {
        const preferredNode = this.resourcesNodes.find((candidate) => candidate.id === order.resourceId && candidate.amount > 0) ?? null;
        const resourceType = preferredNode?.resourceType ?? order.resourceType;
        const origin = order.origin ?? preferredNode ?? unit;
        started = Boolean(this._assignResourceWork(unit, {
          resourceType,
          origin,
          preferredNode,
          radius: RESOURCE_MANUAL_FALLBACK_RADIUS,
          preferredSlot: order.gatherSlot,
        }));
      } else if (order.kind === 'build') {
        const building = this.buildings.find((candidate) => candidate.id === order.buildingId
          && this.buildingNeedsWork(candidate));
        if (building) {
          unit.buildTarget = building.id;
          started = this._sendUnitToBuilding(unit, building, order.buildSlot);
          if (!started) unit.buildTarget = null;
        }
      } else if (order.kind === 'demolish') {
        const building = this.buildings.find((candidate) => candidate.id === order.buildingId
          && this.canDemolishBuilding(candidate));
        if (building) started = this._sendUnitToDemolish(unit, building, order.demolishSlot);
      } else if (order.kind === 'crownHall') {
        const building = this.buildings.find((candidate) => candidate.id === order.buildingId
          && candidate.type === 'townCenter'
          && candidate.faction === 'player'
          && candidate.progress >= 1
          && !candidate.destroyed);
        if (building) started = this._sendUnitToCrownHallStairs(unit, building, order.index ?? 0, order.total ?? 1);
      } else if (order.kind === 'storage') {
        const building = this.buildings.find((candidate) => candidate.id === order.buildingId
          && candidate.faction === 'player'
          && candidate.progress >= 1
          && !candidate.destroyed
          && BUILDING_TYPES[candidate.type]?.storage);
        const route = building ? this._bestPathToPoints(unit, this._storageApproachPoints(building)) : null;
        if (route) {
          unit.path = route.path;
          unit.routeTarget = route.point;
          unit.stopDistance = STORAGE_INTERACTION_DISTANCE;
          unit.pathBlocked = false;
          unit.command = 'move';
          unit.actionLabel = `Moving to ${BUILDING_TYPES[building.type].label}`;
          this._resetMovementTracking(unit);
          started = true;
        }
      } else if (order.kind === 'building') {
        const building = this.buildings.find((candidate) => candidate.id === order.buildingId
          && candidate.faction === 'player'
          && candidate.progress >= 1
          && !candidate.destroyed);
        if (building?.field) {
          building.farmerId = unit.id;
          started = this._sendUnitToField(unit, building);
        } else if (building) {
          const route = this._bestPathToPoints(unit, this._buildingApproachPoints(building));
          if (route) {
            unit.path = route.path;
            unit.routeTarget = route.point;
            unit.stopDistance = BUILDING_INTERACTION_DISTANCE;
            unit.pathBlocked = false;
            unit.command = 'move';
            unit.actionLabel = `Moving to ${BUILDING_TYPES[building.type].label}`;
            this._resetMovementTracking(unit);
            started = true;
          }
        }
      } else if (order.kind === 'attack') {
        const target = order.targetKind === 'building'
          ? this.buildings.find((candidate) => candidate.id === order.targetId && candidate.faction === 'enemy' && !candidate.destroyed && candidate.hp > 0)
          : this.units.find((candidate) => candidate.id === order.targetId && candidate.faction === 'enemy' && !candidate.dead);
        if (target) {
          unit.attackTarget = target.id;
          unit.attackTargetKind = target.kind;
          started = this._sendUnitToAttack(unit, target, order.attackSlot ?? 0);
        }
      }
      if (started) return true;
    }
    unit.command = 'idle';
    unit.path = [];
    unit.routeTarget = null;
    unit.visualState = 'idle';
    unit.actionLabel = 'Idle';
    return false;
  }

  _interruptWork(unit, { preserveQueue = false } = {}) {
    this._releaseResourceSlot(unit);
    this._releaseBuildingSlot(unit);
    this._releaseStorageSlot(unit);
    this._releaseDemolitionSlot(unit);
    this._releaseCombatSlot(unit);
    unit.gatherTarget = null;
    unit.buildTarget = null;
    if (unit.fieldTarget) {
      const field = this.buildings.find((building) => building.id === unit.fieldTarget);
      if (field?.farmerId === unit.id) field.farmerId = null;
    }
    unit.fieldTarget = null;
    unit.postDepositBuildTarget = null;
    if (!preserveQueue) unit.orderQueue = [];
    unit.attackTarget = null;
    unit.attackTargetKind = null;
    unit.attackTimer = 0;
    unit.attackHitApplied = false;
    unit.stairAccess = false;
    unit.stairProgress = 0;
    unit.needsSafetyRegroup = false;
    unit.safetyRegroupActive = false;
    unit.idleDuration = 0;
    unit.pathBlocked = false;
    unit.recoveryAvailable = false;
    this._cancelAttackCycle(unit);
  }

  _markBuildingForDemolition(building) {
    if (!this.canDemolishBuilding(building)) return false;
    if (building.demolitionQueued && building.demolitionWork > 0) return true;
    const wallLoad = BUILDING_TYPES[building.type]?.wall
      ? Math.max(1, Math.sqrt(Math.max(1, building.wallSegments ?? 1)) * 0.48)
      : 1;
    building.demolitionQueued = true;
    building.demolitionStartHp = Math.max(1, building.hp);
    building.demolitionMaxWork = Math.max(24, building.demolitionStartHp * wallLoad);
    building.demolitionWork = building.demolitionMaxWork;
    building.demolitionTimer = 0;
    return true;
  }

  _updateDemolition(building, dt) {
    if (!building.demolitionQueued || building.destroyed || !this.canDemolishBuilding(building)) return;
    if (!Array.isArray(building.demolitionAssigned)) building.demolitionAssigned = [];
    building.demolitionAssigned = building.demolitionAssigned.filter((unitId) => this.units.some((unit) => unit.id === unitId
      && this._isDemolitionUnit(unit)
      && unit.demolishTarget === building.id));
    const workers = building.demolitionAssigned
      .map((unitId) => this.units.find((unit) => unit.id === unitId && this._isDemolitionUnit(unit)))
      .filter(Boolean);
    let activeWorkers = 0;
    const interactionCenter = this._buildingCollisionCenter(building);
    for (const worker of workers) {
      if (this._distanceToBuildingUnitEdge(worker, building) > DEMOLITION_INTERACTION_DISTANCE + 0.08) {
        worker.visualState = 'walk';
        worker.actionLabel = `Walking to dismantle ${BUILDING_TYPES[building.type].label}${worker.orderQueue?.length ? ` · ${worker.orderQueue.length} queued` : ''}`;
        if (worker.command !== 'demolish' || !worker.path.length) this._sendUnitToDemolish(worker, building, worker.demolishSlot);
        continue;
      }
      activeWorkers += 1;
      worker.command = 'demolish';
      worker.path = [];
      worker.velocityX = 0;
      worker.velocityZ = 0;
      setUnitFacing(worker, interactionCenter.x - worker.x, interactionCenter.z - worker.z, true);
      worker.visualState = 'build';
      worker.actionLabel = `Dismantling ${BUILDING_TYPES[building.type].label}${worker.orderQueue?.length ? ` · ${worker.orderQueue.length} queued` : ''}`;
    }
    if (!activeWorkers) return;
    building.demolitionTimer += dt;
    while (building.demolitionTimer >= DEMOLITION_STRIKE_INTERVAL) {
      building.demolitionTimer -= DEMOLITION_STRIKE_INTERVAL;
      for (const worker of workers) {
        if (this._distanceToBuildingUnitEdge(worker, building) <= DEMOLITION_INTERACTION_DISTANCE + 0.08) {
          this.animation.emit(worker, ANIMATION_EVENTS.constructionStrike, {
            buildingId: building.id,
            x: building.x,
            z: building.z,
            demolition: true,
          });
        }
      }
    }
    const demolitionPerSecond = workers.reduce((total, worker) => {
      if (this._distanceToBuildingUnitEdge(worker, building) > DEMOLITION_INTERACTION_DISTANCE + 0.08) return total;
      return total + (UNIT_TYPES[worker.type]?.demolitionRate ?? 0);
    }, 0);
    building.demolitionWork = Math.max(0, building.demolitionWork - demolitionPerSecond * dt);
    const ratio = building.demolitionMaxWork > 0 ? building.demolitionWork / building.demolitionMaxWork : 0;
    building.hp = Math.max(0, building.demolitionStartHp * ratio);
    if (building.demolitionWork > 0) return;
    const laborers = [...workers];
    const label = BUILDING_TYPES[building.type].label;
    this._destroyBuilding(building, null, { silent: true, preserveWorkerOrders: true });
    for (const worker of laborers) {
      if (worker.dead) continue;
      if (!this._executeNextConstructionOrder(worker)) worker.needsSafetyRegroup = true;
    }
    this._announce(`${label} dismantled.`);
  }

  _assignCompletedBuildingWork(unit, building) {
    // A completed drop-off should hand its builders directly into the work it
    // exists to support. autoWork keeps the transition independent from yield
    // bonuses, while the single-resource storage fallback makes future first-
    // age work yards behave correctly even before a bonus is authored.
    const blueprint = BUILDING_TYPES[building.type];
    const inferredResourceType = Array.isArray(blueprint?.acceptsResources)
      && blueprint.acceptsResources.length === 1
      ? blueprint.acceptsResources[0]
      : null;
    const resourceType = blueprint?.autoWork?.resourceType ?? inferredResourceType;
    const radius = blueprint?.autoWork?.radius ?? 18;
    if (!this.isWorkerUnit(unit)
      || !resourceType
      || building.destroyed
      || building.progress < 1
      || building.faction !== unit.faction) return false;
    const assignedNode = this._assignResourceWork(unit, {
      resourceType,
      origin: building,
      radius,
      footprintMultiplier: 2.25,
      label: `Starting nearby ${RESOURCE_TYPES[resourceType].label} work`,
    });
    return Boolean(assignedNode);
  }

  _updateConstruction(building, dt) {
    if (!this.buildingNeedsWork(building)) return;
    const repairing = building.progress >= 1;
    if (!Array.isArray(building.buildAssigned)) building.buildAssigned = building.buildAssigned ? [building.buildAssigned] : [];
    building.buildAssigned = building.buildAssigned.filter((unitId) => this.units.some((unit) => unit.id === unitId
      && this.isBuilderUnit(unit)
      && unit.faction === building.faction
      && unit.buildTarget === building.id));
    if (!building.buildAssigned.length) return;
    const builders = building.buildAssigned
      .map((unitId) => this.units.find((unit) => unit.id === unitId && this.isBuilderUnit(unit) && unit.faction === building.faction))
      .filter(Boolean);
    let activeBuilders = 0;
    const interactionCenter = this._buildingCollisionCenter(building);
    for (const builder of builders) {
      if (this._distanceToBuildingUnitEdge(builder, building) > BUILDING_INTERACTION_DISTANCE + 0.08) {
        builder.visualState = 'walk';
        const destination = building.progress < 1 ? 'build site' : BUILDING_TYPES[building.type].label;
        builder.actionLabel = `Walking to ${destination}${builder.orderQueue?.length ? ` · ${builder.orderQueue.length} queued` : ''}`;
        if ((builder.command !== 'build' || !builder.path.length) && builder.repathCooldown <= 0) {
          this._sendUnitToBuilding(builder, building, builder.buildSlot);
        }
        continue;
      }
      activeBuilders += 1;
      builder.command = 'build';
      builder.path = [];
      builder.velocityX = 0;
      builder.velocityZ = 0;
      setUnitFacing(builder, interactionCenter.x - builder.x, interactionCenter.z - builder.z, true);
      builder.visualState = 'build';
      builder.actionLabel = this._constructionQueueLabel(builder, building);
    }
    if (!activeBuilders) return;
    const blueprint = BUILDING_TYPES[building.type];
    if (building.progress < 1) {
      const strikeInterval = Math.max(0.55, blueprint.buildTime / 10);
      building.constructionTimer = (building.constructionTimer ?? 0) + dt;
      while (building.constructionTimer >= strikeInterval && building.progress < 1) {
        building.constructionTimer -= strikeInterval;
        for (const builder of builders) {
          if (this._distanceToBuildingUnitEdge(builder, building) <= BUILDING_INTERACTION_DISTANCE + 0.08) {
            this.animation.emit(builder, ANIMATION_EVENTS.constructionStrike, { buildingId: building.id, x: building.x, z: building.z });
          }
        }
        building.progress = clamp(building.progress + strikeInterval / blueprint.buildTime, 0, 1);
        building.hp = building.maxHp * Math.max(building.progress, 0.18);
      }
    } else {
      building.constructionTimer = (building.constructionTimer ?? 0) + dt;
      while (building.constructionTimer >= REPAIR_STRIKE_INTERVAL) {
        building.constructionTimer -= REPAIR_STRIKE_INTERVAL;
        for (const builder of builders) {
          if (this._distanceToBuildingUnitEdge(builder, building) <= BUILDING_INTERACTION_DISTANCE + 0.08) {
            this.animation.emit(builder, ANIMATION_EVENTS.constructionStrike, { buildingId: building.id, x: building.x, z: building.z, repair: true });
          }
        }
      }
      const repairPerSecond = builders.reduce((total, builder) => {
        if (this._distanceToBuildingUnitEdge(builder, building) > BUILDING_INTERACTION_DISTANCE + 0.08) return total;
        return total + (UNIT_TYPES[builder.type]?.repairRate ?? 0);
      }, 0);
      building.hp = Math.min(building.maxHp, building.hp + repairPerSecond * dt);
    }
    const constructionComplete = building.progress >= 1 && building.hp >= building.maxHp - BUILDING_REPAIR_EPSILON;
    if (constructionComplete) {
      building.progress = 1;
      building.hp = building.maxHp;
      building.constructionTimer = 0;
      for (const builder of builders) {
        this._releaseBuildingSlot(builder);
        builder.buildTarget = null;
        builder.command = 'idle';
        builder.visualState = 'idle';
        builder.actionLabel = 'Idle';
        builder.idleDuration = 0;
        if (this._executeNextConstructionOrder(builder)) continue;
        if (!repairing && this._assignCompletedBuildingWork(builder, building)) continue;
        builder.needsSafetyRegroup = Boolean(UNIT_TYPES[builder.type]?.regroupAtTownCenter);
      }
      building.buildAssigned = [];
      this._announce(`${BUILDING_TYPES[building.type].label} ${repairing ? 'repaired' : 'complete'}.`);
    }
  }

  _updateTraining(building, dt) {
    const queue = building.productionQueue;
    if (!Array.isArray(queue) || !queue.length || building.destroyed || building.progress < 1) return;
    const order = queue[0];
    const blueprint = PRODUCTION_TYPES[order.type];
    if (!blueprint) {
      queue.shift();
      building.productionProgress = 0;
      return;
    }
    order.elapsed = Math.min(blueprint.trainTime, (order.elapsed ?? 0) + dt);
    building.productionProgress = order.elapsed / blueprint.trainTime;
    if (order.elapsed < blueprint.trainTime) return;
    const spawn = this._findUnitSpawnPoint(building, order.type, queue.length);
    if (!spawn) {
      // The queue pauses cleanly when a player packs a building in. It will
      // resume as soon as an approach point is available instead of creating
      // a unit inside a structure or silently deleting the order.
      order.elapsed = blueprint.trainTime;
      building.productionProgress = 1;
      return;
    }
    const unit = this.addUnit(order.type, spawn.x, spawn.z, building.faction);
    unit.actionLabel = 'Idle';
    queue.shift();
    building.productionProgress = queue.length ? 0 : 0;
    if (building.faction === 'player') this._announce(`${blueprint.label} ready at the ${BUILDING_TYPES[building.type]?.label ?? 'building'}.`);
  }

  _availableForAutomaticBuilding(unit) {
    return Boolean(this.isBuilderUnit(unit)
      && !unit.dead
      && unit.stunTimer <= 0
      && unit.command === 'idle'
      && !unit.path.length
      && !unit.carryAmount
      && !unit.gatherTarget
      && !unit.buildTarget
      && !unit.fieldTarget
      && !unit.attackTarget
      && !(unit.orderQueue?.length));
  }

  _nearestAutomaticBuildingWork(unit) {
    const radius = UNIT_TYPES[unit.type]?.autoBuildRadius ?? 0;
    if (radius <= 0) return null;
    return this.buildings
      .filter((building) => {
        if (building.faction !== unit.faction) return false;
        if (!this.buildingNeedsWork(building)) return false;
        const reservations = building.buildSlotReservations ?? new Map();
        if (reservations.size >= this._buildingInteractionSlotCount(building) && ![...reservations.values()].includes(unit.id)) return false;
        return this._distanceToBuildingUnitEdge(unit, building) <= radius;
      })
      .sort((a, b) => {
        const priorityA = a.progress < 1 ? 0 : 1;
        const priorityB = b.progress < 1 ? 0 : 1;
        return priorityA - priorityB
          || this._distanceToBuildingUnitEdge(unit, a) - this._distanceToBuildingUnitEdge(unit, b)
          || a.id - b.id;
      })[0] ?? null;
  }

  _crownHallHuddlePoints(hall) {
    const bounds = this._buildingEntityBounds(hall);
    const stairs = this._crownHallStairInfo(hall);
    const firstRowZ = Math.max(bounds.maxZ + 4.3, (stairs?.outerZ ?? hall.z) + 1.8);
    const points = [];
    // A shallow court south of the Hall creates a readable worker huddle
    // without occupying the stair landing. Wider back rows scale to a busy
    // test settlement while preserving one personal-space slot per worker.
    for (let row = 0; row < 12; row += 1) {
      const count = 7 + row * 2;
      const z = firstRowZ + row * SAFETY_HUDDLE_SPACING;
      const center = (count - 1) / 2;
      const columns = Array.from({ length: count }, (_, column) => column)
        .sort((a, b) => Math.abs(a - center) - Math.abs(b - center) || a - b);
      for (const column of columns) {
        points.push({
          x: clamp(hall.x + (column - center) * SAFETY_HUDDLE_SPACING, 0.75, CONFIG.mapWidth - 0.75),
          z: clamp(z, 0.75, CONFIG.mapHeight - 0.75),
        });
      }
    }
    return points;
  }

  _safetyHuddlePoint(unit, hall) {
    const points = this._crownHallHuddlePoints(hall);
    if (!points.length) return null;
    const start = Math.max(0, unit.safetyHuddleSlot ?? 0) % points.length;
    for (let offset = 0; offset < Math.min(points.length, 28); offset += 1) {
      const point = points[(start + offset) % points.length];
      if (!this._pointBlockedForUnit(unit, point)) return point;
    }
    return null;
  }

  _factionTownHall(faction) {
    const preferredType = faction === 'enemy' ? 'ashenCamp' : 'townCenter';
    return this.buildings.find((building) => building.type === preferredType
      && building.faction === faction
      && building.progress >= 1
      && !building.destroyed) ?? null;
  }

  _isProtectedWorkerTarget(target) {
    return Boolean(target?.kind === 'unit' && UNIT_TYPES[target.type]?.worker);
  }

  _nearestAutomaticCombatTarget(unit, radius) {
    return this.units
      .filter((candidate) => !candidate.dead
        && candidate.faction !== unit.faction
        && candidate.faction !== 'neutral'
        && !this._isProtectedWorkerTarget(candidate)
        && distance(unit, candidate) <= radius)
      .sort((a, b) => distance(unit, a) - distance(unit, b) || a.id - b.id)[0] ?? null;
  }

  _updateMilitaryServices() {
    let routeBudget = this.stressMode ? 2 : AUTO_COMBAT_ROUTE_BUDGET;
    const defenders = this.units
      .filter((unit) => {
        const rules = UNIT_TYPES[unit.type] ?? {};
        return !unit.dead
          && rules.autoAggroRadius > 0
          && rules.canAttackUnits !== false
          && unit.stunTimer <= 0
          && (unit.command === 'idle' || unit.safetyRegroupActive)
          && !unit.orderQueue?.length;
      })
      .sort((a, b) => a.id - b.id);
    for (const defender of defenders) {
      if (routeBudget <= 0) break;
      const target = this._nearestAutomaticCombatTarget(defender, UNIT_TYPES[defender.type].autoAggroRadius);
      if (!target) continue;
      this._interruptWork(defender);
      defender.attackTarget = target.id;
      defender.attackTargetKind = 'unit';
      defender.attackSlot = defender.id % COMBAT_SLOT_COUNT;
      if (this._sendUnitToAttack(defender, target, defender.attackSlot)) {
        defender.actionLabel = `Defending against ${UNIT_TYPES[target.type].label}`;
        routeBudget -= 1;
      }
    }
  }

  _updateBuilderServices() {
    this._updateMilitaryServices();
    const builders = this.units
      .filter((unit) => this._availableForAutomaticBuilding(unit))
      .sort((a, b) => a.id - b.id);
    let routeBudget = this.stressMode ? 3 : 6;
    for (const builder of builders) {
      if (routeBudget <= 0) break;
      const building = this._nearestAutomaticBuildingWork(builder);
      if (!building) continue;
      this._interruptWork(builder);
      builder.buildTarget = building.id;
      if (this._sendUnitToBuilding(builder, building, builder.id % this._buildingInteractionSlotCount(building))) {
        builder.actionLabel = `${building.progress < 1 ? 'Auto-building' : 'Auto-repairing'} ${BUILDING_TYPES[building.type].label}`;
        routeBudget -= 1;
      } else {
        builder.buildTarget = null;
      }
    }

    if (routeBudget <= 0) return;
    const regrouping = this.units
      .filter((unit) => this._availableForAutomaticBuilding(unit)
        && UNIT_TYPES[unit.type]?.regroupAtTownCenter
        && !unit.stairAccess
        && (unit.needsSafetyRegroup || unit.idleDuration >= IDLE_REGROUP_DELAY)
        && unit.idleDuration >= IDLE_REGROUP_DELAY)
      .sort((a, b) => a.safetyHuddleSlot - b.safetyHuddleSlot || a.id - b.id);
    for (const unit of regrouping) {
      if (routeBudget <= 0) break;
      const hall = this._factionTownHall(unit.faction);
      if (!hall) continue;
      const point = this._safetyHuddlePoint(unit, hall);
      if (!point) continue;
      if (distance(unit, point) <= 0.72) {
        unit.needsSafetyRegroup = false;
        unit.safetyRegroupActive = false;
        unit.idleDuration = 0;
        unit.actionLabel = `Standing by at ${BUILDING_TYPES[hall.type].label}`;
        continue;
      }
      if (this._sendUnitTo(unit, point, 'move')) {
        unit.safetyRegroupActive = true;
        unit.actionLabel = `Regrouping at ${BUILDING_TYPES[hall.type].label}`;
        routeBudget -= 1;
      }
    }
  }

  _defensiveBuildingTarget(building, rules) {
    const current = this.units.find((unit) => unit.id === building.defenseTargetUnitId
      && !unit.dead
      && unit.faction !== building.faction
      && unit.faction !== 'neutral'
      && !this._isProtectedWorkerTarget(unit)
      && distance(building, unit) <= rules.range);
    if (current) return current;
    return this.units
      .filter((unit) => !unit.dead
        && unit.faction !== building.faction
        && unit.faction !== 'neutral'
        && !this._isProtectedWorkerTarget(unit)
        && distance(building, unit) <= rules.range)
      .sort((a, b) => distance(building, a) - distance(building, b) || a.id - b.id)[0] ?? null;
  }

  _updateDefensiveBuilding(building) {
    const rules = BUILDING_TYPES[building.type]?.defense;
    if (!rules || building.destroyed || building.progress < 1 || building.hp <= 0 || building.faction === 'neutral') return;
    if (building.defenseFireCooldown > 0) return;
    const target = this._defensiveBuildingTarget(building, rules);
    if (!target) {
      building.defenseTargetUnitId = null;
      return;
    }
    building.defenseTargetUnitId = target.id;
    const angle = Math.atan2(target.z - building.z, target.x - building.x);
    const ports = Math.max(1, Math.round(rules.ports ?? 4));
    const portIndex = ((Math.round(angle / (TAU / ports)) % ports) + ports) % ports;
    const portAngle = (portIndex / ports) * TAU;
    const portRadius = rules.portRadius ?? 0.8;
    const start = {
      x: building.x + Math.cos(portAngle) * portRadius,
      z: building.z + Math.sin(portAngle) * portRadius,
    };
    this.projectiles.push({
      id: this.nextId++,
      kind: 'defense-arrow',
      faction: building.faction,
      sourceBuildingId: building.id,
      sourceType: building.type,
      targetId: target.id,
      x: start.x,
      z: start.z,
      previousX: start.x,
      previousZ: start.z,
      startX: start.x,
      startZ: start.z,
      damage: rules.damage,
      speed: rules.projectileSpeed ?? 30,
      age: 0,
      maxAge: DEFENSE_PROJECTILE_LIFETIME,
      totalDistance: Math.max(0.01, distance(start, target)),
      portIndex,
    });
    building.defenseFireCooldown = rules.cooldown;
  }

  _updateDefenseProjectiles(dt) {
    for (const projectile of this.projectiles) {
      projectile.age += dt;
      const target = this.units.find((unit) => unit.id === projectile.targetId
        && !unit.dead
        && unit.faction !== projectile.faction
        && unit.faction !== 'neutral');
      if (!target || this._isProtectedWorkerTarget(target) || projectile.age >= projectile.maxAge) {
        projectile.expired = true;
        continue;
      }
      projectile.previousX = projectile.x;
      projectile.previousZ = projectile.z;
      const remaining = distance(projectile, target);
      const travel = projectile.speed * dt;
      if (remaining <= travel + (UNIT_TYPES[target.type]?.radius ?? 0.4)) {
        projectile.x = target.x;
        projectile.z = target.z;
        projectile.expired = true;
        const result = this._applyUnitDamage(target, projectile.damage, {
          id: projectile.sourceBuildingId,
          kind: 'building',
          faction: projectile.faction,
          type: projectile.sourceType,
        });
        target.hitFlash = Math.max(target.hitFlash, result.blocked ? 0.12 : 0.3);
        target.healthRevealTimer = Math.max(target.healthRevealTimer, 1.6);
        this.animation.emit(target, ANIMATION_EVENTS.damageTaken, {
          sourceId: projectile.sourceBuildingId,
          sourceKind: 'building',
          damage: result.damage,
          warded: result.warded,
          blocked: result.blocked,
        });
        continue;
      }
      const ratio = travel / Math.max(remaining, 0.001);
      projectile.x += (target.x - projectile.x) * ratio;
      projectile.z += (target.z - projectile.z) * ratio;
    }
    this.projectiles = this.projectiles.filter((projectile) => !projectile.expired);
  }

  _sendUnitToField(unit, field) {
    const route = this._bestPathToPoints(unit, this._buildingApproachPoints(field, 0.62));
    if (!route) {
      unit.path = [];
      unit.pathBlocked = true;
      unit.recoveryAvailable = true;
      unit.command = 'idle';
      unit.visualState = 'idle';
      unit.actionLabel = 'Field route blocked';
      return false;
    }
    unit.fieldTarget = field.id;
    unit.path = route.path;
    unit.routeTarget = route.point;
    unit.stopDistance = 0.62;
    unit.pathBlocked = false;
    unit.command = 'field';
    unit.visualState = 'walk';
    unit.actionLabel = 'Walking to Grain Field';
    this._resetMovementTracking(unit);
    return true;
  }

  _updateField(building, dt) {
    if (!building.field || building.destroyed || building.progress < 1) return;
    let farmer = building.farmerId
      ? this.units.find((unit) => unit.id === building.farmerId && !unit.dead && unit.faction === building.faction)
      : null;
    if (!farmer) {
      const candidate = this.units.find((unit) => UNIT_TYPES[unit.type]?.worker
        && unit.faction === building.faction
        && !unit.dead
        && !unit.carryAmount
        && unit.command === 'idle'
        && !unit.buildTarget
        && !unit.fieldTarget);
      if (!candidate) return;
      this._interruptWork(candidate);
      building.farmerId = candidate.id;
      farmer = candidate;
      this._sendUnitToField(farmer, building);
    }
    if (farmer.fieldTarget !== building.id || farmer.command !== 'field') return;
    if (this._distanceToBuildingUnitEdge(farmer, building) > 0.7) {
      farmer.visualState = 'walk';
      farmer.actionLabel = 'Walking to Grain Field';
      if (!farmer.path.length) this._sendUnitToField(farmer, building);
      return;
    }
    farmer.path = [];
    farmer.velocityX = 0;
    farmer.velocityZ = 0;
    setUnitFacing(farmer, building.x - farmer.x, building.z - farmer.z, true);
    farmer.visualState = 'field';
    farmer.actionLabel = 'Tending Grain Field';
    building.fieldTimer = (building.fieldTimer ?? 0) + dt;
    if (building.fieldTimer >= 3.2) {
      building.fieldTimer = 0;
      const bank = this._resourceBank(building.faction);
      bank.food = Math.min(RESOURCE_TYPES.food.capacity, bank.food + 8);
      this.animation.emit(farmer, ANIMATION_EVENTS.resourceCollected, { resourceType: 'food', fieldId: building.id });
    }
  }

  _findUnitSpawnPoint(building, type, queueDepth = 0) {
    const role = SPACING_ROLES[type] ?? SPACING_ROLES.villager;
    const wobble = (queueDepth % 3) * 0.32;
    const candidates = this._buildingApproachPoints(building, 1.1 + wobble);
    const unitProbe = { type };
    return candidates.find((point) => {
      if (this._pointBlockedForUnit(unitProbe, point)) return false;
      return this.units.every((unit) => unit.dead || distance(point, unit) >= Math.max(role.personalSpace, SPACING_ROLES[unit.type]?.personalSpace ?? 1));
    }) ?? null;
  }

  _updateUnit(unit, dt) {
    if (unit.dead) {
      unit.deathAge += dt;
      unit.animClock += dt;
      unit.motionSpeed = 0;
      unit.animationPlaybackRate = 1;
      unit.visualState = 'death';
      this.animation.update(unit, dt);
      return;
    }
    unit.animClock += dt;
    unit.hitFlash = Math.max(0, unit.hitFlash - dt);
    unit.healthRevealTimer = Math.max(0, unit.healthRevealTimer - dt);
    unit.repathCooldown = Math.max(0, unit.repathCooldown - dt);
    unit.attackRepathCooldown = Math.max(0, unit.attackRepathCooldown - dt);
    if (this._updateUnitStatusEffects(unit, dt)) {
      unit.motionSpeed = 0;
      unit.animationPlaybackRate = 1;
      this.animation.update(unit, dt);
      return;
    }
    if (unit.command === 'move') unit.visualState = 'walk';
    else if (unit.command === 'field') unit.visualState = unit.path.length ? 'walk' : 'food';
    else if (!['gather', 'return', 'attack', 'build', 'demolish'].includes(unit.command)) unit.visualState = 'idle';
    if (unit.command === 'move' || unit.command === 'gather' || unit.command === 'return' || unit.command === 'attack' || unit.command === 'build' || unit.command === 'demolish' || unit.command === 'field') {
      this._followPath(unit, dt);
    }
    if (unit.command === 'gather') this._updateGathering(unit, dt);
    else if (unit.command === 'return') this._updateReturning(unit);
    else if (unit.command === 'attack') this._updateAttack(unit, dt);
    else if (unit.command === 'build') this._updateBuildingIntent(unit);
    else if (unit.command === 'demolish') this._updateDemolitionIntent(unit);
    else if (unit.command === 'field') this._updateFieldIntent(unit);
    this._updateStairProgress(unit);
    unit.motionSpeed = Math.hypot(unit.velocityX, unit.velocityZ);
    unit.animationPlaybackRate = unit.command === 'move' || unit.visualState === 'walk'
      ? Math.max(0, Math.min(3.2, unit.motionSpeed / Math.max(UNIT_TYPES[unit.type].speed, 0.01)))
      : 1;
    const trulyIdle = unit.command === 'idle'
      && !unit.path.length
      && !unit.gatherTarget
      && !unit.buildTarget
      && !unit.fieldTarget
      && !unit.attackTarget
      && !unit.carryAmount
      && !(unit.orderQueue?.length);
    unit.idleDuration = trulyIdle ? (unit.idleDuration ?? 0) + dt : 0;
    this.animation.update(unit, dt);
  }

  _updateUnitStatusEffects(unit, dt) {
    unit.wardBlockedPulse = Math.max(0, (unit.wardBlockedPulse ?? 0) - dt);
    if (unit.lastLightWardTimer > 0) {
      unit.lastLightWardTimer = Math.max(0, unit.lastLightWardTimer - dt);
      unit.hp = Math.min(unit.maxHp, unit.hp + (unit.lastLightWardHealRate ?? 0) * dt);
      if (unit.lastLightWardTimer <= 0) {
        unit.hp = unit.maxHp;
        unit.lastLightWardHealRate = 0;
      }
    }
    unit.stunImmunityTimer = Math.max(0, (unit.stunImmunityTimer ?? 0) - dt);
    if (unit.stunTimer <= 0) return false;

    unit.stunTimer = Math.max(0, unit.stunTimer - dt);
    unit.path = [];
    unit.routeTarget = null;
    unit.velocityX = 0;
    unit.velocityZ = 0;
    unit.motionSpeed = 0;
    unit.command = 'stunned';
    unit.visualState = 'stunned';
    unit.actionLabel = `Stunned · ${Math.max(1, Math.ceil(unit.stunTimer))}s`;
    if (unit.stunTimer > 0) return true;

    const source = this.units.find((candidate) => candidate.id === unit.stunSourceId && !candidate.dead);
    unit.stunImmunityTimer = Math.max(unit.stunImmunityTimer, unit.stunImmunityDuration || 20);
    unit.stunSourceId = null;
    unit.command = 'idle';
    unit.visualState = 'idle';
    unit.actionLabel = `Steadfast · stun immune ${Math.ceil(unit.stunImmunityTimer)}s`;
    this.animation.emit(unit, ANIMATION_EVENTS.stunEnded, {
      sourceId: source?.id ?? null,
      immunityDuration: unit.stunImmunityTimer,
    });
    if (source && source.faction !== unit.faction && source.faction !== 'neutral') {
      unit.attackTarget = source.id;
      unit.attackTargetKind = 'unit';
      if (!this._sendUnitToAttack(unit, source, unit.attackSlot)) {
        unit.actionLabel = 'Steadfast · no route to attacker';
      }
    }
    return false;
  }

  _followPath(unit, dt) {
    const blueprint = UNIT_TYPES[unit.type];
    let next = unit.path[0];
    const routeBlocked = next && (
      this._isPathCellBlocked(unit, Math.floor(next.x), Math.floor(next.z), null, next)
      || this._pathSegmentBlocked(unit, { x: unit.x, z: unit.z }, next)
    );
    let routePaused = false;
    if (routeBlocked) {
      if (unit.repathCooldown <= 0) {
        const replanned = this._requestRepath(unit);
        if (replanned === null || replanned === false) {
          unit.velocityX = 0;
          unit.velocityZ = 0;
          unit.motionSpeed = 0;
          unit.stuckTimer += dt;
          routePaused = true;
        }
      }
      else {
        unit.velocityX = 0;
        unit.velocityZ = 0;
        unit.motionSpeed = 0;
        unit.stuckTimer += dt;
        routePaused = true;
      }
      next = routePaused ? null : unit.path[0];
    }
    let desiredX = 0;
    let desiredZ = 0;
    let desiredSpeed = 0;
    if (next) {
      const dx = next.x - unit.x;
      const dz = next.z - unit.z;
      const length = Math.hypot(dx, dz);
      if (length < 0.12) {
        unit.path.shift();
      } else {
        desiredSpeed = Math.min(blueprint.speed * this.unitSpeedScale, length / Math.max(dt, 0.001));
        desiredX = (dx / length) * desiredSpeed;
        desiredZ = (dz / length) * desiredSpeed;
      }
    }
    // The sandbox dial time-compresses locomotion only. Scaling response by
    // the square of travel speed preserves the base acceleration/braking
    // curve in world space instead of giving fast units long, moon-like
    // glides. Gathering, combat, construction, AI, and the fixed tick remain
    // on their normal timing.
    const locomotionResponse = this.unitSpeedScale * this.unitSpeedScale;
    const acceleration = (desiredSpeed > 0 ? (blueprint.acceleration ?? 10) : (blueprint.braking ?? 12)) * locomotionResponse;
    unit.velocityX = moveToward(unit.velocityX, desiredX, acceleration * dt);
    unit.velocityZ = moveToward(unit.velocityZ, desiredZ, acceleration * dt);
    const previousX = unit.x;
    const previousZ = unit.z;
    const travelDistance = Math.hypot(unit.velocityX, unit.velocityZ) * dt;
    const travelSteps = Math.max(1, Math.ceil(travelDistance / MAX_UNIT_TRAVEL_SUBSTEP));
    const travelDt = dt / travelSteps;
    for (let step = 0; step < travelSteps; step += 1) {
      const substepX = unit.x;
      const substepZ = unit.z;
      unit.x = clamp(unit.x + unit.velocityX * travelDt, 0.45, CONFIG.mapWidth - 0.45);
      unit.z = clamp(unit.z + unit.velocityZ * travelDt, 0.45, CONFIG.mapHeight - 0.45);
      this._constrainUnitPosition(unit, substepX, substepZ);
    }
    unit.motionSpeed = Math.hypot(unit.velocityX, unit.velocityZ);
    // Face the authored path direction before collision separation nudges the
    // body. This prevents a Crown Guard from reading as walking backward when
    // a nearby unit or obstacle slightly bends its velocity.
    if (desiredSpeed > 0.2) setUnitFacing(unit, desiredX, desiredZ);
    else if (unit.motionSpeed > 0.12) setUnitFacing(unit, unit.velocityX, unit.velocityZ);

    const moved = Math.hypot(unit.x - unit.lastProgressX, unit.z - unit.lastProgressZ);
    // Measure actual world progress, not the velocity value. A collision can
    // hold a fast unit in place while its desired velocity is still large;
    // that case must still trigger the normal bounded repath.
    if (unit.path.length && moved < 0.004) unit.stuckTimer += dt;
    else unit.stuckTimer = Math.max(0, unit.stuckTimer - dt * 2);
    unit.lastProgressX = unit.x;
    unit.lastProgressZ = unit.z;
    if (unit.path.length && unit.stuckTimer >= UNIT_RECOVERY_STUCK_THRESHOLD) {
      unit.recoveryAvailable = true;
    }
    if (unit.path.length && unit.stuckTimer >= UNIT_STUCK_TIMEOUT && unit.repathCooldown <= 0) {
      unit.stuckTimer = 0;
      const replanned = this._requestRepath(unit);
      if (replanned === false) unit.pathBlocked = true;
    }
    if (unit.command === 'move' && !unit.path.length && Math.hypot(unit.velocityX, unit.velocityZ) < 0.08) {
      if (unit.orderQueue?.length) this._executeNextConstructionOrder(unit);
      else {
        unit.command = 'idle';
        unit.visualState = 'idle';
        unit.routeTarget = null;
        if (unit.safetyRegroupActive) {
          unit.safetyRegroupActive = false;
          unit.needsSafetyRegroup = false;
          unit.actionLabel = 'Standing by at Crown Hall';
        } else {
          unit.actionLabel = 'Idle';
        }
      }
    }
  }

  _updateGathering(unit, dt) {
    const node = this.resourcesNodes.find((candidate) => candidate.id === unit.gatherTarget);
    if (!node || node.amount <= 0) {
      this._releaseResourceSlot(unit);
      unit.gatherTarget = null;
      unit.gatherSlot = 0;
      unit.gatherTimer = 0;
      unit.gatherEventFired = false;
      if (unit.carryAmount > 0) {
        unit.actionLabel = 'Returning cargo';
        this._beginReturn(unit);
      } else {
        unit.actionLabel = 'Resource depleted';
        unit.command = 'idle';
        unit.visualState = 'idle';
        unit.needsSafetyRegroup = true;
      }
      return;
    }
    const resourceInfo = RESOURCE_TYPES[node.resourceType];
    const bank = this._resourceBank(unit.faction);
    const interactionDistance = resourceInteractionDistance(node, unit.type);
    if (unit.carryAmount > 0) {
      this._beginReturn(unit);
      return;
    }
    if (bank[node.resourceType] >= resourceInfo.capacity) {
      this._releaseResourceSlot(unit);
      unit.gatherTarget = null;
      unit.gatherTimer = 0;
      unit.gatherEventFired = false;
      unit.command = 'idle';
      unit.visualState = 'idle';
      unit.actionLabel = `${resourceInfo.label} storage full`;
      unit.needsSafetyRegroup = true;
      return;
    }
    if (distance(unit, node) > interactionDistance + 0.08) {
      unit.actionLabel = `Walking to ${resourceInfo.label}`;
      unit.visualState = 'walk';
      setUnitFacing(unit, node.x - unit.x, node.z - unit.z);
      if (!unit.path.length) this._sendUnitToResource(unit, node);
      return;
    }
    unit.path = [];
    unit.velocityX = 0;
    unit.velocityZ = 0;
    setUnitFacing(unit, node.x - unit.x, node.z - unit.z, true);
    unit.visualState = node.resourceType;
    unit.actionLabel = `Gathering ${resourceInfo.label}`;
    // Only the worker's gather cycle is compressed. Amounts, carry limits,
    // animation state, and the rest of the simulation remain unchanged.
    const effectiveGatherTime = resourceInfo.gatherTime / this.harvestSpeedScale;
    unit.gatherTimer += dt;
    const toolContactTime = effectiveGatherTime * ANIMATION_EVENT_TIMINGS.resource_collected;
    if (unit.gatherEventFired || unit.gatherTimer < toolContactTime) {
      if (unit.gatherTimer >= effectiveGatherTime) {
        unit.gatherTimer = 0;
        unit.gatherEventFired = false;
      }
      return;
    }
    unit.gatherEventFired = true;
    this.animation.emit(unit, ANIMATION_EVENTS.resourceCollected, { resourceType: node.resourceType });
    // Keep the contact event last so the renderer can give the player a
    // readable strike cue without needing a second visual-event queue.
    this.animation.emit(unit, ANIMATION_EVENTS.toolContact, { resourceType: node.resourceType, x: node.x, z: node.z, nodeId: node.id });
    const availableSpace = resourceInfo.capacity - bank[node.resourceType];
    const gatherAmount = Math.round(resourceInfo.gatherAmount * this._resourceGatherMultiplier(node, unit.faction));
    const amount = Math.min(gatherAmount, node.amount, availableSpace);
    if (amount <= 0) {
      this._releaseResourceSlot(unit);
      unit.gatherTarget = null;
      unit.gatherTimer = 0;
      unit.gatherEventFired = false;
      unit.command = 'idle';
      unit.visualState = 'idle';
      unit.actionLabel = `${resourceInfo.label} storage full`;
      unit.needsSafetyRegroup = true;
      return;
    }
    node.amount -= amount;
    if (node.type === 'grove' && node.maxAmount > 0) {
      const ratio = clamp(node.amount / node.maxAmount, 0, 1);
      const nextStage = ratio > 0.72 ? 0 : ratio > 0.42 ? 1 : ratio > 0.12 ? 2 : 3;
      if (nextStage !== node.depletionStage) {
        node.depletionStage = nextStage;
        this.navigationVersion += 1;
        this.staticBlockerGridVersion = -1;
      }
    }
    unit.carryType = node.resourceType;
    unit.carryAmount = amount;
    unit.gatherTimer = 0;
    unit.gatherEventFired = false;
    unit.actionLabel = `Carrying ${resourceInfo.label}`;
    unit.visualState = `carry:${unit.carryType}`;
    if (node.amount <= 0 && !node.depleted) {
      node.depleted = true;
      this.navigationVersion += 1;
      this._announce(`${resourceInfo.label} source depleted.`);
    }
    // A worker owns a resource slot only while approaching or working the
    // node. Once the gathered bundle is on the worker, the slot is free for
    // another villager (or for a retasked worker to choose again later).
    this._releaseResourceSlot(unit);
    this._beginReturn(unit);
  }

  _updateReturning(unit) {
    const storage = this._getReturnStorage(unit) ?? this._nearestStorage(unit, unit.carryType);
    if (!storage) {
      this._releaseStorageSlot(unit);
      unit.actionLabel = 'No drop-off available';
      unit.visualState = unit.carryType ? `carry:${unit.carryType}` : 'idle';
      unit.path = [];
      return;
    }
    const storageDistance = this._distanceToBuildingUnitEdge(unit, storage);
    if (storageDistance > STORAGE_INTERACTION_DISTANCE + 0.08) {
      unit.actionLabel = this._returnActionLabel(unit, storage);
      unit.visualState = `carry:${unit.carryType}`;
      if (!unit.path.length) this._sendUnitToStorage(unit, storage);
      return;
    }
    unit.path = [];
    unit.velocityX = 0;
    unit.velocityZ = 0;
    const interactionCenter = this._buildingCollisionCenter(storage);
    setUnitFacing(unit, interactionCenter.x - unit.x, interactionCenter.z - unit.z, true);
    const resourceInfo = RESOURCE_TYPES[unit.carryType];
    const bank = this._resourceBank(unit.faction);
    const availableSpace = Math.max(0, resourceInfo.capacity - bank[unit.carryType]);
    const deposited = Math.min(unit.carryAmount, availableSpace);
    bank[unit.carryType] += deposited;
    unit.carryAmount -= deposited;
    if (deposited > 0) this.animation.emit(unit, ANIMATION_EVENTS.depositComplete, {
      resourceType: unit.carryType,
      amount: deposited,
      storageId: storage.id,
      x: storage.x,
      z: storage.z,
    });
    unit.actionLabel = deposited > 0 ? `Stored ${deposited} ${resourceInfo.label}` : `${resourceInfo.label} storage full`;
    if (unit.carryAmount > 0) {
      unit.postDepositBuildTarget = null;
      this._releaseStorageSlot(unit);
      unit.command = 'idle';
      unit.visualState = `carry:${unit.carryType}`;
      return;
    }
    unit.carryType = null;
    this._releaseStorageSlot(unit);
    this._continueAfterDeposit(unit);
  }

  _continueAfterDeposit(unit) {
    if (unit.orderQueue?.length) {
      this._executeNextConstructionOrder(unit);
      return;
    }
    const nextNode = this.resourcesNodes.find((node) => node.id === unit.gatherTarget && node.amount > 0);
    if (nextNode) {
      const assignedNode = this._assignResourceWork(unit, {
        resourceType: nextNode.resourceType,
        origin: nextNode,
        preferredNode: nextNode,
        radius: RESOURCE_MANUAL_FALLBACK_RADIUS,
      });
      if (assignedNode) return;
    }
    unit.gatherTarget = null;
    if (unit.postDepositBuildTarget) {
      const buildingId = unit.postDepositBuildTarget;
      unit.postDepositBuildTarget = null;
      const building = this.buildings.find((candidate) => candidate.id === buildingId
        && this.buildingNeedsWork(candidate));
      if (building) {
        unit.buildTarget = building.id;
        if (!this._sendUnitToBuilding(unit, building, unit.buildSlot)) unit.buildTarget = null;
        return;
      }
    }
    if (unit.postDepositTarget) {
      const target = unit.postDepositTarget;
      unit.postDepositTarget = null;
      this._sendUnitTo(unit, target, 'move');
      return;
    }
    unit.command = 'idle';
    unit.visualState = 'idle';
    unit.actionLabel = 'Idle';
    unit.needsSafetyRegroup = true;
  }

  _beginReturn(unit) {
    if (!unit.carryAmount || !unit.carryType) return false;
    this._releaseResourceSlot(unit);
    this._releaseStorageSlot(unit);
    const route = this._findStorageRoute(unit);
    if (!route) {
      unit.command = 'idle';
      unit.path = [];
      unit.pathBlocked = true;
      unit.visualState = `carry:${unit.carryType}`;
      unit.actionLabel = 'Drop-off route blocked';
      return false;
    }
    this._reserveStorageSlot(unit, route.storage, route.slot);
    unit.path = route.path;
    unit.routeTarget = route.point;
    unit.stopDistance = STORAGE_INTERACTION_DISTANCE;
    unit.pathBlocked = false;
    unit.command = 'return';
    unit.actionLabel = this._returnActionLabel(unit, route.storage);
    unit.visualState = `carry:${unit.carryType}`;
    return true;
  }

  _getReturnStorage(unit) {
    return this.buildings.find((building) => building.id === unit.returnStorageId
      && !building.destroyed
      && building.progress >= 1
      && building.faction === unit.faction
      && this._storageAccepts(building, unit.carryType)) ?? null;
  }

  _returnActionLabel(unit, storage = null) {
    const resourceLabel = RESOURCE_TYPES[unit.carryType]?.label ?? 'Cargo';
    const target = storage ?? this._getReturnStorage(unit);
    const storageLabel = target ? BUILDING_TYPES[target.type]?.label : null;
    return storageLabel ? `Returning ${resourceLabel} to ${storageLabel}` : `Returning ${resourceLabel}`;
  }

  _storageAccepts(building, resourceType = null) {
    const blueprint = BUILDING_TYPES[building?.type];
    if (!blueprint?.storage) return false;
    if (!resourceType) return true;
    const accepted = blueprint.acceptsResources;
    return !Array.isArray(accepted) || accepted.includes(resourceType);
  }

  _resourceGatherMultiplier(node, faction = 'player') {
    let multiplier = 1;
    for (const building of this.buildings) {
      if (building.destroyed || building.progress < 1 || building.faction !== faction) continue;
      const bonus = BUILDING_TYPES[building.type]?.gatherBonus;
      if (!bonus || bonus.resourceType !== node.resourceType) continue;
      if (distance(building, node) <= bonus.radius) multiplier = Math.max(multiplier, bonus.multiplier);
    }
    return multiplier;
  }

  _resourceInteractionPoint(node, slot, unitType = 'villager') {
    const info = RESOURCE_TYPES[node.resourceType];
    const slotCount = resourceSlotCount(node);
    const angle = -Math.PI / 2 + (slot % slotCount) * (TAU / slotCount);
    const reach = resourceInteractionDistance(node, unitType);
    return {
      x: clamp(node.x + Math.cos(angle) * reach, 0.55, CONFIG.mapWidth - 0.55),
      z: clamp(node.z + Math.sin(angle) * reach, 0.55, CONFIG.mapHeight - 0.55),
    };
  }

  _buildingFootprint(buildingOrType, options = {}) {
    const type = typeof buildingOrType === 'string' ? buildingOrType : buildingOrType?.type;
    const blueprint = BUILDING_TYPES[type];
    if (!blueprint) return { width: 1, height: 1 };
    if (!blueprint.wall && !blueprint.gate) return { ...(blueprint.collisionFootprint ?? blueprint.footprint) };
    const source = typeof buildingOrType === 'object' ? buildingOrType : options;
    const segments = blueprint.wall ? Math.max(1, Math.round(source.wallSegments ?? options.wallSegments ?? 1)) : 1;
    const span = blueprint.wallSegmentSpan ?? blueprint.footprint.width;
    const length = blueprint.footprint.width + (segments - 1) * span;
    const direction = wallDirectionFromOptions(source);
    // Placement/pathfinding use a conservative axis-aligned envelope around
    // the oriented wall. That keeps diagonal runs safe without allowing a
    // unit to clip through a post at either end.
    return {
      width: Math.abs(direction.x) * length + Math.abs(direction.z) * blueprint.footprint.height,
      height: Math.abs(direction.z) * length + Math.abs(direction.x) * blueprint.footprint.height,
    };
  }

  _buildingCollisionCenter(buildingOrType, anchor = null) {
    const type = typeof buildingOrType === 'string' ? buildingOrType : buildingOrType?.type;
    const blueprint = BUILDING_TYPES[type];
    const source = anchor ?? (typeof buildingOrType === 'object' ? buildingOrType : null);
    const offset = blueprint?.collisionOffset ?? { x: 0, z: 0 };
    return {
      x: (source?.x ?? 0) + (offset.x ?? 0),
      z: (source?.z ?? 0) + (offset.z ?? 0),
    };
  }

  _buildingInteractionSlotCount(building) {
    return clamp(Math.round(BUILDING_TYPES[building?.type]?.interactionSlots ?? CONSTRUCTION_SLOT_COUNT), 4, CONSTRUCTION_SLOT_COUNT);
  }

  _buildingApproachPoints(building, margin = BUILDING_INTERACTION_DISTANCE) {
    const blueprint = BUILDING_TYPES[building.type];
    const footprint = this._buildingFootprint(building);
    const center = this._buildingCollisionCenter(building);
    const visualClearance = blueprint.collisionClearance ?? 0;
    const unitClearance = visualClearance + (blueprint.unitExclusionPadding ?? 0);
    const halfWidth = footprint.width / 2 + unitClearance + margin;
    const halfHeight = footprint.height / 2 + unitClearance + margin;
    if (blueprint.wall) {
      const geometry = this._wallLineGeometry(building);
      if (geometry) {
        const perpendicular = { x: -geometry.direction.z, z: geometry.direction.x };
        const sideDistance = geometry.halfThickness + (blueprint.unitExclusionPadding ?? 0) + margin;
        const usableHalfLength = Math.max(0, geometry.halfLength - (blueprint.wallSegmentSpan ?? 3) * 0.35);
        const longitudinalStops = usableHalfLength > 0.2 ? [-0.72, 0, 0.72] : [0];
        const points = [];
        for (const stop of longitudinalStops) {
          for (const side of [1, -1]) {
            points.push({
              x: geometry.center.x + geometry.direction.x * usableHalfLength * stop + perpendicular.x * sideDistance * side,
              z: geometry.center.z + geometry.direction.z * usableHalfLength * stop + perpendicular.z * sideDistance * side,
              priority: points.length,
            });
          }
        }
        const endDistance = geometry.halfLength + margin + (blueprint.unitExclusionPadding ?? 0);
        for (const end of [1, -1]) {
          points.push({
            x: geometry.center.x + geometry.direction.x * endDistance * end,
            z: geometry.center.z + geometry.direction.z * endDistance * end,
            priority: points.length,
          });
        }
        return points
          .slice(0, this._buildingInteractionSlotCount(building))
          .map((point) => ({
            x: clamp(point.x, 0.55, CONFIG.mapWidth - 0.55),
            z: clamp(point.z, 0.55, CONFIG.mapHeight - 0.55),
            priority: point.priority,
          }));
      }
    }
    if (blueprint.field && blueprint.walkable && building.progress >= 1) {
      const innerWidth = Math.max(0.7, footprint.width * 0.32);
      const innerHeight = Math.max(0.7, footprint.height * 0.32);
      return [
        { x: center.x, z: center.z },
        { x: center.x + innerWidth, z: center.z + innerHeight },
        { x: center.x - innerWidth, z: center.z + innerHeight },
        { x: center.x + innerWidth, z: center.z - innerHeight },
        { x: center.x - innerWidth, z: center.z - innerHeight },
      ].map((point, priority) => ({ ...point, priority }));
    }
    const vectors = [
      { x: 1, z: 1 },
      { x: 0, z: 1 },
      { x: 1, z: 0 },
      { x: -1, z: 1 },
      { x: 1, z: -1 },
      { x: -1, z: 0 },
      { x: 0, z: -1 },
      { x: -1, z: -1 },
    ];
    const points = [];
    for (const vector of vectors) {
      if (points.length >= this._buildingInteractionSlotCount(building)) break;
      const diagonal = vector.x !== 0 && vector.z !== 0;
      const edgeMargin = diagonal ? margin / Math.sqrt(2) : margin;
      points.push({
        x: center.x + vector.x * (footprint.width / 2 + unitClearance + (vector.x ? edgeMargin : 0)),
        z: center.z + vector.z * (footprint.height / 2 + unitClearance + (vector.z ? edgeMargin : 0)),
        priority: points.length,
      });
    }
    return points.map((point) => ({
      x: clamp(point.x, 0.55, CONFIG.mapWidth - 0.55),
      z: clamp(point.z, 0.55, CONFIG.mapHeight - 0.55),
      priority: point.priority ?? 0,
    }));
  }

  _storageApproachPoints(storage) {
    return this._buildingApproachPoints(storage, STORAGE_INTERACTION_DISTANCE)
      .map((point, slot) => ({ ...point, slot }));
  }

  _availableStorageApproachPoints(unit, storage) {
    const points = this._storageApproachPoints(storage);
    const reserved = storage.storageSlotReservations ?? new Map();
    const free = points.filter((point) => !reserved.has(point.slot) || reserved.get(point.slot) === unit.id);
    return free.length ? free : points;
  }

  _wallLineGeometry(wall) {
    const blueprint = BUILDING_TYPES[wall?.type];
    if (!blueprint?.wall) return null;
    const direction = wallDirectionFromOptions(wall);
    const count = Math.max(1, Math.round(wall.wallSegments ?? 1));
    const span = blueprint.wallSegmentSpan ?? blueprint.footprint.width;
    const length = blueprint.footprint.width + (count - 1) * span;
    const startCenter = wall.wallStart ?? {
      x: wall.x - direction.x * (count - 1) * span / 2,
      z: wall.z - direction.z * (count - 1) * span / 2,
    };
    const center = {
      x: startCenter.x + direction.x * (count - 1) * span / 2,
      z: startCenter.z + direction.z * (count - 1) * span / 2,
    };
    return {
      center,
      direction,
      halfLength: length / 2,
      halfThickness: blueprint.footprint.height / 2 + (blueprint.collisionClearance ?? 0),
    };
  }

  _distanceToWallCenterline(point, wall) {
    const geometry = this._wallLineGeometry(wall);
    if (!geometry) return Infinity;
    const offsetX = point.x - geometry.center.x;
    const offsetZ = point.z - geometry.center.z;
    const projection = clamp(
      offsetX * geometry.direction.x + offsetZ * geometry.direction.z,
      -geometry.halfLength,
      geometry.halfLength,
    );
    const closest = {
      x: geometry.center.x + geometry.direction.x * projection,
      z: geometry.center.z + geometry.direction.z * projection,
    };
    return distance(point, closest);
  }

  _distanceToBuildingEdge(point, building) {
    const wallGeometry = this._wallLineGeometry(building);
    if (wallGeometry) return Math.max(0, this._distanceToWallCenterline(point, building) - wallGeometry.halfThickness);
    const footprint = this._buildingFootprint(building);
    const center = this._buildingCollisionCenter(building);
    const visualClearance = BUILDING_TYPES[building.type].collisionClearance ?? 0;
    const dx = Math.max(Math.abs(point.x - center.x) - footprint.width / 2 - visualClearance, 0);
    const dz = Math.max(Math.abs(point.z - center.z) - footprint.height / 2 - visualClearance, 0);
    return Math.hypot(dx, dz);
  }

  _distanceToBuildingUnitEdge(point, building) {
    const extraClearance = BUILDING_TYPES[building.type]?.unitExclusionPadding ?? 0;
    if (extraClearance <= 0) return this._distanceToBuildingEdge(point, building);
    const wallGeometry = this._wallLineGeometry(building);
    if (wallGeometry) {
      return Math.max(0, this._distanceToWallCenterline(point, building) - wallGeometry.halfThickness - extraClearance);
    }
    const footprint = this._buildingFootprint(building);
    const center = this._buildingCollisionCenter(building);
    const visualClearance = (BUILDING_TYPES[building.type]?.collisionClearance ?? 0) + extraClearance;
    const dx = Math.max(Math.abs(point.x - center.x) - footprint.width / 2 - visualClearance, 0);
    const dz = Math.max(Math.abs(point.z - center.z) - footprint.height / 2 - visualClearance, 0);
    return Math.hypot(dx, dz);
  }

  _crownHallStairInfo(building) {
    const access = BUILDING_TYPES[building?.type]?.stairAccess;
    if (!access || building?.destroyed || building?.progress < 1) return null;
    const topZ = building.z + access.topOffset;
    const outerZ = building.z + access.outerOffset;
    return {
      topZ: Math.min(topZ, outerZ),
      outerZ: Math.max(topZ, outerZ),
      halfWidth: access.width / 2,
      visualRise: access.visualRise ?? 14,
      stepCount: access.stepCount ?? 8,
    };
  }

  _pointOnCrownHallStairs(point, building, padding = 0) {
    const stairs = this._crownHallStairInfo(building);
    if (!stairs) return false;
    return Math.abs(point.x - building.x) <= stairs.halfWidth + padding
      && point.z >= stairs.topZ - padding
      && point.z <= stairs.outerZ + padding;
  }

  _updateStairProgress(unit) {
    if (!unit.stairAccess || unit.dead) {
      unit.stairProgress = 0;
      unit.stairVisualRise = 0;
      return 0;
    }
    const hall = this.buildings.find((building) => this._pointOnCrownHallStairs(unit, building, 0.2));
    const stairs = hall ? this._crownHallStairInfo(hall) : null;
    if (!hall || !stairs) {
      unit.stairProgress = 0;
      unit.stairVisualRise = 0;
      return 0;
    }
    unit.stairVisualRise = stairs.visualRise;
    unit.stairProgress = clamp((stairs.outerZ - unit.z) / Math.max(0.001, stairs.outerZ - stairs.topZ), 0, 1);
    return unit.stairProgress;
  }

  _crownHallStairTarget(building, index = 0, total = 1) {
    const stairs = this._crownHallStairInfo(building);
    if (!stairs) return null;
    const lanes = Math.min(3, Math.max(1, total));
    const lane = index % lanes;
    const lateral = (lane - (lanes - 1) / 2) * 1.55;
    return {
      x: building.x + clamp(lateral, -stairs.halfWidth + 0.7, stairs.halfWidth - 0.7),
      z: stairs.topZ + 0.2,
    };
  }

  _sendUnitToCrownHallStairs(unit, building, index = 0, total = 1) {
    const target = this._crownHallStairTarget(building, index, total);
    if (!target) return false;
    unit.stairAccess = true;
    const path = this._buildPath(unit, target);
    if (!path) {
      unit.stairAccess = false;
      unit.stairProgress = 0;
      unit.path = [];
      unit.pathBlocked = true;
      unit.recoveryAvailable = true;
      unit.command = 'idle';
      unit.visualState = 'idle';
      unit.actionLabel = 'Crown Hall steps blocked';
      return false;
    }
    unit.path = path;
    unit.routeTarget = { ...target };
    unit.stopDistance = 0;
    unit.pathBlocked = false;
    unit.command = 'move';
    unit.visualState = 'walk';
    unit.actionLabel = 'Walking Crown Hall steps';
    this._resetMovementTracking(unit);
    return true;
  }

  _buildingEntityBounds(building, padding = 0) {
    const footprint = this._buildingFootprint(building);
    const center = this._buildingCollisionCenter(building);
    const visualClearance = BUILDING_TYPES[building.type].collisionClearance ?? 0;
    return {
      minX: center.x - footprint.width / 2 - visualClearance - padding,
      maxX: center.x + footprint.width / 2 + visualClearance + padding,
      minZ: center.z - footprint.height / 2 - visualClearance - padding,
      maxZ: center.z + footprint.height / 2 + visualClearance + padding,
    };
  }

  _resourceBlocksPoint(point, node, padding = 0) {
    const footprint = resourceFootprint(node);
    return distance(point, node) < footprint + padding;
  }

  _wallClearsResource(node) {
    return Boolean(node?.amount > 0 && WALL_CLEARABLE_RESOURCE_TYPES.has(node.resourceType));
  }

  _wallResourceWillBeCleared(node, placement) {
    if (!placement || placement.type !== 'wall' || !placement.clearResources || !this._wallClearsResource(node)) return false;
    const bounds = this._buildingBounds('wall', placement, BUILDING_CLEARANCE, placement);
    return this._circleIntersectsBounds(node, resourceFootprint(node), bounds);
  }

  _wallResourcesToClear(preview) {
    if (!preview?.clearResources) return [];
    const placement = {
      type: 'wall',
      x: preview.world.x,
      z: preview.world.z,
      progress: 1,
      ...preview,
    };
    return this.resourcesNodes.filter((node) => this._wallResourceWillBeCleared(node, placement));
  }

  _clearResourcesForWall(preview) {
    const cleared = this._wallResourcesToClear(preview);
    if (!cleared.length) return 0;
    const clearedIds = new Set(cleared.map((node) => node.id));
    for (const unit of this.units) {
      if (!clearedIds.has(unit.gatherTarget)) continue;
      this._releaseResourceSlot(unit);
      unit.gatherTarget = null;
      unit.gatherSlot = 0;
      unit.gatherTimer = 0;
      unit.gatherEventFired = false;
      if (unit.carryAmount > 0) {
        unit.actionLabel = 'Returning cargo';
        this._beginReturn(unit);
      } else {
        unit.path = [];
        unit.routeTarget = null;
        unit.command = 'idle';
        unit.visualState = 'idle';
        unit.actionLabel = 'Resource cleared for wall';
      }
    }
    this.resourcesNodes = this.resourcesNodes.filter((node) => !clearedIds.has(node.id));
    this.navigationVersion += 1;
    this.staticBlockerGridVersion = -1;
    this.selectedIds = this.selectedIds.filter((id) => !clearedIds.has(id));
    this._syncSelectionFlags();
    return cleared.length;
  }

  _clearDecorationsForWall(preview) {
    if (!preview?.clearResources) return 0;
    const placement = {
      type: 'wall',
      x: preview.world.x,
      z: preview.world.z,
      progress: 1,
      ...preview,
    };
    const bounds = this._buildingBounds('wall', placement, BUILDING_CLEARANCE, placement);
    const cleared = this.decorations.filter((decoration) => this._circleIntersectsBounds(
      decoration,
      DECORATION_FOOTPRINTS[decoration.type] ?? 0.45,
      bounds,
    ));
    if (cleared.length) {
      const clearedIds = new Set(cleared.map((decoration) => decoration.id));
      this.decorations = this.decorations.filter((decoration) => !clearedIds.has(decoration.id));
    }
    return cleared.length;
  }

  _placementEvictionCandidates(unit, building) {
    const role = SPACING_ROLES[unit.type] ?? SPACING_ROLES.villager;
    const wallGeometry = this._wallLineGeometry(building);
    if (wallGeometry) {
      const offsetX = unit.x - wallGeometry.center.x;
      const offsetZ = unit.z - wallGeometry.center.z;
      const projection = clamp(
        offsetX * wallGeometry.direction.x + offsetZ * wallGeometry.direction.z,
        -wallGeometry.halfLength,
        wallGeometry.halfLength,
      );
      const closest = {
        x: wallGeometry.center.x + wallGeometry.direction.x * projection,
        z: wallGeometry.center.z + wallGeometry.direction.z * projection,
      };
      const normal = { x: -wallGeometry.direction.z, z: wallGeometry.direction.x };
      const clearance = wallGeometry.halfThickness + (UNIT_TYPES[unit.type]?.radius ?? 0.4) + 0.35;
      return [1, -1, 1.55, -1.55].map((multiplier) => ({
        x: clamp(closest.x + normal.x * clearance * multiplier, 0.55, CONFIG.mapWidth - 0.55),
        z: clamp(closest.z + normal.z * clearance * multiplier, 0.55, CONFIG.mapHeight - 0.55),
      }));
    }
    const candidates = [];
    for (const margin of [0.82, 1.45, 2.2, 3.1, 4.2]) {
      candidates.push(...this._buildingApproachPoints(building, margin));
    }
    const center = this._buildingCollisionCenter(building);
    const footprint = this._buildingFootprint(building);
    const unitClearance = (BUILDING_TYPES[building.type]?.collisionClearance ?? 0)
      + (BUILDING_TYPES[building.type]?.unitExclusionPadding ?? 0);
    const radiusX = footprint.width / 2 + unitClearance + role.personalSpace;
    const radiusZ = footprint.height / 2 + unitClearance + role.personalSpace;
    for (let index = 0; index < 16; index += 1) {
      const angle = index * TAU / 16;
      candidates.push({
        x: clamp(center.x + Math.cos(angle) * radiusX, 0.55, CONFIG.mapWidth - 0.55),
        z: clamp(center.z + Math.sin(angle) * radiusZ, 0.55, CONFIG.mapHeight - 0.55),
      });
    }
    return candidates;
  }

  _relocateUnitsFromBuilding(building) {
    if (!building || !this._buildingHasCollision(building)) return 0;
    const affected = this.units.filter((unit) => !unit.dead
      && this._distanceToBuildingUnitEdge(unit, building) < (UNIT_TYPES[unit.type]?.radius ?? 0.4) + UNIT_STATIC_CLEARANCE + 0.05);
    if (!affected.length) return 0;
    const affectedIds = new Set(affected.map((unit) => unit.id));
    const occupied = this.units
      .filter((unit) => !unit.dead && !affectedIds.has(unit.id))
      .map((unit) => ({ x: unit.x, z: unit.z, type: unit.type }));
    let relocated = 0;
    for (const unit of affected) {
      const role = SPACING_ROLES[unit.type] ?? SPACING_ROLES.villager;
      const point = this._placementEvictionCandidates(unit, building).find((candidate) => {
        if (this._pointBlockedForUnit(unit, candidate)) return false;
        return occupied.every((other) => distance(candidate, other) >= Math.max(
          role.personalSpace,
          SPACING_ROLES[other.type]?.personalSpace ?? 1,
        ));
      });
      if (!point) continue;
      this._interruptWork(unit);
      unit.x = point.x;
      unit.z = point.z;
      unit.path = [];
      unit.routeTarget = null;
      unit.velocityX = 0;
      unit.velocityZ = 0;
      unit.motionSpeed = 0;
      unit.command = 'idle';
      unit.visualState = unit.carryType ? `carry:${unit.carryType}` : 'idle';
      unit.actionLabel = 'Cleared the new fortification';
      unit.pathBlocked = false;
      unit.recoveryAvailable = false;
      unit.stuckTimer = 0;
      unit.repathCooldown = 0;
      unit.lastProgressX = point.x;
      unit.lastProgressZ = point.z;
      occupied.push({ ...point, type: unit.type });
      relocated += 1;
    }
    return relocated;
  }

  _pointBlockedForUnit(unit, point, placement = null) {
    const padding = (UNIT_TYPES[unit.type]?.radius ?? 0.4) + UNIT_STATIC_CLEARANCE;
    const candidates = this._staticBlockerCandidates(point);
    for (const building of candidates) {
      if (building.kind !== 'building') continue;
      if (placement?.ignoreBuildingIds?.includes(building.id)) continue;
      if (!this._buildingHasCollision(building)) continue;
      const unitExclusion = BUILDING_TYPES[building.type]?.unitExclusionPadding ?? 0;
      if (unit.stairAccess && this._pointOnCrownHallStairs(point, building, padding + unitExclusion)) continue;
      if (this._distanceToBuildingUnitEdge(point, building) < padding - UNIT_COLLISION_EPSILON) return true;
    }
    if (placement && this._distanceToBuildingEdge(point, placement) < padding) return true;
    for (const node of candidates) {
      if (node.kind !== 'resource' || this._wallResourceWillBeCleared(node, placement) || node.amount <= 0) continue;
      if (this._resourceBlocksPoint(point, node, padding)) return true;
    }
    return false;
  }

  _isRecoverableUnit(unit) {
    // Recovery is an explicit beta-sandbox command, not a warning that only
    // appears after the pathfinder has already declared a Villager stuck.
    // Any selected living player unit may be returned to a clear Crown Hall
    // approach, which also gives the player a dependable escape from a bad
    // wall/tower placement without waiting for a hidden timeout.
    return Boolean(unit && !unit.dead && unit.faction === 'player' && UNIT_TYPES[unit.type]);
  }

  _isRecoverableVillager(unit) {
    return this._isRecoverableUnit(unit);
  }

  canRecoverSelectedUnits() {
    return this.units.some((unit) => this.selectedIds.includes(unit.id) && this._isRecoverableUnit(unit));
  }

  _crownHallRecoveryPoints(hall) {
    const points = [];
    const seen = new Set();
    const addPoint = (point) => {
      const safePoint = {
        x: clamp(point.x, 0.75, CONFIG.mapWidth - 0.75),
        z: clamp(point.z, 0.75, CONFIG.mapHeight - 0.75),
      };
      const key = `${safePoint.x.toFixed(2)}:${safePoint.z.toFixed(2)}`;
      if (!seen.has(key)) {
        seen.add(key);
        points.push(safePoint);
      }
    };

    // Prefer the Hall's authored interaction ring so recovery lands where a
    // normal worker would return cargo, then widen the search only when the
    // civic approach is occupied by a wall, building, or another unit.
    for (const margin of [STORAGE_INTERACTION_DISTANCE, 1.35, 2.05, 2.8]) {
      this._buildingApproachPoints(hall, margin).forEach(addPoint);
    }
    const footprint = this._buildingFootprint(hall);
    const center = this._buildingCollisionCenter(hall);
    const clearance = BUILDING_TYPES[hall.type].collisionClearance ?? 0;
    for (const margin of [1.25, 2.1, 3.1, 4.2]) {
      const radiusX = footprint.width / 2 + clearance + margin;
      const radiusZ = footprint.height / 2 + clearance + margin;
      for (let index = 0; index < 12; index += 1) {
        const angle = -Math.PI / 2 + index * TAU / 12;
        addPoint({ x: center.x + Math.cos(angle) * radiusX, z: center.z + Math.sin(angle) * radiusZ });
      }
    }
    return points;
  }

  _findCrownHallRecoveryPoint(unit, hall, occupiedPoints = []) {
    const role = SPACING_ROLES[unit.type] ?? SPACING_ROLES.villager;
    return this._crownHallRecoveryPoints(hall).find((point) => {
      if (this._pointBlockedForUnit(unit, point)) return false;
      if (occupiedPoints.some((occupied) => distance(point, occupied) < role.personalSpace)) return false;
      return this.units.every((other) => other === unit || other.dead || !other.faction
        || distance(point, other) >= Math.max(role.personalSpace, SPACING_ROLES[other.type]?.personalSpace ?? 1));
    }) ?? null;
  }

  _depositRecoveredCargo(unit, hall) {
    if (!unit.carryAmount || !unit.carryType || !this._storageAccepts(hall, unit.carryType)) return 0;
    const resourceType = unit.carryType;
    const availableSpace = Math.max(0, RESOURCE_TYPES[resourceType].capacity - this.resources[resourceType]);
    const deposited = Math.min(unit.carryAmount, availableSpace);
    this.resources[resourceType] += deposited;
    unit.carryAmount -= deposited;
    if (deposited > 0) this.animation.emit(unit, ANIMATION_EVENTS.depositComplete, {
      resourceType,
      amount: deposited,
      storageId: hall.id,
      x: hall.x,
      z: hall.z,
    });
    if (unit.carryAmount <= 0) unit.carryType = null;
    return deposited;
  }

  unstickSelectedUnits() {
    const recoverable = this.units.filter((unit) => this.selectedIds.includes(unit.id) && this._isRecoverableUnit(unit));
    if (!recoverable.length) return { kind: 'recover', success: false, count: 0 };
    const hall = this.buildings.find((building) => building.type === 'townCenter'
      && building.faction === 'player'
      && !building.destroyed
      && building.progress >= 1);
    if (!hall) {
      this._announce('The Crown Hall is unavailable for unit recovery.');
      return { kind: 'recover', success: false, count: 0 };
    }
    const occupiedPoints = [];
    let recovered = 0;
    for (const unit of recoverable) {
      const point = this._findCrownHallRecoveryPoint(unit, hall, occupiedPoints);
      if (!point) continue;
      this._interruptWork(unit);
      this._depositRecoveredCargo(unit, hall);
      unit.x = point.x;
      unit.z = point.z;
      unit.path = [];
      unit.routeTarget = null;
      unit.returnStorageId = null;
      unit.velocityX = 0;
      unit.velocityZ = 0;
      unit.motionSpeed = 0;
      unit.animationPlaybackRate = 1;
      unit.command = 'idle';
      unit.visualState = unit.carryType ? `carry:${unit.carryType}` : 'idle';
      unit.actionLabel = unit.carryType ? 'Recovered at Crown Hall with cargo' : 'Recovered at Crown Hall';
      unit.pathBlocked = false;
      unit.recoveryAvailable = false;
      unit.stuckTimer = 0;
      unit.repathCooldown = 0;
      unit.lastProgressX = point.x;
      unit.lastProgressZ = point.z;
      occupiedPoints.push(point);
      recovered += 1;
    }
    if (!recovered) {
      this._announce('No clear approach space is available around the Crown Hall.');
      return { kind: 'recover', success: false, count: 0 };
    }
    this._announce(`Recovered ${recovered} unit${recovered === 1 ? '' : 's'} at the Crown Hall.`);
    return { kind: 'recover', success: true, count: recovered, hallId: hall.id };
  }

  _cellIntersectsResource(cellX, cellZ, node, padding = 0) {
    const closestX = clamp(node.x, cellX, cellX + 1);
    const closestZ = clamp(node.z, cellZ, cellZ + 1);
    return Math.hypot(node.x - closestX, node.z - closestZ) < resourceFootprint(node) + padding;
  }

  _isPathCellBlocked(unit, cellX, cellZ, placement = null, allowedPoint = null) {
    if (cellX < 0 || cellZ < 0 || cellX >= CONFIG.mapWidth || cellZ >= CONFIG.mapHeight) return true;
    if (allowedPoint && Math.floor(allowedPoint.x) === cellX && Math.floor(allowedPoint.z) === cellZ && !this._pointBlockedForUnit(unit, allowedPoint, placement)) return false;
    const padding = (UNIT_TYPES[unit.type]?.radius ?? 0.4) + UNIT_STATIC_CLEARANCE;
    const cellPoint = { x: cellX + 0.5, z: cellZ + 0.5 };
    const candidates = this._staticBlockerCandidates(cellPoint);
    for (const building of candidates) {
      if (building.kind !== 'building') continue;
      if (placement?.ignoreBuildingIds?.includes(building.id)) continue;
      if (!this._buildingHasCollision(building)) continue;
      const unitExclusion = BUILDING_TYPES[building.type]?.unitExclusionPadding ?? 0;
      if (unit.stairAccess && this._pointOnCrownHallStairs(cellPoint, building, padding + unitExclusion + 0.25)) continue;
      if (this._buildingBlocksCell(cellX, cellZ, building)
        || this._cellIntersectsBuilding(cellX, cellZ, building, padding + unitExclusion)) return true;
    }
    if (placement && (this._buildingBlocksCell(cellX, cellZ, placement) || this._cellIntersectsBuilding(cellX, cellZ, placement, padding))) return true;
    // Keep the resource's own footprint out of the grid. The precise unit
    // radius is enforced by _constrainUnitPosition so approach cells remain
    // usable for gathering slots around the perimeter.
    for (const node of candidates) {
      if (node.kind !== 'resource' || this._wallResourceWillBeCleared(node, placement) || node.amount <= 0) continue;
      if (this._cellIntersectsResource(cellX, cellZ, node)) return true;
    }
    return false;
  }

  _pathCacheKey(unit, target, placement = null) {
    const placementKey = placement
      ? `${placement.type ?? 'placement'}:${Math.round(placement.x * 2)}:${Math.round(placement.z * 2)}:${(placement.ignoreBuildingIds ?? []).join(',')}`
      : 'world';
    return [
      this.navigationVersion,
      unit.type,
      unit.stairAccess ? 1 : 0,
      Math.floor(unit.x), Math.floor(unit.z),
      Math.round(target.x * 2), Math.round(target.z * 2),
      placementKey,
    ].join('|');
  }

  _cachePath(key, path) {
    this.pathCache.set(key, path ? path.map((point) => ({ ...point })) : null);
    while (this.pathCache.size > (CONFIG.pathCacheLimit ?? 256)) {
      this.pathCache.delete(this.pathCache.keys().next().value);
    }
  }

  _buildPath(unit, target, placement = null, { directOnly = false } = {}) {
    const safeTarget = {
      x: clamp(target.x, 0.55, CONFIG.mapWidth - 0.55),
      z: clamp(target.z, 0.55, CONFIG.mapHeight - 0.55),
    };
    const cacheKey = this._pathCacheKey(unit, safeTarget, placement);
    if (this.pathCache.has(cacheKey)) {
      this.pathCacheHitsLastStep += 1;
      const cached = this.pathCache.get(cacheKey);
      // Refresh the entry in insertion order so frequently used routes stay
      // in the small LRU cache during the 999-unit stress run.
      this.pathCache.delete(cacheKey);
      this.pathCache.set(cacheKey, cached);
      return cached ? cached.map((point) => ({ ...point })) : null;
    }
    const targetCell = { x: Math.floor(safeTarget.x), z: Math.floor(safeTarget.z) };
    const isBlocked = (x, z) => this._isPathCellBlocked(unit, x, z, placement, targetCell.x === x && targetCell.z === z ? safeTarget : null);
    const targetCellOpen = !isBlocked(targetCell.x, targetCell.z);
    // Most player orders stay inside one clearing. A continuous collision
    // probe is substantially cheaper than constructing a large A* frontier,
    // and gives the unit a route during the same click event. Keep the result
    // in the ordinary route cache so followers and retries share it.
    if (targetCellOpen && !this._pathSegmentBlocked(unit, unit, safeTarget, placement)) {
      const directPath = [{ x: safeTarget.x, z: safeTarget.z }];
      this._cachePath(cacheKey, directPath);
      return directPath;
    }
    if (directOnly) return null;
    this.pathRequestsLastStep += 1;
    const path = findPath(unit, safeTarget, isBlocked, CONFIG.mapWidth, CONFIG.mapHeight, {
      segmentClear: (start, end) => !this._pathSegmentBlocked(unit, start, end, placement),
    });
    if (!path.length && distance(unit, safeTarget) > PATH_REACH_TOLERANCE) {
      if (!targetCellOpen) {
        this._cachePath(cacheKey, null);
        return null;
      }
      // An empty A* result means the destination is not connected to the
      // current cell. The only safe direct fallback is when both points are
      // already inside the same open cell; otherwise let the caller choose a
      // different storage or interaction slot.
      if (Math.floor(unit.x) === targetCell.x && Math.floor(unit.z) === targetCell.z) {
        const directPath = [{ x: safeTarget.x, z: safeTarget.z }];
        this._cachePath(cacheKey, directPath);
        return directPath;
      }
      this._cachePath(cacheKey, null);
      return null;
    }
    // A* may end on a nearby walkable cell when a destination is blocked. Never
    // replace that safe endpoint with the original blocked destination.
    if (path.length && targetCellOpen && distance(path[path.length - 1], safeTarget) <= 1.3) {
      path[path.length - 1] = { x: safeTarget.x, z: safeTarget.z };
    }
    this._cachePath(cacheKey, path);
    return path;
  }

  _resetMovementTracking(unit) {
    unit.stuckTimer = 0;
    unit.recoveryAvailable = false;
    unit.repathCooldown = UNIT_REPATH_COOLDOWN;
    unit.lastProgressX = unit.x;
    unit.lastProgressZ = unit.z;
  }

  _replanUnit(unit) {
    if (unit.dead) return false;
    if (unit.command === 'gather') {
      const node = this.resourcesNodes.find((candidate) => candidate.id === unit.gatherTarget && candidate.amount > 0);
      return node ? this._sendUnitToResource(unit, node) : false;
    }
    if (unit.command === 'return') {
      const storage = this._getReturnStorage(unit) ?? this._nearestStorage(unit, unit.carryType);
      return storage ? this._sendUnitToStorage(unit, storage) : false;
    }
    if (unit.command === 'attack') {
      const target = this._getAttackTarget(unit);
      return target ? this._sendUnitToAttack(unit, target, unit.attackSlot) : false;
    }
    if (unit.command === 'build') {
      const building = this.buildings.find((candidate) => candidate.id === unit.buildTarget && this.buildingNeedsWork(candidate));
      return building ? this._sendUnitToBuilding(unit, building) : false;
    }
    if (unit.command === 'demolish') {
      const building = this.buildings.find((candidate) => candidate.id === unit.demolishTarget && this.canDemolishBuilding(candidate));
      return building ? this._sendUnitToDemolish(unit, building, unit.demolishSlot) : false;
    }
    if (unit.command === 'move' && unit.routeTarget) {
      return this._sendUnitTo(unit, unit.routeTarget, 'move', unit.stopDistance ?? 0);
    }
    return false;
  }

  _requestRepath(unit) {
    if (this.repathBudgetRemaining <= 0) {
      // Keep the current route alive for a short window rather than allowing
      // a crowd to launch hundreds of synchronous A* calls in one tick. A
      // deferred request is not a failed route; the next budget window will
      // retry it without triggering the stuck recovery state.
      unit.repathCooldown = Math.max(unit.repathCooldown, 0.12);
      unit.pathfindingDeferred = true;
      return null;
    }
    this.repathBudgetRemaining -= 1;
    this.repathRequestsLastStep += 1;
    unit.pathfindingDeferred = false;
    return this._replanUnit(unit);
  }

  _pathSegmentBlocked(unit, start, end, placement = null) {
    const span = Math.max(Math.abs(end.x - start.x), Math.abs(end.z - start.z));
    const steps = Math.max(1, Math.ceil(span * 8));
    for (let index = 1; index <= steps; index += 1) {
      const ratio = index / steps;
      const x = start.x + (end.x - start.x) * ratio;
      const z = start.z + (end.z - start.z) * ratio;
      if (x < 0.45 || z < 0.45 || x > CONFIG.mapWidth - 0.45 || z > CONFIG.mapHeight - 0.45) return true;
      if (this._pointBlockedForUnit(unit, { x, z }, placement)) return true;
    }
    return false;
  }

  _bestPathToPoints(unit, points, placement = null) {
    let best = null;
    points.forEach((point, slot) => {
      const path = this._buildPath(unit, point, placement);
      if (!path) return;
      const resolvedSlot = Number.isInteger(point.slot) ? point.slot : slot;
      const score = path.length * 1.1 + distance(unit, point) * 0.2 + (point.priority ?? resolvedSlot) * 0.7;
      if (!best || score < best.score) best = { path, point, slot: resolvedSlot, score };
    });
    return best;
  }

  _reserveBuildingSlot(unit, building, preferredSlot = 0) {
    if (!building.buildSlotReservations) building.buildSlotReservations = new Map();
    if (!Array.isArray(building.buildAssigned)) building.buildAssigned = building.buildAssigned ? [building.buildAssigned] : [];
    this._releaseBuildingSlot(unit);
    const slotCount = this._buildingInteractionSlotCount(building);
    const start = Number.isInteger(preferredSlot) && preferredSlot >= 0 ? preferredSlot % slotCount : 0;
    for (let offset = 0; offset < slotCount; offset += 1) {
      const slot = (start + offset) % slotCount;
      if (building.buildSlotReservations.has(slot)) continue;
      building.buildSlotReservations.set(slot, unit.id);
      if (!building.buildAssigned.includes(unit.id)) building.buildAssigned.push(unit.id);
      unit.buildSlot = slot;
      return slot;
    }
    unit.buildSlot = -1;
    return -1;
  }

  _demolitionApproachPoints(building) {
    return this._buildingApproachPoints(building, DEMOLITION_INTERACTION_DISTANCE);
  }

  _reserveDemolitionSlot(unit, building, preferredSlot = 0) {
    if (!building.demolitionSlotReservations) building.demolitionSlotReservations = new Map();
    if (!Array.isArray(building.demolitionAssigned)) building.demolitionAssigned = [];
    this._releaseDemolitionSlot(unit, { preserveTargetState: true });
    const start = Number.isInteger(preferredSlot) && preferredSlot >= 0 ? preferredSlot % DEMOLITION_SLOT_COUNT : 0;
    for (let offset = 0; offset < DEMOLITION_SLOT_COUNT; offset += 1) {
      const slot = (start + offset) % DEMOLITION_SLOT_COUNT;
      if (building.demolitionSlotReservations.has(slot)) continue;
      building.demolitionSlotReservations.set(slot, unit.id);
      if (!building.demolitionAssigned.includes(unit.id)) building.demolitionAssigned.push(unit.id);
      unit.demolishTarget = building.id;
      unit.demolishSlot = slot;
      return slot;
    }
    unit.demolishTarget = building.id;
    unit.demolishSlot = -1;
    return -1;
  }

  _sendUnitToDemolish(unit, building, preferredSlot = null) {
    if (!this._isDemolitionUnit(unit) || !this._markBuildingForDemolition(building)) return false;
    unit.demolishTarget = building.id;
    const points = this._demolitionApproachPoints(building);
    const reserved = building.demolitionSlotReservations ?? new Map();
    const start = Number.isInteger(preferredSlot) && preferredSlot >= 0 ? preferredSlot % DEMOLITION_SLOT_COUNT : 0;
    const orderedSlots = Array.from({ length: DEMOLITION_SLOT_COUNT }, (_, offset) => (start + offset) % DEMOLITION_SLOT_COUNT);
    const freeSlots = orderedSlots.filter((slot) => !reserved.has(slot) || reserved.get(slot) === unit.id);
    const candidateSlots = freeSlots.length ? freeSlots : orderedSlots;
    let route = null;
    for (const slot of candidateSlots) {
      const point = points[slot];
      const path = this._buildPath(unit, point);
      if (!path) continue;
      const score = path.length * 1.1 + distance(unit, point) * 0.2;
      if (!route || score < route.score) route = { path, point, slot, score };
    }
    if (!route) {
      this._releaseDemolitionSlot(unit);
      unit.path = [];
      unit.pathBlocked = true;
      unit.recoveryAvailable = true;
      unit.command = 'idle';
      unit.visualState = 'idle';
      unit.actionLabel = 'Demolition route blocked';
      return false;
    }
    this._reserveDemolitionSlot(unit, building, route.slot);
    unit.path = route.path;
    unit.routeTarget = route.point;
    unit.stopDistance = DEMOLITION_INTERACTION_DISTANCE;
    unit.pathBlocked = false;
    unit.command = 'demolish';
    unit.visualState = 'walk';
    unit.actionLabel = `Walking to dismantle ${BUILDING_TYPES[building.type].label}`;
    this._resetMovementTracking(unit);
    return true;
  }

  _sendUnitToBuilding(unit, building, preferredSlot = null) {
    const points = this._buildingApproachPoints(building);
    const reserved = building.buildSlotReservations ?? new Map();
    const slotCount = Math.min(points.length, this._buildingInteractionSlotCount(building));
    const orderedSlots = Array.from({ length: slotCount }, (_, offset) => {
      const start = Number.isInteger(preferredSlot) && preferredSlot >= 0 ? preferredSlot % slotCount : 0;
      return (start + offset) % slotCount;
    });
    const freeSlots = orderedSlots.filter((slot) => !reserved.has(slot) || reserved.get(slot) === unit.id);
    const candidateSlots = freeSlots.length ? freeSlots : orderedSlots;
    let route = null;
    for (const slot of candidateSlots) {
      const point = points[slot];
      const path = this._buildPath(unit, point);
      if (!path) continue;
      const score = path.length * 1.1 + distance(unit, point) * 0.2 + (point.priority ?? slot) * 0.7;
      if (!route || score < route.score) route = { path, point, slot, score };
    }
    if (!route) {
      const waitingSlot = candidateSlots[0] ?? 0;
      const waitingPoint = points[waitingSlot] ?? this._buildingCollisionCenter(building);
      this._reserveBuildingSlot(unit, building, waitingSlot);
      unit.path = [];
      unit.routeTarget = waitingPoint;
      unit.pathBlocked = false;
      unit.recoveryAvailable = false;
      unit.command = 'build';
      unit.visualState = 'walk';
      unit.repathCooldown = UNIT_REPATH_COOLDOWN;
      unit.actionLabel = building.progress < 1 ? 'Finding a build approach' : 'Finding a repair approach';
      return true;
    }
    this._reserveBuildingSlot(unit, building, route.slot);
    unit.path = route.path;
    unit.routeTarget = route.point;
    unit.stopDistance = BUILDING_INTERACTION_DISTANCE;
    unit.pathBlocked = false;
    unit.command = 'build';
    unit.actionLabel = building.progress < 1
      ? 'Walking to build site'
      : `Walking to repair ${BUILDING_TYPES[building.type].label}`;
    this._resetMovementTracking(unit);
    return true;
  }

  _resourceWorkCandidates(unit, resourceType, origin = unit, preferredNode = null, radius = Infinity, footprintMultiplier = 1) {
    if (!resourceType) return [];
    const available = this.resourcesNodes
      .filter((node) => node.amount > 0
        && node.resourceType === resourceType
        && distance(node, origin) <= radius + resourceFootprint(node) * footprintMultiplier);
    const preferred = preferredNode
      && preferredNode.amount > 0
      && preferredNode.resourceType === resourceType
      && available.some((node) => node.id === preferredNode.id)
      ? preferredNode
      : null;
    const alternatives = available
      .filter((node) => node.id !== preferred?.id)
      .sort((a, b) => {
        const scoreA = distance(a, origin) * 1.25 + distance(a, unit) * 0.35;
        const scoreB = distance(b, origin) * 1.25 + distance(b, unit) * 0.35;
        return scoreA - scoreB || a.id - b.id;
      });
    return [...(preferred ? [preferred] : []), ...alternatives].slice(0, RESOURCE_INTENT_MAX_CANDIDATES);
  }

  _assignResourceWork(unit, {
    resourceType,
    origin = unit,
    preferredNode = null,
    radius = Infinity,
    footprintMultiplier = 1,
    preferredSlot = null,
    label = null,
  } = {}) {
    if (!this.isWorkerUnit(unit) || !resourceType) return null;
    const candidates = this._resourceWorkCandidates(unit, resourceType, origin, preferredNode, radius, footprintMultiplier);
    for (const node of candidates) {
      unit.gatherTarget = node.id;
      unit.gatherSlot = Number.isInteger(preferredSlot)
        ? preferredSlot % resourceSlotCount(node)
        : unit.id % resourceSlotCount(node);
      unit.gatherTimer = 0;
      unit.gatherEventFired = false;
      unit.postDepositTarget = null;
      if (!this._sendUnitToResource(unit, node)) continue;
      if (label) unit.actionLabel = label;
      unit.needsSafetyRegroup = false;
      unit.idleDuration = 0;
      return node;
    }
    this._releaseResourceSlot(unit);
    unit.gatherTarget = null;
    return null;
  }

  _sendUnitToResource(unit, node) {
    if (!node || node.amount <= 0) return false;
    if (!node.reservedSlots) node.reservedSlots = new Map();
    const slotCount = resourceSlotCount(node);
    const preferredSlot = Number.isInteger(unit.gatherSlot) ? unit.gatherSlot % slotCount : 0;
    const orderedSlots = Array.from({ length: slotCount }, (_, offset) => (preferredSlot + offset) % slotCount);
    const freeSlots = orderedSlots.filter((slot) => !node.reservedSlots.has(slot) || node.reservedSlots.get(slot) === unit.id);
    const candidateSlots = freeSlots.length ? freeSlots : orderedSlots;
    const routeCandidates = candidateSlots.map((slot, order) => {
      const point = this._resourceInteractionPoint(node, slot, unit.type);
      // Prefer the screen-front half of a resource ring. The rear slots are
      // mechanically valid, but a worker placed there can disappear behind a
      // tree or berry canopy at the fixed camera zoom. Keeping the preference
      // in route selection preserves depth sorting while making the worker's
      // tool pose readable during the work loop.
      const frontBias = (point.x + point.z) - (node.x + node.z);
      return {
        point,
        slot,
        order,
        frontBias,
        readable: frontBias >= RESOURCE_READABLE_FRONT_BIAS,
        proximity: distance(unit, point),
      };
    }).sort((a, b) => (a.proximity + (a.readable ? 0 : 6)) - (b.proximity + (b.readable ? 0 : 6))
      || Number(b.readable) - Number(a.readable)
      || a.order - b.order);
    let route = null;
    for (const candidate of routeCandidates.slice(0, RESOURCE_ROUTE_ATTEMPT_LIMIT)) {
      const path = this._buildPath(unit, candidate.point);
      if (!path) continue;
      route = { ...candidate, path };
      break;
    }
    if (!route) {
      this._releaseResourceSlot(unit);
      unit.command = 'idle';
      unit.path = [];
      unit.pathBlocked = true;
      unit.recoveryAvailable = true;
      unit.visualState = 'idle';
      unit.actionLabel = 'No route to resource';
      return false;
    }
    this._reserveResourceSlot(unit, node, route.slot);
    unit.path = route.path;
    unit.routeTarget = route.point;
    unit.stopDistance = resourceInteractionDistance(node, unit.type);
    unit.pathBlocked = false;
    unit.command = 'gather';
    unit.actionLabel = `Walking to ${RESOURCE_TYPES[node.resourceType].label}`;
    this._resetMovementTracking(unit);
    return true;
  }

  _findStorageRoute(unit, resourceType = unit.carryType) {
    const storages = this.buildings
      .filter((building) => !building.destroyed
        && building.faction === unit.faction
        && building.progress >= 1
        && this._storageAccepts(building, resourceType))
      .sort((a, b) => this._distanceToBuildingEdge(unit, a) - this._distanceToBuildingEdge(unit, b));
    for (const storage of storages) {
      const route = this._bestPathToPoints(unit, this._availableStorageApproachPoints(unit, storage));
      if (route) return { storage, path: route.path, slot: route.slot, point: route.point };
    }
    return null;
  }

  _sendUnitToStorage(unit, storage) {
    this._releaseStorageSlot(unit);
    if (!this._storageAccepts(storage, unit.carryType)) {
      const fallback = this._findStorageRoute(unit);
      if (!fallback) {
        unit.pathBlocked = true;
        unit.recoveryAvailable = true;
        unit.actionLabel = 'No compatible drop-off';
        return false;
      }
      storage = fallback.storage;
    }
    const points = this._availableStorageApproachPoints(unit, storage);
    const route = this._bestPathToPoints(unit, points);
    if (!route) {
      const fallback = this._findStorageRoute(unit);
      if (!fallback) {
        unit.pathBlocked = true;
        unit.recoveryAvailable = true;
        unit.actionLabel = 'Drop-off route blocked';
        return false;
      }
      this._reserveStorageSlot(unit, fallback.storage, fallback.slot);
      unit.path = fallback.path;
      unit.routeTarget = fallback.point;
      unit.stopDistance = STORAGE_INTERACTION_DISTANCE;
      unit.pathBlocked = false;
      this._resetMovementTracking(unit);
      return true;
    }
    this._reserveStorageSlot(unit, storage, route.slot);
    unit.path = route.path;
    unit.routeTarget = route.point;
    unit.stopDistance = STORAGE_INTERACTION_DISTANCE;
    unit.pathBlocked = false;
    this._resetMovementTracking(unit);
    return true;
  }

  _findNearestHostile(unit) {
    const attackerRules = UNIT_TYPES[unit.type] ?? {};
    const unitTargets = attackerRules.canAttackUnits === false ? [] : this.units.filter((candidate) => !candidate.dead && candidate.faction !== unit.faction && candidate.faction !== 'neutral');
    const buildingTargets = attackerRules.canAttackBuildings === false ? [] : this.buildings.filter((candidate) => {
      if (candidate.destroyed || candidate.hp <= 0 || candidate.progress < 1 || candidate.faction === unit.faction || candidate.faction === 'neutral') return false;
      return unit.faction === 'player' ? Boolean(BUILDING_TYPES[candidate.type].enemyStructure) : candidate.type === 'townCenter';
    });
    return [...unitTargets, ...buildingTargets]
      .sort((a, b) => this._targetDistance(unit, a) - this._targetDistance(unit, b))[0] ?? null;
  }

  _getAttackTarget(unit) {
    if (unit.attackTarget) {
      const target = unit.attackTargetKind === 'building'
        ? this.buildings.find((candidate) => candidate.id === unit.attackTarget && !candidate.destroyed && candidate.hp > 0 && candidate.progress >= 1)
        : this.units.find((candidate) => candidate.id === unit.attackTarget && !candidate.dead);
      if (target && target.faction !== unit.faction && target.faction !== 'neutral') return target;
    }
    return this._findNearestHostile(unit);
  }

  _targetDistance(attacker, target) {
    return target.kind === 'building' ? this._distanceToBuildingUnitEdge(attacker, target) : distance(attacker, target);
  }

  _targetLabel(target) {
    return target.kind === 'building' ? BUILDING_TYPES[target.type].label : UNIT_TYPES[target.type].label;
  }

  _hasCombatLineOfSight(attacker, target) {
    const targetPoint = target.kind === 'building' ? this._buildingCollisionCenter(target) : target;
    const span = distance(attacker, targetPoint);
    const steps = Math.max(2, Math.ceil(span * 5));
    for (let index = 1; index < steps; index += 1) {
      const ratio = index / steps;
      const x = attacker.x + (targetPoint.x - attacker.x) * ratio;
      const z = attacker.z + (targetPoint.z - attacker.z) * ratio;
      if (target.kind === 'building' && this._cellIntersectsBuilding(Math.floor(x), Math.floor(z), target)) continue;
      if (this.isBlocked(Math.floor(x), Math.floor(z))) return false;
    }
    return true;
  }

  _combatApproachPoints(unit, target) {
    if (target.kind === 'building') {
      const margin = Math.max(UNIT_TYPES[unit.type].range - COMBAT_SLOT_MARGIN, UNIT_TYPES[unit.type].radius + 0.08);
      return this._buildingApproachPoints(target, margin)
        .map((point, slot) => ({ point, slot }))
        .filter(({ point }) => this._hasCombatLineOfSight(point, target));
    }
    const targetRadius = target.kind === 'building'
      ? Math.max(this._buildingFootprint(target).width, this._buildingFootprint(target).height) / 2
        + (BUILDING_TYPES[target.type].collisionClearance ?? 0)
      : UNIT_TYPES[target.type].radius;
    const ringRadius = Math.max(UNIT_TYPES[unit.type].range - COMBAT_SLOT_MARGIN, UNIT_TYPES[unit.type].radius + targetRadius + 0.08);
    const points = [];
    for (const expansion of [0, 1.4]) {
      for (let offset = 0; offset < COMBAT_SLOT_COUNT; offset += 1) {
        const slot = (unit.attackSlot + offset) % COMBAT_SLOT_COUNT;
        const angle = (slot / COMBAT_SLOT_COUNT) * TAU;
        const point = {
          x: clamp(target.x + Math.cos(angle) * (ringRadius + expansion), 0.55, CONFIG.mapWidth - 0.55),
          z: clamp(target.z + Math.sin(angle) * (ringRadius + expansion), 0.55, CONFIG.mapHeight - 0.55),
        };
        if (this._hasCombatLineOfSight(point, target)) points.push({ point, slot });
      }
    }
    return points;
  }

  _bestCombatRoute(unit, target) {
    const candidates = this._combatApproachPoints(unit, target);
    const reserved = target.combatSlotReservations ?? new Map();
    const freeCandidates = candidates.filter(({ slot }) => !reserved.has(slot) || reserved.get(slot) === unit.id);
    const orderedCandidates = freeCandidates.length ? freeCandidates : candidates;
    // Combat approach points are already ordered from the unit's preferred
    // slot around the target. The old shortest-path comparison ran a full
    // long-map A* query for every one of the eight ring positions before
    // choosing a result. On the first raid that created a multi-second main
    // thread stall. Take the first reachable free slot and let normal route
    // blocking/repathing handle later changes.
    for (const candidate of orderedCandidates) {
      const path = this._buildPath(unit, candidate.point);
      if (!path) continue;
      return { ...candidate, path };
    }
    return null;
  }

  _dislodgeEmbeddedCombatTarget(target) {
    if (!target || target.kind !== 'unit' || target.dead) return false;
    const unitRadius = (UNIT_TYPES[target.type]?.radius ?? 0.4) + UNIT_STATIC_CLEARANCE + 0.05;
    const containingBuildings = this._staticBlockerCandidates(target)
      .filter((building) => building.kind === 'building'
        && this._buildingHasCollision(building)
        && !(target.stairAccess && this._pointOnCrownHallStairs(target, building, unitRadius))
        && this._distanceToBuildingUnitEdge(target, building) < unitRadius - UNIT_COLLISION_EPSILON);
    if (!containingBuildings.length) return false;

    // Enemy units never use the player-only Crown Hall stair corridor. Clear
    // stale stair state before applying the ordinary collision projection so
    // a hostile cannot inherit an exception and become untouchable inside a
    // landmark after a save, collision push, or high-speed approach.
    if (target.faction === 'enemy') {
      target.stairAccess = false;
      target.stairProgress = 0;
      target.stairVisualRise = 0;
    }

    const before = { x: target.x, z: target.z };
    this._constrainUnitPosition(target, target.x, target.z);
    let stillEmbedded = containingBuildings.some((building) => this._distanceToBuildingUnitEdge(target, building) < unitRadius - UNIT_COLLISION_EPSILON);
    if (stillEmbedded) {
      const occupied = this.units.filter((unit) => unit !== target && !unit.dead);
      const candidates = containingBuildings
        .flatMap((building) => this._placementEvictionCandidates(target, building))
        .sort((a, b) => distance(a, before) - distance(b, before));
      const open = candidates.find((point) => !this._pointBlockedForUnit(target, point)
        && occupied.every((unit) => distance(point, unit) >= Math.max(
          UNIT_TYPES[target.type]?.radius ?? 0.4,
          UNIT_TYPES[unit.type]?.radius ?? 0.4,
        )));
      if (open) {
        target.x = open.x;
        target.z = open.z;
        stillEmbedded = false;
      }
    }

    if (stillEmbedded) return false;
    target.path = [];
    target.routeTarget = null;
    target.velocityX = 0;
    target.velocityZ = 0;
    target.motionSpeed = 0;
    target.pathBlocked = false;
    target.recoveryAvailable = false;
    target.stuckTimer = 0;
    target.repathCooldown = 0;
    target.lastProgressX = target.x;
    target.lastProgressZ = target.z;
    return distance(before, target) > 0.001;
  }

  _sendUnitToAttack(unit, target, slot = 0, options = {}) {
    if (!target || target.hp <= 0 || target.dead || target.destroyed) return false;
    const attackerRules = UNIT_TYPES[unit.type] ?? {};
    if (target.kind === 'unit' && attackerRules.canAttackUnits === false) return false;
    if (target.kind === 'building' && attackerRules.canAttackBuildings === false) return false;
    // A unit embedded in a solid structure has no legal melee ring. Recover
    // the hostile to the nearest open perimeter before route selection so an
    // accidental overlap can never make it immune to direct player orders.
    if (target.kind === 'unit') this._dislodgeEmbeddedCombatTarget(target);
    const enteringAttack = unit.command !== 'attack' || unit.attackTarget !== target.id || unit.attackTargetKind !== target.kind;
    unit.attackSlot = slot % COMBAT_SLOT_COUNT;
    const route = this._bestCombatRoute(unit, target);
    if (!route) {
      if (options.requireImmediateRoute) return false;
      this._releaseCombatSlot(unit);
      unit.path = [];
      unit.routeTarget = null;
      unit.pathBlocked = false;
      unit.recoveryAvailable = false;
      unit.command = 'attack';
      unit.attackTarget = target.id;
      unit.attackTargetKind = target.kind;
      unit.attackPhase = 'approach';
      unit.visualState = 'walk';
      unit.attackRepathCooldown = UNIT_REPATH_COOLDOWN;
      unit.actionLabel = `Finding an approach to ${this._targetLabel(target)}`;
      return true;
    }
    this._reserveCombatSlot(unit, target, route.slot);
    unit.path = route.path;
    unit.routeTarget = route.point;
    unit.stopDistance = 0;
    unit.pathBlocked = false;
    unit.command = 'attack';
    unit.attackTarget = target.id;
    unit.attackTargetKind = target.kind;
    if (enteringAttack) this._cancelAttackCycle(unit);
    unit.attackPhase = 'approach';
    unit.attackPhaseElapsed = 0;
    unit.attackEventFired = false;
    unit.visualState = 'walk';
    unit.attackRepathCooldown = UNIT_REPATH_COOLDOWN;
    unit.actionLabel = `Closing on ${this._targetLabel(target)}`;
    this._resetMovementTracking(unit);
    return true;
  }

  _tryApplyVillagerStun(attacker, target) {
    const stunRule = UNIT_TYPES[attacker.type]?.stunOnHit;
    const targetTraits = UNIT_TYPES[target.type]?.traits ?? [];
    if (!stunRule
      || attacker.faction === target.faction
      || !targetTraits.includes(stunRule.targetTrait)
      || target.dead
      || target.stunTimer > 0
      || target.stunImmunityTimer > 0) return false;

    this._interruptWork(target);
    target.stunTimer = stunRule.duration;
    target.stunDuration = stunRule.duration;
    target.stunImmunityDuration = stunRule.immunityDuration;
    target.stunImmunityTimer = 0;
    target.stunSourceId = attacker.id;
    target.path = [];
    target.routeTarget = null;
    target.velocityX = 0;
    target.velocityZ = 0;
    target.command = 'stunned';
    target.visualState = 'stunned';
    target.actionLabel = `Stunned by ${UNIT_TYPES[attacker.type].label} · ${stunRule.duration}s`;
    target.healthRevealTimer = Math.max(target.healthRevealTimer, stunRule.duration);
    this.animation.emit(target, ANIMATION_EVENTS.stunApplied, {
      sourceId: attacker.id,
      duration: stunRule.duration,
      immunityDuration: stunRule.immunityDuration,
    });
    this._announce(`${UNIT_TYPES[target.type].label} stunned for ${stunRule.duration} seconds.`);
    return true;
  }

  _rallyVillagersToDefend(protectedVillager, attacker, radius) {
    if (!attacker || attacker.dead || attacker.kind !== 'unit' || attacker.faction === protectedVillager.faction) return 0;
    const defenders = this.units
      .filter((unit) => unit.type === 'villager'
        && unit.faction === protectedVillager.faction
        && !unit.dead
        && distance(unit, protectedVillager) <= radius)
      .sort((first, second) => distance(first, attacker) - distance(second, attacker));
    let routed = 0;
    defenders.forEach((villager, index) => {
      this._interruptWork(villager);
      villager.postDepositTarget = null;
      villager.attackTarget = attacker.id;
      villager.attackTargetKind = 'unit';
      villager.attackSlot = index % COMBAT_SLOT_COUNT;
      villager.actionLabel = `Defending ${UNIT_TYPES[protectedVillager.type].label}`;
      if (this._sendUnitToAttack(villager, attacker, villager.attackSlot)) routed += 1;
    });
    return routed;
  }

  _triggerLastLightWard(villager, attacker, wardRule) {
    const duration = Math.max(1, wardRule.duration ?? 60);
    villager.lastLightWardTimer = duration;
    villager.lastLightWardDuration = duration;
    villager.lastLightWardHealRate = Math.max(0, villager.maxHp - villager.hp) / duration;
    villager.wardBlockedPulse = 0.55;
    villager.healthRevealTimer = Math.max(villager.healthRevealTimer, duration);
    this.animation.emit(villager, ANIMATION_EVENTS.wardTriggered, {
      sourceId: attacker?.id ?? null,
      duration,
    });
    const defenders = this._rallyVillagersToDefend(villager, attacker, wardRule.swarmRadius ?? 14);
    const rally = defenders > 0 ? ` ${defenders} nearby villager${defenders === 1 ? '' : 's'} rally.` : '';
    this._announce(`Last Light Ward saves the Villager for ${duration} seconds.${rally}`);
  }

  _applyUnitDamage(target, amount, attacker) {
    if (!target || target.dead || target.kind !== 'unit') return { damage: 0, killed: false, warded: false, blocked: false };
    const damage = Math.max(0, Number(amount) || 0);
    if (target.lastLightWardTimer > 0) {
      target.wardBlockedPulse = 0.42;
      target.hitFlash = Math.max(target.hitFlash, 0.12);
      this.animation.emit(target, ANIMATION_EVENTS.wardBlocked, { sourceId: attacker?.id ?? null, damage });
      return { damage: 0, killed: false, warded: true, blocked: true };
    }

    const before = target.hp;
    const after = before - damage;
    const wardRule = UNIT_TYPES[target.type]?.lastLightWard;
    if (wardRule && target.faction === 'player' && after <= 0) {
      target.hp = 1;
      this._triggerLastLightWard(target, attacker, wardRule);
      return { damage: Math.max(0, before - target.hp), killed: false, warded: true, blocked: false };
    }

    target.hp = Math.max(0, after);
    if (target.hp <= 0) this._killUnit(target, attacker);
    return { damage: Math.min(before, damage), killed: target.dead, warded: false, blocked: false };
  }

  _updateAttack(unit, dt) {
    let target = unit.attackPhase !== 'approach' ? this._getExplicitAttackTarget(unit) : this._getAttackTarget(unit);
    if (!target && unit.attackPhase !== 'approach') {
      this._releaseCombatSlot(unit);
      this._cancelAttackCycle(unit);
      unit.attackTarget = null;
      unit.attackTargetKind = null;
      target = this._getAttackTarget(unit);
    }
    if (!target) {
      this._clearAttackState(unit, true);
      if (unit.carryAmount > 0) this._beginReturn(unit);
      else {
        unit.command = 'idle';
        unit.visualState = 'idle';
        unit.actionLabel = 'Idle';
      }
      return;
    }
    if (unit.attackTarget !== target.id || unit.attackTargetKind !== target.kind) {
      this._cancelAttackCycle(unit);
      unit.attackTarget = target.id;
      unit.attackTargetKind = target.kind;
      this._reserveCombatSlot(unit, target, unit.attackSlot);
    } else if (unit.combatSlotTargetId !== target.id || unit.combatSlotTargetKind !== target.kind) {
      this._reserveCombatSlot(unit, target, unit.attackSlot);
    }
    unit.attackTarget = target.id;
    unit.attackTargetKind = target.kind;
    const range = UNIT_TYPES[unit.type].range;
    const inRange = this._targetDistance(unit, target) <= range;
    const hasLine = inRange && this._hasCombatLineOfSight(unit, target);
    const targetPoint = target.kind === 'building' ? this._buildingCollisionCenter(target) : target;
    const blueprint = UNIT_TYPES[unit.type];
    const cooldown = blueprint.cooldown;
    const timing = blueprint.attackTiming ?? { anticipation: 0.25, contact: 0.45, recovery: 0.3 };
    const anticipationDuration = cooldown * timing.anticipation;
    const contactDuration = cooldown * timing.contact;
    const recoveryDuration = cooldown * timing.recovery;

    if (unit.attackPhase === 'approach' && !hasLine) {
      // `_followPath` owns facing while an attacker is travelling. Forcing the
      // sprite to look directly at its target here made an obstacle-detouring
      // unit run backward and rapidly flip rows as path and target headings
      // disagreed. Face the target only after the unit reaches attack range.
      unit.actionLabel = inRange ? 'Seeking an opening' : `Closing on ${this._targetLabel(target)}`;
      unit.visualState = 'walk';
      // `path[path.length - 1]` is an A* cell center and can be several
      // tenths inside the target's collision envelope. Comparing that cell
      // directly to a large building made the first long raid replan every
      // simulation tick. Keep the authored combat approach point as the
      // stable route target; only ask A* again after the route is consumed or
      // the target has moved far enough to invalidate it.
      const routeTarget = unit.routeTarget;
      const routeTolerance = Math.max(1.4, range + 1.55);
      if (unit.attackRepathCooldown <= 0
        && (!unit.path.length || !routeTarget || this._targetDistance(routeTarget, target) > routeTolerance)) {
        this._sendUnitToAttack(unit, target, unit.attackSlot);
      }
      return;
    }
    if (unit.attackPhase !== 'approach' && !hasLine) {
      if (!unit.attackEventFired) {
        this.animation.emit(unit, ANIMATION_EVENTS.attackWhiff, {
          targetId: target.id,
          targetKind: target.kind,
          x: target.x,
          z: target.z,
        });
      }
      this._cancelAttackCycle(unit);
      if (unit.attackRepathCooldown <= 0) this._sendUnitToAttack(unit, target, unit.attackSlot);
      return;
    }
    setUnitFacing(unit, targetPoint.x - unit.x, targetPoint.z - unit.z, true);
    if (unit.attackPhase === 'approach') {
      this._startAttackCycle(unit, target);
    }
    unit.path = [];
    unit.velocityX = 0;
    unit.velocityZ = 0;
    unit.visualState = 'attack';
    unit.actionLabel = `Attacking ${this._targetLabel(target)}`;
    unit.attackTimer += dt;
    unit.attackPhaseElapsed += dt;
    if (unit.attackPhase === 'anticipation') {
      if (unit.attackPhaseElapsed >= anticipationDuration) {
        unit.attackPhase = 'contact';
        unit.attackPhaseElapsed = 0;
      }
      return;
    }
    if (unit.attackPhase === 'contact') {
      const contactEventTime = contactDuration * 0.2;
      if (!unit.attackEventFired && unit.attackPhaseElapsed >= contactEventTime) {
        unit.attackEventFired = true;
        const validContact = this._targetDistance(unit, target) <= range && this._hasCombatLineOfSight(unit, target);
        const payload = { targetId: target.id, targetKind: target.kind, x: target.x, z: target.z };
        if (validContact) {
          unit.attackHitApplied = true;
          const strikeDamage = target.kind === 'unit' && target.type === 'villager'
            ? blueprint.attackVsVillager ?? blueprint.attack
            : blueprint.attack;
          payload.damage = strikeDamage;
          if (target.kind === 'building') {
            this.animation.emit(unit, ANIMATION_EVENTS.attackHit, payload);
            target.hp -= strikeDamage;
            target.hitFlash = 0.3;
            target.defenseTargetId = unit.id;
            target.defendTimer = ENEMY_AI.defenseDuration;
            if (target.hp <= 0) this._destroyBuilding(target, unit);
          } else {
            const result = this._applyUnitDamage(target, strikeDamage, unit);
            payload.damage = result.damage;
            payload.warded = result.warded;
            payload.blocked = result.blocked;
            this.animation.emit(unit, ANIMATION_EVENTS.attackHit, payload);
            target.hitFlash = Math.max(target.hitFlash, result.blocked ? 0.12 : 0.3);
            this.animation.emit(target, ANIMATION_EVENTS.damageTaken, {
              sourceId: unit.id,
              damage: result.damage,
              warded: result.warded,
              blocked: result.blocked,
            });
            target.healthRevealTimer = Math.max(target.healthRevealTimer, 1.6);
            if (!target.dead) this._tryApplyVillagerStun(unit, target);
          }
        } else {
          this.animation.emit(unit, ANIMATION_EVENTS.attackWhiff, payload);
        }
      }
      if (unit.attackPhaseElapsed >= contactDuration) {
        if (target.dead || target.destroyed || target.hp <= 0) return;
        unit.attackPhase = 'recovery';
        unit.attackPhaseElapsed = 0;
      }
      return;
    }
    if (unit.attackPhase === 'recovery') {
      if (unit.attackPhaseElapsed >= recoveryDuration) this._cancelAttackCycle(unit);
    }
  }

  _updateBuildingIntent(unit) {
    const building = this.buildings.find((candidate) => candidate.id === unit.buildTarget && this.buildingNeedsWork(candidate));
    if (!building) {
      this._releaseBuildingSlot(unit);
      unit.buildTarget = null;
      unit.command = 'idle';
      unit.visualState = 'idle';
      unit.actionLabel = 'Idle';
      if (!this._executeNextConstructionOrder(unit)) unit.needsSafetyRegroup = true;
      return;
    }
    if (this._distanceToBuildingUnitEdge(unit, building) > BUILDING_INTERACTION_DISTANCE + 0.08) {
      const destination = building.progress < 1 ? 'build site' : `repair ${BUILDING_TYPES[building.type].label}`;
      unit.actionLabel = `Walking to ${destination}${unit.orderQueue?.length ? ` · ${unit.orderQueue.length} queued` : ''}`;
      unit.visualState = 'walk';
      const interactionCenter = this._buildingCollisionCenter(building);
      setUnitFacing(unit, interactionCenter.x - unit.x, interactionCenter.z - unit.z);
      if (!unit.path.length && unit.repathCooldown <= 0) this._sendUnitToBuilding(unit, building, unit.buildSlot);
    } else {
      unit.path = [];
      unit.velocityX = 0;
      unit.velocityZ = 0;
      const interactionCenter = this._buildingCollisionCenter(building);
      setUnitFacing(unit, interactionCenter.x - unit.x, interactionCenter.z - unit.z, true);
      unit.visualState = 'build';
      unit.actionLabel = this._constructionQueueLabel(unit, building);
    }
  }

  _updateDemolitionIntent(unit) {
    const building = this.buildings.find((candidate) => candidate.id === unit.demolishTarget
      && candidate.demolitionQueued
      && this.canDemolishBuilding(candidate));
    if (!building) {
      this._releaseDemolitionSlot(unit, { preserveTargetState: true });
      unit.command = 'idle';
      unit.path = [];
      unit.visualState = 'idle';
      unit.actionLabel = 'Idle';
      if (!this._executeNextConstructionOrder(unit)) unit.needsSafetyRegroup = true;
      return;
    }
    if (this._distanceToBuildingUnitEdge(unit, building) > DEMOLITION_INTERACTION_DISTANCE + 0.08) {
      unit.actionLabel = `Walking to dismantle ${BUILDING_TYPES[building.type].label}${unit.orderQueue?.length ? ` · ${unit.orderQueue.length} queued` : ''}`;
      unit.visualState = 'walk';
      const interactionCenter = this._buildingCollisionCenter(building);
      setUnitFacing(unit, interactionCenter.x - unit.x, interactionCenter.z - unit.z);
      if (!unit.path.length) this._sendUnitToDemolish(unit, building, unit.demolishSlot);
      return;
    }
    unit.path = [];
    unit.velocityX = 0;
    unit.velocityZ = 0;
    const interactionCenter = this._buildingCollisionCenter(building);
    setUnitFacing(unit, interactionCenter.x - unit.x, interactionCenter.z - unit.z, true);
    unit.visualState = 'build';
    unit.actionLabel = `Dismantling ${BUILDING_TYPES[building.type].label}${unit.orderQueue?.length ? ` · ${unit.orderQueue.length} queued` : ''}`;
  }

  _updateFieldIntent(unit) {
    const field = this.buildings.find((candidate) => candidate.id === unit.fieldTarget && candidate.field && !candidate.destroyed && candidate.progress >= 1);
    if (!field) {
      unit.fieldTarget = null;
      unit.command = 'idle';
      unit.visualState = 'idle';
      unit.actionLabel = 'Idle';
      return;
    }
    if (this._distanceToBuildingUnitEdge(unit, field) > 0.7) {
      unit.actionLabel = 'Walking to Grain Field';
      unit.visualState = 'walk';
      if (!unit.path.length) this._sendUnitToField(unit, field);
      return;
    }
    unit.path = [];
    unit.velocityX = 0;
    unit.velocityZ = 0;
    setUnitFacing(unit, field.x - unit.x, field.z - unit.z, true);
    unit.visualState = 'field';
    unit.actionLabel = 'Tending Grain Field';
  }

  _enemyCamp() {
    return this.buildings.find((building) => building.type === 'ashenCamp' && building.faction === 'enemy' && !building.destroyed && building.hp > 0) ?? null;
  }

  _spawnEnemyRaider(camp) {
    const activeRaiders = this.units.filter((unit) => unit.type === 'raider' && unit.faction === 'enemy' && !unit.dead).length;
    if (activeRaiders >= ENEMY_AI.maxArmy) return false;
    const spawnDistance = BUILDING_TYPES[camp.type].spawnDistance ?? 1.45;
    // Keep reinforcements in the open west/south clearing. The generic
    // entrance points put a Raider underneath the enlarged camp or beside
    // the berry clearing, which read as stacked sprites instead of a patrol.
    const points = [
      { x: camp.x - spawnDistance - 1.2, z: camp.z + spawnDistance + 1.25 },
      { x: camp.x - spawnDistance - 1.65, z: camp.z + 0.55 },
      { x: camp.x - 1.0, z: camp.z + spawnDistance + 1.65 },
    ].map((point) => ({
      x: clamp(point.x, 0.8, CONFIG.mapWidth - 0.8),
      z: clamp(point.z, 0.8, CONFIG.mapHeight - 0.8),
    }));
    const orderedPoints = points
      .slice(activeRaiders - 1)
      .concat(points.slice(0, activeRaiders - 1));
    const point = orderedPoints.find((candidate) => {
      if (this.isBlocked(Math.floor(candidate.x), Math.floor(candidate.z))) return false;
      return this.units.every((unit) => unit.dead || distance(candidate, unit) > 1.1);
    });
    if (!point) return false;
    const raider = this.addUnit('raider', point.x, point.z, 'enemy');
    raider.actionLabel = 'Guarding the Ashen Camp';
    this._announce('The Ashen Camp raises another Raider.');
    return true;
  }

  _enemyWorkers() {
    return this.units.filter((unit) => unit.faction === 'enemy' && !unit.dead && UNIT_TYPES[unit.type]?.worker);
  }

  _enemyMilitary() {
    return this.units.filter((unit) => unit.faction === 'enemy'
      && !unit.dead
      && !UNIT_TYPES[unit.type]?.worker
      && UNIT_TYPES[unit.type]?.canAttackUnits !== false);
  }

  _enemyTownBuildings() {
    return this.buildings.filter((building) => building.faction === 'enemy' && !building.destroyed);
  }

  _enemyResourcePriority(worker) {
    const bank = this.enemyResources;
    const urgent = [];
    if (bank.wood < 210) urgent.push('wood');
    if (bank.food < 150) urgent.push('food');
    if (bank.stone < 95) urgent.push('stone');
    if (bank.gold < 30) urgent.push('gold');
    const baseline = ['wood', 'food', 'stone', 'gold'];
    const rotation = worker.id % baseline.length;
    return [...new Set([...urgent, ...baseline.slice(rotation), ...baseline.slice(0, rotation)])];
  }

  _assignEnemyEconomy() {
    for (const worker of this._enemyWorkers()) {
      if (worker.command !== 'idle'
        || worker.path.length
        || worker.carryAmount
        || worker.buildTarget
        || worker.fieldTarget
        || worker.attackTarget) continue;
      let node = null;
      for (const resourceType of this._enemyResourcePriority(worker)) {
        node = this.resourcesNodes
          .filter((candidate) => candidate.amount > 0 && candidate.resourceType === resourceType)
          .sort((a, b) => distance(worker, a) - distance(worker, b) || a.id - b.id)[0] ?? null;
        if (node) break;
      }
      if (!node) continue;
      worker.gatherTarget = node.id;
      worker.gatherSlot = worker.id % resourceSlotCount(node);
      worker.gatherTimer = 0;
      worker.gatherEventFired = false;
      if (!this._sendUnitToResource(worker, node)) worker.gatherTarget = null;
    }
  }

  _enemyBuildSite(type, desired, workers) {
    const blueprint = BUILDING_TYPES[type];
    if (!blueprint || !workers.length) return null;
    for (const offset of ENEMY_SITE_OFFSETS) {
      const point = {
        x: clamp(Math.round(desired.x + offset.x), 4, CONFIG.mapWidth - 4),
        z: clamp(Math.round(desired.z + offset.z), 4, CONFIG.mapHeight - 4),
      };
      const bounds = this._buildingBounds(type, point, BUILDING_CLEARANCE);
      if (bounds.minX < 1 || bounds.minZ < 1 || bounds.maxX > CONFIG.mapWidth - 1 || bounds.maxZ > CONFIG.mapHeight - 1) continue;
      if (this.buildings.some((building) => !building.destroyed && this._boundsOverlap(bounds, this._buildingEntityBounds(building, 0.6)))) continue;
      if (this.resourcesNodes.some((node) => node.amount > 0 && this._circleIntersectsBounds(node, resourceFootprint(node) + 0.4, bounds))) continue;
      if (this.units.some((unit) => !unit.dead && this._circleIntersectsBounds(unit, (UNIT_TYPES[unit.type]?.radius ?? 0.4) + 0.2, bounds))) continue;
      const placement = { type, faction: 'enemy', x: point.x, z: point.z, progress: 1 };
      const reachable = workers.some((worker) => this._bestPathToPoints(worker, this._buildingApproachPoints(placement), placement));
      if (reachable) return point;
    }
    return null;
  }

  _tryEnemyBuild(camp) {
    const state = this.enemyAIState;
    while (state.planIndex < ENEMY_BUILD_PLAN.length) {
      const plan = ENEMY_BUILD_PLAN[state.planIndex];
      const existing = this.buildings.some((building) => building.type === plan.type && building.faction === 'enemy' && !building.destroyed);
      if (!existing) break;
      state.planIndex += 1;
    }
    if (state.planIndex >= ENEMY_BUILD_PLAN.length || this._enemyTownBuildings().length >= ENEMY_AI.maxTownStructures) return false;
    const plan = ENEMY_BUILD_PLAN[state.planIndex];
    const blueprint = BUILDING_TYPES[plan.type];
    if (!this._canAffordForFaction('enemy', blueprint.cost)) return false;
    const workers = this._enemyWorkers()
      .filter((worker) => !worker.carryAmount && !worker.fieldTarget && !worker.buildTarget && worker.stunTimer <= 0)
      .sort((a, b) => distance(a, camp) - distance(b, camp) || a.id - b.id)
      .slice(0, 2);
    if (!workers.length) return false;
    const desired = { x: camp.x + plan.offset.x, z: camp.z + plan.offset.z };
    const point = this._enemyBuildSite(plan.type, desired, workers);
    if (!point) return false;
    this._spendForFaction('enemy', blueprint.cost);
    const building = this.addBuilding(plan.type, point.x, point.z, 'enemy', 0.04);
    let assigned = 0;
    workers.forEach((worker, index) => {
      this._interruptWork(worker);
      worker.buildTarget = building.id;
      if (this._sendUnitToBuilding(worker, building, index)) assigned += 1;
      else worker.buildTarget = null;
    });
    if (!assigned) {
      building.destroyed = true;
      building.destroyAge = DESTROYED_BUILDING_LIFETIME;
      const bank = this._resourceBank('enemy');
      for (const [key, value] of Object.entries(blueprint.cost)) bank[key] += value;
      return false;
    }
    state.planIndex += 1;
    this._announce(`Scouts report an ${blueprint.label} rising in the Ashen settlement.`);
    return true;
  }

  _queueEnemyUnit(type) {
    const blueprint = PRODUCTION_TYPES[type];
    if (!blueprint || !this._canAffordForFaction('enemy', blueprint.cost)) return false;
    const building = this.buildings.find((candidate) => candidate.faction === 'enemy'
      && candidate.type === blueprint.building
      && candidate.progress >= 1
      && !candidate.destroyed
      && candidate.hp > 0);
    if (!building) return false;
    const queue = Array.isArray(building.productionQueue) ? building.productionQueue : (building.productionQueue = []);
    if (queue.length >= 2) return false;
    this._spendForFaction('enemy', blueprint.cost);
    queue.push({ type, elapsed: 0 });
    return true;
  }

  _updateEnemyProduction(dt, camp) {
    const state = this.enemyAIState;
    state.workerClock += dt;
    state.armyClock += dt;
    const workers = this._enemyWorkers().length;
    const queuedWorkers = this._enemyTownBuildings().reduce((sum, building) => sum
      + (building.productionQueue ?? []).filter((order) => order.type === 'ashenForager').length, 0);
    if (workers + queuedWorkers < ENEMY_AI.maxWorkers && state.workerClock >= ENEMY_AI.workerTrainingDelay) {
      state.workerClock = this._queueEnemyUnit('ashenForager') ? 0 : ENEMY_AI.workerTrainingDelay - 5;
    }

    const army = this._enemyMilitary().length;
    const queuedArmy = this._enemyTownBuildings().reduce((sum, building) => sum
      + (building.productionQueue ?? []).filter((order) => !UNIT_TYPES[order.type]?.worker).length, 0);
    if (army + queuedArmy >= ENEMY_AI.maxArmy || state.armyClock < ENEMY_AI.armyTrainingDelay) return;
    const corralReady = this.buildings.some((building) => building.type === 'beastCorral'
      && building.faction === 'enemy' && building.progress >= 1 && !building.destroyed);
    const nextIndex = army + queuedArmy;
    const type = corralReady && nextIndex % 5 === 4
      ? 'ashenOutrider'
      : ENEMY_INFANTRY_ROTATION[nextIndex % ENEMY_INFANTRY_ROTATION.length];
    state.armyClock = this._queueEnemyUnit(type) ? 0 : ENEMY_AI.armyTrainingDelay - 5;
  }

  _enemyDefenseTarget(camp) {
    const direct = this._enemyTownBuildings()
      .map((building) => building.defenseTargetId && building.defendTimer > 0
        ? this.units.find((unit) => unit.id === building.defenseTargetId && unit.faction === 'player' && !unit.dead)
        : null)
      .find(Boolean);
    if (direct) return direct;
    return this.units
      .filter((unit) => unit.faction === 'player' && !unit.dead && distance(unit, camp) <= ENEMY_AI.defenseRange)
      .sort((a, b) => distance(a, camp) - distance(b, camp) || a.id - b.id)[0] ?? null;
  }

  _sendEnemyRaid(playerCore) {
    const state = this.enemyAIState;
    const ready = this._enemyMilitary()
      .filter((unit) => unit.stunTimer <= 0 && !unit.dead)
      .sort((a, b) => distance(a, playerCore) - distance(b, playerCore) || a.id - b.id);
    if (ready.length < ENEMY_AI.minRaidSize) return false;
    const desired = Math.min(ENEMY_AI.maxRaidSize, ENEMY_AI.minRaidSize + Math.floor(state.raidCount / 2));
    const leaveBehind = ready.length > ENEMY_AI.minRaidSize ? 1 : 0;
    const wave = ready.slice(0, Math.min(desired, ready.length - leaveBehind));
    if (wave.length < ENEMY_AI.minRaidSize) return false;
    state.raidWaveIds = [];
    wave.forEach((unit, index) => {
      this._interruptWork(unit);
      if (this._sendUnitToAttack(unit, playerCore, index, { requireImmediateRoute: true })) {
        unit.actionLabel = 'Raiding the Crown Hall';
        state.raidWaveIds.push(unit.id);
      } else {
        unit.command = 'idle';
        unit.attackTarget = null;
        unit.attackTargetKind = null;
        unit.actionLabel = 'Holding behind the wildwood';
      }
    });
    if (state.raidWaveIds.length < ENEMY_AI.minRaidSize) return false;
    state.raidClock = 0;
    state.raidCount += 1;
    this._announce('An Ashen warband is moving on the Crown Hall.');
    return true;
  }

  _updateEnemyAI(dt) {
    const camp = this._enemyCamp();
    if (!camp) return;
    const state = this.enemyAIState;
    state.economyClock += dt;
    state.buildClock += dt;
    if (state.economyClock >= 1) {
      state.economyClock = 0;
      this._assignEnemyEconomy();
    }
    this._updateEnemyProduction(dt, camp);

    const buildDelay = state.planIndex === 0 ? ENEMY_AI.firstBuildDelay : ENEMY_AI.buildInterval;
    if (state.buildClock >= buildDelay) {
      state.buildClock = this._tryEnemyBuild(camp) ? 0 : Math.max(0, buildDelay - 5);
    }

    const defenseTarget = this._enemyDefenseTarget(camp);
    if (defenseTarget) {
      camp.defendTimer = ENEMY_AI.defenseDuration;
      const defenders = this._enemyMilitary().filter((unit) => unit.stunTimer <= 0);
      defenders.forEach((unit, index) => {
        const current = unit.command === 'attack' ? this._getAttackTarget(unit) : null;
        if (current?.id === defenseTarget.id) return;
        this._interruptWork(unit);
        unit.attackTarget = defenseTarget.id;
        unit.attackTargetKind = 'unit';
        unit.actionLabel = 'Defending the Ashen settlement';
        this._sendUnitToAttack(unit, defenseTarget, index);
      });
      return;
    }
    if (camp.defendTimer > 0) return;
    state.raidClock += dt;
    const playerCore = this.buildings.find((building) => building.type === 'townCenter' && building.faction === 'player' && !building.destroyed && building.hp > 0);
    const raidDelay = state.raidCount > 0 ? ENEMY_AI.followUpRaidDelay : ENEMY_AI.firstRaidDelay;
    if (playerCore && state.raidClock >= raidDelay && !this._sendEnemyRaid(playerCore)) {
      state.raidClock = Math.max(0, raidDelay - 8);
    }
  }

  _updateEnemyIntent() {
    const enemies = this._enemyMilitary();
    const playerTargets = this.units.filter((unit) => unit.faction === 'player' && !unit.dead);
    for (const enemy of enemies) {
      if (enemy.stunTimer > 0) continue;
      const currentTarget = enemy.command === 'attack' ? this._getAttackTarget(enemy) : null;
      if (currentTarget) continue;
      if (enemy.command === 'attack') {
        enemy.attackTarget = null;
        enemy.attackTargetKind = null;
        enemy.command = 'idle';
        enemy.path = [];
        enemy.visualState = 'idle';
        enemy.actionLabel = 'Guarding the Ashen settlement';
      }
      let target = null;
      let nearestDistance = Infinity;
      for (const candidate of playerTargets) {
        const candidateDistance = this._targetDistance(enemy, candidate);
        if (candidateDistance < nearestDistance) {
          nearestDistance = candidateDistance;
          target = candidate;
        }
      }
      if (target && distance(enemy, target) < ENEMY_AI.awarenessRange) {
        enemy.attackTarget = target.id;
        enemy.attackTargetKind = 'unit';
        enemy.actionLabel = 'Engaging nearby Crownwardens';
        this._sendUnitToAttack(enemy, target, enemy.attackSlot);
      }
    }
  }

  _killUnit(unit, killer) {
    this._interruptWork(unit);
    unit.dead = true;
    unit.deathAge = 0;
    unit.hp = 0;
    unit.path = [];
    unit.command = 'dead';
    unit.attackTarget = null;
    unit.routeTarget = null;
    unit.visualState = 'death';
    unit.velocityX = 0;
    unit.velocityZ = 0;
    unit.actionLabel = killer?.faction === 'player' ? 'Defeated' : 'Fallen';
    unit.selected = false;
    this.selectedIds = this.selectedIds.filter((id) => id !== unit.id);
    for (const attacker of this.units) {
      if (attacker === unit || attacker.attackTarget !== unit.id || attacker.attackTargetKind !== 'unit') continue;
      this._releaseCombatSlot(attacker);
      this._cancelAttackCycle(attacker);
      attacker.attackTarget = null;
      attacker.attackTargetKind = null;
      if (!attacker.dead && attacker.command === 'attack') {
        attacker.path = [];
        attacker.visualState = 'idle';
        attacker.actionLabel = 'Reassessing';
      }
    }
    this._announce(`${UNIT_TYPES[unit.type].label} defeated.`);
  }

  _destroyBuilding(building, killer, options = {}) {
    if (building.destroyed) return;
    this.navigationVersion += 1;
    this.selectedIds = this.selectedIds.filter((id) => id !== building.id);
    building.selected = false;
    const assignedIds = new Set([
      ...(Array.isArray(building.buildAssigned) ? building.buildAssigned : building.buildAssigned ? [building.buildAssigned] : []),
      ...(Array.isArray(building.demolitionAssigned) ? building.demolitionAssigned : []),
      ...this.units.filter((unit) => unit.buildTarget === building.id).map((unit) => unit.id),
      ...this.units.filter((unit) => unit.demolishTarget === building.id).map((unit) => unit.id),
      ...this.units.filter((unit) => unit.returnStorageId === building.id).map((unit) => unit.id),
    ]);
    building.destroyed = true;
    // Direct player demolition removes the complete structure and its visual
    // remains in one action. Combat destruction keeps the authored short
    // collapse treatment, while instantCleanup immediately releases collision
    // and skips every debris/fade frame.
    building.destroyAge = options.instantCleanup ? 3 : 0;
    building.hp = 0;
    building.progress = 1;
    for (const unit of this.units.filter((candidate) => assignedIds.has(candidate.id))) {
      this._releaseBuildingSlot(unit);
      this._releaseStorageSlot(unit);
      this._releaseDemolitionSlot(unit, { preserveTargetState: true });
      unit.buildTarget = null;
      unit.demolishTarget = null;
      if (!options.preserveWorkerOrders) unit.orderQueue = [];
      if (!unit.dead && (unit.command === 'build' || unit.command === 'demolish')) {
        unit.command = 'idle';
        unit.path = [];
        unit.visualState = 'idle';
        unit.actionLabel = 'Idle';
      }
      if (!unit.dead && unit.command === 'return') {
        unit.path = [];
        if (!this._beginReturn(unit)) unit.actionLabel = 'No drop-off available';
      }
    }
    building.buildAssigned = [];
    building.buildSlotReservations?.clear();
    building.storageSlotReservations?.clear();
    building.demolitionQueued = false;
    building.demolitionAssigned = [];
    building.demolitionSlotReservations?.clear();
    building.demolitionWork = 0;
    building.demolitionMaxWork = 0;
    building.demolitionStartHp = 0;
    building.demolitionTimer = 0;
    building.combatSlotReservations?.clear();
    for (const unit of this.units) {
      if (unit.attackTarget === building.id && unit.attackTargetKind === 'building') {
        this._releaseCombatSlot(unit);
        this._cancelAttackCycle(unit);
        unit.attackTarget = null;
        unit.attackTargetKind = null;
        unit.path = [];
        if (!unit.dead && unit.command === 'attack') {
          unit.visualState = 'idle';
          unit.actionLabel = 'Reassessing';
        }
      }
    }
    this._syncSelectionFlags();
    if (!options.silent) this._announce(`${BUILDING_TYPES[building.type].label} destroyed.`);
  }

  _checkVictory() {
    if (this.phase !== 'playing') return;
    const playerCore = this.buildings.some((building) => building.type === 'townCenter' && building.faction === 'player' && !building.destroyed && building.hp > 0);
    if (!playerCore) {
      this.phase = 'defeat';
      this._announce('Defeat: the Crown Hall has fallen.');
      return;
    }
    const enemyCore = this.buildings.some((building) => building.type === 'ashenCamp' && building.faction === 'enemy' && !building.destroyed && building.hp > 0);
    if (!enemyCore) {
      this.phase = 'victory';
      this._announce('Victory: the Ashen Camp is destroyed.');
    }
  }

  _nearestStorage(point, resourceType = point?.carryType ?? null, faction = point?.faction ?? 'player') {
    const storage = this.buildings.filter((building) => !building.destroyed
      && building.faction === faction
      && building.progress >= 1
      && this._storageAccepts(building, resourceType));
    return storage.sort((a, b) => this._distanceToBuildingEdge(point, a) - this._distanceToBuildingEdge(point, b))[0] ?? null;
  }

  _cellIntersectsBuilding(cellX, cellZ, building, padding = 0) {
    const wallGeometry = this._wallLineGeometry(building);
    if (wallGeometry) {
      const cellCenter = { x: cellX + 0.5, z: cellZ + 0.5 };
      return this._distanceToWallCenterline(cellCenter, building)
        < wallGeometry.halfThickness + padding + Math.SQRT1_2;
    }
    const cellMinX = cellX;
    const cellMaxX = cellX + 1;
    const cellMinZ = cellZ;
    const cellMaxZ = cellZ + 1;
    const bounds = this._buildingEntityBounds(building, padding);
    return cellMaxX > bounds.minX + 0.03 && cellMinX < bounds.maxX - 0.03 && cellMaxZ > bounds.minZ + 0.03 && cellMinZ < bounds.maxZ - 0.03;
  }

  _buildingBlocksCell(cellX, cellZ, building) {
    if (cellX < 0 || cellZ < 0 || cellX >= CONFIG.mapWidth || cellZ >= CONFIG.mapHeight) return true;
    if (!this._buildingHasCollision(building)) return false;
    return this._cellIntersectsBuilding(cellX, cellZ, building);
  }

  _buildingHasCollision(building) {
    const blueprint = BUILDING_TYPES[building.type];
    if (blueprint?.walkable && building.progress >= 1 && !building.destroyed) return false;
    return !building.destroyed || building.destroyAge < BUILDING_COLLISION_RELEASE_TIME;
  }

  _staticBlockerGridKey(cellX, cellZ) {
    return `${cellX}:${cellZ}`;
  }

  _ensureStaticBlockerGrid() {
    if (this.staticBlockerGridVersion === this.navigationVersion) return;
    this.staticBlockerGrid.clear();
    const add = (entity, minX, maxX, minZ, maxZ) => {
      const firstX = Math.floor(minX / STATIC_BLOCKER_GRID_SIZE);
      const lastX = Math.floor(maxX / STATIC_BLOCKER_GRID_SIZE);
      const firstZ = Math.floor(minZ / STATIC_BLOCKER_GRID_SIZE);
      const lastZ = Math.floor(maxZ / STATIC_BLOCKER_GRID_SIZE);
      for (let cellX = firstX; cellX <= lastX; cellX += 1) {
        for (let cellZ = firstZ; cellZ <= lastZ; cellZ += 1) {
          const key = this._staticBlockerGridKey(cellX, cellZ);
          const bucket = this.staticBlockerGrid.get(key) ?? [];
          bucket.push(entity);
          this.staticBlockerGrid.set(key, bucket);
        }
      }
    };
    for (const building of this.buildings) {
      if (!this._buildingHasCollision(building)) continue;
      const bounds = this._buildingEntityBounds(building);
      add(building, bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ);
    }
    for (const node of this.resourcesNodes) {
      if (node.amount <= 0) continue;
      const footprint = resourceFootprint(node);
      add(node, node.x - footprint, node.x + footprint, node.z - footprint, node.z + footprint);
    }
    this.staticBlockerGridVersion = this.navigationVersion;
  }

  _staticBlockerCandidates(point, padding = STATIC_BLOCKER_QUERY_RADIUS) {
    this._ensureStaticBlockerGrid();
    const minX = Math.floor((point.x - padding) / STATIC_BLOCKER_GRID_SIZE);
    const maxX = Math.floor((point.x + padding) / STATIC_BLOCKER_GRID_SIZE);
    const minZ = Math.floor((point.z - padding) / STATIC_BLOCKER_GRID_SIZE);
    const maxZ = Math.floor((point.z + padding) / STATIC_BLOCKER_GRID_SIZE);
    const candidates = [];
    const seen = new Set();
    for (let cellX = minX; cellX <= maxX; cellX += 1) {
      for (let cellZ = minZ; cellZ <= maxZ; cellZ += 1) {
        const bucket = this.staticBlockerGrid.get(this._staticBlockerGridKey(cellX, cellZ));
        if (!bucket) continue;
        for (const entity of bucket) {
          if (seen.has(entity.id)) continue;
          seen.add(entity.id);
          candidates.push(entity);
        }
      }
    }
    return candidates;
  }

  isBlocked(cellX, cellZ) {
    if (cellX < 0 || cellZ < 0 || cellX >= CONFIG.mapWidth || cellZ >= CONFIG.mapHeight) return true;
    const point = { x: cellX + 0.5, z: cellZ + 0.5 };
    return this._staticBlockerCandidates(point).some((entity) => entity.kind === 'building'
      ? this._buildingBlocksCell(cellX, cellZ, entity)
      : entity.amount > 0 && this._cellIntersectsResource(cellX, cellZ, entity));
  }

  _sendUnitTo(unit, target, command, stopDistance = 0) {
    if (!target) return;
    unit.stopDistance = stopDistance;
    const path = this._buildPath(unit, target);
    if (!path) {
      unit.path = [];
      unit.pathBlocked = true;
      unit.recoveryAvailable = true;
      unit.command = 'idle';
      unit.visualState = 'idle';
      unit.actionLabel = command === 'move' ? 'No route available' : 'Path blocked';
      return false;
    }
    unit.path = path;
    unit.routeTarget = { x: target.x, z: target.z };
    unit.pathBlocked = false;
    unit.command = command;
    const gatherNode = command === 'gather'
      ? this.resourcesNodes.find((node) => node.id === unit.gatherTarget && node.amount > 0)
      : null;
    unit.actionLabel = command === 'gather'
      ? `Walking to ${RESOURCE_TYPES[gatherNode?.resourceType]?.label ?? 'resource'}`
      : command === 'return'
        ? this._returnActionLabel(unit)
        : command === 'attack'
          ? 'Closing on enemy'
          : command === 'build'
            ? 'Walking to build site'
            : 'Moving';
    this._resetMovementTracking(unit);
    return true;
  }

  _constrainUnitPosition(unit, previousX = unit.x, previousZ = unit.z) {
    const radius = UNIT_TYPES[unit.type].radius + UNIT_STATIC_CLEARANCE;
    unit.x = clamp(unit.x, 0.45, CONFIG.mapWidth - 0.45);
    unit.z = clamp(unit.z, 0.45, CONFIG.mapHeight - 0.45);
    const nearbyBlockers = this._staticBlockerCandidates(unit, STATIC_BLOCKER_QUERY_RADIUS);
    for (const building of nearbyBlockers) {
      if (building.kind !== 'building') continue;
      if (!this._buildingHasCollision(building)) continue;
      const unitExclusion = BUILDING_TYPES[building.type]?.unitExclusionPadding ?? 0;
      if (unit.stairAccess && this._pointOnCrownHallStairs(unit, building, radius + unitExclusion)) continue;
      const bounds = this._buildingEntityBounds(building, radius + unitExclusion);
      if (unit.x <= bounds.minX || unit.x >= bounds.maxX || unit.z <= bounds.minZ || unit.z >= bounds.maxZ) continue;
      const distances = [
        { side: 'minX', value: unit.x - bounds.minX },
        { side: 'maxX', value: bounds.maxX - unit.x },
        { side: 'minZ', value: unit.z - bounds.minZ },
        { side: 'maxZ', value: bounds.maxZ - unit.z },
      ].sort((a, b) => a.value - b.value);
      const nearest = distances[0].side;
      if (nearest === 'minX') { unit.x = bounds.minX; unit.velocityX = Math.max(0, unit.velocityX); }
      if (nearest === 'maxX') { unit.x = bounds.maxX; unit.velocityX = Math.min(0, unit.velocityX); }
      if (nearest === 'minZ') { unit.z = bounds.minZ; unit.velocityZ = Math.max(0, unit.velocityZ); }
      if (nearest === 'maxZ') { unit.z = bounds.maxZ; unit.velocityZ = Math.min(0, unit.velocityZ); }
    }
    for (const node of nearbyBlockers) {
      if (node.kind !== 'resource') continue;
      if (node.amount <= 0) continue;
      const safeDistance = resourceFootprint(node) + radius;
      const dx = unit.x - node.x;
      const dz = unit.z - node.z;
      const length = Math.hypot(dx, dz);
      if (length >= safeDistance) continue;
      let nx = dx;
      let nz = dz;
      if (Math.hypot(nx, nz) < 0.001) {
        nx = unit.x - previousX;
        nz = unit.z - previousZ;
      }
      const normalLength = Math.hypot(nx, nz) || 1;
      nx /= normalLength;
      nz /= normalLength;
      unit.x = clamp(node.x + nx * safeDistance, 0.45, CONFIG.mapWidth - 0.45);
      unit.z = clamp(node.z + nz * safeDistance, 0.45, CONFIG.mapHeight - 0.45);
      if (unit.velocityX * nx + unit.velocityZ * nz < 0) {
        unit.velocityX = 0;
        unit.velocityZ = 0;
      }
    }
  }

  _resolveUnitCollisions() {
    const live = this.units.filter((unit) => !unit.dead);
    const grid = new Map();
    const cellKey = (x, z) => (Math.floor(x / UNIT_COLLISION_GRID_SIZE) << 16) | Math.floor(z / UNIT_COLLISION_GRID_SIZE);
    for (const unit of live) {
      const key = cellKey(unit.x, unit.z);
      const bucket = grid.get(key) ?? [];
      bucket.push(unit);
      grid.set(key, bucket);
    }
    for (const a of live) {
      const cellX = Math.floor(a.x / UNIT_COLLISION_GRID_SIZE);
      const cellZ = Math.floor(a.z / UNIT_COLLISION_GRID_SIZE);
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
          const bucket = grid.get(cellKey((cellX + offsetX) * UNIT_COLLISION_GRID_SIZE, (cellZ + offsetZ) * UNIT_COLLISION_GRID_SIZE)) ?? [];
          for (const b of bucket) {
            if (a.id >= b.id) continue;
            this.collisionPairsLastStep += 1;
        const roleDistance = Math.max(
          SPACING_ROLES[a.type]?.personalSpace ?? UNIT_TYPES[a.type].radius,
          SPACING_ROLES[b.type]?.personalSpace ?? UNIT_TYPES[b.type].radius,
        );
        const minDistance = Math.max(UNIT_TYPES[a.type].radius + UNIT_TYPES[b.type].radius, roleDistance);
        const dx = b.x - a.x; const dz = b.z - a.z; const length = Math.hypot(dx, dz);
        if (!length) {
          const bias = ((a.id + b.id) % 8) * 0.12 + 0.08;
          a.x = clamp(a.x - bias, 0.45, CONFIG.mapWidth - 0.45);
          b.x = clamp(b.x + bias, 0.45, CONFIG.mapWidth - 0.45);
          continue;
        }
        const nx = dx / length; const nz = dz / length;
        const combatPair = a.command === 'attack' || b.command === 'attack';
        const comfortDistance = Math.max(minDistance + (combatPair ? 0.35 : 0.56),
          SPACING_ROLES[a.type]?.groupGap ?? minDistance,
          SPACING_ROLES[b.type]?.groupGap ?? minDistance);
        const bothMoving = a.path.length && b.path.length && (a.motionSpeed > 0.08 || b.motionSpeed > 0.08);
        if (bothMoving && length < comfortDistance) {
          const softPush = ((comfortDistance - length) / comfortDistance) * 0.24;
          a.velocityX -= nx * softPush;
          a.velocityZ -= nz * softPush;
          b.velocityX += nx * softPush;
          b.velocityZ += nz * softPush;
        }
        if (length >= minDistance) continue;
        const push = (minDistance - length) / 2;
        a.x = clamp(a.x - nx * push, 0.45, CONFIG.mapWidth - 0.45);
        a.z = clamp(a.z - nz * push, 0.45, CONFIG.mapHeight - 0.45);
        b.x = clamp(b.x + nx * push, 0.45, CONFIG.mapWidth - 0.45);
        b.z = clamp(b.z + nz * push, 0.45, CONFIG.mapHeight - 0.45);
          }
        }
      }
    }
    for (const unit of live) this._constrainUnitPosition(unit);
  }

  getEntityAt(point, radius = 1.3) {
    const unitHit = this.units
      .filter((unit) => !unit.dead && distance(point, unit) <= radius)
      .sort((a, b) => distance(point, a) - distance(point, b))[0];
    if (unitHit) return unitHit;
    // A resource clicked directly at its node should remain targetable even
    // when a monumental structure's expanded edge clearance sits nearby.
    // This keeps the Crown Hall from swallowing the opening wood command.
    const resourceHit = this.resourcesNodes
      .filter((node) => node.amount > 0 && distance(point, node) <= resourceFootprint(node))
      .sort((a, b) => distance(point, a) - distance(point, b))[0];
    if (resourceHit) return resourceHit;
    const buildingHit = this.buildings
      .filter((building) => !building.destroyed && building.hp > 0 && this._distanceToBuildingEdge(point, building) <= radius)
      .sort((a, b) => this._distanceToBuildingEdge(point, a) - this._distanceToBuildingEdge(point, b))[0];
    if (buildingHit) return buildingHit;
    return null;
  }

  selectAt(point, additive = false) {
    this.selectEntity(this.getEntityAt(point), additive);
  }

  selectEntity(entity, additive = false) {
    if (!additive) this.selectedIds = [];
    if (entity && entity.faction !== 'enemy') {
      if (additive && this.selectedIds.includes(entity.id)) this.selectedIds = this.selectedIds.filter((id) => id !== entity.id);
      else this.selectedIds.push(entity.id);
    }
    this._syncSelectionFlags();
    const label = entity
      ? entity.kind === 'unit'
        ? UNIT_TYPES[entity.type].label
        : entity.kind === 'building'
          ? BUILDING_TYPES[entity.type].label
          : RESOURCE_TYPES[entity.resourceType].label
      : null;
    this.lastCommand = !entity
      ? 'Nothing selected.'
      : entity.faction === 'enemy'
        ? `${label} is hostile · select a defender, then click to attack.`
        : `${label} selected.`;
  }

  selectRect(start, end, screenProjector, additive = false) {
    const x1 = Math.min(start.x, end.x); const x2 = Math.max(start.x, end.x);
    const y1 = Math.min(start.y, end.y); const y2 = Math.max(start.y, end.y);
    if (!additive) this.selectedIds = [];
    for (const unit of this.units.filter((candidate) => candidate.faction === 'player' && !candidate.dead)) {
      const screen = screenProjector(unit);
      if (screen.x >= x1 && screen.x <= x2 && screen.y >= y1 && screen.y <= y2) this.selectedIds.push(unit.id);
    }
    this._syncSelectionFlags();
    this.lastCommand = this.selectedIds.length ? `${this.selectedIds.length} Crownwarden${this.selectedIds.length === 1 ? '' : 's'} selected.` : 'No Crownwardens in that box.';
  }

  selectAllVillagers() {
    const villagers = this.units
      .filter((unit) => unit.type === 'villager' && unit.faction === 'player' && !unit.dead)
      .sort((a, b) => a.id - b.id);
    this.selectedIds = villagers.map((unit) => unit.id);
    this._syncSelectionFlags();
    this.lastCommand = villagers.length
      ? `All ${villagers.length} villager${villagers.length === 1 ? '' : 's'} selected.`
      : 'No villagers are available.';
    return { kind: 'selection', success: villagers.length > 0, count: villagers.length, entities: villagers };
  }

  demolishStructures(targets = []) {
    const uniqueTargets = [...new Map((Array.isArray(targets) ? targets : [targets])
      .filter((target) => target?.kind === 'building')
      .map((target) => [target.id, target])).values()];
    const validTargets = uniqueTargets.filter((building) => this.canDemolishBuilding(building));
    const protectedCount = uniqueTargets.length - validTargets.length;
    if (!validTargets.length) {
      this.lastCommand = protectedCount
        ? 'The Crown Hall and non-player structures cannot be demolished.'
        : 'Drag across, or click, a player-built structure to demolish it.';
      this._announce(this.lastCommand);
      return { kind: 'demolish', success: false, targetCount: 0, protectedCount };
    }
    validTargets.forEach((building) => this._destroyBuilding(building, null, {
      silent: true,
      instantCleanup: true,
    }));
    this.lastCommand = `${validTargets.length} structure${validTargets.length === 1 ? '' : 's'} demolished · debris cleared.`;
    if (protectedCount) this.lastCommand += ' Protected structures were skipped.';
    this._announce(this.lastCommand);
    return {
      kind: 'demolish',
      success: true,
      targetCount: validTargets.length,
      protectedCount,
      targets: validTargets,
    };
  }

  issueContextCommand(point, forcedTarget = null) {
    const units = this.units.filter((unit) => this.selectedIds.includes(unit.id) && unit.faction === 'player' && !unit.dead);
    if (!units.length) {
      this.lastCommand = 'Select a villager or Crown Guard first.';
      this._announce(this.lastCommand);
      return { kind: 'none', success: false };
    }
    const target = forcedTarget ?? this.getEntityAt(point);
    if (target?.kind === 'resource') {
      const workers = units.filter((unit) => this.isWorkerUnit(unit));
      if (!workers.length) {
        this.lastCommand = 'Select a worker to gather resources.';
        this._announce('Select a worker to gather resources.');
        return { kind: 'none', success: false, target };
      }
      let routed = 0;
      let queued = 0;
      const slotCount = resourceSlotCount(target);
      workers.forEach((unit, index) => {
        if (this._queueConstructionOrder(unit, {
          kind: 'gather',
          resourceId: target.id,
          resourceType: target.resourceType,
          origin: { x: target.x, z: target.z },
          gatherSlot: (index + unit.id) % slotCount,
        })) {
          routed += 1;
          queued += 1;
          return;
        }
        this._interruptWork(unit);
        unit.gatherTarget = target.id;
        unit.gatherSlot = (index + unit.id) % slotCount;
        unit.gatherTimer = unit.carryAmount > 0 ? 0 : index * 0.18;
        unit.gatherEventFired = false;
        unit.postDepositTarget = null;
        if (unit.carryAmount > 0) routed += this._beginReturn(unit) ? 1 : 0;
        else routed += this._assignResourceWork(unit, {
          resourceType: target.resourceType,
          origin: target,
          preferredNode: target,
          radius: RESOURCE_MANUAL_FALLBACK_RADIUS,
          preferredSlot: (index + unit.id) % slotCount,
        }) ? 1 : 0;
      });
      if (!routed) {
        this.lastCommand = `No route to ${RESOURCE_TYPES[target.resourceType].label.toLowerCase()}.`;
        this._announce(this.lastCommand);
        return { kind: 'none', success: false, target };
      }
      this.lastCommand = workers.some((unit) => unit.carryAmount > 0)
        ? `Return cargo, then gather ${RESOURCE_TYPES[target.resourceType].label.toLowerCase()}.`
        : `Gather ${RESOURCE_TYPES[target.resourceType].label.toLowerCase()}.`;
      if (queued) this.lastCommand += ` ${queued} builder${queued === 1 ? '' : 's'} queued it after construction.`;
      return { kind: 'gather', success: true, target, queued };
    }
    if (target?.kind === 'building' && this.buildingNeedsWork(target)) {
      const repair = target.progress >= 1;
      const builders = units.filter((unit) => this.isBuilderUnit(unit)).slice(0, this._buildingInteractionSlotCount(target));
      if (!builders.length) {
        this.lastCommand = `Select a builder to ${repair ? 'repair this structure' : 'continue construction'}.`;
        this._announce(this.lastCommand);
        return { kind: 'none', success: false, target };
      }
      let assigned = 0;
      let queued = 0;
      builders.forEach((unit, index) => {
        if (this._queueConstructionOrder(unit, { kind: 'build', buildingId: target.id, buildSlot: index })) {
          assigned += 1;
          queued += 1;
          return;
        }
        this._interruptWork(unit);
        unit.postDepositTarget = null;
        if (unit.carryAmount > 0) {
          unit.postDepositBuildTarget = target.id;
          if (this._beginReturn(unit)) assigned += 1;
          else unit.postDepositBuildTarget = null;
          return;
        }
        unit.buildTarget = target.id;
        if (this._sendUnitToBuilding(unit, target, index)) assigned += 1;
        else unit.buildTarget = null;
      });
      if (!assigned) {
        this.lastCommand = `No route to the ${BUILDING_TYPES[target.type].label.toLowerCase()}${repair ? '' : ' foundation'}.`;
        this._announce(this.lastCommand);
        return { kind: 'none', success: false, target };
      }
      this.lastCommand = repair
        ? `Repair ${BUILDING_TYPES[target.type].label} with ${assigned} builder${assigned === 1 ? '' : 's'}.`
        : `Continue ${BUILDING_TYPES[target.type].label} construction with ${assigned} builder${assigned === 1 ? '' : 's'}.`;
      if (queued) this.lastCommand += ` ${queued} builder${queued === 1 ? '' : 's'} queued it after current construction.`;
      return { kind: repair ? 'repair' : 'build', success: true, target, assigned, queued };
    }
    if (target?.kind === 'building' && target.faction === 'player' && target.type === 'townCenter' && target.progress >= 1 && !target.destroyed) {
      let routed = 0;
      let queued = 0;
      units.forEach((unit, index) => {
        if (this._queueConstructionOrder(unit, { kind: 'crownHall', buildingId: target.id, index, total: units.length })) {
          routed += 1;
          queued += 1;
          return;
        }
        this._interruptWork(unit);
        unit.postDepositTarget = null;
        if (unit.carryAmount > 0) {
          // Cargo still belongs at the Hall, but a loaded worker should use
          // the normal drop-off approach so it deposits before climbing.
          routed += this._beginReturn(unit) ? 1 : 0;
        } else {
          routed += this._sendUnitToCrownHallStairs(unit, target, index, units.length) ? 1 : 0;
        }
      });
      if (!routed) {
        this.lastCommand = 'The Crown Hall steps are blocked.';
        this._announce(this.lastCommand);
        return { kind: 'none', success: false, target };
      }
      this.lastCommand = 'Walk to the Crown Hall steps.';
      if (queued) this.lastCommand += ` ${queued} builder${queued === 1 ? '' : 's'} queued it after construction.`;
      return { kind: 'move', success: true, target, queued };
    }
    if (target?.kind === 'building' && target.faction === 'player' && target.progress >= 1 && BUILDING_TYPES[target.type].storage) {
      const workers = units.filter((unit) => unit.type === 'villager');
      if (!workers.length) {
        this.lastCommand = 'Select a worker to use a drop-off building.';
        this._announce(this.lastCommand);
        return { kind: 'none', success: false, target };
      }
      let routed = 0;
      let queued = 0;
      workers.forEach((unit) => {
        if (this._queueConstructionOrder(unit, { kind: 'storage', buildingId: target.id })) {
          routed += 1;
          queued += 1;
          return;
        }
        this._interruptWork(unit);
        unit.postDepositTarget = null;
        if (unit.carryAmount > 0) {
          routed += this._beginReturn(unit) ? 1 : 0;
        } else {
          const route = this._bestPathToPoints(unit, this._storageApproachPoints(target));
          if (route) {
            unit.path = route.path;
            unit.routeTarget = route.point;
            unit.stopDistance = STORAGE_INTERACTION_DISTANCE;
            unit.pathBlocked = false;
            unit.command = 'move';
            unit.actionLabel = `Moving to ${BUILDING_TYPES[target.type].label}`;
            this._resetMovementTracking(unit);
            routed += 1;
          }
        }
      });
      if (!routed) {
        this.lastCommand = `No route to ${BUILDING_TYPES[target.type].label.toLowerCase()}.`;
        this._announce(this.lastCommand);
        return { kind: 'none', success: false, target };
      }
      this.lastCommand = `Move to ${BUILDING_TYPES[target.type].label}.`;
      if (queued) this.lastCommand += ` ${queued} builder${queued === 1 ? '' : 's'} queued it after construction.`;
      return { kind: 'move', success: true, target, queued };
    }
    if (target?.kind === 'building' && target.faction === 'player' && target.progress >= 1) {
      const approach = this._buildingApproachPoints(target);
      let routed = 0;
      let queued = 0;
      units.forEach((unit, index) => {
        if (this._queueConstructionOrder(unit, { kind: 'building', buildingId: target.id, index })) {
          routed += 1;
          queued += 1;
          return;
        }
        this._interruptWork(unit);
        const point = approach[index % approach.length];
        if (unit.carryAmount > 0) {
          unit.postDepositTarget = point;
          routed += this._beginReturn(unit) ? 1 : 0;
        } else {
          const route = this._bestPathToPoints(unit, approach);
          if (route) {
            unit.path = route.path;
            unit.routeTarget = route.point;
            unit.stopDistance = BUILDING_INTERACTION_DISTANCE;
            unit.pathBlocked = false;
            unit.command = 'move';
            unit.actionLabel = `Moving to ${BUILDING_TYPES[target.type].label}`;
            this._resetMovementTracking(unit);
            routed += 1;
          }
        }
      });
      if (!routed) {
        this.lastCommand = `No route to ${BUILDING_TYPES[target.type].label.toLowerCase()}.`;
        this._announce(this.lastCommand);
        return { kind: 'none', success: false, target };
      }
      this.lastCommand = `Move to ${BUILDING_TYPES[target.type].label}.`;
      if (queued) this.lastCommand += ` ${queued} builder${queued === 1 ? '' : 's'} queued it after construction.`;
      return { kind: 'move', success: true, target, queued };
    }
    if (target?.kind === 'unit' && target.faction === 'enemy') {
      const attackers = units.filter((unit) => UNIT_TYPES[unit.type]?.canAttackUnits !== false);
      if (!attackers.length) {
        this.lastCommand = 'Select a unit able to defend the settlement.';
        this._announce(this.lastCommand);
        return { kind: 'none', success: false, target };
      }
      let queued = 0;
      let routed = 0;
      attackers.forEach((unit, index) => {
        if (this._queueConstructionOrder(unit, {
          kind: 'attack',
          targetId: target.id,
          targetKind: 'unit',
          attackSlot: index,
        })) {
          queued += 1;
          return;
        }
        this._interruptWork(unit);
        unit.postDepositTarget = null;
        unit.attackTarget = target.id;
        unit.attackSlot = index % COMBAT_SLOT_COUNT;
        // Defense orders are immediate even when a worker is carrying a load.
        // Returning first made the requested target stale and reduced the
        // command to a move near its old position. The normal attack cleanup
        // already sends surviving workers to deposit after combat.
        if (this._sendUnitToAttack(unit, target, index)) routed += 1;
      });
      if (!routed && !queued) {
        this.lastCommand = `No open approach to ${UNIT_TYPES[target.type].label}.`;
        this._announce(this.lastCommand);
        return { kind: 'none', success: false, target };
      }
      this.lastCommand = `Engage ${UNIT_TYPES[target.type].label}.`;
      if (queued) this.lastCommand += ` ${queued} builder${queued === 1 ? '' : 's'} queued it after construction.`;
      return { kind: 'attack', success: true, target, queued };
    }
    if (target?.kind === 'building' && target.faction === 'enemy' && target.progress >= 1 && !target.destroyed) {
      const attackers = units.filter((unit) => UNIT_TYPES[unit.type]?.canAttackBuildings !== false);
      if (!attackers.length) {
        this.lastCommand = 'Villagers defend against units; select a military unit to attack structures.';
        this._announce(this.lastCommand);
        return { kind: 'none', success: false, target };
      }
      let queued = 0;
      attackers.forEach((unit, index) => {
        if (this._queueConstructionOrder(unit, {
          kind: 'attack',
          targetId: target.id,
          targetKind: 'building',
          attackSlot: index,
        })) {
          queued += 1;
          return;
        }
        this._interruptWork(unit);
        unit.postDepositTarget = null;
        if (unit.carryAmount > 0) {
          unit.postDepositTarget = { x: target.x, z: target.z };
          this._beginReturn(unit);
        } else {
          this._sendUnitToAttack(unit, target, index);
        }
      });
      this.lastCommand = `Attack ${BUILDING_TYPES[target.type].label}.`;
      if (queued) this.lastCommand += ` ${queued} builder${queued === 1 ? '' : 's'} queued it after construction.`;
      return { kind: 'attack', success: true, target, queued };
    }
    // A single selected unit should land on the cursor location. The ring is
    // only for groups, where it prevents everyone from collapsing onto one
    // point while preserving a readable formation.
    const spacing = units.length === 1 ? 0 : Math.min(2.4, Math.max(1.35, 0.72 + units.length * 0.22));
    let routed = 0;
    let queued = 0;
    const pendingMoves = [];
    units.forEach((unit, index) => {
      const angle = (index / Math.max(1, units.length)) * Math.PI * 2;
      const moveTarget = { x: point.x + Math.cos(angle) * spacing, z: point.z + Math.sin(angle) * spacing };
      if (this._queueConstructionOrder(unit, { kind: 'move', target: moveTarget, stopDistance: 0 })) {
        routed += 1;
        queued += 1;
        return;
      }
      this._interruptWork(unit);
      if (unit.carryAmount > 0) {
        unit.postDepositTarget = moveTarget;
        routed += this._beginReturn(unit) ? 1 : 0;
      } else {
        unit.postDepositTarget = null;
        const directPath = this._buildPath(unit, moveTarget, null, { directOnly: true });
        if (directPath) {
          unit.path = directPath;
          unit.routeTarget = { ...moveTarget };
          unit.stopDistance = 0;
          unit.pathBlocked = false;
          unit.command = 'move';
          unit.actionLabel = 'Moving';
          this._resetMovementTracking(unit);
          routed += 1;
        } else {
          pendingMoves.push({ unit, moveTarget });
        }
      }
    });
    // Units selected together are normally standing in the same local group.
    // When an obstacle requires A*, solve one representative route for that
    // cluster and let its neighbors use the same corridor. This prevents a
    // sealed forest click from repeating an identical expensive failure for
    // every unit before the browser can acknowledge the command.
    while (pendingMoves.length) {
      const leaderOrder = pendingMoves.shift();
      const cluster = [leaderOrder];
      for (let index = pendingMoves.length - 1; index >= 0; index -= 1) {
        if (distance(pendingMoves[index].unit, leaderOrder.unit) > 12) continue;
        cluster.push(pendingMoves[index]);
        pendingMoves.splice(index, 1);
      }
      if (!this._sendUnitTo(leaderOrder.unit, leaderOrder.moveTarget, 'move')) {
        for (const follower of cluster.slice(1)) {
          follower.unit.path = [];
          follower.unit.routeTarget = { ...follower.moveTarget };
          follower.unit.pathBlocked = true;
          follower.unit.recoveryAvailable = true;
          follower.unit.command = 'idle';
          follower.unit.visualState = 'idle';
          follower.unit.actionLabel = 'No route available';
        }
        continue;
      }
      routed += 1;
      for (const follower of cluster.slice(1)) {
        follower.unit.path = leaderOrder.unit.path.map((waypoint) => ({ ...waypoint }));
        follower.unit.routeTarget = { ...leaderOrder.unit.routeTarget };
        follower.unit.stopDistance = 0;
        follower.unit.pathBlocked = false;
        follower.unit.command = 'move';
        follower.unit.actionLabel = 'Moving';
        this._resetMovementTracking(follower.unit);
        routed += 1;
      }
    }
    if (!routed) {
      this.lastCommand = 'No route to that location.';
      this._announce(this.lastCommand);
      return { kind: 'none', success: false, target: point };
    }
    this.lastCommand = `Move ${units.length} unit${units.length === 1 ? '' : 's'}.`;
    if (queued) this.lastCommand += ` ${queued} builder${queued === 1 ? '' : 's'} queued it after construction.`;
    return { kind: 'move', success: true, target: point, queued };
  }

  _wallSegmentRecords() {
    return this.buildings
      .filter((building) => building.type === 'wall' && building.faction === 'player' && !building.destroyed)
      .flatMap((wall) => {
        const points = this._wallSegmentPoints(wall);
        const direction = wallDirectionFromOptions(wall);
        return points.map((point, index) => {
          const side = points.length === 1
            ? 'single'
            : index === 0
              ? 'start'
              : index === points.length - 1
                ? 'end'
                : 'middle';
          const inwardDirections = side === 'single' || side === 'middle'
            ? [direction, { x: -direction.x, z: -direction.z }]
            : side === 'start'
              ? [direction]
              : [{ x: -direction.x, z: -direction.z }];
          const outwardDirection = side === 'start'
            ? { x: -direction.x, z: -direction.z }
            : side === 'end'
              ? { x: direction.x, z: direction.z }
              : null;
          return {
            wall,
            wallId: wall.id,
            segmentIndex: index,
            side,
            point,
            direction,
            inwardDirections,
            outwardDirection,
          };
        });
      });
  }

  _wallJunctionSockets() {
    const span = BUILDING_TYPES.wall.wallSegmentSpan ?? BUILDING_TYPES.wall.footprint.width;
    const records = this._wallSegmentRecords();
    const sockets = [];
    const socketKey = (point) => `${Math.round(point.x * 4)}:${Math.round(point.z * 4)}`;
    const addSocket = (point, members, legacy = false) => {
      const uniqueMembers = [];
      const memberKeys = new Set();
      for (const member of members) {
        const key = `${member.wallId}:${member.segmentIndex}`;
        if (memberKeys.has(key)) continue;
        memberKeys.add(key);
        uniqueMembers.push(member);
      }
      if (new Set(uniqueMembers.map((member) => member.wallId)).size < 2) return;
      const key = socketKey(point);
      const existing = sockets.find((socket) => socket.key === key);
      if (existing) {
        const merged = [...existing.members, ...uniqueMembers];
        const mergedKeys = new Set();
        existing.members = merged.filter((member) => {
          const memberKey = `${member.wallId}:${member.segmentIndex}`;
          if (mergedKeys.has(memberKey)) return false;
          mergedKeys.add(memberKey);
          return true;
        });
        existing.wallIds = [...new Set(existing.members.map((member) => member.wallId))];
        existing.directions = existing.members.map((member) => member.direction);
        const branchKeys = new Set();
        existing.branchDirections = existing.members.flatMap((member) => member.inwardDirections)
          .map((direction) => normalizeWallDirection(direction))
          .filter((direction) => {
            const angle = Math.atan2(direction.z, direction.x);
            const branchKey = String(((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8);
            if (branchKeys.has(branchKey)) return false;
            branchKeys.add(branchKey);
            return true;
          });
        existing.branchCount = existing.branchDirections.length;
        existing.legacy = existing.legacy && legacy;
        return;
      }
      const branchDirections = [];
      const branchKeys = new Set();
      for (const member of uniqueMembers) {
        for (const direction of member.inwardDirections) {
          const normalized = normalizeWallDirection(direction);
          const angle = Math.atan2(normalized.z, normalized.x);
          const branchKey = String(((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8);
          if (branchKeys.has(branchKey)) continue;
          branchKeys.add(branchKey);
          branchDirections.push(normalized);
        }
      }
      sockets.push({
        key,
        point: { ...point },
        members: uniqueMembers,
        wallIds: [...new Set(uniqueMembers.map((member) => member.wallId))],
        directions: uniqueMembers.map((member) => member.direction),
        branchDirections,
        branchCount: branchDirections.length,
        legacy,
      });
    };

    // A panel is centered on its world point, while its physical connection
    // sockets live half a segment beyond that center. Group those true socket
    // points—not the image centers—so a turned run forms an L/V instead of
    // crossing through the corner.
    const physicalSockets = records.flatMap((record) => {
      if (record.side === 'start') return [{ member: record, point: {
        x: record.point.x - record.direction.x * span / 2,
        z: record.point.z - record.direction.z * span / 2,
      } }];
      if (record.side === 'end') return [{ member: record, point: {
        x: record.point.x + record.direction.x * span / 2,
        z: record.point.z + record.direction.z * span / 2,
      } }];
      if (record.side === 'single') return [-1, 1].map((sign) => ({ member: record, point: {
        x: record.point.x + record.direction.x * span * sign / 2,
        z: record.point.z + record.direction.z * span * sign / 2,
      } }));
      return [{ member: record, point: { ...record.point } }];
    });
    const visited = new Set();
    for (let index = 0; index < physicalSockets.length; index += 1) {
      if (visited.has(index)) continue;
      const group = [physicalSockets[index]];
      for (let other = index + 1; other < physicalSockets.length; other += 1) {
        if (distance(physicalSockets[index].point, physicalSockets[other].point) <= WALL_JUNCTION_MATCH_DISTANCE) {
          group.push(physicalSockets[other]);
          visited.add(other);
        }
      }
      if (new Set(group.map(({ member }) => member.wallId)).size >= 2) {
        const point = {
          x: group.reduce((sum, socket) => sum + socket.point.x, 0) / group.length,
          z: group.reduce((sum, socket) => sum + socket.point.z, 0) / group.length,
        };
        addSocket(point, group.map(({ member }) => member), false);
      }
    }

    // Existing saves and runs created by the earlier connector model leave
    // one segment span between terminal centers. Their physical panels meet
    // at the midpoint, which remains a valid hardpoint for a corner tower.
    const endpoints = records.filter((record) => record.side === 'start' || record.side === 'end' || record.side === 'single');
    for (let firstIndex = 0; firstIndex < endpoints.length; firstIndex += 1) {
      const first = endpoints[firstIndex];
      for (let secondIndex = firstIndex + 1; secondIndex < endpoints.length; secondIndex += 1) {
        const second = endpoints[secondIndex];
        if (first.wallId === second.wallId) continue;
        const separation = distance(first.point, second.point);
        if (separation < span * WALL_JUNCTION_LEGACY_MIN || separation > span * WALL_JUNCTION_LEGACY_MAX) continue;
        const connector = {
          x: (second.point.x - first.point.x) / separation,
          z: (second.point.z - first.point.z) / separation,
        };
        const firstAlignment = first.outwardDirection
          ? connector.x * first.outwardDirection.x + connector.z * first.outwardDirection.z
          : 0;
        const secondAlignment = second.outwardDirection
          ? -connector.x * second.outwardDirection.x - connector.z * second.outwardDirection.z
          : 0;
        if (Math.max(firstAlignment, secondAlignment) < 0.82) continue;
        addSocket({
          x: (first.point.x + second.point.x) / 2,
          z: (first.point.z + second.point.z) / 2,
        }, [first, second], true);
      }
    }
    return sockets;
  }

  getPalisadeJunctions() {
    return this._wallJunctionSockets().map((socket) => ({
      x: socket.point.x,
      z: socket.point.z,
      wallIds: [...socket.wallIds],
      branchCount: socket.branchCount,
      legacy: socket.legacy,
      members: socket.members.map((member) => ({
        wallId: member.wallId,
        segmentIndex: member.segmentIndex,
        side: member.side,
        x: member.point.x,
        z: member.point.z,
      })),
    }));
  }

  _nearestWallConnection(point, direction, signs = [1, -1]) {
    const blueprint = BUILDING_TYPES.wall;
    const span = blueprint.wallSegmentSpan ?? blueprint.footprint.width;
    let nearest = null;
    const walls = this.buildings.filter((building) => building.type === 'wall'
      && building.faction === 'player'
      && !building.destroyed);
    const occupied = walls.flatMap((wall) => this._wallSegmentPoints(wall));
    const records = walls.flatMap((wall) => {
      const segments = this._wallSegmentPoints(wall);
      const wallDirection = wallDirectionFromOptions(wall);
      return segments.map((segment, index) => ({
        buildingId: wall.id,
        side: index === 0 ? 'start' : index === segments.length - 1 ? 'end' : 'middle',
        point: segment,
        wallDirection,
        outwardDirection: index === 0
          ? { x: -wallDirection.x, z: -wallDirection.z }
          : index === segments.length - 1
            ? { x: wallDirection.x, z: wallDirection.z }
            : null,
      }));
    });
    for (const endpoint of records) {
      // The new segment center sits one segment span away from the existing
      // terminal center. Testing both signs also allows clean T-junctions and
      // corners instead of forcing every new wall to extend straight ahead.
      for (const sign of signs) {
        const candidateOffset = { x: direction.x * sign, z: direction.z * sign };
        const outwardAlignment = endpoint.outwardDirection
          ? candidateOffset.x * endpoint.outwardDirection.x + candidateOffset.z * endpoint.outwardDirection.z
          : 0;
        const runAlignment = Math.abs(candidateOffset.x * endpoint.wallDirection.x
          + candidateOffset.z * endpoint.wallDirection.z);
        // Never magnetize back onto the existing run itself. Perpendicular
        // and diagonal headings are legitimate corner turns or T-junctions,
        // so only reject a heading that points directly back through the old
        // wall. This is
        // what keeps a connected endpoint locked when the player changes the
        // new run from a straight extension into a different compass heading.
        if (endpoint.outwardDirection && outwardAlignment < -0.85) continue;
        if (!endpoint.outwardDirection) {
          // Interior sockets exist for dividers and T-junctions. A collinear
          // interior socket would merely duplicate the neighboring panel, so
          // reserve those headings for actual run endpoints.
          if (runAlignment > 0.85) continue;
        }
        const socket = endpoint.outwardDirection ? {
          x: endpoint.point.x + endpoint.outwardDirection.x * span / 2,
          z: endpoint.point.z + endpoint.outwardDirection.z * span / 2,
        } : endpoint.point;
        const candidate = {
          x: socket.x + candidateOffset.x * span / 2,
          z: socket.z + candidateOffset.z * span / 2,
        };
        if (runAlignment > 0.85
          && occupied.some((segment) => distance(segment, candidate) <= WALL_ATTACHMENT_SEGMENT_MATCH_DISTANCE)) continue;
        const distanceToCandidate = distance(point, candidate);
        if (distanceToCandidate > WALL_CONNECT_SNAP_DISTANCE) continue;
        const priorityDistance = distanceToCandidate + (endpoint.side === 'middle' ? 0.42 : 0);
        if (!nearest || priorityDistance < nearest.priorityDistance - 0.001) {
          nearest = {
            buildingId: endpoint.buildingId,
            side: endpoint.side,
            point: candidate,
            distance: distanceToCandidate,
            priorityDistance,
          };
        }
      }
    }
    return nearest;
  }

  _wallRunBounds(anchor, direction, count, padding = BUILDING_CLEARANCE) {
    const span = BUILDING_TYPES.wall.wallSegmentSpan ?? BUILDING_TYPES.wall.footprint.width;
    const safeCount = Math.max(1, Math.round(count));
    const center = {
      x: anchor.x + direction.x * (safeCount - 1) * span / 2,
      z: anchor.z + direction.z * (safeCount - 1) * span / 2,
    };
    return this._buildingBounds('wall', center, padding, {
      wallSegments: safeCount,
      wallDirection: direction,
    });
  }

  _wallRunFitsMap(anchor, direction, count, padding = BUILDING_CLEARANCE) {
    const bounds = this._wallRunBounds(anchor, direction, count, padding);
    const boundaryMargin = padding <= 0.001 ? WALL_EDGE_BOUNDARY_MARGIN : 0.55;
    return bounds.minX >= boundaryMargin
      && bounds.minZ >= boundaryMargin
      && bounds.maxX <= CONFIG.mapWidth - boundaryMargin
      && bounds.maxZ <= CONFIG.mapHeight - boundaryMargin;
  }

  _maxWallSegmentsFromAnchor(anchor, direction, padding = BUILDING_CLEARANCE) {
    let maximum = 0;
    for (let count = 1; count <= WALL_MAX_SEGMENTS; count += 1) {
      if (!this._wallRunFitsMap(anchor, direction, count, padding)) break;
      maximum = count;
    }
    return Math.max(1, maximum);
  }

  _snapWallStartToMapEdge(point, direction) {
    const snapped = {
      x: Math.round(point.x),
      z: Math.round(point.z),
    };
    let locked = false;
    if (direction.x > 0.01 && point.x <= WALL_EDGE_SNAP_DISTANCE) {
      snapped.x = WALL_EDGE_CENTER_MARGIN;
      locked = true;
    } else if (direction.x < -0.01 && point.x >= CONFIG.mapWidth - WALL_EDGE_SNAP_DISTANCE) {
      snapped.x = CONFIG.mapWidth - WALL_EDGE_CENTER_MARGIN;
      locked = true;
    }
    if (direction.z > 0.01 && point.z <= WALL_EDGE_SNAP_DISTANCE) {
      snapped.z = WALL_EDGE_CENTER_MARGIN;
      locked = true;
    } else if (direction.z < -0.01 && point.z >= CONFIG.mapHeight - WALL_EDGE_SNAP_DISTANCE) {
      snapped.z = CONFIG.mapHeight - WALL_EDGE_CENTER_MARGIN;
      locked = true;
    }
    return { point: snapped, locked };
  }

  _forwardWallEdgeDistance(point, direction) {
    const distances = [];
    if (direction.x > 0.01) distances.push(CONFIG.mapWidth - point.x);
    if (direction.x < -0.01) distances.push(point.x);
    if (direction.z > 0.01) distances.push(CONFIG.mapHeight - point.z);
    if (direction.z < -0.01) distances.push(point.z);
    return distances.length ? Math.min(...distances) : Infinity;
  }

  _wallSegmentsToForwardEdge(anchor, direction) {
    const span = BUILDING_TYPES.wall.wallSegmentSpan ?? BUILDING_TYPES.wall.footprint.width;
    const distances = [];
    if (direction.x > 0.01) distances.push((CONFIG.mapWidth - WALL_EDGE_CENTER_MARGIN - anchor.x) / direction.x);
    if (direction.x < -0.01) distances.push((WALL_EDGE_CENTER_MARGIN - anchor.x) / direction.x);
    if (direction.z > 0.01) distances.push((CONFIG.mapHeight - WALL_EDGE_CENTER_MARGIN - anchor.z) / direction.z);
    if (direction.z < -0.01) distances.push((WALL_EDGE_CENTER_MARGIN - anchor.z) / direction.z);
    const forward = distances.filter((value) => Number.isFinite(value) && value >= 0);
    if (!forward.length) return 1;
    // Ceil deliberately puts the final fixed-spacing segment on or just past
    // the collision-safe edge target. Placement validation allows that small
    // overhang so there is never a raider-sized sliver at the diamond tip.
    return Math.max(1, Math.min(WALL_MAX_SEGMENTS, Math.ceil(Math.min(...forward) / span) + 1));
  }

  _wallSegmentPoints(source) {
    const blueprint = BUILDING_TYPES.wall;
    const span = blueprint.wallSegmentSpan ?? blueprint.footprint.width;
    const count = Math.max(1, Math.round(source.wallSegments ?? 1));
    const direction = wallDirectionFromOptions(source);
    const start = source.wallStart ?? {
      x: source.x - direction.x * (count - 1) * span / 2,
      z: source.z - direction.z * (count - 1) * span / 2,
    };
    return Array.from({ length: count }, (_, index) => ({
      x: start.x + direction.x * index * span,
      z: start.z + direction.z * index * span,
    }));
  }

  _nearestWallAttachmentSegment(point, attachmentType = 'gate') {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return null;
    const records = this._wallSegmentRecords();
    const wallSpan = BUILDING_TYPES.wall.wallSegmentSpan ?? BUILDING_TYPES.wall.footprint.width;

    // A tower is a true graph hardpoint. Near a corner, T-junction, or cross,
    // prefer the shared physical socket and claim every participating terminal
    // instead of replacing one panel and leaving another wall inside its base.
    if (attachmentType === 'palisadeTower') {
      const junction = this._wallJunctionSockets()
        .map((socket) => ({ socket, distance: distance(point, socket.point) }))
        .filter((candidate) => candidate.distance <= WALL_ATTACHMENT_SNAP_DISTANCE)
        .sort((first, second) => first.distance - second.distance)[0];
      if (junction) {
        const primary = [...junction.socket.members]
          .sort((first, second) => distance(point, first.point) - distance(point, second.point))[0];
        return {
          wall: primary.wall,
          wallId: primary.wallId,
          segmentIndex: primary.segmentIndex,
          point: { ...junction.socket.point },
          direction: primary.direction,
          directions: junction.socket.directions.map((direction) => ({ ...direction })),
          distance: junction.distance,
          wallIds: [...junction.socket.wallIds],
          segmentClaims: junction.socket.members.map((member) => ({
            wallId: member.wallId,
            segmentIndex: member.segmentIndex,
          })),
          connectorSegments: junction.socket.members.map((member) => ({
            // Nudge a terminal connector back toward its surviving wall run.
            // The tower still covers the join, while the opposite half of a
            // full wall panel no longer peeks out as a detached post.
            x: member.point.x + (member.inwardDirections.length === 1 ? member.inwardDirections[0].x * wallSpan * 0.26 : 0),
            z: member.point.z + (member.inwardDirections.length === 1 ? member.inwardDirections[0].z * wallSpan * 0.26 : 0),
            direction: { ...member.direction },
          })),
          junction: true,
          branchCount: junction.socket.branchCount,
        };
      }
    }

    const candidates = records
      .map((record) => ({ ...record, distance: distance(point, record.point) }))
      .filter((candidate) => candidate.distance <= WALL_ATTACHMENT_SNAP_DISTANCE)
      .sort((first, second) => {
        if (Math.abs(first.distance - second.distance) > 0.001) return first.distance - second.distance;
        // At a shared socket, favor the wall whose centerline the pointer is
        // closest to. This keeps a gate from randomly inheriting the other
        // branch's direction when two Palisades meet.
        const firstOffset = { x: point.x - first.point.x, z: point.z - first.point.z };
        const secondOffset = { x: point.x - second.point.x, z: point.z - second.point.z };
        const firstPerpendicular = Math.abs(firstOffset.x * -first.direction.z + firstOffset.z * first.direction.x);
        const secondPerpendicular = Math.abs(secondOffset.x * -second.direction.z + secondOffset.z * second.direction.x);
        return firstPerpendicular - secondPerpendicular || first.wallId - second.wallId;
      });
    const nearest = candidates[0];
    if (!nearest) return null;
    const collinearClaims = records.filter((record) => {
      if (distance(record.point, nearest.point) > WALL_ATTACHMENT_SEGMENT_MATCH_DISTANCE) return false;
      const alignment = Math.abs(record.direction.x * nearest.direction.x + record.direction.z * nearest.direction.z);
      return alignment > 0.93;
    });
    return {
      wall: nearest.wall,
      wallId: nearest.wallId,
      segmentIndex: nearest.segmentIndex,
      point: { ...nearest.point },
      direction: { ...nearest.direction },
      directions: collinearClaims.map((record) => ({ ...record.direction })),
      distance: nearest.distance,
      wallIds: [...new Set(collinearClaims.map((record) => record.wallId))],
      segmentClaims: collinearClaims.map((record) => ({ wallId: record.wallId, segmentIndex: record.segmentIndex })),
      connectorSegments: collinearClaims.map((record) => ({
        x: record.point.x,
        z: record.point.z,
        direction: { ...record.direction },
      })),
      junction: false,
      branchCount: 2,
    };
  }

  _nearestGateWallSegment(point) {
    return this._nearestWallAttachmentSegment(point, 'gate');
  }

  _gateOrientationFromDirection(direction = { x: 1, z: 0 }) {
    const normalized = wallDirectionFromOptions({ wallDirection: direction });
    const screenX = normalized.x - normalized.z;
    const screenY = (normalized.x + normalized.z) * (CONFIG.tileHeight / CONFIG.tileWidth);
    if (Math.abs(screenX) < 0.001) return 'depth';
    if (Math.abs(screenY) < 0.001) return 'face';
    return screenX * screenY < 0 ? 'diagonal-left' : 'diagonal-right';
  }

  _wallSegmentsOverlap(first, second) {
    const span = BUILDING_TYPES.wall.wallSegmentSpan ?? BUILDING_TYPES.wall.footprint.width;
    const overlapDistance = span * 0.42;
    const firstSegments = this._wallSegmentPoints(first);
    const secondSegments = this._wallSegmentPoints(second);
    return firstSegments.some((firstPoint) => secondSegments.some((secondPoint) => distance(firstPoint, secondPoint) < overlapDistance));
  }

  getWallLinePreview(start, end) {
    const blueprint = BUILDING_TYPES.wall;
    const span = blueprint.wallSegmentSpan ?? blueprint.footprint.width;
    const deltaX = end.x - start.x;
    const deltaZ = end.z - start.z;
    const dragDistance = Math.hypot(deltaX, deltaZ);
    const rawAngle = dragDistance > 0.04 ? Math.atan2(deltaZ, deltaX) : 0;
    // World z increases toward the screen's lower side, while the palette is
    // named from the player's view (north is screen-up). Negating the angle
    // keeps a drag toward screen-up/right in the NORTH-EAST sector instead of
    // silently labeling it SOUTH-EAST.
    const directionIndex = ((Math.round(-rawAngle / (Math.PI / 4)) % WALL_SNAP_DIRECTIONS.length) + WALL_SNAP_DIRECTIONS.length) % WALL_SNAP_DIRECTIONS.length;
    const snapped = WALL_SNAP_DIRECTIONS[directionIndex];
    const direction = normalizeWallDirection(snapped);
    // At the drag origin the first new segment must be one span ahead in the
    // chosen heading. Testing the reverse sign here could place that first
    // segment on the far side of the terminal, so a 90-degree turn would
    // appear magnetized while its next segment folded back through the old
    // wall. End-point matching keeps both signs because a drag may terminate
    // either just before or just beyond a terminal.
    const startConnection = this._nearestWallConnection(start, direction, [1]);
    const edgeStart = this._snapWallStartToMapEdge(start, direction);
    let anchor = startConnection?.point ?? edgeStart.point;
    let edgeLocked = !startConnection && edgeStart.locked;
    const projectedDistance = (end.x - anchor.x) * direction.x + (end.z - anchor.z) * direction.z;
    const distanceAlongWall = Math.max(span, Math.abs(projectedDistance));
    let mapPadding = edgeLocked ? 0 : BUILDING_CLEARANCE;
    let maximumSegments = edgeLocked
      ? this._wallSegmentsToForwardEdge(anchor, direction)
      : this._maxWallSegmentsFromAnchor(anchor, direction, mapPadding);
    const requestedSegments = Math.max(1, Math.round(distanceAlongWall / span) + 1);
    let segmentCount = Math.max(1, Math.min(maximumSegments, requestedSegments));
    let endConnection = null;
    let proposedEnd = {
      x: anchor.x + direction.x * (segmentCount - 1) * span,
      z: anchor.z + direction.z * (segmentCount - 1) * span,
    };
    let endCandidate = this._nearestWallConnection(end, direction)
      ?? this._nearestWallConnection(proposedEnd, direction);
    // A broad magnetic field must not fold a short turn back onto a second
    // socket of the same run that already owns its start. Keep the initial
    // connection locked while the player changes direction; a second,
    // distinct wall run can still be claimed at the far end for dividers.
    if (startConnection && endCandidate?.buildingId === startConnection.buildingId) endCandidate = null;
    if (endCandidate) {
      const projectedEnd = (endCandidate.point.x - anchor.x) * direction.x + (endCandidate.point.z - anchor.z) * direction.z;
      if (projectedEnd >= span * 0.75) {
        segmentCount = Math.max(1, Math.min(maximumSegments, Math.round(projectedEnd / span) + 1));
        const snappedAnchor = {
          x: endCandidate.point.x - direction.x * (segmentCount - 1) * span,
          z: endCandidate.point.z - direction.z * (segmentCount - 1) * span,
        };
        if (!startConnection || distance(snappedAnchor, anchor) <= WALL_CONNECT_SNAP_DISTANCE) {
          anchor = snappedAnchor;
          endConnection = endCandidate;
          proposedEnd = endCandidate.point;
        }
      }
    }
    if (!endConnection) {
      const endNearMapEdge = this._forwardWallEdgeDistance(end, direction) <= WALL_EDGE_SNAP_DISTANCE;
      if (endNearMapEdge || requestedSegments > maximumSegments) {
        edgeLocked = true;
        mapPadding = 0;
        maximumSegments = this._wallSegmentsToForwardEdge(anchor, direction);
        segmentCount = maximumSegments;
        proposedEnd = {
          x: anchor.x + direction.x * (segmentCount - 1) * span,
          z: anchor.z + direction.z * (segmentCount - 1) * span,
        };
      }
    }
    const orientation = Math.abs(direction.x) > 0.98 ? 'horizontal' : Math.abs(direction.z) > 0.98 ? 'vertical' : 'diagonal';
    const wallDirection = { ...direction };
    const segments = Array.from({ length: segmentCount }, (_, index) => ({
      x: anchor.x + wallDirection.x * index * span,
      z: anchor.z + wallDirection.z * index * span,
    }));
    const world = {
      x: (segments[0].x + segments[segments.length - 1].x) / 2,
      z: (segments[0].z + segments[segments.length - 1].z) / 2,
    };
    const options = {
      wallSegments: segmentCount,
      wallOrientation: orientation,
      wallDirection,
      wallSnapLabel: snapped.label,
      wallEdgeSnap: edgeLocked,
      wallStart: segments[0],
      clearResources: true,
      wallConnectionIds: [...new Set([startConnection?.buildingId, endConnection?.buildingId].filter(Boolean))],
      wallConnectCount: Number(Boolean(startConnection)) + Number(Boolean(endConnection)),
    };
    const check = this.getPlacementCheck('wall', world, options);
    const totalCost = Object.fromEntries(Object.entries(blueprint.cost).map(([key, value]) => [key, value * segmentCount]));
    if (check.valid && !this._canAfford(totalCost)) {
      const missing = Object.entries(totalCost).find(([key, value]) => this.resources[key] < value)?.[0] ?? 'resources';
      return { type: 'wall', world, segments, ...options, valid: false, reason: `Not enough ${missing} for this ${segmentCount}-segment wall.` };
    }
    const resourceClearCount = this._wallResourcesToClear({ type: 'wall', world, ...options }).length;
    return { type: 'wall', world, segments, ...options, valid: check.valid, reason: check.reason, totalCost, resourceClearCount };
  }

  getBuildingPlacementPreview(type, point) {
    const blueprint = BUILDING_TYPES[type];
    if (!blueprint?.wallAttachment) {
      const check = this.getPlacementCheck(type, point);
      return { type, world: point, valid: check.valid, reason: check.reason };
    }
    const snap = this._nearestWallAttachmentSegment(point, type);
    if (!snap) {
      return {
        type,
        world: point,
        valid: false,
        reason: blueprint.gate
          ? 'Place the gate over a Palisade segment to create an opening.'
          : 'Place the tower over a Palisade segment to reinforce it.',
      };
    }
    const options = {
      attachmentWallId: snap.wallId,
      attachmentSegmentIndex: snap.segmentIndex,
      attachmentDirection: snap.direction,
      gateWallId: snap.wallId,
      gateSegmentIndex: snap.segmentIndex,
      gateDirection: snap.direction,
      wallDirection: snap.direction,
      gateOrientation: 'pending',
      ignoreBuildingIds: snap.wallIds ?? [snap.wallId],
      attachmentWallIds: snap.wallIds ?? [snap.wallId],
      attachmentDirections: snap.directions ?? [snap.direction],
      attachmentClaims: snap.segmentClaims ?? [{ wallId: snap.wallId, segmentIndex: snap.segmentIndex }],
      attachmentConnectorSegments: type === 'palisadeTower' ? (snap.connectorSegments ?? []) : [],
      attachmentJunction: Boolean(snap.junction),
    };
    const check = this.getPlacementCheck(type, snap.point, options);
    return {
      type,
      world: snap.point,
      valid: check.valid,
      reason: check.reason,
      gateWallId: snap.wallId,
      gateSegmentIndex: snap.segmentIndex,
      gateDirection: snap.direction,
      gateOrientation: check.gateOrientation ?? options.gateOrientation,
      gateSnapDistance: snap.distance,
      gateWallIds: options.ignoreBuildingIds,
      attachmentWallId: snap.wallId,
      attachmentSegmentIndex: snap.segmentIndex,
      attachmentDirection: snap.direction,
      attachmentWallIds: options.ignoreBuildingIds,
      attachmentDirections: options.attachmentDirections,
      attachmentClaims: options.attachmentClaims,
      attachmentConnectorSegments: options.attachmentConnectorSegments,
      attachmentJunction: options.attachmentJunction,
      attachmentBranchCount: snap.branchCount,
      ...check,
    };
  }

  _replaceWallSegmentsForAttachment(attachmentPlacement) {
    const target = attachmentPlacement.world;
    const claimMap = new Map();
    for (const claim of attachmentPlacement.attachmentClaims ?? []) {
      const indices = claimMap.get(claim.wallId) ?? new Set();
      indices.add(claim.segmentIndex);
      claimMap.set(claim.wallId, indices);
    }
    const replaced = [];
    for (const wall of this.buildings.filter((building) => building.type === 'wall'
      && building.faction === 'player'
      && !building.destroyed)) {
      const segments = this._wallSegmentPoints(wall);
      const claimedIndices = claimMap.get(wall.id);
      const removedIndices = claimedIndices
        ? [...claimedIndices].filter((index) => index >= 0 && index < segments.length)
        : segments
          .map((segment, index) => ({ segment, index }))
          .filter(({ segment }) => distance(segment, target) <= WALL_ATTACHMENT_SEGMENT_MATCH_DISTANCE)
          .map(({ index }) => index);
      if (!removedIndices.length) continue;
      const removed = new Set(removedIndices);
      const remainingGroups = [];
      let group = [];
      segments.forEach((segment, index) => {
        if (removed.has(index)) {
          if (group.length) remainingGroups.push(group);
          group = [];
        } else {
          group.push({ segment, index });
        }
      });
      if (group.length) remainingGroups.push(group);
      const originalHp = wall.hp;
      const originalCount = segments.length;
      this._destroyBuilding(wall, null, { silent: true });
      remainingGroups.forEach((remaining) => {
        const start = remaining[0].segment;
        const end = remaining[remaining.length - 1].segment;
        const center = {
          x: (start.x + end.x) / 2,
          z: (start.z + end.z) / 2,
        };
        const replacement = this.addBuilding('wall', center.x, center.z, 'player', wall.progress, {
          wallSegments: remaining.length,
          wallOrientation: wall.wallOrientation,
          wallDirection: wall.wallDirection,
          wallStart: start,
        });
        replacement.hp = Math.max(1, originalHp * (remaining.length / originalCount));
      });
      replaced.push(removedIndices.length);
    }
    return replaced.reduce((sum, count) => sum + count, 0);
  }

  _replaceWallSegmentsForGate(gatePlacement) {
    return this._replaceWallSegmentsForAttachment(gatePlacement);
  }

  placeWallLine(start, end) {
    const preview = this.getWallLinePreview(start, end);
    if (!preview.valid) {
      this._announce(preview.reason);
      return false;
    }
    const blueprint = BUILDING_TYPES.wall;
    const builders = this._selectedBuilders(preview.world).slice(0, CONSTRUCTION_SLOT_COUNT);
    if (!builders.length) {
      this._announce('Select a builder before placing a Palisade Wall.');
      return false;
    }
    const cleared = this._clearResourcesForWall(preview);
    const clearedDetails = this._clearDecorationsForWall(preview);
    this._spend(preview.totalCost);
    const building = this.addBuilding('wall', preview.world.x, preview.world.z, 'player', 0.04, {
      wallSegments: preview.wallSegments,
      wallOrientation: preview.wallOrientation,
      wallDirection: preview.wallDirection,
      wallStart: preview.wallStart,
    });
    const relocated = this._relocateUnitsFromBuilding(building);
    let assigned = 0;
    builders.forEach((builder, index) => {
      this._interruptWork(builder);
      builder.postDepositTarget = null;
      builder.attackTarget = null;
      builder.attackTargetKind = null;
      builder.buildTarget = building.id;
      if (this._sendUnitToBuilding(builder, building, index)) assigned += 1;
      else builder.buildTarget = null;
    });
    const clearedCount = cleared + clearedDetails;
    const clearedMessage = clearedCount
      ? ` Cleared ${clearedCount} natural detail${clearedCount === 1 ? '' : 's'} in its path.`
      : '';
    const relocatedMessage = relocated
      ? ` Moved ${relocated} unit${relocated === 1 ? '' : 's'} clear of the new barrier.`
      : '';
    this._announce(`${blueprint.label} line placed: ${preview.wallSegments} segment${preview.wallSegments === 1 ? '' : 's'}. ${assigned} villager${assigned === 1 ? '' : 's'} assigned.${clearedMessage}${relocatedMessage}`);
    return true;
  }

  placeBuilding(type, point, suppliedPreview = null) {
    const blueprint = BUILDING_TYPES[type];
    if (!blueprint || !FIRST_AGE_BUILD_BLUEPRINTS.includes(type)) {
      this._announce('That blueprint is not available in the first-age sandbox.');
      return false;
    }
    // Input passes the exact visible preview through placement so a gate at a
    // shared socket cannot switch to another wall direction between hover and
    // click because of a sub-pixel tie.
    const preview = suppliedPreview?.type === type && suppliedPreview?.world
      ? suppliedPreview
      : this.getBuildingPlacementPreview(type, point);
    const buildPoint = preview.world;
    const builders = this._selectedBuilders(buildPoint).slice(0, this._buildingInteractionSlotCount({ type }));
    if (!builders.length) {
      this._announce(`Select a builder before placing a ${blueprint.label}.`);
      return false;
    }
    if (!preview.valid) {
      this._announce(preview.reason);
      return false;
    }
    this._spend(blueprint.cost);
    if (blueprint.wallAttachment) this._replaceWallSegmentsForAttachment(preview);
    const building = this.addBuilding(type, buildPoint.x, buildPoint.z, 'player', 0.04, {
      attachmentWallId: preview.attachmentWallId ?? preview.gateWallId,
      attachmentSegmentIndex: preview.attachmentSegmentIndex ?? preview.gateSegmentIndex,
      attachmentDirection: preview.attachmentDirection ?? preview.gateDirection,
      gateWallId: preview.gateWallId,
      gateSegmentIndex: preview.gateSegmentIndex,
      gateDirection: preview.gateDirection,
      wallDirection: preview.gateDirection,
      gateOrientation: preview.gateOrientation,
      attachmentWallIds: preview.attachmentWallIds ?? preview.gateWallIds,
      attachmentDirections: preview.attachmentDirections,
      attachmentConnectorSegments: preview.attachmentConnectorSegments,
      attachmentJunction: preview.attachmentJunction,
    });
    const relocated = this._relocateUnitsFromBuilding(building);
    let assigned = 0;
    builders.forEach((builder, index) => {
      this._interruptWork(builder);
      builder.postDepositTarget = null;
      builder.attackTarget = null;
      builder.attackTargetKind = null;
      builder.buildTarget = building.id;
      if (this._sendUnitToBuilding(builder, building, index)) assigned += 1;
      else builder.buildTarget = null;
    });
    const relocatedMessage = relocated
      ? ` ${relocated} unit${relocated === 1 ? '' : 's'} moved safely outside its footprint.`
      : '';
    this._announce(`${blueprint.label} foundation placed. ${assigned} villager${assigned === 1 ? '' : 's'} assigned.${relocatedMessage}`);
    return true;
  }

  queueUnit(type) {
    const blueprint = PRODUCTION_TYPES[type];
    const building = this.selectedEntities.find((entity) => entity.kind === 'building'
      && entity.faction === 'player'
      && entity.progress >= 1
      && !entity.destroyed
      && entity.type === blueprint?.building) ?? null;
    if (!blueprint || !building) {
      this._announce(`Select the ${blueprint ? BUILDING_TYPES[blueprint.building]?.label ?? 'proper production building' : 'proper production building'} before training a unit.`);
      return { success: false, kind: 'train' };
    }
    const queue = Array.isArray(building.productionQueue) ? building.productionQueue : (building.productionQueue = []);
    if (queue.length >= CONFIG.productionQueueLimit) {
      this._announce(`The ${BUILDING_TYPES[building.type].label} training queue is full.`);
      return { success: false, kind: 'train', building };
    }
    const population = this.population;
    if (population.used >= population.capacity) {
      this._announce('The settlement has reached its current population limit.');
      return { success: false, kind: 'train', building };
    }
    if (!this._canAfford(blueprint.cost)) {
      const missing = Object.entries(blueprint.cost).find(([key, value]) => this.resources[key] < value)?.[0] ?? 'resources';
      this._announce(`Not enough ${missing} to train a ${blueprint.label}.`);
      return { success: false, kind: 'train', building };
    }
    this._spend(blueprint.cost);
    queue.push({ type, elapsed: 0 });
    if (queue.length === 1) building.productionProgress = 0;
    this._announce(`${blueprint.label} added to the ${BUILDING_TYPES[building.type].label} queue.`);
    return { success: true, kind: 'train', building, type };
  }

  _selectedBuilder(point = null) {
    const builders = this._selectedBuilders(point);
    return builders[0] ?? null;
  }

  _selectedBuilders(point = null) {
    const builders = this.units.filter((unit) => unit.selected && this.isBuilderUnit(unit) && unit.carryAmount <= 0);
    if (!point) return builders;
    return builders.slice().sort((a, b) => distance(a, point) - distance(b, point));
  }

  _buildingBounds(type, point, padding = 0, options = {}) {
    const blueprint = BUILDING_TYPES[type];
    const footprint = this._buildingFootprint(type, options);
    const center = this._buildingCollisionCenter(type, point);
    const clearance = blueprint.collisionClearance ?? 0;
    return {
      minX: center.x - footprint.width / 2 - clearance - padding,
      maxX: center.x + footprint.width / 2 + clearance + padding,
      minZ: center.z - footprint.height / 2 - clearance - padding,
      maxZ: center.z + footprint.height / 2 + clearance + padding,
    };
  }

  _circleIntersectsBounds(point, radius, bounds) {
    const closestX = clamp(point.x, bounds.minX, bounds.maxX);
    const closestZ = clamp(point.z, bounds.minZ, bounds.maxZ);
    return Math.hypot(point.x - closestX, point.z - closestZ) < radius;
  }

  _boundsOverlap(first, second) {
    return first.minX < second.maxX && first.maxX > second.minX && first.minZ < second.maxZ && first.maxZ > second.minZ;
  }

  _placementAccessCells(type, point, options = {}) {
    const bounds = this._buildingBounds(type, point, 0, options);
    // Sample a full navigable cell beyond the physical base. With a large
    // authored footprint, a ring based only on cell centers can still have
    // every cell square overlap the structure and incorrectly report that a
    // wall hardpoint or large building has no construction access.
    const minX = Math.floor(bounds.minX - 1.5);
    const maxX = Math.ceil(bounds.maxX + 1.5);
    const minZ = Math.floor(bounds.minZ - 1.5);
    const maxZ = Math.ceil(bounds.maxZ + 1.5);
    const cells = [];
    for (let cellX = minX; cellX <= maxX; cellX += 1) {
      for (let cellZ = minZ; cellZ <= maxZ; cellZ += 1) {
        const cellCenter = { x: cellX + 0.5, z: cellZ + 0.5 };
        const insideFootprint = cellCenter.x > bounds.minX && cellCenter.x < bounds.maxX && cellCenter.z > bounds.minZ && cellCenter.z < bounds.maxZ;
        const nextToFootprint = !insideFootprint
          && cellCenter.x >= bounds.minX - 1.4
          && cellCenter.x <= bounds.maxX + 1.4
          && cellCenter.z >= bounds.minZ - 1.4
          && cellCenter.z <= bounds.maxZ + 1.4;
        if (nextToFootprint) cells.push({ x: cellX, z: cellZ });
      }
    }
    return cells;
  }

  getPlacementCheck(type, point, options = {}) {
    const blueprint = BUILDING_TYPES[type];
    if (!blueprint || !point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return { valid: false, reason: 'Move the foundation onto the meadow.' };
    if (blueprint.wallAttachment && !options.attachmentWallId && !options.gateWallId) {
      const snap = this._nearestWallAttachmentSegment(point, type);
      if (!snap) return {
        valid: false,
        reason: blueprint.gate
          ? 'Place the gate over a Palisade segment to create an opening.'
          : 'Place the tower over a Palisade segment to reinforce it.',
      };
      point = snap.point;
      options = {
        ...options,
        attachmentWallId: snap.wallId,
        attachmentSegmentIndex: snap.segmentIndex,
        attachmentDirection: snap.direction,
        gateWallId: snap.wallId,
        gateSegmentIndex: snap.segmentIndex,
        gateDirection: snap.direction,
        wallDirection: snap.direction,
        ignoreBuildingIds: snap.wallIds ?? [snap.wallId],
        attachmentWallIds: snap.wallIds ?? [snap.wallId],
        attachmentDirections: snap.directions ?? [snap.direction],
        attachmentClaims: snap.segmentClaims ?? [{ wallId: snap.wallId, segmentIndex: snap.segmentIndex }],
        attachmentConnectorSegments: type === 'palisadeTower' ? (snap.connectorSegments ?? []) : [],
        attachmentJunction: Boolean(snap.junction),
      };
    }
    // An edge-locked Palisade uses the wall's real collision envelope as its
    // boundary test. Generic construction keeps its extra placement buffer;
    // the edge path intentionally lets the finished wall sit close enough to
    // the meadow boundary to close the raider-sized gap.
    const placementPadding = blueprint.wall && options.wallEdgeSnap ? 0 : BUILDING_CLEARANCE;
    const boundaryMargin = blueprint.wall && options.wallEdgeSnap ? WALL_EDGE_BOUNDARY_MARGIN : 0.55;
    const bounds = this._buildingBounds(type, point, placementPadding, options);
    if (bounds.minX < boundaryMargin || bounds.minZ < boundaryMargin || bounds.maxX > CONFIG.mapWidth - boundaryMargin || bounds.maxZ > CONFIG.mapHeight - boundaryMargin) {
      return { valid: false, reason: 'Foundation is outside the meadow.' };
    }
    const placement = { type, x: point.x, z: point.z, progress: 1, ...options };
    const connectedWallIds = new Set(blueprint.wall ? (options.wallConnectionIds ?? []) : []);
    const gateWallIds = new Set(blueprint.wallAttachment
      ? (options.ignoreBuildingIds ?? [options.attachmentWallId ?? options.gateWallId]).filter(Boolean)
      : []);
    if (this.buildings.some((building) => {
      if (building.destroyed || !this._boundsOverlap(bounds, this._buildingEntityBounds(building, 0))) return false;
      // Palisade runs may cross or overlap deliberately. Existing wall art is
      // already the authoritative barrier, and rejecting these intersections
      // made parallel rows and divider walls unnecessarily pixel-perfect.
      if (blueprint.wall && building.type === 'wall') return false;
      // A gate is allowed to claim the one wall segment it is replacing. All
      // other structures, including another gate, remain hard blockers.
      if (blueprint.wallAttachment && building.type === 'wall' && gateWallIds.has(building.id)) return false;
      // Connected wall runs intentionally overlap their conservative collision
      // envelopes at the terminal post. Do not allow a reverse drag to lay a
      // second run over the existing segment centers, though; only the narrow
      // terminal-post envelope overlap is valid for a magnetic join.
      if (blueprint.wall && building.type === 'wall' && connectedWallIds.has(building.id)) {
        return this._wallSegmentsOverlap(placement, building);
      }
      return true;
    })) {
      return { valid: false, reason: 'Another structure is in the way.' };
    }
    if (blueprint.wall) {
      const builder = this._selectedBuilders(point)[0];
      if (!builder) return { valid: false, reason: 'Select a builder to build.' };
      if (builder.carryAmount > 0) return { valid: false, reason: 'Let the selected villager deposit cargo first.' };
      if (!this._canAfford(blueprint.cost)) {
        const missing = Object.entries(blueprint.cost).find(([key, value]) => this.resources[key] < value)?.[0] ?? 'resources';
        return { valid: false, reason: `Not enough ${missing} for a ${blueprint.label}.` };
      }
      // Palisades claim the ground they occupy. Do not apply the generic
      // access/resource/unit checks below: trees, rocks, small details, and
      // units yield to the wall, while structures remain the real blocker.
      return { valid: true, reason: 'Palisade line ready.' };
    }
    if (this.resourcesNodes.some((node) => !this._wallResourceWillBeCleared(node, placement)
      && this._circleIntersectsBounds(node, resourceFootprint(node), bounds))) {
      return { valid: false, reason: 'Clear the resource before building here.' };
    }
    if (this.decorations.some((decoration) => this._circleIntersectsBounds(decoration, DECORATION_FOOTPRINTS[decoration.type] ?? 0.45, bounds))) {
      return { valid: false, reason: 'Clear the ground detail before building here.' };
    }
    if (!blueprint.wallAttachment && this.units.some((unit) => !unit.dead && this._circleIntersectsBounds(unit, UNIT_TYPES[unit.type].radius + 0.18, bounds))) {
      return { valid: false, reason: 'A unit is standing in the foundation.' };
    }
    const accessCells = this._placementAccessCells(type, point, options);
    const openAccess = accessCells.filter((cell) => {
      const buildingBlocked = this.buildings.some((building) => !gateWallIds.has(building.id)
        && this._buildingBlocksCell(cell.x, cell.z, building));
      const resourceBlocked = this.resourcesNodes.some((node) => !this._wallResourceWillBeCleared(node, placement)
        && node.amount > 0 && this._cellIntersectsResource(cell.x, cell.z, node));
      return !buildingBlocked && !resourceBlocked && !this._buildingBlocksCell(cell.x, cell.z, placement);
    });
    if (openAccess.length < 2) return { valid: false, reason: 'Leave room around the foundation to build.' };
    const builder = this._selectedBuilders(point)[0];
    if (!builder) return { valid: false, reason: 'Select a builder to build.' };
    if (builder.carryAmount > 0) return { valid: false, reason: 'Let the selected villager deposit cargo first.' };
    const route = this._bestPathToPoints(builder, this._buildingApproachPoints(placement), placement);
    if (!route) return { valid: false, reason: 'The selected villager has no route to the site.' };
    if (!this._canAfford(blueprint.cost)) {
      const missing = Object.entries(blueprint.cost).find(([key, value]) => this.resources[key] < value)?.[0] ?? 'resources';
      return { valid: false, reason: `Not enough ${missing} for a ${blueprint.label}.` };
    }
    return {
      valid: true,
      reason: blueprint.gate ? 'Gate opening ready.' : blueprint.wallAttachment ? 'Palisade hardpoint ready.' : 'Foundation site ready.',
      gateOrientation: blueprint.gate ? this._gateOrientationFromDirection(options.gateDirection ?? options.wallDirection) : null,
    };
  }

  _canPlace(type, point) {
    return this.getPlacementCheck(type, point).valid;
  }

  _canAfford(cost) {
    return Object.entries(cost).every(([key, value]) => this.resources[key] >= value);
  }

  _spend(cost) {
    Object.entries(cost).forEach(([key, value]) => { this.resources[key] -= value; });
  }

  _syncSelectionFlags() {
    for (const unit of this.units) unit.selected = this.selectedIds.includes(unit.id);
    for (const building of this.buildings) building.selected = this.selectedIds.includes(building.id);
  }

  get selectedEntities() {
    return [...this.units, ...this.buildings, ...this.resourcesNodes].filter((entity) => this.selectedIds.includes(entity.id));
  }

  getEntityCount() {
    return this.units.length + this.buildings.length + this.resourcesNodes.length + this.decorations.length;
  }

  getPerformanceSnapshot() {
    return {
      entityCount: this.getEntityCount(),
      unitCount: this.units.length,
      buildingCount: this.buildings.length,
      resourceCount: this.resourcesNodes.length,
      pathRequests: this.pathRequestsLastStep,
      pathCacheHits: this.pathCacheHitsLastStep,
      repathRequests: this.repathRequestsLastStep,
      collisionPairs: this.collisionPairsLastStep,
      stressMode: this.stressMode,
    };
  }

  get population() {
    const housing = this.buildings.filter((building) => building.faction === 'player' && building.progress >= 1).reduce((sum, building) => sum + (BUILDING_TYPES[building.type].population ?? 0), 0);
    const queued = this.buildings.reduce((sum, building) => sum + (building.faction === 'player' ? (building.productionQueue?.length ?? 0) : 0), 0);
    const baseCapacity = this.stressMode ? CONFIG.sandboxPopulationCapacity : CONFIG.normalPopulationCapacity;
    return { used: this.units.filter((unit) => unit.faction === 'player' && !unit.dead).length + queued, capacity: baseCapacity + housing };
  }

  _announce(message) {
    this.lastCommand = message;
    this.onEvent(message);
  }
}
