import {PaintedRosterRenderer,paintedRosterFrame,paintedRosterCacheStats} from './painted-roster/painted-roster-renderer.js?v=20260909-fullroster1';

export const PAINTED_FIGHTER_TYPES=Object.freeze(['soldier','spearwarden','militia','shieldbearer','scout','raider','thornSpear','hearthLevy','hidewall','ashenOutrider']);
export {paintedRosterCacheStats};
const metadata=new Map();
function loadArt(type){
  if(!metadata.has(type))metadata.set(type,import(`./painted-roster/${type}.js?v=20260909-fullroster1`).then(module=>module.default));
  return metadata.get(type);
}

/** The reviewed paintings use the same world coordinates, facing and combat
 * clocks as the game. Only the representation changes. */
export class PaintedRosterRig {
  constructor(definition){
    this.definition=definition;this.reducedMotion=false;this.pending=new Map();this.prepared=new Set();
    this.marker={src:`painted-roster:${definition.id}`,complete:false,naturalWidth:0};
    this.ready=loadArt(definition.id).then(async art=>{
      this.art=art;this.painter=new PaintedRosterRenderer(definition,art);
      const result=await Promise.all(['se','sw','ne','nw'].map(view=>this.prepare(view,'idle')));
      if(!result.every(Boolean))throw new Error('Unable to prepare painted '+definition.id);
      this.marker.complete=true;this.marker.naturalWidth=1;return true;
    }).catch(error=>{this.error=error;console.error(error);return false;});
  }
  readiness(){return [this.marker];}
  prepare(view,action){
    const key=view+':'+action;
    if(this.pending.has(key))return this.pending.get(key);
    const promise=this.painter.prepareAction(view,action,{resolution:'small'}).then(ok=>{
      if(ok)this.prepared.add(key);return ok;
    }).finally(()=>this.pending.delete(key));
    this.pending.set(key,promise);return promise;
  }
  draw(ctx,unit,point,size,alpha=1,time){
    if(!this.marker.naturalWidth)return false;
    this.painter.reducedMotion=this.reducedMotion;
    const sample=paintedRosterFrame(unit,this.art,this.definition,{time,reducedMotion:this.reducedMotion});
    if(!sample)return false;
    const key=sample.view+':'+sample.action;
    if(!this.prepared.has(key))this.prepare(sample.view,sample.action);
    if(this.painter.draw(ctx,unit,point,size,alpha,time))return true;
    // Keep a correctly faced painted body visible while a new action decodes.
    // All four idle views are prepared before this class enters the match.
    return this.painter.draw(ctx,{...unit,dead:false,command:'idle',animationState:'idle',animationPhase:0},point,size,alpha,0);
  }
}

export function paintedRosterFactories(definitions){
  return Object.fromEntries(PAINTED_FIGHTER_TYPES.map(type=>[type,()=>new PaintedRosterRig(definitions[type])]));
}
