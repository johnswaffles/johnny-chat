import {test} from 'node:test';
import assert from 'node:assert/strict';
import {comparePassages} from '../public/story-editor/review-model.mjs';
test('comparison preserves punctuation, Unicode and whitespace exactly',()=>{
 const before='“Mara,” she said.\n\nThe café was quiet.',after='“Mara,” she whispered.\n\nThe café was almost quiet.';
 const result=comparePassages(before,after);
 assert.equal(result.left.map(x=>x.text).join(''),before);assert.equal(result.right.map(x=>x.text).join(''),after);
 assert.deepEqual(result.left.filter(x=>x.changed&&/\w/.test(x.text)).map(x=>x.text),['said']);
 assert.deepEqual(result.right.filter(x=>x.changed&&/\w/.test(x.text)).map(x=>x.text),['whispered','almost']);
 assert.equal(result.added,2);assert.equal(result.removed,1);
});
test('empty and identical versions have honest change status',()=>{
 assert.equal(comparePassages('Same text','Same text').changed,false);
 assert.equal(comparePassages('','New words').added,2);
 assert.equal(comparePassages('Old words','').removed,2);
});
test('large rewrites remain complete with an explicitly coarse comparison',()=>{
 const before='old '.repeat(4000),after='new '.repeat(4000),result=comparePassages(before,after);
 assert.equal(result.coarse,true);assert.equal(result.left.map(x=>x.text).join(''),before);assert.equal(result.right.map(x=>x.text).join(''),after);
 assert.equal(result.added,4000);assert.equal(result.removed,4000);
});
