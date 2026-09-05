import { HEARTHKIN_RIG_ART, HEARTHKIN_ARM_PARTS, HEARTHKIN_HAND_PARTS } from './hearthkin-rig-art.js?v=20260905-cuffbraid3';
import { horseAssemblyTransforms } from './horse-assembly.js?v=20260905-horsefit1';
import { hearthkinLocomotion, projectHearthkin } from './hearthkin-locomotion.js?v=20260905-softelbow1';
import { anatomicalToolFrame, hearthkinWorkMotion } from './hearthkin-work-motion.js';
import { drawCharacterEquipment, equipmentReadiness } from './character-equipment.js';
import { drawCharacterShield, shieldGeometry, shieldReadiness } from './character-shields.js';

const TAU = Math.PI * 2;
const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const point = (x, y) => ({ x, y });
const blend = (a, b, t) => point(mix(a.x, b.x, t), mix(a.y, b.y, t));
const offset = (a, x, y) => point(a.x + x, a.y + y);
const attachment = (a, x, y, angle) => point(a.x + x * Math.cos(angle) - y * Math.sin(angle), a.y + x * Math.sin(angle) + y * Math.cos(angle));

export const HEARTHKIN_ACTIONS = Object.freeze({
  idle: { label: 'At ease', duration: 3.6 },
  walk: { label: 'Walking', duration: 1.05 },
  gather_wood: { label: 'Chopping wood', duration: 1.1, contact: .6 },
  gather_food: { label: 'Picking berries', duration: 1.05, contact: .6 },
  field_work: { label: 'Tending the fields', duration: 1.6, contact: .6 },
  gather_stone: { label: 'Quarrying stone', duration: 1.2, contact: .6 },
  gather_gold: { label: 'Mining gold', duration: 1.3, contact: .6 },
  construct: { label: 'Building', duration: 1.2, contact: .6 },
  repair: { label: 'Repairing', duration: 1.2, contact: .6 },
  demolish: { label: 'Dismantling', duration: 1.2, contact: .6 },
  carry_wood: { label: 'Carrying timber', duration: 1.12 },
  carry_food: { label: 'Carrying food', duration: 1.12 },
  carry_stone: { label: 'Carrying stone', duration: 1.12 },
  carry_gold: { label: 'Carrying gold', duration: 1.12 },
  carry_supplies: { label: 'Carrying supplies', duration: 1.12 },
  attack: { label: 'Defending the hearth', duration: 1.25, contact: .292 },
  attack_anticipation: { label: 'Attack · wind-up', duration: .25, loop: false },
  attack_contact: { label: 'Attack · strike', duration: .575, loop: false },
  attack_recovery: { label: 'Attack · recovery', duration: .425, loop: false },
  hit: { label: 'Taking a hit', duration: .3, loop: false },
  ward_block: { label: 'Ward · blocking a blow', duration: .42, loop: false },
  stunned: { label: 'Stunned', duration: 2.4 },
  death: { label: 'Falling', duration: 1.35, loop: false },
});

// Two-bone inverse kinematics. The end target, not the artwork rectangle,
// controls the hands and planted feet. The pieces overlap at their joints.
export function solveLimb(start, end, upper, lower, bend = 1) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const rawDistance = Math.hypot(dx, dy);
  const distance = clamp(rawDistance, Math.abs(upper - lower) + .01, upper + lower - .01);
  const angle = Math.atan2(dy, dx);
  const inside = Math.acos(clamp((upper * upper + distance * distance - lower * lower) / (2 * upper * distance), -1, 1));
  return point(start.x + Math.cos(angle + inside * bend) * upper, start.y + Math.sin(angle + inside * bend) * upper);
}

function strideFoot(phase, side, forward, weight = 1) {
  const p = ((phase % 1) + 1) % 1;
  const stance = p < .6;
  const q = stance ? p / .6 : (p - .6) / .4;
  const travel = stance ? mix(1, -1, q) : mix(-1, 1, smooth(q));
  const lift = stance ? 0 : Math.sin(q * Math.PI) * 10.5;
  return {
    point: point(side + forward.x * travel * 19 * weight, -6 + forward.y * travel * 7 * weight - lift),
    angle: stance ? (q > .8 ? (q - .8) * -.55 : 0) : Math.sin(q * TAU) * .19,
    planted: stance,
  };
}

function workStroke(p) {
  // Deliberate preparation, quick contact at 60%, unhurried recovery.
  if (p < .4) return mix(0, -1, smooth(p / .4));
  if (p < .6) return mix(-1, 1, smooth((p - .4) / .2));
  return mix(1, 0, smooth((p - .6) / .4));
}

