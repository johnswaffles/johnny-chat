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

test('registered water rectangle stays attached to ridge at every camera and aspect',async()=>{
 const {gorgeWaterRect,GORGE_WATER}=await import('../src/gorge-scene.js');
 assert.deepEqual(GORGE_WATER,{u:.416,v:.585,w:.146,h:.47});
 for(const width of [960,1280,1800,2560])for(const camera of [0,1800,2500,6500,7900]){
  const ridge=gorgeLayout(width,camera).ridge,[x,y,w,h]=gorgeWaterRect(ridge);
  assert.equal(x,ridge[0]+ridge[2]*.416);assert.equal(y,ridge[1]+ridge[3]*.585);
  assert.equal(w,ridge[2]*.146);assert.equal(h,ridge[3]*.47);
 }
});
test('atmospheric grading leaves solid layers opaque and the observatory spire inside frame',async()=>{
 const {gorgeAppearance}=await import('../src/gorge-scene.js');
 for(const kind of ['horizon','ridge']){const style=gorgeAppearance(kind);assert.equal(style.opacity,1);assert.ok(style.exposure>0&&style.exposure<1);assert.ok(style.saturation>0&&style.saturation<=1);}
 assert.ok(gorgeAppearance('clouds').opacity<1);
 for(const width of [960,1280,1800,2560])assert.ok(gorgeLayout(width,0).horizon[1]+gorgeLayout(width,0).horizon[3]*.20>0);
});
