import { equipmentReadiness } from './character-equipment.js';
import { projectHearthkin } from './hearthkin-locomotion.js';

const v=(x=0,y=0,z=0)=>({x,y,z});
const add=(a,b)=>v(a.x+b.x,a.y+b.y,a.z+b.z),mul=(a,n)=>v(a.x*n,a.y*n,a.z*n);
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a,b)=>v(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
const normal=a=>mul(a,1/Math.max(.000001,Math.hypot(a.x,a.y,a.z)));
const sourceRects=[[28,11,363,366],[442,8,371,375],[866,9,357,370],[18,389,386,390],[478,433,300,301],[849,391,382,397],[38,831,341,344],[489,743,277,490],[878,840,330,336]];
const shieldIndex={soldier:0,spearwarden:1,militia:2,shieldbearer:3,scout:4,thornSpear:5,hearthLevy:6,hidewall:7,ashenOutrider:8};
let atlas=null;const pieces=new Map();
export function shieldReadiness() {
  if(!atlas&&typeof Image!=='undefined') {atlas=new Image();atlas.src=new URL('../assets/characters-v3/shared/shields.png',import.meta.url).href;}
  return atlas?[atlas]:[];
}
function shieldArt(type) {
  shieldReadiness();const index=shieldIndex[type];
  if(index===undefined||!atlas?.complete||!atlas.naturalWidth||typeof document==='undefined')return null;
  if(pieces.has(index))return pieces.get(index);
  const rect=sourceRects[index],canvas=document.createElement('canvas');
  canvas.width=Math.round(256*rect[2]/rect[3]);canvas.height=256;
  canvas.getContext('2d').drawImage(atlas,...rect,0,0,canvas.width,canvas.height);pieces.set(index,canvas);return canvas;
}

export function shieldGeometry(frame,direction=0) {
  if(!frame)return null;
  const n=normal(frame.normal),up=normal(frame.up),right=normal(cross(up,n));
  const center=add(frame.grip,mul(n,2));
  const w=frame.width,h=frame.height,thickness=.85;
  const front=[],back=[];
  for(let i=0;i<32;i++) {
    const t=i/32*Math.PI*2;
    const p=add(center,add(mul(right,Math.cos(t)*w/2),mul(up,Math.sin(t)*h/2)));
    front.push(projectHearthkin(add(p,mul(n,thickness/2)),direction));
    back.push(projectHearthkin(add(p,mul(n,-thickness/2)),direction));
  }
  const depthAxis=[v(0,.342,.94),v(.94,.342,0),v(0,.342,-.94),v(-.94,.342,0)][direction];
  const frontFacing=dot(n,depthAxis)>0;
  const visible=frontFacing?front:back;
  return {frame,center,normal:n,up,right,width:w,height:h,front,back,visible,frontFacing,
    screenCenter:projectHearthkin(center,direction),screenUp:projectHearthkin(up,direction),screenRight:projectHearthkin(right,direction),
    depth:projectHearthkin(center,direction).depth};
}
function path(ctx,points) {
  ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
}

function paintCharacterShield(ctx,frame,direction,type) {
  const g=shieldGeometry(frame,direction);if(!g)return;
  const sides=[];
  for(let i=0;i<32;i++) {
    const next=(i+1)%32,points=[g.front[i],g.front[next],g.back[next],g.back[i]];
    sides.push({points,depth:points.reduce((a,p)=>a+p.depth,0)/4,index:i});
  }
  sides.sort((a,b)=>a.depth-b.depth);
  for(const side of sides) {
    path(ctx,side.points);ctx.fillStyle=type.startsWith('ashen')||['thornSpear','hearthLevy','hidewall'].includes(type)?'#4e3322':'#8d7450';ctx.fill();
  }
  path(ctx,g.visible);ctx.fillStyle=g.frontFacing?'#635439':'#57402a';ctx.fill();
  const image=g.frontFacing?shieldArt(type):null;
  if(image) {
    const c=g.screenCenter,r=g.screenRight,u=g.screenUp;
    ctx.save();ctx.transform(r.x*g.width,r.y*g.width,-u.x*g.height,-u.y*g.height,c.x-r.x*g.width/2+u.x*g.height/2,c.y-r.y*g.width/2+u.y*g.height/2);
    ctx.drawImage(image,0,0,1,1);ctx.restore();
  } else {
    // Real back face: planks and leather braces, never the front heraldry
    // mirrored through a shield when seen from behind its owner.
    ctx.save();path(ctx,g.visible);ctx.clip();
    const wood=equipmentReadiness()[0];
    if(wood?.complete&&wood.naturalWidth) {
      const c=g.screenCenter,r=g.screenRight,u=g.screenUp;
      ctx.save();ctx.transform(r.x*g.width,r.y*g.width,-u.x*g.height,-u.y*g.height,c.x-r.x*g.width/2+u.x*g.height/2,c.y-r.y*g.width/2+u.y*g.height/2);
      ctx.globalCompositeOperation='soft-light';ctx.globalAlpha*=.7;
      ctx.drawImage(wood,0,0,wood.naturalWidth/2,wood.naturalHeight/2,0,0,1,1);ctx.restore();
    }
    const project=(x,y,z=0)=>projectHearthkin(add(g.center,add(mul(g.right,x),add(mul(g.up,y),mul(g.normal,z)))),direction);
    for(let x=-g.width/2;x<g.width/2;x+=3) {
      const a=project(x,-g.height/2),b=project(x,g.height/2);
      ctx.strokeStyle='#241d16';ctx.lineWidth=.25;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      const c=project(x+.5,-g.height/2),d=project(x+.4,g.height/2);
      ctx.strokeStyle='rgba(195,153,94,.25)';ctx.lineWidth=.2;ctx.beginPath();ctx.moveTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.stroke();
    }
    for(const y of [-3.4,3.4]) {
      const a=project(-g.width*.32,y),b=project(g.width*.32,y);
      ctx.strokeStyle='#261b13';ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    }
    ctx.restore();
  }
  return g;
}


const shieldCache=new Map();let shieldCacheBytes=0;
export function drawCharacterShield(ctx,frame,direction,type) {
  const matrix=ctx.getTransform?.(),scale=matrix?Math.max(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d)):Infinity;
  if(scale>2.3||typeof document==='undefined'||![...shieldReadiness(),...equipmentReadiness()].every(i=>i.complete&&i.naturalWidth))return paintCharacterShield(ctx,frame,direction,type);
  const quantize=v=>({x:Math.round(v.x*50)/50,y:Math.round(v.y*50)/50,z:Math.round(v.z*50)/50});
  const local={...frame,grip:v(),normal:quantize(frame.normal),up:quantize(frame.up)};
  const key=JSON.stringify([type,direction,frame.width,frame.height,local.normal,local.up]);
  let entry=shieldCache.get(key);
  if(!entry) {
    const g=shieldGeometry(local,direction),points=[...g.front,...g.back],padding=1.5;
    const minX=Math.min(...points.map(p=>p.x))-padding,minY=Math.min(...points.map(p=>p.y))-padding;
    const width=Math.max(...points.map(p=>p.x))-minX+padding,height=Math.max(...points.map(p=>p.y))-minY+padding;
    const image=document.createElement('canvas'),resolution=3;image.width=Math.ceil(width*resolution);image.height=Math.ceil(height*resolution);
    const paint=image.getContext('2d');paint.scale(resolution,resolution);paint.translate(-minX,-minY);paintCharacterShield(paint,local,direction,type);
    entry={image,minX,minY,width:image.width/resolution,height:image.height/resolution};shieldCache.set(key,entry);
    shieldCacheBytes+=image.width*image.height*4;
    while(shieldCache.size>384||shieldCacheBytes>16*1024*1024) {const oldest=shieldCache.keys().next().value,old=shieldCache.get(oldest);shieldCacheBytes-=old.image.width*old.image.height*4;shieldCache.delete(oldest);}
  } else {shieldCache.delete(key);shieldCache.set(key,entry);}
  const grip=projectHearthkin(frame.grip,direction);
  ctx.drawImage(entry.image,grip.x+entry.minX,grip.y+entry.minY,entry.width,entry.height);
}
