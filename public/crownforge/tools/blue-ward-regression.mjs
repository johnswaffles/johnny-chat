import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drawBlueWard} from '../src/hearthkin-blue-ward.js';
let loads=0;globalThis.Image=class {constructor(){loads++;this.complete=true;this.naturalWidth=480;}};
function context(){return {globalAlpha:1,draws:[],save(){this.saved=this.globalAlpha;},restore(){this.globalAlpha=this.saved;},drawImage(...args){this.draws.push([this.globalAlpha,...args.slice(1)]);}};}
test('only an active ward draws and caller opacity is restored',()=>{const c=context();drawBlueWard(c,{}, {x:0,y:0},60,0);assert.equal(c.draws.length,0);drawBlueWard(c,{lastLightWardTimer:1},{x:0,y:0},60,0);assert.equal(c.draws.length,1);assert.equal(c.globalAlpha,1);});
test('back and front use the same cached texture and impact expands the ward',()=>{const c=context(),u={id:1,lastLightWardTimer:2};drawBlueWard(c,u,{x:0,y:0},60,0,true,true);drawBlueWard(c,{...u,wardBlockedPulse:.42},{x:0,y:0},60,0,false,true);assert(c.draws[1][3]>c.draws[0][3]);assert.equal(loads,1);});
test('reduced motion stays stable over time and drawing never changes gameplay state',()=>{const c=context(),u={id:1,lastLightWardTimer:3,wardBlockedPulse:.2};const before=JSON.stringify(u);drawBlueWard(c,u,{x:0,y:0},60,0,false,true);drawBlueWard(c,u,{x:0,y:0},60,9000,false,true);assert.deepEqual(c.draws[0],c.draws[1]);assert.equal(JSON.stringify(u),before);});
