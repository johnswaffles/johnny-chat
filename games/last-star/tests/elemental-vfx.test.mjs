import test from 'node:test';import assert from 'node:assert/strict';
import {lightningPoints} from '../src/elemental-vfx.js';
import {elementEvent} from '../src/level1-fx.js';
test('lightning remains attached to both targets and bounded for either facing and coincident targets',()=>{
 for(const to of [{x:470,y:180},{x:-470,y:-180},{x:0,y:0}]){
  const a={x:0,y:0},points=lightningPoints(a,to,2),len=Math.hypot(to.x,to.y)||1;
  assert.deepEqual(points[0],[0,0]);assert.ok(Math.hypot(points.at(-1)[0]-to.x,points.at(-1)[1]-to.y)<1e-8);
  for(const [x,y] of points){assert.ok(Number.isFinite(x)&&Number.isFinite(y));assert.ok(Math.abs((x*to.y-y*to.x)/len)<=12.00001);}
  assert.deepEqual(points,lightningPoints(a,to,2));
 }
});
test('rapid elemental casts and impacts share the aftermath budget and preserve world anchors',()=>{
 const r={time:10,burst(){}};
 for(let i=0;i<100;i++)elementEvent(r,{type:'special-cast',kind:['ember','frost','chain'][i%3],x:120,y:240});
 assert.equal(r.elementFX.length,32);assert.ok(r.elementFX.every(f=>f.kind==='cast'&&f.x===120&&f.y===240&&f.life>0));
 elementEvent(r,{type:'chain-arc',from:{x:120,y:240},to:{x:-10,y:80}});
 assert.equal(r.elementFX.length,32);assert.deepEqual(r.elementFX.at(-1).to,{x:-10,y:80});assert.equal(r.elementFX.at(-1).x,120);
});
