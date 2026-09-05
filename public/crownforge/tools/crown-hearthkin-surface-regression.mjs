import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {inflateSync} from 'node:zlib';
import {CHARACTER_RIGS} from '../src/character-rigs.js';
import {HearthkinRig,hearthkinPalmSocket} from '../src/hearthkin-rig.js';
import {HEARTHKIN_RIG_ART,HEARTHKIN_ARM_PARTS,HEARTHKIN_HAND_PARTS} from '../src/hearthkin-rig-art.js';
import {fitHearthkinProfile} from '../src/hearthkin-surface-fit.js';

const views=['front','right','back','left'];
const near=(a,b,label)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-7,label);
const cachedAlpha=new Map();
function sourceAlpha(art){
  if(cachedAlpha.has(art.src))return cachedAlpha.get(art.src);
  const png=fs.readFileSync(new URL('../'+art.src.split('?')[0],import.meta.url));
  assert.equal(png[24],8);assert.equal(png[25],6);assert.equal(png[28],0);
  const width=png.readUInt32BE(16),height=png.readUInt32BE(20),chunks=[];
  for(let i=8;i<png.length;){const n=png.readUInt32BE(i);if(png.toString('ascii',i+4,i+8)==='IDAT')chunks.push(png.subarray(i+8,i+8+n));i+=n+12;}
  const raw=inflateSync(Buffer.concat(chunks)),stride=width*4,pixels=new Uint8Array(stride*height);
  const paeth=(a,b,c)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c;};
  for(let y=0;y<height;y++)for(let x=0;x<stride;x++){
    const at=y*stride+x,left=x>=4?pixels[at-4]:0,up=y?pixels[at-stride]:0,corner=y&&x>=4?pixels[at-stride-4]:0;
    const prediction=[0,left,up,Math.floor((left+up)/2),paeth(left,up,corner)][raw[y*(stride+1)]];
    assert.notEqual(prediction,undefined);pixels[at]=(raw[y*(stride+1)+x+1]+prediction)&255;
  }
  const alpha=(x,y)=>pixels[(Math.floor(y)*width+Math.floor(x))*4+3]??0;
  cachedAlpha.set(art.src,alpha);return alpha;
}

function recordDraw(type,direction,phase=.25){
  let matrix=[1,0,0,1,0,0];const stack=[],draws=[];
  const ctx={globalAlpha:1,
    save(){stack.push([...matrix]);},restore(){matrix=stack.pop();},
    transform(a,b,c,d,e,f){const [aa,bb,cc,dd,ee,ff]=matrix;matrix=[aa*a+cc*b,bb*a+dd*b,aa*c+cc*d,bb*c+dd*d,aa*e+cc*f+ee,bb*e+dd*f+ff];},
    translate(x,y){this.transform(1,0,0,1,x,y);},scale(x,y){this.transform(x,0,0,y,0,0);},
    rotate(a){this.transform(Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0);},
    beginPath(){},rect(){},clip(){},closePath(){},moveTo(){},lineTo(){},fill(){},stroke(){},quadraticCurveTo(){},arc(){},ellipse(){},
    drawImage(image,x,y,width,height){draws.push({key:image.key,index:image.index,x,y,width,height,matrix:[...matrix]});},
  };
  const definition=CHARACTER_RIGS[type],art=definition.views?{...definition.views,props:HEARTHKIN_RIG_ART.props}:HEARTHKIN_RIG_ART;
  if(definition.mount)for(const [view,entry]of Object.entries(definition.mount.views))art['mount-'+view]=entry;
  const rig=Object.assign(Object.create(HearthkinRig.prototype),{definition,art,armParts:definition.arms??HEARTHKIN_ARM_PARTS,handFrames:definition.hands??HEARTHKIN_HAND_PARTS,part(key,index){return Array(4).fill({key,index});}});
  assert.ok(rig.draw(ctx,{type,id:5,animationState:'walk',facing:direction},{x:0,y:0},100,1,definition.actions.walk.duration*phase));
  return {draws,rig};
}
function recordedPoint(draw,normalised){
  const x=draw.x+normalised[0]*draw.width,y=draw.y+normalised[1]*draw.height,[a,b,c,d,e,f]=draw.matrix;
  return {x:a*x+c*y+e,y:b*x+d*y+f};
}
function paintedAlpha(draw,art,point){
  const [a,b,c,d,e,f]=draw.matrix,det=a*d-b*c,dx=point.x-e,dy=point.y-f;
  const x=(d*dx-c*dy)/det,y=(-b*dx+a*dy)/det,u=(x-draw.x)/draw.width,v=(y-draw.y)/draw.height;
  if(u<0||v<0||u>=1||v>=1)return 0;
  const rect=art.parts[draw.index];return sourceAlpha(art)(rect[0]+u*rect[2],rect[1]+v*rect[3]);
}

