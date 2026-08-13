import { ANIMAL_SPECIES, BUILDINGS, RESOURCE_META, WORLD } from "./data.js";
import { lightingForState } from "./simulation.js";

const TAU = Math.PI * 2;

const rgba = (hex, alpha) => {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const lerp = (a, b, amount) => a + (b - a) * amount;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const worldCellCenter = (x, y) => ({ x: (x + 0.5) * WORLD.cell, y: (y + 0.5) * WORLD.cell });
let activeSceneLighting = {
  darkness: 0.02,
  warmth: 1,
  daylight: 1,
  goldenStrength: 0,
  moonStrength: 0,
  shadowLength: 5,
  shadowDirection: 0.55
};

// The generated atlases are deliberately optional: if a browser blocks an image
// or a future art pack replaces one family, Hearthwild falls back to the painted
// canvas shapes below without touching simulation state.
const art = {
  villagers: { src: "./assets/villagers/villager-atlas-v2.png", image: null },
  villagerMotion: { src: "./assets/villagers/villager-motion-atlas-v2.png", image: null, columns: 4, rows: 4 },
  villagerActions: { src: "./assets/villagers/villager-action-atlas-v2.png", image: null, columns: 4, rows: 4 },
  buildings: { src: "./assets/buildings/building-atlas-v3.png", image: null },
  animals: { src: "./assets/animals/animal-atlas-v2.png", image: null },
  world: { src: "./assets/terrain/world-detail-atlas-v3.png", image: null },
  growth: { src: "./assets/props/growth-atlas-v1.png", image: null },
  effects: { src: "./assets/effects/micro-effects-atlas-v1.png", image: null }
};

Object.values(art).forEach((slot) => {
  const image = new Image();
  image.decoding = "async";
  image.onload = () => { slot.image = image; };
  image.src = slot.src;
});

const atlasSprite = (ctx, slot, column, row, x, y, width, height, options = {}) => {
  if (!slot.image?.naturalWidth) return false;
  const columns = Number(options.columns || slot.columns || 4);
  const rows = Number(options.rows || slot.rows || 3);
  // Generated sheets are sometimes not evenly divisible by their grid size.
  // Integer boundaries prevent Canvas from sampling a neighboring frame's
  // antialiased pixels, which otherwise shows up as stray shapes above heads.
  const sourceX = Math.round(column * slot.image.naturalWidth / columns);
  const sourceY = Math.round(row * slot.image.naturalHeight / rows);
  const sourceRight = Math.round((column + 1) * slot.image.naturalWidth / columns);
  const sourceBottom = Math.round((row + 1) * slot.image.naturalHeight / rows);
  const sourceWidth = sourceRight - sourceX;
  const sourceHeight = sourceBottom - sourceY;
  const flip = Boolean(options.flip);
  ctx.save();
  ctx.globalAlpha = options.alpha ?? 1;
  ctx.translate(x + width / 2, y + height / 2);
  if (options.rotate) ctx.rotate(Number(options.rotate) * Math.PI / 180);
  ctx.scale(flip ? -1 : 1, 1);
  ctx.drawImage(slot.image, sourceX, sourceY, sourceWidth, sourceHeight, -width / 2, -height / 2, width, height);
  ctx.restore();
  return true;
};

const fitAtlasSprite = (ctx, slot, column, row, centerX, centerY, maxWidth, maxHeight, options = {}) => {
  if (!slot.image?.naturalWidth) return false;
  const columns = Number(options.columns || slot.columns || 4);
  const rows = Number(options.rows || slot.rows || 3);
  const ratio = (slot.image.naturalWidth / columns) / (slot.image.naturalHeight / rows);
  const width = Math.min(maxWidth, maxHeight * ratio);
  const height = width / ratio;
  return atlasSprite(ctx, slot, column, row, centerX - width / 2, centerY - height / 2, width, height, { ...options, columns, rows });
};

const roundRect = (ctx, x, y, width, height, radius) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
};

const polygon = (ctx, points) => {
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
};

const drawShadow = (ctx, x, y, rx, ry, alpha = 0.2) => {
  ctx.save();
  const night = clamp(activeSceneLighting.darkness, 0, 1);
  const shadowAlpha = alpha * (0.82 + activeSceneLighting.daylight * 0.22);
  const shadowColor = activeSceneLighting.goldenStrength > 0.18 ? "#594733" : night > 0.42 ? "#172938" : "#1c2c1f";
  const stretch = 0.55 + activeSceneLighting.shadowLength / 18;
  const offsetX = Math.cos(activeSceneLighting.shadowDirection) * activeSceneLighting.shadowLength * 0.23;
  const offsetY = Math.sin(activeSceneLighting.shadowDirection) * activeSceneLighting.shadowLength * 0.11;
  ctx.translate(x + offsetX, y + offsetY);
  ctx.rotate(activeSceneLighting.shadowDirection * 0.08);
  ctx.fillStyle = rgba(shadowColor, shadowAlpha);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * stretch, ry * (0.9 + activeSceneLighting.shadowLength / 60), 0, 0, TAU);
  ctx.fill();
  ctx.restore();
};

const drawTree = (ctx, x, y, scale, phase, clock, wind = 0.75) => {
  const sway = Math.sin(clock * 0.8 + phase) * (0.025 + wind * 0.022);
  drawShadow(ctx, x, y + 17 * scale, 23 * scale, 8 * scale, 0.2);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sway);
  ctx.fillStyle = "#745540";
  ctx.fillRect(-5 * scale, -2 * scale, 10 * scale, 28 * scale);
  ctx.fillStyle = "#966847";
  ctx.fillRect(-2 * scale, -2 * scale, 4 * scale, 25 * scale);
  const canopy = [
    [-23, 2, 18, "#315c43"], [1, -14, 23, "#416f4b"], [24, 3, 17, "#527c51"], [-5, 15, 22, "#3e6b48"], [15, 14, 16, "#335e43"]
  ];
  canopy.forEach(([cx, cy, radius, color]) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx * scale, cy * scale, radius * scale, 0, TAU);
    ctx.fill();
  });
  ctx.fillStyle = "rgba(170,201,118,.24)";
  ctx.beginPath();
  ctx.arc(-10 * scale, -13 * scale, 11 * scale, 0, TAU);
  ctx.fill();
  ctx.restore();
};

const drawRock = (ctx, x, y, scale) => {
  drawShadow(ctx, x, y + 9 * scale, 16 * scale, 6 * scale, 0.18);
  polygon(ctx, [[x - 17 * scale, y + 7 * scale], [x - 10 * scale, y - 10 * scale], [x + 4 * scale, y - 16 * scale], [x + 17 * scale, y - 5 * scale], [x + 13 * scale, y + 10 * scale], [x - 2 * scale, y + 15 * scale]]);
  ctx.fillStyle = "#8e9b94";
  ctx.fill();
  ctx.fillStyle = "#b9c1b3";
  polygon(ctx, [[x - 10 * scale, y - 8 * scale], [x + 3 * scale, y - 13 * scale], [x + 10 * scale, y - 4 * scale], [x - 1 * scale, y - 1 * scale]]);
  ctx.fill();
  ctx.strokeStyle = "rgba(42,59,52,.35)";
  ctx.lineWidth = 2;
  ctx.stroke();
};

const drawBerry = (ctx, x, y, scale, phase, clock) => {
  drawShadow(ctx, x, y + 9 * scale, 16 * scale, 5 * scale, 0.16);
  ctx.strokeStyle = "#47724a";
  ctx.lineWidth = 4 * scale;
  ctx.beginPath();
  ctx.moveTo(x, y + 12 * scale);
  ctx.lineTo(x - 3 * scale, y - 8 * scale);
  ctx.moveTo(x, y + 7 * scale);
  ctx.lineTo(x + 14 * scale, y - 3 * scale);
  ctx.stroke();
  [[-10, -7], [6, -11], [15, -1], [-2, 1], [10, 7]].forEach(([bx, by], index) => {
    ctx.fillStyle = index % 2 ? "#b75c74" : "#c96c79";
    ctx.beginPath();
    ctx.arc(x + bx * scale + Math.sin(clock * 1.4 + phase) * 1.3, y + by * scale, 4.3 * scale, 0, TAU);
    ctx.fill();
  });
  ctx.fillStyle = "#a9bd74";
  ctx.beginPath();
  ctx.ellipse(x - 12 * scale, y - 4 * scale, 7 * scale, 3 * scale, -0.5, 0, TAU);
  ctx.fill();
};

const compositionHash = (x, y, seed = 1) => {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return value - Math.floor(value);
};

const drawWildClump = (ctx, x, y, scale, variation, clock, wind = 0.75) => {
  const sway = Math.sin(clock * 0.72 + variation * 9 + x * 0.01) * (1 + wind * 1.5);
  drawShadow(ctx, x, y + 8 * scale, 15 * scale, 4 * scale, 0.08);
  ctx.strokeStyle = variation > 0.5 ? "rgba(74,111,68,.62)" : "rgba(91,126,72,.56)";
  ctx.lineWidth = Math.max(1, 1.5 * scale);
  ctx.beginPath();
  ctx.moveTo(x - 9 * scale, y + 7 * scale);
  ctx.lineTo(x - 11 * scale + sway, y - 5 * scale);
  ctx.moveTo(x - 1 * scale, y + 8 * scale);
  ctx.lineTo(x + 1 * scale + sway * 0.6, y - 8 * scale);
  ctx.moveTo(x + 8 * scale, y + 7 * scale);
  ctx.lineTo(x + 12 * scale + sway * 0.8, y - 3 * scale);
  ctx.stroke();
  [[-10, -5, 5], [1, -8, 6], [11, -3, 4]].forEach(([offsetX, offsetY, radius], index) => {
    ctx.fillStyle = index === 1 ? "rgba(105,145,76,.58)" : "rgba(74,120,72,.48)";
    ctx.beginPath();
    ctx.ellipse(x + offsetX * scale + sway * 0.35, y + offsetY * scale, radius * scale, radius * 0.55 * scale, -0.2, 0, TAU);
    ctx.fill();
  });
};

const drawWildernessComposition = (ctx, state, bounds, clock, wind) => {
  const map = state.map;
  const seed = Number(map.seed) || 1;
  const startX = Math.max(1, Math.floor(bounds.left / WORLD.cell) - 1);
  const endX = Math.min(WORLD.cols - 2, Math.ceil(bounds.right / WORLD.cell) + 1);
  const startY = Math.max(1, Math.floor(bounds.top / WORLD.cell) - 1);
  const endY = Math.min(WORLD.rows - 2, Math.ceil(bounds.bottom / WORLD.cell) + 1);
  const centralX = WORLD.cols / 2;
  const centralY = WORLD.rows / 2;
  const humanCenters = state.buildings.map((building) => ({
    x: (building.x + building.footprint.w / 2) * WORLD.cell,
    y: (building.y + building.footprint.h / 2) * WORLD.cell
  }));
  const nearHumanStructure = (x, y, radius) => humanCenters.some((center) => Math.hypot(center.x - x, center.y - y) < radius);

  // Low, irregular ground clumps break up the tile rhythm without competing
  // with resources or the settlement's readable silhouettes.
  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const cell = map.grid[y]?.[x];
      if (!cell || cell.terrain === "water" || cell.resourceId) continue;
      const edgeDistance = Math.hypot(x - centralX, (y - centralY) * 1.05);
      if (edgeDistance < 4.8) continue;
      const point = worldCellCenter(x, y);
      if (nearHumanStructure(point.x, point.y, 230)) continue;
      const groupX = Math.floor(x / 2);
      const groupY = Math.floor(y / 2);
      const detail = compositionHash(groupX, groupY, seed + 17);
      const anchorX = groupX * 2 + Math.floor(compositionHash(groupX, groupY, seed + 19) * 2);
      const anchorY = groupY * 2 + Math.floor(compositionHash(groupX, groupY, seed + 29) * 2);
      if (x !== anchorX || y !== anchorY || detail < 0.63) continue;
      ctx.save();
      ctx.globalAlpha = 0.34 + detail * 0.16;
      drawWildClump(ctx, point.x - 10 + compositionHash(x, y, seed + 23) * 18, point.y + 13, 0.72 + detail * 0.22, detail, clock, wind);
      ctx.restore();
    }
  }

  // Resources read as habitats rather than isolated icons: small companion
  // trees, berry shoots, and loose stones create believable clusters while
  // leaving the economy unchanged.
  map.resources.forEach((resource) => {
    const point = worldCellCenter(resource.x, resource.y);
    if (point.x < bounds.left - 100 || point.x > bounds.right + 100 || point.y < bounds.top - 100 || point.y > bounds.bottom + 100) return;
    const edgeDistance = Math.hypot(resource.x - centralX, (resource.y - centralY) * 1.05);
    if (edgeDistance < 5.8 || nearHumanStructure(point.x, point.y, 240)) return;
    const offsets = resource.type === "wood"
      ? [[-31, 15, 0.35], [29, 10, 0.3], [-16, -25, 0.27]]
      : resource.type === "food"
        ? [[-24, 13, 0.42], [22, 6, 0.34]]
        : [[-23, 11, 0.38], [23, 8, 0.3]];
    offsets.forEach(([offsetX, offsetY, scale], index) => {
      const targetX = resource.x + (offsetX < -8 ? -1 : offsetX > 8 ? 1 : 0);
      const targetY = resource.y + (offsetY < -8 ? -1 : offsetY > 8 ? 1 : 0);
      const target = map.grid[targetY]?.[targetX];
      if (!target || target.terrain === "water" || target.resourceId) return;
      const drawX = point.x + offsetX + compositionHash(resource.x + index, resource.y, seed + 31) * 8 - 4;
      const drawY = point.y + offsetY + compositionHash(resource.x, resource.y + index, seed + 37) * 8 - 4;
      ctx.save();
      ctx.globalAlpha = resource.type === "wood" ? 0.46 : 0.42;
      if (resource.type === "wood") drawTree(ctx, drawX, drawY, scale, resource.phase + index * 0.8, clock, wind);
      else if (resource.type === "food") drawBerry(ctx, drawX, drawY, scale, resource.phase + index * 0.7, clock);
      else drawRock(ctx, drawX, drawY, scale);
      ctx.restore();
    });
  });
};

