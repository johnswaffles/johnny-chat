import {BENEDICTION_DURATION} from './final-benediction.js?v=20260923-teamdock1';
// Rose-white soul ribbons and one closing segment per final second.
export function drawFinalBenediction(c,u,p,size,time,reduced=false,ground=false){
 const tank=u.finalBenedictionRemaining>0,remaining=tank?u.finalBenedictionRemaining:u.finalBenedictionCastRemaining;
 if(u.dead||!(remaining>0))return;
 const t=reduced?0:(u.animClock??time*.001),r=Math.max(15,size*(tank?.42:.33));
 c.save();c.translate(p.x,p.y);c.globalCompositeOperation='lighter';
 if(ground){
  const glow=c.createRadialGradient(0,0,0,0,0,r*2);glow.addColorStop(0,'#ffedf13d');glow.addColorStop(.45,'#ff399c40');glow.addColorStop(1,'#d623bd00');c.fillStyle=glow;c.save();c.scale(1,.46);c.beginPath();c.arc(0,0,r*2,0,Math.PI*2);c.fill();
  c.lineWidth=Math.max(1.4,size*.016);for(let i=0;i<BENEDICTION_DURATION;i++){c.strokeStyle=i<Math.ceil(remaining)?'#ffe8f5':'#6d294b';c.beginPath();c.arc(0,0,r,i*Math.PI*2/BENEDICTION_DURATION+.04,(i+1)*Math.PI*2/BENEDICTION_DURATION-.06);c.stroke();}
  c.strokeStyle='#f394db';c.lineWidth=1;c.beginPath();c.arc(0,0,r*1.23,0,Math.PI*2);c.stroke();c.restore();
 }else{
  const veil=c.createLinearGradient(0,0,0,-size*1.4);veil.addColorStop(0,'#ff46b72b');veil.addColorStop(.6,'#ffb9e414');veil.addColorStop(1,'#fff0f000');c.fillStyle=veil;
  c.beginPath();c.moveTo(-r,0);c.bezierCurveTo(-r*1.6,-size*.45,-r*.3,-size,-r*.65,-size*1.4);c.lineTo(r*.65,-size*1.4);c.bezierCurveTo(r*.3,-size,r*1.6,-size*.45,r,0);c.closePath();c.fill();
  if(!tank){for(const side of [-1,1])for(let feather=0;feather<5;feather++){c.strokeStyle=`rgba(255,218,229,${.55-feather*.07})`;c.lineWidth=Math.max(1,size*.012);c.beginPath();c.moveTo(side*r*.25,-size*.45);c.bezierCurveTo(side*r*1.9,-size*.9,side*r*(1.8-feather*.14),-size*(1.25-feather*.07),side*r*(1.25-feather*.1),-size*(1.1-feather*.09));c.stroke();}}
  // Ribbons rise beside the body, leaving the face and weapon legible.
  for(const side of [-1,1])for(let j=0;j<3;j++){const wave=Math.sin(t*1.8+j*1.7)*r*.12;
   c.strokeStyle=j===0?'#fff2e5':`rgba(255,${100+j*40},${180+j*20},.55)`;c.lineWidth=j===0?Math.max(1.5,size*.014):Math.max(1,size*.008);
   c.beginPath();c.moveTo(side*r,0);c.bezierCurveTo(side*(r*1.8+wave),-size*.3,side*(r*.25+wave),-size*.55,side*r*.8,-size*(tank?1.25:.95));c.stroke();
  }
  for(let i=0;i<14;i++){const f=reduced?i/14:(t*.22+i/14)%1,a=i*2.4+t*.3,x=Math.cos(a)*r*(.5+f*.7),y=-f*size*1.35;
   c.fillStyle=`rgba(255,220,242,${Math.sin(f*Math.PI)*.85})`;const q=Math.max(1,size*.012);c.fillRect(x-q,y-q,q*2,q*2);
  }
  if(tank){c.font=`600 ${Math.max(12,size*.16)}px serif`;c.textAlign='center';c.fillStyle='#ffe6f7';c.shadowColor='#ff269b';c.shadowBlur=8;c.fillText(`${Math.ceil(remaining)}`,0,-size*1.36);}
 }
 c.restore();
}
