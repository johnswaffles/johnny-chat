import {actionPose} from './action-poses.js?release=20260928-polish-preview';
// Shared painted crystal coordinates keep rendering and projectile origins together.
export function forwardCastPose(p){
 const scale=.17;
 return p.onGround
  ?actionPose(2)
  :{source:[780,170,756,660],scale,left:-410*scale,top:-65-250*scale,tip:[675,150],ground:false};
}
export function starshardMuzzle(p){const pose=forwardCastPose(p);return {x:p.x+p.face*(pose.left+pose.tip[0]*pose.scale),y:p.y+pose.top+pose.tip[1]*pose.scale};}
