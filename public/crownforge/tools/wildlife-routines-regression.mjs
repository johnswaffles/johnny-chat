import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CrownforgeSimulation} from '../src/simulation.js';
import {UNIT_TYPES,ENEMY_AI} from '../src/config.js';
import {updateWildlife,spawnGrizzly,initialWildlifeState} from '../src/wildlife.js';
import {assignEnemyEconomy,assignEnemyPatrols} from '../src/enemy-routines.js';

function arena(){
 const s=new CrownforgeSimulation({seed:42});s.units=[];s.resourcesNodes=[];s.buildings=[];s.navigationVersion++;
 s._checkVictory=()=>{};s._updateEnemyAI=()=>{};s._updateEnemyIntent=()=>{};return s;
}
function advance(s,seconds){for(let i=0;i<Math.ceil(seconds*60);i++)s._updateFixed(1/60);}

test('five-minute grizzly encounters use real woodland, legal routes, both settlements and saved cadence',()=>{
 const s=new CrownforgeSimulation({seed:42});
 s.clock=299.99;updateWildlife(s,.1);assert.equal(s.units.filter(u=>u.type==='grizzly').length,0);
 let first;for(let t=300;t<=305&&!first;t++){s.clock=t;updateWildlife(s,1);first=s.units.find(u=>u.type==='grizzly');}
 assert(first,'a bear emerges at the five-minute event');assert.equal(first.faction,'wildlife');assert(first.path.length);
 assert(!s._pointBlockedForUnit(first,first),'bear spawns outside actual collision');
 assert(s.resourcesNodes.some(n=>n.type==='tree'&&n.amount>0&&Math.hypot(n.x-first.x,n.z-first.z)<7));
 assert.equal(s.units.find(u=>u.id===first.attackTarget).faction,'player');
 assert.equal(s.wildlifeState.nextSpawnAt,600);
 const snapshot=s.serialize(),restored=new CrownforgeSimulation({seed:71});assert(restored.loadSnapshot(snapshot));
 assert.equal(restored.wildlifeState.nextSpawnAt,600);assert.equal(restored.units.filter(u=>u.type==='grizzly').length,1);
 for(let t=600;t<=610&&restored.wildlifeState.spawnCount<2;t++){restored.clock=t;updateWildlife(restored,1);}
 assert.equal(restored.wildlifeState.spawnCount,2);assert.equal(restored.wildlifeState.nextSpawnAt,900);
 const second=restored.units.filter(u=>u.type==='grizzly').at(-1);assert.equal(restored.units.find(u=>u.id===second.attackTarget).faction,'enemy');
 const old={...snapshot,clock:747};delete old.wildlifeState;
 assert(restored.loadSnapshot(old));assert.equal(restored.wildlifeState.nextSpawnAt,900,'old saves get the next future event, no catch-up flood');
 assert.deepEqual(initialWildlifeState(0).nextSpawnAt,300);
});

test('grizzlies target either faction, reacquire people and support actual player attack orders',()=>{
 const s=arena(),bear=s.addUnit('grizzly',110,100,'wildlife');
 const crown=s.addUnit('soldier',120,100,'player'),ashen=s.addUnit('raider',114,100,'enemy');
 updateWildlife(s,1);assert.equal(bear.attackTarget,ashen.id,'closest person is on the other team');
 s._killUnit(ashen,crown);s.clock+=1;updateWildlife(s,1);assert.equal(bear.attackTarget,crown.id);
 s.selectEntity(bear);assert.equal(s.selectedIds.length,0,'wildlife cannot become a controllable Crown unit');
 s.selectEntity(crown);const result=s.issueContextCommand(bear,bear);assert.equal(result.kind,'attack');assert.equal(crown.attackTarget,bear.id);
});

test('two Crown Guards can kill the powerful bear with a casualty; one cannot reliably win',()=>{
 for(const count of [1,2]){
  const s=arena(),bear=s.addUnit('grizzly',110,100,'wildlife');
  const guards=Array.from({length:count},(_,i)=>s.addUnit('soldier',105,99+i*3,'player'));
  guards.forEach((u,i)=>s._sendUnitToAttack(u,bear,i*4));advance(s,20);
  if(count===1){assert(guards[0].dead);assert(!bear.dead);}
  else{assert(bear.dead);assert.equal(guards.filter(u=>u.dead).length,1);assert(guards.some(u=>!u.dead&&u.hp>0));}
 }
});

