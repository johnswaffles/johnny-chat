import assert from 'node:assert/strict';
import test from 'node:test';
import { getTextsmithSmsStats, textsmithMessagesFit, parseTextsmithMessages, textsmithPrompt } from '../lib/textsmith.mjs';
test('one message is strictly under 160; two messages each allow 160',()=>{
 assert.equal(textsmithMessagesFit(['a'.repeat(159)],'single'),true);
 assert.equal(textsmithMessagesFit(['a'.repeat(160)],'single'),false);
 assert.equal(textsmithMessagesFit(['a'.repeat(160),'b'.repeat(160)],'split'),true);
 assert.equal(textsmithMessagesFit(['a'.repeat(161),'b'],'split'),false);
 assert.equal(textsmithMessagesFit(['Only one.'],'split'),false);
});
test('names and extended characters do not reduce the writing budget',()=>{
 const text='Chào Nguyễn, '+ 'a'.repeat(140);assert.equal(getTextsmithSmsStats(text).fits,true);
 assert.equal(getTextsmithSmsStats('€'.repeat(159)).fits,true);
 assert.equal(parseTextsmithMessages(JSON.stringify({messages:['Hi Nguyễn — your visit is confirmed. 😊']}))[0], 'Hi Nguyễn - your visit is confirmed.');
});
test('malformed and duplicate responses cannot masquerade as two messages',()=>{
 assert.deepEqual(parseTextsmithMessages('first\nsecond'),[]);
 assert.deepEqual(parseTextsmithMessages('{"messages":[2]}'),[]);
 assert.equal(textsmithMessagesFit(['Hello.','Hello.'],'split'),false);
 assert.equal(textsmithMessagesFit(['Hello.',''],'split'),false);
});
test('two-message repair retains the original two-message contract',()=>{
 const prompt=textsmithPrompt('split','oversized candidate');
 assert.match(prompt,/TWO-message, 160-characters-EACH/);assert.doesNotMatch(prompt,/one final SMS|under 150/);
});

test('fullness target is explicit in both modes without requiring filler',()=>{
 assert.match(textsmithPrompt('single'),/145-159/);
 assert.match(textsmithPrompt('split'),/145-160 characters in EACH/);
 assert.match(textsmithPrompt('single'),/Never add filler/);
});
