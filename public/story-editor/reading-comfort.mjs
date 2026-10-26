// Display preferences are local to this browser. Manuscripts and audio requests
// never pass through this module; changing speed only changes native playback.
const STORAGE_KEY = 'johnny-story-reading-comfort-v1';
const SIZES = [16, 18, 20, 22, 24];
const SPEEDS = [.75, 1, 1.25, 1.5, 2];
export function readingPreferences(value = {}) {
  return {
    size: SIZES.includes(Number(value?.size)) ? Number(value.size) : 18,
    width: value?.width === 'wide' ? 'wide' : 'comfortable',
    theme: value?.theme === 'dusk' ? 'dusk' : 'paper',
    speed: SPEEDS.includes(Number(value?.speed)) ? Number(value.speed) : 1,
  };
}

export function initReadingComfort($) {
  const button = $('studio-focus');
  const doc = button?.ownerDocument || globalThis.document;
  const body = doc?.body;
  const audio = $('studio-audio');
  const settings = $('studio-reading-settings');
  let storage;
  let saved;
  try { storage = doc?.defaultView?.localStorage || globalThis.localStorage; saved = JSON.parse(storage?.getItem(STORAGE_KEY) || '{}'); } catch {}
  let preferences = readingPreferences(saved);
  let focused = false;
  const controls = {
    size: $('studio-text-size'),
    width: $('studio-reading-width'),
    theme: $('studio-reading-theme'),
    speed: $('studio-reading-speed'),
  };

  function persist() {
    try { storage?.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch {}
  }
  function applySpeed() {
    if (!audio) return;
    // defaultPlaybackRate also carries the preference into the next audio part.
    if (audio.defaultPlaybackRate !== preferences.speed) audio.defaultPlaybackRate = preferences.speed;
    if (audio.playbackRate !== preferences.speed) audio.playbackRate = preferences.speed;
  }
  function apply() {
    if (body) {
      body.dataset.readingTheme = preferences.theme;
      body.style?.setProperty('--reading-size', `${preferences.size}px`);
      body.style?.setProperty('--reading-width', preferences.width === 'wide' ? '82ch' : '65ch');
    }
    for (const [name, node] of Object.entries(controls)) if (node) node.value = String(preferences[name]);
    applySpeed();
  }
  function setFocus(next) {
    focused = !!next;
    body?.classList?.toggle('reading-focus', focused);
    if (button) {
      button.textContent = focused ? 'Exit focus' : 'Focus reading';
      button.setAttribute('aria-pressed', String(focused));
      button.setAttribute('aria-label', focused ? 'Exit focused reading' : 'Focus on the manuscript');
    }
    // A display toggle does not move the reading position or restart narration.
    if (settings) settings.open = false;
  }
  for (const [name, node] of Object.entries(controls)) {
    node?.addEventListener('change', () => {
      preferences = readingPreferences({...preferences, [name]: node.value});
      apply();
      persist();
    });
  }
  button?.addEventListener('click', () => setFocus(!focused));
  audio?.addEventListener('loadedmetadata', applySpeed);
  audio?.addEventListener('ratechange', () => {
    const speed = audio.playbackRate;
    if (!SPEEDS.includes(speed) || speed === preferences.speed) return;
    preferences = {...preferences, speed};
    if (controls.speed) controls.speed.value = String(speed);
    audio.defaultPlaybackRate = speed;
    persist();
  });
  doc?.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented || doc.querySelector?.('dialog[open]')) return;
    if (settings?.open) { settings.open = false; event.preventDefault(); return; }
    if (focused) { setFocus(false); button?.focus(); event.preventDefault(); }
  });
  doc?.addEventListener('pointerdown', event => {
    if (settings?.open && !settings.contains(event.target)) settings.open = false;
  });
  apply();
  setFocus(false);
  return {setFocus, get preferences() { return {...preferences}; }};
}
