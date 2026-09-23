// Touch commands use the same simulation orders as the original controls.
export function createTouchControls({input,simulation:sim,renderer:r,announce}) {
 const canvas=input.canvas,body=document.body;
 const css=document.createElement('link');css.rel='stylesheet';css.href='./touch-controls.css?v=20260923-livingearth1';document.head.append(css);
 const toggle=document.createElement('button');toggle.id='control-mode';toggle.type='button';document.querySelector('.world-tools').prepend(toggle);
 const panel=document.createElement('div');panel.className='touch-controls';panel.innerHTML=`
  <div class="touch-view"><button data-touch="home">⌂ <span>Home</span></button><button data-touch="follow" aria-pressed="false">◎ <span>Follow</span></button><button data-touch="pause" aria-pressed="false">Ⅱ <span>Pause</span></button><button data-touch="details" aria-expanded="false">☷ <span>Settlement</span></button><button data-touch="more" aria-expanded="false">••• <span>More</span></button></div>
  <div class="touch-order-bar" aria-label="Touch orders"><button data-touch="auto" aria-pressed="true">↖ <span>Tap orders</span></button><button data-touch="move" aria-pressed="false">➜ <span>Move</span></button><button data-touch="attack" aria-pressed="false">⚔ <span>Attack</span></button><button data-touch="area" aria-pressed="false">▧ <span>Select area</span></button><button data-touch="stop">■ <span>Stop</span></button><button data-touch="deselect">◇ <span>Deselect</span></button><button data-touch="cancel">✕ <span>Cancel</span></button></div>
  <div class="touch-placement" hidden><span>Drag the preview, then confirm.</span><button data-touch="place">✓ Place</button><button data-touch="cancel">✕ Cancel</button></div>
  <div class="touch-squads"><span>SQUADS</span><button data-touch="squad1">Squad 1</button><button data-touch="save1" aria-label="Save selected units to squad 1">Save 1</button><button data-touch="squad2">Squad 2</button><button data-touch="save2" aria-label="Save selected units to squad 2">Save 2</button></div>
  <div class="touch-hint" role="status">Tap to select or give an order · Drag to pan · Pinch to zoom</div>`;
 document.querySelector('.game-shell').append(panel);
 // Keep primary orders with the existing class selector, above construction controls.
 document.querySelector('.command-deck').prepend(panel.querySelector('.touch-order-bar'));
 document.querySelector('.command-deck').append(panel.querySelector('.touch-squads'));
 let enabled=false,mode='auto',paused=false,follow=false,preview=null,previewType=null,wallStart=null;
 const activity=document.querySelector('.unit-activity-panel'),activityAnchor=document.createComment('unit activity original position');activity?.before(activityAnchor);
 let points=new Map(),gesture=null,pinch=null,squads=[[],[]];
 const btn=key=>document.querySelector(`[data-touch="${key}"]`);
 const selected=()=>sim.selectedEntities.filter(u=>u.kind==='unit'&&u.faction==='player'&&!u.dead);
 function resetGesture(){points.clear();gesture=null;pinch=null;input.drag=null;input.pan=null;r.setSelectionBox(null);}
 function cancel(){resetGesture();preview=null;previewType=null;wallStart=null;input.cancelBuildMode();input.cancelDemolitionMode();input.cancelGuardMode();input.cancelRallyMode();input.cancelPatrolMode();setOrder('auto',false);}
 function setOrder(value,clear=true){if(clear)cancel();mode=value;for(const key of ['auto','move','attack','area'])btn(key).setAttribute('aria-pressed',String(key===mode));}
 function setEnabled(value){cancel();enabled=value;paused=false;follow=false;input.keys.clear();if(activity){if(value)document.querySelector('.left-rail').append(activity);else activityAnchor.after(activity);}body.classList.toggle('touch-mode',value);body.classList.remove('touch-details','touch-more');toggle.textContent=value?'TOUCH CONTROLS':'ORIGINAL CONTROLS';toggle.setAttribute('aria-label',value?'Touch controls active. Switch to original controls':'Original controls active. Switch to touch controls');toggle.setAttribute('aria-pressed',String(value));try{localStorage.setItem('crownforge-control-mode',value?'touch':'original');}catch{}update();}
 toggle.onclick=()=>{setEnabled(!enabled);announce(enabled?'Touch controls: tap to select, drag to pan, pinch to zoom.':'Original mouse and keyboard controls restored.');};
 function center(point){if(!point)return;const p=r.worldToScreen(point);r.panBy(r.width*.5-p.x,r.height*.43-p.y);}
 function commit(){if(!preview||!input.buildMode){announce('Choose a location on the map first.');return;}const valid=input.buildMode==='wall'?sim.placeWallLine(wallStart,preview.world):sim.placeBuilding(input.buildMode,preview.world,preview);input.onPlacement({kind:'placement',valid});if(valid){r.addRipple(preview.world,'#d7aa54');cancel();}else announce('That site is blocked or unaffordable. Move the preview to a clear site.');}
 function action(key){
  input.onGesture();
  if(['auto','move','attack','area'].includes(key)){setOrder(key);follow=false;announce({auto:'Tap a unit to select it, then tap a destination.',move:'Tap a destination for selected units.',attack:'Tap an enemy to attack with selected units.',area:'Drag a box around the units you want.'}[key]);}
  if(key==='cancel')cancel();
  if(key==='deselect'){cancel();follow=false;sim.selectedIds=[];sim._syncSelectionFlags();input.onSelection([]);announce('Selection cleared. Tap a building or another unit.');}
  if(key==='place')commit();
  if(key==='home'){follow=false;document.querySelector('#view-home').click();}
  if(key==='follow'){follow=!follow;if(!selected().length){follow=false;announce('Select your units first.');}}
  if(key==='pause'){paused=!paused;announce(paused?'Tactical pause — give orders, then resume.':'Battle resumed.');}
  if(key==='details'||key==='more'){const cls=key==='details'?'touch-details':'touch-more';body.classList.toggle(cls);btn(key).setAttribute('aria-expanded',String(body.classList.contains(cls)));}
  if(key==='stop'){for(const u of selected()){sim._interruptWork(u);u.path=[];u.command='idle';u.moveTarget=null;u.velocityX=0;u.velocityZ=0;}announce('Current orders stopped. Units may defend themselves.');}
  if(key.startsWith('save')){const i=Number(key.slice(-1))-1;squads[i]=[...selected()];announce(`Squad ${i+1}: ${squads[i].length} units saved.`);}
  if(key.startsWith('squad')){const i=Number(key.slice(-1))-1;sim.selectedIds=squads[i].filter(u=>sim.units.includes(u)&&u.faction==='player'&&!u.dead).map(u=>u.id);sim._syncSelectionFlags();input.onSelection(sim.selectedEntities);if(!sim.selectedIds.length)announce('Select units, then use Save to create this squad.');}
  update();
 }
 document.querySelectorAll('[data-touch]').forEach(b=>{b.type='button';if(!b.hasAttribute('aria-label'))b.setAttribute('aria-label',b.textContent.trim());b.addEventListener('click',()=>action(b.dataset.touch));});
 function hit(point,intent='select'){
  const exact=r.getEntityAtScreen(sim,point,intent);if(exact)return exact;
  // Forgiving touch halo, while retaining the renderer's silhouette hit testing.
  for(const radius of [10,20])for(let i=0;i<8;i++){const a=i*Math.PI/4,hit=r.getEntityAtScreen(sim,{x:point.x+Math.cos(a)*radius,y:point.y+Math.sin(a)*radius},intent);if(hit?.kind==='unit')return hit;}
  return sim.getEntityAt(r.screenToWorld(point));
 }
 function order(point,target){const world=r.screenToWorld(point),result=sim.issueContextCommand(world,target);input.onCommand(result);if(result.kind!=='none')r.addRipple(target?.kind==='unit'?target:world,result.kind==='attack'?'#d86b55':'#86c4cf');}
 function placement(point){
  // Keep the foundation clear of the finger, but store world coordinates for confirmation.
  const world=r.screenToWorld({x:point.x,y:point.y-64});
  if(input.buildMode==='wall'){wallStart??=world;preview=sim.getWallLinePreview(wallStart,world);preview={...preview,world};}
  else preview=sim.getBuildingPlacementPreview(input.buildMode,world);
  previewType=input.buildMode;r.setBuildPreview(preview);update();
 }
 function tap(point,event){
  if(input.buildMode){placement(point);return;}
  if(input.guardMode||input.rallyMode||input.patrolMode||input.demolitionMode){input._down(event);input._up(event);return;}
  if(mode==='attack'){const target=hit(point,'command');if(!target||!['enemy','wildlife'].includes(target.faction)){announce('Tap an enemy to attack.');return;}order(point,target);setOrder('auto',false);return;}
  if(mode==='move'){order(point,{kind:'ground'});setOrder('auto',false);return;}
  const target=hit(point);
  if(target?.kind==='unit'||!selected().length){if(target)sim.selectEntity(target);else sim.selectAt(r.screenToWorld(point));input.onSelection(sim.selectedEntities);}
  else order(point,hit(point,'command'));
 }
 function metrics(){const [a,b]=[...points.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};}
 function intercept(e){if(!enabled||e.button>0)return false;e.preventDefault();e.stopImmediatePropagation();return true;}
 canvas.addEventListener('pointerdown',e=>{
  if(!intercept(e))return;input.onGesture();canvas.focus({preventScroll:true});const p=input._point(e);points.set(e.pointerId,p);canvas.setPointerCapture(e.pointerId);
  if(points.size>1){gesture=null;r.setSelectionBox(null);pinch=metrics();follow=false;return;}
  gesture={start:p,last:p,moved:false};input.pointer=p;
  if(input.buildMode)placement(p);
 },true);
 canvas.addEventListener('pointermove',e=>{
  if(!intercept(e)||!points.has(e.pointerId))return;const p=input._point(e);points.set(e.pointerId,p);
  if(points.size>1){const next=metrics();if(pinch){r.panBy(next.x-pinch.x,next.y-pinch.y);r.zoomMotion=null;r.zoomAt(next.d/pinch.d,next);}pinch=next;return;}
  if(!gesture)return;
  if(Math.hypot(p.x-gesture.start.x,p.y-gesture.start.y)>9)gesture.moved=true;
  if(input.buildMode)placement(p);
  else if(mode==='area')r.setSelectionBox({x:gesture.start.x,y:gesture.start.y,width:p.x-gesture.start.x,height:p.y-gesture.start.y});
  else if(gesture.moved){follow=false;r.panBy(p.x-gesture.last.x,p.y-gesture.last.y);}
  gesture.last=p;input.pointer=p;
 },true);
 window.addEventListener('pointerup',e=>{
  if(!enabled||!points.has(e.pointerId))return;e.preventDefault();e.stopImmediatePropagation();points.delete(e.pointerId);
  if(pinch){if(!points.size)resetGesture();return;}
  const p=input._point(e),g=gesture;gesture=null;
  if(g&&mode==='area'){sim.selectRect(g.start,p,u=>r.worldToScreen(u),false);r.setSelectionBox(null);input.onSelection(sim.selectedEntities);setOrder('auto',false);}
  else if(g&&!g.moved)tap(p,e);
  update();
 },true);
 window.addEventListener('pointercancel',e=>{if(enabled&&points.has(e.pointerId)){e.stopImmediatePropagation();resetGesture();}},true);
 window.addEventListener('blur',resetGesture);
 window.addEventListener('keydown',e=>{if(enabled&&e.key==='Escape')cancel();});
 // Original hover processing must not overwrite a touch-confirmed foundation.
 const originalBuild=input.setBuildMode.bind(input);input.setBuildMode=(...args)=>{originalBuild(...args);if(enabled){preview=null;wallStart=null;setOrder('auto',false);r.setBuildPreview(null);announce(input.buildMode==='wall'?'Drag a wall line on the map, then tap Place.':'Drag a foundation onto clear ground, then tap Place.');}};
 const originalCursor=input._updateCursor.bind(input);input._updateCursor=(...args)=>{if(!enabled)originalCursor(...args);};
 function update(){
  if(input.buildMode!==previewType){preview=null;wallStart=null;previewType=input.buildMode;}
  document.querySelector('.touch-placement').hidden=!enabled||!input.buildMode;
  btn('place').disabled=!preview?.valid;
  document.querySelector('.touch-placement>span').textContent=preview?(preview.valid?'Ready to build — tap Place.':preview.reason||'Choose a clear site.'):'Drag the preview, then confirm.';
  btn('pause').innerHTML=paused?'▶ <span>Resume</span>':'Ⅱ <span>Pause</span>';btn('pause').setAttribute('aria-pressed',String(paused));btn('pause').setAttribute('aria-label',paused?'Resume battle':'Pause battle');btn('follow').setAttribute('aria-pressed',String(follow));
  btn('deselect').disabled=!sim.selectedIds.length;
  for(const k of ['move','attack','stop','save1','save2'])btn(k).disabled=!selected().length;
  if(enabled&&follow){const units=selected();if(units.length)center({x:units.reduce((a,u)=>a+u.x,0)/units.length,z:units.reduce((a,u)=>a+u.z,0)/units.length});else follow=false;}
 }
 let saved;try{saved=localStorage.getItem('crownforge-control-mode');}catch{}
 const url=new URL(location.href),requested=url.searchParams.get('controls');
 if(['touch','original'].includes(requested)){saved=requested;url.searchParams.delete('controls');history.replaceState(history.state,'',url);}
 setEnabled(saved?saved==='touch':matchMedia('(pointer: coarse)').matches);
 return {update,setEnabled,get enabled(){return enabled;},get paused(){return enabled&&paused;}};
}
