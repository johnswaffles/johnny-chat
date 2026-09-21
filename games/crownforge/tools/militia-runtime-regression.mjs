import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import art from '../src/painted-roster/militia.js';import {CHARACTER_RIGS} from '../src/character-rigs.js';import {paintedRosterFrame} from '../src/painted-roster/painted-roster-renderer.js';
const root=new URL('../',import.meta.url);
for(const [facing,view] of ['se','sw','ne','nw'].entries())test(`new militia covers all gameplay states facing ${view}`,()=>{
 for(const action of ['idle','walk','attack','hit','stunned','death']){
  const sheet=art[view][action];assert(sheet.frames.length>=2);
  for(const f of sheet.frames){const src=f.src??sheet.src;assert(src.includes('/militia/'));const png=readFileSync(new URL(src,root));assert.equal(png[25],6);const [x,y,w,h]=f.rect;assert(x>=0&&y>=0&&x+w<=png.readUInt32BE(16)&&y+h<=png.readUInt32BE(20));assert(f.scaleBase>0);}
  const sample=paintedRosterFrame({paintedFacing:facing,animationState:action,animationPhase:.5,motionSpeed:2},art,CHARACTER_RIGS.militia);assert.equal(sample.view,view);assert(sample.frame);
 }
 for(const phase of ['anticipation','contact','recovery']){
  const indices=new Set();for(const progress of [.01,.4,.8,.99]){const sample=paintedRosterFrame({paintedFacing:facing,command:'attack',attackPhase:phase,attackPhaseElapsed:CHARACTER_RIGS.militia.actions['attack_'+phase].duration*progress},art,CHARACTER_RIGS.militia);indices.add(sample.index);}
  assert.deepEqual([...indices],art[view].attack.phases[phase]);
 }
 assert.equal(art[view].walk.frames.length,8);assert.equal(art[view].attack.frames.length,8);
 const dead=paintedRosterFrame({paintedFacing:facing,dead:true,deathAge:100},art,CHARACTER_RIGS.militia);assert.equal(dead.index,2);
});
