import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CHARACTER_RIGS } from '../src/character-rigs.js';
import { UNIT_TYPES } from '../src/config.js';
import { ANIMATION_DEFINITIONS } from '../src/animation.js';
import { militaryActions, militaryPose, FOOT_MILITARY_TYPES } from '../src/military-motion.js';
import { mountedActions, mountedPose, MOUNTED_TYPES } from '../src/mounted-motion.js';
import { equipmentGeometry } from '../src/character-equipment.js';
import { HearthkinRig, hearthkinHandTransform, hearthkinPalmSocket } from '../src/hearthkin-rig.js';
import { projectHearthkin } from '../src/hearthkin-locomotion.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z??0)-(b.z??0));
const close=(a,b,epsilon,label)=>assert.ok(Math.abs(a-b)<=epsilon,`${label}: ${a} vs ${b}`);
const roster=Object.keys(UNIT_TYPES);
if(!process.argv.includes('--partial'))assert.deepEqual(Object.keys(CHARACTER_RIGS).sort(),roster.sort(),'Every current unit must own a new production rig');
let cases=0,poses=0,grips=0,hoofContacts=0;
for(const [type,rig] of Object.entries(CHARACTER_RIGS)) {
  const required=UNIT_TYPES[type].worker?['idle','walk','gather_wood','gather_food','field_work','gather_stone','gather_gold','construct','repair','demolish','carry_wood','carry_food','carry_stone','carry_gold','carry_supplies','attack','attack_anticipation','attack_contact','attack_recovery','hit','ward_block','stunned','death']:['idle','walk','attack','attack_anticipation','attack_contact','attack_recovery','hit','death',...(UNIT_TYPES[type].traits?.includes('humanoid')?['stunned']:[])];
  for(const state of required)assert.ok(rig.actions[state],`${type} required ${state}`);
  assert.equal(ANIMATION_DEFINITIONS[type].renderer,'skeletal',`${type} production renderer`);
  for(const state of Object.keys(rig.actions))assert.ok(ANIMATION_DEFINITIONS[type].clips[state]?.skeletal,`${type}/${state} cannot fall back`);
  // Exercise the production transition path before its rendering readiness
  // gate. A screen-only blend used to split work hands from body/tool frames
  // during the first110ms, despite every isolated pose passing its checks.
  const transitionRig=Object.assign(Object.create(HearthkinRig.prototype),{definition:rig,handFrames:rig.hands,transitions:new WeakMap(),part:()=>null});
  for(let direction=0;direction<4;direction++)for(const state of Object.keys(rig.actions)) {
    const unit={id:3,kind:'unit',motionSpeed:1,facing:direction,animationState:'walk',animationTime:rig.actions.walk.duration*.3,animClock:1};
    transitionRig.draw(null,unit,{x:0,y:0},100);
    unit.animationState=state;unit.animationTime=rig.actions[state].duration*.4;unit.animClock+=.025;
    transitionRig.draw(null,unit,{x:0,y:0},100);
    const p=transitionRig.transitions.get(unit).pose,expected=rig.samplePose(state,unit.animationTime,direction,{id:3,moving:true,carryType:null});
    if(p.projectedWork||p.bodyFrame)for(const key of ['leftHand','rightHand','leftElbow','rightElbow','leftShoulder','rightShoulder','waist','neck']) {
      assert.deepEqual(p[key],expected[key],`${type}/${state} transition retains the complete physical pose`);
    }
  }
  for(const collection of [rig.views,rig.mount?.views].filter(Boolean)) {
    assert.equal(new Set(['front','right','back','left'].map(view=>collection[view]?.src)).size,4,`${type} four independent authored views`);
    for(const [view,art] of Object.entries(collection)) {
      const bytes=fs.readFileSync(new URL('../'+art.src.split('?')[0],import.meta.url));
      assert.equal(bytes[25],6,`${type}/${view} true RGBA`);
      assert.equal(bytes.readUInt32BE(16),art.width);assert.equal(bytes.readUInt32BE(20),art.height);
      if(['front','right','back','left'].includes(view))assert.equal(art.parts.length,collection===rig.mount?.views?20:16);
      else assert.ok(art.parts.length>0,`${type}/${view} auxiliary cutouts`);
      for(const [x,y,w,h] of art.parts)assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=art.width&&y+h<=art.height,`${type}/${view} cutout bounds`);
    }
  }
  for(const [state,action] of Object.entries(rig.actions)) {
    cases+=4;
    for(let dir=0;dir<4;dir++)for(let i=0;i<=80;i++) {
      const p=rig.samplePose(state,action.duration*i/80,dir,{id:3});poses++;
      p.handFrames=rig.hands;
      for(const q of Object.values(p.anatomical))assert.ok([q.x,q.y,q.z].every(Number.isFinite),`${type}/${state} finite anatomy`);
      for(const side of ['left','right']) {
        for(const [a,b,n] of [['Shoulder','Elbow',17],['Elbow','Hand',16]])close(distance(p.anatomical[side+a],p.anatomical[side+b]),n,1e-6,`${type}/${state}/${side} ${a}-${b}`);
        const {frame,width,height,angle}=hearthkinHandTransform(p,side==='left');
        const wrist=p[side+'Hand'],x=(frame.grip[0]-frame.root[0])*width,y=(frame.grip[1]-frame.root[1])*height;
        const grip={x:wrist.x+x*Math.cos(angle)-y*Math.sin(angle),y:wrist.y+x*Math.sin(angle)+y*Math.cos(angle)};
        close(distance(grip,hearthkinPalmSocket(p,side==='left')),0,1e-6,`${type}/${state} painted ${side} grip`);grips++;
      }
      if(p.toolFrame) {
        const g=equipmentGeometry(p.toolFrame,dir);
        assert.ok(g.faces.length>0,`${type}/${state} solid equipment visible`);
        if(p.projectedWork)close(distance(g.world.grip,p.anatomical.rightPalm),0,1e-7,`${type}/${state} physical right-hand tool`);
        assert.ok(g.faces.every(f=>f.points.every(q=>Number.isFinite(q.x)&&Number.isFinite(q.y))),`${type}/${state} finite tool geometry`);
      }
      if(i===24&&dir>0)assert.deepEqual(p.anatomical,rig.samplePose(state,action.duration*i/80,0,{id:3}).anatomical,`${type}/${state} one body observed from four cameras`);
    }
    if(action.loop!==false) {
      const a=rig.samplePose(state,0,0,{id:3}),b=rig.samplePose(state,action.duration-1e-7,0,{id:3});
      for(const key of ['hip','neck','leftHand','rightHand','leftElbow','rightElbow'])close(distance(a[key],b[key]),0,.002,`${type}/${state}/${key} loop seam`);
      close(a.braidSway,b.braidSway,.002,`${type}/${state} costume loop seam`);
    }
  }
  for(let dir=0;dir<4;dir++) {
    const d=rig.actions.death.duration,a=rig.samplePose('death',d,dir),b=rig.samplePose('death',d+10,dir);
    assert.deepEqual(a.anatomical,b.anatomical,`${type} holds the fallen body`);
    assert.deepEqual(a.droppedToolFrame,b.droppedToolFrame,`${type} holds the dropped weapon`);
  }
}

