import {updateWizardPositioning} from './wizard-positioning.js?v=20260923-toolbar3';
import {updateStormDragons} from './storm-dragon.js?v=20260923-toolbar3';
export const WIZARD_SPELLS=Object.freeze({starshard:36,starfall:64,radius:7,starfallCooldown:12,mantleDuration:6,mantleCooldown:30,mantleReduction:.7});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function castWizardSpell(sim,wizard,target){
 if(wizard.dead||target.dead)return;
 const nova=(wizard.starfallCooldown??0)<=0;
 (sim.wizardProjectiles??=[]).push({sourceId:wizard.id,faction:wizard.faction,targetId:target.id,x:wizard.x,z:wizard.z,from:{x:wizard.x,z:wizard.z},age:0,nova,damage:WIZARD_SPELLS.starshard*(wizard.skybreakerFavor>0?1.5:1)});
 wizard.lastWizardSpell=nova?'Falling Constellation':'Starshard';wizard.wizardCastPulse=.6;
 if(nova)wizard.starfallCooldown=WIZARD_SPELLS.starfallCooldown;
}
export function wizardIncomingDamage(unit,amount){
 if(unit.type!=='wizard')return amount;
 if(!(unit.astralMantleTimer>0)&&!(unit.astralMantleCooldown>0)&&(unit.hp-amount<unit.maxHp*.35)){
  unit.astralMantleTimer=WIZARD_SPELLS.mantleDuration;unit.astralMantleCooldown=WIZARD_SPELLS.mantleCooldown;
 }
 return amount*(unit.astralMantleTimer>0?1-WIZARD_SPELLS.mantleReduction:1);
}
export function updateWizardMagic(sim,dt){
 updateWizardPositioning(sim,dt);
 updateStormDragons(sim,dt);
 for(const u of sim.units)if(u.type==='wizard')for(const key of ['starfallCooldown','astralMantleTimer','astralMantleCooldown','wizardCastPulse'])u[key]=Math.max(0,(u[key]??0)-dt);
 sim.wizardImpacts=(sim.wizardImpacts??[]).filter(e=>(e.age+=dt)<(e.nova?3.2:1.85));
 sim.wizardProjectiles=(sim.wizardProjectiles??[]).filter(p=>{
  p.age+=dt;const target=sim.units.find(u=>u.id===p.targetId&&!u.dead),source=sim.units.find(u=>u.id===p.sourceId);if(!target||p.age>40)return false;
  const gap=dist(p,target),step=(p.speed??Math.max(36,dist(p.from,target)/2))*dt;
  if(gap>step+.5){p.x+=(target.x-p.x)/gap*step;p.z+=(target.z-p.z)/gap*step;return true;}
  if(!sim._hasCombatLineOfSight(p,target))return false;
  if(p.visualOnly)return false;
  sim._applyUnitDamage(target,p.damage,source,{damageType:'arcane',magical:true});
  if(p.nova)for(const enemy of sim.units)if(!enemy.dead&&enemy.faction!==p.faction&&enemy.faction!=='neutral'&&dist(enemy,target)<=WIZARD_SPELLS.radius&&sim._hasCombatLineOfSight(target,enemy))sim._applyUnitDamage(enemy,WIZARD_SPELLS.starfall,source,{damageType:'arcane',magical:true,areaOfEffect:true});
  sim.wizardImpacts.push({x:target.x,z:target.z,age:0,nova:p.nova});return false;
 });
}
export {drawWizardMagic} from './starveil-effects.js?v=20260923-toolbar3';
