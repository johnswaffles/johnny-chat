import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validPuzzle} from '../../public/color-studio/engine.js';
import {labelPositions} from '../../public/color-studio/canvas.js';
import {catalog} from '../../public/color-studio/art.js';

const base=new URL('../../public/color-studio/puzzles/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',base),'utf8'));
test('all 18 gallery entries have original artwork, previews and audited canvases',async()=>{
  assert.equal(catalog.length,18);assert.equal(manifest.length,18);
  assert.equal(new Set(catalog.map(a=>a.id)).size,18);
  for(const art of catalog){
    assert.ok(art.source.endsWith('.webp'));assert.ok(art.preview.endsWith('-thumb.webp'));
    assert.ok(manifest.some(m=>m.id===art.id));
    for(const asset of [art.source,art.preview,art.puzzleSource])assert.ok((await readFile(new URL('../../public/color-studio/'+asset,import.meta.url))).length>100);
  }
});
function contains(region,x,y){
  let inside=false;
  for(const loop of region.paths)for(let i=0,j=loop.length-1;i<loop.length;j=i++){
    const a=loop[i],b=loop[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
for(const item of manifest)test(`gallery ${item.id}: connected spaces, shared outlines and every number reachable`,async()=>{
  const p=JSON.parse(await readFile(new URL('../../public/color-studio/'+catalog.find(a=>a.id===item.id).puzzleSource,import.meta.url),'utf8'));
  assert.ok(validPuzzle(p));assert.ok(p.palette.length>=24&&p.palette.length<=32);assert.ok(p.regions.length>=300&&p.regions.length<=1900);
  const sizes=new Uint32Array(p.regions.length),starts=new Int32Array(p.regions.length).fill(-1),seen=new Uint8Array(p.map.length),queue=new Int32Array(p.map.length);
  p.map.forEach((id,i)=>{sizes[id]++;starts[id]=i;});
  const actual=new Map(),expected=new Map();
  const edge=(map,a,b,id)=>{const key=[a.join(','),b.join(',')].sort().join('|');if(!map.has(key))map.set(key,[]);map.get(key).push(id);};
  const filled=new Set(p.regions.map((_,id)=>id));
  for(const [id,r] of p.regions.entries()){
    assert.equal(sizes[id],r.size);assert.ok(r.paths.length,`region ${id} must have an outline`);
    let head=0,tail=1;queue[0]=starts[id];seen[starts[id]]=1;
    while(head<tail){const i=queue[head++],x=i%p.width;for(const j of [x?i-1:-1,x<p.width-1?i+1:-1,i-p.width,i+p.width])if(j>=0&&j<p.map.length&&!seen[j]&&p.map[j]===id){seen[j]=1;queue[tail++]=j;}}
    assert.equal(tail,r.size,`region ${id} must be connected`);
    assert.ok(contains(r,r.x,r.y),`region ${id}: number must be inside its drawn outline`);
    for(const a of r.labels)assert.ok(contains(r,a.x,a.y),`region ${id}: viewport number anchor must be inside its outline`);
    for(const loop of r.paths)loop.forEach((a,i)=>edge(actual,a,loop[(i+1)%loop.length],id));
    filled.delete(id);
    const scale=Math.max(2,Math.min(40,32/Math.max(r.radius,1))),side=540/scale;
    const labels=labelPositions(p,filled,{selected:r.color,scale,viewport:{x:r.x-side/2,y:r.y-side/2,width:side,height:side}});
    assert.ok(labels.some(l=>l.id===id&&l.active&&l.size*scale>=8&&l.size*scale<=10.001),`region ${id}: final remaining space must have a small readable number at zoom`);
    filled.add(id);
  }
  for(const c of p.boundaries)for(let i=1;i<c.points.length;i++)for(const id of [c.left,c.right])if(id>=0)edge(expected,c.points[i-1],c.points[i],id);
  for(const owners of actual.values())owners.sort();for(const owners of expected.values())owners.sort();
  assert.deepEqual(actual,expected,'fills and shared outlines must use exactly the same border segments');
  for(let selected=0;selected<p.palette.length;selected++)assert.ok(p.regions.some(r=>r.color===selected),`color ${selected+1} needs actual spaces to shade`);
});
