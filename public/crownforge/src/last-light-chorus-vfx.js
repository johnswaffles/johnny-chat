// Canvas spell art shared by the game and the spell preview. No particle allocations.
const TAU=Math.PI*2;
function star(c,x,y,r){c.beginPath();c.moveTo(x,y-r);c.quadraticCurveTo(x+r*.18,y-r*.18,x+r*.65,y);c.quadraticCurveTo(x+r*.18,y+r*.18,x,y+r);c.quadraticCurveTo(x-r*.18,y+r*.18,x-r*.65,y);c.quadraticCurveTo(x-r*.18,y-r*.18,x,y-r);c.fill();}
export function drawLastLightChorus(c,u,p,size,time,reducedMotion=false,ground=false){
 if(u.dead||!(u.lastLightChorusTimer>0))return;
 const age=60-u.lastLightChorusTimer,t=reducedMotion?0:(u.animClock??time*.001),seed=u.id*.73;
 const arrival=reducedMotion?0:Math.max(0,1-age/3),heal=reducedMotion?0:Math.min(1,(u.healPulse??0)/.85);
 const r=Math.max(12,size*.32),power=.22+arrival*.65+heal*.22;
 c.save();c.translate(p.x,p.y);c.globalCompositeOperation='lighter';c.lineWidth=Math.max(1,size*.012);
 if(ground){
  // A gilded seal beneath the feet keeps the silhouette readable.
  const g=c.createRadialGradient(0,0,0,0,0,r*1.8);g.addColorStop(0,`rgba(118,235,194,${power*.26})`);g.addColorStop(.6,`rgba(255,204,102,${power*.18})`);g.addColorStop(1,'rgba(255,191,75,0)');
  c.save();c.scale(1,.38);c.fillStyle=g;c.beginPath();c.arc(0,0,r*1.8,0,TAU);c.fill();
  c.globalAlpha=power;c.strokeStyle='#ffe6a0';
  for(const scale of [1,1.22]){c.beginPath();c.arc(0,0,r*scale,0,TAU);c.stroke();}
  for(let i=0;i<8;i++){const a=i*TAU/8+(reducedMotion?0:t*.12);c.save();c.rotate(a);c.beginPath();c.moveTo(r*1.08,-2);c.lineTo(r*1.17,0);c.lineTo(r*1.08,2);c.stroke();c.restore();}c.restore();
  if(u.lastLightChorusCastTimer>0&&!reducedMotion){
   const a=1-u.lastLightChorusCastTimer/2.8;
   for(let j=0;j<3;j++){const q=Math.max(0,a-j*.11),radius=size*(.4+q*5.8);c.globalAlpha=Math.pow(1-q,2)*.65;c.strokeStyle=j===1?'#a5ffe3':'#ffe3a0';c.lineWidth=(3-j*.7)*(1-q)+.5;c.beginPath();c.ellipse(0,0,radius,radius*.38,0,0,TAU);c.stroke();}
  }
 }else{
  // Paired ascending filaments: the twofold blessing, gold and living mint.
  const strength=arrival*.85+heal*.4;
  if(strength>.02){
   for(let strand=0;strand<2;strand++){
    c.strokeStyle=strand?'#a3ffe0':'#ffdfa0';c.globalAlpha=strength*.65;c.lineWidth=Math.max(1,size*.018);c.beginPath();
    for(let k=0;k<=32;k++){const f=k/32,a=f*TAU*1.15-t*2.2+strand*Math.PI+seed,x=Math.sin(a)*r*(1-f*.45),y=-f*size*.96+Math.cos(a)*r*.18;k?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();
   }
  }
  // Fine rising embers instead of a constant opaque column.
  if(!reducedMotion)for(let i=0;i<9;i++){const f=(t*(.2+i*.009)+i*.113+seed)%1,a=i*2.4+t*.35,x=Math.sin(a)*r*(.6+f*.4),y=-f*size*1.05;c.globalAlpha=Math.sin(f*Math.PI)*(.14+strength*.55);c.fillStyle=i%2?'#b2ffe0':'#fff1ba';star(c,x,y,Math.max(1.2,size*.022)*(1+heal*.4));}

 }
 c.restore();
}
