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
async function harness({gate,failed=false,bookmark=null,audioFetcher,proposal=false,bookGate,bookFailure=false,httpHook}={}){
 const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 elements.get('studio-readback').checked=true;
 let bookStore={books:[],book:null};let bookSaves=0;const savedVersions=[];
 const book={projectId:'book',title:'Local story',busy:false,original:'The imported original.',chapters:[{index:1,title:'One',revision:'chapter-r1',passages:[{id:'a',text:'Current first passage.',original:'Original first passage.',revision:'r1',kind:'paragraph'},{id:'b',text:'Current second passage.',original:'Original second passage.',revision:'r2',kind:'paragraph'}]}],notes:[],messages:[],versions:[],bookmark,task:null,lastTask:null};
 const calls=[],audioCalls=[];let accepted=false;
 const fetcher=async(url,options={})=>{
  const path=new URL(url).pathname;calls.push({path,method:options.method,body:options.body});if(httpHook){const override=await httpHook(path,options,book);if(override)return override;}
  if(path.endsWith('/book/link')){const body=JSON.parse(options.body);bookStore={books:[{id:body.bookId||'saved-book',title:body.title||'Existing book'}],book:{id:body.bookId||'saved-book',title:body.title||'Existing book',revision:1,useContinuity:true,chapters:[]}};book.bookDrafts=bookStore;return Response.json(bookStore);}
  if(path.endsWith('/book/chapters')&&options.method==='POST'){bookSaves++;if(bookGate)await bookGate;if(bookFailure)return Response.json({error:'Storage busy. Nothing was saved.'},{status:409});if(!bookStore.book.chapters.length){bookStore.book.revision++;bookStore.book.chapters.push({id:'chapter1',position:1,title:'One',versionId:'saved-v1',version:1,savedAt:'2026-01-01',sourceProjectId:'book',sourceChapterIndex:1});savedVersions.push({id:'saved-v1',number:1,savedAt:'2026-01-01'});}book.bookDrafts=bookStore;return Response.json(bookStore);}
  if(path.endsWith('/book/chapters/chapter1'))return Response.json({chapterId:'chapter1',title:'One',approvedVersionId:'saved-v1',versionId:'saved-v1',version:1,savedAt:'2026-01-01',versions:savedVersions,content:{title:'One',passages:[{text:'A complete saved chapter.'}]}});
  if(path.endsWith('/book'))return Response.json(bookStore);
  if(path.endsWith('/studio/tasks')&&options.method==='POST'){accepted=true;book.task={id:'task1',status:'running',phase:'drafting'};return Response.json({ok:true,task:book.task},{status:202});}
  if(path.endsWith('/tasks/task1')){
   if(gate)await gate;
   book.task=null;
   if(failed)return Response.json({ok:true,task:{id:'task1',status:'failed',error:'The critique could not finish.'}});
   if(proposal)return Response.json({ok:true,task:{id:'task1',status:'done',result:{action:'revise_book',reply:'Review and apply this whole-manuscript change.',request:'Deepen the whole novel.',requiresConfirmation:true}}});
   book.chapters[0].passages[0].text='The critically refined passage.';book.chapters[0].passages[0].revision='r3';book.versions=[{id:'v1',sectionId:'a',instruction:'Deepen it.',createdAt:'2026-01-01'}];
   return Response.json({ok:true,task:{id:'task1',status:'done',result:{action:'revise',sectionId:'a',reply:'Saved the deeper passage.'}}});
  }
  if(path.endsWith('/studio'))return Response.json({ok:true,...book,...(proposal&&accepted?{lastTask:{id:'task1',status:'done',result:{action:'revise_book',request:'Deepen the whole novel.',requiresConfirmation:true}}}:{})});
  return Response.json({ok:true});
 };
 class Voice {constructor(options){this.options=options;this.connected=false;this.interrupts=0;}interrupt(){this.interrupts++;}close(){}updateContext(){}async connect(){this.connects=(this.connects||0)+1;}}
 const listeners={},windowListeners={};const dispatched=[];const document={cookie:'',getElementById:id=>elements.get(id),createElement:tag=>new Element(tag),addEventListener(type,fn){(listeners[type]||=[]).push(fn);},dispatchEvent(event){dispatched.push(event);for(const fn of listeners[event.type]||[])fn(event);}};
 const sandbox={document,window:{JOHNNY_CHAT_API_BASE_URL:'http://local.test',addEventListener(type,fn){(windowListeners[type]||=[]).push(fn);}},location:{origin:'http://local.test'},URL,URLSearchParams,AbortController,AbortSignal,Blob,Response,crypto:{randomUUID},requestAnimationFrame:fn=>fn(),matchMedia:()=>({matches:true}),setTimeout,clearTimeout,fetch:fetcher,speechParts,notebookJourney,notebookReference,editorialQualityLabel,renderRevisionTracker,StudioVoice:Voice,chapterAudio:async(url,options)=>{audioCalls.push({url,options});return audioFetcher?audioFetcher(url,options):new Blob(['fake local audio']);},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}}};
 const context=vm.createContext(sandbox);vm.runInContext(source+'\nthis.testStudio={state,refresh,sendRequest,pause,selectSection,voice,read,resetWorkspace,renderNotebook,bookAction,saveChapter,setBookOpen,renderBookDrafts,openSavedChapter,playPart,checkAccess,requireUnlock,saveBookmark,api,resumeTask};',context);const api=context.testStudio;api.state.id='book';await api.refresh({initial:true});
 return {api,elements,calls,audioCalls,book,dispatched,listeners,windowListeners,accepted:()=>accepted,bookSaves:()=>bookSaves};
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
test('Pause unlocks Read and an old pending response cannot start playback after a new attempt',async()=>{
 let release;const gate=new Promise(r=>release=r);let count=0;const h=await harness({audioFetcher:async()=>{if(++count===1)await gate;return new Blob(['fake audio']);}});
 const first=h.api.read();h.elements.get('studio-pause').events.click[0]();assert.equal(h.elements.get('studio-read').disabled,false);assert.equal(h.audioCalls[0].options.signal.aborted,true);
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
 h.elements.get('book-name').value='My assembled book';h.elements.get('book-create-form').events.submit[0]({preventDefault(){}});await new Promise(r=>setImmediate(r));assert.equal(h.bookSaves(),1);assert.equal(h.elements.get('book-save-chapter').disabled,true);await h.api.bookAction(h.api.saveChapter);assert.equal(h.bookSaves(),1);release();await new Promise(r=>setImmediate(r));assert.equal(h.api.state.data.bookDrafts.book.chapters.length,1);assert.equal(h.api.state.bookSaving,false);assert.match(h.elements.get('book-drafts-status').textContent,/Chapter saved/);assert.equal(h.book.original,'The imported original.');
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
