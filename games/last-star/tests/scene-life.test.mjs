import test from 'node:test';import assert from 'node:assert/strict';
import {renderResolution,sceneMotion} from '../src/scene-life.js';import {EXTRA_FALLS,flowPhase} from '../src/waterfalls.js';
test('retina foreground retains detail independently of atmosphere quality',()=>{assert.equal(renderResolution(1280,720,2),2);assert.equal(renderResolution(1920,1080,2),2);assert.ok(renderResolution(3840,2160,2)<=1.01);});
test('wind and water advance continuously and freeze with the scene clock',()=>{assert.notEqual(flowPhase(.01,2),flowPhase(.02,2));assert.equal(sceneMotion(8,4),sceneMotion(8,4));assert.notEqual(sceneMotion(8,4),sceneMotion(8.01,4));assert.ok(Math.abs(sceneMotion(8,4,true))<=.55);for(const [x,t,b,w] of EXTRA_FALLS)assert.ok(x>0&&x<1&&t<b&&b<1&&w<.02);});
