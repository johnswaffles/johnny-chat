import {CrownforgeSimulation} from '../src/simulation.js?v=20260905-meadow1';
import {CrownforgeRenderer} from '../src/renderer.js?v=20260905-meadow1';
import {CHARACTER_RIGS} from '../src/character-rigs.js?v=20260905-meadow1';
import {CONFIG,UNIT_TYPES} from '../src/config.js';

const canvas=document.querySelector('#world'),renderer=new CrownforgeRenderer(canvas);
const play=document.querySelector('#play'),walker=document.querySelector('#walker'),homeButton=document.querySelector('#home');
const notice=document.querySelector('#notice'),status=document.querySelector('#status'),loading=document.querySelector('#loading');
const center={x:100,z:100},homeSite={x:112,z:99},zooms={close:.85,settlement:.52,wide:.3};
const routes={
  villager:[{x:96,z:101},{x:104,z:93},{x:106,z:101},{x:98,z:109}],
  ashenForager:[{x:102,z:99},{x:97,z:104},{x:93,z:98},{x:101,z:90}],
  scout:[{x:104,z:106},{x:98,z:112},{x:110,z:105},{x:106,z:99}],
};
const clearPoints={villager:{x:96,z:105},ashenForager:{x:100,z:109},scout:{x:102,z:112}};
let simulation,slots=[],running=true,breeze=true,view='close',ready=false,previous=performance.now(),lastStatus=0,noticeUntil=0;
let pendingHome=null,homeId=null,savedRestored=false,manualCommands=0,completedLegs=0;

