import {projectHearthkin,solveAnatomicalLimb} from './hearthkin-locomotion.js';
import {fitHearthkinProfile} from './hearthkin-surface-fit.js?v=20260905-wristfit3';

const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const mul=(a,s)=>({x:a.x*s,y:a.y*s,z:a.z*s});
const length=a=>Math.hypot(a.x,a.y,a.z);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const fromProjection=(x,y,depth,direction)=>{
  const across=.3420201433*y+.9396926208*depth,up=-.9396926208*y+.3420201433*depth;
  return [{x:-x,y:up,z:across},{x:across,y:up,z:x},{x,y:up,z:-across},{x:-across,y:up,z:-x}][direction];
};

export function characterShoulderSocket(pose,definition) {
  const view=['front','right','back','left'][pose.direction];
  const anchor=definition.surfaceCalibration?.profileSockets[view];
  if(!anchor||!pose.anatomical)return null;
  const [u,v]=anchor,width=definition.dimensions?.torsoSide??20;
  if(pose.bodyFrame) {
    const f=pose.bodyFrame,sign=pose.direction===1?1:-1;
    return projectHearthkin(add(pose.anatomical.neck,add(mul(f.forward,(u-.5)*width*sign),mul(f.up,1-v*31))),pose.direction);
  }
  const height=Math.hypot(pose.waist.x-pose.neck.x,pose.waist.y-pose.neck.y)+3;
  const angle=Math.atan2(pose.waist.y-pose.neck.y,pose.waist.x-pose.neck.x)-Math.PI/2;
  const x=(u-.5)*width,y=v*height;
  return {x:pose.neck.x+x*Math.cos(angle)-y*Math.sin(angle),y:pose.neck.y-1+x*Math.sin(angle)+y*Math.cos(angle)};
}

