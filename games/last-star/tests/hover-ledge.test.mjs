import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game, PLATFORMS} from '../src/game.js';

test('a landing loads the island, carries the wizard through the hover cycle, and releases on jump',()=>{
  const game=new Game(), island=game.platforms.find(p=>p.upper);
  game.enemies.forEach(enemy=>enemy.dead=true);
  Object.assign(game.player,{x:island.x+island.w/2,y:island.y-22,vy:290,onGround:false});
  for(let i=0;i<30&&!game.player.onGround;i++)game.update(1/120);
  assert.equal(game.player.y,island.y);
  assert.ok(island.springSpeed>0);
  const heights=[];
  for(let i=0;i<600;i++){
    game.update(1/120);
    assert.equal(game.player.onGround,true);
    assert.equal(game.player.y,island.y);
    heights.push(island.y);
  }
  assert.ok(Math.max(...heights)-Math.min(...heights)>8);
  assert.equal(PLATFORMS[island.id].y,island.restY);
  const fresh=new Game();assert.equal(fresh.platforms[island.id].y,island.restY);
  game.update(1/120,{jump:true});assert.ok(game.player.y<island.y);
  assert.equal(game.player.onGround,false);
  game.state='paused';const before={...island};
  game.update(.04);assert.deepEqual(island,before);
});
