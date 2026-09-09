import { BEAR_VARIANT_IDS, BEAR_VARIANTS } from '../src/bear-variants.js?v=20260909-cursedbears1';
import {UNIT_TYPES,CONFIG} from '../src/config.js';
import {bearFuryActive} from '../src/bear-combat.js';
// Local review controls. This module is never loaded by the game entry point.
const {simulation:s,renderer:r,input}=window.crownforge;
const errors=[];window.addEventListener('error',e=>errors.push(e.message));
const bar=document.createElement('aside');bar.id='bear-review';
bar.innerHTML='<strong>GREATWOOD · LOCAL COMBAT STUDY</strong><div><label>Bloodline <select id="bear-lineage"><option value="black-oath">The Black Oath</option><option value="cindermaw">The Cindermaw</option><option value="ashen-grudge">The Ashen Grudge</option></select></label><button data-scene="normal">Unmarked bear</button><button data-scene="curse">Lesser curse</button><button data-scene="fury">10% true health</button><button data-scene="battle">Three-target swipe</button><button data-scene="chase">Running attacks</button><button data-scene="arrows">Arrow trial</button><button id="one-arrow">Fire one arrow</button><button id="collapse">Collapse</button><button id="freeze">Pause scene</button><a href="dev/grizzly-studio.html">Four-view motion studio</a><a href="./">Play full game</a></div><output id="bear-review-status"></output>';
document.body.append(bar);
let bear,guards=[],paused=false,arrows=0,scene='normal',start=0,pauseAt=Infinity,firstSwipeShown=false;
const actualUpdate=s.update.bind(s);s.update=dt=>{
 if(paused)return;actualUpdate(dt);
 if(scene==='battle'&&!firstSwipeShown&&guards.filter(u=>u.dead).length>=3){firstSwipeShown=true;pauseAt=s.clock+.4;}
 if(s.clock>=pauseAt){paused=true;pauseAt=Infinity;bar.querySelector('#freeze').textContent='Play scene';}
};
s._checkVictory=()=>{};s._updateEnemyAI=()=>{};s._updateEnemyIntent=()=>{};
function reset(name){
 scene=name;paused=false;pauseAt=Infinity;firstSwipeShown=false;bar.querySelector('#freeze').textContent='Pause scene';s.units=[];s.buildings=[];s.resourcesNodes=[];s.projectiles=[];s.navigationVersion++;s.phase='playing';s.wildlifeState.nextSpawnAt=Infinity;s.wildlifeState.scanClock=Infinity;s.wildlifeState.responseClock=Infinity;
 s.selectedIds=[];arrows=0;start=s.clock;
 bear=s.addUnit('grizzly',100,100,'wildlife');bear.bearVariant=bar.querySelector('#bear-lineage').value;bear.facing=0;bear.actionLabel='Watching the clearing';
 if(name==='curse'||name==='battle'){bear.lastLightCurseActive=true;bear.lastLightCurseDecoy=true;}
 if(name==='fury')bear.hp=bear.maxHp*.1;
 guards=[];
 if(name==='battle'){
  guards=[[101.35,100],[102,102],[99,103],[108,99]].map(([x,z])=>s.addUnit('soldier',x,z,'player'));
  s._sendUnitToAttack(bear,guards[0]);paused=true;bar.querySelector('#freeze').textContent='Play scene';
 }
 if(name==='chase'){
  bear.hp=bear.maxHp=10000;s._sendUnitTo(bear,{x:120,z:100},'move');
  guards=[s.addUnit('soldier',98.5,100,'player'),s.addUnit('raider',100,98.5,'enemy')];
  for(const guard of guards)s._sendUnitToAttack(guard,bear);
 }
 if(name==='arrows')bear.lastLightCurseActive=bear.lastLightCurseDecoy=true;
 s.selectEntity(bear);r.camera.zoom=1.45;r.zoomMotion=null;r.cameraInitialized=true;
 const point=r.worldToScreen(bear);r.camera.x+=r.width*.59-point.x;r.camera.y+=r.height*.65-point.y;
}
bar.querySelector('#bear-lineage').onchange=()=>reset(scene);
for(const button of bar.querySelectorAll('[data-scene]'))button.onclick=()=>reset(button.dataset.scene);
bar.querySelector('#freeze').onclick=()=>{paused=!paused;bar.querySelector('#freeze').textContent=paused?'Play scene':'Pause scene';};
bar.querySelector('#collapse').onclick=()=>{if(bear.dead)reset(scene);s._killUnit(bear);paused=false;pauseAt=s.clock+2.2;bar.querySelector('#freeze').textContent='Pause scene';};
bar.querySelector('#one-arrow').onclick=()=>{
 if(bear.dead)return;arrows++;s.projectiles.push({id:s.nextId++,kind:'defense-arrow',faction:'player',sourceBuildingId:999999,sourceType:'watchtower',targetId:bear.id,x:bear.x-8,z:bear.z-2,previousX:bear.x-8,previousZ:bear.z-2,startX:bear.x-8,startZ:bear.z-2,damage:18,speed:30,age:0,maxAge:5,totalDistance:8.25,portIndex:0});
};
function report(){
 const alive=guards.filter(u=>!u.dead).length;
 bar.querySelector('output').textContent=`${paused?'Paused':'Playing'} · true health ${Math.max(0,bear.hp).toFixed(0)} / ${bear.maxHp} · ${bearFuryActive(bear)?'Fury active':'Fury inactive'} · arrows fired ${arrows} · fighters alive ${alive} / ${guards.length} · ${errors.length} errors${bear.dead?' · collapse '+bear.deathAge.toFixed(1)+'s':''}`;
 window.bearReview={scene,errors,artReady:r.grizzly.ready,elapsed:s.clock-start,trueHp:bear.hp,dead:bear.dead,deathAge:bear.deathAge,alive,fury:bearFuryActive(bear),target:bear.attackTarget,movingFighters:guards.filter(u=>u.fighterMovingAttack&&u.motionSpeed>.1).length};
 requestAnimationFrame(report);
}
reset('normal');requestAnimationFrame(report);
