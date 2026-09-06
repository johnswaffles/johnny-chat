import { CONFIG } from './config.js?v=20260906-wildwoodwatch2';

// Presentation only: every effect is derived from position and render time.
// Nothing consumes the simulation RNG or changes an entity's state.
const TAU = Math.PI * 2;
const noise = (x, z) => {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

function softSprite(rgb) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, `rgba(${rgb},1)`);
  gradient.addColorStop(0.4, `rgba(${rgb},.5)`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return canvas;
}

function shaftSprite() {
  const image=document.createElement('canvas');image.width=128;image.height=512;
  const g=image.getContext('2d'),across=g.createLinearGradient(0,0,128,0);
  across.addColorStop(0,'rgba(255,232,171,0)');across.addColorStop(.35,'rgba(255,232,171,.7)');
  across.addColorStop(.56,'rgba(255,242,195,1)');across.addColorStop(1,'rgba(255,232,171,0)');
  g.fillStyle=across;g.fillRect(0,0,128,512);
  const fade=g.createLinearGradient(0,0,0,512);
  fade.addColorStop(0,'rgba(0,0,0,0)');fade.addColorStop(.2,'rgba(0,0,0,.9)');
  fade.addColorStop(.7,'rgba(0,0,0,.55)');fade.addColorStop(1,'rgba(0,0,0,0)');
  g.globalCompositeOperation='destination-in';g.fillStyle=fade;g.fillRect(0,0,128,512);
  return image;
}

export class CrownforgeAtmosphere {
  constructor(renderer) {
    this.renderer = renderer;
    this.mode = 'dawn';
    this.reducedMotion = false;
    this.enabled = true;
    this.cloud = softSprite('19,43,39');
    this.mist = softSprite('235,225,198');
    this.ember = softSprite('255,177,64');
    this.sunPool = softSprite('240,226,158');
    this.woodlandMist = softSprite('153,185,172');
    this.shaft = shaftSprite();
    this.grade = document.createElement('canvas');
    this.gradeKey = '';
  }

  drawClouds(ctx, time) {
    if (!this.enabled) return;
    const r = this.renderer;
    const t = this.reducedMotion ? 0 : time * 0.001;
    const bounds = r.viewportWorldBounds(70);
    const step = 100;
    ctx.save();
    ctx.globalAlpha = this.mode === 'day' ? 0.12 : 0.2;
    // World anchors prevent clouds from sliding with the camera.
    for (let x = Math.floor(bounds.minX / step) * step; x <= bounds.maxX; x += step) {
      for (let z = Math.floor(bounds.minZ / step) * step; z <= bounds.maxZ; z += step) {
        const phase = noise(x, z) * TAU;
        const point = r.worldToScreen({ x: x + Math.sin(t * 0.022 + phase) * 24, z: z + Math.cos(t * 0.015 + phase) * 18 });
        const width = 1900 * r.camera.zoom;
        ctx.drawImage(this.cloud, point.x - width / 2, point.y - width * 0.16, width, width * 0.32);
      }
    }
    ctx.restore();
  }

  woodlandAnchors() {
    const r=this.renderer,coverage=r.landscape?.forestCoverage;
    if (!coverage || r.camera.zoom<.12) return [];
    const bounds=r.viewportWorldBounds(24),step=34;
    const x0=Math.max(0,Math.floor(bounds.minX/step)),z0=Math.max(0,Math.floor(bounds.minZ/step));
    const x1=Math.min(Math.ceil(CONFIG.mapWidth/step),Math.floor(bounds.maxX/step));
    const z1=Math.min(Math.ceil(CONFIG.mapHeight/step),Math.floor(bounds.maxZ/step));
    const key=`${x0}|${z0}|${x1}|${z1}|${r.landscape.seed}`;
    if (key===this.anchorKey && this.anchorCoverage===coverage) return this.anchors;
    const anchors=[];
    for (let iz=z0;iz<=z1;iz++) for (let ix=x0;ix<=x1;ix++) {
      const rank=noise(ix+19,iz+71);
      if (rank<.58) continue;
      const x=(ix+.2+noise(ix+5,iz)*.6)*step,z=(iz+.2+noise(ix,iz+8)*.6)*step;
      if (x>=CONFIG.mapWidth || z>=CONFIG.mapHeight) continue;
      const shade=coverage[Math.floor(z)*CONFIG.mapWidth+Math.floor(x)]??0;
      if (shade<.16) continue;
      anchors.push({x,z,rank,shade,phase:noise(ix+41,iz+9)*TAU});
    }
    anchors.sort((a,b)=>b.rank-a.rank);anchors.length=Math.min(12,anchors.length);
    this.anchorKey=key;this.anchorCoverage=coverage;this.anchors=anchors;
    return anchors;
  }

  drawWoodlandLight(ctx,time) {
    if (!this.enabled) return;
    const r=this.renderer,t=this.reducedMotion?0:time*.001;
    ctx.save();ctx.globalCompositeOperation='screen';
    for (const a of this.woodlandAnchors()) {
      const p=r.worldToScreen(a),w=(380+a.rank*220)*r.camera.zoom;
      ctx.globalAlpha=(this.mode==='day'?.10:.16)*(1+Math.sin(t*.17+a.phase)*.12);
      ctx.drawImage(this.sunPool,p.x-w*.5,p.y-w*.17,w,w*.34);
    }
    ctx.restore();
  }

