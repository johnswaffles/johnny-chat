import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CrownforgeSimulation} from '../src/simulation.js';
function arena(){const s=new CrownforgeSimulation({seed:42});s.units=[];s.buildings=[];s.resourcesNodes=[];s.decorations=[];s.navigationVersion++;s._checkVictory=()=>{};s._updateEnemyAI=()=>{};s._updateMilitaryServices=()=>{};s.wildlifeState.nextSpawnAt=Infinity;return s;}
for(const team of [false,true])test(`48 selected units retain separated destinations and arrive around a building; team=${team}`,()=>{
 const s=arena();s.addBuilding('barracks',145,150,'player',1);
 for(let i=0;i<48;i++){const u=s.addUnit(team?(i<10?'shieldbearer':i<38?'spearwarden':'villager'):'soldier',85+(i%8)*2.5,130+Math.floor(i/8)*2.5,'player');if(team)u.teamId=1;}
 s.selectedIds=s.units.map(u=>u.id);s._syncSelectionFlags();
 assert(s.issueContextCommand({x:200,z:164}).success);
 const targets=s.units.map(u=>u.routeTarget);assert(targets.every(Boolean));
 for(let i=0;i<targets.length;i++)for(let j=i+1;j<targets.length;j++)assert(Math.hypot(targets[i].x-targets[j].x,targets[i].z-targets[j].z)>=2.19);
 const arrived=new Set();
 for(let step=0;step<2400&&arrived.size<s.units.length;step++){s.update(.05);s.units.forEach((u,i)=>{if(Math.hypot(u.x-targets[i].x,u.z-targets[i].z)<1.5)arrived.add(u.id);});}
 const left=s.units.filter(u=>!arrived.has(u.id));
 assert.equal(left.length,0,JSON.stringify(left.map(u=>({id:u.id,command:u.command,label:u.actionLabel,x:u.x,z:u.z}))));
});
test('blocked formation slots fan into clear space near the destination',()=>{
 const s=arena();s.addBuilding('homestead',180,180,'player',1);
 for(let i=0;i<24;i++)s.addUnit('soldier',140+i%6*2.5,150+Math.floor(i/6)*2.5,'player');
 s.selectedIds=s.units.map(u=>u.id);s._syncSelectionFlags();assert(s.issueContextCommand({x:190,z:190}).success);
 assert(s.units.every(u=>u.command==='move'&&!s._pointBlockedForUnit(u,u.routeTarget)));
});