function announce(message,seconds=4){notice.textContent=message;noticeUntil=performance.now()+seconds*1000;}
function actor(type){return simulation.units.find(unit=>unit.type===type&&!unit.dead);}
function restoreSelection(type=walker.value){const unit=actor(type);if(unit)simulation.selectEntity(unit);}
function issueMove(unit,point){
  const selected=[...simulation.selectedIds];
  simulation.selectEntity(unit);
  const result=simulation.issueContextCommand(point);
  simulation.selectedIds=selected;simulation._syncSelectionFlags();
  return result.success;
}
function initialize(){
  simulation=new CrownforgeSimulation({seed:20260905});
  simulation.units=[];simulation.buildings=[];simulation.resourcesNodes=[];simulation.decorations=[];simulation.projectiles=[];
  simulation._checkVictory=()=>{};simulation._updateEnemyAI=()=>{};simulation._updateEnemyIntent=()=>{};
  // This walking review owns idle orders. Keep normal pathing, construction
  // and collision services; prevent the economy from sending a paused walker
  // out of the clearing to collect supplies for a settlement with no Hall.
  simulation._updateWorkerAssignments=()=>{};
  simulation.explorationEnabled=false;simulation.autoRepairEnabled=false;
  simulation.pathCache.clear();simulation.staticBlockerGrid.clear();simulation.navigationVersion++;simulation.staticBlockerGridVersion=-1;
  // A loose woodland edge frames a clear walking area. Every tree and rock
  // is a real resource with its authored production artwork and footprint.
  for(const[x,z,variant]of[[80,94,4],[84,86,0],[90,80,6],[101,78,3],[112,79,1],[122,85,5],[124,101,7],[122,113,2],[112,123,4],[84,119,1]])
    simulation.addResource('tree','wood',x,z,420,variant,{sizeTier:'small'});
  simulation.addResource('stone','stone',88,82,240,1,{sizeTier:'small'});
  simulation.addResource('stone','stone',117,121,240,0,{sizeTier:'small'});
  simulation.addResource('berry','food',81,107,105,2,{sizeTier:'small'});
  slots=Object.entries(routes).map(([type,points])=>{
    const unit=simulation.addUnit(type,points[0].x,points[0].z,'player');unit.facing=type==='scout'?3:1;
    renderer.characterRigs.get(type)?.readiness();
    return {type,id:unit.id,points,next:1,waitingUntil:0,manual:false};
  });
  restoreSelection();renderer.invalidateStaticLayer();
}
function focus(next=view){
  view=next;renderer.resize();const zoom=zooms[view];renderer.camera.zoom=zoom;renderer.cameraInitialized=true;
  renderer.camera.x=-(center.x-center.z-(CONFIG.mapWidth-CONFIG.mapHeight)/2)*CONFIG.tileWidth/2*zoom;
  renderer.camera.y=-(center.x+center.z-(CONFIG.mapWidth+CONFIG.mapHeight)/2)*CONFIG.tileHeight/2*zoom+36;
  renderer.invalidateStaticLayer();
  document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));
}
function setRunning(value){running=value;play.textContent=running?'Pause':'Wander';play.setAttribute('aria-pressed',String(!running));}
function setBreeze(value){
  breeze=value;renderer.atmosphere.reducedMotion=!value;
  if(renderer.meadow)renderer.meadow.windEnabled=value;
  document.querySelector('#breeze').setAttribute('aria-pressed',String(value));
}
function patrol(){
  if(pendingHome)return;
  for(const slot of slots){
    const unit=simulation.units.find(candidate=>candidate.id===slot.id);
    if(!unit||unit.dead||unit.command!=='idle'||unit.path.length||unit.orderQueue?.length||simulation.clock<slot.waitingUntil)continue;
    if(slot.manual){slot.manual=false;slot.waitingUntil=simulation.clock+1.7;continue;}
    if(issueMove(unit,slot.points[slot.next])){
      slot.next=(slot.next+1)%slot.points.length;slot.waitingUntil=simulation.clock+.8;completedLegs++;
    }else slot.waitingUntil=simulation.clock+1;
  }
}
function updateHome(){
  if(!pendingHome)return;
  const everyoneClear=slots.every(slot=>{const u=actor(slot.type);return u&&u.command==='idle'&&!u.path.length;});
  if(!everyoneClear)return;
  const selected=walker.value;simulation.selectEntity(actor('villager'));
  const preview=simulation.getBuildingPlacementPreview('homestead',homeSite);
  if(preview.valid&&simulation.placeBuilding('homestead',homeSite,preview)){
    homeId=simulation.buildings.find(building=>building.type==='homestead'&&!building.destroyed)?.id??null;
    pendingHome=null;homeButton.disabled=false;homeButton.textContent='Clear home';homeButton.setAttribute('aria-pressed','true');
    renderer.invalidateStaticLayer();announce('A new home takes root. Watch the meadow give way to its foundation.',7);
  }else{
    pendingHome=null;homeButton.disabled=false;homeButton.textContent='Build a home';announce(preview.reason??'The site needs a little more room.',7);
  }
  restoreSelection(selected);
}
function toggleHome(){
  const existing=simulation.buildings.find(building=>building.id===homeId&&!building.destroyed);
  if(existing){
    simulation.demolishStructures([existing]);homeId=null;renderer.invalidateStaticLayer();homeButton.textContent='Build a home';homeButton.setAttribute('aria-pressed','false');
    announce('The home is cleared. The meadow is open again.',5);return;
  }
  pendingHome={started:simulation.clock};setRunning(true);homeButton.disabled=true;homeButton.textContent='Making room…';
  for(const slot of slots){slot.manual=false;issueMove(actor(slot.type),clearPoints[slot.type]);}
  announce('Making room for a home. The Hearthkin will walk clear first.',7);
}
function saveRestore(){
  if(pendingHome){announce('Let the walkers clear the site first.');return;}
  const saved=simulation.serialize(),positions=simulation.units.map(unit=>({id:unit.id,x:unit.x,z:unit.z}));
  savedRestored=simulation.loadSnapshot(saved)&&positions.every(p=>{const u=simulation.units.find(unit=>unit.id===p.id);return u&&u.x===p.x&&u.z===p.z;});
  restoreSelection();renderer.invalidateStaticLayer();
  announce(savedRestored?'Meadow saved and restored. Everyone carries on from the same place.':'The meadow could not be restored.',6);
}

