import {drawRestoration} from './astral-vfx.js?release=20261026-luminous-world';
import {drawElementalEffect,drawBurningEnemy} from './elemental-vfx.js?release=20261026-luminous-world';
import {drawGroundPickup,drawGroundChest} from './pickup-art.js?release=20261026-celestial-treasures';
const TAU=Math.PI*2;
export function drawLevel1(r,g,dt){
 const c=r.ctx;
 for(const d of g.chests||[])drawGroundChest(r,d);
 // A newly released reward occupies the chest's position; keep it in front of the open lid.
 for(const d of g.loot||[])drawGroundPickup(r,d);
 for(const e of g.enemies){if(e.dead)continue;const x=e.x-r.camera,y=e.y-55;if(e.role==='brute')r.star(x,y-65,4,'#efbe7c');if(e.freeze>0){r.glow(x,y,100,'blue',.5);c.save();c.strokeStyle='#b7f9ff';c.fillStyle='#80d9ec30';c.lineWidth=2;c.beginPath();c.moveTo(x-30,e.y);c.lineTo(x-40,y-12);c.lineTo(x-9,y-57);c.lineTo(x+25,y-48);c.lineTo(x+38,y+5);c.lineTo(x+26,e.y);c.closePath();c.fill();c.stroke();c.restore();}drawBurningEnemy(r,e);if(e.slow>0){c.strokeStyle='#a1e9ff';c.beginPath();c.ellipse(x,e.y-3,32,7,0,0,TAU);c.stroke();}}
 for(const f of r.elementFX||[]){f.life-=dt;const q=Math.max(0,f.life/f.max);if(q<=0)continue;if(f.kind==='heal'){drawRestoration(r,f,q);continue;}if(drawElementalEffect(r,f,q))continue;const x=f.x-r.camera;c.save();c.globalAlpha=q;c.strokeStyle=f.kind==='heal'?'#a6ffd5':'#ffbd70';c.lineWidth=2;c.beginPath();c.arc(x,f.y,10+(1-q)*55,0,TAU);c.stroke();c.restore();}r.elementFX=(r.elementFX||[]).filter(f=>f.life>0);
}
export function elementEvent(r,e){
 const add=(kind,life=.5)=>{r.elementFX??=[];r.elementFX.push({...e,kind,life,max:life,seed:r.time});if(r.elementFX.length>32)r.elementFX.shift();};
 if(e.type==='special-cast'&&['ember','frost','chain'].includes(e.kind)){add('cast',.32);r.elementFX.at(-1).element=e.kind;}
 if(e.type==='chain-arc'){add('chain',.55);r.elementFX.at(-1).x=e.from.x;r.elementFX.at(-1).y=e.from.y;}
 if(e.type==='burn-tick'){add('burn-pulse',.25);r.burst(e.x,e.y,'gold',r.gentle?3:7,45);}
 if(e.type==='ember-impact'){add('ember-blast',.65);if(!r.gentle)r.shake=Math.max(r.shake,.12);}
 if(['freeze','shatter','heal','chest','treasure'].includes(e.type)){add(e.type,.55);r.burst(e.x,e.y,e.type==='heal'?'teal':['shatter','freeze'].includes(e.type)?'blue':'gold',e.type==='shatter'?20:8,90);}
}
