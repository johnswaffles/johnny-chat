import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {inflateSync} from 'node:zlib';
import {CHARACTER_RIGS} from '../src/character-rigs.js';
import {CHARACTER_SURFACE_CALIBRATIONS,calibrateCharacterSurfaces} from '../src/character-surface-calibration.js';
import {fitCharacterSurfaces} from '../src/character-surface-fit.js';
import {fitHearthkinProfile} from '../src/hearthkin-surface-fit.js';
import {HearthkinRig,hearthkinHandTransform} from '../src/hearthkin-rig.js';
import {HEARTHKIN_RIG_ART,HEARTHKIN_ARM_PARTS,HEARTHKIN_HAND_PARTS} from '../src/hearthkin-rig-art.js';
import {projectHearthkin} from '../src/hearthkin-locomotion.js';
import ashenForager from '../src/roster-art/ashen-hearthkin.js';
import soldier from '../src/roster-art/crown-guard.js';
import militia from '../src/roster-art/crown-militia.js';
import spearwarden from '../src/roster-art/crown-spearwarden.js';
import shieldbearer from '../src/roster-art/crown-shieldbearer.js';
import scout from '../src/roster-art/crown-scout.js';
import ashenOutrider from '../src/roster-art/ashen-outrider.js';
import raider from '../src/roster-art/ashen-raider.js';
import thornSpear from '../src/roster-art/thorn-spear.js';
import hearthLevy from '../src/roster-art/hearth-levy.js';
import hidewall from '../src/roster-art/ashen-hidewall.js';

