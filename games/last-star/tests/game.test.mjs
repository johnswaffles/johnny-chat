import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,PLATFORMS,SEALS,parseSave} from '../src/game.js';
const step=(g,n,input={})=>{for(let i=0;i<n;i++)g.update(1/60,input);};
test('malformed saves are rejected and persisted memory IDs are bounded',()=>{
  for(const v of ['{','null','{}','{"version":1,"checkpoint":99}','{"version":1,"checkpoint":1.4}'])assert.equal(parseSave(v),null);
  assert.deepEqual(parseSave({version:1,checkpoint:2,memories:[0,0,6,'1',2],elapsed:-8}).memories,[0,2]);
});
test('double jump crosses every required chasm and lands on the next ground platform',()=>{
  const grounds=PLATFORMS.filter(f=>!f.upper);
  for(let i=0;i<grounds.length-1;i++){
    const g=new Game();g.enemies=[];g.checkpoint=3;
    const a=grounds[i],b=grounds[i+1];g.player.x=a.x+a.w-55;g.player.y=a.y;
    g.update(1/60,{move:1,jump:true});step(g,19,{move:1});g.update(1/60,{move:1,jump:true});
    let landed=false;
    for(let k=0;k<100;k++){g.update(1/60,{move:1});if(g.player.onGround&&g.player.x>b.x&&g.player.y<=b.y){landed=true;break;}}
    assert.ok(landed,`gap ${i} (${a.x+a.w} → ${b.x}) must be reachable`);
  }
});
test('jump count prevents a third jump until landing',()=>{
  const g=new Game();g.update(1/60,{jump:true});step(g,10);g.update(1/60,{jump:true});step(g,4);const vy=g.player.vy;g.update(1/60,{jump:true});assert.ok(g.player.vy>vy);assert.equal(g.player.jumps,2);
});
test('unsafe teleport spends no cooldown or invulnerability',()=>{
  const g=new Game();g.player.x=1160;g.player.y=850;assert.equal(g.spell('blink'),false);assert.equal(g.player.cooldowns.blink,0);assert.equal(g.player.invuln,0);
});
test('teleport delivers departure and arrival attacks and preserves a safe landing',()=>{
  const g=new Game();g.player.x=1280;g.player.y=560;const enemy=g.enemies[0],before=enemy.hp;assert.equal(g.spell('blink'),true);assert.ok(g.player.x>1280);assert.ok(enemy.hp<before);assert.equal(g.player.rangeStacks,1);assert.ok(g.events.some(e=>e.type==='blink'));
});
test('Astral Mantle protects the health-crossing hit without healing',()=>{
  const g=new Game();g.player.hp=85;g.hurt(30);assert.equal(g.player.hp,76);assert.equal(g.player.mantle,6);assert.equal(g.player.mantleCd,30);
});
test('Reckoning resets on target change and remains bounded for this solo adaptation',()=>{
  const g=new Game();g.player.blinked=true;const [a,b]=g.enemies;a.hp=10000;for(let i=0;i<20;i++)g.damage(a,10);assert.equal(g.chain,4);g.damage(b,10);assert.equal(g.chain,1);assert.equal(b.hp,132);
});
test('seals require order and nearby enemies to be cleared; rest restores resources',()=>{
  const g=new Game();g.player.x=SEALS[1].x;g.player.y=SEALS[1].y;g.interact();assert.equal(g.checkpoint,0);
  g.player.x=SEALS[0].x;g.player.y=SEALS[0].y;g.interact();assert.equal(g.checkpoint,1);
  g.player.x=SEALS[1].x;g.player.y=SEALS[1].y;g.interact();assert.equal(g.checkpoint,1);
  for(const e of g.enemies)if(Math.abs(e.x-g.player.x)<280)e.dead=true;g.player.hp=20;g.interact();assert.equal(g.checkpoint,2);assert.equal(g.player.hp,210);
});
test('checkpoint reload restores location, memories and clears only earlier encounters',()=>{
  const original=new Game();original.checkpoint=2;original.memories.add(1);const copy=new Game(parseSave(JSON.stringify(original.save())));
  assert.equal(copy.player.x,3690);assert.equal(copy.player.y,565);assert.deepEqual([...copy.memories],[1]);assert.ok(copy.enemies[0].dead);assert.ok(!copy.enemies.at(-1).dead);
});
test('constellation applies one AoE impact and costs starlight once',()=>{
  const g=new Game();g.player.x=1320;g.player.y=560;const e=g.enemies[0];assert.equal(g.spell('constellation'),true);assert.equal(g.player.mana,70);assert.equal(g.spell('constellation'),false);step(g,90);assert.equal(e.hp,60);
});
test('Heavenrend unlocks at the second seal and sweeps actual enemies',()=>{
  const g=new Game();g.player.x=4200;g.player.y=580;assert.equal(g.spell('dragon'),false);g.checkpoint=2;assert.equal(g.spell('dragon'),true);assert.equal(g.player.mana,40);step(g,350);assert.ok(g.enemies[6].dead||g.enemies[6].hp<145);assert.ok(g.events.some(e=>e.type==='lightning'));
});
test('fall recovery deducts health, returns to saved ground and cannot leave stale boss projectiles',()=>{
  const g=new Game({checkpoint:2});g.player.y=900;g.update(1/60);assert.equal(g.player.x,3690);assert.equal(g.player.y,565);assert.equal(g.player.hp,175);assert.equal(g.projectiles.length,0);
});
test('boss entrance requires three seals and completion requires the guardian defeated',()=>{
  const g=new Game();g.player.x=7100;g.update(1/60);assert.equal(g.player.x,6870);assert.equal(g.bossStarted,false);
  g.checkpoint=3;g.player.x=7100;g.update(1/60);assert.equal(g.bossStarted,true);
  g.player.x=7750;g.interact();assert.equal(g.state,'playing');const boss=g.enemies.at(-1);g.damage(boss,10000);g.player.x=7730;g.interact();assert.equal(g.state,'won');assert.equal(g.save().completed,true);
});
test('pause and terminal states cannot advance combat',()=>{
  const g=new Game();g.state='dead';const x=g.player.x;step(g,60,{move:1,bolt:true});assert.equal(g.player.x,x);assert.equal(g.time,0);
});