export function hearthkinPose(state = 'idle', time = 0, direction = 0, options = {}) {
  const action = HEARTHKIN_ACTIONS[state] ?? HEARTHKIN_ACTIONS.idle;
  const phase = action.loop === false ? clamp(time / action.duration) : ((time / action.duration) % 1 + 1) % 1;
  const sideView = direction === 1 || direction === 3;
  const forward = [point(0, 1), point(1, 0), point(0, -1), point(-1, 0)][direction] ?? point(0, 1);
  const sign = direction === 0 || direction === 3 ? -1 : 1;
  const lateral = direction === 0 ? -1 : 1;
  const carrying = state.startsWith('carry_') || Boolean(options.carryType && options.moving);
  const walking = state === 'walk' || carrying && options.moving !== false;
  const cycle = options.phase ?? phase;
  const stride = carrying ? .72 : 1;
  const legSpread = sideView ? 1.8 : 5.1;
  let leftFoot = strideFoot(cycle, -legSpread * lateral, forward, stride);
  let rightFoot = strideFoot(cycle + .5, legSpread * lateral, forward, stride);
  if (!walking) {
    leftFoot = { point: point((sideView ? -4 : -6) * lateral, -6), angle: 0, planted: true };
    rightFoot = { point: point((sideView ? 4 : 6) * lateral, -6), angle: 0, planted: true };
  }
  const walkWave = Math.sin(cycle * TAU);
  const breath = Math.sin(time * TAU / 3.6 + (options.id ?? 0) * .63);
  const weightDrop = walking ? Math.cos(cycle * TAU * 2) * .8 : 0;
  let hip = point(walking && !sideView ? walkWave * .65 : 0, (walking ? -41.5 : -44.5) + weightDrop);
  let lean = walking ? forward.x * .055 : 0;
  let bendDepth = 0;
  let leftHand = point((sideView ? -3 : -15) * lateral, -34);
  let rightHand = point((sideView ? 3 : 15) * lateral, -34);
  let tool = 'axe';
  let toolAngle = Math.PI + (sideView ? forward.x * -.18 : -.12 * sign);
  let toolGrip = .8;
  let toolHand = 'right';
  let toolScale = 1;
  let cargo = null;
  let headTilt = breath * .008;
  let response = 0;

  if (walking) {
    leftHand.x += forward.x * walkWave * 8;
    rightHand.x -= forward.x * walkWave * 8;
    leftHand.y += forward.y * walkWave * 4;
    rightHand.y -= forward.y * walkWave * 4;
    toolAngle += walkWave * .12;
  }
  if (carrying) {
    cargo = (options.carryType || state.slice(6) || 'supplies');
    const y = -43 + weightDrop;
    leftHand = point(forward.x * 12 - (sideView ? 3 : 10) * lateral, y);
    rightHand = point(forward.x * 12 + (sideView ? 3 : 10) * lateral, y);
    lean = forward.x * -.065;
    tool = null;
  }

  const working = ['gather_wood', 'gather_stone', 'gather_gold', 'construct', 'repair', 'demolish'].includes(state);
  if (working) {
    const stroke = workStroke(phase);
    const mining = state === 'gather_stone' || state === 'gather_gold';
    const building = ['construct', 'repair', 'demolish'].includes(state);
    tool = mining ? 'pick' : building ? 'hammer' : 'axe';
    toolScale = mining ? 1.15 : building ? .82 : 1.12;
    lean = forward.x * (stroke > 0 ? stroke * .18 : stroke * .055);
    bendDepth = Math.max(0, stroke) * 3.5;
    const y = -55 + stroke * (building ? 9 : 17);
    const reach = 15 + stroke * 7;
    rightHand = point(forward.x * reach + (sideView ? 0 : sign * 7), y + forward.y * 5);
    leftHand = building ? point(forward.x * 21 - (sideView ? 0 : sign * 8), -46 + forward.y * 4)
      : offset(rightHand, sideView ? -forward.x * 4 : -sign * 4, 4);
    toolAngle = (sideView ? forward.x : sign) * mix(-.75, 1.0, (stroke + 1) / 2);
    toolGrip = .88;
    headTilt = forward.x * .035 + stroke * .02;
  }
  if (state === 'field_work') {
    tool = 'hoe'; toolScale = 1.8; toolGrip = .86;
    const rake = Math.sin(phase * TAU - Math.PI / 2);
    lean = forward.x * (.12 + (rake + 1) * .075);
    bendDepth = 5 + (rake + 1) * 2;
    rightHand = point(forward.x * (14 + rake * 9) + (sideView ? 0 : sign * 7), -42 + rake * 3 + forward.y * 5);
    leftHand = offset(rightHand, -forward.x * 8 - (sideView ? 0 : sign * 8), -8);
    toolAngle = Math.PI - (sideView ? forward.x * (.4 + rake * .08) : sign * (.24 + rake * .04));
    headTilt = forward.x * .1;
  }
  if (state === 'gather_food') {
    tool = null;
    const reach = Math.sin(phase * TAU - Math.PI / 2) * .5 + .5;
    lean = forward.x * (.15 + reach * .12);
    bendDepth = 5 + reach * 5;
    rightHand = point(forward.x * (9 + reach * 16) + (sideView ? 0 : sign * 11), -36 + reach * 7 + forward.y * 6);
    leftHand = point(forward.x * 6 - (sideView ? 0 : sign * 7), -35);
    cargo = 'empty';
    headTilt = forward.x * .12;
  }
  if (state.startsWith('attack')) {
    let attackPhase = phase;
    if (state === 'attack_anticipation') attackPhase = phase * .2;
    if (state === 'attack_contact') attackPhase = .2 + phase * .46;
    if (state === 'attack_recovery') attackPhase = .66 + phase * .34;
    let strike;
    if (attackPhase < .2) strike = mix(0, -1, smooth(attackPhase / .2));
    else if (attackPhase < .292) strike = mix(-1, 1, smooth((attackPhase - .2) / .092));
    else strike = mix(1, 0, smooth((attackPhase - .292) / .708));
    lean = forward.x * strike * .2;
    bendDepth = Math.max(0, strike) * 2;
    rightHand = point(forward.x * (14 + strike * 11) + (sideView ? 0 : sign * 9), -56 + strike * 15 + forward.y * 5);
    leftHand = point(forward.x * 8 - (sideView ? 0 : sign * 11), -51);
    toolAngle = (sideView ? forward.x : sign) * (-.08 + strike * .95);
    toolScale = 1.05;
  }
  if (state === 'hit') response = Math.sin(clamp(phase * 1.15) * Math.PI);
  if (options.hit > 0 && state !== 'death') response = Math.max(response, clamp(options.hit / .3) * .65);
  if (state === 'ward_block') response = Math.sin(phase * Math.PI) * .5;
  if (response) {
    lean -= forward.x * response * .15;
    bendDepth += response * 2;
    headTilt -= forward.x * response * .12;
  }
  if (state === 'ward_block' || (options.wardImpact > .01 && state === 'idle')) {
    leftHand = point(forward.x * 19 - (sideView ? 0 : sign * 8), -62);
    rightHand = point(forward.x * -3 + (sideView ? 0 : sign * 13), -39);
  }
  if (state === 'stunned') {
    lean = forward.x * (.11 + Math.sin(time * 2.1) * .025);
    bendDepth = 5 + Math.sin(time * 2.1) * .6;
    headTilt = forward.x * .2 + Math.sin(time * 2.1) * .035;
    leftHand.y += 3; rightHand.y += 3;
    toolAngle += forward.x * .15;
  }

  let waist = offset(hip, 0, -3);
  let neck = offset(waist, Math.sin(lean) * 28, -Math.cos(lean) * 28 + bendDepth + breath * .28);
  let shoulder = blend(neck, waist, .2);
  let head = offset(neck, forward.x * bendDepth * .35, -1);
  let fall = 0;
  if (state === 'death') {
    fall = smooth((phase - .08) / .8);
    hip = blend(hip, point(-sign * 8, -9), fall);
    waist = blend(waist, point(-sign * 8, -10), fall);
    neck = blend(neck, point(sign * 18, -11), fall);
    shoulder = blend(neck, waist, .2);
    head = offset(neck, sign * fall * 2, -1);
    leftHand = blend(leftHand, point(sign * 17, -3), fall);
    rightHand = blend(rightHand, point(sign * 3, -2), fall);
    leftFoot.point = blend(leftFoot.point, point(-sign * 33, -3), fall);
    rightFoot.point = blend(rightFoot.point, point(-sign * 29, -8), fall);
    leftFoot.angle = fall * sign * 1.1; rightFoot.angle = fall * sign * .9;
    headTilt = sign * fall * .05;
    tool = null;
  }

  const shoulderSpread = sideView ? 2.4 : 10.3;
  const leftShoulder = offset(shoulder, sideView ? -forward.x * 3.8 - (direction === 1 ? 1 : 0) : -shoulderSpread * lateral, sideView ? 1 : 0);
  const rightShoulder = offset(shoulder, sideView ? -forward.x * 3.8 + (direction === 3 ? 1 : 0) : shoulderSpread * lateral, sideView ? 1 : 0);
  const leftHip = offset(hip, -legSpread * lateral, 0), rightHip = offset(hip, legSpread * lateral, 0);
  const legBend = sideView ? -forward.x : -1;
  // Front/back knees bend into depth, not sideways across the silhouette.
  const leftKnee = sideView || fall > .01 ? solveLimb(leftHip, leftFoot.point, 19.8, 19.8, legBend) : blend(leftHip, leftFoot.point, .51);
  const rightKnee = sideView || fall > .01 ? solveLimb(rightHip, rightFoot.point, 19.8, 19.8, sideView ? legBend : 1) : blend(rightHip, rightFoot.point, .51);
  const constrainReach = (start, end) => {
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    return distance > 32.9 ? blend(start, end, 32.9 / distance) : end;
  };
  leftHand = constrainReach(leftShoulder, leftHand);rightHand = constrainReach(rightShoulder, rightHand);
  const leftElbow = solveLimb(leftShoulder, leftHand, 17, 16, sideView ? forward.x : lateral);
  const rightElbow = solveLimb(rightShoulder, rightHand, 17, 16, sideView ? forward.x : -lateral);
  const pose = {
    state, phase, direction, sideView, forward, sign, walking, carrying, fall, hip, waist, neck, shoulder, head, headTilt,
    leftShoulder, rightShoulder, leftElbow, rightElbow, leftHand, rightHand,
    leftHip, rightHip, leftKnee, rightKnee, leftFoot, rightFoot,
    tool, toolAngle, toolScale, toolGrip, toolHand, cargo,
    clothSway: walking ? walkWave * .035 : 0,
    braidSway: Math.sin((walking ? cycle * TAU : time * 2) - .7) * (walking ? .085 : .018) * (1 - fall),
  };
  if (state === 'walk' || state.startsWith('carry_') || state === 'idle' && !response && !(options.wardImpact > .01)) {
    Object.assign(pose, hearthkinLocomotion(state,time,direction,{duration:action.duration,id:options.id,moving:options.moving,relaxedWalkArms:options.relaxedWalkArms}));
    const wristAngle = Math.atan2(pose.rightHand.y-pose.rightElbow.y,pose.rightHand.x-pose.rightElbow.x)-Math.PI/2;
    pose.toolAngle = Math.PI + wristAngle * .65;
    pose.headTilt = 0;
    const forearm=pose.anatomical.rightHand,elbow=pose.anatomical.rightElbow;
    pose.toolFrame=anatomicalToolFrame(pose,Math.PI+Math.atan2(forearm.z-elbow.z,elbow.y-forearm.y)*.65);
  } else {
    const work=hearthkinWorkMotion(state,time,direction,{duration:action.duration,id:options.id,phase});
    if(work)Object.assign(pose,work);
  }
  return pose;
}

