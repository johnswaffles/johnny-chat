import {combatRadius,BEAR_FURY} from './bear-combat.js?v=20260912-deathless1';
import {CONFIG,UNIT_TYPES} from './config.js?v=20260912-deathless1';
import {isWardProtected} from './unit-status.js?v=20260912-deathless1';
export const TEAM_RULES=Object.freeze({healAmount:20,tankHealAmount:40,healInterval:2,healRange:24,followDistance:10,tauntDuration:8,tauntRange:24});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function combatRole(unit){
 const rule=UNIT_TYPES[unit?.type];
 if(!rule)return null;
 if(rule.combatRole)return rule.combatRole;
 if(rule.race==='hearthkin'&&rule.worker)return 'healer';
 return !rule.worker&&!rule.wildlife&&rule.attack>0&&rule.canAttackUnits!==false?'damage':null;
}
export const isTeamHealer=unit=>Boolean(unit?.teamId&&combatRole(unit)==='healer');
export const eligibleMember=u=>Boolean(u?.kind==='unit'&&!u.dead&&u.faction==='player'&&combatRole(u));
export function teams(sim,dt=0){
 const groups=new Map([[1,{id:1,members:[],tank:0,healer:0,damage:0,support:0}]]);
 for(const u of sim.units){
  if(dt){u.healPulse=Math.max(0,(u.healPulse??0)-dt);u.healCastPulse=Math.max(0,(u.healCastPulse??0)-dt);}
  if(eligibleMember(u)&&Number.isInteger(u.teamId)&&u.teamId>0){
  u.teamId=1;
  const group=groups.get(1);group.members.push(u);group[combatRole(u)]++;
 }
 }
 return [...groups.values()].sort((a,b)=>a.id-b.id);
}
export function assignTeam(sim,id=null){
 const selected=sim.selectedEntities.filter(eligibleMember);
 if(!selected.length)return false;
 const teamId=1;
 for(const u of selected){
  if(u.teamId===teamId)continue;
  u.teamId=teamId;u.healCooldown=TEAM_RULES.healInterval;
  if(isTeamHealer(u)){sim._interruptWork(u);u.orderQueue=[];u.command='idle';u.path=[];u.actionLabel=`Healer · Your team`;}
 }
 sim._announce(`${selected.length} added to your team. Hearthkin heal all nearby allies.`);return teamId;
}
export function leaveTeam(sim,allId=null){
 const selected=allId===null?sim.selectedEntities:sim.units.filter(u=>u.teamId===allId);
 for(const u of selected)if(eligibleMember(u)&&u.teamId){
  if(u.teamFollowing){sim._interruptWork(u);u.command='idle';u.path=[];}
  u.teamId=null;u.healTargetId=null;u.teamFollowing=false;u.actionLabel='Ready';
 }
 sim._announce(allId===null?'Selected units left your team.':'Team roster cleared. Add replacements whenever you like.');
}
export function selectTeam(sim,id){
 const members=sim.units.filter(u=>eligibleMember(u)&&u.teamId);
 sim.selectedIds=members.map(u=>u.id);sim._syncSelectionFlags();
 sim._announce(`Your team selected · ${members.length} members.`);return members.length;
}
export function tankTarget(sim,enemy){
 if(!enemy?.threatTankId)return null;
 const tank=sim.units.find(u=>u.id===enemy.threatTankId&&!u.dead&&u.hp>0);
 if(!tank||combatRole(tank)!=='tank'||tank.faction===enemy.faction||isWardProtected(tank)
  ||(enemy.threatUntil??0)<sim.clock||distance(tank,enemy)>TEAM_RULES.tauntRange){
  enemy.threatTankId=null;enemy.threatUntil=0;return null;
 }
 return tank;
}
export function claimThreat(sim,enemy,attacker){
 if(!enemy||enemy.dead||enemy.kind!=='unit'||!attacker||attacker.dead||enemy.faction===attacker.faction
  ||combatRole(attacker)!=='tank'||isWardProtected(attacker)||UNIT_TYPES[enemy.type]?.canAttackUnits===false)return false;
 const owner=tankTarget(sim,enemy);
 // Two tanks do not bounce an enemy between themselves every swing.
 if(owner&&owner.id!==attacker.id)return false;
 enemy.threatTankId=attacker.id;enemy.threatUntil=sim.clock+TEAM_RULES.tauntDuration;
 return true;
}
export function updateTeams(sim,dt){
 const groups=teams(sim,dt);
 for(const group of groups)for(const healer of group.members.filter(isTeamHealer)){
  healer.healCooldown=Math.max(0,(healer.healCooldown??0)-dt);
  healer.teamThinkCooldown=Math.max(0,(healer.teamThinkCooldown??0)-dt);
  if(healer.teamThinkCooldown>1e-8)continue;
  healer.teamThinkCooldown=.2;
  if(healer.stunTimer>0)continue;
  if(!['idle','move'].includes(healer.command)){sim._interruptWork(healer);healer.command='idle';healer.path=[];healer.orderQueue=[];}
  const allies=group.members.filter(u=>u!==healer);
  const patients=sim.units.filter(u=>eligibleMember(u)&&u!==healer&&u.hp<u.maxHp&&distance(healer,u)<=TEAM_RULES.healRange+(combatRole(u)==='tank'?5:0)&&sim._hasCombatLineOfSight(healer,u))
   .sort((a,b)=>Number(combatRole(b)==='tank')-Number(combatRole(a)==='tank')||a.hp/a.maxHp-b.hp/b.maxHp||a.id-b.id);
  const patient=patients[0];
  if(patient&&healer.healCooldown<=0){
   for(const ally of patients){
    const amount=Math.min(combatRole(ally)==='tank'?TEAM_RULES.tankHealAmount:TEAM_RULES.healAmount,ally.maxHp-ally.hp);
    ally.hp+=amount;ally.healPulse=.85;ally.lastHealAmount=amount;ally.healthRevealTimer=2;
   }
   healer.healTargetId=patient.id;healer.healCastPulse=.85;healer.healCooldown=TEAM_RULES.healInterval;
  }
  if(patient)healer.actionLabel=`Healing ${UNIT_TYPES[patient.type].label} · Your team`;
  else if(healer.command==='idle')healer.actionLabel=`Healer ready · Your team`;
  // Manual movement/work stays authoritative. Only automatic follow may repath.
  if(healer.command!=='idle'&&!healer.teamFollowing)continue;
  const anchor=allies.filter(u=>combatRole(u)!=='healer').sort((a,b)=>Number(combatRole(b)==='tank')-Number(combatRole(a)==='tank')||distance(healer,a)-distance(healer,b)||a.id-b.id)[0];
  if(!anchor)continue;
  const enemy=sim._getExplicitAttackTarget(anchor);
  const dx=enemy?anchor.x-enemy.x:healer.x-anchor.x,dz=enemy?anchor.z-enemy.z:healer.z-anchor.z,len=Math.hypot(dx,dz)||1;
  const side=((healer.id%3)-1)*2;
  const pulling=anchor.tankPull?.targetId===enemy?.id&&Boolean(enemy);
  let desired=enemy?.type==='grizzly'&&!pulling?healerRearPosition(sim,healer,enemy,anchor):{
   x:anchor.x+dx/len*TEAM_RULES.followDistance-dz/len*side,
   z:anchor.z+dz/len*TEAM_RULES.followDistance+dx/len*side};
  const frontFallback=enemy?.type==='grizzly'&&!pulling&&rearRouteBlocked(sim,healer,enemy,desired);
  if(frontFallback){const back=Math.max(BEAR_FURY.radius+2,distance(anchor,enemy)+4);desired={x:enemy.x+dx/len*back-dz/len*side,z:enemy.z+dz/len*back+dx/len*side};}
  if((enemy?.type==='grizzly'?distance(healer,desired)>1.2:distance(healer,anchor)>TEAM_RULES.healRange-1)
   &&(healer.teamFollowAt??0)<=sim.clock&&sim.repathBudgetRemaining>0){
   healer.teamFollowAt=sim.clock+.5;sim.repathBudgetRemaining--;
   // Follow the outer perimeter while crossing to the DPS side, not the bear's body.
   const point=enemy?.type==='grizzly'?bearOrbitStep(healer,enemy,desired):desired;
   if(sim._sendUnitTo(healer,point,'move')){healer.teamFollowing=true;healer.actionLabel=frontFallback?'Supporting behind the tank':'Following behind damage fighters';}else if(enemy?.type==='grizzly')markFrontFallback(sim,healer,enemy);
  }
 }
}

