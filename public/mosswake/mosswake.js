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
    moss: "#83d27d", wisp: "#b8a6ff", warden: "#d78b70", boss: "#b95a90", gold: "#ffd77b", player: "#e9c08c"
  };
  const keys = new Set();
  const justPressed = new Set();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rand = (min, max) => min + Math.random() * (max - min);
  const makeId = (prefix) => prefix + Math.random().toString(36).slice(2, 8);

  const player = { x: 390, y: 500, radius: 14, hp: 6, maxHp: 6, facingX: 1, facingY: 0, attack: 0, attackCooldown: 0, dash: 0, dashCooldown: 0, invulnerable: 0, hurt: 0, walk: 0 };
  const state = {
    mode: "title", area: "overworld", roomX: 0, roomY: 0, roomVisited: { overworld: true }, key: false, switches: false,
    miniBossDefeated: false, bossDefeated: false, reward: false, secretFound: false, chestOpened: false, heartChestOpened: false,
    lastSave: 0, toastTimer: 0, dialogue: null, transitionCooldown: 0
  };
  let enemies = [];
  let projectiles = [];
  let particles = [];
  let leaves = Array.from({ length: 65 }, () => ({ x: rand(0, WORLD.width), y: rand(0, WORLD.height), speed: rand(5, 16), phase: rand(0, 6.28) }));
  let camera = { x: 0, y: 0 };
  let lastFrame = 0;

  const ui = {
    title: document.getElementById("title-screen"), pause: document.getElementById("pause-screen"), victory: document.getElementById("victory-screen"),
    dialogue: document.getElementById("dialogue"), speaker: document.getElementById("dialogue-speaker"), dialogueText: document.getElementById("dialogue-text"),
    toast: document.getElementById("toast"), area: document.getElementById("area-label"), room: document.getElementById("room-label"), objective: document.getElementById("objective"),
    objectiveCopy: document.getElementById("objective-copy"), hearts: document.getElementById("hearts"), seed: document.getElementById("seed-count"), keys: document.getElementById("key-count"), save: document.getElementById("save-state"), map: document.getElementById("map-dots")
  };

  const showToast = (message, duration = 2200) => { ui.toast.textContent = message; ui.toast.classList.add("visible"); state.toastTimer = duration; };
  const hideScreens = () => [ui.title, ui.pause, ui.victory].forEach((screen) => screen.classList.add("hidden"));
  const setDialogue = (speaker, text) => { state.dialogue = { speaker, text }; ui.speaker.textContent = speaker; ui.dialogueText.textContent = text; ui.dialogue.classList.add("visible"); };
  const closeDialogue = () => { state.dialogue = null; ui.dialogue.classList.remove("visible"); };
  const saveData = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, mode: "playing", hp: player.hp, area: state.area, roomX: state.roomX, roomY: state.roomY }));
    state.lastSave = 0;
  };
  const hasSave = () => Boolean(localStorage.getItem(STORAGE_KEY));
  const loadData = () => {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!data) return false;
      Object.assign(state, data, { mode: "playing", dialogue: null, toastTimer: 0 });
      player.maxHp = state.heartChestOpened ? 7 : 6;
      player.hp = clamp(Number(data.hp) || player.maxHp, 1, player.maxHp);
      if (state.area === "dungeon") { player.x = ROOM.width / 2; player.y = ROOM.height - 100; } else { player.x = 390; player.y = 500; }
      startArea(state.area, false);
      return true;
    } catch (error) { localStorage.removeItem(STORAGE_KEY); return false; }
  };

  const resetProgress = () => {
    localStorage.removeItem(STORAGE_KEY);
    state.area = "overworld"; state.roomX = 0; state.roomY = 0; state.roomVisited = { overworld: true }; state.key = false; state.switches = false; state.miniBossDefeated = false; state.bossDefeated = false; state.reward = false; state.secretFound = false; state.chestOpened = false; state.heartChestOpened = false;
    player.hp = player.maxHp; player.x = 390; player.y = 500; startArea("overworld", false); state.mode = "title"; hideScreens(); ui.title.classList.remove("hidden"); updateHud();
  };

  const spawnParticle = (x, y, color, count = 5, speed = 75) => {
    for (let i = 0; i < count; i += 1) particles.push({ x, y, vx: rand(-speed, speed), vy: rand(-speed, speed), life: rand(.25, .65), maxLife: .65, size: rand(2, 5), color });
  };
  const spawnLeaves = (x, y, count = 8) => { for (let i = 0; i < count; i += 1) particles.push({ x, y, vx: rand(-25, 25), vy: rand(-45, -10), life: rand(.45, .9), maxLife: .9, size: rand(3, 7), color: i % 2 ? "#b2e898" : "#ffd27a" }); };

  const spawnEnemy = (type, x, y) => {
    const config = {
      mossling: { hp: 2, maxHp: 2, speed: 45, radius: 14, color: COLORS.moss, damage: 1 },
      wisp: { hp: 2, maxHp: 2, speed: 30, radius: 13, color: COLORS.wisp, damage: 1 },
      warden: { hp: 9, maxHp: 9, speed: 22, radius: 25, color: COLORS.warden, damage: 2 },
      boss: { hp: 16, maxHp: 16, speed: 28, radius: 39, color: COLORS.boss, damage: 2 }
    }[type];
    enemies.push({ id: makeId(type), type, x, y, ...config, attackCooldown: rand(.2, 1), hitFlash: 0, phase: 1, dead: false, orbit: rand(0, 6.28) });
  };

  const startArea = (area, announce = true) => {
    state.area = area;
    enemies = []; projectiles = []; particles = [];
    if (area === "overworld") {
      player.x = 390; player.y = 500;
      spawnEnemy("mossling", 770, 500); spawnEnemy("mossling", 1120, 660); spawnEnemy("wisp", 1270, 300);
      if (announce) showToast("LAN TERNWOOD · the moths are listening");
    } else {
      player.x = ROOM.width / 2; player.y = ROOM.height - 90;
      spawnDungeonEnemies();
      if (announce) showToast(dungeonRoomName());
    }
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
    if (state.area === "dungeon" && state.roomX === 1 && state.roomY === 0 && !state.switches && next.y > ROOM.height - 90) return true;
    return false;
  };

  const tryMove = (dx, dy) => {
    const nextX = { ...player, x: player.x + dx }; const nextY = { ...player, y: player.y + dy };
    if (!collidesWorld(nextX)) player.x = clamp(nextX.x, player.radius, (state.area === "overworld" ? WORLD.width : ROOM.width) - player.radius);
    if (!collidesWorld(nextY)) player.y = clamp(nextY.y, player.radius, (state.area === "overworld" ? WORLD.height : ROOM.height) - player.radius);
  };

  const swordHitbox = () => ({ x: player.x + player.facingX * 30, y: player.y + player.facingY * 30, radius: 35 });
  const attack = () => {
    if (state.mode !== "playing" || state.dialogue || player.attackCooldown > 0 || player.dash > 0) return;
    player.attack = .22; player.attackCooldown = .34; spawnParticle(player.x + player.facingX * 20, player.y + player.facingY * 20, COLORS.gold, 4, 45);
    const hit = swordHitbox();
    enemies.forEach((enemy) => {
      if (enemy.dead || distance(hit, enemy) > hit.radius + enemy.radius) return;
      enemy.hp -= 1; enemy.hitFlash = .16; enemy.x += player.facingX * 18; enemy.y += player.facingY * 18; spawnParticle(enemy.x, enemy.y, enemy.color, 8, 95);
      if (enemy.hp <= 0) {
        enemy.dead = true; spawnLeaves(enemy.x, enemy.y, enemy.type === "boss" ? 30 : 8);
        if (enemy.type === "warden") { state.miniBossDefeated = true; showToast("The Warden yields · the sanctum opens"); saveData(); }
        if (enemy.type === "boss") { state.bossDefeated = true; state.reward = true; showVictory(); saveData(); }
      }
    });
    breakables().forEach((object) => {
      if (!object.broken && distance(hit, object) < 38) { object.broken = true; spawnLeaves(object.x, object.y, 12); if (object.secret) { state.secretFound = true; showToast("A hidden path opens beneath the ivy"); } }
    });
  };
  const dash = () => {
    if (state.mode !== "playing" || state.dialogue || player.dashCooldown > 0) return;
    player.dash = .18; player.dashCooldown = .8; player.invulnerable = .36; spawnParticle(player.x, player.y, COLORS.mint, 10, 60);
  };

  const hurtPlayer = (amount, source) => {
    if (player.invulnerable > 0 || player.hurt > 0 || state.mode !== "playing") return;
    player.hp = Math.max(0, player.hp - amount); player.hurt = .45; player.invulnerable = .7; const dx = player.x - source.x; const dy = player.y - source.y; const length = Math.hypot(dx, dy) || 1; tryMove((dx / length) * 32, (dy / length) * 32); spawnParticle(player.x, player.y, COLORS.rose, 12, 120); updateHud();
    if (player.hp <= 0) { state.mode = "dead"; hideScreens(); ui.title.classList.remove("hidden"); ui.title.querySelector(".screen-kicker").textContent = "THE LANTERN WENT OUT"; ui.title.querySelector("h2").textContent = "The roots took you"; ui.title.querySelector("p:not(.screen-kicker)").textContent = "Start again at the outpost. The shrine will still be waiting."; document.getElementById("new-game").textContent = "Restart"; document.getElementById("continue-game").classList.add("hidden"); }
  };

  const breakables = () => state.area === "overworld" ? [{ x: 1360, y: 740, broken: state.secretFound, secret: true }, { x: 1260, y: 760, broken: false }] : [];
  const interact = () => {
    if (state.mode !== "playing") return;
    if (state.dialogue) { closeDialogue(); return; }
    if (state.area === "overworld") {
      if (distance(player, { x: 460, y: 380 }) < 75) { setDialogue("Rowan, keeper of the outpost", "The moths are not leading you away, Warden. They are leading you under. Find the blue door in the roots."); state.secretFound = true; updateObjective(); return; }
      if (distance(player, { x: 1350, y: 235 }) < 120) { enterDungeon(); return; }
      if (distance(player, { x: 1240, y: 745 }) < 70 && !state.chestOpened) { state.chestOpened = true; state.key = true; spawnLeaves(1240, 745, 18); showToast("You found an old brass key"); saveData(); updateHud(); return; }
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

  const updateEnemies = (dt) => {
    enemies.forEach((enemy) => {
      if (enemy.dead) return;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt); enemy.attackCooldown -= dt;
      const dist = distance(enemy, player);
      if (enemy.type === "boss") {
        enemy.phase = enemy.hp <= enemy.maxHp / 2 ? 2 : 1; enemy.orbit += dt * (enemy.phase === 2 ? 1.6 : .8);
        if (dist > 180) { enemy.x += Math.cos(enemy.orbit) * enemy.speed * dt; enemy.y += Math.sin(enemy.orbit) * enemy.speed * dt; }
        if (enemy.attackCooldown <= 0) { enemy.attackCooldown = enemy.phase === 2 ? .8 : 1.25; for (let i = 0; i < (enemy.phase === 2 ? 5 : 3); i += 1) { const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x) + (i - 1) * .22; projectiles.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 115, vy: Math.sin(angle) * 115, life: 2, radius: 7, color: enemy.phase === 2 ? COLORS.rose : COLORS.gold }); } spawnParticle(enemy.x, enemy.y, enemy.phase === 2 ? COLORS.rose : COLORS.gold, 12, 70); }
      } else if (dist < 300 && dist > enemy.radius + player.radius + 4) {
        const dx = (player.x - enemy.x) / dist; const dy = (player.y - enemy.y) / dist; enemy.x += dx * enemy.speed * dt; enemy.y += dy * enemy.speed * dt;
      }
      if (dist < enemy.radius + player.radius + 9 && enemy.attackCooldown <= 0) { enemy.attackCooldown = enemy.type === "warden" ? 1.1 : .95; hurtPlayer(enemy.damage, enemy); }
    });
    enemies = enemies.filter((enemy) => !enemy.dead);
    projectiles = projectiles.filter((projectile) => { projectile.x += projectile.vx * dt; projectile.y += projectile.vy * dt; projectile.life -= dt; if (distance(projectile, player) < projectile.radius + player.radius) { hurtPlayer(1, projectile); return false; } return projectile.life > 0 && projectile.x > 0 && projectile.y > 0 && projectile.x < ROOM.width && projectile.y < ROOM.height; });
  };

  const updatePlayer = (dt) => {
    player.attack = Math.max(0, player.attack - dt); player.attackCooldown = Math.max(0, player.attackCooldown - dt); player.dashCooldown = Math.max(0, player.dashCooldown - dt); player.invulnerable = Math.max(0, player.invulnerable - dt); player.hurt = Math.max(0, player.hurt - dt); state.transitionCooldown = Math.max(0, state.transitionCooldown - dt);
    if (justPressed.has("j") || justPressed.has(" ")) attack(); if (justPressed.has("k")) dash();
    let dx = 0; let dy = 0; if (keys.has("a") || keys.has("arrowleft")) dx -= 1; if (keys.has("d") || keys.has("arrowright")) dx += 1; if (keys.has("w") || keys.has("arrowup")) dy -= 1; if (keys.has("s") || keys.has("arrowdown")) dy += 1;
    if (dx || dy) { const length = Math.hypot(dx, dy); dx /= length; dy /= length; player.facingX = dx; player.facingY = dy; player.walk += dt * 8; const speed = player.dash > 0 ? 390 : 145; tryMove(dx * speed * dt, dy * speed * dt); if (Math.random() < .12) particles.push({ x: player.x, y: player.y + 13, vx: rand(-8, 8), vy: rand(6, 18), life: .3, maxLife: .3, size: rand(2, 4), color: "#c9b88a" }); }
    if (player.dash > 0) { player.dash -= dt; tryMove(player.facingX * 390 * dt, player.facingY * 390 * dt); }
  };

  const update = (dt) => {
    if (state.toastTimer > 0) { state.toastTimer -= dt * 1000; if (state.toastTimer <= 0) ui.toast.classList.remove("visible"); }
    leaves.forEach((leaf) => { leaf.y += leaf.speed * dt; leaf.x += Math.sin(leaf.phase + leaf.y * .01) * dt * 3; if (leaf.y > WORLD.height + 20) leaf.y = -10; });
    particles = particles.filter((particle) => { particle.life -= dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 45 * dt; return particle.life > 0; });
    if (state.mode !== "playing" || state.dialogue) return;
    updatePlayer(dt); updateEnemies(dt);
    if (state.area === "dungeon" && state.transitionCooldown <= 0) {
      if (player.x < 42) transitionDungeon(-1, 0); else if (player.x > ROOM.width - 42) transitionDungeon(1, 0); else if (player.y < 42) transitionDungeon(0, -1); else if (player.y > ROOM.height - 42) transitionDungeon(0, 1);
    }
    state.lastSave += dt; if (state.lastSave > 8) saveData();
    updateCamera(dt);
    justPressed.clear(); updateHud();
  };

  const updateCamera = (dt) => { const maxX = (state.area === "overworld" ? WORLD.width : ROOM.width) - WIDTH; const maxY = (state.area === "overworld" ? WORLD.height : ROOM.height) - HEIGHT; const targetX = clamp(player.x - WIDTH / 2, 0, Math.max(0, maxX)); const targetY = clamp(player.y - HEIGHT / 2, 0, Math.max(0, maxY)); camera.x += (targetX - camera.x) * Math.min(1, dt * 5); camera.y += (targetY - camera.y) * Math.min(1, dt * 5); };

  const drawShadow = (x, y, rx, ry, alpha = .3) => { ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = "#06110d"; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); };
  const drawTree = (x, y, scale = 1) => { drawShadow(x, y + 48 * scale, 32 * scale, 11 * scale, .38); ctx.fillStyle = "#765036"; ctx.fillRect(x - 8 * scale, y + 9 * scale, 16 * scale, 48 * scale); ctx.fillStyle = "#9b6a43"; ctx.fillRect(x - 3 * scale, y + 10 * scale, 5 * scale, 43 * scale); [[-26,5,30],[20,3,34],[0,-22,42],[-2,28,37]].forEach(([ox, oy, radius], i) => { ctx.fillStyle = i % 2 ? "#4d9b62" : "#68b870"; ctx.beginPath(); ctx.arc(x + ox * scale, y + oy * scale, radius * scale, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "rgba(210,255,190,.16)"; ctx.beginPath(); ctx.arc(x + (ox - 8) * scale, y + (oy - 8) * scale, radius * .35 * scale, 0, Math.PI * 2); ctx.fill(); }); };
  const drawHouse = (x, y, w, h, color) => { drawShadow(x + w / 2, y + h + 12, w * .5, 13, .3); ctx.fillStyle = color; ctx.fillRect(x, y + 30, w, h - 30); ctx.fillStyle = "#b97b58"; ctx.beginPath(); ctx.moveTo(x - 20, y + 32); ctx.lineTo(x + w / 2, y - 45); ctx.lineTo(x + w + 20, y + 32); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#e9d39c"; ctx.fillRect(x + 25, y + 70, 35, 42); ctx.fillStyle = "#6e4838"; ctx.fillRect(x + w / 2 - 20, y + h - 85, 40, 85); };
  const drawWater = (rect, time) => { ctx.fillStyle = COLORS.water; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); ctx.strokeStyle = "rgba(140,239,209,.28)"; ctx.lineWidth = 2; for (let y = rect.y + 18; y < rect.y + rect.h; y += 28) { ctx.beginPath(); for (let x = rect.x; x < rect.x + rect.w; x += 24) { ctx.lineTo(x + 12, y + Math.sin(time * 2 + x * .03) * 3); ctx.lineTo(x + 24, y); } ctx.stroke(); } };

  const drawOverworld = (time) => {
    ctx.fillStyle = COLORS.grass; ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.globalAlpha = .16; ctx.fillStyle = COLORS.grassLight; for (let y = 0; y < WORLD.height; y += 32) for (let x = 0; x < WORLD.width; x += 32) { if ((x / 32 + y / 32) % 3 === 0) ctx.fillRect(x + 6, y + 12, 2, 7); } ctx.globalAlpha = 1;
    ctx.fillStyle = COLORS.path; ctx.beginPath(); ctx.moveTo(0, 470); ctx.quadraticCurveTo(430, 410, 760, 500); ctx.quadraticCurveTo(1100, 560, 1600, 420); ctx.lineTo(1600, 500); ctx.quadraticCurveTo(1100, 640, 760, 555); ctx.quadraticCurveTo(430, 465, 0, 535); ctx.closePath(); ctx.fill();
    drawWater({ x: 610, y: 650, w: 360, h: 150 }, time); drawWater({ x: 1080, y: 510, w: 260, h: 90 }, time + 1);
    drawHouse(800, 90, 300, 165, "#d5c99e"); drawHouse(1140, 100, 190, 135, "#9fb88b");
    ctx.fillStyle = "#6c4d3a"; ctx.fillRect(1280, 180, 64, 64); ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 4; ctx.strokeRect(1280, 180, 64, 64); ctx.fillStyle = "rgba(130,241,215,.42)"; ctx.fillRect(1290,190,44,44);
    [[120,100,1.2],[480,180,.9],[700,350,1.1],[1450,160,1.25],[1480,650,.9],[220,780,1.1]].forEach(([x,y,s]) => drawTree(x,y,s));
    [[540,420],[1040,370],[1450,520],[100,680],[1210,690]].forEach(([x,y]) => { ctx.fillStyle = "#73826c"; ctx.beginPath(); ctx.ellipse(x,y,22,12,-.2,0,Math.PI*2); ctx.fill(); ctx.fillStyle = "#9dad87"; ctx.beginPath(); ctx.ellipse(x-5,y-4,13,7,-.2,0,Math.PI*2); ctx.fill(); });
    if (!state.chestOpened) drawChest(1240, 745, false); else drawChest(1240, 745, true);
    drawNpc(460, 380); drawEntrance(1312, 210, time);
    if (!state.secretFound) breakables().forEach((object) => { if (!object.broken) { ctx.fillStyle = "#5c8e56"; ctx.beginPath(); ctx.arc(object.x, object.y, 18, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#a5d977"; ctx.beginPath(); ctx.arc(object.x - 8, object.y - 7, 6, 0, Math.PI * 2); ctx.fill(); } });
  };
  const drawChest = (x, y, open) => { drawShadow(x, y + 14, 25, 7, .35); ctx.fillStyle = open ? "#5c483b" : "#a87845"; ctx.fillRect(x - 22, y - 9, 44, 25); ctx.fillStyle = open ? "#775e50" : "#d2a65b"; ctx.beginPath(); ctx.arc(x, y - 7, 22, Math.PI, 0); ctx.fill(); ctx.fillStyle = COLORS.gold; ctx.fillRect(x - 3, y + 1, 6, 8); };
  const drawNpc = (x, y) => { drawShadow(x, y + 18, 18, 7, .32); ctx.fillStyle = "#475f81"; ctx.beginPath(); ctx.arc(x, y - 12, 13, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#d7a77b"; ctx.beginPath(); ctx.arc(x, y - 28, 10, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = COLORS.gold; ctx.fillRect(x - 11, y - 5, 22, 6); };
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

  const drawEnemy = (enemy, time) => { if (enemy.dead) return; drawShadow(enemy.x, enemy.y + enemy.radius * .7, enemy.radius * .9, enemy.radius * .3, .36); ctx.save(); if (enemy.hitFlash > 0) ctx.globalAlpha = .55 + Math.sin(enemy.hitFlash * 35) * .45; const color = enemy.color; if (enemy.type === "boss") { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(enemy.x, enemy.y, enemy.radius + Math.sin(time * 5) * 2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#512d58"; ctx.beginPath(); ctx.arc(enemy.x, enemy.y - 6, enemy.radius * .6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = COLORS.gold; ctx.fillRect(enemy.x - 13, enemy.y - 11, 8, 5); ctx.fillRect(enemy.x + 5, enemy.y - 11, 8, 5); } else if (enemy.type === "warden") { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(enemy.x, enemy.y - 30); ctx.lineTo(enemy.x + 25, enemy.y + 22); ctx.lineTo(enemy.x - 25, enemy.y + 22); ctx.closePath(); ctx.fill(); ctx.fillStyle = COLORS.gold; ctx.beginPath(); ctx.arc(enemy.x, enemy.y - 3, 8, 0, Math.PI * 2); ctx.fill(); } else { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#17362e"; ctx.beginPath(); ctx.arc(enemy.x - 5, enemy.y - 2, 3, 0, Math.PI * 2); ctx.arc(enemy.x + 5, enemy.y - 2, 3, 0, Math.PI * 2); ctx.fill(); if (enemy.type === "wisp") { ctx.strokeStyle = "rgba(220,207,255,.6)"; ctx.lineWidth = 3; ctx.stroke(); } } ctx.restore(); if (enemy.type === "warden" || enemy.type === "boss") { ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 14, enemy.radius * 2, 4); ctx.fillStyle = enemy.color; ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 14, enemy.radius * 2 * (enemy.hp / enemy.maxHp), 4); } };
  const drawPlayer = (time) => { if (player.invulnerable > 0 && Math.floor(player.invulnerable * 22) % 2 === 0) return; drawShadow(player.x, player.y + 14, 19, 7, .36); const bob = Math.sin(player.walk) * (player.walk ? 2 : 0); ctx.fillStyle = "#3d6780"; ctx.beginPath(); ctx.arc(player.x, player.y + bob, 15, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = COLORS.player; ctx.beginPath(); ctx.arc(player.x, player.y - 14 + bob, 10, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#4a302c"; ctx.beginPath(); ctx.arc(player.x, player.y - 19 + bob, 11, Math.PI, 0); ctx.fill(); ctx.fillStyle = "#d8f0c6"; ctx.fillRect(player.x - 13, player.y + 1 + bob, 26, 4); if (player.attack > 0) { ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(Math.atan2(player.facingY, player.facingX)); ctx.strokeStyle = "#fff5d2"; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(22, 0, 29, -.9, .9); ctx.stroke(); ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(22, 0, 29, -.9, .9); ctx.stroke(); ctx.restore(); } };

  const draw = (time) => {
    ctx.clearRect(0, 0, WIDTH, HEIGHT); ctx.save(); ctx.translate(-camera.x, -camera.y); if (state.area === "overworld") drawOverworld(time); else drawDungeon(time); leaves.forEach((leaf) => { if (state.area === "overworld" && leaf.x > camera.x - 10 && leaf.x < camera.x + WIDTH + 10 && leaf.y > camera.y - 10 && leaf.y < camera.y + HEIGHT + 10) { ctx.fillStyle = "rgba(213,246,174,.55)"; ctx.fillRect(leaf.x, leaf.y, 3, 7); } }); const entities = [...enemies].sort((a, b) => a.y - b.y); entities.forEach((enemy) => drawEnemy(enemy, time)); projectiles.forEach((projectile) => { ctx.fillStyle = projectile.color; ctx.beginPath(); ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2); ctx.fill(); }); drawPlayer(time); particles.forEach((particle) => { ctx.save(); ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1); ctx.fillStyle = particle.color; ctx.fillRect(particle.x, particle.y, particle.size, particle.size); ctx.restore(); }); ctx.restore(); const light = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 80, WIDTH / 2, HEIGHT / 2, 480); light.addColorStop(0, "rgba(0,0,0,0)"); light.addColorStop(1, state.area === "dungeon" ? "rgba(2,8,8,.38)" : "rgba(4,13,9,.2)"); ctx.fillStyle = light; ctx.fillRect(0, 0, WIDTH, HEIGHT); };

  const updateObjective = () => { if (state.area === "overworld") { ui.objective.textContent = state.secretFound ? "Enter the Hollow Shrine" : "Find Rowan at the outpost"; ui.objectiveCopy.textContent = state.secretFound ? "A blue seam glows behind the old outpost." : "The blue moths gather where the old path breaks."; } else { const key = `${state.roomX}-${state.roomY}`; if (key === "0-0") { ui.objective.textContent = state.key ? "Reach the Moon Switch Hall" : "Search the Root Gallery"; ui.objectiveCopy.textContent = state.key ? "The brass key hums when you face east." : "A forgotten chest waits beneath the shrine glyph."; } else if (key === "1-0") { ui.objective.textContent = state.switches ? "Find the Warden's Garden" : "Wake the moon switch"; ui.objectiveCopy.textContent = state.switches ? "The lower gate is open." : "Stand near the silver disk and press E."; } else if (key === "2-0") { ui.objective.textContent = state.miniBossDefeated ? "Descend to the Sanctum" : "Defeat the Root Warden"; ui.objectiveCopy.textContent = "Its bark armor cracks after every clean sword hit."; } else if (key === "2-1") { ui.objective.textContent = state.bossDefeated ? "Claim the Heartseed" : "Silence the Hollow Guardian"; ui.objectiveCopy.textContent = "The guardian changes its rhythm when its light turns rose."; } else { ui.objective.textContent = "Explore the shrine"; ui.objectiveCopy.textContent = "Every room remembers a different season."; } } };
  const updateHud = () => { ui.area.textContent = state.area === "overworld" ? "Lanternwood" : "Hollow Shrine"; ui.room.textContent = state.area === "overworld" ? "Outpost field" : dungeonRoomName(); ui.seed.textContent = state.reward ? "1" : "0"; ui.keys.textContent = state.key ? "1" : "0"; ui.save.textContent = state.mode === "playing" ? "Autosaved" : state.mode === "title" ? "Not started" : "Paused"; ui.hearts.innerHTML = ""; for (let i = 0; i < player.maxHp; i += 1) { const heart = document.createElement("i"); heart.className = "heart" + (i < player.hp ? "" : " empty"); ui.hearts.appendChild(heart); } ui.map.innerHTML = ""; ["0-0","1-0","2-0","0-1","1-1","2-1"].forEach((key) => { const dot = document.createElement("i"); dot.className = (state.roomVisited[`dungeon-${key}`] ? "done " : "") + (state.area === "dungeon" && `${state.roomX}-${state.roomY}` === key ? "active" : ""); ui.map.appendChild(dot); }); updateObjective(); };
  const showVictory = () => { state.mode = "victory"; hideScreens(); ui.victory.classList.remove("hidden"); updateHud(); };

  const startGame = (continueGame) => { hideScreens(); if (continueGame && loadData()) { state.mode = "playing"; } else { state.mode = "playing"; state.area = "overworld"; state.roomX = 0; state.roomY = 0; state.roomVisited = { overworld: true }; state.key = false; state.switches = false; state.miniBossDefeated = false; state.bossDefeated = false; state.reward = false; state.secretFound = false; state.chestOpened = false; state.heartChestOpened = false; player.maxHp = 6; player.hp = player.maxHp; startArea("overworld"); saveData(); } canvas.focus(); updateHud(); };

  document.getElementById("new-game").addEventListener("click", () => startGame(false));
  document.getElementById("continue-game").addEventListener("click", () => startGame(true));
  document.getElementById("resume-game").addEventListener("click", () => { state.mode = "playing"; hideScreens(); canvas.focus(); });
  document.getElementById("victory-close").addEventListener("click", () => { state.mode = "playing"; hideScreens(); canvas.focus(); updateHud(); });
  document.getElementById("reset-save").addEventListener("click", () => { if (window.confirm("Erase your Mosswake save?")) resetProgress(); });
  window.addEventListener("keydown", (event) => { const key = event.key.toLowerCase(); if (["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d","j","k","e","p","enter"," "].includes(key)) event.preventDefault(); if (!keys.has(key)) justPressed.add(key); keys.add(key); if (key === "e" || key === "enter") interact(); if (key === "p") { if (state.mode === "playing") { state.mode = "paused"; ui.pause.classList.remove("hidden"); } else if (state.mode === "paused") { state.mode = "playing"; ui.pause.classList.add("hidden"); } updateHud(); } });
  window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener("blur", () => { keys.clear(); if (state.mode === "playing") { state.mode = "paused"; ui.pause.classList.remove("hidden"); updateHud(); } });

  const frame = (timestamp) => { const dt = Math.min(.05, (timestamp - lastFrame) / 1000 || 0); lastFrame = timestamp; update(dt); draw(timestamp / 1000); window.requestAnimationFrame(frame); };
  updateHud(); if (!hasSave()) document.getElementById("continue-game").disabled = true; else document.getElementById("continue-game").disabled = false; window.requestAnimationFrame(frame);
})();
