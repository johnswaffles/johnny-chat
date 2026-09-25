import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,missingHealthBonus} from '../src/game.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('all missing health percentages grant proportional damage and 2 percent healing',()=>{
 for(let missing=0;missing<=99;missing++){
  const g=new Game(),p=g.player,e=g.enemies[0];p.hp=p.maxHp*(1-missing/100);e.hp=10000;
  const before=p.hp;near(missingHealthBonus(p),missing/100);g.damage(e,100);
  near(10000-e.hp,100+missing);near(p.hp,Math.min(p.maxHp,before+(100+missing)*.02));
 }
});
test('lifesteal uses actual health removed, replaces flat kill healing, and cannot exceed max health',()=>{
 const g=new Game(),e=g.enemies[0];g.player.hp=84;e.hp=5;g.damage(e,1000);near(g.player.hp,84.1);assert.equal(e.hp,0);assert.equal(e.dead,true);
 g.damage(e,1000);near(g.player.hp,84.1);
 g.player.hp=209.9;g.enemies[1].hp=10000;g.damage(g.enemies[1],100);assert.equal(g.player.hp,210);
});
test('health bonus stacks with Reckoning, decreases after healing, and ignores invulnerable targets',()=>{
 const g=new Game();g.player.hp=84;g.player.blinked=true;const e=g.enemies[0];e.hp=10000;
 g.damage(e,100);assert.equal(e.hp,9800);near(g.player.hp,88);assert.ok(missingHealthBonus(g.player)<.6);
 const hp=g.player.hp;g.damage(g.enemies.at(-1),100);assert.equal(g.player.hp,hp);
});
