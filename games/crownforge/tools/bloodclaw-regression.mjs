import {strikeDamage} from '../src/unit-status.js';
import {updateTeams} from '../src/combat-teams.js';
import {test} from 'node:test';import assert from 'node:assert/strict';
import {CrownforgeSimulation} from '../src/simulation.js';
import {engagedEnemies,seamlessCombatBuffer,CombatMusic} from '../src/combat-music.js';
const arena=()=>{const s=new CrownforgeSimulation({seed:42});s.units=[];s.buildings=[];s.resourcesNodes=[];s.decorations=[];s.navigationVersion++;return s;};
test('shield dodges exactly five of one hundred incoming strikes',()=>{const s=arena(),t=s.addUnit('shieldbearer',100,100,'player'),b=s.addUnit('grizzly',108,100,'wildlife');let dodges=0;for(let i=0;i<100;i++)if(s._applyUnitDamage(t,1,b).dodged)dodges++;assert.equal(dodges,5);});
test('Bloodclaw leaves rear DPS at ten percent, never heals, and respects cooldown and wards',()=>{
 const s=arena(),b=s.addUnit('grizzly',100,100,'wildlife'),t=s.addUnit('shieldbearer',107,100,'player'),d=s.addUnit('soldier',93,100,'player'),h=s.addUnit('villager',88,100,'player');b.hp=90;
 s._startAttackCycle(b,t);s._applyGrizzlyCleave(b,t);assert.equal(d.hp,d.maxHp*.1);assert.equal(h.hp,h.maxHp);assert(b.animationEvents.some(e=>e.name==='bear_special_swipe'));
 d.hp=d.maxHp;s.clock=7.99;s._applyGrizzlyCleave(b,t);assert.equal(d.hp,d.maxHp);s.clock=8;d.hp=3;s._applyGrizzlyCleave(b,t);assert.equal(d.hp,3);
 s.clock=16;d.hp=d.maxHp;d.lastLightWardTimer=20;s._applyGrizzlyCleave(b,t);assert.equal(d.hp,d.maxHp);
});
test('encounter music tracks multiple enemies until all die, including future bosses',()=>{
 const t={id:1,hp:100,faction:'player',attackTarget:2},b={id:2,hp:100,type:'grizzly'},boss={id:3,hp:100,boss:true,attackTarget:1},sim={units:[t,b,boss]};
 assert.deepEqual([...engagedEnemies(sim)].sort(),[2,3]);const owner={music:{volume:.5},musicVolume:.5,notify(){}};const music=new CombatMusic(owner);music.sync(sim);assert(music.active);t.attackTarget=null;boss.attackTarget=null;music.sync(sim);assert(music.active);b.dead=true;music.sync(sim);assert(music.active);boss.dead=true;music.sync(sim);assert(!music.active);
});
const buffer=(channels,length,sampleRate)=>({numberOfChannels:channels,length,sampleRate,data:Array.from({length:channels},()=>new Float32Array(length)),getChannelData(c){return this.data[c];}});
test('decoded loop removes silent ends and joins through a continuous crossfade',()=>{
 const input=buffer(2,4000,1000);for(const channel of input.data)for(let i=500;i<3500;i++)channel[i]=.25+Math.sin(i/100)*.02;
 const out=seamlessCombatBuffer({createBuffer:buffer},input);assert.equal(out.length,2800);for(const data of out.data){assert(data[0]>.2&&data.at(-1)>.2);assert(Math.abs(data[0]-data.at(-1))<.001);assert(data.every(v=>v>.2));}
});
test('combat crossfade finishes both ways and retires its loop after victory',()=>{
 const owner={music:{volume:.58},musicVolume:.58,unlocked:true,musicMuted:false,notify(){}},music=new CombatMusic(owner);let stopped=0;
 music.context={currentTime:0,createBufferSource:()=>({connect(){},start(){},stop(){stopped++;},disconnect(){}})};music.gain={gain:{setTargetAtTime(v){this.value=v;}}};music.buffer={};
 const sim={units:[{id:1,hp:100,faction:'player',attackTarget:2},{id:2,hp:100,type:'grizzly'}]};
 for(let i=0;i<30;i++){music.lastTime=performance.now()-100;music.sync(sim);}
 assert.equal(music.mix,1);assert(music.source.loop);assert(owner.music.volume<1e-6);assert.equal(music.gain.gain.value,.58);
 owner.musicMuted=true;music.sync(sim);assert.equal(music.gain.gain.value,0);owner.musicMuted=false;
 sim.units[1].dead=true;for(let i=0;i<30;i++){music.lastTime=performance.now()-100;music.sync(sim);}
 assert.equal(music.mix,0);assert.equal(owner.music.volume,.58);assert.equal(stopped,1);assert.equal(music.source,null);
});

test('half-health bear damage outpaces the halved healer output visibly',()=>{
 const s=arena(),b=s.addUnit('grizzly',100,100,'wildlife'),t=s.addUnit('shieldbearer',107,100,'player'),h=s.addUnit('villager',88,100,'player');b.hp=90;t.teamId=h.teamId=1;
 for(let i=0;i<10;i++){s._applyUnitDamage(t,strikeDamage(b,t),b);updateTeams(s,2);}
 assert(t.hp<t.maxHp*.75);assert(t.hp>0);assert(Math.abs(t.hp-(3480-10*(139.2-40)))<1e-6);
});
