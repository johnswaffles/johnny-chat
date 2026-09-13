import {UNIT_TYPES} from './config.js?v=20260913-firstoath1';
import {unitStatuses,displayedUnitHealth} from './unit-status.js?v=20260913-firstoath1';
import {bearVariant} from './bear-variants.js?v=20260913-firstoath1';

const alive=u=>u&&!u.dead&&u.hp>0;
const tank=u=>UNIT_TYPES[u.type]?.combatRole==='tank';
const name=u=>u.type==='grizzly'?bearVariant(u).name:UNIT_TYPES[u.type]?.label??u.type;
// Track combat relationships, not selection or mere proximity. Grace prevents frame flicker during repositioning.
export function encounterUnits(sim){
 const live=new Map(sim.units.filter(alive).map(u=>[u.id,u])),enemies=new Set(),allies=new Set(),threatened=new Set();
 for(const u of live.values()){
  const target=live.get(u.command==='attack'?u.attackTarget:u.teamAdvanceTargetId);
  if(!target||u.faction===target.faction)continue;
  if(u.faction==='player'&&target.faction!=='player'){allies.add(u.id);enemies.add(target.id);}
  if(u.faction!=='player'&&target.faction==='player'){enemies.add(u.id);allies.add(target.id);threatened.add(target.id);}
 }
 const teams=new Set([...allies].map(id=>live.get(id).teamId).filter(Boolean));
 return [...live.values()].filter(u=>enemies.has(u.id)||(u.faction==='player'&&(threatened.has(u.id)||(tank(u)&&(allies.has(u.id)||teams.has(u.teamId)))))).sort((a,b)=>Number(b.faction==='player')-Number(a.faction==='player'));
}
export function focusedCombatUnits(sim,units){
 const enemies=units.filter(u=>u.faction!=='player').slice(0,3);
 const friends=units.filter(u=>u.faction==='player'&&alive(u));
 const recentFirst=(a,b)=>(b.lastCombatDamageAt??-Infinity)-(a.lastCombatDamageAt??-Infinity)||Number(tank(b))-Number(tank(a))||a.id-b.id;
 const targets=friends.filter(u=>units.some(e=>e.faction!=='player'&&e.attackTarget===u.id&&e.command==='attack'));
 const damaged=friends.filter(u=>sim.clock-(u.lastCombatDamageAt??-Infinity)<8);
 const focused=damaged.sort(recentFirst)[0]??targets.sort(recentFirst)[0];
 return focused?[focused,...enemies]:enemies;
}
const crownRows=['villager','soldier','scout','spearwarden','militia'];
const ashenRows=['raider','ashenForager','ashenOutrider','thornSpear','hearthLevy','hidewall'];
export function portraitAsset(u){
 if(u.type==='shieldbearer')return {file:'combat-portraits-v1.png',row:0,rows:4};
 if(u.type==='grizzly')return {file:'combat-portraits-v1.png',row:({'black-oath':1,cindermaw:2,'ashen-grudge':3}[bearVariant(u).id]),rows:4};
 if(crownRows.includes(u.type))return {file:'crown-class-portraits-v1.png',row:crownRows.indexOf(u.type),rows:5};
 if(ashenRows.includes(u.type))return {file:'ashen-class-portraits-v1.png',row:ashenRows.indexOf(u.type),rows:6,top:[0,260,518,777,1058,1335][ashenRows.indexOf(u.type)],height:[260,258,259,281,277,320][ashenRows.indexOf(u.type)],sheetHeight:1774};
 return null;
}
const glyphs={
 beyondFirstOath:'M12 2 3 6v6q0 7 9 10 9-3 9-10V6Z M13 5 8 12h5l-2 7 6-9h-5Z',
 lastLightChorus:'M12 21S1 14 3 7q4-5 9 1 5-6 9-1 2 7-9 14Z M12 9v8 M8 13h8 M2 3h3 M19 3h3',
 crownsAegis:'M12 3 4 6v7q0 6 8 9 8-3 8-9V6Z M8 12h8 M12 8v9',
 oathboundStride:'m5 18 6-7-2-5 5-3 3 7-5 7 7 2 M3 21h8',
 kingsbaneHunger:'m3 7 4 3 5-6 5 6 4-3-3 11H6Z M8 14l8 5 M16 14l-8 5',
 falteringCrown:'M2 12q10-13 20 0-10 13-20 0Z M12 8v8 M9 12h6',
 greatwoodDefiance:'m12 2-7 9h4l-5 6h6v5h4v-5h6l-5-6h4Z',
 greatwoodColossus:'m3 21 2-12 5-6h4l5 6 2 12 M7 20v-8 M17 20v-8 M8 7h8',
 bloodclawReckoning:'M7 3 3 21l6-9 M14 3 9 21l7-10 M21 3l-5 18 6-10',
 crownsLastBastion:'M4 21V8h4V4h3v4h3V4h3v4h3v13Z M10 21v-6h4v6',
 unbrokenWild:'M12 21S1 14 3 7q4-5 9 1 5-6 9-1 2 7-9 14Z M12 9v9m-4-5 4 2 4-2',
 deathlessHeart:'M12 21S1 14 3 7q4-5 9 1 5-6 9-1 2 7-9 14Z M9 11l6 6m0-6-6 6 M12 1v3',
 crushingClaws:'m4 3 1 8 4 3 M11 2l1 9 4 3 M18 3l2 9-3 8-9 1-5-6',
 firstCondemnation:'M12 2 3 7v10l9 5 9-5V7Z M8 7l8 10 M16 7 8 17 M6 12h12',
 elderhide:'m4 3 8 3 8-3v9q0 7-8 10-8-3-8-10Z M7 10l10 7 M17 10 7 17',
 thickHide:'m3 7 9-5 9 5-9 5Z M3 12l9 5 9-5 M3 17l9 5 9-5',
 bearLineage:'M8 13q4-4 8 0l4 6q-8 5-16 0Z M4 7v3 M9 3v5 M15 3v5 M20 7v3',
 ward:'M12 2v20 M2 12h20 M5 5l14 14 M19 5 5 19 M8 8h8v8H8Z',
 lastLight:'M7 4h10v9l-5 8-5-8Z M9 8l6 5 M15 8l-6 5',
 greatwoodFury:'M12 2q-7 8-6 11l-3-2q-1 11 9 11 11 0 8-14l-4 5q2-5-4-11Z',
 stun:'m12 2 2 7 8-2-6 6 5 7-8-3-5 5 1-9-7-3 8-1Z',
 stunImmunity:'M12 3 4 6v7q0 6 8 9 8-3 8-9V6Z M8 12l3 3 5-6'
};
export const isDebuff=s=>s.id==='lastLight'||s.id==='stun'||s.rune==='curse'||s.kind?.toLowerCase().includes('impairment');
export function effectIcon(status){
 const hue=isDebuff(status)?'315':status.rune==='fury'?'22':status.rune==='divine'?'46':'165';
 return `<svg viewBox="0 0 24 24" aria-hidden="true" style="--sigil-hue:${hue}"><path d="${glyphs[status.id]??'m12 2 9 10-9 10-9-10Z M12 7v10 M7 12h10'}"/></svg>`;
}
export function createCombatFrames(sim,renderer){
 const css=document.createElement('link');css.rel='stylesheet';css.href='./combat-frames.css?v=20260913-firstoath1';document.head.append(css);
 const host=document.createElement('aside');host.className='combat-frames';host.hidden=true;host.setAttribute('aria-label','Encounter portraits');
 host.innerHTML='<header><span>IN COMBAT</span><b>Encounter</b><button type="button" aria-label="Minimize encounter portraits" aria-expanded="true">−</button></header><div class="combat-frame-list"></div>';
 document.querySelector('.game-shell').append(host);
 const list=host.querySelector('.combat-frame-list'),records=new Map();
 const tooltip=document.createElement('div');tooltip.className='combat-effect-tooltip';tooltip.id='combat-effect-tooltip';tooltip.setAttribute('role','tooltip');tooltip.hidden=true;document.body.append(tooltip);
 let hovered=null;
 function hide(){hovered?.removeAttribute('aria-describedby');hovered=null;tooltip.hidden=true;}
 function show(button){hovered=button;button.setAttribute('aria-describedby',tooltip.id);updateTooltip();}
 function updateTooltip(){if(!hovered?.isConnected||hovered.closest('[hidden]')){hide();return;}tooltip.replaceChildren();const title=document.createElement('b'),body=document.createElement('p'),detail=document.createElement('small');title.textContent=hovered._tip[0];body.textContent=hovered._tip[1];detail.textContent=hovered._tip[2]??'';tooltip.append(title,body,detail);tooltip.hidden=false;const rect=hovered.getBoundingClientRect();tooltip.style.left=`${Math.max(8,Math.min(innerWidth-280,rect.left-270))}px`;tooltip.style.top=`${Math.max(8,Math.min(innerHeight-tooltip.offsetHeight-8,rect.top))}px`;}
 function bindTip(button){button.onpointerenter=()=>show(button);button.onpointerleave=hide;button.onfocus=()=>show(button);button.onblur=hide;button.onclick=()=>show(button);}
 host.querySelector('header button').onclick=e=>{const mini=host.classList.toggle('is-mini');e.currentTarget.textContent=mini?'+':'−';e.currentTarget.setAttribute('aria-expanded',String(!mini));e.currentTarget.setAttribute('aria-label',`${mini?'Expand':'Minimize'} encounter portraits`);hide();};
 window.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});list.addEventListener('scroll',hide);
 function create(u){
  const el=document.createElement('article');el.className='combat-unit-frame';el.dataset.unitId=u.id;el.dataset.side=u.faction==='player'?'ally':'enemy';
  el.innerHTML='<div class="combat-frame-top"><button class="combat-portrait" type="button"><span></span><canvas width="120" height="120"></canvas></button><div class="combat-frame-vitals"><div class="combat-frame-name"></div><div class="combat-frame-role"></div><div class="combat-frame-health" role="meter" aria-label="Health"><i></i><span></span></div><div class="combat-frame-action"></div></div></div><div class="combat-auras" aria-label="Buffs"><small>BUFFS</small><div></div></div><div class="combat-auras debuffs" aria-label="Debuffs"><small>DEBUFFS</small><div></div></div>';
  const portrait=el.querySelector('.combat-portrait');bindTip(portrait);
  const art=portraitAsset(u),row=art?.row??null;
  if(art){portrait.classList.add('has-art');portrait.style.setProperty('--portrait-row',`${art.row*100/(art.rows-1)}%`);portrait.style.setProperty('--portrait-sheet',`url('./assets/${art.file}')`);portrait.style.setProperty('--portrait-sheet-size',`300% ${art.rows*100}%`);if(art.sheetHeight){portrait.style.setProperty('--portrait-row',`${art.top/(art.sheetHeight-art.height)*100}%`);portrait.style.setProperty('--portrait-sheet-size',`300% ${art.sheetHeight/art.height*100}%`);}portrait.style.setProperty('--breath-delay',`${-(u.id%7)*.4}s`);}
  const ordinal=[...records.values()].filter(r=>r.u.type===u.type).length+1;
  el.querySelector('.combat-frame-name').textContent=`${u.type==='shieldbearer'?'Shieldbearer':name(u)} · ${ordinal}`;
  list.append(el);return {el,u,lastSeen:sim.clock,icons:new Map(),portrait,row};
 }
 function update(){
  const now=sim.clock;
  for(const u of encounterUnits(sim)){let r=records.get(u.id);if(r&&r.u!==u){r.el.remove();records.delete(u.id);r=null;}if(!r){r=create(u);records.set(u.id,r);}r.lastSeen=now;}
  const live=new Set(sim.units);
  for(const [id,r] of records){const {u,el}=r;if(!live.has(u)||!alive(u)||now-r.lastSeen>8||now<r.lastSeen){el.remove();records.delete(id);continue;}
   const hp=displayedUnitHealth(u),pct=Math.max(0,Math.min(100,hp/u.maxHp*100)),target=sim.units.find(v=>v.id===u.attackTarget&&alive(v));
   el.classList.toggle('is-critical',pct<25);el.querySelector('.combat-frame-role').textContent=u.faction==='player'?(tank(u)?'YOUR TANK':'UNDER ATTACK'):target?.faction==='player'?`TARGET · ${name(target)}`:'ENEMY';
   const meter=el.querySelector('[role=meter]');meter.setAttribute('aria-valuemin',0);meter.setAttribute('aria-valuemax',u.maxHp);meter.setAttribute('aria-valuenow',Math.ceil(hp));meter.querySelector('i').style.width=`${pct}%`;meter.querySelector('span').textContent=`${Math.ceil(hp).toLocaleString()} / ${u.maxHp.toLocaleString()} · ${pct>0&&pct<1?'<1':Math.round(pct)}%`;
   el.querySelector('.combat-frame-action').textContent=u.actionLabel||'Engaged';r.portrait.setAttribute('aria-label',`${name(u)} portrait`);r.portrait._tip=[name(u),`${Math.ceil(hp)} / ${u.maxHp} health`,u.actionLabel||'Engaged'];
   if(r.row===null){const c=r.portrait.querySelector('canvas'),ctx=c.getContext('2d');ctx.clearRect(0,0,120,120);renderer.drawVillagerAsset(ctx,{...u,command:'idle',animClock:sim.clock},{x:60,y:115},120,1);}
   const statuses=unitStatuses(u),ids=new Set(statuses.map(s=>s.id));
   for(const [id,b] of r.icons)if(!ids.has(id)){b.remove();r.icons.delete(id);}
   for(const status of statuses){let b=r.icons.get(status.id);if(!b){b=document.createElement('button');b.type='button';b.className='combat-aura';b.innerHTML=effectIcon(status);bindTip(b);el.querySelector(isDebuff(status)?'.debuffs>div':'.combat-auras>div').append(b);r.icons.set(status.id,b);}b._tip=[status.name,status.detail,status.summary];b.setAttribute('aria-label',`${status.name}: ${status.detail}`);}
   for(const section of el.querySelectorAll('.combat-auras'))section.classList.toggle('is-empty',!section.querySelector('button'));
  }
  const visible=focusedCombatUnits(sim,[...records.values()].map(r=>r.u)),ids=new Set(visible.map(u=>u.id));
  for(const [id,r] of records)r.el.hidden=!ids.has(id);
  host.hidden=!visible.length;document.querySelector('.game-shell').classList.toggle('has-encounter',visible.length>0);host.querySelector('header b').textContent=`${visible.some(u=>u.faction==='player')?'1 ally · ':''}${visible.filter(u=>u.faction!=='player').length} enemies`;
  if(hovered)updateTooltip();
 }
 return {update};
}
