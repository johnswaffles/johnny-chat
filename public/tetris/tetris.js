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
  const SHAPES = {
    I: [[1, 1, 1, 1]],
    J: [[1, 0, 0], [1, 1, 1]],
    L: [[0, 0, 1], [1, 1, 1]],
    O: [[1, 1], [1, 1]],
    S: [[0, 1, 1], [1, 1, 0]],
    T: [[0, 1, 0], [1, 1, 1]],
    Z: [[1, 1, 0], [0, 1, 1]]
  };
  const LINE_POINTS = [0, 100, 300, 500, 800];
  const boardCanvas = document.getElementById("board");
  const boardContext = boardCanvas.getContext("2d");
  const nextCanvas = document.getElementById("next-canvas");
  const holdCanvas = document.getElementById("hold-canvas");
  const scoreElement = document.getElementById("score");
  const linesElement = document.getElementById("lines");
  const levelElement = document.getElementById("level");
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
  let running = false;
  let paused = false;
  let gameOver = false;
  let lastFrame = 0;
  let fallTimer = 0;
  let musicEnabled = true;
  let highScore = Number(localStorage.getItem("johnny-tetris-high-score") || 0);

  const cloneMatrix = (matrix) => matrix.map((row) => row.slice());
  const makeBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null));

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

  const makePiece = (type) => {
    const matrix = cloneMatrix(SHAPES[type]);
    return {
      type,
      matrix,
      x: Math.floor((COLS - matrix[0].length) / 2),
      y: 0
    };
  };

  const collides = (piece, offsetX = 0, offsetY = 0, matrix = piece.matrix) => {
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

  const rotateMatrix = (matrix) => {
    const rotated = matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());
    return rotated;
  };

  const move = (direction) => {
    if (!running || paused || gameOver || !current) return false;
    if (!collides(current, direction, 0)) {
      current.x += direction;
      draw();
      return true;
    }
    return false;
  };

  const rotate = () => {
    if (!running || paused || gameOver || !current || current.type === "O") return;
    const rotated = rotateMatrix(current.matrix);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collides(current, kick, 0, rotated)) {
        current.x += kick;
        current.matrix = rotated;
        draw();
        return;
      }
    }
  };

  const softDrop = () => {
    if (!running || paused || gameOver || !current) return;
    if (!collides(current, 0, 1)) {
      current.y += 1;
      score += 1;
      updateStats();
      draw();
    } else {
      lockPiece();
    }
  };

  const hardDrop = () => {
    if (!running || paused || gameOver || !current) return;
    let distance = 0;
    while (!collides(current, 0, 1)) {
      current.y += 1;
      distance += 1;
    }
    score += distance * 2;
    lockPiece();
  };

  const clearLines = () => {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y -= 1) {
      if (board[y].every(Boolean)) {
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(null));
        cleared += 1;
        y += 1;
      }
    }
    return cleared;
  };

  const lockPiece = () => {
    if (!current) return;
    for (let y = 0; y < current.matrix.length; y += 1) {
      for (let x = 0; x < current.matrix[y].length; x += 1) {
        if (!current.matrix[y][x]) continue;
        const boardY = current.y + y;
        const boardX = current.x + x;
        if (boardY < 0) {
          endGame();
          return;
        }
        board[boardY][boardX] = current.type;
      }
    }
    const cleared = clearLines();
    if (cleared) {
      score += LINE_POINTS[cleared] * level;
      lines += cleared;
      level = Math.floor(lines / 10) + 1;
      statusText.textContent = cleared === 4 ? "Tetris! Beautiful." : cleared + " line" + (cleared > 1 ? "s" : "") + " cleared";
    }
    canHold = true;
    spawnNext();
    updateStats();
    draw();
  };

  const spawnNext = () => {
    fillQueue();
    current = makePiece(nextQueue.shift());
    fillQueue();
    fallTimer = 0;
    if (collides(current)) endGame();
  };

  const hold = () => {
    if (!running || paused || gameOver || !canHold) return;
    const previous = holdType;
    holdType = current.type;
    canHold = false;
    current = previous ? makePiece(previous) : null;
    if (!current) spawnNext();
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
    fallTimer = 0;
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
    statusElement.dataset.state = "over";
    statusText.textContent = "The stack is full";
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
        if (piece.matrix[y][x] && piece.y + y >= 0) {
          drawCell(context, piece.x + x, piece.y + y, COLORS[piece.type], alpha, size, offsetX, offsetY);
        }
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
    if (current && running && !gameOver) {
      const ghost = { ...current, matrix: cloneMatrix(current.matrix) };
      while (!collides(ghost, 0, 1)) ghost.y += 1;
      drawPiece(boardContext, ghost, .17);
      drawPiece(boardContext, current);
    }
  };

  const drawMiniPiece = (canvas, type) => {
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(255,255,255,.018)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (!type) return;
    const matrix = SHAPES[type];
    const size = 22;
    const offsetX = (canvas.width - matrix[0].length * size) / 2;
    const offsetY = (canvas.height - matrix.length * size) / 2;
    for (let y = 0; y < matrix.length; y += 1) {
      for (let x = 0; x < matrix[y].length; x += 1) {
        if (matrix[y][x]) drawCell(context, x, y, COLORS[type], 1, size, offsetX, offsetY);
      }
    }
  };

  const updateMiniCanvases = () => {
    drawMiniPiece(nextCanvas, nextQueue[0]);
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

  const tick = (timestamp) => {
    if (!lastFrame) lastFrame = timestamp;
    const elapsed = Math.min(100, timestamp - lastFrame);
    lastFrame = timestamp;
    if (running && !paused && !gameOver) {
      fallTimer += elapsed;
      const interval = Math.max(85, 780 - (level - 1) * 58);
      if (fallTimer >= interval) {
        fallTimer = 0;
        if (!collides(current, 0, 1)) current.y += 1;
        else lockPiece();
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
  holdButton.addEventListener("click", hold);
  musicButton.addEventListener("click", toggleMusic);
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => action(button.dataset.action));
  });
  window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "c", "C", "p", "P"].includes(event.key)) event.preventDefault();
    if (event.key === "ArrowLeft") move(-1);
    if (event.key === "ArrowRight") move(1);
    if (event.key === "ArrowUp") rotate();
    if (event.key === "ArrowDown") softDrop();
    if (event.key === " ") hardDrop();
    if (event.key === "c" || event.key === "C") hold();
    if (event.key === "p" || event.key === "P") togglePause();
  });
  music.addEventListener("play", updateMusicButton);
  music.addEventListener("pause", updateMusicButton);
  window.addEventListener("johnny:music-focus", updateMusicButton);

  resetGame();
  updateMusicButton();
  draw();
  window.requestAnimationFrame(tick);
})();
