// Silverwood environment study: independent GPU layers; no per-frame pixel copies.
// Coordinates are in the same 720-high logical space as the gameplay renderer.
export function gorgeLayout(width,camera){
  // Ease travel inside each painting's overscan instead of exposing its edge.
  const pan=(budget,speed)=>budget>0?budget*-Math.expm1(-Math.max(0,camera)*speed/budget):0;
  const hw=Math.max(1850,width+500),rw=Math.max(2100,width+500);
  return {horizon:[-420-pan(hw-width-420,.12),-65,hw,hw/3],
    ridge:[-150-pan(rw-width-150,.42),720-rw/3,rw,rw/3]};
}
// Water stays registered to the approved ridge; these coordinates are shared by both backends.
export const GORGE_WATER={u:.416,v:.585,w:.146,h:.47};
export function gorgeWaterRect(ridge){const [x,y,w,h]=ridge;return [x+w*GORGE_WATER.u,y+h*GORGE_WATER.v,w*GORGE_WATER.w,h*GORGE_WATER.h];}
export function gorgeAppearance(kind){
 return kind==='ridge'?{atmosphere:.20,exposure:.79,saturation:.76,opacity:1}:
  kind==='horizon'?{atmosphere:.26,exposure:.82,saturation:.72,opacity:1}:
  {atmosphere:.08,exposure:.68,saturation:.65,opacity:.58};
}
const prepared=new WeakMap();
function fallbackLayers(art){
 if(prepared.has(art))return prepared.get(art);
 const layers={};
 for(const [kind,key] of [['clouds','gorgeClouds'],['horizon','gorgeHorizon'],['ridge','gorgeRidge']]){
  const image=art[key],a=gorgeAppearance(kind),canvas=document.createElement('canvas');
  canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const c=canvas.getContext('2d');
  // Static color grading is cached once. Solid terrain alpha is never faded.
  c.filter=`saturate(${a.saturation}) brightness(${a.exposure})`;c.drawImage(image,0,0);c.filter='none';
  c.globalCompositeOperation='source-atop';c.fillStyle=`rgba(20,38,54,${a.atmosphere})`;c.fillRect(0,0,canvas.width,canvas.height);
  layers[kind]=canvas;
 }
 prepared.set(art,layers);return layers;
}
function fallbackMist(c,x,y,w,h,time,alpha){
 const drift=Math.sin(time*.07)*18;
 // Elliptic gradient without a full-screen filter or any image readback.
 c.save();c.translate(x+w*.5+drift,y+h*.5);c.scale(w*.5,h*.5);
 const vapor=c.createRadialGradient(0,0,0,0,0,1);vapor.addColorStop(0,`rgba(102,154,174,${alpha})`);vapor.addColorStop(.7,`rgba(66,112,139,${alpha*.35})`);vapor.addColorStop(1,'rgba(66,112,139,0)');c.fillStyle=vapor;c.fillRect(-1,-1,2,2);c.restore();
}
function fallbackWater(r,rect){
 const c=r.ctx,[x,y,w,h]=rect,t=r.time,n=r.quality==='low'?14:24;
 c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
 for(let i=0;i<n;i++){
  const u=(i+.5)/n,phase=i*2.399,drift=Math.sin(t*.8+phase)*w*.006;
  const line=c.createLinearGradient(0,y,0,y+h);line.addColorStop(0,'rgba(157,218,230,.22)');line.addColorStop(.70,'rgba(116,185,207,.12)');line.addColorStop(1,'rgba(116,185,207,0)');
  c.strokeStyle=line;c.lineWidth=w/n*(.26+.18*Math.sin(phase)**2);c.beginPath();c.moveTo(x+w*(.1+u*.8)+drift,y);c.bezierCurveTo(x+w*(.1+u*.8)+drift,y+h*.3,x+w*(.08+u*.84)-drift,y+h*.6,x+w*(.06+u*.88),y+h);c.stroke();
  const fall=((t*(.31+i*.013)+i*.173)%1+1)%1;c.strokeStyle=`rgba(187,232,239,${.10*(1-fall)})`;c.lineWidth=1;c.beginPath();c.moveTo(x+w*(.1+u*.8),y+fall*h);c.lineTo(x+w*(.1+u*.8),y+Math.min(1,fall+.10)*h);c.stroke();
 }
 c.restore();
}
export function drawGorgeFallback(r){
 const c=r.ctx,{horizon,ridge}=gorgeLayout(r.w,r.camera),layers=fallbackLayers(r.art);
 const sky=c.createLinearGradient(0,0,0,720);sky.addColorStop(0,'#061020');sky.addColorStop(1,'#294a5e');c.fillStyle=sky;c.fillRect(0,0,r.w,720);
 const mx=r.w*.64-r.camera*.025,my=145;c.save();const moon=c.createRadialGradient(mx,my,8,mx,my,95);moon.addColorStop(0,'#b6dfe445');moon.addColorStop(1,'#b6dfe400');c.fillStyle=moon;c.fillRect(mx-95,my-95,190,190);c.fillStyle='#92bdcb';c.beginPath();c.arc(mx,my,25,0,Math.PI*2);c.fill();c.restore();
 const cloudX=((r.time*6-r.camera*.06)%2100+2100)%2100-600;
 c.save();c.globalAlpha=gorgeAppearance('clouds').opacity;for(const x of [cloudX-2100,cloudX,cloudX+2100])if(x<r.w&&x+1800>0)c.drawImage(layers.clouds,x,-125,1800,470);c.restore();
 c.drawImage(layers.horizon,...horizon);
 fallbackMist(c,-100,260,r.w+200,230,r.time,.16);
 c.drawImage(layers.ridge,...ridge);fallbackWater(r,gorgeWaterRect(ridge));
 const [x,y,w,h]=ridge;fallbackMist(c,x+w*.375,y+h*.91,w*.25,115,r.time,.15);
}
const vertex=`
attribute vec2 a; uniform vec2 viewport; uniform vec4 rect;
uniform float time, wind; varying vec2 uv;
void main(){uv=a; vec2 p=rect.xy+a*rect.zw;
 gl_Position=vec4(p.x/viewport.x*2.-1.,1.-p.y/viewport.y*2.,0.,1.);}`;