const originals={ashenForager,soldier,militia,spearwarden,shieldbearer,scout,ashenOutrider,raider,thornSpear,hearthLevy,hidewall};
const views=['front','right','back','left'],sides=['left','right'],phases=[0,.125,.25,.375,.5,.625,.75,.875,.95];
const absolute=(p,r)=>[r[0]+p[0]*r[2],r[1]+p[1]*r[3]];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z??0)-(b.z??0));
const near=(a,b,label,tolerance=1e-6)=>assert.ok(distance(a,b)<tolerance,`${label}: ${distance(a,b)}`);
const close=(a,b,label,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${label}: ${a} vs ${b}`);
const alphaCache=new Map();

// Decode original PNG pixels independently of the renderer. This deliberately
// does not import another test module or trust successful bone attachment as
// evidence that the source contains actual opaque paint at the attachment.
function sourceAlpha(art){
  if(alphaCache.has(art.src))return alphaCache.get(art.src);
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
  const alpha=(x,y)=>x<0||y<0||x>=width||y>=height?0:pixels[(Math.floor(y)*width+Math.floor(x))*4+3];
  alphaCache.set(art.src,alpha);return alpha;
}

function* samples(){
  for(const id of Object.keys(originals)){
    const d=CHARACTER_RIGS[id];
    for(const[state,action]of Object.entries(d.actions))for(let direction=0;direction<4;direction++)for(const phase of phases){
      const pose=d.samplePose(state,action.duration*phase,direction,{id:5,moving:state==='walk'||state.startsWith('carry_')});
      yield {id,d,state,direction,phase,pose,label:`${id}/${state}/${views[direction]}/${phase}`};
    }
  }
}

function paintedSocket(pose,definition){
  const view=views[pose.direction],anchor=definition.surfaceCalibration.profileSockets[view];
  if(!anchor||!pose.bodyFrame)return null;
  const[u,v]=anchor,width=definition.dimensions?.torsoSide??20,sign=pose.direction===1?1:-1,f=pose.bodyFrame;
  const point={...pose.anatomical.neck};
  for(const axis of['x','y','z'])point[axis]+=f.forward[axis]*(u-.5)*width*sign+f.up[axis]*(1-v*31);
  return projectHearthkin(point,pose.direction);
}

// A single visual accommodation is allowed: a falling rider's near palm
// may be beyond reach from its exact painted socket. Its nearest reachable
// screen-plane target preserves depth. Every living target remains fixed.
function deathTarget(pose,definition,side){
  if(pose.state!=='death'||!pose.mount||!pose.sideView||side!==(pose.direction===1?'right':'left'))return null;
  const socket=paintedSocket(pose,definition),palm=projectHearthkin(pose.anatomical[side+'Palm'],pose.direction);
  const dx=palm.x-socket.x,dy=palm.y-socket.y,span=Math.hypot(dx,dy),reach=33+definition.hands[views[pose.direction]][side].palmLength-.002;
  if(span<=reach)return null;
  return {socket,palm:{x:socket.x+dx*reach/span,y:socket.y+dy*reach/span,depth:palm.depth},displacement:span-reach};
}

function checkHeldContacts(pose,fit,changed,label){
  for(const name of['toolFrame','shieldFrame']){
    const frame=pose[name],side=frame?.hand??(name==='toolFrame'?(pose.toolHand??'right'):'left');
    const follows=frame&&!frame.detached&&frame.attachment!=='back'&&changed.includes(side);
    assert.deepEqual(fit[name],follows?{...frame,grip:fit.anatomical[side+'Palm']}:frame,label+' preserves '+name+' except the held adjusted grip');
  }
  assert.equal(fit.droppedToolFrame,pose.droppedToolFrame,label+' dropped weapon remains independent');
  const reins=pose.reins,side=reins?.hand??'left';
  if(reins&&!reins.released&&changed.includes(side)){
    assert.deepEqual(Object.keys(fit.reins).sort(),Object.keys(reins).sort(),label+' rein fields unchanged');
    for(const key of Object.keys(reins).filter(key=>!['left','right'].includes(key)))assert.deepEqual(fit.reins[key],reins[key],label+' rein metadata unchanged');
    for(const edge of['left','right']){
      const[oldHand,oldControl,bit]=reins[edge],[hand,control,newBit]=fit.reins[edge];
      near(hand,fit.anatomical[side+'Palm'],label+'/'+edge+' held rein meets fitted palm');
      assert.equal(newBit,bit,label+'/'+edge+' horse bit is untouched');
      for(const axis of['x','y','z']){
        const oldSag=oldControl[axis]-(oldHand[axis]*.45+bit[axis]*.55);
        const newSag=control[axis]-(hand[axis]*.45+bit[axis]*.55);
        close(newSag,oldSag,label+'/'+edge+' retains rein sag '+axis);
      }
    }
  }else assert.equal(fit.reins,reins,label+' unrevised or released reins are untouched');
}

test('all eleven identities own isolated surfaces and preserve the original measured source grips',()=>{
  assert.deepEqual(Object.keys(CHARACTER_SURFACE_CALIBRATIONS).sort(),Object.keys(originals).sort());
  for(const[id,original]of Object.entries(originals)){
    const before=JSON.stringify(original),d=CHARACTER_RIGS[id],fresh=calibrateCharacterSurfaces({...original,id});
    assert.equal(JSON.stringify(original),before,`${id} calibration does not mutate exported original metadata`);
    assert.notEqual(d.views,original.views);assert.notEqual(d.arms,original.arms);assert.notEqual(d.hands,original.hands);
    assert.notEqual(fresh.views,d.views);assert.notEqual(fresh.hands,d.hands);
    for(const view of views)for(const side of sides){
      const old=original.hands[view][side],hand=d.hands[view][side],oldRect=original.views[old.key].parts[old.index],rect=d.views[hand.key].parts[hand.index];
      const grip=absolute(hand.grip,rect),oldGrip=absolute(old.grip,oldRect),root=absolute(hand.root,rect),label=`${id}/${view}/${side}`;
      close(grip[0],oldGrip[0],label+' unchanged original grip x');close(grip[1],oldGrip[1],label+' unchanged original grip y');
      assert.ok(sourceAlpha(d.views[hand.key])(...root)>200,label+' wrist lies on original opaque hand paint');
      assert.equal(hand.clipAtWrist,true);assert.equal(d.arms[view][side].lower.clipAtWrist,true);
      assert.ok(hand.width>=4.5&&hand.width<=9,label+' character-specific hand breadth is plausible');
      assert.ok(hand.palmLength>=3.5&&hand.palmLength<=5,label+' character-specific palm reach is plausible');
      for(const segment of ['upper','lower']){
        const part=d.arms[view][side][segment],art=d.views[part.key],r=art.parts[part.index];
        for(const[anchor,p]of Object.entries({root:part.root,tip:part.tip})){
          assert.ok(p.every(n=>n>0&&n<1),`${label}/${segment}/${anchor} stays inside its source crop`);
          assert.ok(sourceAlpha(art)(...absolute(p,r))>200,`${label}/${segment}/${anchor} lies on actual painted anatomy`);
        }
      }
    }
    // Modifying a second calibrated instance must not cross character/instance
    // boundaries even when identities share the same profile PNG atlas.
    fresh.hands.front.left.root[0]+=100;
    assert.equal(JSON.stringify(original),before,`${id} clone mutation stays isolated`);
    assert.notEqual(fresh.hands.front.left.root[0],d.hands.front.left.root[0]);
  }
});

test('all actions preserve bone lengths and fixed contacts, with only minimal unreachable falling-rider target adjustment',()=>{
  let count=0,adjusted=0,heldReins=0,releasedReins=0,heldShields=0,droppedWeapons=0;
  for(const{id,d,pose,label}of samples()){
    const before=JSON.stringify(pose),fit=fitCharacterSurfaces(pose,d);
    assert.equal(JSON.stringify(pose),before,label+' fitting does not mutate the canonical pose');
    const changed=[];
    for(const side of sides){
      const j=fit.anatomical;
      close(distance(j[side+'Shoulder'],j[side+'Elbow']),17,label+'/'+side+' upper arm',1e-5);
      close(distance(j[side+'Elbow'],j[side+'Hand']),16,label+'/'+side+' forearm',1e-5);
      close(distance(j[side+'Hand'],j[side+'Palm']),d.hands[views[pose.direction]][side].palmLength,label+'/'+side+' palm reach',1e-5);
      const permitted=deathTarget(pose,d,side);
      if(permitted){
        changed.push(side);adjusted++;
        const palm=projectHearthkin(j[side+'Palm'],pose.direction),shoulder=projectHearthkin(j[side+'Shoulder'],pose.direction);
        near({x:shoulder.x,y:shoulder.y},{x:permitted.socket.x,y:permitted.socket.y},label+'/'+side+' falling rider keeps exact painted shoulder',1e-5);
        near({x:palm.x,y:palm.y},{x:permitted.palm.x,y:permitted.palm.y},label+'/'+side+' closest reachable palm target',1e-5);
        close(palm.depth,permitted.palm.depth,label+'/'+side+' adjusted palm preserves camera depth',1e-5);
        close(distance(j[side+'Palm'],pose.anatomical[side+'Palm']),permitted.displacement,label+'/'+side+' adjustment is minimal',1e-5);
      }else if(pose.projectedWork)near(j[side+'Palm'],pose.anatomical[side+'Palm'],label+'/'+side+' physical palm');
    }
    assert.deepEqual(fit.surfaceDeathGripAdjusted??[],changed,label+' exception is present only when mathematically necessary');
    if(changed.length){
      if(pose.reins?.released)releasedReins++;else if(pose.reins)heldReins++;
      if(pose.shieldFrame&&changed.includes(pose.shieldFrame.hand))heldShields++;
      if(pose.droppedToolFrame)droppedWeapons++;
    }
    for(const key of ['mount','bodyFrame'])assert.deepEqual(fit[key],pose[key],label+' preserves '+key);
    if(pose.projectedWork)checkHeldContacts(pose,fit,changed,label);
    else if(fit.toolFrame)near(fit.toolFrame.grip,fit.anatomical.rightPalm,label+' free carried tool follows fitted right palm');
    if(id==='scout'||id==='ashenOutrider')assert.equal(fit.mount,pose.mount,label+' horse geometry is untouched');
    count++;
  }
  assert.ok(count>2000,`full roster coverage: ${count} fitted poses`);
  assert.ok(adjusted>0,'the suite exercises the specific unreachable falling-rider exception');
  assert.ok(heldReins>0&&releasedReins>0&&heldShields>0&&droppedWeapons>0,'adjusted death samples exercise held and released equipment boundaries');
});

function handPoint(transform,wrist,p){
  const x=(p[0]-transform.frame.root[0])*transform.width,y=(p[1]-transform.frame.root[1])*transform.height;
  const[a,b,c,d]=transform.matrix;return {x:wrist.x+a*x+c*y,y:wrist.y+b*x+d*y};
}
function handAlpha(transform,wrist,art,point){
  const[a,b,c,d]=transform.matrix,det=a*d-b*c,dx=point.x-wrist.x,dy=point.y-wrist.y;
  const x=(d*dx-c*dy)/det,y=(-b*dx+a*dy)/det,u=x/transform.width+transform.frame.root[0],v=y/transform.height+transform.frame.root[1];
  if(u<0||u>=1||v<0||v>=1)return 0;
  return sourceAlpha(art)(...absolute([u,v],art.parts[transform.frame.index]));
}
function span(sample){
  let first=null,last=null;
  for(let x=-10;x<=10;x+=.025)if(sample(x)>200){first??=x;last=x;}
  return {first,last,width:first===null?0:last-first+.025};
}

test('affine hand surfaces retain real painted wrist breadth while both original anchors stay exact',()=>{
  const widths=new Map();
  for(const{d,pose,label,direction}of samples()){
    const fit=fitCharacterSurfaces(pose,d),view=views[direction];
    for(const side of sides){
      const t=hearthkinHandTransform(fit,side==='left'),wrist=fit[side+'Hand'],elbow=fit[side+'Elbow'];
      assert.ok(t.matrix?.every(Number.isFinite),label+'/'+side+' has a finite affine surface');
      near(handPoint(t,wrist,t.frame.root),wrist,label+'/'+side+' original wrist maps to actual wrist');
      near(handPoint(t,wrist,t.frame.grip),fit[side+'Palm'],label+'/'+side+' original grip maps to actual palm');
      close(Math.hypot(t.matrix[0],t.matrix[1]),1,label+'/'+side+' transverse surface axis retains its breadth');
      close(t.width,d.hands[view][side].width,label+'/'+side+' no short-projection hand shrink');
      const n=Math.hypot(wrist.x-elbow.x,wrist.y-elbow.y),across={x:(wrist.y-elbow.y)/n,y:-(wrist.x-elbow.x)/n};
      const width=span(x=>handAlpha(t,wrist,d.views[t.frame.key],{x:wrist.x+across.x*x,y:wrist.y+across.y*x})).width;
      const key=d.id+'/'+view+'/'+side;
      if(!widths.has(key))widths.set(key,width);
      // The former angle/scale solve reduced some actual opaque wrist spans
      // by over90% during a back-facing walk. Inspect PNG alpha after the
      // real affine transform instead of checking its declared width alone.
      assert.ok(width>1.4,label+'/'+side+' contains a visible opaque wrist cross section');
      close(width,widths.get(key),label+'/'+side+' painted wrist does not collapse under foreshortening',.11);
    }
  }
  assert.equal(widths.size,88,'all four authored views of all eleven identities');
});

function recordedRig(definition){
  let matrix=[1,0,0,1,0,0],path=[],clips=[];const stack=[],draws=[];
  const point=(x,y)=>[matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]];
  const methods={globalAlpha:1,
    save(){stack.push({matrix:[...matrix],clips:[...clips]});},restore(){({matrix,clips}=stack.pop());},
    transform(a,b,c,d,e,f){const[aa,bb,cc,dd,ee,ff]=matrix;matrix=[aa*a+cc*b,bb*a+dd*b,aa*c+cc*d,bb*c+dd*d,aa*e+cc*f+ee,bb*e+dd*f+ff];},
    translate(x,y){this.transform(1,0,0,1,x,y);},scale(x,y){this.transform(x,0,0,y,0,0);},rotate(a){this.transform(Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0);},
    beginPath(){path=[];},rect(x,y,w,h){path.push(point(x,y),point(x+w,y),point(x+w,y+h),point(x,y+h));},
    clip(){clips.push(path.map(p=>[...p]));},moveTo(x,y){path.push(point(x,y));},lineTo(x,y){path.push(point(x,y));},
    createLinearGradient(){return {addColorStop(){}};},createRadialGradient(){return {addColorStop(){}};},
    drawImage(image,x,y,width,height){draws.push({key:image.key,index:image.index,x,y,width,height,matrix:[...matrix],clips:structuredClone(clips)});},
  };
  const ctx=new Proxy(methods,{get:(object,key)=>key in object?object[key]:(()=>{})});
  const art={...definition.views,props:HEARTHKIN_RIG_ART.props};
  if(definition.mount)for(const[view,entry]of Object.entries(definition.mount.views))art['mount-'+view]=entry;
  const rig=Object.assign(Object.create(HearthkinRig.prototype),{definition,art,armParts:definition.arms,handFrames:definition.hands,transitions:new WeakMap(),part(key,index){return Array(4).fill({key,index});}});
  return {rig,ctx,draws,stack,clear(){draws.length=0;}};
}
function recordedPoint(draw,p){
  const x=draw.x+p[0]*draw.width,y=draw.y+p[1]*draw.height,[a,b,c,d,e,f]=draw.matrix;
  return {x:a*x+c*y+e,y:b*x+d*y+f};
}
function inside(point,polygon){
  let yes=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    if((a[1]>point.y)!==(b[1]>point.y)&&point.x<(b[0]-a[0])*(point.y-a[1])/(b[1]-a[1])+a[0])yes=!yes;
  }
  return yes;
}
function paintedAlpha(draw,art,point){
  if(draw.clips.some(p=>!inside(point,p)))return 0;
  const[a,b,c,d,e,f]=draw.matrix,det=a*d-b*c,dx=point.x-e,dy=point.y-f;
  const x=(d*dx-c*dy)/det,y=(-b*dx+a*dy)/det,u=(x-draw.x)/draw.width,v=(y-draw.y)/draw.height;
  if(u<0||u>=1||v<0||v>=1)return 0;
  return sourceAlpha(art)(...absolute([u,v],art.parts[draw.index]));
}

test('actual renderer clips proximal hand stumps and distal forearms separately while keeping a painted join',()=>{
  for(const id of Object.keys(originals)){
    const d=CHARACTER_RIGS[id],record=recordedRig(d),scale=d.renderScale??1;
    for(let direction=0;direction<4;direction++)for(const phase of[0,.25,.5,.75]){
      record.clear();const state='walk',time=d.actions.walk.duration*phase,view=views[direction];
      assert.ok(record.rig.draw(record.ctx,{id:5,type:id,animationState:state,facing:direction},{x:0,y:0},100,1,time));
      assert.equal(record.stack.length,0,`${id}/${view} all canvas save/restore pairs balance`);
      const fit=fitCharacterSurfaces(d.samplePose(state,time,direction,{id:5,moving:true}),d);
      for(const side of sides){
        const arm=d.arms[view][side],h=d.hands[view][side],find=p=>record.draws.find(draw=>draw.key===p.key&&draw.index===p.index);
        const upper=find(arm.upper),lower=find(arm.lower),hand=find(h),label=`${id}/${view}/${phase}/${side}`;
        assert.ok(upper&&lower&&hand,label+' original surfaces are actually drawn');
        const wrist={x:fit[side+'Hand'].x*scale,y:fit[side+'Hand'].y*scale},elbow={x:fit[side+'Elbow'].x*scale,y:fit[side+'Elbow'].y*scale};
        near(recordedPoint(lower,arm.lower.tip),wrist,label+' recorded lower arm wrist');near(recordedPoint(hand,h.root),wrist,label+' recorded hand wrist');
        near(recordedPoint(hand,h.grip),{x:fit[side+'Palm'].x*scale,y:fit[side+'Palm'].y*scale},label+' recorded actual palm grip');
        assert.equal(lower.clips.length,1,label+' forearm has one independent wrist clip');assert.equal(hand.clips.length,1,label+' hand has one independent wrist clip');
        assert.notDeepEqual(lower.clips,hand.clips,label+' opposite half-plane masks remain independent');
        const length=Math.hypot(wrist.x-elbow.x,wrist.y-elbow.y),along={x:(wrist.x-elbow.x)/length,y:(wrist.y-elbow.y)/length},across={x:along.y,y:-along.x};
        const at=(down,offset=0)=>({x:wrist.x+(along.x*down+across.x*offset)*scale,y:wrist.y+(along.y*down+across.y*offset)*scale});
        assert.equal(paintedAlpha(lower,d.views[lower.key],at(.2)),0,label+' lower paint stops at the anatomical wrist');
        assert.equal(paintedAlpha(hand,d.views[hand.key],at(-.3)),0,label+' proximal hand stump is clipped');
        for(const down of[-.1,0,.1])for(const offset of[-.3,0,.3])assert.ok(Math.max(paintedAlpha(lower,d.views[lower.key],at(down,offset)),paintedAlpha(hand,d.views[hand.key],at(down,offset)))>180,label+' opaque paint connects the wrist neighborhood');
        const order=record.draws.indexOf(upper)-record.draws.indexOf(lower);
        assert.equal(order>0,!!arm.sleeveOverForearm,label+' costume-specific cuff layer order');
      }
    }
  }
});

test('profile upper-arm roots follow the actually drawn torso socket during action transitions',()=>{
  for(const id of Object.keys(originals)){
    const d=CHARACTER_RIGS[id],record=recordedRig(d),scale=d.renderScale??1;
    for(const direction of[1,3]){
      const view=views[direction],side=direction===1?'right':'left',unit={id:5,type:id,kind:'unit',motionSpeed:.4,facing:direction,animClock:0};
      for(const state of['idle','walk',d.actions.field_work?'field_work':'attack_contact','ward_block','death','walk']){
        if(!d.actions[state])continue;
        for(const phase of(state==='death'?[.25,.55,.75,.95]:[.25]))for(const elapsed of[0,.04,.12]){
          unit.animationState=state;unit.animationTime=d.actions[state].duration*phase;unit.animClock+=elapsed+.001;record.clear();
          assert.ok(record.rig.draw(record.ctx,unit,{x:0,y:0},100));
          const raw=record.rig.transitions.get(unit).pose,fit=fitCharacterSurfaces(raw,d),replacement=d.views[view].overrides?.[1];
          const torso=record.draws.find(draw=>draw.key===(replacement?.key??view)&&draw.index===(replacement?.index??1));
          const upperPart=d.arms[view][side].upper,upper=record.draws.find(draw=>draw.key===upperPart.key&&draw.index===upperPart.index);
          const socket=recordedPoint(torso,d.surfaceCalibration.profileSockets[view]),shoulder=recordedPoint(upper,upperPart.root),label=`${id}/${view}/${state}/${elapsed}`;
          let expected=socket;
          if(raw.projectedWork&&!deathTarget(raw,d,side)){
            const palm=projectHearthkin(raw.anatomical[side+'Palm'],direction),dx=palm.x*scale-socket.x,dy=palm.y*scale-socket.y,span=Math.hypot(dx,dy),reach=(33+d.hands[view][side].palmLength-.002)*scale;
            if(span>reach)expected={x:socket.x+dx*(span-reach)/span,y:socket.y+dy*(span-reach)/span};
          }
          near(shoulder,expected,label+' shoulder sits on its rendered socket or closest reachable surface point',1e-5);
          near(shoulder,{x:fit[side+'Shoulder'].x*scale,y:fit[side+'Shoulder'].y*scale},label+' actual authored cap root');
        }
      }
    }
  }
});

test('the approved Crownwarden Hearthkin surface and pose path are preserved',()=>{
  const d=CHARACTER_RIGS.villager;
  assert.equal(d.surfaceCalibration,undefined);assert.equal(calibrateCharacterSurfaces(d),d);
  for(const[state,action]of Object.entries(d.actions))for(let direction=0;direction<4;direction++)for(const phase of[0,.25,.5,.75]){
    const pose=d.samplePose(state,action.duration*phase,direction,{id:5,moving:state==='walk'});
    assert.deepEqual(fitCharacterSurfaces(pose,d),fitHearthkinProfile(pose),`${state}/${views[direction]}/${phase}`);
  }
  assert.ok(HEARTHKIN_RIG_ART&&HEARTHKIN_ARM_PARTS&&HEARTHKIN_HAND_PARTS,'Crown original source metadata remains available');
});
