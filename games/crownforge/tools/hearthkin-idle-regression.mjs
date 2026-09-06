import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CHARACTER_RIGS} from '../src/character-rigs.js';
import {hearthkinPose,HEARTHKIN_ACTIONS} from '../src/hearthkin-rig.js';
import {fitCharacterSurfaces} from '../src/character-surface-fit.js';
import {ANIMATION_DEFINITIONS,CrownforgeAnimationSystem} from '../src/animation.js';

const crown=CHARACTER_RIGS.villager,duration=crown.actions.idle.duration;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z??0)-(b.z??0));
const near=(a,b,label,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${label}: ${a} versus ${b}`);
const sample=(time,direction,id=1)=>crown.samplePose('idle',time,direction,{id,moving:false});
const range=values=>Math.max(...values)-Math.min(...values);

test('Crown idle visibly breathes above a quiet pelvis with both feet planted in every view',()=>{
  for(let direction=0;direction<4;direction++)for(const id of [1,2,5,12]){
    const first=sample(0,direction,id),heads=[],shoulders=[],hips=[];
    for(let n=0;n<=180;n++){
      const pose=sample(n/180*duration,direction,id),fit=fitCharacterSurfaces(pose,crown);
      heads.push(pose.head.y);shoulders.push(pose.shoulder.y);hips.push(pose.hip.y);
      assert.equal(pose.idleBreathing,true);
      assert.ok(distance(pose.anatomical.hip,first.anatomical.hip)<.6,'weight shift stays within .6 actor units');
      for(const side of ['left','right']){
        assert.deepEqual(pose[side+'Foot'],first[side+'Foot'],'no sliding, heel lift or foot rotation');
        assert.deepEqual(fit[side+'Foot'],first[side+'Foot'],'surface fitting keeps the planted foot');
        assert.equal(pose[side+'Foot'].planted,true);
        for(const j of [pose.anatomical,fit.anatomical]){
          near(distance(j[side+'Shoulder'],j[side+'Elbow']),17,'upper arm');
          near(distance(j[side+'Elbow'],j[side+'Hand']),16,'forearm');
          near(distance(j[side+'Hip'],j[side+'Knee']),19.8,'thigh');
          near(distance(j[side+'Knee'],j[side+'Ankle']),19.8,'shin');
        }
      }
    }
    assert.ok(range(heads)>1.6&&range(heads)<2.5,'visible but restrained head/chest rise at native scale');
    assert.ok(range(shoulders)>1.2&&range(shoulders)<2.2,'shoulders follow the chest');
    assert.ok(range(hips)<.3,'no whole-body bouncing');
  }
});

test('breath, head, hands and cloth loop smoothly across the actual idle clip boundary',()=>{
  const epsilon=1e-5;
  for(let direction=0;direction<4;direction++)for(const id of [0,1,2,12]){
    const poses=[duration-epsilon,0,epsilon,duration].map(t=>fitCharacterSurfaces(sample(t,direction,id),crown));
    const [before,start,after,end]=poses;
    for(const key of Object.keys(start.anatomical))for(const axis of ['x','y','z']){
      near(start.anatomical[key][axis],end.anatomical[key][axis],`${key} loop position`);
      near((start.anatomical[key][axis]-before.anatomical[key][axis])/epsilon,
        (after.anatomical[key][axis]-start.anatomical[key][axis])/epsilon,`${key} loop velocity`,.003);
    }
    for(const key of ['headTilt','clothSway','braidSway']){
      near(start[key],end[key],`${key} loop position`);
      near((start[key]-before[key])/epsilon,(after[key]-start[key])/epsilon,`${key} loop velocity`,.003);
    }
  }
  const clip=ANIMATION_DEFINITIONS.villager.clips.idle;
  near(clip.frames.length/clip.fps,duration,'production clock matches the breathing period');
  assert.equal(clip.loop,true);assert.deepEqual(clip.events,{},'breathing emits no footsteps or work events');
});

test('nearby Hearthkin have different breathing phases',()=>{
  for(const time of [0,.5,1.5,2.5]){
    const heights=[1,2,3,4,5,6].map(id=>sample(time,0,id).anatomical.neck.y);
    assert.ok(range(heights)>1.5,'a group does not breathe in lockstep');
  }
});

test('the live animation clock keeps breathing at zero movement speed and returns from walking',()=>{
  const system=new CrownforgeAnimationSystem();
  const unit={id:3,type:'villager',x:110,y:112,facing:1,command:'idle',visualState:'idle',motionSpeed:0};
  const heights=[];
  for(let n=0;n<480;n++){
    system.update(unit,1/60);
    heights.push(sample(unit.animationTime,unit.facing,unit.id).head.y);
    assert.equal(unit.animationState,'idle');
    assert.ok(unit.animationTime>=0&&unit.animationTime<duration);
  }
  assert.ok(range(heights)>1.6,'the zero-speed idle clock animates through multiple complete breaths');
  assert.equal(unit.x,110);assert.equal(unit.y,112);
  assert.equal(unit.animationEvents,undefined,'no gameplay animation events while at ease');
  unit.command='move';unit.visualState='walk';unit.motionSpeed=2;
  system.update(unit,1/60);assert.equal(unit.animationState,'walk');
  unit.command='idle';unit.visualState='idle';unit.motionSpeed=0;
  system.update(unit,1/60);assert.equal(unit.animationState,'idle');
  near(unit.animationTime,1/60,'breathing restarts normally when movement ends');
});

test('breathing is confined to Crown idle and leaves existing walking, cargo and work poses intact',()=>{
  for(const rig of [crown,CHARACTER_RIGS.ashenForager]){
    const states=Object.keys(rig.actions).filter(state=>!['death','attack'].includes(state)&&!(rig===crown&&state==='idle'));
    for(const state of states)for(let direction=0;direction<4;direction++)for(const phase of [0,.15,.4,.75,.99])for(const moving of [false,true]){
      const options={id:5,moving,relaxedWalkArms:true};
      const time=rig.actions[state].duration*phase,referenceTime=time/rig.actions[state].duration*HEARTHKIN_ACTIONS[state].duration;
      const expected=hearthkinPose(state,referenceTime,direction,options);
      assert.deepEqual(rig.samplePose(state,time,direction,options),expected,`${rig.id}/${state}/${direction}`);
    }
  }
});
