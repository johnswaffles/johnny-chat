import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CHARACTER_RIGS} from '../src/character-rigs.js';
import {hearthkinPose,HEARTHKIN_ACTIONS,hearthkinPalmSocket,hearthkinHandFrame} from '../src/hearthkin-rig.js';

const crown=CHARACTER_RIGS.villager,ash=CHARACTER_RIGS.ashenForager,duration=crown.actions.walk.duration;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z??0)-(b.z??0));
const near=(a,b,label,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${label}: ${a} vs ${b}`);
const sample=(phase,direction=0,options={})=>crown.samplePose('walk',phase*duration,direction,{id:5,moving:true,...options});

test('production Crown walk has relaxed elbows in front and back without sideways wings',()=>{
  for(let n=0;n<=240;n++)for(const direction of [0,2]){
    const pose=sample(n/240,direction),j=pose.anatomical;
    for(const side of ['left','right']){
      const s=pose[side+'Shoulder'],e=pose[side+'Elbow'],w=pose[side+'Hand'];
      const outward=Math.sign(s.x-pose.shoulder.x),fraction=(e.y-s.y)/(w.y-s.y);
      const bow=outward*(e.x-(s.x+(w.x-s.x)*fraction));
      assert.ok(bow>1.8&&bow<3.2,`${side}/${direction}/${n} visible relaxed elbow bow`);
      assert.ok(Math.abs(e.x-s.x)<3.25,`${side}/${direction}/${n} upper arm remains close to torso`);
      assert.equal(Math.sign(e.x-pose.shoulder.x),outward,'elbow must not cross the body midline');
      assert.equal(Math.sign(w.x-pose.shoulder.x),outward,'wrist must stay on its anatomical side');
      const a=j[side+'Shoulder'],b=j[side+'Elbow'],c=j[side+'Hand'];
      const chordZ=a.z+(c.z-a.z)*(a.y-b.y)/(a.y-c.y);
      assert.ok(b.z<chordZ-1.5&&b.z>chordZ-4.5,'elbow bends backward rather than turning inside out');
    }
  }
});

test('one anatomical walk preserves arm lengths, relaxed wrists and the right-hand axe in every view',()=>{
  for(let n=0;n<=120;n++){
    const reference=sample(n/120,0);
    for(let direction=0;direction<4;direction++){
      const pose=sample(n/120,direction),j=pose.anatomical;
      assert.deepEqual(j,reference.anatomical,'front/back improvement must not be a camera-specific deformation');
      for(const side of ['left','right']){
        const a=j[side+'Shoulder'],b=j[side+'Elbow'],c=j[side+'Hand'];
        near(distance(a,b),17,'upper arm length');near(distance(b,c),16,'forearm length');
        const sign=side==='left'?-1:1;
        assert.ok(sign*(b.x-a.x)>1.8&&sign*(b.x-a.x)<3.25,'moderate outward upper arm');
        assert.ok(sign*(c.x-b.x)<0,'relaxed forearm returns toward hip');
        assert.ok(sign*(c.x-a.x)>0&&sign*(c.x-a.x)<1.5,'wrist hangs near shoulder column');
      }
      const grip=hearthkinPalmSocket(pose),hand=hearthkinHandFrame(pose),w=pose.rightHand,e=pose.rightElbow;
      const authoredGrip=Math.hypot((hand.grip[0]-hand.root[0])*hand.width,(hand.grip[1]-hand.root[1])*hand.height);
      near(distance(grip,w),authoredGrip,'axe grip stays at the authored palm');
      assert.ok((grip.x-w.x)*(w.x-e.x)+(grip.y-w.y)*(w.y-e.y)>0,'palm continues the forearm without a reversed wrist');
      assert.equal(pose.tool,'axe');assert.equal(pose.toolFrame.tool,'axe');
    }
  }
});

test('relaxed elbows retain the opposed gait and continuous loop',()=>{
  for(const[phase,leading,trailing]of [[0,'left','right'],[.5,'right','left']]){
    const j=sample(phase,1).anatomical;
    assert.ok(j[leading+'Ankle'].z>j[trailing+'Ankle'].z,'expected leading foot at contact');
    assert.ok(j[trailing+'Hand'].z-j[trailing+'Shoulder'].z>j[leading+'Hand'].z-j[leading+'Shoulder'].z,'opposite arm leads at foot contact');
  }
  for(let direction=0;direction<4;direction++){
    const first=sample(0,direction),last=sample(1,direction),epsilon=1e-5,before=sample(1-epsilon,direction),after=sample(epsilon,direction);
    for(const side of ['left','right'])for(const joint of ['Shoulder','Elbow','Hand']){
      const key=side+joint;near(distance(first.anatomical[key],last.anatomical[key]),0,`${key} loop position`);
      for(const axis of ['x','y','z']){
        const a=(first.anatomical[key][axis]-before.anatomical[key][axis])/(epsilon*duration);
        const b=(after.anatomical[key][axis]-first.anatomical[key][axis])/(epsilon*duration);
        near(a,b,`${key}/${axis} loop velocity`,.02);
      }
    }
  }
});

test('both workers use relaxed walking while idle, carrying and stopped poses retain their existing anatomy',()=>{
  const carries=['carry_wood','carry_food','carry_stone','carry_gold','carry_supplies'];
  for(const rig of [ash,crown])for(const state of ['idle',...carries])for(let direction=0;direction<4;direction++)for(const phase of [0,.125,.25,.5,.75,1]){
    const options={id:5,moving:true},actual=rig.samplePose(state,rig.actions[state].duration*phase,direction,options);
    const expected=hearthkinPose(state,HEARTHKIN_ACTIONS[state].duration*phase,direction,options);
    assert.deepEqual(actual,expected,`${rig.id}/${state} must retain the default worker pose`);
  }
  for(let direction=0;direction<4;direction++)for(const phase of [0,.125,.25,.5,.75,1]){
    const crownPose=sample(phase,direction),ashenPose=ash.samplePose('walk',ash.actions.walk.duration*phase,direction,{id:5,moving:true});
    assert.deepEqual(ashenPose.anatomical,crownPose.anatomical,'the Ashen worker receives the approved anatomical walking bend in every view');
    for(const side of ['left','right']){
      const j=ashenPose.anatomical,a=j[side+'Shoulder'],b=j[side+'Elbow'],c=j[side+'Hand'],sign=side==='left'?-1:1;
      near(distance(a,b),17,'Ashen upper arm length');near(distance(b,c),16,'Ashen forearm length');
      assert.ok(sign*(b.x-a.x)>1.8&&sign*(b.x-a.x)<3.25,'Ashen upper arm bends moderately outward');
      assert.ok(sign*(c.x-b.x)<0,'Ashen forearm returns toward the hip');
    }
  }
  for(const rig of [ash,crown])for(let direction=0;direction<4;direction++)for(const phase of [0,.25,.5,.75]){
    const options={id:5,moving:false};
    assert.deepEqual(rig.samplePose('walk',rig.actions.walk.duration*phase,direction,options),hearthkinPose('walk',duration*phase,direction,options),`stopped ${rig.id} does not keep the moving arm treatment`);
  }
});
