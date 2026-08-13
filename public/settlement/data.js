export const STORAGE_KEY = "johnny-hearthwild-save-v1";

export const WORLD = {
  cols: 34,
  rows: 24,
  cell: 56,
  get width() { return this.cols * this.cell; },
  get height() { return this.rows * this.cell; }
};

export const COLORS = {
  ink: "#17261f",
  paper: "#fbf8ee",
  moss: "#526f4d",
  mossDeep: "#2b4835",
  fern: "#7f9f67",
  sun: "#e8b65e",
  clay: "#ba7758",
  river: "#5a9a9a"
};

export const BUILDINGS = {
  campfire: {
    id: "campfire",
    name: "Campfire",
    icon: "✹",
    description: "The warm center of the first camp. Villagers eat, rest, and gather around it.",
    cost: { wood: 0, stone: 0 },
    footprint: { w: 1, h: 1 },
    rotatable: false,
    purpose: "A shared place to eat, warm up, and rest.",
    buildTime: 0,
    accent: "#eea34f",
    capacity: 0
  },
  storage: {
    id: "storage",
    name: "Storage Area",
    icon: "▣",
    description: "A covered place for gathered supplies and the camp's delivery hub.",
    cost: { wood: 8, stone: 4 },
    footprint: { w: 2, h: 1 },
    rotatable: true,
    purpose: "Keeps deliveries close to the heart of the settlement.",
    buildTime: 8,
    accent: "#b17a4b",
    capacity: 60
  },
  shelter: {
    id: "shelter",
    name: "Primitive Hut",
    icon: "⌂",
    description: "A low lean-to that gives villagers a quiet, faster place to rest.",
    cost: { wood: 12, stone: 3 },
    footprint: { w: 2, h: 2 },
    rotatable: true,
    purpose: "A private place to recover energy and health.",
    buildTime: 10,
    accent: "#c77e52",
    capacity: 2
  },
  berryStand: {
    id: "berryStand",
    name: "Berry Stand",
    icon: "✤",
    description: "A simple gathering place that keeps the camp fed.",
    cost: { wood: 8, stone: 2 },
    footprint: { w: 2, h: 1 },
    rotatable: true,
    purpose: "Makes food gathering feel organized and dependable.",
    buildTime: 8,
    accent: "#a85b72",
    capacity: 0
  },
  dryingRack: {
    id: "dryingRack",
    name: "Food-Drying Rack",
    icon: "⌁",
    description: "A sunny rack for preserving the day's berries and keeping food on hand.",
    purpose: "Speeds food gathering and gives the camp a visible pantry rhythm.",
    cost: { wood: 7, stone: 2 },
    footprint: { w: 2, h: 1 },
    rotatable: true,
    buildTime: 7,
    accent: "#d2a45c",
    capacity: 0
  },
  woodcutterArea: {
    id: "woodcutterArea",
    name: "Woodcutter Work Area",
    icon: "⚒",
    description: "A cleared work yard for splitting, stacking, and preparing timber.",
    purpose: "Shortens wood-gathering work and gives the camp a practical edge.",
    cost: { wood: 9, stone: 1 },
    footprint: { w: 2, h: 2 },
    rotatable: true,
    buildTime: 9,
    accent: "#8f674c",
    capacity: 0
  },
  stoneSite: {
    id: "stoneSite",
    name: "Stone Gathering Site",
    icon: "◆",
    description: "A marked patch where useful stone can be sorted and shaped.",
    purpose: "Shortens stone-gathering work and keeps heavy materials organized.",
    cost: { wood: 5, stone: 7 },
    footprint: { w: 2, h: 1 },
    rotatable: true,
    buildTime: 9,
    accent: "#8c9b98",
    capacity: 0
  },
  well: {
    id: "well",
    name: "Basic Well",
    icon: "◉",
    description: "A stone-lined water point that gives the camp a dependable place to refresh.",
    purpose: "Improves recovery and gives villagers a reason to cross the settlement.",
    cost: { wood: 9, stone: 8 },
    footprint: { w: 2, h: 2 },
    rotatable: true,
    buildTime: 12,
    accent: "#5f9b9a",
    capacity: 0,
    waterRadius: 5
  }
};

export const RESOURCE_META = {
  wood: { label: "Wood", icon: "▰", color: "#bc8551", node: "tree", gatherTime: 2.6, bundle: 3, thresholds: { critical: 3, low: 8, adequate: 20, abundant: 40 } },
  stone: { label: "Stone", icon: "◆", color: "#9da9a1", node: "rock", gatherTime: 3.1, bundle: 2, thresholds: { critical: 2, low: 6, adequate: 15, abundant: 30 } },
  food: { label: "Food", icon: "✤", color: "#e5b34e", node: "berry", gatherTime: 2.1, bundle: 4, thresholds: { critical: 5, low: 12, adequate: 30, abundant: 45 } }
};

