import { COMBAT_ATLASES, VILLAGER_ATLASES } from './config.js?v=20260816-occlusion2';

export const ANIMATION_DIRECTIONS = [
  { index: 0, key: 'world-z-positive', label: '+Z · screen-left / front' },
  { index: 1, key: 'world-x-positive', label: '+X · screen-right / front' },
  { index: 2, key: 'world-x-negative', label: '-X · screen-left / back' },
  { index: 3, key: 'world-z-negative', label: '-Z · screen-right / back' },
];

export const ANIMATION_EVENTS = {
  footstep: 'footstep',
  attackStart: 'attack_start',
  toolContact: 'tool_contact',
  resourceCollected: 'resource_collected',
  attackHit: 'attack_hit',
  attackWhiff: 'attack_whiff',
  damageTaken: 'damage_taken',
  constructionStrike: 'construction_strike',
  depositComplete: 'deposit_complete',
  deathComplete: 'death_complete',
};

export const ANIMATION_EVENT_TIMINGS = {
  footstep: [0.18, 0.68],
  tool_contact: 0.6,
  resource_collected: 0.6,
  attack_hit: 0.64,
  construction_strike: 0.6,
};

const singleFrame = (atlas, row, options = {}) => ({
  atlas,
  rows: [row],
  frames: [0],
  fps: options.fps ?? 1,
  loop: options.loop ?? true,
  events: options.events ?? {},
  fallback: options.fallback,
});

const walkClip = (atlas, rows) => ({
  atlas,
  rows,
  frames: rows.map((_, index) => index),
  fps: 7.2,
  loop: true,
  events: { footstep: ANIMATION_EVENT_TIMINGS.footstep },
});

const directionalLoop = (atlas, { frames = [0, 1, 2, 3], fps = 3.2, loop = true, events = {} } = {}) => ({
  atlas,
  layout: 'frame-columns',
  directionRows: [0, 1, 2, 3],
  frames,
  fps,
  loop,
  events,
});

const actionLoop = (atlas, events = {}) => directionalLoop(atlas, { events });
const actionPhase = (atlas, frames, fps = 4.8, events = {}) => directionalLoop(atlas, { frames, fps, loop: false, events });

