import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {createWritingStudio,installWritingStudio,studioRevision,STUDIO_FORMAT,STUDIO_INSTRUCTIONS} from '../lib/writing-studio.mjs';
import {createLayeredStudioEditor,STUDIO_QUALITY} from '../lib/studio-editor.mjs';
const result=(text='A deeper revised passage.')=>({action:'revise',reply:'I developed the emotional conflict without changing the scene’s outcome.',revisionText:text,note:'',chapter:0,passage:0});
function fixture(t,generate=async()=>result(),options={}){
 const dir=mkdtempSync(tmpdir()+'/writing-studio-'),path=dir+'/story.sqlite';
 const db=new DatabaseSync(path);
 db.exec(`CREATE TABLE story_projects(id TEXT PRIMARY KEY,title TEXT,filename TEXT,user_intent TEXT,created_at TEXT,updated_at TEXT);
 CREATE TABLE story_sections(id TEXT PRIMARY KEY,project_id TEXT,chapter_index INTEGER,scene_index INTEGER,paragraph_index INTEGER,line_index INTEGER,kind TEXT,label TEXT,original_text TEXT,edited_text TEXT,summary TEXT,preserve_verbatim INTEGER,updated_at TEXT);
 CREATE TABLE story_chapter_names(project_id TEXT,chapter_index INTEGER,title TEXT);
 CREATE TABLE story_original_snapshots(project_id TEXT PRIMARY KEY,sections_json TEXT);
 CREATE TABLE story_autopilot_jobs(id TEXT PRIMARY KEY,project_id TEXT,status TEXT,plan_json TEXT,created_at TEXT);
 CREATE TABLE story_bible(project_id TEXT,characters TEXT,settings TEXT,timeline TEXT,plot_threads TEXT,tone_rules TEXT,continuity_notes TEXT);
 INSERT INTO story_projects VALUES('book','The Letter','letter.txt','Preserve her quiet voice.','2026-01-01','2026-01-01'),('other','Other book','other.txt','','2026-01-01','2026-01-01');
 INSERT INTO story_sections VALUES('a','book',1,1,1,0,'paragraph','First passage','Original first passage.','Current first passage.','A letter arrives.',0,'2026-01-01'),('b','book',1,1,2,0,'paragraph','Second passage','Original second passage.',NULL,'She hesitates.',0,'2026-01-01'),('c','book',2,1,1,0,'paragraph','Another chapter','Chapter two original.',NULL,'He leaves.',0,'2026-01-01'),('z','other',1,1,1,0,'paragraph','Other','PRIVATE_OTHER_BOOK',NULL,'',0,'2026-01-01');
 INSERT INTO story_chapter_names VALUES('book',1,'The Letter'),('book',2,'Departure');`);
 const studio=createWritingStudio({path,generate,...options});studio.init();
 t.after(()=>{studio.stop();db.close();rmSync(dir,{recursive:true,force:true});});
 const request=(id='request-1',message='Deepen her hesitation.')=>({requestId:id,sectionId:'a',revision:studioRevision('Current first passage.'),message});
 return {db,path,studio,request};
}
test('original, current draft, conversation, notes, and bookmark stay distinct and manuscript scoped',t=>{
 const {studio,request}=fixture(t);let snap=studio.snapshot('book');assert.equal(snap.chapters[0].passages[0].text,'Current first passage.');assert.equal(snap.chapters[0].passages[0].original,'Original first passage.');assert.match(snap.original,/Original first/);assert.ok(!snap.original.includes('Current first'));
 studio.note('book','She has never opened the letter.');studio.note('book','She has never opened the letter.');studio.message('book','user','I want her fear to stay understated.','m1');studio.bookmark('book',{sectionId:'a',revision:request().revision,part:0,seconds:12});
 snap=studio.snapshot('book');assert.equal(snap.notes.length,1);assert.equal(snap.messages.length,1);assert.equal(snap.bookmark.seconds,12);assert.equal(studio.snapshot('other').notes.length,0);assert.equal(studio.snapshot('other').messages.length,0);
 assert.ok(!JSON.stringify(studio.context('book','a',true)).includes('PRIVATE_OTHER_BOOK'));assert.equal(studio.context('book','a').selection.passage,1);assert.equal(studio.context('book','a').navigation.length,2);
 assert.throws(()=>studio.message('other','user','collision','m1'),/already in use/);
});
test('explicit edit is idempotent, saves history atomically, and undo preserves the import',async t=>{
 let calls=0;const {studio,db,request}=fixture(t,async()=>{calls++;return result();});
 const first=studio.start('book',request());assert.equal(first.status,'queued');assert.equal(studio.start('book',request()).id,first.id);
 await studio.tick();assert.equal(calls,1);assert.equal(studio.task('book',first.id).status,'done');assert.equal(db.prepare("SELECT original_text FROM story_sections WHERE id='a'").get().original_text,'Original first passage.');
 assert.equal(studio.snapshot('book').versions.length,1);assert.equal(studio.start('book',request()).status,'done');assert.equal(calls,1);
 studio.undo('book',{sectionId:'a',revision:studioRevision('A deeper revised passage.')});assert.equal(studio.snapshot('book').chapters[0].passages[0].text,'Current first passage.');assert.ok(studio.snapshot('book').versions[0].undoneAt);
 assert.equal(db.prepare("SELECT original_text FROM story_sections WHERE id='a'").get().original_text,'Original first passage.');
});
test('stale selection, protected passages, and active full-book edits reject before generation',async t=>{
 let calls=0;const {studio,db,request}=fixture(t,async()=>{calls++;return result();});
 assert.throws(()=>studio.start('book',{...request(),revision:'old'}),/changed/);
 db.prepare("UPDATE story_sections SET preserve_verbatim=1 WHERE id='a'").run();assert.throws(()=>studio.start('book',request()),/preservation/);db.prepare("UPDATE story_sections SET preserve_verbatim=0 WHERE id='a'").run();
 db.prepare("INSERT INTO story_autopilot_jobs VALUES('full','book','running','{}','2026-01-01')").run();assert.throws(()=>studio.start('book',request()),/full edit is running/);assert.equal(calls,0);
});
test('late model results cannot overwrite newer prose or changed chapter context',async t=>{
 let release;const gate=new Promise(r=>release=r);const {studio,db,request}=fixture(t,async()=>{await gate;return result();});studio.start('book',request());const running=studio.tick();await Promise.resolve();
 db.prepare("UPDATE story_sections SET edited_text='A newer author change.' WHERE id='b'").run();release();await running;
 assert.equal(studio.task('book','request-1').status,'failed');assert.equal(studio.snapshot('book').versions.length,0);assert.equal(studio.snapshot('book').chapters[0].passages[0].text,'Current first passage.');assert.equal(studio.snapshot('book').chapters[0].passages[1].text,'A newer author change.');
});
test('cancellation frees the worker, fences late results, and makes no automatic retry',async t=>{
 let release,calls=0;const gate=new Promise(r=>release=r);const {studio,request}=fixture(t,async()=>{calls++;await gate;return result();});studio.start('book',request());const running=studio.tick();await Promise.resolve();studio.cancel('book','request-1');await running;release();await Promise.resolve();
 assert.equal(studio.task('book','request-1').status,'cancelled');assert.equal(studio.snapshot('book').versions.length,0);await studio.tick();assert.equal(calls,1);
});
test('layered maximum-quality editing checkpoints passes and explicit retry resumes without repeating them',async t=>{
 const calls=[];let failReview=true;
 const editor=createLayeredStudioEditor({decisionFormat:STUDIO_FORMAT,instructions:STUDIO_INSTRUCTIONS,call:async request=>{
  calls.push(request);const name=request.text.format.name;
  if(name==='writing_studio_turn')return {...result(),note:'Preserve the decision while deepening her competing desire.',revisionText:''};
  if(name==='studio_draft')return {text:'A first literary candidate.',craftNotes:'Developed subtext.'};
  if(name==='studio_critique'){if(failReview){failReview=false;throw Error('simulated interruption');}return {strengths:['Specific action'],issues:['Make the choice clearer'],continuityRisks:[],authorIntentFit:'Aligned'};}
  return {text:'The final, critically refined passage.',craftNotes:'Her hesitation now arises from a specific competing desire.'};
 }});
 const {studio,request,db}=fixture(t,editor);studio.start('book',request());await studio.tick();assert.equal(studio.task('book','request-1').status,'failed');assert.equal(db.prepare('SELECT count(*) AS n FROM studio_task_stages').get().n,2);assert.equal(studio.snapshot('book').versions.length,0);
 studio.start('book',{...request(),retry:true});await studio.tick();assert.equal(studio.task('book','request-1').status,'done');
 assert.deepEqual(calls.map(c=>c.text.format.name),['writing_studio_turn','studio_draft','studio_critique','studio_critique','studio_final']);
 for(const c of calls){assert.equal(c.model,'gpt-6.1-sol');assert.deepEqual(c.reasoning,{effort:'xhigh',mode:'pro'});assert.ok(c.max_output_tokens>=32768);}
 assert.equal(studio.snapshot('book').versions.length,1);assert.equal(studio.task('book','request-1').result.quality.mode,'pro');
});
test('a restart retains completed work and marks an expired running task failed without regenerating',async t=>{
 const {studio,path,db,request}=fixture(t);studio.start('book',request());await studio.tick();
 const restarted=createWritingStudio({path,generate:()=>assert.fail('must not regenerate')});restarted.init();assert.equal(restarted.task('book','request-1').status,'done');
 db.prepare("INSERT INTO studio_tasks(id,project_id,section_id,revision,message,source_revision,status,owner,lease_until,created_at,updated_at) VALUES('interrupted','other','z','old','request','old','running','old-process',0,'2026-01-01','2026-01-01')").run();
 assert.equal(restarted.task('other','interrupted').status,'failed');await restarted.tick();restarted.stop();
});
test('discussion never changes text, while failed/empty prose creates no version',async t=>{
 const {studio,request}=fixture(t,async()=>({...result(),action:'discuss',reply:'We could make the silence carry the disagreement.'}));studio.start('book',request());await studio.tick();assert.equal(studio.snapshot('book').versions.length,0);assert.equal(studio.task('book','request-1').status,'done');
 const failed=fixture(t,async()=>result(''));failed.studio.start('book',failed.request());await failed.studio.tick();assert.equal(failed.studio.task('book','request-1').status,'failed');assert.equal(failed.studio.snapshot('book').versions.length,0);
});
test('narration resolves exact saved passage text, rejects stale revisions, and isolates chapters',async t=>{
 const {studio,request}=fixture(t);const spec=studio.speech('book',{sectionId:'a',revision:request().revision,part:0});assert.equal(spec.text,'Current first passage.');assert.ok(!spec.text.includes('Original first'));assert.throws(()=>studio.speech('other',{sectionId:'a',revision:request().revision,part:0}),/Choose a current passage/);
 studio.start('book',request());await studio.tick();assert.throws(()=>studio.speech('book',{sectionId:'a',revision:request().revision,part:0}),/changed/);
});
function harness(t){
 const {path}=fixture(t);const routes=new Map();const app=Object.fromEntries(['get','post','put','delete'].map(method=>[method,(path,handler)=>routes.set(method+' '+path,handler)]));let generated=0,voiceCalls=0,speechCalls=0,readyCalls=0;
 const studio=installWritingStudio(app,{path,ready:async()=>{readyCalls++;},authorize:(req,res)=>req.authorized|| (res.status(401).json({error:'Private access required'}),false),generate:async()=>{generated++;return result();},createVoice:async(instructions,tools)=>{voiceCalls++;assert.match(instructions,/configured deep literary editing workflow/);assert.ok(tools.some(t=>t.name==='edit_passage'));assert.ok(tools.some(t=>t.name==='edit_manuscript'));return {value:'synthetic-ephemeral',model:'voice-test',realtimeUrl:'https://example.test/calls'};},createSpeech:async text=>{speechCalls++;assert.equal(text,'Current first passage.');return Buffer.from('ID3-local');}});t.after(()=>studio.stop());
 return {routes,counts:()=>({generated,voiceCalls,speechCalls,readyCalls}),async run(method,suffix,{authorized=true,body={},query={},headers={}}={}){const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.statusCode=c;return this;},json(body){this.body=body;return this;},type(t){this.contentType=t;return this;},send(body){this.body=body;return this;}};await routes.get(method+' /api/story-editor/projects/:id/studio'+suffix)({method:method.toUpperCase(),params:{id:'book',taskId:'request-1'},authorized,body,query,headers},res);return res;}};
}
test('all collaboration routes authenticate before initializing storage or invoking a provider',async t=>{
 const h=harness(t);for(const [key,handler] of h.routes){const res={status(){return this;},json(){return this;},setHeader(){}};await handler({authorized:false},res);}
 assert.deepEqual(h.counts(),{generated:0,voiceCalls:0,speechCalls:0,readyCalls:0});
});
test('live session is explicit, context is project scoped, and GET polling never starts narration',async t=>{
 const h=harness(t),query={sectionId:'a',revision:studioRevision('Current first passage.'),part:'0'};
 assert.equal((await h.run('get','/speech',{query})).statusCode,404);assert.equal(h.counts().speechCalls,0);
 assert.equal((await h.run('post','/voice',{body:{sectionId:'a',revision:'old'}})).statusCode,409);assert.equal(h.counts().voiceCalls,0);
 const context=await h.run('get','/context',{query:{sectionId:'a'}});assert.ok(!context.body.instructions.includes('PRIVATE_OTHER_BOOK'));assert.equal(h.counts().voiceCalls,0);
 assert.equal((await h.run('post','/voice',{body:{sectionId:'a',revision:query.revision}})).statusCode,200);assert.equal(h.counts().voiceCalls,1);
 const start=await h.run('post','/speech',{body:{...query,part:0}});assert.equal(start.statusCode,202);await new Promise(r=>setImmediate(r));const ready=await h.run('get','/speech',{query});assert.equal(ready.contentType,'audio/wav');assert.equal(h.counts().speechCalls,1);
});

