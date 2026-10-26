// Bounded painted/procedural effects; no fullscreen filters or gameplay changes.
const TAU=Math.PI*2;
const colors={ember:['#ff7938','#ffd08a','gold'],frost:['#7cdcff','#efffff','blue'],chain:['#ae83ff','#faf0ff','violet']};
const detail=r=>r.gentle?0:r.quality==='low'?1:2;
function line(c,points,color,width){c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
function crescent(c,radius,width,start,end,color){c.fillStyle=color;c.beginPath();c.arc(0,0,radius,start,end);c.arc(0,0,Math.max(1,radius-width),end,start,true);c.closePath();c.fill();}
function crystal(c,x,y,size,a){
 c.save();c.translate(x,y);c.rotate(a);
 // A dark edge and three unequal planes retain the blade against bright water.
 c.fillStyle='#194465';c.strokeStyle='#15364e';c.lineWidth=1.1;c.beginPath();c.moveTo(size*1.2,0);c.lineTo(-size*.18,-size*.38);c.lineTo(-size*.8,-size*.1);c.lineTo(-size*.66,size*.25);c.lineTo(-size*.05,size*.32);c.closePath();c.fill();c.stroke();
 const face=c.createLinearGradient(-size*.6,-size*.4,size,size*.3);face.addColorStop(0,'#5090b6');face.addColorStop(.46,'#9be6ed');face.addColorStop(.76,'#d0fbf6');face.addColorStop(1,'#6fc6e4');c.fillStyle=face;c.beginPath();c.moveTo(size*1.2,0);c.lineTo(-size*.18,-size*.38);c.lineTo(-size*.66,-size*.06);c.lineTo(-size*.05,size*.03);c.closePath();c.fill();
 c.fillStyle='#6cbbde';c.beginPath();c.moveTo(size*1.2,0);c.lineTo(-size*.05,size*.03);c.lineTo(-size*.05,size*.32);c.closePath();c.fill();line(c,[[-size*.66,-size*.06],[-size*.05,size*.03],[size*1.2,0]],'#effff3',1.1);line(c,[[-size*.18,-size*.33],[size*.42,-size*.16]],'#d7ffff',.7);c.restore();
}
function painted(r,key,x,y,w,h,rotation=0,alpha=1){
 const im=r.art?.[key],iw=im?.naturalWidth||im?.width,ih=im?.naturalHeight||im?.height;if(!(iw>0&&ih>0))return false;
 const supplied=r.art.magicBounds?.[key];
 const b=supplied?.length===4&&supplied.every(Number.isFinite)&&supplied[0]>=0&&supplied[1]>=0&&supplied[2]>0&&supplied[3]>0&&supplied[0]+supplied[2]<=iw&&supplied[1]+supplied[3]<=ih?supplied:[0,0,iw,ih];
 const scale=Math.min(w/b[2],h/b[3]),dw=b[2]*scale,dh=b[3]*scale,c=r.ctx;
 c.save();c.translate(x,y);c.rotate(rotation);c.globalCompositeOperation='source-over';c.globalAlpha*=alpha;c.drawImage(im,...b,-dw/2,-dh/2,dw,dh);c.restore();return true;
}
function flameRibbon(c,length,width,bend,color){
 c.fillStyle=color;c.beginPath();c.moveTo(13,-width*.3);c.bezierCurveTo(-12,-width-bend,-length*.55,-width*.7-bend,-length,bend*.4);c.bezierCurveTo(-length*.55,-width*.15,-22,width*.8+bend,9,width*.35);c.quadraticCurveTo(22,0,13,-width*.3);c.closePath();c.fill();
}
function moltenCore(c,radius,time){
 c.fillStyle='#3a1420';c.strokeStyle='#ff832e';c.lineWidth=2;c.beginPath();for(let i=0;i<10;i++){const a=i*TAU/10,rr=radius*(.87+Math.sin(i*3.1+time*.3)*.1);i?c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):c.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();c.fill();c.stroke();
 c.fillStyle='#ff6c20';c.beginPath();c.moveTo(radius*.73,-radius*.45);c.bezierCurveTo(-radius*.15,-radius*.8,-radius*.52,-radius*.2,-radius*.15,radius*.5);c.bezierCurveTo(radius*.5,radius*.8,radius*.85,radius*.2,radius*.73,-radius*.45);c.fill();
 line(c,[[-radius*.7,-radius*.3],[-radius*.2,0],[-radius*.4,radius*.45]],'#ffc66c',2);line(c,[[radius*.5,-radius*.65],[radius*.25,-radius*.13],[radius*.65,radius*.13]],'#fff1b0',2.1);
}
export function drawBurningEnemy(r,e){
 if(e.dead||!(e.burn>0))return;
 const c=r.ctx,x=e.x-r.camera,fade=Math.min(1,e.burn/.35),height=e.type==='boss'?130:82,n=detail(r);if(x< -100||x>r.w+100)return;
 r.glow(x,e.y-height*.45,100,'gold',fade*.42);c.save();c.translate(x,e.y-6);c.globalCompositeOperation='source-over';
 for(let i=0;i<(n===0?4:n===1?5:8);i++){
  const phase=(r.time*1.4+i*.173+e.id*.31)%1,bx=Math.sin(i*11.3+e.id)*25,base=-phase*height*.62,h=(22+Math.sin(i*7)**2*23)*(1-phase*.5),lean=r.gentle?0:Math.sin(r.time*5+i)*7;c.globalAlpha=fade*(.85-phase*.35);
  const fire=c.createLinearGradient(0,base,0,base-h);fire.addColorStop(0,'#c9372040');fire.addColorStop(.4,'#ff6029e0');fire.addColorStop(.75,'#ffc36d');fire.addColorStop(1,'#ffeeb980');c.fillStyle=fire;
  c.beginPath();c.moveTo(bx-7,base);c.bezierCurveTo(bx-12,base-h*.35,bx+lean-6,base-h*.6,bx+lean,base-h);c.bezierCurveTo(bx+lean+2,base-h*.5,bx+12,base-h*.25,bx+7,base);c.closePath();c.fill();c.fillStyle='#ffe5a1';c.fillRect(bx+lean,base-h-8-phase*16,1.8,2.5);
 }
 c.strokeStyle='#bdb4a755';c.lineWidth=1;
 for(let i=0;i<(n===2?3:1);i++){const phase=(r.time*.45+i/3+e.id*.1)%1;c.globalAlpha=fade*(1-phase)*.25;c.beginPath();const sx=Math.sin(i*7)*15,sy=-height*.7-phase*38;c.moveTo(sx,sy);c.bezierCurveTo(sx-10,sy-14,sx+15,sy-20,sx+Math.sin(r.time+i)*20,sy-32);c.stroke();}c.restore();
}
export function lightningPoints(from,to,seed,amplitude=12){
 const dx=to.x-from.x,dy=to.y-from.y,len=Math.hypot(dx,dy)||1,points=[];
 for(let i=0;i<=14;i++){const q=i/14,n=Math.sin(i*127.1+seed*311.7)*43758.5453,j=((n-Math.floor(n))*2-1)*Math.sin(Math.PI*q)*Math.min(amplitude,len*.08);points.push([from.x+dx*q-dy/len*j,from.y+dy*q+dx/len*j]);}return points;
}
function discharge(r,start,end,seed,q){
 const c=r.ctx,n=detail(r),dx=end.x-start.x,dy=end.y-start.y,len=Math.hypot(dx,dy)||1,paths=[lightningPoints(start,end,seed,n===0?7:19)];if(n===2)paths.push(lightningPoints(start,end,seed+3.173,27));
 r.glow(start.x,start.y,66,'violet',q*.42);r.glow(end.x,end.y,104,'violet',q*.55);c.save();c.lineJoin='round';c.lineCap='round';c.globalAlpha=q;
 // One confident trunk, with a contrasting dark edge, reads as a spell rather than loose wires.
 for(const [k,points] of paths.entries()){c.globalCompositeOperation='source-over';line(c,points,'#2c1745',k?5:9);c.globalCompositeOperation='screen';line(c,points,k?'#a86de97a':'#9965e89c',k?7:13);line(c,points,k?'#b895ff':'#b693ff',k?2.6:5);line(c,points,'#e2f9ff',k?.8:1.8);}
 if(n>0)for(const i of n===2?[3,6,9,12]:[5,10]){const [px,py]=paths[0][i],side=i%2?1:-1,reach=n===2?47:32;const branch=lightningPoints({x:px,y:py},{x:px+dx/len*reach*.45-dy/len*reach*side,y:py+dy/len*reach*.45+dx/len*reach*side},seed+i,8);line(c,branch,'#8871ce70',6);line(c,branch,'#c2a6ff',1.5);line(c,branch,'#e9faff',.6);}
 // Reuse the registered main path for moving charges; no additional trails or particle state.
 if(n>0)for(let i=0;i<(n===2?4:2);i++){const t=(r.time*2.1+i/4)%1,index=Math.min(13,Math.floor(t*14)),f=t*14-index,a=paths[0][index],b=paths[0][index+1],px=a[0]+(b[0]-a[0])*f,py=a[1]+(b[1]-a[1])*f;line(c,[[px-dx/len*8,py-dy/len*8],[px,py]],'#efffff',2.2);}
 c.translate(end.x,end.y);const count=n===0?4:n===1?6:8,heading=Math.atan2(dy,dx),reach=12+(1-q)*17;
 for(let i=0;i<count;i++){const a=i*TAU/count+heading,spike=(i%2?13:25)*q;c.save();c.rotate(a);c.fillStyle=i%2?'#ad89ffad':'#d4cbffda';c.beginPath();c.moveTo(reach*.35,-2.6*q);c.lineTo(reach+spike,0);c.lineTo(reach*.48,2.8*q);c.lineTo(reach*.7,0);c.closePath();c.fill();c.restore();}
 c.restore();r.star(end.x,end.y,(r.reducedFlash?9:13)*q,'#eefaff');
}
export function drawElementalProjectile(r,b){
 if(b.kind!=='ember'&&b.kind!=='frost')return false;
 const c=r.ctx,x=b.x-r.camera,y=b.y,t=r.time,a=Math.atan2(b.vy,b.vx),ember=b.kind==='ember',n=detail(r);r.glow(x,y,ember?82:44,ember?'gold':'blue',ember?.48:.40);c.save();c.translate(x,y);c.rotate(a);
 if(ember){
  const bend=r.gentle?0:Math.sin(t*6)*4;c.globalCompositeOperation='source-over';flameRibbon(c,84,12,bend,'#9c291f88');flameRibbon(c,68,9,-bend,'#ff6726b3');c.globalCompositeOperation='screen';flameRibbon(c,49,5,bend*.5,'#ffce719c');
  if(!painted(r,'magicEmber',0,0,46,46,r.gentle?0:t*.28)){c.globalCompositeOperation='source-over';moltenCore(c,16,r.gentle?0:t);}c.globalCompositeOperation='screen';
  for(let i=0;i<(n===0?1:n===1?3:5);i++){const s=(t*1.1+i*.23)%1;c.globalAlpha=(1-s)*.75;c.fillStyle=i%2?'#ff9a47':'#ffdf9f';c.beginPath();c.moveTo(-20-s*64,Math.sin(i*9)*s*15);c.lineTo(-24-s*64,Math.sin(i*9)*s*15-1.8);c.lineTo(-22-s*64,Math.sin(i*9)*s*15+1.8);c.closePath();c.fill();}
 }else{
  c.globalCompositeOperation='source-over';c.fillStyle='#296b9266';c.beginPath();c.moveTo(14,0);c.lineTo(-68,-5);c.lineTo(-42,2);c.lineTo(-61,7);c.closePath();c.fill();c.globalCompositeOperation='screen';c.fillStyle='#9ae9f950';c.beginPath();c.moveTo(14,0);c.lineTo(-55,-2);c.lineTo(-31,4);c.closePath();c.fill();line(c,[[-49,-1],[-12,-2],[17,0]],'#d2ffff9c',1.2);c.globalCompositeOperation='source-over';crystal(c,0,0,17,0);if(n===2){c.globalAlpha=.65;crystal(c,-27,6,4,.25);crystal(c,-43,-4,3,-.3);}
 }c.restore();return true;
}
function emberImpact(r,f,q,age){
 const c=r.ctx,n=detail(r),radius=12+Math.sqrt(age)*106;r.glow(f.x-r.camera,f.y,176,'gold',q*.52);c.save();c.translate(f.x-r.camera,f.y);c.globalAlpha=q;
 // Open flame crescents leave the struck enemy visible between the expanding lobes.
 c.save();c.rotate(f.seed*.4+age*.65);crescent(c,radius,Math.max(2,14*q),-.75,1.6,'#ef6421a6');crescent(c,radius*.82,Math.max(1,5*q),2.3,4.4,'#ffe1a19c');c.restore();
 for(let i=0;i<(n===0?4:n===1?6:8);i++){const a=i*TAU/(n===0?4:n===1?6:8)+f.seed*.7,dist=radius*(.44+.2*Math.sin(i*7)**2);c.save();c.rotate(a);c.translate(dist,0);c.rotate(Math.PI);flameRibbon(c,18+radius*.32,8*q,Math.sin(i*4)*3,i%2?'#ff9b3dbb':'#d74a29bb');c.globalCompositeOperation='screen';flameRibbon(c,14+radius*.22,3*q,0,'#ffdd9da8');c.restore();}
 painted(r,'magicEmber',0,0,78+age*42,78+age*42,f.seed*.1,.78*q);if(!r.reducedFlash&&age<.18)r.star(0,0,14*(1-age/.18),'#fff1c9');c.restore();
}
function frostImpact(r,f,q,age){
 const c=r.ctx,n=detail(r),freeze=f.kind==='freeze',size=freeze?49:f.kind==='shatter'?66:32;r.glow(f.x-r.camera,f.y,105,'blue',q*.48);c.save();c.translate(f.x-r.camera,f.y);c.globalAlpha=q;
 const paintedSize=(freeze?84:f.kind==='shatter'?98:54)*(1+age*.35);painted(r,'magicFrost',0,0,paintedSize,paintedSize,f.seed*.09,.65);
 // The first hit grows a jagged fan; shattering throws fragments away from that same contact.
 const count=n===0?3:n===1?5:7;
 for(let i=0;i<count;i++){const a=freeze?-Math.PI*.92+i/(count-1)*Math.PI*.84:i*TAU/count+f.seed*.4,distance=freeze?8+age*10:12+Math.sqrt(age)*size*.72,length=(freeze?22:15)*(.7+.3*Math.sin(i*2.4)**2)*(freeze?.65+.35*Math.sin(Math.PI*age):q);crystal(c,Math.cos(a)*distance,Math.sin(a)*distance+8,length,a);}
 if(n>0){c.globalCompositeOperation='screen';c.strokeStyle='#d1fbff';c.lineWidth=.9*q;for(let i=0;i<(n===2?5:3);i++){const a=i*TAU/5+f.seed,dist=16+age*size;c.beginPath();c.moveTo(Math.cos(a)*dist,Math.sin(a)*dist);c.lineTo(Math.cos(a)*(dist+6*q),Math.sin(a)*(dist+6*q));c.stroke();}}c.restore();
}
export function drawElementalEffect(r,f,q){
 if(!(q>0))return false;
 const c=r.ctx,x=f.x-r.camera,y=f.y,age=1-q,n=detail(r);
 if(f.kind==='burn-pulse'){r.glow(x,y,76,'gold',q*.56);c.save();c.translate(x,y);c.globalCompositeOperation='screen';c.globalAlpha=q;for(let i=0;i<(n===0?3:n===1?5:7);i++){const a=i*TAU/7+f.seed,radius=10+age*26;line(c,[[Math.cos(a)*8,Math.sin(a)*8],[Math.cos(a)*radius,Math.sin(a)*radius-14*age]],i%2?'#ff8845':'#ffda93',1.7*q);}c.restore();return true;}
 if(f.kind==='chain'){const end={x:f.to.x-r.camera,y:f.to.y},seed=f.seed+(r.gentle||r.reducedFlash?0:Math.floor(r.time*14));discharge(r,{x,y},end,seed,q);return true;}
 if(f.kind==='cast'){const palette=colors[f.element];if(!palette)return false;const [outer,core,glow]=palette,radius=10+age*18;r.glow(x,y,radius*3,glow,q*.34);c.save();c.translate(x,y);c.globalAlpha=q*.7;for(let i=0;i<3;i++){c.save();c.rotate(i*TAU/3+(r.gentle?0:r.time*.2));crescent(c,radius,3*q,-.4,.65,outer);line(c,[[radius-4,0],[radius+5*q,0]],core,1.2*q);c.restore();}c.restore();return true;}
 if(f.kind==='ember-blast'){emberImpact(r,f,q,age);return true;}
 if(['freeze','shatter','frost-hit'].includes(f.kind)){frostImpact(r,f,q,age);return true;}
 return false;
}
