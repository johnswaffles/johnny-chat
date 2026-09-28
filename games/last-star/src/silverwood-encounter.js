// One authored encounter on the existing Silverwood platform. No arena walls.
import {placeLoot} from './loot.js?release=20260928-polish-preview';
export function newSilverwoodEncounter(checkpoint){return {state:checkpoint>1?'cleared':'waiting',time:0,rewarded:checkpoint>1};}
export function updateSilverwoodEncounter(g,dt){
 const a=g.silverwood;if(a.state==='cleared')return;
 const front=g.enemies.find(e=>e.id===0),rear=g.enemies.find(e=>e.id===2);
 if(!front||!rear)return;
 if(a.state==='waiting'&&g.player.x>=950&&g.player.x<2600){a.state='active';g.event('encounter-start',{x:1490,y:560});g.notice('Silverwood sentries · break their formation');}
 if(a.state!=='active')return;
 a.time+=dt;
 if(front.dead&&rear.dead&&!a.rewarded){a.rewarded=true;a.state='cleared';g.loot.push(placeLoot(g,{x:1740,kind:'gem',count:1}),placeLoot(g,{x:1690,kind:'ember',count:2}));g.event('encounter-clear',{x:1720,y:515});g.notice('Sentries defeated · starlight cache released');}
}
export function silverwoodEnemyReady(g,e){
 if(e.windup>0||e.attack>0)return true;
 if((e.id!==0&&e.id!==2)||e.x<1200||e.x>1870)return true;
 if(g.silverwood.state==='waiting')return false;
 return e.id===0||g.silverwood.time>=3.5||g.enemies.find(e=>e.id===0).dead;
}