test('discussion-only deep thinking cannot be turned into a draft mutation by model output',async t=>{
 const {studio,request}=fixture(t,async()=>result('An unauthorized revision.'));studio.start('book',{...request(),mode:'discuss'});await studio.tick();assert.equal(studio.task('book','request-1').status,'failed');assert.equal(studio.snapshot('book').versions.length,0);assert.equal(studio.snapshot('book').chapters[0].passages[0].text,'Current first passage.');
});
test('ordinary-book deep context includes all saved chapters; live voice gets only bounded selected context',t=>{
 const {studio}=fixture(t);assert.ok(studio.context('book','a',true).fullManuscript.some(p=>p.text==='Chapter two original.'));assert.equal(studio.context('book','a').fullManuscript.length,0);assert.equal(studio.context('book','a').navigation[1].title,'Departure');
});
test('long-book reading uses source hashes and reuses unchanged continuity notes across requests',async t=>{
 let reads=0;const formats=[];
 const editor=createLayeredStudioEditor({decisionFormat:STUDIO_FORMAT,instructions:STUDIO_INSTRUCTIONS,call:async request=>{
  const name=request.text.format.name;formats.push(name);
  if(name==='studio_source_ledger'){reads++;return {events:['A source-grounded event.'],characters:['Mara has a conflicting desire.'],openThreads:[],voice:'Quiet, specific.'};}
  return {...result(),action:'discuss',reply:'The hesitation needs a concrete competing desire.'};
 }});
 const {studio,db,request}=fixture(t,editor);db.prepare("UPDATE story_sections SET original_text=? WHERE id='c'").run('A source sentence. '.repeat(30000));
 const context=studio.context('book','a',true);assert.ok(context.manuscriptChunks.length>1);assert.equal(context.fullManuscript.length,0);
 studio.start('book',request());await studio.tick();assert.equal(studio.task('book','request-1').status,'done');const firstReads=reads;assert.ok(firstReads>1);
 studio.start('book',request('request-2','What motivates her?'));await studio.tick();assert.equal(studio.task('book','request-2').status,'done');assert.equal(reads,firstReads,'Unchanged source notes must not cause repeated reading charges');assert.equal(formats.at(-1),'writing_studio_turn');
});
test('paused narration supplies a server-resolved fragment to the deep editor',async t=>{
 const {studio,request}=fixture(t);studio.start('book',{...request(),cursor:{part:0,seconds:7}});const context=studio.context('book','a',true);assert.equal(context.listeningPosition.fragment,'Current first passage.');assert.equal(context.listeningPosition.seconds,7);
});
test('unsupported maximum-quality execution fails explicitly without a fallback model or a saved edit',async t=>{
 let calls=0;const editor=createLayeredStudioEditor({decisionFormat:STUDIO_FORMAT,instructions:STUDIO_INSTRUCTIONS,call:async request=>{calls++;assert.equal(request.model,STUDIO_QUALITY.model);throw Object.assign(Error('Maximum-quality execution unavailable.'),{status:502});}});
 const {studio,request}=fixture(t,editor);studio.start('book',request());await studio.tick();assert.equal(calls,1);assert.equal(studio.task('book','request-1').status,'failed');assert.equal(studio.snapshot('book').versions.length,0);
});

