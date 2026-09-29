// Small, supported plants. Artwork stays opaque; only stems bend around roots.
const random=n=>{const v=Math.sin(n*127.1+43.7)*43758.5453;return v-Math.floor(v);};
const CUTS=[[48,128,434,348],[566,77,430,406],[1092,72,386,404],[36,547,453,418],[528,540,494,423],[1096,551,413,414]];
export function prepareFlora(image){return CUTS.map(([x,y,w,h])=>{const c=document.createElement('canvas');c.width=Math.round(w/h*128);c.height=128;const ctx=c.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(image,x,y,w,h,0,0,c.width,128);return c;});}
export function floraForPlatform(p){
 const plants=[];if(p.x>=2600)return plants;
 for(let i=0;i<Math.floor((p.w-30)/23);i++){
  const seed=p.id*193+i*7,x=p.x+20+i*23+random(seed)*9;
  const kind=random(seed+1)>.78?4:random(seed+2)>.6?1:0;
  const height=(kind===4?26:17)+random(seed+3)*12;
  plants.push({x,y:p.y+2,kind,height,width:height*CUTS[kind][2]/CUTS[kind][3],seed});
 }
 for(let i=0;i<Math.floor((p.w-40)/105);i++){
  const seed=p.id*193+i*31+701,kind=[2,3,5][Math.floor(random(seed)*3)],height=26+random(seed+3)*12;
  plants.push({x:p.x+35+i*105+random(seed+1)*30,y:p.y+2,kind,height,width:height*CUTS[kind][2]/CUTS[kind][3],seed});
 }
 return plants.filter(v=>v.x-v.width/2>=p.x+2&&v.x+v.width/2<=p.x+p.w-2);
}
export function plantBend(plant,time,player,gentle=false){
 const wind=(Math.sin(time*.7+plant.x*.006)*1.5+Math.sin(time*1.4+plant.seed)*.5)*(gentle?.3:1);
 const near=Math.max(0,1-Math.abs(player.x-plant.x)/55);
 const contact=player.onGround&&Math.abs(player.y-(plant.y-2))<8?near*Math.max(-1,Math.min(1,(player.vx||0)/190)):0;
 return wind+contact*(gentle?2:7);
}
export function drawGorgeFlora(r,game,p){
 if(!r.floraLayout)r.floraLayout=new Map();
 if(!r.floraLayout.has(p.id))r.floraLayout.set(p.id,floraForPlatform(p));
 const c=r.ctx;
 for(const plant of r.floraLayout.get(p.id)){
  const x=plant.x-r.camera;if(x< -50||x>r.w+50)continue;
  const target=plantBend(plant,r.time,game.player,r.gentle);
  const dt=Math.max(0,Math.min(.05,r.time-(plant.lastTime??r.time)));plant.lastTime=r.time;
  plant.bend=plant.bend===undefined?target:plant.bend+(target-plant.bend)*(1-Math.exp(-dt*10));
  c.save();c.translate(x,plant.y);c.transform(1,0,-plant.bend/plant.height,1,0,0);
  c.drawImage(r.art.floraSprites[plant.kind],-plant.width/2,-plant.height,plant.width,plant.height);c.restore();
  // Tiny dew points sit on occasional grass tips, not broad glow blobs.
  if(plant.kind===1&&plant.seed%3===0){c.fillStyle='#d0e8d9';c.globalAlpha=.25+.25*Math.sin(r.time*.8+plant.seed)**2;c.fillRect(x+plant.bend,plant.y-plant.height*.9,1,1);c.globalAlpha=1;}
 }
}
