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
test('diagonal borders become clean vector edges instead of pixel staircases',()=>{
  const p=makePuzzle(image(180,180,(x,y)=>x>y?[210,70,35]:[30,90,100]),180,180,{colors:8,minArea:4});
  assert.equal(p.regions.length,2);for(const r of p.regions)assert.ok(r.paths.flat().length<15,'straight diagonal must not retain hundreds of pixel corners');
});
test('backup validation rejects invalid geometry, out-of-range pixels and palettes',()=>{
  const p=makePuzzle(image(10,10,()=>[20,80,70]),10,10,{colors:8});assert.ok(validPuzzle(p));
  for(const broken of [{...p,map:[-1]},{...p,width:10000},{...p,palette:[[NaN,0,0]]},{...p,regions:[{...p.regions[0],paths:[[[NaN,0]]]}]}])assert.equal(validPuzzle(broken),false);
});

test('each shared border has exactly the same vertices in both region outlines',()=>{
  const p=makePuzzle(image(96,96,(x,y)=>x<y*.63+Math.sin(y/8)*4?[32,79,88]:x+y<107?[205,139,97]:[150,173,104]),96,96,{colors:8,minArea:4});
  const actual=new Map(),expected=new Map();
  const add=(map,a,b,owner)=>{const points=[a.join(','),b.join(',')].sort(),key=points.join('|');if(!map.has(key))map.set(key,[]);map.get(key).push(owner);};
  p.regions.forEach((r,id)=>r.paths.forEach(loop=>loop.forEach((a,i)=>add(actual,a,loop[(i+1)%loop.length],id))));
  for(const c of p.boundaries)for(let i=1;i<c.points.length;i++)for(const owner of [c.left,c.right])if(owner>=0)add(expected,c.points[i-1],c.points[i],owner);
  for(const owners of actual.values())owners.sort();for(const owners of expected.values())owners.sort();
  assert.deepEqual(actual,expected,'every rendered fill border reuses the one shared outline');
  for(const owners of actual.values())assert.ok(owners.length<=2,'no duplicate strokes or phantom slivers');
});

test('repairing saved paintings preserves region IDs, colors and progress, including tiny regions',async()=>{
  const {repairGeometry}=await import('../../public/color-studio/engine.js');
  const p=makePuzzle(image(24,24,(x,y)=>x===10&&y===10?[220,60,40]:[30,80,90]),24,24,{colors:8,minArea:1,smooth:false});
  const map=[...p.map],colors=p.regions.map(r=>r.color),filled=[0];delete p.geometryVersion;delete p.boundaries;
  p.regions.forEach(r=>{r.paths=[];delete r.labels;});repairGeometry(p);
  assert.deepEqual(p.map,map);assert.deepEqual(p.regions.map(r=>r.color),colors);assert.equal(p.geometryVersion,3);assert.deepEqual(filled,[0]);
  assert.ok(p.regions.every(r=>r.paths.length&&r.paths.every(loop=>loop.length>=3)));
  p.regions.forEach((r,id)=>r.labels.forEach(a=>assert.equal(p.map[Math.floor(a.y)*p.width+Math.floor(a.x)],id)));
});