play.addEventListener('click',()=>setRunning(!running));
walker.addEventListener('change',()=>{restoreSelection();announce(`${CHARACTER_RIGS[walker.value].label} selected. Click the grass to lead the way.`);});
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>focus(button.dataset.view)));
document.querySelector('#breeze').addEventListener('click',()=>setBreeze(!breeze));
homeButton.addEventListener('click',toggleHome);
document.querySelector('#restore').addEventListener('click',saveRestore);
canvas.addEventListener('pointerdown',event=>{
  if(event.button!==0||!ready)return;
  const rect=canvas.getBoundingClientRect(),point={x:event.clientX-rect.left,y:event.clientY-rect.top};
  const clicked=simulation.units.filter(unit=>!unit.dead).map(unit=>{
    const p=renderer.worldToScreen(unit),height=(unit.type==='scout'?UNIT_TYPES.scout.renderSize:UNIT_TYPES[unit.type].renderSize)*renderer.camera.zoom;
    return {unit,hit:Math.abs(point.x-p.x)<height*.27&&point.y<p.y+8&&point.y>p.y-height};
  }).filter(entry=>entry.hit).at(-1)?.unit;
  if(clicked){walker.value=clicked.type;restoreSelection(clicked.type);announce(`${CHARACTER_RIGS[clicked.type].label} selected.`);return;}
  if(pendingHome){announce('The Hearthkin are making room for the foundation.');return;}
  const world=renderer.screenToWorld(point);
  if(world.x<78||world.x>122||world.z<78||world.z>122){announce('Choose a spot in this meadow.');return;}
  const obstacle=simulation.getEntityAt(world);
  if(obstacle?.kind==='building'||obstacle?.kind==='resource'){announce('Choose open grass for a walk.');return;}
  const unit=actor(walker.value);if(!unit)return;
  if(issueMove(unit,world)){
    const slot=slots.find(entry=>entry.id===unit.id);slot.manual=true;slot.waitingUntil=simulation.clock+.7;
    renderer.addRipple(world);manualCommands++;setRunning(true);announce('On the way.',2);
  }else announce('Try another open patch of grass.');
});
canvas.addEventListener('keydown',event=>{if(event.code==='Space'){event.preventDefault();setRunning(!running);}});
window.addEventListener('resize',()=>focus());
initialize();focus();setBreeze(true);

// Review hooks stay confined to this dedicated development page.
window.__meadowStudio={
  get simulation(){return simulation;},renderer,get slots(){return slots;},
  get state(){return {ready,running,breeze,view,homeId,homePending:!!pendingHome,savedRestored,manualCommands,completedLegs};},
  setRunning,setBreeze,focus,toggleHome,saveRestore,
};
function frame(now){
  const delta=Math.min(.05,(now-previous)/1000);previous=now;
  const art=renderer.startupReadiness(simulation),grassReady=!renderer.meadow||renderer.meadow.sprites.length===12;
  ready=art.ready&&grassReady;
  if(ready&&running){simulation.update(delta);updateHome();patrol();}
  renderer.render(simulation,null,now);
  if(now-lastStatus>250){
    lastStatus=now;loading.hidden=ready;
    document.querySelector('#loading-progress').style.width=`${Math.round(art.ratio*100)}%`;
    document.querySelector('#loading-copy').textContent=art.ready&&!grassReady?'Waiting for the wild grasses.':'The meadow is waking.';
    const home=simulation.buildings.find(building=>building.id===homeId&&!building.destroyed);
    status.textContent=!ready?'Opening the meadow…':pendingHome?'Making room…':home&&home.progress<1?'Raising a home':!running?'A moment of stillness':breeze?'Wandering · a gentle breeze':'Wandering · still air';
    if(now>noticeUntil)notice.textContent='';
    Object.assign(canvas.dataset,{ready:String(ready),running:String(running),view,manualCommands:String(manualCommands),completedLegs:String(completedLegs),saveRestored:String(savedRestored),homePresent:String(!!home),homeProgress:String(home?.progress??0)});
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
