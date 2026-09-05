import { CONFIG } from './config.js?v=20260904-hearthkin3';
import { clamp01, landscapeHash, landscapeNoise, treeAppearance } from './landscape-layout.js?v=20260904-hearthkin3';

const MASK_WIDTH = 560;
const MASK_HEIGHT = 460;
// Source rectangles and root contacts are authored from the alpha bounds,
// rather than assuming the generated paintings fill equal-size cells.
export const TREE_SPRITES = [
  { sheet: 0, rect: [36, 43, 573, 539], root: [0.51, 0.995] },
  { sheet: 0, rect: [759, 18, 376, 591], root: [0.51, 0.995] },
  { sheet: 0, rect: [110, 666, 472, 545], root: [0.47, 0.995] },
  { sheet: 0, rect: [776, 651, 333, 584], root: [0.52, 0.995] },
  { sheet: 1, rect: [11, 9, 672, 627], root: [0.55, 0.995] },
  { sheet: 1, rect: [799, 145, 328, 486], root: [0.54, 0.995] },
  // These two source bounds overlap by eleven transparent pixels. The stepped
  // separator follows their empty gutter and excludes the neighboring crown.
  { sheet: 1, rect: [14, 665, 671, 596], root: [0.69, 0.995], clip: [[0, 0], [1, 0], [1, 0.646], [0.984, 0.646], [0.984, 1], [0, 1]] },
  { sheet: 1, rect: [674, 847, 538, 340], root: [0.60, 0.98], clip: [[0.023, 0], [1, 0], [1, 1], [0, 1], [0, 0.597], [0.023, 0.597]] },
];

function canvas(width, height) {
  const image = document.createElement('canvas');
  image.width = width; image.height = height;
  return image;
}
function alphaMask(values) {
  const result = canvas(MASK_WIDTH, MASK_HEIGHT);
  const ctx = result.getContext('2d');
  const pixels = ctx.createImageData(MASK_WIDTH, MASK_HEIGHT);
  for (let i = 0; i < values.length; i++) {
    pixels.data[i * 4] = pixels.data[i * 4 + 1] = pixels.data[i * 4 + 2] = 255;
    pixels.data[i * 4 + 3] = Math.round(clamp01(values[i]) * 255);
  }
  ctx.putImageData(pixels, 0, 0);
  return result;
}

export class CrownforgeLandscape {
  constructor(renderer) {
    this.renderer = renderer;
    this.revision = 0;
    this.images = {};
    this.tiles = [];
    this.berryRects = [[17, 19, 727, 474], [808, 36, 704, 471], [22, 528, 715, 479], [805, 550, 707, 461]];
    this.layer = canvas(1, 1);
    this.navVersion = null;
    this.nodes = null;
    this.woodCount = -1;
    for (const [key, filename] of Object.entries({
      treesA: 'trees-a', treesB: 'trees-b', berries: 'berries', ground: 'ground',
    })) {
      const image = this.images[key] = new Image();
      image.addEventListener('load', () => {
        if (key === 'ground') this.prepareMaterials();
        this.revision++;
        renderer.invalidateStaticLayer();
      });
      image.src = `./assets/crownforge-livingwood-${filename}-v1.png`;
    }
  }

  prepareMaterials() {
    const image = this.images.ground;
    const w = Math.floor(image.naturalWidth / 2), h = Math.floor(image.naturalHeight / 2);
    this.tiles = Array.from({ length: 4 }, (_, i) => {
      const tile = canvas(w - 4, h - 4);
      tile.getContext('2d').drawImage(image, i % 2 * w + 2, Math.floor(i / 2) * h + 2, w - 4, h - 4, 0, 0, w - 4, h - 4);
      tile.mips = [tile];
      let source = tile;
      while (source.width > 24) {
        const mip = canvas(Math.floor(source.width / 2), Math.floor(source.height / 2));
        const g = mip.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(source, 0, 0, mip.width, mip.height);
        tile.mips.push(mip); source = mip;
      }
      return tile;
    });
  }

  sync(simulation) {
    const worldChanged = this.nodes !== simulation.resourcesNodes || this.seed !== simulation.activeWorldSeed;
    if (!worldChanged && this.navVersion === simulation.navigationVersion) return;
    this.navVersion = simulation.navigationVersion;
    const trees = simulation.resourcesNodes.filter(node => node.resourceType === 'wood' && node.amount > 0);
    if (!worldChanged && this.woodCount === trees.length) return;
    this.nodes = simulation.resourcesNodes;
    this.seed = simulation.activeWorldSeed ?? simulation.worldSeed ?? 0;
    this.woodCount = trees.length;
    if (worldChanged) this.prepareRegions();
    this.prepareWoodland(trees);
    this.revision++;
    this.renderer.canvas.dataset.landscape = 'livingwood-1';
    this.renderer.canvas.dataset.woodlandTrees = String(trees.length);
  }

