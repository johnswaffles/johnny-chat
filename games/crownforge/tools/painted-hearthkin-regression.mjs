import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {HEARTHKIN_PAINTED_ART as ART} from '../src/hearthkin-painted-art.js';
import {paintedHearthkinFrame as frame} from '../src/hearthkin-painted-renderer.js';
import {CrownforgeSimulation} from '../src/simulation.js';
import {CrownforgeAnimationSystem} from '../src/animation.js';
const report=JSON.parse(readFileSync(new URL('../art-notes/painted-hearthkin/WORK_ART_ANALYSIS.json',import.meta.url)));
test('complete four-view library preserves approved images and correction source mappings',()=>{
 let count=0;const checked=new Set();
 for(const view of Object.values(ART))for(const [action,s] of Object.entries(view)){
  count+=s.frames.length;assert(s.scaleBase>0);for(const f of s.frames)assert(f.rect[2]>0&&f.pivot.every(Number.isFinite));
  if(['idle','walk'].includes(action)||checked.has(s.src))continue;
  checked.add(s.src);const key=s.src.split('/').at(-1).replace('.png','');
  assert.equal(createHash('sha256').update(readFileSync(new URL('../'+s.src,import.meta.url))).digest('hex'),report[key].sha256);
 }
 assert.equal(count,384);assert.match(ART.sw.gather_wood.src,/chop-sw-fixed/);
 assert.match(ART.sw.carry_wood.src,/timber-forward/);assert.match(ART.se.carry_wood.src,/timber-forward/);
 assert.match(ART.nw.carry_wood.src,/work-v2\/carry_wood/);
 assert.match(ART.sw.carry_food.src,/work-v2\/carry_food/);
});
test('strike and resource contacts choose the contact painting, independently of stale animation state',()=>{
 for(const phase of ['anticipation','contact','recovery']){
  const f=frame({command:'attack',attackPhase:phase,attackPhaseElapsed:phase==='anticipation'?.2:0,animationState:'idle'});
  assert.equal(f.action,'attack');assert.equal(f.index,{anticipation:1,contact:2,recovery:3}[phase]);
 }
 for(const [resource,duration] of [['wood',1.1],['food',1.05],['stone',1.2],['gold',1.3]]){
  assert.equal(frame({animationState:'gather_'+resource,gatherTimer:duration*.601}).index,2);
  assert.equal(frame({animationState:'gather_'+resource,gatherTimer:duration*.3}).index,0);
 }
 assert.equal(frame({animationState:'construct',workCyclePhase:.6}).index,2);
});
test('loaded movement, blocking and every camera quadrant stay consistent',()=>{
 const s=new CrownforgeSimulation({seed:42});s.units=[];s.resourcesNodes=[];s.buildings=[];s.navigationVersion++;s._checkVictory=()=>{};
 const u=s.addUnit('villager',100,100,'player');
 for(const [dx,dz,view] of [[3,0,'se'],[0,3,'sw'],[0,-3,'ne'],[-3,0,'nw']]){
  u.velocityX=u.velocityZ=0;u.facingLocked=false;
  s._sendUnitTo(u,{x:u.x+dx,z:u.z+dz},'move');for(let tick=0;tick<6;tick++)s.update(.1);
  assert.equal(frame(u).view,view);
 }
 Object.assign(u,{animationState:'walk',carryAmount:12,carryType:'wood',motionSpeed:1,animationPhase:.6});
 assert.equal(frame(u).action,'carry_wood');assert.equal(frame(u).index,2);
 u.motionSpeed=0;assert.equal(frame(u).index,0);
 const clock=new CrownforgeAnimationSystem();Object.assign(u,{command:'move',visualState:'walk',animationTime:.3});clock.update(u,.1);assert.equal(u.animationTime,.3);
});
test('Last Light preserves locomotion, shows stationary awakening/release, and falling holds',()=>{
 const u={kind:'unit',animationState:'idle',motionSpeed:0,lastLightWardDuration:60,lastLightWardTimer:59.6,lastLightWardCurseDelayTimer:1.1};
 assert.equal(frame(u).action,'ward_raise');
 u.lastLightWardTimer=58.9;assert.equal(frame(u).action,'last_light');
 u.lastLightWardBlastTimer=.8;u.lastLightWardBlastDuration=.9;assert.equal(frame(u).index,2);
 Object.assign(u,{animationState:'walk',motionSpeed:2});assert.equal(frame(u).action,'walk');
 Object.assign(u,{dead:true,deathAge:7});assert.equal(frame(u).action,'death');assert.equal(frame(u).index,3);
 assert.equal(frame({animationState:'idle',animClock:2},undefined,true).index,0);
});
