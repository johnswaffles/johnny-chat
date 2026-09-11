// Explicit review route only; never imported by the production game entry point.
const {simulation:s,renderer:r}=window.crownforge;
s.units=[];s.buildings=[];s.resourcesNodes=[];s.projectiles=[];s.navigationVersion++;s.phase='playing';s._checkVictory=()=>{};s._updateEnemyAI=()=>{};s._updateEnemyIntent=()=>{};s.wildlifeState.nextSpawnAt=Infinity;
const worker=s.addUnit('villager',100,100,'player');worker.lastLightWardTimer=0;worker.facing=0;
s.selectEntity(worker);r.camera.zoom=2.2;r.zoomMotion=null;r.cameraInitialized=true;
const point=r.worldToScreen(worker);r.camera.x+=r.width*.58-point.x;r.camera.y+=r.height*.66-point.y;
const bar=document.createElement('section');bar.style='position:fixed;bottom:20px;left:32%;z-index:100;background:#112638ee;color:white;padding:16px;border-radius:12px;font:14px system-ui';
bar.innerHTML='<strong>New Hearthkin · live renderer</strong> <button id="ward-on">Activate shield</button> <button id="ward-hit">Block impact</button> <button id="ward-off">Remove shield</button> <button id="ward-motion">Reduced motion</button> <output id="ward-result">Ready</output>';
document.body.append(bar);
bar.querySelector('#ward-on').onclick=()=>{worker.lastLightWardTimer=600;bar.querySelector('output').textContent='Shield active';};
bar.querySelector('#ward-off').onclick=()=>{worker.lastLightWardTimer=0;bar.querySelector('output').textContent='Shield removed';};
bar.querySelector('#ward-hit').onclick=()=>{worker.lastLightWardTimer=600;worker.wardBlockedPulse=.42;bar.querySelector('output').textContent='Impact triggered';};
bar.querySelector('#ward-motion').onclick=()=>{r.atmosphere.reducedMotion=!r.atmosphere.reducedMotion;bar.querySelector('output').textContent=r.atmosphere.reducedMotion?'Reduced motion on':'Reduced motion off';};

const select=document.createElement('select');select.setAttribute('aria-label','Worker action');for(const [v,label] of Object.entries({idle:'Idle',walk:'Walk',gather_wood:'Chop wood',field_work:'Tend field',carry_food:'Carry berries',carry_supplies:'Carry crate',death:'Fall'})){const o=document.createElement('option');o.value=v;o.textContent=label;select.append(o);}bar.append(select);let action='idle';select.onchange=()=>{action=select.value;};
const update=s.update.bind(s);s.update=dt=>{update(dt);if(action==='live')return;worker.animationState=action;worker.animationPhase=(s.clock%1.2)/1.2;worker.animClock=s.clock;worker.gatherTimer=s.clock%1.1;worker.workCyclePhase=(s.clock%1.2)/1.2;worker.motionSpeed=action==='walk'||action.startsWith('carry_')?1:0;worker.carryType=action.slice(6);worker.carryAmount=action.startsWith('carry_')?1:0;worker.dead=action==='death';worker.deathAge=action==='death'?Math.min(1.6,(s.clock%3)):0;};

const move=document.createElement('button');move.textContent='Walk across clearing';move.onclick=()=>{action='live';worker.dead=false;worker.carryAmount=0;s._sendUnitTo(worker,{x:105,z:104},'move');};bar.append(move);
