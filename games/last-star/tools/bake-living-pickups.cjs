// Offline authoring only. Run with sharp and @napi-rs/canvas available to Node.
// Reproject the original celestial paintings into transparent, looping material studies.
const {createCanvas, ImageData} = require('@napi-rs/canvas');
const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'../assets');
const manifest = require('../assets/celestial-v2/manifest.json').assets;
const kinds = ['ember','frost','chain','flask','power','gem','gold','chest','chest_open'];
const side=128, frames=24, tau=2*Math.PI;
const clamp=(x,lo=0,hi=1)=>Math.max(lo,Math.min(hi,x));
const smooth=x=>{const v=clamp(x);return v*v*(3-2*v);};
const gauss=x=>Math.exp(-x*x);
const fract=x=>x-Math.floor(x);
const spec=(v,c,p)=>255-(255-v)*Math.exp(-c*p);
const rgb=(r,g,b,a)=>'rgba('+[r,g,b,a].join(',')+')';

async function painting(kind){
  const entry=manifest[kind], [left,top,width,height]=entry.bounds;
  const {data,info}=await sharp(path.join(root,entry.path)).extract({left,top,width,height})
    .resize({width:120,height:120,fit:'inside'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  return {data,w:info.width,h:info.height};
}
function sample(img,u,v){
  if(u<0||u>1||v<0||v>1)return [0,0,0,0];
  const x=u*(img.w-1),y=v*(img.h-1),ix=Math.floor(x),iy=Math.floor(y);
  let rgba=[0,0,0,0];
  for(let dy=0;dy<=1;dy++)for(let dx=0;dx<=1;dx++){
    const offset=4*(Math.min(iy+dy,img.h-1)*img.w+Math.min(ix+dx,img.w-1));
    const weight=(dx?x-ix:1-x+ix)*(dy?y-iy:1-y+iy)*img.data[offset+3]/255;
    for(let k=0;k<3;k++)rgba[k]+=img.data[offset+k]*weight;
    rgba[3]+=weight;
  }
  if(rgba[3]>0){for(let k=0;k<3;k++)rgba[k]/=rgba[3];rgba[3]*=255;}
  return rgba;
}
function fire(x,y,t,art){
  // A rolling sphere lit from within. Vertical plumes break into separate tips
  // while the dark crust and molten channels circulate about the spherical core.
  const dx=x-64,dy=y-76, radius=Math.hypot(dx,dy), a=Math.atan2(dy,dx);
  const angular=t+.29*Math.sin(a*3+t+radius*.080);
  const swirl=Math.sin(dx*.14+dy*.10+t*2+1.7*Math.sin(dy*.13+t));
  const ripple=Math.sin(dy*.26+t*3+2.3*swirl+dx*.18);
  const edge=30-radius+2.6*swirl+1.6*ripple;
  const height=76-y;
  const width=24*(1-clamp(height/59))**.66;
  const lean=(Math.sin(t+height*.075)*7+Math.sin(t*2+height*.15)*3)*clamp(height/50);
  const tipFade=1-smooth((height-32)/32);
  const lanes=Math.sin(dx*.34+swirl*2.4+height*.14+t*2);
  const column=Math.min(height+4,width-Math.abs(dx-lean)+(swirl*5+ripple*4+lanes*4)*tipFade-(1-tipFade)*7);
  const field=Math.max(edge,column);
  const opacity=smooth((field+2)/3.6);
  if(opacity<=0)return [0,0,0,0];
  const tex=sample(art,.51+Math.cos(a+angular)*Math.min(radius,27)/70,.53+Math.sin(a+angular)*Math.min(radius,27)/70);
  const heat=clamp(.19+.36*smooth(field/12)+.17*swirl+.16*ripple+.15*lanes+.09*Math.sin(height*.34+t*3+swirl));
  const stops=[[128,30,12],[240,55,10],[255,130,19],[255,208,58],[255,248,161]];
  const band=heat*4,k=Math.min(3,Math.floor(band)),frac=band-k;
  const crust=.91*smooth(edge/7)*tex[3]/255;
  return [...stops[k].map((v,i)=>(v+(stops[k+1][i]-v)*frac)*(1-crust)+tex[i]*crust),opacity*255];
}
function star(c,x,y,size,color){
  c.fillStyle=color;c.beginPath();c.moveTo(x,y-size);
  for(let i=1;i<=8;i++){const a=i*tau/8-Math.PI/2,r=i%2?size*.19:size;c.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);}
  c.fill();
}
function ellipse(c,x,y,rx,ry,fill){c.fillStyle=fill;c.beginPath();c.ellipse(x,y,rx,ry,0,0,tau);c.fill();}
const chainNodes=[[.20,.185],[.815,.51],[.18,.835]];
function lightning(c,points,color,width){
  c.strokeStyle=color;c.lineWidth=width;c.lineJoin='round';c.beginPath();
  points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();
}
function accessories(c,kind,t,box){
  const {x,y,w,h}=box;
  if(kind==='ember'){
    for(let i=0;i<6;i++){
      const p=fract(t/tau+i*.38197),q=Math.sin(Math.PI*p);
      ellipse(c,64+Math.sin(i*2.4+t+p*4)*(16+12*p),62-51*p,1.8*q+.05,3*q+.05,rgb(255,162+i*10,46,q*.94));
    }
  }else if(kind==='flask'){
    c.save();c.translate(x,y);c.scale(w,h);
    c.beginPath();c.ellipse(.52,.56,.182,.172,.25,0,tau);c.clip();
    c.strokeStyle='#c4ffad';c.lineWidth=.012;
    c.beginPath();c.moveTo(.32,.51);c.bezierCurveTo(.45,.57+.045*Math.sin(t),.56,.45-.045*Math.sin(t),.72,.51);c.stroke();
    for(let i=0;i<5;i++){
      const p=fract(t/tau+i*.291),v=.75-.38*p,u=.44+i*.042+Math.sin(p*5+i)*.027;
      const radius=.016+.011*p;
      c.strokeStyle=rgb(175,255,210,Math.sin(Math.PI*p)*.9);c.lineWidth=.009;
      c.beginPath();c.arc(u,v,radius,0,tau);c.stroke();
      ellipse(c,u-radius*.4,v-radius*.5,.006,.006,'#e4ffe0');
    }
    c.restore();
    const u=.37+.13*Math.sin(t),v=.43-.05*Math.sin(t);
    star(c,x+w*u,y+h*v,2+3*(.5+.5*Math.cos(t))**5,'#dcffea');
  }else if(kind==='chain'){
    for(let i=0;i<2;i++){
      const a=chainNodes[i],b=chainNodes[i+1],pts=[];
      for(let j=0;j<=10;j++){
        const u=j/10,envelope=Math.sin(Math.PI*u);
        const zig=envelope*(Math.sin(j*5.3+t*2+i)+.52*Math.sin(j*2.7-t*3))*6;
        pts.push([x+w*(a[0]+(b[0]-a[0])*u),y+h*(a[1]+(b[1]-a[1])*u)+zig]);
      }
      lightning(c,pts,'#a257ffae',3.6);lightning(c,pts,'#e9ceff',1.25);
      const p=fract(t/tau*2+i*.5)*10,idx=Math.floor(p),f=p-idx;
      const pt=pts[idx],next=pts[idx+1];star(c,pt[0]+(next[0]-pt[0])*f,pt[1]+(next[1]-pt[1])*f,3.3,'#ffefff');
    }
  }else if(kind==='frost'){
    for(let i=0;i<5;i++){
      const p=fract(t/tau+i*.267);const a=-2.65+i*.5;
      const px=64+Math.cos(a)*(24+p*27),py=76+Math.sin(a)*(34+p*29);
      c.globalAlpha=Math.sin(Math.PI*p)*.85;star(c,px,py,2.6,'#d2faff');
    }c.globalAlpha=1;
  }
}
// Bounds match gameplay anchors. The lid's opening uses its own supported foot.
function boxFor(kind,art){
  const chest=kind.startsWith('chest'),w=96*Math.min(1,art.w/art.h),h=96*Math.min(1,art.h/art.w);
  return {w,h,x:64-w/2,y:chest?112-h:64-h/2};
}
function material(kind,u,v,t,img){
  let s=u,b=v,shine=0,gain=1;
  if(kind==='chain'){
    const d=Math.min(...chainNodes.map(([x,y])=>Math.hypot(u-x,v-y)));
    b+=smooth((d-.105)/.16)*(.045*Math.sin(u*16+t*2)+.035*Math.sin(u*29-t*3));
  }else if(kind==='frost'){
    const tip=smooth((.84-v)/.75);
    s=.5+(u-.5)/(1+.08*Math.sin(t)*tip);
    b+=.025*Math.sin(t+u*5)*tip;
    shine=.64*gauss((v+u*.22-(.42+.36*Math.sin(t)))/.086)*tip;
  }else if(kind==='flask'){
    const belly=gauss((u-.51)/.20)*gauss((v-.57)/.21);
    s+=.015*Math.sin(20*v+t*2)*belly;b+=.013*Math.sin(15*u+t)*belly;
    const curve=.44+.20*Math.sin(t)+.83*(v-.52)**2-(v-.52)*.44;
    shine=gauss((u-curve)/.033)*(.14+1.2*belly)+.43*belly*gauss((v-.65-.025*Math.sin(u*18+t))/.022);
  }else if(kind==='gem'||kind==='power'){
    const a=t+(kind==='power'?.6:0),width=.84+.16*Math.cos(a*2);
    s=.5+(u-.5)/width;
    const spine=Math.sin(a)*.12, shift=spine*(1-2*Math.abs(v-.50));
    s+=shift;
    const edge=s-.49+(v-.49)*.39,facet=Math.floor((s+.28*Math.abs(v-.47))*5);
    gain=.82+.25*Math.cos(a+facet*1.65);
    shine=.85*gauss((edge-.40*Math.sin(a))/.055)+.23*Math.max(0,Math.cos(a+facet*1.65))**5;
  }else if(kind==='gold'){
    const cos=Math.cos(t),face=Math.max(.026,Math.abs(cos)),edge=.095*Math.abs(Math.sin(t));
    const lx=(u-.5)*2,ly=(v-.5)*2,round=Math.sqrt(Math.max(0,1-ly*ly));
    if(Math.abs(ly)>1||Math.abs(lx)>(face+edge)*round)return [0,0,0,0];
    const offset=Math.sign(Math.sin(t))*edge*.45;
    s=.5+(lx-offset)/(2*face);
    if(Math.abs(lx-offset)>face*round){
      const reed=.5+.5*Math.sin(v*260);
      return [124+92*reed,74+80*reed,25+50*reed,255];
    }
    if(cos<0)s=1-s;
    gain=.75+.24*Math.abs(cos);shine=.85*gauss((s+.33*v-(.62+.46*Math.sin(t)))/.105);
  }else if(kind==='chest'){
    const brass=gauss((v-.54)/.075)+.65*gauss((u-.48)/.11);
    shine=.84*gauss((u+.18*v-(.55+.47*Math.sin(t)))/.060)*brass;
  }
  const color=sample(img,s,b);
  if(!color[3])return color;
  const light=kind==='gold'||kind==='chest'?[1,.97,.63]:kind==='gem'?[1,.63,1]:[.72,1,1];
  return [...light.map((v,i)=>spec(color[i]*gain,v,shine)),color[3]];
}
function makeFrame(kind,img,step){
  const t=tau*step/frames,box=boxFor(kind,img),canvas=createCanvas(side,side),c=canvas.getContext('2d');
  const data=new Uint8ClampedArray(side*side*4);
  for(let y=0;y<side;y++)for(let x=0;x<side;x++){
    const u=(x+.5-box.x)/box.w,v=(y+.5-box.y)/box.h;
    const rgba=kind==='ember'?fire(x,y,t,img):material(kind,u,v,t,img);
    data.set(rgba,(y*side+x)*4);
  }
  c.putImageData(new ImageData(data,side,side),0,0);
  accessories(c,kind,t,box);
  return canvas;
}
// Pin the front feet and lift the leading edge of the lid off the box. The
// inside lining appears as the viewing angle changes from closed to open.
function openingFrame(closed,opened,f){
  const s=smooth(f/(frames-1)), closedBox=boxFor('chest',closed), openBox=boxFor('chest_open',opened);
  const lerp=(a,b)=>a+(b-a)*s;
  const top=lerp(closedBox.y,openBox.y)-3*Math.sin(s*Math.PI);
  const lid=lerp(closedBox.y+closedBox.h*.49,openBox.y+openBox.h*.29);
  const rim=lerp(closedBox.y+closedBox.h*.50,openBox.y+openBox.h*.52);
  const data=new Uint8ClampedArray(side*side*4);
  for(let y=0;y<side;y++)for(let x=0;x<side;x++){
    const u=(x+.5-closedBox.x)/closedBox.w,py=y+.5;
    let a,b,mix;
    if(py<=lid){
      const v=(py-top)/(lid-top);
      a=sample(closed,u,v*.49);b=sample(opened,u,v*.29);mix=smooth((s-.18)/.65);
    }else if(py<rim){
      const v=(py-lid)/(rim-lid);
      a=sample(closed,u,.49+.01*v);b=sample(opened,u,.29+.23*v);mix=smooth(s*4);
    }else{
      const v=(py-rim)/(112-rim);
      a=sample(closed,u,.50+v*.50);b=sample(opened,u,.52+v*.48);mix=s;
    }
    const alpha=a[3]*(1-mix)+b[3]*mix;
    data.set([0,1,2].map(i=>(a[i]*a[3]*(1-mix)+b[i]*b[3]*mix)/Math.max(alpha,.001)).concat(alpha),(y*side+x)*4);
  }
  const canvas=createCanvas(side,side);
  canvas.getContext('2d').putImageData(new ImageData(data,side,side),0,0);return canvas;
}
async function run(){
  const result=createCanvas(side*frames,side*kinds.length),ctx=result.getContext('2d');
  for(const [row,kind] of kinds.slice(0,-1).entries()){
    const img=await painting(kind);
    for(let f=0;f<frames;f++)ctx.drawImage(makeFrame(kind,img,f),side*f,side*row);
  }
  const closed=await painting('chest'),opened=await painting('chest_open');
  for(let f=0;f<frames;f++)ctx.drawImage(openingFrame(closed,opened,f),side*f,side*(kinds.length-1));
  const out=path.join(root,'celestial-v2','living-pickups-v1.webp');
  await sharp(await result.encode('png')).webp({quality:89,alphaQuality:100,effort:5}).toFile(out);
  console.log(path.basename(out),fs.statSync(out).size,'bytes');
}
run().catch(err=>{console.error(err);process.exitCode=1;});
