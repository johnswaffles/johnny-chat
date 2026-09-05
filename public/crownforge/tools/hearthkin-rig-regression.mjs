import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HEARTHKIN_ACTIONS, HearthkinRig, hearthkinPose, hearthkinPalmSocket, solveLimb } from '../src/hearthkin-rig.js';
import { HEARTHKIN_RIG_ART } from '../src/hearthkin-rig-art.js';
import { ANIMATION_DEFINITIONS, CrownforgeAnimationSystem, resolveAnimationState, animationFrame } from '../src/animation.js';
import { CrownforgeRenderer } from '../src/renderer.js';

const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const anatomicalDistance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const near = (actual,expected,tolerance,message) => assert.ok(Math.abs(actual-expected)<=tolerance,`${message}: ${actual} versus ${expected}`);
assert.equal(ANIMATION_DEFINITIONS.villager.renderer, 'skeletal');
for(const [view,art] of Object.entries(HEARTHKIN_RIG_ART)) {
  const bytes=fs.readFileSync(new URL('../'+art.src.split('?')[0],import.meta.url));
  assert.equal(bytes.readUInt32BE(16),art.width);
  assert.equal(bytes.readUInt32BE(20),art.height);
  assert.equal(bytes[25],6,`${view}: RGBA PNG, not painted transparency`);
  assert.equal(art.parts.length,view==='props'?12:16);
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
  let matrix=[1,0,0,1,0,0];const stack=[],draws=[];
  const ctx={globalAlpha:1,
    save(){stack.push([...matrix]);},restore(){matrix=stack.pop();},
    translate(x,y){matrix[4]+=matrix[0]*x+matrix[2]*y;matrix[5]+=matrix[1]*x+matrix[3]*y;},
    scale(x,y){matrix[0]*=x;matrix[1]*=x;matrix[2]*=y;matrix[3]*=y;},
    rotate(angle){const [a,b,c,d,e,f]=matrix,cos=Math.cos(angle),sin=Math.sin(angle);matrix=[a*cos+c*sin,b*cos+d*sin,-a*sin+c*cos,-b*sin+d*cos,e,f];},
    beginPath(){},rect(){},clip(){},
    drawImage(image,x,y,width,height){draws.push({image,x,y,width,height,matrix:[...matrix]});},
  };
  const rig=Object.assign(Object.create(HearthkinRig.prototype),{
    part(key,index){return Array(4).fill({key,index});},
  });
  assert.ok(rig.draw(ctx,{animationState:state,facing:direction},{x:0,y:0},100,1,time));
  return draws;
}
for(let direction=0;direction<4;direction++)for(const phase of [0,.2,.5,.8]) {
  const time=walkDuration*phase,p=hearthkinPose('walk',time,direction),socket=hearthkinPalmSocket(p);
  const wrist=p.rightHand,elbow=p.rightElbow;
  near(distance(socket,wrist),3.45,1e-6,'weapon socket lies inside the palm, beyond the wrist');
  assert.ok((socket.x-wrist.x)*(wrist.x-elbow.x)+(socket.y-wrist.y)*(wrist.y-elbow.y)>0,'palm socket follows the forearm direction');
  const draws=captureRigDraw('walk',time,direction);
  const toolIndex=draws.findIndex(draw=>draw.image.key==='props'&&draw.image.index===0);
  const handIndex=draws.findIndex(draw=>draw.image.key!== 'props'&&draw.image.index===9);
  assert.ok(toolIndex>=0&&handIndex>toolIndex,'right hand closes over the axe shaft in every facing');
  const draw=draws[toolIndex],[a,b,c,d,e,f]=draw.matrix;
  const gripX=draw.x+draw.width*.18,gripY=draw.y+draw.height*p.toolGrip;
  const renderedGrip={x:a*gripX+c*gripY+e,y:b*gripX+d*gripY+f};
  near(distance(renderedGrip,socket),0,1e-6,'rendered axe grip stays attached to the palm socket');
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
console.log(`PASS: ${Object.keys(HEARTHKIN_ACTIONS).length} continuous actions, four authored views, anatomical limb lengths, grounded gait, opposed arm swing, attached palm grip, cycle seams, contact poses, cargo, status priority, still death and PNG source bounds.`);
