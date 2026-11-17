import test from 'node:test';
import assert from 'node:assert/strict';
import {PaintingCanvas} from '../../public/color-studio/canvas.js';
globalThis.ResizeObserver=class{observe(){}};
globalThis.requestAnimationFrame=()=>1;
globalThis.devicePixelRatio=2;
globalThis.Path2D=class{moveTo(){}lineTo(){}quadraticCurveTo(){}closePath(){}};
const event=(id,x,y)=>({pointerId:id,clientX:x,clientY:y,button:0,preventDefault(){}});
function canvas(){let painted=[];const element={width:0,height:0,getContext:()=>({}),addEventListener(){},setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:600,height:600})};
  const instance=new PaintingCanvas(element,{paint:id=>painted.push(id),preferences:{}});
  instance.load({width:100,height:100,map:Array(10000).fill(0),regions:[{x:50,y:50,radius:10,paths:[[[0,0],[100,0],[100,100],[0,100]]]}]},new Set());return{instance,painted};}
test('pinch zoom preserves the point between fingers and never fills a region',()=>{
  const {instance:c,painted}=canvas(),before=c.logical({x:300,y:300});
  c.down(event(1,200,300));c.down(event(2,400,300));c.move(event(1,150,300));c.move(event(2,450,300));
  assert.ok(c.zoom>1.4);const after=c.logical({x:300,y:300});assert.ok(Math.abs(before.x-after.x)<1);
  c.up(event(1,150,300));c.up(event(2,450,300));assert.deepEqual(painted,[]);
});
test('a one-finger tap fills, a drag pans, and zoom clamps at forty times',()=>{
  const {instance:c,painted}=canvas();c.down(event(1,300,300));c.up(event(1,300,300));assert.deepEqual(painted,[0]);
  c.zoomAt(3);c.down(event(2,300,300));c.move(event(2,340,320));c.up(event(2,340,320));assert.equal(painted.length,1);assert.ok(c.pan.x>0);
  c.zoomAt(100);assert.equal(c.zoom,40);c.zoomAt(.1);assert.equal(c.zoom,1);
});
test('hand tool and canceled gestures do not paint, and fit resets the view',()=>{
  const {instance:c,painted}=canvas();c.dragMode=true;c.down(event(1,250,250));c.up(event(1,250,250));c.dragMode=false;
  c.down(event(2,300,300));c.cancel(event(2,300,300));c.up(event(2,300,300));assert.deepEqual(painted,[]);
  c.zoomAt(10);c.fit();assert.equal(c.zoom,1);assert.deepEqual(c.pan,{x:0,y:0});
});

test('selected numbers stay small and only appear when there is room inside the region',async()=>{
  const {labelPositions}=await import('../../public/color-studio/canvas.js');
  const puzzle={width:100,height:100,regions:[{color:2,x:50,y:50,radius:1,labels:[]}]};
  assert.equal(labelPositions(puzzle,new Set(),{scale:1,selected:2}).length,0);
  const selected=labelPositions(puzzle,new Set(),{scale:10,selected:2})[0];
  const ordinary=labelPositions(puzzle,new Set(),{scale:10,selected:1})[0];
  assert.equal(selected.size,ordinary.size);assert.equal(selected.size*10,10);
  assert.equal(labelPositions(puzzle,new Set([0]),{scale:10,selected:2}).length,0);
});

test('tapping beside a selected number fills the actual region, never an enlarged number target',()=>{
  const {instance:c,painted}=canvas();
  c.load({width:100,height:100,regions:[{color:0,x:49,y:50,radius:2,paths:[[[0,0],[50,0],[50,100],[0,100]]]},{color:1,x:75,y:50,radius:20,paths:[[[50,0],[100,0],[100,100],[50,100]]]}],map:Array(10000).fill(0)},new Set());c.selected=0;
  const o=c.origin(),s=c.base*c.zoom,x=o.x+50.5*s,y=o.y+50*s;
  c.down(event(1,x,y));c.up(event(1,x,y));assert.deepEqual(painted,[1]);
});

test('hold magnifier waits before aiming, permits adjustment without panning, and fills only on lift',t=>{
  t.mock.timers.enable({apis:['setTimeout']});const {instance:c,painted}=canvas();c.zoomAt(3);const pan={...c.pan};
  c.down(event(1,300,300));t.mock.timers.tick(349);assert.equal(c.aim,null);t.mock.timers.tick(1);assert.ok(c.aim);assert.deepEqual(painted,[]);
  c.move(event(1,350,320));assert.deepEqual(c.aim,{x:350,y:320});assert.deepEqual(c.pan,pan);
  c.up(event(1,350,320));assert.deepEqual(painted,[0]);assert.equal(c.aim,null);
});

