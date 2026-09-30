import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { spawn } from 'node:child_process';
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
let resumeBudgetFailures=0;
const truncatedStages=new Set();
const mock=http.createServer(async(req,res)=>{
 if(process.env.STORY_PREVIEW && req.url==='/preview') {res.writeHead(302,{'Set-Cookie':`gpt54_session=${token}; Path=/; SameSite=Lax`,Location:origin+'/story-editor/'});res.end();return;}
 let raw=''; for await(const part of req) raw+=part;
 const body=JSON.parse(raw); requests.push(body);
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
const docxImport=new FormData();docxImport.append('manuscript',new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}),'Roundtrip.docx');
const roundtrip=await json('/api/story-editor/upload',{method:'POST',body:docxImport});assert.ok(roundtrip.sections>=3);
const pdfStream='BT /F1 12 Tf 72 720 Td (A complete sample sentence from a selectable PDF.) Tj ET';
const pdfObjects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${pdfStream.length} >>\nstream\n${pdfStream}\nendstream`];
let pdf='%PDF-1.4\n',offsets=[0];pdfObjects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;});const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
const pdfImport=new FormData();pdfImport.append('manuscript',new Blob([pdf],{type:'application/pdf'}),'Selectable.pdf');
const pdfProject=await json('/api/story-editor/upload',{method:'POST',body:pdfImport});assert.ok(pdfProject.sections>0);
const original=await fetch(origin+main.base+'/export.docx?source=original',{headers:auth});assert.equal(original.status,200);await writeFile(testDir+'/original.docx',Buffer.from(await original.arrayBuffer()));
const whole=await run(Array.from({length:12},(_,i)=>i===0?'WHOLE_REFUSAL simulated hold.':`Paragraph ${i} of the local test manuscript.`).join('\n\n'),'LOCAL TEST - Refusal');assert.equal(whole.job.status,'completed');assert.ok(whole.job.report.paragraphsPreserved > 0);assert.ok(whole.job.report.paragraphsRevised > 0);assert.equal(whole.job.report.paragraphsPreserved + whole.job.report.paragraphsRevised,12);
const fail=await run('TECHNICAL_FAILURE simulated service problem.','LOCAL TEST - Connection');assert.equal(fail.job.status,'failed');assert.equal(fail.project.sections.filter(s=>s.editedText).length,0);
const auto=await run('BUDGET_ONCE The storm passed over the house.','LOCAL TEST - Output budget');assert.equal(auto.job.status,'completed');assert.ok(truncatedStages.size>=2);
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
