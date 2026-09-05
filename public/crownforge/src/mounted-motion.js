import { UNIT_TYPES } from './config.js';
import { projectHearthkin, solveAnatomicalLimb } from './hearthkin-locomotion.js';

const TAU=Math.PI*2;
const v=(x=0,y=0,z=0)=>({x,y,z});
const add=(a,b)=>v(a.x+b.x,a.y+b.y,a.z+b.z);
const sub=(a,b)=>v(a.x-b.x,a.y-b.y,a.z-b.z);
const mul=(a,n)=>v(a.x*n,a.y*n,a.z*n);
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const length=a=>Math.hypot(a.x,a.y,a.z);
const normal=a=>mul(a,1/Math.max(1e-9,length(a)));
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const mix=(a,b,t)=>a+(b-a)*t;
const blend=(a,b,t)=>v(mix(a.x,b.x,t),mix(a.y,b.y,t),mix(a.z,b.z,t));
const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
const fraction=t=>((t%1)+1)%1;
const interpolate=(a,b,t)=>typeof a==='number'?mix(a,b,t):blend(a,b,t);

export const MOUNTED_PROFILES=Object.freeze({
  scout:Object.freeze({walk:1.32,stride:13.3,lift:3.8,width:7,barrelHeight:50,weight:1,toolScale:1.8,toolGrip:.62,shieldWidth:21,shieldHeight:23}),
  ashenOutrider:Object.freeze({walk:1.46,stride:11.9,lift:3.3,width:7.6,barrelHeight:49.5,weight:1.17,toolScale:1.9,toolGrip:.62,shieldWidth:22,shieldHeight:24}),
});
export const MOUNTED_TYPES=Object.freeze(Object.keys(MOUNTED_PROFILES));

// Suggested 4×5 source sheet. The horse uses 18 articulated anatomy parts,
// plus mane and saddle. Each view must be independently authored. Hind
// stifle → hock and hock → fetlock are separate bones, not one bent sprite.
export const MOUNT_PART_BINDINGS=Object.freeze([
  {index:0,name:'head',root:'poll',tip:'muzzle'},
  {index:1,name:'neck',root:'neckRoot',tip:'poll'},
  {index:2,name:'barrel',root:'barrel',frame:'bodyFrame'},
  {index:3,name:'tail',root:'tailRoot',tip:'tailTip'},
  {index:4,name:'upperFrontLeft',root:'frontLeftShoulder',tip:'frontLeftKnee'},
  {index:5,name:'upperFrontRight',root:'frontRightShoulder',tip:'frontRightKnee'},
  {index:6,name:'upperHindLeft',root:'hindLeftHip',tip:'hindLeftStifle'},
  {index:7,name:'upperHindRight',root:'hindRightHip',tip:'hindRightStifle'},
  {index:8,name:'lowerFrontLeft',root:'frontLeftKnee',tip:'frontLeftFetlock'},
  {index:9,name:'lowerFrontRight',root:'frontRightKnee',tip:'frontRightFetlock'},
  {index:10,name:'hindShankLeft',root:'hindLeftStifle',tip:'hindLeftHock'},
  {index:11,name:'hindShankRight',root:'hindRightStifle',tip:'hindRightHock'},
  {index:12,name:'hindCannonLeft',root:'hindLeftHock',tip:'hindLeftFetlock'},
  {index:13,name:'hindCannonRight',root:'hindRightHock',tip:'hindRightFetlock'},
  {index:14,name:'hoofFrontLeft',root:'frontLeftFetlock',tip:'frontLeftHoof'},
  {index:15,name:'hoofFrontRight',root:'frontRightFetlock',tip:'frontRightHoof'},
  {index:16,name:'hoofHindLeft',root:'hindLeftFetlock',tip:'hindLeftHoof'},
  {index:17,name:'hoofHindRight',root:'hindRightFetlock',tip:'hindRightHoof'},
  {index:18,name:'mane',root:'neckRoot',tip:'poll'},
  {index:19,name:'saddle',root:'saddle',frame:'bodyFrame'},
].map(Object.freeze));

