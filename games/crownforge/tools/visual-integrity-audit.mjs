import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

import {
  ASSET_RECTS,
  BUILDING_STAGE_ATLAS,
  COMBAT_ATLASES,
  ENEMY_CAMP_ASSET,
  ENVIRONMENT_ATLAS,
  FIRST_AGE_ASSETS,
  VILLAGER_ATLASES,
} from '../src/config.js';
import { ANIMATION_DEFINITIONS, animationFrame } from '../src/animation.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const ALPHA_THRESHOLD = 8;
const UNSAFE_BAND = 2;

function readPng(filePath) {
  const bytes = fs.readFileSync(filePath);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.deepEqual(bytes.subarray(0, 8), signature, `${filePath} is not a PNG`);
  let offset = 8;
  let width;
  let height;
  let bitDepth;
  let colorType;
  let interlace;
  const idat = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }
  assert.equal(bitDepth, 8, `${path.basename(filePath)} must use 8-bit channels`);
  assert.equal(interlace, 0, `${path.basename(filePath)} must be non-interlaced`);
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  assert.ok(channels, `${path.basename(filePath)} uses unsupported PNG color type ${colorType}`);
  const bytesPerPixel = channels;
  const rowBytes = width * channels;
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(height * rowBytes);
  let input = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[input++];
    const rowStart = y * rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const raw = inflated[input++];
      const left = x >= bytesPerPixel ? pixels[rowStart + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[rowStart - rowBytes + x] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? pixels[rowStart - rowBytes + x - bytesPerPixel] : 0;
      let value = raw;
      if (filter === 1) value = (raw + left) & 255;
      if (filter === 2) value = (raw + up) & 255;
      if (filter === 3) value = (raw + Math.floor((left + up) / 2)) & 255;
      if (filter === 4) {
        const estimate = left + up - upLeft;
        const pa = Math.abs(estimate - left);
        const pb = Math.abs(estimate - up);
        const pc = Math.abs(estimate - upLeft);
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        value = (raw + predictor) & 255;
      }
      pixels[rowStart + x] = value;
    }
  }
  return {
    width,
    height,
    channels,
    alphaAt(x, y) {
      if (colorType === 6) return pixels[(y * rowBytes) + (x * 4) + 3];
      if (colorType === 4) return pixels[(y * rowBytes) + (x * 2) + 1];
      return 255;
    },
  };
}

function assetPath(src) {
  return path.resolve(ROOT, src.replace(/^\.\//, '').split('?')[0]);
}

function metadata(atlas, fallback) {
  return {
    width: atlas.width ?? fallback.width,
    height: atlas.height ?? fallback.height,
    columns: atlas.columns ?? fallback.columns,
    rows: atlas.rows ?? fallback.rows,
  };
}

function atlasBoundaryReport(filePath, atlas) {
  const image = readPng(filePath);
  const expected = metadata(atlas, atlas);
  const dimensionMismatch = image.width !== expected.width || image.height !== expected.height;
  const cells = [];
  for (let row = 0; row < expected.rows; row += 1) {
    for (let column = 0; column < expected.columns; column += 1) {
      const left = Math.ceil(column * expected.width / expected.columns);
      const top = Math.ceil(row * expected.height / expected.rows);
      const right = Math.floor((column + 1) * expected.width / expected.columns) - 1;
      const bottom = Math.floor((row + 1) * expected.height / expected.rows) - 1;
      const unsafe = { top: 0, right: 0, bottom: 0, left: 0 };
      for (let y = top; y <= bottom; y += 1) {
        for (let x = left; x <= right; x += 1) {
          if (image.alphaAt(x, y) <= ALPHA_THRESHOLD) continue;
          if (y - top < UNSAFE_BAND) unsafe.top += 1;
          if (right - x < UNSAFE_BAND) unsafe.right += 1;
          if (bottom - y < UNSAFE_BAND) unsafe.bottom += 1;
          if (x - left < UNSAFE_BAND) unsafe.left += 1;
        }
      }
      cells.push({ row, column, unsafe });
    }
  }
  return {
    file: path.relative(ROOT, filePath),
    actual: { width: image.width, height: image.height },
    expected,
    dimensionMismatch,
    unsafeCells: cells.filter(({ unsafe }) => unsafe.top || unsafe.right || unsafe.left),
    bottomContactCells: cells.filter(({ unsafe }) => unsafe.bottom),
  };
}

const atlasEntries = [
  ['environment', ENVIRONMENT_ATLAS],
  ['buildingStages', BUILDING_STAGE_ATLAS],
  ['enemyCamp', ENEMY_CAMP_ASSET],
  ...Object.entries(FIRST_AGE_ASSETS).map(([key, value]) => [`firstAge.${key}`, value]),
  ...Object.entries(VILLAGER_ATLASES)
    .filter(([, value]) => value?.src && value.width && value.height && value.columns && value.rows)
    .map(([key, value]) => [`villager.${key}`, value]),
  ...Object.entries(COMBAT_ATLASES).map(([key, value]) => [`combat.${key}`, value]),
];

const missingFiles = [];
const boundaryReports = [];
for (const [key, atlas] of atlasEntries) {
  const filePath = assetPath(atlas.src);
  if (!fs.existsSync(filePath)) {
    missingFiles.push({ key, file: path.relative(ROOT, filePath) });
    continue;
  }
  if (atlas.columns && atlas.rows) boundaryReports.push({ key, ...atlasBoundaryReport(filePath, atlas) });
}

const animationCoverage = [];
const fallbacks = [];
for (const [unitType, definition] of Object.entries(ANIMATION_DEFINITIONS)) {
  for (const state of Object.keys(definition.clips)) {
    const clip = definition.clips[state];
    if (clip.fallback) fallbacks.push({ unitType, state, fallback: clip.fallback });
    for (let direction = 0; direction < definition.directionCount; direction += 1) {
      const frame = animationFrame(unitType, state, 0.37, direction);
      animationCoverage.push({ unitType, state, direction, atlas: frame.atlasKey, row: frame.row, column: frame.column });
    }
  }
}

const activeSources = [
  ...Object.values(ASSET_RECTS).map((_, index) => index === 0 ? './assets/crownforge-asset-atlas.png' : null),
  ENVIRONMENT_ATLAS.src,
  BUILDING_STAGE_ATLAS.src,
  ENEMY_CAMP_ASSET.src,
  ...Object.values(FIRST_AGE_ASSETS).map((value) => value?.src).filter(Boolean),
  ...Object.values(VILLAGER_ATLASES).map((value) => value?.src).filter(Boolean),
  ...Object.values(COMBAT_ATLASES).map((value) => value?.src).filter(Boolean),
].filter(Boolean).map((src) => src.split('?')[0]);
const placeholderReferences = activeSources.filter((src) => /placeholder|programmer|temp|debug|generic/i.test(src));

const result = {
  status: missingFiles.length || boundaryReports.some((report) => report.dimensionMismatch) || placeholderReferences.length ? 'failed' : 'passed',
  root: ROOT,
  missingFiles,
  placeholderReferences,
  fallbacks,
  animationCombinations: animationCoverage.length,
  boundaryReports,
};

console.log(JSON.stringify(result, null, 2));
if (result.status === 'failed') process.exitCode = 1;
