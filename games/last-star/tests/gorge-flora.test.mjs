import test from 'node:test';
import assert from 'node:assert/strict';
import {PLATFORMS} from '../src/game.js';
import {floraForPlatform,plantBend} from '../src/gorge-flora.js';
test('plants stay rooted within actual platform footprints, including small jump ledges',()=>{
 for(const p of PLATFORMS){for(const plant of floraForPlatform(p)){
  assert.ok(plant.x-plant.width/2>=p.x+2);
  assert.ok(plant.x+plant.width/2<=p.x+p.w-2);
  assert.equal(plant.y,p.y+2);assert.ok(plant.height<=40);
 }}
 assert.deepEqual(floraForPlatform({id:90,x:10,y:500,w:20}),[]);
});
test('foot contact bends only plants on the same surface, with gentle motion supported',()=>{
 const plant={x:100,y:582,seed:7},time=12;
 const idle={x:100,y:580,onGround:true,vx:0};const base=plantBend(plant,time,idle);
 assert.ok(plantBend(plant,time,{...idle,vx:180})>base);
 assert.ok(plantBend(plant,time,{...idle,vx:-180})<base);
 assert.equal(plantBend(plant,time,{...idle,vx:180,onGround:false}),base);
 assert.equal(plantBend(plant,time,{...idle,vx:180,y:440}),base);
 assert.ok(Math.abs(plantBend(plant,time,{...idle,vx:180},true)-plantBend(plant,time,idle,true))<3);
});
