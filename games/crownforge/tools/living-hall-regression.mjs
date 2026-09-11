import test from 'node:test';
import assert from 'node:assert/strict';
import {keyPixel,smokeBillow,HALL_ART,LivingCrownHall} from '../src/crown-hall-living.js';
test('chroma key clears magenta but preserves warm building pixels',()=>{
 assert.equal(keyPixel(255,0,255)[3],0);
 assert.equal(keyPixel(145,100,60)[3],1);
 assert.equal(keyPixel(130,130,130)[3],1);
});
test('smoke moves upward from each chimney with bounded fading billows',()=>{
 assert.equal(HALL_ART.chimneys.length,3);
 const a=smokeBillow(.1,0),b=smokeBillow(.6,0);assert.ok(b.y<a.y);
 for(let t=0;t<15;t+=.1)for(let i=0;i<11;i++){const p=smokeBillow(t,i);assert.ok(p.alpha>=0&&p.alpha<=1);assert.ok(p.size>0&&p.y<=0);}
});
test('construction and ruins never emit completed hall effects',()=>{
 for(const building of [{destroyed:true,progress:1},{destroyed:false,progress:.8}]){
  LivingCrownHall.prototype.effects.call({ready:true},new Proxy({}, {get(){throw Error('drawing incomplete hall')}}),building,{},100,0,{enabled:true});
 }
});
