import { BUILDING_TYPES, CONFIG, ENEMY_AI, FACTION, FIRST_AGE_BUILD_BLUEPRINTS, INITIAL_RESOURCES, PRODUCTION_TYPES, RESOURCE_SIZE_TIERS, RESOURCE_TYPES, SPACING_ROLES, UNIT_TYPES } from './config.js?v=20260823-orewashstages1';
import { findPath } from './pathfinding.js?v=20260822-pathfix1';
import { ANIMATION_EVENT_TIMINGS, ANIMATION_EVENTS, CrownforgeAnimationSystem } from './animation.js?v=20260823-orewashstages1';

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const moveToward = (value, target, amount) => value < target ? Math.min(value + amount, target) : Math.max(value - amount, target);
const TAU = Math.PI * 2;
const RESOURCE_SLOT_COUNT = 6;
const RESOURCE_READABLE_FRONT_BIAS = -0.05;
const CONSTRUCTION_SLOT_COUNT = 4;
const STORAGE_INTERACTION_DISTANCE = 0.78;
const BUILDING_INTERACTION_DISTANCE = 0.78;
const PATH_REACH_TOLERANCE = 0.38;
const BUILDING_CLEARANCE = 0.4;
const RESOURCE_FOOTPRINTS = { tree: 1.05, grove: 2.45, berry: 0.82, grain: 1.1, stone: 0.92, gold: 1.02 };
const WALL_CLEARABLE_RESOURCE_TYPES = new Set(['wood', 'stone']);
const WALL_CONNECT_SNAP_DISTANCE = 3.4;
const DECORATION_FOOTPRINTS = { log: 0.78, stump: 0.62, flowers: 0.42, pebbles: 0.44 };
const COMBAT_SLOT_COUNT = 8;
const COMBAT_SLOT_MARGIN = 0.12;
const DEAD_UNIT_LIFETIME = 2.4;
const BUILDING_COLLISION_RELEASE_TIME = 0.75;
const DESTROYED_BUILDING_LIFETIME = 2.4;
const FACING_HYSTERESIS = 0.12;
const UNIT_STUCK_TIMEOUT = 0.72;
const UNIT_REPATH_COOLDOWN = 0.42;
const UNIT_STATIC_CLEARANCE = 0.06;
const MAX_UNIT_TRAVEL_SUBSTEP = 0.16;
const SIMULATION_STEP = 1 / 60;
const MAX_SIMULATION_STEPS = 8;
const NATURAL_RESOURCE_SECTORS = { columns: 5, rows: 4 };
const NATURAL_RESOURCE_GAP = 1.7;

