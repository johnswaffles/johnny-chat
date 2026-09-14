const {simulation:s,renderer:r}=window.crownforge;
s.units=[];s.pausedEnemyUnits=[];s.buildings=[];s.resourcesNodes=[];s.decorations=[];s.projectiles=[];s.navigationVersion++;
s._checkVictory=()=>{};s._updateEnemyAI=()=>{};s._updateEnemyIntent=()=>{};s.wildlifeState.nextSpawnAt=Infinity;
const w=s.addUnit('wizard',190,210,'player'),tank=s.addUnit('shieldbearer',225,210,'player'),healer=s.addUnit('villager',211,214,'player'),bear=s.addUnit('grizzly',234,210,'wildlife');
for(const u of [w,tank,healer])u.teamId=1;
bear.hp=bear.maxHp=100000;tank.hp=tank.maxHp=100000;
s.selectedIds=[w.id];s._syncSelectionFlags();
r.camera.zoom=.65;r.zoomMotion=null;r.cameraInitialized=true;
const center=r.worldToScreen({x:215,z:213});r.camera.x+=r.width*.52-center.x;r.camera.y+=r.height*.57-center.y;
const style=document.createElement('style');style.textContent=`.game-shell > :not(#game-canvas):not(#loading-veil),#unit-activity,#combat-frames{display:none!important}.eventide-stage{position:fixed;inset:0;pointer-events:none;z-index:80;text-align:center;color:#e8e6ff;background:linear-gradient(#101326ed,transparent 32%,transparent 65%,#101326f5)}.eventide-stage header{padding:24px 12px}.eventide-stage small{font:10px system-ui;letter-spacing:4px;color:#c3b281}.eventide-stage h1{font:clamp(26px,5vw,44px) Marcellus,serif;margin:10px}.eventide-stage p{font:13px/1.65 system-ui;margin:7px}.eventide-stage footer{position:absolute;bottom:20px;left:8px;right:8px}.eventide-stage button{pointer-events:auto;background:#142641e8;color:#e4f8ff;border:1px solid #a9996b;border-radius:22px;padding:11px 17px;margin:5px;font:12px system-ui}.eventide-stage output{display:block;font:12px system-ui;margin:12px;color:#c4ecf5}.eventide-stage .eyebrow{color:#b7a5f3}.eventide-stage strong{color:#ffe1a0}`;document.head.append(style);
const stage=document.createElement('section');stage.className='eventide-stage';stage.innerHTML=`<header><small>CROWNFORGE · LOCAL SPELL PREVIEW</small><h1>Eventide Passage</h1><p>The hunter closes its jaws upon an empty constellation.</p><p class="eyebrow">Collapse into starlight. Step through the night. Return beyond the hunt.</p></header><footer><output aria-live="polite"></output><button data-chase>Replay bear chase</button><button data-freeze>Inspect the rift</button><button data-run>Test the formation</button><button data-controls>Game controls</button><p><strong>Distant Star</strong> · 30-unit standoff &nbsp; <strong>Eventide Passage</strong> · 6s veil / 8s cooldown<br>Clear landing at least 38 units from enemies. Casting resumes once a teammate holds aggro.</p></footer>`;document.body.append(stage);
const status=stage.querySelector('output');let frozen=false,catchRift=false;
function frameScene(){
 const points=[w,tank,healer,bear,...(s.wizardRifts??[]).flatMap(e=>[e.from,e.to])];r.camera.zoom=1;
 const projected=points.map(p=>r.worldToScreen(p)),left=Math.min(...projected.map(p=>p.x))-100,right=Math.max(...projected.map(p=>p.x))+100,top=Math.min(...projected.map(p=>p.y))-220,bottom=Math.max(...projected.map(p=>p.y))+80;
 r.camera.zoom=Math.max(.16,Math.min(.65,(r.width-75)/(right-left),(r.height-350)/(bottom-top)));r.zoomMotion=null;
 const fresh=points.map(p=>r.worldToScreen(p)),z=r.camera.zoom;
 const cx=(Math.min(...fresh.map(p=>p.x))+Math.max(...fresh.map(p=>p.x)))/2,cy=(Math.min(...fresh.map(p=>p.y))-220*z+Math.max(...fresh.map(p=>p.y))+80*z)/2;
 r.camera.x+=r.width*.5-cx;r.camera.y+=r.height*.5+20-cy;
}
const fixed=s._updateFixed.bind(s);s._updateFixed=dt=>{if(frozen)return;const count=w.eventideCount;fixed(dt);if(count!==w.eventideCount)frameScene();if(catchRift&&s.wizardRifts?.some(e=>e.age>=.9)){catchRift=false;frozen=true;}};
function reset(){frozen=false;catchRift=false;s.wizardRifts=[];s.wizardProjectiles=[];s.wizardImpacts=[];for(const [u,x,z] of [[w,190,210],[tank,225,210],[healer,211,214],[bear,234,210]]){s._interruptWork(u);Object.assign(u,{x,z,dead:false,hp:u.maxHp,path:[],command:'idle',velocityX:0,velocityZ:0,eventideCooldown:0,eventideVeil:0,eventideCount:0,eventideScan:0,wizardPositionAt:0,eventideResumeId:null});s._resetMovementTracking(u);}s._sendUnitToAttack(tank,bear);s._sendUnitToAttack(w,bear);}
function chase(inspect=false){reset();tank.x=208;tank.z=240;healer.x=190;healer.z=238;catchRift=inspect;bear.threatTankId=null;bear.threatUntil=0;s._sendUnitToAttack(bear,w);frameScene();}
stage.querySelector('[data-chase]').onclick=()=>chase();stage.querySelector('[data-freeze]').onclick=()=>chase(true);
stage.querySelector('[data-run]').onclick=()=>{reset();w.x=211;w.z=210;w.eventideCooldown=0;s._sendUnitToAttack(bear,tank);};
stage.querySelector('[data-controls]').onclick=()=>{frozen=false;stage.remove();style.remove();};
let lastStatus='';function frame(){if(!stage.isConnected)return;const gap=Math.hypot(w.x-bear.x,w.z-bear.z),hgap=Math.hypot(healer.x-bear.x,healer.z-bear.z);const text=`${frozen?'Rift held for inspection':w.eventideVeil>0?'Beyond the hunt':w.actionLabel} · Wizard ${gap.toFixed(1)} units from bear · Healer ${hgap.toFixed(1)} · Escapes ${w.eventideCount??0} · HP ${Math.round(w.hp)}/${w.maxHp}`;if(text!==lastStatus){status.textContent=text;lastStatus=text;}requestAnimationFrame(frame);}requestAnimationFrame(frame);frameScene();
