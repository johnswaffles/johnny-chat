import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { CrownforgeMeadow, MEADOW_SPRITES } from '../src/meadow.js';
import { CrownforgeRenderer } from '../src/renderer.js';
import { CONFIG, UNIT_TYPES } from '../src/config.js';

// Capture the actual Canvas transform applied to each painted rectangle.
// Inspecting the output geometry catches moving roots and gaps between bent
// sections even when every input coordinate is individually finite.
const identity = () => [1, 0, 0, 1, 0, 0];
const multiply = ([a,b,c,d,e,f], [g,h,i,j,k,l]) => [a*g+c*h,b*g+d*h,a*i+c*j,b*i+d*j,a*k+c*l+e,b*k+d*l+f];
const point = (m, x, y) => ({ x:m[0]*x+m[2]*y+m[4], y:m[1]*x+m[3]*y+m[5] });
const near = (a,b,label,tolerance=1e-7) => assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<tolerance, `${label}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);

function context() {
  let matrix=identity(), stack=[];
  const ctx={ draws:[], globalAlpha:1, globalCompositeOperation:'source-over',
    save(){stack.push({matrix:[...matrix],alpha:this.globalAlpha,composite:this.globalCompositeOperation});},
    restore(){const s=stack.pop();assert.ok(s,'balanced Canvas restore');matrix=s.matrix;this.globalAlpha=s.alpha;this.globalCompositeOperation=s.composite;},
    translate(x,y){this.transform(1,0,0,1,x,y);},
    transform(...m){assert.ok(m.every(Number.isFinite),'finite Canvas transform');matrix=multiply(matrix,m);},
    fillRect(){},
    drawImage(image,...args){
      assert.ok(args.every(Number.isFinite),'finite source and destination rectangle');
      assert.ok([4,8].includes(args.length),'expected cropped or complete image draw');
      const [x,y,width,height]=args.slice(-4);
      assert.ok(width>0&&height>0,'positive painted area');
      assert.ok(matrix[0]*matrix[3]-matrix[1]*matrix[2]>0,'plant never folds inside out');
      this.draws.push({image,args,matrix:[...matrix],x,y,width,height,alpha:this.globalAlpha});
    },
    get stackDepth(){return stack.length;},
  };
  return ctx;
}

const canvases=[];
globalThis.document={createElement(tag){assert.equal(tag,'canvas');const canvas={width:0,height:0,ctx:context(),getContext(){return this.ctx;}};canvases.push(canvas);return canvas;}};
globalThis.Image=class {listeners=new Map();addEventListener(type,fn){this.listeners.set(type,fn);}load(){this.listeners.get('load')?.();}};

const freeze = value => {if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const scene = units => ({activeWorldSeed:42,navigationVersion:0,buildings:[],resourcesNodes:[],decorations:[],units:units??[]});
function fixture({ready=true,zoom=.7}={}) {
  const renderer={width:1280,height:720,camera:{zoom},canvas:{dataset:{}},landscape:{forestCoverage:null},atmosphere:{enabled:true,reducedMotion:false},
    viewportBounds:{minX:12,minZ:12,maxX:42,maxZ:42},
    worldToScreen(t){return{x:400+(t.x-20)*this.camera.zoom,y:300+(t.z-20)*this.camera.zoom};},
  };
  const meadow=new CrownforgeMeadow(renderer);
  if(ready)meadow.image.load();
  return{meadow,renderer};
}

function sourcePixels() {
  const png=readFileSync(new URL('../assets/crownforge-meadow-grasses-v1.png',import.meta.url));
  assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.equal(png[24],8,'8-bit art');assert.equal(png[25],6,'true RGBA cutouts');assert.equal(png[28],0,'non-interlaced PNG');
  const width=png.readUInt32BE(16),height=png.readUInt32BE(20),chunks=[];
  for(let i=8;i<png.length;){const n=png.readUInt32BE(i);if(png.toString('ascii',i+4,i+8)==='IDAT')chunks.push(png.subarray(i+8,i+8+n));i+=n+12;}
  const raw=inflateSync(Buffer.concat(chunks)),stride=width*4,pixels=new Uint8Array(stride*height);
  const paeth=(a,b,c)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c;};
  for(let y=0;y<height;y++)for(let x=0;x<stride;x++){
    const at=y*stride+x,left=x>=4?pixels[at-4]:0,up=y?pixels[at-stride]:0,corner=y&&x>=4?pixels[at-stride-4]:0;
    const prediction=[0,left,up,Math.floor((left+up)/2),paeth(left,up,corner)][raw[y*(stride+1)]];
    assert.notEqual(prediction,undefined);pixels[at]=(raw[y*(stride+1)+x+1]+prediction)&255;
  }
  return {width,height,alpha:(x,y)=>pixels[(y*width+x)*4+3]};
}

test('measured atlas rectangles retain real blades and roots without neighboring cutouts',()=>{
  const art=sourcePixels(),covered=new Uint8Array(art.width*art.height);
  assert.equal(MEADOW_SPRITES.length,12);
  for(const [index,[x,y,w,h]] of MEADOW_SPRITES.entries()){
    assert.ok([x,y,w,h].every(Number.isInteger));assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=art.width&&y+h<=art.height,`sprite ${index} stays inside the actual PNG`);
    let paint=0,rootPaint=0,minY=h,maxY=-1;
    for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){
      const at=yy*art.width+xx;assert.equal(covered[at],0,`sprite ${index} overlaps another crop`);covered[at]=1;
      if(art.alpha(xx,yy)>32){paint++;minY=Math.min(minY,yy-y);maxY=Math.max(maxY,yy-y);if(yy>=y+h*.95)rootPaint++;}
    }
    assert.ok(paint>w*h*.1&&paint<w*h*.85,`sprite ${index} has substantial plant paint and transparent space`);
    assert.ok(minY<=h*.03&&maxY>=h*.97,`sprite ${index} tightly measures the actual top and root`);
    assert.ok(rootPaint>10,`sprite ${index} contains painted roots, not an empty bottom margin`);
  }
  let total=0,lost=0;
  for(let y=0;y<art.height;y++)for(let x=0;x<art.width;x++)if(art.alpha(x,y)>32){total++;if(!covered[y*art.width+x])lost++;}
  assert.ok(lost/total<.0001,'measurement cannot silently clip meaningful seed heads or blades');
});

test('loading prepares bounded reusable mips; frames do not resample the original atlas',()=>{
  const {meadow,renderer}=fixture({ready:false}),sim=freeze(scene());
  meadow.prepare(sim,1,.016);assert.equal(meadow.tufts.length,0);assert.equal(renderer.canvas.dataset.meadowReady,'false');
  const firstCanvas=canvases.length;meadow.image.load();
  assert.equal(meadow.sprites.length,12);
  let pixels=0;
  for(const [index,levels] of meadow.sprites.entries()){
    assert.ok(levels.length>=3&&levels.length<=5,'bounded levels per family');
    let previous=Infinity;
    for(const tile of levels){
      assert.ok(tile.width<previous&&tile.width>0&&tile.width<=128&&tile.height>0&&tile.height<=160);previous=tile.width;pixels+=tile.width*tile.height;
      assert.equal(tile.ctx.draws.length,1);const draw=tile.ctx.draws[0];assert.equal(draw.image,meadow.image);
      assert.deepEqual(draw.args.slice(0,4),MEADOW_SPRITES[index],'mip uses the measured source crop');
    }
  }
  assert.ok(pixels<400000,'decoded mip surfaces remain under 1.6 MB RGBA');
  const preparedCanvasCount=canvases.length-firstCanvas,ctx=context();
  for(const zoom of [.1,.25,.7,1.16]){
    renderer.camera.zoom=zoom;meadow.prepare(sim,2,.016);
    for(const tuft of meadow.tufts.slice(0,50))meadow.draw(ctx,tuft);
  }
  assert.ok(ctx.draws.length>0);assert.equal(canvases.length-firstCanvas,preparedCanvasCount,'normal frames allocate no sampling canvases');
  for(const draw of ctx.draws)assert.notEqual(draw.image,meadow.image,'world draws use prepared small surfaces');
  assert.equal(ctx.stackDepth,0);assert.equal(renderer.canvas.dataset.meadowReady,'true');
});

test('wind and compressed passage keep the painted root pinned and bent sections connected',()=>{
  const {meadow,renderer}=fixture();meadow.prepare(freeze(scene()),1,.016);
  for(const zoom of [CONFIG.minZoom,CONFIG.initialZoom,CONFIG.maxZoom])for(const variant of [0,4,8,11])for(const bend of [-1,-.2,0,.6,1])for(const press of [0,.03,.3,1]){
    renderer.camera.zoom=zoom;meadow.seconds=1.7;meadow.moving=true;meadow.field.displacement=()=>({bend,press});
    const tuft={x:20,z:20,width:42,height:variant===4?36:20,variant,phase:1.2,opacity:.8},ctx=context();
    meadow.draw(ctx,tuft);assert.ok(ctx.draws.length>0&&ctx.draws.length<=3,'at most three bands per disturbed tuft');
    const last=ctx.draws.at(-1),root=renderer.worldToScreen(tuft);
    near(point(last.matrix,0,last.y+last.height),root,'bottom painted plane stays at world root');
    near(point(last.matrix,-tuft.width*zoom/2,last.y+last.height),{x:root.x-tuft.width*zoom/2,y:root.y},'left root edge stays grounded');
    for(let i=1;i<ctx.draws.length;i++){
      const before=ctx.draws[i-1],after=ctx.draws[i];
      // Adjacent bands share the same source boundary; any added half-pixel
      // source overlap is deliberately excluded from this seam measurement.
      near(point(before.matrix,0,after.y),point(after.matrix,0,after.y),'bending cannot open a transverse crack');
    }
    const top=point(ctx.draws[0].matrix,0,ctx.draws[0].y);
    assert.ok(top.y<root.y&&root.y-top.y<=tuft.height*zoom+1e-7,'wind cannot inflate the height');
    assert.ok(ctx.draws.every(draw=>draw.alpha>0&&draw.alpha<=1));assert.equal(ctx.stackDepth,0);assert.equal(ctx.globalAlpha,1);
  }
});

test('reduced motion and atmosphere-off stop wind while retaining local foot contact',()=>{
  for(const disabled of ['reducedMotion','enabled','windEnabled']){
    const {meadow,renderer}=fixture();const sim=freeze(scene());
    if(disabled==='enabled')renderer.atmosphere.enabled=false;
    else if(disabled==='reducedMotion')renderer.atmosphere.reducedMotion=true;
    else meadow.windEnabled=false;
    const tuft={x:20,z:20,width:40,height:20,variant:1,phase:1,opacity:1};
    const captures=[];
    for(const seconds of [1,2.3,9]){meadow.prepare(sim,seconds,.016);const ctx=context();meadow.draw(ctx,tuft);captures.push(ctx.draws.map(d=>d.matrix));assert.equal(renderer.canvas.dataset.meadowWind,'false');}
    assert.deepEqual(captures[0],captures[1]);assert.deepEqual(captures[0],captures[2],'disabled wind has no time-dependent displacement');
    meadow.field.displacement=()=>({bend:.4,press:.6});const pressed=context();meadow.draw(pressed,tuft);
    assert.notDeepEqual(pressed.draws.map(d=>d.matrix),captures[0],'accessibility wind control does not remove character contact');
  }
  const {meadow}=fixture(),sim=freeze(scene()),tuft={x:20,z:20,width:40,height:20,variant:1,phase:1};
  const captures=[];for(const seconds of [1,2.3]){meadow.prepare(sim,seconds,.016);const ctx=context();meadow.draw(ctx,tuft);captures.push(ctx.draws[0].matrix);}
  assert.notDeepEqual(...captures,'enabled wind visibly changes the upper plant');
});

test('ordinary grass remains boot and lower-shin height at every zoom',()=>{
  const {meadow,renderer}=fixture();const sim=freeze(scene());meadow.prepare(sim,1,.016);
  assert.ok(meadow.tufts.length>30);const workerHeight=UNIT_TYPES.villager.renderSize;
  for(const tuft of meadow.tufts){
    const ordinary=tuft.variant<=3||tuft.variant===7;
    assert.ok(tuft.height/workerHeight<=(ordinary?.25:.4),'even seed heads stay below a worker torso');
    if(!ordinary)continue;
    for(const zoom of [CONFIG.minZoom,CONFIG.initialZoom,CONFIG.maxZoom]){
      renderer.camera.zoom=zoom;meadow.field.displacement=()=>({bend:0,press:0});const ctx=context();meadow.draw(ctx,tuft);
      const draw=ctx.draws[0],top=point(draw.matrix,0,draw.y),bottom=point(draw.matrix,0,draw.y+draw.height);
      assert.ok((bottom.y-top.y)/(workerHeight*zoom)<=.25+1e-8,'zoom changes plant and worker scale together');
    }
  }
});

test('prepare reads frozen gameplay state and observes actual movement without writing units',()=>{
  const {meadow}=fixture();let actorX=20;
  // Keep the units array identity: replacing that array denotes a loaded
  // world and correctly resets old tracks. Read-only coordinate getters let
  // the simulated owner advance positions while the renderer cannot write.
  const sim=freeze(scene([{id:1,type:'villager',get x(){return actorX;},z:20},{id:2,type:'scout',get x(){return actorX+4;},z:20}]));
  const first=JSON.stringify(sim);meadow.prepare(sim,1,.1);assert.equal(JSON.stringify(sim),first);
  actorX+=.4;const moved=JSON.stringify(sim);meadow.prepare(sim,1.1,.1);
  assert.ok(meadow.field.displacement({x:20.4,z:20},1.1).press>0,'observed worker passage reaches rendered interaction');
  assert.equal(JSON.stringify(sim),moved);
});

test('real entity painter merges grass before and after roots without hiding it behind a final unit pass',()=>{
  const events=[],renderer=Object.create(CrownforgeRenderer.prototype),ctx=context();
  Object.assign(renderer,{roadsideDetails:[],isWorldVisible:e=>!e.offscreen,entityCullRadius:()=>1,
    palisadeTowerConnectorEntities:()=>[],palisadeJunctionEntities:()=>[],
    meadow:{tufts:[{id:101,depth:19.7},{id:102,depth:21.7},{id:103,depth:24.7},{id:104,depth:24.8},{id:105,depth:40}],draw(c,t){assert.equal(c,ctx);events.push(`grass:${t.id}`);}},
  });
  for(const method of ['drawBuilding','drawResource','drawUnit','drawDecoration'])renderer[method]=(c,e)=>{assert.equal(c,ctx);events.push(`${e.kind}:${e.id}`);};
  const sim=freeze({
    buildings:[{id:3,kind:'building',type:'house',x:10,z:10},{id:1,kind:'building',type:'field',field:true,x:8,z:8}],
    resourcesNodes:[{id:4,kind:'resource',type:'tree',resourceType:'wood',amount:240,x:11,z:11},{id:2,kind:'resource',type:'grain',resourceType:'food',amount:40,x:8,z:8},{id:9,kind:'resource',type:'tree',resourceType:'wood',amount:0,x:15,z:15}],
    decorations:[],units:[{id:5,kind:'unit',type:'villager',x:12,z:12},{id:6,kind:'unit',type:'villager',x:14,z:14,dead:true,deathAge:3},{id:7,kind:'unit',type:'villager',x:15,z:15,offscreen:true}],getPalisadeJunctions:()=>[],
  });
  const before=JSON.stringify(sim);renderer.drawWorldEntities(ctx,sim,1000);
  assert.deepEqual(events,['building:1','resource:2','grass:101','building:3','grass:102','resource:4','grass:103','unit:5','grass:104','grass:105']);
  assert.equal(JSON.stringify(sim),before,'depth sorting never annotates or reorders gameplay objects');
  assert.equal(new Set(events).size,events.length,'every visible tuft is painted exactly once');
});
