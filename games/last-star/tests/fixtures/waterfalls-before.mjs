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
const noise=n=>{const f=Math.sin(n*132.13+76.5)*43758.54;return f-Math.floor(f);};
export function waterfallTransform(image,viewWidth,camera,worldWidth){
 const height=790,width=height*image.width/image.height;
 return {height,width,x:-(width-viewWidth)*Math.max(0,Math.min(1,camera/Math.max(1,worldWidth-viewWidth))),y:-36};
}
export function drawWaterfalls(ctx,transform,time,quality='high'){
 const {x:bx,y:by,width:bw,height:bh}=transform;
 const n=quality==='low'?7:15;
 ctx.save();ctx.globalCompositeOperation='screen';
 FALLS.forEach(([xx,top,bottom,ww,drift],id)=>{
   const x=bx+xx*bw,y=by+top*bh,w=ww*bw,h=(bottom-top)*bh,dx=drift*bw;
   ctx.save();ctx.beginPath();ctx.moveTo(x-w*.38,y);ctx.lineTo(x+w*.38,y);ctx.quadraticCurveTo(x+dx+w*.45,y+h*.4,x+dx+w*.6,y+h);ctx.lineTo(x+dx-w*.6,y+h);ctx.quadraticCurveTo(x+dx-w*.4,y+h*.4,x-w*.38,y);ctx.clip();
   for(let j=0;j<n;j++){
     const across=noise(j+id*42)-.5,speed=quality==='low'?.37:.46;
     const q=(time*(speed+noise(j+11)*.26)+noise(j*7+id))%1;
     const end=Math.min(1,q+.13+noise(j+2)*.14);
     const py=y+q*h,ey=y+end*h,px=x+across*w+dx*q;
     const g=ctx.createLinearGradient(0,py,0,ey);g.addColorStop(0,'rgba(150,221,249,0)');g.addColorStop(.38,'rgba(204,245,255,.34)');g.addColorStop(1,'rgba(218,248,255,0)');
     ctx.strokeStyle=g;ctx.lineWidth=.6+noise(j+5)*1.5;ctx.beginPath();ctx.moveTo(px,py);ctx.bezierCurveTo(px+Math.sin(time*2+j)*1.4,py+(ey-py)*.35,x+across*w+dx*end+1,ey-4,x+across*w+dx*end,ey);ctx.stroke();
   }
   // Small moving foam crests break the light into turbulent, downward-running water.
   for(let j=0;j<n;j++){
     const q=(time*(.5+noise(j+20)*.3)+noise(j+id*18))%1;
     const px=x+(noise(j+77)-.5)*w+dx*q,py=y+q*h;
     ctx.fillStyle=`rgba(219,250,255,${Math.sin(q*Math.PI)*.24})`;ctx.fillRect(px,py,.6+noise(j)*1.5,2+q*3);
   }ctx.restore();
   // Fine spray rises where each fall meets its pool.
   for(let j=0;j<(quality==='low'?3:8);j++){
     const q=(time*.3+noise(j+id*10))%1;
     ctx.fillStyle=`rgba(177,225,238,${(1-q)*.11})`;ctx.beginPath();ctx.ellipse(x+dx+(noise(j+40)-.5)*w*2,y+h-q*17,3+q*10,1+q*3,0,0,Math.PI*2);ctx.fill();
   }
 });ctx.restore();
}