test('Crown cuff anchors land on opaque paint and crops retain linen while removing skin stubs',()=>{
  for(const view of views)for(const side of ['left','right'])for(const segment of ['upper','lower']){
    const part=HEARTHKIN_ARM_PARTS[view][side][segment],art=HEARTHKIN_RIG_ART[part.key],rect=art.parts[part.index],alpha=sourceAlpha(art);
    for(const [name,p]of Object.entries({root:part.root,tip:part.tip})){
      assert.ok(p.every(n=>n>0&&n<1),`${view}/${side}/${segment}/${name} belongs inside its cropped source`);
      assert.ok(alpha(rect[0]+p[0]*rect[2],rect[1]+p[1]*rect[3])>230,`${view}/${side}/${segment}/${name} belongs to real cloth/skin`);
    }
  }
  // Last connected linen fringe and detached distal skin were measured on
  // the original PNGs. Crop metadata must preserve the former and exclude
  // the latter; widening the crop to conceal a join would regress this.
  for(const[key,index,hem,stub]of [
    ['armSurfaces',0,[153,299],[204,306]],['armSurfaces',1,[515,301],[568,306]],
    ['armSurfaces',2,[1005,297],[962,306]],['armSurfaces',3,[1284,297],[1333,306]],
    ['right',4,[241,532],[267,547]],['right',5,[588,535],[617,548]],
    ['left',4,[253,545],[229,550]],['left',5,[605,542],[576,550]],
  ]){
    const art=HEARTHKIN_RIG_ART[key],r=art.parts[index],inside=([x,y])=>x>=r[0]&&x<r[0]+r[2]&&y>=r[1]&&y<r[1]+r[3];
    assert.ok(inside(hem),`${key}/${index} preserves the rolled linen hem`);
    assert.ok(sourceAlpha(art)(...hem)>230,`${key}/${index} measured hem is opaque`);
    assert.ok(!inside(stub),`${key}/${index} excess straight skin stub is outside the draw crop`);
  }
});

test('recorded Crown sleeve and forearm images join at the actual elbow in all four walking views',()=>{
  const definition=CHARACTER_RIGS.villager;
  for(let direction=0;direction<4;direction++)for(const phase of [0,.125,.25,.375,.5,.625,.75,.875]){
    const view=views[direction],{draws}=recordDraw('villager',direction,phase);
    const pose=fitHearthkinProfile(definition.samplePose('walk',definition.actions.walk.duration*phase,direction,{id:5,moving:true}));
    for(const side of ['left','right']){
      const parts=HEARTHKIN_ARM_PARTS[view][side];
      const find=part=>draws.find(d=>d.key===part.key&&d.index===part.index);
      const upper=find(parts.upper),lower=find(parts.lower),label=`${view}/${side}/${phase}`;
      assert.ok(upper&&lower,`${label} both original components are drawn`);
      assert.ok(draws.indexOf(lower)<draws.indexOf(upper),`${label} linen cuff covers the forearm insertion`);
      near(recordedPoint(upper,parts.upper.root),pose[side+'Shoulder'],`${label} painted shoulder`);
      near(recordedPoint(upper,parts.upper.tip),pose[side+'Elbow'],`${label} painted cuff opening`);
      near(recordedPoint(lower,parts.lower.root),pose[side+'Elbow'],`${label} painted forearm insertion`);
      near(recordedPoint(lower,parts.lower.tip),pose[side+'Hand'],`${label} painted wrist`);
      // Exercise actual transformed source alpha around the seam, not only
      // coincident mathematical endpoints. The bend must not reveal a hole.
      for(const dx of [-.5,0,.5])for(const dy of [-.5,0,.5]){
        const point={x:pose[side+'Elbow'].x+dx,y:pose[side+'Elbow'].y+dy};
        const alpha=Math.max(paintedAlpha(upper,HEARTHKIN_RIG_ART[upper.key],point),paintedAlpha(lower,HEARTHKIN_RIG_ART[lower.key],point));
        assert.ok(alpha>200,`${label} painted skin/cloth covers the elbow neighborhood`);
      }
    }
  }
});