test('a second finger or canceled gesture dismisses the magnifier without filling',t=>{
  t.mock.timers.enable({apis:['setTimeout']});const {instance:c,painted}=canvas();
  c.down(event(1,300,300));t.mock.timers.tick(350);assert.ok(c.aim);
  c.down(event(2,400,300));assert.equal(c.aim,null);c.move(event(2,450,300));c.up(event(2,450,300));c.up(event(1,300,300));assert.deepEqual(painted,[]);
  c.down(event(3,300,300));t.mock.timers.tick(350);c.cancel(event(3,300,300));c.up(event(3,300,300));assert.deepEqual(painted,[]);
});

test('nearby small numbers do not overlap and reveal their detail at zoom',async()=>{
  const {labelPositions}=await import('../../public/color-studio/canvas.js');
  const puzzle={width:100,height:100,regions:[{color:2,x:40,y:50,radius:3},{color:2,x:45,y:50,radius:1}]};
  assert.equal(labelPositions(puzzle,new Set(),{selected:2,scale:1}).length,0);
  assert.equal(labelPositions(puzzle,new Set(),{selected:2,scale:10}).length,2);
});

test('checker shading uses only unfilled selected shapes and keeps its screen size at zoom',async()=>{
  const {drawPuzzle}=await import('../../public/color-studio/canvas.js');
  globalThis.OffscreenCanvas=class{getContext(){return{fillRect(){}};}};
  const pattern={setTransform(matrix){this.matrix=matrix;}},fills=[],text=[];
  const ctx={createPattern:()=>pattern,fillRect(){},stroke(){},fill(path,rule){fills.push({path,rule,style:this.fillStyle});},fillText(value){text.push({value,font:this.font});}};
  const regions=[0,1,2].map((id)=>({color:id===1?1:0,x:20+30*id,y:50,radius:10,paths:[[[0,0],[100,0],[100,100],[0,100]]]}));
  const p={width:100,height:100,regions,palette:[[20,30,40],[200,220,210]],boundaries:[]};
  const paths=['selected','other-color','already-filled'];
  drawPuzzle(ctx,p,new Set([2]),{selected:0,scale:4,paths});
  assert.equal(fills[0].style,pattern);assert.equal(fills[0].rule,'evenodd');
  assert.equal(fills[1].style,'#fffefa');assert.equal(fills[2].style,'rgb(20,30,40)');
  assert.equal(pattern.matrix.a,.25);assert.ok(text.every(t=>t.font.startsWith('400 ')));
  fills.length=0;drawPuzzle(ctx,p,new Set([2]),{selected:1,scale:8,paths});
  assert.equal(fills[0].style,'#fffefa');assert.equal(fills[1].style,pattern);assert.equal(pattern.matrix.a,.125);
  fills.length=0;drawPuzzle(ctx,p,new Set(),{selected:0,reference:true,scale:1,paths});assert.ok(fills.every(f=>f.style!==pattern));
});

test('quick taps on neighboring regions both paint without an accidental double-tap zoom',()=>{
  const {instance:c,painted}=canvas();
  c.load({width:100,height:100,regions:[{color:0,paths:[[[0,0],[50,0],[50,100],[0,100]]]},{color:0,paths:[[[50,0],[100,0],[100,100],[50,100]]]}]},new Set());
  for(const x of [294,306]){c.down(event(1,x,300));c.up(event(1,x,300));c.cancel(event(1,x,300));}
  assert.deepEqual(painted,[0,1]);assert.equal(c.zoom,1);
});

test('double-tap still zooms on the same region, including normal capture release',()=>{
  const {instance:c,painted}=canvas();
  for(let i=0;i<2;i++){c.down(event(1,300,300));c.up(event(1,300,300));c.cancel(event(1,300,300));}
  assert.equal(c.zoom,2.5);assert.deepEqual(painted,[0]);
});

test('a canceled gesture clears the previous tap instead of triggering a later zoom',()=>{
  const {instance:c,painted}=canvas();
  c.down(event(1,300,300));c.up(event(1,300,300));
  c.down(event(2,300,300));c.cancel(event(2,300,300));
  c.down(event(3,300,300));c.up(event(3,300,300));assert.equal(c.zoom,1);assert.equal(painted.length,2);
});

