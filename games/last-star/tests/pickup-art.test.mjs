import test from 'node:test';
import assert from 'node:assert/strict';
import {drawGroundPickup,drawGroundChest,drawArcadeCrystal} from '../src/pickup-art.js';
import {drawLevel1} from '../src/level1-fx.js';

function renderer(overrides={}){
 const calls=[],ctx={};
 for(const method of ['save','restore','beginPath','ellipse','fill','stroke','moveTo','lineTo','closePath','fillRect','drawImage'])ctx[method]=(...args)=>calls.push([method,...args]);
 return {ctx,calls,art:{},camera:0,w:1280,time:3,quality:'high',gentle:false,reducedFlash:false,
  glow(...args){calls.push(['glow',...args]);},star(...args){calls.push(['star',...args]);},...overrides};
}
const image={width:512,height:512};

test('a released reward remains visible in front of its opaque open chest',()=>{
 const opened={width:512,height:512},gem={width:512,height:512};
 const r=renderer({art:{pickup_chest_open:opened,pickup_gem:gem}});
 drawLevel1(r,{chests:[{x:200,floor:558,open:true}],loot:[{x:200,y:558,floor:558,vy:0,kind:'gem'}],enemies:[]},0);
 assert.deepEqual(r.calls.filter(c=>c[0]==='drawImage').map(c=>c[1]),[opened,gem]);
});

test('registered chest art keeps its aspect and foot on the supporting terrain',()=>{
 const r=renderer({art:{pickup_chest:image,pickupBounds:{chest:[20,70,470,300]}}});
 const chest=Object.freeze({x:200,y:552,floor:558,open:false});
 drawGroundChest(r,chest);
 const [,im,sx,sy,sw,sh,x,y,w,h]=r.calls.find(c=>c[0]==='drawImage');
 assert.equal(im,image);assert.deepEqual([sx,sy,sw,sh],[20,70,470,300]);
 assert.ok(Math.abs(w/h-470/300)<1e-10);
 assert.equal(x+w/2,200);assert.equal(y+h,581);
 assert.ok(w<=90&&h<=66);
});

test('every resting item silhouette stays above its real supporting surface throughout its bob',()=>{
 for(const kind of ['ember','frost','chain','flask','power','gem','gold']){
  const d=Object.freeze({x:200,y:558,floor:558,vy:0,kind,count:3});
  for(let time=0;time<8;time+=.2){
   const r=renderer({time,art:{['pickup_'+kind]:image}});drawGroundPickup(r,d);
   const draw=r.calls.find(c=>c[0]==='drawImage');
   assert.ok(draw[7]+draw[9]<=580,`${kind} enters its terrain at ${time}`);
  }
 }
});

test('gentle pickup rendering is static; reduced flashes and Light suppress glints',()=>{
 const d=Object.freeze({x:200,y:558,floor:558,vy:0,kind:'ember'});
 const a=renderer({gentle:true,time:1,art:{pickup_ember:image}}),b=renderer({gentle:true,time:99,art:{pickup_ember:image}});
 drawGroundPickup(a,d);drawGroundPickup(b,d);assert.deepEqual(a.calls,b.calls);
 for(const setting of [{reducedFlash:true},{quality:'low'}]){
  const r=renderer({...setting,art:{pickup_ember:image}});drawGroundPickup(r,d);
  assert.equal(r.calls.filter(c=>c[0]==='star').length,0);
 }
});

test('emptied chests have no magical glow or sparkle, and old assets remain a safe fallback',()=>{
 const r=renderer({art:{item_chest:image,pickupBounds:{chest:[0,0,999,999]}}});
 drawGroundChest(r,Object.freeze({x:200,floor:558,open:true}));
 assert.equal(r.calls.filter(c=>c[0]==='glow'||c[0]==='star').length,0);
 const draw=r.calls.find(c=>c[0]==='drawImage');assert.equal(draw[1],image);assert.deepEqual(draw.slice(2,6),[0,0,512,512]);
});

test('the painted open chest stays opaque, grounded, and at the closed chest width',()=>{
 const opened={width:512,height:512};
 const r=renderer({art:{pickup_chest:image,pickup_chest_open:opened,pickupBounds:{chest_open:[10,10,490,500]}}});
 drawGroundChest(r,Object.freeze({x:200,floor:558,open:true}));
 const draw=r.calls.find(c=>c[0]==='drawImage');
 assert.equal(draw[1],opened);assert.equal(r.ctx.globalAlpha,1);
 assert.equal(draw[8],90);assert.ok(draw[9]<=100);assert.equal(draw[7]+draw[9],581);
 assert.equal(r.calls.filter(c=>c[0]==='glow'||c[0]==='star').length,0);
});

test('crystal presentation preserves drops, supports homing, and omits taken/offscreen loot',()=>{
 const r=renderer({art:{pickup_power:image}}),d=Object.freeze({x:200,y:558,floor:562,vy:0,homing:true});
 drawArcadeCrystal(r,d,Object.freeze({x:200,y:608}));
 assert.ok(r.calls.some(c=>c[0]==='drawImage'));
 assert.ok(r.calls.flat().filter(x=>typeof x==='number').every(Number.isFinite));
 for(const item of [{...d,taken:true},{...d,x:-1000}]){
  const q=renderer();drawArcadeCrystal(q,item,{x:0,y:0});drawGroundPickup(q,{...item,kind:'gold'});assert.deepEqual(q.calls,[]);
 }
});