test('the existing Last Light Ward repeatedly prevents either faction worker from dying to the bear',()=>{
 for(const [type,faction] of [['villager','player'],['ashenForager','enemy']]){
  const s=arena(),worker=s.addUnit(type,100,100,faction),bear=s.addUnit('grizzly',102,100,'wildlife');
  for(let cycle=0;cycle<3;cycle++){
   worker.hp=1;const result=s._applyUnitDamage(worker,1000,bear);
   assert(result.warded&&!result.killed);assert.equal(worker.hp,worker.maxHp);assert(worker.lastLightWardTimer>0);
   const blocked=s._applyUnitDamage(worker,1000,bear);assert(blocked.blocked);assert(!worker.dead);
   s._updateUnitStatusEffects(worker,2);assert.equal(bear.hp,1,'ward curse retains its existing effect');
   s._updateUnitStatusEffects(worker,61);assert.equal(worker.lastLightWardTimer,0);assert.equal(worker.hp,worker.maxHp);
  }
 }
});

test('enemy workers abandon stale orders and try reachable supplies beyond an enclosed preferred tree',()=>{
 const s=arena(),worker=s.addUnit('ashenForager',100,100,'enemy');
 const enclosed=s.addResource('tree','wood',111,100,240);
 for(let i=0;i<24;i++){const a=i/24*Math.PI*2;s.addResource('stone','stone',111+Math.cos(a)*8,100+Math.sin(a)*8,300);}
 const food=s.addResource('berry','food',95,101,300);
 worker.gatherTarget=enclosed.id;worker.gatherIntent={resourceType:'wood'};worker.command='idle';worker.buildTarget=999;
 s.enemyResources.wood=0;s.enemyResources.food=0;
 assignEnemyEconomy(s);
 assert.equal(worker.command,'gather');assert.equal(worker.gatherTarget,food.id);assert(worker.path.length);
 assert.equal(worker.buildTarget,null);assert.equal(worker.gatherPersistent,false,'AI does not camp forever on a blocked source');
 food.amount=0;worker.path=[];s._updateGathering(worker,1);assignEnemyEconomy(s);
 assert.notEqual(worker.gatherTarget,food.id,'depleted jobs get replaced');
});

test('idle enemy military form a legal recurring perimeter route and resume after combat',()=>{
 const s=new CrownforgeSimulation({seed:42}),camp=s._enemyCamp(),guard=s._enemyMilitary()[0];
 assignEnemyPatrols(s,camp);assert(guard.patrolActive);assert(guard.patrolPoints.length>=2);assert(guard.path.length);
 const start={x:guard.x,z:guard.z};advance(s,30);
 assert(Math.hypot(start.x-guard.x,start.z-guard.z)>2);assert(guard.patrolActive||guard.command==='attack');
 s._interruptWork(guard);guard.command='idle';guard.path=[];assignEnemyPatrols(s,camp);
 assert(guard.patrolActive);assert(guard.path.length);
 for(const point of guard.patrolPoints)assert(!s._pointBlockedForUnit(guard,point));
});

test('fifteen-minute forest economy keeps delivering through three woodland encounters',()=>{
 const s=new CrownforgeSimulation({seed:42}),idle=new Map(),samples=[],deposits=new Set();
 const emit=s.animation.emit.bind(s.animation);s.animation.emit=(unit,name,payload)=>{if(unit.faction==='enemy'&&name==='deposit_complete')deposits.add(unit.id);return emit(unit,name,payload);};
 let activeSamples=0,totalSamples=0,maxIdle=0;
 for(let frame=0;frame<920*60;frame++){
  const t=performance.now();s._updateFixed(1/60);samples.push(performance.now()-t);
  if(frame%60===0)for(const worker of s._enemyWorkers()){
   const busy=worker.command!=='idle'||worker.path.length>0;
   totalSamples++;if(busy)activeSamples++;
   idle.set(worker.id,busy?0:(idle.get(worker.id)??0)+1);maxIdle=Math.max(maxIdle,idle.get(worker.id));
  }
 }
 assert(activeSamples/totalSamples>.95,`active ${(activeSamples/totalSamples*100).toFixed(1)}%`);
 assert(maxIdle<=3,`longest idle stretch ${maxIdle}s`);
 assert(deposits.size>=4,'opening workers and the newly trained worker all make real resource deposits');
 assert.equal(s.wildlifeState.spawnCount,3);
 assert.equal(s.phase,'playing');
 assert(s._enemyTownBuildings().some(b=>b.type!=='ashenCamp'&&b.progress>=1),'construction progresses');
 const sorted=samples.sort((a,b)=>a-b);
 console.log(JSON.stringify({enemyActivity:+(activeSamples/totalSamples*100).toFixed(1),maxIdleSeconds:maxIdle,depositWorkers:deposits.size,simulationP99:+sorted[Math.floor(sorted.length*.99)].toFixed(2),maxUpdate:+sorted.at(-1).toFixed(2)}));
});

