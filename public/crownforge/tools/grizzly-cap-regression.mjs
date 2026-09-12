import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CrownforgeSimulation} from '../src/simulation.js';
import {spawnGrizzly,requestGrizzlyPair,updateWildlife,livingGrizzliesBySide,grizzlySide} from '../src/wildlife.js';
const add=(s,side)=>s.addUnit('grizzly',side==='player'?80:515,side==='player'?80:410,'wildlife');
function automatic(s){for(let i=0;i<10;i++){const b=spawnGrizzly(s);if(b)return b;}return null;}
function finishPair(s){for(let i=0;i<18&&s.wildlifeState.pendingPair;i++){s.clock+=.5;updateWildlife(s,.5);}}
test('each side independently accepts a second bear and refuses a third',()=>{
 for(const full of ['player','enemy']){
  const s=new CrownforgeSimulation({enemyTeamPaused:false,seed:42});add(s,full);add(s,full);
  const open=full==='player'?'enemy':'player';
  assert.equal(grizzlySide(automatic(s)),open);
  assert.equal(grizzlySide(automatic(s)),open);
  assert.deepEqual(livingGrizzliesBySide(s),{player:2,enemy:2});
  assert.equal(automatic(s),null);
 }
});
test('manual releases exceed the limit and remain counted by automatic spawning',()=>{
 const s=new CrownforgeSimulation({enemyTeamPaused:false,seed:42});
 for(let i=0;i<4;i++){assert(requestGrizzlyPair(s));finishPair(s);assert.equal(s.wildlifeState.pendingPair,null);
  assert.equal(s.units.filter(u=>u.type==='grizzly').length,(i+1)*2);
  // Let prior releases clear the woodland entrances without changing sides.
  for(const [j,b] of s.units.filter(u=>u.type==='grizzly').entries()){const side=grizzlySide(b);b.x=(side==='player'?200:400)+j*4;b.z=side==='player'?150:350;}
 }
 assert.deepEqual(livingGrizzliesBySide(s),{player:4,enemy:4});assert.equal(automatic(s),null);
});
test('dead bears free capacity; living cursed bears still count; saves retain counts',()=>{
 const s=new CrownforgeSimulation({enemyTeamPaused:false,seed:42});
 const dead=add(s,'player');add(s,'player');add(s,'enemy');add(s,'enemy');
 for(const b of s.units.filter(u=>u.type==='grizzly')){b.lastLightCurseActive=true;b.lastLightCurseDecoy=true;}
 assert.equal(automatic(s),null);s._killUnit(dead);
 const copy=new CrownforgeSimulation({enemyTeamPaused:false,seed:71});assert(copy.loadSnapshot(s.serialize()));
 assert.deepEqual(livingGrizzliesBySide(copy),{player:1,enemy:2});assert.equal(grizzlySide(automatic(copy)),'player');
 assert.equal(automatic(copy),null);
});
test('crossing the midpoint transfers the count and a capped timer skips without backlog',()=>{
 const s=new CrownforgeSimulation({enemyTeamPaused:false,seed:42});const b=add(s,'player');add(s,'player');add(s,'enemy');add(s,'enemy');
 b.x=515;b.z=410;assert.deepEqual(livingGrizzliesBySide(s),{player:1,enemy:3});
 b.x=80;b.z=80;s.clock=300;updateWildlife(s,.1);assert.equal(s.wildlifeState.nextSpawnAt,540);
 s._killUnit(b);s.clock=301;updateWildlife(s,.1);assert.equal(s.units.filter(u=>u.type==='grizzly').length,4);
 for(let t=540;t<550&&s.wildlifeState.nextSpawnAt===540;t++){s.clock=t;updateWildlife(s,.1);}assert.deepEqual(livingGrizzliesBySide(s),{player:2,enemy:2});
 assert(s.wildlifeState.nextSpawnAt>=780&&s.wildlifeState.nextSpawnAt<790);
});