export function hearthkinHandFrame(pose,left=false) {
  const view=['front','right','back','left'][pose.direction];
  return (pose.handFrames??HEARTHKIN_HAND_PARTS)[view]?.[left?'left':'right'] ?? {
    key:view,index:left?8:9,width:4.8,height:7,root:[.5,.18],grip:[.5,.18+3.45/7],
  };
}

export function hearthkinPalmSocket(pose,left=false) {
  if(pose.projectedWork)return pose[left?'leftPalm':'rightPalm'];
  const wrist=left?pose.leftHand:pose.rightHand, elbow=left?pose.leftElbow:pose.rightElbow;
  const angle=Math.atan2(wrist.y-elbow.y,wrist.x-elbow.x)-Math.PI/2;
  const frame=hearthkinHandFrame(pose,left);
  return attachment(wrist,(frame.grip[0]-frame.root[0])*frame.width,(frame.grip[1]-frame.root[1])*frame.height,angle);
}

export function hearthkinHandTransform(pose,left=false) {
  const frame=hearthkinHandFrame(pose,left),wrist=pose[left?'leftHand':'rightHand'],elbow=pose[left?'leftElbow':'rightElbow'];
  if(!pose.projectedWork)return {frame,width:frame.width,height:frame.height,angle:Math.atan2(wrist.y-elbow.y,wrist.x-elbow.x)-Math.PI/2};
  const palm=hearthkinPalmSocket(pose,left),dx=palm.x-wrist.x,dy=palm.y-wrist.y,length=Math.hypot(dx,dy);
  const authoredX=(frame.grip[0]-frame.root[0])*frame.width;
  const width=frame.width*Math.min(1,length/Math.max(.0001,Math.abs(authoredX))* .98);
  const sourceX=(frame.grip[0]-frame.root[0])*width;
  const sourceY=Math.sqrt(Math.max(.000001,length*length-sourceX*sourceX));
  return {frame,width,height:sourceY/(frame.grip[1]-frame.root[1]),angle:Math.atan2(dy,dx)-Math.atan2(sourceY,sourceX)};
}

