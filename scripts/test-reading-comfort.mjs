import test from 'node:test';
import assert from 'node:assert/strict';
import {readingPreferences, initReadingComfort} from '../public/story-editor/reading-comfort.mjs';

function harness({storageError = false, initial} = {}) {
  const elements = new Map(), events = new Map(), styles = new Map(), classes = new Set();
  const saved = new Map(initial ? [['johnny-story-reading-comfort-v1', JSON.stringify(initial)]] : []);
  let dialog = false;
  const storage = {getItem:key=>saved.get(key), setItem:(key,value)=>saved.set(key,value)};
  const doc = {
    body: {dataset:{}, style:{setProperty:(name,value)=>styles.set(name,value)}, classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)}},
    defaultView: {get localStorage() { if (storageError) throw Error('Storage unavailable'); return storage; }},
    addEventListener:(name,fn)=>events.set(name,fn),
    querySelector:()=>dialog ? {} : null,
  };
  for (const id of ['studio-focus','studio-audio','studio-reading-settings','studio-text-size','studio-reading-width','studio-reading-theme','studio-reading-speed']) {
    elements.set(id, {
      value:'', textContent:'', attributes:{}, ownerDocument:doc, events:{}, open:false,
      setAttribute(name,value) { this.attributes[name] = value; },
      addEventListener(name,fn) { this.events[name] = fn; },
      contains(target) { return target === this; },
      focus() { this.focused = true; },
    });
  }
  const audio = elements.get('studio-audio');
  audio.currentTime = 23.5;
  audio.src = 'blob:already-generated-part';
  audio.play = () => assert.fail('A reading preference must not restart playback.');
  audio.pause = () => assert.fail('A reading preference must not interrupt playback.');
  const app = initReadingComfort(id=>elements.get(id));
  return {app, doc, audio, events, styles, classes, elements, saved, setDialog(value) { dialog=value; },
    change(id,value) { const node=elements.get(id); node.value=value; node.events.change(); },
    escape() { let prevented=false; events.get('keydown')({key:'Escape',preventDefault(){prevented=true;}}); return prevented; },
  };
}

test('invalid stored display preferences fall back to supported readable values', () => {
  assert.deepEqual(readingPreferences(null), {size:18,width:'comfortable',theme:'paper',speed:1});
  assert.deepEqual(readingPreferences({size:100,width:'tiny',theme:'unknown',speed:20}), {size:18,width:'comfortable',theme:'paper',speed:1});
  assert.deepEqual(readingPreferences({size:'22',width:'wide',theme:'dusk',speed:'1.25'}), {size:22,width:'wide',theme:'dusk',speed:1.25});
});

test('speed changes retain the generated audio and exact current playback position', () => {
  const h=harness();
  h.change('studio-reading-speed','1.5');
  assert.equal(h.audio.playbackRate,1.5);
  assert.equal(h.audio.defaultPlaybackRate,1.5);
  assert.equal(h.audio.currentTime,23.5);
  assert.equal(h.audio.src,'blob:already-generated-part');
  h.audio.playbackRate=1;
  h.audio.events.loadedmetadata();
  assert.equal(h.audio.playbackRate,1.5);
  assert.equal(h.audio.currentTime,23.5);
});

test('only display settings are persisted and a new initialization restores them', () => {
  const h=harness();
  h.change('studio-text-size','22');
  h.change('studio-reading-width','wide');
  h.change('studio-reading-theme','dusk');
  h.change('studio-reading-speed','0.75');
  const saved=JSON.parse(h.saved.get('johnny-story-reading-comfort-v1'));
  assert.deepEqual(saved,{size:22,width:'wide',theme:'dusk',speed:.75});
  const next=harness({initial:saved});
  assert.equal(next.styles.get('--reading-size'),'22px');
  assert.equal(next.styles.get('--reading-width'),'82ch');
  assert.equal(next.doc.body.dataset.readingTheme,'dusk');
  assert.equal(next.audio.playbackRate,.75);
});

test('focus has a visible exit and Escape preserves open-dialog handling', () => {
  const h=harness();
  h.elements.get('studio-focus').events.click();
  assert(h.classes.has('reading-focus'));
  assert.equal(h.elements.get('studio-focus').textContent,'Exit focus');
  assert.equal(h.elements.get('studio-focus').attributes['aria-pressed'],'true');
  h.setDialog(true);
  assert.equal(h.escape(),false);
  assert(h.classes.has('reading-focus'));
  h.setDialog(false);
  assert.equal(h.escape(),true);
  assert(!h.classes.has('reading-focus'));
  assert.equal(h.elements.get('studio-focus').textContent,'Focus reading');
  assert.equal(h.audio.currentTime,23.5);
});

test('settings remain usable when browser storage is unavailable', () => {
  const h=harness({storageError:true});
  h.change('studio-reading-theme','dusk');
  h.change('studio-text-size','20');
  assert.equal(h.doc.body.dataset.readingTheme,'dusk');
  assert.equal(h.styles.get('--reading-size'),'20px');
  assert.equal(h.audio.currentTime,23.5);
});

test('native audio rate changes update the selection without altering the media', () => {
  const h=harness();
  h.audio.playbackRate=2;
  h.audio.events.ratechange();
  assert.equal(h.app.preferences.speed,2);
  assert.equal(h.elements.get('studio-reading-speed').value,'2');
  assert.equal(h.audio.defaultPlaybackRate,2);
  assert.equal(h.audio.src,'blob:already-generated-part');
});
