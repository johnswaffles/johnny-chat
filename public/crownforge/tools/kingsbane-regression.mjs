import {test} from 'node:test';import assert from 'node:assert/strict';
import {CrownforgeSimulation} from '../src/simulation.js';
import {tankTarget} from '../src/combat-teams.js';
import {updateWildlife} from '../src/wildlife.js';
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function arena(){const s=new CrownforgeSimulation({seed:42});s.units=[];s.buildings=[];s.resourcesNodes=[];s.decorations=[];s.navigationVersion++;return s;}
test('Bloodclaw removes half maximum HP from every direction and low-health victims can die',()=>{
 const s=arena(),b=s.addUnit('grizzly',100,100,'wildlife'),t=s.addUnit('shieldbearer',110,100,'player');b.hp=90;
 const units=[s.addUnit('soldier',106,100,'player'),s.addUnit('spearwarden',94,100,'player'),s.addUnit('villager',100,106,'player'),s.addUnit('militia',100,94,'enemy')];
 units[1].hp=units[1].maxHp*.75;units[3].hp=units[3].maxHp*.25;
 s._startAttackCycle(b,t);s._applyGrizzlyCleave(b,t);
 near(units[0].hp,units[0].maxHp*.5);near(units[1].hp,units[1].maxHp*.25);near(units[2].hp,units[2].maxHp*.5);assert(units[3].dead);near(t.hp,t.maxHp*.99);
});
test('Kingsbane triggers strictly below half HP for melee and AoE, while defenses still stack',()=>{
 const s=arena(),b=s.addUnit('grizzly',100,100,'wildlife'),t=s.addUnit('shieldbearer',110,100,'player'),d=s.addUnit('soldier',95,100,'player');
 for(const [fraction,expected] of [[.5,20],[.499,40]]){t.hp=t.maxHp*fraction;near(s._applyUnitDamage(t,100,b).damage,expected);}
 t.hp=t.maxHp*.49;near(s._applyUnitDamage(t,t.maxHp*.5,b,{damageType:'special',areaOfEffect:true}).damage,t.maxHp*.02);
 t.hp=t.maxHp*.1;near(s._applyUnitDamage(t,100,b,{damageType:'special',areaOfEffect:true}).damage,.4);
 d.hp=d.maxHp*.49;near(s._applyUnitDamage(d,1,b).damage,1);
});
test('bear tracks weakest tank percentage, switches after healing, and ignores protected, dead, distant or hidden tanks',()=>{
 const s=arena(),b=s.addUnit('grizzly',100,100,'wildlife'),a=s.addUnit('shieldbearer',109,100,'player'),c=s.addUnit('shieldbearer',100,109,'player');
 a.maxHp=1000;a.hp=400;c.maxHp=500;c.hp=300;assert.equal(tankTarget(s,b),a);
 s._sendUnitToAttack(b,a);a.hp=800;assert.equal(s._getExplicitAttackTarget(b),c);s._updateUnit(b,1/60);assert.equal(b.attackTarget,c.id);
 s._applyUnitDamage(b,1,a);assert.equal(s._getExplicitAttackTarget(b),c,'a healthier tank cannot steal focus');
 c.lastLightWardTimer=10;assert.equal(tankTarget(s,b),a);c.lastLightWardTimer=0;c.dead=true;assert.equal(tankTarget(s,b),a);c.dead=false;c.x=150;assert.equal(tankTarget(s,b),a);
 c.x=100;s._hasCombatLineOfSight=(_b,u)=>u!==c;assert.equal(tankTarget(s,b),a);
 s._hasCombatLineOfSight=()=>true;c.hp=400;assert.equal(tankTarget(s,b),a,'equal percentages retain current owner');
});
test('an idle bear actually starts chasing its chosen tank during wildlife scans',()=>{
 const s=arena(),b=s.addUnit('grizzly',100,100,'wildlife'),t=s.addUnit('shieldbearer',112,100,'player');t.hp=t.maxHp*.4;
 assert.equal(b.command,'idle');updateWildlife(s,1);assert.equal(b.command,'attack');assert.equal(b.attackTarget,t.id);
});