const common=`precision highp float; varying vec2 uv; uniform float time; uniform vec2 viewport;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){return noise(p)*.57+noise(p*2.03+17.)*.28+noise(p*4.07+9.)*.15;}
`;
const sky=common+`
uniform float camera;
void main(){vec2 p=vec2(uv.x*viewport.x,uv.y*720.);
 vec3 col=mix(vec3(.022,.054,.105),vec3(.16,.29,.37),uv.y);
 vec2 moon=vec2(viewport.x*.64-camera*.025,145.);float d=length(p-moon);
 col+=vec3(.22,.30,.33)*exp(-d*.012)+vec3(.48,.60,.62)*(1.-smoothstep(27.,29.,d))*(.76+.24*fbm(p*.12));
 vec2 starCell=floor((p+vec2(camera*.035,0.))/9.);float star=step(.996,hash(starCell));
 star*=pow(max(0.,1.-length(fract((p+vec2(camera*.035,0.))/9.)-.5)*2.),9.);
 col+=star*(1.-smoothstep(.1,.5,uv.y))*.5;
 vec2 q=vec2((p.x+camera*.06-time*9.)/340.,p.y/125.);
 float n=fbm(q),n2=fbm(q*.72+vec2(9.+time*.009,1.3));
 float mass=smoothstep(.43,.72,n*.72+n2*.28)*(1.-smoothstep(.55,.83,uv.y));
 float rim=max(0.,fbm(q+vec2(0.,.08))-n)*4.;
 vec3 cloud=mix(vec3(.085,.16,.23),vec3(.34,.46,.53),clamp(n+rim,0.,1.));
 col=mix(col,cloud,mass*.25);gl_FragColor=vec4(col,1.);}`;
const terrain=common+`
uniform sampler2D art; uniform float atmosphere, shade, wind, exposure, saturation, opacity;
void main(){vec2 sampleUV=uv;
float crown=(1.-smoothstep(.34,.49,uv.y))*(1.-smoothstep(.30,.36,uv.x));
sampleUV.x+=wind*crown*sin(time*.7+uv.y*15.)*.0011;
vec4 tex=texture2D(art,sampleUV);if(tex.a<.01)discard;
 vec3 base=mix(vec3(dot(tex.rgb,vec3(.2126,.7152,.0722))),tex.rgb,saturation)*exposure;
 vec3 color=mix(base,vec3(.078,.149,.212),atmosphere);
 float cloudShadow=.94+.06*noise(vec2(uv.x*7.-time*.026,uv.y*2.));
 color*=mix(1.,cloudShadow,shade);gl_FragColor=vec4(color,tex.a*opacity);}`;
const water=common+`
void main(){float y=uv.y;float edge=abs(uv.x-.5);
 float width=.40+.09*y;float boundary=1.-smoothstep(width-.05,width,edge+sin(y*23.-time*2.)*.009);
 float strands=fbm(vec2(uv.x*39.+sin(y*8.-time)*.25,y*3.-time*2.5));
 float wisps=pow(noise(vec2(uv.x*85.,y*8.-time*4.)),3.);
 float foam=pow(max(0.,sin(uv.x*100.+time*2.)),6.)*(1.-smoothstep(0.,.09,y));
 float ribbons=smoothstep(.44,.78,strands);
 vec3 col=mix(vec3(.13,.31,.39),vec3(.66,.84,.89),ribbons*.72+wisps*.25+foam*.25);
 float alpha=boundary*(.08+ribbons*.29+wisps*.12+foam*.14)*(1.-smoothstep(.80,1.,y));
 gl_FragColor=vec4(col,alpha);}`;
