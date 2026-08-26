import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('/Users/johnshopinski/Documents/New project/second-brain/node_modules/sharp');

const [, , input, output] = process.argv;
if (!input || !output) {
  throw new Error('Usage: node tools/prepare-scout-atlas.mjs <generated.png> <output.png>');
}

const GRID = 4;
const ATLAS_SIZE = 1254;
const CELL_GUTTER_X = 8;
const CELL_GUTTER_BOTTOM = 16;
const CELL_GUTTER_TOP = 16;
const VISIBLE_ALPHA = 16;
const MAX_UNIFORM_SCALE = 0.866;

const { data, info } = await sharp(input)
  .ensureAlpha()
  .resize(ATLAS_SIZE, ATLAS_SIZE, { fit: 'fill' })
  .raw()
  .toBuffer({ resolveWithObject: true });

// Image generation may encode transparency as a neutral studio checkerboard.
// Remove the matte globally so enclosed gaps between the horse's legs become
// transparent too, while preserving the warm horse, blue cloth, and shadows.
for (let index = 0; index < data.length; index += 4) {
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const brightness = (red + green + blue) / 3;
  const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
  if (brightness >= 205 && chroma <= 28) {
    data[index + 3] = 0;
  } else if (brightness >= 180 && chroma <= 18) {
    data[index + 3] = Math.min(
      data[index + 3],
      Math.max(0, Math.min(255, Math.round((205 - brightness) / 25 * 255))),
    );
  }
}

// Generated rows can overlap vertically when a spear reaches upward. Connected
// components let us recover complete poses without cutting at an assumed row
// boundary or accidentally copying a neighboring rider whose bounds overlap.
const totalPixels = info.width * info.height;
const labels = new Uint32Array(totalPixels);
const stack = new Int32Array(totalPixels);
const components = [];
const isVisible = (pixel) => data[pixel * 4 + 3] > VISIBLE_ALPHA;

for (let seed = 0; seed < totalPixels; seed += 1) {
  if (labels[seed] || !isVisible(seed)) continue;
  const id = components.length + 1;
  let head = 0;
  let tail = 0;
  stack[tail++] = seed;
  labels[seed] = id;
  let count = 0;
  let minX = info.width;
  let maxX = -1;
  let minY = info.height;
  let maxY = -1;
  let sumX = 0;
  let sumY = 0;

  while (head < tail) {
    const pixel = stack[head++];
    const x = pixel % info.width;
    const y = Math.floor(pixel / info.width);
    count += 1;
    sumX += x;
    sumY += y;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);

    for (let deltaY = -1; deltaY <= 1; deltaY += 1) {
      for (let deltaX = -1; deltaX <= 1; deltaX += 1) {
        if (!deltaX && !deltaY) continue;
        const nextX = x + deltaX;
        const nextY = y + deltaY;
        if (nextX < 0 || nextX >= info.width || nextY < 0 || nextY >= info.height) continue;
        const next = nextY * info.width + nextX;
        if (labels[next] || !isVisible(next)) continue;
        labels[next] = id;
        stack[tail++] = next;
      }
    }
  }

  components.push({
    id,
    count,
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    centerX: sumX / count,
    centerY: sumY / count,
  });
}

const substantial = components
  .filter((component) => component.count >= 1000 && component.width >= 40 && component.height >= 70)
  .sort((first, second) => first.centerY - second.centerY);
if (substantial.length !== GRID * GRID) {
  throw new Error(`Expected ${GRID * GRID} complete Scout poses, found ${substantial.length}`);
}

const frames = [];
for (let row = 0; row < GRID; row += 1) {
  const rowFrames = substantial
    .slice(row * GRID, (row + 1) * GRID)
    .sort((first, second) => first.centerX - second.centerX);
  for (let column = 0; column < GRID; column += 1) {
    frames.push({ ...rowFrames[column], row, column });
  }
}

const cellWidth = ATLAS_SIZE / GRID;
const cellHeight = ATLAS_SIZE / GRID;
const maximumWidth = Math.floor(cellWidth - CELL_GUTTER_X * 2);
const maximumHeight = Math.floor(cellHeight - CELL_GUTTER_TOP - CELL_GUTTER_BOTTOM);
const uniformScale = Math.min(MAX_UNIFORM_SCALE, ...frames.flatMap((frame) => [
  maximumWidth / frame.width,
  maximumHeight / frame.height,
]));

const composites = [];
for (const frame of frames) {
  const targetWidth = Math.max(1, Math.floor(frame.width * uniformScale));
  const targetHeight = Math.max(1, Math.floor(frame.height * uniformScale));
  const targetCellLeft = Math.ceil(frame.column * cellWidth);
  const targetCellTop = Math.ceil(frame.row * cellHeight);
  const targetCellRight = Math.floor((frame.column + 1) * cellWidth);
  const targetCellBottom = Math.floor((frame.row + 1) * cellHeight);
  const targetCellWidth = targetCellRight - targetCellLeft;
  const framePixels = Buffer.alloc(frame.width * frame.height * 4);
  for (let localY = 0; localY < frame.height; localY += 1) {
    for (let localX = 0; localX < frame.width; localX += 1) {
      const sourceX = frame.left + localX;
      const sourceY = frame.top + localY;
      const sourcePixel = sourceY * info.width + sourceX;
      if (labels[sourcePixel] !== frame.id) continue;
      const sourceIndex = sourcePixel * 4;
      const targetIndex = (localY * frame.width + localX) * 4;
      data.copy(framePixels, targetIndex, sourceIndex, sourceIndex + 4);
    }
  }
  const sprite = await sharp(framePixels, {
    raw: { width: frame.width, height: frame.height, channels: 4 },
  })
    .resize(targetWidth, targetHeight, { fit: 'fill' })
    .png()
    .toBuffer();
  composites.push({
    input: sprite,
    left: targetCellLeft + Math.floor((targetCellWidth - targetWidth) / 2),
    top: targetCellBottom - CELL_GUTTER_BOTTOM - targetHeight,
  });
}

await sharp({
  create: {
    width: ATLAS_SIZE,
    height: ATLAS_SIZE,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(composites)
  .png()
  .toFile(output);

console.log(JSON.stringify({
  output,
  dimensions: `${ATLAS_SIZE}x${ATLAS_SIZE}`,
  frames: frames.map(({ row, column, count, width, height }) => ({ row, column, count, width, height })),
  uniformScale: Number(uniformScale.toFixed(4)),
  gutter: { horizontal: CELL_GUTTER_X, top: CELL_GUTTER_TOP, bottom: CELL_GUTTER_BOTTOM },
}, null, 2));
