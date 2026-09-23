const {simulation:s,renderer:r}=window.crownforge;
s.units=[];s.pausedEnemyUnits=[];s.buildings=[];s.resourcesNodes=[];s.decorations=[];s.navigationVersion++;
s._checkVictory=()=>{};s._updateEnemyAI=()=>{};s._updateEnemyIntent=()=>{};s._updateMilitaryServices=()=>{};s.wildlifeState.nextSpawnAt=Infinity;
const h=s.addUnit('villager',100,100,'player');let tank;let attackers=[];
function reset(){s.units=s.units.filter(u=>!attackers.includes(u));attackers=[];if(tank)s.units=s.units.filter(u=>u!==tank);tank=s.addUnit('shieldbearer',106,100,'player');s.selectEntity(tank);}
reset();r.camera.zoom=1;r.cameraInitialized=true;r.zoomMotion=null;const p=r.worldToScreen({x:103,z:100});r.panBy(r.width*.46-p.x,r.height*.5-p.y);
const tray=document.createElement('section');tray.style.cssText='position:absolute;z-index:10;top:145px;left:16px;width:260px;max-width:35vw;background:#281329ed;border:1px solid #ff97cf;border-radius:12px;padding:14px;color:#ffe7f3;font:13px system-ui';
tray.innerHTML='<b>BENEDICTION OF THE FINAL DAWN</b><p>Preview a fatal wound and the fifteen-second farewell.</p><button id="preview-benediction" style="min-height:44px;width:100%">Speak the blessing</button><button id="preview-benediction-heal" style="min-height:44px;width:100%;margin-top:8px">Attempt full healing</button><button id="preview-lastbreath" style="min-height:44px;width:100%;margin-top:8px">Send new attackers</button><p>Tap the glowing hourglass on the right to read the blessing. Repeat whenever you like.</p>';
document.querySelector('.game-shell').append(tray);
tray.querySelector('#preview-benediction').onclick=()=>{reset();s._applyUnitDamage(tank,1e9,{id:-1,type:'grizzly',kind:'unit',faction:'wildlife'});};
tray.querySelector('#preview-benediction-heal').onclick=()=>{if(!tank.dead)tank.hp=tank.maxHp;s._announce('Even restored health cannot recall a soul blessed to return.');};

tray.querySelector('#preview-lastbreath').onclick=()=>{s.enemyTeamPaused=false;for(const [type,side,dx,dz] of [['grizzly','wildlife',28,0],['raider','enemy',24,12]]){const enemy=s.addUnit(type,tank.x+dx,tank.z+dz,side);attackers.push(enemy);s._sendUnitToAttack(enemy,h);}s._announce('New attackers approach the Hearthkin. The dying hero challenges them.');};
