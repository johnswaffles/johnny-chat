import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { BUILDING_TYPES } from '../src/config.js';
import { BUILDING_DEPTH } from '../src/building-depth-data.js';
import { BUILDING_COMPONENTS } from '../src/building-components-data.js';
const root=new URL('../',import.meta.url),folder=new URL('assets/buildings-depth/',root);
const manifest=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
assert.deepEqual(manifest.buildings.map(b=>b.id).sort(),Object.keys(BUILDING_TYPES).sort());
for(const file of manifest.runtime){const bytes=await readFile(new URL(file.file,folder));assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.file);if(file.file!=='road.webp')assert.equal(file.alphaRange[0],0,file.file+' genuine transparency');}
const files=new Set(manifest.runtime.map(f=>f.file));
function checkSource(src){assert(files.has(src.split('/').pop().split('?')[0]),src);}
for(const [type,art] of Object.entries(BUILDING_DEPTH)){checkSource(art.src);if(art.kind==='solid')for(const stage of ['foundation','partial','nearComplete'])checkSource(BUILDING_COMPONENTS[type].stages[stage].src);}
for(const type of ['wall','gate','ashenWall','ashenGate'])for(const view of ['face','depth','diagonal-left','diagonal-right'])checkSource(BUILDING_COMPONENTS[type].views[view].src);
checkSource(BUILDING_COMPONENTS.road.texture.src);checkSource(BUILDING_COMPONENTS.palisadeJunction.sprite.src);
console.log(`building-assets-regression: all ${manifest.buildings.length} building types and ${manifest.runtime.length} asset hashes passed`);
