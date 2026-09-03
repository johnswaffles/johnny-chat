import { COMBAT_ATLASES, VILLAGER_ATLASES } from './config.js?v=20260902-coreunits1';

export const ANIMATION_DIRECTIONS = [
  { index: 0, key: 'screen-down', label: 'screen-down / front' },
  { index: 1, key: 'screen-right', label: 'screen-right / profile' },
  { index: 2, key: 'screen-up', label: 'screen-up / back' },
  { index: 3, key: 'screen-left', label: 'screen-left / profile' },
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
  stunApplied: 'stun_applied',
  stunEnded: 'stun_ended',
  wardTriggered: 'ward_triggered',
  wardBlocked: 'ward_blocked',
  wardBlast: 'ward_blast',
  curseApplied: 'curse_applied',
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

const directionalLoop = (atlas, { frames = [0, 1, 2, 3], fps = 3.2, loop = true, events = {}, directionRows = [0, 1, 2, 3] } = {}) => ({
  atlas,
  layout: 'frame-columns',
  directionRows,
  frames,
  fps,
  loop,
  events,
});

const actionLoop = (atlas, events = {}) => directionalLoop(atlas, { events });
const actionPhase = (atlas, frames, fps = 4.8, events = {}) => directionalLoop(atlas, { frames, fps, loop: false, events });
const directionalPose = (atlas, column) => directionalLoop(atlas, { frames: [column], fps: 1 });
const rosterWalk = (atlas, fps = 3.2) => directionalLoop(atlas, {
  frames: [0, 1, 2],
  fps,
  events: { footstep: ANIMATION_EVENT_TIMINGS.footstep },
});
const rosterAttack = (atlas) => directionalLoop(atlas, {
  frames: [0, 1, 2],
  fps: 4.8,
  events: { attack_hit: ANIMATION_EVENT_TIMINGS.attack_hit },
});
const rosterAttackPhase = (atlas, frame, events = {}) => directionalLoop(atlas, {
  frames: [frame],
  fps: 1,
  loop: false,
  events,
});
const rosterDeath = (atlas) => directionalLoop(atlas, {
  frames: [0, 1, 2, 3],
  fps: 4.2,
  loop: false,
});

const ashenFighterDefinition = ({ label, motion, walk, attack, death, renderSize, radius, interactionRadius = 0.8 }) => ({
  label,
  directionCount: 4,
  atlasSize: COMBAT_ATLASES[motion],
  atlases: {
    combat: COMBAT_ATLASES[motion],
    [motion]: COMBAT_ATLASES[motion],
    [walk]: COMBAT_ATLASES[walk],
    [attack]: COMBAT_ATLASES[attack],
    [death]: COMBAT_ATLASES[death],
  },
  clips: {
    idle: directionalPose(motion, 0),
    walk: rosterWalk(walk),
    attack: rosterAttack(attack),
    attack_anticipation: rosterAttackPhase(attack, 0),
    attack_contact: rosterAttackPhase(attack, 1, { attack_hit: ANIMATION_EVENT_TIMINGS.attack_hit }),
    attack_recovery: rosterAttackPhase(attack, 2),
    hit: directionalPose(motion, 3),
    death: rosterDeath(death),
  },
  collisionRadius: radius,
  interactionRadius,
  renderSize,
  groundAnchor: { x: 0.5, y: 0.98 },
  shadowAnchor: { x: 0.5, y: 0.98, source: 'painted-in-frame' },
});

export const ANIMATION_DEFINITIONS = {
  villager: {
    label: 'Hearthkin',
    directionCount: 4,
    atlasSize: { width: VILLAGER_ATLASES.width, height: VILLAGER_ATLASES.height, columns: VILLAGER_ATLASES.columns, rows: VILLAGER_ATLASES.rows },
    atlases: {
      motion: VILLAGER_ATLASES.motion,
      motionLoop: VILLAGER_ATLASES.motionLoop,
      task: VILLAGER_ATLASES.task,
      carry: VILLAGER_ATLASES.carry,
      combat: VILLAGER_ATLASES.combat,
      defenseAttackLoop: VILLAGER_ATLASES.defenseAttackLoop,
      woodLoop: VILLAGER_ATLASES.woodLoop,
      foodLoop: VILLAGER_ATLASES.foodLoop,
      fieldLoop: VILLAGER_ATLASES.fieldLoop,
      stoneLoop: VILLAGER_ATLASES.stoneLoop,
      buildLoop: VILLAGER_ATLASES.buildLoop,
      carryWoodLoop: VILLAGER_ATLASES.carryWoodLoop,
      carryFoodLoop: VILLAGER_ATLASES.carryFoodLoop,
      carryStoneLoop: VILLAGER_ATLASES.carryStoneLoop,
      carryGoldLoop: VILLAGER_ATLASES.carryGoldLoop,
      carrySuppliesLoop: VILLAGER_ATLASES.carrySuppliesLoop,
      hitLoop: VILLAGER_ATLASES.hitLoop,
      deathLoop: VILLAGER_ATLASES.deathLoop,
    },
    clips: {
      idle: singleFrame('motion', VILLAGER_ATLASES.motion.rows.idle),
      // All roster movement sheets share the same front, right, back, left
      // direction contract and a deliberate contact, passing, contact cycle.
      walk: rosterWalk('motionLoop'),
      gather_wood: actionLoop('woodLoop', { tool_contact: ANIMATION_EVENT_TIMINGS.tool_contact, resource_collected: ANIMATION_EVENT_TIMINGS.resource_collected }),
      gather_food: actionLoop('foodLoop', { tool_contact: ANIMATION_EVENT_TIMINGS.tool_contact, resource_collected: ANIMATION_EVENT_TIMINGS.resource_collected }),
      field_work: actionLoop('fieldLoop', { tool_contact: ANIMATION_EVENT_TIMINGS.tool_contact, resource_collected: ANIMATION_EVENT_TIMINGS.resource_collected }),
      gather_stone: actionLoop('stoneLoop', { tool_contact: ANIMATION_EVENT_TIMINGS.tool_contact, resource_collected: ANIMATION_EVENT_TIMINGS.resource_collected }),
      // Gold-bearing quartz is worked with the same pick motion as stone; the
      // distinct ore deposit, cargo atlas, feedback color, and HUD state make
      // the material legible without inventing an implausible tool action.
      gather_gold: actionLoop('stoneLoop', { tool_contact: ANIMATION_EVENT_TIMINGS.tool_contact, resource_collected: ANIMATION_EVENT_TIMINGS.resource_collected }),
      construct: actionLoop('buildLoop', { construction_strike: ANIMATION_EVENT_TIMINGS.construction_strike }),
      carry_wood: actionLoop('carryWoodLoop'),
      carry_food: actionLoop('carryFoodLoop'),
      carry_stone: actionLoop('carryStoneLoop'),
      carry_gold: actionLoop('carryGoldLoop'),
      carry_supplies: actionLoop('carrySuppliesLoop'),
      attack: rosterAttack('defenseAttackLoop'),
      attack_anticipation: rosterAttackPhase('defenseAttackLoop', 0),
      attack_contact: rosterAttackPhase('defenseAttackLoop', 1, { attack_hit: ANIMATION_EVENT_TIMINGS.attack_hit }),
      attack_recovery: rosterAttackPhase('defenseAttackLoop', 2),
      hit: actionPhase('hitLoop', [0, 1, 2, 3], 14),
      death: rosterDeath('deathLoop'),
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
    atlasSize: COMBAT_ATLASES.soldierWalk,
    atlases: { soldierWalk: COMBAT_ATLASES.soldierWalk, soldierAttack: COMBAT_ATLASES.soldierAttack, soldierHit: COMBAT_ATLASES.soldierHit, soldierDeath: COMBAT_ATLASES.soldierDeath },
    clips: {
      idle: directionalPose('soldierWalk', 1),
      walk: rosterWalk('soldierWalk'),
      attack: rosterAttack('soldierAttack'),
      attack_anticipation: rosterAttackPhase('soldierAttack', 0),
      attack_contact: rosterAttackPhase('soldierAttack', 1, { attack_hit: ANIMATION_EVENT_TIMINGS.attack_hit }),
      attack_recovery: rosterAttackPhase('soldierAttack', 2),
      hit: actionPhase('soldierHit', [0, 1, 2, 3], 14),
      death: rosterDeath('soldierDeath'),
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
    atlasSize: COMBAT_ATLASES.raiderWalk,
    atlases: { raiderWalk: COMBAT_ATLASES.raiderWalk, raiderAttack: COMBAT_ATLASES.raiderAttack, raiderHit: COMBAT_ATLASES.raiderHit, raiderDeath: COMBAT_ATLASES.raiderDeath },
    clips: {
      idle: directionalPose('raiderWalk', 1),
      walk: rosterWalk('raiderWalk'),
      attack: rosterAttack('raiderAttack'),
      attack_anticipation: rosterAttackPhase('raiderAttack', 0),
      attack_contact: rosterAttackPhase('raiderAttack', 1, { attack_hit: ANIMATION_EVENT_TIMINGS.attack_hit }),
      attack_recovery: rosterAttackPhase('raiderAttack', 2),
      hit: actionPhase('raiderHit', [0, 1, 2, 3], 14),
      stunned: directionalLoop('raiderHit', { frames: [1, 2, 1, 0], fps: 4.2 }),
      death: rosterDeath('raiderDeath'),
    },
    collisionRadius: 0.44,
    interactionRadius: 0.78,
    renderSize: 98,
    groundAnchor: { x: 0.5, y: 0.98 },
    shadowAnchor: { x: 0.5, y: 0.98, source: 'painted-in-frame' },
  },
  ashenForager: {
    label: 'Ashen Hearthkin',
    directionCount: 4,
    atlasSize: COMBAT_ATLASES.ashenForagerMotion,
    atlases: {
      combat: COMBAT_ATLASES.ashenForagerMotion,
      ashenForagerMotion: COMBAT_ATLASES.ashenForagerMotion,
      ashenForagerWalk: COMBAT_ATLASES.ashenForagerWalk,
      ashenForagerAttack: COMBAT_ATLASES.ashenForagerAttack,
      ashenForagerDeath: COMBAT_ATLASES.ashenForagerDeath,
      ashenForagerWork: COMBAT_ATLASES.ashenForagerWork,
      ashenForagerCarry: COMBAT_ATLASES.ashenForagerCarry,
    },
    clips: {
      idle: directionalPose('ashenForagerMotion', 0),
      walk: rosterWalk('ashenForagerWalk'),
      gather_wood: directionalPose('ashenForagerWork', 0),
      gather_food: directionalPose('ashenForagerWork', 1),
      field_work: directionalPose('ashenForagerWork', 1),
      gather_stone: directionalPose('ashenForagerWork', 2),
      gather_gold: directionalPose('ashenForagerWork', 2),
      construct: directionalPose('ashenForagerWork', 3),
      carry_wood: directionalPose('ashenForagerCarry', 0),
      carry_food: directionalPose('ashenForagerCarry', 1),
      carry_stone: directionalPose('ashenForagerCarry', 2),
      carry_gold: directionalPose('ashenForagerCarry', 3),
      attack: rosterAttack('ashenForagerAttack'),
      attack_anticipation: rosterAttackPhase('ashenForagerAttack', 0),
      attack_contact: rosterAttackPhase('ashenForagerAttack', 1, { attack_hit: ANIMATION_EVENT_TIMINGS.attack_hit }),
      attack_recovery: rosterAttackPhase('ashenForagerAttack', 2),
      hit: directionalPose('ashenForagerMotion', 3),
      death: rosterDeath('ashenForagerDeath'),
    },
    collisionRadius: 0.36,
    interactionRadius: 0.78,
    renderSize: 104,
    groundAnchor: { x: 0.5, y: 0.98 },
    shadowAnchor: { x: 0.5, y: 0.98, source: 'painted-in-frame' },
  },
  ashenOutrider: ashenFighterDefinition({
    label: 'Ashen Outrider',
    motion: 'ashenOutriderMotion',
    walk: 'ashenOutriderWalk',
    attack: 'ashenOutriderAttack',
    death: 'ashenOutriderDeath',
    renderSize: 184,
    radius: 0.7,
    interactionRadius: 1.06,
  }),
  thornSpear: ashenFighterDefinition({
    label: 'Thorn Spear',
    motion: 'thornSpearMotion',
    walk: 'thornSpearWalk',
    attack: 'thornSpearAttack',
    death: 'thornSpearDeath',
    renderSize: 112,
    radius: 0.44,
  }),
  hearthLevy: ashenFighterDefinition({
    label: 'Hearth Levy',
    motion: 'hearthLevyMotion',
    walk: 'hearthLevyWalk',
    attack: 'hearthLevyAttack',
    death: 'hearthLevyDeath',
    renderSize: 108,
    radius: 0.42,
  }),
  hidewall: ashenFighterDefinition({
    label: 'Ashen Hidewall',
    motion: 'hidewallMotion',
    walk: 'hidewallWalk',
    attack: 'hidewallAttack',
    death: 'hidewallDeath',
    renderSize: 112,
    radius: 0.44,
  }),
  scout: {
    label: 'Crown Scout',
    directionCount: 4,
    atlasSize: COMBAT_ATLASES.scout,
    atlases: { combat: COMBAT_ATLASES.scout, scoutWalk: COMBAT_ATLASES.scoutWalk, scoutAttack: COMBAT_ATLASES.scoutAttack, scoutDeath: COMBAT_ATLASES.scoutDeath },
    clips: {
      idle: singleFrame('combat', COMBAT_ATLASES.scout.rowByState.idle),
      walk: rosterWalk('scoutWalk'),
      attack: rosterAttack('scoutAttack'),
      attack_anticipation: rosterAttackPhase('scoutAttack', 0),
      attack_contact: rosterAttackPhase('scoutAttack', 1, { attack_hit: ANIMATION_EVENT_TIMINGS.attack_hit }),
      attack_recovery: rosterAttackPhase('scoutAttack', 2),
      death: rosterDeath('scoutDeath'),
    },
    collisionRadius: 0.72,
    interactionRadius: 1.08,
    renderSize: 190,
    groundAnchor: { x: 0.5, y: 0.98 },
    shadowAnchor: { x: 0.5, y: 0.98, source: 'painted-in-frame' },
  },
  spearwarden: {
    label: 'Crown Spearwarden',
    directionCount: 4,
    atlasSize: COMBAT_ATLASES.spearwarden,
    atlases: { combat: COMBAT_ATLASES.spearwarden, spearwardenWalk: COMBAT_ATLASES.spearwardenWalk, spearwardenAttack: COMBAT_ATLASES.spearwardenAttack, spearwardenDeath: COMBAT_ATLASES.spearwardenDeath },
    clips: {
      idle: singleFrame('combat', COMBAT_ATLASES.spearwarden.rowByState.idle),
      walk: rosterWalk('spearwardenWalk'),
      attack: rosterAttack('spearwardenAttack'),
      attack_anticipation: rosterAttackPhase('spearwardenAttack', 0),
      attack_contact: rosterAttackPhase('spearwardenAttack', 1, { attack_hit: ANIMATION_EVENT_TIMINGS.attack_hit }),
      attack_recovery: rosterAttackPhase('spearwardenAttack', 2),
      death: rosterDeath('spearwardenDeath'),
    },
    collisionRadius: 0.45,
    interactionRadius: 0.82,
    renderSize: 104,
    groundAnchor: { x: 0.5, y: 0.98 },
    shadowAnchor: { x: 0.5, y: 0.98, source: 'painted-in-frame' },
  },
  militia: {
    label: 'Crown Militia',
    directionCount: 4,
    atlasSize: COMBAT_ATLASES.militia,
    atlases: { combat: COMBAT_ATLASES.militia, militiaWalk: COMBAT_ATLASES.militiaWalk, militiaAttack: COMBAT_ATLASES.militiaAttack, militiaDeath: COMBAT_ATLASES.militiaDeath },
    clips: {
      idle: singleFrame('combat', 0),
      walk: rosterWalk('militiaWalk'),
      attack: rosterAttack('militiaAttack'),
      attack_anticipation: rosterAttackPhase('militiaAttack', 0),
      attack_contact: rosterAttackPhase('militiaAttack', 1, { attack_hit: ANIMATION_EVENT_TIMINGS.attack_hit }),
      attack_recovery: rosterAttackPhase('militiaAttack', 2),
      death: rosterDeath('militiaDeath'),
    },
    collisionRadius: 0.42,
    interactionRadius: 0.78,
    renderSize: 104,
    groundAnchor: { x: 0.5, y: 0.98 },
    shadowAnchor: { x: 0.5, y: 0.98, source: 'painted-in-frame' },
  },
  shieldbearer: {
    label: 'Crown Shieldbearer',
    directionCount: 4,
    atlasSize: COMBAT_ATLASES.shieldbearer,
    atlases: { combat: COMBAT_ATLASES.shieldbearer, shieldbearerWalk: COMBAT_ATLASES.shieldbearerWalk, shieldbearerAttack: COMBAT_ATLASES.shieldbearerAttack, shieldbearerDeath: COMBAT_ATLASES.shieldbearerDeath },
    clips: {
      // Shieldbearer sheets were authored back, right, front, left. Map that
      // order into Crownforge's front, right, back, left direction contract.
      idle: directionalLoop('combat', { frames: [0], fps: 1, directionRows: [2, 1, 0, 3] }),
      walk: rosterWalk('shieldbearerWalk'),
      attack: rosterAttack('shieldbearerAttack'),
      attack_anticipation: rosterAttackPhase('shieldbearerAttack', 0),
      attack_contact: rosterAttackPhase('shieldbearerAttack', 1, { attack_hit: ANIMATION_EVENT_TIMINGS.attack_hit }),
      attack_recovery: rosterAttackPhase('shieldbearerAttack', 2),
      death: rosterDeath('shieldbearerDeath'),
    },
    collisionRadius: 0.44,
    interactionRadius: 0.8,
    renderSize: 106,
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
  if (unit.stunTimer > 0) return definition.clips.stunned ? 'stunned' : 'idle';
  if (unit.command === 'attack' || unit.visualState === 'attack') {
    if (unit.attackPhase === 'approach') return 'walk';
    if (unit.attackPhase === 'anticipation') return 'attack_anticipation';
    if (unit.attackPhase === 'recovery') return 'attack_recovery';
    if (unit.attackPhase === 'contact') return 'attack_contact';
    return 'attack';
  }
  if (unit.command === 'move' || unit.visualState === 'walk') return 'walk';
  // A recoil atlas may contain a deep lean or fall. Never slide that pose
  // along a live route: locomotion stays visually authoritative until the
  // unit stops, while the existing hit flash and health feedback still read.
  if (unit.hitFlash > 0 && definition.clips.hit) return 'hit';
  if (unit.visualState === 'wood') return 'gather_wood';
  if (unit.visualState === 'field') return 'field_work';
  if (unit.visualState === 'food') return 'gather_food';
  if (unit.visualState === 'stone') return 'gather_stone';
  if (unit.visualState === 'gold') return 'gather_gold';
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
  const numericDirection = Number.isFinite(Number(direction)) ? Math.round(Number(direction)) : 0;
  const directionIndex = Math.max(0, Math.min(definition.directionCount - 1, numericDirection));
  const frameColumns = clip.layout === 'frame-columns';
  const sourceRow = frameColumns
    ? (clip.directionRows?.[directionIndex] ?? directionIndex)
    : (clip.rows[frameIndex] ?? clip.rows[0]);
  const sourceColumn = frameColumns
    ? (clip.frameColumns?.[frameIndex] ?? clip.frames[frameIndex] ?? frameIndex)
    : directionIndex;
  return {
    requestedState,
    resolvedState: requestedClip.fallback ?? requestedState,
    fallback: requestedClip.fallback ?? null,
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
    // A unit can be moving while its collision solver is easing around a
    // blocker or starting a route. Keep the authored walk cycle alive during
    // that low-speed portion instead of showing a single frame sliding over
    // the ground. The simulation still caps fast travel independently.
    const playbackRate = nextState === 'walk' ? Math.max(0.78, Math.min(2.2, unit.animationPlaybackRate ?? 1)) : 1;
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
