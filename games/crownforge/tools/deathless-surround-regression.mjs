import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CrownforgeSimulation} from '../src/simulation.js';
import {lastBastionDamage,updateLastBastion,unitStatuses} from '../src/unit-status.js';
import {deathlessActive,updateDeathlessHeart} from '../src/deathless-heart.js';
import {encounterOpenness,findPullClearing,prepareTankPull,bearRearPosition,updateTeams,updateTeamApproaches} from '../src/combat-teams.js';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function arena(){const s=new CrownforgeSimulation({seed:42});s.units=[];s.buildings=[];s.resourcesNodes=[];s.decorations=[];s.navigationVersion++;s._checkVictory=()=>{};s._updateEnemyAI=()=>{};s._updateEnemyIntent=()=>{};return s;}
test('Deathless uses true HP, lasts sixty seconds through healing, cannot retrigger, and rearms above sixty percent',()=>{
 const b={type:'grizzly',hp:50,maxHp:1000,lastLightCurseActive:true};updateLastBastion(b);assert(!deathlessActive(b));b.hp=49;updateLastBastion(b);assert(deathlessActive(b));assert.equal(lastBastionDamage(b,100),1);assert(unitStatuses(b).some(x=>x.id==='deathlessHeart'));
 b.hp=800;updateDeathlessHeart(b,59);assert(deathlessActive(b));assert.equal(b.deathlessTimer,1);b.hp=49;updateDeathlessHeart(b,1);assert(!deathlessActive(b));updateDeathlessHeart(b,1);assert(!deathlessActive(b));b.hp=601;updateDeathlessHeart(b);b.hp=49;updateDeathlessHeart(b);assert(deathlessActive(b));
 b.dead=true;updateDeathlessHeart(b);assert(!deathlessActive(b));
});
test('crossing hit protects only the actual below-five-percent portion and replaces ordinary Heart reduction',()=>{
 const b={type:'grizzly',hp:60,maxHp:1000};assert.equal(lastBastionDamage(b,200),11);assert(deathlessActive(b));
 const whole={type:'grizzly',hp:250,maxHp:1000};assert.equal(lastBastionDamage(whole,1750),202);assert(deathlessActive(whole));
 const tank={type:'shieldbearer',hp:40,maxHp:1000};assert.equal(lastBastionDamage(tank,100),10);assert(!deathlessActive(tank));
 const decoy={type:'grizzly',hp:1000,maxHp:1000,lastLightCurseActive:true};assert.equal(lastBastionDamage(decoy,10),10);assert(!deathlessActive(decoy));
});
test('Deathless timer and spent state survive real saves',()=>{
 const s=arena(),b=s.addUnit('grizzly',180,180,'wildlife');b.hp=8;updateLastBastion(b);updateDeathlessHeart(b,17);const copy=arena();copy.loadSnapshot(s.serialize());const saved=copy.units.find(u=>u.id===b.id);assert.equal(saved.deathlessTimer,43);assert(saved.deathlessSpent);assert.equal(lastBastionDamage(saved,100),1);
});
for(const obstacle of ['tree','wall','homestead'])test(`tank finds and physically pulls a bear away from ${obstacle}`,()=>{
 const s=arena(),b=s.addUnit('grizzly',180,180,'wildlife'),t=s.addUnit('shieldbearer',192,180,'player');b.greatwoodEnraged=true;b.maxHp=b.hp=180000;t.hp=t.maxHp=348000;t.teamId=1;
 const dps=Array.from({length:6},(_,i)=>{const u=s.addUnit('spearwarden',198+i%3*2,176+Math.floor(i/3)*3,'player');u.teamId=1;return u;});
 if(obstacle==='tree')s.addResource('tree','wood',174,180,2400,0,{sizeTier:'large'});
 else if(obstacle==='wall')s.addBuilding('wall',174,180,'player',1,{wallSegments:5,wallDirection:{x:0,z:1},wallStart:{x:174,z:174}});
 else s.addBuilding('homestead',172,180,'player',1);
 const initial=encounterOpenness(s,b),start={x:b.x,z:b.z};assert(initial<.97,`fixture must obstruct a surround: ${initial}`);
 // Isolate positioning from the separate percentage-AoE survival tests.
 s._applyGrizzlyCleave=()=>{};
 for(const u of [t,...dps])s._sendUnitToAttack(u,b);
 let pulled=false;
 for(let i=0;i<2400;i++){s.clock+=1/60;s.repathBudgetRemaining=8;updateTeamApproaches(s);updateTeams(s,1/60);for(const u of s.units)if(!u.dead)s._updateUnit(u,1/60);s._resolveUnitCollisions();pulled ||= Boolean(t.tankPull);}
 assert(pulled,JSON.stringify({obstacle,initial,final:encounterOpenness(s,b),b:{x:b.x,z:b.z,hp:b.hp,threat:b.threatTankId},t:{x:t.x,z:t.z,command:t.command,label:t.actionLabel,pull:t.tankPull},plan:findPullClearing(s,t,b)}));assert(dist(b,start)>4,`enemy moved ${dist(b,start)}`);assert(encounterOpenness(s,b)>.96,'enemy ends in open ground');assert.equal(b.threatTankId,t.id);assert(b.hp<179950,'party lands damage after pulling');
 for(let i=0;i<dps.length;i++)for(let j=i+1;j<dps.length;j++)assert(dist(dps[i],dps[j])>.9,'fighters must not share positions');
});
test('pull plans also work for humanoids, respect blocked routes, and manual movement cancels pulling',()=>{
 const s=arena(),b=s.addUnit('soldier',180,180,'enemy'),t=s.addUnit('shieldbearer',187,180,'player'),d=s.addUnit('soldier',190,180,'player');t.teamId=d.teamId=1;s.addResource('tree','wood',177,180,2400,0,{sizeTier:'large'});s._sendUnitToAttack(t,b);s._applyUnitDamage(b,1,t);s.repathBudgetRemaining=8;
 assert(prepareTankPull(s,t,b));assert(t.tankPull);s._interruptWork(t);assert.equal(t.tankPull,null);
 s._pathSegmentBlocked=()=>true;assert.equal(findPullClearing(s,t,b),null);
});
test('stable surround reservations survive casualties, arrivals and extend to humanoid enemies',()=>{
 for(const type of ['grizzly','soldier']){
 const s=arena(),b=s.addUnit(type,180,180,'enemy'),t=s.addUnit('shieldbearer',189,180,'player');t.teamId=1;s._applyUnitDamage(b,1,t);
 const party=Array.from({length:12},()=>{const d=s.addUnit('spearwarden',195,185,'player');d.teamId=1;d.attackTarget=b.id;return d;});const first=party.map(u=>bearRearPosition(s,u,b));assert(first.every(Boolean));assert.equal(new Set(first.map(p=>`${p.x},${p.z}`)).size,12);
 party[1].dead=true;for(let i=2;i<party.length;i++)assert.deepEqual(bearRearPosition(s,party[i],b),first[i]);
 const newcomer=s.addUnit('spearwarden',195,185,'player');newcomer.teamId=1;newcomer.attackTarget=b.id;assert.deepEqual(bearRearPosition(s,newcomer,b),first[1]);
 }
});

