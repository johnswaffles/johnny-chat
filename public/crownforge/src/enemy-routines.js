import { CONFIG, RESOURCE_TYPES } from './config.js?v=20260911-defiance1';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

export function assignEnemyEconomy(sim) {
  const workers=sim._enemyWorkers();
  for(const worker of workers){
    if(worker.stunTimer>0||worker.command==='attack')continue;
    const building=sim.buildings.find(b=>b.id===worker.buildTarget);
    const atBuild=building&&sim._distanceToBuildingUnitEdge(worker,building)<.9;
    const field=sim.buildings.find(b=>b.id===worker.fieldTarget);
    const atField=field&&sim._distanceToBuildingUnitEdge(worker,field)<.7;
    const mark=[worker.carryAmount,atBuild?building.progress:0,atBuild?building.hp:0,atField?field.fieldTimer:0].join('|');
    // Small collision oscillations do not count as making progress on a job.
    if(mark!==worker.economyProgress||!worker.economyProgressPoint||distance(worker,worker.economyProgressPoint)>1.5){
      worker.economyProgress=mark;worker.economyProgressAt=sim.clock;worker.economyProgressPoint={x:worker.x,z:worker.z};
    }
    const stalled=sim.clock-(worker.economyProgressAt??sim.clock)>=8;
    if(worker.carryAmount){
      if(worker.command==='idle'||stalled){sim._beginReturn(worker);worker.economyProgressAt=sim.clock;}
      continue;
    }
    if(worker.command!=='idle'&&!worker.safetyRegroupActive&&!stalled)continue;
    if(worker.fieldTarget&&!stalled)continue;
    worker.economyAvoid??={};
    worker.economyBuildAvoid??={};
    for(const [id,until] of Object.entries(worker.economyAvoid))if(until<=sim.clock)delete worker.economyAvoid[id];
    for(const [id,until] of Object.entries(worker.economyBuildAvoid))if(until<=sim.clock)delete worker.economyBuildAvoid[id];
    if(stalled&&worker.gatherTarget)worker.economyAvoid[worker.gatherTarget]=sim.clock+30;
    if(stalled&&worker.buildTarget)worker.economyBuildAvoid[worker.buildTarget]=sim.clock+30;
    sim._interruptWork(worker);worker.command='idle';worker.path=[];
    // Resume unfinished work after an interrupted builder, leaving at least
    // half the workforce available to gather supplies.
    if(workers.filter(u=>u.command==='build').length<Math.max(1,Math.floor(workers.length/2))){
      const projects=sim._enemyTownBuildings().filter(b=>sim.buildingNeedsWork(b)&&!worker.economyBuildAvoid[b.id])
        .sort((a,b)=>distance(worker,a)-distance(worker,b));
      for(const project of projects.slice(0,3)){
        worker.buildTarget=project.id;
        if(sim._sendUnitToBuilding(worker,project,worker.id%8))break;
        worker.economyBuildAvoid[project.id]=sim.clock+15;worker.buildTarget=null;
      }
      if(worker.command==='build'){worker.economyProgressAt=sim.clock;continue;}
    }
    for(const resourceType of sim._enemyResourcePriority(worker)){
      if(sim.enemyResources[resourceType]>=RESOURCE_TYPES[resourceType].capacity)continue;
      const node=sim._assignResourceWork(worker,{resourceType,origin:worker,radius:140,maxCandidates:20,persistent:false,excludeNodeIds:Object.keys(worker.economyAvoid).map(Number)});
      if(node){worker.economyProgressAt=sim.clock;break;}
    }
    if(worker.command==='idle')worker.actionLabel='Looking for reachable supplies';
  }
}

function perimeterPoints(sim,unit,camp) {
  const buildings=sim._enemyTownBuildings(),bounds=buildings.map(b=>sim._buildingEntityBounds(b));
  const minX=Math.min(...bounds.map(b=>b.minX)),maxX=Math.max(...bounds.map(b=>b.maxX));
  const minZ=Math.min(...bounds.map(b=>b.minZ)),maxZ=Math.max(...bounds.map(b=>b.maxZ));
  const center={x:(minX+maxX)/2,z:(minZ+maxZ)/2},points=[];
  for(let i=0;i<16;i++){
    const angle=i/16*Math.PI*2;
    for(const margin of [4,7,1.8]){
      const point={x:center.x+Math.cos(angle)*((maxX-minX)/2+margin),z:center.z+Math.sin(angle)*((maxZ-minZ)/2+margin)};
      if(point.x<1||point.z<1||point.x>CONFIG.mapWidth-1||point.z>CONFIG.mapHeight-1||sim._pointBlockedForUnit(unit,point))continue;
      points.push(point);break;
    }
  }
  // Narrow woodland clearings may expose only one side of the outer ring.
  // Add open points near that edge so guards still cover their perimeter.
  if(points.length<3)for(let i=0;i<12;i++){
    const angle=i/12*Math.PI*2,point={x:unit.x+Math.cos(angle)*6,z:unit.z+Math.sin(angle)*6};
    if(distance(point,camp)<55&&!sim._pointBlockedForUnit(unit,point))points.push(point);
  }
  return points;
}

export function assignEnemyPatrols(sim,camp) {
  let budget=2;
  for(const unit of sim._enemyMilitary()){
    if(budget<=0)break;
    if(unit.stunTimer>0||unit.command==='attack'||unit.orderQueue?.length)continue;
    if(unit.patrolActive&&unit.path.length&&!unit.recoveryAvailable)continue;
    if(unit.command==='move'&&!unit.patrolActive&&!unit.recoveryAvailable)continue;
    const points=perimeterPoints(sim,unit,camp);
    const start=(unit.id+(unit.enemyPatrolAttempt??0))%Math.max(1,points.length);
    const ordered=[...points.slice(start),...points.slice(0,start)];
    const route=[];
    for(const point of ordered){
      if(route.length>=4)break;
      if(route.length&&distance(route.at(-1),point)<4)continue;
      if(sim._buildPath(unit,point))route.push(point);
    }
    unit.enemyPatrolAttempt=(unit.enemyPatrolAttempt??0)+1;
    budget--;
    if(route.length<2)continue;
    sim._interruptWork(unit);
    unit.patrolPoints=route;unit.patrolIndex=0;unit.patrolActive=true;
    if(sim._sendUnitTo(unit,route[0],'move'))unit.actionLabel='Patrolling the Ashen perimeter';
    else unit.patrolActive=false;
  }
}
