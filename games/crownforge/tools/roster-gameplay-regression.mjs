import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { CrownforgeSimulation } from '../src/simulation.js';
import { UNIT_TYPES } from '../src/config.js';
const Baseline=process.argv[2]?(await import(pathToFileURL(process.argv[2]))).CrownforgeSimulation:null;
function sandbox(Simulation=CrownforgeSimulation) {
  const game=new Simulation({seed:42});
  game.units=[];game.buildings=[];game.resourcesNodes=[];game.decorations=[];
  game.navigationVersion++;game.staticBlockerGridVersion=-1;
  game._checkVictory=()=>{};game._updateEnemyAI=()=>{};game._updateEnemyIntent=()=>{};
  return game;
}
const gameplay=snapshot=>JSON.parse(JSON.stringify(snapshot,(key,value)=>key.startsWith('animation')||['lastAnimationEvent','workAnimation','workCyclePhase'].includes(key)?undefined:value));
const pair=setup=>[setup(sandbox()),...(Baseline?[setup(sandbox(Baseline))]:[])];
function advance(games,seconds,visit=()=>{}) {
  for(let i=0;i<seconds*20;i++) {
    for(const game of games)game.update(.05);
    visit(games[0]);
    if(games.length===2&&i%20===0)assert.deepEqual(gameplay(games[0].serialize()),gameplay(games[1].serialize()),'Exact gameplay parity with pre-rebuild simulation');
  }
}
for(const [resource,nodeType] of [['wood','tree'],['food','berry'],['stone','stone'],['gold','gold']]) {
  const games=pair(game=>{
    game.addBuilding('ashenCamp',100,100,'player');
    const worker=game.addUnit('ashenForager',108,106,'player'),node=game.addResource(nodeType,resource,115,106,1200,0,{sizeTier:'small'});
    game.selectedIds=[worker.id];assert.equal(game.issueContextCommand(node,node).success,true);return game;
  });
  advance(games,90);assert.ok(games[0].lifetimeGathered[resource]>0,`Ashen worker collects and delivers ${resource}`);
}
const works=pair(game=>{
  game.addBuilding('ashenCamp',100,100,'player');
  const worker=game.addUnit('ashenForager',108,110,'player'),building=game.addBuilding('homestead',115,110,'player',.04);
  game.selectedIds=[worker.id];assert.equal(game.issueContextCommand(building,building).success,true);return game;
});
advance(works,90);assert.equal(works[0].buildings[1].progress,1);
for(const game of works){const b=game.buildings[1];b.hp=b.maxHp*.55;assert.equal(game.issueContextCommand(b,b).success,true);}
advance(works,60);assert.equal(works[0].buildings[1].hp,works[0].buildings[1].maxHp);
const fields=pair(game=>{game.addBuilding('ashenCamp',100,100,'player');game.addUnit('ashenForager',111,111,'player');game.addBuilding('field',116,112,'player');return game;});
const food=fields[0].resources.food;advance(fields,45);assert.ok(fields[0].resources.food>food);
console.log('PASS: Ashen worker harvesting, carrying, delivery, construction, repair, and field work.');

for(const type of ['villager','ashenForager']) {
  const games=pair(game=>{
    const worker=game.addUnit(type,108,110,'player'),building=game.addBuilding('homestead',115,110,'player');
    assert.equal(game._isDemolitionUnit(worker),false,'Current roster uses instant player demolition');
    assert.equal(game.demolishStructures([building]).success,true);return game;
  });
  advance(games,.1);
  assert.ok(!games[0].buildings.length||games[0].buildings[0].destroyed,`${type} preserves instant demolition`);
}
console.log('PASS: instant player demolition and its baseline parity; worker dismantling remains a compatibility animation.');

for(const [type,definition] of Object.entries(UNIT_TYPES)) {
  const games=pair(game=>{
    const u=game.addUnit(type,25,25,'player');game.selectedIds=[u.id];
    assert.equal(game.issueContextCommand({x:38,z:25}).success,true);return game;
  });
  const start=games[0].units[0].x;advance(games,5);assert.ok(games[0].units[0].x>start+1,`${type} moves`);
  for(const game of games) {
    const old=game.serialize(),loaded=sandbox(game.constructor);assert.equal(loaded.loadSnapshot(old),true);
    assert.equal(loaded.units[0].type,type,`${type} save retains identity`);
  }
  if(definition.worker)continue;
  for(const game of games) {
    const u=game.units[0];u.hp=u.maxHp=100000;
    const enemy=game.addBuilding('homestead',u.x+4,u.z,'enemy');enemy.hp=enemy.maxHp=100000;
    game.selectedIds=[u.id];assert.equal(game.issueContextCommand(enemy,enemy).success,true);
  }
  const states=new Set();advance(games,9,game=>states.add(game.units[0].animationState));
  for(const state of ['attack_anticipation','attack_contact','attack_recovery'])assert.ok(states.has(state),`${type} reaches ${state}`);
  assert.ok(games[0].buildings[0].hp<100000,`${type} attack damages target`);
  for(const game of games){const u=game.units[0];game._applyUnitDamage(u,200000,game.buildings[0]);}
  advance(games,.1);assert.ok(games[0].units[0].dead,`${type} death`);assert.equal(games[0].units[0].animationState,'death');
  console.log(`PASS: ${type} movement, attack phases, damage, death and save.`);
}
for(const type of ['raider','ashenOutrider','thornSpear','hearthLevy','hidewall']) {
  const games=pair(game=>{
    const worker=game.addUnit('villager',25,25,'player'),target=game.addUnit(type,30,25,'enemy');
    assert.equal(game._tryApplyVillagerStun(worker,target),true);return game;
  });
  advance(games,.1);assert.equal(games[0].units[1].animationState,'stunned',`${type} actual stun state`);
  const duration=games[0].units[1].stunTimer;advance(games,duration+.2);assert.equal(games[0].units[1].stunTimer,0,`${type} stun releases`);
}
for(const type of ['villager','ashenForager']) {
  const games=pair(game=>{
    const worker=game.addUnit(type,25,25,'player'),attacker=game.addUnit('raider',27,25,'enemy');
    assert.equal(game._applyUnitDamage(worker,999,attacker).warded,true);assert.equal(game._applyUnitDamage(worker,999,attacker).blocked,true);return game;
  });
  advance(games,.1);assert.ok(games[0].units[0].lastLightWardTimer>59);
  const restored=sandbox();assert.equal(restored.loadSnapshot(games[0].serialize()),true);assert.equal(restored.units[0].lastLightWardTimer,games[0].units[0].lastLightWardTimer);
}
console.log('PASS: all five Ashen military stun/release states, both worker wards, and saved-game restoration'+(Baseline?'; exact baseline gameplay/save parity.':'. No external baseline supplied.'));
