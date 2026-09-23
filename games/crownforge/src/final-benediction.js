import {UNIT_TYPES} from './config.js?v=20260923-firstage1';
export const BENEDICTION_DURATION=15;
export function grantFinalBenediction(sim,tank,attacker){
 if(tank.dead||tank.finalBenedictionSpent||UNIT_TYPES[tank.type]?.combatRole!=='tank')return false;
 const hearth=sim.units.filter(u=>!u.dead&&u.hp>0&&u.faction===tank.faction&&u.type==='villager'&&Math.hypot(u.x-tank.x,u.z-tank.z)<=29&&sim._hasCombatLineOfSight(u,tank))
  .sort((a,b)=>Math.hypot(a.x-tank.x,a.z-tank.z)-Math.hypot(b.x-tank.x,b.z-tank.z)||a.id-b.id)[0];
 if(!hearth)return false;
 tank.finalBenedictionSpent=true;tank.finalBenedictionRemaining=BENEDICTION_DURATION;tank.finalBenedictionSourceId=hearth.id;tank.finalBenedictionKillerId=attacker?.id??null;tank.hp=1;
 hearth.finalBenedictionCastRemaining=BENEDICTION_DURATION;
 tank.healthRevealTimer=BENEDICTION_DURATION;
 pulseLastBreath(sim,tank);
 sim._announce('Benediction of the Final Dawn — fifteen final seconds. “Child… your time has come. Return to the Creator.”');
 return true;
}
export function updateFinalBenediction(sim,unit,dt){
 unit.finalBenedictionCastRemaining=Math.max(0,(unit.finalBenedictionCastRemaining??0)-dt);
 if(!(unit.finalBenedictionRemaining>0))return false;
 unit.hp=1;
 unit.finalBenedictionRemaining=Math.max(0,unit.finalBenedictionRemaining-dt);
 if(unit.finalBenedictionRemaining<=1e-8){unit.finalBenedictionRemaining=0;sim._killUnit(unit,sim.units.find(u=>u.id===unit.finalBenedictionKillerId));return true;}
 unit.finalBenedictionTauntCooldown=Math.max(0,(unit.finalBenedictionTauntCooldown??0)-dt);
 if(unit.finalBenedictionTauntCooldown<=0)pulseLastBreath(sim,unit);
 return false;
}
export function finalBenedictionStatus(unit){
 const active=unit.finalBenedictionRemaining>0,casting=unit.finalBenedictionCastRemaining>0;
 if(!active&&unit.type!=='villager')return null;
 return {id:'finalBenediction',name:'Benediction of the Final Dawn',kind:active?'Irrevocable blessing':'Hearthkin blessing',rune:'divine',
 detail:active?`${Math.ceil(unit.finalBenedictionRemaining)}s remaining`:casting?'The farewell is spoken':'Fatal tank wound · 15 final seconds',
 summary:'“Child… your time has come. Return to the Creator.”',
 lore:'The Hearthkin kneels before no throne. Yet for a fallen shield, they bow their head. “Hero. Beloved child of the Creator. You have carried enough.” Death approaches, but must wait for the Hearthkin’s blessing. Fifteen heartbeats of eternity are granted: time to raise a shield once more, to face the dawn without fear. Then the road opens home. No healing may recall the soul. No god may intercede. This is not a bargain with death. It is the farewell of one who knew you before the first star burned.',
 effect:active?'When the blessing ends, you die. Neither healing nor gods can intervene.':'Automatically blesses a friendly tank receiving a fatal hit within 29 units and clear line of sight. Grants fifteen final seconds at 1 health, then certain death. Once per tank’s life; cannot be refreshed or dispelled. Healing cannot save the blessed tank.'};
}

export const LAST_BREATH_RADIUS=48;
export function lastBreathTarget(sim,enemy){
 const tank=sim.units.find(u=>u.id===enemy?.lastBreathTankId&&!u.dead&&u.hp>0&&u.finalBenedictionRemaining>0&&u.faction!==enemy.faction&&Math.hypot(u.x-enemy.x,u.z-enemy.z)<=LAST_BREATH_RADIUS);
 if(!tank&&enemy)delete enemy.lastBreathTankId;
 return tank??null;
}
export function pulseLastBreath(sim,tank){
 tank.finalBenedictionTauntCooldown=.5;
 for(const enemy of sim.units){
  if(enemy===tank||enemy.dead||enemy.hp<=0||enemy.faction===tank.faction||!['player','enemy','wildlife'].includes(enemy.faction)||UNIT_TYPES[enemy.type]?.canAttackUnits===false||Math.hypot(enemy.x-tank.x,enemy.z-tank.z)>LAST_BREATH_RADIUS)continue;
  // A second dying hero cannot steal an existing final stand's attackers.
  const owner=lastBreathTarget(sim,enemy);if(owner&&owner!==tank)continue;
  enemy.lastBreathTankId=tank.id;enemy.threatTankId=tank.id;enemy.threatUntil=sim.clock+tank.finalBenedictionRemaining;
  if(enemy.attackTarget!==tank.id||enemy.command!=='attack')sim._sendUnitToAttack(enemy,tank);
 }
}
export function lastBreathStatus(unit){
 if(!(unit.finalBenedictionRemaining>0))return null;
 return {id:'lastBreathDefiance',name:'Defiance of the Last Breath',kind:'Final stand',rune:'divine',detail:`${Math.ceil(unit.finalBenedictionRemaining)}s · 48-unit taunt`,summary:'“Until my last breath… you face me.”',lore:'The road home stands open, but the hero turns their shield toward the living. One final challenge rolls across the field. Let every claw and blade come. Let their companions see another dawn.',effect:'Draws nearby enemies onto this hero, including new arrivals. Repeats every half-second until the blessing ends.'};
}
