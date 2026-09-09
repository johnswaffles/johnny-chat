import {UNIT_TYPES} from './config.js?v=20260909-fullroster1';
import {unitStatuses,sigilSvg,FIRST_CONDEMNATION,displayedUnitHealth} from './unit-status.js?v=20260909-fullroster1';

const factionName=u=>u.faction==='player'?'The Crownwardens':u.faction==='enemy'?'The Ashen Clans':'Greatwood wildlife';
const health=u=>`${Math.ceil(displayedUnitHealth(u))} / ${u.maxHp} HP`;
export function createUnitInspector({simulation,renderer,canvas,onOpen=()=>{}}){
  const host=document.createElement('section');host.id='unit-inspector';host.hidden=true;
  host.innerHTML='<div class="unit-inspect-overview"><button class="unit-portrait-button" type="button" aria-label="Open character details"><canvas width="120" height="160" aria-hidden="true"></canvas></button><div class="unit-vitals"><span class="unit-allegiance"></span><strong class="unit-health-label"></strong><div class="unit-health-track" role="meter" aria-label="Health"><i></i></div><p class="unit-activity"></p></div></div><div class="unit-statuses" aria-label="Buffs and curses"></div><p class="unit-inspect-hint"></p>';
  document.querySelector('#selection-detail').after(host);
  const dialog=document.createElement('dialog');dialog.id='unit-lore';dialog.setAttribute('aria-labelledby','unit-lore-title');
  dialog.innerHTML='<article class="unit-lore-card"><button class="unit-lore-close" type="button" aria-label="Close character details">×</button><div class="unit-lore-hero"><img alt="The cursed Greatwood Grizzly in its ancient forest" hidden><canvas width="360" height="360" hidden aria-label="Character portrait"></canvas><div class="unit-lore-heading"><span class="unit-lore-faction"></span><h2 id="unit-lore-title"></h2><p class="unit-lore-health"></p></div></div><div class="unit-lore-body"><p class="unit-lore-activity"></p><div class="unit-lore-statuses" aria-label="Character buffs and curses"></div><section class="unit-lore-story"><div class="unit-lore-sigil"></div><div><span class="unit-lore-kind"></span><h3 class="unit-lore-name"></h3></div><p class="unit-lore-prose"></p><p class="unit-lore-effect"></p></section><p class="unit-lore-boundary"></p></div></article>';
  document.body.append(dialog);
  const $=s=>host.querySelector(s),d$=s=>dialog.querySelector(s);
  let selected=null,profile=null,chosen=null,buttonKey='!',profileKey='!',lastSelectionId=null;
  const close=()=>{dialog.close();canvas.focus({preventScroll:true});};
  d$('.unit-lore-close').onclick=close;
  dialog.addEventListener('click',e=>{if(e.target===dialog)close();});
  window.addEventListener('keydown',e=>{if(!dialog.open)return;e.stopImmediatePropagation();if(e.key==='Escape'){e.preventDefault();close();}},true);
  function portrait(target,u,size){
    const ctx=target.getContext('2d');ctx.clearRect(0,0,target.width,target.height);
    const point={x:target.width*.5,y:target.height*.94};
    if(u.type==='grizzly')renderer.grizzly.draw(ctx,u,point,size,renderer.lastRenderTime,true);
    else renderer.drawVillagerAsset(ctx,u,point,size,1);
  }
  function renderButtons(container,u,key,open){
    const statuses=unitStatuses(u),next=statuses.map(s=>s.id).join('|');
    if(key!==next){
      container.replaceChildren();
      for(const status of statuses){const b=document.createElement('button');b.type='button';b.className='unit-status';b.dataset.status=status.id;b.innerHTML=`${sigilSvg(status.rune)}<span><b></b><small></small></span>`;b.querySelector('b').textContent=status.name;b.onclick=()=>open(status.id);container.append(b);}
      if(!statuses.length){const p=document.createElement('p');p.className='unit-no-status';p.textContent='No active buffs or curses';container.append(p);}
    }
    for(const status of statuses){const b=container.querySelector(`[data-status="${status.id}"]`);b.querySelector('small').textContent=status.detail;b.setAttribute('aria-label',`${status.name}: ${status.detail}. Open details`);}
    return next;
  }
  function updateProfile(){
    if(!dialog.open||!profile)return;
    d$('.unit-lore-health').textContent=health(profile);
    d$('.unit-lore-activity').textContent=profile.dead?'Fallen':profile.actionLabel||'Idle';
    profileKey=renderButtons(d$('.unit-lore-statuses'),profile,profileKey,id=>{chosen=id;updateProfile();});
    const statuses=unitStatuses(profile),status=statuses.find(s=>s.id===chosen)??statuses.find(s=>s.id==='greatwoodFury')??statuses.find(s=>s.id==='lastLight')??statuses[0];
    if(profile.type==='grizzly'){const art=d$('.unit-lore-hero img'),src=status?.art??FIRST_CONDEMNATION.art;if(art.getAttribute('src')!==src)art.src=src;art.alt=status?.id==='greatwoodFury'?'A Greatwood grizzly rears and swipes, scattering soldiers beneath the ancient trees':'A Greatwood grizzly beneath the ancient trees';}
    dialog.classList.toggle('has-fury-art',status?.id==='greatwoodFury');
    d$('.unit-lore-sigil').innerHTML=sigilSvg(status?.rune??'ward');
    d$('.unit-lore-kind').textContent=status?.kind??'Character';
    d$('.unit-lore-name').textContent=status?.name??UNIT_TYPES[profile.type].label;
    d$('.unit-lore-prose').textContent=status?.lore??status?.summary??`${UNIT_TYPES[profile.type].label} of ${factionName(profile)}.`;
    d$('.unit-lore-effect').textContent=status?.effect??status?.summary??'Watch their health, current activity and active effects here.';
    if(profile.type!=='grizzly')portrait(d$('.unit-lore-hero canvas'),profile,290);
  }
  function open(unit=selected,statusId=null){
    if(!unit)return;profile=unit;chosen=statusId;profileKey='!';onOpen();
    d$('#unit-lore-title').textContent=UNIT_TYPES[unit.type].label;
    d$('.unit-lore-faction').textContent=factionName(unit);
    d$('.unit-lore-boundary').textContent=unit.faction==='player'?'Close this card to issue orders.':'Observation only · this character remains outside your command.';
    const bear=unit.type==='grizzly',art=d$('.unit-lore-hero img');art.hidden=!bear;d$('.unit-lore-hero canvas').hidden=bear;
    if(bear)art.src=FIRST_CONDEMNATION.art;
    if(!dialog.open)dialog.showModal();updateProfile();
  }
  $('.unit-portrait-button').onclick=()=>open();
  function update(){
    const units=simulation.selectedEntities;
    selected=units.length===1&&units[0].kind==='unit'?units[0]:null;host.hidden=!selected;
    document.querySelector('#selection-detail').hidden=!!selected;
    const hostile=selected&&selected.faction!=='player';
    if(hostile&&selected.id!==lastSelectionId){document.querySelector('.intel-panel').classList.remove('is-compact');document.querySelector('#intel-toggle').setAttribute('aria-expanded','true');}
    lastSelectionId=selected?.id??null;
    document.querySelector('.selection-direct-actions').hidden=!!hostile;
    if(selected){
      $('.unit-allegiance').textContent=factionName(selected);$('.unit-health-label').textContent=health(selected);
      const visibleHp=displayedUnitHealth(selected),meter=$('.unit-health-track');meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax',selected.maxHp);meter.setAttribute('aria-valuenow',Math.ceil(visibleHp));meter.querySelector('i').style.width=`${Math.max(0,Math.min(100,visibleHp/selected.maxHp*100))}%`;
      $('.unit-activity').textContent=selected.dead?'Fallen':(selected.actionLabel||'Idle')+(selected.carryAmount>0?` · carrying ${selected.carryAmount} ${selected.carryType}`:'');
      $('.unit-inspect-hint').textContent=hostile?'Inspect only · select your soldiers, then right-click a foe to attack.':'Click a portrait or effect to read more.';
      buttonKey=renderButtons($('.unit-statuses'),selected,buttonKey,id=>open(selected,id));
      portrait($('canvas'),selected,selected.type==='grizzly'?145:135);
    }
    updateProfile();
  }
  return {update,open,close};
}
