export const CONFIG = {
  // The first settlement slice now has roughly ten times the walkable area
  // of the original 30x22 board. The opening remains intentionally sparse;
  // the extra space is for readable routes, expansion, and combat separation.
  mapWidth: 90,
  mapHeight: 73,
  tileWidth: 52,
  tileHeight: 26,
  initialZoom: 0.68,
  minZoom: 0.36,
  maxZoom: 1.16,
  // Bias the opening view toward the south so the enlarged Crown Hall's
  // roofline remains inside the playable viewport rather than under the HUD.
  initialCameraWorld: { x: 23, z: 30 },
  // The first-age beta sandbox deliberately keeps every currently implemented
  // blueprint available and leaves generous room for production testing.
  sandboxMode: true,
  // Roads remain authored content for a later-age build feature. The opening
  // first-age map starts as an unroaded meadow so the settlement grows from
  // player decisions rather than presenting a finished route network.
  startingRoads: false,
  productionQueueLimit: 100,
  sandboxPopulationCapacity: 999,
};

// The slice currently ships with one readable, forgiving enemy profile. It
// gives the player time to gather and build while preserving local awareness:
// Ashen Raiders still respond when the camp is attacked or a player unit gets
// too close, but the camp does not rush the Crown Hall at match start.
export const ENEMY_AI = {
  mode: 'easy',
  maxRaiders: 2,
  reinforcementDelay: 32,
  firstRaidDelay: 90,
  followUpRaidDelay: 75,
  awarenessRange: 5.2,
  defenseDuration: 10,
};

export const LIGHTING = {
  primary: {
    label: 'upper-left / front',
    vector: { x: -0.48, y: -0.88 },
    shadowVector: { x: 0.48, y: 0.88 },
    warm: 'rgba(255, 226, 168, 0.055)',
    highlight: 'rgba(255, 239, 198, 0.03)',
  },
  ambient: {
    color: 'rgba(62, 91, 70, 0.042)',
    distantHaze: 'rgba(218, 231, 200, 0.035)',
  },
  mapEdgeShadow: 'rgba(16, 31, 27, 0.34)',
};

export const FACTION = {
  key: 'crownwardens',
  name: 'The Crownwardens',
  shortName: 'Crownwardens',
  color: '#86c4cf',
  darkColor: '#173844',
  gold: '#d7aa54',
};

export const RESOURCE_TYPES = {
  food: { label: 'Food', color: '#d76649', capacity: 9999, gatherAmount: 10, gatherTime: 1.05, interactionDistance: 1.55 },
  wood: { label: 'Wood', color: '#b98147', capacity: 9999, gatherAmount: 12, gatherTime: 1.1, interactionDistance: 1.75 },
  stone: { label: 'Stone', color: '#9fa8ab', capacity: 9999, gatherAmount: 10, gatherTime: 1.2, interactionDistance: 1.7 },
};

export const UNIT_TYPES = {
  villager: {
    label: 'Villager',
    asset: 'villager',
    renderSize: 88,
    speed: 2.9,
    acceleration: 10.5,
    braking: 13.5,
    radius: 0.36,
    maxHp: 42,
    attack: 4,
    range: 0.95,
    cooldown: 1.25,
    attackTiming: { anticipation: 0.2, contact: 0.46, recovery: 0.34 },
  },
  soldier: {
    label: 'Crown Guard',
    asset: 'soldier',
    renderSize: 120,
    speed: 2.45,
    radius: 0.43,
    maxHp: 85,
    attack: 14,
    range: 1.45,
    cooldown: 0.85,
    attackTiming: { anticipation: 0.24, contact: 0.44, recovery: 0.32 },
    combatAtlas: 'soldier',
  },
  raider: {
    label: 'Ashen Raider',
    asset: 'raider',
    renderSize: 120,
    speed: 2.25,
    radius: 0.44,
    maxHp: 72,
    attack: 9,
    range: 1.25,
    cooldown: 1.05,
    attackTiming: { anticipation: 0.22, contact: 0.46, recovery: 0.32 },
    combatAtlas: 'raider',
  },
};

