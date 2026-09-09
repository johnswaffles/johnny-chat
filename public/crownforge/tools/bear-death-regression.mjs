import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {CrownforgeSimulation} from '../src/simulation.js';
import {paintedGrizzlyFrame,GRIZZLY_VIEW_SCALE} from '../src/grizzly-renderer.js';
import {GRIZZLY_DEATH_ART} from '../src/grizzly-death-art.js';
import {BEAR_DEATH,corpseLifetime} from '../src/bear-combat.js';
test('four complete grounded collapse frames settle and hold, never returning to idle',()=>{
 for(let facing=0;facing<4;facing++){
  const indices=new Set();
  for(let t=0;t<6;t+=.05){const f=paintedGrizzlyFrame({facing,dead:true,deathAge:t});assert.equal(f.action,'death');indices.add(f.index);if(t>=BEAR_DEATH.collapse)assert.equal(f.index,3);}
  assert.deepEqual([...indices],[0,1,2,3]);
 }
});
test('collapse sources have real alpha and clipping bounds stay inside the original PNG',()=>{
 for(const sheet of Object.values(GRIZZLY_DEATH_ART)){
  const bytes=readFileSync(new URL('../'+sheet.src,import.meta.url));assert.equal(bytes[25],6,'PNG is RGBA');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  assert.equal(sheet.frames.length,4);
  for(const f of sheet.frames){const [x,y,w,h]=f.rect;assert(x>=0&&y>=0&&x+w<=width&&y+h<=height);assert(f.pivot[1]<=h);for(const [cx,cy,cw,ch] of f.clip)assert(cx>=0&&cy>=0&&cx+cw<=w&&cy+ch<=h);}
 }
});
test('rear body width matches front mass and collapse begins at the same scale as idle',()=>{
 const widths=[];
 for(let facing=0;facing<4;facing++){
  const idle=paintedGrizzlyFrame({facing}),death=paintedGrizzlyFrame({facing,dead:true});
  const width=f=>f.frame.rect[2]/f.sheet.scaleBase*GRIZZLY_VIEW_SCALE[f.view];
  assert(Math.abs(width(idle)-width(death))<.01);widths.push(width(idle));
 }
 assert(Math.max(...widths)/Math.min(...widths)<1.14);
});
test('a killed bear remains for its collapse and rest in playing and finished matches, including after load',()=>{
 for(const phase of ['playing','victory']){
  const s=new CrownforgeSimulation({seed:42});s.units=[];s.resourcesNodes=[];s.buildings=[];s.navigationVersion++;s._checkVictory=()=>{};s._updateEnemyAI=()=>{};s._updateEnemyIntent=()=>{};
  const b=s.addUnit('grizzly',100,100,'wildlife');s._killUnit(b);s.phase=phase;
  for(let i=0;i<4.8*60;i++)s._updateFixed(1/60);assert(s.units.includes(b));assert.equal(paintedGrizzlyFrame(b).index,3);
  const saved=s.serialize(),r=new CrownforgeSimulation({seed:42});assert(r.loadSnapshot(saved));const restored=r.units.find(u=>u.id===b.id);assert(restored.dead);assert(restored.deathAge>4.7);assert.equal(corpseLifetime(restored),6);
  for(let i=0;i<90;i++)s._updateFixed(1/60);assert(!s.units.includes(b));
 }
});
