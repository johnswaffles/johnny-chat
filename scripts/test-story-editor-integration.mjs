import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const testDir=await mkdtemp(tmpdir()+'/story-editor-test-');
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
const requests=[];
const speechRequests=[];
let resumeBudgetFailures=0;
const truncatedStages=new Set();
const mock=http.createServer(async(req,res)=>{
 if(process.env.STORY_PREVIEW && req.url==='/preview') {res.writeHead(302,{'Set-Cookie':`gpt54_session=${token}; Path=/; SameSite=Lax`,Location:origin+'/story-editor/'});res.end();return;}
 let raw=''; for await(const part of req) raw+=part;
 const body=JSON.parse(raw);
 if(req.url==='/v1/audio/speech') {speechRequests.push(body);assert.equal(body.voice,'marin');assert.equal(body.model,'gpt-4o-mini-tts');assert.ok(body.input.length<=4096);res.writeHead(200,{'Content-Type':'audio/mpeg'});res.end(Buffer.from('ID3-local-test-audio'));return;}
 requests.push(body);
 assert.equal(body.model,'gpt-6-astra'); assert.equal(body.reasoning.effort,'high'); assert.equal(body.reasoning.mode,undefined);
 const user=JSON.parse(body.input[1].content);
 const stage=body.text?.format?.name;
 if(body.input[1].content.includes('PAUSE_TEST')) await new Promise(r=>setTimeout(r,500));
 const retryStage=body.input[1].content.includes('BUDGET_ONCE')&&!truncatedStages.has(stage);
 const resumeFailure=user.chunk?.paragraphs.some(p=>p.text.includes('RESUME_BUDGET'))&&resumeBudgetFailures++<3;
 if(retryStage||resumeFailure){truncatedStages.add(stage);res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output:[{type:'message',content:[{type:'output_text',text:'{"revisedParagraphs":[]}'}]}]}));return;}

 if(user.chunk?.paragraphs.some(p=>p.text.includes('WHOLE_REFUSAL'))) {res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'Simulated refusal'}]}]}));return;}
 if(user.chunk?.paragraphs.some(p=>p.text.includes('TECHNICAL_FAILURE'))) {res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:'Network policy blocked connection',code:'invalid_request_error'}}));return;}
 const value=sample(body.text.format.schema);
 if(user.chunk) {
   value.revisedParagraphs=user.chunk.paragraphs.map(p=>({id:p.id,text:p.text.includes('KEEP_EXACT')?'':p.text+' The room fell quiet.',note:p.text.includes('KEEP_EXACT')?'Simulated passage hold for testing.':'Clarity improved.',disposition:p.text.includes('KEEP_EXACT')?'preserved':'revised'}));
   value.quality.closureRisk='low';
 }
 res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(value)}]}]}));
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
async function run(text,title) {
 const form=new FormData();form.append('manuscript',new Blob([text],{type:'text/plain'}),title+'.txt');form.append('intent','Polish this adult novel without changing the plot.');
 const upload=await json('/api/story-editor/upload',{method:'POST',body:form});
 const base='/api/story-editor/projects/'+upload.projectId;
 const start=await json(base+'/autopilot',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 let job;
 for(let i=0;i<100;i++){job=(await json(base+'/autopilot/'+start.job.id)).job;if(['completed','failed'].includes(job.status))break;await new Promise(r=>setTimeout(r,100));}
 return {job,project:await json(base),base};
}
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
const spoken=await fetch(origin+main.base+'/chapters/1/speech',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({part:0,revision:reader.chapters[0].revision})});assert.equal(spoken.status,200);assert.equal(spoken.headers.get('content-type'),'audio/mpeg');assert.ok((await spoken.arrayBuffer()).byteLength);assert.equal(speechRequests.length,1);assert.equal(speechRequests[0].input,reader.chapters[0].text,'Narrate the saved edited text with preserved passages');
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
const db=new DatabaseSync(testDir+'/story.sqlite');
db.prepare("UPDATE story_autopilot_jobs SET status='running', finished_at='' WHERE id=?").run(stopped.job.id);
db.prepare("UPDATE story_worker_queue SET state='running',owner='dead-process',lease_until=1 WHERE job_id=?").run(stopped.job.id);
db.close();
await new Promise(resolve=>{child.once('exit',resolve);child.kill();});
child=launch();child.stderr.on('data',d=>backendErrors+=d);
for(let i=0;i<50;i++) {try {const r=await fetch(origin+'/api/chatbot-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'local-story-preview'})});const t=(await r.json()).token;if(t){auth.Authorization=`Bearer ${t}`;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
const interrupted=await json(stopped.base);
assert.ok(['queued','running','completed'].includes(interrupted.autopilot.status));
assert.ok(interrupted.autopilot.completedChunks>=stopped.job.completedChunks);
const checkDb=new DatabaseSync(testDir+'/story.sqlite');
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
console.log('PASS: upload/export; refusal preservation; technical failure; output-budget retries; process restart detection; same-job resume skips saved paragraphs and avoids duplicate revisions.');
if(process.env.STORY_PREVIEW) console.log(`LOCAL PREVIEW: http://127.0.0.1:${mock.address().port}/preview`); else {child.kill();mock.close();}
