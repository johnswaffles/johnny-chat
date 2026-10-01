import test from 'node:test';import assert from 'node:assert/strict';
import {Controller,readBindings,rebind} from '../src/controls.js';
import {SelectionRing,newInventory,stickRingIndex} from '../src/inventory.js';
const pad=(button,axes)=>({index:0,id:'Xbox fixture',mapping:'standard',connected:true,buttons:Array.from({length:17},(_,i)=>({pressed:i===button,value:i===button?1:0})),axes:[0,0,...axes]});
test('right stick selects four clockwise wheel slots, equips on release without using charges',()=>{
 const c=new Controller(),b=readBindings(null),ring=new SelectionRing(),inv=newInventory();
 for(const [axes,index] of [[[0,-1],0],[[1,0],1],[[0,1],2],[[-1,0],3]]){c.poll([pad(4,axes)],b);const state=ring.step(c.consume(b),inv);assert.equal(ring.index,index);assert.equal(ring.open,true);assert.equal(state.use,false);assert.equal(inv.equipped,'ember');}
 c.poll([pad(-1,[-1,0])],b);const state=ring.step(c.consume(b),inv);assert.equal(inv.equipped,'flask');assert.equal(ring.open,false);assert.equal(state.use,false);assert.deepEqual(inv.charges,{ember:0,frost:0,chain:0,flask:0});assert.equal(c.aim.x,-1);
});
test('deadzone and angular hysteresis hold selection through center and diagonal jitter',()=>{
 assert.equal(stickRingIndex(.1,.1,2),2);assert.equal(stickRingIndex(NaN,1,2),2);
 for(const x of [.69,.71,.73])assert.equal(stickRingIndex(x,-.7,0),0);
 assert.equal(stickRingIndex(1,-.5,0),1);assert.equal(stickRingIndex(.5,-1,1),0);
});
test('remapped hold button works and right stick never changes a closed or canceled ring',()=>{
 const c=new Controller(),b=readBindings(null),ring=new SelectionRing(),inv=newInventory();rebind(b,'pad','ring',7);
 c.poll([pad(4,[1,0])],b);ring.step(c.consume(b),inv);assert.equal(ring.open,false);assert.equal(inv.equipped,'ember');
 c.poll([pad(7,[1,0])],b);ring.step(c.consume(b),inv);assert.equal(ring.index,1);ring.cancel();ring.step(c.consume(b),inv);assert.equal(ring.open,false);
 c.poll([pad(-1,[0,0])],b);ring.step(c.consume(b),inv);c.poll([pad(7,[0,1])],b);ring.step(c.consume(b),inv);assert.equal(ring.index,2);
});
