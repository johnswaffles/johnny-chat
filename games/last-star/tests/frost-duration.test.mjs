import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {LEVEL1} from '../src/level1-config.js';
test('Frost Fan holds ordinary enemies for 2.2 seconds and releases them afterward',()=>{
 const g=new Game(),e=g.enemies.find(e=>e.role==='ranged');
 g.enemies=g.enemies.filter(v=>v===e);g.player.x=e.x-200;g.player.y=e.y;e.cd=99;e.windup=.4;
 g.applyStatus(e,'frost');assert.equal(LEVEL1.spells.frost.freeze,2.2);assert.equal(e.freeze,2.2);
 const x=e.x;
 for(let i=0;i<120;i++)g.update(1/60);
 assert.ok(Math.abs(e.freeze-.2)<1e-8);assert.equal(e.x,x);assert.equal(e.windup,.4);
 g.state='paused';g.update(.04);assert.ok(Math.abs(e.freeze-.2)<1e-8);g.state='playing';
 for(let i=0;i<14;i++)g.update(1/60);
 assert.equal(e.freeze,0);assert.ok(e.windup<.4);assert.ok(e.freezeImmune>0);
});
test('longer ordinary freeze preserves resistant enemies and one-hit shatter',()=>{
 const g=new Game();for(const e of g.enemies.filter(e=>e.role==='brute'||e.type==='boss')){g.applyStatus(e,'frost');assert.equal(e.slow,1.6);assert.ok(!e.freeze);}
 const e=g.enemies.find(e=>e.role==='ranged'),attack={bonus:0,used:false};g.applyStatus(e,'frost',attack);g.damage(e,1,attack);assert.equal(e.freeze,2.2);g.damage(e,1,{bonus:0,used:false});assert.equal(e.freeze,0);g.applyStatus(e,'frost');assert.equal(e.freeze,0);
});
