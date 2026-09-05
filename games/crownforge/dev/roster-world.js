import { CrownforgeSimulation } from '../src/simulation.js';
import { CrownforgeRenderer } from '../src/renderer.js?v=20260905-rosterfit1';
import { CHARACTER_RIGS } from '../src/character-rigs.js?v=20260905-rosterfit1';
import { UNIT_TYPES, CONFIG } from '../src/config.js';

const canvas=document.querySelector('#world'),renderer=new CrownforgeRenderer(canvas);
const status=document.querySelector('#status'),results=document.querySelector('#results');
const roster=['villager','soldier','scout','spearwarden','militia','shieldbearer','ashenForager','raider','ashenOutrider','thornSpear','hearthLevy','hidewall'];
let simulation,slots=[],mode='At ease',last=performance.now(),saveVerified=false,damageBaseline=0,ready=false;
function reset() {
  simulation=new CrownforgeSimulation({seed:42});
  simulation.units=[];simulation.buildings=[];simulation.resourcesNodes=[];simulation.decorations=[];
  simulation._checkVictory=()=>{};simulation._updateEnemyAI=()=>{};simulation._updateEnemyIntent=()=>{};
  simulation.navigationVersion++;simulation.staticBlockerGridVersion=-1;
  slots=roster.map((type,i)=>{
    const col=(i%4-1.5)*4.8,row=(Math.floor(i/4)-1)*10;
    const home={x:100+col+row,z:100-col+row};
    const unit=simulation.addUnit(type,home.x,home.z,'player');unit.facing=0;
    return {type,home,id:unit.id};
  });
  renderer.invalidateStaticLayer();mode='At ease';saveVerified=false;damageBaseline=0;
}
function focus() {
  renderer.resize();renderer.camera.zoom=.7;renderer.cameraInitialized=true;
  renderer.camera.x=-(100-100-(CONFIG.mapWidth-CONFIG.mapHeight)/2)*CONFIG.tileWidth/2*.7;
  renderer.camera.y=-(200-(CONFIG.mapWidth+CONFIG.mapHeight)/2)*CONFIG.tileHeight/2*.7+45;
  renderer.invalidateStaticLayer();
}
const command=(unit,target,forced)=>{simulation.selectedIds=[unit.id];return simulation.issueContextCommand(target,forced).success;};
function walk(sign) {
  reset();mode=sign>0?'Walking right':'Walking left';
  for(const slot of slots)command(simulation.units.find(u=>u.id===slot.id),{x:slot.home.x+sign*3,z:slot.home.z-sign*3});
}
document.querySelector('#reset').onclick=()=>reset();
document.querySelector('#walk-right').onclick=()=>walk(1);document.querySelector('#walk-left').onclick=()=>walk(-1);
document.querySelector('#work-start').onclick=()=>{
  reset();const work=document.querySelector('#work').value;mode='Worker task: '+work;
  for(const slot of slots.filter(s=>UNIT_TYPES[s.type].worker)) {
    const unit=simulation.units.find(u=>u.id===slot.id),p={x:unit.x+3,z:unit.z-1};let target;
    if(work==='wood'||work==='food')target=simulation.addResource(work==='wood'?'tree':'berry',work,p.x,p.z,200,0,{sizeTier:'small'});
    else {target=simulation.addBuilding(work==='field'?'field':'homestead',p.x,p.z,'player',work==='construct'?.04:1);if(work==='repair')target.hp=target.maxHp*.5;}
    command(unit,target,target);
  }
};
document.querySelector('#attack').onclick=()=>{
  reset();mode='Military attack';
  for(const slot of slots.filter(s=>!UNIT_TYPES[s.type].worker)) {
    const unit=simulation.units.find(u=>u.id===slot.id),target=simulation.addBuilding('field',unit.x+3,unit.z-1,'enemy');
    target.hp=target.maxHp=10000;damageBaseline+=target.hp;command(unit,target,target);
  }
};
document.querySelector('#ward').onclick=()=>{
  reset();mode='Both worker wards';
  for(const worker of simulation.units.filter(u=>UNIT_TYPES[u.type].worker))simulation._applyUnitDamage(worker,999,{id:999,kind:'unit',type:'raider',faction:'enemy',x:worker.x+1,z:worker.z});
};
document.querySelector('#save-load').onclick=()=>{
  const before=simulation.serialize();saveVerified=simulation.loadSnapshot(before)&&simulation.units.length===roster.length&&roster.every(type=>simulation.units.some(u=>u.type===type));
  mode='Saved and restored current field';
};
reset();focus();window.addEventListener('resize',focus);
function frame(now) {
  const dt=Math.min(.05,(now-last)/1000);last=now;
  const art=[...renderer.characterRigs.values()].flatMap(r=>r.readiness());
  ready=roster.every(t=>CHARACTER_RIGS[t])&&art.every(i=>i.complete&&i.naturalWidth);
  if(ready)simulation.update(dt);
  renderer.render(simulation,null,now);
  const ctx=renderer.ctx;ctx.save();ctx.textAlign='center';ctx.font='11px system-ui';
  for(const slot of slots){const u=simulation.units.find(u=>u.id===slot.id);if(!u)continue;const p=renderer.worldToScreen(u);ctx.fillStyle='#10231bc9';ctx.fillRect(p.x-68,p.y+10,136,18);ctx.fillStyle='#f4e6c8';ctx.fillText(CHARACTER_RIGS[u.type]?.label??UNIT_TYPES[u.type].label??u.type,p.x,p.y+23);}
  ctx.restore();
  const states={};for(const u of simulation.units)states[u.animationState]=(states[u.animationState]??0)+1;
  const damage=damageBaseline-simulation.buildings.filter(b=>b.faction==='enemy').reduce((n,b)=>n+b.hp,0);
  const wards=simulation.units.filter(u=>u.lastLightWardTimer>0).length;
  const missing=roster.filter(type=>!CHARACTER_RIGS[type]);
  status.textContent=ready?`${mode} · ${roster.length} characters ready`:missing.length?`Awaiting character: ${missing.join(', ')}`:`Preparing artwork · ${art.filter(i=>i.complete&&i.naturalWidth).length}/${art.length}`;
  results.textContent=Object.entries(states).map(([state,n])=>`${state}: ${n}`).join(' · ')+(damageBaseline?` · damage: ${Math.round(damage)}`:'')+(wards?` · wards: ${wards}`:'')+(saveVerified?' · save restored':'');
  Object.assign(canvas.dataset,{ready:String(ready),identities:String(simulation.units.length),states:JSON.stringify(states),damage:String(damage),wards:String(wards),saveVerified:String(saveVerified)});
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
