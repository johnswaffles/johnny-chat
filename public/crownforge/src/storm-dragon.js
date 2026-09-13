export const SKYBREAKER=Object.freeze({cooldown:300,duration:10,breathStart:2,breathEnd:8,pulse:.5,damage:150,radius:12,range:45,buffDuration:12,wardReduction:.3,spellMultiplier:1.5});
export const SKYBREAKER_ART='./assets/skybreaker/lore-v1.png';
export const SKYBREAKER_LORE='Before the old gods named the winds, Vaelthryx carried the first thunder beneath his wings. They chained him above the world and used his heart to light their heavens. When the last star fell, its keeper broke one link. Vaelthryx shattered the rest. He answers no throne and suffers no bridle. When the Arcanist raises that stolen star, the Skybreaker comes to repay a freedom that even the gods could not reclaim.';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function dragonBreathPoint(pass,age=pass.age){const t=Math.max(0,Math.min(1,(age-SKYBREAKER.breathStart)/(SKYBREAKER.breathEnd-SKYBREAKER.breathStart)));return {x:pass.target.x+pass.direction.x*(t-.5)*48,z:pass.target.z+pass.direction.z*(t-.5)*48};}
export function summonStormDragon(sim,wizard,aim=null){
 if(!wizard||wizard.type!=='wizard'||wizard.dead||wizard.hp<=0)return {success:false,reason:'Select a living Starveil Arcanist.'};
 if(wizard.skybreakerCooldown>0)return {success:false,reason:`Heavenrend returns in ${Math.ceil(wizard.skybreakerCooldown)} seconds.`};
 const enemies=sim.units.filter(u=>!u.dead&&u.faction!==wizard.faction&&u.faction!=='neutral'&&distance(u,wizard)<=SKYBREAKER.range);
 const target=aim&&enemies.includes(aim)?aim:enemies.find(u=>u.id===wizard.attackTarget)??enemies.sort((a,b)=>distance(a,wizard)-distance(b,wizard))[0];
 if(!target)return {success:false,reason:'Bring an enemy within 45 units to call Heavenrend.'};
 const dx=target.x-wizard.x,dz=target.z-wizard.z,len=Math.hypot(dx,dz)||1;
 // Sweep across the enemy front, perpendicular to the wizard's aim.
 let direction={x:-dz/len,z:dx/len};if(direction.x-direction.z<0)direction={x:-direction.x,z:-direction.z};
 const pass={sourceId:wizard.id,faction:wizard.faction,target:{x:target.x,z:target.z},direction,age:0,nextPulse:SKYBREAKER.breathStart,totalDamage:0};
 (sim.stormDragons??=[]).push(pass);wizard.skybreakerCooldown=300;wizard.skybreakerActive=10;wizard.skybreakerFavor=12;
 for(const ally of sim.units)if(!ally.dead&&ally.faction===wizard.faction&&distance(ally,wizard)<=28)ally.stormwardTimer=12;
 wizard.lastWizardSpell='Heavenrend · Vaelthryx answers';
 return {success:true,pass};
}
export function updateStormDragons(sim,dt){
 for(const unit of sim.units)for(const key of ['skybreakerCooldown','skybreakerActive','skybreakerFavor','stormwardTimer'])if(unit[key]>0)unit[key]=Math.max(0,unit[key]-dt);
 sim.stormDragons=(sim.stormDragons??[]).filter(pass=>{
  pass.age+=dt;const source=sim.units.find(u=>u.id===pass.sourceId);
  while(pass.nextPulse<SKYBREAKER.breathEnd&&pass.nextPulse<=pass.age){
   const point=dragonBreathPoint(pass,pass.nextPulse);pass.nextPulse+=SKYBREAKER.pulse;
   for(const enemy of sim.units)if(!enemy.dead&&enemy.faction!==pass.faction&&enemy.faction!=='neutral'&&distance(enemy,point)<=SKYBREAKER.radius){
    const hit=sim._applyUnitDamage(enemy,SKYBREAKER.damage,source,{damageType:'lightning',magical:true,areaOfEffect:true});pass.totalDamage+=hit?.damage??0;
   }
  }
  return pass.age<SKYBREAKER.duration;
 });
}
export const stormwardDamage=(unit,damage)=>damage*(unit.stormwardTimer>0?1-SKYBREAKER.wardReduction:1);
