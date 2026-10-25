import {test} from 'node:test';
import assert from 'node:assert/strict';
import {revisionTracker,renderRevisionTracker} from '../public/story-editor/revision-tracker.mjs';
const now=Date.parse('2026-10-24T18:00:00Z');
const job=(phase,completedChunks=0,rest={})=>({status:'running',phase,completedChunks,totalChunks:10,currentChunk:completedChunks+1,provider:{state:'in_progress',checkedAt:new Date(now-5000).toISOString()},...rest});
test('read and plan never count notes or a stage estimate as saved revised prose',()=>{
 for(const phase of ['reading','planning']){const v=revisionTracker({job:job(phase,0,{currentChunk:9,savedStageResults:8}),now});assert.equal(v.saved,0);assert.equal(v.meter.value,0);assert.match(v.announcement,/0 of 10 revision sections saved/);assert.match(v.detail,phase==='reading'?/does not mean any prose/:/before revised sections/);assert.doesNotMatch(v.announcement,/%|ETA/);}
});
test('revision fill uses only actual saved sections and known total; later stages keep revision count separate',()=>{
 const v=revisionTracker({job:job('editing',3),now});assert.deepEqual(v.meter,{value:3,max:10});assert.match(v.title,/Revising section 4 of 10/);assert.deepEqual(v.milestones.map(x=>x.state),['done','done','current','next','next']);
 for(const phase of ['polishing','review']){const x=revisionTracker({job:job(phase,10,{currentChunk:2}),now});assert.equal(x.saved,10);assert.equal(x.milestones.find(m=>m.id===phase).state,'current');assert.equal(x.state,'active');assert.notEqual(x.title,'Revision ready for your review');}
});
test('provider queued and working are distinct; stale or disconnected status never implies live execution',()=>{
 const q=revisionTracker({job:job('queued',0,{status:'queued',provider:{state:'queued'}}),now});assert.equal(q.providerLabel,'Provider queued');
 const working=revisionTracker({job:job('editing',2),now});assert.equal(working.providerLabel,'Model working');assert.equal(working.motion,true);
 for(const opts of [{connection:'reconnecting'},{connection:'auth'},{job:job('editing',2,{provider:{state:'in_progress',checkedAt:new Date(now-300000).toISOString()}})}]){const v=revisionTracker({job:job('editing',2),now,...opts});assert.equal(v.state,'reconnecting');assert.equal(v.motion,false);assert.match(v.detail,/does not confirm whether/);assert.equal(v.saved,2);}
});
test('paused, failed, completed and unknown states tell the truth without starting work',()=>{
 const paused=revisionTracker({job:job('paused',3,{status:'failed',provider:{stage:'story_autopilot_chunk',state:'in_progress'}}),now});assert.equal(paused.state,'paused');assert.equal(paused.canPause,false);assert.equal(paused.motion,false);assert.match(paused.providerLabel,/was active at last check/);
 const failure=revisionTracker({job:job('error',3,{status:'failed',error:'A specific safe error.'}),now});assert.equal(failure.detail,'A specific safe error.');assert.equal(failure.state,'failed');
 const done=revisionTracker({job:job('complete',10,{status:'completed'}),now});assert.ok(done.milestones.every(x=>x.state==='done'));assert.equal(done.state,'complete');assert.match(done.title,/your review/);
 const unknown=revisionTracker({job:job('unrecognized',null,{status:'unrecognized',provider:null,totalChunks:0}),now});assert.equal(unknown.meter,null);assert.equal(unknown.count,'—');assert.equal(unknown.title,'Editorial status unavailable');assert.ok(unknown.milestones.every(x=>x.state==='unknown'));
});
test('long running requests get an honest explanation, never an invented ETA or optimistic count',()=>{
 const v=revisionTracker({job:job('editing',3,{provider:{state:'in_progress',submittedAt:new Date(now-18*60000).toISOString(),checkedAt:new Date(now-1000).toISOString()}}),now});assert.match(v.detail,/taking time/);assert.equal(v.saved,3);assert.equal(v.motion,true);assert.doesNotMatch(JSON.stringify(v),/ETA|minutes remaining|percent/);
});
test('invalid, missing and inconsistent counts never manufacture a denominator or overflow the meter',()=>{
 for(const data of [{completedChunks:null},{completedChunks:-3},{totalChunks:0},{totalChunks:NaN},{completedChunks:12,totalChunks:10}]){const v=revisionTracker({job:job('editing',0,data),now});assert.equal(v.meter,null);if(data.completedChunks===12)assert.equal(v.count,'12');}
});
test('repeated render does not accumulate DOM, announce timestamps repeatedly or leave stale paused/completed state',()=>{
 const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},style:{},attributes:{},textContent:'',hidden:false,setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];}});return nodes.get(id);};
 let announcements=0,text='';Object.defineProperty($('revision-tracker-live'),'textContent',{get:()=>text,set:v=>{text=v;announcements++;}});
 renderRevisionTracker($,{job:job('editing',3),now});assert.equal($('revision-tracker-fill').style.width,'30%');assert.equal($('notebook-job-meter').attributes['aria-valuenow'],'3');
 const initialSize=nodes.size;for(let i=0;i<100;i++)renderRevisionTracker($,{job:job('editing',3),now:now+i*10});assert.equal(announcements,1);assert.equal(nodes.size,initialSize);
 renderRevisionTracker($,{job:job('complete',10,{status:'completed'}),now});assert.equal($('notebook-stop-full').hidden,true);assert.equal($('revision-step-review').dataset.state,'done');
 renderRevisionTracker($,{job:job('mystery',null,{totalChunks:0,provider:null}),now});assert.equal($('notebook-job-meter').attributes['aria-valuenow'],undefined);assert.equal($('revision-tracker-fill').style.width,'0%');assert.equal($('revision-step-review').attributes['aria-current'],undefined);
 renderRevisionTracker($,{job:null});assert.equal($('notebook-job-progress').hidden,true);
});

test('motion is optional and small-text tracker colors meet WCAG AA contrast',async()=>{
 const {readFile}=await import('node:fs/promises');const css=await readFile(new URL('../public/story-editor/revision-tracker.css',import.meta.url),'utf8');assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);assert.match(css,/animation:none!important;transition:none!important/);
 const lum=h=>{const c=h.match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
 const color=selector=>{const start=css.indexOf(selector+'{');assert.ok(start>=0);const block=css.slice(start+selector.length+1,css.indexOf('}',start));const found=block.match(/(?:^|;)color:(#[0-9a-f]{6}|white)/i);assert.ok(found,selector);return found[1]==='white'?'ffffff':found[1].slice(1);};
 const surface=css.match(/linear-gradient\(120deg,#[0-9a-f]{6},#([0-9a-f]{6})\)/i)[1];
 for(const selector of ['.tracker-eyebrow','.tracker-milestones li','.tracker-detail','.tracker-check','.tracker-provider']){const values=[lum(color(selector)),lum(surface)].sort((a,b)=>b-a);assert.ok((values[0]+.05)/(values[1]+.05)>=4.5,selector);}
 const active='.tracker-milestones li[data-state="current"]>span';const activeBlock=css.slice(css.indexOf(active+'{'));const background=activeBlock.match(/background:#([0-9a-f]{6})/)[1];const values=[lum(color(active)),lum(background)].sort((a,b)=>b-a);assert.ok((values[0]+.05)/(values[1]+.05)>=4.5);
});
