import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { CrownforgeRenderer } from '../src/renderer.js';
import { CrownforgeAtmosphere } from '../src/atmosphere.js';

const calls = [];
const ctx = new Proxy({}, { get: (_, key) => (...args) => {
  calls.push({ key, args });
  if (key === 'createRadialGradient') return { addColorStop() {} };
  if (key === 'drawImage') {
    assert.ok(args.slice(1).every(Number.isFinite), 'all image coordinates are finite');
    assert.ok(args.at(-1) >= 0 && args.at(-2) >= 0, 'effect size cannot be negative');
  }
} });
globalThis.document = { createElement: () => ({ getContext: () => ctx }) };
globalThis.Image = class { addEventListener() {} };

const renderer = Object.create(CrownforgeRenderer.prototype);
Object.assign(renderer, {
  width: 1280, height: 720, camera: { x: 0, y: 0, zoom: CONFIG.initialZoom },
  canvas: { dataset: {} }, ctx,
});
for (const zoom of [CONFIG.minZoom, CONFIG.initialZoom, CONFIG.maxZoom]) {
  renderer.camera.zoom = zoom;
  for (const p of [{ x: 0, z: 0 }, { x: 78, z: 82 }, { x: CONFIG.mapWidth, z: CONFIG.mapHeight }]) {
    const roundTrip = renderer.screenToWorld(renderer.worldToScreen(p));
    assert.ok(Math.hypot(roundTrip.x - p.x, roundTrip.z - p.z) < 1e-9, 'projection preserves placement coordinates');
  }
}
renderer.camera.zoom = CONFIG.initialZoom;
const anchor = { x: 720, y: 410 };
const world = renderer.screenToWorld(anchor);
renderer.zoomAt(1.25, anchor);
assert.ok(Math.hypot(renderer.worldToScreen(world).x - anchor.x, renderer.worldToScreen(world).y - anchor.y) < 1e-7, 'zoom retains cursor anchor');

const atmosphere = new CrownforgeAtmosphere(renderer);
const home = Object.freeze({ id: 7, type: 'homestead', progress: 1 });
const point = Object.freeze({ x: 500, y: 350 });
for (const mode of ['dawn', 'day', 'dusk']) {
  atmosphere.mode = mode;
  atmosphere.drawAir(ctx, 2000);
  const count = calls.filter(c => c.key === 'createRadialGradient').length;
  atmosphere.drawAir(ctx, 3000);
  assert.equal(calls.filter(c => c.key === 'createRadialGradient').length, count, 'lighting gradients remain cached during frames');
  atmosphere.drawHearth(ctx, home, point, 200, 134, 4000);
}
calls.length = 0;
atmosphere.reducedMotion = true;
atmosphere.drawHearth(ctx, home, point, 200, 134, 4000);
assert.equal(calls.filter(c => c.key === 'drawImage').length, 1, 'reduced motion retains steady hearth glow, without smoke or flying embers');
calls.length = 0;
atmosphere.drawHearth(ctx, { ...home, progress: 0.5 }, point, 200, 134, 4000);
atmosphere.drawHearth(ctx, { ...home, destroyed: true }, point, 200, 134, 4000);
assert.equal(calls.length, 0, 'unfinished/destroyed homes never emit hearth effects');
atmosphere.enabled = false;
atmosphere.drawAir(ctx, 4000);
atmosphere.drawClouds(ctx, 4000);
assert.equal(calls.length, 0, 'ambient switch disables the atmosphere layers');

renderer.ripples = [{ world: { x: -99999, z: -99999 }, age: 0, color: '#86c4cf' }];
for (let i = 0; i < 20; i++) renderer.drawRipples(ctx, i * 50, 0.05);
assert.equal(renderer.ripples.length, 0, 'offscreen command effects expire instead of accumulating');
console.log('PASS: camera placement/zoom, cached lighting, reduced motion, hearth lifecycle, atmosphere switch, and offscreen effect cleanup.');
