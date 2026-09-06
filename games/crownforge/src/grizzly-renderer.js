import { GRIZZLY_RECTS } from './grizzly-art.js?v=20260906-wildwoodwatch2';

export class GrizzlyRenderer {
  constructor(){
    this.image=new Image();this.frames=[];
    this.image.addEventListener('load',()=>this.prepare());
    this.image.src='./assets/crownforge-grizzly-v1.png?v=20260906-grizzly1';
  }
  prepare(){
    this.frames=GRIZZLY_RECTS.map(rect=>{
      const levels=[];
      for(const scale of [1,.5,.25]){
        const tile=document.createElement('canvas');tile.width=Math.ceil(rect[2]*scale);tile.height=Math.ceil(rect[3]*scale);
        const g=tile.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(this.image,...rect,0,0,tile.width,tile.height);levels.push(tile);
      }
      return levels;
    });
  }
  draw(ctx,unit,point,size,time,reducedMotion=false,resolution=1){
    if(!this.frames.length)return false;
    const direction=Math.max(0,Math.min(3,unit.facing??0));
    const walking=!unit.dead&&(unit.motionSpeed??0)>.08;
    let column=walking?[0,1,0,2][Math.floor((unit.animationTime??0)*5.8)%4]:0;
    if(!unit.dead&&(unit.attackPhase==='contact'||unit.attackPhase==='recovery'&&unit.attackPhaseElapsed<.18))column=3;
    if(unit.dead)column=0;
    const rect=GRIZZLY_RECTS[direction*4+column],width=rect[2]/300*size,height=rect[3]/300*size;
    const levels=this.frames[direction*4+column];
    const image=levels.find(tile=>tile.width<=width*resolution*1.5)??levels.at(-1);
    ctx.save();ctx.globalAlpha=unit.dead?Math.max(0,1-(unit.deathAge??0)/5):1;
    ctx.fillStyle='rgba(13,23,17,.32)';ctx.beginPath();ctx.ellipse(point.x,point.y+size*.025,size*.31,size*.10,-.1,0,Math.PI*2);ctx.fill();
    ctx.translate(point.x,point.y);
    if(unit.dead){const fall=Math.min(1,(unit.deathAge??0)/.7);ctx.rotate(fall*(direction%2?-.48:.48));ctx.scale(1,1-fall*.48);}
    else if(!walking&&unit.attackPhase==='approach'&&!reducedMotion){const breath=Math.sin(time*.0018+(unit.id??0))*.006;ctx.scale(1-breath*.25,1+breath);}
    if(column===3)ctx.translate((direction%2?-1:1)*size*.035,(direction<2?1:-1)*size*.012);
    ctx.drawImage(image,-width*.5,-height,width,height);
    ctx.restore();return true;
  }
}
