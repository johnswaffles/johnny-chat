import test from 'node:test';
import assert from 'node:assert/strict';
import {makePuzzle,validPuzzle} from '../../public/color-studio/engine.js';
const image=(w,h,pixel)=>{const data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set([...pixel(x,y),255],(y*w+x)*4);return data;};
test('connected regions cover every pixel; labels lie inside their own outlined region',()=>{
  const w=70,h=50,data=image(w,h,(x,y)=>x>20&&x<48&&y>12&&y<39?[215,70,40]:[60,130,150]);
  const p=makePuzzle(data,w,h,{colors:8,minArea:4});
  assert.equal(p.regions.length,2);assert.equal(p.palette.length,2);assert.ok(validPuzzle(p));
  assert.equal(p.regions.reduce((n,r)=>n+r.size,0),w*h);
  for(const [id,r] of p.regions.entries()){assert.equal(p.map[Math.floor(r.y)*w+Math.floor(r.x)],id);assert.ok(r.paths.length);assert.ok(r.paths.every(path=>path.length>=4));}
  assert.equal(p.regions.find(r=>r.size>2000).paths.length,2,'background has an exterior and a hole');
  assert.deepEqual(makePuzzle(data,w,h,{colors:8,minArea:4}),p,'conversion is deterministic');
});
test('photo noise merges into a playable number of connected spaces',()=>{
  const w=110,h=90;let seed=9123;const random=()=>((seed=(seed*1664525+1013904223)>>>0)>>>24);
  const p=makePuzzle(image(w,h,()=>[random(),random(),random()]),w,h,{colors:20,minArea:18,maxRegions:230});
  assert.ok(p.regions.length<=230);assert.ok(p.regions.length>20);assert.ok(validPuzzle(p));
  assert.equal(p.map.length,w*h);assert.ok(p.map.every(v=>v>=0&&v<p.regions.length));
  // A region cannot silently collect disconnected pixels after small-area merging.
  for(let id=0;id<p.regions.length;id++){
    const start=p.map.indexOf(id),seen=new Set([start]),queue=[start];
    while(queue.length){const i=queue.pop(),x=i%w;for(const j of [x?i-1:-1,x<w-1?i+1:-1,i-w,i+w])if(j>=0&&j<w*h&&p.map[j]===id&&!seen.has(j)){seen.add(j);queue.push(j);}}
    assert.equal(seen.size,p.regions[id].size);
  }
});
test('transparency is composited onto paper, without inventing black regions',()=>{
  const data=new Uint8ClampedArray(16*16*4),p=makePuzzle(data,16,16,{colors:12});
  assert.deepEqual(p.palette,[[255,255,255]]);assert.equal(p.regions.length,1);
});
test('backup validation rejects invalid geometry, out-of-range pixels and palettes',()=>{
  const p=makePuzzle(image(10,10,()=>[20,80,70]),10,10,{colors:8});assert.ok(validPuzzle(p));
  for(const broken of [{...p,map:[-1]},{...p,width:10000},{...p,palette:[[NaN,0,0]]},{...p,regions:[{...p.regions[0],paths:[[[NaN,0]]]}]}])assert.equal(validPuzzle(broken),false);
});
