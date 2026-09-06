import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CrownforgeSimulation} from '../src/simulation.js';
import {UNIT_TYPES} from '../src/config.js';
import {rallyBearDefenders,BEAR_RESPONSE} from '../src/wildlife.js';
import {grizzlyPose,grizzlyProjection,grizzlyAttackClock,updateGrizzlyMotion,GRIZZLY_MOTION,GRIZZLY_ATTACKS} from '../src/grizzly-motion.js';

function arena(){const s=new CrownforgeSimulation({seed:42});s.units=[];s.resourcesNodes=[];s.buildings=[];s.navigationVersion++;s._checkVictory=()=>{};s._updateEnemyAI=()=>{};s._updateEnemyIntent=()=>{};return s;}
const near=(a,b,epsilon=1e-5)=>assert(Math.abs(a-b)<epsilon,`${a} != ${b}`);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

test('all four walking views keep supporting paws on the ground with constant bone lengths',()=>{
 for(let d=0;d<4;d++)for(let i=0;i<200;i++){
  const pose=grizzlyPose({direction:d,walking:1,travel:i/200*GRIZZLY_MOTION.strideLength});
  let supporting=0;
  for(const l of Object.values(pose.legs)){
   near(dist(l.root,l.knee),l.upper);near(dist(l.knee,l.ankle),l.lower);
   if(l.planted){near(l.paw.y,4);supporting++;}
  }
  assert(supporting>=2,'at least two weight-bearing paws');
 }
});

test('supporting paws cancel actual ground travel and cycle seams are continuous',()=>{
 const travel=.1,delta=.00001,scale=218/GRIZZLY_MOTION.modelSize;
 const a=grizzlyPose({walking:1,travel}),b=grizzlyPose({walking:1,travel:travel+delta});
 const pa=grizzlyProjection(a.legs.hindLeft.paw),pb=grizzlyProjection(b.legs.hindLeft.paw);
 near((pb.x-pa.x)*scale+26*delta,0);near((pb.y-pa.y)*scale+13*delta,0);
 const before=grizzlyPose({walking:1,travel:GRIZZLY_MOTION.strideLength-1e-6});
 const after=grizzlyPose({walking:1,travel:1e-6});
 for(const name of Object.keys(before.legs))assert(dist(before.legs[name].paw,after.legs[name].paw)<.002);
 const unit={attackPhase:'approach'};updateGrizzlyMotion(unit,1/60,.05);const stride=unit.grizzlyTravel;
 for(let i=0;i<90;i++)updateGrizzlyMotion(unit,1/60,0);
 assert.equal(unit.grizzlyTravel,stride);assert.equal(unit.grizzlyWalkBlend,0);
});

test('rear-up plants hind paws, raises the chest and returns to the exact ready pose',()=>{
 const ready=grizzlyPose(),d=GRIZZLY_ATTACKS.rear;
 const raised=grizzlyPose({attack:'rear',attackTime:d.duration*d.anticipation});
 assert(raised.head.y-ready.head.y>55);assert(raised.shoulder.y-ready.shoulder.y>55);
 for(const name of ['hindLeft','hindRight']){near(raised.legs[name].paw.y,4);near(dist(raised.legs[name].paw,ready.legs[name].paw),0);}
 assert(raised.legs.frontLeft.paw.y>100&&raised.legs.frontRight.paw.y>100);
 const end=grizzlyPose({attack:'rear',attackTime:d.duration});
 near(dist(ready.head,end.head),0);for(const name of Object.keys(ready.legs))near(dist(ready.legs[name].paw,end.legs[name].paw),0);
 for(const [name,definition] of Object.entries(GRIZZLY_ATTACKS)){
  const wind=definition.duration*definition.anticipation,contact=definition.duration*definition.contact;
  near(grizzlyAttackClock({grizzlyAttackVariant:name,attackPhase:'anticipation',attackPhaseElapsed:wind}),grizzlyAttackClock({grizzlyAttackVariant:name,attackPhase:'contact',attackPhaseElapsed:0}));
  near(grizzlyAttackClock({grizzlyAttackVariant:name,attackPhase:'contact',attackPhaseElapsed:contact}),grizzlyAttackClock({grizzlyAttackVariant:name,attackPhase:'recovery',attackPhaseElapsed:0}));
 }
});

test('actual bear combat alternates paws, rears every third attack and applies one contact hit per cycle',()=>{
 const s=arena(),bear=s.addUnit('grizzly',100,100,'wildlife'),target=s.addUnit('soldier',101.4,100,'player');
 target.hp=target.maxHp=10000;s._sendUnitToAttack(bear,target);
 const hits=[];const apply=s._applyUnitDamage.bind(s);s._applyUnitDamage=(t,damage,u)=>{if(u===bear)hits.push({cycle:u.grizzlyAttackCount,variant:u.grizzlyAttackVariant,phase:u.attackPhase,time:u.attackPhaseElapsed});return apply(t,damage,u)};
 for(let i=0;i<15*60;i++)s._updateAttack(bear,1/60);
 assert(hits.length>=7);assert.equal(new Set(hits.map(h=>h.cycle)).size,hits.length);
 for(const hit of hits){assert.equal(hit.variant,hit.cycle%3===0?'rear':'swipe');assert.equal(hit.phase,'contact');const d=GRIZZLY_ATTACKS[hit.variant];assert(hit.time>=d.duration*d.contact*.2&&hit.time<d.duration*d.contact*.2+1/60+.0001);}
 const saved=s.serialize(),restored=arena();assert(restored.loadSnapshot(saved));const copy=restored.units.find(u=>u.id===bear.id);assert.equal(copy.grizzlyAttackCount,bear.grizzlyAttackCount);assert.equal(copy.grizzlyAttackVariant,bear.grizzlyAttackVariant);
});

