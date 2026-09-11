import { UNIT_TYPES } from './config.js?v=20260911-pause1';

export const BEAR_FURY = Object.freeze({threshold:.1, multiplier:6, extraTargets:2, radius:10, arrowHits:30});
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
