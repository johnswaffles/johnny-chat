import {dragonBreathPoint,SKYBREAKER} from './storm-dragon.js?v=20260921-formationmilitia1';
export const DRAGON_RENDER_WIDTH=2520;
const TAU=Math.PI*2,clamp=v=>Math.max(0,Math.min(1,v));
let atlas;
function dragonArt(){if(!atlas&&typeof Image!=='undefined'){atlas=new Image();atlas.src='./assets/skybreaker/flight-v1.png';}return atlas;}
// Individually measured mouth anchors keep lightning attached through wingbeats.
const frames=[{rect:[0,0,608,608],mouth:[581,449]},{rect:[608,0,646,608],mouth:[619,454]},{rect:[0,608,652,646],mouth:[582,361]},{rect:[652,608,602,646],mouth:[579,405]}];
function bolt(c,a,b,seed,width,alpha){const pts=[],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;for(let i=0;i<=14;i++){const f=i/14,shake=i===0||i===14?0:Math.sin(i*12.31+seed*7.7)*Math.sin(f*Math.PI)*18;pts.push({x:a.x+dx*f-dy/len*shake,y:a.y+dy*f+dx/len*shake});}for(const [w,color,k] of [[width*7,'#865eff',.10],[width*3,'#56d6ff',.3],[width,'#eeffff',1]]){c.globalAlpha=alpha*k;c.strokeStyle=color;c.lineWidth=w;c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();}return pts;}
function halo(c,p,r,alpha){c.globalAlpha=alpha;const g=c.createRadialGradient(p.x,p.y,0,p.x,p.y,r);g.addColorStop(0,'#c9ffffb0');g.addColorStop(.25,'#48bfff65');g.addColorStop(1,'#5331b000');c.fillStyle=g;c.fillRect(p.x-r,p.y-r,r*2,r*2);}
function torrent(c,mouth,landing,z,age,alpha,reduced){
 const dx=landing.x-mouth.x,dy=landing.y-mouth.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,seed=reduced?4:Math.floor(age*18);
 // Dense blue plasma fills the cone; layered lightning provides its live edges.
 c.save();c.globalCompositeOperation='source-over';
 const fog=c.createLinearGradient(mouth.x,mouth.y,landing.x,landing.y);fog.addColorStop(0,'#d8ffffd0');fog.addColorStop(.12,'#56ddff90');fog.addColorStop(.6,'#4e66e26b');fog.addColorStop(1,'#7150c500');
 c.globalAlpha=alpha*.8;c.fillStyle=fog;c.beginPath();c.moveTo(mouth.x-nx*9*z,mouth.y-ny*9*z);
 c.bezierCurveTo(mouth.x+dx*.4-nx*38*z,mouth.y+dy*.4-ny*38*z,landing.x-nx*95*z,landing.y-ny*95*z,landing.x-nx*145*z,landing.y-ny*145*z);
 c.lineTo(landing.x+nx*145*z,landing.y+ny*145*z);
 c.bezierCurveTo(landing.x+nx*95*z,landing.y+ny*95*z,mouth.x+dx*.4+nx*38*z,mouth.y+dy*.4+ny*38*z,mouth.x+nx*9*z,mouth.y+ny*9*z);c.closePath();c.fill();c.restore();
 const clock=reduced?0:age;
 for(let ribbon=0;ribbon<5;ribbon++){
  for(const [width,color,a] of [[12,'#526dff',.1],[4,'#6eeaff',.5],[1.5,'#efffff',.8]]){
   c.globalAlpha=alpha*a;c.strokeStyle=color;c.lineWidth=width*z;c.beginPath();
   for(let i=0;i<=32;i++){const f=i/32,spread=Math.sin(f*15-clock*12+ribbon*TAU/5)*(8+f*35)*z*Math.sin(f*Math.PI),x=mouth.x+dx*f+nx*spread,y=mouth.y+dy*f+ny*spread;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();
  }
 }
 bolt(c,mouth,landing,seed,12*z,alpha*.9);
 halo(c,mouth,85*z,alpha);halo(c,landing,215*z,alpha*.65);
 if(!reduced)for(let i=0;i<36;i++){
  const f=(age*1.8+i*.173)%1,a=i*2.399,spread=Math.sin(a)*f*65*z,x=mouth.x+dx*f+nx*spread,y=mouth.y+dy*f+ny*spread;
  const length=(8+f*22)*z;c.globalAlpha=alpha*Math.sin(f*Math.PI)*.85;c.strokeStyle=i%4?'#b5f5ff':'#ffe4a8';c.lineWidth=(1+i%3*.6)*z;c.beginPath();c.moveTo(x-dx/len*length,y-dy/len*length);c.lineTo(x,y);c.stroke();
 }
 // Branches crawl outward across the terrain from the point of contact.
 for(let i=0;i<12;i++){const a=i*TAU/12+Math.sin(age+i)*.08,tip={x:landing.x+Math.cos(a)*185*z,y:landing.y+Math.sin(a)*80*z};bolt(c,landing,tip,seed+i,1.4*z,alpha*.65);}
}
export function drawStormDragons(c,r,sim,time){
 const image=dragonArt();if(!sim.stormDragons?.length)return;
 const z=r.camera.zoom,reduced=Boolean(r.atmosphere?.reducedMotion);
 c.save();try{for(const pass of sim.stormDragons){
  const age=pass.age,fade=clamp(age/.8)*clamp((10-age)/1.2),ground=dragonBreathPoint(pass);
  const flight={x:ground.x+pass.direction.x*(age<2?(age-2)*15:age>8?(age-8)*20:0),z:ground.z+pass.direction.z*(age<2?(age-2)*15:age>8?(age-8)*20:0)};
  const landing=r.worldToScreen(ground),pos=r.worldToScreen(flight),mouth={x:pos.x-32*z,y:pos.y-600*z};
  // Immense moving shadow anchors the aerial visitor to the field.
  c.globalCompositeOperation='source-over';c.globalAlpha=fade*.2;c.fillStyle='#111629';c.beginPath();c.ellipse(pos.x-450*z,pos.y,660*z,195*z,-.15,0,TAU);c.fill();
  const index=reduced?1:[0,1,2,3][Math.floor(age*4.5)%4],frame=frames[index],scale=DRAGON_RENDER_WIDTH/627*z;
  if(image?.complete&&image.naturalWidth){
   const left=mouth.x-frame.mouth[0]*scale,top=mouth.y-frame.mouth[1]*scale;
   c.save();
   // Exclude the neighboring downstroke's wingtip in the atlas gutter.
   if(index===3){c.beginPath();c.rect(left,top,frame.rect[2]*scale,460*scale);c.rect(left+75*scale,top+460*scale,(frame.rect[2]-75)*scale,(frame.rect[3]-460)*scale);c.clip();}
   c.globalAlpha=fade;c.drawImage(image,...frame.rect,left,top,frame.rect[2]*scale,frame.rect[3]*scale);c.restore();
  }
  c.globalCompositeOperation='lighter';
  if(age>=2&&age<8){
   const pulse=reduced?.6:.82+Math.sin(age*9)*.12,seed=reduced?3:Math.floor(age*16);
   torrent(c,mouth,landing,z,age,fade*pulse,reduced);
   // A broad lightning fan scours the same twelve-unit radius used by damage.
   for(let i=0;i<9;i++){
    const a=i*TAU/9,rad=(i%3?.75:.25)*12*16*z,end={x:landing.x+Math.cos(a)*rad,y:landing.y+Math.sin(a)*rad*.45};
    const pts=bolt(c,mouth,end,seed+i,(i===4?4:2.2)*z,fade*pulse);
    if(!reduced)for(let k=4;k<12;k+=4){const branch=pts[k],tip={x:branch.x+Math.sin(seed+i+k)*35*z,y:branch.y+30*z};bolt(c,branch,tip,seed+k,.7*z,fade*.55);}
    halo(c,end,32*z,fade*.55);
   }
   halo(c,landing,170*z,fade*.55);
   for(let i=0;i<3;i++){const phase=reduced?.5:(age*.8+i/3)%1;c.globalAlpha=(1-phase)*fade*.6;c.strokeStyle=i%2?'#e5f6ff':'#a591ff';c.lineWidth=2*z;c.beginPath();c.ellipse(landing.x,landing.y,(35+phase*160)*z,(15+phase*69)*z,0,0,TAU);c.stroke();}
   if(!reduced)for(let i=0;i<26;i++){const f=(age*.7+i*.137)%1,a=i*2.399,x=landing.x+Math.cos(a)*f*175*z,y=landing.y+Math.sin(a)*f*75*z-Math.sin(f*Math.PI)*65*z;c.globalAlpha=(1-f)*fade;c.fillStyle=i%3?'#a5eaff':'#ffe4a0';c.fillRect(x,y,2*z,5*z);}
  }else halo(c,mouth,38*z,fade*.7);
 }}finally{c.restore();}
}
