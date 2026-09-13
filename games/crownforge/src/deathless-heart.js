// A stronger damage-reduction tier, never multiplied by the ordinary Heart.
export const DEATHLESS_HEART=Object.freeze({threshold:.05,duration:60,multiplier:.01,rearmHealth:.6});
export const deathlessActive=u=>Boolean(u?.type==='grizzly'&&!u.dead&&u.hp>0&&(u.deathlessTimer??0)>0);
export function updateDeathlessHeart(u,dt=0){
 if(u?.type!=='grizzly')return;
 if(u.dead||u.hp<=0){u.deathlessTimer=0;return;}
 u.deathlessTimer=Math.max(0,(u.deathlessTimer??0)-Math.max(0,dt));
 if(u.deathlessTimer>0)return;
 if(u.hp/u.maxHp>DEATHLESS_HEART.rearmHealth)u.deathlessSpent=false;
 if(!u.deathlessSpent&&u.hp/u.maxHp<DEATHLESS_HEART.threshold){u.deathlessTimer=60;u.deathlessSpent=true;}
}
export function deathlessCrossingDamage(u,rawDamage,ordinaryDamage,ordinaryMultiplier){
 if(u.type!=='grizzly'||u.deathlessSpent)return ordinaryDamage;
 const above=Math.max(0,u.hp-u.maxHp*DEATHLESS_HEART.threshold);
 if(ordinaryDamage<=above)return ordinaryDamage;
 u.deathlessTimer=DEATHLESS_HEART.duration;u.deathlessSpent=true;
 // Any crossing of 5% happens entirely inside the ordinary Heart's 20% tier.
 const remainingRaw=Math.min(rawDamage,(ordinaryDamage-above)/ordinaryMultiplier);
 return above+remainingRaw*DEATHLESS_HEART.multiplier;
}
