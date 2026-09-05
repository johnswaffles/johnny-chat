import assert from 'node:assert/strict';
import { CrownforgeSimulation } from '../src/simulation.js';
import { polygonsOverlap } from '../src/building-geometry.js';

function quiet() {
  const s = new CrownforgeSimulation({seed:42});
  s.buildings=[]; s.units=[]; s.resourcesNodes=[]; s.decorations=[];
  s.resources={food:99999,wood:99999,stone:99999,gold:99999};
  for (const method of ['_checkVictory','_updateEnemyAI','_updateEnemyIntent','_updateMilitaryServices','_updateWorkerServices']) s[method]=()=>{};
  s.navigationVersion++;
  return s;
}
let crossings=0;
for (const d of [{x:1,z:0},{x:0,z:1},{x:Math.SQRT1_2,z:-Math.SQRT1_2},{x:Math.SQRT1_2,z:Math.SQRT1_2}]) {
  const s=quiet();
  s.addBuilding('wall',200,200,'player',1,{wallSegments:21,wallDirection:d,wallStart:{x:200-30*d.x,z:200-30*d.z}});
  const builder=s.addUnit('villager',240,240,'player'); s.selectedIds=[builder.id]; s._syncSelectionFlags();
  const preview=s.getBuildingPlacementPreview('gate',{x:200,z:200});
  assert(preview.valid); assert(s.placeBuilding('gate',preview.world,preview));
  const gate=s.buildings.find(b=>b.type==='gate');
  s.buildings=s.buildings.filter(b=>!b.destroyed); s.navigationVersion++;
  assert(s._pointBlockedForUnit(builder,gate),'unfinished gate remains a construction obstacle');
  gate.progress=1; s.navigationVersion++;
  for (const type of ['villager','scout']) {
    s.units=[];
    const u=s.addUnit(type,200-d.z*10,200+d.x*10,'player'), target={x:200+d.z*10,z:200-d.x*10};
    assert(!s._pointBlockedForUnit(u,gate),`${type}: completed gate has enough width`);
    assert(s._sendUnitTo(u,target,'move'));
    let closest=Infinity; s.setUnitSpeedScale(10);
    for(let i=0;i<1200&&Math.hypot(u.x-target.x,u.z-target.z)>1;i++) {
      s.update(.05); closest=Math.min(closest,Math.hypot(u.x-200,u.z-200));
      assert(!s._pointBlockedForUnit(u,u),`${type}: stays clear of the adjoining wall`);
    }
    assert(Math.hypot(u.x-target.x,u.z-target.z)<1,`${type}: crosses the gate`);
    assert(closest<1,`${type}: uses the opening rather than going around the wall`); crossings++;
  }
}
// A large isometric building can overlap another's axis-aligned bounding box
// while both painted outlines have ample space between them.
const s=quiet(), a=s.addBuilding('palisadeTower',220,220,'player');
const b={type:'palisadeTower',x:234.58,z:205.42};
assert(s._boundsOverlap(s._buildingEntityBounds(a),s._buildingEntityBounds(b)));
assert(!polygonsOverlap(s._placementPolygon(a),s._placementPolygon(b),.4));
assert(polygonsOverlap(s._placementPolygon(a),s._placementPolygon({...b,x:a.x,z:a.z}),.4));
console.log(`building-defense-regression: ${crossings} foot/mounted gate crossings, unfinished gate blocking, and precise placement passed`);
