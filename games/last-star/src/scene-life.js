// Continuous, anchored motion; no extra scene art or per-frame image processing.
const TAU=Math.PI*2;
export function sceneMotion(time,seed,gentle=false){return Math.sin(time*.62+seed)*Math.cos(time*.19+seed*.7)*(gentle?.55:2.1);}
export function renderResolution(width,height,deviceRatio){return Math.min(deviceRatio||1,2,Math.sqrt(8300000/(width*height)));}
export function drawSceneLife(r){
 const c=r.ctx,t=r.time,w=r.w;
 // Three depths of windborne silver leaves, separated from the ground combat plane.
 const count=r.quality==='low'?16:30;
 c.save();
 for(let i=0;i<count;i++){
  const depth=.23+(i%3)*.24,speed=7+(i%5)*2;
  const x=((i*179+t*speed-r.camera*depth)%(w+160)+w+160)%(w+160)-80;
  const y=105+((i*73+t*(4+i%3))%355)+Math.sin(t*.8+i)*12;
  c.save();c.translate(x,y);c.rotate(Math.sin(t*.9+i)*1.1);c.scale(.45+depth,.5+Math.abs(Math.cos(t+i))*.5);
  c.globalAlpha=.18+depth*.35;c.fillStyle=i%4?'#c3ded9':'#e2c38b';c.beginPath();c.moveTo(-5,0);c.quadraticCurveTo(0,-4,6,0);c.quadraticCurveTo(0,3,-5,0);c.fill();c.restore();
 }
 // Small distant bird silhouettes follow independent arcs above the valley.
 c.strokeStyle='#b9d3e1';c.lineWidth=.8;c.globalAlpha=.28;
 for(let i=0;i<5;i++){const x=((i*257+t*(11+i)-r.camera*.12)%(w+180)+w+180)%(w+180)-90,y=170+i*18+Math.sin(t*.2+i)*16,wing=Math.sin(t*3.8+i)*2.8;c.beginPath();c.moveTo(x-5,y+wing);c.quadraticCurveTo(x-2,y-2,x,y);c.quadraticCurveTo(x+2,y-2,x+5,y+wing);c.stroke();}
 c.restore();
}
