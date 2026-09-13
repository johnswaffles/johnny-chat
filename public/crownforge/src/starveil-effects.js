// Starveil's procedural light: deterministic particles, bounded glow textures,
// and no gameplay writes. World hit tests remain in wizard-magic.js.
const TAU=Math.PI*2;
const clamp=x=>Math.max(0,Math.min(1,x));
const noise=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
const colors={ice:'#adf3ff',violet:'#a693ff',gold:'#ffe2a1',white:'#f4feff'};
const textures=new Map();
function glow(c,x,y,r,color,alpha=1,flatten=1){
 if(r<.1||alpha<=0)return;
 let texture=textures.get(color);
 if(!texture){texture=document.createElement('canvas');texture.width=texture.height=128;const g=texture.getContext('2d'),fill=g.createRadialGradient(64,64,0,64,64,64);fill.addColorStop(0,color+'c0');fill.addColorStop(.12,color+'80');fill.addColorStop(.4,color+'28');fill.addColorStop(1,color+'00');g.fillStyle=fill;g.fillRect(0,0,128,128);textures.set(color,texture);}
 c.globalAlpha=clamp(alpha);c.drawImage(texture,x-r,y-r*flatten,r*2,r*2*flatten);
}
function line(c,points,color,width,alpha){c.globalAlpha=clamp(alpha);c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
function star(c,x,y,r,color,alpha,rotation=0){c.globalAlpha=clamp(alpha);c.fillStyle=color;c.beginPath();for(let i=0;i<8;i++){const a=rotation+i*Math.PI/4,rr=i%2?r*.2:r;const xx=x+Math.cos(a)*rr,yy=y+Math.sin(a)*rr;i?c.lineTo(xx,yy):c.moveTo(xx,yy);}c.closePath();c.fill();}
function ellipse(c,x,y,rx,ry,rotation,color,width,alpha,start=0,end=TAU){c.globalAlpha=clamp(alpha);c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),rotation,start,end);c.stroke();}
function seal(c,x,y,r,t,alpha,detail=true){
 ellipse(c,x,y,r,r*.43,0,colors.ice,1.2,alpha*.65);
 ellipse(c,x,y,r*.87,r*.374,0,colors.gold,.8,alpha*.55);
 ellipse(c,x,y,r*1.065,r*.458,0,colors.violet,2,alpha*.22);
 const count=detail?32:12;
 for(let i=0;i<count;i++){const a=i*TAU/count+t*.08,cs=Math.cos(a),sn=Math.sin(a),rr=i%4? .94:.9;line(c,[[x+cs*r*rr,y+sn*r*.43*rr],[x+cs*r,y+sn*r*.43]],i%4?colors.ice:colors.gold,i%4?.7:1.5,alpha*.7);}
 const points=Array.from({length:7},(_,i)=>{const a=i*TAU/7-t*.11;return [x+Math.cos(a)*r*.74,y+Math.sin(a)*r*.318];});
 for(let i=0;i<7;i++){line(c,[points[i],points[(i+3)%7]],colors.violet,.7,alpha*.28);star(c,...points[i],3.2,colors.gold,alpha*.9,t*.2);}
}
function comet(c,from,to,progress,size,seed,alpha){
 const q=clamp(progress),x=from.x+(to.x-from.x)*q,y=from.y+(to.y-from.y)*q;
 const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length;
 for(let ribbon=0;ribbon<3;ribbon++){
  const points=[];
  for(let j=0;j<18;j++){const back=j/17,at=Math.max(0,q-back*.4),wave=Math.sin(at*24+seed+ribbon*TAU/3)*size*1.6*back;points.push([from.x+dx*at+nx*wave,from.y+dy*at+ny*wave]);}
  line(c,points,ribbon===1?colors.gold:colors.ice,size*(ribbon===1?.32:.62),alpha*.3);
 }
 line(c,[[x-dx*.15,y-dy*.15],[x,y]],colors.ice,size*2.7,alpha*.12);
 line(c,[[x-dx*.10,y-dy*.10],[x,y]],colors.white,size*.65,alpha*.9);
 glow(c,x,y,size*10,colors.ice,alpha*.75);star(c,x,y,size*2.6,colors.white,alpha,seed);
 for(let i=0;i<12;i++){const back=noise(i+seed)*.34,at=Math.max(0,q-back),spread=(noise(i+100+seed)-.5)*size*10;star(c,from.x+dx*at+nx*spread,from.y+dy*at+ny*spread,size*(.2+noise(i+30)*.6),i%3?colors.ice:colors.gold,alpha*(1-back/.34),seed);}
}
// A substantial sphere, separate from the slim meteors of Falling Constellation.
function starfireOrb(c,from,to,z,t,seed,reduced){
 const dx=to.x-from.x,dy=to.y-from.y,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d,nx=-uy,ny=ux;
 const r=42*z,clock=reduced?0:t,tail=Math.min(d,145*z);
 const point=(back,side)=>[to.x-ux*back+nx*side,to.y-uy*back+ny*side];
 // Broad tapered plasma stream, with individually curling tongues at its edges.
 if(!reduced){
  for(let i=0;i<7;i++){
   const points=[],offset=(i-3)/3;
   for(let j=0;j<24;j++){const f=j/23,back=f*tail,wave=Math.sin(f*12-clock*9+i)*r*.23*f,side=offset*r*(1-f)*.7+wave;points.push(point(back,side));}
   line(c,points,i%3?colors.ice:colors.violet,(12-i*.9)*z,.14);
  }
  for(let i=0;i<18;i++){
   const f=(noise(i+seed)+clock*.9)%1,side=(noise(i+43)-.5)*r*(1+f),p=point(f*tail,side);
   star(c,...p,(1-f)*(1+noise(i)*2.3)*z,i%4?colors.ice:colors.gold,(1-f)*.85,clock+i);
  }
 }
 glow(c,to.x,to.y,r*2.7,colors.violet,.85);
 glow(c,to.x,to.y,r*1.9,colors.ice,.85);
 // Opaque colored body establishes volume even against bright meadow grass.
 c.save();c.globalCompositeOperation='source-over';c.globalAlpha=.96;
 const body=c.createRadialGradient(to.x-r*.26,to.y-r*.3,r*.04,to.x,to.y,r);
 body.addColorStop(0,'#f7ffff');body.addColorStop(.20,'#b5f9ff');body.addColorStop(.45,'#32cfee');body.addColorStop(.72,'#237fe4');body.addColorStop(.9,'#4b39a7');body.addColorStop(1,'#8983ff80');
 c.fillStyle=body;c.beginPath();c.ellipse(to.x,to.y,r,r*.94,0,0,TAU);c.fill();c.restore();
 // Swirling bands wrap the spherical core instead of making it a flat glow.
 for(let i=0;i<6;i++){
  const a=clock*(i%2?.9:-.65)+i*1.1;
  ellipse(c,to.x,to.y,r*(.6+i*.065),r*(.18+i*.06),a,i%2?colors.ice:colors.violet,(1.4+i*.2)*z,.58,a,a+4.5);
 }
 for(let i=0;i<9;i++){
  const a=i*TAU/9+clock*.65,points=[];
  for(let j=0;j<14;j++){const f=j/13,angle=a+f*.85,rr=r*(.9+Math.sin(f*Math.PI)*(.2+.1*Math.sin(clock*2+i)));points.push([to.x+Math.cos(angle)*rr,to.y+Math.sin(angle)*rr]);}
  line(c,points,i%3?colors.ice:colors.gold,1.3*z,.7);
 }
 ellipse(c,to.x,to.y,r*1.02,r*.97,0,colors.ice,2*z,.7);
 glow(c,to.x-r*.23,to.y-r*.27,r*.75,colors.white,.85);
 star(c,to.x-r*.25,to.y-r*.3,r*.32,colors.white,.92,clock*.08);
}
function rift(c,x,y,r,t,alpha,z){
 c.save();c.globalCompositeOperation='source-over';
 const abyss=c.createRadialGradient(x,y,0,x,y,r);abyss.addColorStop(0,'#080d2bf0');abyss.addColorStop(.48,'#211441c0');abyss.addColorStop(1,'#24144500');c.globalAlpha=alpha*.85;c.fillStyle=abyss;c.beginPath();c.ellipse(x,y,r,r*.43,0,0,TAU);c.fill();c.restore();
 glow(c,x,y,r*1.6,colors.violet,alpha*.7,.44);
 for(let j=0;j<14;j++){
  const points=[],start=j*TAU/14+t*.65;
  for(let k=0;k<25;k++){const f=k/24,a=start+f*2.5,rr=r*(.12+f*.82);points.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr*.43]);}
  line(c,points,j%3?colors.ice:colors.gold,(j%3?1:2)*z,alpha*(j%3?.32:.7));
 }
 ellipse(c,x,y,r*.94,r*.404,0,colors.violet,11*z,alpha*.17);
 ellipse(c,x,y,r*.94,r*.404,0,colors.ice,3*z,alpha*.7);
 star(c,x,y,18*z,colors.white,alpha,t*.15);glow(c,x,y,36*z,colors.ice,alpha);
 for(let i=0;i<7;i++){const a=i*TAU/7+t*.1,px=x+Math.cos(a)*r,py=y+Math.sin(a)*r*.43;glow(c,px,py,22*z,colors.ice,alpha*.8);star(c,px,py,7*z,colors.gold,alpha,a);}
}
function constellation(c,p,z,age,reduced){
 const life=3.2,f=clamp(age/life),fade=Math.pow(1-f,1.4),r=112*z,h=260*z;
 c.save();c.globalCompositeOperation='source-over';glow(c,p.x,p.y,r*1.8,'#341978',fade*.68,.5);c.restore();
 glow(c,p.x,p.y,r*1.8,colors.violet,fade*.85,.45);
 seal(c,p.x,p.y,r*(1+f*.16),age,fade,true);
 if(reduced){glow(c,p.x,p.y,r,colors.ice,fade*.25,.45);return;}
 // A suspended astrolabe opens before the seven comets finish descending.
 const sky=Math.max(0,1-age/2),sy=p.y-h;
 // A luminous curtain joins the broken sky to the impact circle.
 for(let i=0;i<12;i++){
  const a=i*TAU/12+age*.3,x=p.x+Math.cos(a)*r*.86,y=p.y+Math.sin(a)*r*.37;
  const wave=Math.sin(age*3+i)*r*.3,alpha=sky*.12*(.4+.6*Math.sin(i+age)**2);
  c.globalAlpha=alpha;c.strokeStyle=i%3?colors.violet:colors.ice;c.lineWidth=(5+i%4)*z;c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+wave,y-h*.4,p.x+Math.cos(a+1)*r*.8,sy+h*.2,p.x+Math.cos(a+.4)*r*.85,sy+Math.sin(a+.4)*r*.36);c.stroke();
 }

 glow(c,p.x,sy,r*1.3,colors.violet,sky*.8,.5);
 rift(c,p.x,sy,r,age,sky,z);
 seal(c,p.x,sy,r*.98,-age*3,sky*.85,true);
 for(let i=0;i<3;i++)ellipse(c,p.x,sy,r*(.48+i*.13),r*(.10+i*.03),-.2+i*.2,colors.ice,1,sky*.45,age+i,age+i+4.4);
 for(let i=0;i<7;i++){
  const a=i*TAU/7-.6,rr=i? r*.72:0,land={x:p.x+Math.cos(a)*rr,y:p.y+Math.sin(a)*rr*.43};
  const delay=i*.065,flight=clamp((age-delay+.16)/.6),impact=Math.max(0,age-delay-.44);
  if(age-delay<.62&&age>=delay-.16)comet(c,{x:land.x-65*z,y:land.y-h-35*z},land,flight,4.4*z,19+i,clamp((.72-age+delay)*4));
  if(impact>0){const a=clamp(1-impact/1.5);glow(c,land.x,land.y,45*z,colors.ice,a*.8,.65);ellipse(c,land.x,land.y,(8+impact*36)*z,(4+impact*18)*z,0,colors.gold,1.2,a*.6);star(c,land.x,land.y,8*z,colors.white,a*.8);}
 }
 // Ejected crystal fragments follow stable ballistic paths, never random flicker.
 for(let i=0;i<44;i++){
  const a=noise(i+51)*TAU,speed=(.3+noise(i+71)) * r,flight=clamp((age-.25)/2.8),x=p.x+Math.cos(a)*speed*flight,y=p.y+Math.sin(a)*speed*flight*.45-Math.sin(flight*Math.PI)*(20+noise(i+10)*80)*z;
  const alpha=fade*clamp(age*3)*(i%3?.8:.5);if(i%3)star(c,x,y,(1+noise(i)*2)*z,i%2?colors.ice:colors.gold,alpha,age+i);else line(c,[[x,y],[x-Math.cos(a)*7*z,y+7*z]],colors.violet,1.3*z,alpha);
 }
 const shock=clamp(age/1.2);ellipse(c,p.x,p.y,r*(.2+shock*1.5),r*(.2+shock*1.5)*.43,0,colors.ice,2*z,(1-shock)*.65);
}
// Starshard impact: the sphere fractures at chest height, then sheds its
// energy into a low shock ring and falling cinders. Purely visual.
function starfireImpact(c,p,z,age,reduced){
 const cy=p.y-48*z,f=clamp(age/1.85),fade=(1-f)**1.4;
 if(reduced){glow(c,p.x,cy,65*z,colors.ice,fade*.3);ellipse(c,p.x,p.y,70*z,30*z,0,colors.violet,2*z,fade*.5);return;}
 const opening=clamp(age/.09),blast=clamp((age-.06)/.55),expansion=1-(1-blast)**3;
 const radius=(10+100*expansion)*z;
 // A brief compression makes the release feel forceful.
 if(age<.1){const r=(34-24*opening)*z;glow(c,p.x,cy,r*2,colors.ice,.95);star(c,p.x,cy,r,colors.white,.95,age);return;}
 const power=clamp(1-(age-.1)/.85),flash=clamp(1-(age-.1)/.23);
 glow(c,p.x,p.y,170*z,colors.violet,power*.8,.42);
 // Uneven billows carry blue volume and bright hot edges, not a wheel of lines.
 for(let i=0;i<15;i++){
  const angle=noise(i+17)*TAU,reach=(.3+noise(i+37)*.7)*radius;
  const x=p.x+Math.cos(angle)*reach,y=cy+Math.sin(angle)*reach*.65-age*(10+noise(i+72)*25)*z;
  const r=(18+noise(i+43)*24)*z*(.65+expansion*.8);
  c.save();c.globalCompositeOperation='source-over';c.globalAlpha=power*.7;
  const cloud=c.createRadialGradient(x-r*.2,y-r*.2,0,x,y,r);
  cloud.addColorStop(0,i%3?'#c3fbffc0':'#fbeac9b0');cloud.addColorStop(.22,'#55e0ffb0');cloud.addColorStop(.5,'#246ddba0');cloud.addColorStop(.76,'#50349d65');cloud.addColorStop(1,'#31215a00');
  c.fillStyle=cloud;c.beginPath();c.ellipse(x,y,r,r*.85,noise(i)*2,0,TAU);c.fill();c.restore();
  glow(c,x-r*.2,y-r*.15,r*.7,i%3?colors.ice:colors.gold,power*.35);
 }
 // Torn flame tongues are asymmetric filled shapes with incandescent edges.
 for(let i=0;i<13;i++){
  const a=i*TAU/13+noise(i+7)*.3,reach=radius*(.7+noise(i+23)*.5),width=(6+noise(i+12)*11)*z;
  const base={x:p.x+Math.cos(a)*radius*.22,y:cy+Math.sin(a)*radius*.14};
  const tip={x:p.x+Math.cos(a)*reach,y:cy+Math.sin(a)*reach*.73};
  const nx=-Math.sin(a),ny=Math.cos(a),bend=(noise(i+56)-.5)*35*z;
  c.globalAlpha=power*.65;c.fillStyle=i%4?'#60dfff':'#ffe6a7';c.beginPath();c.moveTo(base.x-nx*width,base.y-ny*width);
  c.bezierCurveTo(base.x+nx*bend,base.y+ny*bend,tip.x-nx*width,tip.y-ny*width,tip.x,tip.y);
  c.bezierCurveTo(tip.x-nx*width*1.4,tip.y-ny*width*1.4,base.x+nx*width,base.y+ny*width,base.x-nx*width,base.y-ny*width);c.fill();
  line(c,[[base.x,base.y],[tip.x-nx*width*.4,tip.y-ny*width*.4],[tip.x,tip.y]],colors.white,1*z,power*.5);
 }
 // One heavy pressure wave with a broken, rippling rim.
 const shock=clamp((age-.1)/.8),sr=(20+shock*150)*z;
 ellipse(c,p.x,p.y,sr,sr*.43,0,colors.violet,15*z,(1-shock)*.17);
 ellipse(c,p.x,p.y,sr,sr*.43,0,colors.ice,4*z,(1-shock)*.6);
 for(let i=0;i<20;i++){const a=i*TAU/20;ellipse(c,p.x,p.y,sr*(1+noise(i)*.1),sr*.43*(1+noise(i)*.1),0,i%3?colors.ice:colors.gold,1.2*z,(1-shock)*.7,a,a+.08+noise(i+5)*.1);}
 // Fractured crystal chunks tumble through the blast, then become falling embers.
 for(let i=0;i<38;i++){
  const a=noise(i+81)*TAU,speed=(65+noise(i+22)*125)*z,travel=(age-.08)*speed;
  const x=p.x+Math.cos(a)*travel,y=cy+Math.sin(a)*travel*.6+(age-.08)**2*48*z;
  const size=(2+noise(i+90)*4)*z*(1-f),spin=a+age*(noise(i)*8-4);
  if(i<12){c.globalAlpha=fade*.8;c.fillStyle=i%3?colors.ice:colors.gold;c.beginPath();for(let j=0;j<3;j++){const an=spin+j*TAU/3,rr=j?size*.5:size*2;const xx=x+Math.cos(an)*rr,yy=y+Math.sin(an)*rr;j?c.lineTo(xx,yy):c.moveTo(xx,yy);}c.closePath();c.fill();}
  else star(c,x,y,size*.6,i%4?colors.ice:colors.gold,fade*.8,spin);
  line(c,[[x-Math.cos(a)*10*z,y-Math.sin(a)*6*z],[x,y]],colors.ice,z,fade*.3);
 }
 glow(c,p.x,cy,85*z,colors.ice,flash*.95);
 star(c,p.x,cy,30*z,colors.white,flash,.12);
}
function mantle(c,p,z,remaining,t,reduced){
 const r=68*z,cy=p.y-64*z,fade=clamp(remaining)*clamp((6-remaining)*5+.15),clock=reduced?0:t;
 glow(c,p.x,cy,r*1.4,colors.violet,fade*.28);
 glow(c,p.x,p.y,r*1.3,colors.ice,fade*.55,.3);
 seal(c,p.x,p.y,r*.9,clock,fade*.7,!reduced);
 // The transparent shell leaves the face and body visible between fine arcs.
 ellipse(c,p.x,cy,r*.65,r,0,colors.ice,1.5*z,fade*.7);
 ellipse(c,p.x,cy,r*.72,r*1.04,-.15,colors.violet,3*z,fade*.2);
 for(let i=0;i<3;i++){
  const turn=clock*.6+i*TAU/3,rx=r*(.15+Math.abs(Math.cos(turn))*.54);
  ellipse(c,p.x,cy,rx,r,-.22*Math.sin(turn),i%2?colors.ice:colors.gold,.85*z,fade*.42);
 }
 for(let i=0;i<18;i++){
  const a=i*TAU/18+clock*.3,x=p.x+Math.cos(a)*r*.7,y=cy+Math.sin(a)*r*.95;
  star(c,x,y,(i%3?2:4)*z,i%3?colors.ice:colors.gold,fade*(.35+.4*Math.pow(Math.sin(a+clock),2)),a);
  if(i%3===0)glow(c,x,y,13*z,colors.ice,fade*.6);
 }
 if(!reduced)for(let i=0;i<20;i++){const phase=(clock*.22+noise(i+110))%1,a=noise(i+200)*TAU,x=p.x+Math.cos(a+phase)*r*.8,y=p.y-phase*r*2.1;star(c,x,y,1.6*z,i%3?colors.ice:colors.gold,Math.sin(phase*Math.PI)*fade*.75);}
}
export function drawWizardMagic(c,renderer,sim,time){
 const z=renderer.camera.zoom,t=time/1000,reduced=Boolean(renderer.atmosphere?.reducedMotion);
 c.save();c.globalCompositeOperation='lighter';c.lineCap='round';
 try{
  for(const u of sim.units){
   if(u.type!=='wizard'||u.dead)continue;
   const p=renderer.unitScreenPoint(u);
   if(u.astralMantleTimer>0)mantle(c,p,z,u.astralMantleTimer,t,reduced);
   if(u.command==='attack'&&u.attackPhase==='anticipation'){
    const charge=clamp((u.attackPhaseElapsed??0)/.77);
    seal(c,p.x,p.y,42*z,t,charge*.65,!reduced);
    glow(c,p.x-15*z,p.y-85*z,(12+charge*22)*z,colors.ice,charge*.7);
    if(!reduced)for(let i=0;i<9;i++){const a=i*TAU/9+t*2,rr=(1-charge)*42*z;star(c,p.x-15*z+Math.cos(a)*rr,p.y-85*z+Math.sin(a)*rr*.5,2*z,colors.gold,charge,a);}
   }
  }
  for(const p of sim.wizardProjectiles??[]){
   const to=renderer.worldToScreen(p),from=renderer.worldToScreen(p.from),lift=48*z;to.y-=lift;from.y-=lift;
   starfireOrb(c,from,to,z,t,p.sourceId,reduced);
  }
  for(const e of sim.wizardImpacts??[]){
   const p=renderer.worldToScreen(e);
   starfireImpact(c,p,z,e.age,reduced);
   if(e.nova)constellation(c,p,z,e.age,reduced);
  }
 }finally{c.restore();}
}
