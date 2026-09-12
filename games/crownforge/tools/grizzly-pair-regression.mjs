import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CrownforgeSimulation} from '../src/simulation.js';
import {requestGrizzlyPair,updateWildlife,GRIZZLY_ENCOUNTER} from '../src/wildlife.js';
const bears=s=>s.units.filter(u=>u.type==='grizzly');
function finish(s){for(let i=0;i<18&&s.wildlifeState.pendingPair;i++){s.clock+=.5;updateWildlife(s,.5);}}
test('one request releases both factions bears on the same tick, with safe woodland routes',()=>{
 for(const seed of [42,71,123]){
  const s=new CrownforgeSimulation({enemyTeamPaused:false,seed});const due=s.wildlifeState.nextSpawnAt;
  assert(requestGrizzlyPair(s));finish(s);assert.equal(bears(s).length,2,'seed '+seed);
  const [a,b]=bears(s);assert.equal(a.wildlifeBornAt,b.wildlifeBornAt);
  assert.deepEqual(bears(s).map(u=>s.units.find(t=>t.id===u.attackTarget).faction),['player','enemy']);
  for(const u of bears(s)){assert(u.path.length);assert(!s._pointBlockedForUnit(u,u));assert(s.resourcesNodes.some(n=>n.type==='tree'&&n.amount>0&&Math.hypot(n.x-u.x,n.z-u.z)<7));}
  assert.equal(s.wildlifeState.nextSpawnAt,due);assert.equal(s.wildlifeState.spawnCount,2);
  assert(requestGrizzlyPair(s));finish(s);assert.equal(bears(s).length,4);
 }
});
test('blocked side never releases half a pair; retries are bounded and duplicate clicks ignored',()=>{
 const s=new CrownforgeSimulation({enemyTeamPaused:false,seed:42});const real=s._bestCombatRoute.bind(s);let calls=0;
 s._bestCombatRoute=(u,t)=>{calls++;return t.faction==='enemy'?null:real(u,t);};
 assert(requestGrizzlyPair(s));assert(s.wildlifeState.pendingPair);assert(!requestGrizzlyPair(s));assert.equal(bears(s).length,0);
 assert(calls<=GRIZZLY_ENCOUNTER.spawnRouteBudget*2);
 finish(s);assert.equal(bears(s).length,0);assert.equal(s.wildlifeState.pendingPair,null);
});
test('a pending pair survives saving and waits for protected targets to become eligible',()=>{
 const s=new CrownforgeSimulation({enemyTeamPaused:false,seed:42});for(const u of s.units)if(u.faction==='enemy')u.lastLightWardTimer=20;
 assert(requestGrizzlyPair(s));assert(s.wildlifeState.pendingPair);assert.equal(bears(s).length,0);
 const saved=s.serialize(),copy=new CrownforgeSimulation({enemyTeamPaused:false,seed:71});assert(copy.loadSnapshot(saved));
 for(const u of copy.units)u.lastLightWardTimer=0;
 finish(copy);assert.equal(bears(copy).length,2);assert.equal(copy.wildlifeState.nextSpawnAt,240);
});
test('finished matches or a missing faction reject the release without adding bears',()=>{
 const s=new CrownforgeSimulation({enemyTeamPaused:false,seed:42});s.phase='victory';assert(!requestGrizzlyPair(s));
 s.phase='playing';s.units=s.units.filter(u=>u.faction==='player');assert(!requestGrizzlyPair(s));assert.equal(bears(s).length,0);
});
