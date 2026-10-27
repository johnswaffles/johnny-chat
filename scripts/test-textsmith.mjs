import assert from 'node:assert/strict';
import test from 'node:test';
import { getTextsmithSmsStats, textsmithMessagesFit, parseTextsmithMessages, textsmithPrompt, textsmithValidationIssues, textsmithPairNeedsDevelopment, getTextsmithContactBlocks } from '../lib/textsmith.mjs';
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

test('richness uses the pair budget without forcing both texts to fill up',()=>{
 assert.match(textsmithPrompt('single'),/145-159/);
 assert.match(textsmithPrompt('split'),/NO minimum length per message/);
 assert.match(textsmithPrompt('split'),/up to 320 characters/);
 assert.match(textsmithPrompt('split'),/Remove semantic duplicates/);
 assert.doesNotMatch(textsmithPrompt('split'),/145-160 characters in EACH/);
 assert.match(textsmithPrompt('single'),/Never add filler/);
});

test('split rejects punctuation-only rewrites and repeated statements inside otherwise different texts',()=>{
 assert.equal(textsmithMessagesFit(['Your estimate is ready!', 'YOUR ESTIMATE IS READY.'],'split'),false);
 const repeated=['Your estimate is ready for review. The total is $285.', 'Your estimate is ready for review. Would Friday afternoon work?'];
 assert.equal(textsmithMessagesFit(repeated,'split'),false);
 assert.match(textsmithValidationIssues(repeated,'split').join(' '),/statement is repeated/);
});
test('split rejects content containment even when sentence order and connective words differ',()=>{
 const pair=['Hi Mike, your estimate for the fence repair is ready.', 'The fence repair estimate is ready, Mike. The total is $285. Would Friday afternoon work?'];
 assert.equal(textsmithMessagesFit(pair,'split'),false);
});
test('short callbacks and genuinely different logistics remain valid',()=>{
 const cases=[
  ['Hi Sarah, the weather means moving your Thursday appointment from 2:00 to 3:00.', 'Would that time work for you? Thank you for being flexible.'],
  ['The repair estimate is $285, including parts and labor.', 'Would Friday afternoon work for the repair?'],
  ['The first payment for the repair is $285 on Monday.', 'The second payment for the repair is $150 on Friday.'],
  ['Please leave the side gate unlocked for our arrival.', 'Please keep the back gate locked while the dog is outside.'],
  ['Your appointment is at 3:00.', 'Does 3:00 still work for you?'],
  ['I am on my way.', 'See you soon.']
 ];
 for (const pair of cases) assert.equal(textsmithMessagesFit(pair,'split'),true,JSON.stringify(pair));
});
test('malformed values and whitespace-only messages fail safely',()=>{
 for(const value of [null, {}, [2,'hello'], [' ','Hello']]) assert.equal(textsmithMessagesFit(value,'split'),false);
});

test('two-message choice develops sparse notes without inventing facts or requiring padding',()=>{
 const prompt=textsmithPrompt('split');
 assert.match(prompt,/SPARSE-SOURCE EXPANSION/);
 assert.match(prompt,/110-160 characters each/);
 assert.match(prompt,/never a hard minimum/);
 assert.match(prompt,/Respect requests for no questions or no reply/);
 assert.match(prompt,/Never add a new promise, service, deadline, reason, price, or commitment/);
 assert.doesNotMatch(prompt,/use a short natural follow-through|do not stretch a short source/);
 assert.doesNotMatch(textsmithPrompt('single'),/SPARSE-SOURCE EXPANSION/);
});

test('development pass is reserved for valid underfilled pairs',()=>{
 assert.equal(textsmithPairNeedsDevelopment(['Hi Alex, I am running 10 minutes late.', 'I apologize for the delay.'],'split'),true);
 assert.equal(textsmithPairNeedsDevelopment(['a'.repeat(120),'b'.repeat(120)],'split'),false);
 assert.equal(textsmithPairNeedsDevelopment(['a'.repeat(161),'b'],'split'),false);
 assert.equal(textsmithPairNeedsDevelopment(['Hello'],'single'),false);
 const prompt=textsmithPrompt('split','candidate','warm',true);
 assert.match(prompt,/DEVELOPMENT PASS/);
 assert.doesNotMatch(prompt,/previous candidate failed validation/);
});

test('business contact blocks preserve the supplied label, punctuation, and number format',()=>{
 for(const [source,block] of [
  ['ABC company phone number 618-555-1234','ABC company phone number 618-555-1234'],
  ['Tell Tom ABC company phone number 618-555-1234 sent the estimate.','ABC company phone number 618-555-1234'],
  ['Use abc company 618-555-1234.','abc company 618-555-1234'],
  ["The quote is from Green Valley Plumbing, phone: (618) 555-1234.",'Green Valley Plumbing, phone: (618) 555-1234'],
  ["Use Joe's Heating & Air: +1 (618) 555-1234 ext. 8.","Joe's Heating & Air: +1 (618) 555-1234 ext. 8"]
 ]) assert.deepEqual(getTextsmithContactBlocks(source),[block]);
 assert.deepEqual(getTextsmithContactBlocks('The reference number is 1234567890.'),[]);
});
test('contact protection rejects split, relabeled, omitted, or reformatted business numbers',()=>{
 const source='The estimate is from ABC company phone number 618-555-1234. The total is $285.';
 assert.equal(textsmithMessagesFit(['The estimate is from ABC company phone number 618-555-1234. The total is $285.'],'single',source),true);
 for(const pair of [
  ['ABC company sent the estimate.', 'Their phone number is 618-555-1234. The total is $285.'],
  ['ABC company: 618-555-1234 sent the estimate.', 'The total is $285.'],
  ['ABC company phone number (618) 555-1234 sent the estimate.', 'The total is $285.'],
  ['The estimate is ready.', 'The total is $285.']
 ]) assert.equal(textsmithMessagesFit(pair,'split',source),false,JSON.stringify(pair));
});
test('supplying a business phone number does not authorize a call invitation',()=>{
 const block='ABC company phone number 618-555-1234';
 const source=`The quote is from ${block}. The total is $285.`;
 const invitation=[`The quote is from ${block}.`, 'Please call them if you have questions.'];
 assert.equal(textsmithMessagesFit(invitation,'split',source),false);
 assert.equal(textsmithMessagesFit([`${block}.`, 'You can reach them to discuss the quote.'],'split',source),false);
 assert.equal(textsmithMessagesFit(invitation,'split',`Ask the customer to call ${block} with questions.`),true);
 assert.equal(textsmithMessagesFit(invitation,'split',`${source} Do not call.`),false);
});

test('a phone label or business name containing Call is neutral contact data',()=>{
 for(const block of ['ABC Company phone: 618-555-1234','Call & Sons, tel. (618) 555-1234']) {
  assert.equal(textsmithMessagesFit([`The estimate came from ${block}.`],'single',`The estimate came from ${block}.`),true);
  assert.equal(textsmithMessagesFit([`${block}. Call them today.`],'single',`The estimate came from ${block}.`),false);
 }
});
