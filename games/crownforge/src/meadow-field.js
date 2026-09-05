import {BUILDING_TYPES,RESOURCE_SIZE_TIERS,UNIT_TYPES} from './config.js';
import {clamp01,landscapeHash,landscapeNoise} from './landscape-layout.js';

// Presentation data only. No DOM, match RNG, pathfinding, or simulation writes.
export const MEADOW_LIMITS=Object.freeze({chunkSize:12,candidatesPerChunk:72,maxChunks:2048,maxVisible:2500,maxUnits:1024,maxDisturbances:1024,interactionBin:3,exclusionBin:12,wakeLifetime:3.2,farZoom:.095});
const TAU=Math.PI*2,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=(a,b,n)=>{const t=clamp01((n-a)/(b-a));return t*t*(3-2*t);};
const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
const MOUNTED=new Set(['scout','ashenOutrider']); // The two mounted families in character-rigs.js.
const RESOURCE_RADII={tree:1.05,grove:2.45,berry:1.55,grain:3.5,stone:1.35,gold:1.5};
const EMPTY=Object.freeze([]),REST=Object.freeze({bend:0,press:0});

export class MeadowField {
  constructor({mapWidth,mapHeight,seed=0}) {
    if(!(mapWidth>0&&mapHeight>0&&Number.isFinite(mapWidth)&&Number.isFinite(mapHeight)))throw new RangeError('Meadow dimensions must be finite and positive');
    this.mapWidth=mapWidth;this.mapHeight=mapHeight;this.seed=seed>>>0;
    this.chunks=new Map();this.exclusionBins=new Map();this.disturbances=new Map();this.interactionBins=new Map();this.unitTracks=new Map();
    this.forestCoverage=null;this.visibleKey='';this.visibleTufts=EMPTY;this.revision=0;this.lastSeconds=null;this.exclusionCount=0;this.generatedChunks=0;
  }

  sync(simulation,forestCoverage=null) {
    const seed=(simulation.activeWorldSeed??simulation.worldSeed??this.seed)>>>0;
    const seedChanged=seed!==this.seed,simulationChanged=this.simulation!==simulation,resourcesChanged=this.resources!==simulation.resourcesNodes;
    // Simulation filters the unit/building ARRAY WRAPPERS every tick.
    // Their stable entities, seed and navigation revision identify this
    // world. A snapshot load replaces the actual unit objects as well as
    // resources; ordinary wall clearing keeps surviving actor objects.
    const loadedEntities=resourcesChanged&&this.resources
      &&!(simulation.units??[]).some(unit=>this.unitTracks.get(unit.id)?.entity===unit);
    const changed=simulationChanged||seedChanged||resourcesChanged||this.navigationVersion!==simulation.navigationVersion||this.forestCoverage!==forestCoverage;
    if(seedChanged){this.seed=seed;this.chunks.clear();}
    if(simulationChanged||seedChanged||loadedEntities){this.unitTracks.clear();this.disturbances.clear();this.interactionBins.clear();this.lastSeconds=null;}
    this.simulation=simulation;
    if(!changed)return false;
    this.resources=simulation.resourcesNodes;this.buildings=simulation.buildings;this.navigationVersion=simulation.navigationVersion;this.forestCoverage=forestCoverage;
    this.exclusionBins.clear();this.exclusionCount=0;
    for(const building of simulation.buildings??[]) {
      if(building.destroyed||!finitePoint(building))continue;
      const blueprint=BUILDING_TYPES[building.type];if(!blueprint)continue;
      const footprint=blueprint.collisionFootprint??blueprint.footprint??{width:1,height:1};
      const offset=blueprint.collisionOffset??{x:0,z:0};
      const x=building.x+(offset.x??0),z=building.z+(offset.z??0),margin=(building.road||blueprint.road) ? .12 : .55;
      let width=footprint.width,height=footprint.height,dx=1,dz=0;
      if(blueprint.wall||blueprint.gate) {
        const direction=building.wallDirection??building.gateDirection??(building.wallOrientation==='vertical'?{x:0,z:1}:{x:1,z:0});
        const magnitude=Math.hypot(direction.x,direction.z)||1;dx=direction.x/magnitude;dz=direction.z/magnitude;
        const segments=blueprint.wall?Math.max(1,Math.round(building.wallSegments??1)):1;
        width=footprint.width+(segments-1)*(blueprint.wallSegmentSpan??footprint.width);
      }
      const halfWidth=width/2+margin,halfHeight=height/2+margin;
      this._indexExclusion({kind:'box',x,z,dx,dz,halfWidth,halfHeight},Math.abs(dx)*halfWidth+Math.abs(dz)*halfHeight,Math.abs(dz)*halfWidth+Math.abs(dx)*halfHeight);
    }
    for(const node of simulation.resourcesNodes??[]) {
      if(!finitePoint(node)||(node.resourceType==='wood'&&node.amount<=0))continue;
      const tier=RESOURCE_SIZE_TIERS[node.sizeTier??'small']?.footprintScale??1;
      const radius=(node.type==='tree'&&node.forestClusterId?3.05:(RESOURCE_RADII[node.type]??.8))*tier+.3;
      this._indexExclusion({kind:'circle',x:node.x,z:node.z,radius},radius,radius);
    }
    this.revision++;this.visibleKey='';return true;
  }

