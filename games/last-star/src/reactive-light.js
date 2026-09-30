// Bounded screen-space lights: light only the character and nearby supported edges.
export function spellLights(game){return game.projectiles.filter(b=>b.owner==='player'&&b.life>0).slice(-8).map(b=>({x:b.x,y:b.y,color:b.kind==='ember'?'gold':b.kind==='chain'?'violet':'blue',radius:b.kind==='ember'?150:115}));}
export function drawReactiveLight(r,g){
 if(r.previewLighting===false)return;
 const c=r.ctx,lights=spellLights(g);c.save();c.globalCompositeOperation='screen';
 for(const l of lights){const x=l.x-r.camera;if(x< -160||x>r.w+160)continue;
  r.glow(x,l.y,l.radius*2,l.color,r.gentle?.1:.16);
  // Illumination hugs the top of real platforms; never draws a false floor across pits.
  for(const f of g.platforms){const dy=Math.abs(f.y-l.y);if(dy>140)continue;const a=Math.max(f.x,l.x-130),b=Math.min(f.x+f.w,l.x+130);if(a>=b)continue;
   const strength=(1-dy/140)*.65;c.globalAlpha=strength;const edge=c.createLinearGradient(a-r.camera,0,b-r.camera,0);edge.addColorStop(0,'#9be6ff00');edge.addColorStop(.5,l.color==='gold'?'#ffd59a':'#9be6ff');edge.addColorStop(1,'#9be6ff00');c.strokeStyle=edge;c.lineWidth=3;c.beginPath();c.moveTo(a-r.camera,f.y+1);c.lineTo(b-r.camera,f.y+1);c.stroke();r.glow(x,f.y,160,l.color,strength*.35);
  }
  const p=g.player,d=Math.hypot(p.x-l.x,p.y-65-l.y);if(d<160)r.glow(p.x-r.camera,p.y-65,100,l.color,(1-d/160)*.45);
 }
 for(const f of r.lightPulses||[]){const q=Math.max(0,1-(r.time-f.born)/f.duration);if(q>0)r.glow(f.x-r.camera,f.y,210*(1.2-q*.2),f.color,q*(r.reducedFlash||r.gentle?.15:.55));}
 r.lightPulses=(r.lightPulses||[]).filter(f=>r.time-f.born<f.duration);c.restore();
}
export function lightEvent(r,e){if(!['cast','hit','ember-impact','encounter-clear','chain-arc'].includes(e.type))return;r.lightPulses??=[];r.lightPulses.push({x:e.x??e.to?.x,y:e.y??e.to?.y,born:r.time,duration:e.type==='encounter-clear'?1.6:.32,color:e.element==='fire'||e.type==='ember-impact'||e.type==='encounter-clear'?'gold':e.type==='chain-arc'?'violet':'blue'});if(r.lightPulses.length>12)r.lightPulses.shift();}

// Small tinted sprite caches are made once. Never change full-world compositing to source-atop.
export function prepareWizardLighting(images){const cache=new Map();for(const [key,art] of Object.entries(images)){if(!key.startsWith('wizard'))continue;const colors={};for(const [name,color] of Object.entries({blue:'#8edbff',gold:'#ffcc88'})){const canvas=document.createElement('canvas');canvas.width=Math.ceil(art.width/2);canvas.height=Math.ceil(art.height/2);const c=canvas.getContext('2d');c.drawImage(art,0,0,canvas.width,canvas.height);c.globalCompositeOperation='source-in';c.fillStyle=color;c.fillRect(0,0,canvas.width,canvas.height);colors[name]=canvas;}cache.set(art,colors);}return cache;}
export function wizardLight(r,p){let best=null,strength=0;for(const l of r.worldLights||[]){const q=Math.max(0,1-Math.hypot(p.x-l.x,p.y-65-l.y)/180);if(q>strength){strength=q;best=l;}}return best?{strength:strength*(r.gentle?.22:.42),color:best.color==='gold'?'gold':'blue'}:null;}
