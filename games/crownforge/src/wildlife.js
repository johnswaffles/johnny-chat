import { BEAR_VARIANT_IDS, bearVariant } from './bear-variants.js?v=20260909-cursedbears1';
import { CONFIG, UNIT_TYPES } from './config.js?v=20260909-cursedbears1';

export const GRIZZLY_ENCOUNTER = Object.freeze({ interval: 300, maxAlivePerSide: 2, scanInterval: .8, retryInterval: 1, spawnRouteBudget: 4, huntRouteBudget: 3 });
export const BEAR_RESPONSE = Object.freeze({ radius:140, scanInterval:.5, routeBudget:3, retry:8 });
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
// The isometric map's upper/lower halves are split along its x + z midpoint.
// Count current positions, so crossing the map transfers a living bear's slot.
export const grizzlySide = point => point.x + point.z < (CONFIG.mapWidth + CONFIG.mapHeight) / 2 ? 'player' : 'enemy';
export function livingGrizzliesBySide(sim) {
  const counts={player:0,enemy:0};
  for(const unit of sim.units)if(unit.type==='grizzly'&&!unit.dead)counts[grizzlySide(unit)]++;
  return counts;
}
const people = sim => sim.units.filter(unit => !unit.dead && (unit.faction === 'player' || unit.faction === 'enemy'));
export const initialWildlifeState = clock => ({ nextSpawnAt: (Math.floor(Math.max(0,clock)/300)+1)*300, spawnCount: 0, scanClock: 0, spawnCursor: 0 });

// Spawn on a real woodland edge with a legal route to a person. Never move
// existing trees, buildings or people to make an encounter fit.
function planGrizzly(sim,state,side=null,avoid=[],automatic=false) {
  const humans=people(sim).filter(u=>!(u.lastLightWardTimer>0));
  if (!humans.length) return null;
  const preferred=side??(state.spawnCount%2 ? 'enemy' : 'player');
  const audience=humans.filter(unit=>unit.faction===preferred);
  if(side&&!audience.length)return null;
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
    if(automatic&&grizzlySide(point)!==side)continue;
    if(avoid.some(p=>distance(p,point)<3)||sim.units.some(u=>u.type==='grizzly'&&!u.dead&&distance(u,point)<3))continue;
    if(humans.some(unit=>distance(unit,point)<14)||sim._pointBlockedForUnit(probe,point))continue;
    const woodland=sim._staticBlockerCandidates(point,7).some(node=>node.kind==='resource'&&node.type==='tree'&&node.amount>0&&distance(node,point)<7);
    if(!woodland)continue;
    Object.assign(probe,point);
    const route=sim._bestCombatRoute(probe,target);routes++;
    if(route)return {point,target,route};
    if(routes>=GRIZZLY_ENCOUNTER.spawnRouteBudget)break;
  }
  return null;
}

function releasePlannedGrizzly(sim,plan) {
  const {point,target,route}=plan;
  const bear=sim.addUnit('grizzly',point.x,point.z,'wildlife');
  bear.bearVariant=BEAR_VARIANT_IDS[sim.wildlifeState.spawnCount%BEAR_VARIANT_IDS.length];
  bear.wildlifeBornAt=sim.clock;bear.wildlifeHome={...point};bear.wildlifeScanClock=0;
  sim._sendUnitToAttack(bear,target,0,{requireImmediateRoute:true,precomputedRoute:route});
  bear.actionLabel='Hunting through the woodland';
  sim.wildlifeState.spawnCount++;
  return bear;
}

export function spawnGrizzly(sim) {
  const state=sim.wildlifeState,counts=livingGrizzliesBySide(sim);
  const preferred=state.spawnCount%2?'enemy':'player';
  let plan=null;
  for(const side of [preferred,preferred==='player'?'enemy':'player']){
    if(counts[side]>=GRIZZLY_ENCOUNTER.maxAlivePerSide||!people(sim).some(u=>u.faction===side&&!(u.lastLightWardTimer>0)))continue;
    plan=planGrizzly(sim,state,side,[],true);
    break; // Preserve the chosen side while its bounded route search retries.
  }
  if(!plan)return null;
  const bear=releasePlannedGrizzly(sim,plan);state.spawnCursor=0;
  sim._announce(`${bearVariant(bear).name} has emerged from the woods. Soldiers, protect the settlement!`);
  return bear;
}

