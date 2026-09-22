import {UNIT_TYPES} from './config.js?v=20260921-healboost1';
import {startSidePull,sidePullPlan,combatRole,eligibleMember,TEAM_RULES} from './combat-teams.js?v=20260921-healboost1';
export function createTeamControls(sim,onChange){
 const panel=document.querySelector('#team-controls'),classes=document.querySelector('#select-warrior-classes');
 if(!panel||!classes)return {update(){}};
 const picker=panel.querySelector('select'),summary=panel.querySelector('[data-summary]');
 const button=name=>panel.querySelector(`[data-action="${name}"]`);
 let classKey='',teamKey='';
 const finish=()=>onChange();
 const auto=document.createElement('label');auto.style.cssText='display:flex;align-items:center;gap:8px;margin:10px 0;font-size:12px;cursor:pointer';
 const toggle=document.createElement('input');toggle.type='checkbox';toggle.id='auto-group-new-units';toggle.style.cssText='accent-color:#31594d;width:16px;height:16px';
 auto.append(toggle,document.createTextNode('Auto-add new units'));auto.title='New friendly recruits automatically join Your Team. Existing units and your current selection stay unchanged.';
 panel.querySelector('.team-buttons').after(auto);
 toggle.onchange=()=>{sim.autoGroupNewUnits=toggle.checked;finish();};
 const split=document.createElement('button');split.type='button';split.dataset.action='side-pull';split.textContent='Divide the Hunt · Side pull';panel.querySelector('.team-buttons').after(split);split.onclick=()=>{startSidePull(sim);finish();};
 classes.addEventListener('click',e=>{const b=e.target.closest('[data-class]');if(b){sim.selectAllWarriorClass(b.dataset.class);finish();}});
 button('create').hidden=true;picker.parentElement.hidden=true;button('disband').textContent='Clear roster';
 button('create').onclick=()=>{const id=sim.assignSelectedTeam();update();if(id)picker.value=String(id);finish();};
 button('add').onclick=()=>{sim.assignSelectedTeam(Number(picker.value));finish();};
 button('add-all').title='Add every living friendly unit to your team and select them all.';
 button('add-all').dataset.tooltip=button('add-all').title;
 button('add-all').onclick=()=>{sim.assignAllUnitsTeam();finish();};
 button('leave').onclick=()=>{sim.leaveSelectedTeam();finish();};
 button('disband').onclick=()=>{sim.disbandTeam(Number(picker.value));finish();};
 picker.onchange=()=>update();
 function update(){
  toggle.checked=sim.autoGroupNewUnits===true;
  const selected=sim.selectedEntities.filter(eligibleMember),groups=sim.getCombatTeams();
  const splitPlan=sidePullPlan(sim);split.disabled=!sim.sideEncounter&&Boolean(splitPlan.reason);split.textContent=sim.sideEncounter?'Cancel side pull':'Divide the Hunt · Side pull';split.title=sim.sideEncounter?'Release the off-tank and healer back to normal orders.':splitPlan.reason??'Send a spare tank and healer to separate the second enemy. Keeps one tank and healer in the main fight.';split.dataset.tooltip=split.title;
  const types=[...new Set(selected.filter(u=>!UNIT_TYPES[u.type].worker).map(u=>u.type))];
  const nextClass=types.map(t=>`${t}:${sim.units.filter(u=>u.type===t&&eligibleMember(u)).length}`).join('|');
  if(nextClass!==classKey){classKey=nextClass;classes.replaceChildren();
   for(const type of types){const b=document.createElement('button');b.type='button';b.className='selection-unit-button';b.dataset.class=type;
    b.textContent=`Select all: ${UNIT_TYPES[type].label} (${sim.units.filter(u=>u.type===type&&eligibleMember(u)).length})`;classes.append(b);}
  }
  classes.hidden=!types.length;panel.hidden=false;
  const nextTeam=groups.map(g=>g.id).join('|');
  if(nextTeam!==teamKey){teamKey=nextTeam;const previous=picker.value;picker.replaceChildren();
   for(const g of groups){const o=document.createElement('option');o.value=String(g.id);o.textContent='Your team';picker.append(o);}
   if(groups.some(g=>String(g.id)===previous))picker.value=previous;
  }
  const team=groups.find(g=>g.id===Number(picker.value));
  summary.textContent=team?`${team.tank} tank${team.tank===1?'':'s'} · ${team.healer} healer${team.healer===1?'':'s'} · ${team.damage} damage${team.support?` · ${team.support} support`:''}`:'Your team is empty. Select units and add them.';
  button('create').disabled=!selected.length;button('add').disabled=!selected.length||!team;
  button('leave').disabled=!selected.some(u=>u.teamId);button('add-all').disabled=!sim.units.some(eligibleMember);button('disband').disabled=!team;picker.disabled=!groups.length;
  panel.querySelector('[data-help]').textContent=`Every ${TEAM_RULES.healInterval}s, heal all injured allies within ${TEAM_RULES.healRange} yards (tanks: ${TEAM_RULES.healRange+5}): tanks +${TEAM_RULES.tankHealAmount} HP, others +${TEAM_RULES.healAmount}. Mercy of the Last Crown: tanks below 10% HP receive 5× healing. Building orders pause healing until finished. Tanks lead; healers follow behind the damage line. Add as many units as you like.`;
 }
 update();return {update};
}
