import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {installColorStudio,planRequest,imageRequest} from '../../lib/color-studio.mjs';
test('premium models and photo constraints are explicit in provider requests',()=>{
  const plan=planRequest({prompt:'A fox in a meadow',style:'glass',image:'data:image/png;base64,abc',colors:32,detail:'intricate'});
  assert.equal(plan.model,'gpt-6-astra');assert.equal(plan.reasoning.effort,'high');assert.equal(plan.store,false);assert.equal(plan.input[0].content[1].type,'input_image');assert.equal(plan.text.format.strict,true);
  const img=imageRequest({prompt:'Art direction'},'photo');assert.equal(img.model,'gpt-image-2.6-sunburst');assert.equal(img.quality,'high');assert.equal(img.complexity,'high');assert.equal(img.image,'photo');
});
test('async generation, provider refusal, upload validation, cancel and rate controls',async()=>{
  const app=express(),calls=[],base64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1kAAAAASUVORK5CYII=';
  const client={responses:{create:async request=>{calls.push(request);return request.input[0].content[0].text.includes('refuse')?{status:'completed',output:[]}:{status:'completed',output_text:JSON.stringify({title:'Quiet meadow',prompt:'Original flat-color fox illustration'})};}},images:{generate:async request=>{calls.push(request);return{data:[{b64_json:base64}]};},edit:async request=>{calls.push(request);return{data:[{b64_json:base64}]};}}};
  installColorStudio(app,{openai:client,enabled:true,clientKey:req=>req.headers['test-client']||'test'});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url=`http://127.0.0.1:${server.address().port}/api/color-studio`;
  const send=async(prompt,clientId='test',file)=>{const f=new FormData();f.set('prompt',prompt);f.set('style','classic');if(file)f.set('image',file,'photo.png');return fetch(url+'/jobs',{method:'POST',body:f,headers:{'test-client':clientId}});};
  try{
    const config=await(await fetch(url+'/config')).json();assert.equal(config.enabled,true);assert.equal(config.models.effort,'high');
    let response=await send('A fox');assert.equal(response.status,202);const {id}=await response.json();assert.match(id,/^[a-f0-9-]{36}$/);
    let job;for(let i=0;i<20;i++){job=await(await fetch(`${url}/jobs/${id}`)).json();if(job.status==='complete')break;await new Promise(r=>setTimeout(r,10));}
    assert.equal(job.status,'complete');assert.equal(job.title,'Quiet meadow');assert.ok(job.image.startsWith('data:image/png;base64,'));assert.equal(calls[0].model,'gpt-6-astra');assert.equal(calls[1].model,'gpt-image-2.6-sunburst');
    response=await send('refuse');const rejected=await response.json();await new Promise(r=>setTimeout(r,20));assert.equal((await(await fetch(`${url}/jobs/${rejected.id}`)).json()).status,'failed');assert.equal(calls.length,3,'a refusal must not reach image generation');
    response=await send('Image','upload',new Blob(['not a real image'],{type:'image/png'}));assert.equal(response.status,400);
    response=await send('Photo','photo',new Blob([Buffer.from(base64,'base64')],{type:'image/png'}));assert.equal(response.status,202);const photo=await response.json();await new Promise(r=>setTimeout(r,20));assert.ok(calls.at(-1).image,'photo is sent to edits');
    assert.equal((await fetch(`${url}/jobs/${photo.id}`,{method:'DELETE'})).status,204);assert.equal((await fetch(`${url}/jobs/${photo.id}`)).status,404);
    for(let i=0;i<2;i++){assert.equal((await send('A tree')).status,202);await new Promise(r=>setTimeout(r,10));}assert.equal((await send('A fifth')).status,429);
    assert.equal((await fetch(`${url}/jobs/missing`)).status,404);
  }finally{await new Promise(r=>server.close(r));}
});
