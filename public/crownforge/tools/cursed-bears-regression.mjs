import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CrownforgeSimulation} from '../src/simulation.js';
import {BEAR_VARIANT_IDS,bearVariant,bearVariantId} from '../src/bear-variants.js';
import {unitStatuses,displayedUnitHealth} from '../src/unit-status.js';
import {bearFuryActive,bearIncomingDamage} from '../src/bear-combat.js';
function arena(){const s=new CrownforgeSimulation({seed:42});s.units=[];s.buildings=[];s.resourcesNodes=[];s.navigationVersion++;s._checkVictory=()=>{};return s;}
test('all three bloodlines enter the simulation and retain identity and true wounds through saves',()=>{
 const s=arena();const bears=BEAR_VARIANT_IDS.map((id,i)=>{const b=s.addUnit('grizzly',100+i*10,100,'wildlife');assert.equal(b.bearVariant,id);b.hp=41+i;b.lastLightCurseActive=true;b.lastLightCurseDecoy=true;return b;});
 const snapshot=s.serialize();const restored=arena();assert(restored.loadSnapshot(snapshot));
 for(const b of bears){const copy=restored.units.find(u=>u.id===b.id);assert.equal(copy.bearVariant,b.bearVariant);assert.equal(copy.hp,b.hp);assert.equal(displayedUnitHealth(copy),1);assert.equal(bearVariant(copy).name,bearVariant(b).name);}
 assert(BEAR_VARIANT_IDS.includes(bearVariantId({id:99,bearVariant:'unknown'})));
});
test('every lineage has distinct lore and artwork, permanent Thick Hide, and conditional trickery',()=>{
 const s=arena(),lore=new Set(),art=new Set();
 for(const id of BEAR_VARIANT_IDS){const b=s.addUnit('grizzly',100,100,'wildlife');b.bearVariant=id;const statuses=unitStatuses(b),story=statuses.find(s=>s.id==='bearLineage');lore.add(story.lore);art.add(story.art);
 assert(!/Last Light|1 HP|bait|lesser rune/.test(story.lore));assert.match(statuses.find(s=>s.id==='thickHide').effect,/50%/);b.lastLightCurseActive=true;const curse=unitStatuses(b).find(s=>s.id==='lastLight');assert.match(curse.lore,/bait/);assert.match(curse.effect,/60 hits/);assert(bearFuryActive(b));assert.equal(b.hp,b.maxHp);}
 assert.equal(lore.size,3);assert.equal(art.size,3);
});
test('Thick Hide doubles actual melee survival while leaving other units and zero hits unchanged',()=>{
 for(const id of BEAR_VARIANT_IDS){const s=arena(),b=s.addUnit('grizzly',100,100,'wildlife');b.bearVariant=id;
 for(let hit=1;hit<=36;hit++){s._applyUnitDamage(b,10,null);assert.equal(b.hp,180-5*hit);assert.equal(b.dead,hit===36);}}
 assert.equal(bearIncomingDamage({type:'soldier'},10),10);assert.equal(bearIncomingDamage({type:'grizzly',maxHp:180},0,'arrow'),0);
});

test('240 complete paintings have real alpha, legal crops and bounded prepared-frame memory',async()=>{
 const {CURSED_BEAR_ART}=await import('../src/cursed-bear-art.js');
 const {readFileSync}=await import('node:fs');let count=0,pixels=0;const sources=new Set();
 for(const [id,views] of Object.entries(CURSED_BEAR_ART)){
  assert(BEAR_VARIANT_IDS.includes(id));assert.equal(Object.keys(views).length,4);
  for(const actions of Object.values(views))for(const [action,sheet] of Object.entries(actions)){
   assert(['idle','walk','swipe','rear','death'].includes(action));assert.equal(sheet.frames.length,4);assert(!sheet.flip);sources.add(sheet.src);
   const bytes=readFileSync(new URL('../'+sheet.src,import.meta.url));assert.equal(bytes[25],6);const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
   for(const f of sheet.frames){count++;const [x,y,w,h]=f.rect;pixels+=w*h+Math.ceil(w/2)*Math.ceil(h/2);assert(x>=0&&y>=0&&x+w<=width&&y+h<=height);assert(f.pivot[1]>0&&f.pivot[1]<=h);for(const [cx,cy,cw,ch] of f.clip)assert(cx>=0&&cy>=0&&cx+cw<=w&&cy+ch<=h);}
  }
 }
 assert.equal(count,240);assert.equal(sources.size,12);assert(pixels*4<100*1024*1024,'prepared sprites remain below 100 MB');
});
