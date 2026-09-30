import {drawElementalEffect,drawBurningEnemy} from './elemental-vfx.js?release=20260930-chain-tempest';
const TAU=Math.PI*2;
export function drawLevel1(r,g,dt){
 const c=r.ctx,t=r.time;
 for(const d of g.loot||[]){const x=d.x-r.camera,y=d.y+Math.sin(t*3+d.x)*3;if(x<-70||x>r.w+70)continue;const col=d.kind==='ember'?'gold':d.kind==='chain'?'violet':'teal';r.glow(x,y,48,col,.48);const art=r.art['item_'+d.kind];if(art)c.drawImage(art,x-23,y-23,46,46);else r.star(x,y,9,'#ffdf9f');}
 for(const d of g.chests||[]){const x=d.x-r.camera;if(x<-80||x>r.w+80)continue;c.save();c.globalAlpha=d.open?.45:1;if(r.art.item_chest)c.drawImage(r.art.item_chest,x-35,d.floor-52,70,70);else{c.fillStyle=d.open?'#302c2b':'#856342';c.fillRect(x-23,d.floor-23,46,25);}if(!d.open)r.star(x,d.floor-29,3,'#ffe3a2');c.restore();}
 for(const e of g.enemies){if(e.dead)continue;const x=e.x-r.camera,y=e.y-55;if(e.windup>0&&e.role!=='ranged'){c.save();c.strokeStyle=e.type==='boss'?'#e9bdff':'#ffd080';c.lineWidth=2;c.setLineDash([4,5]);c.beginPath();c.ellipse(x+e.face*35,e.y-3,e.role==='brute'?86:60,10,0,0,TAU);c.stroke();c.restore();}if(e.role==='brute')r.star(x,y-65,4,'#efbe7c');if(e.freeze>0){r.glow(x,y,100,'blue',.5);c.save();c.strokeStyle='#b7f9ff';c.fillStyle='#80d9ec30';c.lineWidth=2;c.beginPath();c.moveTo(x-30,e.y);c.lineTo(x-40,y-12);c.lineTo(x-9,y-57);c.lineTo(x+25,y-48);c.lineTo(x+38,y+5);c.lineTo(x+26,e.y);c.closePath();c.fill();c.stroke();c.restore();}drawBurningEnemy(r,e);if(e.slow>0){c.strokeStyle='#a1e9ff';c.beginPath();c.ellipse(x,e.y-3,32,7,0,0,TAU);c.stroke();}}
 for(const f of r.elementFX||[]){f.life-=dt;const q=Math.max(0,f.life/f.max);if(q<=0)continue;if(drawElementalEffect(r,f,q))continue;const x=f.x-r.camera;c.save();c.globalAlpha=q;c.strokeStyle=f.kind==='heal'?'#a6ffd5':'#ffbd70';c.lineWidth=2;c.beginPath();c.arc(x,f.y,10+(1-q)*55,0,TAU);c.stroke();c.restore();}r.elementFX=(r.elementFX||[]).filter(f=>f.life>0);
}
export function elementEvent(r,e){
 const add=(kind,life=.5)=>{r.elementFX??=[];r.elementFX.push({...e,kind,life,max:life,seed:r.time});if(r.elementFX.length>32)r.elementFX.shift();};
 if(e.type==='special-cast'&&['ember','frost','chain'].includes(e.kind)){add('cast',.32);r.elementFX.at(-1).element=e.kind;}
 if(e.type==='chain-arc'){add('chain',.55);r.elementFX.at(-1).x=e.from.x;r.elementFX.at(-1).y=e.from.y;}
 if(e.type==='burn-tick'){add('burn-pulse',.25);r.burst(e.x,e.y,'gold',r.gentle?3:7,45);}
 if(e.type==='ember-impact'){add('ember-blast',.65);if(!r.gentle)r.shake=Math.max(r.shake,.12);}
 if(['freeze','shatter','heal','chest','treasure'].includes(e.type)){add(e.type,.55);r.burst(e.x,e.y,e.type==='heal'?'teal':['shatter','freeze'].includes(e.type)?'blue':'gold',e.type==='shatter'?20:8,90);}
}
