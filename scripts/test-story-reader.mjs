import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookChapters, speechParts } from '../public/story-editor/reader-model.mjs';
test('reader groups chapters and uses edited prose plus exact preserved text',()=>{
 const chapters=bookChapters([{kind:'chapter',chapterIndex:1,originalText:'Prologue'},{kind:'paragraph',chapterIndex:1,originalText:'source',editedText:'finished'},{kind:'paragraph',chapterIndex:1,originalText:'preserved'},{kind:'chapter',chapterIndex:2,originalText:'Chapter Two'},{kind:'paragraph',chapterIndex:2,originalText:'other chapter'}]);
 assert.equal(chapters.length,2);assert.equal(chapters[0].text,'Prologue\n\nfinished\n\npreserved');assert.ok(!chapters[0].text.includes('other chapter'));
});
test('long chapter narration loses no words and never exceeds provider length',()=>{
 for(const text of ['A sentence. '.repeat(1000),'word '.repeat(4000),'🦉'.repeat(5000),'x'.repeat(9000)]) {
  const parts=speechParts(text);assert.equal(parts.join(''),text);assert.ok(parts.every(p=>p.length<=3800));assert.ok(parts.length>1);assert.ok(parts.every(p=>!/[\uD800-\uDBFF]$/.test(p)));
 }
});
