import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
const target=g=>{const e=g.enemies[0];e.hp=e.maxHp=10000;return e;};
test('three enemy hits bank actual HP lost; next spell adds exactly 300 percent once',()=>{
 const g=new Game(),e=target(g);for(const n of [10,20,30]){g.player.invuln=0;g.hurt(n);}
 assert.equal(g.player.retaliation,60);g.spell('bolt');const shot=g.projectiles[0];assert.equal(shot.attack.bonus,180);assert.equal(g.player.retaliation,0);
 const normal=36*(1+60/210);g.damage(e,shot.damage,shot.attack);assert.equal(10000-e.hp,Math.round(normal+180));
 const hp=e.hp;g.damage(e,36,shot.attack);assert.ok(hp-e.hp<100);
});
test('invulnerability, falls and invalid damage cannot charge; Mantle uses reduced loss',()=>{
 const g=new Game();g.player.invuln=1;g.hurt(50);assert.equal(g.player.retaliation,0);
 g.player.invuln=0;g.hurt(20,'environment');assert.equal(g.player.retaliation,0);
 g.player.invuln=0;g.hurt(NaN);g.hurt(-50);assert.equal(g.player.retaliation,0);
 g.player.hp=75;g.hurt(20);assert.equal(g.player.retaliation,6);assert.equal(g.player.hp,69);
});
test('failed casts and non-damaging blink preserve bank; casting into empty air consumes it',()=>{
 const g=new Game();g.hurt(10);g.player.mana=0;assert.equal(g.spell('constellation'),false);assert.equal(g.player.retaliation,10);
 assert.equal(g.spell('dragon'),false);g.enemies.forEach(e=>e.dead=true);g.spell('blink');assert.equal(g.player.retaliation,10);
 g.spell('bolt');assert.equal(g.player.retaliation,0);assert.equal(g.projectiles[0].attack.bonus,30);
});
test('old projectiles cannot consume newly accumulated damage; new attack owns its charge',()=>{
 const g=new Game(),e=target(g);g.spell('bolt');const old=g.projectiles[0];g.hurt(20);g.damage(e,old.damage,old.attack);assert.equal(g.player.retaliation,20);
 g.player.cooldowns.bolt=0;g.spell('bolt');const next=g.projectiles[1];assert.equal(next.attack.bonus,60);
 g.player.invuln=0;g.hurt(10);g.damage(e,next.damage,next.attack);assert.equal(g.player.retaliation,10);
});
test('area and persistent attacks share a single bonus budget, retry does not persist charge',()=>{
 for(const kind of ['constellation','dragon']){const g=new Game();g.checkpoint=2;g.hurt(10);g.spell(kind);const attack=kind==='dragon'?g.dragon.attack:g.effects[0].attack;
 const e=target(g);g.damage(e,1,attack);assert.equal(attack.used,true);const hp=e.hp;g.damage(e,1,attack);assert.ok(hp-e.hp<5);assert.equal(new Game(g.save()).player.retaliation,0);}
});
