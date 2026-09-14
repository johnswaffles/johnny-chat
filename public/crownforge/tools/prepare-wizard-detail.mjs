// Pack generated paintings without resampling; isolate connected sprites and
// remove the neutral checker matte supplied by the generator.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require(process.argv[2]);
const root=path.resolve('games/crownforge'),input=process.argv[3];
const sources={se:'exec-ea8fbd51-ccd6-4022-8731-16db6b678931.png',sw:'exec-0aca0d19-7ff9-49de-9f69-848007b01b1a.png',ne:'exec-efa45a81-a569-4422-9b36-49437de37510.png',nw:'exec-b5009fd2-e031-4bea-8a1a-eab3755090f3.png'};
const art={},report={};
for(const [view,file] of Object.entries(sources)){
 const {data,info}=await sharp(path.join(input,file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const {width:w,height:h}=info,n=w*h,visited=new Uint8Array(n),queue=new Int32Array(n);
 const gray=i=>{const r=data[i*4],g=data[i*4+1],b=data[i*4+2];return Math.min(r,g,b)>175&&Math.max(r,g,b)-Math.min(r,g,b)<18;};
 function flood(start,predicate){let a=0,b=1;queue[0]=start;visited[start]=1;while(a<b){const i=queue[a++],x=i%w;for(const j of [x?i-1:-1,x<w-1?i+1:-1,i-w,i+w])if(j>=0&&j<n&&!visited[j]&&predicate(j)){visited[j]=1;queue[b++]=j;}}return Array.from(queue.subarray(0,b));}
 for(let i=0;i<n;i++)if(!visited[i]&&gray(i)){const pixels=flood(i,gray);const edge=pixels.some(p=>p%w===0||p%w===w-1||p<w||p>=n-w);const tones=new Map();for(const p of pixels){const key=(data[p*4]<<16)|(data[p*4+1]<<8)|data[p*4+2];tones.set(key,(tones.get(key)??0)+1);}const flat=[...tones.values()].sort((a,b)=>b-a).slice(0,4).reduce((a,b)=>a+b,0)/pixels.length;const whites=pixels.filter(p=>Math.min(data[p*4],data[p*4+1],data[p*4+2])>240).length/pixels.length;const darks=pixels.filter(p=>Math.max(data[p*4],data[p*4+1],data[p*4+2])<232).length/pixels.length;if(edge||(pixels.length>90&&(flat>.7||whites>.25&&darks>.15)))for(const p of pixels)data[p*4+3]=0;}
 visited.fill(0);const parts=[];
 for(let i=0;i<n;i++)if(!visited[i]&&data[i*4+3]){
  const pixels=flood(i,j=>data[j*4+3]>0);let x0=w,y0=h,x1=0,y1=0,sx=0,sy=0;
  for(const j of pixels){const x=j%w,y=Math.floor(j/w);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);sx+=x;sy+=y;}
  parts.push({pixels,x0,y0,x1,y1,cx:sx/pixels.length,cy:sy/pixels.length});
 }
 const bodies=parts.filter(p=>p.pixels.length>4000).sort((a,b)=>Math.floor(a.cy/(h/4))-Math.floor(b.cy/(h/4))||a.cx-b.cx);
 if(bodies.length!==16)throw new Error(`${view}: expected 16 isolated bodies, found ${bodies.length}`);
 // Small enclosed stars and metallic highlights belong to the nearest body.
 for(const part of parts.filter(p=>p.pixels.length<=4000&&p.pixels.length>2&&p.pixels.some(j=>!gray(j)))){
  const near=bodies.map(b=>({b,d:Math.hypot(Math.max(b.x0-part.cx,0,part.cx-b.x1),Math.max(b.y0-part.cy,0,part.cy-b.y1))})).sort((a,b)=>a.d-b.d)[0];
  if(near.d<10)near.b.pixels.push(...part.pixels);
 }
 const cell=400,out=Buffer.alloc(cell*cell*16*4),base=Math.round(bodies.slice(0,8).map(p=>p.y1-p.y0+1).sort((a,b)=>a-b)[4]);art[view]={};report[view]={source:[w,h],bodyHeight:base,frames:[]};
 for(let i=0;i<16;i++){
  const b=bodies[i],row=Math.floor(i/4),col=i%4;
  const width=b.x1-b.x0+1,height=b.y1-b.y0+1;
  const bottom=b.pixels.filter(p=>Math.floor(p/w)>b.y1-10),foot=bottom.length?bottom.reduce((a,p)=>a+p%w,0)/bottom.length:b.cx;
  const ox=Math.round(Math.max(8-b.x0,Math.min(cell-9-b.x1,cell/2-(row===3?(b.x0+b.x1)/2:foot)))),oy=cell-12-b.y1;
  if(b.x0+ox<0||b.x1+ox>=cell||height>cell-12)throw new Error('Pose exceeds packing cell '+view+':'+i);
  for(const j of b.pixels){const x=j%w+ox,y=Math.floor(j/w)+oy;if(x<0||x>=cell||y<0||y>=cell)continue;const k=((row*cell+y)*cell*4+col*cell+x)*4;data.copy(out,k,j*4,j*4+4);}
  const action=['idle','walk','attack','death'][row];
  art[view][action]??={src:`./assets/starveil/arcanist-${view}-detail-v2.png`,scaleBase:base,frames:[]};
  art[view][action].frames.push({rect:[col*cell,row*cell,cell,cell],pivot:[cell/2,cell-12]});
  report[view].frames.push({width,height,pixels:b.pixels.length});
 }
 await sharp(out,{raw:{width:1600,height:1600,channels:4}}).png().toFile(path.join(root,`assets/starveil/arcanist-${view}-detail-v2.png`));
}
art.se.attack.frames=[art.se.attack.frames[2],art.se.attack.frames[0],art.se.attack.frames[1],art.se.attack.frames[3]];
await fs.writeFile(path.join(root,'src/painted-roster/wizard.js'),`// Native-detail wizard paintings; 64 poses, four independently drawn views.\nconst art=${JSON.stringify(art)};\nfor(const view of Object.values(art)){view.hit={...view.attack,frames:[view.attack.frames[0],view.idle.frames[0]]};view.stunned={...view.idle,frames:[view.idle.frames[0],view.idle.frames[1]]};}\nexport default art;\n`);
await fs.writeFile(path.join(root,'assets/starveil/detail-v2-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(Object.fromEntries(Object.entries(report).map(([k,v])=>[k,{bodyHeight:v.bodyHeight,frames:v.frames.length}])));
