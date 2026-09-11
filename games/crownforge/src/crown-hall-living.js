// The prior hall stays available as the loading fallback and for reverting.
export const HALL_ART = {width:1536,height:1024,anchor:.9921875,
  braziers:[[411,651],[741,672]],chimneys:[[1002,80,.9],[759,110,.62],[1292,278,.6]]};
export function smokeBillow(t,index,offset=0){
 const age=(t*.22+index/11+offset)%1,seed=index*2.399+offset*13;
 return {age,size:(15+age*94)*(1+.18*Math.sin(seed)),
  x:95*age*age+Math.sin(t*1.1+seed+age*5)*age*20,y:-age*225,
  alpha:Math.min(1,age*15)*(1-age)**1.25*(.64+.16*Math.sin(seed))};
}
export function keyPixel(r,g,b){
 const excess=Math.min(r,b)-g;
 const alpha=1-Math.max(0,Math.min(1,(excess-18)/110));
 return [Math.min(r,g+Math.max(0,r-b)+18),g,Math.min(b,g+Math.max(0,b-r)+18),alpha];
}
export class LivingCrownHall {
 constructor(onLoad){
  this.ready=false;this.fire=new Image();this.smoke=new Image();
  this.fire.src='./assets/crown-hall-living/fire-atlas.png';
  this.smoke.src='./assets/crown-hall-living/smoke.png';
  const image=new Image();image.onload=()=>{
   const plate=document.createElement('canvas');plate.width=HALL_ART.width;plate.height=HALL_ART.height;
   const c=plate.getContext('2d');c.drawImage(image,0,0,plate.width,plate.height);
   const pixels=c.getImageData(0,0,plate.width,plate.height),d=pixels.data;
   // Chroma key once on load, never in the frame loop. Despill only magenta edges.
   for(let i=0;i<d.length;i+=4)if(Math.min(d[i],d[i+2])-d[i+1]>18){
    const [r,g,b,a]=keyPixel(d[i],d[i+1],d[i+2]);d[i]=r;d[i+1]=g;d[i+2]=b;d[i+3]=Math.round(a*255);
   }
   c.putImageData(pixels,0,0);this.plate=plate;this.ready=true;onLoad();
  };image.src='./assets/crown-hall-living/hall-chroma.png';
 }
 draw(ctx,point,width,alpha=1){
  if(!this.ready)return false;
  ctx.save();ctx.globalAlpha=alpha;
  ctx.drawImage(this.plate,point.x-width/2,point.y-width/1.5*HALL_ART.anchor,width,width/1.5);
  ctx.restore();return true;
 }
 effects(ctx,building,point,width,time,atmosphere){
  if(!this.ready||building.destroyed||building.progress<1||width<38||!atmosphere.enabled)return;
  const t=atmosphere.reducedMotion?1:time*.001,night=atmosphere.mode==='dusk';
  ctx.save();ctx.translate(point.x-width/2,point.y-width/1.5*HALL_ART.anchor);ctx.scale(width/1536,width/1536);
  ctx.globalCompositeOperation='screen';
  for(let j=0;j<HALL_ART.chimneys.length;j++){
   const [x,y,scale]=HALL_ART.chimneys[j];
   for(let i=0;i<11;i++){
    const p=smokeBillow(t,i,j*.17);ctx.save();ctx.translate(x+p.x*scale,y+p.y*scale);
    const size=p.size*scale;ctx.globalAlpha=p.alpha;
    if(this.smoke.complete&&this.smoke.naturalWidth)ctx.drawImage(this.smoke,-size/2,-size*.65,size,size*1.3);
    const g=ctx.createRadialGradient(0,0,0,0,0,size*.52);g.addColorStop(0,'rgba(200,211,215,.38)');g.addColorStop(.45,'rgba(173,188,195,.19)');g.addColorStop(1,'rgba(160,178,184,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(0,0,size*.52,size*.62,0,0,Math.PI*2);ctx.fill();ctx.restore();
   }
  }
  for(let j=0;j<2;j++){
   const [x,y]=HALL_ART.braziers[j],pulse=.88+.1*Math.sin(t*9+j);
   const glow=ctx.createRadialGradient(x,y,0,x,y,85);glow.addColorStop(0,`rgba(255,171,45,${(night?.4:.22)*pulse})`);glow.addColorStop(1,'rgba(255,100,20,0)');ctx.fillStyle=glow;ctx.fillRect(x-85,y-85,170,170);
   if(this.fire.complete&&this.fire.naturalWidth){const f=Math.floor(t*24+j*13)%32;ctx.drawImage(this.fire,f%8*128,Math.floor(f/8)*192,128,192,x-40,y-98,80,120);}
   if(!atmosphere.reducedMotion)for(let i=0;i<8;i++){const a=(t*(.23+i*.008)+i*.179+j*.43)%1;ctx.globalAlpha=(1-a)**1.7*.7;ctx.fillStyle='#ffbf5a';ctx.fillRect(x+Math.sin(i*7+a*4)*a*16+a*a*18,y-12-a*(100+i*5),1.5,2.5);}ctx.globalAlpha=1;
  }
  for(const [x,y]of [[550,539],[724,537],[363,580],[242,198],[1166,464],[1239,571],[977,605]]){
   const g=ctx.createRadialGradient(x,y,0,x,y,25);g.addColorStop(0,`rgba(255,174,54,${(night?.25:.12)*(1+.1*Math.sin(t*3+x))})`);g.addColorStop(1,'rgba(247,105,22,0)');ctx.fillStyle=g;ctx.fillRect(x-25,y-25,50,50);
  }
  ctx.restore();
 }
}
