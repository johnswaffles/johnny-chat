import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import { onRequest } from '../functions/_middleware.js';
const names=['glade','first-ember','mosswake','sim','sim-live','sim-assets'];
test('Pages retires game entry points and old asset URLs',async()=>{
 for(const name of names)for(const suffix of ['', '/', '/index.html','/index.wasm','/index.pck']){
  const r=await onRequest({request:new Request('https://example.com/'+name+suffix),next:()=>assert.fail('Retired route reached assets')});
  assert.equal(r.status,410);assert.match(await r.text(),/game has been retired/);
 }
});
test('Pages keeps retained games and compressed Cozy Builder assets working',async()=>{
 for(const route of ['/crownforge/','/last-star/','/tetris/','/cozy-search/','/cozy-builder-game/','/simple/']){
  assert.equal(await onRequest({request:new Request('https://example.com'+route),next:()=> 'kept'}),'kept');
 }
 const r=await onRequest({request:new Request('https://example.com/cozy-builder-game/index.wasm'),env:{ASSETS:{fetch:async url=>{assert.equal(url.pathname,'/cozy-builder-game/index.wasm.gz');return new Response('test');}}}});
 assert.equal(r.status,200);assert.equal(r.headers.get('Content-Type'),'application/wasm');
});
test('Render retires the same routes before its static asset handler',async()=>{
 const source=await readFile(new URL('../server.js',import.meta.url),'utf8');
 const part=source.slice(source.indexOf('// Retired experiments:'),source.indexOf('app.get(GODOT_WASM_ROUTES'));
 let middleware;vm.runInNewContext(part,{app:{use:fn=>middleware=fn}});
 for(const name of names){
  const res={setHeader(){},status(n){this.code=n;return this;},type(){return this;},send(s){this.body=s;return this;}};
  middleware({path:'/'+name+'/index.pck'},res,()=>assert.fail('Retired route reached static files'));assert.equal(res.code,410);
 }
 let next=false;middleware({path:'/crownforge/'},{},()=>next=true);assert.equal(next,true);
});
