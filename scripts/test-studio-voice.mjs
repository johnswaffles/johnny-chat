import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StudioVoice} from '../public/story-editor/studio-voice.mjs';
function setup({token=async()=>({value:'fake-only',realtimeUrl:'https://example.test/calls'}),tool=async()=>({ok:true}),media}={}){
 const events=[],errors=[],statuses=[],transcripts=[];let stopped=0,spoken=0;
 const track={stop:()=>stopped++},stream={getTracks:()=>[track]};
 class Peer {
  constructor(){this.connectionState='new';}
  addTrack(t,s){assert.equal(t,track);assert.equal(s,stream);}
  createDataChannel(){return this.dc={readyState:'connecting',send:value=>events.push(JSON.parse(value)),close(){this.readyState='closed';this.onclose?.();}};}
  async createOffer(){return {sdp:'fake-offer'};}
  async setLocalDescription(){}
  async setRemoteDescription(answer){assert.equal(answer.sdp,'fake-answer');this.connectionState='connected';this.dc.readyState='open';this.dc.onopen();}
  close(){this.connectionState='closed';}
 }
 const voice=new StudioVoice({token,tool,onSpeech:()=>spoken++,onTranscript:(...args)=>transcripts.push(args),onStatus:text=>statuses.push(text),onError:error=>errors.push(error),mediaDevices:media||{getUserMedia:async()=>stream},Peer,makeAudio:()=>({pause(){},play:async()=>{},remove(){}}),fetcher:async(url,options)=>{assert.equal(url,'https://example.test/calls');assert.equal(options.headers.Authorization,'Bearer fake-only');return new Response('fake-answer');}});
 return {voice,events,errors,statuses,transcripts,stream,counts:()=>({stopped,spoken})};
}
test('voice is opt-in, closes microphone tracks, and handles interruption without generating prose itself',async()=>{
 const h=setup();assert.equal(h.voice.connected,false);assert.equal(h.counts().stopped,0);await h.voice.connect();assert.equal(h.voice.connected,true);
 await h.voice.handle({type:'input_audio_buffer.speech_started'});assert.equal(h.counts().spoken,1);
 await h.voice.handle({type:'conversation.item.input_audio_transcription.completed',transcript:'Stop. Deepen this moment.',item_id:'u1'});assert.equal(h.transcripts[0][0],'user');
 h.voice.responseActive=true;h.voice.interrupt();assert.ok(h.events.some(e=>e.type==='response.cancel'));assert.ok(h.events.some(e=>e.type==='output_audio_buffer.clear'));
 h.voice.close();assert.equal(h.counts().stopped,1);assert.equal(h.voice.connected,false);
});
test('duplicate tool completion events cannot cause a second paid edit',async()=>{
 let calls=0;const h=setup({tool:async(name,args)=>{calls++;assert.equal(name,'edit_passage');assert.equal(args.instruction,'Develop subtext.');return {ok:true,narrating:true};}});await h.voice.connect();
 const event={type:'response.function_call_arguments.done',call_id:'call-1',name:'edit_passage',arguments:'{"instruction":"Develop subtext."}'};
 await h.voice.handle(event);await h.voice.handle({type:'response.done',response:{output:[event]}});await new Promise(r=>setImmediate(r));
 assert.equal(calls,1);assert.equal(h.events.filter(e=>e.item?.type==='function_call_output').length,1);h.voice.close();
});
test('late tool output after disconnect cannot speak into a different project/session',async()=>{
 let resolve;const h=setup({tool:()=>new Promise(r=>resolve=r)});await h.voice.connect();const before=h.events.length;
 void h.voice.handleTool({call_id:'late',name:'edit_passage',arguments:'{}'},h.voice.epoch);h.voice.close();resolve({ok:true});await new Promise(r=>setImmediate(r));assert.equal(h.events.length,before);
});
test('failed token creation closes the microphone and exposes only a usable error',async()=>{
 const h=setup({token:async()=>{throw Error('Voice unavailable.');}});await h.voice.connect();assert.equal(h.voice.connected,false);assert.equal(h.counts().stopped,1);assert.equal(h.errors[0].message,'Voice unavailable.');
});
test('microphone acquired after a project switch is stopped and cannot connect',async()=>{
 let resolve,tokenCalls=0;const h=setup({token:async()=>{tokenCalls++;return {};},media:{getUserMedia:()=>new Promise(r=>resolve=r)}});const connecting=h.voice.connect();h.voice.close();resolve(h.stream);await connecting;assert.equal(tokenCalls,0);assert.equal(h.counts().stopped,1);
});
test('session errors release the microphone; benign already-cancelled responses do not kill a healthy connection',async()=>{
 const h=setup();await h.voice.connect();await h.voice.handle({type:'error',error:{code:'response_cancel_not_active'}});assert.equal(h.voice.connected,true);
 await h.voice.handle({type:'error',error:{code:'session_expired'}});assert.equal(h.voice.connected,false);assert.equal(h.counts().stopped,1);assert.match(h.errors[0].message,/session ended/);
});
