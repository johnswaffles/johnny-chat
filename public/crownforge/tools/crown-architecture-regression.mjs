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
for(const t of ['wall','gate'])for(const v of ['face','depth','diagonal-left','diagonal-right'])assert(BUILDING_COMPONENTS[t].views[v].src.includes('architecture-first-age'),t+' '+v);
const manifest=JSON.parse(await readFile(new URL('assets/architecture-first-age/manifest.json',root)));
for(const asset of manifest.assets){
 const bytes=await readFile(new URL(asset.asset,root));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,asset.asset+' original artwork');
}
const preserved=manifest.preservedObservatory;
assert.deepEqual(BUILDING_TYPES.observatory,preserved.blueprint,'Observatory gameplay and scale unchanged');
assert.deepEqual(FIRST_AGE_ASSETS.observatory,preserved.asset,'Observatory artwork metadata unchanged');
assert.equal(createHash('sha256').update(await readFile(new URL(preserved.asset.src,root))).digest('hex'),preserved.sha256,'Observatory artwork unchanged');
assert.equal(BUILDING_TYPES.townCenter.renderSize,1050);
assert.equal(BUILDING_TYPES.barracks.renderSize,1000);
assert.equal(BUILDING_TYPES.stable.renderSize,1000);
assert.equal(BUILDING_TYPES.granary.renderSize,800);
assert.equal(BUILDING_TYPES.field.walkable,true,'fields remain walkable');
console.log('crown-architecture-regression: 16 scaled buildings, 19 original assets, all fortification views, and unchanged Observatory passed');
