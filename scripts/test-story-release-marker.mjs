import {test} from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/story-editor/_middleware.js';
const marker='reviewed-passage-splits-v2';
test('frontend marker exposes only release metadata while access gate and reauthentication stay intact',async()=>{
 let forwarded=false;
 const response=await onRequest({request:new Request('https://example.test/story-editor/'),env:{},next:()=>{forwarded=true;}});
 assert.equal(forwarded,false);assert.equal(response.status,200);assert.equal(response.headers.get('X-Story-Editor-Reader'),'chapter-reader-marin-async-v2');assert.equal(response.headers.get('X-Story-Editor-Chapters'),marker);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.match(await response.text(),/Story Editor Access/);
 const reauth=await onRequest({request:new Request('https://example.test/story-editor/?reauth=1'),env:{},next:()=>{throw Error('Must remain gated');}});
 assert.equal(reauth.status,200);assert.match(reauth.headers.get('set-cookie'),/Max-Age=0/);assert.equal(reauth.headers.get('X-Story-Editor-Chapters'),marker);
});
test('authenticated streaming response retains status, body and headers',async()=>{
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json'}});
 try {
  const response=await onRequest({request:new Request('https://example.test/story-editor/',{headers:{Cookie:'gpt54_session=synthetic-session'}}),env:{},next:()=>new Response('synthetic private shell',{status:200,headers:{'Cache-Control':'private','Content-Type':'text/html','ETag':'fixture-etag'}})});
  assert.equal(response.status,200);assert.equal(response.headers.get('X-Story-Editor-Reader'),'chapter-reader-marin-async-v2');assert.equal(await response.text(),'synthetic private shell');assert.equal(response.headers.get('ETag'),'fixture-etag');assert.equal(response.headers.get('Cache-Control'),'private');assert.equal(response.headers.get('Content-Type'),'text/html');assert.equal(response.headers.get('X-Story-Editor-Chapters'),marker);
  assert.equal(response.headers.get('X-Story-Editor-Studio'),'layered-literary-studio-v1');assert.equal(response.headers.get('X-Story-Editor-Quality'),'gpt-6.1-sol-pro-xhigh');assert.equal(response.headers.get('X-Story-Editor-Book-Drafts'),'versioned-chapter-canon-v1');assert.equal(response.headers.get('X-Story-Editor-Progress'),'saved-sections-provider-tracker-v1');assert.equal(response.headers.get('X-Story-Editor-Read-Lock'),'single-flight-loading-v1');assert.equal(response.headers.get('X-Story-Editor-Session-Recovery'),'explicit-unlock-preserve-work-v1');
 } finally {globalThis.fetch=oldFetch;}
});

test('explicit unlock still uses existing password gate, secure cookie and twelve-hour policy',async()=>{const oldFetch=globalThis.fetch;globalThis.fetch=async(url,options)=>{assert.ok(url.endsWith('/api/chatbot-access'));assert.deepEqual(JSON.parse(options.body),{password:'synthetic-only-password'});return Response.json({ok:true,token:'synthetic-new-session',maxAge:43200});};try{const response=await onRequest({request:new Request('https://example.test/story-editor/?reauth=1',{method:'POST',body:new URLSearchParams({password:'synthetic-only-password'})}),env:{},next:()=>{throw Error('Must authenticate first');}});assert.equal(response.status,303);assert.equal(response.headers.get('Location'),'https://example.test/story-editor/');assert.match(response.headers.get('Set-Cookie'),/Max-Age=43200/);assert.match(response.headers.get('Set-Cookie'),/SameSite=Lax; Secure/);}finally{globalThis.fetch=oldFetch;}});
