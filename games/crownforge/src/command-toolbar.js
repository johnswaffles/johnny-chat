import {UNIT_TYPES} from './config.js?v=20260921-steadyhealers1';
import {portraitAsset} from './combat-frames.js?v=20260921-steadyhealers1';
export function createCommandToolbar(sim,onChange){
 const deck=document.querySelector('.command-deck');
 const css=document.createElement('link');css.rel='stylesheet';css.href='./command-toolbar.css?v=20260921-toolbarheal1';document.head.append(css);
 deck.classList.add('has-command-toolbar');
 new ResizeObserver(()=>document.documentElement.style.setProperty('--command-deck-clearance',`${deck.getBoundingClientRect().height+30}px`)).observe(deck);
 const bar=document.createElement('div');bar.className='command-toolbar';bar.setAttribute('aria-label','Unit selection and orders');deck.prepend(bar);
 const picks=document.createElement('div');picks.className='roster-shortcuts';picks.setAttribute('role','group');picks.setAttribute('aria-label','Select units');bar.append(picks);
 const choices=[['all','All'],['villager','Hearthkin'],['shieldbearer','Shields'],['spearwarden','Spears'],['soldier','Guards'],['militia','Militia'],['scout','Scouts'],['wizard','Wizard']];
 const buttons=choices.map(([type,label])=>{
  const b=document.createElement('button');b.type='button';b.dataset.selectClass=type;
  const portrait=type==='all'?null:portraitAsset({type});
  const icon=document.createElement('span');icon.className='roster-shortcut-icon';icon.setAttribute('aria-hidden','true');
  if(portrait){icon.style.backgroundImage=`url('./assets/${portrait.file}')`;icon.style.backgroundSize=portrait.single?'cover':`300% ${portrait.rows*100}%`;icon.style.backgroundPosition=portrait.single?'center':`0 ${portrait.row/(portrait.rows-1)*100}%`;}
  else {icon.classList.add('ui-icon','icon-population');}
  b.append(icon);const name=document.createElement('span');name.textContent=label;b.append(name);const count=document.createElement('small');b.append(count);
  b.onclick=()=>{const units=living().filter(u=>type==='all'||u.type===type);if(!units.length)return;sim.selectedIds=units.map(u=>u.id);sim._syncSelectionFlags();sim.lastCommand=`Selected ${units.length} ${type==='all'?'Crownwardens':UNIT_TYPES[type].label}.`;onChange();};picks.append(b);return b;
 });
 const orders=document.createElement('div');orders.className='toolbar-orders';orders.setAttribute('role','group');orders.setAttribute('aria-label','Unit orders');bar.append(orders);
 for(const id of ['selection-combat-actions','selection-building-actions','selection-recovery']){const el=document.getElementById(id);if(el)orders.append(el);}
 const demolition=document.querySelector('#demolition-mode');if(demolition)orders.append(demolition.closest('.selection-unit-actions'));
 const symbols={ 'guard-area':['Guard','M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z'], 'patrol-route':['Patrol','M5 6h12l-3-3m3 3-3 3M19 18H7l3 3m-3-3 3-3'], 'demolition-mode':['Demolish','m4 20 9-9m-3-5 4-3 7 7-3 4Z'], 'recover-units':['Recover','m3 11 9-8 9 8M6 10v11h12V10M10 21v-7h4v7']};
 for(const [id,[label,path]] of Object.entries(symbols)){const b=document.getElementById(id);b.setAttribute('aria-label',label);b.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg><span>${label}</span>`;}
 function living(){return sim.units.filter(u=>u.faction==='player'&&!u.dead&&u.hp>0);}
 function update(){const units=living(),selected=new Set(sim.selectedIds);for(const b of buttons){const group=units.filter(u=>b.dataset.selectClass==='all'||u.type===b.dataset.selectClass);b.disabled=!group.length;b.querySelector('small').textContent=group.length;b.title=`Select all ${b.dataset.selectClass==='all'?'friendly units':UNIT_TYPES[b.dataset.selectClass].label} (${group.length})`;b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed',String(group.length>0&&group.every(u=>selected.has(u.id))));}}
 update();return {update};
}