export function requestGrizzlyPair(sim) {
  const state=sim.wildlifeState??=initialWildlifeState(sim.clock);
  if(sim.phase!=='playing'||state.pendingPair)return false;
  if(!['player','enemy'].every(side=>people(sim).some(u=>u.faction===side))){
    sim._announce('Both sides need living people before releasing a pair of bears.');return false;
  }
  state.pendingPair={startedAt:sim.clock,retryAt:sim.clock,player:{spawnCount:0,spawnCursor:0},enemy:{spawnCount:0,spawnCursor:0}};
  sim._announce('Finding clear woodland trails for both bears…');
  updateGrizzlyPair(sim);
  return true;
}

function updateGrizzlyPair(sim) {
  const state=sim.wildlifeState,pending=state.pendingPair;
  if(!pending||sim.clock<pending.retryAt)return;
  // Search with the existing per-side route budget, then commit both spawns
  // in the same simulation tick. Never release half of a requested pair.
  const player=planGrizzly(sim,pending.player,'player');
  const enemy=planGrizzly(sim,pending.enemy,'enemy',player?[player.point]:[]);
  if(player&&enemy){
    releasePlannedGrizzly(sim,player);releasePlannedGrizzly(sim,enemy);
    state.pendingPair=null;
    sim._announce('Two grizzlies emerge! One hunts the Crownlands; one hunts the Ashen camp.');
  }else if(sim.clock-pending.startedAt>=8){
    state.pendingPair=null;
    sim._announce('No clear woodland trails to both sides. Try releasing the bears again.');
  }else pending.retryAt=sim.clock+.5;
}

