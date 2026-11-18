import { editions } from "./editions.mjs";
import { dailySpec, freeSpec, generate, levels, line } from "./puzzles.mjs";

const $ = (id) => document.getElementById(id);
const key = "cozy-night-atlas-v1/";
const memory = new Map();
function read(name, fallback) {
  try {
    return (
      JSON.parse(localStorage.getItem(key + name)) ??
      memory.get(name) ??
      fallback
    );
  } catch {
    return memory.get(name) ?? fallback;
  }
}
function write(name, value) {
  memory.set(name, value);
  try {
    localStorage.setItem(key + name, JSON.stringify(value));
  } catch {
    /* Play still works in memory. */
  }
}
const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const colors = [
  "#a7cdb1",
  "#eac295",
  "#a8c9d1",
  "#d0b4c6",
  "#c6c59b",
  "#c4b8dc",
];
const art = (edition) => "./assets/" + edition.id + ".jpg";
const titleCase = (s) => s[0] + s.slice(1).toLowerCase();
const clock = (ms) =>
  Math.floor(ms / 60000) +
  ":" +
  String(Math.floor(ms / 1000) % 60).padStart(2, "0");
const dateKey = (date) => "daily/" + date;
const feedback = (message) => {
  $("feedback").textContent = message;
};
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function button(text, action) {
  const node = element("button", text);
  node.addEventListener("click", action);
  return node;
}
let state,
  puzzle,
  freeSession,
  cells = [],
  ink,
  anchor = null,
  gesture,
  selectedHint;
let tick = null,
  focused = 0,
  pocketIndex = 0,
  hintTimer;
const board = $("board"),
  dialog = $("dialog"),
  content = $("dialog-content");
