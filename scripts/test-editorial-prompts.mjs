import {test} from 'node:test';
import assert from 'node:assert/strict';
import {editorialPrompt,MAX_PROMPT_BYTES} from '../public/story-editor/prompt-model.mjs';
test('prompts retain whitespace and Unicode at the advertised UTF-8 boundary',()=>{
 const full='  Keep these paragraphs.\r\n\tPreserve meaning.  ';assert.equal(editorialPrompt(full),full);
 assert.equal(editorialPrompt('x'.repeat(MAX_PROMPT_BYTES)).length,MAX_PROMPT_BYTES);
 const unicode='é'.repeat(MAX_PROMPT_BYTES/2);assert.equal(editorialPrompt(unicode),unicode);
});
test('over-limit or empty input is rejected explicitly, never truncated',()=>{
 for(const value of ['x'.repeat(MAX_PROMPT_BYTES+1),'é'.repeat(MAX_PROMPT_BYTES/2+1)])assert.throws(()=>editorialPrompt(value),e=>e.status===413&&/Nothing was shortened/.test(e.message));
 for(const value of ['', ' \n\t ',{},123])assert.throws(()=>editorialPrompt(value),e=>e.status===400);
});
