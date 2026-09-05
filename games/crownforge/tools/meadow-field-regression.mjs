import assert from 'node:assert/strict';
import {test} from 'node:test';
import {MeadowField,MEADOW_LIMITS,meadowWind} from '../src/meadow-field.js';
import {BUILDING_TYPES,CONFIG} from '../src/config.js';
import {CrownforgeSimulation} from '../src/simulation.js';

const bounds={minX:0,minZ:0,maxX:120,maxZ:120};
const field=(seed=42,width=120,height=120)=>new MeadowField({mapWidth:width,mapHeight:height,seed});
const scene=()=>({activeWorldSeed:42,navigationVersion:0,buildings:[],resourcesNodes:[],units:[]});
const snapshot=tufts=>tufts.map(t=>[t.id,t.x,t.z,t.variant,t.width,t.height]);

test('seeded meadow candidates are deterministic, camera-stable and organically varied',()=>{
  const a=field(),b=field(),first=a.visible(bounds,.65);
  assert.deepEqual(first,b.visible(bounds,.65));assert.equal(a.visible(bounds,.65),first,'stationary viewport reuses cached visible data');
  assert.ok(first.length>500);assert.equal(new Set(first.map(t=>t.id)).size,first.length);
  assert.equal(new Set(first.map(t=>t.variant)).size,12,'all twelve atlas families appear');
  assert.notDeepEqual(snapshot(first),snapshot(field(43).visible(bounds,.65)));
  const patch={minX:20,minZ:20,maxX:40,maxZ:40};
  const nearby=a.visible(patch,.65),known=new Map(first.map(t=>[t.id,t]));
  for(const tuft of nearby){const original=known.get(tuft.id);if(original)assert.deepEqual(tuft,original,'overlapping view keeps the same roots and source family');}
  for(const tuft of first){assert.ok(tuft.x>=0&&tuft.x<120&&tuft.z>=0&&tuft.z<120);assert.ok(tuft.height>=9&&tuft.height<=38);assert.ok(tuft.opacity>0&&tuft.opacity<=1);}
  assert.ok(first.some(t=>t.variant<=3&&t.height<=24)&&first.some(t=>t.variant>=4&&t.variant<=6&&t.height>28),'ordinary shin grass and occasional tall seed heads have separate proportions');
});

test('visible roots, far LOD, chunk cache and wide-map draw work remain bounded',()=>{
  const meadow=field(42,560,460),world={minX:-500,minZ:-500,maxX:900,maxZ:900};
  const close=meadow.visible(world,1.16);assert.equal(close.length,MEADOW_LIMITS.maxVisible);
  const stats=meadow.stats();assert.ok(stats.chunkCount<=MEADOW_LIMITS.maxChunks);assert.ok(stats.cachedTufts<=MEADOW_LIMITS.maxChunks*MEADOW_LIMITS.candidatesPerChunk);
  for(const tuft of close)assert.ok(tuft.x>=0&&tuft.x<560&&tuft.z>=0&&tuft.z<460);
  assert.deepEqual(meadow.visible(world,MEADOW_LIMITS.farZoom),[]);assert.equal(meadow.stats().visibleCount,0);
  const tiny=meadow.visible({minX:25,minZ:32,maxX:28,maxZ:35},1.16);
  for(const tuft of tiny)assert.ok(tuft.x>=25&&tuft.x<=28&&tuft.z>=32&&tuft.z<=35);
  const baseline=snapshot(meadow.visible({minX:0,minZ:0,maxX:24,maxZ:24},1.16));
  meadow.visible(world,.5);
  assert.deepEqual(snapshot(meadow.visible({minX:0,minZ:0,maxX:24,maxZ:24},1.16)),baseline,'world traversal does not move grass');
  const oversized=field(42,(MEADOW_LIMITS.maxChunks+2)*MEADOW_LIMITS.chunkSize,12),origin={minX:0,minZ:0,maxX:12,maxZ:12};
  const regenerated=snapshot(oversized.visible(origin,1.16));
  oversized.visible({minX:0,minZ:0,maxX:oversized.mapWidth,maxZ:12},.11);
  assert.equal(oversized.stats().chunkCount,MEADOW_LIMITS.maxChunks,'maps larger than the current world still enforce the LRU bound');
  const generated=oversized.stats().generatedChunks;
  assert.deepEqual(snapshot(oversized.visible(origin,1.16)),regenerated,'an evicted chunk regenerates identical roots and source families');
  assert.equal(oversized.stats().generatedChunks,generated+1,'the test actually exercises an evicted chunk');
  assert.throws(()=>new MeadowField({mapWidth:0,mapHeight:10}),RangeError);
});