const audioControls = $("audio-controls");
const svgNS = "http://www.w3.org/2000/svg";
const sky = $("sky");
const chartPoints = [
  [
    [3, 21],
    [18, 21],
    [27, 15],
    [44, 15],
    [51, 6],
    [59, 15],
    [76, 15],
    [86, 21],
    [98, 21],
  ],
  [
    [3, 23],
    [13, 16],
    [25, 8],
    [40, 16],
    [52, 23],
    [65, 15],
    [76, 6],
    [86, 14],
    [97, 20],
  ],
  [
    [2, 19],
    [16, 14],
    [28, 17],
    [39, 6],
    [51, 10],
    [64, 19],
    [76, 12],
    [86, 15],
    [98, 6],
  ],
  [
    [3, 9],
    [17, 7],
    [28, 11],
    [40, 14],
    [50, 21],
    [63, 13],
    [75, 10],
    [86, 6],
    [98, 8],
  ],
  [
    [3, 22],
    [16, 17],
    [28, 12],
    [40, 8],
    [52, 7],
    [64, 9],
    [76, 12],
    [87, 17],
    [98, 21],
  ],
  [
    [3, 15],
    [15, 20],
    [28, 23],
    [39, 24],
    [52, 24],
    [65, 23],
    [76, 20],
    [88, 15],
    [98, 8],
  ],
];
function chart() {
  const { found, spec } = state;
  const points = chartPoints[spec.theme];
  const fraction = Object.keys(found).length / (puzzle.words.length + 1);
  const lit = Math.round(fraction * (points.length - 1)) + 1;
  const poly = (coords, color) => {
    const path = document.createElementNS(svgNS, "polyline");
    path.setAttribute("points", coords.map((p) => p.join(",")).join(" "));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", ".75");
    return path;
  };
  sky.replaceChildren(
    poly(points, "#577573"),
    poly(points.slice(0, lit), "#edba77"),
  );
  points.forEach(([x, y], i) => {
    const star = document.createElementNS(svgNS, "circle");
    star.setAttribute("cx", x);
    star.setAttribute("cy", y);
    star.setAttribute("r", i < lit ? 1.9 : 1.25);
    star.setAttribute("fill", i < lit ? "#ffd190" : "#8aa099");
    sky.append(star);
  });
}
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
function timeNow() {
  return state.ms + (tick === null ? 0 : performance.now() - tick);
}
function freeze() {
  if (tick !== null) {
    state.ms = timeNow();
    tick = null;
  }
}
function runClock() {
  if (tick === null && !document.hidden && !dialog.open && !complete())
    tick = performance.now();
}
function mergeDaily(previous) {
  if (!previous || previous.spec.seed !== state.spec.seed) return;
  state.found = { ...previous.found, ...state.found };
  state.peeked ||= previous.peeked;
  state.hintSteps ||= {};
  for (const [word, count] of Object.entries(previous.hintSteps || {})) {
    state.hintSteps[word] = Math.max(count, state.hintSteps[word] || 0);
  }
  state.hints = Math.max(
    state.hints,
    previous.hints,
    Object.values(state.hintSteps).reduce((a, b) => a + b, 0),
  );
  const ms = Math.max(timeNow(), previous.ms);
  state.ms = ms;
  if (tick !== null) tick = complete() ? null : performance.now();
}
function save() {
  if (state.spec.mode !== "daily") return;
  const name = dateKey(state.spec.date);
  mergeDaily(read(name, null));
  write(name, { ...state, ms: Math.round(timeNow()) });
}
window.addEventListener("storage", (event) => {
  if (
    state?.spec.mode !== "daily" ||
    event.key !== key + dateKey(state.spec.date) ||
    !event.newValue
  )
    return;
  mergeDaily(read(dateKey(state.spec.date), null));
  render();
});
function complete() {
  return Object.hasOwn(state.found, puzzle.mystery.word);
}
function remaining() {
  return puzzle.words.filter((e) => !Object.hasOwn(state.found, e.word));
}
function score() {
  if (state.hints) return 1;
  return state.peeked ? 2 : 3;
}
function newFree(level) {
  const recent = read("recent", []);
  const spec = freeSpec(level, recent, seed);
  write(
    "recent",
    recent.length >= editions.length ? [spec.theme] : [...recent, spec.theme],
  );
  write("level", level);
  start(spec);
}
function start(spec, prior) {
  if (state) {
    freeze();
    save();
    if (state.spec.mode === "free") freeSession = state;
  }
  puzzle = generate(spec);
  state = prior || {
    spec,
    found: {},
    hints: 0,
    hintSteps: {},
    peeked: !read("clues", false),
    ms: 0,
    clues: read("clues", false) === true,
  };
  clearTimeout(hintTimer);
  anchor = null;
  gesture = null;
  selectedHint = null;
  pocketIndex = 0;
  focused = 0;
  board.style.setProperty("--size", puzzle.config.size);
  $("hero-art").style.backgroundImage = "url(" + art(puzzle.edition) + ")";
  $("edition-name").textContent = puzzle.edition.name;
  $("edition-note").textContent = puzzle.edition.note;
  const daily = spec.mode === "daily";
  $("edition-type").textContent =
    (daily ? "Daily · " + spec.date : "Free play") +
    " / " +
    puzzle.edition.setting;
  $("free").setAttribute("aria-pressed", String(!daily));
  $("daily").setAttribute("aria-pressed", String(daily));
  $("level").value = spec.level;
  $("level").disabled = daily;
  $("new").innerHTML = daily
    ? "Play free ↗"
    : '<span aria-hidden="true">↻</span> New puzzle';
  $("direction").textContent = puzzle.config.guide;
  $("coordinates").textContent =
    (daily ? "Daily" : "Map") + " № " + spec.seed.toString(36).toUpperCase();
  $("board-size").textContent = puzzle.config.size + " × " + puzzle.config.size;
  $("timer").textContent = clock(state.ms);
  board
    .closest("main")
    .classList.toggle("wide-board", puzzle.config.size >= 11);
  buildGrid();
  sizeBoardWindow();
  boardWindow.scrollTo(0, 0);
  render();
  runClock();
  feedback(complete() ? "This edition is in your field journal." : "");
}
function goDaily() {
  const spec = dailySpec();
  if (state.spec.mode === "daily" && spec.date === state.spec.date) return;
  start(spec, read(dateKey(spec.date), null));
}
function goFree() {
  if (state.spec.mode === "free") return;
  if (freeSession) start(freeSession.spec, freeSession);
  else newFree(read("level", "easy"));
}
const boardWindow = $("board-window");
const sizeControl = $("letter-size");
const sizes = ["comfort", "large", "fit"];
const savedSize = read("letter-size", "comfort");
sizeControl.value = sizes.includes(savedSize) ? savedSize : "comfort";
boardWindow.dataset.size = sizeControl.value;
const panControls = $("board-pan");
const panButtons = [...panControls.querySelectorAll("button")];
function updateBoardRange() {
  if (panControls.hidden) return;
  const pitch = board.getBoundingClientRect().width / puzzle.config.size;
  const range = (offset, extent) =>
    Math.floor((offset + 1) / pitch) +
    1 +
    "–" +
    Math.min(puzzle.config.size, Math.ceil((offset + extent - 1) / pitch));
  const {
    scrollLeft: x,
    scrollTop: y,
    clientWidth: w,
    clientHeight: h,
  } = boardWindow;
  $("board-range").textContent =
    "Rows " + range(y, h) + " · Cols " + range(x, w);
  const blocked = {
    left: x < 1,
    right: x + w >= boardWindow.scrollWidth - 1,
    up: y < 1,
    down: y + h >= boardWindow.scrollHeight - 1,
  };
  for (const button of panButtons)
    button.disabled = blocked[button.dataset.pan];
}
function sizeBoardWindow() {
  const width = boardWindow.offsetWidth;
  const scrollable = board.getBoundingClientRect().width > width + 1;
  boardWindow.style.setProperty("--window-width", width + "px");
  boardWindow.classList.toggle("scrollable", scrollable);
  panControls.hidden = !scrollable;
  $("board-tip").textContent = scrollable
    ? "Tap one end, swipe or use the arrows to move, then tap the other end."
    : "Drag through a word or tap its two ends.";
  updateBoardRange();
}
sizeControl.onchange = () => {
  const size = sizeControl.value;
  const keep = anchor ?? selectedHint ?? focused;
  boardWindow.dataset.size = size;
  write("letter-size", size);
  sizeBoardWindow();
  bringIntoBoardView(keep);
};
boardWindow.addEventListener("scroll", updateBoardRange, { passive: true });
new ResizeObserver(sizeBoardWindow).observe(boardWindow);
for (const button of panButtons)
  button.onclick = () => {
    const dx = boardWindow.clientWidth * 0.65,
      dy = boardWindow.clientHeight * 0.65;
    const moves = {
      left: [-dx, 0],
      right: [dx, 0],
      up: [0, -dy],
      down: [0, dy],
    };
    boardWindow.scrollBy(...moves[button.dataset.pan]);
  };
