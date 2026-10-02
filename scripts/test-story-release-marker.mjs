import {test} from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/story-editor/_middleware.js';
const marker='reviewed-passage-splits-v2';
test('frontend marker exposes only release metadata while access gate and reauthentication stay intact',async()=>{
 let forwarded=false;
 const response=await onRequest({request:new Request('https://example.test/story-editor/'),env:{},next:()=>{forwarded=true;}});
 assert.equal(forwarded,false);assert.equal(response.status,200);assert.equal(response.headers.get('X-Story-Editor-Chapters'),marker);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.match(await response.text(),/Story Editor Access/);
 const reauth=await onRequest({request:new Request('https://example.test/story-editor/?reauth=1'),env:{},next:()=>{throw Error('Must remain gated');}});
 assert.equal(reauth.status,200);assert.match(reauth.headers.get('set-cookie'),/Max-Age=0/);assert.equal(reauth.headers.get('X-Story-Editor-Chapters'),marker);
});
test('authenticated streaming response retains status, body and headers',async()=>{
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json'}});
 try {
  const response=await onRequest({request:new Request('https://example.test/story-editor/',{headers:{Cookie:'gpt54_session=synthetic-session'}}),env:{},next:()=>new Response('synthetic private shell',{status:200,headers:{'Cache-Control':'private','Content-Type':'text/html','ETag':'fixture-etag'}})});
  assert.equal(response.status,200);assert.equal(await response.text(),'synthetic private shell');assert.equal(response.headers.get('ETag'),'fixture-etag');assert.equal(response.headers.get('Cache-Control'),'private');assert.equal(response.headers.get('Content-Type'),'text/html');assert.equal(response.headers.get('X-Story-Editor-Chapters'),marker);
 } finally {globalThis.fetch=oldFetch;}
});