test('actual building offsets, fields, roads, walls and persistent resource silhouettes exclude grass',()=>{
  const meadow=field(),sim=scene();meadow.sync(sim);
  const hall={id:1,type:'townCenter',x:45,z:45,destroyed:false},plot={id:2,type:'field',x:70,z:70,field:true},road={id:3,type:'road',x:30,z:30,road:true};
  const wall={id:4,type:'wall',x:90,z:80,wallSegments:5,wallDirection:{x:Math.SQRT1_2,z:Math.SQRT1_2}};
  sim.buildings.push(hall,plot,road,wall);sim.navigationVersion++;
  assert.equal(meadow.sync(sim),true,'building-only nav changes update exclusions even when tree count is unchanged');
  const offset=BUILDING_TYPES.townCenter.collisionOffset;
  assert.ok(meadow.excluded(hall.x+offset.x,hall.z+offset.z));assert.ok(meadow.excluded(70,70));assert.ok(meadow.excluded(30,30));
  assert.ok(meadow.excluded(94,84),'long oriented wall is covered');assert.equal(meadow.excluded(94,76),false,'diagonal wall does not erase grass from an entire square envelope');
  for(const tuft of meadow.visible(bounds,1))assert.equal(meadow.excluded(tuft.x,tuft.z),false);
  hall.destroyed=true;sim.navigationVersion++;meadow.sync(sim);assert.equal(meadow.excluded(hall.x+offset.x,hall.z+offset.z),false);
  const tree={id:5,type:'tree',resourceType:'wood',x:15,z:15,amount:240,forestClusterId:'livingwood'},berry={id:6,type:'berry',resourceType:'food',x:20,z:20,amount:0};
  sim.resourcesNodes.push(tree,berry);sim.navigationVersion++;meadow.sync(sim);assert.ok(meadow.excluded(15,15)&&meadow.excluded(20,20));
  tree.amount=0;sim.navigationVersion++;meadow.sync(sim);assert.equal(meadow.excluded(15,15),false,'depleted wood returns to meadow');assert.ok(meadow.excluded(20,20),'depleted berry bush is still drawn');
  sim.resourcesNodes=[{...berry,x:25,z:25}];meadow.sync(sim);assert.equal(meadow.excluded(20,20),false);assert.ok(meadow.excluded(25,25),'resource-array replacement updates same-count layouts');
});

test('forest coverage and world reload change habitat without consuming or mutating simulation state',()=>{
  const sim=new CrownforgeSimulation({seed:42}),meadow=new MeadowField({mapWidth:CONFIG.mapWidth,mapHeight:CONFIG.mapHeight,seed:42});
  const before=sim.serialize();meadow.sync(sim);meadow.visible({minX:50,minZ:50,maxX:120,maxZ:120},.7);meadow.update(sim.units,1,.016);
  assert.deepEqual(sim.serialize(),before,'terrain presentation leaves full gameplay/save state untouched');
  const blank=scene(),open=field();open.sync(blank);const a=open.visible(bounds,.7).length;
  const cover=new Float32Array(120*120).fill(.8);open.sync(blank,cover);const b=open.visible(bounds,.7).length;assert.ok(b<a*.4,'dense forest suppresses meadow tufts');
  cover.fill(0);blank.navigationVersion++;assert.equal(open.sync(blank,cover),true);
  assert.equal(open.visible(bounds,.7).length,a,'navigation change refreshes habitat even if the supplied forest-mask object is reused');
  blank.activeWorldSeed=91;assert.equal(open.sync(blank,cover),true);assert.equal(open.seed,91);assert.equal(open.stats().chunkCount,0,'new world seed discards old generated chunks');
});

test('passage uses observed movement, stamps broader hoof contacts, and springs back without permanent scars',()=>{
  function move(type){const m=field(),u={id:1,type,x:20,z:20,motionSpeed:4,velocityX:4,velocityZ:0};m.update([u],0,.1);u.x=20.4;m.update([u],.1,.1);return{m,u};}
  const{m,u}=move('villager'),tuft={x:20.4,z:20,phase:0};const immediate=m.displacement(tuft,.1);assert.ok(immediate.press>.35&&Math.abs(immediate.bend)>.1);
  const count=m.stats().disturbanceCount;const frozen=Object.freeze({...u});m.update([frozen],.2,.1);assert.equal(m.stats().disturbanceCount,count,'blocked velocity without position progress makes no new track');
  assert.ok(m.displacement(tuft,.9).press<immediate.press*.2,'contact recovers analytically with elapsed time');
  m.update([frozen],4,.1);assert.deepEqual(m.displacement(tuft,4),{bend:0,press:0});assert.equal(m.stats().disturbanceCount,0);assert.equal(m.stats().interactionBins,0);
  const hoof=move('scout').m,far={x:20.4,z:21.3};assert.equal(move('villager').m.displacement(far,.1).press,0);assert.ok(hoof.displacement(far,.1).press>0,'horse hooves disturb a broader patch');
  const ashen=move('ashenOutrider').m;assert.ok(ashen.displacement(far,.1).press>0,'both mounted identities share hoof response');
  assert.equal(meadowWind(tuft,2,{reducedMotion:true}),0);assert.equal(meadowWind(tuft,2,{enabled:false}),0);assert.ok(Math.abs(meadowWind(tuft,2))<=.16,'ambient motion is independent of contact');
});

