import test from 'node:test';import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
function setup(hp=500){const g=new Game();g.player.x=1235;g.player.y=560;g.enemies.forEach(e=>e.dead=true);const e=g.enemies[0];Object.assign(e,{dead:false,x:1500,y:560,hp,maxHp:500,cd:99,role:'ranged'});g.applyStatus(e,'ember');return {g,e};}
function advance(g,seconds){for(let i=0;i<Math.round(seconds*120);i++)g.update(1/120,{});}
test('burn feedback follows actual damage cadence and ends with the status',()=>{
 const {g,e}=setup();advance(g,.62);assert.equal(e.hp,494);let ticks=g.events.filter(e=>e.type==='burn-tick');assert.equal(ticks.length,1);assert.equal(ticks[0].damage,6);
 assert.ok(g.numbers.some(n=>n.color==='#ffad69'&&n.text==='6 burn'));
 assert.equal(g.events.find(e=>e.type==='hit').element,'fire');
 advance(g,.62);assert.equal(e.hp,488);assert.equal(g.events.filter(e=>e.type==='burn-tick').length,2);
 advance(g,2);assert.equal(e.burn,0);const count=g.events.filter(e=>e.type==='burn-tick').length;advance(g,1);assert.equal(g.events.filter(e=>e.type==='burn-tick').length,count);
});
test('burn signals report actual health removed and do not fire during pause or after death',()=>{
 const {g,e}=setup(2);g.state='paused';advance(g,1);assert.equal(e.hp,2);assert.equal(g.events.filter(e=>e.type==='burn-tick').length,0);g.state='playing';advance(g,.62);assert.ok(e.dead);assert.equal(g.events.find(e=>e.type==='burn-tick').damage,2);advance(g,2);assert.equal(g.events.filter(e=>e.type==='burn-tick').length,1);
});
