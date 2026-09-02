import { ANCIENT_FOREST_ATLAS, ASHEN_BUILDING_ASSETS, ASSET_RECTS, COMBAT_ATLASES, CONFIG, ENEMY_CAMP_ASSET, FACTION, GOLD_DEPOSIT_ASSETS, LARGE_STONE_ASSET, LIGHTING, RESOURCE_SIZE_TIERS, RESOURCE_TYPES, UNIT_TYPES, BUILDING_TYPES, VILLAGER_ATLASES, ENVIRONMENT_ATLAS, TREE_ATLAS, ROAD_DETAILS_ATLAS, BUILDING_STAGE_ATLAS, TREE_GROVE_ATLAS, WILDWOOD_FOREST_ATLAS, FIRST_AGE_ASSETS, resourceDepletionStage } from './config.js?v=20260902-buildingperimeter1';
import { ANIMATION_EVENTS, animationDefinition, animationFrame, resolveAnimationState } from './animation.js?v=20260902-buildingperimeter1';

const TAU = Math.PI * 2;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// Occlusion only needs nearby static bodies. Querying the simulation's
// spatial blocker grid keeps this visual readability pass bounded when a
// dense Wildwood scene or the optional stress population is active.
const OCCLUSION_QUERY_RADIUS = 12;

export function resolveWallVisual(direction = { x: 1, z: 0 }) {
  const magnitude = Math.hypot(direction.x, direction.z) || 1;
  const dx = direction.x / magnitude;
  const dz = direction.z / magnitude;
  const screenX = dx - dz;
  const screenY = (dx + dz) * (CONFIG.tileHeight / CONFIG.tileWidth);
  if (Math.abs(screenX) < 0.001) return { asset: 'wallDepth', orientation: 'depth' };
  if (Math.abs(screenY) < 0.001) return { asset: 'wallFace', orientation: 'face' };
  return screenX * screenY < 0
    ? { asset: 'wallDiagonalLeft', orientation: 'diagonal-left' }
    : { asset: 'wall', orientation: 'diagonal-right' };
}

