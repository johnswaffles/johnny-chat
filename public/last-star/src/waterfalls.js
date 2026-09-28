// Water ribbons are registered to the painting, not the foreground camera.
// x/top/bottom/width are fractions of the panorama, so alignment survives resizing.
export const FALLS=[
 [.117,.474,.91,.014,.015],[.189,.495,.737,.010,.012],
 [.234,.521,.93,.010,-.003],[.311,.587,.81,.014,.015],
 [.452,.461,.533,.022,.004],[.385,.554,.707,.014,0],
 [.461,.548,.783,.026,.008],[.522,.555,.822,.011,0],
 [.602,.641,.825,.027,.012],[.815,.524,.748,.012,.002],
 [.662,.527,.667,.005,0],[.691,.529,.685,.006,.004],[.719,.535,.706,.006,0],
];
// Sprite 2 crossed the solid Silverwood tree arch. Keep atlas IDs stable.
export const ACTIVE_WATERFALL_IDS=FALLS.map((_,id)=>id).filter(id=>id!==2);
export function waterfallTransform(image,viewWidth,camera,worldWidth){
 const height=790,width=height*image.width/image.height;
 return {height,width,x:-(width-viewWidth)*Math.max(0,Math.min(1,camera/Math.max(1,worldWidth-viewWidth))),y:-36};
}
// Prebaked 16-frame sprites. Gameplay only copies visible images.
export const WATER_FRAMES=16;
export function waterFrame(time){return ((Math.floor(time*12)%WATER_FRAMES)+WATER_FRAMES)%WATER_FRAMES;}
export async function createWaterfallSprites(image){
 const bw=790*image.width/image.height;
 return Promise.all(ACTIVE_WATERFALL_IDS.map(async id=>{
  const [xx,top,bottom,ww,drift]=FALLS[id];
  const w=ww*bw,h=Math.ceil((bottom-top)*790),dx=drift*bw;
  const left=Math.floor(Math.min(-w*.6,dx-w*.6))-2,width=Math.ceil(Math.abs(dx)+w*1.2)+4;
  const frames=await Promise.all(Array.from({length:WATER_FRAMES},async (_,f)=>{
   const img=new Image();img.src=new URL(`../assets/water/${id}-${f}.png`,import.meta.url).href;await img.decode();return img;
  }));
  return {frames,width,height:h,left,x:xx*bw,y:top*790};
 }));
}
// Newly registered painted streams: upper aqueduct, distant ridge and east cliff.
export const EXTRA_FALLS=[
 [.343,.383,.532,.005,.004],[.406,.391,.505,.004,.006],
 [.485,.384,.458,.006,.004],[.586,.519,.602,.003,.004],
 [.951,.601,.857,.006,.005],
];
export function flowPhase(time,id){return ((time*(.31+(id%4)*.055))%1+1)%1;}
export function drawWaterfalls(ctx,transform,time,sprites,viewWidth){
 const phase=time*12,frame=waterFrame(time),blend=phase-Math.floor(phase);
 for(const s of sprites){
  const x=transform.x+s.x+s.left,y=transform.y+s.y;
  if(x+s.width<0||x>viewWidth||y+s.height<0||y>720)continue;
  ctx.save();ctx.globalAlpha=1-blend;ctx.drawImage(s.frames[frame],x,y);if(blend>0){ctx.globalAlpha=blend;ctx.drawImage(s.frames[(frame+1)%WATER_FRAMES],x,y);}ctx.restore();
 }
 const all=[...ACTIVE_WATERFALL_IDS.map(id=>FALLS[id]),...EXTRA_FALLS];
 all.forEach(([xx,top,bottom,ww,drift],id)=>{
  const x=transform.x+xx*transform.width,y=transform.y+top*transform.height,w=ww*transform.width,h=(bottom-top)*transform.height,dx=drift*transform.width;
  if(x+w+dx<0||x-w>viewWidth)return;
  ctx.save();ctx.beginPath();ctx.moveTo(x-w*.34,y);ctx.lineTo(x+w*.34,y);ctx.lineTo(x+dx+w*.4,y+h);ctx.lineTo(x+dx-w*.4,y+h);ctx.closePath();ctx.clip();
  // Narrow descending highlights, not a new opaque waterfall over the painting.
  for(let k=0;k<9;k++){const q=(flowPhase(time,id)+k/9)%1,lane=Math.sin(k*19+id)*w*.28,yy=y+q*h,xx=x+q*dx+lane;ctx.globalAlpha=Math.sin(q*Math.PI)*(.12+(k%3)*.045);ctx.strokeStyle='#daf5ff';ctx.lineWidth=k%3===0?1.4:.65;ctx.beginPath();ctx.moveTo(xx,yy);ctx.lineTo(xx+dx*.07,yy+Math.min(18,h*.11));ctx.stroke();}
  ctx.restore();
 });
}