// Stage damage fighters behind the front line until a tank lands its first hit.
export function prepareTeamAttack(sim,unit,target,slot){
 if(!unit.teamId||combatRole(unit)!=='damage'||target?.kind!=='unit')return false;
 const tanks=sim.units.filter(u=>eligibleMember(u)&&u.teamId&&combatRole(u)==='tank');
 if(!tanks.length||tanks.some(u=>tankTarget(sim,target)?.id===u.id))return false;
 for(const tank of tanks)if(tank.attackTarget!==target.id||tank.command!=='attack'){
  sim._interruptWork(tank);sim._sendUnitToAttack(tank,target,tank.id%8);
 }
 sim._cancelAttackCycle(unit);unit.teamAdvanceTargetId=target.id;unit.teamAdvanceSlot=slot;
 unit.attackTarget=null;unit.attackTargetKind=null;unit.command='move';unit.path=[];unit.routeTarget=null;
 unit.actionLabel='Holding behind tanks until they establish aggro';return true;
}
export function updateTeamApproaches(sim){
 for(const unit of sim.units){
  if(unit.dead||!unit.teamAdvanceTargetId)continue;
  const target=sim.units.find(u=>u.id===unit.teamAdvanceTargetId&&!u.dead);
  if(!target||!unit.teamId){unit.teamAdvanceTargetId=null;unit.command='idle';unit.path=[];continue;}
  const tanks=sim.units.filter(u=>eligibleMember(u)&&u.teamId&&combatRole(u)==='tank');
  if(!tanks.length||tanks.some(t=>tankTarget(sim,target)?.id===t.id)){
   unit.teamAdvanceTargetId=null;sim._sendUnitToAttack(unit,target,unit.teamAdvanceSlot??0);continue;
  }
  if((unit.teamAdvanceAt??0)>sim.clock||sim.repathBudgetRemaining<=0)continue;
  unit.teamAdvanceAt=sim.clock+.5;
  const tank=tanks.sort((a,b)=>distance(a,target)-distance(b,target)||a.id-b.id)[0];
  const dx=tank.x-target.x,dz=tank.z-target.z,length=Math.hypot(dx,dz)||1,side=((unit.teamAdvanceSlot??unit.id)%3-1)*2.5;
  const point={x:target.x+dx/length*Math.max(12,distance(tank,target)+4)-dz/length*side,z:target.z+dz/length*Math.max(12,distance(tank,target)+4)+dx/length*side};
  if(distance(unit,point)>1){sim.repathBudgetRemaining--;sim._sendUnitTo(unit,point,'move');}
  unit.actionLabel='Following behind the tank line';
 }
}

