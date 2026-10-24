import {test} from 'node:test';import assert from 'node:assert/strict';
import {editorialQualityLabel} from '../public/story-editor/quality-label.mjs';
test('labels show the actual backend Sol effort/mode without hardcoded Astra Max',()=>{
 assert.equal(editorialQualityLabel({model:'gpt-6.1-sol',effort:'xhigh',mode:'pro'}),'GPT-6.1 Sol · Extra High reasoning · Pro');
 assert.equal(editorialQualityLabel({model:'gpt-6.1-sol',effort:'high',mode:'standard'}),'GPT-6.1 Sol · High reasoning · Standard');
 assert.equal(editorialQualityLabel({model:'gpt-6-astra',effort:'max',mode:'pro'}),'GPT-6 Astra · Max reasoning · Pro');
 assert.equal(editorialQualityLabel(null),'Editor configuration unavailable');
 assert.match(editorialQualityLabel({model:'future-model'}),/unconfirmed/);
});
