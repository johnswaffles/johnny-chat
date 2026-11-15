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
