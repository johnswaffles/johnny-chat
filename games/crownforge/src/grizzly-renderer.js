import { GRIZZLY_RIG_ART } from './grizzly-rig-art.js?v=20260906-bearmotion1';
import { GRIZZLY_MOTION, grizzlyPose, grizzlyProjection, grizzlyAttackClock, grizzlyRearAmount } from './grizzly-motion.js?v=20260906-bearmotion1';

export class GrizzlyRenderer {
  constructor(){
    this.image=new Image();this.frames=[];
    this.parts=GRIZZLY_RIG_ART.parts.map(rect=>[...rect]);
    // Separate the planted paw from the turning shin without changing the
    // original PNG. Their overlapping fur conceals the ankle articulation.
    for(let d=0;d<4;d++)for(const n of [5,7]){
      const [x,y,w,h]=GRIZZLY_RIG_ART.parts[d*8+n],cut=Math.floor(h*.65);
      this.parts.push([x,y,w,Math.ceil(h*.79)],[x,y+cut,w,h-cut]);
    }
    this.image.addEventListener('load',()=>this.prepare());
    this.image.src=GRIZZLY_RIG_ART.src;
  }
  prepare(){
    this.frames=this.parts.map(rect=>[1,.5,.25].map(scale=>{
      const tile=document.createElement('canvas');tile.width=Math.ceil(rect[2]*scale);tile.height=Math.ceil(rect[3]*scale);
      const g=tile.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(this.image,...rect,0,0,tile.width,tile.height);return tile;
    }));
  }
  pose(unit,time=0,reducedMotion=false){
    const direction=Math.max(0,Math.min(3,unit.facing??0));
    const speed=Math.hypot(unit.velocityX??0,unit.velocityZ??0),dx=(unit.velocityX??0)/Math.max(speed,.001),dz=(unit.velocityZ??0)/Math.max(speed,.001);
    const moveX=[-dz,dx,-dx,dz][direction],moveZ=[dx,dz,-dz,-dx][direction];
    const attackTime=grizzlyAttackClock(unit);
    return grizzlyPose({direction,travel:unit.grizzlyTravel??0,walking:unit.dead?0:unit.grizzlyWalkBlend??0,
      idleTime:reducedMotion?0:(unit.animClock??time*.001),attack:unit.dead||attackTime===null?null:unit.grizzlyAttackVariant??'swipe',
      attackTime:attackTime??0,side:unit.grizzlyAttackSide??1,death:unit.dead?unit.deathAge??0:0,moveX:speed>.01?moveX:0,moveZ:speed>.01?moveZ:1});
  }
  heightFactor(unit){return .8+grizzlyRearAmount(unit.grizzlyAttackVariant,grizzlyAttackClock(unit)??0)*.3;}
  // Map a measured source bone to a projected anatomical bone. Only an
  // individual surface rotates; no complete animal is spun or mirrored.
  bone(ctx,index,from,to,width,root=[.5,.14],tip=[.5,.88]){
    const rect=this.parts[index],w=rect[2],h=rect[3];
    const ax=root[0]*w,ay=root[1]*h,bx=tip[0]*w,by=tip[1]*h;
    const sourceAngle=Math.atan2(by-ay,bx-ax),sourceLength=Math.hypot(bx-ax,by-ay);
    const dx=to.x-from.x,dy=to.y-from.y,targetLength=Math.hypot(dx,dy);
    const levels=this.frames[index],image=levels.find(tile=>tile.width<=width*this.pixelScale*1.5)??levels.at(-1);
    ctx.save();ctx.translate(from.x,from.y);ctx.rotate(Math.atan2(dy,dx));ctx.scale(targetLength/sourceLength,width/w);
    ctx.rotate(-sourceAngle);ctx.drawImage(image,-ax,-ay,w,h);ctx.restore();
  }
  body(ctx,index,pose,upright=false){
    const d=pose.direction,right=d===0||d===2;
    const root=upright?[right?.40:.60,.87]:[right?.22:.78,.56];
    const tip=upright?[right?.57:.43,.23]:[right?.78:.22,d<2?.59:.43];
    // The transverse source extent is the painted height for a horizontal
    // torso, and the painted width for an upright chest.
    const rect=this.parts[index];
    const thickness=pose.bodyThickness*(upright?1:rect[2]/rect[3]);
    this.bone(ctx,index,grizzlyProjection(pose.hip,d),grizzlyProjection(pose.shoulder,d),thickness,root,tip);
  }
  head(ctx,index,pose){
    const p=grizzlyProjection(pose.head,pose.direction),rect=this.parts[index];
    const h=pose.headSize,w=h*rect[2]/rect[3],levels=this.frames[index];
    const image=levels.find(tile=>tile.width<=w*this.pixelScale*1.5)??levels.at(-1);
    ctx.drawImage(image,p.x-w*.5,p.y-h*.48,w,h);
  }
  draw(ctx,unit,point,size,time,reducedMotion=false,resolution=1){
    if(!this.frames.length)return false;
    const pose=this.pose(unit,time,reducedMotion),d=pose.direction,base=d*8,scale=size/GRIZZLY_MOTION.modelSize;
    this.pixelScale=scale*resolution;
    ctx.save();ctx.globalAlpha=unit.dead?Math.max(0,1-(unit.deathAge??0)/5):1;
    ctx.translate(point.x,point.y);ctx.scale(scale,scale);
    const shadow=grizzlyProjection({x:0,y:0,z:-40*pose.rear},d);
    ctx.fillStyle='rgba(13,23,17,.24)';ctx.beginPath();ctx.ellipse(shadow.x,shadow.y,68-20*pose.rear,24-4*pose.rear,0,0,Math.PI*2);ctx.fill();
    const legs=Object.values(pose.legs),nearSign=d===1||d===3?1:-1;
    const drawLeg=(leg,part='both')=>{
      const root=grizzlyProjection(leg.root,d),knee=grizzlyProjection(leg.knee,d),ankle=grizzlyProjection(leg.ankle,d),paw=grizzlyProjection(leg.paw,d);
      if(part!=='lower')this.bone(ctx,base+(leg.front?4:6),root,knee,leg.front?38:42);
      if(part!=='upper'){
        const shin=32+d*4+(leg.front?0:2),width=leg.front?31:33;
        const sleeve={x:root.x+(knee.x-root.x)*.35,y:root.y+(knee.y-root.y)*.35};
        this.bone(ctx,shin,sleeve,ankle,width,[.48,.12/.79],[.52,.73/.79]);
        const rect=this.parts[shin+1],h=rect[3]/rect[2]*width,levels=this.frames[shin+1];
        const image=levels.find(tile=>tile.width<=width*this.pixelScale*1.5)??levels.at(-1);
        const air=pose.attack?Math.max(0,Math.min(1,(leg.paw.y-12)/45)):0;
        const angle=Math.atan2(ankle.y-knee.y,ankle.x-knee.x)-Math.PI*.5;
        const turn=Math.atan2(Math.sin(angle),Math.cos(angle));
        ctx.save();ctx.translate(paw.x,paw.y);ctx.rotate(Math.max(-1.15,Math.min(1.15,turn))*air);
        ctx.drawImage(image,-width*.52,-h*.8,width,h);ctx.restore();
      }
    };
    for(const leg of legs){const p=grizzlyProjection({...leg.paw,y:0},d);if(leg.paw.y<14){ctx.fillStyle='rgba(13,20,14,.19)';ctx.beginPath();ctx.ellipse(p.x,p.y,15,5,0,0,Math.PI*2);ctx.fill();}}
    legs.filter(leg=>leg.sign!==nearSign).forEach(leg=>drawLeg(leg));
    legs.filter(leg=>leg.sign===nearSign).forEach(leg=>drawLeg(leg));
    const head=base+(pose.attack?3:2);

    const chestBlend=Math.max(0,Math.min(1,(pose.rear-.35)/.35));
    if(chestBlend<1){ctx.save();ctx.globalAlpha*=1-chestBlend;this.body(ctx,base,pose);ctx.restore();}
    if(chestBlend){ctx.save();ctx.globalAlpha*=chestBlend;this.body(ctx,base+1,pose,true);ctx.restore();}
    if(pose.attack)legs.filter(leg=>leg.front&&(pose.rear>.1||leg.sign===(unit.grizzlyAttackSide??1))).forEach(leg=>drawLeg(leg));
    this.head(ctx,head,pose);
    ctx.restore();return true;
  }
}