export function teamMovePoint(units,unit,destination){
 if(!unit.teamId||!units.some(u=>u.teamId&&combatRole(u)==='tank'))return null;
 const members=units.filter(u=>u.teamId),center=members.reduce((p,u)=>({x:p.x+u.x/members.length,z:p.z+u.z/members.length}),{x:0,z:0});
 const dx=destination.x-center.x,dz=destination.z-center.z,len=Math.hypot(dx,dz)||1;
 const role=combatRole(unit),row=role==='tank'?0:role==='healer'?8:4;
 const peers=members.filter(u=>combatRole(u)===role).sort((a,b)=>a.id-b.id),index=peers.indexOf(unit);
 const side=(index%5-(Math.min(5,peers.length)-1)/2)*2.5,back=row+Math.floor(index/5)*2.5;
 return {x:destination.x-dx/len*back-dz/len*side,z:destination.z-dz/len*back+dx/len*side};
}

// Persistent reservations keep a casualty or newcomer from rotating the whole party.
export function bearRearPosition(sim,unit,bear){
 if(bear?.kind!=='unit'||!unit.teamId||combatRole(unit)!=='damage')return null;
 const tank=tankTarget(sim,bear);if(!tank)return null;
 if(tank.tankPull?.targetId===bear.id)return null;
 const peers=sim.units.filter(u=>!u.dead&&u.hp>0&&u.teamId===unit.teamId&&combatRole(u)==='damage'&&(u.attackTarget===bear.id||u.teamAdvanceTargetId===bear.id||u.id===unit.id)).sort((a,b)=>a.id-b.id);
 const reservations=bear.surroundAssignments??={};
 for(const id of Object.keys(reservations))if(!peers.some(u=>String(u.id)===id))delete reservations[id];
 const occupied=new Set(Object.values(reservations));
 for(const peer of peers)if(reservations[peer.id]===undefined){let slot=0;while(occupied.has(slot))slot++;reservations[peer.id]=slot;occupied.add(slot);}
 const radius=combatRadius(bear)+.95;
 const columns=Math.max(4,Math.floor(radius*4.1/1.55));
 const axis=Math.atan2(bear.z-tank.z,bear.x-tank.x);
 if(bear.surroundAxis===undefined||Math.abs(Math.atan2(Math.sin(axis-bear.surroundAxis),Math.cos(axis-bear.surroundAxis)))>.65)bear.surroundAxis=axis;
 const slot=reservations[unit.id],column=slot%columns;
 // Fill separated flanks first instead of filling adjacent positions into a clump.
 const low=-Math.floor((columns-1)/2),high=Math.floor(columns/2);
 const order=[0,Math.floor(columns/3),-Math.floor(columns/3),Math.floor(columns/6),-Math.floor(columns/6),high,low];
 const offsets=[...new Set(order.filter(n=>n>=low&&n<=high))];
 while(offsets.length<columns){
  let next=low,best=-1;
  for(let n=low;n<=high;n++)if(!offsets.includes(n)){const gap=Math.min(...offsets.map(x=>Math.abs(n-x)));if(gap>best){best=gap;next=n;}}
  offsets.push(next);
 }
 const offset=offsets[column];
 const angle=bear.surroundAxis+offset*4.1/columns;
 const ranged=UNIT_TYPES[unit.type].range>=4;
 const ring=(ranged?combatRadius(bear)+UNIT_TYPES[unit.type].range*.75:radius)+Math.floor(slot/columns)*1.65;
 const goal={x:bear.x+Math.cos(angle)*ring,z:bear.z+Math.sin(angle)*ring};
 if(!rearRouteBlocked(sim,unit,bear,goal))return goal;
 // Keep ranged fallback positions distinct as well.
 if(ranged){const span=distance(tank,bear)||1,side=offset*1.65;return {x:bear.x+(tank.x-bear.x)/span*ring-(tank.z-bear.z)/span*side,z:bear.z+(tank.z-bear.z)/span*ring+(tank.x-bear.x)/span*side};}
 return null;
}
// Advance around the circumference in short chords rather than through the bear.
export function bearOrbitStep(unit,bear,goal){
 let radius=Math.max(combatRadius(bear)+combatRadius(unit)+.3,Math.hypot(goal.x-bear.x,goal.z-bear.z));
 const current=Math.atan2(unit.z-bear.z,unit.x-bear.x),wanted=Math.atan2(goal.z-bear.z,goal.x-bear.x);
 const delta=Math.atan2(Math.sin(wanted-current),Math.cos(wanted-current));
 if(Math.abs(delta)<.25)return goal;
 // Stay outside the frontal fan until safely on the rear half of the orbit.
 if(Math.abs(delta)>Math.PI/3)radius=Math.max(radius,BEAR_FURY.radius+2);
 const angle=current+Math.sign(delta)*Math.min(.28,Math.abs(delta));
 return {x:bear.x+Math.cos(angle)*(radius+.25),z:bear.z+Math.sin(angle)*(radius+.25)};
}

