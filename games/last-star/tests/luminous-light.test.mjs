import test from 'node:test';
import assert from 'node:assert/strict';
import {lightEvent,spellLights,wizardLight,drawReactiveLight} from '../src/reactive-light.js';
test('healing and passage lights use actual event positions and their own colors',()=>{
 const r={time:12};lightEvent(r,{type:'heal',x:110,y:505});lightEvent(r,{type:'blink',from:{x:10,y:560},to:{x:245,y:558}});
 const lights=spellLights({projectiles:[]},r);assert.deepEqual(lights.map(l=>[l.x,l.y,l.color]),[[110,505,'teal'],[245,503,'violet']]);
 assert.equal(wizardLight({...r,worldLights:lights},{x:245,y:568}).color,'violet');
 r.time=13;assert.deepEqual(spellLights({projectiles:[]},r),[]);
});
test('mixed projectiles and impacts cannot create unbounded world lights',()=>{
 const r={time:0};for(let i=0;i<100;i++)lightEvent(r,{type:'ember-impact',x:i,y:100});
 assert.equal(r.lightPulses.length,12);
 const projectiles=Array.from({length:50},(_,x)=>({x,y:100,life:1,owner:'player'}));assert.equal(spellLights({projectiles},r).length,8);
 lightEvent(r,{type:'heal',x:NaN,y:0});assert.equal(r.lightPulses.length,12);
});
test('the local player halo fades with the spell light and respects reduced flashes',()=>{
 const halos=[],r={ctx:{save(){},restore(){}},camera:0,w:800,time:0,lightPulses:[],worldLights:[{x:100,y:100,radius:145,color:'teal',strength:1}],glow(x,y,size,color,alpha){if(size===100)halos.push(alpha);}};
 const g={player:{x:100,y:165},platforms:[],projectiles:[]};drawReactiveLight(r,g);
 r.worldLights[0].strength=.1;drawReactiveLight(r,g);assert.ok(halos[1]<halos[0]*.2);
 r.reducedFlash=true;drawReactiveLight(r,g);assert.ok(halos[2]<halos[1]);
});
