import { ASSET_RECTS, COMBAT_ATLASES, CONFIG, ENEMY_CAMP_ASSET, FACTION, LIGHTING, RESOURCE_TYPES, UNIT_TYPES, BUILDING_TYPES, VILLAGER_ATLASES, ENVIRONMENT_ATLAS, ROAD_DETAILS_ATLAS, BUILDING_STAGE_ATLAS } from './config.js?v=20260818-roads2';
import { ANIMATION_EVENTS, animationDefinition, animationFrame, resolveAnimationState } from './animation.js?v=20260818-roads2';

const TAU = Math.PI * 2;

const ROAD_NETWORK = [
  {
    id: 'main-settlement-road',
    kind: 'main',
    width: 2.25,
    patternAlpha: 0.62,
    points: [
      { x: 4, z: 65 }, { x: 8, z: 59 }, { x: 13, z: 53 }, { x: 18, z: 48 },
      { x: 23, z: 44.5 }, { x: 28, z: 44.5 }, { x: 34, z: 46 }, { x: 39, z: 44 },
      { x: 44, z: 38 }, { x: 50, z: 31 }, { x: 59, z: 25 }, { x: 72, z: 21 },
    ],
  },
  {
    id: 'house-village-lane',
    kind: 'lane',
    width: 1.34,
    patternAlpha: 0.5,
    points: [{ x: 18, z: 48 }, { x: 15, z: 44 }, { x: 12, z: 39 }, { x: 8, z: 35 }, { x: 10, z: 31 }],
  },
  {
    id: 'hall-entrance-lane',
    kind: 'lane',
    width: 1.28,
    patternAlpha: 0.5,
    points: [{ x: 24, z: 44.5 }, { x: 24.6, z: 42.8 }, { x: 25, z: 41.2 }],
  },
  {
    id: 'waystore-lane',
    kind: 'lane',
    width: 1.3,
    patternAlpha: 0.48,
    points: [{ x: 32.5, z: 45.6 }, { x: 35, z: 44.6 }, { x: 37, z: 44.2 }],
  },
  {
    id: 'north-field-footpath',
    kind: 'footpath',
    width: 0.76,
    patternAlpha: 0.3,
    points: [{ x: 44, z: 38 }, { x: 42, z: 34 }, { x: 39, z: 31 }, { x: 36.8, z: 28.8 }],
  },
  {
    id: 'stone-footpath',
    kind: 'footpath',
    width: 0.72,
    patternAlpha: 0.28,
    points: [{ x: 44, z: 38 }, { x: 46, z: 42 }, { x: 48, z: 46.5 }, { x: 49, z: 48.2 }],
  },
  {
    id: 'east-berry-footpath',
    kind: 'footpath',
    width: 0.68,
    patternAlpha: 0.26,
    points: [{ x: 59, z: 25 }, { x: 59.5, z: 28 }, { x: 57.5, z: 30 }],
  },
];

const ROAD_PLAZAS = [
  { x: 24.8, z: 44.2, width: 4.3, height: 2.1 },
  { x: 34.3, z: 45.5, width: 3.1, height: 1.55 },
];

const ROAD_MARKS = [
  { kind: 'rut', a: { x: 10.5, z: 55 }, b: { x: 13.3, z: 52.5 }, tone: 'rgba(52, 39, 28, 0.34)' },
  { kind: 'rut', a: { x: 16.5, z: 49.3 }, b: { x: 19.2, z: 47.3 }, tone: 'rgba(53, 40, 28, 0.3)' },
  { kind: 'rut', a: { x: 29.8, z: 44.8 }, b: { x: 33.1, z: 45.5 }, tone: 'rgba(52, 39, 28, 0.3)' },
  { kind: 'rut', a: { x: 45.5, z: 36.8 }, b: { x: 48, z: 33.8 }, tone: 'rgba(52, 39, 28, 0.26)' },
  { kind: 'puddle', x: 20.4, z: 46.1, width: 0.72, height: 0.24, tone: 'rgba(74, 83, 66, 0.42)' },
  { kind: 'puddle', x: 41.2, z: 41.2, width: 0.52, height: 0.18, tone: 'rgba(68, 78, 64, 0.36)' },
  { kind: 'prints', x: 39.7, z: 31.1, angle: -0.42 },
  { kind: 'prints', x: 47.3, z: 45.2, angle: 0.2 },
  { kind: 'stones', x: 15.2, z: 51.3, size: 0.22 },
  { kind: 'stones', x: 31.7, z: 44.2, size: 0.18 },
  { kind: 'stones', x: 53.5, z: 28.5, size: 0.2 },
  { kind: 'stones', x: 58.8, z: 25.8, size: 0.16 },
];

