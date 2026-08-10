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
  const nextCanvases = [0, 1, 2].map((index) => document.getElementById("next-canvas" + (index ? "-" + index : "")));
  const holdCanvas = document.getElementById("hold-canvas");
  const scoreElement = document.getElementById("score");
  const linesElement = document.getElementById("lines");
  const levelElement = document.getElementById("level");
  const comboElement = document.getElementById("combo");
  const backToBackElement = document.getElementById("back-to-back");
  const statusText = document.getElementById("status-text");
  const statusElement = document.querySelector(".game-status");
  const overlay = document.getElementById("board-overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayCopy = document.getElementById("overlay-copy");
  const startButton = document.getElementById("start-button");
  const pauseButton = document.getElementById("pause-button");
  const holdButton = document.getElementById("hold-button");
  const music = document.getElementById("game-music");
  const musicButton = document.getElementById("music-button");

  let board = [];
  let current = null;
  let nextQueue = [];
  let holdType = null;
  let canHold = true;
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
  let fallTimer = 0;
  let lockTimer = 0;
  let lockResets = 0;
  let pendingClear = null;
  let pendingClearTimer = 0;
  let musicEnabled = true;
  let audioContext = null;
  let highScore = Number(localStorage.getItem("johnny-tetris-high-score") || 0);
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
    score += points;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    if (tSpin && cleared) statusText.textContent = "T-Spin " + (cleared === 1 ? "single" : cleared === 2 ? "double" : "triple") + "!";
    else if (cleared === 4) statusText.textContent = "Tetris! Beautiful.";
    else if (cleared) statusText.textContent = cleared + " line" + (cleared > 1 ? "s" : "") + " cleared";
    if (perfectClear && cleared) statusText.textContent = "Perfect clear!";
    if (combo > 0 && cleared) statusText.textContent += "  Combo x" + (combo + 1);
    updateStats();
    if (cleared) playTone(tSpin ? 620 : cleared === 4 ? 720 : 520, .16, "triangle", .035);
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
    const tSpin = detectTSpin();
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
    canHold = true;
    lockTimer = 0;
    lockResets = 0;
    if (rows.length) {
      pendingClear = { rows, tSpin };
      pendingClearTimer = CLEAR_ANIMATION;
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
    lockTimer = 0;
    lockResets = 0;
    if (collides(current)) endGame();
    updateMiniCanvases();
  };

  const hold = () => {
    if (!running || paused || gameOver || pendingClear || !canHold || !current) return;
    const previous = holdType;
    holdType = current.type;
    canHold = false;
    current = previous ? makePiece(previous) : null;
    if (!current) spawnNext();
    else {
      lockTimer = 0;
      lockResets = 0;
      if (collides(current)) endGame();
    }
    playTone(270, .06, "triangle", .016);
    updateMiniCanvases();
    draw();
  };

  const resetGame = () => {
    board = makeBoard();
    current = null;
    nextQueue = [];
    holdType = null;
    bag = [];
    canHold = true;
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
    gameOver = false;
    paused = false;
    fillQueue();
    spawnNext();
    updateStats();
    updateMiniCanvases();
  };

  const beginGame = () => {
    resetGame();
    running = true;
    paused = false;
    ensureAudio();
    overlay.classList.add("hidden");
    pauseButton.textContent = "Pause game";
    pauseButton.dataset.paused = "false";
    statusElement.dataset.state = "playing";
    statusText.textContent = "Stay in the flow";
    boardCanvas.focus();
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
    statusElement.dataset.state = "over";
    statusText.textContent = "The stack is full";
    playTone(80, .25, "sawtooth", .03);
    if (score > highScore) {
      highScore = score;
      localStorage.setItem("johnny-tetris-high-score", String(highScore));
    }
    setOverlay("Game over", "Score " + score.toLocaleString() + ". Your high score is " + highScore.toLocaleString() + ".", "Play again");
    draw();
  };

  const updateStats = () => {
    scoreElement.textContent = score.toLocaleString();
    linesElement.textContent = String(lines);
    levelElement.textContent = String(level);
    if (comboElement) comboElement.textContent = combo >= 0 ? "Combo x" + (combo + 1) : "Combo —";
    if (backToBackElement) backToBackElement.textContent = backToBack ? "B2B" : "";
  };

  const drawCell = (context, x, y, color, alpha = 1, size = CELL, offsetX = 0, offsetY = 0) => {
    context.save();
    context.globalAlpha = alpha;
    const left = offsetX + x * size;
    const top = offsetY + y * size;
    const gradient = context.createLinearGradient(left, top, left + size, top + size);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "#ffffff22");
    context.fillStyle = gradient;
    context.fillRect(left + 1, top + 1, size - 2, size - 2);
    context.fillStyle = "#ffffff55";
    context.fillRect(left + 4, top + 3, size - 8, 2);
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

  const draw = () => {
    boardContext.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
    boardContext.fillStyle = "#080d1d";
    boardContext.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
    boardContext.strokeStyle = "rgba(157, 180, 255, .08)";
    boardContext.lineWidth = 1;
    for (let x = 0; x <= COLS; x += 1) {
      boardContext.beginPath();
      boardContext.moveTo(x * CELL + .5, 0);
      boardContext.lineTo(x * CELL + .5, ROWS * CELL);
      boardContext.stroke();
    }
    for (let y = 0; y <= ROWS; y += 1) {
      boardContext.beginPath();
      boardContext.moveTo(0, y * CELL + .5);
      boardContext.lineTo(COLS * CELL, y * CELL + .5);
      boardContext.stroke();
    }
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (board[y][x]) drawCell(boardContext, x, y, COLORS[board[y][x]]);
      }
    }
    if (pendingClear && pendingClearTimer > 0) {
      const pulse = .22 + .25 * (1 - pendingClearTimer / CLEAR_ANIMATION);
      boardContext.fillStyle = "rgba(255,255,255," + pulse.toFixed(3) + ")";
      pendingClear.rows.forEach((row) => boardContext.fillRect(0, row * CELL, COLS * CELL, CELL));
    }
    if (current && running && !gameOver && !pendingClear) {
      const ghost = { ...current, matrix: cloneMatrix(current.matrix) };
      while (!collides(ghost, 0, 1)) ghost.y += 1;
      drawPiece(boardContext, ghost, .17);
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

  const updateMiniCanvases = () => {
    nextCanvases.forEach((canvas, index) => drawMiniPiece(canvas, nextQueue[index]));
    drawMiniPiece(holdCanvas, holdType);
    holdButton.disabled = !canHold;
    holdButton.style.opacity = canHold ? "1" : ".45";
  };

  const updateMusicButton = () => {
    const playing = musicEnabled && !music.paused;
    musicButton.dataset.playing = String(playing);
    musicButton.textContent = playing ? "Music: on" : (musicEnabled ? "Music: paused" : "Music: off");
    musicButton.setAttribute("aria-pressed", String(musicEnabled));
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
    if (name === "rotate") rotate();
    if (name === "down") softDrop();
    if (name === "drop") hardDrop();
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
    if (running && !paused && !gameOver) {
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
        const interval = Math.max(85, 780 - (level - 1) * 58);
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
      draw();
    }
    window.requestAnimationFrame(tick);
  };

  startButton.addEventListener("click", () => {
    if (paused) togglePause();
    else beginGame();
  });
  pauseButton.addEventListener("click", togglePause);
  holdButton.addEventListener("click", hold);
  musicButton.addEventListener("click", toggleMusic);
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => action(button.dataset.action));
  });
  window.addEventListener("keydown", (event) => {
    const key = event.key;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "c", "C", "p", "P"].includes(key)) event.preventDefault();
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
    if (key === "c" || key === "C") hold();
    if (key === "p" || key === "P") togglePause();
  });
  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowLeft") heldKeys.delete("left");
    if (event.key === "ArrowRight") heldKeys.delete("right");
    if (event.key === "ArrowDown") heldKeys.delete("down");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && running && !paused && !gameOver) togglePause();
  });
  window.addEventListener("pagehide", () => music.pause());
  music.addEventListener("play", updateMusicButton);
  music.addEventListener("pause", updateMusicButton);
  window.addEventListener("johnny:music-focus", updateMusicButton);

  resetGame();
  updateMusicButton();
  draw();
  window.requestAnimationFrame(tick);
})();
