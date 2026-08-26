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
    onDemolitionMode = () => {},
    onDemolitionShortcut = () => {},
    onRecoverShortcut = () => {},
    onSelectAllVillagersShortcut = () => {},
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
    this.onDemolitionMode = onDemolitionMode;
    this.onDemolitionShortcut = onDemolitionShortcut;
    this.onRecoverShortcut = onRecoverShortcut;
    this.onSelectAllVillagersShortcut = onSelectAllVillagersShortcut;
    this.pointer = { x: 0, y: 0 };
    this.drag = null;
    this.pan = null;
    this.buildMode = null;
    this.wallDrag = null;
    this.demolitionMode = false;
    this.demolitionDrag = null;
    this.keys = new Set();
    this.reducedMotion = false;
    this.cursorDirty = true;
    this.cursorUpdateElapsed = 0;
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
      const point = this._point(event);
      const magnitude = Math.min(140, Math.max(1, Math.abs(event.deltaY)));
      const direction = event.deltaY < 0 ? 1 : -1;
      const factor = Math.pow(1.0018, direction * magnitude);
      this.renderer.zoomAt(factor, point);
    }, { passive: false });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.keys.clear();
        this.cancelBuildMode();
        this.cancelDemolitionMode();
        this.onEscape();
        event.preventDefault();
        return;
      }
      if (this._isUiFocused()) return;
      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'b', 'r', 'v', 'x'].includes(key)) event.preventDefault();
      if (event.repeat) return;
      this.keys.add(key);
      if (key === 'b') this.onBuildShortcut();
      if (key === 'x') this.onDemolitionShortcut();
      if (key === 'r') this.onRecoverShortcut();
      if (key === 'v') this.onSelectAllVillagersShortcut();
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.key.toLowerCase()));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.drag = null;
      this.pan = null;
      this.demolitionDrag = null;
      this.renderer.setSelectionBox(null);
      this.renderer.setDemolitionPreview([]);
    });
  }

  _isUiFocused() {
    const active = document.activeElement;
    return Boolean(active?.closest?.('button, input, select, textarea, [contenteditable="true"]'));
  }

  setBuildMode(type) {
    if (this.demolitionMode) this.cancelDemolitionMode();
    this.buildMode = type;
    const world = this.renderer.screenToWorld(this.pointer);
    const preview = type === 'wall'
      ? this.simulation.getWallLinePreview(world, world)
      : this.simulation.getBuildingPlacementPreview(type, world);
    this.renderer.setBuildPreview(preview);
    this.onBuildMode(type);
    this._updateCursor(this.pointer);
    this.onToast(type === 'wall'
      ? 'Drag across the meadow to aim the wall. Start or finish near a wall end or map edge and it magnetically locks on. Natural resources yield to the wall; structures remain protected. Press Esc to cancel.'
      : type === 'gate'
        ? 'Move over a Palisade to magnetically snap the gate into place. It replaces one segment and opens a passable crossing. Press Esc to cancel.'
        : type === 'palisadeTower'
          ? 'Move over a Palisade to magnetically snap the tower into place. It replaces the claimed panel and reconnects both wall sides. Press Esc to cancel.'
        : 'Construction menu: choose a clear meadow tile. Press Esc to cancel.');
  }

  cancelBuildMode() {
    this.buildMode = null;
    this.wallDrag = null;
    this.renderer.setBuildPreview(null);
    this.onBuildMode(null);
    this._updateCursor(this.pointer);
  }

  setDemolitionMode(value = true) {
    const active = Boolean(value);
    if (active && this.buildMode) this.cancelBuildMode();
    this.demolitionMode = active;
    this.demolitionDrag = null;
    this.renderer.setSelectionBox(null);
    this.renderer.setDemolitionPreview([]);
    this.onDemolitionMode(active);
    this._updateCursor(this.pointer);
    if (active) this.onToast('Demolition: click one structure or drag across several. Selected Villagers dismantle them with labor; the Crown Hall is protected. Press X or Esc to cancel.');
  }

  cancelDemolitionMode() {
    if (!this.demolitionMode && !this.demolitionDrag) return;
    this.demolitionMode = false;
    this.demolitionDrag = null;
    this.renderer.setSelectionBox(null);
    this.renderer.setDemolitionPreview([]);
    this.onDemolitionMode(false);
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
    // Hover feedback is visual-only. Refreshing it for every pointer event
    // makes a large-unit stress scene spend its frame budget sorting hit
    // candidates instead of animating the world, so the steady-state cursor
    // is refreshed at a bounded rate in update().
    this.cursorDirty = true;
    if (this.pan) {
      this.renderer.panBy(point.x - this.pan.x, point.y - this.pan.y);
      this.pan = point;
    }
    if (this.drag) {
      this.renderer.setSelectionBox({ x: this.drag.start.x, y: this.drag.start.y, width: point.x - this.drag.start.x, height: point.y - this.drag.start.y });
    }
    if (this.demolitionMode) {
      if (this.demolitionDrag) {
        this.renderer.setSelectionBox({
          x: this.demolitionDrag.start.x,
          y: this.demolitionDrag.start.y,
          width: point.x - this.demolitionDrag.start.x,
          height: point.y - this.demolitionDrag.start.y,
          mode: 'demolition',
        });
        this.renderer.setDemolitionPreview(this.renderer.getBuildingsInScreenRect(this.simulation, this.demolitionDrag.start, point));
      } else {
        const target = this.renderer.getEntityAtScreen?.(this.simulation, point, 'demolish');
        this.renderer.setDemolitionPreview(this.simulation.canDemolishBuilding(target) ? [target] : []);
      }
      this._updateCursor(point);
      this.cursorDirty = false;
      return;
    }
    if (this.buildMode) {
      const world = this.renderer.screenToWorld(point);
      const preview = this.buildMode === 'wall' && this.wallDrag
        ? this.simulation.getWallLinePreview(this.wallDrag.start, world)
        : (() => {
          return this.simulation.getBuildingPlacementPreview(this.buildMode, world);
        })();
      this.renderer.setBuildPreview(preview);
      this._updateCursor(point);
      this.cursorDirty = false;
    }
  }

  _setCursor(cursor) {
    const cursorClasses = ['is-select-target', 'is-move-target', 'is-gather-target', 'is-attack-target', 'is-interact-target', 'is-build-target', 'is-repair-target', 'is-demolish-target', 'is-demolish-invalid', 'is-build-valid', 'is-build-invalid'];
    cursorClasses.forEach((name) => this.canvas.classList.toggle(name, name === `is-${cursor}`));
    this.canvas.classList.toggle('is-command-target', ['move-target', 'gather-target', 'attack-target', 'interact-target', 'build-target', 'repair-target', 'demolish-target'].includes(cursor));
    this.canvas.style.cursor = '';
  }

  _updateCursor(point) {
    if (this.demolitionMode) {
      const target = this.renderer.getEntityAtScreen?.(this.simulation, point, 'demolish');
      this._setCursor(this.simulation.canDemolishBuilding(target) ? 'demolish-target' : 'demolish-invalid');
      return;
    }
    if (this.buildMode) {
      const world = this.renderer.screenToWorld(point);
      const preview = this.buildMode === 'wall' && this.wallDrag
        ? this.simulation.getWallLinePreview(this.wallDrag.start, world)
        : this.simulation.getBuildingPlacementPreview(this.buildMode, world);
      this._setCursor(preview.valid ? 'build-valid' : 'build-invalid');
      return;
    }
    // Keep hover feedback aligned with the forgiving visual-body hit regions
    // used by renderer selection. The old world-radius test only covered the
    // unit's ground anchor, which made visible clicks feel offset below/right.
    const selected = this.simulation.selectedEntities;
    const selectedUnits = selected.filter((candidate) => candidate.kind === 'unit' && candidate.faction === 'player' && !candidate.dead);
    const selectedBuilders = selectedUnits.filter((candidate) => this.simulation.isBuilderUnit(candidate));
    const selectedVillagers = selectedUnits.filter((candidate) => candidate.type === 'villager');
    const entity = this.renderer.getEntityAtScreen?.(this.simulation, point, selectedUnits.length ? 'command' : 'select')
      ?? this.simulation.getEntityAt(this.renderer.screenToWorld(point));
    if (selectedUnits.length) {
      if (entity?.faction === 'enemy') this._setCursor('attack-target');
      else if (entity?.kind === 'building' && selectedBuilders.length && this.simulation.buildingNeedsWork(entity)) {
        this._setCursor(entity.progress < 1 ? 'build-target' : 'repair-target');
      }
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
    if (event.button === 2 && this.demolitionMode) {
      this.cancelDemolitionMode();
      return;
    }
    if (event.button === 0) {
      if (this.demolitionMode) {
        this.demolitionDrag = { start: point };
        this.renderer.setSelectionBox({ x: point.x, y: point.y, width: 0, height: 0, mode: 'demolition' });
        this.canvas.setPointerCapture(event.pointerId);
        return;
      }
      if (this.buildMode) {
        const world = this.renderer.screenToWorld(point);
        if (this.buildMode === 'wall') {
          this.wallDrag = { start: world };
          this.renderer.setBuildPreview(this.simulation.getWallLinePreview(world, world));
          this.canvas.setPointerCapture(event.pointerId);
          return;
        }
        const preview = this.simulation.getBuildingPlacementPreview(this.buildMode, world);
        this.renderer.setBuildPreview(preview);
        const placed = this.simulation.placeBuilding(this.buildMode, world, preview);
        this.onPlacement({ kind: 'placement', valid: placed });
        if (placed) {
          this.renderer.addRipple(world, '#d7aa54');
          this.cancelBuildMode();
        }
        return;
      }
      // A selected builder can use a primary click on unfinished or damaged
      // friendly structures as an explicit build/repair order. Selection remains the
      // normal left-click behavior everywhere else, while this small
      // exception makes an unfinished site feel actionable instead of merely
      // selectable. The same command router is used by right-click, so slot
      // reservations, cargo-first deposits, and interruption cleanup stay
      // identical between both input paths.
      const selectedUnits = this.simulation.selectedEntities
        .filter((entity) => entity.kind === 'unit' && entity.faction === 'player' && !entity.dead);
      const selectedBuilders = selectedUnits.filter((unit) => this.simulation.isBuilderUnit(unit));
      if (selectedBuilders.length) {
        const visualTarget = this.renderer.getEntityAtScreen?.(this.simulation, point, 'command');
        if (visualTarget?.kind === 'building'
          && this.simulation.buildingNeedsWork(visualTarget)) {
          const world = this.renderer.screenToWorld(point);
          const result = this.simulation.issueContextCommand(world, visualTarget);
          if (result.kind !== 'none') this.renderer.addRipple(world, '#d7aa54');
          this.onCommand(result);
          this._updateCursor(point);
          return;
        }
      }
      this.drag = { start: point, additive: event.shiftKey };
      this.canvas.setPointerCapture(event.pointerId);
    }
    if (event.button === 2) {
      const world = this.renderer.screenToWorld(point);
      // Use the same forgiving visible-silhouette hit test as selection so a
      // click on a tree canopy, berry bush, or large stone deposit commands
      // the node itself rather than falling through to a plain move order.
      const visualTarget = this.renderer.getEntityAtScreen?.(this.simulation, point, 'command');
      const result = this.simulation.issueContextCommand(world, visualTarget);
      if (result.kind !== 'none') this.renderer.addRipple(world, result.kind === 'attack' ? '#d86b55' : '#86c4cf');
      this.onCommand(result);
      this._updateCursor(point);
    }
  }

  _up(event) {
    const point = this._point(event);
    if (this.demolitionDrag && event.button === 0) {
      const start = this.demolitionDrag.start;
      const dragDistance = Math.hypot(point.x - start.x, point.y - start.y);
      const targets = dragDistance > 8
        ? this.renderer.getBuildingsInScreenRect(this.simulation, start, point)
        : [this.renderer.getEntityAtScreen?.(this.simulation, point, 'demolish')].filter(Boolean);
      const result = this.simulation.issueDemolitionOrder(targets);
      for (const target of result.targets ?? []) this.renderer.addRipple(target, '#d86b55');
      this.renderer.setSelectionBox(null);
      this.renderer.setDemolitionPreview([]);
      this.demolitionDrag = null;
      this.onCommand(result);
      this._updateCursor(point);
      return;
    }
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
    this.cursorUpdateElapsed += Math.max(0, delta);
    if (this.cursorDirty && this.cursorUpdateElapsed >= 1 / 30) {
      this._updateCursor(this.pointer);
      this.cursorDirty = false;
      this.cursorUpdateElapsed = 0;
    }
  }
}