const LEG_ORDER=Object.freeze(['frontLeft','frontRight','hindLeft','hindRight']);
// Landing order is hind-left, fore-left, hind-right, fore-right. A walk is
// four successive beats, never the diagonal simultaneous pairs of a trot.
const CONTACT_TIME=Object.freeze({hindLeft:0,frontLeft:.25,hindRight:.5,frontRight:.75});
const STANCE=.74;

function profileFor(type) {
  if(!MOUNTED_PROFILES[type])throw new RangeError(`No mounted character rig is defined for ${type}`);
  return MOUNTED_PROFILES[type];
}

export function mountedActions(type) {
  const profile=profileFor(type),blueprint=UNIT_TYPES[type];
  const timing=blueprint.attackTiming??{anticipation:.25,contact:.45,recovery:.3};
  const anticipation=blueprint.cooldown*timing.anticipation,contact=blueprint.cooldown*timing.contact,recovery=blueprint.cooldown*timing.recovery;
  const duration=anticipation+contact+recovery;
  return {
    idle:{label:'At ease',duration:4.2,loop:true},walk:{label:'Walking',duration:profile.walk,loop:true,footsteps:[0,.25,.5,.75]},
    attack:{label:'Attacking',duration,loop:true,contact:(anticipation+contact*.2)/duration},
    attack_anticipation:{label:'Attack · wind-up',duration:anticipation,loop:false},attack_contact:{label:'Attack · strike',duration:contact,loop:false,contact:.2},attack_recovery:{label:'Attack · recovery',duration:recovery,loop:false},
    hit:{label:'Taking a hit',duration:.34,loop:false},stunned:{label:'Stunned',duration:2.6,loop:true},death:{label:'Falling',duration:2.15+profile.weight*.12,loop:false},
  };
}

function attackClock(state,time,actions) {
  const a=actions.attack_anticipation.duration,c=actions.attack_contact.duration,r=actions.attack_recovery.duration;
  const local=state==='attack'?fraction(time/(a+c+r))*(a+c+r):clamp(time,0,actions[state].duration);
  return {time:state==='attack_contact'?a+local:state==='attack_recovery'?a+c+local:local,wind:a,hit:a+c*.2,settle:a+c,total:a+c+r};
}

function strike(clock,ready,raised,contact,settled=contact) {
  const t=clock.time;
  if(t<=clock.wind)return interpolate(ready,raised,ease(t/clock.wind));
  if(t<=clock.hit)return interpolate(raised,contact,ease((t-clock.wind)/(clock.hit-clock.wind)));
  if(t<=clock.settle)return interpolate(contact,settled,ease((t-clock.hit)/(clock.settle-clock.hit)));
  return interpolate(settled,ready,ease((t-clock.settle)/(clock.total-clock.settle)));
}

function bodyAxes(roll=0,pitch=0) {
  return {
    right:v(Math.cos(roll),Math.sin(roll),0),
    up:v(-Math.sin(roll)*Math.cos(pitch),Math.cos(roll)*Math.cos(pitch),Math.sin(pitch)),
    forward:v(Math.sin(roll)*Math.sin(pitch),-Math.cos(roll)*Math.sin(pitch),Math.cos(pitch)),
  };
}
const vectorIn=(frame,p)=>add(mul(frame.right,p.x),add(mul(frame.up,p.y),mul(frame.forward,p.z)));
const pointIn=(origin,frame,p)=>add(origin,vectorIn(frame,p));

function hoofCycle(cycle,leg,profile,walking) {
  const phase=fraction(cycle-CONTACT_TIME[leg]);
  if(!walking)return {phase,travel:0,lift:0,planted:true,pitch:0};
  const planted=phase<STANCE,q=planted?phase/STANCE:(phase-STANCE)/(1-STANCE);
  const tangent=-2*(1-STANCE)/STANCE;
  const travel=planted?mix(1,-1,q):-1+2*ease(q)+tangent*(2*q*q*q-3*q*q+q);
  const lift=planted?0:profile.lift*Math.sin(q*Math.PI)**1.5*(1.13-.26*q);
  const pitch=planted?(q<.14?.09*(1-ease(q/.14)):q>.82?-.2*ease((q-.82)/.18):0):mix(-.2,.09,ease(q));
  return {phase,travel:travel*profile.stride,lift,planted,pitch};
}

