import {encounterOpenness} from '../src/combat-teams.js?v=20260913-skybreaker2';
import {updateDeathlessHeart} from '../src/deathless-heart.js?v=20260913-skybreaker2';
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
panel.innerHTML='<b>Open-ground encounter training</b><p>Extended health for positioning review. Real movement, damage, and collision rules.</p><div style="display:flex;gap:6px;flex-wrap:wrap"><button data-start>Start pull and surround</button><button data-pause>Pause encounter</button><button data-tank>Inspect tank</button><button data-bear>Inspect bear</button><button data-woods>Preview woodland pull</button><button data-retarget>Tank falls · next portrait</button><button data-deathless>Trigger Deathless Heart</button><button data-swipe>Measure Bloodclaw damage</button><button data-join>Second bear joins</button><button data-effects>Trigger Last Light Chorus</button></div><p data-state></p><p data-damage></p>';
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
panel.querySelector('[data-effects]').onclick=()=>{tank.hp=tank.maxHp*.09;tank.lastStandTimer=20;tank.lastStandSpent=true;healer.lastLightWardTimer=0;healer.hp=1;s._applyUnitDamage(healer,1000,bear);bear.command='attack';bear.attackTarget=tank.id;};

panel.querySelector('[data-woods]').onclick=()=>{running=false;bear.x=210;bear.z=180;bear.hp=bear.maxHp;bear.dead=false;bear.command='idle';bear.path=[];tank.x=198;tank.z=180;tank.hp=tank.maxHp;tank.teamId=null;for(const u of [...party,healer]){u.x=240;u.z=230;u.command='idle';u.path=[];}s.addResource('tree','wood',210,166,2400,0,{sizeTier:'large'});s._sendUnitToAttack(tank,bear);pick(tank);running=true;};

const portraitTypes=['spearwarden','villager','soldier','scout','militia','raider','ashenForager','ashenOutrider','thornSpear','hearthLevy','hidewall'];let portraitIndex=0,portraitVictim=null;
panel.querySelector('[data-retarget]').onclick=()=>{running=false;for(const u of s.units.filter(u=>u.type==='shieldbearer'&&!u.dead))s._killUnit(u,bear);if(portraitVictim)s._killUnit(portraitVictim,bear);const type=portraitTypes[portraitIndex++%portraitTypes.length];portraitVictim=s.addUnit(type,bear.x+8,bear.z,'player');portraitVictim.hp=portraitVictim.maxHp=1000;bear.command='attack';bear.attackTarget=portraitVictim.id;bear.actionLabel='Turning on '+type;pick(bear);};

// An uncluttered spell stage using the real units, ward trigger and game renderer.
if(new URLSearchParams(location.search).has('chorusShowcase')){
 const style=document.createElement('style');style.textContent='.game-shell > :not(#game-canvas):not(#loading-veil),.encounter-training,#unit-activity,#combat-frames{display:none!important}.chorus-stage{position:fixed;inset:0;pointer-events:none;z-index:80;background:linear-gradient(#071a18d9,transparent 29%,transparent 72%,#071a18ed);color:#fff0c5;text-align:center}.chorus-stage header{padding:34px 20px}.chorus-stage small{font:10px system-ui;letter-spacing:4px;color:#c8dfc2}.chorus-stage h1{font:clamp(26px,5vw,44px) Marcellus,serif;margin:12px 0}.chorus-stage p{font:13px system-ui;color:#dbdec5}.chorus-stage footer{position:absolute;bottom:30px;width:100%}.chorus-stage button{pointer-events:auto;border:1px solid #c0a263;border-radius:24px;background:#173a30e8;color:#ffedba;padding:12px 22px;margin:5px;font:13px system-ui}.chorus-stage output{display:block;font:11px system-ui;letter-spacing:2px;color:#b9d1bc;margin:12px}';document.head.append(style);
 const stage=document.createElement('section');stage.className='chorus-stage';stage.innerHTML='<header><small>HEARTHKIN · TEAM BLESSING</small><h1>Chorus of the Last Light</h1><p>One life spared. A whole company rekindled.</p></header><footer><output>GOLDEN DAWN · LIVING LIGHT · 200% HEALING</output><button data-replay>Replay blessing</button><button data-still>Hold the spell</button><button data-opening>Opening burst</button><p>In-game spell preview · 60-second blessing</p></footer>';document.body.append(stage);
 s.units=[healer,tank,party[0],party[1],party[2]];s.buildings=[];s.resourcesNodes=[];s.navigationVersion++;s.selectedIds=[];s._syncSelectionFlags();
 r.camera.zoom=.95;r.zoomMotion=null;r.cameraInitialized=true;
 const center=r.worldToScreen({x:190,z:180});r.camera.x+=r.width*.5-center.x;r.camera.y+=r.height*.58-center.y;
 const slots=[[.5,.55],[.28,.68],[.72,.68],[.26,.44],[.74,.44]];
 s.units.forEach((u,i)=>{Object.assign(u,r.screenToWorld({x:r.width*slots[i][0],y:r.height*slots[i][1]}));u.command='idle';u.path=[];u.attackTarget=null;u.teamId=null;u.selected=false;u.hp=u.maxHp;});
 let held=false,cycle=0;
 const cast=()=>{cycle=0;held=false;healer.lastLightWardTimer=0;healer.hp=1;s._applyUnitDamage(healer,1000,null);stage.querySelector('[data-still]').textContent='Hold the spell';};
 stage.querySelector('[data-replay]').onclick=cast;
 stage.querySelector('[data-opening]').onclick=()=>{cast();held=true;for(const u of s.units){u.lastLightChorusTimer=59.3;u.animClock=1;u.healPulse=.3;}healer.lastLightChorusCastTimer=2.1;healer.lastLightWardBlastTimer=.2;stage.querySelector('[data-still]').textContent='Resume light';};
 stage.querySelector('[data-still]').onclick=()=>{held=!held;stage.querySelector('[data-still]').textContent=held?'Resume light':'Hold the spell';};
 s._updateFixed=dt=>{if(held)return;s.clock+=dt;cycle+=dt;for(const u of s.units){u.animClock=(u.animClock??0)+dt;u.animationTime=(u.animationTime??0)+dt;s._updateUnitStatusEffects(u,dt);u.healPulse=Math.max(0,(u.healPulse??0)-dt);}if(cycle>7)cast();};
 cast();
}
