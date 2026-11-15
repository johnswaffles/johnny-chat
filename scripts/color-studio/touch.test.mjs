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
