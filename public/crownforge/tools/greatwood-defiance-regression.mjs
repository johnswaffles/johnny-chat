import {test} from 'node:test';import assert from 'node:assert/strict';
import {updateGreatwoodDefiance,bearIncomingDamage,bearCrowdMultiplier} from '../src/bear-combat.js';
import {strikeDamage,unitStatuses} from '../src/unit-status.js';
import {CrownforgeSimulation} from '../src/simulation.js';
import {initialWildlifeState} from '../src/wildlife.js';
const bear=()=>({type:'grizzly',hp:180,maxHp:180,x:0,z:0});
const person=(x=0)=>({type:'villager',faction:'player',hp:100,x,z:0});
test('Defiance counts living people within thirty yards and updates as they leave or die',()=>{
 const b=bear(),inside=person(30),outside=person(30.01),dead={...person(),dead:true},enemy={...person(),faction:'enemy',type:'soldier'};
 const units=[b,inside,outside,dead,enemy,{...bear(),faction:'wildlife'}];updateGreatwoodDefiance(b,units);assert.equal(b.greatwoodDefianceStacks,2);assert.equal(bearCrowdMultiplier(b),1.1);
 inside.x=31;enemy.hp=0;updateGreatwoodDefiance(b,units,.25);assert.equal(b.greatwoodDefianceStacks,0);
});
test('damage and proportional armor stack without immunity and appear in lore',()=>{
 const b=bear(),target={type:'soldier',hp:100,maxHp:100};const base=strikeDamage(b,target);updateGreatwoodDefiance(b,Array.from({length:20},()=>person()));assert.equal(strikeDamage(b,target),base*2);assert.equal(bearIncomingDamage(b,100),25);assert.equal(bearIncomingDamage(b,100,'arrow'),1.5);assert(unitStatuses(b).some(s=>s.id==='greatwoodDefiance'&&s.detail.includes('+100%')));
 b.greatwoodDefianceStacks=1000;assert(bearIncomingDamage(b,100)>0);
});
test('four minute cadence migrates old saves without spawning a catch-up wave',()=>{
 assert.equal(initialWildlifeState(0).nextSpawnAt,240);const s=new CrownforgeSimulation({seed:42}),snapshot=s.serialize();snapshot.clock=301;snapshot.wildlifeState={nextSpawnAt:600,spawnCount:1};s.loadSnapshot(snapshot);assert.equal(s.wildlifeState.nextSpawnAt,480);assert.equal(s.wildlifeState.spawnCount,1);
});
