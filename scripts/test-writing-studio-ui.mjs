import {comparePassages} from '../public/story-editor/review-model.mjs';
import {renderChapterTree} from '../public/story-editor/chapter-tree.mjs';
import {NarrationBuffer} from '../public/story-editor/narration-buffer.mjs';
import {NARRATION_PRESETS,narrationOptions,narrationSignature} from '../public/story-editor/narration-model.mjs';
import {editorialQualityLabel} from '../public/story-editor/quality-label.mjs';
import {renderRevisionTracker} from '../public/story-editor/revision-tracker.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {speechParts} from '../public/story-editor/reader-model.mjs';
import {notebookJourney,notebookReference} from '../public/story-editor/notebook-model.mjs';
class Element {
 constructor(tag='div'){this.tagName=tag;this.children=[];this.attributes={};this.dataset={};this.style={};this.events={};this.textContent='';this.hidden=false;this.disabled=false;this.value='';this.checked=false;this.currentTime=0;this.duration=20;this.classList={toggle(){},add(){},remove(){}};}
 setAttribute(k,v){this.attributes[k]=v;}
 removeAttribute(k){delete this.attributes[k];if(k==='src')this.src='';}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=children;this.textContent="";}
 addEventListener(type,fn){(this.events[type]||=[]).push(fn);}
 querySelectorAll(selector){return selector==='li'?this.children:[];}
 scrollIntoView(){} focus(){} close(){this.open=false;} showModal(){this.open=true;} load(){} pause(){this.paused=true;}
 async play(){this.played=(this.played||0)+1;this.paused=false;}
}
const html=readFileSync(new URL('../public/story-editor/index.html',import.meta.url),'utf8');
const source=readFileSync(new URL('../public/story-editor/studio.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
async function harness({gate,failed=false,bookmark=null,audioFetcher,proposal=false,bookGate,bookFailure=false,httpHook,treeSelection}={}){
 const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 elements.get('studio-readback').checked=true;
 let bookStore={books:[],book:null};let bookSaves=0;const savedVersions=[];
 const book={projectId:'book',title:'Local story',busy:false,original:'The imported original.',chapters:[{index:1,title:'One',revision:'chapter-r1',passages:[{id:'a',text:'Current first passage.',original:'Original first passage.',revision:'r1',kind:'paragraph'},{id:'b',text:'Current second passage.',original:'Original second passage.',revision:'r2',kind:'paragraph'}]}],notes:[],messages:[],versions:[],bookmark:bookmark?{audioIdentity:narrationSignature(),...bookmark}:null,task:null,lastTask:null};
 const calls=[],audioCalls=[];let accepted=false,taskInput=null;
 const fetcher=async(url,options={})=>{
  const path=new URL(url).pathname;calls.push({path,method:options.method,body:options.body});if(httpHook){const override=await httpHook(path,options,book);if(override)return override;}
  if(path.endsWith('/book/link')){const body=JSON.parse(options.body);bookStore={books:[{id:body.bookId||'saved-book',title:body.title||'Existing book'}],book:{id:body.bookId||'saved-book',title:body.title||'Existing book',revision:1,useContinuity:true,chapters:[]}};book.bookDrafts=bookStore;return Response.json(bookStore);}
  if(path.endsWith('/book/chapters')&&options.method==='POST'){bookSaves++;if(bookGate)await bookGate;if(bookFailure)return Response.json({error:'Storage busy. Nothing was saved.'},{status:409});if(!bookStore.book.chapters.length){bookStore.book.revision++;bookStore.book.chapters.push({id:'chapter1',position:1,title:'One',versionId:'saved-v1',version:1,savedAt:'2026-01-01',sourceProjectId:'book',sourceChapterIndex:1});savedVersions.push({id:'saved-v1',number:1,savedAt:'2026-01-01'});}book.bookDrafts=bookStore;return Response.json(bookStore);}
  if(path.endsWith('/book/chapters/chapter1'))return Response.json({chapterId:'chapter1',title:'One',approvedVersionId:'saved-v1',versionId:'saved-v1',version:1,savedAt:'2026-01-01',versions:savedVersions,content:{title:'One',passages:[{text:'A complete saved chapter.'}]}});
  if(path.endsWith('/book'))return Response.json(bookStore);
  if(path.endsWith('/studio/tasks')&&options.method==='POST'){taskInput=JSON.parse(options.body);accepted=true;book.task={id:'task1',status:'running',phase:'drafting'};return Response.json({ok:true,task:book.task},{status:202});}
  if(path.endsWith('/tasks/task1')){
   if(gate)await gate;
   book.task=null;
   if(taskInput?.mode==='discuss')return Response.json({ok:true,task:{id:'task1',status:'done',result:{action:'discuss',reply:'Here is a discussion without changes.'}}});
   if(failed)return Response.json({ok:true,task:{id:'task1',status:'failed',error:'The critique could not finish.'}});
   if(proposal)return Response.json({ok:true,task:{id:'task1',status:'done',result:{action:'revise_book',reply:'Review and apply this whole-manuscript change.',request:'Deepen the whole novel.',requiresConfirmation:true}}});
   book.chapters[0].passages[0].text='The critically refined passage.';book.chapters[0].passages[0].revision='r3';book.versions=[{id:'v1',sectionId:'a',instruction:'Deepen it.',createdAt:'2026-01-01'}];
   return Response.json({ok:true,task:{id:'task1',status:'done',result:{action:'revise',sectionId:'a',reply:'Saved the deeper passage.'}}});
  }
  if(path.endsWith('/studio/passage')&&options.method==='PUT'){const body=JSON.parse(options.body),p=book.chapters.flatMap(c=>c.passages).find(p=>p.id===body.sectionId);if(!p||p.revision!==body.revision)return Response.json({error:'Passage changed. Refresh first.'},{status:409});book.versions.unshift({id:'manual-v1',sectionId:p.id,instruction:'Manual edit',createdAt:'2026-01-01',beforeText:p.text,afterText:body.text,beforeRevision:p.revision,afterRevision:'manual-r1'});p.text=body.text;p.revision='manual-r1';book.chapters[0].revision='manual-chapter-r1';return Response.json({ok:true,changed:true,revision:p.revision});}
  if(path.includes('/studio/versions/')){const id=decodeURIComponent(path.split('/').pop()),version=book.versions.find(v=>v.id===id);return version?Response.json({ok:true,version}):Response.json({error:'Missing version'},{status:404});}
  if(path.endsWith('/studio'))return Response.json({ok:true,...book,...(proposal&&accepted?{lastTask:{id:'task1',status:'done',result:{action:'revise_book',request:'Deepen the whole novel.',requiresConfirmation:true}}}:{})});
  return Response.json({ok:true});
 };
 class Voice {constructor(options){this.options=options;this.connected=false;this.interrupts=0;}interrupt(){this.interrupts++;}close(){}updateContext(){}async connect(){this.connects=(this.connects||0)+1;}}
 const navigationStore=new Map(treeSelection?[['johnny-story-tree:book',JSON.stringify(treeSelection)]]:[]);
 const listeners={},windowListeners={};const dispatched=[];const document={cookie:'',getElementById:id=>elements.get(id),createElement:tag=>new Element(tag),addEventListener(type,fn){(listeners[type]||=[]).push(fn);},dispatchEvent(event){dispatched.push(event);for(const fn of listeners[event.type]||[])fn(event);}};
 const sandbox={document,window:{sessionStorage:{getItem:k=>navigationStore.get(k),setItem:(k,v)=>navigationStore.set(k,v),removeItem:k=>navigationStore.delete(k)},JOHNNY_CHAT_API_BASE_URL:'http://local.test',addEventListener(type,fn){(windowListeners[type]||=[]).push(fn);}},location:{origin:'http://local.test'},URL,URLSearchParams,AbortController,AbortSignal,Blob,Response,crypto:{randomUUID},requestAnimationFrame:fn=>fn(),matchMedia:()=>({matches:true}),setTimeout,clearTimeout,fetch:fetcher,comparePassages,initReadingComfort:()=>({setFocus(){},setPlaying(){}}),renderChapterTree:(node,options,fn)=>renderChapterTree(node,options,fn,document),NarrationBuffer,NARRATION_PRESETS,narrationOptions,narrationSignature,speechParts,notebookJourney,notebookReference,editorialQualityLabel,renderRevisionTracker,StudioVoice:Voice,chapterAudio:async(url,options)=>{audioCalls.push({url,options});return audioFetcher?audioFetcher(url,options):new Blob(['fake local audio']);},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}}};
 const context=vm.createContext(sandbox);vm.runInContext(source+'\nthis.testStudio={state,refresh,sendRequest,pause,selectSection,voice,read,resetWorkspace,renderNotebook,bookAction,saveChapter,setBookOpen,renderBookDrafts,openSavedChapter,playPart,pauseReading,resumeReading,narrationBuffer,checkAccess,requireUnlock,saveBookmark,api,resumeTask,navigateTree,submitComposer,openComparison,renderComparison,openManualEdit,saveManualEdit,renderSaveStatus,closeReviewDialogs,renderHistory,renderControls,renderEditorialProgress};',context);const api=context.testStudio;api.state.id='book';await api.refresh({initial:true});
 return {api,elements,calls,audioCalls,book,navigationStore,dispatched,listeners,windowListeners,accepted:()=>accepted,bookSaves:()=>bookSaves};
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

test('rapid repeated Read actions start only one request while preparing and stay locked during playback',async()=>{
 let release;const gate=new Promise(r=>release=r);const h=await harness({audioFetcher:async()=>{await gate;return new Blob(['fake audio']);}});
 const first=h.api.read();assert.equal(h.elements.get('studio-read').disabled,true);
 await Promise.all(Array.from({length:20},()=>h.api.read()));assert.equal(h.audioCalls.length,1);
 release();await first;assert.equal(h.elements.get('studio-audio').played,1);assert.equal(h.elements.get('studio-read').disabled,true);
 await h.api.read();assert.equal(h.audioCalls.length,1);
});
test('Stop unlocks Read and an old pending response cannot start playback after a new attempt',async()=>{
 let release;const gate=new Promise(r=>release=r);let count=0;const h=await harness({audioFetcher:async()=>{if(++count===1)await gate;return new Blob(['fake audio']);}});
 const first=h.api.read();h.elements.get('studio-stop').events.click[0]();assert.equal(h.elements.get('studio-read').disabled,false);assert.equal(h.audioCalls[0].options.signal.aborted,true);
 await h.api.read();assert.equal(h.audioCalls.length,2);assert.equal(h.elements.get('studio-read').disabled,true);
 release();await first;assert.equal(h.elements.get('studio-audio').played,1);
});
test('Talk pauses narration and unlocks Read before connecting the microphone',async()=>{
 const h=await harness();await h.api.read();assert.equal(h.elements.get('studio-read').disabled,true);
 h.elements.get('studio-voice').events.click[0]();assert.equal(h.api.voice.connects,1);assert.equal(h.api.state.reading,false);assert.equal(h.elements.get('studio-audio').paused,true);assert.equal(h.elements.get('studio-read').disabled,false);
});
test('a narration failure unlocks Read for an explicit retry',async()=>{
 let calls=0;const h=await harness({audioFetcher:async()=>{if(++calls===1)throw Error('Synthetic audio failure.');return new Blob(['fake audio']);}});
 await h.api.read();assert.equal(h.elements.get('studio-read').disabled,false);assert.equal(h.api.state.reading,false);
 await h.api.read();assert.equal(h.audioCalls.length,2);assert.equal(h.elements.get('studio-read').disabled,true);
});

test('Read stays locked across automatic passage transitions and unlocks at the end of the draft',async()=>{
 const h=await harness();await h.api.read();h.elements.get('studio-audio').onended();await new Promise(r=>setImmediate(r));
 assert.equal(h.api.state.sectionId,'b');assert.equal(h.elements.get('studio-read').disabled,true);assert.equal(h.audioCalls.length,2);
 h.elements.get('studio-audio').onended();assert.equal(h.api.state.reading,false);assert.equal(h.elements.get('studio-read').disabled,false);
});

test('a book proposal stays visible without a full edit until the author explicitly applies it',async()=>{
 const h=await harness({proposal:true});await h.api.sendRequest('Deepen the whole novel.');assert.equal(h.elements.get('notebook-proposal').hidden,false);assert.equal(h.api.state.data.chapters[0].passages[0].revision,'r1');assert.equal(h.dispatched.filter(e=>e.type==='story-author-request').length,0);
 h.elements.get('notebook-proposal-apply').events.click[0]();assert.equal(h.dispatched.filter(e=>e.type==='story-author-request').length,1);h.elements.get('notebook-proposal-apply').events.click[0]();assert.equal(h.dispatched.filter(e=>e.type==='story-author-request').length,1);
});
test('starting collaborative review goes to the beginning and switches the conversation to that passage',async()=>{
 const h=await harness({bookmark:{sectionId:'b',revision:'r2',part:0,seconds:4}});h.elements.get('notebook-next').dataset.action='begin';h.elements.get('notebook-next').events.click[0]();assert.equal(h.api.state.sectionId,'a');assert.equal(h.api.state.scope,'passage');assert.equal(h.elements.get('book-reader').dataset.view,'draft');assert.equal(h.audioCalls.length,0);
});

test('Start over clears narration, pending audio, conversation, selection, prompts and proposal without deleting saved content',async()=>{
 let release;const h=await harness({audioFetcher:async()=>{await new Promise(r=>release=r);return new Blob(['late']);}});h.elements.get('studio-input').value='Unsent question';h.api.state.proposal={id:'proposal',request:'Unsent change'};const pending=h.api.read();const original=h.book.original;h.api.resetWorkspace();release();await pending;
 assert.equal(h.api.state.id,'');assert.equal(h.api.state.data,null);assert.equal(h.api.state.sectionId,'');assert.equal(h.api.state.proposal,null);assert.equal(h.api.state.reading,false);assert.equal(h.elements.get('studio-input').value,'');assert.equal(h.elements.get('studio-messages').children.length,0);assert.equal(h.elements.get('studio-pages').children.length,0);assert.equal(h.elements.get('studio-audio').played,undefined);assert.equal(h.elements.get('studio-audio').hidden,true);assert.equal(h.book.original,original);assert.equal(h.calls.some(c=>c.method==='DELETE'),false);h.api.resetWorkspace();assert.equal(h.api.state.id,'');
 h.api.state.id='book';await h.api.refresh({initial:true});assert.equal(h.api.state.data.original,original);assert.equal(h.api.state.sectionId,'a');
});

test('tracker keeps saved prose separate from stages, recovers after reconnect, and clears on Start over',async()=>{
 const h=await harness();h.api.state.flowJob={status:'running',phase:'reading',completedChunks:0,totalChunks:10,currentChunk:8,provider:{state:'in_progress',checkedAt:new Date().toISOString()}};h.api.renderNotebook();assert.equal(h.elements.get('revision-tracker-count').textContent,'0');assert.equal(h.elements.get('revision-step-reading').dataset.state,'current');assert.equal(h.elements.get('notebook-next').hidden,true);
 h.api.state.connection='reconnecting';h.api.renderNotebook();assert.equal(h.elements.get('notebook-job-progress').dataset.state,'reconnecting');assert.match(h.elements.get('revision-tracker-title').textContent,/Last known/);assert.equal(h.elements.get('notebook-job-progress').dataset.motion,'false');
 h.api.state.connection='connected';h.api.state.flowJob={status:'completed',phase:'complete',completedChunks:10,totalChunks:10};h.api.renderNotebook();assert.equal(h.elements.get('revision-tracker-count').textContent,'10');assert.equal(h.elements.get('notebook-job-progress').dataset.state,'complete');assert.equal(h.elements.get('notebook-next').hidden,false);assert.equal(h.elements.get('notebook-stop-full').hidden,true);h.api.resetWorkspace();assert.equal(h.elements.get('notebook-job-progress').hidden,true);
});

test('Book drafts requires explicit creation/save and rapid Save presses submit once',async()=>{
 let release;const h=await harness({bookGate:new Promise(r=>release=r)});await h.api.bookAction(h.api.saveChapter);assert.equal(h.bookSaves(),0);assert.equal(h.elements.get('book-drafts-panel').hidden,false);
 h.elements.get('book-name').value='My assembled book';h.elements.get('book-create-form').events.submit[0]({preventDefault(){}});await new Promise(r=>setImmediate(r));assert.equal(h.bookSaves(),1);assert.equal(h.elements.get('book-save-chapter').disabled,true);await h.api.bookAction(h.api.saveChapter);assert.equal(h.bookSaves(),1);release();await new Promise(r=>setImmediate(r));assert.equal(h.api.state.data.bookDrafts.book.chapters.length,1);assert.equal(h.api.state.bookSaving,false);assert.match(h.elements.get('book-drafts-status').textContent,/Book version saved/);assert.equal(h.book.original,'The imported original.');
});
test('failed book save keeps draft and book, shows error, and unlocks explicit retry',async()=>{
 const h=await harness({bookFailure:true});h.elements.get('book-name').value='Book';h.elements.get('book-create-form').events.submit[0]({preventDefault(){}});await new Promise(r=>setImmediate(r));assert.equal(h.bookSaves(),1);assert.match(h.elements.get('book-drafts-status').textContent,/Nothing was saved/);assert.equal(h.api.state.data.bookDrafts.book.chapters.length,0);assert.equal(h.api.state.bookSaving,false);assert.equal(h.api.state.data.chapters[0].passages[0].text,'Current first passage.');await h.api.bookAction(h.api.saveChapter);assert.equal(h.bookSaves(),2);
});
test('saved chapter opens read-only without replacing current prose; Start over closes and clears local shelf',async()=>{
 const h=await harness();h.elements.get('book-name').value='Book';h.elements.get('book-create-form').events.submit[0]({preventDefault(){}});await new Promise(r=>setImmediate(r));await h.api.openSavedChapter('chapter1');assert.equal(h.elements.get('book-version-dialog').open,true);assert.equal(h.elements.get('book-version-text').textContent,'A complete saved chapter.');assert.equal(h.api.state.data.chapters[0].passages[0].text,'Current first passage.');h.api.resetWorkspace();assert.equal(h.elements.get('book-version-dialog').open,false);assert.equal(h.elements.get('book-drafts-panel').hidden,true);assert.equal(h.api.state.savedChapter,null);assert.equal(h.api.state.bookSaving,false);assert.equal(h.api.state.data,null);
});
test('a save response arriving after Start over cannot reopen or fill the new workspace',async()=>{
 let release;const h=await harness({bookGate:new Promise(r=>release=r)});h.elements.get('book-name').value='Book';h.elements.get('book-create-form').events.submit[0]({preventDefault(){}});await new Promise(r=>setImmediate(r));assert.equal(h.bookSaves(),1);h.api.resetWorkspace();release();await new Promise(r=>setImmediate(r));assert.equal(h.api.state.data,null);assert.equal(h.elements.get('book-drafts-panel').hidden,true);assert.equal(h.api.state.bookSaving,false);assert.equal(h.elements.get('book-drafts-status').textContent,'');
});
test('Original view and active editorial work cannot save a chapter through the controls',async()=>{
 const h=await harness();h.api.state.original=true;h.api.renderBookDrafts();assert.equal(h.elements.get('book-save-chapter').disabled,true);h.api.state.original=false;h.api.state.data.busy=true;h.api.renderBookDrafts();assert.equal(h.elements.get('book-save-chapter').disabled,true);assert.equal(h.elements.get('book-select').disabled,true);h.api.state.data.busy=false;h.api.renderBookDrafts();assert.equal(h.elements.get('book-save-chapter').disabled,false);
});

test('Read click handler shows loading synchronously and permits one pending audio operation',async()=>{
 let release;const h=await harness({audioFetcher:()=>new Promise(r=>release=r)});for(let i=0;i<30;i++)h.elements.get('studio-read').events.click[0]();assert.equal(h.audioCalls.length,1);assert.equal(h.elements.get('studio-read').textContent,'Preparing audio…');assert.equal(h.elements.get('studio-read').attributes['aria-busy'],'true');h.elements.get('studio-audio').events.play[0]();assert.equal(h.elements.get('studio-read').textContent,'Preparing audio…');await h.api.playPart(0,h.api.state.audioEpoch);assert.equal(h.audioCalls.length,1);release(new Blob(['synthetic']));await new Promise(r=>setImmediate(r));assert.equal(h.elements.get('studio-read').textContent,'Reading…');assert.equal(h.elements.get('studio-read').attributes['aria-busy'],'false');assert.equal(h.elements.get('studio-read').disabled,true);
});
test('duplicate audio-ended events advance once and share one pending next-part request',async()=>{
 let release,calls=0;const h=await harness({audioFetcher:async()=>{if(++calls===2)await new Promise(r=>release=r);return new Blob(['synthetic']);}});await h.api.read();const ended=h.elements.get('studio-audio').onended;ended();ended();await new Promise(r=>setImmediate(r));assert.equal(h.audioCalls.length,2);assert.equal(h.api.state.sectionId,'b');assert.equal(h.elements.get('studio-read').textContent,'Preparing audio…');release();await new Promise(r=>setImmediate(r));assert.equal(h.elements.get('studio-audio').played,2);
});
test('unexpected AbortError unlocks Read and a deliberate retry works',async()=>{
 let calls=0;const h=await harness({audioFetcher:async()=>{if(++calls===1)throw new DOMException('Synthetic interrupted request','AbortError');return new Blob(['synthetic']);}});await h.api.read();assert.equal(h.api.state.reading,false);assert.equal(h.elements.get('studio-read').disabled,false);assert.equal(h.elements.get('studio-read').attributes['aria-busy'],'false');await h.api.read();assert.equal(h.audioCalls.length,2);assert.equal(h.elements.get('studio-audio').played,1);
});
test('playback errors unlock Read; browser autoplay blocking keeps ready audio without another request',async()=>{
 const h=await harness();h.elements.get('studio-audio').play=async()=>{throw Error('Synthetic device unavailable');};await h.api.read();assert.equal(h.elements.get('studio-read').disabled,false);assert.match(h.elements.get('studio-status').textContent,/Playback could not start/);h.elements.get('studio-audio').play=async()=>{throw new DOMException('Autoplay blocked','NotAllowedError');};await h.api.read();assert.equal(h.elements.get('studio-read').disabled,true);assert.equal(h.elements.get('studio-read').textContent,'Audio ready · use Play');await h.api.read();assert.equal(h.audioCalls.length,2);h.elements.get('studio-pause').events.click[0]();assert.equal(h.elements.get('studio-read').disabled,false);
});

test('speech 401 exposes unlock without losing text, starting more audio, or overwriting a revision',async()=>{
 const h=await harness({audioFetcher:async()=>{throw Object.assign(Error('Session expired'),{code:'AUTH_REQUIRED',status:401});}});for(const id of ['studio-input','studio-note','author-request-text'])h.elements.get(id).value='Unsent '+id;const original=h.book.original,prose=h.book.chapters[0].passages[0].text;await h.api.read();assert.equal(h.api.state.authRequired,true);assert.equal(h.elements.get('studio-auth-banner').hidden,false);assert.equal(h.api.state.reading,false);assert.equal(h.elements.get('studio-read').disabled,true);assert.match(h.elements.get('studio-auth-copy').textContent,/Unsent text stays/);for(const id of ['studio-input','studio-note','author-request-text'])assert.equal(h.elements.get(id).value,'Unsent '+id);const before=h.calls.length;for(let i=0;i<20;i++){await h.api.read();h.api.saveBookmark();}assert.equal(h.audioCalls.length,1);assert.equal(h.calls.length,before);assert.equal(h.book.original,original);assert.equal(h.book.chapters[0].passages[0].text,prose);
 assert.match(html,/id="studio-auth-banner"[^>]*tabindex="-1"/);assert.match(html,/id="studio-auth-unlock"[^>]*href="\/story-editor\/\?reauth=1"[^>]*target="_blank"[^>]*rel="noopener"/);
});
test('bookmark 401 shows the same recovery and suppresses background request spam',async()=>{
 const h=await harness({httpHook:async path=>path.endsWith('/bookmark')?Response.json({detail:'Private session required'},{status:401}):null});h.api.saveBookmark();await new Promise(r=>setImmediate(r));assert.equal(h.api.state.authRequired,true);assert.equal(h.elements.get('studio-auth-banner').hidden,false);const count=h.calls.filter(c=>c.path.endsWith('/bookmark')).length;for(let i=0;i<20;i++)h.api.saveBookmark();await new Promise(r=>setImmediate(r));assert.equal(h.calls.filter(c=>c.path.endsWith('/bookmark')).length,count);assert.equal(h.audioCalls.length,0);assert.equal(h.book.chapters[0].passages[0].text,'Current first passage.');
});
test('non-auth bookmark failure is visible and clears only after a successful sync',async()=>{
 let failing=true;const h=await harness({httpHook:async path=>path.endsWith('/bookmark')&&failing?Response.json({error:'Offline'},{status:503}):null});h.api.saveBookmark();await new Promise(r=>setImmediate(r));assert.equal(h.elements.get('studio-bookmark-warning').hidden,false);assert.match(h.elements.get('studio-bookmark-warning').textContent,/position has not synced/);assert.equal(h.api.state.authRequired,false);failing=false;h.api.saveBookmark();await new Promise(r=>setImmediate(r));assert.equal(h.elements.get('studio-bookmark-warning').hidden,true);
});
test('reauthentication checks are single-flight, preserve unsent notes, refresh overnight prose and never auto-narrate',async()=>{
 let denied=false,release,held=false;const h=await harness({httpHook:async path=>{if(path.endsWith('/studio')&&denied){if(held)await new Promise(r=>release=r);return Response.json({error:'Unlock required'},{status:401});}return null;}});h.elements.get('studio-input').value='Keep my unsent idea';h.elements.get('studio-note').value='Unsent continuity note';denied=true;h.api.requireUnlock();held=true;const before=h.calls.length;const first=h.api.checkAccess();await new Promise(r=>setImmediate(r));await h.api.checkAccess();assert.equal(h.calls.length,before+1);assert.equal(h.elements.get('studio-auth-check').disabled,true);release();await first;assert.equal(h.api.state.authRequired,true);assert.match(h.elements.get('studio-auth-copy').textContent,/Access is still locked/);assert.equal(h.audioCalls.length,0);
 denied=false;h.book.chapters[0].passages[0].text='The actual overnight revised passage.';h.book.chapters[0].passages[0].revision='overnight-r1';const prior=h.calls.length;await h.api.checkAccess();assert.equal(h.api.state.authRequired,false);assert.equal(h.elements.get('studio-auth-banner').hidden,true);assert.equal(h.elements.get('studio-read').disabled,false);assert.equal(h.elements.get('studio-input').value,'Keep my unsent idea');assert.equal(h.elements.get('studio-note').value,'Unsent continuity note');assert.equal(h.api.state.data.chapters[0].passages[0].text,'The actual overnight revised passage.');assert.equal(h.api.state.sectionId,'a');assert.ok(h.calls.slice(prior).every(c=>c.method==='GET'));assert.equal(h.audioCalls.length,0);await Promise.all(Array.from({length:20},()=>h.api.read()));assert.equal(h.audioCalls.length,1);assert.equal(h.audioCalls[0].options.revision,'overnight-r1');
});
test('returning after login only verifies access; a failed connection leaves the locked text open',async()=>{
 let offline=false;const h=await harness({httpHook:async path=>{if(offline&&path.endsWith('/studio'))throw TypeError('Synthetic offline');return null;}});h.api.requireUnlock();h.elements.get('studio-input').value='Unsent';offline=true;h.windowListeners.focus[0]();await new Promise(r=>setImmediate(r));assert.equal(h.api.state.authRequired,true);assert.equal(h.elements.get('studio-auth-banner').hidden,false);assert.equal(h.elements.get('studio-input').value,'Unsent');assert.equal(h.api.state.accessChecking,false);assert.equal(h.audioCalls.length,0);offline=false;h.windowListeners.focus[0]();await new Promise(r=>setImmediate(r));assert.equal(h.api.state.authRequired,false);assert.equal(h.audioCalls.length,0);
});
test('a late 401 from before reauthentication cannot relock the restored session',async()=>{
 let release,delay=false;const h=await harness({httpHook:async path=>{if(delay&&path.endsWith('/bookmark')){await new Promise(r=>release=r);return Response.json({error:'Old expired request'},{status:401});}return null;}});delay=true;h.api.saveBookmark();await new Promise(r=>setImmediate(r));h.api.requireUnlock();await h.api.checkAccess();assert.equal(h.api.state.authRequired,false);release();await new Promise(r=>setImmediate(r));assert.equal(h.api.state.authRequired,false);assert.equal(h.elements.get('studio-auth-banner').hidden,true);assert.equal(h.audioCalls.length,0);
});

test('read-only recovery of a finished task does not reload unsent legacy forms or restart narration',async()=>{const h=await harness();h.elements.get('studio-note').value='Unsent local note';await h.api.resumeTask('task1');assert.equal(h.elements.get('studio-note').value,'Unsent local note');assert.equal(h.audioCalls.length,0);assert.equal(h.dispatched.filter(e=>e.type==='story-studio-saved').length,0);assert.match(h.api.state.data.chapters[0].passages[0].text,/critically refined/);});

test('navigation bookmark failures are visible through the same guarded sync path',async()=>{const h=await harness({httpHook:async path=>path.endsWith('/bookmark')?Response.json({error:'Synthetic offline'},{status:503}):null});h.api.selectSection('b');await new Promise(r=>setImmediate(r));assert.equal(h.api.state.sectionId,'b');assert.equal(h.elements.get('studio-bookmark-warning').hidden,false);assert.equal(h.api.state.resume.sectionId,'b');assert.equal(h.api.state.resume.part,0);assert.equal(h.audioCalls.length,0);});

const tick=()=>new Promise(r=>setImmediate(r));
const audioEvent=(h,name)=>{for(const fn of h.elements.get('studio-audio').events[name]||[])fn();};
test('true Pause and rapid Resume reuse current audio and exact position without another request',async()=>{
 const h=await harness();await h.api.read();const audio=h.elements.get('studio-audio'),src=audio.src;audio.currentTime=7.25;h.api.pauseReading();assert.equal(h.api.state.readPhase,'paused');assert.equal(audio.src,src);assert.equal(audio.currentTime,7.25);assert.equal(h.audioCalls[0].options.signal.aborted,false);await Promise.all([h.api.read(),h.api.read(),h.api.read()]);assert.equal(h.audioCalls.length,1);assert.equal(audio.currentTime,7.25);assert.equal(audio.played,2);assert.equal(h.api.state.reading,true);
});
test('pausing during initial generation retains its completion without autoplay or duplicate requests',async()=>{
 let release;const h=await harness({audioFetcher:()=>new Promise(r=>release=r)});const reading=h.api.read();h.api.pauseReading();release(new Blob(['one']));await reading;assert.equal(h.elements.get('studio-audio').played,undefined);assert.ok(h.elements.get('studio-audio').src);await h.api.read();assert.equal(h.audioCalls.length,1);assert.equal(h.elements.get('studio-audio').played,1);
});
test('at most one near-end lookahead, paused completion retained, next playback reuses it',async()=>{
 let release;const h=await harness({audioFetcher:async(url,options)=>options.sectionId==='b'?await new Promise(r=>release=r):new Blob(['first'])});await h.api.read();const audio=h.elements.get('studio-audio');audio.duration=20;audio.currentTime=3;audioEvent(h,'timeupdate');assert.equal(h.audioCalls.length,1);audio.currentTime=13;audioEvent(h,'timeupdate');audioEvent(h,'timeupdate');assert.equal(h.audioCalls.length,2);h.api.pauseReading();release(new Blob(['next']));await tick();audioEvent(h,'timeupdate');assert.equal(h.audioCalls.length,2);assert.equal(audio.played,1);await h.api.read();audio.onended();await tick();assert.equal(h.audioCalls.length,2);assert.equal(h.api.state.sectionId,'b');assert.equal(audio.played,3);
});
test('ending while lookahead pending then pausing does not autoplay its late completion',async()=>{
 let release;const h=await harness({audioFetcher:async(url,options)=>options.sectionId==='b'?await new Promise(r=>release=r):new Blob(['first'])});await h.api.read();const audio=h.elements.get('studio-audio');audio.currentTime=13;audioEvent(h,'timeupdate');audio.onended();await tick();h.api.pauseReading();release(new Blob(['next']));await tick();assert.equal(audio.played,1);assert.equal(h.audioCalls.length,2);await h.api.read();assert.equal(audio.played,2);assert.equal(h.audioCalls.length,2);
});
test('Stop and selection discard lookahead and late responses, never schedule more audio',async()=>{
 for(const action of ['stop','selection']){let release;const h=await harness({audioFetcher:async(url,options)=>options.sectionId==='b'?await new Promise(r=>release=r):new Blob(['first'])});await h.api.read();const audio=h.elements.get('studio-audio');audio.currentTime=13;audioEvent(h,'timeupdate');if(action==='stop')h.elements.get('studio-stop').events.click[0]();else h.api.selectSection('b');assert.equal(h.audioCalls[1].options.signal.aborted,true);release(new Blob(['late']));await tick();assert.equal(audio.played,1);audioEvent(h,'timeupdate');assert.equal(h.audioCalls.length,2);assert.equal(h.api.narrationBuffer.next,null);}
});
test('style change invalidates prepared audio and old timing, then explicitly reads with new directions',async()=>{
 const h=await harness();await h.api.read();h.elements.get('studio-audio').currentTime=8;h.api.pauseReading();h.elements.get('studio-narration-voice').value='cedar';h.elements.get('studio-narration-direction').value='Hushed and suspenseful.';h.elements.get('studio-narration-direction').events.input[0]();assert.equal(h.api.state.resume,null);assert.equal(h.elements.get('studio-narration-preset').value,'custom');await h.api.read();assert.equal(h.audioCalls.length,2);assert.equal(h.audioCalls[1].options.narration.voice,'cedar');assert.equal(h.audioCalls[1].options.narration.direction,'Hushed and suspenseful.');assert.equal(h.api.state.loadedAudio.seconds,0);
});
test('lookahead auth failure stops scheduling and unlock flow never resubmits speech',async()=>{
 const h=await harness({audioFetcher:async(url,options)=>{if(options.sectionId==='b')throw Object.assign(Error('Unlock again'),{code:'AUTH_REQUIRED'});return new Blob(['first']);}});await h.api.read();h.elements.get('studio-audio').currentTime=13;audioEvent(h,'timeupdate');await tick();assert.equal(h.api.state.authRequired,true);assert.equal(h.api.state.reading,false);await h.api.checkAccess();assert.equal(h.audioCalls.length,2);assert.equal(h.api.state.authRequired,false);
});
test('native audio Pause and Play participate in Resume without duplicate API calls',async()=>{
 const h=await harness();await h.api.read();audioEvent(h,'pause');assert.equal(h.api.state.readPhase,'paused');audioEvent(h,'play');assert.equal(h.api.state.reading,true);assert.equal(h.api.state.readPhase,'playing');assert.equal(h.audioCalls.length,1);
});

test('a bookmark from a different voice or old part format reopens its passage without reusing incompatible audio seconds',async()=>{
 for(const audioIdentity of ['',narrationSignature({voice:'cedar'})]){const h=await harness({bookmark:{sectionId:'b',revision:'r2',part:0,seconds:12,audioIdentity}});assert.equal(h.api.state.sectionId,'b');assert.equal(h.api.state.resume.seconds,0);assert.equal(h.api.state.resume.part,0);assert.equal(h.audioCalls.length,0);}
});

test('late Resume rejection cannot stop a new read after Stop, and blocked Resume retains generated audio',async()=>{
 const h=await harness();await h.api.read();h.api.pauseReading();const audio=h.elements.get('studio-audio');let reject;audio.play=()=>new Promise((resolve,r)=>reject=r);const old=h.api.read();h.elements.get('studio-stop').events.click[0]();audio.play=async()=>{};await h.api.read();reject(Object.assign(Error('interrupted'),{name:'AbortError'}));await old;assert.equal(h.api.state.reading,true);assert.equal(h.audioCalls.length,2);
 h.api.pauseReading();const src=audio.src;audio.play=async()=>{throw Object.assign(Error('gesture'),{name:'NotAllowedError'});};await h.api.read();assert.equal(h.api.state.readPhase,'ready');assert.equal(audio.src,src);assert.equal(h.audioCalls.length,2);
});

test('original chapter tree is read only and revised selection preserves unsent ideas and stops stale audio',async()=>{
 const h=await harness();h.book.originalChapters=[{index:1,title:'Imported one',text:'Immutable first chapter.'},{index:2,title:'Imported two',text:'Immutable second chapter.'}];await h.api.refresh();h.elements.get('studio-input').value='Unsent chapter idea';await h.api.read();await h.api.navigateTree({version:'original',chapter:2});assert.equal(h.api.state.original,true);assert.equal(h.api.state.originalChapter,2);assert.equal(h.elements.get('reader-title').textContent,'Imported two');assert.equal(h.elements.get('studio-pages').children[0].textContent,'Immutable second chapter.');assert.equal(h.elements.get('studio-read').disabled,true);assert.equal(h.elements.get('studio-send').disabled,true);assert.equal(h.elements.get('book-save-chapter').disabled,true);assert.equal(h.api.state.reading,false);await h.api.navigateTree({version:'revised',chapter:1});assert.equal(h.api.state.original,false);assert.equal(h.elements.get('studio-input').value,'Unsent chapter idea');assert.equal(h.audioCalls.length,1);assert.equal(h.calls.some(c=>c.path.includes('cancel')||c.path.includes('stop-work')),false);
});
test('tree navigation obeys a pending-work guard and leaves the active server edit untouched',async()=>{
 const h=await harness();h.listeners['story-before-navigate']=[event=>{event.detail.allowed=false;}];await h.api.navigateTree({version:'original',chapter:null});assert.equal(h.api.state.original,false);assert.equal(h.calls.some(c=>c.path.includes('cancel')||c.path.includes('stop-work')),false);h.listeners['story-before-navigate']=[];h.api.state.task='running-task';await h.api.navigateTree({version:'original',chapter:null});assert.equal(h.api.state.task,'running-task');assert.equal(h.api.state.original,true);
});
test('restored unsent goal survives redraw and tree selection restores without paid requests',async()=>{
 const h=await harness();for(const fn of h.listeners['story-restore-navigation-drafts'])fn({detail:{projectId:'book',values:{'studio-input':'Keep this idea','studio-goal':'My unsaved direction'}}});h.api.renderNotebook();await h.api.navigateTree({version:'revised',chapter:1});assert.equal(h.elements.get('studio-goal').value,'My unsaved direction');assert.equal(h.elements.get('studio-input').value,'Keep this idea');assert.equal(h.audioCalls.length,0);
});

test('chapter/version choice survives a reload without playing or changing the saved manuscript',async()=>{const h=await harness({treeSelection:{original:true,chapter:null,sectionId:'a'}});assert.equal(h.api.state.original,true);assert.equal(h.elements.get('studio-pages').children[0].textContent,'The imported original.');assert.equal(h.audioCalls.length,0);await h.api.navigateTree({version:'revised',chapter:1});const saved=JSON.parse(h.navigationStore.get('johnny-story-tree:book'));assert.equal(saved.original,false);assert.equal(saved.chapter,1);assert.equal(h.book.chapters[0].passages[0].text,'Current first passage.');});

test('a pending unsent restoration survives delayed/auth-recovery refresh, not just the first load',async()=>{const h=await harness();h.api.state.pendingNavigationDrafts={'studio-goal':'Unsent goal after reconnect','studio-note':'Keep this note'};await h.api.refresh({allowLocked:true,resumePending:false});assert.equal(h.elements.get('studio-goal').value,'Unsent goal after reconnect');assert.equal(h.elements.get('studio-note').value,'Keep this note');assert.equal(h.api.state.pendingNavigationDrafts,null);});

test('changing voice alone clears incompatible old timing and waits for a deliberate Read',async()=>{const h=await harness();await h.api.read();h.elements.get('studio-audio').currentTime=9;h.api.pauseReading();h.elements.get('studio-narration-voice').value='cedar';h.elements.get('studio-narration-voice').events.change[0]();assert.equal(h.api.state.resume,null);assert.equal(h.audioCalls.length,1);await h.api.read();assert.equal(h.audioCalls[1].options.narration.voice,'cedar');assert.equal(h.api.state.loadedAudio.seconds,0);});

const settled=()=>new Promise(resolve=>setImmediate(resolve));
const content=node=>(node.children||[]).map(child=>child.textContent+content(child)).join('');

test('Discuss composer sends explicit discussion mode and keeps manuscript and audio unchanged',async()=>{
 const h=await harness();h.elements.get('studio-input').value='What motivates her here?';h.api.state.scope='passage';
 const before=h.book.chapters[0].passages[0].text;
 await h.api.submitComposer();await settled();
 const request=h.calls.find(c=>c.path.endsWith('/tasks')&&c.method==='POST');
 assert.deepEqual(JSON.parse(request.body),{requestId:JSON.parse(request.body).requestId,sectionId:'a',revision:'r1',message:'What motivates her here?',mode:'discuss',scope:'passage',cursor:{part:0,seconds:0}});
 assert.equal(h.book.chapters[0].passages[0].text,before);assert.equal(h.audioCalls.length,0);assert.equal(h.elements.get('studio-input').value,'');
});

test('Passage Revise sends explicit edit mode and preserves normal revision readback',async()=>{
 const h=await harness();h.api.state.requestMode='edit';h.api.state.scope='passage';h.elements.get('studio-input').value='Make her hesitation tangible.';
 await h.api.submitComposer();await settled();
 const body=JSON.parse(h.calls.find(c=>c.path.endsWith('/tasks')&&c.method==='POST').body);
 assert.equal(body.mode,'edit');assert.equal(body.scope,'passage');assert.equal(body.sectionId,'a');assert.equal(h.audioCalls.length,1);assert.equal(h.api.state.data.original,'The imported original.');
});

test('Chapter and whole-manuscript Revise dispatch exact scope without starting a passage task',async()=>{
 for(const scope of ['chapter','book']){
  const h=await harness();h.book.chapters.push({index:2,title:'Two',revision:'chapter-r2',passages:[{id:'c',text:'Second chapter.',original:'Second chapter.',revision:'r4',kind:'paragraph'}]});await h.api.refresh();
  h.api.state.requestMode='edit';h.api.state.scope=scope;h.elements.get('studio-input').value='Strengthen the dialogue.';await h.api.submitComposer();
  const events=h.dispatched.filter(event=>event.type==='story-author-request');assert.equal(events.length,1);assert.equal(events[0].detail.projectId,'book');assert.equal(events[0].detail.request,'Strengthen the dialogue.');assert.equal(events[0].detail.chapter,scope==='chapter'?1:undefined);assert.equal(events[0].detail.composer,true);
  assert.equal(h.calls.filter(call=>call.path.endsWith('/tasks')).length,0);assert.equal(h.elements.get('studio-input').value,'Strengthen the dialogue.');
 }
});

test('Chapter Revise refuses ambiguous one-chapter imports without sending any job',async()=>{
 const h=await harness();h.api.state.requestMode='edit';h.api.state.scope='chapter';h.elements.get('studio-input').value='Revise this chapter.';await h.api.submitComposer();
 assert.match(h.elements.get('studio-status').textContent,/one chapter/);assert.equal(h.dispatched.filter(event=>event.type==='story-author-request').length,0);assert.equal(h.calls.filter(call=>call.path.endsWith('/tasks')).length,0);assert.equal(h.elements.get('studio-input').value,'Revise this chapter.');
});

test('manual passage save carries the selected revision and preserves the original without AI or audio',async()=>{
 const h=await harness();h.api.openManualEdit();h.elements.get('studio-manual-text').value='My own exact words.\n\nIncluding this paragraph.';await h.api.saveManualEdit();
 const saves=h.calls.filter(call=>call.path.endsWith('/passage')&&call.method==='PUT');assert.equal(saves.length,1);assert.deepEqual(JSON.parse(saves[0].body),{sectionId:'a',revision:'r1',text:'My own exact words.\n\nIncluding this paragraph.'});
 assert.equal(h.book.chapters[0].passages[0].text,'My own exact words.\n\nIncluding this paragraph.');assert.equal(h.api.state.data.original,'The imported original.');assert.equal(h.api.state.data.chapters[0].passages[0].original,'Original first passage.');assert.equal(h.elements.get('studio-edit-dialog').open,false);assert.equal(h.audioCalls.length,0);assert.equal(h.calls.filter(call=>call.path.endsWith('/tasks')).length,0);assert.equal(h.elements.get('studio-undo-visible').disabled,false);
});

test('pending manual save accepts one click and failed save keeps unsent text for reopen',async()=>{
 let release;const gate=new Promise(resolve=>release=resolve);const h=await harness({httpHook:async(path,options)=>{if(path.endsWith('/passage')){await gate;return Response.json({error:'The passage changed. Reopen before saving.'},{status:409});}}});
 h.api.openManualEdit();h.elements.get('studio-manual-text').value='Unsent author wording.';const pending=h.api.saveManualEdit();await settled();await h.api.saveManualEdit();
 assert.equal(h.calls.filter(call=>call.path.endsWith('/passage')).length,1);assert.equal(h.elements.get('studio-manual-save').disabled,true);assert.equal(h.elements.get('studio-manual-text').disabled,true);
 release();await pending;assert.equal(h.elements.get('studio-edit-dialog').open,true);assert.equal(h.elements.get('studio-manual-text').value,'Unsent author wording.');assert.match(h.elements.get('studio-manual-status').textContent,/unsent text is still here/);assert.equal(h.book.chapters[0].passages[0].text,'Current first passage.');
 h.api.closeReviewDialogs();h.api.openManualEdit();assert.equal(h.elements.get('studio-manual-text').value,'Unsent author wording.');
});

test('manual drafts remain attached to the source passage and cannot overwrite a newer saved revision',async()=>{
 const h=await harness();h.api.openManualEdit();h.elements.get('studio-manual-text').value='Unsent wording for passage one.';h.api.closeReviewDialogs();h.api.selectSection('b');h.api.openManualEdit();assert.equal(h.elements.get('studio-manual-text').value,'Current second passage.');h.api.closeReviewDialogs();
 h.book.chapters[0].passages[0].revision='new-r1';h.book.chapters[0].passages[0].text='A newer saved version.';await h.api.refresh();h.api.selectSection('a');h.api.openManualEdit();assert.equal(h.elements.get('studio-manual-text').value,'Unsent wording for passage one.');assert.equal(h.elements.get('studio-manual-save').disabled,true);await h.api.saveManualEdit();assert.equal(h.calls.filter(call=>call.path.endsWith('/passage')).length,0);assert.match(h.elements.get('studio-manual-status').textContent,/changed since this unsent edit/);
});

test('late manual save completion cannot close a new manuscript editor or unlock its pending save',async()=>{
 let releaseOld,releaseNew;const oldGate=new Promise(resolve=>releaseOld=resolve),newGate=new Promise(resolve=>releaseNew=resolve);
 const other={projectId:'other',title:'Other manuscript',busy:false,original:'Other original.',chapters:[{index:1,title:'Other chapter',revision:'other-c1',passages:[{id:'other-a',revision:'other-r1',text:'Other saved words.',original:'Other original.',kind:'paragraph'}]}],notes:[],messages:[],versions:[],task:null,lastTask:null};
 const h=await harness({httpHook:async(path,options)=>{if(path==='/api/story-editor/projects/book/studio/passage'){await oldGate;return Response.json({ok:true,changed:true});}if(path==='/api/story-editor/projects/other/studio/passage'){await newGate;return Response.json({error:'Synthetic new save remains unsent.'},{status:409});}if(path==='/api/story-editor/projects/other/studio')return Response.json({ok:true,...other});}});
 h.api.openManualEdit();h.elements.get('studio-manual-text').value='Old manuscript wording.';const oldPending=h.api.saveManualEdit();await settled();
 h.listeners['story-reader-project'][0]({detail:{id:'other',busy:false}});await settled();await settled();h.api.openManualEdit();assert.equal(h.elements.get('studio-edit-dialog').open,true);assert.equal(h.elements.get('studio-manual-discard').disabled,false,'A fresh editor can discard its own unsent text after a manuscript switch');h.elements.get('studio-manual-text').value='New manuscript unsent wording.';const newPending=h.api.saveManualEdit();await settled();
 releaseOld();await oldPending;assert.equal(h.api.state.manualSaving,true);assert.equal(h.elements.get('studio-manual-save').disabled,true);assert.equal(h.elements.get('studio-edit-dialog').open,true);assert.equal(h.elements.get('studio-manual-text').value,'New manuscript unsent wording.');
 releaseNew();await newPending;assert.equal(h.api.state.manualSaving,false);assert.equal(h.elements.get('studio-manual-text').value,'New manuscript unsent wording.');
});

test('comparison displays exact source text safely and historical before/after rather than the current draft',async()=>{
 const h=await harness();const before='<img src=x onerror=alert(1)> quiet room',after='<script>alert(2)</script> warm room';h.book.chapters[0].passages[0].original=before;h.book.chapters[0].passages[0].text=after;await h.api.refresh();h.api.openComparison();await settled();
 assert.equal(content(h.elements.get('studio-compare-before')),before);assert.equal(content(h.elements.get('studio-compare-after')),after);assert.ok(h.elements.get('studio-compare-before').children.every(node=>['span','del'].includes(node.tagName)));assert.ok(h.elements.get('studio-compare-after').children.every(node=>['span','ins'].includes(node.tagName)));
 h.book.versions=[{id:'historical',sectionId:'a',instruction:'A specific old change.',createdAt:'2026-01-01',beforeText:'Old before.',afterText:'Old after.',afterRevision:'old-after',undoneAt:'2026-01-02'}];await h.api.refresh();h.api.openComparison();h.elements.get('studio-compare-source').value='historical';await h.api.renderComparison();
 assert.equal(content(h.elements.get('studio-compare-before')),'Old before.');assert.equal(content(h.elements.get('studio-compare-after')),'Old after.');assert.match(h.elements.get('studio-compare-request').textContent,/specific old change.*undone/);assert.equal(h.elements.get('studio-compare-after-label').textContent,'After this change');
});

test('stale comparison responses cannot populate another selected passage',async()=>{
 let release;const gate=new Promise(resolve=>release=resolve);const h=await harness({httpHook:async(path)=>{if(path.includes('/versions/')){await gate;return Response.json({version:{sectionId:'a',beforeText:'Old request before.',afterText:'Old request after.',instruction:'Old request'}});}}});
 h.api.openComparison();h.elements.get('studio-compare-source').value='delayed';const pending=h.api.renderComparison();h.api.closeReviewDialogs();h.api.selectSection('b');h.api.openComparison();await settled();release();await pending;
 assert.equal(content(h.elements.get('studio-compare-before')),'Original second passage.');assert.equal(content(h.elements.get('studio-compare-after')),'Current second passage.');
});

test('save status compares the approved book source revision with current chapter revision',async()=>{
 const h=await harness();h.api.state.data.bookDrafts={book:{chapters:[{sourceProjectId:'book',sourceChapterIndex:1,sourceRevision:'chapter-r1',version:2}]}};h.api.renderSaveStatus();assert.match(h.elements.get('studio-save-status').textContent,/Book version 2 · Up to date/);
 h.api.state.data.chapters[0].revision='edited-chapter';h.api.renderSaveStatus();assert.match(h.elements.get('studio-save-status').textContent,/Changed since saved version/);h.api.state.original=true;h.api.renderSaveStatus();assert.match(h.elements.get('studio-save-status').textContent,/Imported original/);
});

test('a starting whole-manuscript request suppresses duplicate submit and unlocks on its result',async()=>{
 const h=await harness();h.api.state.requestMode='edit';h.api.state.scope='book';h.elements.get('studio-input').value='Develop the emotional arc.';
 await h.api.submitComposer();await h.api.submitComposer();assert.equal(h.dispatched.filter(event=>event.type==='story-author-request').length,1);assert.equal(h.api.state.requestStarting,true);assert.equal(h.elements.get('studio-send').disabled,true);assert.equal(h.elements.get('studio-edit-text').disabled,true);
 for(const listener of h.listeners['story-author-request-result'])listener({detail:{projectId:'book',started:false,message:'Could not start; try again.',busy:false}});
 assert.equal(h.api.state.requestStarting,false);assert.equal(h.elements.get('studio-send').disabled,false);assert.equal(h.elements.get('studio-input').value,'Develop the emotional arc.');
});

test('manual editing an empty passage is rejected locally without losing the unsent field',async()=>{
 const h=await harness();h.api.openManualEdit();h.elements.get('studio-manual-text').value=' \n ';await h.api.saveManualEdit();assert.equal(h.calls.filter(call=>call.path.endsWith('/passage')).length,0);assert.match(h.elements.get('studio-manual-status').textContent,/Keep some text/);assert.equal(h.elements.get('studio-edit-dialog').open,true);assert.equal(h.elements.get('studio-manual-text').value,' \n ');
});

test('completed revision details collapse by default and remain available through the explicit toggle',async()=>{
 const h=await harness();h.api.state.flowJob={id:'completed-one',status:'completed',phase:'review',completedChunks:4,totalChunks:4};h.api.renderEditorialProgress();
 assert.equal(h.elements.get('notebook-job-progress').hidden,true);assert.equal(h.elements.get('notebook-progress-toggle').hidden,false);assert.equal(h.elements.get('notebook-progress-toggle').attributes['aria-expanded'],'false');
 h.elements.get('notebook-progress-toggle').events.click[0]();assert.equal(h.elements.get('notebook-job-progress').hidden,false);assert.equal(h.elements.get('notebook-progress-toggle').attributes['aria-expanded'],'true');assert.match(h.elements.get('revision-tracker-title').textContent,/ready for your review/);
 h.api.renderEditorialProgress();assert.equal(h.elements.get('notebook-job-progress').hidden,false,'refresh does not discard the author’s expansion for the same job');
 h.elements.get('notebook-progress-toggle').events.click[0]();assert.equal(h.elements.get('notebook-job-progress').hidden,true);
});

test('running, paused and failed revision progress remains visible without a collapse control',async()=>{
 const h=await harness();for(const job of [{id:'running',status:'running',phase:'editing'},{id:'paused',status:'paused',phase:'paused'},{id:'failed',status:'failed',phase:'planning',error:'Synthetic failure'}]){
  h.api.state.flowJob={completedChunks:2,totalChunks:5,...job};h.api.renderEditorialProgress();assert.equal(h.elements.get('notebook-job-progress').hidden,false,job.status);assert.equal(h.elements.get('notebook-progress-toggle').hidden,true,job.status);assert.equal(h.elements.get('revision-tracker-count').textContent,'2');
 }
 assert.equal(h.elements.get('revision-tracker-detail').textContent,'Synthetic failure');
});

test('a different completed job starts collapsed and absent progress hides both details and toggle',async()=>{
 const h=await harness();h.api.state.flowJob={id:'first',status:'completed',phase:'review'};h.api.renderEditorialProgress();h.elements.get('notebook-progress-toggle').events.click[0]();
 h.api.state.flowJob={id:'second',status:'completed',phase:'review'};h.api.renderEditorialProgress();assert.equal(h.elements.get('notebook-job-progress').hidden,true);assert.equal(h.elements.get('notebook-progress-toggle').attributes['aria-expanded'],'false');
 h.api.state.flowJob=null;h.api.renderEditorialProgress();assert.equal(h.elements.get('notebook-job-progress').hidden,true);assert.equal(h.elements.get('notebook-progress-toggle').hidden,true);
});

test('an old manual save cannot erase newer unsent recovery after returning to the same passage',async()=>{
 let release;const gate=new Promise(resolve=>release=resolve);
 const h=await harness({httpHook:async(path)=>{if(path==='/api/story-editor/projects/book/studio/passage'){await gate;return Response.json({ok:true,changed:true});}}});
 h.api.openManualEdit();h.elements.get('studio-manual-text').value='Submitted wording from the old visit.';const pending=h.api.saveManualEdit();await settled();
 h.listeners['story-reader-project'][0]({detail:{id:'',busy:false}});await settled();h.listeners['story-reader-project'][0]({detail:{id:'book',busy:false}});await settled();await settled();
 h.api.openManualEdit();assert.equal(h.elements.get('studio-manual-text').value,'Submitted wording from the old visit.');h.elements.get('studio-manual-text').value='New unsent wording after returning.';h.elements.get('studio-manual-text').events.input[0]();
 const storageKey='johnny-story-manual:book:a';assert.equal(JSON.parse(h.navigationStore.get(storageKey)).text,'New unsent wording after returning.');
 release();await pending;
 assert.equal(h.elements.get('studio-edit-dialog').open,true);assert.equal(h.elements.get('studio-manual-text').value,'New unsent wording after returning.');assert.equal(h.api.state.manualSaving,false);
 assert.equal(JSON.parse(h.navigationStore.get(storageKey)).text,'New unsent wording after returning.','Old save completion must preserve the recovery copy of newer unsent work');
});
