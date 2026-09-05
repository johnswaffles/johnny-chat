import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHARACTER_RIGS, createCharacterRigs } from '../src/character-rigs.js';
import { CrownforgeRenderer } from '../src/renderer.js';
import { COMBAT_ATLASES, VILLAGER_ATLASES } from '../src/config.js';

class PendingImage {
  static instances = [];
  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
    PendingImage.instances.push(this);
  }
  addEventListener() {}
}
globalThis.Image = PendingImage;
const context = () => ({
  createRadialGradient: () => ({ addColorStop() {} }),
  fillRect() {}, setTransform() {},
});
const canvas = () => ({
  getContext: context,
  getBoundingClientRect: () => ({ width: 1, height: 1 }),
});
globalThis.document = { createElement: canvas };
globalThis.window = { location: { search: '' }, devicePixelRatio: 1 };
globalThis.ResizeObserver = class { observe() {} };
const loaded = image => { image.complete = true; image.naturalWidth = 128; };

test('lazy registry requests only its own type while studio default remains eager', () => {
  const start = PendingImage.instances.length;
  const lazy = createCharacterRigs({ lazy: true });
  assert.equal(lazy.size, 0);
  for (const type of Object.keys(CHARACTER_RIGS)) assert.equal(lazy.has(type), true);
  assert.equal(PendingImage.instances.length, start, 'membership checks must not request images');
  const outrider = lazy.get('ashenOutrider');
  assert.equal(outrider.definition.id, 'ashenOutrider');
  assert.equal(lazy.size, 1);
  assert.equal(lazy.get('ashenOutrider'), outrider, 'repeated access reuses the same rig');
  assert.equal(lazy.get('unknown-character'), undefined);
  assert.equal(lazy.has('unknown-character'), false);
  assert.deepEqual([...lazy.keys()], ['ashenOutrider']);
  const eager = createCharacterRigs();
  assert.equal(eager.size, Object.keys(CHARACTER_RIGS).length);
  for (const [type, rig] of eager) assert.equal(rig.definition.id, type);
});

test('production opening waits for active types and keeps replaced atlases off the network', () => {
  const start = PendingImage.instances.length;
  const renderer = new CrownforgeRenderer(canvas());
  const requests = PendingImage.instances.slice(start).map(image => image.src);
  assert.deepEqual([...renderer.characterRigs.keys()], ['villager']);
  assert.ok(requests.includes(VILLAGER_ATLASES.statusEffects.src), 'status effects remain available');
  for (const atlas of Object.values(COMBAT_ATLASES)) {
    assert.ok(!requests.includes(atlas.src), `replaced atlas requested: ${atlas.src}`);
  }
  const simulation = {
    units: ['villager', 'villager', 'soldier', 'ashenForager', 'raider'].map(type => ({ type })),
    buildings: [],
  };
  assert.equal(renderer.startupReadiness(simulation).ready, false);
  assert.deepEqual([...renderer.characterRigs.keys()].sort(), ['villager', 'soldier', 'ashenForager', 'raider'].sort());
  PendingImage.instances.forEach(loaded);
  assert.equal(renderer.startupReadiness(simulation).ready, true);
  const failed = renderer.characterRigs.get('raider').images.front;
  failed.naturalWidth = 0;
  assert.equal(renderer.startupReadiness(simulation).ready, false, 'failed active art cannot be hidden by a fallback');
  loaded(failed);
  assert.equal(renderer.startupReadiness(simulation).ready, true);
});

test('training warms exact queued art without holding startup or changing the queue', () => {
  const renderer = new CrownforgeRenderer(canvas());
  const simulation = { units: [{ type: 'villager' }], buildings: [] };
  renderer.startupReadiness(simulation);
  PendingImage.instances.forEach(loaded);
  simulation.buildings.push(
    { productionQueue: [{ type: 'scout', elapsed: 2 }] },
    { destroyed: true, productionQueue: [{ type: 'hidewall', elapsed: 0 }] },
  );
  const before = JSON.stringify(simulation);
  assert.equal(renderer.startupReadiness(simulation).ready, true, 'queued art is not needed in the opening scene');
  assert.equal(JSON.stringify(simulation), before);
  assert.deepEqual([...renderer.characterRigs.keys()], ['villager', 'scout']);
  const scout = renderer.characterRigs.get('scout');
  assert.ok(scout.readiness().some(image => !image.complete));
  let drawn = null;
  scout.draw = () => { drawn = 'scout'; return true; };
  renderer.hearthkinRig.draw = () => { throw new Error('wrong-character fallback'); };
  assert.equal(renderer.drawVillagerAsset(null, { type: 'scout' }, {}, 120), false);
  assert.equal(drawn, null, 'incomplete art cannot draw partial limbs or the wrong character');
  scout.readiness().forEach(loaded);
  assert.equal(renderer.drawVillagerAsset(null, { type: 'scout' }, {}, 120), true);
  assert.equal(drawn, 'scout');
});

test('a restored current type is required even when absent from the opening roster', () => {
  const renderer = new CrownforgeRenderer(canvas());
  const simulation = { units: [{ type: 'villager' }], buildings: [] };
  renderer.startupReadiness(simulation);
  PendingImage.instances.forEach(loaded);
  simulation.units.push({ type: 'ashenOutrider' });
  assert.equal(renderer.startupReadiness(simulation).ready, false);
  const outrider = renderer.characterRigs.get('ashenOutrider');
  assert.equal(outrider.definition.id, 'ashenOutrider');
  assert.equal(outrider.definition.family, 'mounted');
  outrider.readiness().forEach(loaded);
  assert.equal(renderer.startupReadiness(simulation).ready, true);
});