function bringIntoBoardView(index) {
  if (panControls.hidden) return;
  const box = cells[index].getBoundingClientRect();
  const view = boardWindow.getBoundingClientRect();
  const delta = (start, end, lo, hi) =>
    Math.min(0, start - lo) + Math.max(0, end - hi);
  boardWindow.scrollBy(
    delta(box.left, box.right, view.left, view.left + boardWindow.clientWidth),
    delta(box.top, box.bottom, view.top, view.top + boardWindow.clientHeight),
  );
}
function buildGrid() {
  board.replaceChildren();
  cells = [];
  ink = document.createElementNS(svgNS, "svg");
  ink.classList.add("ink-layer");
  ink.setAttribute("aria-hidden", "true");
  ink.setAttribute(
    "viewBox",
    "0 0 " + puzzle.config.size + " " + puzzle.config.size,
  );
  board.append(ink);
  for (let row = 0; row < puzzle.config.size; row++) {
    const group = element("div", "", "grid-row");
    group.setAttribute("role", "row");
    for (let col = 0; col < puzzle.config.size; col++) {
      const i = row * puzzle.config.size + col;
      const cell = element("button", puzzle.grid[i], "cell");
      cell.dataset.index = i;
      cell.tabIndex = i === 0 ? 0 : -1;
      cell.setAttribute("role", "gridcell");
      cell.setAttribute(
        "aria-label",
        puzzle.grid[i] + ", row " + (row + 1) + ", column " + (col + 1),
      );
      cells.push(cell);
      group.append(cell);
    }
    board.append(group);
  }
}
function draw(path, color, preview, animate) {
  if (!path.length) return;
  const n = puzzle.config.size,
    a = path[0],
    b = path[path.length - 1];
  const node = document.createElementNS(svgNS, a === b ? "circle" : "line");
  const x = (i) => (i % n) + 0.5,
    y = (i) => Math.floor(i / n) + 0.5;
  const attrs =
    a === b
      ? { cx: x(a), cy: y(a), r: 0.36, fill: color }
      : { x1: x(a), x2: x(b), y1: y(a), y2: y(b), stroke: color };
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  if (preview) node.classList.add(a === b ? "anchor" : "preview");
  if (animate && !reduced.matches) node.classList.add("stroke-new");
  ink.append(node);
}
function paint(preview = [], newest) {
  ink.replaceChildren();
  Object.entries(state.found).forEach(([word, path], i) =>
    draw(
      path,
      word === puzzle.mystery.word ? "#dfb363" : colors[i % colors.length],
      false,
      word === newest,
    ),
  );
  draw(preview, "#e6aa73", true);
}
function pocketGuide() {
  const entries = remaining(),
    entry = entries[pocketIndex % (entries.length || 1)] || puzzle.mystery;
  $("pocket-label").textContent = complete()
    ? "Complete"
    : entries.length
      ? "Find"
      : "Mystery";
  $("pocket-entry").textContent = complete()
    ? puzzle.edition.name
    : state.clues || !entries.length
      ? entry.clue
      : titleCase(entry.word);
  $("pocket-next").hidden = entries.length < 2;
}
function render(newest) {
  const left = remaining(),
    done = puzzle.words.length - left.length;
  $("found-count").textContent = done + " / " + puzzle.words.length;
  $("progress").style.width = (done / puzzle.words.length) * 100 + "%";
  $("words-mode").setAttribute("aria-pressed", String(!state.clues));
  $("clues-mode").setAttribute("aria-pressed", String(state.clues));
  $("list-heading").textContent = state.clues ? "Clue list" : "Word list";
  const list = $("words");
  list.replaceChildren();
  list.classList.toggle("clued", state.clues);
  list.classList.toggle("dense", puzzle.words.length > 12);
  for (const e of puzzle.words) {
    const solved = Object.hasOwn(state.found, e.word);
    const li = element("li", "", solved ? "solved" : "");
    const showClue = state.clues && !solved;
    const label = element(
      "span",
      showClue ? e.clue : titleCase(e.word),
      "answer",
    );
    if (showClue)
      label.append(element("small", " (" + e.word.length + ")", "clue-length"));
    if (solved) li.setAttribute("aria-label", e.word + ", found");
    li.append(label);
    list.append(li);
  }
  $("mystery").classList.toggle("awake", !left.length);
  $("mystery-copy").textContent = left.length
    ? "Find the listed words to unlock the last clue."
    : complete()
      ? titleCase(puzzle.mystery.word) + " · Mystery solved"
      : puzzle.mystery.clue;
  $("mystery-mask").textContent =
    !left.length && !complete()
      ? Array(puzzle.mystery.word.length).fill("·").join(" ") +
        " (" +
        puzzle.mystery.word.length +
        ")"
      : "";
  $("hint").textContent = complete() ? "View postcard" : "Give me a hint";
  $("journal-count").textContent =
    editions.filter((e) => read("stamp/" + e.id, 0)).length + "/6";
  pocketGuide();
  chart();
  paint([], newest);
}
function stamp() {
  freeze();
  const id = "stamp/" + puzzle.edition.id;
  write(id, Math.max(read(id, 0), score()));
  if (state.spec.mode === "daily") write("finished/" + state.spec.date, true);
}
function selectPath(indices) {
  anchor = null;
  if (complete()) return;
  if (indices.length < 2) {
    paint();
    feedback("Choose two ends on one straight line.");
    return;
  }
  const letters = indices.map((i) => puzzle.grid[i]).join("");
  const reverse = [...letters].reverse().join("");
  const entry = [...puzzle.words, puzzle.mystery].find(
    (e) => e.word === letters || e.word === reverse,
  );
  if (!entry || Object.hasOwn(state.found, entry.word)) {
    paint();
    feedback(
      entry
        ? titleCase(entry.word) + " is already charted."
        : "No match. Try another line.",
    );
    return;
  }
  if (entry === puzzle.mystery && remaining().length) {
    paint();
    feedback("Find the listed words to unlock the final mystery.");
    return;
  }
  state.found[entry.word] = indices;
  window.dispatchEvent(
    new CustomEvent("cozy:found", { detail: { complete: complete() } }),
  );
  clearHint();
  if (complete()) stamp();
  render(entry.word);
  save();
  if (complete()) {
    feedback("Mystery solved. Postcard earned!");
    postcard();
  } else if (!remaining().length) {
    feedback("Final mystery unlocked. " + puzzle.mystery.clue);
  } else
    feedback(
      titleCase(entry.word) + " found. " + remaining().length + " left.",
    );
}
function clearHint() {
  clearTimeout(hintTimer);
  if (selectedHint !== null) cells[selectedHint]?.classList.remove("marked");
  selectedHint = null;
}
function giveHint() {
  if (complete()) {
    postcard();
    return;
  }
  const entries = remaining();
  const entry = entries[pocketIndex % (entries.length || 1)] || puzzle.mystery;
  const path = puzzle.paths[entry.word];
  clearHint();
  anchor = null;
  paint();
  state.hintSteps ||= {};
  const step = Math.min(3, (state.hintSteps[entry.word] || 0) + 1);
  if (step > (state.hintSteps[entry.word] || 0)) state.hints++;
  state.hintSteps[entry.word] = step;
  selectedHint = path[0];
  cells[selectedHint].classList.add("marked");
  bringIntoBoardView(selectedHint);
  const n = puzzle.config.size,
    a = path[0],
    b = path.at(-1);
  const dy = Math.sign(Math.floor(b / n) - Math.floor(a / n)),
    dx = Math.sign((b % n) - (a % n));
  const direction = [
    dy < 0 ? "up" : dy > 0 ? "down" : "",
    dx < 0 ? "left" : dx > 0 ? "right" : "",
  ]
    .filter(Boolean)
    .join(" and ");
  const target =
    state.clues || !entries.length ? entry.clue : titleCase(entry.word);
  if (step === 1)
    feedback(
      target +
        " · Start with " +
        entry.word[0] +
        " at row " +
        (Math.floor(a / n) + 1) +
        ", column " +
        ((a % n) + 1) +
        ".",
    );
  else if (step === 2)
    feedback(target + " · Read " + direction + " from the marked letter.");
  else {
    paint(path);
    feedback(target + " · Follow the highlighted path.");
    hintTimer = setTimeout(() => paint(anchor === null ? [] : [anchor]), 3200);
  }
  save();
}
function chooseCell(index) {
  if (anchor === null) {
    anchor = index;
    paint([index]);
    feedback("Choose the other end of the word.");
  } else if (anchor === index) {
    anchor = null;
    paint();
    feedback("Selection cleared.");
  } else selectPath(line(anchor, index, puzzle.config.size));
}
function focusCell(index, move) {
  cells[focused].tabIndex = -1;
  focused = index;
  cells[index].tabIndex = 0;
  if (move) {
    cells[index].focus({ preventScroll: true });
    bringIntoBoardView(index);
  }
}
function hit(event) {
  const box = board.getBoundingClientRect(),
    n = puzzle.config.size;
  const x = Math.floor(((event.clientX - box.left) * n) / box.width),
    y = Math.floor(((event.clientY - box.top) * n) / box.height);
  return x < 0 || x >= n || y < 0 || y >= n ? null : y * n + x;
}
let nativeTouch = false;
board.addEventListener("pointerdown", (event) => {
  nativeTouch = event.pointerType === "touch" && !panControls.hidden;
  if (nativeTouch) return;
  const index = hit(event);
  clearTimeout(hintTimer);
  if (complete() || index === null || gesture || event.button !== 0) return;
  event.preventDefault();
  focusCell(index, false);
  board.setPointerCapture(event.pointerId);
  gesture = { id: event.pointerId, start: index, end: index, moved: false };
  paint(line(anchor ?? index, index, puzzle.config.size));
});
board.addEventListener("pointermove", (event) => {
  if (gesture?.id !== event.pointerId) return;
  const end = hit(event);
  if (gesture.end === end) return;
  gesture.end = end;
  gesture.moved ||= end !== null && end !== gesture.start;
  paint(
    end === null ? [] : line(anchor ?? gesture.start, end, puzzle.config.size),
  );
});
board.addEventListener("pointerup", (event) => {
  if (gesture?.id !== event.pointerId) return;
  const end = hit(event),
    { start, moved } = gesture;
  gesture = null;
  if (end === null) {
    anchor = null;
    paint();
    return;
  }
  if (moved || start !== end)
    selectPath(line(anchor ?? start, end, puzzle.config.size));
  else chooseCell(end);
});
board.addEventListener("lostpointercapture", () => {
  if (gesture) {
    gesture = null;
    anchor = null;
    paint();
  }
});
board.addEventListener("click", (event) => {
  if (
    (event.detail === 0 || nativeTouch) &&
    event.target.matches(".cell") &&
    !complete()
  ) {
    const index = Number(event.target.dataset.index);
    focusCell(index, false);
    chooseCell(index);
  }
  nativeTouch = false;
});
board.addEventListener("keydown", (event) => {
  if (!event.target.matches(".cell")) return;
  const i = Number(event.target.dataset.index),
    n = puzzle.config.size,
    col = i % n;
  const moves = {
    ArrowLeft: i - (col > 0),
    ArrowRight: i + (col < n - 1),
    ArrowUp: Math.max(col, i - n),
    ArrowDown: Math.min(n * n - n + col, i + n),
  };
  if (Object.hasOwn(moves, event.key)) {
    event.preventDefault();
    focusCell(moves[event.key], true);
    if (anchor !== null) paint(line(anchor, moves[event.key], n));
  } else if (event.key === "Escape") {
    anchor = null;
    paint();
    feedback("Selection cleared.");
  }
});
function openDialog(kicker) {
  if (audioControls.parentNode === content) {
    audioControls.hidden = true;
    document.body.append(audioControls);
  }
  content.replaceChildren();
  $("dialog-kicker").textContent = kicker;
  freeze();
  save();
  if (!dialog.open) dialog.showModal();
}
function journal() {
  openDialog("The Night Atlas");
  content.append(
    element("h2", "Field journal"),
    element(
      "p",
      "Collect a postcard from each place. Finish without hints for a gold seal. Start and finish in Clues without hints to add an atlas star.",
    ),
  );
  const cards = element("div", "", "collection");
  for (const e of editions) {
    const earned = read("stamp/" + e.id, 0);
    const card = element(
      "div",
      "",
      "stamp" + (earned ? " earned" : "") + (earned >= 2 ? " gold" : ""),
    );
    const img = element("img");
    img.src = art(e);
    img.alt = "";
    card.append(
      img,
      element("b", e.name),
      element(
        "small",
        earned === 3
          ? "✷ Gold seal · Atlas star"
          : earned === 2
            ? "✷ Gold seal"
            : earned
              ? "Postcard collected"
              : "Undiscovered",
      ),
    );
    cards.append(card);
  }
  content.append(cards);
  const week = element("div", "", "week");
  const today = dailySpec().date,
    day = Date.parse(today + "T00:00:00Z");
  for (let delta = 6; delta >= 0; delta--) {
    const date = new Date(day - delta * 86400000),
      id = date.toISOString().slice(0, 10);
    const won = read("finished/" + id, false);
    const mark = element(
      "span",
      date.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" }),
    );
    mark.append(element("b", won ? "✷" : "·"));
    mark.setAttribute("aria-label", id + (won ? ", solved" : ", uncharted"));
    mark.classList.toggle("won", won);
    week.append(mark);
  }
  content.append(element("h3", "Daily editions"), week);
}
function streak(date) {
  let day = Date.parse(date + "T00:00:00Z"),
    count = 0;
  while (read("finished/" + new Date(day).toISOString().slice(0, 10), false)) {
    count++;
    day -= 86400000;
  }
  return count;
}
function postcard() {
  openDialog(
    score() === 3
      ? "✷ Atlas star & gold seal"
      : score() === 2
        ? "✷ Gold seal earned"
        : "Postcard earned",
  );
  const img = element("img", "", "postcard");
  img.src = art(puzzle.edition);
  img.alt = puzzle.edition.name;
  const daily = state.spec.mode === "daily";
  const record =
    clock(state.ms) +
    " · " +
    state.hints +
    (state.hints === 1 ? " hint" : " hints") +
    (daily ? " · Daily streak " + streak(state.spec.date) : "");
  content.append(
    img,
    element("h2", puzzle.edition.name),
    element("p", puzzle.edition.afterword),
    element("p", record),
  );
  const actions = element("div", "", "dialog-actions");
  actions.append(
    button("Another map", () => {
      dialog.close();
      newFree(read("level", "easy"));
    }),
    button("Field journal", journal),
  );
  if (daily)
    actions.append(
      button("Copy result", async () => {
        const summary =
          "Cozy Search · " +
          state.spec.date +
          "\n" +
          puzzle.edition.name +
          " · Mystery solved\n" +
          record +
          "\nhttps://justaskjohnny.com/cozy-search/";
        try {
          await navigator.clipboard.writeText(summary);
          actions.lastChild.textContent = "Copied";
        } catch {
          const out = element("textarea");
          out.value = summary;
          out.readOnly = true;
          content.append(out);
          out.select();
        }
      }),
    );
  content.append(actions);
}
function setView(clues) {
  if (!clues && !complete()) state.peeked = true;
  state.clues = clues;
  write("clues", clues);
  render();
  save();
}
$("free").onclick = goFree;
$("daily").onclick = goDaily;
$("new").onclick = () =>
  state.spec.mode === "daily" ? goFree() : newFree(state.spec.level);
$("level").onchange = (event) => newFree(event.target.value);
$("words-mode").onclick = () => setView(false);
$("clues-mode").onclick = () => setView(true);
$("hint").onclick = giveHint;
$("pocket-next").onclick = () => {
  pocketIndex++;
  pocketGuide();
};
$("journal").onclick = journal;
$("settings").onclick = () => {
  openDialog("How to play");
  content.append($("guide-template").content.cloneNode(true), audioControls);
  audioControls.hidden = false;
};
$("close").onclick = () => dialog.close();
dialog.addEventListener("close", runClock);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    freeze();
    save();
  } else runClock();
});
window.addEventListener("pagehide", () => {
  freeze();
  save();
});
window.addEventListener("pageshow", () => runClock());
setInterval(() => {
  if (tick !== null) $("timer").textContent = clock(timeNow());
}, 500);
const preferred = read("level", "easy");
newFree(Object.hasOwn(levels, preferred) ? preferred : "easy");