function solveArm(joints,side,palm,pole) {
  const root=joints[side+'Shoulder'];
  // Forearm and palm are collinear. Solve directly to the grip using their
  // combined length, then recover the wrist along that same bone. Iterating
  // a wrist target is unstable in a folded windup close to the shoulder.
  const reach=sub(palm,root),distance=length(reach);
  const target=add(root,mul(distance>1e-8?normal(reach):v(0,-1,0),clamp(distance,2.66,36.64)));
  const elbow=solveAnatomicalLimb(root,target,17,19.65,pole);
  const wrist=add(elbow,mul(sub(target,elbow),16/19.65));
  joints[side+'Hand']=wrist;joints[side+'Elbow']=elbow;
  joints[side+'Palm']=target;
}

/**
 * Anatomical horse plus seated human rider, in common actor coordinates:
 * x=right, y=up, z=forward. time is seconds in the requested action. A caller
 * may scale the walk clock by real movement; moving:false stops hoof cycles.
 *
 * Top-level anatomical/projected fields describe the RIDER and satisfy the
 * existing hand/surface attachment contract. mount.anatomical contains the
 * horse joints named in MOUNT_PART_BINDINGS; mount.projected mirrors those
 * keys. mount.legs identifies support, fetlock/hoof pose and ground contact.
 * mountGroundContacts are actual world/projected hoof contact points, with
 * y=0 for planted supports. Rider feet attach to mount.stirrups, not ground.
 * bodyFrame and mount.bodyFrame orient art independently during collapse.
 */
