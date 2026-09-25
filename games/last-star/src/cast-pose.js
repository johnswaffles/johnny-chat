// Shared painted crystal coordinates keep rendering and projectile origins together.
export function forwardCastPose(p){
 const scale=.17;
 return p.onGround
  ?{source:[0,170,835,680],scale,left:-420*scale,top:-665*scale,tip:[757,150],ground:true}
  :{source:[780,170,756,660],scale,left:-410*scale,top:-65-250*scale,tip:[675,150],ground:false};
}
export function starshardMuzzle(p){const pose=forwardCastPose(p);return {x:p.x+p.face*(pose.left+pose.tip[0]*pose.scale),y:p.y+pose.top+pose.tip[1]*pose.scale};}