export class CrownforgeRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.atlas = new Image();
    this.meadow = new Image();
    this.road = new Image();
    this.roadsideProps = new Image();
    this.atlasReady = false;
    this.meadowReady = false;
    this.roadReady = false;
    this.roadsidePropsReady = false;
    this.meadowPattern = null;
    this.roadPattern = null;
    this.environmentReady = false;
    this.buildingStagesReady = false;
    this.enemyCampReady = false;
    this.villagerAtlases = {};
    this.villagerAtlasReady = {};
    this.combatAtlases = {};
    this.combatAtlasReady = {};
    this.atlas.addEventListener('load', () => { this.atlasReady = true; });
    this.meadow.addEventListener('load', () => {
      this.meadowReady = true;
      this.meadowPattern = null;
    });
    this.road.addEventListener('load', () => {
      this.roadReady = true;
      this.roadPattern = null;
    });
    this.roadsideProps.addEventListener('load', () => { this.roadsidePropsReady = true; });
    this.environmentAtlas = new Image();
    this.buildingStages = new Image();
    this.enemyCamp = new Image();
    this.environmentAtlas.addEventListener('load', () => { this.environmentReady = true; });
    this.buildingStages.addEventListener('load', () => { this.buildingStagesReady = true; });
    this.enemyCamp.addEventListener('load', () => { this.enemyCampReady = true; });
    this.atlas.src = './assets/crownforge-asset-atlas.png';
    this.meadow.src = './assets/crownforge-grass-tile-v1.png?v=20260818-roads2';
    this.road.src = './assets/crownforge-dirt-road-tile-v1.png?v=20260818-roads2';
    this.roadsideProps.src = ROAD_DETAILS_ATLAS.src;
    this.environmentAtlas.src = ENVIRONMENT_ATLAS.src;
    this.buildingStages.src = BUILDING_STAGE_ATLAS.src;
    this.enemyCamp.src = ENEMY_CAMP_ASSET.src;
    for (const [key, definition] of Object.entries(VILLAGER_ATLASES)) {
      if (!definition.src) continue;
      const image = new Image();
      this.villagerAtlases[key] = image;
      this.villagerAtlasReady[key] = false;
      image.addEventListener('load', () => { this.villagerAtlasReady[key] = true; });
      image.src = definition.src;
    }
    for (const [key, definition] of Object.entries(COMBAT_ATLASES)) {
      const image = new Image();
      this.combatAtlases[key] = image;
      this.combatAtlasReady[key] = false;
      image.addEventListener('load', () => { this.combatAtlasReady[key] = true; });
      image.src = definition.src;
    }
    this.camera = { x: 0, y: 0, zoom: CONFIG.initialZoom };
    this.cameraInitialized = false;
    this.pointer = { x: 0, y: 0 };
    this.selectionBox = null;
    this.buildPreview = null;
    this.ripples = [];
    this.roadsideDetails = [
      { kind: 'roadside', type: 'fence', x: 7.1, z: 38.2, size: 112, depthBias: 0.3 },
      { kind: 'roadside', type: 'sign', x: 30.2, z: 45.1, size: 94, depthBias: 0.3 },
      { kind: 'roadside', type: 'cargo', x: 35.2, z: 46.1, size: 102, depthBias: 0.3 },
      { kind: 'roadside', type: 'lantern', x: 27.1, z: 41.1, size: 94, depthBias: 0.3 },
      { kind: 'roadside-shrub', type: 'flowers', variant: 1, x: 17.1, z: 49.7, size: 50, depthBias: 0.2 },
      { kind: 'roadside-shrub', type: 'flowers', variant: 2, x: 46.7, z: 34.1, size: 46, depthBias: 0.2 },
    ];
    this.lastRenderTime = 0;
    const query = new URLSearchParams(window.location.search);
    this.diagnostics = query.has('lighting-benchmark');
    this.daylightEnabled = !query.has('lighting-off');
    this.frameStats = { count: 0, samples: [] };
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (!this.cameraInitialized && this.width > 1 && this.height > 1) {
      const focus = CONFIG.initialCameraWorld ?? { x: CONFIG.mapWidth / 2, z: CONFIG.mapHeight / 2 };
      const baseX = (focus.x - focus.z - (CONFIG.mapWidth - CONFIG.mapHeight) / 2) * CONFIG.tileWidth / 2;
      const baseY = (focus.x + focus.z - (CONFIG.mapWidth + CONFIG.mapHeight) / 2) * CONFIG.tileHeight / 2;
      this.camera.x = -baseX * this.camera.zoom;
      this.camera.y = -baseY * this.camera.zoom;
      this.cameraInitialized = true;
      this.panBy(0, 0);
    }
  }

  setPointer(point) { this.pointer = point; }
  setSelectionBox(box) { this.selectionBox = box; }
  setBuildPreview(preview) { this.buildPreview = preview; }

  addRipple(world, color = FACTION.color) {
    this.ripples.push({ world, age: 0, color });
  }

  worldToScreen(point) {
    const center = { x: this.width / 2 + this.camera.x, y: this.height / 2 + this.camera.y };
    const x = (point.x - point.z - (CONFIG.mapWidth - CONFIG.mapHeight) / 2) * CONFIG.tileWidth / 2;
    const y = (point.x + point.z - (CONFIG.mapWidth + CONFIG.mapHeight) / 2) * CONFIG.tileHeight / 2;
    return { x: center.x + x * this.camera.zoom, y: center.y + y * this.camera.zoom };
  }

  screenToWorld(point) {
    const center = { x: this.width / 2 + this.camera.x, y: this.height / 2 + this.camera.y };
    const dx = (point.x - center.x) / this.camera.zoom / (CONFIG.tileWidth / 2);
    const dy = (point.y - center.y) / this.camera.zoom / (CONFIG.tileHeight / 2);
    const x = (dx + dy + CONFIG.mapWidth) / 2;
    const z = (dy - dx + CONFIG.mapHeight) / 2;
    return { x, z };
  }

  panBy(dx, dy) {
    this.camera.x += dx;
    this.camera.y += dy;
    const halfMapW = ((CONFIG.mapWidth + CONFIG.mapHeight) * CONFIG.tileWidth / 4) * this.camera.zoom;
    const halfMapH = ((CONFIG.mapWidth + CONFIG.mapHeight) * CONFIG.tileHeight / 4) * this.camera.zoom;
    const mapWidth = halfMapW * 2;
    const mapHeight = halfMapH * 2;
    // On a larger RTS board the map is wider than the viewport. Clamp camera
    // travel to the actual projected map edges so the opening settlement can
    // be centered while panning still cannot reveal an empty void past the
    // terrain diamond.
    const horizontalLimit = Math.max(0, halfMapW - this.width / 2 + 56);
    const verticalLimit = Math.max(0, halfMapH - this.height / 2 + 56);
    this.camera.x = Math.max(-horizontalLimit, Math.min(horizontalLimit, this.camera.x));
    this.camera.y = Math.max(-verticalLimit, Math.min(verticalLimit, this.camera.y));
  }

  zoomAt(factor, screenPoint) {
    const before = this.screenToWorld(screenPoint);
    this.camera.zoom = Math.max(CONFIG.minZoom, Math.min(CONFIG.maxZoom, this.camera.zoom * factor));
    const after = this.screenToWorld(screenPoint);
    const beforeScreen = this.worldToScreen(before);
    const afterScreen = this.worldToScreen(after);
    this.panBy(beforeScreen.x - afterScreen.x, beforeScreen.y - afterScreen.y);
  }

  render(simulation, input, time) {
    const renderStart = this.diagnostics ? window.performance.now() : 0;
    const renderDelta = this.lastRenderTime ? Math.min(0.05, Math.max(0, (time - this.lastRenderTime) / 1000)) : 0;
    this.lastRenderTime = time;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    this.drawBackdrop(ctx);
    this.drawMap(ctx, time);
    this.drawPaths(ctx, simulation);
    this.drawWorldEntities(ctx, simulation, time);
    this.drawOccludedUnitOverlays(ctx, simulation);
    this.drawWorkFeedback(ctx, simulation, time);
    this.drawCombatFeedback(ctx, simulation, time);
    this.drawBuildPreview(ctx);
    this.drawRipples(ctx, time, renderDelta);
    if (this.selectionBox) this.drawSelectionBox(ctx);
    if (this.diagnostics) {
      const samples = this.frameStats.samples;
      samples.push(window.performance.now() - renderStart);
      if (samples.length > 120) samples.shift();
      this.frameStats.count += 1;
      const sorted = [...samples].sort((a, b) => a - b);
      const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
      this.canvas.dataset.renderAvgMs = average.toFixed(3);
      this.canvas.dataset.renderP95Ms = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))].toFixed(3);
      this.canvas.dataset.renderMaxMs = Math.max(...samples).toFixed(3);
    }
  }

  drawBackdrop(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#16262b');
    gradient.addColorStop(0.55, '#203438');
    gradient.addColorStop(1, '#101b20');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    const glow = ctx.createRadialGradient(this.width * 0.5, this.height * 0.42, 0, this.width * 0.5, this.height * 0.42, this.width * 0.65);
    glow.addColorStop(0, 'rgba(196, 159, 91, 0.11)');
    glow.addColorStop(1, 'rgba(196, 159, 91, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  drawMap(ctx, time) {
    const corners = [
      this.worldToScreen({ x: 0, z: 0 }),
      this.worldToScreen({ x: CONFIG.mapWidth, z: 0 }),
      this.worldToScreen({ x: CONFIG.mapWidth, z: CONFIG.mapHeight }),
      this.worldToScreen({ x: 0, z: CONFIG.mapHeight }),
    ];
    const minX = Math.min(...corners.map((p) => p.x));
    const maxX = Math.max(...corners.map((p) => p.x));
    const minY = Math.min(...corners.map((p) => p.y));
    const maxY = Math.max(...corners.map((p) => p.y));

    ctx.save();
    ctx.beginPath();
    corners.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.closePath();
    ctx.clip();
    if (this.meadowReady) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#758c50';
      ctx.fill();
      ctx.globalAlpha = 0.86;
      // The grass tile is intentionally small and seamless. Anchor its repeat
      // at the projected world origin and apply the same camera scale and
      // translation as entities, so the terrain cannot stick to the viewport.
      const pattern = this.meadowPattern ?? (this.meadowPattern = ctx.createPattern(this.meadow, 'repeat'));
      const canTransformPattern = pattern && typeof pattern.setTransform === 'function' && typeof DOMMatrix === 'function';
      if (canTransformPattern) {
        pattern.setTransform(new DOMMatrix([
          this.camera.zoom,
          0,
          0,
          this.camera.zoom,
          this.width / 2 + this.camera.x,
          this.height / 2 + this.camera.y,
        ]));
        ctx.fillStyle = pattern;
        ctx.fillRect(minX - 18, minY - 18, maxX - minX + 36, maxY - minY + 36);
      } else {
        // Older canvas implementations still get a camera-following draw;
        // this is preferable to a viewport-fixed pattern.
        ctx.drawImage(this.meadow, minX - 18, minY - 18, maxX - minX + 36, maxY - minY + 36);
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#647b4a';
      ctx.fill();
    }
    this.drawTerrainWash(ctx, minX, minY, maxX - minX, maxY - minY);
    if (this.daylightEnabled) this.drawDaylightGrade(ctx, minX, minY, maxX - minX, maxY - minY);
    this.drawPathsOnMap(ctx, time);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    corners.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.closePath();
    ctx.strokeStyle = 'rgba(237, 209, 143, 0.5)';
    ctx.lineWidth = 2;
    ctx.shadowColor = LIGHTING.mapEdgeShadow;
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.restore();
  }

  drawTerrainWash(ctx, x, y, width, height) {
    const wash = ctx.createLinearGradient(x, y, x + width, y + height);
    wash.addColorStop(0, 'rgba(255, 240, 184, 0.06)');
    wash.addColorStop(0.5, 'rgba(90, 131, 74, 0.03)');
    wash.addColorStop(1, 'rgba(20, 44, 36, 0.12)');
    ctx.fillStyle = wash;
    ctx.fillRect(x, y, width, height);
  }

  drawDaylightGrade(ctx, x, y, width, height) {
    const sunlight = ctx.createLinearGradient(
      x + width * 0.04,
      y + height * 0.03,
      x + width * 0.96,
      y + height * 0.97,
    );
    sunlight.addColorStop(0, LIGHTING.primary.highlight);
    sunlight.addColorStop(0.34, LIGHTING.primary.warm);
    sunlight.addColorStop(0.7, LIGHTING.ambient.color);
    sunlight.addColorStop(1, LIGHTING.ambient.distantHaze);
    ctx.fillStyle = sunlight;
    ctx.fillRect(x, y, width, height);
  }

  drawTileGuides(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(238, 225, 164, 0.07)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= CONFIG.mapWidth; x += 1) {
      const a = this.worldToScreen({ x, z: 0 });
      const b = this.worldToScreen({ x, z: CONFIG.mapHeight });
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (let z = 0; z <= CONFIG.mapHeight; z += 1) {
      const a = this.worldToScreen({ x: 0, z });
      const b = this.worldToScreen({ x: CONFIG.mapWidth, z });
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.restore();
  }

  drawPathsOnMap(ctx, time) {
    const trace = (points) => {
      const projected = points.map((point) => this.worldToScreen(point));
      ctx.beginPath();
      ctx.moveTo(projected[0].x, projected[0].y);
      for (let index = 1; index < projected.length - 1; index += 1) {
        const current = projected[index];
        const next = projected[index + 1];
        const midpoint = { x: (current.x + next.x) / 2, y: (current.y + next.y) / 2 };
        ctx.quadraticCurveTo(current.x, current.y, midpoint.x, midpoint.y);
      }
      const last = projected[projected.length - 1];
      ctx.quadraticCurveTo(last.x, last.y, last.x, last.y);
    };
    const widthInPixels = (road) => Math.max(4, road.width * 20 * this.camera.zoom);
    const drawPlaza = (plaza) => {
      const point = this.worldToScreen(plaza);
      const radiusX = plaza.width * 16 * this.camera.zoom;
      const radiusY = plaza.height * 7 * this.camera.zoom;
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(-0.06);
      ctx.beginPath();
      ctx.ellipse(0, 2.5 * this.camera.zoom, radiusX + 5 * this.camera.zoom, radiusY + 3 * this.camera.zoom, 0, 0, TAU);
      ctx.fillStyle = 'rgba(48, 37, 27, 0.22)';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, TAU);
      ctx.fillStyle = 'rgba(185, 149, 91, 0.38)';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, -0.4 * this.camera.zoom, radiusX - 4 * this.camera.zoom, Math.max(2, radiusY - 2 * this.camera.zoom), 0, 0, TAU);
      ctx.fillStyle = 'rgba(88, 64, 43, 0.64)';
      ctx.fill();
      ctx.restore();
    };
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const plaza of ROAD_PLAZAS) drawPlaza(plaza);
    for (const road of ROAD_NETWORK) {
      const baseWidth = widthInPixels(road);
      const shoulderWidth = baseWidth + (road.kind === 'main' ? 12 : road.kind === 'lane' ? 8 : 5) * this.camera.zoom;
      // A green-tinted outer feather lets grass blend into the road instead
      // of leaving a clean painted boundary.
      trace(road.points);
      ctx.strokeStyle = road.kind === 'footpath' ? 'rgba(91, 117, 69, 0.3)' : 'rgba(91, 112, 68, 0.18)';
      ctx.lineWidth = shoulderWidth + 8 * this.camera.zoom;
      ctx.stroke();
      // The low shoulder is dusty and irregular, while the center is darker,
      // compacted earth. Separate layers establish a physical road profile.
      ctx.save();
      ctx.translate(0, 2.5 * this.camera.zoom);
      trace(road.points);
      ctx.strokeStyle = 'rgba(48, 39, 28, 0.2)';
      ctx.lineWidth = shoulderWidth + 3 * this.camera.zoom;
      ctx.stroke();
      ctx.restore();
      trace(road.points);
      ctx.strokeStyle = road.kind === 'main' ? 'rgba(193, 158, 96, 0.5)' : 'rgba(176, 145, 89, 0.42)';
      ctx.lineWidth = shoulderWidth;
      ctx.stroke();
      trace(road.points);
      ctx.strokeStyle = road.kind === 'footpath' ? 'rgba(91, 67, 45, 0.58)' : 'rgba(83, 59, 40, 0.78)';
      ctx.lineWidth = baseWidth;
      ctx.stroke();
      if (this.roadReady && typeof DOMMatrix === 'function') {
        const roadPattern = this.roadPattern ?? (this.roadPattern = ctx.createPattern(this.road, 'repeat'));
        if (roadPattern && typeof roadPattern.setTransform === 'function') {
          roadPattern.setTransform(new DOMMatrix([
            this.camera.zoom, 0, 0, this.camera.zoom,
            this.width / 2 + this.camera.x,
            this.height / 2 + this.camera.y,
          ]));
          trace(road.points);
          ctx.globalAlpha = road.patternAlpha;
          ctx.strokeStyle = roadPattern;
          ctx.lineWidth = Math.max(2, baseWidth - 2 * this.camera.zoom);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      // Short broken highlights keep the shoulders dusty without turning the
      // road into a bright ribbon.
      trace(road.points);
      ctx.setLineDash([18 * this.camera.zoom, 32 * this.camera.zoom]);
      ctx.lineDashOffset = -time * 0.002 * (road.kind === 'main' ? 0.7 : 0.45);
      ctx.strokeStyle = `rgba(224, 190, 125, ${road.kind === 'main' ? 0.16 : 0.1})`;
      ctx.lineWidth = Math.max(1.2, baseWidth * 0.12);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const mark of ROAD_MARKS) {
      const point = this.worldToScreen(mark);
      ctx.save();
      if (mark.kind === 'rut') {
        const start = this.worldToScreen(mark.a);
        const end = this.worldToScreen(mark.b);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.strokeStyle = mark.tone;
        ctx.lineWidth = Math.max(1, 1.6 * this.camera.zoom);
        ctx.stroke();
      } else if (mark.kind === 'puddle') {
        ctx.translate(point.x, point.y);
        ctx.rotate(-0.18);
        ctx.beginPath();
        ctx.ellipse(0, 0, mark.width * 12 * this.camera.zoom, mark.height * 8 * this.camera.zoom, 0, 0, TAU);
        ctx.fillStyle = mark.tone;
        ctx.fill();
        ctx.strokeStyle = 'rgba(215, 190, 136, 0.24)';
        ctx.lineWidth = Math.max(1, this.camera.zoom);
        ctx.stroke();
      } else if (mark.kind === 'prints') {
        ctx.translate(point.x, point.y);
        ctx.rotate(mark.angle);
        ctx.fillStyle = 'rgba(54, 42, 31, 0.3)';
        for (let index = 0; index < 3; index += 1) {
          const offset = index * 9 * this.camera.zoom;
          ctx.beginPath();
          ctx.ellipse(-offset, -offset * 0.5, 2.2 * this.camera.zoom, 1.2 * this.camera.zoom, -0.25, 0, TAU);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(4 * this.camera.zoom - offset, 4 * this.camera.zoom - offset * 0.5, 2.2 * this.camera.zoom, 1.2 * this.camera.zoom, -0.25, 0, TAU);
          ctx.fill();
        }
      } else if (mark.kind === 'stones') {
        ctx.translate(point.x, point.y);
        ctx.fillStyle = 'rgba(100, 86, 66, 0.76)';
        ctx.strokeStyle = 'rgba(57, 46, 36, 0.42)';
        ctx.lineWidth = Math.max(1, this.camera.zoom);
        for (let index = 0; index < 3; index += 1) {
          const offsetX = (index - 1) * 5 * this.camera.zoom;
          const offsetY = (index % 2) * 2 * this.camera.zoom;
          ctx.beginPath();
          ctx.ellipse(offsetX, offsetY, mark.size * (5 - index) * this.camera.zoom, mark.size * (3.2 - index * 0.35) * this.camera.zoom, -0.2 + index * 0.2, 0, TAU);
          ctx.fill();
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    ctx.restore();
  }

  drawPaths(ctx, simulation) {
    ctx.save();
    for (const unit of simulation.units) {
      if (!unit.selected || unit.dead || !unit.path.length) continue;
      const start = this.worldToScreen(unit);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      for (const point of unit.path) {
        const screen = this.worldToScreen(point);
        ctx.lineTo(screen.x, screen.y);
      }
      ctx.strokeStyle = unit.command === 'attack' ? 'rgba(222, 105, 80, 0.58)' : 'rgba(195, 229, 207, 0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      const destination = this.worldToScreen(unit.path[unit.path.length - 1]);
      ctx.beginPath();
      ctx.arc(destination.x, destination.y, 5 * this.camera.zoom, 0, TAU);
      ctx.strokeStyle = unit.command === 'attack' ? 'rgba(222, 105, 80, 0.8)' : 'rgba(195, 229, 207, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(destination.x, destination.y, 1.8 * this.camera.zoom, 0, TAU);
      ctx.fillStyle = unit.command === 'attack' ? '#de6950' : '#c3e5cf';
      ctx.fill();
    }
    ctx.restore();
  }

  drawWorldEntities(ctx, simulation, time) {
    const kindOrder = { building: 0, resource: 1, roadside: 2, 'roadside-shrub': 2, decoration: 3, unit: 4 };
    const entities = [
      ...simulation.buildings.map((entity) => ({ ...entity, depth: entity.x + entity.z + 0.2 })),
      ...simulation.resourcesNodes.map((entity) => ({ ...entity, depth: entity.x + entity.z + 0.3 })),
      ...this.roadsideDetails.map((entity, index) => ({
        ...entity,
        id: -1000 - index,
        depth: entity.x + entity.z + (entity.depthBias ?? 0.25),
      })),
      ...simulation.decorations.map((entity) => ({ ...entity, depth: entity.x + entity.z + 0.34 })),
      ...simulation.units.map((entity) => ({ ...entity, depth: entity.x + entity.z + 0.7 })),
    ].sort((a, b) => a.depth - b.depth || (kindOrder[a.kind] ?? 0) - (kindOrder[b.kind] ?? 0) || a.id - b.id);
    for (const entity of entities) {
      if (entity.dead && entity.deathAge > 2.4) continue;
      if (entity.destroyed && entity.destroyAge > 2.4) continue;
      if (entity.kind === 'building') this.drawBuilding(ctx, entity, time);
      else if (entity.kind === 'resource') this.drawResource(ctx, entity, time);
      else if (entity.kind === 'roadside' || entity.kind === 'roadside-shrub') this.drawRoadsideDetail(ctx, entity);
      else if (entity.kind === 'decoration') this.drawDecoration(ctx, entity);
      else this.drawUnit(ctx, entity, time);
    }
  }

  drawOccludedUnitOverlays(ctx, simulation) {
    for (const unit of simulation.units.filter((candidate) => !candidate.dead)) {
      const hiddenByBuilding = simulation.buildings.find((building) => {
        if (building.destroyed || building.progress <= 0) return false;
        const nearStructure = simulation._distanceToBuildingEdge(unit, building) < 2.3;
        return nearStructure && unit.x + unit.z < building.x + building.z - 0.04;
      });
      const hiddenByResource = simulation.resourcesNodes.find((node) => {
        if (!['tree', 'berry', 'stone'].includes(node.type) || node.amount <= 0) return false;
        const clearance = node.type === 'berry' ? 1.55 : node.type === 'stone' ? 1.7 : 1.9;
        return Math.hypot(unit.x - node.x, unit.z - node.z) < clearance
          && unit.x + unit.z < node.x + node.z - 0.04;
      });
      const hiddenBy = hiddenByBuilding || hiddenByResource;
      if (!hiddenBy) continue;
      const needsTracking = unit.selected || unit.command === 'attack' || unit.hp < unit.maxHp || unit.faction === 'enemy';
      if (!needsTracking) continue;
      const point = this.worldToScreen(unit);
      const style = UNIT_TYPES[unit.type];
      const unitSize = style.renderSize ?? (unit.type === 'villager' ? 88 : 120);
      // A tall resource can legitimately win the depth sort, but an active
      // enemy must remain readable. Repaint only the silhouette here;
      // selection, health, and attack feedback stay in this final overlay.
      if (hiddenByResource && (unit.faction === 'enemy' || unit.selected)) {
        if (unit.type === 'villager') this.drawVillagerAsset(ctx, unit, point, unitSize * this.camera.zoom, 1);
        else if (style.combatAtlas) this.drawCombatAsset(ctx, unit, point, unitSize * this.camera.zoom, 1);
      }
      this.drawSelectionMarker(ctx, point, true, unit.type === 'soldier' ? 0.82 : 0.66, unit.faction === 'enemy' ? '#d86b55' : FACTION.color);
      this.drawHealthBar(ctx, point.x, point.y - unitSize * 0.9 * this.camera.zoom, unitSize * 0.62 * this.camera.zoom, unit.hp / unit.maxHp, '', Boolean(style.combatAtlas));
    }
  }

  drawAsset(ctx, assetKey, screen, size, alpha = 1) {
    if (!this.atlasReady && !(this.atlas.complete && this.atlas.naturalWidth > 0)) return;
    const rect = ASSET_RECTS[assetKey];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    const destination = { x: screen.x - size / 2, y: screen.y - size * 0.98 };
    ctx.drawImage(this.atlas, rect.x, rect.y, rect.width, rect.height, destination.x, destination.y, size, size);
    ctx.restore();
  }

  drawAtlasCell(ctx, image, ready, atlas, column, row, screen, size, alpha = 1, yOffset = 0) {
    if (!ready && !(image?.complete && image.naturalWidth > 0)) return false;
    // The generated 4x4 sheets are 1254px wide, so a cell is 313.5px.
    // Outward rounding still included a neighboring half-pixel at every
    // boundary, which produced stacked berry/stone fragments and clipped
    // tree tops. Inset every source cell by one whole source pixel instead;
    // the authored silhouettes have transparent breathing room and remain
    // complete while canvas interpolation cannot sample a neighbor.
    const sourceLeft = Math.ceil(column * atlas.width / atlas.columns) + 1;
    const sourceTop = Math.ceil(row * atlas.height / atlas.rows) + 1;
    const sourceRight = Math.floor((column + 1) * atlas.width / atlas.columns) - 1;
    const sourceBottom = Math.floor((row + 1) * atlas.height / atlas.rows) - 1;
    const cellWidth = sourceRight - sourceLeft;
    const cellHeight = sourceBottom - sourceTop;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    const destination = {
      x: screen.x - size / 2,
      y: screen.y - size * 0.98 + yOffset,
    };
    ctx.drawImage(
      image,
      sourceLeft,
      sourceTop,
      cellWidth,
      cellHeight,
      destination.x,
      destination.y,
      size,
      size,
    );
    ctx.restore();
    return true;
  }

  drawEnvironmentAsset(ctx, type, variant, screen, size, alpha = 1) {
    const row = ENVIRONMENT_ATLAS.rowByType[type] ?? ENVIRONMENT_ATLAS.rowByType.pebbles;
    const column = Math.max(0, Math.min(ENVIRONMENT_ATLAS.columns - 1, variant ?? 0));
    this.drawAtlasCell(ctx, this.environmentAtlas, this.environmentReady, ENVIRONMENT_ATLAS, column, row, screen, size, alpha);
  }

  drawBuildingStage(ctx, building, screen, size, alpha = 1) {
    if (building.type === 'ashenCamp') {
      if (!this.enemyCampReady) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.imageSmoothingEnabled = true;
      const aspect = ENEMY_CAMP_ASSET.width / ENEMY_CAMP_ASSET.height;
      const width = size;
      const height = size / aspect;
      const destination = { x: screen.x - width / 2, y: screen.y - height * 0.98 };
      ctx.drawImage(this.enemyCamp, destination.x, destination.y, width, height);
      ctx.restore();
      return;
    }
    const stage = this.buildingConstructionStage(building);
    const column = BUILDING_STAGE_ATLAS.columnByType[building.type] ?? 1;
    const rowStage = stage === 'early' || stage === 'mid' ? 'partial' : stage === 'late' ? 'nearComplete' : stage;
    const row = BUILDING_STAGE_ATLAS.rowByStage[rowStage];
    if (!this.drawAtlasCell(ctx, this.buildingStages, this.buildingStagesReady, BUILDING_STAGE_ATLAS, column, row, screen, size, alpha)) {
      this.drawAsset(ctx, BUILDING_TYPES[building.type].asset, screen, size, alpha);
    }
  }

  buildingConstructionStage(building) {
    if (building.progress >= 1) return 'complete';
    if (building.progress < 0.1) return 'foundation';
    if (building.progress < 0.38) return 'early';
    if (building.progress < 0.68) return 'mid';
    return 'late';
  }

  buildingRenderSize(buildingOrType) {
    const type = typeof buildingOrType === 'string' ? buildingOrType : buildingOrType.type;
    return BUILDING_TYPES[type]?.renderSize ?? (type === 'ashenCamp' ? 272 : 194);
  }

  drawVillagerAsset(ctx, unit, screen, size, alpha = 1) {
    const state = unit.animationState ?? resolveAnimationState(unit);
    const frameData = animationFrame('villager', state, unit.animationTime ?? unit.animClock, unit.facing);
    const atlasKey = frameData.atlasKey;
    const row = frameData.row;
    const frame = frameData.column;
    const image = this.villagerAtlases[atlasKey];
    if (!image || (!this.villagerAtlasReady[atlasKey] && !(image.complete && image.naturalWidth > 0))) {
      this.drawAsset(ctx, 'villager', screen, size, alpha);
      return;
    }
    const atlasDefinition = VILLAGER_ATLASES[atlasKey] ?? VILLAGER_ATLASES.motion;
    const atlasWidth = atlasDefinition.width ?? VILLAGER_ATLASES.width;
    const atlasHeight = atlasDefinition.height ?? VILLAGER_ATLASES.height;
    const atlasColumns = Number.isFinite(atlasDefinition.columns) ? atlasDefinition.columns : VILLAGER_ATLASES.columns;
    const atlasRows = Number.isFinite(atlasDefinition.rows) ? atlasDefinition.rows : VILLAGER_ATLASES.rows;
    // The atlas already carries the silhouette and contact shadow. Keep the
    // world anchor fixed so idle/task frames never float above the meadow.
    const bob = 0;
    this.drawAtlasCell(ctx, image, true, {
      width: atlasWidth,
      height: atlasHeight,
      columns: atlasColumns,
      rows: atlasRows,
    }, frame, row, screen, size, alpha, bob);
  }

  drawCombatAsset(ctx, unit, screen, size, alpha = 1) {
    const style = UNIT_TYPES[unit.type];
    const state = unit.animationState ?? resolveAnimationState(unit);
    const frameData = animationFrame(unit.type, state, unit.animationTime ?? unit.animClock, unit.facing);
    const definition = animationDefinition(unit.type);
    const atlas = definition.atlases[frameData.atlasKey] ?? COMBAT_ATLASES[style.combatAtlas];
    const imageKey = frameData.atlasKey === 'combat' ? style.combatAtlas : frameData.atlasKey;
    const image = this.combatAtlases[imageKey];
    if (!atlas || !image || !this.combatAtlasReady[imageKey]) {
      this.drawAsset(ctx, style.asset, screen, size, alpha);
      return;
    }
    const row = frameData.row;
    const column = frameData.column;
    const bob = 0;
    this.drawAtlasCell(ctx, image, true, atlas, column, row, screen, size, alpha, bob);
  }

  drawBuilding(ctx, building, time) {
    const point = this.worldToScreen(building);
    const size = this.buildingRenderSize(building);
    const visualHeight = building.type === 'ashenCamp'
      ? size * (ENEMY_CAMP_ASSET.height / ENEMY_CAMP_ASSET.width)
      : size;
    const alpha = building.destroyed ? Math.max(0, 0.7 - building.destroyAge * 0.26) : 1;
    if (!building.destroyed) this.drawBuildingFootprint(ctx, building, building.selected, building.faction === 'enemy' ? '#d86b55' : FACTION.color);
    this.drawBuildingStage(ctx, building, point, size * this.camera.zoom, alpha);
    if (building.destroyed) {
      this.drawDestroyedBuildingTreatment(ctx, building, point, size, time);
      return;
    }
    if (building.hitFlash > 0 && !building.destroyed) {
      ctx.save();
      ctx.globalAlpha = 0.25 + building.hitFlash * 0.55;
      ctx.fillStyle = '#e1795f';
      ctx.beginPath();
      ctx.ellipse(point.x, point.y - size * 0.32 * this.camera.zoom, size * 0.34 * this.camera.zoom, size * 0.2 * this.camera.zoom, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    if (building.progress < 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(244, 210, 125, 0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.ellipse(point.x, point.y - size * 0.35 * this.camera.zoom, size * 0.38 * this.camera.zoom, size * 0.17 * this.camera.zoom, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      this.drawConstructionTreatment(ctx, building, point, time);
    }
    this.drawBuildingDamageTreatment(ctx, building, point, size, time);
    this.drawHealthBar(ctx, point.x, point.y - visualHeight * 0.82 * this.camera.zoom, size * 0.58 * this.camera.zoom, building.hp / building.maxHp, building.progress < 1 ? `BUILD ${Math.round(building.progress * 100)}%` : '');
  }

  drawBuildingFootprint(ctx, building, selected = false, color = FACTION.color) {
    const blueprint = BUILDING_TYPES[building.type];
    const clearance = blueprint.collisionClearance ?? 0;
    const footprint = {
      width: blueprint.footprint.width + clearance * 2,
      height: blueprint.footprint.height + clearance * 2,
    };
    const corners = [
      { x: building.x - footprint.width / 2, z: building.z - footprint.height / 2 },
      { x: building.x + footprint.width / 2, z: building.z - footprint.height / 2 },
      { x: building.x + footprint.width / 2, z: building.z + footprint.height / 2 },
      { x: building.x - footprint.width / 2, z: building.z + footprint.height / 2 },
    ].map((corner) => this.worldToScreen(corner));
    ctx.save();
    ctx.beginPath();
    corners.forEach((corner, index) => index ? ctx.lineTo(corner.x, corner.y) : ctx.moveTo(corner.x, corner.y));
    ctx.closePath();
    ctx.fillStyle = selected ? `${color}18` : 'rgba(9, 20, 19, 0.12)';
    ctx.fill();
    ctx.strokeStyle = selected ? `${color}cc` : 'rgba(232, 210, 144, 0.15)';
    ctx.lineWidth = selected ? 2 : 1;
    ctx.setLineDash(selected ? [6, 4] : []);
    ctx.stroke();
    ctx.setLineDash([]);
    if (selected) {
      ctx.strokeStyle = `${color}ee`;
      ctx.lineWidth = 2.4;
      for (const corner of corners) {
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, 3.2, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawConstructionTreatment(ctx, building, point, time) {
    const stage = this.buildingConstructionStage(building);
    if (stage === 'foundation') return;
    const footprint = BUILDING_TYPES[building.type].footprint;
    const pulse = 0.5 + Math.sin(time * 0.004 + building.id) * 0.18;
    const spreadX = (footprint.width * 13 + (stage === 'late' ? 10 : 0)) * this.camera.zoom;
    const spreadY = (footprint.height * 6 + (stage === 'mid' ? 5 : 0)) * this.camera.zoom;
    ctx.save();
    ctx.globalAlpha = stage === 'late' ? 0.28 * pulse : 0.2 * pulse;
    ctx.fillStyle = '#e4bf79';
    for (let index = 0; index < 3; index += 1) {
      const offset = (index - 1) * spreadX * 0.42;
      ctx.beginPath();
      ctx.arc(point.x + offset, point.y + spreadY * (index % 2 ? 0.2 : -0.18), (1.2 + index * 0.45) * this.camera.zoom, 0, TAU);
      ctx.fill();
    }
    if (stage === 'mid' || stage === 'late') {
      ctx.globalAlpha = 0.2 * pulse;
      ctx.strokeStyle = '#d7aa54';
      ctx.lineWidth = Math.max(1, this.camera.zoom);
      ctx.beginPath();
      ctx.moveTo(point.x - spreadX, point.y + spreadY * 0.35);
      ctx.lineTo(point.x - spreadX * 0.54, point.y - spreadY);
      ctx.moveTo(point.x + spreadX * 0.65, point.y + spreadY * 0.25);
      ctx.lineTo(point.x + spreadX * 0.92, point.y - spreadY * 0.75);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawBuildingDamageTreatment(ctx, building, point, size, time) {
    const ratio = building.maxHp > 0 ? building.hp / building.maxHp : 1;
    if (ratio >= 0.72) return;
    const intensity = Math.min(1, (0.72 - ratio) / 0.42);
    ctx.save();
    ctx.globalAlpha = 0.16 + intensity * 0.22;
    ctx.strokeStyle = '#5b342b';
    ctx.lineWidth = Math.max(1, 1.15 * this.camera.zoom);
    const crackOffset = size * this.camera.zoom * 0.16;
    for (let index = 0; index < 2; index += 1) {
      const x = point.x + (index ? crackOffset : -crackOffset * 0.72);
      const y = point.y - size * this.camera.zoom * (0.36 + index * 0.12);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (index ? 7 : -6) * this.camera.zoom, y + 8 * this.camera.zoom);
      ctx.lineTo(x + (index ? 2 : -8) * this.camera.zoom, y + 16 * this.camera.zoom);
      ctx.stroke();
    }
    if (ratio < 0.38) {
      ctx.globalAlpha = 0.22 + intensity * 0.18;
      ctx.fillStyle = '#d86b55';
      for (let index = 0; index < 3; index += 1) {
        const angle = building.id * 0.7 + index * 2.1 + time * 0.0007;
        ctx.beginPath();
        ctx.arc(point.x + Math.cos(angle) * size * 0.18 * this.camera.zoom, point.y - size * (0.48 + index * 0.04) * this.camera.zoom + Math.sin(angle) * 3 * this.camera.zoom, (1.5 + index * 0.6) * this.camera.zoom, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawDestroyedBuildingTreatment(ctx, building, point, size, time) {
    const progress = Math.min(1, building.destroyAge / 0.9);
    ctx.save();
    ctx.globalAlpha = (1 - progress) * 0.5;
    ctx.fillStyle = '#352b28';
    ctx.beginPath();
    ctx.ellipse(point.x, point.y + size * 0.07 * this.camera.zoom, size * 0.34 * this.camera.zoom, size * 0.1 * this.camera.zoom, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = (1 - progress) * 0.6;
    ctx.strokeStyle = '#b9664d';
    ctx.lineWidth = Math.max(1, 1.2 * this.camera.zoom);
    for (let index = 0; index < 3; index += 1) {
      const x = point.x + (index - 1) * size * 0.16 * this.camera.zoom;
      const rise = (8 + index * 4 + Math.sin(time * 0.002 + index) * 3) * this.camera.zoom;
      ctx.beginPath();
      ctx.moveTo(x, point.y - size * 0.16 * this.camera.zoom);
      ctx.quadraticCurveTo(x + 5 * this.camera.zoom, point.y - size * 0.28 * this.camera.zoom - rise, x - 3 * this.camera.zoom, point.y - size * 0.42 * this.camera.zoom - rise);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawResource(ctx, resource, time) {
    const point = this.worldToScreen(resource);
    const size = resource.type === 'tree' ? 142 : resource.type === 'berry' ? 115 : 126;
    const ratio = resource.maxAmount > 0 ? Math.max(0, Math.min(1, resource.amount / resource.maxAmount)) : 0;
    const depleted = resource.amount <= 0;
    if (depleted && resource.type === 'tree') {
      this.drawEnvironmentAsset(ctx, 'stump', 1, point, size * 0.72 * this.camera.zoom, 0.94);
    } else if (depleted && resource.type === 'stone') {
      this.drawEnvironmentAsset(ctx, 'pebbles', 3, point, size * 0.7 * this.camera.zoom, 0.76);
    } else {
      const scale = depleted ? 0.72 : 0.88 + ratio * 0.12;
      const alpha = depleted ? 0.32 : 0.82 + ratio * 0.18;
      this.drawEnvironmentAsset(ctx, resource.type, resource.variant, point, size * scale * this.camera.zoom, alpha);
    }
  }

  drawDecoration(ctx, decoration) {
    const point = this.worldToScreen(decoration);
    const size = decoration.type === 'log' ? 72 : decoration.type === 'stump' ? 64 : decoration.type === 'flowers' ? 54 : 48;
    this.drawEnvironmentAsset(ctx, decoration.type, decoration.variant, point, size * this.camera.zoom * decoration.scale, 0.92);
  }

  drawRoadsideDetail(ctx, detail) {
    const point = this.worldToScreen(detail);
    if (detail.kind === 'roadside-shrub') {
      this.drawEnvironmentAsset(ctx, detail.type, detail.variant ?? 0, point, detail.size * this.camera.zoom, 0.76);
      return;
    }
    if (!this.roadsidePropsReady) return;
    const column = ROAD_DETAILS_ATLAS.columnByType[detail.type] ?? 0;
    const row = ROAD_DETAILS_ATLAS.rowByType[detail.type] ?? 0;
    const cellWidth = ROAD_DETAILS_ATLAS.width / ROAD_DETAILS_ATLAS.columns;
    const cellHeight = ROAD_DETAILS_ATLAS.height / ROAD_DETAILS_ATLAS.rows;
    const sourceInset = 1;
    const sourceLeft = column * cellWidth + sourceInset;
    const sourceTop = row * cellHeight + sourceInset;
    const sourceWidth = cellWidth - sourceInset * 2;
    const sourceHeight = cellHeight - sourceInset * 2;
    const destinationWidth = detail.size * this.camera.zoom;
    const destinationHeight = destinationWidth * (sourceHeight / sourceWidth);
    ctx.save();
    ctx.globalAlpha = 0.96;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      this.roadsideProps,
      sourceLeft,
      sourceTop,
      sourceWidth,
      sourceHeight,
      point.x - destinationWidth / 2,
      point.y - destinationHeight * 0.94,
      destinationWidth,
      destinationHeight,
    );
    ctx.restore();
  }

  drawUnit(ctx, unit, time) {
    const point = this.worldToScreen(unit);
    const style = UNIT_TYPES[unit.type];
    const size = style.renderSize ?? (unit.type === 'villager' ? 88 : 120);
    const alpha = unit.dead ? Math.max(0, 0.92 - unit.deathAge * 0.18) : 1;
    if (!unit.dead) this.drawSelectionMarker(ctx, point, unit.selected, unit.type === 'soldier' ? 0.82 : unit.type === 'raider' ? 0.78 : 0.66, unit.faction === 'enemy' ? '#d86b55' : FACTION.color);
    if (unit.type === 'villager') this.drawVillagerAsset(ctx, unit, point, size * this.camera.zoom, alpha);
    else if (style.combatAtlas) this.drawCombatAsset(ctx, unit, point, size * this.camera.zoom, alpha);
    else this.drawAsset(ctx, style.asset, point, size * this.camera.zoom, alpha);
    if (!unit.dead) {
      this.drawCombatPhaseCue(ctx, unit, point, time);
      this.drawHealthBar(ctx, point.x, point.y - size * 0.9 * this.camera.zoom, size * 0.62 * this.camera.zoom, unit.hp / unit.maxHp, '', Boolean(style.combatAtlas && (unit.selected || unit.command === 'attack' || unit.hitFlash > 0 || unit.healthRevealTimer > 0)));
      if (unit.carryAmount > 0) this.drawCarryBadge(ctx, point.x + 20 * this.camera.zoom, point.y - 18 * this.camera.zoom, unit.carryType, unit.carryAmount);
      if (unit.command === 'attack') this.drawAttackRing(ctx, point, time, unit.attackPhase);
      if (unit.hitFlash > 0) this.drawHitFlash(ctx, point, time);
    }
  }

  drawCombatPhaseCue(ctx, unit, point, time) {
    if (!unit.attackPhase || unit.command !== 'attack' || unit.type === 'villager' && !unit.attackTarget) return;
    const direction = [
      { x: -0.7, y: 0.7 },
      { x: 0.7, y: 0.7 },
      { x: -0.7, y: -0.7 },
      { x: 0.7, y: -0.7 },
    ][unit.facing] ?? { x: 0.7, y: 0.7 };
    const length = Math.hypot(direction.x, direction.y) || 1;
    const dx = direction.x / length;
    const dy = direction.y / length;
    const phase = unit.attackPhase;
    const progress = Math.max(0, Math.min(1, (unit.attackPhaseElapsed ?? 0) / Math.max(0.001, UNIT_TYPES[unit.type].cooldown)));
    ctx.save();
    ctx.globalAlpha = phase === 'anticipation' ? 0.22 + progress * 0.16 : phase === 'recovery' ? 0.14 : 0.1;
    ctx.strokeStyle = phase === 'contact' ? '#f1c36f' : '#d9b06b';
    ctx.lineWidth = Math.max(1, 1.5 * this.camera.zoom);
    if (phase === 'anticipation') {
      ctx.beginPath();
      ctx.arc(point.x + dx * 10 * this.camera.zoom, point.y - 8 * this.camera.zoom + dy * 4 * this.camera.zoom, 9 * this.camera.zoom, Math.atan2(dy, dx) - 1.05, Math.atan2(dy, dx) + 1.05);
      ctx.stroke();
    } else if (phase === 'recovery') {
      ctx.beginPath();
      ctx.moveTo(point.x + dx * 8 * this.camera.zoom, point.y - 10 * this.camera.zoom + dy * 8 * this.camera.zoom);
      ctx.lineTo(point.x + dx * 22 * this.camera.zoom, point.y - 10 * this.camera.zoom + dy * 22 * this.camera.zoom);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawWorkFeedback(ctx, simulation, time) {
    for (const unit of simulation.units) {
      const event = unit.lastAnimationEvent;
      if (!event || unit.dead) continue;
      const age = (unit.animClock ?? 0) - event.clock;
      if (age < 0 || age > 0.58) continue;
      const progress = age / 0.58;
      const payload = event.payload ?? {};
      const world = Number.isFinite(payload.x) && Number.isFinite(payload.z)
        ? { x: payload.x, z: payload.z }
        : unit;
      const point = this.worldToScreen(world);
      const alpha = (1 - progress) * 0.72;
      const color = payload.resourceType === 'wood'
        ? '#c69559'
        : payload.resourceType === 'food'
          ? '#d76649'
          : payload.resourceType === 'stone'
            ? '#b8c4c4'
            : '#d7aa54';
      ctx.save();
      ctx.globalAlpha = alpha;
      if (event.name === 'tool_contact') {
        const count = payload.resourceType === 'food' ? 3 : 4;
        for (let index = 0; index < count; index += 1) {
          const angle = unit.id * 0.83 + index * (TAU / count);
          const travel = (6 + progress * 18) * this.camera.zoom;
          const x = point.x + Math.cos(angle) * travel;
          const y = point.y - 11 * this.camera.zoom + Math.sin(angle) * travel * 0.45;
          ctx.beginPath();
          ctx.arc(x, y, (1.5 - progress * 0.55) * this.camera.zoom, 0, TAU);
          ctx.fillStyle = color;
          ctx.fill();
        }
      } else if (event.name === 'construction_strike') {
        const radiusX = (8 + progress * 18) * this.camera.zoom;
        const radiusY = (3 + progress * 7) * this.camera.zoom;
        ctx.beginPath();
        ctx.ellipse(point.x, point.y - 6 * this.camera.zoom, radiusX, radiusY, 0, 0, TAU);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, 1.4 * this.camera.zoom);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(point.x - radiusX * 0.45, point.y - radiusY * 1.4, (1.8 - progress) * this.camera.zoom, 0, TAU);
        ctx.fillStyle = '#efd18a';
        ctx.fill();
      } else if (event.name === 'deposit_complete') {
        ctx.beginPath();
        ctx.ellipse(point.x, point.y + 4 * this.camera.zoom, (10 + progress * 26) * this.camera.zoom, (4 + progress * 10) * this.camera.zoom, 0, 0, TAU);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, 1.5 * this.camera.zoom);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(point.x, point.y - 9 * this.camera.zoom, (2.2 - progress) * this.camera.zoom, 0, TAU);
        ctx.fillStyle = '#f0d28a';
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawCombatFeedback(ctx, simulation, time) {
    for (const unit of simulation.units) {
      if (unit.dead || !unit.animationEvents?.length) continue;
      for (const event of unit.animationEvents) {
        if (![ANIMATION_EVENTS.attackStart, ANIMATION_EVENTS.attackHit, ANIMATION_EVENTS.attackWhiff].includes(event.name)) continue;
        const age = (unit.animClock ?? 0) - event.clock;
        const lifetime = event.name === 'attack_hit' ? 0.46 : event.name === 'attack_start' ? 0.24 : 0.28;
        if (age < 0 || age > lifetime) continue;
        const progress = age / lifetime;
        const payload = event.payload ?? {};
        const target = Number.isFinite(payload.x) && Number.isFinite(payload.z) ? { x: payload.x, z: payload.z } : unit;
        const point = this.worldToScreen(target);
        const source = this.worldToScreen(unit);
        ctx.save();
        ctx.globalAlpha = (1 - progress) * (event.name === 'attack_hit' ? 0.82 : 0.34);
        if (event.name === 'attack_hit') {
          const radius = (7 + progress * 13) * this.camera.zoom;
          ctx.strokeStyle = '#f0bd68';
          ctx.lineWidth = Math.max(1, 1.6 * this.camera.zoom);
          ctx.beginPath(); ctx.arc(point.x, point.y - 12 * this.camera.zoom, radius, 0, TAU); ctx.stroke();
          for (let index = 0; index < 4; index += 1) {
            const angle = unit.id * 0.53 + index * Math.PI / 2;
            const inner = radius * 0.55;
            const outer = radius * 1.38;
            ctx.beginPath();
            ctx.moveTo(point.x + Math.cos(angle) * inner, point.y - 12 * this.camera.zoom + Math.sin(angle) * inner * 0.58);
            ctx.lineTo(point.x + Math.cos(angle) * outer, point.y - 12 * this.camera.zoom + Math.sin(angle) * outer * 0.58);
            ctx.stroke();
          }
          ctx.strokeStyle = '#e27a58';
          ctx.globalAlpha *= 0.42;
          ctx.beginPath(); ctx.moveTo(source.x, source.y - 12 * this.camera.zoom); ctx.lineTo(point.x, point.y - 12 * this.camera.zoom); ctx.stroke();
        } else if (event.name === 'attack_start') {
          ctx.strokeStyle = '#d6aa63';
          ctx.lineWidth = Math.max(1, 1.2 * this.camera.zoom);
          ctx.beginPath(); ctx.arc(source.x, source.y - 13 * this.camera.zoom, (8 + progress * 7) * this.camera.zoom, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
        } else {
          ctx.strokeStyle = '#a78b70';
          ctx.lineWidth = Math.max(1, 1.2 * this.camera.zoom);
          ctx.beginPath(); ctx.arc(point.x, point.y - 10 * this.camera.zoom, (6 + progress * 7) * this.camera.zoom, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  drawSelectionMarker(ctx, point, selected, scale, color = FACTION.color) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(point.x, point.y + 6 * this.camera.zoom, 25 * scale * this.camera.zoom, 9 * scale * this.camera.zoom, 0, 0, TAU);
    ctx.fillStyle = selected ? `${color}42` : 'rgba(9, 20, 19, 0.23)';
    ctx.fill();
    ctx.strokeStyle = selected ? color : 'rgba(232, 210, 144, 0.16)';
    ctx.lineWidth = selected ? 2 : 1;
    ctx.stroke();
    if (selected) {
      ctx.beginPath();
      ctx.arc(point.x, point.y + 6 * this.camera.zoom, 29 * scale * this.camera.zoom, Math.PI * 0.12, Math.PI * 0.42);
      ctx.strokeStyle = `${color}cc`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(point.x, point.y + 6 * this.camera.zoom, 29 * scale * this.camera.zoom, Math.PI * 0.62, Math.PI * 0.92);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawHealthBar(ctx, x, y, width, value, label, force = false) {
    if (value >= 0.999 && !label && !force) return;
    ctx.save();
    ctx.fillStyle = 'rgba(12, 22, 23, 0.72)';
    ctx.beginPath(); ctx.roundRect(x - width / 2, y, width, 5, 2.5); ctx.fill();
    ctx.fillStyle = value > 0.45 ? '#71c18b' : value > 0.2 ? '#e1b35f' : '#d96555';
    const fillWidth = width * Math.max(0, value);
    if (fillWidth > 0) { ctx.beginPath(); ctx.roundRect(x - width / 2, y, fillWidth, 5, 2.5); ctx.fill(); }
    if (label) {
      ctx.font = '700 9px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff0c7';
      ctx.fillText(label, x, y - 4);
    }
    ctx.restore();
  }

  drawCarryBadge(ctx, x, y, type, amount) {
    ctx.save();
    const color = RESOURCE_TYPES[type]?.color ?? '#fff';
    const label = `${RESOURCE_TYPES[type]?.label?.[0] ?? '?'}${amount}`;
    ctx.font = '700 8px Inter, sans-serif';
    const width = Math.max(24, ctx.measureText(label).width + 8);
    ctx.fillStyle = 'rgba(15, 25, 25, 0.9)';
    ctx.beginPath(); ctx.roundRect(x - 5, y - 7, width, 14, 6); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#fff1c8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x - 5 + width / 2, y);
    ctx.restore();
  }

  drawAttackRing(ctx, point, time, phase = 'approach') {
    ctx.save();
    ctx.beginPath(); ctx.arc(point.x, point.y + 4, 19 * this.camera.zoom + Math.sin(time * 0.01) * 2, 0, TAU);
    ctx.strokeStyle = phase === 'contact' ? 'rgba(240, 189, 104, 0.78)' : phase === 'anticipation' ? 'rgba(222, 158, 80, 0.52)' : 'rgba(222, 105, 80, 0.46)';
    ctx.lineWidth = phase === 'contact' ? 2.2 : 1.5;
    ctx.stroke(); ctx.restore();
  }

  drawHitFlash(ctx, point, time) {
    ctx.save();
    ctx.globalAlpha = 0.48 + Math.sin(time * 0.04) * 0.12;
    ctx.beginPath();
    ctx.arc(point.x, point.y - 20 * this.camera.zoom, 11 * this.camera.zoom, 0, TAU);
    ctx.strokeStyle = '#ef9a72';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  drawBuildPreview(ctx) {
    if (!this.buildPreview) return;
    const point = this.worldToScreen(this.buildPreview.world);
    const type = this.buildPreview.type ?? 'house';
    const size = this.buildingRenderSize(type) * this.camera.zoom;
    ctx.save();
    ctx.globalAlpha = this.buildPreview.valid ? 0.58 : 0.28;
    const column = BUILDING_STAGE_ATLAS.columnByType[type] ?? BUILDING_STAGE_ATLAS.columnByType.house;
    if (!this.drawAtlasCell(ctx, this.buildingStages, this.buildingStagesReady, BUILDING_STAGE_ATLAS, column, BUILDING_STAGE_ATLAS.rowByStage.foundation, point, size, 0.9)) {
      this.drawAsset(ctx, BUILDING_TYPES[type]?.asset ?? 'house', point, size, 0.9);
    }
    ctx.globalAlpha = 1;
    this.drawBuildingFootprint(ctx, { type, x: this.buildPreview.world.x, z: this.buildPreview.world.z }, false, this.buildPreview.valid ? '#a6d4a8' : '#e27964');
    ctx.beginPath(); ctx.ellipse(point.x, point.y + 8, size * 0.32, size * 0.12, 0, 0, TAU);
    ctx.strokeStyle = this.buildPreview.valid ? '#a6d4a8' : '#e27964'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = '700 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.buildPreview.valid ? '#d6edc5' : '#ffd0ba';
    ctx.fillText(this.buildPreview.valid ? 'SITE READY' : 'CANNOT PLACE', point.x, point.y + size * 0.2);
    ctx.restore();
  }

  drawRipples(ctx, time, delta = 0) {
    for (const ripple of this.ripples) {
      ripple.age += delta;
      const point = this.worldToScreen(ripple.world);
      const progress = Math.min(1, ripple.age / 0.8);
      ctx.save();
      ctx.globalAlpha = 1 - progress;
      ctx.beginPath(); ctx.ellipse(point.x, point.y + 4, (12 + progress * 32) * this.camera.zoom, (5 + progress * 12) * this.camera.zoom, 0, 0, TAU);
      ctx.strokeStyle = ripple.color; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    }
    this.ripples = this.ripples.filter((ripple) => ripple.age < 0.8);
  }

  drawSelectionBox(ctx) {
    const box = this.selectionBox;
    ctx.save();
    ctx.fillStyle = 'rgba(134, 196, 207, 0.12)';
    ctx.strokeStyle = FACTION.color;
    ctx.lineWidth = 1.5;
    ctx.fillRect(box.x, box.y, box.width, box.height);
    ctx.strokeRect(box.x, box.y, box.width, box.height);
    ctx.restore();
  }

}
