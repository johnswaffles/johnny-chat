import test from 'node:test';
import assert from 'node:assert/strict';
import {gorgeLayout} from '../src/gorge-scene.js';
import {PLATFORMS} from '../src/game.js';
import {floraForPlatform} from '../src/gorge-flora.js';

test('the same finite vistas cover the entire level without exposed side edges or stretched art',()=>{
 for(const width of [428,1280,1800,2560])for(let camera=0;camera<=7900;camera+=50){
  const layout=gorgeLayout(width,camera);
  for(const [x,,w,h] of Object.values(layout)){
   assert.ok(x<=0);assert.ok(x+w>=width-1e-8);assert.equal(w/h,3);
  }
  assert.equal(layout.ridge[1]+layout.ridge[3],720);
 }
});
test('former transition has continuous parallax rather than a hard handoff',()=>{
 for(const camera of [0,1799.99,1800,2600,6000,7900]){
  const a=gorgeLayout(1280,camera),b=gorgeLayout(1280,camera+.01);
  for(const layer of ['horizon','ridge']){
   assert.ok(b[layer][0]<=a[layer][0]);
   assert.ok(Math.abs(a[layer][0]-b[layer][0])<.005);
  }
 }
 for(const p of PLATFORMS.filter(p=>p.x>=2600))assert.ok(floraForPlatform(p).length>0);
});
