// Shared world presentation only. Pickup placement, attraction and rewards stay in loot/arcade.
const TAU=Math.PI*2;
const STYLES={
 ember:{w:60,h:58,light:'gold',rim:'#ffc17a'},
 frost:{w:62,h:55,light:'blue',rim:'#c6f4ff'},
 chain:{w:58,h:59,light:'violet',rim:'#dfc7ff'},
 flask:{w:47,h:58,light:'teal',rim:'#aaf3cf'},
 power:{w:49,h:58,light:'blue',rim:'#bdefff'},
 gem:{w:48,h:50,light:'violet',rim:'#e0baff'},
 gold:{w:44,h:48,light:'gold',rim:'#ffe6a2'},
 chest:{w:90,h:66,light:'gold',rim:'#ffe6a2'}
};

function artwork(r,kind){
 const current=r.art?.['pickup_'+kind],image=current||r.art?.['item_'+kind];
 if(!image)return null;
 const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
 if(!(iw>0&&ih>0))return null;
 // Bounds include a small transparent safety margin and are registered once at packaging.
 const b=current&&r.art.pickupBounds?.[kind];
 const frame=b&&b.length===4&&b.every(Number.isFinite)&&b[0]>=0&&b[1]>=0&&b[2]>0&&b[3]>0&&b[0]+b[2]<=iw&&b[1]+b[3]<=ih?b:[0,0,iw,ih];
 return {image,frame};
}

function sprite(c,art,x,y,w,h,grounded=false){
 const [sx,sy,sw,sh]=art.frame,scale=Math.min(w/sw,h/sh),dw=sw*scale,dh=sh*scale;
 c.drawImage(art.image,sx,sy,sw,sh,x-dw/2,grounded?y-dh:y-dh/2,dw,dh);
 return {w:dw,h:dh};
}

function contact(c,x,y,w,rim){
 c.save();
 c.fillStyle='#020b15';c.globalAlpha=.38;c.beginPath();c.ellipse(x,y+1,w,3,0,0,TAU);c.fill();
 c.strokeStyle=rim;c.globalAlpha=.24;c.lineWidth=.8;c.beginPath();c.ellipse(x,y,w*.8,2,0,0,TAU);c.stroke();
 c.restore();
}

function glint(r,x,y,style,phase,size=1){
 if(r.gentle||r.reducedFlash||r.quality==='low')return;
 const a=r.time*.65+phase,c=r.ctx;
 c.save();c.globalAlpha=.52;
 r.star(x+Math.cos(a)*style.w*.38,y+Math.sin(a)*style.h*.36,2.1*size,style.rim);
 c.restore();
}

export function drawGroundPickup(r,d){
 const x=d.x-r.camera;if(x<-96||x>r.w+96||d.taken)return;
 const style=STYLES[d.kind]||STYLES.power,phase=d.x*.017;
 const settled=Number.isFinite(d.floor)&&Math.abs(d.y-d.floor)<.5&&Math.abs(d.vy||0)<.01;
 const bob=r.gentle?0:Math.sin(r.time*1.6+phase)*1.7;
 // Loot's resting center is 22 units above its supporting surface.
 const y=d.y-9.5+bob,c=r.ctx;
 if(settled)contact(c,x,d.floor+22,style.w*.27,style.rim);
 const pulse=r.gentle||r.reducedFlash?1:.96+.04*Math.sin(r.time*1.1+phase);
 r.glow(x,y,style.w*1.15,style.light,.30*pulse);
 const art=artwork(r,d.kind);
 c.save();
 if(art)sprite(c,art,x,y,style.w,style.h);
 else r.star(x,y,11,style.rim);
 c.restore();
 if(settled)glint(r,x,y,style,phase);
}

export function drawGroundChest(r,d){
 const x=d.x-r.camera;if(x<-110||x>r.w+110)return;
 const c=r.ctx,style=STYLES.chest,ground=d.floor+22;
 const openedArt=d.open&&artwork(r,'chest_open'),art=openedArt||artwork(r,'chest');
 contact(c,x,ground,34,style.rim);
 if(!d.open)r.glow(x,ground-23,78,'gold',.20);
 c.save();c.globalAlpha=d.open&&!openedArt?.62:1;
 // The lid needs extra vertical room; both painted states retain their base/foot anchor.
 if(art)sprite(c,art,x,ground+1,style.w,openedArt?100:style.h,true);
 else {c.fillStyle=d.open?'#302c2b':'#856342';c.fillRect(x-30,ground-34,60,35);}
 c.restore();
 if(!d.open)glint(r,x,ground-30,{...style,w:54,h:38},d.x*.017,.85);
}

export function drawArcadeCrystal(r,d,player){
 const x=d.x-r.camera;if(x<-70||x>r.w+70||d.taken)return;
 const style=STYLES.power,phase=d.x*.017,c=r.ctx;
 const bob=d.homing||r.gentle?0:Math.sin(r.time*1.6+phase)*1.3,y=d.y+bob;
 const settled=!d.homing&&Number.isFinite(d.floor)&&Math.abs(d.y-d.floor)<.5&&Math.abs(d.vy||0)<.01;
 if(settled)contact(c,x,d.floor+18,10,style.rim);
 r.glow(x,y,46,'gold',.30);
 c.save();
 if(d.homing){
  // A short tapered direction cue follows the existing attraction, without adding trail state.
  const dx=d.x-player.x,dy=d.y-player.y+50,length=Math.hypot(dx,dy)||1,tail=Math.min(18,length*.14);
  c.strokeStyle='#bfeeff80';c.lineWidth=1.3;c.beginPath();c.moveTo(x,y);c.lineTo(x+dx/length*tail,y+dy/length*tail);c.stroke();
 }
 const art=artwork(r,'power');
 if(art)sprite(c,art,x,y,29,35);
 else {
  c.fillStyle='#ffe79c';c.beginPath();c.moveTo(x,y-12);c.lineTo(x+8,y-2);c.lineTo(x,y+13);c.lineTo(x-8,y-2);c.closePath();c.fill();
  c.fillStyle='#aa771b';c.beginPath();c.moveTo(x,y-12);c.lineTo(x+8,y-2);c.lineTo(x,y+13);c.closePath();c.fill();
 }
 c.restore();
}