test('Crown hand pivots use the painted wrist transition and lower crops stop at that joint',()=>{
  // These are source-image measurements, independent of the normalized
  // metadata and canvas transforms. The previous pivots were in a long
  // extra forearm stump, and the lower arm overran the new hand surface.
  for(const[view,side,wrist,cropHeight]of [
    ['front','left',[637.5,280],265],['front','right',[161,280],268],
    ['back','left',[1134,280],269],['back','right',[1610,280],272],
    ['right','left',[1865.5,200],206],['right','right',[754,200],211],
    ['left','left',[1387.5,200],196],['left','right',[275,200],198],
  ]){
    const hand=HEARTHKIN_HAND_PARTS[view][side],handArt=HEARTHKIN_RIG_ART[hand.key],hr=handArt.parts[hand.index];
    const actual=[hr[0]+hand.root[0]*hr[2],hr[1]+hand.root[1]*hr[3]],label=`${view}/${side}`;
    assert.ok(Math.hypot(actual[0]-wrist[0],actual[1]-wrist[1])<.001,`${label} hand pivot lands on the measured wrist transition`);
    assert.ok(sourceAlpha(handArt)(...actual)>230,`${label} wrist anchor has real skin paint`);
    const reach=Math.hypot((hand.grip[0]-hand.root[0])*hand.width,(hand.grip[1]-hand.root[1])*hand.height);
    assert.ok(Math.abs(reach-3.65)<1e-6,`${label} enlarged hand retains its physical palm grip`);
    // A hand extends about one third of a 16-unit forearm beyond its wrist.
    // This catches shrunken profiles and excessive enlargement separately
    // from the grip constraint, which alone can pass with a tiny palm.
    const distalHeight=(1-hand.root[1])*hand.height;
    assert.ok(distalHeight>4.6&&distalHeight<6,`${label} visible wrist-to-finger length stays proportional to the forearm`);
    const lower=HEARTHKIN_ARM_PARTS[view][side].lower,lr=HEARTHKIN_RIG_ART[lower.key].parts[lower.index];
    assert.equal(lr[3],cropHeight,`${label} retains the measured distal crop`);
    assert.ok((1-lower.tip[1])*lr[3]<=2,`${label} forearm cap extends at most two source pixels past its wrist`);
  }
});

function paintedSpan(draw,art,origin,across){
  let first=null,last=null;
  for(let offset=-8;offset<=8;offset+=.025){
    const point={x:origin.x+across.x*offset,y:origin.y+across.y*offset};
    if(paintedAlpha(draw,art,point)>200){first??=offset;last=offset;}
  }
  assert.notEqual(first,null,'the cross section contains opaque skin or bracer paint');
  return {first,last,width:last-first+.025};
}

