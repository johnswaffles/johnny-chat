// First-age Crownwarden architecture. Full-resolution originals are never enlarged
// on disk. Ground points are authored against the visible bases, not the roofs.
const plates = {
  townCenter: [1050, .885, [[.10,.64],[.39,.48],[.94,.74],[.64,.885]], 'crown-hall'],
  barracks: [1000, .91, [[.09,.69],[.38,.50],[.94,.78],[.65,.91],[.31,.80]]],
  stable: [1000, .91, [[.11,.70],[.39,.49],[.90,.82],[.80,.91]]],
  granary: [800, .935, [[.17,.70],[.48,.49],[.88,.79],[.62,.935],[.28,.86]]],
  homestead: [800, .88, [[.07,.63],[.37,.44],[.93,.72],[.81,.88],[.60,.85],[.23,.70]]],
  house: [700, .91, [[.21,.70],[.48,.50],[.90,.78],[.62,.91]]],
  watchHut: [670, .92, [[.28,.78],[.48,.63],[.75,.78],[.52,.92]]],
  timberYard: [760, .87, [[.17,.69],[.47,.48],[.84,.75],[.66,.87],[.40,.80]]],
  stonewrightYard: [760, .89, [[.15,.71],[.44,.50],[.89,.78],[.57,.89]]],
  oreWash: [760, .935, [[.21,.69],[.47,.49],[.80,.76],[.80,.88],[.69,.935],[.36,.81]]],
  lumberMill: [900, .91, [[.11,.66],[.40,.48],[.90,.75],[.71,.91],[.40,.78]]],
  quarry: [840, .955, [[.10,.71],[.41,.46],[.90,.76],[.46,.955]]],
  grainMill: [780, .945, [[.16,.73],[.48,.52],[.86,.76],[.54,.945]]],
  storehouse: [730, .895, [[.16,.70],[.46,.50],[.85,.78],[.68,.895],[.40,.86]]],
  palisadeTower: [620, .94, [[.33,.84],[.48,.70],[.69,.82],[.53,.94]]],
  field: [420, .905, [[.09,.59],[.55,.22],[.92,.58],[.48,.905]]],
};

function convexHull(points) {
  const sorted = points.map(p=>[...p]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const lower=[],upper=[];
  for(const p of sorted){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
  for(const p of [...sorted].reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
  return lower.slice(0,-1).concat(upper.slice(0,-1));
}

export const CROWN_ARCHITECTURE = Object.fromEntries(Object.entries(plates).map(([type,[renderSize,groundAnchorY,groundPoints,name=type]])=>{
  const width=1536,height=1024;
  // Invert the game's 52-by-26 isometric projection at native render scale.
  const hull=convexHull(groundPoints.map(([x,y])=>{
    const dx=(x-.5)*renderSize/26,dy=(y-groundAnchorY)*renderSize*(height/width)/13;
    return [(dx+dy)/2,(dy-dx)/2];
  }));
  return [type,{src:`./assets/architecture-first-age/${name}-v1.png`,width,height,groundAnchorY,renderSize,kind:type==='field'?'field':'solid',architectureV2:true,firstAgeTimber:true,groundPoints,polygons:{material:hull,foot:hull,mounted:hull}}];
}));