export const BASE_STORAGE_CAPACITY = 36;

export const PRIORITY_META = {
  food: { label: "Food", icon: "✤" },
  wood: { label: "Wood", icon: "▰" },
  stone: { label: "Stone", icon: "◆" },
  construction: { label: "Construction", icon: "⚒" },
  hauling: { label: "Hauling", icon: "↗" }
};

export const PRIORITY_LEVELS = ["Low", "Normal", "High"];

export const VILLAGER_ARCHETYPES = [
  { id: "v1", name: "Sela", age: 28, role: "Woodcutter", preferred: "wood", color: "#b9684e", hair: "#392c28", note: "Keeps a careful eye on the tree line.", workBias: 1.12, socialNeed: 0.38, restBias: 0.92, routine: "early" },
  { id: "v2", name: "Toma", age: 34, role: "Forager", preferred: "food", color: "#d08b52", hair: "#5b3a2d", note: "Knows which berries are sweet after rain.", workBias: 0.94, socialNeed: 0.72, restBias: 1.05, routine: "late" },
  { id: "v3", name: "Nivi", age: 19, role: "Forager", preferred: "food", color: "#6d9b73", hair: "#2b3830", note: "Never walks the same route twice.", workBias: 1.04, socialNeed: 0.86, restBias: 0.82, routine: "midday" },
  { id: "v4", name: "Orin", age: 42, role: "Stoneworker", preferred: "stone", color: "#7a8ca1", hair: "#453c34", note: "Can hear a hollow stone from three paces away.", workBias: 0.87, socialNeed: 0.48, restBias: 1.18, routine: "early" },
  { id: "v5", name: "Pera", age: 26, role: "Builder", preferred: "wood", color: "#a776b3", hair: "#342f43", note: "Already sees the village in the clearing.", workBias: 1.2, socialNeed: 0.62, restBias: 0.9, routine: "midday" }
];

export const VILLAGER_CHILD_NAMES = ["Lio", "Mara", "Nell", "Odo", "Rin", "Tavi", "Uma", "Wren"];

export const ANIMAL_SPECIES = {
  reedbuck: {
    name: "Reedback deer",
    kind: "harmless",
    habitat: ["meadow", "clearing"],
    color: "#aa7856",
    underfur: "#e8c998",
    size: 1.08,
    speed: 31,
    fleeRadius: 150,
    waterSeeking: true,
    waterInterval: 31,
    restThreshold: 30,
    group: "reedbuck",
    description: "A shy browser that follows the meadow edge and drinks at the creek."
  },
  mosshare: {
    name: "Moss hare",
    kind: "harmless",
    habitat: ["meadow", "clearing"],
    color: "#8b745d",
    underfur: "#d9c3a0",
    size: 0.68,
    speed: 44,
    fleeRadius: 108,
    waterSeeking: true,
    waterInterval: 42,
    restThreshold: 36,
    group: "mosshare",
    description: "A quick little grazer that rests in grass and vanishes when the camp gets close."
  },
  creekotter: {
    name: "Creek otter",
    kind: "useful",
    habitat: ["meadow", "clearing"],
    color: "#5b5047",
    underfur: "#a99680",
    size: 0.82,
    speed: 39,
    fleeRadius: 96,
    waterSeeking: true,
    waterLoving: true,
    waterInterval: 15,
    restThreshold: 28,
    group: "creekotter",
    description: "A lively creek resident that keeps the water's edge active and healthy."
  },
  honeybee: {
    name: "Honeybee swarm",
    kind: "useful",
    habitat: ["meadow", "clearing"],
    color: "#dca643",
    underfur: "#302b22",
    size: 0.32,
    speed: 25,
    fleeRadius: 38,
    waterSeeking: true,
    waterInterval: 48,
    restThreshold: 20,
    group: "honeybee",
    pollinator: true,
    description: "A small pollinator swarm that helps berry patches recover."
  },
  brushboar: {
    name: "Brush boar",
    kind: "danger",
    habitat: ["meadow"],
    color: "#60483b",
    underfur: "#9f785b",
    size: 1.12,
    speed: 34,
    fleeRadius: 82,
    threatRadius: 54,
    waterSeeking: true,
    waterInterval: 36,
    restThreshold: 25,
    group: "brushboar",
    dangerous: true,
    description: "Usually wary, but a cornered boar can charge anyone who crowds it."
  }
};

