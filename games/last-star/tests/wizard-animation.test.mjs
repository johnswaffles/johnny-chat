import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceWizardAnimation,newWizardAnimation,drawAirCloth,idlePose} from '../src/wizard-animation.js';
const player={onGround:true,vx:280,cast:0};
test('gait follows distance consistently across frame rates and freezes during pause',()=>{
 const a=newWizardAnimation(),b=newWizardAnimation();
 for(let i=0;i<60;i++)advanceWizardAnimation(a,player,1/60);
 for(let i=0;i<120;i++)advanceWizardAnimation(b,player,1/120);
 assert.ok(Math.abs(a.phase-b.phase)<1e-10);
 const frozen=structuredClone(a);advanceWizardAnimation(a,player,0);assert.deepEqual(a,frozen);
});
test('walking and cast transitions always draw one fully opaque body pose',()=>{
 const a=newWizardAnimation(),seen=new Set();
 for(let i=0;i<120;i++){
  advanceWizardAnimation(a,player,1/60);seen.add(a.walkFrame);
  assert.equal(a.weights.filter(x=>x===1).length,1);assert.equal(a.weights.filter(x=>x!==0&&x!==1).length,0);
 }
 assert.equal(seen.size,8);
 advanceWizardAnimation(a,{...player,cast:.3},1/60);
 assert.equal(a.walking,false);assert.equal(a.weights[5],1);
});
test('airborne legs hold a tucked pose while time advances and landing settles',()=>{
 const a=newWizardAnimation(),seen=new Set();
 for(let i=0;i<50;i++){advanceWizardAnimation(a,{onGround:false,vx:0,vy:-100,cast:.3},1/60);seen.add(a.airFrame);assert.equal(a.weights[7],1);}
 assert.deepEqual([...seen],[3]);assert.ok(a.airTime>0);
 advanceWizardAnimation(a,{onGround:false,vx:0,vy:120,cast:0},1/60);assert.equal(a.airFrame,3);
 const frozen=structuredClone(a);advanceWizardAnimation(a,{onGround:false,vx:0,vy:120,cast:0},0);assert.deepEqual(a,frozen);
 advanceWizardAnimation(a,{onGround:true,vx:0,vy:0,cast:0},1/60);assert.ok(a.landing>0);assert.equal(a.airborne,false);
 for(let i=0;i<20;i++)advanceWizardAnimation(a,{onGround:true,vx:0,vy:0,cast:0},1/60);
 assert.equal(a.landing,0);
});

test('cloth deformation leaves the body and legs identical across animation times',()=>{
 const sample=time=>{const calls=[];drawAirCloth({drawImage:(...args)=>calls.push(args)},{},[1152,0,384,512],-70,-118,.27,time);return calls;};
 const a=sample(0),b=sample(.25);
 assert.deepEqual(a[0],b[0]); // Entire right region containing legs, torso, and staff.
 assert.notDeepEqual(a.slice(1),b.slice(1));
 assert.deepEqual(a.slice(-8),b.slice(-8)); // Below trailing cloth remains stable too.
});

test('consistent standing pictures cycle, freeze on pause and stop for movement/casting',()=>{
 const a=newWizardAnimation(),p={onGround:true,vx:0,cast:0},seen=new Set();
 for(let i=0;i<180;i++){advanceWizardAnimation(a,p,1/60);const pose=idlePose(a);seen.add(pose.source.join(','));assert.equal(pose.key,'wizardIdle');assert.equal(a.weights[4],1);}
 assert.equal(seen.size,4);assert.equal(a.bob,0);
 const copy=structuredClone(a);advanceWizardAnimation(a,p,0);assert.deepEqual(a,copy);
 advanceWizardAnimation(a,{...p,vx:280},1/60);assert.equal(a.idle,false);assert.equal(a.idleTime,0);
 advanceWizardAnimation(a,{...p,cast:.3},1/60);assert.equal(a.idle,false);
});
