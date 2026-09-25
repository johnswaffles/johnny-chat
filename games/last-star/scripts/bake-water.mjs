import {FALLS,WATER_FRAMES} from '../src/waterfalls.js';
import {deflateSync} from 'node:zlib';
import {writeFileSync} from 'node:fs';
const crc=b=>{let c=0xffffffff;for(const v of b){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
function chunk(type,data){const t=Buffer.from(type),len=Buffer.alloc(4),check=Buffer.alloc(4);len.writeUInt32BE(data.length);check.writeUInt32BE(crc(Buffer.concat([t,data])));return Buffer.concat([len,t,data,check]);}
function png(width,height,data){const ih=Buffer.alloc(13);ih.writeUInt32BE(width);ih.writeUInt32BE(height,4);ih[8]=8;ih[9]=6;const raw=Buffer.alloc((width*4+1)*height);for(let y=0;y<height;y++)Buffer.from(data.buffer,y*width*4,width*4).copy(raw,y*(width*4+1)+1);return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
const bw=2370;
FALLS.forEach(([xx,top,bottom,ww,drift],id)=>{
 const w=ww*bw,h=Math.ceil((bottom-top)*790),dx=drift*bw;
 const left=Math.floor(Math.min(-w*.6,dx-w*.6))-2,width=Math.ceil(Math.abs(dx)+w*1.2)+4;
 for(let frame=0;frame<WATER_FRAMES;frame++){
 const data=new Uint8ClampedArray(width*h*4);
   for(let y=0;y<h;y++)for(let x=0;x<width;x++){
    const q=y/h,across=(x+left-dx*q)/(w*(.38+.16*q));
    const edge=Math.max(0,Math.min(1,(1-Math.abs(across))*5));
    const fade=Math.min(1,y/9,(h-1-y)/14);
    if(edge*fade<=0)continue;
    // Periodic bands translate DOWN four pixels per frame, wrapping seamlessly.
    const phase=(y-frame*4)/64*Math.PI*2;
    const ripple=Math.sin(phase+Math.sin(across*7+id)*.65);
    const fine=Math.sin(phase*3+across*12+id)*.12;
    const light=Math.max(0,Math.min(1,.5+ripple*.4+fine));
    const strand=.8+.2*Math.sin(across*25+id);
    const i=(y*width+x)*4;
    data[i]=65+light*155;data[i+1]=127+light*117;data[i+2]=158+light*96;
    data[i+3]=255*edge*fade*(.35+light*.35)*strand;
   }
writeFileSync(new URL(`../assets/water/${id}-${frame}.png`,import.meta.url),png(width,h,data));
 }
});
