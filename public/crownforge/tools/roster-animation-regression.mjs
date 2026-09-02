import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { COMBAT_ATLASES, VILLAGER_ATLASES } from '../src/config.js';
import { animationFrame } from '../src/animation.js';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const releaseMarker = '20260902-rosteranimations1';

const roster = [
  { type: 'villager', slug: 'crown-hearthkin', walk: 'motionLoop', attack: 'defenseAttackLoop', death: 'deathLoop', villager: true },
  { type: 'soldier', slug: 'crown-guard', walk: 'soldierWalk', attack: 'soldierAttack', death: 'soldierDeath' },
  { type: 'scout', slug: 'crown-scout', walk: 'scoutWalk', attack: 'scoutAttack', death: 'scoutDeath' },
  { type: 'spearwarden', slug: 'crown-spearwarden', walk: 'spearwardenWalk', attack: 'spearwardenAttack', death: 'spearwardenDeath' },
  { type: 'militia', slug: 'crown-militia', walk: 'militiaWalk', attack: 'militiaAttack', death: 'militiaDeath' },
  { type: 'shieldbearer', slug: 'crown-shieldbearer', walk: 'shieldbearerWalk', attack: 'shieldbearerAttack', death: 'shieldbearerDeath' },
  { type: 'ashenForager', slug: 'ashen-hearthkin', walk: 'ashenForagerWalk', attack: 'ashenForagerAttack', death: 'ashenForagerDeath' },
  { type: 'raider', slug: 'ashen-raider', walk: 'raiderWalk', attack: 'raiderAttack', death: 'raiderDeath' },
  { type: 'ashenOutrider', slug: 'ashen-outrider', walk: 'ashenOutriderWalk', attack: 'ashenOutriderAttack', death: 'ashenOutriderDeath' },
  { type: 'thornSpear', slug: 'thorn-spear', walk: 'thornSpearWalk', attack: 'thornSpearAttack', death: 'thornSpearDeath' },
  { type: 'hearthLevy', slug: 'hearth-levy', walk: 'hearthLevyWalk', attack: 'hearthLevyAttack', death: 'hearthLevyDeath' },
  { type: 'hidewall', slug: 'ashen-hidewall', walk: 'hidewallWalk', attack: 'hidewallAttack', death: 'hidewallDeath' },
];

function atlasFor(unit, key) {
  return unit.villager ? VILLAGER_ATLASES[key] : COMBAT_ATLASES[key];
}

function pngDimensions(file) {
  const header = fs.readFileSync(file).subarray(0, 24);
  assert.deepEqual([...header.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${file} is a PNG`);
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

for (const unit of roster) {
  for (const [animation, key, columns] of [
    ['walk', unit.walk, 3],
    ['attack', unit.attack, 3],
    ['death', unit.death, 4],
  ]) {
    const atlas = atlasFor(unit, key);
    assert.ok(atlas, `${unit.type} ${animation} atlas is registered`);
    assert.match(atlas.src, new RegExp(`crownforge-roster-v1-${unit.slug}-${animation}\\.png\\?v=${releaseMarker}$`));
    assert.equal(atlas.columns, columns, `${unit.type} ${animation} column count`);
    assert.equal(atlas.rows, 4, `${unit.type} ${animation} direction count`);
    assert.deepEqual(atlas.directionRows, [0, 1, 2, 3], `${unit.type} ${animation} direction order`);
    const file = path.resolve(root, atlas.src.replace(/^\.\//, '').split('?')[0]);
    assert.ok(fs.existsSync(file), `${unit.type} ${animation} atlas exists`);
    assert.deepEqual(pngDimensions(file), { width: columns * 360, height: 1448 }, `${unit.type} ${animation} dimensions`);
  }

  for (let direction = 0; direction < 4; direction += 1) {
    const walkColumns = [0.01, 0.34, 0.66].map((time) => animationFrame(unit.type, 'walk', time, direction).column);
    assert.deepEqual(walkColumns, [0, 1, 2], `${unit.type} direction ${direction} ordered stride`);
    const walk = animationFrame(unit.type, 'walk', 0.37, direction);
    assert.equal(walk.atlasKey, unit.walk);
    assert.equal(walk.row, direction);
    assert.equal(walk.frameCount, 3);

    for (const [state, column] of [
      ['attack_anticipation', 0],
      ['attack_contact', 1],
      ['attack_recovery', 2],
    ]) {
      const attack = animationFrame(unit.type, state, 0.22, direction);
      assert.equal(attack.atlasKey, unit.attack, `${unit.type} ${state} atlas`);
      assert.equal(attack.row, direction, `${unit.type} ${state} direction`);
      assert.equal(attack.column, column, `${unit.type} ${state} phase`);
    }

    const deathColumns = [0.01, 0.25, 0.49, 0.73].map((time) => animationFrame(unit.type, 'death', time, direction).column);
    assert.deepEqual(deathColumns, [0, 1, 2, 3], `${unit.type} direction ${direction} ordered death`);
    const heldDeath = animationFrame(unit.type, 'death', 5, direction);
    assert.equal(heldDeath.atlasKey, unit.death);
    assert.equal(heldDeath.row, direction);
    assert.equal(heldDeath.column, 3, `${unit.type} holds its fallen pose until removal`);
    assert.equal(heldDeath.loop, false);
  }
}

console.log(`Verified ${roster.length} units, 36 production atlases, and all 4 directional animation mappings.`);