test('small collision oscillations cannot keep a stranded enemy resource job forever',()=>{
 const s=arena(),worker=s.addUnit('ashenForager',100,100,'enemy');
 const tree=s.addResource('tree','wood',106,100,500),food=s.addResource('berry','food',95,101,500);
 worker.command='gather';worker.gatherTarget=tree.id;worker.path=[{x:104,z:100}];
 s.enemyResources.wood=0;s.enemyResources.food=0;
 for(let second=0;second<=9;second++){
  s.clock=second;worker.x=100+(second%2)*.25;assignEnemyEconomy(s);
 }
 assert.notEqual(worker.gatherTarget,tree.id,'the oscillating job is temporarily avoided');
 assert.equal(worker.gatherTarget,food.id);
 assert(worker.economyAvoid[tree.id]>s.clock);
});

test('a bear unable to land a hit moves on to another reachable person',()=>{
 const s=arena(),bear=s.addUnit('grizzly',100,100,'wildlife');
 const first=s.addUnit('soldier',105,100,'player'),other=s.addUnit('raider',107,102,'enemy');
 s._sendUnitToAttack(bear,first,0);updateWildlife(s,1);
 for(let second=1;second<=8;second++){
  s.clock=second;bear.x=100+(second%2)*.25;updateWildlife(s,1);
 }
 assert.equal(bear.attackTarget,other.id);assert(bear.path.length);
 assert(bear.wildlifeAvoid[first.id]>s.clock);
});

test('enemy routines resume unfinished construction and retain productive field work',()=>{
 const s=arena(),worker=s.addUnit('ashenForager',100,100,'enemy');
 const project=s.addBuilding('homestead',108,100,'enemy',.04);
 assignEnemyEconomy(s);assert.equal(worker.buildTarget,project.id);
 for(let i=0;i<90;i++){advance(s,1);assignEnemyEconomy(s);}
 assert.equal(project.progress,1,'the interrupted project is completed');
 s._interruptWork(worker);s.units=[worker];s.buildings=[];s.navigationVersion++;
 worker.x=100;worker.z=100;
 const field=s.addBuilding('field',100,100,'enemy');
 s._sendUnitToField(worker,field);field.farmerId=worker.id;
 const food=s.enemyResources.food;
 for(let i=0;i<30;i++){advance(s,1);assignEnemyEconomy(s);}
 assert.equal(worker.fieldTarget,field.id);assert(s.enemyResources.food>food);
});

test('perimeter patrols yield to the existing enemy raid orders',()=>{
 const s=arena(),camp=s.addBuilding('ashenCamp',100,100,'enemy'),core=s.addBuilding('townCenter',160,160,'player');
 const guards=Array.from({length:ENEMY_AI.minRaidSize+1},(_,i)=>s.addUnit('raider',120+i*2,112,'enemy'));
 for(let i=0;i<guards.length;i++)assignEnemyPatrols(s,camp);
 assert(guards.some(u=>u.patrolActive));assert(s._sendEnemyRaid(core));
 assert(s.enemyAIState.raidWaveIds.length>=ENEMY_AI.minRaidSize);
 for(const u of guards.filter(u=>s.enemyAIState.raidWaveIds.includes(u.id))){
  assert.equal(u.attackTarget,core.id);assert.equal(u.command,'attack');assert.equal(u.patrolActive,false);
 }
});