  prepareRegions() {
    const dry = new Float32Array(MASK_WIDTH * MASK_HEIGHT);
    const moss = new Float32Array(dry.length);
    const shade = new Float32Array(dry.length);
    this.regionColor = canvas(MASK_WIDTH, MASK_HEIGHT);
    const colors = this.regionColor.getContext('2d').createImageData(MASK_WIDTH, MASK_HEIGHT);
    for (let z = 0; z < MASK_HEIGHT; z++) {
      for (let x = 0; x < MASK_WIDTH; x++) {
        const i = z * MASK_WIDTH + x;
        const broad = landscapeNoise(x / 58, z / 58, this.seed + 311);
        const fine = landscapeNoise(x / 14, z / 14, this.seed + 219);
        const erosion = landscapeNoise(x / 4.7, z / 4.7, 818);
        const mixed = broad * 0.74 + fine * 0.26;
        dry[i] = clamp01((mixed - 0.44) * 2.5) * 0.81;
        moss[i] = clamp01((0.5 - mixed) * 2.1) * 0.68;
        shade[i] = (0.035 + broad * 0.085 + erosion * 0.035);
        const warmth = clamp01((mixed - 0.35) * 1.5);
        const light = landscapeNoise(x / 29 + 17, z / 29 + 11, this.seed + 63);
        colors.data[i * 4] = 61 + warmth * 69 + light * 12;
        colors.data[i * 4 + 1] = 96 + warmth * 47 + light * 13;
        colors.data[i * 4 + 2] = 61 + warmth * 15 + light * 8;
        colors.data[i * 4 + 3] = 255;
      }
    }
    this.dryMask = alphaMask(dry);
    this.mossMask = alphaMask(moss);
    this.shadeMask = alphaMask(shade);
    this.regionColor.getContext('2d').putImageData(colors, 0, 0);
  }

