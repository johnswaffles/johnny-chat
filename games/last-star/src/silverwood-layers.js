// Hand-separated atlas objects, each on its own parallax plane. Local to Silverwood.
const CUTS={fall:[[0,0],[450,0],[450,650],[535,760],[535,1024],[0,1024]],tree:[[570,100],[1050,100],[1133,400],[1133,780],[1090,1024],[535,1024],[535,710],[441,600],[441,380]],arch:[[1134,0],[1536,0],[1536,1024],[1110,1024],[1110,720],[1134,600]]};
const BOUNDS={fall:[0,0,535,1024],tree:[441,100,692,924],arch:[1110,0,426,1024]};
export function prepareSilverwoodLayers(image){
 const layers={};for(const [kind,points] of Object.entries(CUTS)){const [x,y,w,h]=BOUNDS[kind],canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');c.translate(-x,-y);c.beginPath();points.forEach(([px,py],i)=>i?c.lineTo(px,py):c.moveTo(px,py));c.closePath();c.clip();c.drawImage(image,0,0);layers[kind]=canvas;}return layers;
}
function object(r,kind,x,y,scale,alpha,sway=0){
 const c=r.ctx,[sx,sy]=BOUNDS[kind];c.save();c.translate(x,y);c.transform(1,0,sway,1,0,0);c.scale(scale,scale);c.translate(0,-1024);c.globalAlpha=alpha;c.drawImage(r.art.sceneryPieces[kind],sx,sy);return ()=>c.restore();
}
export function drawSilverwoodLayers(r,g){
 if(r.previewLayers===false)return;
 if(!r.art.silverwoodLayers||r.camera>2300)return;
 const c=r.ctx,t=r.time,fade=Math.min(1,Math.max(0,(2300-r.camera)/450));
 const fallX=1060-r.camera*.68,fallY=640,k=.51;
 if(fallX<r.w+100&&fallX> -300){const done=object(r,'fall',fallX,fallY,k,.92*fade);
  // Follow the painted two-stage stream exactly, from pool lip to basin.
  c.save();c.beginPath();c.moveTo(218,218);c.lineTo(258,218);c.lineTo(279,325);c.lineTo(291,340);c.lineTo(287,530);c.lineTo(320,748);c.lineTo(365,894);c.lineTo(301,908);c.lineTo(262,739);c.lineTo(252,534);c.lineTo(250,340);c.lineTo(229,322);c.closePath();c.clip();c.globalCompositeOperation='screen';c.strokeStyle='#d6f6ff';
  for(let i=0;i<18;i++){const y=215+((i*43+t*190)%675),x=y<325?240:265+(Math.max(0,y-530)*.16);c.globalAlpha=(.16+Math.sin(i*7+t)*.07)*fade;c.lineWidth=2+(i%3);c.beginPath();c.moveTo(x+(i%3-1)*8,y);c.lineTo(x+(i%3-1)*8+2,y+23);c.stroke();}c.restore();done();
  r.glow(fallX+165,fallY-50,130,'blue',.2*fade);
 }
 const treeX=1450-r.camera*.84;
 if(treeX<r.w+350&&treeX> -500){const done=object(r,'tree',treeX-400,650,.5,.7*fade,Math.sin(t*.6)*(r.gentle?.001:.004));done();}
 const archX=2060-r.camera*.9;
 if(archX<r.w+250&&archX> -300){const done=object(r,'arch',archX-570,650,.5,.83*fade);done();}
 // A few local spray droplets around the real basin, below the jump line.
 if(fallX<r.w&&fallX> -250){c.save();c.fillStyle='#caefff';for(let i=0;i<8;i++){const phase=(t*.6+i/8)%1;c.globalAlpha=(1-phase)*.23*fade;c.beginPath();c.arc(fallX+170+Math.sin(i*13)*phase*40,fallY-40-Math.sin(phase*Math.PI)*24,1+phase,0,Math.PI*2);c.fill();}c.restore();}
}
