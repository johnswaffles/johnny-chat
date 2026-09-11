// Explicit review route only; never imported by the production game entry point.
const {simulation:s,renderer:r}=window.crownforge;
s.units=[];s.buildings=[];s.resourcesNodes=[];s.projectiles=[];s.navigationVersion++;s.phase='playing';s._checkVictory=()=>{};s._updateEnemyAI=()=>{};s._updateEnemyIntent=()=>{};s.wildlifeState.nextSpawnAt=Infinity;
const worker=s.addUnit('villager',100,100,'player');worker.lastLightWardTimer=600;worker.facing=0;
s.selectEntity(worker);r.camera.zoom=2.2;r.zoomMotion=null;r.cameraInitialized=true;
const point=r.worldToScreen(worker);r.camera.x+=r.width*.58-point.x;r.camera.y+=r.height*.66-point.y;
const bar=document.createElement('section');bar.style='position:fixed;bottom:20px;left:32%;z-index:100;background:#112638ee;color:white;padding:16px;border-radius:12px;font:14px system-ui';
bar.innerHTML='<strong>Blue shield · live renderer</strong> <button id="ward-on">Activate shield</button> <button id="ward-hit">Block impact</button> <button id="ward-off">Remove shield</button> <button id="ward-motion">Reduced motion</button> <output id="ward-result">Shield active</output>';
document.body.append(bar);
bar.querySelector('#ward-on').onclick=()=>{worker.lastLightWardTimer=600;bar.querySelector('output').textContent='Shield active';};
bar.querySelector('#ward-off').onclick=()=>{worker.lastLightWardTimer=0;bar.querySelector('output').textContent='Shield removed';};
bar.querySelector('#ward-hit').onclick=()=>{worker.lastLightWardTimer=600;worker.wardBlockedPulse=.42;bar.querySelector('output').textContent='Impact triggered';};
bar.querySelector('#ward-motion').onclick=()=>{r.atmosphere.reducedMotion=!r.atmosphere.reducedMotion;bar.querySelector('output').textContent=r.atmosphere.reducedMotion?'Reduced motion on':'Reduced motion off';};
