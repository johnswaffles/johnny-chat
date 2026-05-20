(() => {
  "use strict";

  const canvas = document.getElementById("worldCanvas");
  const ctx = canvas.getContext("2d");
  const graph = document.getElementById("graphCanvas");
  const gctx = graph.getContext("2d");

  const W = 96;
  const H = 62;
  const CELL = 10;
  const WORLD_W = W * CELL;
  const WORLD_H = H * CELL;
  const FIXED_DT = 1 / 30;
  const HISTORY_MAX = 300;
  const RATES = [0, 0.25, 0.5, 1, 2, 5, 10, 25, 50];
  const SEASONS = ["Spring", "Summer", "Autumn", "Winter"];
  const WEATHER = ["sunny", "rain", "cloudy", "drought", "storm"];

  const terrainColors = {
    grass: "#254d32",
    dirt: "#6b5138",
    water: "#1f6d85",
    rock: "#4b5563",
    fertile: "#356b3c",
    dry: "#8a6b3c",
  };

  const tools = [
    ["sunmoss", "Add Sunmoss", "Paints glowing plant clusters that feed Glowmites."],
    ["glowmite", "Add Glowmites", "Seeds small herbivores with inheritable traits."],
    ["thornback", "Add Thornbacks", "Adds predators that hunt Glowmites."],
    ["water", "Add Water", "Creates water cells that help moss and thirst."],
    ["fertile", "Fertile Soil", "Boosts nutrients and Sunmoss growth."],
    ["rock", "Rock Barrier", "Blocks movement and spreading."],
    ["erase", "Eraser", "Clears terrain additions and nearby organisms."],
  ];

  const storage = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem(`little-world:${key}`)) ?? fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(`little-world:${key}`, JSON.stringify(value)); } catch {}
    },
  };

  class RNG {
    constructor(seed) {
      this.seedText = seed || `${Date.now()}`;
      let h = 2166136261;
      for (let i = 0; i < this.seedText.length; i++) {
        h ^= this.seedText.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      this.state = h >>> 0;
    }
    next() {
      this.state = Math.imul(1664525, this.state) + 1013904223 >>> 0;
      return this.state / 4294967296;
    }
    range(min, max) { return min + (max - min) * this.next(); }
    int(min, max) { return Math.floor(this.range(min, max + 1)); }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    chance(p) { return this.next() < p; }
  }

  class Cell {
    constructor(type = "grass") {
      this.type = type;
      this.nutrients = type === "fertile" ? 0.9 : type === "dry" ? 0.18 : 0.48;
      this.water = type === "water" ? 1 : type === "dry" ? 0.08 : 0.38;
      this.moss = 0;
      this.biomass = 0;
      this.rot = 0;
    }
  }

  class Creature {
    constructor(kind, x, y, traits, rng) {
      this.kind = kind;
      this.x = x;
      this.y = y;
      this.vx = rng.range(-1, 1);
      this.vy = rng.range(-1, 1);
      this.energy = kind === "glowmite" ? 92 : 82;
      this.thirst = 0;
      this.age = 0;
      this.cooldown = rng.range(1, 8);
      this.traits = traits;
      this.dead = false;
      this.flash = 0;
      this.trail = [];
      this.color = kind === "glowmite"
        ? `hsl(${178 + traits.tint * 50}, 92%, 62%)`
        : `hsl(${18 + traits.aggression * 18}, 92%, 58%)`;
    }
    mutate(rng, base) {
      const out = { ...base };
      for (const key of Object.keys(out)) {
        out[key] = clamp(out[key] + rng.range(-0.08, 0.08), 0.15, 2.2);
      }
      return out;
    }
  }

  class Engine {
    constructor() {
      this.seed = storage.get("seed", niceSeed());
      this.rng = new RNG(this.seed);
      this.cells = [];
      this.creatures = [];
      this.tick = 0;
      this.day = 1;
      this.year = 1;
      this.seasonIndex = 0;
      this.weather = "sunny";
      this.weatherTimer = 0;
      this.drought = 0;
      this.events = [];
      this.history = [];
      this.spatial = new Map();
      this.paused = false;
      this.rateIndex = storage.get("rateIndex", 3);
      this.tool = "sunmoss";
      this.accumulator = 0;
      this.camera = { x: 0, y: 0, zoom: 1 };
      this.dragging = false;
      this.lastPointer = null;
      this.newWorld(this.seed);
    }

    newWorld(seed = niceSeed()) {
      this.seed = seed;
      storage.set("seed", seed);
      this.rng = new RNG(seed);
      this.cells = Array.from({ length: W * H }, () => new Cell("grass"));
      this.creatures = [];
      this.tick = 0;
      this.day = 1;
      this.year = 1;
      this.seasonIndex = 0;
      this.weather = "sunny";
      this.weatherTimer = 12;
      this.drought = 0;
      this.events = [];
      this.history = [];
      this.makeTerrain();
      this.seedLife();
      updateSeedInput(seed);
    }

    makeTerrain() {
      const centerX = this.rng.range(18, 78);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const n = valueNoise(this.rng.seedText, x * 0.09, y * 0.09);
          const ridge = Math.abs(x - centerX - Math.sin(y * 0.18) * 10);
          let type = n > 0.78 ? "rock" : n < 0.18 ? "dry" : "grass";
          if (ridge < 3 || (n < 0.28 && y > 8 && y < H - 7)) type = "water";
          if (n > 0.5 && n < 0.7 && type === "grass") type = "fertile";
          const c = this.cell(x, y);
          c.type = type;
          c.water = type === "water" ? 1 : type === "dry" ? 0.08 : this.rng.range(0.25, 0.7);
          c.nutrients = type === "fertile" ? this.rng.range(0.65, 1) : type === "dry" ? 0.14 : this.rng.range(0.35, 0.75);
          c.moss = type === "fertile" && this.rng.chance(0.26) ? this.rng.range(0.2, 0.7) : 0;
        }
      }
    }

    seedLife() {
      for (let i = 0; i < 330; i++) this.paintPatch(this.rng.int(4, W - 5), this.rng.int(4, H - 5), "sunmoss", 3);
      for (let i = 0; i < 58; i++) this.addCreature("glowmite", this.rng.range(70, WORLD_W - 70), this.rng.range(70, WORLD_H - 70));
      for (let i = 0; i < 5; i++) this.addCreature("thornback", this.rng.range(70, WORLD_W - 70), this.rng.range(70, WORLD_H - 70));
    }

    cell(x, y) { return this.cells[clampInt(y, 0, H - 1) * W + clampInt(x, 0, W - 1)]; }
    cellAt(px, py) { return this.cell(Math.floor(px / CELL), Math.floor(py / CELL)); }

    addCreature(kind, x, y, traits) {
      const c = this.cellAt(x, y);
      if (c.type === "water" || c.type === "rock") return null;
      const base = kind === "glowmite"
        ? { speed: 0.86, vision: 1.12, fertility: 1.18, hunger: 0.78, tint: this.rng.range(-0.8, 0.8) }
        : { speed: 0.66, stamina: 1, aggression: 0.76, sight: 0.86, metabolism: 1.16 };
      const creature = new Creature(kind, x, y, traits || jitterTraits(base, this.rng), this.rng);
      this.creatures.push(creature);
      return creature;
    }

    step(dt) {
      this.tick++;
      this.day = Math.floor(this.tick / 180) + 1;
      this.year = Math.floor((this.day - 1) / 48) + 1;
      this.seasonIndex = Math.floor(((this.day - 1) % 48) / 12);
      if (--this.weatherTimer <= 0) this.rollWeather();
      this.updateCells(dt);
      this.rebuildSpatial();
      for (const creature of this.creatures) {
        if (creature.kind === "glowmite") this.updateGlowmite(creature, dt);
        else this.updateThornback(creature, dt);
      }
      this.creatures = this.creatures.filter((creature) => {
        if (!creature.dead) return true;
        const c = this.cellAt(creature.x, creature.y);
        c.biomass = clamp(c.biomass + (creature.kind === "glowmite" ? 0.35 : 0.9), 0, 3);
        return false;
      });
      if (this.tick % 30 === 0) this.sampleHistory();
    }

    rollWeather() {
      const seasonal = this.seasonIndex === 1 ? ["sunny", "sunny", "drought", "cloudy", "rain"]
        : this.seasonIndex === 3 ? ["cloudy", "cloudy", "sunny", "storm"]
          : WEATHER;
      this.weather = this.rng.pick(seasonal);
      this.weatherTimer = this.rng.int(180, 520);
      if (this.weather === "drought") this.drought = clamp(this.drought + 0.18, 0, 0.72);
      if (this.weather === "rain" || this.weather === "storm") this.drought = clamp(this.drought - 0.32, 0, 1);
    }

    updateCells(dt) {
      const seasonGrowth = [1.32, 0.82, 1.08, 0.32][this.seasonIndex];
      const light = (Math.sin(this.tick * 0.006) + 1) * 0.5;
      const rain = this.weather === "rain" ? 0.014 : this.weather === "storm" ? 0.021 : -0.0011 - this.drought * 0.0032;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const c = this.cell(x, y);
          if (c.type === "water") {
            c.water = 1;
            c.nutrients = clamp(c.nutrients + c.biomass * 0.002, 0, 1);
            continue;
          }
          if (c.type !== "rock") c.water = clamp(c.water + rain + (c.type === "dry" ? -0.003 : 0), 0, 1);
          if (c.biomass > 0) {
            c.rot = clamp(c.rot + c.biomass * 0.01, 0, 1);
            c.nutrients = clamp(c.nutrients + c.biomass * 0.006, 0, 1.2);
            c.biomass = Math.max(0, c.biomass - 0.003);
          } else {
            c.rot = Math.max(0, c.rot - 0.001);
          }
          if (c.moss > 0) {
            const growth = (light * 0.7 + c.water * 0.82 + c.nutrients * 0.48 - this.drought * 0.44) * 0.0034 * seasonGrowth;
            c.moss = clamp(c.moss + growth - (c.water < 0.055 ? 0.004 : 0), 0, 1);
            c.nutrients = clamp(c.nutrients - c.moss * 0.00055, 0, 1.2);
            if (c.moss > 0.42 && this.rng.chance(0.02 * seasonGrowth)) {
              const nx = x + this.rng.int(-1, 1);
              const ny = y + this.rng.int(-1, 1);
              const n = this.cell(nx, ny);
              if (n.type !== "water" && n.type !== "rock" && n.water > 0.16 && n.nutrients > 0.12) {
                n.moss = clamp(n.moss + 0.075, 0, 1);
              }
            }
          } else if (c.type !== "rock" && c.type !== "water" && c.water > 0.24 && c.nutrients > 0.38 && this.rng.chance(0.0022 * seasonGrowth)) {
            c.moss = 0.06;
          }
        }
      }
    }

    updateGlowmite(g, dt) {
      g.age += dt;
      g.cooldown -= dt;
      g.thirst += dt * 0.012;
      g.energy -= dt * (0.48 * g.traits.hunger + 0.12 * g.traits.speed);
      const predator = this.findNearest(g, "thornback", 110 * g.traits.vision);
      let tx = g.x + g.vx * 20;
      let ty = g.y + g.vy * 20;
      if (predator) {
        tx = g.x - (predator.x - g.x) * 1.8;
        ty = g.y - (predator.y - g.y) * 1.8;
      } else {
        const moss = this.findBestMoss(g, 92 * g.traits.vision);
        if (moss) {
          tx = moss.x;
          ty = moss.y;
        }
      }
      this.moveCreature(g, tx, ty, 46 * g.traits.speed, dt);
      const cell = this.cellAt(g.x, g.y);
      if (cell.moss > 0.03) {
        const bite = Math.min(cell.moss, 0.018);
        cell.moss -= bite;
        g.energy = clamp(g.energy + bite * 220, 0, 145);
      }
      if (cell.water > 0.28 || cell.type === "water") g.thirst = Math.max(0, g.thirst - dt * 0.28);
      if (g.energy > 102 && g.cooldown <= 0 && this.localCount(g.x, g.y, "glowmite", 58) < 6) {
        const childTraits = g.mutate(this.rng, g.traits);
        const child = this.addCreature("glowmite", g.x + this.rng.range(-18, 18), g.y + this.rng.range(-18, 18), childTraits);
        if (child) {
          child.energy = 58;
          g.energy -= 38;
          g.cooldown = 8.5 / g.traits.fertility;
        }
      }
      if (g.energy <= 0 || g.thirst > 2.25 || g.age > 240 + this.rng.range(0, 100)) g.dead = true;
    }

    updateThornback(t, dt) {
      t.age += dt;
      t.cooldown -= dt;
      t.thirst += dt * 0.014;
      t.energy -= dt * (1.18 * t.traits.metabolism + 0.24 * t.traits.speed);
      const prey = this.findNearest(t, "glowmite", 108 * t.traits.sight);
      const tx = prey ? prey.x : t.x + t.vx * 50;
      const ty = prey ? prey.y : t.y + t.vy * 50;
      this.moveCreature(t, tx, ty, 50 * t.traits.speed, dt);
      if (prey && dist2(t, prey) < 13 * 13) {
        prey.dead = true;
        prey.flash = 0.2;
        t.energy = clamp(t.energy + 44, 0, 145);
        t.flash = 0.18;
      }
      const cell = this.cellAt(t.x, t.y);
      if (cell.water > 0.28 || cell.type === "water") t.thirst = Math.max(0, t.thirst - dt * 0.2);
      if (t.energy > 130 && t.cooldown <= 0 && this.localCount(t.x, t.y, "thornback", 78) < 3) {
        const childTraits = t.mutate(this.rng, t.traits);
        const child = this.addCreature("thornback", t.x + this.rng.range(-22, 22), t.y + this.rng.range(-22, 22), childTraits);
        if (child) {
          child.energy = 62;
          t.energy -= 66;
          t.cooldown = 18;
        }
      }
      if (t.energy <= 0 || t.thirst > 2.15 || t.age > 220 + this.rng.range(0, 90)) t.dead = true;
    }

    moveCreature(c, tx, ty, speed, dt) {
      const dx = tx - c.x;
      const dy = ty - c.y;
      const len = Math.hypot(dx, dy) || 1;
      c.vx = lerp(c.vx, dx / len, 0.06);
      c.vy = lerp(c.vy, dy / len, 0.06);
      const nx = c.x + c.vx * speed * dt;
      const ny = c.y + c.vy * speed * dt;
      const cell = this.cellAt(nx, ny);
      if (cell.type === "rock" || cell.type === "water") {
        c.vx *= -0.8;
        c.vy *= -0.8;
      } else {
        c.x = clamp(nx, 4, WORLD_W - 4);
        c.y = clamp(ny, 4, WORLD_H - 4);
      }
      if (this.tick % 5 === 0) {
        c.trail.push([c.x, c.y]);
        if (c.trail.length > 8) c.trail.shift();
      }
      c.flash = Math.max(0, c.flash - dt);
    }

    rebuildSpatial() {
      this.spatial.clear();
      for (const c of this.creatures) {
        const key = `${Math.floor(c.x / 48)},${Math.floor(c.y / 48)}`;
        if (!this.spatial.has(key)) this.spatial.set(key, []);
        this.spatial.get(key).push(c);
      }
    }

    nearby(x, y, radius) {
      const out = [];
      const gx = Math.floor(x / 48);
      const gy = Math.floor(y / 48);
      const r = Math.ceil(radius / 48);
      for (let yy = gy - r; yy <= gy + r; yy++) {
        for (let xx = gx - r; xx <= gx + r; xx++) {
          const group = this.spatial.get(`${xx},${yy}`);
          if (group) out.push(...group);
        }
      }
      return out;
    }

    findNearest(c, kind, radius) {
      let best = null;
      let bestD = radius * radius;
      for (const other of this.nearby(c.x, c.y, radius)) {
        if (other.kind !== kind || other.dead) continue;
        const d = dist2(c, other);
        if (d < bestD) {
          best = other;
          bestD = d;
        }
      }
      return best;
    }

    findBestMoss(c, radius) {
      let best = null;
      let bestScore = 0;
      const cx = Math.floor(c.x / CELL);
      const cy = Math.floor(c.y / CELL);
      const cr = Math.ceil(radius / CELL);
      for (let y = cy - cr; y <= cy + cr; y++) {
        for (let x = cx - cr; x <= cx + cr; x++) {
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const cell = this.cell(x, y);
          if (cell.moss < 0.08) continue;
          const px = x * CELL + 5;
          const py = y * CELL + 5;
          const d = Math.hypot(px - c.x, py - c.y);
          const score = cell.moss * 2 - d / radius;
          if (score > bestScore) {
            bestScore = score;
            best = { x: px, y: py };
          }
        }
      }
      return best;
    }

    localCount(x, y, kind, radius) {
      const rr = radius * radius;
      return this.nearby(x, y, radius).filter((c) => c.kind === kind && !c.dead && (c.x - x) ** 2 + (c.y - y) ** 2 < rr).length;
    }

    sampleHistory() {
      const s = this.stats();
      this.history.push({ tick: this.tick, moss: s.mossCells, glow: s.glowmites, thorn: s.thornbacks, rot: s.rotCells });
      if (this.history.length > HISTORY_MAX) this.history.shift();
      if ((s.glowmites === 0 || s.thornbacks === 0) && this.tick > 1000 && this.rng.chance(0.08)) {
        this.events.push({ tick: this.tick, type: "crash" });
      }
      this.events = this.events.filter((e) => this.tick - e.tick < HISTORY_MAX * 30);
    }

    stats() {
      let mossCells = 0, rotCells = 0, fertility = 0, water = 0;
      for (const c of this.cells) {
        if (c.moss > 0.05) mossCells++;
        if (c.rot > 0.06) rotCells++;
        fertility += c.nutrients;
        water += c.water;
      }
      const glow = this.creatures.filter((c) => c.kind === "glowmite");
      const thorn = this.creatures.filter((c) => c.kind === "thornback");
      const avg = (arr, key) => arr.length ? arr.reduce((sum, c) => sum + c.traits[key], 0) / arr.length : 0;
      const stability = clamp(100 - Math.abs(130 - glow.length) * 0.28 - Math.abs(7 - thorn.length) * 2.2 + mossCells * 0.045 - Math.max(0, glow.length - mossCells * 0.16) * 0.18 - this.drought * 12, 0, 100);
      return {
        mossCells, rotCells,
        glowmites: glow.length,
        thornbacks: thorn.length,
        glowSpeed: avg(glow, "speed"),
        glowVision: avg(glow, "vision"),
        glowFertility: avg(glow, "fertility"),
        thornSpeed: avg(thorn, "speed"),
        thornAggression: avg(thorn, "aggression"),
        thornMetabolism: avg(thorn, "metabolism"),
        fertility: fertility / this.cells.length,
        water: water / this.cells.length,
        stability,
      };
    }

    paintPatch(cx, cy, tool, radius = 2) {
      for (let y = cy - radius; y <= cy + radius; y++) {
        for (let x = cx - radius; x <= cx + radius; x++) {
          if (x < 0 || y < 0 || x >= W || y >= H || Math.hypot(x - cx, y - cy) > radius + this.rng.next()) continue;
          const c = this.cell(x, y);
          if (tool === "sunmoss" && c.type !== "water" && c.type !== "rock") c.moss = clamp(c.moss + 0.5, 0, 1);
          if (tool === "water") c.type = "water";
          if (tool === "fertile") { c.type = "fertile"; c.nutrients = 1; c.water = clamp(c.water + 0.25, 0, 1); }
          if (tool === "rock") { c.type = "rock"; c.moss = 0; }
          if (tool === "erase") { c.type = "grass"; c.moss = 0; c.rot = 0; c.biomass = 0; }
        }
      }
      if (tool === "glowmite") for (let i = 0; i < 8; i++) this.addCreature("glowmite", cx * CELL + this.rng.range(-20, 20), cy * CELL + this.rng.range(-20, 20));
      if (tool === "thornback") for (let i = 0; i < 3; i++) this.addCreature("thornback", cx * CELL + this.rng.range(-20, 20), cy * CELL + this.rng.range(-20, 20));
      if (tool === "erase") {
        this.creatures = this.creatures.filter((c) => Math.hypot(c.x / CELL - cx, c.y / CELL - cy) > radius + 2);
      }
    }

    disaster(type) {
      this.events.push({ tick: this.tick, type });
      if (type === "drought") {
        this.weather = "drought";
        this.weatherTimer = 700;
        this.drought = 0.72;
      }
      if (type === "rain") {
        this.weather = "storm";
        this.weatherTimer = 520;
        this.drought = 0;
        for (const c of this.cells) if (c.type !== "rock") c.water = clamp(c.water + 0.35, 0, 1);
      }
      if (type === "plague") {
        for (const c of this.creatures) if (this.rng.chance(c.kind === "glowmite" ? 0.18 : 0.12)) c.dead = true;
      }
      if (type === "meteor") {
        const mx = this.rng.int(12, W - 12), my = this.rng.int(9, H - 9);
        for (let y = my - 5; y <= my + 5; y++) for (let x = mx - 5; x <= mx + 5; x++) {
          if (Math.hypot(x - mx, y - my) < 5.5) {
            const c = this.cell(x, y);
            c.type = this.rng.chance(0.7) ? "rock" : "dry";
            c.moss = 0; c.biomass += 0.3;
          }
        }
        this.creatures.forEach((c) => { if (Math.hypot(c.x / CELL - mx, c.y / CELL - my) < 8) c.dead = true; });
      }
      if (type === "predators") {
        for (let i = 0; i < 5; i++) this.addCreature("thornback", this.rng.range(80, WORLD_W - 80), this.rng.range(80, WORLD_H - 80));
      }
    }

    rebalance() {
      const s = this.stats();
      if (s.mossCells < 160) for (let i = 0; i < 120; i++) this.paintPatch(this.rng.int(4, W - 5), this.rng.int(4, H - 5), "sunmoss", 2);
      if (s.glowmites < 18) for (let i = 0; i < 24; i++) this.addCreature("glowmite", this.rng.range(80, WORLD_W - 80), this.rng.range(80, WORLD_H - 80));
      if (s.thornbacks < 2 && s.glowmites > 28) for (let i = 0; i < 3; i++) this.addCreature("thornback", this.rng.range(80, WORLD_W - 80), this.rng.range(80, WORLD_H - 80));
      for (const c of this.cells) if (c.type !== "rock") { c.water = clamp(c.water + 0.2, 0, 1); c.nutrients = clamp(c.nutrients + 0.18, 0, 1.2); }
      this.events.push({ tick: this.tick, type: "rebalance" });
    }
  }

  const engine = new Engine();

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scaleX = canvas.width / WORLD_W;
    const scaleY = canvas.height / WORLD_H;
    const t = engine.tick;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = engine.cell(x, y);
        ctx.fillStyle = shadeTerrain(c);
        ctx.fillRect(x * CELL * scaleX, y * CELL * scaleY, CELL * scaleX + 0.4, CELL * scaleY + 0.4);
        if (c.moss > 0.03) drawMoss(x, y, c.moss, scaleX, scaleY, t);
        if (c.rot > 0.04) drawRot(x, y, c.rot, scaleX, scaleY, t);
      }
    }
    for (const c of engine.creatures) drawCreature(c, scaleX, scaleY, t);
    drawWeather(scaleX, scaleY);
  }

  function shadeTerrain(c) {
    const base = terrainColors[c.type] || terrainColors.grass;
    const n = Math.round(c.nutrients * 18);
    const w = Math.round(c.water * 16);
    return tintHex(base, n - 7, w - 8, n - 9);
  }

  function drawMoss(x, y, m, sx, sy, tick) {
    const px = x * CELL * sx, py = y * CELL * sy;
    const pulse = 0.55 + Math.sin(tick * 0.08 + x * 1.7 + y) * 0.12;
    ctx.fillStyle = `rgba(99,255,111,${0.18 + m * 0.42})`;
    ctx.beginPath();
    ctx.arc(px + 5 * sx, py + 5 * sy, (2.2 + m * 5) * sx, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(188,255,147,${pulse * m})`;
    ctx.fillRect(px + 3 * sx, py + 3 * sy, Math.max(1, 2 * sx), Math.max(1, 2 * sy));
  }

  function drawRot(x, y, r, sx, sy, tick) {
    const px = (x * CELL + 5) * sx, py = (y * CELL + 5) * sy;
    ctx.fillStyle = `rgba(182,103,255,${0.16 + r * 0.5})`;
    ctx.beginPath();
    ctx.arc(px, py, (1.5 + r * 4) * sx, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(238,205,255,${0.4 + Math.sin(tick * 0.05 + x) * 0.15})`;
    ctx.fillRect(px - sx, py - sy, sx * 2, sy * 2);
  }

  function drawCreature(c, sx, sy, tick) {
    const px = c.x * sx, py = c.y * sy;
    for (let i = 0; i < c.trail.length; i++) {
      const p = c.trail[i];
      ctx.fillStyle = c.kind === "glowmite" ? `rgba(74,233,255,${i / 40})` : `rgba(255,105,57,${i / 46})`;
      ctx.beginPath();
      ctx.arc(p[0] * sx, p[1] * sy, (i + 1) * 0.28 * sx, 0, Math.PI * 2);
      ctx.fill();
    }
    if (c.kind === "glowmite") {
      ctx.shadowBlur = 14;
      ctx.shadowColor = c.color;
      ctx.fillStyle = c.flash ? "#ffffff" : c.color;
      ctx.beginPath();
      ctx.ellipse(px, py, 4.5 * sx, 3.2 * sy, Math.atan2(c.vy, c.vx), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillRect(px + c.vx * 2 * sx, py - 1 * sy, 1.5 * sx, 1.5 * sy);
    } else {
      ctx.shadowBlur = 16;
      ctx.shadowColor = c.color;
      ctx.fillStyle = c.flash ? "#ffffff" : c.color;
      const a = Math.atan2(c.vy, c.vx);
      triangle(px, py, 8 * sx, a);
      ctx.fill();
      ctx.fillStyle = "rgba(255,216,118,0.9)";
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(px - Math.cos(a) * 2 * sx + i * 2 * sx, py - Math.sin(a) * 2 * sy, 1.2 * sx, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;
  }

  function drawWeather(sx, sy) {
    const hour = (engine.tick % 180) / 180;
    const night = Math.max(0, Math.cos(hour * Math.PI * 2)) * 0.34;
    if (night > 0.02) {
      ctx.fillStyle = `rgba(7,11,34,${night})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (engine.weather === "rain" || engine.weather === "storm") {
      ctx.strokeStyle = engine.weather === "storm" ? "rgba(172,231,255,0.42)" : "rgba(172,231,255,0.24)";
      ctx.lineWidth = 1;
      const count = engine.weather === "storm" ? 95 : 55;
      for (let i = 0; i < count; i++) {
        const x = (i * 97 + engine.tick * 5) % canvas.width;
        const y = (i * 53 + engine.tick * 13) % canvas.height;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 6, y + 16);
        ctx.stroke();
      }
    }
    if (engine.weather === "drought") {
      ctx.fillStyle = "rgba(255,137,54,0.12)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function renderGraph() {
    gctx.clearRect(0, 0, graph.width, graph.height);
    gctx.fillStyle = "rgba(255,255,255,0.04)";
    gctx.fillRect(0, 0, graph.width, graph.height);
    const max = Math.max(50, ...engine.history.flatMap((h) => [h.moss, h.glow, h.thorn * 5, h.rot]));
    drawLine("moss", "#77ff7d", max);
    drawLine("glow", "#69eeff", max);
    drawLine("thorn", "#ff7045", max, 5);
    drawLine("rot", "#c06cff", max);
    for (const e of engine.events) {
      const first = engine.history[0]?.tick || engine.tick;
      const span = Math.max(1, (engine.history.at(-1)?.tick || engine.tick) - first);
      const x = ((e.tick - first) / span) * graph.width;
      if (x < 0 || x > graph.width) continue;
      gctx.strokeStyle = e.type === "crash" ? "#ffd36c" : "#ffffff88";
      gctx.beginPath();
      gctx.moveTo(x, 0);
      gctx.lineTo(x, graph.height);
      gctx.stroke();
    }
  }

  function drawLine(key, color, max, multiplier = 1) {
    if (engine.history.length < 2) return;
    gctx.strokeStyle = color;
    gctx.lineWidth = 3;
    gctx.beginPath();
    engine.history.forEach((h, i) => {
      const x = (i / (HISTORY_MAX - 1)) * graph.width;
      const y = graph.height - ((h[key] * multiplier) / max) * (graph.height - 18) - 9;
      if (i === 0) gctx.moveTo(x, y);
      else gctx.lineTo(x, y);
    });
    gctx.stroke();
  }

  function updateUi() {
    const s = engine.stats();
    document.getElementById("clockLabel").textContent = `Tick ${engine.tick} · Day ${engine.day} · ${SEASONS[engine.seasonIndex]} · Year ${engine.year}`;
    document.getElementById("weatherLabel").textContent = `${engine.weather} · drought ${(engine.drought * 100).toFixed(0)}%`;
    document.getElementById("stats").innerHTML = [
      ["Sunmoss coverage", `${s.mossCells} cells`],
      ["Glowmites", s.glowmites],
      ["Thornbacks", s.thornbacks],
      ["Rotshrooms", `${s.rotCells} patches`],
      ["Glowmite traits", `speed ${s.glowSpeed.toFixed(2)} · vision ${s.glowVision.toFixed(2)} · fertility ${s.glowFertility.toFixed(2)}`],
      ["Thornback traits", `speed ${s.thornSpeed.toFixed(2)} · aggression ${s.thornAggression.toFixed(2)} · metabolism ${s.thornMetabolism.toFixed(2)}`],
      ["Soil fertility", `${(s.fertility * 100).toFixed(0)}%`],
      ["Water level", `${(s.water * 100).toFixed(0)}%`],
      ["Stability score", `${s.stability.toFixed(0)} / 100`],
    ].map(([label, value]) => `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`).join("");
    const warnings = [];
    if (s.mossCells < 30) warnings.push("Sunmoss crash risk");
    if (s.glowmites < 6) warnings.push("Glowmites near extinction");
    if (s.thornbacks < 2 && s.glowmites > 24) warnings.push("Predator line collapsing");
    if (s.water < 0.2) warnings.push("World is drying out");
    document.getElementById("warnings").innerHTML = warnings.map((w) => `<div class="warning">${w}</div>`).join("");
  }

  function loop(ts) {
    if (!loop.last) loop.last = ts;
    const elapsed = Math.min(0.25, (ts - loop.last) / 1000);
    loop.last = ts;
    if (!engine.paused) {
      engine.accumulator += elapsed * RATES[engine.rateIndex];
      let guard = 0;
      while (engine.accumulator >= FIXED_DT && guard++ < 80) {
        engine.step(FIXED_DT);
        engine.accumulator -= FIXED_DT;
      }
    }
    render();
    if (engine.tick % 10 === 0) updateUi();
    if (engine.tick % 15 === 0) renderGraph();
    requestAnimationFrame(loop);
  }

  function setupControls() {
    const list = document.getElementById("toolButtons");
    list.innerHTML = tools.map(([id, label, tip]) => `<button data-tool="${id}" title="${tip}">${label}</button>`).join("");
    list.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-tool]");
      if (!btn) return;
      engine.tool = btn.dataset.tool;
      document.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("active", b === btn));
    });
    document.querySelector('[data-tool="sunmoss"]').classList.add("active");

    document.getElementById("playPause").addEventListener("click", () => {
      engine.paused = !engine.paused;
      document.getElementById("playPause").textContent = engine.paused ? "Play" : "Pause";
    });
    document.getElementById("newWorld").addEventListener("click", () => engine.newWorld(document.getElementById("seedInput").value.trim() || niceSeed()));
    document.getElementById("rebalance").addEventListener("click", () => engine.rebalance());
    document.querySelectorAll("[data-disaster]").forEach((button) => button.addEventListener("click", () => engine.disaster(button.dataset.disaster)));
    const slider = document.getElementById("rateSlider");
    slider.value = engine.rateIndex;
    document.getElementById("rateLabel").textContent = `${RATES[engine.rateIndex]}x`;
    slider.addEventListener("input", () => {
      engine.rateIndex = Number(slider.value);
      storage.set("rateIndex", engine.rateIndex);
      document.getElementById("rateLabel").textContent = RATES[engine.rateIndex] === 0 ? "pause" : `${RATES[engine.rateIndex]}x`;
    });
    canvas.addEventListener("pointerdown", (event) => { engine.dragging = true; paintFromEvent(event); });
    canvas.addEventListener("pointermove", (event) => { if (engine.dragging) paintFromEvent(event); });
    window.addEventListener("pointerup", () => { engine.dragging = false; });
    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      engine.camera.zoom = clamp(engine.camera.zoom + (event.deltaY < 0 ? 0.1 : -0.1), 0.7, 2.2);
    }, { passive: false });
  }

  function paintFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * W;
    const y = ((event.clientY - rect.top) / rect.height) * H;
    engine.paintPatch(Math.floor(x), Math.floor(y), engine.tool, engine.tool === "rock" || engine.tool === "water" ? 2 : 3);
  }

  function updateSeedInput(seed) {
    const input = document.getElementById("seedInput");
    if (input) input.value = seed;
  }

  function niceSeed() {
    return `world-${Math.floor(Math.random() * 999999).toString(36)}`;
  }

  function jitterTraits(base, rng) {
    const out = {};
    for (const key of Object.keys(base)) out[key] = clamp(base[key] + rng.range(-0.16, 0.16), 0.15, 2.2);
    return out;
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function clampInt(value, min, max) { return Math.max(min, Math.min(max, value | 0)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist2(a, b) { return (a.x - b.x) ** 2 + (a.y - b.y) ** 2; }

  function valueNoise(seed, x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed.length * 17.13) * 43758.5453123;
    return n - Math.floor(n);
  }

  function tintHex(hex, r, g, b) {
    const n = parseInt(hex.slice(1), 16);
    const rr = clamp(((n >> 16) & 255) + r, 0, 255);
    const gg = clamp(((n >> 8) & 255) + g, 0, 255);
    const bb = clamp((n & 255) + b, 0, 255);
    return `rgb(${rr},${gg},${bb})`;
  }

  function triangle(x, y, radius, angle) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = angle + i * Math.PI * 2 / 3;
      const px = x + Math.cos(a) * radius;
      const py = y + Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  setupControls();
  updateSeedInput(engine.seed);
  updateUi();
  renderGraph();
  requestAnimationFrame(loop);
})();
