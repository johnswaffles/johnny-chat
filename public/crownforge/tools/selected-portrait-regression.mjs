import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectedPortraitUnit,portraitOrder,focusedCombatUnits} from '../src/combat-frames.js';
const wizard={id:1,type:'wizard',faction:'player',hp:100},tank={id:2,type:'shieldbearer',faction:'player',hp:100},bear={id:3,type:'grizzly',faction:'wildlife',hp:100,command:'attack',attackTarget:2};
test('selected wizard appears first without replacing combat participants',()=>{const s={units:[wizard,tank,bear],selectedIds:[1],clock:1};const combat=focusedCombatUnits(s,[tank,bear]);assert.deepEqual(portraitOrder(selectedPortraitUnit(s),combat),[wizard,tank,bear]);});
test('clearing selection restores combat frames and empty idle state',()=>{const s={units:[wizard,tank,bear],selectedIds:[]};assert.equal(selectedPortraitUnit(s),null);assert.deepEqual(portraitOrder(null,[tank,bear]),[tank,bear]);assert.deepEqual(portraitOrder(null,[]),[]);});
test('selected combat unit is not duplicated',()=>assert.deepEqual(portraitOrder(tank,[tank,bear]),[tank,bear]));
test('group order is stable; buildings, removed and dead units cannot pin a portrait',()=>{const s={units:[wizard,tank,{...bear,dead:true}],selectedIds:[999,3,2,1]};assert.equal(selectedPortraitUnit(s),tank);s.selectedIds=[999,3];assert.equal(selectedPortraitUnit(s),null);});
