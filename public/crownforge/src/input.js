export class CrownforgeInput {
  constructor({
    canvas,
    renderer,
    simulation,
    onBuildMode = () => {},
    onToast = () => {},
    onEscape = () => {},
    onGesture = () => {},
    onSelection = () => {},
    onCommand = () => {},
    onPlacement = () => {},
    onBuildShortcut = () => {},
  }) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.simulation = simulation;
    this.onBuildMode = onBuildMode;
    this.onToast = onToast;
    this.onEscape = onEscape;
    this.onGesture = onGesture;
    this.onSelection = onSelection;
    this.onCommand = onCommand;
    this.onPlacement = onPlacement;
    this.onBuildShortcut = onBuildShortcut;
    this.pointer = { x: 0, y: 0 };
    this.drag = null;
    this.pan = null;
    this.buildMode = null;
    this.wallDrag = null;
    this.keys = new Set();
    this.reducedMotion = false;
    this._bind();
  }

  _bind() {
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    this.canvas.addEventListener('pointermove', (event) => this._move(event));
    this.canvas.addEventListener('pointerleave', () => this._setCursor('default'));
    this.canvas.addEventListener('pointerdown', (event) => this._down(event));
    window.addEventListener('pointerup', (event) => this._up(event));
    window.addEventListener('pointercancel', (event) => this._up(event));
    this.canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.renderer.zoomAt(event.deltaY < 0 ? 1.08 : 0.93, this._point(event));
    }, { passive: false });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.keys.clear();
        this.cancelBuildMode();
        this.onEscape();
        event.preventDefault();
        return;
      }
      if (this._isUiFocused()) return;
      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'b'].includes(key)) event.preventDefault();
      if (event.repeat) return;
      this.keys.add(key);
      if (key === 'b') this.onBuildShortcut();
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.key.toLowerCase()));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.drag = null;
      this.pan = null;
      this.renderer.setSelectionBox(null);
    });
  }

  _isUiFocused() {
    const active = document.activeElement;
    return Boolean(active?.closest?.('button, input, select, textarea, [contenteditable="true"]'));
  }

  setBuildMode(type) {
    this.buildMode = type;
    const world = this.renderer.screenToWorld(this.pointer);
    const preview = type === 'wall'
      ? this.simulation.getWallLinePreview(world, world)
      : (() => {
        const check = this.simulation.getPlacementCheck(type, world);
        return { type, world, valid: check.valid, reason: check.reason };
      })();
    this.renderer.setBuildPreview(preview);
    this.onBuildMode(type);
    this._updateCursor(this.pointer);
    this.onToast('Construction menu: choose a clear meadow tile. Press Esc to cancel.');
  }

  cancelBuildMode() {
    this.buildMode = null;
    this.wallDrag = null;
    this.renderer.setBuildPreview(null);
    this.onBuildMode(null);
    this._updateCursor(this.pointer);
  }

  setReducedMotion(value) {
    this.reducedMotion = Boolean(value);
  }

  _point(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  _move(event) {
    const point = this._point(event);
    this.pointer = point;
    this.renderer.setPointer(point);
    this._updateCursor(point);
    if (this.pan) {
      this.renderer.panBy(point.x - this.pan.x, point.y - this.pan.y);
      this.pan = point;
    }
    if (this.drag) {
      this.renderer.setSelectionBox({ x: this.drag.start.x, y: this.drag.start.y, width: point.x - this.drag.start.x, height: point.y - this.drag.start.y });
    }
    if (this.buildMode) {
      const world = this.renderer.screenToWorld(point);
      const preview = this.buildMode === 'wall' && this.wallDrag
        ? this.simulation.getWallLinePreview(this.wallDrag.start, world)
        : (() => {
          const check = this.simulation.getPlacementCheck(this.buildMode, world);
          return { type: this.buildMode, world, valid: check.valid, reason: check.reason };
        })();
      this.renderer.setBuildPreview(preview);
    }
  }

  _setCursor(cursor) {
    const cursorClasses = ['is-select-target', 'is-move-target', 'is-gather-target', 'is-attack-target', 'is-interact-target', 'is-build-valid', 'is-build-invalid'];
    cursorClasses.forEach((name) => this.canvas.classList.toggle(name, name === `is-${cursor}`));
    this.canvas.classList.toggle('is-command-target', ['move-target', 'gather-target', 'attack-target', 'interact-target'].includes(cursor));
    this.canvas.style.cursor = '';
  }

  _updateCursor(point) {
    if (this.buildMode) {
      const world = this.renderer.screenToWorld(point);
      const preview = this.buildMode === 'wall' && this.wallDrag
        ? this.simulation.getWallLinePreview(this.wallDrag.start, world)
        : this.simulation.getPlacementCheck(this.buildMode, world);
      this._setCursor(preview.valid ? 'build-valid' : 'build-invalid');
      return;
    }
    // Keep hover feedback aligned with the forgiving visual-body hit regions
    // used by renderer selection. The old world-radius test only covered the
    // unit's ground anchor, which made visible clicks feel offset below/right.
    const entity = this.renderer.getEntityAtScreen?.(this.simulation, point)
      ?? this.simulation.getEntityAt(this.renderer.screenToWorld(point));
    const selected = this.simulation.selectedEntities;
    const selectedUnits = selected.filter((candidate) => candidate.kind === 'unit' && candidate.faction === 'player' && !candidate.dead);
    const selectedVillagers = selectedUnits.filter((candidate) => candidate.type === 'villager');
    if (selectedUnits.length) {
      if (entity?.faction === 'enemy') this._setCursor('attack-target');
      else if (entity?.kind === 'resource' && selectedVillagers.length) this._setCursor('gather-target');
      else if (entity?.kind === 'building' && entity.faction === 'player' && selectedVillagers.length) this._setCursor('interact-target');
      else this._setCursor('move-target');
      return;
    }
    if (entity?.faction === 'enemy') this._setCursor('attack-target');
    else if (entity?.faction === 'player' || entity?.kind === 'resource') this._setCursor('select-target');
    else this._setCursor('default');
  }

  _down(event) {
    const point = this._point(event);
    this.pointer = point;
    this.canvas.focus({ preventScroll: true });
    this.onGesture();
    if (event.button === 1) {
      this.pan = point;
      this.canvas.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button === 0) {
      if (this.buildMode) {
        const world = this.renderer.screenToWorld(point);
        if (this.buildMode === 'wall') {
          this.wallDrag = { start: world };
          this.renderer.setBuildPreview(this.simulation.getWallLinePreview(world, world));
          this.canvas.setPointerCapture(event.pointerId);
          return;
        }
        const placed = this.simulation.placeBuilding(this.buildMode, world);
        this.onPlacement({ kind: 'placement', valid: placed });
        if (placed) {
          this.renderer.addRipple(world, '#d7aa54');
          this.cancelBuildMode();
        }
        return;
      }
      this.drag = { start: point, additive: event.shiftKey };
      this.canvas.setPointerCapture(event.pointerId);
    }
    if (event.button === 2) {
      const world = this.renderer.screenToWorld(point);
      const result = this.simulation.issueContextCommand(world);
      if (result.kind !== 'none') this.renderer.addRipple(world, result.kind === 'attack' ? '#d86b55' : '#86c4cf');
      this.onCommand(result);
      this._updateCursor(point);
    }
  }

  _up(event) {
    const point = this._point(event);
    if (this.wallDrag && event.button === 0) {
      const end = this.renderer.screenToWorld(point);
      const placed = this.simulation.placeWallLine(this.wallDrag.start, end);
      this.onPlacement({ kind: 'placement', valid: placed });
      if (placed) {
        const preview = this.simulation.getWallLinePreview(this.wallDrag.start, end);
        this.renderer.addRipple(preview.world, '#d7aa54');
        this.cancelBuildMode();
      } else {
        this.wallDrag = null;
        this.renderer.setBuildPreview(this.simulation.getWallLinePreview(end, end));
      }
      return;
    }
    if (this.pan) {
      this.pan = null;
      return;
    }
    if (!this.drag || event.button !== 0) return;
    const start = this.drag.start;
    const distance = Math.hypot(point.x - start.x, point.y - start.y);
    this.renderer.setSelectionBox(null);
    if (distance > 8) {
      this.simulation.selectRect(start, point, (unit) => this.renderer.worldToScreen(unit), this.drag.additive);
    } else {
      const visualEntity = this.renderer.getEntityAtScreen?.(this.simulation, point);
      if (visualEntity) this.simulation.selectEntity(visualEntity, this.drag.additive);
      else this.simulation.selectAt(this.renderer.screenToWorld(point), this.drag.additive);
    }
    this.drag = null;
    this.onSelection(this.simulation.selectedEntities);
    this._updateCursor(point);
  }

  update(delta) {
    let dx = 0; let dy = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) dx += 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) dx -= 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) dy += 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) dy -= 1;
    const length = Math.hypot(dx, dy);
    if (length) {
      const speed = (this.reducedMotion ? 240 : 360) * delta;
      dx = (dx / length) * speed;
      dy = (dy / length) * speed;
    }
    if (dx || dy) this.renderer.panBy(dx, dy);
  }
}
