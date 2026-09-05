import { hearthkinLocomotion, projectHearthkin, solveAnatomicalLimb } from './hearthkin-locomotion.js';

const v=(x,y,z=0)=>({x,y,z});
const add=(a,b)=>v(a.x+b.x,a.y+b.y,a.z+b.z);
const sub=(a,b)=>v(a.x-b.x,a.y-b.y,a.z-b.z);
const mul=(a,n)=>v(a.x*n,a.y*n,a.z*n);
const length=a=>Math.hypot(a.x,a.y,a.z);
const normal=a=>mul(a,1/Math.max(1e-8,length(a)));
const mix=(a,b,t)=>a+(b-a)*t;
const blend=(a,b,t)=>v(mix(a.x,b.x,t),mix(a.y,b.y,t),mix(a.z,b.z,t));
const clamp=n=>Math.max(0,Math.min(1,n));
const ease=n=>{n=clamp(n);return n*n*(3-2*n);};

// All these coordinates belong to the actor, never to a camera direction.
// The right wrist, grip, tool head and contact target describe one action
// that the four views observe. A rear view cannot invent a different swing.
function keyStroke(phase,ready,raised,contact,wind=.4,hit=.6) {
  if(phase<wind)return typeof ready==='number'?mix(ready,raised,ease(phase/wind)):blend(ready,raised,ease(phase/wind));
  if(phase<hit)return typeof ready==='number'?mix(raised,contact,ease((phase-wind)/(hit-wind))):blend(raised,contact,ease((phase-wind)/(hit-wind)));
  return typeof ready==='number'?mix(contact,ready,ease((phase-hit)/(1-hit))):blend(contact,ready,ease((phase-hit)/(1-hit)));
}

export function anatomicalToolFrame(pose,angle=Math.PI+.12) {
  if(!pose.tool||!pose.anatomical)return null;
  const j=pose.anatomical;
  const grip=add(j.rightHand,mul(normal(sub(j.rightHand,j.rightElbow)),3.65));
  return {tool:pose.tool,grip,shaft:v(0,Math.cos(angle),Math.sin(angle)),edge:v(0,-Math.sin(angle),Math.cos(angle)),scale:pose.toolScale??1,gripFraction:pose.toolGrip??.8};
}

