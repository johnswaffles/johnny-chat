// Anatomical coordinates: x = the character's right, y = up, z = forward.
// Solve motion before projecting it: a foreshortened forearm must not become
// a sideways elbow just to preserve its length in the image plane.
const TAU = Math.PI * 2;
const rad = Math.PI / 180;
const mix = (a,b,t) => a+(b-a)*t;
const v = (x,y,z=0) => ({x,y,z});
const add = (a,b) => v(a.x+b.x,a.y+b.y,a.z+b.z);
const sub = (a,b) => v(a.x-b.x,a.y-b.y,a.z-b.z);
const mul = (a,n) => v(a.x*n,a.y*n,a.z*n);
const dot = (a,b) => a.x*b.x+a.y*b.y+a.z*b.z;
const length = a => Math.hypot(a.x,a.y,a.z);
const normal = a => mul(a,1/Math.max(.00001,length(a)));
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const ease = t => { t=clamp(t,0,1);return t*t*(3-2*t); };

export function projectHearthkin(p,direction) {
  const sin=.3420201433, cos=.9396926208;
  const horizontal=[-p.x,p.z,p.x,-p.z][direction];
  const depth=[p.z,p.x,-p.z,-p.x][direction];
  return {x:horizontal,y:-p.y*cos+depth*sin,depth:depth*cos+p.y*sin};
}

export function solveAnatomicalLimb(root,target,upper,lower,pole) {
  const vector=sub(target,root), distance=clamp(length(vector),Math.abs(upper-lower)+.001,upper+lower-.001);
  const axis=normal(vector);
  const projectedPole=sub(sub(pole,root),mul(axis,dot(sub(pole,root),axis)));
  const side=normal(projectedPole);
  const along=(upper*upper+distance*distance-lower*lower)/(2*distance);
  const height=Math.sqrt(Math.max(0,upper*upper-along*along));
  return add(root,add(mul(axis,along),mul(side,height)));
}

function footCycle(phase,stride) {
  const p=((phase%1)+1)%1;
  const planted=p<.62;
  const q=planted?p/.62:(p-.62)/.38;
  // Linear stance equals a planted foot on a translating body. The return
  // is a low, rear-weighted arc, not a high symmetrical marching step.
  const returnTangent=-2*.38/.62;
  const travel=planted?mix(1,-1,q):mix(-1,1,q*q*(3-2*q))+returnTangent*(2*q*q*q-3*q*q+q);
  const lift=planted?0:4.1*Math.pow(Math.sin(Math.PI*q),1.4)*(1.22-.62*q);
  const heel=planted?.12*(1-ease(q/.16)):0;
  const toe=planted?-.24*ease((q-.8)/.2):mix(-.24,.12,ease(q));
  return {z:travel*stride,lift,planted,angle:heel+toe,phase:p};
}

export function hearthkinLocomotion(state,time,direction,{duration=1.05,id=0,moving=true}={}) {
  const carrying=state.startsWith('carry_');
  const walking=moving&&(state==='walk'||carrying);
  const phase=((time/duration)%1+1)%1;
  const wave=Math.sin(phase*TAU), contact=Math.cos(phase*TAU);
  const step=carrying?8.5:10.5;
  const feet=[footCycle(phase,step),footCycle(phase+.5,step)];
  const sway=walking?wave*.48:0;
  // Low just after contact, high over the supporting leg at mid-stance.
  const rise=walking?-.48*Math.cos(phase*TAU*2-.55):0;
  const breath=walking?0:Math.sin(time*TAU/3.6+id*.63)*.15;
  const hip=v(sway,43.35+rise);
  const waist=add(hip,v(0,3));
  const neck=add(waist,v(-sway*.3,28+breath,walking?1.1:0));
  const shoulder=add(neck,mul(sub(waist,neck),.2));
  const head=add(neck,v(0,1));
  const joints={hip,waist,neck,shoulder,head};
  const shoulderTurn=walking?wave*.035:0;
  const hipTurn=walking?-wave*.035:0;
  for(const [index,name] of ['left','right'].entries()) {
    const sign=index===0?-1:1;
    const foot=feet[index];
    const shoulderJoint=add(shoulder,v(sign*12*Math.cos(shoulderTurn),0,-sign*12*Math.sin(shoulderTurn)));
    const hipJoint=add(hip,v(sign*4.4*Math.cos(hipTurn),0,-sign*4.4*Math.sin(hipTurn)));
    const ankle=v(sign*4.4,6+(walking?foot.lift:0),walking?foot.z:sign*1.2);
    const knee=solveAnatomicalLimb(hipJoint,ankle,19.8,19.8,add(hipJoint,v(0,-14,25)));
    let elbow,hand;
    if(carrying) {
      hand=v(sign*8.7,44.2+rise,13);
      elbow=solveAnatomicalLimb(shoulderJoint,hand,17,16,add(shoulderJoint,v(sign*4,-25,1)));
    } else {
      // Opposite arm and leg lead at contact. The elbow swings in the
      // sagittal plane; a loaded axe arm has a quieter arc than the free arm.
      const armWave=walking?sign*contact:0;
      const upperAngle=armWave*(index===1?.16:.24)-.015;
      const elbowFlex=(walking?14+4*Math.sin(phase*TAU+index*Math.PI-.25):12)*rad;
      const upperRadius=Math.sqrt(17*17-.65*.65), lowerRadius=Math.sqrt(16*16-.2*.2);
      elbow=add(shoulderJoint,v(sign*.65,-upperRadius*Math.cos(upperAngle),upperRadius*Math.sin(upperAngle)));
      const forearmAngle=upperAngle+elbowFlex;
      hand=add(elbow,v(sign*.2,-lowerRadius*Math.cos(forearmAngle),lowerRadius*Math.sin(forearmAngle)));
    }
    joints[name+'Shoulder']=shoulderJoint;joints[name+'Elbow']=elbow;joints[name+'Hand']=hand;
    joints[name+'Hip']=hipJoint;joints[name+'Knee']=knee;joints[name+'Ankle']=ankle;
  }
  const result={anatomical:joints,projectedLocomotion:true};
  for(const [key,p] of Object.entries(joints))if(!key.endsWith('Ankle'))result[key]=projectHearthkin(p,direction);
  for(const [index,name] of ['left','right'].entries()) {
    const facing=direction===1?1:direction===3?-1:0;
    result[name+'Foot']={point:projectHearthkin(joints[name+'Ankle'],direction),angle:walking?feet[index].angle*facing:0,planted:walking?feet[index].planted:true,lift:walking?feet[index].lift:0};
  }
  result.clothSway=walking?wave*.016:0;
  result.braidSway=walking?Math.sin(phase*TAU-.8)*.035:Math.sin(time*TAU/3.6)*.009;
  return result;
}
