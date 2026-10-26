import {arcanaSprite,unit,facet} from './arcana-sprites.js?release=20261026-astral-gateways';
const TAU=Math.PI*2;
export function sealState(checkpoint,index){return index<checkpoint?'awakened':index===checkpoint?'ready':'dormant';}
export function prepareSealArt(image){
 if(!image)return {};
 const variants={};for(const [key,brightness] of [['ready',.9],['dormant',.48]]){
  const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');
  ctx.filter=`brightness(${brightness}) saturate(${key==='dormant'?.55:1})`;ctx.drawImage(image,0,0);variants[key]=c;
 }return variants;
}
function sealSprite(r,state,x,y,w,h){
 if(state==='awakened'||!r.art.sealVariants?.[state])return arcanaSprite(r,'sealRelic',x,y,w,h);
 const c=r.ctx,b=r.art.arcanaBounds.sealRelic,k=Math.min(w/b[2],h/b[3]);c.drawImage(r.art.sealVariants[state],...b,x-b[2]*k/2,y-b[3]*k/2,b[2]*k,b[3]*k);return true;
}
export function drawCheckpoint(r,g,s,index){
 const c=r.ctx,x=s.x-r.camera,state=sealState(g.checkpoint,index),active=state==='awakened',ready=state==='ready',t=r.time;
 if(x<-250||x>r.w+250)return;
 // Keep the stone opaque; magic has its own bounded, transparent layers.
 r.prop('arch',x,s.y+6,235,235,1);
 const y=s.y-91,near=unit(1-Math.abs(g.player.x-s.x)/200),color=active?'gold':'blue';
 r.glow(x,y,active?210:150,color,active?.44:ready?.23+near*.1:.08);
 c.save();
 // A light inlay rests on the checkpoint's actual supporting surface.
 c.strokeStyle=active?'#e5c68599':ready?'#91c8df77':'#53677666';c.lineWidth=1;
 c.beginPath();c.ellipse(x,s.y-2,54,8,0,0,TAU);c.stroke();
 for(const side of [-1,1]){c.beginPath();c.moveTo(x+side*39,s.y-4);c.lineTo(x+side*49,s.y-9);c.lineTo(x+side*60,s.y-4);c.stroke();}
 const bob=r.gentle?0:Math.sin(t*.85+index)*2;
 if(!sealSprite(r,state,x,y+bob,94,111))r.star(x,y,25,active?'#efd29a':'#a5dfff');
 if(active||ready){
  const turn=r.gentle?index*.4:t*.24+index*.7;c.strokeStyle=active?'#f0d29488':'#a6ddf077';c.lineWidth=.8;
  c.beginPath();c.ellipse(x,y,51,62,0,turn,turn+Math.PI*1.2);c.stroke();
  const n=r.gentle?3:6;for(let i=0;i<n;i++){const a=i*TAU/n+turn;facet(c,x+Math.cos(a)*51,y+Math.sin(a)*62,active?3.7:2.7,a,active?'#ffe2a3':'#bcecff');}
 }
 if(active){
  c.globalCompositeOperation='screen';const beam=c.createLinearGradient(0,s.y-5,0,y+30);beam.addColorStop(0,'#c4a45d00');beam.addColorStop(.6,'#efcb8e28');beam.addColorStop(1,'#f1d7a400');c.fillStyle=beam;
  c.beginPath();c.moveTo(x-13,s.y-4);c.lineTo(x+13,s.y-4);c.lineTo(x+6,y+23);c.lineTo(x-6,y+23);c.closePath();c.fill();
 }
 c.restore();
}
export function drawObservatoryGate(r,g){
 const c=r.ctx,x=6900-r.camera;if(x<-260||x>r.w+260)return;
 r.prop('arch',x,577,340,430,1);const locked=g.checkpoint<3;
 if(locked){
  // Narrow lattice follows the old barrier footprint; it creates no new collision.
  c.save();c.beginPath();c.rect(x-65,270,130,295);c.clip();
  const curtain=c.createLinearGradient(x-65,0,x+65,0);curtain.addColorStop(0,'#36427300');curtain.addColorStop(.5,'#718ecc2b');curtain.addColorStop(1,'#36427300');c.fillStyle=curtain;c.fillRect(x-65,270,130,295);
  c.strokeStyle='#a3c8e64f';c.lineWidth=.8;
  for(let i=0;i<7;i++){const y=288+i*42;c.beginPath();c.moveTo(x-60,y);c.lineTo(x,y+25);c.lineTo(x+60,y);c.stroke();}
  c.restore();r.glow(x,403,170,'blue',.18);if(!sealSprite(r,'dormant',x,402,87,105))r.star(x,402,24,'#9eb8d5');
 }else{r.glow(x,291,160,'gold',.3);if(!sealSprite(r,'awakened',x,289,54,64))r.star(x,289,19,'#f2d79b');}
 for(let i=0;i<3;i++){const px=x+(i-1)*34,y=locked?494:342,lit=i<g.checkpoint;facet(c,px,y,lit?9:7,0,lit?'#f5d898':'#4b6278');if(lit)r.glow(px,y,30,'gold',.4);}
}
export function drawReturnEmber(r){
 const x=7730-r.camera,y=445+(r.gentle?0:Math.sin(r.time)*3);
 r.glow(x,y,210,'gold',.6);if(!sealSprite(r,'awakened',x,y,92,108))r.star(x,y,26,'#f2d79b');
}
export function drawPlayerWard(r,p,kind='mantle',remaining=p.mantle){
 if(!(remaining>0))return;
 const c=r.ctx,x=p.x-r.camera,y=p.y-57,gold=kind==='overdrive',fade=unit(remaining/.65),rx=gold?43:47,ry=gold?58:67;
 r.glow(x,y,155,gold?'gold':'teal',fade*(r.reducedFlash?.12:.22));
 c.save();c.translate(x,y);c.globalAlpha=fade;
 const shift=r.gentle?0:Math.sin(r.time*.7)*.035;c.rotate(shift);
 // Separate glass plates keep the character's painted body visible through the ward.
 for(let i=0;i<8;i++){
  const a=i*TAU/8-Math.PI/2,b=a+TAU/8*.78,ax=Math.cos(a)*rx,ay=Math.sin(a)*ry,bx=Math.cos(b)*rx,by=Math.sin(b)*ry;
  c.fillStyle=gold?'#e6be6c0b':'#85e1cf0c';c.strokeStyle=gold?'#efce8a99':'#b5efd7a6';c.lineWidth=1.1;
  c.beginPath();c.moveTo(ax,ay);c.lineTo(bx,by);c.lineTo(bx*.87,by*.87);c.lineTo(ax*.9,ay*.9);c.closePath();c.fill();c.stroke();
  if(i%2===0)facet(c,ax,ay,3.7,a,gold?'#fff0b4':'#d4fff0');
 }
 const phase=r.gentle?0:r.time*.5;
 c.strokeStyle=gold?'#f3d695':'#c5fae8';c.lineWidth=1.8;c.beginPath();c.ellipse(0,0,rx+2,ry+2,0,phase,phase+.48);c.stroke();
 c.restore();
}
export function drawLantern(r,l){
 const c=r.ctx,x=l.x-r.camera,y=l.y;if(x<-80||x>r.w+80)return;
 c.save();c.translate(x,y);
 c.strokeStyle='#273b40';c.lineWidth=6;c.beginPath();c.moveTo(0,0);c.lineTo(0,-85);c.quadraticCurveTo(0,-107,23,-99);c.stroke();
 c.strokeStyle='#8e825e';c.lineWidth=1.2;c.beginPath();c.moveTo(-1,-1);c.lineTo(-1,-85);c.quadraticCurveTo(-1,-103,23,-99);c.stroke();
 c.fillStyle='#465455';c.fillRect(-6,-4,12,4);c.fillStyle='#a19165';c.fillRect(-4,-5,8,1.5);
 c.strokeStyle='#b09b66';c.lineWidth=1.5;c.beginPath();c.moveTo(23,-99);c.lineTo(23,-91);c.stroke();
 c.fillStyle='#263b43';c.strokeStyle='#b8a16b';c.lineWidth=1.3;c.beginPath();c.moveTo(23,-93);c.lineTo(35,-85);c.lineTo(32,-58);c.lineTo(23,-53);c.lineTo(14,-58);c.lineTo(11,-85);c.closePath();c.fill();c.stroke();
 const glass=c.createLinearGradient(14,-75,32,-75);glass.addColorStop(0,'#a9702940');glass.addColorStop(.5,'#f0c780aa');glass.addColorStop(1,'#a9702920');c.fillStyle=glass;c.fillRect(15,-83,16,23);
 c.strokeStyle='#d3b777';c.lineWidth=.8;for(const dx of [-6,6]){c.beginPath();c.moveTo(23+dx,-85);c.lineTo(23+dx*.7,-58);c.stroke();}
 const sway=r.gentle?0:Math.sin(r.time*2.8+l.x)*1.3;c.fillStyle='#ffdf9b';c.beginPath();c.moveTo(19,-65);c.quadraticCurveTo(18,-73,24+sway,-80);c.quadraticCurveTo(23,-72,27,-68);c.quadraticCurveTo(27,-61,19,-65);c.fill();
 c.fillStyle='#fff0c1';c.fillRect(22,-69,2,5);c.restore();r.glow(x+23,y-72,135,'gold',r.reducedFlash?.4:.59);
}
