import test from 'node:test';import assert from 'node:assert/strict';
import {CrownforgeSimulation} from '../src/simulation.js';
import {paintedRosterFrame} from '../src/painted-roster/painted-roster-renderer.js';
import art from '../src/painted-roster/wizard.js';import {CHARACTER_RIGS} from '../src/character-rigs.js';
function arena(){const s=new CrownforgeSimulation({seed:42,enemyTeamPaused:false});s.units=[];s.pausedEnemyUnits=[];s.buildings=[];s.resourcesNodes=[];s.decorations=[];s.navigationVersion++;s._hasCombatLineOfSight=()=>true;return s;}
const cases=[['lower right',30,0,'se'],['lower left',0,30,'sw'],['upper right',0,-30,'ne'],['upper left',-30,0,'nw']];
for(const [label,dx,dz,view] of cases){
 test(`wizard casting faces ${label} target through anticipation, contact and recovery`,()=>{
  const s=arena(),w=s.addUnit('wizard',200,200,'player'),e=s.addUnit('soldier',200+dx,200+dz,'enemy');e.hp=e.maxHp=10000;w.paintedFacing=(['se','sw','ne','nw'].indexOf(view)+2)%4;s._sendUnitToAttack(w,e);
  const phases=new Set();for(let i=0;i<140;i++){s.clock+=1/60;s.repathBudgetRemaining=8;s._updateUnit(w,1/60);const sample=paintedRosterFrame(w,art,CHARACTER_RIGS.wizard);if(w.attackPhase!=='approach'){phases.add(w.attackPhase);assert.equal(sample.view,view);}}
  assert.deepEqual([...phases].sort(),['anticipation','contact','recovery']);
 });
 test(`wizard walking faces ${label} and retains that stance when stopped`,()=>{
  const s=arena(),w=s.addUnit('wizard',200,200,'player');w.paintedFacing=2;s._sendUnitTo(w,{x:200+dx/6,z:200+dz/6},'move');
  for(let i=0;i<300;i++){s.clock+=1/60;s.repathBudgetRemaining=8;s._updateUnit(w,1/60);}
  assert.equal(paintedRosterFrame(w,art,CHARACTER_RIGS.wizard).view,view);assert.equal(w.command,'idle');
 });
}
test('new target immediately replaces stale wizard aim near the screen-axis boundary',()=>{const s=arena(),w=s.addUnit('wizard',200,200,'player');w.paintedFacing=2;const e=s.addUnit('soldier',220,221,'enemy');s._sendUnitToAttack(w,e);s._updateUnit(w,.016);assert.equal(w.paintedFacing,1);assert.equal(paintedRosterFrame(w,art,CHARACTER_RIGS.wizard).view,'sw');});
