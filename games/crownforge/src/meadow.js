import { CONFIG } from './config.js?v=20260904-rosterkin1';
import { MeadowField } from './meadow-field.js?v=20260905-meadow1';

// Measured isolated alpha bounds, not nominal atlas cells: the seed heads in
// row two begin above the equal-cell boundary. Retain the source PNG intact.
export const MEADOW_SPRITES = [
  [14,64,337,226], [368,81,355,213], [732,55,356,245], [1097,87,335,199],
  [28,332,314,358], [401,340,303,349], [731,342,324,347], [1099,343,323,362],
  [16,752,337,258], [380,728,326,282], [737,778,330,234], [1094,749,341,268],
];

export class CrownforgeMeadow {
  constructor(renderer) {
    this.renderer = renderer;
    this.field = new MeadowField({ mapWidth: CONFIG.mapWidth, mapHeight: CONFIG.mapHeight, seed: 0 });
    this.sprites = [];
    this.tufts = [];
    this.windEnabled = true;
    this.image = new Image();
    this.image.addEventListener('load', () => this.prepareSprites());
    this.image.src = './assets/crownforge-meadow-grasses-v1.png';
  }

  prepareSprites() {
    this.sprites = MEADOW_SPRITES.map(([x,y,w,h]) => {
      // Bake a restrained cool glaze into the small sampling surfaces. This
      // unifies the authored bright tips with Crownforge's woodland palette.
      const levels = [];
      for (const width of [128,64,32,16]) {
        const tile = document.createElement('canvas');
        tile.width = width; tile.height = Math.round(width * h / w);
        const g = tile.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(this.image,x,y,w,h,0,0,tile.width,tile.height);
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = 'rgba(39,86,49,0.17)';
        g.fillRect(0,0,tile.width,tile.height);
        levels.push(tile);
      }
      return levels;
    });
  }

  prepare(simulation, seconds, delta) {
    const r = this.renderer;
    this.seconds = seconds;
    this.field.sync(simulation, r.landscape.forestCoverage);
    this.field.update(simulation.units, seconds, delta);
    this.tufts = this.sprites.length ? this.field.visible(r.viewportBounds, r.camera.zoom) : [];
    this.moving = this.windEnabled && r.atmosphere.enabled && !r.atmosphere.reducedMotion;
    Object.assign(r.canvas.dataset, {
      meadow: 'living-meadow-1', meadowReady: String(this.sprites.length === 12),
      meadowTufts: String(this.tufts.length), meadowWind: String(this.moving),
    });
  }

  draw(ctx, tuft) {
    const r = this.renderer, zoom = r.camera.zoom;
    const p = r.worldToScreen(tuft);
    const width = tuft.width * zoom, height = tuft.height * zoom;
    if (p.x + width < 0 || p.x - width > r.width || p.y < 0 || p.y - height > r.height) return;
    const levels = this.sprites[tuft.variant];
    const sample = levels.find(s => s.width <= width * 1.5) ?? levels.at(-1);
    const interaction = this.field.displacement(tuft, this.seconds);
    const phase = tuft.phase ?? 0;
    // Wind travels through the landscape in large waves, with a smaller
    // second frequency keeping neighboring plants from moving in lockstep.
    const wind = this.moving ?
      Math.sin(this.seconds * 1.28 - tuft.x * .13 - tuft.z * .09) * .115
      + Math.sin(this.seconds * 2.1 + phase) * .034 : 0;
    const bend = wind + interaction.bend * .84;
    const press = interaction.press;
    const compression = 1 - press * .53;
    ctx.save();
    ctx.globalAlpha = (tuft.opacity ?? 1) * .96;
    ctx.translate(p.x,p.y);
    if (press > .04) {
      // Three joined sections curve the upper blades away from the feet;
      // the root remains fixed. Only nearby disturbed plants pay this cost.
      const bands = 3;
      for (let i=0;i<bands;i++) {
        const a=i/bands,b=(i+1)/bands;
        const ya=-height*(1-a),yb=-height*(1-b);
        const xa=bend*height*(1-a)**1.7,xb=bend*height*(1-b)**1.7;
        const shear=(xb-xa)/(yb-ya);
        ctx.save();
        ctx.transform(1,0,shear,compression,xa-shear*ya,0);
        const sy=a*sample.height,sh=Math.min(sample.height-sy,sample.height/bands+.5);
        ctx.drawImage(sample,0,sy,sample.width,sh,-width/2,ya,width,height*sh/sample.height);
        ctx.restore();
      }
    } else {
      ctx.transform(1,0,-bend,compression,0,0);
      ctx.drawImage(sample,-width/2,-height,width,height);
    }
    ctx.restore();
  }
}
