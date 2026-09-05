import assert from 'node:assert/strict';
import { CrownforgeSimulation } from '../src/simulation.js';
import { BUILDING_DEPTH } from '../src/building-depth-data.js';
import { BUILDING_TYPES, UNIT_TYPES } from '../src/config.js';
import { outlineApproaches, distanceToOutline, buildingActorProfile, projectOutsideOutline } from '../src/building-geometry.js';

function quiet(){const s=new CrownforgeSimulation({seed:42});s.units=[];s.buildings=[];s.resourcesNodes=[];s.decorations=[];s._checkVictory=()=>{};s._updateEnemyAI=()=>{};s._updateEnemyIntent=()=>{};s._updateMilitaryServices=()=>{};s.navigationVersion++;return s;}
const solids=Object.entries(BUILDING_DEPTH).filter(([,a])=>a.kind==='solid').map(([id])=>id);
let routes=0;
for(const type of solids) {
  const s=quiet(),b=s.addBuilding(type,180,180,'player');
  for(const unitType of ['villager','scout']) {
    s.units=[];const profile=buildingActorProfile(unitType),points=outlineApproaches(b,2.5,unitType);
    const unit=s.addUnit(unitType,points[0].x,points[0].z,'player');
    assert(!s._pointBlockedForUnit(unit,unit),`${type}: ${unitType} front station is usable`);
    assert(s._sendUnitTo(unit,points[7],'move'),`${type}: ${unitType} can route from entrance to rear`);
    s.setUnitSpeedScale(10);
    let arrived=false;
    for(let i=0;i<1600;i++) {
      s.update(.05);
      assert(distanceToOutline(unit,b,profile)>=UNIT_TYPES[unitType].radius-.02,`${type}: ${unitType} entered artwork while routing`);
      if(Math.hypot(unit.x-points[7].x,unit.z-points[7].z)<1){arrived=true;break;}
    }
    assert(arrived,`${type}: ${unitType} reaches the far side`);routes++;
    const interior={x:b.x+BUILDING_TYPES[type].collisionOffset.x,z:b.z+BUILDING_TYPES[type].collisionOffset.z};
    const exit=projectOutsideOutline(interior,b,.8,profile);
    assert(exit&&distanceToOutline(exit,b,profile)>.79,`${type}: old interior foot positions can be cleared safely`);
  }
}
const opening=new CrownforgeSimulation({seed:42});
assert(opening.units.every(u=>!opening._pointBlockedForUnit(u,u)),'opening actors are outside all buildings');
console.log(`building-depth-regression: ${solids.length} solid buildings, ${routes} complete foot/mounted routes passed`);
