import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { setTimeout as delay } from 'node:timers/promises';
const source = readFileSync(new URL('../scripts/persistence/browser_save_sync.gd', import.meta.url), 'utf8');
const body = source.split('JavaScriptBridge.eval("""')[1].split('""", false)')[0];
let active = 0;
let maximum = 0;
let completed = 0;
let fail = false;
const fs = {
  _syncing: false,
  sync() {
    assert.equal(this._syncing, false, 'overlapping runtime sync');
    this._syncing = true;
    maximum = Math.max(maximum, ++active);
    return delay(5).then(() => {
      this._syncing = false;
      active--;
      completed++;
      return fail ? new Error('storage quota') : null;
    });
  },
};
const context = vm.createContext({ window: {}, GodotFS: fs, GodotOS: { _fs_sync_promise: null }, setTimeout });
function begin() { vm.runInContext(`(function () { ${body} })()`, context); }
async function finished(request) {
  for (let i = 0; i < 200 && request.state === 0; i++) await delay(2);
  assert.notEqual(request.state, 0, 'save never finished');
}
begin();
const first = context.window.__genesisSaveSync;
assert.equal(first.state, 0, 'save claimed completion synchronously');
await Promise.all([fs.sync(), fs.sync(), fs.sync()]);
await finished(first);
assert.equal(first.state, 1);
assert.equal(maximum, 1, 'sync requests were not serialized');
assert.equal(completed, 4);
fail = true;
begin();
const second = context.window.__genesisSaveSync;
await finished(second);
assert.equal(second.state, -1, 'storage failure reported as saved');
fail = false;
begin();
const third = context.window.__genesisSaveSync;
await finished(third);
assert.equal(third.state, 1, 'retry could not recover');
assert.equal(second.state, -1, 'later callback overwrote an earlier request');
console.log('BROWSER_SAVE_SYNC_CHECKS_PASSED: pending status, concurrent flush serialization, persistent error reporting, retry isolation');
