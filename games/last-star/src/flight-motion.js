const TAU = Math.PI*2;

// The same animated wave travels down both strands; their back halves disappear
// behind the projectile. Stroke a colored ribbon, then pick out its lit rim.
function strand(c, length, amplitude, phase, color, rim) {
  c.beginPath();
  for(let j=0;j<=15;j++){
    const u=j/15, taper=Math.sin(Math.PI*u)**.7;
    const y=Math.sin(phase-u*8)*amplitude*taper;
    if(j===0)c.moveTo(0,y);else c.lineTo(-length*u,y);
  }
  c.lineCap='round';c.strokeStyle=color;c.lineWidth=3;c.stroke();
  c.strokeStyle=rim;c.lineWidth=.85;c.stroke();
}

export function drawVoidWake(r,sweep){
  const c=r.ctx,phase=r.time*(r.gentle?4:10);
  strand(c,70,sweep?7:10,phase,'#633487','#dfa3f2');
  if(r.quality!=='low'&&!r.gentle)strand(c,58,9,phase+Math.PI,'#794190','#c48adb');
}

export function drawStarFront(r) {
  const c=r.ctx;
  for(let i=0;i<(r.quality==='low'?1:2);i++){
    const age=(r.time*(r.gentle?1.4:3.15)+i*.5)%1;
    const x=5-30*age, radius=9+14*age;
    c.globalAlpha=(1-age)*.85;
    c.strokeStyle=i?'#9feaff':'#69baff';c.lineWidth=2.3-1.2*age;
    c.beginPath();c.ellipse(x,0,5+age*4,radius,0,-1.32,1.32);c.stroke();
  }
}

export function drawIceNeedle(r, heading){
  const c=r.ctx,phase=r.time*(r.gentle?4:11)+heading*3;
  strand(c,48,3.0,phase,'#48889870','#b4f8ff8c');
  // Rotate a five-sided crystal about its flight axis. Only camera-facing
  // planes are visible. The tip stays on the projectile's true heading.
  for(let i=0;i<5;i++){
    const a=phase+i*TAU/5,b=a+TAU/5,normal=(a+b)*.5;
    if(Math.cos(normal)<=0)continue;
    const ya=Math.sin(a)*7,yb=Math.sin(b)*7,light=Math.max(0,Math.cos(normal+1.12));
    const plane=c.createLinearGradient(-17,0,22,0);
    plane.addColorStop(0,'#477594');
    plane.addColorStop(.28,'rgb('+Math.round(36+185*light)+','+Math.round(96+148*light)+','+Math.round(138+114*light)+')');
    plane.addColorStop(1,light>.5?'#ebffff':'#609bb3');
    c.fillStyle=plane;
    c.beginPath();c.moveTo(22,0);c.lineTo(-5,ya);c.lineTo(-17,ya*.4);
    c.lineTo(-17,yb*.4);c.lineTo(-5,yb);c.closePath();c.fill();
    c.strokeStyle=light>.84?'#edffff':'#629fb4';c.lineWidth=.85;
    c.beginPath();c.moveTo(-17,ya*.4);c.lineTo(-5,ya);c.lineTo(22,0);c.stroke();
  }
  for(let i=0;i<(r.quality==='low'||r.gentle?1:3);i++){
    const u=(r.time*2+i/3+Math.abs(heading))%1;
    const x=-16-u*41,y=Math.sin(phase-u*4+i)*u*10;
    c.fillStyle='#c6f4ff';c.globalAlpha=1-u;
    c.beginPath();c.moveTo(x+3,y);c.lineTo(x,y-1.5);c.lineTo(x-4,y);c.lineTo(x,y+1.5);c.closePath();c.fill();
  }
}
