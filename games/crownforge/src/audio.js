import {CombatMusic,COMBAT_TRACK} from './combat-music.js?v=20260911-tankspace1';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const SELECTION_KEY = 'crownforge-music-selection-v1';
const asset = (name) => new URL(`../assets/${name}.mp3?v=20260905-playlist1`, import.meta.url).href;

// Preserve the supplied recordings; this order is the default repeating album.
export const CROWNFORGE_MUSIC = Object.freeze([
  { id: 'lantern-under-stone', title: 'Lantern Under Stone' },
  { id: 'the-door-beneath-the-world', title: 'The Door Beneath the World' },
  { id: 'the-forgotten-stair', title: 'The Forgotten Stair' },
  { id: 'the-last-rune', title: 'The Last Rune' },
  { id: 'cavernous-wonder', title: 'Cavernous Wonder' },
].map(track => Object.freeze({ ...track, src: asset(track.id) })));

function browserStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

// A media element owns the regular album; a decoded combat loop crossfades over it.
// Gameplay cues stay quiet until they have a coherent recorded sound family.
export class CrownforgeAudio {
  constructor({ storage = browserStorage() } = {}) {
    this.music = typeof Audio === 'function' ? new Audio() : null;
    this.storage = storage;
    this.combat=new CombatMusic(this);
    this.musicVolume = 0.58;
    this.musicMuted = false;
    this.unlocked = false;
    this.musicStarted = false;
    this.phase = 'playing';
    this.playbackStatus = 'ready';
    this.onMusicChange = null;
    let saved;
    try { saved = storage?.getItem(SELECTION_KEY); } catch { /* Private browsing can deny storage. */ }
    this.selection = CROWNFORGE_MUSIC.some(track => track.id === saved) ? saved : 'all';
    this.trackIndex = Math.max(0, CROWNFORGE_MUSIC.findIndex(track => track.id === this.selection));

    if (this.music) {
      this.music.preload = 'metadata';
      this.music.volume = this.musicVolume;
      this.music.muted = this.musicMuted;
      this.music.addEventListener('ended', () => {
        if (this.selection === 'all') this.loadTrack((this.trackIndex + 1) % CROWNFORGE_MUSIC.length);
        else this.music.currentTime = 0;
        this.startMusic();
      });
      this.music.addEventListener('playing', () => { this.playbackStatus = 'playing'; this.notify(); });
      this.music.addEventListener('waiting', () => { this.playbackStatus = 'loading'; this.notify(); });
      this.music.addEventListener('error', () => { this.playbackStatus = 'error'; this.notify(); });
      this.loadTrack(this.trackIndex);
    }
  }

  get currentTrack() { return this.combat.playing?COMBAT_TRACK:CROWNFORGE_MUSIC[this.trackIndex]; }
  notify() { this.onMusicChange?.(); }

  loadTrack(index) {
    this.trackIndex = index;
    this.musicStarted = false;
    this.playbackStatus = 'ready';
    if (this.music) {
      this.music.pause();
      this.music.src = CROWNFORGE_MUSIC[this.trackIndex].src;
      this.music.loop = this.selection !== 'all';
    }
    this.notify();
  }

  selectMusic(selection) {
    if (selection !== 'all' && !CROWNFORGE_MUSIC.some(track => track.id === selection)) return false;
    if (selection === this.selection) return true;
    this.selection = selection;
    try { this.storage?.setItem(SELECTION_KEY, selection); } catch { /* Playback does not depend on storage. */ }
    this.loadTrack(selection === 'all' ? 0 : CROWNFORGE_MUSIC.findIndex(track => track.id === selection));
    if (this.unlocked) this.startMusic();
    return true;
  }

  unlock() {
    this.unlocked = true;
    this.combat.unlock();
    return this.startMusic();
  }

  startMusic() {
    if (!this.music || this.musicMuted || !this.unlocked) return false;
    if (!this.music.paused && !this.music.ended) return true;
    const src = this.music.src;
    const result = this.music.play();
    if (result && typeof result.then === 'function') {
      result.then(() => {
        if (this.music.src !== src || this.music.paused) return;
        this.musicStarted = true;
        this.playbackStatus = 'playing';
        this.notify();
      }).catch(error => {
        // A track change or mute can cancel an older play request.
        if (this.music.src !== src || error?.name === 'AbortError') return;
        this.playbackStatus = error?.name === 'NotAllowedError' ? 'ready' : 'error';
        this.notify();
      });
    } else {
      this.musicStarted = true;
    }
    return true;
  }

  setMasterVolume(value) {
    this.musicVolume = clamp(Number(value) || 0, 0, 1);
    if (this.music) this.music.volume = this.musicVolume;
  }

  setMusicMuted(value) {
    this.musicMuted = Boolean(value);
    if (this.music) {
      this.music.muted = this.musicMuted;
      if (this.musicMuted) this.music.pause();
    }
    if (!this.musicMuted && this.unlocked) this.startMusic();
    this.notify();
    return this.musicMuted;
  }

  toggleMusic() { return this.setMusicMuted(!this.musicMuted); }
  isMusicMuted() { return this.musicMuted; }

  reset(simulation = null) {
    this.phase = simulation?.phase ?? 'playing';
    // Match reset/save restoration never restart the current song or album.
    if (!this.musicMuted && this.unlocked && this.music?.paused) this.startMusic();
  }

  ui() {}
  select() {}
  command() {}
  placement() {}
  play() {}
  sync(simulation) { this.phase = simulation?.phase ?? this.phase;this.combat.sync(simulation); }
}