export const SPACING_ROLES = {
  villager: { personalSpace: 1.08, groupGap: 1.45 },
  soldier: { personalSpace: 1.28, groupGap: 1.72 },
  raider: { personalSpace: 1.32, groupGap: 1.78 },
};

export const PRODUCTION_TYPES = {
  villager: {
    label: 'Villager',
    icon: 'icon-villager',
    building: 'townCenter',
    trainTime: 4,
    cost: { food: 50, wood: 0, stone: 0 },
  },
  soldier: {
    label: 'Crown Guard',
    icon: 'icon-soldier',
    building: 'barracks',
    trainTime: 6,
    cost: { food: 40, wood: 15, stone: 0 },
  },
};

export const BUILDING_TYPES = {
  townCenter: {
    label: 'Crown Hall',
    function: 'Resource drop-off and settlement core',
    asset: 'townCenter',
    maxHp: 900,
    footprint: { width: 6, height: 5 },
    renderSize: 440,
    collisionClearance: 1.25,
    entrance: 'south',
    completed: true,
    storage: true,
    production: true,
    productionTypes: ['villager'],
  },
  house: {
    label: 'Hearth House',
    function: 'Population housing',
    asset: 'house',
    maxHp: 260,
    footprint: { width: 4, height: 3 },
    renderSize: 350,
    collisionClearance: 1.05,
    entrance: 'south',
    buildTime: 7.5,
    cost: { food: 0, wood: 55, stone: 0 },
    population: 4,
  },
  barracks: {
    label: 'Crown Barracks',
    function: 'Crown Guard production',
    asset: 'barracks',
    maxHp: 480,
    footprint: { width: 5, height: 4 },
    renderSize: 310,
    collisionClearance: 1.12,
    entrance: 'south',
    buildTime: 10,
    cost: { food: 0, wood: 90, stone: 40 },
    production: true,
    productionTypes: ['soldier'],
  },
  lumberMill: {
    label: 'Lumber Mill',
    function: 'Wood drop-off',
    asset: 'lumberMill',
    maxHp: 340,
    footprint: { width: 4, height: 3 },
    renderSize: 260,
    collisionClearance: 1.04,
    entrance: 'south',
    buildTime: 7,
    cost: { food: 0, wood: 45, stone: 10 },
    storage: true,
  },
  quarry: {
    label: 'Stone Quarry',
    function: 'Stone drop-off',
    asset: 'quarry',
    maxHp: 380,
    footprint: { width: 4, height: 3 },
    renderSize: 270,
    collisionClearance: 1.05,
    entrance: 'south',
    buildTime: 7,
    cost: { food: 0, wood: 35, stone: 25 },
    storage: true,
  },
  grainMill: {
    label: 'Grain Mill',
    function: 'Food drop-off',
    asset: 'grainMill',
    maxHp: 360,
    footprint: { width: 4, height: 3 },
    renderSize: 275,
    collisionClearance: 1.05,
    entrance: 'south',
    buildTime: 7,
    cost: { food: 0, wood: 50, stone: 10 },
    storage: true,
  },
  field: {
    label: 'Grain Field',
    function: 'One-farmer food plot',
    asset: 'field',
    maxHp: 150,
    footprint: { width: 3, height: 2 },
    renderSize: 210,
    collisionClearance: 0.62,
    entrance: 'south',
    buildTime: 5,
    cost: { food: 0, wood: 25, stone: 0 },
    field: true,
    walkable: true,
  },
  wall: {
    label: 'Palisade Wall',
    function: 'Defensive boundary',
    asset: 'wall',
    maxHp: 260,
    footprint: { width: 3, height: 1 },
    renderSize: 190,
    collisionClearance: 0.48,
    entrance: 'south',
    buildTime: 4,
    cost: { food: 0, wood: 20, stone: 10 },
    wall: true,
    wallSegmentSpan: 3,
  },
  storehouse: {
    label: 'Waystore',
    function: 'Resource drop-off',
    asset: 'storehouse',
    maxHp: 420,
    footprint: { width: 4, height: 3 },
    renderSize: 370,
    collisionClearance: 1.12,
    entrance: 'south',
    completed: true,
    storage: true,
  },
  ashenCamp: {
    label: 'Ashen Camp',
    function: 'Enemy settlement core',
    asset: 'ashenCamp',
    maxHp: 640,
    footprint: { width: 6, height: 5 },
    renderSize: 500,
    collisionClearance: 1.4,
    entrance: 'south',
    spawnDistance: 1.45,
    completed: true,
    enemyStructure: true,
  },
};

