import {updateStormDragons} from '../src/storm-dragon.js?v=20260923-teamdock1';
const {simulation:s,renderer:r}=window.crownforge;
s.units=[];s.pausedEnemyUnits=[];s.buildings=[];s.resourcesNodes=[];s.decorations=[];s.navigationVersion++;
s._checkVictory=()=>{};s._updateEnemyAI=()=>{};s._updateEnemyIntent=()=>{};s._updateMilitaryServices=()=>{};s.wildlifeState.nextSpawnAt=Infinity;
const wizard=s.addUnit('wizard',190,180,'player');const bear=s.addUnit('grizzly',220,180,'wildlife');bear.hp=bear.maxHp=1000000;
s.addUnit('shieldbearer',191,181,'player');s.addUnit('villager',189,181,'player');
s.update=dt=>{s.clock+=dt;updateStormDragons(s,dt);};s.selectedIds=[wizard.id];s._syncSelectionFlags();r.camera.zoom=.24;r.cameraInitialized=true;r.zoomMotion=null;const p=r.worldToScreen({x:190,z:180});r.panBy(r.width*.53-p.x,r.height*.65-p.y);
const reset=document.createElement('button');reset.textContent='Reset dragon preview';reset.style='position:absolute;top:115px;left:45%;z-index:10;padding:10px';reset.onclick=()=>{wizard.skybreakerCooldown=0;wizard.x=190;wizard.z=180;bear.x=220;bear.z=180;};document.querySelector('.game-shell').append(reset);
