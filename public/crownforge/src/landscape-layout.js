// Shared, deterministic landscape fields. Rendering never consumes the match RNG.
export const clamp01 = value => Math.max(0, Math.min(1, value));
export function landscapeHash(x, z, seed = 0) {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ (seed | 0);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function landscapeNoise(x, z, seed = 0) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const dx = x - ix, dz = z - iz;
  const u = dx * dx * (3 - 2 * dx), v = dz * dz * (3 - 2 * dz);
  const a = landscapeHash(ix, iz, seed), b = landscapeHash(ix + 1, iz, seed);
  const c = landscapeHash(ix, iz + 1, seed), d = landscapeHash(ix + 1, iz + 1, seed);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

// The strategic woodland divide follows a winding ridge. Its central trees
// still form a harvestable barrier, but the surrounding forest has no rows.
export function woodlandRidgeZ(x) {
  return 430 - x + 18 * Math.sin(x * 0.024) + 8 * Math.sin(x * 0.071)
    + 56 * Math.exp(-(((x - 190) / 43) ** 2));
}
export const FOREST_LIMITS = Object.freeze({ attempts: 100000, maxTrees: 8500 });
const smooth = (a,b,n) => { const t=clamp01((n-a)/(b-a)); return t*t*(3-2*t); };

export function woodlandDensity(x, z, seed = 0) {
  // Large continuous masses, with broken margins and small internal glades.
  // Sampling this field densely produces forest interiors instead of a
  // uniform scattering of separate specimen trees over every meadow.
  const u=x+(landscapeNoise(x/83,z/83,seed+91)-.5)*42;
  const v=z+(landscapeNoise(x/83+17,z/83-9,seed+137)-.5)*42;
  const broad=landscapeNoise(u/115,v/115,seed+201);
  const edge=landscapeNoise(u/29,v/29,seed+17);
  const canopy=smooth(.25,.45,broad*.78+edge*.22);
  const glade=smooth(.72,.87,landscapeNoise(x/22,z/22,seed+823));
  const width=43+landscapeNoise(x/64,19,seed)*37;
  const ridge=x<440?Math.exp(-(((z-woodlandRidgeZ(x))/width)**2)):.0;
  return Math.max(canopy*(.84+edge*.16)*(1-glade*.9),ridge*.94);
}

export const WOODLAND_HABITATS = ['Pinewoods','Deep spruce','Oak and beech','Birch and ash'];
export function woodlandHabitat(x,z,seed=0) {
  // Warped, jittered habitat regions keep species together across a whole
  // hillside. Companions mix chiefly at the boundaries between stands.
  const u=x+(landscapeNoise(x/55,z/55,seed+67)-.5)*30;
  const v=z+(landscapeNoise(x/55+9,z/55-5,seed+73)-.5)*30;
  const scale=106,cx=Math.floor(u/scale),cz=Math.floor(v/scale);
  let nearest=Infinity,second=Infinity,group=0,stand=0;
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++) {
    const ix=cx+dx,iz=cz+dz;
    const sx=(ix+.18+landscapeHash(ix,iz,seed+419)*.64)*scale;
    const sz=(iz+.18+landscapeHash(ix,iz,seed+571)*.64)*scale;
    const d=(u-sx)**2+(v-sz)**2;
    if(d<nearest){second=nearest;nearest=d;group=Math.floor(landscapeHash(ix,iz,seed+761)*4);stand=landscapeHash(ix,iz,seed+887);}
    else if(d<second)second=d;
  }
  return {group,stand,interior:smooth(0,28,Math.sqrt(second)-Math.sqrt(nearest))};
}

export function meadowHabitat(x,z,seed=0) {
  const moisture=landscapeNoise(x/66,z/66,seed+811);
  const patch=landscapeNoise(x/12,z/12,seed+121);
  const ribbon=landscapeNoise((x+z*.28)/35,(z-x*.18)/9,seed+221);
  return {moisture,patch,lush:smooth(.30,.70,moisture*.65+patch*.35),flowers:smooth(.53,.72,ribbon)*smooth(.30,.62,moisture)};
}

export function treeAppearance(node) {
  const seed=node.forestSeed??0;
  const x=Math.round(node.x*31),z=Math.round(node.z*31);
  const habitat=woodlandHabitat(node.x,node.z,seed);
  const choice=landscapeHash(x,z,seed+71),variation=landscapeHash(x,z,seed+119);
  const core=choice<.76+habitat.interior*.20;
  const dominant=[[2,8,9],[3,10,11],[0,4],[1,6]][habitat.group];
  const companions=[[1,7,5],[1,7,5],[1,6,5],[0,4,5]][habitat.group];
  const family=core?dominant:companions;
  const species=family[Math.floor(landscapeHash(x,z,seed+173)*family.length)];
  const widths=[338,250,320,258,332,177,308,208,326,318,278,284];
  // Cohort height is shared across a stand; individual growth varies subtly.
  // Broad mature crowns overlap, with occasional younger edge trees.
  const cohort=.91+habitat.stand*.17;
  const width=widths[species]*cohort*(.88+variation*.25);
  return {species,width,habitat:habitat.group,interior:habitat.interior};
}
