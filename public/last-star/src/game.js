import {newArcade,arcadeDamage,rewardKill,updateArcade} from './arcade.js';
import {starshardMuzzle} from './cast-pose.js';
export const SAVE_KEY = 'crownforge-last-star-v1';
export const WIDTH = 7900;
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const PLATFORMS = [
  [0,580,1080],[1200,560,670],[2000,580,600],[2710,565,650],
  [3490,565,620],[4230,580,760],[5120,570,600],[5830,555,510],
  [6450,570,1450],
  [510,455,180],[900,390,150],[1460,440,170],[1815,470,170],
  [2250,425,220],[2540,450,140],[3030,420,220],[3320,465,170],
  [3710,425,220],[4060,465,170],[4570,430,210],[4930,470,185],
  [5430,430,190],[5700,455,160],[6080,410,180],[6300,470,170],
].map(([x,y,w],id)=>({x,y,w,id,upper:id>=9}));
export const SEALS = [
  {x:820,y:580,name:'Silverwood',chapter:'I · THE SILVERWOOD'},
  {x:3690,y:565,name:'The Broken Aqueduct',chapter:'II · THE BROKEN AQUEDUCT'},
  {x:6550,y:570,name:'The Last Observatory',chapter:'III · THE LAST OBSERVATORY'},
];
import {MEMORIES} from './memories.js?staff-grounded=2';
export {MEMORIES};
const ENEMIES = [
 [1510,560,'wraith'],[2260,580,'wraith'],[2430,580,'wraith'],
 [3000,565,'wraith'],[3210,565,'wraith'],[3890,565,'wraith'],
 [4490,580,'wraith'],[4800,580,'wraith'],[5370,570,'wraith'],
 [5610,570,'wraith'],[6010,555,'wraith'],[6220,555,'wraith'],
 [7290,570,'boss'],
];
export const LIFE_STEAL = .02;
export const missingHealthBonus = p => clamp(1-p.hp/p.maxHp,0,1);
export const COOLDOWNS = {bolt:.98,blink:3.8,constellation:7,dragon:32};
export function parseSave(raw) {
  try {
    const v=typeof raw==='string'?JSON.parse(raw):raw;
    if(!v||v.version!==1||!Number.isInteger(v.checkpoint)||v.checkpoint<0||v.checkpoint>3)return null;
    return {version:1,checkpoint:v.checkpoint,memories:Array.isArray(v.memories)?[...new Set(v.memories.filter(n=>Number.isInteger(n)&&n>=0&&n<MEMORIES.length))]:[],completed:v.completed===true,elapsed:clamp(Number(v.elapsed)||0,0,86400)};
  }catch{return null;}
}
export class Game {
  constructor(saved=null){
    this.arcade=newArcade();this.platforms=PLATFORMS;this.time=0;this.elapsed=saved?.elapsed||0;this.checkpoint=saved?.checkpoint||0;this.memories=new Set(saved?.memories||[]);
    this.state='playing';this.events=[];this.projectiles=[];this.effects=[];this.numbers=[];this.kills=0;this.bossStarted=false;this.bossDefeated=false;this.zone=-1;this.jumpBuffer=0;this.coyote=0;this.targetId=null;this.chain=0;this.dragon=null;this.lastNotice=-10;
    const spawn=this.checkpoint?SEALS[this.checkpoint-1]:{x:230,y:580};
    this.player={x:spawn.x,y:spawn.y,vx:0,vy:0,face:1,hp:210,maxHp:210,mana:100,onGround:true,jumps:0,invuln:0,mantle:0,mantleCd:0,cast:0,blinked:false,rangeStacks:0,cooldowns:{bolt:0,blink:0,constellation:0,dragon:0}};
    this.enemies=ENEMIES.map(([x,y,type],id)=>({id,x,y,origin:x,type,hp:type==='boss'?1850:145,maxHp:type==='boss'?1850:145,cd:1+id*.14,windup:0,flash:0,phase:0,dead:false,attack:0,face:-1}));
    for(const e of this.enemies)if(e.x<spawn.x-100)e.dead=true;
  }
  event(type,data={}){this.events.push({type,...data});}
  notice(text){if(this.time-this.lastNotice>.8){this.event('toast',{text});this.lastNotice=this.time;}}
  save(){return {version:1,checkpoint:this.checkpoint,memories:[...this.memories],elapsed:this.elapsed,completed:this.state==='won'};}
  nearby(){
    const p=this.player;
    for(let i=0;i<SEALS.length;i++){const s=SEALS[i];if(Math.abs(p.x-s.x)<80&&Math.abs(p.y-s.y)<55)return {type:'seal',index:i,label:i<this.checkpoint?'Rest at the starseal':i===this.checkpoint?'Restore the starseal':'Restore the earlier starseal first'};}
    for(let i=0;i<MEMORIES.length;i++){const m=MEMORIES[i];if(Math.abs(p.x-m.x)<60&&Math.abs(p.y-m.y)<45)return {type:'memory',index:i,label:'Read a memory'};}
    if(p.x>7610&&this.bossDefeated)return {type:'finish',label:'Return the ember'};
    return null;
  }
  interact(){
    const near=this.nearby();if(!near)return;
    if(near.type==='seal'){
      if(near.index>this.checkpoint){this.notice('Follow the starseals from west to east.');return;}
      if(this.enemies.some(e=>!e.dead&&Math.abs(e.x-this.player.x)<280)){this.notice('The seal cannot wake while a shade is near.');return;}
      const fresh=near.index===this.checkpoint;
      this.checkpoint=Math.max(this.checkpoint,near.index+1);this.player.hp=210;this.player.mana=100;
      if(fresh){this.player.cooldowns.dragon=0;this.event('seal',{index:near.index,x:SEALS[near.index].x,y:SEALS[near.index].y});
        const lines=['The first light answers. Two more seals will open the Observatory.','The aqueduct remembers the stars. Vaelthryx can hear us now.','All three seals are awake. Something waits beneath the great astrolabe.'];
        this.event('dialogue',{text:lines[near.index]});
      }else this.notice('Health and starlight restored.');
      this.event('save');
    }else if(near.type==='memory'){
      this.memories.add(near.index);this.event('memory',{index:near.index});this.event('save');
    }else {this.state='won';this.event('won');this.event('save');}
  }
  aim(input={}){
    const p=this.player;
    if(Number.isFinite(input.aimX)&&Number.isFinite(input.aimY)){
      if(Math.abs(input.aimX-p.x)>8)p.face=Math.sign(input.aimX-p.x);
      const origin=starshardMuzzle(p),dx=input.aimX-origin.x,dy=input.aimY-origin.y;
      const len=Math.hypot(dx,dy)||1;return {dx:dx/len,dy:dy/len};
    }
    const enemy=this.enemies.filter(e=>!e.dead&&(e.x-p.x)*p.face>0&&Math.abs(e.x-p.x)<780).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0];
    if(enemy){const origin=starshardMuzzle(p),dx=enemy.x-origin.x,dy=enemy.y-(enemy.type==='boss'?85:50)-origin.y,len=Math.hypot(dx,dy)||1;return {dx:dx/len,dy:dy/len};}
    return {dx:p.face,dy:0};
  }
  bolt(x,y,aim,damage=36){this.projectiles.push({x,y,px:x,py:y,vx:aim.dx*900,vy:aim.dy*900,life:1.2+this.player.rangeStacks*.14,damage,owner:'player',r:9});}
  spell(kind,input={}){
    if(this.state!=='playing')return false;
    const p=this.player;
    if(p.cooldowns[kind]>0)return false;
    if(kind==='dragon'&&this.checkpoint<2){this.notice('Awaken the aqueduct seal to call Vaelthryx.');return false;}
    const cost=kind==='constellation'?30:kind==='dragon'?60:0;
    if(p.mana<cost){this.notice('Starlight is gathering. Give it a moment.');return false;}
    if(kind==='blink'){
      const direction=input.move?Math.sign(input.move):p.face;
      const from={x:p.x,y:p.y};let landing=null;
      for(let d=235;d>=100;d-=15){
        const x=clamp(p.x+direction*d,25,WIDTH-60);
        if(this.bossStarted&&!this.bossDefeated&&(x<6840||x>7660))continue;
        if(!this.bossStarted&&this.checkpoint<3&&x>6880)continue;
        const ground=PLATFORMS.filter(f=>x>f.x+18&&x<f.x+f.w-18&&f.y>=p.y-35&&f.y<p.y+245).sort((a,b)=>a.y-b.y)[0];
        if(ground){landing={x,y:Math.min(p.y,ground.y-2)};break;}
      }
      if(!landing){this.notice('No safe ground within the passage.');return false;}
      p.x=landing.x;p.y=landing.y;p.vy=Math.min(p.vy,0);p.invuln=.85;p.blinked=true;p.rangeStacks=Math.min(5,p.rangeStacks+1);p.face=direction;
      this.event('blink',{from,to:landing});
      for(const pos of [from,landing]){
        const target=this.enemies.filter(e=>!e.dead&&Math.hypot(e.x-pos.x,e.y-pos.y)<480).sort((a,b)=>Math.abs(a.x-pos.x)-Math.abs(b.x-pos.x))[0];
        if(target){this.damage(target,36);this.event('arc',{from:{x:pos.x,y:pos.y-65},to:{x:target.x,y:target.y-60}});}
      }
    }else if(kind==='bolt'){
      const aim=this.aim(input);p.cast=.3;p.castKind='bolt';const muzzle=starshardMuzzle(p);this.bolt(muzzle.x,muzzle.y,aim);this.event('cast',muzzle);
    }else if(kind==='constellation'){
      p.castKind='constellation';
      const targets=this.enemies.filter(e=>!e.dead&&Math.abs(e.x-p.x)<660&&(e.x-p.x)*p.face>-60).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x));
      const x=clamp(Number.isFinite(input.aimX)?input.aimX:targets[0]?.x??p.x+p.face*230,p.x-650,p.x+650);
      const platform=PLATFORMS.filter(f=>x>=f.x&&x<=f.x+f.w).sort((a,b)=>b.y-a.y)[0];
      const y=platform?.y||580;
      this.effects.push({type:'constellation',x,y,life:1.7,age:0,fired:false});p.cast=.6;
      this.event('constellation',{x,y});
    }else if(kind==='dragon'){
      p.castKind='dragon';
      this.dragon={x:p.x-600,y:170,age:0,life:7,tick:0};p.cast=.7;p.invuln=1;this.event('dragon');
    }else return false;
    p.mana-=cost;p.cooldowns[kind]=COOLDOWNS[kind];return true;
  }
  damage(e,base){
    if(e.dead||e.hp<=0||this.player.hp<=0||!Number.isFinite(base)||base<=0)return;
    if(e.type==='boss'&&!this.bossStarted)return;
    if(this.targetId!==e.id){this.targetId=e.id;this.chain=0;}
    if(this.player.blinked)this.chain=Math.min(this.chain+1,4);
    const multiplier=this.player.blinked?1+this.chain*.25:1;
    const amount=Math.round(base*multiplier*(1+missingHealthBonus(this.player))*arcadeDamage(this.arcade));
    const dealt=Math.min(e.hp,amount);e.hp=Math.max(0,e.hp-amount);e.flash=.16;
    this.player.hp=Math.min(this.player.maxHp,this.player.hp+dealt*LIFE_STEAL);
    this.numbers.push({x:e.x,y:e.y-(e.type==='boss'?140:85),text:String(amount),life:.8,color:this.chain>=4?'#e9d29c':'#bceff8'});
    this.event('hit',{x:e.x,y:e.y-55,big:e.type==='boss'});
    if(e.hp<=0){e.dead=true;this.kills++;rewardKill(this,e);this.player.mana=Math.min(100,this.player.mana+14);this.event('enemy-death',{x:e.x,y:e.y-50,boss:e.type==='boss'});
      if(e.type==='boss'){this.bossDefeated=true;this.projectiles=this.projectiles.filter(b=>b.owner==='player');this.player.hp=210;this.event('dialogue',{text:'Even a broken star can find its way home. The ember is yours again.'});}
    }
  }
  hurt(amount){
    const p=this.player;if(p.invuln>0||this.state!=='playing')return;
    if(p.hp-amount<210*.35&&p.mantleCd<=0&&p.mantle<=0){p.mantle=6;p.mantleCd=30;this.event('mantle');}
    if(p.mantle>0)amount*=.3;
    this.arcade.combo=0;this.arcade.comboTime=0;p.hp=Math.max(0,p.hp-amount);p.invuln=.8;this.event('hurt');
    if(p.hp<=0){this.state='dead';this.event('dead');}
  }
  update(dt,input={}){
    if(this.state!=='playing')return;
    dt=clamp(dt,0,.04);this.time+=dt;this.elapsed+=dt;const p=this.player;
    for(const key in p.cooldowns)p.cooldowns[key]=Math.max(0,p.cooldowns[key]-dt);
    for(const key of ['invuln','mantle','mantleCd','cast'])p[key]=Math.max(0,p[key]-dt);
    p.mana=Math.min(100,p.mana+dt*8);updateArcade(this,dt);
    this.coyote=p.onGround?.12:Math.max(0,this.coyote-dt);
    if(input.jump)this.jumpBuffer=.13;else this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);
    if(this.jumpBuffer>0&&(this.coyote>0||p.jumps<2)){
      if(this.coyote<=0&&p.jumps===0)p.jumps=1;
      p.vy=p.jumps===0?-540:-495;p.jumps++;p.onGround=false;this.coyote=0;this.jumpBuffer=0;this.event('jump',{x:p.x,y:p.y,second:p.jumps===2});
    }
    const move=clamp(input.move||0,-1,1);p.vx+=(move*265-p.vx)*Math.min(1,dt*15);
    if(move)p.face=Math.sign(move);
    const previousY=p.y;p.x=clamp(p.x+p.vx*dt,24,WIDTH-55);p.vy=Math.min(p.vy+1400*dt,850);p.y+=p.vy*dt;p.onGround=false;
    if(p.vy>=0)for(const f of PLATFORMS){if(p.x+14>f.x&&p.x-14<f.x+f.w&&previousY<=f.y+5&&p.y>=f.y){p.y=f.y;p.vy=0;p.onGround=true;p.jumps=0;break;}}
    if(this.checkpoint<3&&p.x>6870){p.x=6870;this.notice('Three starseals hold the Observatory gate.');}
    if(this.bossStarted&&!this.bossDefeated)p.x=clamp(p.x,6840,7660);
    if(p.y>880){p.invuln=0;this.hurt(35);if(this.state==='playing'){const spawn=this.checkpoint?SEALS[this.checkpoint-1]:{x:230,y:580};p.x=spawn.x;p.y=spawn.y;p.vx=p.vy=0;p.jumps=0;this.bossStarted=false;const boss=this.enemies.find(e=>e.type==='boss');if(!boss.dead){boss.hp=boss.maxHp;boss.x=boss.origin;boss.windup=0;boss.cd=2;}this.projectiles=[];this.notice('The ember catches you. Return to the path.');}}
    if(input.bolt)this.spell('bolt',input);
    if(input.blink)this.spell('blink',input);
    if(input.constellation)this.spell('constellation',input);
    if(input.dragon)this.spell('dragon',input);
    if(input.interact)this.interact();
    const zone=p.x<2600?0:p.x<5100?1:2;
    if(zone!==this.zone){this.zone=zone;this.event('zone',{index:zone});}
    if(p.x>6910&&this.checkpoint===3&&!this.bossStarted&&!this.bossDefeated){this.bossStarted=true;this.event('boss');}
    for(const e of this.enemies){
      if(e.dead)continue;e.flash=Math.max(0,e.flash-dt);e.attack=Math.max(0,e.attack-dt);
      const dx=p.x-e.x,dy=p.y-e.y;e.face=Math.sign(dx)||-1;
      if(e.type==='boss'&&!this.bossStarted)continue;
      if(Math.abs(dx)>850)continue;
      if(e.windup>0){
        e.windup-=dt;
        if(e.windup<=0){e.attack=.4;
          if(e.type==='boss'){
            const phase=e.hp<e.maxHp*.5;
            for(let i=-1;i<=1;i++){const len=Math.hypot(dx,dy-25)||1;const angle=Math.atan2(dy-25,dx)+i*(phase?.2:.15);this.projectiles.push({x:e.x,y:e.y-85,vx:Math.cos(angle)*280,vy:Math.sin(angle)*280,life:4,damage:29,owner:'enemy',r:13});}
            if(phase)this.effects.push({type:'danger',x:p.x,y:570,age:0,life:1.4,fired:false});
            this.event('enemy-cast',{x:e.x,y:e.y-85});e.cd=phase?1.8:2.6;
          }else {const len=Math.hypot(dx,dy)||1;this.projectiles.push({x:e.x,y:e.y-55,vx:dx/len*230,vy:dy/len*230,life:3.5,damage:23,owner:'enemy',r:10});e.cd=2.2;}
        }
      }else{
        e.cd-=dt;
        if(Math.abs(dx)<(e.type==='boss'?850:620)&&e.cd<=0){e.windup=e.type==='boss'?.95:.8;this.event('windup',{x:e.x,y:e.y-60});}
        if(e.type==='wraith'&&Math.abs(dx)>210){const nx=e.x+Math.sign(dx)*dt*39;if(PLATFORMS.some(f=>!f.upper&&nx>f.x+25&&nx<f.x+f.w-25&&f.y===e.y))e.x=nx;}
      }
      if(Math.abs(dx)<(e.type==='boss'?60:34)&&Math.abs(dy)<80)this.hurt(e.type==='boss'?35:18);
    }
    for(const b of this.projectiles){
      b.life-=dt;b.px=b.x;b.py=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;
      if(b.owner==='player'){
        for(const e of this.enemies){if(e.dead)continue;const r=e.type==='boss'?55:31;
          if(Math.abs(b.x-e.x)<r+10&&b.y>e.y-(e.type==='boss'?170:100)&&b.y<e.y+5){this.damage(e,b.damage);b.life=0;break;}}
      }else if(Math.abs(b.x-p.x)<24&&b.y>p.y-100&&b.y<p.y){this.hurt(b.damage);b.life=0;}
    }
    this.projectiles=this.projectiles.filter(b=>b.life>0);
    for(const f of this.effects){
      f.age+=dt;f.life-=dt;
      if(!f.fired&&f.age> (f.type==='danger'?.95:.6)){
        f.fired=true;
        if(f.type==='constellation'){for(const e of this.enemies)if(!e.dead&&Math.abs(e.x-f.x)<170&&Math.abs(e.y-f.y)<210)this.damage(e,85);this.event('meteor-hit',{x:f.x,y:f.y});}
        if(f.type==='danger'){if(Math.abs(p.x-f.x)<90&&p.y>480)this.hurt(40);this.event('danger-hit',{x:f.x,y:f.y});}
      }
    }
    this.effects=this.effects.filter(f=>f.life>0);
    if(this.dragon){const d=this.dragon;d.age+=dt;d.life-=dt;d.x+=dt*330;d.tick-=dt;
      if(d.age>1&&d.tick<=0){d.tick=.45;const center=d.x+180;for(const e of this.enemies)if(!e.dead&&Math.abs(e.x-center)<270)this.damage(e,65);this.event('lightning',{x:center,y:565});}
      if(d.life<=0)this.dragon=null;
    }
    for(const n of this.numbers){n.life-=dt;n.y-=dt*32;}this.numbers=this.numbers.filter(n=>n.life>0);
  }
}
