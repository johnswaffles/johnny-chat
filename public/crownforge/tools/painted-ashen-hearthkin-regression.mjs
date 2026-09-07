import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ASHEN_HEARTHKIN_PAINTED_ART as ART} from '../src/ashen-hearthkin-painted-art.js';
import {HEARTHKIN_PAINTED_ART as CROWN} from '../src/hearthkin-painted-art.js';
import {paintedHearthkinFrame} from '../src/hearthkin-painted-renderer.js';
import {CrownforgeSimulation} from '../src/simulation.js';
import {animationDefinition} from '../src/animation.js';
const frame=(u,t,reduced=false)=>paintedHearthkinFrame({type:'ashenForager',...u},t,reduced,ART);
test('Ashen library has complete action parity, preserved image bytes and valid ground anchors',()=>{
 const report=JSON.parse(readFileSync(new URL('../art-notes/painted-ashen-hearthkin/ART_ANALYSIS.json',import.meta.url)));
 let count=0;const sources=new Set();
 for(const [view,actions] of Object.entries(ART)){
  assert.deepEqual(Object.keys(actions).sort(),Object.keys(CROWN[view]).sort());
  for(const [action,s] of Object.entries(actions)){
   assert(s.src.includes('/ashen-hearthkin-painted/'));assert(s.scaleBase>0);count+=s.frames.length;sources.add(s.src);
   const r=report[s.src.split('/').at(-1).replace('.png','')];
   for(const f of s.frames){const [x,y,w,h]=f.rect;assert(x>=0&&y>=0&&w>0&&h>0&&x+w<=r.size[0]&&y+h<=r.size[1]);assert(f.pivot.every(Number.isFinite));assert(f.clip.length>0);}
  }
 }
 assert.equal(count,384);assert.equal(sources.size,31);
 for(const src of sources){const key=src.split('/').at(-1).replace('.png','');assert.equal(createHash('sha256').update(readFileSync(new URL('../'+src,import.meta.url))).digest('hex'),report[key].sha256);}
 assert.match(ART.sw.gather_wood.src,/01.png$/);for(const v of Object.values(ART))assert.match(v.carry_wood.src,/06.png$/);
});
test('Ashen strikes use their own 1.35-second cooldown and default phase proportions',()=>{
 assert.equal(frame({command:'attack',attackPhase:'anticipation',attackPhaseElapsed:.16}).index,0);
 assert.equal(frame({command:'attack',attackPhase:'anticipation',attackPhaseElapsed:.18}).index,1);
 assert.equal(frame({command:'attack',attackPhase:'contact',attackPhaseElapsed:.2}).index,2);
 assert.equal(frame({command:'attack',attackPhase:'recovery',attackPhaseElapsed:.1}).index,3);
 assert.equal(frame({animationState:'gather_wood',gatherTimer:.661}).index,2);
 assert.equal(animationDefinition('ashenForager').renderer,'painted');
});
test('real Ashen movement selects all camera quadrants and loaded movement stops at rest',()=>{
 const s=new CrownforgeSimulation({seed:42});s.units=[];s.resourcesNodes=[];s.buildings=[];s.navigationVersion++;s._checkVictory=()=>{};
 const u=s.addUnit('ashenForager',100,100,'player');
 for(const [dx,dz,view] of [[3,0,'se'],[0,3,'sw'],[0,-3,'ne'],[-3,0,'nw']]){
  u.velocityX=u.velocityZ=0;u.facingLocked=false;s._sendUnitTo(u,{x:u.x+dx,z:u.z+dz},'move');for(let n=0;n<6;n++)s.update(.1);assert.equal(frame(u).view,view);
 }
 Object.assign(u,{animationState:'walk',carryAmount:12,carryType:'wood',motionSpeed:1,animationPhase:.6});assert.equal(frame(u).action,'carry_wood');assert.equal(frame(u).index,2);u.motionSpeed=0;assert.equal(frame(u).index,0);
});
test('Ashen ward animations preserve moving and untargetable worker behavior',()=>{
 const u={kind:'unit',animationState:'idle',motionSpeed:0,lastLightWardDuration:60,lastLightWardTimer:59.6};assert.equal(frame(u).action,'ward_raise');
 Object.assign(u,{lastLightWardBlastTimer:.8,lastLightWardBlastDuration:.9});assert.equal(frame(u).action,'last_light');
 Object.assign(u,{animationState:'walk',motionSpeed:2});assert.equal(frame(u).action,'walk');
 Object.assign(u,{dead:true,deathAge:8});assert.equal(frame(u).index,3);
 assert.equal(frame({animationState:'idle',animClock:2},undefined,true).index,0);
});
