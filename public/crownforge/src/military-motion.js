import { UNIT_TYPES } from './config.js';
import { hearthkinLocomotion, projectHearthkin, solveAnatomicalLimb } from './hearthkin-locomotion.js';

// Pure actor-space motion. A facing selects a camera projection; it cannot
// change the physical arm, shield hand, weapon direction or contact point.
const TAU=Math.PI*2;
const v=(x=0,y=0,z=0)=>({x,y,z});
const add=(a,b)=>v(a.x+b.x,a.y+b.y,a.z+b.z);
const sub=(a,b)=>v(a.x-b.x,a.y-b.y,a.z-b.z);
const mul=(a,n)=>v(a.x*n,a.y*n,a.z*n);
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a,b)=>v(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
const length=a=>Math.hypot(a.x,a.y,a.z);
const normal=a=>mul(a,1/Math.max(1e-9,length(a)));
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const mix=(a,b,t)=>a+(b-a)*t;
const blend=(a,b,t)=>v(mix(a.x,b.x,t),mix(a.y,b.y,t),mix(a.z,b.z,t));
const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
const fraction=t=>((t%1)+1)%1;
const interpolate=(a,b,t)=>typeof a==='number'?mix(a,b,t):blend(a,b,t);
const shield=(width,height,shape='round',attachment='left-hand')=>Object.freeze({width,height,shape,attachment});

export const MILITARY_PROFILES=Object.freeze({
  soldier:Object.freeze({tool:'spear',scale:2.1,grip:.62,shoulders:13,hips:4.8,stride:.88,lift:.88,walk:1.14,shield:shield(23,25),weight:1.05}),
  spearwarden:Object.freeze({tool:'spear',scale:2.35,grip:.63,shoulders:12.2,hips:4.7,stride:.81,lift:.84,walk:1.2,shield:shield(23,26),weight:1.1}),
  militia:Object.freeze({tool:'mace',scale:1.05,grip:.76,shoulders:11.7,hips:4.5,stride:.96,lift:.94,walk:1.08,shield:shield(21,23),weight:.85}),
  shieldbearer:Object.freeze({tool:'axe',scale:1.03,grip:.76,shoulders:13.6,hips:5,stride:.78,lift:.8,walk:1.23,shield:shield(29,33,'oval'),weight:1.2}),
  raider:Object.freeze({tool:'axe',scale:1.2,grip:.75,shoulders:14.5,hips:5.2,stride:.9,lift:.94,walk:1.15,shield:null,weight:1.12}),
  thornSpear:Object.freeze({tool:'spear',scale:2.25,grip:.63,shoulders:13.4,hips:4.9,stride:.83,lift:.86,walk:1.22,shield:shield(24,25,'round','back'),weight:1.08}),
  hearthLevy:Object.freeze({tool:'axe',scale:1.01,grip:.75,shoulders:12,hips:4.6,stride:.94,lift:.91,walk:1.1,shield:shield(22,24),weight:.9}),
  hidewall:Object.freeze({tool:'mace',scale:1.2,grip:.75,shoulders:15,hips:5.5,stride:.72,lift:.78,walk:1.3,shield:shield(29,44,'oval'),weight:1.3}),
});
export const FOOT_MILITARY_TYPES=Object.freeze(Object.keys(MILITARY_PROFILES));

function profileFor(type) {
  const profile=MILITARY_PROFILES[type];
  if(!profile)throw new RangeError(`No foot military rig is defined for ${type}`);
  return profile;
}

export function militaryActions(type) {
  const profile=profileFor(type),blueprint=UNIT_TYPES[type];
  const timing=blueprint.attackTiming??{anticipation:.25,contact:.45,recovery:.3};
  const anticipation=blueprint.cooldown*timing.anticipation;
  const contact=blueprint.cooldown*timing.contact;
  const recovery=blueprint.cooldown*timing.recovery;
  const total=anticipation+contact+recovery;
  return {
    idle:{label:'At ease',duration:3.8,loop:true},walk:{label:'Walking',duration:profile.walk,loop:true},
    attack:{label:'Attacking',duration:total,loop:true,contact:(anticipation+contact*.2)/total},
    attack_anticipation:{label:'Attack · wind-up',duration:anticipation,loop:false},
    attack_contact:{label:'Attack · strike',duration:contact,loop:false,contact:.2},
    attack_recovery:{label:'Attack · recovery',duration:recovery,loop:false},
    hit:{label:'Taking a hit',duration:.3,loop:false},stunned:{label:'Stunned',duration:2.4,loop:true},
    death:{label:'Falling',duration:1.65+profile.weight*.12,loop:false},
  };
}

function attackClock(state,time,actions) {
  const a=actions.attack_anticipation.duration,c=actions.attack_contact.duration,r=actions.attack_recovery.duration;
  const local=state==='attack'?fraction(time/(a+c+r))*(a+c+r):clamp(time,0,actions[state].duration);
  return {
    time:state==='attack_contact'?a+local:state==='attack_recovery'?a+c+local:local,
    wind:a,hit:a+c*.2,settle:a+c,total:a+c+r,
  };
}

// Rest, preparation, actual contact, follow-through and recovery are joined
// with zero endpoint velocity. The three simulation phase states sample
// exactly the same curve as the complete attack, including its seams.
function strikeValue(clock,ready,raised,contact,settled=contact) {
  const t=clock.time;
  if(t<=clock.wind)return interpolate(ready,raised,ease(t/clock.wind));
  if(t<=clock.hit)return interpolate(raised,contact,ease((t-clock.wind)/(clock.hit-clock.wind)));
  if(t<=clock.settle)return interpolate(contact,settled,ease((t-clock.hit)/(clock.settle-clock.hit)));
  return interpolate(settled,ready,ease((t-clock.settle)/(clock.total-clock.settle)));
}

function solveArm(joints,side,palm,pole) {
  const root=joints[side+'Shoulder'];
  // Solve to the actual grip with collinear forearm and palm, then recover
  // the wrist. Iterating a wrist target can jump branches during a collapse
  // when the requested grip passes close to the shoulder.
  const reach=sub(palm,root),distance=length(reach);
  const target=add(root,mul(distance>1e-8?normal(reach):v(0,-1,0),clamp(distance,2.66,36.64)));
  const elbow=solveAnatomicalLimb(root,target,17,19.65,pole);
  const wrist=add(elbow,mul(sub(target,elbow),16/19.65));
  joints[side+'Elbow']=elbow;joints[side+'Hand']=wrist;
  joints[side+'Palm']=target;
}

function equipmentFrame(profile,grip,angle) {
  return {tool:profile.tool,grip,shaft:v(0,Math.cos(angle),Math.sin(angle)),edge:v(0,-Math.sin(angle),Math.cos(angle)),scale:profile.tool==='spear'?.95:profile.scale,length:33*profile.scale,gripFraction:profile.grip,hand:'right'};
}

function shieldFrame(profile,joints,guard,fall,bodyUp,bodyForward) {
  const definition=profile.shield;
  if(!definition)return null;
  if(definition.attachment==='back') {
    const normalVector=mul(bodyForward,-1);
    return {...definition,grip:add(blend(joints.waist,joints.neck,.56),mul(normalVector,6)),normal:normalVector,up:bodyUp,hand:null};
  }
  const normalVector=normal(blend(normal(v(mix(-.68,-.15,guard),.08,mix(.73,.99,guard))),v(0,1,0),fall));
  const nominalUp=normal(blend(v(0,1,0),v(0,0,1),fall));
  const up=normal(sub(nominalUp,mul(normalVector,dot(nominalUp,normalVector))));
  return {...definition,grip:joints.leftPalm,normal:normalVector,up,hand:'left'};
}

/**
 * Sample one of the eight foot military identities in anatomical space.
 * time is seconds in the requested action/phase; callers own movement-rate
 * scaling. moving:false plants the feet. This function does not mutate the
 * simulation or use browser, image, random, or wall-clock state.
 *
 * toolFrame is the held weapon; droppedToolFrame becomes a separate world
 * object after the death release. Renderers must draw that detached frame
 * without applying a hand socket. bodyFrame supplies the torso's 3D axes.
 */
export function militaryPose(type,state='idle',time=0,direction=0,options={}) {
  const profile=options.profileOverride??profileFor(type),actions=militaryActions(type),action=actions[state];
  if(!action)throw new RangeError(`${type} has no military action ${state}`);
  direction=clamp(Math.round(Number.isFinite(direction)?direction:0),0,3);
  const safeTime=Math.max(0,Number.isFinite(time)?time:0);
  const sampleTime=action.loop?safeTime:Math.min(action.duration,safeTime);
  const phase=action.loop?fraction(sampleTime/action.duration):clamp(sampleTime/action.duration);
  const walking=state==='walk'&&options.moving!==false&&(!Number.isFinite(options.motionSpeed)||options.motionSpeed>.025);
  const attacking=state==='attack'||state.startsWith('attack_');
  const base=hearthkinLocomotion(walking?'walk':'idle',walking?sampleTime:0,direction,{duration:profile.walk,id:options.id??0,moving:walking});
  const j=Object.fromEntries(Object.entries(base.anatomical).map(([name,p])=>[name,{...p}]));
  const wave=walking?Math.sin(phase*TAU):0,contactWave=walking?Math.cos(phase*TAU):0;
  const breath=state==='death'||attacking||walking?0:Math.sin(phase*TAU+(options.id??0)*.63)*.18;
  let drop=0,lean=walking?.055:0,guard=attacking?1:0,bodyYaw=walking?wave*.028:0;
  let fall=0,headPitch=0;
  let rightPalm,leftPalm,angle;
  const spear=profile.tool==='spear';
  const readyRight=spear?v(profile.shoulders,54,10):v(profile.shoulders+.5,39+profile.scale*2.2,7);
  rightPalm=add(readyRight,v(walking?wave*.2:0,breath+Math.abs(wave)*.13,walking?contactWave*(spear?1.15:3):0));
  leftPalm=profile.shield?.attachment==='left-hand'
    ?v(-profile.shoulders,51+breath,12-contactWave*.7)
    :add(j.leftHand,v(-(profile.shoulders-12),-3,0));
  angle=spear?.13+wave*.025:-Math.PI+.12+wave*.055;

  let clock=null;
  if(attacking) {
    clock=attackClock(state,sampleTime,actions);
    const stroke=(ready,raised,hit,settled)=>strikeValue(clock,ready,raised,hit,settled);
    drop=stroke(0,.3,1.4,1);lean=stroke(0,-.035,.16,.12);
    bodyYaw=stroke(0,-.065,.085,.045);
    leftPalm=v(-profile.shoulders,54,17);
    if(spear) {
      // The spear lowers alongside the right shoulder, draws back, then
      // extends along the target line. It does not chop like an axe.
      rightPalm=stroke(readyRight,v(profile.shoulders,56,5),v(profile.shoulders,55,31),v(profile.shoulders,55,28));
      angle=stroke(.13,1.5,1.55,1.55);
    } else {
      const heavy=profile.tool==='mace';
      rightPalm=stroke(readyRight,v(profile.shoulders+.5,heavy?80:77,18),v(profile.shoulders+.5,heavy?47:46,28),v(profile.shoulders+.5,heavy?48:47,24));
      // Angles are unwrapped continuously from the hanging position,
      // through a rear/up wind-up and into a downward-forward blow.
      angle=stroke(-Math.PI+.12,heavy?-.28:-.48,heavy?1.45:1.27,heavy?1.37:1.2);
    }
  } else if(state==='hit') {
    const recoil=Math.sin(phase*Math.PI);
    drop=recoil*2.4;lean=-recoil*.15;headPitch=-recoil*.11;guard=recoil;
    rightPalm=add(rightPalm,v(recoil*1.5,recoil*2,-recoil*4));
    leftPalm=add(leftPalm,v(0,recoil*5,recoil*2));
  } else if(state==='stunned') {
    const sway=Math.sin(phase*TAU);
    drop=3.2;lean=.12+sway*.018;headPitch=.13+sway*.025;
    rightPalm=add(rightPalm,v(sway*.45,-1.5,2));
    leftPalm=add(leftPalm,v(0,-2,1));
    angle+=sway*.025;
  } else if(state==='death') {
    // Knees give way before the upper body lands. Neck/hips/feet/hands
    // travel separately; there is no rotation of the completed sprite.
    const buckle=ease((phase-.04)/.34),settle=ease((phase-.3)/.55);
    fall=settle;drop=buckle*14+settle*21;
    lean=buckle*.32+settle*1.16;headPitch=settle*.04;
    j.hip.x=mix(0,-8,settle);j.hip.z=mix(0,-8,settle);
    rightPalm=blend(readyRight,v(10,5,34),settle);
    leftPalm=blend(leftPalm,v(-17,5,24),settle);
    angle=mix(angle,spear?1.4:2.7,buckle);
  }

  j.hip.y=43.35-drop+(walking?base.anatomical.hip.y-43.35:0);
  const up=v(Math.sin(bodyYaw)*Math.sin(lean),Math.cos(lean),Math.cos(bodyYaw)*Math.sin(lean));
  const forward=v(Math.sin(bodyYaw)*Math.cos(lean),-Math.sin(lean),Math.cos(bodyYaw)*Math.cos(lean));
  const right=v(Math.cos(bodyYaw),0,-Math.sin(bodyYaw));
  j.waist=add(j.hip,mul(up,3));j.neck=add(j.waist,mul(up,28+breath));
  j.shoulder=blend(j.neck,j.waist,.2);j.head=add(j.neck,mul(up,1));
  for(const [side,sign] of [['left',-1],['right',1]]) {
    j[side+'Shoulder']=add(j.shoulder,mul(right,sign*profile.shoulders));
    j[side+'Hip']=add(j.hip,v(sign*profile.hips,0,0));
    const baseFoot=base[side+'Foot'];
    let ankle=v(sign*profile.hips,6+(walking?baseFoot.lift*profile.lift:0),walking?j[side+'Ankle'].z*profile.stride:(attacking?-sign*5:-sign*1.8));
    if(state==='death')ankle=blend(ankle,side==='left'?v(-13,5,-37):v(2,5,-30),fall);
    j[side+'Ankle']=ankle;
    const kneePole=add(j[side+'Hip'],blend(v(0,-14,25),v(sign*20,0,-15),fall));
    j[side+'Knee']=solveAnatomicalLimb(j[side+'Hip'],ankle,19.8,19.8,kneePole);
    const palm=side==='right'?rightPalm:leftPalm;
    const armPole=add(j[side+'Shoulder'],blend(v(sign*4,-25,-4),v(sign*20,0,12),fall));
    solveArm(j,side,palm,armPole);
  }

  const footFrames={};
  for(const side of ['left','right']) {
    const original=base[side+'Foot'];
    footFrames[side+'Foot']={point:projectHearthkin(j[side+'Ankle'],direction),angle:walking?original.angle:0,planted:walking?original.planted:true,lift:walking?original.lift*profile.lift:0};
  }
  let toolFrame=equipmentFrame(profile,j.rightPalm,angle),droppedToolFrame=null;
  const releasePhase=.24;
  if(state==='death'&&phase>=releasePhase&&!options.releaseSample) {
    // Sample the actual release grip once in action time, then let the
    // weapon fall independently. Flatten it before ground contact.
    const release=militaryPose(type,'death',action.duration*releasePhase,direction,{...options,releaseSample:true});
    const progress=ease((phase-releasePhase)/.52),turn=ease(Math.min(1,progress*1.65));
    const restHeight=Math.max(4,profile.scale*3.3);
    const dropGrip=blend(release.toolFrame.grip,v(profile.shoulders+12,restHeight,25),progress);
    dropGrip.y+=Math.sin(progress*Math.PI)*4;
    const shaft=normal(blend(release.toolFrame.shaft,normal(v(.94,0,.34)),turn));
    const edgeCandidate=normal(blend(release.toolFrame.edge,v(0,1,0),turn));
    const edge=normal(sub(edgeCandidate,mul(shaft,dot(edgeCandidate,shaft))));
    droppedToolFrame={...release.toolFrame,grip:dropGrip,shaft,edge,detached:true,releasePhase};
    toolFrame=null;
  }
  const projected=Object.fromEntries(Object.entries(j).filter(([key])=>!key.endsWith('Ankle')).map(([key,p])=>[key,projectHearthkin(p,direction)]));
  const sideView=direction===1||direction===3;
  const sign=direction===0||direction===3?-1:1;
  const projectedTool=toolFrame??droppedToolFrame;
  const shaftDirection=projectedTool?projectHearthkin(projectedTool.shaft,direction):v();
  return {
    type,state,phase,duration:action.duration,direction,sideView,sign,forward:[v(0,1),v(1,0),v(0,-1),v(-1,0)][direction],
    anatomical:j,projectedLocomotion:true,projectedWork:true,...projected,...footFrames,
    walking,carrying:false,cargo:null,fall,headTilt:headPitch,
    tool:toolFrame?profile.tool:null,toolFrame,droppedToolFrame,toolHand:'right',toolScale:profile.scale,toolGrip:profile.grip,
    toolAngle:Math.atan2(shaftDirection.y,shaftDirection.x)+Math.PI/2,
    shieldFrame:shieldFrame(profile,j,guard,fall,up,forward),
    bodyFrame:{up,forward,right},
    clothSway:state==='death'||attacking?0:walking?wave*.014/profile.weight:Math.sin(phase*TAU)*.004,
    braidSway:state==='death'||attacking?0:walking?Math.sin(phase*TAU-.8)*.024:Math.sin(phase*TAU)*.006,
    attackClock:clock,contactPhase:actions.attack.contact,releasePhase:state==='death'?releasePhase:null,
  };
}