export const ASSET_RECTS = {
  townCenter: { x: 0, y: 0, width: 418, height: 418 },
  house: { x: 418, y: 0, width: 418, height: 418 },
  storehouse: { x: 836, y: 0, width: 418, height: 418 },
  villager: { x: 0, y: 418, width: 418, height: 418 },
  soldier: { x: 418, y: 418, width: 418, height: 418 },
  raider: { x: 836, y: 418, width: 418, height: 418 },
  tree: { x: 0, y: 836, width: 418, height: 418 },
  berry: { x: 418, y: 836, width: 418, height: 418 },
  stone: { x: 836, y: 836, width: 418, height: 418 },
};

export const ENVIRONMENT_ATLAS = {
  src: './assets/crownforge-environment-atlas-v3.png?v=1',
  width: 1254,
  height: 1254,
  columns: 4,
  rows: 4,
  rowByType: { tree: 0, berry: 1, stone: 2, log: 3, stump: 3, flowers: 3, pebbles: 3 },
};

export const TREE_GROVE_ATLAS = {
  src: './assets/crownforge-tree-grove-depletion-v1.png?v=20260818-sandbox1',
  width: 1230,
  height: 1278,
  columns: 2,
  rows: 2,
};

export const FIRST_AGE_ASSETS = {
  barracks: { src: './assets/crownforge-barracks-v2.png?v=20260819-wallpass1', width: 1536, height: 1024 },
  lumberMill: { src: './assets/crownforge-lumber-mill-v1.png?v=20260818-sandbox1', width: 1254, height: 1254 },
  quarry: { src: './assets/crownforge-quarry-v1.png?v=20260818-sandbox1', width: 1254, height: 1254 },
  grainMill: { src: './assets/crownforge-grain-mill-v1.png?v=20260818-sandbox1', width: 1254, height: 1254 },
  field: { src: './assets/crownforge-field-v1.png?v=20260818-sandbox1', width: 1254, height: 1254 },
  wall: { src: './assets/crownforge-palisade-segment-v2.png?v=20260819-wallpass1', width: 1536, height: 1024 },
};

export const ROAD_DETAILS_ATLAS = {
  src: './assets/crownforge-roadside-props-v1.png?v=20260818-roads2',
  width: 1536,
  height: 1024,
  columns: 2,
  rows: 2,
  // The source sheet is a 2x2 plate rather than a square atlas so the fence
  // and sign keep their authored proportions when sampled by the renderer.
  columnByType: { fence: 0, sign: 1, cargo: 0, lantern: 1 },
  rowByType: { fence: 0, sign: 0, cargo: 1, lantern: 1 },
};

export const BUILDING_STAGE_ATLAS = {
  src: './assets/crownforge-building-stages-v2.png?v=3',
  width: 1254,
  height: 1254,
  columns: 4,
  rows: 4,
  columnByType: { townCenter: 0, house: 1, storehouse: 2 },
  rowByStage: { foundation: 0, partial: 1, nearComplete: 2, complete: 3 },
};

export const ENEMY_CAMP_ASSET = {
  src: './assets/crownforge-ashen-camp-v1.png?v=1',
  width: 1536,
  height: 1024,
};

