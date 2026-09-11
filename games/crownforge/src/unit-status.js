import { bearVariant } from './bear-variants.js?v=20260909-cursedbears1';
import {UNIT_TYPES} from './config.js?v=20260911-singleteam1';
import {BEAR_FURY,bearFuryActive,isFighter} from './bear-combat.js?v=20260911-singleteam1';

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
export function strikeDamage(attacker,target){
  const rules=UNIT_TYPES[attacker.type],worker=UNIT_TYPES[target?.type]?.worker;
  const base=rules.workerStrikeFraction&&worker?Math.ceil(target.maxHp*rules.workerStrikeFraction):worker?(rules.attackVsVillager??rules.attack):rules.attack;
  if(!bearFuryActive(attacker))return base;
  const empowered=base*BEAR_FURY.multiplier;
  return isFighter(target)&&UNIT_TYPES[target.type]?.combatRole!=='tank'?Math.max(empowered,target.hp):empowered;
}
export function unitStatuses(unit){
  const statuses=[],elder=isCurseImmune(unit),fury=bearFuryActive(unit);
  if(elder){
    const bloodline=bearVariant(unit);
    statuses.push({...FIRST_CONDEMNATION,art:bloodline.art,detail:'Permanent · elder magic',rune:'divine'});
    statuses.push({id:'elderhide',name:'Elderhide',kind:'Permanent protection',detail:'60 arrows with Thick Hide',summary:'Ancient hide turns aside the bite of arrows.',lore:'The sentence of the old gods sank into hide as well as blood. Arrowheads splinter against the Greatwood bears like rain upon a weathered standing stone.',effect:`Elderhide limits each arrow to 1/30 of full health before Thick Hide halves that damage again (${Number((unit.maxHp/BEAR_FURY.arrowHits/2).toFixed(2))} damage). From full true health, 60 arrows are required. Existing wounds are never restored.`,rune:'ward',art:bloodline.art});
    statuses.push({id:'thickHide',name:'Thick Hide',kind:'Permanent armor',detail:'+100% armor · twice the durability',summary:'A second life of punishment beneath the fur.',lore:'The old sentence hardened into hide. Dense guard hairs cover layers of scarred flesh that turn blades and swallow the force of arrows.',effect:'Reduces all incoming damage by 50% after Elderhide. Twice the effective durability against the same attacks; 60 arrows from full true health. Does not heal wounds or change the fury threshold.',rune:'ward',art:bloodline.art});
    statuses.push({id:'bearLineage',name:bloodline.name,kind:bloodline.kind,detail:'Greatwood bloodline · read their story',summary:bloodline.summary,lore:bloodline.lore,effect:'Bound by the permanent First Condemnation. Thick Hide grants +100% armor and twice the durability. The old gods alone can rewrite the sentence.',rune:'divine',art:bloodline.art});
  }
  if(unit.lastLightWardTimer>0)statuses.push({id:'ward',name:'Last Light Ward',kind:'Protection',detail:`${Math.ceil(unit.lastLightWardTimer)}s · invulnerable`,summary:'Protected from damage and attack targeting.',lore:'At the edge of death, the Hearthkin’s last light becomes a refuge. For one minute, no blow can touch them.',effect:'Health restored. Untargetable by attacks until the ward expires. Bears seek other prey.',rune:'ward'});
  if(unit.lastLightCurseActive)statuses.push({id:'lastLight',name:elder?'The Borrowed Last Breath':'Last Light Curse',kind:'Curse',detail:elder?'1 HP shown · hidden strength':'1 HP · next damage is fatal',summary:elder?'The rune is real. The weakness is a lure.':'The next wound will be the last.',lore:elder?bearVariant(unit).trickery:'The light that saved another life has named its price. A thorned mark hangs above the aggressor, and the smallest wound will now claim them.',effect:elder?'The lesser rune and 1 HP reading appear, but true health and existing wounds remain unchanged. The apparent nearness of death awakens Wrath of the First Oath immediately. With Thick Hide, arrows need 60 hits from full true health.':'Health reduced to 1. Any positive damage is fatal.',rune:'curse',art:elder?bearVariant(unit).art:undefined});
  if(fury)statuses.push({id:'greatwoodFury',name:'Wrath of the First Oath',kind:'Fury · active',detail:'+500% damage · three-target swipe',summary:'The ancient sentence answers the scent of death.',lore:unit.lastLightCurseActive?'A borrowed death-mark is enough to stir the old sentence. These bears need not be dying: the promise of a last breath calls the same terrible strength. Those drawn to the lesser rune meet the fury of the first oath.':'As a Greatwood bear’s strength falls to its last tenth, the first oath tightens. The condemned blood remembers the ruin of the star-grove. A final measure of the old gods’ wrath passes into every claw.',effect:'Active at 10% true health or less, or while Last Light shows a false 1 HP. Damage rises by 500% (6×); a landed blow is lethal to non-tank fighters. Shieldbearers withstand 50 landed unhealed hits from full health after armor; four of every five melee swings are dodged. Each successful swipe also strikes up to two other nearby fighters within 10 world units of the bear, with clear line of sight. Protected workers remain unharmed. Shieldbearer hits hold its attention for 8 seconds, refreshed by each hit. While focused on a tank, the swipe does not cleave other fighters.',rune:'fury',art:bearVariant(unit).art});
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
