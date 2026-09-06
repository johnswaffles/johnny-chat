import { CONFIG, UNIT_TYPES } from './config.js?v=20260906-wildwoodwatch2';

export const GRIZZLY_ENCOUNTER = Object.freeze({ interval: 300, scanInterval: .8, retryInterval: 1, spawnRouteBudget: 4, huntRouteBudget: 3 });
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const people = sim => sim.units.filter(unit => !unit.dead && (unit.faction === 'player' || unit.faction === 'enemy'));
export const initialWildlifeState = clock => ({ nextSpawnAt: (Math.floor(Math.max(0,clock)/300)+1)*300, spawnCount: 0, scanClock: 0, spawnCursor: 0 });

// Spawn on a real woodland edge with a legal route to a person. Never move
// existing trees, buildings or people to make an encounter fit.
export function spawnGrizzly(sim) {
  const state=sim.wildlifeState, humans=people(sim);
  if (!humans.length) return null;
  const preferred=state.spawnCount%2 ? 'enemy' : 'player';
  const audience=humans.filter(unit=>unit.faction===preferred);
  const target=(audience.length?audience:humans)[state.spawnCount%(audience.length||humans.length)];
  const probe={id:-1,type:'grizzly',kind:'unit',faction:'wildlife',x:target.x,z:target.z,attackSlot:0,stairAccess:false};
  const radii=[20,28,38,52,72,95], count=radii.length*32;
  let routes=0;
  for(let step=0;step<count;step++) {
    const index=state.spawnCursor++%count;
    const angle=(index%32)/32*Math.PI*2+((sim.activeWorldSeed??42)%31)*.07;
    const radius=radii[Math.floor(index/32)];
    const point={x:target.x+Math.cos(angle)*radius,z:target.z+Math.sin(angle)*radius};
    if(point.x<2||point.z<2||point.x>CONFIG.mapWidth-2||point.z>CONFIG.mapHeight-2)continue;
    if(humans.some(unit=>distance(unit,point)<14)||sim._pointBlockedForUnit(probe,point))continue;
    const woodland=sim._staticBlockerCandidates(point,7).some(node=>node.kind==='resource'&&node.type==='tree'&&node.amount>0&&distance(node,point)<7);
    if(!woodland)continue;
    Object.assign(probe,point);
    const route=sim._bestCombatRoute(probe,target);routes++;
    if(route){
      const bear=sim.addUnit('grizzly',point.x,point.z,'wildlife');
      bear.wildlifeBornAt=sim.clock;bear.wildlifeHome={...point};bear.wildlifeScanClock=0;
      sim._sendUnitToAttack(bear,target,0,{requireImmediateRoute:true});
      bear.actionLabel='Hunting through the woodland';
      state.spawnCount++;state.spawnCursor=0;
      sim._announce('A huge grizzly has emerged from the woods. Soldiers, protect the settlement!');
      return bear;
    }
    if(routes>=GRIZZLY_ENCOUNTER.spawnRouteBudget)break;
  }
  return null;
}

function hunt(sim,bear) {
  const humans=people(sim),current=sim._getAttackTarget(bear);
  const mark=[current?.id??0,current?.hp??0].join('|');
  if(mark!==bear.wildlifeProgress||!bear.wildlifeProgressPoint||distance(bear,bear.wildlifeProgressPoint)>2){
    bear.wildlifeProgress=mark;bear.wildlifeProgressAt=sim.clock;bear.wildlifeProgressPoint={x:bear.x,z:bear.z};
  }
  const stalled=sim.clock-(bear.wildlifeProgressAt??sim.clock)>6;
  const nearest=humans.filter(unit=>!(unit.lastLightWardTimer>0)).sort((a,b)=>distance(bear,a)-distance(bear,b)||a.id-b.id)[0];
  const passing=nearest&&current&&nearest.id!==current.id&&distance(bear,nearest)<6&&distance(bear,current)>9;
  if(current&&!stalled&&!passing&&!(current.lastLightWardTimer>0))return;
  bear.wildlifeAvoid??={};
  for(const [id,until] of Object.entries(bear.wildlifeAvoid))if(until<=sim.clock)delete bear.wildlifeAvoid[id];
  if(stalled&&current)bear.wildlifeAvoid[current.id]=sim.clock+12;
  if(current){sim._interruptWork(bear);bear.command='idle';bear.path=[];}
  const candidates=humans.filter(unit=>!bear.wildlifeAvoid[unit.id])
    .sort((a,b)=>Number(a.lastLightWardTimer>0)-Number(b.lastLightWardTimer>0)||distance(bear,a)-distance(bear,b)||a.id-b.id);
  for(const target of candidates.slice(0,GRIZZLY_ENCOUNTER.huntRouteBudget)){
    if(sim._sendUnitToAttack(bear,target,bear.id%8,{requireImmediateRoute:true})){
      bear.wildlifeProgressAt=sim.clock;bear.actionLabel='Hunting '+UNIT_TYPES[target.type].label;return;
    }
    bear.wildlifeAvoid[target.id]=sim.clock+8;
  }
  if(bear.path.length&&!stalled)return;
  // When every person is temporarily behind an impassable barrier, prowl
  // locally and keep searching rather than freezing or crossing collision.
  for(let i=0;i<4;i++){
    const angle=(bear.id+Math.floor(sim.clock/4)+i*2.4)*1.17;
    const point={x:bear.x+Math.cos(angle)*7,z:bear.z+Math.sin(angle)*7};
    if(point.x<1||point.z<1||point.x>=CONFIG.mapWidth-1||point.z>=CONFIG.mapHeight-1||sim._pointBlockedForUnit(bear,point))continue;
    if(sim._sendUnitTo(bear,point,'move')){bear.actionLabel='Prowling for prey';bear.wildlifeProgressAt=sim.clock;return;}
  }
  bear.actionLabel='Searching the woodland';
}

export function updateWildlife(sim,dt) {
  const state=sim.wildlifeState??=initialWildlifeState(sim.clock);
  if(sim.clock+1e-6>=state.nextSpawnAt&&sim.clock>=(state.spawnRetryAt??0)){
    if(spawnGrizzly(sim))state.nextSpawnAt+=GRIZZLY_ENCOUNTER.interval;
    state.spawnRetryAt=sim.clock+GRIZZLY_ENCOUNTER.retryInterval;
  }
  state.scanClock-=dt;
  if(state.scanClock>0)return;
  state.scanClock=GRIZZLY_ENCOUNTER.scanInterval;
  for(const bear of sim.units)if(bear.type==='grizzly'&&!bear.dead&&bear.stunTimer<=0)hunt(sim,bear);
}
