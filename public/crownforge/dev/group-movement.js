const {simulation:s,renderer:r}=window.crownforge;
s.units=[];s.pausedEnemyUnits=[];s.buildings=[];s.resourcesNodes=[];s.decorations=[];s.projectiles=[];s.navigationVersion++;
s._checkVictory=()=>{};s._updateEnemyAI=()=>{};s._updateEnemyIntent=()=>{};s._updateMilitaryServices=()=>{};s.wildlifeState.nextSpawnAt=Infinity;
s.addBuilding('barracks',145,150,'player',1);
for(let i=0;i<48;i++){const u=s.addUnit(i<10?'shieldbearer':i<38?'spearwarden':'villager',85+i%8*2.5,130+Math.floor(i/8)*2.5,'player');u.teamId=1;}
s.selectedIds=s.units.map(u=>u.id);s._syncSelectionFlags();
r.camera.zoom=.30;r.zoomMotion=null;r.cameraInitialized=true;
const center=r.worldToScreen({x:145,z:148});r.camera.x+=r.width*.5-center.x;r.camera.y+=r.height*.60-center.y;
const style=document.createElement('style');style.textContent=`.game-shell > :not(#game-canvas):not(#loading-veil),#unit-activity,#combat-frames{display:none!important}.formation-review{position:fixed;top:20px;left:50%;transform:translateX(-50%);padding:16px 24px;border:1px solid #998861;border-radius:12px;background:#132b2eee;color:#f1e6c8;text-align:center;z-index:80;font:14px system-ui}.formation-review h1{font:25px Marcellus,serif;margin:4px}.formation-review button{padding:10px 15px;margin:6px;background:#284447;color:#fff0c6;border:1px solid #aa9561;border-radius:6px}.formation-review output{display:block;margin-top:8px}`;document.head.append(style);
const panel=document.createElement('section');panel.className='formation-review';panel.innerHTML='<h1>48-unit formation review</h1><p>10 tanks · 28 fighters · 10 Hearthkin</p><button data-move>Move everyone around the Barracks</button><button data-return>Return to starting area</button><output>Ready · select a destination below or right-click the ground.</output>';document.body.append(panel);
let targets=new Map(),arrived=new Set();
function move(point){s.selectedIds=s.units.map(u=>u.id);s._syncSelectionFlags();s.issueContextCommand(point);targets=new Map(s.units.map(u=>[u.id,{...u.routeTarget}]));arrived.clear();}
panel.querySelector('[data-move]').onclick=()=>move({x:200,z:164});panel.querySelector('[data-return]').onclick=()=>move({x:100,z:140});
function status(){if(targets.size){for(const u of s.units){const t=targets.get(u.id);if(t&&Math.hypot(u.x-t.x,u.z-t.z)<1.5)arrived.add(u.id);}panel.querySelector('output').textContent=`${arrived.size}/48 reached their spots · ${s.units.filter(u=>u.command==='move').length} moving`;}requestAnimationFrame(status);}requestAnimationFrame(status);