export const ANIMATION_DEFINITIONS = {
  villager: {
    label: 'Villager',
    directionCount: 4,
    atlasSize: { width: VILLAGER_ATLASES.width, height: VILLAGER_ATLASES.height, columns: VILLAGER_ATLASES.columns, rows: VILLAGER_ATLASES.rows },
    atlases: {
      motion: VILLAGER_ATLASES.motion,
      task: VILLAGER_ATLASES.task,
      carry: VILLAGER_ATLASES.carry,
      combat: VILLAGER_ATLASES.combat,
      woodLoop: VILLAGER_ATLASES.woodLoop,
      foodLoop: VILLAGER_ATLASES.foodLoop,
      stoneLoop: VILLAGER_ATLASES.stoneLoop,
      buildLoop: VILLAGER_ATLASES.buildLoop,
      carryWoodLoop: VILLAGER_ATLASES.carryWoodLoop,
      carryFoodLoop: VILLAGER_ATLASES.carryFoodLoop,
      carryStoneLoop: VILLAGER_ATLASES.carryStoneLoop,
      carrySuppliesLoop: VILLAGER_ATLASES.carrySuppliesLoop,
    },
    clips: {
      idle: singleFrame('motion', VILLAGER_ATLASES.motion.rows.idle),
      walk: walkClip('motion', VILLAGER_ATLASES.motion.rows.walk),
      gather_wood: actionLoop('woodLoop', { tool_contact: ANIMATION_EVENT_TIMINGS.tool_contact, resource_collected: ANIMATION_EVENT_TIMINGS.resource_collected }),
      gather_food: actionLoop('foodLoop', { tool_contact: ANIMATION_EVENT_TIMINGS.tool_contact, resource_collected: ANIMATION_EVENT_TIMINGS.resource_collected }),
      gather_stone: actionLoop('stoneLoop', { tool_contact: ANIMATION_EVENT_TIMINGS.tool_contact, resource_collected: ANIMATION_EVENT_TIMINGS.resource_collected }),
      construct: actionLoop('buildLoop', { construction_strike: ANIMATION_EVENT_TIMINGS.construction_strike }),
      carry_wood: actionLoop('carryWoodLoop'),
      carry_food: actionLoop('carryFoodLoop'),
      carry_stone: actionLoop('carryStoneLoop'),
      carry_supplies: actionLoop('carrySuppliesLoop'),
      attack: singleFrame('combat', VILLAGER_ATLASES.combat.rows.attack, { events: { attack_hit: ANIMATION_EVENT_TIMINGS.attack_hit } }),
      attack_anticipation: singleFrame('combat', VILLAGER_ATLASES.combat.rows.idle),
      attack_contact: singleFrame('combat', VILLAGER_ATLASES.combat.rows.attack, { events: { attack_hit: ANIMATION_EVENT_TIMINGS.attack_hit } }),
      attack_recovery: singleFrame('combat', VILLAGER_ATLASES.combat.rows.idle),
      hit: singleFrame('combat', VILLAGER_ATLASES.combat.rows.hit),
      death: singleFrame('combat', VILLAGER_ATLASES.combat.rows.death, { loop: false }),
    },
    collisionRadius: 0.36,
    interactionRadius: 0.78,
    renderSize: 108,
    groundAnchor: { x: 0.5, y: 0.98 },
    shadowAnchor: { x: 0.5, y: 0.98, source: 'painted-in-frame' },
  },
  soldier: {
    label: 'Crown Guard',
    directionCount: 4,
    atlasSize: COMBAT_ATLASES.soldier,
    atlases: { combat: COMBAT_ATLASES.soldier, soldierAttack: COMBAT_ATLASES.soldierAttack },
    clips: {
      idle: singleFrame('combat', COMBAT_ATLASES.soldier.rowByState.idle),
      walk: singleFrame('combat', COMBAT_ATLASES.soldier.rowByState.walk, { fps: 1.4 }),
      attack: actionLoop('soldierAttack', { attack_hit: ANIMATION_EVENT_TIMINGS.attack_hit }),
      attack_anticipation: actionPhase('soldierAttack', [0, 1]),
      attack_contact: actionPhase('soldierAttack', [2], 1, { attack_hit: ANIMATION_EVENT_TIMINGS.attack_hit }),
      attack_recovery: actionPhase('soldierAttack', [3, 0], 4.8),
      hit: singleFrame('combat', COMBAT_ATLASES.soldier.rowByState.idle, { fallback: 'idle' }),
      death: singleFrame('combat', COMBAT_ATLASES.soldier.rowByState.death, { loop: false }),
    },
    collisionRadius: 0.43,
    interactionRadius: 0.78,
    renderSize: 98,
    groundAnchor: { x: 0.5, y: 0.98 },
    shadowAnchor: { x: 0.5, y: 0.98, source: 'painted-in-frame' },
  },
  raider: {
    label: 'Ashen Raider',
    directionCount: 4,
    atlasSize: COMBAT_ATLASES.raider,
    atlases: { combat: COMBAT_ATLASES.raider, raiderWalk: COMBAT_ATLASES.raiderWalk, raiderAttack: COMBAT_ATLASES.raiderAttack },
    clips: {
      idle: singleFrame('combat', COMBAT_ATLASES.raider.rowByState.idle),
      walk: directionalLoop('raiderWalk', { fps: 6.8, events: { footstep: ANIMATION_EVENT_TIMINGS.footstep } }),
      attack: actionLoop('raiderAttack', { attack_hit: ANIMATION_EVENT_TIMINGS.attack_hit }),
      attack_anticipation: actionPhase('raiderAttack', [0, 1]),
      attack_contact: actionPhase('raiderAttack', [2], 1, { attack_hit: ANIMATION_EVENT_TIMINGS.attack_hit }),
      attack_recovery: actionPhase('raiderAttack', [3, 0], 4.8),
      hit: singleFrame('combat', COMBAT_ATLASES.raider.rowByState.idle, { fallback: 'idle' }),
      death: singleFrame('combat', COMBAT_ATLASES.raider.rowByState.death, { loop: false }),
    },
    collisionRadius: 0.44,
    interactionRadius: 0.78,
    renderSize: 98,
    groundAnchor: { x: 0.5, y: 0.98 },
    shadowAnchor: { x: 0.5, y: 0.98, source: 'painted-in-frame' },
  },
};

export function animationDefinition(type) {
  return ANIMATION_DEFINITIONS[type] ?? ANIMATION_DEFINITIONS.villager;
}

