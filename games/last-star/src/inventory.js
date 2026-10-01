import {LEVEL1} from './level1-config.js?release=20261001-stick-wheel';
import {starshardMuzzle} from './cast-pose.js?release=20261001-stick-wheel';
export const SLOTS=['ember','frost','chain','flask'];
export const newInventory=()=>({equipped:'ember',charges:{ember:0,frost:0,chain:0,flask:0},cooldown:0});
export function grantItem(game,kind,count=1){
 const cfg=LEVEL1.spells[kind];if(!cfg||!Number.isInteger(count)||count<1)return false;
 const inv=game.inventory,room=cfg.max-inv.charges[kind],kept=Math.min(room,count);inv.charges[kind]+=kept;const overflow=count-kept;game.arcade.score+=overflow*LEVEL1.overflowScore;
 game.event('treasure',{kind,x:game.player.x,y:game.player.y-55,text:kept?`${cfg.name} +${kept}`:`Full · +${overflow*LEVEL1.overflowScore}`});return true;
}
export function useEquipped(game,input={}){
 const inv=game.inventory,kind=inv.equipped,cfg=LEVEL1.spells[kind],p=game.player;
 const fail=()=>{game.event('unavailable');return false;};
 if(game.state!=='playing'||!cfg||inv.cooldown>0||inv.charges[kind]<=0)return fail();
 if(kind!=='flask'&&game.projectiles.length>LEVEL1.maxProjectiles-5)return fail();
 if(kind==='flask'&&p.hp>=p.maxHp)return fail();
 const aim=game.aim(input),origin=starshardMuzzle(p);
 if(kind==='chain'&&!game.enemies.some(e=>!e.dead&&(e.type!=='boss'||game.bossStarted)&&Math.hypot(e.x-origin.x,e.y-55-origin.y)<cfg.range))return fail();
 // Validate everything before spending or creating effects.
 inv.charges[kind]--;inv.cooldown=cfg.cooldown;
 if(kind==='flask'){p.hp=Math.min(p.maxHp,p.hp+cfg.heal);game.event('heal',{x:p.x,y:p.y-55});return true;}
 const attack=game.beginAttack();p.cast=.3;p.castKind='bolt';
 if(kind==='ember')game.projectiles.push({...origin,px:origin.x,py:origin.y,vx:aim.dx*560,vy:aim.dy*560,owner:'player',kind,damage:cfg.damage,r:13,life:1.5,attack});
 if(kind==='frost')for(let i=0;i<cfg.shards;i++){const a=Math.atan2(aim.dy,aim.dx)+(i-(cfg.shards-1)/2)*.13;game.projectiles.push({...origin,px:origin.x,py:origin.y,vx:Math.cos(a)*620,vy:Math.sin(a)*620,owner:'player',kind,damage:cfg.damage,r:6,life:.52,attack,hitIds:new Set()});}
 if(kind==='chain'){
  let from=origin;const visited=new Set();for(let i=0;i<cfg.targets;i++){
   const targets=game.enemies.filter(e=>!e.dead&&!visited.has(e.id)&&(e.type!=='boss'||game.bossStarted)&&Math.hypot(e.x-from.x,e.y-55-from.y)<(i?cfg.jumpRange:cfg.range)).sort((a,b)=>Math.hypot(a.x-from.x,a.y-55-from.y)-Math.hypot(b.x-from.x,b.y-55-from.y)||a.id-b.id);
   const e=targets[0];if(!e)break;visited.add(e.id);game.applyStatus(e,'chain');game.damage(e,cfg.damage,attack);const to={x:e.x,y:e.y-55};game.event('chain-arc',{from,to});from=to;
  }
 }
 game.event('special-cast',{kind,...origin});return true;
}
// Clockwise slots match the visible wheel: top, right, bottom, left.
export function stickRingIndex(x,y,current){
 if(!Number.isFinite(x)||!Number.isFinite(y)||Math.hypot(x,y)<.35)return current;
 const angle=Math.atan2(y,x)+Math.PI/2,center=current*Math.PI/2;
 const delta=Math.atan2(Math.sin(angle-center),Math.cos(angle-center));
 if(Math.abs(delta)<=Math.PI/4+.12)return current;
 return (Math.round(angle/(Math.PI/2))+4)%4;
}
export class SelectionRing{
 constructor(){this.open=false;this.index=0;this.inhibited=false;}
 cancel(){this.open=false;this.inhibited=true;}
 step(input,inventory){
  if(!input.ring)this.inhibited=false;const was=this.open,oldIndex=this.index;
  if(input.ring&&!this.inhibited){if(!was)this.index=Math.max(0,SLOTS.indexOf(inventory.equipped));this.open=true;if(input.interact)this.index=(this.index+1)%SLOTS.length;if(input.previous)this.index=(this.index+SLOTS.length-1)%SLOTS.length;this.index=stickRingIndex(input.ringX,input.ringY,this.index);}
  else if(was){inventory.equipped=SLOTS[this.index];this.open=false;}
  return {use:!!input.use&&!this.open&&!was,speed:this.open?LEVEL1.ringSpeed:1,changed:was!==this.open,selectionChanged:this.open&&oldIndex!==this.index};
 }
}
