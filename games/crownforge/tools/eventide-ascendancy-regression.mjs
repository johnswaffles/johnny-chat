import test from 'node:test';import assert from 'node:assert/strict';
import {CrownforgeSimulation} from '../src/simulation.js';
import {escapeEventide} from '../src/wizard-positioning.js';
import {wizardAttackRange} from '../src/eventide-ascendancy.js';
import {updateWizardMagic} from '../src/wizard-magic.js';
import {unitStatuses} from '../src/unit-status.js';
function arena(){const s=new CrownforgeSimulation({seed:42,enemyTeamPaused:false});s.units=[];s.buildings=[];s.resourcesNodes=[];s.decorations=[];s.navigationVersion++;return s;}
test('each successful passage hits at both ends, doubles reach five times, and resumes immediately',()=>{
 const s=arena(),w=s.addUnit('wizard',200,200,'player'),b=s.addUnit('grizzly',220,200,'wildlife');b.hp=b.maxHp=1e9;w.attackTarget=b.id;
 for(let i=1;i<=7;i++){
  w.eventideCooldown=w.eventideVeil=0;const before=b.hp,from={x:w.x,z:w.z};assert(escapeEventide(s,w,b));
  assert.equal(wizardAttackRange(w),36*2**Math.min(5,i));assert(b.hp<before);assert.equal(w.command,'attack');assert.equal(w.attackTarget,b.id);
  const bolts=s.wizardProjectiles.filter(p=>p.sourceId===w.id);assert.equal(bolts.length,2);assert.deepEqual(bolts[0].from,from);assert.deepEqual(bolts[1].from,{x:w.x,z:w.z});assert.equal(w.reckoningStacks,i*2);
 }
 const r=arena();assert(r.loadSnapshot(s.serialize()));const saved=r.units.find(u=>u.id===w.id);assert.equal(wizardAttackRange(saved),1152);assert.equal(saved.reckoningStacks,14);
 assert(unitStatuses(saved).some(s=>s.id==='eventideAscendancy'));assert(unitStatuses(saved).some(s=>s.id==='loneStarReckoning'));
});
test('consecutive solo hits grow through bear resistance; another attacker and target changes reset the chain',()=>{
 const s=arena(),w=s.addUnit('wizard',100,100,'player'),b=s.addUnit('grizzly',130,100,'wildlife'),ally=s.addUnit('soldier',132,100,'player');b.hp=b.maxHp=1e9;w.eventideRangeStacks=1;
 const hit=()=>s._applyUnitDamage(b,36,w,{magical:true,damageType:'arcane'}).damage;
 const first=hit(),second=hit();assert(first>0&&first<36);assert(Math.abs(second/first-2)<1e-8);
 s._applyUnitDamage(b,1,ally);assert.equal(w.reckoningStacks,0);assert.equal(hit(),first);
 for(let i=0;i<8;i++)hit();assert(hit()>36);
 const other=s.addUnit('grizzly',135,100,'wildlife');s._applyUnitDamage(other,1,w,{magical:true});assert.equal(w.reckoningStacks,1);assert.equal(b.reckoningStacks,0);
});
test('normal Starshards fire during the veil and land far beyond the original range',()=>{
 const s=arena(),w=s.addUnit('wizard',100,100,'player'),b=s.addUnit('grizzly',350,100,'wildlife');w.eventideRangeStacks=5;w.eventideVeil=6;w.command='attack';w.attackTarget=b.id;w.attackTargetKind='unit';b.hp=b.maxHp=1e9;
 for(let i=0;i<360;i++){s.clock+=1/60;s.repathBudgetRemaining=8;updateWizardMagic(s,1/60);s._updateUnit(w,1/60);}
 assert(b.hp<1e9);assert(Math.hypot(w.x-b.x,w.z-b.z)>200);assert(w.reckoningStacks>0);
});
test('blocked escape spends no stack and instant orbs do not hit twice when their visuals arrive',()=>{
 const s=arena(),w=s.addUnit('wizard',100,100,'player'),b=s.addUnit('grizzly',120,100,'wildlife');const blocked=s._pointBlockedForUnit;s._pointBlockedForUnit=()=>true;assert(!escapeEventide(s,w,b));assert(!w.eventideRangeStacks);s._pointBlockedForUnit=blocked;
 assert(escapeEventide(s,w,b));const hp=b.hp,stacks=w.reckoningStacks;for(let i=0;i<30;i++)updateWizardMagic(s,1/60);assert.equal(b.hp,hp);assert.equal(w.reckoningStacks,stacks);
});
