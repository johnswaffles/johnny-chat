import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const testDir=await mkdtemp(tmpdir()+'/story-editor-test-');
function fixtureDb(options={}){const d=new DatabaseSync(testDir+'/story.sqlite',options);d.exec('PRAGMA busy_timeout=5000');return d;}
const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const origin=`http://127.0.0.1:${port}`;
function sample(schema) {
 if(schema.enum) return schema.enum[0];
 if(schema.type==='object') return Object.fromEntries(Object.entries(schema.properties).map(([k,v])=>[k,sample(v)]));
 if(schema.type==='array') return [];
 if(schema.type==='boolean') return true;
 if(schema.type==='integer') return 1;
 return 'Local test editorial note.';
}
let providerSequence=0;
const fakeResponse=data=>({id:'resp_local_'+(++providerSequence),model:'gpt-6.1-sol',object:'response',...data});
const requests=[];
const speechRequests=[];
const studioVoiceRequests=[];
let resumeBudgetFailures=0;
let releaseSpeech;
let speechGate = new Promise(resolve => releaseSpeech=resolve);
const truncatedStages=new Set();
const pendingResponses=new Map();let cancellationCalls=0;
let pauseResponseStarted=false;
const mock=http.createServer(async(req,res)=>{
 if(req.method==='POST'&&/^\/v1\/responses\/[^/]+\/cancel$/.test(req.url)){const id=req.url.split('/').at(-2);const item=pendingResponses.get(id);cancellationCalls++;if(item)item.status='cancelled';res.writeHead(item?200:404,{'Content-Type':'application/json'});res.end(JSON.stringify(item||{error:{message:'Not found'}}));return;}
 if(req.method==='GET'&&req.url.startsWith('/v1/responses/')){const item=pendingResponses.get(req.url.split('/').pop());res.writeHead(item?200:404,{'Content-Type':'application/json'});res.end(JSON.stringify(item||{error:{message:'Not found'}}));return;}
 if(process.env.STORY_PREVIEW && req.url==='/preview') {res.writeHead(302,{'Set-Cookie':`gpt54_session=${token}; Path=/; SameSite=Lax`,Location:origin+'/story-editor/'});res.end();return;}
 let raw=''; for await(const part of req) raw+=part;
 const body=JSON.parse(raw);
 if(req.url==='/v1/audio/speech') {speechRequests.push(body);await speechGate;assert.equal(body.voice,'marin');assert.equal(body.model,'gpt-4o-mini-tts');assert.ok(body.input.length<=4096);res.writeHead(200,{'Content-Type':'audio/mpeg'});res.end(Buffer.from('ID3-local-test-audio'));return;}
 if(req.url==='/v1/realtime/client_secrets'){studioVoiceRequests.push(body);assert.ok(body.session.tools.some(t=>t.name==='edit_passage'));res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({value:'synthetic-no-live-connection',expires_at:Date.now()/1000+60}));return;}
 requests.push(body);
 assert.equal(body.model,'gpt-6.1-sol'); assert.equal(body.reasoning.effort,'xhigh'); assert.equal(body.reasoning.mode,'pro');
 const envelope=JSON.parse(body.input[1].content);const user=envelope.editorialInput??envelope;
 const stage=body.text?.format?.name;
 if(['writing_studio_turn','studio_draft','studio_critique','studio_final'].includes(stage)){
  let value;
  if(stage==='writing_studio_turn')value={action:user.requestScope==='book'?'revise_book':'revise',reply:'Developing the moment without changing its outcome.',revisionText:'',note:'Make the emotional conflict concrete and retain the quiet voice.',chapter:0,passage:0};
  if(stage==='studio_draft')value={text:user.context.selection.text+' She held the envelope by its unopened edge.',craftNotes:'Developed the physical hesitation.'};
  if(stage==='studio_critique')value={strengths:['A physical action carries feeling.'],issues:['Keep the causal decision visible.'],continuityRisks:[],authorIntentFit:'Matches the request.'};
  if(stage==='studio_final')value={text:user.candidate+' Her thumb found the crease, then let it go.',craftNotes:'Her hesitation now appears in a specific action; the decision and original voice remain intact.'};
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(fakeResponse({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(value)}]}]})));return;
 }

 if(body.input[1].content.includes('PAUSE_TEST')&&!pauseResponseStarted){
  if(body.background){pauseResponseStarted=true;const id='resp_paused_'+(++providerSequence);pendingResponses.set(id,{id,model:'gpt-6.1-sol',status:'in_progress'});res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(pendingResponses.get(id)));res={writeHead(){},end(data){pendingResponses.set(id,{...JSON.parse(data),id});}};}
  await new Promise(r=>setTimeout(r,500));
 }
 const retryStage=body.input[1].content.includes('BUDGET_ONCE')&&!truncatedStages.has(stage);
 const resumeFailure=user.chunk?.paragraphs.some(p=>p.text.includes('RESUME_BUDGET'))&&resumeBudgetFailures++<3;
 if(retryStage||resumeFailure){truncatedStages.add(stage);res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(fakeResponse({status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output:[{type:'message',content:[{type:'output_text',text:'{"revisedParagraphs":[]}'}]}]})));return;}

 if(user.chunk?.paragraphs.some(p=>p.text.includes('WHOLE_REFUSAL'))) {res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(fakeResponse({status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'Simulated refusal'}]}]})));return;}
 if(user.chunk?.paragraphs.some(p=>p.text.includes('TECHNICAL_FAILURE'))) {res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:'Network policy blocked connection',code:'invalid_request_error'}}));return;}
 const value=sample(body.text.format.schema);
 if(user.chunk) {
   value.revisedParagraphs=user.chunk.paragraphs.map(p=>({id:p.id,text:p.text.includes('KEEP_EXACT')?'':p.text+' The room fell quiet.',note:p.text.includes('KEEP_EXACT')?'Simulated passage hold for testing.':'Clarity improved.',disposition:p.text.includes('KEEP_EXACT')?'preserved':'revised'}));
   value.quality.closureRisk='low';
 }
 res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify(fakeResponse({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(value)}]}]})));
});
await new Promise(r=>mock.listen(0,'127.0.0.1',r));
const launch=()=>spawn(process.execPath,['server.js'],{cwd:fileURLToPath(new URL('..',import.meta.url)),env:{...process.env,PORT:String(port),OPENAI_API_KEY:'local-test-only',OPENAI_BASE_URL:`http://127.0.0.1:${mock.address().port}/v1`,OPENAI_STORY_EDITOR_MODEL:'gpt-6-astra',OPENAI_STORY_EDITOR_REASONING_EFFORT:'high',OPENAI_STORY_EDITOR_REASONING_MODE:'',JOHNNY_CHAT_PASSWORD:'local-story-preview',STORY_EDITOR_DB_PATH:testDir+'/story.sqlite',JOHNNY_CHAT_USAGE_PATH:testDir+'/usage.json',JOHNNY_CHAT_LIBRARY_PATH:testDir+'/library.json',PUBLIC_BOARD_STORE_PATH:testDir+'/board.json',PUBLIC_BOARD_RATE_LIMIT_PATH:testDir+'/rate.json',CLOCKWISE_DB_PATH:testDir+'/clock.sqlite'},stdio:['ignore','ignore','pipe']});
let child=launch();
let backendErrors='';child.stderr.on('data',d=>backendErrors+=d);process.on('exit',()=>child.kill());

