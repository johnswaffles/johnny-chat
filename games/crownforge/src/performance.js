const LONG_FRAME_MS = 24;
const SAMPLE_LIMIT = 120;
const PANEL_UPDATE_MS = 250;

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export class CrownforgePerformanceMonitor {
  constructor(panel, { enabled = false, stressMode = false, lowResolutionMode = false } = {}) {
    this.panel = panel;
    this.enabled = Boolean(enabled && panel);
    this.stressMode = stressMode;
    this.lowResolutionMode = lowResolutionMode;
    this.simulationSamples = [];
    this.renderSamples = [];
    this.uiSamples = [];
    this.longFrames = [];
    this.lastPanelUpdate = 0;
    this.last = { simulationMs: 0, renderMs: 0, uiMs: 0, entityCount: 0, frameMs: 0 };
    this.refs = this.enabled ? {
      mode: panel.querySelector('[data-perf="mode"]'),
      simulation: panel.querySelector('[data-perf="simulation"]'),
      render: panel.querySelector('[data-perf="render"]'),
      ui: panel.querySelector('[data-perf="ui"]'),
      entities: panel.querySelector('[data-perf="entities"]'),
      longFrames: panel.querySelector('[data-perf="long-frames"]'),
    } : null;
    if (this.panel) this.panel.hidden = !this.enabled;
  }

  recordFrame({ now, frameMs, simulationMs, renderMs, uiMs, entityCount }) {
    if (!this.enabled) return;
    this.last = { simulationMs, renderMs, uiMs, entityCount, frameMs };
    this._push(this.simulationSamples, simulationMs);
    this._push(this.renderSamples, renderMs);
    this._push(this.uiSamples, uiMs);
    if (frameMs >= LONG_FRAME_MS) this.longFrames.push(now);
    const cutoff = now - 5000;
    while (this.longFrames.length && this.longFrames[0] < cutoff) this.longFrames.shift();
    if (now - this.lastPanelUpdate < PANEL_UPDATE_MS) return;
    this.lastPanelUpdate = now;
    this._updatePanel();
  }

  _push(samples, value) {
    samples.push(Number.isFinite(value) ? value : 0);
    if (samples.length > SAMPLE_LIMIT) samples.shift();
  }

  _updatePanel() {
    const mode = [this.stressMode ? 'STRESS' : 'NORMAL', this.lowResolutionMode ? 'LOW-RES' : 'FULL-RES'].join(' · ');
    if (this.refs.mode) this.refs.mode.textContent = mode;
    if (this.refs.simulation) this.refs.simulation.textContent = `${average(this.simulationSamples).toFixed(2)} ms`;
    if (this.refs.render) this.refs.render.textContent = `${average(this.renderSamples).toFixed(2)} ms`;
    if (this.refs.ui) this.refs.ui.textContent = `${average(this.uiSamples).toFixed(2)} ms`;
    if (this.refs.entities) this.refs.entities.textContent = `${Math.round(this.last.entityCount)}`;
    if (this.refs.longFrames) this.refs.longFrames.textContent = `${this.longFrames.length} / 5s`;
  }
}
