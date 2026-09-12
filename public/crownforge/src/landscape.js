import { CONFIG } from './config.js?v=20260911-heart10';
import { clamp01, landscapeHash, landscapeNoise, treeAppearance, meadowHabitat } from './landscape-layout.js?v=20260909-cursedbears1';

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
  { sheet: 2, rect: [35, 13, 608, 599], root: [0.50, 0.99] },
  { sheet: 2, rect: [763, 12, 434, 622], root: [0.45, 0.99] },
  { sheet: 2, rect: [84, 628, 527, 632], root: [0.48, 0.99] },
  { sheet: 2, rect: [782, 657, 373, 603], root: [0.48, 0.99] },
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
    this.visualCache = new Map();
    this.treeMips = [];
    this.tiles = [];
    this.berryRects = [[17, 19, 727, 474], [808, 36, 704, 471], [22, 528, 715, 479], [805, 550, 707, 461]];
    this.layer = canvas(1, 1);
    this.navVersion = null;
    this.nodes = null;
    this.woodCount = -1;
    for (const [key, filename] of Object.entries({
      treesA: 'trees-a', treesB: 'trees-b', berries: 'berries', ground: 'ground', conifers: 'conifers',
    })) {
      const image = this.images[key] = new Image();
      image.addEventListener('load', () => {
        if (key === 'ground') this.prepareMaterials();
        else if (key !== 'berries') this.prepareTreeSprites();
        this.revision++;
        renderer.invalidateStaticLayer();
      });
      image.src = key === 'ground' ? './assets/crownforge-greatwood-materials-v1.png'
        : key === 'conifers' ? './assets/crownforge-greatwood-conifers-v1.png' : `./assets/crownforge-livingwood-${filename}-v1.png`;
    }
  }

  prepareTreeSprites() {
    this.treeMips = TREE_SPRITES.map(sprite => {
      const image = this.images[['treesA','treesB','conifers'][sprite.sheet]];
      if (!image?.naturalWidth) return null;
      const levels = [];
      for (let width = Math.min(512, sprite.rect[2]); width >= 24; width = Math.floor(width / 2)) {
        const tile = canvas(width, Math.round(width * sprite.rect[3] / sprite.rect[2]));
        const g = tile.getContext('2d');
        if (sprite.clip) {
          g.beginPath();
          sprite.clip.forEach(([x,y],i) => i ? g.lineTo(x*tile.width,y*tile.height) : g.moveTo(x*tile.width,y*tile.height));
          g.closePath(); g.clip();
        }
        g.imageSmoothingQuality = 'high';
        g.drawImage(image,...sprite.rect,0,0,tile.width,tile.height);
        // Keep the painted details, with warm upper foliage and cooler
        // recessed branches baked once into each detail level.
        g.globalCompositeOperation = 'source-atop';
        const light = g.createLinearGradient(0,0,tile.width,tile.height);
        light.addColorStop(0,'rgba(255,231,165,.11)');
        light.addColorStop(.45,'rgba(255,231,165,0)');
        light.addColorStop(1,'rgba(17,49,43,.16)');
        g.fillStyle=light; g.fillRect(0,0,tile.width,tile.height);
        levels.push(tile);
      }
      return levels;
    });
    this.treeShadows = this.treeMips.map(levels => {
      const source=levels?.find(tile=>tile.width<=128);
      if (!source) return null;
      const shadow=canvas(source.width,source.height),g=shadow.getContext('2d');
      g.drawImage(source,0,0); g.globalCompositeOperation='source-in';
      g.fillStyle='#102c29';g.fillRect(0,0,shadow.width,shadow.height);
      return shadow;
    });
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
    if (worldChanged) {
      this.visualCache.clear(); this.woodlandSources = new Map();
      this.woodlandFloor = new Float32Array(MASK_WIDTH * MASK_HEIGHT);
      this.coniferFloor = new Float32Array(MASK_WIDTH * MASK_HEIGHT);
      this.prepareRegions();
    }
    this.prepareWoodland(trees);
    this.revision++;
    this.renderer.canvas.dataset.landscape = 'greatwood-1';
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
        const meadow = meadowHabitat(x,z,this.seed);
        dry[i] = clamp01((.62 - meadow.moisture) * 1.5) * .46;
        moss[i] = meadow.lush * .19;
        shade[i] = (0.018 + broad * 0.035 + erosion * 0.015);
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
    // Keep unclamped contributions, so felling one tree updates only its
    // neighborhood instead of stamping the entire dense forest again.
    const floor = this.woodlandFloor ??= new Float32Array(MASK_WIDTH * MASK_HEIGHT);
    const pine = this.coniferFloor ??= new Float32Array(floor.length);
    const previous = this.woodlandSources ??= new Map(), next = new Map();
    const stamp = (source, sign) => {
      const {x:cx,z:cz,radius,conifer} = source;
      for (let z = Math.max(0, Math.floor(cz - radius)); z < Math.min(MASK_HEIGHT, cz + radius); z++) {
        for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(MASK_WIDTH, cx + radius); x++) {
          const squared = ((x-cx)**2+(z-cz)**2)/(radius*radius);
          if (squared >= 1) continue;
          const weight = (1-squared)**2 * .49 * sign, i=z*MASK_WIDTH+x;
          floor[i] += weight; if(conifer) pine[i] += weight;
        }
      }
    };
    for (const tree of trees) {
      let source=previous.get(tree.id);
      if (!source || source.x!==tree.x || source.z!==tree.z) {
        if(source) stamp(source,-1);
        source={x:tree.x,z:tree.z,radius:tree.type==='grove'?13:9.2,conifer:treeAppearance(tree).habitat<2};
        stamp(source,1);
      }
      next.set(tree.id,source);
    }
    for(const [id,source] of previous) if(!next.has(id)) stamp(source,-1);
    this.woodlandSources=next;
    this.forestCoverage=Float32Array.from(floor,n=>Math.max(0,Math.min(.96,n)));
    this.woodMask = alphaMask(this.forestCoverage);
    this.pineMask = alphaMask(pine);
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
    const worldSize = 21;
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
      ctx.globalAlpha = 0.12;
      ctx.drawImage(this.regionColor, 0, 0, CONFIG.mapWidth, CONFIG.mapHeight);
      ctx.restore();
    }
    this.maskedMaterial(ctx, this.woodMask, this.tiles[3]);
    this.maskedMaterial(ctx, this.pineMask, this.tiles[2]);
    this.maskedMaterial(ctx, this.shadeMask, null, '#253f32');
    // A light, restrained atmospheric veil keeps tiny terrain detail from
    // becoming visual noise at the strategic overview distance.
    ctx.save();
    this.worldTransform(ctx);
    ctx.fillStyle = `rgba(118,146,100,${this.renderer.camera.zoom < 0.12 ? 0.16 : 0.055})`;
    ctx.fillRect(0, 0, CONFIG.mapWidth, CONFIG.mapHeight);
    ctx.restore();
    return true;
  }

  resourceVisual(node) {
    if (node.type === 'tree') {
      const key = `${node.id}|${node.x}|${node.z}|${node.forestSeed??0}`;
      const cached=this.visualCache.get(key);
      if(cached) return cached;
      const look = treeAppearance(node), sprite = TREE_SPRITES[look.species];
      const visual={ ...look, sprite, height: look.width * sprite.rect[3] / sprite.rect[2], image: this.images[['treesA','treesB','conifers'][sprite.sheet]] };
      this.visualCache.set(key,visual);
      if(this.visualCache.size>10000)this.visualCache.delete(this.visualCache.keys().next().value);
      return visual;
    }
    const image = this.images.berries;
    const variant = (node.variant ?? 0) % 2;
    const row = node.amount <= 0 ? 1 : 0;
    const rect = this.berryRects?.[row * 2 + variant];
    if (!rect) return null;
    const width = 100 + landscapeHash(Math.round(node.x * 10), Math.round(node.z * 10), 38) * 19;
    return { width, height: width * rect[3] / rect[2], sprite: { rect, root: [0.5, 0.96] }, image };
  }

  drawTreeShadow(ctx,node,point,tierScale=1) {
    const r=this.renderer;
    if (node.type!=='tree'||r.camera.zoom<.085||!r.daylightEnabled) return;
    const visual=this.resourceVisual(node),shadow=this.treeShadows?.[visual.species];
    if (!shadow) return;
    const w=visual.width*r.camera.zoom*tierScale,h=visual.height*r.camera.zoom*tierScale;
    ctx.save();ctx.globalAlpha=(r.atmosphere.mode==='day'?.23:.18)*Math.min(1,Math.max(0,(r.camera.zoom-.145)/.1));
    ctx.translate(point.x,point.y);ctx.transform(.82,.12,-.56,-.22,0,0);
    ctx.drawImage(shadow,-w*visual.sprite.root[0],-h*visual.sprite.root[1],w,h);
    ctx.restore();
  }

  drawResource(ctx, node, point, tierScale = 1, time = 0) {
    const visual = this.resourceVisual(node);
    if (!visual || !visual.image?.complete || !visual.image.naturalWidth) return false;
    const zoom = this.renderer.camera.zoom;
    const width = visual.width * zoom * tierScale, height = visual.height * zoom * tierScale;
    const sprite = visual.sprite;
    const levels=node.type==='tree'?this.treeMips[visual.species]:null;
    const sample=levels?.find(tile=>tile.width<=width*(this.renderer.resolutionScale??1)*1.6)??levels?.at(-1);
    ctx.save();
    ctx.fillStyle = 'rgba(16,32,22,0.23)';
    ctx.beginPath(); ctx.ellipse(point.x + width * 0.055, point.y + width * 0.012, width * 0.25, width * 0.065, -0.1, 0, Math.PI * 2); ctx.fill();
    ctx.translate(point.x, point.y);
    if (node.type==='tree' && zoom>=.145 && this.renderer.atmosphere.enabled && !this.renderer.atmosphere.reducedMotion) {
      const t=time*.001;
      const bend=Math.sin(t*.68-node.x*.055-node.z*.034)*.0035+Math.sin(t*1.13+node.x*.17)*.001;
      ctx.transform(1,0,bend,1,0,0);
    }
    if (sprite.clip && !sample) {
      ctx.beginPath();
      sprite.clip.forEach(([x, y], i) => {
        const px = (x - sprite.root[0]) * width, py = (y - sprite.root[1]) * height;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      });
      ctx.closePath(); ctx.clip();
    }
    ctx.imageSmoothingEnabled = true;
    if(sample) ctx.drawImage(sample,-width*sprite.root[0],-height*sprite.root[1],width,height);
    else ctx.drawImage(visual.image, ...sprite.rect, -width * sprite.root[0], -height * sprite.root[1], width, height);
    ctx.restore();
    return true;
  }
}
