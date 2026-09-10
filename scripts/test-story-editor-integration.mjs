import http from 'node:http';
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
 let raw=''; for await(const part of req) raw+=part;
 const body=JSON.parse(raw); requests.push(body);
 assert.equal(body.model,'gpt-6-astra'); assert.equal(body.reasoning.effort,'high'); assert.equal(body.reasoning.mode,undefined);
 const user=JSON.parse(body.input[1].content);
 const stage=body.text?.format?.name;
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
const child=spawn(process.execPath,['server.js'],{cwd:fileURLToPath(new URL('..',import.meta.url)),env:{...process.env,PORT:String(port),OPENAI_API_KEY:'local-test-only',OPENAI_BASE_URL:`http://127.0.0.1:${mock.address().port}/v1`,OPENAI_STORY_EDITOR_MODEL:'gpt-6-astra',OPENAI_STORY_EDITOR_REASONING_EFFORT:'high',OPENAI_STORY_EDITOR_REASONING_MODE:'',JOHNNY_CHAT_PASSWORD:'local-story-preview',STORY_EDITOR_DB_PATH:testDir+'/story.sqlite',JOHNNY_CHAT_USAGE_PATH:testDir+'/usage.json',JOHNNY_CHAT_LIBRARY_PATH:testDir+'/library.json',PUBLIC_BOARD_STORE_PATH:testDir+'/board.json',PUBLIC_BOARD_RATE_LIMIT_PATH:testDir+'/rate.json',CLOCKWISE_DB_PATH:testDir+'/clock.sqlite'},stdio:['ignore','ignore','pipe']});
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
const download=await fetch(origin+main.base+'/export.docx',{headers:auth});assert.equal(download.status,200);const bytes=Buffer.from(await download.arrayBuffer());assert.equal(bytes.subarray(0,2).toString(),'PK');await writeFile(testDir+'/edited.docx',bytes);
const original=await fetch(origin+main.base+'/export.docx?source=original',{headers:auth});assert.equal(original.status,200);await writeFile(testDir+'/original.docx',Buffer.from(await original.arrayBuffer()));
const whole=await run(Array.from({length:12},(_,i)=>i===0?'WHOLE_REFUSAL simulated hold.':`Paragraph ${i} of the local test manuscript.`).join('\n\n'),'LOCAL TEST - Refusal');assert.equal(whole.job.status,'completed');assert.ok(whole.job.report.paragraphsPreserved > 0);assert.ok(whole.job.report.paragraphsRevised > 0);assert.equal(whole.job.report.paragraphsPreserved + whole.job.report.paragraphsRevised,12);
const fail=await run('TECHNICAL_FAILURE simulated service problem.','LOCAL TEST - Connection');assert.equal(fail.job.status,'failed');assert.equal(fail.project.sections.filter(s=>s.editedText).length,0);
const auto=await run('BUDGET_ONCE The storm passed over the house.','LOCAL TEST - Output budget');assert.equal(auto.job.status,'completed');assert.ok(truncatedStages.size>=2);
const stopped=await run(Array.from({length:12},(_,i)=>i===11?'RESUME_BUDGET The last passage.':`Checkpoint passage ${i}.`).join('\n\n'),'LOCAL TEST - Resume');
assert.equal(stopped.job.status,'failed');assert.ok(stopped.job.completedChunks>0);
const initialEdits=stopped.project.edits.length;
const requestCount=requests.length;
const resumed=await json(stopped.base+'/autopilot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resume:true,intent:stopped.job.intent})});assert.equal(resumed.job.id,stopped.job.id);
let resumedJob;
for(let i=0;i<100;i++){resumedJob=(await json(stopped.base+'/autopilot/'+stopped.job.id)).job;if(['completed','failed'].includes(resumedJob.status))break;await new Promise(r=>setTimeout(r,100));}
assert.equal(resumedJob.status,'completed');
const after=await json(stopped.base);assert.equal(after.edits.length,12);assert.ok(initialEdits<12);
assert.ok(!requests.slice(requestCount).some(r=>JSON.parse(r.input[1].content).chunk?.paragraphs.some(p=>p.text.includes('Checkpoint passage 0.'))));
console.log('PASS: upload/export; refusal preservation; technical failure; output-budget retries; same-job resume skips saved paragraphs and avoids duplicate revisions.');
child.kill();mock.close();
