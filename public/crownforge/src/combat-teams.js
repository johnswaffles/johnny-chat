import {combatRadius,BEAR_FURY} from './bear-combat.js?v=20260911-unbrokenwild1';
import {UNIT_TYPES} from './config.js?v=20260911-unbrokenwild1';
import {isWardProtected} from './unit-status.js?v=20260911-unbrokenwild1';
export const TEAM_RULES=Object.freeze({healAmount:20,tankHealAmount:40,healInterval:2,healRange:20,followDistance:10,tauntDuration:8,tauntRange:24});
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
  const patients=sim.units.filter(u=>eligibleMember(u)&&u!==healer&&u.hp<u.maxHp&&distance(healer,u)<=TEAM_RULES.healRange&&sim._hasCombatLineOfSight(healer,u))
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
  const desired=enemy?.type==='grizzly'?healerRearPosition(sim,healer,enemy,anchor):{
   x:anchor.x+dx/len*TEAM_RULES.followDistance-dz/len*side,
   z:anchor.z+dz/len*TEAM_RULES.followDistance+dx/len*side};
  if((enemy?.type==='grizzly'?distance(healer,desired)>1.2:distance(healer,anchor)>TEAM_RULES.healRange-1)
   &&(healer.teamFollowAt??0)<=sim.clock&&sim.repathBudgetRemaining>0){
   healer.teamFollowAt=sim.clock+.5;sim.repathBudgetRemaining--;
   // Follow the outer perimeter while crossing to the DPS side, not the bear's body.
   const point=enemy?.type==='grizzly'?bearOrbitStep(healer,enemy,desired):desired;
   if(sim._sendUnitTo(healer,point,'move')){healer.teamFollowing=true;healer.actionLabel='Following behind damage fighters';}
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

// Stable rear slots use the tank's position, never the attacker's starting side.
export function bearRearPosition(sim,unit,bear){
 if(bear?.type!=='grizzly'||!unit.teamId||combatRole(unit)!=='damage')return null;
 const tank=tankTarget(sim,bear);if(!tank)return null;
 const peers=sim.units.filter(u=>!u.dead&&u.teamId&&combatRole(u)==='damage'&&(u.attackTarget===bear.id||u.teamAdvanceTargetId===bear.id||u.id===unit.id)).sort((a,b)=>a.id-b.id);
 const radius=combatRadius(bear)+Math.max(combatRadius(unit)+.25,Math.min(UNIT_TYPES[unit.type].range-.3,1.1));
 const columns=Math.max(3,Math.floor(radius*2/1.6)),index=Math.max(0,peers.indexOf(unit)),count=Math.min(columns,peers.length);
 const angle=Math.atan2(bear.z-tank.z,bear.x-tank.x)+(index%columns-(count-1)/2)*(2/columns);
 const ring=radius+Math.floor(index/columns)*1.6;
 return {x:bear.x+Math.cos(angle)*ring,z:bear.z+Math.sin(angle)*ring};
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
