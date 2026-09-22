import {wizardAttackRange,ascendancyStacks,eventideStarshard} from './eventide-ascendancy.js?v=20260921-ascendancy1';
import {CONFIG,UNIT_TYPES,RESOURCE_SIZE_TIERS} from './config.js?v=20260921-ascendancy1';
export const EVENTIDE=Object.freeze({distance:30,danger:20,escapeClearance:38,veil:6,cooldown:8});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const hostile=(w,u)=>u!==w&&!u.dead&&u.hp>0&&u.faction!==w.faction&&u.faction!=='neutral'&&UNIT_TYPES[u.type]?.attack>0;
export function openWizardLanding(sim,w,point){
 if((sim.resourcesNodes??[]).some(n=>n.amount>0&&['tree','grove'].includes(n.type)&&distance(n,point)<3+(n.type==='grove'?4:3.5)*(RESOURCE_SIZE_TIERS[n.sizeTier]?.footprintScale??1)))return false;
 if(point.x<4||point.z<4||point.x>CONFIG.mapWidth-4||point.z>CONFIG.mapHeight-4)return false;
 for(let i=0;i<9;i++){const a=i*Math.PI/4,p=i===8?point:{x:point.x+Math.cos(a)*3,z:point.z+Math.sin(a)*3};if(sim._pointBlockedForUnit(w,p))return false;}
 return !sim.units.some(u=>u!==w&&!u.dead&&distance(u,point)<3);
}
export function eventideDestination(sim,w,threat){
 const enemies=sim.units.filter(u=>hostile(w,u)),axis=Math.atan2(w.z-threat.z,w.x-threat.x);
 let best=null,bestScore=Infinity;
 const reach=36*2**Math.min(5,ascendancyStacks(w)+1);
 for(const radius of [...new Set([reach*.8,reach*.65,reach*.5,reach*.35,reach*.2,86,70,58,48])])for(let i=0;i<32;i++){
  const a=axis+i*Math.PI/16,point={x:threat.x+Math.cos(a)*radius,z:threat.z+Math.sin(a)*radius};
  if(distance(w,point)<24||enemies.some(u=>distance(u,point)<EVENTIDE.escapeClearance)||!openWizardLanding(sim,w,point)||!sim._hasCombatLineOfSight(point,threat))continue;
  const score=Math.abs(radius-reach*.8)*3+distance(w,point)*.15;
  if(score<bestScore){best=point;bestScore=score;}
 }
 return best;
}
export function escapeEventide(sim,w,threat){
 if(w.dead||w.type!=='wizard'||w.eventideCooldown>0||w.eventideVeil>0)return false;
 const point=eventideDestination(sim,w,threat);if(!point)return false;
 const from={x:w.x,z:w.z};w.eventideResumeId=w.attackTarget??threat.id;
 const target=sim.units.find(u=>u.id===w.eventideResumeId&&!u.dead&&u.faction!==w.faction)??threat;
 w.eventideRangeStacks=Math.min(5,ascendancyStacks(w)+1);
 sim.wizardProjectiles=(sim.wizardProjectiles??[]).filter(p=>p.sourceId!==w.id);
 eventideStarshard(sim,w,target);
 const departure={...w,...from,command:'attack',visualState:'attack',attackPhase:'contact',selected:false,eventideVeil:0};
 sim._interruptWork(w);w.command='idle';w.path=[];w.orderQueue=[];w.teamAdvanceTargetId=null;
 w.x=point.x;w.z=point.z;w.velocityX=w.velocityZ=0;sim._resetMovementTracking(w);
 w.eventideVeil=EVENTIDE.veil;w.eventideCooldown=EVENTIDE.cooldown;w.eventideCount=(w.eventideCount??0)+1;
 w.actionLabel='Eventide Passage · beyond the hunt';
 (sim.wizardRifts??=[]).push({from,to:{...point},departure,age:0});

 for(const enemy of sim.units)if(!enemy.dead&&(enemy.attackTarget===w.id||enemy.wildlifeRetaliationId===w.id)){
  sim._interruptWork(enemy);enemy.wildlifeRetaliationId=null;enemy.threatTankId=null;enemy.threatUntil=0;enemy.command='idle';enemy.path=[];enemy.velocityX=enemy.velocityZ=0;
 }
 if(!target.dead){
  w.command='attack';w.attackTarget=target.id;w.attackTargetKind='unit';w.wizardRetreating=false;
  eventideStarshard(sim,w,target);w.attackPhase='approach';w.attackCooldown=0;w.eventideResumeId=null;
 }
 if(sim.wildlifeState)sim.wildlifeState.scanClock=0;
 return true;
}
export function updateWizardPositioning(sim,dt){
 sim.wizardRifts=(sim.wizardRifts??[]).filter(e=>(e.age+=dt)<3);
 for(const w of sim.units){
  if(w.type!=='wizard'||w.dead)continue;
  w.eventideVeil=Math.max(0,(w.eventideVeil??0)-dt);w.eventideCooldown=Math.max(0,(w.eventideCooldown??0)-dt);
  w.eventideScan=Math.max(0,(w.eventideScan??0)-dt);
  if(w.eventideVeil>0||w.eventideScan>0)continue;
  w.eventideScan=.15;
  const enemies=sim.units.filter(u=>hostile(w,u));
  const threat=enemies.filter(u=>sim._getExplicitAttackTarget(u)?.id===w.id||distance(w,u)<EVENTIDE.danger).sort((a,b)=>distance(w,a)-distance(w,b))[0];
  if(threat){escapeEventide(sim,w,threat);continue;}
  if(w.eventideResumeId&&w.command==='idle'){
   const target=sim.units.find(u=>u.id===w.eventideResumeId&&!u.dead);
   const defender=target&&sim.units.find(u=>u.id===target.attackTarget&&!u.dead&&u.faction===w.faction&&u.id!==w.id);
   if(!target)w.eventideResumeId=null;
   else if(defender&&distance(w,target)<90&&sim._sendUnitToAttack(w,target))w.eventideResumeId=null;
  }
 }
}
export function prepareWizardPosition(sim,w,target){
 w.wizardRetreating=false;
 if(target.kind!=='unit')return;
 const enemies=sim.units.filter(u=>hostile(w,u)&&distance(u,w)<45);
 const nearest=[...enemies].sort((a,b)=>distance(w,a)-distance(w,b))[0]??target;
 const span=distance(w,nearest),hasLine=sim._hasCombatLineOfSight(w,target);
 // Keep the caster outside the healer ring, with generous swipe clearance.
 const healers=sim.units.filter(u=>!u.dead&&u.faction===w.faction&&u.teamId===w.teamId&&UNIT_TYPES[u.type]?.worker&&distance(u,target)<26);
 const desired=Math.max(Math.min(wizardAttackRange(w)*.72,180),EVENTIDE.distance,...healers.map(u=>distance(u,target)+6));
 if(span>=EVENTIDE.distance-2&&distance(w,target)<=wizardAttackRange(w)&&hasLine){w.path=[];w.velocityX=w.velocityZ=0;return;}
 w.wizardRetreating=span<desired-2;
 if((w.wizardPositionAt??0)>sim.clock)return;
 w.wizardPositionAt=sim.clock+.5;
 const axis=Math.atan2(w.z-target.z,w.x-target.x);
 for(const offset of [0,.3,-.3,.65,-.65,1,-1,1.6,-1.6,Math.PI]){
  const a=axis+offset,point={x:target.x+Math.cos(a)*desired,z:target.z+Math.sin(a)*desired};
  if(enemies.some(u=>distance(u,point)<EVENTIDE.danger+3)||!openWizardLanding(sim,w,point)||!sim._hasCombatLineOfSight(point,target))continue;
  const path=sim._buildPath(w,point);if(!path)continue;
  // Never take a shortcut through the fight while changing sides.
  let prev=w;let safe=true;for(const p of path){for(const e of enemies){const dx=p.x-prev.x,dz=p.z-prev.z,l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((e.x-prev.x)*dx+(e.z-prev.z)*dz)/l)):0;if(distance(e,{x:prev.x+dx*t,z:prev.z+dz*t})<Math.min(EVENTIDE.danger,distance(w,e))-.3)safe=false;}prev=p;}
  if(!safe)continue;
  w.path=path;w.routeTarget=point;w.stopDistance=0;w.fighterMovingAttack=true;
  w.actionLabel='Distant Star · keeping beyond the healer line';return;
 }
 w.path=[];w.velocityX=w.velocityZ=0;w.wizardRetreating=true;
}
