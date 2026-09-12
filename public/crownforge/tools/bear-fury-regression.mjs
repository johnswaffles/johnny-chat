import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CrownforgeSimulation} from '../src/simulation.js';
import {UNIT_TYPES} from '../src/config.js';
import {BEAR_FURY,bearFuryActive,isFighter} from '../src/bear-combat.js';
import {strikeDamage,unitStatuses,displayedUnitHealth} from '../src/unit-status.js';
import {updateWildlife} from '../src/wildlife.js';
import {militaryPose,FOOT_MILITARY_TYPES} from '../src/military-motion.js';
import {mountedPose,MOUNTED_TYPES} from '../src/mounted-motion.js';
function arena(){const s=new CrownforgeSimulation({seed:42});s.units=[];s.buildings=[];s.resourcesNodes=[];s.navigationVersion++;s.unitSpeedScale=1;s._checkVictory=()=>{};s._updateEnemyAI=()=>{};s._updateEnemyIntent=()=>{};return s;}
const step=(s,u,seconds)=>{for(let i=0;i<seconds*60;i++)s._updateUnit(u,1/60);};

test('fury uses the exact true threshold or false curse health, without healing',()=>{
 const s=arena(),b=s.addUnit('grizzly',100,100,'wildlife');
 b.hp=18.001;assert(!bearFuryActive(b));b.hp=18;assert(bearFuryActive(b));
 b.hp=173;b.lastLightCurseActive=true;assert(bearFuryActive(b));assert.equal(displayedUnitHealth(b),1);assert.equal(b.hp,173);
 b.lastLightCurseActive=false;assert(!bearFuryActive(b));b.hp=0;b.dead=true;assert(!bearFuryActive(b));
});
test('rapid arrows respect the temporary Heart reduction and true health, with or without the curse',()=>{
 for(const cursed of [false,true]){
  const s=arena(),b=s.addUnit('grizzly',100,100,'wildlife');b.lastLightCurseActive=cursed;
  assert.equal(s._applyUnitDamage(b,0,null,{damageType:'arrow'}).damage,0);
  for(let hit=1;hit<=168;hit++){
   s.projectiles.push({id:9000+hit,kind:'defense-arrow',faction:'player',sourceBuildingId:999,sourceType:'watchtower',targetId:b.id,x:99.9,z:100,damage:10000,speed:30,age:0,maxAge:5});
   s._updateDefenseProjectiles(1/60);
   const expected=hit<=48?180-hit*3:Math.max(0,36-(hit-48)*.3);assert(Math.abs(b.hp-expected)<1e-7);assert.equal(b.dead,hit===168);
   assert.equal(displayedUnitHealth(b),hit===168?0:cursed?1:b.hp);
  }
 }
});
test('one fury contact kills the primary and all nearby frontal fighters; no harm through a wall or ward',()=>{
 const s=arena(),b=s.addUnit('grizzly',100,100,'wildlife');b.lastLightCurseActive=true;
 const primary=s.addUnit('soldier',101.4,100,'player');primary.hp=primary.maxHp=500;
 const second=s.addUnit('raider',102,101,'enemy'),third=s.addUnit('shieldbearer',103,100,'player');
 const fourth=s.addUnit('soldier',105,100,'player'),outside=s.addUnit('soldier',115,100,'player'),blocked=s.addUnit('soldier',101,100,'player'),ward=s.addUnit('raider',100,101,'enemy');ward.lastLightWardTimer=20;
 const worker=s.addUnit('villager',100,102,'player'),bear2=s.addUnit('grizzly',100,103,'wildlife');
 s._hasCombatLineOfSight=(u,t)=>t!==blocked;
 s._sendUnitToAttack(b,primary);let hits=0;
 const apply=s._applyUnitDamage.bind(s);s._applyUnitDamage=(t,d,a,...rest)=>{if(a===b)hits++;return apply(t,d,a,...rest);};
 for(let i=0;i<60&&!primary.dead;i++)s._updateAttack(b,1/60);
 assert(primary.dead&&second.dead&&!third.dead);assert(third.hp<third.maxHp);assert.equal(hits,4);assert(fourth.dead);
 for(const u of [outside,blocked,ward,worker,bear2])assert.equal(u.hp,u.maxHp);
 // Scanning during the follow-through cannot grant another instant strike.
 const phase=b.attackPhase,elapsed=b.attackPhaseElapsed;updateWildlife(s,1);assert.equal(b.attackPhase,phase);assert.equal(b.attackPhaseElapsed,elapsed);
 step(s,b,.3);assert.equal(hits,4);assert(fourth.dead);
});
test('an escaped primary means the whole committed fury swipe misses',()=>{
 const s=arena(),b=s.addUnit('grizzly',100,100,'wildlife'),p=s.addUnit('soldier',101.3,100,'player'),near=s.addUnit('soldier',102,101,'player');b.hp=18;
 s._sendUnitToAttack(b,p);s._updateAttack(b,1/60);p.x=130;
 for(let i=0;i<80;i++)s._updateAttack(b,1/60);assert.equal(p.hp,p.maxHp);assert.equal(near.hp,near.maxHp);
});
test('last landed fighter hit redirects threat without restarting an active swing',()=>{
 const s=arena(),b=s.addUnit('grizzly',100,100,'wildlife'),w=s.addUnit('villager',101.4,100,'player'),a=s.addUnit('soldier',105,100,'player'),c=s.addUnit('raider',104,100,'enemy');
 s._sendUnitToAttack(b,w);s._updateAttack(b,.1);const elapsed=b.attackPhaseElapsed,phase=b.attackPhase;
 s._applyUnitDamage(b,4,a);assert.equal(b.attackTarget,a.id);assert.equal(b.attackPhaseElapsed,elapsed);assert.equal(b.attackPhase,phase);
 s._applyUnitDamage(b,0,c);assert.equal(b.attackTarget,a.id);s._applyUnitDamage(b,4,c);assert.equal(b.attackTarget,c.id);
 c.x=112;updateWildlife(s,1);assert.equal(b.attackTarget,c.id,'near worker cannot steal retaliation');
 a.lastLightWardTimer=2;s._applyUnitDamage(b,4,a);assert.equal(b.attackTarget,c.id,'protected units are not attack targets');
});
test('worker wards survive fury, remove all bear targeting and cannot be cleaved',()=>{
 for(const [type,faction] of [['villager','player'],['ashenForager','enemy']]){
  const s=arena(),b=s.addUnit('grizzly',100,100,'wildlife'),w=s.addUnit(type,101.3,100,faction);b.lastLightCurseActive=true;s._sendUnitToAttack(b,w);
  s._applyUnitDamage(w,strikeDamage(b,w),b);assert(w.lastLightWardTimer>0);assert(!w.dead);assert.equal(b.attackTarget,null);
  assert(s._applyUnitDamage(w,10000,b).blocked);assert(!s._sendUnitToAttack(b,w));
 }
});
test('every fighter can land a strike while moving within reach; workers keep existing behavior',()=>{
 const types=Object.keys(UNIT_TYPES).filter(type=>isFighter({type,faction:'player'}));assert(types.length>=8);
 for(const type of types){
  const s=arena(),u=s.addUnit(type,100,100,'player'),b=s.addUnit('grizzly',102,100,'wildlife');b.hp=b.maxHp=10000;s._sendUnitToAttack(u,b);
  let movingHits=0;const apply=s._applyUnitDamage.bind(s);s._applyUnitDamage=(t,d,a,...rest)=>{if(a===u&&u.fighterMovingAttack&&u.motionSpeed>.1)movingHits++;return apply(t,d,a,...rest);};
  for(let i=0;i<6*60;i++){b.x+=1.3/60;b.velocityX=1.3;s._updateUnit(u,1/60);}
  assert(movingHits>=1,`${type} must strike during pursuit`);assert(u.x>(type==='shieldbearer'?99:104));assert(u.combatLocomotionTime>0);
 }
 assert(!isFighter({type:'villager',faction:'player'}));assert(!isFighter({type:'ashenForager',faction:'enemy'}));
});
test('running fighters cannot hit through walls or reach an escaped target',()=>{
 for(const obstacle of [false,true]){
  const s=arena(),u=s.addUnit('soldier',100,100,'player'),b=s.addUnit('grizzly',102,100,'wildlife');s._sendUnitToAttack(u,b);s._updateUnit(u,.1);
  if(obstacle){s._pathSegmentBlocked=()=>true;s._hasCombatLineOfSight=()=>false;}else b.x=160;
  const hp=b.hp;step(s,u,1.5);assert.equal(b.hp,hp);
 }
});
test('bear lore reveals trickery only after Last Light, with accurate active buff numbers',()=>{
 const s=arena(),b=s.addUnit('grizzly',100,100,'wildlife');let statuses=unitStatuses(b);
 assert.deepEqual(statuses.map(x=>x.id),['crushingClaws','firstCondemnation','elderhide','thickHide','bearLineage']);
 assert(!/Last Light|lesser rune|lure|1 HP/.test(statuses.map(x=>x.lore+' '+x.effect).join(' ')));
 b.lastLightCurseActive=true;statuses=unitStatuses(b);const fury=statuses.find(x=>x.id==='greatwoodFury');assert(fury);assert.match(fury.effect,/six/);assert.match(fury.effect,/front 160-degree/);assert.match(fury.effect,/14 units/);assert.match(fury.art,/cursed-bears/);
 assert.match(statuses.find(x=>x.id==='lastLight').lore,/bait/);assert.equal(b.hp,b.maxHp);
 b.lastLightCurseActive=false;b.hp=18;assert(unitStatuses(b).some(x=>x.id==='greatwoodFury'));
});
test('running strikes keep a distance-driven gait and attached weapons for foot and mounted fighters',()=>{
 for(const type of [...FOOT_MILITARY_TYPES,...MOUNTED_TYPES])for(let view=0;view<4;view++){
  const pose=MOUNTED_TYPES.includes(type)?mountedPose:militaryPose;
  const a=pose(type,'attack_contact',.08,view,{moving:true,combatMoving:true,motionSpeed:2,locomotionTime:.1});
  const b=pose(type,'attack_contact',.08,view,{moving:true,combatMoving:true,motionSpeed:2,locomotionTime:.5});
  assert(a.walking&&b.walking);
  const aLeg=a.mount?.anatomical.frontLeftHoof??a.anatomical.leftAnkle;
  const bLeg=b.mount?.anatomical.frontLeftHoof??b.anatomical.leftAnkle;
  assert.notDeepEqual(aLeg,bLeg,`${type} moving legs`);
  for(const p of [a,b])assert.deepEqual(p.toolFrame.grip,p.anatomical.rightPalm,`${type} weapon stays in hand`);
 }
});
