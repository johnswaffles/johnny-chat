import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CrownforgeSimulation} from '../src/simulation.js';
import {encounterOpenness,findPullClearing} from '../src/combat-teams.js';
import {CONFIG} from '../src/config.js';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function scene(edge=false){const s=new CrownforgeSimulation({seed:42});s.units=[];s.buildings=[];s.resourcesNodes=[];s.decorations=[];s.navigationVersion++;const x=edge?CONFIG.mapWidth-9:180;const b=s.addUnit('grizzly',x,180,'wildlife'),t=s.addUnit('shieldbearer',x-12,180,'player');b.greatwoodEnraged=true;b.hp=b.maxHp=180000;t.hp=t.maxHp=348000;s._applyGrizzlyCleave=()=>{};s.addResource('tree','wood',x,166,2400,0,{sizeTier:'large'});return {s,b,t};}
for(const edge of [false,true])test(`a solo unteamed tank pulls a canopy-covered bear into clear fighting space, map edge=${edge}`,()=>{const {s,b,t}=scene(edge);assert(encounterOpenness(s,b)<.97);s._sendUnitToAttack(t,b);s._applyUnitDamage(b,1,t);s.repathBudgetRemaining=8;assert(findPullClearing(s,t,b));const start={x:b.x,z:b.z};let pulled=false;for(let i=0;i<2700;i++){s.clock+=1/60;s.repathBudgetRemaining=8;for(const u of s.units)if(!u.dead)s._updateUnit(u,1/60);s._resolveUnitCollisions();pulled ||= !!t.tankPull;}assert(pulled);assert(dist(b,start)>5);assert(encounterOpenness(s,b)>=.97,JSON.stringify({b:{x:b.x,z:b.z},t:{x:t.x,z:t.z,label:t.actionLabel},open:encounterOpenness(s,b)}));});
test('cleared trees do not force a pull and impassable routes are rejected',()=>{const {s,b,t}=scene();s.resourcesNodes[0].amount=0;assert.equal(findPullClearing(s,t,b),null);s.resourcesNodes[0].amount=100;s._pathSegmentBlocked=()=>true;assert.equal(findPullClearing(s,t,b),null);});
