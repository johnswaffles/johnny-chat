import test from 'node:test';import assert from 'node:assert/strict';import {constellationPhase} from '../src/spell-fx.js';
test('constellation visual arrives at the shared 0.6-second damage instant',()=>{
 assert.deepEqual(constellationPhase(0),{gather:0,fall:0,impact:0});
 assert.equal(constellationPhase(.18).fall,0);
 assert.equal(constellationPhase(.6).fall,1);assert.equal(constellationPhase(.6).impact,0);
 assert.ok(constellationPhase(.8).impact>0);assert.equal(constellationPhase(1.7).impact,1);
});
