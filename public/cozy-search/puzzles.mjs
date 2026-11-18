import { editions } from "./editions.mjs";

export const levels = {
  easy: { label: "Easy", size: 8, count: 5, dirs: 2, guide: "Across & down" },
  casual: {
    label: "Casual",
    size: 9,
    count: 6,
    dirs: 4,
    guide: "Across, down & diagonal",
  },
  tricky: {
    label: "Tricky",
    size: 11,
    count: 8,
    dirs: 8,
    guide: "All eight directions",
  },
  hard: {
    label: "Hard",
    size: 13,
    count: 10,
    dirs: 8,
    guide: "All eight directions",
  },
  expert: {
    label: "Very hard",
    size: 18,
    count: 30,
    dirs: 8,
    guide: "All eight directions",
  },
};
const directions = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, -1],
  [-1, 1],
];
const filler =
  "EEEEEEEEAAAAAAIIIIIOOOOONNNNNRRRRRTTTTTSSSSLLLLDDDDCCUUMMFFPPGGHHBBYYWWKVXZJQ";

function randomFrom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(items, random) {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
export function dailySpec(date = new Date()) {
  const dateUTC = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const day = Math.floor(dateUTC / 86400000);
  return {
    mode: "daily",
    date: new Date(dateUTC).toISOString().slice(0, 10),
    theme: day % editions.length,
    level: "casual",
    seed: Math.imul(day, 2654435761) >>> 0,
  };
}
export function freeSpec(level, recent, nextSeed) {
  const choices = editions
    .map((_, i) => i)
    .filter(
      (i) =>
        !(
          recent.length >= editions.length ? recent.slice(-2) : recent
        ).includes(i),
    );
  const seed = nextSeed();
  return {
    mode: "free",
    level,
    theme: choices[nextSeed() % choices.length],
    seed,
  };
}
export function line(start, end, size) {
  const row = Math.floor(start / size),
    col = start % size;
  const dy = Math.floor(end / size) - row,
    dx = (end % size) - col;
  if (dy && dx && Math.abs(dy) !== Math.abs(dx)) return [];
  const step = Math.sign(dy) * size + Math.sign(dx);
  return Array.from(
    { length: Math.max(Math.abs(dx), Math.abs(dy)) + 1 },
    (_, i) => start + step * i,
  );
}
// Bound the work for dense maps. Prefer crossings and a mix of orientations.
function place(entries, config, random) {
  const { size, dirs } = config;
  const grid = Array(size * size).fill("");
  const paths = {},
    used = Array(dirs).fill(0);
  for (const { word } of entries) {
    let best,
      bestScore = -Infinity;
    for (let d = 0; d < dirs; d++) {
      const [dy, dx] = directions[d],
        last = word.length - 1;
      for (
        let row = Math.max(0, -dy * last);
        row < Math.min(size, size - dy * last);
        row++
      ) {
        for (
          let col = Math.max(0, -dx * last);
          col < Math.min(size, size - dx * last);
          col++
        ) {
          const start = row * size + col,
            step = dy * size + dx;
          let matched = 0,
            k = 0;
          for (; k < word.length; k++) {
            const old = grid[start + k * step];
            if (old && old !== word[k]) break;
            if (old) matched++;
          }
          if (k !== word.length || matched === word.length) continue;
          const score = matched * 0.8 + random() * 2 - used[d] * 0.6;
          if (score > bestScore) {
            best = { start, step, d };
            bestScore = score;
          }
        }
      }
    }
    if (!best) return null;
    used[best.d]++;
    paths[word] = [...word].map((letter, i) => {
      const index = best.start + i * best.step;
      grid[index] = letter;
      return index;
    });
  }
  return { grid, paths };
}
export function generate(spec) {
  const edition = editions[spec.theme],
    config = levels[spec.level],
    random = randomFrom(spec.seed);
  const words = shuffle(
    edition.entries.filter((e) => e.word.length <= config.size),
    random,
  ).slice(0, config.count);
  const mystery = shuffle(
    edition.mysteries.filter((e) => e.word.length <= config.size),
    random,
  )[0];
  const ordered = [...words, mystery].sort(
    (a, b) => b.word.length - a.word.length,
  );
  let layout;
  for (let attempt = 0; !layout && attempt < 8; attempt++)
    layout = place(ordered, config, random);
  if (!layout) {
    // Guaranteed slots for this catalog: at most one row per word, or two halves in the 18-square edition.
    const grid = Array(config.size ** 2).fill(""),
      paths = {};
    const slots = shuffle(
      Array.from(
        { length: config.size * (config.size === 18 ? 2 : 1) },
        (_, i) => i,
      ),
      random,
    );
    for (const { word } of ordered) {
      const slot = slots.pop(),
        width = config.size === 18 ? 9 : config.size;
      const start =
        slot * width + Math.floor(random() * (width - word.length + 1));
      paths[word] = [...word].map((letter, i) => {
        grid[start + i] = letter;
        return start + i;
      });
    }
    layout = { grid, paths };
  }
  const grid = layout.grid.map(
    (letter) => letter || filler[Math.floor(random() * filler.length)],
  );
  return {
    ...layout,
    grid,
    edition,
    config,
    words: words.sort((a, b) => (a.word < b.word ? -1 : 1)),
    mystery,
  };
}
