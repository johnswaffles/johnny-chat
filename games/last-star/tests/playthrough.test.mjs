import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {routeInput} from './route-driver.mjs';
test('a complete input-driven playthrough restores three seals, defeats the guardian and returns the ember',()=>{
  const g=new Game();let frames=0;
  while(g.state==='playing'&&frames<60*300){g.update(1/60,routeInput(g));g.events=[];frames++;}
  assert.equal(g.state,'won',JSON.stringify({state:g.state,x:g.player.x,y:g.player.y,hp:g.player.hp,checkpoint:g.checkpoint,elapsed:g.elapsed,enemies:g.enemies.filter(e=>!e.dead).map(e=>({x:e.x,hp:e.hp}))}));
  assert.equal(g.checkpoint,3);assert.equal(g.bossDefeated,true);assert.equal(g.kills,13);
});
