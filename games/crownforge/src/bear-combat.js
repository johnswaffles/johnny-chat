import { UNIT_TYPES } from './config.js?v=20260911-heart10';

export const BEAR_FURY = Object.freeze({threshold:.1, multiplier:6, extraTargets:2, radius:14, arrowHits:30});
export const THICK_HIDE=Object.freeze({armorBonus:100,damageMultiplier:.5});
export const bearIncomingDamage=(unit,amount,type='weapon')=>unit?.type==='grizzly'?(type==='arrow'&&amount>0?bearArrowDamage(unit):amount)*THICK_HIDE.damageMultiplier:amount;
export const BEAR_DEATH = Object.freeze({collapse:1.8, holdUntil:5, lifetime:6});
export const FIGHTER_PURSUIT = Object.freeze({trackDistance:6, reachBonus:.45});
export function isFighter(unit){
  const rule=UNIT_TYPES[unit?.type];
  return Boolean(unit && !unit.dead && ['player','enemy'].includes(unit.faction) && rule && !rule.worker && !rule.wildlife && rule.attack>0 && rule.canAttackUnits!==false);
}
export function bearFuryActive(unit){
  return Boolean(unit?.type==='grizzly' && !unit.dead && unit.hp>0 && (unit.hp/unit.maxHp<=BEAR_FURY.threshold || unit.lastLightCurseActive));
}
export const bearArrowDamage=unit=>unit.maxHp/BEAR_FURY.arrowHits;
export const corpseLifetime=unit=>unit.type==='grizzly'?BEAR_DEATH.lifetime:2.4;

// True wounds alone awaken this second, independent layer of rage.
export const GREATWOOD_COLOSSUS=Object.freeze({threshold:.5,size:2,damage:2,radius:3});
export const bearEnrageActive=u=>Boolean(u?.type==='grizzly'&&!u.dead&&u.hp>0&&(u.greatwoodEnraged||u.hp/u.maxHp<=GREATWOOD_COLOSSUS.threshold));
export const bearBodyScale=u=>u?.type==='grizzly'&&(u.greatwoodEnraged||u.hp>0&&u.hp/u.maxHp<=.5)?2:1;
export const combatRadius=u=>u?.type==='grizzly'?GREATWOOD_COLOSSUS.radius*bearBodyScale(u):(UNIT_TYPES[u?.type]?.radius??.4);
export function inBearSwipe(bear,target,front=bear.bearSwipeDirection){
 if(!front)return false;
 const dx=target.x-bear.x,dz=target.z-bear.z,len=Math.hypot(dx,dz);
 // A 160-degree frontal fan. The whole rear hemisphere is safe.
 return len<=BEAR_FURY.radius&&len>0&&((dx*front.x+dz*front.z)/len)>=Math.cos(80*Math.PI/180);
}
