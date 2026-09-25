// Run-only rewards: checkpoints and memories persist, arcade power starts fresh on retry.
export const POWER_THRESHOLDS=[6,15,27];
export const newArcade=()=>({score:0,combo:0,comboTime:0,bestCombo:0,crystals:0,rank:0,charge:0,overdrive:0,drops:[]});
export const arcadeDamage=a=>1+a.rank*.1+(a.overdrive>0?.35:0);
export function rewardKill(game,enemy){
 const a=game.arcade;a.combo=a.comboTime>0?Math.min(5,a.combo+1):1;a.comboTime=8;a.bestCombo=Math.max(a.bestCombo,a.combo);
 const score=(enemy.type==='boss'?1500:100)*a.combo;a.score+=score;
 game.numbers.push({x:enemy.x,y:enemy.y-115,text:`+${score}  ×${a.combo}`,life:1.25,color:'#ffdd85'});
 const floor=game.platforms.find(f=>enemy.x>=f.x&&enemy.x<=f.x+f.w&&f.y===enemy.y);
 const n=enemy.type==='boss'?12:3;
 for(let i=0;i<n;i++){const x=Math.max((floor?.x??enemy.x-70)+14,Math.min((floor?floor.x+floor.w:enemy.x+70)-14,enemy.x+(i-(n-1)/2)*15));a.drops.push({x,y:enemy.y-48,floor:enemy.y-18,vy:-130-i%3*30,age:0,homing:false});}
 game.event('score',{combo:a.combo,score});
}
export function collectCrystal(game,drop){
 const a=game.arcade,p=game.player;a.crystals++;a.charge++;a.score+=25;p.mana=Math.min(100,p.mana+4);
 game.event('crystal',{x:drop.x,y:drop.y,n:a.crystals});
 const rank=POWER_THRESHOLDS.filter(n=>a.crystals>=n).length;
 if(rank>a.rank){a.rank=rank;game.event('power-rank',{x:p.x,y:p.y-55,rank});}
 if(a.charge>=9){a.charge-=9;a.overdrive=8;game.event('overdrive',{x:p.x,y:p.y-55});}
}
export function updateArcade(game,dt){
 const a=game.arcade,p=game.player;a.comboTime=Math.max(0,a.comboTime-dt);if(!a.comboTime)a.combo=0;a.overdrive=Math.max(0,a.overdrive-dt);
 for(const d of a.drops){
  d.age+=dt;const dx=p.x-d.x,dy=p.y-50-d.y,dist=Math.hypot(dx,dy);
  if(d.age>.2&&dist<170)d.homing=true;
  if(d.homing){const step=Math.min(dist,dt*(260+d.age*120));d.x+=dx/(dist||1)*step;d.y+=dy/(dist||1)*step;}
  else {d.vy+=dt*650;d.y=Math.min(d.floor,d.y+d.vy*dt);if(d.y===d.floor)d.vy=0;}
  if(Math.hypot(p.x-d.x,p.y-50-d.y)<22){d.taken=true;collectCrystal(game,d);}
 }
 a.drops=a.drops.filter(d=>!d.taken);
}
