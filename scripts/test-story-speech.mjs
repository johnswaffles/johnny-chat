import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStorySpeech} from '../lib/story-speech.mjs';
import {onRequest as speechProxy} from '../functions/api/story-editor/[[path]].js';
import {chapterAudio} from '../public/story-editor/reader-speech.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

test('slow generation is pollable, duplicate starts share work, replay is cached',async()=>{
 const gate=deferred(), queue=createStorySpeech();let calls=0;
 const generate=()=>{calls++;return gate.promise;};
 assert.equal(queue.read('missing'),undefined);
 const first=queue.start('chapter',generate);assert.equal(first.status,'pending');
 assert.equal(queue.start('chapter',generate),first);await Promise.resolve();assert.equal(calls,1);
 assert.equal(queue.read('chapter').status,'pending');gate.resolve(Buffer.from('audio'));await first.done;
 assert.equal(queue.read('chapter').audio.toString(),'audio');assert.equal(queue.start('chapter',generate),first);assert.equal(calls,1);
});
test('deadline aborts the provider, ignores late audio, and only explicit start retries',async()=>{
 const gate=deferred();let signal,calls=0;
 const queue=createStorySpeech({timeoutMs:10});const entry=queue.start('a',s=>{signal=s;calls++;return gate.promise;});
 await entry.done;assert.equal(entry.status,'failed');assert.equal(signal.aborted,true);
 gate.resolve(Buffer.from('late'));await Promise.resolve();assert.equal(queue.read('a').audio,undefined);assert.equal(calls,1);
 const retry=queue.start('a',async()=>{calls++;return Buffer.from('retry');});await retry.done;assert.equal(retry.status,'ready');assert.equal(calls,2);
});
test('capacity, audio eviction, empty output, and failed metadata stay bounded',async()=>{
 const gate=deferred(),queue=createStorySpeech({maxPending:1,maxBytes:4,maxEntries:2});
 const entry=queue.start('a',()=>gate.promise);assert.equal(queue.start('b',()=>assert.fail()).status,'busy');
 gate.resolve(Buffer.from('1234'));await entry.done;
 await queue.start('b',async()=>Buffer.from('5678')).done;assert.equal(queue.read('a'),undefined);
 await queue.start('c',async()=>Buffer.alloc(0)).done;assert.equal(queue.read('c').status,'failed');
 await queue.start('d',async()=>{throw Error('offline');}).done;assert.equal(queue.read('b'),undefined);
});
function options(extra={}) {return {part:0,revision:'saved',headers:{'Content-Type':'application/json'},signal:new AbortController().signal,pollMs:0,...extra};}
test('reader starts once, polls GET, then plays audio without another paid start',async()=>{
 const calls=[];let pending=0;
 const blob=await chapterAudio('/speech',options({onPending:()=>pending++,fetcher:async(url,init)=>{
  calls.push({url,...init});return calls.length<3?new Response('{}',{status:202}):new Response('audio',{headers:{'Content-Type':'audio/mpeg'}});
 }}));
 assert.equal(await blob.text(),'audio');assert.equal(pending,2);assert.deepEqual(calls.map(c=>c.method),['POST','GET','GET']);
 assert.equal(JSON.parse(calls[0].body).async,true);assert.equal(calls[1].body,undefined);assert.equal(calls[1].url,'/speech?part=0&revision=saved');
});
test('HTML proxy errors are readable; missing/failed tasks never cause automatic POST retries',async()=>{
 for(const status of [524,404,502]) {
  let calls=0;
  await assert.rejects(chapterAudio('/speech',options({fetcher:async()=>{calls++;return new Response('<html>upstream failure</html>',{status});}})),/too long|could not be loaded/);
  assert.equal(calls,1);
 }
});
test('Stop interrupts pending polling without starting more audio',async()=>{
 const controller=new AbortController();let calls=0;
 await assert.rejects(chapterAudio('/speech',options({signal:controller.signal,onPending:()=>controller.abort(),fetcher:async()=>{calls++;return new Response('{}',{status:202});}})),{name:'AbortError'});
 assert.equal(calls,1);
});
test('reader stops polling at its overall deadline and rejects non-audio success',async()=>{
 await assert.rejects(chapterAudio('/speech',options({timeoutMs:10,pollMs:100,fetcher:async()=>new Response('{}',{status:202})})),/too long/);
 await assert.rejects(chapterAudio('/speech',options({fetcher:async()=>new Response('<html>login</html>')})),/unexpected response/);
});

test('Pages proxy preserves pending status and authenticated GET query without generating',async()=>{
 const oldFetch=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,init)=>{
  calls++;assert.equal(url,'https://johnny-chat.onrender.com/api/story-editor/projects/test/chapters/1/speech?part=0&revision=saved');
  assert.equal(init.method,'GET');assert.equal(init.body,undefined);assert.equal(init.headers.get('Authorization'),'Bearer synthetic');assert.equal(init.headers.get('cookie'),null);
  return new Response('{"ok":true,"status":"pending"}',{status:202,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 };
 try {
  const url='https://example.test/api/story-editor/projects/test/chapters/1/speech?part=0&revision=saved';
  assert.equal((await speechProxy({request:new Request(url),env:{}})).status,401);assert.equal(calls,0);
  const response=await speechProxy({request:new Request(url,{headers:{Cookie:'gpt54_session=synthetic'}}),env:{}});
  assert.equal(response.status,202);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal((await response.json()).status,'pending');assert.equal(calls,1);
 } finally {globalThis.fetch=oldFetch;}
});

test('speech 401 retains an auth-specific error and never retries generation or polling',async()=>{
 for(const pending of [false,true]){const methods=[];await assert.rejects(chapterAudio('/speech',options({fetcher:async(url,init)=>{methods.push(init.method);return pending&&methods.length===1?new Response('{}',{status:202}):new Response('{"detail":"Private session required"}',{status:401,headers:{'Content-Type':'application/json'}});}})),error=>error.code==='AUTH_REQUIRED'&&error.status===401&&/unlocking/.test(error.message));assert.deepEqual(methods,pending?['POST','GET']:['POST']);}
});

test('Unicode narration settings stay identical through POST/poll headers, out of query strings',async()=>{
 const narration={voice:'cedar',direction:'轻声叙述。'.repeat(350)},calls=[];
 await chapterAudio('/speech',options({narration,fetcher:async(url,init)=>{calls.push({url,init});return calls.length===1?new Response('{}',{status:202}):new Response('wav',{headers:{'Content-Type':'audio/wav'}});}}));
 const header=calls[0].init.headers['X-Story-Narration'];assert.equal(header,calls[1].init.headers['X-Story-Narration']);assert.ok(header.length<9000);assert.equal(JSON.parse(Buffer.from(header,'base64').toString('utf8')).direction,narration.direction);assert.ok(!calls[1].url.includes('direction'));
});