export function resolveAnimationState(unit) {
  const definition = animationDefinition(unit.type);
  if (unit.dead || unit.command === 'dead') return 'death';
  if (unit.hitFlash > 0 && definition.clips.hit) return 'hit';
  if (unit.command === 'attack' || unit.visualState === 'attack') {
    if (unit.attackPhase === 'anticipation') return 'attack_anticipation';
    if (unit.attackPhase === 'recovery') return 'attack_recovery';
    if (unit.attackPhase === 'contact') return 'attack_contact';
    return 'attack';
  }
  if (unit.command === 'move' || unit.visualState === 'walk') return 'walk';
  if (unit.visualState === 'wood') return 'gather_wood';
  if (unit.visualState === 'food') return 'gather_food';
  if (unit.visualState === 'stone') return 'gather_stone';
  if (unit.visualState === 'build') return 'construct';
  if (unit.visualState?.startsWith('carry:')) return `carry_${unit.visualState.slice(6)}`;
  return 'idle';
}

export function animationClip(type, state) {
  const definition = animationDefinition(type);
  const requested = definition.clips[state] ? state : 'idle';
  const clip = definition.clips[requested];
  if (clip.fallback && definition.clips[clip.fallback]) return definition.clips[clip.fallback];
  return clip;
}

export function animationFrame(type, state, time = 0, direction = 0) {
  const definition = animationDefinition(type);
  const requestedState = definition.clips[state] ? state : 'idle';
  const requestedClip = definition.clips[requestedState];
  const clip = animationClip(type, requestedState);
  const duration = Math.max(0.001, clip.frames.length / Math.max(0.001, clip.fps));
  const safeTime = Math.max(0, time);
  const frameIndex = clip.loop
    ? Math.floor((safeTime % duration) * clip.fps) % clip.frames.length
    : Math.min(clip.frames.length - 1, Math.floor(safeTime * clip.fps));
  const directionIndex = Math.max(0, Math.min(definition.directionCount - 1, direction ?? 0));
  const frameColumns = clip.layout === 'frame-columns';
  const sourceRow = frameColumns
    ? (clip.directionRows?.[directionIndex] ?? directionIndex)
    : (clip.rows[frameIndex] ?? clip.rows[0]);
  const sourceColumn = frameColumns
    ? (clip.frameColumns?.[frameIndex] ?? clip.frames[frameIndex] ?? frameIndex)
    : directionIndex;
  return {
    requestedState,
    atlasKey: clip.atlas,
    row: sourceRow,
    column: sourceColumn,
    frameIndex,
    frameCount: clip.frames.length,
    fps: clip.fps,
    loop: clip.loop,
    duration,
    events: requestedClip.events ?? {},
  };
}

export class CrownforgeAnimationSystem {
  update(unit, delta) {
    const nextState = resolveAnimationState(unit);
    if (unit.animationState !== nextState) {
      unit.animationState = nextState;
      unit.animationTime = 0;
      unit.animationPhase = 0;
      unit.animationFrame = 0;
      unit.animationLastStateTime = 0;
    }
    const clip = animationClip(unit.type, nextState);
    const previousTime = unit.animationTime ?? 0;
    const duration = Math.max(0.001, clip.frames.length / Math.max(0.001, clip.fps));
    const playbackRate = nextState === 'walk' ? Math.max(0, Math.min(1.15, unit.animationPlaybackRate ?? 1)) : 1;
    const nextTime = clip.loop ? (previousTime + delta * playbackRate) % duration : Math.min(duration, previousTime + delta * playbackRate);
    if (nextState === 'walk' && clip.events?.footstep) {
      const thresholds = Array.isArray(clip.events.footstep) ? clip.events.footstep : [clip.events.footstep];
      for (const threshold of thresholds) {
        const eventTime = duration * threshold;
        const crossed = clip.loop && nextTime < previousTime ? (previousTime < eventTime || nextTime >= eventTime) : previousTime < eventTime && nextTime >= eventTime;
        if (crossed) this.emit(unit, ANIMATION_EVENTS.footstep, { frame: unit.animationFrame });
      }
    }
    unit.animationTime = nextTime;
    unit.animationPhase = Math.min(1, nextTime / duration);
    unit.animationFrame = animationFrame(unit.type, nextState, nextTime, unit.facing).frameIndex;
  }

  emit(unit, name, payload = {}) {
    const event = { name, clock: unit.animClock ?? 0, payload };
    unit.animationEvents ??= [];
    unit.animationEvents.push(event);
    if (unit.animationEvents.length > 8) unit.animationEvents.shift();
    unit.lastAnimationEvent = event;
  }
}
