import {test} from 'node:test';import assert from 'node:assert/strict';
import {lastBastionActive,lastBastionDamage,updateLastBastion,unitStatuses} from '../src/unit-status.js';
import {CrownforgeSimulation} from '../src/simulation.js';
for(const [type,duration] of [['shieldbearer',20],['grizzly',60]]){
 test(`${type} lasts ${duration}s, persists through partial healing, expires and cannot loop at low HP`,()=>{
  const u={type,hp:199,maxHp:1000};updateLastBastion(u);assert(lastBastionActive(u));assert.equal(u.lastStandTimer,duration);assert.equal(lastBastionDamage(u,100),10);
  u.hp=600;updateLastBastion(u,1);assert(lastBastionActive(u));assert.equal(u.lastStandTimer,duration-1);
  u.hp=100;updateLastBastion(u,duration-1);assert(!lastBastionActive(u));updateLastBastion(u,2);assert(!lastBastionActive(u));assert.equal(lastBastionDamage(u,100),100);
  u.hp=601;updateLastBastion(u);assert(!u.lastStandSpent);u.hp=199;updateLastBastion(u);assert(lastBastionActive(u));assert.equal(u.lastStandTimer,duration);
 });
 test(`${type} ends immediately above 60% and shows its own name`,()=>{
  const u={type,hp:100,maxHp:1000};updateLastBastion(u);assert(unitStatuses(u).some(s=>s.name===(type==='grizzly'?'Heart of the Unbroken Wild':'The Crown’s Last Bastion')));
  u.hp=601;updateLastBastion(u);assert(!lastBastionActive(u));assert.equal(u.lastStandTimer,0);
 });
}
test('crossing strike protects only the portion below twenty percent',()=>{
 assert.equal(lastBastionDamage({type:'shieldbearer',hp:250,maxHp:1000},100),55);
 const at={type:'shieldbearer',hp:300,maxHp:1000};assert.equal(lastBastionDamage(at,100),100);assert(!lastBastionActive(at));
 assert.equal(lastBastionDamage({type:'soldier',hp:10,maxHp:1000},100),100);
 const falseHp={type:'grizzly',hp:1000,maxHp:1000,lastLightCurseActive:true};updateLastBastion(falseHp);assert(!lastBastionActive(falseHp));
});
test('real pipeline and saved remaining duration do not refresh the buff',()=>{
 const s=new CrownforgeSimulation({seed:42});s.units=[];const t=s.addUnit('shieldbearer',100,100,'player');t.hp=348;
 assert(Math.abs(s._applyUnitDamage(t,100,null).damage-2)<1e-6);updateLastBastion(t,7);
 const r=new CrownforgeSimulation({seed:42});r.loadSnapshot(s.serialize());const saved=r.units.find(u=>u.id===t.id);assert.equal(saved.lastStandTimer,13);assert(lastBastionActive(saved));
 updateLastBastion(saved,13);assert(!lastBastionActive(saved));assert.equal(lastBastionDamage(saved,100),100);
});
