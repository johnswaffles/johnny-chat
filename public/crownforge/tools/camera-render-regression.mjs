import assert from 'node:assert/strict';
import { CrownforgeRenderer } from '../src/renderer.js';
import { TerrainCache, TERRAIN_CACHE_LIMITS, terrainTileRange, terrainZoomLevel } from '../src/terrain-cache.js';
import { ForestCache, FOREST_CACHE_LIMITS } from '../src/forest-cache.js';
import { CrownforgeAtmosphere } from '../src/atmosphere.js';

const makeCanvas=()=>{
  const image={width:0,height:0};
  const ctx={draws:[],save(){},restore(){},setTransform(){},transform(){},translate(){},rotate(){},fillRect(){},
    createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),
    drawImage(...args){this.draws.push(args);},getImageData:()=>({data:new Uint8ClampedArray(4)}),
  };
  image.getContext=()=>ctx;return image;
};
globalThis.document={createElement:makeCanvas};

const r=Object.create(CrownforgeRenderer.prototype);
Object.assign(r,{width:800,height:600,resolutionScale:2,camera:{x:100,y:80,zoom:.4},roadReady:false,daylightEnabled:true,
  landscape:{revision:0,seed:42,materialRevision:1},atmosphere:{enabled:true,reducedMotion:false},canvas:{dataset:{}}});
let mapBakes=0;
r.drawMap=function(ctx){mapBakes++;ctx.marker=this.worldToScreen({x:211,z:173});};
const cache=new TerrainCache(r),originalCamera={...r.camera};
for(let i=0;i<100;i++){
  const before=cache.bakes;cache.prepare();
  assert(cache.bakes-before<=TERRAIN_CACHE_LIMITS.maxBakesPerFrame,'detail baking is bounded per frame');
}
assert.deepEqual(r.camera,originalCamera,'baking never moves the actual camera');
const warmed=cache.bakes;cache.prepare();assert.equal(cache.bakes,warmed);
for(let i=0;i<30;i++){r.camera.x+=.25;cache.prepare();}
assert.equal(cache.bakes,warmed,'subpixel pan reuses the same terrain tiles');
const ctx=makeCanvas().getContext();cache.draw(ctx);
const expected=r.worldToScreen({x:211,z:173});
for(const args of ctx.draws.filter(args=>args.length===9)){
  const [image,sx,sy,sw,sh,dx,dy,dw,dh]=args,marker=image.getContext().marker;
  const x=dx+(marker.x*r.resolutionScale-sx)/sw*dw,y=dy+(marker.y*r.resolutionScale-sy)/sh*dh;
  assert(Math.hypot(x-expected.x,y-expected.y)<1e-7,'terrain stays precisely attached to world coordinates across tile gutters');
}
for(let i=0;i<300;i++){
  r.camera.x=i*127;r.camera.y=i*43;r.camera.zoom=.05+(i%17)*.12;cache.prepare();
  assert(cache.bytes<=TERRAIN_CACHE_LIMITS.maxBytes&&cache.tiles.size<=TERRAIN_CACHE_LIMITS.maxTiles);
}
r.landscape.revision++;cache.prepare();assert(cache.tiles.size<=2,'changed ground cannot reuse stale tiles');
for(const zoom of [.035,.07,.28,1,2.4])assert(2**terrainZoomLevel(zoom)>=zoom);
const range=terrainTileRange(r,.5);assert(range.minX<=range.maxX&&range.minY<=range.maxY);

// Wheel easing converges without losing the cursor's world anchor.
r.camera={x:0,y:0,zoom:.28};const pointer={x:410,y:312},anchor=r.screenToWorld(pointer);
r.queueZoom(1.5,pointer);r.queueZoom(1.2,pointer);
assert.equal(r.camera.zoom,.28,'wheel targets do not jump before the next frame');
for(let i=0;i<90;i++)r.advanceCamera(1/60);
assert(Math.abs(r.camera.zoom-.28*1.5*1.2)<1e-7);
assert(Math.hypot(r.worldToScreen(anchor).x-pointer.x,r.worldToScreen(anchor).y-pointer.y)<1e-7);
r.queueZoom(1.2,pointer);r.panBy(2,0);assert.equal(r.zoomMotion,null,'dragging cancels pending zoom');
r.atmosphere.reducedMotion=true;const prior=r.camera.zoom;r.queueZoom(1.2,pointer);assert.equal(r.camera.zoom,prior*1.2);

