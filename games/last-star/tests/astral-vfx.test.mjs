import test from 'node:test';
import assert from 'node:assert/strict';
import {astralEvent,astralEnvelope,drawAstralEffects,ASTRAL_LIMIT} from '../src/astral-vfx.js';
import {Renderer} from '../src/render.js';
test('astral effects copy passage endpoints and stay bounded during repeated casts',()=>{
 const r={},event={type:'blink',from:{x:50,y:560},to:{x:285,y:558}};
 astralEvent(r,event);event.to.x=900;assert.equal(r.astralFX[0].to.x,285);
 for(let i=0;i<100;i++)astralEvent(r,{type:'cast',x:i,y:50});
 assert.equal(r.astralFX.length,ASTRAL_LIMIT);assert.equal(r.astralFX.at(-1).x,99);
});
test('astral envelope opens before dissolving and clamps expired events',()=>{
 assert.deepEqual(astralEnvelope(.72,.72),{age:0,open:0,fade:1});
 assert.equal(astralEnvelope(.4,.72).open,1);assert.equal(astralEnvelope(0,.72).fade,0);
 assert.equal(astralEnvelope(-1,.72).age,1);
});
test('paused drawing preserves spell lifetime and expired effects are pruned',()=>{
 const noop=()=>{};const gradient={addColorStop:noop};
 const ctx=new Proxy({createLinearGradient:()=>gradient},{get:(o,k)=>o[k]||noop});
 const r={ctx,art:{},camera:0,glow:noop,star:noop};astralEvent(r,{type:'blink',from:{x:0,y:560},to:{x:235,y:560}});
 const before=JSON.stringify(r.astralFX);drawAstralEffects(r,0);drawAstralEffects(r,0);assert.equal(JSON.stringify(r.astralFX),before);
 drawAstralEffects(r,1);assert.equal(r.astralFX.length,0);
});
test('expired rings, arcs and passage echoes never draw with a rejected negative alpha',()=>{
 let draws=0;const r={ctx:{},shardImpacts:[],particles:[],rings:[{life:.001,r:5}],arcs:[{life:.001}],echoes:[{life:.001}],glow(){draws++;},wizard(){draws++;}};
 Renderer.prototype.particlesDraw.call(r,.016);assert.equal(draws,0);assert.deepEqual([r.rings.length,r.arcs.length,r.echoes.length],[0,0,0]);
});
