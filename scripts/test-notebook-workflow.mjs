import {test} from 'node:test';
import assert from 'node:assert/strict';
import {notebookJourney,notebookReference} from '../public/story-editor/notebook-model.mjs';
test('one next step follows imported draft, first revision, and collaborative review',()=>{
 assert.equal(notebookJourney().action,'create');
 const busy=notebookJourney({job:{status:'running',phase:'editing',currentChunk:2,totalChunks:8,completedChunks:1}});assert.equal(busy.action,'working');assert.ok(busy.progress>0&&busy.progress<100);
 assert.equal(notebookJourney({job:{status:'failed',error:'Stopped safely.'}}).action,'resume');
 assert.equal(notebookJourney({job:{status:'completed'}}).action,'begin');
 assert.equal(notebookJourney({job:{status:'completed'},bookmark:{sectionId:'saved'}}).action,'continue');
 assert.equal(notebookJourney({hasRevision:true,walkthrough:true}).action,'continue');
});
test('source references resolve only actual chapter and passage targets',()=>{
 const chapters=[{index:1,passages:[{id:'a'},{id:'b'}]},{index:3,passages:[{id:'c'}]}];
 assert.equal(notebookReference(chapters,1,2),'b');assert.equal(notebookReference(chapters,3,1),'c');assert.equal(notebookReference(chapters,2,1),null);assert.equal(notebookReference(chapters,1,0),null);assert.equal(notebookReference(chapters,1,12),null);
});

test('provider activity and stage estimates never claim unsaved revision chunks are complete',()=>{
 const state=notebookJourney({job:{status:'running',phase:'reading',currentChunk:10,totalChunks:10,completedChunks:0,savedStageResults:9,provider:{state:'in_progress',model:'gpt-6-astra',effort:'max',mode:'pro',checkedAt:'2026-10-24T17:00:00Z'}}});
 assert.match(state.detail,/0\/10 revision sections saved/);assert.match(state.detail,/9 stage results checkpointed/);assert.match(state.detail,/Provider: in_progress/);assert.equal(state.action,'working');
});
