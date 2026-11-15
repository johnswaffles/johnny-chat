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