test('the whole-manuscript goal and exact working position survive restarting the studio',t=>{
 const {studio,path}=fixture(t);studio.goal('book','A finished literary novel for adult readers, with a quiet voice.');
 studio.bookmark('book',{sectionId:'b',revision:studioRevision('Original second passage.'),part:0,seconds:9});
 const restored=createWritingStudio({path,generate:()=>assert.fail('opening a project must not generate')});restored.init();
 const snap=restored.snapshot('book');assert.equal(snap.goal,'A finished literary novel for adult readers, with a quiet voice.');assert.equal(snap.bookmark.sectionId,'b');assert.equal(snap.bookmark.seconds,9);assert.equal(snap.bookmark.revision,studioRevision('Original second passage.'));
 assert.equal(restored.context('book','b',true).manuscriptGoal,snap.goal);assert.equal(restored.snapshot('other').goal,'');restored.stop();
});
test('manuscript goals cannot change halfway through an edit, and the mission is whole-story collaboration',t=>{
 const {studio,request}=fixture(t);studio.start('book',request());assert.throws(()=>studio.goal('book','A screenplay.'),/Finish or stop/);
 assert.match(STUDIO_INSTRUCTIONS,/entire uploaded story/);assert.match(STUDIO_INSTRUCTIONS,/author decides/);assert.match(STUDIO_INSTRUCTIONS,/one passage earlier/);
});

