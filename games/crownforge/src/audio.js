const CUES = {
  ui: { notes: [620], duration: 0.055, volume: 0.12, type: 'sine', cooldown: 0.04 },
  select: { notes: [420, 620], duration: 0.075, gap: 0.028, volume: 0.13, type: 'triangle', cooldown: 0.08 },
  move: { notes: [300, 250], duration: 0.07, gap: 0.025, volume: 0.1, type: 'triangle', cooldown: 0.1 },
  gather: { notes: [210, 300], duration: 0.08, gap: 0.02, volume: 0.1, type: 'triangle', cooldown: 0.12 },
  deposit: { notes: [430, 650], duration: 0.11, gap: 0.04, volume: 0.14, type: 'sine', cooldown: 0.12 },
  construct: { notes: [150], duration: 0.06, volume: 0.11, type: 'square', cooldown: 0.18 },
  attack: { notes: [180], duration: 0.065, volume: 0.08, type: 'sawtooth', cooldown: 0.14 },
  impact: { notes: [115], duration: 0.075, volume: 0.13, type: 'triangle', cooldown: 0.12 },
  damage: { notes: [92], duration: 0.09, volume: 0.1, type: 'sawtooth', cooldown: 0.16 },
  death: { notes: [110, 78], duration: 0.14, gap: 0.035, volume: 0.11, type: 'triangle', cooldown: 0.2 },
  success: { notes: [390, 560, 760], duration: 0.09, gap: 0.045, volume: 0.14, type: 'sine', cooldown: 0.2 },
  invalid: { notes: [170, 110], duration: 0.09, gap: 0.025, volume: 0.12, type: 'triangle', cooldown: 0.15 },
  victory: { notes: [390, 520, 690, 860], duration: 0.16, gap: 0.07, volume: 0.16, type: 'sine', cooldown: 1 },
  defeat: { notes: [230, 165, 105], duration: 0.18, gap: 0.075, volume: 0.14, type: 'triangle', cooldown: 1 },
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class CrownforgeAudio {
  constructor() {
    this.context = null;
    this.unlocked = false;
    this.masterVolume = 0.62;
    this.effectsVolume = 0.72;
    this.lastCueAt = new Map();
    this.seenEvents = new Set();
    this.seenOrder = [];
    this.seenDestroyed = new Set();
    this.phase = 'playing';
    this.activeVoices = 0;
    this.activeSources = new Set();
  }

  unlock() {
    this.unlocked = true;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    if (!this.context) this.context = new AudioContextClass();
    if (this.context.state === 'suspended') {
      // Browser autoplay policies can reject a resume even after a gesture
      // callback. Keep the rejection handled so a denied audio device never
      // becomes an unhandled promise in the game console.
      void this.context.resume().catch(() => {});
    }
    return true;
  }

  setMasterVolume(value) { this.masterVolume = clamp(Number(value) || 0, 0, 1); }
  setEffectsVolume(value) { this.effectsVolume = clamp(Number(value) || 0, 0, 1); }

  reset(simulation = null) {
    for (const source of this.activeSources) {
      try { source.stop(); } catch (error) { /* already ended */ }
    }
    this.activeSources.clear();
    this.activeVoices = 0;
    this.lastCueAt.clear();
    this.seenEvents.clear();
    this.seenOrder = [];
    this.seenDestroyed.clear();
    this.phase = simulation?.phase ?? 'playing';
  }

  ui() { this.play('ui'); }
  select(count = 1) { this.play('select', count > 1 ? 1 : 0); }
  command(kind) {
    if (kind === 'attack') this.play('attack');
    else if (kind === 'gather') this.play('gather');
    else if (kind === 'none') this.play('invalid');
    else this.play('move');
  }
  placement(valid) { this.play(valid ? 'success' : 'invalid'); }

  sync(simulation) {
    const nextPhase = simulation.phase;
    if (nextPhase !== this.phase) {
      this.play(nextPhase === 'victory' ? 'victory' : nextPhase === 'defeat' ? 'defeat' : 'ui');
      this.phase = nextPhase;
    }
    for (const unit of simulation.units) {
      for (const event of unit.animationEvents ?? []) {
        const key = `${unit.id}:${event.clock}:${event.name}`;
        if (this.seenEvents.has(key)) continue;
        this.seenEvents.add(key);
        this.seenOrder.push(key);
        if (event.name === 'footstep') this.play('move', unit.id);
        else if (event.name === 'tool_contact') this.play('gather', unit.id);
        else if (event.name === 'deposit_complete') this.play('deposit', unit.id);
        else if (event.name === 'construction_strike') this.play('construct', unit.id);
        else if (event.name === 'attack_start') this.play('attack', unit.id);
        else if (event.name === 'attack_hit') this.play('impact', unit.id);
        else if (event.name === 'damage_taken') this.play('damage', unit.id);
        else if (event.name === 'death_complete') this.play('death', unit.id);
      }
    }
    for (const building of simulation.buildings) {
      if (!building.destroyed || this.seenDestroyed.has(building.id)) continue;
      this.seenDestroyed.add(building.id);
      this.play('death', building.id);
    }
    if (this.seenOrder.length > 500) {
      const expired = this.seenOrder.splice(0, this.seenOrder.length - 320);
      for (const key of expired) this.seenEvents.delete(key);
    }
  }

  play(name, variant = 0) {
    const cue = CUES[name];
    if (!cue || !this.unlocked || !this.context || this.masterVolume <= 0 || this.effectsVolume <= 0) return;
    const now = this.context.currentTime;
    const last = this.lastCueAt.get(name) ?? -Infinity;
    if (now - last < (cue.cooldown ?? 0)) return;
    if (this.activeVoices >= 10) return;
    this.lastCueAt.set(name, now);
    const variation = 1 + ((Number(variant) || 0) % 5 - 2) * 0.012;
    cue.notes.forEach((frequency, index) => {
      const start = now + index * (cue.gap ?? 0);
      const gain = this.context.createGain();
      const oscillator = this.context.createOscillator();
      const volume = cue.volume * this.masterVolume * this.effectsVolume;
      oscillator.type = cue.type;
      oscillator.frequency.setValueAtTime(Math.max(40, frequency * variation), start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(38, frequency * variation * 0.88), start + cue.duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + cue.duration);
      oscillator.connect(gain).connect(this.context.destination);
      this.activeSources.add(oscillator);
      oscillator.addEventListener('ended', () => {
        this.activeSources.delete(oscillator);
        this.activeVoices = Math.max(0, this.activeVoices - 1);
      }, { once: true });
      this.activeVoices += 1;
      oscillator.start(start);
      oscillator.stop(start + cue.duration + 0.015);
    });
  }
}
