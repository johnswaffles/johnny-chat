import test from 'node:test';
import assert from 'node:assert/strict';
import {Controller,readBindings,rebind,axis,DEFAULT_PAD,DEFAULT_KEYS,normalizeKey} from '../src/controls.js';
import {Game} from '../src/game.js';
import {waterfallTransform,FALLS,ACTIVE_WATERFALL_IDS,drawWaterfalls,waterFrame} from '../src/waterfalls.js';
const pad=(buttons=[],axes=[0,0,0,0],index=0)=>({index,id:'Xbox test fixture',connected:true,mapping:'standard',axes,buttons:Array.from({length:17},(_,i)=>({pressed:buttons.includes(i),value:buttons.includes(i)?1:0}))});
test('default Xbox triggers, face buttons and menu reservation',()=>{const c=readBindings(null);assert.equal(c.pad.bolt,7);assert.equal(c.pad.jump,0);assert.equal(rebind(c,'pad','jump',9),false);assert.equal(rebind(c,'pad','jump',16),false);});
test('reassigning an occupied button swaps actions and round-trips through storage',()=>{const c=readBindings(null);assert.equal(rebind(c,'pad','jump',1),'blink');assert.equal(c.pad.jump,1);assert.equal(c.pad.blink,0);assert.deepEqual(readBindings(JSON.stringify(c)),c);assert.equal(rebind(c,'keys','bolt','KeyQ'),'constellation');assert.equal(c.keys.constellation,'KeyJ');});
test('corrupt or duplicate binding maps recover to safe defaults',()=>{assert.deepEqual(readBindings('{').pad,DEFAULT_PAD);assert.deepEqual(readBindings({keys:{...DEFAULT_KEYS,bolt:'Escape'}}).keys,DEFAULT_KEYS);assert.deepEqual(readBindings({pad:{...DEFAULT_PAD,jump:1}}).pad,DEFAULT_PAD);assert.equal(readBindings({deadzone:3}).deadzone,.4);assert.equal(normalizeKey('ShiftRight'),'ShiftLeft');});
test('dead zone rejects drift while retaining analog speed and clamps extremes',()=>{assert.equal(axis(.12,.18),0);assert.ok(Math.abs(axis(.59,.18)-.5)<.00001);assert.equal(axis(-1,.18),-1);assert.equal(axis(NaN,.18),0);});
test('held jump and blink fire once; held trigger keeps casting',()=>{
 const c=new Controller(),b=readBindings(null);c.poll([pad()],b);c.poll([pad([0,1,7])],b);let r=c.consume(b);assert.equal(r.jump,true);assert.equal(r.blink,true);assert.equal(r.bolt,true);
 c.poll([pad([0,1,7])],b);r=c.consume(b);assert.equal(r.jump,false);assert.equal(r.blink,false);assert.equal(r.bolt,true);
 c.poll([pad()],b);c.poll([pad([0])],b);assert.equal(c.consume(b).jump,true);
});
test('edges survive a render frame with no simulation tick and consume only once',()=>{const c=new Controller(),b=readBindings(null);c.poll([pad()],b);c.poll([pad([0])],b);c.poll([pad()],b);assert.equal(c.consume(b).jump,true);assert.equal(c.consume(b).jump,false);});
test('hotplug ignores already-held buttons, sparse indexes work and disconnect releases everything',()=>{const c=new Controller(),b=readBindings(null);assert.equal(c.poll([null,pad([0],[0,0,0,0],3)],b).connected,true);assert.equal(c.consume(b).jump,false);c.poll([null,pad([7],[1,0,-.8,.4],3)],b);assert.equal(c.move,1);assert.ok(c.aim.x<0);assert.equal(c.poll([null],b).disconnected,true);assert.equal(c.consume(b).bolt,false);assert.equal(c.move,0);});
test('replacement device does not inherit prior pending actions',()=>{const c=new Controller(),b=readBindings(null);c.poll([pad()],b);c.poll([pad([0])],b);c.poll([pad([0],[0,0,0,0],2)],b);assert.equal(c.consume(b).jump,false);});
test('remapped controller inputs drive real jumping, movement, starshards and blink',()=>{
 const b=readBindings(null),c=new Controller(),g=new Game();rebind(b,'pad','jump',4);c.poll([pad()],b);c.poll([pad([4,7],[1,0,0,0])],b);g.update(1/60,c.consume(b));assert.ok(g.player.vy<0);assert.ok(g.player.x>230);assert.equal(g.projectiles.length,1);
 c.poll([pad()],b);c.poll([pad([1])],b);const x=g.player.x;g.update(1/60,c.consume(b));assert.ok(g.player.x>x+90);assert.equal(g.player.rangeStacks,1);
});
test('waterfall coordinates stay registered to the panorama at both camera extremes',()=>{const im={width:2172,height:724},left=waterfallTransform(im,1280,0,7900),right=waterfallTransform(im,1280,6620,7900);assert.equal(Math.abs(left.x),0);assert.equal(right.x+right.width,1280);assert.equal(FALLS.length,13);for(const [x,top,bottom,w] of FALLS){assert.ok(x>0&&x<1&&top<bottom&&bottom<1&&w>0);}});


test('water sprites animate at 12 fps, wrap seamlessly and freeze when paused',()=>{
 assert.equal(waterFrame(0),0);assert.equal(waterFrame(.04),0);assert.equal(waterFrame(.5),6);assert.equal(waterFrame(16/12),0);
 const sprites=[{frames:Array.from({length:16},(_,i)=>i),width:30,height:200,left:0,x:100,y:200},{frames:Array.from({length:16},(_,i)=>i),width:30,height:200,left:0,x:1500,y:200}];
 const sample=t=>{const calls=[];drawWaterfalls({drawImage:(...args)=>calls.push(args)},{x:0,y:0},t,sprites,1280);return calls;};
 assert.equal(sample(0).length,1);assert.notDeepEqual(sample(0),sample(.5));assert.deepEqual(sample(.5),sample(.5));
 assert.deepEqual(sample(0),sample(16/12));
});

test('Silverwood arch has no water overlay and remaining sprite IDs stay stable',()=>{
 assert.equal(ACTIVE_WATERFALL_IDS.includes(2),false);
 assert.deepEqual(ACTIVE_WATERFALL_IDS,[0,1,3,4,5,6,7,8,9,10,11,12]);
});
