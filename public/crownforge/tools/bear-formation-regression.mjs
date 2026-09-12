import {test} from 'node:test';import assert from 'node:assert/strict';
import {CrownforgeSimulation} from '../src/simulation.js';
import {UNIT_TYPES} from '../src/config.js';
import {bearEnrageActive,bearBodyScale,combatRadius,inBearSwipe} from '../src/bear-combat.js';
import {strikeDamage,displayedUnitHealth,unitStatuses} from '../src/unit-status.js';
import {healerRearPosition,TEAM_RULES,bearRearPosition,bearOrbitStep,updateTeams,updateTeamApproaches} from '../src/combat-teams.js';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function arena(){const s=new CrownforgeSimulation({seed:42});s.units=[];s.buildings=[];s.resourcesNodes=[];s.decorations=[];s.navigationVersion++;s._checkVictory=()=>{};s._updateEnemyAI=()=>{};s._updateEnemyIntent=()=>{};return s;}
test('half true health alone triggers Colossus, doubles size/damage and persists in saves',()=>{
 const s=arena(),b=s.addUnit('grizzly',100,100,'wildlife'),t=s.addUnit('shieldbearer',104,100,'player');
 b.lastLightCurseActive=true;assert.equal(displayedUnitHealth(b),1);assert(!bearEnrageActive(b));assert.equal(bearBodyScale(b),1);
 b.lastLightCurseActive=false;b.hp=90.01;assert(!bearEnrageActive(b));b.hp=90;assert(bearEnrageActive(b));assert.equal(strikeDamage(b,t),696);assert.equal(combatRadius(b),6);
 s._applyUnitDamage(b,1,t);b.hp=180;assert(bearEnrageActive(b));const saved=s.serialize();const restored=arena();restored.loadSnapshot(saved);assert(bearEnrageActive(restored.units.find(u=>u.id===b.id)));
 b.hp=18;assert.equal(strikeDamage(b,t),4176);assert(unitStatuses(b).some(u=>u.id==='greatwoodColossus'));
});
test('swipe remains dangerous in front with tank aggro but reduces rear DPS to ten percent and excludes walls and distant healers',()=>{
 const s=arena(),b=s.addUnit('grizzly',100,100,'wildlife'),t=s.addUnit('shieldbearer',103,100,'player');b.hp=90;
 const front=s.addUnit('soldier',104,101,'player'),rear=s.addUnit('soldier',97,100,'player'),far=s.addUnit('villager',112,100,'player'),wall=s.addUnit('soldier',105,100,'player');
 s._hasCombatLineOfSight=(a,u)=>u!==wall;s._applyUnitDamage(b,1,t);s._startAttackCycle(b,t);
 assert(inBearSwipe(b,front));assert(!inBearSwipe(b,rear));s._applyGrizzlyCleave(b,t);
 assert(front.dead);assert.equal(rear.hp,rear.maxHp*.1);for(const u of [far,wall])assert.equal(u.hp,u.maxHp);
 // Moving the primary behind a committed claw swing causes a miss.
 t.x=97;assert(!inBearSwipe(b,t));
});
test('rear slots are distinct and orbit chords avoid the bear body',()=>{
 const s=arena(),b=s.addUnit('grizzly',100,100,'wildlife'),t=s.addUnit('shieldbearer',104,100,'player');b.hp=90;t.teamId=1;s._applyUnitDamage(b,1,t);
 const fighters=Array.from({length:5},()=>s.addUnit('spearwarden',107,100,'player'));for(const u of fighters){u.teamId=1;u.attackTarget=b.id;}
 const goals=fighters.map(u=>bearRearPosition(s,u,b));assert.equal(new Set(goals.map(p=>`${p.x},${p.z}`)).size,5);
 for(let i=0;i<fighters.length;i++){const u=fighters[i],goal=goals[i];assert(goal.x<b.x);for(let n=0;n<60&&dist(u,goal)>.01;n++){const p=bearOrbitStep(u,b,goal);for(let k=1;k<=10;k++){const q={x:u.x+(p.x-u.x)*k/10,z:u.z+(p.z-u.z)*k/10};assert(dist(q,b)>combatRadius(b)+combatRadius(u));}Object.assign(u,p);}assert(dist(u,goal)<.01);}
});
test('automatic healer retreats beyond swipe radius and can still heal tank',()=>{
 const s=arena(),b=s.addUnit('grizzly',100,100,'wildlife'),t=s.addUnit('shieldbearer',103,100,'player'),h=s.addUnit('villager',104,100,'player');t.teamId=h.teamId=1;t.attackTarget=b.id;t.attackTargetKind='unit';t.command='attack';s.repathBudgetRemaining=8;
 updateTeams(s,.3);assert(h.teamFollowing);assert(dist(h.routeTarget,b)>10);assert(dist(h.routeTarget,t)<TEAM_RULES.healRange);
});
test('Oathbound Stride is 1.5 times fastest other base speed',()=>{assert.equal(UNIT_TYPES.shieldbearer.speed,1.5*Math.max(...Object.entries(UNIT_TYPES).filter(([k])=>k!=='shieldbearer').map(([,r])=>r.speed)));});
test('live movement brings two DPS behind tank-held bear and healer out of swipe range',()=>{
 const s=arena(),b=s.addUnit('grizzly',180,180,'wildlife'),t=s.addUnit('shieldbearer',174,180,'player'),h=s.addUnit('villager',173,179,'player'),d=s.addUnit('spearwarden',166,182,'player'),d2=s.addUnit('spearwarden',165,184,'player');
 b.maxHp=18000;b.hp=9000;
 // Extra tank health isolates long formation navigation from the lethal balance test.
 t.hp=t.maxHp=34800;for(const u of [t,h,d,d2])u.teamId=1;
 for(const u of [t,d,d2])s._sendUnitToAttack(u,b);
 for(let i=0;i<2400;i++){s.clock+=1/60;s.repathBudgetRemaining=8;updateTeamApproaches(s);updateTeams(s,1/60);for(const u of s.units)if(!u.dead)s._updateUnit(u,1/60);s._resolveUnitCollisions();}
 assert(!t.dead);assert(!d.dead&&!d2.dead);assert.equal(b.threatTankId,t.id);assert(dist(h,b)>10);
 for(const u of [d,d2]){const front={x:(t.x-b.x)/dist(t,b),z:(t.z-b.z)/dist(t,b)};assert(!inBearSwipe(b,u,front));assert(dist(u,b)>=combatRadius(b)+combatRadius(u)-.05);}
 assert(b.hp<8990,'DPS must actually land attacks after circling');
 const goal=healerRearPosition(s,h,b,t);assert(dist(h,goal)<2,'healer must finish behind the DPS line');
 const previous={x:h.x,z:h.z};
 for(let i=0;i<1200;i++){if(i<600){b.x+=.01;b.z+=.01;t.x+=.01;t.z+=.01;}s.clock+=1/60;s.repathBudgetRemaining=8;updateTeamApproaches(s);updateTeams(s,1/60);for(const u of s.units)if(!u.dead)s._updateUnit(u,1/60);s._resolveUnitCollisions();}
 assert(dist(previous,h)>4,'healer follows a moved encounter');assert(dist(h,healerRearPosition(s,h,b,t))<2,'healer returns behind the shifted DPS line');
 assert(!t.dead&&!d.dead&&!d2.dead);
});

