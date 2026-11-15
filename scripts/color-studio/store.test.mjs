import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
let sequence=0;
const fixture=()=>({id:'alpine',title:'Alpine',category:'Landscapes',puzzle:{geometryVersion:4,regions:[{color:0},{color:1}],map:[0,1]},filled:[],selected:0,updated:1,thumbnail:'preview'});
async function store(){globalThis.indexedDB=new IDBFactory();return import(`../../public/color-studio/store.js?test=${++sequence}`);}
function open(version){return new Promise((resolve,reject)=>{const request=indexedDB.open('johnny-color-studio',version);request.onupgradeneeded=()=>{for(const name of ['paintings','cards'])request.result.createObjectStore(name,{keyPath:'id'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
function transaction(db,names,callback){return new Promise((resolve,reject)=>{const tx=db.transaction(names,'readwrite');callback(tx);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});}

test('version-one saves open unchanged, acquire small progress, and export complete backups',async()=>{
  const s=await store(),db=await open(1),original={...fixture(),filled:[0]};
  await transaction(db,['paintings','cards'],tx=>{tx.objectStore('paintings').put(original);tx.objectStore('cards').put({id:original.id,done:1});});db.close();
  const record=await s.getPainting('alpine');assert.deepEqual(record,original);
  const updated={...record,filled:[0,1],history:[{id:1,color:1}],view:{zoom:5,x:.4,y:.6},updated:2};await s.savePainting(updated);
  assert.deepEqual(await s.getPainting('alpine'),updated);assert.deepEqual(await s.allPaintings(),[updated]);assert.equal((await s.listCards())[0].done,2);
});

test('repeated progress saves never rewrite geometry, while replacement artwork does',async t=>{
  const s=await store(),record=fixture(),writes=[];const original=IDBObjectStore.prototype.put;
  t.mock.method(IDBObjectStore.prototype,'put',function(value,...args){writes.push({store:this.name,value});return original.call(this,value,...args);});
  await s.savePainting(record);
  for(let i=0;i<4;i++)await s.savePainting({...record,filled:[0],view:{zoom:2+i,x:.5,y:.5},updated:i+2});
  assert.equal(writes.filter(w=>w.store==='paintings').length,1);
  assert.ok(writes.filter(w=>w.store==='progress').every(w=>!('puzzle' in w.value)));
  const replacement={...record,puzzle:structuredClone(record.puzzle),filled:[1]};await s.savePainting(replacement);
  assert.equal(writes.filter(w=>w.store==='paintings').length,2);assert.deepEqual(await s.getPainting(record.id),replacement);
});

test('a failed first save leaves no partial painting and retry still writes the artwork',async t=>{
  const s=await store(),record=fixture(),original=IDBObjectStore.prototype.put;let fail=true;
  t.mock.method(IDBObjectStore.prototype,'put',function(value,...args){if(this.name==='cards'&&fail){fail=false;throw new DOMException('Quota exceeded','QuotaExceededError');}return original.call(this,value,...args);});
  await assert.rejects(s.savePainting(record),{name:'QuotaExceededError'});
  assert.equal(await s.getPainting(record.id),undefined);assert.deepEqual(await s.listCards(),[]);
  await s.savePainting(record);assert.deepEqual(await s.getPainting(record.id),record);
});

test('a failed later save keeps the prior progress and gallery card together',async t=>{
  const s=await store(),record=fixture();await s.savePainting(record);const original=IDBObjectStore.prototype.put;
  t.mock.method(IDBObjectStore.prototype,'put',function(value,...args){if(this.name==='cards')throw new Error('Disk full');return original.call(this,value,...args);});
  await assert.rejects(s.savePainting({...record,filled:[0]}),/Disk full/);
  assert.deepEqual(await s.getPainting(record.id),record);assert.equal((await s.listCards())[0].done,0);
});

test('upgrades archive complete prior progress and deleting removes all three records',async()=>{
  const s=await store(),original={...fixture(),filled:[0],history:[{id:0,color:0}]};await s.savePainting(original);
  const updated={...original,puzzle:{geometryVersion:5,regions:[{color:0}],map:[0]},filled:[],history:[],previousEditionId:'alpine-old'};await s.saveUpgrade(original,updated);
  const archive=await s.getPainting('alpine-old');assert.deepEqual(archive.puzzle,original.puzzle);assert.deepEqual(archive.filled,[0]);assert.deepEqual(archive.history,original.history);assert.equal(archive.archived,true);
  assert.deepEqual(await s.getPainting('alpine'),updated);assert.equal((await s.allPaintings()).length,2);
  await s.deletePainting('alpine');assert.equal(await s.getPainting('alpine'),undefined);assert.equal((await s.allPaintings()).length,1);assert.equal((await s.listCards()).length,1);
  await s.savePainting({...original,filled:[]});assert.deepEqual((await s.getPainting('alpine')).filled,[]);
});

test('another tab replacing or deleting a painting cannot leave progress attached to wrong geometry',async()=>{
  const first=await store(),second=await import(`../../public/color-studio/store.js?test=${++sequence}`),original=fixture();
  await first.savePainting(original);
  await second.savePainting({...original,puzzle:{geometryVersion:4,regions:[{color:1}],map:[0]}});
  await first.savePainting({...original,filled:[1]});assert.deepEqual((await second.getPainting('alpine')).puzzle,original.puzzle);
  await second.deletePainting('alpine');await first.savePainting({...original,filled:[0]});assert.deepEqual((await second.getPainting('alpine')).filled,[0]);
});

test('an old open tab blocks migration with a useful error and closing it permits a safe retry',async()=>{
  const s=await store(),old=await open(1),record={...fixture(),filled:[0]};
  await transaction(old,['paintings'],tx=>tx.objectStore('paintings').put(record));
  await assert.rejects(s.getPainting('alpine'),{name:'StorageBlockedError'});old.close();
  assert.deepEqual(await s.getPainting('alpine'),record);
});
