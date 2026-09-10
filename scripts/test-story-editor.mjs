import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyStoryProtection, storySectionProtection, isStorySafetyRefusal, normalizeAutopilotParagraphs, assertStoryModelResponse, withStoryOutputBudget } from '../lib/story-editor.mjs';

test('adult themes and ambiguous words are not automatic exclusions', () => {
  for (const text of ['She smelled cannabis.', 'His joint ached.', 'A blunt reply.', 'A lecture on psilocybin research.']) assert.equal(classifyStoryProtection(text).preserveVerbatim, false);
});
test('legacy keyword holds retire, explicit holds survive', () => {
  assert.equal(storySectionProtection({preserve_verbatim:1, preserve_reason:'Potentially sensitive material detected: cannabis or marijuana reference. This passage is preserved verbatim and excluded from model rewriting.'}).preserveVerbatim, false);
  assert.equal(storySectionProtection({preserve_verbatim:1, preserve_reason:'Author requested exact wording.'}).preserveVerbatim, true);
});
test('technical failures are not confused with content decisions', () => {
  for (const message of ['Network policy blocked connection', 'Biology service unavailable', 'Rate limit', 'Invalid reasoning mode']) assert.equal(isStorySafetyRefusal(new Error(message)), false);
  assert.equal(isStorySafetyRefusal({code:'content_filter'}),true);
  assert.equal(isStorySafetyRefusal({storySafetyRefusal:true}),true);
});
test('a retained passage is byte-identical and surrounding edits stay ordered', () => {
  const chunk={paragraphs:[{id:'a',text:'Before',label:'A'},{id:'b',text:'Exact  text.\nKeep spacing.',label:'B'},{id:'c',text:'After',label:'C'}]};
  const result=normalizeAutopilotParagraphs({revisedParagraphs:[{id:'c',text:'After revised',disposition:'revised'},{id:'b',text:'unwanted replacement',disposition:'preserved',note:'Needs review'},{id:'a',text:'Before revised',disposition:'revised'}]},chunk);
  assert.deepEqual(result.paragraphs.map(p=>p.revisedText),['Before revised',chunk.paragraphs[1].text,'After revised']);
  assert.equal(result.paragraphs[1].needsReview,true);
});
test('missing, blank, and duplicate replacements preserve the source', () => {
  for (const entries of [[],[{id:'a',text:''}],[{id:'a',text:'one'},{id:'a',text:'two'}]]) {
    const result=normalizeAutopilotParagraphs({revisedParagraphs:entries},{paragraphs:[{id:'a',text:'Original',label:'A'}]});
    assert.equal(result.paragraphs[0].revisedText,'Original'); assert.equal(result.paragraphs[0].needsReview,true);
  }
});

test('incomplete output cannot become an accepted revision', () => {
  assert.throws(() => assertStoryModelResponse({status:'incomplete',incomplete_details:{reason:'max_output_tokens'}}), /did not finish/);
  assert.throws(() => assertStoryModelResponse({output:[{content:[{type:'refusal',refusal:'Declined'}]}]}), /declined/);
});

test('output exhaustion retries with larger allowances and never accepts partial text', async () => {
  const budgets=[];
  const result=await withStoryOutputBudget(async budget=>{
    budgets.push(budget);
    if(budgets.length===1) assertStoryModelResponse({status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output:[{content:[{type:'output_text',text:'partial text'}]}]});
    return 'complete';
  },2600);
  assert.equal(result,'complete');assert.deepEqual(budgets,[25000,50000]);
});
test('output retries are bounded and do not retry network or safety errors', async () => {
  const budgets=[];
  await assert.rejects(withStoryOutputBudget(async b=>{budgets.push(b);throw Object.assign(new Error('budget'),{code:'max_output_tokens'});}),/Completed sections are saved/);
  assert.deepEqual(budgets,[25000,50000,64000]);
  let calls=0;await assert.rejects(withStoryOutputBudget(async()=>{calls++;throw new Error('network');}),/network/);assert.equal(calls,1);
});