const animalBadge = (animal) => ({
  wandering: ["⌁", "range"], resting: ["z", "rest"], drinking: ["≈", "drink"],
  fleeing: ["!", "flee"], pollinating: ["✿", "pollinate"], charging: ["!", "charge"]
}[animal.activity] || ["·", "wild"]);

const animalSprite = (animal) => {
  const bySpecies = {
    reedbuck: { wandering: [1, 0], drinking: [2, 0], resting: [3, 0], fleeing: [1, 0] },
    mosshare: { wandering: [0, 1], drinking: [3, 1], resting: [2, 1], fleeing: [1, 1] },
    creekotter: { wandering: [0, 2], drinking: [0, 2], resting: [1, 2], fleeing: [0, 2] },
    brushboar: { wandering: [2, 2], charging: [2, 2], fleeing: [2, 2], resting: [2, 2] },
    honeybee: { wandering: [3, 2], pollinating: [3, 2], resting: [3, 2] }
  };
  return bySpecies[animal.species]?.[animal.activity] || bySpecies[animal.species]?.wandering || [0, 0];
};

const drawGeneratedAnimal = (ctx, animal, species, clock, selected) => {
  if (!art.animals.image) return false;
  const [column, row] = animalSprite(animal);
  const moving = ["wandering", "fleeing", "charging"].includes(animal.activity);
  const bob = Math.sin(clock * 3.3 + animal.phase) * (moving ? 1.4 : 0.5) * species.size;
  const x = animal.x;
  const y = animal.y + bob;
  drawShadow(ctx, x, y + 10 * species.size, 17 * species.size, 5 * species.size, 0.15);
  if (selected) {
    ctx.strokeStyle = species.dangerous ? "rgba(235,136,104,.95)" : "rgba(249,222,143,.95)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y + 6, 26 * species.size, 11 * species.size, 0, 0, TAU); ctx.stroke();
  }
  fitAtlasSprite(ctx, art.animals, column, row, x, y - 3, 72 * species.size, 72 * species.size, { flip: Number(animal.facing) < 0 });
  if (selected || animal.activity === "charging") {
    const [icon, label] = animalBadge(animal);
    const width = selected ? 74 : 25;
    const left = x - width / 2;
    const top = y - (selected ? 50 : 27) * species.size;
    ctx.save();
    ctx.fillStyle = species.dangerous && animal.activity === "charging" ? "rgba(133,57,44,.92)" : "rgba(249,246,224,.93)";
    roundRect(ctx, left, top, width, 16, 7); ctx.fill();
    ctx.fillStyle = species.dangerous && animal.activity === "charging" ? "#ffe7ce" : "#4f7652";
    ctx.font = "800 8px Inter, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(selected ? `${icon}  ${label}` : icon, x, top + 11); ctx.restore();
  }
  if (selected) {
    ctx.fillStyle = "rgba(24,39,31,.86)";
    roundRect(ctx, x - 42, y - 69, 84, 18, 8); ctx.fill();
    ctx.fillStyle = "#fff4d2"; ctx.font = "700 10px Inter, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(species.name, x, y - 56);
  }
  return true;
};

