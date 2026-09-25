import {PLATFORMS} from './game.js';
// Ground-mounted props belong to a surface, never arbitrary world coordinates.
export function groundedPlacement(platforms,{platformId,offset,footprint=12}){
 const p=platforms.find(p=>p.id===platformId);
 if(!p||!Number.isFinite(offset)||!Number.isFinite(footprint)||footprint<=0||offset-footprint/2<0||offset+footprint/2>p.w)throw new Error(`Unsupported ground prop on platform ${platformId}`);
 return {x:p.x+offset,y:p.y,platformId,footprint};
}
export const LANTERNS=[
 [0,350],[1,160],[2,110],[3,100],[4,50],[5,70],
 [6,60],[7,50],[8,310],[8,1100],
].map(([platformId,offset])=>groundedPlacement(PLATFORMS,{platformId,offset}));
