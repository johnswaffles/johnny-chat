import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mountedPose, mountedActions } from '../src/mounted-motion.js';
import { mountedHoofTransform, mountedPaintOrder } from '../src/hearthkin-rig.js';
import scout from '../src/roster-art/crown-scout.js';
import outrider from '../src/roster-art/ashen-outrider.js';
const mounts={scout,ashenOutrider:outrider};

const views=['front','right','back','left'];
const transform=(t,p)=>({x:t.origin.x+(p[0]-t.root[0])*t.across.x+(p[1]-t.root[1])*t.down.x,y:t.origin.y+(p[0]-t.root[0])*t.across.y+(p[1]-t.root[1])*t.down.y});
const near=(a,b,label)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-8,label);

test('painted fetlock and supporting sole remain attached in every mounted view',()=>{
  for(const [type,mount] of Object.entries(mounts)){
  const actions=mountedActions(type);
  for(const state of ['idle','walk','attack','hit','stunned','death'])for(let direction=0;direction<4;direction++)for(let sample=0;sample<=80;sample++){
    const pose=mountedPose(type,state,actions[state].duration*sample/80,direction),art=mount.mount.views[views[direction]];
    for(let index=14;index<18;index++){
      const t=mountedHoofTransform(pose,index,art),label=`${type}/${state}/${direction}/${sample}/${index}`;
      near(transform(t,t.root),t.origin,`fetlock ${label}`);
      near(transform(t,t.support),t.target,`sole support ${label}`);
      for(const key of ['heel','toe'])assert.ok(transform(t,art.anchors[index][key]).y<=t.ground.y+1e-8,`sole penetrates floor ${label}`);
      if(Math.abs(t.angle)<1e-10)near(transform(t,t.sole),t.ground,`flat sole ${label}`);
    }
  }
  }
});

test('horse rear layers put the distant neck behind the rump and near tail in front',()=>{
  for(let direction=0;direction<4;direction++){
    const pose=mountedPose('scout','idle',0,direction),order=mountedPaintOrder(pose);
    const all=[...order.behind,...order.ahead];
    assert.equal(new Set(all).size,all.length,'no double-drawn horse part');
    for(const hoof of [14,15,16,17])assert.ok(all.includes(hoof));
    if(direction===2){
      for(const part of [1,18,0])assert.ok(order.behind.includes(part),'rear neck/head belongs behind barrel');
      assert.ok(order.ahead.includes(3),'rear tail belongs ahead of barrel');
    }else{
      assert.ok(order.behind.includes(3),'tail stays behind horse from front/profile');
      if(direction===0)for(const part of [1,18,0])assert.ok(!all.includes(part),'front neck is deferred until after rider');
    }
  }
});

test('hoof ground anchors use the measured painted floor instead of a generic93percent row',()=>{
  for(const mount of Object.values(mounts))for(const view of views)for(let index=14;index<18;index++){
    const a=mount.mount.views[view].anchors[index];
    assert.ok(a.sole[1]>.97&&a.sole[1]<=1,`${view}/${index} needs the actual bottom of its painted hoof`);
    assert.equal(a.heel[1],a.sole[1]);assert.equal(a.toe[1],a.sole[1]);
    if(view==='right')assert.ok(a.heel[0]<a.toe[0]);
    if(view==='left')assert.ok(a.heel[0]>a.toe[0]);
  }
});
