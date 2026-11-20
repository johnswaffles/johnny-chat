// Each game owns its platforms. Coordinates exported by game.js are the authored rest pose.
export function makeHoverLedge(p) {
  return {...p, restY:p.y, compression:0, springSpeed:0};
}

export function hoverOffset(p,time) {
  const phase = p.id*2.39996, rate = 1.35 + (p.id%3)*.19;
  return 4.6*(Math.sin(time*rate+phase)-Math.sin(phase));
}

export function advanceHoverLedges(game, dt) {
  const rider = game.player;
  for (const p of game.platforms) {
    if (!p.upper) continue;
    const occupied = rider.onGround && Math.abs(rider.y-p.y)<.01 &&
      rider.x+14>p.x && rider.x-14<p.x+p.w;
    const previous = p.y;
    const load = occupied ? 2.5 : 0;
    p.springSpeed += ((load-p.compression)*88 - p.springSpeed*8.5)*dt;
    p.compression += p.springSpeed*dt;
    p.y = p.restY+hoverOffset(p,game.time)+p.compression;
    if (occupied) rider.y += p.y-previous;
  }
}

// Trailing, leaf-bearing stems anchor inside the painted rock shoulders. A falling
// bead detaches from the tip of the wettest one. No particles accumulate offscreen.
export function drawLedgeGrowth(r,p,x) {
  const c=r.ctx,t=r.time,quiet=r.gentle?.38:1;
  const count=r.quality==='low'?2:3;
  for(let i=0;i<count;i++){
    const seed=p.id*2.4+i*3.73, right=i%2===1;
    const root=x+p.w*(right?.82:.12)+(i===2?p.w*.15:0);
    const y=p.y+10, length=32+12*(1+Math.sin(seed));
    const bend=quiet*(5*Math.sin(t*1.65+seed)+3*Math.sin(t*.93+seed)+p.compression*.9);
    const node=u=>[root+(right?1:-1)*10*u+Math.sin(u*5+seed)*3*u+bend*u*u, y+u*length];
    c.lineCap='round';
    for(const [color,weight] of [['#1d3837',2.5],['#648567',1]]){
      c.strokeStyle=color;c.lineWidth=weight;c.beginPath();c.moveTo(root,y);
      for(let j=1;j<=7;j++)c.lineTo(...node(j/7));c.stroke();
    }
    for(let j=1;j<=5;j++){
      const u=j/6,[lx,ly]=node(u),sign=j%2?1:-1;
      const tip=sign*(5.5-u*2)+bend*u*.3;
      c.fillStyle=j%2?'#648e77':'#426b5b';c.beginPath();c.moveTo(lx,ly);
      c.quadraticCurveTo(lx+tip,ly-2,lx+tip,ly+6);c.quadraticCurveTo(lx+1,ly+4,lx,ly);c.fill();
    }
    if(i!==0||r.gentle)continue;
    const [dx,dy]=node(1),phase=(t*.58+p.id*.371)%1,fall=Math.max(0,(phase-.72)/.28);
    c.fillStyle='#a7dfdc';c.globalAlpha=.8*(1-fall);
    c.beginPath();c.ellipse(dx,dy+2+fall*fall*39, .4+Math.min(phase/.72,1)*1.2,1+phase*1.5,0,0,Math.PI*2);c.fill();c.globalAlpha=1;
  }
}
