import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CrownforgeSimulation} from '../src/simulation.js';
import {combatRadius} from '../src/bear-combat.js';
import {updateTeams} from '../src/combat-teams.js';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function arena(){const s=new CrownforgeSimulation({seed:42});s.units=[];s.buildings=[];s.resourcesNodes=[];s.decorations=[];s.navigationVersion++;s._checkVictory=()=>{};s._updateEnemyAI=()=>{};s._updateEnemyIntent=()=>{};return s;}
for(const type of ['grizzly','soldier'])for(const enlarged of type==='grizzly'?[false,true]:[false])test(`tank backs out and trades hits with ${type}, enlarged=${enlarged}`,()=>{
 const s=arena(),t=s.addUnit('shieldbearer',174,180,'player'),b=s.addUnit(type,180,180,type==='grizzly'?'wildlife':'enemy');
 t.hp=t.maxHp=34800;b.hp=b.maxHp=18000;if(enlarged)b.greatwoodEnraged=true;
 s._sendUnitToAttack(t,b);s._sendUnitToAttack(b,t);
 const gap=combatRadius(t)+combatRadius(b)+.2+5;
 for(let i=0;i<1200;i++){s.clock+=1/60;s.repathBudgetRemaining=8;s._updateUnit(t,1/60);s._updateUnit(b,1/60);s._resolveUnitCollisions();}
 assert(dist(t,b)>=gap-.5,`${dist(t,b)} expected ${gap}`);assert(dist(t,b)<gap+1);
 assert(t.hp<t.maxHp,'opponent can still hurt tank');assert(b.hp<b.maxHp,'tank still attacks');
 if(type==='grizzly')assert.equal(b.threatTankId,t.id);
});
test('tank approach to buildings gains five units and still requires line of sight',()=>{
 const s=arena(),t=s.addUnit('shieldbearer',160,180,'player'),b=s.addBuilding('homestead',180,180,'enemy');
 const points=s._combatApproachPoints(t,b);assert(points.length);const p=points[0].point;
 assert(s._distanceToBuildingUnitEdge(p,b)>5);assert(s._targetDistance({...t,...p},b)<1.28);
 s._hasCombatLineOfSight=()=>false;assert.equal(s._combatApproachPoints(t,b).length,0);
});
test('rear healer can reach the newly spaced tank without increasing DPS heal range',()=>{
 const s=arena(),h=s.addUnit('villager',164,180,'player'),t=s.addUnit('shieldbearer',191.64,180,'player'),d=s.addUnit('soldier',191,181,'player');
 for(const u of [h,t,d])u.teamId=1;t.hp-=100;d.hp-=50;s._hasCombatLineOfSight=()=>true;s.clock=3;
 updateTeams(s,2);assert(t.hp>t.maxHp-100);assert.equal(d.hp,d.maxHp-50);
});