// Track the actual rear damage line as the target and formation rotate or translate.
export function healerRearPosition(sim,healer,enemy,anchor){
 const away={x:enemy.x-anchor.x,z:enemy.z-anchor.z},length=Math.hypot(away.x,away.z)||1;
 let dx=away.x/length,dz=away.z/length;
 const damage=sim.units.filter(u=>!u.dead&&u.teamId===healer.teamId&&combatRole(u)==='damage'
  &&(u.attackTarget===enemy.id||u.teamAdvanceTargetId===enemy.id)
  &&(u.x-enemy.x)*dx+(u.z-enemy.z)*dz>0);
 if(damage.length){
  const center=damage.reduce((p,u)=>({x:p.x+u.x/damage.length,z:p.z+u.z/damage.length}),{x:0,z:0});
  const span=Math.hypot(center.x-enemy.x,center.z-enemy.z)||1;
  dx=(center.x-enemy.x)/span;dz=(center.z-enemy.z)/span;
 }
 const back=Math.max(BEAR_FURY.radius+2,...damage.map(u=>(u.x-enemy.x)*dx+(u.z-enemy.z)*dz+3));
 const healers=sim.units.filter(u=>!u.dead&&u.teamId===healer.teamId&&isTeamHealer(u)).sort((a,b)=>a.id-b.id);
 const side=(healers.indexOf(healer)-(healers.length-1)/2)*2;
 return {x:enemy.x+dx*back-dz*side,z:enemy.z+dz*back+dx*side};
}