test('whole-manuscript revision becomes a durable proposal, never a silent one-passage write',async t=>{
 let input;const {studio,request}=fixture(t,async context=>{input=context;return {...result(),action:'revise_book',reply:'I can apply this across the manuscript. Review the request and apply it when ready.'};});
 studio.start('book',{...request('book-request','Develop the emotional arc across the entire novel.'),scope:'book'});await studio.tick();
 const task=studio.task('book','book-request');assert.equal(task.status,'done');assert.equal(task.result.action,'revise_book');assert.equal(task.result.request,'Develop the emotional arc across the entire novel.');assert.equal(task.result.requiresConfirmation,true);
 assert.equal(input.requestScope,'book');assert.equal(studio.snapshot('book').versions.length,0);assert.equal(studio.snapshot('book').chapters[0].passages[0].text,'Current first passage.');assert.equal(studio.snapshot('book').lastTask.result.request,task.result.request);
 assert.throws(()=>studio.start('book',{...request('book-request','Develop the emotional arc across the entire novel.'),scope:'passage'}),/already in use/);
});
test('whole-manuscript scope rejects a model that tries to overwrite only the selected passage',async t=>{
 const {studio,request}=fixture(t);studio.start('book',{...request(),scope:'book'});await studio.tick();assert.equal(studio.task('book','request-1').status,'failed');assert.match(studio.task('book','request-1').error,/whole-manuscript/);assert.equal(studio.snapshot('book').versions.length,0);
});
test('book proposals use one maximum-quality planning call and cannot trigger downstream prose passes',async()=>{
 const calls=[];const editor=createLayeredStudioEditor({instructions:STUDIO_INSTRUCTIONS,decisionFormat:STUDIO_FORMAT,call:async body=>{calls.push(body);return {...result(),action:'revise_book'};}});
 const output=await editor({requestScope:'book'},new AbortController().signal);assert.equal(output.action,'revise_book');assert.equal(calls.length,1);assert.equal(calls[0].model,'gpt-6.1-sol');assert.deepEqual(calls[0].reasoning,{effort:'xhigh',mode:'pro'});
 const broken=createLayeredStudioEditor({instructions:STUDIO_INSTRUCTIONS,decisionFormat:STUDIO_FORMAT,call:async()=>result()});await assert.rejects(broken({requestScope:'book'},new AbortController().signal),/whole-manuscript/);
});