test('reopening and rotating preserve the zoom and painting point at the center',()=>{
  const {instance:c}=canvas();c.zoomAt(6,{x:370,y:350});const view=c.viewState(),puzzle=c.puzzle;
  c.canvas.getBoundingClientRect=()=>({left:0,top:0,width:1180,height:820});c.resize();
  for(const key of ['zoom','x','y'])assert.ok(Math.abs(c.viewState()[key]-view[key])<1e-10);
  c.load(puzzle,new Set(),view);
  for(const key of ['zoom','x','y'])assert.ok(Math.abs(c.viewState()[key]-view[key])<1e-10);
  c.fit();assert.deepEqual(c.viewState(),{zoom:1,x:.5,y:.5});
});

test('invalid saved views fit safely and loading a second painting resets gesture memory',()=>{
  const {instance:c,painted}=canvas();c.down(event(1,300,300));c.up(event(1,300,300));
  c.load(c.puzzle,new Set(),{zoom:Infinity,x:NaN,y:1});assert.deepEqual(c.viewState(),{zoom:1,x:.5,y:.5});
  c.down(event(1,300,300));c.up(event(1,300,300));assert.equal(c.zoom,1);assert.equal(painted.length,2);
});

test('a visible hint leaves zoom and pan untouched; tiny offscreen hints cap at eight times',()=>{
  const {instance:c,painted}=canvas();c.zoomAt(2.25,{x:320,y:310});const before=c.viewState();
  c.focusRegion(0,{anchor:{x:50,y:50,radius:10},keepView:true});assert.deepEqual(c.viewState(),before);assert.equal(c.focused,0);assert.deepEqual(painted,[]);
  c.canvas.getBoundingClientRect=()=>({left:0,top:0,width:100,height:100});c.resize();
  c.focusRegion(0,{anchor:{x:60,y:60,radius:.1},keepView:false});assert.equal(c.zoom,8);assert.deepEqual(painted,[]);
  c.zoomAt(40);assert.equal(c.zoom,40,'manual zoom remains available');
});

test('fill reveal is clipped to the actual region, ends promptly, and never redraws the main canvas',t=>{
  const {instance:c}=canvas(),clips=[],frames=[];let mainDraws=0;
  t.mock.method(globalThis,'requestAnimationFrame',callback=>{frames.push(callback);return frames.length;});
  globalThis.cancelAnimationFrame=()=>{};
  c.feedbackCanvas={width:1200,height:1200};c.feedbackCtx={setTransform(){},clearRect(){},save(){},restore(){},clip(path,rule){clips.push({path,rule});},createRadialGradient(){return{addColorStop(){}};},fillRect(){},stroke(){}};
  c.draw=()=>mainDraws++;c.filled.add(0);c.revealFill(0,{x:50,y:50});const start=c.feedback[0].start;
  assert.equal(frames.length,1);c.drawFeedback(start+100);assert.equal(clips[0].path,c.paths[0]);assert.equal(clips[0].rule,'evenodd');
  c.drawFeedback(start+300);assert.equal(c.feedback.length,0);assert.equal(c.feedbackFrame,0);assert.equal(mainDraws,0);assert.deepEqual([...c.filled],[0]);
  c.revealFill(0);c.zoomAt(3);assert.equal(c.feedback.length,0,'moving view clears any temporary mask');
  c.reducedMotion={matches:true};c.revealFill(0);assert.equal(c.feedback.length,0,'reduced motion shows the fill immediately');
  c.reducedMotion={matches:false};c.revealFill(0);c.filled.delete(0);c.drawFeedback(performance.now());assert.equal(c.feedback.length,0,'undo cannot leave a stale reveal');
});

test('hints near an edge keep the canvas on screen and do not zoom out of an established view',()=>{
  const {instance:c}=canvas();c.zoomAt(3);c.focusRegion(0,{anchor:{x:1,y:1,radius:10}});
  assert.equal(c.zoom,3);const origin=c.origin();assert.ok(origin.x<=0);assert.ok(origin.y<=0);
  assert.ok(origin.x+c.puzzle.width*c.base*c.zoom>=c.w);assert.ok(origin.y+c.puzzle.height*c.base*c.zoom>=c.h);
});