export function markFrontFallback(sim,unit,target){
 unit.frontFallback={targetId:target.id,x:target.x,z:target.z,until:sim.clock+8};unit.rearProgress=null;
}
export function rearRouteBlocked(sim,unit,target,goal){
 const fallback=unit.frontFallback;
 if(fallback?.targetId===target.id&&sim.clock<fallback.until&&distance(fallback,target)<3)return true;
 const step=bearOrbitStep(unit,target,goal);
 if(sim._pointBlockedForUnit(unit,goal)||sim._pointBlockedForUnit(unit,step)||sim._pathSegmentBlocked(unit,unit,step)){
  markFrontFallback(sim,unit,target);return true;
 }
 const track=unit.rearProgress;
 if(!track||track.targetId!==target.id||distance(track,unit)>.3||distance(unit,goal)<(isTeamHealer(unit)?1.3:1)){unit.rearProgress={targetId:target.id,x:unit.x,z:unit.z,at:sim.clock};}
 else if(sim.clock-track.at>2){markFrontFallback(sim,unit,target);return true;}
 return false;
}


// The tank physically leads its target to a clearing; no teleporting or wall bypass.
export const PULL_RULES=Object.freeze({scanInterval:4,maxDuration:20,retry:8,maxDistance:24});
export function encounterOpenness(sim,target,center=target){
 const radius=Math.max(4,combatRadius(target)+2.5),probe={type:'shieldbearer'};
 let clear=0,total=0;
 for(const r of [0,radius*.5,radius])for(let i=0;i<(r?16:1);i++){
  const a=i*Math.PI/8,p={x:center.x+Math.cos(a)*r,z:center.z+Math.sin(a)*r};total++;
  if(p.x>1&&p.z>1&&p.x<CONFIG.mapWidth-1&&p.z<CONFIG.mapHeight-1&&!sim._pointBlockedForUnit(probe,p))clear++;
 }
 return clear/total;
}
export function findPullClearing(sim,tank,target){
 const current=encounterOpenness(sim,target);if(current>=.97)return null;
 const toward=Math.atan2(tank.z-target.z,tank.x-target.x),candidates=[];
 for(const span of [8,16,24])for(let i=0;i<16;i++){
  const a=toward+i*Math.PI/8,dir={x:Math.cos(a),z:Math.sin(a)};
  const center={x:target.x+dir.x*span,z:target.z+dir.z*span};
  const gap=combatRadius(target)+combatRadius(tank)+8;
  const point={x:center.x+dir.x*gap,z:center.z+dir.z*gap};
  if(sim._pointBlockedForUnit(target,center)||sim._pointBlockedForUnit(tank,point)||point.x<1||point.z<1||point.x>CONFIG.mapWidth-1||point.z>CONFIG.mapHeight-1)continue;
  const score=encounterOpenness(sim,target,center);
  if(score<.97||score<=current+.015)continue;
  candidates.push({center,point,score:score*100-span*.4-distance(tank,point)*.15});
 }
 candidates.sort((a,b)=>b.score-a.score);
 for(const candidate of candidates.slice(0,8)){
  // A straight, visible chase corridor is necessary for a predictable pull.
  if(sim._pathSegmentBlocked(target,target,candidate.center)||!sim._hasCombatLineOfSight(target,candidate.point))continue;
  const path=sim._buildPath(tank,candidate.point,null,{directOnly:true});
  if(path)return {...candidate,path};
 }
 return null;
}
export function prepareTankPull(sim,tank,target){
 if(combatRole(tank)!=='tank'||!tank.teamId||target?.kind!=='unit'||target.dead||tank.command!=='attack')return false;
 let pull=tank.tankPull;
 if(pull&&(pull.targetId!==target.id||sim.clock>=pull.until||target.dead||tankTarget(sim,target)?.id!==tank.id)){
  tank.tankPull=null;tank.pullScanAt=sim.clock+PULL_RULES.retry;tank.path=[];pull=null;
 }
 if(!pull){
  if((tank.pullScanAt??0)>sim.clock||tankTarget(sim,target)?.id!==tank.id)return false;
  tank.pullScanAt=sim.clock+PULL_RULES.scanInterval;
  if(!sim.units.some(u=>!u.dead&&u.teamId===tank.teamId&&combatRole(u)==='damage'))return false;
  if(sim.repathBudgetRemaining<=0)return false;
  sim.repathBudgetRemaining--;
  const clearing=findPullClearing(sim,tank,target);if(!clearing)return false;
  pull=tank.tankPull={targetId:target.id,center:clearing.center,point:clearing.point,until:sim.clock+PULL_RULES.maxDuration,start:{x:target.x,z:target.z},progress:{x:target.x,z:target.z,at:sim.clock}};
  tank.path=clearing.path;sim._cancelAttackCycle(tank);
 }
 if(distance(target,pull.center)<2||(distance(target,pull.start)>5&&encounterOpenness(sim,target)>=.97)){
  tank.tankPull=null;tank.pullScanAt=sim.clock+PULL_RULES.retry;tank.path=[];target.surroundAxis=undefined;target.surroundAssignments={};return false;
 }
 if(distance(target,pull.progress)>.4)pull.progress={x:target.x,z:target.z,at:sim.clock};
 if(sim.clock-pull.progress.at>4||sim._pathSegmentBlocked(tank,tank,pull.point)){
  tank.tankPull=null;tank.pullScanAt=sim.clock+PULL_RULES.retry;tank.path=[];return false;
 }
 // Keep a bounded chase lock only while the enemy can actually follow.
 if(distance(tank,target)<TEAM_RULES.tauntRange&&sim._hasCombatLineOfSight(tank,target))target.threatUntil=sim.clock+TEAM_RULES.tauntDuration;
 const chaseGap=combatRadius(target)+combatRadius(tank)+9;
 tank.path=distance(tank,target)>chaseGap?[]:[pull.point];tank.routeTarget=pull.point;tank.stopDistance=0;tank.fighterMovingAttack=true;
 tank.actionLabel=tank.path.length?'Drawing enemy into open ground':'Holding aggro for the party';
 return true;
}
export function holdForTankPull(sim,unit,target){
 if(!unit.teamId||combatRole(unit)!=='damage'||target?.kind!=='unit')return false;
 const tank=tankTarget(sim,target);if(tank?.tankPull?.targetId!==target.id)return false;
 const peers=sim.units.filter(u=>!u.dead&&u.teamId===unit.teamId&&combatRole(u)==='damage').sort((a,b)=>a.id-b.id),index=peers.indexOf(unit);
 const dx=tank.x-target.x,dz=tank.z-target.z,len=Math.hypot(dx,dz)||1;
 const back=Math.max(18,len+5)+Math.floor(index/5)*2,side=(index%5-2)*2;
 const goal={x:target.x+dx/len*back-dz/len*side,z:target.z+dz/len*back+dx/len*side};
 if((unit.pullFollowAt??0)<=sim.clock&&sim.repathBudgetRemaining>0){
  unit.pullFollowAt=sim.clock+.5;sim.repathBudgetRemaining--;
  const path=sim._buildPath(unit,goal);if(path){unit.path=path;unit.routeTarget=goal;unit.stopDistance=0;}
 }
 sim._cancelAttackCycle(unit);unit.actionLabel='Giving the tank room to pull';return true;
}