// Test all pure motion families even while new surfaces are being authored.
for(const type of [...FOOT_MILITARY_TYPES,...MOUNTED_TYPES]) {
  const mounted=MOUNTED_TYPES.includes(type),actions=mounted?mountedActions(type):militaryActions(type),sample=mounted?mountedPose:militaryPose;
  for(const state of Object.keys(actions)) {
    let previous=null;
    for(let i=0;i<=1200;i++) {
      const p=sample(type,state,actions[state].duration*i/1200,0);
      for(const side of ['left','right']) {
        if(previous)assert.ok(distance(p.anatomical[side+'Elbow'],previous.anatomical[side+'Elbow'])<1.7,`${type}/${state} elbow changes continuously`);
      }
      if(mounted) {
        const h=p.mount.anatomical;
        for(const leg of ['frontLeft','frontRight','hindLeft','hindRight']) {
          const links=leg.startsWith('front')?[['Shoulder','Knee',21.65],['Knee','Fetlock',21.65]]:[['Hip','Stifle',17],['Stifle','Hock',17],['Hock','Fetlock',17]];
          for(const [a,b,n] of links)close(distance(h[leg+a],h[leg+b]),n*p.mount.scale,1e-6,`${type}/${state}/${leg} ${a}-${b}`);
        }
      }
      if(mounted&&state==='walk') {
        assert.ok(p.mountGroundContacts.filter(c=>c.planted).length>=2,`${type} walking horse retains support`);
        for(const c of p.mountGroundContacts.filter(c=>c.planted)){close(c.world.y,0,1e-7,`${type} planted hoof on ground`);hoofContacts++;}
        for(const side of ['left','right'])close(distance(p[side+'Foot'].point,projectHearthkin(p.mount.stirrups[side],0)),0,1e-7,`${type} boot attached to stirrup`);
      }
      previous=p;
    }
  }
  const a=actions.attack_anticipation.duration,c=actions.attack_contact.duration,r=actions.attack_recovery.duration;
  for(const [first,last,time] of [['attack_anticipation','attack_contact',a],['attack_contact','attack_recovery',c]]) {
    const p=sample(type,first,time,0),q=sample(type,last,0,0);
    for(const side of ['left','right'])close(distance(p.anatomical[side+'Palm'],q.anatomical[side+'Palm']),0,1e-7,`${type} attack phase joins`);
  }
  const timing=UNIT_TYPES[type].attackTiming??{anticipation:.25,contact:.45,recovery:.3};
  close(a,UNIT_TYPES[type].cooldown*timing.anticipation,1e-9,`${type} simulation anticipation`);
  close(c,UNIT_TYPES[type].cooldown*timing.contact,1e-9,`${type} simulation contact`);
  close(r,UNIT_TYPES[type].cooldown*timing.recovery,1e-9,`${type} simulation recovery`);
}
console.log(`PASS: ${Object.keys(CHARACTER_RIGS).length}/${roster.length} production rigs, ${cases} directional state cases, ${poses} poses, ${grips} painted grips; 10 military/mounted motion families, ${hoofContacts} grounded hoof samples. Visible review remains separate.`);
