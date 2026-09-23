import {SKYBREAKER,dragonBreathPoint} from './storm-dragon.js?v=20260923-teamdock1';
export const skybreakerId=pass=>`skybreaker:${pass.sourceId}`;
const portraits=new WeakMap();
export function selectedSkybreaker(sim){
 const pass=(sim.stormDragons??[]).find(p=>p.age<SKYBREAKER.duration&&(sim.selectedIds??[]).includes(skybreakerId(p)));if(!pass)return null;
 let unit=portraits.get(pass);if(!unit){unit={id:skybreakerId(pass),type:'skybreaker',faction:pass.faction,hp:1,maxHp:1};portraits.set(pass,unit);}
 unit.pass=pass;unit.actionLabel=pass.age>=2&&pass.age<8?'Heavenrend · lightning breath':'The Unbound Thunder';return unit;
}
export function skybreakerStatuses(unit){const remaining=Math.max(0,SKYBREAKER.duration-unit.pass.age);return [{id:'unboundSovereign',name:'Unbound Sovereign',summary:'No weapon can reach the lord of the storm.',detail:`${Math.ceil(remaining)}s remaining`,effect:'Untargetable. Completes his flight even if his summoner falls.'},...(unit.pass.age>=2&&unit.pass.age<8?[{id:'heavenrend',name:'Heavenrend',summary:'Lightning scours the battlefield.',detail:`${Math.ceil(8-unit.pass.age)}s remaining`,effect:'150 magical area damage every half-second. Spares allies.'}]:[])];}
// A forgiving body/head region, not the enormous rectangular wing atlas.
export function skybreakerAtScreen(sim,renderer,point){
 for(const pass of [...(sim.stormDragons??[])].reverse()){
  if(pass.age>=10)continue;const ground=dragonBreathPoint(pass),travel=pass.age<2?(pass.age-2)*15:pass.age>8?(pass.age-8)*20:0;
  const pos=renderer.worldToScreen({x:ground.x+pass.direction.x*travel,z:ground.z+pass.direction.z*travel}),z=renderer.camera.zoom;
  if(((point.x-(pos.x-650*z))/(760*z))**2+((point.y-(pos.y-760*z))/(340*z))**2<=1)return pass;
 }return null;
}
export function selectSkybreakerAt(sim,renderer,point){const pass=skybreakerAtScreen(sim,renderer,point);if(!pass)return false;sim.selectedIds=[skybreakerId(pass)];sim._syncSelectionFlags();return true;}