export const OBJECTIVES = [
  { id: "food", label: "Gather 30 food", kind: "resource", resource: "food", amount: 30 },
  { id: "wood", label: "Gather 30 wood", kind: "resource", resource: "wood", amount: 30 },
  { id: "storage", label: "Build a storage area", kind: "building", building: "storage", amount: 1 },
  { id: "shelters", label: "Raise two primitive huts", kind: "building", building: "shelter", amount: 2 },
  { id: "food-preservation", label: "Stabilize the food supply", kind: "building", building: "dryingRack", alternates: ["berryStand"], amount: 1 }
];

export const DISCOVERIES = [
  {
    id: "ember-keeping",
    name: "Ember Keeping",
    icon: "✹",
    threshold: 24,
    source: "hearth time",
    description: "Tending coals turns a lucky fire into a dependable center for the settlement.",
    reward: "Fireside recovery is stronger and the camp can stay warm longer.",
    signal: "hearth"
  },
  {
    id: "stone-tools",
    name: "Stone Tools",
    icon: "◆",
    threshold: 28,
    source: "stone gathering",
    description: "Repeated work at the stone face reveals sharper edges and better grips.",
    reward: "Stone gathering takes less time.",
    signal: "stonework"
  },
  {
    id: "woodworking",
    name: "Woodworking",
    icon: "▰",
    threshold: 34,
    source: "wood gathering and building",
    description: "Branches become beams once the camp learns where to cut, split, and brace.",
    reward: "Wood gathering and construction work become more efficient.",
    signal: "woodwork"
  },
  {
    id: "organized-storage",
    name: "Organized Storage",
    icon: "▣",
    threshold: 16,
    source: "hauling supplies",
    description: "A place for every bundle keeps useful materials from disappearing into the grass.",
    reward: "The settlement gains a little more practical storage capacity.",
    signal: "hauling"
  },
  {
    id: "food-preservation",
    name: "Food Preservation",
    icon: "⌁",
    threshold: 20,
    source: "drying and gathering food",
    description: "Sun, smoke, and patience stretch a good harvest beyond a single evening.",
    reward: "Food sources recover more reliably after the camp builds a drying rack.",
    signal: "preservation"
  },
  {
    id: "improved-shelter",
    name: "Improved Shelter",
    icon: "⌂",
    threshold: 24,
    source: "resting and raising huts",
    description: "A roof, a windbreak, and a place to lie down make the clearing feel like home.",
    reward: "Resting in a hut restores energy more quickly.",
    signal: "shelter"
  },
  {
    id: "seedkeeping",
    name: "Seedkeeping",
    icon: "✤",
    threshold: 32,
    source: "gathering and watching berry patches",
    description: "The first agricultural instinct is simple: remember what grows, and leave some behind.",
    reward: "Food patches regenerate a little faster.",
    signal: "seedkeeping"
  },
  {
    id: "woven-coverings",
    name: "Woven Coverings",
    icon: "≈",
    threshold: 22,
    source: "weather and night routines",
    description: "Grass, bark, and patience become the beginnings of clothing against cold rain.",
    reward: "Rain and nighttime sap less mood from villagers.",
    signal: "weatherwise"
  },
  {
    id: "camp-watch",
    name: "Camp Watch",
    icon: "◒",
    threshold: 12,
    source: "watching the wild edge",
    description: "The settlement learns that a safe home needs eyes as well as walls.",
    reward: "Villagers react to wildlife danger sooner and recover from fright faster.",
    signal: "watch"
  }
];

export const SPEEDS = [1, 2, 4];

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const cloneCost = (cost) => ({ wood: Number(cost?.wood || 0), stone: Number(cost?.stone || 0) });

export const footprintFor = (buildingOrKind, rotation = 0) => {
  const def = typeof buildingOrKind === "string" ? BUILDINGS[buildingOrKind] : buildingOrKind;
  const footprint = def?.footprint || { w: 1, h: 1 };
  const turns = ((Number(rotation) || 0) / 90) % 2;
  return def?.rotatable && Math.abs(turns) === 1
    ? { w: footprint.h, h: footprint.w }
    : { w: footprint.w, h: footprint.h };
};

export const sumCost = (cost) => Number(cost?.wood || 0) + Number(cost?.stone || 0);

export const formatActivity = (activity) => {
  const labels = {
    idle: "Idle",
    gathering: "Gathering",
    hauling: "Hauling",
    building: "Building",
    eating: "Eating",
    resting: "Resting",
    walking: "Walking",
    returning: "Returning",
    socializing: "Socializing",
    playing: "Playing",
    securing: "Securing",
    repairing: "Repairing",
    warming: "Warming by the fire",
    wandering: "Wandering",
    thinking: "Thinking"
  };
  return labels[activity] || "Watching the camp";
};
