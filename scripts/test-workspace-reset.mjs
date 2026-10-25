import {editorialQualityLabel} from '../public/story-editor/quality-label.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceReset} from '../public/story-editor/workspace-reset.mjs';
for(const active of [true,false])test(`reset preserves server data and confirms ${active?'active':'paused/completed'} work before clearing`,async()=>{
 const calls=[];const reset=createWorkspaceReset({getWork:async()=>({projectId:'saved',active}),confirm:async work=>{calls.push(['confirm',work.active]);return true;},stop:async id=>{calls.push(['stop',id]);return {stopped:true};},clear:async()=>calls.push(['clear']),busy:v=>calls.push(['busy',v])});
 assert.equal(await reset(),true);assert.deepEqual(calls,[['busy',true],['confirm',active],['stop','saved'],['clear'],['busy',false]]);
});
test('repeated clicks share one stop and one reset; confirmation cancellation preserves unsaved text',async()=>{
 let release,stops=0,clears=0;const gate=new Promise(r=>release=r);let accept=true;
 const reset=createWorkspaceReset({getWork:async()=>({projectId:'saved',active:true}),confirm:async()=>{await gate;return accept;},stop:async()=>{stops++;return {stopped:true};},clear:()=>clears++,busy:()=>{}});
 const pending=reset();assert.equal(await reset(),false);release();await pending;assert.equal(stops,1);assert.equal(clears,1);accept=false;assert.equal(await reset(),false);assert.equal(stops,1);assert.equal(clears,1);
});
test('failed or uncertain stop never clears the workspace and can recheck without generation',async()=>{
 let stopped=false,clears=0;const reset=createWorkspaceReset({getWork:async()=>({projectId:'saved'}),confirm:async()=>true,stop:async()=>({stopped}),clear:()=>clears++,busy:()=>{}});
 await assert.rejects(reset(),/Stopping could not be confirmed/);assert.equal(clears,0);stopped=true;assert.equal(await reset(),true);assert.equal(clears,1);
});
test('empty workspace reset does not call server cancellation and can be repeated',async()=>{
 let clears=0;const reset=createWorkspaceReset({getWork:async()=>({}),confirm:async()=>true,stop:()=>assert.fail(),clear:()=>clears++,busy:()=>{}});await reset();await reset();assert.equal(clears,2);
});

