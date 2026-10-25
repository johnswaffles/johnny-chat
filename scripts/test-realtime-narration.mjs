import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRealtimeNarrator,narrationIdentity} from '../lib/story-realtime-speech.mjs';
import {narrationOptions,NARRATION_MODEL} from '../public/story-editor/narration-model.mjs';
import {NarrationBuffer} from '../public/story-editor/narration-buffer.mjs';
function fixture(options={}){
 const sockets=[];
 class Socket extends EventEmitter{constructor(url,config){super();this.url=url;this.config=config;this.readyState=1;this.sent=[];sockets.push(this);}send(raw){this.sent.push(JSON.parse(raw));}close(){this.readyState=3;this.emit('close');}terminate(){this.close();}event(event){this.emit('message',Buffer.from(JSON.stringify(event)));}}
 const narrate=createRealtimeNarrator({apiKey:'local-fake-only',baseURL:'http://127.0.0.1:9999/v1',WebSocketClass:Socket,...options});
 return {narrate,sockets,begin(text='Saved words.',settings={}){const controller=new AbortController(),promise=narrate(text,controller.signal,settings),ws=sockets.at(-1);ws.event({type:'session.created'});ws.event({type:'session.updated'});ws.event({type:'response.created',response:{id:'local_response'}});return {ws,promise,controller};}};
}
function complete(ws,transcript='Saved words.',status='completed'){ws.event({type:'response.output_audio.delta',delta:Buffer.alloc(480).toString('base64')});ws.event({type:'response.output_audio_transcript.done',transcript});ws.event({type:'response.done',response:{status}});}
test('fresh Realtime sessions contain only this short part, instructions and no history/tools',async()=>{
 const f=fixture();for(const text of ['Saved words.','Next saved paragraph.']){const {ws,promise}=f.begin(text,{voice:'cedar',direction:'Whisper with suspense.'});const request=ws.sent.find(x=>x.type==='response.create').response;assert.equal(ws.url.protocol,'ws:');assert.equal(ws.url.pathname,'/v1/realtime');assert.equal(ws.url.searchParams.get('model'),NARRATION_MODEL);assert.equal(request.conversation,'none');assert.equal(request.input.length,1);assert.equal(request.input[0].content[0].text,text);assert.equal(request.audio.output.voice,'cedar');assert.match(request.instructions,/Whisper with suspense/);assert.deepEqual(request.tools,[]);assert.equal(request.max_output_tokens,4096);assert.equal(ws.sent.filter(x=>x.type==='response.create').length,1);complete(ws,text);const wav=await promise;assert.equal(wav.subarray(0,4).toString(),'RIFF');assert.equal(wav.readUInt32LE(24),24000);assert.equal(wav.length,524);assert.equal(ws.readyState,3);}assert.equal(f.sockets.length,2);
});
test('mismatched, missing, incomplete, invalid, excessive and disconnected audio fail closed without retry',async()=>{
 for(const scenario of ['words','missing','incomplete','invalid','excessive','disconnected','provider']){const f=fixture({maxBytes:512}),{ws,promise}=f.begin();if(scenario==='words')complete(ws,'Added words not in the manuscript.');if(scenario==='missing')complete(ws,'');if(scenario==='incomplete')complete(ws,'Saved words.','incomplete');if(scenario==='invalid')ws.event({type:'response.output_audio.delta',delta:'bad???'});if(scenario==='excessive')ws.event({type:'response.output_audio.delta',delta:Buffer.alloc(514).toString('base64')});if(scenario==='disconnected')ws.close();if(scenario==='provider')ws.event({type:'error',error:{message:'must not expose provider internals'}});await assert.rejects(promise);assert.equal(ws.sent.filter(x=>x.type==='response.create').length,1);assert.equal(f.sockets.length,1);}
});
test('explicit abort and bounded timeout send response.cancel and close the connection',async()=>{
 for(const cancel of [true,false]){const f=fixture({timeoutMs:10}),{ws,promise,controller}=f.begin();if(cancel)controller.abort();await assert.rejects(promise,/stopped|timed out/);assert.equal(ws.sent.at(-1).type,'response.cancel');assert.equal(ws.sent.at(-1).response_id,'local_response');assert.equal(ws.readyState,3);}
});
test('voice/style/model identities differ; invalid or oversized directions/parts are rejected before connecting',async()=>{
 assert.notEqual(narrationIdentity({}),narrationIdentity({voice:'cedar'}));assert.notEqual(narrationIdentity({}),narrationIdentity({direction:'Hushed.'}));assert.match(JSON.stringify(narrationOptions()),/gpt-realtime-2.1-mini/);assert.throws(()=>narrationOptions({voice:'invented'}),/supported/);assert.throws(()=>narrationOptions({direction:'x'.repeat(2001)}),/2,000/);const f=fixture();await assert.rejects(f.narrate('x'.repeat(1201),new AbortController().signal),/1,200/);assert.equal(f.sockets.length,0);
});
test('one lookahead is retained without chained work and reused by the current request',async()=>{
 let release,calls=0;const signals=[];const buffer=new NarrationBuffer((t,s)=>{calls++;signals.push(s);return t.key==='b'?new Promise(r=>release=r):Promise.resolve(t.key);});const a={key:'a'},b={key:'b'};
 assert.equal(await buffer.get(a),'a');buffer.prepare(b);buffer.prepare(b);assert.equal(calls,2);release('b');await buffer.next.promise;assert.equal(calls,2);assert.equal(await buffer.get(b),'b');assert.equal(calls,2);assert.equal(buffer.next,null);buffer.clear();assert.equal(signals.at(-1).aborted,true);
});
