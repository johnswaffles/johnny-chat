const TAU=Math.PI*2;
const clamp=n=>Math.max(0,Math.min(1,n));
export const constellationPhase=age=>({gather:clamp(age/.18),fall:clamp((age-.18)/.42),impact:clamp((age-.6)/1.1)});
export function makeCelestialSeal(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=384;const c=canvas.getContext('2d');c.translate(192,192);
 for(const radius of [172,158,118]){c.strokeStyle=radius===158?'#b1dcff80':'#78bfffba';c.lineWidth=radius===172?2:1;c.beginPath();c.arc(0,0,radius,0,TAU);c.stroke();}
 c.strokeStyle='#d0b7ff9c';c.beginPath();for(let i=0;i<=7;i++){const a=i*3*TAU/7-Math.PI/2;c.lineTo(Math.cos(a)*118,Math.sin(a)*118);}c.stroke();
 for(let i=0;i<28;i++){c.save();c.rotate(i*TAU/28);c.strokeStyle=i%4?'#89cffff0':'#ffe4a9';c.lineWidth=1.5;c.beginPath();c.moveTo(0,-163);c.lineTo(0,-172);if(i%2===0){c.moveTo(-3,-166);c.lineTo(0,-169);c.lineTo(3,-166);}c.stroke();c.restore();}
 return canvas;
}
export function drawConstellation(r,f){
 const c=r.ctx,x=f.x-r.camera,y=f.y,a=f.age,{gather,fall,impact}=constellationPhase(a);
 const fade=clamp(f.life/.45),sky=y-330;
 c.save();
 // Projected seven-point star chart marks exactly the damaging area.
 c.globalAlpha=fade*(.3+gather*.55);c.drawImage(r.celestialSeal,x-170,y-24,340,48);
 if(a<.6){
  const vanish=1-fall;
  r.glow(x,sky,260,'violet',vanish*.3*gather);
  c.save();c.translate(x,sky);c.rotate(-.15+a*.3);c.globalAlpha=vanish*gather*.7;c.drawImage(r.celestialSeal,-135,-135,270,270);c.restore();
  const nodes=[];
  for(let i=0;i<7;i++){
   const angle=i*TAU/7-Math.PI/2,sx=x+Math.cos(angle)*112,sy=sky+Math.sin(angle)*80;
   const dest=x+(i-3)*42,q=fall*fall;
   nodes.push({sx,sy,px:sx+(dest-sx)*q,py:sy+(y-sy)*q});
  }
  c.globalAlpha=vanish*gather;c.strokeStyle='#c7bbff';c.lineWidth=1;c.beginPath();
  for(let i=0;i<8;i++){const p=nodes[(i*3)%7];if(i===0)c.moveTo(p.px,p.py);else c.lineTo(p.px,p.py);}c.stroke();
  nodes.forEach((p,i)=>{
   const dx=p.px-p.sx,dy=p.py-p.sy,len=Math.hypot(dx,dy)||1,trail=Math.min(len,100);
   if(fall>0){c.globalAlpha=fade;c.strokeStyle='#6bbdff55';c.lineWidth=9;c.beginPath();c.moveTo(p.px-dx/len*trail,p.py-dy/len*trail);c.lineTo(p.px,p.py);c.stroke();c.strokeStyle='#c6f8ff';c.lineWidth=1.7;c.stroke();}
   r.glow(p.px,p.py,68,'blue',gather*.85);r.glow(p.px,p.py,25,'white',gather*.8);
   c.globalAlpha=gather;r.star(p.px,p.py,8+fall*3,i%2?'#e8fcff':'#fff1cb');
  });
 }else{
  const energy=(1-impact)*fade;
  r.glow(x,y-12,310,'blue',energy*(r.gentle?.35:.75));
  c.globalAlpha=energy;c.strokeStyle='#c2f4ff';c.lineWidth=2.2;
  c.beginPath();c.ellipse(x,y-4,25+145*Math.sqrt(impact),5+impact*21,0,0,TAU);c.stroke();
  c.strokeStyle='#bdacff';c.lineWidth=1;c.beginPath();c.ellipse(x,y-5,15+140*impact,5+impact*14,0,0,TAU);c.stroke();
  const count=r.quality==='low'?8:18;
  for(let i=0;i<count;i++){
   const angle=-Math.PI+(i+.5)/count*Math.PI,dist=30+Math.sqrt(impact)*(65+(i%4)*21);
   const px=x+Math.cos(angle)*dist,py=y+Math.sin(angle)*dist*.8+impact*impact*35;
   c.globalAlpha=energy;c.strokeStyle=i%3?'#8ce2ff':'#f8dfad';c.lineWidth=1;
   c.beginPath();c.moveTo(px,py);c.lineTo(px-Math.cos(angle)*9,py-Math.sin(angle)*9);c.stroke();r.star(px,py,2+(i%3),'#dcfaff');
  }
  // Seven final glints remain at the stars' contact points, then dissolve.
  for(let i=0;i<7;i++){const px=x+(i-3)*42;c.globalAlpha=energy;r.star(px,y-7-impact*18,7*(1-impact),'#e8fcff');}
 }
 c.restore();
}