// Raster artwork supplies surfaces; the rig supplies continuous motion.
// No direction is obtained by flipping another view and no animation uses
// a whole-character bob, squash, crossfade, or repeated sprite-sheet poses.
// A hoof has two attachments: the fetlock above it and its painted sole on
// the ground. Preserve both while the sole rolls around the supporting edge.
export function mountedHoofTransform(pose,index,art) {
  const legName=['frontLeft','frontRight','hindLeft','hindRight'][index-14];
  const leg=pose.mount.legs[legName],rect=art.parts[index],anchors=art.anchors[index];
  const root=anchors.root,sole=anchors.sole??anchors.tip;
  const origin=pose.mount.projected[legName+'Fetlock'];
  const ground=projectHearthkin(leg.contact,pose.direction);
  const angle=leg.pitch*(pose.direction===3?-1:pose.direction===1?1:0);
  const height=8*pose.mount.scale/Math.max(.001,sole[1]-root[1]);
  const width=height*rect[2]/rect[3];
  const candidates=[anchors.heel??sole,anchors.toe??sole];
  const support=angle===0?sole:candidates.reduce((a,b)=>Math.sin(angle)*a[0]>Math.sin(angle)*b[0]?a:b);
  const target={x:ground.x+(support[0]-sole[0])*width,y:ground.y};
  const across={x:width*Math.cos(angle),y:width*Math.sin(angle)};
  const du=support[0]-root[0],dv=Math.max(.001,support[1]-root[1]);
  const down={x:(target.x-origin.x-du*across.x)/dv,y:(target.y-origin.y-du*across.y)/dv};
  return {origin,ground,target,root,sole,support,width,height,across,down,angle};
}

export function mountedPaintOrder(pose) {
  const h=pose.mount.projected;
  const legs=[{root:'frontLeftShoulder',parts:[4,8,14]},{root:'frontRightShoulder',parts:[5,9,15]},{root:'hindLeftHip',parts:[6,10,12,16]},{root:'hindRightHip',parts:[7,11,13,17]}].sort((a,b)=>h[a.root].depth-h[b.root].depth);
  const rear=pose.direction===2,profile=pose.direction===1||pose.direction===3;
  return {
    behind:[...(rear?[1,18,0]:[3,...(profile?[18,1]:[])]),...legs.slice(0,2).flatMap(leg=>leg.parts)],
    ahead:[...legs.slice(2).flatMap(leg=>leg.parts),...(rear?[3]:profile?[0]:[])],
  };
}

export class HearthkinRig {
  constructor(definition={}) {
    this.definition=definition;
    this.art=definition.views?{...definition.views,props:HEARTHKIN_RIG_ART.props}:HEARTHKIN_RIG_ART;
    if(definition.mount)for(const [view,art] of Object.entries(definition.mount.views))this.art['mount-'+view]=art;
    this.armParts=definition.arms??HEARTHKIN_ARM_PARTS;
    this.handFrames=definition.hands??HEARTHKIN_HAND_PARTS;
    this.images = {};
    this.parts = new Map();
    this.transitions = new WeakMap();
    for (const [key, definition] of Object.entries(this.art)) {
      const image = new Image();
      image.src = new URL(definition.src.replace('./assets/', '../assets/'), import.meta.url).href;
      this.images[key] = image;
    }
  }

  readiness() { return [...Object.values(this.images),...equipmentReadiness(),...(this.definition?.family==='foot'||this.definition?.family==='mounted'?shieldReadiness():[])]; }

