import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HEARTHKIN_ACTIONS, hearthkinPose, solveLimb } from '../src/hearthkin-rig.js';
import { HEARTHKIN_RIG_ART } from '../src/hearthkin-rig-art.js';
import { ANIMATION_DEFINITIONS, CrownforgeAnimationSystem, resolveAnimationState, animationFrame } from '../src/animation.js';
import { CrownforgeRenderer } from '../src/renderer.js';

const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
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
      assert.ok(Math.abs(distance(p[side+'Shoulder'],p[side+'Elbow'])-17)<1e-7,'upper arm length fixed');
      assert.ok(Math.abs(distance(p[side+'Elbow'],p[side+'Hand'])-16)<1e-5,'forearm length fixed');
    }
  }
}
for(let direction=0;direction<4;direction++) {
  assert.equal(animationFrame('villager','walk',.2,direction).atlasKey,['front','right','back','left'][direction],'shared metadata identifies the authored direction');
  const poses=Array.from({length:60},(_,i)=>hearthkinPose('walk',i*.82/60,direction));
  assert.ok(new Set(poses.map(p=>JSON.stringify([p.leftFoot,p.rightFoot,p.leftHand,p.rightHand]))).size>=58,'continuous unique poses across a 60 Hz stride');
  const begin=hearthkinPose('walk',0,direction),end=hearthkinPose('walk',.82-1e-7,direction);
  assert.ok(distance(begin.leftFoot.point,end.leftFoot.point)<.0001,'left foot wraps continuously');
  assert.ok(distance(begin.rightFoot.point,end.rightFoot.point)<.0001,'right foot wraps continuously');
  const low=hearthkinPose('gather_wood',1.1*.6,direction),high=hearthkinPose('gather_wood',1.1*.4,direction);
  assert.ok(low.rightHand.y>high.rightHand.y+15,'tool travels from wind-up to timed contact');
  const fallen=hearthkinPose('death',1.35,direction),held=hearthkinPose('death',8,direction);
  for(const key of ['head','neck','hip','leftKnee','rightKnee','leftHand','rightHand','headTilt','braidSway'])assert.deepEqual(held[key],fallen[key],'fallen pose remains still');
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
for(let i=0;i<100;i++){unit.animClock+=.01;system.update(unit,.01);}
assert.ok(unit.animationEvents.filter(e=>e.name==='footstep').length>=2,'walking emits foot contacts');
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
console.log(`PASS: ${Object.keys(HEARTHKIN_ACTIONS).length} continuous actions, four authored views, fixed arm lengths, cycle seams, contact poses, cargo, status priority, still death and PNG source bounds.`);
