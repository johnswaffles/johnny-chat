// Deterministic QA player: ordinary movement, jumps and spells only. No state cheats.
import {PLATFORMS,SEALS} from '../src/game.js';
const descentDirections=new WeakMap();
export function routeInput(g){
  const p=g.player,next=SEALS[g.checkpoint],near=g.nearby();
  const enemy=g.enemies.filter(e=>!e.dead&&(e.type!=='boss'||g.bossStarted)&&Math.abs(e.x-p.x)<590).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0];
  let move=1,jump=false;
  if(enemy&&Math.abs(enemy.x-p.x)<480)move=0;
  if(next&&Math.abs(next.x-p.x)<35&&Math.abs(next.y-p.y)<45)move=0;
  const floor=PLATFORMS.find(f=>p.x>=f.x-14&&p.x<=f.x+f.w+14&&Math.abs(p.y-f.y)<7);
  if(move&&p.onGround&&floor&&floor.x+floor.w-p.x<66)jump=true;
  if(!p.onGround&&p.jumps===1&&p.vy>-140)jump=true;
  if(enemy&&p.onGround&&g.projectiles.some(b=>b.owner==='enemy'&&Math.abs(b.x-p.x)<190&&Math.abs(b.y-(p.y-60))<90))jump=true;
  if(next&&p.x>next.x+30)move=-1;
  // Walk off an upper ledge when a seal is below us before approaching it.
  if(next&&floor?.upper&&Math.abs(next.x-p.x)<150&&p.y<next.y-45&&!descentDirections.has(g))descentDirections.set(g,next.x<floor.x+floor.w/2?-1:1);
  if(descentDirections.has(g)){if(!next||p.y>=next.y-45)descentDirections.delete(g);else{move=descentDirections.get(g);jump=false;}}
  const controls={move,jump,bolt:!!enemy,constellation:!!enemy&&Math.abs(enemy.x-p.x)<580,dragon:g.bossStarted&&!g.bossDefeated,interact:near?.type==='finish'||near?.type==='seal'&&near.index===g.checkpoint};
  if(enemy){controls.aimX=enemy.x;controls.aimY=enemy.y-(enemy.type==='boss'?95:55);}
  return controls;
}