  part(key, index) {
    const cacheKey = `${key}:${index}`;
    if (this.parts.has(cacheKey)) return this.parts.get(cacheKey);
    const image = this.images[key];
    if (!image?.complete || !image.naturalWidth) return null;
    const source=(this.art??HEARTHKIN_RIG_ART)[key];
    const rect=source.parts[index];
    if (!rect) return null;
    // Make small mipmaps once so fine cloth detail remains clean at RTS size.
    const levels = [256, 128, 64, 32].map(height => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(height * rect[2] / rect[3])); canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      // Some tightly packed authored cells have neighbouring components
      // inside their rectangular bounds. Clip the source region before
      // creating any mip level, so the stray cell cannot bleed into hair.
      const polygon=source.sourceClips?.[index];
      if(polygon) {
        ctx.beginPath();
        polygon.forEach(([x,y],i)=>ctx[i?'lineTo':'moveTo']((x-rect[0])*canvas.width/rect[2],(y-rect[1])*height/rect[3]));
        ctx.closePath();ctx.clip();
      }
      ctx.drawImage(image, ...rect, 0, 0, canvas.width, height);
      return canvas;
    });
    this.parts.set(cacheKey, levels);
    return levels;
  }

  draw(ctx, unit, anchor, size, alpha = 1, timeOverride) {
    size*=this.definition?.renderScale??1;
    const direction = clamp(Math.floor(unit.facing ?? 0), 0, 3);
    const view = ['front', 'right', 'back', 'left'][direction];
    const state = unit.animationState ?? 'idle';
    const actions=this.definition?.actions??HEARTHKIN_ACTIONS;
    const action = actions[state] ?? actions.idle;
    let time = timeOverride ?? unit.animationTime ?? 0;
    // Gathering uses the simulation's contact clock so a tool lands when the
    // harvest event fires, even after travel, interruptions, or loading a save.
    if (timeOverride === undefined && state.startsWith('gather_') && Number.isFinite(unit.gatherTimer)) time = unit.gatherTimer;
    if (timeOverride === undefined && state.startsWith('attack_') && Number.isFinite(unit.attackPhaseElapsed)) time = unit.attackPhaseElapsed;
    if (timeOverride === undefined && ['construct', 'repair', 'demolish', 'field_work'].includes(state) && Number.isFinite(unit.workCyclePhase)) time = unit.workCyclePhase * action.duration;
    let pose = (this.definition?.samplePose??hearthkinPose)(state, time, direction, {
      id: unit.id, hit: unit.hitFlash, wardImpact: unit.wardBlockedPulse,
      carryType: unit.carryAmount > 0 ? unit.carryType : null,
      moving: unit.kind === 'unit' ? unit.motionSpeed > .025 : state === 'walk' || state.startsWith('carry_'),
    });
    if(this.handFrames)pose.handFrames=this.handFrames;
    if (timeOverride === undefined) {
      const previous = this.transitions.get(unit);
      const clock = unit.animClock ?? 0;
      const from = previous?.direction!==direction?null:previous?.state !== state ? previous?.pose : previous?.from;
      const started = previous?.state !== state ? clock : previous?.started ?? clock;
      const amount = smooth((clock - started) / .11);
      // A projected work/body frame already solves physical hand, tool and
      // torso constraints together. Blending only its screen joints would
      // leave the tool and body at a different pose for the first 110 ms.
      // Blend compatible free locomotion only; action entry/contact frames
      // retain their complete anatomical solution and simulation timing.
      const freeTransition=from&&!pose.projectedWork&&!from.projectedWork&&!pose.bodyFrame&&!from.bodyFrame
        &&pose.tool===from.tool&&pose.cargo===from.cargo;
      if (freeTransition && amount < 1 && !state.startsWith('attack') && state !== 'death' && state !== 'hit' && state !== 'ward_block') {
        pose = { ...pose };
        for (const key of ['hip','waist','neck','shoulder','head','leftShoulder','rightShoulder','leftElbow','rightElbow','leftHip','rightHip','leftKnee','rightKnee','leftHand','rightHand']) pose[key] = blend(from[key], pose[key], amount);
        if(pose.projectedWork)for(const side of ['left','right'])pose[side+'Palm']=blend(hearthkinPalmSocket(from,side==='left'),pose[side+'Palm'],amount);
        for (const key of ['leftFoot','rightFoot']) pose[key] = { ...pose[key], point: blend(from[key].point, pose[key].point, amount), angle: mix(from[key].angle, pose[key].angle, amount) };
        pose.headTilt = mix(from.headTilt, pose.headTilt, amount);
        const angularDifference = Math.atan2(Math.sin(pose.toolAngle - from.toolAngle), Math.cos(pose.toolAngle - from.toolAngle));
        pose.toolAngle = from.toolAngle + angularDifference * amount;
        const lateral = direction === 0 ? -1 : 1;
        if (!pose.projectedLocomotion) {
          pose.leftElbow = solveLimb(pose.leftShoulder, pose.leftHand, 17, 16, pose.sideView ? pose.forward.x : lateral);
          pose.rightElbow = solveLimb(pose.rightShoulder, pose.rightHand, 17, 16, pose.sideView ? pose.forward.x : -lateral);
        }
      }
      this.transitions.set(unit, { state, direction, pose, from: amount < 1 ? from : null, started });
    }
    if (!this.part(view, 0)) return false;
    ctx.save(); ctx.translate(anchor.x, anchor.y); ctx.scale(size / 100, size / 100); ctx.globalAlpha *= alpha;
    ctx.imageSmoothingEnabled = true;
    const dimensions=this.definition?.dimensions??{};
    const appendage=this.definition?.appendage??'braid';
    const draw = (key, index, position, width, height, angle = 0, pivotX = .5, pivotY = 0, half = null, reverseAcrossGrip = false) => {
      const replacement=this.art?.[key]?.overrides?.[index];
      if(replacement){key=replacement.key;index=replacement.index;}
      const levels = this.part(key, index);
      if (!levels) return;
      const screenHeight = Math.abs(height * size / 100) * (globalThis.devicePixelRatio ?? 1);
      const image = screenHeight > 128 ? levels[0] : screenHeight > 64 ? levels[1] : screenHeight > 32 ? levels[2] : levels[3];
      ctx.save(); ctx.translate(position.x, position.y); ctx.rotate(angle);
      if(reverseAcrossGrip)ctx.scale(-1,1);
      if (half !== null) { ctx.beginPath();ctx.rect(-width * pivotX + half * width / 2, -height * pivotY, width / 2, height);ctx.clip(); }
      ctx.drawImage(image, -width * pivotX, -height * pivotY, width, height); ctx.restore();
    };
    // Body surfaces follow the actor's plane as it leans or falls. Keeping
    // a full-height billboard here leaves rear cloaks standing upright.
    const bodySurface=(index,joint,width,height,pivotX=.5,pivotY=0,upOffset=0,backOffset=0)=>{
      const frame=pose.bodyFrame,origin=pose.anatomical[joint];
      const horizontal=pose.sideView?frame.forward:frame.right;
      const sign=direction===0||direction===3?-1:1;
      const x=projectHearthkin({x:horizontal.x*sign,y:horizontal.y*sign,z:horizontal.z*sign},direction);
      const down=projectHearthkin({x:-frame.up.x,y:-frame.up.y,z:-frame.up.z},direction);
      const at=projectHearthkin({x:origin.x+frame.up.x*upOffset-frame.forward.x*backOffset,y:origin.y+frame.up.y*upOffset-frame.forward.y*backOffset,z:origin.z+frame.up.z*upOffset-frame.forward.z*backOffset},direction);
      ctx.save();ctx.transform(x.x,x.y,down.x,down.y,at.x,at.y);
      draw(view,index,point(0,0),width,height,0,pivotX,pivotY);ctx.restore();
    };
    const segment = (index, a, b, width, overlap = 2.2) => {
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      draw(view, index, a, width, length + overlap * 2, Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2, .5, overlap / (length + overlap * 2));
    };
    const attachedSegment = (part,a,b,width) => {
      const length=Math.hypot(b.x-a.x,b.y-a.y);
      const sourceX=(part.tip[0]-part.root[0])*width;
      const sourceY=Math.sqrt(Math.max(.001,length*length-sourceX*sourceX));
      const height=sourceY/(part.tip[1]-part.root[1]);
      const angle=Math.atan2(b.y-a.y,b.x-a.x)-Math.atan2(sourceY,sourceX);
      draw(part.key,part.index,a,width,height,angle,part.root[0],part.root[1]);
    };
    const drawLeg = left => {
      const a = left ? pose.leftHip : pose.rightHip, b = left ? pose.leftKnee : pose.rightKnee;
      const foot = left ? pose.leftFoot : pose.rightFoot;
      for(const [index,start,end,width] of [[left?10:11,a,b,pose.sideView?10:9.4],[left?12:13,b,foot.point,7.4]]) {
        const anchors=this.art?.[view]?.anchors?.[index];
        if(anchors)attachedSegment({key:view,index,...anchors},start,end,width);
        else segment(index,start,end,width);
      }
      draw(view, left ? 14 : 15, offset(foot.point, pose.forward.x * 2.1, -1), pose.sideView ? 12.5 : 9.4, 10, foot.angle, .5, .26);
    };
    const mountKey='mount-'+view;
    const horseAssembly=pose.mount?horseAssemblyTransforms(pose,this.art[mountKey],unit.type):null;
    const mountBone=index=>{
      if(horseAssembly?.[index]) {
        const t=horseAssembly[index];
        draw(mountKey,index,t.origin,t.width,t.height,t.angle,t.root[0],t.root[1]);
        return;
      }
      const binding=pose.mount.partBindings[index],parts=this.art[mountKey],rect=parts.parts[index];
      const anchors=parts.anchors?.[index]??{root:[.5,.1],tip:[.5,.9]};
      const a=pose.mount.projected[binding.root],b=pose.mount.projected[binding.tip];
      if(index>=14&&index<=17) {
        const t=mountedHoofTransform(pose,index,parts);
        ctx.save();ctx.transform(t.across.x/t.width,t.across.y/t.width,t.down.x/t.height,t.down.y/t.height,t.origin.x,t.origin.y);
        draw(mountKey,index,point(0,0),t.width,t.height,0,t.root[0],t.root[1]);ctx.restore();
        return;
      }
      const dx=(anchors.tip[0]-anchors.root[0])*rect[2],dy=(anchors.tip[1]-anchors.root[1])*rect[3];
      const scale=Math.hypot(b.x-a.x,b.y-a.y)/Math.max(.001,Math.hypot(dx,dy));
      const angle=Math.atan2(b.y-a.y,b.x-a.x)-Math.atan2(dy,dx);
      draw(mountKey,index,a,rect[2]*scale,rect[3]*scale,angle,anchors.root[0],anchors.root[1]);
    };
    const mountSurface=(index,joint,width,height)=>{
      const dimensions=this.art[mountKey].surfaces?.[index];
      if(dimensions){width=dimensions.width*pose.mount.scale;height=dimensions.height*pose.mount.scale;}
      const frame=pose.mount.bodyFrame,origin=pose.mount.projected[joint];
      const horizontal=pose.sideView?frame.forward:frame.right;
      const sign=direction===0||direction===3?-1:1;
      const x=projectHearthkin({x:horizontal.x*sign,y:horizontal.y*sign,z:horizontal.z*sign},direction);
      const down=projectHearthkin({x:-frame.up.x,y:-frame.up.y,z:-frame.up.z},direction);
      const pivot=this.art[mountKey].anchors?.[index]?.root??[.5,.5];
      ctx.save();ctx.transform(x.x,x.y,down.x,down.y,origin.x,origin.y);
      draw(mountKey,index,point(0,0),width,height,0,pivot[0],pivot[1]);ctx.restore();
    };
    const mountFront=()=>{mountBone(18);mountBone(1);mountBone(0);};
    const drawMount=()=>{
      const order=mountedPaintOrder(pose);
      for(const index of order.behind)mountBone(index);
      if(pose.sideView)drawLeg(direction===1);
      mountSurface(2,'barrel',(pose.sideView?60:24)*pose.mount.scale,(pose.sideView?32:36)*pose.mount.scale);
      mountSurface(19,'saddle',(pose.sideView?28:25)*pose.mount.scale,13*pose.mount.scale);
      for(const index of order.ahead)mountBone(index);
    };
    const drawReins=()=>{
      if(!pose.reins)return;
      ctx.save();ctx.strokeStyle='#39271b';ctx.lineWidth=.62;
      for(const side of ['left','right']) {
        const [a,b,c]=pose.reins[side].map(p=>projectHearthkin(p,direction));
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(b.x,b.y,c.x,c.y);ctx.stroke();
      }
      ctx.restore();
    };
    const drawArm = left => {
      const a = left ? pose.leftShoulder : pose.rightShoulder, b = left ? pose.leftElbow : pose.rightElbow, c = left ? pose.leftHand : pose.rightHand;
      const parts=(this.armParts??HEARTHKIN_ARM_PARTS)[view]?.[left?'left':'right'];
      const upper=()=>parts?attachedSegment(parts.upper,a,b,dimensions.upperArm??9.2):segment(left?4:5,a,b,9.2);
      const lower=()=>parts?attachedSegment(parts.lower,b,c,dimensions.forearm??5.4):segment(left?6:7,b,c,5.4,1.8);
      if((this.definition?.id??unit.type??'villager')==='villager') {
        // The rolled sleeve covers the forearm insertion at the elbow.
        lower();upper();
      } else {upper();lower();}
    };
    const drawHand = left => {
      const wrist = left ? pose.leftHand : pose.rightHand;
      const {frame,width,height,angle}=hearthkinHandTransform(pose,left);
      draw(frame.key, frame.index, wrist, width, height, angle, frame.root[0], frame.root[1]);
    };
    const drawTool = () => {
      if (!pose.tool) return;
      if(pose.toolFrame) {
        const socket=hearthkinPalmSocket(pose),grip=projectHearthkin(pose.toolFrame.grip,direction);
        drawCharacterEquipment(ctx,pose.toolFrame,direction,{x:socket.x-grip.x,y:socket.y-grip.y});
        return;
      }
      const index = { axe: 0, pick: 1, hoe: 2, hammer: 3 }[pose.tool];
      const width = { axe: 13, pick: 24, hoe: 13, hammer: 13 }[pose.tool] * pose.toolScale;
      const gripX = { axe: .18, pick: .52, hoe: .13, hammer: .5 }[pose.tool];
      // The cutting edge follows the right hand around the body. Reverse
      // across the grip, never across the screen or the whole character.
      const reverseAxe=pose.tool==='axe'&&(direction===2||direction===3);
      draw('props', index, hearthkinPalmSocket(pose), width, 33 * pose.toolScale, pose.toolAngle, gripX, pose.toolGrip, null, reverseAxe);
    };
    const drawCargo = () => {
      if (!pose.cargo) return;
      const index = { wood: 4, food: 5, stone: 6, gold: 7, supplies: 8, empty: 9 }[pose.cargo] ?? 8;
      const center = blend(pose.leftHand, pose.rightHand, .5);
      draw('props', index, offset(center, 0, 3), pose.cargo === 'wood' ? 31 : pose.sideView ? 25 : 30, pose.cargo === 'wood' ? 15 : 21, 0, .5, .38);
    };
    // Directional painter order: the far limbs disappear behind the torso,
    // while the near fingers close over the carried object/tool grip.
    const farLeft = direction === 1 || direction === 2;
    const shield=pose.shieldFrame?shieldGeometry(pose.shieldFrame,direction):null;
    const drawArmAssembly = left => {
      drawArm(left);
      if (!left) drawTool();
      if(left&&shield?.frame.hand==='left'&&!shield.frontFacing)drawCharacterShield(ctx,pose.shieldFrame,direction,unit.type??this.definition?.id);
      drawHand(left);
      if(left&&shield?.frame.hand==='left'&&shield.frontFacing)drawCharacterShield(ctx,pose.shieldFrame,direction,unit.type??this.definition?.id);
    };
    const torsoAngle = Math.atan2(pose.waist.y - pose.neck.y, pose.waist.x - pose.neck.x) - Math.PI / 2;
    const drawCloak=()=>pose.bodyFrame?bodySurface(3,'neck',pose.sideView?(dimensions.cloakSideWidth??18):(dimensions.cloakWidth??29),dimensions.cloakHeight??41,.5,.05,1,3):draw(view,3,attachment(pose.neck,pose.sideView?-pose.forward.x*3:0,-1,torsoAngle),pose.sideView?(dimensions.cloakSideWidth??18):(dimensions.cloakWidth??29),dimensions.cloakHeight??41,torsoAngle+pose.braidSway,.5,.05);
    if(pose.mount)drawMount();
    if(appendage==='cloak'&&direction!==2)drawCloak();
    if(shield?.frame.attachment==='back'&&direction!==2)drawCharacterShield(ctx,pose.shieldFrame,direction,unit.type??this.definition?.id);
    if(!pose.mount||!pose.sideView)drawLeg(farLeft);
    if (pose.sideView) drawArmAssembly(farLeft);
    drawLeg(!farLeft);
    if (direction === 2) { drawCargo();drawArmAssembly(true);drawArmAssembly(false); }
    const hipsAngle = pose.bodyFrame?torsoAngle:pose.fall * pose.sign * 1.2;
    const coatRoot = attachment(pose.waist, 0, -2, hipsAngle);
    if(pose.bodyFrame)bodySurface(2,'waist',pose.sideView?22:28,27,.5,0,2);
    else if (pose.sideView || pose.fall > .01) draw(view, 2, coatRoot, pose.sideView ? 22 : 28, 27, hipsAngle + pose.clothSway);
    else {
      draw(view, 2, coatRoot, 28, 27, hipsAngle + pose.clothSway, .5, 0, 0);
      draw(view, 2, coatRoot, 28, 27, hipsAngle - pose.clothSway, .5, 0, 1);
    }
    const torsoHeight = Math.hypot(pose.waist.x - pose.neck.x, pose.waist.y - pose.neck.y) + 3;
    if(pose.bodyFrame)bodySurface(1,'neck',pose.sideView?(dimensions.torsoSide??20):(dimensions.torso??25),31,.5,0,1);
    else draw(view, 1, offset(pose.neck, 0, -1), pose.sideView ? (dimensions.torsoSide??20) : (dimensions.torso??25), torsoHeight, torsoAngle);
    if(appendage==='cloak'&&direction===2)drawCloak();
    if(shield?.frame.attachment==='back'&&direction===2)drawCharacterShield(ctx,pose.shieldFrame,direction,unit.type??this.definition?.id);
    const headAngle = torsoAngle + pose.headTilt;
    if(appendage==='braid'&&pose.bodyFrame)bodySurface(3,'head',4.6,29,.5,0,8,6);
    if (appendage==='braid'&&!pose.bodyFrame&&direction !== 0) draw(view, 3, attachment(pose.head, -pose.forward.x * 6, -8, headAngle), 4.6, 29, headAngle + pose.braidSway);
    if(pose.bodyFrame)bodySurface(0,'head',pose.sideView?(dimensions.headSideWidth??16.4):(dimensions.headWidth??17.4),dimensions.headHeight??23,.5,.91,-5);
    else draw(view, 0, attachment(pose.head, 0, 5, headAngle), pose.sideView ? (dimensions.headSideWidth??16.4) : (dimensions.headWidth??17.4), dimensions.headHeight??23, headAngle, .5, .91);
    if (appendage==='braid'&&!pose.bodyFrame&&direction === 0) draw(view, 3, attachment(pose.head, 7, -7, headAngle), 3.8, 26, headAngle + pose.braidSway);
    if (direction === 0) { drawCargo();drawArmAssembly(true);drawArmAssembly(false); }
    else if (pose.sideView) { drawCargo();drawArmAssembly(!farLeft); }
    if(pose.mount&&direction===0)mountFront();
    drawReins();
    if(pose.droppedToolFrame)drawCharacterEquipment(ctx,pose.droppedToolFrame,direction);
    else if (state === 'death'&&!pose.bodyFrame) {
      const p = clamp(time / action.duration);
      const drop = smooth(clamp(p * 1.8));
      draw('props', 0, point(mix(pose.sign * 15, -pose.sign * 10, drop), mix(-34, 7, drop) - Math.sin(drop * Math.PI) * 8), 13, 33, Math.PI - pose.sign * drop * Math.PI / 2, .24, .85, null, direction===2||direction===3);
    }
    ctx.restore();
    return true;
  }
}