function hunt(sim,bear) {
  // A lethal swipe still has weight and recovery; scanning must not reset it.
  if(bear.attackEventFired&&bear.attackPhase!=='approach'&&!sim._getExplicitAttackTarget(bear))return;
  const humans=people(sim).filter(u=>!(u.lastLightWardTimer>0)),current=sim._getAttackTarget(bear);
  const mark=[current?.id??0,current?.hp??0].join('|');
  if(mark!==bear.wildlifeProgress||!bear.wildlifeProgressPoint||distance(bear,bear.wildlifeProgressPoint)>2){
    bear.wildlifeProgress=mark;bear.wildlifeProgressAt=sim.clock;bear.wildlifeProgressPoint={x:bear.x,z:bear.z};
  }
  const stalled=sim.clock-(bear.wildlifeProgressAt??sim.clock)>6;
  const nearest=humans.filter(unit=>!(unit.lastLightWardTimer>0)).sort((a,b)=>distance(bear,a)-distance(bear,b)||a.id-b.id)[0];
  const retaliation=current?.id===bear.wildlifeRetaliationId;
  const passing=!retaliation&&nearest&&current&&nearest.id!==current.id&&distance(bear,nearest)<6&&distance(bear,current)>9;
  if(current&&!stalled&&!passing&&!(current.lastLightWardTimer>0))return;
  bear.wildlifeAvoid??={};
  for(const [id,until] of Object.entries(bear.wildlifeAvoid))if(until<=sim.clock)delete bear.wildlifeAvoid[id];
  if(stalled&&current)bear.wildlifeAvoid[current.id]=sim.clock+12;
  if(current||bear.attackTarget){sim._interruptWork(bear);bear.command='idle';bear.path=[];}
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

function resumeAfterBear(sim,unit){
  const response=unit.bearResponse;
  if(!response)return;
  const bear=sim.units.find(u=>u.id===response.targetId&&!u.dead);
  if(bear&&unit.command==='attack'&&unit.attackTarget===bear.id)return;
  // Explicit commands clear bearResponse in _interruptWork. Only an
  // automatically completed encounter can resume this earlier route.
  const order=response.order;
  sim._interruptWork(unit);unit.command='idle';unit.path=[];
  if(order?.patrolPoints?.length>=2){
    unit.patrolPoints=order.patrolPoints;unit.patrolIndex=order.patrolIndex;unit.patrolActive=true;
    sim._sendUnitTo(unit,unit.patrolPoints[unit.patrolIndex],'move');
  }else if(order?.guardPoint){
    unit.guardPoint=order.guardPoint;unit.guardRadius=order.guardRadius;unit.guardTraveling=true;
    sim._sendUnitTo(unit,unit.guardPoint,'move');
  }else if(order?.destination)sim._sendUnitTo(unit,order.destination,'move');
}

export function rallyBearDefenders(sim){
  const state=sim.wildlifeState, bears=sim.units.filter(u=>u.type==='grizzly'&&!u.dead);
  const fighters=sim.units.filter(u=>{
    const rules=UNIT_TYPES[u.type];
    return !u.dead&&['player','enemy'].includes(u.faction)&&!rules.worker&&rules.attack>0&&rules.canAttackUnits!==false;
  });
  for(const unit of fighters)resumeAfterBear(sim,unit);
  if(!bears.length||!fighters.length)return;
  let budget=BEAR_RESPONSE.routeBudget;
  const start=(state.responseCursor??0)%fighters.length;
  for(let offset=0;offset<fighters.length&&budget>0;offset++){
    const index=(start+offset)%fighters.length,unit=fighters[index];
    state.responseCursor=(index+1)%fighters.length;
    if(unit.stunTimer>0||unit.command==='attack'&&sim._getAttackTarget(unit))continue;
    unit.bearAvoid??={};
    for(const [id,until] of Object.entries(unit.bearAvoid))if(until<=sim.clock)delete unit.bearAvoid[id];
    const targets=bears.filter(b=>distance(unit,b)<=BEAR_RESPONSE.radius&&!unit.bearAvoid[b.id]).sort((a,b)=>distance(unit,a)-distance(unit,b));
    for(const bear of targets){
      if(budget<=0)break;
      budget--;
      const route=sim._bestCombatRoute(unit,bear);
      if(!route){unit.bearAvoid[bear.id]=sim.clock+BEAR_RESPONSE.retry;continue;}
      const order=unit.patrolActive?{patrolPoints:unit.patrolPoints.map(p=>({...p})),patrolIndex:unit.patrolIndex??0}
        :unit.guardPoint?{guardPoint:{...unit.guardPoint},guardRadius:unit.guardRadius}
        :unit.command==='move'&&unit.routeTarget?{destination:{...unit.routeTarget}}:null;
      sim._interruptWork(unit,{preserveGuard:Boolean(unit.guardPoint)});
      sim._sendUnitToAttack(unit,bear,route.slot,{requireImmediateRoute:true,precomputedRoute:route});
      unit.bearResponse={targetId:bear.id,order};unit.actionLabel='Intercepting the Greatwood Grizzly';break;
    }
  }
}

export function updateWildlife(sim,dt) {
  const state=sim.wildlifeState??=initialWildlifeState(sim.clock);
  updateGrizzlyPair(sim);
  if(sim.clock+1e-6>=state.nextSpawnAt&&sim.clock>=(state.spawnRetryAt??0)){
    const counts=livingGrizzliesBySide(sim);
    const full=Object.values(counts).every(count=>count>=GRIZZLY_ENCOUNTER.maxAlivePerSide);
    // A capped event expires; do not accumulate overdue encounters for later.
    if(full)state.nextSpawnAt=sim.clock+GRIZZLY_ENCOUNTER.interval;
    else if(spawnGrizzly(sim))state.nextSpawnAt+=GRIZZLY_ENCOUNTER.interval;
    state.spawnRetryAt=sim.clock+GRIZZLY_ENCOUNTER.retryInterval;
  }
  state.responseClock=(state.responseClock??0)-dt;
  if(state.responseClock<=0){state.responseClock=BEAR_RESPONSE.scanInterval;rallyBearDefenders(sim);}
  state.scanClock-=dt;
  if(state.scanClock>0)return;
  state.scanClock=GRIZZLY_ENCOUNTER.scanInterval;
  for(const bear of sim.units)if(bear.type==='grizzly'&&!bear.dead&&bear.stunTimer<=0)hunt(sim,bear);
}
