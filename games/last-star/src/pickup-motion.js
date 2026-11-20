// The atlas is baked in tools/bake-living-pickups.cjs. One bounded blit draws
// each visible item, regardless of the number of flame tongues or glass bubbles.
const CELL=128, FRAMES=24, ART_SIZE=96, CHEST_FOOT=112;
const clips={
  ember:{row:0,seconds:1.12},
  frost:{row:1,seconds:2.4},
  chain:{row:2,seconds:1.15},
  flask:{row:3,seconds:2.7},
  power:{row:4,seconds:2.1},
  gem:{row:5,seconds:2.8},
  gold:{row:6,seconds:1.65},
  chest:{row:7,seconds:3.1},
  chest_open:{row:8,seconds:.42}
};

export const CHEST_OPEN_TIME=clips.chest_open.seconds;
export function pickupPhase(r,drop) {
  r.pickupPhases??=new WeakMap();
  if(!r.pickupPhases.has(drop))r.pickupPhases.set(drop,(drop.x*.0137)%1);
  return r.pickupPhases.get(drop);
}

export function drawPickupMotion(r,kind,x,y,size,phase=0,openingAge=0){
  const sheet=r.art?.pickupMotion,clip=clips[kind];
  if(!sheet||!clip)return false;
  const chest=kind==='chest'||kind==='chest_open';
  let frame=0;
  if(kind==='chest_open'){
    frame=r.gentle?FRAMES-1:Math.min(FRAMES-1,Math.floor(Math.max(0,openingAge)/clip.seconds*FRAMES));
  }else if(!r.gentle && !r.reducedFlash){
    frame=Math.floor(((r.time/clip.seconds+phase)%1)*FRAMES);
  }
  const scale=size/ART_SIZE, anchor=chest?CHEST_FOOT:kind==='ember'?71:CELL/2;
  r.ctx.drawImage(sheet,frame*CELL,clip.row*CELL,CELL,CELL,x-CELL*scale/2,y-anchor*scale,CELL*scale,CELL*scale);
  return true;
}
