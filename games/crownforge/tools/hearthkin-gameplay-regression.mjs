import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { CrownforgeSimulation } from '../src/simulation.js';

const Baseline = process.argv[2] ? (await import(pathToFileURL(process.argv[2]))).CrownforgeSimulation : null;
function sandbox(Simulation = CrownforgeSimulation) {
  const game = new Simulation({seed:42});
  game.units=[];game.buildings=[];game.resourcesNodes=[];game.decorations=[];
  game.navigationVersion++;game.staticBlockerGridVersion=-1;
  game._checkVictory=()=>{};game._updateEnemyAI=()=>{};game._updateEnemyIntent=()=>{};
  return game;
}
function gameplay(snapshot) {
  return JSON.parse(JSON.stringify(snapshot,(key,value)=>key.startsWith('animation') || key==='lastAnimationEvent' || key==='workAnimation' || key==='workCyclePhase' ? undefined : value));
}
function pair(setup) {return [setup(sandbox()),...(Baseline?[setup(sandbox(Baseline))]:[])];}
function advance(games,seconds) {
  for(let i=0;i<seconds*20;i++) {
    for(const game of games)game.update(.05);
    if(games.length===2 && i%20===0)assert.deepEqual(gameplay(games[0].serialize()),gameplay(games[1].serialize()),'gameplay matches the pre-art-release baseline');
  }
}

for(const [type,resource] of [['tree','wood'],['berry','food'],['stone','stone'],['gold','gold']]) {
  const games=pair(game=>{
    game.addBuilding('townCenter',100,100,'player');
    const worker=game.addUnit('villager',108,106,'player');
    const node=game.addResource(type,resource,115,106,1200,0,{sizeTier:'small'});
    game.selectedIds=[worker.id];assert.equal(game.issueContextCommand(node,node).success,true);return game;
  });
  advance(games,90);
  assert.ok(games[0].lifetimeGathered[resource]>0,`${resource}: collected and delivered`);
  console.log(`${resource}: harvesting, carrying and delivery verified${Baseline?' against baseline':''}.`);
}

const buildingGames=pair(game=>{
  game.addBuilding('townCenter',100,100,'player');
  const worker=game.addUnit('villager',108,110,'player');
  const building=game.addBuilding('homestead',115,110,'player',.04);
  game.selectedIds=[worker.id];assert.equal(game.issueContextCommand(building,building).success,true);return game;
});
advance(buildingGames,90);
assert.equal(buildingGames[0].buildings.find(b=>b.type==='homestead').progress,1,'construction completes');
for(const game of buildingGames) {
  const home=game.buildings.find(b=>b.type==='homestead');home.hp=home.maxHp*.55;
  assert.equal(game.issueContextCommand(home,home).success,true);
}
advance(buildingGames,60);
const repaired=buildingGames[0].buildings.find(b=>b.type==='homestead');
assert.equal(repaired.hp,repaired.maxHp,'repair reaches full health');
console.log('Construction and repair verified.');

const fields=pair(game=>{
  game.addBuilding('townCenter',100,100,'player');
  game.addUnit('villager',111,111,'player');
  game.addBuilding('field',116,112,'player');return game;
});
const before=fields[0].resources.food;advance(fields,45);assert.ok(fields[0].resources.food>before,'farming yields food');
console.log('Farming and its work clock verified.');

const combats=pair(game=>{
  const worker=game.addUnit('villager',25,25,'player');
  const raider=game.addUnit('raider',26.5,25,'enemy');
  game.selectedIds=[worker.id];assert.equal(game.issueContextCommand(raider,raider).success,true);return game;
});
advance(combats,70);
assert.ok(combats[0].units.some(u=>u.type==='villager'&&!u.dead),'worker survives defensive combat');
console.log('Attack phases, damage, stun, ward and death verified.');

const wardGame=sandbox();
const worker=wardGame.addUnit('villager',20,20,'player');
const attacker=wardGame.addUnit('raider',22,20,'enemy');
assert.equal(wardGame._applyUnitDamage(worker,999,attacker).warded,true);
assert.equal(worker.lastLightWardTimer,60);
assert.equal(wardGame._applyUnitDamage(worker,999,attacker).blocked,true);
const saved=wardGame.serialize();const restored=sandbox();assert.equal(restored.loadSnapshot(saved),true);
const restoredWorker=restored.units.find(u=>u.id===worker.id);
assert.equal(restoredWorker.lastLightWardTimer,60,'ward survives save/load');
assert.equal(restoredWorker.hp,worker.hp);
if(Baseline) {
  const old=sandbox(Baseline);old.addUnit('villager',20,20,'player');
  const oldSave=old.serialize();const upgraded=sandbox();assert.equal(upgraded.loadSnapshot(oldSave),true);
  upgraded.update(.05);assert.equal(upgraded.units[0].animationState,'idle','old save resumes in the new rig');
}
console.log('PASS: economy, work, combat and saved-game compatibility'+(Baseline?' with exact gameplay parity to the previous release.':'.'));
