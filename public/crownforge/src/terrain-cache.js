import { CONFIG } from './config.js?v=20260905-smooth1';

// World-anchored terrain tiles survive camera movement. Only new tiles are
// baked, with a small per-frame budget; an always-available overview fills
// every missing tile while detail arrives. Gameplay coordinates never change.
export const TERRAIN_CACHE_LIMITS = Object.freeze({ tileSize: 256, maxBytes: 64 * 1024 * 1024, maxTiles: 192, bakeBudgetMs: 3, maxBakesPerFrame: 2 });

export function terrainZoomLevel(zoom) {
  return Math.ceil(Math.log2(Math.max(.02, zoom)) * 2) / 2;
}

export function terrainTileRange(renderer, zoom, padding = 0) {
  const size = TERRAIN_CACHE_LIMITS.tileSize;
  const scale = renderer.camera.zoom / zoom;
  const originX = renderer.width / 2 + renderer.camera.x;
  const originY = renderer.height / 2 + renderer.camera.y;
  return {
    minX: Math.floor((-originX / scale - padding) / size),
    maxX: Math.floor(((renderer.width - originX) / scale + padding) / size),
    minY: Math.floor((-originY / scale - padding) / size),
    maxY: Math.floor(((renderer.height - originY) / scale + padding) / size),
    scale, originX, originY,
  };
}

export class TerrainCache {
  constructor(renderer) {
    this.renderer = renderer;
    this.tiles = new Map();
    this.bytes = 0;
    this.bakes = 0;
    this.hits = 0;
  }

  view(width, height, zoom, x = 0, y = 0) {
    const view = Object.create(this.renderer);
    Object.assign(view, { width, height, camera: { zoom, x, y } });
    return view;
  }

  prepare() {
    const r = this.renderer;
    const version = [r.landscape.revision, r.roadReady, r.daylightEnabled, r.resolutionScale].join('|');
    if (version !== this.version) {
      this.tiles.clear(); this.bytes = 0; this.version = version;
    }
    // The overview excludes canopy masks: its base meadow remains valid when
    // a tree is felled, while the affected detailed terrain refreshes below.
    const overviewKey = [r.landscape.seed, r.landscape.materialRevision, r.roadReady, r.daylightEnabled].join('|');
    if (this.overviewKey !== overviewKey) {
      this.overview = document.createElement('canvas');
      this.overview.width = 1536; this.overview.height = 768;
      this.overviewZoom = Math.min(1536/((CONFIG.mapWidth+CONFIG.mapHeight)*CONFIG.tileWidth/2),768/((CONFIG.mapWidth+CONFIG.mapHeight)*CONFIG.tileHeight/2));
      const view = this.view(1536, 768, this.overviewZoom);
      view.baseTerrain = true;
      view.resolutionScale = 1;
      view.drawMap(this.overview.getContext('2d'), 0);
      this.overviewKey = overviewKey;
    }
    this.level = terrainZoomLevel(r.camera.zoom);
    this.zoom = 2 ** this.level;
    this.range = terrainTileRange(r, this.zoom);
    const size = TERRAIN_CACHE_LIMITS.tileSize;
    const zooming=this.previousZoom!==undefined&&Math.abs(this.previousZoom-r.camera.zoom)>.00001;
    this.previousZoom=r.camera.zoom;
    const range = terrainTileRange(r, this.zoom, zooming?0:size);
    const centerX = (this.range.minX + this.range.maxX) / 2;
    const centerY = (this.range.minY + this.range.maxY) / 2;
    const pending = [];
    for (let y = range.minY; y <= range.maxY; y++) for (let x = range.minX; x <= range.maxX; x++) {
      const key = `${this.level}|${x}|${y}`;
      if (this.tiles.has(key)) continue;
      const visible = x >= this.range.minX && x <= this.range.maxX && y >= this.range.minY && y <= this.range.maxY;
      pending.push({ key, x, y, priority: (visible ? 0 : 10000) + (x-centerX)**2 + (y-centerY)**2 });
    }
    pending.sort((a,b) => a.priority-b.priority);
    const start = performance.now();
    let baked = 0;
    for (const tile of pending) {
      if (baked && (baked >= TERRAIN_CACHE_LIMITS.maxBakesPerFrame || performance.now()-start >= TERRAIN_CACHE_LIMITS.bakeBudgetMs)) break;
      this.bake(tile); baked++;
    }
    this.pending = pending.length-baked;
  }

  bake({key,x,y}) {
    const r = this.renderer, size = TERRAIN_CACHE_LIMITS.tileSize;
    const ratio = r.resolutionScale;
    const image = document.createElement('canvas');
    // A one-pixel gutter gives bilinear sampling real neighboring texels.
    image.width = image.height = Math.ceil((size+2)*ratio);
    const g = image.getContext('2d');
    g.setTransform(ratio,0,0,ratio,0,0);
    const view = this.view(size+2,size+2,this.zoom,-x*size-size/2,-y*size-size/2);
    view.drawMap(g,0);
    const bytes = image.width*image.height*4;
    this.tiles.set(key,{image,bytes,x,y,level:this.level}); this.bytes += bytes; this.bakes++;
    while (this.bytes > TERRAIN_CACHE_LIMITS.maxBytes || this.tiles.size > TERRAIN_CACHE_LIMITS.maxTiles) {
      const first = this.tiles.keys().next().value;
      this.bytes -= this.tiles.get(first).bytes; this.tiles.delete(first);
    }
  }

  draw(ctx) {
    const r = this.renderer, size = TERRAIN_CACHE_LIMITS.tileSize;
    const originX = r.width/2+r.camera.x, originY = r.height/2+r.camera.y;
    const scale = r.camera.zoom/this.overviewZoom;
    ctx.drawImage(this.overview,originX-this.overview.width*scale/2,originY-this.overview.height*scale/2,this.overview.width*scale,this.overview.height*scale);
    // Reuse a nearby cached level beneath the requested detail. Fast zooms
    // therefore retain already-painted terrain rather than flashing gaps.
    for (const level of [this.level-1, this.level+1, this.level]) {
      const zoom=2**level, range=terrainTileRange(r,zoom);
      for (let y=range.minY; y<=range.maxY; y++) for (let x=range.minX; x<=range.maxX; x++) {
        const key=`${level}|${x}|${y}`,tile=this.tiles.get(key);
        if (!tile) continue;
        this.tiles.delete(key); this.tiles.set(key,tile); this.hits++;
        const ratio=r.resolutionScale;
        ctx.drawImage(tile.image,ratio,ratio,size*ratio,size*ratio,
          originX+x*size*range.scale,originY+y*size*range.scale,size*range.scale,size*range.scale);
      }
    }
  }

  stats() { return {tiles:this.tiles.size,bytes:this.bytes,bakes:this.bakes,hits:this.hits,pending:this.pending??0}; }
}
