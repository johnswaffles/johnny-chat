const TAU=Math.PI*2;
export function arcadeEvent(r,e){
 if(['enemy-death','overdrive','power-rank'].includes(e.type)){
  r.arcadeWaves??=[];r.arcadeWaves.push({x:e.x,y:e.y,age:0,power:e.type!=='enemy-death',seed:r.time});if(r.arcadeWaves.length>16)r.arcadeWaves.shift();
  r.burst(e.x,e.y,e.type==='enemy-death'?'violet':'gold',e.type==='enemy-death'?32:55,230);
  if(!r.gentle)r.shake=Math.max(r.shake,.09);
 }
 if(e.type==='crystal'){r.burst(e.x,e.y,'gold',6,65);r.rings.push({x:e.x,y:e.y,r:4,life:.22,color:'gold'});}
}
export function drawArcade(r,game,dt){
 const c=r.ctx,a=game.arcade;if(!a)return;
 for(const d of a.drops){const x=d.x-r.camera;if(x<-70||x>r.w+70)continue;const y=d.y+(d.homing?0:Math.sin(r.time*3+d.x)*3);
  r.glow(x,y,65,'gold',.9);c.save();c.translate(x,y);
  if(d.homing){c.strokeStyle='#ffd88188';c.lineWidth=2;c.beginPath();c.moveTo(0,0);c.lineTo((d.x-game.player.x)*.12,(d.y-game.player.y+50)*.12);c.stroke();}
  c.fillStyle='#ffe79c';c.beginPath();c.moveTo(0,-12);c.lineTo(8,-2);c.lineTo(0,13);c.lineTo(-8,-2);c.closePath();c.fill();
  c.fillStyle='#aa771b';c.beginPath();c.moveTo(0,-12);c.lineTo(8,-2);c.lineTo(0,13);c.closePath();c.fill();c.strokeStyle='#fffbe0';c.lineWidth=1;c.beginPath();c.moveTo(0,-12);c.lineTo(-8,-2);c.lineTo(0,13);c.stroke();c.restore();
 }
 if(a.overdrive>0){const x=game.player.x-r.camera,y=game.player.y-52;r.glow(x,y,155,'gold',.45);c.save();c.strokeStyle='#ffe6a3';c.lineWidth=1.4;c.globalAlpha=.65;
  for(let i=0;i<3;i++){const angle=(r.gentle?0:r.time*1.7)+i*TAU/3;c.beginPath();c.ellipse(x,y,38+i*7,57,angle,0,TAU);c.stroke();r.star(x+Math.cos(angle)*50,y+Math.sin(angle)*50,5,'#fff3be');}c.restore();
  for(const b of game.projectiles){if(b.owner!=='player')continue;const bx=b.x-r.camera;r.glow(bx,b.y,65,'gold',.7);r.star(bx-12,b.y,5,'#fff7cf');}
 }
 for(const w of r.arcadeWaves||[]){w.age+=dt;const t=w.age,life=w.power?1.1:.7,q=Math.max(0,1-t/life),x=w.x-r.camera;if(!q)continue;c.save();c.globalCompositeOperation='screen';c.globalAlpha=q;
  r.glow(x,w.y,90+t*170,w.power?'gold':'violet',q*.8);c.strokeStyle=w.power?'#ffe6a8':'#c9b5ff';c.lineWidth=1+q*2;
  c.beginPath();c.ellipse(x,w.y,8+t*135,(8+t*135)*.7,0,0,TAU);c.stroke();
  const count=r.gentle?5:12;for(let i=0;i<count;i++){const angle=i*TAU/count+w.seed,dist=12+t*(w.power?180:125),sx=x+Math.cos(angle)*dist,sy=w.y+Math.sin(angle)*dist;c.save();c.translate(sx,sy);c.rotate(angle+t);c.fillStyle=i%2?'#fff3d2':'#bfefff';c.beginPath();c.moveTo(0,-8*q);c.lineTo(3*q,0);c.lineTo(0,8*q);c.lineTo(-3*q,0);c.closePath();c.fill();c.restore();}
  if(t<.12)r.star(x,w.y,25*(1-t/.12),'#fffaf0');c.restore();
 }r.arcadeWaves=(r.arcadeWaves||[]).filter(w=>w.age<(w.power?1.1:.7));
}