test('long editorial requests, goals, and context survive storage/restart without clipping',async t=>{
 const text=process.env.STORY_PROMPT_FIXTURE?readFileSync(process.env.STORY_PROMPT_FIXTURE,'utf8'):'  Keep detail.\n'.repeat(900)+'FINAL INSTRUCTION  ';
 let delivered;const {studio,path,request}=fixture(t,async input=>{delivered=input;return {...result(),action:'discuss'};});
 studio.goal('book',text);assert.equal(studio.snapshot('book').goal,text);
 studio.start('book',request('long-request',text));await studio.tick();assert.equal(delivered.request,text);assert.equal(delivered.manuscriptGoal,text);assert.equal(studio.snapshot('book').messages[0].text,text);assert.equal(studio.context('book','a',true).history[0].text,text);
 const reload=createWritingStudio({path,generate:async()=>assert.fail()});reload.init();assert.equal(reload.snapshot('book').goal,text);assert.equal(reload.snapshot('book').messages[0].text,text);reload.stop();
 assert.throws(()=>studio.goal('book','é'.repeat(50001)),e=>e.status===413);assert.equal(studio.snapshot('book').goal,text);
 assert.throws(()=>studio.start('book',request('oversized','é'.repeat(50001))),e=>e.status===413);
});

test('narration voice and Unicode delivery directions isolate cached audio; invalid settings never call provider',async t=>{
 const h=harness(t),body={sectionId:'a',revision:studioRevision('Current first passage.'),part:0};
 const run=async settings=>{const headers={'x-story-narration':Buffer.from(JSON.stringify(settings)).toString('base64')};const start=await h.run('post','/speech',{body,headers});assert.equal(start.statusCode,202);await new Promise(r=>setImmediate(r));assert.equal((await h.run('get','/speech',{query:{...body,part:'0'},headers})).statusCode,200);};
 await run({voice:'marin',direction:'Whisper.'});await run({voice:'cedar',direction:'Whisper.'});await run({voice:'cedar',direction:'轻声叙述。'});assert.equal(h.counts().speechCalls,3);
 const bad=await h.run('post','/speech',{body:{...body,narration:{voice:'not-a-voice'}}});assert.equal(bad.statusCode,400);assert.equal(h.counts().speechCalls,3);
});

