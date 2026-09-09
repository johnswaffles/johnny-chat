import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CrownforgeSimulation} from '../src/simulation.js';
import {UNIT_TYPES} from '../src/config.js';
import {updateWildlife} from '../src/wildlife.js';
import {strikeDamage,unitStatuses,isCurseImmune,drawCurseSigil,displayedUnitHealth,curseRuneKind} from '../src/unit-status.js';
import {CrownforgeInput} from '../src/input.js';
function arena(){const s=new CrownforgeSimulation({seed:42});s.units=[];s.resourcesNodes=[];s.buildings=[];s.navigationVersion++;s._checkVictory=()=>{};s._updateEnemyAI=()=>{};s._updateEnemyIntent=()=>{};return s;}

test('two landed bear strikes trigger the ward for each full-health gathering class',()=>{
 for(const [type,faction] of [['villager','player'],['ashenForager','enemy']]){
  const s=arena(),w=s.addUnit(type,100,100,faction),b=s.addUnit('grizzly',101.35,100,'wildlife');
  const damage=strikeDamage(b,w);s._sendUnitToAttack(b,w);let hits=0;
  const apply=s._applyUnitDamage.bind(s);s._applyUnitDamage=(target,amount,attacker)=>{if(attacker===b){hits++;assert.equal(amount,damage);}return apply(target,amount,attacker);};
  for(let i=0;i<4*60&&hits<2;i++)s._updateAttack(b,1/60);
  assert.equal(hits,2);assert(w.lastLightWardTimer>0);assert.equal(w.hp,w.maxHp);assert(!w.dead);assert.equal(b.attackTarget,null);assert.equal(b.command,'idle');
 }
});

test('ward activation clears every bear, excludes all new attack routes and moves hunters to other prey',()=>{
 const s=arena(),w=s.addUnit('villager',100,100,'player'),other=s.addUnit('ashenForager',109,100,'enemy');
 const bears=[s.addUnit('grizzly',102,100,'wildlife'),s.addUnit('grizzly',96,100,'wildlife')];
 for(const b of bears)s._sendUnitToAttack(b,w);w.hp=1;s._applyUnitDamage(w,29,bears[0]);
 for(const b of bears){assert.equal(b.attackTarget,null);assert.equal(b.path.length,0);assert.equal(b.combatSlotTargetId,null);assert(!s._sendUnitToAttack(b,w));}
 updateWildlife(s,.1);for(const b of bears)assert.equal(b.attackTarget,other.id);
 s.units=s.units.filter(u=>u!==other);for(const b of bears){s._interruptWork(b);b.command='idle';b.path=[];}
 for(let i=0;i<5;i++){s.clock++;updateWildlife(s,1);for(const b of bears)assert.notEqual(b.attackTarget,w.id);}
 const soldier=s.addUnit('raider',105,105,'enemy');assert(!s._sendUnitToAttack(soldier,w));
 w.lastLightCurseActive=true;const hp=w.hp;assert(s._applyUnitDamage(w,999,bears[0]).blocked);assert.equal(w.hp,hp);assert(!w.dead);
 w.lastLightCurseActive=false;s._updateUnitStatusEffects(w,61);assert(s._sendUnitToAttack(bears[0],w),'ward expiration restores attack targetability');
});

