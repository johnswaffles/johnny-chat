import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encounterUnits,isDebuff,effectIcon} from '../src/combat-frames.js';
const unit=(id,type,faction,extra={})=>({id,type,faction,hp:100,maxHp:100,command:'idle',...extra});
test('tracks multiple enemy types and team tanks, excludes unrelated settlement tanks',()=>{
 const units=[unit(1,'shieldbearer','player',{teamId:1}),unit(2,'spearwarden','player',{teamId:1,command:'attack',attackTarget:4}),unit(3,'shieldbearer','player'),unit(4,'grizzly','wildlife',{command:'attack',attackTarget:1}),unit(5,'soldier','enemy',{command:'attack',attackTarget:2})];
 assert.deepEqual(encounterUnits({units}).map(u=>u.id),[1,4,5]);
 units[4].dead=true;assert.deepEqual(encounterUnits({units}).map(u=>u.id),[1,4]);
 units[1].command='idle';units[3].command='idle';assert.deepEqual(encounterUnits({units}),[]);
});
test('enemy attacking a solo tank and team advance both count',()=>{
 const units=[unit(1,'shieldbearer','player'),unit(2,'grizzly','wildlife',{command:'attack',attackTarget:1})];
 assert.deepEqual(encounterUnits({units}).map(u=>u.id),[1,2]);units[0].hp=0;assert.deepEqual(encounterUnits({units}),[]);
 units[0].hp=100;units[1].command='idle';units[0].teamAdvanceTargetId=2;assert.deepEqual(encounterUnits({units}).map(u=>u.id),[1,2]);
});
test('debuffs are distinct from beneficial effects; future effects have fallback icons',()=>{
 assert.ok(isDebuff({id:'lastLight'}));assert.ok(isDebuff({id:'stun'}));assert.ok(!isDebuff({id:'ward',rune:'ward'}));assert.ok(effectIcon({id:'future'}).includes('<svg'));assert.notEqual(effectIcon({id:'crownsAegis'}),effectIcon({id:'kingsbaneHunger'}));
});
