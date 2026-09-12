import {test} from 'node:test';import assert from 'node:assert/strict';
import {lastBastionActive,lastBastionDamage,unitStatuses} from '../src/unit-status.js';
import {CrownforgeSimulation} from '../src/simulation.js';
test('Last Bastion applies below 20%, ends on healing, and does not affect other units',()=>{
 const tank={type:'shieldbearer',hp:199,maxHp:1000};assert(lastBastionActive(tank));assert.equal(lastBastionDamage(tank,100),10);assert(unitStatuses(tank).some(s=>s.id==='crownsLastBastion'));
 tank.hp=200;assert(!lastBastionActive(tank));assert(!unitStatuses(tank).some(s=>s.id==='crownsLastBastion'));tank.hp=400;assert.equal(lastBastionDamage(tank,100),100);
 assert.equal(lastBastionDamage({...tank,type:'soldier',hp:100},100),100);tank.dead=true;assert(!lastBastionActive(tank));
});
test('crossing strike protects only the damage below the threshold',()=>{
 const tank={type:'shieldbearer',hp:250,maxHp:1000};assert.equal(lastBastionDamage(tank,100),55);assert.equal(lastBastionDamage({...tank,hp:200},100),10);assert.equal(lastBastionDamage({...tank,hp:300},100),100);
});
test('real damage pipeline stacks armor and Last Bastion, survives save/load, and remains killable',()=>{
 const s=new CrownforgeSimulation({seed:42});s.units=[];const t=s.addUnit('shieldbearer',100,100,'player');t.hp=348;
 const hit=s._applyUnitDamage(t,100,null);assert(Math.abs(hit.damage-2)<1e-6);assert.equal(t.hp,346);
 const saved=s.serialize(),r=new CrownforgeSimulation({seed:42});r.loadSnapshot(saved);assert(lastBastionActive(r.units.find(u=>u.id===t.id)));
 s._applyUnitDamage(t,20000,null);assert(t.dead);assert.equal(t.hp,0);
});
