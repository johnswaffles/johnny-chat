import test from 'node:test';import assert from 'node:assert/strict';import {Game,MEMORIES,PLATFORMS,parseSave} from '../src/game.js';
test('archived memories have no active waypoint or interaction',()=>{
 assert.equal(MEMORIES.length,6);
 for(const m of MEMORIES){const g=new Game();Object.assign(g.player,{x:m.x,y:m.y});assert.notEqual(g.nearby()?.type,'memory');g.interact();assert.equal(g.memories.size,0);assert.ok(!g.events.some(e=>e.type==='memory'));assert.equal(g.state,'playing');}
});
test('old discoveries retain IDs and all six discoveries survive reload',()=>{
 const old=parseSave({version:1,checkpoint:1,memories:[0,1,2]});assert.deepEqual(old.memories,[0,1,2]);assert.equal(MEMORIES[1].x,3125);assert.equal(MEMORIES[2].x,5520);
 const g=new Game();g.memories=new Set([0,1,2,3,4,5]);assert.deepEqual(new Game(parseSave(JSON.stringify(g.save()))).save().memories,[0,1,2,3,4,5]);
});
