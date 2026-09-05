import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {inflateSync} from 'node:zlib';
import {mountedPose,mountedActions} from '../src/mounted-motion.js';
import {horseAssemblyTransforms,horseAssemblyPoint,HORSE_ASSEMBLY_LANDMARKS} from '../src/horse-assembly.js';
import scout from '../src/roster-art/crown-scout.js';
import outrider from '../src/roster-art/ashen-outrider.js';

const mounts={scout,ashenOutrider:outrider},views=['front','right','back','left'];
const near=(a,b,label)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-7,label);
const normalise=(point,rect)=>[(point[0]-rect[0])/rect[2],(point[1]-rect[1])/rect[3]];

// Read source alpha instead of treating a cutout bounding rectangle as
// proof of a painted attachment. An earlier Ash neck landmark was inside
// the crop but outside its diagonal silhouette.
function sourceAlpha(art) {
  const png=fs.readFileSync(new URL('../'+art.src.split('?')[0],import.meta.url));
  assert.equal(png[24],8);assert.equal(png[25],6);assert.equal(png[28],0);
  const width=png.readUInt32BE(16),height=png.readUInt32BE(20),chunks=[];
  for(let i=8;i<png.length;){const length=png.readUInt32BE(i);if(png.toString('ascii',i+4,i+8)==='IDAT')chunks.push(png.subarray(i+8,i+8+length));i+=12+length;}
  const bytes=inflateSync(Buffer.concat(chunks)),stride=width*4,pixels=new Uint8Array(stride*height);
  const paeth=(a,b,c)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c;};
  for(let y=0;y<height;y++){
    const row=y*stride,source=y*(stride+1),filter=bytes[source];
    for(let x=0;x<stride;x++){
      const left=x>=4?pixels[row+x-4]:0,up=y?pixels[row+x-stride]:0,corner=x>=4&&y?pixels[row+x-stride-4]:0;
      const prediction=[0,left,up,Math.floor((left+up)/2),paeth(left,up,corner)][filter];
      assert.notEqual(prediction,undefined);
      pixels[row+x]=(bytes[source+x+1]+prediction)&255;
    }
  }
  return (x,y)=>pixels[(y*width+x)*4+3];
}

test('measured head, neck and mane source landmarks belong to their own cutouts',()=>{
  const parts={poll:0,muzzle:0,headJoin:0,neckBase:1,neckJoin:1,maneBase:18,maneJoin:18,neckDorsalBase:1,headManeJoin:0};
  for(const [type,mount] of Object.entries(mounts))for(const view of views){
    const art=mount.mount.views[view],measure=HORSE_ASSEMBLY_LANDMARKS[type][view],alpha=sourceAlpha(art);
    for(const [key,index] of Object.entries(parts)){
      if(!measure[key]){
        if(key==='muzzle')assert.equal(view,'back');
        else {assert.ok(['neckDorsalBase','headManeJoin'].includes(key));assert.ok(['front','back'].includes(view));}
        continue;
      }
      const [x,y]=measure[key],[rx,ry,w,h]=art.parts[index];
      assert.ok(x>rx&&y>ry&&x<rx+w&&y<ry+h,`${type}/${view}/${key} is in its own painted part`);
      assert.ok(alpha(x,y)>200,`${type}/${view}/${key} must land on painted skin/hair, not merely inside its crop`);
    }
  }
});

test('painted head socket and neck top meet in all actions and four directions',()=>{
  for(const [type,mount]of Object.entries(mounts))for(const [state,action]of Object.entries(mountedActions(type)))for(let direction=0;direction<4;direction++)for(let sample=0;sample<=80;sample++){
    const pose=mountedPose(type,state,action.duration*sample/80,direction),art=mount.mount.views[views[direction]],t=horseAssemblyTransforms(pose,art,type);
    const label=`${type}/${state}/${direction}/${sample}`;
    near(horseAssemblyPoint(t[0],t[0].root),pose.mount.projected.poll,`${label} poll`);
    near(horseAssemblyPoint(t[0],t[0].sourceJoin),horseAssemblyPoint(t[1],t[1].sourceJoin),`${label} painted neck/skull seam`);
    near(horseAssemblyPoint(t[1],t[1].root),pose.mount.projected.neckRoot,`${label} chest attachment`);
    const measure=HORSE_ASSEMBLY_LANDMARKS[type][views[direction]];
    const crestBase=pose.sideView?horseAssemblyPoint(t[1],normalise(measure.neckDorsalBase,art.parts[1])):pose.mount.projected.neckRoot;
    const crestTop=pose.sideView?horseAssemblyPoint(t[0],normalise(measure.headManeJoin,art.parts[0])):t[0].targetJoin;
    near(horseAssemblyPoint(t[18],t[18].root),crestBase,`${label} mane grows from painted neck crest`);
    near(horseAssemblyPoint(t[18],t[18].sourceJoin),crestTop,`${label} mane joins the painted hair behind the skull`);
    for(const transform of Object.values(t)){
      assert.ok([transform.width,transform.height,transform.angle,transform.origin.x,transform.origin.y].every(Number.isFinite),`${label} finite assembly`);
      assert.ok(transform.width>0&&transform.height>0,`${label} nondegenerate assembly`);
    }
  }
});

