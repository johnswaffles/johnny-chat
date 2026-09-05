(() => {
  "use strict";

  const gridElement = document.getElementById("word-grid");
  const searchCard = document.querySelector(".search-card");
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
  const music = document.getElementById("game-music");
  const musicButton = document.getElementById("music-button");
  const musicButtonLabel = document.getElementById("music-button-label");
  const soundtrackSelect = document.getElementById("soundtrack-select");
  const wordListContent = document.getElementById("word-list-content");
  const wordListToggle = document.getElementById("word-list-toggle");
  const wordListToggleLabel = wordListToggle?.querySelector(".toggle-label");
  const wordListToggleIcon = wordListToggle?.querySelector(".toggle-icon");
  const wordsProgressLabel = document.getElementById("words-progress-label");
  const wordsProgressFill = document.getElementById("words-progress-fill");
  const fieldMeter = document.getElementById("field-meter");
  const fieldMeterFill = document.getElementById("field-meter-fill");
  const fieldMeterLabel = document.getElementById("field-meter-label");

  const DIFFICULTIES = {
    easy: { label: "Easy glow", copy: "A soft landing with clear paths.", size: 8, wordCount: 5, reverse: false, directionNames: ["across", "down"] },
    casual: { label: "Casual drift", copy: "A little more to notice, never too much.", size: 9, wordCount: 6, reverse: false, directionNames: ["across", "down", "diagonal"] },
    tricky: { label: "Tricky tide", copy: "Diagonals and backwards trails join the mix.", size: 11, wordCount: 8, reverse: true, directionNames: ["all directions"] },
    hard: { label: "Hard focus", copy: "A dense field for a serious search.", size: 13, wordCount: 10, reverse: true, directionNames: ["all directions"] },
    "very-hard": { label: "Very hard", copy: "Thirty words. A tight field. No shortcuts.", size: 13, wordCount: 30, reverse: true, directionNames: ["all directions"] }
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
  const FOUND_COLORS = ["#addfc5", "#acdcd9", "#e6cd91", "#c3b5dd", "#dbb6bc", "#bacbe0"];
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
  let resizeFrame = 0;
  let pointerMoveFrame = 0;
  let latestPointerMove = null;
  let state = null;
  let pointerSession = null;
  let previewCellElements = [];
  const cellElements = new Map();
  const revealGlowTimers = new Map();
  const revealGlowCounts = new Map();

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
  const cellElement = (point) => cellElements.get(cellKey(point)) || null;
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
    previewCellElements.forEach((cell) => cell.classList.remove("is-preview", "is-anchor"));
    previewCellElements = [];
    state.previewPath = [];
    window.CozyObservatory?.preview([]);
  };

  const setPreview = (path) => {
    previewCellElements.forEach((cell) => cell.classList.remove("is-preview", "is-anchor"));
    previewCellElements = [];
    state.previewPath = path;
    window.CozyObservatory?.preview(path.map(cellElement).filter(Boolean));
    path.forEach((point, index) => {
      const cell = cellElement(point);
      if (!cell || state.foundCells.has(cellKey(point))) return;
      cell.classList.add("is-preview");
      if (index === 0) cell.classList.add("is-anchor");
      previewCellElements.push(cell);
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
    return color;
  };

  const showWrongPath = (path) => {
    path.forEach((point) => cellElement(point)?.classList.add("is-wrong"));
    window.setTimeout(() => path.forEach((point) => cellElement(point)?.classList.remove("is-wrong")), 360);
  };

  const renderGrid = () => {
    const puzzle = state.puzzle;
    gridElement.style.setProperty("--grid-size", puzzle.size);
    gridElement.innerHTML = "";
    cellElements.clear();
    previewCellElements = [];
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
      cellElements.set(`${rowIndex}-${colIndex}`, cell);
      gridElement.appendChild(cell);
    }));
    state.foundPaths.forEach((path, index) => paintFoundPath(path, FOUND_COLORS[index % FOUND_COLORS.length]));
  };

  const scheduleBoardLayout = () => {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      window.CozyObservatory?.resize();
    });
  };

  const updateWordItem = (word) => {
    const item = wordListElement.querySelector(`[data-word="${word}"]`);
    const button = item?.querySelector(".word-reveal");
    if (!item || !button) return;
    const found = state.found.has(word);
    item.classList.toggle("is-found", found);
    button.textContent = word;
    button.disabled = found;
    button.title = found ? `${word} found` : `Reveal ${word} on the board`;
    button.setAttribute("aria-label", found ? `${word}, found` : `Reveal ${word} on the board`);
    if (found) item.style.setProperty("--word-color", state.foundWordColors.get(word) || FOUND_COLORS[0]);
    else item.style.removeProperty("--word-color");
  };

  const renderWords = () => {
    wordListElement.innerHTML = "";
    state.puzzle.words.forEach((word) => {
      const item = document.createElement("li");
      item.dataset.word = word;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "word-reveal";
      button.textContent = word;
      button.addEventListener("click", () => revealWord(word));
      item.appendChild(button);
      wordListElement.appendChild(item);
      updateWordItem(word);
    });
  };

  const flashRevealedPath = (word, path) => {
    const cells = path.map((point) => cellElement(point)).filter(Boolean);
    if (!cells.length) return;
    const previousTimer = revealGlowTimers.get(word);
    if (previousTimer) window.clearTimeout(previousTimer);
    cells.forEach((cell) => {
      revealGlowCounts.set(cell, (revealGlowCounts.get(cell) || 0) + 1);
      cell.classList.remove("is-revealed");
    });
    void cells[0].offsetWidth;
    cells.forEach((cell) => cell.classList.add("is-revealed"));
    const timer = window.setTimeout(() => {
      cells.forEach((cell) => {
        const remaining = Math.max(0, (revealGlowCounts.get(cell) || 1) - 1);
        if (remaining) revealGlowCounts.set(cell, remaining);
        else {
          revealGlowCounts.delete(cell);
          cell.classList.remove("is-revealed");
        }
      });
      revealGlowTimers.delete(word);
    }, 2600);
    revealGlowTimers.set(word, timer);
  };

  const updateUi = () => {
    const config = DIFFICULTIES[state.difficultyKey];
    const found = state.found.size;
    const progress = state.puzzle.words.length ? found / state.puzzle.words.length : 0;
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
    searchCard?.setAttribute("data-difficulty", state.difficultyKey);
    document.body.setAttribute("data-search-difficulty", state.difficultyKey);
    if (wordsProgressLabel) wordsProgressLabel.textContent = `${Math.round(progress * 100)}%`;
    if (wordsProgressFill) wordsProgressFill.style.width = `${progress * 100}%`;
    searchCard?.style.setProperty("--completion", String(progress));
    if (fieldMeterFill) fieldMeterFill.style.transform = `scaleX(${progress})`;
    if (fieldMeterLabel) fieldMeterLabel.textContent = `${Math.round(progress * 100)}% charted`;
    fieldMeter?.setAttribute("aria-label", `${Math.round(progress * 100)} percent of words charted`);
  };

  const setWordListExpanded = (expanded) => {
    if (!wordListContent || !wordListToggle) return;
    wordListContent.hidden = !expanded;
    wordListToggle.setAttribute("aria-expanded", String(expanded));
    if (wordListToggleLabel) wordListToggleLabel.textContent = expanded ? "Hide list" : "Show list";
    if (wordListToggleIcon) wordListToggleIcon.textContent = expanded ? "−" : "＋";
    wordListToggle.closest(".words-card")?.classList.toggle("is-expanded", expanded);
  };

  const playTone = (finalWord = false) => {
    if (!musicEnabled) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
      const now = audioContext.currentTime;
      const notes = finalWord ? [392, 523, 659, 784] : [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(.0001, now + index * .085);
        gain.gain.exponentialRampToValueAtTime(finalWord ? .045 : .03, now + index * .085 + .025);
        gain.gain.exponentialRampToValueAtTime(.0001, now + index * .085 + .34);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start(now + index * .085);
        oscillator.stop(now + index * .085 + .36);
      });
    } catch (_) {}
  };

  const registerWord = (word, path, { revealed = false } = {}) => {
    state.found.add(word);
    state.streak = revealed ? 0 : state.streak + 1;
    const foundColor = markFoundPath(path);
    state.foundWordColors.set(word, foundColor);
    state.selectedStart = null;
    clearPreview();
    updateWordItem(word);
    if (revealed) flashRevealedPath(word, path);
    const finalWord = state.found.size === state.puzzle.words.length;
    state.complete = finalWord;
    window.CozyObservatory?.found({
      word, cells: path.map(cellElement).filter(Boolean), color: foundColor,
      revealed, finalWord, count: state.found.size, total: state.puzzle.words.length
    });
    setStatus(finalWord ? "Beautiful — you cleared the whole field." : (revealed ? `${word} revealed. Keep going.` : `${word} found. Keep the glow going.`));
    playTone(finalWord);
    updateUi();
  };

  const revealWord = (word) => {
    if (!state || state.complete || state.found.has(word)) return;
    const placement = state.puzzle.placements.find((candidate) => candidate.word === word);
    if (!placement) return;
    registerWord(word, placement.path, { revealed: true });
  };

  const attemptSelection = (path) => {
    if (!path.length) {
      setStatus("Keep the word in a straight line.");
      clearPreview();
      updateUi();
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
    registerWord(word, path);
  };

  const cellFromPoint = (clientX, clientY) => {
    const element = document.elementFromPoint(clientX, clientY);
    return element?.closest?.(".grid-cell") || null;
  };

  const endPointerSession = (event) => {
    if (!pointerSession || event.pointerId !== pointerSession.pointerId) return;
    window.cancelAnimationFrame(pointerMoveFrame);
    pointerMoveFrame = 0;
    latestPointerMove = null;
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
    session.dragging = session.dragging || path.length > 1;
    if (!session.dragging && !state.selectedStart) {
      state.selectedStart = session.start;
      setPreview([session.start]);
      setStatus("Nice start. Now tap the last letter.");
      updateUi();
      return;
    }
    state.selectedStart = null;
    attemptSelection(path);
  };

  const flushPointerMove = () => {
    pointerMoveFrame = 0;
    const pending = latestPointerMove;
    latestPointerMove = null;
    if (!pending || !pointerSession || pending.pointerId !== pointerSession.pointerId) return;
    const cell = cellFromPoint(pending.clientX, pending.clientY);
    if (!cell) return;
    const path = lineBetween(pointerSession.start, readCell(cell));
    pointerSession.dragging = pointerSession.dragging || path.length > 1;
    setPreview(path.length ? path : [pointerSession.start]);
  };

  gridElement.addEventListener("pointerdown", (event) => {
    const cell = event.target.closest?.(".grid-cell");
    if (!cell || state.complete) return;
    event.preventDefault();
    window.cancelAnimationFrame(pointerMoveFrame);
    pointerMoveFrame = 0;
    latestPointerMove = null;
    startMusic();
    const origin = readCell(cell);
    const start = state.selectedStart || origin;
    pointerSession = { pointerId: event.pointerId, start, dragging: false };
    try { gridElement.setPointerCapture?.(event.pointerId); } catch (_) {}
    setPreview(lineBetween(start, origin));
  });
  gridElement.addEventListener("pointermove", (event) => {
    if (!pointerSession || event.pointerId !== pointerSession.pointerId) return;
    latestPointerMove = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY };
    if (!pointerMoveFrame) pointerMoveFrame = window.requestAnimationFrame(flushPointerMove);
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
    }
  });

  const newGame = (difficultyKey = state?.difficultyKey || "easy") => {
    window.cancelAnimationFrame(pointerMoveFrame);
    pointerMoveFrame = 0;
    latestPointerMove = null;
    pointerSession = null;
    window.CozyObservatory?.clear();
    revealGlowTimers.forEach((timer) => window.clearTimeout(timer));
    revealGlowTimers.clear();
    revealGlowCounts.clear();
    state = {
      difficultyKey,
      puzzle: generatePuzzle(difficultyKey),
      found: new Set(),
      foundWordColors: new Map(),
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
    setWordListExpanded(false);
    updateUi();
    setStatus(`${DIFFICULTIES[difficultyKey].label} field ready. Find your first word.`);
    window.CozyObservatory?.reset(state.puzzle.words.length, state.puzzle.id);
    scheduleBoardLayout();
  };

  const startMusic = () => {
    if (!musicEnabled) return;
    // A selection starts with a pointerdown on the grid. Re-claiming audio
    // focus for every pointerdown briefly pauses the track on mobile, so only
    // claim when this app actually needs to start (or resume) its audio.
    if (music.paused) window.JohnnyAudioFocus?.claim("cozy-search");
    if (music.paused) music.play().catch(() => {});
  };

  const updateMusicButton = () => {
    const playing = musicEnabled && !music.paused;
    if (musicButtonLabel) musicButtonLabel.textContent = musicError ? "Track unavailable" : (playing ? "Music: on" : (musicEnabled ? "Music: paused" : "Music: off"));
    musicButton.dataset.playing = String(playing);
    musicButton.setAttribute("aria-pressed", String(musicEnabled));
    musicButton.closest(".music-card")?.setAttribute("data-playing", String(playing));
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
  wordListToggle?.addEventListener("click", () => {
    setWordListExpanded(wordListToggle.getAttribute("aria-expanded") !== "true");
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
  window.addEventListener("pagehide", () => {
    music.pause();
    window.cancelAnimationFrame(resizeFrame);
  });
  window.addEventListener("pageshow", () => {
    scheduleBoardLayout();
  });
  window.addEventListener("johnny:music-focus", updateMusicButton);
  window.addEventListener("resize", scheduleBoardLayout);

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
