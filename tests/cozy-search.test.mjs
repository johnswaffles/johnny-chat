import assert from "node:assert/strict";
import test from "node:test";
import {
  dailySpec,
  freeSpec,
  generate,
  levels,
  line,
} from "../public/cozy-search/puzzles.mjs";
import { editions } from "../public/cozy-search/editions.mjs";

test("every setting and level produces complete, selectable entries and a separate mystery", () => {
  for (let theme = 0; theme < editions.length; theme++) {
    for (const level of Object.keys(levels)) {
      const boards = new Set();
      for (let seed = 0; seed < 50; seed++) {
        const { config, grid, words, mystery, paths } = generate({
          theme,
          level,
          seed,
        });
        assert.equal(grid.length, config.size ** 2);
        assert.equal(words.length, config.count);
        assert.equal(
          new Set([...words, mystery].map((e) => e.word)).size,
          words.length + 1,
        );
        for (const { word, clue } of [...words, mystery]) {
          assert.ok(clue.length > 6);
          const path = paths[word];
          assert.deepEqual(path, line(path[0], path.at(-1), config.size));
          assert.deepEqual(
            path.toReversed(),
            line(path.at(-1), path[0], config.size),
          );
          assert.equal(path.map((i) => grid[i]).join(""), word);
        }
        boards.add(grid.join(""));
      }
      assert.equal(boards.size, 50);
    }
  }
});

test("daily boards agree all day, independent of free play, and turn over at local midnight", () => {
  const a = dailySpec(new Date(2026, 10, 17, 0, 1));
  const b = dailySpec(new Date(2026, 10, 17, 23, 59));
  assert.deepEqual(generate(a), generate(b));
  assert.equal(a.date, "2026-11-17");
  const tomorrow = dailySpec(new Date(2026, 10, 18, 0, 0));
  assert.notDeepEqual(generate(a).grid, generate(tomorrow).grid);
});

test("free editions rotate and always receive a new map seed", () => {
  const themes = [],
    seeds = new Set();
  let next = 0;
  for (let i = 0; i < 100; i++) {
    const spec = freeSpec("easy", themes, () => ++next);
    assert.notEqual(themes.at(-1), spec.theme);
    assert.ok(!seeds.has(spec.seed));
    themes.push(spec.theme);
    seeds.add(spec.seed);
  }
  assert.equal(new Set(themes).size, editions.length);
});