test('actual rendered forearm and hand silhouettes meet at comparable widths through all four walk cycles',()=>{
  const definition=CHARACTER_RIGS.villager;
  for(let direction=0;direction<4;direction++)for(const phase of [0,.125,.25,.375,.5,.625,.75,.875]){
    const view=views[direction],{draws}=recordDraw('villager',direction,phase);
    const pose=fitHearthkinProfile(definition.samplePose('walk',definition.actions.walk.duration*phase,direction,{id:5,moving:true}));
    for(const side of ['left','right']){
      const part=HEARTHKIN_ARM_PARTS[view][side].lower,frame=HEARTHKIN_HAND_PARTS[view][side],label=`${view}/${side}/${phase}`;
      const lower=draws.find(d=>d.key===part.key&&d.index===part.index),hand=draws.find(d=>d.key===frame.key&&d.index===frame.index);
      assert.equal(lower.width,part.width??definition.dimensions?.forearm??5.4,`${label} renderer uses the calibrated forearm width`);
      near(recordedPoint(hand,frame.root),pose[side+'Hand'],`${label} actual painted hand meets its wrist`);
      near(recordedPoint(hand,frame.grip),hearthkinPalmSocket(pose,side==='left'),`${label} actual painted fingers retain the tool grip`);
      const wrist=pose[side+'Hand'],elbow=pose[side+'Elbow'],length=Math.hypot(wrist.x-elbow.x,wrist.y-elbow.y);
      const along={x:(wrist.x-elbow.x)/length,y:(wrist.y-elbow.y)/length},across={x:along.y,y:-along.x};
      // Sample immediately above the seam, avoiding the transparent outer
      // edge of a rotated crop while testing both painted components at
      // the same actual screen location and scale.
      const origin={x:wrist.x-along.x*.2,y:wrist.y-along.y*.2};
      const forearmSpan=paintedSpan(lower,HEARTHKIN_RIG_ART[lower.key],origin,across);
      const handSpan=paintedSpan(hand,HEARTHKIN_RIG_ART[hand.key],origin,across);
      assert.ok(Math.abs(forearmSpan.width-handSpan.width)/Math.max(forearmSpan.width,handSpan.width)<.2,`${label} painted wrist widths match within 20%, not the former nearly 2:1 step`);
      assert.ok(Math.max(Math.abs(forearmSpan.first-handSpan.first),Math.abs(forearmSpan.last-handSpan.last))<.45,`${label} wrist edges are centered on each other`);
      for(const down of [-.4,0,.4])for(const offset of [-.7,0,.7]){
        const point={x:wrist.x+along.x*down+across.x*offset,y:wrist.y+along.y*down+across.y*offset};
        assert.ok(Math.max(paintedAlpha(lower,HEARTHKIN_RIG_ART[lower.key],point),paintedAlpha(hand,HEARTHKIN_RIG_ART[hand.key],point))>200,`${label} opaque skin covers the joined wrist without a gap`);
      }
    }
  }
});

test('all eleven other characters retain their own upper-before-lower arm painter order',()=>{
  for(const[type,definition]of Object.entries(CHARACTER_RIGS)){
    if(type==='villager')continue;
    for(let direction=0;direction<4;direction++){
      const{draws}=recordDraw(type,direction),view=views[direction];
      for(const side of ['left','right']){
        const parts=definition.arms[view][side],upper=draws.findIndex(d=>d.key===parts.upper.key&&d.index===parts.upper.index),lower=draws.findIndex(d=>d.key===parts.lower.key&&d.index===parts.lower.index);
        assert.ok(upper>=0&&lower>upper,`${type}/${view}/${side} keeps its own previous arm stacking`);
      }
    }
  }
});

function insidePolygon(point,polygon){
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const [x,y]=polygon[i],[px,py]=polygon[j];
    if((y>point[1])!==(py>point[1])&&point[0]<(px-x)*(point[1]-y)/(py-y)+x)inside=!inside;
  }
  return inside;
}
function alphaComponents(art,rect,threshold){
  const [rx,ry,w,h]=rect,alpha=sourceAlpha(art),seen=new Uint8Array(w*h),components=[];
  for(let start=0;start<w*h;start++){
    if(seen[start])continue;
    const sx=start%w,sy=Math.floor(start/w);
    if(alpha(rx+sx,ry+sy)<=threshold)continue;
    const queue=[start],points=[];seen[start]=1;
    for(let n=0;n<queue.length;n++){
      const at=queue[n],x=at%w,y=Math.floor(at/w);points.push([rx+x,ry+y]);
      for(const[dx,dy]of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]){
        const xx=x+dx,yy=y+dy,next=yy*w+xx;
        if(xx<0||xx>=w||yy<0||yy>=h||seen[next]||alpha(rx+xx,ry+yy)<=threshold)continue;
        seen[next]=1;queue.push(next);
      }
    }
    components.push(points);
  }
  return components.sort((a,b)=>b.length-a.length);
}

