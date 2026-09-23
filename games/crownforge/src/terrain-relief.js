import {landscapeNoise as noise,clamp01} from './landscape-layout.js?v=20260923-livingearth1';
const smooth=(a,b,x)=>{const t=clamp01((x-a)/(b-a));return t*t*(3-2*t);};
export function washDistance(x,z,seed=42){return Math.abs(z-(112+x*.13+18*Math.sin(x/43)+(noise(x/35,0,seed+81)-.5)*12));}
// World-space macro landforms. Independent of camera, time and the match RNG.
export function terrainHeight(x,z,seed=42){
 const wx=x+(noise(x/110,z/110,seed+711)-.5)*55;
 const wz=z+(noise(x/95+7,z/95,seed+827)-.5)*55;
 const rolling=noise(wx/78,wz/78,seed+183)*24+noise(wx/34,wz/34,seed+571)*7;
 // A long, broken spine rather than a carpet of equally sized bumps.
 const spine=22*Math.exp(-(((wz-135-Math.sin(wx/65)*27)/28)**2))*( .45+noise(wx/90,wz/90,seed+38)*.55);
 const gully=2.4*Math.exp(-((washDistance(x,z,seed)/4)**2));
 return rolling+spine-gully+noise(wx/12,wz/12,seed+95)*.65;
}
export function terrainMaterials(x,z,height,slope,seed=42){
 const coarse=noise(x/28,z/28,seed+317),edge=noise(x/7,z/7,seed+719),grain=noise(x/2.2,z/2.2,seed+31);
 const broken=coarse*.73+edge*.22+grain*.05;
 const wash=(1-smooth(1.4,5.5+edge*2,washDistance(x,z,seed)))*smooth(18,42,x)*(1-smooth(245,290,x));
 const earth=Math.max(smooth(.49,.69,broken)*(.28+smooth(.13,.42,slope)*.72),wash*.78);
 const wet=(1-smooth(8,13,height))*smooth(.32,.64,noise(x/52,z/52,seed+84));
 const gold=smooth(17,25,height)*(.3+coarse*.7);
 return {earth,wet,gold,wash};
}
export function bakeTerrainRelief(width,height,seed){
 const stride=width+2,heights=new Float32Array((width+2)*(height+2));
 for(let z=-1;z<=height;z++)for(let x=-1;x<=width;x++)heights[(z+1)*stride+x+1]=terrainHeight(x,z,seed);
 const color=new Uint8ClampedArray(width*height*4),shade=new Uint8ClampedArray(color.length),earth=new Uint8ClampedArray(color.length);
 for(let z=0;z<height;z++)for(let x=0;x<width;x++){
  const i=(z*width+x)*4,j=(z+1)*stride+x+1,h=heights[j],dx=(heights[j+1]-heights[j-1])*.5,dz=(heights[j+stride]-heights[j-stride])*.5;
  const slope=Math.hypot(dx,dz),m=terrainMaterials(x,z,h,slope,seed);
  // Broad color remains translucent: the approved painted grass supplies all fine detail.
  const dry=m.earth,wet=m.wet,gold=m.gold;
  color[i]=108+gold*32+dry*60-wet*52;color[i+1]=125+gold*10-dry*12-wet*33;color[i+2]=65+dry*26+wet*6;color[i+3]=30+gold*42+wet*108+dry*80;
  if(m.wash>.1){const pebble=noise(x/.6,z/.6,seed+99);color[i]+=m.wash*(20+pebble*25);color[i+1]+=m.wash*(12+pebble*16);color[i+2]+=m.wash*(12+pebble*13);}
  earth[i]=earth[i+1]=earth[i+2]=255;earth[i+3]=dry*220;
  const facing=(-dx*.8-dz*.6)*1.3;
  const bright=facing>0;shade[i]=bright?255:20;shade[i+1]=bright?234:43;shade[i+2]=bright?167:39;
  shade[i+3]=Math.min(bright?100:150,Math.abs(facing)*(bright?110:170));
 }
 return {width,height,color,shade,earth};
}
export function terrainCanvas(width,height,pixels){const c=document.createElement('canvas');c.width=width;c.height=height;const g=c.getContext('2d'),image=g.createImageData(width,height);image.data.set(pixels);g.putImageData(image,0,0);return c;}
