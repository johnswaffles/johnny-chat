import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CrownforgeSimulation} from '../src/simulation.js';
import {UNIT_TYPES} from '../src/config.js';
import {unitStatuses} from '../src/unit-status.js';
for(const damageType of ['weapon','arrow','projectile','magic','lightning','curse','unknown'])test(`Hearthkin blocks ${damageType} and awakens ward without health loss`,()=>{
 const s=new CrownforgeSimulation({seed:42});s.units=[];
 const h=s.addUnit('villager',100,100,'player'),ally=s.addUnit('spearwarden',103,100,'player'),bear=s.addUnit('grizzly',110,100,'wildlife');
 const hp=h.hp;const hit=s._applyUnitDamage(h,99999,bear,{damageType,areaOfEffect:true});
 assert.equal(hit.damage,0);assert.equal(h.hp,hp);assert.equal(h.dead,false);assert.equal(h.lastLightWardTimer,60);assert.equal(ally.lastLightChorusTimer,60);
 h.lastLightWardTimer=40;s._applyUnitDamage(h,99999,bear,{damageType});assert.equal(h.lastLightWardTimer,40);assert.equal(h.hp,hp);
 h.lastLightWardTimer=0;s._applyUnitDamage(h,1,bear,{damageType});assert.equal(h.lastLightWardTimer,60);
 assert(UNIT_TYPES.villager.harmImmune);assert.match(unitStatuses(h).find(s=>s.id==='beyondFirstOath').detail,/all harm/);
});
