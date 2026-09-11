import {test} from 'node:test';import assert from 'node:assert/strict';
import {CrownforgeSimulation} from '../src/simulation.js';
import {UNIT_TYPES} from '../src/config.js';import {strikeDamage} from '../src/unit-status.js';
import {TEAM_RULES,updateTeams,tankTarget} from '../src/combat-teams.js';
import {updateWildlife} from '../src/wildlife.js';
function arena(){const s=new CrownforgeSimulation({seed:42});s.units=[];s.buildings=[];s.resourcesNodes=[];s.decorations=[];s.navigationVersion++;s._checkVictory=()=>{};s._updateEnemyAI=()=>{};s._updateEnemyIntent=()=>{};return s;}
function select(s,units){s.selectedIds=units.map(u=>u.id);s._syncSelectionFlags();}
test('every player warrior class can select its whole living class only',()=>{
 const s=arena();for(const type of ['soldier','spearwarden','shieldbearer','scout','militia']){
 const a=s.addUnit(type,100,100,'player'),b=s.addUnit(type,110,110,'player');s.addUnit(type,120,120,'enemy');const dead=s.addUnit(type,130,130,'player');dead.dead=true;
 select(s,[a]);assert.equal(s.selectAllWarriorClass(type).count,2);assert.deepEqual(s.selectedIds,[a.id,b.id]);}
});
test('Shieldbearer survives 19 actual enraged hits and dies on the 20th',()=>{
 const s=arena(),tank=s.addUnit('shieldbearer',100,100,'player'),bear=s.addUnit('grizzly',101,100,'wildlife');bear.hp=18;
 for(let hit=1;hit<=20;hit++){s._applyUnitDamage(tank,strikeDamage(bear,tank),bear);assert.equal(tank.dead,hit===20);assert.equal(tank.hp,tank.maxHp-hit*174);}
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
test('a tank-held bear cannot cleave the damage fighters',()=>{
 const s=arena(),tank=s.addUnit('shieldbearer',101,100,'player'),dps=s.addUnit('soldier',102,100,'player'),bear=s.addUnit('grizzly',100,100,'wildlife');bear.hp=18;
 s._applyUnitDamage(bear,1,tank);s._applyGrizzlyCleave(bear,tank);assert.equal(dps.hp,dps.maxHp);
});
test('any assigned Hearthkin heals only nearby living teammates, with cooldown and no overheal',()=>{
 const s=arena(),h=s.addUnit('villager',100,100,'player'),t=s.addUnit('shieldbearer',102,100,'player'),other=s.addUnit('soldier',101,100,'player'),far=s.addUnit('soldier',120,100,'player');
 select(s,[h,t,far]);s.assignSelectedTeam();t.hp-=100;other.hp=1;far.hp=1;
 updateTeams(s,2);assert.equal(t.hp,t.maxHp-60);assert.equal(other.hp,1);assert.equal(far.hp,1);
 updateTeams(s,.1);assert.equal(t.hp,t.maxHp-60);
 t.hp=t.maxHp-2;updateTeams(s,2);assert.equal(t.hp,t.maxHp);
 h.stunTimer=2;t.hp-=50;updateTeams(s,2);assert.equal(t.hp,t.maxHp-50);
 h.stunTimer=0;select(s,[h]);s.leaveSelectedTeam();updateTeams(s,2);assert.equal(t.hp,t.maxHp-50);
});
test('healers honor line of sight and explicit work, and support instead of attacking',()=>{
 const s=arena(),h=s.addUnit('villager',100,100,'player'),t=s.addUnit('shieldbearer',102,100,'player'),bear=s.addUnit('grizzly',103,100,'wildlife');select(s,[h,t]);s.assignSelectedTeam();t.hp-=100;
 s._hasCombatLineOfSight=()=>false;updateTeams(s,2);assert.equal(t.hp,t.maxHp-100);
 s._hasCombatLineOfSight=()=>true;h.command='build';updateTeams(s,2);assert.equal(t.hp,t.maxHp-100);
 s._sendUnitToAttack(h,bear);assert.equal(h.attackTarget,null);assert.equal(h.command,'idle');
 updateTeams(s,2);assert.equal(t.hp,t.maxHp-60);assert.equal(s._availableForAutomaticBuilding(h),false);
});
test('team membership and wounded tank percentage survive save and load; old tanks migrate',()=>{
 const s=arena(),h=s.addUnit('villager',100,100,'player'),t=s.addUnit('shieldbearer',102,100,'player');select(s,[h,t]);const id=s.assignSelectedTeam();t.hp=t.maxHp/2;
 const save=s.serialize();const restored=arena();assert(restored.loadSnapshot(save));assert.equal(restored.getCombatTeams()[0].id,id);assert.equal(restored.units.find(u=>u.id===t.id).hp,1740);
 const old=save.units.find(u=>u.id===t.id);old.maxHp=118;old.hp=59;assert(restored.loadSnapshot(save));assert.equal(restored.units.find(u=>u.id===t.id).hp,1740);
 restored.disbandTeam(id);assert.equal(restored.getCombatTeams().length,0);
});
test('automatic healers follow a moving tank, but do not override manual destinations',()=>{
 const s=arena(),h=s.addUnit('villager',100,100,'player'),t=s.addUnit('shieldbearer',120,100,'player');select(s,[h,t]);s.assignSelectedTeam();
 s.repathBudgetRemaining=8;updateTeams(s,.1);assert.equal(h.teamFollowing,true);assert.equal(h.command,'move');assert(h.path.length);
 s._interruptWork(h);s._sendUnitTo(h,{x:95,z:95},'move');const path=structuredClone(h.path);s.clock=3;updateTeams(s,.1);assert.deepEqual(h.path,path);assert.equal(h.teamFollowing,false);
});
test('two different teams cannot heal one another, and removing one member leaves the other team intact',()=>{
 const s=arena(),h=s.addUnit('villager',100,100,'player'),t=s.addUnit('shieldbearer',102,100,'player'),other=s.addUnit('soldier',101,100,'player');
 select(s,[h]);s.assignSelectedTeam();select(s,[t,other]);const second=s.assignSelectedTeam();t.hp-=100;updateTeams(s,2);assert.equal(t.hp,t.maxHp-100);
 select(s,[h]);s.assignSelectedTeam(second);updateTeams(s,2);assert.equal(t.hp,t.maxHp-60);
 select(s,[h]);s.leaveSelectedTeam();assert.equal(s.getCombatTeams()[0].members.length,2);assert.equal(h.teamId,null);
});
test('an actual fight keeps a healed tank alive through multiple contacts while nearby damage fighters remain safe',()=>{
 const s=arena(),tank=s.addUnit('shieldbearer',101.3,100,'player'),dps=s.addUnit('soldier',102,102,'player'),healer=s.addUnit('villager',104,100,'player'),bear=s.addUnit('grizzly',100,100,'wildlife');
 bear.maxHp=18000;bear.hp=1800;select(s,[tank,dps,healer]);s.assignSelectedTeam();
 s._applyUnitDamage(bear,1,tank);s._sendUnitToAttack(tank,bear);
 let hits=0,heals=0;const apply=s._applyUnitDamage.bind(s);s._applyUnitDamage=(target,damage,attacker,...rest)=>{if(target===tank&&attacker===bear)hits++;return apply(target,damage,attacker,...rest);};
 for(let i=0;i<600;i++){s.clock+=1/60;s._updateAttack(tank,1/60);s._updateAttack(bear,1/60);s._applyUnitDamage(bear,.01,dps);const hp=tank.hp;updateTeams(s,1/60);if(tank.hp>hp)heals++;}
 assert(hits>=3);assert(heals>=2);assert(!tank.dead);assert.equal(dps.hp,dps.maxHp);assert.equal(bear.attackTarget,tank.id);
});