import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {editorialPrompt,PUBLICATION_POLISH} from '../public/story-editor/prompt-model.mjs';
const html=readFileSync(new URL('../public/story-editor/index.html',import.meta.url),'utf8');
const code=readFileSync(new URL('../public/story-editor/story-editor.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/\}\)\(\);\s*$/,'this.workspaceTest={state,startOver,loadProjects,loadProject,pollAutopilot};})();');
class Element{
 constructor(tag='div'){this.tagName=tag;this.value='';this.textContent='';this.hidden=false;this.disabled=false;this.open=false;this.files=[];this.children=[];this.dataset={};this.style={};this.events={};this.attributes={};this.classList={add(){},remove(){},toggle(){}};}
 addEventListener(t,fn){(this.events[t]||=[]).push(fn);}setAttribute(k,v){this.attributes[k]=v;}removeAttribute(k){delete this.attributes[k];}querySelector(){return new Element();}querySelectorAll(){return [];}appendChild(n){this.children.push(n);}append(...n){this.children.push(...n);}replaceChildren(...n){this.children=n;this.textContent='';}focus(){}scrollIntoView(){}showModal(){this.open=true;this.onShow?.();}close(){this.open=false;}
}
async function workspaceHarness({accept=true,workActive=false,blank=true,gate}={}){
 const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 const textareaIds=[...html.matchAll(/<textarea[^>]*id="([^"]+)"/g)].map(m=>m[1]);const dialogIds=[...html.matchAll(/<dialog[^>]*id="([^"]+)"/g)].map(m=>m[1]);
 elements.get('setup-prompt').value='novel';elements.get('mode-select').value='line';elements.get('upload-form').reset=()=>{elements.get('file-input').files=[];elements.get('file-input').value='';elements.get('intent-input').value='';elements.get('setup-prompt').value='novel';};
 elements.get('reset-confirm').onShow=()=>{confirms.push(elements.get('reset-confirm-message').textContent);queueMicrotask(()=>elements.get(accept?'reset-confirm-accept':'reset-confirm-cancel').events.click[0]());};
 const store=new Map(blank?[['johnny-story-workspace','']]:[]),calls=[],events=[],confirms=[];
 const project={id:'saved',title:'Synthetic manuscript',filename:'sample.txt'},sections=[{id:'s1',kind:'paragraph',chapterIndex:1,sceneIndex:1,paragraphIndex:1,originalText:'Original synthetic passage.',editedText:'Saved synthetic revision.'}];
 const document={cookie:'',activeElement:null,body:new Element(),getElementById:id=>elements.get(id),createElement:()=>new Element(),querySelector:()=>null,querySelectorAll:q=>q==='textarea'?textareaIds.map(id=>elements.get(id)):q==='dialog'?dialogIds.map(id=>elements.get(id)):[],addEventListener(){},dispatchEvent:e=>events.push(e)};
 const window={location:{origin:'http://local.test'},confirm:text=>{confirms.push(text);return accept;},setTimeout:()=>1,clearTimeout(){},addEventListener(){},innerWidth:1000};
 const fetch=async(url,options={})=>{calls.push({url,method:options.method});if(gate&&url.endsWith('/autopilot/job'))await gate;if(url.endsWith('/work-status'))return Response.json({ok:true,active:workActive});if(url.endsWith('/stop-work'))return Response.json({ok:true,stopped:true});if(url.endsWith('/projects'))return Response.json({ok:true,projects:[project]});if(url.endsWith('/autopilot/job'))return Response.json({ok:true,job:{id:'job',status:'completed',totalChunks:1,completedChunks:1}});return Response.json({ok:true,project,sections,bible:{},edits:[],autopilot:null});};
 const context=vm.createContext({window,document,fetch,Response,Headers,URL,FormData,sessionStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts?.detail;}},createWorkspaceReset,editorialPrompt,PUBLICATION_POLISH,editorialQualityLabel,Intl,setTimeout:()=>1,clearTimeout(){}});
 vm.runInContext(code,context);await new Promise(r=>setImmediate(r));return {api:context.workspaceTest,elements,calls,events,confirms,store,sections};
}
test('real workspace reset clears setup, preserves library, survives reload, and permits explicit library reopening',async()=>{
 const h=await workspaceHarness();await h.api.loadProject('saved');h.elements.get('intent-input').value='A long custom prompt '.repeat(500);h.elements.get('setup-prompt').value='custom';h.elements.get('studio-input').value='Unsent idea';h.elements.get('file-input').files=[{name:'old.txt'}];
 await h.api.startOver();assert.equal(h.api.state.project,null);assert.equal(h.api.state.selectedId,'');assert.equal(h.api.state.autopilotJob,null);assert.equal(h.api.state.sections.length,0);assert.equal(h.elements.get('setup-prompt').value,'novel');assert.equal(h.elements.get('intent-input').value,'');assert.equal(h.elements.get('studio-input').value,'');assert.equal(h.elements.get('file-input').files.length,0);assert.equal(h.elements.get('upload-dialog').open,true);assert.equal(h.api.state.projects.length,1);assert.equal(h.store.get('johnny-story-workspace'),'');assert.match(h.confirms[0],/Unsent text/);
 await h.api.loadProjects();assert.equal(h.api.state.project,null,'refresh/back-style restoration must not auto-open the old project');const reload=await workspaceHarness({blank:true});assert.equal(reload.api.state.project,null);await h.api.startOver();await h.api.loadProject('saved');assert.equal(h.api.state.project.id,'saved');assert.equal(h.api.state.sections[0].editedText,'Saved synthetic revision.');assert.equal(h.calls.some(c=>c.method==='DELETE'),false);
});
test('confirmation rejection leaves active job, unsaved prompt and selection unchanged',async()=>{
 const h=await workspaceHarness({accept:false,workActive:true});await h.api.loadProject('saved');h.elements.get('intent-input').value='Unsaved custom prompt';h.api.state.autopilotJob={id:'job',status:'running'};assert.equal(await h.api.startOver(),false);assert.equal(h.api.state.selectedId,'s1');assert.equal(h.elements.get('intent-input').value,'Unsaved custom prompt');assert.equal(h.calls.some(c=>c.url.endsWith('/stop-work')),false);assert.match(h.confirms[0],/Stop editing and start over/);
});
test('late full-edit polling result cannot repopulate a reset workspace',async()=>{
 let release;const h=await workspaceHarness({gate:new Promise(r=>release=r)});await h.api.loadProject('saved');h.api.state.autopilotJob={id:'job',status:'running'};const pending=h.api.pollAutopilot();await h.api.startOver();release();await pending;assert.equal(h.api.state.project,null);assert.equal(h.api.state.autopilotJob,null);assert.equal(h.elements.get('export-docx').disabled,true);
});

test('reauthentication status polling preserves unsent brief and notes without reloading the project',async()=>{const h=await workspaceHarness();await h.api.loadProject('saved');for(const id of ['autopilot-intent','studio-input','studio-note','bible-continuity','edit-note'])if(h.elements.has(id))h.elements.get(id).value='Unsent '+id;h.api.state.autopilotJob={id:'job',status:'running'};const before=h.calls.length;await h.api.pollAutopilot({refreshCompleted:false});for(const id of ['autopilot-intent','studio-input','studio-note','bible-continuity','edit-note'])if(h.elements.has(id))assert.equal(h.elements.get(id).value,'Unsent '+id);assert.ok(h.calls.slice(before).every(c=>c.url.endsWith('/autopilot/job')&&(!c.method||c.method==='GET')));assert.equal(h.api.state.project.id,'saved');});
