import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {trails} from '../src/silverwood-trails.js';

test('all three optional routes can be completed with forward movement and two jumps', () => {
  for (const [index, trail] of trails.entries()) {
    const game = new Game();
    const start = trail.stars[0][0];
    game.player.x = start - 40;
    game.player.y = game.platforms.find(p => !p.upper && p.x <= start && p.x+p.w >= start).y;
    let jumpAt;
    for (let frame = 0; frame < 110; frame++) {
      if (jumpAt === undefined && game.player.x >= start) jumpAt = frame;
      game.update(1/60,{move:1, jump:frame === jumpAt || frame === jumpAt + 15});
    }
    assert.equal(game.trailCounts[index],3,trail.name);
    assert.equal(game.events.filter(e=>e.type==='trail-note' && e.complete).length,1);
    assert.ok(game.arcade.overdrive > 0);
  }
});

test('Eventide catches an imminent oncoming bolt and leaves a departing or overhead bolt alone', () => {
  for (const [dx,dy,vx,reward] of [[50,0,-240,150],[50,0,240,0],[50,-90,-240,0],[90,0,-240,0]]) {
    const game=new Game();
    game.projectiles.push({owner:'enemy',x:game.player.x+dx,y:game.player.y-55+dy,vx,vy:0,life:2});
    assert.ok(game.spell('blink',{move:1}));
    assert.equal(game.arcade.score,reward);
    assert.equal(game.projectiles.length,reward?0:1);
  }
});