const drawAnimal = (ctx, animal, clock, selected = false) => {
  const species = ANIMAL_SPECIES[animal.species] || ANIMAL_SPECIES.mosshare;
  if (drawGeneratedAnimal(ctx, animal, species, clock, selected)) return;
  const scale = species.size;
  const moving = ["wandering", "fleeing", "charging"].includes(animal.activity);
  const bob = Math.sin(clock * 3.3 + animal.phase) * (moving ? 1.8 : 0.65) * scale;
  const x = animal.x;
  const y = animal.y + bob;
  drawShadow(ctx, x, y + 10 * scale, 14 * scale, 5 * scale, 0.16);
  if (selected) {
    ctx.strokeStyle = species.dangerous ? "rgba(235,136,104,.95)" : "rgba(249,222,143,.95)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y + 6 * scale, 21 * scale, 10 * scale, 0, 0, TAU); ctx.stroke();
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(animal.facing < 0 ? -scale : scale, scale);
  const legStep = moving ? Math.sin(clock * 6 + animal.phase) * 2.4 : 0;
  if (animal.species === "reedbuck") {
    ctx.strokeStyle = "#765341"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-7, 5); ctx.lineTo(-8, 15 + legStep); ctx.moveTo(5, 5); ctx.lineTo(7, 15 - legStep); ctx.stroke();
    ctx.fillStyle = species.color; ctx.beginPath(); ctx.ellipse(-1, 0, 15, 8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = species.underfur; ctx.beginPath(); ctx.ellipse(6, -1, 7, 4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = species.color; ctx.beginPath(); ctx.ellipse(11, -8, 6, 5, -0.15, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#77503d"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(11, -12); ctx.lineTo(9, -18); ctx.moveTo(13, -12); ctx.lineTo(16, -18); ctx.stroke();
  } else if (animal.species === "mosshare") {
    ctx.fillStyle = species.color; ctx.beginPath(); ctx.ellipse(-1, 2, 10, 7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = species.underfur; ctx.beginPath(); ctx.arc(8, -3, 5, 0, TAU); ctx.fill();
    ctx.fillStyle = species.color; ctx.beginPath(); ctx.ellipse(7, -12, 2.5, 8, -0.2, 0, TAU); ctx.ellipse(12, -12, 2.5, 8, 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = "#e7c9b4"; ctx.beginPath(); ctx.ellipse(7, -13, 1, 5, -0.2, 0, TAU); ctx.ellipse(12, -13, 1, 5, 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = "#392f29"; ctx.beginPath(); ctx.arc(10, -4, 1, 0, TAU); ctx.fill();
  } else if (animal.species === "creekotter") {
    ctx.strokeStyle = species.color; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-11, 5); ctx.quadraticCurveTo(-20, 8, -23, 2); ctx.stroke();
    ctx.fillStyle = species.color; ctx.beginPath(); ctx.ellipse(0, 2, 15, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = species.underfur; ctx.beginPath(); ctx.ellipse(8, 1, 6, 3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#2c2823"; ctx.beginPath(); ctx.arc(12, -2, 4, 0, TAU); ctx.fill();
  } else if (animal.species === "honeybee") {
    ctx.fillStyle = "rgba(237,242,213,.75)"; ctx.beginPath(); ctx.ellipse(-4, -5, 5, 3, -0.5, 0, TAU); ctx.ellipse(5, -5, 5, 3, 0.5, 0, TAU); ctx.fill();
    ctx.fillStyle = species.color; ctx.beginPath(); ctx.ellipse(0, 0, 7, 4, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = species.underfur; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-2, -3); ctx.lineTo(-2, 3); ctx.moveTo(2, -3); ctx.lineTo(2, 3); ctx.stroke();
  } else {
    ctx.strokeStyle = "#4b362e"; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-7, 5); ctx.lineTo(-9, 13 + legStep); ctx.moveTo(5, 5); ctx.lineTo(8, 13 - legStep); ctx.stroke();
    ctx.fillStyle = species.color; ctx.beginPath(); ctx.ellipse(-1, 0, 16, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = species.underfur; ctx.beginPath(); ctx.ellipse(10, -1, 8, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "#342821"; ctx.beginPath(); ctx.arc(16, -3, 2, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#f0d6a7"; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(15, 3); ctx.lineTo(19, 7); ctx.moveTo(18, 3); ctx.lineTo(22, 6); ctx.stroke();
    ctx.strokeStyle = "#d2a06c"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, -6); ctx.lineTo(0, -12); ctx.stroke();
  }
  ctx.restore();
  if (selected || animal.activity === "charging") {
    const [icon, label] = animalBadge(animal);
    const width = selected ? 74 : 25;
    const left = x - width / 2;
    const top = y - (selected ? 50 : 27) * scale;
    ctx.save();
    ctx.fillStyle = species.dangerous && animal.activity === "charging" ? "rgba(133,57,44,.92)" : "rgba(249,246,224,.93)";
    roundRect(ctx, left, top, width, 16, 7); ctx.fill();
    ctx.fillStyle = species.dangerous && animal.activity === "charging" ? "#ffe7ce" : "#4f7652";
    ctx.font = "800 8px Inter, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(selected ? `${icon}  ${label}` : icon, x, top + 11); ctx.restore();
  }
  if (selected) {
    ctx.fillStyle = "rgba(24,39,31,.86)";
    roundRect(ctx, x - 42, y - 69, 84, 18, 8); ctx.fill();
    ctx.fillStyle = "#fff4d2"; ctx.font = "700 10px Inter, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(species.name, x, y - 56);
  }
};

const drawDepletedResource = (ctx, resource) => {
  const x = (resource.x + 0.5) * WORLD.cell;
  const y = (resource.y + 0.5) * WORLD.cell;
  drawShadow(ctx, x, y + 9, 13, 5, 0.12);
  if (resource.type === "wood") {
    ctx.fillStyle = "#76563e";
    ctx.fillRect(x - 11, y - 4, 22, 13);
    ctx.strokeStyle = "#d5a36c";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y - 4, 8, 0, TAU); ctx.stroke();
  } else if (resource.type === "stone") {
    ctx.fillStyle = "rgba(130,145,137,.7)";
    ctx.beginPath(); ctx.arc(x, y + 3, 10, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(227,224,188,.45)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 4, y + 5); ctx.stroke();
  } else {
    ctx.strokeStyle = "rgba(74,114,74,.65)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 9, y + 7); ctx.lineTo(x, y - 6); ctx.lineTo(x + 10, y + 7); ctx.stroke();
  }
};

const drawGroundPile = (ctx, pile) => {
  if (art.growth.image) {
    const position = { wood: [0, 0], stone: [1, 0], food: [2, 0] }[pile.type] || [0, 0];
    const size = Math.min(82, 54 + Math.min(8, pile.amount) * 3.2);
    drawShadow(ctx, pile.x, pile.y + 8, size * 0.24, size * 0.08, 0.14);
    fitAtlasSprite(ctx, art.growth, position[0], position[1], pile.x, pile.y - 4, size, size, { alpha: 0.9 });
    return;
  }
  drawShadow(ctx, pile.x, pile.y + 7, 13, 5, 0.14);
  const color = RESOURCE_META[pile.type].color;
  ctx.fillStyle = color;
  for (let index = 0; index < Math.min(4, pile.amount); index += 1) {
    const offset = (index - 1.5) * 5;
    ctx.beginPath();
    ctx.arc(pile.x + offset, pile.y + (index % 2) * 2, 4, 0, TAU);
    ctx.fill();
  }
};

const drawGeneratedResource = (ctx, resource, clock) => {
  if (!art.world.image) return false;
  const x = (resource.x + 0.5) * WORLD.cell;
  const y = (resource.y + 0.5) * WORLD.cell;
  const amountRatio = resource.amount / Math.max(1, resource.max);
  const depleted = resource.amount <= 0;
  const position = resource.type === "wood"
    ? (depleted ? [1, 0] : [0, 0])
    : resource.type === "stone" ? [2, 0] : [3, 0];
  const alpha = depleted ? 0.42 : 1;
  const size = resource.type === "wood" ? 70 : 64;
  drawShadow(ctx, x, y + 13, 17, 6, depleted ? 0.1 : 0.16);
  fitAtlasSprite(ctx, art.world, position[0], position[1], x, y - 4, size, size, { alpha });
  if (!depleted && amountRatio < 0.35) {
    ctx.strokeStyle = "rgba(83,66,48,.3)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y + 8, 17, 0, TAU); ctx.stroke();
  }
  return true;
};

const drawCampfire = (ctx, x, y, clock, selected = false) => {
  drawShadow(ctx, x, y + 17, 35, 12, 0.18);
  const fireRadius = 52 + Math.sin(clock * 2) * 4;
  const fireStrength = 0.12 + activeSceneLighting.darkness * 0.34 + activeSceneLighting.goldenStrength * 0.05;
  const fireGlow = ctx.createRadialGradient(x, y - 2, 3, x, y - 2, fireRadius * 1.65);
  fireGlow.addColorStop(0, `rgba(255,211,116,${fireStrength * 0.72})`);
  fireGlow.addColorStop(0.32, `rgba(244,157,74,${fireStrength * 0.28})`);
  fireGlow.addColorStop(1, "rgba(244,157,74,0)");
  ctx.fillStyle = fireGlow;
  ctx.fillRect(x - fireRadius * 1.7, y - fireRadius * 1.7, fireRadius * 3.4, fireRadius * 3.4);
  ctx.fillStyle = `rgba(232,182,94,${0.12 + activeSceneLighting.darkness * 0.1})`;
  ctx.beginPath(); ctx.ellipse(x, y + 4, 37 + Math.sin(clock * 2) * 3, 19, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#7a503a";
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(x - 19, y + 12); ctx.lineTo(x + 17, y - 10); ctx.moveTo(x - 17, y - 10); ctx.lineTo(x + 19, y + 12); ctx.stroke();
  const flame = 18 + Math.sin(clock * 8) * 3;
  ctx.fillStyle = "#f1c063";
  ctx.beginPath(); ctx.moveTo(x, y - flame - 6); ctx.bezierCurveTo(x - 17, y - 3, x - 11, y - 21, x, y - 31); ctx.bezierCurveTo(x + 2, y - 16, x + 18, y - 13, x, y - flame - 6); ctx.fill();
  ctx.fillStyle = "#ef8550";
  ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.bezierCurveTo(x - 8, y - 17, x - 4, y - 25, x + 1, y - 29); ctx.bezierCurveTo(x + 7, y - 20, x + 8, y - 14, x, y - 7); ctx.fill();
  if (selected) {
    ctx.strokeStyle = "rgba(252,227,154,.9)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 41, 0, TAU); ctx.stroke();
  }
};

const weatherVisual = (state) => {
  const blend = Math.max(0, Math.min(1, Number(state.weatherBlend) || 1));
  const current = state.weather?.type || "clear";
  const previous = state.weatherFrom?.type || current;
  const amount = (type, key) => {
    const values = {
      clear: { clouds: 0, rain: 0 },
      cloudy: { clouds: 0.72, rain: 0 },
      rain: { clouds: 1, rain: 1 },
      storm: { clouds: 1, rain: 1.2 }
    };
    return values[type]?.[key] || 0;
  };
  return {
    clouds: amount(previous, "clouds") * (1 - blend) + amount(current, "clouds") * blend,
    rain: amount(previous, "rain") * (1 - blend) + amount(current, "rain") * blend,
    storm: state.majorEvent?.phase === "storm" ? 1 : state.majorEvent?.phase === "warning" ? 0.35 : 0
  };
};

const drawLightSource = (ctx, x, y, radius, color, strength) => {
  if (strength <= 0.01) return;
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, rgba(color, strength));
  glow.addColorStop(0.28, rgba(color, strength * 0.42));
  glow.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
};

const drawTorch = (ctx, x, y, clock, lightStrength) => {
  ctx.strokeStyle = "#664734";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x, y + 12); ctx.lineTo(x, y - 2); ctx.stroke();
  const flicker = Math.sin(clock * 8 + x * 0.02) * 1.5;
  ctx.fillStyle = `rgba(248,187,91,${0.62 + lightStrength * 0.3})`;
  ctx.beginPath();
  ctx.moveTo(x, y - 15 - flicker);
  ctx.bezierCurveTo(x - 6, y - 7, x - 4, y - 3, x, y - 1);
  ctx.bezierCurveTo(x + 5, y - 5, x + 5, y - 9, x, y - 15 - flicker);
  ctx.fill();
};

const drawBuildingLights = (ctx, state, clock, darkness) => {
  const nightStrength = Math.max(0, Math.min(1, (darkness - 0.035) / 0.64));
  if (nightStrength <= 0.01) return;
  state.buildings.filter((building) => building.complete).forEach((building) => {
    const width = building.footprint.w * WORLD.cell;
    const height = building.footprint.h * WORLD.cell;
    const x = building.x * WORLD.cell;
    const y = building.y * WORLD.cell;
    if (building.kind === "campfire") {
      const fireX = x + WORLD.cell / 2;
      const fireY = y + WORLD.cell / 2 - 9;
      drawLightSource(ctx, fireX, fireY, 184, "#f4ad56", nightStrength * 0.6);
      drawLightSource(ctx, fireX + 3, fireY + 6, 68, "#ffcf75", nightStrength * 0.24);
      ctx.fillStyle = `rgba(255,220,133,${0.6 + nightStrength * 0.3})`;
      ctx.beginPath(); ctx.arc(fireX, fireY - 22, 3 + Math.sin(clock * 7) * 0.8, 0, TAU); ctx.fill();
      fitAtlasSprite(ctx, art.world, 1, 2, fireX + Math.sin(clock * 0.45) * 3, fireY - 39, 34, 50, { alpha: 0.28 + nightStrength * 0.28 });
      return;
    }
    const torchX = x + width - 13;
    const torchY = y + 24;
    drawLightSource(ctx, torchX, torchY, 102, "#f3b75f", nightStrength * 0.28);
    drawTorch(ctx, torchX, torchY, clock, nightStrength);
    fitAtlasSprite(ctx, art.world, 2, 2, torchX, torchY + 8, 25, 38, { alpha: 0.32 + nightStrength * 0.5 });
    if (["shelter", "storage", "dryingRack"].includes(building.kind)) {
      const windowAlpha = building.kind === "shelter" ? 0.62 : 0.4;
      drawLightSource(ctx, x + width * 0.5, y + height * 0.43, 66, "#ffd57e", nightStrength * 0.12);
      ctx.fillStyle = `rgba(255,215,126,${0.22 + nightStrength * windowAlpha})`;
      ctx.fillRect(x + width * 0.5 - 5, y + height * 0.43 - 4, 10, 8);
    }
    if (building.kind === "shelter") {
      const windows = [[x + width * 0.28, y + 27], [x + width * 0.72, y + 27]];
      windows.forEach(([windowX, windowY]) => {
        drawLightSource(ctx, windowX, windowY, 58, "#ffd57e", nightStrength * 0.22);
        ctx.fillStyle = `rgba(255,215,126,${0.28 + nightStrength * 0.64})`;
        ctx.fillRect(windowX - 5, windowY - 4, 10, 8);
      });
    }
  });
};

const drawPuddle = (ctx, x, y, variation, clock, rainStrength) => {
  const shimmer = 0.5 + Math.sin(clock * 1.8 + variation * 9) * 0.5;
  ctx.fillStyle = `rgba(83,128,129,${0.025 + rainStrength * 0.055})`;
  ctx.beginPath(); ctx.ellipse(x, y, 13 + variation * 9, 5 + variation * 3, variation * 2, 0, TAU); ctx.fill();
  ctx.strokeStyle = `rgba(215,238,228,${(0.07 + rainStrength * 0.16) * shimmer})`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(x, y, 6 + shimmer * 7, 2 + shimmer * 2, variation * 2, 0, TAU); ctx.stroke();
  if (rainStrength > 0.35) {
    ctx.strokeStyle = `rgba(201,231,223,${rainStrength * 0.12 * shimmer})`;
    ctx.beginPath(); ctx.ellipse(x + 2, y - 1, 3 + shimmer * 4, 1 + shimmer, variation * 2, 0, TAU); ctx.stroke();
  }
};

const drawCloudShadows = (ctx, clouds, clock) => {
  if (clouds <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = clouds;
  for (let index = 0; index < 4; index += 1) {
    const x = ((index * 420 + clock * (16 + index * 4)) % (WORLD.width + 260)) - 130;
    const y = 155 + (index % 2) * 245 + Math.sin(clock * 0.18 + index) * 15;
    ctx.fillStyle = "rgba(43,68,76,.045)";
    ctx.beginPath();
    ctx.ellipse(x, y, 226 + index * 32, 78 + (index % 2) * 24, -0.12, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(62,81,91,.075)";
    ctx.beginPath();
    ctx.ellipse(x + 12, y + 4, 174 + index * 25, 54 + (index % 2) * 18, -0.12, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
};

const drawSunlightField = (ctx, lighting, clock) => {
  if (lighting.daylight <= 0.02 && lighting.goldenStrength <= 0.02) return;
  const sunset = lighting.sunsetGlow > lighting.sunriseGlow;
  const sunX = sunset ? WORLD.width * 0.8 : WORLD.width * 0.2;
  const sunY = 170 - lighting.sunHeight * 82 + Math.sin(clock * 0.08) * 4;
  const radius = 540 + lighting.sunHeight * 260;
  const field = ctx.createRadialGradient(sunX, sunY, 12, sunX, sunY, radius);
  const golden = lighting.goldenStrength;
  field.addColorStop(0, `rgba(255,226,151,${0.04 + lighting.daylight * 0.035 + golden * 0.18})`);
  field.addColorStop(0.36, `rgba(255,216,137,${0.018 + golden * 0.07})`);
  field.addColorStop(1, "rgba(255,216,137,0)");
  ctx.fillStyle = field;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  if (golden > 0.08) {
    const horizon = ctx.createLinearGradient(0, 0, WORLD.width, WORLD.height);
    horizon.addColorStop(0, sunset ? "rgba(250,169,105,0)" : `rgba(255,207,127,${golden * 0.12})`);
    horizon.addColorStop(0.52, `rgba(255,192,112,${golden * 0.065})`);
    horizon.addColorStop(1, sunset ? `rgba(235,134,94,${golden * 0.1})` : "rgba(255,207,127,0)");
    ctx.fillStyle = horizon;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  }
};

const drawMistBands = (ctx, lighting, weather, clock) => {
  const mist = clamp((lighting.darkness - 0.24) * 0.72 + weather.rain * 0.56 + lighting.goldenStrength * 0.16, 0, 1);
  if (mist <= 0.04) return;
  const color = lighting.goldenStrength > 0.2 ? "255,220,174" : weather.rain > 0.1 ? "204,224,218" : "177,205,203";
  ctx.save();
  for (let index = 0; index < 4; index += 1) {
    const x = ((index * 520 + clock * (8 + index * 2)) % (WORLD.width + 520)) - 260;
    const y = 270 + index * 218 + Math.sin(clock * 0.24 + index) * 17;
    const width = 210 + index * 50;
    const height = 34 + index * 7;
    const haze = ctx.createRadialGradient(x, y, 4, x, y, width);
    haze.addColorStop(0, `rgba(${color},${mist * (0.045 + index * 0.008)})`);
    haze.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = haze;
    ctx.beginPath(); ctx.ellipse(x, y, width, height, -0.06, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = `rgba(${color},${mist * 0.18})`;
  for (let index = 0; index < 12; index += 1) {
    const x = 80 + ((index * 257 + clock * 5) % (WORLD.width - 160));
    const y = 140 + ((index * 181) % (WORLD.height - 260)) + Math.sin(clock * 0.7 + index) * 8;
    ctx.beginPath(); ctx.arc(x, y, 1.2 + (index % 3) * 0.5, 0, TAU); ctx.fill();
  }
  ctx.restore();
};

const drawSkyDetails = (ctx, lighting, clock) => {
  const { phase, darkness, warmth, sunHeight } = lighting;
  if (darkness > 0.3) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.75, (darkness - 0.25) * 1.3);
    for (let index = 0; index < 28; index += 1) {
      const x = 34 + ((index * 271) % (WORLD.width - 68));
      const y = 28 + ((index * 149) % 260);
      const twinkle = 1 + Math.sin(clock * 1.5 + index) * 0.45;
      ctx.fillStyle = index % 4 === 0 ? "#ffe5a4" : "#d6e6d2";
      ctx.fillRect(x, y, 1.4 * twinkle, 1.4 * twinkle);
    }
    ctx.restore();
  }
  const warmMoment = phase === "dawn" || phase === "sunrise" || phase === "sunset";
  if (warmMoment) {
    const horizon = phase === "sunset" ? WORLD.width * 0.8 : WORLD.width * 0.18;
    const glow = ctx.createRadialGradient(horizon, 180, 4, horizon, 180, 460);
    glow.addColorStop(0, `rgba(255,204,119,${0.1 + warmth * 0.1})`);
    glow.addColorStop(1, "rgba(255,204,119,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  }
  const celestialX = phase === "sunset" ? WORLD.width * 0.78 : phase === "dawn" || phase === "sunrise" ? WORLD.width * 0.18 : WORLD.width * (0.2 + sunHeight * 0.6);
  const celestialY = phase === "night" ? 130 : 250 - sunHeight * 155;
  if (phase === "night") {
    ctx.fillStyle = "rgba(230,239,215,.7)";
    ctx.beginPath(); ctx.arc(celestialX, celestialY, 17, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(147,169,161,.25)";
    ctx.beginPath(); ctx.arc(celestialX + 6, celestialY - 5, 4, 0, TAU); ctx.arc(celestialX - 4, celestialY + 7, 3, 0, TAU); ctx.fill();
  } else if (sunHeight > 0.02) {
    ctx.fillStyle = `rgba(255,214,125,${0.2 + warmth * 0.18})`;
    ctx.beginPath(); ctx.arc(celestialX, celestialY, 21, 0, TAU); ctx.fill();
  }
};

const drawAmbientLife = (ctx, lighting, weather, clock) => {
  const birdAlpha = Math.max(0.12, 0.78 - weather.rain * 0.58);
  ctx.save();
  ctx.strokeStyle = `rgba(43,66,53,${birdAlpha})`;
  ctx.lineWidth = 1.8;
  for (let flock = 0; flock < 3; flock += 1) {
    const centerX = ((flock * 520 + clock * (18 + flock * 7)) % (WORLD.width + 180)) - 90;
    const centerY = 118 + flock * 88 + Math.sin(clock * 0.55 + flock) * 18;
    for (let bird = 0; bird < 3; bird += 1) {
      const x = centerX + bird * 16 - 15;
      const y = centerY + Math.sin(clock * 1.4 + bird + flock) * 5;
      const wing = 3 + Math.sin(clock * 5 + bird) * 1.2;
      ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.quadraticCurveTo(x, y - wing, x + 5, y); ctx.stroke();
    }
  }
  if (lighting.darkness < 0.42) {
    ctx.fillStyle = `rgba(244,207,116,${0.3 + (0.42 - lighting.darkness) * 0.8})`;
    for (let index = 0; index < 15; index += 1) {
      const x = 140 + ((index * 233) % (WORLD.width - 280));
      const y = 210 + ((index * 97) % 600) + Math.sin(clock * 2.2 + index) * 4;
      ctx.beginPath(); ctx.arc(x, y, 1.3 + (index % 3) * 0.35, 0, TAU); ctx.fill();
    }
  } else {
    ctx.fillStyle = `rgba(231,212,123,${Math.min(0.8, (lighting.darkness - 0.25) * 1.5)})`;
    for (let index = 0; index < 18; index += 1) {
      const x = 80 + ((index * 307) % (WORLD.width - 160));
      const y = 250 + ((index * 137) % 760) + Math.sin(clock * 1.4 + index) * 6;
      const pulse = 1.1 + Math.sin(clock * 3 + index) * 0.45;
      ctx.beginPath(); ctx.arc(x, y, pulse, 0, TAU); ctx.fill();
    }
  }
  if (art.world.image && birdAlpha > 0.24) {
    for (let flock = 0; flock < 2; flock += 1) {
      const x = ((flock * 720 + clock * (24 + flock * 8)) % (WORLD.width + 150)) - 75;
      const y = 130 + flock * 110 + Math.sin(clock * 0.6 + flock) * 14;
      fitAtlasSprite(ctx, art.world, 3, 2, x, y, 60, 44, { alpha: birdAlpha * 0.55 });
    }
  }
  ctx.restore();
};

const buildingSprite = (building) => {
  const stage = building.complete ? "complete" : building.stage;
  const positions = {
    campfire: { complete: [0, 0] },
    shelter: { complete: [1, 0], foundation: [0, 2], frame: [1, 2], finishing: [1, 2] },
    storage: { complete: [2, 0], foundation: [2, 2], frame: [3, 2], finishing: [3, 2] },
    dryingRack: { complete: [3, 0], foundation: [0, 2], frame: [1, 2], finishing: [1, 2] },
    woodcutterArea: { complete: [0, 1], foundation: [0, 2], frame: [1, 2], finishing: [1, 2] },
    stoneSite: { complete: [1, 1], foundation: [2, 2], frame: [3, 2], finishing: [3, 2] },
    well: { complete: [2, 1], foundation: [2, 2], frame: [3, 2], finishing: [3, 2] },
    berryStand: { complete: [3, 1], foundation: [0, 2], frame: [1, 2], finishing: [1, 2] }
  };
  return positions[building.kind]?.[stage] || positions[building.kind]?.complete || [0, 2];
};

const drawGeneratedBuilding = (ctx, building, clock, selected) => {
  const x = building.x * WORLD.cell;
  const y = building.y * WORLD.cell;
  const width = building.footprint.w * WORLD.cell;
  const height = building.footprint.h * WORLD.cell;
  const [column, row] = buildingSprite(building);
  if (!art.buildings.image) return false;
  drawShadow(ctx, x + width / 2, y + height - 7, width * 0.42, height * 0.15, 0.2);
  fitAtlasSprite(ctx, art.buildings, column, row, x + width / 2, y + height / 2 + 2, width * 1.2, height * 1.2, { rotate: building.rotation || 0 });
  if (!building.complete) {
    ctx.fillStyle = "rgba(31,47,35,.16)";
    roundRect(ctx, x + 8, y + height - 18, width - 16, 8, 4); ctx.fill();
    ctx.fillStyle = "rgba(231,189,101,.9)";
    roundRect(ctx, x + 8, y + height - 18, (width - 16) * Math.max(0.02, building.progress), 8, 4); ctx.fill();
  }
  if (building.stormPrepared) {
    ctx.strokeStyle = "rgba(118,78,51,.86)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + 10, y + 16); ctx.lineTo(x + width - 10, y + height - 13); ctx.moveTo(x + width - 10, y + 16); ctx.lineTo(x + 10, y + height - 13); ctx.stroke();
  }
  if ((building.stormDamage || 0) > 0.02) {
    const damage = Math.min(1, building.stormDamage * 3.2);
    ctx.strokeStyle = `rgba(91,65,54,${0.35 + damage * 0.42})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + width * 0.28, y + 19); ctx.lineTo(x + width * 0.42, y + 34); ctx.lineTo(x + width * 0.35, y + height - 14); ctx.moveTo(x + width * 0.68, y + 25); ctx.lineTo(x + width * 0.58, y + 44); ctx.lineTo(x + width * 0.72, y + height - 9); ctx.stroke();
  }
  if (selected) {
    ctx.strokeStyle = "#f5db91";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([7, 5]);
    roundRect(ctx, x + 1, y + 5, width - 2, height - 5, 15); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (building.completionPulse > 0) {
    ctx.strokeStyle = `rgba(246,213,126,${building.completionPulse * 0.7})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x + width / 2, y + height / 2, Math.max(width, height) * (0.42 + (1 - building.completionPulse) * 0.25), 0, TAU); ctx.stroke();
  }
  return true;
};

const growthSprite = (ctx, column, row, centerX, centerY, maxWidth, maxHeight, alpha = 1) => {
  if (!art.growth.image) return false;
  return fitAtlasSprite(ctx, art.growth, column, row, centerX, centerY, maxWidth, maxHeight, { alpha });
};

const microEffectSprite = (ctx, column, row, centerX, centerY, maxWidth, maxHeight, alpha = 1, flip = false) => {
  if (!art.effects.image) return false;
  return fitAtlasSprite(ctx, art.effects, column, row, centerX, centerY, maxWidth, maxHeight, { alpha, flip });
};

const buildingCenter = (building) => ({
  x: (building.x + building.footprint.w / 2) * WORLD.cell,
  y: (building.y + building.footprint.h / 2) * WORLD.cell
});

const drawSettledGround = (ctx, building, level, growth) => {
  const x = building.x * WORLD.cell;
  const y = building.y * WORLD.cell;
  const width = building.footprint.w * WORLD.cell;
  const height = building.footprint.h * WORLD.cell;
  const spread = building.kind === "campfire" ? 2.05 + (growth.hearth || 0) * 0.28 : 1.03 + level * 0.1;
  drawShadow(ctx, x + width / 2, y + height - 5, width * 0.47 * spread, Math.max(7, height * 0.16 * spread), 0.12 + level * 0.035);
  ctx.save();
  ctx.fillStyle = `rgba(137,112,67,${0.045 + level * 0.055 + growth.cleared * 0.04})`;
  ctx.beginPath();
  ctx.ellipse(x + width / 2, y + height * 0.67, width * 0.48 * spread, Math.max(9, height * 0.23 * spread), -0.08, 0, TAU);
  ctx.fill();
  if (building.kind === "campfire") {
    ctx.strokeStyle = `rgba(112,91,59,${0.11 + level * 0.08})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x + width / 2, y + height * 0.67, width * 0.36 * spread, Math.max(8, height * 0.14 * spread), -0.08, 0, TAU);
    ctx.stroke();
  }
  if (level > 0.55 && building.kind !== "campfire") {
    ctx.strokeStyle = `rgba(116,95,61,${0.12 + level * 0.08})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x + width / 2, y + height * 0.72, width * 0.39, Math.max(6, height * 0.14), -0.08, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
};

const drawConstructionMaterials = (ctx, building) => {
  if (building.complete || !art.growth.image) return;
  const def = BUILDINGS[building.kind];
  const center = buildingCenter(building);
  const progress = clamp(Number(building.progress) || 0, 0, 1);
  const availableWood = Math.max(0, (building.materials.wood || 0) - (building.consumed?.wood || 0));
  const availableStone = Math.max(0, (building.materials.stone || 0) - (building.consumed?.stone || 0));
  const materialRatio = clamp(progress * 0.36 + (availableWood / Math.max(1, def.cost.wood)) * 0.64, 0, 1);
  const stoneRatio = clamp(progress * 0.3 + (availableStone / Math.max(1, def.cost.stone)) * 0.7, 0, 1);
  if (def.cost.wood > 0 && materialRatio > 0.06) {
    growthSprite(ctx, 0, 0, center.x - 24, center.y + building.footprint.h * WORLD.cell * 0.44, 36 + materialRatio * 30, 34 + materialRatio * 24, 0.72);
  }
  if (def.cost.stone > 0 && stoneRatio > 0.06) {
    growthSprite(ctx, 1, 0, center.x + 26, center.y + building.footprint.h * WORLD.cell * 0.43, 34 + stoneRatio * 26, 34 + stoneRatio * 22, 0.7);
  }
};

const drawVisibleStockpiles = (ctx, state) => {
  const growth = state.settlementGrowth || {};
  const stockpiles = growth.stockpiles || {};
  const storage = state.buildings.find((building) => building.complete && building.kind === "storage")
    || state.buildings.find((building) => building.complete && building.kind === "campfire");
  if (!storage || !art.growth.image) return;
  const center = buildingCenter(storage);
  const positions = {
    wood: { column: 0, row: 0, x: -48, y: 24 },
    stone: { column: 1, row: 0, x: 46, y: 26 },
    food: { column: 2, row: 0, x: 0, y: -38 }
  };
  Object.entries(positions).forEach(([type, position]) => {
    const amount = Number(stockpiles[type]) || 0;
    if (amount < 1.2) return;
    const ratio = clamp(amount / 18, 0, 1);
    const size = 38 + ratio * 34;
    growthSprite(ctx, position.column, position.row, center.x + position.x, center.y + position.y, size, size, 0.72 + ratio * 0.2);
    if (amount > 10) growthSprite(ctx, position.column, position.row, center.x + position.x + (type === "food" ? 23 : -16), center.y + position.y + 10, size * 0.58, size * 0.58, 0.46 + ratio * 0.18);
  });
};

const drawSettlementGroundDressing = (ctx, state, visibleBuildings = state.buildings) => {
  const growth = state.settlementGrowth || { cleared: 0, hearth: 0 };
  visibleBuildings.forEach((building) => {
    const level = building.complete ? clamp((Number(building.occupation) || 0) + 0.16, 0, 1) : clamp(Number(building.progress) || 0, 0, 1) * 0.7;
    if (level > 0.02) drawSettledGround(ctx, building, level, growth);
    drawConstructionMaterials(ctx, building);
  });
  // The campfire already owns a complete fire-and-stone sprite. Do not layer
  // the full hearth crop over it: that reads as two overlapping fires at
  // close zoom. Hearth progression is communicated by worn ground, glow,
  // smoke, and nearby stockpiles instead.
  drawVisibleStockpiles(ctx, state);
};

const drawSettlementForeground = (ctx, state, clock, lighting, visibleBuildings = state.buildings) => {
  const growth = state.settlementGrowth || { hearth: 0, tools: 0 };
  const population = state.villagers?.length || 0;
  visibleBuildings.filter((building) => building.complete).forEach((building) => {
    const center = buildingCenter(building);
    const tier = Number(building.visualTier) || 0;
    const level = clamp((Number(building.occupation) || 0) + tier * 0.12, 0, 1);
    if (building.kind === "storage" && (tier > 0 || state.discoveries?.unlocked?.includes("organized-storage"))) {
      growthSprite(ctx, 1, 0, center.x + 55, center.y + 18, 54, 54, 0.76);
      if (tier > 1) growthSprite(ctx, 2, 0, center.x - 42, center.y + 33, 48, 48, 0.72);
    }
    if (building.kind === "shelter" && tier > 0) {
      growthSprite(ctx, 2, 2, center.x, center.y + building.footprint.h * WORLD.cell * 0.48, 58 + tier * 10, 44 + tier * 8, 0.68 + tier * 0.1);
      if (tier > 1) growthSprite(ctx, 0, 1, center.x - 46, center.y + 28, 74, 48, 0.58);
    }
    if (building.kind === "woodcutterArea") {
      growthSprite(ctx, 3, 0, center.x + 18, center.y + 14, 64 + level * 18, 48 + level * 12, 0.68 + level * 0.16);
      if (tier > 1) growthSprite(ctx, 1, 2, center.x, center.y + 30, 72, 58, 0.56);
    }
    if (building.kind === "stoneSite") growthSprite(ctx, 1, 0, center.x + 33, center.y + 13, 52 + level * 18, 52 + level * 18, 0.62 + level * 0.16);
    if (building.kind === "dryingRack" && tier > 0) growthSprite(ctx, 2, 0, center.x - 4, center.y + 30, 56 + level * 14, 56 + level * 14, 0.64 + level * 0.14);
    if (building.kind === "berryStand" && tier > 0) growthSprite(ctx, 3, 1, center.x + 43, center.y + 20, 64 + level * 16, 56 + level * 14, 0.68 + level * 0.12);
    if (building.kind === "campfire" && growth.hearth > 0.56) {
      const smokeAlpha = 0.12 + Math.min(0.18, population * 0.018) + growth.hearth * 0.1;
      fitAtlasSprite(ctx, art.world, 1, 2, center.x + Math.sin(clock * 0.8) * 5, center.y - 44, 28, 52, { alpha: smokeAlpha });
    }
    if (["dryingRack", "woodcutterArea", "stoneSite"].includes(building.kind) && level > 0.35) {
      const smokeAlpha = 0.07 + Math.min(0.12, population * 0.012) + level * 0.08;
      fitAtlasSprite(ctx, art.world, 1, 2, center.x + 20 + Math.sin(clock * 0.7 + building.x) * 4, center.y - 34, 22, 40, { alpha: smokeAlpha });
    }
  });
  if (growth.tools > 0.42 && lighting.darkness < 0.62) {
    const workSite = state.buildings.find((building) => building.complete && ["woodcutterArea", "stoneSite"].includes(building.kind));
    if (workSite) {
      const center = buildingCenter(workSite);
      growthSprite(ctx, 3, 0, center.x - 30, center.y - 24, 44, 38, 0.42 + growth.tools * 0.22);
    }
  }
};

const drawBuilding = (ctx, building, clock, selected = false) => {
  const def = BUILDINGS[building.kind];
  const x = building.x * WORLD.cell;
  const y = building.y * WORLD.cell;
  const width = building.footprint.w * WORLD.cell;
  const height = building.footprint.h * WORLD.cell;
  if (drawGeneratedBuilding(ctx, building, clock, selected)) return;
  if (building.kind === "campfire") return drawCampfire(ctx, x + WORLD.cell / 2, y + WORLD.cell / 2, clock, selected);
  drawShadow(ctx, x + width / 2, y + height - 8, width * 0.46, height * 0.17, 0.22);
  ctx.save();
  ctx.translate(x, y);
  const progress = building.complete ? 1 : building.progress;
  ctx.fillStyle = building.complete ? "#d6bd8d" : "#c2a16d";
  roundRect(ctx, 6, 12, width - 12, height - 17, 13);
  ctx.fill();
  ctx.strokeStyle = rgba("#4e5d47", 0.7);
  ctx.lineWidth = 2;
  ctx.stroke();
  if (building.stage === "foundation") {
    ctx.strokeStyle = "#805c43";
    ctx.lineWidth = 5;
    ctx.strokeRect(15, 22, width - 30, height - 32);
    ctx.strokeStyle = "rgba(244,218,165,.64)";
    ctx.lineWidth = 2;
    ctx.strokeRect(22, 29, width - 44, height - 46);
  } else {
    ctx.fillStyle = def.accent;
    polygon(ctx, [[4, 19], [width / 2, -4], [width - 4, 19], [width - 11, 29], [width / 2, 10], [11, 29]]);
    ctx.fill();
    ctx.fillStyle = "#f0d7a5";
    roundRect(ctx, width / 2 - 10, height - 34, 20, 28, 5); ctx.fill();
    ctx.fillStyle = "rgba(255,245,196,.6)";
    ctx.beginPath(); ctx.arc(width / 2, height - 23, 3, 0, TAU); ctx.fill();
    if (building.kind === "storage") {
      ctx.fillStyle = "#7d5941";
      ctx.fillRect(13, height - 32, width - 26, 12);
      ctx.strokeStyle = "#e5cb94";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(15, height - 28); ctx.lineTo(width - 15, height - 28); ctx.moveTo(15, height - 22); ctx.lineTo(width - 15, height - 22); ctx.stroke();
    }
    if (building.kind === "berryStand") {
      ctx.fillStyle = "#7a5740";
      ctx.fillRect(12, height - 31, width - 24, 8);
      ctx.fillStyle = "#be6274";
      [0, 1, 2].forEach((index) => { ctx.beginPath(); ctx.arc(25 + index * 16, height - 39, 5, 0, TAU); ctx.fill(); });
    }
    if (building.kind === "shelter") {
      ctx.fillStyle = "#7a543e";
      ctx.fillRect(width / 2 - 12, height - 33, 24, 27);
      ctx.fillStyle = "#eed7a4";
      ctx.beginPath(); ctx.arc(width / 2, height - 23, 3, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(255,240,190,.55)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(14, 27); ctx.lineTo(width - 14, 27); ctx.stroke();
    }
    if (building.kind === "dryingRack") {
      ctx.strokeStyle = "#79563f";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(15, height - 24); ctx.lineTo(15, 22); ctx.moveTo(width - 15, height - 24); ctx.lineTo(width - 15, 22); ctx.moveTo(12, 24); ctx.lineTo(width - 12, 24); ctx.stroke();
      ctx.fillStyle = "#d8895c";
      [0, 1, 2].forEach((index) => { ctx.beginPath(); ctx.arc(24 + index * 17, 33, 5, 0, TAU); ctx.fill(); });
    }
    if (building.kind === "woodcutterArea") {
      ctx.fillStyle = "#78533d";
      ctx.beginPath(); ctx.ellipse(width * 0.3, height - 24, 12, 8, -0.2, 0, TAU); ctx.fill();
      ctx.fillStyle = "#b9794e";
      ctx.beginPath(); ctx.ellipse(width * 0.7, height - 25, 18, 7, 0.25, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#e7c789"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(15, 25); ctx.lineTo(width - 15, 25); ctx.stroke();
    }
    if (building.kind === "stoneSite") {
      ctx.fillStyle = "#899995";
      [[24, height - 24, 9], [width / 2, height - 29, 11], [width - 23, height - 23, 8]].forEach(([sx, sy, radius]) => { ctx.beginPath(); ctx.arc(sx, sy, radius, 0, TAU); ctx.fill(); });
      ctx.strokeStyle = "#e4d4a7"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(width / 2, 21); ctx.lineTo(width / 2, height - 18); ctx.stroke();
    }
    if (building.kind === "well") {
      ctx.fillStyle = "#829b99";
      ctx.beginPath(); ctx.ellipse(width / 2, height * 0.58, 22, 13, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#4e8f92";
      ctx.beginPath(); ctx.ellipse(width / 2, height * 0.58, 13, 7, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#6f503d"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(width / 2 - 24, 18); ctx.lineTo(width / 2 + 24, 18); ctx.moveTo(width / 2, 18); ctx.lineTo(width / 2, height * 0.48); ctx.stroke();
    }
    if (building.stormPrepared) {
      ctx.strokeStyle = "rgba(118,78,51,.8)";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(10, 17); ctx.lineTo(width - 10, height - 13); ctx.moveTo(width - 10, 17); ctx.lineTo(10, height - 13); ctx.stroke();
    }
    if ((building.stormDamage || 0) > 0.02) {
      const damage = Math.min(1, building.stormDamage * 3.2);
      ctx.strokeStyle = `rgba(91,65,54,${0.35 + damage * 0.42})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(width * 0.28, 19); ctx.lineTo(width * 0.42, 34); ctx.lineTo(width * 0.35, 48); ctx.moveTo(width * 0.68, 25); ctx.lineTo(width * 0.58, 44); ctx.lineTo(width * 0.72, 61); ctx.stroke();
    }
  }
  if (!building.complete) {
    ctx.fillStyle = "rgba(31,47,35,.55)";
    ctx.fillRect(12, height - 13, width - 24, 4);
    ctx.fillStyle = "#e7bd65";
    ctx.fillRect(12, height - 13, (width - 24) * progress, 4);
  }
  if (selected) {
    ctx.strokeStyle = "#f5db91";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([7, 5]);
    roundRect(ctx, 1, 5, width - 2, height - 5, 15); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (building.completionPulse > 0) {
    ctx.strokeStyle = `rgba(246,213,126,${building.completionPulse * 0.7})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(width / 2, height / 2, Math.max(width, height) * (0.42 + (1 - building.completionPulse) * 0.25), 0, TAU); ctx.stroke();
  }
  ctx.restore();
};

const drawPlacementGhost = (ctx, placement, clock) => {
  if (!placement?.cell || !placement.footprint) return;
  const { x, y } = placement.cell;
  const width = placement.footprint.w * WORLD.cell;
  const height = placement.footprint.h * WORLD.cell;
  const color = placement.ok ? "#8ed18b" : "#e17e71";
  const alpha = placement.ok ? 0.23 : 0.2;
  ctx.save();
  const centerX = x * WORLD.cell + width / 2;
  const centerY = y * WORLD.cell + height / 2 + 2;
  const previewPosition = placement.kind ? buildingSprite({ kind: placement.kind, complete: true }) : null;
  if (previewPosition && art.buildings.image) {
    fitAtlasSprite(ctx, art.buildings, previewPosition[0], previewPosition[1], centerX, centerY, width * 1.2, height * 1.2, {
      alpha: placement.ok ? 0.48 : 0.22,
      rotate: placement.rotation || 0
    });
  }
  ctx.fillStyle = rgba(color, alpha);
  roundRect(ctx, x * WORLD.cell + 5, y * WORLD.cell + 8, width - 10, height - 13, 13); ctx.fill();
  ctx.strokeStyle = rgba(color, 0.95);
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 5]);
  roundRect(ctx, x * WORLD.cell + 2, y * WORLD.cell + 5, width - 4, height - 5, 14); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = rgba(color, 0.9);
  ctx.beginPath(); ctx.arc(centerX, centerY, 8 + Math.sin(clock * 5) * 1.5, 0, TAU); ctx.fill();
  ctx.restore();
};

const drawCompletionEffect = (ctx, effect, clock) => {
  const progress = effect.life / 1.35;
  const radius = 18 + progress * 52;
  ctx.save();
  ctx.strokeStyle = `rgba(246,213,126,${(1 - progress) * 0.8})`;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(effect.x, effect.y, radius, 0, TAU); ctx.stroke();
  ctx.fillStyle = `rgba(255,239,171,${(1 - progress) * 0.8})`;
  for (let index = 0; index < 8; index += 1) {
    const angle = index / 8 * TAU + clock * 0.7;
    const distance = radius * 0.72;
    ctx.fillRect(effect.x + Math.cos(angle) * distance - 2, effect.y + Math.sin(angle) * distance - 2, 4, 4);
  }
  ctx.restore();
};

const drawDiscoveryEffect = (ctx, effect, clock) => {
  const progress = effect.life / 1.35;
  const radius = 22 + progress * 68;
  ctx.save();
  ctx.strokeStyle = `rgba(255,226,137,${(1 - progress) * 0.9})`;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(effect.x, effect.y, radius, 0, TAU); ctx.stroke();
  ctx.fillStyle = `rgba(255,239,171,${(1 - progress) * 0.9})`;
  for (let index = 0; index < 10; index += 1) {
    const angle = index / 10 * TAU + clock * 1.4;
    const orbit = radius * 0.74;
    const size = 3 + (1 - progress) * 2;
    ctx.save();
    ctx.translate(effect.x + Math.cos(angle) * orbit, effect.y + Math.sin(angle) * orbit);
    ctx.rotate(angle);
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  }
  ctx.restore();
};

const drawMicroEffect = (ctx, effect, clock) => {
  const progress = clamp((Number(effect.life) || 0) / 1.35, 0, 1);
  const fade = 1 - progress;
  const lift = progress * 14;
  const pulse = 0.88 + Math.sin(clock * 8 + (effect.x || 0) * 0.01) * 0.12;
  let sprite = null;
  let size = 28;
  let alpha = fade * 0.72;
  let y = effect.y - lift;
  if (effect.type === "chips") {
    sprite = { column: effect.kind === "wood" ? 1 : effect.kind === "stone" ? 2 : effect.kind === "food" ? 3 : 0, row: 0 };
    size = 24 + fade * 10;
    alpha = fade * 0.58;
    y = effect.y - 4 - lift * 0.4;
  } else if (effect.type === "pickup") {
    sprite = { column: 0, row: 2 };
    size = 26 + (1 - fade) * 12;
    alpha = fade * 0.8;
  } else if (effect.type === "deposit") {
    sprite = { column: 0, row: 2 };
    size = 24 + fade * 10;
    alpha = fade * 0.62;
    y = effect.y - 4 - lift * 0.55;
  } else if (effect.type === "construction") {
    sprite = { column: 1, row: 2 };
    size = 34 + fade * 13;
    alpha = fade * 0.66;
    y = effect.y - 8 - lift * 0.45;
  } else if (effect.type === "eat") {
    sprite = { column: 3, row: 0 };
    size = 22 + fade * 8;
    alpha = fade * 0.46;
    y = effect.y - 6 - lift;
  } else if (effect.type === "ember") {
    sprite = { column: 0, row: 1 };
    size = 22 + fade * 9;
    alpha = fade * 0.48;
    y = effect.y - 5 - lift * 1.2;
  } else if (effect.type === "footstep") {
    sprite = { column: 2, row: 2 };
    size = 22;
    alpha = fade * 0.26;
    y = effect.y + 4;
  }
  if (!sprite || !microEffectSprite(ctx, sprite.column, sprite.row, effect.x, y, size * pulse, size * pulse, alpha, effect.flip)) return;
};

const villagerIdentityColumn = (villager) => {
  const column = Math.max(0, Math.min(3, Number(villager.atlasIndex ?? String(villager.id || "").replace(/\\D/g, "")) - 1 || 0));
  return column;
};

const villagerMotionActivities = new Set(["walking", "returning", "hauling", "wandering", "socializing", "playing"]);
const villagerActionActivities = new Set(["gathering", "pickingUp", "dropping", "building", "securing", "repairing"]);

const villagerSpriteSpec = (villager) => {
  const column = villagerIdentityColumn(villager);
  if (villager.lifeStage === "child" || Number(villager.age) < 13) return { slot: art.villagers, column: 2, row: 2 };
  if (Number(villager.age) > 58) return { slot: art.villagers, column: 3, row: 2 };
  const motionFrame = Math.floor(Math.abs(Number(villager.walkPhase) || 0) / Math.PI) % 2;
  if (villagerMotionActivities.has(villager.activity)) {
    return { slot: art.villagerMotion, column, row: villager.carrying ? 2 + motionFrame : motionFrame };
  }
  if (villagerActionActivities.has(villager.activity)) {
    const actionTime = Number(villager.actionTimer) || 0;
    if (villager.activity === "gathering" || villager.activity === "pickingUp") {
      return { slot: art.villagerActions, column, row: Math.floor(actionTime * 2.2) % 2 };
    }
    if (villager.activity === "dropping") {
      return { slot: art.villagerActions, column, row: actionTime < 0.24 ? 0 : actionTime < 0.48 ? 1 : 2 };
    }
    return { slot: art.villagerActions, column, row: 3 };
  }
  const stateSprites = {
    gathering: [0, 1], hauling: [1, 1], returning: [1, 1], eating: [2, 1], resting: [3, 1], warming: [3, 1],
    building: [0, 2], securing: [1, 2], repairing: [1, 2]
  };
  const [rowColumn, row] = stateSprites[villager.activity] || [column, 0];
  return { slot: art.villagers, column: rowColumn, row };
};

const villagerFacingSign = (villager) => Math.cos(Number(villager.facing) || 0) >= 0 ? 1 : -1;

const drawVillagerActivityAction = (ctx, villager, clock, bob = 0, spriteSpec = null) => {
  const direction = villagerFacingSign(villager);
  const x = villager.x;
  const y = villager.y + bob;
  const hasMotionSprite = spriteSpec?.slot === art.villagerMotion;
  const hasActionSprite = spriteSpec?.slot === art.villagerActions;
  const actionPhase = Math.sin((Number(villager.actionTimer) || 0) * 7);
  ctx.save();
  if (villager.carrying && !hasMotionSprite && !hasActionSprite) {
    const carry = villager.carrying;
    const position = { wood: [0, 0], stone: [1, 0], food: [2, 0], tools: [3, 0] }[carry.type] || [3, 0];
    const carryX = x + direction * 12;
    const carryY = y + 4 + Math.sin(clock * 5 + villager.walkPhase) * 1.1;
    if (!growthSprite(ctx, position[0], position[1], carryX, carryY, 29, 29, 0.94)) {
      ctx.fillStyle = RESOURCE_META[carry.type]?.color || "#bd8c57";
      ctx.beginPath(); ctx.arc(carryX, carryY, 6, 0, TAU); ctx.fill();
    }
  }
  if (villager.activity === "gathering" && !hasActionSprite) {
    ctx.save();
    ctx.translate(x + direction * 7, y + 2);
    ctx.rotate(direction * (0.52 + actionPhase * 0.24));
    ctx.strokeStyle = "#6b4e38";
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(direction * 15, -7); ctx.stroke();
    ctx.strokeStyle = "#d7b566";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(direction * 12, -10); ctx.lineTo(direction * 18, -5); ctx.stroke();
    ctx.restore();
    if (actionPhase > 0.62) {
      const chips = villager.carrying?.type === "stone" ? [2, 0] : [1, 0];
      microEffectSprite(ctx, chips[0], chips[1], x + direction * 20, y - 7, 20, 20, 0.34, direction < 0);
    }
  }
  if (["building", "securing", "repairing"].includes(villager.activity) && !hasActionSprite) {
    ctx.save();
    ctx.translate(x + direction * 7, y + 2);
    ctx.rotate(direction * (-0.36 + actionPhase * 0.43));
    ctx.strokeStyle = "#7d583d";
    ctx.lineWidth = 2.8;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(direction * 14, -8); ctx.stroke();
    ctx.fillStyle = "#d7b566";
    ctx.fillRect(direction * 10, -11, direction * 9, 4);
    ctx.restore();
    if (actionPhase > 0.65) microEffectSprite(ctx, 1, 2, x + direction * 15, y - 5, 23, 23, 0.42, direction < 0);
  }
  if (villager.activity === "eating") {
    ctx.fillStyle = "#d9a75c";
    ctx.beginPath(); ctx.arc(x + direction * 7, y + 7, 4.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#7d583d";
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(x + direction * 4, y + 4); ctx.lineTo(x + direction * 2, y - 2); ctx.stroke();
    if (actionPhase > 0.35) microEffectSprite(ctx, 3, 0, x + direction * 17, y - 11, 19, 19, 0.34, direction < 0);
  }
  if (villager.activity === "warming") microEffectSprite(ctx, 0, 1, x + direction * 12, y - 10, 20, 20, 0.28 + Math.max(0, actionPhase) * 0.12, direction < 0);
  if (["walking", "returning", "hauling", "wandering"].includes(villager.activity) && Math.sin(villager.walkPhase) > 0.9) {
    microEffectSprite(ctx, 2, 2, x - direction * 8, y + 9, 18, 17, 0.2, direction < 0);
  }
  if (villager.activity === "socializing") {
    ctx.fillStyle = "rgba(246,218,151,.82)";
    ctx.beginPath(); ctx.arc(x + direction * 13, y - 8, 2, 0, TAU); ctx.arc(x + direction * 19, y - 14, 1.3, 0, TAU); ctx.fill();
  }
  ctx.restore();
};

const drawGeneratedVillager = (ctx, villager, clock) => {
  if (!art.villagers.image && !art.villagerMotion.image && !art.villagerActions.image) return false;
  const spriteSpec = villagerSpriteSpec(villager);
  if (!spriteSpec?.slot?.image) return false;
  const childScale = villager.lifeStage === "child" ? 0.8 : 1;
  const moving = villagerMotionActivities.has(villager.activity);
  const bob = Math.sin(villager.walkPhase) * (moving ? 1.4 : 0.45) * childScale;
  fitAtlasSprite(ctx, spriteSpec.slot, spriteSpec.column, spriteSpec.row, villager.x, villager.y + bob - 3, 54 * childScale, 60 * childScale, { flip: Number(villager.facing) < 0 });
  drawVillagerActivityAction(ctx, villager, clock, bob - 3, spriteSpec);
  return true;
};

const drawVillager = (ctx, villager, clock, selected) => {
  const childScale = villager.lifeStage === "child" ? 0.76 : 1;
  const moving = villagerMotionActivities.has(villager.activity);
  const working = ["gathering", "building"].includes(villager.activity);
  const bob = Math.sin(villager.walkPhase) * (moving ? 2 : working ? 0.9 : 0.6) * childScale;
  const x = villager.x;
  const y = villager.y + bob;
  drawShadow(ctx, x, y + 13 * childScale, 12 * childScale, 5 * childScale, 0.22);
  if (selected) {
    ctx.strokeStyle = "rgba(250,224,141,.95)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y + 8, 18, 9, 0, 0, TAU); ctx.stroke();
  }
  if (drawGeneratedVillager(ctx, villager, clock)) {
    drawActivityBadge(ctx, villager, x, y, selected);
    if (selected) {
      ctx.fillStyle = "rgba(24,39,31,.86)";
      roundRect(ctx, x - 30, y - 54, 60, 18, 8); ctx.fill();
      ctx.fillStyle = "#fff4d2";
      ctx.font = "700 10px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(villager.name, x, y - 41);
    }
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(childScale, childScale);
  ctx.rotate(Math.sin(clock * 0.5 + villager.walkPhase) * (moving ? 0.035 : 0.02));
  if (villager.activity === "gathering") ctx.translate(0, Math.sin(villager.actionTimer * 7) * 1.5);
  if (villager.activity === "resting" || villager.activity === "warming") ctx.scale(1, 1 + Math.sin(clock * 2 + villager.walkPhase) * 0.025);
  ctx.fillStyle = villager.color;
  roundRect(ctx, -10, -3, 20, 23, 8); ctx.fill();
  ctx.fillStyle = "#efc59d";
  ctx.beginPath(); ctx.arc(0, -12, 9, 0, TAU); ctx.fill();
  ctx.fillStyle = villager.hair;
  ctx.beginPath(); ctx.arc(-1, -17, 8, Math.PI, TAU); ctx.fill();
  ctx.fillStyle = "#27352d";
  ctx.beginPath(); ctx.arc(-3.5, -11, 1.3, 0, TAU); ctx.arc(3.5, -11, 1.3, 0, TAU); ctx.fill();
  ctx.strokeStyle = villager.color;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  const armSwing = moving ? Math.sin(villager.walkPhase) * 5 : 0;
  ctx.beginPath(); ctx.moveTo(-8, 3); ctx.lineTo(-13, 9 + armSwing * 0.22); ctx.moveTo(8, 3); ctx.lineTo(13, 9 - armSwing * 0.22); ctx.stroke();
  if (villager.activity === "gathering") {
    ctx.strokeStyle = "#6b4e38";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(9, 5); ctx.lineTo(17, -5 + Math.sin(villager.actionTimer * 8) * 3); ctx.stroke();
  }
  if (["building", "securing", "repairing"].includes(villager.activity)) {
    ctx.strokeStyle = "#7d583d";
    ctx.lineWidth = 3;
    const hammer = Math.sin(villager.actionTimer * 7) * 7;
    ctx.beginPath(); ctx.moveTo(9, 5); ctx.lineTo(15 + hammer, -5); ctx.stroke();
    ctx.fillStyle = "#d7b566";
    ctx.fillRect(13 + hammer, -9, 7, 4);
  }
  if (villager.activity === "eating") {
    ctx.fillStyle = "#d9a75c";
    ctx.beginPath(); ctx.arc(0, 9, 5, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#7d583d"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-3, 4); ctx.lineTo(-1, 0); ctx.stroke();
  }
  if (villager.activity === "socializing") {
    ctx.fillStyle = "#f4d18a";
    ctx.beginPath(); ctx.arc(14, -4, 2, 0, TAU); ctx.arc(19, -9, 1.6, 0, TAU); ctx.fill();
  }
  if (villager.activity === "playing") {
    ctx.fillStyle = "#d9a75c";
    ctx.beginPath(); ctx.arc(15, 7 + Math.sin(villager.actionTimer * 5) * 2, 3.5, 0, TAU); ctx.fill();
  }
  if (villager.carrying) {
    ctx.fillStyle = RESOURCE_META[villager.carrying.type].color;
    ctx.beginPath(); ctx.arc(0, 8, 5, 0, TAU); ctx.fill();
  }
  ctx.restore();
  drawActivityBadge(ctx, villager, x, y, selected);
  if (selected) {
    ctx.fillStyle = "rgba(24,39,31,.86)";
    roundRect(ctx, x - 30, y - 54, 60, 18, 8); ctx.fill();
    ctx.fillStyle = "#fff4d2";
    ctx.font = "700 10px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(villager.name, x, y - 41);
  }
};

const drawGrassDetails = (ctx, x, y, variation, clock, wind = 0.75) => {
  const sway = Math.sin(clock * 1.2 + variation * 8 + x * 0.04) * (1.4 + wind * 1.8);
  ctx.strokeStyle = variation > 0.5 ? "rgba(78,122,69,.55)" : "rgba(105,145,76,.48)";
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.lineTo(x - 2 + sway, y - 2); ctx.moveTo(x + 4, y + 8); ctx.lineTo(x + 6 + sway, y); ctx.stroke();
};

const drawWater = (ctx, x, y, variation, clock, wind = 0.75) => {
  const wave = Math.sin(clock * 1.6 + variation * 4 + x * 0.01) * (3 + wind * 2);
  const secondary = Math.sin(clock * 1.15 + variation * 7 + y * 0.02) * 2;
  ctx.strokeStyle = "rgba(218,240,213,.32)";
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(x + 6, y + 18 + wave); ctx.quadraticCurveTo(x + 27, y + 12 - wave, x + 51, y + 19 + wave); ctx.stroke();
  ctx.strokeStyle = "rgba(57,116,122,.2)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + 13, y + 39 + secondary); ctx.quadraticCurveTo(x + 29, y + 34 - secondary, x + 46, y + 40 + secondary); ctx.stroke();
  if (variation > 0.42) {
    ctx.strokeStyle = "rgba(238,247,221,.2)";
    ctx.beginPath(); ctx.moveTo(x + 22, y + 6 + secondary); ctx.quadraticCurveTo(x + 34, y + 3 - secondary, x + 43, y + 7 + secondary); ctx.stroke();
  }
};

const drawShoreEdge = (ctx, x, y, cell, grid, column, row) => {
  const waterAt = (dx, dy) => grid[row + dy]?.[column + dx]?.terrain === "water";
  ctx.save();
  ctx.strokeStyle = "rgba(223,211,166,.28)";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  if (waterAt(-1, 0)) {
    ctx.beginPath(); ctx.moveTo(x + 3, y + 6); ctx.quadraticCurveTo(x + 8, y + cell * 0.5, x + 3, y + cell - 5); ctx.stroke();
  }
  if (waterAt(1, 0)) {
    ctx.beginPath(); ctx.moveTo(x + cell - 3, y + 6); ctx.quadraticCurveTo(x + cell - 8, y + cell * 0.5, x + cell - 3, y + cell - 5); ctx.stroke();
  }
  if (waterAt(0, -1)) {
    ctx.beginPath(); ctx.moveTo(x + 6, y + 3); ctx.quadraticCurveTo(x + cell * 0.5, y + 8, x + cell - 6, y + 3); ctx.stroke();
  }
  if (waterAt(0, 1)) {
    ctx.beginPath(); ctx.moveTo(x + 6, y + cell - 3); ctx.quadraticCurveTo(x + cell * 0.5, y + cell - 8, x + cell - 6, y + cell - 3); ctx.stroke();
  }
  // Small, broken bank marks soften the hard cell boundary and make the
  // creek feel like it shaped the meadow instead of being cut into it.
  ctx.fillStyle = "rgba(211,192,137,.18)";
  [[-1, 0, x + 8, y + 15 + (row % 3) * 11], [1, 0, x + cell - 8, y + 27 + (column % 3) * 8], [0, -1, x + 18 + (column % 3) * 12, y + 8], [0, 1, x + 31 + (row % 3) * 9]]
    .filter(([dx, dy]) => waterAt(dx, dy))
    .forEach(([, , markX, markY], index) => {
      ctx.beginPath(); ctx.ellipse(markX, markY, 7 + (index % 2) * 3, 2.5, index % 2 ? 0.22 : -0.22, 0, TAU); ctx.fill();
    });
  ctx.fillStyle = "rgba(177,157,101,.12)";
  if (waterAt(-1, 0)) { ctx.beginPath(); ctx.ellipse(x + 5, y + cell * 0.5, 18, cell * 0.46, 0, 0, TAU); ctx.fill(); }
  if (waterAt(1, 0)) { ctx.beginPath(); ctx.ellipse(x + cell - 5, y + cell * 0.5, 18, cell * 0.46, 0, 0, TAU); ctx.fill(); }
  if (waterAt(0, -1)) { ctx.beginPath(); ctx.ellipse(x + cell * 0.5, y + 5, cell * 0.46, 18, 0, 0, TAU); ctx.fill(); }
  if (waterAt(0, 1)) { ctx.beginPath(); ctx.ellipse(x + cell * 0.5, y + cell - 5, cell * 0.46, 18, 0, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = "rgba(79,116,76,.4)";
  ctx.lineWidth = 1.4;
  [[-1, 0, x + 15, y + 22], [1, 0, x + cell - 14, y + 35], [0, -1, x + 28, y + 13], [0, 1, x + 39, y + cell - 15]]
    .filter(([dx, dy]) => waterAt(dx, dy))
    .forEach(([, , stemX, stemY], index) => {
      ctx.beginPath();
      ctx.moveTo(stemX, stemY + 7);
      ctx.lineTo(stemX - 2 + index * 1.1, stemY - 3);
      ctx.moveTo(stemX + 4, stemY + 7);
      ctx.lineTo(stemX + 6 - index * 0.8, stemY - 1);
      ctx.stroke();
    });
  ctx.restore();
};

const drawClearingField = (ctx) => {
  const field = ctx.createRadialGradient(WORLD.width * 0.5, WORLD.height * 0.5, 160, WORLD.width * 0.5, WORLD.height * 0.5, 690);
  field.addColorStop(0, "rgba(236,219,158,.045)");
  field.addColorStop(0.58, "rgba(226,210,154,.018)");
  field.addColorStop(1, "rgba(226,210,154,0)");
  ctx.fillStyle = field;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
};

const activityBadge = (villager) => {
  const badges = {
    gathering: ["✦", "gather"], hauling: ["▰", "carry"], returning: ["↩", "return"], pickingUp: ["⌄", "pick up"], dropping: ["⌄", "put down"],
    building: ["⚒", "build"], eating: ["●", "eat"], resting: ["z", "rest"], warming: ["✹", "warm"],
    socializing: ["••", "talk"], playing: ["●", "play"], securing: ["⚒", "secure"], repairing: ["↻", "repair"], wandering: ["⌁", "wander"], walking: ["›", "walk"], idle: ["·", "idle"]
  };
  return badges[villager.activity] || badges.idle;
};

const drawActivityBadge = (ctx, villager, x, y, selected) => {
  if (!selected && !["gathering", "hauling", "building", "securing", "repairing", "pickingUp", "dropping", "eating"].includes(villager.activity)) return;
  const [icon, label] = activityBadge(villager);
  const width = selected ? 78 : 45;
  const left = x - width / 2;
  const top = y - (selected ? 75 : 47);
  ctx.save();
  ctx.fillStyle = "rgba(249,246,224,.93)";
  roundRect(ctx, left, top, width, 17, 7); ctx.fill();
  ctx.fillStyle = villager.activity === "idle" ? "#81927b" : "#4f7652";
  ctx.font = "800 8px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${icon}  ${label}`, x, top + 11.5);
  ctx.restore();
};

const drawGlobalLighting = (ctx, lighting) => {
  const { darkness, warmth, moonStrength, goldenStrength } = lighting;
  if (darkness > 0.01) {
    const shade = ctx.createLinearGradient(0, 0, 0, WORLD.height);
    shade.addColorStop(0, `rgba(16,34,53,${darkness * 0.62})`);
    shade.addColorStop(0.48, `rgba(24,43,53,${darkness * 0.48})`);
    shade.addColorStop(1, `rgba(10,24,36,${darkness * 0.67})`);
    ctx.save();
    ctx.globalCompositeOperation = darkness > 0.3 ? "multiply" : "source-over";
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.restore();
    const moon = ctx.createRadialGradient(WORLD.width * 0.18, 120, 8, WORLD.width * 0.18, 120, 560);
    moon.addColorStop(0, `rgba(174,206,203,${moonStrength * 0.14})`);
    moon.addColorStop(0.48, `rgba(133,178,183,${moonStrength * 0.04})`);
    moon.addColorStop(1, "rgba(133,178,183,0)");
    ctx.fillStyle = moon;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  }
  if (warmth > 0.62 || goldenStrength > 0.04) {
    const warmthWash = ctx.createLinearGradient(0, WORLD.height, WORLD.width, 0);
    warmthWash.addColorStop(0, `rgba(246,183,92,${Math.max(0, warmth - 0.62) * 0.11 + goldenStrength * 0.025})`);
    warmthWash.addColorStop(0.55, "rgba(246,183,92,0)");
    warmthWash.addColorStop(1, `rgba(255,212,133,${Math.max(0, warmth - 0.62) * 0.06 + goldenStrength * 0.045})`);
    ctx.fillStyle = warmthWash;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  }
  const vignette = ctx.createRadialGradient(WORLD.width / 2, WORLD.height * 0.48, WORLD.width * 0.18, WORLD.width / 2, WORLD.height * 0.48, WORLD.width * 0.78);
  vignette.addColorStop(0, "rgba(20,34,39,0)");
  vignette.addColorStop(1, `rgba(11,26,34,${darkness * 0.16 + goldenStrength * 0.02})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
};

const drawWeatherEffects = (ctx, weather, clock, lighting, wind) => {
  if (weather.rain > 0.01) {
    ctx.fillStyle = `rgba(90,119,130,${weather.rain * 0.07})`;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    const drops = Math.floor(64 + weather.rain * 76);
    for (let index = 0; index < drops; index += 1) {
      const depth = 0.35 + (Math.sin(index * 19.17) + 1) * 0.325;
      const rx = (index * 193 + clock * (105 + wind * 42)) % (WORLD.width + 80) - 40;
      const ry = (index * 97 + clock * (154 + weather.rain * 105)) % (WORLD.height + 80) - 40;
      ctx.strokeStyle = `rgba(221,239,231,${(0.08 + weather.rain * 0.17) * depth})`;
      ctx.lineWidth = 0.9 + depth * 0.8;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - (3 + wind * 3) * depth, ry + (9 + depth * 9)); ctx.stroke();
      if (index % 9 === 0) {
        ctx.strokeStyle = `rgba(224,241,233,${(0.08 + weather.rain * 0.16) * depth})`;
        ctx.lineWidth = 0.8 + depth * 0.55;
        ctx.beginPath(); ctx.ellipse(rx - 4, ry + 15, 4 + depth * 4, 1.5 + depth, 0, 0, TAU); ctx.stroke();
      }
    }
    const rainHaze = ctx.createLinearGradient(0, 0, WORLD.width, WORLD.height);
    rainHaze.addColorStop(0, `rgba(213,228,222,${weather.rain * 0.045})`);
    rainHaze.addColorStop(0.54, "rgba(151,184,182,0)");
    rainHaze.addColorStop(1, `rgba(68,101,111,${weather.rain * 0.055})`);
    ctx.fillStyle = rainHaze;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  }
  if (weather.storm > 0.01) {
    ctx.fillStyle = `rgba(25,39,50,${0.08 + weather.storm * 0.1})`;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    const flash = Math.pow(Math.max(0, Math.sin(clock * 2.9 + 0.8)), 28);
    if (flash > 0.08) {
      ctx.fillStyle = `rgba(241,245,224,${flash * 0.48})`;
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);
      ctx.strokeStyle = `rgba(247,248,218,${flash * 0.72})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(610, 12); ctx.lineTo(572, 164); ctx.lineTo(625, 148); ctx.lineTo(587, 325);
      ctx.stroke();
    }
  }
};

export const createRenderer = (canvas) => {
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let hoverCell = null;
  let placement = null;
  let clock = 0;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const view = () => ({ width: canvas.clientWidth, height: canvas.clientHeight });

  const screenPoint = (state, worldX, worldY) => {
    const { width, height } = view();
    return { x: (worldX - state.camera.x) * state.camera.zoom + width / 2, y: (worldY - state.camera.y) * state.camera.zoom + height / 2 };
  };

  const worldPoint = (state, screenX, screenY) => {
    const { width, height } = view();
    return { x: (screenX - width / 2) / state.camera.zoom + state.camera.x, y: (screenY - height / 2) / state.camera.zoom + state.camera.y };
  };

  const visibleWorldBounds = (state, width, height, padding = 96) => {
    const halfWidth = width / (2 * state.camera.zoom) + padding;
    const halfHeight = height / (2 * state.camera.zoom) + padding;
    return {
      left: Math.max(0, state.camera.x - halfWidth),
      right: Math.min(WORLD.width, state.camera.x + halfWidth),
      top: Math.max(0, state.camera.y - halfHeight),
      bottom: Math.min(WORLD.height, state.camera.y + halfHeight)
    };
  };

  const buildingIsVisible = (building, bounds) => {
    const left = building.x * WORLD.cell;
    const top = building.y * WORLD.cell;
    const right = left + building.footprint.w * WORLD.cell;
    const bottom = top + building.footprint.h * WORLD.cell;
    return right >= bounds.left && left <= bounds.right && bottom >= bounds.top && top <= bounds.bottom;
  };

  const pointIsVisible = (point, bounds, padding = 72) => point.x >= bounds.left - padding && point.x <= bounds.right + padding && point.y >= bounds.top - padding && point.y <= bounds.bottom + padding;

  const paint = (state) => {
    clock += 0.016;
    const { width, height } = view();
    const lighting = lightingForState(state.timeOfDay);
    const weather = weatherVisual(state);
    const wind = 0.68 + weather.clouds * 0.24 + weather.rain * 0.62 + weather.storm * 0.72;
    activeSceneLighting = {
      ...lighting,
      shadowDirection: lighting.sunsetGlow > lighting.sunriseGlow ? 2.7 : 0.55
    };
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#dbe2c7";
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(state.camera.zoom, state.camera.zoom);
    ctx.translate(-state.camera.x, -state.camera.y);

    const bounds = visibleWorldBounds(state, width, height);

    ctx.fillStyle = "#a5bd7e";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    for (let y = 0; y < WORLD.rows; y += 1) {
      for (let x = 0; x < WORLD.cols; x += 1) {
        const cell = state.map.grid[y][x];
        const px = x * WORLD.cell;
        const py = y * WORLD.cell;
        if (cell.terrain === "water") {
          const waterGradient = ctx.createLinearGradient(px, py, px + WORLD.cell, py + WORLD.cell);
          waterGradient.addColorStop(0, "#6da6a0");
          waterGradient.addColorStop(0.52, cell.variation > 0.5 ? "#73aaa2" : "#679f9c");
          waterGradient.addColorStop(1, "#5e9595");
          ctx.fillStyle = waterGradient;
        } else {
          ctx.fillStyle = cell.terrain === "clearing"
            ? "#b6c98d"
            : "#a9c282";
        }
        ctx.fillRect(px, py, WORLD.cell + 1, WORLD.cell + 1);
        if (cell.terrain !== "water") {
          if (cell.terrain === "clearing") drawShoreEdge(ctx, px, py, WORLD.cell, state.map.grid, x, y);
          else drawShoreEdge(ctx, px, py, WORLD.cell, state.map.grid, x, y);
        }
        if (weather.rain > 0.08 && cell.terrain !== "water") {
          ctx.fillStyle = `rgba(62,98,104,${weather.rain * 0.045})`;
          ctx.fillRect(px, py, WORLD.cell + 1, WORLD.cell + 1);
          if ((x * 7 + y * 11) % 5 === 0) {
            ctx.strokeStyle = `rgba(205,230,221,${weather.rain * 0.12})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(px + 12, py + 17 + cell.variation * 18); ctx.lineTo(px + 37, py + 15 + cell.variation * 18); ctx.stroke();
          }
        }
        if (cell.trail > 0.22 && cell.terrain !== "water") {
          const trail = clamp(cell.trail, 0, 1);
          const trailPoint = worldCellCenter(x, y);
          const nearSettlement = state.buildings.some((building) => {
            const center = { x: (building.x + building.footprint.w / 2) * WORLD.cell, y: (building.y + building.footprint.h / 2) * WORLD.cell };
            return Math.hypot(center.x - trailPoint.x, center.y - trailPoint.y) < 145;
          });
          if (!nearSettlement || trail < 0.5) continue;
          const wear = clamp((trail - 0.22) / 0.78, 0, 1);
          const pathWidth = 3.5 + wear * 3.5;
          const trailAt = (dx, dy) => clamp(Number(state.map.grid[y + dy]?.[x + dx]?.trail) || 0, 0, 1) > 0.22;
          const horizontal = trailAt(-1, 0) || trailAt(1, 0);
          const vertical = trailAt(0, -1) || trailAt(0, 1);
          ctx.save();
          ctx.translate(px + WORLD.cell / 2, py + WORLD.cell / 2);
          ctx.fillStyle = `rgba(123,105,65,${0.014 + wear * 0.048})`;
          if (horizontal) {
            roundRect(ctx, -WORLD.cell * 0.52, -pathWidth / 2, WORLD.cell * 1.04, pathWidth, pathWidth / 2);
            ctx.fill();
          }
          if (vertical) {
            roundRect(ctx, -pathWidth / 2, -WORLD.cell * 0.52, pathWidth, WORLD.cell * 1.04, pathWidth / 2);
            ctx.fill();
          }
          if (!horizontal && !vertical) {
            ctx.rotate((cell.variation - 0.5) * 0.7);
            ctx.beginPath(); ctx.ellipse(0, 0, WORLD.cell * 0.28, pathWidth * 0.55, 0, 0, TAU); ctx.fill();
          }
          if (trail > 0.68) {
            ctx.fillStyle = `rgba(221,184,111,${0.035 + wear * 0.08})`;
            ctx.beginPath(); ctx.ellipse(-WORLD.cell * 0.18, -3, 3.5, 2, -0.28, 0, TAU); ctx.fill();
            ctx.beginPath(); ctx.ellipse(WORLD.cell * 0.18, 4, 3.5, 2, -0.28, 0, TAU); ctx.fill();
          }
          ctx.restore();
        }
        if (cell.terrain === "water") drawWater(ctx, px, py, cell.variation, clock, wind);
        else {
          if ((x + y) % 3 === 0) drawGrassDetails(ctx, px + 18 + cell.variation * 25, py + 36, cell.variation, clock, wind);
          const puddleSeed = Math.abs(Math.sin(x * 19.37 + y * 7.11 + cell.variation * 31.4));
          if (weather.rain > 0.08 && puddleSeed < weather.rain * 0.085) {
            drawPuddle(ctx, px + 18 + cell.variation * 24, py + 35, cell.variation, clock, weather.rain);
          }
        }
      }
    }
    drawClearingField(ctx);
    drawSunlightField(ctx, lighting, clock);
    drawSkyDetails(ctx, lighting, clock);
    drawCloudShadows(ctx, weather.clouds, clock);
    drawMistBands(ctx, lighting, weather, clock);
    drawAmbientLife(ctx, lighting, weather, clock);
    drawWildernessComposition(ctx, state, bounds, clock, wind);

    state.map.resources.filter((resource) => pointIsVisible({ x: (resource.x + 0.5) * WORLD.cell, y: (resource.y + 0.5) * WORLD.cell }, bounds)).forEach((resource) => {
      const point = { x: (resource.x + 0.5) * WORLD.cell, y: (resource.y + 0.5) * WORLD.cell };
      const amountRatio = resource.amount / resource.max;
      if (!drawGeneratedResource(ctx, resource, clock)) {
        if (resource.amount <= 0) drawDepletedResource(ctx, resource);
        else {
          if (resource.type === "wood") drawTree(ctx, point.x, point.y, 0.68 + amountRatio * 0.16, resource.phase, clock, wind);
          if (resource.type === "stone") drawRock(ctx, point.x, point.y, 0.75 + amountRatio * 0.12);
          if (resource.type === "food") drawBerry(ctx, point.x, point.y, 0.8 + amountRatio * 0.12, resource.phase, clock);
        }
      }
    });
    const visibleBuildings = state.buildings.filter((building) => buildingIsVisible(building, bounds)).sort((a, b) => a.y - b.y);
    const visibleAnimals = (state.animals || []).filter((animal) => pointIsVisible(animal, bounds)).sort((a, b) => a.y - b.y);
    const visibleVillagers = state.villagers.filter((villager) => pointIsVisible(villager, bounds)).sort((a, b) => a.y - b.y);
    const visiblePiles = state.groundPiles.filter((pile) => pointIsVisible(pile, bounds));
    const visibleEffects = state.effects.filter((effect) => pointIsVisible(effect, bounds));
    drawSettlementGroundDressing(ctx, state, visibleBuildings);
    visiblePiles.forEach((pile) => drawGroundPile(ctx, pile));

    const selected = state.selected;
    visibleBuildings.forEach((building) => drawBuilding(ctx, building, clock, selected?.type === "building" && selected.id === building.id));
    drawSettlementForeground(ctx, state, clock, lighting, visibleBuildings);
    visibleAnimals.forEach((animal) => drawAnimal(ctx, animal, clock, selected?.type === "animal" && selected.id === animal.id));
    visibleVillagers.forEach((villager) => drawVillager(ctx, villager, clock, selected?.type === "villager" && selected.id === villager.id));
    visibleEffects.forEach((effect) => {
      if (effect.type === "discovery") drawDiscoveryEffect(ctx, effect, clock);
      else if (effect.type === "completion") drawCompletionEffect(ctx, effect, clock);
      else drawMicroEffect(ctx, effect, clock);
    });

    if (state.buildMode) drawPlacementGhost(ctx, placement, clock);

    drawGlobalLighting(ctx, lighting);
    drawBuildingLights(ctx, state, clock, lighting.darkness);
    drawWeatherEffects(ctx, weather, clock, lighting, wind);
    ctx.restore();
    return { clock, screenPoint, worldPoint };
  };

  const setHover = (cell) => { hoverCell = cell; };
  const clearHover = () => { hoverCell = null; };
  const setPlacement = (nextPlacement) => { placement = nextPlacement; };
  resize();
  window.addEventListener("resize", resize);
  return { paint, resize, screenPoint, worldPoint, setHover, clearHover, setPlacement, get hoverCell() { return hoverCell; } };
};
