import {grantItem} from './inventory.js?release=20260930-chain-tempest';
import {collectCrystal} from './arcade.js?release=20260930-chain-tempest';
export const INTRO_LOOT=[
 {x:420,kind:'gold',count:1},{x:960,kind:'ember',count:3},{x:1280,kind:'flask',count:1},
 {x:1790,kind:'power',count:6},{x:2120,kind:'frost',count:3},{x:2800,kind:'chain',count:3},
 {x:3550,kind:'power',count:6},{x:3950,kind:'flask',count:1},{x:4330,kind:'ember',count:2},
 {x:5180,kind:'frost',count:2},{x:5900,kind:'chain',count:2},{x:6600,kind:'flask',count:2},
 {x:6730,kind:'ember',count:2},{x:6790,kind:'frost',count:2},{x:6840,kind:'chain',count:2},
]; // All ordinary loot is supported by existing ground.
export const CHESTS=[{x:690,kind:'gem'},{x:2350,kind:'flask'},{x:4640,kind:'chain'},{x:6150,kind:'power'}];
export function breakChest(game,chest){if(chest.open)return;chest.open=true;game.loot.push(placeLoot(game,{x:chest.x,kind:chest.kind,count:chest.kind==='power'?3:1}));game.event('chest',{x:chest.x,y:chest.y-20});}

export function placeLoot(game,spec){const floor=game.platforms.filter(f=>!f.upper&&spec.x>=f.x+20&&spec.x<=f.x+f.w-20)[0];if(!floor)throw Error(`Unsupported pickup ${spec.x}`);return {...spec,y:floor.y-28,floor:floor.y-22,vy:-70,age:0,taken:false};}
export function updateLoot(game,dt){for(const d of game.loot){if(d.taken)continue;d.age+=dt;d.vy+=500*dt;d.y=Math.min(d.floor,d.y+d.vy*dt);if(d.y===d.floor)d.vy=0;const p=game.player,dx=p.x-d.x,dy=p.y-45-d.y,dist=Math.hypot(dx,dy);if(dist<95){const k=Math.min(1,dt*9);d.x+=dx*k;d.y+=dy*k;}if(Math.hypot(p.x-d.x,p.y-45-d.y)<24){d.taken=true;if(['gold','gem'].includes(d.kind)){const value=d.kind==='gold'?50:150;game.arcade.score+=value;game.event('treasure',{kind:d.kind,x:d.x,y:d.y,text:`+${value}`});}else if(d.kind==='power'){for(let i=0;i<d.count;i++)collectCrystal(game,d);}else grantItem(game,d.kind,d.count);}}game.loot=game.loot.filter(d=>!d.taken);}
