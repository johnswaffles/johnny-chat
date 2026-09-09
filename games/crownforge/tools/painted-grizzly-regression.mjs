import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {paintedGrizzlyFrame} from '../src/grizzly-renderer.js';
import {GRIZZLY_PAINTED_ART} from '../src/grizzly-painted-art.js';
import {GRIZZLY_ATTACKS} from '../src/grizzly-motion.js';
import {CrownforgeSimulation} from '../src/simulation.js';

test('all four directions resolve approved walk, breathing, swipe and standing attack paintings',()=>{
 for(let facing=0;facing<4;facing++){
  const u={facing,attackPhase:'approach',grizzlyTravel:.6,grizzlyWalkBlend:1};
  assert.equal(paintedGrizzlyFrame(u).view,['se','sw','ne','nw'][facing]);
  assert.equal(paintedGrizzlyFrame(u).action,'walk');
  const first=paintedGrizzlyFrame(u).index;u.grizzlyTravel+=.9;assert.notEqual(paintedGrizzlyFrame(u).index,first);
  u.grizzlyWalkBlend=0;assert.equal(paintedGrizzlyFrame(u).action,'idle');
  for(const variant of ['swipe','rear']){
   const d=GRIZZLY_ATTACKS[variant];Object.assign(u,{grizzlyAttackVariant:variant,attackPhase:'contact',attackPhaseElapsed:d.duration*d.contact*.2+1e-6});
   const f=paintedGrizzlyFrame(u);assert.equal(f.action,variant);assert.equal(f.index,4,'damage lands on the painted striking paw');
   u.attackPhase='recovery';u.attackPhaseElapsed=d.duration*d.recovery-1e-6;assert.equal(paintedGrizzlyFrame(u).index,7);
  }
  u.dead=true;assert.equal(paintedGrizzlyFrame(u).action,'death');assert.equal(paintedGrizzlyFrame(u).index,0);
 }
});

test('actual combat damage uses the strike painting for both attacks',()=>{
 const s=new CrownforgeSimulation({seed:42});s.units=[];s.resourcesNodes=[];s.buildings=[];s.navigationVersion++;
 const bear=s.addUnit('grizzly',100,100,'wildlife'),target=s.addUnit('soldier',101.4,100,'player');target.hp=target.maxHp=10000;s._sendUnitToAttack(bear,target);
 const hits=[];const apply=s._applyUnitDamage.bind(s);
 s._applyUnitDamage=(t,damage,u)=>{if(u===bear){const frame=paintedGrizzlyFrame(u);hits.push(frame.action);assert.equal(frame.index,4);}return apply(t,damage,u);};
 for(let i=0;i<12*60;i++)s._updateAttack(bear,1/60);
 assert(hits.includes('swipe')&&hits.includes('rear'));
});

test('approved atlas bytes and complete source bounds survive integration',()=>{
 const root=new URL('../',import.meta.url),sources=new Set();
 for(const view of Object.values(GRIZZLY_PAINTED_ART))for(const [action,sheet] of Object.entries(view)){
  assert.equal(sheet.frames.length,action==='idle'?4:8);
  const png=readFileSync(new URL(sheet.src,root)),w=png.readUInt32BE(16),h=png.readUInt32BE(20);
  for(const f of sheet.frames){const [x,y,fw,fh]=f.rect;assert(x>=0&&y>=0&&x+fw<=w&&y+fh<=h);}
  sources.add(sheet.src);
 }
 assert.equal(sources.size,12);
 for(const file of ['APPROVED_WALK_SHA256.txt','APPROVED_ACTIONS_SHA256.txt']){
  const manifest=readFileSync(new URL('art-notes/painted-grizzly/'+file,root),'utf8');
  for(const line of manifest.trim().split('\n')){const [hash,path]=line.split(/\s+/,2);if(!sources.has('./'+path))continue;assert.equal(createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex'),hash);}
 }
});
