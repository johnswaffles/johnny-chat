import {test} from 'node:test';import assert from 'node:assert/strict';
import {CrownforgeSimulation} from '../src/simulation.js';
import {UNIT_TYPES} from '../src/config.js';import {strikeDamage} from '../src/unit-status.js';
import {TEAM_RULES,updateTeams,tankTarget,updateTeamApproaches,teamMovePoint} from '../src/combat-teams.js';
import {updateWildlife} from '../src/wildlife.js';
function arena(){const s=new CrownforgeSimulation({seed:42});s.units=[];s.buildings=[];s.resourcesNodes=[];s.decorations=[];s.navigationVersion++;s._checkVictory=()=>{};s._updateEnemyAI=()=>{};s._updateEnemyIntent=()=>{};return s;}
function select(s,units){s.selectedIds=units.map(u=>u.id);s._syncSelectionFlags();}
test('every player warrior class can select its whole living class only',()=>{
 const s=arena();for(const type of ['soldier','spearwarden','shieldbearer','scout','militia']){
 const a=s.addUnit(type,100,100,'player'),b=s.addUnit(type,110,110,'player');s.addUnit(type,120,120,'enemy');const dead=s.addUnit(type,130,130,'player');dead.dead=true;
 select(s,[a]);assert.equal(s.selectAllWarriorClass(type).count,2);assert.deepEqual(s.selectedIds,[a.id,b.id]);}
});
test('tank armor and evasion give exactly five landed stacked-rage hits',()=>{
 const s=arena(),tank=s.addUnit('shieldbearer',100,100,'player'),bear=s.addUnit('grizzly',101,100,'wildlife');bear.hp=18;
 let landed=0,dodged=0;
 for(let swing=1;swing<=5;swing++){const result=s._applyUnitDamage(tank,strikeDamage(bear,tank),bear);if(result.dodged)dodged++;else landed++;assert.equal(tank.dead,swing===5);}
 assert.equal(landed,5);assert.equal(dodged,0);assert.equal(tank.hp,0);assert.equal(UNIT_TYPES.grizzly.attack,58);
 assert.equal(UNIT_TYPES.shieldbearer.attack*10,UNIT_TYPES.soldier.attack);
});
test('tank holds aggro through damage hits and wildlife scans without resetting a swing',()=>{
 const s=arena(),tank=s.addUnit('shieldbearer',101,100,'player'),dps=s.addUnit('spearwarden',102,100,'player'),bear=s.addUnit('grizzly',100,100,'wildlife');
 s._sendUnitToAttack(bear,dps);bear.attackPhase='anticipation';bear.attackPhaseElapsed=.1;
 s._applyUnitDamage(bear,strikeDamage(tank,bear),tank);assert.equal(bear.attackTarget,tank.id);assert.equal(bear.attackPhaseElapsed,.1);
 s._applyUnitDamage(bear,strikeDamage(dps,bear),dps);assert.equal(bear.attackTarget,tank.id);
 updateWildlife(s,1);assert.equal(s._getExplicitAttackTarget(bear).id,tank.id);
 const second=s.addUnit('shieldbearer',103,100,'player');s._applyUnitDamage(bear,1,second);assert.equal(bear.attackTarget,tank.id);
 tank.dead=true;assert.equal(tankTarget(s,bear),null);s._applyUnitDamage(bear,1,dps);assert.equal(bear.attackTarget,dps.id);
});
test('tank taunt applies to other enemies and expires or releases out of range',()=>{
 const s=arena(),tank=s.addUnit('shieldbearer',101,100,'player'),enemy=s.addUnit('raider',100,100,'enemy');
 s._applyUnitDamage(enemy,1,tank);assert.equal(s._getExplicitAttackTarget(enemy).id,tank.id);
 s.clock=TEAM_RULES.tauntDuration+.01;assert.equal(tankTarget(s,enemy),null);
 s._applyUnitDamage(enemy,1,tank);tank.x+=100;assert.equal(tankTarget(s,enemy),null);
});
test('special swipe leaves rear damage fighters at ten percent',()=>{
 const s=arena(),tank=s.addUnit('shieldbearer',101,100,'player'),dps=s.addUnit('soldier',97,100,'player'),bear=s.addUnit('grizzly',100,100,'wildlife');bear.hp=18;
 s._applyUnitDamage(bear,1,tank);s._applyGrizzlyCleave(bear,tank);assert(dps.hp>0&&dps.hp<=dps.maxHp);
});
test('team healers pulse every nearby injured ally, with stronger tank healing and rear-line range',()=>{
 const s=arena(),h=s.addUnit('villager',100,100,'player'),t=s.addUnit('shieldbearer',102,100,'player'),dps=s.addUnit('soldier',115,100,'player'),far=s.addUnit('soldier',121,100,'player'),enemy=s.addUnit('raider',103,100,'enemy');
 select(s,[h,t]);s.assignSelectedTeam();t.hp-=100;dps.hp=1;far.hp=1;enemy.hp=1;
 updateTeams(s,2);assert.equal(t.hp,t.maxHp-60);assert.equal(dps.hp,21);assert.equal(far.hp,1);assert.equal(enemy.hp,1);
 updateTeams(s,.1);assert.equal(t.hp,t.maxHp-60);
 updateTeams(s,2);assert.equal(t.hp,t.maxHp-20);assert.equal(dps.hp,41);
 h.stunTimer=2;t.hp-=100;updateTeams(s,2);assert.equal(t.hp,t.maxHp-120);
});
test('healers honor line of sight and stay dedicated to healing until removed',()=>{
 const s=arena(),h=s.addUnit('villager',100,100,'player'),t=s.addUnit('shieldbearer',102,100,'player'),bear=s.addUnit('grizzly',103,100,'wildlife');select(s,[h,t]);s.assignSelectedTeam();t.hp-=200;
 s._hasCombatLineOfSight=()=>false;updateTeams(s,2);assert.equal(t.hp,t.maxHp-200);
 s._hasCombatLineOfSight=()=>true;h.command='build';updateTeams(s,2);assert.equal(t.hp,t.maxHp-160);assert.notEqual(h.command,'build');
 s._sendUnitToAttack(h,bear);assert.equal(h.attackTarget,null);updateTeams(s,2);assert.equal(t.hp,t.maxHp-120);
 select(s,[h]);s.leaveSelectedTeam();updateTeams(s,2);assert.equal(t.hp,t.maxHp-120);
});
test('team membership and wounded tank percentage survive save and load; old tanks migrate',()=>{
 const s=arena(),h=s.addUnit('villager',100,100,'player'),t=s.addUnit('shieldbearer',102,100,'player');select(s,[h,t]);const id=s.assignSelectedTeam();t.hp=t.maxHp/2;
 const save=s.serialize();const restored=arena();assert(restored.loadSnapshot(save));assert.equal(restored.getCombatTeams()[0].id,id);assert.equal(restored.units.find(u=>u.id===t.id).hp,1740);
 const old=save.units.find(u=>u.id===t.id);old.maxHp=118;old.hp=59;assert(restored.loadSnapshot(save));assert.equal(restored.units.find(u=>u.id===t.id).hp,1740);
 restored.disbandTeam(id);assert.equal(restored.getCombatTeams()[0].members.length,0);
});
test('automatic healers follow a moving tank, but do not override manual destinations',()=>{
 const s=arena(),h=s.addUnit('villager',100,100,'player'),t=s.addUnit('shieldbearer',120,100,'player');select(s,[h,t]);s.assignSelectedTeam();
 s.repathBudgetRemaining=8;updateTeams(s,.1);assert.equal(h.teamFollowing,true);assert.equal(h.command,'move');assert(h.path.length);
 s._interruptWork(h);s._sendUnitTo(h,{x:95,z:95},'move');const path=structuredClone(h.path);s.clock=3;updateTeams(s,.1);assert.deepEqual(h.path,path);assert.equal(h.teamFollowing,false);
});
test('there is one persistent team through a wipe and no added roster cap',()=>{
 const s=arena(),first=s.addUnit('shieldbearer',100,100,'player');select(s,[first]);assert.equal(s.assignSelectedTeam(),1);first.dead=true;
 assert.equal(s.getCombatTeams()[0].members.length,0);
 const replacements=Array.from({length:40},(_,i)=>s.addUnit(i%2?'soldier':'villager',110+i,100,'player'));select(s,replacements);assert.equal(s.assignSelectedTeam(),1);assert.equal(s.getCombatTeams().length,1);assert.equal(s.getCombatTeams()[0].members.length,40);
 const saved=s.serialize();saved.units.find(u=>u.id===replacements[0].id).teamId=7;const restored=arena();restored.loadSnapshot(saved);assert.equal(restored.units.find(u=>u.id===replacements[0].id).teamId,1);
});
test('damage fighters wait behind tanks until aggro is established; cancel and tank death release them',()=>{
 const s=arena(),tank=s.addUnit('shieldbearer',100,100,'player'),dps=s.addUnit('soldier',103,100,'player'),bear=s.addUnit('grizzly',110,100,'wildlife');select(s,[tank,dps]);s.assignSelectedTeam();
 s._sendUnitToAttack(dps,bear);assert.equal(dps.teamAdvanceTargetId,bear.id);assert.equal(tank.attackTarget,bear.id);assert.equal(dps.attackTarget,null);
 s.repathBudgetRemaining=8;updateTeamApproaches(s);assert(dps.routeTarget.x<tank.x);
 s._applyUnitDamage(bear,1,tank);updateTeamApproaches(s);assert.equal(dps.attackTarget,bear.id);assert.equal(dps.teamAdvanceTargetId,null);
 bear.threatTankId=null;s._sendUnitToAttack(dps,bear);s._interruptWork(dps);assert.equal(dps.teamAdvanceTargetId,null);
 s._sendUnitToAttack(dps,bear);tank.dead=true;updateTeamApproaches(s);assert.equal(dps.attackTarget,bear.id);
});
test('movement destinations put tanks ahead of damage and healers with separate tank slots',()=>{
 const s=arena(),units=['shieldbearer','shieldbearer','soldier','villager'].map(type=>s.addUnit(type,100,100,'player'));select(s,units);s.assignSelectedTeam();
 const points=units.map(u=>teamMovePoint(units,u,{x:120,z:100}));assert(points[0].x>points[2].x&&points[2].x>points[3].x);assert.notEqual(points[0].z,points[1].z);
});
test('stacked bear fury overwhelms a lone healer instead of leaving the tank unhurt',()=>{
 const s=arena(),tank=s.addUnit('shieldbearer',101.3,100,'player'),dps=s.addUnit('soldier',97,100,'player'),healer=s.addUnit('villager',112,100,'player'),bear=s.addUnit('grizzly',100,100,'wildlife');
 bear.maxHp=18000;bear.hp=1800;select(s,[tank,dps,healer]);s.assignSelectedTeam();
 s._applyUnitDamage(bear,1,tank);s._sendUnitToAttack(tank,bear);
 let hits=0,heals=0;const apply=s._applyUnitDamage.bind(s);s._applyUnitDamage=(target,damage,attacker,...rest)=>{if(target===tank&&attacker===bear)hits++;return apply(target,damage,attacker,...rest);};
 for(let i=0;i<1800;i++){s.clock+=1/60;s._updateAttack(tank,1/60);s._updateAttack(bear,1/60);s._applyUnitDamage(bear,.01,dps);const hp=tank.hp;updateTeams(s,1/60);if(tank.hp>hp)heals++;}
 assert(hits>=3);assert(heals>=2);assert(tank.dead);
});
