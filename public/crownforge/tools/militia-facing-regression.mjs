import test from 'node:test';import assert from 'node:assert/strict';
import {CrownforgeSimulation} from '../src/simulation.js';
import {paintedRosterFrame} from '../src/painted-roster/painted-roster-renderer.js';
import art from '../src/painted-roster/militia.js';import {CHARACTER_RIGS} from '../src/character-rigs.js';
for(const [dx,dz,view] of [[6,0,'se'],[0,6,'sw'],[0,-6,'ne'],[-6,0,'nw']])test(`militia replaces stale facing while walking ${view}, then turns back`,()=>{
 const s=new CrownforgeSimulation({seed:42});s.units=[];s.buildings=[];s.resourcesNodes=[];s.decorations=[];s.navigationVersion++;
 const u=s.addUnit('militia',200,200,'player');u.paintedFacing=(['se','sw','ne','nw'].indexOf(view)+2)%4;
 const walk=(x,z)=>{s._sendUnitTo(u,{x,z},'move');for(let i=0;i<240;i++){s.clock+=1/60;s.repathBudgetRemaining=8;s._updateUnit(u,1/60);}};
 walk(200+dx,200+dz);assert.equal(paintedRosterFrame(u,art,CHARACTER_RIGS.militia).view,view);
 walk(200,200);assert.equal(paintedRosterFrame(u,art,CHARACTER_RIGS.militia).view,{se:'nw',sw:'ne',ne:'sw',nw:'se'}[view]);
});