  _indexExclusion(shape,extentX,extentZ) {
    const size=MEADOW_LIMITS.exclusionBin;
    for(let z=Math.floor(Math.max(0,shape.z-extentZ)/size);z<=Math.floor(Math.min(this.mapHeight,shape.z+extentZ)/size);z++)for(let x=Math.floor(Math.max(0,shape.x-extentX)/size);x<=Math.floor(Math.min(this.mapWidth,shape.x+extentX)/size);x++){
      const key=`${x}:${z}`;if(!this.exclusionBins.has(key))this.exclusionBins.set(key,[]);this.exclusionBins.get(key).push(shape);
    }
    this.exclusionCount++;
  }

  excluded(x,z) {
    if(!(x>=0&&z>=0&&x<this.mapWidth&&z<this.mapHeight))return true;
    const shapes=this.exclusionBins.get(`${Math.floor(x/MEADOW_LIMITS.exclusionBin)}:${Math.floor(z/MEADOW_LIMITS.exclusionBin)}`)??EMPTY;
    for(const shape of shapes){const dx=x-shape.x,dz=z-shape.z;
      if(shape.kind==='circle'){if(dx*dx+dz*dz<shape.radius*shape.radius)return true;}
      else if(Math.abs(dx*shape.dx+dz*shape.dz)<=shape.halfWidth&&Math.abs(-dx*shape.dz+dz*shape.dx)<=shape.halfHeight)return true;
    }
    return false;
  }

  _chunk(cx,cz) {
    const key=`${cx}:${cz}`,cached=this.chunks.get(key);
    if(cached){this.chunks.delete(key);this.chunks.set(key,cached);return cached;}
    this.generatedChunks++;
    const tufts=[],salt=(Math.imul(cx,73856093)^Math.imul(cz,19349663)^this.seed)>>>0,size=MEADOW_LIMITS.chunkSize;
    for(let i=0;i<MEADOW_LIMITS.candidatesPerChunk;i++){
      const x=(cx+landscapeHash(i,11,salt))*size,z=(cz+landscapeHash(i,37,salt))*size;
      if(x>=this.mapWidth||z>=this.mapHeight)continue;
      const broad=landscapeNoise(x/28,z/28,this.seed+811),patch=landscapeNoise(x/7,z/7,this.seed+121);
      const density=clamp(.22+broad*.56+(patch-.5)*.42,.12,.87);
      if(landscapeHash(i,57,salt)>density)continue;
      const shape=landscapeHash(i,73,salt),rank=landscapeHash(i,97,salt),variety=landscapeHash(i,113,salt);
      const variant=variety<.58?Math.floor(variety/.58*4):variety<.76?4+Math.floor((variety-.58)/.18*3):variety<.88?7:variety<.94?8:variety<.965?9:variety<.985?10:11;
      const seedGrass=variant>=4&&variant<=6,clover=variant===8,flower=variant===9||variant===10,fern=variant===11;
      const height=seedGrass?26+shape*12:clover?9+shape*6:flower||fern?18+shape*9:12+shape*12;
      const width=seedGrass?24+shape*14:clover?26+shape*16:flower?22+shape*13:fern?30+shape*14:30+shape*24;
      const id=(cz*Math.ceil(this.mapWidth/size)+cx)*MEADOW_LIMITS.candidatesPerChunk+i;
      tufts.push(Object.freeze({id,x,z,depth:x+z+.7,width,height,variant,phase:landscapeHash(i,139,salt)*TAU,opacity:.66+patch*.28,rank}));
    }
    this.chunks.set(key,tufts);while(this.chunks.size>MEADOW_LIMITS.maxChunks)this.chunks.delete(this.chunks.keys().next().value);
    return tufts;
  }

