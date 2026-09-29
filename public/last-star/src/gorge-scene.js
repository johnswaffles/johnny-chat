// Silverwood environment study: independent GPU layers; no per-frame pixel copies.
// Coordinates are in the same 720-high logical space as the gameplay renderer.
export function gorgeLayout(width,camera){
  return {horizon:[-380-camera*.12,-130,Math.max(1850,width+500),Math.max(1850,width+500)/3],
    ridge:[-150-camera*.42,20,2100,700]};
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
uniform sampler2D art; uniform float atmosphere, shade, wind;
void main(){vec2 sampleUV=uv;
float crown=(1.-smoothstep(.34,.49,uv.y))*(1.-smoothstep(.30,.36,uv.x));
sampleUV.x+=wind*crown*sin(time*.7+uv.y*15.)*.0015;
vec4 tex=texture2D(art,sampleUV);if(tex.a<.01)discard;
 vec3 color=mix(tex.rgb,vec3(.16,.26,.33),atmosphere);
 float cloudShadow=.90+.10*noise(vec2(uv.x*7.-time*.026,uv.y*2.));
 color*=mix(1.,cloudShadow,shade);gl_FragColor=vec4(color,tex.a);}`;
const water=common+`
void main(){float y=uv.y;float edge=abs(uv.x-.5);
 float width=.40+.09*y;float boundary=1.-smoothstep(width-.05,width,edge+sin(y*23.-time*2.)*.009);
 float strands=fbm(vec2(uv.x*39.+sin(y*8.-time)*.25,y*3.-time*2.5));
 float wisps=pow(noise(vec2(uv.x*85.,y*8.-time*4.)),3.);
 float foam=pow(max(0.,sin(uv.x*100.+time*2.)),6.)*(1.-smoothstep(0.,.09,y));
 vec3 col=mix(vec3(.13,.38,.47),vec3(.74,.93,.96),strands*.85+wisps*.6+foam);
 float alpha=boundary*(.60+strands*.30)*(1.-smoothstep(.83,1.,y));
 gl_FragColor=vec4(col,alpha);}`;
const spray=common+`
void main(){vec2 p=(uv-.5)*vec2(2.,3.);float shape=max(0.,1.-dot(p,p));
 float n=fbm(vec2(uv.x*5.-time*.13,uv.y*3.+time*.15));
 gl_FragColor=vec4(.50,.74,.79,shape*shape*n*.35);}`;

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
   this.programs[name]={p,a:gl.getAttribLocation(p,'a'),u:Object.fromEntries(['viewport','rect','time','wind','camera','art','atmosphere','shade'].map(n=>[n,gl.getUniformLocation(p,n)]))};
  }
  this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,0,1,1,0,1,1]),gl.STATIC_DRAW);
  this.textures={};for(const key of ['gorgeHorizon','gorgeRidge','gorgeClouds']){const tx=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tx);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.art[key]);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);this.textures[key]=tx;}
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);this.ready=true;
 }
 resize(front,ratio){this.canvas.width=Math.round(front.clientWidth*ratio);this.canvas.height=Math.round(front.clientHeight*ratio);Object.assign(this.canvas.style,{left:front.offsetLeft+'px',top:front.offsetTop+'px',width:front.clientWidth+'px',height:front.clientHeight+'px'});}
 pass(name,rect,r,options={}){const gl=this.gl,{p,a,u}=this.programs[name];gl.useProgram(p);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);gl.uniform2f(u.viewport,r.w,720);gl.uniform4fv(u.rect,rect);gl.uniform1f(u.time,r.time);gl.uniform1f(u.wind,options.wind||0);gl.uniform1f(u.camera,r.camera);gl.uniform1f(u.atmosphere,options.atmosphere||0);gl.uniform1f(u.shade,options.shade||0);
  if(options.texture){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.textures[options.texture]);gl.uniform1i(u.art,0);}gl.drawArrays(gl.TRIANGLES,0,6);
 }
 draw(r){if(!this.ready)return false;const gl=this.gl;gl.viewport(0,0,this.canvas.width,this.canvas.height);
  const {horizon,ridge}=gorgeLayout(r.w,r.camera);
  this.pass('sky',[0,0,r.w,720],r);
  const cloudX=((r.time*6-r.camera*.06)%2100+2100)%2100-600;
  for(const x of [cloudX-2100,cloudX,cloudX+2100])if(x<r.w&&x+1800>0)this.pass('terrain',[x,-125,1800,470],r,{texture:'gorgeClouds',atmosphere:.1});
  this.pass('terrain',horizon,r,{texture:'gorgeHorizon',atmosphere:.15});
  this.pass('spray',[-150-r.camera*.2,360,r.w+450,260],r);
  this.pass('terrain',ridge,r,{texture:'gorgeRidge',shade:1,wind:r.gentle?.2:1});
  // Registered to river lip in v2 artwork (u .423–.554, v .587).
  const [x,y,w,h]=ridge;this.pass('water',[x+w*.416,y+h*.585,w*.146,h*.47],r);
  this.pass('spray',[x+w*.375,y+h*.91,w*.25,115],r);
  return true;
 }
}
