import { bearVariant } from './bear-variants.js?v=20260909-cursedbears1';
import {UNIT_TYPES} from './config.js?v=20260911-heart10';
import {BEAR_FURY,bearFuryActive,bearEnrageActive,isFighter} from './bear-combat.js?v=20260911-heart10';

export const FIRST_CONDEMNATION = Object.freeze({
  id:'firstCondemnation',name:'The First Condemnation',kind:'Permanent elder magic',
  summary:'The first law written beneath their skin.',
  lore:'When the first kings felled the grove that held the sleeping stars, the old gods called the grizzlies of the Greatwood to judgment. The bears had devoured the grove’s keepers. For that hunger, every generation of their blood was bound to guard the forest they had betrayed. The First Condemnation is no passing spell: it is a law laid beneath flesh and bone. Sorcery born after that ancient sentence cannot unmake it. Only the hands that shaped the first dawn may rewrite its terms.',
  effect:'Permanent elder magic. Lesser magic cannot weaken or stun these bears. Their true wounds still matter, and steel can kill them. Elderhide and Thick Hide together limit each landed arrow to one-sixtieth of full health. Ward-protected workers cannot be targeted or harmed.',
  art:'./assets/crownforge-first-condemnation-v1.png?v=20260906-firstcondemnation1',
});
export const GREATWOOD_FURY_ART='./assets/greatwood-fury-card-v1.png?v=20260909-bearfury1';
export const isCurseImmune=unit=>Boolean(UNIT_TYPES[unit?.type]?.curseImmune);
export const isWardProtected=unit=>Boolean(unit?.lastLightWardTimer>0);
// Health used by combat is never replaced by the curse's false reading.
export const displayedUnitHealth=unit=>unit.dead||unit.hp<=0?0:unit.lastLightCurseActive&&isCurseImmune(unit)?1:unit.hp;
export const LAST_BASTION=Object.freeze({threshold:.2,rearmHealth:.6,damageMultiplier:.1,tankDuration:20,bearDuration:60});
const lastStandUnit=u=>u?.type==='shieldbearer'||u?.type==='grizzly';
export const lastBastionActive=u=>Boolean(lastStandUnit(u)&&!u.dead&&u.hp>0&&u.hp/u.maxHp<=LAST_BASTION.rearmHealth&&(u.lastStandTimer??0)>0);
export function updateLastBastion(unit,dt=0){
 if(!lastStandUnit(unit))return;
 if(unit.dead||unit.hp<=0){unit.lastStandTimer=0;return;}
 if(unit.hp/unit.maxHp>LAST_BASTION.rearmHealth){unit.lastStandTimer=0;unit.lastStandSpent=false;return;}
 const activeTime=Math.min(Math.max(0,dt),unit.lastStandTimer??0);
 if(unit.type==='grizzly'&&activeTime>0){
  unit.lastStandHealElapsed=(unit.lastStandHealElapsed??0)+activeTime;
  const pulses=Math.floor((unit.lastStandHealElapsed+1e-8)/5);
  if(pulses){unit.lastStandHealElapsed-=pulses*5;const amount=Math.min(unit.maxHp-unit.hp,unit.maxHp*.10*Math.min(pulses,Math.floor((unit.maxHp*.6-unit.hp)/(unit.maxHp*.10))+1));unit.hp+=amount;unit.healPulse=.85;unit.lastHealAmount=amount;unit.healthRevealTimer=2;}
 }
 unit.lastStandTimer=Math.max(0,(unit.lastStandTimer??0)-dt);
 if(unit.hp/unit.maxHp>LAST_BASTION.rearmHealth){unit.lastStandTimer=0;unit.lastStandSpent=false;return;}
 if(!unit.lastStandSpent&&unit.hp/unit.maxHp<LAST_BASTION.threshold){
  unit.lastStandHealElapsed=0;unit.lastStandSpent=true;unit.lastStandTimer=unit.type==='grizzly'?LAST_BASTION.bearDuration:LAST_BASTION.tankDuration;
 }
}
// Protect only the below-threshold portion of the first crossing hit.
export function lastBastionDamage(unit,damage){
 if(!lastStandUnit(unit)||unit.dead||unit.hp<=0)return damage;
 updateLastBastion(unit);
 if(lastBastionActive(unit))return damage*LAST_BASTION.damageMultiplier;
 if(unit.lastStandSpent)return damage;
 const unprotected=Math.max(0,unit.hp-unit.maxHp*LAST_BASTION.threshold);
 if(damage<=unprotected)return damage;
 unit.lastStandHealElapsed=0;unit.lastStandSpent=true;unit.lastStandTimer=unit.type==='grizzly'?LAST_BASTION.bearDuration:LAST_BASTION.tankDuration;
 return unprotected+(damage-unprotected)*LAST_BASTION.damageMultiplier;
}
export function strikeDamage(attacker,target){
  const rules=UNIT_TYPES[attacker.type],worker=UNIT_TYPES[target?.type]?.worker;
  const tankPressure=attacker.type==='grizzly'&&UNIT_TYPES[target?.type]?.combatRole==='tank'?6:1;
  const base=tankPressure*(bearEnrageActive(attacker)?2:1)*(rules.workerStrikeFraction&&worker?Math.ceil(target.maxHp*rules.workerStrikeFraction):worker?(rules.attackVsVillager??rules.attack):rules.attack);
  if(!bearFuryActive(attacker))return base;
  const empowered=base*BEAR_FURY.multiplier;
  return isFighter(target)&&UNIT_TYPES[target.type]?.combatRole!=='tank'?Math.max(empowered,target.hp):empowered;
}
export function unitStatuses(unit){
  const statuses=[],elder=isCurseImmune(unit),fury=bearFuryActive(unit);
  if(unit.type==='shieldbearer')statuses.push({id:'oathboundStride',name:'Oathbound Stride',kind:'Permanent blessing',detail:'1.5× fastest base movement',summary:'The sworn shield reaches danger first.',effect:'Base movement speed is 1.5 times the fastest other unit. Terrain and roads still apply.',rune:'ward'});
  if(bearEnrageActive(unit))statuses.push({id:'greatwoodColossus',name:'Greatwood Colossus',kind:'Enrage',detail:'50% true health · double size and damage',summary:'Wounded ancient blood awakens a towering guardian.',effect:'At half true health, doubles body size, collision radius, and damage for the rest of its life. Stacks with Wrath of the First Oath. Bloodclaw Reckoning sweeps within 14 units every 8 seconds: rear damage fighters are left at 10% maximum health.',rune:'fury',art:bearVariant(unit).art});
  if(bearEnrageActive(unit)||fury)statuses.push({id:'bloodclawReckoning',name:'Bloodclaw Reckoning',kind:'Special swipe',detail:'8-second cooldown · rear DPS to 10% HP',summary:'Three crimson claws tear across the battle line.',effect:'Within 14 units and clear line of sight, the frontal fan takes normal empowered strike damage. Rear damage fighters drop to 10% maximum health, never healed upward. Tanks and healers are excluded from the rear damage pulse. Ward protection is respected.',rune:'fury',art:bearVariant(unit).art});
  if(lastBastionActive(unit))statuses.push({id:unit.type==='grizzly'?'unbrokenWild':'crownsLastBastion',name:unit.type==='grizzly'?'Heart of the Unbroken Wild':'The Crown’s Last Bastion',kind:'Last stand · active',detail:`${Math.ceil(unit.lastStandTimer)}s · 90% less incoming damage`,summary:unit.type==='grizzly'?'The ancient wild refuses to yield its heart.':'When the crown has nowhere left to retreat, its shield becomes a fortress.',effect:`Triggers below 20% true health and reduces damage after armor by 90%. Lasts up to ${unit.type==='grizzly'?60:20} seconds, ending early only above 60% health. Crossing damage below 20% is protected. Must heal above 60% to rearm after use.${unit.type==='grizzly'?' Also restores 10% maximum health every 5 seconds while active.':''}`,rune:'ward',art:unit.type==='grizzly'?bearVariant(unit).art:undefined});
  if(elder)statuses.push({id:'crushingClaws',name:'Crushing Claws',kind:'Tank pressure',detail:'6× strike damage against tanks',summary:'Greatwood claws crush a shield line.',effect:'Bear strikes against tanks deal six times their previous damage before armor. Colossus and Wrath still stack.',rune:'fury',art:bearVariant(unit).art});
  if(elder){
    const bloodline=bearVariant(unit);
    statuses.push({...FIRST_CONDEMNATION,art:bloodline.art,detail:'Permanent · elder magic',rune:'divine'});
    statuses.push({id:'elderhide',name:'Elderhide',kind:'Permanent protection',detail:'60 arrows with Thick Hide',summary:'Ancient hide turns aside the bite of arrows.',lore:'The sentence of the old gods sank into hide as well as blood. Arrowheads splinter against the Greatwood bears like rain upon a weathered standing stone.',effect:`Elderhide limits each arrow to 1/30 of full health before Thick Hide halves that damage again (${Number((unit.maxHp/BEAR_FURY.arrowHits/2).toFixed(2))} damage). Without the temporary Heart protection, 60 arrows are required. Existing wounds are never restored.`,rune:'ward',art:bloodline.art});
    statuses.push({id:'thickHide',name:'Thick Hide',kind:'Permanent armor',detail:'+100% armor · twice the durability',summary:'A second life of punishment beneath the fur.',lore:'The old sentence hardened into hide. Dense guard hairs cover layers of scarred flesh that turn blades and swallow the force of arrows.',effect:'Reduces all incoming damage by 50% after Elderhide. Twice the effective durability against the same attacks; 60 arrows from full true health without temporary Heart protection. Does not heal wounds or change the fury threshold.',rune:'ward',art:bloodline.art});
    statuses.push({id:'bearLineage',name:bloodline.name,kind:bloodline.kind,detail:'Greatwood bloodline · read their story',summary:bloodline.summary,lore:bloodline.lore,effect:'Bound by the permanent First Condemnation. Thick Hide grants +100% armor and twice the durability. The old gods alone can rewrite the sentence.',rune:'divine',art:bloodline.art});
  }
  if(unit.lastLightWardTimer>0)statuses.push({id:'ward',name:'Last Light Ward',kind:'Protection',detail:`${Math.ceil(unit.lastLightWardTimer)}s · invulnerable`,summary:'Protected from damage and attack targeting.',lore:'At the edge of death, the Hearthkin’s last light becomes a refuge. For one minute, no blow can touch them.',effect:'Health restored. Untargetable by attacks until the ward expires. Bears seek other prey.',rune:'ward'});
  if(unit.lastLightCurseActive)statuses.push({id:'lastLight',name:elder?'The Borrowed Last Breath':'Last Light Curse',kind:'Curse',detail:elder?'1 HP shown · hidden strength':'1 HP · next damage is fatal',summary:elder?'The rune is real. The weakness is a lure.':'The next wound will be the last.',lore:elder?bearVariant(unit).trickery:'The light that saved another life has named its price. A thorned mark hangs above the aggressor, and the smallest wound will now claim them.',effect:elder?'The lesser rune and 1 HP reading appear, but true health and existing wounds remain unchanged. The apparent nearness of death awakens Wrath of the First Oath immediately. With Thick Hide, arrows need 60 hits from full true health before temporary Heart protection.':'Health reduced to 1. Any positive damage is fatal.',rune:'curse',art:elder?bearVariant(unit).art:undefined});
  if(fury)statuses.push({id:'greatwoodFury',name:'Wrath of the First Oath',kind:'Fury · active',detail:'6× damage · frontal swipe',summary:'The ancient sentence answers the scent of death.',lore:unit.lastLightCurseActive?'A borrowed death-mark is enough to stir the old sentence. These bears need not be dying: the promise of a last breath calls the same terrible strength. Those drawn to the lesser rune meet the fury of the first oath.':'As a Greatwood bear’s strength falls to its last tenth, the first oath tightens. The condemned blood remembers the ruin of the star-grove. A final measure of the old gods’ wrath passes into every claw.',effect:'Active at 10% true health or while Last Light shows a false 1 HP. Multiplies damage by six and stacks with Greatwood Colossus for twelve times base damage. Landed hits remain lethal to non-tank fighters. Swipes hit all unprotected hostile units in the front 160-degree fan within 14 units and clear line of sight. Bloodclaw Reckoning also reduces rear damage fighters to 10% maximum health, without raising anyone already below that amount. Shieldbearer hits refresh an 8-second threat lock.',rune:'fury',art:bearVariant(unit).art});
  if(unit.stunTimer>0)statuses.push({id:'stun',name:'Stunned',kind:'Impairment',detail:`${Math.ceil(unit.stunTimer)}s remaining`,summary:'Movement and attacks are interrupted.',rune:'stun'});
  if(unit.stunImmunityTimer>0)statuses.push({id:'stunImmunity',name:'Steadfast',kind:'Protection',detail:`${Math.ceil(unit.stunImmunityTimer)}s · stun immunity`,summary:'Cannot be stunned while this protection lasts.',rune:'ward'});
  return statuses;
}