test('right braid clip preserves every painted hair pixel and excludes the neighbouring arm cell',()=>{
  const art=HEARTHKIN_RIG_ART.right,rect=art.parts[3],polygon=art.sourceClips[3],alpha=sourceAlpha(art);
  assert.deepEqual(rect,[1216,12,102,352],'source crop and braid pivot/scale remain unchanged');
  const components=alphaComponents(art,rect,8),[braid,neighbour]=components;
  assert.equal(components.length,2,'the source region contains braid plus a separate neighbouring arm');
  // Eight-way connectivity includes three diagonal edge pixels beyond the
  // 14,806-pixel four-connected braid core measured during the art audit.
  assert.equal(braid.length,14809,'original significant braid pixels including diagonal hair fringe');
  assert.equal(neighbour.length,1377,'original unwanted arm pixels');
  const kept=point=>insidePolygon([point[0]+.5,point[1]+.5],polygon);
  assert.ok(braid.every(kept),'all significant hair remains inside the clip');
  assert.ok(neighbour.every(point=>!kept(point)),'all significant neighbouring skin is excluded');
  const [faintBraid,faintNeighbour]=alphaComponents(art,rect,4);
  assert.equal(faintBraid.length,15057,'fine hair with diagonal fringe included');
  assert.ok(faintBraid.every(kept),'fine translucent hair edge is preserved too');
  const residual=faintNeighbour.filter(kept);
  assert.ok(residual.length<=2&&residual.every(point=>alpha(...point)<=6),'only negligible source fringe may remain');
});

test('the real part cache applies the source clip before drawing every braid mip level',()=>{
  const previousDocument=globalThis.document,canvases=[];
  globalThis.document={createElement(tag){
    assert.equal(tag,'canvas');const events=[],points=[];
    const ctx={beginPath(){events.push('begin');},moveTo(x,y){points.push([x,y]);},lineTo(x,y){points.push([x,y]);},closePath(){events.push('close');},clip(){events.push('clip');},drawImage(...args){events.push('draw');canvas.drawArgs=args;}};
    const canvas={width:0,height:0,events,points,getContext(kind){assert.equal(kind,'2d');return ctx;}};canvases.push(canvas);return canvas;
  }};
  try{
    const art=HEARTHKIN_RIG_ART.right,image={complete:true,naturalWidth:art.width},rig=Object.assign(Object.create(HearthkinRig.prototype),{art:HEARTHKIN_RIG_ART,images:{right:image},parts:new Map()});
    const levels=rig.part('right',3),rect=art.parts[3],polygon=art.sourceClips[3];
    assert.equal(levels.length,4);assert.deepEqual(levels.map(c=>c.height),[256,128,64,32]);
    for(const canvas of levels){
      assert.deepEqual(canvas.events,['begin','close','clip','draw'],'clip must be active before image filtering/downsampling');
      const expected=polygon.map(([x,y])=>[(x-rect[0])*canvas.width/rect[2],(y-rect[1])*canvas.height/rect[3]]);
      assert.deepEqual(canvas.points,expected,'source polygon maps accurately at every mip size');
      assert.deepEqual(canvas.drawArgs,[image,...rect,0,0,canvas.width,canvas.height],'original source rectangle and display scale stay intact');
    }
    assert.equal(rig.part('right',3),levels,'the clipped levels are reused from the actual cache');
    assert.equal(canvases.length,4,'cache hit must not create an unclipped replacement');
    const other=rig.part('right',2);
    assert.ok(other.every(canvas=>canvas.events.length===1&&canvas.events[0]==='draw'),'unrelated body components are not clipped');
  }finally{
    if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
  }
});
