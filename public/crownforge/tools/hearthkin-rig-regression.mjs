import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HEARTHKIN_ACTIONS, HearthkinRig, hearthkinPose, hearthkinHandFrame, hearthkinPalmSocket, solveLimb } from '../src/hearthkin-rig.js';
import { HEARTHKIN_RIG_ART, HEARTHKIN_ARM_PARTS, HEARTHKIN_HAND_PARTS } from '../src/hearthkin-rig-art.js';
import { fitHearthkinProfile } from '../src/hearthkin-surface-fit.js';
import { equipmentGeometry } from '../src/character-equipment.js';
import { ANIMATION_DEFINITIONS, CrownforgeAnimationSystem, resolveAnimationState, animationFrame } from '../src/animation.js';
import { CrownforgeRenderer } from '../src/renderer.js';

const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const anatomicalDistance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const near = (actual,expected,tolerance,message) => assert.ok(Math.abs(actual-expected)<=tolerance,`${message}: ${actual} versus ${expected}`);
const renderedPoint = (draw,point) => {
  const [a,b,c,d,e,f]=draw.matrix;
  const [px,py]=Array.isArray(point)?point:[point.x,point.y];
  const x=draw.x+draw.width*px,y=draw.y+draw.height*py;
  return {x:a*x+c*y+e,y:b*x+d*y+f};
};
assert.equal(ANIMATION_DEFINITIONS.villager.renderer, 'skeletal');
const partCounts={front:16,right:16,back:16,left:16,props:12,armSurfaces:8,neutralHands:4,profileHands:4,profileTorsos:2};
assert.deepEqual(Object.keys(HEARTHKIN_RIG_ART).sort(),Object.keys(partCounts).sort(),'all authored atlases are covered by source validation');
for(const [view,art] of Object.entries(HEARTHKIN_RIG_ART)) {
  const bytes=fs.readFileSync(new URL('../'+art.src.split('?')[0],import.meta.url));
  assert.equal(bytes.readUInt32BE(16),art.width);
  assert.equal(bytes.readUInt32BE(20),art.height);
  assert.equal(bytes[25],6,`${view}: RGBA PNG, not painted transparency`);
  assert.equal(art.parts.length,partCounts[view],`${view}: expected authored component count`);
  for(const [x,y,w,h] of art.parts)assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=art.width&&y+h<=art.height,`${view}: source part inside atlas`);
}
assert.equal(new Set(['front','right','back','left'].map(key=>HEARTHKIN_RIG_ART[key].src)).size,4,'four authored views, no mirrored substitutes');
for(const [state,action] of Object.entries(HEARTHKIN_ACTIONS)) {
  assert.ok(ANIMATION_DEFINITIONS.villager.clips[state],`${state} registered`);
  for(let direction=0;direction<4;direction++)for(let i=0;i<=120;i++) {
    const p=hearthkinPose(state,action.duration*i/120,direction);
    for(const [key,value] of Object.entries(p)) {
      if(typeof value==='number')assert.ok(Number.isFinite(value),`${state} ${key} finite`);
      const q=value?.point??value;
      if(q&&'x'in Object(q))assert.ok(Number.isFinite(q.x)&&Number.isFinite(q.y)&&Math.abs(q.x)<100&&q.y>-130&&q.y<30,`${state} ${key} stays in character bounds`);
    }
    for(const side of ['left','right']) {
      if(p.projectedLocomotion) {
        const joints=p.anatomical;
        for(const [start,end,length] of [['Shoulder','Elbow',17],['Elbow','Hand',16],['Hip','Knee',19.8],['Knee','Ankle',19.8]]) {
          near(anatomicalDistance(joints[side+start],joints[side+end]),length,1e-6,`${state} ${side} anatomical ${start}-${end} length`);
          const screenEnd=end==='Ankle'?p[side+'Foot'].point:p[side+end];
          assert.ok(distance(p[side+start],screenEnd)<=length+1e-6,`${state} projected ${start}-${end} cannot exceed anatomical length`);
        }
        assert.ok(anatomicalDistance(joints[side+'Hip'],joints[side+'Ankle'])<39.6,`${state} ankle remains within two-bone reach`);
      } else {
        near(distance(p[side+'Shoulder'],p[side+'Elbow']),17,1e-7,'work pose upper arm length fixed');
        near(distance(p[side+'Elbow'],p[side+'Hand']),16,1e-5,'work pose forearm length fixed');
      }
    }
  }
}
const walkDuration=HEARTHKIN_ACTIONS.walk.duration;
for(let direction=0;direction<4;direction++) {
  assert.equal(animationFrame('villager','walk',.2,direction).atlasKey,['front','right','back','left'][direction],'shared metadata identifies the authored direction');
  const poses=Array.from({length:60},(_,i)=>hearthkinPose('walk',i*walkDuration/60,direction));
  assert.ok(new Set(poses.map(p=>JSON.stringify([p.leftFoot,p.rightFoot,p.leftHand,p.rightHand]))).size>=58,'continuous unique poses across a 60 Hz stride');
  const begin=hearthkinPose('walk',0,direction),end=hearthkinPose('walk',walkDuration-1e-7,direction);
  assert.ok(distance(begin.leftFoot.point,end.leftFoot.point)<.0001,'left foot wraps continuously');
  assert.ok(distance(begin.rightFoot.point,end.rightFoot.point)<.0001,'right foot wraps continuously');
  for(const side of ['left','right'])near(begin[side+'Foot'].angle,end[side+'Foot'].angle,.0001,`${side} boot rotation wraps continuously`);
  const epsilon=walkDuration*1e-5;
  const before=hearthkinPose('walk',walkDuration-epsilon,direction),after=hearthkinPose('walk',epsilon,direction);
  for(const side of ['left','right']) {
    const velocityBefore=(begin.anatomical[side+'Ankle'].z-before.anatomical[side+'Ankle'].z)/epsilon;
    const velocityAfter=(after.anatomical[side+'Ankle'].z-begin.anatomical[side+'Ankle'].z)/epsilon;
    near(velocityBefore,velocityAfter,.05,`${side} forward foot velocity is continuous at landing`);
  }
  const low=hearthkinPose('gather_wood',1.1*.6,direction),high=hearthkinPose('gather_wood',1.1*.4,direction);
  assert.ok(low.rightHand.y>high.rightHand.y+15,'tool travels from wind-up to timed contact');
  const fallen=hearthkinPose('death',1.35,direction),held=hearthkinPose('death',8,direction);
  for(const key of ['head','neck','hip','leftKnee','rightKnee','leftHand','rightHand','headTilt','braidSway'])assert.deepEqual(held[key],fallen[key],'fallen pose remains still');
}
// Diagnose the reported walk defects with anatomical criteria, not a count
// of different pictures. A front-facing limb may shorten in projection.
for(const state of ['walk','carry_wood','carry_food','carry_stone','carry_gold','carry_supplies']) {
  const duration=HEARTHKIN_ACTIONS[state].duration;
  for(let direction=0;direction<4;direction++) {
    let maxLift=0;
    for(let i=0;i<120;i++) {
      const p=hearthkinPose(state,duration*i/120,direction);
      assert.ok(p.leftFoot.planted||p.rightFoot.planted,`${state} never has a running flight phase`);
      for(const side of ['left','right']) {
        const foot=p[side+'Foot'],joints=p.anatomical;
        assert.ok(foot.lift>=0&&foot.lift<=4.5,`${state} foot has low walking clearance, not a marching lift`);
        maxLift=Math.max(maxLift,foot.lift);
        near(joints[side+'Ankle'].y-foot.lift,6,1e-6,'foot clearance is measured from a stable ground plane');
        if(foot.planted)near(foot.lift,0,1e-6,'supporting foot stays on the ground');
        const hip=joints[side+'Hip'],ankle=joints[side+'Ankle'],knee=joints[side+'Knee'];
        const t=(hip.y-knee.y)/(hip.y-ankle.y);
        assert.ok(knee.z>=hip.z+(ankle.z-hip.z)*t-1e-6,'knee bends forward in the sagittal plane');
        if(state==='walk'&&(direction===0||direction===2)) {
          assert.ok(Math.abs(p[side+'Elbow'].x-p[side+'Shoulder'].x)<=2.5,'front/back elbow stays close to its shoulder column');
          assert.equal(Math.sign(p[side+'Elbow'].x-p.shoulder.x),Math.sign(p[side+'Shoulder'].x-p.shoulder.x),'elbow does not cross the body midline');
        }
      }
    }
    assert.ok(maxLift>1,'swing foot actually clears the ground');
  }
}
for(const [phase,leading,trailing] of [[0,'left','right'],[.5,'right','left']]) {
  const p=hearthkinPose('walk',walkDuration*phase,1),j=p.anatomical;
  assert.ok(j[leading+'Ankle'].z>j[trailing+'Ankle'].z,'contact pose has the expected leading leg');
  assert.ok(j[trailing+'Hand'].z-j[trailing+'Shoulder'].z>j[leading+'Hand'].z-j[leading+'Shoulder'].z,'opposite arm leads at foot contact');
}
for(const state of ['idle','walk','carry_wood']) {
  const p=hearthkinPose(state,.2,0,{moving:false});
  assert.ok(p.leftFoot.planted&&p.rightFoot.planted,'stationary worker rests both feet');
  near(p.leftFoot.lift,0,1e-6,'stationary left foot does not cycle');
  near(p.rightFoot.lift,0,1e-6,'stationary right foot does not cycle');
}
// Render into a recording context to test the actual weapon attachment and
// painter order. A mathematically valid socket alone cannot catch a draw
// call that still places the axe at the wrist or on top of the fingers.
function captureRigDraw(state,time,direction) {
  let matrix=[1,0,0,1,0,0],path=[];const stack=[],draws=[];
  const transformed=(x,y)=>({x:matrix[0]*x+matrix[2]*y+matrix[4],y:matrix[1]*x+matrix[3]*y+matrix[5]});
  const ctx={globalAlpha:1,
    save(){stack.push([...matrix]);},restore(){matrix=stack.pop();},
    translate(x,y){matrix[4]+=matrix[0]*x+matrix[2]*y;matrix[5]+=matrix[1]*x+matrix[3]*y;},
    scale(x,y){matrix[0]*=x;matrix[1]*=x;matrix[2]*=y;matrix[3]*=y;},
    rotate(angle){const [a,b,c,d,e,f]=matrix,cos=Math.cos(angle),sin=Math.sin(angle);matrix=[a*cos+c*sin,b*cos+d*sin,-a*sin+c*cos,-b*sin+d*cos,e,f];},
    transform(a,b,c,d,e,f){const [a0,b0,c0,d0,e0,f0]=matrix;matrix=[a0*a+c0*b,b0*a+d0*b,a0*c+c0*d,b0*c+d0*d,a0*e+c0*f+e0,b0*e+d0*f+f0];},
    beginPath(){path=[];},rect(){},clip(){},closePath(){},
    moveTo(x,y){path.push(transformed(x,y));},lineTo(x,y){path.push(transformed(x,y));},
    fill(){draws.push({image:{key:'solid-equipment'},points:path.map(p=>({...p})),matrix:[...matrix]});},stroke(){},
    drawImage(image,x,y,width,height){draws.push({image,x,y,width,height,matrix:[...matrix]});},
  };
  const rig=Object.assign(Object.create(HearthkinRig.prototype),{
    part(key,index){return Array(4).fill({key,index});},
  });
  assert.ok(rig.draw(ctx,{animationState:state,facing:direction},{x:0,y:0},100,1,time));
  return draws;
}
for(let direction=0;direction<4;direction++)for(const phase of [0,.2,.5,.8]) {
  const time=walkDuration*phase,p=fitHearthkinProfile(hearthkinPose('walk',time,direction)),socket=hearthkinPalmSocket(p);
  const wrist=p.rightHand,elbow=p.rightElbow;
  const frame=hearthkinHandFrame(p);
  const gripDistance=Math.hypot((frame.grip[0]-frame.root[0])*frame.width,(frame.grip[1]-frame.root[1])*frame.height);
  near(distance(socket,wrist),gripDistance,1e-6,'weapon socket lies at the authored palm grip, beyond the wrist');
  assert.ok(gripDistance>3&&gripDistance<5,'grip remains inside the hand rather than floating at or beyond it');
  assert.ok((socket.x-wrist.x)*(wrist.x-elbow.x)+(socket.y-wrist.y)*(wrist.y-elbow.y)>0,'palm socket follows the forearm direction');
  const draws=captureRigDraw('walk',time,direction);
  const toolIndex=draws.findIndex(draw=>draw.image.key==='solid-equipment');
  const lastToolIndex=draws.findLastIndex(draw=>draw.image.key==='solid-equipment');
  const geometry=equipmentGeometry(p.toolFrame,direction);
  const faces=draws.filter(draw=>draw.image.key==='solid-equipment');
  assert.equal(geometry.tool,'axe','walking retains the right-hand axe');
  assert.equal(faces.length,geometry.faces.length,'walking draws every solid axe face once');
  if(direction===3) {
    const nearLeg=draws.map((draw,index)=>({draw,index})).filter(({draw})=>draw.image.key==='left'&&[10,12,14].includes(draw.image.index));
    assert.equal(nearLeg.length,3,'left-facing near leg includes thigh, shin and boot');
    assert.ok(nearLeg.every(({index})=>index>lastToolIndex),'left-facing near leg must overdraw every face of the far right-hand axe');
  } else if(direction===1) {
    const legs=draws.map((draw,index)=>({draw,index})).filter(({draw})=>draw.image.key==='right'&&draw.image.index>=10&&draw.image.index<=15);
    assert.equal(legs.length,6,'right-facing draw includes both complete legs');
    assert.ok(legs.every(({index})=>index<toolIndex),'right-facing near right-hand axe remains in front of both legs');
  }
  const handIndex=draws.findIndex(draw=>draw.image.key===frame.key&&draw.image.index===frame.index);
  assert.ok(toolIndex>=0&&handIndex>lastToolIndex,'right hand closes over all solid axe shaft faces in every facing');
  // The production tool now projects solid surfaces from its anatomical
  // frame. Validate the geometry actually drawn, not obsolete bitmap
  // reflection signs or the width of a permanently broadside axe image.
  const offset={x:socket.x-geometry.grip.x,y:socket.y-geometry.grip.y};
  for(let face=0;face<faces.length;face++) {
    assert.equal(faces[face].points.length,geometry.faces[face].points.length,'solid tool face keeps its projected vertices');
    for(let vertex=0;vertex<faces[face].points.length;vertex++) {
      const expected=geometry.faces[face].points[vertex];
      near(distance(faces[face].points[vertex],{x:expected.x+offset.x,y:expected.y+offset.y}),0,1e-6,'actual solid tool rendering preserves anatomical geometry and palm attachment');
    }
  }
  assert.equal(draws.filter(draw=>draw.image.key==='props'&&draw.image.index===0).length,0,'walking does not overlay the obsolete broadside axe bitmap');
  near(distance(renderedPoint(draws[handIndex],frame.root),wrist),0,1e-6,'actual hand artwork wrist lands on the skeletal wrist');
  near(distance(renderedPoint(draws[handIndex],frame.grip),socket),0,1e-6,'actual hand artwork grip and axe handle share the same point');
  if(direction===1||direction===3) {
    assert.equal(frame.key,'profileHands','profiles use gripping hands rather than the old open duplicated hands');
    assert.equal(frame.index,direction===1?1:0,'right hand uses near dorsal or far palm source according to camera');
    near(distance(socket,wrist),3.65,1e-6,'profile palm grip has the calibrated wrist-to-grip reach');
  }
}
for(let direction=0;direction<4;direction++) {
  for(const phase of [0,.5,1]) {
    const axe=captureRigDraw('death',HEARTHKIN_ACTIONS.death.duration*phase,direction).find(draw=>draw.image.key==='props'&&draw.image.index===0);
    assert.ok(axe,'falling worker retains a separately drawn dropped axe');
    const [a,b,c,d,e,f]=axe.matrix;
    assert.equal(Math.sign(a*d-b*c),direction===2||direction===3?-1:1,'dropped axe retains its four-view surface orientation');
    near(distance(renderedPoint(axe,[.24,.85]),{x:e,y:f}),0,1e-6,'dropped axe reflection preserves its authored pivot');
  }
  for(const [state,tool] of [['gather_stone','pick'],['field_work','hoe'],['construct','hammer']]) {
    const time=HEARTHKIN_ACTIONS[state].duration*.6,pose=fitHearthkinProfile(hearthkinPose(state,time,direction));
    const geometry=equipmentGeometry(pose.toolFrame,direction);
    const draws=captureRigDraw(state,time,direction),faces=draws.filter(draw=>draw.image.key==='solid-equipment');
    assert.equal(geometry.tool,tool,`${state} retains its own tool`);
    assert.equal(faces.length,geometry.faces.length,`${state} draws its complete solid equipment geometry`);
    assert.ok(faces.length>0,`${state} equipment is actually drawn`);
    for(const side of ['left','right']) {
      const frame=hearthkinHandFrame(pose,side==='left');
      const hand=draws.find(draw=>draw.image.key===frame.key&&draw.image.index===frame.index);
      const [a,b,c,d]=hand.matrix;
      assert.ok(a*d-b*c>0,'work hand retains its authored chirality');
      near(distance(renderedPoint(hand,frame.root),pose[side+'Hand']),0,1e-6,`${state} painted wrist matches its projected anatomical wrist`);
      near(distance(renderedPoint(hand,frame.grip),hearthkinPalmSocket(pose,side==='left')),0,1e-6,`${state} painted palm matches its projected anatomical grip`);
    }
  }
}
// Test the source pixels' authored attachment points through the transforms
// actually passed to drawImage. Correct joints alone did not catch the old
// centerline assumption, which added each sleeve's painted tilt a second time.
for(const [direction,view,handIndices] of [[0,'front',{left:1,right:0}],[2,'back',{left:2,right:3}]]) {
  for(const phase of [0,.125,.25,.375,.5,.625,.75,.875]) {
    const time=walkDuration*phase,p=hearthkinPose('walk',time,direction),draws=captureRigDraw('walk',time,direction);
    for(const side of ['left','right']) {
      for(const [segment,start,end] of [['upper','Shoulder','Elbow'],['lower','Elbow','Hand']]) {
        const part=HEARTHKIN_ARM_PARTS[view][side][segment];
        assert.equal(part.key,'armSurfaces',`${view} ${side} ${segment} uses the corrected authored surface`);
        assert.ok(part.root.every(n=>n>=0&&n<=1)&&part.tip.every(n=>n>=0&&n<=1),'arm attachments lie inside their source rectangles');
        const matches=draws.filter(draw=>draw.image.key===part.key&&draw.image.index===part.index);
        assert.equal(matches.length,1,`${view} ${side} ${segment} is drawn once from the intended source part`);
        const draw=matches[0],[a,b,c,d]=draw.matrix;
        assert.ok(a*d-b*c>0,'arm surface preserves authored handedness without reflection');
        near(distance(renderedPoint(draw,part.root),p[side+start]),0,1e-6,`${view} ${side} ${segment} source root lands on ${start}`);
        near(distance(renderedPoint(draw,part.tip),p[side+end]),0,1e-6,`${view} ${side} ${segment} source tip lands on ${end}`);
      }
      const frame=hearthkinHandFrame(p,side==='left');
      assert.deepEqual(frame,HEARTHKIN_HAND_PARTS[view][side],`${view} ${side} hand uses the authored neutral wrist frame`);
      assert.equal(frame.key,'neutralHands');
      assert.equal(frame.index,handIndices[side],`${view} ${side} selects the anatomically authored hand, not screen-side slot order`);
      assert.ok(frame.root.every(n=>n>=0&&n<=1)&&frame.grip.every(n=>n>=0&&n<=1),'hand wrist and grip remain inside their source rectangle');
      const matches=draws.filter(draw=>draw.image.key===frame.key&&draw.image.index===frame.index);
      assert.equal(matches.length,1,`${view} ${side} hand is drawn once from its intended source part`);
      const draw=matches[0],[a,b,c,d]=draw.matrix;
      assert.ok(a*d-b*c>0,'hand surface preserves its authored chirality without reflection');
      near(distance(renderedPoint(draw,frame.root),p[side+'Hand']),0,1e-6,`${view} ${side} source wrist remains attached throughout the walk`);
      near(distance(renderedPoint(draw,frame.grip),hearthkinPalmSocket(p,side==='left')),0,1e-6,`${view} ${side} source grip agrees with its palm socket throughout the walk`);
    }
  }
}
for(const type of ['wood','food','stone','gold','supplies'])assert.equal(hearthkinPose('carry_'+type,.2,0).cargo,type);
const base={type:'villager',facing:0,animClock:0,visualState:'idle',command:'idle'};
assert.equal(resolveAnimationState({...base,stunTimer:1}),'stunned');
assert.equal(resolveAnimationState({...base,dead:true,stunTimer:1}),'death');
assert.equal(resolveAnimationState({...base,lastLightWardTimer:60,wardBlockedPulse:.4}),'ward_block');
assert.equal(resolveAnimationState({...base,lastLightWardTimer:60,wardBlockedPulse:.4,command:'move',visualState:'walk'}),'walk','ward does not interrupt movement');
assert.equal(resolveAnimationState({...base,lastLightWardTimer:60,command:'attack',visualState:'attack',attackPhase:'contact'}),'attack_contact','ward does not interrupt attack');
assert.equal(resolveAnimationState({...base,visualState:'build',workAnimation:'repair'}),'repair');
const unit={...base,command:'move',visualState:'walk'};const system=new CrownforgeAnimationSystem();
for(let i=0;i<=Math.ceil(walkDuration*2/.01);i++){unit.animClock+=.01;system.update(unit,.01);}
const footsteps=unit.animationEvents.filter(e=>e.name==='footstep');
assert.equal(footsteps.length,4,'two complete walking cycles emit four alternating foot contacts');
for(let i=1;i<footsteps.length;i++)near(footsteps[i].clock-footsteps[i-1].clock,walkDuration/2,.011,'footstep clock tracks the authored contact cadence');
const stopped={...base,command:'move',visualState:'walk',motionSpeed:0,animationState:'walk',animationTime:.3};
system.update(stopped,.2);
near(stopped.animationTime,.3,1e-9,'blocked worker does not keep pedaling');
const easing={...stopped,motionSpeed:1.45};
system.update(easing,.2);
near(easing.animationTime,.4,1e-9,'worker cadence eases with actual movement');
const joint=solveLimb({x:0,y:0},{x:10,y:30},17,16);
assert.ok(Math.abs(Math.hypot(joint.x,joint.y)-17)<1e-8);
// Reproduce the post-canopy repaint path: a selected worker and her ward
// must use the same valid size/time as the ordinary world render pass.
let repaints=0;
const ctx=new Proxy({}, {get:(_,key)=>(...args)=>{
  assert.ok(args.filter(v=>typeof v==='number').every(Number.isFinite),`${String(key)} has finite coordinates`);
  if(key==='createRadialGradient')return {addColorStop(){}};
}});
const renderer=Object.assign(Object.create(CrownforgeRenderer.prototype),{
  camera:{zoom:.7},lastRenderTime:1000,atmosphere:{reducedMotion:false},
  isWorldVisible:()=>true,unitScreenPoint:()=>({x:300,y:200}),
  drawVillagerAsset:(_ctx,_unit,_point,size)=>{assert.equal(size,70);repaints++;},
  drawUnitStatusEffects(){},drawSelectionMarker(){},drawHealthBar(){},
});
for(const ward of [0,10])renderer.drawOccludedUnitOverlays(ctx,{
  units:[{...base,x:0,z:0,selected:true,hp:42,maxHp:42,lastLightWardTimer:ward}],
  buildings:[],resourcesNodes:[{kind:'resource',type:'tree',x:0,z:1,amount:100}],
});
assert.equal(repaints,2,'selected workers remain visible under a canopy with and without a ward');
console.log(`PASS: ${Object.keys(HEARTHKIN_ACTIONS).length} continuous actions, four authored views, anatomical limb lengths, grounded gait, opposed arm swing, authored source joints and hands, attached rendered palm grip, correct axe-leg depth and blade orientation, fitted profile attachments, cycle seams, contact poses, cargo, status priority, still death and PNG source bounds.`);
