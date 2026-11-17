import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog} from '../../public/color-studio/art.js';
import {isPaintingAvailable,previewPaintingId,nextUnfinishedColor} from '../../public/color-studio/experience.js';

test('only the alpine preview can open, including previously saved or custom pictures',()=>{
  assert.deepEqual(catalog.filter(a=>isPaintingAvailable(a.id)).map(a=>a.id),[previewPaintingId]);
  assert.equal(isPaintingAvailable('custom-saved-picture'),false);
  assert.equal(isPaintingAvailable('fox-stream'),false);
});
test('finishing a color advances in order, skips completed colors and wraps to unfinished ones',()=>{
  assert.equal(nextUnfinishedColor([0,3,0,7],0),1);
  assert.equal(nextUnfinishedColor([0,0,0,7],1),3);
  assert.equal(nextUnfinishedColor([2,0,0,0],3),0);
  assert.equal(nextUnfinishedColor([0,0,0,0],3),3);
  assert.equal(nextUnfinishedColor([0,0,4,0],2),2);
});

test('valid undo and redo survive reopening while old and malformed saves remain safe',async()=>{
  const {paintingHistory}=await import('../../public/color-studio/experience.js');
  const record={puzzle:{regions:[{color:0},{color:1},{color:0}]},filled:[0,1],history:[{id:0,color:0},{id:1,color:1}],redo:[{id:2,color:0}]};
  assert.deepEqual(paintingHistory(record),{history:record.history,redo:record.redo});
  assert.notEqual(paintingHistory(record).history,record.history);
  assert.deepEqual(paintingHistory({...record,history:undefined,redo:undefined}),{history:[],redo:[]});
  for(const history of [[{id:9,color:0}],[{id:0,color:1}],[{id:2,color:0}],[{id:0,color:0},{id:0,color:0}],{}])assert.deepEqual(paintingHistory({...record,history}).history,[]);
  assert.deepEqual(paintingHistory({...record,redo:[{id:0,color:0}]}).redo,[]);
  assert.deepEqual(record.filled,[0,1]);
});

test('palette rings and color milestones reflect real progress, including undo and restored work',async()=>{
  const {colorProgress,colorCompletionMessage}=await import('../../public/color-studio/experience.js');
  const puzzle={palette:[[],[],[]],regions:[{color:0},{color:0},{color:1}]},filled=new Set([0]);
  let progress=colorProgress(puzzle,filled);assert.deepEqual(progress.fractions,[.5,0,0]);assert.equal(progress.completed,0);assert.equal(colorCompletionMessage(progress,0),'');
  filled.add(1);progress=colorProgress(puzzle,filled);assert.deepEqual(progress.fractions,[1,0,0]);assert.equal(colorCompletionMessage(progress,0),'Color 1 complete · 1 of 2 colors finished');
  filled.delete(1);assert.equal(colorProgress(puzzle,filled).completed,0);
  filled.add(1);filled.add(2);assert.equal(colorProgress(puzzle,filled).completed,2);assert.equal(colorCompletionMessage(colorProgress(puzzle,filled),2),'');
});

test('hints prefer comfortable visible spaces, cycle past the current hint, and never choose filled/wrong colors',async()=>{
  const {findHint}=await import('../../public/color-studio/experience.js');
  const puzzle={regions:[{color:0,x:50,y:50,radius:1},{color:0,x:65,y:60,radius:12},{color:0,x:90,y:50,radius:15},{color:1,x:45,y:45,radius:30}]};
  const viewport={x:0,y:0,width:100,height:100,scale:2};
  assert.deepEqual(findHint(puzzle,new Set(),0,viewport),{id:1,anchor:{x:65,y:60,radius:12},keepView:true});
  assert.equal(findHint(puzzle,new Set(),0,viewport,1).id,2);
  assert.equal(findHint(puzzle,new Set([1,2]),0,viewport).id,0);
  assert.equal(findHint(puzzle,new Set([0,1,2]),0,viewport),null);
  assert.equal(findHint(puzzle,new Set([0,2]),0,viewport,1).id,1,'last remaining space stays findable');
});

test('a large region with its main label offscreen can be hinted through a visible interior anchor',async()=>{
  const {findHint}=await import('../../public/color-studio/experience.js');
  const puzzle={regions:[{color:0,x:200,y:50,radius:20,labels:[{x:50,y:50,radius:12}]}]};
  assert.deepEqual(findHint(puzzle,new Set(),0,{x:0,y:0,width:100,height:100,scale:1}),{id:0,anchor:{x:50,y:50,radius:12},keepView:true});
});

test('the final tiny space never displays a premature 100 percent or Complete badge',async()=>{
  const {progressPercent}=await import('../../public/color-studio/experience.js');
  assert.equal(progressPercent(727,728),99);assert.equal(progressPercent(728,728),100);assert.equal(progressPercent(0,728),0);assert.equal(progressPercent(364,728),50);assert.equal(progressPercent(0,0),0);
});
