import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {createStoryResponses} from '../lib/story-responses.mjs';
import {transientStoryError} from '../lib/story-queue.mjs';
const request={model:'gpt-6-astra',reasoning:{effort:'max',mode:'pro'},max_output_tokens:32768,text:{format:{name:'story_autopilot_plan'}},input:[{role:'user',content:'Synthetic only'}]};
const response=(status='completed')=>({id:'resp_synthetic',model:'gpt-6-astra',status,output:[],usage:{input_tokens:20,output_tokens:30,output_tokens_details:{reasoning_tokens:25}}});
function fixture(t,client,options={}){const dir=mkdtempSync(tmpdir()+'/story-provider-');t.after(()=>rmSync(dir,{recursive:true,force:true}));const args={path:dir+'/state.sqlite',client,pollMs:0,...options};const runner=createStoryResponses(args);runner.init();return {runner,args};}
test('background request persists receipt, actual model and usage; terminal reuse makes no new call',async t=>{
 let creates=0,gets=0;const {runner}=fixture(t,{create:async(body,options)=>{creates++;assert.equal(body.background,true);assert.equal(body.store,true);assert.deepEqual(body.reasoning,{effort:'max',mode:'pro'});assert.equal(options.maxRetries,0);assert.ok(options.headers['X-Client-Request-Id']);return response('queued');},retrieve:async()=>{gets++;return response();}});
 assert.equal((await runner.run('job','stage',request)).status,'completed');assert.equal((await runner.run('job','stage',request)).status,'completed');assert.equal(creates,1);assert.equal(gets,1);const info=runner.info('job');assert.equal(info.state,'completed');assert.equal(info.model,'gpt-6-astra');assert.equal(info.usage.output_tokens_details.reasoning_tokens,25);assert.ok(!JSON.stringify(info).includes('Synthetic only'));
});
test('poll timeout and restart recover the same response ID, never another paid create',async t=>{
 let creates=0,gets=0;const {runner,args}=fixture(t,{create:async()=>{creates++;return response('in_progress');},retrieve:async id=>{assert.equal(id,'resp_synthetic');if(++gets===1)throw Error('Request timed out.');return response();}});
 await assert.rejects(runner.run('job','stage',request),e=>e.code==='PROVIDER_POLL_INTERRUPTED'&&transientStoryError(e));
 assert.equal(runner.info('job').responseId,'resp_synthetic');const restarted=createStoryResponses(args);await restarted.run('job','stage',request);assert.equal(creates,1);assert.equal(gets,2);
});
test('lost submission acknowledgement fails closed across explicit retries and restarts',async t=>{
 let creates=0;const {runner,args}=fixture(t,{create:async()=>{creates++;throw Error('Request timed out.');},retrieve:async()=>assert.fail()});
 await assert.rejects(runner.run('job','stage',request),e=>e.code==='PROVIDER_SUBMISSION_UNKNOWN'&&!transientStoryError(e));
 await assert.rejects(createStoryResponses(args).run('job','stage',request),e=>e.code==='PROVIDER_SUBMISSION_UNKNOWN');assert.equal(creates,1);assert.equal(runner.info('job').state,'submission_unknown');
});
test('polling window can elapse without abandoning or replaying the provider request',async t=>{
 let clock=0,creates=0,done=false;const {runner}=fixture(t,{create:async()=>{creates++;return response('queued');},retrieve:async()=>response(done?'completed':'in_progress')},{now:()=>clock,windowMs:5,sleep:async()=>{clock+=5;}});
 await assert.rejects(runner.run('job','stage',request),e=>e.code==='PROVIDER_STILL_WORKING'&&transientStoryError(e));done=true;await runner.run('job','stage',request);assert.equal(creates,1);
});
test('an interrupted worker preserves response identity for a new worker',async t=>{
 let creates=0;const controller=new AbortController();const {runner,args}=fixture(t,{create:async()=>{creates++;return response('queued');},retrieve:async()=>response()},{sleep:async()=>{controller.abort();controller.signal.throwIfAborted();}});
 await assert.rejects(runner.run('job','stage',request,controller.signal));await createStoryResponses({...args,sleep:async()=>{}}).run('job','stage',request);assert.equal(creates,1);
});
test('provider model mismatch is never accepted as saved draft output',async t=>{
 const {runner}=fixture(t,{create:async()=>({...response(),model:'smaller-model'}),retrieve:async()=>assert.fail()});await assert.rejects(runner.run('job','stage',request),e=>e.code==='PROVIDER_MODEL_MISMATCH');
});
test('concurrent repeated stage invocation cannot create duplicate paid requests',async t=>{
 let release,creates=0;const gate=new Promise(r=>release=r);const {runner}=fixture(t,{create:async()=>{creates++;await gate;return response();},retrieve:async()=>assert.fail()});
 const working=runner.run('job','stage',request);await assert.rejects(runner.run('job','stage',request),e=>e.code==='PROVIDER_SUBMISSION_UNKNOWN');release();await working;assert.equal(creates,1);
});
test('SDK timed-out wording is retryable; uncertain creation is not',()=>{assert.equal(transientStoryError(Error('Request timed out.')),true);assert.equal(transientStoryError(Error('connection error')),true);assert.equal(transientStoryError(Object.assign(Error('Submission outcome unknown'),{code:'PROVIDER_SUBMISSION_UNKNOWN'})),false);});

test('reported reasoning downgrade is blocked and recorded without accepting its output',async t=>{
 const {runner}=fixture(t,{create:async()=>({...response(),reasoning:{effort:'low',mode:'pro'}}),retrieve:async()=>assert.fail()});await assert.rejects(runner.run('job','stage',request),e=>e.code==='PROVIDER_REASONING_MISMATCH');assert.equal(runner.info('job').state,'blocked');assert.equal(runner.info('job').providerReasoning.effort,'low');
});
test('terminal provider cancellation is never replayed on resume',async t=>{
 let creates=0;const {runner}=fixture(t,{create:async()=>{creates++;return response('cancelled');},retrieve:async()=>assert.fail()});for(let i=0;i<2;i++)await assert.rejects(runner.run('job','stage',request),e=>e.code==='PROVIDER_CANCELLED');assert.equal(creates,1);
});