test('mane endpoints move continuously and loop without separating from the crest',()=>{
  for(const[type,mount]of Object.entries(mounts))for(const[state,action]of Object.entries(mountedActions(type)))for(let direction=0;direction<4;direction++){
    const art=mount.mount.views[views[direction]],pointsAt=time=>{
      const t=horseAssemblyTransforms(mountedPose(type,state,time,direction),art,type)[18];
      return [horseAssemblyPoint(t,t.root),horseAssemblyPoint(t,t.sourceJoin)];
    };
    let previous=pointsAt(0);
    for(let sample=1;sample<=600;sample++){
      const current=pointsAt(action.duration*sample/600);
      for(let end=0;end<2;end++)assert.ok(Math.hypot(current[end].x-previous[end].x,current[end].y-previous[end].y)<2,`${type}/${state}/${direction} crest cannot jump during motion`);
      previous=current;
    }
    if(action.loop){const start=pointsAt(0),end=pointsAt(action.duration);for(let i=0;i<2;i++)near(start[i],end[i],`${type}/${state}/${direction} mane loop seam`);}
  }
});

test('resting and walking tails hang from the upper rump toward the hocks',()=>{
  for(const type of Object.keys(mounts))for(const state of ['idle','walk']){
    const action=mountedActions(type)[state];
    for(let sample=0;sample<=120;sample++){
      const pose=mountedPose(type,state,action.duration*sample/120,1),m=pose.mount,h=m.anatomical,frame=m.bodyFrame;
      const localDifference=(a,b)=>{const d={x:a.x-b.x,y:a.y-b.y,z:a.z-b.z};return Object.fromEntries(['right','up','forward'].map(key=>[key,d.x*frame[key].x+d.y*frame[key].y+d.z*frame[key].z]));};
      const tail=localDifference(h.tailTip,h.tailRoot),dock=localDifference(h.tailRoot,h.barrel),drop=-tail.up;
      assert.ok(dock.up>0&&dock.forward<0&&Math.abs(dock.forward)<31*m.scale,`${type} tail dock belongs to the upper rump silhouette`);
      assert.ok(drop>25*m.scale,`${type} hanging tail must reach down toward the hocks`);
      assert.ok(Math.abs(tail.forward)<drop*.25,`${type} tail must not stick backward like a horizontal appendage`);
      assert.ok(Math.abs(tail.right)<drop*.15,`${type} walking tail sway remains modest`);
      assert.ok(h.tailTip.y>2*m.scale&&h.tailTip.y<h.barrel.y*.55,`${type} tail tip remains below the barrel and above the ground`);
    }
  }
});

test('rear skull retains real transverse volume instead of collapsing onto the muzzle projection',()=>{
  for(const[type,mount]of Object.entries(mounts)){
    const front=horseAssemblyTransforms(mountedPose(type,'idle',0,0),mount.mount.views.front,type)[0];
    const back=horseAssemblyTransforms(mountedPose(type,'idle',0,2),mount.mount.views.back,type)[0];
    assert.ok(back.width>11&&back.height>30,`${type} rear skull has visible volume`);
    assert.ok(back.width/front.width>.75&&back.width/front.width<1.25,`${type} consistent front/back skull width`);
    assert.ok(Math.abs(front.height-back.height)<1e-8,`${type} skull length cannot change with camera`);
    for(const[view,direction]of views.map((v,i)=>[v,i])){
      const art=mount.mount.views[view],idle=horseAssemblyTransforms(mountedPose(type,'idle',0,direction),art,type)[0];
      for(const[state,action]of Object.entries(mountedActions(type)))for(let i=0;i<=40;i++){
        const head=horseAssemblyTransforms(mountedPose(type,state,action.duration*i/40,direction),art,type)[0];
        assert.ok(Math.abs(head.width-idle.width)<1e-8&&Math.abs(head.height-idle.height)<1e-8,`${type}/${view}/${state} rigid skull does not squash while nodding/falling`);
      }
    }
  }
});
