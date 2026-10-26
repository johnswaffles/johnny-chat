// Presentation only. Event coordinates are copied; no effect can move a combat target.
const TAU=Math.PI*2;
const clamp=n=>Math.max(0,Math.min(1,n));
export const ASTRAL_LIMIT=24;
export function astralEnvelope(life,max){
 const age=clamp(1-life/max);
 return {age,open:Math.sin(Math.PI*Math.min(1,age/.24)/2),fade:clamp((1-age)/.42)};
}
export function astralEvent(r,e){
 let effect;
 if(e.type==='cast')effect={kind:'muzzle',x:e.x,y:e.y,life:.26,max:.26};
 if(e.type==='blink')effect={kind:'passage',from:{...e.from},to:{...e.to},life:.72,max:.72};
 if(!effect)return;
 r.astralFX??=[];r.astralFX.push(effect);
 if(r.astralFX.length>ASTRAL_LIMIT)r.astralFX.splice(0,r.astralFX.length-ASTRAL_LIMIT);
}
export function drawStarshard(r,x,y,vx,vy){
 const c=r.ctx,t=r.time,frame=Math.floor(t*(r.gentle?8:16))%8;
 c.save();c.translate(x,y);c.rotate(Math.atan2(vy,vx));
 // Retain the approved compact blue wave and its forward striking surface.
 c.globalCompositeOperation='screen';
 const tail=c.createLinearGradient(-72,0,-4,0);tail.addColorStop(0,'#327bff00');tail.addColorStop(.65,'#4acaff70');tail.addColorStop(1,'#d3faff');
 c.strokeStyle=tail;c.lineWidth=1.1;
 for(let j=0;j<(r.quality==='low'?1:3);j++){
  const side=j-1,drift=Math.sin(t*9+j*2)*3;
  c.beginPath();c.moveTo(-72+j*8,side*6);c.bezierCurveTo(-48,side*13+drift,-22,side*5,-7,side*3);c.stroke();
 }
 c.drawImage(r.art.starshard,(frame%4)*384,Math.floor(frame/4)*512,384,512,-49,-42,58,77.333);
 c.restore();
}
function portal(r,p,age,open,fade,arrival){
 const c=r.ctx,x=p.x-r.camera,y=p.y-55;
 const height=(108+Math.sin(age*Math.PI)*22)*open,width=height*(.37+(1-fade)*.1);
 if(height<.1)return;
 r.glow(x,y,145,'violet',fade*(r.gentle?.18:.34));
 c.save();c.translate(x,y);c.globalAlpha=fade;
 if(r.art.magicAstral){
  c.save();c.scale(width/height,1);c.rotate((arrival?1:-1)*age*.38);
  c.drawImage(r.art.magicAstral,-height*.66,-height*.66,height*1.32,height*1.32);c.restore();
 }
 // The dark aperture and pale inner lip remain legible on a bright waterfall.
 c.fillStyle='#131c48a0';c.beginPath();c.ellipse(0,0,width*.35,height*.42,0,0,TAU);c.fill();
 c.strokeStyle='#dec9ff';c.lineWidth=1.6;c.beginPath();c.ellipse(0,0,width*.47,height*.49,0,-1.3,Math.PI*1.42);c.stroke();
 c.strokeStyle='#68cfff';c.lineWidth=.8;c.beginPath();c.ellipse(0,0,width*.58,height*.54,0,.25,Math.PI*1.05);c.stroke();
 const count=r.quality==='low'||r.gentle?5:10;
 for(let i=0;i<count;i++){
  const a=i*TAU/count+age*.35,sx=Math.cos(a)*width*.64,sy=Math.sin(a)*height*.58;
  c.save();c.translate(sx,sy);c.rotate(a+.3);c.fillStyle=i%3?'#b1e8ff':'#ffe7b5';
  c.beginPath();c.moveTo(0,-3);c.lineTo(1.5,0);c.lineTo(0,4);c.lineTo(-1.5,0);c.closePath();c.fill();c.restore();
 }
 c.restore();
}
export function drawAstralEffects(r,dt){
 const c=r.ctx;
 for(const f of r.astralFX||[]){
  f.life=Math.max(0,f.life-Math.max(0,dt));if(!f.life)continue;
  const {age,open,fade}=astralEnvelope(f.life,f.max);
  if(f.kind==='muzzle'){
   const x=f.x-r.camera;c.save();c.translate(x,f.y);c.globalAlpha=fade*(r.reducedFlash?.5:1);
   c.rotate(age*.5);c.strokeStyle='#9edfff';c.lineWidth=1.1;
   c.beginPath();c.ellipse(0,0,5+age*8,13+age*14,0,0,TAU);c.stroke();
   for(let i=0;i<4;i++){const a=i*TAU/4,inner=6+age*12,outer=inner+8*fade;c.beginPath();c.moveTo(Math.cos(a)*inner,Math.sin(a)*inner);c.lineTo(Math.cos(a)*outer,Math.sin(a)*outer);c.stroke();}
   r.star(0,0,10*fade,'#d9faff');c.restore();continue;
  }
  // A short, tapering ribbon ties the two actual passage endpoints together.
  const x=f.from.x-r.camera,y=f.from.y-55,tx=f.to.x-r.camera,ty=f.to.y-55;
  if(age<.55){
   const q=(1-age/.55)*(r.gentle?.4:.7);c.save();c.globalAlpha=q;c.globalCompositeOperation='screen';
   const gradient=c.createLinearGradient(x,y,tx,ty);gradient.addColorStop(0,'#795cdb00');gradient.addColorStop(.3,'#9866e878');gradient.addColorStop(.8,'#a8dfff');gradient.addColorStop(1,'#d8f8ff00');c.fillStyle=gradient;
   c.beginPath();c.moveTo(x,y-11);c.bezierCurveTo(x+(tx-x)*.4,y-23,tx-(tx-x)*.2,ty+9,tx,ty-8);c.lineTo(tx,ty+8);c.bezierCurveTo(tx-(tx-x)*.3,ty+19,x+(tx-x)*.2,y+6,x,y+11);c.closePath();c.fill();
   c.restore();
  }
  portal(r,f.from,age,open,fade,false);portal(r,f.to,age,open,fade,true);
 }
 r.astralFX=(r.astralFX||[]).filter(f=>f.life>0);
}
export function drawRestoration(r,f,q){
 const c=r.ctx,x=f.x-r.camera,y=f.y,age=1-q;
 c.save();c.globalAlpha=q;c.globalCompositeOperation='screen';
 r.glow(x,y,145,'teal',q*(r.gentle?.2:.36));
 const count=r.gentle||r.quality==='low'?5:9;
 // Leaves of light rise from the boots to the shoulders, never obscuring the face.
 for(let i=0;i<count;i++){
  const a=i*2.4+age*2.2,rad=22+Math.sin(age*Math.PI)*12;
  const px=x+Math.cos(a)*rad,py=y+48-age*(76+i*2)-i*3;
  c.strokeStyle='#74dcae70';c.lineWidth=1;c.beginPath();c.moveTo(px-Math.sin(a)*5,py+15);c.quadraticCurveTo(px+8,py+5,px,py);c.stroke();
  c.save();c.translate(px,py);c.rotate(a*.5);c.fillStyle=i%3?'#b4ffdb':'#fff1ba';c.beginPath();c.moveTo(0,-6);c.quadraticCurveTo(6,0,0,6);c.quadraticCurveTo(-3,0,0,-6);c.fill();c.restore();
 }
 c.strokeStyle='#b1f9d0';c.lineWidth=1.4;c.beginPath();c.ellipse(x,y+49,24+age*22,6+age*4,0,0,TAU);c.stroke();
 c.restore();
}
