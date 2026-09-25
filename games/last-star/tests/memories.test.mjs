import test from 'node:test';import assert from 'node:assert/strict';import {Game,MEMORIES,PLATFORMS,parseSave} from '../src/game.js';
test('six story waypoints rest on accessible platforms and open the correct story',()=>{
 assert.equal(MEMORIES.length,6);assert.deepEqual([...MEMORIES].sort((a,b)=>a.x-b.x).map(m=>m.chapter),[1,2,3,4,5,6]);
 for(const [i,m] of MEMORIES.entries()){
  assert.ok(PLATFORMS.some(p=>m.x>=p.x+20&&m.x<=p.x+p.w-20&&m.y===p.y),m.title);
  const g=new Game();Object.assign(g.player,{x:m.x,y:m.y});assert.equal(g.nearby().type,'memory');assert.equal(g.nearby().label,'Read a memory');g.interact();
  assert.ok(g.memories.has(i));assert.ok(g.events.some(e=>e.type==='memory'&&e.index===i));assert.equal(m.paragraphs.length,3);assert.ok(m.paragraphs.join(' ').length>600);
  g.events=[];g.interact();assert.equal(g.memories.size,1);assert.ok(g.events.some(e=>e.type==='memory'));
 }
});
test('old discoveries retain IDs and all six discoveries survive reload',()=>{
 const old=parseSave({version:1,checkpoint:1,memories:[0,1,2]});assert.deepEqual(old.memories,[0,1,2]);assert.equal(MEMORIES[1].x,3125);assert.equal(MEMORIES[2].x,5520);
 const g=new Game();g.memories=new Set([0,1,2,3,4,5]);assert.deepEqual(new Game(parseSave(JSON.stringify(g.save()))).save().memories,[0,1,2,3,4,5]);
});
