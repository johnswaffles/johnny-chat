import {UNIT_TYPES} from '../src/config.js';
import {CHARACTER_RIGS,createCharacterRigs} from '../src/character-rigs.js?v=20260905-cuffbraid3';
const canvas=document.querySelector('#population'),ctx=canvas.getContext('2d'),output=document.querySelector('#performance'),rigs=createCharacterRigs(),types=[...rigs.keys()],count=Math.min(256,Math.max(12,Number(new URLSearchParams(location.search).get('count'))||96));
const units=Array.from({length:count},(_,id)=>({id:id+1,type:types[id%types.length],facing:id%4,animationState:id%5===0?'attack':id%7===0?'idle':'walk',animationTime:0}));
const columns=16,rows=Math.ceil(count/columns),stepX=canvas.width/columns,stepY=canvas.height/rows,samples=[];
let previous=performance.now(),elapsed=0,frames=0;
function frame(now){const dt=Math.min(.05,(now-previous)/1000);previous=now;elapsed+=dt;const ready=[...rigs.values()].every(r=>r.readiness().every(i=>i.complete&&i.naturalWidth));
  if(!ready){requestAnimationFrame(frame);return;}
  const start=performance.now();ctx.clearRect(0,0,canvas.width,canvas.height);
  units.forEach((u,i)=>{u.animationTime=elapsed+i*.14;const family=CHARACTER_RIGS[u.type].family;rigs.get(u.type).draw(ctx,u,{x:(i%columns+.5)*stepX,y:(Math.floor(i/columns)+.9)*stepY},UNIT_TYPES[u.type].renderSize*.7,1,u.animationTime);});
  const paint=performance.now()-start;frames++;if(frames>10)samples.push(paint);if(samples.length>240)samples.shift();
  if(frames%30===0){const sorted=[...samples].sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length*.5)]??paint,p95=sorted[Math.floor(sorted.length*.95)]??paint;output.textContent=`${count} characters · ${types.length} identities · median ${median.toFixed(1)} ms · 95th percentile ${p95.toFixed(1)} ms · ${samples.length} samples`;Object.assign(output.dataset,{ready:'true',count:String(count),identities:String(types.length),median:String(median),p95:String(p95),samples:String(samples.length)});}
  requestAnimationFrame(frame);
}requestAnimationFrame(frame);
