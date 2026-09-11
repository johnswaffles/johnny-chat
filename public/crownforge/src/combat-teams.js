import {UNIT_TYPES} from './config.js?v=20260911-teams2';
import {isWardProtected} from './unit-status.js?v=20260911-teams2';
export const TEAM_RULES=Object.freeze({healAmount:40,healInterval:2,healRange:8,followDistance:5,tauntDuration:8,tauntRange:24});
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
export function teams(sim){
 const groups=new Map();
 for(const u of sim.units)if(eligibleMember(u)&&Number.isInteger(u.teamId)&&u.teamId>0){
  if(!groups.has(u.teamId))groups.set(u.teamId,{id:u.teamId,members:[],tank:0,healer:0,damage:0,support:0});
  const group=groups.get(u.teamId);group.members.push(u);group[combatRole(u)]++;
 }
 return [...groups.values()].sort((a,b)=>a.id-b.id);
}
export function assignTeam(sim,id=null){
 const selected=sim.selectedEntities.filter(eligibleMember);
 if(!selected.length)return false;
 if(id!==null&&!teams(sim).some(t=>t.id===id))return false;
 const teamId=id??Math.max(0,...sim.units.map(u=>Number.isInteger(u.teamId)?u.teamId:0))+1;
 for(const u of selected){
  if(u.teamId===teamId)continue;
  u.teamId=teamId;u.healCooldown=TEAM_RULES.healInterval;
  if(isTeamHealer(u)){sim._interruptWork(u);u.orderQueue=[];u.command='idle';u.path=[];u.actionLabel=`Healer · Team ${teamId}`;}
 }
 sim._announce(`${selected.length} assigned to Team ${teamId}. Hearthkin will heal nearby teammates.`);return teamId;
}
export function leaveTeam(sim,allId=null){
 const selected=allId===null?sim.selectedEntities:sim.units.filter(u=>u.teamId===allId);
 for(const u of selected)if(eligibleMember(u)&&u.teamId){
  if(u.teamFollowing){sim._interruptWork(u);u.command='idle';u.path=[];}
  u.teamId=null;u.healTargetId=null;u.teamFollowing=false;u.actionLabel='Ready';
 }
 sim._announce(allId===null?'Selected units left their teams.':'Team disbanded.');
}
export function selectTeam(sim,id){
 const members=sim.units.filter(u=>eligibleMember(u)&&u.teamId===id);
 sim.selectedIds=members.map(u=>u.id);sim._syncSelectionFlags();
 sim._announce(`Team ${id} selected · ${members.length} members.`);return members.length;
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
 const groups=teams(sim);
 for(const unit of sim.units){unit.healPulse=Math.max(0,(unit.healPulse??0)-dt);unit.healCastPulse=Math.max(0,(unit.healCastPulse??0)-dt);}
 for(const group of groups)for(const healer of group.members.filter(isTeamHealer)){
  healer.healCooldown=Math.max(0,(healer.healCooldown??0)-dt);
  if(healer.stunTimer>0||!['idle','move','attack'].includes(healer.command))continue;
  const allies=group.members.filter(u=>u!==healer);
  const patient=allies.filter(u=>u.hp<u.maxHp&&distance(healer,u)<=TEAM_RULES.healRange&&sim._hasCombatLineOfSight(healer,u))
   .sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||a.id-b.id)[0];
  if(patient&&healer.healCooldown<=0){
   const amount=Math.min(TEAM_RULES.healAmount,patient.maxHp-patient.hp);
   patient.hp+=amount;patient.healPulse=.85;patient.lastHealAmount=amount;patient.healthRevealTimer=2;
   healer.healTargetId=patient.id;healer.healCastPulse=.85;healer.healCooldown=TEAM_RULES.healInterval;
  }
  if(patient)healer.actionLabel=`Healing ${UNIT_TYPES[patient.type].label} · Team ${group.id}`;
  else if(healer.command==='idle')healer.actionLabel=`Healer ready · Team ${group.id}`;
  // Manual movement/work stays authoritative. Only automatic follow may repath.
  if(healer.command!=='idle'&&!healer.teamFollowing)continue;
  const anchor=allies.filter(u=>combatRole(u)!=='healer').sort((a,b)=>Number(combatRole(b)==='tank')-Number(combatRole(a)==='tank')||distance(healer,a)-distance(healer,b)||a.id-b.id)[0];
  if(!anchor)continue;
  const enemy=sim._getExplicitAttackTarget(anchor);
  const dx=enemy?anchor.x-enemy.x:healer.x-anchor.x,dz=enemy?anchor.z-enemy.z:healer.z-anchor.z,len=Math.hypot(dx,dz)||1;
  const side=((healer.id%3)-1)*2;
  const point={x:anchor.x+dx/len*TEAM_RULES.followDistance-dz/len*side,z:anchor.z+dz/len*TEAM_RULES.followDistance+dx/len*side};
  if(distance(healer,anchor)>TEAM_RULES.healRange-1 && (healer.teamFollowAt??0)<=sim.clock&&sim.repathBudgetRemaining>0){
   healer.teamFollowAt=sim.clock+1;sim.repathBudgetRemaining--;
   if(sim._sendUnitTo(healer,point,'move')){healer.teamFollowing=true;healer.actionLabel=`Following Team ${group.id}`;}
  }
 }
}