  prepareWoodland(trees) {
    // Overlapping soft root zones merge into a forest floor. Rebuilt only
    // when a tree disappears or a world loads, not during ordinary frames.
    const floor = new Float32Array(MASK_WIDTH * MASK_HEIGHT);
    for (const tree of trees) {
      const radius = tree.type === 'grove' ? 13 : 7.5;
      const cx = tree.x, cz = tree.z;
      for (let z = Math.max(0, Math.floor(cz - radius)); z < Math.min(MASK_HEIGHT, cz + radius); z++) {
        for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(MASK_WIDTH, cx + radius); x++) {
          const distance = Math.hypot(x - cx, z - cz) / radius;
          if (distance >= 1) continue;
          const weight = (1 - distance * distance) ** 2 * 0.38;
          floor[z * MASK_WIDTH + x] += weight;
        }
      }
    }
    for (let i = 0; i < floor.length; i++) floor[i] = Math.min(0.82, floor[i]);
    this.woodMask = alphaMask(floor);
    this.forestCoverage = floor;
  }

  worldTransform(ctx) {
    const r = this.renderer, origin = r.worldToScreen({ x: 0, z: 0 });
    const x = CONFIG.tileWidth / 2 * r.camera.zoom, y = CONFIG.tileHeight / 2 * r.camera.zoom;
    ctx.transform(x, y, -x, y, origin.x, origin.y);
  }

  fillMaterial(ctx, tile, alpha = 1) {
    if (!tile) return;
    ctx.save();
    this.worldTransform(ctx);
    const worldSize = 24;
    const desired = worldSize * CONFIG.tileWidth / 2 * this.renderer.camera.zoom;
    const sample = (tile.mips ?? [tile]).find(image => image.width <= desired * 1.3) ?? tile.mips?.at(-1) ?? tile;
    const pattern = ctx.createPattern(sample, 'repeat');
    // The detail has a fixed world size, so grass stays attached to the land
    // while panning and retains real fine structure at close camera zoom.
    pattern.setTransform(new DOMMatrix([worldSize / sample.width, 0, 0, worldSize / sample.height, 0, 0]));
    ctx.fillStyle = pattern;
    ctx.globalAlpha = alpha;
    ctx.fillRect(0, 0, CONFIG.mapWidth, CONFIG.mapHeight);
    ctx.restore();
  }

  maskedMaterial(ctx, mask, tile, color) {
    if (!mask) return;
    const r = this.renderer;
    const layer = this.layer;
    if (layer.width !== r.width || layer.height !== r.height) { layer.width = r.width; layer.height = r.height; }
    const g = layer.getContext('2d');
    g.clearRect(0, 0, layer.width, layer.height);
    g.save(); this.worldTransform(g);
    g.drawImage(mask, 0, 0, CONFIG.mapWidth, CONFIG.mapHeight);
    g.restore();
    g.globalCompositeOperation = 'source-in';
    if (tile) this.fillMaterial(g, tile);
    else { g.fillStyle = color; g.fillRect(0, 0, layer.width, layer.height); }
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(layer, 0, 0);
  }

  drawGround(ctx) {
    if (!this.tiles.length) return false;
    this.fillMaterial(ctx, this.tiles[0]);
    this.maskedMaterial(ctx, this.dryMask, this.tiles[1]);
    this.maskedMaterial(ctx, this.mossMask, this.tiles[3]);
    if (this.regionColor) {
      ctx.save(); this.worldTransform(ctx);
      ctx.globalAlpha = 0.37;
      ctx.drawImage(this.regionColor, 0, 0, CONFIG.mapWidth, CONFIG.mapHeight);
      ctx.restore();
    }
    this.maskedMaterial(ctx, this.woodMask, this.tiles[2]);
    this.maskedMaterial(ctx, this.shadeMask, null, '#253f32');
    // A light, restrained atmospheric veil keeps tiny terrain detail from
    // becoming visual noise at the strategic overview distance.
    ctx.save();
    this.worldTransform(ctx);
    ctx.fillStyle = `rgba(118,146,100,${this.renderer.camera.zoom < 0.12 ? 0.16 : 0.055})`;
    ctx.fillRect(0, 0, CONFIG.mapWidth, CONFIG.mapHeight);
    ctx.restore();
    this.drawGroundDetails(ctx);
    return true;
  }

  drawGroundDetails(ctx) {
    const r = this.renderer;
    if (r.camera.zoom < 0.14) return;
    const bounds = r.viewportWorldBounds(3);
    ctx.save();
    ctx.lineWidth = Math.max(0.55, r.camera.zoom * 1.1);
    ctx.lineCap = 'round';
    for (let i = 0; i < 8500; i++) {
      const x = landscapeHash(i, 607, this.seed) * CONFIG.mapWidth;
      const z = landscapeHash(i, 811, this.seed) * CONFIG.mapHeight;
      if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) continue;
      if ((this.forestCoverage?.[Math.floor(z) * MASK_WIDTH + Math.floor(x)] ?? 0) > 0.5) continue;
      const n = landscapeHash(i, 937, this.seed);
      if (landscapeNoise(x / 18, z / 18, this.seed + 403) < 0.43) continue;
      const point = r.worldToScreen({ x, z });
      const height = (7 + n * 12) * r.camera.zoom;
      ctx.strokeStyle = n > 0.82 ? 'rgba(194,183,117,0.43)' : n > 0.42 ? 'rgba(136,159,102,0.48)' : 'rgba(42,70,38,0.36)';
      ctx.beginPath();
      for (let blade = 0; blade < 4; blade++) {
        const dx = (blade - 1.5) * height * 0.25;
        ctx.moveTo(point.x + dx * 0.3, point.y);
        ctx.quadraticCurveTo(point.x + dx, point.y - height * 0.65, point.x + dx + height * 0.21, point.y - height * (0.65 + blade % 2 * 0.35));
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  resourceVisual(node) {
    if (node.type === 'tree') {
      const look = treeAppearance(node), sprite = TREE_SPRITES[look.species];
      return { ...look, sprite, height: look.width * sprite.rect[3] / sprite.rect[2], image: this.images[look.species < 4 ? 'treesA' : 'treesB'] };
    }
    const image = this.images.berries;
    const variant = (node.variant ?? 0) % 2;
    const row = node.amount <= 0 ? 1 : 0;
    const rect = this.berryRects?.[row * 2 + variant];
    if (!rect) return null;
    const width = 100 + landscapeHash(Math.round(node.x * 10), Math.round(node.z * 10), 38) * 19;
    return { width, height: width * rect[3] / rect[2], sprite: { rect, root: [0.5, 0.96] }, image };
  }

  drawResource(ctx, node, point, tierScale = 1) {
    const visual = this.resourceVisual(node);
    if (!visual || !visual.image?.complete || !visual.image.naturalWidth) return false;
    const zoom = this.renderer.camera.zoom;
    const width = visual.width * zoom * tierScale, height = visual.height * zoom * tierScale;
    const sprite = visual.sprite;
    ctx.save();
    ctx.fillStyle = 'rgba(16,32,22,0.23)';
    ctx.beginPath(); ctx.ellipse(point.x + width * 0.055, point.y + width * 0.012, width * 0.25, width * 0.065, -0.1, 0, Math.PI * 2); ctx.fill();
    ctx.translate(point.x, point.y);
    if (sprite.clip) {
      ctx.beginPath();
      sprite.clip.forEach(([x, y], i) => {
        const px = (x - sprite.root[0]) * width, py = (y - sprite.root[1]) * height;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      });
      ctx.closePath(); ctx.clip();
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(visual.image, ...sprite.rect, -width * sprite.root[0], -height * sprite.root[1], width, height);
    ctx.restore();
    return true;
  }
}