  drawWoodlandAir(ctx,time) {
    if (!this.enabled) return;
    const r=this.renderer,t=this.reducedMotion?0:time*.001;
    const fade=Math.min(1,Math.max(0,(r.camera.zoom-.12)/.18));
    ctx.save();
    for (const a of this.woodlandAnchors()) {
      const drift=Math.sin(t*.10+a.phase)*1.8;
      const p=r.worldToScreen({x:a.x+drift,z:a.z+drift*.4});
      const width=(650+a.rank*230)*r.camera.zoom;
      ctx.globalAlpha=fade*(this.mode==='day'?.045:.095)*(a.shade*.5+.5);
      ctx.drawImage(this.woodlandMist,p.x-width*.5,p.y-width*.16,width,width*.23);
      if (a.rank>.83 && r.daylightEnabled) {
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-.44);
        ctx.globalCompositeOperation='screen';ctx.globalAlpha=fade*(this.mode==='day'?.075:.12);
        const h=(500+a.rank*200)*r.camera.zoom,w=h*.22;
        ctx.drawImage(this.shaft,-w*.5,-h,w,h);ctx.restore();
      }
    }
    ctx.restore();
  }

  drawHearth(ctx, building, point, width, height, time) {
    if (!this.enabled || building.destroyed || building.progress < 1 || width < 38) return;
    // Authored flame/chimney coordinates, relative to the grounded image.
    const hearths = {
      townCenter: { anchor: 0.9404, flames: [[0.416, 0.508], [0.505, 0.553]] },
      homestead: { anchor: 0.9609, smoke: [0.645, 0.094], flames: [[0.38, 0.596]] },
      ashenCamp: { anchor: 0.98, flames: [[0.51, 0.66]] },
    };
    const hearth = hearths[building.type];
    if (!hearth) return;
    const t = this.reducedMotion ? 1 : time * 0.001;
    const phase = Number(building.id) || 0;
    const top = point.y - height * hearth.anchor;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const [x, y] of hearth.flames ?? []) {
      const px = point.x + (x - 0.5) * width;
      const py = top + y * height;
      const size = width * 0.115;
      ctx.globalAlpha = (this.mode === 'dusk' ? 0.78 : 0.43) + Math.sin(t * 6 + phase) * 0.055;
      ctx.drawImage(this.ember, px - size / 2, py - size / 2, size, size);
      if (!this.reducedMotion) {
        for (let i = 0; i < 3; i++) {
          const life = (t * 0.34 + i / 3 + phase * 0.1) % 1;
          ctx.globalAlpha = (1 - life) * 0.55;
          const drift = Math.sin(life * 5 + i) * width * 0.009;
          ctx.drawImage(this.ember, px + drift, py - life * width * 0.045, 3, 3);
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    if (hearth.smoke && !this.reducedMotion) {
      const [x, y] = hearth.smoke;
      for (let i = 0; i < 7; i++) {
        const life = (t * 0.09 + i / 7 + phase * 0.17) % 1;
        const size = width * (0.025 + life * 0.075);
        ctx.globalAlpha = Math.sin(life * Math.PI) * 0.2;
        ctx.drawImage(this.mist, point.x + (x - 0.5) * width + life * width * 0.09 - size / 2,
          top + y * height - life * width * 0.19 - size / 2, size, size);
      }
    }
    ctx.restore();
  }

  drawAir(ctx, time) {
    if (!this.enabled) return;
    this.drawWoodlandAir(ctx,time);
    const r = this.renderer;
    const key = `${r.width}|${r.height}|${this.mode}`;
    if (this.gradeKey !== key) {
      this.grade.width = r.width;
      this.grade.height = r.height;
      const g = this.grade.getContext('2d');
      const warm = this.mode === 'dusk' ? '244,158,85' : '255,223,154';
      const light = g.createRadialGradient(0, 0, 0, 0, 0, r.width * 0.95);
      light.addColorStop(0, `rgba(${warm},${this.mode === 'day' ? 0.07 : 0.2})`);
      light.addColorStop(0.65, `rgba(${warm},.015)`);
      light.addColorStop(1, `rgba(${warm},0)`);
      g.fillStyle = light;
      g.fillRect(0, 0, r.width, r.height);
      const shade = g.createRadialGradient(r.width * 0.5, r.height * 0.48, r.height * 0.28, r.width * 0.5, r.height * 0.48, r.width * 0.75);
      shade.addColorStop(0, 'rgba(13,32,31,0)');
      shade.addColorStop(1, `rgba(13,32,31,${this.mode === 'dusk' ? 0.44 : 0.24})`);
      g.fillStyle = shade;
      g.fillRect(0, 0, r.width, r.height);
      this.gradeKey = key;
    }
    ctx.drawImage(this.grade, 0, 0);
    if (this.reducedMotion || r.camera.zoom < 0.12) return;
    const t = time * 0.001;
    ctx.save();
    // Sparse windborne seeds; capped independently of population/map size.
    for (let i = 0; i < 18; i++) {
      const x = ((noise(i, 17) * r.width + t * (3 + i % 3)) % (r.width + 40)) - 20;
      const y = noise(i, 36) * r.height + Math.sin(t * 0.3 + i) * 18;
      ctx.globalAlpha = 0.12 + Math.max(0, Math.sin(t * 0.7 + i)) * 0.2;
      ctx.fillStyle = '#ffedbe';
      ctx.beginPath(); ctx.ellipse(x, y, 1.4, 0.65, -0.6, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}
