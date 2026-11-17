import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validPuzzle,repairGeometry,flattenCommands} from '../../public/color-studio/engine.js';
import {upgradePainting} from '../../public/color-studio/experience.js';
const p=JSON.parse(await readFile(new URL('../../public/color-studio/puzzles/alpine-retreat-v5.json',import.meta.url),'utf8'));

test('alpine cleanup retains 32 colors with no needle-thin regions or same-color dividers',()=>{
  assert.ok(validPuzzle(p));assert.equal(p.geometryVersion,4);assert.equal(p.palette.length,32);assert.equal(p.regions.length,728);
  assert.ok(p.regions.every(r=>r.radius>=2||r.detail));
  assert.ok(p.boundaries.every(c=>c.left<0||c.right<0||p.regions[c.left].color!==p.regions[c.right].color));
  assert.ok(p.boundaries.some(c=>c.commands.some(s=>s[0]==='Q')));
});

test('curved contours form a watertight partition with no overlapping or missing strips',()=>{
  for(let y=.173;y<p.height;y+=1.73){
    const spans=[];
    for(const r of p.regions){
      const xs=[];for(const commands of r.curves){const loop=flattenCommands(commands);for(let i=0,j=loop.length-1;i<loop.length;j=i++){
        const a=loop[i],b=loop[j];if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]));
      }}
      xs.sort((a,b)=>a-b);assert.equal(xs.length%2,0);for(let i=0;i<xs.length;i+=2)if(xs[i+1]-xs[i]>1e-8)spans.push([xs[i],xs[i+1]]);
    }
    spans.sort((a,b)=>a[0]-b[0]);let edge=0;
    for(const [left,right] of spans){assert.ok(Math.abs(left-edge)<1e-7,`overlap/gap at y=${y}: ${edge} to ${left}`);edge=right;}
    assert.ok(Math.abs(edge-p.width)<1e-7);
  }
});

test('repairing or restoring the curved canvas retains curves and the region map',()=>{
  const copy=structuredClone(p);repairGeometry(copy);assert.equal(copy.geometryVersion,4);assert.deepEqual(copy.map,p.map);assert.deepEqual(copy.boundaries,p.boundaries);
  const broken=structuredClone(p);broken.regions[0].curves[0][1]=['Q',NaN,0,1,2];assert.equal(validPuzzle(broken),false);
});

test('saved progress upgrades by area, keeping the original record intact and recoverable',()=>{
  const old={id:'alpine-retreat-v2',edition:3,puzzle:{width:4,height:1,map:[0,1,2,3],palette:[[0,0,0],[255,255,255]]},selected:1,filled:[0,1]};
  const newer={width:4,height:1,map:[0,0,1,1],regions:[{},{}],palette:[[255,255,255],[0,0,0]]};
  const upgraded=upgradePainting(old,newer,4);assert.deepEqual(upgraded.filled,[0]);assert.equal(upgraded.selected,0);assert.equal(upgraded.previousEditionId,'alpine-retreat-v2-archive-3');assert.deepEqual(old.filled,[0,1]);assert.equal(old.edition,3);
  assert.deepEqual(upgradePainting({...old,filled:[0,1,2,3]},newer,4).filled,[0,1]);
  assert.deepEqual(upgradePainting({...old,filled:[]},newer,4).filled,[]);
});

test('the alpine color-three hint stays in the visible scene instead of zooming to a sliver',async()=>{
  const {findHint}=await import('../../public/color-studio/experience.js'),scale=(526-12)/600*2.25;
  const viewport={x:300-1280/scale/2,y:300-526/scale/2,width:1280/scale,height:526/scale,scale};
  const target=findHint(p,new Set(),2,viewport);assert.equal(target.keepView,true);assert.equal(p.regions[target.id].color,2);assert.ok(target.anchor.radius*scale>=10);
});
