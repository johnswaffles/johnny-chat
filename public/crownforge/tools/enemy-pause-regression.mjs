import {test} from 'node:test';import assert from 'node:assert/strict';
import {CrownforgeSimulation} from '../src/simulation.js';
import {requestGrizzlyPair,updateWildlife,grizzlySide,spawnGrizzly} from '../src/wildlife.js';
import {updateTeams} from '../src/combat-teams.js';
const finish=s=>{for(let i=0;i<18&&s.wildlifeState.pendingPair;i++){s.clock+=.5;updateWildlife(s,.5);}};
test('default game has no enemy units, and enemy AI never schedules work',()=>{
 const s=new CrownforgeSimulation({seed:42});assert.equal(s.units.filter(u=>u.faction==='enemy').length,0);
 const before=JSON.stringify(s.enemyAIState);s._updateEnemyAI(1000);s._updateEnemyIntent();assert.equal(JSON.stringify(s.enemyAIState),before);
 for(let i=0;i<60;i++)s.update(.25);assert.equal(s.units.filter(u=>u.faction==='enemy').length,0);assert.equal(s.phase,'playing');
});
test('manual button releases one player-side bear, including repeated uncapped requests',()=>{
 for(const seed of [42,71,123]){const s=new CrownforgeSimulation({seed});for(let request=1;request<=2;request++){
 assert(requestGrizzlyPair(s));finish(s);const bears=s.units.filter(u=>u.type==='grizzly');assert.equal(bears.length,request);
 assert(bears.every(b=>grizzlySide(b)==='player'&&s.units.find(u=>u.id===b.attackTarget)?.faction==='player'));
 }}
});
test('automatic player-side cap expires events instead of repeatedly seeking enemy routes',()=>{
 const s=new CrownforgeSimulation({seed:42});s.addUnit('grizzly',50,50,'wildlife');s.addUnit('grizzly',55,55,'wildlife');assert.equal(spawnGrizzly(s),null);
 s.clock=300;updateWildlife(s,.01);assert.equal(s.wildlifeState.nextSpawnAt,600);
});
test('old saves archive enemy units and lower-side bears, and retain them through another save',()=>{
 const old=new CrownforgeSimulation({seed:42,enemyTeamPaused:false});old.addUnit('grizzly',500,400,'wildlife');const before=old.units.length;
 const current=new CrownforgeSimulation({seed:71});assert(current.loadSnapshot(old.serialize()));assert(!current.units.some(u=>u.faction==='enemy'||u.type==='grizzly'&&grizzlySide(u)==='enemy'));
 assert.equal(current.units.length+current.pausedEnemyUnits.length,before);
 const restored=new CrownforgeSimulation({seed:71,enemyTeamPaused:false});assert(restored.loadSnapshot(current.serialize()));assert.equal(restored.units.length,before);
});
test('healer target checks run five times per second while effects keep updating',()=>{
 const s=new CrownforgeSimulation({seed:42});s.units=[];s.buildings=[];s.resourcesNodes=[];s.navigationVersion++;
 const h=s.addUnit('villager',100,100,'player'),t=s.addUnit('shieldbearer',102,100,'player');s.selectedIds=[h.id,t.id];s.assignSelectedTeam();t.hp-=100;
 let checks=0;s._hasCombatLineOfSight=()=>{checks++;return true;};
 for(let i=0;i<60;i++)updateTeams(s,1/60);
 assert(checks>=4&&checks<=6,`checks=${checks}`);
});

test('manual release remains available when the automatic cap is already full',()=>{
 const s=new CrownforgeSimulation({seed:42});s.addUnit('grizzly',250,100,'wildlife');s.addUnit('grizzly',260,100,'wildlife');
 assert(requestGrizzlyPair(s));finish(s);assert.equal(s.units.filter(u=>u.type==='grizzly').length,3);
});
