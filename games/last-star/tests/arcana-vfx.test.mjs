import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {arcanaEvent,drawArcanaAftermath,dangerPhase,ARCANA_FX_LIMIT,drawHostileGround,drawHostileProjectile,drawEnemyAura,drawEnemyCharge} from '../src/hostile-vfx.js';
import {lightEvent,spellLights} from '../src/reactive-light.js';
import {drawCheckpoint,drawPlayerWard} from '../src/checkpoint-art.js';
function stub(){const noop=()=>{},gradient={addColorStop:noop},ctx=new Proxy({createLinearGradient:()=>gradient},{get:(o,k)=>o[k]||noop});return {ctx,art:{},camera:0,w:1280,time:1,glow:noop,star:noop,prop:noop};}
test('rift painting waits for the actual damage event; warning and visual never advance independently',()=>{
 const g=new Game();g.enemies.forEach(e=>e.dead=true);Object.assign(g.player,{x:400,y:580,onGround:true});
 const f={type:'danger',x:400,y:580,age:.93,life:.47,fired:false};g.effects=[f];
 g.update(.01,{});assert.equal(g.player.hp,210);assert.equal(dangerPhase(f).eruption,false);
 g.update(.02,{});assert.equal(g.player.hp,170);assert.equal(dangerPhase(f).eruption,true);assert.equal(g.events.filter(e=>e.type==='danger-hit').length,1);
 g.update(.01,{});assert.equal(g.player.hp,170);assert.ok(dangerPhase(f).fade<=1);
 assert.equal(dangerPhase({age:1.4,life:0,fired:true}).fade,0);
});
test('rift boundary still damages inside ninety units and leaves the edge safe',()=>{
 for(const [distance,hp]of [[89.9,170],[90,210],[91,210]]){const g=new Game();g.enemies.forEach(e=>e.dead=true);Object.assign(g.player,{x:400+distance,y:580,onGround:true});g.effects=[{type:'danger',x:400,y:580,age:.95,life:.45,fired:false}];g.update(.001,{});assert.equal(g.player.hp,hp);}
});
test('new spell aftermath is bounded, frozen when paused, and expires without drawing',()=>{
 const r=stub();for(let i=0;i<80;i++)arcanaEvent(r,{type:'hostile-impact',x:i,y:500});assert.equal(r.arcanaFX.length,ARCANA_FX_LIMIT);
 const before=JSON.stringify(r.arcanaFX);drawArcanaAftermath(r,0);drawArcanaAftermath(r,0);assert.equal(JSON.stringify(r.arcanaFX),before);
 let draws=0;r.glow=()=>draws++;drawArcanaAftermath(r,2);assert.equal(r.arcanaFX.length,0);assert.equal(draws,0);
 arcanaEvent(r,{type:'seal',x:NaN,y:10});assert.equal(r.arcanaFX.length,0);
});
test('optional arcana artwork can be unavailable without breaking gateways, attacks or wards',()=>{
 const r=stub();for(const checkpoint of [0,1,2])drawCheckpoint(r,{checkpoint,player:{x:820}},{x:820,y:580},0);
 for(const visual of ['wraith','fan','sweep'])drawHostileProjectile(r,{x:400,y:500,vx:-250,vy:0,visual});
 for(const fired of [false,true])drawHostileGround(r,{x:400,y:580,age:fired?1:.5,life:.3,fired});
 drawEnemyAura(r,{x:500,y:570,type:'boss',phase:1,face:-1,windup:.3,freeze:0,stagger:0});
 drawEnemyCharge(r,{x:500,y:570,type:'boss',phase:1,face:-1,windup:.3,freeze:0,stagger:0});
 drawPlayerWard(r,{x:400,y:570,mantle:2});
});
test('hostile and friendly event lights remain distinct and capped',()=>{
 const r={time:0};for(const type of ['enemy-cast','hostile-impact','danger-hit','seal','mantle'])lightEvent(r,{type,x:100,y:570});
 assert.deepEqual(r.lightPulses.map(e=>[e.color,e.y]),[['violet',570],['violet',570],['violet',540],['gold',485],['teal',570]]);
 for(let i=0;i<90;i++)lightEvent(r,{type:'enemy-cast',x:i,y:500});assert.equal(r.lightPulses.length,12);assert.equal(spellLights({projectiles:[]},r).length,4);
 r.time=3;assert.deepEqual(spellLights({projectiles:[]},r),[]);
});
test('enemy casting art tags follow all three unchanged boss attack patterns',()=>{
 for(const [phase,visual,damage,count]of [[0,'fan',25,3],[1,'rift',0,0],[2,'sweep',30,1]]){
  const g=new Game();g.enemies.forEach(e=>e.dead=true);g.checkpoint=3;g.bossStarted=true;Object.assign(g.player,{x:7050,y:570,onGround:true});
  const e=g.enemies.find(e=>e.type==='boss');Object.assign(e,{dead:false,x:7400,y:570,windup:.001,phase});g.update(.01,{});
  assert.equal(g.projectiles.length,count);assert.ok(g.projectiles.every(b=>b.visual===visual&&b.damage===damage));assert.equal(g.events.find(e=>e.type==='enemy-cast').visual,visual);
  if(phase===1)assert.deepEqual(g.effects.map(f=>f.x),[6935,7165]);
 }
});
