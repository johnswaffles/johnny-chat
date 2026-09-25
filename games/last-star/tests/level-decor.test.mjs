import test from 'node:test';
import assert from 'node:assert/strict';
import {groundedPlacement,LANTERNS} from '../src/level-decor.js';
import {PLATFORMS,SEALS,MEMORIES} from '../src/game.js';
test('every lantern base has a supporting surface and none occupies the first pit',()=>{
 for(const lamp of LANTERNS){const p=PLATFORMS.find(p=>p.id===lamp.platformId);assert.equal(lamp.y,p.y);assert.ok(lamp.x-lamp.footprint/2>=p.x&&lamp.x+lamp.footprint/2<=p.x+p.w);}
 assert.ok(LANTERNS.every(p=>p.x<1080||p.x>1200));
 for(const prop of [...SEALS,...MEMORIES])assert.ok(PLATFORMS.some(p=>p.y===prop.y&&prop.x>=p.x&&prop.x<=p.x+p.w));
});
test('future ground prop placements reject missing surfaces and overhanging bases',()=>{
 const platforms=[{id:5,x:100,y:240,w:80}];
 for(const spec of [{platformId:9,offset:30},{platformId:5,offset:0},{platformId:5,offset:78},{platformId:5,offset:NaN}])assert.throws(()=>groundedPlacement(platforms,spec),/Unsupported/);
 assert.equal(groundedPlacement(platforms,{platformId:5,offset:40}).y,240);
 platforms[0].y=300;assert.equal(groundedPlacement(platforms,{platformId:5,offset:40}).y,300);
});