  _shade(x,z) {
    const coverage=this.forestCoverage;if(!coverage?.length)return 0;
    const width=Math.ceil(this.mapWidth),height=Math.floor(coverage.length/width);if(!height)return 0;
    const at=Math.min(height-1,Math.floor(z/this.mapHeight*height))*width+Math.min(width-1,Math.floor(x/this.mapWidth*width));
    return clamp01(coverage[at]??0);
  }

  visible(bounds,zoom) {
    if(!(zoom>MEADOW_LIMITS.farZoom)||!bounds||![bounds.minX,bounds.minZ,bounds.maxX,bounds.maxZ].every(Number.isFinite)){this.visibleKey='';this.visibleTufts=EMPTY;return EMPTY;}
    const fade=smooth(MEADOW_LIMITS.farZoom,.22,zoom);
    if(fade<=.015){this.visibleKey='';this.visibleTufts=EMPTY;return EMPTY;}
    const minX=clamp(bounds.minX,0,this.mapWidth),minZ=clamp(bounds.minZ,0,this.mapHeight),maxX=clamp(bounds.maxX,0,this.mapWidth),maxZ=clamp(bounds.maxZ,0,this.mapHeight);
    if(minX>=maxX||minZ>=maxZ)return EMPTY;
    const key=`${this.revision}|${minX}|${minZ}|${maxX}|${maxZ}|${zoom}`;
    if(key===this.visibleKey)return this.visibleTufts;
    const density=clamp((zoom/.62)**2,.025,1),size=MEADOW_LIMITS.chunkSize,candidates=[];
    for(let cz=Math.floor(minZ/size);cz<=Math.floor((maxZ-1e-8)/size);cz++)for(let cx=Math.floor(minX/size);cx<=Math.floor((maxX-1e-8)/size);cx++)for(const tuft of this._chunk(cx,cz)){
      if(tuft.x<minX||tuft.x>maxX||tuft.z<minZ||tuft.z>maxZ||tuft.rank>=density||this.excluded(tuft.x,tuft.z))continue;
      const shade=this._shade(tuft.x,tuft.z),habitat=1-smooth(.23,.73,shade)*.87;
      if(landscapeHash(Math.floor(tuft.x*31),Math.floor(tuft.z*31),this.seed+439)>habitat)continue;
      const lod=1-smooth(density*.76,density,tuft.rank),opacity=tuft.opacity*fade*lod*(1-shade*.38);
      if(opacity>.015)candidates.push({...tuft,opacity});
    }
    // Stable per-tuft priority bounds a wide viewport; camera motion never
    // relocates candidates or consumes a mutable random sequence.
    if(candidates.length>MEADOW_LIMITS.maxVisible){candidates.sort((a,b)=>a.rank-b.rank||a.id-b.id);candidates.length=MEADOW_LIMITS.maxVisible;}
    candidates.sort((a,b)=>a.depth-b.depth||a.id-b.id);
    this.visibleKey=key;this.visibleTufts=candidates;return candidates;
  }

  _removeWake(key) {
    const wake=this.disturbances.get(key);if(!wake)return;
    const bin=this.interactionBins.get(wake.bin);bin?.delete(key);if(!bin?.size)this.interactionBins.delete(wake.bin);this.disturbances.delete(key);
  }

  _stamp(x,z,dx,dz,seconds,mounted) {
    if(this.excluded(x,z))return;
    const key=`${Math.floor(x/.65)}:${Math.floor(z/.65)}`,bin=`${Math.floor(x/MEADOW_LIMITS.interactionBin)}:${Math.floor(z/MEADOW_LIMITS.interactionBin)}`;
    let wake=this.disturbances.get(key);
    if(wake){
      // A moving foot often stays inside one contact cell for several
      // frames. Refresh its record instead of allocating another wake.
      if(wake.bin!==bin){const previous=this.interactionBins.get(wake.bin);previous?.delete(key);if(!previous?.size)this.interactionBins.delete(wake.bin);}
      wake.x=x;wake.z=z;wake.dx=dx;wake.dz=dz;wake.time=seconds;wake.radius=mounted?1.75:1.12;wake.strength=mounted?.96:.7;wake.bin=bin;
      this.disturbances.delete(key);
    }else wake={x,z,dx,dz,time:seconds,radius:mounted?1.75:1.12,strength:mounted?.96:.7,bin};
    this.disturbances.set(key,wake);if(!this.interactionBins.has(bin))this.interactionBins.set(bin,new Set());this.interactionBins.get(bin).add(key);
    while(this.disturbances.size>MEADOW_LIMITS.maxDisturbances)this._removeWake(this.disturbances.keys().next().value);
  }