test('The First Condemnation accepts the delayed lesser rune and false health without changing combat strength',()=>{
 const s=arena(),w=s.addUnit('villager',100,100,'player'),b=s.addUnit('grizzly',102,100,'wildlife'),guard=s.addUnit('soldier',106,100,'player');
 assert(isCurseImmune(b));assert.equal(unitStatuses(b)[0].name,'The First Condemnation');assert.equal(curseRuneKind(b),'divine');assert.equal(displayedUnitHealth(b),b.maxHp);
 s._applyUnitDamage(b,17,guard);const before=b.hp;w.hp=1;s._applyUnitDamage(w,29,b);s._updateUnitStatusEffects(w,2);
 assert.equal(b.hp,before);assert(b.lastLightCurseActive);assert(b.lastLightCurseDecoy);assert.equal(curseRuneKind(b),'curse');assert.equal(displayedUnitHealth(b),1);
 assert.deepEqual(unitStatuses(b).map(status=>status.id),['firstCondemnation','elderhide','lastLight','greatwoodFury']);
 s._applyUnitDamage(b,1,guard);assert.equal(b.hp,before-1);assert(!b.dead);assert.equal(displayedUnitHealth(b),1);
 // A second worker's ward cannot heal existing wounds or reveal true health.
 const other=s.addUnit('ashenForager',110,100,'enemy');other.hp=1;s._applyUnitDamage(other,100,b);s._updateUnitStatusEffects(other,2);
 assert.equal(b.hp,before-1);assert.equal(displayedUnitHealth(b),1);assert.equal(curseRuneKind(b),'curse');
 assert.equal(b.attackTarget,guard.id,'the protected worker cannot steal focus from the fighter who landed a hit');
});

test('save/load retains the lesser mark and real wounds, including one HP and death, without healing',()=>{
 for(const trueHp of [180,93,1,0]){
  const s=arena(),b=s.addUnit('grizzly',100,100,'wildlife');b.lastLightCurseActive=true;b.lastLightCurseDecoy=true;b.hp=trueHp;b.dead=trueHp===0;
  let saved=JSON.parse(JSON.stringify(s.serialize()));
  for(let cycle=0;cycle<2;cycle++){
   const restored=arena();assert(restored.loadSnapshot(saved));const loaded=restored.units.find(u=>u.id===b.id);
   assert.equal(loaded.hp,trueHp);assert.equal(loaded.dead,trueHp===0);assert(loaded.lastLightCurseActive);assert.equal(displayedUnitHealth(loaded),trueHp>0?1:0);saved=restored.serialize();
  }
 }
});

test('old one-HP cursed bears migrate once while retaining the mark; other battle damage and death survive',()=>{
 for(const oldHp of [180,93,1,0]){
  const s=arena(),b=s.addUnit('grizzly',100,100,'wildlife');b.lastLightCurseActive=true;b.hp=oldHp;b.dead=oldHp===0;
  const saved=s.serialize(),old=saved.units.find(u=>u.id===b.id);delete old.lastLightCurseDecoy;
  const restored=arena();assert(restored.loadSnapshot(saved));const loaded=restored.units.find(u=>u.id===b.id);
  assert(loaded.lastLightCurseActive);assert(loaded.lastLightCurseDecoy);assert.equal(loaded.hp,oldHp===1?b.maxHp:oldHp);assert.equal(loaded.dead,oldHp===0);
  if(!loaded.dead){restored._applyUnitDamage(loaded,10);const wounded=loaded.hp;assert(restored.loadSnapshot(restored.serialize()));assert.equal(restored.units.find(u=>u.id===b.id).hp,wounded);}
 }
});

test('the false one-HP bear takes normal damage until real health runs out',()=>{
 const s=arena(),b=s.addUnit('grizzly',100,100,'wildlife'),w=s.addUnit('villager',105,100,'player');
 w.lastLightWardCurseSourceId=b.id;assert(s._resolveLastLightWardCurse(w));
 for(let strike=1;strike<18;strike++){assert(!s._applyUnitDamage(b,10).killed);assert.equal(b.hp,180-strike*10);assert.equal(displayedUnitHealth(b),1);}
 assert(s._applyUnitDamage(b,10).killed);assert(b.dead);assert.equal(displayedUnitHealth(b),0);
});

test('a cursed bear defeats up to three Crown Guards in actual combat',()=>{
 for(const count of [1,2,3]){
  const s=arena(),b=s.addUnit('grizzly',110,100,'wildlife');b.lastLightCurseActive=true;
  const guards=Array.from({length:count},(_,i)=>s.addUnit('soldier',105,99+i*3,'player'));
  guards.forEach((u,i)=>s._sendUnitToAttack(u,b,i*4));
  for(let i=0;i<10*60;i++)s._updateFixed(1/60);
  assert(!b.dead);assert(guards.every(u=>u.dead));assert.equal(displayedUnitHealth(b),1);
 }
});

