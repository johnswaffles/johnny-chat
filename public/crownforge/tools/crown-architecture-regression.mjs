import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CROWN_ARCHITECTURE} from '../src/architecture-data.js';
import {BUILDING_TYPES,FIRST_AGE_ASSETS} from '../src/config.js';
import {BUILDING_COMPONENTS} from '../src/building-components-data.js';
const root=new URL('../',import.meta.url);
for(const [type,art] of Object.entries(CROWN_ARCHITECTURE)){
 assert.equal(BUILDING_TYPES[type].renderSize,art.renderSize,type+' runtime scale');
 assert.equal(FIRST_AGE_ASSETS[type].src,art.src,type+' runtime painting');
 const bytes=await readFile(new URL(art.src,root));
 assert.equal(bytes.readUInt32BE(16),art.width,type+' native width');assert.equal(bytes.readUInt32BE(20),art.height,type+' native height');
 assert.equal(bytes[25],6,type+' RGBA transparency');
 const hull=art.polygons.material;let area=0;
 for(let i=0;i<hull.length;i++){const a=hull[i],b=hull[(i+1)%hull.length];area+=a[0]*b[1]-a[1]*b[0];}
 assert(area>0,type+' correctly oriented navigation hull');
}
for(const t of ['wall','gate'])for(const v of ['face','depth','diagonal-left','diagonal-right'])assert(BUILDING_COMPONENTS[t].views[v].src.includes('architecture-v2'),t+' '+v);
const manifest=JSON.parse(await readFile(new URL('assets/architecture-v2/remaining-generation.json',root)));
for(const a of manifest){const bytes=await readFile(new URL(a.asset,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),a.sha256,a.id+' original artwork preserved');}
assert.equal(BUILDING_TYPES.townCenter.renderSize,3000);assert.equal(BUILDING_TYPES.barracks.renderSize,3000);assert.equal(BUILDING_TYPES.stable.renderSize,1980);assert.equal(BUILDING_TYPES.granary.renderSize,1260);
console.log('crown-architecture-regression: 16 building paintings, all fortification views, approved scales, and 15 original asset hashes passed');
