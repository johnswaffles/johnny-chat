import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CrownforgeSimulation} from '../src/simulation.js';
for(const seed of [42,7,12345])test(`expanded starting reserve fits three large observatories, seed ${seed}`,()=>{
 const s=new CrownforgeSimulation({seed});
 for(const point of [{x:150,z:90},{x:135,z:150},{x:75,z:165}]){
  const preview=s.getBuildingPlacementPreview('observatory',point);assert(preview.valid,preview.reason);
  s.addBuilding('observatory',point.x,point.z,'player',1);
 }
 assert(s.resourcesNodes.some(n=>n.type==='tree'&&n.amount>0));
 assert(s.resourcesNodes.some(n=>n.type==='gold'&&n.x===111&&n.z===72));
 assert(s.resourcesNodes.some(n=>n.type==='stone'&&n.x===109&&n.z===99));
});
test('old saves clear only generated starting trees and release their workers',()=>{
 const s=new CrownforgeSimulation({seed:42});
 const tree=s.addResource('tree','wood',160,90,240,0,{forestClusterId:'legacy-forest'});
 const distant=s.addResource('tree','wood',400,300,240,0,{forestClusterId:'legacy-forest'});
 const worker=s.units.find(u=>u.type==='villager');worker.gatherTarget=tree.id;worker.command='gather';
 const saved=s.serialize(),r=new CrownforgeSimulation({seed:7});assert(r.loadSnapshot(saved));
 assert(!r.resourcesNodes.some(n=>n.id===tree.id));assert(r.resourcesNodes.some(n=>n.id===distant.id));
 const restored=r.units.find(u=>u.id===worker.id);assert.equal(restored.gatherTarget,null);assert.equal(restored.command,'idle');
 assert.deepEqual(r.buildings.map(b=>b.id),s.buildings.map(b=>b.id));assert.deepEqual(r.resources,s.resources);
 const deposits=s.resourcesNodes.filter(n=>n.resourceType!=='wood').map(n=>n.id);
 assert.deepEqual(r.resourcesNodes.filter(n=>n.resourceType!=='wood').map(n=>n.id),deposits);
});
