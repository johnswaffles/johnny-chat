import {CrownforgeSimulation} from '../src/simulation.js?v=20260906-falsemercy1';
import {CrownforgeRenderer} from '../src/renderer.js?v=20260906-falsemercy1';
import {CONFIG} from '../src/config.js?v=20260906-firstcondemnation1';
import {treeAppearance,woodlandDensity} from '../src/landscape-layout.js?v=20260905-greatwood3';
const canvas=document.querySelector('#world'),renderer=new CrownforgeRenderer(canvas),simulation=new CrownforgeSimulation({seed:42});
const trees=simulation.resourcesNodes.filter(n=>n.type==='tree'),forestCount=trees.length;
const targets={};
for(const [name,group] of [['pine',0],['spruce',1],['broadleaf',2]]){
 const candidates=trees.filter(n=>n.x>55&&n.z>55&&n.x<CONFIG.mapWidth-55&&n.z<CONFIG.mapHeight-55).map(n=>({n,look:treeAppearance(n)})).filter(({look})=>look.habitat===group);
 candidates.sort((a,b)=>(b.look.interior*2+woodlandDensity(b.n.x,b.n.z,42))-(a.look.interior*2+woodlandDensity(a.n.x,a.n.z,42)));
 targets[name]={...candidates[0].n,zoom:.38};
}
targets.meadow={x:97,z:121,zoom:.78};targets.kingdom={x:CONFIG.mapWidth/2,z:CONFIG.mapHeight/2,zoom:.044};
const descriptions={pine:'Rugged pines gather into wide, sheltering crowns.',spruce:'Tall spires rise above a cool, needle-covered forest floor.',broadleaf:'Oak and beech crowns mingle at the edges of the deep woods.',meadow:'Clover, soft grasses and little drifts of wildflowers.',kingdom:'Forests stretch between quiet glades and the two kingdoms.'};
let view='pine',ready=false,previous=performance.now(),lastStatus=0,pan=null,ordered=false;
const times={render:[],simulation:[],frames:[]},errors=[];let lastFrame=0;
const perf=new URLSearchParams(location.search).has('perf');document.querySelector('#telemetry').hidden=!perf;
function focus(name){renderer.zoomMotion=null;view=name;renderer.resize();const p=targets[name],zoom=name==='kingdom'?Math.min(renderer.width/(CONFIG.mapWidth+CONFIG.mapHeight)/26*.93,renderer.height/(CONFIG.mapWidth+CONFIG.mapHeight)/13*.78):p.zoom;
 renderer.camera.zoom=zoom;renderer.cameraInitialized=true;
 renderer.camera.x=-(p.x-p.z-(CONFIG.mapWidth-CONFIG.mapHeight)/2)*CONFIG.tileWidth/2*zoom;
 renderer.camera.y=-(p.x+p.z-(CONFIG.mapWidth+CONFIG.mapHeight)/2)*CONFIG.tileHeight/2*zoom+65;
 renderer.invalidateStaticLayer();document.querySelector('#description').textContent=descriptions[name];
 document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));
 times.render=[];times.simulation=[];times.frames=[];lastFrame=0;
}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>focus(b.dataset.view)));
document.querySelectorAll('[data-light]').forEach(b=>b.addEventListener('click',()=>{renderer.atmosphere.mode=b.dataset.light;document.querySelectorAll('[data-light]').forEach(button=>button.setAttribute('aria-pressed',String(button===b)))}));
renderer.atmosphere.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
canvas.addEventListener('pointerdown',e=>{pan={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(!pan)return;renderer.panBy(e.clientX-pan.x,e.clientY-pan.y);pan={x:e.clientX,y:e.clientY}});
canvas.addEventListener('pointerup',()=>pan=null);canvas.addEventListener('pointercancel',()=>pan=null);
canvas.addEventListener('wheel',e=>{e.preventDefault();const box=canvas.getBoundingClientRect();renderer.queueZoom(e.deltaY<0?1.12:1/1.12,{x:e.clientX-box.left,y:e.clientY-box.top})},{passive:false});
window.addEventListener('resize',()=>focus(view));window.addEventListener('error',e=>errors.push(e.message));focus(view);
const measure=a=>{const sorted=[...a].sort((a,b)=>a-b);return{count:a.length,p95:+(sorted[Math.floor(a.length*.95)]??0).toFixed(2),max:+(sorted.at(-1)??0).toFixed(2)}};
window.__forestStudio={simulation,renderer,targets,focus,times,errors,get ready(){return ready}};
function frame(now){const delta=Math.min(.05,(now-previous)/1000);previous=now;renderer.advanceCamera(delta);ready=renderer.startupReadiness(simulation).ready&&renderer.meadow.sprites.length===12;
 if(ready&&!ordered){ordered=true;const workers=simulation.units.filter(u=>u.type==='villager'&&u.faction==='player');simulation.selectedIds=workers.map(u=>u.id);simulation._syncSelectionFlags();const target=[...trees].sort((a,b)=>Math.hypot(a.x-78,a.z-102)-Math.hypot(b.x-78,b.z-102))[0];simulation.issueContextCommand(target,target);}
 const t=performance.now();if(ready)simulation.update(delta);const m=performance.now();renderer.render(simulation,null,now);const end=performance.now();
 if(ready){times.simulation.push(m-t);times.render.push(end-m);if(lastFrame)times.frames.push(now-lastFrame);lastFrame=now;for(const a of Object.values(times))if(a.length>12000)a.shift();}
 if(now-lastStatus>1000){lastStatus=now;document.querySelector('#loading').hidden=ready;document.querySelector('#status').textContent=ready?forestCount.toLocaleString()+' living trees · a new Crownlands':'The forest is waking…';document.querySelector('#telemetry').textContent=JSON.stringify({view,ready,trees:forestCount,render:measure(times.render),simulation:measure(times.simulation),frames:measure(times.frames),visible:renderer.resourceEntries?.length,tufts:renderer.meadow.tufts.length,gatheredWood:simulation.lifetimeGathered.wood,errors},null,1)}
 requestAnimationFrame(frame);
}requestAnimationFrame(frame);
