import {arcanaSprite,unit,facet} from './arcana-sprites.js?release=20261026-astral-gateways';
const TAU=Math.PI*2;
export const ARCANA_FX_LIMIT=24;
export function dangerPhase(f){
 return {charge:unit(f.age/.95),eruption:f.fired===true,fade:f.fired?unit(f.life/.28):1};
}
export function hostileStyle(b){return b.visual||(b.damage===30?'sweep':b.r>=13?'fan':'wraith');}
export function enemyPreparation(e){
 const duration=e.type==='boss'?1.05:e.role==='brute'?1:.65;
 return e.windup>0?unit(1-e.windup/duration):0;
}
export function arcanaEvent(r,e){
 const duration={seal:1.3,'enemy-cast':.34,'hostile-impact':.36,'enemy-death':.7,boss:1.3,mantle:.5}[e.type];
 if(!duration||!Number.isFinite(e.x)||!Number.isFinite(e.y))return;
 r.arcanaFX??=[];r.arcanaFX.push({...e,age:0,max:duration});
 if(r.arcanaFX.length>ARCANA_FX_LIMIT)r.arcanaFX.splice(0,r.arcanaFX.length-ARCANA_FX_LIMIT);
}
function orbit(c,x,y,rx,ry,angle,color,width=1,start=0,end=TAU){
 c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.ellipse(x,y,rx,ry,angle,start,end);c.stroke();
}
function darkCore(r,x,y,size,angle=0){
 if(arcanaSprite(r,'voidStar',x,y,size,size,{angle}))return;
 const c=r.ctx;c.save();c.translate(x,y);c.rotate(angle);c.fillStyle='#20112f';c.strokeStyle='#cb8bfa';c.lineWidth=1.5;
 c.beginPath();for(let i=0;i<12;i++){const a=i*TAU/12,s=size*(i%2?.19:.44);c.lineTo(Math.cos(a)*s,Math.sin(a)*s);}c.closePath();c.fill();c.stroke();r.star(0,0,size*.2,'#f3b5ff');c.restore();
}
export function drawHostileProjectile(r,b){
 const c=r.ctx,x=b.x-r.camera,y=b.y,style=hostileStyle(b),angle=Math.atan2(b.vy,b.vx),quiet=r.gentle||r.reducedFlash;
 if(x<-120||x>r.w+120)return;
 const sweep=style==='sweep',size=sweep?34:style==='fan'?47:36;
 r.glow(x,y,sweep?100:85,'violet',quiet?.33:.5);
 c.save();c.translate(x,y);c.rotate(angle);
 // Dark back edge, then colored plasma, then the distinct painted nucleus.
 const tail=c.createLinearGradient(-82,0,8,0);tail.addColorStop(0,'#3d205000');tail.addColorStop(.6,'#5b267b99');tail.addColorStop(1,'#ef9affcc');
 c.fillStyle=tail;c.beginPath();c.moveTo(4,-8);c.bezierCurveTo(-14,-16,-48,10,-82,-3);c.bezierCurveTo(-43,23,-19,8,4,8);c.closePath();c.fill();
 c.strokeStyle='#d4a0fa';c.lineWidth=1.2;c.beginPath();c.moveTo(-60,4);c.bezierCurveTo(-37,8,-20,-9,4,-3);c.stroke();
 if(sweep){
  c.fillStyle='#301a51cc';c.beginPath();c.moveTo(-38,22);c.bezierCurveTo(4,18,32,-2,9,-25);c.bezierCurveTo(42,-2,32,22,-38,22);c.closePath();c.fill();
  c.strokeStyle='#edb5ff';c.lineWidth=2.1;c.beginPath();c.moveTo(-32,21);c.bezierCurveTo(15,15,25,-4,9,-25);c.stroke();
 }
 darkCore(r,0,0,size,quiet?0:r.time*.55);
 if(!r.gentle){const n=r.quality==='low'?2:4;for(let i=0;i<n;i++){const phase=(r.time*.85+i/n)%1;facet(c,-16-phase*55,Math.sin(i*7)*phase*14,2.5*(1-phase),angle+i,'#caa3ee');}}
 c.restore();
}
export function drawEnemyAura(r,e,bob=0){
 const c=r.ctx,x=e.x-r.camera,y=e.y+bob,boss=e.type==='boss',t=r.time;
 if(boss){
  const cy=y-102,turn=r.gentle?0:t*.09;
  c.save();c.globalAlpha=e.windup>0?.54:.26;
  orbit(c,x,cy,75,94,turn,'#ad78b8',1.3,.15,TAU-.15);
  orbit(c,x,cy,84,101,-turn*.6,'#947b91',.7,.35,Math.PI*1.8);
  for(let i=0;i<9;i++){const a=i*TAU/9+turn;facet(c,x+Math.cos(a)*79,cy+Math.sin(a)*97,3.5,a,'#cdb2db');}
  c.restore();
 }
}
export function drawEnemyCharge(r,e,bob=0){
 const c=r.ctx,x=e.x-r.camera,y=e.y+bob,boss=e.type==='boss',charge=enemyPreparation(e),t=r.time;
 if(e.windup<=0||e.freeze>0||e.stagger>0)return;
 const ranged=e.role==='ranged',pattern=boss?e.phase%3:-1,cy=y-(pattern===2?25:boss?85:55),size=12+charge*(boss?33:19);
 r.glow(x,cy,70+charge*70,'violet',charge*(r.reducedFlash?.25:.45));
 c.save();c.globalAlpha=.35+charge*.65;
 if(boss||ranged){
  darkCore(r,x,cy,size,r.gentle?0:t*.35);
  const radius=44-charge*23;
  for(let i=0;i<(boss?6:3);i++){const a=i*TAU/(boss?6:3)+(r.gentle?0:t*.23);facet(c,x+Math.cos(a)*radius,cy+Math.sin(a)*radius*.7,3+charge*2,a,'#daafff');}
  if(pattern===0)for(const a of [-.55,0,.55]){const sx=x+e.face*Math.cos(a)*44,sy=cy+Math.sin(a)*38;orbit(c,sx,sy,4,4,0,'#e9b8ff',1);}
  if(pattern===1){orbit(c,x,y-3,55,10,0,'#d9a4ed',1.5,0,TAU*charge);}
  if(pattern===2){c.strokeStyle='#f4bfdf';c.lineWidth=2;c.beginPath();c.moveTo(x+e.face*24,y-8);c.lineTo(x+e.face*56,y-8);c.lineTo(x+e.face*47,y-15);c.stroke();}
 }else{
  const reach=e.role==='brute'?94:64;c.save();c.translate(x,cy);c.scale(e.face,1);
  orbit(c,0,0,reach,reach*.6,0,'#dfa4ee',1+charge,-.85,.8);
  facet(c,reach,0,5+charge*3,Math.PI/2,'#f3caed');c.restore();
 }
 c.restore();
}
export function drawEnemySlash(r,e,bob=0){
 if(e.role==='ranged'||e.attack<=0||e.attack>=.25||e.freeze>0||e.stagger>0)return;
 const c=r.ctx,q=unit(e.attack/.25),age=1-q,reach=e.type==='boss'?60:e.role==='brute'?110:75;
 c.save();c.translate(e.x-r.camera,e.y-44+bob);c.scale(e.face,1);c.globalAlpha=q*(r.reducedFlash?.6:.85);
 const a=-1.25+age*1.8;c.fillStyle='#9e61cb7a';c.beginPath();c.ellipse(0,0,reach,reach*.6,0,a-.8,a+.6);c.ellipse(0,0,reach*.76,reach*.43,0,a+.6,a-.8,true);c.closePath();c.fill();
 orbit(c,0,0,reach,reach*.6,0,'#f0b8ff',2,a-.5,a+.6);c.restore();
}
export function drawHostileGround(r,f){
 const c=r.ctx,x=f.x-r.camera,y=f.y,{charge,eruption,fade}=dangerPhase(f);
 if(x<-160||x>r.w+160)return;
 c.save();
 if(!eruption){
  // The outer marks are the actual +/-90 damage footprint, and never flicker.
  c.fillStyle='#351a4d80';c.beginPath();c.ellipse(x,y-2,90,12,0,0,TAU);c.fill();
  orbit(c,x,y-2,90,12,0,'#d79be8',1.4);
  orbit(c,x,y-2,78,9,0,'#f3c6f7',2,-Math.PI/2,-Math.PI/2+TAU*charge);
  for(const side of [-1,1]){c.strokeStyle='#f4bce7';c.lineWidth=2;c.beginPath();c.moveTo(x+side*90,y-14);c.lineTo(x+side*90,y+2);c.lineTo(x+side*80,y+2);c.stroke();}
  darkCore(r,x,y-4,21+charge*14,0);
  const n=r.gentle?3:6;for(let i=0;i<n;i++){const a=i*TAU/n,radius=74-charge*44;facet(c,x+Math.cos(a)*radius,y-9-Math.sin(a)**2*17,3+charge*2,a,'#d4a0e9');}
 }else{
  const age=Math.max(0,f.age-.95),height=98*(.7+.3*unit(age/.045));c.globalAlpha=fade;
  r.glow(x,y-32,190,'violet',fade*(r.gentle||r.reducedFlash?.24:.5));
  if(!arcanaSprite(r,'riftCrown',x,y+3,178,height,{anchorY:1})){c.fillStyle='#9e5fc4';for(let i=0;i<5;i++)facet(c,x+(i-2)*27,y-21,29+(2-Math.abs(i-2))*17,(i-2)*.18,'#c296e2');}
  orbit(c,x,y-2,88,12,0,'#e4b4f7',1.5);
  if(!r.gentle){for(let i=0;i<7;i++){const a=i*2.399,dist=20+age*95;facet(c,x+Math.cos(a)*dist,y-14-Math.abs(Math.sin(a))*dist,3*fade,a,'#e5c2f4');}}
 }
 c.restore();
}
export function drawArcanaAftermath(r,dt){
 const c=r.ctx;
 for(const f of r.arcanaFX||[]){
  f.age+=Math.max(0,dt);if(f.age>=f.max)continue;
  const age=f.age/f.max,q=1-age,x=f.x-r.camera,y=f.y;if(x<-250||x>r.w+250)continue;
  c.save();c.globalAlpha=q;
  if(f.type==='seal'){
   const spread=28+Math.sqrt(age)*100;r.glow(x,y-86,220,'gold',q*(r.reducedFlash?.25:.5));
   orbit(c,x,y-3,spread,spread*.16,0,'#ead496',2);
   const n=r.gentle?6:12;for(let i=0;i<n;i++){const a=i*TAU/n,rx=35+age*37,py=y-10-age*(80+i%3*16);facet(c,x+Math.cos(a)*rx,py,4*q,a,'#ffe6ae');}
  }else if(f.type==='mantle'){
   orbit(c,x,y,30+age*25,44+age*30,0,'#b7f2d9',1.4);
   for(let i=0;i<6;i++){const a=i*TAU/6;facet(c,x+Math.cos(a)*(30+age*25),y+Math.sin(a)*(44+age*30),4*q,a,'#d4fff0');}
  }else if(f.type==='enemy-cast'){
   const size=16+age*31;orbit(c,x,y,size,size*.68,f.face<0?-.4:.4,'#c69ae3',1.5,1,5.7);
   for(let i=0;i<5;i++){const a=i*TAU/5;facet(c,x+Math.cos(a)*size,y+Math.sin(a)*size*.68,5*q,a,'#efbdf7');}
  }else if(f.type==='enemy-death'){
   const n=r.gentle?5:10;r.glow(x,y,100,'violet',q*.32);
   for(let i=0;i<n;i++){const a=i*2.399,dist=8+age*(f.boss?115:65);facet(c,x+Math.cos(a)*dist,y+Math.sin(a)*dist-age*20,(f.boss?12:8)*q,a+age,'#a07bd5');}
   if(age<.45)darkCore(r,x,y,36*(1-age/.45),age);
  }else if(f.type==='boss'){
   orbit(c,x,y-2,60+age*150,12+age*21,0,'#b6a0d5',1.8);for(let i=0;i<9;i++){const a=i*TAU/9;facet(c,x+Math.cos(a)*(30+age*90),y-80+Math.sin(a)*60,4*q,a,'#e5c3f1');}
  }else{
   const size=15+age*39;r.glow(x,y,105,'violet',q*(r.reducedFlash?.2:.45));
   for(let i=0;i<(r.gentle?4:7);i++){const a=i*2.399;facet(c,x+Math.cos(a)*size,y+Math.sin(a)*size,9*q,a,'#e7b4f2');}
  }
  c.restore();
 }
 r.arcanaFX=(r.arcanaFX||[]).filter(f=>f.age<f.max);
}