test('humanoid enemy follows its tank into the clearing and melee fighters keep distinct attack positions',()=>{
 const s=arena(),b=s.addUnit('soldier',180,180,'enemy'),t=s.addUnit('shieldbearer',187,180,'player');b.hp=b.maxHp=100000;t.hp=t.maxHp=100000;t.teamId=1;
 const party=Array.from({length:4},(_,i)=>{const u=s.addUnit('spearwarden',194+i*2,180,'player');u.teamId=1;return u;});s.addResource('tree','wood',177,180,2400,0,{sizeTier:'large'});
 for(const u of [t,...party])s._sendUnitToAttack(u,b);
 let pulled=false;for(let i=0;i<2400;i++){s.clock+=1/60;s.repathBudgetRemaining=8;updateTeamApproaches(s);for(const u of s.units)if(!u.dead)s._updateUnit(u,1/60);s._resolveUnitCollisions();pulled ||= Boolean(t.tankPull);}
 assert(pulled);assert(dist(b,{x:180,z:180})>4);assert.equal(encounterOpenness(s,b),1);assert(b.hp<99900);
 for(let i=0;i<party.length;i++)for(let j=i+1;j<party.length;j++)assert(dist(party[i],party[j])>.8);
});

test('a stalled pull exits within its progress timeout and cannot spin-replan each frame',()=>{
 const s=arena(),b=s.addUnit('grizzly',180,180,'wildlife'),t=s.addUnit('shieldbearer',192,180,'player'),d=s.addUnit('soldier',197,180,'player');b.greatwoodEnraged=true;t.teamId=d.teamId=1;s.addResource('tree','wood',174,180,2400,0,{sizeTier:'large'});
 s._sendUnitToAttack(t,b);s._applyUnitDamage(b,1,t);s.repathBudgetRemaining=8;assert(prepareTankPull(s,t,b));assert(t.tankPull);
 s.clock=4.1;assert(!prepareTankPull(s,t,b));assert.equal(t.tankPull,null);const budget=s.repathBudgetRemaining;
 for(let i=0;i<60;i++)assert(!prepareTankPull(s,t,b));assert.equal(s.repathBudgetRemaining,budget);assert.equal(t.command,'attack');
});
