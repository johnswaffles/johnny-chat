// Original vector illustrations, made for this studio. No remote art dependency.
const palettes = [
  ['#f4e4c8','#e8bb83','#dc795b','#a44943','#583f4b','#294f54','#477c77','#8eaaa0','#c7d2b2','#f7d388','#fff2d4','#263b48'],
  ['#efe5d6','#c9d8d2','#7da7a0','#356f79','#234650','#c79183','#e2b399','#e9cd9e','#99aa79','#5e795c','#f2e3bb','#364c42'],
  ['#f7e6ce','#edb3a4','#c87175','#895168','#394e65','#528a95','#a3bfc0','#e7c17c','#cb904f','#7e9c83','#d4dcb5','#3f6d63']
];
const path=(d,c)=>`<path d="${d}" fill="${c}"/>`;
const ellipse=(x,y,rx,ry,c,rot=0)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" transform="rotate(${rot} ${x} ${y})"/>`;
const circle=(x,y,r,c)=>ellipse(x,y,r,r,c);
const rect=(x,y,w,h,c)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
function flower(x,y,r,p,n=8){let s='';for(let k=0;k<n;k++){const a=k*360/n;s+=ellipse(x,y-r*.65,r*.29,r*.66,p[k%2?1:2],a);}return `<g transform="translate(${x} ${y})">${Array.from({length:n},(_,k)=>ellipse(0,-r*.65,r*.29,r*.66,p[k%2?1:2],k*360/n)).join('')}${circle(0,0,r*.31,p[7])}${circle(0,0,r*.12,p[4])}</g>`;}
function leaf(x,y,s,a,p){return `<g transform="translate(${x} ${y}) rotate(${a})">${path(`M0 0Q${-s} ${-s*.25} 0 ${-s*1.6}Q${s} ${-s*.25} 0 0`,p[6])}${path(`M0 0V${-s*1.6}Q${s} ${-s*.25} 0 0`,p[9])}</g>`;}
function mountains(p,seed){let s=rect(0,0,600,600,p[0])+circle(430,135,65,p[7]);
  s+=path('M0 300 130 125 265 320 395 80 600 310V600H0Z',p[7]);
  s+=path('M130 125 265 320 195 285 163 215 145 234 114 189 80 198Z',p[10]);
  s+=path('M395 80 600 310 458 250 415 162 389 184 369 147 312 203Z',p[10]);
  s+=path('M0 350 165 232 315 340 465 212 600 332V600H0Z',p[6]);
  s+=path('M165 232 315 340 218 323 201 280 182 293Z',p[8]);
  s+=path('M0 420Q150 310 300 410T600 390V600H0Z',p[5]);
  s+=path('M0 450Q150 400 300 450T600 440V600H0Z',p[6]);
  s+=path('M295 407Q520 460 299 490T330 600H150Q85 520 290 480T295 407Z',p[1]);
  s+=path('M295 407Q450 455 250 490T240 600H150Q85 520 290 480T295 407Z',p[8]);
  for(let k=0;k<19;k++){const x=(k*137+seed*31)%640-20,y=335+(k*29)%210,h=44+(k*19)%85;s+=rect(x-3,y,6,h,p[11])+path(`M${x} ${y-h*.6}l${-h*.35} ${h*.9}h${h*.7}Z`,p[k%2?5:11])+path(`M${x} ${y-h*.9}l${-h*.25} ${h*.7}h${h*.5}Z`,p[5]);}
  for(let k=0;k<11;k++)s+=flower((k*91)%600,530+(k*13)%70,10+(k%3)*3,p,6);
  return s;
}
function garden(p,seed){let s=rect(0,0,600,600,p[0]);s+=circle(300,280,230,p[10]);
  for(let k=0;k<14;k++){let x=30+(k*137+seed*9)%550,y=260+(k*31)%300; s+=path(`M300 640Q${x} ${y+70} ${x} ${y-90}`,p[9]);for(let j=0;j<3;j++)s+=leaf(x+(j%2?20:-10),y-j*34,25+j*5,j%2?65:-50,p);}
  for(let k=0;k<13;k++){let x=55+(k*157+seed*13)%500,y=80+(k*89)%445;s+=flower(x,y,23+(k*7)%35,p,8+(k%2)*4);}
  for(let k=0;k<18;k++)s+=circle((k*139)%600,(k*97)%600,3+k%4,p[7]);return s;
}
function coast(p,seed){let s=rect(0,0,600,600,p[0])+circle(420,120,62,p[7]);
  s+=path('M0 270Q160 200 330 280T600 250V600H0Z',p[6]);
  for(let k=0;k<8;k++)s+=path(`M0 ${300+k*38}Q140 ${270+k*38} 300 ${310+k*38}T600 ${290+k*38}v19Q430 ${342+k*38} 280 ${328+k*38}T0 ${320+k*38}Z`,p[[5,8,6,1][k%4]]);
  s+=path('M0 350Q155 270 220 400T430 600H0Z',p[1])+path('M0 420Q130 340 160 470T280 600H0Z',p[8]);
  s+=rect(100,210,62,180,p[10])+path('M105 210 116 140H147L158 210Z',p[2])+rect(111,125,40,28,p[4])+path('M105 125 131 99 157 125Z',p[2])+rect(123,149,16,25,p[7])+rect(121,268,19,38,p[4])+path('M87 214H177L166 228H98Z',p[2]);
  for(let k=0;k<8;k++)s+=leaf(20+k*24,570-(k*17)%80,28,((k+seed)%3)*25-20,p);
  s+=path('M380 360h95l-20 27h-52Z',p[4])+path('M428 270v85h-55Z',p[10])+path('M435 296v59h38Z',p[2]);return s;
}
function cat(p,seed){let s=rect(0,0,600,600,p[0])+rect(75,45,450,430,p[4])+rect(91,61,418,397,p[6])+circle(393,158,58,p[7]);
  for(let k=0;k<6;k++)s+=path(`M92 ${255+k*37}Q220 ${185+k*40} 510 ${270+k*29}V460H92Z`,p[[8,9,5,6,9,5][k]]);
  s+=rect(293,60,14,400,p[0])+rect(90,247,420,14,p[0])+rect(58,459,485,24,p[1])+rect(0,483,600,117,p[1]);
  s+=ellipse(310,450,110,110,p[2])+path('M222 338 216 226 282 271Q320 251 358 274L416 226 401 345Z',p[2])+path('M232 272 237 244 269 278Z',p[3])+path('M365 279 395 246 388 291Z',p[3]);
  s+=ellipse(301,353,65,55,p[1])+ellipse(276,320,14,20,p[4])+ellipse(354,320,14,20,p[4])+circle(280,315,4,p[10])+circle(358,315,4,p[10])+path('M300 348h22l-11 12Z',p[4])+ellipse(310,440,51,64,p[1]);
  for(let k=0;k<5;k++)s+=path(`M${238+k*31} 382q12 35 23 0l-10 52Z`,p[3]);
  s+=path('M383 469Q500 392 494 490T372 547L356 516Q464 535 463 483T383 490Z',p[3]);
  s+=rect(65,425,62,67,p[3]);for(let k=0;k<7;k++)s+=leaf(96,437,40,k*21-60,p);return s;
}
function mandala(p,seed){let s=rect(0,0,600,600,p[0]);for(let ring=5;ring>=1;ring--){const n=ring%2?12:16,r=ring*44;for(let k=0;k<n;k++){s+=`<g transform="translate(300 300) rotate(${k*360/n+seed*7})">${path(`M0 ${-r-43}Q70 ${-r} 0 ${-r+57}Q-70 ${-r} 0 ${-r-43}Z`,p[(ring+k%2+2)%12])}${ellipse(0,-r,10,24,p[(ring+6)%12])}</g>`;}}return s+circle(300,300,30,p[7])+flower(300,300,23,p,12);}
function butterfly(p,seed){let s=rect(0,0,600,600,p[0]);for(let k=0;k<10;k++)s+=leaf((k*173)%600,600-(k*97)%400,70,k*27,p);
  for(let side of [-1,1]){s+=`<g transform="translate(300 270) scale(${side} 1)">${path('M0 0Q-80-240-213-125Q-270-25-23 55Q-244-10-166 148Q-68 237 0 47Z',p[2])}${path('M-20 4Q-75-174-177-117Q-221-49-20 32Z',p[7])}${path('M-21 57Q-152 34-139 123Q-82 185-13 70Z',p[6])}${path('M-45 12-168-104-107 4Z',p[3])}${path('M-30 60-133 117-61 108Z',p[5])}${Array.from({length:9},(_,k)=>circle(-52-k*16,-45-Math.sin(k*.3)*88,7,p[10])).join('')}</g>`;}
  s+=ellipse(300,280,13,80,p[4])+circle(300,199,16,p[4])+path('M295 199Q270 150 252 177L260 182Q277 160 298 204Z',p[4])+path('M305 199Q330 150 348 177L340 182Q323 160 302 204Z',p[4]);return s;
}
const types={mountains,garden,coast,cat,mandala,butterfly};
export const catalog=[
  ['alpine','The long way home','Landscapes','mountains',0,'A quiet alpine valley'],
  ['wildflowers','Wildflower afternoon','Botanical','garden',0,'A colorful wildflower garden'],
  ['coastal','Somewhere by the sea','Landscapes','coast',1,'A lighthouse overlooking the ocean'],
  ['windowsill','The window seat','Animals','cat',2,'A cat watching the sunset'],
  ['wings','Wings of wonder','Animals','butterfly',0,'An ornate butterfly in a garden'],
  ['bloom','A moment to bloom','Patterns','mandala',2,'An intricate floral mandala'],
  ['blue-ridge','Beyond the blue','Landscapes','mountains',1,'Blue mountain peaks and forest'],
  ['terracotta','Terracotta garden','Botanical','garden',2,'Warm flowers and leafy stems'],
  ['sea-glass','Sea glass morning','Landscapes','coast',0,'A sunlit sailboat and coastal lighthouse'],
  ['sage-cat','A very quiet day','Animals','cat',1,'A contented cat by a green window'],
  ['moon-petals','Moonlit petals','Patterns','mandala',1,'Layered petals in cool colors'],
  ['paper-wings','Paper wings','Animals','butterfly',2,'A pink and blue butterfly'],
  ['golden-hour','Golden hour hills','Landscapes','mountains',2,'Golden sunset over rolling hills'],
  ['herbarium','Little herbarium','Botanical','garden',1,'A collection of flowers in sage and rose'],
  ['sunwheel','The sun collector','Patterns','mandala',0,'A warm geometric sun mandala'],
  ['rose-harbor','Rosewater harbor','Landscapes','coast',2,'A peaceful pink coastal scene'],
].map(([id,title,category,type,p,description],i)=>({id,title,category,type,p,description,seed:i,difficulty:i%3===0?'Relaxed':i%3===1?'Detailed':'Balanced'}));
catalog.unshift({id:'alpine-retreat-v2',title:'An alpine retreat',category:'Landscapes',description:'A warm timber chalet, flower-lined path and wooden bridge beside an alpine stream',difficulty:'Intricate',source:'./art/alpine-retreat-v2.png',colors:32,resolution:600,minArea:22});
catalog.splice(1,0,{id:'fox-stream',title:'Fox beside the golden stream',category:'Animals',description:'A resting red fox among wildflowers beside a wooden bridge and mountain stream',difficulty:'Intricate',source:'./art/fox-stream.png',colors:32,resolution:540,minArea:16});
export function artwork(item){const p=palettes[item.p];return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">${types[item.type](p,item.seed)}</svg>`;}
export const artURL=item=>item.source||'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(artwork(item));
