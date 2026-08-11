(() => {
  "use strict";

  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const STORAGE_KEY = "johnny-mosswake-save-v1";
  const WORLD = { width: 1600, height: 1000 };
  const ROOM = { width: 1200, height: 800 };
  const COLORS = {
    grass: "#355e45", grassLight: "#417254", grassDark: "#294936", path: "#b49b6f", water: "#236d72",
    waterLight: "#5cb6a5", wood: "#76523b", stone: "#77867b", dungeon: "#283334", dungeonLight: "#344547",
    moss: "#83d27d", thorn: "#cf9a70", wisp: "#b8a6ff", moth: "#dc9bc4", warden: "#d78b70", boss: "#b95a90", gold: "#ffd77b", player: "#e9c08c"
  };
  const keys = new Set();
  const justPressed = new Set();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const moveToward = (current, target, amount) => current < target ? Math.min(current + amount, target) : Math.max(current - amount, target);
  const normalized = (x, y, fallbackX = 1, fallbackY = 0) => { const length = Math.hypot(x, y); return length ? { x: x / length, y: y / length } : { x: fallbackX, y: fallbackY }; };
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rand = (min, max) => min + Math.random() * (max - min);
  const makeId = (prefix) => prefix + Math.random().toString(36).slice(2, 8);

  const player = {
    x: 390, y: 500, radius: 14, hp: 6, maxHp: 6,
    velocityX: 0, velocityY: 0, facingX: 1, facingY: 0, targetFacingX: 1, targetFacingY: 0,
    attack: 0, attackElapsed: 0, attackCooldown: 0, attackBuffer: 0, attackDirectionX: 1, attackDirectionY: 0, attackHitRegistered: false,
    dash: 0, dashCooldown: 0, dashDirectionX: 1, dashDirectionY: 0, invulnerable: 0, hurt: 0, walk: 0, animTime: 0, visualState: "idle"
  };
  const state = {
    mode: "title", area: "overworld", roomX: 0, roomY: 0, roomVisited: { overworld: true }, key: false, switches: false,
    miniBossDefeated: false, bossDefeated: false, reward: false, secretFound: false, chestOpened: false, heartChestOpened: false, loot: 0,
    rowanClue: false, rowanRewarded: false, southPassageOpen: false, reedCacheFound: false, hiddenChestOpened: false,
    optionalGuardDefeated: false, lanternLens: false, lanternSeed: false, discoveries: 0, discoveryTotal: 3,
    dialogueSpeed: 52, spawnGrace: 0, lastSave: 0, toastTimer: 0, dialogue: null, transitionCooldown: 0, impactFlash: 0
  };
  let enemies = [];
  let projectiles = [];
  let drops = [];
  let particles = [];
  let leaves = Array.from({ length: 65 }, () => ({ x: rand(0, WORLD.width), y: rand(0, WORLD.height), speed: rand(5, 16), phase: rand(0, 6.28) }));
  const environment = {
    treesBack: [
      { x: 80, y: 88, s: 1.45, phase: .4 }, { x: 270, y: 125, s: 1.15, phase: 2.1 }, { x: 520, y: 82, s: 1.35, phase: 4.8 },
      { x: 760, y: 110, s: 1.6, phase: 1.4 }, { x: 1030, y: 72, s: 1.2, phase: 3.7 }, { x: 1330, y: 88, s: 1.55, phase: 5.2 }, { x: 1535, y: 110, s: 1.25, phase: 2.8 }
    ],
    treesMid: [
      { x: 125, y: 248, s: 1.05, phase: 2.3 }, { x: 360, y: 282, s: .86, phase: 4.2 }, { x: 545, y: 336, s: 1.12, phase: 1.1 },
      { x: 740, y: 356, s: .78, phase: 3.5 }, { x: 1040, y: 330, s: 1.12, phase: 5.5 }, { x: 1465, y: 315, s: 1.24, phase: 2.2 },
      { x: 1510, y: 690, s: 1.08, phase: 4.6 }, { x: 250, y: 772, s: 1.18, phase: .8 }, { x: 1045, y: 835, s: .92, phase: 3.1 }
    ],
    treesFront: [
      { x: 145, y: 900, s: 1.3, phase: 1.7 }, { x: 510, y: 930, s: 1.05, phase: 5.1 }, { x: 1245, y: 900, s: 1.4, phase: 3.6 }, { x: 1530, y: 900, s: 1.1, phase: .2 }
    ],
    grasses: [
      { x: 65, y: 355, s: 1.1, phase: .2 }, { x: 180, y: 410, s: .8, phase: 2.2 }, { x: 305, y: 560, s: 1.25, phase: 4.1 },
      { x: 470, y: 640, s: .9, phase: 1.5 }, { x: 585, y: 426, s: 1.1, phase: 3.4 }, { x: 710, y: 585, s: 1.2, phase: 5.2 },
      { x: 1015, y: 422, s: .86, phase: 2.8 }, { x: 1165, y: 360, s: 1.15, phase: .7 }, { x: 1425, y: 535, s: 1.25, phase: 4.7 },
      { x: 1460, y: 760, s: .9, phase: 1.1 }, { x: 930, y: 890, s: 1.05, phase: 3.8 }, { x: 390, y: 830, s: .75, phase: 5.8 }
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
      { x: 620, y: 648, s: .7 }, { x: 690, y: 642, s: .55 }, { x: 770, y: 646, s: .8 }, { x: 850, y: 655, s: .6 },
      { x: 950, y: 676, s: .65 }, { x: 1080, y: 555, s: .5 }, { x: 1160, y: 552, s: .72 }, { x: 1260, y: 554, s: .58 }
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
    { id: "rowan", name: "Rowan", role: "Outpost keeper", portrait: "rowan", x: 460, y: 380, baseX: 460, baseY: 380, behavior: "watch", phase: .3, facing: 1 },
    { id: "tansy", name: "Tansy", role: "Lantern cook", portrait: "tansy", x: 620, y: 356, baseX: 620, baseY: 356, behavior: "fire", phase: 1.2, facing: 1 },
    { id: "brindle", name: "Brindle", role: "Pond ferrier", portrait: "brindle", x: 540, y: 585, baseX: 540, baseY: 585, behavior: "pace", phase: 2.4, facing: 1, route: [{ x: 520, y: 582 }, { x: 572, y: 605 }, { x: 525, y: 625 }] },
    { id: "lumen", name: "Lumen", role: "Shrine cartographer", portrait: "lumen", x: 1235, y: 305, baseX: 1235, baseY: 305, behavior: "map", phase: 4.1, facing: -1 }
  ];
  let camera = { x: 0, y: 0, shake: 0, shakeX: 0, shakeY: 0 };
  let lastFrame = 0;

  const ui = {
    title: document.getElementById("title-screen"), pause: document.getElementById("pause-screen"), victory: document.getElementById("victory-screen"),
    dialogue: document.getElementById("dialogue"), speaker: document.getElementById("dialogue-speaker"), dialogueText: document.getElementById("dialogue-text"), dialogueHint: document.getElementById("dialogue-hint"), portrait: document.getElementById("dialogue-portrait"), portraitMark: document.getElementById("dialogue-portrait-mark"), dialogueSpeed: document.getElementById("dialogue-speed"),
    toast: document.getElementById("toast"), area: document.getElementById("area-label"), room: document.getElementById("room-label"), objective: document.getElementById("objective"),
    objectiveCopy: document.getElementById("objective-copy"), hearts: document.getElementById("hearts"), seed: document.getElementById("seed-count"), keys: document.getElementById("key-count"), loot: document.getElementById("loot-count"), discovery: document.getElementById("discovery-count"), save: document.getElementById("save-state"), map: document.getElementById("map-dots")
  };

  const showToast = (message, duration = 2200) => { ui.toast.textContent = message; ui.toast.classList.add("visible"); state.toastTimer = duration; };
  const hideScreens = () => [ui.title, ui.pause, ui.victory].forEach((screen) => screen.classList.add("hidden"));
  const dialoguePortraitLetter = (portrait) => ({ rowan: "R", tansy: "T", brindle: "B", lumen: "L" }[portrait] || "?");
  const renderDialogueLine = () => {
    if (!state.dialogue) return;
    const line = state.dialogue.lines[state.dialogue.index] || "";
    ui.speaker.textContent = state.dialogue.speaker;
    ui.dialogueText.textContent = line.slice(0, Math.floor(state.dialogue.charIndex));
    ui.dialogueHint.textContent = state.dialogue.complete ? (state.dialogue.index < state.dialogue.lines.length - 1 ? "E / Enter · next" : "E / Enter · close") : "E / Enter · reveal";
    ui.portrait.dataset.character = state.dialogue.portrait || "rowan";
    ui.portraitMark.textContent = dialoguePortraitLetter(state.dialogue.portrait);
  };
  const setDialogue = (speaker, text, portrait = "rowan") => {
    const lines = Array.isArray(text) ? text : [text];
    state.dialogue = { speaker, lines, portrait, index: 0, charIndex: 0, complete: false };
    ui.dialogue.classList.remove("closing"); ui.dialogue.classList.add("visible"); renderDialogueLine();
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
  const saveData = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, dialogue: null, mode: "playing", hp: player.hp, area: state.area, roomX: state.roomX, roomY: state.roomY }));
    state.lastSave = 0;
  };
  const hasSave = () => Boolean(localStorage.getItem(STORAGE_KEY));
  const loadData = () => {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!data) return false;
      Object.assign(state, data, { mode: "playing", dialogue: null, toastTimer: 0 });
      player.maxHp = 6 + (state.heartChestOpened ? 1 : 0) + (state.lanternSeed ? 1 : 0);
      player.hp = clamp(Number(data.hp) || player.maxHp, 1, player.maxHp);
      if (state.area === "dungeon") { player.x = ROOM.width / 2; player.y = ROOM.height - 100; } else { player.x = 390; player.y = 500; }
      startArea(state.area, false);
      return true;
    } catch (error) { localStorage.removeItem(STORAGE_KEY); return false; }
  };

  const resetProgress = () => {
    localStorage.removeItem(STORAGE_KEY);
    state.area = "overworld"; state.roomX = 0; state.roomY = 0; state.roomVisited = { overworld: true }; state.key = false; state.switches = false; state.miniBossDefeated = false; state.bossDefeated = false; state.reward = false; state.secretFound = false; state.chestOpened = false; state.heartChestOpened = false; state.loot = 0;
    state.rowanClue = false; state.rowanRewarded = false; state.southPassageOpen = false; state.reedCacheFound = false; state.hiddenChestOpened = false; state.optionalGuardDefeated = false; state.lanternLens = false; state.lanternSeed = false; state.discoveries = 0; state.dialogueSpeed = 52;
    player.maxHp = 6; player.hp = player.maxHp; player.x = 390; player.y = 500; startArea("overworld", false); state.mode = "title"; hideScreens(); ui.title.classList.remove("hidden"); updateHud();
  };

  const spawnParticle = (x, y, color, count = 5, speed = 75, kind = "spark") => {
    for (let i = 0; i < count; i += 1) particles.push({ x, y, vx: rand(-speed, speed), vy: rand(-speed, speed), life: rand(.25, .65), maxLife: .65, size: rand(2, 5), color, kind, rotation: rand(-Math.PI, Math.PI) });
  };
  const spawnLeaves = (x, y, count = 8) => { for (let i = 0; i < count; i += 1) particles.push({ x, y, vx: rand(-45, 45), vy: rand(-75, -18), life: rand(.45, .9), maxLife: .9, size: rand(3, 7), color: i % 2 ? "#b2e898" : "#ffd27a", kind: "leaf", rotation: rand(-Math.PI, Math.PI) }); };
  const spawnDust = (x, y, count = 6, color = "#d5c39b") => { for (let i = 0; i < count; i += 1) particles.push({ x: x + rand(-7, 7), y: y + rand(-4, 4), vx: rand(-35, 35), vy: rand(-28, -4), life: rand(.22, .45), maxLife: .45, size: rand(4, 9), color, kind: "dust", rotation: 0 }); };
  const triggerImpact = (x, y, color = COLORS.gold, strength = 1) => {
    spawnParticle(x, y, color, strength > 1 ? 12 : 7, strength > 1 ? 150 : 105, "impact");
    particles.push({ x, y, vx: 0, vy: 0, life: .18 + strength * .04, maxLife: .18 + strength * .04, size: 12 + strength * 8, color, kind: "ring", rotation: 0 });
    state.impactFlash = Math.max(state.impactFlash, .045 * strength); camera.shake = Math.max(camera.shake, .045 * strength);
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
  };
  const updateNpcs = (dt) => {
    npcs.forEach((npc) => {
      npc.clock = (npc.clock || 0) + dt;
      const playerNear = state.area === "overworld" && distance(player, npc) < 92;
      npc.near = playerNear;
      if (npc.behavior === "pace") {
        const route = npc.route; const travel = 3.8; const routeTime = npc.clock / travel; const segment = Math.floor(routeTime) % route.length; const next = route[(segment + 1) % route.length]; const current = route[segment]; const blend = routeTime - Math.floor(routeTime); const eased = blend * blend * (3 - 2 * blend);
        const previousX = npc.x; npc.x = current.x + (next.x - current.x) * eased; npc.y = current.y + (next.y - current.y) * eased; npc.facing = npc.x >= previousX ? 1 : -1;
      } else {
        npc.x = npc.baseX + Math.sin(npc.clock * .7 + npc.phase) * (npc.behavior === "fire" ? 3 : 1.5);
        npc.y = npc.baseY + Math.sin(npc.clock * 1.35 + npc.phase) * (npc.behavior === "fire" ? 1.5 : 1);
        if (playerNear) npc.facing = player.x >= npc.x ? 1 : -1;
        else if (npc.behavior === "watch") npc.facing = Math.sin(npc.clock * .35 + npc.phase) > 0 ? 1 : -1;
      }
      npc.work = Math.sin(npc.clock * (npc.behavior === "map" ? 2.8 : 4) + npc.phase);
    });
  };
  const nearestNpc = (radius = 68) => {
    if (state.area !== "overworld") return null;
    return npcs.reduce((nearest, npc) => { const range = distance(player, npc); return range < radius && (!nearest || range < nearest.range) ? { npc, range } : nearest; }, null)?.npc || null;
  };
  const spawnDrop = (enemy) => {
    if (!enemy.drop) return;
    drops.push({ x: enemy.x, y: enemy.y, ...enemy.drop, life: 24, phase: rand(0, 6.28), bob: rand(0, 6.28) });
  };
  const spawnEnemyDeath = (enemy) => {
    enemy.dead = true; spawnLeaves(enemy.x, enemy.y, enemy.type === "boss" ? 34 : 12); spawnParticle(enemy.x, enemy.y, enemy.color, enemy.type === "boss" ? 20 : 9, enemy.type === "boss" ? 170 : 110, "impact"); triggerImpact(enemy.x, enemy.y, enemy.type === "boss" ? COLORS.gold : enemy.color, enemy.type === "boss" ? 1.45 : 1); spawnDrop(enemy);
  };
  const updateDrops = (dt) => {
    drops = drops.filter((drop) => {
      drop.life -= dt; drop.bob += dt * 4;
      if (distance(player, drop) < 25 && state.mode === "playing") { state.loot += 1; showToast(`${drop.name} collected`, 1100); spawnParticle(drop.x, drop.y, drop.color, 8, 60, "spark"); saveData(); updateHud(); return false; }
      return drop.life > 0;
    });
  };
  const addDiscovery = (label) => {
    state.discoveries = Math.min(state.discoveryTotal, (state.discoveries || 0) + 1);
    showToast(`${label} · discovery ${state.discoveries}/${state.discoveryTotal}`, 2200);
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
    enemies.push({ id: makeId(type), type, x, y, homeX: x, homeY: y, ...config, ...options, velocityX: 0, velocityY: 0, attackCooldown: options.attackCooldown ?? rand(.25, config.attackRate), hitFlash: 0, hitStun: 0, telegraph: 0, telegraphType: "", state: "idle", stateTimer: rand(.2, .7), phase: 1, dead: false, alerted: false, hidden: type === "moth", orbit: rand(0, 6.28), chargeX: 0, chargeY: 0, aimX: 0, aimY: 0 });
  };
  const spawnHiddenEncounter = () => {
    if (state.area !== "overworld" || !state.southPassageOpen || state.optionalGuardDefeated || enemies.some((enemy) => enemy.encounter === "hidden-cache" && !enemy.dead)) return;
    spawnEnemy("thornback", 1050, 818, { guardRadius: 72, encounter: "hidden-cache", attackCooldown: .7 });
  };

  const resetPlayerMotion = () => {
    player.velocityX = 0; player.velocityY = 0; player.attack = 0; player.attackElapsed = 0; player.attackCooldown = 0;
    player.attackBuffer = 0; player.dash = 0; player.dashCooldown = 0; player.invulnerable = 0; player.hurt = 0;
  };

  const startArea = (area, announce = true) => {
    state.area = area;
    state.spawnGrace = area === "overworld" ? 3.2 : 0;
    enemies = []; projectiles = []; drops = []; particles = [];
    if (area === "overworld") {
      player.x = 390; player.y = 500;
      spawnEnemy("mossling", 650, 455, { group: "meadow-pack" }); spawnEnemy("mossling", 705, 470, { group: "meadow-pack" }); spawnEnemy("mossling", 740, 430, { group: "meadow-pack" });
      spawnEnemy("thornback", 905, 520, { guardRadius: 120, encounter: "bridge-guard" });
      spawnEnemy("wisp", 1145, 340, { guardRadius: 150, encounter: "lantern-grove" });
      spawnEnemy("moth", 1280, 745, { guardRadius: 90, encounter: "chest-ambush" });
      spawnHiddenEncounter();
      if (announce) showToast("LAN TERNWOOD · the moths are listening");
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
    if (key === "0-0") { spawnEnemy("mossling", 330, 285); spawnEnemy("mossling", 820, 420); }
    if (key === "1-0") { spawnEnemy("wisp", 350, 360); spawnEnemy("wisp", 850, 270); }
    if (key === "2-0" && !state.miniBossDefeated) spawnEnemy("warden", 600, 360);
    if (key === "0-1") { spawnEnemy("mossling", 280, 260); spawnEnemy("wisp", 850, 520); }
    if (key === "1-1") spawnEnemy("wisp", 620, 330);
    if (key === "2-1" && !state.bossDefeated) spawnEnemy("boss", 600, 285);
  };

  const overworldObstacles = () => [
    { x: 800, y: 90, w: 300, h: 165, type: "house" }, { x: 1140, y: 100, w: 190, h: 135, type: "outpost" },
    { x: 610, y: 650, w: 360, h: 150, type: "water" }, { x: 1080, y: 510, w: 260, h: 90, type: "water" },
    { x: 240, y: 220, w: 90, h: 130, type: "rock" }, { x: 1420, y: 300, w: 100, h: 190, type: "rock" }
  ];
  const dungeonObstacles = () => {
    const walls = [{ x: 0, y: 0, w: ROOM.width, h: 35 }, { x: 0, y: ROOM.height - 35, w: ROOM.width, h: 35 }, { x: 0, y: 0, w: 35, h: ROOM.height }, { x: ROOM.width - 35, y: 0, w: 35, h: ROOM.height }];
    const key = `${state.roomX}-${state.roomY}`;
    if (key === "0-1") walls.push({ x: 300, y: 210, w: 80, h: 180, type: "pillar" }, { x: 820, y: 400, w: 80, h: 180, type: "pillar" });
    if (key === "1-1") walls.push({ x: 300, y: 180, w: 600, h: 28, type: "wall" });
    return walls;
  };
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
    return false;
  };

  const tryMove = (dx, dy) => {
    const nextX = { ...player, x: player.x + dx }; const nextY = { ...player, y: player.y + dy };
    if (!collidesWorld(nextX)) player.x = clamp(nextX.x, player.radius, (state.area === "overworld" ? WORLD.width : ROOM.width) - player.radius);
    if (!collidesWorld(nextY)) player.y = clamp(nextY.y, player.radius, (state.area === "overworld" ? WORLD.height : ROOM.height) - player.radius);
  };

  const readMoveInput = () => {
    let x = 0; let y = 0;
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
  const attack = () => {
    if (state.mode !== "playing" || state.dialogue || player.dash > 0) return;
    if (player.attackCooldown > 0) { player.attackBuffer = .13; return; }
    const direction = readMoveInput();
    const facing = direction.x || direction.y ? direction : normalized(player.facingX, player.facingY);
    player.attack = .34; player.attackElapsed = 0; player.attackCooldown = .38; player.attackBuffer = 0; player.attackHitRegistered = false;
    player.attackDirectionX = facing.x; player.attackDirectionY = facing.y; player.targetFacingX = facing.x; player.targetFacingY = facing.y;
    spawnDust(player.x - facing.x * 10, player.y - facing.y * 10, 3, "#d7c594");
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
      enemy.hp -= 1; enemy.hitFlash = .2; enemy.hitStun = enemy.type === "boss" ? .12 : .2;
      enemy.velocityX = hit.direction.x * knockback; enemy.velocityY = hit.direction.y * knockback;
      spawnParticle(enemy.x, enemy.y, enemy.color, enemy.type === "boss" ? 12 : 8, 125, "impact");
      triggerImpact(enemy.x, enemy.y, enemy.type === "boss" ? COLORS.rose : COLORS.gold, enemy.type === "boss" ? 1.35 : 1);
      hitCount += 1;
      if (enemy.hp <= 0) {
        spawnEnemyDeath(enemy);
        if (enemy.encounter === "hidden-cache") { state.optionalGuardDefeated = true; showToast("The grove is safe · the old chest waits beneath the lantern leaves", 2200); saveData(); }
        if (enemy.type === "warden") { state.miniBossDefeated = true; showToast("The Warden yields · the sanctum opens"); saveData(); }
        if (enemy.type === "boss") { state.bossDefeated = true; state.reward = true; showVictory(); saveData(); }
      }
    });
    breakables().forEach((object) => {
      if (!object.broken && distance(hit, object) < 38 && ((object.x - player.x) * hit.direction.x + (object.y - player.y) * hit.direction.y) > 0) {
        object.broken = true; spawnLeaves(object.x, object.y, 14); triggerImpact(object.x, object.y, COLORS.moss, .8);
        if (object.id === "root-ivy") { state.secretFound = true; showToast("The old roots part · a blue seam glows at the shrine"); updateObjective(); saveData(); }
        if (object.id === "pond-ivy") { state.southPassageOpen = true; showToast("The reeds fall away · something watches the grove"); spawnHiddenEncounter(); updateObjective(); saveData(); }
        if (object.id === "reed-cache") { state.reedCacheFound = true; state.lanternLens = true; addDiscovery("Dewglass lens recovered"); }
      }
    });
    if (hitCount === 0) { spawnParticle(hit.x, hit.y, COLORS.gold, 3, 70, "spark"); camera.shake = Math.max(camera.shake, .018); }
  };
  const dash = () => {
    if (state.mode !== "playing" || state.dialogue || player.dashCooldown > 0 || player.hurt > 0) return;
    const direction = readMoveInput(); const facing = direction.x || direction.y ? direction : normalized(player.facingX, player.facingY);
    player.dash = .22; player.dashCooldown = .68; player.invulnerable = .25; player.dashDirectionX = facing.x; player.dashDirectionY = facing.y; player.attack = 0; player.attackHitRegistered = true;
    player.velocityX = facing.x * 470; player.velocityY = facing.y * 470; spawnDust(player.x, player.y + 10, 8, "#b6c7b1"); spawnParticle(player.x, player.y, COLORS.mint, 10, 75, "spark"); camera.shake = Math.max(camera.shake, .035);
  };

  const hurtPlayer = (amount, source) => {
    if (player.invulnerable > 0 || player.hurt > 0 || state.mode !== "playing") return;
    player.hp = Math.max(0, player.hp - amount); player.hurt = .2; player.invulnerable = .72; player.attack = 0; player.attackCooldown = .18;
    const direction = normalized(player.x - source.x, player.y - source.y, -player.facingX, -player.facingY);
    player.velocityX = direction.x * 235; player.velocityY = direction.y * 235; camera.shake = Math.max(camera.shake, .13);
    triggerImpact(player.x, player.y, COLORS.rose, 1.25); spawnParticle(player.x, player.y, COLORS.rose, 12, 135, "impact"); updateHud();
    if (player.hp <= 0) { state.mode = "dead"; hideScreens(); ui.title.classList.remove("hidden"); ui.title.querySelector(".screen-kicker").textContent = "THE LANTERN WENT OUT"; ui.title.querySelector("h2").textContent = "The roots took you"; ui.title.querySelector("p:not(.screen-kicker)").textContent = "Start again at the outpost. The shrine will still be waiting."; document.getElementById("new-game").textContent = "Restart"; document.getElementById("continue-game").classList.add("hidden"); }
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
      if (distance(player, { x: 1350, y: 235 }) < 120) { enterDungeon(); return; }
      if (distance(player, { x: 1240, y: 745 }) < 70 && !state.chestOpened) { state.chestOpened = true; state.key = true; spawnLeaves(1240, 745, 18); showToast("You found an old brass key"); saveData(); updateHud(); return; }
      if (distance(player, { x: 1060, y: 830 }) < 70 && state.southPassageOpen && !state.hiddenChestOpened && !enemies.some((enemy) => enemy.encounter === "hidden-cache" && !enemy.dead)) {
        state.hiddenChestOpened = true; state.lanternSeed = true; player.maxHp = 6 + (state.heartChestOpened ? 1 : 0) + 1; player.hp = player.maxHp; state.discoveries = Math.min(state.discoveryTotal, (state.discoveries || 0) + 1); spawnLeaves(1060, 830, 24); triggerImpact(1060, 830, COLORS.gold, 1.2); showToast(`Lantern seed found · maximum health increased · discovery ${state.discoveries}/${state.discoveryTotal}`, 2600); saveData(); updateHud(); return;
      }
    } else {
      const key = `${state.roomX}-${state.roomY}`;
      if (key === "0-0" && distance(player, { x: 600, y: 390 }) < 80 && !state.chestOpened) { state.chestOpened = true; state.key = true; showToast("Brass key acquired"); spawnLeaves(600, 390, 20); saveData(); updateHud(); return; }
      if (key === "1-0" && distance(player, { x: 600, y: 380 }) < 80 && !state.switches) { state.switches = true; showToast("The moon switch unlocks the lower gate"); spawnLeaves(600, 380, 20); saveData(); updateHud(); return; }
      if (key === "0-1" && distance(player, { x: 600, y: 390 }) < 80 && !state.heartChestOpened) { state.heartChestOpened = true; player.maxHp += 1; player.hp = player.maxHp; showToast("Heartseed shard · maximum health increased"); saveData(); updateHud(); return; }
      if (key === "2-1" && state.bossDefeated && distance(player, { x: 600, y: 150 }) < 100) { showVictory(); return; }
    }
    showToast("Nothing answers from here", 900);
  };

  const enterDungeon = () => { state.area = "dungeon"; state.roomX = 0; state.roomY = 0; player.x = ROOM.width / 2; player.y = ROOM.height - 100; startArea("dungeon"); saveData(); updateObjective(); };
  const transitionDungeon = (dx, dy) => {
    const from = `${state.roomX}-${state.roomY}`; const targetX = state.roomX + dx; const targetY = state.roomY + dy;
    if (from === "0-0" && dy < 0 || from === "0-1" && dy > 0) { if (from === "0-1") { state.area = "overworld"; startArea("overworld"); return; } }
    if (targetX < 0 || targetX > 2 || targetY < 0 || targetY > 1) return;
    if (from === "1-0" && dy > 0 && !state.switches) { showToast("The moon switch is still dark"); return; }
    if (from === "1-1" && dx > 0 && !state.key) { showToast("A brass keyhole bars this door"); return; }
    if (from === "2-0" && dy > 0 && !state.miniBossDefeated) { showToast("The Warden still guards the lower gate"); return; }
    state.roomX = targetX; state.roomY = targetY; player.x = dx > 0 ? 80 : dx < 0 ? ROOM.width - 80 : ROOM.width / 2; player.y = dy > 0 ? 80 : dy < 0 ? ROOM.height - 80 : ROOM.height / 2; state.transitionCooldown = .5; startArea("dungeon"); saveData(); updateObjective();
  };

  const enemyMove = (enemy, dx, dy, speed, dt) => { const direction = normalized(dx, dy, 0, 0); enemy.x += direction.x * speed * dt; enemy.y += direction.y * speed * dt; };
  const beginEnemyTelegraph = (enemy, type, duration) => { enemy.state = type; enemy.stateTimer = duration; enemy.telegraph = duration; enemy.telegraphType = type; spawnParticle(enemy.x, enemy.y, type === "rangedWindup" ? COLORS.wisp : COLORS.gold, 3, 24, "spark"); };
  const resolveEnemyMelee = (enemy, reach = 10, damage = enemy.damage) => { if (distance(enemy, player) < enemy.radius + player.radius + reach) { hurtPlayer(damage, enemy); triggerImpact(player.x, player.y, enemy.color, enemy.type === "thornback" ? 1.2 : .72); return true; } return false; };
  const fireWispBolt = (enemy) => {
    const direction = normalized(enemy.aimX, enemy.aimY, player.x - enemy.x, player.y - enemy.y);
    projectiles.push({ owner: "enemy", kind: "moonbolt", x: enemy.x, y: enemy.y, vx: direction.x * 165, vy: direction.y * 165, life: 2.5, radius: 7, color: COLORS.wisp, damage: enemy.damage });
    spawnParticle(enemy.x, enemy.y, COLORS.wisp, 10, 65, "spark");
  };
  const fireBossVolley = (enemy) => {
    const count = enemy.phase === 2 ? 5 : 3; const center = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    for (let i = 0; i < count; i += 1) { const angle = center + (i - (count - 1) / 2) * .22; projectiles.push({ owner: "enemy", kind: "rosebolt", x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 125, vy: Math.sin(angle) * 125, life: 2.4, radius: 7, color: enemy.phase === 2 ? COLORS.rose : COLORS.gold, damage: enemy.damage }); }
    spawnParticle(enemy.x, enemy.y, enemy.phase === 2 ? COLORS.rose : COLORS.gold, 14, 75, "spark");
  };
  const updateEnemyIdle = (enemy, dt) => {
    enemy.stateTimer -= dt; enemy.orbit += dt * .35;
    const guardRadius = enemy.guardRadius || 30; const targetX = enemy.homeX + Math.cos(enemy.orbit) * Math.min(guardRadius, 28); const targetY = enemy.homeY + Math.sin(enemy.orbit * .8) * Math.min(guardRadius, 18);
    enemy.x += (targetX - enemy.x) * Math.min(1, dt * 1.5); enemy.y += (targetY - enemy.y) * Math.min(1, dt * 1.5);
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
    if (enemy.state === "charging") { enemy.stateTimer -= dt; enemy.x += enemy.velocityX * dt; enemy.y += enemy.velocityY * dt; if (distance(enemy, player) < enemy.radius + player.radius + 12) { hurtPlayer(enemy.damage, enemy); triggerImpact(player.x, player.y, COLORS.thorn, 1.2); enemy.state = "recover"; enemy.stateTimer = .55; enemy.velocityX = 0; enemy.velocityY = 0; enemy.attackCooldown = enemy.attackRate; } else if (enemy.stateTimer <= 0) { enemy.state = "recover"; enemy.stateTimer = .45; enemy.velocityX = 0; enemy.velocityY = 0; enemy.attackCooldown = enemy.attackRate; } return; }
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
    if (enemy.state === "pounce") { enemy.stateTimer -= dt; enemy.x += enemy.velocityX * dt; enemy.y += enemy.velocityY * dt; if (distance(enemy, player) < enemy.radius + player.radius + 10) { hurtPlayer(enemy.damage, enemy); triggerImpact(player.x, player.y, COLORS.moth, .9); enemy.state = "retreat"; enemy.stateTimer = .7; enemy.attackCooldown = enemy.attackRate; } else if (enemy.stateTimer <= 0) { enemy.state = "retreat"; enemy.stateTimer = .55; enemy.attackCooldown = enemy.attackRate; } return; }
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
  const updateBoss = (enemy, dist, dt) => {
    enemy.phase = enemy.hp <= enemy.maxHp / 2 ? 2 : 1; enemy.orbit += dt * (enemy.phase === 2 ? 1.6 : .8);
    if (enemy.state === "bossWindup") { enemy.stateTimer -= dt; if (enemy.stateTimer <= 0) { fireBossVolley(enemy); enemy.attackCooldown = enemy.phase === 2 ? .8 : 1.25; enemy.state = "orbit"; enemy.telegraph = 0; } return; }
    if (dist > 180) { enemy.x += Math.cos(enemy.orbit) * enemy.speed * dt; enemy.y += Math.sin(enemy.orbit) * enemy.speed * dt; }
    if (dist < enemy.detectionRange && enemy.attackCooldown <= 0) beginEnemyTelegraph(enemy, "bossWindup", enemy.phase === 2 ? .55 : .7);
  };
  const updateEnemies = (dt) => {
    if (state.spawnGrace > 0) return;
    enemies.forEach((enemy) => {
      if (enemy.dead) return;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt); enemy.hitStun = Math.max(0, enemy.hitStun - dt); enemy.attackCooldown -= dt; enemy.telegraph = Math.max(0, enemy.telegraph - dt);
      if (enemy.hitStun > 0) { enemy.x += enemy.velocityX * dt; enemy.y += enemy.velocityY * dt; enemy.velocityX = moveToward(enemy.velocityX, 0, 760 * dt); enemy.velocityY = moveToward(enemy.velocityY, 0, 760 * dt); return; }
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
      enemy.x += enemy.velocityX * dt; enemy.y += enemy.velocityY * dt;
    });
    enemies = enemies.filter((enemy) => !enemy.dead);
    const maxX = state.area === "overworld" ? WORLD.width : ROOM.width; const maxY = state.area === "overworld" ? WORLD.height : ROOM.height;
    projectiles = projectiles.filter((projectile) => { projectile.x += projectile.vx * dt; projectile.y += projectile.vy * dt; projectile.life -= dt; if (distance(projectile, player) < projectile.radius + player.radius) { hurtPlayer(projectile.damage || 1, projectile); return false; } return projectile.life > 0 && projectile.x > 0 && projectile.y > 0 && projectile.x < maxX && projectile.y < maxY; });
  };

  const updatePlayer = (dt) => {
    player.attackCooldown = Math.max(0, player.attackCooldown - dt); player.attackBuffer = Math.max(0, player.attackBuffer - dt); player.dashCooldown = Math.max(0, player.dashCooldown - dt); player.invulnerable = Math.max(0, player.invulnerable - dt); player.hurt = Math.max(0, player.hurt - dt); state.transitionCooldown = Math.max(0, state.transitionCooldown - dt);
    if (justPressed.has("j") || justPressed.has(" ")) attack(); if (justPressed.has("k")) dash();
    if (player.attackBuffer > 0 && player.attackCooldown <= 0) attack();
    const input = readMoveInput(); const hasInput = input.x || input.y;
    if (hasInput) { player.targetFacingX = input.x; player.targetFacingY = input.y; }
    const facingBlend = 1 - Math.pow(.0005, dt);
    player.facingX = moveToward(player.facingX, player.targetFacingX, facingBlend); player.facingY = moveToward(player.facingY, player.targetFacingY, facingBlend);
    const facingLength = Math.hypot(player.facingX, player.facingY) || 1; player.facingX /= facingLength; player.facingY /= facingLength;
    player.animTime += dt;
    if (player.dash > 0) {
      player.visualState = "dash"; player.dash -= dt; tryMove(player.velocityX * dt, player.velocityY * dt); player.velocityX = player.dashDirectionX * 470; player.velocityY = player.dashDirectionY * 470;
      if (Math.random() < .6) spawnDust(player.x, player.y + 12, 1, "#b6c7b1");
    } else {
      const attackMovement = player.attack > 0 ? .52 : 1; const maxSpeed = 185 * attackMovement; const acceleration = hasInput ? 1120 : 1480;
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
    if (player.attack <= 0 && player.visualState === "attack") player.visualState = hasInput ? "move" : "idle";
    player.velocityX = moveToward(player.velocityX, 0, player.dash > 0 ? 0 : 520 * dt); player.velocityY = moveToward(player.velocityY, 0, player.dash > 0 ? 0 : 520 * dt);
  };

  const update = (dt) => {
    if (state.toastTimer > 0) { state.toastTimer -= dt * 1000; if (state.toastTimer <= 0) ui.toast.classList.remove("visible"); }
    state.impactFlash = Math.max(0, state.impactFlash - dt); camera.shake = Math.max(0, camera.shake - dt * 1.8); state.spawnGrace = Math.max(0, (state.spawnGrace || 0) - dt);
    leaves.forEach((leaf) => { leaf.y += leaf.speed * dt; leaf.x += Math.sin(leaf.phase + leaf.y * .01) * dt * 3; if (leaf.y > WORLD.height + 20) leaf.y = -10; });
    particles = particles.filter((particle) => { particle.life -= dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 45 * dt; return particle.life > 0; });
    updateEnvironment(dt);
    updateNpcs(dt);
    if (state.dialogue) { updateDialogue(dt); justPressed.clear(); updateCamera(dt); return; }
    if (state.mode !== "playing") return;
    updatePlayer(dt); updateEnemies(dt); updateDrops(dt);
    if (state.area === "dungeon" && state.transitionCooldown <= 0) {
      if (player.x < 42) transitionDungeon(-1, 0); else if (player.x > ROOM.width - 42) transitionDungeon(1, 0); else if (player.y < 42) transitionDungeon(0, -1); else if (player.y > ROOM.height - 42) transitionDungeon(0, 1);
    }
    state.lastSave += dt; if (state.lastSave > 8) saveData();
    updateCamera(dt);
    justPressed.clear(); updateHud();
  };

  const updateCamera = (dt) => { const maxX = (state.area === "overworld" ? WORLD.width : ROOM.width) - WIDTH; const maxY = (state.area === "overworld" ? WORLD.height : ROOM.height) - HEIGHT; const targetX = clamp(player.x - WIDTH / 2, 0, Math.max(0, maxX)); const targetY = clamp(player.y - HEIGHT / 2, 0, Math.max(0, maxY)); camera.x += (targetX - camera.x) * Math.min(1, dt * 6); camera.y += (targetY - camera.y) * Math.min(1, dt * 6); camera.shakeX = camera.shake ? rand(-camera.shake, camera.shake) * 14 : 0; camera.shakeY = camera.shake ? rand(-camera.shake, camera.shake) * 14 : 0; };

  const drawShadow = (x, y, rx, ry, alpha = .3) => { ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = "#06110d"; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); };
  const drawGrassBase = (time) => {
    const wash = ctx.createLinearGradient(0, 0, WORLD.width, WORLD.height); wash.addColorStop(0, "#3b7650"); wash.addColorStop(.45, "#315f45"); wash.addColorStop(1, "#274c3b");
    ctx.fillStyle = wash; ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.globalAlpha = .16; ctx.fillStyle = "#8fca75";
    [[180,190,230,90],[530,420,310,130],[1060,320,250,160],[1350,760,330,150],[380,820,240,110]].forEach(([x,y,rx,ry], i) => { ctx.save(); ctx.translate(x, y); ctx.rotate(i * .43); ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
    ctx.globalAlpha = .1; ctx.fillStyle = "#b8dc87";
    for (let i = 0; i < 52; i += 1) { const x = (i * 173) % WORLD.width; const y = (i * 97 + 38) % WORLD.height; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(time * .2 + i) * .2); ctx.fillRect(0, 0, 2 + (i % 3), 8 + (i % 4) * 2); ctx.restore(); }
    ctx.globalAlpha = 1;
  };
  const drawTree = (tree, time, layer = "mid") => {
    const { x, y, s, phase = 0 } = tree; const sway = Math.sin(time * .55 + phase) * .018; const depth = layer === "back" ? .68 : layer === "front" ? 1.08 : .9;
    const canopyA = layer === "back" ? "#4f9662" : layer === "front" ? "#3c7d54" : "#478f5c"; const canopyB = layer === "back" ? "#71b878" : layer === "front" ? "#5da86b" : "#64ad70";
    drawShadow(x, y + 57 * s, 30 * s, 10 * s, layer === "front" ? .45 : .3);
    ctx.save(); ctx.globalAlpha = depth; ctx.translate(x, y); ctx.rotate(sway); ctx.scale(s, s);
    ctx.fillStyle = "#6e4935"; ctx.beginPath(); ctx.moveTo(-10, 5); ctx.lineTo(9, 5); ctx.lineTo(14, 58); ctx.lineTo(-15, 58); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#aa7048"; ctx.fillRect(-3, 8, 5, 44); ctx.fillStyle = "rgba(33,56,39,.22)"; ctx.fillRect(8, 13, 5, 41);
    [[-29, 5, 29], [22, 4, 34], [0, -24, 43], [-5, 27, 38], [30, -20, 25]].forEach(([ox, oy, radius], i) => {
      ctx.fillStyle = i % 2 ? canopyA : canopyB; ctx.beginPath(); ctx.arc(ox, oy, radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(224,255,194,.14)"; ctx.beginPath(); ctx.arc(ox - 9, oy - 10, radius * .32, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = "rgba(17,56,42,.22)"; ctx.beginPath(); ctx.ellipse(0, 35, 36, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  const drawHouse = (x, y, w, h, color, accent = "#b97b58") => {
    drawShadow(x + w / 2, y + h + 14, w * .5, 15, .34);
    ctx.fillStyle = "rgba(11,35,27,.24)"; ctx.fillRect(x - 8, y + 38, w + 16, h - 30);
    ctx.fillStyle = color; ctx.fillRect(x, y + 30, w, h - 30);
    ctx.fillStyle = "rgba(255,249,208,.24)"; ctx.fillRect(x + 10, y + 45, w - 20, 5);
    ctx.fillStyle = accent; ctx.beginPath(); ctx.moveTo(x - 25, y + 33); ctx.lineTo(x + w / 2, y - 52); ctx.lineTo(x + w + 25, y + 33); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,220,153,.16)"; ctx.beginPath(); ctx.moveTo(x + 8, y + 31); ctx.lineTo(x + w / 2, y - 42); ctx.lineTo(x + w - 8, y + 31); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#e9d39c"; ctx.fillRect(x + 27, y + 72, 38, 42); ctx.fillStyle = "#72928d"; ctx.fillRect(x + 31, y + 76, 30, 34); ctx.strokeStyle = "rgba(38,67,59,.55)"; ctx.strokeRect(x + 31, y + 76, 30, 34);
    ctx.fillStyle = "#6e4838"; ctx.fillRect(x + w / 2 - 21, y + h - 86, 42, 86); ctx.fillStyle = "#d7a76e"; ctx.fillRect(x + w / 2 - 4, y + h - 45, 5, 5);
    ctx.fillStyle = "#73513e"; ctx.fillRect(x + w - 58, y - 28, 14, 34); ctx.fillStyle = "rgba(255,210,129,.2)"; ctx.fillRect(x + w - 55, y - 22, 8, 8);
    ctx.fillStyle = "#8f6446"; ctx.fillRect(x + 18, y + h - 5, 58, 5);
  };
  const drawWater = (rect, time) => {
    const water = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h); water.addColorStop(0, "#2d8584"); water.addColorStop(1, "#1f5e6a"); ctx.fillStyle = water; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = "rgba(164,246,216,.28)"; ctx.lineWidth = 2;
    for (let y = rect.y + 18; y < rect.y + rect.h; y += 28) { ctx.beginPath(); for (let x = rect.x; x < rect.x + rect.w; x += 24) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 10, y + Math.sin(time * 2 + x * .03 + y) * 3, x + 20, y); } ctx.stroke(); }
    ctx.fillStyle = "rgba(226,255,218,.13)"; for (let i = 0; i < 5; i += 1) { const x = rect.x + ((time * (9 + i * 2) + i * 74) % (rect.w + 80)) - 40; ctx.fillRect(x, rect.y + 22 + i * 27, 34, 3); }
  };
  const drawPond = (rect, time, shallow = false) => {
    ctx.save(); ctx.fillStyle = "rgba(11,47,43,.32)"; ctx.beginPath(); ctx.roundRect(rect.x - 8, rect.y + 8, rect.w + 16, rect.h + 12, 22); ctx.fill();
    const shape = () => { ctx.beginPath(); ctx.moveTo(rect.x + 18, rect.y + 14); ctx.quadraticCurveTo(rect.x + rect.w * .28, rect.y - 6, rect.x + rect.w * .55, rect.y + 12); ctx.quadraticCurveTo(rect.x + rect.w + 12, rect.y + 8, rect.x + rect.w - 6, rect.y + rect.h * .52); ctx.quadraticCurveTo(rect.x + rect.w - 18, rect.y + rect.h + 10, rect.x + rect.w * .58, rect.y + rect.h - 2); ctx.quadraticCurveTo(rect.x + 16, rect.y + rect.h + 8, rect.x + 5, rect.y + rect.h * .58); ctx.closePath(); };
    shape(); const water = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h); water.addColorStop(0, shallow ? "#3e9991" : "#2c8787"); water.addColorStop(1, "#1c5969"); ctx.fillStyle = water; ctx.fill();
    ctx.save(); shape(); ctx.clip(); ctx.strokeStyle = "rgba(167,249,218,.33)"; ctx.lineWidth = 2;
    for (let y = rect.y + 22; y < rect.y + rect.h + 20; y += 28) { ctx.beginPath(); for (let x = rect.x - 30; x < rect.x + rect.w + 30; x += 28) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 12, y + Math.sin(time * 2.4 + x * .03 + y) * 3, x + 24, y); } ctx.stroke(); }
    ctx.fillStyle = "rgba(237,255,213,.2)"; for (let i = 0; i < 6; i += 1) { const x = rect.x + ((time * (12 + i) + i * 81) % (rect.w + 90)) - 35; ctx.fillRect(x, rect.y + 24 + i * 24, 38, 3); } ctx.restore();
    ctx.strokeStyle = "rgba(196,213,162,.65)"; ctx.lineWidth = 4; shape(); ctx.stroke(); ctx.restore();
  };
  const drawPath = (time) => {
    ctx.save(); ctx.globalAlpha = .18; ctx.strokeStyle = "#182f2a"; ctx.lineWidth = 92; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-30, 500); ctx.quadraticCurveTo(430, 433, 760, 515); ctx.quadraticCurveTo(1110, 590, 1630, 450); ctx.stroke();
    ctx.globalAlpha = 1; ctx.strokeStyle = "#c1a777"; ctx.lineWidth = 78; ctx.beginPath(); ctx.moveTo(-30, 490); ctx.quadraticCurveTo(430, 423, 760, 505); ctx.quadraticCurveTo(1110, 580, 1630, 440); ctx.stroke();
    ctx.strokeStyle = "rgba(246,222,166,.32)"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-20, 470); ctx.quadraticCurveTo(430, 405, 760, 486); ctx.quadraticCurveTo(1110, 560, 1610, 425); ctx.stroke();
    ctx.globalAlpha = .16; ctx.strokeStyle = "#1d392f"; ctx.lineWidth = 48; ctx.beginPath(); ctx.moveTo(85, 620); ctx.quadraticCurveTo(310, 580, 520, 610); ctx.stroke();
    ctx.globalAlpha = 1; ctx.strokeStyle = "#aa9069"; ctx.lineWidth = 34; ctx.beginPath(); ctx.moveTo(85, 614); ctx.quadraticCurveTo(310, 574, 520, 604); ctx.stroke();
    ctx.strokeStyle = "rgba(247,223,170,.25)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(92, 605); ctx.quadraticCurveTo(310, 568, 516, 596); ctx.stroke();
    for (let i = 0; i < 22; i += 1) { const x = (i * 79 + 30) % 1550; const y = 480 + Math.sin(x * .011) * 30 + Math.sin(time * .4 + i) * 2; ctx.fillStyle = i % 3 ? "rgba(145,119,83,.35)" : "rgba(245,218,163,.38)"; ctx.beginPath(); ctx.ellipse(x, y, 3 + i % 3, 2, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  };
  const drawGrassTuft = (item, time, foreground = false) => {
    const rustle = item.rustle || 0; const sway = Math.sin(time * 2.2 + item.phase) * .12 + rustle * Math.sin(time * 22 + item.phase) * .36;
    ctx.save(); ctx.translate(item.x, item.y); ctx.rotate(sway); ctx.scale(item.s || 1, item.s || 1); ctx.globalAlpha = foreground ? .72 : .92;
    [[-8, "#5f9e5a"], [-3, "#77b866"], [3, "#4d8950"], [8, "#83c56d"]].forEach(([offset, color], i) => { ctx.strokeStyle = color; ctx.lineWidth = i % 2 ? 3 : 2; ctx.beginPath(); ctx.moveTo(offset, 8); ctx.quadraticCurveTo(offset - 2, -4, offset + (i - 1.5) * 3, -18 - (i % 2) * 4); ctx.stroke(); });
    ctx.restore();
  };
  const drawFlower = (flower, time) => {
    const rustle = flower.rustle || 0; const sway = Math.sin(time * 1.8 + flower.phase) * .08 + rustle * Math.sin(time * 18 + flower.phase) * .3;
    ctx.save(); ctx.translate(flower.x, flower.y); ctx.rotate(sway); ctx.scale(flower.s, flower.s); ctx.strokeStyle = "#6f9b58"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 10); ctx.quadraticCurveTo(-2, -2, 0, -11); ctx.stroke(); ctx.fillStyle = flower.color; for (let i = 0; i < 4; i += 1) { ctx.beginPath(); ctx.ellipse(Math.cos(i * 1.57) * 4, -13 + Math.sin(i * 1.57) * 4, 4, 2.5, i * 1.57, 0, Math.PI * 2); ctx.fill(); } ctx.fillStyle = "#ffe8a4"; ctx.beginPath(); ctx.arc(0, -13, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  const drawRock = (rock) => { ctx.save(); ctx.translate(rock.x, rock.y); ctx.scale(rock.s, rock.s); drawShadow(0, 10, 20, 7, .3); ctx.fillStyle = rock.tone; ctx.beginPath(); ctx.moveTo(-22, 8); ctx.quadraticCurveTo(-24, -10, -8, -17); ctx.quadraticCurveTo(10, -23, 24, -4); ctx.quadraticCurveTo(25, 10, 7, 13); ctx.closePath(); ctx.fill(); ctx.fillStyle = "rgba(211,235,197,.2)"; ctx.beginPath(); ctx.ellipse(-7, -8, 10, 5, -.2, 0, Math.PI * 2); ctx.fill(); ctx.restore(); };
  const drawLog = (log) => { ctx.save(); ctx.translate(log.x, log.y); ctx.rotate(log.angle); ctx.scale(log.s, log.s); drawShadow(0, 12, log.length * .45, 6, .32); ctx.fillStyle = "#684735"; ctx.fillRect(-log.length / 2, -10, log.length, 20); ctx.fillStyle = "#986b4a"; ctx.fillRect(-log.length / 2 + 12, -7, log.length - 24, 5); ctx.fillStyle = "#b58459"; ctx.beginPath(); ctx.ellipse(-log.length / 2, 0, 11, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#6f4937"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-log.length / 2, 0, 6, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = "#5c8f59"; ctx.beginPath(); ctx.arc(-14, -11, 8, 0, Math.PI * 2); ctx.arc(5, -12, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore(); };
  const drawLantern = (x, y, time) => { const glow = ctx.createRadialGradient(x, y, 1, x, y, 58); glow.addColorStop(0, "rgba(255,213,125,.33)"); glow.addColorStop(1, "rgba(255,213,125,0)"); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, 58, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#543c32"; ctx.fillRect(x - 3, y - 22, 6, 26); ctx.fillStyle = `rgba(255,215,133,${.72 + Math.sin(time * 7 + x) * .12})`; ctx.beginPath(); ctx.arc(x, y - 25, 6, 0, Math.PI * 2); ctx.fill(); };
  const drawButterfly = (item, time) => { const x = item.x + Math.sin(time * item.speed + item.phase) * item.range; const y = item.y + Math.cos(time * item.speed * .8 + item.phase) * 16; const flap = .65 + Math.abs(Math.sin(time * 9 + item.phase)) * .35; ctx.save(); ctx.translate(x, y); ctx.scale(1, flap); ctx.globalAlpha = .78; ctx.fillStyle = item.color; ctx.beginPath(); ctx.ellipse(-4, 0, 5, 3, -.35, 0, Math.PI * 2); ctx.ellipse(4, 0, 5, 3, .35, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#4d463a"; ctx.fillRect(-1, -2, 2, 5); ctx.restore(); };
  const drawBird = (item, time) => { const x = item.x + Math.sin(time * item.speed + item.phase) * item.range; const y = item.y + Math.sin(time * item.speed * 1.8 + item.phase) * 14; const flap = Math.sin(time * 5 + item.phase) * 3; ctx.save(); ctx.translate(x, y); ctx.scale(item.scale, item.scale); ctx.strokeStyle = "rgba(24,57,49,.7)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-10, flap); ctx.quadraticCurveTo(-4, -5, 0, 0); ctx.quadraticCurveTo(5, -5, 11, flap); ctx.stroke(); ctx.restore(); };
  const drawFirefly = (item, time) => { const glow = .35 + (Math.sin(time * 2.6 + item.phase) + 1) * .25; const x = item.x + Math.sin(time * .35 + item.phase) * 12; const y = item.y + Math.cos(time * .45 + item.phase) * 10; const gradient = ctx.createRadialGradient(x, y, 0, x, y, 18); gradient.addColorStop(0, `rgba(241,255,156,${glow})`); gradient.addColorStop(1, "rgba(241,255,156,0)"); ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = `rgba(255,255,185,${glow + .2})`; ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill(); };
  const drawExplorationClues = (time) => {
    const stones = [[968, 704, .8], [1001, 718, .62], [1031, 734, .48]];
    stones.forEach(([x, y, scale], index) => { ctx.save(); ctx.translate(x, y); ctx.rotate(-.18 + Math.sin(time * .7 + index) * .03); ctx.scale(scale, scale); ctx.fillStyle = index === 2 ? "#d6d4a5" : "#aaa986"; ctx.beginPath(); ctx.ellipse(0, 0, 15, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "rgba(239,240,194,.45)"; ctx.beginPath(); ctx.ellipse(-3, -2, 6, 2.5, -.15, 0, Math.PI * 2); ctx.fill(); ctx.restore(); });
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
    if (object.broken) return;
    const sway = Math.sin(time * 2.4 + object.x) * .08;
    ctx.save(); ctx.translate(object.x, object.y); ctx.rotate(sway); ctx.fillStyle = object.id === "reed-cache" ? "#527d55" : "#477d52"; ctx.beginPath(); ctx.arc(0, 0, 21, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = object.id === "reed-cache" ? "#d3b076" : "#a5d977"; ctx.beginPath(); ctx.arc(-8, -7, 7, 0, Math.PI * 2); ctx.arc(8, -4, 4, 0, Math.PI * 2); ctx.fill(); if (object.id === "reed-cache") { ctx.strokeStyle = "rgba(240,222,163,.58)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.stroke(); } ctx.restore();
  };
  const drawOverworld = (time) => {
    drawGrassBase(time); drawPath(time);
    environment.treesBack.forEach((tree) => drawTree(tree, time, "back"));
    drawPond({ x: 610, y: 650, w: 360, h: 150 }, time); drawPond({ x: 1080, y: 510, w: 260, h: 90 }, time + 1, true);
    environment.shoreStones.forEach((stone) => { ctx.fillStyle = "#b2b596"; ctx.beginPath(); ctx.ellipse(stone.x, stone.y, 13 * stone.s, 6 * stone.s, -.15, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "rgba(238,240,195,.28)"; ctx.beginPath(); ctx.ellipse(stone.x - 3, stone.y - 2, 5 * stone.s, 2 * stone.s, -.15, 0, Math.PI * 2); ctx.fill(); });
    environment.treesMid.forEach((tree) => drawTree(tree, time, "mid"));
    drawHouse(800, 90, 300, 165, "#d5c99e", "#a56e4e"); drawHouse(1140, 100, 190, 135, "#9fb88b", "#6a8e70");
    drawLantern(790, 290, time); drawLantern(1115, 282, time + 1); drawLantern(1280, 172, time + 2);
    ctx.fillStyle = "#6c4d3a"; ctx.fillRect(1280, 180, 64, 64); ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 4; ctx.strokeRect(1280, 180, 64, 64); ctx.fillStyle = "rgba(130,241,215,.42)"; ctx.fillRect(1290, 190, 44, 44); ctx.fillStyle = "#e5d59f"; ctx.fillRect(1303, 246, 20, 7);
    environment.rocks.forEach(drawRock); environment.logs.forEach(drawLog); drawExplorationClues(time); drawHiddenGrovePreview(time);
    environment.grasses.forEach((grass) => drawGrassTuft(grass, time)); environment.flowers.forEach((flower) => drawFlower(flower, time));
    if (!state.chestOpened) drawChest(1240, 745, false); else drawChest(1240, 745, true);
    drawCampfire(npcs[1].x - 24, npcs[1].y + 18, time); drawMapTable(npcs[3].x + 24, npcs[3].y + 18, time); drawPondBasket(npcs[2].x - 14, npcs[2].y + 14, time); npcs.forEach((npc) => drawNpc(npc, time)); drawEntrance(1312, 210, time);
    ctx.fillStyle = "rgba(255,226,166,.42)"; ctx.fillRect(420, 365, 78, 4); ctx.fillStyle = "#7a573e"; ctx.fillRect(453, 340, 5, 28); ctx.fillStyle = "#d3ad6d"; ctx.beginPath(); ctx.moveTo(458, 341); ctx.lineTo(493, 350); ctx.lineTo(458, 359); ctx.closePath(); ctx.fill();
    environment.birds.forEach((bird) => drawBird(bird, time)); environment.butterflies.forEach((butterfly) => drawButterfly(butterfly, time)); environment.fireflies.forEach((firefly) => drawFirefly(firefly, time));
    breakables().forEach((object) => drawBreakable(object, time));
  };
  const drawOutdoorForeground = (time) => {
    environment.treesFront.forEach((tree) => drawTree(tree, time, "front"));
    environment.grasses.filter((grass) => grass.y > 560).forEach((grass) => drawGrassTuft(grass, time, true));
    [[585, 730], [975, 735], [1060, 565]].forEach(([x, y], i) => { const sway = Math.sin(time * 2 + i) * .12; ctx.save(); ctx.translate(x, y); ctx.rotate(sway); ctx.strokeStyle = i === 2 ? "#78b979" : "#6fae69"; ctx.lineWidth = 3; for (let n = -1; n <= 1; n += 1) { ctx.beginPath(); ctx.moveTo(n * 8, 18); ctx.quadraticCurveTo(n * 9, 0, n * 13, -22); ctx.stroke(); } ctx.restore(); });
  };
  const drawChest = (x, y, open) => { drawShadow(x, y + 14, 25, 7, .35); ctx.fillStyle = open ? "#5c483b" : "#a87845"; ctx.fillRect(x - 22, y - 9, 44, 25); ctx.fillStyle = open ? "#775e50" : "#d2a65b"; ctx.beginPath(); ctx.arc(x, y - 7, 22, Math.PI, 0); ctx.fill(); ctx.fillStyle = COLORS.gold; ctx.fillRect(x - 3, y + 1, 6, 8); };
  const drawCampfire = (x, y, time) => { const glow = ctx.createRadialGradient(x, y, 1, x, y, 60); glow.addColorStop(0, "rgba(255,208,116,.35)"); glow.addColorStop(1, "rgba(255,208,116,0)"); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, 60, 0, Math.PI * 2); ctx.fill(); drawShadow(x, y + 7, 19, 5, .26); ctx.strokeStyle = "#80543a"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x - 11, y + 4); ctx.lineTo(x + 11, y - 4); ctx.moveTo(x - 10, y - 4); ctx.lineTo(x + 10, y + 4); ctx.stroke(); ctx.fillStyle = COLORS.gold; ctx.beginPath(); ctx.moveTo(x, y - 25 + Math.sin(time * 8) * 2); ctx.quadraticCurveTo(x + 13, y - 10, x, y + 2); ctx.quadraticCurveTo(x - 13, y - 10, x, y - 25 + Math.sin(time * 8) * 2); ctx.fill(); ctx.fillStyle = "#fff0b0"; ctx.beginPath(); ctx.arc(x, y - 10, 5, 0, Math.PI * 2); ctx.fill(); };
  const drawMapTable = (x, y, time) => { drawShadow(x, y + 11, 24, 6, .25); ctx.fillStyle = "#6f4b39"; ctx.fillRect(x - 20, y - 5, 40, 8); ctx.fillRect(x - 16, y + 3, 4, 18); ctx.fillRect(x + 12, y + 3, 4, 18); ctx.fillStyle = "#d5c28d"; ctx.fillRect(x - 13, y - 10, 26, 8); ctx.strokeStyle = "rgba(71,112,93,.75)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 8, y - 8); ctx.lineTo(x - 2, y - 4); ctx.lineTo(x + 4, y - 8); ctx.lineTo(x + 10, y - 3); ctx.stroke(); ctx.fillStyle = `rgba(255,215,123,${.35 + Math.sin(time * 3) * .1})`; ctx.beginPath(); ctx.arc(x + 18, y - 8, 3, 0, Math.PI * 2); ctx.fill(); };
  const drawPondBasket = (x, y, time) => { ctx.save(); ctx.translate(x, y + Math.sin(time * 1.7) * .5); ctx.fillStyle = "#b17b4d"; ctx.beginPath(); ctx.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#e2bd78"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -2, 10, Math.PI, 0); ctx.stroke(); ctx.restore(); };
  const drawNpc = (npc, time) => {
    const bob = Math.sin(time * 2.4 + npc.phase) * (npc.behavior === "pace" ? 1.2 : .8); const x = npc.x; const y = npc.y + bob;
    drawShadow(x, y + 18, npc.id === "brindle" ? 20 : 18, 7, .32);
    ctx.save(); ctx.translate(x, y); ctx.scale(npc.facing || 1, 1);
    if (npc.id === "rowan") {
      ctx.fillStyle = "#365c78"; ctx.beginPath(); ctx.moveTo(-16, 9); ctx.quadraticCurveTo(-14, -9, 0, -15); ctx.quadraticCurveTo(14, -9, 16, 9); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#233d59"; ctx.beginPath(); ctx.moveTo(-16, -14); ctx.lineTo(0, -28); ctx.lineTo(16, -14); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#d7a77b"; ctx.beginPath(); ctx.arc(0, -23, 8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = COLORS.gold; ctx.fillRect(-12, 1, 24, 5); ctx.fillStyle = "#91e1c1"; ctx.fillRect(-4, -25, 3, 3);
    } else if (npc.id === "tansy") {
      ctx.fillStyle = "#b8684d"; ctx.beginPath(); ctx.arc(0, -20, 12, Math.PI, 0); ctx.fill(); ctx.fillStyle = "#ddba83"; ctx.beginPath(); ctx.arc(0, -21, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#d07a52"; ctx.fillRect(-15, -4, 30, 15); ctx.fillStyle = "#f0dfb2"; ctx.fillRect(-9, -5, 18, 18); ctx.fillStyle = "#bd684d"; ctx.fillRect(-13, -5, 26, 4); ctx.fillStyle = "#7e4d3d"; ctx.fillRect(8, -18, 3, 3);
    } else if (npc.id === "brindle") {
      ctx.fillStyle = "#4d8d87"; ctx.beginPath(); ctx.ellipse(0, 1, 16, 17, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#d7ad76"; ctx.beginPath(); ctx.arc(0, -18, 10, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#324d4e"; ctx.fillRect(-14, -27, 28, 5); ctx.fillRect(-7, -31, 14, 5); ctx.fillStyle = "#e3c57e"; ctx.fillRect(-14, 4, 8, 5); ctx.fillRect(6, 4, 8, 5); ctx.fillStyle = "#233f3d"; ctx.fillRect(-5, -19, 3, 3);
    } else {
      ctx.fillStyle = "#765c8e"; ctx.beginPath(); ctx.moveTo(-15, 10); ctx.lineTo(-11, -13); ctx.lineTo(0, -17); ctx.lineTo(12, -13); ctx.lineTo(16, 10); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#e0bd89"; ctx.beginPath(); ctx.arc(0, -23, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#2e2e4a"; ctx.fillRect(-11, -29, 22, 5); ctx.fillStyle = "#d7c99a"; ctx.fillRect(9, -1, 8, 10); ctx.strokeStyle = "#e8d6a3"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -23, 12, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
    if (npc.near && state.mode === "playing" && !state.dialogue) { const lift = Math.sin(time * 4 + npc.phase) * 2; ctx.save(); ctx.globalAlpha = .95; ctx.fillStyle = "rgba(7,20,18,.9)"; ctx.strokeStyle = "rgba(214,255,220,.45)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x - 17, y - 69 + lift, 34, 22, 8); ctx.fill(); ctx.stroke(); ctx.fillStyle = COLORS.gold; ctx.font = "700 11px DM Mono"; ctx.textAlign = "center"; ctx.fillText("E", x, y - 54 + lift); ctx.fillStyle = "rgba(243,246,223,.82)"; ctx.font = "500 9px Outfit"; ctx.fillText(npc.name, x, y - 76 + lift); ctx.restore(); }
  };
  const drawEntrance = (x, y, time) => { ctx.fillStyle = "#342d3e"; ctx.beginPath(); ctx.arc(x, y, 50, Math.PI, 0); ctx.lineTo(x + 50, y + 50); ctx.lineTo(x - 50, y + 50); ctx.closePath(); ctx.fill(); ctx.fillStyle = `rgba(95,238,206,${.28 + Math.sin(time * 2) * .08})`; ctx.beginPath(); ctx.arc(x, y + 6, 32, Math.PI, 0); ctx.lineTo(x + 32, y + 45); ctx.lineTo(x - 32, y + 45); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "#8ef2cf"; ctx.lineWidth = 2; ctx.stroke(); };

  const drawDungeon = (time) => {
    ctx.fillStyle = COLORS.dungeon; ctx.fillRect(0, 0, ROOM.width, ROOM.height); ctx.fillStyle = "rgba(170,220,192,.05)"; for (let y = 40; y < ROOM.height - 35; y += 40) for (let x = 40; x < ROOM.width - 35; x += 40) ctx.fillRect(x, y, 1, ROOM.height - 75);
    const key = `${state.roomX}-${state.roomY}`; ctx.fillStyle = COLORS.dungeonLight; dungeonObstacles().forEach((wall) => ctx.fillRect(wall.x, wall.y, wall.w, wall.h));
    ctx.strokeStyle = "rgba(196,249,205,.17)"; ctx.lineWidth = 2; ctx.strokeRect(35, 35, ROOM.width - 70, ROOM.height - 70);
    for (let x = 100; x < ROOM.width - 100; x += 140) drawTorch(x, 68, time);
    if (key === "0-0") { drawChest(600, 390, state.chestOpened); drawRune(600, 160, "KEY"); }
    if (key === "1-0") { drawSwitch(600, 380, state.switches, time); drawRune(600, 150, "MOON"); }
    if (key === "0-1") { drawWater({ x: 430, y: 280, w: 340, h: 220 }, time); drawChest(600, 390, state.heartChestOpened); drawRune(600, 150, "HEART"); }
    if (key === "1-1") { ctx.fillStyle = "rgba(255,136,95,.16)"; ctx.fillRect(410, 240, 380, 260); drawRune(600, 370, "LOCK"); }
    if (key === "2-0") drawRune(600, 140, state.miniBossDefeated ? "OPEN" : "WARDEN");
    if (key === "2-1") { drawRune(600, 130, state.bossDefeated ? "HEARTSEED" : "SANCTUM"); if (state.bossDefeated) drawReward(600, 230, time); }
    drawDungeonDoors(time);
  };
  const drawTorch = (x, y, time) => { ctx.fillStyle = "#6d4934"; ctx.fillRect(x - 4, y, 8, 30); const glow = ctx.createRadialGradient(x, y, 2, x, y, 75); glow.addColorStop(0, "rgba(255,214,123,.45)"); glow.addColorStop(1, "rgba(255,214,123,0)"); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, 75, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = COLORS.gold; ctx.beginPath(); ctx.arc(x, y - 6 + Math.sin(time * 8 + x) * 2, 7, 0, Math.PI * 2); ctx.fill(); };
  const drawRune = (x, y, label) => { ctx.fillStyle = "rgba(142,242,207,.07)"; ctx.beginPath(); ctx.arc(x, y, 42, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "rgba(142,242,207,.34)"; ctx.stroke(); ctx.fillStyle = "rgba(214,255,220,.45)"; ctx.font = "10px DM Mono"; ctx.textAlign = "center"; ctx.fillText(label, x, y + 4); };
  const drawSwitch = (x, y, active, time) => { ctx.fillStyle = active ? "#8ef2cf" : "#546b64"; ctx.beginPath(); ctx.arc(x, y, 25 + Math.sin(time * 4) * 2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = active ? "#f6fff1" : "#243b37"; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill(); };
  const drawDungeonDoors = (time) => { [[ROOM.width / 2, 35, 70, 20],[ROOM.width / 2, ROOM.height - 35, 70, 20],[35, ROOM.height / 2, 20, 70],[ROOM.width - 35, ROOM.height / 2, 20, 70]].forEach(([x,y,w,h]) => { ctx.fillStyle = `rgba(142,242,207,${.12 + Math.sin(time * 3 + x) * .04})`; ctx.fillRect(x - w / 2, y - h / 2, w, h); }); };
  const drawReward = (x, y, time) => { const glow = ctx.createRadialGradient(x, y, 2, x, y, 90); glow.addColorStop(0, "rgba(255,215,123,.5)"); glow.addColorStop(1, "rgba(255,215,123,0)"); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, 90, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = COLORS.gold; ctx.beginPath(); ctx.arc(x, y + Math.sin(time * 3) * 5, 18, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#fff8c7"; ctx.beginPath(); ctx.arc(x - 5, y - 5, 6, 0, Math.PI * 2); ctx.fill(); };

  const drawEnemy = (enemy, time) => {
    if (enemy.dead) return;
    if (enemy.hidden) { ctx.save(); ctx.globalAlpha = .16 + Math.sin(time * 2 + enemy.orbit) * .04; drawShadow(enemy.x, enemy.y + 9, 15, 5, .35); ctx.fillStyle = "#8e76a5"; ctx.beginPath(); ctx.ellipse(enemy.x, enemy.y, 8, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); return; }
    const recoil = enemy.hitStun > 0 ? Math.sin(enemy.hitStun * 44) * 2 : 0;
    drawShadow(enemy.x, enemy.y + enemy.radius * .7, enemy.radius * (enemy.hitStun > 0 ? 1.04 : .9), enemy.radius * .3, .36);
    ctx.save(); if (enemy.hitFlash > 0) ctx.globalAlpha = .55 + Math.sin(enemy.hitFlash * 35) * .45;
    const color = enemy.color;
    if (enemy.type === "boss") { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(enemy.x + recoil, enemy.y, enemy.radius + Math.sin(time * 5) * 2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#512d58"; ctx.beginPath(); ctx.arc(enemy.x + recoil, enemy.y - 6, enemy.radius * .6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = COLORS.gold; ctx.fillRect(enemy.x - 13 + recoil, enemy.y - 11, 8, 5); ctx.fillRect(enemy.x + 5 + recoil, enemy.y - 11, 8, 5); }
    else if (enemy.type === "warden") { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(enemy.x + recoil, enemy.y - 30); ctx.lineTo(enemy.x + 25 + recoil, enemy.y + 22); ctx.lineTo(enemy.x - 25 + recoil, enemy.y + 22); ctx.closePath(); ctx.fill(); ctx.fillStyle = COLORS.gold; ctx.beginPath(); ctx.arc(enemy.x + recoil, enemy.y - 3, 8, 0, Math.PI * 2); ctx.fill(); }
    else if (enemy.type === "thornback") { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(enemy.x + recoil, enemy.y, enemy.radius + 4, enemy.radius - 2, -.08, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#7d543d"; for (let i = -1; i <= 1; i += 1) { ctx.beginPath(); ctx.moveTo(enemy.x + recoil + i * 9, enemy.y - 10); ctx.lineTo(enemy.x + recoil + i * 9 + 5, enemy.y - 22); ctx.lineTo(enemy.x + recoil + i * 9 + 10, enemy.y - 8); ctx.closePath(); ctx.fill(); } ctx.fillStyle = "#2c4135"; ctx.beginPath(); ctx.arc(enemy.x + recoil + 7, enemy.y - 2, 3, 0, Math.PI * 2); ctx.fill(); }
    else if (enemy.type === "moth") { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(enemy.x + recoil - 8, enemy.y - 3, 11, 7, -.45, 0, Math.PI * 2); ctx.ellipse(enemy.x + recoil + 8, enemy.y - 3, 11, 7, .45, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#583b62"; ctx.beginPath(); ctx.ellipse(enemy.x + recoil, enemy.y + 2, 4, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#ffe7a2"; ctx.beginPath(); ctx.arc(enemy.x + recoil - 2, enemy.y - 1, 2, 0, Math.PI * 2); ctx.arc(enemy.x + recoil + 2, enemy.y - 1, 2, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(enemy.x + recoil, enemy.y, enemy.radius, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#17362e"; ctx.beginPath(); ctx.arc(enemy.x - 5 + recoil, enemy.y - 2, 3, 0, Math.PI * 2); ctx.arc(enemy.x + 5 + recoil, enemy.y - 2, 3, 0, Math.PI * 2); ctx.fill(); if (enemy.type === "wisp") { ctx.strokeStyle = "rgba(220,207,255,.6)"; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = "rgba(235,220,255,.28)"; ctx.beginPath(); ctx.arc(enemy.x + recoil, enemy.y, enemy.radius + 7 + Math.sin(time * 5) * 2, 0, Math.PI * 2); ctx.fill(); } }
    ctx.restore();
    if (enemy.hitStun > 0) { ctx.save(); ctx.globalAlpha = clamp(enemy.hitStun * 5, 0, .85); ctx.strokeStyle = "#fff7dc"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(enemy.x, enemy.y, enemy.radius + 5 + Math.sin(time * 30) * 2, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    if (enemy.telegraph > 0) {
      const progress = clamp(enemy.telegraph / (enemy.stateTimer || enemy.telegraph), 0, 1); ctx.save(); ctx.globalAlpha = .3 + progress * .5; ctx.lineWidth = 3;
      if (enemy.telegraphType === "chargeWindup") { ctx.strokeStyle = "#ffb875"; ctx.beginPath(); ctx.arc(enemy.x, enemy.y, enemy.radius + 9 + Math.sin(time * 15) * 2, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = "rgba(255,195,125,.75)"; ctx.beginPath(); ctx.moveTo(enemy.x, enemy.y); ctx.lineTo(enemy.x + enemy.chargeX * 110, enemy.y + enemy.chargeY * 110); ctx.stroke(); }
      else if (enemy.telegraphType === "rangedWindup" || enemy.telegraphType === "bossWindup") { ctx.strokeStyle = enemy.telegraphType === "bossWindup" ? "#ff9a9d" : "#d9c8ff"; ctx.beginPath(); ctx.moveTo(enemy.x, enemy.y); ctx.lineTo(enemy.x + (enemy.aimX || player.x - enemy.x), enemy.y + (enemy.aimY || player.y - enemy.y)); ctx.stroke(); ctx.beginPath(); ctx.arc(enemy.x, enemy.y, enemy.radius + 9 + Math.sin(time * 12) * 2, 0, Math.PI * 2); ctx.stroke(); }
      else { ctx.strokeStyle = enemy.type === "moth" ? "#efb7dc" : "#fff0bb"; ctx.beginPath(); ctx.arc(enemy.x, enemy.y, enemy.radius + 8 + (1 - progress) * 15, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    }
    if (enemy.type === "warden" || enemy.type === "boss") { ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 14, enemy.radius * 2, 4); ctx.fillStyle = enemy.color; ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 14, enemy.radius * 2 * (enemy.hp / enemy.maxHp), 4); }
  };
  const drawDrop = (drop, time) => { const bob = Math.sin(time * 4 + drop.bob) * 4; ctx.save(); ctx.translate(drop.x, drop.y + bob); ctx.globalAlpha = clamp(drop.life / 2, .35, 1); const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 22); glow.addColorStop(0, `${drop.color}88`); glow.addColorStop(1, `${drop.color}00`); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = drop.color; ctx.rotate(time * 1.8 + drop.phase); ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(7, 0); ctx.lineTo(0, 8); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fill(); ctx.restore(); };
  const drawProjectile = (projectile) => { ctx.save(); ctx.globalAlpha = .95; ctx.fillStyle = projectile.color; ctx.shadowColor = projectile.color; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(projectile.x, projectile.y, projectile.radius + 3, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); };
  const drawAttackTrail = () => {
    if (player.attack <= 0) return;
    const progress = clamp(player.attackElapsed / .34, 0, 1); const angle = Math.atan2(player.attackDirectionY, player.attackDirectionX);
    ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(angle); ctx.lineCap = "round";
    const start = -1.02 + progress * .22; const end = -.92 + progress * 1.92; const fade = clamp((player.attack < .12 ? player.attack / .12 : 1), 0, 1);
    ctx.globalAlpha = .16 + fade * .42; ctx.strokeStyle = "#fff5d2"; ctx.lineWidth = 15; ctx.beginPath(); ctx.arc(20, 0, 37, start, end); ctx.stroke();
    ctx.globalAlpha = .95 * fade; ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(20, 0, 37, start, end); ctx.stroke();
    ctx.globalAlpha = .92 * fade; ctx.strokeStyle = "#fff9dd"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(20, 0, 37, start, end); ctx.stroke();
    ctx.restore();
  };
  const drawParticle = (particle) => {
    const alpha = clamp(particle.life / particle.maxLife, 0, 1); const progress = 1 - alpha;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(particle.x, particle.y);
    if (particle.kind === "ring") { ctx.strokeStyle = particle.color; ctx.lineWidth = 3 * alpha; ctx.beginPath(); ctx.arc(0, 0, particle.size * (.45 + progress * .9), 0, Math.PI * 2); ctx.stroke(); }
    else if (particle.kind === "dust") { ctx.fillStyle = particle.color; ctx.scale(1 + progress * .55, .65); ctx.beginPath(); ctx.ellipse(0, 0, particle.size, particle.size * .55, 0, 0, Math.PI * 2); ctx.fill(); }
    else if (particle.kind === "leaf") { ctx.rotate(particle.rotation + progress * 2); ctx.fillStyle = particle.color; ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * .62); }
    else if (particle.kind === "impact") { ctx.rotate(particle.rotation); ctx.fillStyle = particle.color; ctx.beginPath(); ctx.moveTo(0, -particle.size); ctx.lineTo(particle.size * .28, 0); ctx.lineTo(0, particle.size); ctx.lineTo(-particle.size * .28, 0); ctx.closePath(); ctx.fill(); }
    else { ctx.fillStyle = particle.color; ctx.beginPath(); ctx.arc(0, 0, particle.size * (.45 + alpha * .45), 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  };
  const drawPlayer = (time) => {
    const flicker = player.invulnerable > 0 && Math.floor(player.invulnerable * 24) % 2 === 0; if (flicker && player.dash <= 0) ctx.globalAlpha = .48;
    const bob = player.visualState === "move" ? Math.sin(player.walk) * 2 : player.visualState === "idle" ? Math.sin(time * 2.2) * .7 : 0;
    const lean = player.visualState === "hurt" ? -.12 : player.visualState === "attack" ? .08 : 0;
    drawShadow(player.x, player.y + 16, player.visualState === "dash" ? 25 : 19, player.visualState === "dash" ? 5 : 7, .36);
    ctx.save(); ctx.translate(player.x, player.y + bob); ctx.rotate(lean); if (player.visualState === "dash") ctx.rotate(Math.atan2(player.dashDirectionY, player.dashDirectionX) - Math.PI / 2);
    const scale = player.visualState === "dash" ? 1.12 : player.visualState === "hurt" ? .94 : 1; ctx.scale(scale, player.visualState === "dash" ? .72 : 1);
    ctx.fillStyle = player.visualState === "dash" ? "#89d8c7" : "#3d6780"; ctx.beginPath(); ctx.ellipse(0, 1, 15, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.player; ctx.beginPath(); ctx.arc(0, -14, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#4a302c"; ctx.beginPath(); ctx.arc(0, -19, 11, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#d8f0c6"; ctx.fillRect(-13, 1, 26, 4);
    ctx.fillStyle = "rgba(255,255,255,.38)"; ctx.fillRect(-7, -22, 3, 3);
    if (player.visualState === "dash") { ctx.strokeStyle = "rgba(182,255,225,.8)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 1, 21, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore(); ctx.globalAlpha = 1; drawAttackTrail();
  };

  const draw = (time) => {
    ctx.clearRect(0, 0, WIDTH, HEIGHT); ctx.save(); ctx.translate(-camera.x + camera.shakeX, -camera.y + camera.shakeY);
    if (state.area === "overworld") drawOverworld(time); else drawDungeon(time);
    leaves.forEach((leaf) => { if (state.area === "overworld" && leaf.x > camera.x - 10 && leaf.x < camera.x + WIDTH + 10 && leaf.y > camera.y - 10 && leaf.y < camera.y + HEIGHT + 10) { ctx.fillStyle = "rgba(213,246,174,.55)"; ctx.fillRect(leaf.x, leaf.y, 3, 7); } });
    const entities = [...enemies].sort((a, b) => a.y - b.y); entities.forEach((enemy) => drawEnemy(enemy, time)); drops.forEach((drop) => drawDrop(drop, time)); projectiles.forEach((projectile) => drawProjectile(projectile));
    drawPlayer(time); if (state.area === "overworld") drawOutdoorForeground(time); particles.forEach(drawParticle); ctx.restore();
    const light = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 80, WIDTH / 2, HEIGHT / 2, 480); light.addColorStop(0, "rgba(0,0,0,0)"); light.addColorStop(1, state.area === "dungeon" ? "rgba(2,8,8,.38)" : "rgba(4,13,9,.2)"); ctx.fillStyle = light; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (state.impactFlash > 0) { ctx.fillStyle = `rgba(255,246,210,${state.impactFlash * 1.8})`; ctx.fillRect(0, 0, WIDTH, HEIGHT); }
  };

  const updateObjective = () => { if (state.area === "overworld") { if (!state.rowanClue) { ui.objective.textContent = "Find Rowan at the outpost"; ui.objectiveCopy.textContent = "The blue moths gather where the old path breaks."; } else if (!state.southPassageOpen) { ui.objective.textContent = "Search the low pond"; ui.objectiveCopy.textContent = "Three pale stones point toward a curtain of ivy. Steel can open what a path cannot."; } else if (!state.hiddenChestOpened) { ui.objective.textContent = "Reach the hidden grove"; ui.objectiveCopy.textContent = state.optionalGuardDefeated ? "The thornback is gone. Something old glints beneath the lantern leaves." : "A slow thornback guards the lantern leaves. Watch its warning ring."; } else { ui.objective.textContent = "Enter the Hollow Shrine"; ui.objectiveCopy.textContent = "The lantern seed warms your palm. A blue seam glows behind the old outpost."; } } else { const key = `${state.roomX}-${state.roomY}`; if (key === "0-0") { ui.objective.textContent = state.key ? "Reach the Moon Switch Hall" : "Search the Root Gallery"; ui.objectiveCopy.textContent = state.key ? "The brass key hums when you face east." : "A forgotten chest waits beneath the shrine glyph."; } else if (key === "1-0") { ui.objective.textContent = state.switches ? "Find the Warden's Garden" : "Wake the moon switch"; ui.objectiveCopy.textContent = state.switches ? "The lower gate is open." : "Stand near the silver disk and press E."; } else if (key === "2-0") { ui.objective.textContent = state.miniBossDefeated ? "Descend to the Sanctum" : "Defeat the Root Warden"; ui.objectiveCopy.textContent = "Its bark armor cracks after every clean sword hit."; } else if (key === "2-1") { ui.objective.textContent = state.bossDefeated ? "Claim the Heartseed" : "Silence the Hollow Guardian"; ui.objectiveCopy.textContent = "The guardian changes its rhythm when its light turns rose."; } else { ui.objective.textContent = "Explore the shrine"; ui.objectiveCopy.textContent = "Every room remembers a different season."; } } };
  const updateHud = () => { ui.area.textContent = state.area === "overworld" ? "Lanternwood" : "Hollow Shrine"; ui.room.textContent = state.area === "overworld" ? "Outpost field" : dungeonRoomName(); ui.seed.textContent = state.reward ? "1" : "0"; ui.keys.textContent = state.key ? "1" : "0"; ui.loot.textContent = state.loot || "0"; if (ui.discovery) ui.discovery.textContent = `${state.discoveries || 0}/${state.discoveryTotal || 3}`; ui.save.textContent = state.mode === "playing" ? "Autosaved" : state.mode === "title" ? "Not started" : "Paused"; ui.hearts.innerHTML = ""; for (let i = 0; i < player.maxHp; i += 1) { const heart = document.createElement("i"); heart.className = "heart" + (i < player.hp ? "" : " empty"); ui.hearts.appendChild(heart); } ui.map.innerHTML = ""; ["0-0","1-0","2-0","0-1","1-1","2-1"].forEach((key) => { const dot = document.createElement("i"); dot.className = (state.roomVisited[`dungeon-${key}`] ? "done " : "") + (state.area === "dungeon" && `${state.roomX}-${state.roomY}` === key ? "active" : ""); ui.map.appendChild(dot); }); updateObjective(); };
  const updateDialogueSpeedLabel = () => { if (!ui.dialogueSpeed) return; const speed = state.dialogueSpeed || 52; ui.dialogueSpeed.textContent = `Text: ${speed >= 100 ? "fast" : speed <= 36 ? "slow" : "normal"}`; };
  const showVictory = () => { state.mode = "victory"; hideScreens(); ui.victory.classList.remove("hidden"); updateHud(); };

  const startGame = (continueGame) => { hideScreens(); if (continueGame && loadData()) { state.mode = "playing"; } else { state.mode = "playing"; state.area = "overworld"; state.roomX = 0; state.roomY = 0; state.roomVisited = { overworld: true }; state.key = false; state.switches = false; state.miniBossDefeated = false; state.bossDefeated = false; state.reward = false; state.secretFound = false; state.chestOpened = false; state.heartChestOpened = false; state.loot = 0; state.rowanClue = false; state.rowanRewarded = false; state.southPassageOpen = false; state.reedCacheFound = false; state.hiddenChestOpened = false; state.optionalGuardDefeated = false; state.lanternLens = false; state.lanternSeed = false; state.discoveries = 0; player.maxHp = 6; player.hp = player.maxHp; startArea("overworld"); saveData(); } canvas.focus(); updateHud(); };

  document.getElementById("new-game").addEventListener("click", () => startGame(false));
  document.getElementById("continue-game").addEventListener("click", () => startGame(true));
  document.getElementById("resume-game").addEventListener("click", () => { state.mode = "playing"; hideScreens(); canvas.focus(); });
  document.getElementById("victory-close").addEventListener("click", () => { state.mode = "playing"; hideScreens(); canvas.focus(); updateHud(); });
  document.getElementById("reset-save").addEventListener("click", () => { if (window.confirm("Erase your Mosswake save?")) resetProgress(); });
  ui.dialogueSpeed.addEventListener("click", () => { const speeds = [36, 52, 110]; const current = speeds.indexOf(state.dialogueSpeed); state.dialogueSpeed = speeds[(current + 1 + speeds.length) % speeds.length]; updateDialogueSpeedLabel(); saveData(); });
  window.addEventListener("keydown", (event) => { const key = event.key.toLowerCase(); if (["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d","j","k","e","p","enter"," "].includes(key)) event.preventDefault(); if (!keys.has(key)) justPressed.add(key); keys.add(key); if (key === "e" || key === "enter") interact(); if (key === "p") { if (state.mode === "playing") { state.mode = "paused"; ui.pause.classList.remove("hidden"); } else if (state.mode === "paused") { state.mode = "playing"; ui.pause.classList.add("hidden"); } updateHud(); } });
  window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener("blur", () => { keys.clear(); if (state.mode === "playing") { state.mode = "paused"; ui.pause.classList.remove("hidden"); updateHud(); } });

  const frame = (timestamp) => { const dt = Math.min(.05, (timestamp - lastFrame) / 1000 || 0); lastFrame = timestamp; update(dt); draw(timestamp / 1000); window.requestAnimationFrame(frame); };
  updateDialogueSpeedLabel(); updateHud(); if (!hasSave()) document.getElementById("continue-game").disabled = true; else document.getElementById("continue-game").disabled = false; window.requestAnimationFrame(frame);
})();
