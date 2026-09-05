import assert from 'node:assert/strict';
import { CrownforgeSimulation } from '../src/simulation.js';
import { BUILDING_DEPTH } from '../src/building-depth-data.js';
import { BUILDING_TYPES, PRODUCTION_TYPES, UNIT_TYPES } from '../src/config.js';
import { outlineApproaches, distanceToOutline, buildingActorProfile } from '../src/building-geometry.js';

function quiet(){const s=new CrownforgeSimulation({seed:42});s.units=[];s.buildings=[];s.resourcesNodes=[];s.decorations=[];s.navigationVersion++;s._checkVictory=()=>{};s._updateEnemyAI=()=>{};s._updateEnemyIntent=()=>{};s._updateMilitaryServices=()=>{};s.resources={food:99999,wood:99999,stone:99999,gold:99999};return s;}
function step(s,seconds,check=()=>{}){for(let i=0;i<seconds*20;i++){s.update(.05);check();}}
let repairs=0,construction=0,recruitment=0;
for(const [type,art] of Object.entries(BUILDING_DEPTH)){
  if(art.kind!=='solid')continue;
  const buildable=Number.isFinite(BUILDING_TYPES[type].buildTime);
  const s=quiet(),building=s.addBuilding(type,180,180,'player',buildable ? .04 : 1),p=outlineApproaches(building,1.6)[0],worker=s.addUnit('villager',p.x,p.z,'player');
  s.selectedIds=[worker.id];s._syncSelectionFlags();
  if(buildable){
    assert(s.issueContextCommand(building,building).success,`${type}: construction order accepted`);
    step(s,50,()=>assert(distanceToOutline(worker,building,'foot')>=UNIT_TYPES.villager.radius-.02,`${type}: builder stays outside artwork`));
    assert.equal(building.progress,1,`${type}: construction completes`);
    construction++;
  }
  building.hp=building.maxHp*.55;
  assert(s.issueContextCommand(building,building).success,`${type}: repair order accepted`);
  step(s,75);assert.equal(building.hp,building.maxHp,`${type}: repair completes`);repairs++;
}
for(const [type,production] of Object.entries(PRODUCTION_TYPES)){
  const s=quiet(),building=s.addBuilding(production.building,180,180,'player');
  const point=s._findUnitSpawnPoint(building,type,0);
  assert(point&&!s._pointBlockedForUnit({type},point),`${type}: recruit has a clear spawn`);
  const unit=s.addUnit(type,point.x,point.z,'player');
  assert(distanceToOutline(unit,building,buildingActorProfile(unit))>=UNIT_TYPES[type].radius,`${type}: recruit is beyond the painted perimeter`);recruitment++;
}
for(const type of ['field','ashenField','road']){
  const s=quiet(),b=s.addBuilding(type,180,180,'player');
  assert.equal(s._buildingHasCollision(b),false,`${type}: keeps its passable ground behavior`);
}
console.log(`building-services-regression: ${construction} construction completions, ${repairs} repairs, ${recruitment} recruitment exits, and all walkable plots passed`);