export const VILLAGER_ATLASES = {
  motion: {
    src: './assets/villager-motion-atlas.png?v=2',
    rows: { idle: 0, walk: [1, 2, 3] },
  },
  motionLoop: {
    src: './assets/crownforge-villager-walk-loop-v2.png?v=20260819-wallpass1',
    width: 1224,
    height: 1285,
    columns: 4,
    rows: 4,
    layout: 'frame-columns',
  },
  task: {
    src: './assets/villager-task-atlas.png?v=2',
    rows: { wood: 0, food: 1, stone: 2, build: 3 },
  },
  carry: {
    src: './assets/villager-carry-atlas.png?v=2',
    rows: { wood: 0, food: 1, stone: 2, supplies: 3 },
  },
  combat: {
    src: './assets/villager-combat-atlas.png?v=2',
    rows: { attack: 0, hit: 1, death: 2, idle: 3 },
  },
  // Action-loop atlases use frame columns and authored direction rows. The
  // legacy task/carry/combat sheets remain available for states that are
  // intentionally single-pose (carry, hit, and death).
  woodLoop: {
    src: './assets/villager-gather-wood-loop-v1.png?v=1',
    width: 1254,
    height: 1254,
    columns: 4,
    rows: 4,
    layout: 'frame-columns',
  },
  foodLoop: {
    src: './assets/villager-gather-food-loop-v1.png?v=1',
    width: 1254,
    height: 1254,
    columns: 4,
    rows: 4,
    layout: 'frame-columns',
  },
  stoneLoop: {
    src: './assets/villager-gather-stone-loop-v1.png?v=1',
    width: 1254,
    height: 1254,
    columns: 4,
    rows: 4,
    layout: 'frame-columns',
  },
  buildLoop: {
    src: './assets/villager-construct-loop-v1.png?v=1',
    width: 1254,
    height: 1254,
    columns: 4,
    rows: 4,
    layout: 'frame-columns',
  },
  carryWoodLoop: {
    src: './assets/villager-carry-wood-loop-v1.png?v=1',
    width: 1254,
    height: 1254,
    columns: 4,
    rows: 4,
    layout: 'frame-columns',
  },
  carryFoodLoop: {
    src: './assets/villager-carry-food-loop-v1.png?v=1',
    width: 1254,
    height: 1254,
    columns: 4,
    rows: 4,
    layout: 'frame-columns',
  },
  carryStoneLoop: {
    src: './assets/villager-carry-stone-loop-v1.png?v=1',
    width: 1254,
    height: 1254,
    columns: 4,
    rows: 4,
    layout: 'frame-columns',
  },
  carrySuppliesLoop: {
    src: './assets/villager-carry-supplies-loop-v1.png?v=1',
    width: 1254,
    height: 1254,
    columns: 4,
    rows: 4,
    layout: 'frame-columns',
  },
  columns: 4,
  rows: 4,
  width: 1254,
  height: 1254,
};

export const COMBAT_ATLASES = {
  soldier: {
    src: './assets/crownforge-soldier-combat-atlas-v1.png?v=1',
    width: 1243,
    height: 1265,
    columns: 4,
    rows: 4,
    rowByState: { idle: 0, walk: 1, attack: 2, death: 3 },
  },
  soldierAttack: {
    src: './assets/crownforge-soldier-attack-loop-v1.png?v=1',
    width: 1254,
    height: 1254,
    columns: 4,
    rows: 4,
    layout: 'frame-columns',
  },
  soldierWalk: {
    src: './assets/crownforge-soldier-walk-loop-v2.png?v=20260819-wallpass1',
    width: 1254,
    height: 1254,
    columns: 4,
    rows: 4,
    layout: 'frame-columns',
  },
  raider: {
    src: './assets/crownforge-raider-combat-atlas-v1.png?v=1',
    width: 1243,
    height: 1266,
    columns: 4,
    rows: 4,
    rowByState: { idle: 0, walk: 1, attack: 2, death: 3 },
  },
  raiderAttack: {
    src: './assets/crownforge-raider-attack-loop-v4.png?v=20260819-wallpass1',
    width: 1254,
    height: 1254,
    columns: 4,
    rows: 4,
    layout: 'frame-columns',
  },
  raiderWalk: {
    src: './assets/crownforge-raider-walk-loop-v2.png?v=20260819-wallpass1',
    width: 1254,
    height: 1254,
    columns: 4,
    rows: 4,
    layout: 'frame-columns',
  },
};

export const INITIAL_RESOURCES = { food: 5000, wood: 5000, stone: 5000 };
