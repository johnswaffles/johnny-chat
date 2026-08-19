const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Crownforge intentionally has one audio layer for this pass: a quiet,
// looped musical bed. Gameplay cues remain no-ops so future recorded effects
// can be designed as one coherent sound family instead of mixing in temporary
// oscillator sounds.
export class CrownforgeAudio {
  constructor() {
    this.music = typeof Audio === 'function' ? new Audio() : null;
    this.musicVolume = 0.58;
    this.musicMuted = false;
    this.unlocked = false;
    this.musicStarted = false;
    this.phase = 'playing';

    if (this.music) {
      this.music.src = new URL('../assets/lantern-under-stone.mp3?v=20260819-musicpass1', import.meta.url).href;
      this.music.preload = 'auto';
      this.music.loop = true;
      this.music.volume = this.musicVolume;
      this.music.muted = this.musicMuted;
    }
  }

  unlock() {
    this.unlocked = true;
    return this.startMusic();
  }

  startMusic() {
    if (!this.music || this.musicMuted) return false;
    const result = this.music.play();
    if (result && typeof result.catch === 'function') {
      // Autoplay can still be denied until the browser sees a real gesture.
      // Keep the rejection handled; the next user gesture retries cleanly.
      result.then(() => { this.musicStarted = true; }).catch(() => {});
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
    if (this.music) this.music.muted = this.musicMuted;
    if (!this.musicMuted && this.unlocked) this.startMusic();
    return this.musicMuted;
  }

  toggleMusic() {
    return this.setMusicMuted(!this.musicMuted);
  }

  isMusicMuted() {
    return this.musicMuted;
  }

  reset(simulation = null) {
    this.phase = simulation?.phase ?? 'playing';
    // Resetting the match should not restart or interrupt the musical bed.
    if (!this.musicMuted && this.unlocked && this.music?.paused) this.startMusic();
  }

  // Retained as quiet compatibility methods for the existing event wiring.
  // Recorded interaction sounds can be added later without changing callers.
  ui() {}
  select() {}
  command() {}
  placement() {}
  play() {}
  sync(simulation) {
    this.phase = simulation?.phase ?? this.phase;
  }
}
