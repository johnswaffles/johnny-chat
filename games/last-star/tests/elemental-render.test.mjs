import test from 'node:test';
import assert from 'node:assert/strict';
import {drawElementalProjectile,drawElementalEffect,drawBurningEnemy} from '../src/elemental-vfx.js';

function renderer(options={}){
 const calls=[],strokes=[],stack=[];
 const c={globalAlpha:1,globalCompositeOperation:'source-over',lineWidth:1,strokeStyle:'#000',fillStyle:'#000',lineCap:'butt',lineJoin:'miter'};
 let path=[];
 c.save=()=>{stack.push({...c});calls.push(['save']);};
 c.restore=()=>{assert.ok(stack.length,'unbalanced context restore');Object.assign(c,stack.pop());calls.push(['restore']);};
 c.beginPath=()=>{path=[];calls.push(['beginPath']);};
 for(const name of ['moveTo','lineTo','arc','ellipse','bezierCurveTo','quadraticCurveTo','closePath'])c[name]=(...args)=>{path.push([name,...args]);calls.push([name,...args]);};
 for(const name of ['translate','rotate','fill','fillRect','drawImage'])c[name]=(...args)=>calls.push([name,...args]);
 c.stroke=()=>{strokes.push({path:path.map(p=>[...p]),color:c.strokeStyle,width:c.lineWidth,alpha:c.globalAlpha});calls.push(['stroke']);};
 c.createLinearGradient=(...args)=>{calls.push(['gradient',...args]);return {addColorStop(...stop){calls.push(['colorStop',...stop]);}};};
 return {ctx:c,calls,strokes,stack,art:{},camera:250,w:1280,time:2.5,quality:'high',gentle:false,reducedFlash:false,
  glow(...args){calls.push(['glow',...args]);},star(...args){calls.push(['star',...args]);},...options};
}
const effect=kind=>Object.freeze({kind,x:600,y:380,seed:.7,to:Object.freeze({x:920,y:430}),life:.3,max:.55,element:'ember'});

test('elemental drawing is deterministic at a paused clock and never mutates simulation objects',()=>{
 for(const kind of ['ember','frost'])for(const vx of [-560,0,560]){
  const projectile=Object.freeze({kind,x:500,y:400,vx,vy:0,damage:66,life:1});
  const a=renderer(),b=renderer();assert.equal(drawElementalProjectile(a,projectile),true);drawElementalProjectile(b,projectile);
  assert.deepEqual(a.calls,b.calls);assert.equal(a.stack.length,0);assert.equal(a.ctx.globalAlpha,1);
  assert.ok(a.calls.flat(3).filter(x=>typeof x==='number').every(Number.isFinite));
 }
 for(const kind of ['cast','ember-blast','freeze','shatter','frost-hit','chain','burn-pulse']){
  const a=renderer(),b=renderer(),f=effect(kind);drawElementalEffect(a,f,.6);drawElementalEffect(b,f,.6);
  assert.deepEqual(a.calls,b.calls);assert.equal(a.stack.length,0);assert.equal(a.ctx.globalCompositeOperation,'source-over');
  assert.ok(a.calls.flat(3).filter(x=>typeof x==='number').every(Number.isFinite));
 }
});

test('Light and Gentle reduce elemental draw workload without removing the effect',()=>{
 for(const kind of ['chain','freeze','shatter','ember-blast']){
  const rich=renderer(),light=renderer({quality:'low'}),gentle=renderer({gentle:true});
  for(const r of [rich,light,gentle])assert.equal(drawElementalEffect(r,effect(kind),.65),true);
  assert.ok(light.calls.length<rich.calls.length,kind+' Light workload');
  assert.ok(gentle.calls.length<light.calls.length,kind+' Gentle workload');
 }
});

test('reduced flashes keep lightning trunks and brightness stable as its scene clock advances',()=>{
 const a=renderer({time:1,reducedFlash:true}),b=renderer({time:8,reducedFlash:true});
 drawElementalEffect(a,effect('chain'),.7);drawElementalEffect(b,effect('chain'),.7);
 assert.deepEqual(a.strokes.slice(0,8),b.strokes.slice(0,8));
 const quiet=renderer({reducedFlash:true});drawElementalEffect(quiet,effect('ember-blast'),.95);
 assert.equal(quiet.calls.some(c=>c[0]==='star'),false);
});

test('optional transparent paintings use valid registered bounds and preserve aspect ratio',()=>{
 const image={width:512,height:512};
 const art={magicEmber:image,magicFrost:image,magicBounds:{magicEmber:[20,30,470,450],magicFrost:[0,0,999,999]}};
 const r=renderer({art});drawElementalProjectile(r,Object.freeze({kind:'ember',x:500,y:400,vx:560,vy:0}));
 const draw=r.calls.find(c=>c[0]==='drawImage');assert.deepEqual(draw.slice(2,6),[20,30,470,450]);assert.ok(Math.abs(draw[8]/draw[9]-470/450)<1e-10);
 const frost=renderer({art});drawElementalEffect(frost,effect('freeze'),.6);assert.deepEqual(frost.calls.find(c=>c[0]==='drawImage').slice(2,6),[0,0,512,512]);
});

test('expired, unrelated, and dead-enemy effects do not add drawing work',()=>{
 const r=renderer();assert.equal(drawElementalProjectile(r,{kind:'bolt'}),false);assert.equal(drawElementalEffect(r,effect('chain'),0),false);assert.equal(drawElementalEffect(r,effect('unrelated'),.5),false);
 drawBurningEnemy(r,Object.freeze({dead:true,burn:2}));drawBurningEnemy(r,Object.freeze({dead:false,burn:0}));assert.deepEqual(r.calls,[]);
});