test('original tree chapters come from the immutable upload snapshot despite later revised structure',t=>{
 const {studio,db}=fixture(t);const original=[{kind:'chapter',chapter_index:1,original_text:'Imported opening'},{kind:'paragraph',chapter_index:1,original_text:'The immutable opening.'},{kind:'chapter',chapter_index:2,original_text:'Imported ending'},{kind:'paragraph',chapter_index:2,original_text:'The immutable ending.'}];db.prepare('INSERT INTO story_original_snapshots VALUES(?,?)').run('book',JSON.stringify(original));db.prepare("UPDATE story_sections SET original_text='Later split source',edited_text='Later working revision' WHERE id='a'").run();const before=db.prepare('SELECT sections_json FROM story_original_snapshots WHERE project_id=?').get('book').sections_json;const snapshot=studio.snapshot('book');assert.equal(snapshot.originalChapters.length,2);assert.equal(snapshot.originalChapters[0].title,'Imported opening');assert.match(snapshot.originalChapters[0].text,/immutable opening/);assert.ok(!snapshot.originalChapters[0].text.includes('Later working'));assert.equal(snapshot.chapters[0].passages[0].text,'Later working revision');assert.equal(db.prepare('SELECT sections_json FROM story_original_snapshots WHERE project_id=?').get('book').sections_json,before);
});
