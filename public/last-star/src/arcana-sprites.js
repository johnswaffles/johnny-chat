// One proportional draw for all new paintings; no pixel work in the frame loop.
export function arcanaSprite(r,key,x,y,width,height,{angle=0,alpha=1,anchorY=.5}={}){
 const image=r.art?.[key];if(!image?.width)return false;
 const b=r.art.arcanaBounds?.[key]||[0,0,image.width,image.height];
 const scale=Math.min(width/b[2],height/b[3]),w=b[2]*scale,h=b[3]*scale,c=r.ctx;
 c.save();c.translate(x,y);c.rotate(angle);c.globalAlpha*=Math.max(0,Math.min(1,alpha));
 c.drawImage(image,...b,-w/2,-h*anchorY,w,h);c.restore();return true;
}
export const unit=n=>Math.max(0,Math.min(1,n));
export function facet(c,x,y,size,angle,color){
 c.save();c.translate(x,y);c.rotate(angle);c.fillStyle=color;c.beginPath();c.moveTo(0,-size);c.lineTo(size*.32,0);c.lineTo(0,size*.62);c.lineTo(-size*.26,0);c.closePath();c.fill();c.restore();
}