test('healer station follows real DPS behind a moving and rotating bear',()=>{
 const s=arena(),b=s.addUnit('grizzly',100,100,'wildlife'),t=s.addUnit('shieldbearer',107,100,'player'),h=s.addUnit('villager',112,100,'player'),d=s.addUnit('spearwarden',93,100,'player'),d2=s.addUnit('spearwarden',93,102,'player');
 for(const u of [t,h,d,d2]){u.teamId=1;u.attackTarget=b.id;u.attackTargetKind='unit';}t.command='attack';
 let goal=healerRearPosition(s,h,b,t);assert(goal.x<d.x);assert(dist(goal,t)<=TEAM_RULES.healRange);
 Object.assign(h,goal);h.command='idle';s.clock=2;s.repathBudgetRemaining=8;
 // Translate and rotate the encounter by ninety degrees.
 Object.assign(b,{x:110,z:110});Object.assign(t,{x:110,z:117});Object.assign(d,{x:110,z:103});Object.assign(d2,{x:112,z:103});
 goal=healerRearPosition(s,h,b,t);assert(goal.z<d.z);assert(goal.x>110);assert(dist(goal,t)<=TEAM_RULES.healRange);
 updateTeams(s,.3);assert(h.teamFollowing);assert(h.path.length);
});
test('enraged collision clearance separates tank from body regardless of entity order',()=>{
 for(const bearFirst of [true,false]){const s=arena();let b,t;
 if(bearFirst){b=s.addUnit('grizzly',100,100,'wildlife');t=s.addUnit('shieldbearer',102,100,'player');}
 else{t=s.addUnit('shieldbearer',102,100,'player');b=s.addUnit('grizzly',100,100,'wildlife');}
 b.hp=90;s._resolveUnitCollisions();assert(dist(b,t)>=6.44-1e-6);}
});
