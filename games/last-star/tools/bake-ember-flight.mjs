// Bake a looping, advected flame volume once. Flight costs one atlas blit per orb.
import {writeFileSync} from 'node:fs';
import {crc32, deflateSync} from 'node:zlib';

const cellWidth = 168, cellHeight = 80, columns = 6, frames = 24;
const width = cellWidth * columns, height = cellHeight * frames / columns;
const rows = Buffer.alloc(height * (1 + width * 4));
const tau = 2 * Math.PI;
const clamp = value => Math.min(1, Math.max(0, value));
const smooth = value => { const q = clamp(value); return q*q*(3-2*q); };
const stops = [[43,17,27], [129,32,25], [224,58,13], [255,124,21], [255,198,67], [255,236,154], [255,253,217]];

function flame(x, y, t) {
  // Streamlines shear around a spherical leading face and unravel downwind.
  const back = clamp(-x / 118);
  const flow = x * .079 + t * 2;
  const offset = back * (9*Math.sin(flow*.5 + t) + 4*Math.sin(flow*1.5 - t));
  const v = y - offset;
  const swirl = Math.sin(flow + v*.117 + 1.8*Math.sin(v*.12-t));
  const eddy = Math.sin(x*.167 + v*.23 + t*3 + 1.5*swirl);
  const grain = Math.sin(x*.39 - v*.32 + t*4 + 2.2*eddy);
  const turbulence = swirl*.51 + eddy*.32 + grain*.17;
  const radial = Math.hypot(x*.94, y);
  const shell = 22.5 - radial + 3.6*turbulence;
  const plumeWidth = 21*(1-back)**.68 + 2;
  const wake = Math.min(-x+3, x+116, plumeWidth-Math.abs(v)) + turbulence*(4+9*back) - back*5;
  const edge = Math.max(shell, wake);
  const core = smooth(1-radial/27);
  const angle = Math.atan2(y,x);
  const rolling = Math.sin(radial*.31 - t*3 + 2.8*Math.sin(angle*2 + t + radial*.085) + turbulence*2);
  const tongue = Math.sin(v*.29 + 2.7*swirl + eddy + flow*.5 + t);
  const heat = clamp(.25 + .25*smooth(edge/7) + .25*turbulence + .18*tongue + core*(.18+.22*rolling) - .25*back);
  const band = heat*(stops.length-1), index = Math.min(stops.length-2, Math.floor(band)), f = band-index;
  const alpha = smooth((edge+2)/4);
  const halo = .30*Math.exp(-Math.max(0,-edge)*.29)*(1-back*.7);
  const opacity = alpha + halo*(1-alpha);
  const color = stops[index].map((a,i) => {
    const hot = a+(stops[index+1][i]-a)*f;
    return (hot*alpha + [255,90,17][i]*halo*(1-alpha))/Math.max(.001,opacity);
  });
  return [...color,opacity*255];
}
for(let frame=0;frame<frames;frame++){
  const t = frame*tau/frames;
  for(let y=0;y<cellHeight;y++)for(let x=0;x<cellWidth;x++){
    const rgba=flame(x-130,y-39.5,t);
    const pixel=(y+Math.floor(frame/columns)*cellHeight)*(width*4+1)+1+(x+frame%columns*cellWidth)*4;
    rgba.forEach((v,i)=> rows[pixel+i]=Math.round(v));
  }
}
function chunk(type, data){
  const tag=Buffer.from(type), out=Buffer.alloc(12+data.length);
  out.writeUInt32BE(data.length);tag.copy(out,4);data.copy(out,8);
  out.writeUInt32BE(crc32(Buffer.concat([tag,data])),out.length-4);return out;
}
const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
writeFileSync(new URL('../assets/magic-v3/ember-flight-v1.png', import.meta.url),
  Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows,{level:9})),chunk('IEND',Buffer.alloc(0))]));
