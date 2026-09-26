import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
const server = await readFile(new URL('../server.js', import.meta.url), 'utf8');
const widget = await readFile(new URL('../public/voice-widget.js', import.meta.url), 'utf8');
const voiceRoute = server.slice(server.indexOf('app.post("/api/voice-think",'), server.indexOf('function cleanPortraitMemory'));
const uploadRoute = server.slice(server.indexOf('app.post("/upload",'), server.indexOf('app.post("/summarize-text",'));
function harness(route, result = { status: 'completed', model: 'gpt-6-astra', text: 'Careful answer' }) {
  let handler; const calls = [];
  vm.runInNewContext(route, {
    app: { post: (...args) => { handler = args.at(-1); } }, upload: { array: () => null },
    VOICE_DEEP_THINK_MODEL: 'gpt-6-astra', UPLOAD_VISION_MODEL: 'gpt-6-astra', OPENAI_API_KEY: 'test',
    normalizeWidgetProfile: p => p, inferWidgetProfile: () => 'ai', compactText: s => String(s || '').trim(),
    requireChatbotSession: (req, res) => req.auth || (res.status(401).json({error:'Unauthorized'}), false),
    getJohnnyPersona: p => `Scope for ${p}`, extractResponseText: r => r.text, extractResponseSources: () => [],
    openai: { responses: { create: async args => { calls.push(args); return result; } } },
    console: { log(){}, error(){}, warn(){} }, recordJohnnyChatUsage(){},
  });
  return { calls, async run(body, auth = false, files = []) {
    const res = { statusCode:200, status(n){this.statusCode=n;return this;}, json(data){this.body=data;return this;} };
    await handler({body, auth, files},res); return res;
  }};
}
test('voice handoff pins Astra xhigh and keeps Nova private', async () => {
  const h=harness(voiceRoute);
  assert.equal((await h.run({profile:'nova',request:'Think'})).statusCode,401);
  for(const profile of ['home','mowing','morrow']) assert.equal((await h.run({profile,request:'Think'},true)).statusCode,403);
  assert.equal(h.calls.length,0);
  for(const profile of ['ai','nova']) {
    const res=await h.run({profile,request:'Compare plans',context:'Budget constraints'},true);
    assert.equal(res.statusCode,200); assert.equal(res.body.model,'gpt-6-astra');
    assert.equal(h.calls.at(-1).reasoning.effort,'xhigh'); assert.equal(h.calls.at(-1).store,false);
    assert.match(h.calls.at(-1).input[0].content,new RegExp(profile));
  }
});
test('voice handoff rejects unfinished and empty results',async()=>{
  for(const result of [{status:'incomplete',text:'Partial'},{status:'completed',text:''}]) {
    const h=harness(voiceRoute,result); assert.equal((await h.run({profile:'ai',request:'Think'})).statusCode,502);
  }
});
test('Realtime exposes deep thinking only to supported profiles without leaking private tools',()=>{
  const src=server.slice(server.indexOf('function getRealtimeTools('),server.indexOf('function getJohnnyRealtimeInstructions('));
  const getTools=vm.runInNewContext(src+'\ngetRealtimeTools');
  for(const profile of ['ai','nova','morrow']) assert.ok(getTools(profile).some(t=>t.name==='think_deep'));
  for(const profile of ['ai','nova','home','mowing']) assert.ok(!getTools(profile).some(t=>t.name==='recall_conversation'));
  for(const profile of ['home','mowing']) assert.ok(!getTools(profile).some(t=>t.name==='think_deep'));
});
test('image uploads preserve OCR and analysis shape using Astra high',async()=>{
  const analysis={text:'OPEN 9 AM',scene_summary:'A shop sign',short_reply:'The shop opens at 9.',confidence:'high'};
  const h=harness(uploadRoute,{status:'completed',text:JSON.stringify(analysis)});
  const files=[{mimetype:'image/png',buffer:Buffer.from('fixture'),originalname:'sign.png'}];
  assert.equal((await h.run({profile:'nova'},false,files)).statusCode,401);
  assert.equal(h.calls.length,0);
  const res=await h.run({profile:'nova'},true,files);
  assert.equal(res.statusCode,200); assert.equal(res.body.text,analysis.text);
  assert.equal(res.body.imageAnalysis[0].confidence,'high');
  assert.equal(h.calls[0].model,'gpt-6-astra'); assert.equal(h.calls[0].reasoning.effort,'high');
  assert.equal(h.calls[0].input[0].content[1].type,'input_image');
  assert.equal(h.calls[0].text.format.type,'json_object');
});
test('unfinished or malformed vision output is not returned as completed analysis',async()=>{
  for(const result of [{status:'incomplete',text:'{}'},{status:'completed',text:'invalid JSON'}]) {
    const h=harness(uploadRoute,result);
    assert.equal((await h.run({profile:'ai'},false,[{mimetype:'image/png',buffer:Buffer.from('x')}])).statusCode,500);
  }
});
function widgetHarness(business=false) {
  const sent=[];let resolveFetch;const bubbles=[];
  const ctx=vm.createContext({AbortController,URL,console,setTimeout,clearTimeout,
    fetch:()=>new Promise(resolve=>{resolveFetch=resolve;}),document:{createElement:()=>({})}});
  vm.runInContext(widget.slice(0,widget.indexOf('// Global Init'))+'\nglobalThis.Widget=VoiceWidget;globalThis.Business=BusinessVoiceWidget;',ctx);
  const w=Object.create((business?ctx.Business:ctx.Widget).prototype);
  Object.assign(w,{dc:{readyState:'open',send:s=>sent.push(JSON.parse(s))},handledFunctionCalls:new Set(),messages:[],profile:business?'ai':'nova',deepToolsPending:0,deepResponseActive:true,deepQueue:[],itemBubbles:new Map(),businessToolsPending:0,businessQueue:[],homeResponseActive:true,homeQueuedTexts:[],homeConnectionGeneration:1,
    getBackendUrl:()=>'',getAuthHeaders:h=>h,scrollToBottom(){},updateState(){},
    createMessageBubble(){const b={appendChild(){}};bubbles.push(b);return b;}});
  return {w,sent,bubbles,resolve(data={result:'Astra answer',model:'gpt-6-astra',reasoningEffort:'xhigh'}){resolveFetch({ok:true,json:async()=>data});}};
}
for(const business of [false,true]) {
  test(`${business?'Johnny':'Nova'} deduplicates calls and waits for the active voice response`,async()=>{
    const h=widgetHarness(business);const call={name:'think_deep',call_id:'call-1',arguments:JSON.stringify({request:'Compare options'})};
    const pending=h.w.handleFunctionCall(call);await h.w.handleFunctionCall(call);h.resolve();await pending;
    assert.equal(h.sent.length,1);assert.equal(h.sent[0].item.type,'function_call_output');
    h.w.onDataChannelMessage({type:'response.done',response:{output:[{type:'function_call',...call}]}});
    assert.equal(h.sent.length,2);assert.equal(h.sent[1].type,'response.create');assert.equal(h.sent[1].response.tool_choice,'none');
  });
  test(`${business?'Johnny':'Nova'} drops deep answers from an old connection`,async()=>{
    const h=widgetHarness(business);const pending=h.w.handleFunctionCall({name:'think_deep',call_id:'old',arguments:'{"request":"Compare"}'});
    h.w.dc={readyState:'open',send:()=>assert.fail('Stale response sent')};h.resolve();await pending;assert.equal(h.sent.length,0);
  });
}
