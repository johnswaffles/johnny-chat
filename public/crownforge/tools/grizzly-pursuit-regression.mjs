import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CrownforgeSimulation} from '../src/simulation.js';
import {GRIZZLY_PURSUIT} from '../src/grizzly-motion.js';
import {paintedGrizzlyFrame} from '../src/grizzly-renderer.js';
function arena(){const s=new CrownforgeSimulation({seed:42});s.units=[];s.buildings=[];s.resourcesNodes=[];s.navigationVersion++;s.unitSpeedScale=1;return s;}
function pair(type='soldier'){const s=arena(),b=s.addUnit('grizzly',100,100,'wildlife'),t=s.addUnit(type,102,100,'player');t.hp=t.maxHp=1000;s._sendUnitToAttack(b,t);return {s,b,t};}
test('bear closes and hits fleeing prey during moving swipes, once per cycle',()=>{
 const {s,b,t}=pair();b.grizzlyAttackCount=2;const hits=[];const apply=s._applyUnitDamage.bind(s);
 s._applyUnitDamage=(target,dmg,u)=>{if(u===b)hits.push({cycle:b.grizzlyAttackCount,speed:Math.hypot(b.velocityX,b.velocityZ),frame:paintedGrizzlyFrame(b),distance:s._targetDistance(b,t)});return apply(target,dmg,u);};
 for(let i=0;i<7*60;i++){t.x+=1.9/60;t.velocityX=1.9;s._updateUnit(b,1/60);}
 assert(b.x>110,'pursuit continues through attack cycles');assert(hits.length>=3);
 assert.equal(new Set(hits.map(h=>h.cycle)).size,hits.length);
 for(const hit of hits){assert(hit.speed>1);assert(hit.distance<=GRIZZLY_PURSUIT.reach);assert.equal(hit.frame.action,'swipe');assert.equal(hit.frame.index,2);}
 assert.equal(b.grizzlyAttackVariant,'swipe','chase never slides the upright bear');assert(b.grizzlyTravel>8);
 const saved=s.serialize(),restored=arena();assert(restored.loadSnapshot(saved));const copy=restored.units.find(u=>u.id===b.id);assert.equal(copy.grizzlyMovingAttack,b.grizzlyMovingAttack);
});
test('escaping past reach makes the committed swipe miss',()=>{
 const {s,b,t}=pair();t.velocityX=1;s._updateUnit(b,1/60);assert(b.grizzlyMovingAttack);
 t.x=130;const hp=t.hp;for(let i=0;i<95;i++)s._updateUnit(b,1/60);assert.equal(t.hp,hp);
});
test('pursuit respects blocked segments and cannot hit through an obstacle',()=>{
 const {s,b,t}=pair();t.velocityX=1;s._updateUnit(b,1/60);
 const x=b.x;s._pathSegmentBlocked=()=>true;s._hasCombatLineOfSight=()=>false;
 const hp=t.hp;for(let i=0;i<90;i++)s._updateUnit(b,1/60);
 assert.equal(b.x,x);assert.equal(t.hp,hp);
});
test('stationary third attack still rears and remains planted',()=>{
 const {s,b,t}=pair();t.x=101.3;b.path=[];b.grizzlyAttackCount=2;s._updateUnit(b,1/60);
 assert.equal(b.grizzlyAttackVariant,'rear');const x=b.x,z=b.z;
 t.x+=.5;for(let i=0;i<90;i++)s._updateUnit(b,1/60);
 assert.equal(b.x,x);assert.equal(b.z,z);
});
test('a shielded worker immediately loses pursuit and damage eligibility',()=>{
 const {s,b,t}=pair('villager');t.velocityX=1;s._updateUnit(b,1/60);const x=b.x;
 t.lastLightWardTimer=10;const hp=t.hp;for(let i=0;i<90;i++)s._updateUnit(b,1/60);
 assert.equal(t.hp,hp);assert.equal(b.attackTarget,null);assert.equal(b.x,x);
});