let token;
for(let i=0;i<30;i++) {try { const r=await fetch(origin+'/api/chatbot-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'local-story-preview'})});token=(await r.json()).token;if(token)break;}catch{} await new Promise(r=>setTimeout(r,300));}
assert.ok(token,'local backend available: '+backendErrors);
const auth={Authorization:`Bearer ${token}`};
assert.equal((await fetch(origin+'/api/story-editor/projects')).status,401);
async function json(url,options={}) {const r=await fetch(origin+url,{...options,headers:{...auth,...options.headers}});const value=await r.json();assert.ok(r.ok,JSON.stringify(value));return value;}
async function run(text,title,intent='Polish this adult novel without changing the plot.') {
 const form=new FormData();form.append('manuscript',new Blob([text],{type:'text/plain'}),title+'.txt');form.append('intentJson',JSON.stringify(intent));
 const upload=await json('/api/story-editor/upload',{method:'POST',body:form});
 const base='/api/story-editor/projects/'+upload.projectId;
 const start=await json(base+'/autopilot',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 let job;
 for(let i=0;i<100;i++){job=(await json(base+'/autopilot/'+start.job.id)).job;if(['completed','failed'].includes(job.status))break;await new Promise(r=>setTimeout(r,100));}
 return {job,project:await json(base),base};
}
const longPrompt=process.env.STORY_PROMPT_FIXTURE?await readFile(process.env.STORY_PROMPT_FIXTURE,'utf8'):'  Preserve every meaningful detail.\n'.repeat(700)+'END OF LONG PROMPT  ';
if(process.env.STORY_PROMPT_FIXTURE)assert.equal(Buffer.byteLength(longPrompt),8802,'Complete supplied attachment');
const longStart=requests.length;
const longBook=await run('Chapter One\n\nThe synthetic room was empty.','LONG PROMPT TEST',longPrompt);
assert.equal(longBook.job.status,'completed');assert.equal(longBook.project.project.userIntent,longPrompt);assert.equal(longBook.job.intent,longPrompt);
assert.equal((await json(longBook.base)).project.userIntent,longPrompt,'Reload preserves complete prompt');
const longCalls=requests.slice(longStart).map(r=>JSON.parse(r.input[1].content)).filter(u=>u.intent!==undefined);
assert.ok(longCalls.length>=3);for(const call of longCalls)assert.equal(call.intent,longPrompt,'Every editorial stage receives the full prompt');
const oversized='é'.repeat(50001);
const oversizedForm=new FormData();oversizedForm.append('manuscript',new Blob(['Synthetic only'],{type:'text/plain'}),'too-long.txt');oversizedForm.append('intent',oversized);
const priorCount=(await json('/api/story-editor/projects')).projects.length;
assert.equal((await fetch(origin+'/api/story-editor/upload',{method:'POST',headers:auth,body:oversizedForm})).status,413);
assert.equal((await json('/api/story-editor/projects')).projects.length,priorCount,'Oversized prompt cannot create a truncated project');
assert.equal((await fetch(origin+longBook.base+'/autopilot',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({intent:oversized})})).status,413);
console.log('PASS: complete long prompt entry/storage/reload and every editorial stage; oversized UTF-8 requests rejected with 413 and no truncated project.');
const source='Chapter One\n\nShe smelled cannabis in the deserted hallway.\n\nKEEP_EXACT  This is a test passage.\n\nHe shut the door and went downstairs.';
const main=await run(source,'LOCAL DEMO - The Quiet Hall');
assert.equal(main.job.status,'completed');assert.equal(main.job.report.paragraphsRevised,2);assert.equal(main.job.report.passagesForReview.length,1);
assert.equal(main.project.autopilot.id,main.job.id);
const retained=main.project.sections.find(s=>s.originalText.includes('KEEP_EXACT')&&s.kind==='paragraph');assert.ok(!retained.editedText);
assert.ok(requests.some(r=>r.input[1].content.includes('cannabis')));
assert.ok(requests.some(r=>JSON.parse(r.input[1].content).passages?.length));
assert.ok(requests.some(r=>r.text.format.name==='story_autopilot_polish'));
const report=await fetch(origin+main.base+'/report.txt',{headers:auth});assert.equal(report.status,200);assert.match(await report.text(),/EDITORIAL REPORT/);
const download=await fetch(origin+main.base+'/export.docx',{headers:auth});assert.equal(download.status,200);const bytes=Buffer.from(await download.arrayBuffer());assert.equal(bytes.subarray(0,2).toString(),'PK');await writeFile(testDir+'/edited.docx',bytes);
const reader=await json(main.base+'/reader');assert.equal(reader.completed,true);assert.equal(reader.chapters.length,1);assert.ok(reader.chapters[0].text.includes('KEEP_EXACT'));assert.equal(speechRequests.length,0,'Opening the reader must not generate speech');
const speechUrl=origin+main.base+'/chapters/1/speech';
const speechQuery='?part=0&revision='+reader.chapters[0].revision;
assert.equal((await fetch(speechUrl+speechQuery,{headers:auth})).status,404);
assert.equal(speechRequests.length,0,'Polling absent audio cannot trigger generation');
const speechStart=()=>fetch(speechUrl,{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({part:0,revision:reader.chapters[0].revision,async:true})});
assert.equal((await speechStart()).status,202,'Slow provider cannot hold the start response open');
assert.equal((await speechStart()).status,202);
assert.equal((await fetch(speechUrl+speechQuery,{headers:auth})).status,202);
assert.equal(speechRequests.length,1,'Duplicate starts and polls share one paid request');
assert.equal((await fetch(speechUrl+speechQuery)).status,401);
assert.equal((await fetch(speechUrl+'?part=0&revision=outdated',{headers:auth})).status,409);
releaseSpeech();
let spoken;
for(let i=0;i<30;i++) {spoken=await fetch(speechUrl+speechQuery,{headers:auth});if(spoken.status!==202)break;await new Promise(r=>setTimeout(r,20));}
assert.equal(spoken.status,200);assert.equal(spoken.headers.get('content-type'),'audio/mpeg');assert.ok((await spoken.arrayBuffer()).byteLength);assert.equal(speechRequests.length,1);assert.equal(speechRequests[0].input,reader.chapters[0].text,'Narrate the saved edited text with preserved passages');
await fetch(origin+main.base+'/chapters/1/speech',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({part:0,revision:reader.chapters[0].revision})});assert.equal(speechRequests.length,1,'Replay uses cached audio');
assert.equal((await fetch(origin+main.base+'/chapters/1/speech',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({part:0,revision:'outdated'})})).status,409);
assert.equal((await fetch(origin+main.base+'/chapters/1/speech',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({part:999,revision:reader.chapters[0].revision})})).status,400);
assert.equal((await fetch(origin+main.base+'/chapters/1/speech',{method:'POST'})).status,401);
const speechBeforeSingleChapter=requests.length;
const singleChapterChange=await fetch(origin+main.base+'/autopilot',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({chapter:1,changeRequest:true,intent:'Edit the current chapter only.'})});
assert.equal(singleChapterChange.status,409,'Single-chapter imports require explicit Whole book scope');
assert.match((await singleChapterChange.json()).error,/whole manuscript/i);assert.equal(requests.length,speechBeforeSingleChapter,'Blocked scope sends no model request');
// Manual organization works on an existing revised import without rewriting saved prose.
const originalSections=main.project.sections.map(({id,originalText,editedText,preserveVerbatim})=>({id,originalText,editedText,preserveVerbatim}));
const layout=await json(main.base+'/chapter-layout');
assert.equal((await fetch(origin+main.base+'/chapter-layout')).status,401);
assert.equal((await fetch(origin+main.base+'/chapter-layout',{method:'PUT',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
const splitBoundary=layout.passages.find(p=>p.kind==='paragraph' && p.preview.includes('KEEP_EXACT'));
const manualBoundaries=[{startId:layout.passages[0].id,title:'The Hall'},{startId:splitBoundary.id,title:'The Departure'}];
const manualBody={revision:layout.revision,boundaries:manualBoundaries};
const requestsBeforeLayout=requests.length;
await json(main.base+'/chapter-layout',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(manualBody)});
assert.equal(requests.length,requestsBeforeLayout,'Organization never requests model output');
const reorganized=await json(main.base);
assert.deepEqual(reorganized.sections.map(({id,originalText,editedText,preserveVerbatim})=>({id,originalText,editedText,preserveVerbatim})),originalSections);
assert.deepEqual(reorganized.edits,main.project.edits);assert.deepEqual(reorganized.bible,main.project.bible);
assert.deepEqual(reorganized.autopilot,main.project.autopilot,'Historical run stays intact');
const renamedReader=await json(main.base+'/reader');assert.deepEqual(renamedReader.chapters.map(c=>c.title),['The Hall','The Departure']);
assert.equal((await fetch(origin+main.base+'/chapter-layout',{method:'PUT',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify(manualBody)})).status,409,'Stale repeated save is rejected');
const latestLayout=await json(main.base+'/chapter-layout');
const noOp=await json(main.base+'/chapter-layout',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:latestLayout.revision,boundaries:manualBoundaries})});assert.equal(noOp.changed,false);
const firstManualBefore=reorganized.sections.filter(s=>s.chapterIndex===1).map(s=>s.editedText);
const manualOffset=requests.length;
const manualStart=await json(main.base+'/autopilot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({changeRequest:true,chapter:2,intent:'Change the selected chapter only.'})});
let manualJob;
for(let i=0;i<100;i++){manualJob=(await json(main.base+'/autopilot/'+manualStart.job.id)).job;if(['completed','failed'].includes(manualJob.status))break;await new Promise(r=>setTimeout(r,100));}
assert.equal(manualJob.status,'completed');
assert.ok(requests.slice(manualOffset).every(r=>!JSON.stringify(r).includes('She smelled cannabis')),'Manually divided chapter excludes other prose at every model stage');
assert.deepEqual((await json(main.base)).sections.filter(s=>s.chapterIndex===1).map(s=>s.editedText),firstManualBefore);

const chapterTest=await run('Chapter One\n\nFIRST_CHAPTER_ONLY The door opened.\n\nChapter Two\n\nSECOND_CHAPTER_ONLY The boat returned.','LOCAL TEST - Chapter reader');
const twoChapters=await json(chapterTest.base+'/reader');assert.equal(twoChapters.chapters.length,2);const beforeSpeech=speechRequests.length;
await fetch(origin+chapterTest.base+'/chapters/1/speech',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({part:0,revision:twoChapters.chapters[0].revision})});assert.equal(speechRequests.length,beforeSpeech+1);assert.ok(!speechRequests.at(-1).input.includes('SECOND_CHAPTER_ONLY'),'Chapter one never sends chapter two');
const chapterOneBefore=chapterTest.project.sections.filter(s=>s.chapterIndex===1).map(s=>s.editedText);
const chapterTwoBefore=chapterTest.project.sections.find(s=>s.chapterIndex===2 && s.kind==='paragraph').editedText;
const chapterChangeRequestOffset=requests.length;
const changeStart=await json(chapterTest.base+'/autopilot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({intent:'AUTHOR REQUEST: Add a detail about the boat. Preserve unaffected prose.',changeRequest:true,chapter:2})});
let changeJob;
for(let i=0;i<100;i++){changeJob=(await json(chapterTest.base+'/autopilot/'+changeStart.job.id)).job;if(['completed','failed'].includes(changeJob.status))break;await new Promise(r=>setTimeout(r,100));}
assert.equal(changeJob.status,'completed');
const chapterChangePayloads=requests.slice(chapterChangeRequestOffset);
assert.ok(chapterChangePayloads.length>0);
assert.ok(chapterChangePayloads.every(r=>!JSON.stringify(r).includes('FIRST_CHAPTER_ONLY')),'No stage may send prose from another chapter to the model');
assert.ok(chapterChangePayloads.some(r=>JSON.stringify(r).includes('SECOND_CHAPTER_ONLY')),'The selected chapter is sent to the model');
const changedChapter=await json(chapterTest.base);
assert.deepEqual(changedChapter.sections.filter(s=>s.chapterIndex===1).map(s=>s.editedText),chapterOneBefore,'A chapter request must not write another chapter');
assert.ok(changedChapter.sections.find(s=>s.chapterIndex===2 && s.kind==='paragraph').editedText.startsWith(chapterTwoBefore),'Changes build on the edited draft');
assert.equal((await fetch(origin+chapterTest.base+'/autopilot',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({changeRequest:true,chapter:999,intent:'Change a chapter.'})})).status,404);
// Repair an already-imported, revised passage with an internal chapter heading.
const flattened=await run('FLATTENED_FIRST The door opened. CHAPTER TWO FLATTENED_SECOND The boat returned.','LOCAL TEST - Internal chapter');
const flatParagraph=flattened.project.sections.find(s=>s.kind==='paragraph');
assert.equal(flattened.project.sections.filter(s=>s.kind==='paragraph').length,1);
const originalExportBefore=Buffer.from(await (await fetch(origin+flattened.base+'/export.docx?source=original',{headers:auth})).arrayBuffer());
await writeFile(testDir+'/before-split.docx',originalExportBefore);
const preview=await json(flattened.base+'/passage-split/'+flatParagraph.id);
assert.equal((await fetch(origin+flattened.base+'/passage-split/'+flatParagraph.id)).status,401);
const splitInput={revision:preview.revision,sectionId:flatParagraph.id,originalOffset:preview.originalText.indexOf('CHAPTER'),revisedOffset:preview.revisedText.indexOf('CHAPTER'),chapterTitle:'The boat'};
const splitRequestsBefore=requests.length;
const splitResult=await json(flattened.base+'/passage-split',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(splitInput)});
assert.equal(requests.length,splitRequestsBefore,'Splitting starts no model request');
assert.equal((await fetch(origin+flattened.base+'/passage-split',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify(splitInput)})).status,409,'Duplicate split is stale and cannot repeat');
const splitProject=await json(flattened.base);
const splitChildren=splitResult.childIds.map(id=>splitProject.sections.find(s=>s.id===id));
assert.equal(splitChildren.map(s=>s.originalText).join(''),flatParagraph.originalText);
assert.equal(splitChildren.map(s=>s.editedText).join(''),flatParagraph.editedText);
assert.equal(splitProject.sections.find(s=>s.id===flatParagraph.id).kind,'split-source');
assert.deepEqual(splitProject.edits,flattened.project.edits,'All earlier edit records stay linked to the archived source');
assert.equal((await fetch(origin+'/api/story-editor/edits/'+flattened.project.edits[0].id+'/accept',{method:'POST',headers:auth})).status,409,'Archived whole-passage edits cannot overwrite a new piece');
assert.deepEqual(splitProject.bible,flattened.project.bible);
const repairedReader=await json(flattened.base+'/reader');assert.equal(repairedReader.chapters.length,2);assert.equal(repairedReader.chapters[1].title,'The boat');
const originalExportAfter=Buffer.from(await (await fetch(origin+flattened.base+'/export.docx?source=original',{headers:auth})).arrayBuffer());
await writeFile(testDir+'/after-split.docx',originalExportAfter);
assert.equal(execFileSync('unzip',['-p',testDir+'/before-split.docx','word/document.xml']).toString(),execFileSync('unzip',['-p',testDir+'/after-split.docx','word/document.xml']).toString(),'Original Word content and paragraph structure remain identical');
const firstRepairedBefore=splitChildren[0].editedText;
const repairedRequestStart=requests.length;
const repairedEdit=await json(flattened.base+'/autopilot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({changeRequest:true,chapter:2,intent:'Polish only the repaired second chapter.'})});
let repairedJob;
for(let i=0;i<100;i++){repairedJob=(await json(flattened.base+'/autopilot/'+repairedEdit.job.id)).job;if(['completed','failed'].includes(repairedJob.status))break;await new Promise(r=>setTimeout(r,100));}
assert.equal(repairedJob.status,'completed');
assert.ok(requests.slice(repairedRequestStart).every(r=>!JSON.stringify(r).includes('FLATTENED_FIRST')),'No stage of repaired chapter edit sends first-chapter prose');
assert.equal((await json(flattened.base)).sections.find(s=>s.id===splitChildren[0].id).editedText,firstRepairedBefore);

const docxImport=new FormData();docxImport.append('manuscript',new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}),'Roundtrip.docx');
const roundtrip=await json('/api/story-editor/upload',{method:'POST',body:docxImport});assert.ok(roundtrip.sections>=3);
const pdfStream='BT /F1 12 Tf 72 720 Td (Front matter introduction.) Tj 0 -24 Td (CHAPTER I) Tj 0 -24 Td (First chapter prose.) Tj 0 -24 Td (CHAPTER I) Tj 0 -24 Td (More first chapter prose.) Tj 0 -24 Td (CHAPTER II) Tj 0 -24 Td (Second chapter prose.) Tj ET';
const pdfObjects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${pdfStream.length} >>\nstream\n${pdfStream}\nendstream`];
let pdf='%PDF-1.4\n',offsets=[0];pdfObjects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;});const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
const pdfImport=new FormData();pdfImport.append('manuscript',new Blob([pdf],{type:'application/pdf'}),'Selectable.pdf');
const pdfProject=await json('/api/story-editor/upload',{method:'POST',body:pdfImport});assert.ok(pdfProject.sections>0);
const importedPdf=await json('/api/story-editor/projects/'+pdfProject.projectId);
assert.equal(new Set(importedPdf.sections.filter(s=>s.kind==='paragraph').map(s=>s.chapterIndex)).size,3,'PDF front matter and numbered chapters are separated without splitting repeated headers');
assert.equal(importedPdf.sections.filter(s=>s.kind==='chapter').length,2);
assert.ok(importedPdf.sections.some(s=>s.kind==='paragraph'&&s.originalText==='Second chapter prose.'));
const original=await fetch(origin+main.base+'/export.docx?source=original',{headers:auth});assert.equal(original.status,200);await writeFile(testDir+'/original.docx',Buffer.from(await original.arrayBuffer()));
const whole=await run(Array.from({length:12},(_,i)=>i===0?'WHOLE_REFUSAL simulated hold.':`Paragraph ${i} of the local test manuscript.`).join('\n\n'),'LOCAL TEST - Refusal');assert.equal(whole.job.status,'completed');assert.ok(whole.job.report.paragraphsPreserved > 0);assert.ok(whole.job.report.paragraphsRevised > 0);assert.equal(whole.job.report.paragraphsPreserved + whole.job.report.paragraphsRevised,12);
const fail=await run('TECHNICAL_FAILURE simulated service problem.','LOCAL TEST - Connection');assert.equal(fail.job.status,'failed');assert.equal(fail.project.sections.filter(s=>s.editedText).length,0);
const auto=await run('BUDGET_ONCE The storm passed over the house.','LOCAL TEST - Output budget');assert.equal(auto.job.status,'completed');assert.ok(truncatedStages.size>=2);
const layoutFail=await run('TECHNICAL_FAILURE simulated service problem.\n\nA retained passage.','LOCAL TEST - Layout resume');
const failedLayout=await json(layoutFail.base+'/chapter-layout');
await json(layoutFail.base+'/chapter-layout',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:failedLayout.revision,boundaries:[{startId:failedLayout.passages[0].id,title:'Changed structure'}]})});
assert.equal((await fetch(origin+layoutFail.base+'/autopilot',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({resume:true,intent:layoutFail.job.intent})})).status,409,'Changed structure cannot resume old checkpoints');
const stopped=await run(Array.from({length:12},(_,i)=>i===11?'RESUME_BUDGET The last passage.':`Checkpoint passage ${i}.`).join('\n\n'),'LOCAL TEST - Resume');
assert.equal(stopped.job.status,'failed');assert.ok(stopped.job.completedChunks>0);
const initialEdits=stopped.project.edits.length;
// Reproduce a process disappearing while the saved job still says running.
const db=fixtureDb();
// Simulate a pre-upgrade foreground failure: saved stage results exist, but
// no provider ID was ever recorded for its unsuccessful requests. New-provider
// uncertain submissions and pending-ID recovery are covered independently.
db.prepare("DELETE FROM story_provider_requests WHERE job_id=? AND state='incomplete'").run(stopped.job.id);
db.prepare("UPDATE story_autopilot_jobs SET status='running', finished_at='' WHERE id=?").run(stopped.job.id);
db.prepare("UPDATE story_worker_queue SET state='running',owner='dead-process',lease_until=1 WHERE job_id=?").run(stopped.job.id);
db.close();
await new Promise(resolve=>{child.once('exit',resolve);child.kill();});
child=launch();child.stderr.on('data',d=>backendErrors+=d);
for(let i=0;i<50;i++) {try {const r=await fetch(origin+'/api/chatbot-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'local-story-preview'})});const t=(await r.json()).token;if(t){auth.Authorization=`Bearer ${t}`;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
const interrupted=await json(stopped.base);
assert.ok(['queued','running','completed'].includes(interrupted.autopilot.status));
assert.ok(interrupted.autopilot.completedChunks>=stopped.job.completedChunks);
const checkDb=fixtureDb();
assert.ok(checkDb.prepare('SELECT completed_chunks FROM story_autopilot_jobs WHERE id=?').get(stopped.job.id).completed_chunks>=stopped.job.completedChunks);
checkDb.close();
const requestCount=requests.length;
// No explicit resume: the durable queue must recover the expired worker itself.
let resumedJob;
for(let i=0;i<100;i++){resumedJob=(await json(stopped.base+'/autopilot/'+stopped.job.id)).job;if(['completed','failed'].includes(resumedJob.status))break;await new Promise(r=>setTimeout(r,100));}
assert.equal(resumedJob.status,'completed');
const after=await json(stopped.base);assert.equal(after.edits.length,24);assert.ok(initialEdits<12);
assert.ok(!requests.slice(requestCount).filter(r=>r.text.format.name!=='story_autopilot_polish').some(r=>JSON.parse(r.input[1].content).chunk?.paragraphs.some(p=>p.text.includes('Checkpoint passage 0.'))));
const pauseForm=new FormData();pauseForm.append('manuscript',new Blob(['PAUSE_TEST The visitor left a note on the counter.'],{type:'text/plain'}),'Pause test.txt');
const pauseUpload=await json('/api/story-editor/upload',{method:'POST',body:pauseForm});
const pauseBase='/api/story-editor/projects/'+pauseUpload.projectId;
const starts=await Promise.all([1,2].map(()=>json(pauseBase+'/autopilot',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})));
assert.equal(starts[0].job.id,starts[1].job.id,'double clicks must share one active run');
const pauseJob=starts[0].job.id;
await json(pauseBase+'/autopilot/'+pauseJob+'/pause',{method:'POST'});
await new Promise(r=>setTimeout(r,700));
const paused=await json(pauseBase);assert.equal(paused.autopilot.status,'failed');assert.equal(paused.edits.length,0,'late response must not write after pause');
await json(pauseBase+'/autopilot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resume:true,intent:starts[0].job.intent})});
let finished;
for(let i=0;i<150;i++){finished=(await json(pauseBase+'/autopilot/'+pauseJob)).job;if(['completed','failed'].includes(finished.status))break;await new Promise(r=>setTimeout(r,100));}
assert.equal(finished.status,'completed');
// A complete studio collaboration uses only this local fake model and temporary database.
// Synthetic active full edit: stop must cancel its provider, revoke ownership,
// preserve originals/revisions, and be safe to repeat with no paid create.
const stopForm=new FormData();stopForm.append('manuscript',new Blob(['Synthetic preserved original.'],{type:'text/plain'}),'Start over test.txt');
const stopUpload=await json('/api/story-editor/upload',{method:'POST',body:stopForm});const stopBase='/api/story-editor/projects/'+stopUpload.projectId;
const stopDb=fixtureDb();
stopDb.prepare("INSERT INTO story_autopilot_jobs(id,project_id,intent,status,phase,total_chunks,completed_chunks,created_at,updated_at) VALUES(?,?,?,'running','editing',2,1,?,?)").run('synthetic-stop-job',stopUpload.projectId,'Synthetic only',new Date().toISOString(),new Date().toISOString());
stopDb.prepare("INSERT INTO story_worker_queue(job_id,state) VALUES(?,'failed')").run('synthetic-stop-job');
stopDb.prepare("UPDATE story_sections SET edited_text='Synthetic saved revision.' WHERE project_id=? AND kind='paragraph'").run(stopUpload.projectId);
stopDb.prepare("INSERT INTO story_provider_requests(job_id,stage_key,stage,state,response_id,client_request_id,model,effort,mode,submitted_at,checked_at) VALUES(?,?,?,'in_progress',?,?,?,'xhigh','pro',?,?)").run('synthetic-stop-job','stage','story_autopilot_chunk','resp_stop_fixture','stop-fixture','gpt-6.1-sol',new Date().toISOString(),new Date().toISOString());
pendingResponses.set('resp_stop_fixture',{id:'resp_stop_fixture',status:'in_progress',model:'gpt-6.1-sol'});
assert.equal((await json(stopBase+'/studio/work-status')).active,true);const requestsBeforeStop=requests.length;
assert.equal((await json(stopBase+'/studio/stop-work',{method:'POST'})).stopped,true);
assert.equal((await json(stopBase+'/studio/stop-work',{method:'POST'})).stopped,true);
assert.equal((await json(stopBase+'/studio/work-status')).active,false);assert.equal(cancellationCalls,1);assert.equal(requests.length,requestsBeforeStop);
const stoppedProject=await json(stopBase);assert.equal(stoppedProject.autopilot.phase,'paused');assert.equal(stoppedProject.autopilot.completedChunks,1);assert.equal(stoppedProject.sections.find(p=>p.kind==='paragraph').originalText,'Synthetic preserved original.');assert.equal(stoppedProject.sections.find(p=>p.kind==='paragraph').editedText,'Synthetic saved revision.');
assert.equal(stopDb.prepare('SELECT state FROM story_provider_requests WHERE job_id=?').get('synthetic-stop-job').state,'cancelled');assert.equal(stopDb.prepare('SELECT lease_until FROM story_worker_queue WHERE job_id=?').get('synthetic-stop-job').lease_until,0);stopDb.close();
assert.equal((await fetch(origin+stopBase+'/studio/stop-work',{method:'POST'})).status,401);
console.log('PASS: Start over work-status and repeated stop, provider cancellation, no new generation, original/revision preservation, authentication.');

const studioBook=await run('Chapter One\n\nThe letter had waited beside the kitchen window for three days. Every morning, Mara moved it to wipe the sill, and every morning she put it back.\n\nHer brother had written her name carefully. She recognized the way he pressed too hard on the final stroke, as though he could make certainty out of ink.\n\nChapter Two\n\nAt the station, the last train had not yet been called.','The Letter - studio preview');
const studioBase=studioBook.base+'/studio';
assert.equal((await fetch(origin+studioBase)).status,401);
let studioState=await json(studioBase);assert.deepEqual(studioState.quality,{model:'gpt-6.1-sol',effort:'xhigh',mode:'pro'});assert.equal(studioState.chapters.length,2);
await json(studioBase+'/goal',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({goal:'A finished literary novel with a quiet voice, developed from beginning to end.'})});
assert.equal((await json(studioBase)).goal,'A finished literary novel with a quiet voice, developed from beginning to end.');

const studioPassage=studioState.chapters[0].passages[0],savedOriginal=studioState.original;
await json(studioBase+'/notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({note:'Mara wants reconciliation, but she is afraid of what opening the letter will require.'})});
const beforeStudioCalls=requests.length;
const studioRequest={requestId:'local-studio-edit',sectionId:studioPassage.id,revision:studioPassage.revision,message:'Deepen her hesitation through physical action, without changing the decision.'};
const studioStart=await json(studioBase+'/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(studioRequest)});assert.ok(['queued','running'].includes(studioStart.task.status));
let studioTask;
for(let i=0;i<100;i++){studioTask=(await json(studioBase+'/tasks/local-studio-edit')).task;if(['done','failed'].includes(studioTask.status))break;await new Promise(r=>setTimeout(r,30));}
assert.equal(studioTask.status,'done',studioTask.error);assert.deepEqual(requests.slice(beforeStudioCalls).map(r=>r.text.format.name),['writing_studio_turn','studio_draft','studio_critique','studio_final']);
studioState=await json(studioBase);assert.equal(studioState.original,savedOriginal);assert.equal(studioState.versions.length,1);assert.match(studioState.chapters[0].passages[0].text,/Her thumb found the crease/);
const repeated=await json(studioBase+'/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(studioRequest)});assert.equal(repeated.task.status,'done');assert.equal(requests.length-beforeStudioCalls,4);
const fullBefore=await json(studioBook.base);
const proposalBefore=requests.length;
await json(studioBase+'/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:'whole-book-proposal',scope:'book',sectionId:studioState.chapters[0].passages[0].id,revision:studioState.chapters[0].passages[0].revision,message:'Deepen the emotional arc throughout the whole manuscript.'})});
let proposal;
for(let i=0;i<100;i++){proposal=(await json(studioBase+'/tasks/whole-book-proposal')).task;if(['done','failed'].includes(proposal.status))break;await new Promise(r=>setTimeout(r,30));}
assert.equal(proposal.status,'done',proposal.error);assert.equal(proposal.result.action,'revise_book');assert.equal(proposal.result.requiresConfirmation,true);
assert.equal(requests.length-proposalBefore,1,'Whole-book proposal runs planning only');
assert.deepEqual((await json(studioBook.base)).sections,fullBefore.sections,'Proposal never silently edits one passage');
assert.equal((await json(studioBook.base)).autopilot.id,fullBefore.autopilot.id,'Proposal cannot start a full revision without Apply');
assert.equal((await json(studioBase)).lastTask.result.action,'revise_book','Proposal survives a page reload');
const revisedBytes=Buffer.from(await (await fetch(origin+studioBook.base+'/export.docx?source=edited',{headers:auth})).arrayBuffer());
const originalBytes=Buffer.from(await (await fetch(origin+studioBook.base+'/export.docx?source=original',{headers:auth})).arrayBuffer());
await writeFile(testDir+'/studio-revised.docx',revisedBytes);await writeFile(testDir+'/studio-original.docx',originalBytes);
assert.match(execFileSync('unzip',['-p',testDir+'/studio-revised.docx','word/document.xml']).toString(),/Her thumb found the crease/);
assert.doesNotMatch(execFileSync('unzip',['-p',testDir+'/studio-original.docx','word/document.xml']).toString(),/Her thumb found the crease/);
assert.equal((await fetch(origin+studioBase+'/speech?'+new URLSearchParams({sectionId:studioPassage.id,revision:studioPassage.revision,part:'0'}),{headers:auth})).status,409);
const currentPassage=studioState.chapters[0].passages[0];
const studioVoice=await json(studioBase+'/voice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sectionId:currentPassage.id,revision:currentPassage.revision})});assert.equal(studioVoice.value,'synthetic-no-live-connection');assert.equal(studioVoiceRequests.length,1);assert.ok(!studioVoiceRequests[0].session.instructions.includes('SECOND_CHAPTER_ONLY'));
await json(studioBase+'/bookmark',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({sectionId:currentPassage.id,revision:currentPassage.revision,part:0,seconds:8})});assert.equal((await json(studioBase)).bookmark.seconds,8);
if(!process.env.STORY_PREVIEW){await json(studioBase+'/undo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sectionId:currentPassage.id,revision:currentPassage.revision})});assert.equal((await json(studioBase)).chapters[0].passages[0].text,studioPassage.text);}
if(!process.env.STORY_PREVIEW){
 const referenceBook=await json(studioBase+'/book/link',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Synthetic continuity novel',useContinuity:true})});
 const sourceChapter=(await json(studioBase)).chapters[0];
 const savedBook=await json(studioBase+'/book/chapters',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chapterIndex:sourceChapter.index,chapterRevision:sourceChapter.revision,bookRevision:referenceBook.book.revision})});
 const savedChapter=savedBook.book.chapters[0];assert.equal((await fetch(origin+studioBase+'/book')).status,401);assert.equal((await fetch(origin+studioBase+'/book/chapters/'+savedChapter.id)).status,401);
 const savedText=await json(studioBase+'/book/chapters/'+savedChapter.id);assert.equal(savedText.content.passages[0].text,sourceChapter.passages[0].text);
 const nextForm=new FormData();nextForm.append('manuscript',new Blob(['Chapter One\n\nThe next day, Mara returned to the kitchen window.'],{type:'text/plain'}),'Synthetic next chapter.txt');
 const nextUpload=await json('/api/story-editor/upload',{method:'POST',body:nextForm});const nextBase='/api/story-editor/projects/'+nextUpload.projectId;
 await json(nextBase+'/studio/book/link',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({bookId:savedBook.book.id,useContinuity:true})});
 const canonStart=requests.length;const start=await json(nextBase+'/autopilot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({intent:'Develop the next chapter, preserving earlier continuity.'})});let job;
 for(let i=0;i<100;i++){job=(await json(nextBase+'/autopilot/'+start.job.id)).job;if(['completed','failed'].includes(job.status))break;await new Promise(r=>setTimeout(r,50));}assert.equal(job.status,'completed',job.error);
 const canonCalls=requests.slice(canonStart);assert.ok(canonCalls.length>=4);for(const call of canonCalls){const input=JSON.parse(call.input[1].content);assert.equal(input.savedBookContinuity.chapters[0].versionId,savedChapter.versionId);assert.ok(JSON.stringify(input.savedBookContinuity).includes(sourceChapter.passages[0].text));assert.match(call.input[0].content,/incomplete evidence/);}
 assert.ok(canonCalls.some(c=>c.text.format.name==='story_autopilot_plan'));assert.ok(canonCalls.some(c=>c.text.format.name==='story_autopilot_chunk'));assert.ok(canonCalls.some(c=>c.text.format.name==='story_autopilot_polish'));assert.ok(canonCalls.some(c=>c.text.format.name==='story_autopilot_review'));
 const canonDb=fixtureDb({readOnly:true});assert.equal(JSON.parse(canonDb.prepare('SELECT request_json FROM story_job_requests WHERE job_id=?').get(start.job.id).request_json).bookCanon.chapters[0].versionId,savedChapter.versionId);canonDb.close();
 assert.deepEqual((await json(studioBase+'/book/chapters/'+savedChapter.id)).content,savedText.content,'Subsequent full edit cannot overwrite approved chapter snapshot');
 console.log('PASS: authenticated full chapter save/reload, cross-upload book linking, pinned approved canon in every Autopilot stage and durable job request, immutable references; no paid provider.');
}
if(!process.env.STORY_PREVIEW){
 const removed=await fetch(origin+studioBook.base,{method:'DELETE',headers:auth});assert.equal(removed.status,200);
 const check=fixtureDb();for(const table of ['studio_goals','studio_tasks','studio_notes','studio_messages','studio_versions','studio_state','studio_context_cache'])assert.equal(check.prepare(`SELECT count(*) AS n FROM ${table} WHERE project_id=?`).get(studioState.projectId).n,0);assert.equal(check.prepare('SELECT count(*) AS n FROM studio_task_stages').get().n,0);check.close();
}
console.log('PASS: whole-manuscript proposal confirmation/scope/reload; revised vs original DOCX content; studio four-pass Sol/xhigh/pro edit; durable/idempotent tasks; original preservation; history/undo; project notes; bookmark; mocked voice-token contract.');
console.log('PASS: upload/export; refusal preservation; technical failure; output-budget retries; process restart detection; same-job resume skips saved paragraphs and avoids duplicate revisions.');
if(process.env.STORY_PREVIEW) console.log(`LOCAL PREVIEW: http://127.0.0.1:${mock.address().port}/preview`); else {child.kill();mock.close();}