export function drawHearthkinWard(ctx, unit, anchor, size, time, behind = false, reducedMotion = false) {
  if (!(unit.lastLightWardTimer > 0)) return;
  const impact = clamp((unit.wardBlockedPulse ?? 0) / .42);
  const breathe = reducedMotion ? 0 : Math.sin(time * .0028 + (unit.id ?? 0)) * .015;
  const x = anchor.x, y = anchor.y - size * .48, rx = size * (.39 + breathe + impact * .035), ry = size * .59;
  ctx.save();
  if (behind) {
    const glow = ctx.createRadialGradient(x, y, size * .12, x, y, size * .63);
    glow.addColorStop(0, 'rgba(255,232,159,0)');
    glow.addColorStop(.66, `rgba(239,195,97,${.025 + impact * .045})`);
    glow.addColorStop(.88, `rgba(255,221,143,${.11 + impact * .17})`);
    glow.addColorStop(1, 'rgba(255,232,159,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(x, y, rx * 1.2, ry * 1.1, 0, 0, TAU); ctx.fill();
  } else {
    ctx.strokeStyle = `rgba(255,231,163,${.46 + impact * .43})`;
    ctx.lineWidth = Math.max(.8, size * .009);
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, -.2, Math.PI * .97); ctx.stroke();
    ctx.strokeStyle = `rgba(255,246,207,${.23 + impact * .5})`;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, Math.PI * 1.07, TAU - .36); ctx.stroke();
    ctx.strokeStyle = `rgba(239,211,131,${.24 + impact * .35})`;
    ctx.beginPath(); ctx.ellipse(x, anchor.y + size * .01, rx * .79, size * .095, 0, 0, TAU); ctx.stroke();
    if (!reducedMotion && size > 26) {
      ctx.fillStyle = '#fff1c1';
      for (let i = 0; i < 5; i++) {
        const a = time * .0003 + i * TAU / 5;
        const px = x + Math.cos(a) * rx, py = y + Math.sin(a) * ry;
        ctx.globalAlpha = .3 + .2 * Math.sin(a * 2);
        ctx.beginPath(); ctx.arc(px, py, Math.max(.6, size * .012), 0, TAU); ctx.fill();
      }
    }
  }
  ctx.restore();
}
