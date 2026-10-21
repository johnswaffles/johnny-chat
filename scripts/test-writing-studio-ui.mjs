import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {speechParts} from '../public/story-editor/reader-model.mjs';
class Element {
 constructor(tag='div'){this.tagName=tag;this.children=[];this.attributes={};this.dataset={};this.events={};this.textContent='';this.hidden=false;this.disabled=false;this.value='';this.checked=false;this.currentTime=0;this.duration=20;this.classList={toggle(){},add(){},remove(){}};}
 setAttribute(k,v){this.attributes[k]=v;}
 removeAttribute(k){delete this.attributes[k];if(k==='src')this.src='';}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=children;}
 addEventListener(type,fn){(this.events[type]||=[]).push(fn);}
 querySelectorAll(selector){return selector==='li'?this.children:[];}
 scrollIntoView(){} focus(){} load(){} pause(){this.paused=true;}
 async play(){this.played=(this.played||0)+1;this.paused=false;}
}
const html=readFileSync(new URL('../public/story-editor/index.html',import.meta.url),'utf8');
const source=readFileSync(new URL('../public/story-editor/studio.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
async function harness({gate,failed=false,bookmark=null}={}){
 const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 elements.get('studio-readback').checked=true;
 const book={projectId:'book',title:'Local story',busy:false,original:'The imported original.',chapters:[{index:1,title:'One',passages:[{id:'a',text:'Current first passage.',original:'Original first passage.',revision:'r1',kind:'paragraph'},{id:'b',text:'Current second passage.',original:'Original second passage.',revision:'r2',kind:'paragraph'}]}],notes:[],messages:[],versions:[],bookmark,task:null,lastTask:null};
 const calls=[],audioCalls=[];let accepted=false;
 const fetcher=async(url,options={})=>{
  const path=new URL(url).pathname;calls.push({path,method:options.method,body:options.body});
  if(path.endsWith('/studio/tasks')&&options.method==='POST'){accepted=true;book.task={id:'task1',status:'running',phase:'drafting'};return Response.json({ok:true,task:book.task},{status:202});}
  if(path.endsWith('/tasks/task1')){
   if(gate)await gate;
   book.task=null;
   if(failed)return Response.json({ok:true,task:{id:'task1',status:'failed',error:'The critique could not finish.'}});
   book.chapters[0].passages[0].text='The critically refined passage.';book.chapters[0].passages[0].revision='r3';book.versions=[{id:'v1',sectionId:'a',instruction:'Deepen it.',createdAt:'2026-01-01'}];
   return Response.json({ok:true,task:{id:'task1',status:'done',result:{action:'revise',sectionId:'a',reply:'Saved the deeper passage.'}}});
  }
  if(path.endsWith('/studio'))return Response.json({ok:true,...book});
  return Response.json({ok:true});
 };
 class Voice {constructor(options){this.options=options;this.connected=false;this.interrupts=0;}interrupt(){this.interrupts++;}close(){}updateContext(){}}
 const document={cookie:'',getElementById:id=>elements.get(id),createElement:tag=>new Element(tag),addEventListener(){},dispatchEvent(){}};
 const sandbox={document,window:{JOHNNY_CHAT_API_BASE_URL:'http://local.test',addEventListener(){}},location:{origin:'http://local.test'},URL,URLSearchParams,AbortController,AbortSignal,Blob,Response,crypto:{randomUUID},requestAnimationFrame:fn=>fn(),matchMedia:()=>({matches:true}),setTimeout,clearTimeout,fetch:fetcher,speechParts,StudioVoice:Voice,chapterAudio:async(url,options)=>{audioCalls.push({url,options});return new Blob(['fake local audio']);},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}}};
 const context=vm.createContext(sandbox);vm.runInContext(source+'\nthis.testStudio={state,refresh,sendRequest,pause,selectSection,voice,read};',context);const api=context.testStudio;api.state.id='book';await api.refresh({initial:true});
 return {api,elements,calls,audioCalls,book,accepted:()=>accepted};
}
test('a successful revision automatically reads the new saved version, not the old prose',async()=>{
 const h=await harness();const result=await h.api.sendRequest('Deepen it.');await new Promise(r=>setImmediate(r));
 assert.equal(result.ok,true);assert.equal(h.audioCalls.length,1);assert.equal(h.audioCalls[0].options.revision,'r3');assert.equal(h.audioCalls[0].options.sectionId,'a');assert.equal(h.elements.get('studio-audio').played,1);assert.equal(h.api.state.data.original,'The imported original.');
 assert.equal(h.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/tasks')).length,1);
});
test('pausing while an edit runs suppresses late automatic playback',async()=>{
 let release;const gate=new Promise(r=>release=r);const h=await harness({gate});const pending=h.api.sendRequest('Deepen it.');await new Promise(r=>setImmediate(r));h.api.pause('Please wait.');release();await pending;
 assert.equal(h.audioCalls.length,0);assert.equal(h.api.state.data.chapters[0].passages[0].revision,'r3');
});
test('moving elsewhere during an edit preserves the new selection and does not read the old target',async()=>{
 let release;const h=await harness({gate:new Promise(r=>release=r)});const pending=h.api.sendRequest('Deepen it.');await new Promise(r=>setImmediate(r));h.api.selectSection('b');release();await pending;
 assert.equal(h.api.state.sectionId,'b');assert.equal(h.audioCalls.length,0);assert.equal(h.api.state.data.chapters[0].passages[0].revision,'r3');
});
test('a failed editorial pass keeps the prior draft and exposes explicit retry',async()=>{
 const h=await harness({failed:true});const result=await h.api.sendRequest('Deepen it.');assert.equal(result.ok,false);assert.equal(h.api.state.data.chapters[0].passages[0].revision,'r1');assert.equal(h.api.state.lastTask,'task1');assert.equal(h.elements.get('studio-retry').hidden,false);assert.equal(h.audioCalls.length,0);
});
test('speaking pauses narration immediately without redundantly cancelling the model response',async()=>{
 const h=await harness();await h.api.read();const interrupts=h.api.voice.interrupts;h.api.voice.options.onSpeech();assert.equal(h.elements.get('studio-audio').paused,true);assert.equal(h.api.state.reading,false);assert.equal(h.api.voice.interrupts,interrupts);
});
test('the original tab contains only preserved original text and leaves draft selection intact',async()=>{
 const h=await harness();h.elements.get('studio-original').events.click[0]();assert.equal(h.api.state.original,true);assert.equal(h.elements.get('studio-pages').children[0].textContent,'The imported original.');assert.equal(h.api.state.sectionId,'a');
});

test('returning opens the persisted passage and position, with a source recap and no generation',async()=>{
 const h=await harness({bookmark:{sectionId:'b',part:0,seconds:8,revision:'r2'}});
 assert.equal(h.api.state.sectionId,'b');assert.equal(h.api.state.resume.seconds,8);
 assert.match(h.elements.get('studio-return-copy').textContent,/passage 2 of 2/);
 assert.match(h.elements.get('studio-recap').textContent,/Current first passage/);
 assert.equal(h.audioCalls.length,0);assert.equal(h.calls.filter(c=>c.method==='POST').length,0);
 h.elements.get('studio-recap-read').events.click[0]();await new Promise(r=>setImmediate(r));
 assert.equal(h.api.state.sectionId,'a');assert.equal(h.audioCalls[0].options.sectionId,'a');
});
test('a changed saved revision resets the old audio time without losing the working passage',async()=>{
 const h=await harness({bookmark:{sectionId:'b',part:7,seconds:88,revision:'outdated'}});
 assert.equal(h.api.state.sectionId,'b');assert.equal(h.api.state.resume.part,0);assert.equal(h.api.state.resume.seconds,0);
});
test('narration advances into the next chapter rather than stopping the manuscript journey',async()=>{
 const h=await harness();h.api.state.data.chapters.push({index:2,title:'Two',passages:[{id:'c',text:'Next chapter.',revision:'r4',kind:'paragraph'}]});h.api.selectSection('b');await h.api.read();
 h.elements.get('studio-audio').onended();await new Promise(r=>setImmediate(r));
 assert.equal(h.api.state.sectionId,'c');assert.equal(h.audioCalls.at(-1).options.sectionId,'c');
});