// One authored thorned glyph shared by Canvas markers and the inspection UI.
// Open barbs and a broken crown replace the old diamond and pulsing circle.
export const SIGIL_STROKES=[[[0,-14],[0,13],[-3,17]], [[-10,-13],[-7,-6],[0,-10],[7,-6],[10,-13]], [[-12,-3],[-7,3],[0,-1],[7,3],[12,-3]], [[-8,8],[0,5],[8,8]], [[-5,13],[0,10],[5,13]]];
export const SIGIL_COLORS={divine:'#cd8656',curse:'#bd8ec9',ward:'#d6c995',stun:'#c99b67'};
export function sigilSvg(kind='curse'){
  if(kind==='fury')return '<svg viewBox="-19 -20 38 42" aria-hidden="true" fill="none" stroke="#e98b56" stroke-width="2.6"><path d="M-10-15Q-15 0-9 15L-3 8 M0-17Q-5 0 1 17L7 9 M10-14Q5 0 11 14L16 7"/></svg>';
  if(kind==='ward')return '<svg viewBox="-19 -20 38 42" aria-hidden="true" fill="none" stroke="#d6c995" stroke-width="2"><path d="M-12-12Q0-18 12-12L10 3Q7 11 0 16Q-7 11-10 3Z M0-10V9 M-6-3L0-7 6-3 M-5 3L0-1 5 3"/></svg>';
  if(kind==='stun')return '<svg viewBox="-19 -20 38 42" aria-hidden="true" fill="none" stroke="#c99b67" stroke-width="2"><path d="M2-15L-7 1H0L-2 16 9-3H2Z M-14-8L-10-6 M10 10L14 12"/></svg>';
  const paths=SIGIL_STROKES.map(points=>`<polyline points="${points.map(p=>p.join(',')).join(' ')}"/>`).join('');
  return `<svg viewBox="-19 -20 38 42" aria-hidden="true" fill="none" stroke="${SIGIL_COLORS[kind]??SIGIL_COLORS.curse}" stroke-width="2.2" stroke-linejoin="miter">${paths}</svg>`;
}
export function curseRuneKind(unit){return unit.lastLightCurseActive?'curse':isCurseImmune(unit)?'divine':null;}
export function drawCurseSigil(ctx,kind,x,y,size){
  ctx.save();ctx.translate(x,y);ctx.scale(size/38,size/38);ctx.lineCap='square';ctx.lineJoin='miter';
  for(const [color,width] of [['#231a1b',5],[SIGIL_COLORS[kind]??SIGIL_COLORS.curse,2.2]]){
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();
    for(const points of SIGIL_STROKES){ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);}
    ctx.stroke();
  }
  ctx.restore();
}
