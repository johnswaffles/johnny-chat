(() => {
  "use strict";

  const COLS = 10;
  const ROWS = 20;
  const CELL = 30;
  const TYPES = ["I", "J", "L", "O", "S", "T", "Z"];
  const COLORS = {
    I: "#69e7ff",
    J: "#7c91ff",
    L: "#ffac69",
    O: "#ffd65c",
    S: "#6ee6a2",
    T: "#c18cff",
    Z: "#ff73a8"
  };
  // Standard SRS spawn matrices make the rotation center predictable for every piece.
  const SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    O: [[1, 1], [1, 1]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]]
  };
  const LINE_POINTS = [0, 100, 300, 500, 800];
  const T_SPIN_POINTS = [400, 800, 1200, 1600];
  const LOCK_DELAY = 500;
  const MAX_LOCK_RESETS = 15;
  const CLEAR_ANIMATION = 220;
  const CLEAR_FEEDBACK_DURATION = 620;
  const IMPACT_FEEDBACK_DURATION = 150;
  const DAS_DELAY = 140;
  const ARR_INTERVAL = 45;
  const JLSTZ_KICKS = {
    "0>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    "1>0": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    "1>2": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    "2>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    "2>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    "3>2": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    "3>0": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    "0>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]
  };
  const I_KICKS = {
    "0>1": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    "1>0": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    "1>2": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
    "2>1": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    "2>3": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    "3>2": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    "3>0": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    "0>3": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]
  };

  const boardCanvas = document.getElementById("board");
  const boardContext = boardCanvas.getContext("2d");
  const nextCanvases = [document.getElementById("next-canvas")];
  const scoreElement = document.getElementById("score");
  const linesElement = document.getElementById("lines");
  const levelElement = document.getElementById("level");
  const comboElement = document.getElementById("combo");
  const backToBackElement = document.getElementById("back-to-back");
  const levelProgressBar = document.getElementById("level-progress-bar");
  const levelProgressCopy = document.getElementById("level-progress-copy");
  const levelProgressElement = document.querySelector(".level-progress");
  const statusText = document.getElementById("status-text");
  const statusElement = document.querySelector(".game-status");
  const overlay = document.getElementById("board-overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayCopy = document.getElementById("overlay-copy");
  const startButton = document.getElementById("start-button");
  const pauseButton = document.getElementById("pause-button");
  const secondChanceButton = document.getElementById("second-chance-button");
  const secondChanceCount = document.getElementById("second-chance-count");
  const secondChanceMeter = document.getElementById("second-chance-meter");
  const chanceCard = document.querySelector(".chance-card");
  const lineClearBadge = document.getElementById("line-clear-badge");
  const gameOverFlash = document.getElementById("game-over-flash");
  const boardWrap = document.querySelector(".board-wrap");
  const arcadeElement = document.querySelector(".arcade");
  const music = document.getElementById("game-music");
  const musicButton = document.getElementById("music-button");
  const speedControls = Array.from(document.querySelectorAll("[data-speed]"));
  const speedCaption = document.getElementById("speed-caption");
  const reactorState = document.getElementById("reactor-state");
  const reactorMeter = document.getElementById("reactor-meter");
  const reactorBar = document.getElementById("reactor-bar");
  const reactorChargeElement = document.getElementById("reactor-charge");
  const reactorBonus = document.getElementById("reactor-bonus");

  const SPEEDS = {
    slow: { multiplier: 1.55, caption: "Slow pace" },
    classic: { multiplier: 1, caption: "Classic pace" },
    fast: { multiplier: .62, caption: "Fast pace" },
    "really-fast": { multiplier: .22, caption: "Really fast · hard mode" }
  };
  const MAX_SECOND_CHANCES = 4;
  const MAX_REACTOR_CHARGE = 100;
  const OVERDRIVE_MOVES = 5;
  const REACTOR_GAIN = [0, 25, 50, 75, 100];

  let board = [];
  let current = null;
  let nextQueue = [];
  let bag = [];
  let score = 0;
  let lines = 0;
  let level = 1;
  let combo = -1;
  let backToBack = false;
  let running = false;
  let paused = false;
  let gameOver = false;
  let lastFrame = 0;
  let renderTimer = 0;
  let fallTimer = 0;
  let lockTimer = 0;
  let lockResets = 0;
  let pendingClear = null;
  let pendingClearTimer = 0;
  let lineClearFx = null;
  let gameOverFx = null;
  let impactFlashTimer = 0;
  let impactCells = [];
  let effectParticles = [];
  let musicEnabled = true;
  let speedMode = "classic";
  let audioContext = null;
  let highScore = Number(localStorage.getItem("johnny-tetris-high-score") || 0);
  let secondChances = MAX_SECOND_CHANCES;
  let moveStartSnapshot = null;
  let lastMoveSnapshot = null;
  let reactorCharge = 0;
  let overdriveMoves = 0;
  const heldKeys = new Map();


  const cloneMatrix = (matrix) => matrix.map((row) => row.slice());
  const makeBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  const rotateMatrix = (matrix) => matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());

  const shuffledBag = () => {
    const next = TYPES.slice();
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  };

  const takeType = () => {
    if (!bag.length) bag = shuffledBag();
    return bag.pop();
  };

  const fillQueue = () => {
    while (nextQueue.length < 5) nextQueue.push(takeType());
  };

  const cloneMoveSnapshot = (snapshot) => snapshot ? {
    board: snapshot.board.map((row) => row.slice()),
    nextQueue: snapshot.nextQueue.slice(),
    bag: snapshot.bag.slice(),
    score: snapshot.score,
    lines: snapshot.lines,
    level: snapshot.level,
    combo: snapshot.combo,
    backToBack: snapshot.backToBack,
    reactorCharge: snapshot.reactorCharge,
    overdriveMoves: snapshot.overdriveMoves
  } : null;

  const captureMoveStart = () => ({
    board: board.map((row) => row.slice()),
    nextQueue: nextQueue.slice(),
    bag: bag.slice(),
    score,
    lines,
    level,
    combo,
    backToBack,
    reactorCharge,
    overdriveMoves
  });

  const matrixFor = (type, rotation = 0) => {
    let matrix = cloneMatrix(SHAPES[type]);
    for (let index = 0; index < rotation; index += 1) matrix = rotateMatrix(matrix);
    return matrix;
  };

  const makePiece = (type) => {
    const matrix = matrixFor(type);
    return {
      type,
      matrix,
      rotation: 0,
      x: Math.floor((COLS - matrix[0].length) / 2),
      y: 0,
      lastAction: "spawn"
    };
  };

  const collides = (piece, offsetX = 0, offsetY = 0, matrix = piece.matrix) => {
    if (!piece) return true;
    for (let y = 0; y < matrix.length; y += 1) {
      for (let x = 0; x < matrix[y].length; x += 1) {
        if (!matrix[y][x]) continue;
        const boardX = piece.x + x + offsetX;
        const boardY = piece.y + y + offsetY;
        if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return true;
        if (boardY >= 0 && board[boardY][boardX]) return true;
      }
    }
    return false;
  };

  const ensureAudio = () => {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  };

  const playTone = (frequency, duration = .06, type = "sine", volume = .025) => {
    try {
      ensureAudio();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      // Sound effects are a nice-to-have; browsers can block Web Audio until a gesture.
    }
  };

  const lineClearLabel = (cleared) => ["", "SINGLE", "DOUBLE", "TRIPLE", "TETRIS!"][cleared] || "LINE CLEAR";

  const beginLineClearFeedback = (cleared, rows) => {
    lineClearFx = { timer: CLEAR_FEEDBACK_DURATION, total: CLEAR_FEEDBACK_DURATION };
    boardWrap.dataset.state = "clear";
    boardWrap.dataset.clearTier = String(cleared);
    if (arcadeElement) arcadeElement.dataset.clearTier = String(cleared);
    lineClearBadge.textContent = lineClearLabel(cleared);
    lineClearBadge.dataset.tier = String(cleared);
    lineClearBadge.dataset.visible = "true";
    rows.forEach((row) => {
      for (let x = 0; x < COLS; x += 1) {
        const color = COLORS[board[row][x]] || "#ffffff";
        for (let index = 0; index < 3; index += 1) {
          effectParticles.push({
            x: (x + .5) * CELL,
            y: (row + .5) * CELL,
            vx: (Math.random() - .5) * .28,
            vy: -.18 - Math.random() * .18,
            size: 2 + Math.random() * 4,
            color,
            life: 420 + Math.random() * 220,
            maxLife: 640
          });
        }
      }
    });
  };

  const beginLockFeedback = (piece) => {
    impactFlashTimer = IMPACT_FEEDBACK_DURATION;
    impactCells = [];
    for (let y = 0; y < piece.matrix.length; y += 1) {
      for (let x = 0; x < piece.matrix[y].length; x += 1) {
        if (piece.matrix[y][x] && piece.y + y >= 0) impactCells.push({ x: piece.x + x, y: piece.y + y });
      }
    }
  };

  const beginGameOverFeedback = () => {
    gameOverFx = { timer: 1700, total: 1700 };
    gameOverFlash.dataset.active = "true";
    boardWrap.dataset.state = "over";
    board.forEach((row, y) => row.forEach((type, x) => {
      if (!type || Math.random() > .42) return;
      effectParticles.push({
        x: (x + .5) * CELL,
        y: (y + .5) * CELL,
        vx: (Math.random() - .5) * .28,
        vy: -.2 - Math.random() * .16,
        size: 2 + Math.random() * 4,
        color: COLORS[type],
        life: 900 + Math.random() * 800,
        maxLife: 1700
      });
    }));
  };

  const advanceEffects = (elapsed) => {
    if (lineClearFx) {
      lineClearFx.timer -= elapsed;
      if (lineClearFx.timer <= 0) {
        lineClearFx = null;
        lineClearBadge.dataset.visible = "false";
        delete boardWrap.dataset.clearTier;
        if (arcadeElement) delete arcadeElement.dataset.clearTier;
        if (!gameOver) boardWrap.dataset.state = "playing";
      }
    }
    if (gameOverFx) {
      gameOverFx.timer -= elapsed;
      if (gameOverFx.timer <= 0) {
        gameOverFx = null;
        gameOverFlash.dataset.active = "false";
      }
    }
    impactFlashTimer = Math.max(0, impactFlashTimer - elapsed);
    effectParticles = effectParticles.filter((particle) => {
      particle.life -= elapsed;
      particle.x += particle.vx * elapsed;
      particle.y += particle.vy * elapsed;
      particle.vy += .00045 * elapsed;
      return particle.life > 0;
    });
  };

  const isGrounded = () => current && collides(current, 0, 1);

  const refreshLockAfterAction = (wasGrounded) => {
    if (wasGrounded && lockResets < MAX_LOCK_RESETS) {
      lockTimer = 0;
      lockResets += 1;
    }
  };

  const move = (direction, quiet = false) => {
    if (!running || paused || gameOver || pendingClear || !current) return false;
    const wasGrounded = isGrounded();
    if (!collides(current, direction, 0)) {
      current.x += direction;
      current.lastAction = "move";
      refreshLockAfterAction(wasGrounded);
      if (!quiet) playTone(150 + Math.abs(direction) * 20, .035, "square", .012);
      draw();
      return true;
    }
    return false;
  };

  const rotate = () => {
    if (!running || paused || gameOver || pendingClear || !current || current.type === "O") return false;
    const wasGrounded = isGrounded();
    const from = current.rotation;
    const to = (from + 1) % 4;
    const kickTable = current.type === "I" ? I_KICKS : JLSTZ_KICKS;
    const kicks = kickTable[from + ">" + to] || [[0, 0]];
    const rotated = matrixFor(current.type, to);
    for (const [kickX, kickY] of kicks) {
      // SRS defines positive Y as up; the canvas board grows downwards.
      if (!collides(current, kickX, -kickY, rotated)) {
        current.x += kickX;
        current.y -= kickY;
        current.rotation = to;
        current.matrix = rotated;
        current.lastAction = "rotate";
        refreshLockAfterAction(wasGrounded);
        playTone(410 + to * 35, .055, "triangle", .018);
        draw();
        return true;
      }
    }
    return false;
  };

  const softDrop = (quiet = false) => {
    if (!running || paused || gameOver || pendingClear || !current) return false;
    if (!collides(current, 0, 1)) {
      current.y += 1;
      current.lastAction = "drop";
      score += 1;
      updateStats();
      if (!quiet) playTone(195, .025, "square", .008);
      draw();
      return true;
    }
    return false;
  };

  const hardDrop = () => {
    if (!running || paused || gameOver || pendingClear || !current) return;
    let distance = 0;
    while (!collides(current, 0, 1)) {
      current.y += 1;
      distance += 1;
    }
    score += distance * 2;
    playTone(95, .075, "sawtooth", .025);
    lockPiece();
  };

  const findFullRows = () => board.reduce((rows, row, index) => {
    if (row.every(Boolean)) rows.push(index);
    return rows;
  }, []);

  const detectTSpin = () => {
    if (!current || current.type !== "T" || current.lastAction !== "rotate") return false;
    const pivotX = current.x + 1;
    const pivotY = current.y + 1;
    let occupied = 0;
    for (const [x, y] of [[pivotX - 1, pivotY - 1], [pivotX + 1, pivotY - 1], [pivotX - 1, pivotY + 1], [pivotX + 1, pivotY + 1]]) {
      if (x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x])) occupied += 1;
    }
    return occupied >= 3;
  };

  const applyScore = (cleared, tSpin, perfectClear) => {
    const overdriveWasActive = overdriveMoves > 0;
    const difficult = cleared === 4 || (tSpin && cleared > 0);
    let points = tSpin ? (T_SPIN_POINTS[cleared] || 0) * level : (LINE_POINTS[cleared] || 0) * level;
    if (cleared > 0) {
      combo += 1;
      if (combo > 0) points += combo * 50 * level;
      if (difficult) {
        if (backToBack) points += Math.floor(points * .5);
        backToBack = true;
      } else {
        backToBack = false;
      }
    } else {
      combo = -1;
    }
    if (perfectClear && cleared) points += 2000 * level;
    if (overdriveWasActive) points *= 2;
    score += points;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    if (tSpin && cleared) statusText.textContent = "T-Spin " + (cleared === 1 ? "single" : cleared === 2 ? "double" : "triple") + "!";
    else if (cleared === 4) statusText.textContent = "Tetris! Beautiful.";
    else if (cleared) statusText.textContent = cleared + " line" + (cleared > 1 ? "s" : "") + " cleared";
    if (perfectClear && cleared) statusText.textContent = "Perfect clear!";
    if (combo > 0 && cleared) statusText.textContent += "  Combo x" + (combo + 1);
    if (overdriveWasActive) {
      overdriveMoves = Math.max(0, overdriveMoves - 1);
      if (cleared) statusText.textContent += " · 2× OVERDRIVE";
      else statusText.textContent = overdriveMoves ? "Overdrive · " + overdriveMoves + " moves left" : "Overdrive complete · reactor cooling";
      if (!overdriveMoves) reactorCharge = 0;
    } else if (cleared) {
      reactorCharge = Math.min(MAX_REACTOR_CHARGE, reactorCharge + REACTOR_GAIN[cleared]);
      if (reactorCharge >= MAX_REACTOR_CHARGE) {
        overdriveMoves = OVERDRIVE_MOVES;
        statusText.textContent = "REACTOR ONLINE — 2× scoring for 5 moves";
        playTone(780, .18, "sawtooth", .026);
        window.setTimeout(() => playTone(1040, .22, "sine", .025), 100);
      }
    }
    updateStats();
    if (cleared) {
      playTone(tSpin ? 620 : cleared === 4 ? 720 : 520, .16, "triangle", .035);
      if (cleared > 1) window.setTimeout(() => playTone(cleared === 4 ? 940 : 760, .12, "sine", .024), 70);
    }
    if (perfectClear && cleared) playTone(880, .22, "sine", .03);
  };

  const finishLineClear = () => {
    if (!pendingClear) return;
    for (const row of pendingClear.rows.slice().sort((a, b) => b - a)) {
      board.splice(row, 1);
      board.unshift(Array(COLS).fill(null));
    }
    const cleared = pendingClear.rows.length;
    const tSpin = pendingClear.tSpin;
    pendingClear = null;
    pendingClearTimer = 0;
    const perfectClear = board.every((row) => row.every((cell) => !cell));
    applyScore(cleared, tSpin, perfectClear);
    spawnNext();
    draw();
  };

  const lockPiece = () => {
    if (!current || pendingClear) return;
    lastMoveSnapshot = cloneMoveSnapshot(moveStartSnapshot || captureMoveStart());
    updateSecondChanceUI();
    const tSpin = detectTSpin();
    beginLockFeedback(current);
    playTone(120, .045, "square", .01);
    for (let y = 0; y < current.matrix.length; y += 1) {
      for (let x = 0; x < current.matrix[y].length; x += 1) {
        if (!current.matrix[y][x]) continue;
        const boardY = current.y + y;
        const boardX = current.x + x;
        if (boardY < 0 || boardX < 0 || boardX >= COLS) {
          endGame();
          return;
        }
        board[boardY][boardX] = current.type;
      }
    }
    const rows = findFullRows();
    current = null;
    lockTimer = 0;
    lockResets = 0;
    if (rows.length) {
      pendingClear = { rows, tSpin };
      pendingClearTimer = CLEAR_ANIMATION;
      beginLineClearFeedback(rows.length, rows);
    } else {
      applyScore(0, tSpin, false);
      spawnNext();
    }
    updateMiniCanvases();
    draw();
  };

  const spawnNext = () => {
    fillQueue();
    current = makePiece(nextQueue.shift());
    fillQueue();
    fallTimer = 0;
    renderTimer = 0;
    lockTimer = 0;
    lockResets = 0;
    boardWrap.dataset.currentPiece = current.type;
    if (arcadeElement) arcadeElement.dataset.currentPiece = current.type;
    if (collides(current)) {
      endGame();
      updateMiniCanvases();
      return;
    }
    moveStartSnapshot = captureMoveStart();
    updateMiniCanvases();
  };

  const resetGame = () => {
    board = makeBoard();
    current = null;
    nextQueue = [];
    bag = [];
    score = 0;
    lines = 0;
    level = 1;
    combo = -1;
    backToBack = false;
    fallTimer = 0;
    lockTimer = 0;
    lockResets = 0;
    pendingClear = null;
    pendingClearTimer = 0;
    lineClearFx = null;
    impactFlashTimer = 0;
    impactCells = [];
    effectParticles = [];
    secondChances = MAX_SECOND_CHANCES;
    moveStartSnapshot = null;
    lastMoveSnapshot = null;
    reactorCharge = 0;
    overdriveMoves = 0;
    lineClearBadge.dataset.visible = "false";
    lineClearBadge.dataset.tier = "";
    lineClearBadge.textContent = "";
    gameOverFx = null;
    gameOverFlash.dataset.active = "false";
    boardWrap.dataset.state = "";
    delete boardWrap.dataset.clearTier;
    boardWrap.dataset.danger = "calm";
    if (arcadeElement) {
      delete arcadeElement.dataset.clearTier;
      arcadeElement.dataset.danger = "calm";
      arcadeElement.dataset.combo = "idle";
    }
    overlay.dataset.state = "";
    gameOver = false;
    paused = false;
    fillQueue();
    spawnNext();
    updateStats();
    updateMiniCanvases();
  };

  const beginGame = () => {
    resetGame();
    document.body.classList.add("game-active");
    running = true;
    paused = false;
    ensureAudio();
    boardWrap.dataset.state = "playing";
    gameOverFlash.dataset.active = "false";
    overlay.dataset.state = "";
    overlay.classList.add("hidden");
    pauseButton.textContent = "Pause game";
    pauseButton.dataset.paused = "false";
    statusElement.dataset.state = "playing";
    statusText.textContent = "Stay in the flow";
    window.scrollTo({ top: 0, behavior: "instant" });
    if (musicEnabled) {
      window.JohnnyAudioFocus?.claim("tetris");
      music.play().catch(() => {});
    }
    draw();
  };

  const setOverlay = (title, copy, buttonText) => {
    overlayTitle.textContent = title;
    overlayCopy.textContent = copy;
    startButton.textContent = buttonText;
    overlay.classList.remove("hidden");
  };

  const togglePause = () => {
    if (!running || gameOver) return;
    paused = !paused;
    heldKeys.clear();
    pauseButton.textContent = paused ? "Resume game" : "Pause game";
    pauseButton.dataset.paused = String(paused);
    statusElement.dataset.state = paused ? "paused" : "playing";
    statusText.textContent = paused ? "Paused — breathe" : "Stay in the flow";
    overlay.dataset.state = "";
    if (paused) setOverlay("Paused", "Your stack is safe. Resume when you are ready.", "Resume");
    else overlay.classList.add("hidden");
    draw();
  };

  const endGame = () => {
    running = false;
    gameOver = true;
    pendingClear = null;
    pendingClearTimer = 0;
    heldKeys.clear();
    beginGameOverFeedback();
    statusElement.dataset.state = "over";
    statusText.textContent = "GAME OVER — STACK LIMIT";
    playTone(80, .25, "sawtooth", .03);
    if (score > highScore) {
      highScore = score;
      localStorage.setItem("johnny-tetris-high-score", String(highScore));
    }
    overlay.dataset.state = "over";
    setOverlay("GAME OVER", "Stack limit breached. Score " + score.toLocaleString() + " · Best " + highScore.toLocaleString() + ".", "Run it back");
    draw();
  };

  const updateAtmosphere = () => {
    const topOccupiedRow = board.findIndex((row) => row.some(Boolean));
    const stackHeight = topOccupiedRow < 0 ? 0 : ROWS - topOccupiedRow;
    const danger = stackHeight >= 16 ? "critical" : stackHeight >= 11 ? "rising" : "calm";
    const levelHue = (188 + (level - 1) * 22) % 360;
    boardWrap.dataset.danger = danger;
    boardWrap.dataset.stackHeight = String(stackHeight);
    if (arcadeElement) {
      arcadeElement.dataset.danger = danger;
      arcadeElement.dataset.combo = combo > 0 ? "active" : "idle";
      arcadeElement.style.setProperty("--level-hue", String(levelHue));
      arcadeElement.style.setProperty("--stack-pressure", (stackHeight / ROWS).toFixed(2));
    }
  };

  const updateReactorUI = () => {
    const active = overdriveMoves > 0;
    const charge = active ? MAX_REACTOR_CHARGE : reactorCharge;
    if (reactorState) reactorState.textContent = active ? "OVERDRIVE" : "CHARGING";
    if (reactorMeter) reactorMeter.setAttribute("aria-valuenow", String(charge));
    if (reactorBar) reactorBar.style.width = charge + "%";
    if (reactorChargeElement) reactorChargeElement.textContent = active ? "2× SCORE" : charge + "%";
    if (reactorBonus) reactorBonus.textContent = active
      ? overdriveMoves + " move" + (overdriveMoves === 1 ? "" : "s") + " remaining"
      : charge ? "Energy stored" : "Clear lines to charge";
    if (arcadeElement) {
      arcadeElement.dataset.reactor = active ? "overdrive" : charge > 0 ? "charging" : "idle";
      arcadeElement.dataset.reactorCharge = String(charge);
      arcadeElement.dataset.overdriveMoves = String(overdriveMoves);
    }
  };

  const updateStats = () => {
    scoreElement.textContent = score.toLocaleString();
    linesElement.textContent = String(lines);
    levelElement.textContent = String(level);
    if (comboElement) comboElement.textContent = combo >= 0 ? "Combo x" + (combo + 1) : "Combo —";
    if (backToBackElement) backToBackElement.textContent = backToBack ? "B2B" : "";
    const levelLines = lines % 10;
    if (levelProgressBar) levelProgressBar.style.width = (levelLines * 10) + "%";
    if (levelProgressCopy) levelProgressCopy.textContent = levelLines + "/10 to level " + (level + 1);
    if (levelProgressElement) levelProgressElement.setAttribute("aria-valuenow", String(levelLines));
    updateReactorUI();
    updateAtmosphere();
  };

  const drawCell = (context, x, y, color, alpha = 1, size = CELL, offsetX = 0, offsetY = 0) => {
    context.save();
    context.globalAlpha = alpha;
    const left = offsetX + x * size;
    const top = offsetY + y * size;
    const inset = Math.max(1, size * .045);
    const tileLeft = left + inset;
    const tileTop = top + inset;
    const tileSize = size - inset * 2;
    const radius = Math.min(6, size * .16);
    const gradient = context.createLinearGradient(tileLeft, tileTop, tileLeft + tileSize, tileTop + tileSize);
    gradient.addColorStop(0, shiftColor(color, 38));
    gradient.addColorStop(.22, color);
    gradient.addColorStop(.72, shiftColor(color, -18));
    gradient.addColorStop(1, shiftColor(color, -52));
    const boardTile = size >= CELL;
    if (boardTile && alpha > .7) {
      context.shadowColor = rgba(color, .52);
      context.shadowBlur = Math.max(3, size * .2);
      context.shadowOffsetY = Math.max(1, size * .035);
    }
    context.fillStyle = gradient;
    roundedRectPath(context, tileLeft, tileTop, tileSize, tileSize, radius);
    context.fill();
    context.shadowColor = "transparent";
    context.shadowBlur = 0;
    // Glassy top-left bevel and a darker lower edge give each block a
    // physical, jewel-like face instead of a flat colored square.
    roundedRectPath(context, tileLeft + 1, tileTop + 1, tileSize - 2, Math.max(2, tileSize * .2), Math.max(2, radius - 1));
    context.fillStyle = "rgba(255,255,255,.28)";
    context.fill();
    context.beginPath();
    context.moveTo(tileLeft + tileSize * .08, tileTop + tileSize * .84);
    context.lineTo(tileLeft + tileSize * .92, tileTop + tileSize * .84);
    context.lineTo(tileLeft + tileSize * .84, tileTop + tileSize * .94);
    context.lineTo(tileLeft + tileSize * .14, tileTop + tileSize * .94);
    context.closePath();
    context.fillStyle = "rgba(0,0,0,.22)";
    context.fill();
    context.beginPath();
    context.moveTo(tileLeft + tileSize * .12, tileTop + tileSize * .13);
    context.lineTo(tileLeft + tileSize * .42, tileTop + tileSize * .13);
    context.lineTo(tileLeft + tileSize * .24, tileTop + tileSize * .34);
    context.closePath();
    context.fillStyle = "rgba(255,255,255,.48)";
    context.fill();
    roundedRectPath(context, tileLeft + .5, tileTop + .5, tileSize - 1, tileSize - 1, radius);
    context.strokeStyle = rgba(shiftColor(color, 65), .72);
    context.lineWidth = Math.max(1, size * .035);
    context.stroke();
    context.restore();
  };

  const drawGhostPiece = (context, piece) => {
    if (!piece) return;
    context.save();
    const color = COLORS[piece.type];
    context.globalAlpha = .5;
    context.strokeStyle = rgba(color, .95);
    context.shadowColor = rgba(color, .8);
    context.shadowBlur = 9;
    context.lineWidth = 2;
    context.setLineDash([4, 3]);
    for (let y = 0; y < piece.matrix.length; y += 1) {
      for (let x = 0; x < piece.matrix[y].length; x += 1) {
        if (!piece.matrix[y][x] || piece.y + y < 0) continue;
        roundedRectPath(context, piece.x * CELL + x * CELL + 5, piece.y * CELL + y * CELL + 5, CELL - 10, CELL - 10, 4);
        context.stroke();
      }
    }
    context.setLineDash([]);
    context.restore();
  };

  const drawPiece = (context, piece, alpha = 1, size = CELL, offsetX = 0, offsetY = 0) => {
    if (!piece) return;
    for (let y = 0; y < piece.matrix.length; y += 1) {
      for (let x = 0; x < piece.matrix[y].length; x += 1) {
        if (piece.matrix[y][x] && piece.y + y >= 0) drawCell(context, piece.x + x, piece.y + y, COLORS[piece.type], alpha, size, offsetX, offsetY);
      }
    }
  };

  // The board stays a crisp 2D canvas, but each tile gets a small material
  // system: a cool rim, a directional bevel and a soft colored bloom. This
  // is deliberately generated from the existing piece colors so it never
  // changes the game state or the palette used by the engine.
  const colorToRgb = (hex) => {
    if (hex.startsWith("rgb")) {
      const channels = hex.match(/\d+/g) || [0, 0, 0];
      return { r: Number(channels[0]), g: Number(channels[1]), b: Number(channels[2]) };
    }
    const value = hex.replace("#", "");
    const normalized = value.length === 3 ? value.split("").map((part) => part + part).join("") : value;
    const number = Number.parseInt(normalized, 16);
    return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 };
  };
  const rgba = (hex, alpha) => {
    const { r, g, b } = colorToRgb(hex);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  };
  const shiftColor = (hex, amount) => {
    const { r, g, b } = colorToRgb(hex);
    const channel = (value) => Math.max(0, Math.min(255, value + amount));
    return "rgb(" + channel(r) + "," + channel(g) + "," + channel(b) + ")";
  };
  const roundedRectPath = (context, left, top, width, height, radius) => {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(left + r, top);
    context.lineTo(left + width - r, top);
    context.quadraticCurveTo(left + width, top, left + width, top + r);
    context.lineTo(left + width, top + height - r);
    context.quadraticCurveTo(left + width, top + height, left + width - r, top + height);
    context.lineTo(left + r, top + height);
    context.quadraticCurveTo(left, top + height, left, top + height - r);
    context.lineTo(left, top + r);
    context.quadraticCurveTo(left, top, left + r, top);
    context.closePath();
  };

  const draw = () => {
    boardContext.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
    const boardGradient = boardContext.createLinearGradient(0, 0, 0, boardCanvas.height);
    boardGradient.addColorStop(0, "#111d3a");
    boardGradient.addColorStop(.28, "#0b1530");
    boardGradient.addColorStop(.62, "#080d1d");
    boardGradient.addColorStop(1, "#050812");
    boardContext.fillStyle = boardGradient;
    boardContext.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
    const boardFocus = boardContext.createRadialGradient(boardCanvas.width * .52, boardCanvas.height * .16, 8, boardCanvas.width * .52, boardCanvas.height * .16, boardCanvas.height * .78);
    boardFocus.addColorStop(0, "rgba(105,231,255,.12)");
    boardFocus.addColorStop(.34, "rgba(105,231,255,.025)");
    boardFocus.addColorStop(1, "rgba(105,231,255,0)");
    boardContext.fillStyle = boardFocus;
    boardContext.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
    boardContext.fillStyle = "rgba(105,231,255,.026)";
    for (let y = 0; y < ROWS; y += 2) boardContext.fillRect(0, y * CELL, boardCanvas.width, CELL);
    boardContext.strokeStyle = "rgba(157, 180, 255, .095)";
    boardContext.lineWidth = 1;
    for (let x = 0; x <= COLS; x += 1) {
      boardContext.beginPath();
      boardContext.moveTo(x * CELL + .5, 0);
      boardContext.lineTo(x * CELL + .5, ROWS * CELL);
      boardContext.stroke();
    }
    // A slow light sweep makes the cabinet feel powered-on while a game is
    // running. It is intentionally a single translucent pass over the grid.
    const sweepProgress = (performance.now() % 5200) / 5200;
    const sweepX = sweepProgress * (boardCanvas.width + 150) - 75;
    const boardSweep = boardContext.createLinearGradient(sweepX - 70, 0, sweepX + 70, 0);
    boardSweep.addColorStop(0, "rgba(105,231,255,0)");
    boardSweep.addColorStop(.5, "rgba(255,255,255,.06)");
    boardSweep.addColorStop(1, "rgba(178,140,255,0)");
    boardContext.fillStyle = boardSweep;
    boardContext.fillRect(sweepX - 70, 0, 140, boardCanvas.height);
    for (let y = 0; y <= ROWS; y += 1) {
      boardContext.beginPath();
      boardContext.moveTo(0, y * CELL + .5);
      boardContext.lineTo(COLS * CELL, y * CELL + .5);
      boardContext.stroke();
    }
    const vignette = boardContext.createRadialGradient(boardCanvas.width / 2, boardCanvas.height * .4, 80, boardCanvas.width / 2, boardCanvas.height / 2, boardCanvas.height * .72);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,.28)");
    boardContext.fillStyle = vignette;
    boardContext.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (board[y][x]) drawCell(boardContext, x, y, COLORS[board[y][x]]);
      }
    }
    if (pendingClear && pendingClearTimer > 0) {
      const pulse = .22 + .25 * (1 - pendingClearTimer / CLEAR_ANIMATION);
      boardContext.fillStyle = "rgba(255,255,255," + pulse.toFixed(3) + ")";
      pendingClear.rows.forEach((row) => boardContext.fillRect(0, row * CELL, COLS * CELL, CELL));
      const clearProgress = 1 - pendingClearTimer / CLEAR_ANIMATION;
      const sweepX = (clearProgress * 1.35 - .15) * boardCanvas.width;
      const sweep = boardContext.createLinearGradient(sweepX - 34, 0, sweepX + 34, 0);
      sweep.addColorStop(0, "rgba(255,255,255,0)");
      sweep.addColorStop(.5, "rgba(255,255,255,.8)");
      sweep.addColorStop(1, "rgba(105,231,255,0)");
      boardContext.fillStyle = sweep;
      pendingClear.rows.forEach((row) => boardContext.fillRect(sweepX - 34, row * CELL, 68, CELL));
    }
    if (impactFlashTimer > 0) {
      boardContext.save();
      boardContext.globalAlpha = impactFlashTimer / IMPACT_FEEDBACK_DURATION;
      boardContext.strokeStyle = "rgba(255,255,255,.8)";
      boardContext.lineWidth = 2;
      impactCells.forEach(({ x, y }) => boardContext.strokeRect(x * CELL + 3, y * CELL + 3, CELL - 6, CELL - 6));
      boardContext.restore();
    }
    effectParticles.forEach((particle) => {
      boardContext.save();
      boardContext.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      boardContext.globalCompositeOperation = "lighter";
      boardContext.fillStyle = particle.color;
      boardContext.shadowColor = particle.color;
      boardContext.shadowBlur = particle.size * 2.5;
      boardContext.beginPath();
      boardContext.arc(particle.x, particle.y, particle.size * .62, 0, Math.PI * 2);
      boardContext.fill();
      boardContext.restore();
    });
    if (gameOverFx) {
      const progress = 1 - gameOverFx.timer / gameOverFx.total;
      const sweepY = (progress * 1.3 - .15) * boardCanvas.height;
      boardContext.save();
      boardContext.fillStyle = "rgba(255,55,129," + Math.max(0, .16 * (1 - progress)).toFixed(3) + ")";
      boardContext.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
      boardContext.fillStyle = "rgba(255,210,235,.52)";
      boardContext.fillRect(0, sweepY, boardCanvas.width, 3);
      boardContext.fillStyle = "rgba(255,55,129,.2)";
      boardContext.fillRect(0, sweepY + 4, boardCanvas.width, 12);
      boardContext.restore();
    }
    if (current && running && !gameOver && !pendingClear) {
      const ghost = { ...current, matrix: cloneMatrix(current.matrix) };
      while (!collides(ghost, 0, 1)) ghost.y += 1;
      drawGhostPiece(boardContext, ghost);
      drawPiece(boardContext, current);
    }
  };

  const drawMiniPiece = (canvas, type) => {
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(255,255,255,.018)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (!type) return;
    const matrix = SHAPES[type];
    const size = Math.min(22, Math.floor(Math.min(canvas.width / (matrix[0].length + 1), canvas.height / (matrix.length + 1))));
    const offsetX = (canvas.width - matrix[0].length * size) / 2;
    const offsetY = (canvas.height - matrix.length * size) / 2;
    for (let y = 0; y < matrix.length; y += 1) {
      for (let x = 0; x < matrix[y].length; x += 1) {
        if (matrix[y][x]) drawCell(context, x, y, COLORS[type], 1, size, offsetX, offsetY);
      }
    }
  };

  const updateSecondChanceUI = () => {
    const canUse = secondChances > 0 && Boolean(lastMoveSnapshot) && (running || gameOver);
    if (secondChanceCount) secondChanceCount.textContent = secondChances + " left";
    if (secondChanceMeter) {
      secondChanceMeter.setAttribute("aria-valuenow", String(secondChances));
      Array.from(secondChanceMeter.children).forEach((pip, index) => {
        pip.dataset.active = String(index < secondChances);
      });
    }
    if (secondChanceButton) {
      secondChanceButton.disabled = !canUse;
      secondChanceButton.innerHTML = "<span>SECOND CHANCE</span>";
      secondChanceButton.dataset.ready = String(canUse);
      secondChanceButton.dataset.empty = String(secondChances <= 0);
    }
    if (chanceCard) chanceCard.dataset.ready = String(canUse);
    document.querySelectorAll('[data-action="second-chance"]').forEach((button) => {
      button.disabled = !canUse;
      button.setAttribute("aria-label", canUse ? "Use a second chance" : "Second chance unavailable");
    });
  };

  const useSecondChance = () => {
    if (!lastMoveSnapshot || secondChances <= 0 || (!running && !gameOver)) return;
    const snapshot = cloneMoveSnapshot(lastMoveSnapshot);
    secondChances -= 1;
    board = snapshot.board.map((row) => row.slice());
    nextQueue = snapshot.nextQueue.slice();
    bag = snapshot.bag.slice();
    score = snapshot.score;
    lines = snapshot.lines;
    level = snapshot.level;
    combo = snapshot.combo;
    backToBack = snapshot.backToBack;
    reactorCharge = snapshot.reactorCharge;
    overdriveMoves = snapshot.overdriveMoves;
    current = null;
    moveStartSnapshot = null;
    lastMoveSnapshot = null;
    pendingClear = null;
    pendingClearTimer = 0;
    lineClearFx = null;
    gameOverFx = null;
    impactFlashTimer = 0;
    impactCells = [];
    effectParticles = [];
    fallTimer = 0;
    lockTimer = 0;
    lockResets = 0;
    heldKeys.clear();
    running = true;
    paused = false;
    gameOver = false;
    document.body.classList.add("game-active");
    lineClearBadge.dataset.visible = "false";
    lineClearBadge.dataset.tier = "";
    lineClearBadge.textContent = "";
    gameOverFlash.dataset.active = "false";
    delete boardWrap.dataset.clearTier;
    boardWrap.dataset.state = "second-chance";
    if (arcadeElement) delete arcadeElement.dataset.clearTier;
    overlay.dataset.state = "";
    overlay.classList.add("hidden");
    pauseButton.textContent = "Pause game";
    pauseButton.dataset.paused = "false";
    statusElement.dataset.state = "playing";
    statusText.textContent = "Second chance — fresh move";
    updateStats();
    spawnNext();
    updateMiniCanvases();
    updateSecondChanceUI();
    if (chanceCard) {
      chanceCard.dataset.used = "true";
      window.setTimeout(() => { chanceCard.dataset.used = "false"; }, 720);
    }
    playTone(360, .09, "triangle", .025);
    window.setTimeout(() => playTone(620, .13, "sine", .022), 75);
    draw();
    window.setTimeout(() => {
      if (!gameOver && boardWrap.dataset.state === "second-chance") boardWrap.dataset.state = "playing";
    }, 720);
  };

  const updateMiniCanvases = () => {
    nextCanvases.forEach((canvas, index) => {
      const type = nextQueue[index];
      drawMiniPiece(canvas, type);
      if (!canvas) return;
      canvas.dataset.piece = type || "";
      canvas.setAttribute("aria-label", type ? "Next piece: " + type : "Next piece");
    });
    updateSecondChanceUI();
  };

  const updateMusicButton = () => {
    const playing = musicEnabled && !music.paused;
    musicButton.dataset.playing = String(playing);
    musicButton.textContent = playing ? "Music: on" : (musicEnabled ? "Music: paused" : "Music: off");
    musicButton.setAttribute("aria-pressed", String(musicEnabled));
  };

  const updateSpeedControls = () => {
    speedControls.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.speed === speedMode));
    });
    if (speedCaption) speedCaption.textContent = SPEEDS[speedMode].caption;
  };

  const setSpeed = (mode) => {
    if (!SPEEDS[mode]) return;
    speedMode = mode;
    updateSpeedControls();
  };

  const toggleMusic = () => {
    musicEnabled = !musicEnabled;
    if (musicEnabled) {
      ensureAudio();
      window.JohnnyAudioFocus?.claim("tetris");
      music.play().catch(() => {});
    } else {
      music.pause();
    }
    updateMusicButton();
  };

  const action = (name) => {
    if (name === "left") move(-1);
    if (name === "right") move(1);
    if (name === "rotate" || name === "up") rotate();
    if (name === "down") softDrop();
    if (name === "drop") hardDrop();
    if (name === "second-chance") useSecondChance();
  };

  const repeatAction = (key) => {
    if (key === "left") move(-1, true);
    if (key === "right") move(1, true);
    if (key === "down") softDrop(true);
  };

  const tick = (timestamp) => {
    if (!lastFrame) lastFrame = timestamp;
    const elapsed = Math.min(100, timestamp - lastFrame);
    lastFrame = timestamp;
    if (!paused) advanceEffects(elapsed);
    if (running && !paused && !gameOver) {
      renderTimer += elapsed;
      if (pendingClear) {
        pendingClearTimer -= elapsed;
        if (pendingClearTimer <= 0) finishLineClear();
      } else if (current) {
        ["left", "right", "down"].forEach((key) => {
          const held = heldKeys.get(key);
          if (!held) return;
          held.timer += elapsed;
          if (!held.started && held.timer >= DAS_DELAY) {
            held.timer -= DAS_DELAY;
            held.started = true;
            repeatAction(key);
          }
          if (held.started) {
            while (held.timer >= ARR_INTERVAL) {
              held.timer -= ARR_INTERVAL;
              repeatAction(key);
            }
          }
        });
        fallTimer += elapsed;
        const baseInterval = 780 - (level - 1) * 58;
        const interval = Math.max(42, baseInterval * SPEEDS[speedMode].multiplier);
        if (fallTimer >= interval) {
          fallTimer = 0;
          if (!collides(current, 0, 1)) {
            current.y += 1;
            current.lastAction = "gravity";
            lockTimer = 0;
          }
        }
        if (isGrounded()) {
          lockTimer += elapsed;
          if (lockTimer >= LOCK_DELAY) lockPiece();
        } else {
          lockTimer = 0;
        }
      }
      // The canvas renderer builds several gradients and glow passes per
      // tile. Rendering at 30fps keeps touch devices responsive without
      // changing the simulation's timing or piece movement.
      if (renderTimer >= 33) {
        renderTimer = 0;
        draw();
      }
    }
    window.requestAnimationFrame(tick);
  };

  startButton.addEventListener("click", () => {
    if (paused) togglePause();
    else beginGame();
  });
  pauseButton.addEventListener("click", togglePause);
  secondChanceButton.addEventListener("click", useSecondChance);
  musicButton.addEventListener("click", toggleMusic);
  speedControls.forEach((button) => button.addEventListener("click", () => setSpeed(button.dataset.speed)));
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => action(button.dataset.action));
  });
  window.addEventListener("keydown", (event) => {
    const key = event.key;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "p", "P"].includes(key)) event.preventDefault();
    if (key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowDown") {
      const name = key === "ArrowLeft" ? "left" : key === "ArrowRight" ? "right" : "down";
      if (!heldKeys.has(name)) {
        heldKeys.set(name, { timer: 0, started: false });
        repeatAction(name);
      }
      return;
    }
    if (event.repeat) return;
    if (key === "ArrowUp") rotate();
    if (key === " ") hardDrop();
    if (key === "p" || key === "P") togglePause();
  });
  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowLeft") heldKeys.delete("left");
    if (event.key === "ArrowRight") heldKeys.delete("right");
    if (event.key === "ArrowDown") heldKeys.delete("down");
  });
  const pauseWhenBackgrounded = () => {
    if (running && !paused && !gameOver) togglePause();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseWhenBackgrounded();
  });
  window.addEventListener("blur", pauseWhenBackgrounded);
  window.addEventListener("pagehide", () => music.pause());
  const preventViewportZoom = (event) => {
    if (document.body.classList.contains("game-active")) event.preventDefault();
  };
  document.addEventListener("gesturestart", preventViewportZoom, { passive: false });
  document.addEventListener("gesturechange", preventViewportZoom, { passive: false });
  document.addEventListener("gestureend", preventViewportZoom, { passive: false });
  document.addEventListener("touchmove", (event) => {
    if (document.body.classList.contains("game-active") && event.touches.length > 1) event.preventDefault();
  }, { passive: false });
  music.addEventListener("play", updateMusicButton);
  music.addEventListener("pause", updateMusicButton);
  window.addEventListener("johnny:music-focus", updateMusicButton);

  resetGame();
  updateMusicButton();
  updateSpeedControls();
  draw();
  window.requestAnimationFrame(tick);
})();
