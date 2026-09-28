// Hand-registered full frames. A single opaque drawing is selected per frame.
const SOURCES=[[0,70,384,430],[384,75,384,420],[750,140,389,355],[1135,135,401,360],[0,512,384,512],[384,512,384,512],[768,512,367,512],[1135,512,401,512]];
const PIVOTS=[211,179,176,202,217,196,211,242];
const FEET=[405,400,335,340,435,435,423,435];
const TIPS=[[339,55],[337,47],[342,59],[345,64],[260,81],[272,66],[276,124],[314,68]];
export function actionPose(index){const scale=.32;return {source:SOURCES[index],scale,left:-PIVOTS[index]*scale,top:-FEET[index]*scale,tip:TIPS[index],key:'wizardActions',ground:true};}
export function paintedAction(p,animation){
 if(!p.onGround)return null;
 if(p.cast>0&&p.castKind==='bolt'){const elapsed=.3-p.cast;return actionPose(elapsed<.09?2:elapsed<.18?3:elapsed<.25?1:0);}
 if(p.hurtPose>0)return actionPose(p.hurtPose>.14?4:5);
 if(animation.landing>0)return actionPose(animation.landing>.065?6:7);
 return null;
}

export function drawPaintedPose(ctx,art,pose,sourceScale=1){
 const [sx,sy,sw,sh]=pose.source,k=pose.scale;ctx.save();
 if(sx===384&&sy===75){ctx.beginPath();ctx.moveTo(pose.left,pose.top);ctx.lineTo(pose.left+sw*k,pose.top);ctx.lineTo(pose.left+sw*k,pose.top+200*k);ctx.lineTo(pose.left+(sw-22)*k,pose.top+200*k);ctx.lineTo(pose.left+(sw-22)*k,pose.top+sh*k);ctx.lineTo(pose.left,pose.top+sh*k);ctx.closePath();ctx.clip();}
 ctx.drawImage(art,sx*sourceScale,sy*sourceScale,sw*sourceScale,sh*sourceScale,pose.left,pose.top,sw*k,sh*k);ctx.restore();
}