// Art fitting is a final render step. Canonical motion, gameplay contacts,
// camera-independent animation and the approved Crown worker stay intact.
export function fitCharacterSurfaces(pose,definition) {
  if(definition.id==='villager')return fitHearthkinProfile(pose);
  if(!definition.surfaceCalibration||!pose.anatomical)return pose;
  const view=['front','right','back','left'][pose.direction];
  const j={...pose.anatomical},fixedPalms=!!pose.projectedWork;
  const result={...pose,anatomical:j,handFrames:definition.hands,surfaceFitted:true,surfacePalms:true};
  const deathGrips=new Set();
  const near=pose.direction===1?'right':'left';
  let socket=characterShoulderSocket(pose,definition);
  if(socket) {
    const root=projectHearthkin(j[near+'Shoulder'],pose.direction);
    let depthShift=0;
    if(fixedPalms) {
      let palm=projectHearthkin(j[near+'Palm'],pose.direction);
      const reach=33+definition.hands[view][near].palmLength-.002;
      const dx=palm.x-socket.x,dy=palm.y-socket.y,distance=Math.hypot(dx,dy);
      // Keep a falling rider's cap on its painted shoulder. Only when that
      // death pose's palm is beyond screen-plane reach, bring the grip the
      // minimum distance inward; held equipment follows it below. Living
      // actions retain their exact canonical contact targets.
      if(distance>reach) {
        const amount=(distance-reach)/distance;
        if(pose.state==='death'&&pose.mount) {
          j[near+'Palm']=add(j[near+'Palm'],fromProjection(-dx*amount,-dy*amount,0,pose.direction));
          palm=projectHearthkin(j[near+'Palm'],pose.direction);
          deathGrips.add(near);
        } else socket={x:socket.x+dx*amount,y:socket.y+dy*amount};
      }
      // Choose the closest reachable depth while retaining this screen
      // position. Depth adjustment never moves the painted shoulder.
      const radius=Math.sqrt(Math.max(0,reach**2-Math.hypot(palm.x-socket.x,palm.y-socket.y)**2));
      depthShift=clamp(root.depth,palm.depth-radius,palm.depth+radius)-root.depth;
    }
    const dx=socket.x-root.x,dy=socket.y-root.y,sign=pose.direction===1?1:-1;
    const delta={x:sign*(.3420201433*dy+.9396926208*depthShift),y:-.9396926208*dy+.3420201433*depthShift,z:sign*dx};
    j[near+'Shoulder']=add(j[near+'Shoulder'],delta);
    if(!fixedPalms)for(const joint of ['Elbow','Hand','Palm'])if(j[near+joint])j[near+joint]=add(j[near+joint],delta);
  }
  for(const arm of ['left','right']) {
    const palmLength=definition.hands[view][arm].palmLength;
    if(fixedPalms) {
      let shoulder=j[arm+'Shoulder'];const palm=j[arm+'Palm'];
      const rootScreen=projectHearthkin(shoulder,pose.direction),palmScreen=projectHearthkin(palm,pose.direction);
      const screenDistance=Math.hypot(rootScreen.x-palmScreen.x,rootScreen.y-palmScreen.y),minimum=palmLength-1+.002;
      // Folded death poses can put the palm inside the chain's inner
      // reach. Change only camera depth, retaining the painted shoulder
      // and the exact equipment/rein target as well as both bone lengths.
      if(length(sub(palm,shoulder))<minimum) {
        const depth=Math.sqrt(Math.max(0,minimum**2-screenDistance**2));
        const shift=palmScreen.depth+Math.sign(rootScreen.depth-palmScreen.depth||1)*depth-rootScreen.depth;
        shoulder=add(shoulder,fromProjection(0,0,shift,pose.direction));j[arm+'Shoulder']=shoulder;
      }
      // Retain this action's elbow plane, including the worker's soft
      // outward bend. Do not impose one soldier's stance on the roster.
      const pole=add(shoulder,sub(pose.anatomical[arm+'Elbow'],pose.anatomical[arm+'Shoulder']));
      const elbow=solveAnatomicalLimb(shoulder,palm,17,16+palmLength,pole);
      j[arm+'Elbow']=elbow;j[arm+'Hand']=add(elbow,mul(sub(palm,elbow),16/(16+palmLength)));
    } else {
      const forearm=sub(j[arm+'Hand'],j[arm+'Elbow']);
      j[arm+'Palm']=add(j[arm+'Hand'],mul(forearm,palmLength/length(forearm)));
    }
    for(const joint of ['Shoulder','Elbow','Hand','Palm'])result[arm+joint]=projectHearthkin(j[arm+joint],pose.direction);
  }
  if(!fixedPalms&&pose.toolFrame)result.toolFrame={...pose.toolFrame,grip:j.rightPalm};
  if(deathGrips.size) {
    result.surfaceDeathGripAdjusted=[...deathGrips];
    const toolHand=pose.toolFrame?.hand??pose.toolHand??'right';
    if(pose.toolFrame&&!pose.toolFrame.detached&&deathGrips.has(toolHand))result.toolFrame={...pose.toolFrame,grip:j[toolHand+'Palm']};
    const shieldHand=pose.shieldFrame?.hand??'left';
    if(pose.shieldFrame&&pose.shieldFrame.attachment!=='back'&&!pose.shieldFrame.detached&&deathGrips.has(shieldHand))result.shieldFrame={...pose.shieldFrame,grip:j[shieldHand+'Palm']};
    const reinHand=pose.reins?.hand??'left';
    if(pose.reins&&!pose.reins.released&&deathGrips.has(reinHand)) {
      const palm=j[reinHand+'Palm'],delta=sub(palm,pose.anatomical[reinHand+'Palm']);
      result.reins={...pose.reins};
      for(const side of ['left','right']) {
        const [,middle,bit]=pose.reins[side];
        // The control point is55% of the way from hand to bit; retain its
        // existing sag while moving its hand contribution with the grip.
        result.reins[side]=[palm,add(middle,mul(delta,.45)),bit];
      }
    }
  }
  return result;
}
