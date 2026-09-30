import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {createStoryQueue,assertStoryLease} from '../lib/story-queue.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const path=()=>mkdtempSync(tmpdir()+'/story-queue-')+'/queue.sqlite';
test('two workers cannot claim one job and a pause fences late writes',async()=>{
 const file=path();let release,started;const ready=new Promise(r=>started=r),gate=new Promise(r=>release=r);let calls=0;
 const run=async()=>{calls++;started();await gate;const db=new DatabaseSync(file);try{assertStoryLease(db);}finally{db.close();}};
 const a=createStoryQueue({path:file,run,onFailure:()=>{throw Error('lease loss should not mark failure');}});
 const b=createStoryQueue({path:file,run,onFailure:()=>{}});a.init();a.enqueue('one');
 const working=a.tick();await ready;await b.tick();assert.equal(calls,1);assert.equal(a.pause('one'),1);release();await working;assert.equal(a.info('one').state,'paused');
 a.stop();b.stop();
});
test('expired ownership is recovered and temporary errors retry with bounded attempts',async()=>{
 const file=path();let calls=0,failures=[];
 const q=createStoryQueue({path:file,retryDelay:1,run:async()=>{calls++;if(calls<3)throw Object.assign(new Error('busy'),{status:503});},onFailure:async(id,e,retry)=>failures.push(retry)});
 q.init();q.enqueue('two');const db=new DatabaseSync(file);db.prepare("UPDATE story_worker_queue SET state='running',owner='dead-process',lease_until=1 WHERE job_id='two'").run();db.close();
 await q.tick();await sleep(5);await q.tick();await sleep(5);await q.tick();assert.equal(q.info('two').state,'completed');assert.deepEqual(failures,[true,true]);assert.equal(calls,3);q.stop();
});
test('permanent errors pause for review and only explicit resume resets them',async()=>{
 const q=createStoryQueue({path:path(),run:async()=>{throw Object.assign(new Error('invalid request'),{status:400});},onFailure:async()=>{}});
 q.init();q.enqueue('three');await q.tick();assert.equal(q.info('three').state,'failed');q.enqueue('three');assert.equal(q.info('three').state,'failed');q.enqueue('three',true);assert.equal(q.info('three').state,'queued');q.stop();
});
