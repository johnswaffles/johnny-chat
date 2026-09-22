// Eventide's range is lifetime-limited; Reckoning belongs to one uninterrupted duel.
export const ascendancyStacks=w=>Math.max(0,Math.min(5,Math.floor(w.eventideRangeStacks??0)));
export const wizardAttackRange=w=>36*2**ascendancyStacks(w);
export function reckoningDamage(sim,target,amount,attacker,magical){
 if(!(amount>0)||!attacker?.id)return amount;
 const eligible=attacker.type==='wizard'&&ascendancyStacks(attacker)>0&&magical;
 if(target.reckoningCasterId&&target.reckoningCasterId!==attacker.id){
  const previous=sim.units.find(u=>u.id===target.reckoningCasterId);
  if(previous?.reckoningTargetId===target.id)previous.reckoningStacks=0;
  target.reckoningCasterId=null;target.reckoningStacks=0;
 }
 if(!eligible)return amount;
 if(attacker.reckoningTargetId!==target.id){
  const previous=sim.units.find(u=>u.id===attacker.reckoningTargetId);
  if(previous?.reckoningCasterId===attacker.id){previous.reckoningCasterId=null;previous.reckoningStacks=0;}
  attacker.reckoningTargetId=target.id;attacker.reckoningStacks=0;
 }
 const stacks=Math.min(1023,(target.reckoningCasterId===attacker.id?target.reckoningStacks??0:0)+1);
 target.reckoningCasterId=attacker.id;target.reckoningStacks=stacks;attacker.reckoningStacks=stacks;
 // Saturate arithmetic instead of overflowing to Infinity during very long fights.
 return Math.min(Number.MAX_VALUE/1e6,amount*2**Math.min(stacks,990));
}
export function eventideStarshard(sim,w,target){
 if(!target||target.dead||target.faction===w.faction||!sim._hasCombatLineOfSight(w,target))return;
 w.visualState='attack';w.wizardCastPulse=.6;w.lastWizardSpell='Eventide Ascendancy';
 const dx=target.x-w.x,dz=target.z-w.z;w.paintedFacing=dx+dz>=0?(dx-dz>=0?0:1):(dx-dz>=0?2:3);w.attackPhase='contact';w.attackPhaseElapsed=0;
 const from={x:w.x,z:w.z};
 (sim.wizardProjectiles??=[]).push({sourceId:w.id,faction:w.faction,targetId:target.id,...from,from,age:0,nova:false,visualOnly:true,speed:Math.max(80,Math.hypot(target.x-w.x,target.z-w.z)/.16)});
 sim._applyUnitDamage(target,36*(w.skybreakerFavor>0?1.5:1),w,{damageType:'arcane',magical:true});
 (sim.wizardImpacts??=[]).push({x:target.x,z:target.z,age:0,nova:false});
}
