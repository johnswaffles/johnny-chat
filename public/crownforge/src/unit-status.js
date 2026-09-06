import {UNIT_TYPES} from './config.js?v=20260906-firstcondemnation1';

export const FIRST_CONDEMNATION = Object.freeze({
  id:'firstCondemnation',name:'The First Condemnation',kind:'Divine curse',
  summary:'No lesser curse can take hold.',
  lore:'Before the first crown was forged, this bear broke the silence of a sacred grove. God marked it and condemned it to wander beneath the trees until their last root withers. No lesser curse may claim what Heaven has already condemned.',
  effect:'Immune to other curses. Steel can still wound it. Two landed blows awaken a healthy Hearthkin’s Last Light Ward; the bear then loses all sight of the shielded worker.',
  art:'./assets/crownforge-first-condemnation-v1.png?v=20260906-firstcondemnation1',
});
export const isCurseImmune=unit=>Boolean(UNIT_TYPES[unit?.type]?.curseImmune);
export const isWardProtected=unit=>Boolean(unit?.lastLightWardTimer>0);
export function strikeDamage(attacker,target){
  const rules=UNIT_TYPES[attacker.type];
  if(rules.workerStrikeFraction&&UNIT_TYPES[target?.type]?.worker)return Math.ceil(target.maxHp*rules.workerStrikeFraction);
  return UNIT_TYPES[target?.type]?.worker?(rules.attackVsVillager??rules.attack):rules.attack;
}
export function unitStatuses(unit){
  const statuses=[];
  if(isCurseImmune(unit))statuses.push({...FIRST_CONDEMNATION,detail:'Permanent · curse immunity',rune:'divine'});
  if(unit.lastLightWardTimer>0)statuses.push({id:'ward',name:'Last Light Ward',kind:'Protection',detail:`${Math.ceil(unit.lastLightWardTimer)}s · invulnerable`,summary:'Protected from damage and attack targeting.',lore:'At the edge of death, the Hearthkin’s last light becomes a refuge. For one minute, no blow can touch them.',effect:'Health restored. Untargetable by attacks until the ward expires. Bears seek other prey.',rune:'ward'});
  if(unit.lastLightCurseActive&&!isCurseImmune(unit))statuses.push({id:'lastLight',name:'Last Light Curse',kind:'Curse',detail:'1 HP · next damage is fatal',summary:'The next wound will be the last.',lore:'The light that saved another life has named its price. A thorned mark hangs above the aggressor, and the smallest wound will now claim them.',effect:'Health reduced to 1. Any positive damage is fatal.',rune:'curse'});
  if(unit.stunTimer>0)statuses.push({id:'stun',name:'Stunned',kind:'Impairment',detail:`${Math.ceil(unit.stunTimer)}s remaining`,summary:'Movement and attacks are interrupted.',rune:'stun'});
  if(unit.stunImmunityTimer>0)statuses.push({id:'stunImmunity',name:'Steadfast',kind:'Protection',detail:`${Math.ceil(unit.stunImmunityTimer)}s · stun immunity`,summary:'Cannot be stunned while this protection lasts.',rune:'ward'});
  return statuses;
}

// One authored thorned glyph shared by Canvas markers and the inspection UI.
// Open barbs and a broken crown replace the old diamond and pulsing circle.
export const SIGIL_STROKES=[[[0,-14],[0,13],[-3,17]], [[-10,-13],[-7,-6],[0,-10],[7,-6],[10,-13]], [[-12,-3],[-7,3],[0,-1],[7,3],[12,-3]], [[-8,8],[0,5],[8,8]], [[-5,13],[0,10],[5,13]]];
export const SIGIL_COLORS={divine:'#cd8656',curse:'#bd8ec9',ward:'#d6c995',stun:'#c99b67'};
export function sigilSvg(kind='curse'){
  if(kind==='ward')return '<svg viewBox="-19 -20 38 42" aria-hidden="true" fill="none" stroke="#d6c995" stroke-width="2"><path d="M-12-12Q0-18 12-12L10 3Q7 11 0 16Q-7 11-10 3Z M0-10V9 M-6-3L0-7 6-3 M-5 3L0-1 5 3"/></svg>';
  if(kind==='stun')return '<svg viewBox="-19 -20 38 42" aria-hidden="true" fill="none" stroke="#c99b67" stroke-width="2"><path d="M2-15L-7 1H0L-2 16 9-3H2Z M-14-8L-10-6 M10 10L14 12"/></svg>';
  const paths=SIGIL_STROKES.map(points=>`<polyline points="${points.map(p=>p.join(',')).join(' ')}"/>`).join('');
  return `<svg viewBox="-19 -20 38 42" aria-hidden="true" fill="none" stroke="${SIGIL_COLORS[kind]??SIGIL_COLORS.curse}" stroke-width="2.2" stroke-linejoin="miter">${paths}</svg>`;
}
export function curseRuneKind(unit){return isCurseImmune(unit)?'divine':unit.lastLightCurseActive?'curse':null;}
export function drawCurseSigil(ctx,kind,x,y,size){
  ctx.save();ctx.translate(x,y);ctx.scale(size/38,size/38);ctx.lineCap='square';ctx.lineJoin='miter';
  for(const [color,width] of [['#231a1b',5],[SIGIL_COLORS[kind]??SIGIL_COLORS.curse,2.2]]){
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();
    for(const points of SIGIL_STROKES){ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);}
    ctx.stroke();
  }
  ctx.restore();
}