test('teleports, elevated/dead actors, clock resets and stress populations cannot create unbounded wakes',()=>{
  const meadow=field(42,560,460),u={id:1,type:'villager',x:20,z:20};meadow.update([u],0,.1);u.x=60;meadow.update([u],.1,.1);assert.equal(meadow.stats().disturbanceCount,0,'teleports do not flatten a long stripe');
  meadow.update([{...u,x:60.3,dead:true},{id:2,type:'soldier',x:30,z:30,stairProgress:1}],.2,.1);assert.equal(meadow.stats().disturbanceCount,0);
  const units=Array.from({length:2000},(_,i)=>({id:i,type:i%2?'scout':'villager',x:5+(i%100)*5,z:5+Math.floor(i/100)*5}));
  meadow.update(units,1,.1);for(const actor of units)actor.x+=.4;meadow.update(units,1.1,.1);
  assert.ok(meadow.stats().disturbanceCount>100,'bounded tracking still records active actors beyond the population cap');
  assert.ok(meadow.stats().trackedUnits<=MEADOW_LIMITS.maxUnits);assert.ok(meadow.stats().disturbanceCount<=MEADOW_LIMITS.maxDisturbances);assert.ok(meadow.stats().interactionBins<=MEADOW_LIMITS.maxDisturbances);
  for(const tuft of [{x:500,z:50},{x:10,z:10}]){const d=meadow.displacement(tuft,1.1);assert.ok(d.press>=0&&d.press<=1&&d.bend>=-1&&d.bend<=1);}
  meadow.update([],0,.1);assert.equal(meadow.stats().disturbanceCount,0);assert.equal(meadow.stats().trackedUnits,0,'clock rewind clears obsolete motion state');
});

test('real simulation ticks retain passage and cached exclusions despite fresh unit/building array wrappers',()=>{
  const sim=new CrownforgeSimulation({seed:42}),meadow=new MeadowField({mapWidth:CONFIG.mapWidth,mapHeight:CONFIG.mapHeight,seed:42});
  const worker=sim.units.find(unit=>unit.type==='villager'&&unit.faction==='player');worker.x=30;worker.z=30;
  sim.selectEntity(worker);assert.equal(sim.issueContextCommand({x:45,z:30}).success,true);
  meadow.sync(sim);meadow.update(sim.units,0,1/60);
  const view={minX:20,minZ:20,maxX:60,maxZ:50},tufts=meadow.visible(view,.65),revision=meadow.revision,nav=sim.navigationVersion;
  let activeFrames=0;
  for(let tick=1;tick<=120;tick++){
    const previousUnits=sim.units,previousBuildings=sim.buildings;sim.update(1/60);
    assert.notEqual(sim.units,previousUnits,'the real simulation replaces the unit array wrapper');
    assert.notEqual(sim.buildings,previousBuildings,'the real simulation replaces the building array wrapper');
    assert.equal(sim.navigationVersion,nav,'ordinary travel leaves navigation unchanged');
    assert.equal(meadow.sync(sim),false,'wrapper churn must not rebuild exclusions or clear motion');
    meadow.update(sim.units,tick/60,1/60);
    assert.equal(meadow.visible(view,.65),tufts,'ordinary ticks keep the same visible cache');
    if(meadow.stats().disturbanceCount>0)activeFrames++;
  }
  assert.ok(worker.x>35,'worker actually travels across the meadow');assert.ok(activeFrames>=110,'grass response persists across successive real simulation ticks');
  assert.equal(meadow.revision,revision);assert.ok(meadow.displacement({x:worker.x,z:worker.z},2).press>.2,'current moving foot visibly compresses grass');
  const saved=sim.serialize();for(const unit of sim.units)unit.dead=true;
  meadow.update(sim.units,2.01,.01);assert.equal(meadow.stats().trackedUnits,0);assert.ok(meadow.stats().disturbanceCount>0,'a short-lived wake can outlive its actor');
  assert.equal(sim.loadSnapshot(saved),true);meadow.sync(sim);
  assert.equal(meadow.stats().disturbanceCount,0,'same-seed snapshot load also clears lingering wakes when no tracks remain');
});

test('low-zoom panning reuses the bounded world cache and skips invisible grass generation',()=>{
  const meadow=field(42,560,460),first={minX:42,minZ:-8,maxX:518,maxZ:468};
  meadow.visible(first,.11);const initial=meadow.stats().generatedChunks;
  assert.ok(initial>MEADOW_LIMITS.maxChunks/2,'test traverses the wide view that exceeded the old 512-chunk cache');
  for(let i=1;i<=15;i++)meadow.visible({minX:first.minX+i*.35,minZ:first.minZ-i*.35,maxX:first.maxX+i*.35,maxZ:first.maxZ-i*.35},.11);
  assert.ok(meadow.stats().generatedChunks-initial<=78,'small pans only generate newly exposed edge chunks');
  assert.ok(meadow.stats().chunkCount<=MEADOW_LIMITS.maxChunks);
  const invisible=field(42,560,460);assert.deepEqual(invisible.visible(first,.096),[]);assert.equal(invisible.stats().generatedChunks,0,'opacity below the draw threshold does not traverse the world');
});
