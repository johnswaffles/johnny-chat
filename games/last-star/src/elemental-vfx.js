// Bounded vector effects; no fullscreen filters or gameplay changes.
const TAU=Math.PI*2;
const colors={ember:['#ff7938','#ffd08a','gold'],frost:['#7cdcff','#efffff','blue'],chain:['#9f8bff','#faf0ff','violet']};
export function drawBurningEnemy(r,e){
 if(e.dead||!(e.burn>0))return;
 const c=r.ctx,x=e.x-r.camera,fade=Math.min(1,e.burn/.35),height=e.type==='boss'?130:82;
 if(x< -100||x>r.w+100)return;
 r.glow(x,e.y-height*.45,100,'gold',fade*.42);
 c.save();c.translate(x,e.y-6);c.globalCompositeOperation='source-over';
 for(let i=0;i<(r.gentle?4:8);i++){
  const phase=(r.time*1.4+i*.173+e.id*.31)%1,bx=Math.sin(i*11.3+e.id)*25,base=-phase*height*.62,h=(22+Math.sin(i*7)**2*23)*(1-phase*.5),lean=Math.sin(r.time*5+i)*7;
  c.globalAlpha=fade*(.85-phase*.35);
  const fire=c.createLinearGradient(0,base,0,base-h);fire.addColorStop(0,'#c9372040');fire.addColorStop(.4,'#ff6029e0');fire.addColorStop(.75,'#ffc36d');fire.addColorStop(1,'#ffeeb980');c.fillStyle=fire;
  c.beginPath();c.moveTo(bx-7,base);c.bezierCurveTo(bx-12,base-h*.35,bx+lean-6,base-h*.6,bx+lean,base-h);c.bezierCurveTo(bx+lean+2,base-h*.5,bx+12,base-h*.25,bx+7,base);c.closePath();c.fill();
  c.fillStyle='#ffe5a1';c.fillRect(bx+lean,base-h-8-phase*16,1.8,2.5);
 }
 c.globalCompositeOperation='source-over';c.strokeStyle='#bdb4a755';c.lineWidth=1;
 for(let i=0;i<(r.gentle?1:3);i++){const phase=(r.time*.45+i/3+e.id*.1)%1;c.globalAlpha=fade*(1-phase)*.25;c.beginPath();const sx=Math.sin(i*7)*15,sy=-height*.7-phase*38;c.moveTo(sx,sy);c.bezierCurveTo(sx-10,sy-14,sx+15,sy-20,sx+Math.sin(r.time+i)*20,sy-32);c.stroke();}
 c.restore();
}
function line(c,points,color,width){c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
function crystal(c,x,y,size,a){c.save();c.translate(x,y);c.rotate(a);c.fillStyle='#67b8ea';c.beginPath();c.moveTo(size,0);c.lineTo(0,-size*.35);c.lineTo(-size*.8,0);c.lineTo(0,size*.35);c.closePath();c.fill();c.fillStyle='#e8ffff';c.beginPath();c.moveTo(size,0);c.lineTo(0,-size*.35);c.lineTo(-size*.8,0);c.closePath();c.fill();line(c,[[size,0],[-size*.8,0]],'#ffffff',.8);c.restore();}
export function lightningPoints(from,to,seed,amplitude=12){
 const dx=to.x-from.x,dy=to.y-from.y,len=Math.hypot(dx,dy)||1,points=[];
 for(let i=0;i<=14;i++){const q=i/14,n=Math.sin(i*127.1+seed*311.7)*43758.5453,j=((n-Math.floor(n))*2-1)*Math.sin(Math.PI*q)*Math.min(amplitude,len*.08);points.push([from.x+dx*q-dy/len*j,from.y+dy*q+dx/len*j]);}return points;
}
function discharge(r,start,end,seed,q){
 const c=r.ctx,pulse=r.reducedFlash||r.gentle?1:.9+.1*Math.sin(r.time*18);
 r.glow(start.x,start.y,86,'violet',q*.6);r.glow(end.x,end.y,145,'blue',q*.72);
 const dx=end.x-start.x,dy=end.y-start.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
 if(!r.gentle)for(const t of [.32,.68])r.glow(start.x+dx*t,start.y+dy*t,48,'blue',q*.22);
 c.save();c.globalCompositeOperation='screen';c.globalAlpha=q*pulse;
 // Independent paths twist about one another, meeting at the real endpoints.
 for(let k=0;k<(r.gentle?1:3);k++){
  const points=lightningPoints(start,end,seed+k*3.173,r.gentle?7:18+k*8);
  line(c,points,k===1?'#7857ff38':'#318bff38',18-k*3);
  line(c,points,k===1?'#ae8aff':'#67cfff',k===0?4:2.4);
  line(c,points,'#f0f8ff',k===0?1.6:.85);
  if(!r.gentle)for(const i of [3,7,11]){
   const [px,py]=points[i],a=seed+i+k*2;
   const branch=lightningPoints({x:px,y:py},{x:px+Math.cos(a)*48,y:py+Math.sin(a)*48},seed+i+k,9);
   line(c,branch,'#6f7fff40',7);line(c,branch,'#8dbeff',1.5);line(c,branch,'#e7e5ff',.6);
  }
 }
 // Traveling white-hot charges follow the actual jagged channels, not a detached beam.
 for(let i=0;i<(r.gentle?2:9);i++){
  const t=(r.time*3.5+i/9)%1,index=Math.min(13,Math.floor(t*14)),f=t*14-index;
  const path=lightningPoints(start,end,seed+(i%3)*3.173,r.gentle?7:18+(i%3)*8),a=path[index],b=path[index+1],px=a[0]+(b[0]-a[0])*f,py=a[1]+(b[1]-a[1])*f;
  line(c,[[px-dx/len*7,py-dy/len*7],[px,py]],'#b5f5ff',2);
  c.fillStyle='#ffffff';c.beginPath();c.arc(px,py,1.6,0,TAU);c.fill();
 }
 // Fine helical ion trails wrap the discharge without hiding the target silhouettes.
 if(!r.gentle)for(let k=0;k<2;k++){
  const trail=[];for(let i=0;i<=28;i++){const t=i/28,offset=Math.sin(t*TAU*2-r.time*12+k*Math.PI)*Math.sin(t*Math.PI)*16;trail.push([start.x+dx*t+nx*offset,start.y+dy*t+ny*offset]);}
  line(c,trail,k?'#bfa7ff80':'#8fedff80',1.2);
 }
 // Electrical corona and outward sparks at the contact, not a full-screen flash.
 c.translate(end.x,end.y);
 const radius=15+(1-q)*15;
 for(let i=0;i<(r.gentle?4:12);i++){
  const a=i*TAU/(r.gentle?4:12)+seed*.09,dx=Math.cos(a),dy=Math.sin(a);
  const spark=lightningPoints({x:dx*radius*.6,y:dy*radius*.6},{x:dx*(radius+28*q),y:dy*(radius+28*q)},seed+i,5);
  line(c,spark,i%2?'#ae88ff':'#a2eaff',1.4*q);
 }
 c.strokeStyle='#c3b5ff';c.lineWidth=1.1*q;
 for(let i=0;i<3;i++){c.beginPath();c.ellipse(0,0,radius,radius*.55,seed*.04+i*TAU/3,.2,Math.PI*1.45);c.stroke();}
 c.restore();r.star(end.x,end.y,16*q,'#f6faff');
}
export function drawElementalProjectile(r,b){
 if(b.kind!=='ember'&&b.kind!=='frost')return false;
 const c=r.ctx,x=b.x-r.camera,y=b.y,t=r.time,a=Math.atan2(b.vy,b.vx),ember=b.kind==='ember';
 r.glow(x,y,ember?90:47,ember?'gold':'blue',.65);c.save();c.translate(x,y);c.rotate(a);c.globalCompositeOperation='screen';
 if(ember){
  const trail=c.createLinearGradient(-80,0,10,0);trail.addColorStop(0,'#ef3e1700');trail.addColorStop(.6,'#ff722980');trail.addColorStop(1,'#ffdf9f');
  for(let i=0;i<(r.gentle?2:4);i++){const phase=t*9+i*1.9;c.strokeStyle=trail;c.lineWidth=2+i*.9;c.beginPath();c.moveTo(-74-i*3,Math.sin(phase)*5);c.bezierCurveTo(-48,Math.sin(phase+1)*14,-27,Math.cos(phase)*15,3,Math.sin(phase)*8);c.stroke();}
  const fill=c.createRadialGradient(4,-4,1,0,0,18);fill.addColorStop(0,'#fff9df');fill.addColorStop(.3,'#ffe799');fill.addColorStop(.65,'#ff9f3e');fill.addColorStop(1,'#c43c2800');c.fillStyle=fill;c.beginPath();c.arc(0,0,18,0,TAU);c.fill();
  for(let i=0;i<3;i++){c.strokeStyle=i%2?'#fff0b9':'#ffaf60';c.lineWidth=1.4;c.beginPath();c.ellipse(0,0,11+i*2,5+i,t*2+i,0,TAU*.78);c.stroke();}
  c.strokeStyle='#ffc16b';c.lineWidth=1.6;
  for(let i=0;i<(r.gentle?3:6);i++){const angle=i*TAU/6+t*2;c.beginPath();c.arc(Math.cos(angle)*7,Math.sin(angle)*7,12+i%2*3,angle,angle+1.2);c.stroke();}
  for(let i=0;i<7;i++){const q=(t*1.8+i/7)%1;c.fillStyle='#ffdf9f';c.globalAlpha=1-q;c.fillRect(-q*64,Math.sin(i*7)*q*14,2,2);}
 }else{
  const tail=c.createLinearGradient(-65,0,10,0);tail.addColorStop(0,'#3a9cdb00');tail.addColorStop(1,'#cafbff');line(c,[[-65,-2],[-19,-3],[11,0]],tail,2.5);line(c,[[-48,5],[-15,4],[5,0]],'#7dd7ed55',1);crystal(c,0,0,15,0);c.globalAlpha=.5;crystal(c,-20,5,4,t*.8);crystal(c,-32,-5,3,-t);
  c.strokeStyle='#c8faff';c.lineWidth=.7;c.beginPath();c.ellipse(0,0,19,7,-t*.6,0,TAU);c.stroke();
  for(let i=0;i<3;i++){const q=(t*2+i/3)%1;c.globalAlpha=(1-q)*.6;c.fillStyle='#edffff';c.fillRect(-q*55,Math.sin(i*7+t)*7,1.5,1.5);}
 }c.restore();return true;
}
export function drawElementalEffect(r,f,q){
 const c=r.ctx,x=f.x-r.camera,y=f.y,age=1-q;
 if(f.kind==='burn-pulse'){
  r.glow(x,y,90,'gold',q*.8);c.save();c.translate(x,y);c.globalCompositeOperation='screen';c.globalAlpha=q;
  for(let i=0;i<(r.gentle?4:8);i++){const a=i*TAU/8+f.seed,radius=10+age*26;line(c,[[Math.cos(a)*8,Math.sin(a)*8],[Math.cos(a)*radius,Math.sin(a)*radius-14*age]],i%2?'#ff8845':'#ffda93',1.7*q);}
  c.restore();return true;
 }
 if(f.kind==='chain'){
  const end={x:f.to.x-r.camera,y:f.to.y},seed=f.seed+(r.gentle||r.reducedFlash?0:Math.floor(r.time*18));
  discharge(r,{x,y},end,seed,q);return true;
 }
 if(f.kind==='cast'){
  const [outer,core,glow]=colors[f.element],radius=13+age*20;r.glow(x,y,radius*3,glow,q*.4);c.save();c.translate(x,y);c.globalAlpha=q*.75;c.strokeStyle=outer;c.lineWidth=1;c.beginPath();c.arc(0,0,radius,0,TAU);c.stroke();
  for(let i=0;i<6;i++){const a=i*TAU/6+r.time*.35,px=Math.cos(a)*radius,py=Math.sin(a)*radius;line(c,[[px+Math.cos(a)*4,py+Math.sin(a)*4],[px,py],[px-Math.sin(a)*3,py+Math.cos(a)*3]],core,1);}c.restore();return true;
 }
 if(!['ember-blast','freeze','shatter','frost-hit'].includes(f.kind))return false;
 const ember=f.kind==='ember-blast',size=ember?120:f.kind==='freeze'?48:f.kind==='shatter'?66:32,[outer,core,glow]=colors[ember?'ember':'frost'];
 r.glow(x,y,ember?190:105,glow,q*.7);c.save();c.translate(x,y);c.globalCompositeOperation='screen';c.globalAlpha=q;const radius=8+Math.sqrt(age)*size;c.strokeStyle=outer;c.lineWidth=(ember?4:2)*q;c.beginPath();c.ellipse(0,0,radius,radius*(ember?.65:.8),0,0,TAU);c.stroke();
 for(let i=0;i<(r.gentle?6:12);i++){const a=i*TAU/12+f.seed*.7,dist=radius*(.45+.5*Math.sin(i*7)**2),px=Math.cos(a)*dist,py=Math.sin(a)*dist;
  if(ember){c.save();c.rotate(a);c.fillStyle=i%2?'#ff692d90':'#ffbb6290';c.beginPath();c.moveTo(dist*.4,-4*q);c.bezierCurveTo(dist*.7,-13*q,dist+12*q,-8*q,dist+22*q,0);c.bezierCurveTo(dist+2*q,3*q,dist*.7,12*q,dist*.4,4*q);c.closePath();c.fill();line(c,[[dist*.45,0],[dist*.8,-3*q],[dist+12*q,0]],core,1.4*q);c.restore();}else crystal(c,px,py,(f.kind==='freeze'?14:9)*q,a);
 }
 if(ember){const bloom=c.createRadialGradient(0,0,0,0,0,35+age*55);bloom.addColorStop(0,'#fff4ba90');bloom.addColorStop(.3,'#ff9b4450');bloom.addColorStop(1,'#eb472600');c.fillStyle=bloom;c.beginPath();c.arc(0,0,35+age*55,0,TAU);c.fill();}
 // Fine expanding crescents give impacts a luminous shell without a solid disc.
 c.strokeStyle=ember?'#ffe0a4':'#d4ffff';c.lineWidth=1.5*q;
 for(let i=0;i<(r.gentle?1:3);i++){const a=f.seed+i*TAU/3+age*(ember?2:-1.5);c.beginPath();c.ellipse(0,0,radius*.8,radius*.44,a,.2,Math.PI*1.5);c.stroke();}
 if(!ember)for(let i=0;i<6;i++){const a=i*TAU/6,px=Math.cos(a)*radius,py=Math.sin(a)*radius;c.save();c.translate(px,py);c.rotate(a);line(c,[[-4*q,0],[5*q,0]],'#f1ffff',q);line(c,[[0,-4*q],[0,4*q]],'#e4ffff',q);c.restore();}
 c.restore();return true;
}
