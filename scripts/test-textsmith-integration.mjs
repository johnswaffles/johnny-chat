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
let attempts=0;
const mock=http.createServer(async(req,res)=>{
 let raw=''; for await(const p of req)raw+=p;const body=JSON.parse(raw);attempts++;
 assert.equal(body.model,'gpt-6-astra');assert.equal(body.reasoning.effort,'low');
 if(body.input[1].content.includes('EXPERT')) assert.match(body.input[0].content,/EXPERT CUSTOMER CARE/);
 const count=body.text.format.schema.properties.messages.minItems;
 const first=body.input[1].content.includes('RETRY')&&!body.input[0].content.includes('Previous candidate');
 if(!first&&body.input[1].content.includes('RETRY')) assert.match(body.input[0].content,/TWO-message, 160-characters-EACH/);
 const messages=first?['a'.repeat(161),'Second complete message.']:count===2?['Hi Sarah, your Thursday appointment needs to move from 2:00 to 3:00 because of the weather.','Would 3:00 still work for you? Thank you for being flexible.']:['Hi Mike, your estimate is ready: $285. I can stop by Friday afternoon if that works for you.'];
 res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({messages})}]}]}));
});
await new Promise(r=>mock.listen(0,'127.0.0.1',r));
const child=spawn(process.execPath,['server.js'],{cwd:fileURLToPath(new URL('..',import.meta.url)),env:{...process.env,PORT:String(port),OPENAI_API_KEY:'local-test-only',OPENAI_BASE_URL:`http://127.0.0.1:${mock.address().port}/v1`,OPENAI_TEXTSMITH_MODEL:'gpt-6-astra',OPENAI_STORY_EDITOR_MODEL:'gpt-6-astra',OPENAI_STORY_EDITOR_REASONING_EFFORT:'high',OPENAI_STORY_EDITOR_REASONING_MODE:'',JOHNNY_CHAT_PASSWORD:'local-story-preview',STORY_EDITOR_DB_PATH:testDir+'/story.sqlite',JOHNNY_CHAT_USAGE_PATH:testDir+'/usage.json',JOHNNY_CHAT_LIBRARY_PATH:testDir+'/library.json',PUBLIC_BOARD_STORE_PATH:testDir+'/board.json',PUBLIC_BOARD_RATE_LIMIT_PATH:testDir+'/rate.json',CLOCKWISE_DB_PATH:testDir+'/clock.sqlite'},stdio:['ignore','ignore','pipe']});
let backendErrors='';child.stderr.on('data',d=>backendErrors+=d);process.on('exit',()=>child.kill());

let token;
for(let i=0;i<30;i++) {try { const r=await fetch(origin+'/api/chatbot-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'local-story-preview'})});token=(await r.json()).token;if(token)break;}catch{} await new Promise(r=>setTimeout(r,300));}
assert.ok(token,'local backend available: '+backendErrors);
const auth={Authorization:`Bearer ${token}`};
for(const mode of ['single','split']) {
 const r=await fetch(origin+'/api/textsmith',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input: mode==='split'?'RETRY appointment update':'Estimate for Mike is $285 Friday afternoon if it works.',mode})});
 assert.equal(r.status,200);const data=await r.json();assert.equal(data.messages.length,mode==='split'?2:1);assert.ok(data.stats.every(s=>s.characters<=s.limit));
}
const expert=await fetch(origin+'/api/textsmith',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input:'EXPERT: Tell Mike his estimate is $285 and ask whether Friday afternoon works.',mode:'single',tone:'expert'})});
assert.equal(expert.status,200);
assert.equal(attempts,4,'overlong pair repaired once without dropping second message');
const empty=await fetch(origin+'/api/textsmith',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(empty.status,400);
console.log('PASS: real endpoint single/pair output, character stats, overlong pair repair, empty-input validation, Astra request parameters.');
child.kill();mock.close();
