const {simulation:s,renderer:r}=window.crownforge;
s.units=[];s.buildings=[];s.resourcesNodes=[];s.decorations=[];s.projectiles=[];s.navigationVersion++;
s._checkVictory=()=>{};s._updateEnemyAI=()=>{};s._updateEnemyIntent=()=>{};s._updateMilitaryServices=()=>{};s.wildlifeState.nextSpawnAt=Infinity;
for(let i=0;i<4;i++){const u=s.addUnit('militia',180+i*4,200-i*4,'player');u.paintedFacing=i;u.facing=[1,0,2,3][i];}
s.selectedIds=s.units.map(u=>u.id);s._syncSelectionFlags();
r.camera.zoom=1.1;r.zoomMotion=null;r.cameraInitialized=true;
const center=r.worldToScreen({x:186,z:194});r.camera.x+=r.width*.5-center.x;r.camera.y+=r.height*.55-center.y;
const style=document.createElement('style');style.textContent=`#unit-activity{display:none!important}.militia-review{position:fixed;top:100px;left:50%;transform:translateX(-50%);z-index:80;background:#132b2ef5;color:#f1e6c8;padding:12px 24px;border:1px solid #998861;border-radius:10px;text-align:center;font:14px system-ui}.militia-review button{padding:10px 16px;margin:8px;color:#fff0c6;background:#284447;border:1px solid #aa9561;border-radius:6px}`;document.head.append(style);
const panel=document.createElement('section');panel.className='militia-review';panel.innerHTML='<strong>Crown Militia · steadier walking & raised health bars</strong><br><button data-walk>Walk forward</button><button data-back>Walk back</button><br>Right-click anywhere to test another direction. Scroll to zoom.';document.body.append(panel);
function move(p){s.selectedIds=s.units.map(u=>u.id);s._syncSelectionFlags();s.issueContextCommand(p);}
panel.querySelector('[data-walk]').onclick=()=>move({x:199,z:197});panel.querySelector('[data-back]').onclick=()=>move({x:186,z:194});