export function resourceFootprint(nodeOrType) {
  const type = typeof nodeOrType === 'string' ? nodeOrType : nodeOrType?.type;
  const tier = typeof nodeOrType === 'object' ? nodeOrType?.sizeTier ?? 'small' : 'small';
  return (RESOURCE_FOOTPRINTS[type] ?? 0.8) * (RESOURCE_SIZE_TIERS[tier]?.footprintScale ?? 1);
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
    this.reset();
  }

  reset() {
    this.clock = 0;
    this.timeAccumulator = 0;
    this.nextId = 1;
    this.phase = 'playing';
    this.resources = { ...INITIAL_RESOURCES };
    this.units = [];
    this.buildings = [];
    this.resourcesNodes = [];
    this.decorations = [];
    this.selectedIds = [];
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

  _seedWorld() {
    this.addBuilding('townCenter', 78, 82, 'player');
    // The first-age settlement begins with one coherent civic landmark. The
    // retired Hearth House and Waystore are intentionally absent; until new
    // support buildings are invented, every resource returns to the Hall.
    // Start the enemy on the far opposite side of the expanded diamond. The
    // long open approach creates time to gather and build without making the
    // Raiders blind or removing their ability to defend their camp.
    this.addBuilding('ashenCamp', 516, 414, 'enemy');
    // Keep a compact opening reserve around the Crown Hall while leaving its
    // build ring readable. The regional pass below supplies the rest of the
    // map instead of concentrating nearly every useful node here.
    this.addResource('tree', 'wood', 68, 96, 180, 0, { sizeTier: 'small' });
    this.addResource('tree', 'wood', 62, 102, 180, 1, { sizeTier: 'small' });
    this.addResource('tree', 'wood', 95, 105, 420, 3, { sizeTier: 'medium' });
    this.addResource('grove', 'wood', 67, 59, 1100, 1, { sizeTier: 'large' });
    // Keep a clear buildable meadow on the Hall's east flank. This food node
    // remains close enough to serve the settlement without occupying the
    // first ring where players expect to place structures.
    this.addResource('berry', 'food', 49, 40.5, 105, 1, { sizeTier: 'small' });
    this.addResource('berry', 'food', 82, 41, 105, 0, { sizeTier: 'small' });
    this.addResource('stone', 'stone', 72, 64, 360, 1, { sizeTier: 'medium' });
    this.addResource('stone', 'stone', 84, 61, 900, 0, { sizeTier: 'large' });
    // A modest opening vein teaches the fourth economy loop without crowding
    // the Crown Hall build ring. Richer deposits remain regional discoveries.
    this.addResource('gold', 'gold', 111, 72, 420, 0, { sizeTier: 'medium' });
    // Populate every macro-region with a deterministic mix of natural wood,
    // berry, stone, and rarer gold nodes. Cultivated Grain Fields are
    // deliberately not seeded; those remain a player-built settlement choice.
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
    this.addUnit('raider', 508, 403, 'enemy');
  }

  _naturalResourceAmount(type, sizeTier) {
    if (type === 'berry') return 105;
    if (type === 'stone') return sizeTier === 'large' ? 900 : sizeTier === 'medium' ? 360 : 120;
    if (type === 'gold') return sizeTier === 'large' ? 1150 : sizeTier === 'medium' ? 420 : 140;
    if (type === 'grove') return sizeTier === 'large' ? 1100 : sizeTier === 'medium' ? 700 : 480;
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
    return this.resourcesNodes.every((node) => distance(probe, node) >= footprint + resourceFootprint(node) + NATURAL_RESOURCE_GAP);
  }

  _seedNaturalResourceInSector(spec, sector, index, salt) {
    const sizeTier = spec.sizeTier ?? 'small';
    const footprint = resourceFootprint({ type: spec.type, sizeTier });
    const jitterX = (stableResourceNoise(index, salt) - 0.5) * sector.width * 0.14;
    const jitterZ = (stableResourceNoise(index, salt + 19) - 0.5) * sector.height * 0.14;
    const baseX = sector.minX + sector.width * spec.u + jitterX;
    const baseZ = sector.minZ + sector.height * spec.v + jitterZ;
    const nudge = Math.max(8, footprint + NATURAL_RESOURCE_GAP + 4);
    const offsets = [
      [0, 0], [nudge, 0], [-nudge, 0], [0, nudge], [0, -nudge],
      [nudge, nudge], [-nudge, nudge], [nudge, -nudge], [-nudge, -nudge],
    ];
    for (const [offsetX, offsetZ] of offsets) {
      const x = clamp(baseX + offsetX, sector.minX + footprint + 4, sector.maxX - footprint - 4);
      const z = clamp(baseZ + offsetZ, sector.minZ + footprint + 4, sector.maxZ - footprint - 4);
      if (!this._naturalResourceSpotClear(spec.type, sizeTier, x, z)) continue;
      const variant = Math.floor(stableResourceNoise(index, salt + 37) * 4) % 4;
      this.addResource(spec.type, spec.resourceType, x, z, this._naturalResourceAmount(spec.type, sizeTier), variant, { sizeTier });
      return true;
    }
    return false;
  }

  _seedNaturalResourceRegions() {
    const { columns, rows } = NATURAL_RESOURCE_SECTORS;
    const sectorWidth = CONFIG.mapWidth / columns;
    const sectorHeight = CONFIG.mapHeight / rows;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column;
        const sector = {
          minX: column * sectorWidth,
          maxX: (column + 1) * sectorWidth,
          minZ: row * sectorHeight,
          maxZ: (row + 1) * sectorHeight,
          width: sectorWidth,
          height: sectorHeight,
        };
        const woodTier = index % 5 === 0 ? 'large' : index % 2 === 0 ? 'medium' : 'small';
        const stoneTier = index % 6 === 0 ? 'large' : index % 2 === 1 ? 'medium' : 'small';
        this._seedNaturalResourceInSector({ type: 'tree', resourceType: 'wood', sizeTier: woodTier, u: 0.2, v: 0.27 }, sector, index, 3);
        this._seedNaturalResourceInSector({ type: 'berry', resourceType: 'food', sizeTier: 'small', u: 0.68, v: 0.66 }, sector, index, 7);
        this._seedNaturalResourceInSector({ type: 'stone', resourceType: 'stone', sizeTier: stoneTier, u: 0.43, v: 0.8 }, sector, index, 11);
        this._seedNaturalResourceInSector({ type: index % 4 === 0 ? 'grove' : 'tree', resourceType: 'wood', sizeTier: index % 4 === 0 ? 'medium' : 'small', u: 0.8, v: 0.24 }, sector, index, 17);
        if (index % 2 === 0) {
          this._seedNaturalResourceInSector({ type: 'berry', resourceType: 'food', sizeTier: 'small', u: 0.26, v: 0.64 }, sector, index, 23);
        }
        // Gold is intentionally scarcer than the three foundational
        // materials: one authored vein in alternating sectors, with only two
        // large regional landmarks across the full expanded map.
        if (index % 2 === 1) {
          const goldTier = index % 10 === 9 ? 'large' : index % 4 === 1 ? 'medium' : 'small';
          this._seedNaturalResourceInSector({ type: 'gold', resourceType: 'gold', sizeTier: goldTier, u: 0.57, v: 0.4 }, sector, index, 29);
        }
      }
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
      productionQueue: [],
      productionProgress: 0,
      field: Boolean(blueprint.field),
      wallSegments: blueprint.wall ? Math.max(1, Math.round(options.wallSegments ?? 1)) : 1,
      wallOrientation: blueprint.wall ? (options.wallOrientation ?? 'horizontal') : null,
      wallDirection: blueprint.wall ? wallDirectionFromOptions(options) : null,
      wallStart: blueprint.wall ? (options.wallStart ? { ...options.wallStart } : { x, z }) : null,
      farmerId: null,
      fieldTimer: 0,
    };
    this.buildings.push(building);
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
      returnSlot: 0,
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
      buildTarget: null,
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
      dead: false,
      pathBlocked: false,
      stuckTimer: 0,
      repathCooldown: 0,
      lastProgressX: x,
      lastProgressZ: z,
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
      reservedSlots: new Map(),
    });
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
    for (const building of this.buildings) {
      building.hitFlash = Math.max(0, building.hitFlash - dt);
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
    for (const building of this.buildings) {
      this._updateConstruction(building, dt);
      this._updateTraining(building, dt);
      this._updateField(building, dt);
    }
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
    for (let offset = 0; offset < RESOURCE_SLOT_COUNT; offset += 1) {
      const slot = (preferredSlot + offset) % RESOURCE_SLOT_COUNT;
      if (!node.reservedSlots.has(slot)) {
        node.reservedSlots.set(slot, unit.id);
        unit.resourceSlotNodeId = node.id;
        unit.gatherSlot = slot;
        return slot;
      }
    }
    // Six slots cover the current slice. If a future command exceeds that,
    // retain a deterministic fallback and let unit collision separation keep
    // the extra worker from occupying the exact same point.
    unit.resourceSlotNodeId = null;
    unit.gatherSlot = preferredSlot % RESOURCE_SLOT_COUNT;
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
    unit.attackTargetSnapshot = { id: target.id, kind: target.kind, x: target.x, z: target.z };
    this.animation.emit(unit, ANIMATION_EVENTS.attackStart, {
      targetId: target.id,
      targetKind: target.kind,
      x: target.x,
      z: target.z,
    });
  }

  _interruptWork(unit) {
    this._releaseResourceSlot(unit);
    this._releaseBuildingSlot(unit);
    this._releaseCombatSlot(unit);
    unit.gatherTarget = null;
    unit.buildTarget = null;
    if (unit.fieldTarget) {
      const field = this.buildings.find((building) => building.id === unit.fieldTarget);
      if (field?.farmerId === unit.id) field.farmerId = null;
    }
    unit.fieldTarget = null;
    unit.returnStorageId = null;
    unit.postDepositBuildTarget = null;
    unit.attackTarget = null;
    unit.attackTargetKind = null;
    unit.attackTimer = 0;
    unit.attackHitApplied = false;
    unit.stairAccess = false;
    unit.stairProgress = 0;
    this._cancelAttackCycle(unit);
  }

  _updateConstruction(building, dt) {
    if (building.progress >= 1) return;
    if (!Array.isArray(building.buildAssigned)) building.buildAssigned = building.buildAssigned ? [building.buildAssigned] : [];
    building.buildAssigned = building.buildAssigned.filter((unitId) => this.units.some((unit) => unit.id === unitId && !unit.dead && unit.buildTarget === building.id));
    if (!building.buildAssigned.length) return;
    const builders = building.buildAssigned
      .map((unitId) => this.units.find((unit) => unit.id === unitId && !unit.dead))
      .filter(Boolean);
    let activeBuilders = 0;
    for (const builder of builders) {
      if (this._distanceToBuildingEdge(builder, building) > BUILDING_INTERACTION_DISTANCE + 0.08) {
        builder.visualState = 'walk';
        if (builder.command !== 'build' || !builder.path.length) this._sendUnitToBuilding(builder, building, builder.buildSlot);
        continue;
      }
      activeBuilders += 1;
      builder.command = 'build';
      builder.path = [];
      builder.velocityX = 0;
      builder.velocityZ = 0;
      setUnitFacing(builder, building.x - builder.x, building.z - builder.z, true);
      builder.visualState = 'build';
      builder.actionLabel = `Building ${BUILDING_TYPES[building.type].label}`;
    }
    if (!activeBuilders) return;
    const blueprint = BUILDING_TYPES[building.type];
    const strikeInterval = Math.max(0.55, blueprint.buildTime / 10);
    building.constructionTimer = (building.constructionTimer ?? 0) + dt;
    while (building.constructionTimer >= strikeInterval && building.progress < 1) {
      building.constructionTimer -= strikeInterval;
      for (const builder of builders) {
        if (this._distanceToBuildingEdge(builder, building) <= BUILDING_INTERACTION_DISTANCE + 0.08) {
          this.animation.emit(builder, ANIMATION_EVENTS.constructionStrike, { buildingId: building.id, x: building.x, z: building.z });
        }
      }
      building.progress = clamp(building.progress + strikeInterval / blueprint.buildTime, 0, 1);
      building.hp = building.maxHp * Math.max(building.progress, 0.18);
    }
    if (building.progress >= 1) {
      for (const builder of builders) {
        this._releaseBuildingSlot(builder);
        builder.buildTarget = null;
        builder.command = 'idle';
        builder.visualState = 'idle';
        builder.actionLabel = 'Idle';
      }
      building.buildAssigned = [];
      this._announce(`${BUILDING_TYPES[building.type].label} complete.`);
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
    const unit = this.addUnit(order.type, spawn.x, spawn.z, 'player');
    unit.actionLabel = 'Idle';
    queue.shift();
    building.productionProgress = queue.length ? 0 : 0;
    this._announce(`${blueprint.label} ready at the ${BUILDING_TYPES[building.type]?.label ?? 'building'}.`);
  }

  _sendUnitToField(unit, field) {
    const route = this._bestPathToPoints(unit, this._buildingApproachPoints(field, 0.62));
    if (!route) {
      unit.path = [];
      unit.pathBlocked = true;
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
      ? this.units.find((unit) => unit.id === building.farmerId && !unit.dead && unit.faction === 'player')
      : null;
    if (!farmer) {
      const candidate = this.units.find((unit) => unit.type === 'villager' && unit.faction === 'player' && !unit.dead && !unit.carryAmount && unit.command === 'idle' && !unit.buildTarget && !unit.fieldTarget);
      if (!candidate) return;
      this._interruptWork(candidate);
      building.farmerId = candidate.id;
      farmer = candidate;
      this._sendUnitToField(farmer, building);
    }
    if (farmer.fieldTarget !== building.id || farmer.command !== 'field') return;
    if (this._distanceToBuildingEdge(farmer, building) > 0.7) {
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
      this.resources.food = Math.min(RESOURCE_TYPES.food.capacity, this.resources.food + 8);
      this.animation.emit(farmer, ANIMATION_EVENTS.resourceCollected, { resourceType: 'food', fieldId: building.id });
    }
  }

  _findUnitSpawnPoint(building, type, queueDepth = 0) {
    const role = SPACING_ROLES[type] ?? SPACING_ROLES.villager;
    const blueprint = BUILDING_TYPES[building.type];
    const radius = Math.max(blueprint.footprint.width, blueprint.footprint.height) / 2
      + (blueprint.collisionClearance ?? 0) + 1.1;
    const candidates = [];
    for (let index = 0; index < 12; index += 1) {
      const angle = -Math.PI / 2 + index * (TAU / 12);
      const wobble = (queueDepth % 3) * 0.32;
      candidates.push({
        x: clamp(building.x + Math.cos(angle) * (radius + wobble), 0.75, CONFIG.mapWidth - 0.75),
        z: clamp(building.z + Math.sin(angle) * (radius + wobble), 0.75, CONFIG.mapHeight - 0.75),
      });
    }
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
    if (unit.command === 'move') unit.visualState = 'walk';
    else if (unit.command === 'field') unit.visualState = unit.path.length ? 'walk' : 'food';
    else if (!['gather', 'return', 'attack', 'build'].includes(unit.command)) unit.visualState = 'idle';
    if (unit.command === 'move' || unit.command === 'gather' || unit.command === 'return' || unit.command === 'attack' || unit.command === 'build' || unit.command === 'field') {
      this._followPath(unit, dt);
    }
    if (unit.command === 'gather') this._updateGathering(unit, dt);
    else if (unit.command === 'return') this._updateReturning(unit);
    else if (unit.command === 'attack') this._updateAttack(unit, dt);
    else if (unit.command === 'build') this._updateBuildingIntent(unit);
    else if (unit.command === 'field') this._updateFieldIntent(unit);
    this._updateStairProgress(unit);
    unit.motionSpeed = Math.hypot(unit.velocityX, unit.velocityZ);
    unit.animationPlaybackRate = unit.command === 'move' || unit.visualState === 'walk'
      ? Math.max(0, Math.min(3.2, unit.motionSpeed / Math.max(UNIT_TYPES[unit.type].speed, 0.01)))
      : 1;
    this.animation.update(unit, dt);
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
      if (unit.repathCooldown <= 0) this._replanUnit(unit);
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
    if (unit.path.length && unit.stuckTimer >= UNIT_STUCK_TIMEOUT && unit.repathCooldown <= 0) {
      unit.stuckTimer = 0;
      this._replanUnit(unit);
    }
    if (unit.command === 'move' && !unit.path.length && Math.hypot(unit.velocityX, unit.velocityZ) < 0.08) {
      unit.command = 'idle';
      unit.visualState = 'idle';
      unit.routeTarget = null;
      unit.actionLabel = 'Idle';
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
      }
      return;
    }
    const resourceInfo = RESOURCE_TYPES[node.resourceType];
    const interactionDistance = resourceInteractionDistance(node, unit.type);
    if (unit.carryAmount > 0) {
      this._beginReturn(unit);
      return;
    }
    if (this.resources[node.resourceType] >= resourceInfo.capacity) {
      unit.gatherTimer = 0;
      unit.gatherEventFired = false;
      unit.command = 'idle';
      unit.visualState = 'idle';
      unit.actionLabel = `${resourceInfo.label} storage full`;
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
    unit.gatherTimer += dt;
    const toolContactTime = resourceInfo.gatherTime * ANIMATION_EVENT_TIMINGS.resource_collected;
    if (unit.gatherEventFired || unit.gatherTimer < toolContactTime) {
      if (unit.gatherTimer >= resourceInfo.gatherTime) {
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
    const availableSpace = resourceInfo.capacity - this.resources[node.resourceType];
    const gatherAmount = Math.round(resourceInfo.gatherAmount * this._resourceGatherMultiplier(node));
    const amount = Math.min(gatherAmount, node.amount, availableSpace);
    if (amount <= 0) {
      unit.gatherTimer = 0;
      unit.gatherEventFired = false;
      unit.command = 'idle';
      unit.visualState = 'idle';
      unit.actionLabel = `${resourceInfo.label} storage full`;
      return;
    }
    node.amount -= amount;
    unit.carryType = node.resourceType;
    unit.carryAmount = amount;
    unit.gatherTimer = 0;
    unit.gatherEventFired = false;
    unit.actionLabel = `Carrying ${resourceInfo.label}`;
    unit.visualState = `carry:${unit.carryType}`;
    if (node.amount <= 0 && !node.depleted) {
      node.depleted = true;
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
      unit.actionLabel = 'No drop-off available';
      unit.visualState = unit.carryType ? `carry:${unit.carryType}` : 'idle';
      unit.path = [];
      return;
    }
    const storageDistance = this._distanceToBuildingEdge(unit, storage);
    if (storageDistance > STORAGE_INTERACTION_DISTANCE + 0.08) {
      unit.actionLabel = this._returnActionLabel(unit, storage);
      unit.visualState = `carry:${unit.carryType}`;
      if (!unit.path.length) this._sendUnitToStorage(unit, storage);
      return;
    }
    unit.path = [];
    unit.velocityX = 0;
    unit.velocityZ = 0;
    setUnitFacing(unit, storage.x - unit.x, storage.z - unit.z, true);
    const resourceInfo = RESOURCE_TYPES[unit.carryType];
    const availableSpace = Math.max(0, resourceInfo.capacity - this.resources[unit.carryType]);
    const deposited = Math.min(unit.carryAmount, availableSpace);
    this.resources[unit.carryType] += deposited;
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
      unit.command = 'idle';
      unit.visualState = `carry:${unit.carryType}`;
      return;
    }
    unit.carryType = null;
    unit.returnStorageId = null;
    this._continueAfterDeposit(unit);
  }

  _continueAfterDeposit(unit) {
    const nextNode = this.resourcesNodes.find((node) => node.id === unit.gatherTarget && node.amount > 0);
    if (nextNode) {
      unit.command = 'gather';
      unit.actionLabel = `Walking to ${RESOURCE_TYPES[nextNode.resourceType].label}`;
      unit.visualState = 'walk';
      this._sendUnitToResource(unit, nextNode);
      return;
    }
    unit.gatherTarget = null;
    if (unit.postDepositBuildTarget) {
      const buildingId = unit.postDepositBuildTarget;
      unit.postDepositBuildTarget = null;
      const building = this.buildings.find((candidate) => candidate.id === buildingId
        && candidate.faction === 'player'
        && candidate.progress < 1
        && !candidate.destroyed);
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
  }

  _beginReturn(unit) {
    if (!unit.carryAmount || !unit.carryType) return false;
    this._releaseResourceSlot(unit);
    const route = this._findStorageRoute(unit);
    if (!route) {
      unit.command = 'idle';
      unit.path = [];
      unit.pathBlocked = true;
      unit.visualState = `carry:${unit.carryType}`;
      unit.actionLabel = 'Drop-off route blocked';
      return false;
    }
    unit.returnStorageId = route.storage.id;
    unit.returnSlot = route.slot;
    unit.path = route.path;
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
      && building.faction === 'player'
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

  _resourceGatherMultiplier(node) {
    let multiplier = 1;
    for (const building of this.buildings) {
      if (building.destroyed || building.progress < 1 || building.faction !== 'player') continue;
      const bonus = BUILDING_TYPES[building.type]?.gatherBonus;
      if (!bonus || bonus.resourceType !== node.resourceType) continue;
      if (distance(building, node) <= bonus.radius) multiplier = Math.max(multiplier, bonus.multiplier);
    }
    return multiplier;
  }

  _resourceInteractionPoint(node, slot, unitType = 'villager') {
    const info = RESOURCE_TYPES[node.resourceType];
    const angle = -Math.PI / 2 + (slot % RESOURCE_SLOT_COUNT) * (TAU / RESOURCE_SLOT_COUNT);
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
    if (!blueprint.wall) return { ...blueprint.footprint };
    const source = typeof buildingOrType === 'object' ? buildingOrType : options;
    const segments = Math.max(1, Math.round(source.wallSegments ?? options.wallSegments ?? 1));
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

  _buildingApproachPoints(building, margin = BUILDING_INTERACTION_DISTANCE) {
    const footprint = this._buildingFootprint(building);
    const visualClearance = BUILDING_TYPES[building.type].collisionClearance ?? 0;
    const halfWidth = footprint.width / 2 + visualClearance + margin;
    const halfHeight = footprint.height / 2 + visualClearance + margin;
    const sideVectors = {
      west: { x: -1, z: 0 },
      east: { x: 1, z: 0 },
      north: { x: 0, z: -1 },
      south: { x: 0, z: 1 },
    };
    const entrance = BUILDING_TYPES[building.type].entrance ?? 'south';
    const sideOrder = [entrance, 'south', 'east', 'west', 'north']
      .filter((side, index, list) => list.indexOf(side) === index);
    const points = sideOrder.map((side) => {
      const vector = sideVectors[side] ?? sideVectors.south;
      return {
        x: building.x + vector.x * (vector.x ? halfWidth : 0),
        z: building.z + vector.z * (vector.z ? halfHeight : 0),
      };
    });
    return points.map((point) => ({
      x: clamp(point.x, 0.55, CONFIG.mapWidth - 0.55),
      z: clamp(point.z, 0.55, CONFIG.mapHeight - 0.55),
    }));
  }

  _storageApproachPoints(storage) {
    return this._buildingApproachPoints(storage, STORAGE_INTERACTION_DISTANCE);
  }

  _distanceToBuildingEdge(point, building) {
    const footprint = this._buildingFootprint(building);
    const visualClearance = BUILDING_TYPES[building.type].collisionClearance ?? 0;
    const dx = Math.max(Math.abs(point.x - building.x) - footprint.width / 2 - visualClearance, 0);
    const dz = Math.max(Math.abs(point.z - building.z) - footprint.height / 2 - visualClearance, 0);
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
    const visualClearance = BUILDING_TYPES[building.type].collisionClearance ?? 0;
    return {
      minX: building.x - footprint.width / 2 - visualClearance - padding,
      maxX: building.x + footprint.width / 2 + visualClearance + padding,
      minZ: building.z - footprint.height / 2 - visualClearance - padding,
      maxZ: building.z + footprint.height / 2 + visualClearance + padding,
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
    this.selectedIds = this.selectedIds.filter((id) => !clearedIds.has(id));
    this._syncSelectionFlags();
    return cleared.length;
  }

  _pointBlockedForUnit(unit, point, placement = null) {
    const padding = (UNIT_TYPES[unit.type]?.radius ?? 0.4) + UNIT_STATIC_CLEARANCE;
    if (this.buildings.some((building) => {
      if (!this._buildingHasCollision(building)) return false;
      if (unit.stairAccess && this._pointOnCrownHallStairs(point, building, padding)) return false;
      return this._distanceToBuildingEdge(point, building) < padding;
    })) return true;
    if (placement && this._distanceToBuildingEdge(point, placement) < padding) return true;
    return this.resourcesNodes.some((node) => !this._wallResourceWillBeCleared(node, placement)
      && node.amount > 0 && this._resourceBlocksPoint(point, node, padding));
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
    if (this.buildings.some((building) => {
      if (!this._buildingHasCollision(building)) return false;
      if (unit.stairAccess && this._pointOnCrownHallStairs({ x: cellX + 0.5, z: cellZ + 0.5 }, building, padding + 0.25)) return false;
      if (this._buildingBlocksCell(cellX, cellZ, building)) return true;
      return this._cellIntersectsBuilding(cellX, cellZ, building, padding);
    })) return true;
    if (placement && (this._buildingBlocksCell(cellX, cellZ, placement) || this._cellIntersectsBuilding(cellX, cellZ, placement, padding))) return true;
    // Keep the resource's own footprint out of the grid. The precise unit
    // radius is enforced by _constrainUnitPosition so approach cells remain
    // usable for gathering slots around the perimeter.
    return this.resourcesNodes.some((node) => !this._wallResourceWillBeCleared(node, placement)
      && node.amount > 0 && this._cellIntersectsResource(cellX, cellZ, node));
  }

  _buildPath(unit, target, placement = null) {
    const safeTarget = {
      x: clamp(target.x, 0.55, CONFIG.mapWidth - 0.55),
      z: clamp(target.z, 0.55, CONFIG.mapHeight - 0.55),
    };
    const targetCell = { x: Math.floor(safeTarget.x), z: Math.floor(safeTarget.z) };
    const isBlocked = (x, z) => this._isPathCellBlocked(unit, x, z, placement, targetCell.x === x && targetCell.z === z ? safeTarget : null);
    const path = findPath(unit, safeTarget, isBlocked, CONFIG.mapWidth, CONFIG.mapHeight, {
      segmentClear: (start, end) => !this._pathSegmentBlocked(unit, start, end, placement),
    });
    const targetCellOpen = !isBlocked(targetCell.x, targetCell.z);
    if (!path.length && distance(unit, safeTarget) > PATH_REACH_TOLERANCE) {
      if (!targetCellOpen) return null;
      // An empty A* result means the destination is not connected to the
      // current cell. The only safe direct fallback is when both points are
      // already inside the same open cell; otherwise let the caller choose a
      // different storage or interaction slot.
      if (Math.floor(unit.x) === targetCell.x && Math.floor(unit.z) === targetCell.z) {
        return [{ x: safeTarget.x, z: safeTarget.z }];
      }
      return null;
    }
    // A* may end on a nearby walkable cell when a destination is blocked. Never
    // replace that safe endpoint with the original blocked destination.
    if (path.length && targetCellOpen && distance(path[path.length - 1], safeTarget) <= 1.3) {
      path[path.length - 1] = { x: safeTarget.x, z: safeTarget.z };
    }
    return path;
  }

  _resetMovementTracking(unit) {
    unit.stuckTimer = 0;
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
      const building = this.buildings.find((candidate) => candidate.id === unit.buildTarget && !candidate.destroyed && candidate.progress < 1);
      return building ? this._sendUnitToBuilding(unit, building) : false;
    }
    if (unit.command === 'move' && unit.routeTarget) {
      return this._sendUnitTo(unit, unit.routeTarget, 'move', unit.stopDistance ?? 0);
    }
    return false;
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
      const score = path.length * 1.1 + distance(unit, point) * 0.2;
      if (!best || score < best.score) best = { path, point, slot, score };
    });
    return best;
  }

  _reserveBuildingSlot(unit, building, preferredSlot = 0) {
    if (!building.buildSlotReservations) building.buildSlotReservations = new Map();
    if (!Array.isArray(building.buildAssigned)) building.buildAssigned = building.buildAssigned ? [building.buildAssigned] : [];
    this._releaseBuildingSlot(unit);
    const start = Number.isInteger(preferredSlot) && preferredSlot >= 0 ? preferredSlot % CONSTRUCTION_SLOT_COUNT : 0;
    for (let offset = 0; offset < CONSTRUCTION_SLOT_COUNT; offset += 1) {
      const slot = (start + offset) % CONSTRUCTION_SLOT_COUNT;
      if (building.buildSlotReservations.has(slot)) continue;
      building.buildSlotReservations.set(slot, unit.id);
      if (!building.buildAssigned.includes(unit.id)) building.buildAssigned.push(unit.id);
      unit.buildSlot = slot;
      return slot;
    }
    unit.buildSlot = -1;
    return -1;
  }

  _sendUnitToBuilding(unit, building, preferredSlot = null) {
    const points = this._buildingApproachPoints(building);
    const reserved = building.buildSlotReservations ?? new Map();
    const orderedSlots = Array.from({ length: CONSTRUCTION_SLOT_COUNT }, (_, offset) => {
      const start = Number.isInteger(preferredSlot) && preferredSlot >= 0 ? preferredSlot % CONSTRUCTION_SLOT_COUNT : 0;
      return (start + offset) % CONSTRUCTION_SLOT_COUNT;
    });
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
      unit.path = [];
      unit.pathBlocked = true;
      unit.command = 'idle';
      unit.visualState = 'idle';
      unit.actionLabel = 'Build route blocked';
      return false;
    }
    this._reserveBuildingSlot(unit, building, route.slot);
    unit.path = route.path;
    unit.routeTarget = route.point;
    unit.stopDistance = BUILDING_INTERACTION_DISTANCE;
    unit.pathBlocked = false;
    unit.command = 'build';
    unit.actionLabel = 'Walking to build site';
    this._resetMovementTracking(unit);
    return true;
  }

  _sendUnitToResource(unit, node) {
    if (!node || node.amount <= 0) return false;
    if (!node.reservedSlots) node.reservedSlots = new Map();
    const preferredSlot = Number.isInteger(unit.gatherSlot) ? unit.gatherSlot % RESOURCE_SLOT_COUNT : 0;
    const orderedSlots = Array.from({ length: RESOURCE_SLOT_COUNT }, (_, offset) => (preferredSlot + offset) % RESOURCE_SLOT_COUNT);
    const freeSlots = orderedSlots.filter((slot) => !node.reservedSlots.has(slot) || node.reservedSlots.get(slot) === unit.id);
    const candidateSlots = freeSlots.length ? freeSlots : orderedSlots;
    const routes = [];
    for (const slot of candidateSlots) {
      const point = this._resourceInteractionPoint(node, slot, unit.type);
      const path = this._buildPath(unit, point);
      if (!path) continue;
      // Prefer the screen-front half of a resource ring. The rear slots are
      // mechanically valid, but a worker placed there can disappear behind a
      // tree or berry canopy at the fixed camera zoom. Keeping the preference
      // in route selection preserves depth sorting while making the worker's
      // tool pose readable during the work loop.
      const frontBias = (point.x + point.z) - (node.x + node.z);
      const score = path.length * 1.1 + distance(unit, point) * 0.2 - frontBias * 1.35;
      routes.push({ path, point, slot, score, frontBias });
    }
    // A shorter rear route is still mechanically valid, but it can place a
    // worker beneath a tall authored canopy. Prefer any free screen-front
    // approach before comparing path length; only fall back to the full set
    // when the readable half of the ring is unreachable.
    const readableRoutes = routes.filter((candidate) => candidate.frontBias >= RESOURCE_READABLE_FRONT_BIAS);
    const routePool = readableRoutes.length ? readableRoutes : routes;
    const route = routePool.sort((a, b) => a.score - b.score || a.slot - b.slot)[0] ?? null;
    if (!route) {
      this._releaseResourceSlot(unit);
      unit.command = 'idle';
      unit.path = [];
      unit.pathBlocked = true;
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
        && building.faction === 'player'
        && building.progress >= 1
        && this._storageAccepts(building, resourceType))
      .sort((a, b) => distance(unit, a) - distance(unit, b));
    for (const storage of storages) {
      const route = this._bestPathToPoints(unit, this._storageApproachPoints(storage));
      if (route) return { storage, path: route.path, slot: route.slot, point: route.point };
    }
    return null;
  }

  _sendUnitToStorage(unit, storage) {
    if (!this._storageAccepts(storage, unit.carryType)) {
      const fallback = this._findStorageRoute(unit);
      if (!fallback) {
        unit.pathBlocked = true;
        unit.actionLabel = 'No compatible drop-off';
        return false;
      }
      storage = fallback.storage;
    }
    const points = this._storageApproachPoints(storage);
    const route = this._bestPathToPoints(unit, points);
    if (!route) {
      const fallback = this._findStorageRoute(unit);
      if (!fallback) {
        unit.pathBlocked = true;
        unit.actionLabel = 'Drop-off route blocked';
        return false;
      }
      unit.returnStorageId = fallback.storage.id;
      unit.returnSlot = fallback.slot;
      unit.path = fallback.path;
      unit.routeTarget = fallback.point;
      unit.stopDistance = STORAGE_INTERACTION_DISTANCE;
      unit.pathBlocked = false;
      this._resetMovementTracking(unit);
      return true;
    }
    unit.returnStorageId = storage.id;
    unit.returnSlot = route.slot;
    unit.path = route.path;
    unit.routeTarget = route.point;
    unit.stopDistance = STORAGE_INTERACTION_DISTANCE;
    unit.pathBlocked = false;
    this._resetMovementTracking(unit);
    return true;
  }

  _findNearestHostile(unit) {
    const unitTargets = this.units.filter((candidate) => !candidate.dead && candidate.faction !== unit.faction && candidate.faction !== 'neutral');
    const buildingTargets = this.buildings.filter((candidate) => {
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
    return target.kind === 'building' ? this._distanceToBuildingEdge(attacker, target) : distance(attacker, target);
  }

  _targetLabel(target) {
    return target.kind === 'building' ? BUILDING_TYPES[target.type].label : UNIT_TYPES[target.type].label;
  }

  _hasCombatLineOfSight(attacker, target) {
    const span = distance(attacker, target);
    const steps = Math.max(2, Math.ceil(span * 5));
    for (let index = 1; index < steps; index += 1) {
      const ratio = index / steps;
      const x = attacker.x + (target.x - attacker.x) * ratio;
      const z = attacker.z + (target.z - attacker.z) * ratio;
      if (target.kind === 'building' && this._cellIntersectsBuilding(Math.floor(x), Math.floor(z), target)) continue;
      if (this.isBlocked(Math.floor(x), Math.floor(z))) return false;
    }
    return true;
  }

  _combatApproachPoints(unit, target) {
    const targetRadius = target.kind === 'building'
      ? Math.max(this._buildingFootprint(target).width, this._buildingFootprint(target).height) / 2
        + (BUILDING_TYPES[target.type].collisionClearance ?? 0)
      : UNIT_TYPES[target.type].radius;
    const ringRadius = Math.max(UNIT_TYPES[unit.type].range - COMBAT_SLOT_MARGIN, UNIT_TYPES[unit.type].radius + targetRadius + 0.08);
    const points = [];
    for (let offset = 0; offset < COMBAT_SLOT_COUNT; offset += 1) {
      const slot = (unit.attackSlot + offset) % COMBAT_SLOT_COUNT;
      const angle = (slot / COMBAT_SLOT_COUNT) * TAU;
      const point = {
        x: clamp(target.x + Math.cos(angle) * ringRadius, 0.55, CONFIG.mapWidth - 0.55),
        z: clamp(target.z + Math.sin(angle) * ringRadius, 0.55, CONFIG.mapHeight - 0.55),
      };
      if (this._hasCombatLineOfSight(point, target)) points.push({ point, slot });
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

  _sendUnitToAttack(unit, target, slot = 0) {
    if (!target || target.hp <= 0 || target.dead || target.destroyed) return false;
    const enteringAttack = unit.command !== 'attack' || unit.attackTarget !== target.id || unit.attackTargetKind !== target.kind;
    unit.attackSlot = slot % COMBAT_SLOT_COUNT;
    const route = this._bestCombatRoute(unit, target);
    if (!route) {
      this._releaseCombatSlot(unit);
      unit.path = [];
      unit.pathBlocked = true;
      unit.command = 'idle';
      unit.visualState = 'idle';
      unit.actionLabel = 'No opening to attack';
      return false;
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
    setUnitFacing(unit, target.x - unit.x, target.z - unit.z, true);
    const blueprint = UNIT_TYPES[unit.type];
    const cooldown = blueprint.cooldown;
    const timing = blueprint.attackTiming ?? { anticipation: 0.25, contact: 0.45, recovery: 0.3 };
    const anticipationDuration = cooldown * timing.anticipation;
    const contactDuration = cooldown * timing.contact;
    const recoveryDuration = cooldown * timing.recovery;

    if (unit.attackPhase === 'approach' && !hasLine) {
      unit.actionLabel = inRange ? 'Seeking an opening' : `Closing on ${this._targetLabel(target)}`;
      unit.visualState = 'walk';
      // `path[path.length - 1]` is an A* cell center and can be several
      // tenths inside the target's collision envelope. Comparing that cell
      // directly to a large building made the first long raid replan every
      // simulation tick. Keep the authored combat approach point as the
      // stable route target; only ask A* again after the route is consumed or
      // the target has moved far enough to invalidate it.
      const routeTarget = unit.routeTarget;
      if (!unit.path.length || !routeTarget || this._targetDistance(routeTarget, target) > 1.4) {
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
      this._sendUnitToAttack(unit, target, unit.attackSlot);
      return;
    }
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
          payload.damage = blueprint.attack;
          this.animation.emit(unit, ANIMATION_EVENTS.attackHit, payload);
          target.hp -= blueprint.attack;
          target.hitFlash = 0.3;
          if (target.kind === 'unit') this.animation.emit(target, ANIMATION_EVENTS.damageTaken, { sourceId: unit.id, damage: blueprint.attack });
          if (target.kind === 'unit') target.healthRevealTimer = 1.6;
          if (target.kind === 'building') {
            target.defenseTargetId = unit.id;
            target.defendTimer = ENEMY_AI.defenseDuration;
            if (target.hp <= 0) this._destroyBuilding(target, unit);
          } else if (target.hp <= 0) {
            this._killUnit(target, unit);
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
    const building = this.buildings.find((candidate) => candidate.id === unit.buildTarget && candidate.progress < 1);
    if (!building) {
      this._releaseBuildingSlot(unit);
      unit.buildTarget = null;
      unit.command = 'idle';
      unit.visualState = 'idle';
      unit.actionLabel = 'Idle';
      return;
    }
    if (this._distanceToBuildingEdge(unit, building) > BUILDING_INTERACTION_DISTANCE + 0.08) {
      unit.actionLabel = 'Walking to build site';
      unit.visualState = 'walk';
      setUnitFacing(unit, building.x - unit.x, building.z - unit.z);
      if (!unit.path.length) this._sendUnitToBuilding(unit, building, unit.buildSlot);
    } else {
      unit.path = [];
      unit.velocityX = 0;
      unit.velocityZ = 0;
      setUnitFacing(unit, building.x - unit.x, building.z - unit.z, true);
      unit.visualState = 'build';
      unit.actionLabel = `Building ${BUILDING_TYPES[building.type].label}`;
    }
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
    if (this._distanceToBuildingEdge(unit, field) > 0.7) {
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
    if (activeRaiders >= ENEMY_AI.maxRaiders) return false;
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

  _updateEnemyAI(dt) {
    const camp = this._enemyCamp();
    if (!camp) return;
    camp.aiClock += dt;
    camp.defendTimer = Math.max(0, camp.defendTimer - dt);
    const underThreat = this.units.some((unit) => unit.faction === 'player' && !unit.dead && unit.attackTarget === camp.id && unit.attackTargetKind === 'building');
    if (camp.defendTimer <= 0 && !underThreat) camp.raidClock += dt;

    const raiders = this.units.filter((unit) => unit.type === 'raider' && unit.faction === 'enemy' && !unit.dead);
    const defenseTarget = camp.defenseTargetId
      ? this.units.find((unit) => unit.id === camp.defenseTargetId && unit.faction === 'player' && !unit.dead)
      : null;
    if (defenseTarget && camp.defendTimer > 0) {
      const defender = raiders.find((unit) => unit.command !== 'attack' || !this._getAttackTarget(unit));
      if (defender) this._sendUnitToAttack(defender, defenseTarget, defender.attackSlot);
    } else if (!defenseTarget) {
      camp.defenseTargetId = null;
    }

    if (camp.aiClock >= ENEMY_AI.reinforcementDelay && camp.defendTimer <= 0 && !underThreat) {
      if (this._spawnEnemyRaider(camp)) camp.aiClock = 0;
      else camp.aiClock = ENEMY_AI.reinforcementDelay * 0.75;
    }

    const playerCore = this.buildings.find((building) => building.type === 'townCenter' && building.faction === 'player' && !building.destroyed && building.hp > 0);
    const raidDelay = camp.raidCount > 0 ? ENEMY_AI.followUpRaidDelay : ENEMY_AI.firstRaidDelay;
    if (!playerCore || camp.defendTimer > 0 || camp.raidClock < raidDelay) return;
    const raider = raiders.find((unit) => unit.command !== 'attack' && !unit.dead);
    if (!raider) return;
    raider.attackTarget = playerCore.id;
    raider.attackTargetKind = 'building';
    raider.actionLabel = 'Raiding Crown Hall';
    if (this._sendUnitToAttack(raider, playerCore, 0)) {
      camp.raidClock = 0;
      camp.raidCount += 1;
      this._announce('Ashen Raiders are moving on the Crown Hall.');
    }
  }

  _updateEnemyIntent() {
    const enemies = this.units.filter((unit) => unit.faction === 'enemy' && !unit.dead);
    for (const enemy of enemies) {
      const currentTarget = enemy.command === 'attack' ? this._getAttackTarget(enemy) : null;
      if (currentTarget) continue;
      if (enemy.command === 'attack') {
        enemy.attackTarget = null;
        enemy.attackTargetKind = null;
        enemy.command = 'idle';
        enemy.path = [];
        enemy.visualState = 'idle';
        enemy.actionLabel = 'Guarding the Ashen Camp';
      }
      const targets = this.units.filter((unit) => unit.faction === 'player' && !unit.dead);
      const target = targets.slice().sort((a, b) => this._targetDistance(enemy, a) - this._targetDistance(enemy, b))[0];
      if (target && distance(enemy, target) < ENEMY_AI.awarenessRange) {
        enemy.attackTarget = target.id;
        enemy.attackTargetKind = 'unit';
        enemy.actionLabel = 'Raiding';
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

  _destroyBuilding(building, killer) {
    if (building.destroyed) return;
    this.selectedIds = this.selectedIds.filter((id) => id !== building.id);
    building.selected = false;
    const assignedIds = new Set([
      ...(Array.isArray(building.buildAssigned) ? building.buildAssigned : building.buildAssigned ? [building.buildAssigned] : []),
      ...this.units.filter((unit) => unit.buildTarget === building.id).map((unit) => unit.id),
    ]);
    building.destroyed = true;
    building.destroyAge = 0;
    building.hp = 0;
    building.progress = 1;
    for (const unit of this.units.filter((candidate) => assignedIds.has(candidate.id))) {
      this._releaseBuildingSlot(unit);
      unit.buildTarget = null;
      if (!unit.dead && unit.command === 'build') {
        unit.command = 'idle';
        unit.path = [];
        unit.visualState = 'idle';
        unit.actionLabel = 'Idle';
      }
    }
    building.buildAssigned = [];
    building.buildSlotReservations?.clear();
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
    this._announce(`${BUILDING_TYPES[building.type].label} destroyed.`);
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

  _nearestStorage(point, resourceType = point?.carryType ?? null) {
    const storage = this.buildings.filter((building) => !building.destroyed
      && building.faction === 'player'
      && building.progress >= 1
      && this._storageAccepts(building, resourceType));
    return storage.sort((a, b) => distance(point, a) - distance(point, b))[0] ?? null;
  }

  _cellIntersectsBuilding(cellX, cellZ, building, padding = 0) {
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

  isBlocked(cellX, cellZ) {
    if (cellX < 0 || cellZ < 0 || cellX >= CONFIG.mapWidth || cellZ >= CONFIG.mapHeight) return true;
    const buildingBlocked = this.buildings.some((building) => this._buildingBlocksCell(cellX, cellZ, building));
    if (buildingBlocked) return true;
    return this.resourcesNodes.some((node) => node.amount > 0 && this._cellIntersectsResource(cellX, cellZ, node));
  }

  _sendUnitTo(unit, target, command, stopDistance = 0) {
    if (!target) return;
    unit.stopDistance = stopDistance;
    const path = this._buildPath(unit, target);
    if (!path) {
      unit.path = [];
      unit.pathBlocked = true;
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
    for (const building of this.buildings) {
      if (!this._buildingHasCollision(building)) continue;
      if (unit.stairAccess && this._pointOnCrownHallStairs(unit, building, radius)) continue;
      const bounds = this._buildingEntityBounds(building, radius);
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
    for (const node of this.resourcesNodes) {
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
    for (let i = 0; i < live.length; i += 1) {
      for (let j = i + 1; j < live.length; j += 1) {
        const a = live[i]; const b = live[j];
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
        ? `${label} is hostile · right-click to attack.`
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

  issueContextCommand(point, forcedTarget = null) {
    const units = this.units.filter((unit) => this.selectedIds.includes(unit.id) && unit.faction === 'player' && !unit.dead);
    if (!units.length) {
      this.lastCommand = 'Select a villager or Crown Guard first.';
      this._announce(this.lastCommand);
      return { kind: 'none', success: false };
    }
    const target = forcedTarget ?? this.getEntityAt(point);
    if (target?.kind === 'resource') {
      const workers = units.filter((unit) => unit.type === 'villager');
      if (!workers.length) {
        this.lastCommand = 'Select a villager to gather resources.';
        this._announce('Select a villager to gather resources.');
        return { kind: 'none', success: false, target };
      }
      let routed = 0;
      workers.forEach((unit, index) => {
        this._interruptWork(unit);
        unit.gatherTarget = target.id;
        unit.gatherSlot = (index + unit.id) % RESOURCE_SLOT_COUNT;
        unit.gatherTimer = unit.carryAmount > 0 ? 0 : index * 0.18;
        unit.gatherEventFired = false;
        unit.postDepositTarget = null;
        if (unit.carryAmount > 0) routed += this._beginReturn(unit) ? 1 : 0;
        else routed += this._sendUnitToResource(unit, target) ? 1 : 0;
      });
      if (!routed) {
        this.lastCommand = `No route to ${RESOURCE_TYPES[target.resourceType].label.toLowerCase()}.`;
        this._announce(this.lastCommand);
        return { kind: 'none', success: false, target };
      }
      this.lastCommand = workers.some((unit) => unit.carryAmount > 0)
        ? `Return cargo, then gather ${RESOURCE_TYPES[target.resourceType].label.toLowerCase()}.`
        : `Gather ${RESOURCE_TYPES[target.resourceType].label.toLowerCase()}.`;
      return { kind: 'gather', success: true, target };
    }
    if (target?.kind === 'building' && target.faction === 'player' && target.progress < 1 && !target.destroyed) {
      const builders = units.filter((unit) => unit.type === 'villager').slice(0, CONSTRUCTION_SLOT_COUNT);
      if (!builders.length) {
        this.lastCommand = 'Select a villager to continue construction.';
        this._announce(this.lastCommand);
        return { kind: 'none', success: false, target };
      }
      let assigned = 0;
      builders.forEach((unit, index) => {
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
        this.lastCommand = `No route to the ${BUILDING_TYPES[target.type].label.toLowerCase()} foundation.`;
        this._announce(this.lastCommand);
        return { kind: 'none', success: false, target };
      }
      this.lastCommand = `Continue ${BUILDING_TYPES[target.type].label} construction with ${assigned} villager${assigned === 1 ? '' : 's'}.`;
      return { kind: 'build', success: true, target, assigned };
    }
    if (target?.kind === 'building' && target.faction === 'player' && target.type === 'townCenter' && target.progress >= 1 && !target.destroyed) {
      let routed = 0;
      units.forEach((unit, index) => {
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
      return { kind: 'move', success: true, target };
    }
    if (target?.kind === 'building' && target.faction === 'player' && target.progress >= 1 && BUILDING_TYPES[target.type].storage) {
      const workers = units.filter((unit) => unit.type === 'villager');
      if (!workers.length) {
        this.lastCommand = 'Select a villager to use a drop-off building.';
        this._announce(this.lastCommand);
        return { kind: 'none', success: false, target };
      }
      let routed = 0;
      workers.forEach((unit) => {
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
      return { kind: 'move', success: true, target };
    }
    if (target?.kind === 'building' && target.faction === 'player' && target.progress >= 1) {
      const approach = this._buildingApproachPoints(target);
      let routed = 0;
      units.forEach((unit, index) => {
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
      return { kind: 'move', success: true, target };
    }
    if (target?.kind === 'unit' && target.faction === 'enemy') {
      const attackers = units.filter((unit) => unit.type !== 'villager' || units.length === 1);
      if (!attackers.length) {
        this.lastCommand = 'Select a Crown Guard to attack.';
        this._announce(this.lastCommand);
        return { kind: 'none', success: false, target };
      }
      attackers.forEach((unit, index) => {
        this._interruptWork(unit);
        unit.postDepositTarget = null;
        unit.attackTarget = target.id;
        unit.attackSlot = index % COMBAT_SLOT_COUNT;
        if (unit.carryAmount > 0) {
          unit.postDepositTarget = { x: target.x, z: target.z };
          this._beginReturn(unit);
        } else {
          this._sendUnitToAttack(unit, target, index);
        }
      });
      this.lastCommand = `Engage ${UNIT_TYPES[target.type].label}.`;
      return { kind: 'attack', success: true, target };
    }
    if (target?.kind === 'building' && target.faction === 'enemy' && target.progress >= 1 && !target.destroyed) {
      const attackers = units.filter((unit) => unit.type !== 'villager' || units.length === 1);
      if (!attackers.length) {
        this.lastCommand = 'Select a Crown Guard to attack.';
        this._announce(this.lastCommand);
        return { kind: 'none', success: false, target };
      }
      attackers.forEach((unit, index) => {
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
      return { kind: 'attack', success: true, target };
    }
    // A single selected unit should land on the cursor location. The ring is
    // only for groups, where it prevents everyone from collapsing onto one
    // point while preserving a readable formation.
    const spacing = units.length === 1 ? 0 : Math.min(2.4, Math.max(1.35, 0.72 + units.length * 0.22));
    let routed = 0;
    units.forEach((unit, index) => {
      const angle = (index / Math.max(1, units.length)) * Math.PI * 2;
      const moveTarget = { x: point.x + Math.cos(angle) * spacing, z: point.z + Math.sin(angle) * spacing };
      this._interruptWork(unit);
      if (unit.carryAmount > 0) {
        unit.postDepositTarget = moveTarget;
        routed += this._beginReturn(unit) ? 1 : 0;
      } else {
        unit.postDepositTarget = null;
        routed += this._sendUnitTo(unit, moveTarget, 'move') ? 1 : 0;
      }
    });
    if (!routed) {
      this.lastCommand = 'No route to that location.';
      this._announce(this.lastCommand);
      return { kind: 'none', success: false, target: point };
    }
    this.lastCommand = `Move ${units.length} unit${units.length === 1 ? '' : 's'}.`;
    return { kind: 'move', success: true, target: point };
  }

  _wallEndpointRecords() {
    const blueprint = BUILDING_TYPES.wall;
    const span = blueprint.wallSegmentSpan ?? blueprint.footprint.width;
    return this.buildings
      .filter((building) => building.type === 'wall' && building.faction === 'player' && !building.destroyed)
      .flatMap((building) => {
        const count = Math.max(1, Math.round(building.wallSegments ?? 1));
        const direction = wallDirectionFromOptions(building);
        const start = building.wallStart ?? {
          x: building.x - direction.x * (count - 1) * span / 2,
          z: building.z - direction.z * (count - 1) * span / 2,
        };
        const end = {
          x: start.x + direction.x * (count - 1) * span,
          z: start.z + direction.z * (count - 1) * span,
        };
        return [
          { buildingId: building.id, side: 'start', point: start },
          { buildingId: building.id, side: 'end', point: end },
        ];
      });
  }

  _nearestWallConnection(point, direction) {
    const blueprint = BUILDING_TYPES.wall;
    const span = blueprint.wallSegmentSpan ?? blueprint.footprint.width;
    let nearest = null;
    for (const endpoint of this._wallEndpointRecords()) {
      // The new segment center sits one segment span away from the existing
      // terminal center. Testing both signs also allows clean T-junctions and
      // corners instead of forcing every new wall to extend straight ahead.
      for (const sign of [1, -1]) {
        const candidate = {
          x: endpoint.point.x + direction.x * span * sign,
          z: endpoint.point.z + direction.z * span * sign,
        };
        const distanceToCandidate = distance(point, candidate);
        if (distanceToCandidate > WALL_CONNECT_SNAP_DISTANCE) continue;
        if (!nearest || distanceToCandidate < nearest.distance - 0.001) {
          nearest = {
            buildingId: endpoint.buildingId,
            side: endpoint.side,
            point: candidate,
            distance: distanceToCandidate,
          };
        }
      }
    }
    return nearest;
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
    const startConnection = this._nearestWallConnection(start, direction);
    let anchor = startConnection?.point ?? {
      x: Math.round(start.x),
      z: Math.round(start.z),
    };
    const projectedDistance = (end.x - anchor.x) * direction.x + (end.z - anchor.z) * direction.z;
    const distanceAlongWall = Math.max(span, Math.abs(projectedDistance));
    let segmentCount = Math.max(1, Math.min(24, Math.round(distanceAlongWall / span) + 1));
    let endConnection = null;
    let proposedEnd = {
      x: anchor.x + direction.x * (segmentCount - 1) * span,
      z: anchor.z + direction.z * (segmentCount - 1) * span,
    };
    const endCandidate = this._nearestWallConnection(end, direction)
      ?? this._nearestWallConnection(proposedEnd, direction);
    if (endCandidate) {
      const projectedEnd = (endCandidate.point.x - anchor.x) * direction.x + (endCandidate.point.z - anchor.z) * direction.z;
      if (projectedEnd >= span * 0.75) {
        segmentCount = Math.max(1, Math.min(24, Math.round(projectedEnd / span) + 1));
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

  placeWallLine(start, end) {
    const preview = this.getWallLinePreview(start, end);
    if (!preview.valid) {
      this._announce(preview.reason);
      return false;
    }
    const blueprint = BUILDING_TYPES.wall;
    const builders = this._selectedBuilders(preview.world).slice(0, CONSTRUCTION_SLOT_COUNT);
    if (!builders.length) {
      this._announce('Select a villager before placing a Palisade Wall.');
      return false;
    }
    const cleared = this._clearResourcesForWall(preview);
    this._spend(preview.totalCost);
    const building = this.addBuilding('wall', preview.world.x, preview.world.z, 'player', 0.04, {
      wallSegments: preview.wallSegments,
      wallOrientation: preview.wallOrientation,
      wallDirection: preview.wallDirection,
      wallStart: preview.wallStart,
    });
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
    const clearedMessage = cleared ? ` Cleared ${cleared} tree/stone node${cleared === 1 ? '' : 's'} in its path.` : '';
    this._announce(`${blueprint.label} line placed: ${preview.wallSegments} segment${preview.wallSegments === 1 ? '' : 's'}. ${assigned} villager${assigned === 1 ? '' : 's'} assigned.${clearedMessage}`);
    return true;
  }

  placeBuilding(type, point) {
    const blueprint = BUILDING_TYPES[type];
    if (!blueprint || !FIRST_AGE_BUILD_BLUEPRINTS.includes(type)) {
      this._announce('That blueprint is not available in the first-age sandbox.');
      return false;
    }
    const builders = this._selectedBuilders(point).slice(0, CONSTRUCTION_SLOT_COUNT);
    if (!builders.length) {
      this._announce(`Select a villager before placing a ${blueprint.label}.`);
      return false;
    }
    const check = this.getPlacementCheck(type, point);
    if (!check.valid) {
      this._announce(check.reason);
      return false;
    }
    this._spend(blueprint.cost);
    const building = this.addBuilding(type, point.x, point.z, 'player', 0.04);
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
    this._announce(`${blueprint.label} foundation placed. ${assigned} villager${assigned === 1 ? '' : 's'} assigned.`);
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
    if (!CONFIG.sandboxMode && population.used >= population.capacity) {
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
    const builders = this.units.filter((unit) => unit.selected && unit.type === 'villager' && unit.faction === 'player' && !unit.dead && unit.carryAmount <= 0);
    if (!point) return builders;
    return builders.slice().sort((a, b) => distance(a, point) - distance(b, point));
  }

  _buildingBounds(type, point, padding = 0, options = {}) {
    const blueprint = BUILDING_TYPES[type];
    const footprint = this._buildingFootprint(type, options);
    const clearance = blueprint.collisionClearance ?? 0;
    return {
      minX: point.x - footprint.width / 2 - clearance - padding,
      maxX: point.x + footprint.width / 2 + clearance + padding,
      minZ: point.z - footprint.height / 2 - clearance - padding,
      maxZ: point.z + footprint.height / 2 + clearance + padding,
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
    const blueprint = BUILDING_TYPES[type];
    const footprint = this._buildingFootprint(type, options);
    const clearance = blueprint.collisionClearance ?? 0;
    const minX = Math.floor(point.x - footprint.width / 2 - clearance - 0.5);
    const maxX = Math.ceil(point.x + footprint.width / 2 + clearance + 0.5);
    const minZ = Math.floor(point.z - footprint.height / 2 - clearance - 0.5);
    const maxZ = Math.ceil(point.z + footprint.height / 2 + clearance + 0.5);
    const cells = [];
    const bounds = this._buildingBounds(type, point, 0, options);
    for (let cellX = minX; cellX <= maxX; cellX += 1) {
      for (let cellZ = minZ; cellZ <= maxZ; cellZ += 1) {
        const cellCenter = { x: cellX + 0.5, z: cellZ + 0.5 };
        const insideFootprint = cellCenter.x > bounds.minX && cellCenter.x < bounds.maxX && cellCenter.z > bounds.minZ && cellCenter.z < bounds.maxZ;
        const nextToFootprint = !insideFootprint
          && (Math.abs(cellCenter.x - point.x) <= footprint.width / 2 + clearance + 1.2)
          && (Math.abs(cellCenter.z - point.z) <= footprint.height / 2 + clearance + 1.2);
        if (nextToFootprint) cells.push({ x: cellX, z: cellZ });
      }
    }
    return cells;
  }

  getPlacementCheck(type, point, options = {}) {
    const blueprint = BUILDING_TYPES[type];
    if (!blueprint || !point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return { valid: false, reason: 'Move the foundation onto the meadow.' };
    const bounds = this._buildingBounds(type, point, BUILDING_CLEARANCE, options);
    if (bounds.minX < 0.55 || bounds.minZ < 0.55 || bounds.maxX > CONFIG.mapWidth - 0.55 || bounds.maxZ > CONFIG.mapHeight - 0.55) {
      return { valid: false, reason: 'Foundation is outside the meadow.' };
    }
    const placement = { type, x: point.x, z: point.z, progress: 1, ...options };
    const connectedWallIds = new Set(blueprint.wall ? (options.wallConnectionIds ?? []) : []);
    if (this.buildings.some((building) => {
      if (building.destroyed || !this._boundsOverlap(bounds, this._buildingEntityBounds(building, 0))) return false;
      // Connected wall runs intentionally overlap their conservative collision
      // envelopes at the terminal post. Other structures and unrelated wall
      // crossings remain invalid so the magnet never becomes a bypass.
      return !(blueprint.wall && building.type === 'wall' && connectedWallIds.has(building.id));
    })) {
      return { valid: false, reason: 'Another structure is in the way.' };
    }
    if (this.resourcesNodes.some((node) => !this._wallResourceWillBeCleared(node, placement)
      && this._circleIntersectsBounds(node, resourceFootprint(node), bounds))) {
      return { valid: false, reason: 'Clear the resource before building here.' };
    }
    if (this.decorations.some((decoration) => this._circleIntersectsBounds(decoration, DECORATION_FOOTPRINTS[decoration.type] ?? 0.45, bounds))) {
      return { valid: false, reason: 'Clear the ground detail before building here.' };
    }
    if (this.units.some((unit) => !unit.dead && this._circleIntersectsBounds(unit, UNIT_TYPES[unit.type].radius + 0.18, bounds))) {
      return { valid: false, reason: 'A unit is standing in the foundation.' };
    }
    const accessCells = this._placementAccessCells(type, point, options);
    const openAccess = accessCells.filter((cell) => {
      const buildingBlocked = this.buildings.some((building) => this._buildingBlocksCell(cell.x, cell.z, building));
      const resourceBlocked = this.resourcesNodes.some((node) => !this._wallResourceWillBeCleared(node, placement)
        && node.amount > 0 && this._cellIntersectsResource(cell.x, cell.z, node));
      return !buildingBlocked && !resourceBlocked && !this._buildingBlocksCell(cell.x, cell.z, placement);
    });
    if (openAccess.length < 2) return { valid: false, reason: 'Leave room around the foundation to build.' };
    const builder = this._selectedBuilders(point)[0];
    if (!builder) return { valid: false, reason: 'Select a villager to build.' };
    if (builder.carryAmount > 0) return { valid: false, reason: 'Let the selected villager deposit cargo first.' };
    const route = this._bestPathToPoints(builder, this._buildingApproachPoints(placement), placement);
    if (!route) return { valid: false, reason: 'The selected villager has no route to the site.' };
    if (!this._canAfford(blueprint.cost)) {
      const missing = Object.entries(blueprint.cost).find(([key, value]) => this.resources[key] < value)?.[0] ?? 'resources';
      return { valid: false, reason: `Not enough ${missing} for a ${blueprint.label}.` };
    }
    return { valid: true, reason: 'Foundation site ready.' };
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

  get population() {
    const housing = this.buildings.filter((building) => building.faction === 'player' && building.progress >= 1).reduce((sum, building) => sum + (BUILDING_TYPES[building.type].population ?? 0), 0);
    const queued = this.buildings.reduce((sum, building) => sum + (building.faction === 'player' ? (building.productionQueue?.length ?? 0) : 0), 0);
    return { used: this.units.filter((unit) => unit.faction === 'player' && !unit.dead).length + queued, capacity: CONFIG.sandboxMode ? CONFIG.sandboxPopulationCapacity : 4 + housing };
  }

  _announce(message) {
    this.lastCommand = message;
    this.onEvent(message);
  }
}
