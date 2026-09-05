import {projectHearthkin,solveAnatomicalLimb} from './hearthkin-locomotion.js';

const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const mul=(a,s)=>({x:a.x*s,y:a.y*s,z:a.z*s});

// The independently painted profile torsos have measured armhole sockets.
// Fit surfaces after canonical motion/transition sampling; working palms
// stay on their physical targets. Front/back and other identities do not
// use this authored-profile calibration.
export function fitHearthkinProfile(pose) {
  if(!pose.sideView||!pose.anatomical)return pose;
  const right=pose.direction===1,side=right?'right':'left';
  const u=right?(325-176)/546:(1260-863)/533;
  const v=right?(245-27)/950:(255-28)/953;
  let socket;
  if(pose.bodyFrame) {
    const f=pose.bodyFrame,sign=right?1:-1;
    socket=projectHearthkin(add(pose.anatomical.neck,add(mul(f.forward,(u-.5)*20*sign),mul(f.up,1-v*31))),pose.direction);
  } else {
    const height=Math.hypot(pose.waist.x-pose.neck.x,pose.waist.y-pose.neck.y)+3;
    const angle=Math.atan2(pose.waist.y-pose.neck.y,pose.waist.x-pose.neck.x)-Math.PI/2;
    const x=(u-.5)*20,y=v*height;
    socket={x:pose.neck.x+x*Math.cos(angle)-y*Math.sin(angle),y:pose.neck.y-1+x*Math.sin(angle)+y*Math.cos(angle)};
  }
  const root=projectHearthkin(pose.anatomical[side+'Shoulder'],pose.direction);
  const fixedPalm=pose.projectedWork&&!['hit','death'].includes(pose.state);
  let depthShift=0;
  if(fixedPalm) {
    const palm=pose[side+'Palm'],reach=37.39;
    let dx=palm.x-socket.x,dy=palm.y-socket.y,distance=Math.hypot(dx,dy);
    // A profile source is a painted perspective. Choose the closest depth
    // on its socket ray that can reach the actual palm without stretching.
    // At extreme attack extension a subpixel socket accommodation is also
    // necessary; both fixed bone lengths and the tool contact take priority.
    if(distance>reach) {
      const excess=(distance-reach)/distance;
      socket={x:socket.x+dx*excess,y:socket.y+dy*excess};distance=reach;
    }
    const depthReach=Math.sqrt(Math.max(0,reach*reach-distance*distance));
    const oldDepth=root.depth,palmDepth=palm.depth;
    depthShift=Math.max(palmDepth-depthReach,Math.min(palmDepth+depthReach,oldDepth))-oldDepth;
  }
  const dx=socket.x-root.x,dy=socket.y-root.y;
  const delta={x:(right?1:-1)*(.3420201433*dy+.9396926208*depthShift),y:-.9396926208*dy+.3420201433*depthShift,z:(right?1:-1)*dx};
  const j={...pose.anatomical},shoulder=add(j[side+'Shoulder'],delta);
  j[side+'Shoulder']=shoulder;
  if(fixedPalm) {
    for(const arm of ['left','right']) {
      const root=j[arm+'Shoulder'],palm=j[arm+'Palm'],pole=add(root,{x:arm==='left'?-3:3,y:-25,z:-4});
      const elbow=solveAnatomicalLimb(root,palm,17,20.4,pole);
      j[arm+'Elbow']=elbow;
      j[arm+'Hand']=add(elbow,mul(sub(palm,elbow),16/20.4));
    }
  } else {
    for(const joint of ['Elbow','Hand','Palm'])if(j[side+joint])j[side+joint]=add(j[side+joint],delta);
  }
  const result={...pose,anatomical:j,surfaceFitted:true};
  if(!fixedPalm) {
    for(const arm of ['left','right'])if(j[arm+'Palm']) {
      const forearm=sub(j[arm+'Hand'],j[arm+'Elbow']);
      j[arm+'Palm']=add(j[arm+'Hand'],mul(forearm,4.4/Math.hypot(forearm.x,forearm.y,forearm.z)));
    }
    if(pose.toolFrame) {
      const forearm=sub(j.rightHand,j.rightElbow);
      result.toolFrame={...pose.toolFrame,grip:add(j.rightHand,mul(forearm,4.4/Math.hypot(forearm.x,forearm.y,forearm.z)))};
    }
  }
  for(const arm of ['left','right'])for(const joint of ['Shoulder','Elbow','Hand','Palm'])if(j[arm+joint])result[arm+joint]=projectHearthkin(j[arm+joint],pose.direction);
  return result;
}