const spray=common+`
uniform float opacity;
void main(){vec2 p=(uv-.5)*vec2(2.,3.);float shape=max(0.,1.-dot(p,p));
 float n=fbm(vec2(uv.x*5.-time*.13,uv.y*3.+time*.15));
 gl_FragColor=vec4(.50,.74,.79,shape*shape*n*opacity);}`;

export class GorgeScene{
 constructor(front,art){
  this.canvas=document.createElement('canvas');this.canvas.setAttribute('aria-hidden','true');
  this.canvas.style.cssText='position:absolute;pointer-events:none';front.before(this.canvas);
  const gl=this.gl=this.canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'high-performance'});
  if(!gl){this.canvas.remove();this.ready=false;return;}
  this.art=art;this.ready=false;this.lost=false;
  this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;this.ready=false;});
  this.canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;try{this.initialize();}catch(e){console.warn('Gorge restore failed',e);}});
  try{this.initialize();}catch(e){this.canvas.remove();throw e;}
 }
 initialize(){const gl=this.gl;this.programs={};
  for(const [name,source] of Object.entries({sky,terrain,water,spray})){
   const compile=(type,text)=>{const s=gl.createShader(type);gl.shaderSource(s,text);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
   const v=compile(gl.VERTEX_SHADER,vertex),f=compile(gl.FRAGMENT_SHADER,source),p=gl.createProgram();gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);
   if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
   this.programs[name]={p,a:gl.getAttribLocation(p,'a'),u:Object.fromEntries(['viewport','rect','time','wind','camera','art','atmosphere','shade','exposure','saturation','opacity'].map(n=>[n,gl.getUniformLocation(p,n)]))};
  }
  this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,0,1,1,0,1,1]),gl.STATIC_DRAW);
  this.textures={};for(const key of ['gorgeHorizon','gorgeRidge','gorgeClouds']){const tx=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tx);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.art[key]);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);this.textures[key]=tx;}
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);this.ready=true;
 }
 resize(front,ratio){this.canvas.width=Math.round(front.clientWidth*ratio);this.canvas.height=Math.round(front.clientHeight*ratio);Object.assign(this.canvas.style,{left:front.offsetLeft+'px',top:front.offsetTop+'px',width:front.clientWidth+'px',height:front.clientHeight+'px'});}
 pass(name,rect,r,options={}){const gl=this.gl,{p,a,u}=this.programs[name];gl.useProgram(p);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);gl.uniform2f(u.viewport,r.w,720);gl.uniform4fv(u.rect,rect);gl.uniform1f(u.time,r.time);gl.uniform1f(u.wind,options.wind||0);gl.uniform1f(u.camera,r.camera);gl.uniform1f(u.atmosphere,options.atmosphere||0);gl.uniform1f(u.shade,options.shade||0);gl.uniform1f(u.exposure,options.exposure??1);gl.uniform1f(u.saturation,options.saturation??1);gl.uniform1f(u.opacity,options.opacity??1);
  if(options.texture){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.textures[options.texture]);gl.uniform1i(u.art,0);}gl.drawArrays(gl.TRIANGLES,0,6);
 }
 draw(r){if(!this.ready)return false;const gl=this.gl;gl.viewport(0,0,this.canvas.width,this.canvas.height);
  const {horizon,ridge}=gorgeLayout(r.w,r.camera);
  this.pass('sky',[0,0,r.w,720],r);
  const cloudX=((r.time*6-r.camera*.06)%2100+2100)%2100-600;
  for(const x of [cloudX-2100,cloudX,cloudX+2100])if(x<r.w&&x+1800>0)this.pass('terrain',[x,-125,1800,470],r,{texture:'gorgeClouds',...gorgeAppearance('clouds')});
  this.pass('terrain',horizon,r,{texture:'gorgeHorizon',...gorgeAppearance('horizon')});
  this.pass('spray',[-100,260,r.w+200,230],r,{opacity:.40});
  this.pass('terrain',ridge,r,{texture:'gorgeRidge',...gorgeAppearance('ridge'),shade:1,wind:r.gentle?.2:1});
  // Registered to river lip in v2 artwork (u .423–.554, v .587).
  const [x,y,w,h]=ridge;this.pass('water',gorgeWaterRect(ridge),r);
  this.pass('spray',[x+w*.375,y+h*.91,w*.25,115],r,{opacity:r.quality==='low'?.22:.30});
  return true;
 }
}