test('ordinary attackers retain Last Light Curse and its fatal next wound',()=>{
 const s=arena(),w=s.addUnit('villager',100,100,'player'),r=s.addUnit('raider',102,100,'enemy');w.hp=1;s._applyUnitDamage(w,100,r);s._updateUnitStatusEffects(w,2);
 assert.equal(r.hp,1);assert(r.lastLightCurseActive);assert.equal(unitStatuses(r)[0].id,'lastLight');assert(s._applyUnitDamage(r,.1,w).killed);
});

test('all hostile classes are inspectable but movement, attack, guard, patrol and recovery cannot control them',()=>{
 const s=arena(),friendly=s.addUnit('soldier',80,80,'player');
 for(const type of Object.keys(UNIT_TYPES)){
  const enemy=s.addUnit(type,150,150,type==='grizzly'?'wildlife':'enemy');enemy.guardPoint={x:151,z:151};enemy.patrolActive=true;enemy.patrolPoints=[{x:149,z:149},{x:151,z:151}];
  s.selectEntity(enemy);assert.deepEqual(s.selectedIds,[enemy.id]);assert(enemy.selected);
  const original=JSON.stringify(enemy);assert.equal(s.issueContextCommand({x:90,z:90}).kind,'none');assert.equal(s.issueContextCommand(friendly,friendly).kind,'none');
  assert(!s.setGuardZone({x:90,z:90}).success);assert(!s.setPatrolRoute({x:80,z:80},{x:90,z:90}).success);assert(!s.clearGuardZone().success);assert(!s.clearPatrolRoute().success);assert(!s.canRecoverSelectedUnits());assert.equal(JSON.stringify(enemy),original);
  s.selectEntity(friendly,true);assert.deepEqual(s.selectedIds,[friendly.id]);
 }
});

test('curse rune uses thorned strokes with no pulsing circle or diamond fill',()=>{
 let strokes=0,segments=0;const ctx={save(){},restore(){},translate(){},scale(){},beginPath(){},moveTo(){},lineTo(){segments++;},stroke(){strokes++;},arc(){assert.fail('no curse rings');},fill(){assert.fail('no filled diamond');}};
 drawCurseSigil(ctx,'divine',0,0,25);assert.equal(strokes,2);assert(segments>20);
});

test('normal enemy clicks inspect while a friendly is selected, and overhead rune clicks open details',()=>{
 const s=arena(),friendly=s.addUnit('soldier',100,100,'player'),bear=s.addUnit('grizzly',120,100,'wildlife');s.selectEntity(friendly);
 let opened=0,commands=0,rune=null;
 const input=Object.create(CrownforgeInput.prototype);
 Object.assign(input,{simulation:s,drag:{start:{x:10,y:10},additive:false},_point:()=>({x:10,y:10}),_updateCursor:()=>{},onSelection:()=>{},onInspectStatus:u=>{assert.equal(u,bear);opened++;},onCommand:()=>{commands++;},renderer:{setSelectionBox(){},screenToWorld:()=>bear,getEntityAtScreen:()=>bear,getCurseRuneAtScreen:()=>rune}});
 input._up({button:0});assert.deepEqual(s.selectedIds,[bear.id]);assert.equal(friendly.attackTarget,null);assert.equal(commands,0);
 s.selectEntity(friendly);rune=bear;input.drag={start:{x:10,y:10},additive:false};input._up({button:0});assert.equal(opened,1);assert.deepEqual(s.selectedIds,[bear.id]);
 s.selectEntity(friendly);const result=s.issueContextCommand(bear,bear);assert.equal(result.kind,'attack');assert.equal(friendly.attackTarget,bear.id,'the right-click command path still attacks normally');
});
