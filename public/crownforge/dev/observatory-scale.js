import {BUILDING_TYPES} from '../src/config.js?v=20260921-steadyhealers1';
const {simulation:s,renderer:r}=window.crownforge;
s.units=[];s.pausedEnemyUnits=[];s.buildings=[];s.resourcesNodes=[];s.decorations=[];s.projectiles=[];s.navigationVersion++;
s._checkVictory=()=>{};s._updateEnemyAI=()=>{};s._updateEnemyIntent=()=>{};s._updateMilitaryServices=()=>{};s.wildlifeState.nextSpawnAt=Infinity;
const tower=s.addBuilding('observatory',200,200,'player',1);
const wizard=s.addUnit('wizard',216,206,'player');
const guard=s.addUnit('soldier',206,220,'player');
for(const u of [wizard,guard]){u.command='idle';u.paintedFacing=0;}
s._updateUnit=(u,dt)=>{u.animClock=(u.animClock??0)+dt;};
s.selectedIds=[];s._syncSelectionFlags();
function frame(){r.camera.zoom=Math.min(.70,(r.height-300)/2000);r.zoomMotion=null;r.cameraInitialized=true;const center=r.worldToScreen(tower);r.camera.x+=r.width*.50-center.x;r.camera.y+=r.height*.76-center.y;r.invalidateStaticLayer();}
frame();window.addEventListener('resize',frame);
const style=document.createElement('style');style.textContent=`.game-shell > :not(#game-canvas):not(#loading-veil),#unit-activity,#combat-frames{display:none!important}.scale-review{position:fixed;inset:0;pointer-events:none;z-index:80;color:#f4e6c8;text-align:center;background:linear-gradient(#0d1d23e8,transparent 24%,transparent 78%,#0d1d23e8)}.scale-review header{padding:22px}.scale-review h1{font:32px Marcellus,serif;margin:6px}.scale-review p{font:14px system-ui;color:#c3d3d2}.scale-review footer{position:absolute;bottom:22px;width:100%}.scale-review button{pointer-events:auto;padding:12px 20px;margin:4px;border:1px solid #baa673;border-radius:7px;color:#f5e4b7;background:#152d30;font:14px system-ui}.scale-review button[aria-pressed=true]{background:#755e2d}.scale-review output{display:block;font:14px system-ui;margin:14px}`;document.head.append(style);
const panel=document.createElement('section');panel.className='scale-review';panel.innerHTML=`<header><p>LOCAL SCALE REVIEW</p><h1>Observatory of the Last Star</h1><p>Starveil Arcanist and Crown Guard shown at their unchanged in-game size.</p></header><footer><output>New observatory · 5× larger · twice the previous preview size</output><button data-size="2000" aria-pressed="true">New size · 5×</button><button data-size="400" aria-pressed="false">Previous size</button><button data-barracks aria-pressed="false">Compare Crown Barracks</button></footer>`;document.body.append(panel);
function choose(type,size,button){tower.type=type;BUILDING_TYPES.observatory.renderSize=size;s.navigationVersion++;r.invalidateStaticLayer();for(const b of panel.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b===button));panel.querySelector('output').textContent=type==='barracks'?'Crown Barracks · same camera and character scale':size===400?'Previous observatory · characters unchanged':'New observatory · 5× larger · twice the previous preview size';}
for(const b of panel.querySelectorAll('[data-size]'))b.onclick=()=>choose('observatory',Number(b.dataset.size),b);
panel.querySelector('[data-barracks]').onclick=e=>choose('barracks',1000,e.currentTarget);
