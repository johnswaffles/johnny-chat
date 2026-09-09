import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CHARACTER_RIGS} from '../src/character-rigs.js';
import {animationDefinition} from '../src/animation.js';
import {PAINTED_FIGHTER_TYPES,PaintedRosterRig,paintedRosterFactories,paintedRosterCacheStats} from '../src/painted-roster-rig.js';
import {paintedRosterFrame} from '../src/painted-roster/painted-roster-renderer.js';
import {CrownforgeRenderer} from '../src/renderer.js';
const root=new URL('../',import.meta.url),arts={};
for(const type of PAINTED_FIGHTER_TYPES)arts[type]=(await import('../src/painted-roster/'+type+'.js')).default;

test('the game loading veil completes with a whole-painting renderer that has no body parts',()=>{
 const image={complete:true,naturalWidth:1,decode:async()=>{}},ctx={drawImage(){},getImageData(){return {};}};
 const rig={readiness:()=>[{complete:true,naturalWidth:1}],draw:()=>true};
 const renderer={landscape:{images:{ground:image},treeMips:[]},characterRigs:new Map([['soldier',rig]]),warmQueuedCharacterRigs(){},grizzly:{readiness:()=>[]},largeStone:image,enemyCamp:image,assetMips:new WeakMap([[image,[]]]),goldDepositAssets:{},firstAgeAssets:{townCenter:image},firstAgeConstructionAtlases:{},villagerAtlases:{},combatAtlases:{},imageDecoding:new WeakMap([[image,true]]),warmCanvas:{getContext:()=>ctx}};
 let result;
 for(let i=0;i<13;i++)result=CrownforgeRenderer.prototype.startupReadiness.call(renderer,{units:[{type:'soldier'}],buildings:[]});
 assert.equal(result.ready,true);assert.equal(result.loaded,result.total);
});

test('all ten production fighters use 240 independently authored action views',()=>{
 assert.equal(PAINTED_FIGHTER_TYPES.length,10);let views=0,frames=0;
 for(const type of PAINTED_FIGHTER_TYPES){
  assert.equal(animationDefinition(type).renderer,'painted');
  for(const view of ['sw','se','ne','nw'])for(const action of ['idle','walk','attack','hit','stunned','death']){
   const sheet=arts[type][view][action];assert(sheet,type+':'+view+':'+action);views++;frames+=sheet.frames.length;
   for(const frame of sheet.frames){const bytes=readFileSync(new URL(frame.src??sheet.src,root));assert.equal(bytes[25],6,'real RGBA artwork');const [x,y,w,h]=frame.rect;assert(x>=0&&y>=0&&x+w<=bytes.readUInt32BE(16)&&y+h<=bytes.readUInt32BE(20));}
  }
 }
 assert.equal(views,240);assert.equal(frames,800);
 for(const worker of ['villager','ashenForager'])assert.equal(animationDefinition(worker).renderer,'painted');
});
test('all fighters face correctly, strike at contact and preserve reaction priority',()=>{
 for(const type of PAINTED_FIGHTER_TYPES){const art=arts[type],definition=CHARACTER_RIGS[type];
  for(const [facing,view] of ['sw','se','ne','nw'].entries()){
   const unit={kind:'unit',type,facing,animationState:'walk',animationPhase:.6,motionSpeed:2};
   assert.equal(paintedRosterFrame(unit,art,definition).view,view);
   for(const phase of ['anticipation','contact','recovery']){
    Object.assign(unit,{animationState:'attack_'+phase,command:'attack',attackPhase:phase,attackPhaseElapsed:definition.actions['attack_'+phase].duration*.7});
    const sample=paintedRosterFrame(unit,art,definition);assert.equal(sample.action,'attack');assert.equal(sample.index,{anticipation:1,contact:2,recovery:3}[phase]);
   }
   for(const action of ['hit','stunned']){unit.animationState=action;assert.equal(paintedRosterFrame(unit,art,definition).action,action);}
   unit.dead=true;unit.deathAge=100;assert.equal(paintedRosterFrame(unit,art,definition).index,3);
  }
 }
});
test('production factories prepare and draw the new artwork within shared cache budgets',async()=>{
 const ctx={beginPath(){},rect(){},clip(){},drawImage(){},save(){},restore(){},globalAlpha:1};
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({...ctx})})};
 globalThis.Image=class{async decode(){const p=readFileSync(new URL(this.src,root));this.naturalWidth=p.readUInt32BE(16);this.naturalHeight=p.readUInt32BE(20);this.complete=true;}};
 const factories=paintedRosterFactories(CHARACTER_RIGS),rigs=PAINTED_FIGHTER_TYPES.map(type=>factories[type]());
 assert(rigs.every(r=>r instanceof PaintedRosterRig));assert((await Promise.all(rigs.map(r=>r.ready))).every(Boolean));
 for(const rig of rigs){
  assert(rig.readiness().every(i=>i.complete&&i.naturalWidth));
  for(const view of ['sw','se','ne','nw'])for(const action of ['idle','walk','attack','hit','stunned','death']){
   assert(await rig.prepare(view,action));
   assert(rig.draw({...ctx},{paintedFacing:['se','sw','ne','nw'].indexOf(view),animationState:action},{x:0,y:0},80,1,.1),rig.definition.id+view+action);
  }
 }
 const stats=paintedRosterCacheStats();assert(stats.bytes<=stats.budget);assert(stats.sources.bytes<=stats.sources.budget);
});
