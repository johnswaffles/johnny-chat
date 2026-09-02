(() => {
  "use strict";

  const gridElement = document.getElementById("word-grid");
  const wordListElement = document.getElementById("word-list");
  const newGameButton = document.getElementById("new-game");
  const difficultyButtons = [...document.querySelectorAll("[data-difficulty]")];
  const difficultyLabel = document.getElementById("difficulty-label");
  const difficultyCopy = document.getElementById("difficulty-copy");
  const foundCountElement = document.getElementById("found-count");
  const wordsLeftElement = document.getElementById("words-left");
  const timerElement = document.getElementById("timer");
  const streakElement = document.getElementById("streak");
  const statusText = document.getElementById("status-text");
  const boardHint = document.getElementById("board-hint");
  const puzzleCode = document.getElementById("puzzle-code");
  const celebration = document.getElementById("celebration");
  const celebrationKicker = document.getElementById("celebration-kicker");
  const celebrationWord = document.getElementById("celebration-word");
  const celebrationCopy = document.getElementById("celebration-copy");
  const celebrationSparks = document.getElementById("celebration-sparks");
  const music = document.getElementById("game-music");
  const musicButton = document.getElementById("music-button");
  const soundtrackSelect = document.getElementById("soundtrack-select");

  const DIFFICULTIES = {
    easy: { label: "Easy glow", copy: "A soft landing with clear paths.", size: 8, wordCount: 5, reverse: false, directionNames: ["across", "down"] },
    casual: { label: "Casual drift", copy: "A little more to notice, never too much.", size: 9, wordCount: 6, reverse: false, directionNames: ["across", "down", "diagonal"] },
    tricky: { label: "Tricky tide", copy: "Diagonals and backwards trails join the mix.", size: 11, wordCount: 8, reverse: true, directionNames: ["all directions"] },
    hard: { label: "Hard focus", copy: "A dense field for a serious search.", size: 13, wordCount: 10, reverse: true, directionNames: ["all directions"] }
  };
  const WORD_BANK = [
    "BREATHE", "BRIGHT", "CALM", "COZY", "DREAM", "EMBER", "FLOW", "FOCUS", "FRIEND", "GLOW",
    "HARMONY", "JOY", "LANTERN", "MOMENT", "MOSS", "NEST", "NIGHT", "PAUSE", "PEACE", "PLAY",
    "RHYTHM", "SEARCH", "SHINE", "SPARK", "STILL", "STORY", "THOUGHT", "WARMTH", "WONDER", "REST",
    "RISE", "SOFT", "TIDE", "WANDER", "HEART", "LAUGH", "LITTLE", "MAGIC", "MEADOW", "NOTICE"
  ];
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const DIRECTIONS = [
    { dr: 0, dc: 1, name: "across" },
    { dr: 1, dc: 0, name: "down" },
    { dr: 1, dc: 1, name: "diagonal" },
    { dr: 1, dc: -1, name: "diagonal" },
    { dr: 0, dc: -1, name: "across" },
    { dr: -1, dc: 0, name: "down" },
    { dr: -1, dc: -1, name: "diagonal" },
    { dr: -1, dc: 1, name: "diagonal" }
  ];
  const FOUND_COLORS = ["#9bf3d0", "#72e8ff", "#ffd86b", "#b995ff", "#ff83bd", "#9fb6ff"];
  const SOUNDTRACKS = {
    cozy: { src: "/home/cozy-builder-theme.mp3", label: "Johnny's Cozy Theme" },
    "dreamy-clouds": { src: "/tetris/audio/dreamy-clouds.mp3", label: "Dreamy Clouds", loopTrimSeconds: 2 },
    "neon-dreams": { src: "/tetris/audio/neon-dreams.mp3", label: "Neon Dreams" },
    "whimsical-waltz": { src: "/tetris/audio/whimsical-waltz.mp3", label: "Whimsical Waltz" },
    "crownforge-rp": { src: "/crownforge/assets/lantern-under-stone.mp3", label: "Johnny's RP" },
    "nocturnal-calm": { src: "/tetris/audio/nocturnal-calm.mp3", label: "Nocturnal Calm", loopTrimSeconds: 1 }
  };
  const LOOP_ALL_ID = "loop-all";
  const SOUNDTRACK_ORDER = Object.keys(SOUNDTRACKS);
  const SOUNDTRACK_STORAGE_KEY = "johnny-tetris-soundtrack";

  let puzzleNumber = 0;
  let audioContext = null;
  let musicEnabled = true;
  let musicError = false;
  let soundtrackId = "cozy";
  let activeTrackId = "cozy";
  let loopAllIndex = 0;
  let celebrationTimer = 0;
  let state = null;
  let pointerSession = null;

  const shuffle = (items) => {
    const result = items.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [result[index], result[swap]] = [result[swap], result[index]];
    }
    return result;
  };

  const formatTime = (seconds) => {
    const safe = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
  };

  const emptyGrid = (size) => Array.from({ length: size }, () => Array(size).fill(null));

  const directionsFor = (config) => DIRECTIONS.filter((direction) => {
    if (config.directionNames.includes("all directions")) return true;
    if (!(direction.dr > 0 || (direction.dr === 0 && direction.dc > 0))) return false;
    if (config.directionNames.includes(direction.name)) return true;
    return false;
  }).filter((direction, index, list) => list.findIndex((item) => item.dr === direction.dr && item.dc === direction.dc) === index);

  const pathFor = (row, col, direction, length) => Array.from({ length }, (_, index) => ({
    row: row + direction.dr * index,
    col: col + direction.dc * index
  }));

  const pathFits = (path, size) => path.every(({ row, col }) => row >= 0 && row < size && col >= 0 && col < size);

  const canPlace = (grid, path, word) => path.every(({ row, col }, index) => !grid[row][col] || grid[row][col] === word[index]);

  const placeWord = (grid, path, word) => {
    path.forEach(({ row, col }, index) => { grid[row][col] = word[index]; });
  };

  const candidatePlacements = (word, config) => {
    const candidates = [];
    const directions = directionsFor(config);
    for (let row = 0; row < config.size; row += 1) {
      for (let col = 0; col < config.size; col += 1) {
        for (const direction of directions) {
          for (const reversed of config.reverse ? [false, true] : [false]) {
            const path = pathFor(row, col, direction, word.length);
            if (pathFits(path, config.size)) candidates.push({ path, letters: reversed ? [...word].reverse().join("") : word, reversed });
          }
        }
      }
    }
    return shuffle(candidates).slice(0, 420);
  };

  const searchPlacements = (words, config, index, grid, placements) => {
    if (index >= words.length) return { grid, placements };
    const word = words[index];
    for (const candidate of candidatePlacements(word, config)) {
      if (!canPlace(grid, candidate.path, candidate.letters)) continue;
      const nextGrid = grid.map((row) => row.slice());
      placeWord(nextGrid, candidate.path, candidate.letters);
      const result = searchPlacements(words, config, index + 1, nextGrid, placements.concat({ word, path: candidate.path, reversed: candidate.reversed }));
      if (result) return result;
    }
    return null;
  };

  const generatePuzzle = (difficultyKey) => {
    const config = DIFFICULTIES[difficultyKey];
    const eligible = WORD_BANK.filter((word) => word.length <= config.size);
    for (let attempt = 0; attempt < 28; attempt += 1) {
      const words = shuffle(eligible).slice(0, config.wordCount).sort((a, b) => b.length - a.length);
      const placed = searchPlacements(words, config, 0, emptyGrid(config.size), []);
      if (!placed) continue;
      placed.grid.forEach((row) => row.forEach((letter, col, sourceRow) => {
        if (!letter) sourceRow[col] = LETTERS[Math.floor(Math.random() * LETTERS.length)];
      }));
      return { id: ++puzzleNumber, size: config.size, grid: placed.grid, words: words.slice().sort(), placements: placed.placements };
    }
    throw new Error(`Could not build ${difficultyKey} puzzle`);
  };

  const cellKey = ({ row, col }) => `${row}-${col}`;
  const cellElement = ({ row, col }) => gridElement.querySelector(`[data-cell="${row}-${col}"]`);
  const readCell = (element) => ({ row: Number(element.dataset.row), col: Number(element.dataset.col) });

  const lineBetween = (start, end) => {
    const rowDelta = end.row - start.row;
    const colDelta = end.col - start.col;
    const rowStep = Math.sign(rowDelta);
    const colStep = Math.sign(colDelta);
    const rowLength = Math.abs(rowDelta);
    const colLength = Math.abs(colDelta);
    if (rowDelta !== 0 && colDelta !== 0 && rowLength !== colLength) return [];
    const length = Math.max(rowLength, colLength) + 1;
    return pathFor(start.row, start.col, { dr: rowStep, dc: colStep }, length);
  };

  const setStatus = (message) => { statusText.textContent = message; };

  const clearPreview = () => {
    gridElement.querySelectorAll(".is-preview, .is-anchor").forEach((cell) => cell.classList.remove("is-preview", "is-anchor"));
    state.previewPath = [];
  };

  const setPreview = (path) => {
    gridElement.querySelectorAll(".is-preview, .is-anchor").forEach((cell) => cell.classList.remove("is-preview", "is-anchor"));
    state.previewPath = path;
    path.forEach((point, index) => {
      const cell = cellElement(point);
      if (!cell || state.foundCells.has(cellKey(point))) return;
      cell.classList.add("is-preview");
      if (index === 0) cell.classList.add("is-anchor");
    });
  };

  const paintFoundPath = (path, color) => {
    path.forEach((point) => {
      const key = cellKey(point);
      state.foundCells.add(key);
      const cell = cellElement(point);
      if (cell) {
        cell.classList.remove("is-preview", "is-anchor");
        cell.classList.add("is-found");
        cell.style.setProperty("--found-color", color);
      }
    });
  };

  const markFoundPath = (path) => {
    const color = FOUND_COLORS[state.foundPaths.length % FOUND_COLORS.length];
    paintFoundPath(path, color);
    state.foundPaths.push(path);
  };

  const showWrongPath = (path) => {
    path.forEach((point) => cellElement(point)?.classList.add("is-wrong"));
    window.setTimeout(() => path.forEach((point) => cellElement(point)?.classList.remove("is-wrong")), 360);
  };

  const renderGrid = () => {
    const puzzle = state.puzzle;
    gridElement.style.setProperty("--grid-size", puzzle.size);
    gridElement.innerHTML = "";
    puzzle.grid.forEach((row, rowIndex) => row.forEach((letter, colIndex) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "grid-cell";
      cell.dataset.row = String(rowIndex);
      cell.dataset.col = String(colIndex);
      cell.dataset.cell = `${rowIndex}-${colIndex}`;
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `${letter}, row ${rowIndex + 1}, column ${colIndex + 1}`);
      cell.textContent = letter;
      gridElement.appendChild(cell);
    }));
    state.foundPaths.forEach((path, index) => paintFoundPath(path, FOUND_COLORS[index % FOUND_COLORS.length]));
  };

  const renderWords = () => {
    wordListElement.innerHTML = "";
    state.puzzle.words.forEach((word) => {
      const item = document.createElement("li");
      item.dataset.word = word;
      item.textContent = word;
      if (state.found.has(word)) item.classList.add("is-found");
      wordListElement.appendChild(item);
    });
  };

  const updateUi = () => {
    const config = DIFFICULTIES[state.difficultyKey];
    const found = state.found.size;
    foundCountElement.textContent = `${found}/${state.puzzle.words.length}`;
    wordsLeftElement.textContent = `${state.puzzle.words.length - found} left`;
    timerElement.textContent = formatTime(state.elapsed);
    streakElement.textContent = String(state.streak);
    difficultyLabel.textContent = config.label;
    difficultyCopy.textContent = config.copy;
    puzzleCode.textContent = `Puzzle ${String(state.puzzle.id).padStart(3, "0")}`;
    boardHint.textContent = state.selectedStart ? "Now tap the last letter" : "Drag a line or tap two letters";
    difficultyButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.difficulty === state.difficultyKey)));
    wordsLeftElement.dataset.complete = String(state.complete);
  };

  const playTone = (finalWord = false) => {
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
      const now = audioContext.currentTime;
      const notes = finalWord ? [392, 523, 659, 784] : [440, 554, 659];
      notes.forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = index % 2 ? "triangle" : "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(.0001, now + index * .055);
        gain.gain.exponentialRampToValueAtTime(finalWord ? .045 : .03, now + index * .055 + .025);
        gain.gain.exponentialRampToValueAtTime(.0001, now + index * .055 + .34);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start(now + index * .055);
        oscillator.stop(now + index * .055 + .36);
      });
    } catch (_) {}
  };

  const showCelebration = (word, finalWord) => {
    celebrationKicker.textContent = finalWord ? "FIELD CLEARED" : "WORD FOUND";
    celebrationWord.textContent = finalWord ? "ALL DONE" : word;
    celebrationCopy.textContent = finalWord ? "Every hidden word is glowing. Beautiful work." : "A bright little breakthrough.";
    celebrationSparks.innerHTML = "";
    const hues = ["#72e8ff", "#84f2c2", "#ffd86b", "#b995ff", "#ff83bd"];
    for (let index = 0; index < (finalWord ? 46 : 30); index += 1) {
      const spark = document.createElement("i");
      const angle = Math.random() * Math.PI * 2;
      const distance = 120 + Math.random() * (finalWord ? 330 : 220);
      spark.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
      spark.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
      spark.style.setProperty("--delay", `${Math.random() * 130}ms`);
      spark.style.setProperty("--size", `${4 + Math.random() * 8}px`);
      spark.style.setProperty("--spark-color", hues[index % hues.length]);
      celebrationSparks.appendChild(spark);
    }
    celebration.classList.remove("is-visible");
    void celebration.offsetWidth;
    celebration.classList.add("is-visible");
    celebration.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-celebrating");
    window.clearTimeout(celebrationTimer);
    celebrationTimer = window.setTimeout(() => {
      celebration.classList.remove("is-visible");
      celebration.setAttribute("aria-hidden", "true");
      document.body.classList.remove("is-celebrating");
    }, finalWord ? 1900 : 1350);
  };

  const attemptSelection = (path) => {
    if (!path.length) {
      setStatus("Keep the word in a straight line.");
      clearPreview();
      return;
    }
    const sequence = path.map((point) => state.puzzle.grid[point.row][point.col]).join("");
    const reverseSequence = [...sequence].reverse().join("");
    const word = state.puzzle.words.find((candidate) => !state.found.has(candidate) && (candidate === sequence || candidate === reverseSequence));
    if (!word) {
      state.streak = 0;
      showWrongPath(path);
      clearPreview();
      setStatus("Not this time — try another trail.");
      updateUi();
      return;
    }
    state.found.add(word);
    state.streak += 1;
    markFoundPath(path);
    clearPreview();
    const wordItem = wordListElement.querySelector(`[data-word="${word}"]`);
    wordItem?.classList.add("is-found");
    const finalWord = state.found.size === state.puzzle.words.length;
    state.complete = finalWord;
    setStatus(finalWord ? "Beautiful — you cleared the whole field." : `${word} found. Keep the glow going.`);
    playTone(finalWord);
    showCelebration(word, finalWord);
    updateUi();
  };

  const cellFromPoint = (clientX, clientY) => {
    const element = document.elementFromPoint(clientX, clientY);
    return element?.closest?.(".grid-cell") || null;
  };

  const endPointerSession = (event) => {
    if (!pointerSession || event.pointerId !== pointerSession.pointerId) return;
    const session = pointerSession;
    pointerSession = null;
    try { gridElement.releasePointerCapture?.(event.pointerId); } catch (_) {}
    const cell = cellFromPoint(event.clientX, event.clientY) || event.target?.closest?.(".grid-cell");
    if (!cell) {
      state.selectedStart = null;
      clearPreview();
      updateUi();
      return;
    }
    const end = readCell(cell);
    const path = lineBetween(session.start, end);
    if (!session.dragging && !state.selectedStart) {
      state.selectedStart = session.start;
      setPreview([session.start]);
      setStatus("Nice start. Now tap the last letter.");
      updateUi();
      return;
    }
    state.selectedStart = null;
    attemptSelection(path);
    updateUi();
  };

  gridElement.addEventListener("pointerdown", (event) => {
    const cell = event.target.closest?.(".grid-cell");
    if (!cell || state.complete) return;
    event.preventDefault();
    startMusic();
    const origin = readCell(cell);
    const start = state.selectedStart || origin;
    pointerSession = { pointerId: event.pointerId, start, dragging: false };
    try { gridElement.setPointerCapture?.(event.pointerId); } catch (_) {}
    setPreview(lineBetween(start, origin));
  });
  gridElement.addEventListener("pointermove", (event) => {
    if (!pointerSession || event.pointerId !== pointerSession.pointerId) return;
    const cell = cellFromPoint(event.clientX, event.clientY);
    if (!cell) return;
    const path = lineBetween(pointerSession.start, readCell(cell));
    pointerSession.dragging = pointerSession.dragging || path.length > 1;
    setPreview(path.length ? path : [pointerSession.start]);
  });
  gridElement.addEventListener("pointerup", endPointerSession);
  gridElement.addEventListener("pointercancel", endPointerSession);
  gridElement.addEventListener("keydown", (event) => {
    if (!event.target.closest?.(".grid-cell") || !["Enter", " "].includes(event.key) || state.complete) return;
    event.preventDefault();
    const point = readCell(event.target);
    if (!state.selectedStart) {
      state.selectedStart = point;
      setPreview([point]);
      setStatus("Nice start. Now focus the last letter and press Enter.");
      updateUi();
    } else {
      const path = lineBetween(state.selectedStart, point);
      state.selectedStart = null;
      attemptSelection(path);
      updateUi();
    }
  });

  const newGame = (difficultyKey = state?.difficultyKey || "easy") => {
    state = {
      difficultyKey,
      puzzle: generatePuzzle(difficultyKey),
      found: new Set(),
      foundCells: new Set(),
      foundPaths: [],
      selectedStart: null,
      previewPath: [],
      streak: 0,
      elapsed: 0,
      startedAt: performance.now(),
      complete: false
    };
    renderGrid();
    renderWords();
    updateUi();
    setStatus(`${DIFFICULTIES[difficultyKey].label} field ready. Find your first word.`);
  };

  const startMusic = () => {
    if (!musicEnabled) return;
    window.JohnnyAudioFocus?.claim("cozy-search");
    music.play().catch(() => {});
  };

  const updateMusicButton = () => {
    const playing = musicEnabled && !music.paused;
    musicButton.textContent = musicError ? "Track unavailable" : (playing ? "Music: on" : (musicEnabled ? "Music: paused" : "Music: off"));
    musicButton.dataset.playing = String(playing);
    musicButton.setAttribute("aria-pressed", String(musicEnabled));
  };

  const updateSoundtrackControl = () => {
    soundtrackSelect.value = soundtrackId;
    music.dataset.track = activeTrackId;
    music.dataset.playlist = soundtrackId === LOOP_ALL_ID ? "all" : "single";
  };

  const activeTrack = () => SOUNDTRACKS[activeTrackId] || SOUNDTRACKS.cozy;

  const keepTrackLoopTight = () => {
    if (soundtrackId === LOOP_ALL_ID) return;
    const trimSeconds = activeTrack().loopTrimSeconds || 0;
    if (!trimSeconds || music.paused || !Number.isFinite(music.duration)) return;
    if (music.duration > trimSeconds && music.currentTime >= music.duration - trimSeconds) music.currentTime = 0;
  };

  const loadTrack = (trackId, resume = false) => {
    const track = SOUNDTRACKS[trackId];
    if (!track) return;
    activeTrackId = trackId;
    musicError = false;
    music.pause();
    music.loop = soundtrackId !== LOOP_ALL_ID;
    if (music.getAttribute("src") !== track.src) {
      music.src = track.src;
      music.load();
    }
    try { music.currentTime = 0; } catch (_) {}
    music.setAttribute("aria-label", `${track.label} soundtrack`);
    updateSoundtrackControl();
    if (resume && musicEnabled) {
      window.JohnnyAudioFocus?.claim("cozy-search");
      music.play().catch(() => {});
    } else updateMusicButton();
  };

  const setSoundtrack = (nextId) => {
    if (nextId !== LOOP_ALL_ID && !SOUNDTRACKS[nextId]) return;
    const resume = musicEnabled && !music.paused;
    soundtrackId = nextId;
    try { localStorage.setItem(SOUNDTRACK_STORAGE_KEY, soundtrackId); } catch (_) {}
    if (nextId === LOOP_ALL_ID) {
      loopAllIndex = 0;
      loadTrack(SOUNDTRACK_ORDER[loopAllIndex], resume);
      return;
    }
    loopAllIndex = Math.max(0, SOUNDTRACK_ORDER.indexOf(nextId));
    loadTrack(nextId, resume);
  };

  const advanceLoopAll = () => {
    if (soundtrackId !== LOOP_ALL_ID) return;
    loopAllIndex = (loopAllIndex + 1) % SOUNDTRACK_ORDER.length;
    loadTrack(SOUNDTRACK_ORDER[loopAllIndex], musicEnabled);
  };

  difficultyButtons.forEach((button) => button.addEventListener("click", () => {
    startMusic();
    newGame(button.dataset.difficulty);
  }));
  newGameButton.addEventListener("click", () => {
    startMusic();
    newGame();
  });
  musicButton.addEventListener("click", () => {
    musicEnabled = !musicEnabled;
    musicError = false;
    if (musicEnabled) startMusic();
    else music.pause();
    updateMusicButton();
  });
  soundtrackSelect.addEventListener("change", (event) => {
    startMusic();
    setSoundtrack(event.target.value);
  });
  music.addEventListener("play", updateMusicButton);
  music.addEventListener("pause", updateMusicButton);
  music.addEventListener("canplay", () => { musicError = false; updateMusicButton(); });
  music.addEventListener("error", () => { musicError = true; updateMusicButton(); });
  music.addEventListener("timeupdate", keepTrackLoopTight);
  music.addEventListener("ended", advanceLoopAll);
  window.addEventListener("pagehide", () => music.pause());
  window.addEventListener("johnny:music-focus", updateMusicButton);

  let storedSoundtrack = "cozy";
  try { storedSoundtrack = localStorage.getItem(SOUNDTRACK_STORAGE_KEY) || "cozy"; } catch (_) {}
  soundtrackId = storedSoundtrack === LOOP_ALL_ID || SOUNDTRACKS[storedSoundtrack] ? storedSoundtrack : "cozy";
  activeTrackId = soundtrackId === LOOP_ALL_ID ? SOUNDTRACK_ORDER[0] : soundtrackId;
  loopAllIndex = Math.max(0, SOUNDTRACK_ORDER.indexOf(activeTrackId));
  newGame("easy");
  setSoundtrack(soundtrackId);
  updateMusicButton();
  window.setInterval(() => {
    if (!state || state.complete) return;
    state.elapsed = (performance.now() - state.startedAt) / 1000;
    timerElement.textContent = formatTime(state.elapsed);
  }, 250);
})();
