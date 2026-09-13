import {encounterOpenness} from '../src/combat-teams.js?v=20260912-elderhide1';
import {updateDeathlessHeart} from '../src/deathless-heart.js?v=20260912-elderhide1';
const {simulation:s,renderer:r}=window.crownforge;
s.units=[];s.buildings=[];s.resourcesNodes=[];s.decorations=[];s.projectiles=[];s.navigationVersion++;
s._checkVictory=()=>{};s._updateEnemyAI=()=>{};s._updateEnemyIntent=()=>{};s._updateMilitaryServices=()=>{};s.wildlifeState.nextSpawnAt=Infinity;
const bear=s.addUnit('grizzly',180,180,'wildlife'),tank=s.addUnit('shieldbearer',192,180,'player');
bear.hp=bear.maxHp=180000;bear.greatwoodEnraged=true;tank.hp=tank.maxHp=348000;
const party=Array.from({length:8},(_,i)=>s.addUnit('spearwarden',200+i%4*2,176+Math.floor(i/4)*3,'player'));
const healer=s.addUnit('villager',201,181,'player');
s.addBuilding('wall',174,180,'player',1,{wallSegments:5,wallDirection:{x:0,z:1},wallStart:{x:174,z:174}});
s.addResource('tree','wood',174,186,2400,0,{sizeTier:'large'});
for(const u of [tank,...party,healer])u.teamId=1;
let running=false;const update=s._updateUnit.bind(s);s._updateUnit=(u,dt)=>{if(running)update(u,dt);};
const pick=u=>{s.selectedIds=[u.id];s._syncSelectionFlags();};pick(tank);
r.camera.zoom=.38;r.zoomMotion=null;r.cameraInitialized=true;const center=r.worldToScreen({x:183,z:181});r.camera.x+=r.width*.55-center.x;r.camera.y+=r.height*.5-center.y;
const panel=document.createElement('section');panel.className='encounter-training';panel.style='position:fixed;right:334px;bottom:110px;width:280px;z-index:30;background:#16271ef2;color:#f4e8c8;padding:12px;border:1px solid #a88c54;border-radius:8px;font:12px system-ui';
panel.innerHTML='<b>Open-ground encounter training</b><p>Extended health for positioning review. Real movement, damage, and collision rules.</p><div style="display:flex;gap:6px;flex-wrap:wrap"><button data-start>Start pull and surround</button><button data-pause>Pause encounter</button><button data-tank>Inspect tank</button><button data-bear>Inspect bear</button><button data-deathless>Trigger Deathless Heart</button><button data-swipe>Measure Bloodclaw damage</button><button data-join>Second bear joins</button><button data-effects>Preview buffs and debuffs</button></div><p data-state></p><p data-damage></p>';
document.body.append(panel);
panel.querySelector('[data-start]').onclick=()=>{running=true;for(const u of [tank,...party])s._sendUnitToAttack(u,bear);};
panel.querySelector('[data-pause]').onclick=()=>{running=!running;};
panel.querySelector('[data-tank]').onclick=()=>pick(tank);panel.querySelector('[data-bear]').onclick=()=>pick(bear);
panel.querySelector('[data-deathless]').onclick=()=>{bear.hp=bear.maxHp*.049;bear.deathlessTimer=0;bear.deathlessSpent=false;updateDeathlessHeart(bear);pick(bear);};
setInterval(()=>{panel.querySelector('[data-state]').textContent=`Tank: ${tank.actionLabel}. Bear moved ${Math.hypot(bear.x-180,bear.z-180).toFixed(1)} units · Clearing ${(encounterOpenness(s,bear)*100).toFixed(0)}% open · ${party.filter(u=>!u.dead).length} fighters · Deathless ${(bear.deathlessTimer??0).toFixed(0)}s`;},250);

panel.querySelector('[data-swipe]').onclick=()=>{
  running=false;bear.x=210;bear.z=180;bear.greatwoodEnraged=true;bear.specialSwipeReadyAt=0;
  const units=[tank,...party,healer];
  units.forEach((u,i)=>{const angle=i/units.length*Math.PI*2;u.x=bear.x+Math.cos(angle)*9;u.z=bear.z+Math.sin(angle)*9;u.hp=u.maxHp;u.dead=false;});
  s._applyGrizzlyCleave(bear,tank);
  panel.querySelector('[data-damage]').textContent=`Bloodclaw measured: tank lost ${((1-tank.hp/tank.maxHp)*100).toFixed(1)}% max HP; fighters ${party.map(u=>((1-u.hp/u.maxHp)*100).toFixed(0)+'%').join(', ')}; healer ${((1-healer.hp/healer.maxHp)*100).toFixed(0)}%.`;
  pick(bear);
};

panel.querySelector('[data-join]').onclick=()=>{const second=s.addUnit('grizzly',bear.x+8,bear.z+8,'wildlife');second.bearVariant='cindermaw';second.hp=second.maxHp=180000;second.command='attack';second.attackTarget=tank.id;second.actionLabel='Joining the attack';if(s.units.filter(u=>u.type==='shieldbearer').length<2){const off=s.addUnit('shieldbearer',196,192,'player'),support=s.addUnit('villager',202,194,'player');off.hp=off.maxHp=348000;off.teamId=support.teamId=1;s._sendUnitToAttack(off,bear);}pick(tank);};
panel.querySelector('[data-effects]').onclick=()=>{tank.hp=tank.maxHp*.18;tank.lastStandTimer=20;tank.lastStandSpent=true;bear.lastLightCurseActive=true;bear.stunTimer=8;bear.command='attack';bear.attackTarget=tank.id;};