// Distant bands retain exact root positions and never cross an occupied band.
r.resolutionScale=1;r.camera={x:0,y:0,zoom:.0625};
r.landscape={revision:1,resourceVisual:()=>({width:330,height:360,sprite:{root:[.69,.99]}}),
  drawResource(ctx,node,point,tier){ctx.roots??=[];ctx.roots.push({id:node.id,point,tier});}};
const trees=Array.from({length:80},(_,i)=>({id:i+1,type:'tree',resourceType:'wood',amount:240,sizeTier:'small',x:140+i*.8,z:160+i*.4}));
const entities=trees.map(resource=>({kind:'resource',resource,depth:resource.x+resource.z+.3}));
const scene={resourcesNodes:trees},forest=new ForestCache(r);
const unit={kind:'unit',id:1000,depth:entities[12].depth},grass={depth:entities[45].depth};
forest.prepare(scene,[...entities,unit],[grass]);
const unitBand=Math.floor(unit.depth/16),grassBand=Math.floor(grass.depth/16);
assert(forest.blocked.has(unitBand)&&forest.blocked.has(grassBand));
assert.equal(forest.draw(ctx,entities[12]),false);
assert.equal(forest.draw(ctx,entities[45]),false);
for(let i=0;i<20;i++){forest.prepare(scene,[...entities,unit],[grass]);for(const entity of entities)forest.draw(ctx,entity);}
assert(forest.layers.size>0&&forest.bytes<=FOREST_CACHE_LIMITS.maxBytes);
for(const layer of forest.layers.values()){
  for(const root of layer.image.getContext().roots){
    const node=trees.find(n=>n.id===root.id),expected=r.worldToScreen(node),scale=r.camera.zoom/forest.zoom;
    assert(Math.hypot(r.width/2+r.camera.x+(layer.x+root.point.x)*scale-expected.x,r.height/2+r.camera.y+(layer.y+root.point.y)*scale-expected.y)<1e-7);
  }
}
const oldBuilds=forest.builds;r.camera.x+=100;forest.prepare(scene,[...entities,unit],[grass]);
for(const entity of entities)forest.draw(ctx,entity);
assert.equal(forest.builds,oldBuilds,'pan reuses full-world depth strips');
trees[0].amount=0;r.landscape.revision++;forest.prepare(scene,entities.slice(1));
assert(![...forest.groups.values()].flat().includes(trees[0]),'felling removes the tree from cached groups');
entities[20].resource.selected=true;forest.prepare(scene,entities.slice(1));assert.equal(forest.draw(ctx,entities[20]),false,'selected tree remains in the ordinary painter');
r.camera.zoom=.5;forest.prepare(scene,entities);assert.equal(forest.active,false,'close-up trees retain full individual detail');

// New air layers are bounded, world anchored, and steady in reduced motion.
r.landscape={seed:42,forestCoverage:new Float32Array(560*460).fill(.8)};
const air=new CrownforgeAtmosphere(r);air.reducedMotion=true;
const a=makeCanvas().getContext(),b=makeCanvas().getContext();air.drawWoodlandAir(a,1000);air.drawWoodlandAir(b,9000);
assert(air.woodlandAnchors().length<=12);assert.deepEqual(a.draws,b.draws,'reduced motion stops fog drift');
air.enabled=false;const disabled=makeCanvas().getContext();air.drawWoodlandAir(disabled,1000);air.drawWoodlandLight(disabled,1000);assert.equal(disabled.draws.length,0);
console.log(JSON.stringify({test:'camera-render-regression',mapBakes,terrainBytes:cache.bytes,forestBytes:forest.bytes,rootChecks:trees.length,passed:true}));
