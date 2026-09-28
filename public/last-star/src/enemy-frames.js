// Hand-painted sheets are not regular grids. Full weapon bounds and foot pivots
// are authored independently; collision boxes never crop visual artwork.
export const ENEMY_FRAMES={
 wraith:[
  {rect:[10,30,495,495],pivot:[285,510]},
  {rect:[550,10,410,500],pivot:[730,510]},
  {rect:[975,115,560,410],pivot:[1305,510]},
 ],
 boss:[
  {rect:[10,535,555,460],pivot:[280,965]},
  {rect:[540,475,450,520],pivot:[735,965]},
  {rect:[985,575,545,420],pivot:[1320,965]},
 ],
};
export function drawEnemyPose(ctx,image,type,frame,x,y,face= -1){
 const {rect,pivot}=ENEMY_FRAMES[type][frame],scale=type==='boss'?.42:.24;
 ctx.save();ctx.translate(x,y);if(face>0)ctx.scale(-1,1);
 // The neighboring guardian's raised blade overlaps the lower-left corner of
 // the wraith windup's rectangular bounds. Exclude only that empty corner.
 if(type==='wraith'&&frame===1){ctx.beginPath();const points=[[550,10],[960,10],[960,510],[710,510],[710,455],[550,455]];for(let i=0;i<points.length;i++){const [a,b]=points[i];ctx[i?'lineTo':'moveTo']((a-pivot[0])*scale,(b-pivot[1])*scale);}ctx.closePath();ctx.clip();}
 if(type==='boss'&&frame===1){ctx.beginPath();const points=[[540,475],[705,475],[745,550],[990,550],[990,995],[540,995]];for(let i=0;i<points.length;i++){const [a,b]=points[i];ctx[i?'lineTo':'moveTo']((a-pivot[0])*scale,(b-pivot[1])*scale);}ctx.closePath();ctx.clip();}
 ctx.drawImage(image,...rect,(rect[0]-pivot[0])*scale,(rect[1]-pivot[1])*scale,rect[2]*scale,rect[3]*scale);ctx.restore();
}