export function resolveFirstAgeConstructionStage(progress = 1) {
  if (progress >= 1) return 'complete';
  if (progress < 0.1) return 'foundation';
  if (progress < 0.68) return 'partial';
  return 'nearComplete';
}

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
    points: [{ x: 18, z: 48 }, { x: 15, z: 43 }, { x: 11, z: 37 }, { x: 8, z: 32 }, { x: 9, z: 27 }],
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
    points: [{ x: 32.5, z: 45.6 }, { x: 36, z: 46.3 }, { x: 40, z: 47.5 }, { x: 43, z: 48 }],
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
    this.treeAtlasReady = false;
    this.buildingStagesReady = false;
    this.treeGroveReady = false;
    this.ancientForestReady = false;
    this.wildwoodForestReady = false;
    this.largeStoneReady = false;
    this.goldDepositAssetReady = {};
    this.firstAgeAssetReady = {};
    this.firstAgeConstructionAssetReady = {};
    this.firstAgeConstructionAtlases = {};
    this.firstAgeConstructionAtlasReady = {};
    this.ashenBuildingAssets = {};
    this.ashenBuildingAssetReady = {};
    this.ashenSupportAtlasReady = false;
    this.ashenFortificationAtlasReady = false;
    this.ashenConstructionAtlasReady = false;
    this.enemyCampReady = false;
    this.villagerAtlases = {};
    this.villagerAtlasReady = {};
    this.combatAtlases = {};
    this.combatAtlasReady = {};
    this.atlas.addEventListener('load', () => { this.atlasReady = true; });
    this.meadow.addEventListener('load', () => {
      this.meadowReady = true;
      this.meadowPattern = null;
      this.invalidateStaticLayer();
    });
    this.road.addEventListener('load', () => {
      this.roadReady = true;
      this.roadPattern = null;
      this.invalidateStaticLayer();
    });
    this.roadsideProps.addEventListener('load', () => { this.roadsidePropsReady = true; });
    this.environmentAtlas = new Image();
    this.treeAtlas = new Image();
    this.buildingStages = new Image();
    this.treeGroveAtlas = new Image();
    this.ancientForestAtlas = new Image();
    this.wildwoodForestAtlas = new Image();
    this.largeStone = new Image();
    this.goldDepositAssets = {};
    this.enemyCamp = new Image();
    this.environmentAtlas.addEventListener('load', () => { this.environmentReady = true; });
    this.treeAtlas.addEventListener('load', () => { this.treeAtlasReady = true; });
    this.buildingStages.addEventListener('load', () => { this.buildingStagesReady = true; });
    this.treeGroveAtlas.addEventListener('load', () => { this.treeGroveReady = true; });
    this.ancientForestAtlas.addEventListener('load', () => { this.ancientForestReady = true; });
    this.wildwoodForestAtlas.addEventListener('load', () => { this.wildwoodForestReady = true; });
    this.largeStone.addEventListener('load', () => { this.largeStoneReady = true; });
    this.enemyCamp.addEventListener('load', () => { this.enemyCampReady = true; });
    this.atlas.src = './assets/crownforge-asset-atlas.png';
    this.meadow.src = './assets/crownforge-grass-tile-v1.png?v=20260818-roads2';
    this.road.src = './assets/crownforge-dirt-road-tile-v1.png?v=20260818-roads2';
    this.roadsideProps.src = ROAD_DETAILS_ATLAS.src;
    this.environmentAtlas.src = ENVIRONMENT_ATLAS.src;
    this.treeAtlas.src = TREE_ATLAS.src;
    this.buildingStages.src = BUILDING_STAGE_ATLAS.src;
    this.treeGroveAtlas.src = TREE_GROVE_ATLAS.src;
    this.ancientForestAtlas.src = ANCIENT_FOREST_ATLAS.src;
    this.wildwoodForestAtlas.src = WILDWOOD_FOREST_ATLAS.src;
    this.largeStone.src = LARGE_STONE_ASSET.src;
    this.enemyCamp.src = ENEMY_CAMP_ASSET.src;
    for (const [key, definition] of Object.entries(GOLD_DEPOSIT_ASSETS)) {
      const image = new Image();
      this.goldDepositAssets[key] = image;
      this.goldDepositAssetReady[key] = false;
      image.addEventListener('load', () => { this.goldDepositAssetReady[key] = true; });
      image.src = definition.src;
    }
    this.firstAgeAssets = {};
    this.firstAgeConstructionAssets = {};
    for (const [key, definition] of Object.entries(FIRST_AGE_ASSETS)) {
      const image = new Image();
      this.firstAgeAssets[key] = image;
      this.firstAgeAssetReady[key] = false;
      image.addEventListener('load', () => { this.firstAgeAssetReady[key] = true; });
      image.src = definition.src;
      const constructionStages = definition.constructionStages ?? {};
      this.firstAgeConstructionAssets[key] = {};
      this.firstAgeConstructionAssetReady[key] = {};
      for (const [stage, stageDefinition] of Object.entries(constructionStages)) {
        const stageImage = new Image();
        this.firstAgeConstructionAssets[key][stage] = stageImage;
        this.firstAgeConstructionAssetReady[key][stage] = false;
        stageImage.addEventListener('load', () => { this.firstAgeConstructionAssetReady[key][stage] = true; });
        stageImage.src = stageDefinition.src;
      }
      const constructionAtlas = definition.constructionAtlas;
      if (constructionAtlas) {
        const stageAtlas = new Image();
        this.firstAgeConstructionAtlases[key] = stageAtlas;
        this.firstAgeConstructionAtlasReady[key] = false;
        stageAtlas.addEventListener('load', () => { this.firstAgeConstructionAtlasReady[key] = true; });
        stageAtlas.src = constructionAtlas.src;
      }
    }
    for (const [key, definition] of Object.entries(ASHEN_BUILDING_ASSETS)) {
      if (!definition.src || key === 'ashenCamp') continue;
      const image = new Image();
      this.ashenBuildingAssets[key] = image;
      this.ashenBuildingAssetReady[key] = false;
      image.addEventListener('load', () => { this.ashenBuildingAssetReady[key] = true; });
      image.src = definition.src;
    }
    this.ashenSupportAtlas = new Image();
    this.ashenSupportAtlas.addEventListener('load', () => { this.ashenSupportAtlasReady = true; });
    this.ashenSupportAtlas.src = ASHEN_BUILDING_ASSETS.smokeGranary.atlas.src;
    this.ashenFortificationAtlas = new Image();
    this.ashenFortificationAtlas.addEventListener('load', () => { this.ashenFortificationAtlasReady = true; });
    this.ashenFortificationAtlas.src = ASHEN_BUILDING_ASSETS.ashenWall.atlas.src;
    this.ashenConstructionAtlas = new Image();
    this.ashenConstructionAtlas.addEventListener('load', () => { this.ashenConstructionAtlasReady = true; });
    this.ashenConstructionAtlas.src = ASHEN_BUILDING_ASSETS.reaverLodge.constructionAtlas.src;
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
    this.demolitionPreview = [];
    this.ripples = [];
    this.roadsideDetails = CONFIG.startingRoads ? [
      { kind: 'roadside', type: 'fence', x: 7.1, z: 38.2, size: 112, depthBias: 0.3 },
      { kind: 'roadside', type: 'sign', x: 30.2, z: 45.1, size: 94, depthBias: 0.3 },
      { kind: 'roadside', type: 'cargo', x: 35.2, z: 46.1, size: 102, depthBias: 0.3 },
      { kind: 'roadside', type: 'lantern', x: 27.1, z: 41.1, size: 94, depthBias: 0.3 },
      { kind: 'roadside-shrub', type: 'flowers', variant: 1, x: 17.1, z: 49.7, size: 50, depthBias: 0.2 },
      { kind: 'roadside-shrub', type: 'flowers', variant: 2, x: 46.7, z: 34.1, size: 46, depthBias: 0.2 },
    ] : [];
    this.lastRenderTime = 0;
    const query = new URLSearchParams(window.location.search);
    this.diagnostics = query.has('lighting-benchmark');
    this.lowResolutionMode = query.has('lowres');
    this.resolutionScale = 1;
    this.staticLayer = document.createElement('canvas');
    this.staticLayerKey = null;
    this.palisadeJunctionCacheKey = '';
    this.palisadeJunctionCache = [];
    this.viewportBounds = null;
    this.daylightEnabled = !query.has('lighting-off');
    this.frameStats = { count: 0, samples: [] };
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  startupReadiness() {
    // Hold the simulation behind the loading veil until every asset needed by
    // the opening match can draw at production quality. Build-only and later
    // action atlases may continue warming in the browser cache afterward.
    const required = [
      this.meadow,
      this.environmentAtlas,
      this.treeAtlas,
      this.treeGroveAtlas,
      this.ancientForestAtlas,
      this.largeStone,
      this.enemyCamp,
      this.firstAgeAssets.townCenter,
      this.goldDepositAssets.small,
      this.goldDepositAssets.medium,
      this.goldDepositAssets.large,
      this.villagerAtlases.motionLoop,
      this.villagerAtlases.defenseAttackLoop,
      this.villagerAtlases.statusEffects,
      this.combatAtlases.soldier,
      this.combatAtlases.soldierWalk,
      this.combatAtlases.raider,
      this.combatAtlases.raiderWalk,
      this.combatAtlases.raiderStunned,
      this.combatAtlases.ashenForagerMotion,
      this.combatAtlases.ashenForagerWork,
      this.combatAtlases.ashenForagerCarry,
      this.firstAgeAssets.stable,
      this.firstAgeConstructionAtlases.stable,
      this.firstAgeAssets.granary,
      this.firstAgeConstructionAtlases.granary,
      this.firstAgeAssets.homestead,
      this.firstAgeConstructionAtlases.homestead,
      this.firstAgeAssets.watchHut,
      this.firstAgeConstructionAtlases.watchHut,
      this.firstAgeAssets.palisadeTower,
      this.firstAgeConstructionAtlases.palisadeTower,
      this.firstAgeAssets.palisadeJunction,
      this.firstAgeAssets.timberYard,
      this.firstAgeConstructionAtlases.timberYard,
      this.firstAgeAssets.stonewrightYard,
      this.firstAgeConstructionAtlases.stonewrightYard,
      this.combatAtlases.scout,
      this.combatAtlases.scoutWalk,
      this.combatAtlases.scoutAttack,
      this.combatAtlases.spearwarden,
      this.combatAtlases.spearwardenWalk,
      this.combatAtlases.spearwardenAttack,
      this.combatAtlases.militia,
      this.combatAtlases.militiaWalk,
      this.combatAtlases.militiaAttack,
      this.combatAtlases.shieldbearer,
      this.combatAtlases.shieldbearerWalk,
      this.combatAtlases.shieldbearerAttack,
    ].filter(Boolean);
    const loaded = required.filter((image) => image.complete && image.naturalWidth > 0).length;
    const total = required.length;
    return { loaded, total, ratio: total ? loaded / total : 1, ready: loaded === total };
  }

  resize() {
    const ratio = this.lowResolutionMode ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    this.resolutionScale = ratio;
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.staticLayer.width = this.canvas.width;
    this.staticLayer.height = this.canvas.height;
    this.invalidateStaticLayer();
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
  setDemolitionPreview(buildings = []) { this.demolitionPreview = Array.isArray(buildings) ? buildings : []; }

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
    this.clampCamera();
    this.invalidateStaticLayer();
  }

  clampCamera() {
    const halfMapW = ((CONFIG.mapWidth + CONFIG.mapHeight) * CONFIG.tileWidth / 4) * this.camera.zoom;
    const halfMapH = ((CONFIG.mapWidth + CONFIG.mapHeight) * CONFIG.tileHeight / 4) * this.camera.zoom;
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
    const previousZoom = this.camera.zoom;
    const nextZoom = Math.max(CONFIG.minZoom, Math.min(CONFIG.maxZoom, previousZoom * factor));
    if (Math.abs(nextZoom - previousZoom) < 0.0001) return;

    // Resolve the world point under the cursor before changing scale, then
    // solve the camera offset directly for that same point. This avoids the
    // old two-pass correction drifting toward the lower-right when the map
    // edge clamp is active on the expanded board.
    const anchoredWorld = this.screenToWorld(screenPoint);
    const worldX = (anchoredWorld.x - anchoredWorld.z - (CONFIG.mapWidth - CONFIG.mapHeight) / 2) * CONFIG.tileWidth / 2;
    const worldY = (anchoredWorld.x + anchoredWorld.z - (CONFIG.mapWidth + CONFIG.mapHeight) / 2) * CONFIG.tileHeight / 2;
    this.camera.zoom = nextZoom;
    this.camera.x = screenPoint.x - this.width / 2 - worldX * nextZoom;
    this.camera.y = screenPoint.y - this.height / 2 - worldY * nextZoom;
    this.clampCamera();
    this.invalidateStaticLayer();
  }

  invalidateStaticLayer() {
    this.staticLayerKey = null;
  }

  viewportWorldBounds(padding = 0) {
    const corners = [
      this.screenToWorld({ x: 0, y: 0 }),
      this.screenToWorld({ x: this.width, y: 0 }),
      this.screenToWorld({ x: this.width, y: this.height }),
      this.screenToWorld({ x: 0, y: this.height }),
    ];
    return {
      minX: Math.min(...corners.map((point) => point.x)) - padding,
      maxX: Math.max(...corners.map((point) => point.x)) + padding,
      minZ: Math.min(...corners.map((point) => point.z)) - padding,
      maxZ: Math.max(...corners.map((point) => point.z)) + padding,
    };
  }

  isWorldVisible(point, radius = 0) {
    const bounds = this.viewportBounds ?? this.viewportWorldBounds();
    return point.x + radius >= bounds.minX && point.x - radius <= bounds.maxX
      && point.z + radius >= bounds.minZ && point.z - radius <= bounds.maxZ;
  }

  entityCullRadius(entity) {
    if (entity.kind === 'unit') return 3;
    if (entity.kind === 'resource') {
      const tierScale = RESOURCE_SIZE_TIERS[entity.sizeTier ?? 'small']?.renderScale ?? 1;
      const base = entity.type === 'grove' ? 7 : entity.type === 'grain' ? 8 : entity.type === 'berry' ? 4 : 5;
      return base * tierScale;
    }
    if (entity.kind === 'building') {
      const footprint = this.buildingFootprint(entity);
      return Math.max(4, footprint.width, footprint.height, this.buildingRenderSize(entity) / 24);
    }
    return Math.max(3, (entity.size ?? 50) / 24);
  }

  ensureStaticLayer() {
    const key = [this.width, this.height, this.camera.x, this.camera.y, this.camera.zoom, this.meadowReady, this.roadReady, this.daylightEnabled].join('|');
    if (this.staticLayerKey === key) return;
    const staticCtx = this.staticLayer.getContext('2d');
    staticCtx.setTransform(this.resolutionScale, 0, 0, this.resolutionScale, 0, 0);
    staticCtx.clearRect(0, 0, this.width, this.height);
    this.drawMap(staticCtx, 0);
    this.staticLayerKey = key;
  }

  render(simulation, input, time) {
    const renderStart = this.diagnostics ? window.performance.now() : 0;
    const renderDelta = this.lastRenderTime ? Math.min(0.05, Math.max(0, (time - this.lastRenderTime) / 1000)) : 0;
    this.lastRenderTime = time;
    const ctx = this.ctx;
    this.viewportBounds = this.viewportWorldBounds(3);
    ctx.clearRect(0, 0, this.width, this.height);
    this.drawBackdrop(ctx);
    this.ensureStaticLayer();
    ctx.drawImage(this.staticLayer, 0, 0, this.width, this.height);
    this.drawExplorationOverlay(ctx, simulation);
    this.drawPaths(ctx, simulation);
    this.drawGuardZones(ctx, simulation);
    this.drawPatrolRoutes(ctx, simulation);
    this.drawRallyPoints(ctx, simulation);
    this.drawWorldEntities(ctx, simulation, time);
    this.drawDefenseProjectiles(ctx, simulation);
    // Placement is a planning state, so the monumental Hall gets a quiet
    // vision overlay after normal depth sorting. This keeps its far side
    // readable without changing normal gameplay occlusion.
    this.drawCrownHallPlacementVision(ctx, simulation);
    this.drawOccludedUnitOverlays(ctx, simulation);
    this.drawWorkFeedback(ctx, simulation, time);
    this.drawCombatFeedback(ctx, simulation, time);
    this.drawDemolitionPreview(ctx);
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
      ctx.globalAlpha = 0.72;
      // At distant zoom the full-resolution meadow used to collapse into a
      // grid of tiny repeated squares. Hold the texture at a readable terrain
      // LOD while the world continues to zoom normally. This removes the
      // checkerboard without adding another per-frame world layer: the result
      // remains part of the cached static terrain canvas.
      const pattern = this.meadowPattern ?? (this.meadowPattern = ctx.createPattern(this.meadow, 'repeat'));
      const canTransformPattern = pattern && typeof pattern.setTransform === 'function' && typeof DOMMatrix === 'function';
      if (canTransformPattern) {
        const terrainPatternScale = Math.max(this.camera.zoom, 0.12);
        pattern.setTransform(new DOMMatrix([
          terrainPatternScale,
          0,
          0,
          terrainPatternScale,
          this.width / 2 + this.camera.x,
          this.height / 2 + this.camera.y,
        ]));
        this.canvas.dataset.terrainLodScale = terrainPatternScale.toFixed(3);
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

    // A second broad, cross-map grade breaks up repeated local grass values
    // into authored-looking meadow regions. Two cached gradients are much
    // cheaper than drawing noise, decals, or a second terrain image every
    // frame and remain stable while panning.
    const meadowRegions = ctx.createLinearGradient(x + width * 0.08, y + height * 0.82, x + width * 0.92, y + height * 0.18);
    meadowRegions.addColorStop(0, 'rgba(99, 118, 57, 0.1)');
    meadowRegions.addColorStop(0.24, 'rgba(164, 153, 78, 0.025)');
    meadowRegions.addColorStop(0.52, 'rgba(52, 91, 58, 0.075)');
    meadowRegions.addColorStop(0.76, 'rgba(154, 137, 70, 0.03)');
    meadowRegions.addColorStop(1, 'rgba(38, 70, 51, 0.1)');
    ctx.fillStyle = meadowRegions;
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
    if (!CONFIG.startingRoads) return;
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
      if (!unit.selected || unit.dead || !unit.path.length || !this.isWorldVisible(unit, 2)) continue;
      const start = this.unitScreenPoint(unit);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      for (const point of unit.path) {
        const screen = this.worldToScreen(point);
        ctx.lineTo(screen.x, screen.y);
      }
      const destructive = unit.command === 'attack' || unit.command === 'demolish';
      ctx.strokeStyle = destructive ? 'rgba(222, 105, 80, 0.58)' : 'rgba(195, 229, 207, 0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      const destination = this.worldToScreen(unit.path[unit.path.length - 1]);
      ctx.beginPath();
      ctx.arc(destination.x, destination.y, 5 * this.camera.zoom, 0, TAU);
      ctx.strokeStyle = destructive ? 'rgba(222, 105, 80, 0.8)' : 'rgba(195, 229, 207, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(destination.x, destination.y, 1.8 * this.camera.zoom, 0, TAU);
      ctx.fillStyle = destructive ? '#de6950' : '#c3e5cf';
      ctx.fill();
    }
    ctx.restore();
  }

  drawGuardZones(ctx, simulation) {
    const zones = new Map();
    for (const unit of simulation.units) {
      if (unit.dead || !unit.guardPoint || !this.isWorldVisible(unit.guardPoint, unit.guardRadius + 2)) continue;
      const key = `${unit.guardPoint.x.toFixed(2)}:${unit.guardPoint.z.toFixed(2)}:${unit.guardRadius.toFixed(2)}`;
      if (!zones.has(key)) zones.set(key, unit);
    }
    for (const unit of zones.values()) {
      const center = this.worldToScreen(unit.guardPoint);
      const east = this.worldToScreen({ x: unit.guardPoint.x + unit.guardRadius, z: unit.guardPoint.z });
      const south = this.worldToScreen({ x: unit.guardPoint.x, z: unit.guardPoint.z + unit.guardRadius });
      const west = this.worldToScreen({ x: unit.guardPoint.x - unit.guardRadius, z: unit.guardPoint.z });
      const north = this.worldToScreen({ x: unit.guardPoint.x, z: unit.guardPoint.z - unit.guardRadius });
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(north.x, north.y);
      ctx.lineTo(east.x, east.y);
      ctx.lineTo(south.x, south.y);
      ctx.lineTo(west.x, west.y);
      ctx.closePath();
      ctx.fillStyle = 'rgba(134, 196, 207, 0.07)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(134, 196, 207, 0.55)';
      ctx.lineWidth = Math.max(1, 1.4 * this.camera.zoom);
      ctx.setLineDash([6 * this.camera.zoom, 7 * this.camera.zoom]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(center.x, center.y, Math.max(2, 4 * this.camera.zoom), 0, TAU);
      ctx.fillStyle = '#86c4cf';
      ctx.fill();
      ctx.restore();
    }
  }

  drawPatrolRoutes(ctx, simulation) {
    for (const unit of simulation.units) {
      if (!unit.selected || unit.dead || !unit.patrolActive || unit.patrolPoints.length < 2) continue;
      if (!unit.patrolPoints.some((point) => this.isWorldVisible(point, 2))) continue;
      const points = unit.patrolPoints.map((point) => this.worldToScreen(point));
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(215, 170, 84, 0.72)';
      ctx.lineWidth = Math.max(1, 1.5 * this.camera.zoom);
      ctx.setLineDash([5 * this.camera.zoom, 5 * this.camera.zoom]);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const point of points) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, Math.max(2.5, 4.5 * this.camera.zoom), 0, TAU);
        ctx.fillStyle = 'rgba(215, 170, 84, 0.88)';
        ctx.fill();
        ctx.strokeStyle = '#243531';
        ctx.lineWidth = Math.max(1, this.camera.zoom);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawRallyPoints(ctx, simulation) {
    for (const building of simulation.buildings) {
      if (!building.selected || building.destroyed || !building.rallyPoint || !this.isWorldVisible(building.rallyPoint, 2)) continue;
      const point = this.worldToScreen(building.rallyPoint);
      ctx.save();
      ctx.strokeStyle = 'rgba(134, 196, 207, 0.88)';
      ctx.fillStyle = 'rgba(134, 196, 207, 0.2)';
      ctx.lineWidth = Math.max(1, 1.4 * this.camera.zoom);
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.max(4, 7 * this.camera.zoom), 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(point.x - 4 * this.camera.zoom, point.y);
      ctx.lineTo(point.x + 4 * this.camera.zoom, point.y);
      ctx.moveTo(point.x, point.y - 4 * this.camera.zoom);
      ctx.lineTo(point.x, point.y + 4 * this.camera.zoom);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawExplorationOverlay(ctx, simulation) {
    const snapshot = simulation.getExplorationSnapshot?.();
    if (!snapshot?.enabled) return;
    const explored = new Set(snapshot.cells);
    const cellSize = snapshot.cellSize;
    const columns = Math.ceil(CONFIG.mapWidth / cellSize);
    const rows = Math.ceil(CONFIG.mapHeight / cellSize);
    ctx.save();
    ctx.fillStyle = 'rgba(8, 18, 19, 0.48)';
    for (let cellZ = 0; cellZ < rows; cellZ += 1) {
      for (let cellX = 0; cellX < columns; cellX += 1) {
        if (explored.has(`${cellX}:${cellZ}`)) continue;
        const corners = [
          this.worldToScreen({ x: cellX * cellSize, z: cellZ * cellSize }),
          this.worldToScreen({ x: Math.min(CONFIG.mapWidth, (cellX + 1) * cellSize), z: cellZ * cellSize }),
          this.worldToScreen({ x: Math.min(CONFIG.mapWidth, (cellX + 1) * cellSize), z: Math.min(CONFIG.mapHeight, (cellZ + 1) * cellSize) }),
          this.worldToScreen({ x: cellX * cellSize, z: Math.min(CONFIG.mapHeight, (cellZ + 1) * cellSize) }),
        ];
        if (corners.every((point) => point.x < -2 || point.x > this.width + 2 || point.y < -2 || point.y > this.height + 2)) continue;
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (const point of corners.slice(1)) ctx.lineTo(point.x, point.y);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawWorldEntities(ctx, simulation, time) {
    const kindOrder = { building: 0, 'wall-segment': 0.1, 'tower-connector': 0.25, 'wall-junction': 0.5, resource: 1, roadside: 2, 'roadside-shrub': 2, decoration: 3, unit: 4 };
    const palisadeJunctions = simulation.getPalisadeJunctions();
    const entities = [
      ...simulation.buildings.flatMap((entity) => {
        if (entity.type === 'wall') return this.wallSegmentEntities(entity, palisadeJunctions);
        if (!this.isWorldVisible(entity, this.entityCullRadius(entity))) return [];
        // Gate and tower artwork is the authoritative join surface. A long
        // attached wall is stored as one simulation building, so its center
        // can otherwise sort a near panel over the hardpoint and make posts
        // appear to run through the tower. These restrained base-depth biases
        // keep the opening/hardpoint in front only inside its own visual mass.
        const fortificationBias = entity.type === 'palisadeTower' ? 1.15 : entity.type === 'gate' ? 3 : 0.2;
        return [{ ...entity, depth: entity.field ? -10000 + entity.x + entity.z : entity.x + entity.z + fortificationBias }];
      }),
      ...this.palisadeTowerConnectorEntities(simulation)
        .filter((entity) => this.isWorldVisible(entity, 3))
        .map((entity) => ({ ...entity, depth: entity.x + entity.z + 0.25 })),
      ...this.palisadeJunctionEntities(simulation).filter((entity) => this.isWorldVisible(entity, 3)).map((entity) => ({ ...entity, depth: entity.x + entity.z + 0.48 })),
      // A depleted wood node is simulation bookkeeping only. Its authored
      // forest/stump atlas is intentionally removed at zero so cleared land
      // returns to the meadow and cannot cover buildings or villagers.
      ...simulation.resourcesNodes
        .filter((entity) => entity.amount > 0 || entity.resourceType !== 'wood')
        .filter((entity) => this.isWorldVisible(entity, this.entityCullRadius(entity)))
        .map((entity) => ({ ...entity, depth: entity.type === 'grain' ? -9999 + entity.x + entity.z : entity.x + entity.z + 0.3 })),
      ...this.roadsideDetails.filter((entity) => this.isWorldVisible(entity, this.entityCullRadius(entity))).map((entity, index) => ({
        ...entity,
        id: -1000 - index,
        depth: entity.x + entity.z + (entity.depthBias ?? 0.25),
      })),
      ...simulation.decorations.filter((entity) => this.isWorldVisible(entity, this.entityCullRadius(entity))).map((entity) => ({ ...entity, depth: entity.x + entity.z + 0.34 })),
      ...simulation.units.filter((entity) => this.isWorldVisible(entity, this.entityCullRadius(entity))).map((entity) => ({ ...entity, depth: entity.x + entity.z + 0.7 })),
    ].sort((a, b) => a.depth - b.depth || (kindOrder[a.kind] ?? 0) - (kindOrder[b.kind] ?? 0) || a.id - b.id);
    for (const entity of entities) {
      if (entity.dead && entity.deathAge > 2.4) continue;
      if (entity.destroyed && entity.destroyAge > 2.4) continue;
      if (entity.kind === 'building' || entity.kind === 'wall-segment') this.drawBuilding(ctx, entity, time);
      else if (entity.kind === 'tower-connector') this.drawPalisadeTowerConnector(ctx, entity);
      else if (entity.kind === 'wall-junction') this.drawPalisadeJunction(ctx, entity);
      else if (entity.kind === 'resource') this.drawResource(ctx, entity, time);
      else if (entity.kind === 'roadside' || entity.kind === 'roadside-shrub') this.drawRoadsideDetail(ctx, entity);
      else if (entity.kind === 'decoration') this.drawDecoration(ctx, entity);
      else this.drawUnit(ctx, entity, time);
    }
  }

  wallSegmentPoints(wall) {
    const blueprint = BUILDING_TYPES.wall;
    const count = Math.max(1, Math.round(wall.wallSegments ?? 1));
    const span = blueprint.wallSegmentSpan ?? blueprint.footprint.width;
    const direction = wall.wallDirection
      ?? (wall.wallOrientation === 'vertical' ? { x: 0, z: 1 } : { x: 1, z: 0 });
    const magnitude = Math.hypot(direction.x, direction.z) || 1;
    const dx = direction.x / magnitude;
    const dz = direction.z / magnitude;
    const start = wall.wallStart ?? {
      x: wall.x - dx * (count - 1) * span / 2,
      z: wall.z - dz * (count - 1) * span / 2,
    };
    return {
      direction: { x: dx, z: dz },
      points: Array.from({ length: count }, (_, index) => ({
        x: start.x + dx * index * span,
        z: start.z + dz * index * span,
      })),
    };
  }

  wallSegmentEntities(wall, junctions = []) {
    if (!wall) return [];
    const { direction, points } = this.wallSegmentPoints(wall);
    return points
      .map((point, index) => ({ point, index }))
      .filter(({ point }) => this.isWorldVisible(point, 3))
      .map(({ point, index }) => {
        const socket = junctions.find((junction) => junction.members?.some((member) => member.wallId === wall.id
          && member.segmentIndex === index
          && member.side !== 'middle'));
        return {
          ...wall,
          kind: 'wall-segment',
          x: point.x,
          z: point.z,
          wallStart: { ...point },
          wallDirection: { ...direction },
          wallSegments: 1,
          wallSegmentEntity: true,
          wallSegmentIndex: index,
          wallSegmentCount: points.length,
          wallJunctionClip: socket ? { x: socket.x, z: socket.z } : null,
          depth: point.x + point.z + 0.2,
        };
      });
  }

  palisadeTowerConnectorEntities(simulation) {
    return simulation.buildings
      .filter((building) => building.type === 'palisadeTower'
        && !building.destroyed
        && building.progress > 0.08
        && building.attachmentConnectorSegments?.length)
      .flatMap((tower) => tower.attachmentConnectorSegments.map((segment, index) => ({
        id: `tower-connector-${tower.id}-${index}`,
        kind: 'tower-connector',
        x: segment.x,
        z: segment.z,
        direction: segment.direction,
        socketX: segment.socketX ?? tower.x,
        socketZ: segment.socketZ ?? tower.z,
        alpha: Math.min(1, 0.55 + tower.progress * 0.45),
      })));
  }

  drawPalisadeTowerConnector(ctx, connector) {
    const point = this.worldToScreen(connector);
    const visual = resolveWallVisual(connector.direction);
    this.drawWallPanel(ctx, {
      wallJunctionClip: { x: connector.socketX, z: connector.socketZ },
    }, visual.asset, point, this.buildingRenderSize('wall') * this.camera.zoom, connector.alpha ?? 1);
  }

  drawDefenseProjectiles(ctx, simulation) {
    const projectiles = simulation.projectiles ?? [];
    if (!projectiles.length) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const projectile of projectiles) {
      if (!this.isWorldVisible(projectile, 3)) continue;
      const head = this.worldToScreen(projectile);
      const previous = this.worldToScreen({ x: projectile.previousX, z: projectile.previousZ });
      const dx = head.x - previous.x;
      const dy = head.y - previous.y;
      const magnitude = Math.hypot(dx, dy) || 1;
      const ux = dx / magnitude;
      const uy = dy / magnitude;
      const travelled = Math.hypot(projectile.x - projectile.startX, projectile.z - projectile.startZ);
      const progress = Math.min(1, travelled / Math.max(projectile.totalDistance, 0.01));
      const lift = (24 - progress * 18) * Math.max(0.55, this.camera.zoom);
      const trailLength = Math.max(7, 16 * this.camera.zoom);
      const headX = head.x;
      const headY = head.y - lift;
      const tailX = headX - ux * trailLength;
      const tailY = headY - uy * trailLength;
      ctx.strokeStyle = 'rgba(255, 205, 105, 0.92)';
      ctx.lineWidth = Math.max(1.15, 2.2 * this.camera.zoom);
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(headX, headY);
      ctx.stroke();
      ctx.fillStyle = '#f5dfad';
      ctx.beginPath();
      ctx.moveTo(headX + ux * 2.8, headY + uy * 2.8);
      ctx.lineTo(headX - ux * 3.4 - uy * 2.1, headY - uy * 3.4 + ux * 2.1);
      ctx.lineTo(headX - ux * 3.4 + uy * 2.1, headY - uy * 3.4 - ux * 2.1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  palisadeJunctionEntities(simulation) {
    const activeWalls = simulation.buildings
      .filter((building) => building.type === 'wall' && !building.destroyed && building.progress > 0.08);
    const cacheKey = activeWalls.map((wall) => {
      const direction = wall.wallDirection ?? { x: 1, z: 0 };
      const start = wall.wallStart ?? wall;
      return `${wall.id}:${wall.wallSegments}:${start.x.toFixed(3)}:${start.z.toFixed(3)}:${direction.x.toFixed(3)}:${direction.z.toFixed(3)}:${Math.round(wall.progress * 12)}`;
    }).join('|');
    if (cacheKey === this.palisadeJunctionCacheKey) return this.palisadeJunctionCache;

    const activeById = new Map(activeWalls.map((wall) => [wall.id, wall]));
    const junctions = simulation.getPalisadeJunctions()
      .map((junction) => {
        const progress = junction.wallIds
          .map((wallId) => activeById.get(wallId)?.progress ?? 1)
          .reduce((minimum, value) => Math.min(minimum, value), 1);
        const key = `${Math.round(junction.x * 4)}:${Math.round(junction.z * 4)}`;
        return {
          id: `wall-junction-${key}`,
          kind: 'wall-junction',
          x: junction.x,
          z: junction.z,
          branchCount: junction.branchCount,
          alpha: Math.min(1, Math.max(0.24, progress)),
        };
      });
    this.palisadeJunctionCacheKey = cacheKey;
    this.palisadeJunctionCache = junctions;
    return junctions;
  }

  drawPalisadeJunction(ctx, junction) {
    const point = this.worldToScreen(junction);
    // The binding is part of the Palisade, not a decorative token. Match the
    // authored wall height so it closes the clipped terminal halves without
    // reading as a tiny object perched on the seam.
    const size = junction.branchCount >= 3 ? 126 : 112;
    this.drawFirstAgeAsset(ctx, 'palisadeJunction', point, size * this.camera.zoom, junction.alpha ?? 1);
  }

  drawOccludedUnitOverlays(ctx, simulation) {
    for (const unit of simulation.units) {
      if (unit.dead) continue;
      if (!this.isWorldVisible(unit, 3)) continue;
      const nearbyStatic = typeof simulation._staticBlockerCandidates === 'function'
        ? simulation._staticBlockerCandidates(unit, OCCLUSION_QUERY_RADIUS)
        : [...simulation.buildings, ...simulation.resourcesNodes];
      const hiddenByBuilding = nearbyStatic.find((building) => {
        if (building.kind !== 'building') return false;
        if (building.destroyed || building.progress <= 0 || building.field) return false;
        // Low work buildings should never swallow a moving worker or a newly
        // produced unit. Tall landmarks keep their natural far-side occlusion
        // so a unit walking behind a tower still reads correctly.
        if (BUILDING_TYPES[building.type]?.allowsUnitOcclusion) return false;
        const nearStructure = simulation._distanceToBuildingEdge(unit, building) < 2.3;
        const collisionCenter = this.buildingCollisionCenter(building);
        return nearStructure && unit.x + unit.z < collisionCenter.x + collisionCenter.z - 0.04;
      });
      const hiddenByResource = nearbyStatic.find((node) => {
        if (node.kind !== 'resource') return false;
        if (!['tree', 'grove', 'berry', 'grain', 'stone', 'gold'].includes(node.type) || node.amount <= 0) return false;
        const tierScale = RESOURCE_SIZE_TIERS[node.sizeTier ?? 'small']?.footprintScale ?? 1;
        const clearance = node.type === 'berry' || node.type === 'grain' ? 1.55 : node.type === 'stone' || node.type === 'gold' ? 1.7 * tierScale : node.type === 'grove' ? 2.6 * tierScale : node.type === 'tree' ? 1.28 * tierScale : 1.9 * tierScale;
        if (node.type === 'grain') return false;
        return Math.hypot(unit.x - node.x, unit.z - node.z) < clearance
          && unit.x + unit.z < node.x + node.z - 0.04;
      });
      const hiddenBy = hiddenByBuilding || hiddenByResource;
      if (!hiddenBy) continue;
      const needsTracking = unit.selected || unit.command === 'attack' || unit.hp < unit.maxHp || unit.faction === 'enemy';
      if (!needsTracking) continue;
      const point = this.unitScreenPoint(unit);
      const style = UNIT_TYPES[unit.type];
      const unitSize = style.renderSize ?? (unit.type === 'villager' ? 88 : 120);
      // A tall resource or landmark can legitimately win the depth sort, but
      // a selected, active, damaged, or hostile unit must remain readable.
      // Repaint the body only for those readable states; idle friendly units
      // retain the natural depth order and do not pop through architecture.
      const readableState = unit.selected || unit.command !== 'idle' || unit.faction === 'enemy' || unit.hp < unit.maxHp;
      if (readableState) {
        if (unit.type === 'villager') this.drawVillagerAsset(ctx, unit, point, unitSize * this.camera.zoom, 1);
        else if (style.combatAtlas) this.drawCombatAsset(ctx, unit, point, unitSize * this.camera.zoom, 1);
      }
      this.drawUnitStatusEffects(ctx, unit, point, unitSize * this.camera.zoom, this.lastRenderTime);
      this.drawSelectionMarker(ctx, point, true, unit.type === 'soldier' ? 0.82 : unit.type === 'scout' ? 1.25 : 0.66, unit.faction === 'enemy' ? '#d86b55' : FACTION.color);
      this.drawHealthBar(ctx, point.x, point.y - unitSize * 0.9 * this.camera.zoom, unitSize * 0.62 * this.camera.zoom, unit.hp / unit.maxHp, '', Boolean(unit.selected || unit.command === 'attack' || unit.hitFlash > 0 || unit.healthRevealTimer > 0 || unit.stunTimer > 0 || unit.stunImmunityTimer > 0 || unit.lastLightWardTimer > 0));
    }
  }

  unitScreenPoint(unit) {
    const point = this.worldToScreen(unit);
    const rise = Number(unit.stairProgress) > 0
      ? (Number(unit.stairVisualRise) || 14) * unit.stairProgress * this.camera.zoom
      : 0;
    point.y -= rise;
    return point;
  }

  drawAsset(ctx, assetKey, screen, size, alpha = 1) {
    if (!this.atlasReady && !(this.atlas.complete && this.atlas.naturalWidth > 0)) return;
    const rect = ASSET_RECTS[assetKey];
    // Dedicated first-age images can still be loading during the first frame.
    // They do not necessarily have a legacy atlas fallback, so skip that
    // transient frame instead of dereferencing an undefined atlas rectangle.
    if (!rect) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    const destination = { x: screen.x - size / 2, y: screen.y - size * 0.98 };
    ctx.drawImage(this.atlas, rect.x, rect.y, rect.width, rect.height, destination.x, destination.y, size, size);
    ctx.restore();
  }

  buildingScreenBounds(building) {
    const anchor = this.worldToScreen(building);
    const size = this.buildingRenderSize(building) * this.camera.zoom;
    const visualHeight = this.buildingVisualHeight(building, this.buildingRenderSize(building)) * this.camera.zoom;
    if (BUILDING_TYPES[building.type]?.wall) {
      const points = this.wallSegmentPoints(building).points.map((point) => this.worldToScreen(point));
      const padX = Math.max(10, size * 0.48);
      const padTop = Math.max(16, visualHeight * 0.96);
      const padBottom = Math.max(7, visualHeight * 0.16);
      return {
        minX: Math.min(...points.map((point) => point.x)) - padX,
        maxX: Math.max(...points.map((point) => point.x)) + padX,
        minY: Math.min(...points.map((point) => point.y)) - padTop,
        maxY: Math.max(...points.map((point) => point.y)) + padBottom,
      };
    }
    const footprint = this.buildingFootprint(building);
    const collisionCenter = this.buildingCollisionCenter(building);
    const corners = [
      { x: collisionCenter.x - footprint.width / 2, z: collisionCenter.z - footprint.height / 2 },
      { x: collisionCenter.x + footprint.width / 2, z: collisionCenter.z - footprint.height / 2 },
      { x: collisionCenter.x + footprint.width / 2, z: collisionCenter.z + footprint.height / 2 },
      { x: collisionCenter.x - footprint.width / 2, z: collisionCenter.z + footprint.height / 2 },
    ].map((point) => this.worldToScreen(point));
    return {
      minX: Math.min(anchor.x - size * 0.66, ...corners.map((point) => point.x)),
      maxX: Math.max(anchor.x + size * 0.66, ...corners.map((point) => point.x)),
      minY: Math.min(anchor.y - visualHeight * 1.04, ...corners.map((point) => point.y)),
      maxY: Math.max(anchor.y + visualHeight * 0.18, ...corners.map((point) => point.y)),
    };
  }

  getBuildingsInScreenRect(simulation, start, end) {
    const selection = {
      minX: Math.min(start.x, end.x),
      maxX: Math.max(start.x, end.x),
      minY: Math.min(start.y, end.y),
      maxY: Math.max(start.y, end.y),
    };
    return simulation.buildings.filter((building) => {
      if (building.destroyed || building.hp <= 0 || !simulation.canDemolishBuilding(building)) return false;
      const bounds = this.buildingScreenBounds(building);
      return bounds.maxX >= selection.minX && bounds.minX <= selection.maxX
        && bounds.maxY >= selection.minY && bounds.minY <= selection.maxY;
    });
  }

  getEntityAtScreen(simulation, point, purpose = 'select') {
    const world = this.screenToWorld(point);
    if (purpose === 'demolish') {
      return simulation.buildings
        .filter((building) => !building.destroyed && building.hp > 0)
        .filter((building) => {
          const bounds = this.buildingScreenBounds(building);
          return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
        })
        .sort((a, b) => {
          const anchorA = this.worldToScreen(a);
          const anchorB = this.worldToScreen(b);
          return Math.hypot(point.x - anchorA.x, point.y - anchorA.y)
            - Math.hypot(point.x - anchorB.x, point.y - anchorB.y);
        })[0] ?? null;
    }
    let unitHit = null;
    let unitDistance = Infinity;
    let hostileUnitHit = null;
    let hostileUnitDistance = Infinity;
    for (const unit of simulation.units) {
      if (unit.dead || (this.viewportBounds && !this.isWorldVisible(unit, 3))) continue;
      const anchor = this.unitScreenPoint(unit);
      const style = UNIT_TYPES[unit.type];
      const size = (style.renderSize ?? 120) * this.camera.zoom;
      const withinX = Math.abs(point.x - anchor.x) <= Math.max(22, size * 0.3);
      const withinY = point.y >= anchor.y - size * 1.04 && point.y <= anchor.y + size * 0.16;
      if (!withinX || !withinY) continue;
      const candidateDistance = Math.hypot(point.x - anchor.x, point.y - (anchor.y - size * 0.48));
      if (candidateDistance < unitDistance) {
        unitDistance = candidateDistance;
        unitHit = unit;
      }
      if (unit.faction === 'enemy' && candidateDistance < hostileUnitDistance) {
        hostileUnitDistance = candidateDistance;
        hostileUnitHit = unit;
      }
    }
    let buildingHit = null;
    let buildingDistance = Infinity;
    for (const building of simulation.buildings) {
      if (building.destroyed || building.hp <= 0 || (this.viewportBounds && !this.isWorldVisible(building, this.entityCullRadius(building)))) continue;
      const anchor = this.worldToScreen(building);
      const size = this.buildingRenderSize(building) * this.camera.zoom;
      const definition = FIRST_AGE_ASSETS[building.type];
      const aspect = definition ? definition.width / definition.height : 1;
      const height = size / aspect;
      const withinX = Math.abs(point.x - anchor.x) <= size * 0.66;
      const withinY = point.y >= anchor.y - height * 1.04 && point.y <= anchor.y + height * 0.18;
      if (!withinX || !withinY) continue;
      const candidateDistance = Math.hypot(point.x - anchor.x, point.y - anchor.y);
      if (candidateDistance < buildingDistance) {
        buildingDistance = candidateDistance;
        buildingHit = building;
      }
    }
    let resourceHit = null;
    let resourceDistance = Infinity;
    for (const resource of simulation.resourcesNodes) {
      if (resource.amount <= 0 || (this.viewportBounds && !this.isWorldVisible(resource, this.entityCullRadius(resource)))) continue;
      const anchor = this.worldToScreen(resource);
      const tier = RESOURCE_SIZE_TIERS[resource.sizeTier ?? 'small'] ?? RESOURCE_SIZE_TIERS.small;
      const baseSize = resource.type === 'grove' ? 252 : resource.type === 'grain' ? 360 : resource.type === 'tree' ? 174 : resource.type === 'berry' ? 115 : 132;
      const size = (resource.type === 'berry' || resource.type === 'grain' ? baseSize : baseSize * tier.renderScale) * this.camera.zoom;
      const withinX = Math.abs(point.x - anchor.x) <= Math.max(24, size * (resource.type === 'grain' ? 0.58 : 0.5));
      const withinY = point.y >= anchor.y - size * 1.08 && point.y <= anchor.y + size * 0.14;
      if (!withinX || !withinY) continue;
      const candidateDistance = Math.hypot(point.x - anchor.x, point.y - (anchor.y - size * 0.46));
      if (candidateDistance < resourceDistance) {
        resourceDistance = candidateDistance;
        resourceHit = resource;
      }
    }

    if (purpose === 'command') {
      // Command intent is different from selection intent. Large authored
      // buildings use generous silhouette hit regions so their upper stories
      // remain easy to select, but those rectangles can overlap a visible
      // tree, bush, or ore node beside the building. A hostile body still has
      // first priority; after that, a visible resource wins before a friendly
      // structure so right-click gathering cannot turn into an accidental
      // "move to storage" order.
      return hostileUnitHit ?? resourceHit ?? buildingHit ?? unitHit ?? simulation.getEntityAt(world);
    }

    // Selection retains the familiar body -> building -> resource order. The
    // intent split keeps monumental structures forgiving to select without
    // allowing that convenience region to swallow economic commands.
    return unitHit ?? buildingHit ?? resourceHit ?? simulation.getEntityAt(world);
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
    const destinationWidth = size;
    const destinationHeight = size * (atlas.destinationAspect ?? 1);
    const groundAnchorY = this.assetGroundAnchorY(atlas, column, row);
    const destination = {
      x: screen.x - destinationWidth / 2,
      // Ground the visible artwork, not the transparent rectangle around it.
      // Generated assets intentionally keep safe padding so roofs, foliage,
      // and construction frames never clip. That padding varies per asset and
      // used to lift shorter buildings and resource nodes above the meadow.
      y: screen.y - destinationHeight * groundAnchorY + yOffset,
    };
    ctx.drawImage(
      image,
      sourceLeft,
      sourceTop,
      cellWidth,
      cellHeight,
      destination.x,
      destination.y,
      destinationWidth,
      destinationHeight,
    );
    ctx.restore();
    return true;
  }

  drawEnvironmentAsset(ctx, type, variant, screen, size, alpha = 1) {
    const row = ENVIRONMENT_ATLAS.rowByType[type] ?? ENVIRONMENT_ATLAS.rowByType.pebbles;
    const column = Math.max(0, Math.min(ENVIRONMENT_ATLAS.columns - 1, variant ?? 0));
    this.drawAtlasCell(ctx, this.environmentAtlas, this.environmentReady, ENVIRONMENT_ATLAS, column, row, screen, size, alpha);
  }

  drawTreeAsset(ctx, variant, screen, size, alpha = 1) {
    const column = Math.max(0, Math.min(TREE_ATLAS.columns - 1, variant ?? 0));
    this.drawAtlasCell(ctx, this.treeAtlas, this.treeAtlasReady, TREE_ATLAS, column, 0, screen, size, alpha);
  }

  drawTreeGroveAsset(ctx, stage, screen, size, alpha = 1) {
    const safeStage = Math.max(0, Math.min(3, stage ?? 0));
    const column = safeStage % TREE_GROVE_ATLAS.columns;
    const row = Math.floor(safeStage / TREE_GROVE_ATLAS.columns);
    this.drawAtlasCell(ctx, this.treeGroveAtlas, this.treeGroveReady, TREE_GROVE_ATLAS, column, row, screen, size, alpha);
  }

  drawAncientForestAsset(ctx, stage, screen, size, alpha = 1) {
    const safeStage = Math.max(0, Math.min(3, stage ?? 0));
    const column = safeStage % ANCIENT_FOREST_ATLAS.columns;
    const row = Math.floor(safeStage / ANCIENT_FOREST_ATLAS.columns);
    this.drawAtlasCell(ctx, this.ancientForestAtlas, this.ancientForestReady, ANCIENT_FOREST_ATLAS, column, row, screen, size, alpha);
  }

  drawWildwoodForestAsset(ctx, stage, screen, size, alpha = 1) {
    const safeStage = Math.max(0, Math.min(5, stage ?? 0));
    const column = safeStage % WILDWOOD_FOREST_ATLAS.columns;
    const row = Math.floor(safeStage / WILDWOOD_FOREST_ATLAS.columns);
    this.drawAtlasCell(ctx, this.wildwoodForestAtlas, this.wildwoodForestReady, WILDWOOD_FOREST_ATLAS, column, row, screen, size, alpha);
  }

  drawFirstAgeDefinition(ctx, definition, image, ready, screen, size, alpha = 1) {
    if (!definition || !image || (!ready && !(image.complete && image.naturalWidth > 0))) return false;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    const aspect = definition.width / definition.height;
    const width = size;
    const height = size / aspect;
    const groundAnchorY = this.assetGroundAnchorY(definition);
    ctx.translate(screen.x, screen.y - height * (groundAnchorY - 0.5));
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
    ctx.restore();
    return true;
  }

  assetGroundAnchorY(definition, column = null, row = null) {
    const cellKey = column == null || row == null ? null : `${column},${row}`;
    const authored = cellKey ? definition?.groundAnchorByCell?.[cellKey] : null;
    const anchor = Number.isFinite(authored)
      ? authored
      : Number.isFinite(definition?.groundAnchorY) ? definition.groundAnchorY : 0.98;
    // Keep malformed future metadata from throwing a sprite far off its
    // gameplay anchor. A small amount above 1 is permitted for authored
    // effects, while ordinary structures remain inside the image plate.
    return Math.max(0.5, Math.min(1.05, anchor));
  }

  drawFirstAgeAsset(ctx, type, screen, size, alpha = 1) {
    return this.drawFirstAgeDefinition(
      ctx,
      FIRST_AGE_ASSETS[type],
      this.firstAgeAssets?.[type],
      this.firstAgeAssetReady[type],
      screen,
      size,
      alpha,
    );
  }

  drawGateAsset(ctx, buildingOrPreview, screen, size, alpha = 1) {
    const definition = FIRST_AGE_ASSETS.gate;
    const image = this.firstAgeAssets?.gate;
    const storedOrientation = buildingOrPreview?.gateOrientation;
    const orientation = storedOrientation && definition?.cellByOrientation?.[storedOrientation]
      ? storedOrientation
      : resolveWallVisual(
        buildingOrPreview?.gateDirection
          ?? buildingOrPreview?.wallDirection
          ?? { x: 1, z: 0 },
      ).orientation;
    const cell = definition?.cellByOrientation?.[orientation] ?? { column: 0, row: 0 };
    return this.drawAtlasCell(
      ctx,
      image,
      this.firstAgeAssetReady?.gate,
      definition,
      cell.column,
      cell.row,
      screen,
      size,
      alpha,
    );
  }

  drawFirstAgeConstructionAsset(ctx, type, stage, screen, size, alpha = 1) {
    const definition = FIRST_AGE_ASSETS[type];
    const constructionAtlas = definition?.constructionAtlas;
    const cell = constructionAtlas?.cellByStage?.[stage];
    if (constructionAtlas && cell) {
      return this.drawAtlasCell(
        ctx,
        this.firstAgeConstructionAtlases?.[type],
        this.firstAgeConstructionAtlasReady?.[type],
        constructionAtlas,
        cell.column,
        cell.row,
        screen,
        size,
        alpha,
      );
    }
    return this.drawFirstAgeDefinition(
      ctx,
      definition?.constructionStages?.[stage],
      this.firstAgeConstructionAssets?.[type]?.[stage],
      this.firstAgeConstructionAssetReady?.[type]?.[stage],
      screen,
      size,
      alpha,
    );
  }

  drawAshenBuildingAsset(ctx, buildingOrType, screen, size, alpha = 1) {
    const type = typeof buildingOrType === 'string' ? buildingOrType : buildingOrType.type;
    const definition = ASHEN_BUILDING_ASSETS[type];
    if (!definition) return false;
    if (definition.src) {
      const image = type === 'ashenCamp' ? this.enemyCamp : this.ashenBuildingAssets[type];
      const ready = type === 'ashenCamp' ? this.enemyCampReady : this.ashenBuildingAssetReady[type];
      return this.drawFirstAgeDefinition(ctx, definition, image, ready, screen, size, alpha);
    }
    const direction = buildingOrType?.attachmentDirection
      ?? buildingOrType?.gateDirection
      ?? buildingOrType?.wallDirection
      ?? { x: 1, z: 0 };
    const orientation = resolveWallVisual(direction).orientation;
    const cell = definition.cellByOrientation?.[orientation] ?? definition.cell;
    if (!cell || !definition.atlas) return false;
    const fortification = definition.atlas.src === ASHEN_BUILDING_ASSETS.ashenWall.atlas.src;
    return this.drawAtlasCell(
      ctx,
      fortification ? this.ashenFortificationAtlas : this.ashenSupportAtlas,
      fortification ? this.ashenFortificationAtlasReady : this.ashenSupportAtlasReady,
      definition.atlas,
      cell.column,
      cell.row,
      screen,
      size,
      alpha,
    );
  }

  drawAshenConstructionAsset(ctx, type, stage, screen, size, alpha = 1) {
    const atlas = ASHEN_BUILDING_ASSETS[type]?.constructionAtlas;
    const cell = atlas?.cellByStage?.[stage];
    if (!atlas || !cell) return false;
    return this.drawAtlasCell(
      ctx,
      this.ashenConstructionAtlas,
      this.ashenConstructionAtlasReady,
      atlas,
      cell.column,
      cell.row,
      screen,
      size,
      alpha,
    );
  }

  drawAshenWallSegments(ctx, building, size, alpha = 1) {
    const blueprint = BUILDING_TYPES[building.type];
    const count = Math.max(1, Math.round(building.wallSegments ?? 1));
    const span = blueprint.wallSegmentSpan ?? blueprint.footprint.width;
    const direction = building.wallDirection
      ?? (building.wallOrientation === 'vertical' ? { x: 0, z: 1 } : { x: 1, z: 0 });
    const magnitude = Math.hypot(direction.x, direction.z) || 1;
    const dx = direction.x / magnitude;
    const dz = direction.z / magnitude;
    const start = building.wallStart ?? {
      x: building.x - dx * (count - 1) * span / 2,
      z: building.z - dz * (count - 1) * span / 2,
    };
    const placements = [];
    for (let index = 0; index < count; index += 1) {
      const world = { x: start.x + dx * index * span, z: start.z + dz * index * span };
      if (!this.isWorldVisible(world, 3)) continue;
      placements.push({ point: this.worldToScreen(world), index });
    }
    placements.sort((a, b) => a.point.y - b.point.y || a.index - b.index);
    for (const placement of placements) this.drawAshenBuildingAsset(ctx, building, placement.point, size, alpha);
  }

  drawBuildingStage(ctx, building, screen, size, alpha = 1) {
    if (ASHEN_BUILDING_ASSETS[building.type]) {
      const constructionStage = resolveFirstAgeConstructionStage(building.progress);
      if (building.type === 'ashenWall' && constructionStage === 'complete') {
        this.drawAshenWallSegments(ctx, building, size, alpha);
        return;
      }
      if (constructionStage !== 'complete'
        && this.drawAshenConstructionAsset(ctx, building.type, constructionStage, screen, size, alpha)) return;
      const constructionAlpha = constructionStage === 'complete' ? alpha : alpha * (0.28 + building.progress * 0.72);
      this.drawAshenBuildingAsset(ctx, building, screen, size, constructionAlpha);
      return;
    }
    if (building.type === 'road') {
      const constructionStage = resolveFirstAgeConstructionStage(building.progress);
      const roadAlpha = constructionStage === 'complete' ? alpha : alpha * (0.35 + building.progress * 0.65);
      if (this.drawFirstAgeAsset(ctx, 'road', screen, size, roadAlpha)) return;
      ctx.save();
      ctx.globalAlpha = roadAlpha;
      ctx.fillStyle = '#9d7a4c';
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y + 2 * this.camera.zoom, size * 0.43, size * 0.18, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      return;
    }
    if (building.type === 'gate') {
      const stage = resolveFirstAgeConstructionStage(building.progress);
      const gateAlpha = stage === 'complete' ? alpha : alpha * (0.28 + building.progress * 0.72);
      this.drawGateAsset(ctx, building, screen, size, gateAlpha);
      return;
    }
    if (building.type === 'wall') {
      this.drawWallSegments(ctx, building, size, alpha);
      return;
    }
    if (FIRST_AGE_ASSETS[building.type]) {
      const constructionStage = resolveFirstAgeConstructionStage(building.progress);
      if (constructionStage !== 'complete'
        && this.drawFirstAgeConstructionAsset(ctx, building.type, constructionStage, screen, size, alpha)) return;
      const constructionAlpha = constructionStage === 'complete' ? alpha : alpha * (0.28 + building.progress * 0.72);
      if (this.drawFirstAgeAsset(ctx, building.type, screen, size, constructionAlpha)) return;
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

  buildingVisualHeight(buildingOrType, width) {
    const type = typeof buildingOrType === 'string' ? buildingOrType : buildingOrType.type;
    const definition = FIRST_AGE_ASSETS[type] ?? ASHEN_BUILDING_ASSETS[type] ?? (type === 'ashenCamp' ? ENEMY_CAMP_ASSET : null);
    if (definition?.src) return width * (definition.height / definition.width);
    return width;
  }

  buildingFootprint(buildingOrType) {
    const type = typeof buildingOrType === 'string' ? buildingOrType : buildingOrType.type;
    const blueprint = BUILDING_TYPES[type];
    if (!blueprint?.wall && !blueprint?.gate) return blueprint?.collisionFootprint ?? blueprint?.footprint ?? { width: 1, height: 1 };
    const segments = blueprint.wall ? Math.max(1, Math.round(buildingOrType.wallSegments ?? 1)) : 1;
    const span = blueprint.wallSegmentSpan ?? blueprint.footprint.width;
    const length = blueprint.footprint.width + (segments - 1) * span;
    const direction = buildingOrType.wallDirection
      ?? (buildingOrType.wallOrientation === 'vertical' ? { x: 0, z: 1 } : { x: 1, z: 0 });
    const magnitude = Math.hypot(direction.x, direction.z) || 1;
    const dx = direction.x / magnitude;
    const dz = direction.z / magnitude;
    return {
      width: Math.abs(dx) * length + Math.abs(dz) * blueprint.footprint.height,
      height: Math.abs(dz) * length + Math.abs(dx) * blueprint.footprint.height,
    };
  }

  buildingCollisionCenter(buildingOrType, anchor = null) {
    const type = typeof buildingOrType === 'string' ? buildingOrType : buildingOrType.type;
    const blueprint = BUILDING_TYPES[type];
    const source = anchor ?? (typeof buildingOrType === 'object' ? buildingOrType : null);
    const offset = blueprint?.collisionOffset ?? { x: 0, z: 0 };
    return {
      x: (source?.x ?? 0) + (offset.x ?? 0),
      z: (source?.z ?? 0) + (offset.z ?? 0),
    };
  }

  drawWallSegments(ctx, building, size, alpha = 1) {
    const blueprint = BUILDING_TYPES.wall;
    const count = Math.max(1, Math.round(building.wallSegments ?? 1));
    const span = blueprint.wallSegmentSpan ?? blueprint.footprint.width;
    const orientation = building.wallOrientation ?? 'horizontal';
    const direction = building.wallDirection
      ?? (orientation === 'vertical' ? { x: 0, z: 1 } : { x: 1, z: 0 });
    const magnitude = Math.hypot(direction.x, direction.z) || 1;
    const dx = direction.x / magnitude;
    const dz = direction.z / magnitude;
    const start = building.wallStart ?? {
      x: building.x - dx * (count - 1) * span / 2,
      z: building.z - dz * (count - 1) * span / 2,
    };
    const visual = resolveWallVisual(direction);
    const placements = [];
    for (let index = 0; index < count; index += 1) {
      const world = {
        x: start.x + dx * index * span,
        z: start.z + dz * index * span,
      };
      if (!this.isWorldVisible(world, 3)) continue;
      const point = this.worldToScreen(world);
      placements.push({ point, index });
    }
    // Draw the farthest screen-space segment first. This keeps depth-facing
    // panels interlocked without a distant panel painting over the near one.
    placements.sort((a, b) => a.point.y - b.point.y || a.index - b.index);
    for (const placement of placements) this.drawWallPanel(ctx, building, visual.asset, placement.point, size, alpha);
  }

  drawWallPanel(ctx, building, asset, point, size, alpha = 1) {
    const socket = building.wallJunctionClip;
    if (!socket) {
      this.drawFirstAgeAsset(ctx, asset, point, size, alpha);
      return;
    }
    const socketScreen = this.worldToScreen(socket);
    const keepX = point.x - socketScreen.x;
    const keepY = point.y - socketScreen.y;
    const magnitude = Math.hypot(keepX, keepY);
    if (magnitude < 0.5) {
      this.drawFirstAgeAsset(ctx, asset, point, size, alpha);
      return;
    }
    const nx = keepX / magnitude;
    const ny = keepY / magnitude;
    const tx = -ny;
    const ty = nx;
    const extent = Math.max(this.canvas.width, this.canvas.height) * 2;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(socketScreen.x + tx * extent, socketScreen.y + ty * extent);
    ctx.lineTo(socketScreen.x - tx * extent, socketScreen.y - ty * extent);
    ctx.lineTo(socketScreen.x - tx * extent + nx * extent, socketScreen.y - ty * extent + ny * extent);
    ctx.lineTo(socketScreen.x + tx * extent + nx * extent, socketScreen.y + ty * extent + ny * extent);
    ctx.closePath();
    ctx.clip();
    this.drawFirstAgeAsset(ctx, asset, point, size, alpha);
    ctx.restore();
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
      // Ashen Foragers have their own authored motion atlas. If a task atlas
      // is still warming, keep the real Forager visible rather than falling
      // back to the generic Raider silhouette (which reads as a placeholder
      // worker in fields).
      if (unit.type === 'ashenForager') {
        const motionAtlas = COMBAT_ATLASES.ashenForagerMotion;
        const motionImage = this.combatAtlases.ashenForagerMotion;
        if (motionAtlas && motionImage && this.combatAtlasReady.ashenForagerMotion) {
          const fallbackState = state === 'walk' ? 'walk' : 'idle';
          const fallbackFrame = animationFrame('ashenForager', fallbackState, unit.animationTime ?? unit.animClock, unit.facing);
          this.drawAtlasCell(ctx, motionImage, true, motionAtlas, fallbackFrame.column, fallbackFrame.row, screen, size, alpha, 0);
          return;
        }
      }
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
    const visualHeight = this.buildingVisualHeight(building, size);
    const alpha = building.destroyed ? Math.max(0, 0.7 - building.destroyAge * 0.26) : 1;
    const dismantling = Boolean(building.demolitionQueued && !building.destroyed);
    // A collision footprint is command feedback, not a permanent world
    // shadow. Drawing it beneath every completed structure created dark
    // square islands—especially obvious under fields—and made otherwise
    // grounded artwork appear to hover. Keep it only while it communicates a
    // selection, active construction, or dismantling state.
    const showFootprint = building.selected || dismantling || building.progress < 1;
    if (!building.destroyed && showFootprint) this.drawBuildingFootprint(
      ctx,
      building,
      building.selected || dismantling,
      dismantling ? '#d86b55' : building.faction === 'enemy' ? '#d86b55' : FACTION.color,
    );
    this.drawBuildingStage(ctx, building, point, size * this.camera.zoom, alpha);
    if (building.destroyed) {
      this.drawDestroyedBuildingTreatment(ctx, building, point, size, time);
      return;
    }
    // A Palisade run is expanded into independently depth-sorted panels so a
    // near corner panel cannot be painted beneath an entire distant run. Keep
    // selection footprints on every panel, but show shared status/health only
    // once at the run's middle panel.
    const representativeWallPanel = !building.wallSegmentEntity
      || building.wallSegmentIndex === Math.floor(building.wallSegmentCount / 2);
    if (!representativeWallPanel) return;
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
    if (dismantling) {
      ctx.save();
      ctx.globalAlpha = 0.48 + Math.sin(time * 0.006 + building.id) * 0.12;
      ctx.strokeStyle = '#ef9b76';
      ctx.lineWidth = Math.max(1.2, 2 * this.camera.zoom);
      ctx.setLineDash([7 * this.camera.zoom, 5 * this.camera.zoom]);
      ctx.beginPath();
      ctx.ellipse(point.x, point.y - visualHeight * 0.36 * this.camera.zoom, size * 0.39 * this.camera.zoom, visualHeight * 0.18 * this.camera.zoom, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    this.drawBuildingDamageTreatment(ctx, building, point, size, time);
    const healthLabel = dismantling
      ? `DISMANTLE ${Math.round((1 - building.hp / Math.max(1, building.demolitionStartHp || building.maxHp)) * 100)}%`
      : building.progress < 1 ? `BUILD ${Math.round(building.progress * 100)}%` : '';
    this.drawHealthBar(ctx, point.x, point.y - visualHeight * 0.82 * this.camera.zoom, size * 0.58 * this.camera.zoom, building.hp / building.maxHp, healthLabel);
  }

  drawBuildingFootprint(ctx, building, selected = false, color = FACTION.color) {
    const blueprint = BUILDING_TYPES[building.type];
    const clearance = blueprint.collisionClearance ?? 0;
    const baseFootprint = this.buildingFootprint(building);
    let corners;
    if (blueprint.wall || blueprint.gate) {
      const count = blueprint.wall ? Math.max(1, Math.round(building.wallSegments ?? 1)) : 1;
      const span = blueprint.wallSegmentSpan ?? blueprint.footprint.width;
      const length = blueprint.gate ? blueprint.footprint.width + clearance * 2 : blueprint.footprint.width + (count - 1) * span + clearance * 2;
      const thickness = blueprint.footprint.height + clearance * 2;
      const direction = building.wallDirection
        ?? (building.wallOrientation === 'vertical' ? { x: 0, z: 1 } : { x: 1, z: 0 });
      const magnitude = Math.hypot(direction.x, direction.z) || 1;
      const dx = direction.x / magnitude;
      const dz = direction.z / magnitude;
      const normal = { x: -dz, z: dx };
      corners = [
        { x: building.x - dx * length / 2 - normal.x * thickness / 2, z: building.z - dz * length / 2 - normal.z * thickness / 2 },
        { x: building.x + dx * length / 2 - normal.x * thickness / 2, z: building.z + dz * length / 2 - normal.z * thickness / 2 },
        { x: building.x + dx * length / 2 + normal.x * thickness / 2, z: building.z + dz * length / 2 + normal.z * thickness / 2 },
        { x: building.x - dx * length / 2 + normal.x * thickness / 2, z: building.z - dz * length / 2 + normal.z * thickness / 2 },
      ].map((corner) => this.worldToScreen(corner));
    } else {
      const collisionCenter = this.buildingCollisionCenter(building);
      const footprint = {
        width: baseFootprint.width + clearance * 2,
        height: baseFootprint.height + clearance * 2,
      };
      corners = [
        { x: collisionCenter.x - footprint.width / 2, z: collisionCenter.z - footprint.height / 2 },
        { x: collisionCenter.x + footprint.width / 2, z: collisionCenter.z - footprint.height / 2 },
        { x: collisionCenter.x + footprint.width / 2, z: collisionCenter.z + footprint.height / 2 },
        { x: collisionCenter.x - footprint.width / 2, z: collisionCenter.z + footprint.height / 2 },
      ].map((corner) => this.worldToScreen(corner));
    }
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
    const footprint = this.buildingFootprint(building);
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
    // Wood nodes become invisible the instant their final bundle is taken.
    // The underlying terrain is already the normal green meadow, so no
    // replacement patch or large depleted-forest image is needed.
    if (resource.resourceType === 'wood' && resource.amount <= 0) return;
    const point = this.worldToScreen(resource);
    const tier = RESOURCE_SIZE_TIERS[resource.sizeTier ?? 'small'] ?? RESOURCE_SIZE_TIERS.small;
    // Bushes keep their compact authored scale. Trees, groves, stone, and
    // Gold use the tier contract so a player can read both footprint and
    // remaining work at normal zoom without adding labels to the world.
    const baseSize = resource.type === 'grove' ? 252 : resource.type === 'grain' ? 360 : resource.type === 'tree' ? 174 : resource.type === 'berry' ? 115 : resource.type === 'gold' ? 138 : 132;
    const size = resource.type === 'berry' || resource.type === 'grain' ? baseSize : baseSize * tier.renderScale;
    const ratio = resource.maxAmount > 0 ? Math.max(0, Math.min(1, resource.amount / resource.maxAmount)) : 0;
    const depleted = resource.amount <= 0;
    const scale = depleted ? 0.72 : 0.88 + ratio * 0.12;
    const alpha = depleted ? 0.32 : 0.82 + ratio * 0.18;
    if (resource.type === 'grove') {
      const stage = resourceDepletionStage(resource);
      if (resource.sizeTier === 'wildwood') this.drawWildwoodForestAsset(ctx, stage, point, size * this.camera.zoom, depleted ? 0.9 : 0.98);
      else if (resource.sizeTier === 'ancient') this.drawAncientForestAsset(ctx, stage, point, size * this.camera.zoom, depleted ? 0.74 : 0.96);
      else this.drawTreeGroveAsset(ctx, stage, point, size * this.camera.zoom, depleted ? 0.74 : 0.92);
    } else if (resource.type === 'grain') {
      this.drawFirstAgeAsset(ctx, 'field', point, size * this.camera.zoom, depleted ? 0.3 : 0.9);
    } else if (resource.type === 'tree') {
      this.drawTreeAsset(ctx, resource.variant, point, size * scale * this.camera.zoom, alpha);
    } else if (resource.type === 'gold') {
      const assetKey = depleted ? 'depleted' : (resource.sizeTier ?? 'small');
      const definition = GOLD_DEPOSIT_ASSETS[assetKey] ?? GOLD_DEPOSIT_ASSETS.small;
      const image = this.goldDepositAssets[assetKey];
      if (image && this.goldDepositAssetReady[assetKey]) {
        const width = size * (depleted ? 0.92 : 0.95 + ratio * 0.05) * this.camera.zoom;
        this.drawFirstAgeDefinition(
          ctx,
          definition,
          image,
          this.goldDepositAssetReady[assetKey],
          point,
          width,
          depleted ? 0.82 : 0.9 + ratio * 0.1,
        );
      } else {
        this.drawEnvironmentAsset(ctx, depleted ? 'pebbles' : 'stone', depleted ? 3 : resource.variant, point, size * scale * this.camera.zoom, alpha);
      }
    } else if (resource.type === 'stone' && resource.sizeTier === 'large' && !depleted && this.largeStoneReady) {
      const width = size * this.camera.zoom;
      this.drawFirstAgeDefinition(
        ctx,
        LARGE_STONE_ASSET,
        this.largeStone,
        this.largeStoneReady,
        point,
        width,
        0.86 + ratio * 0.14,
      );
    } else if (depleted && resource.type === 'stone') {
      this.drawEnvironmentAsset(ctx, 'pebbles', 3, point, size * 0.7 * this.camera.zoom, 0.76);
    } else {
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
    const point = this.unitScreenPoint(unit);
    const style = UNIT_TYPES[unit.type];
    const size = style.renderSize ?? (unit.type === 'villager' ? 88 : 120);
    const alpha = unit.dead ? Math.max(0, 0.92 - unit.deathAge * 0.18) : 1;
    if (!unit.dead) this.drawSelectionMarker(ctx, point, unit.selected, unit.type === 'soldier' ? 0.82 : unit.type === 'raider' ? 0.78 : unit.type === 'scout' ? 1.25 : 0.66, unit.faction === 'enemy' ? '#d86b55' : FACTION.color);
    if (unit.type === 'villager') this.drawVillagerAsset(ctx, unit, point, size * this.camera.zoom, alpha);
    else if (style.combatAtlas) this.drawCombatAsset(ctx, unit, point, size * this.camera.zoom, alpha);
    else this.drawAsset(ctx, style.asset, point, size * this.camera.zoom, alpha);
    if (!unit.dead) {
      this.drawUnitStatusEffects(ctx, unit, point, size * this.camera.zoom, time);
      this.drawCombatPhaseCue(ctx, unit, point, time);
      this.drawHealthBar(ctx, point.x, point.y - size * 0.9 * this.camera.zoom, size * 0.62 * this.camera.zoom, unit.hp / unit.maxHp, '', Boolean(unit.selected || unit.command === 'attack' || unit.hitFlash > 0 || unit.healthRevealTimer > 0 || unit.stunTimer > 0 || unit.stunImmunityTimer > 0 || unit.lastLightWardTimer > 0));
      if (unit.carryAmount > 0) this.drawCarryBadge(ctx, point.x + 20 * this.camera.zoom, point.y - 18 * this.camera.zoom, unit.carryType, unit.carryAmount);
      if (unit.command === 'attack' && unit.attackPhase !== 'approach') this.drawAttackRing(ctx, point, time, unit.attackPhase);
      if (unit.hitFlash > 0) this.drawHitFlash(ctx, point, time);
    }
  }

  drawUnitStatusEffects(ctx, unit, point, screenSize, time = 0) {
    if (unit.lastLightWardBlastTimer > 0) {
      const duration = Math.max(0.2, unit.lastLightWardBlastDuration || 0.9);
      const progress = Math.max(0, Math.min(1, 1 - unit.lastLightWardBlastTimer / duration));
      const eased = 1 - Math.pow(1 - progress, 2);
      const centerY = point.y - screenSize * 0.48;
      const radius = screenSize * (0.72 + eased * 1.52);
      const alpha = (1 - progress) * 0.92;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(point.x, centerY, 0, point.x, centerY, radius);
      glow.addColorStop(0, `rgba(255, 248, 198, ${alpha * 0.72})`);
      glow.addColorStop(0.38, `rgba(235, 212, 132, ${alpha * 0.24})`);
      glow.addColorStop(1, 'rgba(235, 212, 132, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(point.x, centerY, radius, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#fff3b0';
      ctx.lineWidth = Math.max(1, 2.2 * this.camera.zoom * (1 - progress * 0.35));
      ctx.beginPath();
      ctx.arc(point.x, centerY, radius * 0.72, 0, TAU);
      ctx.stroke();
      for (let index = 0; index < 8; index += 1) {
        const angle = index * (TAU / 8) + unit.id * 0.17;
        const inner = radius * 0.34;
        const outer = radius * (0.86 + (index % 2) * 0.12);
        ctx.beginPath();
        ctx.moveTo(point.x + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner * 0.62);
        ctx.lineTo(point.x + Math.cos(angle) * outer, centerY + Math.sin(angle) * outer * 0.62);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (unit.lastLightCurseActive || unit.lastLightCurseFlashTimer > 0) {
      const flash = Math.max(0, Math.min(1, (unit.lastLightCurseFlashTimer ?? 0) / 1.15));
      const pulse = 0.78 + Math.sin(time * 0.012 + unit.id) * 0.12;
      const radius = screenSize * (0.48 + flash * 0.12);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (unit.lastLightCurseActive ? 0.58 : 0.3) + flash * 0.3;
      ctx.strokeStyle = '#bc75d6';
      ctx.lineWidth = Math.max(1, 1.5 * this.camera.zoom);
      ctx.beginPath();
      ctx.arc(point.x, point.y - screenSize * 0.36, radius * pulse, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#d79ae7';
      ctx.beginPath();
      ctx.moveTo(point.x, point.y - screenSize * 1.1 - radius * 0.25);
      ctx.lineTo(point.x + radius * 0.28, point.y - screenSize * 1.1);
      ctx.lineTo(point.x, point.y - screenSize * 1.1 + radius * 0.25);
      ctx.lineTo(point.x - radius * 0.28, point.y - screenSize * 1.1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    const image = this.villagerAtlases.statusEffects;
    const atlas = VILLAGER_ATLASES.statusEffects;
    if (!image || !atlas || (!this.villagerAtlasReady.statusEffects && !(image.complete && image.naturalWidth > 0))) return;

    const drawCell = (cell, centerX, centerY, width, alpha = 1) => {
      const sourceLeft = Math.ceil(cell.column * atlas.width / atlas.columns) + 1;
      const sourceTop = Math.ceil(cell.row * atlas.height / atlas.rows) + 1;
      const sourceRight = Math.floor((cell.column + 1) * atlas.width / atlas.columns) - 1;
      const sourceBottom = Math.floor((cell.row + 1) * atlas.height / atlas.rows) - 1;
      const sourceWidth = sourceRight - sourceLeft;
      const sourceHeight = sourceBottom - sourceTop;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(
        image,
        sourceLeft,
        sourceTop,
        sourceWidth,
        sourceHeight,
        centerX - width / 2,
        centerY - width / 2,
        width,
        width,
      );
      ctx.restore();
    };

    if (unit.lastLightWardTimer > 0) {
      const wardFrame = Math.floor(time / 280) % 2 ? atlas.cells.wardB : atlas.cells.wardA;
      const blockedPulse = Math.max(0, Math.min(1, (unit.wardBlockedPulse ?? 0) / 0.42));
      const breathe = 1 + Math.sin(time * 0.005 + unit.id) * 0.025 + blockedPulse * 0.08;
      const wardSize = screenSize * 1.42 * breathe;
      drawCell(wardFrame, point.x, point.y - wardSize * 0.5, wardSize, 0.72 + blockedPulse * 0.24);
    }

    const statusCell = unit.stunTimer > 0
      ? atlas.cells.stunned
      : unit.stunImmunityTimer > 0
        ? atlas.cells.stunImmune
        : null;
    if (!statusCell) return;
    const iconSize = Math.max(18, Math.min(40, screenSize * 0.5));
    const pulse = unit.stunTimer > 0 ? 0.92 : 0.78 + Math.sin(time * 0.007 + unit.id) * 0.14;
    drawCell(statusCell, point.x, point.y - screenSize * 0.98 - iconSize * 0.34, iconSize, pulse);
  }

  drawCombatPhaseCue(ctx, unit, point, time) {
    if (!unit.attackPhase || unit.command !== 'attack' || unit.attackPhase === 'approach' || unit.type === 'villager' && !unit.attackTarget) return;
    const direction = [
      { x: 0, y: 1 },
      { x: 1, y: 0 },
      { x: 0, y: -1 },
      { x: -1, y: 0 },
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
      if (!event || unit.dead || !this.isWorldVisible(unit, 3)) continue;
      const age = (unit.animClock ?? 0) - event.clock;
      if (age < 0 || age > 0.58) continue;
      const progress = age / 0.58;
      const payload = event.payload ?? {};
      const world = Number.isFinite(payload.x) && Number.isFinite(payload.z)
        ? { x: payload.x, z: payload.z }
        : unit;
      const point = this.worldToScreen(world);
      const alpha = (1 - progress) * 0.72;
      const color = payload.demolition
        ? '#e47a5f'
        : payload.resourceType === 'wood'
        ? '#c69559'
        : payload.resourceType === 'food'
          ? '#d76649'
          : payload.resourceType === 'stone'
            ? '#b8c4c4'
            : payload.resourceType === 'gold'
              ? '#c6a15b'
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
      if (unit.dead || !unit.animationEvents?.length || !this.isWorldVisible(unit, 3)) continue;
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
    // At the minimum zoom the old fixed-size pulse could subtract more than
    // the ring radius and pass a negative radius to CanvasRenderingContext2D.
    // That throws IndexSizeError and aborts the animation loop, which looks
    // like a full game lock-up after combat starts near a zoomed-out view.
    const pulseRadius = Math.max(0.5, 19 * this.camera.zoom + Math.sin(time * 0.01) * Math.min(2, 6 * this.camera.zoom));
    ctx.beginPath(); ctx.arc(point.x, point.y + 4, pulseRadius, 0, TAU);
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
    if (type === 'wall' && this.buildPreview.segments?.length) {
      this.drawWallSegments(ctx, this.buildPreview, size, 0.9);
    } else if (type === 'gate') {
      this.drawGateAsset(ctx, this.buildPreview, point, size, 0.9);
    } else if (FIRST_AGE_ASSETS[type]) {
      this.drawFirstAgeAsset(ctx, type, point, size, 0.9);
    } else {
      const column = BUILDING_STAGE_ATLAS.columnByType[type] ?? BUILDING_STAGE_ATLAS.columnByType.house;
      if (!this.drawAtlasCell(ctx, this.buildingStages, this.buildingStagesReady, BUILDING_STAGE_ATLAS, column, BUILDING_STAGE_ATLAS.rowByStage.foundation, point, size, 0.9)) {
        this.drawAsset(ctx, BUILDING_TYPES[type]?.asset ?? 'house', point, size, 0.9);
      }
    }
    ctx.globalAlpha = 1;
    this.drawBuildingFootprint(ctx, {
      type,
      x: this.buildPreview.world.x,
      z: this.buildPreview.world.z,
      wallSegments: this.buildPreview.wallSegments,
      wallOrientation: this.buildPreview.wallOrientation,
      wallDirection: this.buildPreview.wallDirection,
    }, false, this.buildPreview.valid ? '#a6d4a8' : '#e27964');
    ctx.beginPath(); ctx.ellipse(point.x, point.y + 8, size * 0.32, size * 0.12, 0, 0, TAU);
    ctx.strokeStyle = this.buildPreview.valid ? '#a6d4a8' : '#e27964'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = '700 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.buildPreview.valid ? '#d6edc5' : '#ffd0ba';
    ctx.fillText(this.buildPreview.valid ? 'SITE READY' : 'CANNOT PLACE', point.x, point.y + size * 0.2);
    ctx.restore();
  }

  drawCrownHallPlacementVision(ctx, simulation) {
    if (!this.buildPreview) return;
    const hall = simulation.buildings.find((building) => building.type === 'townCenter' && !building.destroyed && building.progress >= 1);
    if (!hall) return;
    if (!this.isWorldVisible(hall, this.entityCullRadius(hall))) return;
    const point = this.worldToScreen(hall);
    const size = this.buildingRenderSize(hall) * this.camera.zoom;
    const height = this.buildingVisualHeight(hall, size);
    ctx.save();
    ctx.globalAlpha = 0.16;
    if (!this.drawFirstAgeAsset(ctx, 'townCenter', point, size, 0.16)) {
      ctx.restore();
      return;
    }
    ctx.globalAlpha = 0.78;
    ctx.strokeStyle = '#a9dfcf';
    ctx.lineWidth = Math.max(1.2, 2.2 * this.camera.zoom);
    ctx.setLineDash([12 * this.camera.zoom, 9 * this.camera.zoom]);
    ctx.strokeRect(point.x - size * 0.53, point.y - height * 0.99, size * 1.06, height * 1.04);
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = 'rgba(169, 223, 207, 0.68)';
    ctx.lineWidth = Math.max(1, 1.4 * this.camera.zoom);
    ctx.beginPath();
    ctx.ellipse(point.x, point.y + height * 0.015, size * 0.47, size * 0.12, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  drawRipples(ctx, time, delta = 0) {
    for (const ripple of this.ripples) {
      if (!this.isWorldVisible(ripple.world, 2)) continue;
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

  drawDemolitionPreview(ctx) {
    for (const building of this.demolitionPreview) {
      if (!building || building.destroyed || !this.isWorldVisible(building, this.entityCullRadius(building))) continue;
      this.drawBuildingFootprint(ctx, building, true, '#d86b55');
      const point = this.worldToScreen(building);
      const size = this.buildingRenderSize(building) * this.camera.zoom;
      ctx.save();
      ctx.globalAlpha = 0.78;
      ctx.strokeStyle = '#ffd0ba';
      ctx.lineWidth = Math.max(1.2, 1.8 * this.camera.zoom);
      ctx.beginPath();
      ctx.moveTo(point.x - size * 0.11, point.y - size * 0.36);
      ctx.lineTo(point.x + size * 0.11, point.y - size * 0.14);
      ctx.moveTo(point.x + size * 0.11, point.y - size * 0.36);
      ctx.lineTo(point.x - size * 0.11, point.y - size * 0.14);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawSelectionBox(ctx) {
    const box = this.selectionBox;
    const demolition = box.mode === 'demolition';
    ctx.save();
    ctx.fillStyle = demolition ? 'rgba(216, 107, 85, 0.14)' : 'rgba(134, 196, 207, 0.12)';
    ctx.strokeStyle = demolition ? '#e47a5f' : FACTION.color;
    ctx.lineWidth = 1.5;
    ctx.fillRect(box.x, box.y, box.width, box.height);
    ctx.strokeRect(box.x, box.y, box.width, box.height);
    ctx.restore();
  }

}
