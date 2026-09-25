import {arcadeEvent,drawArcade} from './arcade-fx.js';
import {forwardCastPose} from './cast-pose.js';
import {makeCelestialSeal,drawConstellation} from './spell-fx.js';
import {LANTERNS} from './level-decor.js';
import {advanceWizardAnimation,newWizardAnimation,motionPose,drawAirCloth,idlePose} from './wizard-animation.js?idle-flow=3';
import {drawWaterfalls,waterfallTransform,createWaterfallSprites} from './waterfalls.js?arch-fix=1';
import {PLATFORMS,SEALS,MEMORIES,WIDTH,clamp} from './game.js?arcade=1';
const TAU=Math.PI*2;
const rand=(n)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
const WIZARD=[
 [20,25,364,445],[400,25,337,445],[790,25,363,445],[1170,25,358,445],
 [39,530,257,424],[370,500,324,456],[733,537,440,416],[1178,526,350,401]
];
const PROPS={tree:[40,45,587,575],rock:[633,322,600,270],arch:[22,631,586,575],dragon:[628,629,610,581]};
export async function loadArt(){
  const paths={valley:'last-star-valley-detail-v2.png',wizard:'arcanist-sheet-original-v1.png',wizardWalk:'arcanist-jog-v3.png',wizardAir:'arcanist-air-v1.png',wizardIdle:'arcanist-idle-v2.png',starshard:'starshard-energy-v1.png',wizardCast:'arcanist-forward-cast-v1.png',props:'world-atlas-v1.png',enemies:'enemies-atlas-v1.png'};
  const images={};await Promise.all(Object.entries(paths).map(async([key,path])=>{const im=new Image();im.src=new URL('../assets/'+path,import.meta.url).href;await im.decode();images[key]=im;}));images.waterSprites=await createWaterfallSprites(images.valley);return images;
}
export class Renderer {
  constructor(canvas,art){
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.art=art;this.camera=0;this.time=0;this.particles=[];this.rings=[];this.arcs=[];this.echoes=[];this.shake=0;this.flash=0;this.gentle=false;this.quality='high';this.title=true;
    this.glows={};for(const [name,color] of Object.entries({blue:'117,209,255',teal:'113,238,212',gold:'255,208,119',violet:'192,112,255',white:'224,250,255'})){
      const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');const g=x.createRadialGradient(128,128,0,128,128,128);g.addColorStop(0,`rgba(${color},.7)`);g.addColorStop(.12,`rgba(${color},.42)`);g.addColorStop(.42,`rgba(${color},.13)`);g.addColorStop(1,`rgba(${color},0)`);x.fillStyle=g;x.fillRect(0,0,256,256);this.glows[name]=c;
    }
    this.celestialSeal=makeCelestialSeal();this.shardImpacts=[];
    this.wizardAnimation=newWizardAnimation();
    this.waterSprites=art.waterSprites;
    this.resize();
  }
  resize(){const dpr=Math.min(window.devicePixelRatio||1,1.5,Math.sqrt(2400000/(window.innerWidth*window.innerHeight)));this.canvas.width=Math.round(window.innerWidth*dpr);this.canvas.height=Math.round(window.innerHeight*dpr);this.scale=this.canvas.height/720;this.w=this.canvas.width/this.scale;this.h=720;this.ctx.imageSmoothingEnabled=true;this.ctx.imageSmoothingQuality='high';}
  glow(x,y,size,color='blue',alpha=1){const c=this.ctx;c.save();c.globalCompositeOperation='screen';c.globalAlpha=alpha;c.drawImage(this.glows[color]||this.glows.blue,x-size/2,y-size/2,size,size);c.restore();}
  prop(name,x,y,w,h,alpha=1,flip=false){const c=this.ctx;const s=PROPS[name];c.save();c.globalAlpha=alpha;c.translate(x,y);if(flip)c.scale(-1,1);c.drawImage(this.art.props,...s,-w/2,-h,w,h);c.restore();}
  burst(x,y,color='blue',count=20,power=100){
    if(this.gentle)count=Math.ceil(count/3);if(this.quality==='low')count=Math.ceil(count/2);
    for(let i=0;i<count;i++){const a=Math.random()*TAU,v=(.2+Math.random())*power;this.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-20,life:.4+Math.random()*.8,max:1.2,r:1+Math.random()*2.5,color});}
    if(this.particles.length>420)this.particles.splice(0,this.particles.length-420);
  }
  event(e){
    arcadeEvent(this,e);
    if(e.type==='cast'){this.burst(e.x,e.y,'blue',12,95);this.rings.push({x:e.x,y:e.y,r:5,life:.22,color:'blue'});}
    if(e.type==='hit'){this.shardImpacts.push({x:e.x,y:e.y,life:.32});if(this.shardImpacts.length>20)this.shardImpacts.shift();this.burst(e.x,e.y,'blue',20,140);this.rings.push({x:e.x,y:e.y,r:6,life:.32,color:'blue'});}
    if(e.type==='jump'){this.burst(e.x,e.y,'teal',e.second?22:9,60);if(e.second)this.rings.push({x:e.x,y:e.y,r:10,life:.5,color:'teal'});}
    if(e.type==='blink'){
      for(const pos of [e.from,e.to]){this.burst(pos.x,pos.y-55,'violet',40,150);this.rings.push({x:pos.x,y:pos.y-55,r:20,life:.65,color:'violet',portal:true});}
      this.echoes.push({x:e.from.x,y:e.from.y,life:.7});this.arcs.push({from:{x:e.from.x,y:e.from.y-55},to:{x:e.to.x,y:e.to.y-55},life:.28,soft:true});
    }
    if(e.type==='arc')this.arcs.push({...e,life:.23});
    if(e.type==='meteor-hit'){this.burst(e.x,e.y-20,'blue',70,270);this.rings.push({x:e.x,y:e.y,r:20,life:.75,color:'blue',ground:true});this.shake=.18;this.flash=.06;}
    if(e.type==='danger-hit'){this.burst(e.x,e.y-15,'violet',40,190);this.rings.push({x:e.x,y:e.y,r:20,life:.5,color:'violet',ground:true});}
    if(e.type==='enemy-death'){this.burst(e.x,e.y,e.boss?'gold':'violet',e.boss?100:35,e.boss?250:110);if(e.boss){this.flash=.3;this.shake=.4;}}
    if(e.type==='seal'){this.burst(e.x,e.y-70,'gold',75,150);this.rings.push({x:e.x,y:e.y-60,r:20,life:1.4,color:'gold'});}
    if(e.type==='hurt')this.shake=.15;
    if(e.type==='lightning'){this.arcs.push({from:{x:e.x-60,y:225},to:{x:e.x,y:e.y},life:.25,lightning:true});this.burst(e.x,e.y-10,'blue',35,180);this.shake=.12;}
  }
  background(game){
    const c=this.ctx,w=this.w,t=this.time;
    c.fillStyle='#071923';c.fillRect(0,0,w,720);
    const water=waterfallTransform(this.art.valley,w,this.camera,WIDTH);
    c.drawImage(this.art.valley,water.x,water.y,water.width,water.height);
    drawWaterfalls(c,water,t,this.waterSprites,w);
    const veil=c.createLinearGradient(0,0,0,720);veil.addColorStop(0,'#10243715');veil.addColorStop(.6,'#0825350a');veil.addColorStop(1,'#061a2d95');c.fillStyle=veil;c.fillRect(0,0,w,720);
    // Quiet shafts stay behind the readable combat plane.
    c.save();c.globalCompositeOperation='screen';
    for(let i=0;i<5;i++){const x=((i*461-this.camera*.13)% (w+650)+w+650)%(w+650)-200;const g=c.createLinearGradient(x,0,x+150,640);g.addColorStop(0,'#addfed00');g.addColorStop(.2,'#aedfec0d');g.addColorStop(.7,'#91cbdb08');g.addColorStop(1,'#91cbdb00');c.fillStyle=g;c.beginPath();c.moveTo(x,0);c.lineTo(x+35,0);c.lineTo(x+310,660);c.lineTo(x+100,660);c.closePath();c.fill();}c.restore();
    // Independent middle-distance layers give the painting real parallax.
    for(let i=0;i<12;i++){
      const x=i*740+120-this.camera*.64;if(x<-450||x>w+450)continue;
      const h=330+rand(i)*180;
      this.prop('tree',x,590,h*1.06,h,.5,i%2===0);
    }
    for(let i=0;i<10;i++){
      const x=1900+i*520-this.camera*.8;if(x<-250||x>w+250)continue;
      this.prop('arch',x,620,220,310,.48);
    }
    this.fog(505,.085,.17);
    for(const tree of [[-150,615,730],[1280,585,370],[2450,598,440],[4100,606,380],[5690,590,470],[6500,610,430],[8010,635,680]]){
      const x=tree[0]-this.camera*.93;if(x<-650||x>w+650)continue;this.prop('tree',x,tree[1],tree[2]*1.02,tree[2],.75,tree[0]%3===0);
    }
    const astrolabe=7350-this.camera;
    if(astrolabe>-350&&astrolabe<w+350){
      this.glow(astrolabe,310,560,game.bossDefeated?'gold':'blue',.33);
      c.save();c.translate(astrolabe,310);c.strokeStyle=game.bossDefeated?'#d2b779aa':'#a4b8b379';
      for(let k=0;k<4;k++){c.lineWidth=k===0?4:1.5;c.beginPath();c.ellipse(0,0,165,165-k*33,t*.06+k*Math.PI/4,0,TAU);c.stroke();}
      for(let k=0;k<24;k++){const a=k*TAU/24+t*.04;c.beginPath();c.moveTo(Math.cos(a)*154,Math.sin(a)*154);c.lineTo(Math.cos(a)*165,Math.sin(a)*165);c.stroke();}c.restore();
      for(const dx of [-270,270]){const x=astrolabe+dx;c.strokeStyle='#a19874';c.lineWidth=4;c.beginPath();c.moveTo(x,570);c.lineTo(x,220);c.lineTo(x+70,220);c.stroke();c.fillStyle='#193a50';c.beginPath();c.moveTo(x+8,222);c.lineTo(x+65,222);c.lineTo(x+65+Math.sin(t)*4,410);c.lineTo(x+37,390);c.lineTo(x+8,410);c.closePath();c.fill();c.strokeStyle='#b6a371';c.lineWidth=1;c.stroke();this.star(x+36,280,14,'#b9aa78');}
    }
    // Hanging motes drift at different apparent depths.
    const count=this.quality==='low'?24:65;
    c.save();c.globalCompositeOperation='screen';
    for(let i=0;i<count;i++){
      const depth=.15+rand(i+60)*.7;const x=((rand(i+10)*(w+150)-this.camera*depth+t*(3+depth*4))%(w+150)+w+150)%(w+150)-50;
      const y=100+rand(i+40)*500+Math.sin(t*.6+i)*17;const pulse=.3+.7*(.5+.5*Math.sin(t*1.4+i));
      c.globalAlpha=pulse*.65;c.fillStyle=i%4?'#c9f7e5':'#f3d798';c.beginPath();c.arc(x,y,rand(i+22)*1.8+.4,0,TAU);c.fill();
      if(i%5===0)this.glow(x,y,28,'gold',pulse*.4);
    }c.restore();
  }
  fog(y,alpha,speed){
    const c=this.ctx,t=this.time,w=this.w;
    if(this.quality==='low')alpha*=.7;
    for(let i=0;i<4;i++){
      const x=((i*530+t*speed*50-this.camera*speed*.3)%(w+900)+w+900)%(w+900)-400;
      c.save();c.translate(x,y+Math.sin(t*.15+i)*20);c.scale(5, .55);c.globalAlpha=alpha;
      c.drawImage(this.glows.teal,-140,-140,280,280);c.restore();
    }
  }
  platforms(game){
    const c=this.ctx,cam=this.camera;
    for(const p of PLATFORMS){
      if(p.x+p.w<cam-100||p.x>cam+this.w+100)continue;const x=p.x-cam;
      if(!p.upper){
        const stone=p.x>=2710;const gr=c.createLinearGradient(0,p.y,0,800);gr.addColorStop(0,stone?'#58676a':'#1e393a');gr.addColorStop(.25,stone?'#263e48':'#132c31');gr.addColorStop(1,'#07131e');c.fillStyle=gr;c.beginPath();c.rect(x,p.y+15,p.w,260);
        if(stone){for(let j=45;j<p.w-60;j+=185){c.moveTo(x+j,p.y+270);c.lineTo(x+j,p.y+115);c.bezierCurveTo(x+j,p.y+42,x+j+120,p.y+42,x+j+120,p.y+115);c.lineTo(x+j+120,p.y+270);c.closePath();}}
        c.fill('evenodd');
        if(stone){c.strokeStyle='#9ca9a248';c.lineWidth=2;for(let j=45;j<p.w-60;j+=185){c.beginPath();c.moveTo(x+j-6,p.y+240);c.lineTo(x+j-6,p.y+115);c.bezierCurveTo(x+j-6,p.y+34,x+j+126,p.y+34,x+j+126,p.y+115);c.lineTo(x+j+126,p.y+240);c.stroke();}c.strokeStyle='#0a1c2866';c.lineWidth=1;for(let row=1;row<6;row++){c.beginPath();c.moveTo(x,p.y+row*31);c.lineTo(x+p.w,p.y+row*31);c.stroke();}}
        c.save();c.beginPath();c.rect(x,p.y-15,p.w,260);c.clip();
        const n=Math.ceil(p.w/305);for(let j=0;j<n;j++){this.prop('rock',x+j*(p.w/n)+p.w/n/2,p.y+(stone?41:155),p.w/n+24,stone?58:172,.93,j%2===0);}
        c.restore();
      }else this.prop('rock',x+p.w/2,p.y+85,p.w+10,95,1,p.id%2===0);
      // A slender moss rim makes the actual landing surface unambiguous.
      c.strokeStyle='#9cb88b70';c.lineWidth=2;c.beginPath();c.moveTo(x+6,p.y+1);c.lineTo(x+p.w-6,p.y+1);c.stroke();
      for(let j=0;j<p.w/25;j++){
        const gx=x+j*25+rand(j+p.id*30)*15;const seed=j+p.id*91;const h=5+rand(seed)*12;c.strokeStyle=j%3?'#426b56':'#8aa884';c.lineWidth=1;c.beginPath();c.moveTo(gx,p.y+2);c.quadraticCurveTo(gx-3,p.y-h*.5,gx+Math.sin(this.time*1.1+seed)*3,p.y-h);c.stroke();
        if(rand(seed+15)>.88){this.glow(gx,p.y-8,27,'teal',.6);c.fillStyle='#9fddd1';c.fillRect(gx,p.y-8,2,3);}
      }
    }
    // Bases inherit their supporting surface height; unsupported placements fail validation.
    for(const {x,y} of LANTERNS){
      const sx=x-cam;if(sx<-100||sx>this.w+100)continue;
      c.strokeStyle='#556260';c.lineWidth=4;c.beginPath();c.moveTo(sx,y);c.lineTo(sx,y-83);c.quadraticCurveTo(sx,y-101,sx+22,y-96);c.stroke();
      c.strokeStyle='#aa9765';c.lineWidth=2;c.strokeRect(sx+14,y-92,15,23);c.fillStyle='#e9bb70';c.fillRect(sx+18,y-87,7,14);this.glow(sx+22,y-79,165,'gold',.75+Math.sin(this.time*3+x)*.06);
    }
  }
  seals(game){
    const c=this.ctx,t=this.time;
    for(let i=0;i<SEALS.length;i++){
      const s=SEALS[i],x=s.x-this.camera;if(x<-300||x>this.w+300)continue;
      this.prop('arch',x,s.y+6,235,235,i<game.checkpoint?1:.77);
      const active=i<game.checkpoint;this.glow(x,s.y-130,active?300:120,active?'gold':'blue',active?.7:.5);
      c.save();c.translate(x,s.y-72);c.rotate(t*.25);c.strokeStyle=active?'#e6cc8dab':'#7fbdce88';c.lineWidth=1;
      for(let k=0;k<2;k++){c.beginPath();c.ellipse(0,0,23+k*8,33, k*Math.PI/2,0,TAU);c.stroke();}c.restore();
      this.star(x,s.y-72,12,active?'#eee0aa':'#bfe5f4');
      if(active){for(let k=0;k<5;k++){const a=t*.5+k*TAU/5;this.glow(x+Math.cos(a)*40,s.y-80+Math.sin(a)*20,20,'gold',.7);}}
    }
    for(let i=0;i<MEMORIES.length;i++){
      const m=MEMORIES[i],x=m.x-this.camera,y=m.y-24+Math.sin(t*2+i)*5;
      if(x<-100||x>this.w+100)continue;
      const read=game.memories.has(i),color=read?'blue':'gold';
      this.glow(x,y,125,color,read?.75:1.15);this.glow(x,y,42,color,1.4);
      c.save();c.strokeStyle=read?'#afe6ff':'#ffe6a0';c.lineWidth=1.5;
      c.beginPath();c.ellipse(x,y,19,26,0,0,TAU);c.stroke();c.restore();
      this.star(x,y,14,read?'#e5faff':'#fff5ce');
      for(let k=0;k<4;k++){const a=(this.gentle?0:t*.65)+k*TAU/4;this.star(x+Math.cos(a)*28,y+Math.sin(a)*20,2.5,'#fff0b5');}
      if(Math.abs(game.player.x-m.x)<220){c.save();c.font='12px Georgia';c.textAlign='center';c.fillStyle='#07151f';c.fillRect(x-62,y-58,124,23);c.fillStyle='#fff0bb';c.fillText('Read a memory',x,y-42);c.restore();}
    }
    const gateX=6900-this.camera;
    if(gateX>-150&&gateX<this.w+200){
      this.prop('arch',gateX,577,340,430,.95);
      if(game.checkpoint<3){c.save();c.globalAlpha=.3+Math.sin(t)*.05;const g=c.createLinearGradient(gateX-60,0,gateX+60,0);g.addColorStop(0,'#81cbea00');g.addColorStop(.5,'#81cbea');g.addColorStop(1,'#81cbea00');c.fillStyle=g;c.fillRect(gateX-65,270,130,295);c.restore();}
    }
    if(game.bossDefeated){const x=7730-this.camera;this.glow(x,425,350,'gold',.9);this.star(x,445+Math.sin(t)*8,22,'#faf0ca');}
  }
  star(x,y,r,color){const c=this.ctx;c.fillStyle=color;c.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4-Math.PI/2,rr=i%2?r*.24:r;c.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}c.closePath();c.fill();}
  wizard(p,alpha=1,override=null){
    const c=this.ctx,x=p.x-this.camera,t=this.time;
    const animation=this.wizardAnimation;
    const walking=override===null&&animation.walking;
    const idle=override===null&&animation.idle;
    const firing=override===null&&p.cast>0&&p.castKind==='bolt';
    const weights=override===null?(animation.weights||[0,0,0,0,1,0,0,0]):Array.from({length:8},(_,i)=>i===override?1:0);
    // Crystal coordinates are measured inside each painted pose, including casts.
    const tips=[[325,61],[309,57],[304,60],[317,62],[233,55],[270,57],[399,33],[308,22]];
    const bob=override===null&&!firing?animation.bob:0;
    c.save();c.translate(x,p.y+bob);c.scale(p.face,1-(override===null?(firing?0:animation.landing/.13*.045):0));
    for(let index=0;index<weights.length;index++){
      const weight=weights[index];if(weight<.015)continue;
      let s=WIZARD[index],h=index===7?102:114,w=h*s[2]/s[3],left=-w*.52,top=-h,tip=tips[index],art=this.art.wizard;
      if(idle||walking||(override===null&&animation.airborne)){
        const pose=idle?idlePose(animation,this.gentle):motionPose(animation);s=pose.source;h=s[3]*pose.scale;w=s[2]*pose.scale;
        left=pose.left;top=pose.top;tip=pose.tip;art=this.art[pose.key];
      }
      let castPose=null;
      if(firing){castPose=forwardCastPose(p);s=castPose.source;h=s[3]*castPose.scale;w=s[2]*castPose.scale;left=castPose.left;top=castPose.top;tip=castPose.tip;art=this.art.wizardCast;}
      c.globalAlpha=alpha;
      if(firing){
        c.save();
        if(castPose.ground){const k=castPose.scale;c.beginPath();c.moveTo(left,top);c.lineTo(left+w,top);c.lineTo(left+w,top+200*k);c.lineTo(left+768*k,top+200*k);c.lineTo(left+768*k,top+h);c.lineTo(left,top+h);c.closePath();c.clip();}
        if(!castPose.ground){const k=castPose.scale;c.beginPath();c.moveTo(left+60*k,top);c.lineTo(left+w,top);c.lineTo(left+w,top+h);c.lineTo(left,top+h);c.lineTo(left,top+200*k);c.lineTo(left+60*k,top+200*k);c.closePath();c.clip();}
        c.drawImage(art,...s,left,top,w,h);c.restore();
      }
      else if(override===null&&animation.airborne)drawAirCloth(c,art,s,left,top,h/s[3],animation.airTime);
      else c.drawImage(art,...s,left,top,w,h);
      const tx=left+tip[0]*h/s[3],ty=top+tip[1]*h/s[3];
      // Cached light textures, with a crisp blue crystal core; no live blur filter.
      const power=(.85+Math.sin(t*3)*.12)*(p.cast>0?1.35:1);
      this.glow(tx,ty,38,'blue',alpha*weight*power);
      this.glow(tx,ty,14,'blue',alpha*weight);
      c.globalAlpha=alpha*weight;c.fillStyle='#74cfff';
      c.beginPath();c.moveTo(tx,ty-4);c.lineTo(tx+2,ty);c.lineTo(tx,ty+4);c.lineTo(tx-2,ty);c.closePath();c.fill();
      c.fillStyle='#e4faff';c.fillRect(tx-.6,ty-2,1.2,4);
    }
    c.restore();
    if(alpha===1){
      this.glow(x,p.y-42,140,'blue',.1);
      if(p.mantle>0){
        this.glow(x,p.y-55,185,'teal',.75);c.save();c.strokeStyle='#b6f6deaa';c.lineWidth=2;c.beginPath();c.ellipse(x,p.y-57,45,67,Math.sin(t)*.15,0,TAU);c.stroke();c.restore();
        for(let j=0;j<3;j++){const a=t*2+j*TAU/3;this.star(x+Math.cos(a)*45,p.y-57+Math.sin(a)*60,5,'#d6f9de');}
      }
    }
  }
  enemies(game){
    const c=this.ctx,t=this.time;
    for(const e of game.enemies){
      if(e.dead||e.x<this.camera-200||e.x>this.camera+this.w+200)continue;
      const boss=e.type==='boss',x=e.x-this.camera,bob=boss?Math.sin(t*1.2)*1.5:Math.sin(t*2+e.id)*7;
      let frame=e.windup>0?1:e.attack>0?2:0;
      // Wide attack poses are framed separately to retain the whole weapon.
      const sources=boss?[[10,521,486,475],[516,410,500,581],[1024,544,499,449]]:[[18,27,483,476],[567,12,457,492],[1025,81,500,418]];
      const s=sources[frame],h=boss?196:106,w=h*s[2]/s[3];
      c.save();c.translate(x,e.y+bob);if(e.face>0)c.scale(-1,1);if(e.flash>0)c.filter='brightness(1.9)';c.drawImage(this.art.enemies,...s,-w/2,-h,w,h);c.restore();
      this.glow(x,e.y-(boss?100:70)+bob,boss?155:80,'violet',e.windup>0?.9:.4);
      if(e.windup>0){c.save();c.strokeStyle='#e1a5ecbb';c.lineWidth=1.5;c.beginPath();c.ellipse(x,e.y-3,boss?70:38,8,0,0,TAU);c.stroke();c.restore();this.star(x,e.y-h-17,6,'#f3b2e8');}
      if(!boss&&e.hp<e.maxHp){c.fillStyle='#1a1431';c.fillRect(x-24,e.y-h-15,48,3);c.fillStyle='#c994d4';c.fillRect(x-24,e.y-h-15,48*e.hp/e.maxHp,3);}
    }
  }
  starshard(x,y,vx,vy){
    const c=this.ctx,frame=Math.floor(this.time*(this.gentle?8:16))%8;
    // Painted plasma animation, anchored on the bright forward striking surface.
    c.save();c.translate(x,y);c.rotate(Math.atan2(vy,vx));
    c.globalCompositeOperation='screen';
    c.drawImage(this.art.starshard,(frame%4)*384,Math.floor(frame/4)*512,384,512,-49,-42,58,77.333);
    c.restore();
  }
  spells(game){
    const c=this.ctx,t=this.time;
    for(const b of game.projectiles){
      const x=b.x-this.camera,y=b.y,player=b.owner==='player';
      if(player){this.starshard(x,y,b.vx,b.vy);continue;}
      this.glow(x,y,73,'violet',.85);
      const tail=27,len=Math.hypot(b.vx,b.vy)||1,dx=b.vx/len,dy=b.vy/len;
      const g=c.createLinearGradient(x-dx*tail,y-dy*tail,x,y);g.addColorStop(0,'#d0a1ee00');g.addColorStop(1,'#dba8ee');c.strokeStyle=g;c.lineWidth=4;c.beginPath();c.moveTo(x-dx*tail,y-dy*tail);c.lineTo(x,y);c.stroke();
      c.fillStyle='#efd6ff';c.beginPath();c.arc(x,y,6,0,TAU);c.fill();
    }
    for(const f of game.effects){
      const x=f.x-this.camera;
      if(f.type==='constellation'){
        drawConstellation(this,f);
      }else if(f.type==='danger'){
        c.save();c.globalAlpha=.45+.3*Math.sin(f.age*18);c.strokeStyle='#df87cf';c.lineWidth=3;c.beginPath();c.ellipse(x,f.y-4,85,11,0,0,TAU);c.stroke();c.restore();
        if(f.fired)this.glow(x,f.y-80,200,'violet',.8);
      }
    }
    if(game.dragon){
      const d=game.dragon,x=d.x-this.camera,fade=Math.min(1,d.age*2,d.life);
      this.glow(x,d.y,500,'blue',fade*.7);c.save();c.translate(x,d.y);c.rotate(Math.sin(d.age*1.5)*.035);this.prop('dragon',0,130,400,270,fade);c.restore();
      if(d.age>1){this.glow(x+180,500,350,'blue',.7);}
    }
  }
  particlesDraw(dt){
    const c=this.ctx;
    for(const hit of this.shardImpacts){
      hit.life-=dt;const q=clamp(hit.life/.32,0,1),x=hit.x-this.camera;
      this.glow(x,hit.y,50,'blue',q*.8);c.save();c.globalAlpha=q;
      this.star(x,hit.y,17*q,'#f2ffff');
      c.strokeStyle='#e1faff';c.lineWidth=1.4*q;
      for(let j=0;j<(this.gentle?2:4);j++){const a=j*TAU/4+.35,r=12+(1-q)*40;c.beginPath();c.moveTo(x,hit.y);c.lineTo(x+Math.cos(a)*r*.4,hit.y+Math.sin(a)*r*.4);c.lineTo(x+Math.cos(a+.25)*r*.68,hit.y+Math.sin(a+.25)*r*.68);c.lineTo(x+Math.cos(a)*r,hit.y+Math.sin(a)*r);c.stroke();}c.strokeStyle='#a3e9ff';c.lineWidth=.8;
      for(let i=0;i<6;i++){const a=i*TAU/6,r=5+(1-q)*22;c.beginPath();c.moveTo(x+Math.cos(a)*r,hit.y+Math.sin(a)*r);c.lineTo(x+Math.cos(a)*(r+5*q),hit.y+Math.sin(a)*(r+5*q));c.stroke();}c.restore();
    }this.shardImpacts=this.shardImpacts.filter(hit=>hit.life>0);
    for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=dt*80;p.vx*=1-dt*.6;const x=p.x-this.camera;c.globalAlpha=clamp(p.life/.5,0,1);c.fillStyle=p.color==='gold'?'#f5dfaa':p.color==='violet'?'#d6b6ff':p.color==='teal'?'#b7f2d8':'#c2efff';c.fillRect(x,p.y,p.r,p.r);}
    c.globalAlpha=1;this.particles=this.particles.filter(p=>p.life>0);
    for(const ring of this.rings){ring.life-=dt;ring.r+=dt*150;const x=ring.x-this.camera;this.glow(x,ring.y,ring.r*2,ring.color,Math.min(1,ring.life)*.6);c.save();c.globalAlpha=Math.min(1,ring.life*2);c.strokeStyle=ring.color==='gold'?'#efd9a6':ring.color==='violet'?'#cbb4ff':'#c0efff';c.lineWidth=1.5;c.beginPath();c.ellipse(x,ring.y,ring.portal?ring.r*.4:ring.r,ring.ground?ring.r*.14:ring.r,0,0,TAU);c.stroke();c.restore();}
    this.rings=this.rings.filter(r=>r.life>0);
    for(const arc of this.arcs){arc.life-=dt;const ax=arc.from.x-this.camera,bx=arc.to.x-this.camera;c.save();c.globalAlpha=Math.min(1,arc.life*5);c.strokeStyle='#c8ecff';c.lineWidth=arc.lightning?3:1.5;c.shadowColor='#5fbbff';c.shadowBlur=15;c.beginPath();c.moveTo(ax,arc.from.y);
      for(let k=1;k<=10;k++){const q=k/10;c.lineTo(ax+(bx-ax)*q+(k<10?Math.sin(k*3+this.time*50)*(arc.soft?3:12):0),arc.from.y+(arc.to.y-arc.from.y)*q);}
      c.stroke();c.restore();
    }this.arcs=this.arcs.filter(a=>a.life>0);
    for(const e of this.echoes){e.life-=dt;this.wizard({...e,vx:0,face:1,onGround:true,cast:0,mantle:0},e.life*.5,6);}this.echoes=this.echoes.filter(e=>e.life>0);
  }
  foreground(){
    const c=this.ctx,t=this.time;
    this.fog(645,.24,.55);this.fog(702,.16,.35);
    // Nearby silhouettes slide faster than the player plane.
    for(let i=0;i<24;i++){
      const x=i*410-70-this.camera*1.13;if(x<-220||x>this.w+220)continue;
      const h=48+rand(i+221)*70;c.save();c.translate(x,740);c.rotate(Math.sin(t*.6+i)*.025);c.strokeStyle='#04151d';c.fillStyle='#04151d';c.lineWidth=5;c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(-15,-h*.5,0,-h);c.stroke();
      for(let j=1;j<7;j++){const yy=-h*j/7,ww=(1-j/8)*45;for(const dir of [-1,1]){c.beginPath();c.moveTo(0,yy);c.quadraticCurveTo(dir*ww,yy-25,dir*ww,yy-5);c.quadraticCurveTo(dir*ww*.4,yy+7,0,yy);c.fill();}}c.restore();
    }
    const g=c.createLinearGradient(0,600,0,720);g.addColorStop(0,'#020e1700');g.addColorStop(1,'#020e1788');c.fillStyle=g;c.fillRect(0,600,this.w,120);
  }
  draw(game,dt=1/60){
    this.time+=this.gentle?dt*.65:dt;const c=this.ctx,p=game.player;
    const desired=clamp(p.x-this.w*.37,0,WIDTH-this.w);
    if(this.title)this.camera=0;else this.camera+=(desired-this.camera)*(1-Math.exp(-dt*6));
    c.setTransform(this.scale,0,0,this.scale,0,0);c.save();
    this.shake=Math.max(0,this.shake-dt);if(!this.gentle&&this.shake>0)c.translate(Math.sin(this.time*87)*this.shake*8,Math.sin(this.time*69)*this.shake*5);
    this.background(game);this.platforms(game);this.seals(game);this.enemies(game);
    const flicker=p.invuln>0&&p.mantle<=0&&Math.floor(this.time*18)%2===0?.6:1;
    advanceWizardAnimation(this.wizardAnimation,p,dt);
    this.wizard(p,flicker);this.spells(game);drawArcade(this,game,dt);this.particlesDraw(dt);
    for(const n of game.numbers){c.globalAlpha=Math.min(1,n.life*3);c.fillStyle=n.color;c.textAlign='center';c.font='bold 17px Georgia';c.shadowColor='#061522';c.shadowBlur=5;c.fillText(n.text,n.x-this.camera,n.y);c.shadowBlur=0;}c.globalAlpha=1;
    this.foreground();this.flash=Math.max(0,this.flash-dt);if(!this.gentle&&this.flash>0){c.fillStyle=`rgba(168,225,250,${this.flash*.35})`;c.fillRect(0,0,this.w,720);}
    c.restore();
  }
}
