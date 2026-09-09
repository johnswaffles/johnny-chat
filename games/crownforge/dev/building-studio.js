import { CrownforgeSimulation } from '../src/simulation.js?v=20260909-fullroster1';
import { CrownforgeRenderer } from '../src/renderer.js?v=20260909-fullroster1';
import { BUILDING_TYPES, CONFIG, FIRST_AGE_ASSETS, ASHEN_BUILDING_ASSETS } from '../src/config.js?v=20260909-fullroster1';
import { BUILDING_DEPTH } from '../src/building-depth-data.js?v=20260909-fullroster1';
import { BUILDING_COMPONENTS } from '../src/building-components-data.js?v=20260909-fullroster1';
import { hasBuildingOutline, outlineApproaches, projectOutsideOutline } from '../src/building-geometry.js?v=20260909-fullroster1';

const canvas=document.querySelector('#world'),renderer=new CrownforgeRenderer(canvas),select=document.querySelector('#building');
let simulation,building,last=performance.now(),walking=false,perimeter=false,lap=0;
for(const [id,b] of Object.entries(BUILDING_TYPES)){const option=document.createElement('option');option.value=id;option.textContent=b.label;select.append(option);}
function focus(zoom=null){
  renderer.resize();
  const art=BUILDING_DEPTH[building.type];
  const size=BUILDING_TYPES[building.type].renderSize,aspect=art?art.height/art.width:2/3;
  const z=zoom??Math.min(.9,(canvas.clientWidth-80)/size,(canvas.clientHeight-210)/(size*aspect+200));
  renderer.camera.zoom=Math.max(.15,z);renderer.cameraInitialized=true;
  const x=building.x,worldZ=building.z,anchorY=(art?.groundAnchorY??.95)*size*aspect;
  renderer.camera.x=-(x-worldZ-(CONFIG.mapWidth-CONFIG.mapHeight)/2)*26*z;
  renderer.camera.y=-(x+worldZ-(CONFIG.mapWidth+CONFIG.mapHeight)/2)*13*z+(anchorY-170)*z*.46+15;
  renderer.invalidateStaticLayer();
}
function reset(){
  simulation=new CrownforgeSimulation({seed:42});
  simulation.units=[];simulation.buildings=[];simulation.resourcesNodes=[];simulation.decorations=[];
  simulation._checkVictory=()=>{};simulation._updateEnemyAI=()=>{};simulation._updateEnemyIntent=()=>{};simulation._updateMilitaryServices=()=>{};simulation._updateWorkerServices=()=>{};
  simulation.navigationVersion++;simulation.staticBlockerGridVersion=-1;
  const type=select.value,ashen=Boolean(ASHEN_BUILDING_ASSETS[type]);
  building=simulation.addBuilding(type,130,130,ashen?'enemy':'player',1);building.selected=perimeter;
  const actors=ashen?['ashenForager','ashenForager','raider','raider']:['villager','villager','soldier','soldier'];
  const approaches=hasBuildingOutline(building)?outlineApproaches(building,1.25):[{x:building.x+6,z:building.z+6}];
  actors.forEach((type,i)=>{const front=approaches[0],dx=(i-1.5)*105/52;let p={x:front.x+dx,z:front.z-dx};p=projectOutsideOutline(p,building,1.2,'foot')??p;const u=simulation.addUnit(type,p.x,p.z,building.faction);u.facing=i<2?2:0;u.needsSafetyRegroup=false;u.idleDuration=-1e9;u.autoWork=false;});
  walking=false;lap=0;document.querySelector('#progress').value='100';document.querySelector('#title').textContent=BUILDING_TYPES[type].label;focus();
}
select.onchange=reset;document.querySelector('#fit').onclick=()=>focus();document.querySelector('#detail').onclick=()=>focus(1.25);
document.querySelector('#perimeter').onclick=event=>{perimeter=!perimeter;building.selected=perimeter;event.currentTarget.setAttribute('aria-pressed',String(perimeter));};
document.querySelector('#progress').oninput=event=>{building.progress=Number(event.target.value)/100;};
document.querySelector('#walk').onclick=()=>{walking=!walking;lap=0;document.querySelector('#walk').textContent=walking?'At ease':'Walk around';};
canvas.addEventListener('wheel',event=>{event.preventDefault();const before=renderer.screenToWorld({x:event.offsetX,y:event.offsetY});const z=renderer.camera.zoom;renderer.camera.zoom=Math.max(.1,Math.min(2.4,z*Math.exp(-event.deltaY*.0015)));const after=renderer.worldToScreen(before);renderer.camera.x+=event.offsetX-after.x;renderer.camera.y+=event.offsetY-after.y;renderer.invalidateStaticLayer();},{passive:false});
let drag=null;canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(!drag)return;renderer.camera.x+=e.clientX-drag.x;renderer.camera.y+=e.clientY-drag.y;drag={x:e.clientX,y:e.clientY};renderer.invalidateStaticLayer();};canvas.onpointerup=()=>{drag=null;};canvas.onpointercancel=()=>{drag=null;};
reset();window.addEventListener('resize',()=>focus());
function frame(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  const ready=simulation.units.every(u=>renderer.characterRigs.get(u.type)?.readiness().every(i=>i.complete&&i.naturalWidth));
  if(ready&&walking){
    for(const [i,u] of simulation.units.entries())if(!u.path.length){const targets=simulation._buildingApproachPoints(building,3,u);u.studioWaypoint=((u.studioWaypoint??i*2)+1)%targets.length;simulation._sendUnitTo(u,targets[u.studioWaypoint],'move');}
    lap+=dt*.08;
    simulation.update(dt);
  }else for(const u of simulation.units){u.animClock+=dt;simulation.animation.update(u,dt);}
  renderer.render(simulation,null,now);
  const blocks=simulation.units.filter(u=>simulation._pointBlockedForUnit(u,u)).length;
  document.querySelector('#status').textContent=`${BUILDING_DEPTH[building.type]||BUILDING_COMPONENTS[building.type]?'New artwork':'Preparing replacement'} · ${Math.round(renderer.camera.zoom*100)}% · ${blocks?'Checking approaches':'Four characters clear'}`;
  canvas.dataset.blocks=String(blocks);canvas.dataset.ready=String(ready);canvas.dataset.building=building.type;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
