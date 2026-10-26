// Bounded screen-space lights: light only the character and nearby supported edges.
export function spellLights(game,r){
 const moving=game.projectiles.filter(b=>b.owner==='player'&&b.life>0).slice(-8).map(b=>({x:b.x,y:b.y,color:b.kind==='ember'?'gold':b.kind==='chain'?'violet':'blue',radius:b.kind==='ember'?150:115,strength:1}));
 const impacts=(r?.lightPulses||[]).filter(f=>r.time-f.born<f.duration).slice(-4).map(f=>({...f,radius:145,strength:Math.max(0,1-(r.time-f.born)/f.duration)}));
 return [...moving,...impacts].slice(-8);
}
const lightColor={gold:'#ffd59a',blue:'#9be6ff',violet:'#d5b3ff',teal:'#a2f4cd'};
export function drawReactiveLight(r,g){
 if(r.previewLighting===false)return;
 const c=r.ctx,lights=r.worldLights||spellLights(g,r);c.save();c.globalCompositeOperation='screen';
 for(const l of lights){const x=l.x-r.camera;if(x< -160||x>r.w+160)continue;
  r.glow(x,l.y,l.radius*2,l.color,(r.gentle||r.reducedFlash?.07:.12)*l.strength);
  // Illumination hugs the top of real platforms; never draws a false floor across pits.
  for(const f of g.platforms){const dy=Math.abs(f.y-l.y);if(dy>140)continue;const a=Math.max(f.x,l.x-130),b=Math.min(f.x+f.w,l.x+130);if(a>=b)continue;
   const strength=(1-dy/140)*.65*l.strength*(r.reducedFlash?.6:1),color=lightColor[l.color]||lightColor.blue;c.globalAlpha=strength;const edge=c.createLinearGradient(a-r.camera,0,b-r.camera,0);edge.addColorStop(0,color+'00');edge.addColorStop(.5,color);edge.addColorStop(1,color+'00');c.strokeStyle=edge;c.lineWidth=3;c.beginPath();c.moveTo(a-r.camera,f.y+1);c.lineTo(b-r.camera,f.y+1);c.stroke();
   // A clipped wash colors the actual stone face; the pit remains unlit.
   c.save();c.beginPath();c.rect(a-r.camera,f.y,b-a,24);c.clip();r.glow(x,f.y,160,l.color,strength*.28);c.restore();
  }
  const p=g.player,d=Math.hypot(p.x-l.x,p.y-65-l.y);if(d<160)r.glow(p.x-r.camera,p.y-65,100,l.color,(1-d/160)*l.strength*(r.gentle||r.reducedFlash?.18:.4));
 }
 for(const f of r.lightPulses||[]){const q=Math.max(0,1-(r.time-f.born)/f.duration);if(q>0)r.glow(f.x-r.camera,f.y,210*(1.2-q*.2),f.color,q*(r.reducedFlash||r.gentle?.15:.55));}
 r.lightPulses=(r.lightPulses||[]).filter(f=>r.time-f.born<f.duration);c.restore();
}
export function lightEvent(r,e){
 if(!['cast','hit','ember-impact','encounter-clear','chain-arc','heal','blink','enemy-cast','hostile-impact','danger-hit','seal','mantle'].includes(e.type))return;
 const x=e.x??e.to?.x,y=(e.type==='seal'?e.y-85:e.type==='danger-hit'?e.y-30:e.y)??(e.to?.y-(e.type==='blink'?55:0));if(!Number.isFinite(x)||!Number.isFinite(y))return;
 r.lightPulses??=[];r.lightPulses.push({x,y,born:r.time,duration:e.type==='encounter-clear'?1.6:['heal','blink'].includes(e.type)?.6:.32,color:e.element==='fire'||e.type==='ember-impact'||e.type==='encounter-clear'||e.type==='seal'?'gold':['chain-arc','blink','enemy-cast','hostile-impact','danger-hit'].includes(e.type)?'violet':['heal','mantle'].includes(e.type)?'teal':'blue'});if(r.lightPulses.length>12)r.lightPulses.shift();
}

// Small tinted sprite caches are made once. Never change full-world compositing to source-atop.
export function prepareWizardLighting(images){const cache=new Map();for(const [key,art] of Object.entries(images)){if(!key.startsWith('wizard'))continue;const colors={};for(const [name,color] of Object.entries({blue:'#8edbff',gold:'#ffcc88',violet:'#c5a4ff',teal:'#92efc4'})){const canvas=document.createElement('canvas');canvas.width=Math.ceil(art.width/2);canvas.height=Math.ceil(art.height/2);const c=canvas.getContext('2d');c.drawImage(art,0,0,canvas.width,canvas.height);c.globalCompositeOperation='source-in';c.fillStyle=color;c.fillRect(0,0,canvas.width,canvas.height);colors[name]=canvas;}cache.set(art,colors);}return cache;}
export function wizardLight(r,p){let best=null,strength=0;for(const l of r.worldLights||[]){const q=Math.max(0,1-Math.hypot(p.x-l.x,p.y-65-l.y)/180)*(l.strength??1);if(q>strength){strength=q;best=l;}}return best?{strength:strength*(r.gentle||r.reducedFlash?.22:.42),color:best.color}:null;}
