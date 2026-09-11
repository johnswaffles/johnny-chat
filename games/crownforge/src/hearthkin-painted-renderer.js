import { HEARTHKIN_PAINTED_ART } from './hearthkin-painted-art.js?v=20260909-cursedbears1';
import { HEARTHKIN_ACTIONS } from './hearthkin-rig.js?v=20260909-cursedbears1';
import { RESOURCE_TYPES, UNIT_TYPES } from './config.js?v=20260911-pause1';

const clamp=n=>Math.max(0,Math.min(.999999,n));
const cycle=n=>n-Math.floor(n);
const VIEWS=['se','sw','ne','nw'];
export function paintedHearthkinFrame(unit,timeOverride,reducedMotion=false,art=HEARTHKIN_PAINTED_ART){
  const view=VIEWS[unit.paintedFacing]??['sw','se','ne','nw'][unit.facing??0]??'sw';
  let action=unit.animationState??'idle',phase=unit.animationPhase??0,indexOverride;
  const moving=unit.kind==='unit'&&(unit.motionSpeed??0)>.025;
  if(unit.dead){action='death';phase=clamp((unit.deathAge??unit.animationTime??0)/1.6);}
  else if(action==='walk'&&unit.carryAmount>0)action='carry_'+unit.carryType;
  if(!unit.dead&&unit.command==='attack'&&['anticipation','contact','recovery'].includes(unit.attackPhase)) {
    const config=UNIT_TYPES[unit.type]??UNIT_TYPES.villager;
    const timing=config.attackTiming??{anticipation:.25,contact:.45,recovery:.3};
    action='attack_'+unit.attackPhase;phase=clamp((unit.attackPhaseElapsed??0)/(config.cooldown*timing[unit.attackPhase]));
  }
  if(timeOverride!==undefined)phase=cycle(timeOverride/(HEARTHKIN_ACTIONS[action]?.duration??1));
  else if(action==='idle')phase=reducedMotion?0:cycle((unit.animClock??unit.animationTime??0)/3.6);
  else if(action.startsWith('gather_'))phase=cycle((unit.gatherTimer??0)/(RESOURCE_TYPES[action.slice(7)]?.gatherTime??1.1));
  else if(['construct','repair','demolish','field_work'].includes(action))phase=cycle(unit.workCyclePhase??unit.animationPhase??0);
  else if(action==='ward_block')phase=clamp(1-(unit.wardBlockedPulse??0)/.42);
  // The movement clock pauses while blocked. Hold a loaded pose at rest,
  // never keep marching or slide a stationary spell/fall pose along a route.
  if(unit.kind==='unit'&&!moving&&(action==='walk'||action.startsWith('carry_')))phase=0;
  if(!unit.dead&&!moving&&timeOverride===undefined&&!action.startsWith('attack')){
    const age=(unit.lastLightWardDuration??0)-(unit.lastLightWardTimer??0);
    if(unit.lastLightWardBlastTimer>0){action='last_light';phase=.5+.5*clamp(1-unit.lastLightWardBlastTimer/(unit.lastLightWardBlastDuration||.9));}
    else if(unit.lastLightWardTimer>0&&age>=0&&age<.8){action='ward_raise';phase=clamp(age/.8);}
    else if(unit.lastLightWardCurseDelayTimer>0){action='last_light';phase=.5*clamp((age-.8)/.7);}
    else if(unit.lastLightCurseFlashTimer>0&&action==='idle'){action='last_light_cursed';phase=clamp(1-unit.lastLightCurseFlashTimer/1.15);}
  }
  if(action==='attack_anticipation'){indexOverride=Math.min(1,Math.floor(clamp(phase)*2));action='attack';}
  else if(action==='attack_contact'){indexOverride=2;action='attack';}
  else if(action==='attack_recovery'){indexOverride=3;action='attack';}
  const sheet=art[view][action]??art[view].idle;
  // Contact frame starts at the simulation's 60% harvest/build event.
  const work=action.startsWith('gather_')||['construct','repair','demolish','field_work'].includes(action);
  const index=indexOverride??(work?(phase<.4?0:phase<.6?1:phase<.78?2:3):Math.floor(clamp(phase)*sheet.frames.length));
  return {view,action,phase,index,sheet,frame:sheet.frames[index]};
}

export class PaintedHearthkinRenderer {
  constructor({type='villager',art=HEARTHKIN_PAINTED_ART}={}){
    this.art=art;
    this.definition={id:type};this.images=new Map();this.cache=new Map();this.parts=new Map();this.pixelBytes=0;
    const sheets=Object.values(this.art).flatMap(v=>Object.values(v));
    for(const src of new Set(sheets.map(s=>s.src))){
      const image=new Image();this.images.set(src,image);
      image.addEventListener('load',()=>{for(const sheet of sheets.filter(s=>s.src===src))this.prepare(sheet,image);});
      image.src=src;
    }
  }
  readiness(){return [...this.images.values()];}
  get ready(){return this.cache.size===Object.values(this.art).reduce((n,v)=>n+Object.keys(v).length,0);}
  prepare(sheet,image){
    if(this.cache.has(sheet))return;
    const frames=sheet.frames.map(f=>{
      const [x,y,w,h]=f.rect,full=document.createElement('canvas');full.width=w;full.height=h;
      const g=full.getContext('2d');
      if(f.clip){g.beginPath();for(const r of f.clip)g.rect(...r);g.clip();}
      g.drawImage(image,x,y,w,h,0,0,w,h);
      const small=document.createElement('canvas');small.width=Math.ceil(w*.4);small.height=Math.ceil(h*.4);
      const sg=small.getContext('2d');sg.imageSmoothingQuality='high';sg.drawImage(full,0,0,small.width,small.height);
      this.pixelBytes+=(w*h+small.width*small.height)*4;
      return [full,small];
    });
    this.cache.set(sheet,frames);
  }
  draw(ctx,unit,point,size,alpha=1,timeOverride){
    const {sheet,frame,index}=paintedHearthkinFrame(unit,timeOverride,this.reducedMotion,this.art),frames=this.cache.get(sheet);
    if(!frames)return false;
    const scale=size*.94/sheet.scaleBase,[full,small]=frames[index];
    // Two precomputed levels keep zoomed-out units inexpensive and avoid
    // clipping hundreds of sprite contours during gameplay or zooming.
    const image=scale*(globalThis.devicePixelRatio||1)<=.4?small:full;
    ctx.save();ctx.globalAlpha*=alpha;
    ctx.fillStyle='rgba(13,23,17,.2)';ctx.beginPath();ctx.ellipse(point.x,point.y+1,size*.17,size*.035,0,0,Math.PI*2);ctx.fill();
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(image,point.x-frame.pivot[0]*scale,point.y-frame.pivot[1]*scale,frame.rect[2]*scale,frame.rect[3]*scale);
    ctx.restore();return true;
  }
}
