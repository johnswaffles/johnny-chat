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
export function drawWaterfalls(ctx,transform,time,sprites,viewWidth){
 const frame=waterFrame(time);
 for(const s of sprites){
  const x=transform.x+s.x+s.left,y=transform.y+s.y;
  if(x+s.width<0||x>viewWidth||y+s.height<0||y>720)continue;
  ctx.drawImage(s.frames[frame],x,y);
 }
}
