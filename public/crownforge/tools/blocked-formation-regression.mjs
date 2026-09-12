import {test} from 'node:test';import assert from 'node:assert/strict';
import {CrownforgeSimulation} from '../src/simulation.js';
import {updateTeams,bearRearPosition} from '../src/combat-teams.js';
import {updateLastBastion,lastBastionActive} from '../src/unit-status.js';
function arena(){const s=new CrownforgeSimulation({seed:42});s.units=[];s.buildings=[];s.resourcesNodes=[];s.decorations=[];s.navigationVersion++;return s;}
test('blocked rear releases melee positioning constraint and permits front attacks',()=>{
 const s=arena(),b=s.addUnit('grizzly',100,100,'wildlife'),t=s.addUnit('shieldbearer',104,100,'player'),d=s.addUnit('soldier',104,101,'player');t.teamId=d.teamId=1;s._applyUnitDamage(b,1,t);d.attackTarget=b.id;d.attackTargetKind='unit';d.command='attack';
 s._pointBlockedForUnit=(_u,p)=>p.x<100;s._pathSegmentBlocked=()=>false;s._buildPath=(_u,p)=>p.x<100?null:[p];s._hasCombatLineOfSight=()=>true;
 assert.equal(bearRearPosition(s,d,b),null);const route=s._bestCombatRoute(d,b);assert(route);assert(route.point.x>=100);
 const hp=b.hp;for(let i=0;i<180;i++)s._updateAttack(d,1/60);assert(b.hp<hp,'front fighter must land damage');
});
test('healer unable to reach rear follows behind tank rather than retrying forever',()=>{
 const s=arena(),b=s.addUnit('grizzly',100,100,'wildlife'),t=s.addUnit('shieldbearer',107,100,'player'),h=s.addUnit('villager',108,100,'player');t.teamId=h.teamId=1;t.attackTarget=b.id;t.attackTargetKind='unit';t.command='attack';
 s._pointBlockedForUnit=(_u,p)=>p.x<100;s._pathSegmentBlocked=()=>false;s._buildPath=(_u,p)=>[p];s.repathBudgetRemaining=8;
 updateTeams(s,.2);assert(h.teamFollowing);assert(h.routeTarget.x>t.x);assert.equal(h.actionLabel,'Supporting behind the tank');
});
test('Heart heals ten percent on five-second pulses, saves pulse progress, and stops at expiry',()=>{
 const b={type:'grizzly',hp:100,maxHp:1000};updateLastBastion(b);updateLastBastion(b,4.9);assert.equal(b.hp,100);const restored=structuredClone(b);updateLastBastion(restored,.1);assert.equal(restored.hp,200);
 updateLastBastion(restored,55);assert.equal(restored.hp,700);assert(!lastBastionActive(restored));updateLastBastion(restored,20);assert.equal(restored.hp,700);
 const expiring={type:'grizzly',hp:100,maxHp:1000,lastStandTimer:1,lastStandSpent:true,lastStandHealElapsed:4};updateLastBastion(expiring,1);assert.equal(expiring.hp,200);assert(!lastBastionActive(expiring));updateLastBastion(expiring,10);assert.equal(expiring.hp,200);
 const tank={type:'shieldbearer',hp:100,maxHp:1000};updateLastBastion(tank);updateLastBastion(tank,5);assert.equal(tank.hp,100);
});
test('Heart stops healing after health exceeds sixty percent',()=>{
 const b={type:'grizzly',hp:100,maxHp:1000};updateLastBastion(b);b.hp=601;updateLastBastion(b,10);assert.equal(b.hp,601);assert(!lastBastionActive(b));
 const crossing={type:'grizzly',hp:100,maxHp:1000};updateLastBastion(crossing);crossing.hp=590;updateLastBastion(crossing,55);assert.equal(crossing.hp,690);assert(!lastBastionActive(crossing));
});
test('larger special catches rear DPS at thirteen units, not beyond fourteen',()=>{
 const s=arena(),b=s.addUnit('grizzly',100,100,'wildlife'),t=s.addUnit('shieldbearer',107,100,'player'),near=s.addUnit('soldier',87,100,'player'),far=s.addUnit('soldier',85,100,'player');b.hp=90;s._startAttackCycle(b,t);s._applyGrizzlyCleave(b,t);assert.equal(near.hp,near.maxHp*.1);assert.equal(far.hp,far.maxHp);
});
