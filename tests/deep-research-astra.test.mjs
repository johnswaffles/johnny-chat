import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
const source = await readFile(new URL('../server.js', import.meta.url), 'utf8');
const route = source.slice(source.indexOf('app.post("/api/deep-research",'), source.indexOf('app.post("/api/community-speech",'));
function harness(response = {status:'completed',model:'gpt-6-astra',text:'Research report'}) {
  let handler; const calls=[]; const usage=[];
  vm.runInNewContext(source.match(/const DEEP_RESEARCH_MODEL = [^;]+;/)[0]+'\n'+route, {
    app:{post:(_,fn)=>handler=fn},OPENAI_GPT54_MODEL:'legacy-model',
    inferWidgetProfile:req=>req.body.profile,
    requireChatbotSession:(req,res)=>req.auth||(res.status(401).json({detail:'Unauthorized'}),false),
    readJohnnyChatLibrary:async()=>({items:[]}),selectLibraryItems:()=>[],libraryContext:()=>'',
    getJohnnyPersona:()=> 'Existing persona',
    openai:{responses:{create:async data=>{calls.push(data);return response;}}},
    extractResponseText:r=>r.text,extractResponseSources:()=>[{title:'Source',url:'https://example.com'}],
    recordJohnnyChatUsage:(...args)=>usage.push(args),
  });
  return {calls,usage,async run(body={},auth=true){
    const res={statusCode:200,status(code){this.statusCode=code;return this;},json(data){this.body=data;return this;}};
    await handler({body:{profile:'gpt54',question:'Compare the evidence',...body},auth},res);return res;
  }};
}
test('invoked Deep Research pins Astra xhigh and preserves research context and citations',async()=>{
  const h=harness();const r=await h.run({projectTitle:'Test project',projectNotes:'Budget constraint',library:'Reference material',history:[{role:'user',content:'Earlier question'}]});
  assert.equal(r.statusCode,200);assert.equal(h.calls[0].model,'gpt-6-astra');assert.equal(h.calls[0].reasoning.effort,'xhigh');
  assert.equal(h.calls[0].tools[0].type,'web_search');
  assert.match(h.calls[0].input.at(-1).content,/Budget constraint/);assert.match(h.calls[0].input.at(-1).content,/Reference material/);
  assert.equal(h.calls[0].input[1].content,'Earlier question');assert.equal(r.body.sources.length,1);
  assert.equal(r.body.reply,'Research report');assert.equal(r.body.reasoningEffort,'xhigh');assert.equal(r.body.model,'gpt-6-astra');
});
test('research access and empty question validation prevent provider calls',async()=>{
  const h=harness();assert.equal((await h.run({},false)).statusCode,401);
  assert.equal((await h.run({profile:'ai'})).statusCode,400);
  assert.equal((await h.run({question:'  '})).statusCode,400);assert.equal(h.calls.length,0);
});
test('unfinished research cannot be saved as a completed report',async()=>{
  for(const response of [{status:'incomplete',text:'Partial report'},{status:'completed',text:''}]){
    const h=harness(response);const r=await h.run();assert.equal(r.statusCode,502);assert.equal(r.body.reply,undefined);assert.equal(h.usage.length,0);
  }
});
