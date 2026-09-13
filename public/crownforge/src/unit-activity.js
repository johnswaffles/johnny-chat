import {UNIT_TYPES} from './config.js?v=20260913-addall1';

export function createUnitActivity(simulation){
 const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href=new URL('../unit-activity.css?v=20260912-activity1',import.meta.url);document.head.append(stylesheet);
 const panel=document.createElement('aside');panel.className='unit-activity-panel';panel.setAttribute('aria-label','Unit activity');
 panel.innerHTML='<button class="activity-toggle" type="button" aria-expanded="true" aria-controls="unit-activity-body"><span class="activity-heading">UNIT ACTIVITY</span><span class="activity-count">0</span><span class="activity-fold" aria-hidden="true">−</span></button><div id="unit-activity-body"><div class="activity-filters" role="group" aria-label="Activity scope"><button type="button" data-scope="selected" aria-pressed="true">Selected</button><button type="button" data-scope="all" aria-pressed="false">All units</button></div><ol class="activity-list" aria-label="Current unit actions"></ol><p class="activity-empty">Select units to see what each is doing.</p><p class="activity-footnote">Live orders · each unit keeps its place</p></div>';
 document.querySelector('.game-shell').append(panel);
 const toggle=panel.querySelector('.activity-toggle'),body=panel.querySelector('#unit-activity-body'),list=panel.querySelector('.activity-list'),empty=panel.querySelector('.activity-empty');
 const rows=new Map(),identities=new Map(),typeCounts=new Map();let scope='selected',collapsed=matchMedia('(max-width:760px)').matches;
 try{const saved=localStorage.getItem('crownforge-unit-activity-mini');if(saved!==null)collapsed=saved==='true';}catch{}
 const applyCollapsed=()=>{panel.classList.toggle('is-mini',collapsed);body.hidden=collapsed;toggle.setAttribute('aria-expanded',String(!collapsed));toggle.setAttribute('aria-label',collapsed?'Expand unit activity':'Minimize unit activity');panel.querySelector('.activity-fold').textContent=collapsed?'+':'−';};
 toggle.onclick=()=>{collapsed=!collapsed;applyCollapsed();try{localStorage.setItem('crownforge-unit-activity-mini',String(collapsed));}catch{}};applyCollapsed();
 for(const button of panel.querySelectorAll('[data-scope]'))button.onclick=()=>{scope=button.dataset.scope;for(const item of panel.querySelectorAll('[data-scope]'))item.setAttribute('aria-pressed',String(item===button));render();};
 function render(){
  const all=simulation.units.filter(u=>u.faction==='player'&&!u.dead&&u.hp>0).sort((a,b)=>a.id-b.id);
  for(const unit of all)if(!identities.has(unit.id)){const number=(typeCounts.get(unit.type)??0)+1;typeCounts.set(unit.type,number);identities.set(unit.id,number);}
  const selected=new Set(simulation.selectedIds),units=scope==='all'?all:all.filter(u=>selected.has(u.id));
  const count=panel.querySelector('.activity-count');if(count.textContent!==String(units.length))count.textContent=String(units.length);
  if(collapsed)return;
  const ids=new Set(units.map(u=>u.id));for(const [id,row] of rows)if(!ids.has(id)){row.remove();rows.delete(id);}
  let previous=null;
  for(const unit of units){
   let row=rows.get(unit.id);
   if(!row){row=document.createElement('li');row.className='activity-row';row.innerHTML='<span class="activity-state" aria-hidden="true"></span><div><div class="activity-unit"><strong></strong><span></span></div><p class="activity-action"></p></div>';rows.set(unit.id,row);}
   // Reuse rows and keep their order, so live updates never reset scroll or focus.
   const next=previous?previous.nextSibling:list.firstChild;if(next!==row)list.insertBefore(row,next);previous=row;
   const name=UNIT_TYPES[unit.type]?.label??'Unit',action=unit.stunTimer>0?'Stunned':unit.actionLabel||'Ready';
   const strong=row.querySelector('strong'),number=row.querySelector('.activity-unit span'),description=row.querySelector('.activity-action');
   if(strong.textContent!==name)strong.textContent=name;
   number.textContent=`· ${identities.get(unit.id)}`;
   if(description.textContent!==action)description.textContent=action;
   row.title=`${name} · ${identities.get(unit.id)}: ${action}`;
   row.dataset.state=unit.stunTimer>0?'stunned':unit.command==='idle'?'ready':'active';
  }
  empty.hidden=units.length>0;list.hidden=!units.length;
  empty.textContent=scope==='all'?'No living units in your settlement.':'Select units, or choose All units to see your settlement.';
 }
 return {render};
}
