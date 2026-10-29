// Local, opt-in integration fixture. Never imported by the player route.
const frame = document.querySelector('#game-frame');
const runButton = document.querySelector('#run');
const status = document.querySelector('#status');
const output = document.querySelector('#results');
const report = document.querySelector('#report');
const sizes = [
  ['small phone landscape', 568, 320],
  ['iPhone SE landscape size', 667, 375],
  ['iPhone landscape size', 844, 390],
  ['large iPhone landscape size', 932, 430],
  ['Android landscape size', 800, 360],
  ['landscape with browser chrome', 844, 250],
];
const storageKeys = ['crownforge-last-star-level1-preview-v1-qa', 'crownforge-last-star-level1-preview-v1-qa-bindings', 'crownforge-last-star-level1-preview-v1-settings'];
let records = [], runtimeErrors = [], nextPointer = 1;
const held = new Map();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const nextFrame = () => new Promise(resolve => win().requestAnimationFrame(resolve));
const win = () => frame.contentWindow;
const doc = () => frame.contentDocument;
const api = () => win().__lastStar;
const byId = id => doc().getElementById(id);
const shown = el => Boolean(el && el.getClientRects().length && win().getComputedStyle(el).visibility !== 'hidden');
function check(condition, label, evidence = '') {
  const result = {pass: Boolean(condition), label, evidence};
  records.push(result);
  const item = document.createElement('li');
  item.className = result.pass ? 'pass' : 'fail';
  item.textContent = `${result.pass ? 'PASS' : 'FAIL'} · ${label}${evidence ? ` — ${evidence}` : ''}`;
  output.append(item);
  return result.pass;
}
async function until(predicate, label, timeout = 5000) {
  const end = performance.now() + timeout;
  while (!predicate()) {
    if (performance.now() > end) throw new Error(`Timed out: ${label}`);
    await sleep(25);
  }
}
async function load(touch = true, scene = '') {
  held.clear();
  const loaded = new Promise(resolve => frame.addEventListener('load', resolve, {once: true}));
  frame.src = `../index.html?qa${touch ? '&touch=1' : ''}${scene}`;
  await Promise.race([loaded, sleep(60000).then(() => { throw new Error('Game document did not load'); })]);
  await until(() => api() && !byId('begin').disabled, 'game artwork and QA API', 60000);
  byId('qa-panel').hidden = true;
  win().addEventListener('error', e => runtimeErrors.push(e.message));
  win().addEventListener('unhandledrejection', e => runtimeErrors.push(String(e.reason)));
  await sleep(150);
}
async function viewport(width, height) {
  frame.style.width = `${width}px`;
  frame.style.height = `${height}px`;
  await until(() => win().innerWidth === width && win().innerHeight === height, 'iframe viewport resize');
  await sleep(160);
}
function button(action) {
  const element = doc().querySelector(`[data-touch-action="${action}"]`);
  if (!element) throw new Error(`Missing touch control: ${action}`);
  return element;
}
function pointer(element, type, pointerId, outside = false) {
  const rect = element.getBoundingClientRect();
  const event = new (win().PointerEvent)(type, {
    bubbles: true, cancelable: true, pointerId, pointerType: 'touch',
    isPrimary: false, button: 0, buttons: type === 'pointerdown' ? 1 : 0,
    clientX: outside ? -10 : rect.left + rect.width / 2,
    clientY: outside ? -10 : rect.top + rect.height / 2,
  });
  (outside ? win() : element).dispatchEvent(event);
}
function down(action) {
  const element = button(action), id = nextPointer++;
  pointer(element, 'pointerdown', id);
  held.set(id, element);
  return id;
}
function up(id, type = 'pointerup', outside = false) {
  const element = held.get(id);
  if (!element) return;
  pointer(element, type, id, outside);
  held.delete(id);
}
function tap(action) { const id = down(action); up(id); }
function releaseAll() { for (const id of [...held.keys()]) up(id, 'pointercancel'); }
async function fresh() {
  releaseAll();
  api().start(false);
  for (const enemy of api().game.enemies) enemy.dead = true;
  api().game.player.invuln = 10000;
  await sleep(140);
}
function fits(el, width, height, minimum = 0) {
  if (!shown(el)) return false;
  const r = el.getBoundingClientRect();
  return r.left >= -1 && r.top >= -1 && r.right <= width + 1 && r.bottom <= height + 1 && r.width >= minimum && r.height >= minimum;
}
function overlap(a, b) {
  return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
}
function rectText(el) {
  const r = el.getBoundingClientRect();
  return `${Math.round(r.width)}×${Math.round(r.height)} at ${Math.round(r.x)},${Math.round(r.y)}`;
}
async function geometry(label, width, height) {
  await viewport(width, height);
  // Each title is checked from a new run to avoid a prior resize-pause overlay.
  api().start(false);
  byId('pause-button').click();
  byId('back-title').click();
  await sleep(120);
  check(fits(byId('begin'), width, height, 40), `${label}: Begin is visible and reachable`, rectText(byId('begin')));
  await fresh();
  const canvas = byId('world').getBoundingClientRect();
  check(Math.abs(canvas.width - width) < 2 && Math.abs(canvas.height - height) < 2,
    `${label}: canvas fills viewport`, `${width}×${height}; canvas ${Math.round(canvas.width)}×${Math.round(canvas.height)}`);
  check(Math.abs(api().renderer.w / 720 - canvas.width / canvas.height) < .02,
    `${label}: world aspect ratio preserved`);
  check(doc().documentElement.scrollWidth <= width + 1 && doc().documentElement.scrollHeight <= height + 1,
    `${label}: no page overflow`);
  const actions = ['left', 'right', 'jump', 'bolt', 'blink', 'use', 'ring'];
  const targets = actions.map(button);
  check(Math.abs(button('left').getBoundingClientRect().left - 4) < 1 && Math.abs(width - button('jump').getBoundingClientRect().right - 4) < 1 && Math.abs(height - button('jump').getBoundingClientRect().bottom - 4) < 1, `${label}: controls sit 4px from the sides and bottom on a flat viewport`);
  check(targets.every(el => fits(el, width, height, 44)), `${label}: all seven touch targets are at least 44px and inside screen`,
    actions.map((action, i) => `${action} ${rectText(targets[i])}`).join('; '));
  check(targets.every((a, i) => targets.slice(i + 1).every(b => !overlap(a.getBoundingClientRect(), b.getBoundingClientRect()))),
    `${label}: touch targets do not overlap`);
  check(fits(byId('pause-button'), width, height, 44), `${label}: Pause has a reachable 44px target`);
  tap('ring');
  await until(() => shown(byId('selection-ring')), 'touch magic selector');
  check([...doc().querySelectorAll('[data-item]')].every(el => fits(el, width, height, 44)),
    `${label}: every magic choice fits and is reachable`);
  doc().querySelector('[data-item="frost"]').click();
  await until(() => !shown(byId('selection-ring')), 'selector closes after equip');
}
async function inputChecks() {
  await viewport(844, 390);
  await fresh();
  const game = api().game, p = game.player, x = p.x, y = p.y;
  const move = down('right'), cast = down('bolt');
  tap('jump');
  await until(() => p.x > x + 10 && p.y < y - 10 && p.cooldowns.bolt > 0, 'first simultaneous movement, jump and cast');
  check(p.x > x + 10 && p.y < y - 10 && p.cooldowns.bolt > 0, 'Three fingers move, cast, and jump together',
    `x ${x.toFixed(1)}→${p.x.toFixed(1)}; y ${y.toFixed(1)}→${p.y.toFixed(1)}; staff cooldown ${p.cooldowns.bolt.toFixed(2)}`);
  const firstJump = {x: p.x, y: p.y, jumps: p.jumps, vy: p.vy, time: game.time};
  tap('jump');
  await nextFrame(); await nextFrame();
  check(p.jumps === 2 && p.vy < 0, 'Second jump tap produces a double jump while movement and cast remain held',
    JSON.stringify({firstJump, secondJump: {x: p.x, y: p.y, jumps: p.jumps, vy: p.vy, time: game.time}}));
  up(cast);
  const before = p.x;
  await sleep(140);
  check(p.x > before + 10, 'Releasing attack does not release movement');
  up(move, 'pointerup', true);
  await sleep(250);
  const stopped = p.x;
  await sleep(180);
  check(Math.abs(p.x - stopped) < .5, 'Releasing movement outside the control stops movement');

  for (const cancellation of ['pointercancel', 'lostpointercapture']) {
    await fresh();
    const id = down('right');
    await sleep(90);
    up(id, cancellation);
    await sleep(250);
    const still = api().game.player.x;
    await sleep(160);
    check(Math.abs(api().game.player.x - still) < .5, `${cancellation} clears held movement`);
  }
  await fresh();
  const id1 = down('right'), id2 = down('right');
  up(id1);
  const twoFingerStart = api().game.player.x;
  await sleep(130);
  check(api().game.player.x > twoFingerStart + 10, 'Two fingers on one action stay held until the final release');
  up(id2);

  await fresh();
  tap('jump');
  await sleep(90);
  check(api().game.player.jumps === 1 && api().game.player.y < 570, 'A complete tap between frames is buffered');
  await zeroStepCast();
  await fresh();
  const blinkStart = api().game.player.x;
  tap('blink');
  await sleep(120);
  check(api().game.player.x > blinkStart + 90 && api().game.player.cooldowns.blink > 0, 'Touch Eventide executes the existing safe-ground blink');

  await fresh();
  const inventory = api().game.inventory;
  inventory.charges.frost = 3;
  tap('ring');
  await until(() => shown(byId('selection-ring')), 'open magic selector');
  doc().querySelector('[data-item="frost"]').click();
  await until(() => inventory.equipped === 'frost' && !shown(byId('selection-ring')), 'equip Frost Fan');
  check(inventory.charges.frost === 3 && api().game.projectiles.length === 0, 'Choosing magic equips without consuming or casting');
  tap('use');
  await sleep(100);
  check(inventory.charges.frost === 2 && api().game.projectiles.filter(p => p.kind === 'frost').length === 5,
    'Separate Use tap consumes one charge and casts the existing five-shard Frost Fan');
  await sleep(500);
  inventory.equipped = 'flask'; inventory.charges.flask = 2;
  api().game.player.hp = 210;
  tap('use');
  await sleep(120);
  check(inventory.charges.flask === 2, 'Healing Flask at full health does not consume a charge');
  api().game.player.hp = 100;
  tap('use');
  await sleep(120);
  check(inventory.charges.flask === 1 && api().game.player.hp === 165, 'Healing Flask heals and spends exactly one charge');

  await fresh();
  tap('ring');
  await until(() => shown(byId('selection-ring')), 'touch selector before keyboard takeover');
  const takeoverX = api().game.player.x;
  const takeoverCharges = JSON.stringify(api().game.inventory.charges);
  key('keydown', 'KeyD');
  await until(() => api().game.player.x > takeoverX + 10, 'keyboard movement after touch selector');
  check(!shown(byId('selection-ring')) && api().game.projectiles.length === 0 && JSON.stringify(api().game.inventory.charges) === takeoverCharges,
    'Keyboard takeover closes the touch selector and moves without spending or casting');
  key('keyup', 'KeyD');

  await fresh();
  const hold = down('right');
  await sleep(80);
  byId('pause-button').click();
  await until(() => api().mode === 'pause', 'pause');
  const pauseX = api().game.player.x, pauseTime = api().game.time;
  await sleep(200);
  check(api().game.player.x === pauseX && api().game.time === pauseTime && !shown(byId('touch-controls')), 'Pause freezes the world and hides touch controls');
  byId('touch-resume').click();
  await until(() => api().mode === 'playing', 'quick resume');
  await sleep(260);
  const resumeX = api().game.player.x;
  await sleep(160);
  check(Math.abs(api().game.player.x - resumeX) < .5, 'Resume does not reactivate a finger held before pause',
    `paused x ${pauseX.toFixed(2)}, settled x ${resumeX.toFixed(2)}, later x ${api().game.player.x.toFixed(2)}, velocity ${api().game.player.vx.toFixed(2)}`);
  up(hold);

  await fresh();
  down('right');
  await sleep(70);
  win().dispatchEvent(new (win().Event)('blur'));
  await sleep(120);
  check(api().mode === 'pause' && !shown(byId('touch-controls')), 'Focus loss pauses play and clears touch controls');
  releaseAll();

  await fresh();
  down('right');
  await viewport(390, 844);
  check(api().mode === 'pause' && shown(byId('rotate-screen')) && !shown(byId('touch-controls')),
    'Portrait rotation pauses play, shows rotate guidance, and disables controls');
  key('keydown', 'Escape'); key('keyup', 'Escape');
  byId('resume').click();
  await sleep(100);
  check(api().mode !== 'playing' && !shown(byId('touch-controls')), 'Escape and the original Resume button cannot unpause behind portrait guidance');
  const portraitTime = api().game.time;
  await sleep(200);
  check(api().game.time === portraitTime, 'Combat stays paused in portrait');
  await viewport(844, 390);
  check(api().mode === 'pause' && !shown(byId('rotate-screen')), 'Returning to landscape waits for explicit resume');
  byId('touch-resume').click();
  await until(() => api().mode === 'playing', 'resume after rotation');
  await sleep(240);
  const rotatedX = api().game.player.x;
  await sleep(120);
  check(Math.abs(api().game.player.x - rotatedX) < .5, 'Rotation does not leave movement stuck');
  releaseAll();

  await fresh();
  api().game.player.x = 820; api().game.player.y = 580;
  await sleep(130);
  check(shown(button('interact')), 'Starseal interaction control appears nearby');
  tap('interact');
  await until(() => api().game.checkpoint === 1, 'restore first starseal');
  check(api().game.checkpoint === 1, 'Touch interaction restores the existing first starseal');
  api().game.player.invuln = 0;
  api().game.hurt(1000);
  await until(() => api().mode === 'dead', 'death screen');
  check(shown(byId('retry')) && !shown(byId('touch-controls')), 'Death shows Retry and clears touch controls');
  byId('retry').click();
  await until(() => api().mode === 'playing', 'retry');
  check(api().game.checkpoint === 1 && Math.abs(api().game.player.x - 820) < 2 && api().game.player.hp === 210,
    'Retry restores the checkpoint and health');
  check(api().game.inventory.charges.frost === 0 && api().game.arcade.score === 0, 'Retry resets run inventory and score');

  byId('pause-button').click();
  for (const id of ['gentle', 'reduced-flash']) { byId(id).checked = true; byId(id).dispatchEvent(new (win().Event)('change')); }
  check(api().renderer.gentle && api().renderer.reducedFlash, 'Gentle and reduced-flash settings remain functional');
  const modal = byId('pause-screen').querySelector('.modal');
  check(modal.scrollHeight > modal.clientHeight && /auto|scroll/.test(win().getComputedStyle(modal).overflowY), 'Long settings remain scrollable at phone height');
}
async function simulatedSafeAreas() {
  for (const [width, height] of [[568, 320], [844, 390]]) {
    await viewport(width, height);
    await fresh();
    const root = byId('game');
    const original = root.getAttribute('style');
    try {
      root.style.setProperty('--safe-left', '44px');
      root.style.setProperty('--safe-right', '44px');
      root.style.setProperty('--safe-bottom', '21px');
      root.style.setProperty('--control-left', '44px');
      root.style.setProperty('--control-right', '44px');
      root.style.setProperty('--control-bottom', '21px');
      await nextFrame();
      const targets = ['left', 'right', 'jump', 'bolt', 'blink', 'use', 'ring'].map(button);
      const rects = targets.map(el => el.getBoundingClientRect());
      check(targets.every(el => fits(el, width, height, 44)) && rects.every(r => r.left >= 43 && r.right <= width - 43 && r.bottom <= height - 20),
        `Simulated safe areas at ${width}×${height}: controls respect 44px side / 21px bottom insets`);
      check(rects.every((a, i) => rects.slice(i + 1).every(b => !overlap(a, b))),
        `Simulated safe areas at ${width}×${height}: targets remain separate`);
      const pause = byId('pause-button').getBoundingClientRect();
      check(fits(byId('pause-button'), width, height, 44) && pause.right <= width - 43,
        `Simulated safe areas at ${width}×${height}: Pause respects right inset`);
    } finally {
      if (original === null) root.removeAttribute('style'); else root.setAttribute('style', original);
    }
  }
}
async function zeroStepCast() {
  await fresh();
  // Own the game's next RAF briefly to force a render frame with exactly zero
  // simulation time. This reproduces lost tap input independently of display Hz.
  const w = win(), original = w.requestAnimationFrame, queued = [];
  let base;
  try {
    w.requestAnimationFrame = callback => { queued.push(callback); return -queued.length; };
    base = await new Promise(resolve => original.call(w, resolve));
    if (queued.length !== 1) throw new Error(`Expected one game loop callback, found ${queued.length}`);
    queued.shift()(base);
    api().start(false);
    tap('bolt');
    queued.shift()(base);
    check(api().game.player.cooldowns.bolt === 0 && api().game.projectiles.length === 0,
      'Quick Cast waits through a render frame with no simulation step');
    queued.shift()(base + 17);
    check(api().game.player.cooldowns.bolt > 0 && api().game.projectiles.length > 0,
      'Quick Cast survives that frame and fires on the next simulation step');
  } finally {
    w.requestAnimationFrame = original;
    // Resume the existing loop exactly once after the synthetic timestamp.
    await sleep(Math.max(0, (base || w.performance.now()) + 18 - w.performance.now()));
    for (const callback of queued) original.call(w, callback);
  }
}
function key(type, code) { win().dispatchEvent(new (win().KeyboardEvent)(type, {bubbles: true, cancelable: true, code})); }
async function desktopChecks() {
  await viewport(1280, 720);
  await load(false);
  await fresh();
  check(!shown(byId('touch-controls')) && shown(byId('abilities')), 'Desktop keeps its original abilities and keyboard HUD');
  const p = api().game.player, x = p.x;
  key('keydown', 'KeyD'); key('keydown', 'KeyJ'); key('keydown', 'Space');
  await sleep(160);
  check(p.x > x + 10 && p.jumps === 1 && p.cooldowns.bolt > 0, 'Desktop keyboard movement, jump and held Starshard still combine');
  for (const code of ['KeyD', 'KeyJ', 'Space']) key('keyup', code);
  await fresh();
  byId('qa-pad-connect').click();
  await sleep(130);
  const named = name => [...doc().querySelectorAll('#qa-panel button')].find(el => el.textContent === name);
  named('Virtual A').click();
  await sleep(100);
  check(api().game.player.jumps === 1, 'Virtual standard controller A still jumps');
  named('Virtual X').click();
  await sleep(130);
  check(api().game.player.cooldowns.bolt > 0, 'Virtual standard controller X still casts Starshard');
  named('Hold virtual LB').click();
  await until(() => shown(byId('selection-ring')), 'controller selection ring');
  named('Right stick →').click();
  await sleep(120);
  named('Release virtual LB').click();
  await until(() => !shown(byId('selection-ring')), 'controller ring release');
  check(api().game.inventory.equipped === 'frost' && api().game.inventory.charges.frost === 0,
    'Controller right-stick selection still equips without using');
  byId('qa-pad-disconnect').click();
  await sleep(160);
  check(api().mode === 'pause', 'Controller disconnect still pauses controller play');
}
runButton.addEventListener('click', async () => {
  runButton.disabled = true; output.replaceChildren(); report.hidden = true;
  records = []; runtimeErrors = []; status.textContent = 'Running…';
  const savedStorage = new Map(storageKeys.map(key => [key, localStorage.getItem(key)]));
  // Keyboard/controller expectations below intentionally exercise the defaults.
  localStorage.removeItem('crownforge-last-star-level1-preview-v1-qa-bindings');
  const began = performance.now();
  try {
    await load(true);
    for (const [label, width, height] of sizes) {
      status.textContent = `Checking ${label} · ${width}×${height}`;
      await geometry(label, width, height);
    }
    status.textContent = 'Checking simulated notch and home-indicator insets…';
    await simulatedSafeAreas();
    status.textContent = 'Checking simultaneous input and lifecycle…';
    await inputChecks();
    status.textContent = 'Checking desktop and virtual controller…';
    await desktopChecks();
    check(runtimeErrors.length === 0, 'No runtime errors after fixture initialization', runtimeErrors.join('; '));
  } catch (error) {
    check(false, 'Fixture completed without interruption', error.stack || String(error));
  } finally {
    releaseAll();
    for (const [key, value] of savedStorage) {
      if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
    }
    const passed = records.filter(row => row.pass).length;
    const failed = records.length - passed;
    const summary = {passed, failed, seconds: +((performance.now() - began) / 1000).toFixed(1),
      method: 'Synthetic PointerEvents, real iframe resize, real game loop, CSS safe-inset simulation, virtual standard gamepad. No physical-device, real-notch or OS pointer-capture claim.',
      viewports: sizes.map(([name, width, height]) => ({name, width, height})), runtimeErrors, results: records};
    status.textContent = `${passed} passed · ${failed} failed`;
    status.className = failed ? 'fail' : 'pass';
    report.textContent = JSON.stringify(summary, null, 2); report.hidden = false;
    runButton.disabled = false;
  }
});