  update(units,seconds,delta) {
    if(!Number.isFinite(seconds))return;
    if(this.lastSeconds!==null&&seconds<this.lastSeconds){this.unitTracks.clear();this.disturbances.clear();this.interactionBins.clear();}
    const elapsed=this.lastSeconds===null?Math.max(0,delta||0):Math.max(0,seconds-this.lastSeconds);this.lastSeconds=seconds;
    for(const[key,wake]of this.disturbances)if(seconds-wake.time>MEADOW_LIMITS.wakeLifetime)this._removeWake(key);
    const previousTracks=this.unitTracks;this.unitTracks=new Map();
    for(const unit of units??[]){
      if(unit.id===undefined||!finitePoint(unit)||unit.dead||unit.destroyed||unit.stairProgress>0.05)continue;
      const id=unit.id,prior=previousTracks.get(id);
      const mounted=MOUNTED.has(unit.type),step=mounted?.42:.30;
      if(prior&&elapsed>0){
        const dx=unit.x-prior.x,dz=unit.z-prior.z,distance=Math.hypot(dx,dz),speed=UNIT_TYPES[unit.type]?.speed??3;
        if(distance>.003&&distance<=Math.max(2.5,speed*Math.max(elapsed,delta||0)*2.5)){
          const ux=dx/distance,uz=dz/distance,count=Math.min(12,Math.max(1,Math.ceil(distance/step)));
          for(let i=1;i<=count;i++){
            const progress=i/count,lateral=(Math.floor((prior.travel+distance*progress)/step)%2?1:-1)*(mounted?.33:.16);
            this._stamp(prior.x+dx*progress-uz*lateral,prior.z+dz*progress+ux*lateral,ux,uz,seconds,mounted);
          }
          prior.travel+=distance;
        }else if(distance>2.5)prior.travel=0;
      }
      this.unitTracks.delete(id);this.unitTracks.set(id,{entity:unit,x:unit.x,z:unit.z,travel:prior?.travel??0});
      while(this.unitTracks.size>MEADOW_LIMITS.maxUnits)this.unitTracks.delete(this.unitTracks.keys().next().value);
    }
  }

  displacement(tuft,seconds) {
    if(!finitePoint(tuft)||!Number.isFinite(seconds))return REST;
    let bend=0,press=0;
    const size=MEADOW_LIMITS.interactionBin,bx=Math.floor(tuft.x/size),bz=Math.floor(tuft.z/size);
    for(let z=bz-1;z<=bz+1;z++)for(let x=bx-1;x<=bx+1;x++)for(const key of this.interactionBins.get(`${x}:${z}`)??EMPTY){
      const wake=this.disturbances.get(key),age=seconds-wake.time;if(age<0||age>MEADOW_LIMITS.wakeLifetime)continue;
      const dx=tuft.x-wake.x,dz=tuft.z-wake.z,distance=Math.hypot(dx,dz);if(distance>=wake.radius)continue;
      const weight=(1-distance/wake.radius)**2*wake.strength;
      const across=distance>.05?(dx-dz)/Math.max(.1,distance*Math.SQRT2):0;
      const travel=(wake.dx-wake.dz)/Math.SQRT2;
      bend+=(across*.7+travel*.6)*weight*Math.exp(-age*1.9)*Math.cos(age*4.5);
      press=Math.max(press,weight*Math.exp(-age*2.5));
    }
    return {bend:clamp(bend,-1,1),press:clamp01(press)};
  }

  stats(){return {chunkCount:this.chunks.size,generatedChunks:this.generatedChunks,cachedTufts:[...this.chunks.values()].reduce((n,chunk)=>n+chunk.length,0),visibleCount:this.visibleTufts.length,trackedUnits:this.unitTracks.size,disturbanceCount:this.disturbances.size,interactionBins:this.interactionBins.size,exclusionShapes:this.exclusionCount,exclusionBins:this.exclusionBins.size};}
}

// Separate ambient sway from contact, so reduced motion can stop wind
// without making a walking character pass through rigid grass.
export function meadowWind(tuft,seconds,{enabled=true,reducedMotion=false}={}) {
  if(!enabled||reducedMotion||!finitePoint(tuft)||!Number.isFinite(seconds))return 0;
  const gust=Math.sin(seconds*.73+tuft.x*.035+tuft.z*.018);
  return .115*gust+.045*Math.sin(seconds*1.9+(tuft.phase??0));
}
