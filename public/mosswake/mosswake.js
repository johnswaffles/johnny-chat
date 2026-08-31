(() => {
  "use strict";

  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.lineJoin = "round";
  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const STORAGE_KEY = "johnny-mosswake-save-v1";
  const WORLD = { width: 1600, height: 1000 };
  const ROOM = { width: 1200, height: 800 };
  const STARTER_MODE = true;
  const COLORS = {
    grass: "#355e45", grassLight: "#417254", grassDark: "#294936", path: "#b49b6f", water: "#236d72",
    waterLight: "#5cb6a5", wood: "#76523b", stone: "#77867b", dungeon: "#283334", dungeonLight: "#344547",
    moss: "#83d27d", thorn: "#cf9a70", wisp: "#b8a6ff", moth: "#dc9bc4", warden: "#d78b70", boss: "#b95a90", gold: "#ffd77b", mint: "#8ef2cf", rose: "#ff9a9d", player: "#e9c08c"
  };
  const ART = {
    ink: "#17352f", inkSoft: "rgba(13,38,30,.68)", cream: "#f3f6df", mossHighlight: "#a8d98a", stoneShadow: "rgba(10,20,20,.42)",
    lightWarm: "#ffd77b", lightCool: "#8ef2cf", lightRose: "#ff9a9d", paper: "#f3f6df",
    shadow: "rgba(4,13,10,.34)", shadowDeep: "rgba(4,13,10,.52)", outlineWidth: 2
  };
  // Generated artwork is optional: the manifest can turn a painted sprite on without
  // changing collision, AI, animation state, or room composition. Missing entries keep
  // the crisp procedural fallback, which makes the art pass safe to stage incrementally.
  const ASSET_MANIFEST_URL = "/mosswake/assets/manifest.json?v=48";
  const loadedAssets = new Map();
  const loadOptionalAsset = (key, spec) => {
    if (!spec || typeof spec.src !== "string" || typeof Image === "undefined") return;
    const image = new Image(); image.decoding = "async";
    image.onload = () => loadedAssets.set(key, { image, spec });
    image.onerror = () => loadedAssets.delete(key);
    image.src = `/mosswake/assets/${spec.src.replace(/^\//, "")}`;
  };
  const loadOptionalAssets = () => {
    fetch(ASSET_MANIFEST_URL, { credentials: "same-origin", cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((manifest) => Object.entries(manifest?.sprites || {}).forEach(([key, spec]) => loadOptionalAsset(key, spec)))
      .catch(() => { /* Art is progressive enhancement; the procedural pass stays playable. */ });
  };
  const drawOptionalSprite = (key, x, y, options = {}) => {
    const entry = loadedAssets.get(key); if (!entry || !entry.image.complete || !entry.image.naturalWidth) return false;
    const { image, spec } = entry; const frameWidth = Number(spec.frameWidth) || image.naturalWidth; const frameHeight = Number(spec.frameHeight) || image.naturalHeight;
    const columns = Math.max(1, Number(spec.columns) || Math.floor(image.naturalWidth / frameWidth)); const frameCount = Math.max(1, Number(spec.frames) || Math.floor(image.naturalWidth / frameWidth) * Math.floor(image.naturalHeight / frameHeight));
    const frame = ((Number.isFinite(options.frame) ? options.frame : Math.floor(state.visualClock * (Number(spec.fps) || 8))) % frameCount + frameCount) % frameCount;
    const sx = (frame % columns) * frameWidth; const sy = Math.floor(frame / columns) * frameHeight;
    const dw = Number(options.width) || Number(spec.displayWidth) || frameWidth; const dh = Number(options.height) || Number(spec.displayHeight) || frameHeight;
    const anchorX = Number.isFinite(options.anchorX) ? options.anchorX : Number.isFinite(spec.anchorX) ? spec.anchorX : .5; const anchorY = Number.isFinite(options.anchorY) ? options.anchorY : Number.isFinite(spec.anchorY) ? spec.anchorY : .82;
    ctx.save(); ctx.translate(x, y); ctx.rotate(options.rotation || 0); ctx.scale(options.flipX ? -1 : 1, 1); ctx.globalAlpha *= Number.isFinite(options.alpha) ? options.alpha : 1;
    ctx.drawImage(image, sx, sy, frameWidth, frameHeight, -dw * anchorX, -dh * anchorY, dw, dh); ctx.restore(); return true;
  };
  const keys = new Set();
  const justPressed = new Set();
  const gamepadState = { vector: { x: 0, y: 0 }, buttons: new Set(), connected: false };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const moveToward = (current, target, amount) => current < target ? Math.min(current + amount, target) : Math.max(current - amount, target);
  const normalized = (x, y, fallbackX = 1, fallbackY = 0) => { const length = Math.hypot(x, y); return length ? { x: x / length, y: y / length } : { x: fallbackX, y: fallbackY }; };
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rand = (min, max) => min + Math.random() * (max - min);
  const hash01 = (x, y = 0) => { const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return value - Math.floor(value); };
  const shadeHex = (hex, amount = 0) => {
    if (typeof hex !== "string" || !/^#[0-9a-f]{6}$/i.test(hex)) return hex;
    const rgb = hex.slice(1).match(/.{2}/g).map((part) => parseInt(part, 16));
    const shifted = rgb.map((channel) => Math.round(clamp(channel + 255 * amount, 0, 255)));
    return `#${shifted.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
  };
  const makeId = (prefix) => prefix + Math.random().toString(36).slice(2, 8);
  let audioContext = null;
  const playSfx = (kind = "pulse") => {
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      audioContext = audioContext || new AudioCtor();
      if (audioContext.state === "suspended") audioContext.resume();
      const recipes = {
        attack: { notes: [180, 265], step: .025, length: .12, gain: .026, type: "triangle" },
        dash: { notes: [220, 330], step: .018, length: .13, gain: .024, type: "sine" },
        hit: { notes: [310, 440], step: .025, length: .16, gain: .04, type: "triangle" },
        kill: { notes: [392, 523.25], step: .045, length: .22, gain: .045, type: "triangle" },
        hurt: { notes: [116, 82], step: .035, length: .2, gain: .05, type: "sawtooth" },
        pickup: { notes: [523.25, 783.99], step: .06, length: .24, gain: .045, type: "sine" },
        chest: { notes: [261.63, 392, 659.25], step: .055, length: .3, gain: .05, type: "triangle" },
        door: { notes: [146.83, 220], step: .08, length: .34, gain: .038, type: "sine" },
        dialogue: { notes: [392], step: 0, length: .1, gain: .018, type: "sine" },
        relic: { notes: [392, 523.25, 783.99], step: .07, length: .26, gain: .07, type: "triangle" },
        cache: { notes: [261.63, 392, 659.25], step: .07, length: .26, gain: .055, type: "triangle" },
        "boss-enter": { notes: [98, 130.81, 196, 146.83], step: .09, length: .38, gain: .06, type: "sine" },
        phase: { notes: [130.81, 196, 293.66, 440], step: .07, length: .3, gain: .055, type: "sine" },
        defeat: { notes: [196, 261.63, 329.63], step: .09, length: .4, gain: .055, type: "sine" },
        victory: { notes: [392, 523.25, 659.25, 783.99], step: .08, length: .42, gain: .065, type: "sine" },
        pulse: { notes: [220, 329.63, 493.88], step: .07, length: .24, gain: .045, type: "sine" }
      };
      const recipe = recipes[kind] || recipes.pulse; const now = audioContext.currentTime;
      recipe.notes.forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain(); const start = now + index * recipe.step;
        oscillator.type = recipe.type; oscillator.frequency.setValueAtTime(frequency, start); gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(recipe.gain, start + .012); gain.gain.exponentialRampToValueAtTime(.0001, start + recipe.length);
        oscillator.connect(gain).connect(audioContext.destination); oscillator.start(start); oscillator.stop(start + recipe.length + .02);
      });
    } catch (error) { /* Sound is a progressive enhancement; visuals remain complete without it. */ }
  };

  const player = {
    x: 390, y: 500, radius: 14, hp: 6, maxHp: 6,
    velocityX: 0, velocityY: 0, facingX: 1, facingY: 0, targetFacingX: 1, targetFacingY: 0,
    attack: 0, attackElapsed: 0, attackCooldown: 0, attackBuffer: 0, attackDirectionX: 1, attackDirectionY: 0, attackHitRegistered: false,
    dash: 0, dashCooldown: 0, dashDirectionX: 1, dashDirectionY: 0, rootlightPulse: 0, rootlightCooldown: 0, invulnerable: 0, hurt: 0, walk: 0, animTime: 0, visualState: "idle"
  };
  const state = {
    mode: "title", area: "overworld", roomX: 0, roomY: 0, roomVisited: { overworld: true }, key: false, switches: false,
    miniBossDefeated: false, bossDefeated: false, reward: false, secretFound: false, chestOpened: false, heartChestOpened: false, loot: 0,
    rowanClue: false, rowanRewarded: false, southPassageOpen: false, reedCacheFound: false, hiddenChestOpened: false,
    optionalGuardDefeated: false, lanternLens: false, lanternSeed: false, discoveries: 0, discoveryTotal: 1,
    dialogueSpeed: 52, spawnGrace: 0, dungeonIntro: 0, dungeonEntranceSeen: false, roomTransition: 0, roomTransitionLabel: "", hazardCooldown: 0, ashCacheOpened: false, ashShortcutOpen: false,
    rootlightLantern: false, rootlightTested: false, rootlightGalleryOpen: false, rootlightGalleryCacheOpened: false, rootlightMoonBridge: false, rootlightWaterway: false, rootlightGateOpen: false, rootlightCacheOpened: false, itemReveal: 0,
    bossIntroSeen: false, bossEntrance: 0, bossPhase: 1, bossPhaseShift: 0, bossArenaPulse: 0, bossDefeatTimer: 0, bossDefeatX: 600, bossDefeatY: 390, bossRewardClaimed: false,
    lastSave: 0, toastTimer: 0, dialogue: null, transitionCooldown: 0, impactFlash: 0, visualClock: 0, pickupPulse: 0, hitStop: 0, chestOpening: 0, chestOpenX: 0, chestOpenY: 0, saveError: false
  };
  let enemies = [];
  let projectiles = [];
  let drops = [];
  let particles = [];
  let leaves = Array.from({ length: 42 }, () => ({ x: rand(0, WORLD.width), y: rand(0, WORLD.height), speed: rand(5, 16), phase: rand(0, 6.28) }));
  const environment = {
    treesBack: [
      { x: 70, y: 90, s: 1.45, phase: .4 }, { x: 126, y: 148, s: 1.02, phase: 1.2 }, { x: 205, y: 105, s: 1.25, phase: 2.1 }, { x: 324, y: 136, s: .86, phase: 3.2 },
      { x: 520, y: 82, s: 1.35, phase: 4.8 }, { x: 594, y: 132, s: .94, phase: 5.6 }, { x: 734, y: 94, s: 1.55, phase: 1.4 }, { x: 782, y: 152, s: .82, phase: 2.3 },
      { x: 1018, y: 72, s: 1.2, phase: 3.7 }, { x: 1086, y: 126, s: .88, phase: 4.4 }, { x: 1308, y: 88, s: 1.55, phase: 5.2 }, { x: 1402, y: 136, s: .95, phase: .9 }, { x: 1535, y: 110, s: 1.25, phase: 2.8 }
    ],
    treesMid: [
      { x: 125, y: 248, s: 1.05, phase: 2.3 }, { x: 164, y: 292, s: .78, phase: 3.1 }, { x: 242, y: 268, s: 1.18, phase: 3.8 },
      { x: 360, y: 282, s: .86, phase: 4.2 }, { x: 545, y: 336, s: 1.12, phase: 1.1 }, { x: 740, y: 356, s: .78, phase: 3.5 }, { x: 1040, y: 330, s: 1.12, phase: 5.5 },
      { x: 1110, y: 380, s: .82, phase: 1.1 }, { x: 1465, y: 315, s: 1.24, phase: 2.2 }, { x: 1510, y: 690, s: 1.08, phase: 4.6 }, { x: 250, y: 772, s: 1.18, phase: .8 },
      { x: 330, y: 824, s: .86, phase: 1.9 }, { x: 1045, y: 835, s: .92, phase: 3.1 }
    ],
    treesFront: [
      { x: 145, y: 900, s: 1.3, phase: 1.7 }, { x: 510, y: 930, s: 1.05, phase: 5.1 }, { x: 1245, y: 900, s: 1.4, phase: 3.6 }, { x: 1530, y: 900, s: 1.1, phase: .2 }
    ],
    bushes: [
      { x: 115, y: 318, s: 1.1, variant: 0, phase: .2 }, { x: 164, y: 298, s: .8, variant: 1, phase: 1.4 }, { x: 215, y: 328, s: 1.25, variant: 0, phase: 2.6 },
      { x: 342, y: 344, s: .85, variant: 2, phase: 4.1 }, { x: 376, y: 327, s: .72, variant: 0, phase: 5.2 },
      { x: 1328, y: 350, s: 1.1, variant: 1, phase: 1.8 }, { x: 1380, y: 332, s: .72, variant: 0, phase: 3.3 }, { x: 1450, y: 366, s: 1.24, variant: 2, phase: 5.4 },
      { x: 1320, y: 755, s: .95, variant: 0, phase: .7 }, { x: 1410, y: 728, s: 1.18, variant: 1, phase: 2.2 }, { x: 1490, y: 770, s: .76, variant: 2, phase: 4.5 }
    ],
    cliffs: [
      { x: 30, y: 190, w: 250, h: 74, phase: .4, variant: 0 }, { x: 1240, y: 42, w: 320, h: 66, phase: 2.7, variant: 2 }, { x: 1410, y: 610, w: 190, h: 58, phase: 4.4, variant: 6 }
    ],
    fences: [
      { x: 330, y: 318, length: 118, angle: -.08, posts: 4 }, { x: 1120, y: 735, length: 146, angle: .12, posts: 5 }, { x: 150, y: 670, length: 88, angle: -.22, posts: 3 }
    ],
    ruins: [
      { x: 1322, y: 410, s: 1, phase: .2, authored: true }, { x: 875, y: 285, s: .76, phase: 2.6, variant: "moonwell" }
    ],
    signs: [
      { x: 420, y: 354, angle: -.08, label: "OUTPOST" }, { x: 1080, y: 628, angle: .12, label: "LOW POND" }
    ],
    clearings: [
      { x: 230, y: 380, rx: 135, ry: 62, tone: "#467b50", rotation: -.12 }, { x: 480, y: 300, rx: 112, ry: 48, tone: "#2b5741", rotation: .16 },
      { x: 1280, y: 690, rx: 180, ry: 72, tone: "#477b50", rotation: -.2 }
    ],
    grasses: [
      { x: 65, y: 355, s: 1.1, phase: .2 }, { x: 180, y: 410, s: .8, phase: 2.2 }, { x: 305, y: 560, s: 1.25, phase: 4.1 },
      { x: 470, y: 640, s: .9, phase: 1.5 }, { x: 585, y: 426, s: 1.1, phase: 3.4 }, { x: 710, y: 585, s: 1.2, phase: 5.2 },
      { x: 1015, y: 422, s: .86, phase: 2.8 }, { x: 1165, y: 360, s: 1.15, phase: .7 }, { x: 1425, y: 535, s: 1.25, phase: 4.7 },
      { x: 1460, y: 760, s: .9, phase: 1.1 }, { x: 930, y: 890, s: 1.05, phase: 3.8 }, { x: 390, y: 830, s: .75, phase: 5.8 }
    ],
    grassPatches: [
      { x: 150, y: 420, radius: 62, density: 8, scale: .82, tone: "#6eae61", phase: .4, seed: 11, foliageFrame: 0 },
      { x: 430, y: 355, radius: 54, density: 6, scale: .68, tone: "#579254", phase: 1.8, seed: 23, foliageFrame: 1 },
      { x: 720, y: 430, radius: 74, density: 9, scale: .74, tone: "#72b968", phase: 3.1, seed: 37, foliageFrame: 4 },
      { x: 1030, y: 400, radius: 58, density: 7, scale: .66, tone: "#5a9a57", phase: 4.7, seed: 49, foliageFrame: 5 },
      { x: 1240, y: 680, radius: 86, density: 10, scale: .8, tone: "#6aab5f", phase: 2.6, seed: 61, foliageFrame: 2, landmark: true },
      { x: 420, y: 820, radius: 68, density: 7, scale: .7, tone: "#4e8951", phase: 5.4, seed: 73, foliageFrame: 6, landmark: true }
    ],
    flowers: [
      { x: 108, y: 348, s: .9, color: "#f4d57a", phase: .8 }, { x: 138, y: 364, s: .65, color: "#e7a7c6", phase: 2.1 },
      { x: 205, y: 425, s: .7, color: "#b9d9f2", phase: 4.5 }, { x: 315, y: 570, s: .75, color: "#f1b36b", phase: 1.8 },
      { x: 555, y: 415, s: .62, color: "#efd78b", phase: 3.6 }, { x: 690, y: 575, s: .8, color: "#cf9fe7", phase: 5.3 },
      { x: 1005, y: 432, s: .72, color: "#e7a7c6", phase: 2.6 }, { x: 1145, y: 347, s: .86, color: "#f4d57a", phase: .4 },
      { x: 1410, y: 524, s: .9, color: "#b9d9f2", phase: 4.1 }, { x: 1455, y: 748, s: .68, color: "#f1b36b", phase: 1.3 }
    ],
    rocks: [
      { x: 214, y: 365, s: 1.1, tone: "#6c7d73" }, { x: 545, y: 468, s: .75, tone: "#84958b" }, { x: 1000, y: 396, s: .9, tone: "#71877c" },
      { x: 1385, y: 470, s: 1.2, tone: "#63776e" }, { x: 1180, y: 640, s: .8, tone: "#86998b" }, { x: 860, y: 625, s: .72, tone: "#6e8175" }
    ],
    logs: [
      { x: 265, y: 700, length: 92, angle: -.16, s: 1 }, { x: 850, y: 612, length: 112, angle: .12, s: .9 }, { x: 1350, y: 790, length: 80, angle: -.5, s: .8 }
    ],
    shoreStones: [
      { x: 620, y: 665, s: .7 }, { x: 648, y: 680, s: .45 }, { x: 704, y: 653, s: .8 }, { x: 774, y: 663, s: .55 },
      { x: 815, y: 686, s: .72 }, { x: 901, y: 674, s: .5 }, { x: 958, y: 700, s: .82 }, { x: 1068, y: 550, s: .48 },
      { x: 1105, y: 542, s: .65 }, { x: 1194, y: 557, s: .78 }, { x: 1268, y: 543, s: .5 }, { x: 1324, y: 568, s: .72 }
    ],
    butterflies: [
      { x: 230, y: 300, phase: .3, speed: .8, range: 34, color: "#f2c47e" }, { x: 630, y: 380, phase: 2.4, speed: 1.05, range: 27, color: "#e8a5c4" },
      { x: 1090, y: 420, phase: 4.2, speed: .72, range: 40, color: "#a7d7ee" }, { x: 1410, y: 680, phase: 1.1, speed: .92, range: 31, color: "#f4d57a" }
    ],
    birds: [
      { x: 320, y: 148, phase: .8, speed: .16, range: 180, scale: 1 }, { x: 920, y: 180, phase: 3.2, speed: .12, range: 210, scale: .8 },
      { x: 1390, y: 250, phase: 5.1, speed: .14, range: 150, scale: .72 }
    ],
    fireflies: [
      { x: 180, y: 320, phase: .4 }, { x: 270, y: 460, phase: 2.5 }, { x: 520, y: 372, phase: 4.1 }, { x: 740, y: 610, phase: 1.2 },
      { x: 900, y: 548, phase: 3.7 }, { x: 1010, y: 470, phase: 5.2 }, { x: 1240, y: 420, phase: 2.1 }, { x: 1430, y: 600, phase: .9 }, { x: 1530, y: 520, phase: 4.8 }
    ]
  };
  const npcs = [
    { id: "rowan", name: "Rowan", role: "Outpost keeper", portrait: "rowan", x: 460, y: 380, baseX: 460, baseY: 380, behavior: "pace", phase: .3, facing: 1, route: [{ x: 460, y: 380 }, { x: 492, y: 374 }, { x: 486, y: 404 }, { x: 452, y: 400 }] },
    { id: "tansy", name: "Tansy", role: "Lantern cook", portrait: "tansy", x: 620, y: 356, baseX: 620, baseY: 356, behavior: "fire", phase: 1.2, facing: 1, facingAxis: "y" },
    { id: "brindle", name: "Brindle", role: "Pond ferrier", portrait: "brindle", x: 540, y: 585, baseX: 540, baseY: 585, behavior: "pace", phase: 2.4, facing: 1, facingAxis: "x", route: [{ x: 520, y: 582 }, { x: 572, y: 605 }, { x: 525, y: 625 }] },
    { id: "lumen", name: "Lumen", role: "Shrine cartographer", portrait: "lumen", x: 1235, y: 305, baseX: 1235, baseY: 305, behavior: "map", phase: 4.1, facing: 1, facingAxis: "y" },
    // Marlow uses the prepared fourth row of the activity atlas. He is placed
    // on the edge of the outpost lawn so the cart-tending loop reads as a
    // deliberate destination without crowding the fire, map table, or road.
    { id: "marlow", name: "Marlow", role: "Outpost trader", portrait: "trader", x: 752, y: 304, baseX: 752, baseY: 304, behavior: "cart", phase: 5.2, facing: 1, facingAxis: "y" }
  ];
  const activeNpcs = () => STARTER_MODE ? npcs.filter((npc) => npc.id === "rowan") : npcs;
  let camera = { x: 0, y: 0, shake: 0, shakeX: 0, shakeY: 0, shakePhase: 0 };
  let previousHealthKey = `${player.hp}/${player.maxHp}`;
  let lastFrame = 0;

  const ui = {
    title: document.getElementById("title-screen"), pause: document.getElementById("pause-screen"), victory: document.getElementById("victory-screen"),
    dialogue: document.getElementById("dialogue"), speaker: document.getElementById("dialogue-speaker"), dialogueText: document.getElementById("dialogue-text"), dialogueHint: document.getElementById("dialogue-hint"), portrait: document.getElementById("dialogue-portrait"), portraitMark: document.getElementById("dialogue-portrait-mark"), dialogueSpeed: document.getElementById("dialogue-speed"),
    toast: document.getElementById("toast"), area: document.getElementById("area-label"), room: document.getElementById("room-label"), objective: document.getElementById("objective"),
    objectiveCopy: document.getElementById("objective-copy"), hearts: document.getElementById("hearts"), seed: document.getElementById("seed-count"), keys: document.getElementById("key-count"), loot: document.getElementById("loot-count"), discovery: document.getElementById("discovery-count"), ability: document.getElementById("ability-status"), save: document.getElementById("save-state"), map: document.getElementById("map-dots"), controlsCard: document.getElementById("controls-card"), controlsToggle: document.getElementById("controls-toggle"), controlsContent: document.getElementById("controls-content"), savePanel: document.getElementById("save-panel"), saveCode: document.getElementById("save-code"), saveCodeStatus: document.getElementById("save-code-status")
  };

  const showToast = (message, duration = 2200) => {
    // Repeated input near a boundary should not restart the toast animation every
    // frame. Keeping the first message visible makes feedback feel deliberate.
    if (ui.toast.classList.contains("visible") && ui.toast.textContent === message && state.toastTimer > 0) return;
    ui.toast.textContent = message; ui.toast.classList.add("visible"); state.toastTimer = duration;
  };
  const hideScreens = () => [ui.title, ui.pause, ui.victory].forEach((screen) => screen.classList.add("hidden"));
  const setControlsExpanded = (expanded) => {
    if (!ui.controlsToggle || !ui.controlsContent) return;
    ui.controlsToggle.setAttribute("aria-expanded", String(expanded)); ui.controlsContent.hidden = !expanded; ui.controlsCard?.classList.toggle("expanded", expanded);
    const summary = ui.controlsToggle.querySelector(".controls-summary"); if (summary) summary.textContent = expanded ? "Hide" : "Show";
  };
  const setSaveCodeStatus = (message, error = false) => { if (!ui.saveCodeStatus) return; ui.saveCodeStatus.textContent = message; ui.saveCodeStatus.classList.toggle("error", error); };
  const openSavePanel = () => {
    if (!ui.savePanel || !ui.saveCode) return;
    ui.savePanel.hidden = false; ui.saveCode.value = encodeSaveCode(); setSaveCodeStatus("Code updated from your current progress.");
  };
  const updateSaveCode = () => { if (!ui.saveCode) return; saveData(); ui.saveCode.value = encodeSaveCode(); setSaveCodeStatus("Code updated. Keep a copy outside this browser."); };
  const copySaveCode = async () => {
    if (!ui.saveCode) return;
    if (!ui.saveCode.value.trim()) updateSaveCode();
    try { await navigator.clipboard.writeText(ui.saveCode.value); setSaveCodeStatus("Copied to clipboard."); }
    catch (error) { ui.saveCode.focus(); ui.saveCode.select(); setSaveCodeStatus("Code selected — copy it manually."); }
  };
  const restoreFromSaveCode = () => {
    const snapshot = decodeSaveCode(ui.saveCode?.value); if (!snapshot || !applySaveSnapshot(snapshot)) { setSaveCodeStatus("That code is not a valid Mosswake save.", true); return; }
    hideScreens(); saveData(); canvas.focus(); updateHud(); setSaveCodeStatus("Progress restored. Welcome back, Warden."); showToast("Mosswake save restored", 1800);
  };
  const togglePause = () => {
    if (state.mode === "playing") { saveData(); state.mode = "paused"; ui.pause.classList.remove("hidden"); }
    else if (state.mode === "paused") { state.mode = "playing"; ui.pause.classList.add("hidden"); canvas.focus(); }
    updateHud();
  };
  const dialoguePortraitLetter = (portrait) => ({ rowan: "R", tansy: "T", brindle: "B", lumen: "L", trader: "M" }[portrait] || "?");
  const renderDialogueLine = () => {
    if (!state.dialogue) return;
    const line = state.dialogue.lines[state.dialogue.index] || "";
    ui.speaker.textContent = state.dialogue.speaker;
    ui.dialogueText.textContent = line.slice(0, Math.floor(state.dialogue.charIndex));
    ui.dialogueHint.textContent = state.dialogue.complete ? (state.dialogue.index < state.dialogue.lines.length - 1 ? "E / Enter · next" : "E / Enter · close") : "E / Enter · reveal";
    ui.portrait.dataset.character = state.dialogue.portrait || "rowan";
    ui.portraitMark.textContent = dialoguePortraitLetter(state.dialogue.portrait);
    if (state.dialogue.portrait === "rowan") {
      ui.portrait.style.removeProperty("background-image");
      ui.portrait.style.removeProperty("--portrait-image");
      ui.portrait.classList.remove("painted");
    } else {
      ui.portrait.style.setProperty("--portrait-image", `url('/mosswake/assets/npcs/portraits/${state.dialogue.portrait}-portrait-generated-v1.png')`);
      ui.portrait.classList.add("painted");
    }
  };
  const setDialogue = (speaker, text, portrait = "rowan") => {
    const lines = Array.isArray(text) ? text : [text];
    state.dialogue = { speaker, lines, portrait, index: 0, charIndex: 0, complete: false };
    ui.dialogue.classList.remove("closing"); ui.dialogue.classList.add("visible"); playSfx("dialogue"); renderDialogueLine();
  };
  const closeDialogue = () => {
    state.dialogue = null; ui.dialogue.classList.remove("visible"); ui.dialogue.classList.add("closing");
    window.setTimeout(() => { if (!state.dialogue) ui.dialogue.classList.remove("closing"); }, 220);
  };
  const advanceDialogue = () => {
    if (!state.dialogue) return;
    if (!state.dialogue.complete) { state.dialogue.charIndex = state.dialogue.lines[state.dialogue.index].length; state.dialogue.complete = true; renderDialogueLine(); return; }
    if (state.dialogue.index < state.dialogue.lines.length - 1) { state.dialogue.index += 1; state.dialogue.charIndex = 0; state.dialogue.complete = false; renderDialogueLine(); return; }
    closeDialogue();
  };
  const updateDialogue = (dt) => {
    if (!state.dialogue || state.dialogue.complete) return;
    const line = state.dialogue.lines[state.dialogue.index] || "";
    state.dialogue.charIndex = Math.min(line.length, state.dialogue.charIndex + dt * (state.dialogueSpeed || 52));
    if (state.dialogue.charIndex >= line.length) state.dialogue.complete = true;
    renderDialogueLine();
  };
  const createSaveSnapshot = () => ({ ...state, dialogue: null, mode: "playing", hp: player.hp, area: state.area, roomX: state.roomX, roomY: state.roomY });
  const saveData = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(createSaveSnapshot()));
      state.lastSave = 0; state.saveError = false; return true;
    } catch (error) { state.saveError = true; return false; }
  };
  const SAVE_CODE_PREFIX = "mw1_";
  const encodeSaveCode = (snapshot = createSaveSnapshot()) => {
    const json = JSON.stringify({ game: "mosswake", version: 1, save: snapshot });
    const bytes = new TextEncoder().encode(json); let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    const encoded = btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
    return SAVE_CODE_PREFIX + encoded;
  };
  const decodeSaveCode = (value) => {
    try {
      const code = String(value || "").trim(); if (!code.startsWith(SAVE_CODE_PREFIX)) return null;
      const encoded = code.slice(SAVE_CODE_PREFIX.length).replaceAll("-", "+").replaceAll("_", "/"); const padded = encoded + "=".repeat((4 - (encoded.length % 4)) % 4);
      const binary = atob(padded); const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0)); const payload = JSON.parse(new TextDecoder().decode(bytes));
      return payload?.game === "mosswake" && payload?.version === 1 ? payload.save : null;
    } catch (error) { return null; }
  };
  const hasSave = () => { try { return Boolean(localStorage.getItem(STORAGE_KEY)); } catch (error) { return false; } };
  const normaliseSave = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const save = { ...value };
    save.area = STARTER_MODE ? "overworld" : (value.area === "dungeon" ? "dungeon" : "overworld");
    const roomX = Number(value.roomX); const roomY = Number(value.roomY); const hp = Number(value.hp);
    save.roomX = STARTER_MODE ? 0 : (Number.isFinite(roomX) ? clamp(Math.trunc(roomX), 0, 2) : 0);
    save.roomY = STARTER_MODE ? 0 : (Number.isFinite(roomY) ? clamp(Math.trunc(roomY), 0, 1) : 0);
    save.hp = Number.isFinite(hp) ? clamp(hp, 1, 12) : 6;
    save.roomVisited = STARTER_MODE ? { overworld: true } : (value.roomVisited && typeof value.roomVisited === "object" && !Array.isArray(value.roomVisited) ? value.roomVisited : { overworld: true });
    if (STARTER_MODE) { ["key", "switches", "miniBossDefeated", "bossDefeated", "reward", "heartChestOpened", "lanternLens", "lanternSeed", "ashCacheOpened", "ashShortcutOpen", "rootlightLantern", "rootlightTested", "rootlightGalleryOpen", "rootlightGalleryCacheOpened", "rootlightMoonBridge", "rootlightWaterway", "rootlightGateOpen", "rootlightCacheOpened", "bossIntroSeen", "bossRewardClaimed"].forEach((key) => { save[key] = false; }); save.discoveryTotal = 1; }
    return save;
  };
  const applySaveSnapshot = (value) => {
    const data = normaliseSave(value); if (!data) return false;
    Object.assign(state, data, { mode: "playing", dialogue: null, toastTimer: 0, hitStop: 0, chestOpening: 0, saveError: false });
    if (state.ashCacheOpened && !state.rootlightLantern) state.rootlightLantern = true;
    // Migrate older victories into the permanent Heartseed Echo reward.
    if (state.bossDefeated && !state.bossRewardClaimed) state.bossRewardClaimed = true;
    player.maxHp = 6 + (state.heartChestOpened ? 1 : 0) + (state.lanternSeed ? 1 : 0) + (state.bossRewardClaimed ? 1 : 0);
    player.hp = clamp(Number(data.hp) || player.maxHp, 1, player.maxHp);
    if (state.area === "dungeon") { player.x = ROOM.width / 2; player.y = ROOM.height - 100; } else { player.x = 390; player.y = 500; }
    startArea(state.area, false); return true;
  };
  const loadData = () => {
    try { return applySaveSnapshot(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")); }
    catch (error) { try { localStorage.removeItem(STORAGE_KEY); } catch (removeError) { /* Storage may be unavailable in private browsing. */ } state.saveError = true; return false; }
  };

  const restoreTitlePresentation = () => {
    ui.title.querySelector(".screen-kicker").textContent = "THE LANTERNWOOD CHRONICLE";
    ui.title.querySelector("h2").textContent = "Mosswake";
    ui.title.querySelector("p:not(.screen-kicker)").textContent = "Follow the blue moths through Lanternwood, then wake the buried shrine before the roots close over it.";
    const newGameButton = document.getElementById("new-game"); const continueButton = document.getElementById("continue-game");
    newGameButton.textContent = "New game"; continueButton.classList.remove("hidden"); continueButton.disabled = !hasSave();
  };

  const resetProgress = () => {
    try { localStorage.removeItem(STORAGE_KEY); state.saveError = false; } catch (error) { state.saveError = true; }
    state.area = "overworld"; state.roomX = 0; state.roomY = 0; state.roomVisited = { overworld: true }; state.key = false; state.switches = false; state.miniBossDefeated = false; state.bossDefeated = false; state.reward = false; state.secretFound = false; state.chestOpened = false; state.heartChestOpened = false; state.loot = 0;
    state.rowanClue = false; state.rowanRewarded = false; state.southPassageOpen = false; state.reedCacheFound = false; state.hiddenChestOpened = false; state.optionalGuardDefeated = false; state.lanternLens = false; state.lanternSeed = false; state.discoveries = 0; state.dialogueSpeed = 52; state.dungeonIntro = 0; state.dungeonEntranceSeen = false; state.roomTransition = 0; state.roomTransitionLabel = ""; state.hazardCooldown = 0; state.ashCacheOpened = false; state.ashShortcutOpen = false; state.rootlightLantern = false; state.rootlightTested = false; state.rootlightGalleryOpen = false; state.rootlightGalleryCacheOpened = false; state.rootlightMoonBridge = false; state.rootlightWaterway = false; state.rootlightGateOpen = false; state.rootlightCacheOpened = false; state.itemReveal = 0; state.bossIntroSeen = false; state.bossEntrance = 0; state.bossPhase = 1; state.bossPhaseShift = 0; state.bossArenaPulse = 0; state.bossDefeatTimer = 0; state.bossDefeatX = 600; state.bossDefeatY = 390; state.bossRewardClaimed = false; state.visualClock = 0; state.pickupPulse = 0; state.hitStop = 0; state.chestOpening = 0; state.chestOpenX = 0; state.chestOpenY = 0;
    player.maxHp = 6; player.hp = player.maxHp; player.x = 390; player.y = 500; resetPlayerMotion(); startArea("overworld", false); state.mode = "title"; hideScreens(); ui.title.classList.remove("hidden"); restoreTitlePresentation(); updateHud();
  };

  const spawnParticle = (x, y, color, count = 5, speed = 75, kind = "spark") => {
    for (let i = 0; i < count; i += 1) particles.push({ x, y, vx: rand(-speed, speed), vy: rand(-speed, speed), life: rand(.25, .65), maxLife: .65, size: rand(2, 5), color, kind, rotation: rand(-Math.PI, Math.PI) });
  };
  const spawnLeaves = (x, y, count = 8) => { for (let i = 0; i < count; i += 1) particles.push({ x, y, vx: rand(-45, 45), vy: rand(-75, -18), life: rand(.45, .9), maxLife: .9, size: rand(3, 7), color: i % 2 ? "#b2e898" : "#ffd27a", kind: "leaf", rotation: rand(-Math.PI, Math.PI) }); };
  const spawnDust = (x, y, count = 6, color = "#d5c39b") => { for (let i = 0; i < count; i += 1) particles.push({ x: x + rand(-7, 7), y: y + rand(-4, 4), vx: rand(-35, 35), vy: rand(-28, -4), life: rand(.22, .45), maxLife: .45, size: rand(4, 9), color, kind: "dust", rotation: 0 }); };
  const triggerImpact = (x, y, color = COLORS.gold, strength = 1) => {
    spawnParticle(x, y, color, strength > 1 ? 12 : 7, strength > 1 ? 150 : 105, "impact");
    particles.push({ x, y, vx: 0, vy: 0, life: .18 + strength * .04, maxLife: .18 + strength * .04, size: 12 + strength * 8, color, kind: "ring", rotation: 0 });
    state.impactFlash = Math.max(state.impactFlash, .045 * strength); state.hitStop = Math.max(state.hitStop, Math.min(.075, .018 + strength * .02)); camera.shake = Math.max(camera.shake, .045 * strength); camera.shakePhase += 1.1 + strength;
  };
  // Combat impacts are intentionally tighter than exploration feedback: a short, directional
  // burst reads as contact without turning every sword swing into a particle cloud.
  const spawnCombatSparks = (x, y, color, direction = null, count = 5, speed = 110, size = 7) => {
    const base = direction && (direction.x || direction.y) ? Math.atan2(direction.y, direction.x) : null;
    for (let i = 0; i < count; i += 1) {
      const angle = base === null ? rand(-Math.PI, Math.PI) : base + rand(-.76, .76);
      const velocity = rand(speed * .68, speed * 1.08);
      const life = rand(.16, .29);
      particles.push({ x: x + rand(-2, 2), y: y + rand(-2, 2), vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, life, maxLife: life, size: rand(size * .7, size * 1.25), color, kind: "combat-spark", rotation: angle });
    }
  };
  const triggerCombatImpact = (x, y, color = COLORS.gold, strength = 1, direction = null) => {
    const count = strength >= 1.3 ? 8 : strength >= 1 ? 6 : 4;
    spawnCombatSparks(x, y, color, direction, count, strength >= 1.3 ? 148 : 112, strength >= 1.3 ? 8 : 6);
    const life = .13 + strength * .035;
    particles.push({ x, y, vx: 0, vy: 0, life, maxLife: life, size: 8 + strength * 5, color, kind: "combat-ring", rotation: direction ? Math.atan2(direction.y, direction.x) : 0 });
    particles.push({ x, y, vx: 0, vy: 0, life: .09 + strength * .025, maxLife: .09 + strength * .025, size: 3 + strength * 2, color: "#fff7d2", kind: "impact-glint", rotation: direction ? Math.atan2(direction.y, direction.x) : 0 });
    state.impactFlash = Math.max(state.impactFlash, .018 * strength); state.hitStop = Math.max(state.hitStop, Math.min(.065, .012 + strength * .018)); camera.shake = Math.max(camera.shake, .024 * strength); camera.shakePhase += .75 + strength * .55;
  };
  const spawnProjectileImpact = (projectile) => {
    const direction = normalized(-projectile.vx, -projectile.vy, 0, 0);
    const bossAttack = projectile.kind === "shockwave" || projectile.kind === "rosebolt" || projectile.kind === "root-lance";
    const count = projectile.kind === "shockwave" ? 6 : bossAttack ? 5 : 3;
    spawnCombatSparks(projectile.x, projectile.y, projectile.color, direction, count, bossAttack ? 120 : 88, bossAttack ? 7 : 5);
    const life = bossAttack ? .22 : .16;
    particles.push({ x: projectile.x, y: projectile.y, vx: 0, vy: 0, life, maxLife: life, size: bossAttack ? 13 : 9, color: projectile.color, kind: "projectile-impact", rotation: Math.atan2(projectile.vy, projectile.vx) });
  };
  const updateEnvironment = (dt) => {
    const touchables = [...environment.grasses, ...environment.flowers];
    touchables.forEach((item) => {
      item.rustle = Math.max(0, (item.rustle || 0) - dt * 2.8);
      const near = state.area === "overworld" && distance(player, item) < 25 * (item.s || 1);
      if (near) {
        item.rustle = Math.max(item.rustle, .42);
        if (!item.touched) {
          item.touched = true;
          spawnDust(item.x, item.y + 4, 2, item.color || "#c9b88a");
          if (Math.random() < .45) spawnParticle(item.x, item.y, item.color || "#b2e898", 2, 22, "leaf");
        }
      } else item.touched = false;
    });
    environment.grassPatches.forEach((patch) => {
      patch.rustle = Math.max(0, (patch.rustle || 0) - dt * 2.4);
      const near = state.area === "overworld" && distance(player, patch) < patch.radius;
      if (near) {
        patch.rustle = Math.max(patch.rustle, .62);
        if (!patch.touched) {
          patch.touched = true;
          spawnDust(player.x, player.y + 8, 2, "#b7ad82");
        }
      } else patch.touched = false;
    });
  };
  const updateNpcs = (dt) => {
    activeNpcs().forEach((npc) => {
      npc.clock = (npc.clock || 0) + dt;
      const playerNear = state.area === "overworld" && distance(player, npc) < 92;
      npc.near = playerNear;
      if (npc.behavior === "pace") {
        const route = npc.route; const travel = npc.id === "rowan" ? 5.2 : 3.8;
        // A nearby passerby gets the NPC's attention. Hold the route position
        // briefly and turn toward the player so the interaction prompt reads as
        // a deliberate acknowledgement rather than a prompt attached to a
        // character who is walking away.
        if (playerNear) {
          const towardX = player.x - npc.x; const towardY = player.y - npc.y;
          if (Math.abs(towardX) >= Math.abs(towardY)) { npc.facingAxis = "x"; npc.facing = towardX >= 0 ? 1 : -1; }
          else { npc.facingAxis = "y"; npc.facing = towardY >= 0 ? 1 : -1; }
          npc.animTime = npc.clock * 1.05;
        } else {
          const routeTime = npc.clock / travel; const segment = Math.floor(routeTime) % route.length; const next = route[(segment + 1) % route.length]; const current = route[segment]; const blend = routeTime - Math.floor(routeTime); const eased = blend * blend * (3 - 2 * blend);
          npc.x = current.x + (next.x - current.x) * eased; npc.y = current.y + (next.y - current.y) * eased;
          if (Math.abs(next.x - current.x) >= Math.abs(next.y - current.y)) { npc.facingAxis = "x"; npc.facing = next.x >= current.x ? 1 : -1; }
          else { npc.facingAxis = "y"; npc.facing = next.y >= current.y ? 1 : -1; }
        }
      } else {
        npc.x = npc.baseX + Math.sin(npc.clock * .7 + npc.phase) * (npc.behavior === "fire" ? 3 : 1.5);
        npc.y = npc.baseY + Math.sin(npc.clock * 1.35 + npc.phase) * (npc.behavior === "fire" ? 1.5 : 1);
        if (playerNear) {
          const towardX = player.x - npc.x; const towardY = player.y - npc.y;
          if (Math.abs(towardX) >= Math.abs(towardY)) { npc.facingAxis = "x"; npc.facing = towardX >= 0 ? 1 : -1; }
          else { npc.facingAxis = "y"; npc.facing = towardY >= 0 ? 1 : -1; }
        } else if (npc.behavior === "fire") {
          npc.facingAxis = "y"; npc.facing = 1;
        }
        else if (npc.behavior === "map") {
          npc.facingAxis = "y"; npc.facing = 1;
        }
        else if (npc.behavior === "watch") npc.facing = Math.sin(npc.clock * .35 + npc.phase) > 0 ? 1 : -1;
      }
      npc.work = Math.sin(npc.clock * (npc.behavior === "map" ? 1.45 : 2.2) + npc.phase);
      npc.animTime = npc.clock * (npc.behavior === "pace" ? (playerNear ? 1.05 : 4.6) : 1.6);
    });
  };
  const nearestNpc = (radius = 68) => {
    if (state.area !== "overworld") return null;
    return activeNpcs().reduce((nearest, npc) => { const range = distance(player, npc); return range < radius && (!nearest || range < nearest.range) ? { npc, range } : nearest; }, null)?.npc || null;
  };
  const spawnDrop = (enemy) => {
    if (!enemy.drop) return;
    drops.push({ x: enemy.x, y: enemy.y, ...enemy.drop, life: 24, phase: rand(0, 6.28), bob: rand(0, 6.28) });
  };
  const spawnEnemyDeath = (enemy) => {
    enemy.dead = true; enemy.deathTimer = enemy.type === "boss" ? 1.4 : .58; enemy.deathMax = enemy.deathTimer; enemy.velocityX = 0; enemy.velocityY = 0;
    if (enemy.type !== "boss") playSfx("kill");
    spawnLeaves(enemy.x, enemy.y, enemy.type === "boss" ? 26 : 6);
    spawnCombatSparks(enemy.x, enemy.y, enemy.type === "boss" ? COLORS.gold : enemy.color, null, enemy.type === "boss" ? 12 : 5, enemy.type === "boss" ? 175 : 120, enemy.type === "boss" ? 10 : 6);
    particles.push({ x: enemy.x, y: enemy.y, vx: 0, vy: 0, life: enemy.type === "boss" ? 1.4 : .65, maxLife: enemy.type === "boss" ? 1.4 : .65, size: enemy.type === "boss" ? 38 : 21, color: enemy.type === "boss" ? COLORS.gold : enemy.color, kind: "death-ring", rotation: 0, bossFx: enemy.type === "boss" });
    particles.push({ x: enemy.x, y: enemy.y - 5, vx: 0, vy: 0, life: enemy.type === "boss" ? 1.25 : .48, maxLife: enemy.type === "boss" ? 1.25 : .48, size: enemy.type === "boss" ? 42 : 22, color: enemy.type === "boss" ? COLORS.rose : enemy.color, kind: "death-shards", rotation: 0, bossFx: enemy.type === "boss" });
    triggerCombatImpact(enemy.x, enemy.y, enemy.type === "boss" ? COLORS.gold : enemy.color, enemy.type === "boss" ? 1.55 : 1.02); spawnDrop(enemy);
  };
  const updateDrops = (dt) => {
    drops = drops.filter((drop) => {
      drop.life -= dt; drop.bob += dt * 4;
      if (distance(player, drop) < 25 && state.mode === "playing") { state.loot += 1; state.pickupPulse = .7; playSfx("pickup"); showToast(`${drop.name} collected`, 1100); spawnParticle(drop.x, drop.y, drop.color, 8, 60, "spark"); triggerImpact(drop.x, drop.y, drop.color, .72); saveData(); updateHud(); return false; }
      return drop.life > 0;
    });
  };
  const addDiscovery = (label) => {
    state.discoveries = Math.min(state.discoveryTotal, (state.discoveries || 0) + 1);
    playSfx("cache"); showToast(`${label} · discovery ${state.discoveries}/${state.discoveryTotal}`, 2200);
    saveData(); updateHud();
  };
  const talkToNpc = (npc) => {
    if (npc.id === "rowan") {
      if (!state.rowanClue) { state.rowanClue = true; setDialogue(npc.name, ["The moths are not leading you away, Warden.", "Three pale stones point past the low pond; ivy hides the way."], npc.portrait); showToast("Rowan shared a quiet clue", 1600); saveData(); updateObjective(); return; }
      if (state.southPassageOpen && !state.rowanRewarded) { state.rowanRewarded = true; state.lanternLens = true; addDiscovery("Rowan's lantern chart recovered"); setDialogue(npc.name, ["You found the old seam.", "Keep this chart: places the lantern cannot reach are often worth remembering."], npc.portrait); return; }
      setDialogue(npc.name, state.hiddenChestOpened ? ["The seed chose you. That is rarer than courage.", "Try not to let the shrine hear you brag about it."] : state.southPassageOpen ? ["The hidden grove has woken.", "Listen for the thornback's slow steps before you reach for the old chest."] : ["The broken stones end at a curtain of ivy.", "Steel can open what a path cannot."], npc.portrait); return;
    }
    if (npc.id === "tansy") {
      setDialogue(npc.name, state.lanternSeed ? ["That glow in your pocket? Not a firefly.", "If it starts humming, put it near the stew. Everything tastes better after a shrine scare."] : state.southPassageOpen ? ["I heard the reeds fall from all the way over here.", "Leave the grove a little quieter than you found it, will you?"] : ["I keep the outpost warm and Rowan honest.", "The blue moths never land near my fire. Smart little things."], npc.portrait); return;
    }
    if (npc.id === "brindle") {
      setDialogue(npc.name, state.reedCacheFound ? ["Dewglass lens, eh? I wondered where that old glint went.", "Look through it at dusk; the pond remembers paths the day forgets."] : state.southPassageOpen ? ["The waterline changed when you opened the ivy.", "Something with a shell is sulking in the lantern leaves now."] : ["I ferry messages around the low pond.", "Three pale stones are not a path unless you know which way they lean."], npc.portrait); return;
    }
    if (npc.id === "marlow") {
      setDialogue(npc.name, state.bossDefeated ? ["The shrine's heart woke the old routes. My cart can finally travel east again.", "If you find a road that remembers your name, send it my way."] : state.lanternSeed ? ["That glow is not for sale, Warden. Some things choose their keeper.", "I can trade supplies, but the shrine keeps the rarest bargains."] : ["Marlow. I keep this cart moving before the roots close the road.", "Bring me a Moon spark someday; I will tell you which path the map forgot."], npc.portrait); return;
    }
    setDialogue(npc.name, state.bossDefeated ? ["The shrine's light has changed. My map is finally becoming obsolete.", "Good. A map should never get the last word."] : state.lanternLens ? ["The chart and the lens agree. That is unusual.", "There is more under this green than roots and old stone."] : ["I map the shrine by lantern reflections, not roads.", "If a firefly avoids a patch of moss, I draw a question mark."], npc.portrait);
  };

  const spawnEnemy = (type, x, y, options = {}) => {
    const config = {
      mossling: { hp: 2, maxHp: 2, speed: 48, radius: 14, color: COLORS.moss, damage: 1, behavior: "skirmish", detectionRange: 250, attackRange: 35, attackRate: 1.1, drop: { name: "Moss mote", color: COLORS.moss, kind: "mote" } },
      thornback: { hp: 4, maxHp: 4, speed: 56, radius: 18, color: COLORS.thorn, damage: 2, behavior: "charger", detectionRange: 360, attackRange: 32, attackRate: 1.8, drop: { name: "Bark shard", color: "#d6a16f", kind: "bark" } },
      wisp: { hp: 3, maxHp: 3, speed: 42, radius: 13, color: COLORS.wisp, damage: 1, behavior: "ranged", detectionRange: 430, attackRange: 210, attackRate: 1.8, drop: { name: "Moon spark", color: COLORS.wisp, kind: "moon" } },
      moth: { hp: 3, maxHp: 3, speed: 68, radius: 12, color: COLORS.moth, damage: 1, behavior: "ambush", detectionRange: 175, attackRange: 42, attackRate: 1.25, drop: { name: "Moth dust", color: "#eeb7dc", kind: "dust" } },
      warden: { hp: 9, maxHp: 9, speed: 22, radius: 25, color: COLORS.warden, damage: 2, behavior: "warden", detectionRange: 380, attackRange: 48, attackRate: 1.2, drop: { name: "Root sigil", color: COLORS.warden, kind: "sigil" } },
      boss: { hp: 16, maxHp: 16, speed: 28, radius: 39, color: COLORS.boss, damage: 2, behavior: "boss", detectionRange: 520, attackRange: 190, attackRate: 1.25, drop: { name: "Heartseed echo", color: COLORS.gold, kind: "echo" } }
    }[type];
    enemies.push({ id: makeId(type), type, x, y, homeX: x, homeY: y, ...config, ...options, velocityX: 0, velocityY: 0, attackCooldown: options.attackCooldown ?? rand(.25, config.attackRate), hitFlash: 0, hitStun: 0, hitDirectionX: 1, hitDirectionY: 0, recoilX: 0, recoilY: 0, telegraph: 0, telegraphType: "", state: "idle", stateTimer: rand(.2, .7), phase: 1, attackPattern: 0, phaseNotice: 0, dead: false, deathTimer: 0, alerted: false, hidden: type === "moth", orbit: rand(0, 6.28), chargeX: 0, chargeY: 0, aimX: 0, aimY: 0, facingX: 1, facingY: 0, walk: rand(0, 6.28), animTime: rand(0, 6.28), motionSpeed: 0, presentationPrevX: x, presentationPrevY: y });
  };
  const spawnHiddenEncounter = () => {
    if (state.area !== "overworld" || !state.southPassageOpen || state.optionalGuardDefeated || enemies.some((enemy) => enemy.encounter === "hidden-cache" && !enemy.dead)) return;
    spawnEnemy("thornback", 1050, 818, { guardRadius: 72, encounter: "hidden-cache", attackCooldown: .7 });
  };

  const resetPlayerMotion = () => {
    player.velocityX = 0; player.velocityY = 0; player.attack = 0; player.attackElapsed = 0; player.attackCooldown = 0;
    player.attackBuffer = 0; player.dash = 0; player.dashCooldown = 0; player.rootlightPulse = 0; player.rootlightCooldown = 0; player.invulnerable = 0; player.hurt = 0;
    player.visualState = "idle"; player.walk = 0;
  };

  const startArea = (area, announce = true) => {
    if (STARTER_MODE && area === "dungeon") area = "overworld";
    state.area = area;
    // Give the player a calm read of each outdoor arrival before enemies wake up.
    // This keeps the opening and post-dungeon return readable without changing combat rules.
    // Give dungeon arrivals a readable beat as well as the outdoor opening
    // grace. Three seconds lets a player step onto a newly awakened bridge and
    // see the wisps' first telegraph before ranged combat can land, without
    // changing their damage, detection, or attack cadence.
    state.spawnGrace = area === "overworld" ? 5 : 3;
    if (area === "dungeon") {
      state.roomTransition = .72;
      state.roomTransitionLabel = dungeonRoomName();
      if (`${state.roomX}-${state.roomY}` === "0-0" && !state.dungeonEntranceSeen) {
        state.dungeonIntro = 3.4;
        state.dungeonEntranceSeen = true;
      }
      if (`${state.roomX}-${state.roomY}` === "2-1" && !state.bossDefeated && !state.bossIntroSeen) { state.bossEntrance = 3.8; state.bossIntroSeen = true; state.bossPhase = 1; playSfx("boss-enter"); }
    }
    enemies = []; projectiles = []; drops = []; particles = [];
    if (area === "overworld") {
      player.x = 390; player.y = 500;
      spawnEnemy("mossling", 650, 455, { group: "meadow-pack" }); spawnEnemy("mossling", 760, 430, { group: "meadow-pack" });
      if (!STARTER_MODE) { spawnEnemy("thornback", 905, 520, { guardRadius: 120, encounter: "bridge-guard" }); spawnEnemy("wisp", 1145, 340, { guardRadius: 150, encounter: "lantern-grove" }); spawnEnemy("moth", 1280, 745, { guardRadius: 90, encounter: "chest-ambush" }); spawnHiddenEncounter(); }
      if (announce) showToast("LANTERNWOOD · the moths are listening");
    } else {
      player.x = ROOM.width / 2; player.y = ROOM.height - 90;
      spawnDungeonEnemies();
      if (announce) showToast(dungeonRoomName());
    }
    resetPlayerMotion();
    state.roomVisited[state.area === "dungeon" ? `dungeon-${state.roomX}-${state.roomY}` : "overworld"] = true;
    updateHud();
  };

  const dungeonRoomName = () => ({ "0-0": "Root Gallery", "1-0": "Moon Switch Hall", "2-0": "Warden's Garden", "0-1": "Flooded Vault", "1-1": "Ashen Antechamber", "2-1": "Heartseed Sanctum" }[`${state.roomX}-${state.roomY}`] || "Hollow Shrine");

  const spawnDungeonEnemies = () => {
    const key = `${state.roomX}-${state.roomY}`;
    if (key === "0-0") { spawnEnemy("mossling", 300, 300, { group: "gallery-scouts" }); spawnEnemy("mossling", 860, 460, { group: "gallery-scouts" }); }
    if (key === "1-0") { spawnEnemy("wisp", 300, 270, { guardRadius: 70 }); spawnEnemy("wisp", 900, 470, { guardRadius: 70 }); }
    if (key === "2-0" && !state.miniBossDefeated) { spawnEnemy("warden", 600, 360, { attackCooldown: .9 }); spawnEnemy("mossling", 420, 560, { group: "garden-sprouts" }); spawnEnemy("mossling", 780, 560, { group: "garden-sprouts" }); }
    if (key === "0-1") { spawnEnemy("mossling", 235, 250); spawnEnemy("mossling", 940, 570); spawnEnemy("wisp", 900, 260, { guardRadius: 55 }); }
    if (key === "1-1" && !state.ashCacheOpened) { spawnEnemy("wisp", 620, 300); spawnEnemy("moth", 920, 610, { hidden: true, guardRadius: 48 }); }
    // Keep the Guardian on the sanctum's central ring. The old y=285 spawn sat
    // underneath the clamped bottom camera and was partially hidden by the boss HUD.
    if (key === "2-1" && !state.bossDefeated) spawnEnemy("boss", 600, 390, { attackCooldown: 1.2 });
  };

  const overworldObstacles = () => [
    { x: 800, y: 90, w: 300, h: 165, type: "house" }, { x: 1140, y: 100, w: 190, h: 135, type: "outpost" },
    { x: 610, y: 650, w: 360, h: 150, type: "water" }, { x: 1080, y: 510, w: 260, h: 90, type: "water" },
    { x: 240, y: 220, w: 90, h: 130, type: "rock" }, { x: 1420, y: 300, w: 100, h: 190, type: "rock" },
    ...(!STARTER_MODE && !state.rootlightGateOpen ? [{ x: 1360, y: 550, w: 180, h: 58, type: "rootlight-gate" }] : [])
  ];
  const dungeonObstacles = () => {
    const walls = [{ x: 0, y: 0, w: ROOM.width, h: 35 }, { x: 0, y: ROOM.height - 35, w: ROOM.width, h: 35 }, { x: 0, y: 0, w: 35, h: ROOM.height }, { x: ROOM.width - 35, y: 0, w: 35, h: ROOM.height }];
    const key = `${state.roomX}-${state.roomY}`;
    if (key === "0-0") walls.push({ x: 270, y: 190, w: 54, h: 120, type: "pillar" }, { x: 876, y: 190, w: 54, h: 120, type: "pillar" });
    if (key === "1-0") walls.push({ x: 270, y: 210, w: 54, h: 150, type: "pillar" }, { x: 876, y: 210, w: 54, h: 150, type: "pillar" }, ...(!state.rootlightMoonBridge ? [{ x: 490, y: 540, w: 220, h: 34, type: "broken-wall" }] : []));
    if (key === "2-0") walls.push({ x: 230, y: 190, w: 46, h: 130, type: "pillar" }, { x: 924, y: 190, w: 46, h: 130, type: "pillar" }, { x: 260, y: 510, w: 120, h: 34, type: "fallen-stone" }, { x: 820, y: 510, w: 120, h: 34, type: "fallen-stone" });
    if (key === "0-1") walls.push({ x: 300, y: 210, w: 80, h: 180, type: "pillar" }, { x: 820, y: 400, w: 80, h: 180, type: "pillar" });
    if (key === "1-1") walls.push({ x: 300, y: 180, w: 600, h: 28, type: "wall" }, { x: 250, y: 510, w: 110, h: 34, type: "debris" }, { x: 840, y: 510, w: 110, h: 34, type: "debris" });
    if (key === "2-1") walls.push({ x: 220, y: 170, w: 45, h: 180, type: "pillar" }, { x: 935, y: 170, w: 45, h: 180, type: "pillar" });
    return walls;
  };
  const lockedDungeonDoors = () => {
    const key = `${state.roomX}-${state.roomY}`; const doors = [];
    if (key === "0-0" && !state.key) doors.push({ x: 1138, y: 332, w: 62, h: 136, type: "locked-door" });
    if (key === "1-0" && !state.switches) doors.push({ x: 532, y: 738, w: 136, h: 62, type: "locked-door" });
    if (key === "2-0" && !state.miniBossDefeated) doors.push({ x: 532, y: 738, w: 136, h: 62, type: "locked-door" });
    if (key === "1-1" && !state.ashShortcutOpen) doors.push({ x: 0, y: 332, w: 62, h: 136, type: "locked-door" });
    if (key === "1-1" && !(state.key && state.miniBossDefeated)) doors.push({ x: 1138, y: 332, w: 62, h: 136, type: "locked-door" });
    return doors;
  };
  const dungeonHazards = () => {
    const key = `${state.roomX}-${state.roomY}`;
    if (key === "0-1" && !state.rootlightWaterway) return [{ x: 410, y: 250, w: 380, h: 280, damage: 1, color: COLORS.water, label: "deep water" }];
    if (key === "1-1") return [{ x: 420, y: 250, w: 110, h: 250, damage: 1, color: "#b65345", label: "ember trench" }, { x: 670, y: 250, w: 110, h: 250, damage: 1, color: "#b65345", label: "ember trench" }];
    return [];
  };
  const rootlightNodes = () => {
    if (state.area === "overworld") return STARTER_MODE ? [] : [{ id: "rootlight-gate", x: 1450, y: 580, radius: 88, label: "MOONROOT GATE" }];
    const key = `${state.roomX}-${state.roomY}`;
    if (key === "0-0") return [{ id: "gallery-cache", x: 990, y: 640, radius: 84, label: "DORMANT CACHE" }];
    if (key === "1-0") return [{ id: "moon-bridge", x: 600, y: 620, radius: 86, label: "ROOT BRIDGE" }];
    if (key === "0-1") return [{ id: "waterway", x: 960, y: 650, radius: 90, label: "DROWNED SIGIL" }];
    if (key === "1-1") return [{ id: "ash-mirror", x: 360, y: 635, radius: 82, label: "TRY THE LIGHT" }];
    return [];
  };
  const nearestRootlightNode = (radius = 88) => rootlightNodes().reduce((nearest, node) => { const range = distance(player, node); return range < radius && (!nearest || range < nearest.range) ? { node, range } : nearest; }, null)?.node || null;
  const circleRectCollision = (circle, rect) => {
    const x = clamp(circle.x, rect.x, rect.x + rect.w); const y = clamp(circle.y, rect.y, rect.y + rect.h);
    return Math.hypot(circle.x - x, circle.y - y) < circle.radius;
  };
  const collidesWorld = (next) => {
    const obstacles = state.area === "overworld" ? overworldObstacles() : dungeonObstacles();
    if (obstacles.some((rect) => circleRectCollision(next, rect))) return true;
    if (state.area === "overworld" && !state.secretFound && circleRectCollision(next, { x: 1300, y: 720, w: 170, h: 42 })) return true;
    if (state.area === "overworld" && !state.southPassageOpen && circleRectCollision(next, { x: 980, y: 742, w: 180, h: 148 })) return true;
    if (state.area === "dungeon" && state.roomX === 1 && state.roomY === 0 && !state.switches && next.y > ROOM.height - 90) return true;
    if (state.area === "dungeon" && state.roomX === 1 && state.roomY === 1 && !state.ashShortcutOpen && next.x < 90 && next.y < 245) return true;
    return false;
  };
  const collidesEnemyWorld = (next) => collidesWorld(next) || lockedDungeonDoors().some((rect) => circleRectCollision(next, rect));

  const tryMove = (dx, dy) => {
    const nextX = { ...player, x: player.x + dx }; const nextY = { ...player, y: player.y + dy };
    if (!collidesWorld(nextX)) player.x = clamp(nextX.x, player.radius, (state.area === "overworld" ? WORLD.width : ROOM.width) - player.radius);
    if (!collidesWorld(nextY)) player.y = clamp(nextY.y, player.radius, (state.area === "overworld" ? WORLD.height : ROOM.height) - player.radius);
  };
  const moveEntityBy = (entity, dx, dy) => {
    const nextX = { ...entity, x: entity.x + dx }; const nextY = { ...entity, y: entity.y + dy }; const maxX = (state.area === "overworld" ? WORLD.width : ROOM.width) - entity.radius; const maxY = (state.area === "overworld" ? WORLD.height : ROOM.height) - entity.radius;
    if (!collidesEnemyWorld(nextX)) entity.x = clamp(nextX.x, entity.radius, maxX);
    if (!collidesEnemyWorld(nextY)) entity.y = clamp(nextY.y, entity.radius, maxY);
  };

  const pollGamepadInput = () => {
    if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return;
    const pad = Array.from(navigator.getGamepads() || []).find(Boolean);
    if (!pad) { gamepadState.vector = { x: 0, y: 0 }; gamepadState.buttons.clear(); gamepadState.connected = false; return; }
    gamepadState.connected = true;
    const axisX = Math.abs(pad.axes?.[0] || 0) > .2 ? pad.axes[0] : 0; const axisY = Math.abs(pad.axes?.[1] || 0) > .2 ? pad.axes[1] : 0;
    let x = axisX; let y = axisY; const pressed = (index) => Boolean(pad.buttons?.[index]?.pressed || (pad.buttons?.[index]?.value || 0) > .55);
    if (pressed(14)) x -= 1; if (pressed(15)) x += 1; if (pressed(12)) y -= 1; if (pressed(13)) y += 1;
    gamepadState.vector = { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
    const nextButtons = new Set(); for (let index = 0; index < (pad.buttons?.length || 0); index += 1) if (pressed(index)) nextButtons.add(index);
    const newlyPressed = (index) => nextButtons.has(index) && !gamepadState.buttons.has(index);
    if (newlyPressed(0)) {
      if (state.mode === "title") startGame(hasSave());
      else if (state.mode === "paused") togglePause();
      else if (state.mode === "playing") interact();
    }
    if (state.mode === "playing") {
      if (newlyPressed(2)) justPressed.add("j");
      if (newlyPressed(1)) justPressed.add("k");
      if (newlyPressed(3)) useRootlight();
      if (newlyPressed(9)) togglePause();
    }
    gamepadState.buttons = nextButtons;
  };
  const readMoveInput = () => {
    let x = gamepadState.vector.x; let y = gamepadState.vector.y;
    if (keys.has("a") || keys.has("arrowleft")) x -= 1;
    if (keys.has("d") || keys.has("arrowright")) x += 1;
    if (keys.has("w") || keys.has("arrowup")) y -= 1;
    if (keys.has("s") || keys.has("arrowdown")) y += 1;
    return normalized(x, y, 0, 0);
  };
  const swordHitbox = () => {
    const direction = normalized(player.attackDirectionX, player.attackDirectionY, player.facingX, player.facingY);
    const center = { x: player.x + direction.x * 31, y: player.y + direction.y * 31 };
    return { ...center, radius: 46, direction, halfAngle: .88 };
  };
  const beginBossDefeat = (enemy) => {
    if (state.bossDefeatTimer > 0 || state.bossDefeated) return;
    state.bossDefeatTimer = 5.8;
    state.bossDefeatX = enemy.x;
    state.bossDefeatY = enemy.y;
    state.bossPhase = 2;
    state.bossArenaPulse = 2.2;
    state.bossDefeated = true;
    state.reward = true;
    if (!state.bossRewardClaimed) {
      state.bossRewardClaimed = true;
      player.maxHp += 1;
      player.hp = player.maxHp;
      showToast("Heartseed Echo claimed · maximum health increased", 3200);
    }
    playSfx("defeat");
    spawnLeaves(enemy.x, enemy.y, 30);
    spawnCombatSparks(enemy.x, enemy.y, COLORS.gold, null, 18, 190, 11);
    spawnCombatSparks(enemy.x, enemy.y, COLORS.rose, null, 10, 140, 7);
    spawnBossPhaseBreak(enemy);
    particles.push({ x: enemy.x, y: enemy.y, vx: 0, vy: 0, life: 2.4, maxLife: 2.4, size: 28, color: COLORS.rose, kind: "ring", rotation: 0 });
    triggerCombatImpact(enemy.x, enemy.y, COLORS.gold, 1.8);
    camera.shake = Math.max(camera.shake, .3);
    saveData();
    updateHud();
  };
  const attack = () => {
    if (state.mode !== "playing" || state.dialogue || player.dash > 0) return;
    if (player.attackCooldown > 0) { player.attackBuffer = .18; return; }
    const direction = readMoveInput();
    // When the attack key arrives just after movement is released, the input
    // vector is zero and the smoothed facing vector may still be crossing the
    // old direction. Use the remembered target direction so a left run cannot
    // turn into a right-facing swing during that hand-off frame.
    const facing = direction.x || direction.y ? direction : normalized(player.targetFacingX, player.targetFacingY, player.facingX, player.facingY);
    player.attack = .34; player.attackElapsed = 0; player.attackCooldown = .36; player.attackBuffer = 0; player.attackHitRegistered = false;
    // Capture one direction for the entire swing. The body, hitbox, sword
    // sheet, and trail must all agree even if the player changes input during
    // the short attack window. Snap the facing immediately so the first
    // attack frame cannot briefly show the previous direction.
    player.attackDirectionX = facing.x; player.attackDirectionY = facing.y;
    player.facingX = facing.x; player.facingY = facing.y;
    player.targetFacingX = facing.x; player.targetFacingY = facing.y;
    playSfx("attack"); spawnDust(player.x - facing.x * 10, player.y - facing.y * 10, 3, "#d7c594");
  };
  const resolveAttackHit = () => {
    if (player.attackHitRegistered) return;
    player.attackHitRegistered = true;
    const hit = swordHitbox(); const cosHalfAngle = Math.cos(hit.halfAngle); let hitCount = 0;
    enemies.forEach((enemy) => {
      if (enemy.dead) return;
      const offsetX = enemy.x - player.x; const offsetY = enemy.y - player.y; const range = Math.hypot(offsetX, offsetY) || 1;
      const dot = (offsetX / range) * hit.direction.x + (offsetY / range) * hit.direction.y;
      if (distance(hit, enemy) > hit.radius + enemy.radius || dot < cosHalfAngle) return;
      const knockback = enemy.type === "boss" ? 95 : enemy.type === "warden" ? 135 : 190;
      enemy.hp -= 1; enemy.hitFlash = .2; enemy.hitStun = enemy.type === "boss" ? .14 : .22;
      enemy.velocityX = hit.direction.x * knockback; enemy.velocityY = hit.direction.y * knockback;
      enemy.hitDirectionX = hit.direction.x; enemy.hitDirectionY = hit.direction.y; enemy.recoilX = hit.direction.x * (enemy.type === "boss" ? 5 : 9); enemy.recoilY = hit.direction.y * (enemy.type === "boss" ? 5 : 9);
      const impactColor = enemy.type === "boss" ? COLORS.rose : enemy.color;
      triggerCombatImpact(enemy.x, enemy.y, impactColor, enemy.type === "boss" ? 1.3 : .86, hit.direction);
      spawnDust(enemy.x - hit.direction.x * 5, enemy.y + enemy.radius * .62, enemy.type === "boss" ? 4 : 2, enemy.type === "boss" ? "#c79283" : "#c6b38f");
      hitCount += 1;
      if (enemy.hp <= 0) {
        spawnEnemyDeath(enemy);
        if (enemy.encounter === "hidden-cache") { state.optionalGuardDefeated = true; showToast("The grove is safe · the old chest waits beneath the lantern leaves", 2200); saveData(); }
        if (enemy.type === "warden") { state.miniBossDefeated = true; showToast("The Warden yields · the sanctum opens"); saveData(); }
        if (enemy.type === "boss") beginBossDefeat(enemy);
      }
    });
    if (hitCount > 0) playSfx("hit");
    breakables().forEach((object) => {
      if (!object.broken && distance(hit, object) < 38 && ((object.x - player.x) * hit.direction.x + (object.y - player.y) * hit.direction.y) > 0) {
        object.broken = true; playSfx("hit"); spawnLeaves(object.x, object.y, 14); triggerImpact(object.x, object.y, COLORS.moss, .8);
        if (object.id === "root-ivy") { state.secretFound = true; showToast("The old roots part · a blue seam glows at the shrine"); updateObjective(); saveData(); }
        if (object.id === "pond-ivy") { state.southPassageOpen = true; showToast("The reeds fall away · something watches the grove"); spawnHiddenEncounter(); updateObjective(); saveData(); }
        if (object.id === "reed-cache") { state.reedCacheFound = true; state.lanternLens = true; addDiscovery("Dewglass lens recovered"); }
      }
    });
    if (hitCount === 0) { spawnCombatSparks(hit.x, hit.y, COLORS.gold, hit.direction, 2, 68, 4); camera.shake = Math.max(camera.shake, .014); }
  };
  const activateRootlightNode = (node) => {
    if (!node) return false;
    if (!state.rootlightLantern) { showToast("The socket is cold · something brighter must be found", 1500); return true; }
    if (node.id === "ash-mirror") {
      if (!state.rootlightTested) { state.rootlightTested = true; playSfx("cache"); showToast("The ash mirror answers · try the pulse on a marked enemy", 2300); spawnParticle(node.x, node.y, COLORS.gold, 14, 72, "spark"); triggerImpact(node.x, node.y, COLORS.gold, .8); updateObjective(); saveData(); }
      else showToast("The mirror hums in time with your lantern", 1000);
      return true;
    }
    if (node.id === "gallery-cache" && !state.rootlightGalleryOpen) { state.rootlightGalleryOpen = true; playSfx("cache"); showToast("The dead lantern remembers a hidden alcove", 2100); spawnLeaves(node.x, node.y, 12); triggerImpact(node.x, node.y, COLORS.mint, .9); saveData(); updateObjective(); return true; }
    if (node.id === "moon-bridge" && !state.rootlightMoonBridge) { state.rootlightMoonBridge = true; playSfx("cache"); showToast("Moonroot bridge awakened · a shortcut cuts through the hall", 2200); spawnLeaves(node.x, node.y, 18); triggerImpact(node.x, node.y, COLORS.mint, 1); saveData(); updateObjective(); return true; }
    if (node.id === "waterway" && !state.rootlightWaterway) { state.rootlightWaterway = true; playSfx("cache"); showToast("The drowned sigil parts the water · the vault is safe to cross", 2200); spawnParticle(node.x, node.y, COLORS.waterLight, 18, 84, "spark"); triggerImpact(node.x, node.y, COLORS.waterLight, 1); saveData(); updateObjective(); return true; }
    if (node.id === "rootlight-gate" && !state.rootlightGateOpen) { state.rootlightGateOpen = true; playSfx("cache"); showToast("Moonroot gate opened · a hidden path glows beyond the pond", 2300); spawnLeaves(node.x, node.y, 24); triggerImpact(node.x, node.y, COLORS.mint, 1.1); saveData(); updateObjective(); return true; }
    return false;
  };
  const obtainRootlight = () => {
    state.ashCacheOpened = true; state.ashShortcutOpen = true; state.rootlightLantern = true; state.rootlightTested = false; state.loot += 1; state.itemReveal = 3.8; player.rootlightCooldown = 0; player.velocityX = 0; player.velocityY = 0; playSfx("relic"); spawnLeaves(180, 635, 28); spawnParticle(180, 635, COLORS.gold, 24, 120, "spark"); triggerImpact(180, 635, COLORS.gold, 1.45); camera.shake = Math.max(camera.shake, .12); state.pickupPulse = .7; showToast("Moonwake Lantern acquired · press L", 2800); saveData(); updateHud();
  };
  const useRootlight = () => {
    if (state.mode !== "playing" || state.dialogue || state.itemReveal > 0 || !state.rootlightLantern) return;
    if (player.rootlightCooldown > 0) { showToast("The lantern is still gathering moonlight", 750); return; }
    player.rootlightPulse = .7; player.rootlightCooldown = 1.05; player.attack = 0; player.attackHitRegistered = true; playSfx("pulse"); spawnParticle(player.x, player.y, COLORS.gold, 18, 105, "spark"); particles.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: .62, maxLife: .62, size: 24, color: COLORS.mint, kind: "rootlight-ring", rotation: 0 }); camera.shake = Math.max(camera.shake, .05);
    const node = nearestRootlightNode(118); if (node) activateRootlightNode(node);
    let rootlightHit = false;
    enemies.forEach((enemy) => {
      if (enemy.dead || distance(enemy, player) > (enemy.type === "boss" ? 180 : 132)) return;
      enemy.hidden = false; enemy.alerted = true; enemy.hitFlash = .28; enemy.hitStun = enemy.type === "boss" ? .48 : .62; enemy.telegraph = 0; enemy.state = "recover"; enemy.stateTimer = enemy.type === "boss" ? .52 : .34; enemy.attackCooldown = Math.max(enemy.attackCooldown, .72);
      const direction = normalized(enemy.x - player.x, enemy.y - player.y); enemy.velocityX = direction.x * (enemy.type === "boss" ? 125 : 175); enemy.velocityY = direction.y * (enemy.type === "boss" ? 125 : 175); enemy.hitDirectionX = direction.x; enemy.hitDirectionY = direction.y; enemy.recoilX = direction.x * (enemy.type === "boss" ? 6 : 10); enemy.recoilY = direction.y * (enemy.type === "boss" ? 6 : 10); enemy.phaseExposed = enemy.type === "boss" ? .9 : 0; const rootlightDamage = enemy.type === "boss" && enemy.phase === 2 ? 2 : 1; enemy.hp -= rootlightDamage; rootlightHit = true; triggerCombatImpact(enemy.x, enemy.y, COLORS.gold, enemy.type === "boss" ? 1.18 : .72, direction); spawnCombatSparks(enemy.x, enemy.y, COLORS.mint, direction, enemy.type === "boss" ? 4 : 2, 95, 5); if (enemy.type === "boss" && enemy.phase === 2) showToast("Rootlight cracks the guardian's unbound heart", 1500);
      if (enemy.hp <= 0) { spawnEnemyDeath(enemy); if (enemy.type === "warden") { state.miniBossDefeated = true; showToast("Rootlight breaks the Warden's guard", 1800); } if (enemy.type === "boss") beginBossDefeat(enemy); saveData(); }
    });
    if (rootlightHit) playSfx("hit");
  };
  const dash = () => {
    if (state.mode !== "playing" || state.dialogue || player.dashCooldown > 0 || player.hurt > 0) return;
    const direction = readMoveInput(); const facing = direction.x || direction.y ? direction : normalized(player.targetFacingX, player.targetFacingY, player.facingX, player.facingY);
    // A dash is also a facing change. Capture the same vector used for travel
    // so the first dash frame cannot render the previous idle direction.
    player.targetFacingX = facing.x; player.targetFacingY = facing.y; player.facingX = facing.x; player.facingY = facing.y;
    player.dash = .22; player.dashCooldown = .68; player.invulnerable = .25; player.dashDirectionX = facing.x; player.dashDirectionY = facing.y; player.attack = 0; player.attackHitRegistered = true;
    playSfx("dash"); player.velocityX = facing.x * 470; player.velocityY = facing.y * 470; spawnDust(player.x, player.y + 10, 8, "#b6c7b1"); spawnParticle(player.x, player.y, COLORS.mint, 10, 75, "spark"); camera.shake = Math.max(camera.shake, .035);
  };

  const hurtPlayer = (amount, source, impactColor = COLORS.rose) => {
    if (player.invulnerable > 0 || player.hurt > 0 || state.mode !== "playing") return;
    player.hp = Math.max(0, player.hp - amount); player.hurt = .24; player.invulnerable = .72; player.attack = 0; player.attackCooldown = .18; state.hitStop = Math.max(state.hitStop, .07); playSfx("hurt");
    const direction = normalized(player.x - source.x, player.y - source.y, -player.facingX, -player.facingY);
    player.velocityX = direction.x * 235; player.velocityY = direction.y * 235; camera.shake = Math.max(camera.shake, .13);
    triggerCombatImpact(player.x, player.y, impactColor, 1.18, direction); spawnDust(player.x, player.y + 12, 4, "#b78f83"); updateHud();
    if (player.hp <= 0) { state.mode = "dead"; hideScreens(); ui.title.classList.remove("hidden"); ui.title.querySelector(".screen-kicker").textContent = "THE LANTERN WENT OUT"; ui.title.querySelector("h2").textContent = "The roots took you"; ui.title.querySelector("p:not(.screen-kicker)").textContent = "Start again at the outpost. The shrine will still be waiting."; document.getElementById("new-game").textContent = "Restart"; document.getElementById("continue-game").classList.add("hidden"); updateHud(); }
  };

  const breakables = () => state.area === "overworld" ? [
    { id: "root-ivy", x: 1360, y: 740, broken: state.secretFound, secret: true },
    { id: "pond-ivy", x: 1005, y: 744, broken: state.southPassageOpen, secret: true },
    { id: "reed-cache", x: 1260, y: 760, broken: state.reedCacheFound, secret: false }
  ] : [];
  const interact = () => {
    if (state.mode !== "playing") return;
    if (state.dialogue) { advanceDialogue(); return; }
    if (state.area === "overworld") {
      const npc = nearestNpc(); if (npc) { talkToNpc(npc); return; }
      const rootNode = nearestRootlightNode(72); if (rootNode && !state.rootlightLantern) { activateRootlightNode(rootNode); return; }
      if (!STARTER_MODE && distance(player, { x: 1350, y: 235 }) < 120) { enterDungeon(); return; }
      if (distance(player, { x: 1240, y: 745 }) < 70 && !state.chestOpened) { state.chestOpened = true; state.key = true; state.chestOpening = .44; state.chestOpenX = 1240; state.chestOpenY = 745; state.pickupPulse = .7; playSfx("chest"); spawnLeaves(1240, 745, 18); showToast("You found an old brass key"); saveData(); updateHud(); return; }
      if (distance(player, { x: 1450, y: 665 }) < 78 && state.rootlightGateOpen && !state.rootlightCacheOpened) { state.rootlightCacheOpened = true; state.loot += 1; state.chestOpening = .44; state.chestOpenX = 1450; state.chestOpenY = 665; state.pickupPulse = .7; playSfx("cache"); spawnLeaves(1450, 665, 20); triggerImpact(1450, 665, COLORS.gold, 1.1); showToast("Moonroot cache found · the old road has more secrets", 2200); saveData(); updateHud(); return; }
      if (distance(player, { x: 1060, y: 830 }) < 70 && state.southPassageOpen && !state.hiddenChestOpened && !enemies.some((enemy) => enemy.encounter === "hidden-cache" && !enemy.dead)) {
        state.hiddenChestOpened = true; state.lanternSeed = true; player.maxHp = 6 + (state.heartChestOpened ? 1 : 0) + 1; player.hp = player.maxHp; state.discoveries = Math.min(state.discoveryTotal, (state.discoveries || 0) + 1); state.chestOpening = .44; state.chestOpenX = 1060; state.chestOpenY = 830; state.pickupPulse = .7; playSfx("relic"); spawnLeaves(1060, 830, 24); triggerImpact(1060, 830, COLORS.gold, 1.2); showToast(`Lantern seed found · maximum health increased · discovery ${state.discoveries}/${state.discoveryTotal}`, 2600); saveData(); updateHud(); return;
      }
    } else {
      const key = `${state.roomX}-${state.roomY}`;
      const rootNode = nearestRootlightNode(72); if (rootNode && !state.rootlightLantern) { activateRootlightNode(rootNode); return; }
      if (key === "0-0" && distance(player, { x: 600, y: 390 }) < 80 && !state.chestOpened) { state.chestOpened = true; state.key = true; state.chestOpening = .44; state.chestOpenX = 600; state.chestOpenY = 390; state.pickupPulse = .7; playSfx("chest"); showToast("Brass key acquired"); spawnLeaves(600, 390, 20); saveData(); updateHud(); return; }
      if (key === "1-0" && distance(player, { x: 600, y: 380 }) < 80 && !state.switches) { state.switches = true; playSfx("door"); state.pickupPulse = .45; showToast("The moon switch unlocks the lower gate"); spawnLeaves(600, 380, 20); saveData(); updateHud(); return; }
      if (key === "0-1" && distance(player, { x: 600, y: 390 }) < 80 && !state.heartChestOpened) { state.heartChestOpened = true; player.maxHp += 1; player.hp = player.maxHp; state.chestOpening = .44; state.chestOpenX = 600; state.chestOpenY = 390; state.pickupPulse = .7; playSfx("relic"); showToast("Heartseed shard · maximum health increased"); saveData(); updateHud(); return; }
      if (key === "0-0" && state.rootlightGalleryOpen && distance(player, { x: 990, y: 640 }) < 88 && !state.rootlightGalleryCacheOpened) { state.rootlightGalleryCacheOpened = true; state.loot += 1; state.chestOpening = .44; state.chestOpenX = 990; state.chestOpenY = 640; state.pickupPulse = .7; playSfx("cache"); spawnLeaves(990, 640, 20); triggerImpact(990, 640, COLORS.gold, 1.1); showToast("Gallery cache found · the lantern reveals what stone forgot", 2200); saveData(); updateHud(); return; }
      if (key === "1-1" && distance(player, { x: 180, y: 635 }) < 92 && !state.ashCacheOpened) { obtainRootlight(); return; }
      if (key === "2-1" && state.bossDefeated && distance(player, { x: 600, y: 150 }) < 100) { showVictory(); return; }
    }
    showToast("Nothing within reach · move closer to a glow or nameplate", 1200);
  };

  const enterDungeon = () => { if (STARTER_MODE) return; playSfx("door"); state.area = "dungeon"; state.roomX = 0; state.roomY = 0; player.x = ROOM.width / 2; player.y = ROOM.height - 100; startArea("dungeon"); saveData(); updateObjective(); };
  const transitionDungeon = (dx, dy) => {
    const from = `${state.roomX}-${state.roomY}`; const targetX = state.roomX + dx; const targetY = state.roomY + dy;
    if (from === "0-0" && dy < 0 || from === "0-1" && dy > 0) { if (from === "0-1") { state.area = "overworld"; startArea("overworld"); return; } }
    if (targetX < 0 || targetX > 2 || targetY < 0 || targetY > 1) return;
    if (from === "0-0" && dx > 0 && !state.key) { showToast("A brass lock holds the east door — search beneath the shrine glyph"); return; }
    if (from === "1-0" && dy > 0 && !state.switches) { showToast("The moon switch is still dark"); return; }
    if (from === "1-1" && dx < 0 && !state.ashShortcutOpen) { showToast("Sootglass seals the flooded vault — search the broken wall"); return; }
    if (from === "1-1" && dx > 0 && !state.key) { showToast("A brass keyhole bars this door"); return; }
    if (from === "1-1" && dx > 0 && state.key && !state.miniBossDefeated) { showToast("The Root Warden must fall before this shortcut opens"); return; }
    if (from === "2-0" && dy > 0 && !state.miniBossDefeated) { showToast("The Warden still guards the lower gate"); return; }
    playSfx("door"); state.roomX = targetX; state.roomY = targetY; const entryX = dx > 0 ? 80 : dx < 0 ? ROOM.width - 80 : ROOM.width / 2; const entryY = dy > 0 ? 80 : dy < 0 ? ROOM.height - 80 : ROOM.height / 2; state.transitionCooldown = .5; startArea("dungeon"); player.x = entryX; player.y = entryY; resetPlayerMotion(); saveData(); updateObjective();
  };

  const enemyMove = (enemy, dx, dy, speed, dt) => { const direction = normalized(dx, dy, 0, 0); moveEntityBy(enemy, direction.x * speed * dt, direction.y * speed * dt); };
  const updateEnemyPresentation = (enemy, dt) => {
    const dx = enemy.x - enemy.presentationPrevX; const dy = enemy.y - enemy.presentationPrevY; const distanceMoved = Math.hypot(dx, dy); const speed = distanceMoved / Math.max(dt, .001);
    enemy.motionSpeed = speed; enemy.animTime += dt; enemy.walk += dt * (speed > 5 ? 5.5 + Math.min(5, speed * .018) : .9);
    if (speed > 5) { enemy.facingX = dx / Math.max(distanceMoved, .001); enemy.facingY = dy / Math.max(distanceMoved, .001); }
    enemy.presentationPrevX = enemy.x; enemy.presentationPrevY = enemy.y;
  };
  const beginEnemyTelegraph = (enemy, type, duration) => { enemy.state = type; enemy.stateTimer = duration; enemy.telegraph = duration; enemy.telegraphType = type; spawnParticle(enemy.x, enemy.y, type === "rangedWindup" ? COLORS.wisp : COLORS.gold, 3, 24, "spark"); };
  const resolveEnemyMelee = (enemy, reach = 10, damage = enemy.damage) => { if (distance(enemy, player) < enemy.radius + player.radius + reach) { hurtPlayer(damage, enemy, enemy.color); return true; } return false; };
  const fireWispBolt = (enemy) => {
    const direction = normalized(enemy.aimX, enemy.aimY, player.x - enemy.x, player.y - enemy.y);
    projectiles.push({ owner: "enemy", kind: "moonbolt", x: enemy.x, y: enemy.y, vx: direction.x * 165, vy: direction.y * 165, life: 2.5, radius: 7, color: COLORS.wisp, damage: enemy.damage });
    spawnCombatSparks(enemy.x, enemy.y, COLORS.wisp, direction, 4, 70, 5);
  };
  const fireBossVolley = (enemy) => {
    const count = enemy.phase === 2 ? 5 : 3; const center = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    for (let i = 0; i < count; i += 1) { const angle = center + (i - (count - 1) / 2) * .22; projectiles.push({ owner: "enemy", bossAttack: true, phase: enemy.phase, kind: "rosebolt", x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 125, vy: Math.sin(angle) * 125, life: 2.4, radius: 7, color: enemy.phase === 2 ? COLORS.rose : COLORS.gold, damage: enemy.damage }); }
    spawnCombatSparks(enemy.x, enemy.y, enemy.phase === 2 ? COLORS.rose : COLORS.gold, { x: Math.cos(center), y: Math.sin(center) }, enemy.phase === 2 ? 7 : 5, 86, 6);
  };
  const fireBossSlam = (enemy) => {
    const count = enemy.phase === 2 ? 12 : 8; const offset = enemy.phase === 2 ? Math.PI / 12 : 0;
    for (let i = 0; i < count; i += 1) { const angle = offset + i * Math.PI * 2 / count; projectiles.push({ owner: "enemy", bossAttack: true, phase: enemy.phase, kind: "shockwave", x: enemy.x, y: enemy.y, vx: Math.cos(angle) * (enemy.phase === 2 ? 145 : 118), vy: Math.sin(angle) * (enemy.phase === 2 ? 145 : 118), life: 2.1, radius: 8, color: enemy.phase === 2 ? COLORS.rose : COLORS.gold, damage: 1 }); }
    const impactColor = enemy.phase === 2 ? COLORS.rose : COLORS.gold;
    state.bossArenaPulse = .9; spawnCombatSparks(enemy.x, enemy.y, impactColor, null, enemy.phase === 2 ? 12 : 8, enemy.phase === 2 ? 180 : 145, 9);
    particles.push({ x: enemy.x, y: enemy.y, vx: 0, vy: 0, life: enemy.phase === 2 ? .62 : .48, maxLife: enemy.phase === 2 ? .62 : .48, size: enemy.phase === 2 ? 58 : 48, color: impactColor, kind: "boss-slam-ring", rotation: 0 });
    camera.shake = Math.max(camera.shake, enemy.phase === 2 ? .18 : .1);
  };
  const fireBossRootRain = (enemy) => {
    const count = enemy.phase === 2 ? 6 : 3; const center = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    for (let i = 0; i < count; i += 1) { const angle = center + (i - (count - 1) / 2) * .3; projectiles.push({ owner: "enemy", bossAttack: true, phase: enemy.phase, kind: "root-lance", x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 175, vy: Math.sin(angle) * 175, life: 2.3, radius: 9, color: COLORS.mint, damage: 1 }); }
    spawnLeaves(enemy.x, enemy.y, enemy.phase === 2 ? 14 : 8); spawnCombatSparks(enemy.x, enemy.y, COLORS.mint, { x: Math.cos(center), y: Math.sin(center) }, enemy.phase === 2 ? 8 : 5, 108, 6);
  };
  const updateEnemyIdle = (enemy, dt) => {
    enemy.stateTimer -= dt; enemy.orbit += dt * .35;
    const guardRadius = enemy.guardRadius || 30; const targetX = enemy.homeX + Math.cos(enemy.orbit) * Math.min(guardRadius, 28); const targetY = enemy.homeY + Math.sin(enemy.orbit * .8) * Math.min(guardRadius, 18);
    const blend = Math.min(1, dt * 1.5); moveEntityBy(enemy, (targetX - enemy.x) * blend, (targetY - enemy.y) * blend);
    if (enemy.stateTimer <= 0) enemy.stateTimer = rand(1.2, 2.8);
  };
  const updateSkirmisher = (enemy, dist, dt) => {
    if (enemy.state === "meleeWindup") { enemy.stateTimer -= dt; if (enemy.stateTimer <= 0) { resolveEnemyMelee(enemy, 9); enemy.attackCooldown = enemy.attackRate; enemy.state = "recover"; enemy.stateTimer = .24; enemy.telegraph = 0; } return; }
    if (enemy.state === "recover") { enemy.stateTimer -= dt; if (enemy.stateTimer <= 0) enemy.state = "chase"; return; }
    if (dist < enemy.attackRange + player.radius + 8 && enemy.attackCooldown <= 0) { beginEnemyTelegraph(enemy, "meleeWindup", .24); return; }
    if (dist < 260) { enemy.state = "chase"; enemyMove(enemy, player.x - enemy.x, player.y - enemy.y, enemy.speed, dt); }
    else updateEnemyIdle(enemy, dt);
  };
  const updateCharger = (enemy, dist, dt) => {
    if (enemy.state === "chargeWindup") { enemy.stateTimer -= dt; if (enemy.stateTimer <= 0) { const direction = normalized(player.x - enemy.x, player.y - enemy.y); enemy.chargeX = direction.x; enemy.chargeY = direction.y; enemy.state = "charging"; enemy.stateTimer = .38; enemy.telegraph = 0; enemy.velocityX = direction.x * 300; enemy.velocityY = direction.y * 300; spawnDust(enemy.x, enemy.y + 10, 8, "#d6a16f"); } return; }
    if (enemy.state === "charging") { enemy.stateTimer -= dt; if (distance(enemy, player) < enemy.radius + player.radius + 12) { hurtPlayer(enemy.damage, enemy, COLORS.thorn); enemy.state = "recover"; enemy.stateTimer = .55; enemy.velocityX = 0; enemy.velocityY = 0; enemy.attackCooldown = enemy.attackRate; } else if (enemy.stateTimer <= 0) { enemy.state = "recover"; enemy.stateTimer = .45; enemy.velocityX = 0; enemy.velocityY = 0; enemy.attackCooldown = enemy.attackRate; } return; }
    if (enemy.state === "recover") { enemy.stateTimer -= dt; if (enemy.stateTimer <= 0) enemy.state = "chase"; return; }
    if (dist < enemy.detectionRange && enemy.attackCooldown <= 0) { const direction = normalized(player.x - enemy.x, player.y - enemy.y); enemy.chargeX = direction.x; enemy.chargeY = direction.y; beginEnemyTelegraph(enemy, "chargeWindup", .68); return; }
    if (dist < 320) enemyMove(enemy, player.x - enemy.x, player.y - enemy.y, enemy.speed, dt); else updateEnemyIdle(enemy, dt);
  };
  const updateRanged = (enemy, dist, dt) => {
    if (enemy.state === "rangedWindup") { enemy.stateTimer -= dt; if (enemy.stateTimer <= 0) { fireWispBolt(enemy); enemy.attackCooldown = enemy.attackRate; enemy.state = "recover"; enemy.stateTimer = .22; enemy.telegraph = 0; } return; }
    if (enemy.state === "recover") { enemy.stateTimer -= dt; if (enemy.stateTimer <= 0) enemy.state = "orbit"; return; }
    enemy.orbit += dt * .7;
    if (dist < 145) enemyMove(enemy, enemy.x - player.x, enemy.y - player.y, enemy.speed * 1.35, dt);
    else if (dist > 260) enemyMove(enemy, player.x - enemy.x, player.y - enemy.y, enemy.speed, dt);
    else { const tangent = { x: -(player.y - enemy.y), y: player.x - enemy.x }; enemyMove(enemy, tangent.x, tangent.y, enemy.speed * .6, dt); }
    if (dist < enemy.detectionRange && enemy.attackCooldown <= 0) { enemy.aimX = player.x - enemy.x; enemy.aimY = player.y - enemy.y; beginEnemyTelegraph(enemy, "rangedWindup", .48); }
  };
  const updateAmbusher = (enemy, dist, dt) => {
    if (enemy.state === "ambushWindup") { enemy.stateTimer -= dt; if (enemy.stateTimer <= 0) { const direction = normalized(player.x - enemy.x, player.y - enemy.y); enemy.chargeX = direction.x; enemy.chargeY = direction.y; enemy.state = "pounce"; enemy.stateTimer = .3; enemy.telegraph = 0; enemy.velocityX = direction.x * 235; enemy.velocityY = direction.y * 235; } return; }
    if (enemy.state === "pounce") { enemy.stateTimer -= dt; if (distance(enemy, player) < enemy.radius + player.radius + 10) { hurtPlayer(enemy.damage, enemy, COLORS.moth); enemy.state = "retreat"; enemy.stateTimer = .7; enemy.attackCooldown = enemy.attackRate; } else if (enemy.stateTimer <= 0) { enemy.state = "retreat"; enemy.stateTimer = .55; enemy.attackCooldown = enemy.attackRate; } return; }
    if (enemy.state === "retreat") { enemy.stateTimer -= dt; enemyMove(enemy, enemy.x - player.x, enemy.y - player.y, enemy.speed * 1.5, dt); if (enemy.stateTimer <= 0 && dist > 150) { enemy.state = "idle"; enemy.alerted = false; enemy.hidden = true; enemy.stateTimer = 1.4; } return; }
    if (!enemy.alerted && dist < enemy.detectionRange) { enemy.alerted = true; enemy.hidden = false; enemy.state = "ambushWindup"; enemy.stateTimer = .42; enemy.telegraph = .42; enemy.telegraphType = "ambushWindup"; spawnLeaves(enemy.x, enemy.y, 8); spawnParticle(enemy.x, enemy.y, COLORS.moth, 8, 45, "spark"); return; }
    if (enemy.alerted && dist < enemy.detectionRange && enemy.attackCooldown <= 0) { enemy.state = "ambushWindup"; enemy.stateTimer = .42; enemy.telegraph = .42; }
    else if (!enemy.alerted) updateEnemyIdle(enemy, dt);
  };
  const updateWarden = (enemy, dist, dt) => {
    if (enemy.state === "meleeWindup") { enemy.stateTimer -= dt; if (enemy.stateTimer <= 0) { resolveEnemyMelee(enemy, 14, enemy.damage); enemy.attackCooldown = enemy.attackRate; enemy.state = "recover"; enemy.stateTimer = .35; enemy.telegraph = 0; } return; }
    if (dist < enemy.attackRange + player.radius + 12 && enemy.attackCooldown <= 0) { beginEnemyTelegraph(enemy, "meleeWindup", .38); return; }
    if (dist < enemy.detectionRange) enemyMove(enemy, player.x - enemy.x, player.y - enemy.y, enemy.speed, dt); else updateEnemyIdle(enemy, dt);
  };
  const spawnBossPhaseBreak = (enemy) => {
    for (let i = 0; i < 14; i += 1) { const angle = i * Math.PI * 2 / 14 + .12; const speed = 70 + (i % 4) * 20; particles.push({ x: enemy.x + Math.cos(angle) * 12, y: enemy.y + Math.sin(angle) * 12, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 18, life: .95 + (i % 3) * .12, maxLife: 1.19, size: 7 + (i % 3) * 2, color: i % 2 ? COLORS.rose : COLORS.gold, kind: "boss-phase-shard", rotation: angle }); }
    spawnDust(enemy.x, enemy.y + 18, 16, "#8a526f");
  };
  const updateBoss = (enemy, dist, dt) => {
    const desiredPhase = enemy.hp <= enemy.maxHp / 2 ? 2 : 1;
    if (desiredPhase !== enemy.phase) { enemy.phase = desiredPhase; state.bossPhase = desiredPhase; state.bossPhaseShift = 1.85; state.bossArenaPulse = 1.85; enemy.state = "phaseShift"; enemy.stateTimer = .2; enemy.telegraph = 0; enemy.attackCooldown = 1.1; playSfx("phase"); camera.shake = Math.max(camera.shake, .24); spawnLeaves(enemy.x, enemy.y, 22); spawnCombatSparks(enemy.x, enemy.y, COLORS.rose, null, 14, 180, 9); spawnBossPhaseBreak(enemy); particles.push({ x: enemy.x, y: enemy.y, vx: 0, vy: 0, life: 1.05, maxLife: 1.05, size: 64, color: COLORS.rose, kind: "boss-slam-ring", rotation: 0, phasePulse: true }); return; }
    state.bossPhase = enemy.phase; enemy.orbit += dt * (enemy.phase === 2 ? 1.7 : .8);
    if (enemy.state === "phaseShift") { enemy.stateTimer -= dt; if (enemy.stateTimer <= 0) enemy.state = "orbit"; return; }
    if (enemy.state === "bossWindup" || enemy.state === "bossSlamWindup" || enemy.state === "bossRainWindup" || enemy.state === "bossDashWindup") { enemy.stateTimer -= dt; if (enemy.stateTimer <= 0) { if (enemy.state === "bossWindup") fireBossVolley(enemy); else if (enemy.state === "bossSlamWindup") fireBossSlam(enemy); else if (enemy.state === "bossRainWindup") fireBossRootRain(enemy); else { const direction = normalized(player.x - enemy.x, player.y - enemy.y); enemy.chargeX = direction.x; enemy.chargeY = direction.y; enemy.velocityX = 0; enemy.velocityY = 0; enemy.state = "bossDashing"; enemy.stateTimer = enemy.phase === 2 ? .58 : .46; spawnDust(enemy.x, enemy.y + 18, 15, enemy.phase === 2 ? "#d66b92" : "#bd8c72"); } enemy.attackCooldown = enemy.phase === 2 ? .62 : 1.05; enemy.telegraph = 0; } return; }
    if (enemy.state === "bossDashing") { enemy.stateTimer -= dt; const dashSpeed = enemy.phase === 2 ? 420 : 340; moveEntityBy(enemy, enemy.chargeX * dashSpeed * dt, enemy.chargeY * dashSpeed * dt); if (distance(enemy, player) < enemy.radius + player.radius + 16) hurtPlayer(enemy.damage, enemy, COLORS.rose); if (enemy.stateTimer <= 0) { enemy.state = "bossRecover"; enemy.stateTimer = enemy.phase === 2 ? .34 : .5; enemy.velocityX = 0; enemy.velocityY = 0; } return; }
    if (enemy.state === "bossRecover") { enemy.stateTimer -= dt; if (enemy.stateTimer <= 0) enemy.state = "orbit"; return; }
    if (dist > 185) moveEntityBy(enemy, Math.cos(enemy.orbit) * enemy.speed * dt, Math.sin(enemy.orbit) * enemy.speed * dt);
    else { const tangent = { x: -(player.y - enemy.y), y: player.x - enemy.x }; enemyMove(enemy, tangent.x, tangent.y, enemy.phase === 2 ? enemy.speed * 1.1 : enemy.speed * .7, dt); }
    if (dist < enemy.detectionRange && enemy.attackCooldown <= 0) {
      const patternCount = enemy.phase === 2 ? 4 : 3; const pattern = enemy.attackPattern % patternCount; enemy.attackPattern += 1;
      if (pattern === 0) beginEnemyTelegraph(enemy, "bossWindup", enemy.phase === 2 ? .48 : .68);
      else if (pattern === 1) beginEnemyTelegraph(enemy, "bossSlamWindup", enemy.phase === 2 ? .7 : .86);
      else if (pattern === 2) beginEnemyTelegraph(enemy, "bossDashWindup", enemy.phase === 2 ? .52 : .72);
      else beginEnemyTelegraph(enemy, "bossRainWindup", .72);
    }
  };
  const updateEnemies = (dt) => {
    if (state.spawnGrace > 0) return;
    enemies.forEach((enemy) => {
      if (enemy.dead) return;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt); enemy.hitStun = Math.max(0, enemy.hitStun - dt); enemy.phaseExposed = Math.max(0, (enemy.phaseExposed || 0) - dt); enemy.attackCooldown -= dt; enemy.telegraph = Math.max(0, enemy.telegraph - dt);
      enemy.recoilX = moveToward(enemy.recoilX || 0, 0, 72 * dt); enemy.recoilY = moveToward(enemy.recoilY || 0, 0, 72 * dt);
      if (enemy.hitStun > 0) { moveEntityBy(enemy, enemy.velocityX * dt, enemy.velocityY * dt); enemy.velocityX = moveToward(enemy.velocityX, 0, 760 * dt); enemy.velocityY = moveToward(enemy.velocityY, 0, 760 * dt); updateEnemyPresentation(enemy, dt); return; }
      const dist = distance(enemy, player);
      if (!enemy.alerted && enemy.behavior !== "ambush" && dist <= enemy.detectionRange) { enemy.alerted = true; enemy.state = "alert"; enemy.stateTimer = .16; spawnParticle(enemy.x, enemy.y, enemy.color, 4, 28, "spark"); if (enemy.group) enemies.forEach((ally) => { if (ally.group === enemy.group && distance(enemy, ally) < 175) ally.alerted = true; }); }
      if (enemy.state === "alert") { enemy.stateTimer -= dt; if (enemy.stateTimer <= 0) enemy.state = enemy.behavior === "ranged" ? "orbit" : "chase"; return; }
      if (enemy.behavior === "skirmish") updateSkirmisher(enemy, dist, dt);
      else if (enemy.behavior === "charger") updateCharger(enemy, dist, dt);
      else if (enemy.behavior === "ranged") updateRanged(enemy, dist, dt);
      else if (enemy.behavior === "ambush") updateAmbusher(enemy, dist, dt);
      else if (enemy.behavior === "warden") updateWarden(enemy, dist, dt);
      else updateBoss(enemy, dist, dt);
      enemy.velocityX = moveToward(enemy.velocityX, 0, 820 * dt); enemy.velocityY = moveToward(enemy.velocityY, 0, 820 * dt);
      moveEntityBy(enemy, enemy.velocityX * dt, enemy.velocityY * dt); updateEnemyPresentation(enemy, dt);
    });
    enemies = enemies.filter((enemy) => !enemy.dead || enemy.deathTimer > 0);
    const maxX = state.area === "overworld" ? WORLD.width : ROOM.width; const maxY = state.area === "overworld" ? WORLD.height : ROOM.height;
    projectiles = projectiles.filter((projectile) => { projectile.x += projectile.vx * dt; projectile.y += projectile.vy * dt; projectile.life -= dt; if (collidesWorld({ ...projectile, radius: projectile.radius })) { spawnProjectileImpact(projectile); return false; } if (distance(projectile, player) < projectile.radius + player.radius) { spawnProjectileImpact(projectile); hurtPlayer(projectile.damage || 1, projectile); return false; } return projectile.life > 0 && projectile.x > 0 && projectile.y > 0 && projectile.x < maxX && projectile.y < maxY; });
  };

  const updatePlayer = (dt) => {
    player.attackCooldown = Math.max(0, player.attackCooldown - dt); player.attackBuffer = Math.max(0, player.attackBuffer - dt); player.dashCooldown = Math.max(0, player.dashCooldown - dt); player.rootlightCooldown = Math.max(0, player.rootlightCooldown - dt); player.rootlightPulse = Math.max(0, player.rootlightPulse - dt); player.invulnerable = Math.max(0, player.invulnerable - dt); player.hurt = Math.max(0, player.hurt - dt); state.transitionCooldown = Math.max(0, state.transitionCooldown - dt);
    if (justPressed.has("j") || justPressed.has(" ")) attack(); if (justPressed.has("k")) dash();
    if (player.attackBuffer > 0 && player.attackCooldown <= 0) attack();
    const input = readMoveInput(); const hasInput = input.x || input.y;
    // Do not let held movement rewrite the direction of an active swing. The
    // next movement frame after recovery will update the target naturally.
    if (hasInput && player.attack <= 0 && player.dash <= 0) { player.targetFacingX = input.x; player.targetFacingY = input.y; }
    const facingBlend = 1 - Math.pow(.0005, dt);
    player.facingX = moveToward(player.facingX, player.targetFacingX, facingBlend); player.facingY = moveToward(player.facingY, player.targetFacingY, facingBlend);
    const facingLength = Math.hypot(player.facingX, player.facingY) || 1; player.facingX /= facingLength; player.facingY /= facingLength;
    player.animTime += dt;
    if (player.dash > 0) {
      player.visualState = "dash"; player.dash -= dt; tryMove(player.velocityX * dt, player.velocityY * dt); player.velocityX = player.dashDirectionX * 470; player.velocityY = player.dashDirectionY * 470;
      if (Math.random() < .6) spawnDust(player.x, player.y + 12, 1, "#b6c7b1");
    } else {
      const attackMovement = player.attack > 0 ? .52 : 1; const maxSpeed = 185 * attackMovement; const acceleration = hasInput ? 1380 : 1840;
      const desiredX = hasInput ? input.x * maxSpeed : 0; const desiredY = hasInput ? input.y * maxSpeed : 0;
      player.velocityX = moveToward(player.velocityX, desiredX, acceleration * dt); player.velocityY = moveToward(player.velocityY, desiredY, acceleration * dt);
      if (player.hurt > 0) { player.velocityX = moveToward(player.velocityX, 0, 650 * dt); player.velocityY = moveToward(player.velocityY, 0, 650 * dt); }
      tryMove(player.velocityX * dt, player.velocityY * dt);
      const speed = Math.hypot(player.velocityX, player.velocityY);
      if (speed > 10) { player.walk += dt * (7 + speed * .02); if (Math.random() < .08) spawnDust(player.x, player.y + 12, 1); }
      player.visualState = player.hurt > 0 ? "hurt" : player.attack > 0 ? "attack" : speed > 10 ? "move" : "idle";
    }
    if (player.attack > 0) {
      player.attackElapsed += dt; player.attack = Math.max(0, player.attack - dt);
      if (player.attackElapsed >= .075 && !player.attackHitRegistered) resolveAttackHit();
    }
    // If the player held a new direction during the swing, apply it on the
    // recovery frame before switching back to the movement pose. This avoids
    // one stale-facing frame when attack input and movement overlap.
    if (player.attack <= 0 && hasInput && player.dash <= 0) { player.targetFacingX = input.x; player.targetFacingY = input.y; }
    if (player.attack <= 0 && player.visualState === "attack") player.visualState = hasInput ? "move" : "idle";
    player.velocityX = moveToward(player.velocityX, 0, player.dash > 0 ? 0 : 660 * dt); player.velocityY = moveToward(player.velocityY, 0, player.dash > 0 ? 0 : 660 * dt);
  };

  const updateDungeonHazards = () => {
    if (state.area !== "dungeon" || state.hazardCooldown > 0 || player.invulnerable > 0) return;
    const hazard = dungeonHazards().find((rect) => circleRectCollision(player, rect));
    if (!hazard) return;
    state.hazardCooldown = .72;
    const source = { x: player.x - player.facingX * 20, y: player.y - player.facingY * 20 };
    hurtPlayer(hazard.damage, source);
    spawnParticle(player.x, player.y, hazard.color, 7, 65, hazard.label === "deep water" ? "spark" : "impact");
    showToast(hazard.label === "deep water" ? "The flooded vault bites at your boots" : "Ash vents flare — keep moving", 900);
  };

  const update = (dt) => {
    // Pause and end screens must freeze timers, hazards, particles, and boss sequences.
    pollGamepadInput();
    if (state.mode !== "playing") return;
    if (state.hitStop > 0) { state.hitStop = Math.max(0, state.hitStop - dt); camera.shake = Math.max(0, camera.shake - dt * 1.8); updateCamera(dt); justPressed.clear(); return; }
    if (state.toastTimer > 0) { state.toastTimer -= dt * 1000; if (state.toastTimer <= 0) ui.toast.classList.remove("visible"); }
    const bossDefeatWasRunning = state.bossDefeatTimer > 0; state.visualClock += dt; state.impactFlash = Math.max(0, state.impactFlash - dt); state.pickupPulse = Math.max(0, (state.pickupPulse || 0) - dt); state.chestOpening = Math.max(0, (state.chestOpening || 0) - dt); camera.shake = Math.max(0, camera.shake - dt * 1.8); state.spawnGrace = Math.max(0, (state.spawnGrace || 0) - dt); state.dungeonIntro = Math.max(0, (state.dungeonIntro || 0) - dt); state.roomTransition = Math.max(0, (state.roomTransition || 0) - dt); state.hazardCooldown = Math.max(0, (state.hazardCooldown || 0) - dt); state.itemReveal = Math.max(0, (state.itemReveal || 0) - dt); state.bossEntrance = Math.max(0, (state.bossEntrance || 0) - dt); state.bossPhaseShift = Math.max(0, (state.bossPhaseShift || 0) - dt); state.bossArenaPulse = Math.max(0, (state.bossArenaPulse || 0) - dt); state.bossDefeatTimer = Math.max(0, (state.bossDefeatTimer || 0) - dt);
    if (bossDefeatWasRunning && state.bossDefeatTimer <= 0 && state.mode === "playing") { playSfx("victory"); showVictory(); }
    if (state.area === "overworld") leaves.forEach((leaf) => { leaf.y += leaf.speed * dt; leaf.x += Math.sin(leaf.phase + leaf.y * .01) * dt * 3; if (leaf.y > WORLD.height + 20) leaf.y = -10; });
    particles = particles.filter((particle) => { particle.life -= dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 45 * dt; return particle.life > 0; });
    updateEnvironment(dt);
    updateNpcs(dt);
    if (state.dialogue) { updateDialogue(dt); justPressed.clear(); updateCamera(dt); return; }
    if (state.mode !== "playing") return;
    if (state.itemReveal > 0 || state.roomTransition > 0 || state.bossEntrance > 0 || state.bossPhaseShift > 0 || state.bossDefeatTimer > 0) { updateCamera(dt); justPressed.clear(); updateHud(); return; }
    updatePlayer(dt); updateDungeonHazards(); updateEnemies(dt); updateDrops(dt);
    if (state.area === "dungeon" && state.transitionCooldown <= 0) {
      if (player.x < 42) transitionDungeon(-1, 0); else if (player.x > ROOM.width - 42) transitionDungeon(1, 0); else if (player.y < 42) transitionDungeon(0, -1); else if (player.y > ROOM.height - 42) transitionDungeon(0, 1);
    }
    state.lastSave += dt; if (state.lastSave > 8) saveData();
    updateCamera(dt);
    justPressed.clear(); updateHud();
  };

  const updateCamera = (dt) => { const maxX = (state.area === "overworld" ? WORLD.width : ROOM.width) - WIDTH; const maxY = (state.area === "overworld" ? WORLD.height : ROOM.height) - HEIGHT; const lookAheadX = clamp(player.velocityX * .16, -42, 42); const lookAheadY = clamp(player.velocityY * .12, -30, 30); const targetX = clamp(player.x + lookAheadX - WIDTH / 2, 0, Math.max(0, maxX)); const targetY = clamp(player.y + lookAheadY - HEIGHT / 2, 0, Math.max(0, maxY)); const smoothing = 1 - Math.pow(.0008, dt); camera.x += (targetX - camera.x) * smoothing; camera.y += (targetY - camera.y) * smoothing; camera.shakePhase += dt * (28 + camera.shake * 36); const shakeAmount = camera.shake * 11; const shakeTargetX = Math.sin(camera.shakePhase * 1.7) * shakeAmount; const shakeTargetY = Math.cos(camera.shakePhase * 2.1) * shakeAmount * .7; camera.shakeX += (shakeTargetX - camera.shakeX) * Math.min(1, dt * 20); camera.shakeY += (shakeTargetY - camera.shakeY) * Math.min(1, dt * 20); };

  const drawShadow = (x, y, rx, ry, alpha = .3) => { ctx.save(); const shadow = ctx.createRadialGradient(x + 6, y + 5, 0, x + 6, y + 5, Math.max(rx, ry) * 1.35); shadow.addColorStop(0, `rgba(4,13,10,${alpha})`); shadow.addColorStop(.62, `rgba(4,13,10,${alpha * .48})`); shadow.addColorStop(1, "rgba(4,13,10,0)"); ctx.fillStyle = shadow; ctx.beginPath(); ctx.ellipse(x + 6, y + 5, rx * 1.25, ry * 1.35, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = `rgba(4,13,10,${alpha * .2})`; ctx.beginPath(); ctx.ellipse(x + 6, y + 5, rx * .58, Math.max(2, ry * .48), 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); };
  const drawDirectionalShadow = (x, y, rx, ry, alpha = .12, rotation = .22) => {
    ctx.save(); ctx.translate(x + 14, y + 12); ctx.rotate(rotation); ctx.globalAlpha = alpha; const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry)); shadow.addColorStop(0, ART.shadowDeep); shadow.addColorStop(.65, "rgba(4,13,10,.14)"); shadow.addColorStop(1, "rgba(4,13,10,0)"); ctx.fillStyle = shadow; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  const drawLightPool = (x, y, radius, color, alpha = .18) => {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, `${color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`);
    glow.addColorStop(.42, `${color}${Math.round(alpha * 120).toString(16).padStart(2, "0")}`);
    glow.addColorStop(1, `${color}00`);
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
  };
  const drawGroundBloom = (x, y, rx, ry, color, alpha = .1, rotation = 0) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.globalAlpha = alpha;
    const bloom = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry));
    bloom.addColorStop(0, color); bloom.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bloom; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  const drawLeafCluster = (x, y, scale, color, time, phase = 0) => {
    const sway = Math.sin(time * 1.2 + phase) * .06;
    ctx.save(); ctx.translate(x, y); ctx.rotate(sway); ctx.scale(scale, scale);
    drawShadow(0, 8, 24, 7, .22);
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(-15, 0, 18, 10, -.35, 0, Math.PI * 2); ctx.ellipse(3, -5, 20, 11, .24, 0, Math.PI * 2); ctx.ellipse(18, 3, 14, 8, .48, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(222,255,193,.24)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-27, 2); ctx.quadraticCurveTo(-8, -4, 9, -7); ctx.moveTo(1, 9); ctx.quadraticCurveTo(12, 3, 22, -1); ctx.stroke();
    ctx.restore();
  };
  const drawBush = (bush, time, foreground = false) => {
    const palette = [
      ["#3d7b50", "#65a563"], ["#477f56", "#78b66c"], ["#376b4b", "#5e9b5d"]
    ][bush.variant || 0]; const depth = foreground ? .96 : .86; const sway = Math.sin(time * .72 + bush.phase) * .018;
    ctx.save(); ctx.globalAlpha = depth; ctx.translate(bush.x, bush.y); ctx.rotate(sway); ctx.scale(bush.s || 1, bush.s || 1); drawShadow(0, 11, 28, 8, .27);
    const bushFrame = 8 + (Number.isFinite(bush.variant) ? Math.max(0, Math.min(3, bush.variant)) : Math.floor(hash01(bush.x, bush.y) * 4));
    if (drawOptionalSprite("outdoor-ground", 0, 12, { frame: bushFrame, width: 92, height: 88, anchorX: .5, anchorY: .9, alpha: foreground ? .98 : .92 })) { ctx.restore(); return; }
    ctx.fillStyle = palette[0]; ctx.beginPath(); ctx.ellipse(-20, 0, 22, 14, -.22, 0, Math.PI * 2); ctx.ellipse(0, -8, 25, 17, .08, 0, Math.PI * 2); ctx.ellipse(23, 3, 19, 12, .3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = ART.inkSoft; ctx.lineWidth = ART.outlineWidth; ctx.beginPath(); ctx.ellipse(-20, 0, 22, 14, -.22, 0, Math.PI * 2); ctx.ellipse(0, -8, 25, 17, .08, 0, Math.PI * 2); ctx.ellipse(23, 3, 19, 12, .3, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = palette[1]; ctx.beginPath(); ctx.arc(-10, -8, 7, 0, Math.PI * 2); ctx.arc(8, -14, 8, 0, Math.PI * 2); ctx.arc(18, -1, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(224,255,194,.18)"; ctx.beginPath(); ctx.arc(-8, -14, 4, 0, Math.PI * 2); ctx.arc(9, -20, 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  const drawCliff = (cliff, time) => {
    ctx.save(); ctx.translate(cliff.x, cliff.y); ctx.rotate(Math.sin(time * .12 + cliff.phase) * .008); drawShadow(cliff.w * .5, cliff.h + 12, cliff.w * .48, 9, .22);
    if (drawOptionalSprite("outdoor-cliffs", cliff.w * .5, cliff.h + 3, { frame: Number.isFinite(cliff.variant) ? cliff.variant : 0, width: cliff.w + 18, height: Math.max(124, cliff.h * 2), anchorX: .5, anchorY: .96, alpha: .98 })) { ctx.restore(); return; }
    ctx.fillStyle = "#315644"; ctx.beginPath(); ctx.moveTo(0, cliff.h); ctx.lineTo(12, 18); ctx.quadraticCurveTo(cliff.w * .3, -4, cliff.w * .55, 12); ctx.quadraticCurveTo(cliff.w * .78, -1, cliff.w, 16); ctx.lineTo(cliff.w - 6, cliff.h); ctx.closePath(); ctx.fill(); ctx.strokeStyle = ART.inkSoft; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = "#52785a"; ctx.beginPath(); ctx.moveTo(9, 18); ctx.quadraticCurveTo(cliff.w * .3, -3, cliff.w * .55, 11); ctx.quadraticCurveTo(cliff.w * .78, -1, cliff.w - 6, 16); ctx.lineTo(cliff.w - 14, 26); ctx.quadraticCurveTo(cliff.w * .72, 13, cliff.w * .52, 25); ctx.quadraticCurveTo(cliff.w * .28, 10, 16, 28); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(175,205,157,.24)"; ctx.lineWidth = 2; for (let i = 0; i < 3; i += 1) { const x = 30 + i * (cliff.w - 60) / 2; ctx.beginPath(); ctx.moveTo(x, 38); ctx.lineTo(x - 9, cliff.h - 8); ctx.stroke(); } ctx.restore();
  };
  const drawFence = (fence) => {
    ctx.save(); ctx.translate(fence.x, fence.y); ctx.rotate(fence.angle); drawShadow(0, 8, fence.length * .45, 6, .18);
    // The painted prop family replaces the old placeholder rails when available.
    // Keep the procedural fence below as a safe fallback for slow/offline loads.
    const fenceFrame = Number.isFinite(fence.variant) ? fence.variant : Math.floor(hash01(fence.x, fence.y) * 4);
    if (drawOptionalSprite("outdoor-props", 0, 8, { frame: Math.max(0, Math.min(3, fenceFrame)), width: Math.max(132, fence.length * 1.22), height: 96, anchorX: .5, anchorY: .88 })) { ctx.restore(); return; }
    ctx.strokeStyle = ART.inkSoft; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-fence.length / 2, -6); ctx.lineTo(fence.length / 2, -6); ctx.moveTo(-fence.length / 2, 8); ctx.lineTo(fence.length / 2, 8); ctx.stroke();
    ctx.strokeStyle = "#a9794d"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-fence.length / 2, -6); ctx.lineTo(fence.length / 2, -6); ctx.moveTo(-fence.length / 2, 8); ctx.lineTo(fence.length / 2, 8); ctx.stroke();
    for (let i = 0; i < fence.posts; i += 1) { const x = -fence.length / 2 + i * fence.length / (fence.posts - 1); ctx.fillStyle = "#745039"; ctx.fillRect(x - 4, -16, 8, 34); ctx.strokeStyle = ART.inkSoft; ctx.lineWidth = 2; ctx.strokeRect(x - 4, -16, 8, 34); ctx.fillStyle = "#b18455"; ctx.fillRect(x - 2, -13, 3, 8); } ctx.restore();
  };
  const drawRuin = (ruin, time) => {
    ctx.save(); ctx.translate(ruin.x, ruin.y); ctx.scale(ruin.s, ruin.s); drawShadow(0, 18, 42, 9, .3);
    if (ruin.authored && drawOptionalSprite("outdoor-ruin", 0, 15, { frame: 0, width: 156, height: 156, anchorX: .5, anchorY: .9, alpha: .98 })) { ctx.restore(); return; }
    if (ruin.variant === "moonwell" && drawOptionalSprite("outdoor-moonwell", 0, 15, { frame: 0, width: 156, height: 104, anchorX: .5, anchorY: .92, alpha: .98 })) { ctx.restore(); return; }
    ctx.fillStyle = "#657b70"; ctx.strokeStyle = ART.inkSoft; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-42, 11); ctx.lineTo(-36, -19); ctx.lineTo(-15, -31); ctx.lineTo(8, -19); ctx.lineTo(39, -28); ctx.lineTo(45, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#91a28b"; ctx.fillRect(-32, -17, 18, 9); ctx.fillRect(9, -18, 25, 8); ctx.fillStyle = "#4e685c"; ctx.fillRect(-25, -5, 18, 17); ctx.fillRect(5, -2, 22, 14);
    ctx.strokeStyle = "#8fba72"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-10, -28); ctx.quadraticCurveTo(2, -15 + Math.sin(time * 1.5) * 2, 12, -2); ctx.stroke(); ctx.fillStyle = "#76ab69"; ctx.beginPath(); ctx.arc(-9, -19, 5, 0, Math.PI * 2); ctx.arc(5, -10, 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  const drawSign = (sign) => {
    ctx.save(); ctx.translate(sign.x, sign.y); ctx.rotate(sign.angle); drawShadow(0, 11, 14, 5, .18);
    const signFrame = sign.lantern ? 11 : hash01(sign.x, sign.y) > .66 ? 11 : 10;
    if (drawOptionalSprite("outdoor-props", 0, 8, { frame: signFrame, width: 116, height: 112, anchorX: .5, anchorY: .9 })) {
      // Preserve the authored destination label over the generated sign face.
      ctx.fillStyle = "rgba(246,222,166,.86)"; ctx.font = "700 7px DM Mono"; ctx.textAlign = "center"; ctx.fillText(sign.label, 0, -18); ctx.restore(); return;
    }
    ctx.fillStyle = "#714d38"; ctx.fillRect(-3, -25, 6, 38); ctx.fillStyle = "#b7834f"; ctx.beginPath(); ctx.moveTo(-27, -29); ctx.lineTo(23, -29); ctx.lineTo(29, -18); ctx.lineTo(23, -7); ctx.lineTo(-27, -7); ctx.closePath(); ctx.fill(); ctx.strokeStyle = ART.inkSoft; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = "rgba(246,222,166,.7)"; ctx.font = "700 7px DM Mono"; ctx.textAlign = "center"; ctx.fillText(sign.label, -1, -17); ctx.restore();
  };
  const drawClearing = (clearing, time) => {
    ctx.save(); ctx.translate(clearing.x, clearing.y); ctx.rotate(clearing.rotation); ctx.globalAlpha = .32 + Math.sin(time * .2 + clearing.x) * .015; ctx.fillStyle = clearing.tone; ctx.beginPath(); ctx.ellipse(0, 0, clearing.rx, clearing.ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = .36; ctx.strokeStyle = "rgba(186,218,157,.22)"; ctx.lineWidth = 2; ctx.setLineDash([3, 13]); ctx.beginPath(); ctx.ellipse(0, 0, clearing.rx * .8, clearing.ry * .68, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  };
  const drawDappleShadows = (time) => {
    ctx.save(); ctx.globalAlpha = .1; ctx.fillStyle = "#153c2f";
    [[180,270,100,32,.2],[480,360,88,26,1.4],[1020,350,120,38,2.6],[1420,430,105,30,4.2]].forEach(([x,y,rx,ry,phase]) => { const drift = Math.sin(time * .16 + phase) * 12; ctx.beginPath(); ctx.ellipse(x + drift, y, rx, ry, .18, 0, Math.PI * 2); ctx.fill(); }); ctx.restore();
  };
  const drawMeadowClusters = (time) => {
    // Keep the authored clearings legible: one small cluster per landmark is
    // enough to imply a living meadow without rebuilding the road edge as a
    // wall of grass cards.
    [[150, 365, 1, 30, .3], [585, 405, 1, 28, 3.1], [1180, 390, 1, 26, 4.4], [1435, 540, 1, 34, 5.2]].forEach(([x, y, count, spread, phase], clusterIndex) => {
      for (let i = 0; i < count; i += 1) {
        const angle = hash01(clusterIndex * 13 + i, 3) * Math.PI * 2; const radius = 8 + hash01(clusterIndex * 17 + i, 7) * spread;
        drawGrassTuft({ x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius * .5, s: .5 + hash01(i, clusterIndex) * .42, phase: phase + i }, time);
        if (i === 0 && clusterIndex % 2 === 0) drawFlower({ x: x + Math.cos(angle + .5) * (radius + 6), y: y + Math.sin(angle + .5) * (radius + 6) * .5, s: .42 + hash01(i, 12) * .22, phase: phase + i + .6, color: i % 4 === 0 ? "#e8b7c5" : "#ecd28a" }, time);
      }
    });
  };
  const drawGroundCover = (time) => {
    // These are sparse, authored meadow islands rather than a wall of repeated
    // grass cards. They give the base wash real material variation while
    // preserving readable clearings, roads, ponds, and combat space.
    if (!loadedAssets.has("meadow-ground-v2")) return;
    const islands = [
      [112, 238, 12, 142, 90, .2, -.12], [360, 290, 6, 118, 78, .18, .08],
      [635, 250, 8, 132, 84, .2, -.04], [1010, 300, 4, 128, 80, .16, .1],
      [1328, 262, 10, 148, 88, .18, -.08], [1450, 680, 14, 156, 94, .19, .06],
      [1120, 770, 5, 128, 82, .16, -.1], [470, 770, 9, 144, 86, .17, .12],
      [190, 742, 15, 132, 80, .15, -.05]
    ];
    islands.forEach(([x, y, frame, width, height, alpha, rotation], index) => {
      if (isMainRoadZone(x, y, 112)) return;
      drawOptionalSprite("meadow-ground-v2", x, y, {
        frame,
        width,
        height,
        anchorX: .5,
        anchorY: .9,
        alpha: alpha + Math.sin(time * .28 + index) * .012,
        rotation: rotation + Math.sin(time * .22 + index) * .006
      });
    });
  };
  const mainRoadY = (x) => {
    const points = [[0, 490], [430, 423], [760, 505], [1110, 580], [1600, 440]];
    const clampedX = clamp(x, points[0][0], points[points.length - 1][0]);
    for (let i = 1; i < points.length; i += 1) {
      if (clampedX <= points[i][0]) {
        const [x0, y0] = points[i - 1]; const [x1, y1] = points[i]; const t = (clampedX - x0) / (x1 - x0);
        return y0 + (y1 - y0) * (t * t * (3 - 2 * t));
      }
    }
    return points[points.length - 1][1];
  };
  const isMainRoadZone = (x, y, margin = 38) => Math.abs(y - mainRoadY(x)) < margin;
  const drawGrassBase = (time) => {
    const wash = ctx.createLinearGradient(0, 0, WORLD.width, WORLD.height); wash.addColorStop(0, "#3b7650"); wash.addColorStop(.45, "#315f45"); wash.addColorStop(1, "#274c3b");
    ctx.fillStyle = wash; ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    drawGroundBloom(290, 220, 290, 120, "#91d878", .12, -.2); drawGroundBloom(930, 300, 330, 150, "#214b3b", .11, .16); drawGroundBloom(1320, 760, 360, 145, "#a0d37a", .08, -.1);
    ctx.globalAlpha = .16; ctx.fillStyle = "#8fca75";
    [[180,190,230,90],[530,420,310,130],[1060,320,250,160],[1350,760,330,150],[380,820,240,110]].forEach(([x,y,rx,ry], i) => { ctx.save(); ctx.translate(x, y); ctx.rotate(i * .43); ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
    ctx.globalAlpha = .06; ctx.fillStyle = "#b8dc87";
    for (let i = 0; i < 30; i += 1) { const x = (i * 173) % WORLD.width; const y = (i * 97 + 38) % WORLD.height; const lean = (hash01(i, 4) - .5) * .28; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(time * .14 + i) * .1 + lean); ctx.fillRect(0, 0, 2 + (i % 3), 7 + (i % 4) * 2); ctx.restore(); }
    ctx.globalAlpha = .09;
    for (let i = 0; i < 34; i += 1) { const x = 34 + ((i * 271) % (WORLD.width - 68)); const y = 72 + ((i * 149) % (WORLD.height - 144)); const radius = 8 + hash01(i, 7) * 13; ctx.fillStyle = i % 3 === 0 ? "#8fc875" : i % 3 === 1 ? "#274d3b" : "#d1d89b"; ctx.beginPath(); ctx.ellipse(x, y, radius * 1.7, radius * .45, hash01(i, 9) * Math.PI, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  };
  const drawTree = (tree, time, layer = "mid") => {
    const { x, y, s, phase = 0 } = tree; const variant = tree.variant ?? Math.floor(hash01(Math.floor(x), Math.floor(y)) * 3); const sway = Math.sin(time * .18 + phase) * .003; const depth = layer === "back" ? .66 : layer === "front" ? 1.08 : .9;
    const canopyA = layer === "back" ? ["#4f9662", "#4b8d61", "#568f63"][variant] : layer === "front" ? ["#3c7d54", "#39744f", "#427b52"][variant] : ["#478f5c", "#438857", "#4d8f5e"][variant];
    const canopyB = layer === "back" ? ["#71b878", "#69ad74", "#79bd7d"][variant] : layer === "front" ? ["#5da86b", "#58a166", "#67b170"][variant] : ["#64ad70", "#5fa76b", "#6db778"][variant];
    const crowns = [
      [[-31, 6, 27], [22, 5, 34], [0, -25, 43], [-8, 25, 38], [31, -19, 24]],
      [[-35, 3, 25], [24, 8, 30], [-7, -28, 40], [8, 20, 35], [34, -14, 22]],
      [[-27, 8, 30], [28, 1, 28], [2, -22, 46], [-12, 26, 34], [25, -25, 25]]
    ][variant];
    drawShadow(x, y + 57 * s, 30 * s, 10 * s, layer === "front" ? .45 : .3);
    if (layer !== "back") drawDirectionalShadow(x, y + 48 * s, 56 * s, 17 * s, layer === "front" ? .09 : .06, .2);
    // The authored tree cells are subtle variations, not a four-frame dance cycle.
    // Hold each pose long enough that the player registers wind only peripherally.
    const treeMotion = [0, 1, 1, 1][Math.floor((time * .34 + phase * .19) % 4)];
    const layerBase = layer === "back" ? 0 : layer === "front" && variant === 2 ? 12 : layer === "front" ? 8 : 4;
    const treeFrame = layerBase + treeMotion;
    // The generated tree artwork has about 10% transparent padding below the roots.
    // A .90 anchor puts the visible root flare on the same ground line as its shadow.
    if (drawOptionalSprite(`tree-${layer}`, x, y + 58 * s, { frame: treeFrame, width: 176 * s * depth, height: 220 * s * depth, anchorX: .5, anchorY: .90 })) return;
    ctx.save(); ctx.globalAlpha = depth; ctx.translate(x, y); ctx.rotate(sway); ctx.scale(s, s);
    ctx.fillStyle = "#6e4935"; ctx.beginPath(); ctx.moveTo(-10, 5); ctx.lineTo(9, 5); ctx.lineTo(14, 58); ctx.lineTo(-15, 58); ctx.closePath(); ctx.fill(); ctx.strokeStyle = ART.inkSoft; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#aa7048"; ctx.fillRect(-3, 8, 5, 44); ctx.fillStyle = "rgba(33,56,39,.22)"; ctx.fillRect(8, 13, 5, 41);
    ctx.strokeStyle = "rgba(56,83,52,.68)"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-5, 42); ctx.quadraticCurveTo(-20, 28, -24, 16); ctx.moveTo(5, 37); ctx.quadraticCurveTo(19, 24, 25, 10); ctx.stroke();
    crowns.forEach(([ox, oy, radius], i) => {
      const crownSway = Math.sin(time * .2 + phase + i * .9) * (i === 2 ? .22 : .11);
      ctx.save(); ctx.translate(crownSway, i === 2 ? Math.sin(time * .28 + phase) * .24 : 0); ctx.fillStyle = i % 2 ? canopyA : canopyB; ctx.beginPath(); ctx.arc(ox, oy, radius, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "rgba(22,61,43,.24)"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "rgba(224,255,194,.14)"; ctx.beginPath(); ctx.arc(ox - 9, oy - 10, radius * .32, 0, Math.PI * 2); ctx.fill();
      if ((i + variant) % 3 === 0 && layer !== "back") { ctx.fillStyle = "rgba(29,76,48,.2)"; ctx.beginPath(); ctx.arc(ox + 8, oy + radius * .48, radius * .45, 0, Math.PI); ctx.fill(); }
      ctx.restore();
    });
    ctx.fillStyle = "rgba(17,56,42,.22)"; ctx.beginPath(); ctx.ellipse(0, 35, 36, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "rgba(72,61,45,.62)"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-10, 52); ctx.quadraticCurveTo(-25, 59, -30, 64); ctx.moveTo(10, 52); ctx.quadraticCurveTo(25, 59, 30, 64); ctx.stroke(); ctx.restore();
  };
  const drawHouse = (x, y, w, h, color, accent = "#b97b58") => {
    drawShadow(x + w / 2, y + h + 9, w * .5, 15, .34);
    // Painted structures are a presentation layer only: collision rectangles and
    // authored house coordinates remain unchanged, with the procedural facade below
    // kept as a reliable fallback when the atlas is unavailable.
    const structureFrame = x > 1000 ? 9 : 1;
    const structureAnchor = structureFrame >= 8 && structureFrame <= 11 ? .86 : .925;
    if (drawOptionalSprite("structures", x + w / 2, y + h + 2, { frame: structureFrame, width: w * 1.06, height: h * 1.18, anchorX: .5, anchorY: structureAnchor, alpha: .98 })) return;
    ctx.fillStyle = "rgba(11,35,27,.24)"; ctx.fillRect(x - 8, y + 38, w + 16, h - 30);
    const wall = ctx.createLinearGradient(x, y + 30, x + w, y + h); wall.addColorStop(0, shadeHex(color, .04)); wall.addColorStop(.7, color); wall.addColorStop(1, shadeHex(color, -.16));
    ctx.fillStyle = wall; ctx.fillRect(x, y + 30, w, h - 30); ctx.strokeStyle = ART.inkSoft; ctx.lineWidth = 2; ctx.strokeRect(x, y + 30, w, h - 30);
    ctx.fillStyle = "rgba(255,249,208,.24)"; ctx.fillRect(x + 10, y + 45, w - 20, 5); ctx.fillStyle = "rgba(19,43,34,.2)"; ctx.fillRect(x + w - 12, y + 34, 12, h - 38);
    ctx.fillStyle = accent; ctx.beginPath(); ctx.moveTo(x - 25, y + 33); ctx.lineTo(x + w / 2, y - 52); ctx.lineTo(x + w + 25, y + 33); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "rgba(27,52,43,.55)"; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = "rgba(255,220,153,.16)"; ctx.beginPath(); ctx.moveTo(x + 8, y + 31); ctx.lineTo(x + w / 2, y - 42); ctx.lineTo(x + w - 8, y + 31); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(255,225,172,.24)"; ctx.lineWidth = 3; for (let row = 0; row < 4; row += 1) { const yy = y - 20 + row * 14; ctx.beginPath(); ctx.moveTo(x + 8 + row * 7, yy); ctx.lineTo(x + w - 8 - row * 7, yy); ctx.stroke(); }
    ctx.fillStyle = "#e9d39c"; ctx.fillRect(x + 27, y + 72, 38, 42); ctx.fillStyle = "#72928d"; ctx.fillRect(x + 31, y + 76, 30, 34); ctx.strokeStyle = "rgba(38,67,59,.7)"; ctx.lineWidth = 2; ctx.strokeRect(x + 31, y + 76, 30, 34); ctx.beginPath(); ctx.moveTo(x + 46, y + 76); ctx.lineTo(x + 46, y + 110); ctx.moveTo(x + 31, y + 93); ctx.lineTo(x + 61, y + 93); ctx.stroke();
    ctx.fillStyle = "rgba(255,217,138,.18)"; ctx.beginPath(); ctx.arc(x + 46, y + 92, 25, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#6e4838"; ctx.fillRect(x + w / 2 - 21, y + h - 86, 42, 86); ctx.strokeStyle = "rgba(32,48,39,.7)"; ctx.strokeRect(x + w / 2 - 21, y + h - 86, 42, 86); ctx.fillStyle = "#d7a76e"; ctx.fillRect(x + w / 2 - 4, y + h - 45, 5, 5);
    ctx.fillStyle = "#73513e"; ctx.fillRect(x + w - 58, y - 28, 14, 34); ctx.fillStyle = "rgba(255,210,129,.2)"; ctx.fillRect(x + w - 55, y - 22, 8, 8);
    ctx.fillStyle = "#8f6446"; ctx.fillRect(x + 18, y + h - 5, 58, 5); ctx.fillStyle = "rgba(238,223,177,.24)"; ctx.fillRect(x + 24, y + h - 8, 46, 3);
  };
  const drawWater = (rect, time) => {
    ctx.save(); const water = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h); water.addColorStop(0, "#438f8c"); water.addColorStop(.48, "#2d7476"); water.addColorStop(1, "#234f5f"); ctx.fillStyle = water; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    const depth = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y); depth.addColorStop(0, "rgba(205,255,222,.16)"); depth.addColorStop(.5, "rgba(205,255,222,0)"); depth.addColorStop(1, "rgba(4,34,43,.2)"); ctx.fillStyle = depth; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    drawOptionalSprite("water-surface", rect.x + rect.w / 2, rect.y + rect.h / 2, { frame: Math.floor(time * 7) % 16, width: rect.w + 18, height: rect.h + 18, anchorX: .5, anchorY: .5, alpha: .56 });
    ctx.strokeStyle = "rgba(164,246,216,.25)"; ctx.lineWidth = 2;
    for (let y = rect.y + 18; y < rect.y + rect.h; y += 28) { ctx.beginPath(); for (let x = rect.x; x < rect.x + rect.w; x += 24) { const wave = Math.sin(time * 1.8 + x * .03 + y * .06) * 3; ctx.moveTo(x, y + wave); ctx.quadraticCurveTo(x + 10, y - wave * .65, x + 20, y + wave); } ctx.stroke(); }
    ctx.fillStyle = "rgba(226,255,218,.14)"; for (let i = 0; i < 5; i += 1) { const x = rect.x + ((time * (9 + i * 2) + i * 74) % (rect.w + 80)) - 40; ctx.fillRect(x, rect.y + 22 + i * 27 + Math.sin(time * .8 + i) * 2, 34, 3); }
    ctx.globalAlpha = .36; ctx.strokeStyle = "rgba(193,239,197,.55)"; ctx.lineWidth = 2; for (let i = 0; i < 4; i += 1) { const y = rect.y + 9 + i * Math.max(16, rect.h - 18) / 3; ctx.beginPath(); ctx.moveTo(rect.x + 6, y + Math.sin(time * 1.5 + i) * 2); ctx.quadraticCurveTo(rect.x + rect.w * .5, y - 4, rect.x + rect.w - 6, y + Math.sin(time * 1.3 + i) * 2); ctx.stroke(); }
    ctx.restore();
  };
  const drawPond = (rect, time, shallow = false) => {
    ctx.save(); ctx.fillStyle = "rgba(11,47,43,.32)"; ctx.beginPath(); ctx.roundRect(rect.x - 8, rect.y + 8, rect.w + 16, rect.h + 12, 22); ctx.fill();
    const shape = () => { ctx.beginPath(); ctx.moveTo(rect.x + 18, rect.y + 14); ctx.quadraticCurveTo(rect.x + rect.w * .28, rect.y - 6, rect.x + rect.w * .55, rect.y + 12); ctx.quadraticCurveTo(rect.x + rect.w + 12, rect.y + 8, rect.x + rect.w - 6, rect.y + rect.h * .52); ctx.quadraticCurveTo(rect.x + rect.w - 18, rect.y + rect.h + 10, rect.x + rect.w * .58, rect.y + rect.h - 2); ctx.quadraticCurveTo(rect.x + 16, rect.y + rect.h + 8, rect.x + 5, rect.y + rect.h * .58); ctx.closePath(); };
    shape(); const water = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h); water.addColorStop(0, shallow ? "#4b938e" : "#357d7d"); water.addColorStop(1, "#285766"); ctx.fillStyle = water; ctx.fill();
    ctx.save(); shape(); ctx.clip(); drawOptionalSprite("water-surface", rect.x + rect.w / 2, rect.y + rect.h / 2, { frame: Math.floor(time * 7) % 16, width: rect.w + 28, height: rect.h + 28, anchorX: .5, anchorY: .5, alpha: shallow ? .46 : .56 }); ctx.strokeStyle = "rgba(167,249,218,.28)"; ctx.lineWidth = 2;
    for (let y = rect.y + 22; y < rect.y + rect.h + 20; y += 28) { ctx.beginPath(); for (let x = rect.x - 30; x < rect.x + rect.w + 30; x += 28) { const wave = Math.sin(time * 2.15 + x * .03 + y) * 3; ctx.moveTo(x, y + wave); ctx.quadraticCurveTo(x + 12, y - wave, x + 24, y + wave); } ctx.stroke(); }
    ctx.fillStyle = "rgba(237,255,213,.2)"; for (let i = 0; i < 6; i += 1) { const x = rect.x + ((time * (12 + i) + i * 81) % (rect.w + 90)) - 35; ctx.fillRect(x, rect.y + 24 + i * 24 + Math.sin(time * .9 + i) * 2, 38, 3); }
    ctx.globalAlpha = .42; ctx.strokeStyle = "rgba(226,255,218,.7)"; ctx.lineWidth = 2; for (let i = 0; i < 5; i += 1) { const y = rect.y + 27 + i * 25 + Math.sin(time * 1.2 + i) * 4; ctx.beginPath(); ctx.moveTo(rect.x - 10, y); ctx.quadraticCurveTo(rect.x + rect.w * .5, y - 6, rect.x + rect.w + 10, y + 2); ctx.stroke(); }
    // Short, irregular highlights sit just inside the bank instead of outlining the pond uniformly.
    ctx.globalAlpha = .28; ctx.strokeStyle = "#f0e2b4"; ctx.lineWidth = 2; for (let i = 0; i < 8; i += 1) { const x = rect.x + 18 + ((i * 53) % Math.max(30, rect.w - 36)); const y = rect.y + (i % 2 ? rect.h - 12 : 12) + Math.sin(time * .8 + i) * 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 8, y - 3, x + 16, y); ctx.stroke(); }
    ctx.globalAlpha = .28; ctx.fillStyle = "#d8e7b4"; for (let i = 0; i < 4; i += 1) { const x = rect.x + rect.w * (.18 + i * .22) + Math.sin(time * .7 + i) * 8; const y = rect.y + rect.h * (.28 + (i % 2) * .32); ctx.beginPath(); ctx.ellipse(x, y, 8 + (i % 2) * 4, 3, -.18, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    if (loadedAssets.has("shoreline")) {
      const frame = Math.floor(time * 6) % 2 === 0 ? 0 : 7;
      drawOptionalSprite("shoreline", rect.x + rect.w / 2, rect.y + rect.h - 4, { frame, width: Math.min(rect.w * .92, 330), height: 68, anchorX: .5, anchorY: .56, alpha: .48 });
    }
    ctx.strokeStyle = ART.inkSoft; ctx.lineWidth = 8; shape(); ctx.stroke(); ctx.strokeStyle = "rgba(196,213,162,.7)"; ctx.lineWidth = 3; shape(); ctx.stroke();
    ctx.save(); shape(); ctx.clip(); ctx.globalAlpha = .5; ctx.strokeStyle = "rgba(240,226,178,.68)"; ctx.lineWidth = 2; ctx.setLineDash([9, 18]); ctx.lineDashOffset = Math.sin(time * .35) * 12; shape(); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    ctx.restore();
  };
  const drawPath = (time) => {
    ctx.save(); ctx.globalAlpha = .34; ctx.strokeStyle = ART.inkSoft; ctx.lineWidth = 86; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-30, 500); ctx.quadraticCurveTo(430, 433, 760, 515); ctx.quadraticCurveTo(1110, 590, 1630, 450); ctx.stroke();
    const hasRoadAtlas = loadedAssets.has("road-surface-v2") || loadedAssets.has("road-family");
    ctx.globalAlpha = hasRoadAtlas ? .34 : .84; ctx.strokeStyle = hasRoadAtlas ? "#6b563e" : "#896b4b"; ctx.lineWidth = hasRoadAtlas ? 62 : 78; ctx.beginPath(); ctx.moveTo(-30, 490); ctx.quadraticCurveTo(430, 423, 760, 505); ctx.quadraticCurveTo(1110, 580, 1630, 440); ctx.stroke();
    if (!hasRoadAtlas) { ctx.strokeStyle = "rgba(236,194,123,.16)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-20, 470); ctx.quadraticCurveTo(430, 405, 760, 486); ctx.quadraticCurveTo(1110, 560, 1610, 425); ctx.stroke(); }
    // Preserve the authored connector between the lower footpath and the main
    // route. It remains visual-only; movement collision still owns the route.
    ctx.globalAlpha = hasRoadAtlas ? .2 : .34; ctx.strokeStyle = hasRoadAtlas ? "#6b563e" : ART.inkSoft; ctx.lineWidth = hasRoadAtlas ? 38 : 50; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(430, 604); ctx.quadraticCurveTo(390, 522, 430, 423); ctx.stroke();
    if (!hasRoadAtlas) { ctx.globalAlpha = 1; ctx.strokeStyle = "#aa9069"; ctx.lineWidth = 42; ctx.beginPath(); ctx.moveTo(430, 604); ctx.quadraticCurveTo(390, 522, 430, 423); ctx.stroke(); ctx.strokeStyle = "rgba(247,223,170,.23)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(430, 596); ctx.quadraticCurveTo(402, 522, 435, 431); ctx.stroke(); }
    ctx.globalAlpha = hasRoadAtlas ? .22 : .42; ctx.strokeStyle = ART.inkSoft; ctx.lineWidth = 42; ctx.beginPath(); ctx.moveTo(85, 620); ctx.quadraticCurveTo(310, 580, 520, 610); ctx.stroke();
    ctx.globalAlpha = hasRoadAtlas ? .3 : .84; ctx.strokeStyle = hasRoadAtlas ? "#6b563e" : "#80694e"; ctx.lineWidth = hasRoadAtlas ? 30 : 34; ctx.beginPath(); ctx.moveTo(85, 614); ctx.quadraticCurveTo(310, 574, 520, 604); ctx.stroke();
    if (!hasRoadAtlas) { ctx.strokeStyle = "rgba(236,194,123,.14)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(92, 605); ctx.quadraticCurveTo(310, 568, 516, 596); ctx.stroke(); }
    for (let i = 0; i < 12; i += 1) { const x = (i * 131 + 68) % 1550; const y = 480 + Math.sin(x * .011) * 30 + Math.sin(time * .28 + i) * 1.4; ctx.fillStyle = i % 3 ? "rgba(145,119,83,.28)" : "rgba(245,218,163,.34)"; ctx.beginPath(); ctx.ellipse(x, y, 3 + i % 3, 1.8, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = .46; ctx.strokeStyle = "rgba(109,84,60,.38)"; ctx.lineWidth = 2; for (let i = 0; i < 7; i += 1) { const x = 70 + i * 236; const y = 488 + Math.sin(x * .011) * 30; ctx.beginPath(); ctx.moveTo(x, y - 11); ctx.quadraticCurveTo(x + 11, y - 15, x + 19, y - 9); ctx.stroke(); }
    ctx.globalAlpha = .7; const pathStones = [[135, 485, -0.25], [338, 448, .18], [572, 477, -.08], [804, 519, .15], [1050, 550, -.18], [1288, 510, .12], [1478, 462, -.2]];
    pathStones.forEach(([x, y, angle], index) => { ctx.save(); ctx.translate(x, y + Math.sin(time * .35 + index) * .4); ctx.rotate(angle); ctx.fillStyle = index % 2 ? "rgba(218,191,142,.5)" : "rgba(119,96,70,.4)"; ctx.beginPath(); ctx.ellipse(0, 0, 10 + index % 3 * 2, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
    // Painted road tiles now carry the visible surface; the procedural ribbon
    // remains underneath as the collision-safe silhouette and offline fallback.
    const roadKey = loadedAssets.has("road-surface-v2") ? "road-surface-v2" : "road-family";
    if (loadedAssets.has(roadKey)) {
      const roadTiles = [
        [-10, 492, 0, -.13, 320, 132], [260, 445, 0, -.1, 320, 132],
        [530, 475, 2, -.04, 290, 174], [790, 520, 0, .08, 320, 132],
        [1060, 560, 0, .1, 320, 132], [1305, 535, 5, .03, 300, 180],
        [1545, 470, 3, -.1, 300, 174]
      ];
      // The atlas includes its own grassy border. Clip the large painted pieces
      // to the authored road corridor so those borders blend into the existing
      // banks instead of appearing as detached rectangular islands.
      ctx.save(); ctx.beginPath();
      ctx.moveTo(-40, 452); ctx.quadraticCurveTo(430, 385, 760, 467); ctx.quadraticCurveTo(1110, 542, 1640, 402);
      ctx.lineTo(1640, 480); ctx.quadraticCurveTo(1110, 620, 760, 545); ctx.quadraticCurveTo(430, 463, -40, 530); ctx.closePath(); ctx.clip();
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
      roadTiles.forEach(([x, y, frame, rotation, width, height]) => drawOptionalSprite(roadKey, x, y, { frame, width, height, anchorX: .5, anchorY: .5, rotation, alpha: roadKey === "road-surface-v2" ? .92 : .62 }));
      ctx.restore();
      // The lower branch uses a small set of quieter cells so it reads as a
      // real footpath, not a second highway or another tan placeholder ribbon.
      ctx.save(); ctx.beginPath(); ctx.moveTo(62, 587); ctx.quadraticCurveTo(310, 548, 548, 578); ctx.lineTo(548, 637); ctx.quadraticCurveTo(310, 608, 62, 650); ctx.closePath(); ctx.clip();
      drawOptionalSprite(roadKey, 300, 598, { frame: roadKey === "road-surface-v2" ? 0 : 13, width: roadKey === "road-surface-v2" ? 472 : 154, height: roadKey === "road-surface-v2" ? 118 : 96, anchorX: .5, anchorY: .5, rotation: -.1, alpha: roadKey === "road-surface-v2" ? .82 : .5 });
      if (roadKey === "road-surface-v2") drawOptionalSprite(roadKey, 430, 514, { frame: 1, width: 108, height: 196, anchorX: .5, anchorY: .5, alpha: .76 });
      ctx.restore();
    }
    // Keep the road material family exclusive to the path. The old outdoor-props
    // cards were decorative logs/roots placed on top of the road and read as
    // clutter rather than road detail, so the atlas now owns the surface.
    ctx.restore();
  };
  const drawGrassTuft = (item, time, foreground = false) => {
    if (state.area === "overworld" && isMainRoadZone(item.x, item.y, 82)) return;
    const rustle = item.rustle || 0; const sway = Math.sin(time * 1.05 + item.phase) * .045 + rustle * Math.sin(time * 18 + item.phase) * .26;
    const foliageFrame = Number.isFinite(item.foliageFrame) ? Math.abs(item.foliageFrame) % 4 : Math.abs(Math.floor((item.x * .17 + item.y * .07) % 4));
    const meadowKey = loadedAssets.has("meadow-ground-v2") ? "meadow-ground-v2" : "outdoor-foliage";
    if (drawOptionalSprite(meadowKey, item.x, item.y + 5, { frame: foliageFrame, width: (item.s || 1) * (meadowKey === "meadow-ground-v2" ? 62 : 48), height: (item.s || 1) * (meadowKey === "meadow-ground-v2" ? 58 : 48), anchorX: .5, anchorY: .92, alpha: foreground ? .48 : .64, rotation: sway * .2 })) return;
    ctx.save(); ctx.translate(item.x, item.y); ctx.rotate(sway); ctx.scale(item.s || 1, item.s || 1); ctx.globalAlpha = foreground ? .56 : .78;
    [[-8, "#5f9e5a"], [-3, "#77b866"], [3, "#4d8950"], [8, "#83c56d"]].forEach(([offset, color], i) => { ctx.strokeStyle = color; ctx.lineWidth = i % 2 ? 3 : 2; ctx.beginPath(); ctx.moveTo(offset, 8); ctx.quadraticCurveTo(offset - 2, -4, offset + (i - 1.5) * 3, -18 - (i % 2) * 4); ctx.stroke(); });
    ctx.restore();
  };
  const drawGrassPatch = (patch, time, foreground = false) => {
    // Clear a generous edge band around the authored road. The patch radius is
    // visual, not collision geometry, so use the larger of the patch edge and
    // a fixed 82px breathing room to keep the walkable ribbon legible.
    if (state.area === "overworld" && isMainRoadZone(patch.x, patch.y, Math.max(104, patch.radius * 1.2))) return;
    const rustle = patch.rustle || 0; const density = Math.max(4, Math.round((patch.density + (patch.seed % 3)) * .7)); const scale = patch.scale || .7;
    const isLandmark = Boolean(patch.landmark);
    const patchKey = loadedAssets.has("meadow-ground-v2") ? "meadow-ground-v2" : loadedAssets.has("meadow-edge") ? "meadow-edge" : null;
    if (patchKey && isLandmark) {
      const frameBase = Number.isFinite(patch.foliageFrame) ? Math.abs(patch.foliageFrame) : Math.floor(hash01(patch.x, patch.y) * 8);
      const frame = (frameBase + (rustle > .2 ? Math.floor(time * 2) % 2 : 0)) % (patchKey === "meadow-ground-v2" ? 16 : 8);
      drawShadow(patch.x, patch.y + 9, 26 * scale, 6 * scale, foreground ? .12 : .16);
      if (drawOptionalSprite(patchKey, patch.x, patch.y + 7, { frame, width: (patchKey === "meadow-ground-v2" ? 124 : 96) * scale, height: (patchKey === "meadow-ground-v2" ? 106 : 78) * scale, anchorX: .5, anchorY: .92, alpha: foreground ? .58 : .68, rotation: Math.sin(time * .42 + patch.phase) * .004 })) return;
    }
    if (patchKey || loadedAssets.has("outdoor-foliage")) {
      const key = patchKey || "outdoor-foliage";
      const frameBase = Number.isFinite(patch.foliageFrame) ? Math.abs(patch.foliageFrame) : 0;
      const clusterCount = foreground ? 1 : 2;
      drawShadow(patch.x, patch.y + 8, 20 * scale, 5 * scale, foreground ? .1 : .14);
      for (let i = 0; i < clusterCount; i += 1) {
        const angle = hash01(patch.seed, i + 9) * Math.PI * 2;
        const radius = i === 0 ? 0 : 8 + hash01(patch.seed + i, 11) * Math.min(24, patch.radius * .3);
        const x = patch.x + Math.cos(angle) * radius;
        const y = patch.y + Math.sin(angle) * radius * .42;
        const frame = (frameBase + i + (rustle > .2 ? Math.floor(time * 2) % 2 : 0)) % (key === "meadow-ground-v2" ? 16 : 8);
        drawOptionalSprite(key, x, y + 8, { frame, width: (key === "meadow-ground-v2" ? 58 : 44) * scale, height: (key === "meadow-ground-v2" ? 56 : 48) * scale, anchorX: .5, anchorY: .92, alpha: foreground ? .34 : .48, rotation: Math.sin(time * .42 + patch.phase + i) * .006 });
      }
      return;
    }
    ctx.save(); ctx.globalAlpha = foreground ? .48 : .62;
    for (let i = 0; i < density; i += 1) {
      const angle = hash01(patch.seed, i) * Math.PI * 2; const radius = 8 + hash01(patch.seed + i * 3, 4) * patch.radius; const x = patch.x + Math.cos(angle) * radius; const y = patch.y + Math.sin(angle) * radius * .48; const s = scale * (.72 + hash01(patch.seed + i, 9) * .56); const phase = patch.phase + i * .73; const sway = Math.sin(time * (0.72 + hash01(i, patch.seed) * .32) + phase) * .045 + rustle * Math.sin(time * 15 + phase) * .3;
      ctx.save(); ctx.translate(x, y); ctx.rotate(sway); ctx.scale(s, s); const hue = i % 3; const colors = [patch.tone || "#66a95d", shadeHex(patch.tone || "#66a95d", .1), shadeHex(patch.tone || "#66a95d", -.1)];
      for (let blade = 0; blade < 3; blade += 1) { const offset = (blade - 1) * 5; ctx.strokeStyle = colors[(blade + hue) % colors.length]; ctx.lineWidth = blade === 1 ? 2.5 : 2; ctx.beginPath(); ctx.moveTo(offset, 7); ctx.quadraticCurveTo(offset - 2, -2, offset + (blade - 1) * 4, -14 - (blade % 2) * 4); ctx.stroke(); }
      if (i % 5 === 0 && !foreground) { ctx.fillStyle = "rgba(231,211,139,.7)"; ctx.beginPath(); ctx.arc(3, -14, 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    ctx.restore();
  };
  const drawFlower = (flower, time) => {
    const rustle = flower.rustle || 0; const sway = Math.sin(time * 1.02 + flower.phase) * .035 + rustle * Math.sin(time * 16 + flower.phase) * .24;
    const foliageFrame = 4 + (Number.isFinite(flower.foliageFrame) ? Math.abs(flower.foliageFrame) % 8 : Math.abs(Math.floor((flower.x * .11 + flower.y * .05) % 8)));
    const flowerKey = loadedAssets.has("meadow-ground-v2") ? "meadow-ground-v2" : "outdoor-foliage";
    if (drawOptionalSprite(flowerKey, flower.x, flower.y + 6, { frame: flowerKey === "meadow-ground-v2" ? foliageFrame : foliageFrame % 16, width: (flower.s || 1) * (flowerKey === "meadow-ground-v2" ? 66 : 52), height: (flower.s || 1) * (flowerKey === "meadow-ground-v2" ? 64 : 52), anchorX: .5, anchorY: .92, alpha: .9, rotation: sway * .4 })) return;
    ctx.save(); ctx.translate(flower.x, flower.y); ctx.rotate(sway); ctx.scale(flower.s, flower.s); ctx.strokeStyle = "#6f9b58"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 10); ctx.quadraticCurveTo(-2, -2, 0, -11); ctx.stroke(); ctx.fillStyle = flower.color; for (let i = 0; i < 4; i += 1) { ctx.beginPath(); ctx.ellipse(Math.cos(i * 1.57) * 4, -13 + Math.sin(i * 1.57) * 4, 4, 2.5, i * 1.57, 0, Math.PI * 2); ctx.fill(); } ctx.fillStyle = "#ffe8a4"; ctx.beginPath(); ctx.arc(0, -13, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  const drawRock = (rock) => {
    ctx.save(); ctx.translate(rock.x, rock.y); ctx.scale(rock.s, rock.s); drawShadow(0, 10, 20, 7, .24);
    const rockVariant = Number.isFinite(rock.variant) ? rock.variant : Math.floor(hash01(rock.x, rock.y) * 4);
    // Rocks now have their own replaceable family so the most common small
    // landmarks no longer borrow unrelated fence/log prop cells. Keep the
    // original prop family as a safe offline fallback.
    const rockFrame = Math.max(0, Math.min(15, rockVariant % 16));
    if (drawOptionalSprite("rock-family", 0, 8, {
      frame: rockFrame,
      width: rockFrame >= 8 ? 96 : 92,
      height: rockFrame >= 8 ? 84 : 78,
      anchorX: .5,
      anchorY: .9
    })) { ctx.restore(); return; }
    if (drawOptionalSprite("outdoor-props", 0, 8, { frame: 12 + rockVariant % 4, width: 82, height: 76, anchorX: .5, anchorY: .9 })) { ctx.restore(); return; }
    ctx.fillStyle = rock.tone; ctx.beginPath(); ctx.moveTo(-22, 8); ctx.quadraticCurveTo(-24, -10, -8, -17); ctx.quadraticCurveTo(10, -23, 24, -4); ctx.quadraticCurveTo(25, 10, 7, 13); ctx.closePath(); ctx.fill(); ctx.strokeStyle = ART.inkSoft; ctx.lineWidth = ART.outlineWidth; ctx.stroke(); ctx.fillStyle = "rgba(211,235,197,.2)"; ctx.beginPath(); ctx.ellipse(-7, -8, 10, 5, -.2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  const drawLog = (log) => { ctx.save(); ctx.translate(log.x, log.y); ctx.rotate(log.angle); ctx.scale(log.s, log.s); drawShadow(0, 12, log.length * .45, 6, .32); if (drawOptionalSprite("outdoor-foliage", 0, 3, { frame: 12 + (log.variant || 0) % 2, width: log.length * 1.05, height: 64, anchorX: .5, anchorY: .86 })) { ctx.restore(); return; } ctx.fillStyle = "#684735"; ctx.fillRect(-log.length / 2, -10, log.length, 20); ctx.strokeStyle = ART.inkSoft; ctx.lineWidth = ART.outlineWidth; ctx.strokeRect(-log.length / 2, -10, log.length, 20); ctx.fillStyle = "#986b4a"; ctx.fillRect(-log.length / 2 + 12, -7, log.length - 24, 5); ctx.fillStyle = "#b58459"; ctx.beginPath(); ctx.ellipse(-log.length / 2, 0, 11, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#6f4937"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-log.length / 2, 0, 6, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = "#5c8f59"; ctx.beginPath(); ctx.arc(-14, -11, 8, 0, Math.PI * 2); ctx.arc(5, -12, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore(); };
  const drawLantern = (x, y, time) => { const pulse = .72 + Math.sin(time * 7 + x) * .12; drawShadow(x, y + 7, 10, 4, .18); const glow = ctx.createRadialGradient(x, y - 24, 1, x, y - 24, 62); glow.addColorStop(0, "rgba(255,213,125,.38)"); glow.addColorStop(.35, "rgba(255,185,102,.12)"); glow.addColorStop(1, "rgba(255,213,125,0)"); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y - 24, 62, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#543c32"; ctx.fillRect(x - 3, y - 22, 6, 26); ctx.fillStyle = "#a87b4c"; ctx.fillRect(x - 10, y - 28, 20, 7); ctx.strokeStyle = "rgba(31,54,42,.7)"; ctx.lineWidth = 2; ctx.strokeRect(x - 10, y - 28, 20, 13); ctx.fillStyle = `rgba(255,215,133,${pulse})`; ctx.beginPath(); ctx.arc(x, y - 25, 6 + Math.sin(time * 5 + x) * .7, 0, Math.PI * 2); ctx.fill(); };
  const drawButterfly = (item, time) => { const x = item.x + Math.sin(time * item.speed + item.phase) * item.range; const y = item.y + Math.cos(time * item.speed * .8 + item.phase) * 16; const flap = .65 + Math.abs(Math.sin(time * 9 + item.phase)) * .35; ctx.save(); ctx.translate(x, y); ctx.scale(1, flap); ctx.globalAlpha = .78; ctx.fillStyle = item.color; ctx.beginPath(); ctx.ellipse(-4, 0, 5, 3, -.35, 0, Math.PI * 2); ctx.ellipse(4, 0, 5, 3, .35, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#4d463a"; ctx.fillRect(-1, -2, 2, 5); ctx.restore(); };
  const drawBird = (item, time) => { const x = item.x + Math.sin(time * item.speed + item.phase) * item.range; const y = item.y + Math.sin(time * item.speed * 1.8 + item.phase) * 14; const flap = Math.sin(time * 5 + item.phase) * 3; ctx.save(); ctx.translate(x, y); ctx.scale(item.scale, item.scale); ctx.strokeStyle = "rgba(24,57,49,.7)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-10, flap); ctx.quadraticCurveTo(-4, -5, 0, 0); ctx.quadraticCurveTo(5, -5, 11, flap); ctx.stroke(); ctx.restore(); };
  const drawFirefly = (item, time) => { const glow = .35 + (Math.sin(time * 2.6 + item.phase) + 1) * .25; const x = item.x + Math.sin(time * .35 + item.phase) * 12; const y = item.y + Math.cos(time * .45 + item.phase) * 10; const gradient = ctx.createRadialGradient(x, y, 0, x, y, 18); gradient.addColorStop(0, `rgba(241,255,156,${glow})`); gradient.addColorStop(1, "rgba(241,255,156,0)"); ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = `rgba(255,255,185,${glow + .2})`; ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill(); };
  const drawPollen = (time) => {
    ctx.save(); ctx.globalAlpha = .2; ctx.fillStyle = "#f1e6aa";
    for (let i = 0; i < 18; i += 1) {
      const x = 54 + ((i * 197 + time * (2.4 + i % 3)) % (WORLD.width - 108)); const y = 128 + ((i * 113 + Math.sin(time * .25 + i) * 22) % 760); const drift = Math.sin(time * .6 + i * 1.7) * 5; const radius = i % 4 === 0 ? 1.7 : 1.1;
      ctx.beginPath(); ctx.arc(x + drift, y, radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };
  const drawExplorationClues = (time) => {
    const stones = [[968, 704, .8], [1001, 718, .62], [1031, 734, .48]];
    const clueFrames = [1, 3, 7];
    stones.forEach(([x, y, scale], index) => {
      const rotation = -.18 + Math.sin(time * .7 + index) * .03;
      drawShadow(x, y + 5, 12 * scale, 4 * scale, .16);
      if (drawOptionalSprite("waystone-clues", x, y + 2, {
        frame: clueFrames[index],
        width: 44 * scale,
        height: 38 * scale,
        anchorX: .5,
        anchorY: .9,
        alpha: .94,
        rotation
      })) return;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(scale, scale); ctx.fillStyle = index === 2 ? "#d6d4a5" : "#aaa986"; ctx.beginPath(); ctx.ellipse(0, 0, 15, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "rgba(239,240,194,.45)"; ctx.beginPath(); ctx.ellipse(-3, -2, 6, 2.5, -.15, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });
    ctx.save(); ctx.globalAlpha = .24 + Math.sin(time * 2.2) * .05; ctx.strokeStyle = "#c7e4a2"; ctx.lineWidth = 2; ctx.setLineDash([3, 8]); ctx.beginPath(); ctx.moveTo(952, 680); ctx.quadraticCurveTo(985, 699, 1012, 720); ctx.quadraticCurveTo(1032, 737, 1047, 756); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  };
  const drawHiddenGrovePreview = (time) => {
    const lensAlpha = state.lanternLens ? .58 : .25;
    ctx.save(); ctx.globalAlpha = lensAlpha; ctx.fillStyle = "#203f3d"; ctx.beginPath(); ctx.ellipse(1065, 835, 72, 42, -.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(126,232,197,.24)"; ctx.beginPath(); ctx.arc(1060, 822, 46 + Math.sin(time * 2) * 3, 0, Math.PI * 2); ctx.fill();
    drawChest(1060, 830, state.hiddenChestOpened); ctx.restore();
    if (!state.southPassageOpen) {
      ctx.save(); ctx.globalAlpha = .85; ctx.strokeStyle = "#447b61"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(986, 746); ctx.quadraticCurveTo(1020, 732, 1050, 748); ctx.quadraticCurveTo(1090, 730, 1128, 748); ctx.stroke();
      for (let i = 0; i < 11; i += 1) { const x = 988 + i * 13; const sway = Math.sin(time * 2.1 + i) * 3; ctx.strokeStyle = i % 2 ? "#75ad69" : "#548e5b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, 764); ctx.quadraticCurveTo(x + sway, 748, x + sway - 3, 735 - (i % 3) * 4); ctx.stroke(); }
      ctx.restore();
    }
  };
  const drawBreakable = (object, time) => {
    if (object.broken) {
      if (!loadedAssets.has("outdoor-breakables")) return;
      const remnantFrame = object.id === "root-ivy" ? 12 : object.id === "pond-ivy" ? 11 : 15;
      const remnantWidth = object.id === "reed-cache" ? 62 : 70;
      drawShadow(object.x, object.y + 7, 15, 5, .14);
      drawOptionalSprite("outdoor-breakables", object.x, object.y + 7, {
        frame: remnantFrame,
        width: remnantWidth,
        height: remnantWidth,
        anchorX: .5,
        anchorY: .92,
        alpha: .72,
        rotation: Math.sin(time * .45 + object.x) * .012
      });
      return;
    }
    const sway = Math.sin(time * 2.4 + object.x) * .08;
    const breakableFrame = object.id === "root-ivy" ? 0 : object.id === "pond-ivy" ? 8 : 2;
    const breakableWidth = object.id === "reed-cache" ? 72 : 86;
    const breakableHeight = object.id === "reed-cache" ? 78 : 86;
    if (drawOptionalSprite("outdoor-breakables", object.x, object.y + 8, {
      frame: breakableFrame,
      width: breakableWidth,
      height: breakableHeight,
      anchorX: .5,
      anchorY: .92,
      alpha: .98,
      rotation: sway * .22
    })) return;
    const foliageFrame = object.id === "reed-cache" ? 5 : object.id === "pond-ivy" ? 15 : 14;
    if (drawOptionalSprite("outdoor-foliage", object.x, object.y + 8, { frame: foliageFrame, width: object.id === "reed-cache" ? 68 : 78, height: object.id === "reed-cache" ? 68 : 78, anchorX: .5, anchorY: .9, alpha: .96, rotation: sway * .28 })) return;
    ctx.save(); ctx.translate(object.x, object.y); ctx.rotate(sway); ctx.fillStyle = object.id === "reed-cache" ? "#527d55" : "#477d52"; ctx.beginPath(); ctx.arc(0, 0, 21, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = object.id === "reed-cache" ? "#d3b076" : "#a5d977"; ctx.beginPath(); ctx.arc(-8, -7, 7, 0, Math.PI * 2); ctx.arc(8, -4, 4, 0, Math.PI * 2); ctx.fill(); if (object.id === "reed-cache") { ctx.strokeStyle = "rgba(240,222,163,.58)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.stroke(); } ctx.restore();
  };
  const drawRootlightOverworld = (time) => {
    const x = 1450; const y = 580; const glow = .22 + (Math.sin(time * 2.4) + 1) * .08; ctx.save();
    if (drawOptionalSprite("dungeon-landmarks", x, y + 8, { frame: state.rootlightGateOpen ? 11 : 10, width: 112, height: 112, anchorY: .88, alpha: .98 })) { if (state.rootlightGateOpen) drawLightPool(x, y, 125, COLORS.mint, .12); }
    else { ctx.globalAlpha = state.rootlightGateOpen ? .7 : .95; ctx.strokeStyle = state.rootlightGateOpen ? "#8ef2cf" : "#4a6e61"; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(x, y, 48, Math.PI, 0); ctx.lineTo(x + 48, y + 45); ctx.lineTo(x - 48, y + 45); ctx.closePath(); ctx.stroke(); ctx.globalAlpha = glow; ctx.fillStyle = state.rootlightGateOpen ? "#ffd77b" : "#5b8c74"; ctx.beginPath(); ctx.arc(x, y + 4, 58 + Math.sin(time * 1.8) * 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1; ctx.fillStyle = "rgba(214,255,220,.52)"; ctx.font = "10px DM Mono"; ctx.textAlign = "center"; ctx.fillText(state.rootlightGateOpen ? "MOONROOT PATH" : "A LIGHTLESS ROOT GATE", x, y + 80); if (state.rootlightGateOpen) { drawChest(1450, 665, state.rootlightCacheOpened); ctx.strokeStyle = "rgba(255,215,123,.35)"; ctx.lineWidth = 3; ctx.setLineDash([5, 10]); ctx.beginPath(); ctx.moveTo(x, y + 52); ctx.quadraticCurveTo(x - 12, y + 95, x, y + 118); ctx.stroke(); ctx.setLineDash([]); } ctx.restore();
  };
  const drawOutdoorLighting = (time) => {
    ctx.save(); ctx.globalCompositeOperation = "screen";
    const sun = ctx.createLinearGradient(0, 0, WORLD.width * .72, WORLD.height * .56); sun.addColorStop(0, "rgba(255,231,164,.095)"); sun.addColorStop(.38, "rgba(250,218,151,.035)"); sun.addColorStop(1, "rgba(250,218,151,0)"); ctx.fillStyle = sun; ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    drawLightPool(790, 290, 96, "#ffd27a", .11); drawLightPool(1115, 282, 92, "#ffd27a", .09); drawLightPool(1280, 172, 86, "#ffd27a", .08);
    drawLightPool(596, 666, 96, "#6ed6c2", .055); drawLightPool(1210, 550, 70, "#8bd7b5", .035);
    if (state.rootlightGateOpen) drawLightPool(1450, 580, 125, "#8ef2cf", .14);
    ctx.save(); ctx.globalAlpha = .055; ctx.fillStyle = "#fff0b0";
    [[235, 90, 94, 270, .2], [545, 40, 72, 240, 1.8], [1000, 66, 92, 250, 3.4], [1375, 46, 74, 235, 4.7]].forEach(([x, y, width, height, phase]) => {
      const drift = Math.sin(time * .18 + phase) * 18; ctx.beginPath(); ctx.moveTo(x + drift, y); ctx.lineTo(x + width + drift, y + 4); ctx.lineTo(x + width * .72 + drift, y + height); ctx.lineTo(x + width * .18 + drift, y + height); ctx.closePath(); ctx.fill();
    }); ctx.restore(); ctx.restore();
    const haze = ctx.createLinearGradient(0, 80, 0, 360); haze.addColorStop(0, "rgba(207,246,196,.08)"); haze.addColorStop(.55, "rgba(207,246,196,.018)"); haze.addColorStop(1, "rgba(207,246,196,0)"); ctx.fillStyle = haze; ctx.fillRect(0, 0, WORLD.width, 360);
    ctx.save(); ctx.globalAlpha = .12; ctx.fillStyle = "#f6e8ae"; for (let i = 0; i < 10; i += 1) { const x = 160 + ((i * 193) % 1330) + Math.sin(time * .22 + i) * 8; const y = 115 + ((i * 97) % 310) + Math.cos(time * .3 + i) * 6; ctx.beginPath(); ctx.arc(x, y, 1 + (i % 2) * .55, 0, Math.PI * 2); ctx.fill(); } ctx.restore();
  };
  const drawOverworld = (time) => {
    drawGrassBase(time); drawGroundCover(time); environment.clearings.forEach((clearing) => drawClearing(clearing, time)); environment.cliffs.forEach((cliff) => drawCliff(cliff, time)); drawPath(time);
    environment.treesBack.forEach((tree) => drawTree(tree, time, "back"));
    drawDappleShadows(time);
    drawPond({ x: 610, y: 650, w: 360, h: 150 }, time); drawPond({ x: 1080, y: 510, w: 260, h: 90 }, time + 1, true);
    // A small authored dock gives the lower pond a readable shoreline landmark.
    // It is intentionally decorative: the pond remains a collision-safe water
    // boundary, so the dock never implies a new route or changes exploration.
    if (loadedAssets.has("outdoor-dock")) {
      drawShadow(800, 812, 74, 11, .2);
      drawOptionalSprite("outdoor-dock", 800, 812, { frame: 0, width: 220, height: 220, anchorX: .5, anchorY: .96, alpha: .96 });
    }
    environment.shoreStones.forEach((stone, index) => {
      const stoneFrames = [0, 1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 13];
      const frame = stoneFrames[index % stoneFrames.length];
      drawShadow(stone.x, stone.y + 4, 13 * stone.s, 4 * stone.s, .18);
      // Keep the older painted ellipse below as a safe fallback for offline or
      // slow asset loads. The dedicated family is intentionally low-profile so
      // it enriches the water edge without turning shoreline details into clutter.
      if (drawOptionalSprite("shoreline-stones", stone.x, stone.y + 1, {
        frame,
        width: 42 * stone.s,
        height: 32 * stone.s,
        anchorX: .5,
        anchorY: .9,
        alpha: .96,
        rotation: Math.sin(time * .35 + index) * .012
      })) return;
      const tone = ["#b2b596", "#9da98e", "#c0bd9a"][index % 3]; ctx.fillStyle = tone; ctx.beginPath(); ctx.ellipse(stone.x, stone.y, 13 * stone.s, 6 * stone.s, -.15 + Math.sin(time * .4 + index) * .015, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "rgba(42,79,69,.22)"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = "rgba(238,240,195,.28)"; ctx.beginPath(); ctx.ellipse(stone.x - 3, stone.y - 2, 5 * stone.s, 2 * stone.s, -.15, 0, Math.PI * 2); ctx.fill(); if (index % 3 === 0) { ctx.strokeStyle = "rgba(225,244,199,.5)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(stone.x + 4, stone.y + 3, 8 * stone.s, -.25, .58); ctx.stroke(); }
    });
    environment.treesMid.forEach((tree) => drawTree(tree, time, "mid"));
    environment.bushes.filter((bush) => bush.y < 600).forEach((bush) => drawBush(bush, time)); environment.fences.filter((fence) => fence.y < 600).forEach(drawFence); environment.ruins.filter((ruin) => ruin.y < 600).forEach((ruin) => drawRuin(ruin, time)); environment.signs.filter((sign) => sign.y < 600).forEach(drawSign);
    drawHouse(800, 90, 300, 165, "#d5c99e", "#a56e4e"); drawHouse(1140, 100, 190, 135, "#9fb88b", "#6a8e70");
    drawLantern(790, 290, time); drawLantern(1115, 282, time + 1); drawLantern(1280, 172, time + 2);
    ctx.fillStyle = "#6c4d3a"; ctx.fillRect(1280, 180, 64, 64); ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 4; ctx.strokeRect(1280, 180, 64, 64); ctx.fillStyle = "rgba(130,241,215,.42)"; ctx.fillRect(1290, 190, 44, 44); ctx.fillStyle = "#e5d59f"; ctx.fillRect(1303, 246, 20, 7);
    environment.rocks.forEach(drawRock); environment.logs.forEach(drawLog); drawExplorationClues(time); drawHiddenGrovePreview(time); if (!STARTER_MODE) drawRootlightOverworld(time);
    environment.grassPatches.filter((patch) => patch.y <= 560).forEach((patch) => drawGrassPatch(patch, time));
    environment.grasses.filter((grass, index) => index % 2 === 0 || grass.y > 600).forEach((grass) => drawGrassTuft(grass, time));
    environment.flowers.filter((flower) => !isMainRoadZone(flower.x, flower.y, 84)).forEach((flower) => drawFlower(flower, time));
    drawMeadowClusters(time);
    if (!state.chestOpened) drawChest(1240, 745, false); else drawChest(1240, 745, true);
    drawCampfire(npcs[1].x - 24, npcs[1].y + 18, time); drawMapTable(npcs[3].x + 24, npcs[3].y + 18, time); drawPondBasket(npcs[2].x - 14, npcs[2].y + 14, time); drawEntrance(1312, 210, time);
    environment.signs.filter((sign) => sign.y >= 600).forEach(drawSign);
    environment.birds.forEach((bird) => drawBird(bird, time)); environment.butterflies.forEach((butterfly) => drawButterfly(butterfly, time)); environment.fireflies.forEach((firefly) => drawFirefly(firefly, time)); drawPollen(time);
    breakables().forEach((object) => drawBreakable(object, time)); drawOutdoorLighting(time);
  };
  const drawOutdoorForeground = (time) => {
    environment.treesFront.forEach((tree) => drawTree(tree, time, "front"));
    environment.bushes.filter((bush) => bush.y >= 600).forEach((bush) => drawBush(bush, time, true)); environment.fences.filter((fence) => fence.y >= 600).forEach(drawFence); environment.ruins.filter((ruin) => ruin.y >= 600).forEach((ruin) => drawRuin(ruin, time));
    environment.grassPatches.filter((patch) => patch.y > 560).forEach((patch) => drawGrassPatch(patch, time, true)); environment.grasses.filter((grass, index) => grass.y > 560 && index % 2 === 0).forEach((grass) => drawGrassTuft(grass, time, true));
    drawLeafCluster(70, 560, .9, "#467e55", time, .4); drawLeafCluster(1510, 505, .76, "#3d744f", time, 1.4); drawLeafCluster(1180, 846, .84, "#558c58", time, 2.7);
    [[585, 730], [975, 735], [1060, 565]].forEach(([x, y], i) => { const sway = Math.sin(time * 2 + i) * .12; ctx.save(); ctx.translate(x, y); ctx.rotate(sway); ctx.strokeStyle = i === 2 ? "#78b979" : "#6fae69"; ctx.lineWidth = 3; for (let n = -1; n <= 1; n += 1) { ctx.beginPath(); ctx.moveTo(n * 8, 18); ctx.quadraticCurveTo(n * 9, 0, n * 13, -22); ctx.stroke(); } ctx.restore(); });
  };
  const drawChest = (x, y, open, time = state.visualClock) => {
    const isOpening = open && state.chestOpening > 0 && Math.hypot(x - state.chestOpenX, y - state.chestOpenY) < 2;
    const reveal = open ? (isOpening ? clamp(1 - state.chestOpening / .44, 0, 1) : 1) : 0;
    const bob = reveal > 0 ? Math.sin(time * 2.6 + x) * 1.2 : 0; const lidY = y - 7 - reveal * 13;
    const hasReward = state.loot > 0 || state.chestOpened || state.heartChestOpened || state.lanternSeed || state.rootlightLantern || state.rootlightCacheOpened || state.rootlightGalleryCacheOpened || state.hiddenChestOpened;
    const isHiddenChest = Math.abs(x - 1060) < 2 && Math.abs(y - 830) < 2;
    const isLanternCache = Math.abs(x - 180) < 2 && Math.abs(y - 635) < 2;
    const isMoonrootCache = (Math.abs(x - 1450) < 2 && Math.abs(y - 665) < 2) || (Math.abs(x - 990) < 2 && Math.abs(y - 640) < 2);
    const isHeartChest = state.area === "dungeon" && `${state.roomX}-${state.roomY}` === "0-1" && Math.abs(x - 600) < 2 && Math.abs(y - 390) < 2;
    const isKeyChest = !isHiddenChest && !isLanternCache && !isMoonrootCache && !isHeartChest;
    const itemFrame = isHiddenChest ? (open ? 13 : 12) : isLanternCache ? (open ? 15 : 14) : isMoonrootCache ? (open ? 11 : 10) : isHeartChest ? (open ? 3 : 2) : (open ? 1 : 0);
    if (loadedAssets.has("exploration-items")) {
      const itemGlow = open && (isOpening || reveal > 0) ? (isHeartChest || isLanternCache ? COLORS.gold : COLORS.mint) : null;
      if (itemGlow) { const glow = ctx.createRadialGradient(x, y + bob, 2, x, y + bob, 54 + reveal * 20); glow.addColorStop(0, `${itemGlow}55`); glow.addColorStop(1, `${itemGlow}00`); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y + bob, 54 + reveal * 20, 0, Math.PI * 2); ctx.fill(); }
      drawShadow(x, y + 14, isMoonrootCache || isHiddenChest ? 30 : 24, 8, .32);
      drawOptionalSprite("exploration-items", x, y + bob, { frame: itemFrame, width: isHiddenChest || isMoonrootCache ? 94 : 82, height: isHiddenChest || isMoonrootCache ? 94 : 82, anchorX: .5, anchorY: .82, alpha: .98 });
      return;
    }
    const chestFrame = open ? (reveal > .08 && isOpening ? 1 : reveal > .08 && hasReward ? 2 : 3) : 0;
    if (loadedAssets.has("dungeon-landmarks")) { drawShadow(x, y + 14, 30, 8, .34); drawOptionalSprite("dungeon-landmarks", x, y + 2 + bob, { frame: chestFrame, width: 104, height: 104, anchorY: .88, alpha: .98 }); return; }
    drawShadow(x, y + 14, 25, 7, .35); ctx.save(); ctx.translate(0, bob);
    if (reveal > 0) { const glow = ctx.createRadialGradient(x, lidY - 10, 1, x, lidY - 10, 44 + reveal * 18); glow.addColorStop(0, `rgba(255,225,145,${.18 + reveal * .18})`); glow.addColorStop(1, "rgba(255,225,145,0)"); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, lidY - 10, 44 + reveal * 18, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = open ? "#55423c" : "#a87845"; ctx.fillRect(x - 22, y - 9, 44, 25); ctx.strokeStyle = ART.inkSoft; ctx.lineWidth = 2; ctx.strokeRect(x - 22, y - 9, 44, 25);
    ctx.fillStyle = open ? "#846b58" : "#d2a65b"; ctx.beginPath(); ctx.arc(x, lidY, 22, Math.PI, 0); ctx.fill(); ctx.strokeStyle = "rgba(28,47,37,.62)"; ctx.stroke();
    ctx.fillStyle = open ? `rgba(255,215,123,${.22 + reveal * .28})` : "rgba(235,194,106,.65)"; ctx.fillRect(x - 16, y - 4, 32, 4);
    if (reveal > .08) { ctx.fillStyle = `rgba(255,215,123,${.2 + reveal * .3})`; ctx.fillRect(x - 16, lidY - 14, 32, 8); ctx.strokeStyle = "rgba(255,246,202,.6)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 18, lidY - 15); ctx.lineTo(x + 18, lidY - 15); ctx.stroke(); }
    ctx.fillStyle = COLORS.gold; ctx.fillRect(x - 3, y + 1, 6, 8); ctx.fillStyle = "#573d32"; ctx.fillRect(x - 17, y + 13, 5, 4); ctx.fillRect(x + 12, y + 13, 5, 4); ctx.restore();
  };
  const drawCampfire = (x, y, time) => { const flicker = Math.sin(time * 8) * 2; const glow = ctx.createRadialGradient(x, y, 1, x, y, 66); glow.addColorStop(0, "rgba(255,208,116,.38)"); glow.addColorStop(.42, "rgba(255,167,91,.12)"); glow.addColorStop(1, "rgba(255,208,116,0)"); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, 66, 0, Math.PI * 2); ctx.fill(); drawShadow(x, y + 7, 22, 6, .3); ctx.fillStyle = "#b49a70"; [-16, 0, 16].forEach((offset, index) => { ctx.beginPath(); ctx.ellipse(x + offset, y + 5, 8, 5, index - 1, 0, Math.PI * 2); ctx.fill(); }); ctx.strokeStyle = "#80543a"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x - 11, y + 4); ctx.lineTo(x + 11, y - 4); ctx.moveTo(x - 10, y - 4); ctx.lineTo(x + 10, y + 4); ctx.stroke(); const flame = ctx.createLinearGradient(x, y - 29 + flicker, x, y + 3); flame.addColorStop(0, "#fff2b1"); flame.addColorStop(.42, COLORS.gold); flame.addColorStop(1, "#e77b4e"); ctx.fillStyle = flame; ctx.beginPath(); ctx.moveTo(x, y - 27 + flicker); ctx.quadraticCurveTo(x + 14, y - 11, x, y + 2); ctx.quadraticCurveTo(x - 14, y - 11, x, y - 27 + flicker); ctx.fill(); ctx.fillStyle = "#fff0b0"; ctx.beginPath(); ctx.arc(x, y - 10 + flicker * .35, 5, 0, Math.PI * 2); ctx.fill(); ctx.save(); ctx.globalAlpha = .16; ctx.strokeStyle = "#d7d4be"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 7, y - 26); ctx.quadraticCurveTo(x + 18, y - 45 + Math.sin(time * 1.4) * 4, x + 8, y - 61); ctx.stroke(); ctx.restore(); };
  const drawMapTable = (x, y, time) => { drawShadow(x, y + 11, 24, 6, .25); ctx.fillStyle = "#6f4b39"; ctx.fillRect(x - 20, y - 5, 40, 8); ctx.fillRect(x - 16, y + 3, 4, 18); ctx.fillRect(x + 12, y + 3, 4, 18); ctx.fillStyle = "#d5c28d"; ctx.fillRect(x - 13, y - 10, 26, 8); ctx.strokeStyle = "rgba(71,112,93,.75)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 8, y - 8); ctx.lineTo(x - 2, y - 4); ctx.lineTo(x + 4, y - 8); ctx.lineTo(x + 10, y - 3); ctx.stroke(); ctx.fillStyle = `rgba(255,215,123,${.35 + Math.sin(time * 3) * .1})`; ctx.beginPath(); ctx.arc(x + 18, y - 8, 3, 0, Math.PI * 2); ctx.fill(); };
  const drawPondBasket = (x, y, time) => { ctx.save(); ctx.translate(x, y + Math.sin(time * 1.7) * .5); ctx.fillStyle = "#b17b4d"; ctx.beginPath(); ctx.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#e2bd78"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -2, 10, Math.PI, 0); ctx.stroke(); ctx.restore(); };
  const drawNpc = (npc, time) => {
    const bob = Math.sin(time * 1.15 + npc.phase) * (npc.behavior === "pace" ? .16 : .12); const npcAnimTime = npc.animTime || 0; const stride = npc.behavior === "pace" ? Math.sin(npcAnimTime) * 2 : Math.sin(npcAnimTime) * .45; const x = npc.x; const y = npc.y + bob;
    // NPCs are anchored at their feet; keep the contact shadow directly beneath
    // the sprite instead of making idle breathing read as hovering.
    const groundedY = y + 11;
    drawShadow(x, groundedY, (npc.id === "brindle" ? 20 : 18) * (1 + Math.abs(stride) * .025), 7, .32);
    const isTalking = state.dialogue && npc.near;
    const hasRoleActivity = npc.id !== "rowan" && loadedAssets.has("npc-activity");
    const hasDirectionalRowan = npc.id === "rowan" && !isTalking && npc.behavior === "pace" && loadedAssets.has("npc-rowan-walk");
    const hasDirectionalBrindle = npc.id === "brindle" && !isTalking && npc.behavior === "pace" && loadedAssets.has("npc-brindle-walk");
    const hasDirectionalTansy = npc.id === "tansy" && !isTalking && npc.behavior === "fire" && loadedAssets.has("npc-tansy-fire");
    const hasDirectionalLumen = npc.id === "lumen" && !isTalking && npc.behavior === "map" && loadedAssets.has("npc-lumen-map");
    const hasTalkReaction = isTalking && npc.id !== "rowan" && loadedAssets.has("npc-reaction");
    // Keep the expressive named-family talk frames, while each NPC's normal
    // behavior gets a real sequential role loop from the activity atlas.
    const customNpcKey = hasDirectionalRowan ? "npc-rowan-walk" : npc.id === "rowan" ? "npc-rowan" : hasDirectionalBrindle ? "npc-brindle-walk" : hasDirectionalTansy ? "npc-tansy-fire" : hasDirectionalLumen ? "npc-lumen-map" : hasTalkReaction ? "npc-reaction" : isTalking ? "npc-named" : hasRoleActivity ? "npc-activity" : "npc-named";
    const facingFrame = npc.facing < 0 ? 2 : npc.facing > 0 ? 0 : 1;
    const namedIndex = npc.id === "tansy" ? 0 : npc.id === "brindle" ? 1 : npc.id === "lumen" ? 2 : 3;
    const activityBase = npc.id === "tansy" ? 0 : npc.id === "brindle" ? 4 : npc.id === "lumen" ? 8 : 12;
    const activityFrame = activityBase + (
      npc.behavior === "pace" ? Math.floor((npc.animTime || 0) * 1.05) % 4
        : npc.behavior === "fire" ? Math.floor((npc.clock || 0) * 1.8) % 4
          : npc.behavior === "map" ? Math.floor((npc.clock || 0) * 1.35) % 4
            : npc.behavior === "cart" ? Math.floor((npc.clock || 0) * 1.1) % 4
              : 0
    );
    const reactionFrame = namedIndex * 4 + Math.floor((npc.clock || 0) * 4.2) % 4;
    const rowanDirectionBase = npc.facingAxis === "y" ? (npc.facing > 0 ? 0 : 4) : (npc.facing > 0 ? 12 : 8);
    const brindleDirectionBase = npc.facingAxis === "y" ? (npc.facing > 0 ? 0 : 4) : (npc.facing > 0 ? 12 : 8);
    const tansyDirectionBase = npc.facingAxis === "y" ? (npc.facing > 0 ? 0 : 4) : (npc.facing > 0 ? 12 : 8);
    const lumenDirectionBase = npc.facingAxis === "y" ? (npc.facing > 0 ? 0 : 4) : (npc.facing > 0 ? 12 : 8);
    const customNpcFrame = hasDirectionalRowan
      ? rowanDirectionBase + Math.floor((npc.animTime || 0) * .95) % 4
      : hasDirectionalBrindle
      ? brindleDirectionBase + Math.floor((npc.animTime || 0) * 1.05) % 4
      : hasDirectionalTansy
      ? tansyDirectionBase + Math.floor((npc.clock || 0) * 1.35) % 4
      : hasDirectionalLumen
      ? lumenDirectionBase + Math.floor((npc.clock || 0) * 1.35) % 4
      : npc.id === "rowan"
      ? (state.dialogue && npc.near ? 12 + Math.floor((npc.clock || 0) * 4) % 4 : npc.behavior === "map" ? 8 + Math.floor((npc.clock || 0) * 2.6) % 4 : npc.behavior === "pace" ? 4 + Math.floor((npc.animTime || 0) * 1.4) % 4 : facingFrame)
      : (hasTalkReaction ? reactionFrame : isTalking ? 12 + namedIndex : hasRoleActivity ? activityFrame : npc.behavior === "map" || npc.behavior === "fire" ? 8 + namedIndex : npc.behavior === "pace" ? (Math.floor((npc.animTime || 0) * .72) % 2 ? 4 + namedIndex : namedIndex) : namedIndex);
    const npcBottoms = npc.id === "rowan"
      ? [0.965, 0.971, 0.974, 0.974, 1, 1, 0.84, 1, 1, 1, 1, 1, 0.827, 0.824, 0.821, 0.827]
      : [1, 0.997, 1, 1, 0.949, 0.955, 0.965, 0.978, 1, 1, 1, 1, 0.901, 0.897, 0.897, 0.907];
    const customNpc = drawOptionalSprite(customNpcKey, x, groundedY, { frame: customNpcFrame, width: npc.id === "brindle" || hasDirectionalRowan ? 58 : 56, height: hasDirectionalRowan || hasDirectionalBrindle || hasDirectionalTansy || hasDirectionalLumen ? 76 : 74, anchorY: hasDirectionalRowan || hasDirectionalBrindle || hasDirectionalTansy || hasDirectionalLumen ? .94 : hasRoleActivity && !isTalking ? .92 : hasTalkReaction ? .92 : (npcBottoms[customNpcFrame] || .96), flipX: hasDirectionalRowan || hasDirectionalBrindle || hasDirectionalTansy || hasDirectionalLumen ? false : npc.facing < 0, alpha: npc.near ? 1 : .98 });
    if (!customNpc) {
      ctx.save(); ctx.translate(x, y); ctx.scale(npc.facing || 1, 1);
      ctx.fillStyle = npc.id === "brindle" ? "#315b58" : "#4a3c43"; ctx.fillRect(-10 - stride, 8, 7, 8); ctx.fillRect(3 + stride, 8, 7, 8);
      if (npc.id === "rowan") {
        ctx.fillStyle = "#365c78"; ctx.beginPath(); ctx.moveTo(-16, 9); ctx.quadraticCurveTo(-14, -9, 0, -15); ctx.quadraticCurveTo(14, -9, 16, 9); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#233d59"; ctx.beginPath(); ctx.moveTo(-16, -14); ctx.lineTo(0, -28); ctx.lineTo(16, -14); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#d7a77b"; ctx.beginPath(); ctx.arc(0, -23, 8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = COLORS.gold; ctx.fillRect(-12, 1, 24, 5); ctx.fillStyle = "#91e1c1"; ctx.fillRect(-4, -25, 3, 3);
      } else if (npc.id === "tansy") {
        ctx.fillStyle = "#b8684d"; ctx.beginPath(); ctx.arc(0, -20, 12, Math.PI, 0); ctx.fill(); ctx.fillStyle = "#ddba83"; ctx.beginPath(); ctx.arc(0, -21, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#d07a52"; ctx.fillRect(-15, -4, 30, 15); ctx.fillStyle = "#f0dfb2"; ctx.fillRect(-9, -5, 18, 18); ctx.fillStyle = "#bd684d"; ctx.fillRect(-13, -5, 26, 4); ctx.fillStyle = "#7e4d3d"; ctx.fillRect(8, -18, 3, 3);
      } else if (npc.id === "brindle") {
        ctx.fillStyle = "#4d8d87"; ctx.beginPath(); ctx.ellipse(0, 1, 16, 17, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#d7ad76"; ctx.beginPath(); ctx.arc(0, -18, 10, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#324d4e"; ctx.fillRect(-14, -27, 28, 5); ctx.fillRect(-7, -31, 14, 5); ctx.fillStyle = "#e3c57e"; ctx.fillRect(-14, 4, 8, 5); ctx.fillRect(6, 4, 8, 5); ctx.fillStyle = "#233f3d"; ctx.fillRect(-5, -19, 3, 3);
      } else {
        ctx.fillStyle = "#765c8e"; ctx.beginPath(); ctx.moveTo(-15, 10); ctx.lineTo(-11, -13); ctx.lineTo(0, -17); ctx.lineTo(12, -13); ctx.lineTo(16, 10); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#e0bd89"; ctx.beginPath(); ctx.arc(0, -23, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#2e2e4a"; ctx.fillRect(-11, -29, 22, 5); ctx.fillStyle = "#d7c99a"; ctx.fillRect(9, -1, 8, 10); ctx.strokeStyle = "#e8d6a3"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -23, 12, 0, Math.PI * 2); ctx.stroke();
      }
      if (npc.behavior === "fire" || npc.behavior === "map") { const npcWork = npc.work || 0; ctx.strokeStyle = npc.behavior === "fire" ? "#e6b774" : "#d7c99a"; ctx.globalAlpha = .72; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-12, 1); ctx.lineTo(-16, 5 + npcWork * 4); ctx.moveTo(12, 1); ctx.lineTo(16, 5 - npcWork * 4); ctx.stroke(); }
      ctx.restore();
    }
    // Keep the prompt tied to the same nearest-NPC target and 68px reach used
    // by interact(). The wider `near` radius is still useful for facing and
    // idle animation, but should never imply that E will work from that edge.
    const interactableNpc = nearestNpc() === npc;
    if (interactableNpc && state.mode === "playing" && !state.dialogue) { const lift = Math.sin(time * 4 + npc.phase) * 2; ctx.save(); ctx.globalAlpha = .95; ctx.fillStyle = "rgba(7,20,18,.9)"; ctx.strokeStyle = "rgba(214,255,220,.45)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x - 17, y - 69 + lift, 34, 22, 8); ctx.fill(); ctx.stroke(); ctx.fillStyle = COLORS.gold; ctx.font = "700 11px DM Mono"; ctx.textAlign = "center"; ctx.fillText("E", x, y - 54 + lift); ctx.fillStyle = "rgba(243,246,223,.82)"; ctx.font = "500 9px Outfit"; ctx.fillText(npc.name, x, y - 76 + lift); ctx.restore(); }
  };
  const nearestInteractionHint = () => {
    if (state.mode !== "playing" || state.dialogue || nearestNpc()) return null;
    const candidates = [];
    const add = (x, y, radius, label, text) => { const range = distance(player, { x, y }); if (range < radius) candidates.push({ x, y, range, label, text }); };
    if (state.area === "overworld") {
      if (!STARTER_MODE && !state.rootlightLantern) add(1450, 580, 72, "E", "CHECK GATE");
      if (!STARTER_MODE && distance(player, { x: 1350, y: 235 }) < 120) add(1312, 210, 120, "E", "ENTER SHRINE");
      if (!state.chestOpened) add(1240, 745, 70, "E", "OPEN CHEST");
      if (state.rootlightGateOpen && !state.rootlightCacheOpened) add(1450, 665, 78, "E", "SEARCH CACHE");
      if (state.southPassageOpen && !state.hiddenChestOpened && !enemies.some((enemy) => enemy.encounter === "hidden-cache" && !enemy.dead)) add(1060, 830, 70, "E", "SEARCH GROVE");
    } else {
      const key = `${state.roomX}-${state.roomY}`;
      const node = nearestRootlightNode(72); if (node && !state.rootlightLantern) add(node.x, node.y, 72, "E", "CHECK SIGIL");
      if (key === "0-0" && !state.chestOpened) add(600, 390, 80, "E", "OPEN CHEST");
      if (key === "1-0" && !state.switches) add(600, 380, 80, "E", "ACTIVATE");
      if (key === "0-1" && !state.heartChestOpened) add(600, 390, 80, "E", "OPEN CHEST");
      if (key === "0-0" && state.rootlightGalleryOpen && !state.rootlightGalleryCacheOpened) add(990, 640, 88, "E", "SEARCH CACHE");
      if (key === "1-1" && !state.ashCacheOpened) add(180, 635, 92, "E", "TAKE LANTERN");
      if (key === "2-1" && state.bossDefeated && !state.bossRewardClaimed) add(600, 150, 100, "E", "CLAIM HEARTSEED");
    }
    return candidates.sort((a, b) => a.range - b.range)[0] || null;
  };
  const drawInteractionHint = (time) => {
    const hint = nearestInteractionHint(); if (!hint) return;
    const lift = Math.sin(time * 3.6 + hint.x * .01) * 2; const width = Math.max(76, hint.text.length * 6.4 + 34); const y = hint.y - 45 + lift;
    ctx.save(); ctx.globalAlpha = .95; ctx.fillStyle = "rgba(7,20,18,.92)"; ctx.strokeStyle = "rgba(214,255,220,.42)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(hint.x - width / 2, y - 13, width, 25, 9); ctx.fill(); ctx.stroke();
    ctx.fillStyle = COLORS.gold; ctx.font = "700 11px DM Mono"; ctx.textAlign = "center"; ctx.fillText(hint.label, hint.x - width / 2 + 15, y + 4);
    ctx.fillStyle = "rgba(243,246,223,.84)"; ctx.font = "500 9px Outfit"; ctx.fillText(hint.text, hint.x + 10, y + 4); ctx.restore();
  };
  const drawEntrance = (x, y, time) => {
    drawShadow(x, y + 39, 58, 13, .34);
    if (drawOptionalSprite("structures", x, y + 38, { frame: 7, width: 148, height: 138, anchorX: .5, anchorY: .925, alpha: .98 })) { drawLightPool(x, y + 30, 88, COLORS.mint, .09); return; }
    ctx.fillStyle = "#342d3e"; ctx.beginPath(); ctx.arc(x, y, 50, Math.PI, 0); ctx.lineTo(x + 50, y + 50); ctx.lineTo(x - 50, y + 50); ctx.closePath(); ctx.fill(); ctx.fillStyle = `rgba(95,238,206,${.28 + Math.sin(time * 2) * .08})`; ctx.beginPath(); ctx.arc(x, y + 6, 32, Math.PI, 0); ctx.lineTo(x + 32, y + 45); ctx.lineTo(x - 32, y + 45); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "#8ef2cf"; ctx.lineWidth = 2; ctx.stroke();
  };

  const dungeonRoomTint = (key) => ({ "0-0": ["#172424", "#2b4b46"], "1-0": ["#151f2d", "#30445b"], "2-0": ["#20251f", "#3d5140"], "0-1": ["#142b32", "#2c5b60"], "1-1": ["#2b1d25", "#5a3a38"], "2-1": ["#271c30", "#533451"] }[key] || [COLORS.dungeon, COLORS.dungeonLight]);
  const drawDungeonMasonry = (time, key) => {
    const [base, stone] = dungeonRoomTint(key); const wash = ctx.createLinearGradient(0, 0, 0, ROOM.height); wash.addColorStop(0, base); wash.addColorStop(1, "#101a1b"); ctx.fillStyle = wash; ctx.fillRect(0, 0, ROOM.width, ROOM.height);
    if (loadedAssets.has("dungeon-walls")) {
      const wallFrames = { "0-0": [0, 1, 2, 3], "1-0": [4, 5, 6, 7], "2-0": [2, 0, 3, 1], "0-1": [12, 13, 12, 13], "1-1": [14, 10, 14, 11], "2-1": [15, 15, 10, 15] }[key] || [0, 1, 2, 3];
      const wallPatches = [[220, 220, 430, 286], [660, 220, 430, 286], [220, 512, 430, 250], [660, 512, 430, 250]];
      ctx.save(); ctx.globalAlpha = .28;
      wallPatches.forEach(([x, y, width, height], index) => drawOptionalSprite("dungeon-walls", x, y, { frame: wallFrames[index], width, height, anchorX: .5, anchorY: .5, alpha: .9 }));
      ctx.restore();
    }
    ctx.globalAlpha = .2;
    for (let row = 0; row < 12; row += 1) for (let col = 0; col < 16; col += 1) {
      const offset = row % 2 ? 26 : 0; const x = col * 80 - offset; const y = row * 64 + 38; const tone = hash01(col + key.length, row + key.charCodeAt(0) % 7);
      ctx.fillStyle = tone > .72 ? stone : tone > .34 ? "#3c504e" : "#243637"; ctx.fillRect(x + 2, y + 2, 74, 58);
      ctx.fillStyle = tone > .6 ? "rgba(202,231,193,.08)" : "rgba(6,15,15,.12)"; ctx.fillRect(x + 5, y + 5, 66, 4);
      if (tone < .26) { ctx.strokeStyle = "rgba(7,18,18,.28)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 18, y + 16); ctx.lineTo(x + 28, y + 22); ctx.lineTo(x + 22, y + 36); ctx.stroke(); }
    }
    ctx.globalAlpha = .2; ctx.fillStyle = "rgba(132,181,145,.1)"; for (let i = 0; i < 18; i += 1) { const x = 50 + ((i * 137) % 1100); const y = 110 + ((i * 89) % 590); ctx.beginPath(); ctx.ellipse(x, y, 16 + (i % 3) * 5, 5, hash01(i, 22) * 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = .16; ctx.strokeStyle = "#a7c5ac"; ctx.lineWidth = 2;
    for (let i = 0; i < 13; i += 1) { const x = 75 + ((i * 97) % 1040); const y = 100 + ((i * 53) % 560); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 12 + (i % 3) * 8, y + 5); ctx.lineTo(x + 7, y + 18 + (i % 2) * 8); ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(196,249,205,.2)"; ctx.lineWidth = 3; ctx.strokeRect(35, 35, ROOM.width - 70, ROOM.height - 70);
    ctx.strokeStyle = "rgba(10,18,18,.55)"; ctx.lineWidth = 12; ctx.strokeRect(47, 47, ROOM.width - 94, ROOM.height - 94);
    for (let x = 100; x < ROOM.width - 100; x += 180) drawTorch(x, 68, time);
  };
  const drawDungeonFloorSurface = (time, key) => {
    if (!loadedAssets.has("dungeon-floor")) return;
    const frame = ({ "0-0": 0, "1-0": 5, "2-0": 4, "0-1": 14, "1-1": 10, "2-1": 15 }[key] ?? 0);
    const phase = Math.sin(time * .22 + key.length) * .015;
    const patches = [
      [260, 215, 286, 218, .16, -phase],
      [600, 402, 360, 276, .13, phase],
      [940, 590, 286, 218, .15, -phase * .7]
    ];
    ctx.save(); ctx.globalCompositeOperation = "multiply";
    patches.forEach(([x, y, width, height, alpha, rotation]) => {
      drawOptionalSprite("dungeon-floor", x, y, { frame, width, height, anchorX: .5, anchorY: .5, alpha, rotation });
    });
    ctx.restore();
    // A faint room-specific wash keeps the generated tiles subordinate to the
    // authored hazards, landmarks, and actor silhouettes drawn afterward.
    const wash = { "0-0": "rgba(112,170,143,.05)", "1-0": "rgba(135,170,208,.055)", "2-0": "rgba(144,185,123,.05)", "0-1": "rgba(81,188,185,.06)", "1-1": "rgba(194,113,83,.055)", "2-1": "rgba(193,113,159,.06)" }[key] || "rgba(112,170,143,.05)";
    ctx.save(); ctx.fillStyle = wash; ctx.globalAlpha = .7; ctx.fillRect(72, 72, ROOM.width - 144, ROOM.height - 144); ctx.restore();
  };
  const drawDungeonArch = (x, y, rotation = 0, color = "#6b8479", broken = false) => {
    const frame = broken ? 6 : rotation === 0 ? 4 : 5;
    if (loadedAssets.has("dungeon-architecture")) { drawShadow(x, y + 55, 56, 10, .3); if (drawOptionalSprite("dungeon-architecture", x, y + 6, { frame, width: 144, height: 144, anchorY: .82, rotation })) return; }
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); drawShadow(0, 32, 54, 8, .24);
    ctx.fillStyle = "#1a2929"; ctx.beginPath(); ctx.arc(0, 0, 62, Math.PI, 0); ctx.lineTo(62, 42); ctx.lineTo(44, 42); ctx.lineTo(44, 8); ctx.arc(0, 0, 44, 0, Math.PI, true); ctx.lineTo(-44, 42); ctx.lineTo(-62, 42); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, 0, 53, Math.PI, 0); ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = "rgba(202,231,193,.34)"; ctx.beginPath(); ctx.arc(0, -2, 45, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = color; ctx.fillRect(-56, 7, 14, 38); ctx.fillRect(42, 7, 14, 38); ctx.fillStyle = "rgba(222,239,203,.18)"; ctx.fillRect(-51, 12, 4, 26); ctx.fillRect(47, 12, 4, 26);
    ctx.strokeStyle = broken ? "rgba(218,150,116,.7)" : "rgba(19,45,38,.6)"; ctx.lineWidth = broken ? 3 : 2; ctx.beginPath(); ctx.moveTo(-27, -33); ctx.lineTo(-18, -18); ctx.lineTo(-28, -2); ctx.moveTo(17, -23); ctx.lineTo(7, -8); ctx.lineTo(19, 7); ctx.stroke();
    if (broken) { ctx.fillStyle = "#52665c"; ctx.beginPath(); ctx.moveTo(-18, -45); ctx.lineTo(-2, -53); ctx.lineTo(9, -43); ctx.lineTo(3, -31); ctx.lineTo(-12, -32); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  };
  const drawDungeonPillar = (x, y, w = 54, h = 130, color = "#6d887d", cracked = false) => {
    const frame = cracked ? 10 : 8;
    if (loadedAssets.has("dungeon-architecture")) { drawShadow(x, y + h * .6, Math.max(28, w * .62), 8, .3); if (drawOptionalSprite("dungeon-architecture", x, y + h * .22, { frame, width: Math.max(78, w * 1.75), height: Math.max(138, h * 1.15), anchorY: .88 })) return; }
    ctx.save(); ctx.translate(x, y); drawShadow(0, h * .5 + 12, w * .56, 8, .28);
    const body = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); body.addColorStop(0, "#3b514d"); body.addColorStop(.18, color); body.addColorStop(.72, color); body.addColorStop(1, "#293a3a"); ctx.fillStyle = body; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = "rgba(13,33,31,.72)"; ctx.lineWidth = 2; ctx.strokeRect(-w / 2, -h / 2, w, h); ctx.fillStyle = "#859b88"; ctx.fillRect(-w / 2 - 8, -h / 2 - 7, w + 16, 13); ctx.fillStyle = "#3a5149"; ctx.fillRect(-w / 2 - 12, h / 2 - 5, w + 24, 13); ctx.fillStyle = "rgba(226,241,207,.2)"; ctx.fillRect(-w / 2 + 6, -h / 2 + 9, 5, h - 22);
    ctx.strokeStyle = cracked ? "rgba(224,155,122,.7)" : "rgba(19,48,41,.45)"; ctx.lineWidth = cracked ? 2.5 : 1.5; ctx.beginPath(); ctx.moveTo(-8, -h * .3); ctx.lineTo(3, -h * .12); ctx.lineTo(-4, h * .02); ctx.lineTo(9, h * .2); ctx.stroke(); if (cracked) { ctx.beginPath(); ctx.moveTo(17, -h * .05); ctx.lineTo(7, h * .16); ctx.lineTo(16, h * .32); ctx.stroke(); }
    ctx.restore();
  };
  const drawDungeonRubble = (x, y, scale = 1, seed = 1) => {
    const frame = seed % 3 === 0 ? 15 : seed % 3 === 1 ? 12 : 0;
    if (loadedAssets.has("dungeon-architecture")) { drawShadow(x, y + 14 * scale, 28 * scale, 7 * scale, .24); if (drawOptionalSprite("dungeon-architecture", x, y + 8 * scale, { frame, width: 128 * scale, height: 128 * scale, anchorY: .86, alpha: .96 })) return; }
    ctx.save(); ctx.translate(x, y); drawShadow(0, 10 * scale, 28 * scale, 6 * scale, .24);
    for (let i = 0; i < 5; i += 1) { const px = (hash01(seed, i) - .5) * 52 * scale; const py = (hash01(seed + 3, i) - .5) * 19 * scale; const size = (5 + hash01(seed + 8, i) * 10) * scale; ctx.save(); ctx.translate(px, py); ctx.rotate(hash01(seed + 12, i) * Math.PI); ctx.fillStyle = i % 2 ? "#657a70" : "#829387"; ctx.beginPath(); ctx.moveTo(-size, size * .45); ctx.lineTo(-size * .55, -size * .55); ctx.lineTo(size * .35, -size); ctx.lineTo(size, size * .18); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "rgba(16,38,34,.55)"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore(); }
    ctx.restore();
  };
  const dungeonStoryFrame = (label = "") => ({ BRASS: 0, ROOT: 0, MOON: 1, TIDE: 2, ASH: 3, WARDEN: 0, HEART: 3, OPEN: 3 }[label] ?? 0);
  const drawDungeonCarving = (x, y, radius = 34, color = "#8db7a1", label = "") => {
    const frame = dungeonStoryFrame(label);
    if (drawOptionalSprite("dungeon-story-props", x, y + 5, { frame, width: radius * 2.7, height: radius * 2.7, anchorX: .5, anchorY: .9, alpha: .94 })) { drawShadow(x, y + radius * .9, radius * .72, radius * .18, .24); return; }
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = .7; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = .34; ctx.beginPath(); ctx.arc(0, 0, radius * .66, -.5, Math.PI * 1.5); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-radius * .55, 0); ctx.lineTo(0, -radius * .42); ctx.lineTo(radius * .55, 0); ctx.moveTo(-radius * .35, radius * .28); ctx.lineTo(0, radius * .5); ctx.lineTo(radius * .35, radius * .28); ctx.stroke(); if (label) { ctx.globalAlpha = .8; ctx.fillStyle = color; ctx.font = "700 8px DM Mono"; ctx.textAlign = "center"; ctx.fillText(label, 0, 3); } ctx.restore();
  };
  const drawDungeonStatue = (x, y, scale = 1, damaged = false, time = 0) => {
    const frame = damaged ? 5 : 4;
    if (drawOptionalSprite("dungeon-story-props", x, y + 8 * scale, { frame, width: 132 * scale, height: 132 * scale, anchorX: .5, anchorY: .92, alpha: .97 })) { drawShadow(x, y + 25 * scale, 28 * scale, 7 * scale, .3); return; }
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); drawShadow(0, 22, 28, 7, .3); ctx.fillStyle = "#485b57"; ctx.fillRect(-21, 10, 42, 12); ctx.fillStyle = "#71877c"; ctx.beginPath(); ctx.moveTo(-14, 12); ctx.lineTo(-10, -24); ctx.lineTo(0, -36); ctx.lineTo(11, -23); ctx.lineTo(15, 12); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "rgba(16,38,34,.7)"; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = "#92aa94"; ctx.beginPath(); ctx.arc(0, -25, 8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#334844"; ctx.fillRect(-11, -7, 22, 5); ctx.strokeStyle = damaged ? "rgba(220,142,115,.75)" : "rgba(26,58,49,.52)"; ctx.lineWidth = damaged ? 3 : 1.5; ctx.beginPath(); ctx.moveTo(-8, -14); ctx.lineTo(4, -2); ctx.lineTo(-2, 14); ctx.stroke(); if (damaged) { ctx.fillStyle = "#394a47"; ctx.beginPath(); ctx.moveTo(4, -40); ctx.lineTo(17, -34); ctx.lineTo(11, -22); ctx.closePath(); ctx.fill(); } ctx.globalAlpha = .35 + Math.sin(time * 2 + x) * .08; ctx.fillStyle = COLORS.mint; ctx.beginPath(); ctx.arc(0, -25, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  const drawDungeonMachine = (x, y, scale = 1, active = false, time = 0, theme = "moon") => {
    const frame = theme === "ash" ? 10 : active ? 9 : 8;
    if (drawOptionalSprite("dungeon-story-props", x, y + 10 * scale, { frame, width: 138 * scale, height: 138 * scale, anchorX: .5, anchorY: .92, alpha: .97 })) { drawShadow(x, y + 27 * scale, 40 * scale, 8 * scale, .25); return; }
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); drawShadow(0, 22, 40, 8, .25); ctx.fillStyle = "#354747"; ctx.fillRect(-35, -12, 70, 35); ctx.strokeStyle = "#172c2b"; ctx.lineWidth = 3; ctx.strokeRect(-35, -12, 70, 35); ctx.fillStyle = "#73897d"; ctx.fillRect(-24, -5, 48, 7); ctx.strokeStyle = active ? COLORS.mint : "#9c755e"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 7, 13 + Math.sin(time * 2.2) * 1.5, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-9, 7); ctx.lineTo(9, 7); ctx.moveTo(0, -2); ctx.lineTo(0, 16); ctx.stroke(); ctx.fillStyle = active ? COLORS.mint : "#c88662"; ctx.beginPath(); ctx.arc(0, 7, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#84988a"; ctx.fillRect(-44, 17, 88, 8); ctx.restore();
  };
  const drawDungeonFloorInlay = (x, y, rx, ry, color, style = "ring", time = 0) => {
    const frame = color === "#96b9df" ? 13 : color === "#6ed0c4" ? 14 : color === "#b8735d" ? 14 : (color === "#be8aae" || color === "#d66b92") ? 15 : 12;
    if (drawOptionalSprite("dungeon-story-props", x, y, { frame, width: Math.min(520, rx * 1.55), height: Math.min(320, ry * 1.55), anchorX: .5, anchorY: .5, alpha: .14, rotation: Math.sin(time * .15) * .02 })) return;
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = .38; ctx.strokeStyle = color; ctx.lineWidth = 3; if (style === "ring") { ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, Math.sin(time * .15) * .02, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, 0, rx * .72, ry * .62, 0, 0, Math.PI * 2); ctx.stroke(); } else if (style === "channel") { ctx.beginPath(); ctx.moveTo(-rx, -ry * .2); ctx.quadraticCurveTo(-rx * .35, -ry, rx * .35, -ry * .15); ctx.quadraticCurveTo(rx * .65, ry * .35, rx, ry * .08); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-rx * .7, ry * .32); ctx.lineTo(rx * .72, ry * .32); ctx.stroke(); } else { ctx.beginPath(); ctx.moveTo(-rx, -ry); ctx.lineTo(0, -ry * .45); ctx.lineTo(rx, -ry); ctx.lineTo(rx * .65, ry); ctx.lineTo(0, ry * .45); ctx.lineTo(-rx * .65, ry); ctx.closePath(); ctx.stroke(); } ctx.globalAlpha = .22; ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 0, rx * .35, ry * .22, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  const drawDungeonArchitecture = (time, key) => {
    const [base, stone] = dungeonRoomTint(key); const accent = key === "1-1" ? "#d99072" : key === "2-1" ? "#c77e99" : key === "1-0" ? "#9ebce0" : "#8ebaa1";
    ctx.save(); ctx.globalAlpha = .28; ctx.fillStyle = "#0b1718"; ctx.fillRect(55, 55, ROOM.width - 110, 16); ctx.fillRect(55, ROOM.height - 71, ROOM.width - 110, 16); ctx.fillRect(55, 55, 16, ROOM.height - 110); ctx.fillRect(ROOM.width - 71, 55, 16, ROOM.height - 110); ctx.restore();
    drawDungeonArch(600, 58, 0, stone, key === "1-1"); drawDungeonArch(600, 742, Math.PI, stone, key === "0-1"); drawDungeonArch(58, 400, -Math.PI / 2, stone, key === "1-1"); drawDungeonArch(1142, 400, Math.PI / 2, stone, key === "0-0");
    if (key === "0-0") {
      drawDungeonPillar(297, 250, 54, 120, "#68867b", true); drawDungeonPillar(903, 250, 54, 120, "#68867b", false); drawDungeonFloorInlay(600, 430, 265, 150, "#8bb8a2", "ring", time); drawDungeonCarving(600, 135, 46, accent, "BRASS"); drawDungeonCarving(1020, 620, 34, accent, "ROOT"); drawDungeonRubble(350, 340, 1.1, 5); drawDungeonRubble(845, 515, .8, 9);
    } else if (key === "1-0") {
      drawDungeonPillar(297, 285, 54, 150, "#60788b", false); drawDungeonPillar(903, 285, 54, 150, "#60788b", true); drawDungeonFloorInlay(600, 400, 380, 72, "#96b9df", "channel", time); drawDungeonMachine(600, 248, .85, state.switches, time); drawDungeonCarving(600, 114, 44, accent, "MOON"); drawDungeonRubble(430, 565, .8, 12); drawDungeonRubble(770, 565, .8, 17);
    } else if (key === "2-0") {
      drawDungeonPillar(253, 255, 46, 130, "#74866e", true); drawDungeonPillar(947, 255, 46, 130, "#74866e", true); drawDungeonFloorInlay(600, 400, 235, 175, "#8bb879", "ring", time); drawDungeonStatue(168, 430, .9, true, time); drawDungeonStatue(1032, 430, .9, false, time); drawDungeonRubble(300, 575, .9, 21); drawDungeonRubble(900, 575, .9, 26); drawDungeonCarving(600, 140, 48, accent, "WARDEN");
    } else if (key === "0-1") {
      drawDungeonPillar(340, 300, 80, 180, "#5b8588", true); drawDungeonPillar(860, 490, 80, 180, "#5b8588", false); drawDungeonFloorInlay(600, 390, 310, 190, "#6ed0c4", "channel", time); drawDungeonCarving(600, 135, 44, accent, "TIDE"); drawDungeonRubble(220, 615, .85, 31); drawDungeonRubble(980, 205, .75, 34); ctx.save(); ctx.globalAlpha = .34; ctx.strokeStyle = "#9de3d5"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(180, 58); ctx.bezierCurveTo(180, 140 + Math.sin(time) * 4, 210, 165, 240, 215); ctx.stroke(); ctx.beginPath(); ctx.moveTo(960, 58); ctx.bezierCurveTo(956, 130, 930, 160, 900, 208); ctx.stroke(); ctx.restore();
    } else if (key === "1-1") {
      drawDungeonPillar(195, 150, 48, 110, "#75554d", true); drawDungeonPillar(1005, 150, 48, 110, "#75554d", true); drawDungeonFloorInlay(600, 600, 350, 90, "#b8735d", "channel", time); drawDungeonMachine(600, 130, .9, state.rootlightTested, time, "ash"); drawDungeonStatue(1010, 390, .82, true, time); drawDungeonCarving(600, 228, 42, accent, "ASH"); drawDungeonRubble(360, 220, 1.15, 41); drawDungeonRubble(840, 220, 1.1, 45);
    } else if (key === "2-1") {
      drawDungeonPillar(242, 260, 45, 180, "#74566f", true); drawDungeonPillar(958, 260, 45, 180, "#74566f", true); drawDungeonFloorInlay(600, 390, 270, 210, state.bossPhase === 2 ? "#d66b92" : "#be8aae", "ring", time); drawDungeonCarving(600, 126, 54, accent, state.bossDefeated ? "OPEN" : "HEART"); drawDungeonStatue(160, 470, .85, true, time); drawDungeonStatue(1040, 470, .85, true, time); drawDungeonRubble(290, 625, .9, 51); drawDungeonRubble(910, 625, .9, 56);
    }
    ctx.save(); ctx.globalAlpha = .22; ctx.strokeStyle = "rgba(224,240,208,.5)"; ctx.lineWidth = 1.5; for (let i = 0; i < 8; i += 1) { const x = 120 + i * 137; ctx.beginPath(); ctx.moveTo(x, 77); ctx.lineTo(x + 18, 88); ctx.lineTo(x + 10, 101); ctx.stroke(); } ctx.restore();
  };
  const drawDungeonObstacles = (time, key) => {
    dungeonObstacles().forEach((wall, index) => {
      const boundary = wall.x === 0 || wall.y === 0 || wall.x + wall.w === ROOM.width || wall.y + wall.h === ROOM.height;
      const pillar = wall.type === "pillar";
      const base = boundary ? "#435a55" : pillar ? "#60776d" : wall.type === "wall" ? "#596f68" : "#566861";
      const stone = ctx.createLinearGradient(wall.x, wall.y, wall.x + wall.w, wall.y + wall.h);
      stone.addColorStop(0, base); stone.addColorStop(.46, boundary ? "#304644" : "#526960"); stone.addColorStop(1, "#263b3b");
      ctx.fillStyle = stone; ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.strokeStyle = "rgba(11,27,27,.78)"; ctx.lineWidth = boundary ? 3 : 2; ctx.strokeRect(wall.x + 1, wall.y + 1, Math.max(0, wall.w - 2), Math.max(0, wall.h - 2));
      ctx.fillStyle = "rgba(224,241,214,.15)"; ctx.fillRect(wall.x + 5, wall.y + 5, Math.max(0, wall.w - 10), Math.min(5, Math.max(0, wall.h - 10)));
      if (boundary) {
        ctx.fillStyle = "rgba(6,16,17,.42)"; ctx.fillRect(wall.x, wall.y + wall.h - 10, wall.w, 10);
        ctx.strokeStyle = "rgba(155,188,164,.18)"; ctx.lineWidth = 1.5;
        for (let notch = 0; notch < 5; notch += 1) { const p = (notch + 1) * Math.max(24, wall.w / 6); ctx.beginPath(); ctx.moveTo(wall.x + p, wall.y + 9); ctx.lineTo(wall.x + p + 11, wall.y + 19); ctx.stroke(); }
      } else if (pillar) {
        ctx.fillStyle = "rgba(217,236,208,.2)"; ctx.fillRect(wall.x + 8, wall.y + 11, 5, Math.max(0, wall.h - 22));
        ctx.fillStyle = "#758b7d"; ctx.fillRect(wall.x - 8, wall.y - 7, wall.w + 16, 10); ctx.fillStyle = "#354a46"; ctx.fillRect(wall.x - 10, wall.y + wall.h - 4, wall.w + 20, 10);
        ctx.strokeStyle = "rgba(226,156,121,.58)"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(wall.x + wall.w * .48, wall.y + 20); ctx.lineTo(wall.x + wall.w * .28, wall.y + wall.h * .46); ctx.lineTo(wall.x + wall.w * .62, wall.y + wall.h * .7); ctx.stroke();
      } else {
        ctx.strokeStyle = "rgba(214,157,123,.45)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(wall.x + wall.w * .18, wall.y + wall.h * .2); ctx.lineTo(wall.x + wall.w * .42, wall.y + wall.h * .6); ctx.lineTo(wall.x + wall.w * .3, wall.y + wall.h * .9); ctx.moveTo(wall.x + wall.w * .72, wall.y + wall.h * .12); ctx.lineTo(wall.x + wall.w * .6, wall.y + wall.h * .44); ctx.stroke();
      }
      if (wall.type === "broken-wall" || wall.type === "fallen-stone" || wall.type === "debris") drawDungeonRubble(wall.x + wall.w / 2, wall.y + wall.h / 2 + 10, wall.type === "debris" ? .9 : .72, index + key.length * 3);
    });
  };
  const drawDungeonFloorFocus = (time, key) => {
    const focus = { "0-0": [600, 390, "#8ef2cf"], "1-0": [600, 380, "#b8d9ff"], "2-0": [600, 390, "#b5df91"], "0-1": [600, 390, "#79d3cc"], "1-1": [600, 390, "#ffb37f"], "2-1": [600, 370, state.bossPhase === 2 ? "#ff7c99" : "#d995b8"] }[key] || [600, 390, "#8ef2cf"];
    const [x, y, color] = focus; ctx.save(); ctx.globalCompositeOperation = "screen"; drawLightPool(x, y, key === "2-1" ? 330 : 250, color, key === "2-1" ? .07 : .035); ctx.restore();
    ctx.save(); ctx.globalAlpha = .18; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([5, 12]); ctx.beginPath(); ctx.ellipse(x, y + 24, key === "2-1" ? 250 : 190, key === "2-1" ? 150 : 120, Math.sin(time * .2) * .04, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = .1; ctx.lineWidth = 1; for (let i = 0; i < 4; i += 1) { const radius = 60 + i * 38 + Math.sin(time * .7 + i) * 2; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.stroke(); } ctx.restore();
  };
  const drawDungeonAtmosphere = (time, key) => {
    const bossRoom = key === "2-1"; const tint = bossRoom && state.bossPhase === 2 ? "#d96a8a" : key === "1-1" ? "#d99072" : "#9ed7bd";
    // Low fog hugs the floor and the room edges, leaving the play space clear.
    ctx.save(); ctx.globalAlpha = .16; const floorFog = ctx.createLinearGradient(0, ROOM.height - 210, 0, ROOM.height); floorFog.addColorStop(0, "rgba(12,23,23,0)"); floorFog.addColorStop(1, "rgba(7,13,15,.42)"); ctx.fillStyle = floorFog; ctx.fillRect(42, ROOM.height - 220, ROOM.width - 84, 185);
    ctx.globalAlpha = .07; ctx.fillStyle = tint; for (let i = 0; i < 5; i += 1) { const x = 130 + i * 235 + Math.sin(time * .24 + i) * 20; const y = 585 + Math.sin(time * .35 + i * 1.7) * 15; ctx.beginPath(); ctx.ellipse(x, y, 105 + (i % 2) * 28, 19, -.08, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = .12; ctx.strokeStyle = "#d7ddbc"; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i += 1) { const x = 150 + ((i * 187) % 930) + Math.sin(time * .16 + i) * 10; const y = 150 + ((i * 103) % 410); ctx.beginPath(); ctx.moveTo(x, y + 20); ctx.quadraticCurveTo(x + 15, y - 2, x + 4, y - 20); ctx.stroke(); }
    ctx.restore();
  };
  const drawDungeonLighting = (time, key) => {
    ctx.save(); ctx.globalCompositeOperation = "screen";
    for (let x = 100; x < ROOM.width - 100; x += 180) drawLightPool(x, 68, 82, "#ffd27a", .055);
    if (key === "1-0") drawLightPool(600, 200, 180, "#b8d9ff", .09);
    if (key === "2-0") drawLightPool(600, 390, 150, "#b5df91", .05);
    if (key === "0-1" && state.rootlightWaterway) drawLightPool(600, 390, 190, "#79d3cc", .08);
    if (key === "1-1") drawLightPool(180, 635, 110, "#ffb37f", .1);
    if (key === "2-1") { drawLightPool(600, 370, state.bossPhase === 2 ? 360 : 270, state.bossPhase === 2 ? "#ff5f8d" : "#d995b8", state.bossPhase === 2 ? .14 : .07); [[350, 270], [850, 270], [350, 560], [850, 560]].forEach(([x, y]) => drawLightPool(x, y - 6, 94, state.bossPhase === 2 ? "#ff6b91" : "#9be0b4", state.bossPhase === 2 ? .045 : .025)); }
    ctx.restore();
    // Room falloff is localized: corners recede while the active mechanic stays lit.
    ctx.save(); ctx.globalAlpha = key === "2-1" ? .22 : .16; const edge = ctx.createRadialGradient(ROOM.width / 2, ROOM.height * .46, 180, ROOM.width / 2, ROOM.height * .46, 760); edge.addColorStop(0, "rgba(0,0,0,0)"); edge.addColorStop(.68, "rgba(5,10,12,.08)"); edge.addColorStop(1, "rgba(3,7,9,.82)"); ctx.fillStyle = edge; ctx.fillRect(0, 0, ROOM.width, ROOM.height); ctx.restore();
  };
  const drawDungeonRoots = (time, anchors = []) => {
    anchors.forEach(([x, y, length, flip], index) => {
      const sway = Math.sin(time * .8 + index) * 2; ctx.save(); ctx.translate(x, y); ctx.scale(flip || 1, 1); ctx.strokeStyle = index % 2 ? "#557e63" : "#70966a"; ctx.globalAlpha = .78; ctx.lineWidth = 9; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(24, length * .2 + sway, -18, length * .62, 10, length); ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = "#a3bd78"; ctx.beginPath(); ctx.moveTo(3, 5); ctx.bezierCurveTo(26, length * .25, -8, length * .6, 12, length - 4); ctx.stroke();
      ctx.globalAlpha = .64; ctx.lineWidth = 5; ctx.strokeStyle = "#557e63"; ctx.beginPath(); ctx.moveTo(8, length * .42); ctx.bezierCurveTo(-22, length * .35, -35, length * .5, -46, length * .7); ctx.moveTo(5, length * .7); ctx.bezierCurveTo(29, length * .62, 40, length * .8, 48, length * .94); ctx.stroke();
      ctx.fillStyle = "#8eaa72"; ctx.globalAlpha = .72; ctx.beginPath(); ctx.arc(10, length, 5, 0, Math.PI * 2); ctx.arc(-45, length * .7, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });
  };
  const drawDungeonHazardVisual = (time) => {
    dungeonHazards().forEach((hazard, index) => {
      if (hazard.label === "deep water") {
        if (loadedAssets.has("dungeon-hazards")) {
          drawOptionalSprite("dungeon-hazards", hazard.x + hazard.w / 2, hazard.y + hazard.h / 2, { frame: Math.floor(time * 2.2) % 2, width: hazard.w + 42, height: hazard.h + 42, anchorX: .5, anchorY: .5, alpha: .94 });
        } else {
          ctx.save(); ctx.fillStyle = "rgba(7,24,28,.55)"; ctx.fillRect(hazard.x - 10, hazard.y - 10, hazard.w + 20, hazard.h + 20); ctx.strokeStyle = "rgba(144,220,196,.38)"; ctx.lineWidth = 4; ctx.strokeRect(hazard.x - 6, hazard.y - 6, hazard.w + 12, hazard.h + 12); ctx.restore();
          drawWater(hazard, time); ctx.save(); ctx.globalAlpha = .5; ctx.strokeStyle = "#8bd8c3"; ctx.lineWidth = 2; for (let i = 0; i < 7; i += 1) { const y = hazard.y + 26 + i * 39 + Math.sin(time * 1.4 + i) * 4; ctx.beginPath(); ctx.moveTo(hazard.x + 15, y); ctx.quadraticCurveTo(hazard.x + hazard.w / 2, y - 7, hazard.x + hazard.w - 15, y); ctx.stroke(); } ctx.globalAlpha = .32; ctx.fillStyle = "#c8f0d3"; for (let i = 0; i < 6; i += 1) { const x = hazard.x + 25 + ((i * 71) % Math.max(30, hazard.w - 50)); const y = hazard.y + 20 + ((i * 53) % Math.max(30, hazard.h - 40)); ctx.beginPath(); ctx.ellipse(x, y, 12 + (i % 2) * 5, 3, .12, 0, Math.PI * 2); ctx.fill(); } ctx.restore();
        }
        const feedbackAlpha = clamp((state.hazardCooldown - .34) / .38, 0, .76);
        if (feedbackAlpha > 0 && loadedAssets.has("dungeon-hazards")) drawOptionalSprite("dungeon-hazards", player.x, player.y - 5, { frame: 8 + Math.floor(time * 10) % 2, width: 94, height: 94, anchorX: .5, anchorY: .5, alpha: feedbackAlpha });
      } else {
        if (loadedAssets.has("dungeon-hazards")) {
          const trenchFrame = 4 + Math.floor(time * 2.4 + index * .7) % 4;
          drawOptionalSprite("dungeon-hazards", hazard.x + hazard.w / 2, hazard.y + hazard.h / 2, { frame: trenchFrame, width: hazard.w + 48, height: hazard.h + 28, anchorX: .5, anchorY: .5, alpha: .94 });
        } else {
          ctx.save(); ctx.fillStyle = "rgba(191,73,53,.22)"; ctx.fillRect(hazard.x, hazard.y, hazard.w, hazard.h); ctx.strokeStyle = "rgba(232,151,104,.62)"; ctx.lineWidth = 4; ctx.strokeRect(hazard.x - 4, hazard.y - 4, hazard.w + 8, hazard.h + 8); ctx.fillStyle = "rgba(41,28,28,.7)"; ctx.fillRect(hazard.x - 4, hazard.y - 4, hazard.w + 8, 10); ctx.fillRect(hazard.x - 4, hazard.y + hazard.h - 6, hazard.w + 8, 10); ctx.globalAlpha = .78; for (let i = 0; i < 14; i += 1) { const x = hazard.x + 14 + ((i * 41) % Math.max(20, hazard.w - 24)); const y = hazard.y + hazard.h - 10 - ((time * (26 + i) + i * 37) % Math.max(30, hazard.h - 20)); ctx.fillStyle = i % 2 ? "#f28b5d" : "#ffd37d"; ctx.beginPath(); ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2); ctx.fill(); } ctx.restore();
        }
        const feedbackAlpha = clamp((state.hazardCooldown - .34) / .38, 0, .76);
        if (feedbackAlpha > 0 && loadedAssets.has("dungeon-hazards")) drawOptionalSprite("dungeon-hazards", player.x, player.y - 6, { frame: 10 + Math.floor(time * 7) % 2, width: 86, height: 86, anchorX: .5, anchorY: .5, alpha: feedbackAlpha });
      }
      if (index === 0) { ctx.fillStyle = "rgba(255,230,168,.45)"; ctx.font = "11px DM Mono"; ctx.textAlign = "center"; ctx.fillText(hazard.label.toUpperCase(), hazard.x + hazard.w / 2, hazard.y - 12); }
    });
  };
  const drawDungeonHazardThresholds = (time, key) => {
    if (!loadedAssets.has("dungeon-hazards")) return;
    const breathe = .68 + Math.sin(time * .7 + key.length) * .05;
    if (key === "0-1") {
      // A small inlet and sigil make the flooded room read as a connected
      // waterway instead of one isolated rectangle. They are visual-only.
      drawOptionalSprite("dungeon-hazards", 166, 274, { frame: 13, width: 148, height: 108, anchorX: .5, anchorY: .5, alpha: breathe, rotation: -Math.PI / 2 });
      drawOptionalSprite("dungeon-hazards", 260, 646, { frame: 12, width: 154, height: 96, anchorX: .5, anchorY: .5, alpha: .58, rotation: .08 });
      drawOptionalSprite("dungeon-hazards", 960, 650, { frame: 14, width: 94, height: 94, anchorX: .5, anchorY: .5, alpha: .8 });
    } else if (key === "1-1") {
      // The ash threshold sits against the north wall, framing the room's
      // entrance without competing with the two damaging trenches.
      drawOptionalSprite("dungeon-hazards", 600, 142, { frame: 15, width: 160, height: 106, anchorX: .5, anchorY: .5, alpha: breathe, rotation: 0 });
      drawOptionalSprite("dungeon-hazards", 360, 635, { frame: 14, width: 88, height: 88, anchorX: .5, anchorY: .5, alpha: .7 });
    }
  };
  const drawBossArenaBackdrop = (time) => {
    const phaseTwo = state.bossPhase === 2; const accent = phaseTwo ? "#d66b92" : "#8ab879"; const glow = phaseTwo ? "rgba(255,102,145,.22)" : "rgba(151,222,177,.12)";
    ctx.save();
    ctx.globalAlpha = .72; ctx.fillStyle = "#111d24"; ctx.beginPath(); ctx.moveTo(300, 176); ctx.lineTo(360, 126); ctx.lineTo(840, 126); ctx.lineTo(900, 176); ctx.lineTo(900, 260); ctx.lineTo(300, 260); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(202,224,209,.22)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(318, 170); ctx.lineTo(365, 139); ctx.lineTo(835, 139); ctx.lineTo(882, 170); ctx.stroke();
    ctx.globalAlpha = .38; ctx.strokeStyle = accent; ctx.lineWidth = phaseTwo ? 4 : 2; ctx.beginPath(); ctx.arc(600, 272, 82 + Math.sin(time * 1.6) * 2, Math.PI, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(600, 272, 108, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = .6; ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(600, 280, phaseTwo ? 122 : 94, 0, Math.PI * 2); ctx.fill();
    // A broken altar behind the boss makes the arena read as a specific place, not a cleared room.
    const altarFrame = state.bossDefeated ? 3 : phaseTwo ? 2 : state.bossArenaPulse > 0 ? 1 : 0;
    const customAltar = drawSanctumSprite(altarFrame, 600, 270, { width: 238, height: 146, anchorY: .86 });
    if (!customAltar) { ctx.globalAlpha = .9; ctx.fillStyle = "#3a4248"; ctx.fillRect(518, 238, 164, 24); ctx.fillStyle = "#66736d"; ctx.fillRect(532, 232, 136, 7); ctx.fillStyle = "#26343a"; ctx.fillRect(548, 262, 104, 18); ctx.strokeStyle = "rgba(220,237,211,.22)"; ctx.lineWidth = 2; ctx.strokeRect(548, 262, 104, 18); }
    ctx.strokeStyle = phaseTwo ? "rgba(255,154,157,.7)" : "rgba(184,228,193,.45)"; ctx.lineWidth = phaseTwo ? 3 : 2; ctx.beginPath(); ctx.moveTo(600, 250); ctx.lineTo(600, 296); ctx.moveTo(578, 275); ctx.lineTo(600, 292); ctx.lineTo(622, 275); ctx.stroke();
    ctx.globalAlpha = .55; ctx.strokeStyle = "#627a70"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(335, 190); ctx.lineTo(300, 244); ctx.lineTo(326, 286); ctx.moveTo(865, 190); ctx.lineTo(900, 244); ctx.lineTo(874, 286); ctx.stroke();
    ctx.restore();
    if (phaseTwo) {
      ctx.save(); ctx.globalAlpha = .5; ctx.strokeStyle = "#d66b92"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(344, 205); ctx.lineTo(306, 238); ctx.lineTo(330, 275); ctx.moveTo(856, 205); ctx.lineTo(894, 238); ctx.lineTo(870, 275); ctx.moveTo(424, 565); ctx.lineTo(470, 534); ctx.lineTo(452, 495); ctx.moveTo(776, 565); ctx.lineTo(730, 534); ctx.lineTo(748, 495); ctx.stroke(); ctx.restore();
    }
  };
  const drawSanctumSprite = (frame, x, y, options = {}) => drawOptionalSprite("sanctum-kit", x, y, { frame, width: options.width || 128, height: options.height || 128, anchorX: .5, anchorY: options.anchorY ?? .82, alpha: options.alpha ?? 1, rotation: options.rotation || 0 });
  const drawBossArenaEffects = (time) => {
    const phaseTwo = state.bossPhase === 2; const pylonColor = phaseTwo ? "#d66b92" : "#8ab879"; const pylonGlow = phaseTwo ? "rgba(255,154,157,.78)" : "rgba(142,242,207,.62)";
    [[350, 270], [850, 270], [350, 560], [850, 560]].forEach(([x, y], index) => {
      if (drawSanctumSprite(phaseTwo ? 6 : state.bossArenaPulse > 0 ? 5 : 4, x, y - 3, { width: 98, height: 126, anchorY: .9 })) return;
      const pulse = Math.sin(time * 2.3 + index) * 2; ctx.save(); ctx.globalAlpha = .82; drawShadow(x, y + 18, 32, 9, .38);
      ctx.fillStyle = "#303b43"; ctx.fillRect(x - 21, y + 12, 42, 10); ctx.fillStyle = "#596a6b"; ctx.fillRect(x - 16, y - 30, 32, 43); ctx.fillStyle = pylonColor; ctx.fillRect(x - 7, y - 26, 14, 37);
      ctx.strokeStyle = pylonGlow; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 6, 22 + pulse, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y - 6, 30 + pulse * .5, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = phaseTwo ? "#ffb2bd" : "#e2f6c9"; ctx.beginPath(); ctx.moveTo(x, y - 23); ctx.lineTo(x + 7, y - 7); ctx.lineTo(x, y + 1); ctx.lineTo(x - 7, y - 7); ctx.closePath(); ctx.fill();
      if (state.bossArenaPulse > 0) { ctx.globalAlpha = clamp(state.bossArenaPulse * .38, 0, .45); ctx.fillStyle = phaseTwo ? "#ff9a9d" : "#ffd77b"; ctx.beginPath(); ctx.arc(x, y - 6, 42 + pulse, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    });
    const ringFrame = state.bossDefeated ? 11 : phaseTwo ? 10 : state.bossArenaPulse > 0 ? 9 : 8;
    const ringPieces = [[600, 190, 0], [780, 370, Math.PI / 2], [600, 550, Math.PI], [420, 370, -Math.PI / 2]];
    const customRing = ringPieces.every(([x, y, rotation]) => drawSanctumSprite(ringFrame, x, y, { width: 188, height: 92, anchorY: .5, rotation }));
    if (!customRing) { ctx.save(); ctx.globalAlpha = phaseTwo ? .42 : .2; ctx.strokeStyle = phaseTwo ? "#d66b92" : "#8ab879"; ctx.lineWidth = phaseTwo ? 4 : 2;
      for (let i = 0; i < 4; i += 1) { const angle = time * (phaseTwo ? .35 : .18) + i * Math.PI / 2; const inner = phaseTwo ? 118 : 138; const outer = phaseTwo ? 286 : 250; ctx.beginPath(); ctx.moveTo(600 + Math.cos(angle) * inner, 370 + Math.sin(angle) * inner); ctx.lineTo(600 + Math.cos(angle) * outer, 370 + Math.sin(angle) * outer); ctx.stroke(); }
      if (phaseTwo) { ctx.globalAlpha = .28; ctx.lineWidth = 2; for (let i = 0; i < 8; i += 1) { const angle = time * .55 + i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(600 + Math.cos(angle) * 88, 370 + Math.sin(angle) * 88); ctx.lineTo(600 + Math.cos(angle) * 286, 370 + Math.sin(angle) * 286); ctx.stroke(); } }
      ctx.restore(); }
  };
  const drawBossDefeatRemnant = (time) => {
    if (state.bossDefeatTimer <= 0) return;
    const progress = clamp((5.8 - state.bossDefeatTimer) / 5.8, 0, 1); const fade = clamp(1 - progress * 1.18, 0, 1); const radius = 39 * (1 - progress * .72);
    ctx.save(); ctx.translate(state.bossDefeatX, state.bossDefeatY); ctx.globalAlpha = fade; ctx.rotate(progress * .55); ctx.fillStyle = "#5d315d"; ctx.beginPath(); ctx.arc(0, 0, Math.max(3, radius), 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = COLORS.rose; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, radius + 8 + Math.sin(time * 10) * 3, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 2; for (let i = 0; i < 8; i += 1) { const angle = i * Math.PI / 4 + time * .8; ctx.beginPath(); ctx.moveTo(Math.cos(angle) * 9, Math.sin(angle) * 9); ctx.lineTo(Math.cos(angle) * (radius + 24), Math.sin(angle) * (radius + 24)); ctx.stroke(); } ctx.fillStyle = COLORS.gold; ctx.beginPath(); ctx.arc(0, 0, 8 + Math.sin(time * 9) * 2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  const drawDungeonRoomProps = (time, key) => {
    // The ambient-props atlas supplies small authored landmarks between the
    // larger architecture pieces. They are visual-only and intentionally sit
    // outside collision rectangles so the dungeon remains mechanically stable.
    const ambient = (frame, x, y, width = 108, height = width, alpha = .9, rotation = 0) => {
      if (!loadedAssets.has("dungeon-ambient-props")) return false;
      return drawOptionalSprite("dungeon-ambient-props", x, y, { frame, width, height, anchorY: .9, alpha, rotation });
    };
    if (key === "0-0") {
      drawDungeonRoots(time, [[110, 72, 185, 1], [1080, 72, 185, -1], [95, 650, -130, 1], [1100, 650, -130, -1]]);
      ambient(2, 338, 542, 96, 96, .78); ambient(8, 936, 148, 104, 112, .82); ambient(15, 1002, 590, 96, 96, .78);
      ctx.fillStyle = "#3c5148"; ctx.fillRect(350, 305, 500, 16); ctx.fillStyle = "#718f75"; ctx.fillRect(350, 302, 500, 4); drawChest(600, 390, state.chestOpened); drawRune(600, 160, "KEY"); drawRune(990, 640, state.rootlightGalleryOpen ? "OPEN" : "DORMANT"); if (state.rootlightGalleryOpen) drawChest(990, 640, state.rootlightGalleryCacheOpened);
      ctx.fillStyle = "rgba(213,255,209,.4)"; ctx.font = "12px DM Mono"; ctx.textAlign = "center"; ctx.fillText("THE FIRST LOCK REMEMBERS BRASS", 600, 470);
    } else if (key === "1-0") {
      drawDungeonRoots(time, [[120, 90, 150, 1], [1080, 90, 150, -1]]);
      ambient(1, 252, 526, 94, 104, .8); ambient(7, 948, 526, 104, 104, .8);
      if (state.rootlightMoonBridge && (loadedAssets.has("dungeon-bridge") || loadedAssets.has("dungeon-ambient-props"))) {
        // The dedicated bridge family keeps the shortcut readable as a real
        // threshold state while the ambient-props cell remains a safe fallback.
        ctx.save(); ctx.globalCompositeOperation = "screen"; drawLightPool(600, 620, 138, COLORS.mint, .075); ctx.restore();
        const bridgeKey = loadedAssets.has("dungeon-bridge") ? "dungeon-bridge" : "dungeon-ambient-props";
        const bridgeFrame = bridgeKey === "dungeon-bridge" ? 4 + Math.floor(time * 1.4) % 4 : 10;
        drawOptionalSprite(bridgeKey, 600, 620, { frame: bridgeFrame, width: 350, height: 166, anchorX: .5, anchorY: .86, alpha: .98 });
        ctx.save(); ctx.globalAlpha = .64 + Math.sin(time * 2.2) * .08; ctx.fillStyle = COLORS.mint; for (let i = 0; i < 5; i += 1) { const x = 474 + i * 63; const y = 600 + Math.sin(time * 1.5 + i) * 5; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill(); } ctx.restore();
      } else {
        ambient(10, 414, 638, 122, 94, .76);
        ctx.save(); ctx.globalAlpha = .32; ctx.fillStyle = "#0e1a1b"; ctx.fillRect(492, 606, 216, 34); ctx.restore();
      }
      const moon = ctx.createRadialGradient(600, 205, 5, 600, 205, 200); moon.addColorStop(0, "rgba(179,220,255,.16)"); moon.addColorStop(1, "rgba(179,220,255,0)"); ctx.fillStyle = moon; ctx.fillRect(330, 70, 540, 360);
      ctx.strokeStyle = "rgba(192,225,255,.2)"; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(600, 200, 130, Math.PI, Math.PI * 2); ctx.stroke(); drawSwitch(600, 380, state.switches, time); drawRune(600, 150, state.switches ? "MOON LIT" : "MOON");
      drawRune(600, 620, state.rootlightMoonBridge ? "BRIDGE" : "DORMANT"); ctx.fillStyle = "rgba(218,240,255,.5)"; ctx.font = "11px DM Mono"; ctx.textAlign = "center"; ctx.fillText(state.switches ? "THE LOWER GATE BREATHES" : "A SWITCH SLEEPS BELOW THE MOON", 600, 474);
    } else if (key === "2-0") {
      drawDungeonRoots(time, [[100, 100, 230, 1], [1100, 100, 230, -1], [170, 680, -170, 1], [1030, 680, -170, -1]]);
      ambient(8, 180, 214, 100, 112, .78); ambient(15, 1000, 590, 96, 96, .76); ambient(5, 876, 636, 108, 92, .74);
      ctx.save(); ctx.globalAlpha = .35; ctx.strokeStyle = "#8ab879"; ctx.lineWidth = 3; ctx.setLineDash([8, 9]); ctx.beginPath(); ctx.arc(600, 390, 210 + Math.sin(time * 1.5) * 4, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); drawRune(600, 140, state.miniBossDefeated ? "OPEN" : "WARDEN");
      ctx.fillStyle = "rgba(192,231,166,.45)"; ctx.font = "11px DM Mono"; ctx.textAlign = "center"; ctx.fillText(state.miniBossDefeated ? "A LIVING ROOT BRIDGE LEADS SOUTH" : "THE GARDEN KEEPS ITS OWN LAW", 600, 700);
    } else if (key === "0-1") {
      drawDungeonRoots(time, [[105, 100, 160, 1], [1060, 650, -180, -1]]);
      if (state.rootlightWaterway) {
        // Cell 3 is the authored Rootlight-parted wet floor. It keeps the
        // same footprint as the hazard, but removes the damaging water read.
        if (!drawOptionalSprite("dungeon-hazards", 600, 390, { frame: 3, width: 422, height: 322, anchorX: .5, anchorY: .5, alpha: .92 })) drawWater({ x: 410, y: 250, w: 380, h: 280 }, time);
      } else drawDungeonHazardVisual(time);
      drawDungeonHazardThresholds(time, key);
      drawChest(600, 390, state.heartChestOpened); drawRune(600, 150, "HEART");
      ambient(4, 222, 216, 108, 112, .82); ambient(3, 1002, 176, 96, 112, .76); ambient(9, 982, 616, 104, 104, .74);
      ctx.fillStyle = "#566e68"; ctx.fillRect(130, 540, 200, 18); ctx.fillRect(870, 230, 200, 18); ctx.fillStyle = "#9bb7a3"; ctx.fillRect(150, 535, 160, 5); ctx.fillRect(890, 225, 160, 5);
      drawRune(960, 650, state.rootlightWaterway ? "WATER PARTED" : "DORMANT"); if (state.rootlightWaterway) { ctx.save(); ctx.globalAlpha = .75; ctx.fillStyle = "#c0d4b4"; for (let i = 0; i < 6; i += 1) { const x = 470 + i * 55; const y = 390 + Math.sin(i * 1.7) * 35; ctx.beginPath(); ctx.ellipse(x, y, 18, 9, -.2, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); } ctx.fillStyle = "rgba(188,239,218,.45)"; ctx.font = "11px DM Mono"; ctx.textAlign = "center"; ctx.fillText(state.heartChestOpened ? "THE WATER REMEMBERS YOUR FOOTSTEPS" : "CROSS THE FLOOD · TAKE ONLY WHAT YOU NEED", 600, 690);
    } else if (key === "1-1") {
      drawDungeonRoots(time, [[105, 70, 200, 1], [1080, 70, 200, -1]]); drawDungeonHazardVisual(time); drawDungeonHazardThresholds(time, key);
      ambient(13, 300, 208, 116, 92, .74); ambient(11, 972, 600, 100, 104, .8); ambient(14, 226, 498, 96, 96, .72);
      ctx.fillStyle = "#6d4b43"; ctx.fillRect(420, 180, 360, 20); ctx.fillStyle = "#b88363"; ctx.fillRect(440, 177, 120, 4); ctx.fillRect(620, 177, 120, 4);
      ctx.fillStyle = state.ashCacheOpened ? "rgba(255,190,116,.33)" : "rgba(255,126,95,.24)"; ctx.beginPath(); ctx.arc(180, 635, 58 + Math.sin(time * 2) * 3, 0, Math.PI * 2); ctx.fill(); drawChest(180, 635, state.ashCacheOpened); drawRune(180, 552, state.ashCacheOpened ? "LANTERN" : "CACHE"); drawRune(360, 635, state.rootlightTested ? "AWAKE" : "TRY HERE"); drawRune(600, 370, "ASH GATE");
      ctx.fillStyle = "rgba(255,202,164,.48)"; ctx.font = "11px DM Mono"; ctx.textAlign = "center"; ctx.fillText(state.ashCacheOpened ? "THE ASH LIFT OPENS A QUIET WAY BACK" : "LOOK BEHIND THE BROKEN WALL", 600, 690);
    } else if (key === "2-1") {
      drawDungeonRoots(time, [[90, 82, 180, 1], [1110, 82, 180, -1]]); drawBossArenaBackdrop(time); drawBossArenaEffects(time); drawRune(600, 130, state.bossDefeated ? "HEARTSEED" : state.bossPhase === 2 ? "HEART UNBOUND" : "SANCTUM");
      ambient(13, 298, 624, 112, 92, .68); ambient(14, 902, 624, 96, 96, .68);
      ctx.save(); ctx.globalAlpha = .4; ctx.strokeStyle = state.bossDefeated ? "#ffd77b" : "#b95a90"; ctx.lineWidth = 4; for (let i = 0; i < 3; i += 1) { ctx.beginPath(); ctx.arc(600, 370, 85 + i * 42 + Math.sin(time * 1.4 + i) * 3, 0, Math.PI * 2); ctx.stroke(); } ctx.restore();
      ctx.fillStyle = "#66506b"; ctx.fillRect(500, 170, 200, 18); ctx.fillStyle = "#b39ac2"; ctx.fillRect(540, 164, 120, 6); if (state.bossDefeated) drawReward(600, 230, time); else { ctx.fillStyle = "rgba(239,186,224,.44)"; ctx.font = "11px DM Mono"; ctx.textAlign = "center"; ctx.fillText("THE HEARTSEED WAITS BEYOND THE GUARDIAN", 600, 700); }
    }
  };
  const drawDungeon = (time) => {
    const key = `${state.roomX}-${state.roomY}`;
    drawDungeonMasonry(time, key);
    drawDungeonFloorSurface(time, key);
    drawDungeonFloorFocus(time, key);
    drawDungeonObstacles(time, key);
    drawDungeonArchitecture(time, key);
    drawDungeonRoomProps(time, key);
    if (key === "2-1" && state.bossPhase === 2 && !state.bossDefeated) { const roseWash = ctx.createRadialGradient(600, 370, 70, 600, 370, 520); roseWash.addColorStop(0, "rgba(177,45,91,.18)"); roseWash.addColorStop(1, "rgba(177,45,91,0)"); ctx.fillStyle = roseWash; ctx.fillRect(50, 50, ROOM.width - 100, ROOM.height - 100); }
    drawDungeonAtmosphere(time, key);
    drawBossDefeatRemnant(time);
    drawDungeonDoors(time);
    drawDungeonMotes(time);
    drawDungeonLighting(time, key);
  };
  const drawTorch = (x, y, time) => {
    const flicker = Math.sin(time * 8 + x) * 2;
    if (drawOptionalSprite("dungeon-architecture", x, y + 18, { frame: 14, width: 92, height: 132, anchorY: .88, alpha: .98 })) {
      const glow = ctx.createRadialGradient(x, y - 5, 2, x, y - 5, 86); glow.addColorStop(0, "rgba(255,214,123,.42)"); glow.addColorStop(.3, "rgba(255,172,91,.14)"); glow.addColorStop(1, "rgba(255,214,123,0)"); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y - 5, 86, 0, Math.PI * 2); ctx.fill(); return;
    }
    drawDirectionalShadow(x, y + 25, 30, 7, .1, -.16); ctx.fillStyle = "#6d4934"; ctx.fillRect(x - 4, y, 8, 30); ctx.fillStyle = "#a7774a"; ctx.fillRect(x - 2, y + 3, 3, 24); const glow = ctx.createRadialGradient(x, y - 2, 2, x, y - 2, 82); glow.addColorStop(0, "rgba(255,214,123,.5)"); glow.addColorStop(.28, "rgba(255,172,91,.16)"); glow.addColorStop(1, "rgba(255,214,123,0)"); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y - 2, 82, 0, Math.PI * 2); ctx.fill(); const flame = ctx.createLinearGradient(x, y - 21 + flicker, x, y + 3); flame.addColorStop(0, "#fff5be"); flame.addColorStop(.42, COLORS.gold); flame.addColorStop(1, "#df714c"); ctx.fillStyle = flame; ctx.beginPath(); ctx.moveTo(x, y - 24 + flicker); ctx.quadraticCurveTo(x + 11, y - 10, x, y + 2); ctx.quadraticCurveTo(x - 11, y - 10, x, y - 24 + flicker); ctx.fill(); ctx.save(); ctx.globalAlpha = .18; ctx.strokeStyle = "#d0d7bd"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 5, y - 22); ctx.quadraticCurveTo(x + 14, y - 38 + Math.sin(time * 1.2 + x) * 3, x + 4, y - 51); ctx.stroke(); ctx.restore();
  };
  const drawRune = (x, y, label) => {
    const frame = label === "KEY" || label === "BRASS" ? 4 : label === "MOON" || label === "MOON LIT" ? 5 : label === "TIDE" || label === "WATER PARTED" ? 6 : label === "HEART" || label === "HEARTSEED" || label === "HEART UNBOUND" || label === "SANCTUM" ? 7 : label === "TRY HERE" ? 10 : label === "AWAKE" ? 11 : 4;
    if (drawOptionalSprite("dungeon-landmarks", x, y, { frame, width: 92, height: 92, anchorY: .5, alpha: .98 })) return;
    ctx.save(); ctx.globalAlpha = .85; ctx.fillStyle = "rgba(142,242,207,.07)"; ctx.beginPath(); ctx.arc(x, y, 42, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "rgba(142,242,207,.34)"; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = .5; ctx.strokeStyle = "rgba(197,246,211,.5)"; ctx.lineWidth = 1; for (let i = 0; i < 6; i += 1) { const angle = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(x + Math.cos(angle) * 31, y + Math.sin(angle) * 31); ctx.lineTo(x + Math.cos(angle) * 36, y + Math.sin(angle) * 36); ctx.stroke(); } ctx.fillStyle = "rgba(214,255,220,.55)"; ctx.font = "10px DM Mono"; ctx.textAlign = "center"; ctx.fillText(label, x, y + 4); ctx.restore();
  };
  const drawSwitch = (x, y, active, time) => {
    const pulse = Math.sin(time * 4) * 2;
    if (drawOptionalSprite("dungeon-landmarks", x, y + 3, { frame: active ? 9 : 8, width: 96, height: 96, anchorY: .86, alpha: .98 })) { if (active) drawLightPool(x, y, 60, COLORS.mint, .08); return; }
    drawShadow(x, y + 18, 28, 7, .28); ctx.fillStyle = "#3c504b"; ctx.fillRect(x - 32, y + 12, 64, 10); ctx.fillStyle = active ? "#7bbd9b" : "#546b64"; ctx.beginPath(); ctx.arc(x, y, 27 + pulse, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = active ? "rgba(234,255,213,.84)" : "rgba(198,216,197,.35)"; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = active ? "#f6fff1" : "#243b37"; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = active ? "#ffd77b" : "#6d8a7c"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 7, y + 1); ctx.lineTo(x + 7, y - 6); ctx.stroke(); if (active) { ctx.save(); ctx.globalAlpha = .16; ctx.fillStyle = COLORS.mint; ctx.beginPath(); ctx.arc(x, y, 52 + pulse, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  };
  const drawDungeonMotes = (time) => { ctx.save(); for (let i = 0; i < 24; i += 1) { const x = 75 + ((i * 149) % 1050) + Math.sin(time * (.18 + (i % 3) * .04) + i) * 12; const y = 80 + ((i * 83) % 620) + Math.cos(time * .23 + i) * 9; const alpha = .16 + (Math.sin(time * 1.7 + i) + 1) * .09; ctx.globalAlpha = alpha; ctx.fillStyle = i % 4 === 0 ? "#ffd77b" : "#a8d6bd"; ctx.beginPath(); ctx.arc(x, y, i % 4 === 0 ? 2 : 1.4, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); };
  const drawDungeonDoors = (time) => {
    const key = `${state.roomX}-${state.roomY}`; const doors = [{ side: "north", x: ROOM.width / 2, y: 35, w: 120, h: 34 }, { side: "south", x: ROOM.width / 2, y: ROOM.height - 35, w: 120, h: 34 }, { side: "west", x: 35, y: ROOM.height / 2, w: 34, h: 120 }, { side: "east", x: ROOM.width - 35, y: ROOM.height / 2, w: 34, h: 120 }];
    doors.forEach((door) => {
      let open = true; let locked = false; if (key === "0-0" && door.side === "east") { open = state.key; locked = !state.key; } if (key === "1-0" && door.side === "south") { open = state.switches; locked = !state.switches; } if (key === "2-0" && door.side === "south") { open = state.miniBossDefeated; locked = !state.miniBossDefeated; } if (key === "1-1" && door.side === "west" && !state.ashShortcutOpen) { open = false; locked = true; } if (key === "1-1" && door.side === "east") { open = state.key && state.miniBossDefeated; locked = !open; }
      const horizontal = door.side === "north" || door.side === "south"; const drawX = horizontal ? door.x : (door.side === "west" ? 58 : ROOM.width - 58); const drawY = horizontal ? (door.side === "north" ? 58 : ROOM.height - 58) : door.y;
      ctx.save(); ctx.translate(drawX, drawY); const dw = door.w; const dh = door.h;
      if (loadedAssets.has("dungeon-doors")) {
        const openingProgress = clamp((.5 - (state.transitionCooldown || 0)) / .5, 0, 1);
        const openingFrame = 8 + Math.min(3, Math.floor(openingProgress * 4));
        const openFrame = door.side === "north" ? 0 : door.side === "south" ? 1 : door.side === "west" ? 2 : 3;
        const lockedFrame = key === "0-0" && door.side === "east" ? 12 : key === "1-0" && door.side === "south" ? 13 : key === "2-0" && door.side === "south" ? 14 : key === "1-1" && door.side === "west" ? 15 : 12;
        const frame = open ? ((state.transitionCooldown || 0) > 0 ? openingFrame : openFrame) : lockedFrame;
        drawOptionalSprite("dungeon-doors", 0, 0, { frame, width: 124, height: 82, anchorX: .5, anchorY: .9, rotation: horizontal ? 0 : Math.PI / 2, alpha: .98 });
        ctx.restore();
        return;
      }
      ctx.fillStyle = "#142323"; ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
      if (open) {
        const opening = ctx.createLinearGradient(0, -dh / 2, 0, dh / 2); opening.addColorStop(0, "rgba(11,24,25,.94)"); opening.addColorStop(1, "rgba(36,74,67,.62)"); ctx.fillStyle = opening; ctx.fillRect(-dw / 2 + 6, -dh / 2 + 5, dw - 12, dh - 10);
        ctx.strokeStyle = "rgba(142,242,207,.74)"; ctx.lineWidth = 3; ctx.strokeRect(-dw / 2 + 4, -dh / 2 + 3, dw - 8, dh - 6); ctx.fillStyle = "rgba(142,242,207,.18)"; ctx.fillRect(-dw / 2 + 12, -dh / 2 + 8, dw - 24, 5);
      } else {
        const gate = ctx.createLinearGradient(0, -dh / 2, 0, dh / 2); gate.addColorStop(0, "#72564e"); gate.addColorStop(1, "#3f373a"); ctx.fillStyle = gate; ctx.fillRect(-dw / 2 + 4, -dh / 2 + 3, dw - 8, dh - 6); ctx.strokeStyle = "rgba(222,164,123,.62)"; ctx.lineWidth = 3; ctx.strokeRect(-dw / 2 + 4, -dh / 2 + 3, dw - 8, dh - 6);
        ctx.strokeStyle = "rgba(42,30,31,.75)"; ctx.lineWidth = 2; const slats = horizontal ? 4 : 3; for (let i = 1; i < slats; i += 1) { const p = horizontal ? -dh / 2 + (dh / slats) * i : -dw / 2 + (dw / slats) * i; ctx.beginPath(); if (horizontal) { ctx.moveTo(-dw / 2 + 7, p); ctx.lineTo(dw / 2 - 7, p); } else { ctx.moveTo(p, -dh / 2 + 7); ctx.lineTo(p, dh / 2 - 7); } ctx.stroke(); }
        ctx.strokeStyle = "#c88a6a"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-dw * .3, -dh * .28); ctx.lineTo(dw * .3, dh * .28); ctx.moveTo(dw * .3, -dh * .28); ctx.lineTo(-dw * .3, dh * .28); ctx.stroke(); ctx.fillStyle = "#d4a46a"; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#5b3b34"; ctx.fillRect(-2, -5, 4, 8);
      }
      ctx.restore();
    });
    ctx.fillStyle = "rgba(216,255,220,.42)"; ctx.font = "10px DM Mono"; ctx.textAlign = "center"; if (key === "0-0" && !state.key) ctx.fillText("BRASS LOCK", ROOM.width - 122, ROOM.height / 2 - 76); if (key === "1-0" && !state.switches) ctx.fillText("MOON GATE", ROOM.width / 2, ROOM.height - 76); if (key === "2-0" && !state.miniBossDefeated) ctx.fillText("WARDEN GATE", ROOM.width / 2, ROOM.height - 76); if (key === "1-1" && !state.ashShortcutOpen) ctx.fillText("ASH LIFT", 112, 286);
  };
  const drawReward = (x, y, time) => { const bob = Math.sin(time * 2.7) * 5; const glow = ctx.createRadialGradient(x, y + bob, 2, x, y + bob, 104); glow.addColorStop(0, "rgba(255,225,145,.58)"); glow.addColorStop(.45, "rgba(255,215,123,.18)"); glow.addColorStop(1, "rgba(255,215,123,0)"); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y + bob, 104, 0, Math.PI * 2); ctx.fill(); if (drawOptionalSprite("dungeon-landmarks", x, y + bob, { frame: 12, width: 112, height: 132, anchorY: .88, alpha: .98 })) return; ctx.save(); ctx.translate(x, y + bob); ctx.rotate(time * .8); ctx.strokeStyle = "rgba(255,245,193,.58)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 28 + Math.sin(time * 2) * 3, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = COLORS.gold; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(15, 0); ctx.lineTo(0, 20); ctx.lineTo(-15, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#fff8c7"; ctx.beginPath(); ctx.arc(-5, -6, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore(); };

  const drawEnemy = (enemy, time) => {
    // All generated enemy cells are anchored at their measured visible base.
    // Keep the contact shadow on that same world-space plane instead of using the
    // older radius-based offset that belonged to the procedural silhouettes.
    const enemyBottoms = [0.942, 0.962, 1, 0.952, 0.856, 0.824, 0.843, 0.856, 0.782, 0.779, 0.843, 0.792, 0.763, 0.75, 0.804, 0.753];
    const mosslingBottoms = [0.997, 0.997, 0.997, 0.997, 0.942, 0.926, 0.955, 0.946, 0.84, 0.785, 0.856, 0.913, 0.712, 0.712, 0.724, 0.724];
    const bossBottoms = [0.92, 0.929, 0.939, 0.929, 0.872, 0.865, 0.862, 0.885, 0.859, 0.856, 0.856, 0.853, 0.827, 0.83, 0.856, 0.856];
    const paintedEnemy = ["boss", "mossling", "thornback", "wisp", "moth", "warden"].includes(enemy.type);
    const groundedShadowY = paintedEnemy ? enemy.y - 1 : enemy.y + enemy.radius * .44;
    if (enemy.dead) {
      const progress = clamp(1 - enemy.deathTimer / Math.max(.01, enemy.deathMax || .6), 0, 1); const fade = 1 - progress; drawShadow(enemy.x, groundedShadowY, enemy.radius * (1.2 - progress * .4), enemy.radius * .28, .28 * fade);
      if (enemy.type === "boss" && loadedAssets.has("boss")) {
        // Guardian collapse cells have intentionally different silhouettes and
        // transparent margins. Keep their visible rubble line on the same ground
        // plane while the separate death offset supplies the upward dissolve.
        const bossDeathBottoms = [0.92, 0.929, 0.939, 0.929, 0.872, 0.865, 0.862, 0.885, 0.859, 0.856, 0.856, 0.853, 0.827, 0.83, 0.856, 0.856];
        const deathFrame = progress < .28 ? 14 : 15;
        drawOptionalSprite("boss", enemy.x, enemy.y - progress * 16, { frame: deathFrame, width: 126 - progress * 18, height: 126 - progress * 18, anchorY: bossDeathBottoms[deathFrame], alpha: fade, rotation: progress * .55 });
        return;
      }
      if (["thornback", "wisp", "moth", "warden"].includes(enemy.type) && loadedAssets.has("enemy-family")) {
        const familyBase = enemy.type === "thornback" ? 0 : enemy.type === "wisp" ? 4 : enemy.type === "moth" ? 8 : 12;
        const familySize = enemy.type === "warden" ? 54 : enemy.type === "moth" ? 38 : enemy.type === "thornback" ? 52 : 42;
        const familyDeathFrame = familyBase + 3;
        drawOptionalSprite("enemy-family", enemy.x, enemy.y - progress * 10, { frame: familyDeathFrame, width: familySize * (1 - progress * .18), height: familySize * (1 - progress * .18), anchorY: enemyBottoms[familyDeathFrame], alpha: fade, rotation: progress * .55 });
        return;
      }
      if (enemy.type === "mossling" && loadedAssets.has("enemy-mossling")) {
        const mosslingDeathFrame = progress < .32 ? 12 : 13;
        drawOptionalSprite("enemy-mossling", enemy.x, enemy.y - progress * 10, { frame: mosslingDeathFrame, width: 34 * (1 - progress * .18), height: 34 * (1 - progress * .18), anchorY: mosslingBottoms[mosslingDeathFrame], alpha: fade, rotation: progress * .55 });
        return;
      }
      ctx.save(); ctx.globalAlpha = fade; ctx.translate(enemy.x, enemy.y - progress * 16); ctx.rotate(progress * 1.4); ctx.scale(.82 + progress * .8, .82 + progress * .8); ctx.strokeStyle = enemy.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, enemy.radius * .75, 0, Math.PI * 2); ctx.stroke(); for (let i = 0; i < 6; i += 1) { const angle = i * Math.PI / 3; const length = enemy.radius * (.7 + progress * .8); ctx.fillStyle = i % 2 ? enemy.color : "#fff2c4"; ctx.beginPath(); ctx.moveTo(Math.cos(angle) * 5, Math.sin(angle) * 5); ctx.lineTo(Math.cos(angle + .16) * length, Math.sin(angle + .16) * length); ctx.lineTo(Math.cos(angle - .16) * length, Math.sin(angle - .16) * length); ctx.closePath(); ctx.fill(); } ctx.restore(); return;
    }
    if (enemy.hidden) { ctx.save(); ctx.globalAlpha = .16 + Math.sin(time * 2 + enemy.orbit) * .04; drawShadow(enemy.x, enemy.y + 9, 15, 5, .35); ctx.fillStyle = "#8e76a5"; ctx.beginPath(); ctx.ellipse(enemy.x, enemy.y, 8, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); return; }
    const recoil = enemy.hitStun > 0 ? Math.sin(enemy.hitStun * 44) * 1.5 : 0;
    const moving = enemy.motionSpeed > 5;
    const bob = moving ? Math.sin(enemy.walk) * (enemy.type === "moth" ? 1.05 : .55) : Math.sin(enemy.animTime * 1.15) * .2;
    const windup = enemy.telegraph > 0 ? clamp(enemy.telegraph / (enemy.stateTimer || enemy.telegraph), 0, 1) : 0;
    const facing = enemy.facingX < -.15 ? -1 : 1;
    // One presentation position drives the painted body, contact shadow and all
    // telegraph art. Keeping these layers together prevents a hopping or recoiling
    // enemy from leaving its warning ring/line behind at the simulation position.
    const presentedX = enemy.x + (enemy.recoilX || 0) + enemy.hitDirectionX * recoil;
    const presentedY = enemy.y + (enemy.recoilY || 0) + bob + enemy.hitDirectionY * recoil;
    const shadowScale = enemy.type === "boss" ? (enemy.phase === 2 ? 1.5 : 1.35) : 1;
    // Match the contact shadow to the same bob/recoil presentation offset as the
    // painted body. This prevents a hopping Mossling or knocked-back Wisp from
    // leaving its shadow behind while still preserving the authored death plane.
    const presentedShadowX = presentedX;
    const presentedShadowY = paintedEnemy ? presentedY - 1 : groundedShadowY;
    drawShadow(presentedShadowX, presentedShadowY, enemy.radius * (enemy.hitStun > 0 ? 1.08 : .92) * shadowScale, enemy.radius * (moving ? .34 : .3) * shadowScale, enemy.type === "boss" ? .44 : .36);
    const familyEnemy = ["thornback", "wisp", "moth", "warden"].includes(enemy.type);
    const customEnemyKey = enemy.type === "boss" ? "boss" : familyEnemy ? "enemy-family" : `enemy-${enemy.type}`;
    const customEnemyBase = enemy.type === "boss" ? (enemy.phase === 2 ? 32 : 0) : enemy.type === "thornback" ? 0 : enemy.type === "wisp" ? 4 : enemy.type === "moth" ? 8 : enemy.type === "warden" ? 12 : 0;
    const mosslingFrame = enemy.hitStun > 0 ? 12 + Math.floor(time * 6) % 2 : (enemy.state === "chargeWindup" || enemy.state === "pounce" || enemy.state === "charging") ? 8 + Math.floor(time * 8) % 4 : moving ? 4 + Math.floor(enemy.walk * 1.2) % 4 : Math.floor(time * 4) % 4;
    const bossFrame = enemy.phase === 2
      ? (enemy.dead ? 15 : enemy.phaseExposed > 0 ? 13 : enemy.state === "phaseShift" ? 12 : enemy.state === "bossWindup" || enemy.state === "bossSlamWindup" || enemy.state === "bossRainWindup" || enemy.state === "bossDashWindup" || enemy.state === "bossDashing" ? 8 + Math.floor(time * 7) % 4 : 8 + Math.floor(time * 3) % 4)
      : (enemy.dead ? 15 : enemy.state === "bossWindup" || enemy.state === "bossSlamWindup" || enemy.state === "bossRainWindup" || enemy.state === "bossDashWindup" || enemy.state === "bossDashing" ? 4 + Math.floor(time * 7) % 4 : Math.floor(time * 3) % 4);
    const familyState = enemy.hitStun > 0 ? 3 : (enemy.state === "chargeWindup" || enemy.state === "rangedWindup" || enemy.state === "ambushWindup" || enemy.state === "meleeWindup") ? 1 : (enemy.state === "charging" || enemy.state === "pounce" || enemy.state === "ranged" || enemy.state === "attack") ? 2 : moving ? 1 + Math.floor(enemy.walk * 1.2) % 2 : 0;
    const customEnemyFrame = enemy.type === "boss" ? bossFrame : enemy.type === "mossling" ? mosslingFrame : familyEnemy ? customEnemyBase + familyState : 0;
    const familySize = enemy.type === "warden" ? 54 : enemy.type === "moth" ? 38 : enemy.type === "thornback" ? 52 : enemy.type === "wisp" ? 42 : enemy.radius * 2.45;
    const familyAnchor = familyEnemy ? enemyBottoms[customEnemyFrame] || .86 : undefined;
    const customAnchor = enemy.type === "boss" ? bossBottoms[customEnemyFrame] || .86 : enemy.type === "mossling" ? mosslingBottoms[customEnemyFrame] || .84 : familyAnchor;
    const customEnemy = drawOptionalSprite(customEnemyKey, presentedX, presentedY, { frame: customEnemyFrame, width: enemy.type === "boss" ? (enemy.phase === 2 ? 112 : 100) : familyEnemy ? familySize : enemy.radius * 2.45, height: enemy.type === "boss" ? (enemy.phase === 2 ? 112 : 100) : familyEnemy ? familySize : enemy.radius * 2.45, anchorY: customAnchor, flipX: facing < 0, alpha: enemy.hitFlash > 0 ? .55 + Math.sin(enemy.hitFlash * 35) * .45 : 1 });
    ctx.save(); ctx.translate(presentedX, presentedY); ctx.scale(facing, 1); ctx.globalAlpha = enemy.hitFlash > 0 ? .55 + Math.sin(enemy.hitFlash * 35) * .45 : 1; ctx.shadowColor = ART.inkSoft; ctx.shadowBlur = 2;
    const color = enemy.color; const squash = enemy.hitStun > 0 ? .86 : enemy.state === "charging" || enemy.state === "pounce" || enemy.state === "bossDashing" ? 1.12 : 1; const stretch = enemy.hitStun > 0 ? 1.1 : enemy.state === "chargeWindup" || enemy.state === "bossDashWindup" ? .86 : 1;
    ctx.scale(squash, stretch);
    if (customEnemy) {
      // The optional sheet is already positioned in world space; keep the procedural
      // branch below dormant while leaving telegraphs and health bars unchanged.
    } else if (enemy.type === "boss") {
      const phaseTwo = enemy.phase === 2; const bossScale = phaseTwo ? 1.42 : 1.26; const float = Math.sin(time * (phaseTwo ? 2.8 : 1.8) + enemy.orbit) * (phaseTwo ? 3.4 : 2.2); const bossRadius = enemy.radius + Math.sin(time * (phaseTwo ? 8 : 5)) * (phaseTwo ? 3 : 2); ctx.translate(0, -float); ctx.scale(bossScale, bossScale);
      const aura = ctx.createRadialGradient(0, 0, 8, 0, 0, phaseTwo ? 70 : 60); aura.addColorStop(0, phaseTwo ? "rgba(255,93,141,.25)" : "rgba(174,222,183,.16)"); aura.addColorStop(.55, phaseTwo ? "rgba(191,63,119,.1)" : "rgba(126,175,156,.06)"); aura.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(0, 0, phaseTwo ? 70 : 60, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = phaseTwo ? "#512342" : "#465667"; ctx.beginPath(); ctx.moveTo(0, -43); ctx.lineTo(16, -30); ctx.lineTo(31, -23); ctx.lineTo(37, 7); ctx.lineTo(27, 35); ctx.lineTo(14, 28); ctx.lineTo(0, 48); ctx.lineTo(-14, 28); ctx.lineTo(-27, 35); ctx.lineTo(-37, 7); ctx.lineTo(-31, -23); ctx.lineTo(-16, -30); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = phaseTwo ? "rgba(245,144,175,.68)" : "rgba(197,227,211,.44)"; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = phaseTwo ? "#8c3f68" : "#63798a"; ctx.beginPath(); ctx.ellipse(-27, -5, 14, 27, -.32, 0, Math.PI * 2); ctx.ellipse(27, -5, 14, 27, .32, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = phaseTwo ? "#3a1c39" : "#263746"; ctx.beginPath(); ctx.arc(0, -18, 19, Math.PI, 0); ctx.lineTo(18, -4); ctx.lineTo(0, 9); ctx.lineTo(-18, -4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = phaseTwo ? "#ff9a9d" : "#d4ad68"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-15, -27); ctx.lineTo(-27, -48); ctx.lineTo(-20, -28); ctx.moveTo(15, -27); ctx.lineTo(27, -48); ctx.lineTo(20, -28); ctx.stroke();
      ctx.fillStyle = phaseTwo ? "#ff9a9d" : "#ffd77b"; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(11, 0); ctx.lineTo(0, 16); ctx.lineTo(-11, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "#fff0c2"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = phaseTwo ? "#ffe2e8" : "#fff8d4"; ctx.beginPath(); ctx.arc(0, 0, 4.5 + Math.sin(time * 7) * .8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = phaseTwo ? "#f06e9a" : "#e5c37c"; ctx.fillRect(-10, -19, 7, 3); ctx.fillRect(3, -19, 7, 3);
      ctx.strokeStyle = phaseTwo ? "rgba(255,151,180,.85)" : "rgba(223,236,205,.58)"; ctx.lineWidth = phaseTwo ? 2.2 : 1.5; ctx.beginPath(); ctx.moveTo(-10, 2); ctx.lineTo(-23, 16); ctx.lineTo(-17, 27); ctx.moveTo(10, 2); ctx.lineTo(23, 16); ctx.lineTo(17, 27); ctx.stroke();
      ctx.globalAlpha = phaseTwo ? .72 : .46; ctx.strokeStyle = phaseTwo ? "#ff739e" : "#b5e0bb"; ctx.lineWidth = phaseTwo ? 3 : 2; ctx.beginPath(); ctx.arc(0, 0, bossRadius + 8 + Math.sin(time * 5) * 2, 0, Math.PI * 2); ctx.stroke();
      if (phaseTwo) {
        ctx.globalAlpha = .86; ctx.strokeStyle = "#f9a4bb"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-5, 6); ctx.lineTo(-17, 20); ctx.lineTo(-11, 34); ctx.moveTo(5, 6); ctx.lineTo(17, 20); ctx.lineTo(11, 34); ctx.moveTo(-8, -4); ctx.lineTo(-22, -12); ctx.moveTo(8, -4); ctx.lineTo(22, -12); ctx.stroke();
        ctx.fillStyle = "#d66b92"; for (let i = 0; i < 8; i += 1) { const angle = time * 1.2 + i * Math.PI / 4; const radius = bossRadius + 17 + Math.sin(time * 2 + i) * 2; ctx.save(); ctx.translate(Math.cos(angle) * radius, Math.sin(angle) * radius); ctx.rotate(angle + Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.restore(); }
      } else { ctx.globalAlpha = .5; ctx.strokeStyle = "#9bd8ad"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, bossRadius + 16 + Math.sin(time * 2) * 2, -1.1, .65); ctx.stroke(); }
    } else if (enemy.type === "warden") {
      ctx.fillStyle = "#2e493f"; ctx.beginPath(); ctx.moveTo(-21, 22); ctx.lineTo(-25, -10); ctx.lineTo(-13, -30); ctx.lineTo(0, -38); ctx.lineTo(13, -30); ctx.lineTo(25, -10); ctx.lineTo(21, 22); ctx.closePath(); ctx.fill(); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(26, 20); ctx.lineTo(0, 27); ctx.lineTo(-26, 20); ctx.closePath(); ctx.fill(); ctx.fillStyle = COLORS.gold; ctx.beginPath(); ctx.arc(0, -3, 8, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "rgba(239,255,217,.55)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-18, 15); ctx.lineTo(-29, 27); ctx.moveTo(18, 15); ctx.lineTo(29, 27); ctx.stroke();
    } else if (enemy.type === "thornback") {
      const tilt = enemy.state === "chargeWindup" ? -.12 : .02; ctx.rotate(tilt); ctx.fillStyle = "#405a46"; ctx.beginPath(); ctx.ellipse(0, 3, enemy.radius + 6, enemy.radius - 1, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, -1, enemy.radius + 3, enemy.radius - 4, -.08, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#7d543d"; for (let i = -1; i <= 1; i += 1) { ctx.beginPath(); ctx.moveTo(i * 10, -10); ctx.lineTo(i * 10 + 6, -24); ctx.lineTo(i * 10 + 12, -8); ctx.closePath(); ctx.fill(); } ctx.fillStyle = "#2c4135"; ctx.beginPath(); ctx.arc(10, -2, 3, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "rgba(225,240,194,.35)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-15, 14); ctx.lineTo(-19, 22); ctx.moveTo(15, 14); ctx.lineTo(19, 22); ctx.stroke();
    } else if (enemy.type === "moth") {
      const flap = .58 + Math.abs(Math.sin(enemy.animTime * 10)) * .42; ctx.scale(1, flap); ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(-9, -3, 12, 8, -.45, 0, Math.PI * 2); ctx.ellipse(9, -3, 12, 8, .45, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#583b62"; ctx.beginPath(); ctx.ellipse(0, 3, 4, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "rgba(241,208,235,.65)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-2, -6); ctx.quadraticCurveTo(-9, -18, -13, -19); ctx.moveTo(2, -6); ctx.quadraticCurveTo(9, -18, 13, -19); ctx.stroke(); ctx.fillStyle = "#ffe7a2"; ctx.beginPath(); ctx.arc(-2, -1, 2, 0, Math.PI * 2); ctx.arc(2, -1, 2, 0, Math.PI * 2); ctx.fill();
    } else if (enemy.type === "wisp") {
      const pulse = 1 + Math.sin(enemy.animTime * 4) * .08; ctx.scale(pulse, pulse); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, -enemy.radius - 5); ctx.quadraticCurveTo(enemy.radius + 4, -3, 0, enemy.radius + 7); ctx.quadraticCurveTo(-enemy.radius - 4, -3, 0, -enemy.radius - 5); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "rgba(220,207,255,.72)"; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = "rgba(235,220,255,.24)"; ctx.beginPath(); ctx.arc(0, 0, enemy.radius + 7 + Math.sin(time * 5) * 2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#fbf1c2"; ctx.beginPath(); ctx.arc(-4, -2, 2, 0, Math.PI * 2); ctx.arc(4, -2, 2, 0, Math.PI * 2); ctx.fill();
    } else {
      const hop = moving ? Math.abs(Math.sin(enemy.walk)) * 2 : 0; ctx.translate(0, -hop); ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 3, enemy.radius + 1, enemy.radius - 1, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#80bb71"; ctx.beginPath(); ctx.arc(-8, -8, 6, 0, Math.PI * 2); ctx.arc(8, -8, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#17362e"; ctx.beginPath(); ctx.arc(-5, -1, 3, 0, Math.PI * 2); ctx.arc(5, -1, 3, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "rgba(239,255,217,.4)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-9, 12); ctx.lineTo(-11, 17); ctx.moveTo(9, 12); ctx.lineTo(11, 17); ctx.stroke();
    }
    if (!customEnemy) { ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.strokeStyle = enemy.type === "boss" && enemy.phase === 2 ? "rgba(255,213,220,.72)" : "rgba(239,255,217,.34)"; ctx.lineWidth = enemy.type === "boss" ? 3 : 2; ctx.beginPath(); ctx.arc(0, 0, enemy.radius * .86, -2.55, -1.05); ctx.stroke(); } ctx.restore();
    if (enemy.type === "boss" && enemy.phaseExposed > 0) { ctx.save(); ctx.globalAlpha = clamp(enemy.phaseExposed * 1.8, 0, .95); ctx.strokeStyle = COLORS.mint; ctx.shadowColor = COLORS.mint; ctx.shadowBlur = 16; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(presentedX, presentedY, enemy.radius + 15 + Math.sin(time * 18) * 3, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0; ctx.strokeStyle = "rgba(255,246,210,.9)"; ctx.lineWidth = 2; for (let i = 0; i < 4; i += 1) { const angle = time * 2 + i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(presentedX + Math.cos(angle) * 10, presentedY + Math.sin(angle) * 10); ctx.lineTo(presentedX + Math.cos(angle + .3) * (enemy.radius + 12), presentedY + Math.sin(angle + .3) * (enemy.radius + 12)); ctx.stroke(); } ctx.restore(); }
    if (enemy.hitStun > 0) { ctx.save(); ctx.globalAlpha = clamp(enemy.hitStun * 5, 0, .85); ctx.strokeStyle = "#fff7dc"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(presentedX, presentedY, enemy.radius + 5 + Math.sin(time * 30) * 2, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    if (enemy.telegraph > 0) {
      const progress = clamp(enemy.telegraph / (enemy.stateTimer || enemy.telegraph), 0, 1);
      if (enemy.type !== "boss" && loadedAssets.has("enemy-effects")) {
        const reveal = 1 - progress;
        const telegraphFrame = enemy.telegraphType === "chargeWindup" ? Math.min(3, Math.floor(reveal * 4)) : enemy.telegraphType === "rangedWindup" ? 4 + Math.min(3, Math.floor(reveal * 4)) : enemy.telegraphType === "ambushWindup" ? 8 + Math.min(3, Math.floor(reveal * 4)) : 12;
        const telegraphAngle = enemy.telegraphType === "rangedWindup" ? Math.atan2(enemy.aimY || player.y - enemy.y, enemy.aimX || player.x - enemy.x) : enemy.telegraphType === "chargeWindup" ? Math.atan2(enemy.chargeY || player.y - enemy.y, enemy.chargeX || player.x - enemy.x) : Math.atan2(player.y - enemy.y, player.x - enemy.x);
        const telegraphWidth = enemy.telegraphType === "rangedWindup" ? 126 : enemy.telegraphType === "chargeWindup" ? 126 : 92;
        const telegraphHeight = enemy.telegraphType === "ambushWindup" ? 94 : 68;
        drawOptionalSprite("enemy-effects", presentedX, presentedY, { frame: telegraphFrame, width: telegraphWidth, height: telegraphHeight, anchorX: .5, anchorY: .5, rotation: telegraphAngle, alpha: .42 + progress * .24 });
      }
      if (enemy.type === "boss" && loadedAssets.has("boss-fx")) {
        const reveal = 1 - progress;
        if (enemy.telegraphType === "bossWindup") {
          const targetAngle = Math.atan2((enemy.aimY || player.y - enemy.y), (enemy.aimX || player.x - enemy.x));
          drawOptionalSprite("boss-fx", presentedX, presentedY, { frame: Math.min(5, Math.floor(reveal * 6)), width: 176, height: 150, anchorX: .16, anchorY: .62, rotation: targetAngle, alpha: .28 + progress * .4 });
        } else if (enemy.telegraphType === "bossSlamWindup") {
          drawOptionalSprite("boss-fx", presentedX, presentedY, { frame: 6 + Math.min(5, Math.floor(reveal * 6)), width: 176 + reveal * 48, height: 176 + reveal * 48, anchorX: .5, anchorY: .5, alpha: .24 + progress * .42 });
        } else if (enemy.telegraphType === "bossDashWindup") {
          const dashAngle = Math.atan2(Number.isFinite(enemy.chargeY) ? enemy.chargeY : player.y - enemy.y, Number.isFinite(enemy.chargeX) ? enemy.chargeX : player.x - enemy.x);
          drawOptionalSprite("boss-fx", presentedX, presentedY, { frame: 12 + Math.min(2, Math.floor(reveal * 3)), width: 206, height: 104, anchorX: .16, anchorY: .5, rotation: dashAngle, alpha: .24 + progress * .38 });
        } else if (enemy.telegraphType === "bossRainWindup") {
          const rainAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
          drawOptionalSprite("boss-fx", player.x, player.y, { frame: 15 + Math.min(2, Math.floor(reveal * 3)), width: 118, height: 118, anchorX: .5, anchorY: .5, rotation: rainAngle, alpha: .18 + progress * .38 });
        }
      }
      ctx.save(); ctx.globalAlpha = .3 + progress * .5; ctx.lineWidth = 3;
      if (enemy.telegraphType === "chargeWindup") { ctx.strokeStyle = "#ffb875"; ctx.beginPath(); ctx.arc(presentedX, presentedY, enemy.radius + 9 + Math.sin(time * 15) * 2, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = "rgba(255,195,125,.75)"; ctx.beginPath(); ctx.moveTo(presentedX, presentedY); ctx.lineTo(presentedX + enemy.chargeX * 110, presentedY + enemy.chargeY * 110); ctx.stroke(); }
      else if (enemy.telegraphType === "rangedWindup" || enemy.telegraphType === "bossWindup" || enemy.telegraphType === "bossRainWindup") {
        const bossTelegraph = enemy.telegraphType !== "rangedWindup"; const targetX = enemy.telegraphType === "bossRainWindup" ? player.x : presentedX + (enemy.aimX || player.x - enemy.x); const targetY = enemy.telegraphType === "bossRainWindup" ? player.y : presentedY + (enemy.aimY || player.y - enemy.y); const angle = Math.atan2(targetY - presentedY, targetX - presentedX); ctx.strokeStyle = enemy.telegraphType === "bossRainWindup" ? "#8ef2cf" : enemy.telegraphType === "bossWindup" ? "#ff9a9d" : "#d9c8ff"; ctx.beginPath(); ctx.moveTo(presentedX, presentedY); ctx.lineTo(targetX, targetY); ctx.stroke(); ctx.beginPath(); ctx.arc(presentedX, presentedY, enemy.radius + (bossTelegraph ? 15 : 9) + Math.sin(time * 12) * 2, 0, Math.PI * 2); ctx.stroke();
        if (enemy.telegraphType === "bossWindup") { const count = enemy.phase === 2 ? 5 : 3; ctx.globalAlpha *= .72; ctx.lineWidth = 2; for (let i = 0; i < count; i += 1) { const spread = (i - (count - 1) / 2) * .22; ctx.beginPath(); ctx.moveTo(presentedX + Math.cos(angle + spread) * 20, presentedY + Math.sin(angle + spread) * 20); ctx.lineTo(presentedX + Math.cos(angle + spread) * 190, presentedY + Math.sin(angle + spread) * 190); ctx.stroke(); } }
        if (enemy.telegraphType === "bossRainWindup") { ctx.globalAlpha = .82; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(player.x, player.y, 22 + (1 - progress) * 18, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(player.x - 28, player.y); ctx.lineTo(player.x + 28, player.y); ctx.moveTo(player.x, player.y - 28); ctx.lineTo(player.x, player.y + 28); ctx.stroke(); }
      }
      else if (enemy.telegraphType === "bossSlamWindup") { ctx.strokeStyle = enemy.phase === 2 ? "#ff9a9d" : "#ffd77b"; ctx.beginPath(); ctx.arc(presentedX, presentedY, 42 + (1 - progress) * 170, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(presentedX, presentedY, enemy.radius + 15 + Math.sin(time * 13) * 3, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha *= .72; ctx.lineWidth = 2; for (let i = 0; i < (enemy.phase === 2 ? 8 : 6); i += 1) { const angle = i * Math.PI * 2 / (enemy.phase === 2 ? 8 : 6) + time * .12; ctx.beginPath(); ctx.moveTo(presentedX + Math.cos(angle) * 36, presentedY + Math.sin(angle) * 36); ctx.lineTo(presentedX + Math.cos(angle) * 130, presentedY + Math.sin(angle) * 130); ctx.stroke(); } }
      else if (enemy.telegraphType === "bossDashWindup") { const dashX = Number.isFinite(enemy.chargeX) ? enemy.chargeX : player.x - enemy.x; const dashY = Number.isFinite(enemy.chargeY) ? enemy.chargeY : player.y - enemy.y; const dashAngle = Math.atan2(dashY, dashX); const dashColor = enemy.phase === 2 ? "#ff9a9d" : "#ffb875"; ctx.strokeStyle = dashColor; ctx.beginPath(); ctx.moveTo(presentedX, presentedY); ctx.lineTo(presentedX + Math.cos(dashAngle) * 260, presentedY + Math.sin(dashAngle) * 260); ctx.stroke(); ctx.globalAlpha *= .42; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(presentedX + Math.cos(dashAngle + Math.PI / 2) * 16, presentedY + Math.sin(dashAngle + Math.PI / 2) * 16); ctx.lineTo(presentedX + Math.cos(dashAngle + Math.PI / 2) * 16 + Math.cos(dashAngle) * 260, presentedY + Math.sin(dashAngle + Math.PI / 2) * 16 + Math.sin(dashAngle) * 260); ctx.moveTo(presentedX + Math.cos(dashAngle - Math.PI / 2) * 16, presentedY + Math.sin(dashAngle - Math.PI / 2) * 16); ctx.lineTo(presentedX + Math.cos(dashAngle - Math.PI / 2) * 16 + Math.cos(dashAngle) * 260, presentedY + Math.sin(dashAngle - Math.PI / 2) * 16 + Math.sin(dashAngle) * 260); ctx.stroke(); ctx.globalAlpha = .8; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(presentedX, presentedY, enemy.radius + 15 + Math.sin(time * 15) * 3, 0, Math.PI * 2); ctx.stroke(); }
      else { ctx.strokeStyle = enemy.type === "moth" ? "#efb7dc" : "#fff0bb"; ctx.beginPath(); ctx.arc(presentedX, presentedY, enemy.radius + 8 + (1 - progress) * 15, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    }
    if (enemy.type === "warden" || enemy.type === "boss") { ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 14, enemy.radius * 2, 4); ctx.fillStyle = enemy.color; ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 14, enemy.radius * 2 * (enemy.hp / enemy.maxHp), 4); }
  };
  const drawDrop = (drop, time) => { const bob = Math.sin(time * 4 + drop.bob) * 4; ctx.save(); ctx.translate(drop.x, drop.y + bob); ctx.globalAlpha = clamp(drop.life / 2, .35, 1); const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 30); glow.addColorStop(0, `${drop.color}99`); glow.addColorStop(1, `${drop.color}00`); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill(); const dropFrame = drop.kind === "bark" ? 13 : drop.kind === "moon" ? 14 : drop.kind === "dust" || drop.kind === "sigil" ? 15 : 12; if (drawOptionalSprite("enemy-effects", 0, 0, { frame: dropFrame, width: 38, height: 38, anchorX: .5, anchorY: .5, alpha: .94 })) { ctx.restore(); return; } ctx.strokeStyle = `${drop.color}66`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 12 + Math.sin(time * 3 + drop.phase) * 2, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = drop.color; ctx.rotate(time * 1.8 + drop.phase); ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(8, 0); ctx.lineTo(0, 10); ctx.lineTo(-8, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = "rgba(255,255,235,.86)"; ctx.beginPath(); ctx.arc(-2, -3, 2, 0, Math.PI * 2); ctx.fill(); ctx.restore(); };
  const drawProjectile = (projectile) => {
    ctx.save();
    const speed = Math.hypot(projectile.vx, projectile.vy) || 1; const angle = Math.atan2(projectile.vy, projectile.vx);
    const projectileFrame = Math.floor(state.visualClock * 12) % 4; if (projectile.kind === "moonbolt" && drawOptionalSprite("enemy-effects", projectile.x, projectile.y, { frame: 7, width: 86, height: 30, rotation: angle, anchorX: .72, anchorY: .5, alpha: .95 })) { ctx.restore(); return; } if (drawOptionalSprite(`projectile-${projectile.kind}`, projectile.x, projectile.y, { frame: projectileFrame, width: projectile.kind === "shockwave" ? 48 : 42, height: projectile.kind === "shockwave" ? 32 : 24, rotation: angle, anchorX: .5, anchorY: .5 })) { ctx.restore(); return; }
    const trail = projectile.kind === "shockwave" ? (projectile.bossAttack ? 42 : 31) : projectile.kind === "root-lance" ? (projectile.bossAttack ? 48 : 38) : projectile.kind === "rosebolt" ? (projectile.bossAttack ? 36 : 28) : 22;
    ctx.globalAlpha = projectile.bossAttack ? .28 : projectile.kind === "shockwave" ? .22 : .18; ctx.strokeStyle = projectile.color; ctx.lineWidth = projectile.bossAttack ? 5 : projectile.kind === "shockwave" ? 5 : 4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(projectile.x, projectile.y); ctx.lineTo(projectile.x - projectile.vx / speed * trail, projectile.y - projectile.vy / speed * trail); ctx.stroke();
    if (projectile.bossAttack) { ctx.globalAlpha = .34; ctx.strokeStyle = projectile.phase === 2 ? "#ffb7c4" : "#fff0b8"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(projectile.x, projectile.y, 13 + Math.sin(projectile.x * .03) * 2, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = .96; ctx.fillStyle = projectile.color; ctx.shadowColor = projectile.color; ctx.shadowBlur = projectile.bossAttack ? 18 : projectile.kind === "shockwave" ? 14 : 10;
    ctx.translate(projectile.x, projectile.y); ctx.rotate(angle);
    if (projectile.kind === "shockwave") {
      ctx.fillStyle = projectile.color; ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(-5, -5); ctx.lineTo(-12, 0); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.72)"; ctx.lineWidth = 1.6; ctx.stroke();
    } else if (projectile.kind === "root-lance") {
      ctx.fillStyle = projectile.color; ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(-7, -7); ctx.lineTo(-3, 0); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(214,255,220,.78)"; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = "rgba(255,255,235,.72)"; ctx.fillRect(-1, -2, 7, 4);
    } else if (projectile.kind === "rosebolt") {
      ctx.fillStyle = projectile.color; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(0, -8); ctx.lineTo(-8, 0); ctx.lineTo(0, 8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(255,239,211,.78)"; ctx.lineWidth = 1.6; ctx.stroke(); ctx.fillStyle = "#fff4ca"; ctx.beginPath(); ctx.arc(1, 0, 2.4, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = projectile.color; ctx.beginPath(); ctx.arc(0, 0, projectile.radius, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.beginPath(); ctx.arc(2, -2, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, projectile.radius + 3, 0, Math.PI * 2); ctx.stroke();
    }
    if (projectile.bossAttack) { ctx.globalAlpha = .62; ctx.strokeStyle = projectile.phase === 2 ? "#ffd4dc" : "#fff5d0"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-15, -7); ctx.lineTo(-22, 0); ctx.lineTo(-15, 7); ctx.moveTo(15, -7); ctx.lineTo(22, 0); ctx.lineTo(15, 7); ctx.stroke(); }
    ctx.restore();
  };
  const drawAttackTrail = (presentedX = player.x, presentedY = player.y) => {
    if (player.attack <= 0) return;
    // The authored directional attack sheet already contains the sword and
    // its green sweep. Drawing fx-slash as a second layer makes the blade look
    // detached and can present a mirrored, opponent-facing swing. Keep the
    // generic effect strictly as a fallback for failed/missing attack art.
    if (loadedAssets.has("player-attack")) return;
    const linearProgress = clamp(player.attackElapsed / .34, 0, 1); const progress = 1 - Math.pow(1 - linearProgress, 2.2); const angle = Math.atan2(player.attackDirectionY, player.attackDirectionX);
    // The authored effect is painted facing right. Mirroring its local
    // horizontal axis for left-facing swings preserves the same readable
    // sweep (rear → tip) instead of rotating the animation 180° and making
    // the motion play backwards. Adding PI to the rotation keeps the mirrored
    // local axis aligned with diagonal/left movement vectors as well.
    const flipTrail = player.attackDirectionX < -.2;
    const trailRotation = angle + (flipTrail ? Math.PI : 0);
    // The slash atlas is painted around a sword-hand origin, not the actor's
    // feet. Offset it along the captured attack vector and use a centered
    // anchor so left/right swings cannot land on the opposite side of the
    // character just because the source cell has transparent padding.
    const slashOriginX = presentedX + player.attackDirectionX * 18;
    const slashOriginY = presentedY + player.attackDirectionY * 14;
    // The first atlas row is a deliberate four-beat sweep: glint, arc, contact, fade.
    // Rotation plus the directional mirror keeps the painted effect readable in all eight movement directions.
    const slashFrame = Math.min(3, Math.floor(linearProgress * 4)); if (drawOptionalSprite("fx-slash", slashOriginX, slashOriginY, { frame: slashFrame, width: 96, height: 64, rotation: trailRotation, anchorX: .5, anchorY: .5, flipX: flipTrail, alpha: clamp(player.attack / .12, 0, 1) })) return;
    ctx.save(); ctx.translate(slashOriginX, slashOriginY); ctx.rotate(trailRotation); if (flipTrail) ctx.scale(-1, 1); ctx.lineCap = "round";
    const anticipation = clamp(linearProgress / .2, 0, 1); const start = -1.02 + progress * .22; const end = -.92 + progress * 1.92; const fade = clamp((player.attack < .12 ? player.attack / .12 : 1), 0, 1);
    if (linearProgress < .3) { ctx.globalAlpha = .18 + anticipation * .24; ctx.strokeStyle = "rgba(255,231,164,.72)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 31, -1.55, -1.05); ctx.stroke(); }
    ctx.globalAlpha = .16 + fade * .42; ctx.strokeStyle = "#fff5d2"; ctx.lineWidth = 15; ctx.beginPath(); ctx.arc(0, 0, 37, start, end); ctx.stroke();
    ctx.globalAlpha = .95 * fade; ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 37, start, end); ctx.stroke();
    ctx.globalAlpha = .92 * fade; ctx.strokeStyle = "#fff9dd"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 37, start, end); ctx.stroke();
    if (linearProgress > .16) { const tipX = Math.cos(end) * 58; const tipY = Math.sin(end) * 58; ctx.globalAlpha = fade * .72; ctx.fillStyle = "#fff4c8"; ctx.beginPath(); ctx.arc(tipX, tipY, 2.5 + fade * 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  };
  const drawParticle = (particle) => {
    const alpha = clamp(particle.life / particle.maxLife, 0, 1); const progress = 1 - alpha;
    // Boss-specific art is optional; the procedural branches below remain the fallback.
    if (particle.kind === "boss-slam-ring" && drawOptionalSprite("boss-fx", particle.x, particle.y, { frame: particle.phasePulse ? 18 : 6 + Math.min(5, Math.floor(progress * 6)), width: particle.phasePulse ? 208 : particle.size * (1.8 + progress * .95), height: particle.phasePulse ? 150 : particle.size * (1.8 + progress * .95), anchorX: .5, anchorY: .5, alpha: alpha * (particle.phasePulse ? .88 : .72), rotation: particle.phasePulse ? progress * .4 : 0 })) return;
    if (particle.kind === "death-ring" && particle.bossFx && drawOptionalSprite("boss-fx", particle.x, particle.y, { frame: 23, width: 220 * (1 - progress * .12), height: 190 * (1 - progress * .12), anchorX: .5, anchorY: .58, alpha: alpha * .86, rotation: progress * .25 })) return;
    if (particle.kind === "death-shards" && particle.bossFx && drawOptionalSprite("boss-fx", particle.x, particle.y, { frame: 19, width: 178 * (1 - progress * .2), height: 178 * (1 - progress * .2), anchorX: .5, anchorY: .5, alpha: alpha * .9, rotation: progress * -.35 })) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(particle.x, particle.y);
    if (particle.kind === "combat-spark") { ctx.rotate(particle.rotation); ctx.strokeStyle = particle.color; ctx.lineWidth = Math.max(1, particle.size * .26) * alpha; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-particle.size * .22, 0); ctx.lineTo(particle.size * (.62 + progress * .5), 0); ctx.stroke(); ctx.lineCap = "butt"; }
    else if (particle.kind === "combat-ring") { ctx.strokeStyle = particle.color; ctx.globalAlpha = alpha * .84; ctx.lineWidth = Math.max(1.2, 3 * alpha); ctx.beginPath(); ctx.arc(0, 0, particle.size * (.2 + progress * 1.7), 0, Math.PI * 2); ctx.stroke(); }
    else if (particle.kind === "impact-glint") { ctx.rotate(particle.rotation); ctx.strokeStyle = particle.color; ctx.lineWidth = 2 * alpha; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-particle.size * 1.8, 0); ctx.lineTo(particle.size * 1.8, 0); ctx.moveTo(0, -particle.size * 1.8); ctx.lineTo(0, particle.size * 1.8); ctx.stroke(); ctx.lineCap = "butt"; }
    else if (particle.kind === "projectile-impact") { ctx.rotate(particle.rotation); ctx.strokeStyle = particle.color; ctx.globalAlpha = alpha * .8; ctx.lineWidth = 2 * alpha; ctx.beginPath(); ctx.arc(0, 0, particle.size * (.25 + progress * 1.1), 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = particle.color; ctx.beginPath(); ctx.moveTo(particle.size * .7, 0); ctx.lineTo(-particle.size * .35, particle.size * .35); ctx.lineTo(-particle.size * .2, 0); ctx.lineTo(-particle.size * .35, -particle.size * .35); ctx.closePath(); ctx.fill(); }
    else if (particle.kind === "boss-slam-ring") { ctx.strokeStyle = particle.color; ctx.globalAlpha = alpha * .65; ctx.shadowColor = particle.color; ctx.shadowBlur = 12; ctx.lineWidth = 4 * alpha; ctx.beginPath(); ctx.arc(0, 0, particle.size * (.12 + progress * 1.9), 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0; }
    else if (particle.kind === "boss-phase-shard") { ctx.rotate(particle.rotation + progress * 1.8); ctx.fillStyle = particle.color; ctx.globalAlpha = alpha * .9; ctx.beginPath(); ctx.moveTo(particle.size * 1.4, 0); ctx.lineTo(-particle.size * .55, particle.size * .6); ctx.lineTo(-particle.size * .2, 0); ctx.lineTo(-particle.size * .55, -particle.size * .6); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "rgba(255,245,213,.76)"; ctx.lineWidth = 1.2; ctx.stroke(); }
    else if (particle.kind === "ring") { ctx.strokeStyle = particle.color; ctx.lineWidth = 3 * alpha; ctx.beginPath(); ctx.arc(0, 0, particle.size * (.45 + progress * .9), 0, Math.PI * 2); ctx.stroke(); }
    else if (particle.kind === "death-ring") { ctx.strokeStyle = particle.color; ctx.shadowColor = particle.color; ctx.shadowBlur = 10; ctx.lineWidth = 4 * alpha; ctx.beginPath(); ctx.arc(0, 0, particle.size * (.25 + progress * 1.55), 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0; }
    else if (particle.kind === "death-shards") { ctx.rotate(progress * 1.5); ctx.strokeStyle = particle.color; ctx.lineWidth = 2 * alpha; for (let i = 0; i < 6; i += 1) { const angle = i * Math.PI / 3; const inner = particle.size * (.18 + progress * .12); const outer = particle.size * (.55 + progress * .7); ctx.beginPath(); ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner); ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer); ctx.stroke(); } }
    else if (particle.kind === "rootlight-ring") { ctx.strokeStyle = particle.color; ctx.shadowColor = particle.color; ctx.shadowBlur = 14; ctx.lineWidth = 5 * alpha; ctx.beginPath(); ctx.arc(0, 0, particle.size * (.4 + progress * 5.2), 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0; }
    else if (particle.kind === "dust") { ctx.fillStyle = particle.color; ctx.scale(1 + progress * .55, .65); ctx.beginPath(); ctx.ellipse(0, 0, particle.size, particle.size * .55, 0, 0, Math.PI * 2); ctx.fill(); }
    else if (particle.kind === "leaf") { ctx.rotate(particle.rotation + progress * 2); ctx.fillStyle = particle.color; ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * .62); }
    else if (particle.kind === "impact") { ctx.rotate(particle.rotation); ctx.fillStyle = particle.color; ctx.beginPath(); ctx.moveTo(0, -particle.size); ctx.lineTo(particle.size * .28, 0); ctx.lineTo(0, particle.size); ctx.lineTo(-particle.size * .28, 0); ctx.closePath(); ctx.fill(); }
    else { ctx.fillStyle = particle.color; ctx.beginPath(); ctx.arc(0, 0, particle.size * (.45 + alpha * .45), 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  };
  const playerPresentationBob = (time) => player.visualState === "move" ? Math.sin(player.walk) * 2 : player.visualState === "idle" ? Math.sin(time * 2.2) * .7 : player.visualState === "attack" ? Math.sin(player.attackElapsed * 22) * .45 : 0;
  const drawPlayer = (time) => {
    const flicker = player.invulnerable > 0 && Math.floor(player.invulnerable * 24) % 2 === 0; if (flicker && player.dash <= 0) ctx.globalAlpha = .48;
    const bob = playerPresentationBob(time);
    const lean = player.visualState === "hurt" ? -.12 : player.visualState === "attack" ? .08 : 0;
    drawShadow(player.x, player.y + 5, player.visualState === "dash" ? 25 : 19, player.visualState === "dash" ? 5 : 7, .36);
    // While moving, targetFacing is the immediate input direction. Using the
    // smoothed facing vector here caused a short but obvious right-facing
    // frame when the player started moving left (and vice versa).
    const poseFacingX = player.visualState === "attack" ? player.attackDirectionX : player.targetFacingX;
    const poseFacingY = player.visualState === "attack" ? player.attackDirectionY : player.targetFacingY;
    const movementRow = Math.abs(poseFacingX) > Math.abs(poseFacingY) ? (poseFacingX >= 0 ? 1 : 3) : (poseFacingY < 0 ? 2 : 0);
    // The base sheet's horizontal side pose is authored facing right. Mirror
    // that pose for a pure left idle/hurt/dash state; the run and attack sheets
    // have their own left-facing rows and are handled without mirroring.
    const facingFrame = Math.abs(poseFacingX) > Math.abs(poseFacingY)
      ? 2
      : (poseFacingY < -.35 ? 4 : 0);
    const runFrame = movementRow * 4 + Math.floor((player.walk * 1.22) % 4);
    // The authored sword row is ordered by readable aim: down, up, right,
    // left, then a short recovery. Select a four-frame directional slice rather
    // than cycling the old south-biased eight-frame loop for every attack.
    const attackDirection = Math.abs(player.attackDirectionX) > Math.abs(player.attackDirectionY)
      ? (player.attackDirectionX >= 0 ? "right" : "left")
      : (player.attackDirectionY < 0 ? "up" : "down");
    const attackSlices = { down: [16, 17, 23, 31], up: [16, 17, 23, 31], right: [18, 19, 20, 23], left: [21, 22, 20, 23] };
    const attackSlice = attackSlices[attackDirection] || attackSlices.down;
    const attackFrame = attackSlice[Math.min(3, Math.floor((player.attackElapsed / .34) * attackSlice.length))];
    const playerFrame = player.visualState === "move" ? runFrame : player.visualState === "attack" ? attackFrame : player.visualState === "dash" ? 24 + Math.floor((time * 14) % 5) : player.visualState === "hurt" ? 28 + Math.floor((time * 9) % 4) : facingFrame;
    // The generated sheet already contains the blade, lantern, and action silhouettes.
    // Keep the procedural sword only for the fallback so replacement art never doubles it.
    const playerBottoms = [0.945, 0.965, 0.965, 0.957, 0.965, 0.973, 0.969, 0.949, 0.93, 0.934, 0.945, 0.938, 0.938, 0.938, 0.945, 0.926, 0.879, 0.914, 0.887, 0.902, 0.918, 0.84, 0.949, 0.895, 0.813, 0.809, 0.777, 0.777, 0.844, 0.844, 0.859, 0.887];
    const runBottoms = [0.923, 0.923, 0.923, 0.923, 0.885, 0.881, 0.875, 0.881, 1, 1, 1, 1, 0.792, 0.795, 0.808, 0.811];
    const playerAnchor = player.visualState === "move" ? runBottoms[playerFrame] || .92 : playerBottoms[playerFrame] || .92;
    const playerSpriteKey = player.visualState === "move" ? "player-run" : player.visualState === "attack" ? "player-attack" : "player";
    const directionalAttackFrame = attackDirection === "down" ? 0 : attackDirection === "up" ? 4 : attackDirection === "right" ? 8 : 12;
    const spriteFrame = player.visualState === "attack" ? directionalAttackFrame + Math.min(3, Math.floor((player.attackElapsed / .34) * 4)) : playerFrame;
    const baseSpriteFlipX = playerSpriteKey === "player" && Math.abs(poseFacingX) > Math.abs(poseFacingY) && poseFacingX < -.35;
    const customPlayer = drawOptionalSprite(playerSpriteKey, player.x, player.y + bob + 8, { frame: spriteFrame, width: player.visualState === "dash" ? 58 : player.visualState === "attack" ? 80 : player.visualState === "move" ? 54 : 52, height: player.visualState === "dash" ? 76 : player.visualState === "attack" ? 74 : player.visualState === "move" ? 74 : 70, anchorY: player.visualState === "attack" ? .94 : playerAnchor, flipX: baseSpriteFlipX, rotation: lean, alpha: flicker ? .48 : 1 });
    if (!customPlayer) {
      ctx.save(); ctx.translate(player.x, player.y + bob); ctx.rotate(lean); if (player.visualState === "dash") ctx.rotate(Math.atan2(player.dashDirectionY, player.dashDirectionX) - Math.PI / 2);
      const scale = player.visualState === "dash" ? 1.12 : player.visualState === "hurt" ? .94 : 1; ctx.scale(scale, player.visualState === "dash" ? .72 : 1);
      ctx.scale(poseFacingX < -.2 ? -1 : 1, 1);
      ctx.fillStyle = player.visualState === "dash" ? "#89d8c7" : "#3d6780"; ctx.beginPath(); ctx.ellipse(0, 1, 15, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = ART.ink; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = COLORS.player; ctx.beginPath(); ctx.arc(0, -14, 10, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "rgba(37,48,40,.72)"; ctx.stroke();
      ctx.fillStyle = "#4a302c"; ctx.beginPath(); ctx.arc(0, -19, 11, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "#d8f0c6"; ctx.fillRect(-13, 1, 26, 4);
      ctx.fillStyle = "rgba(255,255,255,.38)"; ctx.fillRect(-7, -22, 3, 3); ctx.strokeStyle = "rgba(205,247,216,.34)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 1, 13, Math.PI * 1.12, Math.PI * 1.82); ctx.stroke();
      if (player.visualState === "dash") { ctx.strokeStyle = "rgba(182,255,225,.8)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 1, 21, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    const attackProgress = player.visualState === "attack" ? clamp(player.attackElapsed / .34, 0, 1) : 0; const attackAngle = player.visualState === "attack" ? Math.atan2(player.attackDirectionY, player.attackDirectionX) : Math.atan2(player.facingY, player.facingX); const swordSweep = player.visualState === "attack" ? -1.08 + attackProgress * 1.86 : .12;
    if (!customPlayer) {
      ctx.save(); ctx.translate(player.x, player.y + bob - 1); ctx.rotate(attackAngle + swordSweep); ctx.globalAlpha = player.visualState === "hurt" ? .55 : 1; ctx.strokeStyle = "#6e4937"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(13, 0); ctx.stroke(); ctx.fillStyle = player.visualState === "attack" ? "#fff1ba" : "#e5d59f"; ctx.beginPath(); ctx.moveTo(10, -3); ctx.lineTo(39, -2); ctx.lineTo(44, 0); ctx.lineTo(39, 2); ctx.lineTo(10, 3); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "rgba(40,59,49,.72)"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = "#b58355"; ctx.fillRect(8, -5, 5, 10); ctx.restore();
    }
    if (state.rootlightLantern) { const bob = Math.sin(time * 3.4) * 3; const glow = ctx.createRadialGradient(player.x + 15, player.y - 18 + bob, 1, player.x + 15, player.y - 18 + bob, 32); glow.addColorStop(0, "rgba(255,238,166,.72)"); glow.addColorStop(1, "rgba(142,242,207,0)"); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(player.x + 15, player.y - 18 + bob, 32, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#ffe9a4"; ctx.beginPath(); ctx.arc(player.x + 15, player.y - 18 + bob, 5 + Math.sin(time * 5) * .8, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "rgba(142,242,207,.65)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(player.x + 15, player.y - 18 + bob, 9, 0, Math.PI * 2); ctx.stroke(); }
    if (player.rootlightPulse > 0) {
      const pulse = clamp(1 - player.rootlightPulse / .7, 0, 1);
      const pulseFrame = 12 + Math.min(3, Math.floor(pulse * 4));
      const customPulse = drawOptionalSprite("fx-impact", player.x, player.y, { frame: pulseFrame, width: 88 + pulse * 82, height: 88 + pulse * 82, anchorX: .5, anchorY: .5, alpha: clamp(player.rootlightPulse * 2.1, 0, 1) });
      if (!customPulse) { ctx.save(); ctx.globalAlpha = .25 + player.rootlightPulse * .7; ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(player.x, player.y, 30 + pulse * 80, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    }
  };
  const drawAmbientOverlay = (time) => {
    const dungeon = state.area === "dungeon"; const bossRoom = dungeon && `${state.roomX}-${state.roomY}` === "2-1"; const warm = dungeon ? (bossRoom && state.bossPhase === 2 ? "rgba(187,70,104,.11)" : "rgba(86,163,128,.06)") : "rgba(80,177,116,.05)";
    const focus = ctx.createRadialGradient(WIDTH * .5, HEIGHT * .47, 72, WIDTH * .5, HEIGHT * .47, 520); focus.addColorStop(0, "rgba(0,0,0,0)"); focus.addColorStop(.7, warm); focus.addColorStop(1, dungeon ? "rgba(2,8,8,.46)" : "rgba(4,13,9,.28)"); ctx.fillStyle = focus; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const edge = ctx.createLinearGradient(0, 0, 0, HEIGHT); edge.addColorStop(0, "rgba(5,13,11,.12)"); edge.addColorStop(.22, "rgba(5,13,11,0)"); edge.addColorStop(.8, "rgba(4,11,9,0)"); edge.addColorStop(1, "rgba(4,11,9,.24)"); ctx.fillStyle = edge; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const mood = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT); mood.addColorStop(0, dungeon ? "rgba(94,127,167,.035)" : "rgba(255,231,164,.04)"); mood.addColorStop(.58, "rgba(0,0,0,0)"); mood.addColorStop(1, dungeon ? "rgba(7,16,19,.1)" : "rgba(21,62,42,.035)"); ctx.fillStyle = mood; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (state.pickupPulse > 0) { const pulse = 1 - state.pickupPulse / .7; ctx.save(); ctx.globalAlpha = state.pickupPulse * .22; ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(WIDTH / 2, HEIGHT / 2, 80 + pulse * 360, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    if (dungeon) { ctx.save(); ctx.globalAlpha = .12 + Math.sin(time * .5) * .025; ctx.fillStyle = bossRoom ? "#ffcfb0" : "#b8ead0"; for (let i = 0; i < 8; i += 1) { const x = 90 + ((i * 171) % 780); const y = 80 + ((i * 97) % 430); ctx.beginPath(); ctx.arc(x + Math.sin(time * .2 + i) * 10, y, 1.5 + (i % 2), 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
  };
  const drawBossEntranceOverlay = (time) => {
    const progress = clamp((3.8 - state.bossEntrance) / 3.8, 0, 1); const reveal = clamp(progress * 2.4, 0, 1); const alpha = clamp(state.bossEntrance / 2.8, 0, .9); const cx = WIDTH / 2; const cy = HEIGHT / 2 - 8;
    ctx.save(); ctx.fillStyle = `rgba(5,4,11,${alpha})`; ctx.fillRect(0, 0, WIDTH, HEIGHT); ctx.globalAlpha = reveal * .55; ctx.strokeStyle = "#d66b92"; ctx.lineWidth = 2;
    for (let i = 0; i < 8; i += 1) { const angle = time * .25 + i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(cx + Math.cos(angle) * 50, cy + Math.sin(angle) * 50); ctx.lineTo(cx + Math.cos(angle) * 285, cy + Math.sin(angle) * 285); ctx.stroke(); }
    ctx.globalAlpha = reveal * .9; ctx.strokeStyle = "rgba(255,154,157,.72)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 94 + Math.sin(time * 2) * 4, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, 126 + Math.sin(time * 1.4) * 6, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = reveal * .8; ctx.fillStyle = "rgba(18,7,22,.88)"; ctx.beginPath(); ctx.moveTo(cx, cy - 124); ctx.lineTo(cx + 24, cy - 91); ctx.lineTo(cx + 68, cy - 66); ctx.lineTo(cx + 74, cy + 18); ctx.lineTo(cx + 30, cy + 86); ctx.lineTo(cx, cy + 111); ctx.lineTo(cx - 30, cy + 86); ctx.lineTo(cx - 74, cy + 18); ctx.lineTo(cx - 68, cy - 66); ctx.lineTo(cx - 24, cy - 91); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "rgba(255,205,216,.7)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = "#ff9a9d"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx - 27, cy - 88); ctx.lineTo(cx - 52, cy - 132); ctx.moveTo(cx + 27, cy - 88); ctx.lineTo(cx + 52, cy - 132); ctx.stroke(); ctx.fillStyle = "#ffd5dc"; ctx.beginPath(); ctx.moveTo(cx, cy - 26); ctx.lineTo(cx + 15, cy - 2); ctx.lineTo(cx, cy + 22); ctx.lineTo(cx - 15, cy - 2); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = reveal; ctx.fillStyle = "#f3d4df"; ctx.font = "700 31px Outfit"; ctx.textAlign = "center"; ctx.fillText("THE HOLLOW GUARDIAN", cx, HEIGHT / 2 - 44); ctx.fillStyle = "#ff9a9d"; ctx.font = "11px DM Mono"; ctx.fillText("HEARTSEED SANCTUM · LAST WARD", cx, HEIGHT / 2 - 7); ctx.fillStyle = "rgba(214,255,220,.68)"; ctx.font = "10px DM Mono"; ctx.fillText("Watch the rings. Let the lantern answer the heart.", cx, HEIGHT / 2 + 22); ctx.restore();
  };
  const drawBossPhaseShiftOverlay = (time) => {
    const progress = clamp((1.85 - state.bossPhaseShift) / 1.85, 0, 1); const fade = clamp(Math.min(progress * 3, state.bossPhaseShift * 2.6), 0, 1); const cx = WIDTH / 2; const cy = HEIGHT / 2 - 12;
    ctx.save(); ctx.fillStyle = `rgba(117,16,67,${.14 + Math.sin(time * 13) * .04})`; ctx.fillRect(0, 0, WIDTH, HEIGHT); ctx.globalAlpha = fade * .7; ctx.strokeStyle = "#ff7c99"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, 70 + progress * 230, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 2; for (let i = 0; i < 8; i += 1) { const angle = time * .7 + i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(cx + Math.cos(angle) * 56, cy + Math.sin(angle) * 56); ctx.lineTo(cx + Math.cos(angle) * (160 + progress * 110), cy + Math.sin(angle) * (160 + progress * 110)); ctx.stroke(); }
    ctx.globalAlpha = fade; ctx.fillStyle = "#ffb8bd"; ctx.font = "700 31px Outfit"; ctx.textAlign = "center"; ctx.fillText("PHASE II", cx, HEIGHT / 2 - 22); ctx.fillStyle = "#f3d4df"; ctx.font = "12px DM Mono"; ctx.fillText("THE HEART UNBOUND", cx, HEIGHT / 2 + 14); ctx.fillStyle = "rgba(255,238,213,.6)"; ctx.font = "10px DM Mono"; ctx.fillText("The sanctum is breaking. Read the rose lanes.", cx, HEIGHT / 2 + 40); ctx.restore();
  };
  const drawBossDefeatOverlay = (time) => {
    const progress = clamp((5.8 - state.bossDefeatTimer) / 5.8, 0, 1); const fade = clamp(progress * 2.2, 0, 1); const cx = WIDTH / 2; const cy = HEIGHT / 2 - 28;
    ctx.save(); ctx.fillStyle = `rgba(18,8,18,${.18 + progress * .3})`; ctx.fillRect(0, 0, WIDTH, HEIGHT); ctx.globalAlpha = fade; ctx.strokeStyle = "#ffd77b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 48 + progress * 72 + Math.sin(time * 4) * 3, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = "#ff9a9d"; ctx.lineWidth = 2; for (let i = 0; i < 10; i += 1) { const angle = i * Math.PI / 5 + time * .4; ctx.beginPath(); ctx.moveTo(cx + Math.cos(angle) * 24, cy + Math.sin(angle) * 24); ctx.lineTo(cx + Math.cos(angle) * (110 + progress * 60), cy + Math.sin(angle) * (110 + progress * 60)); ctx.stroke(); } ctx.fillStyle = "#ffe7a4"; ctx.beginPath(); ctx.moveTo(cx, cy - 20); ctx.lineTo(cx + 16, cy); ctx.lineTo(cx, cy + 20); ctx.lineTo(cx - 16, cy); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#f3f6df"; ctx.font = "700 29px Outfit"; ctx.textAlign = "center"; ctx.fillText("THE GUARDIAN FALLS", cx, cy + 100); ctx.fillStyle = "#ffd77b"; ctx.font = "11px DM Mono"; ctx.fillText("THE HEARTSEED REMEMBERS YOU", cx, cy + 126); ctx.restore();
  };
  const drawBossHud = (time) => {
    if (state.area !== "dungeon" || `${state.roomX}-${state.roomY}` !== "2-1" || state.bossDefeated) return;
    const boss = enemies.find((enemy) => enemy.type === "boss" && !enemy.dead); const hp = boss ? Math.max(0, boss.hp) : state.bossDefeatTimer > 0 ? 0 : 16; const maxHp = boss ? boss.maxHp : 16; const phase = boss ? boss.phase : state.bossPhase; const ratio = clamp(hp / maxHp, 0, 1);
    const x = 112; const y = 22; const w = WIDTH - 224; const h = 20; const accent = phase === 2 ? "#ff9a9d" : "#d8efcf";
    ctx.save(); ctx.globalAlpha = state.bossEntrance > 0 ? .72 : 1; ctx.fillStyle = "rgba(5,10,11,.84)"; ctx.beginPath(); ctx.roundRect(x - 16, y - 22, w + 32, 82, 14); ctx.fill(); ctx.strokeStyle = phase === 2 ? "rgba(255,154,157,.72)" : "rgba(214,255,220,.32)"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.textAlign = "left"; ctx.fillStyle = "#f3f6df"; ctx.font = "700 12px Outfit"; ctx.fillText("HOLLOW GUARDIAN", x, y - 8); ctx.fillStyle = "rgba(214,255,220,.55)"; ctx.font = "9px DM Mono"; ctx.fillText("HEARTSEED SANCTUM", x, y + h + 19);
    ctx.textAlign = "right"; ctx.fillStyle = accent; ctx.font = "700 10px DM Mono"; ctx.fillText(phase === 2 ? "PHASE II · HEART UNBOUND" : "PHASE I · THE WATCHER", x + w, y - 8);
    ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(x, y, w, h); const bar = ctx.createLinearGradient(x, y, x + w, y); bar.addColorStop(0, phase === 2 ? "#c95d83" : "#a94f75"); bar.addColorStop(1, phase === 2 ? "#ff9a9d" : "#d78b70"); ctx.fillStyle = bar; ctx.fillRect(x, y, w * ratio, h); ctx.strokeStyle = "rgba(255,246,210,.76)"; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
    ctx.strokeStyle = "rgba(255,255,255,.44)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.stroke(); ctx.strokeStyle = "rgba(255,255,255,.2)"; ctx.beginPath(); ctx.moveTo(x + w * .25, y); ctx.lineTo(x + w * .25, y + h); ctx.moveTo(x + w * .75, y); ctx.lineTo(x + w * .75, y + h); ctx.stroke();
    ctx.globalAlpha = .5 + Math.sin(time * 3) * .12; ctx.fillStyle = phase === 2 ? "#ff9a9d" : "#8ef2cf"; ctx.beginPath(); ctx.arc(x - 7, y + h / 2, 3, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(x + w + 7, y + h / 2, 3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };

  const draw = (time) => {
    ctx.clearRect(0, 0, WIDTH, HEIGHT); ctx.save(); ctx.translate(-camera.x + camera.shakeX, -camera.y + camera.shakeY);
    if (state.area === "overworld") drawOverworld(time); else drawDungeon(time);
    leaves.forEach((leaf) => { if (state.area === "overworld" && leaf.x > camera.x - 10 && leaf.x < camera.x + WIDTH + 10 && leaf.y > camera.y - 10 && leaf.y < camera.y + HEIGHT + 10) { const scale = .62 + hash01(Math.floor(leaf.x), Math.floor(leaf.y)) * .5; ctx.save(); ctx.translate(leaf.x, leaf.y); ctx.rotate(Math.sin(leaf.phase + leaf.y * .02) * .5 + Math.sin(state.visualClock * .8 + leaf.phase) * .12); ctx.scale(scale, .68 + scale * .18); ctx.globalAlpha = .3 + hash01(Math.floor(leaf.x), Math.floor(leaf.y)) * .24; ctx.fillStyle = leaf.phase % 2 > 1 ? "#b6df8b" : "#d3edac"; ctx.beginPath(); ctx.moveTo(0, -5); ctx.quadraticCurveTo(5, -1, 1, 6); ctx.quadraticCurveTo(-4, 1, 0, -5); ctx.fill(); ctx.restore(); } });
    // Use one shared top-down depth pass for living actors. Previously the player
    // was always painted after every enemy, which made an enemy read as floating
    // over or behind the player whenever their world-space Y positions crossed.
    // Keep gameplay/collision order untouched; this only fixes visual layering.
    const actorDepthY = (entry) => entry.kind === "player"
      ? entry.actor.y + 8
      : entry.kind === "npc"
        ? entry.actor.y + 11
        : entry.actor.y;
    const actorEntities = [
      ...enemies.map((enemy) => ({ kind: "enemy", actor: enemy })),
      ...(state.area === "overworld" ? activeNpcs().map((npc) => ({ kind: "npc", actor: npc })) : []),
      { kind: "player", actor: player }
    ].sort((a, b) => actorDepthY(a) - actorDepthY(b));
    actorEntities.forEach((entry) => { if (entry.kind === "player") drawPlayer(time); else if (entry.kind === "npc") drawNpc(entry.actor, time); else drawEnemy(entry.actor, time); });
    // Combat FX sits above the actor pass so a sword sweep remains readable when
    // the player's contact plane crosses an enemy's contact plane.
    drawAttackTrail(player.x, player.y + playerPresentationBob(time) + 8);
    drops.forEach((drop) => drawDrop(drop, time)); projectiles.forEach((projectile) => drawProjectile(projectile));
    if (state.area === "overworld") drawOutdoorForeground(time); particles.forEach(drawParticle); drawInteractionHint(time); ctx.restore();
    drawAmbientOverlay(time);
    drawBossHud(time);
    if (state.impactFlash > 0) { ctx.fillStyle = `rgba(255,246,210,${state.impactFlash * 1.8})`; ctx.fillRect(0, 0, WIDTH, HEIGHT); }
    if (state.area === "dungeon" && state.roomTransition > 0) { const progress = clamp(1 - state.roomTransition / .72, 0, 1); const reveal = clamp((progress - .16) / .84, 0, 1); const alpha = clamp(.98 - reveal * .98, 0, .96); const transitionTint = state.roomTransitionLabel.includes("Sanctum") ? "#e2a1ba" : "#8ef2cf"; const veil = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 60 + reveal * 220, WIDTH / 2, HEIGHT / 2, 720); veil.addColorStop(0, `rgba(5,10,11,${alpha * .12})`); veil.addColorStop(.52, `rgba(5,10,11,${alpha * .58})`); veil.addColorStop(1, `rgba(3,7,8,${alpha})`); ctx.fillStyle = veil; ctx.fillRect(0, 0, WIDTH, HEIGHT); ctx.save(); ctx.globalAlpha = clamp((progress - .04) * 3.2, 0, 1) * (1 - reveal * .35); const centerGlow = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 2, WIDTH / 2, HEIGHT / 2, 210); centerGlow.addColorStop(0, `${transitionTint}55`); centerGlow.addColorStop(.42, `${transitionTint}1f`); centerGlow.addColorStop(1, `${transitionTint}00`); ctx.fillStyle = centerGlow; ctx.beginPath(); ctx.arc(WIDTH / 2, HEIGHT / 2, 210, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#e4f4d9"; ctx.font = "700 21px Outfit"; ctx.textAlign = "center"; ctx.fillText(state.roomTransitionLabel, WIDTH / 2, HEIGHT / 2 - 16); ctx.fillStyle = "rgba(214,255,220,.62)"; ctx.font = "10px DM Mono"; ctx.fillText("THE HOLLOW SHRINE", WIDTH / 2, HEIGHT / 2 + 11); ctx.fillStyle = "rgba(214,255,220,.16)"; ctx.fillRect(WIDTH / 2 - 92, HEIGHT / 2 + 31, 184, 2); ctx.fillStyle = transitionTint; ctx.fillRect(WIDTH / 2 - 92, HEIGHT / 2 + 31, 184 * reveal, 2); ctx.restore(); }
    if (state.area === "dungeon" && state.dungeonIntro > 0) { const progress = clamp((3.4 - state.dungeonIntro) / 3.4, 0, 1); const alpha = state.dungeonIntro > 2.7 ? .92 : clamp(state.dungeonIntro / 2.7, 0, .92); const veil = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 70, WIDTH / 2, HEIGHT / 2, 680); veil.addColorStop(0, `rgba(3,7,8,${alpha * .38})`); veil.addColorStop(.62, `rgba(3,7,8,${alpha * .72})`); veil.addColorStop(1, `rgba(1,4,6,${alpha})`); ctx.fillStyle = veil; ctx.fillRect(0, 0, WIDTH, HEIGHT); ctx.save(); ctx.globalAlpha = clamp(progress * 2.3, 0, 1); const entranceGlow = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2 + 10, 1, WIDTH / 2, HEIGHT / 2 + 10, 170); entranceGlow.addColorStop(0, "rgba(142,242,207,.18)"); entranceGlow.addColorStop(1, "rgba(142,242,207,0)"); ctx.fillStyle = entranceGlow; ctx.beginPath(); ctx.arc(WIDTH / 2, HEIGHT / 2 + 10, 170, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#e8efcf"; ctx.font = "700 27px Outfit"; ctx.textAlign = "center"; ctx.fillText("THE HOLLOW SHRINE", WIDTH / 2, HEIGHT / 2 - 18); ctx.fillStyle = "#c89d77"; ctx.font = "11px DM Mono"; ctx.fillText("THE ROOTS CLOSE BEHIND YOU", WIDTH / 2, HEIGHT / 2 + 16); ctx.fillStyle = "rgba(214,255,220,.56)"; ctx.font = "10px DM Mono"; ctx.fillText("E · interact   J / SPACE · strike   K · dodge", WIDTH / 2, HEIGHT / 2 + 46); ctx.fillStyle = "rgba(214,255,220,.16)"; ctx.fillRect(WIDTH / 2 - 100, HEIGHT / 2 + 70, 200, 2); ctx.fillStyle = "#8ef2cf"; ctx.fillRect(WIDTH / 2 - 100, HEIGHT / 2 + 70, 200 * progress, 2); ctx.restore(); }
    if (state.itemReveal > 0) { const progress = clamp((3.8 - state.itemReveal) / 3.8, 0, 1); const fade = clamp(Math.min(progress * 3, (state.itemReveal) * 2.2), 0, 1); ctx.fillStyle = `rgba(5,10,11,${.84 * fade})`; ctx.fillRect(0, 0, WIDTH, HEIGHT); ctx.save(); ctx.globalAlpha = clamp(progress * 2.8, 0, 1); const cx = WIDTH / 2; const cy = HEIGHT / 2 - 72; const radius = 35 + Math.sin(progress * Math.PI) * 14; const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 110); glow.addColorStop(0, "rgba(255,239,168,.78)"); glow.addColorStop(1, "rgba(142,242,207,0)"); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, 110, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#8ef2cf"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.7 * progress); ctx.stroke(); ctx.fillStyle = "#ffe9a4"; ctx.beginPath(); ctx.arc(cx, cy, 15 + Math.sin(progress * 13) * 2, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#fff7cf"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = "#f3f6df"; ctx.font = "700 25px Outfit"; ctx.textAlign = "center"; ctx.fillText("MOONWAKE LANTERN", cx, cy + 92); ctx.fillStyle = "rgba(214,255,220,.72)"; ctx.font = "12px DM Mono"; ctx.fillText("Press L to pulse Rootlight", cx, cy + 122); ctx.fillStyle = "rgba(255,215,123,.72)"; ctx.font = "10px DM Mono"; ctx.fillText("The light reveals paths, stuns the hollow, and wakes old seals.", cx, cy + 148); ctx.restore(); }
    if (state.area === "dungeon" && `${state.roomX}-${state.roomY}` === "2-1" && state.bossEntrance > 0) drawBossEntranceOverlay(time);
    if (state.area === "dungeon" && `${state.roomX}-${state.roomY}` === "2-1" && state.bossPhaseShift > 0) drawBossPhaseShiftOverlay(time);
    if (state.area === "dungeon" && `${state.roomX}-${state.roomY}` === "2-1" && state.bossDefeatTimer > 0) drawBossDefeatOverlay(time);
  };

  const updateObjective = () => {
    if (STARTER_MODE) { if (!state.rowanClue) { ui.objective.textContent = "Meet Rowan at the outpost"; ui.objectiveCopy.textContent = "Walk the lantern road and press E when the nameplate appears."; } else if (!state.southPassageOpen) { ui.objective.textContent = "Explore Lanternwood"; ui.objectiveCopy.textContent = "Follow the worn road, practice your sword, and look for the ivy-hidden pond path."; } else if (!state.hiddenChestOpened) { ui.objective.textContent = "Find the hidden grove"; ui.objectiveCopy.textContent = "The reeds parted near the low pond. Something old is waiting beyond them."; } else { ui.objective.textContent = "Lanternwood is yours to explore"; ui.objectiveCopy.textContent = "A small beginning. The shrine and deeper roads will come in a later chapter."; } return; }
    if (state.area === "overworld") {
      if (state.rootlightLantern && !state.rootlightGateOpen) { ui.objective.textContent = "Follow the Moonroot glow"; ui.objectiveCopy.textContent = "Press L near the sealed gate beyond the pond. The lantern reveals what daylight misses."; }
      else if (!state.rowanClue) { ui.objective.textContent = "Find Rowan at the outpost"; ui.objectiveCopy.textContent = "The blue moths gather where the old path breaks."; }
      else if (!state.southPassageOpen) { ui.objective.textContent = "Search the low pond"; ui.objectiveCopy.textContent = "Three pale stones point toward a curtain of ivy. Steel can open what a path cannot."; }
      else if (!state.hiddenChestOpened) { ui.objective.textContent = "Reach the hidden grove"; ui.objectiveCopy.textContent = state.optionalGuardDefeated ? "The thornback is gone. Something old glints beneath the lantern leaves." : "A slow thornback guards the lantern leaves. Watch its warning ring."; }
      else { ui.objective.textContent = "Enter the Hollow Shrine"; ui.objectiveCopy.textContent = "The lantern seed warms your palm. A blue seam glows behind the old outpost."; }
      return;
    }
    const key = `${state.roomX}-${state.roomY}`;
    if (key === "0-0") { ui.objective.textContent = state.key ? "Choose a route in the Moon Switch Hall" : "Find the brass key"; ui.objectiveCopy.textContent = state.key ? "The east lock is awake. The first room taught you what a key can change." : "The root gallery is quiet on purpose. Search beneath the shrine glyph."; }
    else if (key === "1-0") { ui.objective.textContent = state.switches ? "Choose your descent" : "Wake the moon switch"; ui.objectiveCopy.textContent = state.switches ? "The lower gate opens south; the garden path waits east." : "Stand near the silver disk and press E. Its light will feed the lower gate."; }
    else if (key === "2-0") { ui.objective.textContent = state.miniBossDefeated ? "Take the living shortcut" : "Defeat the Root Warden"; ui.objectiveCopy.textContent = state.miniBossDefeated ? "The warden's roots now form a direct descent to the sanctum." : "Its bark armor cracks after every clean sword hit. Read the ring, then step in."; }
    else if (key === "0-1") { ui.objective.textContent = state.heartChestOpened ? "Leave the flooded vault" : "Cross the flooded vault"; ui.objectiveCopy.textContent = state.heartChestOpened ? "The heartseed shard steadies your pulse. Find the dry stone at the north." : "Deep water slows the feet and bites once per breath. The chest is worth the crossing."; }
    else if (key === "1-1") { ui.objective.textContent = state.rootlightLantern && !state.rootlightTested ? "Try the Moonwake Lantern" : state.ashCacheOpened ? "Use the ash shortcut" : "Search the ash antechamber"; ui.objectiveCopy.textContent = state.rootlightLantern && !state.rootlightTested ? "The small ash mirror is safe to touch. Press L beside its pale ring." : state.ashCacheOpened ? "The sootglass cache woke a quiet lift behind the broken wall." : "Two ember trenches divide the room. Look left of the damaged wall for a secret cache."; }
    else if (key === "2-1") { ui.objective.textContent = state.bossDefeated ? "Claim the Heartseed" : "Silence the Hollow Guardian"; ui.objectiveCopy.textContent = state.bossDefeated ? "The shrine is quiet. Approach the heartseed altar." : "The guardian changes its rhythm when its light turns rose. Keep the outer ring clear."; }
    else { ui.objective.textContent = "Explore the shrine"; ui.objectiveCopy.textContent = "Every room remembers a different season."; }
  };
  const updateHud = () => {
    ui.area.textContent = "Lanternwood";
    ui.room.textContent = "Starter field";
    ui.seed.textContent = "0"; ui.keys.textContent = "0"; ui.loot.textContent = state.loot || "0";
    if (ui.discovery) ui.discovery.textContent = `${state.discoveries || 0}/${state.discoveryTotal || 3}`;
    if (ui.ability) { ui.ability.textContent = STARTER_MODE ? "Starter slice · lantern coming later" : state.rootlightLantern ? (player.rootlightCooldown > 0 ? `Moonwake Lantern · ${player.rootlightCooldown.toFixed(1)}s` : "Moonwake Lantern · L ready") : "Rootlight dormant"; ui.ability.classList.toggle("ready", Boolean(!STARTER_MODE && state.rootlightLantern && player.rootlightCooldown <= 0)); }
    ui.save.textContent = state.saveError ? "Save unavailable" : state.mode === "playing" ? "Autosaved" : state.mode === "title" ? "Not started" : state.mode === "victory" ? "Complete" : state.mode === "dead" ? "Run ended" : "Paused";
    const healthKey = `${player.hp}/${player.maxHp}`; const healthChanged = healthKey !== previousHealthKey; ui.hearts.innerHTML = ""; for (let i = 0; i < player.maxHp; i += 1) { const heart = document.createElement("i"); heart.className = "heart" + (i < player.hp ? "" : " empty") + (loadedAssets.has("ui-icons") ? " painted" : ""); ui.hearts.appendChild(heart); } if (healthChanged) { ui.hearts.classList.remove("health-pop"); void ui.hearts.offsetWidth; ui.hearts.classList.add("health-pop"); window.setTimeout(() => ui.hearts.classList.remove("health-pop"), 300); previousHealthKey = healthKey; }
    ui.map.innerHTML = ""; const dot = document.createElement("i"); dot.className = "done active"; ui.map.appendChild(dot); updateObjective();
  };
  const updateDialogueSpeedLabel = () => { if (!ui.dialogueSpeed) return; const speed = state.dialogueSpeed || 52; ui.dialogueSpeed.textContent = `Text: ${speed >= 100 ? "fast" : speed <= 36 ? "slow" : "normal"}`; };
  const showVictory = () => { state.mode = "victory"; hideScreens(); ui.victory.classList.remove("hidden"); updateHud(); };

  const startGame = (continueGame) => { hideScreens(); restoreTitlePresentation(); if (continueGame && loadData()) { state.mode = "playing"; } else { state.mode = "playing"; state.saveError = false; state.area = "overworld"; state.roomX = 0; state.roomY = 0; state.roomVisited = { overworld: true }; state.key = false; state.switches = false; state.miniBossDefeated = false; state.bossDefeated = false; state.reward = false; state.secretFound = false; state.chestOpened = false; state.heartChestOpened = false; state.loot = 0; state.rowanClue = false; state.rowanRewarded = false; state.southPassageOpen = false; state.reedCacheFound = false; state.hiddenChestOpened = false; state.optionalGuardDefeated = false; state.lanternLens = false; state.lanternSeed = false; state.discoveries = 0; state.dungeonIntro = 0; state.dungeonEntranceSeen = false; state.roomTransition = 0; state.roomTransitionLabel = ""; state.hazardCooldown = 0; state.ashCacheOpened = false; state.ashShortcutOpen = false; state.rootlightLantern = false; state.rootlightTested = false; state.rootlightGalleryOpen = false; state.rootlightGalleryCacheOpened = false; state.rootlightMoonBridge = false; state.rootlightWaterway = false; state.rootlightGateOpen = false; state.rootlightCacheOpened = false; state.itemReveal = 0; state.bossIntroSeen = false; state.bossEntrance = 0; state.bossPhase = 1; state.bossPhaseShift = 0; state.bossArenaPulse = 0; state.bossDefeatTimer = 0; state.bossDefeatX = 600; state.bossDefeatY = 390; state.bossRewardClaimed = false; state.visualClock = 0; state.pickupPulse = 0; state.hitStop = 0; state.chestOpening = 0; state.chestOpenX = 0; state.chestOpenY = 0; player.maxHp = 6; player.hp = player.maxHp; resetPlayerMotion(); startArea("overworld"); saveData(); } canvas.focus(); updateHud(); };

  document.getElementById("new-game").addEventListener("click", () => startGame(false));
  document.getElementById("continue-game").addEventListener("click", () => startGame(true));
  document.getElementById("resume-game").addEventListener("click", () => { state.mode = "playing"; hideScreens(); canvas.focus(); });
  document.getElementById("pause-restart")?.addEventListener("click", () => { if (window.confirm("Restart Mosswake from the beginning? Your current save will be replaced.")) startGame(false); });
  document.getElementById("victory-close").addEventListener("click", () => { state.mode = "playing"; hideScreens(); canvas.focus(); updateHud(); });
  document.getElementById("restart-game")?.addEventListener("click", () => { if (window.confirm("Restart Mosswake from the beginning? Your current save will be replaced.")) startGame(false); });
  ui.controlsToggle?.addEventListener("click", () => setControlsExpanded(ui.controlsToggle.getAttribute("aria-expanded") !== "true"));
  document.getElementById("save-game")?.addEventListener("click", () => { const opening = ui.savePanel.hidden; openSavePanel(); if (!opening) updateSaveCode(); });
  document.getElementById("update-save-code")?.addEventListener("click", updateSaveCode);
  document.getElementById("copy-save")?.addEventListener("click", copySaveCode);
  document.getElementById("restore-save")?.addEventListener("click", restoreFromSaveCode);
  ui.dialogueSpeed.addEventListener("click", () => { const speeds = [36, 52, 110]; const current = speeds.indexOf(state.dialogueSpeed); state.dialogueSpeed = speeds[(current + 1 + speeds.length) % speeds.length]; updateDialogueSpeedLabel(); saveData(); });
  canvas.addEventListener("pointerdown", () => canvas.focus());
  window.addEventListener("keydown", (event) => { const key = event.key.toLowerCase(); const target = event.target instanceof HTMLElement ? event.target : null; if (target && target.closest("button, a, input, textarea, select, summary")) return; if (["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d","j","k","e","l","p","escape","enter"," "].includes(key)) event.preventDefault(); const wasDown = keys.has(key); if (!wasDown) justPressed.add(key); keys.add(key); if (!wasDown && (key === "e" || key === "enter")) interact(); if (!wasDown && key === "l") useRootlight(); if (!wasDown && (key === "p" || key === "escape")) togglePause(); });
  window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener("gamepadconnected", () => showToast("Xbox controller connected", 1600));
  window.addEventListener("blur", () => { keys.clear(); if (state.mode === "playing") { saveData(); state.mode = "paused"; ui.pause.classList.remove("hidden"); updateHud(); } });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { keys.clear(); if (state.mode === "playing") { saveData(); state.mode = "paused"; ui.pause.classList.remove("hidden"); updateHud(); } } });


  const frame = (timestamp) => { const dt = Math.min(.05, (timestamp - lastFrame) / 1000 || 0); lastFrame = timestamp; update(dt); draw(timestamp / 1000); window.requestAnimationFrame(frame); };
  loadOptionalAssets(); updateDialogueSpeedLabel(); updateHud(); if (!hasSave()) document.getElementById("continue-game").disabled = true; else document.getElementById("continue-game").disabled = false; window.requestAnimationFrame(frame);
})();