test('a rear-up strike completes its follow-through when prey escapes and cannot hit out of range',()=>{
 const s=arena(),bear=s.addUnit('grizzly',100,100,'wildlife'),target=s.addUnit('soldier',101.4,100,'player');
 s._sendUnitToAttack(bear,target);bear.grizzlyAttackCount=2;s._updateAttack(bear,1/60);
 assert.equal(bear.grizzlyAttackVariant,'rear');const facing=bear.facing,hp=target.hp;
 target.x=90;target.z=90;
 const phases=new Set();for(let i=0;i<2.3*60;i++){phases.add(bear.attackPhase);s._updateAttack(bear,1/60);assert.equal(bear.facing,facing);}
 assert(phases.has('contact')&&phases.has('recovery'));assert.equal(bear.attackPhase,'approach');assert.equal(target.hp,hp);
});

test('every fighting class on either team responds from far beyond ordinary aggro range',()=>{
 const types=Object.entries(UNIT_TYPES).filter(([name,r])=>name!=='grizzly'&&!r.worker&&r.attack>0&&r.canAttackUnits!==false).map(([name])=>name);
 assert.equal(types.length,10);
 for(const faction of ['player','enemy'])for(const type of types){
  const s=arena(),u=s.addUnit(type,100,100,faction),b=s.addUnit('grizzly',200,100,'wildlife');
  rallyBearDefenders(s);assert.equal(u.attackTarget,b.id,`${faction} ${type}`);assert(u.path.length);assert(u.bearResponse);
 }
});

test('bear response preserves existing fights, ignores workers and respects its outer radius',()=>{
 const s=arena(),u=s.addUnit('soldier',100,100,'player'),enemy=s.addUnit('raider',103,100,'enemy');
 const bear=s.addUnit('grizzly',125,100,'wildlife');s._sendUnitToAttack(u,enemy);s._sendUnitToAttack(enemy,u);
 const worker=s.addUnit('villager',110,105,'player'),far=s.addUnit('soldier',125+BEAR_RESPONSE.radius+1,100,'player');
 rallyBearDefenders(s);assert.equal(u.attackTarget,enemy.id);assert.equal(enemy.attackTarget,u.id);assert.equal(worker.attackTarget,null);assert.equal(far.attackTarget,null);
});

test('patrol, guard and rally orders resume after the bear dies; manual orders cancel that resumption',()=>{
 for(const mode of ['patrol','guard','move','manual']){
  const s=arena(),u=s.addUnit('soldier',100,100,'player'),bear=s.addUnit('grizzly',160,100,'wildlife');
  const destination={x:95,z:115};s._sendUnitTo(u,destination,'move');
  if(mode==='patrol'){u.patrolActive=true;u.patrolIndex=1;u.patrolPoints=[{x:95,z:95},destination];}
  if(mode==='guard'){u.guardPoint=destination;u.guardRadius=8;}
  rallyBearDefenders(s);assert.equal(u.attackTarget,bear.id);
  if(mode==='manual'){s._interruptWork(u);s._sendUnitTo(u,{x:90,z:90},'move');assert(!u.bearResponse);}
  bear.dead=true;rallyBearDefenders(s);assert(!u.bearResponse);assert.equal(u.command,'move');
  if(mode==='patrol'){assert(u.patrolActive);assert.equal(u.patrolIndex,1);}
  if(mode==='guard')assert.deepEqual(u.guardPoint,destination);
  assert(Math.hypot(u.routeTarget.x-(mode==='manual'?90:95),u.routeTarget.z-(mode==='manual'?90:115))<2);
 }
});

test('unreachable bears have a bounded route budget and cannot starve later soldiers',()=>{
 const s=arena();for(let i=0;i<12;i++)s.addUnit('soldier',100,100+i,'player');s.addUnit('grizzly',170,100,'wildlife');
 let calls=0;s._bestCombatRoute=()=>{calls++;return null};
 for(let pass=0;pass<4;pass++){const before=calls;rallyBearDefenders(s);assert(calls-before<=BEAR_RESPONSE.routeBudget);}
 assert.equal(calls,12);assert(s.units.filter(u=>u.type==='soldier').every(u=>Object.keys(u.bearAvoid).length===1));
 rallyBearDefenders(s);assert.equal(calls,12,'failed routes back off instead of running every frame');
});