export function mountedPose(type,state='idle',time=0,direction=0,options={}) {
  const profile=profileFor(type),actions=mountedActions(type),action=actions[state];
  if(!action)throw new RangeError(`${type} has no mounted action ${state}`);
  direction=clamp(Math.round(Number.isFinite(direction)?direction:0),0,3);
  const sampleTime=action.loop?Math.max(0,Number.isFinite(time)?time:0):clamp(Number.isFinite(time)?time:0,0,action.duration);
  const phase=action.loop?fraction(sampleTime/action.duration):clamp(sampleTime/action.duration);
  const walking=state==='walk'&&options.moving!==false&&(!Number.isFinite(options.motionSpeed)||options.motionSpeed>.025);
  const attacking=state==='attack'||state.startsWith('attack_');
  const clock=attacking?attackClock(state,sampleTime,actions):null;
  const wave=walking?Math.sin(phase*TAU):0;
  const breath=attacking||state==='death'||walking?0:Math.sin(phase*TAU+(options.id??0)*.53)*.22;
  let barrelDrop=0,fall=0,roll=walking?wave*.009:0,pitch=walking?Math.sin(phase*TAU*2)*.012:0;
  let riderLean=0,riderHeadTilt=0,brace=0;
  if(attacking) {
    brace=strike(clock,0,.25,1,.6);barrelDrop=brace*.35;
    riderLean=strike(clock,0,-.025,.13,.09);
  } else if(state==='hit') {
    const recoil=Math.sin(phase*Math.PI);barrelDrop=recoil*.7;pitch=-recoil*.028;riderLean=-recoil*.12;riderHeadTilt=-recoil*.1;
  } else if(state==='stunned') {
    barrelDrop=.6;pitch=.025;roll=Math.sin(phase*TAU)*.009;riderLean=.12+Math.sin(phase*TAU)*.018;riderHeadTilt=.13;
  } else if(state==='death') {
    const buckle=ease((phase-.03)/.3);
    fall=ease((phase-.28)/.5);barrelDrop=buckle*15+fall*(profile.barrelHeight-31.5);
    roll=fall*Math.PI/2;pitch=0;riderLean=0;
  }
  const horseFrame=bodyAxes(roll,pitch);
  const barrel=v(state==='death'?-6*fall:0,profile.barrelHeight-barrelDrop+(walking?Math.cos(phase*TAU*4)*.2/profile.weight:breath),0);
  const h={barrel};
  h.withers=pointIn(barrel,horseFrame,v(0,8,20));h.croup=pointIn(barrel,horseFrame,v(0,7,-22));
  h.chest=pointIn(barrel,horseFrame,v(0,-2,25));h.rump=pointIn(barrel,horseFrame,v(0,-1,-25));
  h.saddle=pointIn(barrel,horseFrame,v(0,12,-4));
  h.neckRoot=pointIn(barrel,horseFrame,v(0,5,18));
  const nod=walking?Math.sin(phase*TAU*2+.55)*.7:breath*.5;
  const neckDirection=normal(blend(vectorIn(horseFrame,v(0,21+nod,17)),v(-.55,-.22,.81),fall));
  h.poll=add(h.neckRoot,mul(neckDirection,26));
  const headDirection=normal(blend(vectorIn(horseFrame,v(0,-17,10)),v(-.12,-.15,.98),fall));
  h.muzzle=add(h.poll,mul(headDirection,18));h.head=blend(h.poll,h.muzzle,.42);
  h.bitLeft=add(h.muzzle,mul(horseFrame.right,-2.2));h.bitRight=add(h.muzzle,mul(horseFrame.right,2.2));
  h.tailRoot=pointIn(barrel,horseFrame,v(0,5,-28.5));
  const tailSway=attacking||state==='death'?0:walking?Math.sin(phase*TAU-.9)*2.4:Math.sin(phase*TAU)*.7;
  const tail=pointIn(h.tailRoot,horseFrame,v(tailSway,-33,-4.5));
  h.tailTip=blend(tail,v(-10,4,-48),fall);
  const legs={},groundContacts=[];
  for(const leg of LEG_ORDER) {
    const front=leg.startsWith('front'),left=leg.endsWith('Left'),sign=left?-1:1;
    const cycle=hoofCycle(phase,leg,profile,walking),z=front?23:-23;
    // Scapula/hip sit inside the barrel, with a small fore-aft excursion.
    // A low shoulder plus oversized bones produces a permanently crouched
    // horse even when every hoof is correctly planted.
    const root=pointIn(barrel,horseFrame,v(sign*profile.width,front?0:2,z+cycle.travel*(front?.35:.25)));
    let hoof=v(sign*profile.width,2+cycle.lift,z+cycle.travel);
    if(state==='death') {
      const target=front?(left?v(-18,2,42):v(17,2,32)):(left?v(-20,2,-35):v(13,2,-30));
      hoof=blend(hoof,target,fall);
    }
    const fetlock=add(hoof,v(0,6,-.6));
    h[leg+(front?'Shoulder':'Hip')]=root;h[leg+'Fetlock']=fetlock;h[leg+'Hoof']=hoof;
    if(front) {
      const pole=add(root,blend(vectorIn(horseFrame,v(sign*2,-8,22)),v(sign*16,8,16),fall));
      h[leg+'Knee']=solveAnatomicalLimb(root,fetlock,21.65,21.65,pole);
    } else {
      const hipAngle=mix(.46+(walking?cycle.travel/profile.stride*.045:0),1.15,fall);
      const stifle=add(root,vectorIn(horseFrame,v(0,-Math.cos(hipAngle)*17,Math.sin(hipAngle)*17)));
      const pole=add(stifle,blend(vectorIn(horseFrame,v(sign*1,-5,-23)),v(sign*15,8,-20),fall));
      h[leg+'Stifle']=stifle;h[leg+'Hock']=solveAnatomicalLimb(stifle,fetlock,17,17,pole);
    }
    const contact=add(hoof,v(0,-2,.8));
    legs[leg]={phase:cycle.phase,planted:walking?cycle.planted:true,lift:cycle.lift,pitch:cycle.pitch,hoof,fetlock,contact};
    groundContacts.push({leg,planted:legs[leg].planted,world:contact,point:projectHearthkin(contact,direction)});
  }

  // Horse proportions are larger than the human actor; only the horse
  // anatomy scales. The rider retains the infantry's body and bone lengths.
  const mountScale=1.45,scaled=new Set();
  const scalePoint=p=>{if(!scaled.has(p)){p.x*=mountScale;p.y*=mountScale;p.z*=mountScale;scaled.add(p);}};
  for(const p of Object.values(h))scalePoint(p);
  for(const leg of Object.values(legs)){for(const p of [leg.hoof,leg.fetlock,leg.contact])scalePoint(p);leg.lift*=mountScale;}
  for(const contact of groundContacts){scalePoint(contact.world);contact.point=projectHearthkin(contact.world,direction);}

  const riderFrame=bodyAxes(roll*(walking?.55:1),pitch*.35+riderLean);
  const j={hip:add(h.saddle,mul(horseFrame.up,4))};
  j.waist=add(j.hip,mul(riderFrame.up,3));j.neck=add(j.waist,mul(riderFrame.up,28));
  j.shoulder=blend(j.neck,j.waist,.2);j.head=add(j.neck,mul(riderFrame.up,1));
  const stirrups={
    left:pointIn(h.saddle,horseFrame,v(-20,-27,3)),
    right:pointIn(h.saddle,horseFrame,v(20,-27,3)),
  };
  const ready=v(20,20,9);
  let rightTarget=pointIn(j.hip,riderFrame,ready),leftTarget=pointIn(j.hip,riderFrame,v(-12,15,12));
  let angle=.14+(walking?wave*.018:0);
  if(attacking) {
    // Keep a real shoulder-to-grip interval while chambering the spear. A
    // palm almost on the shoulder makes the elbow whirl around a tiny axis.
    const target=strike(clock,ready,v(20,18,4),v(20,23,31),v(20,23,28));
    rightTarget=pointIn(j.hip,riderFrame,target);angle=strike(clock,.14,1.4,1.54,1.54);
    leftTarget=pointIn(j.hip,riderFrame,strike(clock,v(-12,15,12),v(-12,17,12),v(-12,17,14),v(-12,17,13)));
  } else if(state==='hit') {
    const recoil=Math.sin(phase*Math.PI);
    rightTarget=add(rightTarget,vectorIn(riderFrame,v(0,2*recoil,-4*recoil)));
    leftTarget=add(leftTarget,vectorIn(riderFrame,v(0,4*recoil,0)));
  } else if(state==='stunned') {
    rightTarget=add(rightTarget,vectorIn(riderFrame,v(0,-4,2)));leftTarget=add(leftTarget,vectorIn(riderFrame,v(0,-2,1)));
    angle+=.08+Math.sin(phase*TAU)*.025;
  } else if(state==='death') {
    rightTarget=blend(rightTarget,v(-42,11,23),fall);leftTarget=blend(leftTarget,v(-46,5,19),fall);
  }
  for(const [side,sign] of [['left',-1],['right',1]]) {
    j[side+'Shoulder']=add(j.shoulder,mul(riderFrame.right,sign*12));
    j[side+'Hip']=add(j.hip,mul(riderFrame.right,sign*4.4));j[side+'Ankle']=stirrups[side];
    const kneePole=add(j[side+'Hip'],blend(vectorIn(riderFrame,v(sign*24,-10,22)),v(6,10,18),fall));
    j[side+'Knee']=solveAnatomicalLimb(j[side+'Hip'],stirrups[side],19.8,19.8,kneePole);
    const pole=add(j[side+'Shoulder'],blend(vectorIn(riderFrame,v(sign*4,-25,-4)),v(sign*18,10,12),fall));
    solveArm(j,side,side==='right'?rightTarget:leftTarget,pole);
  }
  let toolFrame={tool:'spear',grip:j.rightPalm,shaft:vectorIn(riderFrame,v(0,Math.cos(angle),Math.sin(angle))),edge:vectorIn(riderFrame,v(0,-Math.sin(angle),Math.cos(angle))),scale:.95,length:33*profile.toolScale*mountScale,gripFraction:profile.toolGrip,hand:'right'};
  let droppedToolFrame=null;
  const releasePhase=.2;
  if(state==='death'&&phase>=releasePhase&&!options.releaseSample) {
    const release=mountedPose(type,'death',action.duration*releasePhase,direction,{...options,releaseSample:true});
    const progress=ease((phase-releasePhase)/.56),turn=ease(Math.min(1,progress*1.7));
    const grip=blend(release.toolFrame.grip,v(23,profile.toolScale*3.3,24),progress);grip.y+=Math.sin(progress*Math.PI)*4;
    const shaft=normal(blend(release.toolFrame.shaft,normal(v(.92,0,.39)),turn));
    const candidate=normal(blend(release.toolFrame.edge,v(0,1,0),turn));
    const edge=normal(sub(candidate,mul(shaft,dot(candidate,shaft))));
    droppedToolFrame={...release.toolFrame,grip,shaft,edge,detached:true,releasePhase};toolFrame=null;
  }
  const guard=attacking?strike(clock,0,1,1,.8):0;
  const shieldNormal=normal(blend(vectorIn(riderFrame,normal(v(mix(-.55,-.18,guard),.06,mix(.83,.98,guard)))),v(0,1,0),fall));
  const nominalUp=normal(blend(riderFrame.up,v(0,0,1),fall));
  const shieldUp=normal(sub(nominalUp,mul(shieldNormal,dot(nominalUp,shieldNormal))));
  const shieldFrame={grip:j.leftPalm,normal:shieldNormal,up:shieldUp,width:profile.shieldWidth,height:profile.shieldHeight,shape:'round',attachment:'left-hand',hand:'left'};
  const reins={hand:'left',released:state==='death'&&phase>.55};
  for(const side of ['Left','Right']) {
    const hand=reins.released?blend(j.leftPalm,add(h.muzzle,v(-6,-4,-10)),ease((phase-.55)/.17)):j.leftPalm;
    const bit=h['bit'+side],middle=add(blend(hand,bit,.55),v(0,-3,0));
    reins[side.toLowerCase()]=[hand,middle,bit];
  }
  const projected=Object.fromEntries(Object.entries(j).filter(([key])=>!key.endsWith('Ankle')).map(([key,p])=>[key,projectHearthkin(p,direction)]));
  const mountProjected=Object.fromEntries(Object.entries(h).map(([key,p])=>[key,projectHearthkin(p,direction)]));
  const projectedShaft=projectHearthkin((toolFrame??droppedToolFrame).shaft,direction);
  return {
    type,state,phase,duration:action.duration,direction,sideView:direction===1||direction===3,sign:direction===0||direction===3?-1:1,
    forward:[v(0,1),v(1,0),v(0,-1),v(-1,0)][direction],anatomical:j,projectedLocomotion:true,projectedWork:true,...projected,
    leftFoot:{point:projectHearthkin(j.leftAnkle,direction),angle:0,planted:false,lift:0,attachment:'stirrup'},
    rightFoot:{point:projectHearthkin(j.rightAnkle,direction),angle:0,planted:false,lift:0,attachment:'stirrup'},
    walking,carrying:false,cargo:null,fall,headTilt:riderHeadTilt,bodyFrame:riderFrame,
    tool:toolFrame?'spear':null,toolFrame,droppedToolFrame,toolHand:'right',toolScale:profile.toolScale,toolGrip:profile.toolGrip,
    toolAngle:Math.atan2(projectedShaft.y,projectedShaft.x)+Math.PI/2,shieldFrame,reins,
    clothSway:state==='death'||attacking?0:walking?Math.sin(phase*TAU-.6)*.018:Math.sin(phase*TAU)*.004,
    braidSway:state==='death'||attacking?0:Math.sin(phase*TAU-.8)*(walking?.025:.005),
    attackClock:clock,contactPhase:actions.attack.contact,releasePhase:state==='death'?releasePhase:null,
    mount:{scale:mountScale,anatomical:h,projected:mountProjected,bodyFrame:horseFrame,legs,stirrups,saddle:h.saddle,seat:j.hip,fall,partBindings:MOUNT_PART_BINDINGS,legOrder:LEG_ORDER},
    mountGroundContacts:groundContacts,
  };
}
