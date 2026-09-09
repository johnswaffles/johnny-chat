import {AtlasImageCache} from './atlas-image-cache.js';
const VIEWS=['se','sw','ne','nw'];
const clamp=n=>Math.max(0,Math.min(.999999,n));
const cycle=n=>n-Math.floor(n);

/** Resolve existing gameplay clocks; painting never changes combat rules. */
export function paintedRosterFrame(unit,art,definition,{time,reducedMotion=false}={}){
  const view=VIEWS[unit.paintedFacing]??['sw','se','ne','nw'][unit.facing??0]??'sw';
  const actions=definition.actions;
  let action=unit.animationState??'idle',phase=unit.animationPhase??0,index;
  if(unit.dead){action='death';phase=clamp((unit.deathAge??unit.animationTime??0)/(actions.death?.duration??1.8));}
  else if(!['hit','stunned'].includes(action)&&unit.command==='attack'&&['anticipation','contact','recovery'].includes(unit.attackPhase)){
    action='attack_'+unit.attackPhase;
    phase=clamp((unit.attackPhaseElapsed??0)/(actions[action]?.duration??.3));
  }
  if(time!==undefined)phase=actions[action]?.loop===false?clamp(time/actions[action].duration):cycle(time/(actions[action]?.duration??1));
  else if(action==='idle')phase=reducedMotion?0:cycle((unit.animClock??unit.animationTime??0)/(actions.idle?.duration??3.8));
  if(time===undefined&&action==='walk'&&unit.kind==='unit'&&(unit.motionSpeed??0)<.025){action='idle';phase=0;}
  if(action==='attack_anticipation'){index=Math.min(1,Math.floor(clamp(phase)*2));action='attack';}
  else if(action==='attack_contact'){index=2;action='attack';}
  else if(action==='attack_recovery'){index=3;action='attack';}
  let sheet=art[view]?.[action];
  if(!sheet){sheet=art[view]?.idle;action='idle';index=0;phase=0;}
  if(!sheet)return null;
  index??=Math.floor(clamp(phase)*sheet.frames.length);
  index=Math.max(0,Math.min(sheet.frames.length-1,index));
  if(!sheet.frames[index])return null;
  return {view,action,phase,index,sheet,frame:sheet.frames[index]};
}

// Shared across the roster so encountering more classes cannot grow decoded
// frame canvases without bound. PNG source images load only when needed.
const frames=new Map();
const MAX_FRAME_BYTES=80*1024*1024;
const sources=new AtlasImageCache();
let frameBytes=0;
export function paintedRosterCacheStats(){return {frames:frames.size,fullFrames:[...frames.values()].filter(f=>f.full).length,bytes:frameBytes,budget:MAX_FRAME_BYTES,sources:sources.stats()};}
function preparedFrame(sheet,frame,image,wantsFull=true){
  let cached=frames.get(frame);
  if(cached&&(!wantsFull||cached.full)){frames.delete(frame);frames.set(frame,cached);return cached;}
  if(cached){frameBytes-=cached.bytes;frames.delete(frame);}
  const [x,y,w,h]=frame.rect,full=document.createElement('canvas');
  full.width=w;full.height=h;const g=full.getContext('2d');
  if(frame.clip){g.beginPath();for(const r of frame.clip)g.rect(...r);g.clip();}
  g.drawImage(image,x,y,w,h,0,0,w,h);
  const small=document.createElement('canvas');small.width=Math.ceil(w*.4);small.height=Math.ceil(h*.4);
  const sg=small.getContext('2d');sg.imageSmoothingQuality='high';sg.drawImage(full,0,0,small.width,small.height);
  cached={full:wantsFull?full:null,small,bytes:((wantsFull?w*h:0)+small.width*small.height)*4};
  while(frameBytes+cached.bytes>MAX_FRAME_BYTES&&frames.size){
    // Lose zoom detail before losing a ready pose. A camera sweep can keep
    // drawing small paintings while replacement full-size sources decode.
    const detailed=[...frames.values()].find(value=>value.full);
    if(detailed){const bytes=detailed.full.width*detailed.full.height*4;detailed.full=null;detailed.bytes-=bytes;frameBytes-=bytes;}
    else{const oldest=frames.keys().next().value;frameBytes-=frames.get(oldest).bytes;frames.delete(oldest);}
  }
  if(cached.bytes<=MAX_FRAME_BYTES){frames.set(frame,cached);frameBytes+=cached.bytes;}
  return cached;
}
export class PaintedRosterRenderer{
  constructor(definition,art){this.definition=definition;this.art=art;this.reducedMotion=false;}
  /** Prepare a reviewed sequence from already decoded sources. The workshop
   * thumbnails and stage share these exact crops with the runtime renderer. */
  prepareSheet(sheet,decodedSources){
    return sheet.frames.map(frame=>{
      const ready=frames.get(frame);if(ready?.full)return ready.full;
      const src=frame.src??sheet.src,image=decodedSources?.get(src)??this.imageFor(src);
      if(!image?.naturalWidth)throw new Error('Painting is not decoded: '+src);
      return preparedFrame(sheet,frame,image).full;
    });
  }
  imageFor(src){return sources.get(src);}
  /** Resolve only after every requested painting can actually be drawn.
   * Missing/failed art returns false so the caller can retain its fallback. */
  async prepareAction(view,action,{resolution='full'}={}){
    const sheet=this.art[view]?.[action];if(!sheet?.frames.length)return false;
    const wantsFull=resolution==='full';
    try{
      for(const frame of sheet.frames){
        const cached=frames.get(frame);if(cached&&(!wantsFull||cached.full))continue;
        const image=await sources.load(frame.src??sheet.src);preparedFrame(sheet,frame,image,wantsFull);
      }
      return sheet.frames.every(frame=>{const cached=frames.get(frame);return cached&&(!wantsFull||cached.full);});
    }catch{return false;}
  }
  draw(ctx,unit,point,size,alpha=1,time){
    const sample=paintedRosterFrame(unit,this.art,this.definition,{time,reducedMotion:this.reducedMotion});
    if(!sample)return false;
    const {sheet,frame}=sample;
    const scale=size/(frame.scaleBase??sheet.scaleBase),wantsFull=scale*(globalThis.devicePixelRatio||1)>.4;
    let prepared=frames.get(frame);
    if(!prepared||(wantsFull&&!prepared.full)){
      const image=this.imageFor(frame.src??sheet.src);
      if(image)prepared=preparedFrame(sheet,frame,image,wantsFull);
      else if(!prepared)return false;
    }
    else{frames.delete(frame);frames.set(frame,prepared);}
    const bitmap=wantsFull&&prepared.full?prepared.full:prepared.small;
    ctx.save();ctx.globalAlpha*=alpha;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(bitmap,point.x-frame.pivot[0]*scale,point.y-frame.pivot[1]*scale,frame.rect[2]*scale,frame.rect[3]*scale);
    ctx.restore();return true;
  }
}
