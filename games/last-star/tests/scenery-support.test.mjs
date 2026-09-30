import test from 'node:test';
import assert from 'node:assert/strict';
import {drawSilverwoodLayers} from '../src/silverwood-layers.js';

test('legacy separated scenery never draws detached tree or doorway crops across the route',()=>{
 const drawn=[];
 const gradient={addColorStop(){}};
 const ctx=new Proxy({}, {get:(_,key)=>key==='drawImage'?image=>drawn.push(image):key==='createLinearGradient'?()=>gradient:()=>{}});
 const r={ctx,art:{silverwoodLayers:true,sceneryPieces:{tree:'unsupported-tree',arch:'unsupported-arch',fall:'backed-spillway'}},time:0,w:1500,glow(){}};
 for(const camera of [0,500,1000,1250,1800,2200,2400]){r.camera=camera;drawSilverwoodLayers(r,{});}
 assert.ok(drawn.includes('backed-spillway'));
 assert.ok(drawn.every(image=>image==='backed-spillway'));
});
