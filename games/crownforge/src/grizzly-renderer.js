import { GRIZZLY_PAINTED_ART } from './grizzly-painted-art.js?v=20260906-paintedbear1';
import { ACTION_TIMING, actionFrame } from './grizzly-painted-timing.js?v=20260906-paintedbear1';
import { GRIZZLY_MOTION, grizzlyAttackClock, grizzlyAttackDefinition } from './grizzly-motion.js?v=20260906-paintedbear1';

const VIEWS=['se','sw','ne','nw'];
const BODY_SCALE=.85;
export function paintedGrizzlyFrame(unit,time=0,reducedMotion=false){
  const view=VIEWS[Math.max(0,Math.min(3,unit.facing??0))];
  const attackTime=grizzlyAttackClock(unit);
  let action='idle',phase=0;
  if(!unit.dead && attackTime!==null){
    action=unit.grizzlyAttackVariant==='rear'?'rear':'swipe';
    phase=Math.min(.999999,attackTime/grizzlyAttackDefinition(unit).duration);
  }else if(!unit.dead && (unit.grizzlyWalkBlend??0)>.05){
    action='walk';phase=(unit.grizzlyTravel??0)/GRIZZLY_MOTION.strideLength;
  }else if(!unit.dead&&!reducedMotion){phase=(unit.animClock??time*.001)/ACTION_TIMING.idle.seconds;}
  const sheet=GRIZZLY_PAINTED_ART[view][action];
  const index=action==='walk'?Math.floor((phase-Math.floor(phase))*sheet.frames.length):actionFrame(action,phase);
  return {view,action,index,sheet,frame:sheet.frames[index]};
}

export class GrizzlyRenderer {
  constructor(){
    this.images=new Map();this.cache=new Map();this.frames=[];
    const sheets=Object.values(GRIZZLY_PAINTED_ART).flatMap(view=>Object.values(view));
    for(const src of new Set(sheets.map(sheet=>sheet.src))){
      const image=new Image();this.images.set(src,image);
      image.addEventListener('load',()=>{
        for(const sheet of sheets.filter(s=>s.src===src))this.prepare(sheet,image);
      });
      image.src=src;
    }
  }
  readiness(){return [...this.images.values()];}
  get ready(){return this.cache.size===16;}
  prepare(sheet,image){
    // Clip neighboring atlas paintings once during loading, not every frame.
    const frames=sheet.frames.map(f=>{
      const [x,y,w,h]=f.rect;
      const full=document.createElement('canvas');full.width=w;full.height=h;
      const g=full.getContext('2d');
      if(f.clip){g.beginPath();for(const r of f.clip)g.rect(...r);g.clip();}
      g.drawImage(image,x,y,w,h,0,0,w,h);
      const small=document.createElement('canvas');small.width=Math.ceil(w*.5);small.height=Math.ceil(h*.5);
      const sg=small.getContext('2d');sg.imageSmoothingQuality='high';sg.drawImage(full,0,0,small.width,small.height);
      return [full,small];
    });
    this.cache.set(sheet,frames);this.frames.push(...frames);
  }
  heightFactor(unit){
    const {sheet}=paintedGrizzlyFrame(unit);
    return Math.max(...sheet.frames.map(f=>f.pivot[1]/sheet.scaleBase))*BODY_SCALE+.08;
  }
  draw(ctx,unit,point,size,time,reducedMotion=false,resolution=1){
    const {sheet,frame,index}=paintedGrizzlyFrame(unit,time,reducedMotion),frames=this.cache.get(sheet);
    if(!frames)return false;
    const [full,small]=frames[index],scale=size*BODY_SCALE/sheet.scaleBase;
    const image=scale*resolution<=.5?small:full;
    ctx.save();ctx.globalAlpha*=unit.dead?Math.max(0,1-(unit.deathAge??0)/5):1;
    ctx.fillStyle='rgba(13,23,17,.22)';ctx.beginPath();ctx.ellipse(point.x,point.y+2,size*.27,size*.085,0,0,Math.PI*2);ctx.fill();
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(image,point.x-frame.pivot[0]*scale,point.y-frame.pivot[1]*scale,frame.rect[2]*scale,frame.rect[3]*scale);
    ctx.restore();return true;
  }
}