export function hearthkinWorkMotion(state,time,direction,{duration=1.2,id=0,phase:givenPhase}={}) {
  const phase=givenPhase??((time/duration)%1+1)%1;
  const idle=hearthkinLocomotion('idle',0,direction,{id,moving:false});
  const j=Object.fromEntries(Object.entries(idle.anatomical).map(([key,p])=>[key,{...p}]));
  let tool='axe',scale=1,gripFraction=.8,angle=Math.PI+.12;
  let rightGrip=null,leftGrip=null,lean=0,drop=0,cargo=null;
  const building=['construct','repair','demolish'].includes(state);
  const mining=['gather_stone','gather_gold'].includes(state);
  const chopping=state==='gather_wood';
  if(building||mining||chopping) {
    tool=building?'hammer':mining?'pick':'axe';
    scale=building?.82:mining?1.15:1.12;gripFraction=building?.82:.75;
    // A vertical-forward strike lands ahead of the actor. The right arm
    // stays in its own shoulder plane; a camera never pulls it sideways.
    rightGrip=keyStroke(phase,v(building?12:6,54,15),v(building?12:6,building?70:78,18),v(building?12:6,45,23));
    // Contact angles account for each head's offset from its shaft. A
    // long pick curves farther out than an axe and must stop rotating
    // earlier, otherwise its tip starts travelling backward before impact.
    angle=keyStroke(phase,.15,building?-.3:-.62,building?1.4:mining?1.1:1.3);
    lean=keyStroke(phase,2,.6,6);drop=keyStroke(phase,0,0,1.2);
    const shaft=v(0,Math.cos(angle),Math.sin(angle));
    leftGrip=building?v(-11,48,14):sub(rightGrip,mul(shaft,7.5));
  } else if(state==='field_work') {
    tool='hoe';scale=1.8;gripFraction=.8;
    // Reach with the blade lifted, lower it ahead of the feet, pull toward
    // the actor through the soil, and lift before returning forward.
    const extend=phase<.4?ease(phase/.4):phase<.7?1-ease((phase-.4)/.3):0;
    const recovery=(phase-.7+1)%1;
    const lift=recovery<.7?5*Math.sin(recovery/.7*Math.PI)**2:0;
    angle=2.57+extend*.16;
    const shaft=v(0,Math.cos(angle),Math.sin(angle));
    const head=v(5,Math.sin(angle)*6.2*scale+lift,46+extend*6);
    rightGrip=sub(head,mul(shaft,33*scale*gripFraction));
    leftGrip=sub(rightGrip,mul(shaft,8));
    lean=7+extend*3;drop=4+extend;
  } else if(state==='gather_food') {
    tool=null;cargo='empty';
    const reach=.5-.5*Math.cos(phase*Math.PI*2);
    rightGrip=v(9,36+reach*3,15+reach*12);
    leftGrip=v(-8,38,12);lean=7+reach*5;drop=5;
  } else if(state.startsWith('attack')) {
    let p=phase;
    if(state==='attack_anticipation')p=phase*.2;
    else if(state==='attack_contact')p=.2+phase*.46;
    else if(state==='attack_recovery')p=.66+phase*.34;
    rightGrip=keyStroke(p,v(10,52,16),v(11,75,18),v(10,47,28),.2,.292);
    leftGrip=v(-11,54,14);
    angle=keyStroke(p,.3,-.45,1.7,.2,.292);scale=1.05;gripFraction=.82;
    lean=keyStroke(p,2,0,6,.2,.292);
  } else if(state==='ward_block') {
    const impact=Math.sin(clamp(phase)*Math.PI);
    leftGrip=v(-10,63,17-impact*3);rightGrip=v(12,39,5);
    lean=-impact*2;drop=impact;
  } else if(state==='hit') {
    const impact=Math.sin(clamp(phase)*Math.PI);
    lean=-impact*5;drop=impact*1.5;
  } else if(state==='stunned') {
    lean=7+Math.sin(phase*Math.PI*2)*1.1;drop=3;
    rightGrip=v(13,37,7);leftGrip=v(-13,39,5);
  } else return null;

  j.hip.y-=drop;j.waist.y-=drop;
  j.neck.y-=drop+Math.abs(lean)*.12;j.neck.z+=lean;
  j.shoulder=blend(j.neck,j.waist,.2);
  j.head=add(j.neck,v(0,1,Math.max(0,lean)*.1));
  for(const [side,sign] of [['left',-1],['right',1]]) {
    j[side+'Shoulder']=add(j.shoulder,v(sign*12,0,0));
    j[side+'Hip']=add(j.hip,v(sign*4.4,0,0));
    j[side+'Knee']=solveAnatomicalLimb(j[side+'Hip'],j[side+'Ankle'],19.8,19.8,add(j[side+'Hip'],v(0,-14,25)));
    const root=j[side+'Shoulder'];
    const pole=add(root,v(sign*3,-25,-4));
    const grip=side==='left'?leftGrip:rightGrip;
    if(grip) {
      // Solve the collinear forearm and palm as one link. This avoids an
      // iterative wrist solution changing elbow branches near the shoulder.
      const reach=sub(grip,root),distance=length(reach);
      const target=add(root,mul(normal(reach),Math.max(2.66,Math.min(36.64,distance))));
      const elbow=solveAnatomicalLimb(root,target,17,19.65,pole);
      j[side+'Elbow']=elbow;
      j[side+'Hand']=add(elbow,mul(sub(target,elbow),16/19.65));
      j[side+'Palm']=target;
    } else {
      const wrist=add(idle.anatomical[side+'Hand'],v(0,-drop,lean*.3));
      j[side+'Hand']=wrist;
      j[side+'Elbow']=solveAnatomicalLimb(root,wrist,17,16,pole);
      j[side+'Palm']=add(wrist,mul(normal(sub(wrist,j[side+'Elbow'])),3.65));
    }
  }
  const result={anatomical:j,projectedLocomotion:true,projectedWork:true,tool,toolScale:scale,toolGrip:gripFraction,cargo,clothSway:0,braidSway:Math.sin(phase*Math.PI*2-.8)*.016,headTilt:0};
  for(const [key,p] of Object.entries(j))if(!key.endsWith('Ankle'))result[key]=projectHearthkin(p,direction);
  for(const side of ['left','right'])result[side+'Foot']={point:projectHearthkin(j[side+'Ankle'],direction),angle:0,planted:true,lift:0};
  result.toolFrame=anatomicalToolFrame(result,angle);
  // Legacy consumers may inspect the projected shaft angle, but it never
  // determines either the 3D swing or which face of a tool is visible.
  if(result.toolFrame) {
    const a=projectHearthkin(result.toolFrame.grip,direction),b=projectHearthkin(add(result.toolFrame.grip,result.toolFrame.shaft),direction);
    result.toolAngle=Math.atan2(b.y-a.y,b.x-a.x)+Math.PI/2;
  }
  return result;
}
